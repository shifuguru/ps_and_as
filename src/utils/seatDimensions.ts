import { breakpoints } from "./breakpoints";
import {
  avatarBoostForTier,
  resolveCompactHeightTier,
} from "./compactGameLayout";

export type SeatDimensions = {
  avatar: number;
  avatarLocal: number;
  avatarCompact: number;
  footprintW: number;
  footprintH: number;
  localBand: number;
  avatarCenterY: number;
  avatarCenterYCompact: number;
  initialsFont: number;
  initialsFontCompact: number;
  nameFont: number;
  nameFontCompact: number;
  countBadgeSize: number;
  countFont: number;
  roleFont: number;
  seatMinW: number;
  seatMaxW: number;
  seatMinWCompact: number;
  seatMaxWCompact: number;
  seatMinWLocal: number;
  seatMaxWLocal: number;
  nameMaxW: number;
  nameMaxWCompact: number;
};

/** Default avatar / seat footprint scale (comfortable tier). */
export const AVATAR_SIZE_BOOST = 1.24;

/** How much side seats blend from screen edge back toward the ring (0–1). */
export const SIDE_ANCHOR_CENTER_BLEND = 0.28;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function boostWithTier(n: number, tier: ReturnType<typeof resolveCompactHeightTier>): number {
  return Math.round(n * avatarBoostForTier(tier));
}

/** Breakpoint-based scale using an explicit width (play area or viewport). */
export function scaleForWidth(
  width: number,
  mobile: number,
  tablet?: number,
  desktop?: number,
  wide?: number,
): number {
  const w = Math.min(width, 1400);
  if (w < breakpoints.tablet) return mobile;
  if (w < breakpoints.desktop) return tablet ?? mobile;
  if (w < breakpoints.wide) return desktop ?? tablet ?? mobile;
  return wide ?? desktop ?? tablet ?? mobile;
}

/** Seat / avatar sizes derived from available horizontal space. */
export function computeSeatDimensions(
  width: number,
  height?: number,
  shellHeight?: number,
): SeatDimensions {
  const tier = resolveCompactHeightTier(shellHeight ?? height ?? 900);
  const boost = (n: number) => boostWithTier(n, tier);
  const avatar = scaleForWidth(width, 36, 44, 50, 56);
  const avatarLocal = scaleForWidth(width, 40, 48, 54, 60);
  const avatarCompact = scaleForWidth(width, 30, 38, 42, 46);
  const footprintW = scaleForWidth(width, 58, 76, 86, 96);
  const footprintH = scaleForWidth(width, 70, 92, 104, 114);
  const localBand = scaleForWidth(width, 72, 88, 96, 104);

  const heightTight = height != null && height < 520;
  const shrink = heightTight ? 0.92 : 1;

  const scaledAvatar = boost(Math.round(avatar * shrink));
  const scaledAvatarLocal = boost(Math.round(avatarLocal * shrink));
  const scaledAvatarCompact = boost(Math.round(avatarCompact * shrink));

  return {
    avatar: scaledAvatar,
    avatarLocal: scaledAvatarLocal,
    avatarCompact: scaledAvatarCompact,
    footprintW: boost(Math.round(footprintW * shrink)),
    footprintH: boost(Math.round(footprintH * shrink)),
    localBand: boost(Math.round(localBand * shrink)),
    avatarCenterY: Math.round(scaledAvatar * 0.55),
    avatarCenterYCompact: Math.round(scaledAvatarCompact * 0.58),
    initialsFont: boost(scaleForWidth(width, 11, 13, 14, 15)),
    initialsFontCompact: boost(scaleForWidth(width, 9, 11, 12, 13)),
    nameFont: boost(scaleForWidth(width, 10, 11, 12, 13)),
    nameFontCompact: boost(scaleForWidth(width, 9, 10, 11, 12)),
    countBadgeSize: boost(scaleForWidth(width, 18, 20, 22, 24)),
    countFont: boost(scaleForWidth(width, 9, 10, 11, 12)),
    roleFont: boost(scaleForWidth(width, 10, 11, 12, 13)),
    seatMinW: boost(scaleForWidth(width, 52, 64, 72, 80)),
    seatMaxW: boost(scaleForWidth(width, 72, 88, 96, 104)),
    seatMinWCompact: boost(scaleForWidth(width, 46, 56, 64, 72)),
    seatMaxWCompact: boost(scaleForWidth(width, 60, 72, 80, 88)),
    seatMinWLocal: boost(scaleForWidth(width, 60, 72, 80, 88)),
    seatMaxWLocal: boost(scaleForWidth(width, 80, 96, 104, 112)),
    nameMaxW: boost(scaleForWidth(width, 72, 84, 92, 100)),
    nameMaxWCompact: boost(scaleForWidth(width, 58, 68, 76, 84)),
  };
}

export function avatarSizeForSeat(
  dims: SeatDimensions,
  options: { compact?: boolean; isLocal?: boolean },
): number {
  if (options.compact) return dims.avatarCompact;
  if (options.isLocal) return dims.avatarLocal;
  return dims.avatar;
}

/** Mini face-down cards beside / above a seat avatar (deal ceremony, dead hand). */
export function seatMiniCardDimensions(avatarSize: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(18, Math.round(avatarSize * 0.34)),
    height: Math.max(26, Math.round(avatarSize * 0.48)),
  };
}

/** Matches OpponentSeat countBadge positioning. */
export const COUNT_BADGE_OUTSET_RIGHT = 8;
export const COUNT_BADGE_OUTSET_BOTTOM = 4;
export const COUNT_BADGE_PADDING_H = 5;
export const DEAL_STACK_ABOVE_BADGE_GAP = 3;

/** Hand-count badge center in avatarWrap coordinates (origin top-left). */
export function countBadgeCenterInAvatarWrap(
  avatarSize: number,
  countBadgeSize: number,
): { x: number; y: number } {
  const badgeWidth = countBadgeSize + COUNT_BADGE_PADDING_H * 2;
  return {
    x: avatarSize + COUNT_BADGE_OUTSET_RIGHT - badgeWidth / 2,
    y: avatarSize + COUNT_BADGE_OUTSET_BOTTOM - countBadgeSize / 2,
  };
}

/** Face-down deal stack center in avatarWrap coordinates. */
export function dealStackCenterInAvatarWrap(
  avatarSize: number,
  countBadgeSize: number,
  stackH: number,
): { x: number; y: number } {
  const badge = countBadgeCenterInAvatarWrap(avatarSize, countBadgeSize);
  const badgeTop = badge.y - countBadgeSize / 2;
  return {
    x: badge.x,
    y: badgeTop - DEAL_STACK_ABOVE_BADGE_GAP - stackH / 2,
  };
}

/** Distance from avatar center down to the bottom of OpponentSeat (name + status pill). */
export function avatarBelowCenterOffset(
  dims: SeatDimensions,
  options: { compact?: boolean; isLocal?: boolean },
): number {
  const avatarSize = avatarSizeForSeat(dims, options);
  const nameFont = options.compact ? dims.nameFontCompact : dims.nameFont;
  // avatarWrap marginBottom 4, name row, status pill marginTop 2 (~11px).
  return Math.round(avatarSize / 2 + 4 + nameFont + 2 + 11);
}

/** Distance from footprint / slot top to avatar center (OpponentSeat). */
export function avatarCenterOffsetFromTop(
  dims: SeatDimensions,
  options: { compact?: boolean; isLocal?: boolean },
): number {
  return avatarSizeForSeat(dims, options) / 2 + 2;
}

export type SeatTableGap = {
  gap: number;
  minGap: number;
  maxGap: number;
};

/**
 * How far avatar centers sit beyond the card-table bounding circle.
 * Grows on roomier screens, clamped between min and max.
 */
export function computeSeatTableGap(
  width: number,
  height: number,
  cardZoneWidth: number,
  cardZoneHeight: number,
  cardZoneTop: number,
  seat: Pick<SeatDimensions, "footprintW" | "footprintH">,
  options?: {
    minTop?: number;
    ringBandBottom?: number;
    sideMargin?: number;
  },
): SeatTableGap {
  const minTop = options?.minTop ?? 30;
  const ringBandBottom = options?.ringBandBottom ?? height - 8;
  const sideMargin = options?.sideMargin ?? 8;

  const cardCenterY = cardZoneTop + cardZoneHeight / 2;
  const cardClearRadius = Math.hypot(cardZoneWidth / 2, cardZoneHeight / 2);

  const minGap = scaleForWidth(width, 12, 18, 24, 30);
  const maxGap = scaleForWidth(width, 28, 44, 58, 74);

  const hSlack = width / 2 - cardZoneWidth / 2 - sideMargin - seat.footprintW / 2;
  const vSlackTop =
    cardCenterY - cardClearRadius - minTop - seat.footprintH * 0.45;
  const vSlackBottom =
    ringBandBottom - (cardCenterY + cardClearRadius) - seat.footprintH * 0.35;
  const slack = Math.max(0, Math.min(hSlack, vSlackTop, vSlackBottom));

  const refSlack = scaleForWidth(width, 32, 52, 72, 92);
  const t = clamp(slack / refSlack, 0, 1);
  const gap = Math.round(minGap + t * (maxGap - minGap));

  return { gap, minGap, maxGap };
}
