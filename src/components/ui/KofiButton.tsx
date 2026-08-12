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

/** Native aspect ratio of the official Ko-fi button artwork. */
const KOFI_BUTTON_ASPECT = 174 / 44;

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
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    minHeight: 56,
    alignSelf: "stretch",
  },
  image: {
    width: "100%",
    aspectRatio: KOFI_BUTTON_ASPECT,
    minHeight: 56,
  },
});
