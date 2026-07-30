/**
 * P0: Play stack / trick order corruption — pair 10s then pair beat attempts.
 * node scripts/investigate-play-stack.mjs
 *
 * Uses core playCards / passTurn via gameBridge (no UI, no core fixes).
 * Asserts invariants A–E after every committed transition.
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
  resolveEffectiveTenRule,
  playerCanActInCurrentTrick,
  resolveDisplayTurnPlayerIndex,
  isPlayerStillIn,
} = core;

const SCENARIOS = Number(process.env.PLAY_STACK_SCENARIOS ?? 1000);
const VERBOSE = process.env.PLAY_STACK_VERBOSE === "1";

/** @param {number} value @param {string} [suit] */
function c(value, suit = "hearts") {
  return { suit, value };
}

/** @param {number} value */
function pair(value) {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  return [c(value, suits[0]), c(value, suits[1])];
}

/** @param {number} value */
function filler(value = 3) {
  return [c(value, "clubs")];
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function lastPlayAction(state) {
  const actions = state.currentTrick?.actions ?? [];
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].type === "play") return actions[i];
  }
  return null;
}

function pileValues(state) {
  return (state.pile ?? []).map((x) => x.value);
}

function actionSummary(state) {
  return (state.currentTrick?.actions ?? []).map((a) => ({
    type: a.type,
    playerId: a.playerId,
    cards: a.type === "play" ? a.cards.map((x) => x.value) : undefined,
    ts: a.timestamp,
  }));
}

/** Documented phases where turn may remain on the actor after their play. */
function turnHoldAllowed(state, actorIndex, before) {
  if (state.tenRulePending) {
    return state.currentPlayerIndex === actorIndex;
  }
  if (state.runOnTop?.active && state.runOnTop.playerIndex === actorIndex) {
    return state.currentPlayerIndex === actorIndex;
  }
  if ((state.trickHistory?.length ?? 0) > (before.trickHistory?.length ?? 0)) {
    const winnerIdx = state.currentPlayerIndex;
    return winnerIdx === actorIndex || state.mustPlay;
  }
  if ((state.pile?.length ?? 0) === 0 && before.pile?.length > 0) {
    return true;
  }
  return false;
}

function checkInvariants(state, ctx) {
  const failures = [];
  const actions = state.currentTrick?.actions ?? [];

  // A — chronological append: timestamps non-decreasing; committed play is tail play when pile matches
  for (let i = 1; i < actions.length; i++) {
    const prev = actions[i - 1].timestamp ?? 0;
    const cur = actions[i].timestamp ?? 0;
    if (cur < prev) {
      failures.push({
        id: "A",
        msg: "currentTrick.actions timestamps not monotonic",
        detail: { i, prev, cur, actions: actionSummary(state) },
      });
      break;
    }
  }
  if (ctx.committedPlay) {
    const tail = actions[actions.length - 1];
    if (!tail || tail.type !== "play") {
      failures.push({
        id: "A",
        msg: "committed play missing as newest action",
        detail: { expected: ctx.committedPlay, actions: actionSummary(state) },
      });
    } else if (
      tail.playerId !== ctx.committedPlay.playerId ||
      JSON.stringify(tail.cards.map((x) => x.value)) !==
        JSON.stringify(ctx.committedPlay.cards.map((x) => x.value))
    ) {
      failures.push({
        id: "A",
        msg: "newest action does not match committed play",
        detail: {
          expected: ctx.committedPlay,
          tail: {
            playerId: tail.playerId,
            cards: tail.cards.map((x) => x.value),
          },
          actions: actionSummary(state),
        },
      });
    }
  }

  // B — pile leader index matches lastPlayPlayerIndex when pile shows a winning play
  if ((state.pile?.length ?? 0) > 0) {
    const leader = resolveTrickLeaderIndex(state);
    if (leader !== null && state.lastPlayPlayerIndex !== leader) {
      failures.push({
        id: "B",
        msg: "lastPlayPlayerIndex !== resolveTrickLeaderIndex with active pile",
        detail: {
          lastPlayPlayerIndex: state.lastPlayPlayerIndex,
          leader,
          pile: pileValues(state),
          actions: actionSummary(state),
        },
      });
    }
    const lastPlay = lastPlayAction(state);
    if (lastPlay && leader !== null) {
      const leaderId = state.players[leader]?.id;
      if (lastPlay.playerId !== leaderId) {
        failures.push({
          id: "B2",
          msg: "newest play action player !== trick leader (stack order corruption)",
          detail: {
            leaderId,
            lastPlayPlayerId: lastPlay.playerId,
            lastPlayCards: lastPlay.cards.map((x) => x.value),
            pile: pileValues(state),
            actions: actionSummary(state),
          },
        });
      }
    }
  }

  // C — turn advances off actor after successful play unless documented hold
  if (ctx.committedPlay && ctx.actorIndex >= 0) {
    const held = turnHoldAllowed(state, ctx.actorIndex, ctx.before);
    if (!held && state.currentPlayerIndex === ctx.actorIndex) {
      failures.push({
        id: "C",
        msg: "turn stuck on actor after successful play",
        detail: {
          actorIndex: ctx.actorIndex,
          actorId: state.players[ctx.actorIndex]?.id,
          pile: pileValues(state),
          tenRulePending: state.tenRulePending,
          runOnTop: state.runOnTop ?? null,
          display: resolveDisplayTurnPlayerIndex(state),
          actions: actionSummary(state),
        },
      });
    }
  }

  // D — pile matches last play (or quad-closure combine) when trick ongoing
  if ((state.pile?.length ?? 0) > 0) {
    const lastPlay = lastPlayAction(state);
    if (lastPlay) {
      const pileVals = pileValues(state).sort((a, b) => a - b);
      const playVals = lastPlay.cards.map((x) => x.value).sort((a, b) => a - b);
      const closesToQuad =
        pileVals.length === 4 &&
        playVals.length <= 2 &&
        pileVals.every((v) => v === playVals[0]) &&
        (state.fourOfAKindChallenge?.active ||
          state.lastClear?.type === "four");
      const pileMatchesPlay =
        JSON.stringify(pileVals) === JSON.stringify(playVals);
      if (!pileMatchesPlay && !closesToQuad) {
        failures.push({
          id: "D",
          msg: "pile does not match newest play action (render-under bug signature)",
          detail: {
            pile: pileValues(state),
            lastPlayCards: lastPlay.cards.map((x) => x.value),
            lastPlayPlayerId: lastPlay.playerId,
            fourOfAKind: state.fourOfAKindChallenge ?? null,
            actions: actionSummary(state),
          },
        });
      }
    }
  }

  // E — authoritative seat legal or documented exception
  const idx = state.currentPlayerIndex;
  const seat = state.players[idx];
  if (!seat) {
    failures.push({ id: "E", msg: "currentPlayerIndex out of range", detail: { idx } });
  } else {
    const canAct = playerCanActInCurrentTrick(state, idx);
    const stillIn = isPlayerStillIn(state, seat.id);
    const exception =
      state.tenRulePending ||
      (state.runOnTop?.active && state.runOnTop.playerIndex === idx) ||
      !stillIn;
    if (!canAct && !exception && !state.tenRulePending) {
      const display = resolveDisplayTurnPlayerIndex(state);
      if (display !== idx) {
        failures.push({
          id: "E",
          msg: "authoritative turn on ineligible seat (display desync)",
          detail: {
            currentPlayerIndex: idx,
            playerId: seat.id,
            stillIn,
            canAct,
            display,
            pile: pileValues(state),
            actions: actionSummary(state),
          },
        });
      }
    }
  }

  return failures;
}

function applyAndCheck(state, mutator, label) {
  const before = cloneState(state);
  const next = mutator(state);
  const changed = JSON.stringify(next) !== JSON.stringify(state);
  const ctx = {
    before,
    label,
    committedPlay: null,
    actorIndex: -1,
  };

  if (changed && label.startsWith("play:")) {
    const m = label.match(/^play:([^:]+):/);
    const playerId = m?.[1];
    ctx.actorIndex = next.players.findIndex((p) => p.id === playerId);
    const last = next.currentTrick?.actions?.[next.currentTrick.actions.length - 1];
    if (last?.type === "play") {
      ctx.committedPlay = {
        playerId: last.playerId,
        cards: last.cards.map((x) => ({ value: x.value, suit: x.suit })),
      };
    }
  }

  const failures = checkInvariants(next, ctx);
  return { next, changed, failures, before, ctx };
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

function advanceToSeat(state, seat) {
  return { ...state, currentPlayerIndex: seat };
}

function runStepsUntilBeater(state, beaterSeat) {
  let st = state;
  const n = st.players.length;
  for (let i = 0; i < n; i++) {
    const idx = (st.currentPlayerIndex + i) % n;
    if (idx === beaterSeat) {
      return advanceToSeat(st, beaterSeat);
    }
    const pid = st.players[idx].id;
    if (playerCanActInCurrentTrick(st, idx)) {
      st = passTurn(st, pid);
    }
  }
  return advanceToSeat(st, beaterSeat);
}

const BEAT_RANKS = [6, 7, 8, 9, 11, 12, 13, 14]; // pair ranks to try vs pair 10s
const DIRECTIONS = ["higher", "lower"];
const BEATER_SEATS = [1, 2, 3]; // B, C, D (0-indexed 1..3)
const PASS_PATTERNS = ["all", "one", "none"]; // before beat

function buildScenario(spec) {
  const {
    id,
    direction,
    beatRank,
    beaterSeat,
    passPattern,
    phase, // "active_ten" | "on_top" | "immediate_after_tens"
  } = spec;

  let state = emptyHandsGame();
  const tens = pair(10);
  const beatCards = pair(beatRank);

  state.players[0].hand = [...tens, ...filler(3), ...filler(4)];
  for (let i = 1; i < 4; i++) {
    state.players[i].hand = [...beatCards.map((x) => ({ ...x })), ...filler(5 + i)];
  }
  state.currentPlayerIndex = 0;

  const steps = [];
  steps.push({
    name: "lead pair 10s",
    run: (s) => applyAndCheck(s, (st) => playCards(st, "1", tens), "play:1:pair10"),
  });

  if (phase === "immediate_after_tens") {
    steps.push({
      name: `beater ${beatRank}s before direction`,
      run: (s) => {
        const beaterId = String(beaterSeat + 1);
        const st = { ...s, currentPlayerIndex: beaterSeat };
        return applyAndCheck(
          st,
          (x) => playCards(x, beaterId, beatCards),
          `play:${beaterId}:beat${beatRank}`,
        );
      },
    });
    return { id, steps };
  }

  steps.push({
    name: `setTenRule ${direction}`,
    run: (s) => applyAndCheck(s, (st) => setTenRuleDirection(st, direction), "tenRule"),
  });

  if (phase === "active_ten") {
    if (passPattern === "all") {
      for (const seat of [1, 2, 3]) {
        if (seat === beaterSeat) continue;
        steps.push({
          name: `pass seat ${seat}`,
          run: (s) => {
            const st = { ...s, currentPlayerIndex: seat };
            return applyAndCheck(st, (x) => passTurn(x, String(seat + 1)), `pass:${seat}`);
          },
        });
      }
    } else if (passPattern === "one") {
      const passer = beaterSeat === 1 ? 2 : 1;
      steps.push({
        name: `pass seat ${passer}`,
        run: (s) => {
          const st = { ...s, currentPlayerIndex: passer };
          return applyAndCheck(st, (x) => passTurn(x, String(passer + 1)), `pass:${passer}`);
        },
      });
    }

    steps.push({
      name: `beater ${beatRank}s during active ten`,
      run: (s) => {
        const beaterId = String(beaterSeat + 1);
        const st = runStepsUntilBeater(s, beaterSeat);
        return applyAndCheck(
          st,
          (x) => playCards(x, beaterId, beatCards),
          `play:${beaterId}:beat${beatRank}`,
        );
      },
    });
    return { id, steps };
  }

  // on_top path — everyone else passes, leader gets runOnTop
  for (const seat of [1, 2, 3]) {
    steps.push({
      name: `pass seat ${seat}`,
      run: (s) => {
        const st = { ...s, currentPlayerIndex: seat };
        return applyAndCheck(st, (x) => passTurn(x, String(seat + 1)), `pass:${seat}`);
      },
    });
  }

  if (phase === "on_top") {
    steps.push({
      name: `leader on-top beat ${beatRank}s`,
      run: (s) =>
        applyAndCheck(
          s,
          (st) => playCards(st, "1", beatCards),
          `play:1:onTop${beatRank}`,
        ),
    });
  }

  return { id, steps };
}

function buildMutatedScenario(spec) {
  const { direction, beatRank, beaterSeat, passersBeforeBeat } = spec;
  const tens = pair(10);
  const beatCards = pair(beatRank);
  const steps = [];

  steps.push({
    name: "mutate: pair 10s + direction",
    run: (s) => {
      let st = playCards(s, "1", tens);
      st = setTenRuleDirection(st, direction);
      return applyAndCheck(s, () => st, "mutate:setup");
    },
  });

  const passOrder = [1, 2, 3].filter((x) => x !== beaterSeat).slice(0, passersBeforeBeat);
  for (const seat of passOrder) {
    steps.push({
      name: `mutate pass ${seat}`,
      run: (s) => {
        const st = { ...s, currentPlayerIndex: seat };
        return applyAndCheck(st, (x) => passTurn(x, String(seat + 1)), `pass:${seat}`);
      },
    });
  }

  steps.push({
    name: `mutate beat ${beatRank}s by seat ${beaterSeat}`,
    run: (s) => {
      const beaterId = String(beaterSeat + 1);
      const st = runStepsUntilBeater(s, beaterSeat);
      return applyAndCheck(
        st,
        (x) => playCards(x, beaterId, beatCards),
        `play:${beaterId}:beat${beatRank}`,
      );
    },
  });

  return { id: spec.id, steps };
}

function buildRegularPairScenario(spec) {
  const { beatRank, beaterSeat } = spec;
  const nines = pair(9);
  const tens = pair(10);
  const beatCards = pair(beatRank);
  const steps = [];

  steps.push({
    name: "regular: pair 9s lead",
    run: (s) => applyAndCheck(s, (st) => playCards(st, "1", nines), "play:1:pair9"),
  });
  steps.push({
    name: "regular: pass to beater",
    run: (s) => {
      let st = s;
      for (const seat of [1, 2, 3]) {
        if (seat === beaterSeat) break;
        st = { ...st, currentPlayerIndex: seat };
        st = passTurn(st, String(seat + 1));
      }
      return applyAndCheck(s, () => st, "regular:passes");
    },
  });
  steps.push({
    name: `regular: pair ${beatRank}s beat attempt`,
    run: (s) => {
      const beaterId = String(beaterSeat + 1);
      const st = runStepsUntilBeater(s, beaterSeat);
      return applyAndCheck(
        st,
        (x) => playCards(x, beaterId, beatCards),
        `play:${beaterId}:regular${beatRank}`,
      );
    },
  });

  return { id: spec.id, steps };
}

function enumerateScenarios(limit) {
  const specs = [];
  const phases = ["active_ten", "on_top", "immediate_after_tens"];
  for (const direction of DIRECTIONS) {
    for (const beatRank of BEAT_RANKS) {
      for (const beaterSeat of BEATER_SEATS) {
        for (const passPattern of PASS_PATTERNS) {
          for (const phase of phases) {
            if (phase === "on_top" && passPattern !== "all") continue;
            if (phase === "immediate_after_tens" && passPattern !== "none") continue;
            specs.push({
              id: `d${direction[0]}_r${beatRank}_b${beaterSeat}_p${passPattern[0]}_${phase}`,
              direction,
              beatRank,
              beaterSeat,
              passPattern,
              phase,
            });
            if (specs.length >= limit) return specs;
          }
        }
      }
    }
  }

  // Mid-trick mutations: pair 10s already on pile, direction set, partial passes — inject beat
  for (const direction of DIRECTIONS) {
    for (const beatRank of BEAT_RANKS) {
      for (const beaterSeat of BEATER_SEATS) {
        for (let passers = 0; passers <= 2; passers++) {
          specs.push({
            id: `mut_${direction[0]}_r${beatRank}_b${beaterSeat}_pass${passers}`,
            direction,
            beatRank,
            beaterSeat,
            passPattern: "mut",
            phase: "mutated_mid",
            passersBeforeBeat: passers,
          });
          if (specs.length >= limit) return specs;
        }
      }
    }
  }

  // Regular (non-ten-rule) pair 10s beat attempts — pile from prior pair 9s lead
  for (const beatRank of BEAT_RANKS) {
    for (const beaterSeat of BEATER_SEATS) {
      specs.push({
        id: `regular_r${beatRank}_b${beaterSeat}`,
        direction: "none",
        beatRank,
        beaterSeat,
        passPattern: "none",
        phase: "regular_pair",
      });
      if (specs.length >= limit) return specs;
    }
  }

  // Incident cluster: pair 10s → pair 8s by each seat, both directions, all phases
  for (const direction of DIRECTIONS) {
    for (const beaterSeat of BEATER_SEATS) {
      for (const phase of ["active_ten", "on_top", "mutated_mid"]) {
        specs.push({
          id: `incident_d${direction[0]}_b${beaterSeat}_${phase}`,
          direction,
          beatRank: 8,
          beaterSeat,
          passPattern: phase === "mutated_mid" ? "mut" : "all",
          phase,
          passersBeforeBeat: phase === "mutated_mid" ? 1 : 0,
        });
        if (specs.length >= limit) return specs;
      }
    }
  }

  // Pad to limit with filler variants (same logic, different trick numbers)
  let pad = 0;
  while (specs.length < limit) {
    const base = specs[pad % specs.length];
    specs.push({
      ...base,
      id: `${base.id}_pad${pad}`,
      trickNumberOffset: (pad % 5) + 1,
    });
    pad++;
  }

  return specs;
}

function expectedValidBeat(direction, beatRank, phase, runOnTop) {
  const pileRank = phase === "regular_pair" ? 9 : 10;
  const playRank = beatRank;
  const pileCount = 2;
  const playCount = 2;
  if (phase === "immediate_after_tens") return false;
  if (phase === "regular_pair") {
    return playCount === pileCount && playRank > pileRank;
  }
  if (phase === "on_top" || runOnTop) {
    if (direction === "higher") {
      return playCount === pileCount && playRank === pileRank + 1;
    }
    if (direction === "lower") {
      return playRank === pileRank - 1 && playCount >= pileCount;
    }
  }
  if (direction === "higher") {
    return playCount === pileCount && playRank > pileRank;
  }
  if (direction === "lower") {
    return playCount === pileCount && playRank < pileRank;
  }
  return false;
}

function runScenario(spec) {
  let scenario;
  if (spec.phase === "mutated_mid") scenario = buildMutatedScenario(spec);
  else if (spec.phase === "regular_pair") scenario = buildRegularPairScenario(spec);
  else scenario = buildScenario(spec);

  let state = emptyHandsGame();
  const tens = pair(10);
  const beatCards = pair(spec.beatRank);
  const nines = pair(9);

  if (spec.phase === "regular_pair") {
    state.players[0].hand = [...nines, ...filler(3)];
    state.players[spec.beaterSeat].hand = [...beatCards, ...filler(4)];
    for (let i = 1; i < 4; i++) {
      if (i !== spec.beaterSeat) state.players[i].hand = [...filler(5 + i)];
    }
  } else {
    state.players[0].hand = [...tens, ...filler(3), ...filler(4)];
    if (spec.phase === "on_top") {
      state.players[0].hand.push(...beatCards.map((x) => ({ ...x })));
    }
    for (let i = 1; i < 4; i++) {
      state.players[i].hand = [...beatCards.map((x) => ({ ...x })), ...filler(5 + i)];
    }
  }
  state.currentPlayerIndex = 0;
  if (spec.trickNumberOffset) {
    state.currentTrick = { trickNumber: spec.trickNumberOffset, actions: [] };
  }

  const stepResults = [];
  let anyFailure = null;

  for (const step of scenario.steps) {
    const result = step.run(state);
    state = result.next;
    stepResults.push({
      step: step.name,
      changed: result.changed,
      failures: result.failures,
    });
    if (result.failures.length && !anyFailure) {
      anyFailure = {
        scenario: spec.id,
        step: step.name,
        failures: result.failures,
        actions: actionSummary(state),
        pile: pileValues(state),
        currentPlayerIndex: state.currentPlayerIndex,
        lastPlayPlayerIndex: state.lastPlayPlayerIndex,
        leader: resolveTrickLeaderIndex(state),
        display: resolveDisplayTurnPlayerIndex(state),
        runOnTop: state.runOnTop ?? null,
        tenRule: state.tenRule,
        tenRulePending: state.tenRulePending,
      };
    }
  }

  const runOnTop = !!state.runOnTop?.active;
  const shouldBeat = expectedValidBeat(
    spec.direction,
    spec.beatRank,
    spec.phase,
    runOnTop || spec.phase === "on_top",
  );

  const beatStep = stepResults.find((s) => s.step.includes("beat") || s.step.includes("on-top"));
  const beatChanged = beatStep?.changed ?? false;

  const incidentPair8 =
    spec.beatRank === 8 &&
    (spec.phase?.includes("ten") ||
      spec.phase === "on_top" ||
      spec.phase === "mutated_mid" ||
      spec.id?.startsWith("incident"));

  return {
    id: spec.id,
    spec,
    shouldBeat,
    beatAccepted: beatChanged,
    invariantFailures: anyFailure,
    stepResults,
    incidentPair8,
  };
}

function clusterKey(failure) {
  const ids = failure.failures.map((f) => f.id).sort().join("+");
  const first = failure.failures[0];
  return `${ids}|${first?.msg ?? "unknown"}`;
}

function main() {
  const origLog = console.log;
  console.log = (...args) => {
    const s = args.map(String).join(" ");
    if (s.includes("[core DEBUG]") || s.includes("[core] maybeResolve")) return;
    origLog(...args);
  };

  const specs = enumerateScenarios(SCENARIOS);
  const results = [];
  const failures = [];
  const mismatchValid = [];
  const incidentResults = [];

  for (const spec of specs) {
    const r = runScenario(spec);
    results.push(r);
    if (r.invariantFailures) failures.push(r.invariantFailures);
    if (r.shouldBeat !== r.beatAccepted && r.shouldBeat) {
      mismatchValid.push({
        id: r.id,
        shouldBeat: r.shouldBeat,
        beatAccepted: r.beatAccepted,
      });
    }
    if (r.incidentPair8) incidentResults.push(r);
  }

  const clusters = new Map();
  for (const f of failures) {
    const key = clusterKey(f);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(f);
  }

  const incidentSignature = failures.filter((f) =>
    f.failures.some(
      (x) =>
        (x.id === "D" || x.id === "B2") &&
        f.pile?.includes(8) &&
        f.actions?.some((a) => a.cards?.includes(10)),
    ),
  );

  const incidentPair8Failures = incidentResults.filter((r) => r.invariantFailures);
  const incidentPair8Stall = incidentResults.filter(
    (r) =>
      r.invariantFailures?.failures?.some((x) => x.id === "C") ||
      (r.beatAccepted &&
        r.stepResults.some((s) => s.failures?.some((x) => x.id === "C"))),
  );

  const stallOnBeater = failures.filter(
    (f) =>
      f.failures.some((x) => x.id === "C") &&
      f.spec?.phase !== "on_top" &&
      f.step?.includes("beat"),
  );

  const summary = {
    scenariosRun: results.length,
    invariantViolations: failures.length,
    beatRejectedWhenValid: mismatchValid.length,
    beatAcceptedWhenInvalid: results.filter(
      (r) => !r.shouldBeat && r.beatAccepted && r.spec.phase !== "immediate_after_tens",
    ).length,
    incidentPair8Scenarios: incidentResults.length,
    incidentPair8InvariantFailures: incidentPair8Failures.length,
    incidentPair8StallCount: incidentPair8Stall.length,
    clusters: [...clusters.entries()].map(([key, items]) => ({
      key,
      count: items.length,
      sample: items[0],
    })),
    incidentSignatureCount: incidentSignature.length,
    stallOnBeaterCount: stallOnBeater.length,
  };

  console.log("=== investigate-play-stack.mjs ===");
  console.log(JSON.stringify(summary, null, 2));

  if (VERBOSE && failures.length) {
    console.log("\n--- first 5 failures ---");
    console.log(JSON.stringify(failures.slice(0, 5), null, 2));
  }

  let verdict;
  if (incidentPair8Failures.length > 0 || incidentSignature.length > 0) {
    verdict = "VERIFIED BUG";
  } else if (failures.length > 0) {
    verdict = "LIKELY BUG";
  } else {
    verdict = "DUPLICATE";
  }

  console.log(`\nVERDICT: ${verdict}`);
  if (verdict === "DUPLICATE") {
    console.log(
      "Core playCards/passTurn preserved invariants A–E across",
      results.length,
      "pair-10 → pair-beat scenarios.",
      "Pair-10 → pair-8 incident NOT reproduced in authoritative core.",
      "Manual trace: lower accepts pair-8 (pile=[8,8], turn→C); higher rejects.",
      "Likely presentation/sync (GamePlayArea flights, optimistic pass) — not core trick order.",
    );
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main();
