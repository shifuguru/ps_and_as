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
import {
  WEB_FULL_BLEED_FIXED,
  WEB_FELT_FIXED_CLASS,
  ensureWebFeltBackdrop,
} from "../styles/webFullBleed";
import { resolveFeltEnvironment } from "../styles/feltPalette";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  tint?: string;
  /** On web, extend under the notch and browser chrome (default true). */
  fullBleed?: boolean;
};

/**
 * Felt wallpaper hook for App.
 * Theme mode changes the environment (tint lift, texture, ambient wash),
 * not panel opacity.
 */
export default function FeltBackground({
  tint = DEFAULT_FELT_COLOR,
  fullBleed = true,
}: Props) {
  const { mode } = useAppTheme();
  const env = resolveFeltEnvironment(tint, mode);

  useEffect(() => {
    if (Platform.OS === "web" && fullBleed) {
      ensureWebFeltBackdrop(tint, mode);
    }
  }, [tint, mode, fullBleed]);

  // Web full-bleed: document (html) owns wallpaper; App shell stays transparent.
  if (Platform.OS === "web" && fullBleed) {
    return null;
  }

  const tintOverlay = (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: env.displayTint, opacity: env.tintOpacity },
      ]}
    />
  );

  const ambientWash =
    env.ambientWashOpacity > 0 ? (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: `rgba(${env.ambientWashRgb}, ${env.ambientWashOpacity})`,
          },
        ]}
        pointerEvents="none"
      />
    ) : null;

  if (Platform.OS === "web") {
    const bleed = fullBleed ? WEB_FULL_BLEED_FIXED : null;
    return (
      <View
        // @ts-expect-error className is supported on RN Web
        className={fullBleed ? WEB_FELT_FIXED_CLASS : undefined}
        style={[
          bleed ?? {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          { backgroundColor: env.displayTint },
        ]}
        pointerEvents="none"
      >
        <Image
          source={FELT_WALLPAPER}
          style={styles.webImage as object}
          resizeMode="cover"
        />
        {tintOverlay}
        {ambientWash}
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
        {ambientWash}
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
