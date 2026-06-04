/**
 * QA Bot League — rogue tester crew.
 * Display names MUST start with emoji so live tables are easy to spot.
 *
 * @see QA_BOT_LEAGUE.md
 */

/** @typedef {'speed'|'slow'|'spectator'|'disconnect'|'chaos'|'edge'|'exploit'|'ready_spam'} QAPersonalityId */

/**
 * @typedef {object} QABotEntry
 * @property {QAPersonalityId} id
 * @property {string} emoji
 * @property {string} codename
 * @property {string} fullName
 * @property {string} displayName
 * @property {string} primaryMission
 * @property {string} tagline Player-facing one-liner (lore / discovery).
 * @property {readonly string[]} behaviour Behaviour bullets for docs.
 * @property {readonly string[]} coverageTargets
 * @property {0|1|2} phase
 */

/** @type {readonly QABotEntry[]} */
export const QA_BOT_ROSTER = [
  {
    id: "speed",
    emoji: "⚡",
    codename: "Flash",
    fullName: "Speed Bot",
    displayName: "⚡ Flash",
    primaryMission: "Stress speed and race conditions",
    tagline: "Speed solves everything.",
    behaviour: [
      "Acts instantly",
      "Rapid ready / unready",
      "Minimal delays",
    ],
    coverageTargets: ["turn_progression", "rapid_ready", "rapid_trades"],
    phase: 1,
  },
  {
    id: "slow",
    emoji: "🐢",
    codename: "Tank",
    fullName: "Slow Bot",
    displayName: "🐢 Tank",
    primaryMission: "Stress delays and waiting states",
    tagline: "Still thinking...",
    behaviour: [
      "Waits unusually long before acting",
      "Uses maximum decision times",
      "Stresses timeout paths",
    ],
    coverageTargets: ["timeout_paths", "waiting_for_server"],
    phase: 1,
  },
  {
    id: "spectator",
    emoji: "👀",
    codename: "Scout",
    fullName: "Spectator Bot",
    displayName: "👀 Scout",
    primaryMission: "Spectator lifecycle",
    tagline: "Just observing.",
    behaviour: [
      "Watches games",
      "Claims dead hands",
      "Joins and leaves spectator states",
    ],
    coverageTargets: [
      "spectator_join",
      "dead_hand_claim",
      "spectator_promotion",
    ],
    phase: 1,
  },
  {
    id: "disconnect",
    emoji: "🔌",
    codename: "Glitch",
    fullName: "Disconnect Bot",
    displayName: "🔌 Glitch",
    primaryMission: "Connection instability",
    tagline: "Connection unstable.",
    behaviour: [
      "Disconnects",
      "Reconnects",
      "Appears and disappears",
    ],
    coverageTargets: [
      "reconnect_mid_turn",
      "reconnect_during_rankings",
      "reconnect_during_trades",
    ],
    phase: 1,
  },
  {
    id: "chaos",
    emoji: "🎲",
    codename: "Chaos",
    fullName: "Chaos Bot",
    displayName: "🎲 Chaos",
    primaryMission: "Broad exploration",
    tagline: "No plan survives contact.",
    behaviour: [
      "Random timing",
      "Random actions",
      "Unpredictable behaviour",
    ],
    coverageTargets: ["*"],
    phase: 0,
  },
  {
    id: "edge",
    emoji: "🃏",
    codename: "Joker",
    fullName: "Edge Case Bot",
    displayName: "🃏 Joker",
    primaryMission: "Rule edge cases",
    tagline: "The rules are more like guidelines.",
    behaviour: [
      "Prefers Jokers",
      "Prefers 10-rule interactions",
      "Prefers runs and acknowledgements",
    ],
    coverageTargets: ["ten_rule", "joker_ack", "four_kind_ack", "runs"],
    phase: 1,
  },
  {
    id: "exploit",
    emoji: "🔨",
    codename: "Breaker",
    fullName: "Exploit Hunter",
    displayName: "🔨 Breaker",
    primaryMission: "Invalid behaviour",
    tagline: "If it can break, I will find it.",
    behaviour: [
      "Attempts unusual sequences",
      "Stresses validation",
      "Repeats edge actions",
    ],
    coverageTargets: [
      "duplicate_actions",
      "invalid_actions",
      "stale_state_version",
    ],
    phase: 1,
  },
  {
    id: "ready_spam",
    emoji: "🔄",
    codename: "Loop",
    fullName: "Ready Spammer",
    displayName: "🔄 Loop",
    primaryMission: "Round transitions",
    tagline: "Ready. Not ready. Ready.",
    behaviour: [
      "Ready",
      "Unready",
      "Ready again",
    ],
    coverageTargets: ["ready_toggle", "next_round_start", "rankings_ready"],
    phase: 1,
  },
];

/** League roster ids in discovery order (for docs / UI). */
export const QA_LEAGUE_CODENAMES = QA_BOT_ROSTER.map((b) => b.codename);

/** @param {QAPersonalityId} id */
export function getQABot(id) {
  const bot = QA_BOT_ROSTER.find((b) => b.id === id);
  if (!bot) throw new Error(`Unknown QA personality: ${id}`);
  return bot;
}

/**
 * Lobby / joinRoom display name (emoji-first).
 * @param {QAPersonalityId} id
 * @param {number} [instance]
 */
export function qaDisplayName(id, instance = 1) {
  const bot = getQABot(id);
  if (instance <= 1) return bot.displayName;
  return `${bot.emoji} ${bot.codename} ${instance}`;
}

/**
 * Stable socket profile id (not cpu-*).
 * @param {QAPersonalityId} id
 * @param {number} [instance]
 */
export function qaProfileId(id, instance = 1) {
  const bot = getQABot(id);
  return `qa-${bot.id}-${instance}`;
}

/** True if lobby name looks like a league bot (emoji prefix or qa- profile). */
export function isQALeagueDisplayName(name) {
  const t = String(name || "").trim();
  if (QA_BOT_ROSTER.some((b) => t.startsWith(b.emoji))) return true;
  return /^qa-/i.test(t);
}

/**
 * Console / JSONL log prefix for long runs.
 * @param {QAPersonalityId} id
 * @param {string} message
 * @returns {string}
 */
export function qaLogLine(id, message) {
  const bot = getQABot(id);
  return `[${bot.displayName}] ${message}`;
}

/**
 * @param {QAPersonalityId} id
 * @param {string} message
 */
export function qaLog(id, message) {
  console.log(qaLogLine(id, message));
}
