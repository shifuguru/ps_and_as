import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
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
import { playerInitials } from "../utils/playerDisplay";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { getOrCreatePlayerId } from "../services/gameCenter";
import {
  ACHIEVEMENTS,
  DEFAULT_PLAYER_STATS,
  achievementPrestige,
  achievementPrestigeProgress,
  formatAchievementCareerTotal,
  formatAchievementPrestige,
  getPlayerStats,
  totalAchievementPrestige,
  unlockedAchievements,
  winRate,
  type PlayerStats,
} from "../services/playerStats";
import {
  RARITY_COLOR,
  orderAchievementsByExclusivity,
  rarityForAchievementId,
} from "../services/achievementRarity";
import AchievementPrestigeFrame from "../components/AchievementPrestigeFrame";
import { hexToRgba } from "../utils/colorTheory";
import {
  RunsPill,
  PLATINUM_STREAK_COLORS,
  PLATINUM_FLAME_SEEDS,
} from "../gameplayPresentation/RunsEffect";
import { TitlesScrollContent } from "./Titles";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";

export type ProfileTab = "achievements" | "titles";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "achievements", label: "Achievements" },
  { id: "titles", label: "Titles" },
];

const ACHIEVEMENT_SCROLL_PADDING = 16;

function achievementScrollNativeId(achievementId: string): string {
  return `achievement-row-${achievementId}`;
}

export default function Achievements({
  onBack,
  onNavigateToSettings,
  initialTab = "achievements",
  scrollToAchievementId,
}: {
  onBack: () => void;
  onNavigateToSettings?: () => void;
  initialTab?: ProfileTab;
  scrollToAchievementId?: string | null;
}) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);
  const pageWidth = width;
  const initialTabIndex = initialTab === "titles" ? 1 : 0;

  const pagerRef = useRef<ScrollView>(null);
  const achievementsScrollRef = useRef<ScrollView>(null);
  const achievementsContentRef = useRef<View>(null);
  const achievementRowRefs = useRef<Record<string, View | null>>({});
  const [tabIndex, setTabIndex] = useState(initialTabIndex);

  const [savedName, setSavedName] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [info, playerStats] = await Promise.all([
        getOrCreatePlayerId(),
        getPlayerStats(),
      ]);
      setSavedName(info.displayName);
      setGoogleLinked(!!info.linkedAccountId?.startsWith("google:"));
      setStats(playerStats);
    } catch (error) {
      console.error("[Achievements] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const index = initialTab === "titles" ? 1 : 0;
    setTabIndex(index);
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: false });
  }, [initialTab, pageWidth]);

  const scrollToTab = useCallback(
    (index: number) => {
      setTabIndex(index);
      pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    },
    [pageWidth],
  );

  const handlePagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      setTabIndex(index);
    },
    [pageWidth],
  );

  const syncTabFromPagerOffset = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / pageWidth);
      setTabIndex(index);
    },
    [pageWidth],
  );

  const scrollToAchievement = useCallback((achievementId: string) => {
    const row = achievementRowRefs.current[achievementId];
    const content = achievementsContentRef.current;
    const scroll = achievementsScrollRef.current;
    if (!row || !content || !scroll) return false;

    const scrollWebFallback = () => {
      if (Platform.OS !== "web" || typeof document === "undefined") return;
      const el = document.getElementById(achievementScrollNativeId(achievementId));
      const scrollNode = (
        scroll as ScrollView & { getScrollableNode?: () => HTMLElement }
      ).getScrollableNode?.();
      if (!el || !scrollNode) return;
      const top =
        el.getBoundingClientRect().top -
        scrollNode.getBoundingClientRect().top +
        scrollNode.scrollTop;
      scrollNode.scrollTo({
        top: Math.max(0, top - ACHIEVEMENT_SCROLL_PADDING),
        behavior: "smooth",
      });
    };

    row.measureLayout(
      content,
      (_x, y) => {
        scroll.scrollTo({
          y: Math.max(0, y - ACHIEVEMENT_SCROLL_PADDING),
          animated: true,
        });
      },
      scrollWebFallback,
    );

    return true;
  }, []);

  useEffect(() => {
    if (!scrollToAchievementId || isLoading) return;

    scrollToTab(0);

    let cancelled = false;
    const id = scrollToAchievementId;
    const delays = [0, 50, 150, 320];

    delays.forEach((delay) => {
      setTimeout(() => {
        if (!cancelled) scrollToAchievement(id);
      }, delay);
    });

    return () => {
      cancelled = true;
    };
  }, [scrollToAchievementId, isLoading, scrollToAchievement, scrollToTab]);

  const unlocked = stats ? unlockedAchievements(stats) : [];
  const achievementsByExclusivity = useMemo(
    () => orderAchievementsByExclusivity(ACHIEVEMENTS),
    [],
  );
  const prestigeTotal = stats ? totalAchievementPrestige(stats) : 0;
  const bestPresidentStreak = stats?.bestPresidentStreak ?? 0;
  const currentPresidentStreak = stats?.presidentStreak ?? 0;
  const streakLive = currentPresidentStreak > 0;
  const showStreakPills = bestPresidentStreak > 0 || currentPresidentStreak > 0;

  if (isLoading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.loadingRoot}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading Profile…</Text>
        </View>
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <BottomBarLeave onPress={onBack} label="Back" />
          </BottomBarControls>
        </BottomBar>
      </ScreenContainer>
    );
  }

  const activeTab = PROFILE_TABS[tabIndex]?.id ?? "achievements";
  const screenTitle =
    activeTab === "titles" ? "Titles" : "Achievements";

  return (
    <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
      <View style={styles.pagerRoot}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              maxWidth: contentMax,
            },
          ]}
        >
          <ScreenTopBar title={screenTitle} />
          <ProfileTabBar
            tabs={PROFILE_TABS}
            activeIndex={tabIndex}
            onSelect={scrollToTab}
            colors={colors}
          />
        </View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          onMomentumScrollEnd={handlePagerScrollEnd}
          onScrollEndDrag={(event) =>
            syncTabFromPagerOffset(event.nativeEvent.contentOffset.x)
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: pageWidth, flex: 1 }}>
            <ScrollView
              ref={achievementsScrollRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.pageScrollContent,
                { paddingBottom: bottomBarHeight },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View
                ref={achievementsContentRef}
                style={[styles.content, { maxWidth: contentMax }]}
                collapsable={false}
              >
          <BlurPanel style={ui.panel} intensity={52}>
            <Text style={ui.panelEyebrow}>Player Profile</Text>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {playerInitials(savedName || "?")}
                </Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {savedName || "Player"}
                </Text>
                <Text style={styles.profileHint}>
                  {googleLinked ? "Google linked" : "Local profile"}
                </Text>
              </View>
            </View>
            <Text style={styles.accountText}>
              {googleLinked
                ? "Stats sync to your Google account across devices. Use Settings → Sync now if another phone is ahead."
                : "Stats are saved on this device. Link Google in Settings to keep XP across phones."}
            </Text>
            {onNavigateToSettings ? (
              <TouchableOpacity
                style={ui.btnSecondary}
                onPress={onNavigateToSettings}
                activeOpacity={0.85}
              >
                <Text style={ui.btnSecondaryText}>Open Settings</Text>
              </TouchableOpacity>
            ) : null}
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48} overflowVisible>
            <Text style={ui.panelEyebrow}>Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard label="XP" value={String(stats?.xp ?? 0)} />
              <StatCard label="Rounds" value={String(stats?.roundsPlayed ?? 0)} />
              <StatCard
                label="President"
                value={String(stats?.timesPresident ?? 0)}
              />
              <StatCard
                label="Win Rate"
                value={`${winRate(stats ?? DEFAULT_PLAYER_STATS)}%`}
              />
              <StatCard
                label="Achievements"
                value={`${unlocked.length}/${ACHIEVEMENTS.length}`}
              />
              <StatCard label="Prestige" value={String(prestigeTotal)} />
              <StatCard label="Tricks" value={String(stats?.tricksWon ?? 0)} />
            </View>

            <View style={styles.roleRow}>
              <RolePill
                label="President"
                count={stats?.timesPresident ?? 0}
                fill="#E8C547"
              />
              <RolePill
                label="Vice Pres."
                count={stats?.timesVicePresident ?? 0}
                fill="#C0C7D4"
              />
              <RolePill
                label="Vice Asshole"
                count={stats?.timesViceAsshole ?? 0}
                fill="#C47A4A"
              />
              <RolePill
                label="Asshole"
                count={stats?.timesAsshole ?? 0}
                fill="#A85A32"
              />
            </View>
            {showStreakPills ? (
              <View style={styles.streakRow}>
                <StreakEnergyPill
                  label="Current Streak"
                  count={currentPresidentStreak}
                  live={streakLive}
                  liveLabel
                />
                <StreakEnergyPill
                  label="Best Streak"
                  count={bestPresidentStreak}
                  live={false}
                />
              </View>
            ) : null}
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Achievements</Text>
            <View style={styles.achievementList}>
              {achievementsByExclusivity.map((achievement) => {
                const prestige = stats
                  ? achievementPrestige(stats, achievement)
                  : 0;
                const progress = stats
                  ? achievementPrestigeProgress(stats, achievement)
                  : null;
                const earned = prestige >= 1;
                const rarity = rarityForAchievementId(achievement.id);
                const accent = RARITY_COLOR[rarity];
                return (
                  <View
                    key={achievement.id}
                    ref={(node) => {
                      achievementRowRefs.current[achievement.id] = node;
                    }}
                    nativeID={achievementScrollNativeId(achievement.id)}
                    collapsable={false}
                  >
                    <AchievementPrestigeFrame
                      progress={progress?.fraction ?? 0}
                      rarityColor={accent}
                      borderRadius={14}
                      style={[
                        styles.achievementRow,
                        earned && styles.achievementRowEarned,
                        scrollToAchievementId === achievement.id &&
                          styles.achievementRowHighlighted,
                      ]}
                      contentStyle={styles.achievementRowInner}
                    >
                      <Text style={styles.achievementEmoji}>
                        {achievement.emoji}
                      </Text>
                      <View style={styles.achievementBody}>
                        <Text
                          style={[
                            styles.achievementTitle,
                            !earned && styles.achievementTitleLocked,
                          ]}
                        >
                          {achievement.title}
                        </Text>
                        <Text style={styles.achievementDesc}>
                          {achievement.description}
                        </Text>
                        {progress ? (
                          <Text
                            style={[
                              styles.achievementProgress,
                              { color: accent },
                            ]}
                          >
                            {earned
                              ? `Next Prestige ${formatAchievementPrestige(progress.nextPrestige)} · ${progress.current}/${progress.target}`
                              : `${progress.current}/${progress.target}`}
                          </Text>
                        ) : null}
                        {stats ? (
                          <Text style={styles.achievementTotal}>
                            {formatAchievementCareerTotal(stats, achievement)}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.achievementStatus,
                          { color: earned ? accent : colors.textTertiary },
                        ]}
                      >
                        {formatAchievementPrestige(prestige)}
                      </Text>
                    </AchievementPrestigeFrame>
                  </View>
                );
              })}
            </View>
          </BlurPanel>
              </View>
            </ScrollView>
          </View>

          <View style={{ width: pageWidth, flex: 1 }}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.pageScrollContent,
                { paddingBottom: bottomBarHeight },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.content, { maxWidth: contentMax }]}>
                {stats ? <TitlesScrollContent stats={stats} /> : null}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </View>

      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <View style={{ width: contentMax, alignSelf: "center" }}>
            <BottomBarLeave onPress={onBack} label="Back" />
          </View>
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function ProfileTabBar({
  tabs,
  activeIndex,
  onSelect,
  colors,
}: {
  tabs: { id: ProfileTab; label: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const styles = useMemo(() => createTabBarStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onSelect(index)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RolePill({
  label,
  count,
  fill,
}: {
  label: string;
  count: number;
  fill: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.rolePill,
        {
          backgroundColor: hexToRgba(fill, 0.34),
          borderColor: hexToRgba(fill, 0.7),
        },
      ]}
    >
      <Text
        style={[styles.rolePillLabel, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.rolePillValue, { color: fill }]}>{count}</Text>
    </View>
  );
}

/** Platinum President streak pill — metallic silver, never warm orange. */
function StreakEnergyPill({
  label,
  count,
  live,
  liveLabel = false,
}: {
  label: string;
  count: number;
  live: boolean;
  liveLabel?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Live = brighter platinum; broken = cooler muted silver. Never RUNS orange.
  const fill = live ? "#E8EEF8" : "#A8B4C8";

  return (
    <RunsPill
      active
      style={styles.streakRoot}
      showGlow={live}
      showFlames={live}
      containFlames={live}
      emberSpread="around"
      maxFlameHeight={16}
      palette={PLATINUM_STREAK_COLORS}
      flameSeeds={PLATINUM_FLAME_SEEDS}
      pillStyle={[
        styles.streakPill,
        {
          backgroundColor: hexToRgba(fill, live ? 0.38 : 0.26),
          borderColor: hexToRgba(fill, live ? 0.9 : 0.5),
        },
      ]}
    >
      <Text
        style={[styles.rolePillLabel, { color: colors.textPrimary }]}
        numberOfLines={1}
      >
        {label}
        {live && liveLabel ? "  ·  Live" : ""}
      </Text>
      <Text style={[styles.rolePillValue, { color: live ? "#F2F5FA" : fill }]}>
        {count}
      </Text>
    </RunsPill>
  );
}

function createTabBarStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    segment: {
      flex: 1,
      borderRadius: 12,
      minHeight: 42,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
      ...BUTTON_CENTER,
    },
    segmentSelected: {
      backgroundColor: colors.btnAccentBg,
      borderColor: colors.btnAccentBorder,
    },
    segmentText: buttonLabel(13, {
      color: colors.textSecondary,
      fontWeight: "700",
    }),
    segmentTextSelected: {
      color: colors.btnAccentText,
    },
  });
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    pagerRoot: {
      flex: 1,
    },
    header: {
      alignSelf: "center",
      width: "100%",
      paddingHorizontal: 24,
    },
    pager: {
      flex: 1,
    },
    pageScrollContent: {
      flexGrow: 1,
      alignItems: "center",
      paddingHorizontal: 24,
    },
    loadingRoot: { flex: 1 },
    loadingCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: 14,
      fontSize: 15,
    },
    scroll: { flex: 1 },
    content: {
      width: "100%",
    },
    bottomControls: {
      paddingTop: 18,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.btnAccentBg,
      borderWidth: 2,
      borderColor: colors.btnAccentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: {
      color: colors.textPrimary,
      fontWeight: "800",
      fontSize: 16,
    },
    profileMeta: {
      flex: 1,
      minWidth: 0,
    },
    profileName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    profileHint: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontWeight: "600",
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    statCard: {
      width: "48%",
      flexGrow: 1,
      minWidth: "46%",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: colors.btnSecondaryBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.panelBorder,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginBottom: 4,
      textAlign: "center",
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },
    roleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "stretch",
      gap: 8,
      width: "100%",
      marginBottom: 10,
    },
    rolePill: {
      flexGrow: 1,
      flexBasis: 0,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    rolePillLabel: {
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    rolePillValue: {
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },
    streakRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "stretch",
      gap: 8,
      width: "100%",
      marginTop: 2,
      marginBottom: 4,
      paddingVertical: 10,
      overflow: "visible",
    },
    streakRoot: {
      flexGrow: 1,
      flexBasis: 0,
      alignSelf: "stretch",
      minWidth: 0,
    },
    streakPill: {
      width: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    achievementList: {
      gap: 8,
    },
    achievementRow: {
      borderRadius: 14,
      opacity: 0.72,
    },
    achievementRowEarned: {
      opacity: 1,
    },
    achievementRowHighlighted: {
      opacity: 1,
      transform: [{ scale: 1.01 }],
    },
    achievementRowInner: {
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    achievementEmoji: {
      fontSize: 22,
      width: 32,
      textAlign: "center",
    },
    achievementBody: {
      flex: 1,
      minWidth: 0,
      marginHorizontal: 8,
    },
    achievementTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    achievementTitleLocked: {
      color: colors.textSecondary,
    },
    achievementDesc: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    achievementProgress: {
      fontSize: 10,
      fontWeight: "700",
      marginTop: 4,
    },
    achievementTotal: {
      color: colors.textTertiary,
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
      opacity: 0.72,
    },
    achievementStatus: {
      fontSize: 14,
      fontWeight: "800",
      minWidth: 28,
      textAlign: "right",
    },
    accountText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
    },
  });
}
