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
    publishedAt: nzst("2026-05-30T13:55"),
    title: "Roles & trades",
    items: [
      "5+ players — Vice President and Vice Asshole roles with card trades; middle-ranked players have no trade",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T13:39"),
    title: "Fixes",
    items: [
      "What's New — scroll bar is now visible on web and phone (blue track on the right)",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T12:09"),
    title: "Polish",
    items: [
      "What's New — scroll bar shows where you are in the list",
      "Stats button — accent shimmer sweeps across the label every 10 seconds",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T10:21"),
    title: "Runs, profiles & fixes",
    items: [
      "Run bonus XP builds on the table during a run — trick winner takes the pool at trick end",
      "Tap an opponent's avatar mid-game to open their player profile",
      "Quick Game — deal animations no longer crash after cards are dealt",
      "Hand cards — centred card rank and suit text matches overlapping cards",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T09:20"),
    title: "What's New cleanup",
    items: [
      "What's New — shorter list focused on gameplay changes, not behind-the-scenes notes",
      "Known issues trimmed to things we're still watching",
    ],
  },
  {
    publishedAt: nzst("2026-05-30T09:11"),
    title: "Runs & XP",
    items: [
      "Runs stay active through step-backs and bounce-backs (e.g. J-Q-J-K, 10-J-Q-J-Q)",
      "+15 XP for everyone still in the trick when a run reaches 3+ cards and keeps growing",
      "XP, rounds, and role counts sync while you play online",
      "Dark mode cards in Settings → Appearance; skip deal animations works offline too",
      "Dead hand — dealer can reshuffle when the dead hand gets all four 3s and nobody can open",
    ],
  },
  {
    publishedAt: nzst("2026-05-29T21:35"),
    title: "Rules & turn flow",
    items: [
      "Runs follow one direction; Runs! stays on through valid extensions",
      "On top! — extra turn when a run ends and everyone passes; 10 rule works on top too",
      "Fresh round — skips President↔Asshole trade if the same player is Asshole three rounds in a row",
      "Four-of-a-kind across turns no longer breaks turn order online",
      "Fixed games freezing after a trick win or an on-top! pass",
      "Everyone in the lobby must ready up before the host can start",
    ],
  },
  {
    publishedAt: nzst("2026-05-29T16:01"),
    title: "Deal flow & table layout",
    items: [
      "After trades, whoever holds the 3♣ leads",
      "Hand fans in an arc; your centre card stays upright and opens on new deals",
      "Skip deal animations in Settings; turn hints wait until deals and trades finish",
      "Riffle shuffle on phone and iOS; live card counts while dealing",
      "Must pick higher or lower when a 10 is your last card before you're out",
      "Read Me opens in-app; trick win celebration centred on the winner",
      "Lobby Ready flashes when you can ready; Leave turns red mid-game",
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
      "Rejoin mid-game without replaying the deal; leave confirmation before exiting",
      "President/Asshole trades and deal ceremony work every round online",
      "Disconnect grace period — seat held ~20–30s so players can rejoin",
    ],
  },
  {
    publishedAt: nzst("2026-05-28T21:03"),
    title: "Quick Game & refreshes",
    items: [
      "Quick Game no longer stuck on “Setting up table…”",
      "Prompt to refresh when a newer version is available",
      "Round 1 deals reshuffle until someone can legally open",
    ],
  },
  {
    publishedAt: nzst("2026-05-28T17:36"),
    title: "Look & feel",
    items: [
      "Custom felt tint with a colour picker",
      "Light, dark, or system appearance",
      "Riffle shuffle and faster dealing between rounds",
      "Room codes copy in one tap; profanity filter on names and room titles",
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
  {
    title: "Room name editing on mobile web",
    status: "Monitoring",
    updatedAt: nzst("2026-05-28T17:15"),
    note: "Tap the field, edit, then tap away or press Enter to save. Tell us if it still misbehaves.",
  },
];
