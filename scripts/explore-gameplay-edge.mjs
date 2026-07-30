/**
 * Gameplay Exploration Agent — edge scenarios via gameBridge (no UI).
 * node scripts/explore-gameplay-edge.mjs
 *
 * Covers: multi-10 tricks, last-player/one-opponent, joker on 10 pile,
 * on-top after 10 direction, long run extensions.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
require("../server/gameBridge.js");
const core = require("../server/gameBridge.js");

const {
  createGame,
  playCards,
  passTurn,
  setTenRuleDirection,
  isValidPlay,
  resolveTrickLeaderIndex,
  resolveDisplayTurnPlayerIndex,
  resolveEffectiveTenRule,
  playerCanActInCurrentTrick,
  isPlayerStillIn,
  isRoundCompleteForLiving,
  livingPlayerIds,
} = core;

const VERBOSE = process.env.EXPLORE_VERBOSE === "1";

/** @param {number} value @param {string} [suit] */
function c(value, suit = "hearts") {
  return { suit, value };
}

function joker() {
  return { suit: "joker", value: 16 };
}

/** @param {number} value */
function pair(value) {
  return [c(value, "hearts"), c(value, "diamonds")];
}

/** @param {number} value */
function single(value, suit = "clubs") {
  return [c(value, suit)];
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function emptyHandsGame() {
  const g = createGame(["A", "B", "C", "D"]);
  g.players.forEach((p) => {
    p.hand = [];
  });
  g.pile = [];
  g.pileHistory = [];
  g.pileOwners = [];
  g.currentTrick = { trickNumber: 1, actions: [] };
  g.trickHistory = [];
  g.finishedOrder = [];
  g.mustPlay = false;
  g.lastPlayPlayerIndex = null;
  g.tenRule = { active: false, direction: null };
  g.tenRulePending = false;
  g.lastRoundOrder = ["1", "2", "3", "4"];
  return g;
}

function pileValues(state) {
  return (state.pile ?? []).map((x) => x.value);
}

function snap(state) {
  const cur = state.players[state.currentPlayerIndex];
  return {
    turn: state.currentPlayerIndex,
    turnId: cur?.id,
    stillIn: cur ? isPlayerStillIn(state, cur.id) : null,
    canAct: cur ? playerCanActInCurrentTrick(state, state.currentPlayerIndex) : null,
    display: resolveDisplayTurnPlayerIndex(state),
    pile: pileValues(state),
    tenRule: state.tenRule,
    tenPending: state.tenRulePending,
    runOnTop: state.runOnTop ?? null,
    finishedOrder: [...(state.finishedOrder ?? [])],
    handLens: state.players.map((p) => p.hand.length),
    trickActions: state.currentTrick?.actions?.length ?? 0,
    leader: resolveTrickLeaderIndex(state),
    lastPlay: state.lastPlayPlayerIndex,
  };
}

/**
 * Player/system observable failure checks after a transition.
 * @returns {Array<{id: string, observable: string, detail: object}>}
 */
function observeFailures(state, ctx) {
  const failures = [];
  const idx = state.currentPlayerIndex;
  const seat = state.players[idx];

  if (!seat) {
    failures.push({
      id: "NO_SEAT",
      observable: "Turn ring points at empty seat — no player to act",
      detail: { idx },
    });
    return failures;
  }

  if (
    !isPlayerStillIn(state, seat.id) &&
    !state.tenRulePending &&
    !(state.runOnTop?.active && state.runOnTop.playerIndex === idx) &&
    !isRoundCompleteForLiving(state)
  ) {
    failures.push({
      id: "TURN_ON_OUT",
      observable: "Turn stuck on player already out of the round",
      detail: snap(state),
    });
  }

  if (
    isPlayerStillIn(state, seat.id) &&
    !playerCanActInCurrentTrick(state, idx) &&
    !state.tenRulePending &&
    !(state.runOnTop?.active && state.runOnTop.playerIndex === idx) &&
    (state.pile?.length ?? 0) > 0
  ) {
    const display = resolveDisplayTurnPlayerIndex(state);
    if (display === idx) {
      failures.push({
        id: "STUCK_INELIGIBLE",
        observable: "Your turn shown but pass/play controls should be blocked",
        detail: snap(state),
      });
    }
  }

  if ((state.pile?.length ?? 0) > 0) {
    const actions = state.currentTrick?.actions ?? [];
    let lastPlay = null;
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i].type === "play") {
        lastPlay = actions[i];
        break;
      }
    }
    if (lastPlay) {
      const pileSorted = pileValues(state).sort((a, b) => a - b);
      const playSorted = lastPlay.cards.map((x) => x.value).sort((a, b) => a - b);
      const quadClose =
        pileSorted.length === 4 &&
        playSorted.length <= 2 &&
        pileSorted.every((v) => v === playSorted[0]);
      if (
        JSON.stringify(pileSorted) !== JSON.stringify(playSorted) &&
        !quadClose
      ) {
        failures.push({
          id: "PILE_MISMATCH",
          observable: "Pile shows different cards than the last play on the trick stack",
          detail: {
            pile: pileValues(state),
            lastPlay: lastPlay.cards.map((x) => x.value),
            lastPlayPlayer: lastPlay.playerId,
            ...snap(state),
          },
        });
      }
    }

    const leader = resolveTrickLeaderIndex(state);
    if (leader !== null && state.lastPlayPlayerIndex !== leader) {
      failures.push({
        id: "LEADER_DESYNC",
        observable: "Winning pile card owner does not match trick leader",
        detail: {
          leader,
          lastPlayPlayerIndex: state.lastPlayPlayerIndex,
          pile: pileValues(state),
        },
      });
    }
  }

  if (ctx.expectedAccepted && !ctx.changed) {
    failures.push({
      id: "REJECTED_LEGAL",
      observable: "Legal play rejected — cards returned, turn unchanged",
      detail: { label: ctx.label, before: ctx.beforeSnap, after: snap(state) },
    });
  }

  if (ctx.expectedRejected && ctx.changed) {
    failures.push({
      id: "ACCEPTED_ILLEGAL",
      observable: "Illegal play accepted — pile/turn changed when it should not",
      detail: { label: ctx.label, before: ctx.beforeSnap, after: snap(state) },
    });
  }

  if (ctx.expectRoundComplete && !isRoundCompleteForLiving(state)) {
    failures.push({
      id: "ROUND_INCOMPLETE",
      observable: "Round should be over but play continues",
      detail: snap(state),
    });
  }

  if (ctx.expectLoneAsshole && state.finishedOrder.length < state.players.length) {
    const living = livingPlayerIds(state.players);
    if (living.length === 1 && !state.finishedOrder.includes(living[0])) {
      failures.push({
        id: "LONE_NOT_PLACED",
        observable: "Last player with cards not placed as Asshole when all others out",
        detail: snap(state),
      });
    }
  }

  return failures;
}

function step(state, mutator, label, expect = {}) {
  const before = cloneState(state);
  const beforeSnap = snap(before);
  const working = cloneState(state);
  const next = mutator(working);
  const changed = JSON.stringify(next) !== JSON.stringify(before);
  const failures = observeFailures(next, {
    label,
    changed,
    beforeSnap,
    expectedAccepted: expect.accepted,
    expectedRejected: expect.rejected,
    expectRoundComplete: expect.roundComplete,
    expectLoneAsshole: expect.loneAsshole,
  });
  return { state: next, changed, failures, snap: snap(next) };
}

function advanceToSeat(state, seat) {
  return { ...state, currentPlayerIndex: seat };
}

function runScenario(id, steps) {
  let state = steps.initial?.() ?? emptyHandsGame();
  const results = [];
  let failures = [];
  const midChecks = steps.midChecks ?? [];

  for (const s of steps.sequence) {
    const r = step(state, s.run, s.name, s.expect ?? {});
    state = r.state;
    results.push({ step: s.name, changed: r.changed, failures: r.failures, snap: r.snap });
    if (r.failures.length) failures = failures.concat(r.failures.map((f) => ({ ...f, scenario: id, step: s.name })));

    for (const mc of midChecks) {
      if (mc.afterStep === s.name) {
        const extra = mc.check(state);
        failures = failures.concat(extra.map((f) => ({ ...f, scenario: id, step: `mid:${s.name}` })));
      }
    }
  }

  if (steps.finalCheck) {
    const extra = steps.finalCheck(state);
    failures = failures.concat(extra.map((f) => ({ ...f, scenario: id, step: "final" })));
  }

  return { id, results, failures, finalSnap: snap(state) };
}

// ─── Scenario builders ───────────────────────────────────────────────

function pastOpeningTrick(game) {
  game.trickHistory = [
    {
      trickNumber: 1,
      actions: [
        { type: "play", playerId: "1", cards: single(3, "clubs"), timestamp: 1 },
        { type: "pass", playerId: "2", timestamp: 2 },
        { type: "pass", playerId: "3", timestamp: 3 },
        { type: "pass", playerId: "4", timestamp: 4 },
      ],
    },
  ];
  game.currentTrick = { trickNumber: 2, actions: [] };
  game.lastRoundOrder = ["1", "2", "3", "4"];
}

function scenarioMultiTenDirectionFlip() {
  const tensA = pair(10);
  const tensB = [c(10, "clubs"), c(10, "spades")];
  const jacks = pair(11);

  return {
    id: "multi_ten_direction_flip",
    initial: () => {
      const g = emptyHandsGame();
      pastOpeningTrick(g);
      g.players[0].hand = [...tensA, ...jacks, ...single(4)];
      g.players[1].hand = [...single(5), ...single(6)];
      g.players[2].hand = [...tensB, ...single(7)];
      g.players[3].hand = [...single(8), ...single(9)];
      g.currentPlayerIndex = 0;
      return g;
    },
    sequence: [
      {
        name: "A leads pair 10s",
        run: (s) => playCards(s, "1", tensA),
        expect: { accepted: true },
      },
      {
        name: "A chooses higher",
        run: (s) => setTenRuleDirection(s, "higher"),
      },
      {
        name: "B passes on 10 pile",
        run: (s) => passTurn(s, "2"),
        expect: { accepted: true },
      },
      {
        name: "C closes quad with second pair 10s",
        run: (s) => playCards(s, "3", tensB),
        expect: { accepted: true },
      },
      {
        name: "D passes on quad tens",
        run: (s) => passTurn(s, "4"),
        expect: { accepted: true },
      },
      {
        name: "A passes on quad tens — trick resolves",
        run: (s) => passTurn(s, "1"),
        expect: { accepted: true },
      },
    ],
    midChecks: [
      {
        afterStep: "C closes quad with second pair 10s",
        check: (state) => {
          const f = [];
          const tenPlays = (state.currentTrick?.actions ?? []).filter(
            (a) => a.type === "play" && a.cards?.some((x) => x.value === 10),
          );
          if (tenPlays.length < 2) {
            f.push({
              id: "MULTI_TEN_MISSING",
              observable: "Two 10 plays expected in one trick — trick stack incomplete",
              detail: { count: tenPlays.length },
            });
          }
          if (!pileValues(state).every((v) => v === 10) || pileValues(state).length !== 4) {
            f.push({
              id: "QUAD_TEN_PILE_WRONG",
              observable: "Second pair 10s should close to four 10s on pile",
              detail: { pile: pileValues(state) },
            });
          }
          const dir = tenPlays[0]?.tenRuleDirection;
          if (dir !== "higher") {
            f.push({
              id: "DIRECTION_NOT_RECORDED",
              observable: "Higher/Lower choice not shown on first 10 play in trick stack",
              detail: { dir },
            });
          }
          return f;
        },
      },
    ],
    finalCheck: (state) => {
      const f = [];
      if (state.runOnTop?.active) {
        f.push({
          id: "ON_TOP_ON_QUAD",
          observable: "On-top triggered on quad bomb pile — unexpected leader extension",
          detail: snap(state),
        });
      }
      if ((state.pile?.length ?? 0) > 0) {
        f.push({
          id: "QUAD_TRICK_NOT_CLEARED",
          observable: "Four 10s trick should have cleared after all others passed",
          detail: snap(state),
        });
      }
      if (state.currentPlayerIndex !== 2) {
        f.push({
          id: "QUAD_WINNER_NOT_LEADING",
          observable: "Player who closed four 10s should have the next lead",
          detail: { expectedIndex: 2, actual: state.currentPlayerIndex, ...snap(state) },
        });
      }
      return f;
    },
  };
}

function scenarioLastPlayerOneOpponent() {
  const ten = single(10, "hearts");
  const three = single(3, "clubs");

  return {
    id: "last_player_one_opponent",
    initial: () => {
      const g = emptyHandsGame();
      g.finishedOrder = ["3", "1"];
      g.players[0].hand = [];
      g.players[1].hand = [...three];
      g.players[2].hand = [];
      g.players[3].hand = [...ten];
      g.currentTrick = { trickNumber: 10, actions: [] };
      g.pile = single(8, "diamonds");
      g.pileHistory = [single(8, "diamonds")];
      g.lastPlayPlayerIndex = 0;
      g.currentPlayerIndex = 3;
      g.passCount = 1;
      g.currentTrick.actions = [
        { type: "play", playerId: "1", playerName: "A", cards: single(8, "diamonds"), timestamp: 1 },
        { type: "pass", playerId: "2", playerName: "B", timestamp: 2 },
      ];
      return g;
    },
    sequence: [
      {
        name: "D (1 card) plays 10 to go out vs B",
        run: (s) => playCards(s, "4", ten),
        expect: { accepted: true },
      },
    ],
    finalCheck: (state) => {
      const f = [];
      const bStillIn = isPlayerStillIn(state, "2");
      const bPlaced = state.finishedOrder.includes("2");
      if (!bPlaced && state.players[1].hand.length === 1) {
        f.push({
          id: "OPPONENT_NOT_ASSHOLE",
          observable: "One opponent left with 1 card but not placed when round should end",
          detail: { finishedOrder: state.finishedOrder, bStillIn, hand: state.players[1].hand.length },
        });
      }
      if (!isRoundCompleteForLiving(state)) {
        f.push({
          id: "ROUND_SHOULD_END",
          observable: "Only one player holds cards but round did not complete",
          detail: snap(state),
        });
      }
      return f;
    },
  };
}

function scenarioJokerOnTenPile() {
  const tens = pair(10);
  const j = [joker()];

  return {
    id: "joker_on_ten_pile",
    initial: () => {
      const g = emptyHandsGame();
      g.players[0].hand = [...tens, ...single(3)];
      g.players[1].hand = [...j, ...single(4)];
      g.players[2].hand = [...single(5), ...single(6)];
      g.players[3].hand = [...single(7), ...single(8)];
      g.currentPlayerIndex = 0;
      return g;
    },
    sequence: [
      { name: "A pair 10s", run: (s) => playCards(s, "1", tens), expect: { accepted: true } },
      { name: "higher direction", run: (s) => setTenRuleDirection(s, "higher") },
      {
        name: "B joker on active 10 pile",
        run: (s) => playCards(advanceToSeat(s, 1), "2", j),
        expect: { accepted: true },
      },
      {
        name: "C must pass on joker",
        run: (s) => passTurn(advanceToSeat(s, 2), "3"),
        expect: { accepted: true },
      },
      {
        name: "D must pass on joker",
        run: (s) => passTurn(advanceToSeat(s, 3), "4"),
        expect: { accepted: true },
      },
      {
        name: "A must pass on joker",
        run: (s) => passTurn(advanceToSeat(s, 0), "1"),
        expect: { accepted: true },
      },
    ],
    midChecks: [
      {
        afterStep: "B joker on active 10 pile",
        check: (state) => {
          const f = [];
          if (!state.pile?.some((x) => x.value === 16)) {
            f.push({
              id: "JOKER_NOT_ON_PILE",
              observable: "Joker play did not remain visible on pile before trick clear",
              detail: { pile: pileValues(state) },
            });
          }
          const leader = resolveTrickLeaderIndex(state);
          const leaderId = leader != null ? state.players[leader]?.id : null;
          if (leaderId !== "2") {
            f.push({
              id: "JOKER_LEADER_WRONG",
              observable: "Joker player should win trick over 10 pile",
              detail: { leaderId, pile: pileValues(state) },
            });
          }
          return f;
        },
      },
    ],
  };
}

function scenarioOnTopAfterTenDirection() {
  const tens = pair(10);
  const jacks = pair(11);

  return {
    id: "on_top_after_ten_higher",
    initial: () => {
      const g = emptyHandsGame();
      g.players[0].hand = [...tens, ...jacks, ...single(3)];
      g.players[1].hand = [...single(4), ...single(5)];
      g.players[2].hand = [...single(6), ...single(7)];
      g.players[3].hand = [...single(8), ...single(9)];
      g.currentPlayerIndex = 0;
      return g;
    },
    sequence: [
      { name: "A pair 10s", run: (s) => playCards(s, "1", tens), expect: { accepted: true } },
      { name: "higher", run: (s) => setTenRuleDirection(s, "higher") },
      { name: "B pass", run: (s) => passTurn(advanceToSeat(s, 1), "2") },
      { name: "C pass", run: (s) => passTurn(advanceToSeat(s, 2), "3") },
      { name: "D pass", run: (s) => passTurn(advanceToSeat(s, 3), "4") },
      {
        name: "A on-top Jacks (exactly +1 rank)",
        run: (s) => {
          if (!s.runOnTop?.active) return s;
          return playCards(advanceToSeat(s, 0), "1", jacks);
        },
        expect: { accepted: true },
      },
    ],
    midChecks: [
      {
        afterStep: "D pass",
        check: (state) => {
          const f = [];
          if (!state.runOnTop?.active) {
            f.push({
              id: "NO_RUN_ON_TOP",
              observable: "Leader should get on-top turn after all pass on 10 pile",
              detail: snap(state),
            });
          }
          const eff = resolveEffectiveTenRule(state);
          if (!eff.active || eff.direction !== "higher") {
            f.push({
              id: "TEN_DIRECTION_LOST",
              observable: "Higher/Lower choice lost during on-top — wrong beat rules shown",
              detail: { eff, pile: pileValues(state) },
            });
          }
          const valid = isValidPlay(
            jacks,
            state.pile,
            eff,
            state.pileHistory,
            state.trickHistory,
            state.fourOfAKindChallenge,
            state.currentTrick,
            state.players,
            state.finishedOrder,
            state.lastRoundOrder,
            "1",
            true,
          );
          if (!valid) {
            f.push({
              id: "ON_TOP_BEAT_INVALID",
              observable: "On-top Jack beat should be legal over pair 10s (higher) but validation rejects",
              detail: { pile: pileValues(state), eff },
            });
          }
          return f;
        },
      },
    ],
  };
}

function scenarioLongRunExtension() {
  const run8 = single(8, "hearts");
  const run9 = single(9, "diamonds");
  const run10 = single(10, "clubs");
  const runJ = single(11, "spades");
  const runQ = single(12, "hearts");
  const runK = single(13, "diamonds");

  return {
    id: "long_run_extension",
    initial: () => {
      const g = emptyHandsGame();
      pastOpeningTrick(g);
      g.players[0].hand = [...run8, ...runQ];
      g.players[1].hand = [...run9, ...runK];
      g.players[2].hand = [...run10, ...single(5)];
      g.players[3].hand = [...runJ, ...single(6)];
      g.currentPlayerIndex = 0;
      return g;
    },
    sequence: [
      { name: "8 lead", run: (s) => playCards(s, "1", run8), expect: { accepted: true } },
      { name: "9 extend", run: (s) => playCards(advanceToSeat(s, 1), "2", run9), expect: { accepted: true } },
      { name: "10 extend (no ten-rule in run)", run: (s) => playCards(advanceToSeat(s, 2), "3", run10), expect: { accepted: true } },
      { name: "J extend", run: (s) => playCards(advanceToSeat(s, 3), "4", runJ), expect: { accepted: true } },
      { name: "Q extend", run: (s) => playCards(advanceToSeat(s, 0), "1", runQ), expect: { accepted: true } },
      { name: "K extend", run: (s) => playCards(advanceToSeat(s, 1), "2", runK), expect: { accepted: true } },
    ],
    finalCheck: (state) => {
      const f = [];
      if (state.tenRule?.active || state.tenRulePending) {
        f.push({
          id: "TEN_RULE_IN_RUN",
          observable: "10 in run wrongly triggered Higher/Lower prompt",
          detail: { tenRule: state.tenRule, tenPending: state.tenRulePending },
        });
      }
      if (pileValues(state)[0] !== 13) {
        f.push({
          id: "RUN_NOT_EXTENDED",
          observable: "Long run should end on King — pile shows wrong top card",
          detail: { pile: pileValues(state) },
        });
      }
      return f;
    },
  };
}

function scenarioTenNearRoundEnd() {
  const ten = single(10);
  const card = single(7);

  return {
    id: "ten_near_round_end_turn_on_out",
    initial: () => {
      const g = emptyHandsGame();
      g.finishedOrder = ["3", "1"];
      g.players[0].hand = [];
      g.players[1].hand = [card[0]];
      g.players[2].hand = [];
      g.players[3].hand = [ten[0]];
      g.currentPlayerIndex = 3;
      g.pile = single(8);
      g.pileHistory = [single(8)];
      g.lastPlayPlayerIndex = 0;
      g.currentTrick = {
        trickNumber: 10,
        actions: [
          { type: "play", playerId: "1", cards: single(8), timestamp: 1 },
          { type: "pass", playerId: "2", timestamp: 2 },
        ],
      };
      return g;
    },
    sequence: [
      {
        name: "D plays last 10 goes out",
        run: (s) => playCards(s, "4", ten),
        expect: { accepted: true, roundComplete: true },
      },
    ],
    finalCheck: (state) => {
      const f = [];
      const cur = state.players[state.currentPlayerIndex];
      if (cur && !isPlayerStillIn(state, cur.id) && !isRoundCompleteForLiving(state)) {
        f.push({
          id: "TURN_ON_OUT_POST_OUT",
          observable: "After going out, turn remains on finished player before round ends",
          detail: snap(state),
        });
      }
      if (!state.finishedOrder.includes("2")) {
        f.push({
          id: "ASSHOLE_NOT_PLACED",
          observable: "Last opponent with 1 card not auto-placed as Asshole",
          detail: { finishedOrder: state.finishedOrder },
        });
      }
      return f;
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  const origLog = console.log;
  console.log = (...args) => {
    const s = args.map(String).join(" ");
    if (s.includes("[core DEBUG]") || s.includes("[core] maybeResolve")) return;
    origLog(...args);
  };

  const scenarios = [
    scenarioMultiTenDirectionFlip(),
    scenarioLastPlayerOneOpponent(),
    scenarioJokerOnTenPile(),
    scenarioOnTopAfterTenDirection(),
    scenarioLongRunExtension(),
    scenarioTenNearRoundEnd(),
  ];

  const allFailures = [];
  const summaries = [];

  for (const spec of scenarios) {
    const r = runScenario(spec.id, spec);
    summaries.push({
      id: r.id,
      steps: r.results.length,
      stepFailures: r.results.filter((x) => x.failures.length).length,
      failures: r.failures,
      finalSnap: r.finalSnap,
    });
    allFailures.push(...r.failures);
    if (VERBOSE) {
      origLog(`\n--- ${r.id} ---`);
      origLog(JSON.stringify(r, null, 2));
    }
  }

  const report = {
    script: "explore-gameplay-edge.mjs",
    scenariosRun: scenarios.length,
    totalFailures: allFailures.length,
    byScenario: summaries.map((s) => ({
      id: s.id,
      failures: s.failures.length,
      ids: s.failures.map((f) => f.id),
    })),
    failures: allFailures,
  };

  origLog("=== explore-gameplay-edge.mjs ===");
  origLog(JSON.stringify(report, null, 2));

  if (allFailures.length === 0) {
    origLog("\nVERDICT: PASS — no player/system observable failures in edge scenarios");
    process.exit(0);
  }

  origLog(`\nVERDICT: FAIL — ${allFailures.length} observable failure(s)`);
  process.exit(1);
}

main();
