# Mission Control — Freshness Ownership

**Status:** Adopted · manual + validation (automation deferred)

## Problem this solves

Mission Control freshness **calculations are correct** — the process failed when alignment changed six canonical files but `projectStateUpdatedAt` stayed at a prior placeholder. Freshness must have a **single owner**, explicit **update rules**, and **drift detection** so stale warnings cannot lie silently.

---

## 1. What counts as "project state"

Project state = **Mission Control's understanding of priorities, blockers, work, release posture, and near-term direction**.

| Tier | Files | Role |
|------|-------|------|
| **Canonical state** | `work_items.json`, `release_status.json`, `roadmap.json`, `director_brief.md`, `objectives.json`, `dashboard.json` (substance), `agent_status.json`, `agent_queue.json`, `activity.jsonl`, `decisions.md` | Changes here alter what the studio *believes* is true |
| **Strategy (slow)** | `directives.md` | Director standing orders — project state when strategy changes (rare) |
| **Intake / memory (not state until promoted)** | `inbox.md`, `bugs.md`, `product_notes.md`, `style_notes.md` | Capture and reference — do **not** alone move project state |
| **Generated / operational (not state)** | `active_work.json` | Derived from `work_items.json` |
| **Live slots (separate clocks)** | `metrics.json` | Telemetry placeholders — not project understanding |

`ARCHITECTURE_GAPS.md` is **engineering truth**, not studio state. Link via `gapId`; gap edits do not bump `projectStateUpdatedAt` unless mirrored into studio files above.

---

## 2. What updates `projectStateUpdatedAt`

**Rule:** Any session or commit that changes **canonical state** (Tier 1) must bump `dashboard.json` → `projectStateUpdatedAt` to that session's completion time (ISO UTC).

| Trigger | Examples |
|---------|----------|
| Alignment / reconciliation | Audit applied to dashboard, brief, work items, roadmap, release_status |
| Work item lifecycle | Status, priority, assignee, blockedReason, new item, completion |
| Release posture | `release_status.json` blockers, deploy notes, gate summary (not `lastReleaseGateAt` alone — see below) |
| Roadmap / objectives | Phase status, exit criteria, objective success criteria |
| Director brief | Tactical blockers, next actions for the day |
| Fleet | `agent_status.json`, `agent_queue.json` assignment changes |
| Decisions | Product/architecture decision recorded in `decisions.md` |
| Substantive activity | Append to `activity.jsonl` when it reflects state change (alignment, work completed, reclassification) |
| Strategy | `directives.md` change — **Studio Director** only; Orchestrator bumps timestamp after Director confirms |

**Same session, multiple files:** one timestamp at **end of session** (not per file).

---

## 3. What does NOT update `projectStateUpdatedAt`

| Change | Why excluded | Correct field |
|--------|--------------|---------------|
| `npm run test-release-gate` completes | Operational validation clock | `lastReleaseGateAt` (+ `release_status.json` `gate.lastRun.at`) |
| Deploy / publish | Build clock | `lastDeploymentAt` |
| Human multiplayer playtest | QA clock | `lastHumanPlaytestAt` |
| `inbox.md`, `bugs.md`, `product_notes.md`, `style_notes.md` | Intake until promoted | — |
| `active_work.json` | Generated | — |
| `metrics.json` poll / placeholder | Live metrics | — |
| `directives.md` draft without Director approval | Not yet authoritative | — |
| Typos / formatting-only in memory notes | No understanding change | — |
| `dashboard.json` **only** bumping timestamps | Circular — timestamp follows substance | — |

**Important:** Editing `release_status.json` for a gate run updates **`lastReleaseGateAt`**. It updates **`projectStateUpdatedAt`** only when release *posture* or blockers change (Orchestrator judgment: if you'd tell the Director something new, bump project state).

---

## 4. Owner

| Field | Owner | Notes |
|-------|-------|-------|
| **`projectStateUpdatedAt`** | **Orchestrator** | Mandatory at end of every alignment / canonical studio edit session |
| `lastReleaseGateAt` | **Release Agent** (Orchestrator writes file) | After every gate run |
| `lastDeploymentAt` | **Release / deploy pipeline** (human until CI) | Deploy timestamp, not commit time |
| `lastHumanPlaytestAt` | **Studio Director or Regression Agent** | After documented human QA session |
| Strategy in `directives.md` | **Studio Director** | Orchestrator bumps project state after Director approval |

**Single owner for project-state freshness:** **Orchestrator** — not the Director, not validation scripts, not build scripts. Others may *request* updates; Orchestrator (or agent acting as Orchestrator) **writes** `projectStateUpdatedAt`.

Validation **detects** drift; it does not **set** timestamps.

---

## 5. How freshness is maintained (recommended approach)

| Option | Verdict |
|--------|---------|
| A. Manual only | **Insufficient** — caused June alignment drift |
| B. Validation warning | **Adopt now** — `studio:validate` warns when canonical files are newer than `projectStateUpdatedAt` |
| C. Sync script | **Phase 2** — `studio:sync-freshness` sets operational clocks from `release_status` + activity; optional max-timestamp for project state |
| D. Auto-generated timestamp | **Phase 3** — only after B proves stable; never replace Orchestrator judgment for *whether* state changed |

**Current model: B + A**

1. Orchestrator **manually** sets `projectStateUpdatedAt` at end of every canonical session (checklist item).
2. `npm run studio:validate` **warns** if drift detected (cannot pass silently).
3. Mission Control **banner** remains the Director-facing stale signal (>3 days).

---

## Source of truth

| Concern | Source |
|---------|--------|
| Project state freshness instant | `studio/dashboard.json` → `projectStateUpdatedAt` |
| Update rules | This file + `studio/README.md` |
| Drift detection | `scripts/studio/validate-studio.mjs` |
| UI thresholds | `src/studio/freshness.ts` |

No other file owns `projectStateUpdatedAt`. Fallback to `dashboard.updatedAt` is **legacy only** for unmigrated mirrors.

---

## Orchestrator checklist (end of session)

After editing any canonical state file:

1. Apply substantive changes across studio files
2. Set `dashboard.json` → `projectStateUpdatedAt` = **now** (ISO UTC)
3. Set `dashboard.json` → `updatedAt` = same instant (or file save time)
4. Append `activity.jsonl` (`studio.alignment`, `work.status_changed`, etc.)
5. Run `npm run studio:sync-active-work` if `work_items.json` changed
6. Run `npm run studio:validate` — **resolve any project-state drift warnings**
7. Run `npm run studio:copy-public` for local dev mirror

---

## Migration plan

| Step | Action | Status |
|------|--------|--------|
| 1 | Adopt this ownership model | Done |
| 2 | Add drift validation to `studio:validate` | Done |
| 3 | Bump `projectStateUpdatedAt` to current reconciliation time | Done |
| 4 | Document in `studio-orchestrator.mdc` | Done |
| 5 | Sync `public/studio/` | Run `npm run studio:copy-public` after dashboard edits |
| 6 | Phase 2: `studio:sync-freshness` for operational clocks | Planned |
| 7 | Phase 3: optional auto max-timestamp for project state | Planned |

---

## Future automation (not implemented)

When approved:

- **`studio:sync-freshness`** — set `lastDeploymentAt`, `lastReleaseGateAt`, `lastHumanPlaytestAt` from `release_status.json` + latest `human.playtest` in `activity.jsonl`; **never** auto-set `projectStateUpdatedAt` without Orchestrator flag
- **CI** — deploy job sets `lastDeploymentAt`; gate job sets `lastReleaseGateAt`
- **Optional** — `--bump-project-state` flag on sync script after alignment sessions only
