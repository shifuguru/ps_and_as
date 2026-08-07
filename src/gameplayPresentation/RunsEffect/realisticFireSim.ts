/**
 * Shared particle fire simulation for the Runs! pill.
 * Used by the web canvas layer (and HTML design previews).
 */

export type FireZone = "top" | "left" | "right" | "bottom";

export type FireParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  vx: number;
  vy: number;
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
};

const HASH = new Float32Array(256);
for (let i = 0; i < 256; i++) HASH[i] = Math.random() * 2 - 1;

function noise1(x: number): number {
  const i = Math.floor(x) & 255;
  const f = x - Math.floor(x);
  const u = f * f * (3 - 2 * f);
  return HASH[i] * (1 - u) + HASH[(i + 1) & 255] * u;
}

export function noise2(x: number, y: number): number {
  return noise1(x + noise1(y * 1.71) * 19.3);
}

export function rimSample(pill: PillGeom): { x: number; y: number; zone: FireZone } {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);
  const roll = Math.random();
  if (roll < 0.6) {
    return {
      x: pill.x - flat + Math.random() * flat * 2,
      y: pill.y - hh + (Math.random() - 0.35) * 4,
      zone: "top",
    };
  }
  if (roll < 0.74) {
    const a = Math.PI * 0.55 + Math.random() * Math.PI * 0.9;
    return {
      x: pill.x - flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh,
      zone: "left",
    };
  }
  if (roll < 0.88) {
    const a = -Math.PI * 0.45 + Math.random() * Math.PI * 0.9;
    return {
      x: pill.x + flat + Math.cos(a) * hh,
      y: pill.y + Math.sin(a) * hh,
      zone: "right",
    };
  }
  return {
    x: pill.x - flat + Math.random() * flat * 2,
    y: pill.y + hh + (Math.random() - 0.55) * 3,
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
  // Mix wide soft bloom blobs with narrow tall tongues for organic edges.
  const tongue = top && Math.random() < 0.45;
  return {
    x: s.x + (Math.random() - 0.5) * 4,
    y: s.y + (Math.random() - 0.5) * 2,
    vx: (Math.random() - 0.5) * (top ? 26 : 12) * scale,
    vy:
      (top
        ? -(60 + Math.random() * (tongue ? 120 : 90))
        : bottom
          ? -(8 + Math.random() * 18)
          : -(22 + Math.random() * 48)) * scale,
    life: top
      ? 0.42 + Math.random() * (tongue ? 0.95 : 0.7)
      : 0.28 + Math.random() * 0.42,
    age: Math.random() * 0.12,
    size:
      (top
        ? tongue
          ? 10 + Math.random() * 18
          : 20 + Math.random() * 36
        : bottom
          ? 10 + Math.random() * 14
          : 12 + Math.random() * 20) * scale,
    heat: top ? 0.8 + Math.random() * 0.2 : 0.5 + Math.random() * 0.4,
    seed: Math.random() * 1000,
    front,
    stretch: tongue ? 1.8 + Math.random() * 1.4 : 1.1 + Math.random() * 0.7,
    zone: s.zone,
  };
}

export function makeEmber(pill: PillGeom, scale: number): FireEmber {
  const s = rimSample(pill);
  return {
    x: s.x,
    y: s.y,
    vx: (Math.random() - 0.5) * 30 * scale,
    vy: -(50 + Math.random() * 95) * scale,
    life: 0.6 + Math.random() * 1.1,
    age: 0,
    size: (1.0 + Math.random() * 2.2) * scale,
    phase: Math.random() * Math.PI * 2,
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
    particles.push(makeParticle(pill, Math.random() < 0.3, scale));
  }
  if (embers.length < maxEmbers && Math.random() < 0.5) {
    embers.push(makeEmber(pill, scale));
  }

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles[i] = makeParticle(pill, p.front, scale);
      continue;
    }
    const t = p.age / p.life;
    const turb =
      noise2(p.seed + time * 2.4, p.y * 0.022) * (40 + t * 70) * scale;
    const flutter = noise2(p.y * 0.04 + p.seed, time * 3.1) * 22 * scale;
    p.vx += (turb + flutter) * dt;
    p.vx += Math.sin(time * 5.2 + p.seed * 1.7) * 14 * scale * dt;
    p.vy += (-16 - (1 - t) * 26) * scale * dt;
    // Tip shear — older particles peel sideways like real flame tongues.
    p.vx += (t * t) * noise2(time * 1.3, p.seed) * 35 * scale * dt;
    p.vx *= 1 - 0.55 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x += (p.x - pill.x) * 0.1 * dt;
  }

  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.age += dt;
    if (e.age >= e.life) {
      embers.splice(i, 1);
      continue;
    }
    e.vx += noise2(e.x * 0.04, time * 2.2) * 42 * scale * dt;
    e.vy -= 18 * scale * dt;
    e.vx *= 1 - 0.35 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
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
  const fade = 1 - t;
  const a = fade * fade * (0.2 + p.heat * 0.36) * intensity;
  if (a < 0.01) return;

  const base = p.size * (0.7 + fade * 0.55);
  const rx = base * (0.55 + (1 - p.heat) * 0.15);
  const ry = base * p.stretch * (0.9 + t * 0.65);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  drawSoftBlob(ctx, p.x, p.y, rx, ry, [
    [0, `rgba(255,${Math.floor(200 * p.heat)},40,1)`],
    [0.35, `rgba(255,${Math.floor(110 + 40 * p.heat)},12,0.75)`],
    [0.7, "rgba(255,55,0,0.28)"],
    [1, "rgba(40,0,0,0)"],
  ]);
  if (t < 0.45) {
    const k = 1 - t / 0.45;
    ctx.globalAlpha = a * 0.9 * k;
    drawSoftBlob(ctx, p.x, p.y + ry * 0.12, rx * 0.42, ry * 0.38, [
      [0, "rgba(255,255,235,1)"],
      [0.4, `rgba(255,230,${Math.floor(120 * p.heat)},0.85)`],
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
  const tw = 0.5 + 0.5 * Math.sin(e.phase + e.age * 16);
  const a = (1 - t) * tw * intensity;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  const s = e.size * (1.1 - t * 0.35);
  drawSoftBlob(ctx, e.x, e.y, s * 2.8, s * 2.8, [
    [0, "rgba(255,245,180,1)"],
    [0.35, "rgba(255,170,50,0.8)"],
    [1, "rgba(255,60,0,0)"],
  ]);
  ctx.restore();
}

export function drawFireBloom(
  ctx: CanvasRenderingContext2D,
  pill: PillGeom,
  time: number,
  intensity = 1,
): void {
  const pulse = 0.92 + 0.08 * Math.sin(time * 3.4);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity;
  drawSoftBlob(
    ctx,
    pill.x,
    pill.y - pill.h * 0.55,
    pill.w * 0.95 * pulse,
    pill.h * 2.4 * pulse,
    [
      [0, "rgba(255,190,70,0.28)"],
      [0.35, "rgba(255,110,20,0.16)"],
      [0.7, "rgba(255,50,0,0.06)"],
      [1, "rgba(0,0,0,0)"],
    ],
  );
  drawSoftBlob(ctx, pill.x, pill.y, pill.w * 0.62, pill.h * 0.95, [
    [0, "rgba(255,200,90,0.2)"],
    [0.55, "rgba(255,120,30,0.08)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  ctx.restore();
}
