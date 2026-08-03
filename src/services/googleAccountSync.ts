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

export function getGoogleWebClientId(): string | null {
  try {
    if (Platform.OS === "web") {
      const runtime = (
        globalThis as { __PS_AND_AS_GOOGLE_WEB_CLIENT_ID__?: string }
      ).__PS_AND_AS_GOOGLE_WEB_CLIENT_ID__;
      const fromRuntime = typeof runtime === "string" ? runtime.trim() : "";
      if (fromRuntime) return fromRuntime;
    }
    // Exact `process.env.EXPO_PUBLIC_*` access so Expo/Metro inlines at build time.
    // Optional chaining (`process.env?.…`) is NOT replaced and stays empty on web.
    const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const id = typeof fromEnv === "string" ? fromEnv.trim() : "";
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
    return "Keep your name, stats, and theme across devices.";
  }
  return "Google sync coming soon.";
}

const TOKEN_STORAGE_KEY = "ps_and_as_google_id_token";
const SESSION_STORAGE_KEY = "ps_and_as_google_session_token";
const ACCOUNT_STORAGE_KEY = "ps_and_as_google_account_id";

let sessionIdToken: string | null = null;
let sessionAuthToken: string | null = null;
let sessionAccountId: string | null = null;

function webLocalStorage(): Storage | null {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

function persistGoogleSession(accountId: string, opts: {
  idToken?: string | null;
  sessionToken?: string | null;
}): void {
  sessionAccountId = accountId;
  if (opts.idToken) sessionIdToken = opts.idToken;
  if (opts.sessionToken) sessionAuthToken = opts.sessionToken;
  const store = webLocalStorage();
  if (!store) return;
  try {
    store.setItem(ACCOUNT_STORAGE_KEY, accountId);
    if (opts.idToken) store.setItem(TOKEN_STORAGE_KEY, opts.idToken);
    if (opts.sessionToken) store.setItem(SESSION_STORAGE_KEY, opts.sessionToken);
  } catch {
    // ignore quota / private mode
  }
}

function hydrateGoogleSessionFromStorage(): void {
  const store = webLocalStorage();
  if (!store) return;
  try {
    if (!sessionAccountId) {
      sessionAccountId = store.getItem(ACCOUNT_STORAGE_KEY);
    }
    if (!sessionAuthToken) {
      sessionAuthToken = store.getItem(SESSION_STORAGE_KEY);
    }
    if (!sessionIdToken) {
      sessionIdToken = store.getItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Bearer used for google: cloud writes — prefers long-lived server session. */
export function getGoogleSessionIdToken(): string | null {
  hydrateGoogleSessionFromStorage();
  return sessionAuthToken || sessionIdToken;
}

export function getGoogleSessionAccountId(): string | null {
  hydrateGoogleSessionFromStorage();
  return sessionAccountId;
}

function authUrl(): string {
  const { getServerUrl } = require("../config/server") as typeof import("../config/server");
  return `${getServerUrl().replace(/\/$/, "")}/api/auth/google`;
}

/** Exchange a Google ID token for a durable server session token. */
export async function exchangeGoogleIdTokenForSession(
  idToken: string,
): Promise<{ accountId: string; sessionToken: string } | null> {
  try {
    const res = await fetch(authUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      accountId?: string;
      sessionToken?: string;
    };
    if (!data.accountId?.startsWith("google:") || !data.sessionToken) {
      return null;
    }
    persistGoogleSession(data.accountId, {
      idToken,
      sessionToken: data.sessionToken,
    });
    return { accountId: data.accountId, sessionToken: data.sessionToken };
  } catch {
    return null;
  }
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
  persistGoogleSession(accountId, { idToken: credential });
  return {
    accountId,
    email,
    displayName: name ? String(name).slice(0, 20) : undefined,
    idToken: credential,
  };
}

function isStandaloneLike(): boolean {
  try {
    const { isStandaloneWebApp } = require("../utils/safariChrome") as typeof import("../utils/safariChrome");
    return isStandaloneWebApp();
  } catch {
    return false;
  }
}

/**
 * Prompt Google Sign-in.
 * Standalone PWAs skip One Tap/FedCM (often forces a full page reload) and
 * use an in-page Google button overlay instead.
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
      hint.textContent = "Sync your name, stats, and theme across devices.";
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
      cancel.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      };

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
      // FedCM/One Tap often navigates the PWA document; prefer in-page button.
      use_fedcm_for_prompt: false,
    });

    if (isStandaloneLike()) {
      showButtonOverlay();
      return;
    }

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

export type GoogleLinkSyncResult = {
  accountId: string;
  displayName: string | null;
  appearance?: AppearancePreferenceLike;
  textContrast?: TextContrastPreferenceLike;
  feltTint?: string;
};

type AppearancePreferenceLike = "system" | "light" | "dark";
type TextContrastPreferenceLike = "auto" | "light" | "dark";

/**
 * Persist Google link, pull cloud profile+stats, apply locally, push merged snapshot.
 */
export async function linkGoogleAccountAndSync(options?: {
  preferredDisplayName?: string | null;
}): Promise<GoogleLinkSyncResult> {
  const link = await requestGoogleAccountLink();
  if (!link) {
    throw new Error("Google Sign-in cancelled");
  }

  const { cacheLinkedGameCenterId, cachePlayerId, getCachedPlayerName } =
    await import("./gameCenter");
  await cacheLinkedGameCenterId(link.accountId);
  await cachePlayerId(link.accountId);
  persistGoogleSession(link.accountId, { idToken: link.idToken });

  // Durable server session so later PUTs work after PWA restart (ID tokens expire ~1h).
  const exchanged = await exchangeGoogleIdTokenForSession(link.idToken);
  const authBearer = exchanged?.sessionToken || link.idToken;

  const {
    fetchCloudPlayerRecord,
    applyCloudProfileLocally,
    readLocalCloudProfile,
    pushCloudPlayerRecord,
  } = await import("./playerStatsCloud");

  const remote = await fetchCloudPlayerRecord(link.accountId);

  // Prefer cloud display name (device 1) over this device's local / Google JWT name.
  const localName =
    options?.preferredDisplayName?.trim() ||
    (await getCachedPlayerName())?.trim() ||
    "";
  const chosenName =
    remote?.profile?.displayName?.trim() ||
    localName ||
    link.displayName?.trim() ||
    "";

  // Theme: prefer cloud when present so device 2 inherits device 1 choices.
  const profileToApply = {
    ...(remote?.profile || {}),
    ...(chosenName ? { displayName: chosenName.slice(0, 20) } : {}),
  };
  const applied = await applyCloudProfileLocally(profileToApply);

  let displayName = applied?.displayName ?? null;
  if (!displayName && chosenName) {
    try {
      const { saveChosenDisplayName } = await import("./playerDisplayName");
      displayName = await saveChosenDisplayName(chosenName.slice(0, 20));
    } catch {
      displayName = null;
    }
  }

  const {
    resetPlayerStatsRestore,
    ensurePlayerStatsRestored,
    getPlayerStats,
  } = await import("./playerStats");

  // Merge remote stats under the google: id (restore uses linkedAccountId).
  resetPlayerStatsRestore();
  await ensurePlayerStatsRestored();
  const mergedStats = await getPlayerStats();

  const profile = await readLocalCloudProfile();
  if (displayName) profile.displayName = displayName;

  const push = await pushCloudPlayerRecord(
    link.accountId,
    { stats: mergedStats, profile },
    authBearer,
  );
  if (!push.ok) {
    throw new Error(
      push.error === "google_auth_required" ||
        push.error === "google_auth_invalid" ||
        push.status === 401
        ? "Google sync could not save to the server. Try Sync now again."
        : `Google sync save failed (${push.error || push.status}).`,
    );
  }

  return {
    accountId: link.accountId,
    displayName,
    appearance: applied?.appearance,
    textContrast: applied?.textContrast,
    feltTint: applied?.feltTint,
  };
}

/** Push current local stats + profile for a linked Google account. */
export async function pushLinkedCloudSnapshot(options?: {
  /** Re-prompt Google if we have no usable session/token. */
  interactive?: boolean;
}): Promise<boolean> {
  try {
    const { getOrCreatePlayerId } = await import("./gameCenter");
    const info = await getOrCreatePlayerId();
    const playerId = info.linkedAccountId || info.id;
    if (!playerId?.startsWith("google:")) return true;

    hydrateGoogleSessionFromStorage();
    let bearer = getGoogleSessionIdToken();

    if (!bearer && options?.interactive !== false) {
      const link = await requestGoogleAccountLink();
      if (!link) return false;
      if (link.accountId !== playerId) {
        // Different Google account — still allow, but keep linked id as source of truth
        console.warn(
          "[googleAccountSync] signed-in account differs from linked profile id",
        );
      }
      const exchanged = await exchangeGoogleIdTokenForSession(link.idToken);
      bearer = exchanged?.sessionToken || link.idToken;
    }

    if (!bearer) return false;

    const { getPlayerStats } = await import("./playerStats");
    const {
      pushCloudPlayerRecord,
      readLocalCloudProfile,
    } = await import("./playerStatsCloud");
    const stats = await getPlayerStats();
    const profile = await readLocalCloudProfile();
    let result = await pushCloudPlayerRecord(playerId, { stats, profile }, bearer);

    // Expired Google ID token / bad session — one interactive refresh.
    if (
      !result.ok &&
      options?.interactive !== false &&
      (result.status === 401 ||
        result.status === 403 ||
        result.error === "google_auth_required" ||
        result.error === "google_auth_invalid" ||
        result.error === "google_auth_mismatch")
    ) {
      const link = await requestGoogleAccountLink();
      if (!link) return false;
      const exchanged = await exchangeGoogleIdTokenForSession(link.idToken);
      bearer = exchanged?.sessionToken || link.idToken;
      result = await pushCloudPlayerRecord(playerId, { stats, profile }, bearer);
    }

    return result.ok;
  } catch {
    return false;
  }
}

