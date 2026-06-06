import type { CardFlightSpec } from "../components/TableCardFlight";
import { allSameValue, isRun } from "../game/core";
import type { PlayAreaLayout } from "./tableLayout";
import { tableScaleLimits } from "./tableLayout";
import {
  computePlayStackLayout,
  layoutPlayBundle,
  MAX_SPREAD_WIDTH_RATIO,
  stackSpotForPlay,
} from "./tablePlayLayout";
import {
  playDisplayKey,
  playFlightMaxBundleWidth,
  playGroupTargetFromSpot,
} from "./tablePlayFlight";
import type { TrickPlayDisplay } from "./trickDisplay";

/** Temporary — remove after flight/pile alignment is verified in production. */
export const ENABLE_FLIGHT_LAND_DIAGNOSTICS = true;

function bundleCapForTable(
  cards: TrickPlayDisplay["cards"],
  maxSpreadWidth: number,
): number {
  const ratio =
    cards.length >= 3 && isRun(cards)
      ? 0.95
      : cards.length > 1 && allSameValue(cards)
        ? 1
        : 0.68;
  return Math.round(maxSpreadWidth * ratio);
}

export type FlightLandDiagnostic = {
  playKey: string;
  fromLocalHand: boolean;
  flightCentre: { x: number; y: number };
  pileCentreTarget: { x: number; y: number };
  pileCentreTable: { x: number; y: number };
  deltaTarget: { x: number; y: number };
  deltaTable: { x: number; y: number };
  zoneWidthHint: number;
  zoneHeightHint: number;
  zoneWidthTable: number;
  zoneHeightTable: number;
  groupWidthTarget: number;
  groupWidthTable: number;
  usedPlayGroupSize: boolean;
};

export function computeFlightLandDiagnostic(
  flight: Pick<
    CardFlightSpec,
    "id" | "toX" | "toY" | "cards" | "cardW" | "cardH" | "fromLocalHand"
  >,
  plays: TrickPlayDisplay[],
  layout: PlayAreaLayout,
  zoneWidthTable: number,
  zoneHeightTable: number,
): FlightLandDiagnostic | null {
  const playIndex = plays.findIndex((p) => playDisplayKey(p) === flight.id);
  if (playIndex < 0) return null;
  const play = plays[playIndex];
  const scaleLimits = tableScaleLimits(layout);

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

  const target = playGroupTargetFromSpot(
    spot,
    play,
    layout,
    flight.cardW,
    flight.cardH,
  );
  const maxSpreadHint = layout.cardZoneWidth * MAX_SPREAD_WIDTH_RATIO;
  const bundleTarget = layoutPlayBundle(
    play.cards,
    flight.cardW,
    playFlightMaxBundleWidth(play.cards, maxSpreadHint),
    flight.cardH,
  );

  const tableZoneW = zoneWidthTable > 0 ? zoneWidthTable : layout.cardZoneWidth;
  const tableZoneH =
    zoneHeightTable > 0 ? zoneHeightTable : layout.cardZoneHeight;
  const tableLayout = computePlayStackLayout({
    plays,
    zoneWidth: tableZoneW,
    zoneHeight: tableZoneH,
    maxFillScale: scaleLimits.maxFillScale,
    displayScale: scaleLimits.displayScale,
  });
  const pos = tableLayout.positions[playIndex] ?? { left: 0, top: 0 };
  const maxSpreadTable = tableZoneW * MAX_SPREAD_WIDTH_RATIO;
  const bundleTable = layoutPlayBundle(
    play.cards,
    tableLayout.cardWidth,
    bundleCapForTable(play.cards, maxSpreadTable),
    tableLayout.cardHeight,
  );
  const layoutGroupSize = tableLayout.playGroupSizes?.[playIndex];
  const groupWidth = layoutGroupSize?.width ?? bundleTable.width;
  const groupHeight = layoutGroupSize?.height ?? bundleTable.height;

  const flightCentre = { x: flight.toX, y: flight.toY };
  const pileCentreTarget = { x: target.x, y: target.y };
  const pileCentreTable = {
    x: layout.cardZoneLeft + pos.left + groupWidth / 2,
    y: layout.cardZoneTop + pos.top + groupHeight / 2,
  };

  return {
    playKey: flight.id,
    fromLocalHand: !!flight.fromLocalHand,
    flightCentre,
    pileCentreTarget,
    pileCentreTable,
    deltaTarget: {
      x: flightCentre.x - pileCentreTarget.x,
      y: flightCentre.y - pileCentreTarget.y,
    },
    deltaTable: {
      x: flightCentre.x - pileCentreTable.x,
      y: flightCentre.y - pileCentreTable.y,
    },
    zoneWidthHint: layout.cardZoneWidth,
    zoneHeightHint: layout.cardZoneHeight,
    zoneWidthTable: tableZoneW,
    zoneHeightTable: tableZoneH,
    groupWidthTarget: bundleTarget.width,
    groupWidthTable: groupWidth,
    usedPlayGroupSize: layoutGroupSize != null,
  };
}

export function logFlightLandDiagnostic(diag: FlightLandDiagnostic): void {
  if (!ENABLE_FLIGHT_LAND_DIAGNOSTICS) return;
  console.log(
    "[FLIGHT]",
    `playKey=${diag.playKey}`,
    `flightCentre=(${diag.flightCentre.x.toFixed(1)},${diag.flightCentre.y.toFixed(1)})`,
    `pileCentreTarget=(${diag.pileCentreTarget.x.toFixed(1)},${diag.pileCentreTarget.y.toFixed(1)})`,
    `pileCentreTable=(${diag.pileCentreTable.x.toFixed(1)},${diag.pileCentreTable.y.toFixed(1)})`,
    `deltaTarget=(${diag.deltaTarget.x.toFixed(1)},${diag.deltaTarget.y.toFixed(1)})`,
    `deltaTable=(${diag.deltaTable.x.toFixed(1)},${diag.deltaTable.y.toFixed(1)})`,
    `zoneHint=${diag.zoneWidthHint}x${diag.zoneHeightHint}`,
    `zoneTable=${diag.zoneWidthTable}x${diag.zoneHeightTable}`,
    `groupW target=${diag.groupWidthTarget.toFixed(1)} table=${diag.groupWidthTable.toFixed(1)}`,
    `playGroupSize=${diag.usedPlayGroupSize}`,
    `fromLocalHand=${diag.fromLocalHand}`,
  );
}

export type MeasurableNode = {
  measureInWindow?: (
    cb: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export function logMeasuredPileCentre(
  playKey: string,
  playGroupNode: MeasurableNode | null | undefined,
  flightCentreScreen: { x: number; y: number },
): void {
  if (!ENABLE_FLIGHT_LAND_DIAGNOSTICS || !playGroupNode?.measureInWindow) return;
  playGroupNode.measureInWindow((x, y, width, height) => {
    const pileCentre = { x: x + width / 2, y: y + height / 2 };
    const delta = {
      x: flightCentreScreen.x - pileCentre.x,
      y: flightCentreScreen.y - pileCentre.y,
    };
    console.log(
      "[FLIGHT measured]",
      `playKey=${playKey}`,
      `flightCentreScreen=(${flightCentreScreen.x.toFixed(1)},${flightCentreScreen.y.toFixed(1)})`,
      `pileCentreScreen=(${pileCentre.x.toFixed(1)},${pileCentre.y.toFixed(1)})`,
      `delta=(${delta.x.toFixed(1)},${delta.y.toFixed(1)})`,
    );
  });
}
