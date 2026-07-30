# Human Interaction Agent (primary owner — QA-006, QA-008)

**Mission:** Produce **player-visible proof** of presentation/sync defects. Simulation and code-path analysis are supporting evidence only.

## Non-negotiable rule

```text
Investigation → Implementation
```

requires **all** of:

1. **Player-visible reproduction** (video or GIF)
2. **Console capture** from the same session
3. **Exact timeline** (written, correlated to video timestamps)
4. **Severity assessment** (annoyance / confusing / blocking)

Console logs alone — including automated `[PLAY] E5_VERIFIED` / `[FLIGHT] E5_VERIFIED` markers — are **insufficient** for E5 or for implementation approval.

---

## Required outputs

### Desktop

| Deliverable | Format |
|-------------|--------|
| Screen recording | MP4 / WebM / GIF (full repro, not cropped) |
| Console capture | DevTools export or copy-paste in `evidence/` folder |

### Mobile / PWA

| Deliverable | Format |
|-------------|--------|
| Screen recording | Device recording or screencast |
| Console | Safari Web Inspector / Chrome remote debug if available |

### Multiplayer modes

- **BOTOPN / Quick Game** (online)
- **Hosted private room** (2+ humans ideal for QA-006)

---

## QA-006 — Last player still plays

### Video must show

```text
One player remains
→ Play button still enabled (visible)
→ Player successfully plays a card
→ Round ends afterwards
```

### Console must include (same session)

```text
[PLAY] E5_VERIFIED
```

(preceded by `[ROUND] E5_CANDIDATE` or `roundComplete=true roundOver=false` in `[PLAY] PLAY_ATTEMPT`)

### Steps

1. Enable logs (`ENABLE_MULTIPLAYER_PRESENTATION_VERIFY = true` in `multiplayerPresentationVerify.ts`).
2. Start **screen recording** before joining table.
3. Play until one opponent remains; when they go out, **do not stop recording**.
4. If Play is enabled, play one card.
5. Stop recording after round ends / rankings.
6. Export console; fill `checklist.md`; attach files under `scripts/human-interaction/evidence/QA-006/`.

---

## QA-008 — Double flight

### Video must show (Option A)

```text
Card begins flight
→ Flight visibly restarts OR visibly duplicates
```

### Or frame capture (Option B)

Two **visible** flying copies of the same card for one play, plus console:

```text
[FLIGHT] E5_VERIFIED
```

### Critical interpretation

| Observation | Classification | Action |
|-------------|----------------|--------|
| Video shows double animation + matching logs | Player-visible bug | E5 → implementation may proceed |
| Logs show two CREATED, video shows **one** smooth flight | Architecture duplication | **Do not patch** — monitor |
| Cannot reproduce visually after 3+ sessions | Not verified | Keep open, monitoring |

### Steps

1. Start recording **before** pressing Play.
2. Online seated human — one card from hand (BOTOPN or hosted).
3. Review recording frame-by-frame if motion looks single but report said double.
4. Export console; fill checklist; attach under `evidence/QA-008/`.

---

## Tooling

| Tool | Use |
|------|-----|
| OBS / Win+G / QuickTime | Screen recording |
| Browser DevTools → Console → Save as… | Log export |
| `checklist.md` | Per-session metadata |
| Playwright headed (optional) | Repeatable navigation only — **not** a substitute for human video |

---

## Evidence quality bar

| Quality | Accept for E5? |
|---------|----------------|
| Code review / duplicate creators | No (E1–E3) |
| Console only | No |
| Video without logs | No |
| Video + logs + timeline + severity | **Yes** |

---

## Simulation agents (supporting only)

| Agent | Role |
|-------|------|
| `test-core`, offline sim | Rules authority — not presentation |
| Release gate | Regression — not visual |
| `explore-gameplay-edge` | Engine edge cases — offline |

Do not promote QA-006 / QA-008 to implementation based on simulation output alone.

---

## When done

Update `QA006_QA008_VERIFICATION.md` and `ARCHITECTURE_GAPS.md` gap rows with E5 + evidence paths.

Until then: **no fixes for QA-006 or QA-008.**
