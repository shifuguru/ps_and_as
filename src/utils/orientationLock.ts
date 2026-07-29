import { Dimensions, Platform } from "react-native";
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
 * Desktop browsers (mouse/trackpad) — always exempt, even if the window is narrow.
 */
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
    if (isDesktopWebPointer()) return false;
    if (isTabletUa()) return false;
    const win = getWebWindow();
    if (!win) return false;
    const shortest = Math.min(win.innerWidth ?? 0, win.innerHeight ?? 0);
    // Match layout tablet breakpoint so large phones stay locked, tablets free.
    return shortest > 0 && shortest < breakpoints.tablet;
  }

  if (Platform.OS === "ios" && Platform.isPad) return false;

  // Android / other native: treat large shortest-side as tablet.
  return readShortestSide() < TABLET_SHORTEST_SIDE_PX;
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
  const orientation = getWebScreenOrientation();
  if (!orientation) return;

  try {
    if (shouldLockPortraitOrientation()) {
      // Browsers often only honor this in installed / fullscreen contexts.
      await orientation.lock?.("portrait");
    } else {
      await orientation.unlock?.();
    }
  } catch {
    // NotAllowedError outside fullscreen — expected on many mobile browsers.
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
