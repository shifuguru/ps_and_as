import React from "react";
import { Platform } from "react-native";
import { createPortal } from "react-dom";

type Props = {
  children: React.ReactNode;
};

/**
 * Mount splash on document.body so it stacks above viewport-fixed shell
 * portals. z-index inside #root cannot escape that stacking context.
 */
export default function WebSplashPortal({ children }: Props) {
  if (Platform.OS === "web") {
    const doc = (globalThis as { document?: Document }).document;
    const body = doc?.body;
    if (body) {
      return createPortal(children, body);
    }
  }
  return <>{children}</>;
}
