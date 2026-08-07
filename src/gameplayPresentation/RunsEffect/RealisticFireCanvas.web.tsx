import React, { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  drawFireBloom,
  drawFireEmber,
  drawFireParticle,
  makeEmber,
  makeParticle,
  stepFireSim,
  type FireEmber,
  type FireParticle,
  type PillGeom,
} from "./realisticFireSim";

type Props = {
  width: number;
  height: number;
  active?: boolean;
  /** 0–1 master intensity (idle settle / ignition). */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Web canvas fire wrapped around the Runs! pill.
 * Pads the canvas so plumes can rise above the glass without clipping.
 */
export default function RealisticFireCanvas({
  width,
  height,
  active = true,
  intensity = 1,
  style,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(intensity);
  const [hostReady, setHostReady] = useState(false);
  intensityRef.current = intensity;

  useEffect(() => {
    if (!active || width <= 0 || height <= 0 || !hostReady) return;
    const host = hostRef.current;
    if (!host) return;

    const padX = Math.max(28, width * 0.55);
    const padTop = Math.max(48, height * 2.4);
    const padBottom = Math.max(18, height * 0.7);
    const cw = Math.ceil(width + padX * 2);
    const ch = Math.ceil(height + padTop + padBottom);

    const canvas = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.style.position = "absolute";
    canvas.style.left = `${-padX}px`;
    canvas.style.top = `${-padTop}px`;
    canvas.style.pointerEvents = "none";
    host.appendChild(canvas);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      host.removeChild(canvas);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pill: PillGeom = {
      x: padX + width / 2,
      y: padTop + height / 2,
      w: width,
      h: height,
    };

    // Even columns across the badge; denser streams, smaller blobs.
    const scale = Math.max(0.3, Math.min(0.58, width / 210));
    const columns = Math.max(10, Math.round(width / 7));
    const cfg = {
      maxParticles: Math.round(columns * 8),
      maxEmbers: Math.round(10 + width * 0.06),
      scale,
      columns,
    };

    const particles: FireParticle[] = [];
    const embers: FireEmber[] = [];
    for (let i = 0; i < cfg.maxParticles; i++) {
      particles.push(makeParticle(pill, Math.random() < 0.28, scale, columns));
    }
    for (let i = 0; i < Math.min(10, cfg.maxEmbers); i++) {
      embers.push(makeEmber(pill, scale, columns));
    }

    let raf = 0;
    let last = performance.now();
    let alive = true;

    const roundRectPath = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
    ) => {
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    };

    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      const intensityNow = Math.max(0, Math.min(1, intensityRef.current));

      stepFireSim(particles, embers, pill, dt, time, cfg);

      ctx.clearRect(0, 0, cw, ch);
      if (intensityNow > 0.02) {
        drawFireBloom(ctx, pill, time, intensityNow * 0.85);
        for (const p of particles) {
          if (!p.front) drawFireParticle(ctx, p, intensityNow);
        }
        for (const e of embers) drawFireEmber(ctx, e, intensityNow);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, cw, ch);
        const insetX = pill.w / 2 - 3;
        const insetY = pill.h / 2 - 2;
        roundRectPath(
          ctx,
          pill.x - insetX,
          pill.y - insetY,
          insetX * 2,
          insetY * 2,
          Math.max(2, insetY),
        );
        ctx.clip("evenodd");
        for (const p of particles) {
          if (p.front) drawFireParticle(ctx, p, intensityNow * 0.9);
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, [active, width, height, hostReady]);

  if (!active || width <= 0 || height <= 0) {
    return null;
  }

  const flatStyle = Object.assign(
    {
      position: "absolute" as const,
      left: 0,
      top: 0,
      width,
      height,
      overflow: "visible" as const,
      zIndex: 1,
      pointerEvents: "none" as const,
    },
    style as object,
  );

  return (
    <div
      ref={(node) => {
        hostRef.current = node;
        setHostReady(!!node);
      }}
      style={flatStyle}
    />
  );
}
