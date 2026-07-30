# v1.0.61 Release Bundle

**Baseline:** production **v1.0.60** @ `249eabb8298333e24f53578e54f7d45dffa5c7bd`  
**Target version:** `1.0.61` (set on release commit — do not bump until push)  
**Date:** 2026-06-08  
**Status:** Ready to commit — **Director Human QA signoff pending**

---

## Scope summary

| Cluster | Fix | Files |
|---------|-----|-------|
| **A** | Round transition — empty hands after fresh round / instant `tradesComplete` | `src/screens/GameScreen.tsx` |
| **B** | Spectator ready promotion between rounds | `server/index.js` |
| **On Top** | Grant-path direction recovery + client/server turn guards | `src/game/core.ts`, `GameScreen.tsx`, `server/index.js` |
| **D-010** | Hide BOTOPN from Find Game; block join-by-code | `src/screens/FindGame.tsx`, `src/utils/roomCode.ts` |

**Excluded from this bundle:** Mission Control stack, presence rings, seat chat, studio infra, investigation markdown (reference only). See `RC_1_0_61_EXCLUDED.md`.

---

## Files to commit (release commit)

### Gameplay — MUST

```
src/screens/GameScreen.tsx      # Cluster A + On Top client
server/index.js                 # Cluster B + On Top server
src/game/core.ts                # On Top grant / effective ten-rule
src/screens/FindGame.tsx        # D-010 BOTOPN hide
src/utils/roomCode.ts           # BOT_PUBLIC_ROOM_CODE + isBotPublicRoomCode
```

### Verification — SHOULD

```
scripts/test-core.ts            # On Top direction recovery tests
scripts/trace-on-top-pass-block.mjs
scripts/test-connected-round-end-order.mjs
scripts/test-release-gate.mjs   # SKIP_BOTOPN=1 RC waiver (D-010)
```

### Release packaging — MUST (on push commit)

```
package.json                    # "version": "1.0.61"
src/screens/updateLogContent.ts # What's New entry (see draft below)
```

---

## Verification results (2026-06-08)

| Gate / test | Command | Result |
|-------------|---------|--------|
| Core + On Top | `npx tsx ./scripts/test-core.ts` | **PASS** |
| On Top trace | `npx tsx ./scripts/trace-on-top-pass-block.mjs` | **PASS** |
| Rankings reconnect | `node scripts/test-reconnect-round-complete.mjs` | **PASS** |
| Overlay order | `node scripts/test-connected-round-end-order.mjs` | **PASS** |
| Offline release gate | `npm run test-release-gate:offline` | **PASS** (5/5) |
| **RC-scope full gate** | `SKIP_BOTOPN=1 SKIP_LIVE=1 RELEASE_GATE_SPAWN_SERVER=1 npm run test-release-gate` | **PASS** (exit 0) |

**Waived (D-010):** `botopn-lifecycle`, `botopn-stall-live` — use `SKIP_BOTOPN=1` or `RC_SCOPE=1` in orchestrator.

**Pending:** Director Human QA — `V1_0_61_HUMAN_QA_RESULTS.md`

---

## D-010 implementation

Per `studio/decisions.md` D-010 and `studio/BOTOPN_RC_DEFERRAL.md`:

1. **`publicRooms`** — filters `isBotHosted` and `BOTOPN` from Find Game list.
2. **Empty state** — title **"No Public Games Available"** when no human public lobbies.
3. **Join by code** — `BOTOPN` rejected with player-facing message.
4. **Server** — `botHostedRooms.js` unchanged; BOTOPN still runs for post-RC reactivation.

---

## On Top verification

| Layer | Status |
|-------|--------|
| Core grant + direction recovery | **PASS** (`test-core`) |
| Stale pass-block trace | **PASS** (`trace-on-top-pass-block.mjs`) |
| Client `humanRunOnTopTurn` guards | Implemented — see `ON_TOP_FIX_VERIFICATION.md` |
| Server turn realignment | Implemented |
| **Live private multiplayer smoke** | **Pending Director** (OT-1–OT-3 in Human QA doc) |

---

## Draft What's New (add to `updateLogContent.ts` on push)

**Title:** Round transitions, On Top & Find Game

**Items (player language):**

- Online — after repeated Asshole streaks, the next deal no longer stalls with empty hands or a phantom President trade
- Online — spectators who tap Ready between rounds should get seated more reliably
- On Top — when you win a trick with a 10, you can play or pass on your on-top turn instead of getting stuck
- Find Game — when no human hosts are online, you'll see “No Public Games Available” instead of a bot table listing

**Known issues (optional RC-K rows):**

- RC-K1 / RC-K2 — public bot matchmaking (BOTOPN) deferred post-RC (Monitoring or omit if not player-visible)

---

## Release commands

```bash
# Pre-push verification (RC scope)
RELEASE_GATE_SPAWN_SERVER=1 SKIP_BOTOPN=1 SKIP_LIVE=1 npm run test-release-gate

# Offline fast path
npm run test-release-gate:offline

# Rankings + round transition scripts
node scripts/test-reconnect-round-complete.mjs
node scripts/test-connected-round-end-order.mjs
```

---

## Push checklist (when Director approves)

1. [ ] Director signoff on `V1_0_61_HUMAN_QA_RESULTS.md` (or waiver)
2. [ ] Stage scoped files only (avoid studio / MC / presence)
3. [ ] Set `package.json` → `1.0.61`
4. [ ] Add What's New entry; set `publishedAt` from commit timestamp (NZ)
5. [ ] Commit: `v1.0.61 — round transition, On Top, hide BOTOPN`
6. [ ] Push → deploy workflow ships version; post-deploy bump on `main`

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `RC_1_0_61_INCLUDED.md` | Original Clusters A+B minimal scope |
| `RC_1_0_61_EXCLUDED.md` | Out-of-scope working-tree items |
| `ON_TOP_FIX_VERIFICATION.md` | On Top fix detail |
| `V1_0_61_HUMAN_QA_RESULTS.md` | Automated + Human QA checklists |
| `studio/BOTOPN_RC_DEFERRAL.md` | D-010 waiver criteria |
