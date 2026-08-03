/**
 * Google Sign-in / account sync (web).
 *
 * Uses Google Identity Services (GIS) for an ID token, links `google:{sub}`
 * as the durable profile id (same slot as Game Center `linkedAccountId`),
 * then re-runs cloud stats restore under that id.
 *
 * Enable with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (OAuth Web client).
 * Server optionally verifies Bearer ID tokens when `GOOGLE_CLIENT_ID` is set.
 */
import { Platform } from "react-native";

export type GoogleAccountSyncStatus = "coming_soon" | "ready" | "unavailable";

export type GoogleAccountLink = {
  accountId: string;
  email?: string;
  displayName?: string;
  idToken: string;
};

type GisCredentialResponse = {
  credential: string;
  select_by?: string;
};

type GisPromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};

type GoogleAccountsId = {
  initialize: (config: Record<string, unknown>) => void;
  prompt: (cb?: (notification: GisPromptNotification) => void) => void;
  renderButton: (parent: HTMLElement, config: Record<string, unknown>) => void;
  cancel: () => void;
};

type GoogleGisWindow = Window & {
  google?: { accounts?: { id?: GoogleAccountsId } };
};

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;
let sessionIdToken: string | null = null;
let sessionAccountId: string | null = null;

export function getGoogleWebClientId(): string | null {
  try {
    const id = String(
      (typeof process !== "undefined" &&
        process.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
        "",
    ).trim();
    return id || null;
  } catch {
    return null;
  }
}

export function toGoogleAccountId(sub: string): string {
  return `google:${sub.trim()}`;
}

export function parseGoogleSub(accountId: string): string | null {
  if (!accountId.startsWith("google:")) return null;
  const sub = accountId.slice("google:".length).trim();
  return sub || null;
}

export function getGoogleAccountSyncStatus(): GoogleAccountSyncStatus {
  if (Platform.OS !== "web") return "unavailable";
  return getGoogleWebClientId() ? "ready" : "coming_soon";
}

export function isGoogleAccountSyncOffered(): boolean {
  return getGoogleAccountSyncStatus() !== "unavailable";
}

export function getGoogleSignInButtonLabel(
  status: GoogleAccountSyncStatus = getGoogleAccountSyncStatus(),
): string {
  if (status === "ready") return "Continue with Google";
  if (status === "coming_soon") return "Google sync coming soon";
  return "Google sync unavailable";
}

export function googleAccountSyncBlurb(
  status: GoogleAccountSyncStatus = getGoogleAccountSyncStatus(),
): string {
  if (status === "ready") {
    return "Keep your name and stats across devices.";
  }
  return "Google sync coming soon.";
}

export function getGoogleSessionIdToken(): string | null {
  return sessionIdToken;
}

export function getGoogleSessionAccountId(): string | null {
  return sessionAccountId;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("Invalid Google credential");
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const json =
    typeof atob === "function"
      ? atob(normalized + pad)
      : Buffer.from(normalized + pad, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function loadGisScript(): Promise<void> {
  if (Platform.OS !== "web") {
    return Promise.reject(new Error("Google Sign-in is only available on web"));
  }
  const win = globalThis as unknown as GoogleGisWindow;
  if (win.google?.accounts?.id) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) {
      reject(new Error("Document unavailable"));
      return;
    }
    const existing = doc.querySelector(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-in")),
      );
      if (win.google?.accounts?.id) resolve();
      return;
    }
    const script = doc.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-in"));
    doc.head.appendChild(script);
  }).catch((err) => {
    gisLoadPromise = null;
    throw err;
  });

  return gisLoadPromise;
}

function linkFromCredential(credential: string): GoogleAccountLink {
  const payload = decodeJwtPayload(credential);
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!sub) throw new Error("Google account id missing");
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const name =
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.given_name === "string" && payload.given_name) ||
    undefined;
  const accountId = toGoogleAccountId(sub);
  sessionIdToken = credential;
  sessionAccountId = accountId;
  return {
    accountId,
    email,
    displayName: name ? String(name).slice(0, 20) : undefined,
    idToken: credential,
  };
}

/**
 * Prompt Google Sign-in (One Tap when available, otherwise a Google button overlay).
 */
export async function requestGoogleAccountLink(): Promise<GoogleAccountLink | null> {
  if (getGoogleAccountSyncStatus() !== "ready") {
    return null;
  }
  const clientId = getGoogleWebClientId();
  if (!clientId) return null;

  await loadGisScript();
  const win = globalThis as unknown as GoogleGisWindow;
  const gis = win.google?.accounts?.id;
  if (!gis) throw new Error("Google Sign-in failed to initialize");

  return new Promise<GoogleAccountLink | null>((resolve, reject) => {
    let settled = false;
    let overlay: HTMLDivElement | null = null;

    const cleanup = () => {
      try {
        gis.cancel();
      } catch {
        // ignore
      }
      if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    };

    const finish = (link: GoogleAccountLink | null, err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve(link);
    };

    const onCredential = (response: GisCredentialResponse) => {
      try {
        finish(linkFromCredential(response.credential));
      } catch (err) {
        finish(
          null,
          err instanceof Error ? err : new Error("Google Sign-in failed"),
        );
      }
    };

    const showButtonOverlay = () => {
      const doc = (globalThis as { document?: Document }).document;
      if (!doc || settled) return;

      overlay = doc.createElement("div");
      overlay.setAttribute("data-ps-google-sign-in", "1");
      overlay.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:100000",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:rgba(0,0,0,0.55)",
        "padding:24px",
      ].join(";");

      const card = doc.createElement("div");
      card.style.cssText = [
        "background:#fff",
        "color:#111",
        "border-radius:16px",
        "padding:20px",
        "max-width:340px",
        "width:100%",
        "text-align:center",
        "font-family:system-ui,sans-serif",
      ].join(";");

      const title = doc.createElement("div");
      title.textContent = "Continue with Google";
      title.style.cssText =
        "font-weight:800;font-size:18px;margin-bottom:8px;";

      const hint = doc.createElement("div");
      hint.textContent = "Sync your name and game stats across devices.";
      hint.style.cssText =
        "font-size:13px;line-height:18px;opacity:0.75;margin-bottom:16px;";

      const buttonHost = doc.createElement("div");
      buttonHost.style.cssText =
        "display:flex;justify-content:center;min-height:44px;";

      const cancel = doc.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.style.cssText = [
        "margin-top:14px",
        "width:100%",
        "border:0",
        "background:transparent",
        "color:#444",
        "font-size:14px",
        "font-weight:600",
        "padding:10px",
        "cursor:pointer",
      ].join(";");
      cancel.onclick = () => finish(null);

      card.appendChild(title);
      card.appendChild(hint);
      card.appendChild(buttonHost);
      card.appendChild(cancel);
      overlay.appendChild(card);
      doc.body.appendChild(overlay);

      gis.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 280,
      });
    };

    gis.initialize({
      client_id: clientId,
      callback: onCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      ux_mode: "popup",
      use_fedcm_for_prompt: true,
    });

    gis.prompt((notification) => {
      if (settled) return;
      const needFallback =
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment();
      if (needFallback) showButtonOverlay();
    });
  });
}

/**
 * Persist Google link, optional display name, and re-key cloud stats restore.
 */
export async function linkGoogleAccountAndSync(options?: {
  preferredDisplayName?: string | null;
}): Promise<{ accountId: string; displayName: string | null }> {
  const link = await requestGoogleAccountLink();
  if (!link) {
    throw new Error("Google Sign-in cancelled");
  }

  const {
    cacheLinkedGameCenterId,
    cachePlayerId,
  } = await import("./gameCenter");
  await cacheLinkedGameCenterId(link.accountId);
  await cachePlayerId(link.accountId);

  let displayName: string | null = null;
  const preferred =
    options?.preferredDisplayName?.trim() ||
    link.displayName?.trim() ||
    "";
  if (preferred) {
    try {
      const { saveChosenDisplayName } = await import("./playerDisplayName");
      displayName = await saveChosenDisplayName(preferred.slice(0, 20));
    } catch {
      displayName = null;
    }
  }

  const {
    resetPlayerStatsRestore,
    ensurePlayerStatsRestored,
    getPlayerStats,
  } = await import("./playerStats");
  resetPlayerStatsRestore();
  await ensurePlayerStatsRestored();

  try {
    const stats = await getPlayerStats();
    const { pushCloudPlayerStats } = await import("./playerStatsCloud");
    await pushCloudPlayerStats(link.accountId, stats, link.idToken);
  } catch {
    // Local link succeeded; cloud push can retry on later saves.
  }

  return { accountId: link.accountId, displayName };
}
