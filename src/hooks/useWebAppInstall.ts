import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  canNativeWebInstallPrompt,
  canIosWebShare,
  ensureWebInstallPromptListener,
  getAddToHomeScreenInstructions,
  getInstallButtonLabel,
  isIosMobileWeb,
  shouldOfferAddToHomeScreen,
  triggerIosWebShare,
  triggerNativeWebInstall,
  type AddToHomeScreenInstructions,
} from "../utils/webAppInstall";

export function useWebAppInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [instructions, setInstructions] = useState<AddToHomeScreenInstructions>(() =>
    getAddToHomeScreenInstructions(),
  );

  const refreshInstallAvailability = useCallback(() => {
    const available = canNativeWebInstallPrompt();
    setCanInstall(available);
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

  /** Android: native prompt. iOS: Share sheet when available. Otherwise: show modal. */
  const requestInstall = useCallback(async (): Promise<"accepted" | "manual"> => {
    if (canNativeWebInstallPrompt()) {
      const outcome = await installNative();
      if (outcome === "accepted") return "accepted";
    }
    if (isIosMobileWeb()) {
      const share = await triggerIosWebShare();
      if (share === "shared") return "accepted";
      return "manual";
    }
    return "manual";
  }, [installNative]);

  return {
    showOffer: shouldOfferAddToHomeScreen(),
    canInstall,
    canOpenShare: canIosWebShare(),
    installButtonLabel: getInstallButtonLabel(),
    instructions,
    installNative,
    openShare: triggerIosWebShare,
    requestInstall,
  };
}
