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
import AvatarRewardBorder from "./AvatarRewardBorder";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import { roleForPlacement, type RoundRoleLabel } from "../utils/roundRoles";
import { livingFinishedOrder } from "../game/deadHand";
import { hexToRgba } from "../utils/colorTheory";
import { isCpuPlayer } from "../utils/localPlayer";
import { playerInitials } from "../utils/playerDisplay";
import { playerAvatarBackgroundColor } from "../utils/playerAvatarColor";
import { levelFromXp } from "../services/playerLevel";
import type { AvatarBorderDesign } from "../rewards/avatarBorders";
import { ROUND_COMPLETE_Z } from "../styles/overlayZIndex";
import LeaveGameConfirmModal from "./LeaveGameConfirmModal";

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
  /** Achievement borders — same map used on the table seats. */
  avatarBordersByPlayerId?: Record<string, AvatarBorderDesign>;
  onQuit: () => void;
  onToggleReady: () => void;
  xpAnimationReady?: boolean;
  /** Leave-game confirm (must be embedded — nested RN Modal draws behind this modal). */
  leaveConfirmVisible?: boolean;
  onLeaveCancel?: () => void;
  onLeaveConfirm?: () => void;
};

const AVATAR_SIZE = 40;
const ROW_STAGGER_MS = 50;
const OPEN_DELAY_MS = 180;
const MODAL_SCALE_MS = 320;

function roleBannerLabel(role: RoundRoleLabel): string {
  return role.toUpperCase();
}

function RankAvatar({
  player,
  border,
  styles,
}: {
  player: Player;
  border?: AvatarBorderDesign | null;
  styles: ReturnType<typeof createStyles>;
}) {
  const bg = playerAvatarBackgroundColor(player.id, null, {
    isCpu: isCpuPlayer(player),
  });
  return (
    <View style={styles.avatarWrap}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: bg },
          !border && styles.avatarBare,
        ]}
      >
        <Text style={styles.avatarText}>{playerInitials(player.name)}</Text>
      </View>
      {border ? (
        <AvatarRewardBorder design={border} avatarSize={AVATAR_SIZE} />
      ) : null}
    </View>
  );
}

/** Round XP (prominent) — lifetime sits with Level under the name. */
function RankXpBlock({
  visible,
  boardDisplayed,
  animationReady,
  rowDelay,
  roundEarned,
  feltGreen,
  styles,
}: {
  visible: boolean;
  boardDisplayed: boolean;
  animationReady: boolean;
  rowDelay: number;
  roundEarned: number;
  feltGreen: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const roundOpacity = useRef(new Animated.Value(0)).current;
  const roundScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible || !boardDisplayed || roundEarned <= 0) {
      roundOpacity.setValue(roundEarned > 0 && boardDisplayed ? 1 : 0);
      roundScale.setValue(1);
      return;
    }
    if (!animationReady) {
      roundOpacity.setValue(1);
      roundScale.setValue(1);
      return;
    }
    roundOpacity.setValue(0);
    roundScale.setValue(0.92);
    Animated.parallel([
      Animated.timing(roundOpacity, {
        toValue: 1,
        duration: 320,
        delay: OPEN_DELAY_MS + rowDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(roundScale, {
        toValue: 1,
        duration: 360,
        delay: OPEN_DELAY_MS + rowDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    visible,
    boardDisplayed,
    animationReady,
    roundEarned,
    rowDelay,
    roundOpacity,
    roundScale,
  ]);

  if (roundEarned <= 0) {
    return <Text style={styles.rankXpRoundMuted}>—</Text>;
  }

  return (
    <Animated.Text
      style={[
        styles.rankXpRound,
        {
          color: feltGreen,
          opacity: roundOpacity,
          transform: [{ scale: roundScale }],
        },
      ]}
    >
      +{roundEarned.toLocaleString()} XP
    </Animated.Text>
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
  avatarBorder,
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
  avatarBorder?: AvatarBorderDesign | null;
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
  const level = levelFromXp(finalTotal);

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
        {
          opacity: rowOpacity,
          transform: [{ translateY: rowTranslate }],
        },
      ]}
    >
      <View style={styles.rankMain}>
        <RankAvatar player={player} border={avatarBorder} styles={styles} />
        <View style={styles.rankBody}>
          <View style={styles.rankTopRow}>
            <View style={styles.identityCol}>
              <View style={styles.nameRow}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {player.name}
                </Text>
                {isLocal ? (
                  <View style={styles.youPill}>
                    <Text style={styles.youPillText}>YOU</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.identityMeta} numberOfLines={1}>
                Level {level} · {finalTotal.toLocaleString()} XP
              </Text>
            </View>
            <View style={styles.statusCol}>
              <RankXpBlock
                visible={visible}
                boardDisplayed={boardDisplayed}
                animationReady={rankXpAnimationReady(player, xpAnimationReady)}
                rowDelay={index * ROW_STAGGER_MS}
                roundEarned={roundEarned}
                feltGreen={feltGreen}
                styles={styles}
              />
              <View style={styles.readyRow}>
                <View
                  style={[
                    styles.readyDot,
                    ready ? styles.readyDotOn : styles.readyDotOff,
                  ]}
                />
                <Text
                  style={[
                    styles.readyLabel,
                    ready ? styles.readyLabelOn : styles.readyLabelOff,
                  ]}
                  accessibilityLabel={ready ? "Ready" : "Waiting"}
                >
                  {ready ? "Ready" : "Waiting"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.roleFooter, banner.container]} pointerEvents="none">
        <Text style={[styles.roleFooterText, banner.text]}>
          {roleBannerLabel(role)}
        </Text>
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
          backgroundColor: hexToRgba(colors.gold, 0.75),
          borderTopColor: hexToRgba(colors.gold, isDark ? 0.2 : 0.3),
        },
        text: { color: colors.textOnGold },
      };
    case "Vice President":
      return {
        container: {
          backgroundColor: hexToRgba(colors.gold, 0.7),
          borderTopColor: hexToRgba(colors.gold, isDark ? 0.15 : 0.2),
        },
        text: { color: colors.textOnGold },
      };
    case "Vice Asshole":
    case "Asshole": {
      const clay = isDark ? "#a85a32" : "#9a4e28";
      return {
        container: {
          backgroundColor: hexToRgba(clay, 0.72),
          borderTopColor: hexToRgba(clay, 0.4),
        },
        text: { color: "#fff6ee" },
      };
    }
    default:
      return {
        container: {
          backgroundColor: isDark
            ? "rgba(22, 42, 32, 0.72)"
            : "rgba(28, 48, 38, 0.7)",
          borderTopColor: colors.panelBorder,
        },
        text: { color: isDark ? colors.textMuted : "rgba(255,255,255,0.92)" },
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
  avatarBordersByPlayerId = {},
  onQuit,
  onToggleReady,
  xpAnimationReady = true,
  leaveConfirmVisible = false,
  onLeaveCancel,
  onLeaveConfirm,
}: Props) {
  const { colors, ui, blur, palette } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const feltGreen = palette.complementBright;
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);
  const canClaimSeat = spectatorMode && deadHandSeatOpen;
  const displayReadyStates = useMemo(() => {
    // CPUs never manually ready — count and show them ready whenever seated.
    const next = { ...readyStates };
    for (const p of players) {
      if (isCpuPlayer(p)) next[p.id] = true;
    }
    return next;
  }, [readyStates, players]);
  const isReady = localPlayerId ? !!displayReadyStates[localPlayerId] : false;
  const seatedForReady = useMemo(
    () => players.filter((p) => !p.isDeadHand && p.id !== "__dead_hand__"),
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
  const livingCount = players.filter(
    (p) => !p.isDeadHand && p.id !== "__dead_hand__",
  ).length;
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
            onLayout={() => {
              setBoardDisplayed(true);
            }}
          >
            <Text style={ui.modalTitle}>Round Complete</Text>
            <Text style={ui.modalBody}>Final Rankings</Text>

            <View style={styles.rankings}>
              {rankedOrder.map((playerId, index) => {
                const player = players.find((p) => p.id === playerId);
                if (!player) {
                  return null;
                }

                const role = roleForPlacement(
                  index,
                  livingCount || rankedOrder.length,
                );
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
                    avatarBorder={avatarBordersByPlayerId[playerId] ?? null}
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
              {readyCount}/{readyDenominator}{" "}
              {botsAutoReady && canClaimSeat
                ? "ready to claim seat"
                : canClaimSeat
                  ? "ready (including dead hand seat)"
                  : "ready"}
            </Text>

            {botsAutoReady && botDealSecondsLeft != null ? (
              <Text style={styles.botDealTimer}>
                {botDealSecondsLeft > 0
                  ? `Next deal in ${botDealSecondsLeft}s`
                  : "Starting next deal…"}
              </Text>
            ) : null}

            {canClaimSeat ? (
              <Text style={styles.spectatorHint}>
                {botsAutoReady
                  ? "Bots are ready. Tap below to take the dead hand\u2019s seat."
                  : "Tap below to take the dead hand\u2019s seat next round."}
              </Text>
            ) : null}

            <View style={styles.footerActions}>
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
        {onLeaveCancel && onLeaveConfirm ? (
          <LeaveGameConfirmModal
            embedded
            visible={leaveConfirmVisible}
            onCancel={onLeaveCancel}
            onConfirm={onLeaveConfirm}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";
  const readyGreen = isDark ? "#3d9b62" : "#2e7d4f";

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
    rankings: {
      width: "100%",
      marginBottom: 12,
      gap: 8,
    },
    rankRow: {
      borderRadius: 14,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      overflow: "hidden",
    },
    rankRowLocal: {
      borderColor: hexToRgba(colors.gold, isDark ? 0.48 : 0.42),
      backgroundColor: hexToRgba(
        colors.mode === "dark" ? "#0c1c14" : "#ffffff",
        isDark ? 0.42 : 0.14,
      ),
    },
    rankRowPresident: {
      borderColor: hexToRgba(colors.gold, isDark ? 0.55 : 0.55),
    },
    rankMain: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 11,
      gap: 10,
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      overflow: "visible",
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarBare: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.gold, 0.35),
    },
    avatarText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    roleFooter: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    roleFooterText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.1,
    },
    rankBody: {
      flex: 1,
      minWidth: 0,
    },
    rankTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      minWidth: 0,
    },
    identityCol: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    rankName: {
      flexShrink: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    youPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: hexToRgba(colors.gold, isDark ? 0.2 : 0.16),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.gold, 0.4),
      flexShrink: 0,
    },
    youPillText: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    identityMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.1,
      fontVariant: ["tabular-nums"],
    },
    statusCol: {
      alignItems: "flex-end",
      gap: 4,
      flexShrink: 0,
      paddingTop: 1,
    },
    rankXpRound: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.15,
      fontVariant: ["tabular-nums"],
    },
    rankXpRoundMuted: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    readyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    readyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    readyDotOn: {
      backgroundColor: readyGreen,
    },
    readyDotOff: {
      backgroundColor: hexToRgba(colors.textMuted, 0.55),
    },
    readyLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    readyLabelOn: {
      color: readyGreen,
    },
    readyLabelOff: {
      color: colors.textMuted,
    },
    readyCount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.15,
      textAlign: "center",
      marginBottom: 8,
    },
    botDealTimer: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.2,
      textAlign: "center",
      marginBottom: 12,
      fontVariant: ["tabular-nums"],
    },
    spectatorHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    footerActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      width: "100%",
      minHeight: 48,
    },
  });
}
