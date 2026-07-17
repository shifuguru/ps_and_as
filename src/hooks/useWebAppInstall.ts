import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  canNativeWebInstallPrompt,
  ensureWebInstallPromptListener,
  getAddToHomeScreenInstructions,
  getInstallButtonLabel,
  isSocialInAppBrowser,
  shouldOfferAddToHomeScreen,
  triggerNativeWebInstall,
  type AddToHomeScreenInstructions,
} from "../utils/webAppInstall";

export function useWebAppInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState(() => isSocialInAppBrowser());
  const [instructions, setInstructions] = useState<AddToHomeScreenInstructions>(() =>
    getAddToHomeScreenInstructions(),
  );

  const refreshInstallAvailability = useCallback(() => {
    const available = canNativeWebInstallPrompt();
    setCanInstall(available);
    setInAppBrowser(isSocialInAppBrowser());
    setInstructions(getAddToHomeScreenInstructions());
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !shouldOfferAddToHomeScreen()) return;
    ensureWebInstallPromptListener();
    refreshInstallAvailability();

    const win = (globalThis as { window?: Window }).window;
    if (!win) return;

    const onPrompt = () => refreshInstallAvailability();
    win.addEventListener("beforeinstallprompt", onPrompt);
    win.addEventListener("appinstalled", onPrompt);
    return () => {
      win.removeEventListener("beforeinstallprompt", onPrompt);
      win.removeEventListener("appinstalled", onPrompt);
    };
  }, [refreshInstallAvailability]);

  const installNative = useCallback(async () => {
    const outcome = await triggerNativeWebInstall();
    refreshInstallAvailability();
    return outcome;
  }, [refreshInstallAvailability]);

  /** Android Chrome: native install prompt when available. Otherwise show manual steps. */
  const requestInstall = useCallback(async (): Promise<"accepted" | "manual"> => {
    if (!isSocialInAppBrowser() && canNativeWebInstallPrompt()) {
      const outcome = await installNative();
      if (outcome === "accepted") return "accepted";
    }
    return "manual";
  }, [installNative]);

  return {
    showOffer: shouldOfferAddToHomeScreen(),
    inAppBrowser,
    canInstall: !inAppBrowser && canInstall,
    installButtonLabel: getInstallButtonLabel(),
    instructions,
    installNative,
    requestInstall,
  };
}
