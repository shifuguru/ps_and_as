/** Visual + timing tokens for the Runs! energy effect. */

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

/** Deterministic soft seeds — avoids re-randomising every render. */
export const FLAME_SEEDS: FlameSeed[] = [
  { id: 0, x: 0.12, width: 7, height: 16, delayMs: 0, periodMs: 920, rotDeg: -8, color: RUNS_COLORS.flameA },
  { id: 1, x: 0.24, width: 9, height: 20, delayMs: 40, periodMs: 1100, rotDeg: -3, color: RUNS_COLORS.flameB },
  { id: 2, x: 0.36, width: 8, height: 18, delayMs: 90, periodMs: 980, rotDeg: 4, color: RUNS_COLORS.flameA },
  { id: 3, x: 0.48, width: 10, height: 22, delayMs: 20, periodMs: 1050, rotDeg: 0, color: RUNS_COLORS.hot },
  { id: 4, x: 0.58, width: 8, height: 19, delayMs: 70, periodMs: 1140, rotDeg: 5, color: RUNS_COLORS.flameB },
  { id: 5, x: 0.68, width: 7, height: 17, delayMs: 110, periodMs: 1000, rotDeg: -5, color: RUNS_COLORS.flameC },
  { id: 6, x: 0.78, width: 9, height: 21, delayMs: 50, periodMs: 1180, rotDeg: 7, color: RUNS_COLORS.flameA },
  { id: 7, x: 0.88, width: 6, height: 15, delayMs: 130, periodMs: 960, rotDeg: 2, color: RUNS_COLORS.flameC },
];
