import type { PlayerStats } from "../services/playerStats";

export type TitleTrackTier = {
  /** Absolute threshold (points or counter value). */
  threshold: number;
  title: string;
};

export type TitleTrackDef = {
  id: string;
  /** Short label in the track list. */
  trackName: string;
  description: string;
  kind: "points" | "counter";
  /** For counter tracks — career field on PlayerStats. */
  counterField?: keyof Pick<
    PlayerStats,
    | "timesPresident"
    | "timesAsshole"
    | "roundsPlayed"
  >;
  tiers: TitleTrackTier[];
};

/** Lucky title points — GW-scale long game (see Lucky track thresholds). */
export const LUCKY_POINTS = {
  gameWon: 10_000,
  jokerInDeal: 2_500,
  jokerReceivedTrade: 4_000,
  jokerGivenTrade: 3_000,
} as const;

/** Unlucky title points — same tier ladder as Lucky. */
export const UNLUCKY_POINTS = {
  gameLost: 10_000,
  jokerGivenTrade: 5_000,
} as const;

export function luckyTitlePoints(stats: PlayerStats): number {
  return (
    stats.gamesWon * LUCKY_POINTS.gameWon +
    stats.jokersReceivedInDeal * LUCKY_POINTS.jokerInDeal +
    stats.jokersReceivedInTrade * LUCKY_POINTS.jokerReceivedTrade +
    stats.jokersGivenInTrade * LUCKY_POINTS.jokerGivenTrade
  );
}

export function unluckyTitlePoints(stats: PlayerStats): number {
  return (
    stats.gamesLost * UNLUCKY_POINTS.gameLost +
    stats.jokersGivenInTrade * UNLUCKY_POINTS.jokerGivenTrade
  );
}

/** GW Lucky track — Charmed → Blessed by Fate (ticket-scale thresholds). */
const LUCKY_TIERS: TitleTrackTier[] = [
  { threshold: 50_000, title: "Charmed" },
  { threshold: 100_000, title: "Lucky" },
  { threshold: 250_000, title: "Favored" },
  { threshold: 500_000, title: "Prosperous" },
  { threshold: 1_000_000, title: "Golden" },
  { threshold: 2_500_000, title: "Blessed by Fate" },
];

const UNLUCKY_TIERS: TitleTrackTier[] = [
  { threshold: 50_000, title: "Jinxed" },
  { threshold: 100_000, title: "Unlucky" },
  { threshold: 250_000, title: "Hexed" },
  { threshold: 500_000, title: "Cursed" },
  { threshold: 1_000_000, title: "Doomed" },
  { threshold: 2_500_000, title: "Forsaken by Fate" },
];

export const TITLE_TRACKS: TitleTrackDef[] = [
  {
    id: "lucky",
    trackName: "Luck",
    description: "Gained by winning games, and receiving Jokers.",
    kind: "points",
    tiers: LUCKY_TIERS,
  },
  {
    id: "unlucky",
    trackName: "Unlucky",
    description: "Gained by losing games, and trading Jokers away.",
    kind: "points",
    tiers: UNLUCKY_TIERS,
  },
  {
    id: "president",
    trackName: "President",
    description: "Finish as President",
    kind: "counter",
    counterField: "timesPresident",
    tiers: [
      { threshold: 25, title: "Staffer" },
      { threshold: 75, title: "Counselor" },
      { threshold: 200, title: "Chief of Staff" },
      { threshold: 500, title: "Mr. President" },
      { threshold: 1_200, title: "Dynasty" },
      { threshold: 3_000, title: "Eternal President" },
    ],
  },
  {
    id: "asshole",
    trackName: "Asshole",
    description: "Finish last in a round",
    kind: "counter",
    counterField: "timesAsshole",
    tiers: [
      { threshold: 25, title: "Cellar Dweller" },
      { threshold: 75, title: "Bottom Feeder" },
      { threshold: 200, title: "Deck Scraper" },
      { threshold: 500, title: "Royal Asshole" },
      { threshold: 1_200, title: "Permanent Asshole" },
      { threshold: 3_000, title: "Throne of Shame" },
    ],
  },
  {
    id: "veteran",
    trackName: "Veteran",
    description: "Complete rounds at the table",
    kind: "counter",
    counterField: "roundsPlayed",
    tiers: [
      { threshold: 50, title: "Regular" },
      { threshold: 150, title: "Familiar Face" },
      { threshold: 400, title: "Table Veteran" },
      { threshold: 1_000, title: "Institution" },
      { threshold: 2_500, title: "Hall of Fame" },
      { threshold: 6_000, title: "Living Legend" },
    ],
  },
];

export function titleTrackValue(stats: PlayerStats, track: TitleTrackDef): number {
  if (track.kind === "points") {
    if (track.id === "lucky") return luckyTitlePoints(stats);
    if (track.id === "unlucky") return unluckyTitlePoints(stats);
    return 0;
  }
  const field = track.counterField;
  if (!field) return 0;
  return Math.max(0, Math.floor(Number(stats[field]) || 0));
}

export type TitleTrackProgress = {
  track: TitleTrackDef;
  value: number;
  /** 0 = locked; 1–6 = current tier index (1-based). */
  tier: number;
  displayTitle: string | null;
  nextThreshold: number | null;
  prevThreshold: number;
  currentIntoTier: number;
  tierSpan: number;
  fraction: number;
  unlocked: boolean;
};

export function titleTrackProgress(
  stats: PlayerStats,
  track: TitleTrackDef,
): TitleTrackProgress {
  const value = titleTrackValue(stats, track);
  let tier = 0;
  for (let i = 0; i < track.tiers.length; i++) {
    if (value >= track.tiers[i].threshold) tier = i + 1;
  }
  const unlocked = tier >= 1;
  const displayTitle = tier > 0 ? track.tiers[tier - 1].title : null;
  const prevThreshold = tier > 0 ? track.tiers[tier - 1].threshold : 0;
  const nextTier = tier < track.tiers.length ? track.tiers[tier] : null;
  const nextThreshold = nextTier?.threshold ?? null;
  const tierSpan =
    nextThreshold != null
      ? Math.max(1, nextThreshold - prevThreshold)
      : Math.max(1, prevThreshold);
  const currentIntoTier =
    nextThreshold != null
      ? Math.min(tierSpan, Math.max(0, value - prevThreshold))
      : tier > 0
        ? tierSpan
        : Math.min(tierSpan, value);
  const fraction =
    nextThreshold != null ? currentIntoTier / tierSpan : tier > 0 ? 1 : value / tierSpan;

  return {
    track,
    value,
    tier,
    displayTitle,
    nextThreshold,
    prevThreshold,
    currentIntoTier,
    tierSpan,
    fraction: Math.min(1, Math.max(0, fraction)),
    unlocked,
  };
}

export function listTitleTrackProgress(stats: PlayerStats): TitleTrackProgress[] {
  return TITLE_TRACKS.map((track) => titleTrackProgress(stats, track));
}

export function unlockedTitleTracks(stats: PlayerStats): TitleTrackProgress[] {
  return listTitleTrackProgress(stats).filter((p) => p.unlocked);
}

export function resolveDisplayedTitle(
  stats: PlayerStats,
  displayTrackId: string | null | undefined,
): string | null {
  if (!displayTrackId) return null;
  const track = TITLE_TRACKS.find((t) => t.id === displayTrackId);
  if (!track) return null;
  const progress = titleTrackProgress(stats, track);
  return progress.displayTitle;
}

export function formatTitleTrackValue(progress: TitleTrackProgress): string {
  if (progress.track.kind === "points") {
    return progress.value.toLocaleString();
  }
  return String(progress.value);
}

export function formatTitleTrackProgressLabel(progress: TitleTrackProgress): string {
  if (!progress.unlocked && progress.nextThreshold != null) {
    return `${formatTitleTrackValue(progress)} / ${progress.nextThreshold.toLocaleString()}`;
  }
  if (progress.nextThreshold != null) {
    return `${progress.currentIntoTier.toLocaleString()} / ${progress.tierSpan.toLocaleString()} to next`;
  }
  return "Max tier";
}
