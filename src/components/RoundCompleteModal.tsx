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
import { hexToRgba } from "../utils/colorTheory";
import { isCpuPlayer } from "../utils/localPlayer";

function rankXpAnimationReady(
  player: { id: string; name: string },
  globalReady: boolean,
): boolean {
  return isCpuPlayer(player) || globalReady;
}

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
  /** Bot-hosted table — seated bots are always ready for the next deal. */
  botsAutoReady?: boolean;
  /** Server epoch ms when the next deal auto-starts (authoritative; do not compute client-side). */
  botNextRoundAt?: number | null;
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
  boardDisplayed,
  rowDelay,
  finalTotal,
  roundEarned,
  feltGreen,
  styles,
}: {
  visible: boolean;
  animationReady: boolean;
  boardDisplayed: boolean;
  rowDelay: number;
  finalTotal: number;
  roundEarned: number;
  feltGreen: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const absorbPlayedRef = useRef<string | null>(null);
  const startTotal = Math.max(0, finalTotal - roundEarned);
  const absorbKey = `${finalTotal}:${roundEarned}:${rowDelay}`;
  const [displayTotal, setDisplayTotal] = useState(startTotal);
  const [displayRound, setDisplayRound] = useState(roundEarned);
  const [showRoundXp, setShowRoundXp] = useState(false);

  const roundOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    if (!visible || !boardDisplayed) {
      progress.stopAnimation();
      progress.setValue(0);
      absorbPlayedRef.current = null;
      setDisplayTotal(startTotal);
      setDisplayRound(roundEarned);
      setShowRoundXp(false);
      return;
    }

    if (roundEarned <= 0) {
      progress.setValue(1);
      setDisplayTotal(finalTotal);
      setDisplayRound(0);
      setShowRoundXp(false);
      return;
    }

    if (absorbPlayedRef.current === absorbKey) {
      progress.setValue(1);
      setDisplayTotal(finalTotal);
      setDisplayRound(0);
      setShowRoundXp(false);
      return;
    }

    if (!animationReady) {
      progress.setValue(0);
      setDisplayTotal(startTotal);
      setDisplayRound(roundEarned);
      setShowRoundXp(roundEarned > 0);
      return;
    }

    progress.setValue(0);
    setDisplayTotal(startTotal);
    setDisplayRound(roundEarned);
    setShowRoundXp(true);
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
    anim.start(({ finished }) => {
      if (finished) {
        absorbPlayedRef.current = absorbKey;
        setDisplayRound(0);
        setShowRoundXp(false);
        setDisplayTotal(finalTotal);
      }
    });

    return () => {
      anim.stop();
      progress.removeListener(listener);
    };
  }, [
    visible,
    boardDisplayed,
    animationReady,
    finalTotal,
    roundEarned,
    rowDelay,
    startTotal,
    absorbKey,
    progress,
  ]);

  return (
    <View style={styles.xpBlock}>
      {showRoundXp ? (
        <Animated.Text
          style={[
            styles.rankXpRound,
            { color: feltGreen, opacity: roundOpacity },
          ]}
        >
          + {displayRound.toLocaleString()} XP
        </Animated.Text>
      ) : null}
      <Text style={styles.rankXpTotal}>{displayTotal.toLocaleString()} XP</Text>
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
  botsAutoReady = false,
  botNextRoundAt = null,
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
  const canClaimSeat = spectatorMode && deadHandSeatOpen;
  const displayReadyStates = useMemo(() => {
    if (!botsAutoReady) return readyStates;
    const next = { ...readyStates };
    for (const p of players) {
      if (isCpuPlayer(p)) next[p.id] = true;
    }
    return next;
  }, [readyStates, botsAutoReady, players]);
  const isReady = localPlayerId ? !!displayReadyStates[localPlayerId] : false;
  const seatedForReady = useMemo(
    () =>
      players.filter(
        (p) => !p.isDeadHand && p.id !== "__dead_hand__" && !isCpuPlayer(p),
      ),
    [players],
  );
  const readyDenominator =
    botsAutoReady && canClaimSeat
      ? 1
      : canClaimSeat
        ? seatedForReady.length + 1
        : seatedForReady.length;
  const readyCount =
    botsAutoReady && canClaimSeat
      ? isReady
        ? 1
        : 0
      : seatedForReady.filter((p) => displayReadyStates[p.id]).length;
  const rankedOrder = useMemo(
    () => livingFinishedOrder(players, finishedOrder),
    [players, finishedOrder],
  );
  const livingCount = players.filter((p) => !p.isDeadHand && p.id !== "__dead_hand__").length;
  const [boardDisplayed, setBoardDisplayed] = useState(false);
  const [botDealSecondsLeft, setBotDealSecondsLeft] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!visible) setBoardDisplayed(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !botsAutoReady || botNextRoundAt == null) {
      setBotDealSecondsLeft(null);
      return;
    }
    const tick = () => {
      const msLeft = botNextRoundAt - Date.now();
      setBotDealSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [visible, botsAutoReady, botNextRoundAt]);

  // Web / edge cases: onShow can lag behind visible — fall back once fade should be done.
  useEffect(() => {
    if (!visible || boardDisplayed) return;
    const timer = setTimeout(() => setBoardDisplayed(true), 360);
    return () => clearTimeout(timer);
  }, [visible, boardDisplayed]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={() => setBoardDisplayed(true)}
    >
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
              const ready = !!displayReadyStates[playerId];
              const isLocal = playerId === localPlayerId;
              const finalTotal = playerXp[playerId] ?? 0;
              const roundEarned = playerRoundXp[playerId] ?? 0;

              const isPresident = role === "President";

              return (
                <View
                  key={playerId}
                  style={[styles.rankRow, isLocal && styles.rankRowLocal, isPresident && styles.rankRowPresident]}
                >
                  {isPresident ? (
                    <View style={styles.presidentBorderLabelWrap} pointerEvents="none">
                      <View style={styles.presidentBorderLabel}>
                        <Text style={styles.presidentBorderLabelText}>PRESIDENT</Text>
                      </View>
                    </View>
                  ) : null}
                  <Text style={styles.rankIndex}>{index + 1}</Text>
                  <View style={styles.rankBody}>
                    <View style={styles.rankTopRow}>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <RankXpDisplay
                        visible={visible}
                        animationReady={rankXpAnimationReady(
                          player,
                          xpAnimationReady,
                        )}
                        boardDisplayed={boardDisplayed}
                        rowDelay={index * ROW_STAGGER_MS}
                        finalTotal={finalTotal}
                        roundEarned={roundEarned}
                        feltGreen={feltGreen}
                        styles={styles}
                      />
                    </View>
                    <View style={styles.rankBottomRow}>
                      <Text style={styles.rankRole} numberOfLines={1}>
                        {emoji ? `${emoji} ` : ""}
                        {role}
                      </Text>
                      {ready ? (
                        <View style={styles.readyBadge}>
                          <Text style={styles.readyBadgeText}>Ready</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.readyCount}>
            {readyCount} / {readyDenominator}{" "}
            {botsAutoReady && canClaimSeat
              ? "Ready to claim seat"
              : canClaimSeat
                ? "Ready (incl. dead hand seat)"
                : "Players Ready"}
          </Text>

          {botsAutoReady && botDealSecondsLeft != null ? (
            <Text style={styles.botDealTimer}>
              {botDealSecondsLeft > 0
                ? `Next deal in ${botDealSecondsLeft}s — skips when all players are ready`
                : "Starting next deal…"}
            </Text>
          ) : null}

          {canClaimSeat ? (
            <Text style={styles.spectatorHint}>
              {botsAutoReady
                ? "Bots are ready for the next deal. Tap below to take the dead hand\u2019s seat."
                : "Tap below to take the dead hand\u2019s seat next round."}
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
                    ? "Give up dead hand seat"
                    : "Take dead hand seat next round"
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
                    : "Take Dead Hand Seat"
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
  rankRowPresident: {
    overflow: "visible",
    borderColor: colors.gold,
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
    gap: 4,
  },
  rankTopRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    minWidth: 0,
  },
  rankBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  rankName: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  xpBlock: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "baseline",
    gap: 6,
    flexShrink: 0,
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
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  presidentBorderLabelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -8,
    alignItems: "center",
    zIndex: 1,
  },
  presidentBorderLabel: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.gold, 0.92),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.btnGoldBorder,
  },
  presidentBorderLabelText: {
    color: colors.textOnGold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  readyBadge: {
    flexShrink: 0,
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
    marginBottom: 6,
  },
  botDealTimer: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.25,
    textAlign: "center",
    marginBottom: 14,
    fontVariant: ["tabular-nums"],
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
