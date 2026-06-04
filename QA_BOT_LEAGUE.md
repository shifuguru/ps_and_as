# QA Bot League

Autonomous **player-shaped** testers for Presidents & Arseholes — a **hidden easter egg**, not a replacement for normal bot opponents.

## Self-testing ecosystem (what matters)

The loop — not the emoji names:

```text
npm run qa-league
    ↓
reports/qa/latest/AGENT_BRIEF.md
    ↓
Human reviews (no auto-commit)
    ↓
Agent fixes issues
    ↓
npm run qa-league  (regression verification)
```

Personalities are memorable; the loop is useful.

**Do not** auto-commit from league output while multiplayer is still stabilising.

| System | Role | Player perception |
|--------|------|-------------------|
| **CPU bot** (`cpu-1`, `cpu-2`, Amy, Ben) | Opponent — tries to **win** | Normal table |
| **QA League bot** (`qa-*` sockets) | Tester — tries to **break** the game | Odd names, odd timing; “are they even playing?” |

Design reference: [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) (shell, overlays, phases). Server sync: [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md).

**Registry:** `scripts/qa/lib/botRoster.mjs` (personalities + taglines). **Spawn policy (design):** `scripts/qa/lib/spawnRules.mjs`.

---

## Easter egg — discovery

Players are **not** told what the QA League is. Someone stumbles onto a table with emoji names (`🎲 Chaos`, `🔌 Glitch`, …), notices they do not play like Amy/Ben, and slowly realises the table feels like a stress test — **that realisation is the easter egg**.

Discovery cues (intentional, never spelled out in UI copy):

- Strange **emoji + codename** display names (not CPU tier names).
- Behaviour that ignores winning (disconnect spam, ready toggles, instant plays).
- Occasional **rare** appearance in Find Game (future), not every bot table.

**Do not** market this as a feature in What’s New until you want the secret public.

---

## Spawn rules (phased)

| Phase | Behaviour |
|-------|-----------|
| **Now** | Dev only: `PS_QA_LEAGUE=1`, socket runners (`scripts/qa/…`), optional secret codes `QALEG` / `TESTERS` (design constants in `spawnRules.mjs`). |
| **BOTOPN default** | ≥95% normal CPU opponents; QA clients are **extra** sockets, not `cpu-*` seat takeover. |
| **Later** | Rare public league tables, events, night windows, achievement for “finding the league”. |

Weights and flags: `SPAWN_WEIGHTS`, `SPAWN_GATES` in `scripts/qa/lib/spawnRules.mjs`.

---

## Hidden purpose (developers only)

Behind the funny names:

- **Coverage metrics** — per-personality owners (`coverageMetrics.mjs`).
- **Invariant engine** — structured failures on bad sync / flow (see schema below).
- **Gap reports** — overnight fail on critical/high metrics below `minExpected`.

Players get personality; developers get signal.

---

## Future possibilities (non-binding)

- Achievement: discover the QA League.
- Hidden lore / codex entries (taglines in `botRoster.mjs`).
- Developer commentary mode on failure bundles.
- Stats: “bugs found per bot”.
- Cosmetic reward for playing a full game against all eight.

---

## Design principle

```text
CPU Bot  = tries to win the game
QA Bot   = tries to break the game
```

QA bots use the **same socket surface as humans** (`joinRoom`, `gameAction`, `playerReadyForNextRound`, disconnect/reconnect). They do **not** call `applyCpuTurn` directly.

Loop per bot:

```text
observe state → choose objective (personality) → perform action → validate invariants → record coverage → report anomalies
```

---

## Coverage tracking (required)

Without coverage, the league is just a **random-action generator** that passes while never exercising the path that broke in production. Every run records **metric counts** and **ownership** so gaps name the bot to tune.

**Registry:** `scripts/qa/lib/coverageMetrics.mjs` (metric key, owner, gap severity, default `minExpected`).

### Coverage ownership (rogue crew)

Each metric has one **owner** bot. Low count → adjust **that** bot’s schedule, not “run more Chaos.”

| Emoji | Name | Primary mission | Coverage targets |
| ----- | ---- | ----------------- | ------------------ |
| ⚡ | Flash | Stress speed and race conditions | `turn_progression`, `rapid_ready`, `rapid_trades` |
| 🐢 | Tank | Stress delays and waiting states | `timeout_paths`, `waiting_for_server` |
| 👀 | Scout | Spectator lifecycle | `spectator_join`, `dead_hand_claim`, `spectator_promotion` |
| 🔌 | Glitch | Connection instability | `reconnect_mid_turn`, `reconnect_during_rankings`, `reconnect_during_trades` |
| 🎲 | Chaos | Broad exploration | `*` (all metrics; does not replace owner on gap reports) |
| 🃏 | Joker | Rule edge cases | `ten_rule`, `joker_ack`, `four_kind_ack`, `runs` |
| 🔨 | Breaker | Invalid behaviour | `duplicate_actions`, `invalid_actions`, `stale_state_version` |
| 🔄 | Loop | Round transitions | `ready_toggle`, `next_round_start`, `rankings_ready` |

Counters increment when the **observer** sees evidence in sync/events (not when a bot only “intended” to trigger something).

### Gap severity (overnight fail rules)

| Severity | Metrics (examples) | Overnight run |
| -------- | ------------------- | ------------- |
| **Critical** | `reconnect_during_rankings`, `spectator_promotion`, `next_round_start` | **Fail** if below `minExpected` |
| **High** | `role_trades`, `ten_rule`, `dead_hand_claim`, `reconnect_mid_turn`, … | **Fail** if below `minExpected` |
| **Medium** | `joker_ack`, `four_kind_ack`, `runs`, `invalid_actions`, … | Warn only |
| **Low** | `turn_progression`, `rapid_ready`, … | Warn only |

### Actionable gap report

```text
Coverage Report
⚠ reconnect_during_rankings: 0 / 5   Owner: 🔌 Glitch
⚠ dead_hand_claim: 1 / 10          Owner: 👀 Scout
✓ joker_ack: 87 / 20                 Owner: 🃏 Joker
```

Programmatic: `buildGap()` + `formatGapReportLines()` in `coverageMetrics.mjs`. JSON includes `owner`, `ownerDisplay`, `gapSeverity`, `failOvernight`.

### Logging (long runs)

Use emoji-prefixed lines so 3am logs are scannable:

```text
[⚡ Flash] Played instantly
[👀 Scout] Claimed dead hand
[🔌 Glitch] Disconnected during rankings
[🃏 Joker] Triggered 10-rule
[🔨 Breaker] Sent duplicate Play
[🔄 Loop] Ready → Unready → Ready
```

`qaLog('disconnect', 'Disconnected during rankings')` → `[🔌 Glitch] …` (`botRoster.mjs`).

### Storage (phases)

| Phase | Storage |
|-------|---------|
| 0–1 | JSONL per run + `coverage-summary.json` |
| 2 | Nightly dashboard + critical/high gap fail |
| 2.5 | Per-failure bundle under `reports/qa/` (see below) |
| 3 | Optional POST to dev endpoint |

---

## Rogue tester crew (QA bot names)

**Theme:** a small crew of malicious testers — not opponents. In the lobby and at the table, every QA bot’s **display name starts with its emoji** so you can spot them instantly (vs **Amy** / **Ben** CPU hosts).

**Canonical registry:** `scripts/qa/lib/botRoster.mjs` (`displayName`, `qaProfileId`, `codename`).

| Emoji | Codename | Tagline | Primary mission | Phase |
| ----- | -------- | ------- | ----------------- | ----- |
| ⚡ | **Flash** | “Speed solves everything.” | Speed and race conditions | 1 |
| 🐢 | **Tank** | “Still thinking...” | Delays and waiting states | 1 |
| 👀 | **Scout** | “Just observing.” | Spectator lifecycle | 1 |
| 🔌 | **Glitch** | “Connection unstable.” | Connection instability | 1 |
| 🎲 | **Chaos** | “No plan survives contact.” | Broad exploration | **0** |
| 🃏 | **Joker** | “The rules are more like guidelines.” | Rule edge cases | 1 |
| 🔨 | **Breaker** | “If it can break, I will find it.” | Invalid behaviour | 1 |
| 🔄 | **Loop** | “Ready. Not ready. Ready.” | Round transitions | 1 |

Detailed targets: **Coverage ownership** table above.

### Naming rules

| Field | Convention | Example |
|-------|------------|---------|
| **Display name** (`joinRoom.name`) | `{emoji} {Codename}` | `🎲 Chaos`, `🔌 Glitch` |
| **Profile id** | `qa-{id}-{instance}` | `qa-chaos-1` |
| **Reports** | `personality` = roster `id` | `chaos`, `disconnect` |
| **CPU opponents** | Unchanged | `cpu-1`, `cpu-2`, **Amy**, **Ben** |

Do **not** use `cpu-*` profile ids for QA bots — that blurs them with server CPU opponents.

CPU seats on the table remain **`cpu-1` / `cpu-2`**; QA bots are extra socket clients (or spectators on BOTOPN).

**Phase 3:** Playwright “Mobile” runner is tooling, not a league seat at the table.

---

## Invariant engine

Runs on every `gameStateSync` and selected events. Failures produce structured reports.

### Report schema

```json
{
  "severity": "medium",
  "area": "CentrePlayArea",
  "checkLayer": "sync",
  "phase": "PLAYING",
  "expected": "stateVersion increases after gameAction",
  "actual": "stateVersion unchanged for 32s",
  "reproducible": true,
  "build": "1.0.46",
  "room": "BOTOPN",
  "stateVersion": 245,
  "botId": "qa-chaos-1",
  "displayName": "🎲 Chaos",
  "personality": "chaos",
  "ts": "2026-06-03T18:00:00+12:00"
}
```

`checkLayer`: `sync` | `rules` | `flow` | `ui-proxy` (v1) | `ui-visual` (v3 Playwright).

### Core invariants (starter set)

- `stateVersion` monotonic per observer
- Hand counts valid; no duplicate cards (when visible)
- Exactly one president / one asshole in roles when assigned
- Round completes within bounded time on bot table
- Next round starts after all seated ready (or bot-table rules)
- No turn unchanged > 30s while round in progress (soft-lock)
- **Flow:** `roundEnded` with `lastPlayerHand` when last player had cards
- **Flow:** client trail should not show “rankings before last hand” (online regression test)

---

## Fragile areas (prioritise coverage + invariants)

Align bots and metrics with these:

1. Round-complete ordering (last hand → rankings)
2. Last hand / rankings / ready / next deal
3. Centre Play Area (proxy in v1; visual in v3)
4. Pill positioning, z-order, empty pile (v3)
5. Trick winner banner (v3)
6. `stateVersion`, reconnect, spectator, dead-hand claim
7. Bot table lifecycle — human join/leave, room persists, bots continue

---

## Implementation phases

### Phase 0

- [x] **🎲 Chaos** (`qa-chaos-*`) — socket client, random play/pass/ready (`personalities/chaos.mjs`)
- [x] **Invariant engine** — starter invariants + JSON reports (`lib/InvariantEngine.mjs` → `reports/qa/…/invariants.jsonl`)
- [x] **Coverage counters** — per-run summary (`lib/CoverageTracker.mjs` → `coverage-summary.json`)
- [x] **`botRoster.mjs`** — emoji display names + profile ids + taglines
- [x] Script: `npm run qa-chaos` → `scripts/qa/run-chaos.mjs` (BOTOPN or QALEG, `--minutes`)
- [x] Secret room **QALEG** when server `PS_QA_LEAGUE=1` (`server/qaLeagueRooms.js`)
- [x] Docs linked from GAME_ARCHITECTURE

### Phase 1

- [ ] **🔌 Glitch**, **👀 Scout** — disconnect + spectator paths
- [ ] **⚡ Flash**, **🐢 Tank**, **🃏 Joker**, **🔨 Breaker**, **🔄 Loop**
- [ ] **Coverage metrics** — rolling aggregation, gap warnings vs `minExpected`
- [ ] CI or nightly: fail on high-severity invariant or critical gap

### Phase 2

- [ ] Multiple tables (4–5 rooms), 8 QA + CPU clients
- [ ] Continuous overnight runs
- [ ] **Dashboard** — 24h coverage + anomaly count + owner-tagged gaps
- [ ] Fail build if **critical** or **high** metric below `minExpected`

### Phase 2.5 — Failure replay (before Playwright)

When **🔌 Glitch** (or any bot) finds a failure at 3am, export a repro bundle:

```text
reports/qa/<runId>-<botId>/
├── failure.json      # invariant report schema
├── timeline.json     # ordered events (socket + actions + phases)
├── stateVersions.jsonl  # stateVersion timeline with snapshots refs
└── replay.json       # machine-readable replay script (re-emit sequence)
```

Components:

- **Failure recorder** — snapshot last N syncs + pending actions on invariant fail
- **Event timeline** — `joinRoom`, `gameAction`, `roundEnded`, disconnect, …
- **StateVersion timeline** — monotonic check + jump highlights
- **Replay export** — `node scripts/qa/replay.mjs reports/qa/.../replay.json`

Saves more debug time than the dashboard alone.

### Phase 3

- [ ] **Playwright** on web build
- [ ] Screenshot / DOM overlap — Centre Play Area
- [ ] Catches rendering-only bugs (e.g. pill behind avatar) that sockets cannot see

---

## Repo layout (target)

```text
scripts/qa/
  lib/
    botRoster.mjs         # emoji names, taglines, qaLog(), qaProfileId()
    spawnRules.mjs        # easter-egg spawn weights + dev/secret gates
    coverageMetrics.mjs   # owners, gap severity, buildGap()
    QABotClient.mjs         # socket.io wrapper
    InvariantEngine.mjs     # Phase 0 starter checks
    CoverageTracker.mjs     # Phase 0 counters
    FailureRecorder.mjs   # Phase 2.5
    personalities/
      chaos.mjs           # Phase 0
      disconnect.mjs
      spectator.mjs
      ...
  run-chaos.mjs           # Phase 0 entry (npm run qa-chaos)
  run-league.mjs
  aggregate-coverage.mjs
  replay.mjs              # Phase 2.5
reports/qa/               # gitignored JSONL + failure bundles
```

Existing integration tests remain (`test-bot-table-lifecycle.mjs`, etc.); league is broader and continuous.

---

## Autonomous runs (agent iteration)

Bots run without human input and publish a report for Cursor to fix the app:

```bash
npm run server
npm run qa-league                    # all implemented bots in parallel (~10m each)
npm run qa-league:watch              # repeat every 30 minutes
npm run qa-chaos                     # single 🎲 Chaos bot
```

**Agent reads (stable path):**

| File | Purpose |
|------|---------|
| `reports/qa/latest/AGENT_BRIEF.md` | Priority action items + file hints |
| `reports/qa/latest/agent-report.json` | Machine-readable full report |
| `reports/qa/latest/PROMPT.txt` | Paste into agent chat |

Implemented drivers today: `chaos`, `speed` (⚡ Flash), `ready_spam` (🔄 Loop), `exploit` (🔨 Breaker).

**Phase 1 roster (stop here for now):** add **👀 Scout** next (dead hand, spectators, promotion, ready) — not Glitch/Tank/Joker until those five are stable.

**Future (not Phase 1):** Bug Hall of Fame (`bugs found per bot`), rare in-world league table, player-facing easter egg discovery.

**Regression target:** league should flag `bot_cpu_stall` (high) if BOTOPN CPUs stop acting after pass-on-run / round-transition bugs.

After you fix code: restart server → `npm run qa-league` → re-read brief until `status: pass`.

---

## How to brief Cursor

```text
Run npm run qa-league, read reports/qa/latest/AGENT_BRIEF.md, fix P0 items, re-run.
```

```text
Add coverage metric: run_on_top when state.runOnTop.active becomes true.
```

```text
Do not improve CPU card AI — QA bot only.
```

---

## Related

- [GAME_ARCHITECTURE.md](./GAME_ARCHITECTURE.md) — player phases and ownership
- [MULTIPLAYER_ARCHITECTURE.md](./MULTIPLAYER_ARCHITECTURE.md) — authority and events
- `scripts/test-bot-table-lifecycle.mjs` — precursor smoke test (not a league)
