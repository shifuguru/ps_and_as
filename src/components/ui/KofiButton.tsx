import React from "react";
import {
  Image,
  Linking,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { resolveDonateUrl } from "../../config/donateUrl";
import { triggerHaptic } from "../../utils/haptics";

/** Official Ko-fi button asset — https://more.ko-fi.com/brand-assets */
const KOFI_BUTTON_IMAGE =
  "https://storage.ko-fi.com/cdn/brandasset/kofi_button_red.png";

type Props = {
  style?: StyleProp<ViewStyle>;
  url?: string;
};

export default function KofiButton({ style, url }: Props) {
  const target = url ?? resolveDonateUrl();

  return (
    <TouchableOpacity
      style={[styles.wrap, style]}
      onPress={() => {
        triggerHaptic("light");
        void Linking.openURL(target).catch(() => {
          /* ignore */
        });
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Support on Ko-fi"
    >
      <Image
        source={{ uri: KOFI_BUTTON_IMAGE }}
        style={styles.image}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  image: {
    width: 174,
    height: 44,
  },
});
