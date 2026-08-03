/**
 * Mobile browser first-run funnel:
 * 1. Offer PWA / Add to Home Screen before display-name setup
 * 2. If the player continues in the browser, couple name setup with
 *    upcoming Google Sign-in sync (Play Store / game stats)
 *
 * Standalone PWA and desktop skip the install coach.
 */
import { Platform } from "react-native";
import { shouldOfferAddToHomeScreen } from "../utils/webAppInstall";
import { dismissAddToHomeBanner } from "./addToHomeScreenPrefs";

export const WEB_INSTALL_DECLINED_KEY = "@ps_and_as_web_install_declined";

async function storage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("@react-native-async-storage/async-storage").default;
}

export async function isWebInstallDeclined(): Promise<boolean> {
  try {
    const AsyncStorage = await storage();
    const value = await AsyncStorage.getItem(WEB_INSTALL_DECLINED_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

/**
 * Player chose to keep playing in the browser tab.
 * Also dismisses the soft hub banner so we do not nag twice.
 */
export async function markWebInstallDeclined(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.setItem(WEB_INSTALL_DECLINED_KEY, "1");
  } catch {
    // ignore
  }
  await dismissAddToHomeBanner();
}

export async function clearWebInstallDeclined(): Promise<void> {
  try {
    const AsyncStorage = await storage();
    await AsyncStorage.removeItem(WEB_INSTALL_DECLINED_KEY);
  } catch {
    // ignore
  }
}

export type WebOnboardingPhase = "install-coach" | "ready";

export type WebOnboardingSnapshot = {
  phase: WebOnboardingPhase;
  /** Mobile browser and not standalone. */
  mobileBrowserTab: boolean;
  installDeclined: boolean;
  /**
   * Name setup should advertise Google Sign-in sync
   * (browser continue path / upcoming Play Store account link).
   */
  coupleNameWithGoogleSync: boolean;
};

/**
 * Pure gate used by tests — whether first-run install coach should block.
 */
export function needsWebInstallCoach(input: {
  mobileBrowserTab: boolean;
  installDeclined: boolean;
  needsDisplayNameSetup: boolean;
}): boolean {
  return (
    input.mobileBrowserTab &&
    !input.installDeclined &&
    input.needsDisplayNameSetup
  );
}

/**
 * Resolve first-run web onboarding relative to display-name setup.
 */
export async function resolveWebOnboardingState(input: {
  needsDisplayNameSetup: boolean;
}): Promise<WebOnboardingSnapshot> {
  const mobileBrowserTab =
    Platform.OS === "web" && shouldOfferAddToHomeScreen();

  if (!mobileBrowserTab) {
    return {
      phase: "ready",
      mobileBrowserTab: false,
      installDeclined: false,
      coupleNameWithGoogleSync: false,
    };
  }

  const installDeclined = await isWebInstallDeclined();
  const showCoach = needsWebInstallCoach({
    mobileBrowserTab: true,
    installDeclined,
    needsDisplayNameSetup: input.needsDisplayNameSetup,
  });

  return {
    phase: showCoach ? "install-coach" : "ready",
    mobileBrowserTab: true,
    installDeclined,
    coupleNameWithGoogleSync:
      installDeclined && input.needsDisplayNameSetup,
  };
}
