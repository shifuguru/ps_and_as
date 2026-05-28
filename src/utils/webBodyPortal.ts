import { Platform } from "react-native";
import { WEB_BODY_PORTAL_ID } from "./webViewport";

/** Viewport-fixed host appended to document.body (escapes #root clipping on iOS PWA). */
export function getWebBodyPortalHost(): any {
  if (Platform.OS !== "web") return null;

  const doc = (globalThis as { document?: any }).document;
  if (!doc?.body) return null;

  let host = doc.getElementById(WEB_BODY_PORTAL_ID);
  if (host && doc.body.contains(host)) return host;

  host = doc.createElement("div");
  host.id = WEB_BODY_PORTAL_ID;
  doc.body.appendChild(host);
  return host;
}
