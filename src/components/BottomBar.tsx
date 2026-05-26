import React from "react";

import {

  View,

  StyleSheet,

  ViewStyle,

  StyleProp,

  Platform,

} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import BlurPanel from "./BlurPanel";

import { ACTION_BAR_HEIGHT } from "./ActionBar";



/** Height of controls below the hand (ActionBar + padding). Keep in sync with ActionBar. */

export const BOTTOM_CONTROLS_HEIGHT = ACTION_BAR_HEIGHT + 16;



/** Gap between the hand fan and the action buttons */

export const HAND_CONTROLS_GAP = 20;



/** Extra height the sheet extends past the bottom edge. */

export const BOTTOM_SHEET_BLEED = 32;



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

  const insets = useSafeAreaInsets();

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

      intensity={58}

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

