import React from "react";
import { View, StyleSheet } from "react-native";
import PresenceRing from "./PresenceRing";
import type { PresenceRingSpec } from "../presence/types";

type Props = {
  spec: PresenceRingSpec;
  avatarSize: number;
};

/** Sizes and positions the presence ring around an avatar (matches OpponentSeat avatarWrap). */
export default function PresenceRingHost({ spec, avatarSize }: Props) {
  return (
    <View style={styles.host} pointerEvents="none">
      <PresenceRing spec={spec} avatarSize={avatarSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
});
