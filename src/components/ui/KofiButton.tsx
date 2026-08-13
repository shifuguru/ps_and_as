import React from "react";
import {
  Image,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { resolveDonateUrl } from "../../config/donateUrl";
import { BUTTON_CENTER, buttonLabel } from "../../styles/buttonStyles";
import { triggerHaptic } from "../../utils/haptics";

/** Ko-fi brand red — https://more.ko-fi.com/brand-assets */
export const KOFI_BRAND_RED = "#FF5E5B";

/** Official cup mark (no baked-in CTA text). */
const KOFI_CUP_IMAGE = "https://storage.ko-fi.com/cdn/cup-border.png";

type Props = {
  style?: StyleProp<ViewStyle>;
  url?: string;
  /** Button label — keep studio-neutral; avoid first-person “Support me”. */
  label?: string;
};

export default function KofiButton({
  style,
  url,
  label = "Contribute on Ko-fi",
}: Props) {
  const target = url ?? resolveDonateUrl();

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={() => {
        triggerHaptic("light");
        void Linking.openURL(target).catch(() => {
          /* ignore */
        });
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.contentRow}>
        <Image
          source={{ uri: KOFI_CUP_IMAGE }}
          style={styles.cup}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.label}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: KOFI_BRAND_RED,
    ...BUTTON_CENTER,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  cup: {
    width: 22,
    height: 22,
  },
  label: buttonLabel(15, {
    color: "#FFFFFF",
    fontWeight: "800",
  }),
});
