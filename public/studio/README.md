# Studio Mission Control

Operational command centre for the Presidents & Assholes studio — **not** a bug tracker.

## URL

- Production: `https://shifuguru.github.io/ps_and_as/mission-control`
- Local dev: `http://localhost:8081/ps_and_as/mission-control` (after `npm run web`)

## Source of truth (Phase 2A)

| File | Purpose |
|------|---------|
| `directives.md` | **Strategy** — priority order, do-not-work-on, delegation rules |
| `objectives.json` | **Why** — current objectives + success criteria |
| `work_items.json` | **What** — canonical structured tasks (`approvedForImplementation`) |
| `agent_queue.json` | Work approved for delegation, not yet assigned |
| `agent_status.json` | Agent fleet state |
| `director_brief.md` | **Today** — 30-second tactical overview |
| `active_work.json` | **Generated** from `work_items.json` (Phase 1 UI kanban) |
| `dashboard.json` | Above-the-fold summary + productHealth |
| `backlog.json` | Intake before promotion to work items |
| `roadmap.json` | Phases |
| `release_status.json` | Gate results and deploy posture |
| `metrics.json` | Live + placeholder metrics |
| `activity.jsonl` | Append-only event log |
| `inbox.md` | Fast capture |
| `bugs.md`, `product_notes.md`, `style_notes.md`, `decisions.md` | Product memory |

## Workflow

### Studio Director

1. Set strategy in `directives.md` and `objectives.json`
2. Update `director_brief.md` at session start
3. Approve implementation: set `approvedForImplementation: true` on work items
4. Remain final authority on merge and release

### Orchestrator

1. Read `directives.md` → `objectives.json` → `work_items.json` → fleet files
2. Assign specialists — **do not implement by default**
3. Update `work_items.json`, `agent_status.json`, append `activity.jsonl`
4. Run sync + validate (below)

### After editing `work_items.json`

```bash
npm run studio:sync-active-work
npm run studio:validate
npm run studio:copy-public   # local dev mirror
```

`work_items.json` → `active_work.json` (dual-write for Phase 1 Mission Control UI).

## Implementation gate

Every work item includes:

```json
"approvedForImplementation": false
```

Investigation complete **does not** enable implementation. Director sets `true` explicitly.

Product decisions (e.g. spectator join) → **Product Agent** before **Implementation Agent**.

## Agent fleet

| id | Role |
|----|------|
| `orchestrator` | Coordinator — assignment and monitoring |
| `investigation` | Evidence only — no code |
| `product` | UX / product decisions |
| `implementation` | Code — only when approved |
| `regression` | Does the fix work? (test-core, QA) |
| `release` | Can we ship? (release gate) |
| `architecture` | Gaps and design |

## Operational timestamps (dashboard.json schema v2)

Mission Control shows **four independent freshness clocks** — not a single `updatedAt`.

| Field | Meaning |
|-------|---------|
| `projectStateUpdatedAt` | When studio understanding of the project last changed |
| `lastDeploymentAt` | When the currently running build was deployed |
| `lastReleaseGateAt` | Most recent `npm run test-release-gate` execution |
| `lastHumanPlaytestAt` | Most recent human multiplayer playtest (empty if unknown) |

Legacy `updatedAt` remains the file write time for `dashboard.json` itself. UI prefers the explicit fields above (with fallbacks from `release_status.json` when omitted).

### Freshness badges

| Signal | Fresh | Warning | Stale |
|--------|-------|---------|-------|
| Project State | &lt;24h | 1–3 days | &gt;3 days |
| Release Gate | &lt;7 days | 7–14 days | &gt;14 days |
| Human QA | &lt;7 days | 7–14 days | &gt;14 days |

Build/deployment shows age only (no badge). If project state is **Stale**, Mission Control shows **MISSION CONTROL DATA STALE**.

Calculation: `src/studio/freshness.ts` · UI: `src/studio/FreshnessPanel.tsx`

### Future automation hooks (manual today)

Do **not** automate yet. When wiring scripts/CI, update timestamps as follows:

| Timestamp | Update when |
|-----------|-------------|
| `projectStateUpdatedAt` | Any orchestrator alignment or studio edit that changes understanding: `work_items.json`, `release_status.json`, `roadmap.json`, `director_brief.md`, `dashboard.json` priorities/health, append to `activity.jsonl`, `objectives.json`, `agent_status.json` / `agent_queue.json` |
| `lastDeploymentAt` | Production or dev deploy completes (`deploy-web.yml` post-deploy job, or manual GitHub Pages publish) — set to deploy timestamp, not commit time |
| `lastReleaseGateAt` | `npm run test-release-gate` finishes (pass or fail) — mirror `release_status.json` `gate.lastRun.at` |
| `lastHumanPlaytestAt` | Human QA session ends — append `activity.jsonl` `{ "type": "human.playtest", "at": "…" }` and set dashboard field |

Recommended future script: `studio:sync-freshness` reads `release_status.json` + latest `activity.jsonl` playtest event and writes the three operational fields into `dashboard.json` without touching `projectStateUpdatedAt`.

**Ownership model:** [freshness-ownership.md](./freshness-ownership.md) — Orchestrator owns `projectStateUpdatedAt`; validate warns on drift.

## Validation

```bash
npm run studio:validate
npm run studio:test-paths
node ./scripts/studio/test-freshness.mjs
```

## Build

`studio/` is copied to `web-build/studio/` on `npm run build:web` and to `public/studio/` for local dev.

## Cursor rule

Orchestrator protocol: `.cursor/rules/studio-orchestrator.mdc`

## Related docs

- `ARCHITECTURE_GAPS.md` — engineering gap register (authoritative for P0/P1)
- `RELEASE_GATE.md` — release gate scenarios
