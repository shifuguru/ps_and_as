/**
 * Per-run coverage counters driven by socket sync/events.
 */
import { createRequire } from "module";
import {
  COVERAGE_METRICS,
  buildGap,
  formatGapReportLines,
} from "./coverageMetrics.mjs";

const require = createRequire(import.meta.url);
const { isRoundCompleteForLiving } = require("../../../server/gameBridge.js");

export class CoverageTracker {
  constructor() {
    /** @type {Record<string, number>} */
    this.counts = Object.fromEntries(
      COVERAGE_METRICS.map((m) => [m.key, 0]),
    );
    this._lastReadyMap = "";
  }

  /** @param {string} key @param {number} [n] */
  bump(key, n = 1) {
    if (!(key in this.counts)) return;
    this.counts[key] += n;
  }

  /**
   * @param {object | null} prev
   * @param {object | null} next
   */
  onGameState(prev, next) {
    if (!next) return;

    const phase = next.phase ?? "";
    const prevSv = prev?.stateVersion;
    const nextSv = next.stateVersion;

    if (phase === "PLAYING" && nextSv != null && nextSv !== prevSv) {
      this.bump("turn_progression");
    }

    if (isRoundCompleteForLiving(next) && !next.tenRulePending) {
      this.bump("round_complete");
    }

    if (next.tenRulePending) {
      this.bump("ten_rule");
    }

    if (next.runOnTop?.active) {
      this.bump("runs");
    }

    if (next.fourOfAKindChallenge) {
      this.bump("four_kind_ack");
    }

    const ready = next.readyForNextRound ?? {};
    const readyKey = JSON.stringify(ready);
    if (readyKey !== this._lastReadyMap) {
      this._lastReadyMap = readyKey;
      this.bump("ready_toggle");
      if (Object.values(ready).some(Boolean)) {
        this.bump("rankings_ready");
      }
    }

    const pending = next.pendingTrades ?? {};
    const tradeKeys = Object.keys(pending);
    if (tradeKeys.length === 0 && prev) {
      const prevKeys = Object.keys(prev.pendingTrades ?? {});
      if (prevKeys.length > 0) {
        this.bump("role_trades");
      }
    }
  }

  /** @param {object} data */
  onRoundEnded(data) {
    this.bump("round_complete");
    if (data?.lastPlayerHand) {
      this.bump("last_hand_payload");
    }
  }

  onNextRoundStarting() {
    this.bump("next_round_start");
  }

  /** @param {{ isSpectator?: boolean }} meta */
  onConnected(meta) {
    if (meta?.isSpectator) {
      this.bump("spectator_join");
    }
  }

  onServerError() {
    this.bump("invalid_actions");
  }

  /**
   * @param {number} [minScale] Multiply defaultMinExpected (0–1) for short runs.
   */
  buildSummary(minScale = 1) {
    const gaps = COVERAGE_METRICS.map((m) => {
      const min = Math.max(0, Math.floor(m.defaultMinExpected * minScale));
      return buildGap(m.key, this.counts[m.key] ?? 0, min);
    });
    return {
      counts: { ...this.counts },
      gaps,
      gapLines: formatGapReportLines(gaps),
      failOvernight: gaps.some((g) => g.failOvernight),
    };
  }
}
