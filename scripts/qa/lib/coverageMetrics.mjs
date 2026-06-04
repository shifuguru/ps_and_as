/**
 * Coverage metric registry — owner bot + gap severity for overnight fail rules.
 * @see QA_BOT_LEAGUE.md
 */

import { getQABot } from "./botRoster.mjs";

/** @typedef {'critical'|'high'|'medium'|'low'} GapSeverity */
/** @typedef {import('./botRoster.mjs').QAPersonalityId} QAPersonalityId */

/**
 * @type {readonly {
 *   key: string;
 *   label: string;
 *   owner: QAPersonalityId;
 *   gapSeverity: GapSeverity;
 *   defaultMinExpected: number;
 *   detect: string;
 * }[]}
 */
export const COVERAGE_METRICS = [
  {
    key: "turn_progression",
    label: "Turn progression",
    owner: "speed",
    gapSeverity: "low",
    defaultMinExpected: 50,
    detect: "currentPlayerIndex / stateVersion changes during PLAYING",
  },
  {
    key: "rapid_ready",
    label: "Rapid ready",
    owner: "speed",
    gapSeverity: "low",
    defaultMinExpected: 10,
    detect: "ready toggles within short window at round complete",
  },
  {
    key: "rapid_trades",
    label: "Rapid trades",
    owner: "speed",
    gapSeverity: "low",
    defaultMinExpected: 5,
    detect: "trade selections completed quickly after pendingTrades",
  },
  {
    key: "timeout_paths",
    label: "Timeout paths",
    owner: "slow",
    gapSeverity: "medium",
    defaultMinExpected: 5,
    detect: "delayed action after turn assigned (Tank behaviour)",
  },
  {
    key: "waiting_for_server",
    label: "Waiting for server",
    owner: "slow",
    gapSeverity: "medium",
    defaultMinExpected: 10,
    detect: "gameAction sent, no stateVersion advance within stall threshold",
  },
  {
    key: "spectator_join",
    label: "Spectator join",
    owner: "spectator",
    gapSeverity: "high",
    defaultMinExpected: 5,
    detect: "joinRoom with isSpectator true",
  },
  {
    key: "dead_hand_claim",
    label: "Dead hand claimed",
    owner: "spectator",
    gapSeverity: "high",
    defaultMinExpected: 10,
    detect: "promotedPlayerIds or __dead_hand__ replaced in next deal",
  },
  {
    key: "spectator_promotion",
    label: "Spectator promotion",
    owner: "spectator",
    gapSeverity: "critical",
    defaultMinExpected: 5,
    detect: "spectator → seated in gameState.players",
  },
  {
    key: "reconnect_mid_turn",
    label: "Reconnect mid-turn",
    owner: "disconnect",
    gapSeverity: "high",
    defaultMinExpected: 10,
    detect: "disconnect + reconnect during PLAYING",
  },
  {
    key: "reconnect_during_rankings",
    label: "Reconnect during rankings",
    owner: "disconnect",
    gapSeverity: "critical",
    defaultMinExpected: 5,
    detect: "reconnect while round complete / ready map active",
  },
  {
    key: "reconnect_during_trades",
    label: "Reconnect during trades",
    owner: "disconnect",
    gapSeverity: "high",
    defaultMinExpected: 5,
    detect: "reconnect while pendingTrades incomplete",
  },
  {
    key: "ten_rule",
    label: "10-rule",
    owner: "edge",
    gapSeverity: "high",
    defaultMinExpected: 15,
    detect: "tenRulePending edge",
  },
  {
    key: "joker_ack",
    label: "Joker acknowledgement",
    owner: "edge",
    gapSeverity: "medium",
    defaultMinExpected: 20,
    detect: "ack phase after joker clear",
  },
  {
    key: "four_kind_ack",
    label: "Four-of-a-kind acknowledgement",
    owner: "edge",
    gapSeverity: "medium",
    defaultMinExpected: 10,
    detect: "ack phase + fourOfAKindChallenge",
  },
  {
    key: "runs",
    label: "Runs / on-top",
    owner: "edge",
    gapSeverity: "medium",
    defaultMinExpected: 15,
    detect: "runOnTop or run context in sync",
  },
  {
    key: "duplicate_actions",
    label: "Duplicate actions",
    owner: "exploit",
    gapSeverity: "medium",
    defaultMinExpected: 5,
    detect: "Breaker double-submits same play/pass",
  },
  {
    key: "invalid_actions",
    label: "Invalid actions",
    owner: "exploit",
    gapSeverity: "medium",
    defaultMinExpected: 10,
    detect: "server error / rejected gameAction",
  },
  {
    key: "stale_state_version",
    label: "Stale stateVersion",
    owner: "exploit",
    gapSeverity: "high",
    defaultMinExpected: 1,
    detect: "invariant: stateVersion regression or ignored snapshot",
  },
  {
    key: "ready_toggle",
    label: "Ready toggle",
    owner: "ready_spam",
    gapSeverity: "medium",
    defaultMinExpected: 20,
    detect: "ready on/off at round complete",
  },
  {
    key: "next_round_start",
    label: "Next round start",
    owner: "ready_spam",
    gapSeverity: "critical",
    defaultMinExpected: 20,
    detect: "nextRoundStarting event",
  },
  {
    key: "rankings_ready",
    label: "Rankings + ready phase",
    owner: "ready_spam",
    gapSeverity: "high",
    defaultMinExpected: 20,
    detect: "readyForNextRound after round complete",
  },
  {
    key: "role_trades",
    label: "Role trades completed",
    owner: "chaos",
    gapSeverity: "high",
    defaultMinExpected: 15,
    detect: "pendingTrades cleared / tradesComplete",
  },
  {
    key: "round_complete",
    label: "Round complete",
    owner: "chaos",
    gapSeverity: "critical",
    defaultMinExpected: 30,
    detect: "roundEnded or living round complete in sync",
  },
  {
    key: "last_hand_payload",
    label: "Last hand payload",
    owner: "chaos",
    gapSeverity: "high",
    defaultMinExpected: 15,
    detect: "roundEnded.lastPlayerHand with cards",
  },
];

const METRIC_BY_KEY = new Map(COVERAGE_METRICS.map((m) => [m.key, m]));

/** Gap severities that fail an overnight run when minExpected not met. */
export const OVERNIGHT_FAIL_SEVERITIES = new Set(
  /** @type {GapSeverity[]} */ (["critical", "high"]),
);

/** @param {string} key */
export function getCoverageMetric(key) {
  const m = METRIC_BY_KEY.get(key);
  if (!m) throw new Error(`Unknown coverage metric: ${key}`);
  return m;
}

/** @param {QAPersonalityId} ownerId */
export function metricsForOwner(ownerId) {
  return COVERAGE_METRICS.filter((m) => m.owner === ownerId);
}

/**
 * @param {string} key
 * @param {number} count
 * @param {number} [minExpected]
 */
export function buildGap(key, count, minExpected) {
  const m = getCoverageMetric(key);
  const min = minExpected ?? m.defaultMinExpected;
  const owner = getQABot(m.owner);
  const failed = count < min;
  return {
    metric: key,
    label: m.label,
    count,
    minExpected: min,
    gapSeverity: m.gapSeverity,
    owner: m.owner,
    ownerDisplay: owner.displayName,
    failed,
    failOvernight: failed && OVERNIGHT_FAIL_SEVERITIES.has(m.gapSeverity),
  };
}

/**
 * @param {ReturnType<typeof buildGap>[]} gaps
 */
export function formatGapReportLines(gaps) {
  return gaps
    .filter((g) => g.failed)
    .map((g) => {
      const mark = g.gapSeverity === "critical" ? "⚠" : "○";
      return `${mark} ${g.label}: ${g.count} / ${g.minExpected}  Owner: ${g.ownerDisplay}`;
    });
}
