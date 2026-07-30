# QA-006 / QA-008 — Verification (visual proof required)

**Decision gate:** No issue moves Investigation → Implementation without **player-visible reproduction** (video/GIF) **and** matching console logs.

Console-only evidence = **E1–E3** (code path / log markers).  
**E5 VERIFIED** = video/GIF + matching logs + timeline + severity.

Instrumentation: `src/utils/multiplayerPresentationVerify.ts` (temporary).

---

## Decision gate (orchestrator)

| Requirement | QA-006 | QA-008 |
|-------------|--------|--------|
| Player-visible reproduction (video/GIF) | **Missing** | **Missing** |
| Console evidence | Instrumentation ready | Instrumentation ready |
| Exact timeline | Template in checklist | Template in checklist |
| Severity assessment | Pending repro | Pending repro |
| **Implementation approved** | **No** | **No** |

If visual reproduction cannot be obtained: **keep open, do not patch, continue monitoring.**

---

## Log markers vs evidence tier

Console tags `[PLAY] E5_VERIFIED` and `[FLIGHT] E5_VERIFIED` are **automated log markers** for Human QA to correlate with video — they are **not** project E5 classification by themselves.

| Tier | Meaning |
|------|---------|
| **E1–E3** | Code path, architecture duplication, log markers without video |
| **E5 VERIFIED** | Video/GIF + matching logs + written timeline |

---

## QA-006 — Last player still plays

| Field | Status |
|-------|--------|
| **Evidence tier** | **E1–E3** (suspected client gating race — online `roundOver` waits for `roundEnded`) |
| **E5 VERIFIED** | **No** — no player-visible capture |
| **Classification (provisional)** | Client presentation / gating race — **unconfirmed visually** |
| **Implementation** | **Blocked** |

### Required proof package

**Video or GIF** showing:

```text
One player remains
→ Play button still enabled
→ Player successfully plays
→ Round ends afterwards
```

**Plus** console containing `[PLAY] E5_VERIFIED` in the same session (export attached to video).

### Supporting code-path notes (not proof)

- Offline: `setRoundOver(true)` on `isRoundCompleteForLiving` in `GameScreen`.
- Online: `roundOver` set on `roundEnded` only; Play gated by `roundOver`, not `roundComplete`.
- Logs: `[ROUND] SYNC_RECEIVED`, `[ROUND] E5_CANDIDATE`, `[PLAY] PLAY_ATTEMPT`.

**Owner:** Human Interaction Agent (`scripts/human-interaction/`).

---

## QA-008 — Double flight

| Field | Status |
|-------|--------|
| **Evidence tier** | **E1–E3** — two flight **creators** exist (`commitHumanPlayWithFlight` + `GamePlayArea`) |
| **E5 VERIFIED** | **No** — duplicate specs ≠ duplicate visible animation |
| **Classification (if logs only)** | **Architecture duplication** — not a player-visible bug |
| **Implementation** | **Blocked** |

### Required proof package (one of)

**Option A — Video:** Card begins flight → flight visibly restarts or duplicates.

**Option B — Frame capture:** Two visual flights for the same `playKey` + `[FLIGHT] E5_VERIFIED` in console.

**If logs show duplication but video does not:** classify as architecture duplication; **stop implementation work.**

### Supporting code-path notes (not proof)

- Online local-hand play may emit two `[FLIGHT] CREATED` with different sources.
- That may dedupe to one rendered animation — **must be confirmed on screen**.

**Owner:** Human Interaction Agent.

---

## Human Interaction Agent (primary owner)

Simulation agents (`test-core`, release gate, `explore-gameplay-edge`) are **supporting only**.

Deliverables per issue:

1. Screen recording (desktop and/or mobile PWA)
2. Console export (same session, timestamps aligned to video)
3. Completed checklist (`scripts/human-interaction/checklist.md`)
4. Severity: annoyance / confusing / blocking

Modes to exercise: **BOTOPN**, **hosted room** (reconnect optional).

---

## Instrumentation reference

| Event | Tag |
|-------|-----|
| Sync | `[ROUND] SYNC_RECEIVED` |
| Round end | `[ROUND] ROUND_ENDED` |
| Play | `[PLAY] PLAY_ATTEMPT` |
| Flight | `[FLIGHT] CREATED` / `STARTED` / `LANDED` / `REMOVED` |
| Markers | `[ROUND] E5_CANDIDATE`, `[PLAY] E5_VERIFIED`, `[FLIGHT] E5_VERIFIED` |

Remove instrumentation after fix ships or issue closed as non-repro.
