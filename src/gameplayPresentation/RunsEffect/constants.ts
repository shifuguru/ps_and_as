/** Visual + timing tokens for the Runs! reward ignition effect. */

import { hexToRgba } from "../../utils/colorTheory";

/**
 * Warm fire palette — white-hot base → yellow → orange → deep tips.
 * Pill chrome stays white/black; these colors are for aura layers only.
 */
export const RUNS_COLORS = {
  core: "#FF9A1F",
  hot: "#FFE566",
  edge: "#FF3B00",
  whiteHot: "#FFF8E0",
  glow: "rgba(255,140,30,0.4)",
  glowSoft: "rgba(255,170,50,0.24)",
  glowCore: "rgba(255,210,90,0.55)",
  ember: "rgba(255,220,120,0.95)",
  flameA: "rgba(255,190,50,0.95)",
  flameB: "rgba(255,110,15,0.92)",
  flameC: "rgba(230,40,0,0.88)",
} as const;

/** Cool platinum / silver energy for President streak prestige. */
export const PLATINUM_STREAK_COLORS = {
  core: "#F2F5FA",
  hot: "#D4DCE8",
  edge: "#8E9BB0",
  whiteHot: "#FFFFFF",
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
  whiteHot: string;
  glow: string;
  glowSoft: string;
  glowCore: string;
  ember: string;
  flameA: string;
  flameB: string;
  flameC: string;
};

export const RUNS_TIMING = {
  ignitionMs: 720,
  glowBloomMs: 280,
  flameRiseMs: 420,
  settleMs: 320,
  pillPopMs: 380,
  idleGlowPeriodMs: 2400,
  idleFlickerPeriodMs: 1200,
  emberLifetimeMs: [1000, 2000] as const,
  emberSpawnIdleMs: 380,
  shimmerPeriodMs: 1500,
} as const;

export const RUNS_LAYOUT = {
  /** Open-mode aura height vs pill height. */
  auraHeightFactor: 1.55,
  auraSideSpill: 0.22,
  maxFlameHeight: 56,
  flameLobeCount: 9,
  maxEmbers: 12,
  glowPad: 20,
  pillRadius: 12,
} as const;

export type FlameSeed = {
  id: number;
  x: number;
  widthFrac: number;
  heightFrac: number;
  delayMs: number;
  periodMs: number;
  swayMs: number;
  rotDeg: number;
  swayFrac: number;
  color: string;
  tipColor: string;
  coreColor: string;
  /** Path variant index for irregular silhouettes. */
  pathVariant: number;
};

function makeFlameSeeds(palette: RunsPalette): FlameSeed[] {
  // Dense overlapping tongues so the aura reads as one erupting mass.
  return [
    {
      id: 0,
      x: 0.02,
      widthFrac: 0.3,
      heightFrac: 0.78,
      delayMs: 0,
      periodMs: 920,
      swayMs: 1380,
      rotDeg: -18,
      swayFrac: 0.028,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
      pathVariant: 0,
    },
    {
      id: 1,
      x: 0.14,
      widthFrac: 0.34,
      heightFrac: 1.02,
      delayMs: 50,
      periodMs: 1080,
      swayMs: 1620,
      rotDeg: -10,
      swayFrac: 0.022,
      color: palette.flameA,
      tipColor: palette.flameB,
      coreColor: palette.hot,
      pathVariant: 1,
    },
    {
      id: 2,
      x: 0.28,
      widthFrac: 0.32,
      heightFrac: 0.92,
      delayMs: 110,
      periodMs: 980,
      swayMs: 1480,
      rotDeg: -4,
      swayFrac: 0.018,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
      pathVariant: 2,
    },
    {
      id: 3,
      x: 0.4,
      widthFrac: 0.36,
      heightFrac: 1.12,
      delayMs: 30,
      periodMs: 860,
      swayMs: 1240,
      rotDeg: 2,
      swayFrac: 0.015,
      color: palette.hot,
      tipColor: palette.flameB,
      coreColor: palette.whiteHot,
      pathVariant: 0,
    },
    {
      id: 4,
      x: 0.52,
      widthFrac: 0.38,
      heightFrac: 1.18,
      delayMs: 70,
      periodMs: 940,
      swayMs: 1320,
      rotDeg: 0,
      swayFrac: 0.016,
      color: palette.hot,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
      pathVariant: 1,
    },
    {
      id: 5,
      x: 0.64,
      widthFrac: 0.34,
      heightFrac: 0.98,
      delayMs: 90,
      periodMs: 1120,
      swayMs: 1700,
      rotDeg: -3,
      swayFrac: 0.02,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.hot,
      pathVariant: 2,
    },
    {
      id: 6,
      x: 0.76,
      widthFrac: 0.34,
      heightFrac: 1.06,
      delayMs: 20,
      periodMs: 1020,
      swayMs: 1540,
      rotDeg: 8,
      swayFrac: 0.024,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
      pathVariant: 0,
    },
    {
      id: 7,
      x: 0.88,
      widthFrac: 0.3,
      heightFrac: 0.88,
      delayMs: 130,
      periodMs: 1160,
      swayMs: 1660,
      rotDeg: 14,
      swayFrac: 0.03,
      color: palette.flameC,
      tipColor: palette.edge,
      coreColor: palette.hot,
      pathVariant: 1,
    },
    {
      id: 8,
      x: 0.98,
      widthFrac: 0.26,
      heightFrac: 0.72,
      delayMs: 160,
      periodMs: 960,
      swayMs: 1420,
      rotDeg: 18,
      swayFrac: 0.032,
      color: palette.flameC,
      tipColor: palette.edge,
      coreColor: palette.flameA,
      pathVariant: 2,
    },
  ];
}

export function paletteFromAccent(accent: string): RunsPalette {
  return {
    core: accent,
    hot: accent,
    edge: accent,
    whiteHot: "#FFFFFF",
    glow: hexToRgba(accent, 0.28),
    glowSoft: hexToRgba(accent, 0.16),
    glowCore: hexToRgba(accent, 0.42),
    ember: hexToRgba(accent, 0.92),
    flameA: hexToRgba(accent, 0.78),
    flameB: hexToRgba(accent, 0.58),
    flameC: hexToRgba(accent, 0.42),
  };
}

export function flameSeedsFromPalette(palette: RunsPalette): FlameSeed[] {
  return makeFlameSeeds(palette);
}

export const FLAME_SEEDS: FlameSeed[] = makeFlameSeeds(RUNS_COLORS);
export const PLATINUM_FLAME_SEEDS: FlameSeed[] = makeFlameSeeds(
  PLATINUM_STREAK_COLORS,
);
