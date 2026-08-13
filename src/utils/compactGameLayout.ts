/**
 * Height-aware layout tiers for the in-game screen.
 * Reference devices (portrait shell height, ~px):
 *   iPhone SE 3       ~667
 *   iPhone 13 mini    ~812
 *   iPhone 14/15      ~844
 *   iPhone Pro Max    ~932
 */

import { HAND_SELECT_LIFT } from "../components/cardDimensions";

export type CompactHeightTier =
  | "comfortable"
  | "standard"
  | "compact"
  | "tight"
  | "veryTight";

const BASE_HAND_CARD_W = 86;
const BASE_HAND_CARD_H = 124;
/** Keep in sync with PlayerHand.tsx fan headroom math. */
const MAX_CENTER_LIFT = 14;
/** Fan headroom — trimmed vs old glass BottomBar (was +24 spare). */
const BASE_FAN_HEADROOM = HAND_SELECT_LIFT + MAX_CENTER_LIFT + 16;
/** Bottom clearance for fan tilt — keep in sync with PlayerHand fanBottomInset(). */
const BASE_FAN_BOTTOM_CLEARANCE =
  Math.ceil((BASE_HAND_CARD_W / 2) * 1.1 * Math.sin((18 * Math.PI) / 180)) + 2;

/** Hint / instruction bar between hand and action track (comfortable default). */
export const HAND_HINT_SLOT = 46;

/** Height budget for the hint row — smaller on SE-class shells. */
export function resolveHandHintSlot(tier: CompactHeightTier): number {
  switch (tier) {
    case "veryTight":
      return 34;
    case "tight":
      return 38;
    case "compact":
      return 42;
    default:
      return HAND_HINT_SLOT;
  }
}

/**
 * Extra lift above the home-indicator / safe bottom so Pass / Play clear the edge.
 * Trimmed on short shells — felt already reads as the floor.
 */
export function resolveBottomContentMargin(tier: CompactHeightTier): number {
  switch (tier) {
    case "veryTight":
      return 14;
    case "tight":
      return 16;
    case "compact":
      return 20;
    default:
      return 26;
  }
}

export function resolveCompactHeightTier(shellHeight: number): CompactHeightTier {
  if (shellHeight >= 900) return "comfortable";
  if (shellHeight >= 844) return "standard";
  if (shellHeight >= 720) return "compact";
  if (shellHeight >= 640) return "tight";
  return "veryTight";
}

function handCardScale(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 1;
    case "compact":
      return 0.9;
    case "tight":
      return 0.78;
    case "veryTight":
      return 0.72;
  }
}

function fanHeadroomScale(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 1;
    case "compact":
      return 0.86;
    case "tight":
      return 0.72;
    case "veryTight":
      return 0.66;
  }
}

/** Seat avatar boost — slightly smaller on short screens to free vertical ring space. */
export function avatarBoostForTier(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 1.24;
    case "compact":
      return 1.12;
    case "tight":
      return 1.04;
    case "veryTight":
      return 0.98;
  }
}

export type HandLayoutMetrics = {
  tier: CompactHeightTier;
  cardWidth: number;
  cardHeight: number;
  fanHeight: number;
  /** Gap between hand fan bottom and hint / controls. */
  handControlsGap: number;
  handZoneTopClearance: number;
  /** Inset above the hand→controls gap — keeps lifted/selected cards off the buttons. */
  handZoneBottomPad: number;
};

export function resolveHandMetrics(shellHeight: number): HandLayoutMetrics {
  const tier = resolveCompactHeightTier(shellHeight);
  const cardScale = handCardScale(tier);
  const cardWidth = Math.round(BASE_HAND_CARD_W * cardScale);
  const cardHeight = Math.round(BASE_HAND_CARD_H * cardScale);
  const fanHeight =
    cardHeight +
    Math.round(BASE_FAN_HEADROOM * fanHeadroomScale(tier)) +
    Math.round(BASE_FAN_BOTTOM_CLEARANCE * fanHeadroomScale(tier));

  // Hand → hint/controls: tight stack (no glass plate breathing room).
  const handControlsGap =
    tier === "veryTight" ? 1 : tier === "tight" ? 2 : tier === "compact" ? 3 : 4;
  const handZoneTopClearance = 0;
  const handZoneBottomPad =
    tier === "veryTight" || tier === "tight" ? 0 : 2;

  return {
    tier,
    cardWidth,
    cardHeight,
    fanHeight,
    handControlsGap,
    handZoneTopClearance,
    handZoneBottomPad,
  };
}

/** Fixed height budget for bottom-bar layout math (see BottomBar / ActionBar). */
export function resolveActionBarHeight(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 58;
    case "compact":
      return 54;
    case "tight":
      return 48;
    case "veryTight":
      return 46;
  }
}

export function resolveActionButtonMinHeight(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 52;
    case "compact":
      return 48;
    case "tight":
      return 44;
    case "veryTight":
      return 42;
  }
}

export function resolveActionTrackGap(tier: CompactHeightTier): number {
  return tier === "veryTight" || tier === "tight" ? 8 : tier === "compact" ? 10 : 12;
}

/** Space above Pass / Play inside the bottom bar (tier-aware). */
export function resolveControlsTopPad(tier: CompactHeightTier): number {
  if (tier === "veryTight") return 2;
  if (tier === "tight") return 4;
  if (tier === "compact") return 6;
  return 8;
}

/** Top padding inside the opponent ring play area. */
export function resolveOpponentTopPad(shellHeight: number): number {
  const tier = resolveCompactHeightTier(shellHeight);
  if (tier === "veryTight") return 8;
  if (tier === "tight") return 10;
  if (tier === "compact") return 16;
  return 26;
}

export type BottomChromeMetrics = HandLayoutMetrics & {
  actionBarHeight: number;
  actionBarPadding: number;
  reservedHeight: number;
};

/**
 * Gap between the feedback anchor and resting card tops.
 * Kept tight — panels sit in the fan headroom band, not a full zone above it.
 */
export const HAND_FEEDBACK_GAP = 4;

/**
 * HAND_BASELINE — distance from the screen bottom to the top edge of the
 * player hand / controls stack (includes fan headroom for selected lift).
 * Play-area padding uses this so input never clips.
 */
export function resolveHandBaseline(
  shellHeight: number,
  safeBottom: number,
  handVisible: boolean,
  outerPad: number,
): number {
  return resolveBottomChromeMetrics(
    shellHeight,
    safeBottom,
    handVisible,
    outerPad,
  ).reservedHeight;
}

/** Empty band above resting cards reserved for arc / select lift. */
export function resolveHandFanHeadroom(shellHeight: number): number {
  const tier = resolveCompactHeightTier(shellHeight);
  return Math.round(BASE_FAN_HEADROOM * fanHeadroomScale(tier));
}

/**
 * Bottom inset for Tricks / Winning Play / XP toasts.
 * Sits just above resting card tops (inside fan headroom), still clear of
 * hint + action buttons. Tracks hand metrics when tiers change.
 */
export function resolveHandFeedbackBottom(
  shellHeight: number,
  safeBottom: number,
  handVisible: boolean,
  outerPad: number,
): number {
  const baseline = resolveHandBaseline(
    shellHeight,
    safeBottom,
    handVisible,
    outerPad,
  );
  if (!handVisible) return Math.max(0, baseline + HAND_FEEDBACK_GAP);
  const headroom = resolveHandFanHeadroom(shellHeight);
  return Math.max(0, baseline - headroom + HAND_FEEDBACK_GAP);
}

/** Total bottom chrome reserved above the play-area host (matches BottomBar math). */
export function resolveBottomChromeMetrics(
  shellHeight: number,
  safeBottom: number,
  handVisible: boolean,
  bottomOuterPad: number,
): BottomChromeMetrics {
  const hand = resolveHandMetrics(shellHeight);
  const actionBarHeight = resolveActionBarHeight(hand.tier);
  const controlsTopPad = resolveControlsTopPad(hand.tier);
  const hintSlot = resolveHandHintSlot(hand.tier);
  // Was 8/12 for frosted BottomBar breathing room — no longer needed.
  const actionBarPadding =
    hand.tier === "veryTight" ? 2 : hand.tier === "tight" ? 4 : 6;
  const handSection = handVisible
    ? hand.fanHeight +
      hand.handZoneTopClearance +
      hand.handZoneBottomPad +
      hand.handControlsGap +
      hintSlot
    : 0;
  const reservedHeight =
    2 +
    handSection +
    controlsTopPad +
    actionBarHeight +
    actionBarPadding +
    bottomOuterPad;

  return {
    ...hand,
    actionBarHeight,
    actionBarPadding,
    reservedHeight,
  };
}

/** Screen-center of the bottom hand fan zone (where local shuffle animation should play). */
export function localHandShuffleScreenCenter(
  shellWidth: number,
  shellHeight: number,
  bottomOuterPad: number,
): { x: number; y: number } {
  const chrome = resolveBottomChromeMetrics(
    shellHeight,
    0,
    true,
    bottomOuterPad,
  );
  const handZoneHeight =
    chrome.fanHeight + chrome.handZoneTopClearance + chrome.handZoneBottomPad;
  const controlsBlock =
    chrome.actionBarHeight +
    chrome.actionBarPadding +
    resolveHandHintSlot(chrome.tier);
  const gapBlock = chrome.handControlsGap;
  const centerFromBottom =
    bottomOuterPad + controlsBlock + gapBlock + handZoneHeight / 2;
  return {
    x: shellWidth / 2,
    y: shellHeight - centerFromBottom,
  };
}
