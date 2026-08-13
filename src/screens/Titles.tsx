import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import BlurPanel from "../components/BlurPanel";
import ProgressMeter from "../components/ProgressMeter";
import { useAppTheme } from "../context/ThemeContext";
import type { PlayerStats } from "../services/playerStats";
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

export function TitlesScrollContent({ stats }: { stats: PlayerStats }) {
  const { colors, ui } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [displayTrackId, setDisplayTrackId] = useState<string | null>(null);
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);

  useEffect(() => {
    void readDisplayTitleTrackId().then(setDisplayTrackId).catch((error) => {
      console.error("[Titles] Failed to load display title:", error);
    });
  }, []);

  const tracks = useMemo(() => listTitleTrackProgress(stats), [stats]);
  const unlockedTracks = tracks.filter((t) => t.unlocked);
  const activeTitle = displayedTitleForStats(stats, displayTrackId);

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

  return (
    <>
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
    </>
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

  return (
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
          <TouchableOpacity
            onPress={onToggleDisplay}
            disabled={saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDisplayed }}
            accessibilityLabel={`Display ${row.track.trackName} title`}
            style={[
              styles.checkBox,
              isDisplayed && styles.checkBoxOn,
            ]}
            activeOpacity={0.85}
          >
            {isDisplayed ? (
              <Text style={styles.checkMark}>✓</Text>
            ) : null}
          </TouchableOpacity>
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
    trackCard: { marginTop: 12 },
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
      borderColor: hexToRgba(colors.textSecondary, 0.45),
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkBoxOn: {
      borderColor: colors.accent,
      backgroundColor: hexToRgba(colors.accent, 0.22),
    },
    checkMark: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 18,
    },
  });
}
