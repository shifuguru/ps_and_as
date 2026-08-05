import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import type { RulesSection } from "../utils/rulesHeadings";

type Props = {
  sections: RulesSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

export default function RulesSectionNav({
  sections,
  activeId,
  onSelect,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chipScrollRef = useRef<ScrollView>(null);
  const chipLayouts = useRef<Map<string, { x: number; width: number }>>(
    new Map(),
  );

  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    if (!activeId) return;
    const layout = chipLayouts.current.get(activeId);
    if (!layout) return;
    chipScrollRef.current?.scrollTo({
      x: Math.max(0, layout.x - 24),
      animated: true,
    });
  }, [activeId]);

  if (sections.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <Text style={styles.currentLabel} numberOfLines={1}>
        {activeSection?.title ?? "Rules"}
      </Text>
      <ScrollView
        ref={chipScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <Pressable
              key={section.id}
              onPress={() => onSelect(section.id)}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                chipLayouts.current.set(section.id, { x, width });
              }}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={section.title}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
                {section.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    wrap: {
      zIndex: 30,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.panelBorder,
      paddingTop: 4,
      paddingBottom: 8,
      gap: 6,
    },
    currentLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      paddingHorizontal: 4,
    },
    chipScroll: {
      flexGrow: 0,
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 2,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.panelBorder,
      backgroundColor: colors.btnSecondaryBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: {
      borderColor: colors.btnAccentBorder,
      backgroundColor: colors.btnAccentBg,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    chipTextActive: {
      color: colors.accent,
    },
  });
}
