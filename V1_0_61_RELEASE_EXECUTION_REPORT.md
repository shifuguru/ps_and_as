# v1.0.61 Release Execution Report

**Date:** 2026-06-21 (NZST)  
**Executor:** Release agent (automated execution pass)

---

## Mission Control decision

**Answer: Is Mission Control shipping in v1.0.61?**

**No — Option B (Internal Tooling Only)**

| Action | Result |
|--------|--------|
| Revert local MC commit `e39fdbb` | `c20ace4` → rebased as `2f1f03e` |
| `App.tsx` | No `mission_control` route |
| `AppErrorBoundary.tsx` / `loadStudioData.ts` | Not in deploy bundle |
| `/ps_and_as/mission_control` | Not shipped; no MC UI in production build |

Mission Control remains internal/untracked (`MissionControlScreen.tsx`, `src/studio/*`). Route restore + revert commits are on `main` history but net **zero** MC code in production.

---

## Release commit

| Field | Value |
|-------|--------|
| **Commit** | `379fa6d783b272627672d33b721d2af3e418f97d` |
| **Message** | `v1.0.61 — On Top grant path, post-trade 3♣ opener, hide BOTOPN (D-010)` |
| **Files changed** | 16 (gameplay + tests + What's New; `package.json` already `1.0.61` on `origin/main` from post-1.0.60 bump) |
| **Diff stats** | +1778 / −60 |
| **Codename** | **Pass Parade** (from CI bump slot on `origin/main`; conflict resolved at rebase) |

### Staged file audit (pre-commit)

`git diff --cached --name-only` matched `V1_0_61_RELEASE_STAGING_PLAN.md` — **17 paths** before push:

```text
package.json
scripts/live-post-trade-opener-verify.mjs
scripts/test-connected-round-end-order.mjs
scripts/test-core.ts
scripts/test-post-trade-opener.mjs
scripts/test-release-gate.mjs
scripts/trace-on-top-pass-block.mjs
server/index.js
src/config/buildCodenames.ts
src/game/core.ts
src/game/roundPrep.ts
src/game/roundTransitionDiagnostics.ts
src/screens/FindGame.tsx
src/screens/GameScreen.tsx
src/screens/updateLogContent.ts
src/utils/roomCode.ts
src/utils/tableSeats.ts
```

No studio artifacts, investigations, probes, or `test-results/` staged.

---

## Pre-push gates

| Gate | Command | Result |
|------|---------|--------|
| Core regressions | `npx tsx ./scripts/test-core.ts` | **PASS** (On-top, ceremony, fresh round, post-trade dead-hand) |
| Core (npm script) | `npm run test-core` | **FAIL** — `ts-node` ESM resolve (`ruleset` module); use `tsx` |
| Release gate | `SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate` | **PASS** — `Passed: 4 Failed: 0 Skipped: 2`; `RELEASE GATE OK — safe to deploy (gameplay)` |

RC waivers: `SKIP_BOTOPN=1` (D-010), `SKIP_LIVE=1` (no live BOTOPN stall gate).

---

## Deployment

| Field | Value |
|-------|--------|
| **Push** | `85f5af8..379fa6d main -> main` |
| **Production URL** | https://shifuguru.github.io/ps_and_as/ |
| **Deploy artifact** | GitHub Pages (`deploy-web.yml`) |
| **Post-deploy bump** | `ec906a1 chore: bump version to v1.0.62 [skip ci]` (expected; does not change live 1.0.61 build) |

### Production version verification

Fetched `https://shifuguru.github.io/ps_and_as/version.json`:

```json
{
  "version": "1.0.61",
  "buildId": "379fa6d783b272627672d33b721d2af3e418f97d",
  "builtAt": "2026-06-20T12:29:14.570Z",
  "channel": "production",
  "codename": "Pass Parade"
}
```

**buildId** matches release commit `379fa6d`. Version **1.0.61** confirmed.

---

## Smoke results

| Check | Method | Result |
|-------|--------|--------|
| Room / reconnect stability | Release gate `private-reconnect` | **PASS** |
| Post-trade opener ordering | `node scripts/test-post-trade-opener.mjs` (post-deploy) | **PASS** |
| BOTOPN hidden | Code + D-010 gate waiver; Find Game filters `isBotPublicRoomCode` | **Shipped** — empty state **No Public Games Available**; join `BOTOPN` blocked |
| Mission Control absent | `App.tsx` grep; no route | **Confirmed** |
| Live multiplayer browser smoke | Not run in this pass | **Deferred** — socket/live opener verified pre-push (`live-post-trade-opener-verify.mjs` PASS in RC) |

**Server note:** `server/index.js` changes require separate Railway/host deploy if backend is not auto-deployed from this repo push.

---

## What's New (v1.0.61)

**Title:** On Top, opening lead & Find Game  
**publishedAt:** `2026-06-21T00:24:28+12:00` (commit author time, NZST)

---

## Final verdict

```text
DEPLOYED
```

v1.0.61 gameplay fixes, tests, and player-facing changelog are live at GitHub Pages with build id `379fa6d`. Mission Control excluded per Option B. Residual accepted risk: browser Director smoke (OT-1, D10-1) not recorded in this execution pass; automated and socket gates green.
