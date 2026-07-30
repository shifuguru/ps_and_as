# Studio decisions (ADR-lite)

## D-001 — Server-authoritative multiplayer

**Context:** Clients were applying local `playCards` while online, causing desync.

**Decision:** Server holds canonical state; clients render `gameStateSync` only.

**Consequences:** All multiplayer bugs must be traced server-first. See `MULTIPLAYER_ARCHITECTURE.md`.

---

## D-002 — ARCHITECTURE_GAPS.md is reality; architecture docs are intent

**Context:** Docs drift from implementation.

**Decision:** Gap register is authoritative for engineering debt; close gaps before new architecture.

**Consequences:** Mission Control mirrors gap priorities; does not replace the register.

---

## D-003 — Spectator mid-match Join stays in lobby (current)

**Context:** Join replays `startGame` with `spectator: true`; App blocks navigation on create screen.

**Decision (implicit in code):** Spectators use Find Game **Spectate** for live watch; Join is for ready-next-round flow.

**Consequences:** Player confusion when using room code Join mid-match — under review (see inbox).

---

## D-004 — Last player must acknowledge trick before round ends

**Context:** When penultimate player goes out on a live pile, round does not end until last player acts.

**Decision:** Core rules encode `lastPlayerMustRespondToCurrentTrick` — tests in `test-core.ts` require this.

**Consequences:** Product may want instant-end variant — requires explicit decision and test updates.

---

## D-005 — Mission Control file-backed, no auth Phase 1

**Context:** Studio needs operational view without building admin infrastructure.

**Decision:** `studio/` JSON + Markdown; hidden `/mission-control` URL; noindex; no player nav links.

**Consequences:** Not secure against determined access — do not store secrets in studio files.

---

## D-006 — Identity & Progression Platform (roadmap approved, implementation blocked)

**Context:** Remote profile popups empty for other players; progression is local-first with optional cloud backup; ad-hoc `fetchCloudPlayerStats` in scoreboard/borders only. Remote profile investigation complete 2026-06.

**Decision:** Adopt **Identity & Progression Platform** with **`PublicPlayerProfile`** as the single multiplayer-facing contract. Preserve **`profileId`** from `getOrCreatePlayerId()`. Guest-first identity; OAuth and cloud authority post-RC. **Reject Phase A** (modal-only cloud fetch). **Do not implement** until `rc-stability-exit`.

**Consequences:** `ARCHITECTURE_GAPS.md` XP persistence gap resolution path = Phase 1 Foundation. Epic `epic-identity-progression-platform` blocked in Mission Control. `retention-monetization` roadmap phase superseded. Source: `studio/identity-progression-platform.md`.

---

## D-007 — RC scope: disconnect features post-RC

**Context:** Gap register listed CPU takeover, returning player, and disconnect timeout as P0; roadmap `disconnect-persistence` deferred them post-RC. RC-M6 required Director reconciliation.

**Decision (2026-06-20):** **Post-RC** for RC ship. CPU takeover, returning player recovery, and 15 s disconnect timeout alignment ship in `disconnect-persistence` phase after `rc-stability-exit`. RC ships with current grace-end behaviour (game may abort after timeout) — document as known limitation.

**Consequences:** P0 RC blockers reduced to round transition, rankings verification, release gate, spectator flow. Gap register priorities updated. Architecture Agent delivers disconnect persistence design pack autonomously.

---

## D-008 — Spectator Join auto-spectates active matches

**Context:** Mid-match room code Join leaves player in lobby alone. Investigation complete — server sync OK; client navigation blocks GameScreen.

**Decision (2026-06-20):** When a player Joins a room with an **active match**, automatically route to **Spectate** (live watch) — do not block on create/lobby screen.

**Consequences:** Supersedes implicit D-003 lobby-stay behaviour for mid-match Join. Product Agent delivers implementation plan; Implementation requires Director approval after plan review.

---

## D-009 — Round completion: keep D-004 for RC

**Context:** Penultimate player out — investigation confirmed core rules require last-player trick acknowledgment.

**Decision (2026-06-20):** **Keep D-004** for RC. No instant round-end variant. Gap `wi-round-completion` closed.

**Consequences:** No implementation work. RC-R5 satisfied.

---

## D-010 — BOTOPN deferred from RC critical path

**Context:** `botopn-lifecycle` and `botopn-stall-live` gate failures blocked RC ship. Cluster C classified (Phase B timer churn, 88% confidence). Product review: BOTOPN is priority #3; Quick Game, private multiplayer, and rankings verification do not depend on it.

**Decision (2026-06-08):** **Option B — defer BOTOPN from RC scope.** Remove BOTOPN gates from RC-blocking status. For RC builds: when no public human rooms exist, Find Game shows **“No Public Games Available”** instead of surfacing BOTOPN (implementation by Product + Engineering — not in this decision). Preserve all BOTOPN server code, tests, investigations, and gate scripts for post-RC reactivation.

**Consequences:** RC-M2 satisfied with `botopn-*` gates skipped or waived per `studio/BOTOPN_RC_DEFERRAL.md`. Cluster C, `wi-botopn-lifecycle`, and BOTOPN gates → post-RC backlog. RC-K1 / RC-K2 reclassified as accepted RC deferrals (not product bugs in RC scope). RC focus: round transition Human QA, rankings signoff, release gate (non-BOTOPN slice), packaging, IPP planning.
