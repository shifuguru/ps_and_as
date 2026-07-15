import React, { useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import GlowLayer from "./GlowLayer";
import FlameLayer from "./FlameLayer";
import EmberLayer from "./EmberLayer";
import { useRunsAnimation } from "./useRunsAnimation";
import { RUNS_COLORS, RUNS_LAYOUT } from "./constants";

type Props = {
  label: string;
  /** Existing glass pill styles (body + highlighted). */
  pillStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  active?: boolean;
};

/**
 * Runs! glass capsule with premium energy accent layers.
 * Glass pill remains the hero — glow / flames / embers are accents only.
 *
 * Layer order: Glow (behind) → Glass+Label → Flames/Embers (top edge).
 */
export default function RunsPill({
  label,
  pillStyle,
  textStyle,
  active = true,
}: Props) {
  const [width, setWidth] = useState(0);
  const anim = useRunsAnimation(active);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w);
  };

  const burstStyle = useAnimatedStyle(() => {
    return {
      opacity: anim.ignition.value * 0.85 * anim.effectOpacity.value,
      transform: [
        { scaleX: 0.6 + anim.ignition.value * 0.55 },
        { scaleY: 0.5 + anim.ignition.value * 0.9 },
        { translateY: -2 - anim.ignition.value * 4 },
      ],
    } as ViewStyle;
  });

  return (
    <View style={styles.root} onLayout={onLayout} pointerEvents="none">
      {/* Behind glass */}
      <View style={styles.behind} pointerEvents="none">
        <GlowLayer
          glowOpacity={anim.glowOpacity}
          glowScale={anim.glowScale}
          effectOpacity={anim.effectOpacity}
        />
      </View>

      <View style={[styles.glassPill, pillStyle]}>
        <Text numberOfLines={1} style={[styles.label, textStyle]}>
          {label}
        </Text>
      </View>

      {/* Accent above top edge only */}
      <View style={styles.topAccent} pointerEvents="none">
        <Animated.View style={[styles.ignitionBurst, burstStyle]} />
        <FlameLayer
          width={width}
          flameIntensity={anim.flameIntensity}
          ignition={anim.ignition}
          effectOpacity={anim.effectOpacity}
        />
        <EmberLayer
          width={width}
          ignition={anim.ignition}
          flameIntensity={anim.flameIntensity}
          effectOpacity={anim.effectOpacity}
          active={active}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    alignSelf: "center",
    overflow: "visible",
  },
  behind: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
    zIndex: 0,
  },
  glassPill: {
    position: "relative",
    zIndex: 2,
    borderRadius: RUNS_LAYOUT.pillRadius,
    overflow: "visible",
  },
  label: {
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.4,
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? ({ whiteSpace: "nowrap" } as object)
      : null),
  },
  topAccent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    overflow: "visible",
  },
  ignitionBurst: {
    position: "absolute",
    left: "18%",
    right: "18%",
    top: -6,
    height: 10,
    borderRadius: 999,
    backgroundColor: RUNS_COLORS.glowCore,
    shadowColor: RUNS_COLORS.core,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
});
