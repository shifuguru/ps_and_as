# v1.0.61 Release Staging Plan

**Date:** 2026-06-08  
**Source:** `V1_0_61_COMMIT_MANIFEST.md`  
**Scope:** Git staging and commit plan only — **no code changes in this document.**

---

## Pre-flight — resolve Mission Control commit

**Current HEAD:** `e39fdbb` (*restore: re-enable mission control route*) — **3 files, POST-RC, not in v1.0.61 scope.**

Before staging RC files, choose **one**:

| Option | Command | When to use |
|--------|---------|-------------|
| **A — Revert MC on `main`** | `git revert e39fdbb --no-edit` | Keep linear history; MC restored later post-RC |
| **B — Release branch from production** | `git checkout -b release/v1.0.61 origin/main` | Safest if `origin/main` is still @ `249eabb` and MC must not touch release branch |

**Do not push `e39fdbb` + v1.0.61 together** unless Director explicitly expands scope to include Mission Control route restore.

---

## Phase 1 — Release file list

### Include — **17 files** (production deploy bundle)

#### Gameplay — **7 files**

| File | Ships because |
|------|----------------|
| `src/game/core.ts` | On Top grant-path / direction recovery |
| `src/screens/GameScreen.tsx` | On Top client guards; post-trade opener reconcile; ceremony `lastRoundOrder` fix |
| `src/screens/FindGame.tsx` | D-010 BOTOPN hide |
| `src/game/roundPrep.ts` | Post-trade opener reconcile helpers |
| `src/utils/tableSeats.ts` | `resolveOpenerAfterRoleTrades`; dead-hand branch preserved |
| `src/utils/roomCode.ts` | `isBotPublicRoomCode()` |
| `src/game/roundTransitionDiagnostics.ts` | `logPostTradeOpenerReconciled` |

#### Server — **1 file**

| File | Ships because |
|------|----------------|
| `server/index.js` | On Top server turn bypass; post-trade sync-before-broadcast; `resolveOpenerAfterRoleTrades` |

#### Tests — **6 files**

| File | Ships because |
|------|----------------|
| `scripts/test-core.ts` | On Top, post-trade opener, dead-hand post-trade regressions |
| `scripts/test-release-gate.mjs` | D-010 `SKIP_BOTOPN` / `RC_SCOPE` waiver |
| `scripts/test-post-trade-opener.mjs` | Server trade-complete ordering |
| `scripts/test-connected-round-end-order.mjs` | R-1 rankings / last-hand order |
| `scripts/trace-on-top-pass-block.mjs` | OT-1 pass-block trace |
| `scripts/live-post-trade-opener-verify.mjs` | O-1 live socket repro |

#### Release metadata — **3 files**

| File | Ships because |
|------|----------------|
| `package.json` | `"version": "1.0.61"` — **deploy workflow reads this** |
| `src/screens/updateLogContent.ts` | What's New v1.0.61 entry |
| `src/config/buildCodenames.ts` | Codename for `"1.0.61"` |

#### Optional (not counted in 17) — **1 file**

| File | Note |
|------|------|
| `RELEASE_GATE.md` | Gate doc +1 line — include only if you want doc in repo; not player-facing |

---

### Exclude — counts

| Bucket | Count | Examples |
|--------|------:|----------|
| **Untracked paths (do not stage)** | **150** | `studio/`, `public/studio/`, `test-results/`, investigations, probes |
| **HEAD Mission Control commit (revert before RC push)** | **3** | `App.tsx`, `AppErrorBoundary.tsx`, `loadStudioData.ts` |
| **Untracked investigation / RC markdown (root)** | **~20** | `RC_*.md`, `V1_0_61_*.md`, `*_INVESTIGATION.md`, `LIVE_*.md` |
| **Untracked Mission Control UI (unused on deploy without full stack)** | **~10+** | `MissionControlScreen.tsx`, `src/studio/*`, `scripts/studio/**` |
| **Untracked POST-RC gameplay experiments** | **~15** | `src/presence/**`, seat chat, turn-ownership, presence screenshots |
| **Untracked probes / scratch** | **~12** | `explore-*`, `investigate-*`, `offline-seed-*`, `gate-run-*.txt`, `bare-turn-sim.mjs` |
| **Stale generated artifacts (never stage manually)** | **2+ dirs** | repo root `version.json` (1.0.59), `web-build/**` (1.0.55) |

**Total excluded from v1.0.61 commit:** **~150 untracked + 3 MC HEAD files + optional ~20 markdown** (markdown may remain untracked in working tree).

**Modified but not in include list:** `RELEASE_GATE.md` only (optional).

---

## Phase 2 — Staging commands

**Prerequisites:** MC pre-flight done; `package.json`, `updateLogContent.ts`, `buildCodenames.ts` edited to 1.0.61 (Phase 3).

```bash
cd "c:/Users/Admin/source/repos/ps_and_as"

# Gameplay (7)
git add src/game/core.ts
git add src/game/roundPrep.ts
git add src/game/roundTransitionDiagnostics.ts
git add src/utils/tableSeats.ts
git add src/utils/roomCode.ts
git add src/screens/GameScreen.tsx
git add src/screens/FindGame.tsx

# Server (1)
git add server/index.js

# Tests (6)
git add scripts/test-core.ts
git add scripts/test-release-gate.mjs
git add scripts/test-post-trade-opener.mjs
git add scripts/test-connected-round-end-order.mjs
git add scripts/trace-on-top-pass-block.mjs
git add scripts/live-post-trade-opener-verify.mjs

# Release metadata (3)
git add package.json
git add src/screens/updateLogContent.ts
git add src/config/buildCodenames.ts

# Optional gate doc only:
# git add RELEASE_GATE.md
```

### Verify staging (required)

```bash
git diff --cached --stat
git diff --cached --name-only
```

**Pass criteria:**

- **Exactly 17 paths** (or 18 with `RELEASE_GATE.md`)
- **Zero** paths matching: `studio/`, `public/studio/`, `test-results/`, `presence/`, `MissionControl`, `*.md` investigations, `App.tsx` (unless MC explicitly in scope)

### Pre-commit gate

```bash
SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate
```

---

## Phase 3 — Version preparation

### `package.json`

```json
"version": "1.0.61"
```

**Current:** `1.0.60`  
**Authority:** Deploy workflow reads `package.json` (`deploy-web.yml` → `Read app version for this release`).

Also update `app.json` `expo.version` to `1.0.61` if present ( `npm run bump-version` updates both — but **do not run bump-version before release**; it increments to 1.0.62). **Manual edit** to `1.0.61` only.

### What's New — `src/screens/updateLogContent.ts`

Add **new top entry** in `UPDATE_ENTRIES` (before existing entries):

| Field | Value |
|-------|--------|
| **title** | `On Top, opening lead & Find Game` |
| **items** | See `v1.0.61_CHANGELOG_DRAFT.md` (3 bullets, player language) |
| **publishedAt** | Set **after** commit: `git log -1 --format=%ci` → convert to NZ (`nzst()` / `nzdt()`) per workspace push rule |

Do **not** use placeholder times.

### Codename — `src/config/buildCodenames.ts`

Add line:

```typescript
"1.0.61": "<codename>",
```

Pick codename manually or run `node -e "..."` from pool — **do not** run full `npm run bump-version` pre-push (that targets **next** patch after current).

### Version display — authoritative sources

| Source | Role | Action for v1.0.61 |
|--------|------|---------------------|
| **`package.json`** | Semver for build + UI (`buildVersion.ts` → `resolveAppVersion()`) | **Edit → 1.0.61** and commit |
| **`web-build/version.json`** | Live deploy metadata at site root | **Regenerate** — run `npm run build:web` locally or let **CI** generate on push |
| **Repo root `version.json`** | Synced to main **by CI** after deploy (`deploy-web.yml` copies from `web-build/`) | **Ignore for manual commit** — currently **stale (1.0.59)**; CI overwrites on successful deploy |
| **`EXPO_PUBLIC_APP_VERSION`** | Baked at CI build from `package.json` | Automatic on push |
| **`buildUpdateCheck.ts`** | Polls deployed `{origin}/version.json` for refresh overlay | Updates automatically when Pages deploy completes |
| **Mission Control `dashboard.json`** | Studio only | **Exclude** — not part of v1.0.61 gameplay commit |

**Evidence (do not guess):**

- `scripts/fix-web-build-paths.js` → `writeVersionJson()` writes `web-build/version.json` from `package.json` + `EXPO_PUBLIC_BUILD_ID` + codename lookup.
- `.github/workflows/deploy-web.yml` → builds with `package.json` version, verifies `web-build/version.json`, syncs to root `version.json` on `main` with `[skip ci]`.
- Post-deploy job runs `npm run bump-version` → **1.0.62** on `main` for **next** release (not part of this commit).

**Local `npm run build:web` before push:** Optional for pre-flight; **not required** in git commit. Production `version.json` comes from CI artifact.

---

## Phase 4 — Commit plan

### Recommended: **single commit**

**Justification:**

- Workspace push rule: release commit includes What's New + gameplay + `package.json` **1.0.61** together.
- Deploy workflow ships **one** `package.json` version per push.
- Splitting version from fixes risks partial deploy or mismatched What's New.

**Message:**

```text
v1.0.61 — On Top grant path, post-trade 3♣ opener, hide BOTOPN (D-010)
```

**After commit — timestamp amend (if required by push rule):**

```bash
git log -1 --format=%ci
# Update UPDATE_ENTRIES[0].publishedAt to match commit time (NZ)
# git add src/screens/updateLogContent.ts && git commit --amend --no-edit
```

*(Only amend if you created the commit and it is not pushed.)*

---

### Alternative: **two commits** (only if MC revert is separate)

| Order | Commit | Files |
|-------|--------|-------|
| **0** | `revert: Mission Control route restore (post-RC)` | Revert `e39fdbb` |
| **1** | `v1.0.61 — …` | All 17 RC files + version metadata |

Do **not** split gameplay vs version into two commits for the same release push.

---

## Phase 5 — Deployment checklist

Execute **after** commit + push to `main` (triggers `deploy-web.yml` when app paths change).

| Step | Action | Pass check |
|------|--------|------------|
| **1** | Push `main` | CI `Deploy web app to GitHub Pages` starts |
| **2** | Wait for build + deploy | Job green; `Verify live site serves the app` OK |
| **3** | Verify production URL | `https://shifuguru.github.io/ps_and_as/version.json` → `"version": "1.0.61"`, `"channel": "production"`, `buildId` = deploy SHA prefix |
| **4** | Verify in-app version | Splash / settings build label shows **1.0.61** + codename |
| **5** | Multiplayer room | Create private 3p room; deal + play one trick |
| **6** | Find Game D10-1 | No BOTOPN row; empty state **No Public Games Available**; join code `BOTOPN` rejected |
| **7** | On Top smoke OT-1 | Play 10, others pass → On Top → play or pass without "Not your turn" |
| **8** | Post-deploy | CI `bump-version` job may commit **1.0.62** `[skip ci]` on `main` — expected |

**Server note:** Railway (or host) must deploy `server/index.js` separately if backend is not auto-deployed from this repo push.

### Optional pre-push local build

```bash
npm run build:web
# Inspect web-build/version.json — should show 1.0.61 if package.json already bumped
```

Do **not** commit `web-build/` unless your process requires it — CI is authoritative for Pages.

---

## Final status

### **REQUIRES ADDITIONAL CLEANUP**

| Blocker | Status |
|---------|--------|
| MC commit `e39fdbb` on branch | Must revert or branch around |
| `package.json` / What's New / codename | Must edit before stage |
| 17 RC files unstaged | Must `git add` explicitly |
| 150 untracked artifacts | Must not `git add .` |

### After cleanup → **READY FOR RELEASE EXECUTION**

| Metric | Value |
|--------|-------|
| **Include file count** | **17** (+1 optional `RELEASE_GATE.md`) |
| **Exclude (untracked)** | **150 paths** |
| **Confidence after cleanup** | **80%** |
| **Confidence as-is now** | **35%** |

Residual accepted risk: browser Director smoke not recorded (automated + socket gates green per `RC_RELEASE_DECISION.md`).

---

## Quick reference — staged file manifest

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
