# Release gate — gameplay verification

Blocks deployment when **gameplay progression** is broken. Ignores cosmetics, layout, screenshots, and styling.

**Automated entry point:** `npm run test-release-gate`  
**Fast offline slice:** `npm run test-release-gate:offline`  
**CI recommendation:** run full gate before `build:web` deploy (see [CI wiring](#ci-wiring)).

---

## 1. Proposed test structure

```text
scripts/
  test-release-gate.mjs          # orchestrator — exit 1 on any failure
  release-gate/
    private-room-reconnect-gate.mjs   # minimum private-room + mid-turn reconnect
    lib/
      server.mjs                 # health probe + optional spawn
      turnOwnership.mjs          # shared assertions on gameState
    playwright/                  # optional UI layer (Playwright not required for gate)
      quick-game.spec.mjs        # smoke: start Quick Game → one human action
      README.md                  # install + when to run

Existing (reused by orchestrator):
  test-core.ts                   # rules, trades, turn ownership (unit)
  release-gate/offline-round-sim.mjs  # offline full-round CPU simulation (gate)
  automated-tests.js             # legacy batch sim (not in gate — stale AI override)
  test-table-roster.mjs          # dead-hand / spectator roster (unit)
  test-cpu-stall-botopn.mjs      # BOTOPN pass-on-run stall (headless + live)
  test-bot-table-lifecycle.mjs   # BOTOPN solo cycle, mid-round spectator, seated play
  test-multiplayer-matrix.mjs    # private 2h, 2hs spectator, bot table (env ONLY=)
  test-reconnect-round-complete.mjs # reconnect during ROUND_COMPLETE / rankings
```

### Layering

| Layer | Tool | What it proves |
|-------|------|----------------|
| **L0 — Rules** | `test-core`, `test-table-roster` | Turn math, pass-lock, trades sync, dead-hand roster |
| **L1 — Offline sim** | `automated-tests.js` | Full rounds complete without infinite loops (Quick Game engine) |
| **L2 — Socket integration** | `test-*-matrix`, `test-bot-*`, `test-reconnect-*`, `release-gate/*` | Server sync, multiplayer phases, reconnect, BOTOPN |
| **L3 — UI smoke (optional)** | Playwright `release-gate/playwright/*` | MockAdapter Quick Game boots and accepts input |

L0–L2 are **required** for release. L3 is recommended when changing `GameScreen`, adapters, or navigation.

---

## 2. Minimum automated release gate (maps to orchestrator)

| Gate ID | Scenario | Script | Env / notes |
|---------|----------|--------|-------------|
| `core` | Rules + trades + turn ownership (unit) | `npm run test-core` | no server |
| `roster` | Dead-hand / spectator promotion (unit) | `node scripts/test-table-roster.mjs` | no server |
| `offline-sim` | Quick Game engine — full rounds | `node scripts/release-gate/offline-round-sim.mjs` | no server |
| `turn-headless` | Pass-on-run / inactive-seat advance | `node scripts/test-cpu-stall-botopn.mjs --headless` | no server |
| `quick-private-2h` | Private 2-player, 2 rounds, trades, ready | `ONLY=2h ROUNDS=2` → matrix | server |
| `spectator-promote` | Spectator → seated after ready | `ONLY=2hs ROUNDS=1` → matrix | server |
| `reconnect-rankings` | Reconnect during rankings / ready map | `test-reconnect-round-complete.mjs` | server |
| `private-reconnect` | Mid-turn disconnect + finish round + next deal | `release-gate/private-room-reconnect-gate.mjs` | server |
| `botopn-lifecycle` | BOTOPN solo cycle, mid-round spectator, human play | `test-bot-table-lifecycle.mjs` | server |
| `botopn-stall-live` | Human pass on run → CPU acts | `test-cpu-stall-botopn.mjs` | server; skip with `SKIP_LIVE=1` |

---

## 3. Scenario checklist (manual + automated)

For each scenario: **preconditions**, **steps**, **expected**, **failure conditions**, and **automation status**.

### 1. Quick Game (offline / local)

| | |
|--|--|
| **Preconditions** | App loads; no network required; default ruleset. |
| **Steps** | Home → Quick Game → start with CPU fill → play/pass through one round → view rankings → ready/next → complete role trades → play second round to completion. |
| **Expected** | Round ends with correct finish order; rankings overlay; trades resolve; second deal opens with correct opener (3♣ / role rules); second round completes. |
| **Failure** | Stuck turn; round never ends; rankings skipped; trades hang; second round never deals; turn on out/dead player. |
| **Automation** | **Partial:** `test-core` (trades/opener), `automated-tests.js` (single-round sim). **Gap:** full 2-round MockAdapter/UI path — Playwright optional. |

### 2. BOTOPN / Quick Online

| | |
|--|--|
| **Preconditions** | Server up; `BOTOPN` room active with CPU seats. |
| **Steps** | Join table → play at least one card → pass when legal → round completes → join as spectator mid-game or after round → ready → claim dead-hand seat → next round starts. |
| **Expected** | Actions apply; pass advances; CPUs continue after human pass on run; spectator sees live state; promotion after ready; bots/humans receive correct turns. |
| **Failure** | CPU stall after pass; spectator seated mid-trick incorrectly; ready ignored; next deal missing. |
| **Automation** | **Strong:** `test-bot-table-lifecycle.mjs`, `test-cpu-stall-botopn.mjs`, matrix `ONLY=bot`. |

### 3. Private multiplayer room

| | |
|--|--|
| **Preconditions** | Server up; two distinct clients (sockets or devices). |
| **Steps** | Host creates private room → guest joins → both ready → start → play round → (optional) reconnect one player → complete round → both ready → next round. |
| **Expected** | Same `dealSeed` on start; dead hand at 2 players; gameplay matches rules; reconnect restores seat; `roundEnded` then `nextRoundStarting`. |
| **Failure** | Guest not in room; desynced hands; reconnect creates duplicate seat; ready gate stuck. |
| **Automation** | **Strong:** matrix `ONLY=2h`; **new:** `private-room-reconnect-gate.mjs`. |

### 4. Spectator flow

| | |
|--|--|
| **Preconditions** | Game in progress or between rounds. |
| **Steps** | Join full/bot table as extra client → confirm spectator flag → observe play → ready between rounds → promote to dead-hand seat. |
| **Expected** | `isSpectator` true while game running; receives sync; cannot act until seated; promotion after ready when seat available. |
| **Failure** | Seated mid-trick without promotion rules; no sync; promotion fails; spectator receives turn. |
| **Automation** | **Partial:** `test-bot-table-lifecycle` (mid-round join), matrix `ONLY=2hs`. **Gap:** spectator ready during `betweenRounds` only (dedicated regression). |

### 5. Reconnect flow

| | |
|--|--|
| **Preconditions** | Seated player in private or BOTOPN room. |
| **Steps** | Disconnect during PLAYING → reconnect same `profileId` → continue play; repeat during ROUND_COMPLETE / trades. |
| **Expected** | Same seat; state replay; no duplicate players; turn skips disconnected seat until back. |
| **Failure** | Turn assigned to disconnected socket; duplicate profile; rankings/trade state lost. |
| **Automation** | **Partial:** `test-reconnect-round-complete.mjs` (rankings phase), `private-room-reconnect-gate.mjs` (mid-turn). **Gap:** reconnect during pending trades only (QA league only today). |

### 6. Round transitions

| | |
|--|--|
| **Preconditions** | Any mode with multiple rounds enabled. |
| **Steps** | Finish last living hand → last trick resolves → rankings → ready map → deal ceremony → trades → PLAYING. |
| **Expected** | `roundEnded` with `finishOrder`; clients show rankings phase; ready required where configured; `nextRoundStarting` fires; new hands dealt. |
| **Failure** | Rankings before last trick; ready ignored; deal without trades; phase stuck in `ROUND_COMPLETE`. |
| **Automation** | **Strong:** matrix `playRounds`, `test-bot-table-lifecycle` solo cycle, `test-reconnect-round-complete` (ordering). |

### 7. Role trades

| | |
|--|--|
| **Preconditions** | Round ended with ≥2 living finishers; president/asshole roles assigned. |
| **Steps** | Winners select return cards → trades complete → opener resolved. |
| **Expected** | `pendingTrades` clears; hands updated; opener follows 3♣ / asshole / president rules. |
| **Failure** | Trade hang; wrong card counts; opener wrong seat. |
| **Automation** | **Strong:** `test-core` (roundPrep), matrix `resolvePendingTrades`, multiplayer-rounds. |

### 8. End-of-round handling

| | |
|--|--|
| **Preconditions** | One living player remains or all out. |
| **Steps** | Final play/pass → ten-rule branch if applicable → trick history finalized → rankings. |
| **Expected** | Last hand visible before rankings; `finishedOrder` complete; no further plays accepted. |
| **Failure** | Rankings overlay early; extra turn after round complete; ten-rule stuck. |
| **Automation** | **Partial:** `test-core` (ten-rule, out-leader finalize), reconnect test (lastHand ordering). **Gap:** explicit last-hand-then-rankings socket event order assertion. |

### 9. Turn ownership

| | |
|--|--|
| **Preconditions** | Mixed out/pass/disconnect/dead-hand seats. |
| **Steps** | Observe `currentPlayerIndex` through passes, runs, disconnects, promotions. |
| **Expected** | Turn only on living, connected, in-trick players; passed players skipped until trick resets; out players never act. |
| **Failure** | Out player prompted; disconnected player current; passed player leads incorrectly. |
| **Automation** | **Strong:** `test-core` (`isPlayerStillIn`, pass-lock, repair), `test-cpu-stall-botopn.mjs`; **live:** turn checks in `release-gate/lib/turnOwnership.mjs` during socket tests. |

### 10. Dead hand replacement

| | |
|--|--|
| **Preconditions** | 2-player private or BOTOPN with dead-hand seat. |
| **Steps** | Play with dead hand → spectator/human ready → promote into `__dead_hand__` → receive turn and play. |
| **Expected** | Dead hand acts via CPU when empty; human replaces seat; turn advances correctly after replacement. |
| **Failure** | Dead hand never acts; promotion does not replace seat; double occupancy. |
| **Automation** | **Strong:** `test-table-roster.mjs`, matrix `2h`/`bot`, `test-bot-table-lifecycle` human seat test. |

---

## 4. Existing scripts — reuse map

| Script | Covers |
|--------|--------|
| `npm run test-core` | Pass-lock, out-leader trick finalize, joker/pass turn, `repairStuckTurnPointer`, trades/opener (`buildFreshRoundState`), dead-hand opening, CPU opener combos |
| `npm run test-cpu-stall` | BOTOPN human pass on run → CPU must act (live + `--headless`) |
| `node scripts/automated-tests.js` | Offline Quick Game engine — N seeded full rounds (3–8 players) |
| `node scripts/test-table-roster.mjs` | Spectator promotion, sync betweenRounds guards (unit) |
| `node scripts/test-multiplayer.mjs` | Minimal 3-player smoke (one play) — **not** in release gate |
| `node scripts/test-multiplayer-rounds.mjs` | 3 humans × 5 rounds — long; use for deep regression, not every release |
| `node scripts/test-multiplayer-matrix.mjs` | **Primary multiplayer gate:** `2h`, `2hs`, `bot`, 3–8 players |
| `node scripts/test-bot-table-lifecycle.mjs` | BOTOPN auto next round, mid-round spectator, human play + bot continuation |
| `node scripts/test-reconnect-round-complete.mjs` | Reconnect during rankings; last-hand replay |
| `node scripts/test-two-human-dead-hand.mjs` | Thin wrapper: `ONLY=2h` matrix |
| `npm run qa-league` / `qa-chaos` | Exploratory stress — **not** a release blocker (nondeterministic, long) |

---

## 5. Gaps (currently untested or weak)

| Gap | Risk | Mitigation |
|-----|------|------------|
| Quick Game **UI** 2-round E2E (MockAdapter) | Navigation/adapter regressions | Playwright `release-gate/playwright/quick-game.spec.mjs` |
| Reconnect **during pending trades** | Trade state loss | Add socket test or promote QA `reconnect_during_trades` to gate |
| Reconnect **mid-turn** in BOTOPN | Turn stall | Extend `private-room-reconnect-gate` pattern to `BOT_ROOM_CODE` |
| **lastHand → roundEnded** strict event order | Rankings flash early | Assert event sequence in reconnect or new gate script |
| Spectator ready only in **betweenRounds** | Mid-trick promotion bug | Dedicated matrix case with phase guard |
| **8-player** private rooms | Perf / turn sweep edge | Matrix with `SKIP_SLOW=0` on weekly cadence only |
| **CI deploy workflow** | Broken gameplay ships | Add `test-release-gate` job before build (see below) |
| Turn ownership on **live disconnect** | Ghost turns | `private-room-reconnect-gate` asserts; expand with explicit disconnect-during-turn |

---

## 6. Recommended npm commands

```bash
# Unit + offline — no server (≈30–90s)
npm run test-core
npm run test-cpu-stall -- --headless    # or: node scripts/test-cpu-stall-botopn.mjs --headless

# Full release gate — starts server if needed (≈3–8 min)
npm run test-release-gate

# Offline-only slice (CI fast path / pre-push)
npm run test-release-gate:offline

# Targeted debugging
npm run server                            # terminal 1
ONLY=2h ROUNDS=2 node scripts/test-multiplayer-matrix.mjs
node scripts/test-bot-table-lifecycle.mjs
node scripts/test-reconnect-round-complete.mjs
node scripts/release-gate/private-room-reconnect-gate.mjs

# Deep regression (not every release)
ROUNDS=5 node scripts/test-multiplayer-rounds.mjs
SKIP_SLOW=0 node scripts/test-multiplayer-matrix.mjs
```

### Environment variables

| Variable | Effect |
|----------|--------|
| `SERVER_URL` | Default `http://localhost:4000` |
| `RELEASE_GATE_SPAWN_SERVER=1` | Orchestrator spawns `npm run server` if port closed |
| `SKIP_LIVE=1` | Skip live BOTOPN stall test (headless still runs) |
| `SKIP_BOTOPN=1` or `RC_SCOPE=1` | Skip `botopn-lifecycle` (D-010 RC waiver) |
| `SKIP_OFFLINE=1` | Socket tests only |
| `ONLY` / `ROUNDS` | Passed through to matrix when run manually |

---

## 7. CI wiring

Add a job before deploy:

```yaml
- name: Release gameplay gate
  run: |
    RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate
```

Fail the workflow on non-zero exit. Do **not** substitute `qa-league` — it is intentionally nondeterministic.

---

## 8. Playwright (optional L3)

Playwright is **not** a devDependency today. When added:

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test scripts/release-gate/playwright/
```

Practical Playwright scope (gameplay only):

- Quick Game: start → assert phase `PLAYING` → one legal play via data-testid hooks.
- **Do not** screenshot diff or assert card positions.

Socket integration tests remain the primary gate; Playwright catches adapter/navigation breaks unit tests miss.

---

## 9. Human release checklist (5 min)

Use when automation is green but you want a final smoke on a staging build:

1. [ ] Quick Game: one full round + rankings + next deal  
2. [ ] BOTOPN: join, play, pass, round ends  
3. [ ] Private: 2 devices, one round, reconnect one player  
4. [ ] Spectator: watch BOTOPN, ready, get seat  
5. [ ] Confirm no turn prompt while out or disconnected  

If any box fails → **do not deploy**; file against gameplay gate ID from section 2.
