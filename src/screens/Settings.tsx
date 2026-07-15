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
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import FeltColorPicker from "../components/FeltColorPicker";
import MenuIcon from "../components/MenuIcon";
import AddToHomeScreenModal from "../components/AddToHomeScreenModal";
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
import { getLobbySession } from "../services/lobbySession";
import { validateDisplayText, isValidDisplayText } from "../utils/profanityFilter";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";
import Card from "../components/Card";
import type { Card as CardType } from "../game/ruleset";
import { useWebAppInstall } from "../hooks/useWebAppInstall";

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
  onSkipDealAnimationsChange,
}: {
  onWallpaperPreview?: (tint: string) => void;
  onWallpaperChange?: () => void;
  onBack?: () => void;
  onNameSaved?: (name: string) => void | Promise<void>;
  onSkipDealAnimationsChange?: (value: boolean) => void;
}) {
  const {
    colors,
    ui,
    palette,
    appearancePreference,
    setAppearancePreference,
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
  const [hexInput, setHexInput] = useState("");
  const [feltPickerOpen, setFeltPickerOpen] = useState(false);
  const [onlineGuest, setOnlineGuest] = useState(false);
  const [addToHomeOpen, setAddToHomeOpen] = useState(false);
  const { showOffer: showAddToHomeOffer, installButtonLabel, requestInstall } =
    useWebAppInstall();
  const [addToHomeWorking, setAddToHomeWorking] = useState(false);

  useEffect(() => {
    void getLobbySession().then((session) => {
      setOnlineGuest(!!session && !session.isHost);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const [info, tint] = await Promise.all([
        getOrCreatePlayerId(),
        getWallpaperTint(),
      ]);
      setPlayerInfo(info);
      setPlayerName(info.displayName);
      setSavedName(info.displayName);
      const resolvedTint = tint ?? DEFAULT_FELT_COLOR;
      setPreviewTint(resolvedTint);
      setHexInput(resolvedTint.replace(/^#/, "").slice(0, 6));
    })();
  }, []);

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
      setSavedName(check.value);
      setPlayerName(check.value);
      if (playerInfo) {
        setPlayerInfo({ ...playerInfo, displayName: check.value });
      }
      await onNameSaved?.(check.value);
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
  };

  const updatePreview = (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    setPreviewTint(normalized);
    setHexInput(normalized.replace(/^#/, ""));
    setFeltTint(normalized);
    onWallpaperPreview?.(normalized);
    void persistFeltColor(normalized);
  };

  const handleResetFeltColor = async () => {
    await setWallpaperTint(null);
    setPreviewTint(DEFAULT_FELT_COLOR);
    setHexInput(DEFAULT_FELT_COLOR.replace(/^#/, ""));
    onWallpaperPreview?.(DEFAULT_FELT_COLOR);
    setFeltTint(DEFAULT_FELT_COLOR);
    onWallpaperChange?.();
  };

  const handleHexInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexInput(cleaned);
    const normalized = normalizeHexColor(cleaned);
    if (normalized) {
      setPreviewTint(normalized);
      setFeltTint(normalized);
      onWallpaperPreview?.(normalized);
      void persistFeltColor(normalized);
    }
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
                  {playerInfo?.isAuthenticated ? "Game Center" : "Local Profile"}
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
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Text style={styles.autoSaveHint}>Changes save automatically.</Text>
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
              onChange={(value) => void setAppearancePreference(value as AppearancePreference)}
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
                    onPress={() => updatePreview(preset.hex)}
                    accessibilityLabel={preset.name}
                    style={[
                      styles.swatch,
                      { backgroundColor: preset.hex },
                      previewTintNormalized === preset.hex && styles.swatchSelected,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.hexInputRow}>
                <View style={styles.hexInputWrap}>
                  <Text style={styles.hexPrefix}>#</Text>
                  <TextInput
                    placeholder="rrggbb"
                    placeholderTextColor={colors.textMuted}
                    value={hexInput}
                    onChangeText={handleHexInputChange}
                    style={[ui.input, styles.hexInputField]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={6}
                    keyboardType="default"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.pickerToggle,
                    feltPickerOpen && styles.pickerToggleActive,
                  ]}
                  onPress={() => setFeltPickerOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Open felt color picker"
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.pickerToggleSwatch,
                      { backgroundColor: previewTintNormalized },
                    ]}
                  />
                  <MenuIcon
                    name="palette"
                    size={18}
                    color={feltPickerOpen ? colors.textOnGold : colors.gold}
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
                onPress={() => void handleResetFeltColor()}
              >
                <Text style={ui.btnGhostText}>Reset Felt Color</Text>
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
                    true: colors.gold,
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
              <Text style={ui.panelEyebrow}>Full screen</Text>
              <Text style={styles.tintHint}>
                Add the game to your homescreen for full-screen play without the browser toolbar taking up space.
                Use the Share button from the toolbar, or menu button and choose Add to Home screen.
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
                  Skip deal animations
                </Text>
                <View style={styles.settingHeaderSpacer} />
                <Text style={styles.betaWarning}>Warning: Beta</Text>
                <Switch
                  value={skipDealAnimations}
                  onValueChange={(value) => {
                    void setSkipDealAnimations(value);
                    onSkipDealAnimationsChange?.(value);
                  }}
                  disabled={onlineGuest}
                  trackColor={{
                    false: colors.panelBorder,
                    true: colors.gold,
                  }}
                  thumbColor={colors.mode === "light" ? "#ffffff" : colors.textPrimary}
                  accessibilityLabel="Skip deal animations"
                />
              </View>
              <Text style={[styles.tintHint, styles.settingHint]}>
                {onlineGuest
                  ? "Controlled by the host in online games."
                  : "Skip the shuffle and deal — President/Asshole trades still play out."}
              </Text>
            </View>
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
      backgroundColor: colors.btnGoldBg,
      borderColor: colors.btnGoldBorder,
    },
    segmentText: buttonLabel(13, {
      color: colors.textMuted,
      fontWeight: "700",
    }),
    segmentTextSelected: {
      color: colors.btnGoldText,
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
    backgroundColor: colors.btnGoldBg,
    borderWidth: 2,
    borderColor: colors.btnGoldBorder,
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
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  autoSaveHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
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
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  saveBtnText: buttonLabel(14, {
    color: colors.textMuted,
    fontWeight: "800",
    letterSpacing: 0.2,
  }),
  saveBtnTextActive: {
    color: colors.textOnGold,
  },
  tintHint: {
    color: colors.textMuted,
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
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: colors.textPrimary,
  },
  hexInputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  hexInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  pickerToggle: {
    width: 52,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    backgroundColor: colors.btnSecondaryBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  pickerToggleActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  pickerToggleSwatch: {
    width: 22,
    height: 14,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  hexPrefix: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 2,
  },
  hexInputField: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  });
}
