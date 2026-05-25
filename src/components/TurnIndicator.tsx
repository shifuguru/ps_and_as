import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function TurnIndicator({ active = false }: any) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [active]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });

  if (!active) return <View style={{ width: 0, height: 0 }} />;

  return (
    <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity }]} pointerEvents="none" />
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(212,175,55,0.9)', top: -16, left: -16, zIndex: -1 },
});
