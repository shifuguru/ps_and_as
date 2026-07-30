# Director Brief — 2026-06-08 (D-010 BOTOPN deferral)

## Today's objective

**Close RC on non-BOTOPN critical path:** round transition Human QA, rankings signoff, release gate (waived BOTOPN slice), Find Game hide for RC, release packaging.

## Current blockers (RC — mandatory)

- **P0:** Multiplayer round transition — Human repro signoff (Cluster A implemented).
- **P0:** Release gate — **non-BOTOPN server slice** rerun (Release Agent).
- **P0:** Rankings before last hand — Tests 1–3 verification (Regression Agent).
- **P0:** Spectator auto-spectate — D-008 decided; plan approval → implement → verify.
- **Release:** Hide BOTOPN in Find Game for RC builds (D-010 — Product + Engineering).

## Deferred from RC (Director D-010 — not blockers)

- **BOTOPN / Cluster C** — lifecycle, auto-start, public matchmaking fallback
- `botopn-lifecycle`, `botopn-stall-live` gates — waived for RC; reactivation criteria in `studio/BOTOPN_RC_DEFERRAL.md`

## Post-RC (Director D-007 — not RC blockers)

- CPU takeover after disconnect
- Returning player after timeout
- Disconnect timeout 15 s alignment

## Resolved this cycle

- **RC-M6** — disconnect scope → post-RC (D-007)
- **Round completion** — keep D-004 for RC (D-009)
- **Spectator Join decision** — auto-spectate active matches (D-008)
- **BOTOPN RC scope** — deferred from critical path (D-010)

## Product decisions pending (investigations closed)

- D-008 spectator plan — Director approval to implement
- Round transition Human QA — signoff or waiver

## Recommended next action

1. Product + Engineering: hide BOTOPN when Find Game has no human lobbies (D-010).
2. Release Agent: rerun gate with `SKIP_LIVE=1` or orchestrator BOTOPN skip; update `release_status.json`.
3. Human QA: rankings Tests 1–3 + round transition checklist.
4. Director batch (~30 min): rankings signoff, spectator plan approval, SHIP WITH KNOWN ISSUES.

## New RC focus (D-010)

1. Round transition verification  
2. Rankings Human QA signoff  
3. Release gate stability (non-BOTOPN)  
4. Release packaging  
5. Identity & Progression Foundation planning (post-RC exit)

## Upcoming major initiative — Identity & Progression Platform

**Status:** Roadmap approved · **Implementation:** Not approved · **Blocked by:** RC exit

Do not start until `rc-stability` mandatory criteria met. Source: `studio/identity-progression-platform.md`.
