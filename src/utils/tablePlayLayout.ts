import { Platform } from "react-native";
import { tableCardDimensions } from "../components/cardDimensions";
import { allSameValue, isRun, rankIndex } from "../game/core";
import type { Card } from "../game/ruleset";

export type TablePlayEntry = {
  cards: Card[];
  playerId?: string;
};

export type FrozenPlaySpot = {
  left: number;
  top: number;
  rotation: number;
  /** Effective render box when pile uses unified playGroupSizes (matches GameTable). */
  groupWidth?: number;
  groupHeight?: number;
};

export type PlayStackTier = "buried" | "visible" | "beaten";

export type BundleLayout = {
  cardWidth: number;
  cardHeight: number;
  overlap: number;
  width: number;
  height: number;
  cardOffsets: number[];
  renderOrder?: number[];
  isRunSpread?: boolean;
};

export type PlayStackLayout = {
  cardWidth: number;
  cardHeight: number;
  stackWidth: number;
  stackHeight: number;
  fillScale: number;
  displayScale: number;
  positions: Array<{
    left: number;
    top: number;
    opacity: number;
    scale: number;
    rotation?: number;
    tier?: PlayStackTier;
  }>;
  /** Per-play card horizontal offsets (merged pile fan). */
  playCardOffsets?: Array<number[] | undefined>;
  /** Per-play group box (merged pile uses unified width). */
  playGroupSizes?: Array<{ width: number; height: number } | undefined>;
  centerOffsetX: number;
  centerOffsetY: number;
};

const TABLE = tableCardDimensions();
const BASE_CARD_W = TABLE.width;
const BASE_CARD_H = TABLE.height;

export const MAX_SPREAD_WIDTH_RATIO = 0.84;

const MIN_TABLE_SCALE = Platform.OS === "web" ? 0.86 : 0.82;
const MAX_TABLE_SCALE = Platform.OS === "web" ? 1.62 : 1.54;

export const STACK_CENTER_Y = 0.5;

/** Fixed chrome slots inside the gameplay stage — never derived from pile bounds. */
export const STAGE_PLAY_TYPE_BADGE_GAP = 16;
export const STAGE_PLAY_TYPE_BADGE_HEIGHT = 30;
export const STAGE_TURN_HINT_GAP = 8;

export function stageCardRowCenterY(zoneHeight: number): number {
  return zoneHeight * STACK_CENTER_Y;
}

/** Play-type pills ("Singles", "Runs!", …) — anchored below the card row anchor. */
export function stagePlayTypeBadgeTop(
  zoneHeight: number,
  cardHeight: number,
): number {
  const centerY = stageCardRowCenterY(zoneHeight);
  const refCardH = cardHeight > 0 ? cardHeight : BASE_CARD_H;
  return centerY + refCardH / 2 + STAGE_PLAY_TYPE_BADGE_GAP;
}

/** Turn status pill — fixed slot below play-type pills (or card row when pills hidden). */
export function stageTurnHintTop(
  zoneHeight: number,
  cardHeight: number,
  hasPlayTypePills: boolean,
): number {
  const badgeTop = stagePlayTypeBadgeTop(zoneHeight, cardHeight);
  if (hasPlayTypePills) {
    return badgeTop + STAGE_PLAY_TYPE_BADGE_HEIGHT + STAGE_TURN_HINT_GAP;
  }
  return badgeTop;
}

/** Oldest singles beyond this count stack tightly at the left of the row. */
export const MAX_VISIBLE_SINGLES = 4;
/** Oldest doubles / triples / quads / runs beyond this count stack tightly. */
export const MAX_VISIBLE_RANK_PLAYS = 3;

const BURIED_SEQUENCE_GAP = 3;

/** Peek distance between plays — ~top-left rank corner stays readable. */
const SINGLE_PLAY_PEEK = 0.5;
const BEATEN_SINGLE_PEEK = 0.44;
const BURIED_EXIT_PEEK = 0.48;

export function playIdentityKey(play: TablePlayEntry): string {
  const cards = play.cards.map((c) => `${c.suit}${c.value}`).join("-");
  return `${play.playerId ?? "unknown"}|${cards}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Consecutive same-rank plays at the end that form the current pile (e.g. double + double = quad). */
export function findActivePileRange(plays: TablePlayEntry[]): {
  start: number;
  end: number;
} {
  if (plays.length === 0) return { start: 0, end: -1 };
  const end = plays.length - 1;
  const topValue = plays[end].cards[0]?.value;
  if (topValue === undefined) return { start: end, end };

  let start = end;
  for (let i = end - 1; i >= 0; i--) {
    const play = plays[i];
    if (!play.cards.length || !allSameValue(play.cards)) break;
    if (play.cards[0].value !== topValue) break;
    start = i;
  }
  return { start, end };
}

/** Last consecutive landed play in the active pile (excludes in-flight entries). */
export function landedActiveEndIndex(
  plays: TablePlayEntry[],
  active: { start: number; end: number },
  hiddenPlayKeys?: ReadonlySet<string>,
): number {
  if (active.end < active.start) return active.end;
  if (!hiddenPlayKeys || hiddenPlayKeys.size === 0) return active.end;
  let end = active.start - 1;
  for (let i = active.start; i <= active.end; i++) {
    if (hiddenPlayKeys.has(playIdentityKey(plays[i]))) break;
    end = i;
  }
  return Math.max(end, active.start - 1);
}

function layoutRunBundle(
  cards: Card[],
  cardWidth: number,
  maxBundleWidth: number | undefined,
  cardHeight: number,
): BundleLayout {
  const freq: Record<number, number> = {};
  for (const c of cards) {
    freq[c.value] = (freq[c.value] || 0) + 1;
  }
  const uniqueRanks = Object.keys(freq)
    .map(Number)
    .sort((a, b) => rankIndex(a) - rankIndex(b));
  const multiplicity = freq[uniqueRanks[0]] ?? 1;

  const rankStep = Math.round(cardWidth * (multiplicity === 1 ? 0.62 : 0.54));
  const withinOverlap = Math.round(cardWidth * (multiplicity === 1 ? 0.06 : 0.18));

  const rankSlot = new Map<number, number>();
  uniqueRanks.forEach((value, index) => rankSlot.set(value, index));

  const renderOrder = cards
    .map((card, index) => ({ index, value: card.value }))
    .sort((a, b) => {
      const byRank = rankIndex(a.value) - rankIndex(b.value);
      return byRank !== 0 ? byRank : a.index - b.index;
    })
    .map((entry) => entry.index);

  const withinCount = new Map<number, number>();
  const cardOffsets = new Array<number>(cards.length).fill(0);

  for (const cardIndex of renderOrder) {
    const value = cards[cardIndex].value;
    const slot = rankSlot.get(value) ?? 0;
    const withinIndex = withinCount.get(value) ?? 0;
    withinCount.set(value, withinIndex + 1);
    cardOffsets[cardIndex] =
      slot * rankStep + withinIndex * Math.max(0, cardWidth - withinOverlap);
  }

  let width = Math.max(...cardOffsets, 0) + cardWidth;
  if (maxBundleWidth && width > maxBundleWidth && width > 0) {
    const shrink = maxBundleWidth / width;
    for (let i = 0; i < cardOffsets.length; i++) {
      cardOffsets[i] = Math.round(cardOffsets[i] * shrink);
    }
    width = maxBundleWidth;
  }

  return {
    cardWidth,
    cardHeight,
    overlap: withinOverlap,
    width,
    height: cardHeight,
    cardOffsets,
    renderOrder,
    isRunSpread: true,
  };
}

/** Horizontal advance between cards in a same-rank set — top-left rank must be countable. */
function rankSetCardStep(cardWidth: number, count: number): number {
  const peekRatio = count <= 2 ? 0.5 : count === 3 ? 0.46 : 0.42;
  return Math.max(34, Math.round(cardWidth * peekRatio));
}

function isRankSetPlay(play: TablePlayEntry): boolean {
  return play.cards.length > 1 && allSameValue(play.cards);
}

/** Doubles / triples / quads — spread so each card's top-left rank stays readable. */
function layoutRankSetBundle(
  cards: Card[],
  cardWidth: number,
  maxBundleWidth: number | undefined,
  cardHeight: number,
): BundleLayout {
  const count = cards.length;
  const minStep = rankSetCardStep(cardWidth, count);
  let step = minStep;
  let width = cardWidth + (count - 1) * step;

  const cap = maxBundleWidth ?? cardWidth + (count - 1) * minStep + 8;
  if (width > cap && count > 1) {
    step = Math.max(minStep, Math.round((cap - cardWidth) / (count - 1)));
    width = cardWidth + (count - 1) * step;
  }

  const cardOffsets = Array.from({ length: count }, (_, i) => i * step);
  return {
    cardWidth,
    cardHeight,
    overlap: Math.max(0, cardWidth - step),
    width,
    height: cardHeight,
    cardOffsets,
  };
}

export function layoutPlayBundle(
  cardsOrCount: Card[] | number,
  cardWidth = BASE_CARD_W,
  maxBundleWidth?: number,
  cardHeight = Math.round(cardWidth * (BASE_CARD_H / BASE_CARD_W)),
): BundleLayout {
  const cardCount = typeof cardsOrCount === "number" ? cardsOrCount : cardsOrCount.length;
  const cards = typeof cardsOrCount === "number" ? null : cardsOrCount;

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

  if (cards && isRun(cards)) {
    return layoutRunBundle(cards, cardWidth, maxBundleWidth, cardHeight);
  }

  if (cards && cards.length > 1 && allSameValue(cards)) {
    return layoutRankSetBundle(cards, cardWidth, maxBundleWidth, cardHeight);
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

function stackFootprintHalfExtents(): { halfW: number; halfH: number } {
  return {
    halfW: BASE_CARD_W * 1.05,
    halfH: BASE_CARD_H * 0.52,
  };
}

function zoneFillScale(
  zoneWidth: number,
  zoneHeight: number,
  maxFillScale: number,
): number {
  const { halfW, halfH } = stackFootprintHalfExtents();
  const padW = (zoneWidth * MAX_SPREAD_WIDTH_RATIO) / 2;
  const padH = zoneHeight * 0.78 * 0.5;
  const fit = Math.min(
    maxFillScale,
    padW / Math.max(halfW, 1),
    padH / Math.max(halfH, 1),
  );
  return Math.max(MIN_TABLE_SCALE, fit);
}

type PlayShape =
  | "single"
  | "double"
  | "triple"
  | "quad"
  | "run"
  | "other";

function playShape(play: TablePlayEntry): PlayShape {
  const count = play.cards.length;
  if (count === 1) return "single";
  if (isRun(play.cards)) return "run";
  if (allSameValue(play.cards)) {
    if (count === 2) return "double";
    if (count === 3) return "triple";
    if (count === 4) return "quad";
  }
  return "other";
}

function maxVisibleForShape(shape: PlayShape): number {
  if (shape === "single") return MAX_VISIBLE_SINGLES;
  return MAX_VISIBLE_RANK_PLAYS;
}

/** Oldest plays of each shape beyond the visible limit are stacked tightly. */
function computeBuriedByShape(plays: TablePlayEntry[]): Set<number> {
  const buried = new Set<number>();
  const byShape = new Map<PlayShape, number[]>();

  plays.forEach((play, index) => {
    const shape = playShape(play);
    const list = byShape.get(shape) ?? [];
    list.push(index);
    byShape.set(shape, list);
  });

  for (const [shape, indices] of byShape) {
    const limit = maxVisibleForShape(shape);
    const excess = indices.length - limit;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        buried.add(indices[i]);
      }
    }
  }

  return buried;
}

function bundleCapForPlay(
  play: TablePlayEntry,
  defaultCap: number,
  maxSpreadWidth: number,
): number {
  if (play.cards.length >= 3 && isRun(play.cards)) {
    return maxSpreadWidth * 0.95;
  }
  if (play.cards.length > 1 && allSameValue(play.cards)) {
    return maxSpreadWidth;
  }
  return defaultCap;
}

/** Gap after a play's last card before the next play — matches within-set card rhythm. */
function interPlayGapAfter(
  play: TablePlayEntry,
  tier: PlayStackTier,
  cardWidth: number,
): number {
  if (isRankSetPlay(play)) {
    return rankSetCardStep(cardWidth, play.cards.length);
  }
  if (playShape(play) === "run") {
    return Math.round(cardWidth * SINGLE_PLAY_PEEK);
  }
  return Math.round(
    cardWidth * (tier === "beaten" ? BEATEN_SINGLE_PEEK : SINGLE_PLAY_PEEK),
  );
}

/** Horizontal advance to the next play — chain from the previous play's last card. */
function playTimelineStep(
  play: TablePlayEntry,
  tier: PlayStackTier,
  bundle: BundleLayout,
  nextPlay: TablePlayEntry | undefined,
  nextTier: PlayStackTier | undefined,
  cardWidth: number,
): number {
  if (tier === "buried") return BURIED_SEQUENCE_GAP;
  if (nextTier === "buried") {
    return tier === "beaten"
      ? Math.round(cardWidth * BEATEN_SINGLE_PEEK)
      : Math.round(cardWidth * BURIED_EXIT_PEEK);
  }

  if (
    isRankSetPlay(play) &&
    nextPlay &&
    nextTier === "visible" &&
    isRankSetPlay(nextPlay) &&
    play.cards[0]?.value === nextPlay.cards[0]?.value
  ) {
    return 0;
  }

  const lastOffset = bundle.cardOffsets[bundle.cardOffsets.length - 1] ?? 0;
  return lastOffset + interPlayGapAfter(play, tier, cardWidth);
}

function visualRowBounds(
  playCount: number,
  relativeLefts: number[],
  playCardOffsets: Array<number[] | undefined>,
  cardWidth: number,
): { minX: number; maxX: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < playCount; i++) {
    const offsets = playCardOffsets[i];
    if (!offsets) continue;
    for (let j = 0; j < offsets.length; j++) {
      const x = relativeLefts[i] + offsets[j];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + cardWidth);
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: cardWidth };
  }
  return { minX, maxX };
}

function rowLeftForVisualCenter(
  bounds: { minX: number; maxX: number },
  centerX: number,
  zoneWidth: number,
  edgePad: number,
): number {
  const visualWidth = bounds.maxX - bounds.minX;
  const rowLeft = centerX - bounds.minX - visualWidth / 2;
  return clamp(rowLeft, edgePad, Math.max(edgePad, zoneWidth - visualWidth - edgePad));
}

function isUnifiedActivePileCandidate(
  plays: TablePlayEntry[],
  active: { start: number; end: number },
): boolean {
  if (active.end <= active.start) return false;
  const pilePlays = plays.slice(active.start, active.end + 1);
  if (!pilePlays.every(isRankSetPlay)) return false;
  const rank = pilePlays[0].cards[0]?.value;
  return rank !== undefined && pilePlays.every((p) => p.cards[0]?.value === rank);
}

type VisibleLayoutResult = {
  positions: PlayStackLayout["positions"];
  playCardOffsets: Array<number[] | undefined>;
  playGroupSizes: Array<{ width: number; height: number } | undefined>;
  rowWidth: number;
};

/** Same-rank active pile (e.g. double + double) fans as one set so all cards are countable. */
function applyUnifiedActivePileFan(
  plays: TablePlayEntry[],
  active: { start: number; end: number },
  defaultBundleCap: number,
  maxSpreadWidth: number,
  cardWidth: number,
  cardHeight: number,
  relativeLefts: number[],
  playCardOffsets: Array<number[] | undefined>,
  playGroupSizes: Array<{ width: number; height: number } | undefined>,
): number | undefined {
  if (active.end <= active.start) return undefined;
  if (!isUnifiedActivePileCandidate(plays, active)) return undefined;

  const pilePlays = plays.slice(active.start, active.end + 1);
  const allCards = pilePlays.flatMap((play) => play.cards);
  const unified = layoutPlayBundle(
    allCards,
    cardWidth,
    bundleCapForPlay({ cards: allCards, playerId: "pile" }, defaultBundleCap, maxSpreadWidth),
    cardHeight,
  );

  for (let playIndex = active.start + 1; playIndex <= active.end; playIndex++) {
    relativeLefts[playIndex] = relativeLefts[active.start];
  }

  let cardIndex = 0;
  for (let playIndex = active.start; playIndex <= active.end; playIndex++) {
    const play = plays[playIndex];
    const offsets: number[] = [];
    for (let cardIndexInPlay = 0; cardIndexInPlay < play.cards.length; cardIndexInPlay++) {
      offsets[cardIndexInPlay] = unified.cardOffsets[cardIndex] ?? 0;
      cardIndex++;
    }
    playCardOffsets[playIndex] = offsets;
    playGroupSizes[playIndex] = { width: unified.width, height: unified.height };
  }

  return unified.width;
}

/** Scale every horizontal layout dimension by the same factor — preserves spacing ratios at any zoom. */
function scaleHorizontalLayout(
  relativeLefts: number[],
  playCardOffsets: Array<number[] | undefined>,
  playGroupSizes: Array<{ width: number; height: number } | undefined>,
  scale: number,
): void {
  if (scale === 1) return;
  for (let i = 0; i < relativeLefts.length; i++) {
    relativeLefts[i] = Math.round(relativeLefts[i] * scale);
  }
  for (let i = 0; i < playCardOffsets.length; i++) {
    const offsets = playCardOffsets[i];
    if (!offsets) continue;
    for (let j = 0; j < offsets.length; j++) {
      offsets[j] = Math.round(offsets[j] * scale);
    }
  }
  for (let i = 0; i < playGroupSizes.length; i++) {
    const size = playGroupSizes[i];
    if (!size) continue;
    size.width = Math.round(size.width * scale);
  }
}

/** Chronological left-to-right row — each play is its own bundle so sequence is readable. */
function layoutChronologicalPlays(
  plays: TablePlayEntry[],
  zoneWidth: number,
  zoneHeight: number,
  defaultBundleCap: number,
  maxSpreadWidth: number,
  cardWidth: number,
  cardHeight: number,
  topInset = 0,
): VisibleLayoutResult {
  const playCount = plays.length;
  const positions: PlayStackLayout["positions"] = [];
  const playCardOffsets: Array<number[] | undefined> = new Array(playCount);
  const playGroupSizes: Array<{ width: number; height: number } | undefined> =
    new Array(playCount);

  if (playCount === 0) {
    return { positions, playCardOffsets, playGroupSizes, rowWidth: 0 };
  }

  const centerX = zoneWidth / 2;
  const centerY = zoneHeight * STACK_CENTER_Y;
  const edgePad = 6;

  const buriedByShape = computeBuriedByShape(plays);
  const active = findActivePileRange(plays);

  const tiers: PlayStackTier[] = plays.map((_, playIndex) => {
    if (buriedByShape.has(playIndex)) return "buried";
    if (playIndex < active.start) return "beaten";
    return "visible";
  });

  const bundles = plays.map((play) =>
    layoutPlayBundle(
      play.cards,
      cardWidth,
      bundleCapForPlay(play, defaultBundleCap, maxSpreadWidth),
      cardHeight,
    ),
  );

  const relativeLefts = new Array<number>(playCount).fill(0);
  for (let playIndex = 1; playIndex < playCount; playIndex++) {
    if (
      isUnifiedActivePileCandidate(plays, active) &&
      playIndex > active.start &&
      playIndex <= active.end
    ) {
      relativeLefts[playIndex] = relativeLefts[active.start];
      continue;
    }

    const stackedBuried =
      tiers[playIndex] === "buried" && tiers[playIndex - 1] === "buried";
    if (stackedBuried) {
      relativeLefts[playIndex] = relativeLefts[playIndex - 1] + BURIED_SEQUENCE_GAP;
    } else {
      relativeLefts[playIndex] =
        relativeLefts[playIndex - 1] +
        playTimelineStep(
          plays[playIndex - 1],
          tiers[playIndex - 1],
          bundles[playIndex - 1],
          plays[playIndex],
          tiers[playIndex],
          cardWidth,
        );
    }
  }

  applyUnifiedActivePileFan(
    plays,
    active,
    defaultBundleCap,
    maxSpreadWidth,
    cardWidth,
    cardHeight,
    relativeLefts,
    playCardOffsets,
    playGroupSizes,
  );

  for (let playIndex = 0; playIndex < playCount; playIndex++) {
    playCardOffsets[playIndex] ??= [...bundles[playIndex].cardOffsets];
    playGroupSizes[playIndex] ??= {
      width: bundles[playIndex].width,
      height: bundles[playIndex].height,
    };
  }

  let bounds = visualRowBounds(playCount, relativeLefts, playCardOffsets, cardWidth);
  let rowWidth = bounds.maxX - bounds.minX;

  if (rowWidth > maxSpreadWidth && rowWidth > 0) {
    const layoutScale = maxSpreadWidth / rowWidth;
    scaleHorizontalLayout(relativeLefts, playCardOffsets, playGroupSizes, layoutScale);
    bounds = visualRowBounds(playCount, relativeLefts, playCardOffsets, cardWidth);
    rowWidth = bounds.maxX - bounds.minX;
  }

  const rowHeight = Math.max(...bundles.map((bundle) => bundle.height), cardHeight);
  const rowLeft = rowLeftForVisualCenter(bounds, centerX, zoneWidth, edgePad);
  const rowTop = clamp(
    centerY - rowHeight / 2 + topInset,
    edgePad + topInset,
    Math.max(edgePad + topInset, zoneHeight - rowHeight - edgePad),
  );

  for (let playIndex = 0; playIndex < playCount; playIndex++) {
    const tier = tiers[playIndex];
    const left = rowLeft + relativeLefts[playIndex];

    positions[playIndex] = {
      left,
      top: rowTop + (tier === "beaten" ? 6 : 0),
      opacity: 1,
      scale: 1,
      rotation: 0,
      tier,
    };
  }

  return { positions, playCardOffsets, playGroupSizes, rowWidth };
}

export function stackSpotForPlay(
  playIndex: number,
  _playCount: number,
  _play: TablePlayEntry,
  zoneWidth: number,
  zoneHeight: number,
  _maxBundleWidth: number,
  allPlays?: TablePlayEntry[],
  layoutOptions?: {
    maxFillScale?: number;
    displayScale?: number;
  },
): FrozenPlaySpot & { tier: PlayStackTier } {
  const plays = allPlays ?? [_play];
  const layout = computePlayStackLayout({
    plays,
    zoneWidth,
    zoneHeight,
    maxFillScale: layoutOptions?.maxFillScale,
    displayScale: layoutOptions?.displayScale,
  });
  const spot = layout.positions[playIndex];
  if (!spot) {
    return { left: 0, top: 0, rotation: 0, tier: "visible" };
  }
  const maxSpreadWidth = zoneWidth > 0 ? zoneWidth * MAX_SPREAD_WIDTH_RATIO : 0;
  const bundleCapRatio =
    _play.cards.length >= 3 && isRun(_play.cards)
      ? 0.95
      : _play.cards.length > 1 && allSameValue(_play.cards)
        ? 1
        : 0.68;
  const bundle = layoutPlayBundle(
    _play.cards,
    layout.cardWidth,
    Math.round(maxSpreadWidth * bundleCapRatio),
    layout.cardHeight,
  );
  const layoutGroupSize = layout.playGroupSizes?.[playIndex];
  return {
    left: spot.left,
    top: spot.top,
    rotation: spot.rotation ?? 0,
    tier: spot.tier ?? "visible",
    groupWidth: layoutGroupSize?.width ?? bundle.width,
    groupHeight: layoutGroupSize?.height ?? bundle.height,
  };
}

export function computePlayStackLayout(options: {
  plays: TablePlayEntry[];
  zoneWidth: number;
  zoneHeight: number;
  maxFillScale?: number;
  displayScale?: number;
  frozenByKey?: Record<string, FrozenPlaySpot>;
  frozenFillScale?: number;
  /** In-flight plays — layout only includes landed cards in the display fan. */
  hiddenPlayKeys?: ReadonlySet<string>;
  /** Reserve space at the top of the card zone (legacy — prefer fixed chrome overlays). */
  topInset?: number;
}): PlayStackLayout {
  const {
    plays,
    zoneWidth,
    zoneHeight,
    maxFillScale = MAX_TABLE_SCALE,
    displayScale = 1,
    frozenFillScale,
    hiddenPlayKeys: _hiddenPlayKeys,
    topInset = 0,
  } = options;

  const playCount = plays.length;
  const maxSpreadWidth =
    zoneWidth > 0 ? zoneWidth * MAX_SPREAD_WIDTH_RATIO : BASE_CARD_W * 3;
  const bundleCap = maxSpreadWidth * 0.68;
  const useStack = zoneWidth > 0 && zoneHeight > 0;

  let rawPositions: PlayStackLayout["positions"] = [];
  let playCardOffsets: Array<number[] | undefined> | undefined;
  let playGroupSizes: Array<{ width: number; height: number } | undefined> | undefined;
  let rowWidth = 0;

  let fit = frozenFillScale ?? 1;
  if (useStack && frozenFillScale == null) {
    fit = zoneFillScale(zoneWidth, zoneHeight, maxFillScale);
  } else if (!useStack && zoneWidth > 0 && zoneHeight > 0) {
    fit = Math.min(
      maxFillScale,
      (zoneWidth * MAX_SPREAD_WIDTH_RATIO) / (BASE_CARD_W * displayScale),
      (zoneHeight * 0.78) / (BASE_CARD_H * displayScale),
    );
    fit = Math.max(MIN_TABLE_SCALE, fit);
  }

  const pixelCardW = Math.round(BASE_CARD_W * fit * displayScale);
  const pixelCardH = Math.round(BASE_CARD_H * fit * displayScale);

  if (useStack) {
    const chronological = layoutChronologicalPlays(
      plays,
      zoneWidth,
      zoneHeight,
      bundleCap,
      maxSpreadWidth,
      pixelCardW,
      pixelCardH,
      topInset,
    );

    rawPositions = chronological.positions;
    playCardOffsets = chronological.playCardOffsets;
    playGroupSizes = chronological.playGroupSizes;
    rowWidth = chronological.rowWidth;
  } else {
    rawPositions = Array.from({ length: playCount }, () => ({
      left: 0,
      top: 0,
      opacity: 1,
      scale: 1,
      rotation: 0,
      tier: "visible" as PlayStackTier,
    }));
  }

  const stackWidth = zoneWidth > 0 ? zoneWidth : pixelCardW;
  const stackHeight = zoneHeight > 0 ? zoneHeight : pixelCardH;

  return {
    cardWidth: pixelCardW,
    cardHeight: pixelCardH,
    stackWidth,
    stackHeight,
    fillScale: fit,
    displayScale,
    positions: rawPositions,
    playCardOffsets,
    playGroupSizes,
    centerOffsetX: 0,
    centerOffsetY: 0,
  };
}

/** Global card x for left-to-right stacking (right card on top). */
export function globalCardLeft(
  playIndex: number,
  cardIndex: number,
  layout: PlayStackLayout,
  bundle: BundleLayout,
): number {
  const pos = layout.positions[playIndex];
  const offset =
    layout.playCardOffsets?.[playIndex]?.[cardIndex] ??
    bundle.cardOffsets[cardIndex] ??
    0;
  return (pos?.left ?? 0) + offset;
}
