/** Secret bot table room code (server: qaLeagueRooms.js). */
export const QA_LEAGUE_ROOM_CODE = "QALEG";

/**
 * QA League spawn policy — easter egg, not a replacement for normal bot tables.
 *
 * Normal tables (Amy / Ben on BOTOPN) stay the default opponent experience.
 * QA personalities are rare, opt-in, or event-driven socket clients.
 *
 * @see QA_BOT_LEAGUE.md
 */

/** @typedef {'normal_bot'|'qa_league'|'secret_code'|'dev_force'} SpawnMode */

/**
 * Target mix once public rare spawn is enabled (not wired to Find Game yet).
 */
export const SPAWN_WEIGHTS = {
  normalBotTable: 0.95,
  qaLeagueTable: 0.05,
};

/**
 * Environment / config gates (read in CI and local runners only for now).
 */
export const SPAWN_GATES = {
  /** Set to `1` or `true` to allow QA league runners and forced tables in dev. */
  devEnvVar: "PS_QA_LEAGUE",
  /** Optional secret room codes that always mount a league session (design only). */
  secretRoomCodes: [QA_LEAGUE_ROOM_CODE, "TESTERS"],
  /** Never spawn QA league from public Find Game until this flag is flipped. */
  publicDiscoveryEnabled: false,
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isQALeagueDevEnabled(env = process.env) {
  const v = env[SPAWN_GATES.devEnvVar];
  return v === "1" || v === "true" || String(v).toLowerCase() === "yes";
}

/**
 * @param {string} roomCode
 * @returns {boolean}
 */
export function isSecretQALeagueRoom(roomCode) {
  const code = String(roomCode || "")
    .trim()
    .toUpperCase();
  return SPAWN_GATES.secretRoomCodes.includes(code);
}

/**
 * Resolve how a table should be classified (design helper — server hook TBD).
 * @param {{ roomCode?: string, devForce?: boolean }} opts
 * @returns {SpawnMode}
 */
export function resolveSpawnMode(opts = {}) {
  if (opts.devForce || isQALeagueDevEnabled()) return "dev_force";
  if (opts.roomCode && isSecretQALeagueRoom(opts.roomCode)) return "secret_code";
  if (!SPAWN_GATES.publicDiscoveryEnabled) return "normal_bot";
  return Math.random() < SPAWN_WEIGHTS.qaLeagueTable
    ? "qa_league"
    : "normal_bot";
}
