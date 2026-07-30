import React from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FELT_WALLPAPER } from "../services/wallpaper";
import { resolveFeltEnvironment } from "../styles/feltPalette";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  tint: string;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  /** Corner radius for the clipped texture + tint stack. */
  borderRadius?: number;
};

/**
 * Mini table-felt sample: grey texture under the same tint paint as the real table.
 */
export default function FeltTintPreview({
  tint,
  style,
  selected = false,
  borderRadius = 12,
}: Props) {
  const { mode, colors } = useAppTheme();
  const env = resolveFeltEnvironment(tint, mode);

  return (
    <View
      style={[
        styles.host,
        {
          borderRadius,
          borderColor: selected ? colors.textPrimary : "rgba(255,255,255,0.28)",
          borderWidth: selected ? 2.5 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      <Image
        source={FELT_WALLPAPER}
        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
        resizeMode="cover"
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            backgroundColor: env.displayTint,
            opacity: env.tintOpacity,
          },
        ]}
      />
      {env.ambientWashOpacity > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius,
              backgroundColor: `rgba(${env.ambientWashRgb}, ${env.ambientWashOpacity})`,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: "hidden",
    backgroundColor: "#333333",
  },
});
