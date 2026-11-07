import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import PlayerStatisticsPanel from "../components/PlayerStatisticsPanel";
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
  getGoogleAccountSyncStatus,
  linkGoogleAccountAndSync,
} from "../services/googleAccountSync";
import {
  ACHIEVEMENTS,
  achievementPrestige,
  achievementPrestigeProgress,
  formatAchievementCareerTotal,
  formatAchievementPrestige,
  getPlayerStats,
  type PlayerStats,
} from "../services/playerStats";
import {
  RARITY_COLOR,
  orderAchievementsByExclusivity,
  rarityForAchievementId,
} from "../services/achievementRarity";
import AchievementPrestigeFrame from "../components/AchievementPrestigeFrame";
import { TitlesScrollContent } from "./Titles";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import { strings } from "../strings";
import { useGameTerminology } from "../hooks/useGameTerminology";

export type ProfileTab = "achievements" | "titles";

export default function Achievements({
  onBack,
  onProfileSynced,
  initialTab = "achievements",
}: {
  onBack: () => void;
  onProfileSynced?: () => void;
  initialTab?: ProfileTab;
}) {
  const {
    colors,
    ui,
    setAppearancePreference,
    setTextContrastPreference,
    setFeltTint,
  } = useAppTheme();
  const wording = useGameTerminology();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);
  const pageWidth = width;
  const initialTabIndex = initialTab === "titles" ? 1 : 0;
  const profileTabs: { id: ProfileTab; label: string }[] = [
    { id: "achievements", label: strings.achievements.tabAchievements },
    { id: "titles", label: strings.achievements.tabTitles },
  ];

  const pagerRef = useRef<ScrollView>(null);
  const [tabIndex, setTabIndex] = useState(initialTabIndex);

  const [savedName, setSavedName] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);

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
      setTabIndex((currentIndex) =>
        currentIndex === index ? currentIndex : index,
      );
    },
    [pageWidth],
  );

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const result = await linkGoogleAccountAndSync({
        preferredDisplayName: savedName || null,
      });
      if (result.appearance) {
        await setAppearancePreference(result.appearance);
      }
      if (result.textContrast) {
        await setTextContrastPreference(result.textContrast);
      }
      if (result.feltTint) {
        setFeltTint(result.feltTint);
      }
      const [info, playerStats] = await Promise.all([
        getOrCreatePlayerId(),
        getPlayerStats(),
      ]);
      setSavedName(info.displayName);
      setGoogleLinked(!!info.linkedAccountId?.startsWith("google:"));
      setStats(playerStats);
      onProfileSynced?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google sign-in failed";
      if (!/cancelled/i.test(message)) {
        console.error("[Achievements] Google sign-in failed:", error);
        Alert.alert("Google sign-in", message);
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const canSignInWithGoogle =
    Platform.OS === "web" && getGoogleAccountSyncStatus() === "ready";
  const achievementsByExclusivity = useMemo(
    () => orderAchievementsByExclusivity(ACHIEVEMENTS),
    [],
  );

  if (isLoading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.loadingRoot}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{strings.achievements.loadingProfile}</Text>
        </View>
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <BottomBarLeave onPress={onBack} label="Back" />
          </BottomBarControls>
        </BottomBar>
      </ScreenContainer>
    );
  }

  const activeTab = profileTabs[tabIndex]?.id ?? "achievements";
  const screenTitle =
    activeTab === "titles"
      ? strings.achievements.tabTitles
      : strings.achievements.tabAchievements;

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
            tabs={profileTabs}
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
          onScroll={(event) =>
            syncTabFromPagerOffset(event.nativeEvent.contentOffset.x)
          }
          scrollEventThrottle={16}
          onMomentumScrollEnd={handlePagerScrollEnd}
          onScrollEndDrag={(event) =>
            syncTabFromPagerOffset(event.nativeEvent.contentOffset.x)
          }
          keyboardShouldPersistTaps="handled"
        >
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
                : "Link with Google to save stats online."}
            </Text>
            {!googleLinked && canSignInWithGoogle ? (
              <TouchableOpacity
                style={ui.btnSecondary}
                onPress={() => void handleGoogleSignIn()}
                disabled={googleBusy}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={ui.btnSecondaryText}>
                  {googleBusy ? "Connecting…" : "Sign in with Google"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </BlurPanel>

          <PlayerStatisticsPanel
            stats={stats}
            style={ui.panel}
            intensity={48}
            overflowVisible
          />

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
                  <AchievementPrestigeFrame
                    key={achievement.id}
                    progress={progress?.fraction ?? 0}
                    rarityColor={accent}
                    borderRadius={14}
                    style={[
                      styles.achievementRow,
                      earned && styles.achievementRowEarned,
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
                        {wording(achievement.title)}
                      </Text>
                      <Text style={styles.achievementDesc}>
                        {wording(achievement.description)}
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
                          {wording(formatAchievementCareerTotal(stats, achievement))}
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
