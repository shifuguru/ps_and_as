import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { styles as theme, colors } from '../styles/theme';

export default function EndGamePanel({
  visible,
  finishedOrder,
  players,
  readyStates,
}: {
  visible: boolean;
  finishedOrder: string[];
  players: any[];
  readyStates: { [playerId: string]: boolean };
}) {
  const EXPANDED_HEIGHT = 320;
  const panelHeight = useAnimatedValue(visible ? EXPANDED_HEIGHT : 0);

  function useAnimatedValue(initialValue: number) {
    const animVal = new Animated.Value(initialValue);
    useEffect(() => {
      Animated.timing(animVal, {
        toValue: visible ? EXPANDED_HEIGHT : 0,
        duration: 380,
        useNativeDriver: false,
      }).start();
    }, [visible]);
    return animVal;
  }

  const placements = finishedOrder.map((playerId, idx) => {
    const player = players.find((p) => p.id === playerId);
    const ordinal = (n: number) => {
      if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
      if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
      if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
      return `${n}th`;
    };
    return {
      playerId,
      name: player?.name || '?',
      placement: ordinal(idx + 1),
      ready: !!readyStates[playerId],
    };
  });

  return (
    <Animated.View
      style={[
        local.panel,
        {
          height: panelHeight,
          alignSelf: 'center',
          width: '100%',
          maxWidth: '100%',
          borderRadius: 10,
        },
      ]}
    >
      <View style={local.header}>
        <Text style={local.title}>Round Over</Text>
      </View>

      <View style={local.placementsContainer}>
        {placements.map((p) => (
          <View key={p.playerId} style={local.placementRow}>
            <Text style={local.placement}>{p.placement}</Text>
            <Text style={local.playerName}>{p.name}</Text>
            {p.ready && <Text style={local.readyBadge}>Ready</Text>}
          </View>
        ))}
      </View>

      <View style={local.expandedInfo}>
        <Text style={local.cardTradePrompt}>
          Cards trade: Losers (bottom 2) give highest cards to Winners (top 2).
        </Text>
      </View>
    </Animated.View>
  );
}

const local = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#e8e8e8',
    fontSize: 16,
    fontWeight: '600',
  },
  expandToggle: {
    color: '#e8e8e8',
    fontSize: 18,
    fontWeight: '700',
  },
  placementsContainer: {
    marginBottom: 8,
  },
  placementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  placement: {
    color: '#7aacd6',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
  },
  playerName: {
    color: colors.secondary,
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  readyBadge: {
    color: '#7aacd6',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedInfo: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTradePrompt: {
    color: colors.secondary,
    fontSize: 18,
    lineHeight: 16,
    opacity: 0.5,
  },
});
