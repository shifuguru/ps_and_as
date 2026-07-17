import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";
import { isMobileWeb } from "./webViewport";

export type WebInstallPlatform = "ios" | "android" | "other";

export type WebInstallOfferKind = "external-browser" | "add-to-home";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installPromptListenerAttached = false;

function readNavigator(): Navigator | undefined {
  return (globalThis as { navigator?: Navigator }).navigator;
}

/** iOS Safari / iPadOS (not standalone). */
export function isIosMobileWeb(): boolean {
  if (Platform.OS !== "web") return false;
  const nav = readNavigator();
  if (!nav) return false;
  const ua = nav.userAgent ?? "";
  return /iPhone|iPad|iPod/i.test(ua);
}

export function isAndroidMobileWeb(): boolean {
  if (Platform.OS !== "web") return false;
  return /Android/i.test(readNavigator()?.userAgent ?? "");
}

export function getWebInstallPlatform(): WebInstallPlatform {
  if (isIosMobileWeb()) return "ios";
  if (isAndroidMobileWeb()) return "android";
  return "other";
}

/**
 * Instagram / Facebook / similar in-app browsers — limited WebViews that
 * break install prompts, cookies, and often full-screen play.
 */
export function isSocialInAppBrowser(): boolean {
  if (Platform.OS !== "web") return false;
  const ua = readNavigator()?.userAgent ?? "";
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\//i.test(ua);
}

/** Mobile browser tab — not already launched from the home screen. */
export function shouldOfferAddToHomeScreen(): boolean {
  return Platform.OS === "web" && isMobileWeb() && !isStandaloneWebApp();
}

export function canNativeWebInstallPrompt(): boolean {
  return !!deferredInstallPrompt;
}

/** Attach once — captures Android Chrome install prompt when available. */
export function ensureWebInstallPromptListener(): void {
  if (Platform.OS !== "web" || installPromptListenerAttached) return;
  const win = (globalThis as { window?: Window }).window;
  if (!win) return;

  installPromptListenerAttached = true;
  win.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
  });
  win.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
  });
}

export function getInstallButtonLabel(): string {
  if (isSocialInAppBrowser()) return "How to open";
  if (canNativeWebInstallPrompt()) return "Install app";
  return "Add to Home Screen";
}

export async function triggerNativeWebInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredInstallPrompt;
  if (!prompt) return "unavailable";
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredInstallPrompt = null;
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

export type AddToHomeScreenInstructions = {
  kind: WebInstallOfferKind;
  platform: WebInstallPlatform;
  title: string;
  intro: string;
  steps: string[];
  footnote?: string;
};

export function getAddToHomeScreenInstructions(): AddToHomeScreenInstructions {
  const platform = getWebInstallPlatform();

  if (isSocialInAppBrowser()) {
    return {
      kind: "external-browser",
      platform,
      title: "Open in your browser",
      intro:
        "You're in Instagram's (or another app's) built-in browser. For the best experience, open P's & A's in Safari or Chrome on your phone first.",
      steps: [
        "Tap the ⋯ (three dots) in the top-right corner of this screen.",
        'Choose "Open in browser", "Open in Safari", or "Open in Chrome".',
        "Play from that browser — you can Add to Home Screen from there for full-screen play.",
      ],
      footnote:
        "In-app browsers are limited. Opening in your normal mobile browser fixes refresh loops and unlocks install / full-screen options.",
    };
  }

  if (platform === "ios") {
    return {
      kind: "add-to-home",
      platform,
      title: "Add to Home Screen",
      intro:
        "For full-screen play without the browser bar, add P's & A's to your home screen from Safari or Chrome.",
      steps: [
        "In your browser, tap Share — the square icon with an arrow pointing up (often in the bottom toolbar).",
        'Scroll the menu if needed, tap "Add to Home Screen", then tap Add.',
      ],
      footnote:
        "Use the browser's own Share / menu button — not an in-page share sheet. Open the new home screen icon each time.",
    };
  }

  if (platform === "android") {
    return {
      kind: "add-to-home",
      platform,
      title: "Install for full screen",
      intro:
        "Install the app to your home screen to hide the browser address bar while you play.",
      steps: canNativeWebInstallPrompt()
        ? [
            "Tap Install App below if Chrome offers it.",
            "Or open the browser menu (⋮) and choose Install app or Add to Home screen.",
            "Launch from the new home screen icon.",
          ]
        : [
            "Open the browser menu (⋮) in the top corner.",
            "Tap Install app or Add to Home screen.",
            "Confirm, then open the new icon on your home screen.",
          ],
    };
  }

  return {
    kind: "add-to-home",
    platform,
    title: "Add to Home Screen",
    intro:
      "Add this page to your home screen for a full-screen app without the browser toolbar.",
    steps: [
      "Open your browser menu.",
      "Choose Add to Home Screen or Install.",
      "Open the shortcut from your home screen.",
    ],
  };
}
