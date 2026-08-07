/** Visual + timing tokens for the Runs! reward ignition effect. */

import { hexToRgba } from "../../utils/colorTheory";

/**
 * Warm fire palette — white-hot base → yellow → orange → deep tips.
 * Pill chrome: light yellow-orange cream with thin orange rim.
 */
export const RUNS_COLORS = {
  core: "#FF9100",
  hot: "#FFD84A",
  edge: "#FF4500",
  whiteHot: "#FFF4C8",
  /** Pill face — warm cream, not pure white. */
  pillFill: "#FFF3D6",
  pillBorder: "#FFB038",
  pillText: "#111111",
  glow: "rgba(255,145,0,0.36)",
  glowSoft: "rgba(255,180,50,0.2)",
  glowCore: "rgba(255,210,90,0.48)",
  ember: "rgba(255,220,120,0.95)",
  flameA: "rgba(255,210,80,0.9)",
  flameB: "rgba(255,130,20,0.85)",
  flameC: "rgba(255,70,0,0.72)",
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
  pillFill?: string;
  pillBorder?: string;
  pillText?: string;
};

export const RUNS_TIMING = {
  ignitionMs: 720,
  glowBloomMs: 280,
  flameRiseMs: 420,
  settleMs: 320,
  pillPopMs: 380,
  idleGlowPeriodMs: 2400,
  idleFlickerPeriodMs: 1200,
  emberLifetimeMs: [1100, 2000] as const,
  emberSpawnIdleMs: 480,
  shimmerPeriodMs: 1500,
} as const;

export const RUNS_LAYOUT = {
  /**
   * Open-mode flame rise above the pill top edge.
   * Step brief: ~half the pill height.
   */
  auraHeightFactor: 0.5,
  /** Keep fire locked to the pill width (tiny side spill only). */
  auraSideSpill: 0.04,
  maxFlameHeight: 28,
  flameLobeCount: 7,
  maxEmbers: 8,
  glowPad: 14,
  pillRadius: 999,
  neonBorderWidth: 1.5,
} as const;

export type FlameSeed = {
  id: number;
  /** Horizontal center as fraction of pill/aura width (0–1). */
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
};

function makeFlameSeeds(palette: RunsPalette): FlameSeed[] {
  // Soft overlapping wisps across the pill top — not discrete sticker icons.
  return [
    {
      id: 0,
      x: 0.1,
      widthFrac: 0.28,
      heightFrac: 0.85,
      delayMs: 0,
      periodMs: 980,
      swayMs: 1400,
      rotDeg: -8,
      swayFrac: 0.012,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 1,
      x: 0.26,
      widthFrac: 0.3,
      heightFrac: 1,
      delayMs: 60,
      periodMs: 1100,
      swayMs: 1600,
      rotDeg: -3,
      swayFrac: 0.01,
      color: palette.flameA,
      tipColor: palette.flameB,
      coreColor: palette.hot,
    },
    {
      id: 2,
      x: 0.42,
      widthFrac: 0.32,
      heightFrac: 0.92,
      delayMs: 110,
      periodMs: 1020,
      swayMs: 1480,
      rotDeg: 2,
      swayFrac: 0.008,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 3,
      x: 0.55,
      widthFrac: 0.34,
      heightFrac: 1.05,
      delayMs: 30,
      periodMs: 920,
      swayMs: 1320,
      rotDeg: 0,
      swayFrac: 0.008,
      color: palette.hot,
      tipColor: palette.flameB,
      coreColor: palette.whiteHot,
    },
    {
      id: 4,
      x: 0.68,
      widthFrac: 0.3,
      heightFrac: 0.95,
      delayMs: 80,
      periodMs: 1140,
      swayMs: 1700,
      rotDeg: -2,
      swayFrac: 0.01,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.hot,
    },
    {
      id: 5,
      x: 0.82,
      widthFrac: 0.28,
      heightFrac: 0.88,
      delayMs: 40,
      periodMs: 1040,
      swayMs: 1520,
      rotDeg: 6,
      swayFrac: 0.012,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 6,
      x: 0.94,
      widthFrac: 0.24,
      heightFrac: 0.75,
      delayMs: 130,
      periodMs: 960,
      swayMs: 1380,
      rotDeg: 10,
      swayFrac: 0.014,
      color: palette.flameC,
      tipColor: palette.edge,
      coreColor: palette.hot,
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
