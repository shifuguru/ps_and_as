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
import { LOCAL_SEAT_TABLE_LIFT } from "../utils/tableLayout";
import { isMobileWeb } from "../utils/webViewport";
import { useAppTheme } from "../context/ThemeContext";



/** Height of controls below the hand (ActionBar + padding). Keep in sync with ActionBar. */

export const BOTTOM_CONTROLS_HEIGHT = ACTION_BAR_HEIGHT + 16;

/** Space for the centered leave pill below an action track (gap + button). */
export const BOTTOM_LEAVE_ROW_HEIGHT = 48;

/** Gap between the hand fan and the action buttons */
export const HAND_CONTROLS_GAP = 14;

/** Empty space above the fan inside the hand zone (clears the status pill). */
export const HAND_ZONE_TOP_CLEARANCE = 8;

/** Extra height the bottom sheet extends past the bottom edge. */
export const BOTTOM_SHEET_BLEED = 32;

function bottomSheetBleed(safeBottom = 0): number {
  // Mobile web shell is position:fixed with overflow:hidden — negative bottom
  // would push controls below the clip edge (safe-area belongs in padding only).
  if (Platform.OS === "web") return 0;
  return BOTTOM_SHEET_BLEED + Math.max(0, safeBottom);
}

function bottomBarOffset(safeBottom = 0): number {
  if (Platform.OS === "web") return 0;
  return -bottomSheetBleed(safeBottom);
}

function bottomBarPositionStyle(
  safeBottom = 0,
): ViewStyle {
  if (Platform.OS === "web" && isMobileWeb()) {
    return {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      width: "100%",
    } as object as ViewStyle;
  }
  return { bottom: bottomBarOffset(safeBottom) };
}

/** Clearance from the physical screen bottom to bar content (home indicator, etc.). */
export function bottomOuterPad(safeBottom = 0): number {
  const chrome = Math.max(0, safeBottom);
  if (Platform.OS === "web") {
    if (isMobileWeb()) {
      return Math.max(chrome, 20) + 14;
    }
    return Math.max(16, chrome + 12);
  }
  if (Platform.OS === "ios") {
    return Math.max(chrome, 20) + 14;
  }
  return chrome + 16;
}

/** Inner padding — offsets sheet bleed so controls sit above the home indicator. */
function bottomBarInnerPad(safeBottom = 0): number {
  return bottomOuterPad(safeBottom) + bottomSheetBleed(safeBottom);
}

/** Reserve scroll padding for a bottom panel with action track + leave (no hand). */
export function menuBottomReserve(safeBottom = 0): number {
  return ACTION_BAR_HEIGHT + 18 + BOTTOM_LEAVE_ROW_HEIGHT + bottomOuterPad(safeBottom) + 8;
}

/** Vertical space to reserve above the bottom sheet — keep in sync with GameScreen padding. */
export function reservedBottomHeight(
  safeBottom = 0,
  handVisible = true,
): number {
  const outerPad = bottomOuterPad(safeBottom);
  const handSection = handVisible
    ? HAND_FAN_HEIGHT + HAND_ZONE_TOP_CLEARANCE + HAND_CONTROLS_GAP + 2
    : 0;
  return 8 + handSection + BOTTOM_CONTROLS_HEIGHT + 4 + outerPad;
}

/** How far below the top of the bottom sheet the local seat sits (tune for felt/hand gap). */
export const LOCAL_SEAT_DROP_FROM_BAR_TOP = 48;

/** Screen-bottom offset for the local player avatar — just above the hand / action bar. */
export function localSeatBottomOffset(
  safeBottom = 0,
  handVisible = true,
): number {
  return (
    reservedBottomHeight(safeBottom, handVisible) -
    LOCAL_SEAT_DROP_FROM_BAR_TOP +
    LOCAL_SEAT_TABLE_LIFT
  );
}



type Props = {

  children?: React.ReactNode;

  style?: StyleProp<ViewStyle>;

  bottomOffset?: number;
  minHeight?: number;

};



export default function BottomBar({

  children,

  style,

  bottomOffset = 8,
  minHeight,

}: Props) {

  const { colors, blur } = useAppTheme();
  const insets = useLayoutInsets();
  const bottomInset = insets.bottom || 0;
  const paddingBottom = bottomBarInnerPad(bottomInset);

  return (

    <BlurPanel

      style={[

        styles.bar,

        { borderTopColor: colors.panelBorder },

        style,
        minHeight ? { minHeight } : undefined,

        { paddingBottom, ...bottomBarPositionStyle(bottomInset) },

      ]}

      preset={blur.chrome}

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

  live = false,

}: {

  onPress: () => void;

  label?: string;

  accessibilityLabel?: string;

  /** Red destructive tint for leaving an active game. */
  live?: boolean;

}) {

  const { ui } = useAppTheme();

  return (

    <TouchableOpacity

      style={live ? ui.leaveButtonLive : ui.leaveButton}

      onPress={onPress}

      accessibilityRole="button"

      accessibilityLabel={accessibilityLabel ?? label}

      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}

    >

      <Text style={live ? ui.leaveButtonLiveText : ui.leaveButtonText}>

        {label}

      </Text>

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

    paddingTop: 4,

  },

  controls: {

    width: "100%",

    paddingHorizontal: 16,

    paddingTop: 0,

    paddingBottom: 4,

  },

});

