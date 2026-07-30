# RC Stabilization — Execution Plan

**Optimized for:** unlimited agent/compute capacity · **scarce resource:** Studio Director attention  
**Updated:** 2026-06-08 (D-010 — BOTOPN deferred from RC)  
**Exit criteria:** `studio/rc-exit-criteria.md` · **BOTOPN deferral:** `studio/BOTOPN_RC_DEFERRAL.md`

---

## 2. Work classification

All non-completed work items from `studio/work_items.json`.

| Work item | Priority | Current status | Class | Recommended status change |
|-----------|----------|----------------|-------|---------------------------|
| `wi-round-transition` | P0 | investigating | **A — RC Blocker** | Keep investigating until classified |
| `wi-release-gate` | P0 | blocked | **A — RC Blocker** | → `queued` once port 4000 cleared (Release Agent autonomous) |
| `wi-release-readiness-report` | P0 | blocked | **A — RC Blocker** | Keep blocked on gate |
| `wi-rankings-verify` | P0 | testing | **A — RC Blocker** | Keep testing; escalate automated slice in parallel |
| `wi-cpu-takeover` | P0 | blocked | **C — Post-RC** * | → `blocked` + note "post-RC unless Director RC-M6(b)" |
| `wi-returning-player` | P0 | blocked | **C — Post-RC** * | Keep blocked on cpu-takeover |
| `wi-spectator-join` | P1 | blocked | **B — Release Risk** | Needs Director decision (RC-M5) |
| `wi-ready-gating` | P1 | implementing | **B — Release Risk** | → `blocked` until `approvedForImplementation: true` |
| `wi-disconnect-timeout` | P1 | queued | **C — Post-RC** | Defer |
| `wi-xp-persistence` | P1 | blocked | **D — Future Roadmap** | Correct — IPP post-RC |
| `epic-identity-progression-platform` | P1 | blocked | **D — Future Roadmap** | No change |
| `wi-round-completion` | P2 | blocked | **B — Release Risk** | → `queued` if Director accepts D-004 for RC |
| `wi-online-pass-mutation` | P2 | queued | **C — Post-RC** | Defer |
| `wi-ten-rule-validation` | P2 | queued | **C — Post-RC** | Defer |
| `wi-botopn-lifecycle` | P1 | deferred | **C — Post-RC** | → `deferred` per **D-010** |
| `wi-botopn-rc-hide` | P0 | queued | **A — RC Blocker** | Find Game hide for RC (D-010) |
| `wi-botopn-disconnect-model` | P2 | queued | **C — Post-RC** | Defer with BOTOPN reactivation |
| `wi-pause-presentation` | P2 | queued | **C — Post-RC** | Defer | roadmap defers to `disconnect-persistence`. **Director must resolve via RC-M6** before agents implement CPU takeover for RC.

**Classification key**

- **A — RC Blocker:** Must close or Director-accept before ship  
- **B — Release Risk:** Affects confidence or player confusion; decision or verification needed  
- **C — Post-RC:** Valid work; not on RC critical path  
- **D — Future Roadmap:** Blocked on `rc-stability-exit` or explicit non-goals  

---

## 3. Agent utilization plan

| Work item | Investigation | Implementation | Regression | Release | Product | Architecture | Autonomy |
|-----------|:-------------:|:--------------:|:----------:|:-------:|:-------:|:------------:|----------|
| `wi-round-transition` | **Lead** | After approval | After fix | — | — | Consult | Mostly autonomous until fix path → **Director approval** |
| `wi-release-gate` | — | — | — | **Lead** | — | — | **Fully autonomous** |
| `wi-release-readiness-report` | — | — | — | **Lead** | — | — | Mostly autonomous; **Director reads report** |
| `wi-rankings-verify` | — | — | **Lead** | Gate slice | — | — | Mostly autonomous; **Human QA signoff** for Tests 1–3 |
| `wi-cpu-takeover` | — | After approval | After fix | — | — | **Lead** | **Director approval** for design + scope (RC-M6) |
| `wi-returning-player` | — | After approval | After fix | — | — | **Lead** | Blocked on cpu-takeover |
| `wi-spectator-join` | Done | After decision | After fix | — | **Lead** | — | **Director decision** |
| `wi-ready-gating` | — | After approval | After fix | — | — | Design | **Director approval** (currently implementing without flag) |
| `wi-disconnect-timeout` | Optional | After approval | After fix | — | — | Design | Post-RC — defer |
| `wi-round-completion` | Done | If changed | If changed | — | **Lead** | — | **Director decision** (or accept D-004) |
| P2 queued items | Optional audit | Defer | Defer | — | — | — | Post-RC |
| IPP epic | — | Defer | — | — | — | Done (planning) | **Do not start** |

**Autonomy legend**

- **Fully autonomous:** No Director touch until deliverable ready  
- **Mostly autonomous:** Agents work; Director reviews outcome only  
- **Director approval:** `approvedForImplementation: true` or decision in `decisions.md`  
- **Director decision:** Product/architecture choice required before work  

---

## 4. Director bottleneck queue

Prioritized for **minimum Director time** (~45–75 min total if batched in one session).

| Priority | Item | Decision required | Est. review | Recommended option | Impact if delayed |
|:--------:|------|-------------------|-------------|-------------------|-------------------|
| **1** | **RC-M6 — CPU takeover RC scope** | Accept P0 gaps as post-RC known issues **or** require implementation before RC | 10 min | **Accept post-RC** with documented player messaging (grace-end may abort game); align gap register P0 → P1 for RC ship | Unblocks realistic RC scope; avoids multi-week disconnect redesign on critical path |
| **2** | **Spectator mid-match Join** (`wi-spectator-join`) | Join vs Spectate vs prompt vs lobby-only | 10 min | **Default Join → Spectate** for mid-match room codes (align D-003 intent); small App.tsx routing fix | RC-M5 blocked; player confusion continues |
| **3** | **Round completion** (`wi-round-completion`) | Keep D-004 rules or instant-end variant | 5 min | **Keep D-004** for RC — no implementation | Low — current behaviour is tested and intentional |
| **4** | **Round transition fix path** | Approve implementation after Investigation classifies root cause | 15 min | Batch with investigation readout — approve smallest scoped fix | RC-M1 blocked |
| **5** | **Ready gating implementation** | Approve seated `betweenRounds` gate | 5 min | **Approve** if investigation links to ready race; else defer post-RC | wi-ready-gating illegally implementing without flag |
| **6** | **Release Readiness Report** | SHIP / SHIP WITH KNOWN ISSUES / DO NOT SHIP | 15 min | Decide after gate + rankings — not before | RC-M4 blocked |
| **7** | **Rankings Human QA** | Sign off Tests 1–3 | 10 min | Sign off if regression agent provides capture checklist | RC-M3 blocked |

**Batch recommendation:** One **30-minute Director session** covering items 1–3 + 5 (decisions only). Second **15-minute session** after investigation + gate (items 4, 6, 7).

---

## 5. Autonomous work queue

Assume Director offline. **Exclude** product decisions and Human QA signoff.

### Next 24 hours

| Agent | Work |
|-------|------|
| **Release** | Kill stale port 4000 processes; start server; gate with BOTOPN waived (D-010, `SKIP_LIVE=1`); update `release_status.json` |
| **Regression** | Re-run offline slice; run `test-reconnect-round-complete.mjs` standalone; document results for rankings gap |
| **Investigation** | Continue `wi-round-transition`: server log capture for 3× Asshole / `skipPresidentTrade`; classify bucket A/B/C/D per investigation doc |
| **Architecture** | Draft CPU takeover design doc (no implementation) — ready for Director RC-M6 review |
| **Orchestrator** | Pause `wi-ready-gating` implementation until approval; sync `work_items.json` statuses |

### Next 72 hours

| Agent | Work |
|-------|------|
| **Investigation** | Complete round transition classification; write fix proposal with acceptance criteria |
| **Release** | If gate passes: draft Release Readiness Report (pending Director item 6) |
| **Regression** | QA league on private rooms only for RC; **defer BOTOPN lifecycle scripts** to post-RC backlog |
| **Architecture** | Reconcile gap register wording with RC-M6 outcome; update ARCHITECTURE_GAPS notes only |
| **Release** | CI wiring proposal for `deploy-web.yml` (PR draft, no merge without Director) |

### Next 7 days

| Agent | Work |
|-------|------|
| **Implementation** | Round transition fix (after Director approval only) |
| **Implementation** | Spectator Join routing (after Director decision only) |
| **Regression** | Full gate after each approved fix; Playwright quick-game smoke if GameScreen touched |
| **Release** | Release Readiness Report finalization |
| **Investigation** | Audit P2 gaps for RC regressions only (evidence, no fixes) |
| **Architecture** | Disconnect-persistence phase design pack (post-RC) — CPU takeover, 15 s grace, ready gating |

**Explicitly excluded while Director absent:** IPP implementation, Mission Control 2B UI, cosmetics, ranked, tournaments, wi-ready-gating code without approval.

---

## 6. Release forecast

| Metric | Estimate | Notes |
|--------|----------|-------|
| **Earliest realistic RC** | **3–5 days** | D-010 + D-007 resolved; Human QA + non-BOTOPN gate + Find Game hide |
| **Most likely RC** | **1–2 weeks** | Human QA scheduling; D-008 implementation |
| **Confidence** | **Medium (78%)** | Improved after D-010 — BOTOPN off critical path |
| **Remaining unknowns** | See below | |

**Remaining unknowns (do not inflate confidence)**

1. Round transition — empty authoritative hands vs ceremony/UI stall vs ready-gate race  
2. Server gate — infra vs real multiplayer regressions on first clean run  
3. Rankings Tests 1–3 — manual UI ordering may still fail on production  
4. Spectator auto-spectate — implementation scope after Product plan  
5. ~~Cluster C BOTOPN lifecycle~~ — **deferred post-RC (D-010)**

**Resolved:** RC-M6 (D-007), round completion (D-009), spectator decision (D-008), **BOTOPN RC scope (D-010)**.

---

## 7. Opportunity cost analysis

Work consuming attention **without materially moving RC**:

| Activity | Cost | Recommendation |
|----------|------|----------------|
| **Identity & Progression Platform** (planning done) | Agent context / Mission Control noise | **Stop** — planning complete; no further IPP work until RC exit |
| **Mission Control Phase 2B UI** | Implementation time | **Defer** — Phase 2A sufficient for RC; `directives.md` says no MC expansion |
| **wi-ready-gating without approval** | Invalid implementation + validation warnings | **Pause** — fix status to blocked pending Director |
| **Presence Ring** (flag off) | Investigation/implementation already shipped | **Defer verification** — RC-O5 optional |
| **Turn ownership elimination** | Long-running sim track | **Defer** — post-1.1.0 |
| **P2 gap fixes** (pause, ten-rule, pass mutation) | Scatter | **Defer** — audit only if gate fails |
| **Studio freshness / dashboard polish** | Orchestrator time | **Minimal** — only after gate results |
| **Architecture doc expansion** | Writer time | **Defer** — update gap notes only |
| **Monetization / cosmetics / tournaments** | Explicit non-goals | **Do not start** |
| **Release gate CI wiring** | Useful but not RC blocker | **Recommended** — Release Agent drafts PR; Director approves merge |

**Highest leverage autonomous work right now:** server gate rerun → round transition classification → rankings automated verification.

---

## Director quick answers

| Question | Answer |
|----------|--------|
| What truly blocks release? | RC-M1–M5 in `rc-exit-criteria.md` — round transition Human QA, **non-BOTOPN gate**, rankings QA, spectator decision, Find Game hide (D-010) |
| What can agents do without me? | Non-BOTOPN gate rerun, investigations, regression scripts, release report draft, Find Game hide implementation |
| What decisions require my attention? | Spectator Join plan approval, round transition + rankings signoff, final SHIP decision |
| What should not be worked on? | **Cluster C / BOTOPN fix for RC**, IPP, MC 2B, cosmetics |
| How close are we to RC? | **Closer** — 1–2 weeks most likely after Human QA |
| What progresses while I'm offline? | 24h/72h/7d autonomous queues above |

---

## Related

- `studio/rc-exit-criteria.md`
- `studio/directives.md`
- `studio/director_brief.md`
- `P0_ROUND_TRANSITION_INVESTIGATION.md`
