import { Platform, StyleSheet, type ViewStyle } from "react-native";
import type { AppThemeColors } from "./themeColors";
import { onFeltTextStyle } from "../utils/onFeltTypography";
import { BUTTON_CENTER, buttonLabel } from "./buttonStyles";

/** Soft floating shadow — iOS liquid-glass style lift over content behind. */
const leaveButtonShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
  },
  android: { elevation: 8 },
  default: {
    // Web / others — soft ambient drop, not a hard edge.
    boxShadow: "0 5px 24px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.14)",
  },
}) as ViewStyle;

export function createUiStyles(c: AppThemeColors) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    topBarSide: {
      minWidth: 52,
    },
    leaveText: {
      fontSize: 15,
      fontWeight: "700",
      ...onFeltTextStyle(c.onFelt, "leave"),
    },
    leaveButton: {
      alignSelf: "center",
      marginTop: 10,
      paddingHorizontal: 22,
      minHeight: 44,
      borderRadius: 999,
      backgroundColor: c.leaveButtonBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.leaveButtonBorder,
      ...leaveButtonShadow,
      ...BUTTON_CENTER,
    },
    leaveButtonText: buttonLabel(14, {
      color: c.leaveButtonText,
      fontWeight: "700",
      letterSpacing: 0.2,
    }),
    leaveButtonLive: {
      alignSelf: "center",
      marginTop: 10,
      paddingHorizontal: 22,
      minHeight: 44,
      borderRadius: 999,
      backgroundColor: c.leaveButtonLiveBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.leaveButtonLiveBorder,
      ...leaveButtonShadow,
      ...BUTTON_CENTER,
    },
    leaveButtonLiveText: buttonLabel(14, {
      color: c.leaveButtonLiveText,
      fontWeight: "800",
      letterSpacing: 0.2,
    }),
    screenTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.3,
      ...onFeltTextStyle(c.onFelt, "primary"),
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      paddingHorizontal: 24,
    },
    panel: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.panelBorder,
    },
    panelEyebrow: {
      color: c.gold,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    fieldLabel: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginBottom: 6,
    },
    input: {
      backgroundColor: c.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.inputText,
    },
    btnGold: {
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 44,
      backgroundColor: c.btnGoldBg,
      borderWidth: 1,
      borderColor: c.btnGoldBorder,
      ...BUTTON_CENTER,
    },
    btnGoldText: buttonLabel(14, {
      color: c.btnGoldText,
      fontWeight: "700",
    }),
    btnGoldFill: {
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 44,
      backgroundColor: c.gold,
      ...BUTTON_CENTER,
    },
    btnGoldFillText: buttonLabel(14, {
      color: c.textOnGold,
      fontWeight: "800",
    }),
    btnSecondary: {
      borderRadius: 14,
      paddingHorizontal: 14,
      minHeight: 44,
      backgroundColor: c.btnSecondaryBg,
      borderWidth: 1,
      borderColor: c.btnSecondaryBorder,
      ...BUTTON_CENTER,
    },
    btnSecondaryText: buttonLabel(14, {
      color: c.btnSecondaryText,
      fontWeight: "700",
    }),
    btnGhost: {
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 44,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.btnGhostBorder,
      ...BUTTON_CENTER,
    },
    btnGhostText: buttonLabel(14, {
      color: c.btnGhostText,
      fontWeight: "600",
    }),
    actionTrack: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      padding: 5,
      borderRadius: 18,
      backgroundColor: c.actionTrackBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.actionTrackBorder,
      minHeight: 52,
    },
    actionPrimary: {
      flex: 1.45,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.actionPrimaryBorder,
      backgroundColor: c.actionPrimaryBg,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
    },
    actionPrimaryText: buttonLabel(15, {
      color: c.actionPrimaryText,
      fontWeight: "800",
    }),
    actionPrimaryDisabled: {
      borderColor: c.actionPrimaryDisabledBorder,
      backgroundColor: c.actionPrimaryDisabledBg,
    },
    actionPrimaryTextDisabled: {
      color: c.actionPrimaryDisabledText,
    },
    actionSecondary: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.actionSecondaryBorder,
      backgroundColor: c.actionSecondaryBg,
      paddingHorizontal: 14,
      minHeight: 48,
      ...BUTTON_CENTER,
    },
    actionSecondaryText: buttonLabel(15, {
      color: c.actionSecondaryText,
      fontWeight: "700",
    }),
    modalOverlay: {
      flex: 1,
      backgroundColor: c.modalOverlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 320,
      borderRadius: 18,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.modalBorder,
    },
    modalTitle: {
      color: c.gold,
      fontWeight: "800",
      fontSize: 12,
      letterSpacing: 0.5,
      textAlign: "center",
      marginBottom: 6,
    },
    modalBody: {
      color: c.modalBody,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      color: c.emptyTitle,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 8,
      textAlign: "center",
    },
    emptyBody: {
      color: c.emptyBody,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
  });
}

export type UiStyles = ReturnType<typeof createUiStyles>;
