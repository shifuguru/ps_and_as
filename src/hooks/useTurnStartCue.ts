import { useEffect, useRef } from "react";

/**
 * Fires `onTurnStart` exactly once per false → true transition of `isMyTurn`.
 * Ignores re-renders while the turn stays active; resets when the turn ends.
 */
export function useTurnStartCue(
  isMyTurn: boolean,
  onTurnStart: () => void,
  enabled = true,
): void {
  const wasMyTurnRef = useRef(false);
  const onTurnStartRef = useRef(onTurnStart);
  onTurnStartRef.current = onTurnStart;

  useEffect(() => {
    if (!enabled) {
      wasMyTurnRef.current = false;
      return;
    }
    if (isMyTurn && !wasMyTurnRef.current) {
      wasMyTurnRef.current = true;
      onTurnStartRef.current();
      return;
    }
    if (!isMyTurn) {
      wasMyTurnRef.current = false;
    }
  }, [isMyTurn, enabled]);
}
