import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  useWindowDimensions,
  Switch,
  Platform,
  Linking,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import FeltColorPicker from "../components/FeltColorPicker";
import MenuIcon from "../components/MenuIcon";
import AddToHomeScreenModal from "../components/AddToHomeScreenModal";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import { resolvePrivacyUrl } from "../config/privacyUrl";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useGamePreferences } from "../hooks/useGamePreferences";
import { playerInitials } from "../utils/playerDisplay";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import { type AppearancePreference } from "../services/themePreferences";
import {
  DEFAULT_FELT_COLOR,
  FELT_PRESETS,
  getWallpaperTint,
  normalizeHexColor,
  setWallpaperTint,
} from "../services/wallpaper";
import {
  cachePlayerName,
  getOrCreatePlayerId,
  type PlayerInfo,
} from "../services/gameCenter";
import { markDisplayNameChosen } from "../services/playerDisplayName";
import {
  getGoogleAccountSyncStatus,
  getGoogleSignInButtonLabel,
  isGoogleAccountSyncOffered,
  linkGoogleAccountAndSync,
  pushLinkedCloudSnapshot,
} from "../services/googleAccountSync";
import { getDisplayNameInputProps } from "../utils/displayNameInputProps";
import { getLobbySession } from "../services/lobbySession";
import { getPlayerStats } from "../services/playerStats";
import { levelFromXp } from "../services/playerLevel";
import { fetchCloudPlayerRecord } from "../services/playerStatsCloud";
import { validateDisplayText, isValidDisplayText } from "../utils/profanityFilter";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import Card from "../components/Card";
import type { Card as CardType } from "../game/ruleset";
import { useWebAppInstall } from "../hooks/useWebAppInstall";
import { SHOW_REMOVE_ADS_PURCHASE } from "../services/ads/adsConfig";

const CARD_PREVIEW_W = 54;
const CARD_PREVIEW_H = 78;

const CARD_PREVIEW_SAMPLES: CardType[] = [
  { suit: "spades", value: 14 },
  { suit: "hearts", value: 13 },
  { suit: "clubs", value: 10 },
];

export default function Settings({
  onWallpaperPreview,
  onWallpaperChange,
  onBack,
  onNameSaved,
  onProfileSynced,
  onSkipDealAnimationsChange,
  soundMuted,
  onToggleSoundMute,
}: {
  onWallpaperPreview?: (tint: string) => void;
  onWallpaperChange?: () => void;
  onBack?: () => void;
  onNameSaved?: (name: string) => void | Promise<void>;
  /** Called after Google sync updates local stats/theme so the hub can refresh. */
  onProfileSynced?: () => void;
  onSkipDealAnimationsChange?: (value: boolean) => void;
  soundMuted?: boolean;
  onToggleSoundMute?: () => void;
}) {
  const {
    colors,
    ui,
    palette,
    appearancePreference,
    setAppearancePreference,
    setTextContrastPreference,
    setFeltTint,
  } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { skipDealAnimations, setSkipDealAnimations, darkModeCards, setDarkModeCards } =
    useGamePreferences();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [previewTint, setPreviewTint] = useState(DEFAULT_FELT_COLOR);
  const [feltPickerOpen, setFeltPickerOpen] = useState(false);
  const [onlineGuest, setOnlineGuest] = useState(false);
  const [addToHomeOpen, setAddToHomeOpen] = useState(false);
  const {
    showOffer: showAddToHomeOffer,
    inAppBrowser,
    installButtonLabel,
    requestInstall,
  } = useWebAppInstall();
  const [addToHomeWorking, setAddToHomeWorking] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [careerXp, setCareerXp] = useState(0);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const googleStatus = getGoogleAccountSyncStatus();
  const googleReady = googleStatus === "ready";
  const googleLinked = !!playerInfo?.linkedAccountId?.startsWith("google:");
  const careerLevel = levelFromXp(careerXp);

  useEffect(() => {
    void getLobbySession().then((session) => {
      setOnlineGuest(!!session && !session.isHost);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const { preloadAdsEntitlement, areForcedAdsRemoved } = await import(
        "../services/ads/adsEntitlement"
      );
      await preloadAdsEntitlement();
      setAdsRemoved(await areForcedAdsRemoved());
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const [info, tint, stats] = await Promise.all([
        getOrCreatePlayerId(),
        getWallpaperTint(),
        getPlayerStats(),
      ]);
      setPlayerInfo(info);
      setPlayerName(info.displayName);
      setSavedName(info.displayName);
      setCareerXp(stats.xp ?? 0);
      const resolvedTint = tint ?? DEFAULT_FELT_COLOR;
      setPreviewTint(resolvedTint);
    })();
  }, []);

  // Pull cloud career when opening Settings on a Google-linked install.
  useEffect(() => {
    if (!googleLinked) return;
    let cancelled = false;
    void (async () => {
      try {
        const { resetPlayerStatsRestore, ensurePlayerStatsRestored } =
          await import("../services/playerStats");
        resetPlayerStatsRestore();
        await ensurePlayerStatsRestored();
        if (cancelled) return;
        const info = await getOrCreatePlayerId();
        const stats = await getPlayerStats();
        setPlayerInfo(info);
        setPlayerName(info.displayName);
        setSavedName(info.displayName);
        setCareerXp(stats.xp ?? 0);
        const tint = (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
        setPreviewTint(tint);
        setFeltTint(tint);
        onWallpaperPreview?.(tint);
        onProfileSynced?.();
      } catch {
        // Sync now can retry
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pull once per linked id
  }, [googleLinked]);

  const previewTintNormalized = (previewTint ?? DEFAULT_FELT_COLOR).toLowerCase();
  const nameDirty = playerName.trim() !== savedName.trim();

  const handleSaveName = async (): Promise<boolean> => {
    if (!nameDirty) return true;
    const check = validateDisplayText(playerName, "Player name");
    if (!isValidDisplayText(check)) {
      Alert.alert("Not Allowed", check.reason);
      return false;
    }

    try {
      await cachePlayerName(check.value);
      await markDisplayNameChosen();
      setSavedName(check.value);
      setPlayerName(check.value);
      if (playerInfo) {
        setPlayerInfo({ ...playerInfo, displayName: check.value });
      }
      await onNameSaved?.(check.value);
      if (playerInfo?.linkedAccountId?.startsWith("google:")) {
        void pushLinkedCloudSnapshot();
      }
      return true;
    } catch (error) {
      console.error("[Settings] Failed to save name:", error);
      Alert.alert("Error", "Failed to save name. Please try again.");
      return false;
    }
  };

  const persistFeltColor = async (hex: string) => {
    await setWallpaperTint(hex);
    onWallpaperChange?.();
    if (playerInfo?.linkedAccountId?.startsWith("google:")) {
      void pushLinkedCloudSnapshot();
    }
  };

  const updatePreview = (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    setPreviewTint(normalized);
    setFeltTint(normalized);
    onWallpaperPreview?.(normalized);
    void persistFeltColor(normalized);
  };

  const handleBack = async () => {
    if (!(await handleSaveName())) return;
    onBack?.();
  };

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentMax }]}>
          <ScreenTopBar title="Settings" />

          <BlurPanel style={ui.panel} intensity={52}>
            <Text style={ui.panelEyebrow}>Player Profile</Text>

            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {playerInitials(savedName || playerName || "?")}
                </Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {savedName || "Player"}
                </Text>
                <Text style={styles.profileHint}>
                  {googleLinked ? "Google linked" : "Local profile"}
                </Text>
                <Text style={styles.profileCareer}>
                  Level {careerLevel} · {(careerXp ?? 0).toLocaleString()} XP
                </Text>
              </View>
            </View>

            <Text style={ui.fieldLabel}>Display Name</Text>
            <TextInput
              style={[ui.input, { marginBottom: 12 }]}
              value={playerName}
              onChangeText={setPlayerName}
              onBlur={() => void handleSaveName()}
              onSubmitEditing={() => void handleSaveName()}
              placeholder="Enter Your Name"
              placeholderTextColor={colors.textQuaternary}
              maxLength={20}
              returnKeyType="done"
              {...getDisplayNameInputProps("ps-and-as-display-name-settings")}
            />
            <Text style={styles.autoSaveHint}>Changes save automatically.</Text>
            {Platform.OS === "web" && isGoogleAccountSyncOffered() ? (
              <View style={styles.googleSyncBlock}>
                {googleLinked ? (
                  <>
                    <Text style={styles.accountSyncHint}>
                      Google linked — name, stats, and theme sync across
                      devices.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        styles.saveBtnActive,
                        { marginTop: 12 },
                        googleBusy && { opacity: 0.6 },
                      ]}
                      disabled={googleBusy}
                      onPress={() => {
                        void (async () => {
                          setGoogleBusy(true);
                          try {
                            const {
                              resetPlayerStatsRestore,
                              ensurePlayerStatsRestored,
                            } = await import("../services/playerStats");
                            const {
                              getAppearancePreference,
                              getTextContrastPreference,
                            } = await import("../services/themePreferences");
                            const linkedId = playerInfo?.linkedAccountId;
                            const cloudBefore = linkedId
                              ? await fetchCloudPlayerRecord(linkedId)
                              : null;
                            const cloudXp = cloudBefore?.stats?.xp ?? 0;
                            const localBefore = await getPlayerStats();

                            resetPlayerStatsRestore();
                            await ensurePlayerStatsRestored();
                            const info = await getOrCreatePlayerId();
                            setPlayerInfo(info);
                            setPlayerName(info.displayName);
                            setSavedName(info.displayName);
                            await onNameSaved?.(info.displayName);
                            const tint =
                              (await getWallpaperTint()) ?? DEFAULT_FELT_COLOR;
                            setPreviewTint(tint);
                            setFeltTint(tint);
                            onWallpaperPreview?.(tint);
                            await setAppearancePreference(
                              await getAppearancePreference(),
                            );
                            await setTextContrastPreference(
                              await getTextContrastPreference(),
                            );
                            const ok = await pushLinkedCloudSnapshot({
                              interactive: true,
                            });
                            const after = await getPlayerStats();
                            setCareerXp(after.xp ?? 0);
                            onProfileSynced?.();
                            if (!ok) {
                              Alert.alert(
                                "Google sync",
                                "Could not save to the server. Sign in again when prompted, or try once more.",
                              );
                              return;
                            }
                            const afterLevel = levelFromXp(after.xp ?? 0);
                            if (cloudXp <= 0 && (localBefore.xp ?? 0) < 500) {
                              Alert.alert(
                                "Google sync",
                                `This device is Level ${afterLevel} (${(after.xp ?? 0).toLocaleString()} XP).\n\nCloud had no career yet. On your Level 20 device, open Settings → Sync now first, then sync here again.`,
                              );
                            } else {
                              Alert.alert(
                                "Google sync",
                                `Synced — Level ${afterLevel} · ${(after.xp ?? 0).toLocaleString()} XP` +
                                  (cloudXp > 0
                                    ? `\n(Cloud had ${cloudXp.toLocaleString()} XP)`
                                    : ""),
                              );
                            }
                          } catch (err) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : "Sync failed";
                            Alert.alert("Google sync", message);
                          } finally {
                            setGoogleBusy(false);
                          }
                        })();
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.saveBtnText, styles.saveBtnTextActive]}
                      >
                        {googleBusy ? "Syncing…" : "Sync now"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : googleReady ? (
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      styles.saveBtnActive,
                      { marginTop: 12 },
                      googleBusy && { opacity: 0.6 },
                    ]}
                    disabled={googleBusy}
                    onPress={() => {
                      void (async () => {
                        setGoogleBusy(true);
                        try {
                          const result = await linkGoogleAccountAndSync({
                            preferredDisplayName: playerName.trim() || null,
                          });
                          const info = await getOrCreatePlayerId();
                          setPlayerInfo(info);
                          if (result.displayName) {
                            setPlayerName(result.displayName);
                            setSavedName(result.displayName);
                            await onNameSaved?.(result.displayName);
                          }
                          if (result.appearance) {
                            await setAppearancePreference(result.appearance);
                          }
                          if (result.textContrast) {
                            await setTextContrastPreference(result.textContrast);
                          }
                          if (result.feltTint) {
                            const tint = result.feltTint;
                            setPreviewTint(tint);
                            setFeltTint(tint);
                            onWallpaperPreview?.(tint);
                          }
                          const stats = await getPlayerStats();
                          setCareerXp(stats.xp ?? 0);
                          onProfileSynced?.();
                          Alert.alert(
                            "Google sync",
                            `Linked — Level ${levelFromXp(stats.xp ?? 0)} · ${(stats.xp ?? 0).toLocaleString()} XP`,
                          );
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : "Google link failed";
                          if (!/cancelled/i.test(message)) {
                            Alert.alert("Google sync", message);
                          }
                        } finally {
                          setGoogleBusy(false);
                        }
                      })();
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.saveBtnText, styles.saveBtnTextActive]}>
                      {googleBusy
                        ? "Connecting…"
                        : getGoogleSignInButtonLabel(googleStatus)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.accountSyncHint}>
                    Google sync coming soon — keeps your name, stats, and theme
                    across devices.
                  </Text>
                )}
              </View>
            ) : null}
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Support</Text>
            <Text style={styles.tintHint}>
              Ads help cover servers. Forced ads appear every few rounds; you can
              optionally watch an ad for XP.
              {SHOW_REMOVE_ADS_PURCHASE
                ? " Remove Ads skips forced ads only."
                : " Optional Ko-fi contributions are on the home screen."}
            </Text>
            {adsRemoved ? (
              <Text style={styles.accountSyncHint}>
                Forced ads removed — thanks for supporting the game.
              </Text>
            ) : SHOW_REMOVE_ADS_PURCHASE && Platform.OS === "web" ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    styles.saveBtnActive,
                    purchaseBusy && { opacity: 0.6 },
                  ]}
                  disabled={purchaseBusy}
                  onPress={() => {
                    void (async () => {
                      if (!googleLinked) {
                        Alert.alert(
                          "Link Google first",
                          "Remove Ads requires a Google-linked account so your purchase restores on other devices.",
                        );
                        return;
                      }
                      setPurchaseBusy(true);
                      try {
                        const { createRemoveAdsCheckoutSession } = await import(
                          "../services/ads/removeAdsPurchase"
                        );
                        const result = await createRemoveAdsCheckoutSession();
                        if (!result.ok) {
                          const msg =
                            result.error === "billing_not_configured" ||
                            result.error === "http_503"
                              ? "Purchases are not configured on the server yet."
                              : result.error === "google_required"
                                ? "Link Google first, then try again."
                                : "Could not start checkout. Try again later.";
                          Alert.alert("Remove Ads", msg);
                          return;
                        }
                        if (typeof window !== "undefined") {
                          window.location.assign(result.url);
                        }
                      } catch {
                        Alert.alert("Remove Ads", "Checkout failed.");
                      } finally {
                        setPurchaseBusy(false);
                      }
                    })();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove forced ads for 19 New Zealand dollars"
                >
                  <Text style={[styles.saveBtnText, styles.saveBtnTextActive]}>
                    {purchaseBusy
                      ? "Opening checkout…"
                      : "Remove forced ads — NZ$19"}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.autoSaveHint, { marginTop: 8 }]}>
                  One-time purchase via Stripe. Rewarded watch-for-XP stays
                  available.
                </Text>
              </>
            ) : SHOW_REMOVE_ADS_PURCHASE ? (
              <Text style={styles.accountSyncHint}>
                Remove Ads is available on the web version.
              </Text>
            ) : null}
            <TouchableOpacity
              style={{ marginTop: 12 }}
              onPress={() => setPrivacyOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.linkLike}>Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 8 }}
              onPress={() => {
                void Linking.openURL(resolvePrivacyUrl());
              }}
              accessibilityRole="link"
            >
              <Text style={styles.linkLike}>Full privacy policy</Text>
            </TouchableOpacity>
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Appearance</Text>
            <Text style={styles.tintHint}>
              Choose light or dark panels, or follow your device setting.
            </Text>
            <SegmentControl
              options={[
                { id: "system", label: "System" },
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
              value={appearancePreference}
              onChange={(value) => {
                void (async () => {
                  await setAppearancePreference(value as AppearancePreference);
                  if (playerInfo?.linkedAccountId?.startsWith("google:")) {
                    void pushLinkedCloudSnapshot();
                  }
                })();
              }}
              colors={colors}
            />

            <View style={styles.paletteRow}>
              {[
                { label: "Felt", color: palette.feltSurface },
                { label: "Accent", color: palette.complement },
                { label: "Highlight", color: palette.complementBright },
              ].map((swatch) => (
                <View key={swatch.label} style={styles.paletteItem}>
                  <View
                    style={[styles.paletteSwatch, { backgroundColor: swatch.color }]}
                  />
                  <Text style={styles.paletteLabel}>{swatch.label}</Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.textPreview,
                { backgroundColor: previewTintNormalized },
              ]}
            >
              <Text
                style={[
                  styles.textPreviewTitle,
                  onFeltTextStyle(colors.onFelt, "primary", {
                    fontSize: 22,
                    fontWeight: "800",
                    marginBottom: 4,
                  }),
                ]}
              >
                P&apos;s & A&apos;s
              </Text>
              <Text
                style={[
                  styles.textPreviewSubtitle,
                  onFeltTextStyle(colors.onFelt, "accent", {
                    fontSize: 13,
                    fontWeight: "700",
                    marginBottom: 6,
                  }),
                ]}
              >
                Accent highlight
              </Text>
              <Text
                style={[
                  styles.textPreviewBody,
                  onFeltTextStyle(colors.onFelt, "muted", {
                    fontSize: 12,
                    fontWeight: "600",
                  }),
                ]}
              >
                Muted body text preview
              </Text>
            </View>

            <View style={styles.appearanceSubsection}>
              <Text style={styles.subsectionEyebrow}>Felt tint</Text>
              <Text style={styles.tintHint}>
                Changes preview and save automatically.
              </Text>
              <View style={styles.swatchRow}>
                {FELT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.hex}
                    onPress={() => {
                      setFeltPickerOpen(false);
                      updatePreview(preset.hex);
                    }}
                    accessibilityLabel={preset.name}
                    style={[
                      styles.swatch,
                      { backgroundColor: preset.hex },
                      previewTintNormalized === preset.hex &&
                        !feltPickerOpen &&
                        styles.swatchSelected,
                    ]}
                  />
                ))}
                <TouchableOpacity
                  style={[
                    styles.swatch,
                    styles.pickerSwatch,
                    feltPickerOpen && styles.swatchSelected,
                    feltPickerOpen && styles.pickerSwatchActive,
                  ]}
                  onPress={() => setFeltPickerOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Custom felt color picker"
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.pickerSwatchFill,
                      { backgroundColor: previewTintNormalized },
                    ]}
                  />
                  <MenuIcon
                    name="palette"
                    size={18}
                    color={feltPickerOpen ? colors.textOnAccent : colors.accent}
                  />
                </TouchableOpacity>
              </View>
              {feltPickerOpen ? (
                <FeltColorPicker
                  value={previewTint}
                  onChange={updatePreview}
                  colors={colors}
                />
              ) : null}
              <TouchableOpacity
                style={[ui.btnGhost, { marginTop: 10 }]}
                onPress={() => setFeltPickerOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel="Customise Theme"
              >
                <View style={styles.customiseThemeRow}>
                  <MenuIcon
                    name="palette"
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={ui.btnGhostText}>Customise Theme</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingBlock, styles.settingRowSpaced]}>
              <View style={styles.settingHeaderRow}>
                <Text style={[styles.settingLabel, styles.settingLabelInline]}>
                  Dark mode cards
                </Text>
                <View style={styles.settingHeaderSpacer} />
                <Switch
                  value={darkModeCards}
                  onValueChange={(value) => void setDarkModeCards(value)}
                  trackColor={{
                    false: colors.panelBorder,
                    true: colors.accent,
                  }}
                  thumbColor={colors.mode === "light" ? "#ffffff" : colors.textPrimary}
                  accessibilityLabel="Dark mode cards"
                />
              </View>
              <Text style={[styles.tintHint, styles.settingHint]}>
                Dark card faces with white spades and clubs.
              </Text>
            </View>
            <View
              style={[
                styles.cardPreviewHost,
                { backgroundColor: previewTintNormalized },
              ]}
            >
              <Text
                style={[
                  styles.cardPreviewLabel,
                  onFeltTextStyle(colors.onFelt, "muted", {
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }),
                ]}
              >
                Card preview
              </Text>
              <View style={styles.cardPreviewRow}>
                {CARD_PREVIEW_SAMPLES.map((sample) => (
                  <Card
                    key={`${sample.suit}-${sample.value}`}
                    card={sample}
                    selected={false}
                    onPress={() => {}}
                    variant="table"
                    style={{ width: CARD_PREVIEW_W, height: CARD_PREVIEW_H }}
                  />
                ))}
              </View>
            </View>
          </BlurPanel>

          {Platform.OS === "web" && showAddToHomeOffer ? (
            <BlurPanel style={ui.panel} intensity={48}>
              <Text style={ui.panelEyebrow}>
                {inAppBrowser ? "Mobile browser" : "Full screen"}
              </Text>
              <Text style={styles.tintHint}>
                {inAppBrowser
                  ? "You're in Instagram's (or another app's) built-in browser. Tap ⋯ in the top right, choose Open in browser, then play from Safari or Chrome."
                  : "Add the game to your home screen for full-screen play without the browser toolbar. Use Share or your browser menu, then Add to Home Screen."}
              </Text>
              <TouchableOpacity
                style={[styles.saveBtn, styles.saveBtnActive, { marginTop: 12 }]}
                onPress={() => {
                  void (async () => {
                    setAddToHomeWorking(true);
                    try {
                      const result = await requestInstall();
                      if (result === "manual") setAddToHomeOpen(true);
                    } finally {
                      setAddToHomeWorking(false);
                    }
                  })();
                }}
                disabled={addToHomeWorking}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, styles.saveBtnTextActive]}>
                  {addToHomeWorking ? "Opening…" : installButtonLabel}
                </Text>
              </TouchableOpacity>
            </BlurPanel>
          ) : null}

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Gameplay</Text>
            <View style={styles.settingBlock}>
              <View style={styles.settingHeaderRow}>
                <Text style={[styles.settingLabel, styles.settingLabelInline]}>
                  Enable Deal Animations
                </Text>
                <View style={styles.settingHeaderSpacer} />
                <Text style={styles.betaWarning}>Beta</Text>
                <Switch
                  value={!skipDealAnimations}
                  onValueChange={(enabled) => {
                    void setSkipDealAnimations(!enabled);
                    onSkipDealAnimationsChange?.(!enabled);
                  }}
                  disabled={onlineGuest}
                  trackColor={{
                    false: colors.panelBorder,
                    true: colors.accent,
                  }}
                  thumbColor={colors.mode === "light" ? "#ffffff" : colors.textPrimary}
                  accessibilityLabel="Enable deal animations"
                />
              </View>
              <Text style={[styles.tintHint, styles.settingHint]}>
                {onlineGuest
                  ? "Controlled by the host in online games."
                  : "Shuffle and deal animations are experimental. Off by default."}
              </Text>
            </View>
            {onToggleSoundMute ? (
              <View style={[styles.settingBlock, styles.settingRowSpaced]}>
                <View style={styles.settingHeaderRow}>
                  <Text style={[styles.settingLabel, styles.settingLabelInline]}>
                    Sound effects
                  </Text>
                  <View style={styles.settingHeaderSpacer} />
                  <Switch
                    value={!(soundMuted ?? false)}
                    onValueChange={() => onToggleSoundMute()}
                    trackColor={{
                      false: colors.panelBorder,
                      true: colors.accent,
                    }}
                    thumbColor={
                      colors.mode === "light" ? "#ffffff" : colors.textPrimary
                    }
                    accessibilityLabel="Sound effects"
                  />
                </View>
                <Text style={[styles.tintHint, styles.settingHint]}>
                  Card taps, plays, passes, and your-turn cues.
                </Text>
              </View>
            ) : null}
          </BlurPanel>
        </View>
      </ScrollView>

      {onBack ? (
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <View style={{ width: contentMax, alignSelf: "center" }}>
              <BottomBarLeave onPress={() => void handleBack()} label="Back" />
            </View>
          </BottomBarControls>
        </BottomBar>
      ) : null}
      <AddToHomeScreenModal
        visible={addToHomeOpen}
        onClose={() => setAddToHomeOpen(false)}
      />
      <PrivacyPolicyModal
        visible={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </ScreenContainer>
  );
}

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const styles = useMemo(() => createSegmentStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(option.id)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createSegmentStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
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
  scroll: { flex: 1 },
  content: { width: "100%" },
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
  profileCareer: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "700",
  },
  autoSaveHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  accountSyncHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  linkLike: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  googleSyncBlock: {
    marginTop: 4,
  },
  saveBtn: {
    borderRadius: 12,
    minHeight: 44,
    backgroundColor: colors.btnSecondaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    ...BUTTON_CENTER,
  },
  saveBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  saveBtnText: buttonLabel(14, {
    color: colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0.2,
  }),
  saveBtnTextActive: {
    color: colors.textOnAccent,
  },
  tintHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  settingRowSpaced: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelBorder,
  },
  appearanceSubsection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelBorder,
  },
  subsectionEyebrow: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  settingBlock: {
    gap: 4,
  },
  settingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingHeaderSpacer: {
    flex: 1,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  settingLabelInline: {
    marginBottom: 0,
    flexShrink: 1,
  },
  betaWarning: {
    color: "#e53935",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 0,
  },
  settingHint: {
    marginBottom: 0,
  },
  cardPreviewHost: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    alignItems: "center",
  },
  cardPreviewLabel: {
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  cardPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  textPreview: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  textPreviewTitle: {},
  textPreviewSubtitle: {},
  textPreviewBody: {},
  paletteRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  paletteItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  paletteSwatch: {
    width: "100%",
    height: 28,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  paletteLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    marginBottom: 12,
  },
  swatch: {
    flex: 1,
    aspectRatio: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: colors.textPrimary,
  },
  pickerSwatch: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.btnSecondaryBg,
    borderColor: colors.panelBorder,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  pickerSwatchActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pickerSwatchFill: {
    position: "absolute",
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: 8,
    opacity: 0.45,
  },
  customiseThemeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },
  });
}
