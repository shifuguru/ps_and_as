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
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import BlurPanel from "../components/BlurPanel";
import ScreenTopBar from "../components/ScreenTopBar";
import FeltColorPicker from "../components/FeltColorPicker";
import MenuIcon from "../components/MenuIcon";
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { playerInitials } from "../utils/playerDisplay";
import { contentMaxWidth } from "../styles/uiStandards";
import { useAppTheme } from "../context/ThemeContext";
import {
  type AppearancePreference,
  type TextContrastPreference,
} from "../services/themePreferences";
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
import { validateDisplayText, displayTextError, isValidDisplayText } from "../utils/profanityFilter";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { BUTTON_CENTER, buttonLabel } from "../styles/buttonStyles";

export default function Settings({
  onWallpaperPreview,
  onWallpaperChange,
  onBack,
  onNameSaved,
}: {
  onWallpaperPreview?: (tint: string) => void;
  onWallpaperChange?: () => void;
  onBack?: () => void;
  onNameSaved?: (name: string) => void | Promise<void>;
}) {
  const {
    colors,
    ui,
    palette,
    appearancePreference,
    textContrastPreference,
    setAppearancePreference,
    setTextContrastPreference,
    setFeltTint,
  } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saveFlash, setSaveFlash] = useState(false);
  const [feltSaveFlash, setFeltSaveFlash] = useState(false);
  const [saveAllFlash, setSaveAllFlash] = useState(false);
  const [savedTint, setSavedTint] = useState(DEFAULT_FELT_COLOR);
  const [previewTint, setPreviewTint] = useState(DEFAULT_FELT_COLOR);
  const [hexInput, setHexInput] = useState("");
  const [feltPickerOpen, setFeltPickerOpen] = useState(false);

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
      setSavedTint(resolvedTint);
      setPreviewTint(resolvedTint);
      setHexInput(resolvedTint.replace(/^#/, "").slice(0, 6));
    })();
  }, []);

  const previewTintNormalized = (previewTint ?? DEFAULT_FELT_COLOR).toLowerCase();
  const savedTintNormalized = (savedTint ?? DEFAULT_FELT_COLOR).toLowerCase();
  const tintDirty = previewTintNormalized !== savedTintNormalized;

  const nameDirty = playerName.trim() !== savedName.trim();
  const hasUnsavedChanges = nameDirty || tintDirty;

  const handleSaveName = async () => {
    const check = validateDisplayText(playerName, "Player name");
    if (!isValidDisplayText(check)) {
      Alert.alert("Not Allowed", check.reason);
      return;
    }

    try {
      await cachePlayerName(check.value);
      setSavedName(check.value);
      setPlayerName(check.value);
      if (playerInfo) {
        setPlayerInfo({ ...playerInfo, displayName: check.value });
      }
      await onNameSaved?.(check.value);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    } catch (error) {
      console.error("[Settings] Failed to save name:", error);
      Alert.alert("Error", "Failed to save name. Please try again.");
    }
  };

  const updatePreview = (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    setPreviewTint(normalized);
    setHexInput(normalized.replace(/^#/, ""));
    setFeltTint(normalized);
    onWallpaperPreview?.(normalized);
  };

  const handleSaveFeltColor = async () => {
    const normalized = normalizeHexColor(previewTint);
    if (!normalized) {
      Alert.alert("Invalid Color", "Enter a 6-digit hex code (e.g. 0f5132).");
      return;
    }

    await setWallpaperTint(normalized);
    setSavedTint(normalized);
    setPreviewTint(normalized);
    setHexInput(normalized.replace(/^#/, ""));
    setFeltSaveFlash(true);
    setTimeout(() => setFeltSaveFlash(false), 2000);
    onWallpaperChange?.();
  };

  const handleResetFeltColor = async () => {
    await setWallpaperTint(null);
    setSavedTint(DEFAULT_FELT_COLOR);
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
    }
  };

  const handleSaveAll = async () => {
    if (nameDirty) {
      const check = validateDisplayText(playerName, "Player name");
      const err = displayTextError(check);
      if (err) {
        Alert.alert("Not Allowed", err);
        return;
      }
      await handleSaveName();
    }
    if (tintDirty) {
      await handleSaveFeltColor();
    }
    setSaveAllFlash(true);
    setTimeout(() => setSaveAllFlash(false), 2000);
  };

  const handleDiscardChanges = () => {
    setPlayerName(savedName);
    setPreviewTint(savedTint);
    setHexInput(savedTint.replace(/^#/, "").slice(0, 6));
    onWallpaperPreview?.(savedTint);
    setFeltTint(savedTint);
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
              placeholder="Enter Your Name"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.saveBtn,
                nameDirty && styles.saveBtnActive,
                saveFlash && styles.saveBtnSaved,
              ]}
              onPress={handleSaveName}
              disabled={!nameDirty && !saveFlash}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  (nameDirty || saveFlash) && styles.saveBtnTextActive,
                ]}
              >
                {saveFlash ? "Saved" : "Save Name"}
              </Text>
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
              onChange={(value) => void setAppearancePreference(value as AppearancePreference)}
              colors={colors}
            />
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Table Text</Text>
            <Text style={styles.tintHint}>
              Auto picks readable text for your felt. Light text suits dark
              tables; dark ink suits light felts — mismatched choices are
              corrected automatically.
            </Text>
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
            <SegmentControl
              options={[
                { id: "auto", label: "Auto" },
                { id: "light", label: "Light text" },
                { id: "dark", label: "Dark ink" },
              ]}
              value={textContrastPreference}
              onChange={(value) =>
                void setTextContrastPreference(value as TextContrastPreference)
              }
              colors={colors}
            />
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
          </BlurPanel>

          <BlurPanel style={ui.panel} intensity={48}>
            <Text style={ui.panelEyebrow}>Felt Tint</Text>
            <Text style={styles.tintHint}>
              Preview updates live. Tap Set Felt Color to save your preference.
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
              style={[
                styles.saveBtn,
                { marginTop: 12 },
                (tintDirty || feltSaveFlash) && styles.saveBtnActive,
                feltSaveFlash && styles.saveBtnSaved,
              ]}
              onPress={() => void handleSaveFeltColor()}
              disabled={!tintDirty && !feltSaveFlash}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  (tintDirty || feltSaveFlash) && styles.saveBtnTextActive,
                ]}
              >
                {feltSaveFlash ? "Saved" : "Set Felt Color"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.btnGhost, { marginTop: 10 }]}
              onPress={() => void handleResetFeltColor()}
            >
              <Text style={ui.btnGhostText}>Reset Felt Color</Text>
            </TouchableOpacity>
          </BlurPanel>
        </View>
      </ScrollView>

      {onBack ? (
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <View style={{ width: contentMax, alignSelf: "center" }}>
              {hasUnsavedChanges || saveAllFlash ? (
                <View style={ui.actionTrack}>
                  <TouchableOpacity
                    style={ui.actionSecondary}
                    onPress={handleDiscardChanges}
                    disabled={saveAllFlash}
                  >
                    <Text style={ui.actionSecondaryText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      ui.actionPrimary,
                      saveAllFlash && styles.saveAllPrimarySaved,
                    ]}
                    onPress={() => void handleSaveAll()}
                    disabled={saveAllFlash}
                  >
                    <Text style={ui.actionPrimaryText}>
                      {saveAllFlash ? "Saved" : "Save Changes"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <BottomBarLeave onPress={onBack} label="Back" />
            </View>
          </BottomBarControls>
        </BottomBar>
      ) : null}
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
  saveAllPrimarySaved: {
    borderColor: "rgba(76,175,80,0.6)",
    backgroundColor: "rgba(76,175,80,0.22)",
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
  saveBtnSaved: {
    backgroundColor: "rgba(76,175,80,0.35)",
    borderColor: "rgba(76,175,80,0.6)",
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
    marginBottom: 14,
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
