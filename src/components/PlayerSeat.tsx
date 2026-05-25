import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import OpponentHand from './OpponentHand';
import TurnIndicator from './TurnIndicator';

export default function PlayerSeat({
  player,
  position = 'top',
  isActive = false,
  thinking = false,
  onPress,
}: any) {
  if (!player) return null;
  const name = player.name || 'Player';
  return (
    <View style={[styles.container, styles[position]]} pointerEvents="box-none">
      <TurnIndicator active={isActive} />
      <TouchableOpacity onPress={() => onPress && onPress(player)} style={styles.info}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name || '?').substr(0,2).toUpperCase()}</Text>
        </View>
        <View style={{ marginLeft: 8 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.count}>{player.hand ? player.hand.length : 0} cards</Text>
        </View>
      </TouchableOpacity>
      <OpponentHand count={player.hand ? player.hand.length : 0} revealed={false} />
      {thinking && <Text style={styles.thinking}>...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 30,
    width: 160,
  },
  top: { top: 8, left: '50%', marginLeft: -80 },
  left: { left: 8, top: '40%' },
  right: { right: 8, top: '40%' },
  bottom: { bottom: 8, left: '50%', marginLeft: -80 },
  info: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  name: { color: '#fff', fontWeight: '700' },
  count: { color: '#ccc', fontSize: 12 },
  thinking: { color: '#d4af37', marginTop: 6, fontWeight: '800' },
});
