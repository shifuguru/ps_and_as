/**
 * Pure helpers for gameplay SFX playback policy.
 * Keep React / expo-av out of this module so scripts can unit-test behaviour.
 */

import type { GameSfxId } from "./gameSfx";

/** How many concurrent instances we keep per effect (overlap + reuse). */
export const SFX_POOL_SIZE = 3;

export function resolveEffectVolume(effect: GameSfxId | string): number {
  switch (effect) {
    case "turn_start":
      return 0.72;
    case "card_select":
      return 0.45;
    case "card_play":
    case "card_play_multi":
      return 0.68;
    case "card_land":
      return 0.48;
    case "pass":
      return 0.5;
    case "click":
    case "chips":
      return 0.7;
    default:
      return 0.6;
  }
}

/**
 * Round-robin index into a fixed pool. Prefer a free slot when available so
 * overlapping cues do not cut each other off.
 */
export function pickPoolSlot(
  playing: ReadonlyArray<boolean>,
  nextIndex: number,
): { slot: number; nextIndex: number } {
  const size = playing.length;
  if (size <= 0) return { slot: 0, nextIndex: 0 };
  for (let i = 0; i < size; i++) {
    const slot = (nextIndex + i) % size;
    if (!playing[slot]) {
      return { slot, nextIndex: (slot + 1) % size };
    }
  }
  const slot = nextIndex % size;
  return { slot, nextIndex: (slot + 1) % size };
}

/** Stable key for a pass action inside the current trick action list. */
export function passActionKey(index: number, playerId: string): string {
  return `${index}:${playerId}`;
}

export type TrickActionLike = { type: string; playerId?: string };

/**
 * Returns pass keys that are new since `heard`, and the next heard set.
 * When the trick has no actions (cleared / new trick), heard resets.
 */
export function collectNewPassKeys(
  actions: ReadonlyArray<TrickActionLike> | null | undefined,
  heard: ReadonlySet<string>,
): { newKeys: string[]; nextHeard: Set<string> } {
  if (!actions || actions.length === 0) {
    return { newKeys: [], nextHeard: new Set() };
  }
  const nextHeard = new Set(heard);
  const newKeys: string[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action?.type !== "pass" || !action.playerId) continue;
    const key = passActionKey(i, action.playerId);
    if (nextHeard.has(key)) continue;
    nextHeard.add(key);
    newKeys.push(key);
  }
  return { newKeys, nextHeard };
}

/**
 * Turn-start cue policy: fire once per authoritative turn ownership period,
 * and only when the turn is presentable (flights / holds cleared).
 *
 * Using presentable alone double-fires when presentation briefly gates off
 * mid-ownership (opponent play → you briefly writable → flight hold → writable).
 */
export type TurnStartCueState = {
  firedForAuthorityTurn: boolean;
};

export function nextTurnStartCue(
  prev: TurnStartCueState,
  opts: {
    enabled: boolean;
    authority: boolean;
    presentable: boolean;
  },
): { state: TurnStartCueState; fire: boolean } {
  if (!opts.enabled || !opts.authority) {
    return { state: { firedForAuthorityTurn: false }, fire: false };
  }
  if (opts.presentable && !prev.firedForAuthorityTurn) {
    return { state: { firedForAuthorityTurn: true }, fire: true };
  }
  return { state: prev, fire: false };
}
