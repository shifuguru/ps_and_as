/** Shared play-area geometry for table, seats, and card pile. */

import {
  computeSeatDimensions,
  computeSeatTableGap,
  SIDE_ANCHOR_CENTER_BLEND,
  type SeatDimensions,
} from "./seatDimensions";

/** @deprecated Use layout.localBandHeight from computePlayAreaLayout. */
export const LOCAL_SEAT_BAND = 88;
/** Pushes the local player avatar up toward the table center (away from the action bar). */
export const LOCAL_SEAT_TABLE_LIFT = 40;
export const PLAY_TYPE_PILL_BAND = 12;
/** @deprecated Use layout seat footprint from computePlayAreaLayout. */
export const SEAT_FOOTPRINT_H = 92;
/** @deprecated Use layout seat footprint from computePlayAreaLayout. */
export const SEAT_FOOTPRINT_W = 76;
export const OPPONENT_TOP_PAD = 30;
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
  /** Distance from ring center to opponent avatar centers. */
  radius: number;
  totalPlayers: number;
};

export type PlayAreaLayout = {
  width: number;
  height: number;
  aspect: number;
  isCompact: boolean;
  isVeryCompact: boolean;
  isTall: boolean;
  isWide: boolean;
  isStretchy: boolean;
  cardZoneTop: number;
  cardZoneHeight: number;
  cardZoneLeft: number;
  cardZoneWidth: number;
  cardZoneCenterX: number;
  cardZoneCenterY: number;
  /** Gap from card-table bounding circle to avatar orbit (clamped min–max). */
  seatTableGap: number;
  /** Horizontal inset when side seats anchor to screen edges. */
  sideAnchorMargin: number;
  localBandHeight: number;
  seatFootprintW: number;
  seatFootprintH: number;
  seatDimensions: SeatDimensions;
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

export type OpponentSeatPlacement = {
  cx: number;
  cy: number;
  radius: number;
  arenaWidth: number;
  footprintW: number;
  footprintH: number;
  sideAnchorMargin: number;
  /** Pin left/right seats to screen edges (default true). */
  anchorSides?: boolean;
};

/** Inset from the screen edge for side-anchored seats. */
export function sideAnchorMarginForWidth(width: number, isWide: boolean): number {
  void isWide;
  if (width < 400) return 0;
  if (width < 640) return 2;
  if (width < 1024) return 4;
  return 6;
}

/**
 * Seat position on the opponent ring. Left/right seats (≈90° / 270°) anchor
 * to the screen edge; top seats stay on the circular orbit.
 */
export function opponentSeatPosition(
  angleDeg: number,
  placement: OpponentSeatPlacement,
): { left: number; top: number } {
  const {
    cx,
    cy,
    radius,
    arenaWidth,
    footprintW,
    footprintH,
    sideAnchorMargin,
    anchorSides = true,
  } = placement;

  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  let left = cx + radius * sin - footprintW / 2;
  const top = cy - radius * cos - footprintH / 2;

  if (anchorSides && Math.abs(sin) > 0.82) {
    const edgeLeft =
      sin > 0
        ? arenaWidth - sideAnchorMargin - footprintW
        : sideAnchorMargin;
    left = edgeLeft + (left - edgeLeft) * SIDE_ANCHOR_CENTER_BLEND;
  }

  return { left, top };
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
  options?: { sideAnchorMargin?: number; anchorSides?: boolean },
): { left: number; top: number } {
  void minTop;
  void arenaHeight;
  return opponentSeatPosition(angleDeg, {
    cx,
    cy,
    radius,
    arenaWidth,
    footprintW,
    footprintH,
    sideAnchorMargin: options?.sideAnchorMargin ?? 4,
    anchorSides: options?.anchorSides ?? true,
  });
}

/** Max ring radius that keeps every seat slot inside the arena (top seat is tightest). */
function maxSafeRingRadius(
  ringCy: number,
  width: number,
  ringBandBottom: number,
  seat: Pick<SeatDimensions, "footprintW" | "footprintH">,
  minTop: number,
  sideMargin: number,
): number {
  const roleBadgeTop = 8;
  const nameStackBelow = 20;
  const maxFromTop = ringCy - minTop - roleBadgeTop - seat.footprintH * 0.48;
  const maxFromBottom =
    ringBandBottom - ringCy - seat.footprintH * 0.52 - nameStackBelow;
  const maxFromX = width / 2 - seat.footprintW / 2 - sideMargin;
  return Math.max(52, Math.min(maxFromTop, maxFromBottom, maxFromX));
}

/**
 * Layout the card zone inside a seat ring that expands outward from the table
 * on roomier screens, always capped so the top opponent stays visible.
 */
export function computePlayAreaLayout(
  width: number,
  height: number,
  totalPlayers = 4,
): PlayAreaLayout {
  const aspect = height / Math.max(width, 1);
  const isCompact = height < 560;
  const isVeryCompact = height < 400;
  const isTall = aspect > 2.15;
  const isWide = width >= 640;

  const seat = computeSeatDimensions(width, height);
  const cx = width / 2;
  const sideMargin = isWide ? 12 : 8;
  const minTop = OPPONENT_TOP_PAD;
  const ringBandBottom = height - RING_BOTTOM_PAD;
  const verticalBudget = ringBandBottom - minTop;

  const ringTopY = minTop + seat.footprintH * 0.25;
  const ringBottomY = ringBandBottom - seat.footprintH * 0.38;
  const ringCy = (ringTopY + ringBottomY) / 2;

  const seatReach =
    Math.max(seat.footprintW, seat.footprintH) * RING_SEAT_INSET;

  const maxCardW = width - sideMargin * 2;
  const widthRatio = isWide ? 0.8 : isVeryCompact ? 0.88 : isCompact ? 0.86 : 0.84;
  const heightRatio = isWide ? 0.58 : isVeryCompact ? 0.46 : isCompact ? 0.5 : 0.52;

  const minCardZone = isVeryCompact ? 96 : isCompact ? 112 : 128;
  const maxCardZoneW = isWide ? 300 : isVeryCompact ? 210 : 260;
  const maxCardZoneH = isWide ? 280 : isVeryCompact ? 200 : 250;

  let cardZoneWidth = clamp(
    Math.round(maxCardW * widthRatio),
    minCardZone,
    maxCardZoneW,
  );
  let cardZoneHeight = clamp(
    Math.round(verticalBudget * heightRatio),
    minCardZone,
    maxCardZoneH,
  );

  const cardZoneTop = clamp(
    ringCy - cardZoneHeight / 2,
    minTop + 4,
    ringBandBottom - cardZoneHeight - 4,
  );
  const cardZoneCenterY = cardZoneTop + cardZoneHeight / 2;

  const maxRingRadius = maxSafeRingRadius(
    cardZoneCenterY,
    width,
    ringBandBottom,
    seat,
    minTop,
    sideMargin,
  );

  const { gap: seatTableGap } = computeSeatTableGap(
    width,
    height,
    cardZoneWidth,
    cardZoneHeight,
    cardZoneTop,
    seat,
    { minTop, ringBandBottom, sideMargin },
  );

  const maxCardClear = Math.max(
    40,
    maxRingRadius - seatReach - seatTableGap,
  );
  let cardClearRadius = Math.hypot(cardZoneWidth / 2, cardZoneHeight / 2);
  if (cardClearRadius > maxCardClear) {
    const scale = maxCardClear / cardClearRadius;
    cardZoneWidth = Math.max(minCardZone, Math.round(cardZoneWidth * scale));
    cardZoneHeight = Math.max(minCardZone, Math.round(cardZoneHeight * scale));
    cardClearRadius = Math.hypot(cardZoneWidth / 2, cardZoneHeight / 2);
  }

  const desiredRingRadius = cardClearRadius + seatReach + seatTableGap;
  const ringRadius = Math.min(desiredRingRadius, maxRingRadius);

  const cardZoneLeft = cx - cardZoneWidth / 2;

  const playAnchorX = cx;
  const playAnchorY = cardZoneTop + cardZoneHeight * 0.44;
  const isStretchy = cardZoneHeight > 240;
  const sideAnchorMargin = sideAnchorMarginForWidth(width, isWide);

  return {
    width,
    height,
    aspect,
    isCompact,
    isVeryCompact,
    isTall,
    isWide,
    isStretchy,
    cardZoneTop,
    cardZoneHeight,
    cardZoneLeft,
    cardZoneWidth,
    cardZoneCenterX: cx,
    cardZoneCenterY,
    seatTableGap,
    sideAnchorMargin,
    localBandHeight: seat.localBand,
    seatFootprintW: seat.footprintW,
    seatFootprintH: seat.footprintH,
    seatDimensions: seat,
    playAnchorX,
    playAnchorY,
    opponentRing: {
      mode: "ring",
      minTop,
      cx,
      cy: cardZoneCenterY,
      radius: ringRadius,
      totalPlayers,
    },
  };
}

export function tableScaleLimits(
  layout: Pick<PlayAreaLayout, "isCompact" | "isTall" | "isWide" | "isStretchy"> & {
    isVeryCompact?: boolean;
  },
): {
  displayScale: number;
  maxFillScale: number;
} {
  if (layout.isVeryCompact) {
    return { displayScale: 0.92, maxFillScale: 1.34 };
  }
  if (layout.isStretchy) {
    return { displayScale: 1, maxFillScale: 1.52 };
  }
  if (layout.isCompact) {
    return { displayScale: 0.98, maxFillScale: 1.46 };
  }
  if (layout.isTall) {
    return { displayScale: 1, maxFillScale: 1.5 };
  }
  if (layout.isWide) {
    return { displayScale: 1, maxFillScale: 1.56 };
  }
  return { displayScale: 1, maxFillScale: 1.48 };
}

export function opponentRowPositions(
  count: number,
  width: number,
  rowY: number,
  rowSpan: number,
  footprintW = SEAT_FOOTPRINT_W,
): Array<{ left: number; top: number }> {
  if (count <= 0) return [];
  const startX = (width - rowSpan) / 2;
  const step = count <= 1 ? 0 : rowSpan / (count - 1);
  return Array.from({ length: count }, (_, i) => ({
    left: startX + i * step - footprintW / 2,
    top: rowY,
  }));
}
