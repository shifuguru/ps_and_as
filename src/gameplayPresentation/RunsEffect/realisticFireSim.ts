/**
 * Shared particle fire simulation for the Runs! pill.
 *
 * Conveyor model: fixed particles per column with evenly spaced ages that
 * wrap. Rise speed never changes, and density stays constant — no random
 * respawn waves that read as "speeding up".
 */

export type FireZone = "top" | "left" | "right" | "bottom";

export type FireParticle = {
  x: number;
  y: number;
  originY: number;
  /** Column anchor — particles stay near this x. */
  anchorX: number;
  /** Constant upward speed (px/s, negative = up). */
  rise: number;
  life: number;
  age: number;
  size: number;
  heat: number;
  seed: number;
  front: boolean;
  stretch: number;
  zone: FireZone;
  column: number;
};

export type FireEmber = {
  x: number;
  y: number;
  originY: number;
  anchorX: number;
  rise: number;
  life: number;
  age: number;
  size: number;
  phase: number;
};

export type PillGeom = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FireSimConfig = {
  maxParticles: number;
  maxEmbers: number;
  /** Scale particle sizes / velocities for small UI badges. */
  scale: number;
  /** Even flame columns across the top edge. */
  columns?: number;
  /** Particles stacked in each top column (evenly phase-spaced). */
  perColumn?: number;
};

/** Shared burn tempo — identical for every tongue. */
export const FIRE_BURN = {
  riseTop: -78,
  riseSide: -44,
  riseBottom: -24,
  riseEmber: -60,
  lifeTop: 0.62,
  lifeSide: 0.48,
  lifeBottom: 0.4,
  lifeEmber: 0.85,
  swayFreq: 2.8,
  emberSwayFreq: 2.0,
} as const;

function topSpan(pill: PillGeom): { left: number; right: number; y: number } {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  return {
    left: pill.x - hw + hh * 0.15,
    right: pill.x + hw - hh * 0.15,
    y: pill.y - hh,
  };
}

function columnX(pill: PillGeom, column: number, columns: number): number {
  const span = topSpan(pill);
  if (columns <= 1) return pill.x;
  const t = column / (columns - 1);
  return span.left + (span.right - span.left) * t;
}

function makeTopParticle(
  pill: PillGeom,
  column: number,
  columns: number,
  slot: number,
  slots: number,
  scale: number,
  front: boolean,
): FireParticle {
  const span = topSpan(pill);
  const lane = (span.right - span.left) / Math.max(1, columns);
  const anchorX =
    columnX(pill, column, columns) + (Math.random() - 0.5) * lane * 0.22;
  const rise = FIRE_BURN.riseTop * scale;
  const life = FIRE_BURN.lifeTop;
  // Even phase spacing across the column = constant density forever.
  const age = (slot / slots) * life;
  const size = (8.5 + Math.random() * 3.5) * scale;
  const stretch = 1.85 + Math.random() * 0.3;

  return {
    x: anchorX,
    y: span.y + rise * age,
    originY: span.y,
    anchorX,
    rise,
    life,
    age,
    size,
    heat: 0.84 + Math.random() * 0.14,
    seed: Math.random() * Math.PI * 2,
    front,
    stretch,
    zone: "top",
    column,
  };
}

function makeSideParticle(
  pill: PillGeom,
  side: "left" | "right" | "bottom",
  slot: number,
  slots: number,
  scale: number,
): FireParticle {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);
  const span = topSpan(pill);
  let anchorX = pill.x;
  let originY = pill.y;
  let rise = FIRE_BURN.riseSide * scale;
  let life = FIRE_BURN.lifeSide;

  if (side === "left") {
    const a = Math.PI * 0.75 + (slot / Math.max(1, slots - 1)) * Math.PI * 0.45;
    anchorX = pill.x - flat + Math.cos(a) * hh;
    originY = pill.y + Math.sin(a) * hh * 0.75;
  } else if (side === "right") {
    const a = -Math.PI * 0.2 + (slot / Math.max(1, slots - 1)) * Math.PI * 0.45;
    anchorX = pill.x + flat + Math.cos(a) * hh;
    originY = pill.y + Math.sin(a) * hh * 0.75;
  } else {
    rise = FIRE_BURN.riseBottom * scale;
    life = FIRE_BURN.lifeBottom;
    const t = slot / Math.max(1, slots - 1);
    anchorX = span.left + (span.right - span.left) * t;
    originY = pill.y + hh;
  }

  const age = (slot / slots) * life;
  return {
    x: anchorX,
    y: originY + rise * age,
    originY,
    anchorX,
    rise,
    life,
    age,
    size: (5.5 + Math.random() * 2.5) * scale,
    heat: 0.55 + Math.random() * 0.25,
    seed: Math.random() * Math.PI * 2,
    front: false,
    stretch: 1.2 + Math.random() * 0.2,
    zone: side,
    column: -1,
  };
}

/**
 * Build a stable fire field once. Particles keep their slot forever and only
 * wrap age — no random respawn waves.
 */
export function initFireField(
  pill: PillGeom,
  cfg: FireSimConfig,
): { particles: FireParticle[]; embers: FireEmber[] } {
  const columns = cfg.columns ?? 14;
  const perColumn = cfg.perColumn ?? 8;
  const scale = cfg.scale;
  const particles: FireParticle[] = [];

  for (let c = 0; c < columns; c++) {
    for (let s = 0; s < perColumn; s++) {
      particles.push(
        makeTopParticle(
          pill,
          c,
          columns,
          s,
          perColumn,
          scale,
          s % 3 === 0, // sparse front tongues
        ),
      );
    }
  }

  // Light side/bottom wrap — few slots, also phase-spaced.
  const sideSlots = 4;
  for (let s = 0; s < sideSlots; s++) {
    particles.push(makeSideParticle(pill, "left", s, sideSlots, scale));
    particles.push(makeSideParticle(pill, "right", s, sideSlots, scale));
  }
  const bottomSlots = 6;
  for (let s = 0; s < bottomSlots; s++) {
    particles.push(makeSideParticle(pill, "bottom", s, bottomSlots, scale));
  }

  const embers: FireEmber[] = [];
  const emberCount = Math.min(cfg.maxEmbers, columns);
  for (let i = 0; i < emberCount; i++) {
    const col = i % columns;
    const anchorX = columnX(pill, col, columns);
    const originY = topSpan(pill).y;
    const rise = FIRE_BURN.riseEmber * scale;
    const life = FIRE_BURN.lifeEmber;
    const age = (i / emberCount) * life;
    embers.push({
      x: anchorX,
      y: originY + rise * age,
      originY,
      anchorX,
      rise,
      life,
      age,
      size: (1.2 + (i % 3) * 0.35) * scale,
      phase: (i / emberCount) * Math.PI * 2,
    });
  }

  return { particles, embers };
}

/** @deprecated — prefer initFireField. Kept for call-site compatibility. */
export function makeParticle(
  pill: PillGeom,
  front: boolean,
  scale: number,
  columns = 14,
): FireParticle {
  return makeTopParticle(pill, 0, columns, 0, 1, scale, front);
}

/** @deprecated — prefer initFireField. */
export function makeEmber(
  pill: PillGeom,
  scale: number,
  columns = 14,
): FireEmber {
  const span = topSpan(pill);
  const rise = FIRE_BURN.riseEmber * scale;
  return {
    x: pill.x,
    y: span.y,
    originY: span.y,
    anchorX: pill.x,
    rise,
    life: FIRE_BURN.lifeEmber,
    age: 0,
    size: 1.2 * scale,
    phase: 0,
  };
}

/** No-op prewarm — conveyor field is already evenly phased at init. */
export function prewarmFireSim(
  _particles: FireParticle[],
  _embers: FireEmber[],
  _pill: PillGeom,
  _cfg: FireSimConfig,
  _seconds = 0.9,
): void {
  // Intentionally empty: initFireField already distributes ages evenly.
}

export function stepFireSim(
  particles: FireParticle[],
  embers: FireEmber[],
  _pill: PillGeom,
  dt: number,
  time: number,
  cfg: FireSimConfig,
): void {
  const scale = cfg.scale;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    // Wrap age — never respawn a new random particle.
    p.age += dt;
    if (p.age >= p.life) p.age -= p.life;

    // Absolute position from age → no drift, perfectly constant rise.
    p.y = p.originY + p.rise * p.age;
    const wobble = Math.sin(time * FIRE_BURN.swayFreq + p.seed) * 4.5 * scale;
    p.x = p.anchorX + wobble;
  }

  for (let i = 0; i < embers.length; i++) {
    const e = embers[i];
    e.age += dt;
    if (e.age >= e.life) e.age -= e.life;
    e.y = e.originY + e.rise * e.age;
    e.x =
      e.anchorX +
      Math.sin(time * FIRE_BURN.emberSwayFreq + e.phase) * 6 * scale;
  }
}

export function drawSoftBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  stops: Array<[number, string]>,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFireParticle(
  ctx: CanvasRenderingContext2D,
  p: FireParticle,
  intensity = 1,
): void {
  const t = Math.min(1, p.age / p.life);
  // Soft opacity edges only — middle of life is flat so density looks steady.
  const grow = t < 0.08 ? t / 0.08 : 1;
  const fade = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
  const a = grow * fade * (0.32 + p.heat * 0.38) * intensity;
  if (a < 0.02) return;

  const rx = p.size * 0.42;
  const ry = p.size * p.stretch;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;

  drawSoftBlob(ctx, p.x, p.y, rx, ry, [
    [0, `rgba(255,${Math.floor(210 * p.heat)},55,1)`],
    [0.3, `rgba(255,${Math.floor(120 + 35 * p.heat)},16,0.8)`],
    [0.65, "rgba(255,60,5,0.32)"],
    [1, "rgba(40,0,0,0)"],
  ]);

  if (t < 0.35) {
    const k = 1 - t / 0.35;
    ctx.globalAlpha = a * 0.8 * k;
    drawSoftBlob(ctx, p.x, p.y + ry * 0.15, rx * 0.45, ry * 0.4, [
      [0, "rgba(255,255,240,1)"],
      [0.45, `rgba(255,230,${Math.floor(130 * p.heat)},0.85)`],
      [1, "rgba(255,140,20,0)"],
    ]);
  }
  ctx.restore();
}

export function drawFireEmber(
  ctx: CanvasRenderingContext2D,
  e: FireEmber,
  intensity = 1,
): void {
  const t = e.age / e.life;
  // Gentle twinkle — opacity only, fixed tempo from phase.
  const tw = 0.75 + 0.25 * Math.sin(e.phase + timeLike(e));
  const a = Math.sin(t * Math.PI) * tw * intensity;
  if (a < 0.02) return;

  const s = e.size;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  drawSoftBlob(ctx, e.x, e.y, s * 2.2, s * 2.2, [
    [0, "rgba(255,245,180,1)"],
    [0.4, "rgba(255,165,45,0.75)"],
    [1, "rgba(255,60,0,0)"],
  ]);
  ctx.restore();
}

function timeLike(e: FireEmber): number {
  // Derive a smooth phase from age so twinkle rate matches burn tempo.
  return (e.age / e.life) * Math.PI * 2;
}

export function drawFireBloom(
  ctx: CanvasRenderingContext2D,
  pill: PillGeom,
  _time: number,
  intensity = 1,
): void {
  const span = topSpan(pill);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity * 0.75;

  const g = ctx.createLinearGradient(span.left, span.y, span.right, span.y);
  g.addColorStop(0, "rgba(255,140,30,0)");
  g.addColorStop(0.08, "rgba(255,160,40,0.16)");
  g.addColorStop(0.5, "rgba(255,170,50,0.18)");
  g.addColorStop(0.92, "rgba(255,160,40,0.16)");
  g.addColorStop(1, "rgba(255,140,30,0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(
    pill.x,
    span.y + 2,
    (span.right - span.left) * 0.52,
    pill.h * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const rim = ctx.createRadialGradient(
    pill.x,
    pill.y,
    pill.h * 0.35,
    pill.x,
    pill.y,
    pill.w * 0.55,
  );
  rim.addColorStop(0, "rgba(255,190,70,0.1)");
  rim.addColorStop(0.65, "rgba(255,120,30,0.05)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(pill.x, pill.y, pill.w * 0.56, pill.h * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
