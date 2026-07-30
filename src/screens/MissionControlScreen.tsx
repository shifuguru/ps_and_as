import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import ThemedScrollView from "../components/ThemedScrollView";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { useOnlinePlayerCount } from "../hooks/useOnlinePlayerCount";
import {
  installMissionControlNoIndex,
  loadStudioData,
} from "../studio/loadStudioData";
import { FreshnessPanel } from "../studio/FreshnessPanel";
import { buildFreshnessSnapshot, formatRelativeAge } from "../studio/freshness";
import { summarizeReleaseGateRun } from "../studio/releaseGateSummary";
import type {
  ActivityEvent,
  HealthStatus,
  MissionControlTab,
  StudioData,
  WorkItem,
} from "../studio/types";
import { MEMORY_DOCS } from "../studio/types";
import {
  parseReadmeHtml,
  removeReadmeMarkdownStyles,
  syncReadmeMarkdownStyles,
} from "../utils/readmeMarkdown";

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: "#22c55e",
  amber: "#eab308",
  red: "#ef4444",
  unknown: "#94a3b8",
};

const TABS: { id: MissionControlTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "work", label: "Active Work" },
  { id: "roadmap", label: "Roadmap" },
  { id: "metrics", label: "Metrics" },
  { id: "feed", label: "Feed" },
  { id: "memory", label: "Memory" },
];

const WORK_COLUMNS: { key: keyof StudioData["activeWork"]["columns"]; label: string }[] = [
  { key: "investigating", label: "Investigating" },
  { key: "fixing", label: "Fixing" },
  { key: "testing", label: "Testing" },
  { key: "blocked", label: "Blocked" },
  { key: "completed", label: "Completed" },
];

function healthColor(status: string): string {
  return HEALTH_COLORS[status as HealthStatus] ?? HEALTH_COLORS.unknown;
}

function StatCard({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  tone?: HealthStatus;
  subtitle?: string;
}) {
  const { colors, ui } = useAppTheme();
  return (
    <BlurPanel style={[ui.panel, styles.statCard]} intensity={44}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          { color: tone ? healthColor(tone) : colors.textPrimary },
        ]}
      >
        {value}
      </Text>
      {subtitle ? (
        <Text style={[styles.statSub, { color: colors.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </BlurPanel>
  );
}

function WorkCard({ item }: { item: WorkItem }) {
  const { colors, ui } = useAppTheme();
  const priorityColor =
    item.priority === "P0"
      ? HEALTH_COLORS.red
      : item.priority === "P1"
        ? HEALTH_COLORS.amber
        : colors.textSecondary;

  return (
    <BlurPanel style={[ui.panel, styles.workCard]} intensity={42}>
      <View style={styles.workCardHeader}>
        <Text style={[styles.priorityBadge, { color: priorityColor }]}>
          {item.priority}
        </Text>
        {item.owner ? (
          <Text style={[styles.workOwner, { color: colors.textSecondary }]}>
            {item.owner}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.workTitle, { color: colors.textPrimary }]}>
        {item.title}
      </Text>
      {item.blockedReason ? (
        <Text style={[styles.workBlocked, { color: HEALTH_COLORS.red }]}>
          Blocked: {item.blockedReason}
        </Text>
      ) : null}
      {item.notes ? (
        <Text style={[styles.workNotes, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.notes}
        </Text>
      ) : null}
      <Text style={[styles.workAge, { color: colors.textSecondary }]}>
        {formatRelativeAge(item.updatedAt)}
      </Text>
    </BlurPanel>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const { colors, ui } = useAppTheme();
  const title =
    (event.title as string) ||
    (event.message as string) ||
    (event.gapId as string) ||
    event.type;
  const detail =
    (event.outcome as string) ||
    (Array.isArray(event.failed) ? `Failed: ${(event.failed as string[]).join(", ")}` : "") ||
    "";

  return (
    <BlurPanel style={[ui.panel, styles.feedRow]} intensity={40}>
      <View style={styles.feedHeader}>
        <Text style={[styles.feedType, { color: colors.gold }]}>{event.type}</Text>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>
          {formatRelativeAge(event.at as string)}
        </Text>
      </View>
      <Text style={[styles.feedTitle, { color: colors.textPrimary }]}>{title}</Text>
      {detail ? (
        <Text style={[styles.feedDetail, { color: colors.textSecondary }]}>{detail}</Text>
      ) : null}
    </BlurPanel>
  );
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  const { colors } = useAppTheme();
  const html = useMemo(
    () => (Platform.OS === "web" ? parseReadmeHtml(markdown) : ""),
    [markdown],
  );

  const readmeTheme = useMemo(
    () => ({
      linkColor: colors.gold,
      linkBg: colors.btnGoldBg,
      linkBorder: colors.btnGoldBorder,
      textPrimary: colors.textPrimary,
      borderMuted: colors.panelBorder,
    }),
    [
      colors.gold,
      colors.btnGoldBg,
      colors.btnGoldBorder,
      colors.textPrimary,
      colors.panelBorder,
    ],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    syncReadmeMarkdownStyles(colors.mode, readmeTheme);
    return () => removeReadmeMarkdownStyles();
  }, [colors.mode, readmeTheme]);

  if (Platform.OS !== "web") {
    return (
      <Text style={{ color: colors.textPrimary, fontFamily: "monospace", fontSize: 12 }}>
        {markdown}
      </Text>
    );
  }

  return (
    <View style={styles.markdownWrap}>
      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
        style={styles.markdownWeb}
      />
    </View>
  );
}

export default function MissionControlScreen() {
  const { colors, ui } = useAppTheme();
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);

  const [tab, setTab] = useState<MissionControlTab>("dashboard");
  const [memoryDoc, setMemoryDoc] = useState("brief");
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const playersOnline = useOnlinePlayerCount(!loading);

  useEffect(() => installMissionControlNoIndex(), []);

  useEffect(() => {
    let cancelled = false;
    void loadStudioData()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Failed to load Mission Control data");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freshness = useMemo(
    () => (data ? buildFreshnessSnapshot(data.dashboard, data.releaseStatus) : null),
    [data],
  );
  const releaseTone: HealthStatus =
    data?.dashboard.release.status === "ready"
      ? "green"
      : data?.dashboard.release.status === "blocked"
        ? "red"
        : "amber";

  const gateSummary = useMemo(() => {
    if (!data) {
      return { label: "—", tone: "unknown" as HealthStatus };
    }
    return summarizeReleaseGateRun(data.releaseStatus.gate.lastRun);
  }, [data]);

  const productHealthEntries = useMemo(() => {
    const ph = data?.dashboard.productHealth;
    if (!ph) return [];
    return [
      { key: "Gameplay stability", metric: ph.gameplayStability },
      { key: "Multiplayer readiness", metric: ph.multiplayerReadiness },
      { key: "Retention readiness", metric: ph.retentionReadiness },
      { key: "Monetization readiness", metric: ph.monetizationReadiness },
    ].filter((e) => e.metric);
  }, [data]);

  if (loading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Mission Control…
        </Text>
      </ScreenContainer>
    );
  }

  if (error || !data) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.centered}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Mission Control unavailable
        </Text>
        <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
          {error ?? "No data"}
        </Text>
        <Text style={[styles.errorHint, { color: colors.textSecondary }]}>
          Ensure studio/ is copied to web-build/studio/ (run build:web) or public/studio/ for dev.
        </Text>
      </ScreenContainer>
    );
  }

  const { dashboard, activeWork, roadmap, releaseStatus, metrics, activity, memory } = data;
  const versionLabel = `${dashboard.project.version}${
    dashboard.project.codename ? ` · ${dashboard.project.codename}` : ""
  }`;

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <ThemedScrollView
        style={styles.scroll}
        contentContainerStyle={[
          ui.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={[styles.content, { maxWidth: contentMax }]}>
          <ScreenTopBar title="Mission Control" />
          {freshness ? (
            <FreshnessPanel snapshot={freshness} versionLabel={versionLabel} />
          ) : null}

          {freshness?.isProjectStateStale ? (
            <BlurPanel style={[ui.panel, styles.staleBanner]} intensity={48}>
              <Text style={[styles.staleTitle, { color: HEALTH_COLORS.red }]}>
                MISSION CONTROL DATA STALE
              </Text>
              <Text style={[styles.staleText, { color: colors.textSecondary }]}>
                Project state last updated {freshness.projectState.relativeAge}. Review studio/
                files and refresh Mission Control before acting on priorities.
              </Text>
            </BlurPanel>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScroll}
            contentContainerStyle={styles.tabRow}
          >
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[
                  styles.tab,
                  {
                    borderColor: tab === t.id ? colors.gold : colors.panelBorder,
                    backgroundColor:
                      tab === t.id ? colors.btnGoldBg : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: tab === t.id ? colors.gold : colors.textSecondary },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {tab === "dashboard" ? (
            <>
              <View style={styles.statGrid}>
                <StatCard
                  label="Release"
                  value={dashboard.release.status.toUpperCase()}
                  tone={releaseTone}
                  subtitle={dashboard.release.headline}
                />
                <StatCard
                  label="P0 open"
                  value={String(dashboard.priorities.p0.open)}
                  tone={dashboard.priorities.p0.open > 0 ? "red" : "green"}
                />
                <StatCard
                  label="P1 open"
                  value={String(dashboard.priorities.p1.open)}
                  tone={dashboard.priorities.p1.open > 0 ? "amber" : "green"}
                />
                <StatCard
                  label="Gate"
                  value={gateSummary.label}
                  tone={gateSummary.tone}
                />
              </View>

              <BlurPanel style={[ui.panel, styles.sectionPanel]} intensity={46}>
                <Text style={ui.panelEyebrow}>Director brief</Text>
                <MarkdownBlock markdown={data.directorBrief} />
              </BlurPanel>

              <BlurPanel style={[ui.panel, styles.sectionPanel]} intensity={46}>
                <Text style={ui.panelEyebrow}>Current objective</Text>
                <Text style={[styles.objectiveTitle, { color: colors.textPrimary }]}>
                  {dashboard.objective.title}
                </Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  {dashboard.objective.summary}
                </Text>
                {dashboard.objective.successMetric ? (
                  <Text style={[styles.metricHint, { color: colors.gold }]}>
                    Success: {dashboard.objective.successMetric}
                  </Text>
                ) : null}
              </BlurPanel>

              <View style={styles.twoCol}>
                <BlurPanel style={[ui.panel, styles.halfPanel]} intensity={44}>
                  <Text style={ui.panelEyebrow}>What's next</Text>
                  {dashboard.nextActions.map((action, i) => (
                    <View key={action} style={styles.numberedRow}>
                      <Text style={[styles.number, { color: colors.gold }]}>{i + 1}.</Text>
                      <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
                        {action}
                      </Text>
                    </View>
                  ))}
                </BlurPanel>
                <BlurPanel style={[ui.panel, styles.halfPanel]} intensity={44}>
                  <Text style={ui.panelEyebrow}>Health</Text>
                  <View style={styles.healthRow}>
                    <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
                      Game
                    </Text>
                    <View
                      style={[
                        styles.healthDot,
                        { backgroundColor: healthColor(dashboard.health.game) },
                      ]}
                    />
                    <Text style={[styles.bodyText, { color: colors.textPrimary, flex: 1 }]}>
                      {dashboard.health.gameNote}
                    </Text>
                  </View>
                  <View style={styles.healthRow}>
                    <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>
                      Studio
                    </Text>
                    <View
                      style={[
                        styles.healthDot,
                        { backgroundColor: healthColor(dashboard.health.studio) },
                      ]}
                    />
                    <Text style={[styles.bodyText, { color: colors.textPrimary, flex: 1 }]}>
                      {dashboard.health.studioNote}
                    </Text>
                  </View>
                </BlurPanel>
              </View>

              {productHealthEntries.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Product health
                  </Text>
                  <View style={styles.statGrid}>
                    {productHealthEntries.map(({ key, metric }) => (
                      <StatCard
                        key={key}
                        label={key}
                        value={
                          metric!.score != null ? String(metric!.score) : metric!.status
                        }
                        tone={metric!.status}
                        subtitle={metric!.note}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                P0 priorities
              </Text>
              {dashboard.priorities.p0.items.map((item) => (
                <BlurPanel key={item.id} style={[ui.panel, styles.priorityRow]} intensity={42}>
                  <Text style={[styles.priorityTitle, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.priorityMeta, { color: colors.textSecondary }]}>
                    {item.status}
                    {item.doc ? ` · ${item.doc}` : ""}
                  </Text>
                </BlurPanel>
              ))}
            </>
          ) : null}

          {tab === "work" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.kanbanRow}>
                {WORK_COLUMNS.map(({ key, label }) => (
                  <View key={key} style={styles.kanbanCol}>
                    <Text style={[styles.kanbanLabel, { color: colors.gold }]}>
                      {label} ({activeWork.columns[key].length})
                    </Text>
                    {activeWork.columns[key].map((item) => (
                      <WorkCard key={item.id} item={item} />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {tab === "roadmap" ? (
            <>
              {[roadmap.currentPhase, roadmap.nextPhase, ...roadmap.futurePhases].map(
                (phase) => (
                  <BlurPanel
                    key={phase.id}
                    style={[ui.panel, styles.sectionPanel]}
                    intensity={44}
                  >
                    <View style={styles.phaseHeader}>
                      <Text style={[styles.phaseName, { color: colors.textPrimary }]}>
                        {phase.name}
                      </Text>
                      <Text style={[styles.phaseStatus, { color: colors.gold }]}>
                        {phase.status}
                      </Text>
                    </View>
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                      {phase.goal}
                    </Text>
                    {phase.targetWindow ? (
                      <Text style={[styles.phaseWindow, { color: colors.textSecondary }]}>
                        Window: {phase.targetWindow}
                      </Text>
                    ) : null}
                    <Text style={[styles.exitLabel, { color: colors.textSecondary }]}>
                      Exit criteria
                    </Text>
                    {phase.exitCriteria.map((c) => (
                      <View key={c} style={styles.bulletRow}>
                        <Text style={[styles.bullet, { color: colors.gold }]}>•</Text>
                        <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
                          {c}
                        </Text>
                      </View>
                    ))}
                  </BlurPanel>
                ),
              )}
            </>
          ) : null}

          {tab === "metrics" ? (
            <>
              <BlurPanel style={[ui.panel, styles.sectionPanel]} intensity={44}>
                <Text style={ui.panelEyebrow}>Live</Text>
                <Text style={[styles.metricLive, { color: colors.textPrimary }]}>
                  Players online: {playersOnline ?? metrics.live.playersOnline?.value ?? "—"}
                </Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  Polled from server /api/online-players every 15s
                </Text>
              </BlurPanel>
              {Object.entries(metrics.live).map(([key, slot]) => (
                <BlurPanel key={key} style={[ui.panel, styles.metricRow]} intensity={42}>
                  <Text style={[styles.metricKey, { color: colors.textPrimary }]}>
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </Text>
                  <Text style={[styles.metricVal, { color: colors.gold }]}>
                    {key === "playersOnline" && playersOnline != null
                      ? playersOnline
                      : slot.value ?? "—"}
                  </Text>
                  <Text style={[styles.metricMeta, { color: colors.textSecondary }]}>
                    {slot.source}
                    {slot.note ? ` · ${slot.note}` : ""}
                  </Text>
                </BlurPanel>
              ))}
              <BlurPanel style={[ui.panel, styles.sectionPanel]} intensity={42}>
                <Text style={ui.panelEyebrow}>Release gate</Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  CI runs gate: {releaseStatus.deploy.ciRunsReleaseGate ? "yes" : "no"}
                </Text>
                <Text style={[styles.mono, { color: colors.textPrimary }]}>
                  {releaseStatus.gate.command}
                </Text>
              </BlurPanel>
            </>
          ) : null}

          {tab === "feed" ? (
            activity.length === 0 ? (
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                No agent activity recorded yet.
              </Text>
            ) : (
              [...activity]
                .reverse()
                .map((event, i) => (
                  <ActivityRow key={`${event.at}-${event.type}-${i}`} event={event} />
                ))
            )
          ) : null}

          {tab === "memory" ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.memoryTabs}
              >
                {MEMORY_DOCS.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    onPress={() => setMemoryDoc(doc.id)}
                    style={[
                      styles.memoryTab,
                      {
                        borderColor:
                          memoryDoc === doc.id ? colors.gold : colors.panelBorder,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: memoryDoc === doc.id ? colors.gold : colors.textSecondary,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {doc.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <BlurPanel style={[ui.panel, styles.sectionPanel]} intensity={44}>
                <MarkdownBlock markdown={memory[memoryDoc] ?? ""} />
              </BlurPanel>
            </>
          ) : null}
        </View>
      </ThemedScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { width: "100%", alignSelf: "center" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  errorBody: { fontSize: 14, textAlign: "center", marginBottom: 8 },
  errorHint: { fontSize: 12, textAlign: "center" },
  staleBanner: { marginBottom: 12 },
  staleTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  staleText: { fontSize: 12, lineHeight: 18 },
  tabScroll: { marginBottom: 16, maxHeight: 44 },
  tabRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  statCard: { minWidth: 140, flex: 1, maxWidth: "48%" },
  statLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statSub: { fontSize: 11, marginTop: 6 },
  sectionPanel: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  objectiveTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  metricHint: { fontSize: 13, marginTop: 8, fontWeight: "600" },
  twoCol: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  halfPanel: { flex: 1, minWidth: 260 },
  numberedRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  number: { fontWeight: "800", width: 20 },
  healthRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  healthLabel: { width: 48, fontSize: 13, fontWeight: "600" },
  healthDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  priorityRow: { marginBottom: 8 },
  priorityTitle: { fontSize: 14, fontWeight: "700" },
  priorityMeta: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  kanbanRow: { flexDirection: "row", gap: 12, paddingBottom: 8 },
  kanbanCol: { width: 260 },
  kanbanLabel: { fontSize: 12, fontWeight: "800", marginBottom: 8, textTransform: "uppercase" },
  workCard: { marginBottom: 10 },
  workCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priorityBadge: { fontSize: 12, fontWeight: "800" },
  workOwner: { fontSize: 11 },
  workTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  workBlocked: { fontSize: 12, marginBottom: 4 },
  workNotes: { fontSize: 12, marginBottom: 4 },
  workAge: { fontSize: 11 },
  phaseHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  phaseName: { fontSize: 16, fontWeight: "800", flex: 1 },
  phaseStatus: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  phaseWindow: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
  exitLabel: { fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 4 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  bullet: { fontSize: 14, lineHeight: 20 },
  metricLive: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  metricRow: { marginBottom: 8 },
  metricKey: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  metricVal: { fontSize: 24, fontWeight: "800", marginVertical: 4 },
  metricMeta: { fontSize: 12 },
  mono: { fontFamily: Platform.OS === "web" ? "monospace" : undefined, fontSize: 13 },
  feedRow: { marginBottom: 8 },
  feedHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  feedType: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  feedTime: { fontSize: 11 },
  feedTitle: { fontSize: 14, fontWeight: "700" },
  feedDetail: { fontSize: 13, marginTop: 4 },
  memoryTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  memoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  markdownWrap: { width: "100%" },
  markdownWeb: {
    backgroundColor: "transparent",
    boxSizing: "border-box",
    minWidth: 200,
    paddingHorizontal: 4,
    paddingVertical: 8,
  } as object,
});
