import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import { formatRoomTimeAgo, type AvailableRoom } from "../services/availableRooms";
import { hexToRgba } from "../utils/colorTheory";
import {
  isValidRoomCode,
  normalizeRoomCode,
} from "../utils/roomCode";
import type { HubConnectionStatus } from "../hooks/useHubRoomDiscovery";

const CAPSULE_RADIUS = 999;
const LIVE_GAMES_MAX_HEIGHT = 220;

type Props = {
  playerName: string;
  publicRooms: AvailableRoom[];
  roomsLoaded: boolean;
  isSearching: boolean;
  connectionStatus: HubConnectionStatus;
  error: string | null;
  onRefresh: () => void;
  onHost: () => void;
  onJoinRoom: (roomId: string) => void;
  onJoinWithCode: (code: string) => void;
  onSpectateRoom?: (roomId: string) => void;
  /** Reserve space for a pinned bottom bar (Back) on the hub shell. */
  contentBottomPadding?: number;
};

export default function HubOnlinePlayPanel({
  playerName,
  publicRooms,
  roomsLoaded,
  isSearching,
  connectionStatus,
  error,
  onRefresh,
  onHost,
  onJoinRoom,
  onJoinWithCode,
  onSpectateRoom,
  contentBottomPadding = 0,
}: Props) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [roomCode, setRoomCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const hasCode = !!normalizeRoomCode(roomCode);
  const hostDisabled = connectionStatus !== "connected";
  const joinCodeDisabled = !hasCode;

  const statusLabel =
    connectionStatus === "connected"
      ? "Server online"
      : connectionStatus === "connecting"
        ? "Connecting…"
        : "Server offline";

  return (
    <View
      style={[
        styles.root,
        contentBottomPadding > 0 && { paddingBottom: contentBottomPadding },
      ]}
    >
      <Text style={styles.statusHint}>{statusLabel}</Text>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <BlurPanel intensity={48} style={styles.liveGamesCard}>
        <View style={styles.liveGamesHeader}>
          <Text style={styles.sectionTitle}>Live Games</Text>
          <View style={styles.liveGamesHeaderRight}>
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={isSearching}
              accessibilityRole="button"
              accessibilityLabel="Refresh live games"
            >
              <Text
                style={[
                  styles.refreshLink,
                  isSearching && styles.refreshLinkDisabled,
                ]}
              >
                Refresh
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.liveGamesScroll}
          contentContainerStyle={styles.liveGamesScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {publicRooms.length === 0 && roomsLoaded ? (
            <Text style={ui.emptyBody}>
              No open tables right now. Start one below or join with a code.
            </Text>
          ) : (
            publicRooms.map((room) => {
              const inPlay = !!room.inGame && !!room.roundInProgress;
              const betweenRounds = !!room.inGame && !room.roundInProgress;
              const seatOpen = !!room.deadHandSeatOpen;
              const isBotTable = !!room.isBotHosted;
              const botStalled = !!room.botTableStalled;
              const full =
                !inPlay && !isBotTable && room.playerCount >= room.maxPlayers;
              const showSpectate =
                !!onSpectateRoom &&
                !!room.inGame &&
                seatOpen &&
                room.playerCount >= 2 &&
                (isBotTable || inPlay);
              const actionLabel = showSpectate
                ? "Spectate"
                : full
                  ? "Full"
                  : "Join";
              const actionDisabled =
                !playerName.trim() || (showSpectate ? false : full);

              return (
                <View key={room.roomId} style={styles.roomRow}>
                  <View style={styles.roomInfo}>
                    <Text style={styles.roomTitle} numberOfLines={1}>
                      {room.roomName || `${room.hostName}'s Game`}
                    </Text>
                    <Text style={styles.roomMeta} numberOfLines={2}>
                      {isBotTable ? "Bots" : `Host · ${room.hostName}`}
                      {" · "}
                      {room.playerCount}/{room.maxPlayers}
                      {botStalled
                        ? " · Stalled"
                        : inPlay
                          ? isBotTable
                            ? " · Watching"
                            : seatOpen
                              ? " · In Play · seat open"
                              : " · In Play"
                          : betweenRounds
                            ? " · Between Rounds"
                            : ` · ${formatRoomTimeAgo(room.createdAt)}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      showSpectate ? ui.btnSecondary : ui.btnGold,
                      styles.roomActionBtn,
                      actionDisabled && styles.roomActionDisabled,
                    ]}
                    onPress={() =>
                      showSpectate
                        ? onSpectateRoom?.(room.roomId)
                        : onJoinRoom(room.roomId)
                    }
                    disabled={actionDisabled}
                  >
                    <Text
                      style={[
                        showSpectate ? ui.btnSecondaryText : styles.roomActionText,
                        actionDisabled && styles.roomActionTextDisabled,
                      ]}
                    >
                      {actionLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </BlurPanel>

      <AppButton
        label="Start Your Own Table"
        icon="plus"
        variant="primary"
        onPress={onHost}
        disabled={hostDisabled}
        accessibilityLabel="Start your own table and invite friends"
        style={styles.hostCta}
        textStyle={styles.hostCtaText}
      />

      <BlurPanel intensity={48} style={styles.joinCard}>
        <Text style={styles.sectionTitle}>Join With Code</Text>
        <View
          style={[
            styles.codeInputWrap,
            codeFocused && styles.codeInputWrapFocused,
          ]}
        >
          <TextInput
            placeholder="Room code"
            placeholderTextColor={colors.textQuaternary}
            value={roomCode}
            onChangeText={(text) =>
              setRoomCode(normalizeRoomCode(text))
            }
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
            autoComplete={Platform.OS === "web" ? "one-time-code" : "off"}
            keyboardType={
              Platform.OS === "ios" ? "ascii-capable" : "default"
            }
            returnKeyType="go"
            onSubmitEditing={() => {
              if (hasCode) onJoinWithCode(normalizeRoomCode(roomCode));
            }}
            style={styles.codeInput}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.joinCodeBtn,
            joinCodeDisabled && styles.joinCodeBtnDisabled,
          ]}
          onPress={() => onJoinWithCode(normalizeRoomCode(roomCode))}
          disabled={joinCodeDisabled}
          accessibilityRole="button"
          accessibilityLabel="Join with room code"
        >
          <Text
            style={[
              styles.joinCodeBtnText,
              joinCodeDisabled && styles.joinCodeBtnTextDisabled,
            ]}
          >
            Join
          </Text>
        </TouchableOpacity>
      </BlurPanel>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const isDark = colors.mode === "dark";

  return StyleSheet.create({
    root: {
      gap: 12,
      width: "100%",
    },
    statusHint: {
      alignSelf: "flex-end",
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: -4,
    },
    errorPanel: {
      borderRadius: 14,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba("#ff8a8a", 0.4),
      backgroundColor: hexToRgba("#ff8a8a", isDark ? 0.1 : 0.08),
    },
    errorText: {
      color: "#ff8a8a",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
    liveGamesCard: {
      borderRadius: 16,
      padding: 14,
      overflow: "hidden",
    },
    liveGamesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 8,
    },
    liveGamesHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    refreshLink: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    refreshLinkDisabled: {
      opacity: 0.45,
    },
    liveGamesScroll: {
      maxHeight: LIVE_GAMES_MAX_HEIGHT,
    },
    liveGamesScrollContent: {
      gap: 2,
      paddingBottom: 2,
    },
    roomRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: hexToRgba(colors.textPrimary, isDark ? 0.12 : 0.1),
    },
    roomInfo: {
      flex: 1,
      minWidth: 0,
    },
    roomTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 2,
    },
    roomMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 15,
    },
    roomActionBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    roomActionDisabled: {
      opacity: 0.5,
    },
    roomActionText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "800",
    },
    roomActionTextDisabled: {
      color: colors.textTertiary,
    },
    hostCta: {
      minHeight: 64,
      borderRadius: 16,
    },
    hostCtaText: {
      fontSize: 16,
      fontWeight: "900",
    },
    joinCard: {
      borderRadius: 16,
      padding: 14,
      overflow: "hidden",
    },
    codeInputWrap: {
      width: "100%",
      borderRadius: CAPSULE_RADIUS,
      borderWidth: 1,
      borderColor: colors.actionSecondaryBorder,
      backgroundColor: colors.actionSecondaryBg,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === "ios" ? 12 : 8,
      marginTop: 10,
    },
    codeInputWrapFocused: {
      borderColor: hexToRgba(colors.accent, isDark ? 0.55 : 0.45),
    },
    codeInput: {
      color: colors.inputText,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 1.2,
    },
    joinCodeBtn: {
      marginTop: 10,
      minHeight: 48,
      borderRadius: CAPSULE_RADIUS,
      borderWidth: 1.5,
      borderColor: colors.actionPrimaryBorder,
      backgroundColor: colors.actionPrimaryBg,
      paddingHorizontal: 16,
      ...BUTTON_CENTER,
    },
    joinCodeBtnDisabled: {
      opacity: 0.58,
      backgroundColor: colors.actionPrimaryDisabledBg,
      borderColor: colors.actionPrimaryDisabledBorder,
    },
    joinCodeBtnText: buttonLabel(16, {
      color: colors.actionPrimaryText,
      fontWeight: "800",
    }),
    joinCodeBtnTextDisabled: {
      color: colors.actionPrimaryDisabledText,
    },
  });
}
