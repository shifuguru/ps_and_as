import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

export default function ActionToast({ text, show = false, onDone }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (show) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => onDone && onDone());
    }
  }, [show]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] });
  if (!show) return null;
  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY }], opacity }]} pointerEvents="none">
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', bottom: 120, left: '50%', marginLeft: -60, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  text: { color: '#fff', fontWeight: '800' },
});
