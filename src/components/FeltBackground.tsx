import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import {
  DEFAULT_FELT_COLOR,
  FELT_WALLPAPER,
} from "../services/wallpaper";

type Props = {
  tint?: string;
};

export default function FeltBackground({ tint = DEFAULT_FELT_COLOR }: Props) {
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
