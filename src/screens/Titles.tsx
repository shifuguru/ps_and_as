import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
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
import ProgressMeter from "../components/ProgressMeter";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import { useAppTheme } from "../context/ThemeContext";
import { contentMaxWidth } from "../styles/uiStandards";
import { getPlayerStats, type PlayerStats } from "../services/playerStats";
import {
  readDisplayTitleTrackId,
  setDisplayTitleTrackId,
  displayedTitleForStats,
} from "../services/titlePreferences";
import {
  listTitleTrackProgress,
  formatTitleTrackProgressLabel,
  formatTitleTrackValue,
  type TitleTrackProgress,
} from "../rewards/titleTracks";
import { hexToRgba } from "../utils/colorTheory";
import { triggerHaptic } from "../utils/haptics";

export default function Titles({
  onBack,
}: {
  onBack: () => void;
}) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useLayoutInsets();
  const { width } = useWindowDimensions();
  const contentMax = contentMaxWidth(width);
  const bottomBarHeight = menuBottomReserve(insets.bottom || 0);

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [displayTrackId, setDisplayTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [playerStats, trackId] = await Promise.all([
        getPlayerStats(),
        readDisplayTitleTrackId(),
      ]);
      setStats(playerStats);
      setDisplayTrackId(trackId);
    } catch (error) {
      console.error("[Titles] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const tracks = useMemo(
    () => (stats ? listTitleTrackProgress(stats) : []),
    [stats],
  );
  const unlockedTracks = tracks.filter((t) => t.unlocked);
  const activeTitle =
    stats ? displayedTitleForStats(stats, displayTrackId) : null;

  const handleSelectDisplay = async (trackId: string) => {
    const row = tracks.find((t) => t.track.id === trackId);
    if (!row?.unlocked) return;
    triggerHaptic("light");
    const previousTrackId = displayTrackId;
    const nextTrackId = displayTrackId === trackId ? null : trackId;
    setSavingTrackId(trackId);
    setDisplayTrackId(nextTrackId);
    try {
      await setDisplayTitleTrackId(nextTrackId);
    } catch (error) {
      console.error("[Titles] Failed to save display title:", error);
      setDisplayTrackId(previousTrackId);
    } finally {
      setSavingTrackId(null);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer ignoreHeaderOffset style={styles.loadingRoot}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading titles…</Text>
        </View>
        <BottomBar>
          <BottomBarControls style={styles.bottomControls}>
            <BottomBarLeave onPress={onBack} label="Back" />
          </BottomBarControls>
        </BottomBar>
      </ScreenContainer>
    );
  }

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
          <ScreenTopBar title="Titles" />

          <BlurPanel style={ui.panel} intensity={52}>
            <Text style={ui.panelEyebrow}>Displayed title</Text>
            <Text style={styles.activeTitle}>
              {activeTitle ?? "None selected"}
            </Text>
            <Text style={styles.hint}>
              Selected title track will be displayed on your profile.
            </Text>
          </BlurPanel>

          {unlockedTracks.length === 0 ? (
            <BlurPanel style={[ui.panel, styles.emptyPanel]} intensity={44}>
              <Text style={styles.emptyTitle}>No title tracks yet</Text>
              <Text style={styles.hint}>
                Win and lose rounds, trade jokers, and build your career — first
                tiers take many games, not just your first session.
              </Text>
            </BlurPanel>
          ) : null}

          {tracks.map((row) => (
            <TitleTrackRow
              key={row.track.id}
              row={row}
              isDisplayed={displayTrackId === row.track.id}
              saving={savingTrackId === row.track.id}
              onToggleDisplay={() => handleSelectDisplay(row.track.id)}
              styles={styles}
              colors={colors}
              ui={ui}
            />
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <BottomBarControls style={styles.bottomControls}>
          <BottomBarLeave onPress={onBack} label="Back" />
        </BottomBarControls>
      </BottomBar>
    </ScreenContainer>
  );
}

function TitleTrackRow({
  row,
  isDisplayed,
  saving,
  onToggleDisplay,
  styles,
  colors,
  ui,
}: {
  row: TitleTrackProgress;
  isDisplayed: boolean;
  saving: boolean;
  onToggleDisplay: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>["colors"];
  ui: ReturnType<typeof useAppTheme>["ui"];
}) {
  const locked = !row.unlocked;
  const tierLabel = row.displayTitle ?? "Locked";
  const progressLabel = locked
    ? `${formatTitleTrackValue(row)} / ${row.nextThreshold?.toLocaleString() ?? "—"}`
    : formatTitleTrackProgressLabel(row);

  const card = (
    <BlurPanel
      style={[
        ui.panel,
        styles.trackCard,
        locked && styles.trackCardLocked,
        isDisplayed && styles.trackCardActive,
      ]}
      intensity={44}
    >
      <View style={styles.trackHeader}>
        <View style={styles.trackTitleBlock}>
          <Text style={styles.trackName}>{row.track.trackName}</Text>
          <Text style={styles.tierName} numberOfLines={1}>
            {tierLabel}
            {row.tier > 0 ? ` · Tier ${row.tier}` : ""}
          </Text>
        </View>
        {row.unlocked ? (
          <View
            pointerEvents="none"
            style={[
              styles.checkBox,
              isDisplayed && styles.checkBoxOn,
            ]}
          >
            {isDisplayed ? (
              <Text style={styles.checkMark}>✓</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text style={styles.trackDesc}>{row.track.description}</Text>
      <ProgressMeter
        progress={row.fraction}
        label={locked ? "Progress" : row.nextThreshold ? "Next tier" : "Complete"}
        valueLabel={progressLabel}
        style={{ marginTop: 10 }}
        animated={!locked}
      />
    </BlurPanel>
  );

  if (locked) {
    return <View style={styles.trackCardPressable}>{card}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onToggleDisplay}
      disabled={saving}
      activeOpacity={0.9}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDisplayed }}
      accessibilityLabel={`Display ${row.track.trackName} title`}
      style={styles.trackCardPressable}
    >
      {card}
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { alignSelf: "center", width: "100%" },
    loadingRoot: { flex: 1 },
    loadingCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
    },
    bottomControls: { justifyContent: "flex-start" },
    activeTitle: {
      color: colors.accent,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 8,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },
    emptyPanel: { marginTop: 12 },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 8,
    },
    trackCard: {},
    trackCardPressable: { marginTop: 12 },
    trackCardLocked: { opacity: 0.72 },
    trackCardActive: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hexToRgba(colors.accent, 0.55),
    },
    trackHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    trackTitleBlock: { flex: 1 },
    trackName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    tierName: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 2,
    },
    trackDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 17,
      marginTop: 8,
    },
    checkBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: hexToRgba(colors.textPrimary, 0.72),
      backgroundColor: hexToRgba(colors.textPrimary, 0.1),
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkBoxOn: {
      borderColor: colors.accent,
      backgroundColor: hexToRgba(colors.accent, 0.28),
    },
    checkMark: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 18,
    },
  });
}
