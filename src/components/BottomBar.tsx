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
  bottomOffset?: number;
};

export default function BottomBar({
  children,
  style,
  minHeight = 80,
  bottomOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? 0 : (insets.bottom || 0);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { bottom, minHeight },
        style as any,
      ]}
    >
      <View style={[styles.inner, { minHeight, paddingBottom: Platform.OS === 'web' ? 16 : 28 }]}>{children}</View>
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
  },
  inner: {
    width: "100%",
    backgroundColor: "rgba(10, 10, 10, 0.97)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    alignItems: "center",
  },
});
