/**
 * Player Hub home — presentation layer over canonical PlayerStats.
 *
 * Panel order (player interest):
 * Identity → Play → Daily → Next Achievement → Recent Unlock →
 * Journey → Friends → Stats → What's New → Support → footer nav
 *
 * Deferred (need telemetry or session handoff — not built here):
 * - Last Match panel after round complete
 * - Run Master / Longest Run / Tens featured stats
 * - Friends live, titles, desktop rail, IPP public profiles
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StyleProp,
  ViewStyle,
  Platform,
  Animated,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AddToHomeScreenBanner from "../components/AddToHomeScreenBanner";
import BlurPanel from "../components/BlurPanel";
import ProgressMeter from "../components/ProgressMeter";
import AppButton from "../components/ui/AppButton";
import AvatarRewardBorder from "../components/AvatarRewardBorder";
import KeepLightsOnModal from "../components/KeepLightsOnModal";
import OnlinePlayersModal from "../components/OnlinePlayersModal";
import MenuIcon from "../components/MenuIcon";
import HubProgressRing from "../components/HubProgressRing";
import NextAchievementCard from "../components/NextAchievementCard";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { useClientBuildLabel } from "../hooks/useClientBuildLabel";
import { gameTitleFaceStyle } from "../utils/gameTitleFont";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { useAppTheme } from "../context/ThemeContext";
import { playerInitials } from "../utils/playerDisplay";
import { hexToRgba } from "../utils/colorTheory";
import {
  getPlayerStats,
  winRate,
  formatAchievementPrestige,
  type PlayerStats,
  type AchievementDef,
} from "../services/playerStats";
import { levelProgressFromXp } from "../services/playerLevel";
import { selectHubGoals, type HubGoal } from "../services/hubGoals";
import {
  selectNextAchievement,
  type NextAchievement,
} from "../services/nextAchievement";
import {
  formatUnlockAge,
  getMostRecentUnlock,
  syncUnlockSnapshot,
} from "../services/unlockEvents";
import {
  claimDailyChallengeIfReady,
  dailyChallengeProgress,
  loadDailyChallengeState,
  type DailyChallengeDef,
  type DailyChallengeState,
} from "../services/dailyChallenge";
import {
  resolveAvatarBorder,
  type AvatarBorderDesign,
} from "../rewards/avatarBorders";
import {
  RARITY_COLOR,
  RARITY_LABEL,
  rarityForAchievementId,
} from "../services/achievementRarity";
import {
  selectFeaturedStat,
  type FeaturedStat,
} from "../services/featuredStat";
import { triggerHaptic } from "../utils/haptics";
import type { OnlinePlayer } from "../services/onlinePresence";

const AVATAR_SIZE = 88;
const RING_SIZE = 112;
const FRIENDS_WIDE_MIN = 900;

export type PlayerHubActions = {
  onQuickGame: () => void;
  onHostLobby: () => void;
  onJoinLobby: () => void;
  onOpenAchievements: () => void;
  onOpenWhatsNew: () => void;
  onOpenSettings: () => void;
  onOpenReadMe: () => void;
};

type Props = {
  displayName: string;
  whatsNewUnread?: number;
  onlinePlayerCount?: number;
  onlinePlayers?: OnlinePlayer[];
  actions: PlayerHubActions;
  onNavigateSound?: () => void;
  style?: StyleProp<ViewStyle>;
  /** When true, reloads hub data (e.g. after returning to menu). */
  refreshKey?: number;
  /** Future title string — layout reserved; leave undefined for now. */
  playerTitle?: string | null;
};

export default function PlayerHub({
  displayName,
  whatsNewUnread = 0,
  onlinePlayerCount = 0,
  onlinePlayers = [],
  actions,
  onNavigateSound,
  style,
  refreshKey = 0,
  playerTitle = null,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width, height } = useVisualViewportSize();
  const contentMaxWidth = Math.min(520, Math.max(300, width - 40));
  const showFriendsPlaceholder = width >= FRIENDS_WIDE_MIN;
  const versionLabel = useClientBuildLabel();

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [goals, setGoals] = useState<HubGoal[]>([]);
  const [nextAch, setNextAch] = useState<NextAchievement | null>(null);
  const [border, setBorder] = useState<AvatarBorderDesign | null>(null);
  const [recent, setRecent] = useState<{
    def: AchievementDef;
    age: string;
    prestige: number;
  } | null>(null);
  const [dailyDef, setDailyDef] = useState<DailyChallengeDef | null>(null);
  const [dailyState, setDailyState] = useState<DailyChallengeState | null>(null);
  const [featured, setFeatured] = useState<FeaturedStat | null>(null);
  const [lightsOnOpen, setLightsOnOpen] = useState(false);
  const [onlinePlayersOpen, setOnlinePlayersOpen] = useState(false);
  const ringPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1.035,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ringPulse]);

  const reload = useCallback(async () => {
    const s = await getPlayerStats();
    await syncUnlockSnapshot(s);
    setStats(s);
    setFeatured(selectFeaturedStat(s));
    const next = selectNextAchievement(s);
    setNextAch(next);
    setGoals(selectHubGoals(s, 3, next?.def.id));
    setBorder(resolveAvatarBorder(s));
    const recentUnlock = await getMostRecentUnlock();
    if (recentUnlock) {
      setRecent({
        def: recentUnlock.def,
        age: formatUnlockAge(recentUnlock.unlockedAt),
        prestige: recentUnlock.prestige,
      });
    } else {
      setRecent(null);
    }
    const daily = await loadDailyChallengeState(s);
    const claimed = await claimDailyChallengeIfReady(daily.def, daily.state, s);
    setDailyDef(daily.def);
    setDailyState(claimed.state);
    if (claimed.grantedXp > 0) {
      const refreshed = await getPlayerStats();
      setStats(refreshed);
      setFeatured(selectFeaturedStat(refreshed));
      const nextRefreshed = selectNextAchievement(refreshed);
      setNextAch(nextRefreshed);
      setGoals(selectHubGoals(refreshed, 3, nextRefreshed?.def.id));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const run = (fn: () => void) => {
    onNavigateSound?.();
    triggerHaptic("light");
    fn();
  };

  const level = levelProgressFromXp(stats?.xp ?? 0);
  const dailyProgress =
    dailyDef && dailyState && stats
      ? dailyChallengeProgress(dailyDef, dailyState, stats)
      : null;
  const dailyDone = !!dailyProgress?.done;
  const recentRarity = recent
    ? rarityForAchievementId(recent.def.id)
    : null;
  const recentAccent = recentRarity
    ? RARITY_COLOR[recentRarity]
    : colors.accent;

  return (
    <ScreenContainer ignoreHeaderOffset style={[{ flex: 1 }, style]}>
      <View style={styles.vignette} pointerEvents="none" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Centered hub — top pad clears status bar; bottom is breathing room only.
            minHeight: height,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <Text style={[styles.brandTitle, gameTitleFaceStyle()]}>
            P&apos;s & A&apos;s
          </Text>
          <Text style={styles.brandSubtitle}>Presidents & Assholes</Text>

          <AddToHomeScreenBanner />

          {/* Identity — sole owner of XP progress */}
          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => run(actions.onOpenSettings)}
            accessibilityRole="button"
            accessibilityLabel="Open player profile settings"
          >
            <BlurPanel intensity={54} style={[styles.card, styles.identityCard]}>
              <View style={styles.identityRow}>
                <Animated.View
                  style={[
                    styles.avatarStack,
                    { transform: [{ scale: ringPulse }] },
                  ]}
                >
                  <HubProgressRing
                    size={RING_SIZE}
                    progress={level.fraction}
                    strokeWidth={5}
                    trackColor={hexToRgba(colors.accent, 0.2)}
                    fillColor={colors.accent}
                  >
                    <View style={styles.avatarCore}>
                      {border ? (
                        <AvatarRewardBorder
                          design={border}
                          avatarSize={AVATAR_SIZE}
                        />
                      ) : null}
                      <View
                        style={[
                          styles.avatarInner,
                          !border && styles.avatarBare,
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {playerInitials(displayName)}
                        </Text>
                      </View>
                    </View>
                  </HubProgressRing>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{level.level}</Text>
                  </View>
                </Animated.View>

                <View style={styles.identityBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayName} numberOfLines={1}>
                      {displayName || "Player"}
                    </Text>
                    <View style={styles.pencilBtn}>
                      <MenuIcon name="pencil" size={20} color={colors.accent} />
                    </View>
                  </View>
                  {/* Reserved title slot — titles catalog not shipped yet */}
                  <Text
                    style={[
                      styles.titleSlot,
                      !playerTitle && styles.titleSlotEmpty,
                    ]}
                    numberOfLines={1}
                  >
                    {playerTitle ?? " "}
                  </Text>
                  <Text style={styles.identityMeta}>Level {level.level}</Text>
                  <Text style={styles.careerXp}>
                    {(stats?.xp ?? 0).toLocaleString()} XP
                  </Text>
                  <ProgressMeter
                    progress={level.fraction}
                    label="To next level"
                    valueLabel={`${level.xpIntoLevel} / ${level.xpForLevel}`}
                    style={{ marginTop: 8 }}
                    animated
                    prestige
                  />
                </View>
              </View>
            </BlurPanel>
          </TouchableOpacity>

          {/* Play — primary visit intent sits on felt (no competing glass shell) */}
          <View style={styles.playHero}>
            <AppButton
              label="Quick Game"
              icon="bolt"
              variant="primary"
              onPress={() => run(actions.onQuickGame)}
              accessibilityLabel="Quick Game"
              style={styles.primaryCta}
            />
            <View style={styles.secondaryRow}>
              <AppButton
                label="Offline"
                icon="multiplayer"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => run(actions.onHostLobby)}
              />
              <AppButton
                label="Online"
                icon="multiplayer"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => run(actions.onJoinLobby)}
              />
            </View>
            {onlinePlayerCount > 0 ? (
              <TouchableOpacity
                style={styles.onlineHintBtn}
                onPress={() => {
                  triggerHaptic("light");
                  setOnlinePlayersOpen(true);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${onlinePlayerCount} player${
                  onlinePlayerCount === 1 ? "" : "s"
                } online`}
                hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
              >
                <Text style={styles.onlineHint}>
                  {onlinePlayerCount} player{onlinePlayerCount === 1 ? "" : "s"}{" "}
                  online
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Daily Challenge — time-sensitive */}
          {dailyDef && dailyProgress ? (
            <BlurPanel
              intensity={44}
              style={[
                styles.card,
                styles.utilityCard,
                dailyDone && styles.dailyDoneCard,
              ]}
            >
              <View style={styles.dailyHeader}>
                <MenuIcon name="calendar" size={16} color={colors.accent} />
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  Daily Challenge
                </Text>
                <Text style={styles.rewardInline}>
                  +{dailyDef.rewardXp} XP
                </Text>
              </View>
              <Text style={styles.goalTitle}>{dailyDef.title}</Text>
              <Text style={styles.goalSub}>{dailyDef.description}</Text>
              <ProgressMeter
                progress={dailyProgress.fraction}
                valueLabel={`${dailyProgress.current} / ${dailyProgress.target}`}
                style={{ marginTop: 10 }}
                animated
                fillColor={dailyDone ? colors.accent : undefined}
              />
              {dailyDone ? (
                <Text style={styles.rewardLine}>
                  {dailyState?.rewardClaimed
                    ? "Complete — reward claimed"
                    : "Complete — reward ready"}
                </Text>
              ) : null}
            </BlurPanel>
          ) : null}

          {/* Next Achievement — short-term chase */}
          {nextAch ? (
            <NextAchievementCard
              next={nextAch}
              onPress={() => run(actions.onOpenAchievements)}
            />
          ) : null}

          {/* Recent Unlock — celebration when fresh */}
          {recent && recentRarity ? (
            <BlurPanel
              intensity={44}
              style={[
                styles.card,
                styles.utilityCard,
                { borderColor: hexToRgba(recentAccent, 0.32) },
              ]}
            >
              <Text style={styles.sectionTitle}>
                {recent.prestige > 1 ? "Recent Prestige" : "Recent Unlock"}
                {" · "}
                <Text style={{ color: recentAccent }}>
                  {RARITY_LABEL[recentRarity]}
                </Text>
              </Text>
              <View style={styles.unlockRow}>
                <Text style={styles.unlockEmoji}>{recent.def.emoji}</Text>
                <View style={styles.unlockBody}>
                  <Text style={[styles.unlockTitle, { color: recentAccent }]}>
                    {recent.def.title}
                    {recent.prestige > 1
                      ? ` · ${formatAchievementPrestige(recent.prestige)}`
                      : ""}
                  </Text>
                  <Text style={styles.goalSub} numberOfLines={2}>
                    {recent.def.description}
                  </Text>
                  <Text style={styles.unlockAge}>
                    {recent.prestige > 1 ? "Prestiged" : "Unlocked"} {recent.age}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => run(actions.onOpenAchievements)}
                style={styles.linkBtn}
              >
                <Text style={styles.linkBtnText}>View Achievements</Text>
              </TouchableOpacity>
            </BlurPanel>
          ) : null}

          {/* Continue Your Journey — longer-arc goals */}
          {goals.length > 0 ? (
            <BlurPanel intensity={44} style={[styles.card, styles.utilityCard]}>
              <Text style={styles.sectionTitle}>Continue Your Journey</Text>
              <View style={styles.goalStack}>
                {goals.map((g, idx) => (
                  <View key={g.id}>
                    {idx > 0 ? <View style={styles.goalDivider} /> : null}
                    <View style={styles.goalRow}>
                      <View style={styles.goalTextCol}>
                        <Text style={styles.goalTitle}>{g.title}</Text>
                        <Text style={styles.goalSub}>{g.subtitle}</Text>
                      </View>
                      <ProgressMeter progress={g.fraction} height={7} />
                    </View>
                  </View>
                ))}
              </View>
            </BlurPanel>
          ) : null}

          {/* Friends placeholder — wide layouts only (slot for Join / Spectate later) */}
          {showFriendsPlaceholder ? (
            <BlurPanel
              intensity={40}
              style={[styles.card, styles.utilityCard, styles.friendsCard]}
            >
              <Text style={styles.sectionTitle}>Friends</Text>
              <Text style={styles.friendsTease}>Coming soon</Text>
              <Text style={styles.goalSub}>
                See who&apos;s in lobbies, join or spectate, and open profiles —
                without leaving Home.
              </Text>
            </BlurPanel>
          ) : null}

          {/* Stats Snapshot */}
          <BlurPanel intensity={44} style={[styles.card, styles.utilityCard]}>
            <Text style={styles.sectionTitle}>Stats Snapshot</Text>
            {featured ? (
              <View style={styles.featuredStat}>
                <Text style={styles.featuredValue}>{featured.value}</Text>
                <Text style={styles.featuredLabel}>{featured.label}</Text>
                <Text style={styles.goalSub}>{featured.hint}</Text>
              </View>
            ) : null}
            <View style={styles.statsGrid}>
              <StatCell
                label="Rounds"
                value={String(stats?.roundsPlayed ?? 0)}
                styles={styles}
              />
              <StatCell
                label="Win Rate"
                value={`${stats ? winRate(stats) : 0}%`}
                styles={styles}
              />
              <StatCell
                label="Presidents"
                value={String(stats?.timesPresident ?? 0)}
                styles={styles}
              />
              <StatCell
                label="Tricks Won"
                value={String(stats?.tricksWon ?? 0)}
                styles={styles}
              />
            </View>
            <TouchableOpacity
              onPress={() => run(actions.onOpenAchievements)}
              style={styles.linkBtn}
            >
              <Text style={styles.linkBtnText}>View Full Stats</Text>
            </TouchableOpacity>
          </BlurPanel>

          {/* What's New */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => run(actions.onOpenWhatsNew)}
          >
            <BlurPanel intensity={44} style={[styles.card, styles.utilityCard]}>
              <View style={styles.whatsNewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>What&apos;s New</Text>
                  <Text style={styles.goalTitle}>
                    {whatsNewUnread > 0
                      ? `${whatsNewUnread} new update${whatsNewUnread === 1 ? "" : "s"}`
                      : "Catch up on recent changes"}
                  </Text>
                </View>
                {whatsNewUnread > 0 ? (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>{whatsNewUnread}</Text>
                  </View>
                ) : (
                  <MenuIcon name="list" size={18} color={colors.accent} />
                )}
              </View>
            </BlurPanel>
          </TouchableOpacity>

          {/* Support — secondary destination; Quick Game remains the only primary CTA */}
          <BlurPanel
            intensity={44}
            style={[styles.card, styles.utilityCard, styles.supportCard]}
          >
            <View style={styles.supportHeader}>
              <Text style={styles.supportHeart} accessibilityLabel="Heart">
                ♥
              </Text>
              <Text style={styles.supportTitle}>Keep the Lights On</Text>
            </View>
            <Text style={styles.supportBody}>
              Glad you&apos;re at the table. A little support keeps servers running
              and helps fund the next round of updates — always optional, never pay-to-win.
            </Text>
            <AppButton
              label="Support Development"
              variant="secondary"
              onPress={() => {
                triggerHaptic("light");
                setLightsOnOpen(true);
              }}
              accessibilityLabel="Support Development — Keep the Lights On"
              style={styles.supportCta}
            />
          </BlurPanel>

          <View style={styles.footerNav}>
            <AppButton
              label="Settings"
              icon="gear"
              variant="secondary"
              onPress={() => run(actions.onOpenSettings)}
              accessibilityLabel="Settings"
              style={styles.footerNavButton}
            />
            <AppButton
              label="Achievements"
              icon="trophy"
              variant="secondary"
              onPress={() => run(actions.onOpenAchievements)}
              accessibilityLabel="Achievements"
              style={styles.footerNavButton}
            />
            <AppButton
              label="Read Me"
              icon="list"
              variant="secondary"
              onPress={() => run(actions.onOpenReadMe)}
              accessibilityLabel="Read Me"
              style={styles.footerNavButton}
            />
          </View>

          <Text style={styles.versionLabel}>{versionLabel}</Text>
        </View>
      </ScrollView>

      <KeepLightsOnModal
        visible={lightsOnOpen}
        onClose={() => setLightsOnOpen(false)}
      />
      <OnlinePlayersModal
        visible={onlinePlayersOpen}
        playerCount={onlinePlayerCount}
        players={onlinePlayers}
        onClose={() => setOnlinePlayersOpen(false)}
      />
    </ScreenContainer>
  );
}

function StatCell({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  const env = colors.environment;
  return StyleSheet.create({
    vignette: {
      ...StyleSheet.absoluteFillObject,
      // Soft environmental wash — light tables stay bright without opaque panels.
      backgroundColor: hexToRgba(
        "#000000",
        (colors.mode === "dark" ? 0.16 : 0.03) * env.vignetteStrength,
      ),
      zIndex: 0,
    },
    scroll: { flex: 1, zIndex: 1 },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      paddingHorizontal: 20,
    },
    content: { width: "100%", gap: 16 },
    brandTitle: {
      fontSize: 40,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 2,
      ...onFeltTextStyle(colors.onFelt, "primary"),
    },
    brandSubtitle: {
      fontSize: 13,
      textAlign: "center",
      letterSpacing: 1.2,
      marginBottom: 10,
      fontWeight: "600",
      ...onFeltTextStyle(colors.onFelt, "accent"),
    },
    playHero: {
      gap: 10,
      marginTop: 4,
      marginBottom: 4,
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(
        colors.accent,
        colors.mode === "dark" ? 0.22 : 0.18,
      ),
      padding: 14,
      overflow: "hidden",
    },
    /** Quieter supporting panels — present without matching Play CTA weight. */
    utilityCard: {
      borderColor: hexToRgba(
        colors.textPrimary,
        colors.mode === "dark" ? 0.12 : 0.1,
      ),
    },
    identityCard: {
      borderColor: hexToRgba(colors.accent, 0.34),
      ...(Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: env.shadowOpacity * 0.7,
          shadowRadius: env.shadowSoftness,
          shadowOffset: { width: 0, height: 3 },
        },
        android: { elevation: 3 },
        default: {},
      }) as ViewStyle),
    },
    featuredStat: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: hexToRgba(colors.accent, 0.1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.28),
    },
    featuredValue: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    featuredLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
      marginBottom: 2,
    },
    dailyDoneCard: {
      borderColor: hexToRgba(colors.accent, 0.42),
    },
    friendsCard: {
      opacity: 0.92,
      borderStyle: "dashed" as const,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginBottom: 8,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarStack: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarCore: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInner: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: hexToRgba(colors.accent, 0.2),
    },
    avatarBare: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.45),
    },
    avatarText: {
      color: colors.accent,
      fontSize: 24,
      fontWeight: "800",
    },
    levelBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      minWidth: 30,
      height: 24,
      paddingHorizontal: 7,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: hexToRgba(colors.textOnAccent, 0.35),
    },
    levelBadgeText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: "900",
    },
    identityBody: { flex: 1, minWidth: 0 },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    displayName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    pencilBtn: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: hexToRgba(colors.accent, 0.14),
    },
    titleSlot: {
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: "600",
      fontStyle: "italic",
      marginTop: 2,
      minHeight: 18,
    },
    titleSlotEmpty: {
      opacity: 0,
    },
    identityMeta: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 2,
    },
    careerXp: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
      fontVariant: ["tabular-nums"],
    },
    goalStack: { gap: 0 },
    goalDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: hexToRgba(colors.textPrimary, 0.14),
      marginVertical: 12,
    },
    goalRow: { gap: 8 },
    goalTextCol: { gap: 2 },
    goalTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.15,
    },
    goalSub: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 17,
    },
    dailyHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    rewardInline: {
      marginLeft: "auto",
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
    },
    rewardLine: {
      marginTop: 8,
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
    },
    friendsTease: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.15,
      marginBottom: 4,
    },
    primaryCta: { marginBottom: 10 },
    secondaryRow: { flexDirection: "row", gap: 8 },
    onlineHintBtn: {
      marginTop: 10,
      alignSelf: "center",
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    onlineHint: {
      textAlign: "center",
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    unlockRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    unlockEmoji: { fontSize: 40, lineHeight: 48 },
    unlockBody: { flex: 1, minWidth: 0, gap: 3 },
    unlockTitle: {
      color: colors.accent,
      fontSize: 20,
      fontWeight: "800",
    },
    unlockAge: {
      marginTop: 4,
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: "700",
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 4,
    },
    statCell: {
      width: "47%",
      flexGrow: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: hexToRgba(colors.textPrimary, 0.06),
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    linkBtn: { marginTop: 10, alignSelf: "flex-start" },
    linkBtnText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    whatsNewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    unreadPill: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadPillText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: "800",
    },
    supportCard: {
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    supportHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    supportHeart: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 22,
    },
    supportTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.2,
      flex: 1,
    },
    supportBody: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },
    supportCta: {
      marginTop: 10,
      width: "100%",
    },
    footerNav: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "stretch",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 4,
    },
    footerNavButton: {
      minWidth: 140,
      flexGrow: 1,
      flexBasis: 0,
    },
    versionLabel: {
      fontSize: 11,
      textAlign: "center",
      letterSpacing: 0.4,
      marginTop: 4,
      fontWeight: "500",
      ...onFeltTextStyle(colors.onFelt, "accent"),
    },
  });
}
