/** Shared play-area geometry for table, seats, and card pile. */

export const LOCAL_SEAT_BAND = 88;
export const PLAY_TYPE_PILL_BAND = 12;
export const SEAT_FOOTPRINT_H = 92;
export const SEAT_FOOTPRINT_W = 76;
export const OPPONENT_TOP_PAD = 30;
/** Gap between opponent avatars and the card pile. */
export const CARD_RING_GAP = 20;
/** How far a seat avatar extends toward the table center from its ring position. */
export const RING_SEAT_INSET = 0.5;
export const RING_BOTTOM_PAD = 8;

/** Local seat sits at the bottom of the ring (6 o'clock). */
export const LOCAL_RING_ANGLE = 180;

export type OpponentRingLayout = {
  mode: "ring";
  minTop: number;
  cx: number;
  cy: number;
  /** Single radius — equal rx/ry so equal angle steps form a circle, not a diamond. */
  radius: number;
  totalPlayers: number;
};

export type PlayAreaLayout = {
  width: number;
  height: number;
  aspect: number;
  isCompact: boolean;
  isTall: boolean;
  isWide: boolean;
  isStretchy: boolean;
  cardZoneTop: number;
  cardZoneHeight: number;
  cardZoneLeft: number;
  cardZoneWidth: number;
  localBandHeight: number;
  playAnchorX: number;
  playAnchorY: number;
  opponentRing: OpponentRingLayout;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Evenly divide the ring — seat 0 is local (bottom), then clockwise in turn order.
 * 0° = top, 90° = right, 180° = bottom.
 */
export function ringAngleForSeat(seatIndex: number, totalPlayers: number): number {
  if (totalPlayers <= 0) return LOCAL_RING_ANGLE;
  const step = 360 / totalPlayers;
  return (LOCAL_RING_ANGLE + seatIndex * step) % 360;
}

/** Angles for opponents only (seats 1 … N−1). */
export function opponentRingAngles(totalPlayers: number): number[] {
  if (totalPlayers <= 1) return [];
  return Array.from({ length: totalPlayers - 1 }, (_, i) =>
    ringAngleForSeat(i + 1, totalPlayers),
  );
}

export function polarSeatPosition(
  angleDeg: number,
  cx: number,
  cy: number,
  radius: number,
  minTop: number,
  arenaWidth: number,
  arenaHeight: number,
  footprintW = SEAT_FOOTPRINT_W,
  footprintH = SEAT_FOOTPRINT_H,
): { left: number; top: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + radius * Math.sin(rad) - footprintW / 2;
  const y = cy - radius * Math.cos(rad) - footprintH / 2;
  return { left: x, top: y };
}

/**
 * Layout the card zone and ring inside the play area.
 * Local player is rendered separately above the hand (GameScreen overlay).
 * The play area already excludes the bottom hand sheet — use its full height.
 */
export function computePlayAreaLayout(
  width: number,
  height: number,
  totalPlayers = 4,
): PlayAreaLayout {
  const aspect = height / Math.max(width, 1);
  const isCompact = height < 520;
  const isTall = aspect > 2.15;
  const isWide = width >= 640;

  const localBandHeight = LOCAL_SEAT_BAND;
  const cx = width / 2;
  const sideMargin = isWide ? 12 : 8;
  const minTop = OPPONENT_TOP_PAD;

  // Opponents only — local seat is outside this view (screen overlay above hand).
  const ringTopY = minTop + SEAT_FOOTPRINT_H * 0.25;
  const ringBottomY =
    height - SEAT_FOOTPRINT_H * 0.38 - RING_BOTTOM_PAD;

  const maxRadiusX = Math.max(
    48,
    width / 2 - SEAT_FOOTPRINT_W / 2 - sideMargin,
  );
  const maxRadiusY = Math.max(48, (ringBottomY - ringTopY) / 2);
  const maxRadius = Math.min(maxRadiusX, maxRadiusY);
  const radius =
    maxRadius <= 48 ? maxRadius : clamp(maxRadius * 0.97, 48, maxRadius);
  const cy = (ringTopY + ringBottomY) / 2;

  const seatReach =
    Math.max(SEAT_FOOTPRINT_W, SEAT_FOOTPRINT_H) * RING_SEAT_INSET;
  const innerRadius = Math.max(44, radius - seatReach - CARD_RING_GAP);
  const cardZoneWidth = Math.min(
    width - sideMargin * 2,
    Math.round(innerRadius * 2),
  );
  const cardZoneLeft = cx - cardZoneWidth / 2;
  const minCardZone = isCompact ? 112 : 128;
  const maxCardZone = isWide ? 280 : 250;
  const cardZoneHeight = Math.min(
    clamp(Math.round(innerRadius * 1.55), minCardZone, maxCardZone),
    Math.round(innerRadius * 1.85),
  );
  const cardZoneTop = clamp(
    cy - cardZoneHeight / 2,
    minTop + 4,
    ringBottomY - cardZoneHeight,
  );

  const playAnchorX = cx;
  const playAnchorY = cardZoneTop + cardZoneHeight * 0.44;
  const isStretchy = cardZoneHeight > 240;

  return {
    width,
    height,
    aspect,
    isCompact,
    isTall,
    isWide,
    isStretchy,
    cardZoneTop,
    cardZoneHeight,
    cardZoneLeft,
    cardZoneWidth,
    localBandHeight,
    playAnchorX,
    playAnchorY,
    opponentRing: {
      mode: "ring",
      minTop,
      cx,
      cy,
      radius,
      totalPlayers,
    },
  };
}

export function tableScaleLimits(
  layout: Pick<PlayAreaLayout, "isCompact" | "isTall" | "isWide" | "isStretchy">,
): {
  displayScale: number;
  maxFillScale: number;
} {
  if (layout.isStretchy) {
    return { displayScale: 0.96, maxFillScale: 1.44 };
  }
  if (layout.isCompact) {
    return { displayScale: 0.94, maxFillScale: 1.38 };
  }
  if (layout.isTall) {
    return { displayScale: 0.96, maxFillScale: 1.42 };
  }
  if (layout.isWide) {
    return { displayScale: 1, maxFillScale: 1.48 };
  }
  return { displayScale: 0.96, maxFillScale: 1.4 };
}

export function opponentRowPositions(
  count: number,
  width: number,
  rowY: number,
  rowSpan: number,
): Array<{ left: number; top: number }> {
  if (count <= 0) return [];
  const startX = (width - rowSpan) / 2;
  const step = count <= 1 ? 0 : rowSpan / (count - 1);
  return Array.from({ length: count }, (_, i) => ({
    left: startX + i * step - SEAT_FOOTPRINT_W / 2,
    top: rowY,
  }));
}
