import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useForcedPortraitFrame } from "../utils/orientationLock";
import { DEFAULT_FELT_COLOR } from "../services/wallpaper";

/**
 * Keep phones on a portrait layout even when the browser reports landscape.
 *
 * Browsers cannot OS-lock orientation in a normal tab / DevTools. Instead we
 * keep rendering a portrait frame (short × long) and fit it upright in the
 * physical viewport — no "please rotate" message.
 *
 * Tablets and desktop are unchanged.
 */
export default function PhonePortraitLock({
  children,
}: {
  children: React.ReactNode;
}) {
  const frame = useForcedPortraitFrame();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  if (!frame.rotate) {
    return <View style={styles.root}>{children}</View>;
  }

  const scale = Math.min(
    frame.physicalWidth / frame.layoutWidth,
    frame.physicalHeight / frame.layoutHeight,
  );

  return (
    <View
      style={[
        styles.host,
        { backgroundColor: DEFAULT_FELT_COLOR } as object,
      ]}
    >
      <View
        style={[
          styles.portraitFrame,
          {
            width: frame.layoutWidth,
            height: frame.layoutHeight,
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  host: {
    ...(Platform.OS === "web"
      ? ({
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
        } as object)
      : StyleSheet.absoluteFillObject),
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  portraitFrame: {
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ transformOrigin: "center center" } as object)
      : null),
  },
});
