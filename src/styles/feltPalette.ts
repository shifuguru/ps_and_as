import type { TextContrastPreference } from "../services/themePreferences";
import { DEFAULT_FELT_COLOR } from "../services/wallpaper";
import {
  clamp,
  hexToRgb,
  hexToRgba,
  hslToHex,
  hslToRgb,
  mixRgb,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
  type Rgb,
} from "../utils/colorTheory";
import type {
  AppThemeColors,
  FeltTextColors,
  ThemeMode,
} from "./themeColors";
import {
  environmentProfileForMode,
  type EnvironmentProfile,
} from "./environmentProfile";

/** Grey felt texture base before tint overlay. */
export const FELT_TEXTURE_BASE = "#333333";
/** Canonical dark tint density over texture. */
export const FELT_TINT_OPACITY = 0.82;

const AUTO_LUMINANCE_THRESHOLD = 0.38;

export type FeltEnvironmentPaint = {
  displayTint: string;
  tintOpacity: number;
  /** Warm ambient wash opacity (environment lighting). */
  ambientWashOpacity: number;
  /** CSS rgba channels for warm ambient wash (no alpha). */
  ambientWashRgb: string;
  /** CSS/filter strength for felt texture. */
  textureStrength: number;
  /** Soft centre light opacity for table glow. */
  centreLight: number;
  profile: EnvironmentProfile;
};

function ambientWashChannels(warmth: number): string {
  // Higher warmth → amber cream; lower → cooler ivory (still not mint-white).
  const g = Math.round(250 - warmth * 10);
  const b = Math.round(238 - warmth * 28);
  return `255, ${g}, ${b}`;
}

/**
 * Environment lighting for the felt — mode changes the table, not the glass.
 */
export function resolveFeltEnvironment(
  tintHex: string,
  mode: ThemeMode,
): FeltEnvironmentPaint {
  const profile = environmentProfileForMode(mode);
  const washRgb = ambientWashChannels(profile.ambientWarmth);
  const tint = hexToRgb(tintHex);
  if (!tint) {
    return {
      displayTint: tintHex,
      tintOpacity: mode === "light" ? 0.66 : FELT_TINT_OPACITY,
      ambientWashOpacity: mode === "light" ? 0.1 : 0.04,
      ambientWashRgb: washRgb,
      textureStrength: profile.feltTextureStrength,
      centreLight: profile.centreLight,
      profile,
    };
  }

  const { h, s, l } = rgbToHsl(tint);
  const sat = clamp(s * profile.feltSaturation, 8, 92);
  // Brightness via HSL lift — not via painting glass.
  const lightLift =
    mode === "light"
      ? (profile.feltBrightness - 0.5) * 28
      : (profile.feltBrightness - 0.5) * 6;
  const displayTint = hslToHex(h, sat, clamp(l + lightLift, 8, 72));

  const tintOpacity =
    mode === "light"
      ? clamp(0.58 + profile.feltTextureStrength * 0.06, 0.58, 0.72)
      : FELT_TINT_OPACITY;

  // Dark: tiny warm ambient for casino depth. Light: warmer wash, less white fog.
  const ambientWashOpacity =
    mode === "light"
      ? clamp(
          0.05 +
            profile.ambientWarmth * 0.07 +
            profile.ambientBrightness * 0.04,
          0.06,
          0.12,
        )
      : clamp(
          profile.ambientWarmth * 0.04 + profile.ambientBrightness * 0.02,
          0.02,
          0.05,
        );

  return {
    displayTint,
    tintOpacity,
    ambientWashOpacity,
    ambientWashRgb: washRgb,
    textureStrength: profile.feltTextureStrength,
    centreLight: profile.centreLight,
    profile,
  };
}

/** Frost fill RGB for glass — hue of felt, never pure white (reduces mint cast). */
export function resolveFrostRgb(
  mode: ThemeMode,
  feltHue: number,
): string {
  if (mode === "dark") {
    // Deep felt-ink glass
    const rgb = hslToRgb({ h: feltHue, s: 28, l: 8 });
    return `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
  }
  // Warm ivory tinted by felt hue — sunlit glass, not mint white
  const rgb = hslToRgb({ h: feltHue, s: 14, l: 96 });
  return `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
}

/** Monochrome palette derived from the active table felt tint. */
export type FeltPalette = {
  feltHex: string;
  feltSurface: string;
  feltHue: number;
  /** Mid accent — same hue as felt, lifted for UI chrome. */
  complement: string;
  complementBright: string;
  complementDim: string;
  /** Three lightness steps on the felt hue (deep → mid → light). */
  triad: readonly [string, string, string];
  /** Two softer steps between mid and light. */
  analogous: readonly [string, string];
  seatColors: readonly string[];
  celebrationColors: readonly string[];
};

export function blendFeltSurface(tintHex: string): string {
  const tint = hexToRgb(tintHex);
  const base = hexToRgb(FELT_TEXTURE_BASE);
  if (!tint || !base) return FELT_TEXTURE_BASE;
  return rgbToHex(mixRgb(base, tint, FELT_TINT_OPACITY));
}

function monoTone(hue: number, saturation: number, lightness: number): string {
  return hslToHex(hue, clamp(saturation, 0, 100), clamp(lightness, 0, 100));
}

/** Seat avatars: same felt hue, varied lightness/saturation only. */
function buildSeatColors(feltHue: number, feltSat: number): string[] {
  const steps = [
    { s: 0.55, l: 38 },
    { s: 0.48, l: 44 },
    { s: 0.62, l: 40 },
    { s: 0.42, l: 48 },
    { s: 0.58, l: 36 },
    { s: 0.5, l: 46 },
    { s: 0.65, l: 42 },
    { s: 0.45, l: 50 },
  ];
  return steps.map(({ s, l }) =>
    monoTone(feltHue, feltSat * s, l),
  );
}

export function deriveFeltPalette(feltHex: string): FeltPalette {
  const felt = hexToRgb(feltHex) ?? hexToRgb(DEFAULT_FELT_COLOR)!;
  const { h: feltHue, s: feltSat, l: feltLight } = rgbToHsl(felt);

  const accentSat = clamp(feltSat * 0.72, 22, 68);
  const complementDim = monoTone(feltHue, clamp(feltSat * 0.85, 28, 72), clamp(feltLight + 14, 28, 42));
  const complement = monoTone(feltHue, accentSat, clamp(feltLight + 32, 46, 58));
  const complementBright = monoTone(feltHue, clamp(accentSat * 0.82, 18, 55), clamp(feltLight + 54, 68, 82));

  const triad = [
    monoTone(feltHue, clamp(feltSat * 0.9, 30, 75), clamp(feltLight + 8, 24, 38)),
    complement,
    complementBright,
  ] as const;

  const analogous = [
    monoTone(feltHue, accentSat * 0.9, clamp(feltLight + 42, 54, 64)),
    monoTone(feltHue, accentSat * 0.95, clamp(feltLight + 48, 60, 74)),
  ] as const;

  const seatColors = buildSeatColors(feltHue, feltSat);
  const celebrationColors = [
    complementBright,
    complement,
    triad[0],
    analogous[0],
    analogous[1],
    monoTone(feltHue, accentSat * 0.6, 78),
    "#ffffff",
    blendFeltSurface(feltHex),
  ] as const;

  return {
    feltHex,
    feltSurface: blendFeltSurface(feltHex),
    feltHue,
    complement,
    complementBright,
    complementDim,
    triad,
    analogous,
    seatColors,
    celebrationColors,
  };
}

export function resolveTextVariant(
  feltHex: string,
  preference: TextContrastPreference,
): "light" | "dark" {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  const surface = blendFeltSurface(feltHex);
  return relativeLuminance(surface) < AUTO_LUMINANCE_THRESHOLD ? "light" : "dark";
}

/** Prefer the user's text choice, but never pick an unreadable pairing on the felt. */
export function effectiveOnFeltVariant(
  feltHex: string,
  preference: TextContrastPreference,
): "light" | "dark" {
  const autoVariant = resolveTextVariant(feltHex, "auto");
  if (preference === "auto") return autoVariant;
  const forced = preference === "light" ? "light" : "dark";
  if (forced === "dark" && autoVariant === "light") return "light";
  if (forced === "light" && autoVariant === "dark") return "dark";
  return forced;
}

function tintedNeutral(hue: number, variant: "light" | "dark", alpha = 1): string {
  const rgb =
    variant === "light"
      ? hslToRgb({ h: hue, s: 6, l: 97 })
      : hslToRgb({ h: hue, s: 8, l: 13 });
  if (alpha >= 1) return rgbToHex(rgb);
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(
    rgb.b,
  )}, ${alpha})`;
}

export function computeOnFeltColors(
  feltHex: string,
  variant: "light" | "dark",
): FeltTextColors {
  const palette = deriveFeltPalette(feltHex);
  const accent =
    variant === "light" ? palette.complementBright : palette.complementDim;

  if (variant === "light") {
    return {
      textPrimary: tintedNeutral(palette.feltHue, "light"),
      textSecondary: tintedNeutral(palette.feltHue, "light", 0.88),
      textMuted: tintedNeutral(palette.feltHue, "light", 0.55),
      accent,
      leaveText: accent,
      textShadow: "rgba(0, 0, 0, 0.42)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    };
  }

  return {
    textPrimary: tintedNeutral(palette.feltHue, "dark"),
    textSecondary: tintedNeutral(palette.feltHue, "dark", 0.88),
    textMuted: tintedNeutral(palette.feltHue, "dark", 0.55),
    accent,
    leaveText: accent,
    // Halo shadow keeps ink color but reads darker / bolder on light felts.
    textShadow: "rgba(0, 0, 0, 0.62)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  };
}

export function computeOnFeltFromPreferences(
  feltHex: string,
  preference: TextContrastPreference,
): FeltTextColors {
  return computeOnFeltColors(
    feltHex,
    effectiveOnFeltVariant(feltHex, preference),
  );
}

function shellNeutral(mode: ThemeMode, feltHue: number): Rgb {
  return hslToRgb({
    h: feltHue,
    s: mode === "dark" ? 6 : 8,
    l: mode === "dark" ? 97 : 11,
  });
}

function buildShellColors(
  mode: ThemeMode,
  palette: FeltPalette,
  onFelt: FeltTextColors,
): AppThemeColors {
  const isDark = mode === "dark";
  const environment = environmentProfileForMode(mode);
  const accent = isDark ? palette.complementBright : palette.complementDim;
  const ink = shellNeutral(mode, palette.feltHue);
  // Micro-contrast: slightly brighter titles, clearer secondary/muted separation.
  const textPrimary = rgbToHex(ink);
  const textSecondary = hexToRgba(textPrimary, isDark ? 0.9 : 0.86);
  const textMuted = hexToRgba(textPrimary, isDark ? 0.5 : 0.62);

  const surface = isDark
    ? hslToHex(palette.feltHue, 12, 7)
    : hslToHex(palette.feltHue, 5, 97);

  // Frost tint by mode + felt hue; opacity stays in the translucent blur band.
  const frostRgb = resolveFrostRgb(mode, palette.feltHue);
  const frost = isDark
    ? textPrimary
    : hslToHex(palette.feltHue, 14, 96);
  const frostLine = frost;
  // Edge highlight — slight separation from felt without raising fill opacity.
  const glassLine = isDark ? 0.16 : 0.2;

  return {
    mode,
    onFelt,
    gold: accent,
    textPrimary,
    textSecondary,
    textMuted,
    textOnGold: "#FFFFFF",
    panelBorder: hexToRgba(frostLine, glassLine),
    // Translucent glass fills — never approach card-face brightness.
    inputBg: hexToRgba(frost, isDark ? 0.1 : 0.28),
    inputBorder: hexToRgba(frost, isDark ? 0.16 : 0.18),
    inputText: textPrimary,
    btnGoldBg: hexToRgba(accent, isDark ? 0.16 : 0.12),
    btnGoldBorder: hexToRgba(accent, isDark ? 0.28 : 0.24),
    btnGoldText: accent,
    btnSecondaryBg: hexToRgba(frost, isDark ? 0.1 : 0.22),
    btnSecondaryBorder: hexToRgba(frostLine, glassLine),
    btnSecondaryText: isDark ? hexToRgba(frost, 0.9) : textPrimary,
    btnGhostBorder: hexToRgba(frost, isDark ? 0.12 : 0.16),
    btnGhostText: hexToRgba(textPrimary, isDark ? 0.65 : 0.72),
    actionTrackBg: hexToRgba(frost, isDark ? 0.06 : 0.12),
    actionTrackBorder: hexToRgba(frost, isDark ? 0.14 : 0.16),
    actionPrimaryBg: hexToRgba(accent, isDark ? 0.18 : 0.14),
    actionPrimaryBorder: hexToRgba(accent, isDark ? 0.32 : 0.26),
    actionPrimaryText: accent,
    actionPrimaryDisabledBg: hexToRgba(frost, isDark ? 0.04 : 0.12),
    actionPrimaryDisabledBorder: hexToRgba(frost, isDark ? 0.1 : 0.12),
    actionPrimaryDisabledText: hexToRgba(
      textPrimary,
      isDark ? 0.35 : 0.42,
    ),
    actionSecondaryBg: hexToRgba(frost, isDark ? 0.06 : 0.16),
    actionSecondaryBorder: hexToRgba(frostLine, glassLine),
    actionSecondaryText: isDark ? hexToRgba(frost, 0.88) : textPrimary,
    leaveButtonBg: hexToRgba(frost, isDark ? 0.12 : 0.22),
    leaveButtonBorder: hexToRgba(frostLine, glassLine),
    leaveButtonText: isDark ? hexToRgba(frost, 0.9) : textPrimary,
    leaveButtonLiveBg: hexToRgba(accent, isDark ? 0.18 : 0.14),
    leaveButtonLiveBorder: hexToRgba(accent, isDark ? 0.32 : 0.26),
    leaveButtonLiveText: isDark ? hexToRgba(frost, 0.88) : textPrimary,
    leaveText: accent,
    modalOverlay: hexToRgba("#000000", isDark ? 0.62 : 0.28),
    modalBorder: hexToRgba(frostLine, glassLine),
    modalBody: textPrimary,
    emptyTitle: hexToRgba(textPrimary, 0.96),
    emptyBody: hexToRgba(textPrimary, isDark ? 0.52 : 0.6),
    surface,
    feltWash: "transparent",
    fullscreenScrim: hexToRgba(surface, isDark ? 0.58 : 0.32),
    statusBarStyle: isDark ? "light" : "dark",
    frostRgb,
    environment,
    // Glass opacity is mode-neutral — environment carries theme brightness.
    blur: {
      chrome: {
        intensity: isDark ? 48 : 46,
        scrimOpacity: 0.08,
        webOpacity: 0.1,
        tint: isDark ? "dark" : "light",
      },
      panel: {
        intensity: isDark ? 48 : 46,
        scrimOpacity: 0.18,
        webOpacity: 0.2,
        tint: isDark ? "dark" : "light",
      },
      modal: {
        intensity: isDark ? 72 : 64,
        scrimOpacity: 0.28,
        webOpacity: 0.28,
        tint: isDark ? "dark" : "light",
      },
    },
  };
}

export function buildAppTheme(
  feltHex: string,
  mode: ThemeMode,
  textContrast: TextContrastPreference,
): AppThemeColors {
  const palette = deriveFeltPalette(feltHex);
  const onFelt = computeOnFeltFromPreferences(feltHex, textContrast);
  return buildShellColors(mode, palette, onFelt);
}

export function buildThemeBundle(
  feltHex: string,
  mode: ThemeMode,
  textContrast: TextContrastPreference,
): { colors: AppThemeColors; palette: FeltPalette } {
  const palette = deriveFeltPalette(feltHex);
  const onFelt = computeOnFeltFromPreferences(feltHex, textContrast);
  return {
    palette,
    colors: buildShellColors(mode, palette, onFelt),
  };
}

/** @deprecated Use `buildAppTheme` — kept for legacy static imports. */
export function themeForMode(
  scheme: "light" | "dark" | null | undefined,
): AppThemeColors {
  return buildAppTheme(DEFAULT_FELT_COLOR, scheme === "light" ? "light" : "dark", "auto");
}
