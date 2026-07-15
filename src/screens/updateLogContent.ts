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
    publishedAt: nzst("2026-07-15T21:56"),
    title: "New home screen, table UI & Runs/tens fixes",
    items: [
      "Home — a new Player Hub with your profile, progress, goals, and Offline / Online play",
      "Table — refreshed felt, glass panels, ambient lighting, and clearer in-game HUD widgets",
      "Runs! — when a run locks in, the pill gets a subtle warm energy effect around the glass",
      "Runs — false activations from messy play order (like 9→10→9→J) should no longer light up Runs",
      "Opening lead — hints no longer say open with a 3 when you’re just leading after winning a trick",
      "On Top — cards should land cleanly when a trick closes on an On Top play",
      "Winning play — last-trick info clears correctly between rounds so stale labels don’t linger",
      "Theme — light and dark environments tune felt and frost together without changing glass strength",
    ],
  },
  {
    publishedAt: nzst("2026-07-14T18:22"),
    title: "Sticky Runs, tens & round-end stability",
    items: [
      "Runs — once three ascending ranks lock in, Runs stays on for the whole trick; stepping back (7→6→5) keeps Runs alive until the pile clears",
      "Tens during Runs — a 10 in a Run is just another card; Higher/Lower never appears while Runs is active",
      "On Top — during a Run, your one On Top play still has to sit next to the pile (±1); after it (or Skip) the trick ends and Runs ends",
      "On Top on a 10 — beating a lone 10 still follows Higher/Lower (On Top is just the extra turn)",
      "Round end — rankings should open cleanly without freezing the table or dumping you to the README",
      "Quit Game on rankings — Leave game? confirm sits on top so you can cancel or leave",
      "Your plays — cards from your hand shouldn't get stuck floating above the pile",
      "Table & menus — glass overlays, clearer buttons, and smoother turn highlights",
    ],
  },
  {
    publishedAt: nzst("2026-06-21T00:24:28"),
    title: "On Top, opening lead & Find Game",
    items: [
      "On Top — after winning with a 10, your on-top turn should work again even if sync briefly lost your Higher/Lower choice",
      "Online — after role trades, the player with 3♣ opens the round (not whoever received another three)",
      "Find Game — when nobody is hosting publicly, you'll see No Public Games Available instead of a bot table listing",
    ],
  },
  {
    publishedAt: nzst("2026-06-17T13:05:38"),
    title: "Fresh round & online dealing",
    items: [
      "Online — after a fresh round (three Asshole streaks), the next deal no longer pops a phantom President trade or stalls before play",
      "Online — when trades finish, your dealt hand shows up reliably instead of starting the round empty",
      "Online — round transitions between rankings and the next deal are more stable when sync messages arrive out of order",
    ],
  },
  {
    publishedAt: nzst("2026-06-08T21:24:32"),
    title: "Playing a 10 & online resync",
    items: [
      "Playing a 10 — choose Higher or Lower before your tens go to the table, instead of waiting for them to land first",
      "Online — reconnecting after a round ends should show the last hand and rankings more reliably",
      "Quick Game — joining or refreshing mid-round resyncs more reliably on bot tables",
      "General gameplay stability improvements",
    ],
  },
  {
    publishedAt: nzst("2026-06-08T16:32:29"),
    title: "Turn highlight during card plays",
    items: [
      "Turn ring — the gold highlight stays on whoever just played while their cards are still flying to the table, instead of jumping to the next player too soon",
    ],
  },
  {
    publishedAt: nzst("2026-06-08T13:23:14"),
    title: "Card flight landing",
    items: [
      "Your plays — cards from your hand land on the pile instead of stopping above it, especially on iPhone home-screen play",
    ],
  },
  {
    publishedAt: nzst("2026-06-08T12:37:44"),
    title: "Turn pill & late-round passes",
    items: [
      "Your play — the turn pill stays on you until your card lands and the table syncs; no more brief Waiting for… flicker on slow connections",
      "Late round — when the trick leader is already out and everyone else has passed, the trick resolves instead of hanging",
      "Settings and other overlays sit above card flights again",
    ],
  },
  {
    publishedAt: nzst("2026-06-06T20:31:29"),
    title: "Spectator seat claims",
    items: [
      "Open bot table — Ready to claim a seat only counts after the round ends, so you won't jump into a game from an old tap while watching",
    ],
  },
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
