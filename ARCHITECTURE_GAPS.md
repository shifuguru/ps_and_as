# Architecture gaps

Living register of differences between **documented intent** ([GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md), [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md), [docs/rules.md](./docs/rules.md)) and **current implementation**.

Use this file to drive engineering work — not conversation memory.

**Authority:** `ARCHITECTURE_GAPS.md` tracks **reality**. [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) and [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) describe **intent**. Close gaps; do not duplicate intent here.

## Workflow (required before new architecture or refactors)

1. **Read** this file.
2. **Check** whether the issue is already a documented gap.
3. **If yes:** work that gap — update `Status` → investigate → implement → mark `Resolved` when shipped.
4. **If no:** add a new gap entry **first**, then investigate.

**Do not:**

- Create new architecture documents unless explicitly requested.
- Redesign systems that already have architecture docs.
- Add QA personalities, new diagrams, or extra documentation instead of closing gaps.
- Propose new architecture, refactors, invariants, or ownership models without reading this file first.
- Run further architecture passes, QA League expansion, bot personalities, or system redesigns until **P0** and **P1** gaps below are materially reduced.

**Prefer:** fixing **player-visible bugs** over documenting new technical debt.

**Success metric:** reduce the number of **Open** gaps.

**Current focus:** P0 and P1 gaps below — gameplay and multiplayer stability.

### Gap review (Gameplay Auditor — 2026-06-08)

| # | Finding | Verdict |
|---|---------|---------|
| 1 | Standard-room disconnect aborts match (no CPU substitute) | **Existing** — CPU takeover after disconnect |
| 2 | Late reconnect after grace cannot reclaim seat | **Existing** — Returning player after timeout |
| 3 | Authoritative `currentPlayerIndex` on ineligible seat | **Existing** — Turn Ownership Invariant |
| 4 | BOTOPN disconnect immediately demotes seated human mid-round | **Existing** — Bot-open disconnect model vs standard rooms |
| 5 | Online pass applies local `passTurn` without server repair pipeline | **New gap** — Online pass optimistic local mutation |
| 6 | Client `repairStuckTurnPointer` on every `gameStateSync` | **Stale / not confirmed** — no client repair in `GameScreen.tsx` today; do not track |
| 7 | Seated `playerReadyForNextRound` not gated on `betweenRounds` | **Existing gap extension** — Ready-for-next-round gating (spectator guard shipped; seated open) |
| 8 | Rankings before last hand — fixes shipped, verification incomplete | **Existing** — Rankings before last hand (online) |
| 9 | In-game grace 20–30 s random, not fixed 15 s | **Existing** — Disconnect timeout |
| 10 | `gameAction` ten-rule branch does not validate chooser | **New gap** — Ten-rule chooser server validation |

**Also noted (not new gaps):** BOTOPN pass-on-run stall RC-1 loop mitigation shipped (`repairTurnPointerAndReschedule` in `server/botHostedRooms.js`); late-round out leader + all passed trick finalize shipped (What's New Jun 2026). Both are mitigations under **Turn Ownership Invariant**, not closure of that gap.

### Multiplayer bug investigation (authoritative state first)

Before investigating rendering, animation, spectator, bot, reconnect, or UI behaviour, determine whether **authoritative server state** is already invalid.

Answer in order:

1. What is `currentPlayerIndex`?
2. Who does the server think owns the turn?
3. Is that player still eligible to act?
4. Does the server state already violate game rules?

If authoritative state is wrong, fix that before touching UI. For turn-pointer issues, see [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md) as **reference only** (gap **Turn Ownership Invariant** — not an active implementation stream unless a live bug traces directly to it).

### Current implementation priorities

| Priority | Work | Action |
|----------|------|--------|
| **P0** | **Rankings before last hand (online)** | Complete verification (Tests 1–3). Confirm reconnect replay (`emitBetweenRoundsSnapshot` on seated `joinRoom` / `requestGameState`). Update gap status when verified. |
| **P0** | **CPU takeover after disconnect** | Investigate implementation plan. Define ownership, reclaim, timeout, and resume behaviour. Close architecture gap before expanding disconnect features. |
| **P0** | **Returning player after timeout** | Ship with CPU takeover (late reclaim). |
| **P1** | **Ready-for-next-round gating** | Spectator `betweenRounds` guard shipped (v1.0.54). **Remaining:** gate seated `playerReadyForNextRound` on `betweenRounds`; verify spectator paths (multiple spectators, dead-hand, BOTOPN, leave). Add regression coverage. |
| **P1** | **Disconnect timeout** | Align 15 s grace with server + UI. |
| **P1** | **XP persistence** | Design account-independent persistence; document migration from browser-local progression. |
| **P2** | **Turn Ownership Invariant** | **Documentation only** unless a live bug traces here. Do not redesign `currentPlayerIndex` or new ownership APIs. Tests/validation only when supporting an active bug investigation. See [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md). |
| **P2** | Pause state presentation; Bot-open disconnect model | As capacity allows. |

### Priority order (gap register)

| Priority | Gaps |
|----------|------|
| **P0** | Rankings before last hand (online); CPU takeover after disconnect; Returning player after timeout |
| **P1** | Ready-for-next-round gating; Disconnect timeout; XP and progression persistence |
| **P2** | Turn Ownership Invariant (documented); Online pass optimistic local mutation; Ten-rule chooser server validation; Pause state presentation; Bot-open disconnect model vs standard rooms |

**How to maintain:** When a gap is fixed, set `Status: Resolved` and add a one-line note with version or PR. When intent changes, update the architecture doc first, then close or rewrite the gap here.

---

## Disconnect timeout

**Category:** Multiplayer

**Intended behaviour:**  
Fixed **15 second** reconnect window after an in-game disconnect. All clients show the same remaining time derived from server `reconnectUntil`.

**Current behaviour:**  
In-game grace is **20–30 seconds**, chosen at random per disconnect (`inGameAwayGraceMs()` in `server/index.js`). Lobby disconnect uses 15 s (`LOBBY_DISCONNECT_GRACE`). Client countdown uses `reconnectUntil` from `playerDisconnected` / lobby sync but the duration does not match the documented 15 s target.

**Impact:**  
Players experience inconsistent wait times; architecture and UI copy cannot promise a fixed 15 s window.

**Files likely involved:**  
`server/index.js` (`IN_GAME_AWAY_GRACE_*`, `markPlayerAway`, `scheduleAwayRemoval`), `src/screens/GameScreen.tsx` (`awayNotice`, `awayPlayers`), `src/game/socketAdapter.ts`

**Priority:** P1

**Status:** Open

**Notes:**  
Align server constant, broadcast `gracePeriod`, and any player-facing strings together. Gameplay Auditor Finding 9 reaffirmed (2026-06-08).

---

## CPU takeover after disconnect

**Category:** Multiplayer

**Intended behaviour:**  
When reconnect grace expires, the **human keeps seat ownership** (`playerId` unchanged in `gameState`). A **CPU temporarily controls** that seat. The match **resumes** for other players. The seat is not vacant and is not dead hand.

**Current behaviour:**  
Standard online rooms call `finalizeAwayPlayerRemoval` → `abortOnlineGame` and remove the player. The match **ends** with a message such as “did not reconnect in time. The game has ended.” There is **no CPU substitute** for the disconnected seat.

**Impact:**  
One dropped connection can end an entire private game for all participants. Documented pause → CPU → resume flow is not available.

**Files likely involved:**  
`server/index.js` (`finalizeAwayPlayerRemoval`, `abortOnlineGame`, `isGamePausedForAway`), `server/botHostedRooms.js` (reference for bot turn loop), `src/game/core.ts` (`applyCpuTurn` — eventual controller), `src/screens/GameScreen.tsx`

**Priority:** P0

**Status:** Open

**Notes:**  
Depends on disconnect timeout policy. Bot-open tables (`BOTOPN`) use a different path today (see gap below). Gameplay Auditor Finding 1 reaffirmed (2026-06-08).

---

## Returning player after timeout (late reclaim)

**Category:** Multiplayer

**Intended behaviour:**  
After CPU takeover, the original player can **reclaim the seat immediately** on reconnect (same profile id) while the match is still active. CPU relinquishes control instantly; reclaim is **not** deferred to round boundaries.

**Current behaviour:**  
Reconnect **before** grace expiry works: `findReconnectPlayer`, `cancelAwayRemoval`, clear `disconnectedAt`, `playerReconnected` event. **After** timeout, the player is removed and the game aborts (standard rooms) or demoted/removed (`BOTOPN`) — **no late reclaim** of the same round.

**Impact:**  
Brief network loss beyond grace is treated as permanent for the match, contrary to documented seat ownership.

**Files likely involved:**  
`server/index.js` (`findReconnectPlayer`, `attachPlayerSocket`, `finalizeAwayPlayerRemoval`), `src/screens/GameScreen.tsx` (reconnect handling)

**Priority:** P0

**Status:** Open

**Notes:**  
Ship together with CPU takeover. Until then, document player-facing messaging that the game may end after the grace window. Gameplay Auditor Finding 2 reaffirmed (2026-06-08).

---

## Pause state presentation

**Category:** UI

**Intended behaviour:**  
Dedicated paused state on the Game Shell (no new screen) showing:

- Match paused
- Disconnected player identity
- Reconnect countdown (e.g. per-second “14… 13… 12…”)

**Current behaviour:**  
Single-line top banner via `awayNotice`: `Game paused — waiting for {name} to return ({secs}s)`. Disconnected seats are styled in `OpponentRing` (`disconnectedPlayerIds`). Server errors use `Game paused — waiting for a player to reconnect`.

**Impact:**  
Pause is easy to miss; countdown format does not match architecture examples; multiple disconnected players collapse into one comma-separated line.

**Files likely involved:**  
`src/screens/GameScreen.tsx` (`awayNotice`, `bannerNotice`, `awayTick`), `src/components/OpponentRing.tsx`, `src/components/GamePlayArea.tsx` (context prompts row)

**Priority:** P2

**Status:** Open

**Notes:**  
Can ship incremental UI improvements before CPU takeover lands.

---

## Rankings before last hand (online)

**Category:** Match Flow

**Intended behaviour:**  
Round complete order is always: **Last hand reveal** → **Rankings + Ready** (`RoundCompleteModal`).

**Current behaviour:**  
Fix #1 (v1.0.46): online `roundOver` only from `roundEnded`, not early `gameStateSync`. Reconnect replay (v1.0.51): `emitBetweenRoundsSnapshot` on seated `joinRoom` and `requestGameState` during `ROUND_COMPLETE`.

**Impact:**  
Was: rankings before last hand (connected) or stuck table with no overlays (reconnect). Shipped fixes address both paths.

**Files likely involved:**  
`src/screens/GameScreen.tsx` (`applyServerSync`, `roundEnded` handler, `maybeStartLastHandReveal`, `roundOver` gating), `server/index.js` (`handleRoundFinished`, `emitBetweenRoundsSnapshot`, `joinRoom`, `requestGameState`), `server/gameSync.js`

**Priority:** P0

**Status:** Open — verification pending

**Notes:**  
Shipped: v1.0.46 Fix #1 (`roundOver` from `roundEnded` only); v1.0.51 reconnect replay (`emitBetweenRoundsSnapshot` on seated `joinRoom` and `requestGameState` during `ROUND_COMPLETE`). **Automated (partial):** release gate `reconnect-rankings` (`scripts/test-reconnect-round-complete.mjs`). **Remaining:** Test 1 connected round-end overlay order (no early `RoundCompleteModal`); Test 3 mid-round round-ending edge cases (10-rule pending, simultaneous out). Re-open until verified; then `Resolved`. Optional: remove `ROUND_TRANSITION_LOG` after manual UI pass. Gameplay Auditor Finding 8 reaffirmed (2026-06-08).

---

## Ready-for-next-round gating

**Category:** Multiplayer

**Intended behaviour:**  
`playerReadyForNextRound` is accepted only **between rounds** (round complete, no `tenRulePending`) for **all** clients — seated and spectator. Spectators may ready for **dead-hand seat claim** only in that window. Ready latch must not start the next deal mid-round or from stale client state. Multiple spectators, dead-hand replacement, BOTOPN, and player-leave must not auto-seat the wrong human.

**Current behaviour:**  
v1.0.54: spectators gated with `betweenRounds` (`server/index.js` ~1961–1967). **Seated players are not gated** — `inRound` seated sockets can set `readyForNextRound[id] = true` at any time; `tryStartNextRoundIfReady` → `startNextRound` does not check `isRoundComplete`. UI normally hides ready behind `roundOver`, but the server handler accepts mid-round ready from seated sockets. Full regression matrix not yet run.

**Impact:**  
Spectator mid-round ready (mitigated). Seated mid-round ready (latent): crafted or stale client could populate the ready map during live play and trigger `startNextRound` if all seated ids ready.

**Files likely involved:**  
`server/index.js` (`playerReadyForNextRound`, `tryStartNextRoundIfReady`, `startNextRound`, `isRoundComplete`), `server/botHostedRooms.js` (`promoteReadySpectators`), `server/tableRoster.js`, `src/screens/GameScreen.tsx` (`RoundCompleteModal`, `onToggleReady`), `src/game/socketAdapter.ts`

**Priority:** P1

**Status:** Open

**Notes:**  
Gameplay Auditor Finding 7 (2026-06-08). Ship seated `betweenRounds` guard alongside spectator guard. Verify spectator paths; add automated regression (multiple spectators, dead-hand swap, BOTOPN, leave mid-ready). Release gate `spectator-promote` covers spectator join path only. Related: dead-hand model in `MULTIPLAYER_ARCHITECTURE.md`.

---

## XP and progression persistence

**Category:** Persistence

**Intended behaviour:**  
Player progression (XP, achievements, unlocks) survives browser reset, PWA reinstall, and device changes via durable identity and server-side truth.

**Current behaviour:**  
Progress is **local / browser dependent** (`playerStats`, device storage) with **optional cloud sync per profile id** where implemented. No full account system. Reinstall or cleared site data can lose or fork progression.

**Impact:**  
Returning players may see reset stats; cross-device play does not share a guaranteed progression source.

**Files likely involved:**  
`src/services/playerStats.ts`, `src/services/playerStatsCloud.ts`, `src/screens/Settings.tsx`, future account service (not present)

**Priority:** P1

**Status:** Open

**Notes:**  
See `GAME_ARCHITECTURE.md` §7 Identity & persistence (future). Not a gameplay change — infrastructure / product track.

---

## Bot-open disconnect model vs standard rooms

**Category:** Multiplayer

**Intended behaviour:**  
Architecture describes pause → reconnect or CPU takeover for seated humans. Behaviour should be predictable across table types unless explicitly exempt.

**Current behaviour:**  
`BOTOPN` (`room.isBotHosted`): on disconnect, human is **immediately demoted to spectator** (`demoteBotTablePlayerToSpectator`), removed from active `gameState`, bots keep playing. `isGamePausedForAway` returns **false** — no match pause. Standard private rooms pause and block `gameAction`.

**Impact:**  
Two disconnect stories; architecture readers may apply standard-room rules to bot tables incorrectly.

**Files likely involved:**  
`server/index.js` (`markPlayerAway`, `demoteBotTablePlayerToSpectator`, `isGamePausedForAway`), `server/botHostedRooms.js`, `GAME_ARCHITECTURE.md` §6 bot-open exception

**Priority:** P2

**Status:** Open

**Notes:**  
May remain intentionally different; if so, promote bot-table rules into a short dedicated subsection and mark this gap **Resolved (by design)** after doc cross-link only. Gameplay Auditor Finding 4 reaffirmed (2026-06-08): immediate demotion removes human from `gameState` mid-round with no pause or grace.

---

## Online pass optimistic local mutation

**Category:** Multiplayer / Client sync

**Intended behaviour:**  
Online clients send play/pass **intent** only; they render the latest authoritative snapshot after server validation and post-action repair (`MULTIPLAYER_ARCHITECTURE.md`, `GAME_ARCHITECTURE.md` WaitingForServer).

**Current behaviour:**  
Play: latch + flight, no local `setState` until sync. **Pass:** `handlePassPress` applies `passTurn` optimistically via `setState` before `broadcastGameAction` (`src/screens/GameScreen.tsx` ~4329–4338). Client state can show trick resolved, different `currentPlayerIndex`, or On Top eligibility before server reconcile → `advancePastInactiveSeats` → `repairStuckTurnPointer`.

**Impact:**  
Brief illegal local state after pass; turn ring / hint can jump early; worsens authoritative vs display desync when server repair diverges from raw `passTurn` output.

**Files likely involved:**  
`src/screens/GameScreen.tsx` (`handlePassPress`, `handlePlayPress`, `actionPending`, `applyServerSync`)  
`server/index.js` (`gameAction`)  
`src/game/core.ts` (`passTurn`)

**Priority:** P2

**Status:** Open

**Notes:**  
Gameplay Auditor Finding 5 (2026-06-08). Presentation-only workaround (pass latch mirroring play) does not close this gap — server-authority contract still violated. Related: **Turn Ownership Invariant** when repair diverges.

---

## Ten-rule chooser server validation

**Category:** Gameplay / Core Rules

**Intended behaviour:**  
During `tenRulePending`, only the player who played the 10 (`tenRuleChooserIndex()` / `lastPlayPlayerIndex`) may set Higher/Lower (`GAME_ARCHITECTURE.md` §5 TenRule, § Turn ownership).

**Current behaviour:**  
`gameAction` ten-rule branch checks `tenRulePending` only; turn gate is `player.id !== currentId` (with ack-pass exception). No compare to `tenRuleChooserIndex()`. `setTenRuleDirection` in core does not validate chooser (`server/index.js` ~1847–1852; `src/game/core.ts` ~730–757).

**Impact:**  
Latent rule violation when `currentPlayerIndex` is corrupted (see **Turn Ownership Invariant**); wrong seat can set pile-wide direction.

**Files likely involved:**  
`server/index.js` (`gameAction`)  
`src/game/core.ts` (`setTenRuleDirection`, `tenRuleChooserIndex`, `playCards` activatingTenRule branch)

**Priority:** P2

**Status:** Open

**Notes:**  
Gameplay Auditor Finding 10 (2026-06-08). Fix is a small server guard; prioritize only if live repro traces here.

---

## Turn Ownership Invariant

**Category:** Gameplay / Core Rules

**Intended behaviour:**  
During active gameplay, `currentPlayerIndex` must always reference a **legal authoritative seat** — a living player who may act on the current trick, or a documented phase exception:

- `tenRulePending` (chooser frozen via `tenRuleChooserIndex`)
- Acknowledgment-pass phase (concurrent ack passes; leader wait)
- Between-rounds / round complete (pointer non-authoritative)
- Room pause on standard online rooms (snapshot frozen; `isGamePausedForAway` blocks actions)

**Current behaviour:**  
Multiple code paths can **assign or preserve** invalid turn ownership and rely on **downstream repair**:

- `nextActivePlayerIndex()` returns `fromIndex` when no seat satisfies `playerCanActInCurrentTrick` — encoding “no valid next player” as a valid index (`src/game/core.ts` ~2782)
- `reconcileCurrentPlayerIndex()` remaps by player id only; can **preserve** an out or passed seat (`server/index.js` ~84–88)
- Several core and server writers assign directly from `nextActivePlayerIndex()` without mandatory trick resolve (`playCards`, `passTurn`, `setTenRuleDirection`, `finalizeTrickWin`, `removePlayerFromActiveGame`, `turnAdvance.js`)
- Server **compensating controls** run after `gameAction`: `advancePastInactiveSeats` → `repairStuckTurnPointer` (`server/index.js` ~1857–1862)
- UI uses `resolveDisplayTurnPlayerIndex` for turn hints while authority uses raw index — desync can show correct “Waiting for…” while bots/server reject play (`CPU_STALL_INVESTIGATION.md`)

**Impact:**  
Late-round stalls (“waiting for out player”), bot turn loop exits without reschedule, and repeated one-off fixes at assignment sites without fixing the shared fallback contract.

**Files likely involved:**  
`src/game/core.ts` (`nextActivePlayerIndex`, `ensureTurnNotOnPriorPasser`, `repairStuckTurnPointer`, `advanceOffPriorPasser`, `playCards`, `passTurn`, `finalizeTrickWin`), `server/index.js` (`gameAction`, `reconcileCurrentPlayerIndex`), `server/turnAdvance.js`, `server/botHostedRooms.js`, `src/screens/GameScreen.tsx` (offline repair + display turn)

**Priority:** P2

**Status:** Documented — reference only

**Notes:**  
Investigation: [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md). **Root cause is the fallback contract**, not individual assignment sites. Mitigations shipped (not closure): pass-path out actor → `advanceOffPriorPasser`; late-round out leader + all living passed → trick finalize (What's New Jun 2026); BOTOPN pass-on-run RC-1 loop reschedule (`repairTurnPointerAndReschedule`, `CPU_STALL_INVESTIGATION.md`). Release gate `turn-headless` passes; live BOTOPN stall gate in `test-release-gate.mjs`. Gameplay Auditor Finding 3 reaffirmed (2026-06-08). Finding 6 (client repair on sync) **not confirmed** in current `GameScreen.tsx`. **Not an active implementation stream:** do not redesign `currentPlayerIndex`, introduce ownership APIs, or expand docs unless a **live bug** traces here. Tests/validation only when supporting that investigation. Future work: see investigation doc § Suggested future work.

---

## Architecture maturity

Short assessment of how well implementation matches documented architecture (as of the gaps above).

### Areas considered stable

| Area | Notes |
|------|--------|
| **Match lifecycle** | Menu → lobby → deal → trade → play loop → last hand → rankings → next round is implemented and documented. |
| **Overlay ownership** | Single primary overlay model (`DealCeremonyOverlay`, trades, 10-rule, last hand, rankings) matches `GameScreen` conditions. |
| **Spectator model** | Join-as-spectator, dead-hand seat, bot-table spectator demotion paths exist and are wired. |
| **Server authority model** | Online play via `gameAction` intent + sync; `gameStateSync` + `stateVersion`; client `actionPending`. Pass still optimistic locally — see gap **Online pass optimistic local mutation**. |
| **On Top rules** | Documented as final action of current trick; `runOnTop` in `core.ts` matches intent in `GAME_ARCHITECTURE.md` §3. |
| **Pass-path out seat** | `passTurn` routes out actor through `advanceOffPriorPasser` (mitigation; does not fix global fallback). |

### Areas still evolving

| Area | Notes |
|------|--------|
| **Turn ownership** | Documented debt only; see gap **Turn Ownership Invariant** (fix on live bug, not proactive refactor). |
| **Ready-for-next-round** | Spectator `betweenRounds` guard shipped; seated server gate and full regression pending (P1). |
| **Disconnect handling** | Pause works on standard rooms; grace duration and presentation do not match intent. |
| **CPU takeover** | Documented target; not implemented for private online games (abort instead). |
| **Persistence** | Local-first XP; cloud partial; accounts not built. |
| **Identity / accounts** | Profile id / socket identity only; no cross-device account recovery. |

Work order: see **Priority order** in Workflow (top of this file).

---

## Related docs

- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) — UI, overlays, On Top, turn ownership intent, disconnect intent
- [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) — server sync, turn advance pipeline, bot tables, dead hand
- [TURN_OWNERSHIP_INVESTIGATION.md](./TURN_OWNERSHIP_INVESTIGATION.md) — turn pointer audit, invariant table, investigation guide
- [CPU_STALL_INVESTIGATION.md](./CPU_STALL_INVESTIGATION.md) — display vs authoritative desync symptom
- [RELEASE_GATE.md](./RELEASE_GATE.md) — automated P0/P1 verification mapping (`npm run test-release-gate`)
- [docs/rules.md](./docs/rules.md) — player-facing rules (validation should follow `core.ts`)
