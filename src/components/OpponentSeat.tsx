import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
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
  useSeatDimensions,
  type SeatDimensions,
} from "../utils/seatDimensions";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import type { FeltPalette } from "../styles/feltPalette";
import type { AppThemeColors } from "../styles/themeColors";

function seatColor(playerId: string, seatColors: readonly string[]): string {
  let n = 0;
  for (let i = 0; i < playerId.length; i++) n += playerId.charCodeAt(i);
  return seatColors[n % seatColors.length];
}

function roleEmoji(role: Player["role"]): string | null {
  switch (role) {
    case "President":
      return "👑";
    case "Vice President":
      return "⭐";
    case "Vice Asshole":
      return "💩";
    case "Asshole":
      return "💩";
    default:
      return null;
  }
}

export type OpponentSeatPlayer = {
  id: string;
  name: string;
  handCount: number;
  role: Player["role"];
  isDeadHand?: boolean;
  sidelinedCount?: number;
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
  /** Floating +XP with the checkered flag (local human only). */
  showTrickXp?: boolean;
  /** Precomputed seat metrics from play-area layout (keeps ring math in sync). */
  seatDims?: SeatDimensions;
  /** Width basis when seatDims is not supplied. */
  layoutWidth?: number;
  /** Lobby ready indicator — checkmark at bottom-left of avatar. */
  isReady?: boolean;
  /** Dead hand seat dimmed like a graveyard during active play. */
  graveyardMode?: boolean;
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
  seatDims: seatDimsProp,
  layoutWidth,
  isReady = false,
  graveyardMode = false,
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
  const miniCardW = Math.max(18, avatarSize * 0.34);
  const miniCardH = Math.max(26, avatarSize * 0.48);
  const readyBadgeSize = Math.max(16, Math.round(avatarSize * 0.34));

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
      <View
        style={[
          styles.avatarWrap,
          { width: avatarSize, height: avatarSize },
          celebrateTrickWin && styles.avatarWrapCelebrate,
        ]}
      >
        <TrickWinCelebration
          active={celebrateTrickWin}
          avatarSize={avatarSize}
          showXp={showTrickXp}
        />
        {isLastPlay && !isOut && !isActive && !celebrateTrickWin && (
          <View
            style={[
              styles.lastPlayRing,
              {
                width: avatarSize + 8,
                height: avatarSize + 8,
                borderRadius: (avatarSize + 8) / 2,
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
              backgroundColor: isDeadHand
                ? "rgba(255,255,255,0.08)"
                : seatColor(player.id, palette.seatColors),
            },
            isOut && !isDeadHand && styles.avatarOut,
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
      </View>

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
      ) : hasPassed ? (
        <Text style={[styles.statusPill, styles.passPill]}>Pass</Text>
      ) : isThinking ? (
        <Text style={[styles.statusPill, styles.thinkPill]}>…</Text>
      ) : isLocal ? (
        <Text style={[styles.statusPill, styles.youPill]}>You</Text>
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
    right: -8,
    bottom: -4,
    paddingHorizontal: 5,
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
  thinkPill: {
    fontSize: 12,
    ...onFeltTextStyle(onFelt, "accent"),
  },
  youPill: {
    ...onFeltTextStyle(onFelt, "accent"),
  },
  });
}
