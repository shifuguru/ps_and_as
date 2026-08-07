/**
 * Shared particle fire simulation for the Runs! pill.
 * Steady burn rate + teardrop flame tongues rooted on the fuel line.
 */

export type FireZone = "top" | "left" | "right" | "bottom";

export type FireParticle = {
  /** Anchor on the pill rim (fuel line). */
  originX: number;
  originY: number;
  x: number;
  y: number;
  life: number;
  age: number;
  /** Base width of the tongue. */
  width: number;
  /** Max tongue height. */
  height: number;
  heat: number;
  seed: number;
  front: boolean;
  zone: FireZone;
  /** Gentle sway — amplitude (px) and angular frequency. */
  swayAmp: number;
  swayFreq: number;
  /** Height flicker frequency (kept near sway for a steady burn). */
  flickerFreq: number;
  /** Slight lean in radians. */
  lean: number;
  /**
   * Phase offset so tongues don't pulse in lockstep,
   * while each still burns at the same tempo.
   */
  phase: number;
};

export type FireEmber = {
  x: number;
  y: number;
  /** Constant rise speed. */
  rise: number;
  life: number;
  age: number;
  size: number;
  phase: number;
  swayAmp: number;
  swayFreq: number;
  originX: number;
  originY: number;
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
};

export function rimSample(pill: PillGeom): { x: number; y: number; zone: FireZone } {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);
  const roll = Math.random();
  // Bias heavily to the top edge — that's where fire reads.
  if (roll < 0.74) {
    return {
      x: pill.x - flat + Math.random() * flat * 2,
      y: pill.y - hh + (Math.random() - 0.15) * 2,
      zone: "top",
    };
  }
  if (roll < 0.84) {
    const a = Math.PI * 0.7 + Math.random() * Math.PI * 0.6;
    return {
      x: pill.x - flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh * 0.7,
      zone: "left",
    };
  }
  if (roll < 0.94) {
    const a = -Math.PI * 0.3 + Math.random() * Math.PI * 0.6;
    return {
      x: pill.x + flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh * 0.7,
      zone: "right",
    };
  }
  return {
    x: pill.x - flat + Math.random() * flat * 2,
    y: pill.y + hh,
    zone: "bottom",
  };
}

export function makeParticle(
  pill: PillGeom,
  front: boolean,
  scale: number,
): FireParticle {
  const s = rimSample(pill);
  const top = s.zone === "top";
  const bottom = s.zone === "bottom";

  const height = top
    ? (40 + Math.random() * 30) * scale
    : bottom
      ? (12 + Math.random() * 8) * scale
      : (22 + Math.random() * 14) * scale;

  const width = top
    ? (8 + Math.random() * 6) * scale
    : (5 + Math.random() * 4) * scale;

  // Long-lived anchored tongues — they flicker in place, not race upward.
  const life = 1.8 + Math.random() * 1.4;

  return {
    originX: s.x,
    originY: s.y,
    x: s.x,
    y: s.y,
    life,
    age: Math.random() * life * 0.5,
    width,
    height,
    heat: top ? 0.85 + Math.random() * 0.15 : 0.55 + Math.random() * 0.3,
    seed: Math.random() * Math.PI * 2,
    front,
    zone: s.zone,
    swayAmp: (2 + Math.random() * 2.5) * scale,
    // Shared tempo band so nothing races ahead of its neighbors.
    swayFreq: 2.4 + Math.random() * 0.5,
    flickerFreq: 2.6 + Math.random() * 0.5,
    lean: (Math.random() - 0.5) * 0.18,
    phase: Math.random() * Math.PI * 2,
  };
}

export function makeEmber(pill: PillGeom, scale: number): FireEmber {
  const s = rimSample(pill);
  // Tight rise-speed band = constant burn feel for sparks.
  const rise = -(58 + Math.random() * 12) * scale;
  return {
    originX: s.x,
    originY: s.y,
    x: s.x,
    y: s.y,
    rise,
    life: 0.65 + Math.random() * 0.25,
    age: 0,
    size: (1.2 + Math.random() * 1.5) * scale,
    phase: Math.random() * Math.PI * 2,
    swayAmp: (5 + Math.random() * 6) * scale,
    swayFreq: 1.8 + Math.random() * 0.4,
  };
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

  while (particles.length < maxParticles) {
    particles.push(makeParticle(pill, Math.random() < 0.28, scale));
  }
  if (embers.length < maxEmbers && Math.random() < 0.2) {
    embers.push(makeEmber(pill, scale));
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles[i] = makeParticle(pill, p.front, scale);
      continue;
    }
    // Anchored to fuel — only tip sways. No vertical racing.
    const sway = Math.sin(time * p.swayFreq + p.phase) * p.swayAmp;
    p.x = p.originX + sway;
    p.y = p.originY;
  }

  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.age += dt;
    if (e.age >= e.life) {
      embers.splice(i, 1);
      continue;
    }
    const t = e.age / e.life;
    e.y = e.originY + e.rise * e.age;
    e.x =
      e.originX +
      Math.sin(time * e.swayFreq + e.phase) * e.swayAmp * (0.35 + t * 0.75);
  }
}

/** Teardrop flame path: wide base at y=0, pointed tip at y=-h. */
function flameTonguePath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -w * 0.9,
    -h * 0.1,
    -w * 0.55,
    -h * 0.45,
    -w * 0.16,
    -h * 0.8,
  );
  ctx.quadraticCurveTo(0, -h * 1.04, 0, -h);
  ctx.quadraticCurveTo(0, -h * 1.04, w * 0.16, -h * 0.8);
  ctx.bezierCurveTo(w * 0.55, -h * 0.45, w * 0.9, -h * 0.1, 0, 0);
  ctx.closePath();
}

/** Height envelope: steady burn with subtle flicker (amplitude, not speed). */
function tongueHeightScale(p: FireParticle, time: number): number {
  const t = Math.min(1, p.age / p.life);
  const birth = t < 0.12 ? t / 0.12 : 1;
  const death = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
  // Small flicker around a stable mean — campfire, not strobe.
  const flicker =
    0.9 + 0.1 * Math.sin(time * p.flickerFreq + p.phase * 1.3);
  return birth * death * flicker;
}

export function drawFireParticle(
  ctx: CanvasRenderingContext2D,
  p: FireParticle,
  intensity = 1,
  time = 0,
): void {
  const t = Math.min(1, p.age / p.life);
  if (t >= 1) return;

  const hScale = tongueHeightScale(p, time);
  const a = hScale * (0.62 + p.heat * 0.35) * intensity;
  if (a < 0.03) return;

  const h = p.height * hScale;
  const w = p.width * (1.02 - (1 - hScale) * 0.2);
  if (h < 2) return;

  ctx.save();
  ctx.translate(p.x, p.originY);
  ctx.rotate(p.lean + Math.sin(time * p.swayFreq + p.phase) * 0.05);
  ctx.globalAlpha = a;

  // Tight outer halo — close to the tongue so it doesn't sheet into aurora.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a * 0.28;
  ctx.scale(1.25, 1.05);
  ctx.fillStyle = "rgba(255, 85, 8, 0.45)";
  flameTonguePath(ctx, w, h);
  ctx.fill();
  ctx.restore();

  // Solid flame body with classic vertical heat gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  grad.addColorStop(0, `rgba(255, 248, 220, ${0.98 * p.heat})`);
  grad.addColorStop(0.16, "rgba(255, 215, 70, 0.96)");
  grad.addColorStop(0.4, "rgba(255, 140, 22, 0.9)");
  grad.addColorStop(0.7, "rgba(235, 60, 8, 0.5)");
  grad.addColorStop(1, "rgba(90, 15, 0, 0)");

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = grad;
  flameTonguePath(ctx, w, h);
  ctx.fill();

  // Hot white-yellow core at the fuel base.
  const coreH = h * 0.38;
  const coreW = w * 0.42;
  const core = ctx.createLinearGradient(0, 0, 0, -coreH);
  core.addColorStop(0, "rgba(255,255,248,0.95)");
  core.addColorStop(0.45, "rgba(255,225,95,0.75)");
  core.addColorStop(1, "rgba(255,140,30,0)");
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = core;
  flameTonguePath(ctx, coreW, coreH);
  ctx.fill();

  ctx.restore();
}

export function drawFireEmber(
  ctx: CanvasRenderingContext2D,
  e: FireEmber,
  intensity = 1,
): void {
  const t = e.age / e.life;
  if (t >= 1) return;
  const tw = 0.7 + 0.3 * Math.sin(e.phase + e.age * 9);
  const a = (1 - t) * tw * intensity;
  if (a < 0.02) return;

  const s = e.size * (1.05 - t * 0.25);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, s * 2.2);
  g.addColorStop(0, "rgba(255,240,170,1)");
  g.addColorStop(0.45, "rgba(255,160,40,0.75)");
  g.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y, s * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFireBloom(
  ctx: CanvasRenderingContext2D,
  pill: PillGeom,
  _time: number,
  intensity = 1,
): void {
  // Tight warm kiss on the rim — not a tall curtain.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity * 0.65;
  const g = ctx.createRadialGradient(
    pill.x,
    pill.y - pill.h * 0.1,
    pill.h * 0.15,
    pill.x,
    pill.y - pill.h * 0.1,
    pill.w * 0.5,
  );
  g.addColorStop(0, "rgba(255,175,55,0.2)");
  g.addColorStop(0.55, "rgba(255,95,18,0.07)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(
    pill.x,
    pill.y - pill.h * 0.05,
    pill.w * 0.55,
    pill.h * 0.75,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}
