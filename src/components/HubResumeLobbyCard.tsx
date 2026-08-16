import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BlurPanel from "./BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import type { LobbySession } from "../services/lobbySession";

const CAPSULE_RADIUS = 999;

type Props = {
  session: LobbySession;
  onRejoin: () => void;
  onDismiss: () => void;
};

export default function HubResumeLobbyCard({
  session,
  onRejoin,
  onDismiss,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const roleLabel = session.isHost ? "Host" : "Guest";
  const roomLabel = session.roomName?.trim() || session.roomId;

  return (
    <BlurPanel intensity={44} style={styles.card}>
      <Text style={styles.title}>Resume your lobby?</Text>
      <Text style={styles.body} numberOfLines={2}>
        {roleLabel} · room {roomLabel}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.rejoinBtn}
          onPress={onRejoin}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Rejoin lobby"
        >
          <Text style={styles.rejoinBtnText}>Rejoin</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Dismiss resume lobby"
        >
          <Text style={styles.dismissBtnText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </BlurPanel>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      padding: 14,
      overflow: "hidden",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 4,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
      marginBottom: 12,
    },
    actions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
    },
    rejoinBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: CAPSULE_RADIUS,
      borderWidth: 1.5,
      borderColor: colors.actionPrimaryBorder,
      backgroundColor: colors.actionPrimaryBg,
      paddingHorizontal: 14,
      ...BUTTON_CENTER,
    },
    rejoinBtnText: buttonLabel(15, {
      color: colors.actionPrimaryText,
      fontWeight: "800",
    }),
    dismissBtn: {
      minHeight: 44,
      borderRadius: CAPSULE_RADIUS,
      borderWidth: 1,
      borderColor: colors.actionSecondaryBorder,
      backgroundColor: colors.actionSecondaryBg,
      paddingHorizontal: 16,
      ...BUTTON_CENTER,
    },
    dismissBtnText: buttonLabel(14, {
      color: colors.actionSecondaryText,
      fontWeight: "700",
    }),
  });
}
