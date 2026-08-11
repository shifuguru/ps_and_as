import React, { useEffect, useState } from "react";
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
import RealisticFireCanvas from "./RealisticFireCanvas";
import { useRunsAnimation } from "./useRunsAnimation";
import {
  FLAME_SEEDS,
  RUNS_COLORS,
  RUNS_LAYOUT,
  type FlameSeed,
  type RunsPalette,
} from "./constants";

const USE_REALISTIC_FIRE = Platform.OS === "web";

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
 * Runs! pill — web uses conveyor canvas fire; native keeps soft wisps.
 * Contained variants (streak widgets) stay on the accent wisp path.
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
  const [fireIntensity, setFireIntensity] = useState(0);
  const anim = useRunsAnimation(active);
  const realisticOn =
    showFlames && active && USE_REALISTIC_FIRE && !containFlames;

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

  // Steady burn opacity for canvas fire — follow master fade only.
  // Do NOT couple to flameIntensity/ignition idle pulses (reads as speed-ups).
  useEffect(() => {
    if (!realisticOn) {
      setFireIntensity(0);
      return;
    }
    const id = setInterval(() => {
      const next = anim.effectOpacity.value;
      setFireIntensity((prev) =>
        Math.abs(prev - next) > 0.02 ? next : prev,
      );
    }, 48);
    return () => clearInterval(id);
  }, [realisticOn, anim.effectOpacity]);

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
  // Canvas fire brings its own bloom — skip the soft GlowLayer there.
  const glowOn = showGlow && active && !realisticOn;
  const flameMax = containFlames
    ? Math.min(maxFlameHeight, Math.max(12, size.height * 0.7 || 14))
    : maxFlameHeight;

  const fireChromeStyle = realisticOn
    ? palette.chromeBorder
      ? ({
          borderWidth: 1.5,
          borderColor: palette.chromeBorder,
          backgroundColor: palette.chromeBackground,
          ...(Platform.OS === "web" && palette.chromeBackgroundGradient
            ? ({
                backgroundImage: palette.chromeBackgroundGradient,
                backgroundColor: "transparent",
              } as object)
            : null),
          ...Platform.select({
            web: palette.chromeBoxShadow
              ? ({ boxShadow: palette.chromeBoxShadow } as object)
              : {},
            ios: palette.chromeShadowColor
              ? {
                  shadowColor: palette.chromeShadowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.55,
                  shadowRadius: 10,
                }
              : {},
            android: { elevation: 6 },
            default: {},
          }),
        } as ViewStyle)
      : palette.chromeBackground
        ? ({
            backgroundColor: palette.chromeBackground,
            borderWidth: 0,
            borderColor: "transparent",
            ...Platform.select({
              web: { boxShadow: "none" } as object,
              ios: { shadowOpacity: 0, shadowRadius: 0 },
              android: { elevation: 0 },
              default: {},
            }),
          } as ViewStyle)
        : styles.glassPillRunsFire
    : null;

  const labelColor =
    realisticOn && palette.chromeText
      ? palette.chromeText
      : undefined;

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

      {realisticOn ? (
        <RealisticFireCanvas
          width={size.width}
          height={size.height}
          active={active}
          intensity={fireIntensity}
          fireKind={palette.fireKind}
        />
      ) : null}

      {flamesOn && !realisticOn ? (
        <View
          style={[
            styles.flameAccent,
            containFlames && styles.flameAccentContained,
          ]}
          pointerEvents="none"
        >
          {showGlow && active ? (
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

      <View
        style={[
          styles.glassPill,
          pillStyle,
          fireChromeStyle,
        ]}
      >
        {children ?? (
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              labelColor ? { color: labelColor } : null,
              textStyle,
            ]}
          >
            {label}
          </Text>
        )}
      </View>

      {!realisticOn ? (
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
      ) : null}
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
  /** Cream face only — flames meet the pill edge with no rim or shadow. */
  glassPillRunsFire: {
    backgroundColor: "#FFF4E0",
    borderWidth: 0,
    borderColor: "transparent",
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
