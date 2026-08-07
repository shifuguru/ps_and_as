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
import HeatShimmer from "./HeatShimmer";
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
  /** Existing glass pill styles. */
  pillStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Root wrapper style (e.g. full-width stretch). */
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  /** Warm Runs! by default; pass platinum (etc.) for variants. */
  palette?: RunsPalette;
  flameSeeds?: FlameSeed[];
  /** Soft bloom behind the pill. */
  showGlow?: boolean;
  /** Soft flame band above the pill. Off = sparkles only. */
  showFlames?: boolean;
  /** Cap on flame rise height (px). */
  maxFlameHeight?: number;
  /**
   * Ember / sparkle pattern.
   * `top` — rise from the flame band (default Runs!).
   * `around` — small sparkles inside + outside all sides.
   */
  emberSpread?: EmberSpread;
  /**
   * When true, compact energy for streak / prestige widgets.
   * Open mode = centered, pill-constrained Runs! fire.
   */
  containFlames?: boolean;
};

/**
 * Warm cream Runs! pill centered in a soft, pill-constrained fire band.
 * Flames rise from the top rim ~half the pill height; text stays readable.
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

  const flamesOn = showFlames && active;
  const glowOn = showGlow && active;
  // Open mode: hard-cap rise to ~half pill height (step brief).
  const flameMax = containFlames
    ? Math.min(maxFlameHeight, Math.max(12, size.height * 0.55 || 14))
    : Math.min(
        maxFlameHeight,
        Math.max(10, (size.height || 22) * RUNS_LAYOUT.auraHeightFactor),
      );

  const pillPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anim.pillScale.value }],
  }));

  const warmPillChrome =
    !containFlames && palette.pillFill
      ? ({
          backgroundColor: palette.pillFill,
          borderWidth: RUNS_LAYOUT.neonBorderWidth,
          borderColor: palette.pillBorder ?? palette.core,
          borderRadius: RUNS_LAYOUT.pillRadius,
          ...Platform.select({
            ios: {
              shadowColor: palette.core,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 8,
            },
            android: { elevation: 6 },
            web: {
              boxShadow: `0 0 10px 1px ${palette.glowCore}`,
            } as object,
            default: {},
          }),
        } satisfies ViewStyle)
      : null;

  const warmLabel =
    !containFlames && palette.pillText
      ? ({ color: palette.pillText } satisfies TextStyle)
      : null;

  return (
    <View
      style={[styles.root, style]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {/* Soft heat bloom — centered on the pill. */}
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

      {/* Soft fire band BEHIND the pill, locked to pill width. */}
      {flamesOn ? (
        <View
          style={[
            styles.flameAura,
            containFlames && styles.flameAuraContained,
          ]}
          pointerEvents="none"
        >
          <FlameLayer
            width={size.width}
            height={size.height}
            flameIntensity={anim.flameIntensity}
            ignition={anim.ignition}
            effectOpacity={anim.effectOpacity}
            seeds={flameSeeds}
            maxFlameHeight={flameMax}
            contained={containFlames}
          />
        </View>
      ) : null}

      {/* Warm cream pill — dead center of the effect. */}
      <Animated.View
        style={[styles.glassPill, warmPillChrome, pillStyle, pillPopStyle]}
      >
        {children ?? (
          <Text
            numberOfLines={1}
            style={[styles.label, warmLabel, textStyle]}
          >
            {label}
          </Text>
        )}
      </Animated.View>

      {flamesOn && !containFlames ? (
        <HeatShimmer
          width={size.width}
          height={size.height}
          shimmer={anim.shimmer}
          effectOpacity={anim.effectOpacity}
          active={active}
        />
      ) : null}

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
  flameAura: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: "visible",
  },
  flameAuraContained: {
    overflow: "hidden",
    borderRadius: 14,
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
  sparkleAccent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    overflow: "visible",
  },
});
