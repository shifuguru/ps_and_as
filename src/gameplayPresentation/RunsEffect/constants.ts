/** Visual + timing tokens for the Runs! energy effect. */

import { hexToRgba } from "../../utils/colorTheory";

/**
 * Cream capsule + neon fire ring (reference look).
 * White-gold cores → orange mid → red-orange tips.
 */
export const RUNS_COLORS = {
  core: "#FF9100",
  hot: "#FFD700",
  edge: "#FF4500",
  glow: "rgba(255,145,0,0.42)",
  glowSoft: "rgba(255,180,40,0.28)",
  glowCore: "rgba(255,220,100,0.55)",
  ember: "rgba(255,230,140,0.95)",
  flameA: "rgba(255,215,0,0.92)",
  flameB: "rgba(255,140,0,0.88)",
  flameC: "rgba(255,69,0,0.78)",
  pillFill: "#FFFCEB",
  pillBorder: "#FF9100",
  pillText: "#222222",
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
  pillFill?: string;
  pillBorder?: string;
  pillText?: string;
};

export const RUNS_TIMING = {
  /** Ignition bloom + burst (ms). */
  ignitionMs: 850,
  glowBloomMs: 320,
  flameRiseMs: 480,
  settleMs: 280,
  idleGlowPeriodMs: 1800,
  idleFlickerPeriodMs: 1100,
  emberLifetimeMs: [1200, 2000] as const,
  emberSpawnIdleMs: 900,
} as const;

export const RUNS_LAYOUT = {
  /** Tall tips so fire reads clearly above the neon rim. */
  maxFlameHeight: 34,
  flameCount: 11,
  maxEmbers: 7,
  glowPad: 16,
  pillRadius: 999,
  neonBorderWidth: 2.5,
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
  /** Optional hotter inner core color. */
  coreColor?: string;
};

function makeFlameSeeds(palette: RunsPalette): FlameSeed[] {
  const core = palette.hot;
  return [
    // Side leaners — hug the neon rim ends
    {
      id: 0,
      x: 0.04,
      width: 8,
      height: 22,
      delayMs: 0,
      periodMs: 880,
      rotDeg: -18,
      color: palette.flameC,
      coreColor: core,
    },
    {
      id: 1,
      x: 0.14,
      width: 10,
      height: 28,
      delayMs: 40,
      periodMs: 1020,
      rotDeg: -10,
      color: palette.flameB,
      coreColor: core,
    },
    {
      id: 2,
      x: 0.26,
      width: 11,
      height: 32,
      delayMs: 80,
      periodMs: 960,
      rotDeg: -4,
      color: palette.flameA,
      coreColor: "#FFF8D6",
    },
    {
      id: 3,
      x: 0.38,
      width: 12,
      height: 34,
      delayMs: 20,
      periodMs: 1080,
      rotDeg: 2,
      color: palette.flameB,
      coreColor: core,
    },
    // Peak center tongues
    {
      id: 4,
      x: 0.5,
      width: 13,
      height: 36,
      delayMs: 60,
      periodMs: 940,
      rotDeg: 0,
      color: palette.hot,
      coreColor: "#FFFFFF",
    },
    {
      id: 5,
      x: 0.62,
      width: 12,
      height: 33,
      delayMs: 100,
      periodMs: 1120,
      rotDeg: -2,
      color: palette.flameA,
      coreColor: core,
    },
    {
      id: 6,
      x: 0.74,
      width: 11,
      height: 30,
      delayMs: 30,
      periodMs: 1000,
      rotDeg: 6,
      color: palette.flameB,
      coreColor: core,
    },
    {
      id: 7,
      x: 0.86,
      width: 10,
      height: 26,
      delayMs: 70,
      periodMs: 1160,
      rotDeg: 12,
      color: palette.flameC,
      coreColor: core,
    },
    {
      id: 8,
      x: 0.96,
      width: 8,
      height: 20,
      delayMs: 110,
      periodMs: 900,
      rotDeg: 18,
      color: palette.edge,
      coreColor: palette.flameA,
    },
    // Secondary mid fillers for denser rim fire
    {
      id: 9,
      x: 0.2,
      width: 7,
      height: 18,
      delayMs: 140,
      periodMs: 780,
      rotDeg: -8,
      color: palette.flameA,
      coreColor: "#FFF4C2",
    },
    {
      id: 10,
      x: 0.8,
      width: 7,
      height: 19,
      delayMs: 160,
      periodMs: 820,
      rotDeg: 9,
      color: palette.flameA,
      coreColor: "#FFF4C2",
    },
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
