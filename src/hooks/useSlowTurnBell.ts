import { useEffect, useRef, useState } from "react";

export const SLOW_TURN_MS = 12_000;
export const BELL_COOLDOWN_MS = 4_000;

type Options = {
  currentPlayerId: string | null | undefined;
  /** Pause timer during ceremony, round end, etc. */
  paused?: boolean;
  /** Skip timer for CPU seats — they auto-play quickly. */
  isCpuPlayer?: boolean;
};

export function useSlowTurnBell({
  currentPlayerId,
  paused = false,
  isCpuPlayer = false,
}: Options) {
  const turnStartedAtRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    turnStartedAtRef.current = Date.now();
    setElapsedMs(0);
  }, [currentPlayerId, paused]);

  useEffect(() => {
    if (paused || !currentPlayerId) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - turnStartedAtRef.current);
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [currentPlayerId, paused]);

  const slowTurnActive =
    !paused &&
    !isCpuPlayer &&
    !!currentPlayerId &&
    elapsedMs >= SLOW_TURN_MS;

  const canRingBell = (targetPlayerId: string, localPlayerId: string | null) =>
    slowTurnActive &&
    targetPlayerId === currentPlayerId &&
    targetPlayerId !== localPlayerId &&
    Date.now() >= cooldownUntil;

  const registerBellRing = () => {
    setCooldownUntil(Date.now() + BELL_COOLDOWN_MS);
  };

  return {
    slowTurnActive,
    canRingBell,
    registerBellRing,
    elapsedMs,
  };
}
