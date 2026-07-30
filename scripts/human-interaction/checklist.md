# Human Interaction — Evidence Checklist

**Attach video + console from the same session.** Incomplete packages do not advance to implementation.

Evidence folder (create as needed):

```text
scripts/human-interaction/evidence/QA-006/
scripts/human-interaction/evidence/QA-008/
```

---

## Session meta

| Field | Value |
|-------|-------|
| Date / time (NZ) | |
| Build / version | |
| Platform | [ ] Desktop [ ] Mobile PWA [ ] Other |
| Mode | [ ] BOTOPN [ ] Hosted [ ] Reconnect [ ] Spectator |
| Browser / device | |
| Recording file | |
| Console export file | |

---

## QA-006 — Last player still plays

### Visual proof (required)

- [ ] Video/GIF attached
- [ ] Shows: one player remains
- [ ] Shows: Play button **enabled** (on screen)
- [ ] Shows: successful Play
- [ ] Shows: round ends after Play

**Video timestamp (Play press):** __:__  
**Video timestamp (round end):** __:__

### Console (required, same session)

- [ ] `[ROUND] SYNC_RECEIVED` with `roundComplete=true roundOver=false`
- [ ] `[PLAY] PLAY_ATTEMPT` with `roundComplete=true roundOver=false`
- [ ] `[PLAY] E5_VERIFIED`
- [ ] `[ROUND] ROUND_ENDED` after play

### Timeline (required)

| Time (video or log) | Event |
|---------------------|-------|
| | Last opponent goes out |
| | `[ROUND] E5_CANDIDATE` or sync |
| | Play button visibly enabled |
| | Player presses Play |
| | `[PLAY] E5_VERIFIED` |
| | Round ends |

### Severity

- [ ] Annoyance — extra click, round still correct
- [ ] Confusing — player unsure if round ended
- [ ] Blocking — soft-lock or wrong result

| Field | Value |
|-------|-------|
| **E5 VERIFIED** | [ ] Yes [ ] No |
| **Implementation approved** | [ ] Yes [ ] No — blocked until E5 |

Notes:

---

## QA-008 — Double flight

### Visual proof (required — pick A or B)

**Option A — Video**

- [ ] Video/GIF attached
- [ ] Visible flight restart or duplicate mid-air

**Option B — Frames**

- [ ] Frame capture showing **two visible** flights, same card/play
- [ ] Frames attached

**If only one visible flight on video:** mark **Architecture duplication — not player-visible** → **do not implement**.

### Console (required, same session)

- [ ] `[FLIGHT] CREATED` (note sources)
- [ ] `[FLIGHT] E5_VERIFIED` (if present)
- [ ] `[FLIGHT] STARTED` count: ___

### Timeline (required)

| Time | Event |
|------|-------|
| | Play pressed |
| | First visible motion |
| | Second visible motion (if any) |
| | Land |

### Severity (only if visually confirmed)

- [ ] Annoyance
- [ ] Confusing
- [ ] Blocking

| Field | Value |
|-------|-------|
| **Player-visible double flight** | [ ] Yes [ ] No |
| **E5 VERIFIED** | [ ] Yes [ ] No |
| **Classification** | [ ] Player-visible bug [ ] Architecture duplication only |
| **Implementation approved** | [ ] Yes [ ] No |

Notes:
