import React from "react";

import {

  View,

  Text,

  TouchableOpacity,

  StyleSheet,

  ViewStyle,

  StyleProp,

  Platform,

} from "react-native";

import { useLayoutInsets } from "../hooks/useLayoutInsets";

import BlurPanel from "./BlurPanel";
import { ACTION_BAR_HEIGHT } from "./ActionBar";
import { HAND_FAN_HEIGHT } from "./PlayerHand";
import { ui } from "../styles/uiStandards";



/** Height of controls below the hand (ActionBar + padding). Keep in sync with ActionBar. */

export const BOTTOM_CONTROLS_HEIGHT = ACTION_BAR_HEIGHT + 16;

/** Space for the centered leave pill below an action track (gap + button). */
export const BOTTOM_LEAVE_ROW_HEIGHT = 34;



/** Gap between the hand fan and the action buttons */

export const HAND_CONTROLS_GAP = 20;



/** Extra height the sheet extends past the bottom edge. */

export const BOTTOM_SHEET_BLEED = 32;

/** Reserve scroll padding for a bottom panel with action track + leave (no hand). */
export function menuBottomReserve(safeBottom = 0): number {
  const outerPad =
    Platform.OS === "web" ? 12 + BOTTOM_SHEET_BLEED : safeBottom + 10;
  return ACTION_BAR_HEIGHT + 18 + BOTTOM_LEAVE_ROW_HEIGHT + outerPad + 8;
}

/** Vertical space to reserve above the bottom sheet — keep in sync with GameScreen padding. */
export function reservedBottomHeight(
  safeBottom = 0,
  handVisible = true,
): number {
  const outerPad =
    Platform.OS === "web" ? 12 + BOTTOM_SHEET_BLEED : safeBottom + 10;
  const handSection = handVisible
    ? HAND_FAN_HEIGHT + HAND_CONTROLS_GAP + 2
    : 0;
  return 8 + handSection + BOTTOM_CONTROLS_HEIGHT + 4 + outerPad;
}

/** How far below the top of the bottom sheet the local seat sits (tune for felt/hand gap). */
export const LOCAL_SEAT_DROP_FROM_BAR_TOP = 52;

/** Screen-bottom offset for the local player seat — just above the hand fan. */
export function localSeatBottomOffset(
  safeBottom = 0,
  handVisible = true,
): number {
  return reservedBottomHeight(safeBottom, handVisible) - LOCAL_SEAT_DROP_FROM_BAR_TOP;
}



type Props = {

  children?: React.ReactNode;

  style?: StyleProp<ViewStyle>;

  bottomOffset?: number;

};



export default function BottomBar({

  children,

  style,

  bottomOffset = 8,

}: Props) {

  const insets = useLayoutInsets();

  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom || 0;

  const paddingBottom =
    Platform.OS === "web"
      ? 12 + BOTTOM_SHEET_BLEED
      : bottomInset + 10;



  return (

    <BlurPanel

      style={[

        styles.bar,

        style,

        { paddingBottom, bottom: -BOTTOM_SHEET_BLEED },

      ]}

      intensity={42}
      scrimOpacity={0.16}
      webOpacity={0.05}

    >

      {children}

    </BlurPanel>

  );

}



/** Full-width zone for the card fan — no horizontal padding. */

export function BottomBarHand({

  children,

  height,

  style,

}: {

  children?: React.ReactNode;

  height: number;

  style?: StyleProp<ViewStyle>;

}) {

  return (

    <View

      style={[

        styles.handZone,

        { height, marginBottom: HAND_CONTROLS_GAP },

        style,

      ]}

    >

      {children}

    </View>

  );

}



/** Padded zone for action buttons — sits below the hand, never overlaps it. */

export function BottomBarControls({

  children,

  style,

}: {

  children?: React.ReactNode;

  style?: StyleProp<ViewStyle>;

}) {

  return <View style={[styles.controls, style]}>{children}</View>;

}



/** Centered leave control — always sits below the primary action track. */

export function BottomBarLeave({

  onPress,

  label = "Leave",

  accessibilityLabel,

}: {

  onPress: () => void;

  label?: string;

  accessibilityLabel?: string;

}) {

  return (

    <TouchableOpacity

      style={ui.leaveButton}

      onPress={onPress}

      accessibilityRole="button"

      accessibilityLabel={accessibilityLabel ?? label}

      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}

    >

      <Text style={ui.leaveButtonText}>{label}</Text>

    </TouchableOpacity>

  );

}



const styles = StyleSheet.create({

  bar: {

    position: "absolute",

    left: 0,

    right: 0,

    bottom: 0,

    zIndex: 50,

    elevation: 50,

    borderTopLeftRadius: 28,

    borderTopRightRadius: 28,

    overflow: "hidden",

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: "rgba(255,255,255,0.14)",

    ...Platform.select({

      ios: {

        shadowColor: "#000",

        shadowOffset: { width: 0, height: -8 },

        shadowOpacity: 0.28,

        shadowRadius: 20,

      },

      android: { elevation: 24 },

    }),

  },

  handZone: {

    width: "100%",

    overflow: "visible",

    justifyContent: "flex-end",

    paddingTop: 8,

  },

  controls: {

    width: "100%",

    paddingHorizontal: 16,

    paddingTop: 2,

    paddingBottom: 4,

  },

});

