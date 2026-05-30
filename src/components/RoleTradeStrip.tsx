import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Card from "./Card";
import type { Card as CardType } from "../game/ruleset";
import type { ClientPendingTrade } from "../game/roundPrep";
import { useAppTheme } from "../context/ThemeContext";

type Props = {
  trade: ClientPendingTrade;
  localPlayerId?: string | null;
  /** Cards the local winner has selected to return (president / VP). */
  selectedReturn?: CardType[];
  /** Hide receive slot card while a flight animation is in progress. */
  hideReceiveCard?: boolean;
  /** Receive slot card has landed — play a brief pop-in. */
  receiveLanded?: boolean;
  /** Screen coordinates of the receive slot (for card flight target). */
  onReceiveSlotMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
};

function TradeCardSlot({
  card,
  arrow,
  label,
  faceDown = false,
  hidden = false,
  landed = false,
  onMeasure,
}: {
  card?: CardType;
  arrow: "up" | "down";
  label: string;
  faceDown?: boolean;
  hidden?: boolean;
  landed?: boolean;
  onMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}) {
  const { colors } = useAppTheme();
  const slotRef = useRef<View>(null);
  const popAnim = useRef(new Animated.Value(landed ? 1 : 0.6)).current;

  const measureSlot = useCallback(() => {
    if (!onMeasure || !slotRef.current) return;
    slotRef.current.measureInWindow((x, y, width, height) => {
      onMeasure({ x, y, width, height });
    });
  }, [onMeasure]);

  useEffect(() => {
    if (!landed) {
      popAnim.setValue(0.6);
      return;
    }
    Animated.spring(popAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [landed, popAnim]);

  useEffect(() => {
    if (!onMeasure) return;
    const timer = setTimeout(measureSlot, 0);
    return () => clearTimeout(timer);
  }, [onMeasure, measureSlot, card, hidden, label]);

  const showCard = !!card && !hidden;

  return (
    <View style={styles.slotWrap}>
      <Text style={[styles.arrow, { color: colors.gold }]}>
        {arrow === "up" ? "↑" : "↓"}
      </Text>
      <View
        ref={slotRef}
        onLayout={onMeasure ? measureSlot : undefined}
        style={[styles.cardSlot, { borderColor: colors.panelBorder }]}
      >
        {showCard ? (
          <Animated.View style={{ transform: [{ scale: popAnim }], opacity: popAnim }}>
            <Card
              card={card}
              compact
              selected={false}
              faceDown={faceDown}
              onPress={() => {}}
              style={styles.cardSize}
            />
          </Animated.View>
        ) : (
          <View style={styles.cardPlaceholder}>
            <Text style={styles.placeholderText}>?</Text>
          </View>
        )}
      </View>
      <Text style={[styles.slotLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Mandatory trade preview — two card icons above the action bar. */
export default function RoleTradeStrip({
  trade,
  localPlayerId,
  selectedReturn = [],
  hideReceiveCard = false,
  receiveLanded = false,
  onReceiveSlotMeasure,
}: Props) {
  const { colors, ui } = useAppTheme();
  const isWinner = !!localPlayerId && trade.winnerId === localPlayerId;
  const isLoser = !!localPlayerId && trade.loserId === localPlayerId;

  const { giveCard, receiveCard, giveLabel, receiveLabel } = useMemo(() => {
    const incoming = trade.incoming[0];
    const outgoing =
      selectedReturn[0] ?? trade.returnedCards?.[0];

    if (isWinner) {
      return {
        giveCard: outgoing ?? selectedReturn[0],
        receiveCard: incoming,
        giveLabel: "You give",
        receiveLabel: `From ${trade.loserName}`,
      };
    }
    if (isLoser) {
      return {
        giveCard: incoming,
        receiveCard: outgoing,
        giveLabel: "You give (best)",
        receiveLabel: outgoing ? "You receive" : "Waiting…",
      };
    }
    return {
      giveCard: incoming,
      receiveCard: outgoing,
      giveLabel: `${trade.loserName} gives`,
      receiveLabel: outgoing ? `${trade.winnerName} returns` : "Pending",
    };
  }, [isWinner, isLoser, trade, selectedReturn]);

  const hideFromOthers = !isWinner && !isLoser;

  return (
    <View style={[styles.row, ui.panel, { borderColor: colors.panelBorder }]}>
      <Text style={[styles.title, { color: colors.gold }]}>
        {trade.key === "president" ? "👑 President Trade" : "⭐ VP Trade"}
      </Text>
      <View style={styles.cardsRow}>
        <TradeCardSlot
          card={giveCard}
          arrow="up"
          label={giveLabel}
          faceDown={hideFromOthers && !!giveCard}
        />
        <TradeCardSlot
          card={receiveCard}
          arrow="down"
          label={receiveLabel}
          faceDown={hideFromOthers && !!receiveCard}
          hidden={hideReceiveCard}
          landed={receiveLanded && !!receiveCard}
          onMeasure={isLoser ? onReceiveSlotMeasure : undefined}
        />
      </View>
      {isWinner ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Asshole must give their highest card
          {trade.returnCount > 1 ? "s" : ""}. Pick any {trade.returnCount} to return.
        </Text>
      ) : isLoser ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Your highest card{trade.incoming.length > 1 ? "s" : ""} go to {trade.winnerName}.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {trade.winnerName} chooses return cards from {trade.loserName}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: "flex-end",
    marginRight: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "right",
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  slotWrap: {
    alignItems: "center",
    width: 72,
  },
  arrow: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
    marginBottom: 2,
  },
  cardSlot: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardSize: {
    width: 52,
    height: 74,
  },
  cardPlaceholder: {
    width: 52,
    height: 74,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  placeholderText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 18,
    fontWeight: "700",
  },
  slotLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  hint: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "right",
  },
});
