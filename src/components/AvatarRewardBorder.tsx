import React, { useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import type { AvatarBorderDesign } from "../rewards/avatarBorders";

type Props = {
  design: AvatarBorderDesign;
  avatarSize: number;
};

/** Decorative achievement border — sits just below the avatar circle. */
export default function AvatarRewardBorder({ design, avatarSize }: Props) {
  const styles = useMemo(
    () => createStyles(design.glowColor, avatarSize),
    [design.glowColor, avatarSize],
  );

  return (
    <View
      style={styles.host}
      pointerEvents="none"
      accessibilityLabel={design.label}
      accessibilityHint="Achievement reward border"
    >
      {design.kind === "wings" ? (
        <>
          <View
            style={[
              styles.wing,
              styles.wingLeft,
              { backgroundColor: design.primaryColor },
            ]}
          >
            <View
              style={[styles.wingHighlight, { backgroundColor: design.secondaryColor }]}
            />
          </View>
          <View
            style={[
              styles.wing,
              styles.wingRight,
              { backgroundColor: design.primaryColor },
            ]}
          >
            <View
              style={[styles.wingHighlight, { backgroundColor: design.secondaryColor }]}
            />
          </View>
        </>
      ) : null}

      {design.kind === "flames" ? (
        <>
          <View style={[styles.flame, styles.flameLeft, { backgroundColor: design.primaryColor }]}>
            <View style={[styles.flameCore, { backgroundColor: design.secondaryColor }]} />
          </View>
          <View style={[styles.flame, styles.flameRight, { backgroundColor: design.primaryColor }]}>
            <View style={[styles.flameCore, { backgroundColor: design.secondaryColor }]} />
          </View>
        </>
      ) : null}

      {design.kind === "laurel" ? (
        <View style={[styles.laurelArc, { borderColor: design.primaryColor }]}>
          <View style={[styles.laurelLeaf, styles.laurelLeafLeft, { backgroundColor: design.secondaryColor }]} />
          <View style={[styles.laurelGem, { backgroundColor: design.primaryColor }]} />
          <View style={[styles.laurelLeaf, styles.laurelLeafRight, { backgroundColor: design.secondaryColor }]} />
        </View>
      ) : null}

      {design.kind === "crown" ? (
        <View style={styles.crownRow}>
          <View style={[styles.crownSpike, { borderBottomColor: design.primaryColor }]} />
          <View style={[styles.crownSpike, styles.crownSpikeMid, { borderBottomColor: design.secondaryColor }]} />
          <View style={[styles.crownSpike, { borderBottomColor: design.primaryColor }]} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(glowColor: string, avatarSize: number) {
  const wingW = Math.max(14, Math.round(avatarSize * 0.36));
  const wingH = Math.max(8, Math.round(avatarSize * 0.16));
  const spread = Math.round(avatarSize * 0.08);

  return StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      width: avatarSize,
      height: wingH + 4,
      bottom: -Math.round(wingH * 0.72),
      zIndex: 11,
      overflow: "visible",
      ...Platform.select({
        ios: {
          shadowColor: glowColor,
          shadowOpacity: 0.65,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 1 },
        },
        default: {},
      }),
    },
    wing: {
      position: "absolute",
      bottom: 0,
      width: wingW,
      height: wingH,
      borderTopLeftRadius: wingW,
      borderTopRightRadius: wingW,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      overflow: "hidden",
    },
    wingLeft: {
      left: spread,
      transform: [{ rotate: "-22deg" }],
    },
    wingRight: {
      right: spread,
      transform: [{ rotate: "22deg" }],
    },
    wingHighlight: {
      position: "absolute",
      top: "22%",
      left: "18%",
      width: "55%",
      height: "42%",
      borderRadius: 999,
      opacity: 0.85,
    },
    flame: {
      position: "absolute",
      bottom: 0,
      width: Math.max(10, Math.round(avatarSize * 0.18)),
      height: Math.max(12, Math.round(avatarSize * 0.22)),
      borderTopLeftRadius: 999,
      borderTopRightRadius: 999,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 2,
    },
    flameLeft: {
      left: spread + 2,
      transform: [{ rotate: "-8deg" }],
    },
    flameRight: {
      right: spread + 2,
      transform: [{ rotate: "8deg" }],
    },
    flameCore: {
      width: "46%",
      height: "50%",
      borderRadius: 999,
      marginBottom: 1,
    },
    laurelArc: {
      position: "absolute",
      bottom: 0,
      alignSelf: "center",
      width: Math.round(avatarSize * 0.72),
      height: Math.max(8, Math.round(avatarSize * 0.12)),
      borderWidth: 2,
      borderTopWidth: 0,
      borderBottomLeftRadius: 999,
      borderBottomRightRadius: 999,
      backgroundColor: "rgba(0,0,0,0.18)",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    laurelLeaf: {
      position: "absolute",
      bottom: 2,
      width: 7,
      height: 4,
      borderRadius: 999,
    },
    laurelLeafLeft: {
      left: 8,
      transform: [{ rotate: "-28deg" }],
    },
    laurelLeafRight: {
      right: 8,
      transform: [{ rotate: "28deg" }],
    },
    laurelGem: {
      width: 5,
      height: 5,
      borderRadius: 999,
      marginBottom: 1,
    },
    crownRow: {
      position: "absolute",
      bottom: 0,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
    },
    crownSpike: {
      width: 0,
      height: 0,
      borderLeftWidth: 4,
      borderRightWidth: 4,
      borderBottomWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
    },
    crownSpikeMid: {
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderBottomWidth: 10,
      marginBottom: 1,
    },
  });
}
