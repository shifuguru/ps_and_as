import React from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { createPortal } from "react-dom";
import { getWebOverlayPortalHost } from "../utils/webOverlayPortal";
import { isMobileWeb } from "../utils/webViewport";

const WebOverlayPortalContext = React.createContext(false);

/** True when rendered inside WebModalPortal (bottom bar must stay in-tree, not body-portal). */
export function useInWebOverlayPortal(): boolean {
  return React.useContext(WebOverlayPortalContext);
}

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Renders modals on document.body (mobile web) so they sit above the portaled bottom bar. */
export default function WebModalPortal({ children, style }: Props) {
  const tree = (
    <WebOverlayPortalContext.Provider value={true}>
      <View style={style}>{children}</View>
    </WebOverlayPortalContext.Provider>
  );

  if (Platform.OS === "web" && isMobileWeb()) {
    const host = getWebOverlayPortalHost();
    if (host) {
      return createPortal(tree, host);
    }
  }

  return tree;
}
