export type UpdateEntry = {
  /** NZST/NZDT ISO instant (+12:00 or +13:00) — displayed in Pacific/Auckland. */
  publishedAt: string;
  title: string;
  items: string[];
};

export type KnownIssue = {
  title: string;
  status: "Looking into it" | "Fix shipped" | "Monitoring";
  note: string;
  /** When this issue note was last updated (NZST/NZDT ISO). */
  updatedAt?: string;
};

export const UPDATE_LOG_TAGLINE =
  "What's changed since the last update.";

export { formatUpdateTimestamp } from "../utils/formatLocalDateTime";

/** Author changelog times in NZST wall clock (UTC+12). Use nzdt() during daylight saving. */
export function nzst(local: string): string {
  const base = local.length === 16 ? `${local}:00` : local;
  return `${base}+12:00`;
}

export function nzdt(local: string): string {
  const base = local.length === 16 ? `${local}:00` : local;
  return `${base}+13:00`;
}

export const UPDATE_ENTRIES: UpdateEntry[] = [
  {
    publishedAt: nzst("2026-08-20T16:09"),
    title: "Online games start more reliably",
    items: [
      "Online startup and room entry are less likely to stall before play begins",
      "Round transitions now recover more cleanly when online messages arrive out of order",
    ],
  },
  {
    publishedAt: nzst("2026-08-14T22:13"),
    title: "Pick up an online game where you left it",
    items: [
      "A pending online lobby now appears on the Home Hub below Play with Friends",
      "Rejoin the table without digging through the lobby again",
    ],
  },
  {
    publishedAt: nzst("2026-08-14T00:12"),
    title: "Achievements and titles share a home",
    items: [
      "Achievements and title tracks now sit in swipeable profile tabs",
      "Move between career progress and the title you want to wear without leaving the profile",
    ],
  },
  {
    publishedAt: nzst("2026-08-13T23:39"),
    title: "Online tables are easier to join and talk in",
    items: [
      "Room names, party counts, and lobby actions are clearer",
      "Quick chat emotes now appear beside the player who sent them",
      "Play with Friends puts the table and its main actions first",
      "Skipping deal animations is less likely to desync an online table",
    ],
  },
  {
    publishedAt: nzst("2026-08-13T23:04"),
    title: "CPU opponents play more of the hand",
    items: [
      "CPU opponents can now lead doubles, triples, and four-of-a-kind when they hold them",
      "CPU play no longer stalls after closing a 10-rank across turns",
    ],
  },
  {
    publishedAt: nzst("2026-08-13T00:30"),
    title: "Cleaner passes and Joker turns",
    items: [
      "Passing clears stale card selections",
      "Joker turns acknowledge and move on instead of leaving the table hanging",
    ],
  },
  {
    publishedAt: nzst("2026-08-12T10:31"),
    title: "Titles, daily rewards, and more reasons to return",
    items: [
      "Titles can now be earned from your career and selected from your profile",
      "Daily login rewards add XP when you claim them",
      "Achievement progress and XP now have more visible places to go",
    ],
  },
  {
    publishedAt: nzst("2026-08-06T16:28"),
    title: "The rules page catches up with the game",
    items: [
      "The in-game Rules page now reflects the house rules more accurately",
      "Daily challenges became tap-to-claim, so XP is awarded when you choose to collect it",
      "Quick Game and post-trade opening fixes cover CPU and online stalls players could actually hit",
    ],
  },
  {
    publishedAt: nzst("2026-08-04T22:16"),
    title: "Rules and progress are easier to find",
    items: [
      "Game Rules now sits beside the main play choices on Home",
      "Settings and Achievements are next to your player name",
      "A Rules button is available from the table when you need a reminder",
    ],
  },
  {
    publishedAt: nzst("2026-08-03T15:51"),
    title: "Google sync shows what came across",
    items: [
      "Settings now makes it clear when your profile is linked to Google",
      "Sync reports your Level and XP after the transfer, including when cloud progress is empty",
    ],
  },
  {
    publishedAt: nzst("2026-07-21T23:59"),
    title: "July — phones, profiles, and a busier table",
    items: [
      "The finishing play now stays visible before the last cards and rankings appear",
      "The Player Hub brings your profile, goals, achievements, and local/online play together",
      "Achievements now have prestige ranks, career totals, rarity progress, and role counts",
      "Runs and 10s received clearer in-game guidance, while the table and HUD became easier to read",
      "Dark mode is the default for new visitors; Instagram browsers now point players to a proper browser session",
      "Phone play gained clearer install guidance, portrait locking, safer private hands during online trades, and better small-screen spacing",
    ],
  },
  {
    publishedAt: nzst("2026-06-30T23:59"),
    title: "June — On Top, online tables, and the rules getting teeth",
    items: [
      "On Top turns work after 10s and after Runs, including the extra beat or Skip that closes the trick",
      "Runs stay active through valid extensions and step-backs; 10s do not trigger Higher/Lower inside a Run",
      "10 Lower now requires the same number of cards as the 10 pile",
      "Quad Bombs, Quad Runs, K–A–2 runs, and Joker restrictions are in the game",
      "Online play gained public table browsing, room codes, spectator mode, dead-hand handling for two players, rejoin support, and President/Asshole trades",
      "Open Bot Table and Quick Game received fixes for stuck turns, late passes, Joker clears, and round transitions",
      "Runs and tricks now award XP through the round scoreboard; profiles, achievements, avatar borders, and player shouts add longer-term progress",
      "Mobile/PWA play gained home-screen install guidance, responsive hand layouts, card flights, and clearer turn controls",
    ],
  },
  {
    publishedAt: nzst("2026-05-31T23:59"),
    title: "May — the first proper table",
    items: [
      "The core loop arrived: shed your hand, finish in order, take a role, trade cards, and deal again",
      "President, Asshole, Vice President, and Vice Asshole roles now carry consequences into the next deal",
      "Runs, 10 Higher/Lower, On Top, Jokers, four-of-a-kind, Quad Bombs, and Quad Runs establish the game's deeper identity",
      "Online rooms, room codes, profiles, spectator seating, a two-player dead hand, CPU opponents, and up-to-eight-player tables were added",
      "Felt themes, light/dark cards, achievements, XP, career stats, and the first Quick Game progression arrived with the table",
    ],
  },
];

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: "Achievement stats in lobbies",
    status: "Monitoring",
    updatedAt: nzst("2026-05-28T17:36"),
    note: "You can view your own achievements from a player profile. Other players' progress isn't shared yet.",
  },
];

/** Latest publish/update instant across entries and known issues (ISO). */
export function latestUpdateLogTimestamp(): string {
  let latest = 0;
  for (const entry of UPDATE_ENTRIES) {
    latest = Math.max(latest, Date.parse(entry.publishedAt));
  }
  for (const issue of KNOWN_ISSUES) {
    if (issue.updatedAt) {
      latest = Math.max(latest, Date.parse(issue.updatedAt));
    }
  }
  return new Date(latest).toISOString();
}

/** Count update entries and known-issue updates newer than last seen (ISO). */
export function countUnreadUpdateNotifications(lastSeenAt: string | null): number {
  const seenMs = lastSeenAt ? Date.parse(lastSeenAt) : Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const entry of UPDATE_ENTRIES) {
    if (Date.parse(entry.publishedAt) > seenMs) count += 1;
  }
  for (const issue of KNOWN_ISSUES) {
    if (issue.updatedAt && Date.parse(issue.updatedAt) > seenMs) count += 1;
  }
  return count;
}
