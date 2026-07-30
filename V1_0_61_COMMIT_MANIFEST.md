# v1.0.61 Commit Manifest Audit

**Audit date:** 2026-06-08  
**Git HEAD:** `e39fdbb` — *restore: re-enable mission control route*  
**Production baseline:** v1.0.60 @ `249eabb`  
**Target release:** v1.0.61  
**Scope:** Manifest and audit only — no code changes.

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Verdict** | **NOT READY TO COMMIT** |
| **Intended release file count** | **24** (see § Release bundle) |
| **Currently staged** | **0** |
| **Unstaged gameplay delta** | **11 modified** |
| **Untracked paths** | **150** (must not bulk-add) |
| **HEAD commit outside RC scope** | **3 files** (Mission Control route) |
| **Confidence (ready after corrective staging)** | **78%** |
| **Confidence (ready as-is now)** | **32%** |

**Primary blockers:** RC gameplay fixes are **uncommitted**; `package.json` / What's New **not bumped to 1.0.61**; HEAD contains a **Mission Control** commit that must not ship mixed into v1.0.61 without scope decision; **150 untracked** investigation/studio artifacts risk accidental inclusion.

---

## Inventory (commands run)

```bash
git status
git diff --stat
git ls-files --others --exclude-standard
```

### Modified files (11) — unstaged

| File | Δ vs `249eabb` |
|------|----------------|
| `RELEASE_GATE.md` | +1 line |
| `scripts/test-core.ts` | +306 lines |
| `scripts/test-release-gate.mjs` | +3 lines |
| `server/index.js` | +31 / −14 lines |
| `src/game/core.ts` | +17 / −6 lines |
| `src/game/roundPrep.ts` | +59 lines |
| `src/game/roundTransitionDiagnostics.ts` | +4 lines |
| `src/screens/FindGame.tsx` | +25 lines |
| `src/screens/GameScreen.tsx` | +88 lines |
| `src/utils/roomCode.ts` | +7 lines |
| `src/utils/tableSeats.ts` | +33 lines |

**Combined unstaged diff:** 11 files, **+515 / −59** lines.

### New tracked files

**None** staged or committed for v1.0.61 RC gameplay.

### Deleted files

**None.**

### HEAD commit already on `main` (ahead of `origin/main` by 1)

| File | In commit `e39fdbb` |
|------|---------------------|
| `App.tsx` | Mission Control route gate |
| `src/components/AppErrorBoundary.tsx` | MC crash surface |
| `src/studio/loadStudioData.ts` | MC data loader (new, 180 lines) |

**Note:** `MissionControlScreen.tsx` and `src/studio/*` UI are **untracked** — route restore in HEAD may be incomplete without those files on deploy.

### Untracked files (150 paths)

Full list from `git ls-files --others --exclude-standard`. Grouped in § Classification below.

---

## Classification — modified files (unstaged)

| File | Category | RC commit? |
|------|----------|------------|
| `src/game/core.ts` | **Gameplay** | ✅ MUST |
| `src/screens/GameScreen.tsx` | **Gameplay** | ✅ MUST |
| `src/screens/FindGame.tsx` | **Gameplay** | ✅ MUST |
| `src/game/roundPrep.ts` | **Gameplay** | ✅ MUST |
| `src/utils/tableSeats.ts` | **Gameplay** | ✅ MUST |
| `src/utils/roomCode.ts` | **Gameplay** | ✅ MUST |
| `src/game/roundTransitionDiagnostics.ts` | **Gameplay** (diagnostics module) | ✅ MUST |
| `server/index.js` | **Server** | ✅ MUST |
| `scripts/test-core.ts` | **Tests** | ✅ MUST |
| `scripts/test-release-gate.mjs` | **Tests** | ✅ MUST |
| `RELEASE_GATE.md` | **Studio / Internal** | ⚠️ Optional — exclude or include as gate doc |

---

## Classification — HEAD commit `e39fdbb`

| File | Category | RC commit? |
|------|----------|------------|
| `App.tsx` | **Mission Control** | ❌ EXCLUDE from v1.0.61 |
| `src/components/AppErrorBoundary.tsx` | **Mission Control** | ❌ EXCLUDE |
| `src/studio/loadStudioData.ts` | **Mission Control** | ❌ EXCLUDE |

**Risk:** Pushing `main` as-is ships Mission Control route restore **before** v1.0.61 gameplay commit. Revert, squash, or branch strategy required.

---

## Classification — untracked (selected groups)

### Tests — ✅ ADD to RC commit (if not already tracked)

| File | Category |
|------|----------|
| `scripts/test-post-trade-opener.mjs` | **Tests** |
| `scripts/test-connected-round-end-order.mjs` | **Tests** |
| `scripts/trace-on-top-pass-block.mjs` | **Tests** |
| `scripts/live-post-trade-opener-verify.mjs` | **Tests** |

### Release tooling — ✅ ADD at commit time (currently unchanged on disk)

| File | Category | Status |
|------|----------|--------|
| `package.json` | **Release Tooling** | ⚠️ Still **1.0.60** — must edit → 1.0.61 |
| `src/screens/updateLogContent.ts` | **Release Tooling** | ⚠️ No v1.0.61 entry yet |
| `src/config/buildCodenames.ts` | **Release Tooling** | ⚠️ No **1.0.61** codename |
| `v1.0.61_CHANGELOG_DRAFT.md` | **Studio / Internal** | ❌ EXCLUDE (draft only) |

### Mission Control — ❌ EXCLUDE

| Paths |
|-------|
| `src/screens/MissionControlScreen.tsx` |
| `src/studio/FreshnessPanel.tsx`, `freshness.ts`, `releaseGateSummary.ts`, `types.ts` |
| `src/utils/fetchStaticAsset.ts`, `staticAssetPaths.ts` |
| `scripts/studio/**` |
| `studio/**`, `public/studio/**` |
| `.cursor/rules/studio-orchestrator.mdc` |

### Presence / seat chat / polish — ❌ EXCLUDE (POST-RC)

| Paths |
|-------|
| `src/presence/**` |
| `src/components/PresenceRing*.tsx`, `LegacyTurnRing.tsx` |
| `src/components/GameSeatChatButton.tsx` |
| `src/utils/seatChat.ts`, `playAnimationTiming.ts`, `turnTransitionDiagnostics.ts`, `multiplayerPresentationVerify.ts` |
| `scripts/test-presence-ring.ts`, `presence-ring-smoke.mjs`, `presence-ring-screenshots/**` |

### Studio / Internal — ❌ EXCLUDE

All `*_INVESTIGATION.md`, `*_VERIFICATION.md`, `RC_*.md`, `V1_0_61_*.md`, `ON_TOP_*.md`, `P0_*.md`, `QA006_*.md`, `TURN_OWNERSHIP_*.md`, `MISSION_CONTROL_*.md`, `LIVE_*.md`, `gate-run-cluster-ab.txt`, `studio/**`, `public/studio/**`.

### Exclude — probes, scratch, dumps

See § Explicit exclusion audit.

---

## Release bundle verification

For every file **intended** to ship in v1.0.61:

| File | Why shipping? |
|------|----------------|
| `src/game/core.ts` | **On Top fix** — direction recovery; `resolveEffectiveTenRule` at grant sites; `isOnTopEligiblePile` works after sync strip |
| `src/screens/GameScreen.tsx` | **On Top fix** — `humanRunOnTopTurn` guards; **Post-trade opener** — `reconcileSyncedOpeningPlayer`; ceremony `lastRoundOrder` fix; removes stale `useServerOpener` |
| `server/index.js` | **On Top fix** — server `runOnTopTurn` bypass; **Post-trade opener** — sync before broadcast, `resolveOpenerAfterRoleTrades`, `startNextRound` instant-complete sync |
| `src/utils/tableSeats.ts` | **Post-trade opener** — `resolveOpenerAfterRoleTrades` (3♣ only); **Dead Hand protection** — dead-hand branch unchanged inside `resolveLeadPlayerIndexAfterTrades` |
| `src/game/roundPrep.ts` | **Post-trade opener** — `reconcilePostTradeOpeningIndex`, `openingLeadNotYetTaken` |
| `src/game/roundTransitionDiagnostics.ts` | **Ceremony diagnostics** — `logPostTradeOpenerReconciled` for sync overwrite detection |
| `src/screens/FindGame.tsx` | **D-010 BOTOPN hide** — filter list, empty copy, block join-by-code |
| `src/utils/roomCode.ts` | **D-010** — `isBotPublicRoomCode()` |
| `scripts/test-core.ts` | Regression — On Top, post-trade opener, dead-hand post-trade, client reconcile |
| `scripts/test-release-gate.mjs` | **D-010 waiver** — `SKIP_BOTOPN` / `RC_SCOPE` |
| `scripts/test-post-trade-opener.mjs` | Server ordering regression |
| `scripts/test-connected-round-end-order.mjs` | Rankings / last-hand order regression |
| `scripts/trace-on-top-pass-block.mjs` | On Top pass-block trace |
| `scripts/live-post-trade-opener-verify.mjs` | Live socket O-1 verification |
| `package.json` | Release version **1.0.61** |
| `src/screens/updateLogContent.ts` | Player What's New |
| `src/config/buildCodenames.ts` | Codename for 1.0.61 |

### Not shipping (called out in sprint examples but absent from bundle)

| Item | Status |
|------|--------|
| **Presence ring loop fix** | ❌ Not in modified/untracked RC set — POST-RC (`src/presence/**` untracked) |
| **Cluster A `shouldFinalizeInstantTradesComplete`** | ❌ Symbol not in codebase — partial ceremony fix via opener reconcile only |
| **GamePlayArea.tsx / GameTable.tsx** | ❌ Not in current diff |

---

## Explicit exclusion audit

| Pattern / path | Decision | Justification |
|----------------|----------|---------------|
| `test-results/` | **EXCLUDE** | Local gate/server logs, not production |
| `gate-run-cluster-ab.txt` | **EXCLUDE** | Scratch gate output |
| `scripts/release-gate/offline-seed-42003-min-repro.*` | **EXCLUDE** | Investigation repro seed — not RC gate |
| `scripts/investigate-play-stack.mjs` | **EXCLUDE** | Investigation probe |
| `scripts/explore-gameplay-edge.mjs` | **EXCLUDE** | Exploration script |
| `scripts/human-interaction/**` | **EXCLUDE** | QA evidence / checklists |
| `scripts/presence-ring-screenshots/` | **EXCLUDE** | Screenshot artifacts |
| `scripts/turn-ownership/**` | **EXCLUDE** | Turn-ownership experiment metrics |
| `scripts/release-gate/bare-turn-sim.mjs` | **EXCLUDE** | Ad-hoc sim, not in RC gate list |
| `scripts/review-package-screenshots.mjs` | **EXCLUDE** | Review tooling |
| `*.md` investigation / RC reports (root) | **EXCLUDE** | Internal docs — keep in repo optionally, not in deploy bundle |
| `studio/`, `public/studio/` | **EXCLUDE** | Mission Control / agent tracking |
| `src/screens/MissionControlScreen.tsx` | **EXCLUDE** | Mission Control UI |
| `App.tsx` (HEAD commit) | **EXCLUDE** from v1.0.61 | Mission Control route — POST-RC scope |
| `version.json` (repo root, 1.0.59) | **EXCLUDE** from commit | Stale — CI/deploy regenerates |
| `web-build/**` (1.0.55) | **EXCLUDE** | Stale local build artifact |

No files matching `temp-*`, `debug-*`, or `scratch-*` found in untracked list.

---

## Logging audit

Searched modified gameplay/server files for `console.log(`, `emitDebug(`, `[debug]`, `TODO`, `FIXME`.

### New or changed in RC diff — intentional (KEEP)

| Location | Log | Rationale |
|----------|-----|-----------|
| `src/game/roundTransitionDiagnostics.ts` | `logPostTradeOpenerReconciled` → `console.warn('[ROUND-TRANSITION] …')` | Structured ceremony diagnostic when client corrects stale opener |
| `src/utils/tableSeats.ts` | `console.warn('[opener] post-trade: no living 3♣ holder…')` | Server-side fallback visibility when hands snapshot incomplete |
| `src/screens/GameScreen.tsx` | `console.log(humanRunOnTopTurn ? 'You skipped on top!' : 'You passed')` | Player action feedback (pre-existing pattern) |
| `src/screens/GameScreen.tsx` | `logPostTradeOpenerReconciled({…})` via reconcile | Uses warn channel above |

### Pre-existing — no change in RC diff (KEEP — known debt)

| Location | Notes |
|----------|-------|
| `src/game/core.ts` | `[core DEBUG]` / `[core] passTurn` logs — long-standing sim/debug noise; **not introduced by v1.0.61 diff** |
| `server/index.js` | `[Server]` operational logs — standard server logging; **no new logs in opener/on-top diff hunks** |

### Diagnostics to remove before release

**None required for v1.0.61** from diff analysis. Optional future cleanup: `[core DEBUG]` volume in `core.ts` (pre-existing, out of RC scope).

### TODO / FIXME in modified files

**None found** in RC diff hunks.

---

## Version audit

Target: **v1.0.61**

| Location | Current value | Target | Status |
|----------|---------------|--------|--------|
| **Production** (`shifuguru.github.io/.../version.json`) | **1.0.60** @ `249eabb` | — | Live |
| **`package.json`** | **1.0.60** | 1.0.61 | ❌ Stale |
| **`version.json` (repo root)** | **1.0.59** | — | ❌ Stale — do not commit |
| **`web-build/version.json`** | **1.0.55** | — | ❌ Stale — rebuild at deploy |
| **`src/screens/updateLogContent.ts`** | Top entry "Fresh round…" (no 1.0.61) | New v1.0.61 entry | ❌ Missing |
| **`src/config/buildCodenames.ts`** | Through **1.0.60** | **1.0.61** codename | ❌ Missing |
| **`public/studio/dashboard.json`** | **1.0.60** | N/A | POST-RC — exclude from gameplay commit |
| **Mission Control UI** (`MissionControlScreen`) | Reads dashboard JSON | N/A | Untracked — exclude |

---

## Intended commit manifest (24 files)

**Stage these only** for v1.0.61:

```text
src/game/core.ts
src/game/roundPrep.ts
src/game/roundTransitionDiagnostics.ts
src/utils/tableSeats.ts
src/utils/roomCode.ts
src/screens/GameScreen.tsx
src/screens/FindGame.tsx
server/index.js
scripts/test-core.ts
scripts/test-release-gate.mjs
scripts/test-post-trade-opener.mjs
scripts/test-connected-round-end-order.mjs
scripts/trace-on-top-pass-block.mjs
scripts/live-post-trade-opener-verify.mjs
package.json
src/screens/updateLogContent.ts
src/config/buildCodenames.ts
```

**Optional:** `RELEASE_GATE.md` (+1 line)

**Do not stage:** remaining **133+** untracked paths, HEAD Mission Control files (unless scope expanded), `version.json`, `web-build/`.

---

## Pre-commit checklist

1. [ ] Resolve HEAD `e39fdbb` Mission Control commit (revert, separate branch, or accept POST-RC ship — **not** v1.0.61 gameplay)
2. [ ] Edit `package.json` → **1.0.61**
3. [ ] Add What's New + `buildCodenames` **1.0.61**
4. [ ] `git add` only the 17–18 paths above (untracked test scripts must be added explicitly)
5. [ ] `git diff --cached --name-only` review — **zero** `studio/`, `presence/`, `test-results/`, `*.md` investigations
6. [ ] Run `SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate`
7. [ ] Commit message: `v1.0.61 — On Top, post-trade 3♣ opener, hide BOTOPN (D-010)`

---

## Final verdict

### **NOT READY TO COMMIT**

| Reason | Severity |
|--------|----------|
| RC gameplay + tests **unstaged** | Blocker |
| Version / What's New **not 1.0.61** | Blocker |
| **150 untracked** files — high accidental-stage risk | Blocker |
| HEAD **Mission Control** commit pollutes release line | Blocker |
| Intended **24-file** manifest not yet assembled in one commit | Blocker |

### Counts

| | Count |
|---|------|
| **Release file count (target)** | **24** |
| **Excluded (do not stage)** | **~150 untracked + 3 HEAD MC files + ~20 investigation markdown** |
| **Currently ready to push as v1.0.61** | **0** |

### Remaining risks (after corrective commit)

| Risk | Level |
|------|-------|
| Browser Director smoke not recorded | Medium — accepted per RC decision |
| BOTOPN deferred (D-010) | Low — waived |
| Mission Control route in git history if not reverted | Medium — scope leak |
| Accidental `git add .` | High until commit completes |

### Confidence

| State | % |
|-------|---|
| **Ready as-is now** | **32%** |
| **Ready after checklist above** | **78%** |

---

## Related docs

| Doc | Role |
|-----|------|
| `RC_RELEASE_BUNDLE.md` | Scope freeze inventory |
| `RC_RELEASE_DECISION.md` | SHIP WITH KNOWN ISSUES + deploy plan |
| `v1.0.61_CHANGELOG_DRAFT.md` | What's New source |
