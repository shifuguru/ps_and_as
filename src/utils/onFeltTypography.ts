import type { TextStyle } from "react-native";
import type { FeltTextColors } from "../styles/themeColors";

export type OnFeltTextRole =
  | "primary"
  | "secondary"
  | "muted"
  | "accent"
  | "leave";

function feltColor(onFelt: FeltTextColors, role: OnFeltTextRole): string {
  switch (role) {
    case "primary":
      return onFelt.textPrimary;
    case "secondary":
      return onFelt.textSecondary;
    case "muted":
      return onFelt.textMuted;
    case "accent":
      return onFelt.accent;
    case "leave":
      return onFelt.leaveText;
  }
}

/** Text style for labels rendered on the table felt (includes ink shadow). */
export function onFeltTextStyle(
  onFelt: FeltTextColors,
  role: OnFeltTextRole,
  extra?: TextStyle,
): TextStyle {
  return {
    color: feltColor(onFelt, role),
    textShadowColor: onFelt.textShadow,
    textShadowOffset: onFelt.textShadowOffset,
    textShadowRadius: onFelt.textShadowRadius,
    ...extra,
  };
}
