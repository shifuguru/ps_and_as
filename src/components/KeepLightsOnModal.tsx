import React, { useMemo } from "react";
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import BlurPanel from "./BlurPanel";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { resolveDonateUrl } from "../config/donateUrl";
import { triggerHaptic } from "../utils/haptics";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function KeepLightsOnModal({ visible, onClose }: Props) {
  const { ui, blur, colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 400);
  const donateUrl = resolveDonateUrl();

  const openDonate = () => {
    triggerHaptic("light");
    void Linking.openURL(donateUrl).catch(() => {
      /* ignore */
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>Keep the Lights On</Text>
          <Text style={[ui.modalBody, styles.body]}>
            Thanks for playing. Multiplayer hosting and ongoing updates cost real
            money — servers, bandwidth, and time at the table.
          </Text>
          <Text style={[ui.modalBody, styles.body]}>
            Support is completely voluntary. It never unlocks advantages,
            cosmetics, or special rules — it just helps keep the lights on.
          </Text>
          <Text style={styles.honesty}>No popups. No pressure. Just appreciation.</Text>

          <View style={styles.footerActions}>
            <AppButton
              label="Not now"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                triggerHaptic("light");
                onClose();
              }}
              accessibilityLabel="Close without donating"
            />
            <AppButton
              label="Contribute"
              variant="primary"
              style={{ flex: 1.35 }}
              onPress={openDonate}
              accessibilityLabel="Open donation page"
            />
          </View>
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    body: {
      fontSize: 15,
      fontWeight: "600",
      textAlign: "left",
      marginBottom: 12,
      lineHeight: 22,
    },
    honesty: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 18,
      fontStyle: "italic",
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
