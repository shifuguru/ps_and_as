import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WEB_OVERLAY_ROOT_FIXED } from "../styles/webFullBleed";
import { attemptAppRefresh } from "../utils/appRefresh";
import { fetchReadmeMarkdown } from "../utils/readmeFallback";

type Props = {
  error?: Error | null;
  onRefresh?: () => void;
};

/** Native crash UI — shows the live GitHub README (raw markdown). Web redirects to readme-fallback.html. */
export default function CrashLandingPage({ error, onRefresh }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator
      >
        {!markdown && !loadError ? (
          <ActivityIndicator color={GOLD} size="large" style={styles.loader} />
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

const FELT_DEEP = "#0a3d26";
const FELT = "#0f5132";
const GOLD = "#d4af37";
const MUTED = "rgba(245, 240, 230, 0.82)";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(WEB_OVERLAY_ROOT_FIXED ?? null),
    backgroundColor: FELT,
  },
  bar: {
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212, 175, 55, 0.28)",
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.55)",
    backgroundColor: "rgba(212, 175, 55, 0.14)",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  refreshText: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  wrap: {
    maxWidth: 820,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  loader: {
    marginTop: 24,
  },
  readme: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  errorText: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
  },
  devError: {
    marginTop: 20,
    color: "rgba(245, 240, 230, 0.5)",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
