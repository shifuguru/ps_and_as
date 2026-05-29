export type UpdateEntry = {
  /** UTC ISO 8601 instant (…Z) — shown in the user's local date & time. NZST is UTC+12 (e.g. 2pm NZST → 02:00Z). */
  publishedAt: string;
  title: string;
  items: string[];
};

export type KnownIssue = {
  title: string;
  status: "Looking into it" | "Fix shipped" | "Monitoring";
  note: string;
  /** When this issue note was last updated (UTC ISO 8601). */
  updatedAt?: string;
};

export const UPDATE_LOG_TAGLINE =
  "A quick look at what we've been building — and what we're still smoothing out.";

export { formatUpdateTimestamp } from "../utils/formatLocalDateTime";

export const UPDATE_ENTRIES: UpdateEntry[] = [
  {
    publishedAt: "2026-05-29T22:00:00.000Z",
    title: "On top! & quad fixes",
    items: [
      "On top! — runs require the next consecutive rank; 10-rule piles require higher or lower (only when the 10 rule is active)",
      "Cross-turn quads — fixed online games getting stuck with inverted turn indicators after completing four-of-a-kind across turns",
    ],
  },
  {
    publishedAt: "2026-05-29T12:00:00.000Z",
    title: "On top!, fresh rounds & fixes",
    items: [
      "On top! — when a run ends and everyone else passes, the last player on the run gets one extra turn to play the next consecutive rank",
      "10 rule on top! — when everyone passes under an active higher/lower 10 rule, the player who set it may play on top following that direction (or pass to win the trick)",
      "Fresh round — if the same player is Asshole three rounds in a row, the next round skips the President↔Asshole trade (VP trades still apply in 5+ player games)",
      "Trick winner fix — closing four 10s and passing no longer hands the trick to the wrong player",
      "Mandatory trade fix — Asshole correctly gives the Joker (not a 2) when trading up to President",
      "Trick pile cleanup — played cards clear cleanly from the table when a trick ends",
    ],
  },
  {
    publishedAt: "2026-05-29T08:00:00.000Z",
    title: "Read Me & UI glass",
    items: [
      "Read Me — opens in-app like Settings (no full-page refresh); README links styled as gold theme pills",
      "Read Me — Back button sits in the same bottom bar as Settings and What's New",
      "Deploy fallback README page — Back moved from the header to a centred bottom-bar pill",
      "Panels & bottom bar — lighter glass in light and dark mode so the felt shows through more",
    ],
  },
  {
    publishedAt: "2026-05-29T02:00:00.000Z",
    title: "Hand fan, deal flow & table polish",
    items: [
      "Opening player — turn ring and “who leads” hints stay hidden until dealing and President/Asshole trades finish",
      "Player hand — arc fans from the hand-area centre; middle card stays upright and larger; fresh deals open on your centre card",
      "Settings — optional “Skip deal animations” jumps straight to trades and your hand",
      "Trick win — celebration ring centred on the avatar; checkered flag sits top-right like deal mini-stacks",
      "Web modals — Settings, Achievements, and What's New render above the bottom bar (no click-through)",
    ],
  },
  {
    publishedAt: "2026-05-28T22:38:00.000Z",
    title: "Round opener & web polish",
    items: [
      "After President/Asshole trades — play starts with whoever holds the 3 of clubs (online and offline)",
      "iOS home-screen web app — bottom bar respects the safe area so controls aren't pushed up by a phantom offset",
      "Deal ceremony — face-down mini stacks sit evenly inside each seat ring toward the table centre",
      "Find Game — Host Open Game + icon centred; join code field no longer triggers password autofill tips",
      "Lobby Ready — flashes like Pass when you can ready up; solo host sees “1 More Person” until a second player joins",
    ],
  },
  {
    publishedAt: "2026-05-28T20:11:00.000Z",
    title: "Deal ceremony & table polish",
    items: [
      "Shuffle animation — riffle shuffle now plays on Expo Go and iOS (not just desktop web)",
      "Deal ceremony — live card-count badges on each seat while cards are dealt",
      "Ten as your last card — you must pick higher or lower before you're out for the round",
      "Pass button — turn glow and flash use your table theme accent instead of iOS blue",
      "Leave button — red tint during an active game so it's easy to spot (light and dark mode)",
      "Your avatar stays in place when you're out instead of jumping to the table centre",
      "Game Center — safer round-end achievement sync (no crash when a mapping is missing)",
      "Mandatory role trades — strip above the action bar while President/Asshole picks return cards",
    ],
  },
  {
    publishedAt: "2026-05-28T10:16:00.000Z",
    title: "Rules & table nudge",
    items: [
      "Turn bell — after ~12 seconds on someone's turn, a 🔔 appears on their seat; tap to nudge them (works in multiplayer too)",
      "Quads across turns — completing four of a kind over multiple plays (e.g. one 3, then three more 3s) is unbeatable; everyone must pass",
      "Quad bomb — playing all four of a rank at once can be beaten by higher quads or a joker",
      "Quads run — three or more consecutive ranks each played as four-of-a-kind (e.g. 5555 → 6666 → 7777); jokers can't be played during the run — extend with the next rank's quad",
      "Jokers can't be played during any active run (singles, doubles, triples, or quads)",
      "K-A-2 counts as a valid run (King → Ace → Two as consecutive singles)",
    ],
  },
  {
    publishedAt: "2026-05-28T10:28:00.000Z",
    title: "Stability & Quick Game",
    items: [
      "Quick Game — fixed deal ceremony getting stuck on “Setting up table…”; opening player is resolved from the dealt hands before cards are hidden for the animation",
      "GameScreen — stable hook order and a fresh mount each time you start a game (Quick Game, lobby, or online) so hot reload can't leave the table in a broken state",
      "Crash recovery — if something goes wrong, an in-app fallback explains we're fixing it ASAP with an Attempt refresh button (full reload on web)",
      "Round ceremony — deals reshuffle up to 64 times when round 1 needs a valid opener (same as solo game creation)",
    ],
  },
  {
    publishedAt: "2026-05-27T06:00:00.000Z",
    title: "Multiplayer & dead hand",
    items: [
      "Dead hand opening — when the dead hand holds 3♣, the next living player with 3♠ leads; otherwise any 3; if no living player has a 3, the deal reshuffles",
      "Round 2+ online — deal ceremony and President/Asshole trades now run correctly each round (fixed ceremony tracking per deal)",
      "Mid-game rejoin — reconnecting players pick up where the table left off without replaying the deal animation",
      "Rejoin sync — room code re-entry includes the correct deal seed so hands stay in step with the server",
      "Leave confirmation — Cancel or Yes, Leave before exiting an online game (including during the deal)",
      "Multiplayer smoke test — `npm run test-multiplayer` verifies three-player deal sync and opening play against the server",
    ],
  },
  {
    publishedAt: "2026-05-27T02:00:00.000Z",
    title: "Recent fixes",
    items: [
      "Round flow — the Asshole from the previous round deals; first recipient in deal order opens when 3♣ rules don't apply",
      "Run rules — two singles in a row (e.g. 3 then 4) is normal play until a third consecutive card starts a run; you must beat the pile, not play back to an adjacent rank",
      "Deal ceremony — riffle shuffle animation (split, bridge, merge) and faster card dealing so you get to play sooner",
      "Automatic update prompts when a newer web build is deployed — refresh to get the latest",
      "First-round deal ceremony online — everyone sees the shuffle and cards dealt to each seat before play starts",
      "Disconnect grace period — if someone drops, their seat stays open ~20–30 seconds with a countdown; they can rejoin or the game ends cleanly",
      "Mobile web zoom locked — tapping name or room fields no longer zooms the page; color picker drag won't scroll Settings behind it",
      "iOS Safari layout — felt wallpaper fills the screen without a black strip below the table",
      "Dead hand uses the natural third seat on the ring instead of a pinned side slot",
      "Deal sync fixes — guests no longer stuck on “Dealing cards…” when the host starts a game",
    ],
  },
  {
    publishedAt: "2026-05-26T04:00:00.000Z",
    title: "Lobby & table",
    items: [
      "Ready button when the lobby is full — tap Ready and show a checkmark on your avatar",
      "Tap any player avatar for a profile card with achievements",
      "Dead hand seat for two-player games — face-down cards with classic red backs on the table",
      "Room codes you can copy in one tap, separate from your public room name",
      "Profanity filter on player names and room titles",
    ],
  },
  {
    publishedAt: "2026-05-25T00:00:00.000Z",
    title: "Look & feel",
    items: [
      "Custom felt tint with a color graph picker beside the hex field",
      "Dark ink text with a subtle shadow so labels read clearly on light tables",
      "Light, dark, or system appearance — plus auto text contrast for your felt",
      "Deal ceremony: riffle shuffle, faster face-down dealing, and President/Asshole trades",
    ],
  },
  {
    publishedAt: "2026-05-23T22:00:00.000Z",
    title: "Online multiplayer",
    items: [
      "Browse open public lobbies or join friends with a room code",
      "Host an open game anyone can discover",
      "Rename your lobby (host only) — blur or press Enter to save",
      "Spectator mode — join a game in progress and claim the dead hand seat next round",
      "Leave, kick, and reconnect handling with clearer lobby notices",
    ],
  },
  {
    publishedAt: "2026-05-22T21:00:00.000Z",
    title: "Polish & fixes",
    items: [
      "Old host lobbies clean up when you start a new room",
      "iOS Safari bottom bar layout fix",
      "Ten-rule choices and next-round flow improvements online",
      "Party status bar and friendlier multiplayer screen layout",
    ],
  },
];

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    title: "Shuffle animation on mobile",
    status: "Fix shipped",
    updatedAt: "2026-05-28T20:11:00.000Z",
    note: "The deal riffle shuffle should now animate on Expo Go and iOS. Restart the app with a cleared cache if you still see a static deck.",
  },
  {
    title: "Quick Game blank screen",
    status: "Fix shipped",
    updatedAt: "2026-05-28T10:28:00.000Z",
    note: "Quick Game should show the deal animation, then play. If you still see a blank table, use Attempt refresh or hard-refresh the browser (Ctrl+Shift+R).",
  },
  {
    title: "iOS PWA bottom offset",
    status: "Fix shipped",
    updatedAt: "2026-05-28T22:38:00.000Z",
    note: "Home-screen bookmark apps should no longer show extra space below the bottom bar. Remove and re-add the shortcut if Safari cached an old build.",
  },
  {
    title: "Achievement stats in lobbies",
    status: "Monitoring",
    updatedAt: "2026-05-26T04:00:00.000Z",
    note: "You can view your own achievements from a player profile. Other players' progress isn't shared yet — we're keeping it local for now.",
  },
  {
    title: "Stale rooms in Open Games",
    status: "Fix shipped",
    updatedAt: "2026-05-22T21:00:00.000Z",
    note: "Starting a new lobby should remove your old one. Tap Refresh if one lingers.",
  },
  {
    title: "Room name editing on mobile web",
    status: "Monitoring",
    updatedAt: "2026-05-22T21:00:00.000Z",
    note: "Tap the field, edit, then tap away or press Enter to save. Tell us if it still misbehaves.",
  },
  {
    title: "Round 2 trades online",
    status: "Fix shipped",
    updatedAt: "2026-05-27T06:00:00.000Z",
    note: "President and Vice President card trades should appear after every round, not only the first. Tell us if trades fail to show after round 2.",
  },
  {
    title: "Mid-game disconnects",
    status: "Fix shipped",
    updatedAt: "2026-05-27T06:00:00.000Z",
    note: "If someone disconnects or leaves mid-game, others see a countdown while their seat is held. Rejoin in time to keep playing; otherwise the game ends for everyone.",
  },
];
