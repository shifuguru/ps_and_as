import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Text,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";
import { USE_NATIVE_DRIVER } from "../utils/useNativeDriver";
import { useAppTheme } from "../context/ThemeContext";
import { useGameTerminology } from "../hooks/useGameTerminology";

type Props = {
  onFinish: () => void;
  /** Fired when the frosted veil begins lifting so the menu can fade in over felt. */
  onRevealBegin?: () => void;
};

const CHARCOAL = "#2a2628";
const BURGUNDY = "#7a1f35";
const SUITS = ["♠", "♥", "♦", "♣"];

type SplashCard = {
  rank: string;
  suit: string;
  red: boolean;
  rotate: number;
  x: number;
  y: number;
  delay: number;
};

const CARDS: SplashCard[] = [
  { rank: "A", suit: "♠", red: false, rotate: -16, x: -0.26, y: -0.1, delay: 60 },
  { rank: "Q", suit: "♥", red: true, rotate: 11, x: 0.27, y: -0.04, delay: 140 },
  { rank: "K", suit: "♦", red: true, rotate: -5, x: 0.02, y: 0.16, delay: 220 },
];

const BG_SUITS = [
  { s: "♠", left: "6%", top: "9%", size: 150 },
  { s: "♥", left: "62%", top: "6%", size: 170 },
  { s: "♦", left: "10%", top: "66%", size: 180 },
  { s: "♣", left: "64%", top: "70%", size: 140 },
] as const;

let BlurViewImpl: any = null;
try {
  BlurViewImpl = require("expo-blur").BlurView;
} catch {
  BlurViewImpl = null;
}

function GlassCard({
  card,
  width,
  progress,
  dark,
}: {
  card: SplashCard;
  width: number;
  progress: Animated.Value;
  dark: boolean;
}) {
  const height = width * 1.4;
  const color = dark
    ? card.red ? "#f2a4b4" : "#f2efeb"
    : card.red ? BURGUNDY : CHARCOAL;
  const settle = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });
  const spin = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${card.rotate * 1.6}deg`, `${card.rotate}deg`],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        local.card,
        dark && local.darkCard,
        {
          width,
          height,
          borderRadius: width * 0.1,
          marginLeft: -width / 2 + card.x * width * 3.2,
          marginTop: -height / 2 + card.y * width * 3.2,
          opacity: progress,
          transform: [{ translateY: settle }, { rotate: spin }],
        },
      ]}
    >
      {BlurViewImpl && Platform.OS !== "android" ? (
        <BlurViewImpl
          intensity={30}
          tint={dark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={[local.cardCorner, { color, fontSize: width * 0.2 }]}>
        {card.rank}
        {"\n"}
        {card.suit}
      </Text>
      <Text style={[local.cardPip, { color, fontSize: width * 0.5 }]}>
        {card.suit}
      </Text>
    </Animated.View>
  );
}

/**
 * Boot transition: milky frosted-glass splash, then dissolve to the Player Hub.
 * Timing is short — splash is a load bridge, not a cinematic.
 */
export default function SplashScreen({ onFinish, onRevealBegin }: Props) {
  const wording = useGameTerminology();
  const { width, height } = useWindowDimensions();
  const { mode, preferencesLoaded } = useAppTheme();
  const dark = mode === "dark";
  const veilOpacity = useRef(new Animated.Value(1)).current;
  const bgIn = useRef(new Animated.Value(0)).current;
  const lightIn = useRef(new Animated.Value(0)).current;
  const lightDrift = useRef(new Animated.Value(0)).current;
  const cardProgress = useRef(CARDS.map(() => new Animated.Value(0))).current;
  const loader = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale = useRef(new Animated.Value(0.92)).current;
  const brandTranslate = useRef(new Animated.Value(8)).current;
  const revealStarted = useRef(false);
  const cardWidth = Math.max(78, Math.min(118, Math.min(width, height) * 0.27));
  const logoSize = Math.max(44, Math.min(72, width * 0.15));

  useEffect(() => {
    if (!preferencesLoaded) return;
    const drift = Animated.timing(lightDrift, {
      toValue: 1,
      duration: 6000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    drift.start();
    const markReveal = () => {
      if (revealStarted.current) return;
      revealStarted.current = true;
      onRevealBegin?.();
    };

    const intro = Animated.parallel([
      Animated.timing(bgIn, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(lightIn, {
        toValue: 1,
        duration: 420,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      ...cardProgress.map((value, i) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 420,
          delay: CARDS[i].delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      ),
      Animated.timing(loader, {
        toValue: 1,
        duration: 760,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(brandTranslate, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    const hold = Animated.delay(280);

    const reveal = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(veilOpacity, {
        toValue: 0,
        duration: 560,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    const sequence = Animated.sequence([intro, hold, reveal]);

    // Start menu fade as soon as the veil begins lifting (~660ms in).
    const revealTimer = setTimeout(markReveal, 660);

    sequence.start(({ finished }) => {
      clearTimeout(revealTimer);
      if (!finished) return;
      markReveal();
      onFinish();
    });

    return () => {
      clearTimeout(revealTimer);
      sequence.stop();
      drift.stop();
    };
  }, [
    bgIn,
    cardProgress,
    lightIn,
    lightDrift,
    loader,
    brandOpacity,
    brandScale,
    brandTranslate,
    onFinish,
    onRevealBegin,
    preferencesLoaded,
    veilOpacity,
  ]);

  if (!preferencesLoaded) return null;

  return (
    <View style={local.root} pointerEvents="auto">
      <Animated.View
        style={[local.stage, dark && local.darkStage, { opacity: veilOpacity }]}
        pointerEvents="none"
      >
        <Animated.View style={[local.fill, { opacity: bgIn }]}>
          <Image
            source={require("../../assets/felt_grey.webp")}
            style={local.felt}
            resizeMode="repeat"
          />
        </Animated.View>
        <Animated.View style={[local.fill, { opacity: lightIn }]}>
          <Animated.View style={[local.glow, local.glowBurgundy, dark && local.darkGlowBurgundy, {
            transform: [
              { translateX: lightDrift.interpolate({ inputRange: [0, 1], outputRange: [-12, 32] }) },
              { translateY: lightDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) },
            ],
          }]} />
          <Animated.View style={[local.glow, local.glowCharcoal, dark && local.darkGlowCharcoal, {
            transform: [
              { translateX: lightDrift.interpolate({ inputRange: [0, 1], outputRange: [12, -32] }) },
              { translateY: lightDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
            ],
          }]} />
          {BG_SUITS.map((b) => (
            <Text
              key={b.s}
              style={[
                local.bgSuit,
                dark && local.darkBgSuit,
                { left: b.left, top: b.top, fontSize: b.size },
              ]}
            >
              {b.s}
            </Text>
          ))}
        </Animated.View>
        <View style={local.cards}>
          {CARDS.map((card, i) => (
            <GlassCard
              key={card.rank}
              card={card}
              width={cardWidth}
              progress={cardProgress[i]}
              dark={dark}
            />
          ))}
        </View>
      </Animated.View>
      <Animated.View
        style={[
          local.brand,
          {
            opacity: brandOpacity,
            transform: [
              { scale: brandScale },
              { translateY: brandTranslate },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            local.title,
            dark && local.darkTitle,
            gameTitleFaceStyle(),
            { fontSize: logoSize * 1.5, lineHeight: logoSize * 2 },
          ]}
          accessibilityRole="header"
        >
          {wording("P's & A's")}
        </Text>
        <Text style={[local.subtitle, dark && local.darkSubtitle]}>THE CARD GAME</Text>
        <View style={local.loader} accessibilityLabel="Loading">
          {SUITS.map((s, i) => (
            <Animated.Text
              key={s}
              style={[
                local.loaderSuit,
                dark && local.darkLoaderSuit,
                {
                  opacity: loader.interpolate({
                    inputRange: [0, i * 0.2, i * 0.2 + 0.3, 1],
                    outputRange: [0.2, 0.2, 0.9, 0.9],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              {s}
            </Animated.Text>
          ))}
        </View>
        <Text style={[local.credit, dark && local.darkCredit]}>App designed by Shifuguru</Text>
      </Animated.View>
    </View>
  );
}

const local = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#efebe6",
    overflow: "hidden",
  },
  darkStage: {
    backgroundColor: "#191c1b",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  felt: {
    width: "100%",
    height: "100%",
    opacity: 0.07,
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
    ...(Platform.OS === "web" ? ({ filter: "blur(60px)" } as object) : null),
  },
  glowBurgundy: {
    width: "90%",
    aspectRatio: 1,
    left: "-35%",
    top: "-12%",
    backgroundColor: "rgba(122,31,53,0.16)",
  },
  glowCharcoal: {
    width: "100%",
    aspectRatio: 1,
    right: "-45%",
    bottom: "-18%",
    backgroundColor: "rgba(42,38,40,0.14)",
  },
  darkGlowBurgundy: {
    backgroundColor: "rgba(172,77,97,0.22)",
  },
  darkGlowCharcoal: {
    backgroundColor: "rgba(143,164,151,0.14)",
  },
  bgSuit: {
    position: "absolute",
    color: "rgba(122,31,53,0.07)",
    ...(Platform.OS === "web"
      ? ({ filter: "blur(3px)" } as object)
      : { textShadowColor: "rgba(122,31,53,0.12)", textShadowRadius: 8 }),
  },
  darkBgSuit: {
    color: "rgba(224,150,166,0.10)",
  },
  cards: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    left: "50%",
    top: "50%",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#2a2628",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  darkCard: {
    backgroundColor: "rgba(42,48,45,0.68)",
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#000000",
  },
  cardCorner: {
    position: "absolute",
    left: 8,
    top: 6,
    fontWeight: "700",
    lineHeight: 20,
  },
  cardPip: {
    position: "absolute",
    alignSelf: "center",
    top: "28%",
    opacity: 0.85,
  },
  brand: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  title: {
    color: CHARCOAL,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.8)",
    textShadowRadius: 12,
  },
  darkTitle: {
    color: "#f2efeb",
    textShadowColor: "rgba(0,0,0,0.75)",
  },
  subtitle: {
    color: "rgba(42,38,40,0.62)",
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 4,
    fontWeight: "600",
  },
  darkSubtitle: {
    color: "rgba(242,239,235,0.72)",
  },
  loader: {
    flexDirection: "row",
    marginTop: 26,
  },
  credit: {
    color: "rgba(42,38,40,0.42)",
    fontSize: 11,
    marginTop: 18,
  },
  darkCredit: {
    color: "rgba(242,239,235,0.58)",
  },
  loaderSuit: {
    color: BURGUNDY,
    fontSize: 14,
    marginHorizontal: 7,
  },
  darkLoaderSuit: {
    color: "#f2a4b4",
  },
});
