export const TRICK_WIN_SHOUTS = [
  "Let's Go!",
  "Yeah!",
  "Break It Down!",
  "Woo!",
  "Come On!",
  "Yes!",
  "Take That!",
  "Too Easy!",
  "Boom!",
  "In Your Face!",
  "Get Some!",
  "Nice!",
] as const;

export const RUN_BONUS_SHOUTS = [
  "On Fire!",
  "Run It Back!",
  "Unstoppable!",
  "Keep Going!",
  "They Can't Stop Us!",
  "Heating Up!",
] as const;

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Pick a consistent shout for a trick winner (varies by player + trick index). */
export function pickTrickShout(
  playerId: string,
  trickIndex: number,
  hasRunBonus = false,
): string {
  const pool = hasRunBonus ? RUN_BONUS_SHOUTS : TRICK_WIN_SHOUTS;
  const seed = hashSeed(`${playerId}:${trickIndex}:${hasRunBonus ? "run" : "win"}`);
  return pool[seed % pool.length];
}
