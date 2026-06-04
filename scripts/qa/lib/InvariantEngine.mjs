/**
 * Starter invariant checks on gameStateSync (QA League Phase 0).
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { isRoundCompleteForLiving } = require("../../../server/gameBridge.js");

const TURN_STALL_MS = 30_000;
/** Bot table: CPU should act within ~2s normally; 20s = likely BOTOPN stall (pass-on-run, etc.). */
const BOT_CPU_STALL_MS = 20_000;
const ROUND_STALL_MS = 8 * 60_000;
const CPU_ID_RE = /^cpu-\d+$/i;

/**
 * @param {object[]} hand
 * @returns {string | null} Reason if impossible duplicate (not valid double-joker).
 */
function handDuplicateReason(hand) {
  if (!Array.isArray(hand) || hand.length === 0) return null;
  const seen = new Set();
  let jokers = 0;
  for (const c of hand) {
    if (c.suit === "joker" || c.value === 16) {
      jokers += 1;
      continue;
    }
    const key = `${c.suit}:${c.value}`;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  if (jokers > 2) return "joker:>2";
  return null;
}

/**
 * @typedef {object} InvariantFailure
 * @property {'low'|'medium'|'high'|'critical'} severity
 * @property {string} area
 * @property {'sync'|'rules'|'flow'} checkLayer
 * @property {string} phase
 * @property {string} expected
 * @property {string} actual
 * @property {boolean} reproducible
 * @property {string} build
 * @property {string} room
 * @property {number} [stateVersion]
 * @property {string} botId
 * @property {string} displayName
 * @property {string} personality
 * @property {string} ts
 */

export class InvariantEngine {
  /**
   * @param {object} opts
   * @param {string} opts.build
   * @param {string} opts.room
   * @param {string} opts.botId
   * @param {string} opts.displayName
   * @param {string} opts.personality
   */
  constructor(opts) {
    this.build = opts.build;
    this.room = opts.room;
    this.botId = opts.botId;
    this.displayName = opts.displayName;
    this.personality = opts.personality;
    /** @type {InvariantFailure[]} */
    this.failures = [];
    this.lastStateVersion = /** @type {number | null} */ (null);
    this.turnHolder = /** @type {string | null} */ (null);
    this.turnSince = Date.now();
    this.roundActiveSince = Date.now();
    this.reportedTurnStall = false;
    this.reportedBotCpuStall = false;
    this.reportedRoundStall = false;
    /** @type {Set<string>} */
    this.reportedKeys = new Set();
  }

  /**
   * @param {object | null} gameState
   */
  observe(gameState) {
    if (!gameState) return;

    const phase = gameState.phase ?? "UNKNOWN";
    const sv =
      typeof gameState.stateVersion === "number" ? gameState.stateVersion : null;

    if (sv != null && this.lastStateVersion != null && sv < this.lastStateVersion) {
      this.record({
        severity: "high",
        area: "stateVersion",
        checkLayer: "sync",
        phase,
        expected: "stateVersion monotonic per observer",
        actual: `regressed ${this.lastStateVersion} → ${sv}`,
        reproducible: true,
        stateVersion: sv,
      });
    }

    if (sv != null) this.lastStateVersion = sv;

    const players = gameState.players ?? [];
    const self = players.find((p) => p.id === this.botId);
    if (self?.hand) {
      const dup = handDuplicateReason(self.hand);
      if (dup) {
        this.record({
          severity: "medium",
          area: "hand",
          checkLayer: "rules",
          phase,
          expected: "no impossible duplicates in own hand",
          actual: `duplicate ${dup} for ${this.botId}`,
          reproducible: false,
          stateVersion: sv ?? undefined,
        });
      }
    }

    if (phase === "PLAYING") {
      const cur = players[gameState.currentPlayerIndex]?.id ?? null;
      if (cur) {
        if (cur !== this.turnHolder) {
          this.turnHolder = cur;
          this.turnSince = Date.now();
          this.reportedTurnStall = false;
          this.reportedBotCpuStall = false;
        } else {
          const elapsed = Date.now() - this.turnSince;
          if (
            CPU_ID_RE.test(cur) &&
            !this.reportedBotCpuStall &&
            elapsed > BOT_CPU_STALL_MS
          ) {
            this.reportedBotCpuStall = true;
            this.record({
              severity: "high",
              area: "bot_cpu_stall",
              checkLayer: "flow",
              phase,
              expected:
                "CPU opponent acts within ~20s on bot table (BOTOPN)",
              actual: `cpu turn stuck on ${cur} for ${elapsed}ms (stateVersion=${sv ?? "?"})`,
              reproducible: true,
              stateVersion: sv ?? undefined,
            });
          } else if (
            !CPU_ID_RE.test(cur) &&
            !this.reportedTurnStall &&
            elapsed > TURN_STALL_MS
          ) {
            this.reportedTurnStall = true;
            this.record({
              severity: "medium",
              area: "turn",
              checkLayer: "flow",
              phase,
              expected: "human turn advances within 30s while round in progress",
              actual: `unchanged on ${cur} for ${elapsed}ms`,
              reproducible: false,
              stateVersion: sv ?? undefined,
            });
          }
        }
      }
    } else {
      this.turnHolder = null;
    }

    const roundComplete =
      isRoundCompleteForLiving(gameState) && !gameState.tenRulePending;
    if (!roundComplete && phase === "PLAYING") {
      this.roundActiveSince = Date.now();
      this.reportedRoundStall = false;
    } else if (
      !roundComplete &&
      !this.reportedRoundStall &&
      Date.now() - this.roundActiveSince > ROUND_STALL_MS
    ) {
      this.reportedRoundStall = true;
      this.record({
        severity: "medium",
        area: "round",
        checkLayer: "flow",
        phase,
        expected: "bot table round completes within bounded time",
        actual: `no round complete after ${ROUND_STALL_MS}ms`,
        reproducible: false,
        stateVersion: sv ?? undefined,
      });
    }
  }

  /**
   * @param {Omit<InvariantFailure, 'build'|'room'|'botId'|'displayName'|'personality'|'ts'>} partial
   */
  record(partial) {
    const dedupeKey = `${partial.area}|${partial.actual}`;
    if (this.reportedKeys.has(dedupeKey)) return null;
    this.reportedKeys.add(dedupeKey);

    const row = {
      ...partial,
      build: this.build,
      room: this.room,
      botId: this.botId,
      displayName: this.displayName,
      personality: this.personality,
      ts: new Date().toISOString(),
    };
    this.failures.push(row);
    return row;
  }
}
