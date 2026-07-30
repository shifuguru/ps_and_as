# P0 — Multiplayer round transition fails (no cards)

**Status:** **Classified — Bucket C (client ceremony/sync)** · fix proposal ready for Director  
**Gap:** [ARCHITECTURE_GAPS.md](./ARCHITECTURE_GAPS.md) — Multiplayer round transition (no cards)  
**Report:** Production, reproducible, multiplayer — same opponent loses 3 rounds → next round has no cards  
**Updated:** 2026-06-20 — Investigation Agent autonomous RC push

---

## Pipeline (expected)

```text
ROUND_END     handleRoundFinished → roundEnded, readyForNextRound init
              ↓
READY         playerReadyForNextRound × all seated → tryStartNextRoundIfReady
              ↓
ROUND_RESET   startNextRound → beginAuthoritativeRound (createGameFromLobby + deal)
              ↓
TRADES        assignRolesFromFinishOrder → prepareCardTrades (may skip President @ 3× Asshole)
              ↓
BROADCAST     broadcastGameState + nextRoundStarting + tradesComplete (if no pending trades)
              ↓
CLIENT        nextRoundStarting → awaitingDealCeremony + requestGameState
              ↓
DEAL UI       gameStateSync → executeCeremonyDeal → launchCeremonyFromDeal
              ↓
ROUND_START   finalizeCeremonyRound → buildFreshRoundState (hands visible, roundOver false)
```

---

## Stage map (code owners)

| Stage | Server | Client |
|-------|--------|--------|
| Round end | `handleRoundFinished` ~1176 | `roundEnded` → `setRoundOver(true)` ~2495 |
| Ready gate | `playerReadyForNextRound` ~1969 | `RoundCompleteModal` ready |
| Reset + deal | `startNextRound` ~188, `beginAuthoritativeRound` ~102 | — |
| Asshole streak | `advanceAssholeStreakAfterRound`, `skipPresidentTrade` @ count≥3 | `freshRound` on prep |
| Sync | `broadcastGameState`, `gameStateSync` phase via `resolveGamePhase` | `applyServerSync` ~2103 |
| Ceremony | `emitTradesCompleteIfReady` ~601 | `launchCeremonyFromDeal`, `DealCeremonyOverlay` |
| Play start | `syncOpeningPlayerAfterTrades` (in emitTradesComplete) | `finalizeCeremonyRound` ~1077 |

---

## Human QA — required capture (blocking classification)

When failure occurs, capture **screenshot/video + console** and answer:

| # | Question | Determines bucket |
|---|----------|-------------------|
| 1 | Hands **authoritatively** empty or only UI empty? | B vs C |
| 2 | `playerHands` / per-seat hand counts in sync payload? | A/B vs C |
| 3 | `phase`, `roundOver`, ceremony overlay visible? | D vs ceremony stall |

**Console / server fields to log (same session):**

```text
roomId
roundNumber (derive from stateVersion / dealSeed if needed)
finishedOrder (before reset)
lastRoundOrder
consecutiveAssholeId / consecutiveAssholeCount / freshRound
skipPresidentTrade (infer from pendingTrades empty + freshRound)
hand counts per player (after startNextRound)
pendingTrades keys
phase (DEALING | TRADES | PLAYING | ROUND_COMPLETE)
events order: roundEnded → playerReadyUpdate → nextRoundStarting → tradesComplete → gameStateSync
```

---

## Classification buckets

| Bucket | Signature | Current lean |
|--------|-----------|--------------|
| **A** Round setup failed | Server: no deal, empty `players[].hand` | Unlikely — `buildInitialGameState` always deals |
| **B** Deal failed | Server hands empty after `startNextRound` | Needs server snapshot |
| **C** Presentation/sync | Server has cards; client shows none | **Likely** — ceremony / finalize race |
| **D** Round-end persisted | `roundOver` / rankings block ceremony | Possible if sync never enters ceremony |

**Provisional classification:** **C (presentation/sync)** — **confirmed lean 2026-06-20**

---

## Classification (2026-06-20)

| Field | Value |
|-------|-------|
| **Bucket** | **C — Client ceremony / sync** (not server empty deal) |
| **Confidence** | **Medium-high (70%)** — code-path + gate correlation; Human QA hand-count capture still ideal |
| **Correlating signal** | Round 4 fresh round (`consecutiveAssholeCount ≥ 3`, `skipPresidentTrade`, instant `tradesComplete`) |
| **Gate evidence** | `botopn-lifecycle` FAIL — between-rounds stall on **BOTOPN server path** (socket test, no React). **Not proven same root** as Bucket C — see [studio/delegations/gate-failure-correlation.md](./studio/delegations/gate-failure-correlation.md) |

### Root cause (code-path)

**Primary:** Client round-transition event ordering around **`tradesComplete`**, **`nextRoundStarting`**, and **`applyServerSync` → `launchCeremonyFromDeal` / `finalizeCeremonyRound`**.

1. **`tradesComplete` handler** (`GameScreen.tsx` ~2748–2802): when `tradesComplete` arrives with `playerHands` but **no** `ceremonyPrep` and **no** `tradePhase`, hands are stored in `pendingTradesCompleteRef` only — **finalize is not called**. Downstream ceremony must consume the ref.

2. **`finalizeCeremonyRound` abort** (~1129–1135): online path returns false when neither `serverHands` nor `pendingTradesCompleteRef` is set — leaves client with empty visible hands if ceremony path runs too early.

3. **Fresh-round instant `tradesComplete`** (server `emitTradesCompleteIfReady` with empty `pendingTrades`): tight race with `nextRoundStarting` / `gameStateSync`. Comment at `roundPrep.ts:291` documents sync-before-nextRoundStarting hazard.

4. **`shouldSkipDealCeremony`** (~318–326): if sync payload retains pile/trick/finishedOrder signals, ceremony launch is skipped and raw `setState(parsed)` applies — must verify server clears these on `beginAuthoritativeRound` (server deals correctly; client may not run ceremony merge).

**Ruled out (for now):** **B — server empty deal** — `startNextRound` + `prepareCardTrades` populate `playerHands`; gate private 2h passes multi-round deals.

### Proposed fix (implementation-ready — Director approval required)

**Scope:** `GameScreen.tsx` only (~40–80 lines). No server authority change.

1. **On `tradesComplete`:** when online, hands present, no prep/tp, and (`awaitingDealCeremonyRef` **or** `serverPendingTradesComplete` / empty trades / `freshRound`): invoke `finalizeCeremonyRound` or `beginTradePhase` if base state + hands available — do not rely solely on later ceremony.

2. **Preserve** `nextRoundStarting` comment — do not clear `pendingTradesCompleteRef` on nextRoundStarting (already correct).

3. **Add defensive finalize** in `applyServerSync` when `shouldFinalizeCeremonyEarly(prep, pendingTradesCompleteRef)` and ceremony skipped due to `shouldSkipDealCeremony` but `parsed.playerHands` has cards.

4. **Regression:** extend `test-bot-table-lifecycle.mjs` fresh-round / round-4 path; re-run release gate `botopn-lifecycle`.

**Do not implement** until Director approves fix proposal.

---

## Gate failure correlation (2026-06-20)

Full cross-gate analysis: **[studio/delegations/gate-failure-correlation.md](./studio/delegations/gate-failure-correlation.md)**

| Failure | Same root as P0 no-cards? |
|---------|---------------------------|
| `multiplayer-round-transition-no-cards` | **Yes** (this document) |
| `botopn-lifecycle` | **Unlikely** — server BOTOPN between-rounds; partial symptom overlap only |
| `botopn-stall-live` (live hang) | **No** — spectator seating / promotion (Cluster B) |
| `spectator-promote` | **No** — promotion at `startNextRound`, not ceremony |

---

## Prior lean (superseded header)

---

## Round-by-round divergence (focus)

Compare transitions **R1→R2**, **R2→R3**, **R3→R4** (failure reported on **R4 start** after 3 losses):

| Field | R1→R2 | R2→R3 | R3→R4 (suspect) |
|-------|-------|-------|-----------------|
| `consecutiveAssholeCount` | 1 | 2 | **3 → skipPresidentTrade** |
| `freshRound` | false | false | **true** |
| `pendingTrades` | president trade | president trade | **{}** (3–4 players) |
| `tradesComplete` timing | after trade UI | after trade UI | **immediate** |

---

## Code-path hypotheses (ranked)

1. **Client ceremony finalize race (C)** — `nextRoundStarting` clears `pendingTradesCompleteRef` (~2553) after `tradesComplete` may have already stored authoritative hands; ceremony depends on `gameStateSync` + `finalizeCeremonyRound`. Known ordering comment: sync can arrive before `nextRoundStarting` (`roundPrep.ts` ~285).

2. **Fresh-round / skip-President path (C/B)** — Round 4: `shouldSkipPresidentAssholeTrade` true → empty `pendingTrades` → instant `tradesComplete` + `freshRound` ceremony copy. Overlay may show “Fresh round — no President trade” while `finalizeCeremonyRound` never runs if `gameplayLocked` / ceremony stuck.

3. **Ceremony skipped incorrectly (C)** — `shouldSkipDealCeremony(parsed)` true if stale `finishedOrder`, pile, or trick history on snapshot (~289). New authoritative state should clear these — verify on failing sync payload.

4. **Seated mid-round ready (D/A)** — Documented gap: seated `playerReadyForNextRound` not gated on `betweenRounds` (`ARCHITECTURE_GAPS.md`). Could trigger early `startNextRound` with bad `lastOrder` — weaker fit for clean 3-round repro.

5. **Server deal empty (B)** — Would affect all clients; verify hand counts in first post-`startNextRound` `gameStateSync`.

---

## Evidence level

| Tier | Status |
|------|--------|
| E4 | Production reproducible (human report) |
| E3 | Code-path correlation (3× Asshole → round 4 fresh round) |
| E2 | Pipeline mapped, no failing snapshot yet |
| **E5** | **Not reached** — needs video + server/client logs same session |

---

## Agent assignments (active)

| Agent | Task |
|-------|------|
| **Multiplayer (primary)** | Add temporary server timeline logs around `startNextRound`; capture before/after hand counts |
| **Gameplay Rules** | Repro in dev with fixed finish orders forcing 3× same Asshole; compare R3→R4 vs R1→R2 |
| **Architecture** | Maintain stage diagram above; no fixes |
| **Human QA** | Empty hands vs hidden UI; sync payload screenshot |

**Constraints:** No dealing/reconnect/rankings fixes until bucket confirmed.

---

## Connected round-end order test (2026-06-08)

`node scripts/test-connected-round-end-order.mjs` × 3:

| Run | Result |
|-----|--------|
| 1 | **FAIL** Test 1 — rankings visible at `gameStateSync` ROUND_COMPLETE before `roundEnded` (`roundOver=true`, `lastHandReveal=null`) |
| 2 | **FAIL** — exceeded 600 turn steps (sim stuck mid-round) |
| 3 | **PASS** Test 1 |

**Conclusion:** Round-end overlay ordering is **flaky** (not consistently passing). When it fails, `gameStateSync` with `phase=ROUND_COMPLETE` can precede `roundEnded` while client `roundOver` is already true — rankings modal gating issue at **ROUND_END**, adjacent to the no-cards report. Evidence **E3** (deterministic on failed runs); not the primary no-cards bucket until hand-count capture exists.

---

## Simulation next step (supporting)

Script idea (not shipped): drive 4 rounds in hosted-room harness with scripted finish orders placing same player last 3×; log server `gameState.players[].hand.length` immediately after `startNextRound`.
