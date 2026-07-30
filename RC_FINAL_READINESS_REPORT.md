# RC Final Readiness Report — v1.0.61

**Sprint date:** 2026-06-08  
**Auditor:** Automated sprint + codebase audit (no Director Human QA this session)  
**Scope:** Deployability only — no new features, polish, architecture, Mission Control, or IPP.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Is v1.0.61 **genuinely deployable today**? | **No** |
| Recommendation | **DO NOT SHIP** |
| Confidence | **42%** deploy-ready today · **76%** after scoped commit + Director smoke (~30 min) |

**Why not today:** RC gameplay fixes live in an **uncommitted working tree**. Production remains **v1.0.60**. Director Human QA is **unsigned**. On Top and Dead Hand were **not live-verified** this sprint. Cluster A documentation **overstates** what is in `GameScreen.tsx`.

---

## Phase 1 — Live multiplayer validation

### Verification matrix

| ID | Scenario | Automated | Live multiplayer | Result |
|----|----------|-----------|------------------|--------|
| **A** | On Top — higher 10 | ✅ `test-core` direction-strip + ten-rule suites; ✅ `trace-on-top-pass-block.mjs` | ❌ Not run (OT-1 unsigned) | **Automated PASS** |
| **B** | On Top — run | ✅ `test-core` run-on-top suite (grant, beat, pass, premature finalize guards) | ❌ Not run (OT-3 unsigned) | **Automated PASS** |
| **C** | Post-trade opener (President → Asshole 3♥; middle holds 3♣) | ✅ `test-core` production repro; ✅ `test-post-trade-opener.mjs` | ✅ `live-post-trade-opener-verify.mjs` room `O805930` | **LIVE PASS** |
| **D** | Dead Hand opener (3♣ sidelined; living 3 opens) | ✅ Round-1 + post-trade dead-hand blocks in `test-core.ts` | ❌ No live 2p+dead-hand harness run | **Unit PASS only** |

### A. On Top — higher 10

| Check | Status | Evidence |
|-------|--------|----------|
| On Top appears after others pass | ✅ | `test-core`: direction recovery + `runOnTop.active` after stripped `tenRule.direction` |
| Winner can act (not blocked by pass guard) | ✅ | `trace-on-top-pass-block.mjs`: fixed `humanRunOnTopTurn` vs pre-fix blocked handlers |
| No "Not your turn" (online) | ⚠️ Code | `server/index.js`: `runOnTopTurn` bypass + index realignment — **not browser-tested** |
| Reconnect before final pass grants On Top | ✅ | Simulated via direction-strip tests (trick `tenRuleDirection` recovery) — **not live reconnect** |

### B. On Top — run

| Check | Status | Evidence |
|-------|--------|----------|
| Run completes | ✅ | `test-core` run extension tests |
| On Top appears | ✅ | `Run leader should get on top! after others pass` |
| Winner can act | ✅ | Client guards in working-tree `GameScreen.tsx` |
| Table does not finalize prematurely | ✅ | `test-core`: pile retained until on-top play/pass resolves |

### C. Post-trade opener

Documented in **`LIVE_POST_TRADE_OPENER_VERIFICATION.md`**.

| Check | Status |
|-------|--------|
| 3♣ holder starts (Guest, index 1) | ✅ |
| Asshole with 3♥ does **not** open | ✅ |
| Host / Guest / Third agree after sync | ✅ (`syncStable: true`) |

Command: `RELEASE_GATE_SPAWN_SERVER=1 LIVE_OPENER_ATTEMPTS=25 node scripts/live-post-trade-opener-verify.mjs` → exit **0**.

### D. Dead Hand opener

| Check | Status |
|-------|--------|
| Dead Hand 3♣ → living 3♠ / 3♥ post-trade rules | ✅ Unit tests (`resolveOpenerAfterRoleTrades`, 3 cases added) |
| Live 2-player + dead-hand online room | ❌ **Not executed** |

---

## Phase 2 — Ceremony regression sweep

### Transition map

| Stage | Server owner | Client owner | Stale-sync risk |
|-------|--------------|--------------|-----------------|
| **Deal** | `startNextRound` → `beginAuthoritativeRound` | `nextRoundStarting` → `launchCeremonyFromDeal` | **Medium** — `gameStateSync` before `nextRoundStarting` can reorder ceremony start (`roundPrep.ts` comment) |
| **Role trade** | `prepareCardTrades`, `playerTradeSelection` | `tradePhase` / `ceremonyPrep`, `buildTradePhaseFromServerState` | **Low** mid-trade — `shouldSyncMidTradeFromServer` + stash while `localCeremonyUi` |
| **Trades complete** | `syncOpeningPlayerAfterTrades` → `broadcastGameState` → `tradesComplete` | `tradesComplete` handler → `finalizeCeremonyRound` **if** prep/tp exists | **High** — instant `tradesComplete` with **no** prep/tp only stores `pendingTradesCompleteRef`; **`shouldFinalizeInstantTradesComplete` not in code** despite RC docs |
| **First turn** | `syncOpeningPlayerAfterTrades` / `currentPlayerIndex` | `finalizeCeremonyRound`, `reconcileSyncedOpeningPlayer` in `applyServerSync` | **Medium** — mitigated by post-trade opener fix; client reconcile guard in working tree |
| **Round complete** | `handleRoundFinished`, `roundEnded` | `setRoundOver`, last-hand reveal hooks | **Low** — reconnect gate PASS |
| **Last hand** | `roundEnded` payload | `maybeStartLastHandReveal` | **Low** — `test-connected-round-end-order.mjs` PASS |
| **Rankings** | Phase via `resolveGamePhase` | `RoundCompleteModal` | **Medium** — R-1–R-3 Director unsigned; automated reconnect PASS |
| **Ready** | `playerReadyForNextRound`, spectator promotion (Cluster B in `server/index.js`) | Ready UI | **Medium** — seated `betweenRounds` gate still open per `ARCHITECTURE_GAPS.md` |
| **Next deal** | `tryStartNextRoundIfReady` → `startNextRound` | Ceremony pipeline | **Medium** — fresh-round (3× Asshole) path highest risk |

### Can stale sync overwrite local ceremony state?

**Yes — remaining paths:**

1. **`tradesComplete` without ceremony UI** — hands stored in ref only; finalize depends on later `applyServerSync` / ceremony. Documented Cluster A fix (`shouldFinalizeInstantTradesComplete`) is **not present** in `GameScreen.tsx` (doc/code drift).
2. **`applyServerSync` during `localCeremonyUi`** — intentionally stashes server progress (lines ~2145–2164); safe if finalize eventually runs; **unsafe** if instant-complete path never finalizes.
3. **Post-ceremony play sync** — `reconcileSyncedOpeningPlayer` **corrects** stale opener when trades complete + `playerHands` + no lead taken (working tree). Reduces opener overwrite risk.
4. **Version guard** — `shouldApplyServerSnapshot` drops older `stateVersion`; reduces but does not eliminate ordering races.
5. **`nextRoundStarting` clearing refs** — can drop `pendingTradesCompleteRef` if ordering wrong (see `P0_ROUND_TRANSITION_INVESTIGATION.md`).

### Remaining risks (ranked)

| Risk | Severity | RC-blocking? |
|------|----------|--------------|
| Instant `tradesComplete` / fresh round without finalize | **High** | **Yes** (RC-M1) — mitigated in gates but Cluster A helper missing |
| Director Human QA unsigned (round transition, rankings, On Top) | **High** | **Yes** (RC exit criteria) |
| On Top live "Not your turn" | **Medium** | **Yes** for OT production repro |
| Dead Hand live post-trade | **Low** | No — unit + audit coverage strong |
| Seated ready mid-round | **Medium** | Partial — P1 gap |
| BOTOPN lifecycle | **Medium** | **No** — D-010 waived |
| Uncommitted RC bundle | **Critical** | **Yes** — nothing deploys until commit/push |

---

## Phase 3 — Version audit

Sources read **2026-06-08** (no assumptions):

| Source | Version | Build / commit | Notes |
|--------|---------|----------------|-------|
| **Production** (`https://shifuguru.github.io/ps_and_as/version.json`) | **1.0.60** | `249eabb8298333e24f53578e54f7d45dffa5c7bd` | `builtAt`: 2026-06-17T01:07:36Z · codename "Quad Squad Goals" |
| **`package.json` (HEAD + working tree)** | **1.0.60** | — | Not bumped to 1.0.61 |
| **`version.json` (repo root)** | **1.0.59** | `c82ad46…` | **Stale** vs production |
| **`web-build/version.json`** | **1.0.55** | local build | **Stale** — not production artifact |
| **What's New** (`updateLogContent.ts` top entry) | No semver in title | `2026-06-17T13:05:38` NZST | "Fresh round & online dealing" — **no v1.0.61 entry committed** |
| **Release notes** (`V1_0_61_RELEASE_BUNDLE.md`) | Target **1.0.61** | Draft | Not shipped |
| **Git HEAD** | — | `e39fdbb` — "restore: re-enable mission control route" | **Only** MC route since production `249eabb`; RC fixes **uncommitted** |

### Canonical answer

```text
Current production:  v1.0.60 @ 249eabb (GitHub Pages, built 2026-06-17)
Next release:        v1.0.61 (planned — not in package.json, not pushed)
Git commit:          None deployable yet — RC gameplay fixes are working-tree only;
                     HEAD e39fdbb is out-of-scope Mission Control route restore
Deploy target:       https://shifuguru.github.io/ps_and_as/ (main branch → Pages workflow)
```

---

## Phase 4 — BOTOPN audit (D-010)

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Is BOTOPN hidden from Find Game? | **Yes** (working tree) | `FindGame.tsx`: `publicRooms` filters `isBotHosted` + `isBotPublicRoomCode`; empty title **"No Public Games Available"** |
| 2 | Can users still join BOTOPN? | **Blocked by code** in Find Game join path | `handleJoinWithCode`: `isBotPublicRoomCode` → error "No public games available…" · Direct URL/deep link not audited |
| 3 | Are botopn gates excluded from RC evaluation? | **Yes** | `test-release-gate.mjs`: skip when `SKIP_BOTOPN=1` or `RC_SCOPE=1` · sprint run: `○ botopn-lifecycle`, `○ botopn-stall-live` |
| 4 | Is release documentation aligned? | **Mostly** | `V1_0_61_RELEASE_BUNDLE.md`, `studio/BOTOPN_RC_DEFERRAL.md`, `V1_0_61_HUMAN_QA_RESULTS.md` D-010 section · Director D10-1–D10-3 still ☐ unsigned |

**Production note:** D-010 ships only when working-tree `FindGame.tsx` / `roomCode.ts` are committed and deployed. **Live production 1.0.60 may still show BOTOPN** until that deploy lands.

---

## Phase 5 — Release recommendation

### Green (verified)

- **Release gate (RC scope):** `SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate` → **PASS** (4 passed, 2 skipped, exit 0) — sprint 2026-06-08
- **Core + On Top automated:** `npx tsx ./scripts/test-core.ts` → **PASS**
- **On Top trace:** `npx tsx ./scripts/trace-on-top-pass-block.mjs` → **PASS**
- **Post-trade opener — live:** production repro **PASS** (`LIVE_POST_TRADE_OPENER_VERIFICATION.md`)
- **Post-trade opener — unit + server ordering:** `test-core` + `test-post-trade-opener.mjs` → **PASS**
- **Dead Hand post-trade opener — unit:** 3 regression tests → **PASS**
- **Rankings reconnect proxy:** `test-reconnect-round-complete.mjs` → **PASS**
- **Round-end overlay order:** `test-connected-round-end-order.mjs` → **PASS**
- **D-010 implementation in working tree:** Find Game filter + join-by-code block → **present**
- **BOTOPN gate waiver:** documented and enforced in orchestrator

### Yellow (accepted or pending for RC)

| Item | Notes |
|------|-------|
| BOTOPN deferred post-RC | D-010 — intentional |
| On Top live multiplayer smoke | Automated + server logic only; OT-1–OT-3 Director ☐ |
| Dead Hand live online | Unit coverage only |
| Rankings R-1–R-3 Human QA | Automated proxy green; Director ☐ |
| Round transition RT-1–RT-3 Human QA | Gate proxies green; fresh-round path highest risk |
| Cluster A doc vs code | Docs cite `shouldFinalizeInstantTradesComplete`; **symbol absent** from `GameScreen.tsx` |
| `version.json` / `web-build` staleness | Non-blocking if deploy workflow rebuilds |
| Mission Control route in HEAD | Out of RC scope — exclude from v1.0.61 commit |
| Open P0/P1 architecture gaps | CPU takeover, XP persistence, seated ready gating, etc. — pre-existing |

### Red (blocking deployment)

| # | Blocker |
|---|---------|
| 1 | **RC fixes not committed** — cannot deploy working tree without commit + push |
| 2 | **Director Human QA unsigned** — round transition, rankings, On Top, D-010 UI (`V1_0_61_HUMAN_QA_RESULTS.md` all ☐) |
| 3 | **On Top not live-verified** — production bug class was online "Not your turn"; only code + headless trace |
| 4 | **Cluster A completeness unproven** — instant `tradesComplete` finalize helper documented but missing; RC-M1 risk remains |
| 5 | **package.json still 1.0.60** — no What's New v1.0.61 entry with commit timestamp |

---

### Recommendation

## **DO NOT SHIP**

**Confidence: 42%** that v1.0.61 is deployable **as of this sprint** without further steps.

**Justification:**

The working tree contains meaningful fixes (post-trade opener, On Top grant/guards, D-010, server spectator promotion) and **automated + one live gate pass** for the critical post-trade repro. That is **not sufficient for production deploy**: changes are **uncommitted**, production is still **v1.0.60**, Director signoff is **blank**, On Top and round-transition **live** paths are **unverified**, and Cluster A documentation **does not match** implemented `GameScreen.tsx` symbols.

**Path to SHIP WITH KNOWN ISSUES (~76% confidence):**

1. Commit **scoped** RC files only (see `V1_0_61_RELEASE_BUNDLE.md` + post-trade / dead-hand tests + live verify script).
2. Set `package.json` → `1.0.61`; add What's New; push to `main`.
3. Director completes **~20 min** smoke: RT-1, R-2, OT-1, D10-1.
4. Re-run `RELEASE_GATE_SPAWN_SERVER=1 SKIP_BOTOPN=1 SKIP_LIVE=1 npm run test-release-gate`.

**Not recommended:** **SHIP** (unconditional) — process and live gaps block genuine deployability today.

---

## Sprint commands executed

```bash
npx tsx ./scripts/test-core.ts                                    # PASS
npx tsx ./scripts/trace-on-top-pass-block.mjs                     # PASS
node scripts/test-post-trade-opener.mjs                           # PASS
SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate  # PASS
# Prior session: live-post-trade-opener-verify.mjs                # PASS
```

---

## Related artifacts

| Document | Purpose |
|----------|---------|
| `LIVE_POST_TRADE_OPENER_VERIFICATION.md` | Phase 1C live PASS |
| `V1_0_61_HUMAN_QA_RESULTS.md` | Director checklists (unsigned) |
| `V1_0_61_RELEASE_BUNDLE.md` | Intended commit scope |
| `ON_TOP_FIX_VERIFICATION.md` | On Top automated detail |
| `STARTING_PLAYER_POST_TRADE_FIX_VERIFICATION.md` | Opener fix detail |
| `P0_ROUND_TRANSITION_INVESTIGATION.md` | Ceremony risk reference |
| `studio/BOTOPN_RC_DEFERRAL.md` | D-010 waiver |
