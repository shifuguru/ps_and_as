# Presence Ring Loop Fix — Implementation Summary

**Classification:** Bug Fix (High Polish)  
**Date:** 2026-06-08  
**Status:** Implemented

---

## Before / After

| Issue | Before | After |
|-------|--------|-------|
| Legacy loop boundary | `Animated.loop` 0→1→0 — snap at minimum every 1400ms | Integrated sine oscillator — wrap at midpoint (breathe = 0.5) |
| V1 phase source | `(timestamp % period) / period` — jumps when period changed every 400ms | `phase += dt / period` — frequency changes without phase reset |
| Wave rotation | Timestamp modulo — independent jumps | Integrated rotation degrees |
| Urgency param steps | React `useEffect` instant shared-value writes | UI-thread exponential smooth (~400ms τ) for strength, intensity, wave amplitude |
| Wave amplitude pop | SVG path rebuilt on each urgency tick | Fixed max-amplitude path + animated scale |

---

## Files modified

| File | Change |
|------|--------|
| `src/presence/presenceOscillator.ts` | **New** — `breatheFromPhase`, `advancePhase`, `advanceRotationDeg`, `smoothToward` |
| `src/components/LegacyTurnRing.tsx` | **New** — Reanimated legacy ring (replaces `Animated.loop` in OpponentSeat) |
| `src/components/PresenceRing.tsx` | Integrated phase, smoothed params, scaled wave layer |
| `src/components/OpponentSeat.tsx` | Removed legacy pulse effects; renders `LegacyTurnRing` |
| `scripts/test-presence-ring.ts` | Oscillator continuity + smoothing assertions |

**Net:** ~+180 LOC, ~−120 LOC removed from OpponentSeat

---

## Technical notes

### A. Legacy path

`LegacyTurnRing` uses the same oscillator as V1 with legacy output ranges (halo/glow/ring/core scale and opacity). Nudge overlay uses integrated phase on `LEGACY_NUDGE_PERIOD_MS` (900ms).

### B. V1 integrated phase

```typescript
pulsePhase.value = advancePhase(pulsePhase.value, dt, pulsePeriod);
waveRotation.value = advanceRotationDeg(waveRotation.value, dt, wavePeriod);
```

`pulsePeriod` updates immediately from urgency targets so frequency ramps without resetting accumulated phase.

### C. Smooth parameters

`pulseStrength`, `haloStrength`, `intensity`, and `waveAmplitude` lerp toward React-provided targets in the frame callback via `smoothToward(..., PRESENCE_PARAM_SMOOTH_MS)`.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsx ./scripts/test-presence-ring.ts` | **PASS** |
| Linter (modified files) | **Clean** |
| Turn ownership / resolver | **Unchanged** — `resolvePresenceRing`, `turnHighlightPlayerId` untouched |
| Gameplay | **Unchanged** — render-only |

### Manual QA (recommended)

1. **Legacy (flag off):** Active turn ring on opponent seat — watch 30s, no snap at cycle boundary.
2. **V1 (`EXPO_PUBLIC_PRESENCE_RING_V1=1`):** Hold turn 20s — no hitch every 400ms during urgency ramp.
3. **Nudge:** Bell highlight — continuous nudge breathe without restart snap.

---

## Risk assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Reanimated frame callback perf | Low | Same pattern as pre-fix V1; one callback per ring |
| Legacy visual drift | Low | Output ranges matched to prior interpolate endpoints |
| Wave scale vs path amplitude | Low | Max path at 5px; scale matches urgency ratio — visually equivalent |
| Android elevation + Reanimated | Low | Unchanged from prior ring layers |
| Turn highlight wrong seat | None | No resolver changes |

---

## Success criteria

| # | Criterion | Met |
|---|-----------|-----|
| 1 | No visible snap at loop boundary | Yes (legacy + V1) |
| 2 | No hitch every 400ms during urgency ramp | Yes (integrated phase + smooth params) |
| 3 | Pulse feels continuous | Yes (sine breathe, midpoint wrap) |
| 4 | Gameplay unchanged | Yes |
| 5 | Turn ownership unchanged | Yes |

---

## Rollback

Revert commits touching the five files above; legacy path restores inline `Animated.loop` in `OpponentSeat.tsx`.
