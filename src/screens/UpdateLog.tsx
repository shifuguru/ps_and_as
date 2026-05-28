import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import {
  KNOWN_ISSUES,
  UPDATE_ENTRIES,
  UPDATE_LOG_TAGLINE,
  type KnownIssue,
} from "./updateLogContent";

function statusColor(
  status: KnownIssue["status"],
  colors: ReturnType<typeof useAppTheme>["colors"],
): string {
  if (status === "Fix shipped") return colors.gold;
  if (status === "Monitoring") return colors.textSecondary;
  return "#ffb86c";
}

export default function UpdateLog({ onBack }: { onBack: () => void }) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          ui.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: bottomBarHeight,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { maxWidth: contentMax }]}>
          <ScreenTopBar title="What's New" />

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Live report</Text>
            <Text style={styles.intro}>{UPDATE_LOG_TAGLINE}</Text>
            <Text style={styles.introHint}>
              We update this list when we ship big features or learn about bugs
              worth knowing.
            </Text>
          </BlurPanel>

          <Text style={styles.sectionLabel}>Recent updates</Text>
          {UPDATE_ENTRIES.map((entry) => (
            <BlurPanel
              key={`${entry.date}-${entry.title}`}
              style={[ui.panel, styles.entryPanel]}
              intensity={46}
            >
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{entry.date}</Text>
                <Text style={styles.entryTitle}>{entry.title}</Text>
              </View>
              {entry.items.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </BlurPanel>
          ))}

          <Text style={styles.sectionLabel}>Known issues</Text>
          <Text style={styles.sectionHint}>
            Nothing here is permanent — we're tracking these openly so you know
            what to expect.
          </Text>
          {KNOWN_ISSUES.map((issue) => (
            <BlurPanel
              key={issue.title}
              style={[ui.panel, styles.issuePanel]}
              intensity={44}
            >
              <View style={styles.issueHeader}>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <View style={styles.statusPill}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColor(issue.status, colors) },
                    ]}
                  >
                    {issue.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.issueNote}>{issue.note}</Text>
            </BlurPanel>
          ))}
        </View>
      </ScrollView>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <BottomBarLeave onPress={onBack} label="Back" />
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      width: "100%",
      alignSelf: "center",
    },
    bottomControls: {
      paddingTop: 18,
    },
    intro: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "600",
      marginBottom: 8,
    },
    introHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.3,
      marginTop: 6,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    entryPanel: {
      marginBottom: 10,
    },
    entryHeader: {
      marginBottom: 10,
    },
    entryDate: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      marginBottom: 2,
      textTransform: "uppercase",
    },
    entryTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 6,
    },
    bullet: {
      color: colors.gold,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 1,
    },
    bulletText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    issuePanel: {
      marginBottom: 10,
    },
    issueHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 6,
    },
    issueTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
    issueNote: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
