export type UpdateEntry = {
  date: string;
  title: string;
  items: string[];
};

export type KnownIssue = {
  title: string;
  status: "Looking into it" | "Fix shipped" | "Monitoring";
  note: string;
};

export const UPDATE_LOG_TAGLINE =
  "A quick look at what we've been building — and what we're still smoothing out.";

export const UPDATE_ENTRIES: UpdateEntry[] = [
  {
    date: "May 2026",
    title: "Recent fixes",
    items: [
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
    date: "May 2026",
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
    date: "May 2026",
    title: "Look & feel",
    items: [
      "Custom felt tint with a color graph picker beside the hex field",
      "Dark ink text with a subtle shadow so labels read clearly on light tables",
      "Light, dark, or system appearance — plus auto text contrast for your felt",
      "Deal ceremony: riffle shuffle, faster face-down dealing, and President/Asshole trades",
    ],
  },
  {
    date: "May 2026",
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
    date: "May 2026",
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
    title: "Achievement stats in lobbies",
    status: "Monitoring",
    note: "You can view your own achievements from a player profile. Other players' progress isn't shared yet — we're keeping it local for now.",
  },
  {
    title: "Stale rooms in Open Games",
    status: "Fix shipped",
    note: "Starting a new lobby should remove your old one. Tap Refresh if one lingers.",
  },
  {
    title: "Room name editing on mobile web",
    status: "Monitoring",
    note: "Tap the field, edit, then tap away or press Enter to save. Tell us if it still misbehaves.",
  },
  {
    title: "Mid-game disconnects",
    status: "Fix shipped",
    note: "If someone disconnects or leaves mid-game, others see a countdown while their seat is held. Rejoin in time to keep playing; otherwise the game ends for everyone.",
  },
];
