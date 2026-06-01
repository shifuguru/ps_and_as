import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import OpponentSeat, { OpponentSeatPlayer } from "./OpponentSeat";
import type { OpponentRingLayout } from "../utils/tableLayout";
import type { SeatDimensions } from "../utils/seatDimensions";
import {
  opponentSeatPosition,
  ringAngleForSeat,
} from "../utils/tableLayout";
import { isDeadHandPlayer } from "../game/deadHand";
import type { AvatarBorderDesign } from "../rewards/avatarBorders";
import { isCpuPlayer } from "../utils/localPlayer";

type Props = {
  players: OpponentSeatPlayer[];
  localPlayerIds: string[];
  currentPlayerId: string;
  finishedOrder: string[];
  passedPlayerIds: string[];
  arenaWidth: number;
  arenaHeight: number;
  ringLayout: OpponentRingLayout;
  seatFootprintW: number;
  seatFootprintH: number;
  seatDimensions: SeatDimensions;
  sideAnchorMargin: number;
  lastPlayPlayerId?: string | null;
  trickWinnerPlayerId?: string | null;
  /** Total trick-win XP shown on the winner (trick + run bonus). */
  trickWinnerXpAmount?: number;
  /** Shout bubble on the trick winner's seat. */
  trickWinnerShout?: string | null;
  /** Achievement borders keyed by player id. */
  avatarBordersByPlayerId?: Record<string, AvatarBorderDesign>;
  layoutSeatIds?: string[];
  deadHandId?: string | null;
  deadHandGraveyard?: boolean;
  disconnectedPlayerIds?: string[];
  /** Show nudge bell on seats taking too long. */
  turnBellPlayerId?: string | null;
  onTurnBellPress?: (playerId: string) => void;
  /** Per-player dealt counts during deal ceremony (face-down mini-stacks). */
  dealtStackCounts?: Record<string, number>;
  /** Open a player's profile / stats card. */
  onPlayerPress?: (playerId: string) => void;
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
  seatFootprintW,
  seatFootprintH,
  seatDimensions,
  sideAnchorMargin,
  lastPlayPlayerId,
  trickWinnerPlayerId,
  trickWinnerXpAmount,
  trickWinnerShout = null,
  avatarBordersByPlayerId = {},
  layoutSeatIds,
  deadHandGraveyard = false,
  disconnectedPlayerIds = [],
  turnBellPlayerId = null,
  onTurnBellPress,
  dealtStackCounts,
  onPlayerPress,
}: Props) {
  const disconnectedSet = useMemo(
    () => new Set(disconnectedPlayerIds),
    [disconnectedPlayerIds],
  );
  const localSet = useMemo(
    () => new Set(localPlayerIds),
    [localPlayerIds],
  );
  const seatIds = useMemo(() => {
    if (layoutSeatIds && layoutSeatIds.length > 0) return layoutSeatIds;
    return [
      ...localPlayerIds,
      ...players.filter((p) => !localSet.has(p.id)).map((p) => p.id),
    ];
  }, [layoutSeatIds, localPlayerIds, players, localSet]);

  const playersById = useMemo(() => {
    const map = new Map<string, OpponentSeatPlayer>();
    for (const player of players) {
      map.set(player.id, player);
    }
    return map;
  }, [players]);

  const passedSet = useMemo(
    () => new Set(passedPlayerIds),
    [passedPlayerIds],
  );

  const finishedSet = useMemo(
    () => new Set(finishedOrder),
    [finishedOrder],
  );

  if (seatIds.length === 0 || arenaWidth <= 0 || arenaHeight <= 0) {
    return null;
  }

  const compact = ringLayout.totalPlayers >= 6;
  const totalPlayers = ringLayout.totalPlayers;

  return (
    <View style={styles.arena} pointerEvents="box-none">
      {seatIds.map((playerId, seatIndex) => {
        if (seatIndex >= totalPlayers) return null;

        const player = playersById.get(playerId);
        if (!player) return null;

        const isLocal = localSet.has(playerId);
        const angle = ringAngleForSeat(seatIndex, totalPlayers);
        const isOut = finishedSet.has(player.id);
        const isActive = !isOut && player.id === currentPlayerId;
        const isCPU = isCpuPlayer(player);
        const isLastPlay =
          !!lastPlayPlayerId && player.id === lastPlayPlayerId && !isOut;
        const celebrateTrickWin =
          !!trickWinnerPlayerId && player.id === trickWinnerPlayerId && !isOut;

        const pos = opponentSeatPosition(angle, {
          cx: ringLayout.cx,
          cy: ringLayout.cy,
          radius: ringLayout.radius,
          arenaWidth,
          footprintW: seatFootprintW,
          footprintH: seatFootprintH,
          sideAnchorMargin,
        });

        return (
          <View
            key={player.id}
            style={[styles.seatSlot, pos, { width: seatFootprintW }]}
            pointerEvents="box-none"
          >
            <OpponentSeat
              player={player}
              isActive={isActive}
              isOut={isOut}
              hasPassed={passedSet.has(player.id)}
              isThinking={isActive && isCPU}
              isLocal={isLocal}
              isLastPlay={isLastPlay}
              celebrateTrickWin={celebrateTrickWin}
              trickShout={celebrateTrickWin ? trickWinnerShout : null}
              avatarBorder={avatarBordersByPlayerId[player.id] ?? null}
              showTrickXp={celebrateTrickWin}
              trickXpAmount={trickWinnerXpAmount}
              compact={compact}
              seatDims={seatDimensions}
              layoutWidth={arenaWidth}
              graveyardMode={deadHandGraveyard && isDeadHandPlayer(player)}
              isDisconnected={disconnectedSet.has(player.id)}
              showTurnBell={
                !!turnBellPlayerId &&
                player.id === turnBellPlayerId &&
                !isOut &&
                !isCPU &&
                !isLocal
              }
              onTurnBellPress={
                onTurnBellPress
                  ? () => onTurnBellPress(player.id)
                  : undefined
              }
              dealtStackCount={dealtStackCounts?.[player.id] ?? 0}
              onAvatarPress={
                onPlayerPress && !isDeadHandPlayer(player)
                  ? () => onPlayerPress(player.id)
                  : undefined
              }
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
    alignItems: "center",
    overflow: "visible",
  },
});
