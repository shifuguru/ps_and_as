/**
 * Centralized in-app text, grouped by feature area — similar in spirit to GTA's
 * .GXT text tables: one place to find/edit any string instead of hunting through
 * components. Add new entries to the matching category (or start a new one),
 * then import `strings` where the text is used.
 */
export const strings = {
  common: {
    back: "Back",
    leave: "Leave",
    cancel: "Cancel",
    ok: "OK",
    loading: "Loading…",
  },
  menu: {
    title: "P's & A's",
    subtitle: "Presidents & Assholes",
  },
  achievements: {
    tabAchievements: "Achievements",
    tabTitles: "Titles",
    loadingProfile: "Loading Profile…",
  },
  updateLog: {
    screenTitle: "What's New",
    updatesEyebrow: "Updates",
    timezoneHint: "Times are currently shown as NZ Time.",
    recentUpdatesHeading: "Recent Updates",
    weAreWatchingHeading: "Bug Hunt!",
    weAreWatchingHint: "All the bugs we're tracking, if you find any please let us know on our official Instagram.",
    instagramAt: "@psandasofficial",
  },
  alerts: {
    removeAdsThanksTitle: "Thank you!",
    removeAdsThanksMessage:
      "Your account has been upgraded. Forced ads will no longer appear on this Google-linked account.",
    removeAdsPendingTitle: "Purchase received.",
    removeAdsPendingMessage: "Ads still showing? An account sync could still be in progress, please wait a few minutes. If you continue to have issues, please reach out to us on Instagram.",
  },
  support: {
    playerHubMessage:
      "P's & A's was made by a micro-team in New Zealand. Ko-fi helps cover our running costs.",
  },
} as const;

export type Strings = typeof strings;
