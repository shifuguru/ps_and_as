import type { AppThemeColors } from "../styles/themeColors";
import { hexToRgba } from "../utils/colorTheory";

export function tableChatBubbleColors(colors: AppThemeColors) {
  return {
    background: colors.mode === "dark" ? "#f4f7f5" : "#ffffff",
    text: colors.mode === "dark" ? "#102018" : "#173126",
    border: hexToRgba(colors.accent, 0.45),
  };
}
