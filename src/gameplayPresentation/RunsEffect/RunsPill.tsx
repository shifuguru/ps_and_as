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
import EmberLayer, { type EmberSpread } from "./EmberLayer";
import { useRunsAnimation } from "./useRunsAnimation";
import {
  FLAME_SEEDS,
  RUNS_COLORS,
  RUNS_LAYOUT,
  type FlameSeed,
  type RunsPalette,
} from "./constants";

type Props = {
  /** Simple text label (Runs! gameplay). Ignored when `children` is set. */
  label?: string;
  /** Custom pill body — use for multi-line role-style content. */
  children?: React.ReactNode;
  /** Existing glass pill styles (body + highlighted). */
  pillStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Root wrapper style (e.g. full-width stretch). */
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  /** Warm Runs! by default; pass platinum (etc.) for variants. */
  palette?: RunsPalette;
  flameSeeds?: FlameSeed[];
  /** Soft bloom behind the glass. */
  showGlow?: boolean;
  /** Large flame wisps. Off = sparkles only. */
  showFlames?: boolean;
  /** Cap on rising flame wisps (px). */
  maxFlameHeight?: number;
  /**
   * Ember / sparkle pattern.
   * `top` — rise from the top (default Runs!).
   * `around` — small sparkles inside + outside all sides.
   */
  emberSpread?: EmberSpread;
  /**
   * When true, larger flame wisps stay mostly inside the pill;
   * only tiny sparkles extend outside.
   */
  containFlames?: boolean;
};

/**
 * Runs! glass capsule with premium energy accent layers.
 * Glass pill remains the hero — glow / flames / embers are accents only.
 */
export default function RunsPill({
  label,
  children,
  pillStyle,
  textStyle,
  style,
  active = true,
  palette = RUNS_COLORS,
  flameSeeds = FLAME_SEEDS,
  showGlow = true,
  showFlames = true,
  maxFlameHeight = RUNS_LAYOUT.maxFlameHeight,
  emberSpread = "top",
  containFlames = false,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const anim = useRunsAnimation(active);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      width > 0 &&
      (Math.abs(width - size.width) > 0.5 ||
        Math.abs(height - size.height) > 0.5)
    ) {
      setSize({ width, height });
    }
  };

  const burstStyle = useAnimatedStyle(() => {
    return {
      opacity: anim.ignition.value * 0.85 * anim.effectOpacity.value,
      transform: [
        { scaleX: 0.6 + anim.ignition.value * 0.55 },
        { scaleY: 0.5 + anim.ignition.value * 0.9 },
        { translateY: 2 + anim.ignition.value * 4 },
      ],
    } as ViewStyle;
  });

  const flamesOn = showFlames && active;
  const glowOn = showGlow && active;
  const flameMax = containFlames
    ? Math.min(maxFlameHeight, Math.max(12, size.height * 0.7 || 14))
    : maxFlameHeight;

  return (
    <View
      style={[styles.root, style]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {glowOn ? (
        <View style={styles.behind} pointerEvents="none">
          <GlowLayer
            glowOpacity={anim.glowOpacity}
            glowScale={anim.glowScale}
            effectOpacity={anim.effectOpacity}
            palette={palette}
          />
        </View>
      ) : null}

      {/* Flames behind the glass so the pill reads as the fuel source. */}
      {flamesOn ? (
        <View
          style={[
            styles.flameAccent,
            containFlames && styles.flameAccentContained,
          ]}
          pointerEvents="none"
        >
          {glowOn ? (
            <Animated.View
              style={[
                styles.ignitionBurst,
                {
                  backgroundColor: palette.glowCore,
                  shadowColor: palette.core,
                },
                burstStyle,
              ]}
            />
          ) : null}
          <FlameLayer
            width={size.width}
            flameIntensity={anim.flameIntensity}
            ignition={anim.ignition}
            effectOpacity={anim.effectOpacity}
            seeds={flameSeeds}
            maxFlameHeight={flameMax}
            contained={containFlames}
          />
        </View>
      ) : null}

      <View style={[styles.glassPill, pillStyle]}>
        {children ?? (
          <Text numberOfLines={1} style={[styles.label, textStyle]}>
            {label}
          </Text>
        )}
      </View>

      <View style={styles.sparkleAccent} pointerEvents="none">
        <EmberLayer
          width={size.width}
          height={size.height}
          ignition={anim.ignition}
          flameIntensity={anim.flameIntensity}
          effectOpacity={anim.effectOpacity}
          active={active}
          palette={palette}
          spread={emberSpread}
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
    overflow: "hidden",
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
  /** Behind glass — base of the flame sits in the pill (fuel), tips rise up. */
  flameAccent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: "visible",
  },
  flameAccentContained: {
    overflow: "hidden",
    borderRadius: 14,
  },
  sparkleAccent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    overflow: "visible",
  },
  ignitionBurst: {
    position: "absolute",
    left: "18%",
    right: "18%",
    bottom: -4,
    height: 10,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
});
