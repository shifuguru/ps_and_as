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
    publishedAt: nzst("2026-06-01T22:27"),
    title: "Dealing, hand hints & layout",
    items: [
      "Deal ceremony — when you're dealer, shuffle and the remaining deck play in your hand zone; cards peel off and fly with natural pacing (slower at the start and finish)",
      "Scroll hints — when a valid play is off-screen, glass chevrons appear at the edges of your hand; tap to jump to the nearest hidden card",
      "Smaller screens — hand fan, action bar, and seat ring scale down on short phones so the table stays readable",
      "Fix: on-top plays after a 10 correctly remember higher or lower for validation",
      "Round end — president row shows a clean gold label on the scoreboard",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T22:29"),
    title: "Runs, trades & XP",
    items: [
      "10s during a run — once Runs! is active, 10s play as normal cards (no higher/lower prompt), including when a 10 completes the run",
      "Role trades — the president's return card flies into the asshole's receive slot before the round opens",
      "Round XP — trick and run bonus XP tally during play and land on the scoreboard at round end; leaving early forfeits your earned XP for that round",
      "Multiplayer — trick-win shouts and avatar reward borders show on other players' screens",
      "Your seat sits slightly lower on the table so your avatar isn't tucked under the play area",
      "Settings — cleaner appearance panel with inline toggles; skip-deal option marked as beta",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T21:00"),
    title: "Rewards & bots",
    items: [
      "Trick-win shouts — brief callouts when you take a trick (+XP moment)",
      "Avatar reward borders — wings, flames, laurel, and crown from achievements (shown on your seat and bot opponents)",
      "President celebration on the round-end scoreboard",
      "What's New badge — unread count on the main menu until you read the update log",
      "Multiplayer badge — live count of connected players on the Multiplayer button",
      "Quick Game fills the table with seven named bot opponents, each with different career XP and rewards",
      "Bot seats use short random names instead of CPU 1, CPU 2, …",
      "Fix: round-end scoreboard no longer crashes; avatar borders render correctly",
      "Fix: online game no longer pauses when someone leaves the lobby before the deal",
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
      "Card piles no longer clip on the right during an active trick",
      "On top! — other players can see the winning play before the table clears",
      "Card remnants no longer linger after a trick is won",
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
