/**
 * Feature flags for gameplay presentation widgets.
 * Presentation-only — does not affect rules, networking, or XP.
 */
export const GAMEPLAY_PRESENTATION = {
  /** Hidden by default — revisit as centered in-game notifications. */
  upcomingAchievements: false,
  roundsInRow: true,
  avatarAmbient: true,
  lastTrick: true,
  trickScore: true,
  handGuidance: true,
  actionBarQuickLabels: true,
} as const;

export type GameplayPresentationFlag = keyof typeof GAMEPLAY_PRESENTATION;
