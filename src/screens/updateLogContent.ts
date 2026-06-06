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
  "New rules, fixes, and polish — the stuff that changes how you play.";

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
    publishedAt: nzst("2026-06-06T15:11:42"),
    title: "Card flight landing",
    items: [
      "Your plays — cards from your hand land directly on the pile without a visible overshoot or snap at the end",
    ],
  },
  {
    publishedAt: nzst("2026-06-06T00:43"),
    title: "Round end & 10 Lower",
    items: [
      "Online — reconnect or refresh after a round ends and you still get the last hand, then rankings",
      "10 Lower — you must play the same number of cards as the 10 pile (no triple beat on a single 10)",
    ],
  },
  {
    publishedAt: nzst("2026-06-05T14:31:41"),
    title: "Turn timing & table polish",
    items: [
      "Your hand — playable cards light up only after the last play lands on the table",
      "Quick Game — opponents keep going after your first play; no more stuck turns",
      "Your plays — cards stay in the fan until they fly; no empty gap when you hit Play",
      "On top! — the table pill flashes like Pass so you spot your on-top beat",
      "Bot table — bottom bar: Settings, Leave Game, and Achievements in one row; Skip game in the play area when spectating",
      "Settings — clearer tip for full-screen play from your home screen",
    ],
  },
  {
    publishedAt: nzst("2026-06-05T12:00:54"),
    title: "Turn order & card flights",
    items: [
      "After role trades, the player with the 3♣ opens — including the middle player in a 3-player game",
      "President↔Asshole trades — you choose which cards to send back; Asshole still gives their best card",
      "Opponent plays — cards fly from their seat to the table again on web",
    ],
  },
  {
    publishedAt: nzst("2026-06-05T11:32:36"),
    title: "Online trades & hand cards",
    items: [
      "Online — President↔Asshole trades work again when two humans share a table",
      "Selected cards — rank and suit stay the same size when you tap them",
      "Skip deal animations — still only skips shuffle and deal; role trades always run",
    ],
  },
  {
    publishedAt: nzst("2026-06-05T11:16:07"),
    title: "Bot table & online play",
    items: [
      "On top! — winning the trick clears the table and you can lead the next one (including two-player with dead hand)",
      "Bot table — bots keep playing when you pass on a run; no more stuck “waiting for bot”",
      "Bot table — tap Ready when you’re seated to skip the rankings wait; everyone sees the same next-deal countdown",
      "Cards fly from your hand to the table and stay visible over menus and pop-ups",
      "Round rankings — trick XP matches what you earned that round",
    ],
  },
  {
    publishedAt: nzst("2026-06-03T18:34"),
    title: "Hand polish",
    items: [
      "Your hand — easier scrolling, steady card size, and cleaner dimming on cards you can’t play",
      "Online — rankings wait for the last-hand reveal before they appear",
    ],
  },
  {
    publishedAt: nzst("2026-06-02T23:27"),
    title: "Trick finishes",
    items: [
      "Jokers and unbeatable four-of-a-kind — the trick ends cleanly when everyone else has passed",
      "Bot table — no more frozen turns after a joker or when someone already passed",
    ],
  },
  {
    publishedAt: nzst("2026-06-02T18:46"),
    title: "Dealing & trades",
    items: [
      "Later rounds — deal animation matches a full deck; trades no longer flash cards you already hold",
      "Online — President↔Asshole trades happen after the deal animation finishes",
    ],
  },
  {
    publishedAt: nzst("2026-06-02T12:08"),
    title: "Open Bot Table",
    items: [
      "Find Game — watch Amy and Ben anytime; tap Take Dead Hand Seat or Ready to join the next round",
      "Up to eight players; bots make room as humans sit down",
      "Skip or restart from Find Game if the table looks stuck; round end shows the last hand instead of hanging",
      "Tricks finish after jokers, rank closes, and mid-run plays — including while you spectate",
      "Quick Game no longer drops you on the readme page",
    ],
  },
  {
    publishedAt: nzst("2026-06-02T10:39"),
    title: "Runs, passes & trades",
    items: [
      "Run bonus XP — +5 per card in the run; see a live +XP hint while the trick is on",
      "After a joker or rank close, everyone can pass to acknowledge; play continues smoothly",
      "Skip deal animations still shows President↔Asshole trades; chevrons help you find playable cards off-screen",
      "Deal shuffle no longer gets stuck on later rounds",
    ],
  },
  {
    publishedAt: nzst("2026-06-01T22:27"),
    title: "Dealing, hand hints & layout",
    items: [
      "Deal ceremony — shuffle and deal from your hand zone with smoother pacing",
      "Chevrons when a playable card is off-screen — tap to jump there",
      "Smaller phones — hand, buttons, and seats scale so the table stays readable",
      "On top! after a 10 remembers higher or lower correctly",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T22:29"),
    title: "Runs, trades & XP",
    items: [
      "10s during a run play as normal cards — no higher/lower prompt while Runs! is active",
      "Role trades — return cards fly to the right seat before the round opens",
      "Trick and run XP tally during play and land on the scoreboard; leaving early forfeits that round’s XP",
      "See other players’ trick-win shouts and avatar borders online",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T21:00"),
    title: "Rewards & Quick Game",
    items: [
      "Trick-win shouts and avatar borders from achievements",
      "Quick Game — seven named bot opponents with different styles and career XP",
      "What's New badge on the menu until you’ve read the log",
      "Multiplayer button shows how many players are online",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T18:00"),
    title: "Table & round end",
    items: [
      "Turn hints on the table — Your turn, Waiting for…, and Dealing cards… sit below the play-type badge; Your turn pulses like Pass",
      "Play-type pill highlights when a run or special rule is active; plain Singles stays gold",
      "Run bonus XP pool above the play pile during 4+ card runs — trick winner takes the pool when the trick ends",
      "At round end everyone sees the last player's remaining hand before the rankings screen",
      "Brighter glow on the active player's avatar ring",
      "Online lobbies accept up to 8 players before the game starts",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T16:20"),
    title: "Table visibility",
    items: [
      "Card piles stay fully visible during a trick",
      "On top! — everyone sees the winning play before the table clears",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T13:55"),
    title: "Roles & trades",
    items: [
      "5+ players — Vice President and Vice Asshole roles with card trades; middle-ranked players have no trade",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T10:21"),
    title: "Runs & profiles",
    items: [
      "Tap an opponent's avatar mid-game to open their player profile",
      "Runs stay active through step-backs and bounce-backs (e.g. J-Q-J-K, 10-J-Q-J-Q)",
      "Skip deal animations — role trades no longer duplicate cards when others are still watching the deal",
    ],
  },
  {
    publishedAt: nzst("2026-05-29T21:35"),
    title: "Rules & turn flow",
    items: [
      "Runs follow one direction; Runs! stays on through valid extensions",
      "On top! — extra turn when a run ends and everyone passes; 10 rule works on top too",
      "Fresh round — skips President↔Asshole trade if the same player is Asshole three rounds in a row",
      "Everyone in the lobby must ready up before the host can start",
      "Dead hand — dealer can reshuffle when the dead hand gets all four 3s and nobody can open",
    ],
  },
  {
    publishedAt: nzst("2026-05-29T16:01"),
    title: "Deal flow & hand layout",
    items: [
      "After trades, whoever holds the 3♣ leads",
      "Hand fans in an arc; your centre card stays upright and opens on new deals",
      "Skip deal animations in Settings; turn hints wait until deals and trades finish",
      "Must pick higher or lower when a 10 is your last card before you're out",
      "Rankings XP animates into career totals at round end",
    ],
  },
  {
    publishedAt: nzst("2026-05-28T22:16"),
    title: "New rules",
    items: [
      "Turn bell — tap 🔔 on someone's seat to nudge them after ~12 seconds",
      "Quads across turns are unbeatable; quad bombs beat lower sets",
      "Quad runs — four-of-a-kind on consecutive ranks (5555 → 6666 → 7777)",
      "Jokers can't be played during any active run",
      "K-A-2 counts as a valid run",
    ],
  },
  {
    publishedAt: nzst("2026-05-28T20:28"),
    title: "Online multiplayer",
    items: [
      "Browse open lobbies or join friends with a room code; host a public game",
      "Ready up when the lobby is full; tap avatars for player profiles",
      "Spectator mode — watch a game and claim the dead hand seat next round",
      "Dead hand in 2-player games; opening rules when the dead hand holds 3♣",
      "Rejoin mid-game without replaying the deal",
      "President/Asshole trades and deal ceremony work every round online",
    ],
  },
  {
    publishedAt: nzst("2026-05-28T17:36"),
    title: "Look & feel",
    items: [
      "Custom felt tint with a colour picker",
      "Light, dark, or system appearance; dark mode cards in Settings",
      "Riffle shuffle and faster dealing between rounds",
      "Room codes copy in one tap",
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
