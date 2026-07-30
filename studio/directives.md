# Studio Directive

Strategic standing orders from the Studio Director. Orchestrator reads this **before assigning work**.

Tactical daily context lives in `director_brief.md`. Objectives live in `objectives.json`.

---

## Current objective

**Release Candidate Stabilization**

Reach a shippable RC: P0 gaps closed or explicitly accepted, full release gate pass, spectator flow decided and verified.

---

## Priority order

When multiple items compete, work in this order:

1. **Core gameplay correctness** — rules engine, round completion, offline sim
2. **Multiplayer reliability** — round transitions, sync, reconnect, disconnect model
3. **Spectator experience** — join/spectate UX, dead-hand, mid-match watch
4. **BOTOPN stability** — bot loop, trick presentation, stall prevention
5. **Polish** — only after the above are green or explicitly deferred

---

## Do not work on

Unless the Studio Director explicitly reprioritizes:

- Cosmetics and visual-only tweaks
- Ranked / ladder systems
- Tournaments
- Monetization / IAP
- New architecture documents or system redesigns
- Mission Control UI expansion beyond approved phases

---

## Delegation rules

| Work type | Route to | Notes |
|-----------|----------|-------|
| Evidence-only trace | **Investigation Agent** | No code changes |
| UX / product decision | **Product Agent** | Before any implementation |
| Approved fix | **Implementation Agent** | Only when `approvedForImplementation: true` |
| Targeted tests | **Regression Agent** | test-core, QA league, scenario checks |
| Release gate / RC readiness | **Release Agent** | release gate, `release_status.json` |
| Gap register / architecture | **Architecture Agent** | `ARCHITECTURE_GAPS.md` |
| Assignment & monitoring | **Orchestrator** | Coordinator — not primary implementer |

**Critical:** Investigation complete does **not** imply implement. Set `approvedForImplementation: true` only after Studio Director approval.

---

## Escalation — stop and ask Director

- Any P0 production regression without a known owner
- Product decisions (e.g. spectator join behaviour, round-end rules)
- Changing `directives.md` or `objectives.json`
- Marking work complete when release gate still fails
- Implementation on items where `approvedForImplementation` is false

---

## Session protocol (Orchestrator)

1. Read this file + `objectives.json` + `director_brief.md`
2. Read `work_items.json`, `agent_queue.json`, `agent_status.json`
3. Assign highest-priority unowned **queued** work to the matching specialist
4. Update files + append `activity.jsonl`
5. Run `npm run studio:sync-active-work` after editing `work_items.json`
6. Do not merge, deploy, or declare SHIP without Director
