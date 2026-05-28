export type ThemeMode = "light" | "dark";

export type BlurPreset = {
  intensity: number;
  scrimOpacity: number;
  webOpacity: number;
  tint: "dark" | "light";
};

/** Text colors for labels rendered directly on the table felt. */
export type FeltTextColors = {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  leaveText: string;
  textShadow: string;
  textShadowOffset: { width: number; height: number };
  textShadowRadius: number;
};

export type AppThemeColors = {
  mode: ThemeMode;
  /** Text colors tuned for readability on the current felt tint. */
  onFelt: FeltTextColors;
  /** Primary accent — monochrome lift of the felt hue (`colors.gold` legacy name). */
  gold: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnGold: string;
  panelBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  btnGoldBg: string;
  btnGoldBorder: string;
  btnGoldText: string;
  btnSecondaryBg: string;
  btnSecondaryBorder: string;
  btnSecondaryText: string;
  btnGhostBorder: string;
  btnGhostText: string;
  actionTrackBg: string;
  actionTrackBorder: string;
  actionPrimaryBg: string;
  actionPrimaryBorder: string;
  actionPrimaryText: string;
  actionPrimaryDisabledBg: string;
  actionPrimaryDisabledBorder: string;
  actionPrimaryDisabledText: string;
  actionSecondaryBg: string;
  actionSecondaryBorder: string;
  actionSecondaryText: string;
  leaveButtonBg: string;
  leaveButtonBorder: string;
  leaveButtonText: string;
  leaveText: string;
  modalOverlay: string;
  modalBorder: string;
  modalBody: string;
  emptyTitle: string;
  emptyBody: string;
  surface: string;
  feltWash: string;
  fullscreenScrim: string;
  statusBarStyle: "light" | "dark";
  blur: {
    chrome: BlurPreset;
    panel: BlurPreset;
    modal: BlurPreset;
  };
};

/** @deprecated Use theme accent via `colors.gold` — kept for legacy imports. */
export const GOLD = "#0A84FF";

export {
  buildAppTheme,
  buildThemeBundle,
  deriveFeltPalette,
  themeForMode,
  type FeltPalette,
} from "./feltPalette";
