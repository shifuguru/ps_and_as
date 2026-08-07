/** Visual + timing tokens for the Runs! reward ignition effect. */

import { hexToRgba } from "../../utils/colorTheory";

/**
 * Warm fire palette — white-hot base → yellow → orange → deep tips.
 * Pill chrome stays white/black; these colors are for aura layers only.
 */
export const RUNS_COLORS = {
  core: "#FF9A1F",
  hot: "#FFE566",
  edge: "#FF4D00",
  whiteHot: "#FFF7D6",
  glow: "rgba(255,140,30,0.38)",
  glowSoft: "rgba(255,170,50,0.22)",
  glowCore: "rgba(255,210,90,0.5)",
  ember: "rgba(255,220,120,0.95)",
  flameA: "rgba(255,200,60,0.88)",
  flameB: "rgba(255,120,20,0.82)",
  flameC: "rgba(255,60,0,0.7)",
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
  /** Ignition reward beat (ms). */
  ignitionMs: 720,
  glowBloomMs: 280,
  flameRiseMs: 420,
  settleMs: 320,
  pillPopMs: 380,
  idleGlowPeriodMs: 2400,
  idleFlickerPeriodMs: 1300,
  emberLifetimeMs: [1100, 2100] as const,
  emberSpawnIdleMs: 420,
  shimmerPeriodMs: 1600,
} as const;

export const RUNS_LAYOUT = {
  /**
   * Open-mode aura height as a fraction of pill height (30–50%+ taller).
   * Absolute maxFlameHeight still caps contained / dense modes.
   */
  auraHeightFactor: 1.45,
  auraSideSpill: 0.18,
  maxFlameHeight: 48,
  flameLobeCount: 7,
  maxEmbers: 10,
  glowPad: 18,
  pillRadius: 12,
} as const;

export type FlameSeed = {
  id: number;
  /** Horizontal anchor as fraction of aura width (0–1). */
  x: number;
  /** Base width as fraction of aura width. */
  widthFrac: number;
  /** Base height as fraction of aura height. */
  heightFrac: number;
  delayMs: number;
  periodMs: number;
  swayMs: number;
  rotDeg: number;
  /** Horizontal sway amplitude (px fraction of aura width). */
  swayFrac: number;
  color: string;
  tipColor: string;
  coreColor: string;
};

function makeFlameSeeds(palette: RunsPalette): FlameSeed[] {
  return [
    {
      id: 0,
      x: 0.08,
      widthFrac: 0.28,
      heightFrac: 0.72,
      delayMs: 0,
      periodMs: 980,
      swayMs: 1400,
      rotDeg: -14,
      swayFrac: 0.03,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 1,
      x: 0.22,
      widthFrac: 0.34,
      heightFrac: 0.95,
      delayMs: 60,
      periodMs: 1120,
      swayMs: 1680,
      rotDeg: -7,
      swayFrac: 0.025,
      color: palette.flameA,
      tipColor: palette.flameB,
      coreColor: palette.hot,
    },
    {
      id: 2,
      x: 0.38,
      widthFrac: 0.32,
      heightFrac: 0.88,
      delayMs: 120,
      periodMs: 1040,
      swayMs: 1520,
      rotDeg: 3,
      swayFrac: 0.02,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 3,
      x: 0.5,
      widthFrac: 0.4,
      heightFrac: 1.05,
      delayMs: 40,
      periodMs: 920,
      swayMs: 1260,
      rotDeg: 0,
      swayFrac: 0.018,
      color: palette.hot,
      tipColor: palette.flameB,
      coreColor: palette.whiteHot,
    },
    {
      id: 4,
      x: 0.62,
      widthFrac: 0.33,
      heightFrac: 0.9,
      delayMs: 90,
      periodMs: 1180,
      swayMs: 1740,
      rotDeg: -2,
      swayFrac: 0.022,
      color: palette.flameA,
      tipColor: palette.edge,
      coreColor: palette.hot,
    },
    {
      id: 5,
      x: 0.78,
      widthFrac: 0.34,
      heightFrac: 0.98,
      delayMs: 30,
      periodMs: 1080,
      swayMs: 1580,
      rotDeg: 8,
      swayFrac: 0.028,
      color: palette.flameB,
      tipColor: palette.edge,
      coreColor: palette.whiteHot,
    },
    {
      id: 6,
      x: 0.92,
      widthFrac: 0.26,
      heightFrac: 0.7,
      delayMs: 150,
      periodMs: 1000,
      swayMs: 1460,
      rotDeg: 14,
      swayFrac: 0.032,
      color: palette.flameC,
      tipColor: palette.edge,
      coreColor: palette.hot,
    },
  ];
}

/** Build a Runs! energy palette from any accent hex (e.g. rarity color). */
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
