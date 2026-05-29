import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { CRASH_LANDING } from "../content/crashLandingContent";
import { WEB_OVERLAY_ROOT_FIXED } from "../styles/webFullBleed";
import { attemptAppRefresh } from "../utils/appRefresh";

type Props = {
  error?: Error | null;
  onRefresh?: () => void;
};

export default function CrashLandingPage({ error, onRefresh }: Props) {
  const handleRefresh = () => {
    onRefresh?.();
    attemptAppRefresh();
  };

  const handlePlay = () => {
    if (Platform.OS === "web") {
      attemptAppRefresh();
      return;
    }
    Linking.openURL(CRASH_LANDING.playUrl).catch(() => undefined);
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
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{CRASH_LANDING.title}</Text>
        <Text style={styles.tagline}>{CRASH_LANDING.tagline}</Text>

        <Text style={styles.body}>{CRASH_LANDING.intro}</Text>
        <View style={styles.list}>
          {CRASH_LANDING.reasons.map((line) => (
            <Text key={line} style={styles.listItem}>
              {"• "}
              {line}
            </Text>
          ))}
        </View>

        <Text style={styles.body}>{CRASH_LANDING.refreshHint}</Text>
        <Text style={styles.body}>{CRASH_LANDING.calmLine}</Text>

        <TouchableOpacity
          style={styles.playLink}
          onPress={handlePlay}
          activeOpacity={0.88}
          accessibilityRole="link"
          accessibilityLabel={CRASH_LANDING.playLabel}
        >
          <Text style={styles.playLinkText}>{CRASH_LANDING.playLabel}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{CRASH_LANDING.howToPlayTitle}</Text>
        <View style={styles.list}>
          {CRASH_LANDING.howToPlay.map((line) => (
            <Text key={line} style={styles.listItem}>
              {"• "}
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>{CRASH_LANDING.hardRefreshNote}</Text>
        </View>

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
const TEXT = "#f5f0e6";
const MUTED = "rgba(245, 240, 230, 0.72)";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(WEB_OVERLAY_ROOT_FIXED ?? null),
    ...(Platform.OS === "web"
      ? ({
          backgroundImage: `radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.08), transparent 42%), linear-gradient(180deg, ${FELT_DEEP}, ${FELT})`,
          backgroundColor: FELT,
        } as object)
      : { backgroundColor: FELT }),
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
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
        } as object)
      : null),
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
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },
  title: {
    color: GOLD,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  tagline: {
    color: MUTED,
    fontSize: 16,
    fontStyle: "italic",
    marginBottom: 20,
    lineHeight: 24,
  },
  body: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 14,
  },
  list: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  listItem: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  playLink: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 22,
  },
  playLinkText: {
    color: GOLD,
    fontSize: 17,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  note: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.22)",
    backgroundColor: "rgba(0, 0, 0, 0.22)",
  },
  noteText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
  },
  devError: {
    marginTop: 20,
    color: "rgba(245, 240, 230, 0.5)",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
