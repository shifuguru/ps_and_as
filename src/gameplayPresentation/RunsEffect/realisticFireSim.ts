/**
 * Shared particle fire simulation for the Runs! pill.
 *
 * Dense continuous fire wall (reference look): heavily overlapping soft
 * particles across the full rim — NOT discrete candle columns.
 * Ages wrap on a fixed conveyor so burn rate stays constant.
 */

export type FireZone = "top" | "left" | "right" | "bottom";

export type FireParticle = {
  x: number;
  y: number;
  originY: number;
  anchorX: number;
  rise: number;
  life: number;
  age: number;
  size: number;
  heat: number;
  seed: number;
  front: boolean;
  stretch: number;
  zone: FireZone;
  /** Soft horizontal drift amplitude (keeps wall continuous). */
  drift: number;
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
  scale: number;
  /** @deprecated ignored — wall uses dense span samples, not candle columns. */
  columns?: number;
  perColumn?: number;
};

/** Shared burn tempo — identical for every particle. */
export const FIRE_BURN = {
  // Shorter travel + denser samples = continuous band, not tall candles.
  riseTop: -55,
  riseSide: -32,
  riseBottom: -18,
  riseEmber: -48,
  lifeTop: 0.5,
  lifeSide: 0.4,
  lifeBottom: 0.34,
  lifeEmber: 0.85,
  swayFreq: 2.4,
  emberSwayFreq: 1.8,
} as const;

function topSpan(pill: PillGeom): { left: number; right: number; y: number } {
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  // Full width including into the round caps — continuous rim fire.
  return {
    left: pill.x - hw + hh * 0.05,
    right: pill.x + hw - hh * 0.05,
    y: pill.y - hh,
  };
}

/**
 * Build a dense fire wall: many overlapping samples across the rim with
 * evenly phased ages. Particles blend into one continuous flame, not candles.
 */
export function initFireField(
  pill: PillGeom,
  cfg: FireSimConfig,
): { particles: FireParticle[]; embers: FireEmber[] } {
  const scale = cfg.scale;
  const span = topSpan(pill);
  const width = Math.max(8, span.right - span.left);
  const particles: FireParticle[] = [];

  // Dense top wall — spacing << blob width so peaks fuse into one sheet.
  const topCount = Math.max(40, Math.round(width / (2.1 * scale)));
  const layers = 5; // more age layers → filled volume, fewer visible gaps

  for (let i = 0; i < topCount; i++) {
    const t = topCount <= 1 ? 0.5 : i / (topCount - 1);
    const anchorX = span.left + width * t;
    const originY = span.y + (Math.random() - 0.35) * 2 * scale;

    for (let layer = 0; layer < layers; layer++) {
      const rise = FIRE_BURN.riseTop * scale;
      const life = FIRE_BURN.lifeTop;
      const age = ((i * layers + layer) / (topCount * layers)) * life;
      // Wide + short: carpet of fire that blends sideways (not tall candles).
      const size = (16 + Math.random() * 12) * scale;
      const stretch = 0.85 + Math.random() * 0.45;

      particles.push({
        x: anchorX,
        y: originY + rise * age,
        originY,
        anchorX,
        rise,
        life,
        age,
        size,
        heat: 0.78 + Math.random() * 0.22,
        seed: Math.random() * Math.PI * 2,
        front: layer >= 3 && i % 5 === 0,
        stretch,
        zone: "top",
        drift: (2.5 + Math.random() * 2.5) * scale,
      });
    }
  }

  // Soft wrap on caps + bottom — shorter, still overlapping.
  const hw = pill.w / 2;
  const hh = pill.h / 2;
  const flat = Math.max(0, hw - hh);
  const wrapCount = Math.max(8, Math.round(topCount * 0.35));

  for (let i = 0; i < wrapCount; i++) {
    const u = i / Math.max(1, wrapCount - 1);
    for (const side of ["left", "right"] as const) {
      const a =
        side === "left"
          ? Math.PI * 0.55 + u * Math.PI * 0.9
          : -Math.PI * 0.45 + u * Math.PI * 0.9;
      const anchorX =
        pill.x + (side === "left" ? -flat : flat) + Math.cos(a) * hh;
      const originY = pill.y + Math.sin(a) * hh;
      const rise = FIRE_BURN.riseSide * scale;
      const life = FIRE_BURN.lifeSide;
      const age = (u * 0.5 + (side === "left" ? 0 : 0.5)) * life;
      particles.push({
        x: anchorX,
        y: originY + rise * age,
        originY,
        anchorX,
        rise,
        life,
        age,
        size: (10 + Math.random() * 7) * scale,
        heat: 0.55 + Math.random() * 0.3,
        seed: Math.random() * Math.PI * 2,
        front: false,
        stretch: 1.15 + Math.random() * 0.35,
        zone: side,
        drift: (2 + Math.random() * 2) * scale,
      });
    }
  }

  const bottomCount = Math.max(10, Math.round(topCount * 0.4));
  for (let i = 0; i < bottomCount; i++) {
    const t = bottomCount <= 1 ? 0.5 : i / (bottomCount - 1);
    const anchorX = span.left + width * t;
    const originY = pill.y + hh;
    const rise = FIRE_BURN.riseBottom * scale;
    const life = FIRE_BURN.lifeBottom;
    const age = (i / bottomCount) * life;
    particles.push({
      x: anchorX,
      y: originY + rise * age,
      originY,
      anchorX,
      rise,
      life,
      age,
      size: (9 + Math.random() * 6) * scale,
      heat: 0.5 + Math.random() * 0.3,
      seed: Math.random() * Math.PI * 2,
      front: false,
      stretch: 1.05 + Math.random() * 0.3,
      zone: "bottom",
      drift: (2 + Math.random() * 2.5) * scale,
    });
  }

  const embers: FireEmber[] = [];
  const emberCount = Math.max(12, Math.min(cfg.maxEmbers, Math.round(topCount * 0.7)));
  for (let i = 0; i < emberCount; i++) {
    const t = emberCount <= 1 ? 0.5 : i / (emberCount - 1);
    const anchorX = span.left + width * t + (Math.random() - 0.5) * 6 * scale;
    const originY = span.y;
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
      size: (1.1 + Math.random() * 1.4) * scale,
      phase: (i / emberCount) * Math.PI * 2,
    });
  }

  return { particles, embers };
}

/** @deprecated */
export function makeParticle(
  pill: PillGeom,
  front: boolean,
  scale: number,
  _columns = 14,
): FireParticle {
  const span = topSpan(pill);
  const rise = FIRE_BURN.riseTop * scale;
  const life = FIRE_BURN.lifeTop;
  return {
    x: pill.x,
    y: span.y,
    originY: span.y,
    anchorX: pill.x,
    rise,
    life,
    age: 0,
    size: 12 * scale,
    heat: 0.9,
    seed: 0,
    front,
    stretch: 1.4,
    zone: "top",
    drift: 3 * scale,
  };
}

/** @deprecated */
export function makeEmber(
  pill: PillGeom,
  scale: number,
  _columns = 14,
): FireEmber {
  const span = topSpan(pill);
  return {
    x: pill.x,
    y: span.y,
    originY: span.y,
    anchorX: pill.x,
    rise: FIRE_BURN.riseEmber * scale,
    life: FIRE_BURN.lifeEmber,
    age: 0,
    size: 1.2 * scale,
    phase: 0,
  };
}

export function prewarmFireSim(
  _particles: FireParticle[],
  _embers: FireEmber[],
  _pill: PillGeom,
  _cfg: FireSimConfig,
  _seconds = 0.9,
): void {
  // Field is already evenly phased at init.
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
    p.age += dt;
    if (p.age >= p.life) p.age -= p.life;

    // Constant rise from age — no acceleration, no respawn waves.
    p.y = p.originY + p.rise * p.age;
    // Soft shared-tempo sway; overlap stays high so the wall doesn't split
    // into candles.
    const wobble =
      Math.sin(time * FIRE_BURN.swayFreq + p.seed) * p.drift +
      Math.sin(time * FIRE_BURN.swayFreq * 0.5 + p.anchorX * 0.04) *
        1.5 *
        scale;
    p.x = p.anchorX + wobble;
  }

  for (let i = 0; i < embers.length; i++) {
    const e = embers[i];
    e.age += dt;
    if (e.age >= e.life) e.age -= e.life;
    e.y = e.originY + e.rise * e.age;
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
  const grow = t < 0.1 ? t / 0.1 : 1;
  const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  // Slightly higher base alpha so overlaps form a solid wall of fire.
  const a = grow * fade * (0.22 + p.heat * 0.32) * intensity;
  if (a < 0.015) return;

  // Favor width over height so neighbors fuse into a sheet.
  const rx = p.size * (0.85 + (1 - t) * 0.2);
  const ry = p.size * p.stretch * (0.7 + t * 0.2);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;

  drawSoftBlob(ctx, p.x, p.y, rx, ry, [
    [0, `rgba(255,${Math.floor(225 * p.heat)},80,1)`],
    [0.25, `rgba(255,${Math.floor(150 + 35 * p.heat)},30,0.88)`],
    [0.55, "rgba(255,95,12,0.45)"],
    [1, "rgba(50,5,0,0)"],
  ]);

  // Hot white-yellow core near the fuel line (young particles).
  if (t < 0.4) {
    const k = 1 - t / 0.4;
    ctx.globalAlpha = a * 0.85 * k;
    drawSoftBlob(ctx, p.x, p.y + ry * 0.2, rx * 0.55, ry * 0.42, [
      [0, "rgba(255,255,245,1)"],
      [0.4, `rgba(255,235,${Math.floor(140 * p.heat)},0.9)`],
      [1, "rgba(255,150,30,0)"],
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
  const tw = 0.7 + 0.3 * Math.sin(e.phase + (e.age / e.life) * Math.PI * 2);
  const a = Math.sin(t * Math.PI) * tw * intensity;
  if (a < 0.02) return;

  const s = e.size;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  drawSoftBlob(ctx, e.x, e.y, s * 2.4, s * 2.4, [
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
  // Continuous fuel ribbon under the particles — kills candle gaps.
  const span = topSpan(pill);
  const bandW = (span.right - span.left) * 0.52;
  const bandH = pill.h * 0.95;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intensity;

  // Hot white-yellow sheet along the entire top edge.
  const sheet = ctx.createLinearGradient(
    pill.x,
    span.y + bandH * 0.35,
    pill.x,
    span.y - bandH * 0.85,
  );
  sheet.addColorStop(0, "rgba(255,245,200,0.55)");
  sheet.addColorStop(0.25, "rgba(255,200,70,0.45)");
  sheet.addColorStop(0.55, "rgba(255,120,25,0.28)");
  sheet.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = sheet;
  ctx.beginPath();
  ctx.ellipse(pill.x, span.y - bandH * 0.15, bandW, bandH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Even horizontal fill so the ribbon never dips to dark gaps.
  const across = ctx.createLinearGradient(span.left, span.y, span.right, span.y);
  across.addColorStop(0, "rgba(255,140,30,0)");
  across.addColorStop(0.05, "rgba(255,170,50,0.35)");
  across.addColorStop(0.5, "rgba(255,190,70,0.4)");
  across.addColorStop(0.95, "rgba(255,170,50,0.35)");
  across.addColorStop(1, "rgba(255,140,30,0)");
  ctx.fillStyle = across;
  ctx.beginPath();
  ctx.ellipse(pill.x, span.y, bandW * 1.02, pill.h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  const rim = ctx.createRadialGradient(
    pill.x,
    pill.y,
    pill.h * 0.25,
    pill.x,
    pill.y,
    pill.w * 0.6,
  );
  rim.addColorStop(0, "rgba(255,190,70,0.16)");
  rim.addColorStop(0.55, "rgba(255,110,25,0.08)");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(pill.x, pill.y, pill.w * 0.62, pill.h * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
