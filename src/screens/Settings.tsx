import React, { useEffect, useState } from "react";
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
import BottomBar, {
  BottomBarControls,
  BottomBarLeave,
  menuBottomReserve,
} from "../components/BottomBar";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { playerInitials } from "../utils/playerDisplay";
import { BLUR_PANEL, contentMaxWidth, GOLD, ui } from "../styles/uiStandards";
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

export default function Settings({
  onWallpaperPreview,
  onWallpaperChange,
  onBack,
}: {
  onWallpaperPreview?: (tint: string) => void;
  onWallpaperChange?: () => void;
  onBack?: () => void;
}) {
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
    const trimmed = playerName.trim();
    if (!trimmed) {
      Alert.alert("Invalid Name", "Please enter a valid name.");
      return;
    }

    try {
      await cachePlayerName(trimmed);
      setSavedName(trimmed);
      setPlayerName(trimmed);
      if (playerInfo) {
        setPlayerInfo({ ...playerInfo, displayName: trimmed });
      }
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
    onWallpaperChange?.();
  };

  const handleHexInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexInput(cleaned);
    const normalized = normalizeHexColor(cleaned);
    if (normalized) {
      setPreviewTint(normalized);
      onWallpaperPreview?.(normalized);
    }
  };

  const handleSaveAll = async () => {
    if (nameDirty) {
      const trimmed = playerName.trim();
      if (!trimmed) {
        Alert.alert("Invalid Name", "Please enter a valid name.");
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

          <BlurPanel style={ui.panel} {...BLUR_PANEL} intensity={52}>
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
              placeholderTextColor="rgba(255,255,255,0.35)"
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
            <View style={styles.hexInputWrap}>
              <Text style={styles.hexPrefix}>#</Text>
              <TextInput
                placeholder="rrggbb"
                placeholderTextColor="rgba(255,255,255,0.35)"
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
              <BottomBarLeave onPress={onBack} />
            </View>
          </BottomBarControls>
        </BottomBar>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(212, 175, 55, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(212, 175, 55, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  profileHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  saveBtnActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  saveBtnSaved: {
    backgroundColor: "rgba(76,175,80,0.35)",
    borderColor: "rgba(76,175,80,0.6)",
  },
  saveBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  saveBtnTextActive: {
    color: "#111",
  },
  tintHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
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
    borderColor: "#fff",
  },
  hexInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  hexPrefix: {
    color: GOLD,
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
