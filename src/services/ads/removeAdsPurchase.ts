/**
 * Stripe Checkout client for one-time Remove Ads ($19 NZD).
 * Requires Google-linked account; server verifies webhook before granting.
 */

import { getServerUrl } from "../../config/server";
import { getGoogleSessionIdToken } from "../googleAccountSync";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function billingUrl(path: string): string {
  const base = getServerUrl().replace(/\/$/, "");
  return `${base}${path}`;
}

export async function createRemoveAdsCheckoutSession(): Promise<CheckoutResult> {
  const bearer = getGoogleSessionIdToken();
  if (!bearer) {
    return { ok: false, error: "google_required" };
  }
  try {
    const res = await fetch(billingUrl("/api/billing/create-checkout-session"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        product: "remove_ads",
        successPath: "/?purchase=remove_ads_success",
        cancelPath: "/?purchase=remove_ads_cancel",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!res.ok || !data.url) {
      return { ok: false, error: data.error || `http_${res.status}` };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function refreshAdsEntitlementFromCloud(): Promise<boolean> {
  try {
    const { getOrCreatePlayerId } = await import("../gameCenter");
    const info = await getOrCreatePlayerId();
    const playerId = info.linkedAccountId || info.id;
    if (!playerId?.startsWith("google:")) return false;
    const { fetchCloudPlayerRecord } = await import("../playerStatsCloud");
    const record = await fetchCloudPlayerRecord(playerId);
    const removed = record?.profile?.adsRemoved === true;
    if (removed) {
      const { setAdsRemovedLocal, resetForcedAdCounter } = await import(
        "./adsEntitlement"
      );
      await setAdsRemovedLocal(true);
      await resetForcedAdCounter();
    }
    return removed;
  } catch {
    return false;
  }
}

/** After Stripe redirect, consume ?purchase= query once. */
export function consumePurchaseQueryParam(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const loc = (globalThis as { location?: Location }).location;
    if (!loc?.search) return null;
    const params = new URLSearchParams(loc.search);
    const purchase = params.get("purchase");
    if (!purchase) return null;
    params.delete("purchase");
    const next = `${loc.pathname}${params.toString() ? `?${params}` : ""}${loc.hash || ""}`;
    loc.replace(next);
    return purchase;
  } catch {
    return null;
  }
}
