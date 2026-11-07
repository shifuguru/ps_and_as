import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import type { ClientPendingTrade } from "../game/roundPrep";
import type { Card as CardType } from "../game/ruleset";
import {
  roleTradeCardGroups,
  TRADE_RESULT_DISMISS_MS,
} from "../gameplayPresentation/roleTradePresentation";
import { useGameTerminology } from "../hooks/useGameTerminology";
import { triggerHaptic } from "../utils/haptics";
import BlurPanel from "./BlurPanel";
import Card from "./Card";

type Props = {
  trade: ClientPendingTrade;
  localPlayerId: string;
  hand: CardType[];
  onConfirm: (selected: CardType[]) => void;
  onSelectionChange: (selected: CardType[]) => void;
  onDismiss?: () => void;
  waitingForOtherTrades?: boolean;
  onReceiveSlotMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
};

/** Centred private trade panel for the two players involved in a trade. */
export default function RoleTradeStrip({
  trade,
  localPlayerId,
  hand,
  onConfirm,
  onSelectionChange,
  onDismiss,
  waitingForOtherTrades = false,
  onReceiveSlotMeasure,
}: Props) {
  const { colors, ui, blur } = useAppTheme();
  const wording = useGameTerminology();
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.min(width - 32, 440);
  const cardWidth = Math.min(64, Math.max(24, (panelWidth - 80) / 4));
  const cardSize = { width: cardWidth, height: (cardWidth * 92) / 64 };
  const [selected, setSelected] = useState<number[]>([]);
  const receiveRef = useRef<View>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const isWinner = trade.winnerId === localPlayerId;
  const sortedHand = useMemo(
    () =>
      hand
        .filter((card) => !card.hidden && card.value !== 0)
        .slice()
        .sort((a, b) => a.value - b.value || a.suit.localeCompare(b.suit)),
    [hand],
  );

  useEffect(() => {
    setSelected([]);
    onSelectionChange([]);
  }, [trade.key, trade.winnerId, sortedHand.length, onSelectionChange]);

  useEffect(() => {
    if (!trade.completed || !onDismiss) return;
    const timer = setTimeout(() => onDismissRef.current?.(), TRADE_RESULT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [trade.completed, trade.key, trade.winnerId, trade.loserId, !!onDismiss]);

  const toggle = (index: number) => {
    triggerHaptic("light");
    const next = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [
          ...(selected.length >= trade.returnCount ? selected.slice(1) : selected),
          index,
        ];
    setSelected(next);
    onSelectionChange(next.map((i) => sortedHand[i]));
  };

  const selectedCards = selected.map((i) => sortedHand[i]).filter(Boolean);
  const groups = roleTradeCardGroups(trade, localPlayerId, selectedCards);

  return (
    <View style={styles.overlay}>
      <BlurPanel
        preset={blur.modal}
        style={[
          ui.modalCard,
          styles.panel,
          { width: panelWidth, maxHeight: height - 32 },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={ui.modalTitle}>
            {trade.key === "president" ? wording("👑 President Trade") : "⭐ VP Trade"}
          </Text>
          <View style={styles.groups}>
            {groups.map((group, groupIndex) => (
              <React.Fragment key={group.label}>
                {groupIndex === 1 ? (
                  <Text
                    accessibilityLabel="Cards exchanged"
                    style={[styles.swap, { color: colors.textSecondary }]}
                  >
                    ↔
                  </Text>
                ) : null}
                <View style={styles.group}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {group.label}
                  </Text>
                  <View
                    ref={!isWinner && groupIndex === 1 ? receiveRef : undefined}
                    onLayout={
                      !isWinner && groupIndex === 1 && onReceiveSlotMeasure
                        ? () => {
                            receiveRef.current?.measureInWindow((x, y, width, height) =>
                              onReceiveSlotMeasure({ x, y, width, height }),
                            );
                          }
                        : undefined
                    }
                    style={styles.cards}
                  >
                    {group.cards.length ? (
                      group.cards.map((card, index) => (
                        <Card
                          key={`${card.suit}-${card.value}-${index}`}
                          card={card}
                          selected={false}
                          onPress={() => {}}
                          style={cardSize}
                        />
                      ))
                    ) : (
                      <View
                        style={[
                          styles.placeholder,
                          cardSize,
                          { borderColor: colors.panelBorder },
                        ]}
                      >
                        <Text style={{ color: colors.textSecondary }}>?</Text>
                      </View>
                    )}
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
          {isWinner && !trade.completed ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Pick {trade.returnCount} card{trade.returnCount === 1 ? "" : "s"} to return
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.hand}
              >
                {sortedHand.map((card, index) => (
                  <Card
                    key={`${card.suit}-${card.value}-${index}`}
                    card={card}
                    selected={selected.includes(index)}
                    onPress={() => toggle(index)}
                    style={cardSize}
                  />
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[
                  ui.actionPrimary,
                  selected.length !== trade.returnCount && ui.actionPrimaryDisabled,
                  { alignSelf: "stretch", flex: 0 },
                ]}
                disabled={selected.length !== trade.returnCount}
                onPress={() => {
                  triggerHaptic("medium");
                  onConfirm(selectedCards);
                  setSelected([]);
                  onSelectionChange([]);
                }}
              >
                <Text
                  style={[
                    ui.actionPrimaryText,
                    selected.length !== trade.returnCount && ui.actionPrimaryTextDisabled,
                  ]}
                >
                  Confirm Trade
                </Text>
              </TouchableOpacity>
            </>
          ) : !trade.completed ? (
            <Text style={[ui.modalBody, styles.message]}>
              Waiting for {trade.winnerName} to choose return cards…
            </Text>
          ) : (
            <Text style={[ui.modalBody, styles.message]}>
              {waitingForOtherTrades
                ? "Trade complete. Waiting for the other trade…"
                : "Trade complete"}
            </Text>
          )}
          {trade.completed && onDismiss ? (
            <TouchableOpacity
              style={[ui.actionPrimary, { alignSelf: "stretch", flex: 0 }]}
              onPress={onDismiss}
            >
              <Text style={ui.actionPrimaryText}>Continue</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </BlurPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4000,
    elevation: 4000,
  },
  panel: { padding: 16 },
  content: { alignItems: "stretch" },
  groups: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 12,
  },
  group: { alignItems: "center", flexShrink: 1 },
  swap: { alignSelf: "center", marginTop: 20, fontSize: 20, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  cards: { flexDirection: "row", justifyContent: "center", gap: 4 },
  placeholder: {
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hand: { gap: 6, paddingVertical: 6, marginBottom: 12 },
  message: { textAlign: "center", marginBottom: 12 },
});
