import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import GameplayGlassPanel from "./GameplayGlassPanel";
import {
  subscribeGameplayToasts,
  type GameplayToast,
} from "./progressionToastBus";

const MAX_VISIBLE = 3;
const LIFE_MS = 3200;
const FADE_OUT_MS = 420;

type Item = GameplayToast & { key: string };

type Props = {
  enabled?: boolean;
  /** Distance from screen bottom — resolveHandFeedbackBottom (above resting cards). */
  bottomInset?: number;
};

/**
 * Stacking glass toasts for XP / achievement unlocks during play.
 * Anchored above HAND_BASELINE via `bottomInset`. Auto-fades out.
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

  const removeToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return subscribeGameplayToasts((toast) => {
      setItems((prev) => {
        const next = [...prev, { ...toast, key: toast.id }].slice(-MAX_VISIBLE);
        return next;
      });
    });
  }, [enabled]);

  if (!enabled || items.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {items.map((item) => (
        <ToastRow key={item.key} item={item} onDone={removeToast} />
      ))}
    </View>
  );
}

function ToastRow({
  item,
  onDone,
}: {
  item: Item;
  onDone: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let cancelled = false;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();

    const fadeTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: -6,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) onDone(item.id);
      });
    }, LIFE_MS);

    return () => {
      cancelled = true;
      clearTimeout(fadeTimer);
    };
  }, [item.id, onDone, opacity, y]);

  const accent =
    item.kind === "xp"
      ? colors.gold
      : item.kind === "streak"
        ? "#ff8a4c"
        : "#c9a227";

  const isAchievement = item.kind === "achievement";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>
      <GameplayGlassPanel
        compact
        accentColor={accent}
        style={[styles.toast, isAchievement && styles.toastAchievement]}
      >
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
      elevation: 55,
      maxWidth: "100%",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    toast: {
      minWidth: 120,
      maxWidth: 220,
    },
    toastAchievement: {
      minWidth: 160,
      maxWidth: 260,
    },
    title: {
      fontSize: 12,
      fontWeight: "800",
    },
    body: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
  });
}
