import { useMemo } from "react";
import { breakpoints } from "./responsive";
import { useResponsiveDimensions } from "./responsive";

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

/** Global avatar / seat footprint scale. */
export const AVATAR_SIZE_BOOST = 1.1;

/** How much side seats blend from screen edge back toward the ring (0–1). */
export const SIDE_ANCHOR_CENTER_BLEND = 0.28;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function boost(n: number): number {
  return Math.round(n * AVATAR_SIZE_BOOST);
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
export function computeSeatDimensions(width: number, height?: number): SeatDimensions {
  const avatar = scaleForWidth(width, 32, 40, 46, 52);
  const avatarLocal = scaleForWidth(width, 36, 44, 50, 56);
  const avatarCompact = scaleForWidth(width, 26, 34, 38, 42);
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

export function useSeatDimensions(overrideWidth?: number): SeatDimensions {
  const { width, height } = useResponsiveDimensions();
  const basis = overrideWidth ?? width;
  return useMemo(
    () => computeSeatDimensions(basis, height),
    [basis, height],
  );
}
