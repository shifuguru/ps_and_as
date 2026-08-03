import { getServerUrl } from "../config/server";
import type { PlayerStats } from "./playerStats";
import { DEFAULT_PLAYER_STATS } from "./playerStats";
import type {
  AppearancePreference,
  TextContrastPreference,
} from "./themePreferences";

export type CloudPlayerProfile = {
  displayName?: string;
  appearance?: AppearancePreference;
  textContrast?: TextContrastPreference;
  feltTint?: string;
};

export type CloudPlayerRecord = {
  stats: PlayerStats | null;
  profile: CloudPlayerProfile | null;
  updatedAt?: string | null;
};

export type CloudPushResult = {
  ok: boolean;
  status: number;
  error?: string;
};

/**
 * Merge local + cloud career counters.
 * Every field (including XP) is Math.max — never sum — so syncing two devices
 * cannot be exploited as an XP duplicate glitch.
 */
export function mergePlayerStats(
  local: PlayerStats,
  remote: Partial<PlayerStats> | null | undefined,
): PlayerStats {
  if (!remote) return local;
  const r = normalizeRemoteStats(remote);
  if (r.roundsPlayed === 0 && local.roundsPlayed > 0) return local;
  if (local.roundsPlayed === 0 && r.roundsPlayed > 0) return r;
  return {
    roundsPlayed: Math.max(local.roundsPlayed, r.roundsPlayed),
    timesPresident: Math.max(local.timesPresident, r.timesPresident),
    timesVicePresident: Math.max(local.timesVicePresident, r.timesVicePresident),
    timesViceAsshole: Math.max(local.timesViceAsshole, r.timesViceAsshole),
    timesAsshole: Math.max(local.timesAsshole, r.timesAsshole),
    presidentStreak: Math.max(local.presidentStreak, r.presidentStreak),
    bestPresidentStreak: Math.max(local.bestPresidentStreak, r.bestPresidentStreak),
    xp: Math.max(local.xp, r.xp),
    tricksWon: Math.max(local.tricksWon, r.tricksWon),
  };
}

function normalizeRemoteStats(raw: Partial<PlayerStats>): PlayerStats {
  return {
    roundsPlayed: Math.max(0, Math.floor(raw.roundsPlayed ?? 0)),
    timesPresident: Math.max(0, Math.floor(raw.timesPresident ?? 0)),
    timesVicePresident: Math.max(0, Math.floor(raw.timesVicePresident ?? 0)),
    timesViceAsshole: Math.max(0, Math.floor(raw.timesViceAsshole ?? 0)),
    timesAsshole: Math.max(0, Math.floor(raw.timesAsshole ?? 0)),
    presidentStreak: Math.max(0, Math.floor(raw.presidentStreak ?? 0)),
    bestPresidentStreak: Math.max(0, Math.floor(raw.bestPresidentStreak ?? 0)),
    xp: Math.max(0, Math.floor(raw.xp ?? 0)),
    tricksWon: Math.max(0, Math.floor(raw.tricksWon ?? 0)),
  };
}

function normalizeRemoteProfile(
  raw: CloudPlayerProfile | null | undefined,
): CloudPlayerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const out: CloudPlayerProfile = {};
  if (typeof raw.displayName === "string" && raw.displayName.trim()) {
    out.displayName = raw.displayName.trim().slice(0, 20);
  }
  if (
    raw.appearance === "system" ||
    raw.appearance === "light" ||
    raw.appearance === "dark"
  ) {
    out.appearance = raw.appearance;
  }
  if (
    raw.textContrast === "auto" ||
    raw.textContrast === "light" ||
    raw.textContrast === "dark"
  ) {
    out.textContrast = raw.textContrast;
  }
  if (typeof raw.feltTint === "string") {
    const tint = raw.feltTint.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(tint)) out.feltTint = tint;
  }
  return Object.keys(out).length ? out : null;
}

function statsUrl(playerId: string): string {
  const base = getServerUrl().replace(/\/$/, "");
  return `${base}/api/player-stats/${encodeURIComponent(playerId)}`;
}

async function resolveBearer(
  playerId: string,
  idToken?: string | null,
): Promise<string | null> {
  const explicit = idToken?.trim() || null;
  if (explicit) return explicit;
  if (!playerId.startsWith("google:")) return null;
  try {
    const { getGoogleSessionIdToken } = await import("./googleAccountSync");
    return getGoogleSessionIdToken();
  } catch {
    return null;
  }
}

export async function fetchCloudPlayerRecord(
  playerId: string,
): Promise<CloudPlayerRecord | null> {
  if (!playerId?.trim()) return null;
  try {
    const res = await fetch(statsUrl(playerId), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as {
      stats?: Partial<PlayerStats>;
      profile?: CloudPlayerProfile;
      updatedAt?: string;
    };
    const statsRaw = data?.stats ? normalizeRemoteStats(data.stats) : null;
    const stats =
      statsRaw && (statsRaw.roundsPlayed > 0 || statsRaw.xp > 0)
        ? statsRaw
        : null;
    return {
      stats,
      profile: normalizeRemoteProfile(data?.profile),
      updatedAt: data?.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchCloudPlayerStats(
  playerId: string,
): Promise<PlayerStats | null> {
  const record = await fetchCloudPlayerRecord(playerId);
  return record?.stats ?? null;
}

export async function pushCloudPlayerRecord(
  playerId: string,
  payload: {
    stats?: PlayerStats | null;
    profile?: CloudPlayerProfile | null;
  },
  idToken?: string | null,
): Promise<CloudPushResult> {
  if (!playerId?.trim()) return { ok: false, status: 0, error: "missing_player_id" };
  const hasStats = !!payload.stats;
  const hasProfile = !!payload.profile && Object.keys(payload.profile).length > 0;
  if (!hasStats && !hasProfile) {
    return { ok: false, status: 0, error: "empty_payload" };
  }

  try {
    const bearer = await resolveBearer(playerId, idToken);
    const res = await fetch(statsUrl(playerId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({
        ...(hasStats ? { stats: payload.stats } : {}),
        ...(hasProfile ? { profile: payload.profile } : {}),
      }),
    });
    if (!res.ok) {
      let error = `http_${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) error = body.error;
      } catch {
        // ignore
      }
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

/** @deprecated Prefer pushCloudPlayerRecord — kept for call sites that only push stats. */
export async function pushCloudPlayerStats(
  playerId: string,
  stats: PlayerStats,
  idToken?: string | null,
): Promise<void> {
  await pushCloudPlayerRecord(playerId, { stats }, idToken);
}

export async function readLocalCloudProfile(): Promise<CloudPlayerProfile> {
  const profile: CloudPlayerProfile = {};
  try {
    const { getCachedPlayerName } = await import("./gameCenter");
    const name = (await getCachedPlayerName())?.trim();
    if (name) profile.displayName = name.slice(0, 20);
  } catch {
    // ignore
  }
  try {
    const {
      getAppearancePreference,
      getTextContrastPreference,
    } = await import("./themePreferences");
    profile.appearance = await getAppearancePreference();
    profile.textContrast = await getTextContrastPreference();
  } catch {
    // ignore
  }
  try {
    const { getWallpaperTint, DEFAULT_FELT_COLOR } = await import("./wallpaper");
    const tint = (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
    if (tint) profile.feltTint = tint.toLowerCase();
  } catch {
    // ignore
  }
  return profile;
}

/** Apply cloud profile fields into local storage (name + theme). */
export async function applyCloudProfileLocally(
  profile: CloudPlayerProfile | null | undefined,
): Promise<CloudPlayerProfile | null> {
  const normalized = normalizeRemoteProfile(profile);
  if (!normalized) return null;

  if (normalized.displayName) {
    try {
      const { saveChosenDisplayName } = await import("./playerDisplayName");
      await saveChosenDisplayName(normalized.displayName);
    } catch {
      // ignore invalid remote names
    }
  }
  if (normalized.appearance) {
    try {
      const { setAppearancePreference } = await import("./themePreferences");
      await setAppearancePreference(normalized.appearance);
    } catch {
      // ignore
    }
  }
  if (normalized.textContrast) {
    try {
      const { setTextContrastPreference } = await import("./themePreferences");
      await setTextContrastPreference(normalized.textContrast);
    } catch {
      // ignore
    }
  }
  if (normalized.feltTint) {
    try {
      const { setWallpaperTint } = await import("./wallpaper");
      await setWallpaperTint(normalized.feltTint);
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function isEmptyStats(stats: PlayerStats): boolean {
  return (
    stats.roundsPlayed === 0 &&
    stats.xp === 0 &&
    stats.tricksWon === 0 &&
    stats.timesPresident === 0
  );
}

export { DEFAULT_PLAYER_STATS };
