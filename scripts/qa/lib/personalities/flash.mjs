/**
 * ⚡ Flash — minimal delay between actions (speed / race conditions).
 */
import { createChaosDriver } from "./chaos.mjs";

const PERSONALITY = "speed";

/**
 * @param {object} opts
 */
export function createFlashDriver(opts) {
  const inner = createChaosDriver({ ...opts, minDelayMs: 30, maxDelayMs: 120 });
  return async function flashTick() {
    await inner();
  };
}

export { PERSONALITY };
