# Known player pain (curated)

This is **not** a bug tracker. Each item links to the authoritative gap register or investigation.

## Active

| Symptom | Severity | Track |
|---------|----------|-------|
| No cards dealt after repeated last-place finishes (online) | Blocking | `P0_ROUND_TRANSITION_INVESTIGATION.md` |
| Join mid-match via room code — stuck in lobby | Confusing | Spectator join investigation — use Spectate on Find Game for live watch |
| Rankings may appear before last-hand reveal (online) | Monitoring | Fixes shipped v1.0.54+ — Human QA Tests 1–3 pending |
| Disconnect aborts standard private room | Blocking | CPU takeover gap — not yet implemented |

## Monitoring

| Symptom | Notes |
|---------|-------|
| Turn ring highlight vs trick-pause freeze | BOTOPN presentation — trick winner may look wrong during pause |
| Last player gets one more turn after penultimate out | Core rules — trick acknowledgment before round end |

## Resolved (recent)

- Fresh-round trades sync (v1.0.60)
- Ceremony finalization / tradesComplete hardening (v1.0.60)

See `ARCHITECTURE_GAPS.md` for full gap register.
