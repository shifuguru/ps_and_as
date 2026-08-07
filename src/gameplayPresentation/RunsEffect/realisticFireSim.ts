/**
 * Shared particle fire simulation for the Runs! pill.
 *
 * Goal for this pass: even coverage across the pill width with identifiable
 * rising flame streams — not a center-weighted aurora beam.
 */

export type FireZone = "top" | "left" | "right" | "bottom";

export type FireParticle = {
  x: number;
  y: number;
  /** Column anchor — particles stay near this x so flames don't merge into one beam. */
  anchorX: number;
  vx: number;
  /** Near-constant upward speed (px/s, negative = up). */
  rise: number;
  life: number;
  age: number;
  size: number;
  heat: number;
  seed: number;
  front: boolean;
  stretch: number;
  zone: FireZone;
};

export type FireEmber = {
  x: number;
  y: number;
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
};

/** Shared burn tempo — same for every tongue (not randomized per particle). */
export const FIRE_BURN = {
  /** Top-edge rise speed (px/s, negative = up). */
  riseTop: -78,
  riseSide: -44,
  riseBottom: -24,
  riseEmber: -60,
  /** Lifetime (s) — fixed so streams don't cycle at mixed tempos. */
  lifeTop: 0.62,
  lifeSide: 0.48,
  lifeBottom: 0.4,
  lifeEmber: 0.7,
  /** Shared lateral sway frequency (Hz-ish). Phase differs; tempo does not. */
  swayFreq: 2.8,
  emberSwayFreq: 2.0,
} as const;

function topSpan(pill: PillGeom): { left: number; right: number; y: number } {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);
  // Include the round caps so fire runs full width, not only the flat top.
  return {
    left: pill.x - hw + hh * 0.15,
    right: pill.x + hw - hh * 0.15,
    y: pill.y - hh,
  };
}

/** Even column x across the full pill width (plus light side/bottom samples). */
export function sampleEmitter(
  pill: PillGeom,
  columns: number,
): { x: number; y: number; zone: FireZone; column: number } {
  const roll = Math.random();
  const span = topSpan(pill);
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);

  // ~78% top — pick a column uniformly so coverage stays even.
  if (roll < 0.78) {
    const column = Math.floor(Math.random() * columns);
    const t = columns <= 1 ? 0.5 : column / (columns - 1);
    const x = span.left + (span.right - span.left) * t;
    // Tiny jitter inside the column lane only.
    const lane = (span.right - span.left) / Math.max(1, columns);
    return {
      x: x + (Math.random() - 0.5) * lane * 0.35,
      y: span.y + (Math.random() - 0.2) * 2,
      zone: "top",
      column,
    };
  }

  if (roll < 0.87) {
    const a = Math.PI * 0.7 + Math.random() * Math.PI * 0.55;
    return {
      x: pill.x - flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh * 0.85,
      zone: "left",
      column: -1,
    };
  }

  if (roll < 0.96) {
    const a = -Math.PI * 0.25 + Math.random() * Math.PI * 0.55;
    return {
      x: pill.x + flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh * 0.85,
      zone: "right",
      column: -1,
    };
  }

  const t = Math.random();
  return {
    x: span.left + (span.right - span.left) * t,
    y: pill.y + hh,
    zone: "bottom",
    column: -2,
  };
}

export function makeParticle(
  pill: PillGeom,
  front: boolean,
  scale: number,
  columns = 14,
): FireParticle {
  const s = sampleEmitter(pill, columns);
  const top = s.zone === "top";
  const bottom = s.zone === "bottom";

  // Constant burn rate — speed/life are shared; only phase/size jitter differ.
  const rise =
    (top
      ? FIRE_BURN.riseTop
      : bottom
        ? FIRE_BURN.riseBottom
        : FIRE_BURN.riseSide) * scale;
  const life = top
    ? FIRE_BURN.lifeTop
    : bottom
      ? FIRE_BURN.lifeBottom
      : FIRE_BURN.lifeSide;

  // Smaller / narrower blobs so tongues don't fuse into one aurora sheet.
  const size = top
    ? (8 + Math.random() * 5) * scale
    : (5.5 + Math.random() * 3.5) * scale;
  const stretch = top ? 1.85 + Math.random() * 0.35 : 1.2 + Math.random() * 0.2;

  // Age + matching height so first paint already has established tongues.
  const age = Math.random() * life * 0.92;

  return {
    x: s.x,
    y: s.y + rise * age,
    anchorX: s.x,
    vx: 0,
    rise,
    life,
    age,
    size,
    heat: top ? 0.82 + Math.random() * 0.18 : 0.55 + Math.random() * 0.3,
    seed: Math.random() * Math.PI * 2,
    front,
    stretch,
    zone: s.zone,
  };
}

export function makeEmber(
  pill: PillGeom,
  scale: number,
  columns = 14,
): FireEmber {
  const s = sampleEmitter(pill, columns);
  const rise = FIRE_BURN.riseEmber * scale;
  const life = FIRE_BURN.lifeEmber;
  const age = Math.random() * life * 0.85;
  return {
    x: s.x,
    y: s.y + rise * age,
    anchorX: s.x,
    rise,
    life,
    age,
    size: (1.1 + Math.random() * 1.2) * scale,
    phase: Math.random() * Math.PI * 2,
  };
}

/** Advance the sim before first paint so streams look established. */
export function prewarmFireSim(
  particles: FireParticle[],
  embers: FireEmber[],
  pill: PillGeom,
  cfg: FireSimConfig,
  seconds = 0.9,
): void {
  const dt = 1 / 30;
  let time = 0;
  for (let t = 0; t < seconds; t += dt) {
    time += dt;
    stepFireSim(particles, embers, pill, dt, time, cfg);
  }
}

export function stepFireSim(
  particles: FireParticle[],
  embers: FireEmber[],
  pill: PillGeom,
  dt: number,
  time: number,
  cfg: FireSimConfig,
): void {
  const { maxParticles, maxEmbers, scale } = cfg;
  const columns = cfg.columns ?? 14;

  while (particles.length < maxParticles) {
    particles.push(makeParticle(pill, Math.random() < 0.3, scale, columns));
  }
  if (embers.length < maxEmbers && Math.random() < 0.28) {
    embers.push(makeEmber(pill, scale, columns));
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles[i] = makeParticle(pill, p.front, scale, columns);
      continue;
    }
    // Constant vertical burn — fixed rise, no acceleration.
    p.y += p.rise * dt;

    // Shared sway tempo; only phase differs (seed). Amplitude stays small.
    const wobble =
      Math.sin(time * FIRE_BURN.swayFreq + p.seed) * 5 * scale;
    p.x += (p.anchorX + wobble - p.x) * Math.min(1, 10 * dt);
    const laneSlack = 9 * scale;
    if (p.x < p.anchorX - laneSlack) p.x = p.anchorX - laneSlack;
    if (p.x > p.anchorX + laneSlack) p.x = p.anchorX + laneSlack;
  }

  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.age += dt;
    if (e.age >= e.life) {
      embers.splice(i, 1);
      continue;
    }
    e.y += e.rise * dt;
    e.x =
      e.anchorX +
      Math.sin(time * FIRE_BURN.emberSwayFreq + e.phase) * 7 * scale;
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
  if (t >= 1) return;

  // Opacity envelope only — size stays stable so fade doesn't read as slowdown.
  const grow = t < 0.1 ? t / 0.1 : 1;
  const fade = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
  const a = grow * fade * (0.3 + p.heat * 0.4) * intensity;
  if (a < 0.02) return;

  // Tall narrow ellipse = readable flame tongue, not a wide aurora blot.
  const base = p.size;
  const rx = base * 0.42;
  const ry = base * p.stretch;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;

  drawSoftBlob(ctx, p.x, p.y, rx, ry, [
    [0, `rgba(255,${Math.floor(210 * p.heat)},55,1)`],
    [0.3, `rgba(255,${Math.floor(120 + 35 * p.heat)},16,0.8)`],
    [0.65, "rgba(255,60,5,0.32)"],
    [1, "rgba(40,0,0,0)"],
  ]);

  // Hot core near birth (close to the fuel line).
  if (t < 0.4) {
    const k = 1 - t / 0.4;
    ctx.globalAlpha = a * 0.85 * k;
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
  if (t >= 1) return;
  const tw = 0.6 + 0.4 * Math.sin(e.phase + e.age * 12);
  const a = (1 - t) * tw * intensity;
  if (a < 0.02) return;

  const s = e.size * (1.05 - t * 0.3);
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

export function drawFireBloom(
  ctx: CanvasRenderingContext2D,
  pill: PillGeom,
  _time: number,
  intensity = 1,
): void {
  // Thin rim warmth along the top — NOT a tall center-weighted curtain.
  const span = topSpan(pill);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity * 0.75;

  const g = ctx.createLinearGradient(span.left, span.y, span.right, span.y);
  // Even brightness across width (slight edge falloff only).
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

  // Soft contact glow hugging the pill edge.
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
