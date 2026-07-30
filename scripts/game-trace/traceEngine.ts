/**
 * Deterministic gameplay trace engine — observability only.
 * Does not modify core rules or CPU heuristics.
 */
import * as fs from "fs";
import * as path from "path";
import type { Card, Player } from "../../src/game/ruleset";
import { formatCardRank, createDeck, dealCards } from "../../src/game/ruleset";
import type { GameState } from "../../src/game/core";
import {
  playCards,
  passTurn,
  applyCpuTurn,
  findCPUPlay,
  isValidPlay,
  isPlayerStillIn,
  isRoundCompleteForLiving,
  setTenRuleDirection,
  repairStuckTurnPointer,
  advanceOffPriorPasser,
  resolveDisplayTurnPlayerIndex,
  playerCanActInCurrentTrick,
  hasPassedInCurrentTrick,
  resolveRunContext,
  resolveEffectiveTenRule,
  isOnTopEligiblePile,
  isRunContextSequence,
  rankIndex,
  containsTen,
  wouldActivateTenRule,
  type PlayCardsOptions,
} from "../../src/game/core";
import {
  executeCeremonyDeal,
  buildFreshRoundState,
  autoCompleteCpuWinnerTrades,
  pickLowestCards,
  completeWinnerReturn,
  type ClientPendingTrade,
} from "../../src/game/roundPrep";
import { isDeadHandPlayer } from "../../src/game/deadHand";

export const TRACE_SEEDS = [1001, 1002, 1003, 1004, 1005] as const;
export const ROUNDS_PER_GAME = 4;
export const MAX_STEPS_PER_ROUND = 2500;

const SUIT_SYMBOL: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  joker: "★",
};

export type WarningRecord = {
  category: "run" | "onTop" | "trade" | "turnOwnership" | "tenRule" | "other";
  message: string;
  turn?: number;
  round?: number;
};

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function shuffleWithRng(deck: Card[], rng: () => number) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGameSeeded(names: string[], seed: number): GameState {
  const players: Player[] = names.map((n, i) => ({
    id: String(i + 1),
    name: n,
    hand: [],
    role: "Neutral",
  }));
  const deck = createDeck();
  const shuffled = shuffleWithRng(deck, makeRng(seed));
  dealCards(shuffled, players);
  const threeIndex = players.findIndex((p) =>
    p.hand.some((c) => c.suit === "clubs" && c.value === 3),
  );
  const start = threeIndex >= 0 ? threeIndex : 0;
  return {
    id: `trace-${seed}`,
    players,
    currentPlayerIndex: start,
    pile: [],
    pileHistory: [],
    pileOwners: [],
    passCount: 0,
    finishedOrder: [],
    started: true,
    lastPlayPlayerIndex: null,
    mustPlay: threeIndex >= 0,
    currentTrick: { trickNumber: 1, actions: [] },
    trickHistory: [],
    tenRule: { active: false, direction: null },
  } as GameState;
}

export function formatCard(c: Card): string {
  const rank = formatCardRank(c);
  if (c.suit === "joker") return rank;
  return `${rank}${SUIT_SYMBOL[c.suit] ?? c.suit[0]}`;
}

export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(" ");
}

export function formatPileValues(pile: Card[]): string {
  if (!pile?.length) return "[]";
  const v = pile[0].value;
  if (pile.every((c) => c.value === v)) {
    return pile.length === 1 ? `[${formatCardRank(pile[0])}]` : `[${formatCardRank(pile[0])}×${pile.length}]`;
  }
  return `[${formatCards(pile)}]`;
}

function playerLabel(state: GameState, idx: number): string {
  const p = state.players[idx];
  return p ? `P${idx + 1}` : `?${idx}`;
}

function playerLabelById(state: GameState, id: string): string {
  const idx = state.players.findIndex((p) => p.id === id);
  return idx >= 0 ? playerLabel(state, idx) : id;
}

function buildChronology(state: GameState): number[] {
  const hist = state.pileHistory ?? [];
  const pile = state.pile ?? [];
  if (!pile.length) {
    const plays: number[] = [];
    for (const a of state.currentTrick?.actions ?? []) {
      if (a.type === "play" && a.cards?.length && a.cards[0]) {
        plays.push(a.cards[0].value);
      }
    }
    return plays;
  }
  return [...hist.map((h) => h[0]?.value).filter((v) => v != null), pile[0].value];
}

function isContiguousAscendingValues(values: number[]): boolean {
  if (values.length < 3) return false;
  for (let i = 1; i < values.length; i++) {
    if (rankIndex(values[i]) !== rankIndex(values[i - 1]) + 1) return false;
  }
  return true;
}

function isSubsequenceInOrder(hay: number[], needle: number[]): boolean {
  let j = 0;
  for (const v of hay) {
    if (v === needle[j]) j++;
    if (j >= needle.length) return true;
  }
  return false;
}

function enumerateLegalPlays(state: GameState, playerIdx: number, runOnTop: boolean): Card[][] {
  const player = state.players[playerIdx];
  if (!player?.hand?.length) return [];
  const hand = player.hand;
  const eff = resolveEffectiveTenRule(state);
  const grouped: Record<number, Card[]> = {};
  for (const c of hand) {
    if (!grouped[c.value]) grouped[c.value] = [];
    grouped[c.value].push(c);
  }
  const pileCount = state.pile.length;
  const candidates: Card[][] = [];

  const tryPlay = (cards: Card[]) => {
    if (
      isValidPlay(
        cards,
        state.pile,
        eff,
        state.pileHistory,
        state.trickHistory,
        state.fourOfAKindChallenge,
        state.currentTrick,
        state.players,
        state.finishedOrder,
        state.lastRoundOrder,
        player.id,
        runOnTop,
      )
    ) {
      candidates.push(cards);
    }
  };

  if (pileCount === 0) {
    for (const v of Object.keys(grouped).map(Number).sort((a, b) => rankIndex(a) - rankIndex(b))) {
      const cards = grouped[v];
      for (let take = 1; take <= Math.min(4, cards.length); take++) {
        const combo = cards.slice(0, take);
        tryPlay(combo);
      }
    }
  } else {
    const joker = hand.find((c) => c.suit === "joker");
    if (joker) tryPlay([joker]);
    for (const v of Object.keys(grouped).map(Number)) {
      const cards = grouped[v];
      if (cards.length >= pileCount) tryPlay(cards.slice(0, pileCount));
    }
  }

  candidates.sort((a, b) => rankIndex(a[0].value) - rankIndex(b[0].value));
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.map((x) => `${x.suit}:${x.value}`).join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preprocessTurn(state: GameState) {
  let working = repairStuckTurnPointer(state);
  if (working !== state) return { state: working, kind: "repair-stuck" as const };

  const displayIdx = resolveDisplayTurnPlayerIndex(working);
  if (
    displayIdx !== working.currentPlayerIndex &&
    playerCanActInCurrentTrick(working, displayIdx)
  ) {
    const repaired = repairStuckTurnPointer(advanceOffPriorPasser(working));
    if (repaired !== state) return { state: repaired, kind: "advance-display" as const };
    working = repaired;
  }

  const current = working.players[working.currentPlayerIndex];
  if (!current) throw new Error("no player at currentPlayerIndex");

  if (
    working.finishedOrder.includes(current.id) ||
    current.hand.length === 0 ||
    isDeadHandPlayer(current)
  ) {
    if (isRoundCompleteForLiving(working)) {
      return { state: working, kind: "round-complete" as const };
    }
    const next = passTurn(working, current.id);
    if (
      next.currentPlayerIndex !== working.currentPlayerIndex ||
      next.finishedOrder.length !== working.finishedOrder.length ||
      (next.trickHistory?.length ?? 0) !== (working.trickHistory?.length ?? 0)
    ) {
      return { state: next, kind: "skip-empty-or-out" as const };
    }
    return { state: working, kind: "idle-empty" as const };
  }

  const isRunOnTopTurn =
    !!working.runOnTop?.active &&
    working.runOnTop.playerIndex === working.currentPlayerIndex;

  if (hasPassedInCurrentTrick(working, current.id) && !isRunOnTopTurn) {
    const next = advanceOffPriorPasser(working);
    if (
      next.currentPlayerIndex !== working.currentPlayerIndex ||
      (next.trickHistory?.length ?? 0) !== (working.trickHistory?.length ?? 0) ||
      !!next.runOnTop?.active !== !!working.runOnTop?.active
    ) {
      return { state: next, kind: "advance-off-passer" as const };
    }
  }

  return { state: working, kind: "ready" as const };
}

function findThreeClubOwner(players: Player[]): string {
  for (const p of players) {
    if (p.hand.some((c) => c.suit === "clubs" && c.value === 3)) {
      return playerLabelById({ players } as GameState, p.id);
    }
  }
  return "none";
}

function allRankThreeOwners(players: Player[]): string[] {
  const owners: string[] = [];
  for (const p of players) {
    const threes = p.hand.filter((c) => c.value === 3);
    if (threes.length) {
      owners.push(`${playerLabelById({ players } as GameState, p.id)}:${threes.map(formatCard).join(",")}`);
    }
  }
  return owners.length ? owners : ["none"];
}

export class GameTracer {
  readonly seed: number;
  readonly lines: string[] = [];
  readonly warnings: WarningRecord[] = [];

  turn = 0;
  round = 1;
  runsActivated = 0;
  onTopGrants = 0;
  tenRuleActivations = 0;

  private prevInRun = false;
  private prevRunSeq: number[] = [];
  private prevTenActive = false;
  private prevTenDirection: string | null = null;
  private pendingOnTop: {
    ownerIdx: number;
    reason: string;
    turn: number;
    legalPlays: Card[][];
    passLegal: boolean;
  } | null = null;
  private onTopResolved = false;
  private trickCount = 0;
  private eliminations = 0;
  private actionRng: () => number;

  constructor(seed: number) {
    this.seed = seed;
    this.actionRng = makeRng(seed ^ 0x9e3779b9);
  }

  private log(line = "") {
    this.lines.push(line);
  }

  private warn(category: WarningRecord["category"], message: string) {
    this.warnings.push({ category, message, turn: this.turn, round: this.round });
    this.log(`⚠ ${message}`);
  }

  private nextTenDirection(): "higher" | "lower" {
    return this.actionRng() < 0.5 ? "higher" : "lower";
  }

  private auditRunChange(state: GameState, event: "activated" | "extended" | "broken") {
    const ctx = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder,
    );
    const chronology = buildChronology(state);
    const label =
      event === "activated"
        ? "RUN ACTIVATED"
        : event === "extended"
          ? "RUN EXTENDED"
          : "RUN BROKEN";
    this.log("");
    this.log(label);
    this.log(`Chronology: [${chronology.join(", ")}]`);
    this.log(`Run Sequence: [${ctx.runSeq.map((c) => c.value).join(", ")}]`);
    this.log(`Pile: ${formatPileValues(state.pile)}`);
    this.log(`Multiplicity: ${ctx.runMultiplicity}`);
    this.log(`currentPlayerIndex: ${state.currentPlayerIndex} (${playerLabel(state, state.currentPlayerIndex)})`);

    if (ctx.inRunContext && ctx.runSeq.length >= 3) {
      const steps = ctx.runSeq.slice(1).map((c, i) => rankIndex(c.value) - rankIndex(ctx.runSeq[i].value));
      if (steps.some((s) => s !== 1)) {
        this.warn("run", "Descending run activated");
      }
      if (!isRunContextSequence(ctx.runSeq)) {
        this.warn("run", "Run activated without valid ascending 3-rank sequence");
      }
      const runVals = ctx.runSeq.map((c) => c.value);
      if (chronology.length && !isSubsequenceInOrder(chronology, runVals)) {
        this.warn("run", "Run reconstructed from non-contiguous chronology");
      }
      if (!isContiguousAscendingValues(runVals)) {
        this.warn("run", "Unexpected runSeq");
      }
    }
    this.log("");
  }

  private trackRunState(state: GameState) {
    const ctx = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder,
    );
    const inRun = ctx.inRunContext;
    const seq = ctx.runSeq.map((c) => c.value);

    if (inRun && !this.prevInRun) {
      this.runsActivated++;
      this.auditRunChange(state, "activated");
    } else if (inRun && this.prevInRun && seq.join() !== this.prevRunSeq.join()) {
      if (seq.length > this.prevRunSeq.length) {
        this.auditRunChange(state, "extended");
      } else {
        this.auditRunChange(state, "broken");
        if (inRun) {
          this.runsActivated++;
          this.auditRunChange(state, "activated");
        }
      }
    } else if (!inRun && this.prevInRun) {
      this.auditRunChange(state, "broken");
    }

    this.prevInRun = inRun;
    this.prevRunSeq = seq;
  }

  private trackTenRule(state: GameState, triggeringPlay?: Card[]) {
    const eff = resolveEffectiveTenRule(state);
    const active = !!eff.active && !!eff.direction;
    if (active && !this.prevTenActive) {
      this.tenRuleActivations++;
      this.log("");
      this.log("TEN RULE ACTIVATED");
      this.log(`Direction: ${eff.direction}`);
      this.log(`Pile: ${formatPileValues(state.pile)}`);
      if (triggeringPlay?.length) {
        this.log(`Triggering play: ${formatCards(triggeringPlay)}`);
      }
      this.log("");
    } else if (!active && this.prevTenActive) {
      this.log("");
      this.log("TEN RULE CLEARED");
      this.log(`Pile: ${formatPileValues(state.pile)}`);
      this.log("");
    } else if (this.prevTenActive && active && eff.direction !== this.prevTenDirection) {
      this.warn("tenRule", "Direction lost");
    }
    this.prevTenActive = active;
    this.prevTenDirection = eff.direction ?? null;
  }

  private onTopReason(state: GameState): string {
    const eff = resolveEffectiveTenRule(state);
    const ctx = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder,
    );
    const pileIsTen = state.pile.length > 0 && state.pile.every((c) => c.value === 10);
    if (ctx.inRunContext) return "run";
    if (pileIsTen && eff.direction === "higher") return "ten higher";
    if (pileIsTen && eff.direction === "lower") return "ten lower";
    return "unknown";
  }

  private auditOnTopGrant(state: GameState) {
    const ownerIdx = state.runOnTop?.playerIndex ?? -1;
    const eff = resolveEffectiveTenRule(state);
    const ctx = resolveRunContext(
      state.pile,
      state.pileHistory,
      state.currentTrick,
      state.players,
      state.finishedOrder,
    );
    const legal = enumerateLegalPlays(state, ownerIdx, true);
    const passLegal = legal.length === 0;

    this.onTopGrants++;
    this.log("");
    this.log("ON TOP GRANTED");
    this.log(`Owner: ${playerLabel(state, ownerIdx)}`);
    this.log(`Reason: ${this.onTopReason(state)}`);
    this.log("State:");
    this.log(`  runOnTop.active: ${!!state.runOnTop?.active}`);
    this.log(`  runOnTop.playerIndex: ${state.runOnTop?.playerIndex}`);
    this.log(`  currentPlayerIndex: ${state.currentPlayerIndex} (${playerLabel(state, state.currentPlayerIndex)})`);
    this.log(`  tenRule.direction: ${eff.direction ?? "null"}`);
    this.log(`  runSeq: [${ctx.runSeq.map((c) => c.value).join(", ")}]`);
    this.log(`  pile: ${formatPileValues(state.pile)}`);
    this.log("Legal Plays:");
    legal.slice(0, 8).forEach((p, i) => this.log(`  ${i + 1}. ${formatCards(p)}`));
    if (legal.length === 0) this.log("  (none)");
    else if (legal.length > 8) this.log(`  ... +${legal.length - 8} more`);
    this.log(`Pass Legal: ${passLegal ? "yes" : "no"}`);
    this.log("Chosen Action:");
    this.log("  (pending — next owner turn)");

    if (ownerIdx !== state.currentPlayerIndex) {
      this.warn("onTop", "Owner mismatch");
    }

    const runEligible = ctx.inRunContext;
    const tenEligible =
      state.pile.every((c) => c.value === 10) && !!eff.active && !!eff.direction;
    if (runEligible && tenEligible) {
      this.warn("onTop", "Run On Top and Ten On Top both appear eligible");
    }

    this.pendingOnTop = {
      ownerIdx,
      reason: this.onTopReason(state),
      turn: this.turn,
      legalPlays: legal,
      passLegal,
    };
    this.onTopResolved = false;
    this.log("");
  }

  private resolvePendingOnTop(
    state: GameState,
    playerIdx: number,
    action: "pass" | "play",
    cards?: Card[],
    rejected?: boolean,
  ) {
    if (!this.pendingOnTop || this.onTopResolved) return;
    if (playerIdx !== this.pendingOnTop.ownerIdx) return;

    const legal = this.pendingOnTop.legalPlays;
    const cpuChoice = findCPUPlay(
      state.players[playerIdx].hand,
      state.pile,
      resolveEffectiveTenRule(state),
      state.pileHistory,
      state.fourOfAKindChallenge,
      state.currentTrick,
      state.players,
      state.finishedOrder,
      state.trickHistory,
      state.lastRoundOrder,
      state.players[playerIdx].id,
      true,
    );

    let quality: "optimal" | "reasonable" | "questionable" | "illegal" = "reasonable";
    if (action === "pass") {
      if (legal.length > 0) {
        quality = "questionable";
        this.warn("onTop", "CPU passed while legal On Top plays existed");
      } else {
        quality = "reasonable";
      }
      this.log(`Chosen Action: PASS`);
    } else if (cards?.length) {
      if (rejected) {
        quality = "illegal";
        this.warn("onTop", "CPU attempted illegal On Top play");
      } else {
        const key = cards.map((c) => `${c.suit}:${c.value}`).join(",");
        const lowest = legal[0];
        const lowestKey = lowest?.map((c) => `${c.suit}:${c.value}`).join(",");
        if (lowestKey && key === lowestKey) quality = "optimal";
        else if (legal.some((p) => p.map((c) => `${c.suit}:${c.value}`).join(",") === key)) {
          quality = "reasonable";
        } else {
          quality = "illegal";
        }
        this.log(`Chosen Action: ${formatCards(cards)}`);
      }
    }

    if (legal.length === 1 && action === "pass") {
      this.warn("onTop", "CPU had exactly one legal move and failed to play it");
    }

    this.log(`Decision Quality: ${quality}`);
    if (cpuChoice?.length) {
      this.log(`findCPUPlay suggestion: ${formatCards(cpuChoice)}`);
    }
    this.onTopResolved = true;
    this.pendingOnTop = null;
  }

  private planCpuAction(state: GameState, playerId: string) {
    if (state.tenRulePending) {
      const chooser = state.players[state.currentPlayerIndex];
      if (chooser?.id === playerId) {
        return { kind: "tenRule" as const };
      }
      return null;
    }

    const idx = state.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return null;
    const runOnTop =
      !!state.runOnTop?.active && state.runOnTop.playerIndex === idx;

    const cards = findCPUPlay(
      state.players[idx].hand,
      state.pile,
      resolveEffectiveTenRule(state),
      state.pileHistory,
      state.fourOfAKindChallenge,
      state.currentTrick,
      state.players,
      state.finishedOrder,
      state.trickHistory,
      state.lastRoundOrder,
      playerId,
      runOnTop,
    );

    if (cards?.length) {
      const opts: PlayCardsOptions | undefined = wouldActivateTenRule(state, playerId, cards)
        ? { tenRuleDirection: this.nextTenDirection() }
        : undefined;
      const next = playCards(state, playerId, cards, opts);
      if (next !== state) return { kind: "play" as const, next, cards, opts };
    }

    const afterPass = passTurn(state, playerId);
    if (afterPass !== state) return { kind: "pass" as const, next: afterPass };

    const afterCpu = applyCpuTurn(state, playerId);
    if (afterCpu !== state) return { kind: "cpu" as const, next: afterCpu };

    return null;
  }

  logGameHeader() {
    this.log("=".repeat(72));
    this.log(`GAME TRACE — seed ${this.seed}`);
    this.log(`Players: P1, P2, P3, P4 | Rounds: ${ROUNDS_PER_GAME}`);
    this.log("=".repeat(72));
    this.log("");
  }

  logRoundHeader(state: GameState) {
    this.log("-".repeat(72));
    this.log(`ROUND ${this.round}`);
    if (state.freshRound) this.log("FRESH ROUND (no president trade)");
    this.log(`Opening player: ${playerLabel(state, state.currentPlayerIndex)}`);
    this.log(`3♣ holder: ${findThreeClubOwner(state.players)}`);
    this.log(`Rank-3 cards: ${allRankThreeOwners(state.players).join(" | ")}`);
    this.log("-".repeat(72));
    this.log("");
  }

  logRoleTrades(
    trades: ClientPendingTrade[],
    players: Player[],
    openingIdx: number,
    state: GameState,
  ) {
    this.log("");
    this.log("ROLE TRADE");
    for (const t of trades) {
      if (t.key === "president") {
        this.log(`President received: ${formatCards(t.incoming)} (from ${playerLabelById(state, t.loserId)})`);
        if (t.returnedCards?.length) {
          this.log(`Asshole returned: ${formatCards(t.returnedCards)}`);
        } else if (t.completed) {
          this.log("Asshole returned: (completed — see hands)");
        } else {
          this.log("Asshole returned: (pending)");
        }
      }
      if (t.key === "vicePresident") {
        this.log(`Vice President received: ${formatCards(t.incoming)} (from ${playerLabelById(state, t.loserId)})`);
        if (t.returnedCards?.length) {
          this.log(`Vice Asshole returned: ${formatCards(t.returnedCards)}`);
        }
      }
    }
    if (trades.length === 0) this.log("(no trades this round)");
    this.log(`Opening player after trade: ${playerLabel(state, openingIdx)}`);
    this.log(`Who owns 3♣: ${findThreeClubOwner(players)}`);
    this.log(`Who owns all rank-3 cards: ${allRankThreeOwners(players).join(" | ")}`);

    const opener = players[openingIdx];
    const holdsThreeClub = opener?.hand.some((c) => c.suit === "clubs" && c.value === 3);
    const anyThreeClub = players.some((p) => p.hand.some((c) => c.suit === "clubs" && c.value === 3));
    if (anyThreeClub && !holdsThreeClub) {
      this.warn("trade", "Post-trade opener mismatch — opening player does not own 3♣");
    }
    this.log("");
  }

  logRoundSummary(state: GameState, finishedOrder: string[]) {
    this.log("");
    this.log(`ROUND ${this.round} SUMMARY`);
    this.log("Rankings (finish order):");
    finishedOrder.forEach((id, i) => {
      const p = state.players.find((x) => x.id === id);
      this.log(`  ${i + 1}. ${playerLabelById(state, id)} (${p?.role ?? "?"})`);
    });
    this.log("Role assignments:");
    for (const p of state.players) {
      if (!isDeadHandPlayer(p)) {
        this.log(`  ${playerLabelById(state, p.id)}: ${p.role}`);
      }
    }
    this.log("");
  }

  simulateRound(initialState: GameState): GameState {
    let state = initialState;
    this.prevInRun = false;
    this.prevRunSeq = [];
    this.prevTenActive = !!state.tenRule?.active;
    this.prevTenDirection = state.tenRule?.direction ?? null;
    this.logRoundHeader(state);

    let steps = 0;
    const finishedBefore = new Set(state.finishedOrder);

    while (!(isRoundCompleteForLiving(state) && !state.tenRulePending) && steps < MAX_STEPS_PER_ROUND) {
      steps++;
      const pre = preprocessTurn(state);
      state = pre.state;
      if (pre.kind !== "ready" && pre.kind !== "round-complete") {
        if (pre.kind === "idle-empty") {
          this.warn("turnOwnership", `Idle-empty preprocess at step ${steps}`);
          break;
        }
        if (isRoundCompleteForLiving(state) && !state.tenRulePending) break;
        continue;
      }
      if (isRoundCompleteForLiving(state) && !state.tenRulePending) break;

      const cur = state.players[state.currentPlayerIndex];
      if (!cur || !isPlayerStillIn(state, cur.id)) {
        this.warn("turnOwnership", `Turn on inactive player index ${state.currentPlayerIndex}`);
        break;
      }

      const trickHistLen = state.trickHistory?.length ?? 0;
      const hadRunOnTop = !!state.runOnTop?.active;
      const runOnTopOwner = state.runOnTop?.playerIndex;

      this.turn++;
      this.log(`TURN ${this.turn}`);

      const actorIdx = state.currentPlayerIndex;
      const actorLabel = playerLabel(state, actorIdx);

      const planned = this.planCpuAction(state, cur.id);
      if (!planned) {
        this.warn("other", `Stuck — no legal action for ${actorLabel}`);
        break;
      }

      if (planned.kind === "tenRule") {
        const dir = this.nextTenDirection();
        this.log(`${actorLabel} chooses ten-rule direction: ${dir}`);
        state = setTenRuleDirection(state, dir);
        this.trackTenRule(state);
        continue;
      }

      const beforePassCount = state.passCount;
      const beforeFinished = state.finishedOrder.length;

      if (planned.kind === "play") {
        this.log(`${actorLabel} plays ${formatCards(planned.cards)}`);
        state = planned.next;
        this.log(`Pile: ${formatPileValues(state.pile)}`);
        if (containsTen(planned.cards) && wouldActivateTenRule(state, cur.id, planned.cards)) {
          this.trackTenRule(state, planned.cards);
        } else {
          this.trackTenRule(state);
        }
        this.resolvePendingOnTop(state, actorIdx, "play", planned.cards);
      } else {
        this.log(`${actorLabel} passes`);
        this.resolvePendingOnTop(state, actorIdx, "pass");
        state = planned.next;
        this.trackTenRule(state);
      }

      this.trackRunState(state);

      if (state.finishedOrder.length > beforeFinished) {
        for (const id of state.finishedOrder) {
          if (!finishedBefore.has(id)) {
            finishedBefore.add(id);
            this.eliminations++;
            this.log(`${playerLabelById(state, id)} ELIMINATED (hand empty)`);
          }
        }
      }

      const runOnTopNow = !!state.runOnTop?.active;
      if (runOnTopNow && !hadRunOnTop) {
        this.auditOnTopGrant(state);
      }

      if (
        this.pendingOnTop &&
        !this.onTopResolved &&
        this.turn - this.pendingOnTop.turn > 3
      ) {
        this.warn("onTop", "On Top granted but owner never acted");
      }

      const trickHistLenAfter = state.trickHistory?.length ?? 0;
      if (trickHistLenAfter > trickHistLen) {
        this.trickCount++;
        const lastTrick = state.trickHistory![state.trickHistory!.length - 1];
        const winnerIdx = state.players.findIndex((p) => p.id === lastTrick.winnerId);
        this.log("");
        this.log("TRICK COMPLETE");
        this.log(`Winner: ${playerLabel(state, winnerIdx >= 0 ? winnerIdx : 0)}`);
        if (lastTrick.runLength) this.log(`Run cards in trick: ${lastTrick.runLength}`);
        this.log("");

        if (this.pendingOnTop && !this.onTopResolved) {
          this.warn("onTop", "On Top granted but trick finalized immediately");
        }
        if (hadRunOnTop && runOnTopOwner != null && !state.runOnTop?.active) {
          // cleared without owner action logged
        }
      }

      if (
        hadRunOnTop &&
        !state.runOnTop?.active &&
        runOnTopOwner === state.currentPlayerIndex &&
        this.pendingOnTop &&
        !this.onTopResolved
      ) {
        this.warn("onTop", "On Top state disappeared before owner action");
      }

      const eff = resolveEffectiveTenRule(state);
      const eligible = isOnTopEligiblePile(
        state.pile,
        state.pileHistory,
        state.currentTrick,
        state.players,
        state.finishedOrder,
        eff,
      );
      if (
        eligible &&
        !state.runOnTop?.active &&
        beforePassCount > 0 &&
        state.passCount === 0 &&
        state.pile.length > 0
      ) {
        // pile cleared — skip
      }
    }

    if (steps >= MAX_STEPS_PER_ROUND) {
      this.warn("other", `Round hit MAX_STEPS (${MAX_STEPS_PER_ROUND})`);
    }

    return state;
  }

  transitionToNextRound(state: GameState, dealSeed: number): GameState {
    const finishedOrder = [...state.finishedOrder];
    const deal = executeCeremonyDeal(state, finishedOrder, { dealSeed });

    let trades = [...deal.trades];
    autoCompleteCpuWinnerTrades(deal.players, trades);
    for (const t of trades) {
      if (!t.completed) {
        const winner = deal.players.find((p) => p.id === t.winnerId);
        if (winner) {
          completeWinnerReturn(deal.players, t, pickLowestCards(winner.hand, t.returnCount));
        }
      }
    }

    this.logRoleTrades(trades, deal.players, deal.openingPlayerIndex, state);

    const next = buildFreshRoundState(state, deal.players, deal.dealerContext, deal.openingPlayerIndex);
    next.consecutiveAssholeId = deal.streakAfterRound.consecutiveAssholeId;
    next.consecutiveAssholeCount = deal.streakAfterRound.consecutiveAssholeCount;
    next.freshRound = deal.streakAfterRound.freshRound;

    return next;
  }

  logGameSummary() {
    this.log("");
    this.log("=".repeat(72));
    this.log("GAME SUMMARY");
    this.log(`Total turns: ${this.turn}`);
    this.log(`Total tricks: ${this.trickCount}`);
    this.log(`Total runs activated: ${this.runsActivated}`);
    this.log(`Total On Top grants: ${this.onTopGrants}`);
    this.log(`Total ten-rule activations: ${this.tenRuleActivations}`);
    this.log(`Total eliminations: ${this.eliminations}`);
    this.log(`Total warnings: ${this.warnings.length}`);
    this.log("");
    if (this.warnings.length) {
      this.log("Warnings:");
      for (const w of this.warnings) {
        this.log(`  [${w.category}] turn ${w.turn ?? "?"} round ${w.round ?? "?"}: ${w.message}`);
      }
    } else {
      this.log("No warnings.");
    }
    this.log("=".repeat(72));
  }

  writeToFile(outPath: string) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, this.lines.join("\n") + "\n", "utf8");
  }
}

export function simulateFullGame(seed: number): GameTracer {
  const tracer = new GameTracer(seed);
  tracer.logGameHeader();

  const names = ["CPU1", "CPU2", "CPU3", "CPU4"];
  let state = createGameSeeded(names, seed);

  for (let r = 1; r <= ROUNDS_PER_GAME; r++) {
    tracer.round = r;
    state = tracer.simulateRound(state);
    tracer.logRoundSummary(state, state.finishedOrder);

    if (r < ROUNDS_PER_GAME) {
      const dealSeed = seed * 100 + r + 1;
      state = tracer.transitionToNextRound(state, dealSeed);
    }
  }

  tracer.logGameSummary();
  return tracer;
}

export function writeAnomalySummary(tracers: GameTracer[], outPath: string) {
  const all = tracers.flatMap((t) =>
    t.warnings.map((w) => ({ ...w, seed: t.seed })),
  );
  const byCategory = (cat: WarningRecord["category"]) =>
    all.filter((w) => w.category === cat);

  const lines: string[] = [];
  lines.push("GAME TRACE ANOMALY SUMMARY");
  lines.push("=".repeat(72));
  lines.push(`Total games analyzed: ${tracers.length}`);
  lines.push(`Total runs activated: ${tracers.reduce((s, t) => s + t.runsActivated, 0)}`);
  lines.push(`Total On Top grants: ${tracers.reduce((s, t) => s + t.onTopGrants, 0)}`);
  lines.push(`Total ten-rule activations: ${tracers.reduce((s, t) => s + t.tenRuleActivations, 0)}`);
  lines.push(`Total warnings: ${all.length}`);
  lines.push("");

  const sections: { title: string; cat: WarningRecord["category"] }[] = [
    { title: "Run warnings", cat: "run" },
    { title: "On Top warnings", cat: "onTop" },
    { title: "Ten-rule warnings", cat: "tenRule" },
    { title: "Trade warnings", cat: "trade" },
    { title: "Turn ownership warnings", cat: "turnOwnership" },
    { title: "Other anomalies", cat: "other" },
  ];

  for (const { title, cat } of sections) {
    const items = byCategory(cat);
    lines.push(`${title}: ${items.length}`);
    for (const w of items) {
      lines.push(`  seed ${w.seed} R${w.round ?? "?"} T${w.turn ?? "?"}: ${w.message}`);
    }
    lines.push("");
  }

  const notable = all.slice(0, 30);
  if (notable.length) {
    lines.push("Notable anomalies (first 30):");
    for (const w of notable) {
      lines.push(`  • [${w.category}] game-${w.seed} R${w.round} T${w.turn}: ${w.message}`);
    }
  } else {
    lines.push("No anomalies detected across traced games.");
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}
