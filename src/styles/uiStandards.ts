import { themeForMode } from "./themeColors";
import { createUiStyles } from "./createUiStyles";

export { GOLD, buildAppTheme, themeForMode, type AppThemeColors, type ThemeMode } from "./themeColors";
export { createUiStyles, type UiStyles } from "./createUiStyles";

export function contentMaxWidth(
  windowWidth: number,
  max = 440,
  min = 300,
  horizontalPad = 48,
): number {
  return Math.min(max, Math.max(min, windowWidth - horizontalPad));
}

/** @deprecated Prefer `useAppTheme().ui` — static dark styles for legacy imports. */
const _dark = themeForMode("dark");
export const ui = createUiStyles(_dark);

/** @deprecated Prefer `useAppTheme().colors.blur.*` */
export const BLUR_CHROME = _dark.blur.chrome;
/** @deprecated Prefer `useAppTheme().colors.blur.*` */
export const BLUR_PANEL = _dark.blur.panel;
/** @deprecated Prefer `useAppTheme().colors.blur.*` */
export const BLUR_MODAL = _dark.blur.modal;
