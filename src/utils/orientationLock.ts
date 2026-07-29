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
  // Android tablets omit "Mobile" in the UA.
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

/**
 * Desktop browsers (mouse/trackpad) — exempt when there is no mobile UA.
 */
function isDesktopWebPointer(): boolean {
  const win = getWebWindow();
  if (!win?.matchMedia) return false;
  return win.matchMedia("(pointer: fine) and (hover: hover)").matches;
}

function readWebLandscape(): boolean {
  const win = getWebWindow();
  if (!win) return false;
  return (win.innerWidth ?? 0) > (win.innerHeight ?? 0);
}

/**
 * True when this client should stay portrait-locked.
 * Phones: yes. Tablets + desktop: no.
 */
export function shouldLockPortraitOrientation(): boolean {
  if (Platform.OS === "web") {
    if (isTabletUa()) return false;
    // DevTools "iPhone" / real phones — lock even if the host still has a mouse.
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

/**
 * Phones in landscape: browsers usually cannot force rotation, so UI should
 * block with a "rotate to portrait" message instead.
 */
export function shouldBlockPhoneLandscape(): boolean {
  if (!shouldLockPortraitOrientation()) return false;
  if (Platform.OS === "web") return readWebLandscape();
  const { width, height } = Dimensions.get("window");
  return width > height;
}

/** React hook — updates on resize / orientation change. */
export function usePhoneLandscapeBlock(): boolean {
  const [blocked, setBlocked] = useState(() => shouldBlockPhoneLandscape());

  useEffect(() => {
    const sync = () => setBlocked(shouldBlockPhoneLandscape());
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

  return blocked;
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

  // Only honored in installed PWA / fullscreen on most browsers; failures are expected in tabs.
  try {
    await orientation.lock("portrait");
  } catch {
    try {
      await orientation.lock("portrait-primary");
    } catch {
      // NotAllowedError outside fullscreen — landscape overlay covers this case.
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
