/**
 * Player Hub home — presentation layer over canonical PlayerStats.
 *
 * Panel order (player interest):
 * Brand → Pitch → Play → Identity → Rules → (A2HS) → Daily → Next Achievement →
 * Recent Unlock → Journey → Friends → Stats → What's New → Support
 *
 * Day-0 (roundsPlayed === 0): Brand → Pitch → Play (+ helper) → Rules →
 * Identity → (A2HS) → XP nudge → What's New → Support
 * Play: primary "Play" vs AI; inline online panel for friends play.
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
  Easing,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AddToHomeScreenBanner from "../components/AddToHomeScreenBanner";
import BlurPanel from "../components/BlurPanel";
import ProgressMeter from "../components/ProgressMeter";
import AppButton from "../components/ui/AppButton";
import KofiButton from "../components/ui/KofiButton";
import AvatarRewardBorder from "../components/AvatarRewardBorder";
import OnlinePlayersModal from "../components/OnlinePlayersModal";
import PracticeSetupModal from "../components/PracticeSetupModal";
import MenuIcon from "../components/MenuIcon";
import HubProgressRing from "../components/HubProgressRing";
import NextAchievementCard from "../components/NextAchievementCard";
import RewardClaimBurst from "../components/RewardClaimBurst";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
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
  markDailyChallengeCompleteIfReady,
  type DailyChallengeDef,
  type DailyChallengeState,
} from "../services/dailyChallenge";
import {
  claimDailyLoginIfReady,
  DAILY_LOGIN_XP,
  loadDailyLoginState,
  type DailyLoginState,
} from "../services/dailyLoginReward";
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
import {
  readDisplayTitleTrackId,
  displayedTitleForStats,
} from "../services/titlePreferences";
import { triggerHaptic } from "../utils/haptics";
import type { OnlinePlayer } from "../services/onlinePresence";
import HubOnlinePlayPanel from "../components/HubOnlinePlayPanel";
import { useHubRoomDiscovery } from "../hooks/useHubRoomDiscovery";
import {
  displayTextError,
  validateDisplayText,
} from "../utils/profanityFilter";
import {
  isBotPublicRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../utils/roomCode";

import {
  readPracticePlayerCount,
  writePracticePlayerCount,
  PRACTICE_DEFAULT_PLAYERS,
} from "../services/practicePreferences";

const SLIDE_MS = 300;
const AVATAR_SIZE = 88;
const RING_SIZE = 112;
const FRIENDS_WIDE_MIN = 900;

export type PlayerHubActions = {
  onPlay: (playerCount: number) => void;
  onHostOnlineGame: (playerName: string) => void;
  onJoinOnlineRoom: (roomId: string, playerName: string) => void;
  onSpectateOnlineRoom?: (roomId: string, playerName: string) => void;
  onOpenAchievements: () => void;
  onOpenTitles: () => void;
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
  /** Override displayed title — hub loads from title preferences when omitted. */
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
  const [loginState, setLoginState] = useState<DailyLoginState | null>(null);
  const [featured, setFeatured] = useState<FeaturedStat | null>(null);
  const [displayedTitle, setDisplayedTitle] = useState<string | null>(null);
  const [onlinePlayersOpen, setOnlinePlayersOpen] = useState(false);
  const [practiceSetupOpen, setPracticeSetupOpen] = useState(false);
  const [onlinePlayOpen, setOnlinePlayOpen] = useState(false);
  const [slideStageHeight, setSlideStageHeight] = useState(0);
  const slideProgress = useRef(new Animated.Value(0)).current;
  const [practicePlayerCount, setPracticePlayerCount] = useState(
    PRACTICE_DEFAULT_PLAYERS,
  );
  const ringPulse = useRef(new Animated.Value(1)).current;
  const xpPulse = useRef(new Animated.Value(1)).current;
  const pendingLoginClaimRef = useRef<{ state: DailyLoginState } | null>(null);
  const pendingDailyClaimRef = useRef<{ state: DailyChallengeState } | null>(
    null,
  );
  const { display: displayXp, animateTo: animateXpTo } = useAnimatedNumber(
    stats?.xp ?? 0,
  );

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
    const trackId = await readDisplayTitleTrackId();
    await syncUnlockSnapshot(s);
    setStats(s);
    setDisplayedTitle(
      playerTitle ?? displayedTitleForStats(s, trackId) ?? null,
    );
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
    const practiceCount = await readPracticePlayerCount();
    setPracticePlayerCount(practiceCount);
    const daily = await loadDailyChallengeState(s);
    // Mark complete for UI, but never auto-grant XP — player taps to claim.
    const marked = await markDailyChallengeCompleteIfReady(
      daily.def,
      daily.state,
      s,
    );
    setDailyDef(daily.def);
    setDailyState(marked);
    const login = await loadDailyLoginState();
    setLoginState(login);
  }, [playerTitle]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const run = (fn: () => void) => {
    onNavigateSound?.();
    triggerHaptic("light");
    fn();
  };

  const {
    publicRooms,
    roomsLoaded,
    isSearching,
    error: onlineError,
    connectionStatus,
    refreshRooms,
    setError: setOnlineError,
  } = useHubRoomDiscovery({ enabled: onlinePlayOpen });

  const openOnlinePlay = () => {
    if (onlinePlayOpen) return;
    onNavigateSound?.();
    triggerHaptic("medium");
    setOnlinePlayOpen(true);
    Animated.timing(slideProgress, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeOnlinePlay = () => {
    if (!onlinePlayOpen) return;
    onNavigateSound?.();
    triggerHaptic("light");
    Animated.timing(slideProgress, {
      toValue: 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOnlinePlayOpen(false);
    });
  };

  const requireOnlineName = (): boolean => {
    const name = displayName.trim();
    if (!name) {
      setOnlineError("Set your name in Settings first.");
      return false;
    }
    const check = validateDisplayText(name, "Player name");
    const err = displayTextError(check);
    if (err) {
      setOnlineError(err);
      return false;
    }
    return true;
  };

  const handleJoinOnlineRoom = (roomId: string) => {
    if (!requireOnlineName()) return;
    triggerHaptic("medium");
    setOnlineError(null);
    actions.onJoinOnlineRoom(roomId, displayName.trim());
  };

  const handleSpectateOnlineRoom = (roomId: string) => {
    if (!requireOnlineName()) return;
    if (!actions.onSpectateOnlineRoom) return;
    triggerHaptic("medium");
    setOnlineError(null);
    actions.onSpectateOnlineRoom(roomId, displayName.trim());
  };

  const handleHostOnlineGame = () => {
    if (!requireOnlineName()) return;
    if (connectionStatus !== "connected") {
      setOnlineError("Connect to the server before hosting.");
      return;
    }
    triggerHaptic("medium");
    setOnlineError(null);
    actions.onHostOnlineGame(displayName.trim());
  };

  const handleJoinWithCode = (code: string) => {
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      setOnlineError("Enter a room code from your host.");
      return;
    }
    if (!isValidRoomCode(normalized)) {
      setOnlineError("Room codes are 4–8 letters and numbers.");
      return;
    }
    if (isBotPublicRoomCode(normalized)) {
      setOnlineError(
        "No public games available right now. Host a game or try again later.",
      );
      return;
    }
    handleJoinOnlineRoom(normalized);
  };

  const localSlideX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -contentMaxWidth],
  });
  const onlineSlideX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [contentMaxWidth, 0],
  });

  const refreshStatsAfterXpGrant = useCallback(
    async (targetXp: number) => {
      animateXpTo(targetXp);
      Animated.sequence([
        Animated.timing(xpPulse, {
          toValue: 1.14,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(xpPulse, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      const refreshed = await getPlayerStats();
      setStats(refreshed);
      setFeatured(selectFeaturedStat(refreshed));
      const nextRefreshed = selectNextAchievement(refreshed);
      setNextAch(nextRefreshed);
      setGoals(selectHubGoals(refreshed, 3, nextRefreshed?.def.id));
      setBorder(resolveAvatarBorder(refreshed));
    },
    [animateXpTo, xpPulse],
  );

  const claimDailyReward = useCallback(async (): Promise<number> => {
    if (!dailyDef || !dailyState || !stats || dailyState.rewardClaimed) {
      return 0;
    }
    const progress = dailyChallengeProgress(dailyDef, dailyState, stats);
    if (!progress.done) return 0;

    triggerHaptic("medium");
    const claimed = await claimDailyChallengeIfReady(
      dailyDef,
      dailyState,
      stats,
    );
    pendingDailyClaimRef.current = { state: claimed.state };
    return claimed.grantedXp;
  }, [dailyDef, dailyState, stats]);

  const onDailyBurstComplete = useCallback(
    async (grantedXp: number) => {
      if (pendingDailyClaimRef.current) {
        setDailyState(pendingDailyClaimRef.current.state);
        pendingDailyClaimRef.current = null;
      }
      if (grantedXp > 0) {
        const refreshed = await getPlayerStats();
        await refreshStatsAfterXpGrant(refreshed.xp);
      }
    },
    [refreshStatsAfterXpGrant],
  );

  const claimLoginReward = useCallback(async (): Promise<number> => {
    if (!loginState || loginState.claimed) {
      return 0;
    }

    triggerHaptic("medium");
    const claimed = await claimDailyLoginIfReady(loginState);
    pendingLoginClaimRef.current = { state: claimed.state };
    return claimed.grantedXp;
  }, [loginState]);

  const onLoginBurstComplete = useCallback(
    async (grantedXp: number) => {
      if (pendingLoginClaimRef.current) {
        setLoginState(pendingLoginClaimRef.current.state);
        pendingLoginClaimRef.current = null;
      }
      if (grantedXp > 0) {
        const refreshed = await getPlayerStats();
        await refreshStatsAfterXpGrant(refreshed.xp);
      }
    },
    [refreshStatsAfterXpGrant],
  );

  const displayLevel = levelProgressFromXp(displayXp);
  /** Cold open: no rounds yet — answer what/why/start before empty meta chrome. */
  const statsReady = stats !== null;
  const hasPlayed = (stats?.roundsPlayed ?? 0) > 0;
  const isDay0 = statsReady && !hasPlayed;
  const dailyProgress =
    dailyDef && dailyState && stats
      ? dailyChallengeProgress(dailyDef, dailyState, stats)
      : null;
  const dailyDone = !!dailyProgress?.done;
  const canClaimDaily =
    dailyDone && !!dailyDef && !!dailyState && !dailyState.rewardClaimed;
  const canClaimLogin = !!loginState && !loginState.claimed;
  const recentRarity = recent
    ? rarityForAchievementId(recent.def.id)
    : null;
  const recentAccent = recentRarity
    ? RARITY_COLOR[recentRarity]
    : colors.accent;

  const identityPanel = (
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
            progress={displayLevel.fraction}
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
            <Text style={styles.levelBadgeText}>{displayLevel.level}</Text>
          </View>
        </Animated.View>

        <View style={styles.identityBody}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName || "Player"}
            </Text>
            <View style={styles.identityActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => run(actions.onOpenTitles)}
                accessibilityRole="button"
                accessibilityLabel="Open titles"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.identityActionBtn}
              >
                <MenuIcon name="list" size={18} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => run(actions.onOpenAchievements)}
                accessibilityRole="button"
                accessibilityLabel="Open achievements"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.identityActionBtn}
              >
                <MenuIcon name="trophy" size={18} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => run(actions.onOpenSettings)}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.identityActionBtn}
              >
                <MenuIcon name="gear" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
          {(playerTitle ?? displayedTitle) ? (
            <Text style={styles.titleSlot} numberOfLines={1}>
              {playerTitle ?? displayedTitle}
            </Text>
          ) : null}
          <Text style={styles.identityMeta}>Level {displayLevel.level}</Text>
          <Animated.Text
            style={[
              styles.careerXp,
              { transform: [{ scale: xpPulse }] },
            ]}
          >
            {displayXp.toLocaleString()} XP
          </Animated.Text>
          <ProgressMeter
            progress={displayLevel.fraction}
            label="To next level"
            valueLabel={`${displayLevel.xpIntoLevel} / ${displayLevel.xpForLevel}`}
            style={{ marginTop: 8 }}
            prestige
          />
        </View>
      </View>
    </BlurPanel>
  );

  const loginCard =
    canClaimLogin && loginState ? (
      <BlurPanel
        intensity={44}
        style={[
          styles.card,
          styles.utilityCard,
          styles.dailyClaimableCard,
        ]}
      >
        <View style={styles.dailyHeader}>
          <MenuIcon name="bolt" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            Daily Bonus
          </Text>
          <Text style={styles.rewardInline}>+{DAILY_LOGIN_XP} XP</Text>
        </View>
        <Text style={styles.goalTitle}>Welcome back</Text>
        <Text style={styles.goalSub}>
          Tap to claim your free XP for today.
        </Text>
        <Text style={styles.rewardLine}>
          {`Tap to claim · +${DAILY_LOGIN_XP} XP`}
        </Text>
      </BlurPanel>
    ) : null;

  const dailyLoginPanel =
    loginCard == null ? null : (
      <RewardClaimBurst
        onClaim={claimLoginReward}
        onBurstComplete={(grantedXp) => {
          void onLoginBurstComplete(grantedXp);
        }}
        accessibilityLabel={`Claim daily login bonus, ${DAILY_LOGIN_XP} XP`}
      >
        {loginCard}
      </RewardClaimBurst>
    );

  const dailyCard =
    hasPlayed &&
    dailyDef &&
    dailyProgress &&
    dailyState &&
    !dailyState.rewardClaimed ? (
      <BlurPanel
        intensity={44}
        style={[
          styles.card,
          styles.utilityCard,
          dailyDone && styles.dailyDoneCard,
          canClaimDaily && styles.dailyClaimableCard,
        ]}
      >
        <View style={styles.dailyHeader}>
          <MenuIcon name="calendar" size={16} color={colors.accent} />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            Daily Challenge
          </Text>
          <Text style={styles.rewardInline}>+{dailyDef.rewardXp} XP</Text>
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
            {`Tap to claim · +${dailyDef.rewardXp} XP`}
          </Text>
        ) : null}
      </BlurPanel>
    ) : null;

  const dailyChallengePanel =
    dailyCard == null ? null : canClaimDaily && dailyDef ? (
      <RewardClaimBurst
        onClaim={claimDailyReward}
        onBurstComplete={(grantedXp) => {
          void onDailyBurstComplete(grantedXp);
        }}
        accessibilityLabel={`Claim daily challenge reward, ${dailyDef.rewardXp} XP`}
      >
        {dailyCard}
      </RewardClaimBurst>
    ) : (
      dailyCard
    );

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
          <Text style={styles.brandPitch}>
            Race to empty your hand. Finish first and become President.
          </Text>

          <View
            style={[
              styles.slideStage,
              slideStageHeight > 0 ? { minHeight: slideStageHeight } : null,
            ]}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > slideStageHeight) setSlideStageHeight(h);
            }}
          >
            <Animated.View
              style={[
                styles.slidePanel,
                { transform: [{ translateX: localSlideX }] },
              ]}
              pointerEvents={onlinePlayOpen ? "none" : "auto"}
            >
              <View style={styles.contentSlideInner}>
          {/* Play — primary actions sit high, right under the pitch */}
          <View style={styles.playHero}>
            <AppButton
              label="Play"
              icon="bolt"
              variant="primary"
              onPress={() => run(() => actions.onPlay(practicePlayerCount))}
              accessibilityLabel={
                isDay0
                  ? "Play. Practice versus AI and learn in one round"
                  : `Play versus AI with ${practicePlayerCount} players`
              }
              style={styles.primaryCta}
            />
            {isDay0 ? (
              <Text style={styles.playHelper}>
                Practice versus AI. Learn in one round.
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.practiceCountBtn}
              onPress={() => {
                triggerHaptic("light");
                setPracticeSetupOpen(true);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Practice setup. ${practicePlayerCount} players at the table`}
              hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
            >
              <Text style={styles.practiceCountText}>
                vs AI · {practicePlayerCount} player
                {practicePlayerCount === 1 ? "" : "s"}
              </Text>
            </TouchableOpacity>
            <AppButton
              label="Play with friends"
              icon="globe"
              variant="secondary"
              onPress={() => run(openOnlinePlay)}
              accessibilityLabel="Play with friends — join or invite to an online table"
            />
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

          {/* Returning / loading: identity after play. Day-0: play first. */}
          {!isDay0 ? identityPanel : null}

          <AppButton
            label="Game Rules"
            icon="list"
            variant="secondary"
            onPress={() => run(actions.onOpenReadMe)}
            accessibilityLabel="Game Rules"
            style={styles.rulesEntryButton}
          />

          {isDay0 ? identityPanel : null}

          <AddToHomeScreenBanner />

          {isDay0 ? (
            <Text style={styles.day0Nudge}>
              Play a round to start tracking XP and unlocks.
            </Text>
          ) : null}

          {/* Daily login bonus — tap to claim; resets at UTC midnight */}
          {dailyLoginPanel}

          {/* Daily Challenge — time-sensitive (after first play); XP on tap */}
          {dailyChallengePanel}

          {/* Next Achievement — short-term chase */}
          {hasPlayed && nextAch ? (
            <NextAchievementCard
              next={nextAch}
              onPress={() => run(actions.onOpenAchievements)}
            />
          ) : null}

          {/* Recent Unlock — celebration when fresh */}
          {hasPlayed && recent && recentRarity ? (
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
                onPress={() => run(actions.onOpenTitles)}
                style={styles.linkBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.linkBtnText}>View Titles</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => run(actions.onOpenAchievements)}
                activeOpacity={0.85}
              >
                <Text style={styles.linkBtnText}>View Achievements</Text>
              </TouchableOpacity>
            </BlurPanel>
          ) : null}

          {/* Continue Your Journey — longer-arc goals */}
          {hasPlayed && goals.length > 0 ? (
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
          {hasPlayed && showFriendsPlaceholder ? (
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
          {hasPlayed ? (
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
          ) : null}

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

          {/* Support — optional Ko-fi contributions */}
          <BlurPanel
            intensity={44}
            style={[styles.card, styles.utilityCard, styles.supportCard]}
          >
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.supportBody}>
              Help fund ongoing development. Contributions are optional and never
              unlock advantages.
            </Text>
            <KofiButton style={styles.supportCta} />
          </BlurPanel>

          <Text style={styles.versionLabel}>{versionLabel}</Text>
              </View>
            </Animated.View>

            {onlinePlayOpen ? (
              <Animated.View
                style={[
                  styles.slidePanel,
                  styles.slidePanelOverlay,
                  { transform: [{ translateX: onlineSlideX }] },
                ]}
                pointerEvents="auto"
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > slideStageHeight) setSlideStageHeight(h);
                }}
              >
                <HubOnlinePlayPanel
                  playerName={displayName}
                  publicRooms={publicRooms}
                  roomsLoaded={roomsLoaded}
                  isSearching={isSearching}
                  connectionStatus={connectionStatus}
                  error={onlineError}
                  onBack={closeOnlinePlay}
                  onRefresh={() => void refreshRooms()}
                  onHost={handleHostOnlineGame}
                  onJoinRoom={handleJoinOnlineRoom}
                  onJoinWithCode={handleJoinWithCode}
                  onSpectateRoom={
                    actions.onSpectateOnlineRoom
                      ? handleSpectateOnlineRoom
                      : undefined
                  }
                />
              </Animated.View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <OnlinePlayersModal
        visible={onlinePlayersOpen}
        playerCount={onlinePlayerCount}
        players={onlinePlayers}
        onClose={() => setOnlinePlayersOpen(false)}
      />
      <PracticeSetupModal
        visible={practiceSetupOpen}
        playerCount={practicePlayerCount}
        onSelectPlayerCount={(count) => {
          setPracticePlayerCount(count);
          void writePracticePlayerCount(count);
        }}
        onClose={() => setPracticeSetupOpen(false)}
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
    slideStage: {
      width: "100%",
      overflow: "hidden",
    },
    slidePanel: {
      width: "100%",
    },
    slidePanelOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    contentSlideInner: {
      width: "100%",
      gap: 16,
    },
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
      marginBottom: 6,
      fontWeight: "600",
      ...onFeltTextStyle(colors.onFelt, "accent"),
    },
    brandPitch: {
      fontSize: 15,
      textAlign: "center",
      lineHeight: 21,
      fontWeight: "600",
      marginBottom: 10,
      paddingHorizontal: 8,
      ...onFeltTextStyle(colors.onFelt, "secondary"),
    },
    playHero: {
      gap: 10,
      marginTop: 2,
      marginBottom: 8,
    },
    playHelper: {
      fontSize: 13,
      textAlign: "center",
      fontWeight: "600",
      lineHeight: 18,
      marginTop: -4,
      marginBottom: 2,
      ...onFeltTextStyle(colors.onFelt, "secondary"),
    },
    day0Nudge: {
      fontSize: 13,
      textAlign: "center",
      fontWeight: "600",
      lineHeight: 18,
      ...onFeltTextStyle(colors.onFelt, "secondary"),
    },
    rulesEntryButton: {
      width: "100%",
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
    dailyClaimableCard: {
      borderColor: hexToRgba(colors.accent, 0.62),
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
    identityActions: {
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
    identityActionBtn: {
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
    primaryCta: { marginBottom: 4 },
    practiceCountBtn: {
      alignSelf: "center",
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: 8,
      marginTop: -2,
      marginBottom: 2,
    },
    practiceCountText: {
      textAlign: "center",
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
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
    supportBody: {
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
      ...onFeltTextStyle(colors.onFelt, "secondary"),
    },
    supportCta: {
      width: "100%",
      marginTop: 4,
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
