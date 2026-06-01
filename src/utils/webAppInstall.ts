import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";
import { isMobileWeb } from "./webViewport";

export type WebInstallPlatform = "ios" | "android" | "other";

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
  if (canNativeWebInstallPrompt()) return "Install app";
  if (isIosMobileWeb() && canIosWebShare()) return "Open Share";
  return "Add to Home Screen";
}

export function canIosWebShare(): boolean {
  if (Platform.OS !== "web" || !isIosMobileWeb()) return false;
  const nav = readNavigator() as Navigator & { share?: (data: ShareData) => Promise<void> };
  return typeof nav?.share === "function";
}

/** Opens Safari's Share sheet — user picks Add to Home Screen from there. */
export async function triggerIosWebShare(): Promise<"shared" | "aborted" | "unavailable"> {
  if (!canIosWebShare()) return "unavailable";
  const nav = readNavigator() as Navigator & { share: (data: ShareData) => Promise<void> };
  const loc = (globalThis as { location?: { href?: string } }).location;
  try {
    await nav.share({
      title: "P's & A's",
      text: "Presidents & Assholes — full-screen card game",
      url: loc?.href,
    });
    return "shared";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "aborted";
    return "unavailable";
  }
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
  platform: WebInstallPlatform;
  title: string;
  intro: string;
  steps: string[];
  footnote?: string;
};

export function getAddToHomeScreenInstructions(): AddToHomeScreenInstructions {
  const platform = getWebInstallPlatform();

  if (platform === "ios") {
    return {
      platform,
      title: "Add to Home Screen",
      intro:
        "Safari can't hide its address bar in a normal tab. Add P's & A's to your home screen for full-screen play.",
      steps: [
        'Tap Share (square with arrow at the bottom of Safari).',
        'Tap "Add to Home Screen", then tap Add.',
      ],
      footnote: "Open the new home screen icon each time — not a Safari bookmark.",
    };
  }

  if (platform === "android") {
    return {
      platform,
      title: "Install for full screen",
      intro:
        "Install the app to your home screen to hide Chrome's address bar while you play.",
      steps: canNativeWebInstallPrompt()
        ? [
            "Tap Install App below if Chrome offers it.",
            "Or open Chrome's menu (⋮) and choose Install app or Add to Home screen.",
            "Launch from the new home screen icon.",
          ]
        : [
            "Open Chrome's menu (⋮) in the top corner.",
            "Tap Install app or Add to Home screen.",
            "Confirm, then open the new icon on your home screen.",
          ],
    };
  }

  return {
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
