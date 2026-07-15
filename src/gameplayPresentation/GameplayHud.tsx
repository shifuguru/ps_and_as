import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Card } from "../game/ruleset";
import type { TrickHistory } from "../game/core";
import MenuIcon from "../components/MenuIcon";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { GAMEPLAY_PRESENTATION } from "./featureFlags";
import { HUD_CLUSTER_GAP } from "./hudLayout";
import GameplayAchievementWidget from "./GameplayAchievementWidget";
import RoundsInRowWidget from "./RoundsInRowWidget";
import TrickScoreWidget, { type TrickScoreRow } from "./TrickScoreWidget";
import LastTrickWidget, { type LastTrickInfo } from "./LastTrickWidget";
import ProgressionToastHost from "./ProgressionToastHost";
import {
  loadRoundsInRowBest,
  persistRoundsInRowBest,
} from "./roundsInRowStorage";

type PlayerLite = { id: string; name: string; isDeadHand?: boolean };

type Props = {
  topInset: number;
  /**
   * Shared feedback anchor — px from screen bottom (resolveHandFeedbackBottom).
   * Winning Play, Tricks, and XP toasts share this edge above resting cards.
   */
  feedbackBottom: number;
  players: PlayerLite[];
  localPlayerId?: string | null;
  trickHistory?: TrickHistory[];
  suppressLastTrick?: boolean;
  roundCompleteSignal: number;
  lastTrick?: LastTrickInfo | null;
  onOpenAchievements?: () => void;
  onOpenSettings?: () => void;
  hide?: boolean;
  /** Refresh upcoming achievement snapshot */
  statsRefreshKey?: number;
};

export function deriveTrickScoreRows(
  players: PlayerLite[],
  trickHistory: TrickHistory[] | undefined,
  localPlayerId?: string | null,
): TrickScoreRow[] {
  const hist = trickHistory ?? [];
  return players
    .filter((p) => !p.isDeadHand)
    .map((p) => ({
      id: p.id,
      name: p.name,
      tricks: hist.filter((t) => {
        const winnerId =
          t.winnerId ??
          players.find((x) => x.name === t.winnerName)?.id;
        return winnerId === p.id;
      }).length,
      isYou: !!localPlayerId && p.id === localPlayerId,
    }));
}

export function lastTrickFromHistory(
  trickHistory: TrickHistory[] | undefined,
): LastTrickInfo | null {
  if (!trickHistory?.length) return null;
  return lastTrickFromEntry(trickHistory[trickHistory.length - 1]);
}

/** Winning play for a completed trick — winner's last cards, not merely the final action. */
export function lastTrickFromEntry(
  trick: TrickHistory | null | undefined,
): LastTrickInfo | null {
  if (!trick?.winnerId) return null;
  const plays = trick.actions.filter(
    (a) => a.type === "play" && a.cards && a.cards.length > 0,
  );
  const winning =
    [...plays].reverse().find((a) => a.playerId === trick.winnerId) ??
    plays[plays.length - 1];
  const cards = (winning?.cards ?? []) as Card[];
  if (!cards.length) return null;
  const cardSig = cards.map((c) => `${c.suit}:${c.value}`).join(",");
  return {
    trickKey: `${trick.trickNumber}-${trick.winnerId}-${cardSig}`,
    winnerName: trick.winnerName || "Player",
    winnerId: trick.winnerId,
    cards,
  };
}

/**
 * Full-screen feedback chrome.
 * Bottom widgets share feedbackBottom (just above resting hand cards).
 *
 *   Upcoming Achievement          Round Streak   [Stats] [Settings]
 *                    GAMEPLAY
 *   Winning Play               Tricks This Round
 *   ──────────── feedbackBottom (resting card tops) ────────────
 *   Hand fan headroom / selected lift
 *   ──────────────── HAND_BASELINE ────────────────
 *   Hint / Actions / safe area
 */
export default function GameplayHud({
  topInset,
  feedbackBottom,
  players,
  localPlayerId,
  trickHistory,
  suppressLastTrick,
  roundCompleteSignal,
  lastTrick,
  onOpenAchievements,
  onOpenSettings,
  hide = false,
  statsRefreshKey = 0,
}: Props) {
  const { colors } = useAppTheme();
  const [roundsCurrent, setRoundsCurrent] = useState(0);
  const [roundsBest, setRoundsBest] = useState(0);
  const lastSignal = React.useRef(0);
  const bottom = Math.max(0, feedbackBottom);
  const styles = useMemo(
    () => createStyles(colors, bottom),
    [colors, bottom],
  );

  useEffect(() => {
    void loadRoundsInRowBest().then(setRoundsBest);
  }, []);

  useEffect(() => {
    if (roundCompleteSignal <= 0) return;
    if (roundCompleteSignal === lastSignal.current) return;
    lastSignal.current = roundCompleteSignal;
    setRoundsCurrent((c) => {
      const next = c + 1;
      setRoundsBest((b) => {
        const nb = Math.max(b, next);
        if (nb > b) void persistRoundsInRowBest(nb);
        return nb;
      });
      return next;
    });
  }, [roundCompleteSignal]);

  const trickHistoryLen = trickHistory?.length ?? 0;
  // Engine often mutates trickHistory in place — length/sig catch updates even when
  // the array reference is stable.
  const trickHistorySig = (trickHistory ?? [])
    .map((t) => `${t.trickNumber}:${t.winnerId ?? t.winnerName ?? ""}`)
    .join("|");
  const trickRows = useMemo(
    () => deriveTrickScoreRows(players, trickHistory, localPlayerId),
    [players, trickHistory, localPlayerId, trickHistoryLen, trickHistorySig],
  );

  if (hide) return null;

  return (
    <View
      style={[styles.host, { paddingTop: Math.max(0, topInset) }]}
      pointerEvents="box-none"
    >
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.corner} pointerEvents="box-none">
          {GAMEPLAY_PRESENTATION.upcomingAchievements ? (
            <GameplayAchievementWidget
              onOpenAchievements={onOpenAchievements}
              refreshKey={statsRefreshKey}
            />
          ) : null}
        </View>
        <View style={styles.topRightCluster} pointerEvents="box-none">
          {GAMEPLAY_PRESENTATION.roundsInRow ? (
            <RoundsInRowWidget current={roundsCurrent} best={roundsBest} />
          ) : null}
          <View style={styles.utilRow}>
            {onOpenAchievements ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={onOpenAchievements}
                accessibilityRole="button"
                accessibilityLabel="Achievements and statistics"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="trophy" size={16} color={colors.gold} />
              </TouchableOpacity>
            ) : null}
            {onOpenSettings ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="gear" size={16} color={colors.gold} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.bottomRow} pointerEvents="box-none">
        <View style={styles.corner} pointerEvents="none">
          {GAMEPLAY_PRESENTATION.lastTrick ? (
            <LastTrickWidget
              info={lastTrick ?? null}
              suppress={suppressLastTrick}
            />
          ) : null}
        </View>
        <View style={[styles.corner, styles.cornerRight]} pointerEvents="box-none">
          {GAMEPLAY_PRESENTATION.trickScore ? (
            <TrickScoreWidget rows={trickRows} />
          ) : null}
        </View>
      </View>

      <ProgressionToastHost enabled bottomInset={bottom} />
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  feedbackBottom: number,
) {
  return StyleSheet.create({
    host: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      paddingHorizontal: 8,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: HUD_CLUSTER_GAP,
    },
    topRightCluster: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: HUD_CLUSTER_GAP,
      maxWidth: "54%",
    },
    utilRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: HUD_CLUSTER_GAP,
      paddingTop: 0,
    },
    utilBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.gold, 0.35),
      backgroundColor: hexToRgba(
        colors.mode === "dark" ? "#0a1a12" : "#ffffff",
        0.28,
      ),
    },
    bottomRow: {
      position: "absolute",
      left: 8,
      right: 8,
      bottom: feedbackBottom,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 10,
    },
    corner: {
      maxWidth: "46%",
    },
    cornerRight: {
      alignItems: "flex-end",
    },
  });
}
