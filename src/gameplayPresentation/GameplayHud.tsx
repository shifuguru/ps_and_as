import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { Card } from "../game/ruleset";
import type { TrickHistory } from "../game/core";
import MenuIcon from "../components/MenuIcon";
import { useAppTheme } from "../context/ThemeContext";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { hexToRgba } from "../utils/colorTheory";
import { resolveCompactHeightTier } from "../utils/compactGameLayout";
import { triggerHaptic } from "../utils/haptics";
import { GAMEPLAY_PRESENTATION } from "./featureFlags";
import {
  HUD_CLUSTER_GAP,
  resolveHudCardHeight,
  resolveHudDensity,
} from "./hudLayout";
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
  onOpenReadMe?: () => void;
  onOpenSettings?: () => void;
  /** Open curated quick-chat picker. */
  onOpenTableChat?: () => void;
  /** Secondary leave control — never in the Pass/Play ActionBar track. */
  onLeave?: () => void;
  /**
   * Hide tricks / winning play / prestige — not Round Streak, util buttons, or unlock toasts.
   * Persist chrome stays visible during deal (under seats / deal flights).
   */
  hideFeedback?: boolean;
  /** Suppress XP / unlock toasts (e.g. deal ceremony). Rankings still allow unlock toasts. */
  hideToasts?: boolean;
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
 *
 * Persist layer (z below play area): Round Streak + utility actions.
 * Feedback layer: Winning Play, Tricks, XP toasts, optional prestige.
 *
 *   Round Streak                [Leave] [Rules] [Stats] [Settings]
 *              (Next Prestige — centered, off by default)
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
  onOpenReadMe,
  onOpenSettings,
  onOpenTableChat,
  onLeave,
  hideFeedback = false,
  hideToasts = false,
  statsRefreshKey = 0,
}: Props) {
  const { colors } = useAppTheme();
  const { height: shellHeight } = useVisualViewportSize();
  const tier = resolveCompactHeightTier(shellHeight);
  const density = resolveHudDensity(shellHeight, tier);
  const hudCardHeight = resolveHudCardHeight(density);
  const [roundsCurrent, setRoundsCurrent] = useState(0);
  const [roundsBest, setRoundsBest] = useState(0);
  const lastSignal = React.useRef(0);
  const bottom = Math.max(0, feedbackBottom);
  /**
   * Tricks / Winning Play share the resting-card feedback line.
   * On short shells stay flush — lifting them eats the table.
   */
  const trickWidgetsBottom =
    density === "comfortable" ? Math.round(bottom * 1.05) : bottom;
  const styles = useMemo(
    () => createStyles(colors, trickWidgetsBottom, hudCardHeight, density),
    [colors, trickWidgetsBottom, hudCardHeight, density],
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

  const padTop = Math.max(0, topInset);

  return (
    <>
      {/*
        Persist chrome — above vignette/felt, below seats / deal / bottom bar.
        Stays up during deal so Round Streak + util buttons remain in corner.
      */}
      <View
        style={[styles.persistHost, { paddingTop: padTop }]}
        pointerEvents="box-none"
      >
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.corner} pointerEvents="box-none">
            {GAMEPLAY_PRESENTATION.roundsInRow ? (
              <RoundsInRowWidget
                current={roundsCurrent}
                best={roundsBest}
                density={density}
              />
            ) : null}
          </View>
          <View style={styles.utilRow}>
            {onLeave ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={() => {
                  triggerHaptic("light");
                  onLeave();
                }}
                accessibilityRole="button"
                accessibilityLabel="Leave Game"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="leave" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
            {onOpenAchievements ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={onOpenAchievements}
                accessibilityRole="button"
                accessibilityLabel="Achievements and statistics"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="trophy" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
            {onOpenReadMe ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={onOpenReadMe}
                accessibilityRole="button"
                accessibilityLabel="Game rules"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="list" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
            {onOpenTableChat ? (
              <TouchableOpacity
                style={styles.utilBtn}
                onPress={() => {
                  triggerHaptic("light");
                  onOpenTableChat();
                }}
                accessibilityRole="button"
                accessibilityLabel="Quick chat"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MenuIcon name="chat" size={16} color={colors.accent} />
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
                <MenuIcon name="gear" size={16} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {!hideFeedback ? (
        <View
          style={[styles.feedbackHost, { paddingTop: padTop }]}
          pointerEvents="box-none"
        >
          {GAMEPLAY_PRESENTATION.upcomingAchievements ? (
            <View style={styles.prestigeCenter} pointerEvents="box-none">
              <GameplayAchievementWidget
                onOpenAchievements={onOpenAchievements}
                refreshKey={statsRefreshKey}
              />
            </View>
          ) : null}

          <View style={styles.bottomRow} pointerEvents="box-none">
            <View style={styles.corner} pointerEvents="none">
              {GAMEPLAY_PRESENTATION.lastTrick ? (
                <LastTrickWidget
                  info={lastTrick ?? null}
                  suppress={suppressLastTrick}
                  density={density}
                />
              ) : null}
            </View>
            <View
              style={[styles.corner, styles.cornerRight]}
              pointerEvents="box-none"
            >
              {GAMEPLAY_PRESENTATION.trickScore ? (
                <TrickScoreWidget rows={trickRows} density={density} />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Unlock / XP toasts — stay up during rankings so completions can notify. */}
      <View style={styles.toastLayer} pointerEvents="box-none">
        <ProgressionToastHost enabled={!hideToasts} bottomInset={bottom} />
      </View>
    </>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  feedbackBottom: number,
  hudCardHeight: number,
  density: ReturnType<typeof resolveHudDensity>,
) {
  const dense = density !== "comfortable";
  const utilSize = density === "ultra" ? 32 : dense ? 34 : 36;
  return StyleSheet.create({
    /** Above vignette (0), below play area / deal / bottom bar. */
    persistHost: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
      elevation: 1,
      paddingHorizontal: dense ? 6 : 8,
    },
    feedbackHost: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      elevation: 40,
      paddingHorizontal: dense ? 6 : 8,
    },
    toastLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 55,
      elevation: 55,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: dense ? 6 : HUD_CLUSTER_GAP,
    },
    prestigeCenter: {
      position: "absolute",
      left: 8,
      right: 8,
      top: hudCardHeight + HUD_CLUSTER_GAP + 4,
      alignItems: "center",
    },
    utilRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: dense ? 6 : HUD_CLUSTER_GAP,
      paddingTop: 0,
    },
    utilBtn: {
      width: utilSize,
      height: utilSize,
      borderRadius: utilSize / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.35),
      backgroundColor: hexToRgba(
        colors.mode === "dark" ? "#0a1a12" : "#ffffff",
        0.28,
      ),
    },
    bottomRow: {
      position: "absolute",
      left: dense ? 6 : 8,
      right: dense ? 6 : 8,
      bottom: feedbackBottom,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: dense ? 6 : 10,
    },
    corner: {
      maxWidth: density === "ultra" ? "38%" : dense ? "42%" : "46%",
    },
    cornerRight: {
      alignItems: "flex-end",
    },
  });
}
