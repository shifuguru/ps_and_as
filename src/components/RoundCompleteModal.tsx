import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import BlurPanel from "./BlurPanel";
import ModalBackdrop from "./ModalBackdrop";
import AppButton from "./ui/AppButton";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import { roleForPlacement, type RoundRoleLabel } from "../utils/roundRoles";
import { livingFinishedOrder } from "../game/deadHand";
import { hexToRgba } from "../utils/colorTheory";
import { isCpuPlayer } from "../utils/localPlayer";
import { ROUND_COMPLETE_Z } from "../styles/overlayZIndex";

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
  playerXp?: Record<string, number>;
  playerRoundXp?: Record<string, number>;
  localPlayerId?: string;
  spectatorMode?: boolean;
  botsAutoReady?: boolean;
  botNextRoundAt?: number | null;
  deadHandSeatOpen?: boolean;
  onQuit: () => void;
  onToggleReady: () => void;
  xpAnimationReady?: boolean;
};

const ABSORB_MS = 1500;
const ROW_STAGGER_MS = 50;
const OPEN_DELAY_MS = 180;
const MODAL_SCALE_MS = 320;

function roleBannerLabel(role: RoundRoleLabel): string {
  return role.toUpperCase();
}

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

function RankingRow({
  index,
  player,
  role,
  ready,
  isLocal,
  isPresident,
  finalTotal,
  roundEarned,
  visible,
  boardDisplayed,
  xpAnimationReady,
  feltGreen,
  styles,
  colors,
}: {
  index: number;
  player: Player;
  role: RoundRoleLabel;
  ready: boolean;
  isLocal: boolean;
  isPresident: boolean;
  finalTotal: number;
  roundEarned: number;
  visible: boolean;
  boardDisplayed: boolean;
  xpAnimationReady: boolean;
  feltGreen: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowTranslate = useRef(new Animated.Value(8)).current;
  const banner = roleBannerStyle(role, colors);

  useEffect(() => {
    if (!visible || !boardDisplayed) {
      rowOpacity.setValue(0);
      rowTranslate.setValue(8);
      return;
    }
    Animated.parallel([
      Animated.timing(rowOpacity, {
        toValue: 1,
        duration: 280,
        delay: OPEN_DELAY_MS + index * ROW_STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rowTranslate, {
        toValue: 0,
        duration: 300,
        delay: OPEN_DELAY_MS + index * ROW_STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, boardDisplayed, index, rowOpacity, rowTranslate]);

  return (
    <Animated.View
      style={[
        styles.rankRow,
        isLocal && styles.rankRowLocal,
        isPresident && styles.rankRowPresident,
        ready && styles.rankRowReady,
        {
          opacity: rowOpacity,
          transform: [{ translateY: rowTranslate }],
        },
      ]}
    >
      <View style={[styles.roleBanner, banner.container]} pointerEvents="none">
        <Text style={[styles.roleBannerText, banner.text]}>
          {roleBannerLabel(role)}
        </Text>
      </View>
      <Text style={[styles.rankIndex, isPresident && styles.rankIndexPresident]}>
        {index + 1}
      </Text>
      <View style={styles.rankBody}>
        <View style={styles.rankTopRow}>
          <Text style={styles.rankName} numberOfLines={1}>
            {player.name}
          </Text>
          {ready ? (
            <Text style={styles.readyCheck} accessibilityLabel="Ready">
              ✓
            </Text>
          ) : null}
          <RankXpDisplay
            visible={visible}
            animationReady={rankXpAnimationReady(player, xpAnimationReady)}
            boardDisplayed={boardDisplayed}
            rowDelay={index * ROW_STAGGER_MS}
            finalTotal={finalTotal}
            roundEarned={roundEarned}
            feltGreen={feltGreen}
            styles={styles}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function roleBannerStyle(
  role: RoundRoleLabel,
  colors: ReturnType<typeof useAppTheme>["colors"],
) {
  const isDark = colors.mode === "dark";
  switch (role) {
    case "President":
      return {
        container: {
          backgroundColor: hexToRgba(colors.gold, 0.92),
          borderColor: colors.btnGoldBorder,
        },
        text: { color: colors.textOnGold },
      };
    case "Vice President":
      return {
        container: {
          backgroundColor: hexToRgba(colors.gold, isDark ? 0.35 : 0.28),
          borderColor: hexToRgba(colors.gold, 0.4),
        },
        text: { color: colors.textOnGold },
      };
    case "Vice Asshole":
    case "Asshole":
      return {
        container: {
          backgroundColor: hexToRgba(isDark ? "#c45c26" : "#d84315", isDark ? 0.42 : 0.18),
          borderColor: hexToRgba(isDark ? "#e07a3a" : "#bf360c", 0.45),
        },
        text: { color: isDark ? "#ffe8d6" : "#8b2500" },
      };
    default:
      return {
        container: {
          backgroundColor: hexToRgba(colors.textPrimary, isDark ? 0.12 : 0.08),
          borderColor: colors.panelBorder,
        },
        text: { color: colors.textMuted },
      };
  }
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
  const modalScale = useRef(new Animated.Value(0.94)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setBoardDisplayed(false);
      modalScale.setValue(0.94);
      modalOpacity.setValue(0);
      return;
    }
    const scaleAnim = Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 1,
        duration: MODAL_SCALE_MS,
        delay: OPEN_DELAY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: MODAL_SCALE_MS,
        delay: OPEN_DELAY_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    scaleAnim.start();
    return () => scaleAnim.stop();
  }, [visible, modalScale, modalOpacity]);

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

  useEffect(() => {
    if (!visible || boardDisplayed) return;
    const timer = setTimeout(() => setBoardDisplayed(true), OPEN_DELAY_MS + 80);
    return () => clearTimeout(timer);
  }, [visible, boardDisplayed]);

  if (!visible) return null;

  const nextRoundLabel = canClaimSeat
    ? isReady
      ? "Give Up Seat"
      : "Take Dead Hand Seat"
    : isReady
      ? "Not Ready"
      : "Next Round";

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <ModalBackdrop visible zIndex={ROUND_COMPLETE_Z} />
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            },
          ]}
          pointerEvents="box-none"
        >
          <BlurPanel
            style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
            preset={blur.modal}
            onLayout={() => setBoardDisplayed(true)}
          >
            <Text style={ui.modalTitle}>Round Complete</Text>
            <Text style={[ui.modalBody, styles.subtitle]}>Final Rankings</Text>

            <View style={styles.rankings}>
              {rankedOrder.map((playerId, index) => {
                const player = players.find((p) => p.id === playerId);
                if (!player) return null;

                const role = roleForPlacement(index, livingCount || rankedOrder.length);
                const ready = !!displayReadyStates[playerId];
                const isLocal = playerId === localPlayerId;
                const finalTotal = playerXp[playerId] ?? 0;
                const roundEarned = playerRoundXp[playerId] ?? 0;
                const isPresident = role === "President";

                return (
                  <RankingRow
                    key={playerId}
                    index={index}
                    player={player}
                    role={role}
                    ready={ready}
                    isLocal={isLocal}
                    isPresident={isPresident}
                    finalTotal={finalTotal}
                    roundEarned={roundEarned}
                    visible={visible}
                    boardDisplayed={boardDisplayed}
                    xpAnimationReady={xpAnimationReady}
                    feltGreen={feltGreen}
                    styles={styles}
                    colors={colors}
                  />
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
              <AppButton
                label="Quit Game"
                variant="destructive"
                style={{ flex: 1 }}
                onPress={() => {
                  triggerHaptic("light");
                  onQuit();
                }}
                accessibilityLabel="Quit Game"
              />
              <AppButton
                label={nextRoundLabel}
                variant="primary"
                style={{ flex: 1.45 }}
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
              />
            </View>
          </BlurPanel>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";
  const readyGreen = isDark ? "#3d9b62" : "#2e7d4f";
  const readyFill = hexToRgba(readyGreen, isDark ? 0.14 : 0.1);

  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      zIndex: ROUND_COMPLETE_Z,
      elevation: ROUND_COMPLETE_Z,
    },
    modalContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      zIndex: ROUND_COMPLETE_Z + 1,
    },
    subtitle: {
      fontSize: 22,
      marginBottom: 18,
    },
    rankings: {
      width: "100%",
      marginBottom: 14,
      gap: 8,
    },
    rankRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 18,
      paddingBottom: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      overflow: "visible",
    },
    rankRowLocal: {
      borderColor: hexToRgba(colors.gold, 0.45),
    },
    rankRowPresident: {
      backgroundColor: colors.btnGoldBg,
      borderColor: colors.gold,
      shadowColor: colors.gold,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.22 : 0.14,
      shadowRadius: 8,
      elevation: 4,
    },
    rankRowReady: {
      backgroundColor: readyFill,
      borderColor: hexToRgba(readyGreen, 0.42),
    },
    roleBanner: {
      position: "absolute",
      top: -9,
      left: 12,
      right: 12,
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    roleBannerText: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    rankIndex: {
      color: colors.gold,
      fontSize: 16,
      fontWeight: "800",
      width: 24,
      textAlign: "center",
    },
    rankIndexPresident: {
      color: colors.gold,
      fontSize: 17,
    },
    rankBody: {
      flex: 1,
      minWidth: 0,
      marginLeft: 8,
    },
    rankTopRow: {
      flexDirection: "row",
      alignItems: "baseline",
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
    readyCheck: {
      color: readyGreen,
      fontSize: 14,
      fontWeight: "800",
      marginRight: 2,
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
