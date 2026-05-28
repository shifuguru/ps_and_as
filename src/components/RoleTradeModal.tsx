import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import BlurPanel from "./BlurPanel";
import Card from "./Card";
import { triggerHaptic } from "../utils/haptics";
import { useAppTheme } from "../context/ThemeContext";
import type { Card as CardType } from "../game/ruleset";
import type { ClientPendingTrade } from "../game/roundPrep";
import { roleEmoji, type RoundRoleLabel } from "../utils/roundRoles";

type Props = {
  visible: boolean;
  trade: ClientPendingTrade | null;
  hand: CardType[];
  isWinner: boolean;
  onConfirm: (selected: CardType[]) => void;
  onSelectionChange?: (selected: CardType[]) => void;
};

export default function RoleTradeModal({
  visible,
  trade,
  hand,
  isWinner,
  onConfirm,
  onSelectionChange,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 440);
  const [selected, setSelected] = useState<number[]>([]);

  if (!trade) return null;

  const sortedHand = [...hand].sort(
    (a, b) => a.value - b.value || a.suit.localeCompare(b.suit),
  );

  const toggle = (index: number) => {
    triggerHaptic("light");
    setSelected((prev) => {
      let next: number[];
      if (prev.includes(index)) next = prev.filter((i) => i !== index);
      else if (prev.length >= trade.returnCount) {
        next = [...prev.slice(1), index];
      } else next = [...prev, index];
      onSelectionChange?.(next.map((i) => sortedHand[i]));
      return next;
    });
  };

  const canConfirm = isWinner && selected.length === trade.returnCount;

  const roleLabel: RoundRoleLabel =
    trade.key === "president" ? "President" : "Vice President";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ui.modalOverlay}>
        <BlurPanel
          style={[ui.modalCard, { width: cardWidth, maxWidth: cardWidth }]}
          preset={blur.modal}
        >
          <Text style={ui.modalTitle}>
            {roleEmoji(roleLabel) ?? ""} {roleLabel} Trade
          </Text>

          {isWinner ? (
            <>
              <Text style={ui.modalBody}>
                {trade.loserName} gave you {trade.incoming.length} card
                {trade.incoming.length === 1 ? "" : "s"}. Choose{" "}
                {trade.returnCount} to return.
              </Text>

              <Text style={styles.sectionLabel}>Received</Text>
              <View style={styles.incomingRow}>
                {trade.incoming.map((card, i) => (
                  <View key={`in-${i}`} style={styles.cardSlot}>
                    <Card
                      card={card}
                      selected={false}
                      onPress={() => {}}
                      style={styles.cardSize}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.sectionLabel}>
                Your hand — pick {trade.returnCount}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handRow}
              >
                {sortedHand.map((card, index) => {
                  const isSelected = selected.includes(index);
                  return (
                    <TouchableOpacity
                      key={`${card.suit}-${card.value}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => toggle(index)}
                      style={[
                        styles.cardSlot,
                        isSelected && styles.cardSlotSelected,
                      ]}
                    >
                      <Card
                        card={card}
                        selected={isSelected}
                        onPress={() => toggle(index)}
                        style={styles.cardSize}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={ui.actionTrack}>
                <TouchableOpacity
                  style={[
                    ui.actionPrimary,
                    !canConfirm && ui.actionPrimaryDisabled,
                    { flex: 1 },
                  ]}
                  disabled={!canConfirm}
                  onPress={() => {
                    triggerHaptic("medium");
                    const picked = selected.map((i) => sortedHand[i]);
                    onConfirm(picked);
                    setSelected([]);
                    onSelectionChange?.([]);
                  }}
                >
                  <Text
                    style={[
                      ui.actionPrimaryText,
                      !canConfirm && ui.actionPrimaryTextDisabled,
                    ]}
                  >
                    Confirm Trade
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[ui.modalBody, { textAlign: "center" }]}>
              Waiting for {trade.winnerName} ({roleLabel}) to complete the
              trade with {trade.loserName}…
            </Text>
          )}
        </BlurPanel>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 4,
    },
    incomingRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
    },
    handRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 4,
      marginBottom: 12,
    },
    cardSlot: {
      borderRadius: 8,
      borderWidth: 2,
      borderColor: "transparent",
    },
    cardSlotSelected: {
      borderColor: colors.gold,
    },
    cardSize: {
      width: 64,
      height: 92,
    },
  });
}
