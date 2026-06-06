import type { CardFlightSpec } from "../components/TableCardFlight";
import type { Card as CardType } from "../game/ruleset";
import type { PlayAreaLayout } from "./tableLayout";
import { tableScaleLimits } from "./tableLayout";
import {
  computePlayStackLayout,
  MAX_SPREAD_WIDTH_RATIO,
  stackSpotForPlay,
} from "./tablePlayLayout";
import type { TrickPlayDisplay } from "./trickDisplay";
import {
  playDisplayKey,
  playFlightMaxBundleWidth,
  playGroupTargetFromSpot,
} from "./tablePlayFlight";

export type LocalHandFlightCapture = {
  playKey: string;
  screenX: number;
  screenY: number;
  fromCardW: number;
  fromCardH: number;
};

/** Screen-space flight spec for a play that just left the local hand. */
export function buildLocalHandElevatedFlight(
  capture: LocalHandFlightCapture,
  play: TrickPlayDisplay,
  plays: TrickPlayDisplay[],
  layout: PlayAreaLayout,
  playAreaWindow: { x: number; y: number },
): CardFlightSpec | null {
  const playIndex = plays.findIndex(
    (p) => playDisplayKey(p) === playDisplayKey(play),
  );
  if (playIndex < 0) return null;

  const scaleLimits = tableScaleLimits(layout);
  const stackLayout = computePlayStackLayout({
    plays,
    zoneWidth: layout.cardZoneWidth,
    zoneHeight: layout.cardZoneHeight,
    maxFillScale: scaleLimits.maxFillScale,
    displayScale: scaleLimits.displayScale,
  });
  const cardW = stackLayout.cardWidth;
  const cardH = stackLayout.cardHeight;
  if (!cardW || !cardH) return null;

  const spot = stackSpotForPlay(
    playIndex,
    plays.length,
    play,
    layout.cardZoneWidth,
    layout.cardZoneHeight,
    layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO * 0.55,
    plays,
    {
      maxFillScale: scaleLimits.maxFillScale,
      displayScale: scaleLimits.displayScale,
    },
  );

  const target = playGroupTargetFromSpot(spot, play, layout, cardW, cardH);
  const maxSpreadWidth = layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO;
  const fromX = capture.screenX - playAreaWindow.x;
  const fromY = capture.screenY - playAreaWindow.y;

  return {
    id: capture.playKey,
    cards: play.cards,
    fromX: playAreaWindow.x + fromX,
    fromY: playAreaWindow.y + fromY,
    toX: playAreaWindow.x + target.x,
    toY: playAreaWindow.y + target.y,
    cardW: target.cardW,
    cardH: target.cardH,
    maxBundleWidth: playFlightMaxBundleWidth(play.cards, maxSpreadWidth),
    fromCardW: capture.fromCardW,
    fromCardH: capture.fromCardH,
    fromLocalHand: true,
  };
}

/** Re-insert outgoing cards at their pre-play hand indices for a stable fan layout. */
export function mergeOutgoingCardsAtSourceIndices(
  currentHand: CardType[],
  outgoing: CardType[],
  sourceIndices: number[],
  identity: (card: CardType) => string,
): CardType[] {
  const result = [...currentHand];
  const pairs = sourceIndices
    .map((idx, i) => ({ idx, card: outgoing[i] }))
    .filter((p) => p.card != null && p.idx >= 0)
    .sort((a, b) => b.idx - a.idx);

  for (const { idx, card } of pairs) {
    const id = identity(card);
    if (result.some((h) => identity(h) === id)) continue;
    result.splice(Math.min(idx, result.length), 0, card);
  }
  return result;
}
