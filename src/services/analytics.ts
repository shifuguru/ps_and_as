import { Platform } from "react-native";
import { getServerUrl } from "../config/server";

/** Allowlisted client beacons — must match server/analyticsStore.js CLIENT_EVENTS. */
export type ClientAnalyticsEvent =
  | "hub_viewed"
  | "cta_quick_game"
  | "cta_local_game"
  | "cta_online_game"
  | "cta_online_join"
  | "quick_game_started"
  | "name_setup_completed"
  | "install_coach_continued";

type AnalyticsProps = Record<string, string | number | boolean>;

const SESSION_HUB_KEY = "ps_analytics_hub_viewed";

function analyticsUrl(): string {
  return `${getServerUrl().replace(/\/$/, "")}/api/analytics/event`;
}

/**
 * Fire-and-forget product beacon. Failures are ignored (analytics must never
 * block play). Web only for now — native can reuse the same endpoint later.
 */
export function trackAnalyticsEvent(
  name: ClientAnalyticsEvent,
  props?: AnalyticsProps,
): void {
  if (Platform.OS !== "web") return;
  try {
    const body = JSON.stringify({ name, props: props || {} });
    const url = analyticsUrl();
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

/** Once per browser tab session when the Player Hub becomes visible. */
export function trackHubViewedOnce(): void {
  if (Platform.OS !== "web") return;
  try {
    const store = globalThis.sessionStorage;
    if (store?.getItem(SESSION_HUB_KEY)) return;
    store?.setItem(SESSION_HUB_KEY, "1");
  } catch {
    // sessionStorage may be blocked; still send one best-effort event
  }
  trackAnalyticsEvent("hub_viewed");
}
