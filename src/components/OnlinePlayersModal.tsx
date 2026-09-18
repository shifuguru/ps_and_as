import React, { useMemo } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { triggerHaptic } from "../utils/haptics";
import { playerInitials } from "../utils/playerDisplay";
import MenuIcon from "./MenuIcon";
import type { OnlinePlayer } from "../services/onlinePresence";

type Props = {
  visible: boolean;
  playerCount: number;
  players: OnlinePlayer[];
  currentPlayerId?: string | null;
  friendIds?: string[];
  onAddFriend?: (player: OnlinePlayer) => void;
  onClose: () => void;
};

export default function OnlinePlayersModal({
  visible,
  playerCount,
  players,
  currentPlayerId,
  friendIds = [],
  onAddFriend,
  onClose,
}: Props) {
  const { ui, blur, colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);
  const maxCardHeight = Math.min(height - insets.top - insets.bottom - 48, 520);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          ui.modalOverlay,
          {
            paddingTop: Math.max(24, insets.top + 12),
            paddingBottom: Math.max(24, insets.bottom + 12),
          },
        ]}
      >
        <BlurPanel
          style={[
            ui.modalCard,
            styles.card,
            { width: cardWidth, maxWidth: cardWidth, maxHeight: maxCardHeight },
          ]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Players Online</Text>
          <Text style={styles.subtitle}>
            {playerCount === 1
              ? "1 player connected"
              : `${playerCount} players connected`}
          </Text>

          {players.length > 0 ? (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {players.map((player, index) => (
                <View
                  key={player.id}
                  style={[
                    styles.row,
                    index < players.length - 1 ? styles.rowDivider : null,
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={player.displayName}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {playerInitials(player.displayName)}
                    </Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {player.displayName}
                    </Text>
                    {player.title ? (
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {player.title}
                      </Text>
                    ) : null}
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {player.level != null ? `Level ${player.level}` : "Level unknown"}
                      {player.presidents != null ? `  ·  ${player.presidents} Presidents` : ""}
                      {player.roundsPlayed != null ? `  ·  ${player.roundsPlayed} rounds` : ""}
                    </Text>
                  </View>
                  {onAddFriend &&
                  player.id !== currentPlayerId &&
                  !friendIds.includes(player.id) ? (
                    <TouchableOpacity
                      style={styles.addFriendButton}
                      onPress={() => onAddFriend(player)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${player.displayName} as a friend`}
                    >
                      <MenuIcon name="personPlus" size={19} color={colors.accent} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Text style={ui.emptyTitle}>No players to show</Text>
              <Text style={ui.emptyBody}>
                {playerCount > 0
                  ? "Player names will appear here shortly."
                  : "Connected players will appear here when their names are available."}
              </Text>
            </View>
          )}

          <AppButton
            label="Close"
            variant="secondary"
            onPress={() => {
              triggerHaptic("light");
              onClose();
            }}
            accessibilityLabel="Close players online list"
            style={styles.closeBtn}
          />
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      width: "100%",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 14,
    },
    listScroll: {
      flexGrow: 0,
      flexShrink: 1,
      marginBottom: 16,
    },
    listContent: {
      paddingVertical: 2,
    },
    row: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 10,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.panelBorder,
    },
    rowName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.btnAccentBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnAccentBorder,
    },
    avatarText: {
      color: colors.btnAccentText,
      fontSize: 13,
      fontWeight: "800",
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowTitle: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
      fontStyle: "italic",
    },
    rowMeta: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "600",
    },
    addFriendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.btnSecondaryBorder,
    },
    emptyState: {
      marginBottom: 16,
    },
    closeBtn: {
      width: "100%",
    },
  });
}
