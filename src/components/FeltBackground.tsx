import React from "react";
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

type Props = {
  tint?: string;
};

const webFill =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
      } as object)
    : null;

export default function FeltBackground({ tint = DEFAULT_FELT_COLOR }: Props) {
  if (Platform.OS === "web") {
    return (
      <View
        style={[StyleSheet.absoluteFill, webFill, { backgroundColor: tint }]}
        pointerEvents="none"
      >
        <Image
          source={FELT_WALLPAPER}
          style={styles.webImage as object}
          resizeMode="cover"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tint, opacity: 0.82 },
          ]}
        />
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
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tint, opacity: 0.82 },
          ]}
        />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  webImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    // RN Web passes this through to the DOM img element
    objectFit: "cover",
  } as object,
});
