import { Platform, TextStyle, ViewStyle } from "react-native";

/** Center content in a pressable button shell (both axes). */
export const BUTTON_CENTER: Pick<ViewStyle, "alignItems" | "justifyContent"> = {
  alignItems: "center",
  justifyContent: "center",
};

/** Single-line button label — dead centre on iOS and Android. */
export const BUTTON_LABEL: TextStyle = {
  textAlign: "center",
  ...(Platform.OS === "android"
    ? { includeFontPadding: false, textAlignVertical: "center" }
    : {}),
};

export function buttonLabel(
  fontSize: number,
  extra?: TextStyle,
): TextStyle {
  return {
    ...BUTTON_LABEL,
    fontSize,
    lineHeight: Math.round(fontSize * 1.2),
    ...extra,
  };
}
