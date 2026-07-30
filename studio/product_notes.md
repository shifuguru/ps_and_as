# Product notes

## Vision

Presidents & Assholes should feel like **sitting at a real card table** — fast rounds, readable turn state, fair rankings, and multiplayer that survives disconnects without ruining the match.

## Mode priorities (2026)

1. **Quick Game (offline)** — onboarding and rules learning; must never stall.
2. **Private rooms (online)** — friends playing together; disconnect recovery is the gap.
3. **BOTOPN / Quick Online** — fill tables, spectate, promote to seat; bot loop must not stall turns.
4. **Spectator / dead hand** — join mid-match, ready for next round, claim seat in ring order.

## Player-facing vs studio-facing

| Audience | Source |
|----------|--------|
| Players | What's New (`updateLogContent.ts`) |
| Studio | This file, `director_brief.md`, Mission Control dashboard |

## Non-goals (current phase)

- Competitive ranked ladder (deferred to `progression-ranked-foundation` — see Identity & Progression Platform)
- In-app purchases (deferred to `progression-titles-cosmetics` phase)
- Chat / social features beyond room codes

## Identity & Progression Platform (approved — blocked on RC)

Director approved roadmap 2026-06-19. **No implementation yet.**

| Track | Phase ID |
|-------|----------|
| PublicPlayerProfile + remote profiles | `identity-progression-foundation` |
| Guest accounts & linking | `identity-guest-and-link` |
| Apple / Google Sign-In | `identity-oauth` |
| Cloud progression authority | `progression-cloud-authority` |
| Titles & cosmetics | `progression-titles-cosmetics` |
| Ranked foundations | `progression-ranked-foundation` |

Epic: `epic-identity-progression-platform` · Doc: `studio/identity-progression-platform.md`

## Success metrics

- Release gate pass before every production deploy
- Zero open P0 gaps
- Human QA sign-off on ceremony flows (deal, trade, rankings, last hand)
