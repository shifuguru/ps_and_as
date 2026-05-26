import { StyleSheet } from "react-native";

/** Primary accent — felt / gold glass UI */
export const GOLD = "#d4af37";

export const BLUR_CHROME = {
  intensity: 40,
  scrimOpacity: 0.16,
  webOpacity: 0.05,
} as const;

export const BLUR_PANEL = {
  intensity: 48,
  scrimOpacity: 0.28,
  webOpacity: 0.08,
} as const;

export const BLUR_MODAL = {
  intensity: 62,
  scrimOpacity: 0.28,
  webOpacity: 0.08,
} as const;

export function contentMaxWidth(
  windowWidth: number,
  max = 440,
  min = 300,
  horizontalPad = 48,
): number {
  return Math.min(max, Math.max(min, windowWidth - horizontalPad));
}

export const ui = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  topBarSide: {
    minWidth: 52,
  },
  leaveText: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "700",
  },
  leaveButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  leaveButtonText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  screenTitle: {
    flex: 1,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
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
    borderColor: "rgba(255,255,255,0.12)",
  },
  panelEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#ffffff",
  },
  btnGold: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: "rgba(212,175,55,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    alignItems: "center",
  },
  btnGoldText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  btnGoldFill: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: GOLD,
    alignItems: "center",
  },
  btnGoldFillText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "800",
  },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    fontSize: 14,
  },
  btnGhost: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  btnGhostText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    fontWeight: "600",
  },
  actionTrack: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    padding: 5,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 52,
  },
  actionPrimary: {
    flex: 1.45,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "rgba(212,175,55,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionPrimaryText: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 15,
  },
  actionPrimaryDisabled: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  actionPrimaryTextDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
  actionSecondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionSecondaryText: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
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
    borderColor: "rgba(212,175,55,0.3)",
  },
  modalTitle: {
    color: GOLD,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    textAlign: "center",
    marginBottom: 6,
  },
  modalBody: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
