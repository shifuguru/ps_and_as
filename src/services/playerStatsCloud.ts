import { getServerUrl } from "../config/server";
import type { PlayerStats } from "./playerStats";
import { DEFAULT_PLAYER_STATS } from "./playerStats";

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

function statsUrl(playerId: string): string {
  const base = getServerUrl().replace(/\/$/, "");
  return `${base}/api/player-stats/${encodeURIComponent(playerId)}`;
}

export async function fetchCloudPlayerStats(
  playerId: string,
): Promise<PlayerStats | null> {
  if (!playerId?.trim()) return null;
  try {
    const res = await fetch(statsUrl(playerId), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { stats?: Partial<PlayerStats> };
    if (!data?.stats) return null;
    const stats = normalizeRemoteStats(data.stats);
    return stats.roundsPlayed > 0 || stats.xp > 0 ? stats : null;
  } catch {
    return null;
  }
}

export async function pushCloudPlayerStats(
  playerId: string,
  stats: PlayerStats,
): Promise<void> {
  if (!playerId?.trim()) return;
  try {
    await fetch(statsUrl(playerId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stats }),
    });
  } catch {
    // Offline or server unavailable — local stats remain source of truth.
  }
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
