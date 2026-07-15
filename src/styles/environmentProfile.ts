import type { ThemeMode } from "./themeColors";

/**
 * First-class environmental art direction.
 * Theme → Environment → Glass. Glass opacity is never compensated here.
 */
export type EnvironmentProfile = {
  /** Overall table luminance cue (0–1). */
  ambientBrightness: number;
  /** Warmth of ambient fill — 0 cool / 1 warm casino (0–1). */
  ambientWarmth: number;
  /** Felt surface lift relative to raw tint (0–1). */
  feltBrightness: number;
  /** Multiplier on felt hue saturation (≈0.9–1.2). */
  feltSaturation: number;
  /** Texture visibility / contrast (≈0.85–1.2). */
  feltTextureStrength: number;
  /** Edge vignette intensity multiplier. */
  vignetteStrength: number;
  /** Softness of vignette falloff (higher = softer centre). */
  vignetteRadius: number;
  /** Soft depth under glass cards (do not crank). */
  shadowOpacity: number;
  /** Soft shadow blur radius (px cue). */
  shadowSoftness: number;
  /** Soft table-centre glow under gameplay. */
  centreLight: number;
};

/** Dark baseline — premium casino table under warm light. Do not darken further. */
export const ENVIRONMENT_DARK: EnvironmentProfile = {
  ambientBrightness: 0.4,
  ambientWarmth: 0.58,
  feltBrightness: 0.5,
  feltSaturation: 1.1,
  feltTextureStrength: 1.02,
  vignetteStrength: 1,
  vignetteRadius: 1,
  shadowOpacity: 0.24,
  shadowSoftness: 12,
  centreLight: 0.16,
};

/** Light — sunlit felt; keep glass transparent and less minty. */
export const ENVIRONMENT_LIGHT: EnvironmentProfile = {
  ambientBrightness: 0.74,
  ambientWarmth: 0.42,
  feltBrightness: 0.8,
  feltSaturation: 1.14,
  feltTextureStrength: 1.16,
  vignetteStrength: 0.52,
  vignetteRadius: 1.08,
  shadowOpacity: 0.13,
  shadowSoftness: 10,
  centreLight: 0.2,
};

export function environmentProfileForMode(mode: ThemeMode): EnvironmentProfile {
  return mode === "light" ? ENVIRONMENT_LIGHT : ENVIRONMENT_DARK;
}
