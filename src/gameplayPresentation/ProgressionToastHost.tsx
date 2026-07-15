import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import GameplayGlassPanel from "./GameplayGlassPanel";
import {
  subscribeGameplayToasts,
  type GameplayToast,
} from "./progressionToastBus";

const MAX_VISIBLE = 3;
const LIFE_MS = 2800;

type Item = GameplayToast & { key: string };

type Props = {
  enabled?: boolean;
  /** Distance from screen bottom — resolveHandFeedbackBottom (above resting cards). */
  bottomInset?: number;
};

/**
 * Stacking glass toasts for XP / achievement progress during play.
 * Anchored above HAND_BASELINE via `bottomInset`.
 */
export default function ProgressionToastHost({
  enabled = true,
  bottomInset = 0,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, bottomInset),
    [colors, bottomInset],
  );
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeGameplayToasts((toast) => {
      setItems((prev) => {
        const next = [...prev, { ...toast, key: toast.id }].slice(-MAX_VISIBLE);
        return next;
      });
      setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== toast.id));
      }, LIFE_MS);
    });
  }, [enabled]);

  if (!enabled || items.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {items.map((item) => (
        <ToastRow key={item.key} item={item} />
      ))}
    </View>
  );
}

function ToastRow({ item }: { item: Item }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, y]);

  const accent =
    item.kind === "xp"
      ? colors.gold
      : item.kind === "streak"
        ? "#ff8a4c"
        : "#7B6CF0";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>
      <GameplayGlassPanel compact accentColor={accent} style={styles.toast}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
      </GameplayGlassPanel>
    </Animated.View>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  bottomInset = 0,
) {
  return StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: bottomInset,
      gap: 6,
      zIndex: 55,
      maxWidth: "100%",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    toast: {
      minWidth: 120,
      maxWidth: 190,
    },
    title: {
      fontSize: 12,
      fontWeight: "800",
    },
    body: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "600",
    },
  });
}
