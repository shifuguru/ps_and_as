import React, { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  drawFireBloom,
  drawFireEmber,
  drawFireParticle,
  initFireField,
  stepFireSim,
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

    // Room for tongues above a compact table badge (~half-pill height+).
    const padX = Math.max(22, width * 0.45);
    const padTop = Math.max(36, height * 2.1);
    const padBottom = Math.max(14, height * 0.55);
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

    // Dense continuous wall — overlapping blobs, not candle columns.
    const scale = Math.max(0.45, Math.min(0.8, width / 130));
    const cfg = {
      maxParticles: Math.max(90, Math.round(width * 2.2)),
      maxEmbers: Math.max(12, Math.round(width * 0.28)),
      scale,
    };
    const { particles, embers } = initFireField(pill, cfg);

    let raf = 0;
    let last = performance.now();
    let simTime = 0;
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
      // Fixed step → constant burn rate even when frames hitch.
      let frameDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = 1 / 60;
      while (frameDt > 0) {
        const dt = Math.min(step, frameDt);
        simTime += dt;
        stepFireSim(particles, embers, pill, dt, simTime, cfg);
        frameDt -= dt;
      }
      const intensityNow = Math.max(0, Math.min(1, intensityRef.current));

      ctx.clearRect(0, 0, cw, ch);
      if (intensityNow > 0.02) {
        drawFireBloom(ctx, pill, simTime, intensityNow * 0.85);
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
