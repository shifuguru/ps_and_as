/**
 * Height-aware layout tiers for the in-game screen.
 * Reference devices (portrait shell height, ~px):
 *   iPhone SE 3       ~667
 *   iPhone 13 mini    ~812
 *   iPhone 14/15      ~844
 *   iPhone Pro Max    ~932
 */

export type CompactHeightTier =
  | "comfortable"
  | "standard"
  | "compact"
  | "tight"
  | "veryTight";

const BASE_HAND_CARD_W = 86;
const BASE_HAND_CARD_H = 124;
/** Keep in sync with PlayerHand.tsx fan headroom math. */
const SELECT_LIFT = 12;
const MAX_CENTER_LIFT = 14;
const BASE_FAN_HEADROOM = SELECT_LIFT + MAX_CENTER_LIFT + 24;
/** Bottom clearance for fan tilt — keep in sync with PlayerHand fanBottomInset(). */
const BASE_FAN_BOTTOM_CLEARANCE =
  Math.ceil((BASE_HAND_CARD_W / 2) * 1.1 * Math.sin((18 * Math.PI) / 180)) + 4;

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
      return 0.92;
    case "tight":
      return 0.86;
    case "veryTight":
      return 0.8;
  }
}

function fanHeadroomScale(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 1;
    case "compact":
      return 0.88;
    case "tight":
      return 0.82;
    case "veryTight":
      return 0.76;
  }
}

/** Seat avatar boost — slightly smaller on short screens to free vertical ring space. */
export function avatarBoostForTier(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 1.24;
    case "compact":
      return 1.14;
    case "tight":
      return 1.08;
    case "veryTight":
      return 1.02;
  }
}

export type HandLayoutMetrics = {
  tier: CompactHeightTier;
  cardWidth: number;
  cardHeight: number;
  fanHeight: number;
  handControlsGap: number;
  handZoneTopClearance: number;
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

  const handControlsGap =
    tier === "veryTight" ? 8 : tier === "tight" ? 10 : tier === "compact" ? 12 : 14;
  const handZoneTopClearance =
    tier === "veryTight" || tier === "tight" ? 2 : 4;

  return {
    tier,
    cardWidth,
    cardHeight,
    fanHeight,
    handControlsGap,
    handZoneTopClearance,
  };
}

/** Fixed height budget for bottom-bar layout math (see BottomBar / ActionBar). */
export function resolveActionBarHeight(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 98;
    case "compact":
      return 90;
    case "tight":
      return 84;
    case "veryTight":
      return 78;
  }
}

export function resolveActionButtonMinHeight(tier: CompactHeightTier): number {
  switch (tier) {
    case "comfortable":
    case "standard":
      return 48;
    case "compact":
      return 44;
    case "tight":
      return 42;
    case "veryTight":
      return 40;
  }
}

export function resolveActionTrackGap(tier: CompactHeightTier): number {
  return tier === "veryTight" || tier === "tight" ? 8 : tier === "compact" ? 10 : 12;
}

/** Space above Pass / Play inside the bottom bar (tier-aware). */
export function resolveControlsTopPad(tier: CompactHeightTier): number {
  if (tier === "veryTight") return 8;
  if (tier === "tight") return 10;
  return 12;
}

/** Top padding inside the opponent ring play area. */
export function resolveOpponentTopPad(shellHeight: number): number {
  const tier = resolveCompactHeightTier(shellHeight);
  if (tier === "veryTight") return 14;
  if (tier === "tight") return 18;
  if (tier === "compact") return 22;
  return 30;
}

export type BottomChromeMetrics = HandLayoutMetrics & {
  actionBarHeight: number;
  actionBarPadding: number;
  reservedHeight: number;
};

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
  const actionBarPadding = hand.tier === "veryTight" ? 12 : 16;
  const handSection = handVisible
    ? hand.fanHeight + hand.handZoneTopClearance + hand.handControlsGap + 2
    : 0;
  const reservedHeight =
    8 +
    handSection +
    controlsTopPad +
    actionBarHeight +
    actionBarPadding +
    4 +
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
  const handZoneHeight = chrome.fanHeight + chrome.handZoneTopClearance;
  const controlsBlock = chrome.actionBarHeight + chrome.actionBarPadding + 4;
  const gapBlock = chrome.handControlsGap + 2;
  const centerFromBottom =
    bottomOuterPad + controlsBlock + gapBlock + handZoneHeight / 2;
  return {
    x: shellWidth / 2,
    y: shellHeight - centerFromBottom,
  };
}
