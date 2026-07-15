import { Platform } from "react-native";
import {
  applyMobileWebShellHeight,
  WEB_OVERLAY_PORTAL_ID,
} from "./webViewport";

/** Full-screen modal host on document.body — above #ps-body-portal (bottom bar / hand). */
export function getWebOverlayPortalHost(): any {
  if (Platform.OS !== "web") return null;

  const doc = (globalThis as { document?: any }).document;
  if (!doc?.body) return null;

  let host = doc.getElementById(WEB_OVERLAY_PORTAL_ID);
  if (host && doc.body.contains(host)) return host;

  host = doc.createElement("div");
  host.id = WEB_OVERLAY_PORTAL_ID;
  doc.body.appendChild(host);

  const win = (globalThis as {
    window?: Parameters<typeof applyMobileWebShellHeight>[0];
  }).window;
  if (win) {
    applyMobileWebShellHeight(win, "getWebOverlayPortalHost");
  }

  return host;
}
