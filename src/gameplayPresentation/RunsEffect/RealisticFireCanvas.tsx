import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  width: number;
  height: number;
  active?: boolean;
  /** 0–1 master intensity (idle settle / ignition). */
  intensity?: number;
  fireKind?: "petrol" | "blue" | "warm" | "platinum";
  style?: StyleProp<ViewStyle>;
};

/**
 * Native stub — realistic canvas fire is web-only.
 * Native keeps the Reanimated FlameLayer / EmberLayer accents.
 */
export default function RealisticFireCanvas(_props: Props) {
  return <View pointerEvents="none" />;
}
