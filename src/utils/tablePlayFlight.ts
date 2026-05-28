import { allSameValue, isRun } from "../game/core";
import type { TrickPlayDisplay } from "./trickDisplay";
import type { PlayAreaLayout } from "./tableLayout";
import {
  opponentSeatPosition,
  ringAngleForSeat,
} from "./tableLayout";
import {
  avatarBelowCenterOffset,
  avatarCenterOffsetFromTop,
  avatarSizeForSeat,
} from "./seatDimensions";
import {
  type FrozenPlaySpot,
  layoutPlayBundle,
  MAX_SPREAD_WIDTH_RATIO,
  playIdentityKey,
} from "./tablePlayLayout";

export function playDisplayKey(play: TrickPlayDisplay): string {
  return playIdentityKey(play);
}

export type SeatOriginOptions = {
  deadHandId?: string | null;
};

/** Offset from avatar center toward the table (inside the seat ring) for deal stacks. */
export const DEAL_STACK_TOWARD_CENTER = 0.52;

/** Radial step from a ring seat toward the table center (matches ringAngleForSeat). */
export function ringInwardOffset(
  angleDeg: number,
  distance: number,
): { dx: number; dy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    dx: -Math.sin(rad) * distance,
    dy: Math.cos(rad) * distance,
  };
}

/** Approximate avatar center in play-area coordinates. */
export function seatOriginInPlayArea(
  layout: PlayAreaLayout,
  playAreaHeight: number,
  playerId: string,
  layoutSeatIds: string[],
  localPlayerIds: string[],
  options?: SeatOriginOptions,
): { x: number; y: number } | null {
  const seatIndex = layoutSeatIds.indexOf(playerId);
  if (seatIndex < 0) return null;

  const compact = layoutSeatIds.length >= 6;
  const seatOpts = { compact, isLocal: localPlayerIds.includes(playerId) };

  if (localPlayerIds.includes(playerId)) {
    return {
      x: layout.width / 2,
      y:
        playAreaHeight -
        avatarBelowCenterOffset(layout.seatDimensions, seatOpts),
    };
  }

  const { opponentRing: ring } = layout;
  const angle = ringAngleForSeat(seatIndex, layoutSeatIds.length);
  const pos = opponentSeatPosition(angle, {
    cx: ring.cx,
    cy: ring.cy,
    radius: ring.radius,
    arenaWidth: layout.width,
    footprintW: layout.seatFootprintW,
    footprintH: layout.seatFootprintH,
    sideAnchorMargin: layout.sideAnchorMargin,
  });

  return {
    x: pos.left + layout.seatFootprintW / 2,
    y: pos.top + avatarCenterOffsetFromTop(layout.seatDimensions, seatOpts),
  };
}

/** Face-down deal stack — sits inside the seat ring, between avatar and table center. */
export function seatDealStackInPlayArea(
  layout: PlayAreaLayout,
  playAreaHeight: number,
  playerId: string,
  layoutSeatIds: string[],
  localPlayerIds: string[],
  options?: SeatOriginOptions,
): { x: number; y: number } | null {
  const origin = seatOriginInPlayArea(
    layout,
    playAreaHeight,
    playerId,
    layoutSeatIds,
    localPlayerIds,
    options,
  );
  if (!origin) return null;

  const seatIndex = layoutSeatIds.indexOf(playerId);
  if (seatIndex < 0) return null;

  const compact = layoutSeatIds.length >= 6;
  const isLocal = localPlayerIds.includes(playerId);
  const avatarSize = avatarSizeForSeat(layout.seatDimensions, { compact, isLocal });
  const inset = avatarSize * DEAL_STACK_TOWARD_CENTER;
  const angle = ringAngleForSeat(seatIndex, layoutSeatIds.length);
  const { dx, dy } = ringInwardOffset(angle, inset);

  return {
    x: origin.x + dx,
    y: origin.y + dy,
  };
}

export function playGroupTargetFromSpot(
  spot: FrozenPlaySpot,
  play: TrickPlayDisplay,
  layout: PlayAreaLayout,
  cardW: number,
  cardH: number,
): { x: number; y: number; cardW: number; cardH: number } {
  const maxSpreadWidth = layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO;
  const bundleCapRatio =
    play.cards.length >= 3 && isRun(play.cards)
      ? 0.95
      : play.cards.length > 1 && allSameValue(play.cards)
        ? 1
        : 0.68;
  const bundle = layoutPlayBundle(
    play.cards,
    cardW,
    Math.round(maxSpreadWidth * bundleCapRatio),
    cardH,
  );

  return {
    x: layout.cardZoneLeft + spot.left + bundle.width / 2,
    y: layout.cardZoneTop + spot.top + bundle.height / 2,
    cardW,
    cardH,
  };
}
