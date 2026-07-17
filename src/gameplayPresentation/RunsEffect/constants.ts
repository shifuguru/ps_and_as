/** Visual + timing tokens for the Runs! energy effect. */

import { hexToRgba } from "../../utils/colorTheory";

export const RUNS_COLORS = {
  core: "#FFB200",
  hot: "#FF8C1A",
  edge: "#FF6A00",
  glow: "rgba(255,170,40,0.22)",
  glowSoft: "rgba(255,150,40,0.14)",
  glowCore: "rgba(255,200,80,0.35)",
  ember: "rgba(255,200,90,0.9)",
  flameA: "rgba(255,178,40,0.72)",
  flameB: "rgba(255,120,20,0.55)",
  flameC: "rgba(255,90,10,0.4)",
} as const;

/** Cool platinum / silver energy for President streak prestige. */
export const PLATINUM_STREAK_COLORS = {
  core: "#F2F5FA",
  hot: "#D4DCE8",
  edge: "#8E9BB0",
  glow: "rgba(220,230,245,0.32)",
  glowSoft: "rgba(190,205,225,0.18)",
  glowCore: "rgba(245,248,255,0.55)",
  ember: "rgba(235,242,255,0.95)",
  flameA: "rgba(230,236,248,0.82)",
  flameB: "rgba(180,195,220,0.62)",
  flameC: "rgba(150,165,195,0.45)",
} as const;

export type RunsPalette = {
  core: string;
  hot: string;
  edge: string;
  glow: string;
  glowSoft: string;
  glowCore: string;
  ember: string;
  flameA: string;
  flameB: string;
  flameC: string;
};

export const RUNS_TIMING = {
  /** Ignition bloom + burst (ms). */
  ignitionMs: 850,
  glowBloomMs: 320,
  flameRiseMs: 480,
  settleMs: 280,
  idleGlowPeriodMs: 2200,
  idleFlickerPeriodMs: 1400,
  emberLifetimeMs: [1400, 2200] as const,
  emberSpawnIdleMs: 1600,
} as const;

export const RUNS_LAYOUT = {
  maxFlameHeight: 22,
  flameCount: 8,
  maxEmbers: 4,
  glowPad: 10,
  pillRadius: 12,
} as const;

export type FlameSeed = {
  id: number;
  /** Horizontal position as fraction of pill width (0–1). */
  x: number;
  width: number;
  height: number;
  delayMs: number;
  periodMs: number;
  rotDeg: number;
  color: string;
};

function makeFlameSeeds(palette: RunsPalette): FlameSeed[] {
  return [
    { id: 0, x: 0.12, width: 7, height: 16, delayMs: 0, periodMs: 920, rotDeg: -8, color: palette.flameA },
    { id: 1, x: 0.24, width: 9, height: 20, delayMs: 40, periodMs: 1100, rotDeg: -3, color: palette.flameB },
    { id: 2, x: 0.36, width: 8, height: 18, delayMs: 90, periodMs: 980, rotDeg: 4, color: palette.flameA },
    { id: 3, x: 0.48, width: 10, height: 22, delayMs: 20, periodMs: 1050, rotDeg: 0, color: palette.hot },
    { id: 4, x: 0.58, width: 8, height: 19, delayMs: 70, periodMs: 1140, rotDeg: 5, color: palette.flameB },
    { id: 5, x: 0.68, width: 7, height: 17, delayMs: 110, periodMs: 1000, rotDeg: -5, color: palette.flameC },
    { id: 6, x: 0.78, width: 9, height: 21, delayMs: 50, periodMs: 1180, rotDeg: 7, color: palette.flameA },
    { id: 7, x: 0.88, width: 6, height: 15, delayMs: 130, periodMs: 960, rotDeg: 2, color: palette.flameC },
  ];
}

/** Build a Runs! energy palette from any accent hex (e.g. rarity color). */
export function paletteFromAccent(accent: string): RunsPalette {
  return {
    core: accent,
    hot: accent,
    edge: accent,
    glow: hexToRgba(accent, 0.22),
    glowSoft: hexToRgba(accent, 0.14),
    glowCore: hexToRgba(accent, 0.4),
    ember: hexToRgba(accent, 0.92),
    flameA: hexToRgba(accent, 0.78),
    flameB: hexToRgba(accent, 0.58),
    flameC: hexToRgba(accent, 0.42),
  };
}

export function flameSeedsFromPalette(palette: RunsPalette): FlameSeed[] {
  return makeFlameSeeds(palette);
}

/** Deterministic soft seeds — avoids re-randomising every render. */
export const FLAME_SEEDS: FlameSeed[] = makeFlameSeeds(RUNS_COLORS);
export const PLATINUM_FLAME_SEEDS: FlameSeed[] = makeFlameSeeds(
  PLATINUM_STREAK_COLORS,
);
