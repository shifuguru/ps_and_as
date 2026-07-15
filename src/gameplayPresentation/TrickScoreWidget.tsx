import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";

export type TrickScoreRow = {
  id: string;
  name: string;
  tricks: number;
  isYou?: boolean;
  accent?: string;
};

type Props = {
  rows: TrickScoreRow[];
};

/** Visual standings for tricks won this round. */
export default function TrickScoreWidget({ rows }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => b.tricks - a.tricks || a.name.localeCompare(b.name));
  const lead = sorted[0]?.tricks ?? 0;

  return (
    <GameplayGlassPanel compact style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.eyebrow}>Tricks This Round</Text>
      </View>
      {sorted.map((r) => {
        const accent = r.accent ?? (r.isYou ? colors.gold : colors.textMuted);
        const leading = r.tricks > 0 && r.tricks === lead;
        return (
          <View
            key={r.id}
            style={[
              styles.row,
              leading && {
                backgroundColor: hexToRgba(colors.gold, 0.1),
                borderRadius: 10,
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
            <Text
              style={[styles.name, r.isYou && styles.nameYou]}
              numberOfLines={1}
            >
              {r.name}
            </Text>
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
            <Text style={[styles.count, leading && styles.countLead]}>
              {r.tricks}
            </Text>
          </View>
        );
      })}
    </GameplayGlassPanel>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    panel: {
      width: 176,
      maxWidth: "100%",
      gap: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 4,
    },
    trophy: { fontSize: 11 },
    eyebrow: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 3,
      paddingHorizontal: 4,
    },
    dot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    dotText: {
      color: "#fff",
      fontSize: 7,
      fontWeight: "800",
    },
    name: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "700",
      width: 42,
    },
    nameYou: {
      color: colors.gold,
    },
    chipTrack: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 3,
      alignItems: "center",
      minHeight: 10,
    },
    trickChip: {
      width: 8,
      height: 8,
      borderRadius: 3,
    },
    zero: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    count: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      minWidth: 16,
      textAlign: "right",
    },
    countLead: {
      color: colors.gold,
    },
  });
}
