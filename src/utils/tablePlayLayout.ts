import { Platform } from "react-native";
import { tableCardDimensions } from "../components/cardDimensions";

export type TablePlayEntry = {
  cards: import("../game/ruleset").Card[];
  playerId?: string;
};

export type BundleLayout = {
  cardWidth: number;
  cardHeight: number;
  overlap: number;
  width: number;
  height: number;
  cardOffsets: number[];
};

export type PlayStackLayout = {
  cardWidth: number;
  cardHeight: number;
  stackWidth: number;
  stackHeight: number;
  fillScale: number;
  displayScale: number;
  positions: Array<{ left: number; top: number; opacity: number; scale: number }>;
  centerOffsetX: number;
  centerOffsetY: number;
};

const TABLE = tableCardDimensions();
const BASE_CARD_W = TABLE.width;
const BASE_CARD_H = TABLE.height;

/** Max horizontal spread as a fraction of the play zone width. */
export const MAX_SPREAD_WIDTH_RATIO = 0.72;

const FULL_SPREAD_LAYERS = 4;
const CONDENSED_STEP_X = 10;
const CONDENSED_STEP_Y = 3;

const IDEAL_STEP_X = 22;
const IDEAL_STEP_Y = 8;
const MIN_STEP_X = 14;
const MAX_STEP_X = 30;

const MIN_TABLE_SCALE = Platform.OS === "web" ? 0.78 : 0.72;
const MAX_TABLE_SCALE = Platform.OS === "web" ? 1.52 : 1.44;

/** Adaptive fan overlap within a single play (pair, triple, run). */
export function layoutPlayBundle(
  cardCount: number,
  cardWidth = BASE_CARD_W,
  maxBundleWidth?: number,
  cardHeight = Math.round(cardWidth * (BASE_CARD_H / BASE_CARD_W)),
): BundleLayout {
  if (cardCount <= 0) {
    return {
      cardWidth,
      cardHeight,
      overlap: 0,
      width: cardWidth,
      height: cardHeight,
      cardOffsets: [0],
    };
  }

  let overlapRatio: number;
  if (cardCount === 1) {
    overlapRatio = 0;
  } else if (cardCount <= 3) {
    overlapRatio = 0.24;
  } else {
    overlapRatio = 0.18;
  }

  let overlap = Math.round(cardWidth * overlapRatio);
  let step = cardWidth - overlap;
  let width = cardWidth + (cardCount - 1) * step;

  const cap = maxBundleWidth ?? cardWidth * 4.2;
  if (width > cap && cardCount > 1) {
    width = cap;
    step = (width - cardWidth) / (cardCount - 1);
    overlap = cardWidth - step;
  }

  const cardOffsets = Array.from({ length: cardCount }, (_, i) => i * step);

  return {
    cardWidth,
    cardHeight,
    overlap,
    width,
    height: cardHeight,
    cardOffsets,
  };
}

function buriedPlayCount(playCount: number): number {
  return Math.max(0, playCount - FULL_SPREAD_LAYERS);
}

function playLayerPosition(
  playIndex: number,
  buriedCount: number,
  maxBundleWidth: number,
  stepX: number,
  stepY: number,
): { left: number; top: number } {
  if (playIndex < buriedCount) {
    return {
      left: playIndex * CONDENSED_STEP_X,
      top: playIndex * CONDENSED_STEP_Y,
    };
  }
  const spreadIndex = playIndex - buriedCount;
  const baseX = buriedCount * CONDENSED_STEP_X;
  const baseY = buriedCount * CONDENSED_STEP_Y;
  return {
    left: baseX + spreadIndex * stepX,
    top: baseY + spreadIndex * stepY,
  };
}

export function computePlayStackLayout(options: {
  plays: TablePlayEntry[];
  zoneWidth: number;
  zoneHeight: number;
  maxFillScale?: number;
  displayScale?: number;
}): PlayStackLayout {
  const {
    plays,
    zoneWidth,
    zoneHeight,
    maxFillScale = MAX_TABLE_SCALE,
    displayScale = 1,
  } = options;

  const playCount = plays.length;
  const maxBundleCards = Math.max(1, ...plays.map((p) => p.cards.length));
  const maxSpreadWidth =
    zoneWidth > 0 ? zoneWidth * MAX_SPREAD_WIDTH_RATIO : BASE_CARD_W * 3;

  const bundlePreview = layoutPlayBundle(
    maxBundleCards,
    BASE_CARD_W,
    maxSpreadWidth * 0.55,
  );
  const bundleExtra = bundlePreview.width - BASE_CARD_W;

  const buriedCount = buriedPlayCount(playCount);
  const spreadCount = Math.max(0, playCount - buriedCount);
  const spreadSlots = Math.max(spreadCount - 1, 0);

  const usableW =
    zoneWidth > 0
      ? Math.max(64, zoneWidth * MAX_SPREAD_WIDTH_RATIO - BASE_CARD_W - bundleExtra)
      : spreadSlots * IDEAL_STEP_X;
  const usableH =
    zoneHeight > 0
      ? Math.max(56, zoneHeight * 0.72 - BASE_CARD_H)
      : spreadSlots * IDEAL_STEP_Y;

  const stepX =
    spreadSlots === 0
      ? 0
      : Math.min(MAX_STEP_X, Math.max(MIN_STEP_X, usableW / spreadSlots));
  const stepY =
    spreadSlots === 0
      ? 0
      : Math.min(IDEAL_STEP_Y, Math.max(6, usableH / spreadSlots));

  const rawPositions = Array.from({ length: playCount }, (_, i) => {
    const pos = playLayerPosition(
      i,
      buriedCount,
      bundlePreview.width,
      stepX,
      stepY,
    );
    return {
      left: pos.left,
      top: pos.top,
      opacity: 1,
      scale: 1,
    };
  });

  let maxRight = BASE_CARD_W + bundleExtra;
  let maxBottom = BASE_CARD_H;
  for (let i = 0; i < playCount; i++) {
    const pos = rawPositions[i];
    const bundle = layoutPlayBundle(
      plays[i]?.cards.length ?? 1,
      BASE_CARD_W,
      maxSpreadWidth * 0.55,
    );
    maxRight = Math.max(maxRight, pos.left + bundle.width);
    maxBottom = Math.max(maxBottom, pos.top + bundle.height);
  }

  const stackWidth = maxRight;
  const stackHeight = maxBottom;

  let fit = 1;
  if (zoneWidth > 0 && zoneHeight > 0) {
    const scaledW = stackWidth * displayScale;
    const scaledH = stackHeight * displayScale;
    fit = Math.min(
      maxFillScale,
      (zoneWidth * MAX_SPREAD_WIDTH_RATIO) / scaledW,
      (zoneHeight * 0.78) / scaledH,
    );
    fit = Math.max(MIN_TABLE_SCALE, fit);
  }

  const totalScale = fit * displayScale;
  const renderedW = stackWidth * totalScale;
  const renderedH = stackHeight * totalScale;

  const centerOffsetX =
    zoneWidth > 0 ? Math.max(0, (zoneWidth - renderedW) / 2) : 0;
  const centerOffsetY =
    zoneHeight > 0 ? Math.max(0, (zoneHeight - renderedH) / 2) : 0;

  return {
    cardWidth: BASE_CARD_W,
    cardHeight: BASE_CARD_H,
    stackWidth,
    stackHeight,
    fillScale: fit,
    displayScale,
    positions: rawPositions,
    centerOffsetX,
    centerOffsetY,
  };
}
