/** Hand card footprint — must match `Card.tsx` default styles. */
export const HAND_CARD_WIDTH = 86;
export const HAND_CARD_HEIGHT = 124;

/** Hand selection motion — keep fan headroom math in sync across layout + Card. */
export const HAND_SELECT_LIFT = 16;
export const HAND_SELECT_SCALE = 1.04;
/** Horizontal nudge for cards adjacent to a selection. */
export const HAND_SELECT_NEIGHBOR_SPREAD = 3;

/**
 * Table pile layout footprint — same as hand. GameTable scales the pile up
 * (never below 1×) to fill the card zone; boosting here only shrinks on screen.
 */
export const TABLE_CARD_BOOST = 1;

export function tableCardDimensions(): {
  width: number;
  height: number;
  bundleOverlap: number;
} {
  const width = Math.round(HAND_CARD_WIDTH * TABLE_CARD_BOOST);
  const height = Math.round(HAND_CARD_HEIGHT * TABLE_CARD_BOOST);
  return {
    width,
    height,
    bundleOverlap: Math.round(width * 0.3),
  };
}

/** Tighter corners for mini face-down cards (deal ceremony, seat stacks). */
export function ceremonyCardCornerRadius(width: number, height: number): number {
  return Math.max(3, Math.round(Math.min(width, height) * 0.1));
}

/**
 * Face typography + insets at the reference 86×124 card.
 * Callers scale these by `width / HAND_CARD_WIDTH` so hand and pile stay proportional.
 */
export const CARD_FACE_REF = {
  cornerRank: 13,
  cornerSuit: 11,
  cornerRankLine: 15,
  cornerSuitLine: 13,
  value: 18,
  suit: 20,
  suitMarginTop: 6,
  cornerInsetTop: 6,
  cornerInsetSide: 8,
  outerRadius: 14,
  faceRadius: 13,
} as const;

export type CardFaceMetrics = {
  scale: number;
  width: number;
  height: number;
  cornerRank: number;
  cornerSuit: number;
  cornerRankLine: number;
  cornerSuitLine: number;
  value: number;
  suit: number;
  suitMarginTop: number;
  cornerInsetTop: number;
  cornerInsetSide: number;
  outerRadius: number;
  faceRadius: number;
};

function clampCardDim(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Scale face chrome from laid-out card width (hand fan + table pile). */
export function resolveCardFaceMetrics(
  width: number = HAND_CARD_WIDTH,
  height: number = HAND_CARD_HEIGHT,
): CardFaceMetrics {
  const w = clampCardDim(width, HAND_CARD_WIDTH);
  const h = clampCardDim(height, HAND_CARD_HEIGHT);
  const scale = w / HAND_CARD_WIDTH;
  const px = (ref: number, min = 1) => Math.max(min, Math.round(ref * scale));
  return {
    scale,
    width: w,
    height: h,
    cornerRank: px(CARD_FACE_REF.cornerRank, 8),
    cornerSuit: px(CARD_FACE_REF.cornerSuit, 7),
    cornerRankLine: px(CARD_FACE_REF.cornerRankLine, 9),
    cornerSuitLine: px(CARD_FACE_REF.cornerSuitLine, 8),
    value: px(CARD_FACE_REF.value, 10),
    suit: px(CARD_FACE_REF.suit, 11),
    suitMarginTop: px(CARD_FACE_REF.suitMarginTop, 2),
    cornerInsetTop: px(CARD_FACE_REF.cornerInsetTop, 3),
    cornerInsetSide: px(CARD_FACE_REF.cornerInsetSide, 4),
    outerRadius: px(CARD_FACE_REF.outerRadius, 4),
    faceRadius: px(CARD_FACE_REF.faceRadius, 3),
  };
}
