import React, { useMemo } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { triggerHaptic } from "../utils/haptics";
import type { OnlinePlayer } from "../services/onlinePresence";

type Props = {
  visible: boolean;
  playerCount: number;
  players: OnlinePlayer[];
  onClose: () => void;
};

export default function OnlinePlayersModal({
  visible,
  playerCount,
  players,
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
                  key={`${player.displayName}-${index}`}
                  style={[
                    styles.row,
                    index < players.length - 1 ? styles.rowDivider : null,
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={player.displayName}
                >
                  <Text style={styles.rowName} numberOfLines={2}>
                    {player.displayName}
                  </Text>
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
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.panelBorder,
    },
    rowName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    emptyState: {
      marginBottom: 16,
    },
    closeBtn: {
      width: "100%",
    },
  });
}
