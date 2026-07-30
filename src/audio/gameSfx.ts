/**
 * Gameplay SFX ids — played through useMenuAudio.playEffect.
 * Keep names stable; assets live in assets/sounds/.
 */
export type GameSfxId =
  | "click"
  | "card_select"
  | "card_play"
  | "card_play_multi"
  | "pass"
  | "turn_start"
  | "card_deal"
  | "pile_clear"
  | "shuffle"
  | "chips";

export type PlaySoundFn = (effect: GameSfxId | string) => void | Promise<void>;

/** Prefer multi-card cue when more than one card is played. */
export function playCardsSfxId(cardCount: number): GameSfxId {
  return cardCount > 1 ? "card_play_multi" : "card_play";
}
