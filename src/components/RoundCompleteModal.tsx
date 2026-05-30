import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import BlurPanel from "./BlurPanel";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import AccentBorderButton from "./AccentBorderButton";

import { roleEmoji, roleForPlacement } from "../utils/roundRoles";
import { livingFinishedOrder } from "../game/deadHand";

type Player = { id: string; name: string; isDeadHand?: boolean };

type Props = {
  visible: boolean;
  finishedOrder: string[];
  players: Player[];
  readyStates: Record<string, boolean>;
  /** Total XP to show beside each player name on the scoreboard. */
  playerXp?: Record<string, number>;
  /** XP earned this round only — animates into playerXp on open. */
  playerRoundXp?: Record<string, number>;
  /** Local human on this device — used to highlight row and toggle ready. */
  localPlayerId?: string;
  /** Watching in dead-hand mode — can claim the open seat between rounds. */
  spectatorMode?: boolean;
  deadHandSeatOpen?: boolean;
  onQuit: () => void;
  onToggleReady: () => void;
  /** Wait until career totals are loaded before running the XP absorb animation. */
  xpAnimationReady?: boolean;
};

const ABSORB_MS = 1500;
const ROW_STAGGER_MS = 140;
const OPEN_DELAY_MS = 420;

function RankXpDisplay({
  visible,
  animationReady,
  rowDelay,
  finalTotal,
  roundEarned,
  feltGreen,
  styles,
}: {
  visible: boolean;
  animationReady: boolean;
  rowDelay: number;
  finalTotal: number;
  roundEarned: number;
  feltGreen: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const startTotal = Math.max(0, finalTotal - roundEarned);
  const [displayTotal, setDisplayTotal] = useState(startTotal);
  const [displayRound, setDisplayRound] = useState(roundEarned);

  useEffect(() => {
    setDisplayTotal(startTotal);
    setDisplayRound(roundEarned);

    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    if (!animationReady) {
      progress.setValue(0);
      setDisplayTotal(startTotal);
      setDisplayRound(roundEarned);
      return;
    }

    if (roundEarned <= 0) {
      progress.setValue(1);
      setDisplayTotal(finalTotal);
      setDisplayRound(0);
      return;
    }

    progress.setValue(0);
    const listener = progress.addListener(({ value }) => {
      setDisplayTotal(Math.round(startTotal + roundEarned * value));
      setDisplayRound(Math.round(roundEarned * (1 - value)));
    });

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: ABSORB_MS,
      delay: OPEN_DELAY_MS + rowDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();

    return () => {
      anim.stop();
      progress.removeListener(listener);
    };
  }, [visible, animationReady, finalTotal, roundEarned, rowDelay, startTotal, progress]);

  const roundOpacity =
    displayRound > 0 ? 1 : roundEarned > 0 ? 0.45 : 0.35;

  return (
    <View style={styles.xpBlock}>
      <Text style={styles.rankXpTotal}>{displayTotal.toLocaleString()} XP</Text>
      <Text
        style={[
          styles.rankXpRound,
          { color: feltGreen, opacity: roundOpacity },
        ]}
      >
        + {displayRound.toLocaleString()} XP
      </Text>
    </View>
  );
}

export default function RoundCompleteModal({
  visible,
  finishedOrder,
  players,
  readyStates,
  playerXp = {},
  playerRoundXp = {},
  localPlayerId,
  spectatorMode = false,
  deadHandSeatOpen = false,
  onQuit,
  onToggleReady,
  xpAnimationReady = true,
}: Props) {
  const { colors, ui, blur, palette } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const feltGreen = palette.complementBright;
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 420);
  const readyCount = Object.values(readyStates).filter(Boolean).length;
  const isReady = localPlayerId ? !!readyStates[localPlayerId] : false;
  const canClaimSeat = spectatorMode && deadHandSeatOpen;
  const readyDenominator = canClaimSeat
    ? players.length + 1
    : players.length;
  const rankedOrder = useMemo(
    () => livingFinishedOrder(players, finishedOrder),
    [players, finishedOrder],
  );
  const livingCount = players.filter((p) => !p.isDeadHand && p.id !== "__dead_hand__").length;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Round Complete</Text>
          <Text style={[ui.modalBody, { fontSize: 22, marginBottom: 18 }]}>Final Rankings</Text>

          <View style={styles.rankings}>
            {rankedOrder.map((playerId, index) => {
              const player = players.find((p) => p.id === playerId);
              if (!player) return null;

              const role = roleForPlacement(index, livingCount || rankedOrder.length);
              const emoji = roleEmoji(role);
              const ready = !!readyStates[playerId];
              const isLocal = playerId === localPlayerId;
              const finalTotal = playerXp[playerId] ?? 0;
              const roundEarned = playerRoundXp[playerId] ?? 0;

              return (
                <View
                  key={playerId}
                  style={[styles.rankRow, isLocal && styles.rankRowLocal]}
                >
                  <Text style={styles.rankIndex}>{index + 1}</Text>
                  <View style={styles.rankBody}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={styles.rankRole}>
                      {emoji ? `${emoji} ` : ""}
                      {role}
                    </Text>
                  </View>
                  <RankXpDisplay
                    visible={visible}
                    animationReady={xpAnimationReady}
                    rowDelay={index * ROW_STAGGER_MS}
                    finalTotal={finalTotal}
                    roundEarned={roundEarned}
                    feltGreen={feltGreen}
                    styles={styles}
                  />
                  {ready ? (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>Ready</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Text style={styles.readyCount}>
            {readyCount} / {readyDenominator}{" "}
            {canClaimSeat ? "Ready (incl. open seat)" : "Players Ready"}
          </Text>

          {canClaimSeat ? (
            <Text style={styles.spectatorHint}>
              Tap below to take the dead hand&apos;s seat next round.
            </Text>
          ) : null}

          <View style={ui.actionTrack}>
            <TouchableOpacity
              style={ui.actionSecondary}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("light");
                onQuit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Quit Game"
            >
              <Text style={ui.actionSecondaryText}>Quit Game</Text>
            </TouchableOpacity>

            <AccentBorderButton
              accentColor={colors.gold}
              borderRadius={14}
              animate={!isReady}
              style={{ flex: 1.45 }}
              contentStyle={[
                ui.actionPrimary,
                { borderWidth: 0 },
                isReady && { backgroundColor: colors.gold },
              ]}
              activeOpacity={0.82}
              onPress={() => {
                triggerHaptic("medium");
                onToggleReady();
              }}
              accessibilityLabel={
                canClaimSeat
                  ? isReady
                    ? "Give up open seat"
                    : "Take open seat next round"
                  : isReady
                    ? "Mark Unready For Next Round"
                    : "Ready For Next Round"
              }
            >
              <Text
                style={[
                  ui.actionPrimaryText,
                  isReady && { color: colors.textOnGold },
                ]}
              >
                {canClaimSeat
                  ? isReady
                    ? "Give Up Seat"
                    : "Take Open Seat"
                  : isReady
                    ? "Not Ready"
                    : "Next Round"}
              </Text>
            </AccentBorderButton>
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
  rankings: {
    width: "100%",
    marginBottom: 14,
    gap: 6,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  rankRowLocal: {
    borderColor: colors.btnGoldBorder,
    backgroundColor: colors.btnGoldBg,
  },
  rankIndex: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  rankBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    marginRight: 8,
  },
  rankName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  xpBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexShrink: 0,
    marginLeft: 4,
  },
  rankXpTotal: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.15,
    fontVariant: ["tabular-nums"],
  },
  rankXpRound: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.12,
    fontVariant: ["tabular-nums"],
  },
  rankRole: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  readyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.btnGoldBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.btnGoldBorder,
  },
  readyBadgeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  readyCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
    marginBottom: 14,
  },
  spectatorHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  });
}
