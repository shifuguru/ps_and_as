import type { PlayerStats } from "../services/playerStats";
import {
  parseCpuTierFromId,
  parseCpuTierFromName,
} from "../utils/cpuNames";
import {
  resolveAvatarBorder,
  type AvatarBorderDesign,
} from "./avatarBorders";

export const MAX_CPU_PROFILE = 7;

type CpuTier = {
  baseXp: number;
  stats: Omit<PlayerStats, "xp">;
};

/** Tier 1 = lowest XP/rewards; tier 7 = highest. */
const CPU_TIERS: CpuTier[] = [
  {
    baseXp: 35,
    stats: {
      roundsPlayed: 1,
      timesPresident: 0,
      timesVicePresident: 0,
      timesViceAsshole: 0,
      timesAsshole: 1,
      presidentStreak: 0,
      bestPresidentStreak: 0,
      tricksWon: 4,
    },
  },
  {
    baseXp: 130,
    stats: {
      roundsPlayed: 3,
      timesPresident: 0,
      timesVicePresident: 1,
      timesViceAsshole: 0,
      timesAsshole: 0,
      presidentStreak: 0,
      bestPresidentStreak: 0,
      tricksWon: 14,
    },
  },
  {
    baseXp: 320,
    stats: {
      roundsPlayed: 10,
      timesPresident: 0,
      timesVicePresident: 2,
      timesViceAsshole: 1,
      timesAsshole: 0,
      presidentStreak: 0,
      bestPresidentStreak: 0,
      tricksWon: 38,
    },
  },
  {
    baseXp: 580,
    stats: {
      roundsPlayed: 14,
      timesPresident: 1,
      timesVicePresident: 3,
      timesViceAsshole: 1,
      timesAsshole: 1,
      presidentStreak: 1,
      bestPresidentStreak: 1,
      tricksWon: 72,
    },
  },
  {
    baseXp: 950,
    stats: {
      roundsPlayed: 20,
      timesPresident: 2,
      timesVicePresident: 4,
      timesViceAsshole: 2,
      timesAsshole: 1,
      presidentStreak: 2,
      bestPresidentStreak: 2,
      tricksWon: 118,
    },
  },
  {
    baseXp: 1500,
    stats: {
      roundsPlayed: 28,
      timesPresident: 4,
      timesVicePresident: 5,
      timesViceAsshole: 2,
      timesAsshole: 1,
      presidentStreak: 1,
      bestPresidentStreak: 2,
      tricksWon: 185,
    },
  },
  {
    baseXp: 2500,
    stats: {
      roundsPlayed: 42,
      timesPresident: 8,
      timesVicePresident: 7,
      timesViceAsshole: 3,
      timesAsshole: 2,
      presidentStreak: 3,
      bestPresidentStreak: 3,
      tricksWon: 310,
    },
  },
];

function tierForCpuNumber(cpuNumber: number): CpuTier {
  const index = Math.min(Math.max(cpuNumber, 1), MAX_CPU_PROFILE) - 1;
  return CPU_TIERS[index];
}

export function parseCpuTier(
  player: Pick<{ id?: string; name?: string }, "id" | "name"> | null | undefined,
): number | null {
  if (!player) return null;
  return (
    parseCpuTierFromId(player.id) ??
    parseCpuTierFromName(player.name ?? "") ??
    null
  );
}

export function getCpuPlayerStats(
  player: Pick<{ id?: string; name?: string }, "id" | "name"> | null | undefined,
): PlayerStats | null {
  const tier = parseCpuTier(player);
  if (tier == null) return null;
  const profile = tierForCpuNumber(tier);
  return { ...profile.stats, xp: profile.baseXp };
}

export function getCpuCareerXp(
  player: Pick<{ id?: string; name?: string }, "id" | "name"> | null | undefined,
): number | null {
  const tier = parseCpuTier(player);
  if (tier == null) return null;
  return tierForCpuNumber(tier).baseXp;
}

export function getCpuAvatarBorder(
  player: Pick<{ id?: string; name?: string }, "id" | "name"> | null | undefined,
): AvatarBorderDesign | null {
  const stats = getCpuPlayerStats(player);
  if (!stats) return null;
  return resolveAvatarBorder(stats);
}
