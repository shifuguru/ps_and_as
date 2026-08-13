import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { View, Animated, StyleSheet, Text, TouchableOpacity, Platform, Alert } from "react-native";
import SplashScreen from "./src/screens/SplashScreen";
import CreateGame from "./src/screens/CreateGame";
import FindGame from "./src/screens/FindGame";
import GameScreen from "./src/screens/GameScreen";
import Achievements from "./src/screens/Achievements";
import Titles from "./src/screens/Titles";
import Settings from "./src/screens/Settings";
import UpdateLog from "./src/screens/UpdateLog";
import ReadMeScreen from "./src/screens/ReadMeScreen";
import PlayerHub from "./src/screens/PlayerHub";
import ScreenContainer from "./src/components/ScreenContainer";
import BlurPanel from "./src/components/BlurPanel";
import { ThemeProvider, useAppTheme } from "./src/context/ThemeContext";
import { CardAppearanceProvider } from "./src/context/CardAppearanceContext";
import { preloadGamePreferences } from "./src/services/gamePreferences";
import {
  clampPracticePlayerCount,
} from "./src/services/practicePreferences";
import { ensurePlayerStatsRestored } from "./src/services/playerStats";
import { preloadAdsConsent } from "./src/services/ads/adsConsent";
import { preloadAdsEntitlement } from "./src/services/ads/adsEntitlement";
import AdsConsentBanner from "./src/components/AdsConsentBanner";
import PrivacyPolicyModal from "./src/components/PrivacyPolicyModal";
import { useMenuAudio } from "./src/hooks/useMenuAudio";
import AnimatedBackground from "./src/components/AnimatedBackground";
import { SocketAdapter } from "./src/game/socketAdapter";
import type { LobbyMember } from "./src/game/network";
import { MockAdapter } from "./src/game/network";
import { isSocketAdapter } from "./src/game/socketAdapter";
import { getOrCreatePlayerId } from "./src/services/gameCenter";
import { shouldHoldSpectatorStartGameInLobby } from "./src/services/availableRooms";
import { resolveDisplayNameSetupState } from "./src/services/playerDisplayName";
import {
  markWebInstallDeclined,
  resolveWebOnboardingState,
} from "./src/services/webOnboarding";
import {
  clearLobbySession,
  getLobbySession,
  saveLobbySession,
  type LobbySession,
} from "./src/services/lobbySession";
import DisplayNameSetupModal from "./src/components/DisplayNameSetupModal";
import WebInstallCoachModal from "./src/components/WebInstallCoachModal";
import { SafeAreaProvider } from "react-native-safe-area-context";
import FeltBackground from "./src/components/FeltBackground";
import FullscreenBlurScrim from "./src/components/FullscreenBlurScrim";
import { MODAL_OVERLAY_Z } from "./src/styles/overlayZIndex";
import WebModalPortal from "./src/components/WebModalPortal";
import { DEFAULT_FELT_COLOR, getWallpaperTint } from "./src/services/wallpaper";
import { WEB_SPLASH_OVERLAY } from "./src/styles/webFullBleed";
import WebSplashPortal from "./src/components/WebSplashPortal";
import { tryCollapseSafariChrome, isStandaloneWebApp } from "./src/utils/safariChrome";
import { useVisualViewportSize, useWebShellLayout } from "./src/hooks/useVisualViewportSize";
import { isMobileWeb, installWebShellCss } from "./src/utils/webViewport";
import { useAppFonts } from "./src/hooks/useAppFonts";
import { useBuildUpdateCheck } from "./src/hooks/useBuildUpdateCheck";
import { useOnlinePresence, updateOnlinePresenceDisplayName } from "./src/hooks/useOnlinePlayerCount";
import { useUpdateLogUnreadCount } from "./src/hooks/useUpdateLogUnreadCount";
import { useWebEscapeKey } from "./src/hooks/useWebEscapeKey";
import UpdateRequiredOverlay from "./src/components/UpdateRequiredOverlay";
import {
  makeCpuPlayerId,
  pickCpuDisplayNames,
} from "./src/utils/cpuNames";
import AppErrorBoundary from "./src/components/AppErrorBoundary";
import PhonePortraitLock from "./src/components/PhonePortraitLock";
import { StatusBar } from "expo-status-bar";
import {
  getViewportExperiment,
  isViewportDebugEnabled,
} from "./src/debug/viewportDebug";
import {
  trackAnalyticsEvent,
  trackHubViewedOnce,
} from "./src/services/analytics";

const ViewportDebugOverlay =
  Platform.OS === "web" &&
  (isViewportDebugEnabled() || getViewportExperiment() > 0)
    ? require("./src/debug/ViewportDebugOverlay").default
    : null;

function AppContent() {
  const { colors, ui, blur, feltTint, setFeltTint, refreshFeltTint } = useAppTheme();
  const viewport = useVisualViewportSize();
  const shell = useWebShellLayout();
  // splashVisible: whether the splash overlay is still mounted
  // menuVisible: whether the main menu should be shown (after splash fully hidden)
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const { playEffect, toggleMute, muted, unlockAudio } = useMenuAudio();
  const playGameSound = useCallback(
    (effect: string) => {
      playEffect(effect);
    },
    [playEffect],
  );

  // Warm the SFX pool on the first user gesture so menu clicks are not waiting
  // on createAsync the first time each effect is used.
  useEffect(() => {
    const warm = () => {
      void unlockAudio();
    };
    const opts = { capture: true, once: true } as AddEventListenerOptions;
    const doc = typeof document !== "undefined" ? document : null;
    doc?.addEventListener("pointerdown", warm, opts);
    doc?.addEventListener("touchstart", warm, opts);
    doc?.addEventListener("keydown", warm, opts);
    return () => {
      doc?.removeEventListener("pointerdown", warm, true);
      doc?.removeEventListener("touchstart", warm, true);
      doc?.removeEventListener("keydown", warm, true);
    };
  }, [unlockAudio]);

  const [screen, setScreen] = useState<
    "menu" | "create" | "find" | "game"
  >("menu");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[] | null>(null);
  const [dealSeed, setDealSeed] = useState<number | undefined>(undefined);
  const [localPlayerName, setLocalPlayerName] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [installCoachVisible, setInstallCoachVisible] = useState(false);
  const [installCoachResolved, setInstallCoachResolved] = useState(false);
  const [nameSetupVisible, setNameSetupVisible] = useState(false);
  const [nameSetupResolved, setNameSetupResolved] = useState(false);
  const [nameSetupAccountSync, setNameSetupAccountSync] = useState(false);
  const onboardingBlocking = installCoachVisible || nameSetupVisible;
  const onboardingReady = installCoachResolved && nameSetupResolved;
  const [roomAdapter, setRoomAdapter] = useState<SocketAdapter | null>(null);
  // localAdapter is used for offline/mock games so we can reuse the same
  // MockAdapter instance between screens and avoid multiple adapters/logs.
  const [localAdapter, setLocalAdapter] = useState<any | null>(null);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [gameInstanceKey, setGameInstanceKey] = useState(0);
  const [updateDismissedBuildId, setUpdateDismissedBuildId] = useState<
    string | null
  >(null);
  const { count: updateLogUnreadCount, markSeen: markUpdateLogSeen } =
    useUpdateLogUnreadCount(menuVisible, updateLogOpen);
  const onlinePresence = useOnlinePresence(
    !splashVisible && !onboardingBlocking && onboardingReady,
    localPlayerName,
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const cancel = (globalThis as {
      __PS_AND_AS_CANCEL_BOOT_GUARD__?: () => void;
    }).__PS_AND_AS_CANCEL_BOOT_GUARD__;
    cancel?.();
  }, []);

  useEffect(() => {
    void preloadGamePreferences();
    void ensurePlayerStatsRestored();
    void preloadAdsConsent().then(async () => {
      try {
        const { getAdsConsentSync, canLoadPersonalizedAds } = await import(
          "./src/services/ads/adsConsent"
        );
        if (canLoadPersonalizedAds() || getAdsConsentSync() === "accepted") {
          const { configureH5AdsSound } = await import(
            "./src/services/ads/webH5Ads"
          );
          configureH5AdsSound(true);
        }
      } catch {
        // ignore
      }
    });
    void preloadAdsEntitlement();
    // Stripe return: refresh Remove Ads entitlement from cloud.
    if (Platform.OS === "web") {
      void (async () => {
        try {
          const {
            consumePurchaseQueryParam,
            refreshAdsEntitlementFromCloud,
          } = await import("./src/services/ads/removeAdsPurchase");
          const purchase = consumePurchaseQueryParam();
          if (purchase === "remove_ads_success") {
            const ok = await refreshAdsEntitlementFromCloud();
            if (ok) {
              Alert.alert(
                "Thanks!",
                "Forced ads are removed on this Google-linked account.",
              );
            } else {
              Alert.alert(
                "Purchase received",
                "If ads still appear, open Settings after a moment — sync may still be catching up.",
              );
            }
          }
          // Deep-link to privacy modal
          try {
            const loc = (globalThis as { location?: Location }).location;
            if (loc?.search?.includes("privacy=1")) {
              setPrivacyOpen(true);
            }
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      })();
    }
  }, []);

  const { updateAvailable, latestBuild } = useBuildUpdateCheck(
    !splashVisible,
    roomAdapter,
  );
  const showUpdateOverlay =
    Platform.OS === "web" &&
    updateAvailable &&
    latestBuild?.buildId &&
    latestBuild.buildId !== updateDismissedBuildId;

  const disconnectRoom = () => {
    try {
      roomAdapter?.disconnect();
    } catch {
      /* ignore */
    }
    void clearLobbySession();
    setPendingRejoin(null);
    setRoomAdapter(null);
    setJoinedRoomId(null);
    setActiveRoomId(null);
    setIsSpectator(false);
  };

  // Discovery adapter is created lazily only when viewing the Find Game screen so
  // we don't attempt network connections while the user is in offline/local flows.
  const discoveryAdapter = useMemo(() => {
    if (screen !== "find") return null;
    try {
      console.log("[App] Creating network adapter for discovery only...");
      return new SocketAdapter(undefined, "", "", "", false);
    } catch (e) {
      console.error("[App] Failed to create network adapter:", e);
      return null;
    }
  }, [screen]);

  useEffect(() => {
    void (async () => {
      const session = await getLobbySession();
      if (session) setPendingRejoin(session);
    })();
  }, []);

  const rejoinLobby = async () => {
    if (!pendingRejoin) return;
    const profile = await getOrCreatePlayerId();
    if (profile.id !== pendingRejoin.profileId) {
      await clearLobbySession();
      setPendingRejoin(null);
      Alert.alert(
        "Cannot Rejoin",
        "This lobby was saved under a different player profile on this device.",
      );
      return;
    }
    playEffect("click");
    setLocalPlayerName(pendingRejoin.playerName);
    setRoomAdapter(
      new SocketAdapter(
        undefined,
        pendingRejoin.roomId,
        pendingRejoin.playerName,
        profile.id,
        true,
        feltTint,
        pendingRejoin.reconnectSecret ?? null,
      ),
    );
    setJoinedRoomId(pendingRejoin.roomId);
    setActiveRoomId(pendingRejoin.roomId);
    setIsOnlineGame(true);
    setScreen("create");
    setPendingRejoin(null);
  };

  const menuOpacity = useRef(new Animated.Value(0)).current;

  /** Menu fades in over felt while the splash veil is still lifting. */
  const beginSplashReveal = useCallback(() => {
    setSplashRevealing(true);
    setMenuVisible(true);
    tryCollapseSafariChrome();
    Animated.timing(menuOpacity, {
      toValue: 1,
      duration: 480,
      useNativeDriver: false,
    }).start();
  }, [menuOpacity]);

  const finishSplash = useCallback(() => {
    setSplashVisible(false);
    setSplashRevealing(false);
    setMenuVisible(true);
    menuOpacity.setValue(1);
  }, [menuOpacity]);

  // Failsafe: never leave users stuck on splash if animations fail (seen on some iOS builds).
  useEffect(() => {
    if (!splashVisible) return;
    const timeout = setTimeout(() => {
      beginSplashReveal();
      finishSplash();
    }, 2500);
    return () => clearTimeout(timeout);
  }, [splashVisible, beginSplashReveal, finishSplash]);

  // Hide the status veil while splash is up (veil is body::before above #root).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const root = (globalThis as { document?: Document }).document?.documentElement;
    if (!root) return;
    root.classList.toggle("ps-splash-active", splashVisible);
    return () => {
      root.classList.remove("ps-splash-active");
    };
  }, [splashVisible]);

  const startPracticeGame = async (playerCount: number) => {
    if (onboardingBlocking || !localPlayerName?.trim()) return;
    disconnectRoom();
    const playerInfo = await getOrCreatePlayerId();
    const hostName = localPlayerName.trim();
    const savedTint = (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
    const totalPlayers = clampPracticePlayerCount(playerCount);
    const botCount = Math.max(0, totalPlayers - 1);
    console.log("[App] Practice game requested", {
      hostName,
      playerInfoId: playerInfo.id,
      totalPlayers,
      botCount,
    });
    setLocalPlayerName(hostName);
    setLocalPlayerId(playerInfo.id);
    const botNames = pickCpuDisplayNames(botCount, [hostName]);
    setLobbyMembers([
      { id: playerInfo.id, name: hostName, feltTint: savedTint },
      ...botNames.map((name, i) => ({
        id: makeCpuPlayerId(i + 1),
        name,
      })),
    ]);
    setIsOnlineGame(false);
    setGameInstanceKey((k) => k + 1);
    try {
      const m = new MockAdapter();
      setLocalAdapter(m);
    } catch (e) {
      console.warn("[App] Failed to create MockAdapter:", e);
      setLocalAdapter(null);
    }
    setRoomAdapter(null);
    setJoinedRoomId(null);
    trackAnalyticsEvent("quick_game_started", { playerCount: totalPlayers });
    setScreen("game");
  };

  const [hubRefreshKey, setHubRefreshKey] = useState(0);
  const [splashRevealing, setSplashRevealing] = useState(false);
  const [pendingRejoin, setPendingRejoin] = useState<LobbySession | null>(null);

  useEffect(() => {
    if (
      menuVisible &&
      screen === "menu" &&
      installCoachResolved &&
      nameSetupResolved &&
      !nameSetupVisible
    ) {
      trackHubViewedOnce();
    }
  }, [
    menuVisible,
    screen,
    installCoachResolved,
    nameSetupResolved,
    nameSetupVisible,
  ]);

  useEffect(() => {
    if (!menuVisible) return;
    if (installCoachResolved && nameSetupResolved) {
      if (screen === "menu") setHubRefreshKey((k) => k + 1);
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveDisplayNameSetupState();
      if (cancelled) return;
      setLocalPlayerId(resolved.profileId);

      const onboarding = await resolveWebOnboardingState({
        needsDisplayNameSetup: resolved.needsSetup,
      });
      if (cancelled) return;

      if (onboarding.phase === "install-coach") {
        setInstallCoachVisible(true);
        setInstallCoachResolved(false);
        setNameSetupVisible(false);
        setNameSetupAccountSync(false);
        setLocalPlayerName(null);
        return;
      }

      setInstallCoachVisible(false);
      setInstallCoachResolved(true);
      setNameSetupAccountSync(onboarding.coupleNameWithGoogleSync);

      if (resolved.needsSetup) {
        setNameSetupVisible(true);
        setLocalPlayerName(null);
      } else {
        setNameSetupVisible(false);
        setLocalPlayerName(resolved.displayName);
      }
      setNameSetupResolved(true);
      if (screen === "menu") setHubRefreshKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [menuVisible, screen, installCoachResolved, nameSetupResolved]);

  useEffect(() => {
    console.log("[App] screen state", {
      screen,
      menuVisible,
      isOnlineGame,
      joinedRoomId,
      activeRoomId,
      localAdapter: !!localAdapter,
      roomAdapter: !!roomAdapter,
      lobbyMembersCount: lobbyMembers?.length ?? 0,
    });
  }, [screen, menuVisible, isOnlineGame, joinedRoomId, activeRoomId, localAdapter, roomAdapter, lobbyMembers]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const cleanupShell = installWebShellCss(feltTint);
    const doc: any = (globalThis as { document?: any }).document;
    if (!doc) return cleanupShell;
    const style = doc.createElement("style");
    style.setAttribute("data-app", "no-text-select");
    style.textContent = `
      html, body, #root, #root * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
      input, textarea, select {
        user-select: text !important;
        -webkit-user-select: text !important;
        font-size: 16px !important;
      }
      #felt-color-picker, #felt-color-picker * {
        touch-action: none;
        overscroll-behavior: contain;
      }
    `;
    doc.head.appendChild(style);
    return () => {
      cleanupShell();
      doc.head.removeChild(style);
    };
  }, [feltTint]);

  useEffect(() => {
    (async () => {
      try {
        const tint = await getWallpaperTint();
        setFeltTint(tint ?? DEFAULT_FELT_COLOR);
      } catch {
        // ignore
      }
    })();
  }, [setFeltTint]);

  const reloadWallpaper = async () => {
    try {
      const tint = (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
      setFeltTint(tint);
      await refreshFeltTint();
    } catch {
      // ignore
    }
  };

  const openSettings = () => setSettingsOpen(true);

  const closeSettings = () => {
    void reloadWallpaper();
    setSettingsOpen(false);
  };

  const openAchievements = () => setAchievementsOpen(true);

  const closeAchievements = () => setAchievementsOpen(false);

  const openTitles = () => setTitlesOpen(true);

  const closeTitles = () => {
    setTitlesOpen(false);
    setHubRefreshKey((k) => k + 1);
  };

  const openUpdateLog = () => setUpdateLogOpen(true);

  const closeUpdateLog = () => setUpdateLogOpen(false);

  const openReadMe = () => setReadmeOpen(true);

  const closeReadMe = () => setReadmeOpen(false);

  const closeTopBackModal = useCallback(() => {
    if (readmeOpen) {
      closeReadMe();
    } else if (updateLogOpen) {
      closeUpdateLog();
    } else if (achievementsOpen) {
      closeAchievements();
    } else if (titlesOpen) {
      closeTitles();
    } else if (settingsOpen) {
      closeSettings();
    }
  }, [
    readmeOpen,
    updateLogOpen,
    achievementsOpen,
    titlesOpen,
    settingsOpen,
    closeSettings,
  ]);

  useWebEscapeKey(
    closeTopBackModal,
    menuVisible &&
      (settingsOpen || achievementsOpen || titlesOpen || updateLogOpen || readmeOpen),
  );

  const lobbyMembersRef = useRef(lobbyMembers);
  lobbyMembersRef.current = lobbyMembers;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const localPlayerNameRef = useRef(localPlayerName);
  localPlayerNameRef.current = localPlayerName;
  const localPlayerIdRef = useRef(localPlayerId);
  localPlayerIdRef.current = localPlayerId;
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const joinedRoomIdRef = useRef(joinedRoomId);
  joinedRoomIdRef.current = joinedRoomId;

  const enterOnlineGame = useCallback(
    (
      members: LobbyMember[],
      localName: string,
      localSocketId?: string,
      asSpectator = false,
    ) => {
      console.log("[App] enterOnlineGame:", members.length, "players", asSpectator ? "(spectator)" : "");
      setLobbyMembers(members);
      setLocalPlayerName(localName);
      if (localSocketId) setLocalPlayerId(localSocketId);
      setIsSpectator(asSpectator);
      setDealSeed(undefined);
      setIsOnlineGame(true);
      setLocalAdapter(null);
      setGameInstanceKey((k) => k + 1);
      setScreen("game");
    },
    [],
  );

  // Kicked / room dismissed must work from any screen (lobby or in-game).
  useEffect(() => {
    if (!roomAdapter || !isSocketAdapter(roomAdapter)) return;

    const onForcedExit = (ev: {
      type: string;
      state?: { type?: string; message?: string };
    }) => {
      if (ev.type !== "state" || !ev.state?.type) return;
      const kind = ev.state.type;
      if (
        kind !== "kicked" &&
        kind !== "roomDismissed" &&
        kind !== "gameAborted"
      ) {
        return;
      }

      roomAdapter.clearRoomSession();
      void clearLobbySession();
      setPendingRejoin(null);
      setJoinedRoomId(null);
      setActiveRoomId(null);
      setIsOnlineGame(false);
      setIsSpectator(false);
      setLobbyMembers(null);
      setRoomAdapter(null);
      setScreen("menu");

      if (kind === "kicked") {
        Alert.alert(
          "Removed from Game",
          ev.state.message || "You have been removed from the game",
        );
      } else if (kind === "gameAborted") {
        Alert.alert(
          "Game Ended",
          ev.state.message || "The online game has ended.",
        );
      } else {
        Alert.alert("Room Closed", "The host closed this lobby.");
      }
    };

    roomAdapter.on("message", onForcedExit);
    return () => {
      roomAdapter.off("message", onForcedExit);
    };
  }, [roomAdapter]);

  // All clients must react to startGame here — CreateGame may unmount before guests receive it.
  useEffect(() => {
    if (!roomAdapter || !isSocketAdapter(roomAdapter)) return;

    const onMessage = (ev: {
      type: string;
      state?: {
        type?: string;
        players?: unknown;
        spectator?: boolean;
        dealSeed?: number;
      };
    }) => {
      if (ev.type !== "state" || ev.state?.type !== "startGame") return;

      const roomId = activeRoomIdRef.current ?? joinedRoomIdRef.current;

      // Bot-open tables keep spectators in the lobby Ready UI.
      // Standard in-game joins must enter GameScreen — CreateGame Ready is
      // lobby-only and cannot claim the dead-hand seat or show the table.
      if (screenRef.current === "create") {
        if (typeof ev.state.spectator === "boolean") {
          setIsSpectator(ev.state.spectator);
        }
        if (typeof ev.state.dealSeed === "number") {
          setDealSeed(ev.state.dealSeed);
        }
        if (
          ev.state.spectator &&
          shouldHoldSpectatorStartGameInLobby(roomId)
        ) {
          return;
        }
      }

      if (screenRef.current === "game") {
        if (typeof ev.state.spectator === "boolean") {
          setIsSpectator(ev.state.spectator);
        }
        if (roomId) {
          roomAdapter.requestGameState(roomId);
        }
        return;
      }

      if (typeof ev.state.dealSeed === "number") {
        setDealSeed(ev.state.dealSeed);
      }

      const asSpectator = !!ev.state.spectator;
      const rawPlayers = ev.state.players;
      const fromEvent: LobbyMember[] = Array.isArray(rawPlayers)
        ? rawPlayers.map((p: string | LobbyMember, i: number) =>
            typeof p === "string"
              ? { id: String(i + 1), name: p }
              : { id: p.id, name: p.name, ready: p.ready },
          )
        : [];
      const members =
        fromEvent.length > 0
          ? fromEvent
          : lobbyMembersRef.current && lobbyMembersRef.current.length > 0
            ? lobbyMembersRef.current
            : [];

      const displayName = localPlayerNameRef.current ?? "Player";
      const profileId = roomAdapter.getProfileId();
      const localId =
        members.find((m) => m.id === profileId)?.id ??
        members.find(
          (m) =>
            m.name.toLowerCase() === displayName.trim().toLowerCase(),
        )?.id ??
        localPlayerIdRef.current ??
        undefined;

      const enter = () => {
        if (screenRef.current === "game") return;
        enterOnlineGame(members, displayName, localId, asSpectator);
      };

      if (roomId) {
        roomAdapter.requestGameState(roomId);
      }

      if (roomAdapter.getCachedGameState()) {
        enter();
        return;
      }

      let entered = false;
      const onSync = (syncEv: { type: string; state?: { type?: string } }) => {
        if (entered) return;
        if (syncEv.type === "state" && syncEv.state?.type === "gameStateSync") {
          entered = true;
          roomAdapter.off("message", onSync);
          enter();
        }
      };
      roomAdapter.on("message", onSync);
      setTimeout(() => {
        if (entered) return;
        entered = true;
        roomAdapter.off("message", onSync);
        enter();
      }, 2000);
    };

    roomAdapter.on("message", onMessage);
    return () => {
      roomAdapter.off("message", onMessage);
    };
  }, [roomAdapter, enterOnlineGame]);

  useEffect(() => {
    if (Platform.OS !== "web" || !isViewportDebugEnabled()) return;
    (globalThis as { __PS_RN_SHELL_HEIGHT__?: number }).__PS_RN_SHELL_HEIGHT__ =
      shell.height;
  }, [shell.height]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const teardown =
      require("./src/debug/viewportExperiments").applyViewportExperimentFromQuery();
    return teardown;
  }, []);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
    <View
      style={[
        { flex: 1 },
        Platform.OS === "web" &&
          (isMobileWeb()
            ? isStandaloneWebApp()
              ? ({
                  // Home Screen chin-gap fix: 100vh (not 100%, not screen px).
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  width: "100%",
                  height: "calc(100vh + 2px)",
                  maxHeight: "none",
                  overflow: "hidden",
                } as object)
              : ({
                  position: "fixed",
                  top: shell.shellTop,
                  left: 0,
                  right: 0,
                  width: "100%",
                  // Safari tab: track visualViewport for toolbar/keyboard.
                  height: shell.height,
                  maxHeight: shell.height,
                  overflow: "hidden",
                } as object)
            : {
                width: "100%",
                height: viewport.height,
                minHeight: viewport.height,
                maxHeight: viewport.height,
              }),
      ]}
    >
        {/* Document wallpaper (web) / in-tree felt (native). Shell layout is independent. */}
        <FeltBackground
          fullBleed
          tint={feltTint}
        />

        <View style={appStyles.appContent}>
        {/* Ambient accent behind secondary screens only — game/menu use Environment felt */}
        {screen !== "game" &&
          screen !== "create" &&
          screen !== "find" &&
          screen !== "menu" &&
          !settingsOpen &&
          !achievementsOpen && <AnimatedBackground />}

        {/* Splash — portaled to body on web so it sits above the status veil */}
        {splashVisible && (
          <WebSplashPortal>
            <View
              style={[
                StyleSheet.absoluteFillObject,
                WEB_SPLASH_OVERLAY,
                {
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
              pointerEvents={splashRevealing ? "none" : "auto"}
            >
              <SplashScreen
                onRevealBegin={beginSplashReveal}
                onFinish={finishSplash}
              />
            </View>
          </WebSplashPortal>
        )}

        {/* Main menu — consolidated with icons */}
        {menuVisible && screen === "menu" && (
          <Animated.View
            style={[{ flex: 1 }, { opacity: menuOpacity }]}
            pointerEvents={
              !onboardingReady || onboardingBlocking ? "none" : "auto"
            }
          >
            {pendingRejoin ? (
              <View
                style={[
                  appStyles.rejoinBanner,
                  {
                    backgroundColor: colors.btnAccentBg,
                    borderColor: colors.btnAccentBorder,
                  },
                ]}
              >
                <Text style={[appStyles.rejoinTitle, { color: colors.onFelt.textPrimary }]}>
                  Resume your lobby?
                </Text>
                <Text style={[appStyles.rejoinBody, { color: colors.onFelt.textSecondary }]} numberOfLines={2}>
                  {pendingRejoin.isHost ? "Host" : "Guest"} · room{" "}
                  {pendingRejoin.roomName || pendingRejoin.roomId}
                </Text>
                <View style={appStyles.rejoinActions}>
                  <TouchableOpacity
                    style={[appStyles.rejoinPrimary, { backgroundColor: colors.accent }]}
                    onPress={() => void rejoinLobby()}
                    activeOpacity={0.85}
                  >
                    <Text style={[appStyles.rejoinPrimaryText, { color: colors.textOnAccent }]}>
                      Rejoin
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      appStyles.rejoinSecondary,
                      {
                        backgroundColor: colors.btnSecondaryBg,
                        borderColor: colors.btnSecondaryBorder,
                      },
                    ]}
                    onPress={() => {
                      void clearLobbySession();
                      setPendingRejoin(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[appStyles.rejoinSecondaryText, { color: colors.btnSecondaryText }]}>
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
            <PlayerHub
              displayName={localPlayerName ?? "Player"}
              whatsNewUnread={updateLogUnreadCount}
              onlinePlayerCount={onlinePresence.count}
              onlinePlayers={onlinePresence.players}
              refreshKey={hubRefreshKey}
              onNavigateSound={() => playEffect("click")}
              actions={{
                onPlay: (playerCount) => {
                  if (onboardingBlocking || !localPlayerName) return;
                  trackAnalyticsEvent("cta_quick_game", { playerCount });
                  void startPracticeGame(playerCount);
                },
                onHostOnlineGame: (name) => {
                  if (onboardingBlocking || !localPlayerName) return;
                  trackAnalyticsEvent("cta_online_game");
                  void (async () => {
                    if (
                      isSocketAdapter(roomAdapter) &&
                      activeRoomId &&
                      roomAdapter.isConnected()
                    ) {
                      roomAdapter.dismissRoom(activeRoomId);
                    }
                    disconnectRoom();
                    const profile = await getOrCreatePlayerId();
                    setLocalPlayerName(name);
                    setRoomAdapter(
                      new SocketAdapter(undefined, "", name, profile.id, false, feltTint),
                    );
                    setJoinedRoomId(null);
                    setActiveRoomId(null);
                    setIsOnlineGame(true);
                    setScreen("create");
                  })();
                },
                onJoinOnlineRoom: (roomId, playerName) => {
                  if (onboardingBlocking || !localPlayerName) return;
                  trackAnalyticsEvent("cta_online_join", { roomId });
                  void (async () => {
                    const profile = await getOrCreatePlayerId();
                    setLocalPlayerName(playerName);
                    setIsSpectator(false);
                    setRoomAdapter(
                      new SocketAdapter(
                        undefined,
                        roomId,
                        playerName,
                        profile.id,
                        true,
                        feltTint,
                      ),
                    );
                    setJoinedRoomId(roomId);
                    setActiveRoomId(roomId);
                    setIsOnlineGame(true);
                    setScreen("create");
                  })();
                },
                onSpectateOnlineRoom: (roomId, playerName) => {
                  if (onboardingBlocking || !localPlayerName) return;
                  void (async () => {
                    const profile = await getOrCreatePlayerId();
                    setLocalPlayerName(playerName);
                    setLocalPlayerId(profile.id);
                    setIsSpectator(true);
                    setLobbyMembers([]);
                    const adapter = new SocketAdapter(
                      undefined,
                      roomId,
                      playerName,
                      profile.id,
                      true,
                      feltTint,
                    );
                    setRoomAdapter(adapter);
                    setJoinedRoomId(roomId);
                    setActiveRoomId(roomId);
                    setIsOnlineGame(true);
                    setGameInstanceKey((k) => k + 1);
                    setScreen("game");
                    await adapter.connect();
                  })();
                },
                onOpenAchievements: openAchievements,
                onOpenTitles: openTitles,
                onOpenWhatsNew: openUpdateLog,
                onOpenSettings: openSettings,
                onOpenReadMe: openReadMe,
              }}
            />
          </Animated.View>
        )}
        <WebInstallCoachModal
          visible={menuVisible && installCoachVisible}
          onContinueInBrowser={() => {
            void (async () => {
              trackAnalyticsEvent("install_coach_continued");
              await markWebInstallDeclined();
              setInstallCoachVisible(false);
              setInstallCoachResolved(true);
              // nameSetupResolved stays false → effect opens name + Google sync
            })();
          }}
        />
        <DisplayNameSetupModal
          visible={menuVisible && nameSetupVisible}
          variant={
            nameSetupAccountSync ? "browser-with-account-sync" : "default"
          }
          onComplete={(name) => {
            trackAnalyticsEvent("name_setup_completed");
            setLocalPlayerName(name);
            setNameSetupVisible(false);
            setNameSetupResolved(true);
            updateOnlinePresenceDisplayName(name);
          }}
        />
        {menuVisible && screen === "create" && (
          <CreateGame 
            adapter={roomAdapter || undefined} 
            isJoining={!!roomAdapter && !!joinedRoomId}
            joinRoomId={joinedRoomId || undefined}
            preferredPlayerName={localPlayerName ?? undefined}
            onRoomReady={(roomId, displayRoomName) => {
              setActiveRoomId(roomId);
              if (isSocketAdapter(roomAdapter)) {
                roomAdapter.setActiveRoomId(roomId);
              }
              void (async () => {
                const profile = await getOrCreatePlayerId();
                await saveLobbySession({
                  roomId,
                  profileId: profile.id,
                  playerName: profile.displayName,
                  isHost: !joinedRoomId,
                  roomName: displayRoomName || roomId,
                  reconnectSecret: isSocketAdapter(roomAdapter)
                    ? roomAdapter.getReconnectSecret() ?? undefined
                    : undefined,
                });
                setPendingRejoin(null);
              })();
            }}
            onBack={() => {
              const wasOnlineLobby = isSocketAdapter(roomAdapter);
              disconnectRoom();
              setIsOnlineGame(false);
              setScreen("menu");
            }}
            onNavigateToSettings={openSettings}
            onNavigateToAchievements={openAchievements}
            onLobbyMembersChange={(members) => {
              setLobbyMembers(members);
              lobbyMembersRef.current = members;
            }}
            onStart={(members, localName, localSocketId) => {
              if (isSocketAdapter(roomAdapter)) {
                enterOnlineGame(members, localName, localSocketId);
                return;
              }
              setLobbyMembers(members);
              setLocalPlayerName(localName);
              if (localSocketId) setLocalPlayerId(localSocketId);
              setDealSeed(undefined);
              setIsOnlineGame(false);
              setGameInstanceKey((k) => k + 1);
              disconnectRoom();
              try {
                const m = new MockAdapter();
                setLocalAdapter(m);
              } catch (e) {
                console.warn("[App] Failed to create MockAdapter:", e);
                setLocalAdapter(null);
              }
              setScreen("game");
            }} 
          />
        )}
        {menuVisible && screen === "find" && (
          discoveryAdapter ? (
            <FindGame 
              adapter={discoveryAdapter} 
              preferredPlayerName={localPlayerName ?? undefined}
              onBack={() => setScreen("menu")}
              onNavigateToSettings={openSettings}
            onNavigateToAchievements={openAchievements}
              onHostGame={(name) => {
                void (async () => {
                  if (
                    isSocketAdapter(roomAdapter) &&
                    activeRoomId &&
                    roomAdapter.isConnected()
                  ) {
                    roomAdapter.dismissRoom(activeRoomId);
                  }
                  disconnectRoom();
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(name);
                  setRoomAdapter(
                    new SocketAdapter(undefined, "", name, profile.id, false, feltTint),
                  );
                  setJoinedRoomId(null);
                  setActiveRoomId(null);
                  setIsOnlineGame(true);
                  setScreen("create");
                })();
              }}
              onJoinRoom={(roomId, playerName) => {
                void (async () => {
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(playerName);
                  setIsSpectator(false);
                  setRoomAdapter(
                    new SocketAdapter(
                      undefined,
                      roomId,
                      playerName,
                      profile.id,
                      true,
                      feltTint,
                    ),
                  );
                  setJoinedRoomId(roomId);
                  setActiveRoomId(roomId);
                  setIsOnlineGame(true);
                  setScreen("create");
                })();
              }}
              onSpectateRoom={(roomId, playerName) => {
                void (async () => {
                  const profile = await getOrCreatePlayerId();
                  setLocalPlayerName(playerName);
                  setLocalPlayerId(profile.id);
                  setIsSpectator(true);
                  setLobbyMembers([]);
                  const adapter = new SocketAdapter(
                    undefined,
                    roomId,
                    playerName,
                    profile.id,
                    true,
                    feltTint,
                  );
                  setRoomAdapter(adapter);
                  setJoinedRoomId(roomId);
                  setActiveRoomId(roomId);
                  setIsOnlineGame(true);
                  setGameInstanceKey((k) => k + 1);
                  setScreen("game");
                  await adapter.connect();
                })();
              }}
            />
          ) : (
            <ScreenContainer ignoreHeaderOffset style={{ flex: 1 }}>
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 24,
                }}
              >
                <BlurPanel style={[ui.panel, { width: "100%", maxWidth: 360 }]} {...blur.panel} intensity={52}>
                  <Text style={ui.panelEyebrow}>Connection</Text>
                  <Text style={ui.emptyTitle}>Network Unavailable</Text>
                  <Text style={[ui.emptyBody, { marginBottom: 16 }]}>
                    Unable to connect to the game server. Check your connection and try again.
                  </Text>
                  <TouchableOpacity
                    style={ui.btnSecondary}
                    onPress={() => setScreen("menu")}
                    activeOpacity={0.85}
                  >
                    <Text style={ui.btnSecondaryText}>Back To Menu</Text>
                  </TouchableOpacity>
                </BlurPanel>
              </View>
            </ScreenContainer>
          )
        )}
        {menuVisible && screen === "game" && (
          <GameScreen 
            key={gameInstanceKey}
            initialLobbyPlayers={lobbyMembers ?? undefined}
            dealSeed={dealSeed}
            localPlayerName={localPlayerName ?? undefined}
            localPlayerId={localPlayerId ?? undefined}
            adapter={
              isOnlineGame && roomAdapter
                ? roomAdapter
                : localAdapter ?? undefined
            }
            roomId={activeRoomId ?? joinedRoomId ?? undefined}
            isSpectator={isOnlineGame && isSpectator}
            onNavigateToAchievements={openAchievements}
            onNavigateToReadMe={openReadMe}
            onNavigateToSettings={openSettings}
            onPlaySound={playGameSound}
            onBack={() => {
              if (isOnlineGame && activeRoomId && roomAdapter) {
                roomAdapter.leaveRoom(activeRoomId);
              }
              disconnectRoom();
              setIsOnlineGame(false);
              setLobbyMembers(null);
              setLocalAdapter(null);
              setScreen("menu");
            }}
          />
        )}
        {menuVisible && settingsOpen && (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <Settings
                onWallpaperPreview={setFeltTint}
                onWallpaperChange={async () => {
                  reloadWallpaper();
                  const tint = (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
                  const roomId = activeRoomIdRef.current ?? joinedRoomIdRef.current;
                  if (
                    roomAdapter &&
                    isSocketAdapter(roomAdapter) &&
                    roomId &&
                    roomAdapter.isConnected()
                  ) {
                    roomAdapter.updatePlayerTheme(roomId, tint);
                  }
                }}
                onBack={closeSettings}
                soundMuted={muted}
                onToggleSoundMute={() => {
                  void toggleMute();
                }}
                onNameSaved={(name) => {
                  setLocalPlayerName(name);
                  const roomId = activeRoomIdRef.current ?? joinedRoomIdRef.current;
                  if (
                    roomAdapter &&
                    isSocketAdapter(roomAdapter) &&
                    roomId &&
                    roomAdapter.isConnected()
                  ) {
                    roomAdapter.updatePlayerName(roomId, name);
                  }
                }}
                onProfileSynced={() => {
                  setHubRefreshKey((k) => k + 1);
                }}
                onSkipDealAnimationsChange={(value) => {
                  const roomId = activeRoomIdRef.current ?? joinedRoomIdRef.current;
                  if (
                    roomAdapter &&
                    isSocketAdapter(roomAdapter) &&
                    roomId &&
                    roomAdapter.isConnected()
                  ) {
                    roomAdapter.updateRoomOptions(roomId, {
                      skipDealAnimations: value,
                    });
                  }
                }}
              />
            </View>
          </WebModalPortal>
        )}
        {menuVisible && titlesOpen && (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <Titles onBack={closeTitles} />
            </View>
          </WebModalPortal>
        )}
        {menuVisible && achievementsOpen && (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <Achievements
                onBack={closeAchievements}
                onNavigateToSettings={() => {
                  closeAchievements();
                  openSettings();
                }}
              />
            </View>
          </WebModalPortal>
        )}
        {menuVisible && updateLogOpen && (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <UpdateLog onBack={closeUpdateLog} onViewed={markUpdateLogSeen} />
            </View>
          </WebModalPortal>
        )}
        {menuVisible && readmeOpen && (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <FullscreenBlurScrim />
            <View style={appStyles.settingsForeground}>
              <ReadMeScreen onBack={closeReadMe} />
            </View>
          </WebModalPortal>
        )}
        {showUpdateOverlay ? (
          <WebModalPortal style={appStyles.settingsOverlay}>
            <UpdateRequiredOverlay
              latestBuild={latestBuild}
              onDismiss={() =>
                setUpdateDismissedBuildId(latestBuild?.buildId ?? "dismissed")
              }
            />
          </WebModalPortal>
        ) : null}
        </View>
    </View>
    {menuVisible && !splashVisible ? (
      <AdsConsentBanner onOpenPrivacy={() => setPrivacyOpen(true)} />
    ) : null}
    <PrivacyPolicyModal
      visible={privacyOpen}
      onClose={() => setPrivacyOpen(false)}
    />
    {ViewportDebugOverlay ? <ViewportDebugOverlay /> : null}
    </>
  );
}

export default function App() {
  const { ready: fontsReady } = useAppFonts();

  if (!fontsReady) {
    return (
      <SafeAreaProvider>
        <View style={[appStyles.fontBoot, Platform.OS === "web" && appStyles.webFontBoot]} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CardAppearanceProvider>
          <AppErrorBoundary>
            <PhonePortraitLock>
              <AppContent />
            </PhonePortraitLock>
          </AppErrorBoundary>
        </CardAppearanceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  fontBoot: {
    flex: 1,
    backgroundColor: DEFAULT_FELT_COLOR,
  },
  webFontBoot: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
  } as object,
  appContent: {
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: MODAL_OVERLAY_Z,
    elevation: MODAL_OVERLAY_Z,
  },
  settingsForeground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  rejoinBanner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 20,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejoinTitle: {
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 4,
  },
  rejoinBody: {
    fontSize: 12,
    marginBottom: 10,
  },
  rejoinActions: {
    flexDirection: "row",
    gap: 8,
  },
  rejoinPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejoinPrimaryText: {
    fontWeight: "800",
    fontSize: 13,
  },
  rejoinSecondary: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejoinSecondaryText: {
    fontWeight: "700",
    fontSize: 13,
  },
});