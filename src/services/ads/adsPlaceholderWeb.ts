/**
 * Visible placeholder ads for UX testing before AdSense approval (web only).
 * Enable via EXPO_PUBLIC_ADS_PLACEHOLDER=1, EXPO_PUBLIC_ADS_TEST=1, or ?ads_placeholder=1
 */

import { Platform } from "react-native";
import { isAdsPlaceholderEnv, isAdsTestModeEnv } from "./adsConfig";

const ROOT_ID = "ps-and-as-ad-placeholder-root";

export type PlaceholderAdKind = "next" | "reward";

export function isAdsPlaceholderMode(): boolean {
  if (Platform.OS !== "web") return false;
  if (isAdsTestModeEnv()) return true;
  if (isAdsPlaceholderEnv()) return true;
  try {
    const loc = (globalThis as { location?: Location }).location;
    if (!loc?.search) return false;
    const params = new URLSearchParams(loc.search);
    return (
      params.get("ads_placeholder") === "1" || params.get("ads_test") === "1"
    );
  } catch {
    return false;
  }
}

function getDocument(): Document | null {
  try {
    return (globalThis as { document?: Document }).document ?? null;
  } catch {
    return null;
  }
}

function removeRoot(doc: Document): void {
  const existing = doc.getElementById(ROOT_ID);
  if (existing) existing.remove();
}

/**
 * Full-screen fake interstitial / rewarded overlay.
 * Rewarded: auto-completes after a short watch timer (counts as viewed).
 */
export function showWebAdPlaceholder(kind: PlaceholderAdKind): Promise<boolean> {
  if (Platform.OS !== "web") return Promise.resolve(false);
  const doc = getDocument();
  if (!doc?.body) return Promise.resolve(false);

  removeRoot(doc);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (viewed: boolean) => {
      if (settled) return;
      settled = true;
      removeRoot(doc);
      resolve(viewed);
    };

    const root = doc.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-ps-ad-placeholder", kind);
    root.style.cssText =
      "position:fixed;inset:0;z-index:100100;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.82);box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif;";

    const card = doc.createElement("div");
    card.style.cssText =
      "width:min(100%,360px);background:#121c18;color:#e8f0ea;border-radius:16px;padding:20px 18px 16px;box-shadow:0 24px 60px rgba(0,0,0,0.45);border:1px solid rgba(232,240,234,0.12);";

    const badge = doc.createElement("div");
    badge.textContent = "AD PREVIEW";
    badge.style.cssText =
      "font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#7ec8a3;margin-bottom:10px;";

    const frame = doc.createElement("div");
    frame.style.cssText =
      "width:100%;min-height:140px;border-radius:12px;background:linear-gradient(145deg,#1a2822,#0d1411);border:1px dashed rgba(126,200,163,0.35);display:flex;align-items:center;justify-content:center;margin-bottom:14px;padding:16px;box-sizing:border-box;";

    const frameLabel = doc.createElement("div");
    frameLabel.style.cssText =
      "text-align:center;color:#9fb0a6;font-size:14px;line-height:1.45;font-weight:600;";
    frameLabel.textContent =
      kind === "reward"
        ? "Sample rewarded video\n(placeholder)"
        : "Sample interstitial\n(placeholder)";

    const hint = doc.createElement("p");
    hint.style.cssText =
      "margin:0 0 14px;font-size:12px;line-height:1.45;color:#9fb0a6;";
    hint.textContent =
      "Not a real ad. Use this to test layout and timing before Google AdSense approval.";

    const row = doc.createElement("div");
    row.style.cssText =
      "display:flex;gap:10px;justify-content:flex-end;align-items:center;";

    const timer = doc.createElement("span");
    timer.style.cssText = "font-size:12px;color:#9fb0a6;margin-right:auto;";

    const btn = doc.createElement("button");
    btn.type = "button";
    btn.style.cssText =
      "border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;background:#5fb88a;color:#0a1210;";

    if (kind === "reward") {
      btn.textContent = "Claim XP";
      btn.disabled = true;
      btn.style.opacity = "0.55";
      btn.style.cursor = "not-allowed";
      let remaining = 3;
      timer.textContent = `Watch ${remaining}s…`;
      const tick = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          timer.textContent = `Watch ${remaining}s…`;
        } else {
          clearInterval(tick);
          timer.textContent = "Ready";
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.style.cursor = "pointer";
        }
      }, 1000);
      btn.onclick = () => {
        clearInterval(tick);
        finish(true);
      };
    } else {
      timer.textContent = "";
      btn.textContent = "Continue";
      btn.onclick = () => finish(true);
    }

    frame.appendChild(frameLabel);
    card.appendChild(badge);
    card.appendChild(frame);
    card.appendChild(hint);
    row.appendChild(timer);
    row.appendChild(btn);
    card.appendChild(row);
    root.appendChild(card);
    doc.body.appendChild(root);
  });
}
