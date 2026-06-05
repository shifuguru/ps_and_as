# Architecture gaps

Living register of differences between **documented intent** ([GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md), [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md), [docs/rules.md](./docs/rules.md)) and **current implementation**.

Use this file to drive engineering work — not conversation memory.

**Authority:** `ARCHITECTURE_GAPS.md` tracks **reality**. [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) and [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) describe **intent**. Close gaps; do not duplicate intent here.

## Workflow (required before new architecture or refactors)

1. **Read** this file.
2. **Check** whether the issue is already a documented gap.
3. **If yes:** update `Status` → investigate → implement → mark `Resolved` when shipped.
4. **If no:** add a new gap entry **first**, then investigate.

**Do not:**

- Create new architecture documents unless explicitly requested.
- Redesign systems that already have architecture docs.
- Add QA personalities, new diagrams, or extra documentation instead of closing gaps.

**Prefer:** closing documented gaps over introducing new features.

**Success metric:** reduce the number of **Open** gaps.

**Current focus:** gameplay and multiplayer stability.

### Priority order

| Priority | Gaps |
|----------|------|
| **P0** | CPU takeover after disconnect; Returning player after timeout; Rankings before last hand (online) |
| **P1** | Disconnect timeout; XP and progression persistence |
| **P2** | Pause state presentation; Bot-open disconnect model vs standard rooms |

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
Align server constant, broadcast `gracePeriod`, and any player-facing strings together.

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
Depends on disconnect timeout policy. Bot-open tables (`BOTOPN`) use a different path today (see gap below).

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
Ship together with CPU takeover. Until then, document player-facing messaging that the game may end after the grace window.

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

**Status:** Resolved

**Notes:**  
v1.0.46 Fix #1 + v1.0.51 reconnect replay. Optional: remove `ROUND_TRANSITION_LOG` after manual UI verification.

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
May remain intentionally different; if so, promote bot-table rules into a short dedicated subsection and mark this gap **Resolved (by design)** after doc cross-link only.

---

## Architecture maturity

Short assessment of how well implementation matches documented architecture (as of the gaps above).

### Areas considered stable

| Area | Notes |
|------|--------|
| **Match lifecycle** | Menu → lobby → deal → trade → play loop → last hand → rankings → next round is implemented and documented. |
| **Overlay ownership** | Single primary overlay model (`DealCeremonyOverlay`, trades, 10-rule, last hand, rankings) matches `GameScreen` conditions. |
| **Spectator model** | Join-as-spectator, dead-hand seat, bot-table spectator demotion paths exist and are wired. |
| **Server authority model** | Online play/pass via `gameAction`; `gameStateSync` + `stateVersion`; client `actionPending` / no local `playCards` when online. |
| **On Top rules** | Documented as final action of current trick; `runOnTop` in `core.ts` matches intent in `GAME_ARCHITECTURE.md` §3. |

### Areas still evolving

| Area | Notes |
|------|--------|
| **Disconnect handling** | Pause works on standard rooms; grace duration and presentation do not match intent. |
| **CPU takeover** | Documented target; not implemented for private online games (abort instead). |
| **Persistence** | Local-first XP; cloud partial; accounts not built. |
| **Identity / accounts** | Profile id / socket identity only; no cross-device account recovery. |

Work order: see **Priority order** in Workflow (top of this file).

---

## Related docs

- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) — UI, overlays, On Top, disconnect intent
- [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) — server sync, bot tables, dead hand
- [docs/rules.md](./docs/rules.md) — player-facing rules (validation should follow `core.ts`)
