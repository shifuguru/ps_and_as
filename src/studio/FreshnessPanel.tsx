import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import BlurPanel from "../components/BlurPanel";
import { useAppTheme } from "../context/ThemeContext";
import type { FreshnessAssessment, FreshnessLevel, FreshnessSnapshot } from "./freshness";

const LEVEL_COLORS: Record<FreshnessLevel, string> = {
  fresh: "#22c55e",
  warning: "#eab308",
  stale: "#ef4444",
  unknown: "#94a3b8",
};

function FreshnessBadge({ assessment }: { assessment: FreshnessAssessment }) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: LEVEL_COLORS[assessment.level], backgroundColor: `${LEVEL_COLORS[assessment.level]}22` },
      ]}
    >
      <Text style={[styles.badgeText, { color: LEVEL_COLORS[assessment.level] }]}>
        {assessment.label}
      </Text>
    </View>
  );
}

function FreshnessRow({
  title,
  detail,
  assessment,
  showBadge = true,
}: {
  title: string;
  detail: string;
  assessment?: FreshnessAssessment;
  showBadge?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{detail}</Text>
      </View>
      {showBadge && assessment ? <FreshnessBadge assessment={assessment} /> : null}
    </View>
  );
}

export function FreshnessPanel({
  snapshot,
  versionLabel,
}: {
  snapshot: FreshnessSnapshot;
  versionLabel: string;
}) {
  const { colors, ui } = useAppTheme();

  return (
    <BlurPanel style={[ui.panel, styles.panel]} intensity={44}>
      <Text style={[styles.versionLine, { color: colors.textSecondary }]}>{versionLabel}</Text>
      <FreshnessRow
        title="Project State"
        detail={`Updated ${snapshot.projectState.relativeAge}`}
        assessment={snapshot.projectState}
      />
      <FreshnessRow
        title="Build"
        detail={`Deployed ${snapshot.deployment.relativeAge}`}
        showBadge={false}
      />
      <FreshnessRow
        title="Release Gate"
        detail={`Last run ${snapshot.releaseGate.relativeAge}`}
        assessment={snapshot.releaseGate}
      />
      <FreshnessRow
        title="Human QA"
        detail={`Last tested ${snapshot.humanQa.relativeAge}`}
        assessment={snapshot.humanQa}
      />
    </BlurPanel>
  );
}

const styles = StyleSheet.create({
  panel: { marginBottom: 12 },
  versionLine: {
    fontSize: 12,
    marginBottom: 10,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: "800" },
  rowDetail: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
