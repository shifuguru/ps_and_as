import React from "react";
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
  bottomOffset?: number; // additional bottom margin above safe area
};

export default function BottomBar({
  children,
  style,
  minHeight = 80,
  bottomOffset = 100,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = (insets.bottom || 0) + bottomOffset;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { bottom, minHeight },
        style as any,
      ]}
    >
      <View style={[styles.inner, { minHeight }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 200,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  inner: {
    width: "100%",
    backgroundColor: "rgba(15, 15, 15, 0.98)",
    borderTopWidth: 2,
    borderTopColor: "rgba(212,175,55,0.4)",
    paddingTop: 8,
    paddingBottom: 28,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    alignItems: "center",
  },
});
