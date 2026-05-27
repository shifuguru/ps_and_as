import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import OpponentSeat, { OpponentSeatPlayer } from "./OpponentSeat";
import type { OpponentRingLayout } from "../utils/tableLayout";
import {
  SEAT_FOOTPRINT_W,
  opponentRingAngles,
  polarSeatPosition,
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
  lastPlayPlayerId?: string | null;
  trickWinnerPlayerId?: string | null;
};

/** Clockwise from the seat after the local player. */
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

export default function OpponentRing({
  players,
  localPlayerIds,
  currentPlayerId,
  finishedOrder,
  passedPlayerIds,
  arenaWidth,
  arenaHeight,
  ringLayout,
  lastPlayPlayerId,
  trickWinnerPlayerId,
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
    () => opponentRingAngles(ringLayout.totalPlayers),
    [ringLayout.totalPlayers],
  );

  if (opponents.length === 0 || arenaWidth <= 0 || arenaHeight <= 0) {
    return null;
  }

  const compact = ringLayout.totalPlayers >= 6;

  return (
    <View style={styles.arena} pointerEvents="box-none">
      {opponents.map((player, index) => {
        const angle = angles[index];
        if (angle === undefined) return null;

        const isOut = finishedSet.has(player.id);
        const isActive = !isOut && player.id === currentPlayerId;
        const isCPU =
          typeof player.name === "string" && player.name.startsWith("CPU");
        const isLastPlay =
          !!lastPlayPlayerId && player.id === lastPlayPlayerId && !isOut;
        const celebrateTrickWin =
          !!trickWinnerPlayerId && player.id === trickWinnerPlayerId && !isOut;

        const pos = polarSeatPosition(
          angle,
          ringLayout.cx,
          ringLayout.cy,
          ringLayout.radius,
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
              isLastPlay={isLastPlay}
              celebrateTrickWin={celebrateTrickWin}
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
    overflow: "visible",
  },
});
