import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { WEB_OVERLAY_ROOT_FIXED } from "../styles/webFullBleed";
import { attemptAppRefresh } from "../utils/appRefresh";
import { fetchReadmeMarkdown } from "../utils/readmeFallback";

type Props = {
  error?: Error | null;
  onRefresh?: () => void;
};

/** Native crash UI — shows the live GitHub README (raw markdown). Web redirects to readme-fallback.html. */
export default function CrashLandingPage({ error, onRefresh }: Props) {
  const { colors } = useAppTheme();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          ...(WEB_OVERLAY_ROOT_FIXED ?? null),
          backgroundColor: colors.surface,
        },
        bar: {
          paddingVertical: 12,
          paddingHorizontal: 16,
        },
        refreshText: {
          color: colors.gold,
          fontSize: 16,
          textDecorationLine: "underline",
        },
        scroll: {
          flex: 1,
        },
        wrap: {
          maxWidth: 820,
          width: "100%",
          alignSelf: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 48,
        },
        loader: {
          marginTop: 24,
        },
        readme: {
          color: colors.textPrimary,
          fontSize: 14,
          lineHeight: 21,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        },
        errorText: {
          color: colors.textSecondary,
          fontSize: 16,
          lineHeight: 24,
        },
        devError: {
          marginTop: 20,
          color: colors.textMuted,
          fontSize: 11,
          lineHeight: 16,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        },
      }),
    [colors],
  );

  useEffect(() => {
    let cancelled = false;
    fetchReadmeMarkdown()
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || "Could not load README");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = () => {
    onRefresh?.();
    attemptAppRefresh();
  };

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <View style={styles.bar}>
        <Pressable
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator
      >
        {!markdown && !loadError ? (
          <ActivityIndicator color={colors.gold} size="large" style={styles.loader} />
        ) : null}
        {loadError ? (
          <Text style={styles.errorText}>
            {loadError}. Tap Refresh to retry the game.
          </Text>
        ) : null}
        {markdown ? (
          <Text style={styles.readme} selectable>
            {markdown}
          </Text>
        ) : null}
        {__DEV__ && error?.message ? (
          <Text style={styles.devError} selectable>
            {error.message}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
