/**
 * Pick a featured career stat for the hub Snapshot — presentation only.
 * Uses existing PlayerStats fields; never invents run/ten counters.
 */
import { winRate, type PlayerStats } from "./playerStats";

export type FeaturedStat = {
  id: string;
  label: string;
  value: string;
  hint: string;
};

const CANDIDATES: Array<{
  id: string;
  label: string;
  hint: string;
  value: (s: PlayerStats) => string;
  score: (s: PlayerStats) => number;
}> = [
  {
    id: "presidents",
    label: "President Wins",
    hint: "Times you finished first",
    value: (s) => String(s.timesPresident),
    score: (s) => s.timesPresident,
  },
  {
    id: "streak",
    label: "Best Win Streak",
    hint: "Best consecutive President streak",
    value: (s) => String(s.bestPresidentStreak),
    score: (s) => s.bestPresidentStreak,
  },
  {
    id: "winrate",
    label: "Win Rate",
    hint: "President finishes / rounds played",
    value: (s) => `${winRate(s)}%`,
    score: (s) => (s.roundsPlayed > 0 ? winRate(s) : 0),
  },
  {
    id: "tricks",
    label: "Tricks Won",
    hint: "Career trick victories",
    value: (s) => String(s.tricksWon),
    score: (s) => s.tricksWon,
  },
];

/** Stable per-UTC-day pick among stats the player has actually earned. */
export function selectFeaturedStat(
  stats: PlayerStats,
  dayKey = new Date().toISOString().slice(0, 10),
): FeaturedStat {
  const earned = CANDIDATES.filter((c) => c.score(stats) > 0);
  const pool = earned.length > 0 ? earned : CANDIDATES;
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  const pick = pool[hash % pool.length];
  return {
    id: pick.id,
    label: pick.label,
    value: pick.value(stats),
    hint: pick.hint,
  };
}
