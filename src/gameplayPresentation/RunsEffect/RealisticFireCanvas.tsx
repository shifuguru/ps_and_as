import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

type Props = {
  width: number;
  height: number;
  active?: boolean;
  /** 0–1 master intensity (idle settle / ignition). */
  intensity: SharedValue<number>;
  fireKind?: "petrol" | "blue" | "warm" | "platinum";
  showBloom?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Native stub — realistic canvas fire is web-only.
 * Native keeps the Reanimated FlameLayer / EmberLayer accents.
 */
export default function RealisticFireCanvas(_props: Props) {
  return <View pointerEvents="none" />;
}
