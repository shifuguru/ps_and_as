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
  /** Existing glass pill styles — keep the white casino pill as the hero. */
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
  /** Large flame aura. Off = sparkles only. */
  showFlames?: boolean;
  /** Cap on flame aura height (px). */
  maxFlameHeight?: number;
  /**
   * Ember / sparkle pattern.
   * `top` — rise from the aura (default Runs!).
   * `around` — small sparkles inside + outside all sides.
   */
  emberSpread?: EmberSpread;
  /**
   * When true, compact energy stays mostly inside the pill
   * (streak / prestige widgets). Open mode = behind-pill reward aura.
   */
  containFlames?: boolean;
};

/**
 * White Runs! pill with a premium behind-the-pill fire reward aura.
 * The pill (shape, type, readability) stays the hero — fire never covers text.
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
  const flameMax = containFlames
    ? Math.min(maxFlameHeight, Math.max(12, size.height * 0.7 || 14))
    : maxFlameHeight;

  const pillPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anim.pillScale.value }],
  }));

  const warmEdgeStyle =
    !containFlames && active
      ? ({
          ...Platform.select({
            ios: {
              shadowColor: palette.core,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 10,
            },
            android: { elevation: 6 },
            web: {
              boxShadow: `0 0 10px 1px ${palette.glowCore}`,
            } as object,
            default: {},
          }),
        } satisfies ViewStyle)
      : null;

  return (
    <View
      style={[styles.root, style]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {/* Layer 3 — atmospheric bloom (farthest back). */}
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

      {/* Layer 2 — large fire aura BEHIND the pill. */}
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

      {/* Layer 1 — white pill hero (always readable). */}
      <Animated.View
        style={[styles.glassPill, warmEdgeStyle, pillStyle, pillPopStyle]}
      >
        {children ?? (
          <Text numberOfLines={1} style={[styles.label, textStyle]}>
            {label}
          </Text>
        )}
      </Animated.View>

      {/* Heat shimmer above the aura — never over text. */}
      {flamesOn && !containFlames ? (
        <HeatShimmer
          width={size.width}
          height={size.height}
          shimmer={anim.shimmer}
          effectOpacity={anim.effectOpacity}
          active={active}
        />
      ) : null}

      {/* Layer 4 — floating embers (above fire, clear of text). */}
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
