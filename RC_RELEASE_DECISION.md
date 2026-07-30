# RC Release Decision — v1.0.61

**Sprint date:** 2026-06-08  
**Decision:** **SHIP WITH KNOWN ISSUES**  
**Confidence:** **79%**

---

## Phase 2 — Version consistency audit

| Location | Version / value | Status |
|----------|-----------------|--------|
| **Production** (`https://shifuguru.github.io/ps_and_as/version.json`) | **1.0.60** · build `249eabb` · codename Quad Squad Goals | ✅ Live fetched |
| **`package.json` (local)** | **1.0.60** | ⚠️ Stale — bump to **1.0.61** on commit |
| **`version.json` (repo root)** | **1.0.59** · build `c82ad46` | ❌ Stale — do not trust; regenerate on deploy |
| **`web-build/version.json`** | **1.0.55** | ❌ Stale local artifact — `npm run build:web` at release |
| **What's New** (`updateLogContent.ts`) | Top entry: "Fresh round & online dealing" (no v1.0.61 title) | ⚠️ Add v1.0.61 entry on commit |
| **Release notes draft** | `v1.0.61_CHANGELOG_DRAFT.md` | ✅ Ready |
| **Mission Control** (`public/studio/dashboard.json`) | **1.0.60** | POST-RC — not shipped with gameplay RC |
| **`src/config/buildCodenames.ts`** | Through **1.0.60** | ⚠️ Add **1.0.61** codename on bump |
| **`src/config/buildVersion.ts` runtime** | Reads `package.json` / env / `version.json` on web | ✅ Will show 1.0.61 after bump + deploy |

### Canonical version answer

```text
Current production:  v1.0.60 @ 249eabb (GitHub Pages)
Current local:       v1.0.60 (package.json); gameplay fixes uncommitted
Target release:      v1.0.61
```

### Stale references to fix at commit time

1. `package.json` → `"version": "1.0.61"`
2. `src/screens/updateLogContent.ts` → new entry (see changelog draft)
3. `src/config/buildCodenames.ts` → `"1.0.61": "<codename>"`
4. Do **not** commit root `version.json` or `web-build/` — CI/deploy generates fresh metadata

---

## Phase 4 — Final smoke verification

Session: automated + live socket harness (2026-06-08). Browser Director smoke **not** run.

| ID | Scenario | Method | Result | Notes |
|----|----------|--------|--------|-------|
| **OT-1** | Higher/Lower 10 On Top | `test-core` direction recovery + `trace-on-top-pass-block.mjs` | **PASS** | On Top grants; pre-fix pass-block **not** reproduced with v1.0.61 guards |
| **OT-2** | Run On Top | `test-core` run-on-top suite | **PASS** | Grant, beat validation, pass-on-top, no premature pile clear |
| **R-1** | Last hand → rankings → ready order | `test-connected-round-end-order.mjs` | **PASS** | Rankings never before last-hand reveal; `roundOver` gated on `roundEnded` |
| **D10-1** | BOTOPN hidden | Code audit `FindGame.tsx` + `roomCode.ts` | **PASS** (code) | `publicRooms` filter; empty **"No Public Games Available"**; `BOTOPN` join blocked |
| **O-1** | Post-trade 3♣ opener | `test-post-trade-opener.mjs` + prior `live-post-trade-opener-verify.mjs` | **PASS** | Live room `O805930`; 3 clients agreed on Guest (3♣ holder) |

### Additional gates (RC scope)

| Command | Result |
|---------|--------|
| `npx tsx ./scripts/test-core.ts` | **PASS** |
| `SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate` | **PASS** (4 passed, 2 skipped) |

### Smoke gaps (known issues — not blockers)

| Gap | Severity |
|-----|----------|
| OT-1 / OT-2 not exercised in browser with human taps | Medium — automated + server logic only |
| D10-1 not verified on deployed build (D-010 uncommitted) | Low until push |
| Dead Hand not live-socket tested | Low — unit + audit coverage |
| Director checklists in `V1_0_61_HUMAN_QA_RESULTS.md` still ☐ | Process — waived for **SHIP WITH KNOWN ISSUES** |

---

## Phase 1 — Bundle reference

See **`RC_RELEASE_BUNDLE.md`** — 24 files recommended for commit; Mission Control / presence / studio **excluded**.

---

## Remaining known issues (non-blocking)

| Issue | RC status |
|-------|-----------|
| BOTOPN lifecycle / stall gates | **Waived** (D-010) — not a blocker |
| Browser Director smoke (OT/D10) | Accepted — automated proxy green |
| Seated `playerReadyForNextRound` mid-round (P1 gap) | Pre-existing — not in v1.0.61 scope |
| CPU takeover / disconnect timeout gaps | Pre-existing P0/P1 — not in v1.0.61 scope |
| Mission Control route in working tree | **Excluded** from RC commit |

---

## Blockers

**None** for **SHIP WITH KNOWN ISSUES** after scoped commit.

**Would block unconditional SHIP:**

- Uncommitted RC bundle (must commit before deploy)
- `package.json` still 1.0.60 until release commit

---

## Recommendation

### **SHIP WITH KNOWN ISSUES**

**Confidence: 79%**

**Justification:**

- Scope is frozen and inventoried (`RC_RELEASE_BUNDLE.md`).
- All sprint smoke scenarios **pass** via automated, socket-live, or code-audit paths.
- Release gate (RC scope) **PASS**.
- Version bump + What's New are **defined** but must land in the **same release commit**.
- Residual risk is **browser-level** On Top / Find Game confirmation and pre-existing architecture gaps — acceptable under D-010 waiver and documented proxies.

**Not recommended:** **DO NOT SHIP** (overly conservative given green gates) or unconditional **SHIP** (browser smoke not recorded).

---

## Commit & deploy plan

### 1. Stage (exact list)

Use file list from `RC_RELEASE_BUNDLE.md` — **exclude** `App.tsx`, `src/studio/loadStudioData.ts`, `AppErrorBoundary.tsx` Mission Control hunks unless Director expands scope.

```bash
git add \
  src/game/core.ts \
  src/game/roundPrep.ts \
  src/game/roundTransitionDiagnostics.ts \
  src/utils/tableSeats.ts \
  src/utils/roomCode.ts \
  src/screens/GameScreen.tsx \
  src/screens/FindGame.tsx \
  server/index.js \
  scripts/test-core.ts \
  scripts/test-release-gate.mjs \
  scripts/test-post-trade-opener.mjs \
  scripts/test-connected-round-end-order.mjs \
  scripts/trace-on-top-pass-block.mjs \
  scripts/live-post-trade-opener-verify.mjs \
  package.json \
  src/screens/updateLogContent.ts \
  src/config/buildCodenames.ts
```

### 2. Version & What's New

- Set `package.json` → `"1.0.61"`
- Add codename for `1.0.61` in `buildCodenames.ts`
- Paste What's New from `v1.0.61_CHANGELOG_DRAFT.md`
- After commit: `git log -1 --format=%ci` → set `publishedAt` (NZ) on new entry; amend if needed per push workflow

### 3. Pre-push verification

```bash
npx tsx ./scripts/test-core.ts
SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate
node scripts/test-connected-round-end-order.mjs
node scripts/live-post-trade-opener-verify.mjs   # optional quick O-1
```

### 4. Commit message

```text
v1.0.61 — On Top grant path, post-trade 3♣ opener, hide BOTOPN (D-010)
```

### 5. Push & deploy

```bash
git push origin main
```

- GitHub Pages workflow ships **1.0.61** from `package.json`
- Post-deploy bump job adds **1.0.62** patch on `main` with `[skip ci]` (per repo rule — do not run local `bump-version` before push)

### 6. Post-deploy (optional ~10 min)

- Director: OT-1 + D10-1 on live URL
- Confirm `https://shifuguru.github.io/ps_and_as/version.json` shows **1.0.61**

---

## Related artifacts

| Doc | Purpose |
|-----|---------|
| `RC_RELEASE_BUNDLE.md` | File inventory & buckets |
| `v1.0.61_CHANGELOG_DRAFT.md` | Player-facing notes |
| `LIVE_POST_TRADE_OPENER_VERIFICATION.md` | O-1 live evidence |
| `RC_FINAL_READINESS_REPORT.md` | Prior sprint (superseded by this decision) |
