import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createPortal } from "react-dom";
import { getWebOverlayPortalHost } from "../utils/webOverlayPortal";

type Props = {
  children: React.ReactNode;
};

/**
 * Renders short-lived card flights above the bottom hand.
 * On web the hand bar lives in #ps-body-portal (z 50); in-tree flights stay under it.
 */
export default function ScreenFlightPortal({ children }: Props) {
  const layer = (
    <View style={styles.layer} pointerEvents="none">
      {children}
    </View>
  );

  if (Platform.OS === "web") {
    const host = getWebOverlayPortalHost();
    if (host) {
      return createPortal(layer, host);
    }
  }

  return layer;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    overflow: "visible",
  },
});
