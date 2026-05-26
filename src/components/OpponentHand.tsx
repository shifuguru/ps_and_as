import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

export default function OpponentHand({ count = 0, revealed = false }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1 + Math.min(0.18, count / 64), useNativeDriver: true }).start();
  }, [count]);

  // Render a small stacked card-back visual
  const backs = [] as any[];
  const visible = Math.min(6, Math.max(1, Math.floor(count / 3)));
  for (let i = 0; i < visible; i++) {
    backs.push(
      <View key={i} style={[styles.back, { left: i * 6, zIndex: i }]} />,
    );
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <View style={{ width: 72, height: 40, position: 'relative' }}>{backs}</View>
      <View style={styles.countOverlay}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 8 },
  back: { position: 'absolute', width: 72, height: 40, borderRadius: 6, backgroundColor: 'rgba(20,20,20,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  countOverlay: { position: 'absolute', right: -6, top: -6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(122,172,214,0.22)' },
  countText: { color: '#fff', fontWeight: '800' },
});
