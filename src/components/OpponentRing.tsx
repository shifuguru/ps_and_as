import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import OpponentSeat, { OpponentSeatPlayer } from "./OpponentSeat";
import type { OpponentRingLayout } from "../utils/tableLayout";
import {
  SEAT_FOOTPRINT_H,
  SEAT_FOOTPRINT_W,
  opponentRowPositions,
} from "../utils/tableLayout";

type Props = {
  players: OpponentSeatPlayer[];
  localPlayerIds: string[];
  currentPlayerId: string;
  finishedOrder: string[];
  passedPlayerIds: string[];
  arenaWidth: number;
  arenaHeight: number;
  ringLayout: OpponentRingLayout;
};

/** Order opponents clockwise from the seat after the local player. */
export function orderOpponents(
  players: OpponentSeatPlayer[],
  localPlayerIds: string[],
  allPlayerIds: string[],
): OpponentSeatPlayer[] {
  const localSet = new Set(localPlayerIds);
  const opponents = players.filter((p) => !localSet.has(p.id));
  if (opponents.length === 0) return [];

  const anchorId =
    localPlayerIds.find((id) => allPlayerIds.includes(id)) ?? allPlayerIds[0];
  const anchorIndex = allPlayerIds.indexOf(anchorId);
  if (anchorIndex < 0) return opponents;

  const ordered: OpponentSeatPlayer[] = [];
  for (let i = 1; i <= allPlayerIds.length; i++) {
    const id = allPlayerIds[(anchorIndex + i) % allPlayerIds.length];
    const seat = opponents.find((p) => p.id === id);
    if (seat) ordered.push(seat);
  }
  return ordered;
}

/** Degrees clockwise from top (0° = 12 o'clock). Arc spans the top/sides only. */
function opponentAngles(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];

  const span = Math.max(140, Math.min(220, 34 * (count - 1)));
  const start = -span / 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function polarSeatPosition(
  angleDeg: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  minTop: number,
  arenaWidth: number,
  arenaHeight: number,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + rx * Math.sin(rad) - SEAT_FOOTPRINT_W / 2;
  const y = cy - ry * Math.cos(rad) - SEAT_FOOTPRINT_H / 2;
  const maxTop = Math.max(minTop, arenaHeight - SEAT_FOOTPRINT_H - 4);
  return {
    left: Math.max(0, Math.min(x, arenaWidth - SEAT_FOOTPRINT_W)),
    top: Math.max(minTop, Math.min(y, maxTop)),
  };
}

export default function OpponentRing({
  players,
  localPlayerIds,
  currentPlayerId,
  finishedOrder,
  passedPlayerIds,
  arenaWidth,
  arenaHeight,
  ringLayout,
}: Props) {
  const allPlayerIds = useMemo(
    () => players.map((p) => p.id),
    [players],
  );

  const opponents = useMemo(
    () => orderOpponents(players, localPlayerIds, allPlayerIds),
    [players, localPlayerIds, allPlayerIds],
  );

  const passedSet = useMemo(
    () => new Set(passedPlayerIds),
    [passedPlayerIds],
  );

  const finishedSet = useMemo(
    () => new Set(finishedOrder),
    [finishedOrder],
  );

  const angles = useMemo(
    () => opponentAngles(opponents.length),
    [opponents.length],
  );

  const rowPositions = useMemo(
    () =>
      ringLayout.mode === "row"
        ? opponentRowPositions(
            opponents.length,
            arenaWidth,
            ringLayout.rowY,
            ringLayout.rowSpan,
          )
        : [],
    [ringLayout, opponents.length, arenaWidth],
  );

  if (opponents.length === 0 || arenaWidth <= 0 || arenaHeight <= 0) {
    return null;
  }

  const compact = opponents.length >= 5;

  return (
    <View style={styles.arena} pointerEvents="box-none">
      {opponents.map((player, index) => {
        const isOut = finishedSet.has(player.id);
        const isActive = !isOut && player.id === currentPlayerId;
        const isCPU =
          typeof player.name === "string" && player.name.startsWith("CPU");

        const pos =
          ringLayout.mode === "row"
            ? rowPositions[index]
            : polarSeatPosition(
                angles[index],
                ringLayout.cx,
                ringLayout.cy,
                ringLayout.rx,
                ringLayout.ry,
                ringLayout.minTop,
                arenaWidth,
                arenaHeight,
              );

        return (
          <View
            key={player.id}
            style={[styles.seatSlot, pos]}
            pointerEvents="box-none"
          >
            <OpponentSeat
              player={player}
              isActive={isActive}
              isOut={isOut}
              hasPassed={passedSet.has(player.id)}
              isThinking={isActive && isCPU}
              compact={compact}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  arena: {
    flex: 1,
    width: "100%",
  },
  seatSlot: {
    position: "absolute",
    width: SEAT_FOOTPRINT_W,
    alignItems: "center",
  },
});
