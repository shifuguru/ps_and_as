# RC Exit Criteria — definitive

**Phase:** `rc-stability` (`studio/roadmap.json`)  
**Target:** v1.1.0 RC  
**Updated:** 2026-06-08 (D-010 — BOTOPN deferred from RC)  
**Source of truth:** Mission Control (`studio/`) + `ARCHITECTURE_GAPS.md` + `RELEASE_GATE.md` + `studio/BOTOPN_RC_DEFERRAL.md`

Classification: **Mandatory** (true release blocker) · **Recommended** (strong confidence; not blocking if Director accepts risk) · **Optional** (nice-to-have; defer without blocking RC)

---

## Mandatory — true release blockers

These must be green or have an **explicit Director-accepted exception** recorded in `studio/decisions.md` before RC ship.

| ID | Criterion | Evidence required | Owner |
|----|-----------|-------------------|-------|
| **RC-M1** | **No open P0 gameplay regressions without accepted exception** | Round transition classified + fixed **or** repro ruled out; gap `multiplayer-round-transition-no-cards` → Resolved or Accepted | Investigation → Implementation |
| **RC-M2** | **Release gate pass (RC scope)** | Offline slice + **non-BOTOPN server slice** green; `botopn-*` gates **waived per D-010** (`SKIP_LIVE=1` or orchestrator skip list); `release_status.json` documents waiver | Release Agent |
| **RC-M3** | **Rankings before last hand verified** | Human QA Tests 1–3 pass on production build; gate `reconnect-rankings` pass; gap `rankings-before-last-hand` → Resolved | Regression + Human QA |
| **RC-M4** | **Release Readiness Report complete** | Written SHIP / SHIP WITH KNOWN ISSUES / DO NOT SHIP in `RELEASE_GATE.md` after clean gate | Release Agent |
| **RC-M5** | **Spectator mid-match flow decided + verified** | D-008 recorded; Product Agent implementation plan → Director approval → verify gate paths | Product → Implementation → Regression |
| **~~RC-M6~~** | ~~Director reconciles P0 gap register vs RC scope~~ | **Resolved 2026-06-20** — D-007: CPU takeover, returning player, disconnect timeout → post-RC `disconnect-persistence` | — |

---

## Recommended — release confidence (not blocking unless Director requires)

| ID | Criterion | Rationale | Owner |
|----|-----------|-----------|-------|
| **RC-R1** | **Server gate rerun on stable port 4000** | Last server failure was spawn/infra — gameplay regressions unassessed until rerun | Release Agent |
| **RC-R2** | **Automated rankings reconnect coverage** | `reconnect-rankings` already in gate; confirm pass after server rerun | Regression Agent |
| **RC-R3** | **Round transition root cause documented** | `P0_ROUND_TRANSITION_INVESTIGATION.md` complete with repro bucket (server/client/ceremony) | Investigation Agent |
| **RC-R4** | **Human multiplayer smoke (2–4 players)** | Private room: 2 full rounds + reconnect mid-match — not fully automated | Human QA |
| **RC-R5** | **Round completion product decision closed** | **Resolved** — D-009 confirms D-004 for RC | — |
| **RC-R6** | **Seated ready-for-next-round gating (P1)** | Reduces round-transition risk; spectator guard already shipped | Architecture → Implementation |
| **RC-R7** | **Release gate wired in deploy CI** | Process gap — `ciRunsReleaseGate: false` | Release Agent (proposal only) |
| **~~RC-R8~~** | ~~BOTOPN lifecycle gate pass~~ | **Deferred post-RC (D-010)** — see RC-O11 for reactivation | — |

---

## Optional — defer without blocking RC

| ID | Criterion | Notes |
|----|-----------|-------|
| **RC-O1** | CPU takeover after disconnect | Post-RC `disconnect-persistence` — **Director D-007** |
| **RC-O2** | Returning player after timeout | Post-RC with CPU takeover — **Director D-007** |
| **RC-O3** | Disconnect timeout 15 s alignment (P1) | Post-RC — **Director D-007** |
| **RC-O4** | Identity & Progression Platform | Blocked on `rc-stability-exit` — no implementation |
| **RC-O5** | Presence Ring verification | Feature flag off; not in release gate |
| **RC-O6** | Turn ownership elimination track | Post-1.1.0 per roadmap |
| **RC-O7** | Mission Control Phase 2B UI | Studio ops — not player-facing RC |
| **RC-O8** | P2 gaps (pause presentation, ten-rule validation, online pass mutation, bot-open disconnect model) | Track in gap register; no RC block |
| **RC-O9** | XP / progression persistence | IPP Phase 1 post-RC |
| **RC-O10** | Playwright L3 UI smoke | Recommended when changing GameScreen; not gate-required today |
| **RC-O11** | **BOTOPN reactivation** | Post-RC: Cluster C fix + `botopn-lifecycle` / `botopn-stall-live` green + Find Game restore — criteria in `studio/BOTOPN_RC_DEFERRAL.md` |

---

## Explicit non-blockers (do not work for RC)

Per `studio/directives.md` — unless Director reprioritizes:

- Cosmetics, ranked/ladder, tournaments, monetization/IAP
- New architecture documents or system redesigns
- IPP implementation (`epic-identity-progression-platform`)
- Mission Control UI expansion beyond approved phases

---

## RC exit checklist (Orchestrator)

```text
[x] RC-M6 — Director D-007 (2026-06-20): disconnect work post-RC
[x] D-010 — BOTOPN deferred from RC critical path (2026-06-08)
[ ] RC-M1 — Round transition gap closed or accepted
[ ] RC-M2 — Release gate pass (RC scope — BOTOPN gates waived)
[ ] RC-M3 — Rankings Human QA Tests 1–3 signed off
[ ] RC-M5 — Spectator auto-spectate implemented + verified (D-008 decided)
[ ] RC-M4 — Release Readiness Report written
[ ] RC-R1 — Server slice confirmed (not infra)
[ ] RC product — Hide BOTOPN in Find Game when no human lobbies (D-010)
```

When all **Mandatory** items are satisfied (including documented exceptions), mark `rc-stability-exit` achieved in roadmap and unblock post-RC phases.

---

## Related

- `studio/rc-stabilization-execution-plan.md` — agent queues, Director bottleneck, forecast
- `studio/roadmap.json` — phase `rc-stability`
- `studio/objectives.json` — objective `rc-stabilization`
- `ARCHITECTURE_GAPS.md` — gap register
