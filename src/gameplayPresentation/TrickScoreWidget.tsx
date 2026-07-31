import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { hexToRgba } from "../utils/colorTheory";
import { playerInitials } from "../utils/playerDisplay";
import GameplayGlassPanel from "./GameplayGlassPanel";
import {
  HUD_TYPE,
  hudGlassPadding,
  type HudDensity,
} from "./hudLayout";

export type TrickScoreRow = {
  id: string;
  name: string;
  tricks: number;
  isYou?: boolean;
  accent?: string;
};

type Props = {
  rows: TrickScoreRow[];
  /** Narrower / collapsible on SE-class shells — type stays on HUD_TYPE floors. */
  density?: HudDensity;
};

const MANY_PLAYERS = 6;

/** Visual standings for tricks won this round — compact corner chip. */
export default function TrickScoreWidget({
  rows,
  density = "comfortable",
}: Props) {
  const { colors } = useAppTheme();
  const many = rows.length >= MANY_PLAYERS;
  const denseShell = density !== "comfortable";
  /** 6+ players: initials-only rows to free width. */
  const initialsOnly = many || density === "ultra";
  /** 6–8p on short shells starts collapsed so the ring stays clear. */
  const collapsible = many && denseShell;
  const [expanded, setExpanded] = useState(!collapsible);

  useEffect(() => {
    setExpanded(!collapsible);
  }, [collapsible, rows.length]);

  const styles = useMemo(
    () => createStyles(colors, density, initialsOnly),
    [colors, density, initialsOnly],
  );
  if (!rows.length) return null;
  /** Hide until the first trick is won — all-zero standings only add clutter. */
  if (!rows.some((r) => r.tricks > 0)) return null;

  const sorted = [...rows].sort(
    (a, b) => b.tricks - a.tricks || a.name.localeCompare(b.name),
  );
  const lead = sorted[0]?.tricks ?? 0;
  const you = sorted.find((r) => r.isYou);
  const leader = sorted[0];

  const visibleRows = (() => {
    if (!collapsible || expanded) return sorted;
    const keep = new Map<string, TrickScoreRow>();
    if (leader) keep.set(leader.id, leader);
    if (you) keep.set(you.id, you);
    return sorted.filter((r) => keep.has(r.id));
  })();

  const hiddenCount =
    collapsible && !expanded
      ? Math.max(0, sorted.length - visibleRows.length)
      : 0;

  const showChips = density === "comfortable" && !many;

  const body = (
    <>
      <View style={styles.header}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.eyebrow}>Tricks</Text>
        {collapsible ? (
          <Text style={styles.expandCue}>{expanded ? "▴" : "▾"}</Text>
        ) : null}
      </View>
      {visibleRows.map((r) => {
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
            {!initialsOnly ? (
              <Text
                style={[styles.name, r.isYou && styles.nameYou]}
                numberOfLines={1}
              >
                {r.name}
              </Text>
            ) : null}
            {showChips ? (
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
      {hiddenCount > 0 ? (
        <Text style={styles.moreHint}>+{hiddenCount} more</Text>
      ) : null}
    </>
  );

  if (!collapsible) {
    return (
      <GameplayGlassPanel compact style={styles.panel}>
        {body}
      </GameplayGlassPanel>
    );
  }

  return (
    <GameplayGlassPanel
      compact
      style={styles.panel}
      onPress={() => setExpanded((v) => !v)}
    >
      {body}
    </GameplayGlassPanel>
  );
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>["colors"],
  density: HudDensity,
  initialsOnly: boolean,
) {
  const pad = hudGlassPadding(density);
  return StyleSheet.create({
    panel: {
      width: initialsOnly ? 96 : 148,
      maxWidth: "100%",
      gap: 2,
      padding: pad,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 2,
    },
    trophy: { fontSize: HUD_TYPE.caption },
    eyebrow: {
      color: colors.accent,
      fontSize: HUD_TYPE.eyebrow,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      flex: 1,
    },
    expandCue: {
      color: colors.textTertiary,
      fontSize: HUD_TYPE.caption,
      fontWeight: "700",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 1,
      paddingHorizontal: 2,
    },
    /** Sized so initials can sit at the caption floor (10). */
    dot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      flexShrink: 0,
    },
    dotText: {
      color: "#fff",
      fontSize: HUD_TYPE.caption,
      fontWeight: "800",
    },
    name: {
      color: colors.textPrimary,
      fontSize: HUD_TYPE.caption,
      fontWeight: "700",
      width: 36,
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
      minHeight: showMinChipTrack(density, initialsOnly) ? 8 : 0,
    },
    trickChip: {
      width: 6,
      height: 6,
      borderRadius: 2,
    },
    zero: {
      color: colors.textTertiary,
      fontSize: HUD_TYPE.caption,
      fontWeight: "600",
    },
    count: {
      color: colors.textPrimary,
      fontSize: HUD_TYPE.body,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      minWidth: 14,
      textAlign: "right",
    },
    countLead: {
      color: colors.accent,
    },
    moreHint: {
      color: colors.textTertiary,
      fontSize: HUD_TYPE.caption,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 2,
    },
  });
}

function showMinChipTrack(density: HudDensity, initialsOnly: boolean): boolean {
  return density === "comfortable" && !initialsOnly;
}
