import React from "react";
import { Platform } from "react-native";
import { createPortal } from "react-dom";

type Props = {
  children: React.ReactNode;
};

/**
 * Mount splash on document.body so it stacks above #root.
 * z-index inside #root cannot escape body-level stacking for boot chrome.
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
