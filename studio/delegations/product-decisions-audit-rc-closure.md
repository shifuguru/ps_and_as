# Product Decisions Audit — RC Closure

**Agent:** Product  
**Sprint:** RC Closure  
**Date:** 2026-06-08  
**Goal:** Confirm engineering waits on **evidence**, not **decisions**

---

## Decision summary

| ID | Topic | RC status | Product ambiguity | Implementation blocker |
|----|-------|-----------|-------------------|------------------------|
| **D-004** | Last player must act before round ends | **Locked for RC** | **None** | **None** |
| **D-007** | Disconnect / CPU takeover / timeout post-RC | **Locked — post-RC** | **None** | **None** (by design) |
| **D-008** | Mid-match Join → auto-spectate | **Decided — plan ready** | **Low** | **Director plan approval** (not evidence) |
| **D-009** | Keep D-004 for RC (no instant end) | **Locked** | **None** | **None** |

**Verdict:** No unresolved product ambiguity blocks RC closure sprint. Remaining blockers are **verification** (Human QA) and **Cluster C** (engineering evidence + optional fix).

---

## D-004 — Last player must acknowledge trick

**Decision:** Penultimate out does not end round until last living player acts on live pile.

| Check | Result |
|-------|--------|
| Rules encoded in `core.ts` | Yes — `lastPlayerMustRespondToCurrentTrick` |
| Tests | `test-core.ts` regression suite |
| Conflicts with D-009 | No — D-009 reaffirms D-004 |
| Cluster C adjacency | `tenRulePending` at round boundary may delay BOTOPN timer — **expected behaviour**, not a product change request |

**Hidden blocker:** None.  
**Roadmap conflict:** None for RC.

---

## D-007 — Disconnect features post-RC

**Decision:** CPU takeover, returning player reclaim, 15s timeout alignment ship **after** `rc-stability-exit`.

| Check | Result |
|-------|--------|
| RC blockers reduced | Yes — gaps re-prioritized to P1 post-RC |
| RC ships with current timeout behaviour | Yes — document as **known limitation** |
| Architecture work allowed | Design pack only (`wi-disconnect-persistence-pack`) |
| Accidental RC scope creep | **Guard** — Implementation Agent on standby for disconnect |

**Hidden blocker:** None for RC.  
**Player-facing note for RC ship:** Disconnect may end session after grace — acceptable per D-007.

---

## D-008 — Spectator Join auto-spectates

**Decision:** Mid-match room-code Join routes to **Spectate** on GameScreen.

| Check | Result |
|-------|--------|
| Supersedes D-003 lobby-stay | Yes, for mid-match Join only |
| Implementation plan | [spectator-auto-spectate-plan.md](./spectator-auto-spectate-plan.md) |
| Cluster B promotion fix | **Separate** — server promotion; D-008 is client navigation |
| Gate `spectator-promote` | PASS after Cluster B — promotion path not blocked on D-008 |
| Director approval | Plan delivered — **awaiting approval to implement** |

**Hidden blocker:** **Process only** — not a product ambiguity. RC can ship without D-008 if spectator Join UX remains suboptimal (document in known issues).

**Conflicting assumption:** None — roadmap does not require D-008 for RC exit.

---

## D-009 — Round completion: keep D-004

**Decision:** No instant round-end variant for RC.

| Check | Result |
|-------|--------|
| `wi-round-completion` | Closed |
| RC-R5 | Satisfied |
| Implementation work | None |

**Hidden blocker:** None.

---

## Cross-decision conflicts

| Pair | Conflict? | Resolution |
|------|-----------|------------|
| D-004 vs Cluster C timer | Timing only | BOTOPN must respect `tenRulePending` — fix ready gate, not D-004 |
| D-007 vs P0 gap register | Was conflict | **Resolved** by D-007 |
| D-008 vs Cluster B | Adjacent | Promotion server-side; navigation client-side — parallel tracks |
| D-009 vs rankings QA | None | Last-hand reveal order is presentation, not instant-end |

---

## Non-RC work — explicit exclusion confirmed

Per Director sprint directive, **no product ambiguity** requires opening:

- Identity & Progression Platform (D-006 blocked post-RC)
- Run Highlight System (P2 — review only)
- Presence Ring V2
- OAuth / XP persistence / monetization

---

## Product Agent recommendation

**Engineering is not waiting on product decisions** for RC closure. Waiting on:

1. **Director Human QA** (round transition repro + rankings Tests 1–3)
2. **Director approval** — Cluster C fix **or** accept as documented known issue
3. **Director approval** — D-008 implementation plan (optional for RC; can ship post-RC)
