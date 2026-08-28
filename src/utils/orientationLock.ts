import { Dimensions, Platform } from "react-native";
import { useEffect, useState } from "react";
import { breakpoints } from "./breakpoints";

/** Android / general tablet shortest-side threshold (sw600dp-ish). */
const TABLET_SHORTEST_SIDE_PX = 600;

type ScreenOrientationApi = {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => Promise<void>;
};

function readShortestSide(): number {
  const { width, height } = Dimensions.get("window");
  return Math.min(width, height);
}

type WebNavigator = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

type WebWindow = {
  innerWidth?: number;
  innerHeight?: number;
  matchMedia?: (query: string) => { matches: boolean };
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
  navigator?: WebNavigator;
  screen?: { orientation?: ScreenOrientationApi };
};

function getWebWindow(): WebWindow | undefined {
  return (globalThis as { window?: WebWindow }).window;
}

/** iPadOS 13+ Safari reports as MacIntel with touch. */
function isIpadOsWeb(): boolean {
  const nav = getWebWindow()?.navigator;
  if (!nav) return false;
  const ua = nav.userAgent || "";
  if (/iPad/i.test(ua)) return true;
  if (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1) return true;
  return false;
}

function isTabletUa(): boolean {
  const nav = getWebWindow()?.navigator;
  if (!nav) return false;
  const ua = nav.userAgent || "";
  if (isIpadOsWeb()) return true;
  if (/Tablet/i.test(ua)) return true;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  return false;
}

/**
 * Phone UA — including Chrome DevTools device emulation (iPhone / Android Mobile).
 * Checked before pointer media queries, because DevTools keeps desktop fine-pointer.
 */
function isMobilePhoneUa(): boolean {
  const nav = getWebWindow()?.navigator;
  if (!nav) return false;
  if (isTabletUa()) return false;
  const ua = nav.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/Mobi/i.test(ua)) return true;
  return false;
}

function isDesktopWebPointer(): boolean {
  const win = getWebWindow();
  if (!win?.matchMedia) return false;
  return win.matchMedia("(pointer: fine) and (hover: hover)").matches;
}

/**
 * True when this client should stay portrait-locked.
 * Phones: yes. Tablets + desktop: no.
 */
export function shouldLockPortraitOrientation(): boolean {
  if (Platform.OS === "web") {
    if (isTabletUa()) return false;
    if (isMobilePhoneUa()) return true;
    if (isDesktopWebPointer()) return false;
    const win = getWebWindow();
    if (!win) return false;
    const shortest = Math.min(win.innerWidth ?? 0, win.innerHeight ?? 0);
    return shortest > 0 && shortest < breakpoints.tablet;
  }

  if (Platform.OS === "ios" && Platform.isPad) return false;

  return readShortestSide() < TABLET_SHORTEST_SIDE_PX;
}

export type ForcedPortraitFrame = {
  /**
   * Phone is physically landscape — layout uses the real (landscape) size,
   * but the UI should show a "rotate to portrait" reminder rather than
   * faking/letterboxing a portrait frame (that used to force a remount of
   * the whole app whenever this flipped).
   */
  forcePortrait: boolean;
  /** Layout width the app should use — always the real physical size. */
  layoutWidth: number;
  /** Layout height the app should use — always the real physical size. */
  layoutHeight: number;
  /** Physical viewport width. */
  physicalWidth: number;
  /** Physical viewport height. */
  physicalHeight: number;
};

/**
 * Report the real physical layout size plus whether a phone is currently
 * landscape (so callers can show a "please rotate" reminder). We no longer
 * swap width/height into a fake portrait frame — the app renders at its
 * actual size and adapts via existing responsive/landscape layout logic.
 */
export function getForcedPortraitFrame(
  physicalWidth: number,
  physicalHeight: number,
): ForcedPortraitFrame {
  const landscape = physicalWidth > physicalHeight;
  const lock = shouldLockPortraitOrientation();
  return {
    forcePortrait: lock && landscape,
    layoutWidth: physicalWidth,
    layoutHeight: physicalHeight,
    physicalWidth,
    physicalHeight,
  };
}

/** No-op passthrough — kept so existing callers keep working; layout always uses real size. */
export function applyPortraitLockToSize(size: {
  width: number;
  height: number;
}): { width: number; height: number } {
  return size;
}

export function useForcedPortraitFrame(): ForcedPortraitFrame {
  const read = (): ForcedPortraitFrame => {
    if (Platform.OS === "web") {
      const win = getWebWindow();
      return getForcedPortraitFrame(win?.innerWidth ?? 0, win?.innerHeight ?? 0);
    }
    const { width, height } = Dimensions.get("window");
    return getForcedPortraitFrame(width, height);
  };

  const [frame, setFrame] = useState(read);

  useEffect(() => {
    const sync = () => setFrame(read());
    sync();
    if (Platform.OS !== "web") {
      const sub = Dimensions.addEventListener("change", sync);
      return () => sub.remove();
    }
    const win = getWebWindow();
    if (!win?.addEventListener) return;
    win.addEventListener("resize", sync);
    win.addEventListener("orientationchange", sync);
    return () => {
      win.removeEventListener?.("resize", sync);
      win.removeEventListener?.("orientationchange", sync);
    };
  }, []);

  return frame;
}

async function applyNativeOrientationLock(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const ScreenOrientation = await import("expo-screen-orientation");
    if (shouldLockPortraitOrientation()) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    } else {
      await ScreenOrientation.unlockAsync();
    }
  } catch {
    // Expo Go / missing native module — Info.plist / Android defaults remain.
  }
}

function getWebScreenOrientation(): ScreenOrientationApi | null {
  return getWebWindow()?.screen?.orientation ?? null;
}

async function applyWebOrientationLock(): Promise<void> {
  if (Platform.OS !== "web") return;
  if (!shouldLockPortraitOrientation()) {
    try {
      await getWebScreenOrientation()?.unlock?.();
    } catch {
      // ignore
    }
    return;
  }

  const orientation = getWebScreenOrientation();
  if (!orientation?.lock) return;

  try {
    await orientation.lock("portrait");
  } catch {
    try {
      await orientation.lock("portrait-primary");
    } catch {
      // Tab / DevTools: CSS portrait shell keeps layout locked instead.
    }
  }
}

/**
 * Apply portrait lock on phones; leave tablets and desktop free to rotate.
 * Safe to call at boot; re-runs on web resize/orientationchange.
 */
export function installOrientationLock(): () => void {
  void applyNativeOrientationLock();
  void applyWebOrientationLock();

  if (Platform.OS !== "web") {
    const sub = Dimensions.addEventListener("change", () => {
      void applyNativeOrientationLock();
    });
    return () => sub.remove();
  }

  const win = getWebWindow();
  if (!win?.addEventListener) return () => undefined;

  const sync = () => {
    void applyWebOrientationLock();
  };
  win.addEventListener("resize", sync);
  win.addEventListener("orientationchange", sync);
  return () => {
    win.removeEventListener?.("resize", sync);
    win.removeEventListener?.("orientationchange", sync);
  };
}
