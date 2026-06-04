/**
 * Personality driver registry — only implemented bots run in the league.
 */
import { QA_BOT_ROSTER } from "../botRoster.mjs";
import { createChaosDriver } from "./chaos.mjs";
import { createFlashDriver } from "./flash.mjs";
import { createLoopDriver } from "./loop.mjs";
import { createBreakerDriver } from "./breaker.mjs";

/** @typedef {import('../botRoster.mjs').QAPersonalityId} QAPersonalityId */

/** @type {Record<QAPersonalityId, (opts: object) => () => Promise<void>>} */
const DRIVERS = {
  chaos: createChaosDriver,
  speed: createFlashDriver,
  ready_spam: createLoopDriver,
  exploit: createBreakerDriver,
};

/** @type {readonly QAPersonalityId[]} */
export const IMPLEMENTED_PERSONALITIES = Object.keys(DRIVERS);

/**
 * @param {QAPersonalityId} id
 * @param {object} opts
 */
export function getPersonalityDriver(id, opts) {
  const factory = DRIVERS[id];
  if (!factory) {
    throw new Error(
      `Personality "${id}" has no driver yet. Implemented: ${IMPLEMENTED_PERSONALITIES.join(", ")}`,
    );
  }
  return factory(opts);
}

/**
 * Bots with drivers, optionally capped by roster phase.
 * @param {{ maxPhase?: number }} [opts]
 * @returns {typeof QA_BOT_ROSTER[number][]}
 */
export function leagueBots({ maxPhase = 1 } = {}) {
  return QA_BOT_ROSTER.filter((b) => b.phase <= maxPhase && DRIVERS[b.id]);
}

/**
 * @param {string} [csv] Comma-separated ids; default = all implemented.
 * @returns {QAPersonalityId[]}
 */
export function parseBotList(csv) {
  if (!csv?.trim()) {
    return /** @type {QAPersonalityId[]} */ ([...IMPLEMENTED_PERSONALITIES]);
  }
  const ids = csv.split(",").map((s) => s.trim());
  for (const id of ids) {
    if (!(id in DRIVERS)) {
      throw new Error(`Unknown or unimplemented bot: ${id}`);
    }
  }
  return /** @type {QAPersonalityId[]} */ (ids);
}
