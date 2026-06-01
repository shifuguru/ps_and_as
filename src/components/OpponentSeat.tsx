import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Player } from "../game/ruleset";
import { playerInitials } from "../utils/playerDisplay";
import TrickWinCelebration from "./TrickWinCelebration";
import TrickWinShout from "./TrickWinShout";
import AvatarRewardBorder from "./AvatarRewardBorder";
import type { AvatarBorderDesign } from "../rewards/avatarBorders";
import Card from "./Card";
import {
  avatarSizeForSeat,
  COUNT_BADGE_OUTSET_BOTTOM,
  COUNT_BADGE_OUTSET_RIGHT,
  COUNT_BADGE_PADDING_H,
  dealStackCenterInAvatarWrap,
  seatMiniCardDimensions,
  type SeatDimensions,
} from "../utils/seatDimensions";
import { useSeatDimensions } from "../hooks/useSeatDimensions";
import { ceremonyCardCornerRadius } from "./cardDimensions";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import type { FeltPalette } from "../styles/feltPalette";
import type { AppThemeColors } from "../styles/themeColors";
import { normalizePlayerRole, roleEmoji as sharedRoleEmoji } from "../utils/roundRoles";
import TurnBellButton from "./TurnBellButton";
import { playerAvatarBackgroundColor, playerThemePalette } from "../utils/playerAvatarColor";
import { isCpuPlayer } from "../utils/localPlayer";

function roleEmoji(role: Player["role"] | string | undefined): string | null {
  return sharedRoleEmoji(normalizePlayerRole(role));
}

export type OpponentSeatPlayer = {
  id: string;
  name: string;
  handCount: number;
  role: Player["role"];
  isDeadHand?: boolean;
  sidelinedCount?: number;
  /** Saved felt tint for this seat — drives avatar and celebration colors. */
  feltTint?: string;
};

type Props = {
  player: OpponentSeatPlayer;
  isActive: boolean;
  isOut: boolean;
  hasPassed: boolean;
  isThinking?: boolean;
  compact?: boolean;
  /** Local human — highlighted seat at bottom of table */
  isLocal?: boolean;
  /** Played the current pile — subtle ownership glow */
  isLastPlay?: boolean;
  /** Brief confetti / flag after winning a trick */
  celebrateTrickWin?: boolean;
  /** Shout bubble when winning a trick (+XP moment). */
  trickShout?: string | null;
  /** Achievement-based border at bottom of avatar. */
  avatarBorder?: AvatarBorderDesign | null;
  /** Floating +XP with the checkered flag (includes run bonus when applicable). */
  showTrickXp?: boolean;
  trickXpAmount?: number;
  /** Precomputed seat metrics from play-area layout (keeps ring math in sync). */
  seatDims?: SeatDimensions;
  /** Width basis when seatDims is not supplied. */
  layoutWidth?: number;
  /** Lobby ready indicator — checkmark at bottom-left of avatar. */
  isReady?: boolean;
  /** Dead hand seat dimmed like a graveyard during active play. */
  graveyardMode?: boolean;
  /** Temporarily away — seat reserved while waiting to reconnect. */
  isDisconnected?: boolean;
  /** Show nudge bell when this player has taken too long. */
  showTurnBell?: boolean;
  onTurnBellPress?: () => void;
  /** Anonymous turn-bell nudge — brighter avatar ring for a few seconds. */
  nudgeHighlighted?: boolean;
  /** Face-down mini-stack during deal ceremony (cards dealt so far). */
  dealtStackCount?: number;
  /** Open player profile / stats card. */
  onAvatarPress?: () => void;
};

export default function OpponentSeat({
  player,
  isActive,
  isOut,
  hasPassed,
  isThinking = false,
  compact = false,
  isLocal = false,
  isLastPlay = false,
  celebrateTrickWin = false,
  trickShout = null,
  avatarBorder = null,
  showTrickXp = false,
  trickXpAmount,
  seatDims: seatDimsProp,
  layoutWidth,
  isReady = false,
  graveyardMode = false,
  isDisconnected = false,
  showTurnBell = false,
  onTurnBellPress,
  nudgeHighlighted = false,
  dealtStackCount = 0,
  onAvatarPress,
}: Props) {
  const { colors, palette } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const hookDims = useSeatDimensions(layoutWidth);
  const dims = seatDimsProp ?? hookDims;
  const pulse = useRef(new Animated.Value(0)).current;
  const nudgePulse = useRef(new Animated.Value(0)).current;
  const initials = playerInitials(player.name);
  const role = roleEmoji(player.role);

  useEffect(() => {
    if (!isActive || isOut) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, isOut, pulse]);

  useEffect(() => {
    if (!nudgeHighlighted || !isActive || isOut) {
      nudgePulse.stopAnimation();
      nudgePulse.setValue(0);
      return;
    }
    nudgePulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudgePulse, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(nudgePulse, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [nudgeHighlighted, isActive, isOut, nudgePulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });
  const coreOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.88],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.52],
  });

  const nudgeRingScale = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.08, 1.22],
  });
  const nudgeRingOpacity = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });
  const nudgeCoreOpacity = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });
  const nudgeGlowScale = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.1, 1.24],
  });
  const nudgeGlowOpacity = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const nudgeHaloScale = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.14, 1.32],
  });
  const nudgeHaloOpacity = nudgePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 0.92],
  });

  const activeHaloScale = nudgeHighlighted ? nudgeHaloScale : haloScale;
  const activeHaloOpacity = nudgeHighlighted ? nudgeHaloOpacity : haloOpacity;
  const activeGlowScale = nudgeHighlighted ? nudgeGlowScale : glowScale;
  const activeGlowOpacity = nudgeHighlighted ? nudgeGlowOpacity : glowOpacity;
  const activeRingScale = nudgeHighlighted ? nudgeRingScale : ringScale;
  const activeRingOpacity = nudgeHighlighted ? nudgeRingOpacity : ringOpacity;
  const activeCoreOpacity = nudgeHighlighted ? nudgeCoreOpacity : coreOpacity;

  const avatarSize = avatarSizeForSeat(dims, { compact, isLocal });
  const turnHaloPad = 30;
  const turnGlowPad = 16;
  const turnRingPad = 10;
  const turnCorePad = 6;
  const isDeadHand = !!player.isDeadHand;
  const isGraveyard = isDeadHand && graveyardMode;
  const sidelinedCount = player.sidelinedCount ?? 0;
  const miniCard = seatMiniCardDimensions(avatarSize);
  const miniCardW = miniCard.width;
  const miniCardH = miniCard.height;
  const dealStackLayers =
    dealtStackCount > 0 ? Math.min(3, dealtStackCount) : 0;
  const dealStackW =
    dealStackLayers > 0 ? miniCardW + (dealStackLayers - 1) * 4 : 0;
  const dealStackH =
    dealStackLayers > 0 ? miniCardH + (dealStackLayers - 1) * 2 : 0;
  const dealStackCenter =
    dealStackLayers > 0
      ? dealStackCenterInAvatarWrap(
          avatarSize,
          dims.countBadgeSize,
          dealStackH,
        )
      : null;
  const readyBadgeSize = Math.max(16, Math.round(avatarSize * 0.34));
  const avatarBackgroundColor = isDeadHand
    ? "rgba(255,255,255,0.08)"
    : playerAvatarBackgroundColor(player.id, player.feltTint, {
        isCpu: isCpuPlayer(player),
      });
  const celebrationPalette = useMemo(
    () => playerThemePalette(player.feltTint, player.id, isCpuPlayer(player)),
    [player.feltTint, player.id, player.name],
  );

  const avatarBlock = (
    <>
      <TrickWinShout
        active={celebrateTrickWin}
        text={trickShout ?? ""}
        avatarSize={avatarSize}
      />
      <TrickWinCelebration
        active={celebrateTrickWin}
        avatarSize={avatarSize}
        countBadgeSize={dims.countBadgeSize}
        showXp={showTrickXp}
        xpAmount={trickXpAmount}
        celebrationColors={celebrationPalette.celebrationColors}
      />
      {isLastPlay && !isOut && !isActive && !celebrateTrickWin && (
        <View
          style={[
            styles.lastPlayRing,
            {
              width: avatarSize + 8,
              height: avatarSize + 8,
              borderRadius: (avatarSize + 8) / 2,
              left: -4,
              top: -4,
            },
          ]}
          pointerEvents="none"
        />
      )}
      {isActive && !isOut && (
        <>
          <Animated.View
            style={[
              styles.turnRingHalo,
              {
                width: avatarSize + turnHaloPad,
                height: avatarSize + turnHaloPad,
                borderRadius: (avatarSize + turnHaloPad) / 2,
                left: -turnHaloPad / 2,
                top: -turnHaloPad / 2,
                transform: [{ scale: activeHaloScale }],
                opacity: activeHaloOpacity,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.turnRingGlow,
              {
                width: avatarSize + turnGlowPad,
                height: avatarSize + turnGlowPad,
                borderRadius: (avatarSize + turnGlowPad) / 2,
                left: -turnGlowPad / 2,
                top: -turnGlowPad / 2,
                transform: [{ scale: activeGlowScale }],
                opacity: activeGlowOpacity,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.turnRing,
              {
                width: avatarSize + turnRingPad,
                height: avatarSize + turnRingPad,
                borderRadius: (avatarSize + turnRingPad) / 2,
                left: -turnRingPad / 2,
                top: -turnRingPad / 2,
                transform: [{ scale: activeRingScale }],
                opacity: activeRingOpacity,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.turnRingCore,
              {
                width: avatarSize + turnCorePad,
                height: avatarSize + turnCorePad,
                borderRadius: (avatarSize + turnCorePad) / 2,
                left: -turnCorePad / 2,
                top: -turnCorePad / 2,
                transform: [{ scale: activeRingScale }],
                opacity: activeCoreOpacity,
              },
            ]}
            pointerEvents="none"
          />
        </>
      )}
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: avatarBackgroundColor,
          },
          isOut && !isDeadHand && styles.avatarOut,
          isDisconnected && !isOut && !isDeadHand && styles.avatarDisconnected,
          isLocal && styles.avatarLocal,
          isDeadHand && !isGraveyard && styles.avatarDeadHand,
          isGraveyard && styles.avatarGraveyard,
        ]}
      >
        <Text
          style={[
            styles.initials,
            {
              fontSize: compact ? dims.initialsFontCompact : dims.initialsFont,
            },
            isDeadHand && !isGraveyard && styles.initialsDeadHand,
            isGraveyard && styles.initialsGraveyard,
          ]}
        >
          {isDeadHand ? (isGraveyard ? "—" : "DH") : initials}
        </Text>
      </View>
      {isDeadHand && sidelinedCount > 0 ? (
        <View
          style={[
            styles.sidelinedStack,
            isGraveyard && styles.sidelinedStackGraveyard,
            {
              left: avatarSize + 2,
              top: avatarSize * 0.08,
            },
          ]}
          pointerEvents="none"
        >
          {Array.from({ length: Math.min(3, sidelinedCount) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.sidelinedCard,
                {
                  left: i * 4,
                  top: i * 2,
                  width: miniCardW,
                  height: miniCardH,
                },
              ]}
            >
              <Card
                card={{ suit: "spades", value: 0, hidden: true }}
                selected={false}
                faceDown
                disabled
                variant="table"
                onPress={() => {}}
                style={{ width: miniCardW, height: miniCardH }}
              />
            </View>
          ))}
        </View>
      ) : null}
      {dealStackCenter && dealStackLayers > 0 ? (
        <View
          style={[
            styles.dealStack,
            {
              left: dealStackCenter.x - dealStackW / 2,
              top: dealStackCenter.y - dealStackH / 2,
              width: dealStackW,
              height: dealStackH,
            },
          ]}
          pointerEvents="none"
        >
          {Array.from({ length: dealStackLayers }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dealStackCard,
                {
                  left: i * 4,
                  top: i * 2,
                  width: miniCardW,
                  height: miniCardH,
                  zIndex: i,
                },
              ]}
            >
              <Card
                card={{ suit: "spades", value: 0, hidden: true }}
                selected={false}
                faceDown
                disabled
                variant="table"
                cornerRadius={ceremonyCardCornerRadius(miniCardW, miniCardH)}
                onPress={() => {}}
                style={{ width: miniCardW, height: miniCardH }}
              />
            </View>
          ))}
        </View>
      ) : null}
      {role ? (
        <Text
          style={[styles.roleBadge, { fontSize: dims.roleFont }]}
          pointerEvents="none"
        >
          {role}
        </Text>
      ) : null}
      {isReady && !isDeadHand ? (
        <View
          style={[
            styles.readyBadge,
            {
              width: readyBadgeSize,
              height: readyBadgeSize,
              borderRadius: readyBadgeSize / 2,
              left: -Math.round(readyBadgeSize * 0.18),
              bottom: -Math.round(readyBadgeSize * 0.12),
            },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.readyBadgeCheck,
              { fontSize: Math.max(9, readyBadgeSize * 0.58) },
            ]}
          >
            ✓
          </Text>
        </View>
      ) : null}
      {!isOut && !isDeadHand && (
        <View
          style={[
            styles.countBadge,
            {
              minWidth: dims.countBadgeSize,
              height: dims.countBadgeSize,
              borderRadius: dims.countBadgeSize / 2,
            },
          ]}
        >
          <Text style={[styles.countText, { fontSize: dims.countFont }]}>
            {player.handCount}
          </Text>
        </View>
      )}
      {isDeadHand && sidelinedCount > 0 ? (
        <View
          style={[
            styles.countBadge,
            {
              minWidth: dims.countBadgeSize,
              height: dims.countBadgeSize,
              borderRadius: dims.countBadgeSize / 2,
            },
          ]}
        >
          <Text style={[styles.countText, { fontSize: dims.countFont }]}>
            {sidelinedCount}
          </Text>
        </View>
      ) : null}
    </>
  );

  const seatStyle = compact
    ? { minWidth: dims.seatMinWCompact, maxWidth: dims.seatMaxWCompact }
    : isLocal
      ? { minWidth: dims.seatMinWLocal, maxWidth: dims.seatMaxWLocal }
      : { minWidth: dims.seatMinW, maxWidth: dims.seatMaxW };

  return (
    <View
      style={[
        styles.seat,
        seatStyle,
        isOut && !isDeadHand && styles.seatOut,
        isDeadHand && !isGraveyard && styles.deadHandSeat,
        isGraveyard && styles.deadHandGraveyard,
        isDisconnected && !isOut && styles.seatDisconnected,
      ]}
    >
      {isDeadHand ? (
        <View style={styles.deadHandHeader}>
          <Text style={[styles.deadHandIcon, isGraveyard && styles.deadHandIconGraveyard]}>
            {isGraveyard ? "⚰" : "🃏"}
          </Text>
          <Text style={[styles.deadHandHint, isGraveyard && styles.deadHandHintGraveyard]}>
            {isGraveyard ? "Empty seat" : "Open seat"}
          </Text>
        </View>
      ) : null}
      {onAvatarPress && !isDeadHand ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAvatarPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${player.name} profile`}
          style={[
            styles.avatarWrap,
            { width: avatarSize, height: avatarSize },
            celebrateTrickWin && styles.avatarWrapCelebrate,
          ]}
        >
          {avatarBlock}
          {avatarBorder ? (
            <AvatarRewardBorder design={avatarBorder} avatarSize={avatarSize} />
          ) : null}
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.avatarWrap,
            { width: avatarSize, height: avatarSize },
            celebrateTrickWin && styles.avatarWrapCelebrate,
          ]}
        >
          {avatarBlock}
          {avatarBorder ? (
            <AvatarRewardBorder design={avatarBorder} avatarSize={avatarSize} />
          ) : null}
        </View>
      )}

      <Text
        style={[
          styles.name,
          {
            fontSize: compact ? dims.nameFontCompact : dims.nameFont,
            maxWidth: compact ? dims.nameMaxWCompact : dims.nameMaxW,
          },
          isOut && styles.nameOut,
        ]}
        numberOfLines={1}
      >
        {player.name}
      </Text>

      {isDeadHand ? (
        <Text style={[styles.deadHandLabel, isGraveyard && styles.deadHandLabelGraveyard]}>
          {isGraveyard ? "Graveyard" : "Dead Hand"}
        </Text>
      ) : isOut ? (
        <Text style={styles.statusPill}>Out</Text>
      ) : isDisconnected ? (
        <Text style={[styles.statusPill, styles.awayPill]}>Away</Text>
      ) : hasPassed ? (
        <Text style={[styles.statusPill, styles.passPill]}>Pass</Text>
      ) : isThinking ? (
        <Text style={[styles.statusPill, styles.thinkPill]}>…</Text>
      ) : isLocal ? (
        <Text style={[styles.statusPill, styles.youPill]}>You</Text>
      ) : null}

      {showTurnBell && onTurnBellPress ? (
        <View style={styles.bellSlot}>
          <TurnBellButton visible onPress={onTurnBellPress} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppThemeColors, palette: FeltPalette) {
  const accent = colors.gold;
  const accentBright = palette.complementBright;
  const accentSoft = hexToRgba(accent, 0.55);
  const accentFill = hexToRgba(accent, 0.08);
  const accentBlade = hexToRgba(accentBright, 1);
  const accentHalo = hexToRgba(accentBright, 0.26);
  const accentBloom = hexToRgba(accentBright, 0.5);
  const accentLocal = hexToRgba(accent, 0.75);
  const accentBadge = hexToRgba(accent, 0.35);
  const onFelt = colors.onFelt;
  const saberShadow = (radius: number, opacity = 1) =>
    Platform.select({
      ios: {
        shadowColor: accentBright,
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: Math.round(radius / 2.5) },
      default: {
        shadowColor: accentBright,
        shadowOpacity: opacity,
        shadowRadius: radius,
        shadowOffset: { width: 0, height: 0 },
      },
    });

  return StyleSheet.create({
  seat: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
  seatOut: {
    opacity: 0.45,
  },
  seatDisconnected: {
    opacity: 0.82,
  },
  deadHandSeat: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 6,
    opacity: 0.72,
  },
  deadHandGraveyard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderStyle: "dashed",
    backgroundColor: "rgba(0,0,0,0.32)",
    paddingVertical: 6,
    opacity: 0.42,
  },
  deadHandHeader: {
    alignItems: "center",
    marginBottom: 2,
  },
  deadHandIcon: {
    fontSize: 14,
  },
  deadHandIconGraveyard: {
    fontSize: 13,
    opacity: 0.65,
  },
  deadHandHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 8,
    fontWeight: "600",
    marginTop: 1,
  },
  deadHandHintGraveyard: {
    color: "rgba(255,255,255,0.22)",
    fontStyle: "italic",
  },
  deadHandLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.45)",
  },
  deadHandLabelGraveyard: {
    color: "rgba(255,255,255,0.28)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  avatarDeadHand: {
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.22)",
  },
  avatarGraveyard: {
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  initialsDeadHand: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
  },
  initialsGraveyard: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 14,
    fontWeight: "300",
  },
  sidelinedStackGraveyard: {
    opacity: 0.35,
  },
  sidelinedStack: {
    position: "absolute",
    overflow: "visible",
  },
  sidelinedCard: {
    position: "absolute",
  },
  dealStack: {
    position: "absolute",
    overflow: "visible",
    zIndex: 13,
  },
  dealStackCard: {
    position: "absolute",
  },
  avatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    overflow: "visible",
  },
  avatarWrapCelebrate: {
    zIndex: 12,
  },
  turnRingHalo: {
    position: "absolute",
    backgroundColor: accentHalo,
    ...saberShadow(20, 0.72),
  },
  turnRingGlow: {
    position: "absolute",
    backgroundColor: accentBloom,
    ...saberShadow(12, 0.85),
  },
  turnRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: accentBlade,
    ...saberShadow(14, 1),
  },
  turnRingCore: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.92)",
    ...saberShadow(8, 0.85),
  },
  lastPlayRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: accentSoft,
    backgroundColor: accentFill,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  avatarOut: {
    backgroundColor: "rgba(80,80,80,0.5)",
  },
  avatarDisconnected: {
    opacity: 0.55,
  },
  avatarLocal: {
    borderWidth: 2,
    borderColor: accentLocal,
  },
  initials: {
    fontWeight: "800",
    ...onFeltTextStyle(onFelt, "primary"),
  },
  roleBadge: {
    position: "absolute",
    top: -6,
    left: -4,
  },
  readyBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e7d32",
    borderWidth: 2,
    borderColor: "#ffffff",
    zIndex: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  readyBadgeCheck: {
    color: "#ffffff",
    fontWeight: "900",
    lineHeight: 12,
    marginTop: -1,
  },
  countBadge: {
    position: "absolute",
    right: -COUNT_BADGE_OUTSET_RIGHT,
    bottom: -COUNT_BADGE_OUTSET_BOTTOM,
    paddingHorizontal: COUNT_BADGE_PADDING_H,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: accentBadge,
  },
  countText: {
    fontWeight: "800",
    ...onFeltTextStyle(onFelt, "primary"),
  },
  name: {
    fontWeight: "700",
    textAlign: "center",
    ...onFeltTextStyle(onFelt, "primary"),
  },
  nameOut: {
    ...onFeltTextStyle(onFelt, "muted"),
  },
  statusPill: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
    ...onFeltTextStyle(onFelt, "muted"),
  },
  passPill: {
    ...onFeltTextStyle(onFelt, "accent", {
      color: hexToRgba(onFelt.accent, 0.82),
    }),
  },
  bellSlot: {
    position: "absolute",
    top: -6,
    right: -4,
    zIndex: 12,
  },
  awayPill: {
    ...onFeltTextStyle(onFelt, "accent", {
      color: "#ffc96b",
    }),
  },
  thinkPill: {
    fontSize: 12,
    ...onFeltTextStyle(onFelt, "accent"),
  },
  youPill: {
    ...onFeltTextStyle(onFelt, "accent"),
  },
  });
}
