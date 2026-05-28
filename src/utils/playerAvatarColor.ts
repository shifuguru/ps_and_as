import { deriveFeltPalette } from "../styles/feltPalette";
import {
  DEFAULT_FELT_COLOR,
  FELT_PRESETS,
  normalizeHexColor,
} from "../services/wallpaper";

function seatIndexFromPlayerId(playerId: string, count: number): number {
  let n = 0;
  for (let i = 0; i < playerId.length; i++) n += playerId.charCodeAt(i);
  return n % count;
}

/** Stable preset tint for offline CPU seats (not tied to the local player's theme). */
export function cpuFeltTintForId(playerId: string): string {
  let n = 0;
  for (let i = 0; i < playerId.length; i++) n += playerId.charCodeAt(i);
  return FELT_PRESETS[n % FELT_PRESETS.length].hex;
}

/** Avatar circle fill derived from a player's saved felt tint. */
export function playerAvatarBackgroundColor(
  playerId: string,
  feltTint?: string | null,
  options?: { isCpu?: boolean },
): string {
  const palette = playerThemePalette(feltTint, playerId, options?.isCpu);
  return palette.seatColors[seatIndexFromPlayerId(playerId, palette.seatColors.length)];
}

export function playerThemePalette(
  feltTint?: string | null,
  playerId?: string,
  isCpu?: boolean,
) {
  const normalized = feltTint ? normalizeHexColor(feltTint) : null;
  const hex = normalized
    ? normalized
    : isCpu && playerId
      ? cpuFeltTintForId(playerId)
      : DEFAULT_FELT_COLOR;
  return deriveFeltPalette(hex);
}
