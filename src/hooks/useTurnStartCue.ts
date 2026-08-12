import { useEffect, useRef } from "react";
import {
  nextTurnStartCue,
  type TurnStartCueState,
} from "../audio/sfxPlayback";

/**
 * Fires `onTurnStart` once per authoritative turn ownership period, when the
 * turn becomes presentable (controls unlocked). Presentation flicker
 * (flights / holds) must not re-arm the cue.
 */
export function useTurnStartCue(
  isMyTurnAuthority: boolean,
  isMyTurnPresentable: boolean,
  onTurnStart: () => void,
  enabled = true,
): void {
  const stateRef = useRef<TurnStartCueState>({
    firedForAuthorityTurn: false,
  });
  const onTurnStartRef = useRef(onTurnStart);
  onTurnStartRef.current = onTurnStart;

  useEffect(() => {
    const { state, fire } = nextTurnStartCue(stateRef.current, {
      enabled,
      authority: isMyTurnAuthority,
      presentable: isMyTurnPresentable,
    });
    stateRef.current = state;
    if (fire) onTurnStartRef.current();
  }, [isMyTurnAuthority, isMyTurnPresentable, enabled]);
}
