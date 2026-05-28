import React, { useEffect } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  DEFAULT_FELT_COLOR,
  FELT_WALLPAPER,
} from "../services/wallpaper";
import { WEB_FULL_BLEED_FIXED, ensureWebFeltBackdrop } from "../styles/webFullBleed";

type Props = {
  tint?: string;
  /** On web, extend under the notch and browser chrome (default true). */
  fullBleed?: boolean;
};

export default function FeltBackground({
  tint = DEFAULT_FELT_COLOR,
  fullBleed = true,
}: Props) {
  useEffect(() => {
    if (Platform.OS === "web" && fullBleed) {
      ensureWebFeltBackdrop(tint);
    }
  }, [tint, fullBleed]);

  const tintOverlay = (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: tint, opacity: 0.82 },
      ]}
    />
  );

  if (Platform.OS === "web") {
    const bleed = fullBleed ? WEB_FULL_BLEED_FIXED : null;
    return (
      <View
        style={[
          bleed ?? {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          { backgroundColor: tint },
        ]}
        pointerEvents="none"
      >
        <Image
          source={FELT_WALLPAPER}
          style={styles.webImage as object}
          resizeMode="cover"
        />
        {tintOverlay}
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground
        source={FELT_WALLPAPER}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {tintOverlay}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  webImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as object,
});
