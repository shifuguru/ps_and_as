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
import Card from "./Card";
import {
  avatarSizeForSeat,
  COUNT_BADGE_OUTSET_BOTTOM,
  COUNT_BADGE_OUTSET_RIGHT,
  COUNT_BADGE_PADDING_H,
  dealStackCenterInAvatarWrap,
  seatMiniCardDimensions,
  useSeatDimensions,
  type SeatDimensions,
} from "../utils/seatDimensions";
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
  showTrickXp = false,
  trickXpAmount,
  seatDims: seatDimsProp,
  layoutWidth,
  isReady = false,
  graveyardMode = false,
  isDisconnected = false,
  showTurnBell = false,
  onTurnBellPress,
  dealtStackCount = 0,
  onAvatarPress,
}: Props) {
  const { colors, palette } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);
  const hookDims = useSeatDimensions(layoutWidth);
  const dims = seatDimsProp ?? hookDims;
  const pulse = useRef(new Animated.Value(0)).current;
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

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.95],
  });

  const avatarSize = avatarSizeForSeat(dims, { compact, isLocal });
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
        <Animated.View
          style={[
            styles.turnRing,
            {
              width: avatarSize + 10,
              height: avatarSize + 10,
              borderRadius: (avatarSize + 10) / 2,
              left: -5,
              top: -5,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
          pointerEvents="none"
        />
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
  const accentSoft = hexToRgba(accent, 0.55);
  const accentFill = hexToRgba(accent, 0.08);
  const accentRing = hexToRgba(accent, 0.95);
  const accentLocal = hexToRgba(accent, 0.75);
  const accentBadge = hexToRgba(accent, 0.35);
  const onFelt = colors.onFelt;

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
  turnRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: accentRing,
    ...Platform.select({
      ios: {
        shadowColor: accent,
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
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
