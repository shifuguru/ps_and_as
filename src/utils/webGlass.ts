import { Platform } from "react-native";
import { isStandaloneWebApp } from "./safariChrome";
import { isMobileWeb } from "./webViewport";

/**
 * iOS Home Screen PWA composites `backdrop-filter` into the status-bar frost
 * band, blurring top chrome (hub title, game HUD). Use solid glass there instead.
 */
export function shouldUseSolidWebGlass(): boolean {
  return Platform.OS === "web" && isMobileWeb() && isStandaloneWebApp();
}
