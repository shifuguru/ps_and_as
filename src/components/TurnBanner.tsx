import React, { useEffect, useRef } from "react";
import { Animated, Text, View, StyleSheet } from "react-native";

type Props = {
  isYourTurn: boolean;
  opponentName?: string;
};

export default function TurnBanner({ isYourTurn, opponentName }: Props) {
  const slideX = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    slideX.setValue(-200);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        stiffness: 180,
        damping: 20,
        useNativeDriver: false,
      } as any),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    if (isYourTurn) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(dotPulse, { toValue: 0.4, duration: 600, useNativeDriver: false }),
        ])
      ).start();
    } else {
      dotPulse.stopAnimation();
      dotPulse.setValue(0.4);
    }
  }, [isYourTurn, opponentName]);

  return (
    <Animated.View
      style={[
        styles.container,
        isYourTurn ? styles.yourTurn : styles.waiting,
        { transform: [{ translateX: slideX }], opacity },
      ]}
    >
      {isYourTurn ? (
        <View style={styles.row}>
          <Animated.View style={[styles.dot, { opacity: dotPulse }]} />
          <Text style={styles.yourTurnText}>YOUR TURN</Text>
        </View>
      ) : (
        <Text style={styles.waitingText}>
          Waiting for {opponentName || "opponent"}...
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  yourTurn: {
    backgroundColor: "rgba(122,172,214,0.08)",
    borderWidth: 1,
    borderColor: "rgba(122,172,214,0.2)",
  },
  waiting: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7aacd6",
    marginRight: 10,
  },
  yourTurnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  waitingText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    fontSize: 14,
  },
});
