/** Hand → table pile: lift → rotate → travel → ease-out → settle. */
export const PLAY_CARD_FLIGHT_MS = 360;

export type PlayFlightMotionVariance = {
  durationMs: number;
  liftPx: number;
  peakRotateDeg: number;
};

/** Deterministic per-play micro-variation so flights don't feel cloned. */
export function playFlightMotionVariance(flightId: string): PlayFlightMotionVariance {
  let hash = 0;
  for (let i = 0; i < flightId.length; i++) {
    hash = (hash * 31 + flightId.charCodeAt(i)) | 0;
  }
  const u = ((hash >>> 0) % 1000) / 1000;
  const v = (((hash >>> 10) >>> 0) % 1000) / 1000;
  const w = (((hash >>> 20) >>> 0) % 1000) / 1000;
  return {
    durationMs: PLAY_CARD_FLIGHT_MS + Math.round((u - 0.5) * 40),
    liftPx: 8 + Math.round((v - 0.5) * 2),
    peakRotateDeg: 1 + (w - 0.5) * 0.4,
  };
}
