import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  Platform,
} from "react-native";
import { createPortal } from "react-dom";
import { useLayoutInsets } from "../hooks/useLayoutInsets";
import BlurPanel from "./BlurPanel";
import { ACTION_BAR_HEIGHT } from "./ActionBar";
import { HAND_FAN_HEIGHT as DEFAULT_HAND_FAN_HEIGHT } from "./PlayerHand";
import {
  resolveBottomChromeMetrics,
  resolveControlsTopPad,
  resolveCompactHeightTier,
} from "../utils/compactGameLayout";
import { useVisualViewportSize } from "../hooks/useVisualViewportSize";
import { getWebBodyPortalHost } from "../utils/webBodyPortal";
import {
  isMobileWeb,
  resolveWebBottomInset,
  WEB_BOTTOM_BAR_SHELL_CLASS,
} from "../utils/webViewport";
import { useAppTheme } from "../context/ThemeContext";
import { useInWebOverlayPortal } from "./WebModalPortal";

/** Space between the top of the bottom bar and the Pass / Play row */
export const BOTTOM_CONTROLS_TOP_PAD = 8;

/** Height of controls below the hand (ActionBar + padding). Keep in sync with ActionBar. */
export const BOTTOM_CONTROLS_HEIGHT =
  ACTION_BAR_HEIGHT + BOTTOM_CONTROLS_TOP_PAD + 12;

/** Space for the centered leave pill below an action track (gap + button). */
export const BOTTOM_LEAVE_ROW_HEIGHT = 48;

/** Gap between the hand fan and the action buttons */
export const HAND_CONTROLS_GAP = 18;

/** Empty space above the fan inside the hand zone. */
export const HAND_ZONE_TOP_CLEARANCE = 4;

const CONTENT_MARGIN = 8;

function useWebBottomBarShell(): boolean {
  return Platform.OS === "web" && isMobileWeb();
}

/** Inner padding below controls inside the bar shell (above home indicator). */
export function bottomContentInset(safeBottom = 0): number {
  if (Platform.OS === "web" && isMobileWeb()) {
    // Home-indicator inset is on .ps-bottom-bar-shell via CSS env(safe-area-inset-bottom).
    return CONTENT_MARGIN;
  }
  const chrome = resolveWebBottomInset(safeBottom);
  if (Platform.OS === "ios") {
    return Math.max(chrome, 12) + CONTENT_MARGIN;
  }
  return chrome + 12;
}

/** Total bottom chrome height for layout reservation above the screen edge. */
export function bottomOuterPad(safeBottom = 0): number {
  if (Platform.OS === "web" && isMobileWeb()) {
    return resolveWebBottomInset(safeBottom) + CONTENT_MARGIN;
  }
  return bottomContentInset(safeBottom);
}

/** Reserve scroll padding for a bottom panel with action track + leave (no hand). */
export function menuBottomReserve(safeBottom = 0): number {
  return ACTION_BAR_HEIGHT + 18 + BOTTOM_LEAVE_ROW_HEIGHT + bottomOuterPad(safeBottom) + 8;
}

/** Vertical space to reserve above the bottom sheet — keep in sync with GameScreen padding. */
export function reservedBottomHeight(
  safeBottom = 0,
  handVisible = true,
  shellHeight?: number,
): number {
  const outerPad = bottomOuterPad(safeBottom);
  if (shellHeight != null && shellHeight > 0) {
    return resolveBottomChromeMetrics(
      shellHeight,
      safeBottom,
      handVisible,
      outerPad,
    ).reservedHeight;
  }
  const handSection = handVisible
    ? DEFAULT_HAND_FAN_HEIGHT + HAND_ZONE_TOP_CLEARANCE + HAND_CONTROLS_GAP + 2
    : 0;
  return 8 + handSection + BOTTOM_CONTROLS_HEIGHT + 4 + outerPad;
}

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<object>;
  bottomOffset?: number;
  minHeight?: number;
};

export default function BottomBar({
  children,
  style,
  minHeight,
}: Props) {
  const { colors, blur } = useAppTheme();
  const insets = useLayoutInsets();
  const contentInset = bottomContentInset(insets.bottom);
  const webShell = useWebBottomBarShell();
  const inOverlayPortal = useInWebOverlayPortal();
  const portalHost =
    webShell && !inOverlayPortal ? getWebBodyPortalHost() : null;

  const bar = (
    <BlurPanel
      className={webShell ? WEB_BOTTOM_BAR_SHELL_CLASS : undefined}
      style={[
        styles.bar,
        { borderTopColor: colors.panelBorder },
        style,
        minHeight ? { minHeight } : undefined,
        webShell ? (styles.webShell as object) : null,
        !webShell && insets.bottom > 0
          ? { paddingBottom: insets.bottom }
          : null,
      ]}
      preset={blur.chrome}
      intensity={blur.chrome.intensity + 6}
      scrimOpacity={blur.chrome.scrimOpacity * 0.72}
      webOpacity={blur.chrome.webOpacity * 0.82}
    >
      <View style={[styles.inner, { paddingBottom: contentInset }]}>
        {children}
      </View>
    </BlurPanel>
  );

  if (webShell && portalHost) {
    return createPortal(bar, portalHost);
  }

  return bar;
}

/** Full-width zone for the card fan — no horizontal padding. */
export function BottomBarHand({
  children,
  height,
  controlsGap = HAND_CONTROLS_GAP,
  bottomPad = 0,
  style,
}: {
  children?: React.ReactNode;
  height: number;
  controlsGap?: number;
  bottomPad?: number;
  style?: StyleProp<object>;
}) {
  return (
    <View
      style={[
        styles.handZone,
        {
          height: height + bottomPad,
          marginBottom: controlsGap,
          paddingBottom: bottomPad,
        },
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
  style?: StyleProp<object>;
}) {
  const { height: viewportHeight } = useVisualViewportSize();
  const tier = resolveCompactHeightTier(viewportHeight);
  const topPad = resolveControlsTopPad(tier);

  return (
    <View style={[styles.controls, { paddingTop: topPad }, style]}>
      {children}
    </View>
  );
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

const FLOAT_INSET = 10;

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: FLOAT_INSET,
    right: FLOAT_INSET,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 16 },
    }),
  },
  webShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
  } as object,
  inner: {
    width: "100%",
  },
  handZone: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingTop: 0,
  },
  controls: {
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
});
