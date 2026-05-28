/** Hand card footprint — must match `Card.tsx` default styles. */
export const HAND_CARD_WIDTH = 86;
export const HAND_CARD_HEIGHT = 124;

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
