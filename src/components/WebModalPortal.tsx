import React from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { createPortal } from "react-dom";
import { getWebOverlayPortalHost } from "../utils/webOverlayPortal";
import { isMobileWeb } from "../utils/webViewport";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Renders modals on document.body (mobile web) so they sit above the portaled bottom bar. */
export default function WebModalPortal({ children, style }: Props) {
  if (Platform.OS === "web" && isMobileWeb()) {
    const host = getWebOverlayPortalHost();
    if (host) {
      return createPortal(<View style={style}>{children}</View>, host);
    }
  }

  return <View style={style}>{children}</View>;
}
