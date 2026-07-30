# BOTOPN RC Deferral — Director Decision Record

**Decision:** D-010 (2026-06-08)  
**Status:** Approved — Option B  
**Scope:** Governance and RC critical path only. **Not** abandonment of BOTOPN.

---

## Decision

BOTOPN is **removed from the RC critical path** and scheduled for **post-RC reactivation**.

---

## Rationale

### Value BOTOPN provides (retained for post-RC)

- Public matchmaking fallback when no human lobbies exist
- Live spectating of in-progress bot tables
- Join-next-round promotion (dead-hand seat)
- Solo online play against server bots (Amy & Ben)

### Why it does not block RC

| RC dependency | Requires BOTOPN? |
|---------------|------------------|
| Quick Game (offline) | No |
| Create Game / private rooms | No |
| Rankings verification (RC-M3) | No |
| Round transition (RC-M1) | No |
| Spectator promotion (Cluster B) | No — private gate green |
| RC-M1 through RC-M5 | No |

BOTOPN is **Product Priority #3** per `studio/product_notes.md`.

### Why defer now

- Dedicated lifecycle complexity (`server/botHostedRooms.js`, singleton room)
- Gate failures (`botopn-lifecycle`, `botopn-stall-live`) and shared-room test contamination
- Limited RC value vs core private multiplayer + ceremony fixes
- Cluster C fix is scoped (~15–25 LOC idempotency) but **not required for RC ship** under this decision

---

## Impact

### Product

| Area | RC behaviour | Post-RC |
|------|--------------|---------|
| Find Game — empty lobby | **“No Public Games Available”** (no BOTOPN row) | Restore bot table listing |
| Quick Game | Unchanged | Unchanged |
| Join by code `BOTOPN` | Disabled or hidden for RC (implementation TBD) | Restore |
| QA chaos / league default room | Use private room or skip for RC gate | Restore BOTOPN |

### Engineering

- **Preserve:** `server/botHostedRooms.js`, BOTOPN tests, investigations, gate scripts
- **Do not delete** Cluster C investigation or fix proposal
- **RC gate:** `botopn-lifecycle`, `botopn-stall-live` → **skipped/waived** for RC-M2 (see `rc-exit-criteria.md`)
- **Implementation follow-up:** Product + Engineering hide BOTOPN in Find Game (separate work item)

### RC timeline

- Removes Cluster C from RC ship blockers
- RC-M2 achievable on **non-BOTOPN server slice** + offline gates
- Estimated **1–2 weeks** removed from critical path uncertainty (gate flake + fix cycle)

---

## Known issues (RC)

| ID | Title | RC status |
|----|-------|-----------|
| **RC-K1** | BOTOPN lifecycle disabled for RC | **Accepted** — deferred post-RC |
| **RC-K2** | Public bot-hosted matchmaking deferred post-RC | **Accepted** — deferred post-RC |
| **RC-K3** | Disconnect grace — no CPU takeover | Accepted (D-007) |

---

## Reactivation criteria (post-RC)

All required before re-enabling BOTOPN in production Find Game:

1. **Cluster C fix merged** — idempotent round finish / timer churn (`studio/delegations/cluster-c-investigation.md`, 88% confidence path)
2. **`botopn-lifecycle` PASS** on clean server (fresh process, no orphan spectators)
3. **`botopn-stall-live` PASS** or documented SKIP_LIVE with matrix coverage
4. **Find Game product signoff** — spectate, ready, promotion, empty-lobby fallback UX
5. **Gate hygiene** — server restart before BOTOPN slice; optional isolated port in CI
6. **Director approval** to move BOTOPN gates back to **Recommended** or **Mandatory** for a given release

Optional polish (not blocking reactivation):

- Trick-pause / turn ring presentation on BOTOPN (`wi-botopn-trick-pause` backlog)
- Bot-open disconnect model alignment (`wi-botopn-disconnect-model`)

---

## Work items reclassified

| Item | Was | Now |
|------|-----|-----|
| `wi-botopn-lifecycle` (Cluster C) | RC Blocker | **Post-RC** |
| `botopn-lifecycle` gate | RC blocker | **Waived for RC** (Recommended post-RC) |
| `botopn-stall-live` gate | RC blocker | **Waived for RC** (Recommended post-RC) |
| `wi-botopn-rc-hide` | — | **RC Blocker** — hide BOTOPN in Find Game for RC builds |

---

## Related

- `studio/decisions.md` — D-010
- `studio/rc-exit-criteria.md` — RC-M2 waiver, RC-O11 reactivation
- `studio/delegations/cluster-c-investigation.md` — fix scope for post-RC
- `studio/product_notes.md` — mode priority #3
