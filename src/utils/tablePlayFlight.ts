import { allSameValue, isRun } from "../game/core";
import type { TrickPlayDisplay } from "./trickDisplay";
import type { PlayAreaLayout } from "./tableLayout";
import {
  opponentSeatPosition,
  ringAngleForSeat,
  LOCAL_SEAT_TABLE_LIFT,
} from "./tableLayout";
import {
  type FrozenPlaySpot,
  layoutPlayBundle,
  MAX_SPREAD_WIDTH_RATIO,
  playIdentityKey,
} from "./tablePlayLayout";

export function playDisplayKey(play: TrickPlayDisplay): string {
  return playIdentityKey(play);
}

/** Approximate avatar center in play-area coordinates. */
export function seatOriginInPlayArea(
  layout: PlayAreaLayout,
  playAreaHeight: number,
  playerId: string,
  allPlayerIds: string[],
  localPlayerIds: string[],
): { x: number; y: number } | null {
  const seatIndex = allPlayerIds.indexOf(playerId);
  if (seatIndex < 0) return null;

  if (localPlayerIds.includes(playerId)) {
    return {
      x: layout.width / 2,
      y: playAreaHeight - layout.localBandHeight * 0.42 - LOCAL_SEAT_TABLE_LIFT,
    };
  }

  const { opponentRing: ring } = layout;
  const angle = ringAngleForSeat(seatIndex, allPlayerIds.length);
  const pos = opponentSeatPosition(angle, {
    cx: ring.cx,
    cy: ring.cy,
    radius: ring.radius,
    arenaWidth: layout.width,
    footprintW: layout.seatFootprintW,
    footprintH: layout.seatFootprintH,
    sideAnchorMargin: layout.sideAnchorMargin,
  });
  const compact = allPlayerIds.length >= 6;
  const avatarCenterY = compact
    ? layout.seatDimensions.avatarCenterYCompact
    : layout.seatDimensions.avatarCenterY;

  return {
    x: pos.left + layout.seatFootprintW / 2,
    y: pos.top + avatarCenterY,
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
