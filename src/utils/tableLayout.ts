/** Shared play-area geometry for table, seats, and card pile. */

export const LOCAL_SEAT_BAND = 88;
/** Avatar + name label — used for collision / clipping math */
export const SEAT_FOOTPRINT_H = 92;
export const SEAT_FOOTPRINT_W = 76;
export const OPPONENT_TOP_PAD = 30;

export type OpponentRingLayout = {
  mode: "row" | "arc";
  minTop: number;
  /** Flat row — all opponents share this Y */
  rowY: number;
  rowSpan: number;
  /** Arc fallback for 5+ seats */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type PlayAreaLayout = {
  width: number;
  height: number;
  /** Height / width of the play area */
  aspect: number;
  isCompact: boolean;
  isTall: boolean;
  isWide: boolean;
  isStretchy: boolean;
  cardZoneTop: number;
  cardZoneHeight: number;
  localBandHeight: number;
  opponentRing: OpponentRingLayout;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Derive fixed layout zones from play-area size.
 *
 * Targets:
 * - iPhone 12 / 16 Pro Max portrait (~360–430 × 420–520 play area)
 * - Tall desktop column (aspect > ~2.2)
 * - Wide desktop (width >= 640)
 */
export function computePlayAreaLayout(
  width: number,
  height: number,
  opponentCount = 3,
  /** Distance from play-area bottom to the bottom edge of the local seat */
  localSeatAnchorFromBottom = 0,
): PlayAreaLayout {
  const aspect = height / Math.max(width, 1);
  const isCompact = height < 520;
  const isTall = aspect > 2.15;
  const isWide = width >= 640;

  const localBandHeight = LOCAL_SEAT_BAND;
  const localTop = height - localSeatAnchorFromBottom - localBandHeight;

  const cx = width / 2;
  const rowY = OPPONENT_TOP_PAD;
  const rowSpan = isWide
    ? clamp(width * 0.72, 280, 480)
    : clamp(width * 0.76, 220, 340);
  const opponentRowBottom = rowY + SEAT_FOOTPRINT_H;

  const useArc = opponentCount >= 5;
  let ry = 28;
  let cy = rowY + SEAT_FOOTPRINT_H * 0.5 + ry;
  let rx = rowSpan * 0.5;

  const gapTop = isCompact ? 10 : isWide ? 16 : 14;
  const gapBottom = 6;

  const sandwichTop = opponentRowBottom + gapTop;
  const sandwichBottom = localTop - gapBottom;
  const sandwichHeight = Math.max(80, sandwichBottom - sandwichTop);

  const isStretchy = sandwichHeight > 260;
  const minCardZone = isCompact ? 96 : 110;
  let cardZoneHeight = isStretchy
    ? clamp(Math.round(sandwichHeight * 0.5), minCardZone, 300)
    : sandwichHeight;
  cardZoneHeight = Math.max(minCardZone, cardZoneHeight);

  const cardZoneTop =
    sandwichTop + Math.max(0, (sandwichHeight - cardZoneHeight) / 2);

  if (useArc) {
    const sideAnchorY = cardZoneTop + cardZoneHeight * 0.14;
    cy = sideAnchorY + SEAT_FOOTPRINT_H / 2;
    ry = Math.max(52, cy - OPPONENT_TOP_PAD - SEAT_FOOTPRINT_H / 2);
    rx = Math.max(
      rowSpan * 0.52,
      width / 2 - SEAT_FOOTPRINT_W / 2 - 8,
    );
  }

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
    localBandHeight,
    opponentRing: {
      mode: useArc ? "arc" : "row",
      minTop: OPPONENT_TOP_PAD,
      rowY,
      rowSpan,
      cx,
      cy,
      rx,
      ry,
    },
  };
}

/** Scale caps for the table card pile based on play-area shape. */
export function tableScaleLimits(
  layout: Pick<PlayAreaLayout, "isCompact" | "isTall" | "isWide" | "isStretchy">,
): {
  displayScale: number;
  maxFillScale: number;
} {
  if (layout.isStretchy) {
    return { displayScale: 0.86, maxFillScale: 0.92 };
  }
  if (layout.isCompact) {
    return { displayScale: 0.84, maxFillScale: 0.92 };
  }
  if (layout.isTall) {
    return { displayScale: 0.82, maxFillScale: 0.88 };
  }
  if (layout.isWide) {
    return { displayScale: 0.88, maxFillScale: 0.94 };
  }
  return { displayScale: 0.86, maxFillScale: 0.96 };
}

/** Evenly spaced flat row — all opponents share the same Y. */
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
