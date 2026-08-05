import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import BlurPanel from "./BlurPanel";
import ModalBackdrop from "./ModalBackdrop";
import AppButton from "./ui/AppButton";
import { useAppTheme } from "../context/ThemeContext";
import { MODAL_OVERLAY_Z } from "../styles/overlayZIndex";
import { resolvePrivacyUrl } from "../config/privacyUrl";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Short privacy notice for ads + Google sync + purchases.
 * Full policy: public/privacy.html (Play Console URL).
 */
export default function PrivacyPolicyModal({ visible, onClose }: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  const openFullPolicy = () => {
    void Linking.openURL(resolvePrivacyUrl());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        <ModalBackdrop visible zIndex={MODAL_OVERLAY_Z} />
        <BlurPanel style={[ui.modalCard, styles.card]} preset={blur.modal}>
          <Text style={ui.modalTitle}>Privacy</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.p}>
              Presidents &amp; Assholes stores your display name, career stats,
              and theme preferences on this device. If you link Google, those
              fields sync to our game server so you can restore them on another
              device.
            </Text>
            {Platform.OS === "web" ? (
              <>
                <Text style={styles.p}>
                  If you accept ads, Google AdSense (H5 Games Ads) may show
                  interstitial and rewarded ads. Ad networks may use cookies or
                  device identifiers as described in Google&apos;s policies. You
                  can decline ads; the game still works.
                </Text>
                <Text style={styles.p}>
                  Optional one-time Remove Ads purchases are processed by Stripe.
                  We store a server-side entitlement on your Google-linked
                  account so forced ads stay off after purchase. Rewarded
                  watch-for-XP ads may still be offered.
                </Text>
              </>
            ) : (
              <Text style={styles.p}>
                This Android build does not show ads or process in-app purchases.
                Online multiplayer uses our game server; your display name is
                visible to players at your table.
              </Text>
            )}
            <Text style={styles.p}>
              We do not sell your personal information. Contact the developer via
              the project GitHub repository for privacy requests.
            </Text>
          </ScrollView>
          <AppButton
            label="Full privacy policy"
            variant="secondary"
            onPress={openFullPolicy}
          />
          <AppButton label="Close" variant="primary" onPress={onClose} />
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: MODAL_OVERLAY_Z + 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "80%",
      gap: 12,
    },
    scroll: {
      maxHeight: 360,
    },
    p: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
  });
}
