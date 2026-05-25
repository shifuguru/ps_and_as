import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing, Text } from 'react-native';

// Simplified play animation layer: when `play` prop changes, animate a small
// card from source position to centre. Source is a {x,y} in percent (0-1)

export default function PlayAnimationLayer({ play }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!play) return;
    setVisible(true);
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setTimeout(() => setVisible(false), 80);
    });
  }, [play]);

  if (!play || !visible) return null;

  const start = play.source || { x: 0.5, y: 0.5 };

  // map percent to translate for simplicity
  const translateX = anim.interpolate({ inputRange: [0,1], outputRange: [(start.x - 0.5) * 600, 0] });
  const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [(start.y - 0.5) * 700, 0] });
  const scale = anim.interpolate({ inputRange: [0,1], outputRange: [0.9, 1.0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.card, { transform: [{ translateX }, { translateY }, { scale }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 60, height: 36, borderRadius: 6, backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignSelf: 'center', marginTop: '40%' },
});
