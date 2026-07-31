import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";
import type { HudDensity } from "./hudLayout";

export type TrickScoreRow = {
  id: string;
  name: string;
  tricks: number;
  isYou?: boolean;
  accent?: string;
};

type Props = {
  rows: TrickScoreRow[];
  /** Shorter / narrower on SE-class shells so the table stays readable. */
  density?: HudDensity;
};

/** Visual standings for tricks won this round — compact corner chip. */
export default function TrickScoreWidget({
  rows,
  density = "comfortable",
}: Props) {
  const { colors } = useAppTheme();
  const dense = density !== "comfortable";
  const ultra = density === "ultra";
  const styles = useMemo(
    () => createStyles(colors, dense, ultra),
    [colors, dense, ultra],
  );
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => b.tricks - a.tricks || a.name.localeCompare(b.name));
  const lead = sorted[0]?.tricks ?? 0;

  return (
    <GameplayGlassPanel compact style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.eyebrow}>Tricks</Text>
      </View>
      {sorted.map((r) => {
        const accent = r.accent ?? (r.isYou ? colors.accent : colors.textTertiary);
        const leading = r.tricks > 0 && r.tricks === lead;
        return (
          <View
            key={r.id}
            style={[
              styles.row,
              leading && {
                backgroundColor: hexToRgba(colors.accent, 0.1),
                borderRadius: 8,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: hexToRgba(accent, r.isYou ? 0.85 : 0.55),
                  borderColor: hexToRgba(accent, 0.9),
                },
              ]}
            >
              <Text style={styles.dotText}>{playerInitials(r.name)}</Text>
            </View>
            {!ultra ? (
              <Text
                style={[styles.name, r.isYou && styles.nameYou]}
                numberOfLines={1}
              >
                {r.name}
              </Text>
            ) : null}
            {!dense ? (
              <View style={styles.chipTrack}>
                {Array.from({ length: Math.max(r.tricks, 0) }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trickChip,
                      { backgroundColor: hexToRgba(accent, 0.75) },
                    ]}
                  />
                ))}
                {r.tricks === 0 ? (
                  <Text style={styles.zero}>—</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.chipTrack} />
            )}
            <Text style={[styles.count, leading && styles.countLead]}>
              {r.tricks}
            </Text>
          </View>
        );
      })}
    </GameplayGlassPanel>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  dense: boolean,
  ultra: boolean,
) {
  return StyleSheet.create({
    panel: {
      width: ultra ? 88 : dense ? 112 : 148,
      maxWidth: "100%",
      gap: ultra ? 0 : 2,
      padding: ultra ? 6 : dense ? 7 : 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginBottom: ultra ? 0 : 2,
    },
    trophy: { fontSize: ultra ? 8 : 9 },
    eyebrow: {
      color: colors.accent,
      fontSize: ultra ? 7 : 8,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: ultra ? 3 : 4,
      paddingVertical: ultra ? 0 : 1,
      paddingHorizontal: 2,
    },
    dot: {
      width: ultra ? 14 : 16,
      height: ultra ? 14 : 16,
      borderRadius: ultra ? 7 : 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    dotText: {
      color: "#fff",
      fontSize: ultra ? 5 : 6,
      fontWeight: "800",
    },
    name: {
      color: colors.textPrimary,
      fontSize: dense ? 9 : 10,
      fontWeight: "700",
      width: dense ? 28 : 36,
    },
    nameYou: {
      color: colors.accent,
    },
    chipTrack: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 2,
      alignItems: "center",
      minHeight: dense ? 0 : 8,
    },
    trickChip: {
      width: 6,
      height: 6,
      borderRadius: 2,
    },
    zero: {
      color: colors.textTertiary,
      fontSize: 10,
      fontWeight: "600",
    },
    count: {
      color: colors.textPrimary,
      fontSize: ultra ? 11 : 12,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      minWidth: ultra ? 12 : 14,
      textAlign: "right",
    },
    countLead: {
      color: colors.accent,
    },
  });
}
