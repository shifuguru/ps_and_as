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

/** Grey felt texture base before tint overlay. */
export const FELT_TEXTURE_BASE = "#333333";
export const FELT_TINT_OPACITY = 0.82;
const AUTO_LUMINANCE_THRESHOLD = 0.38;

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
  const accent = isDark ? palette.complementBright : palette.complementDim;
  const ink = shellNeutral(mode, palette.feltHue);
  const textPrimary = rgbToHex(ink);
  const textSecondary = hexToRgba(textPrimary, 0.88);
  const textMuted = hexToRgba(textPrimary, isDark ? 0.55 : 0.58);

  const surface = isDark
    ? hslToHex(palette.feltHue, 12, 7)
    : hslToHex(palette.feltHue, 5, 97);

  // Light mode: frosted white glass. Dark mode: frosted light scrim.
  const frost = isDark ? textPrimary : "#ffffff";
  const frostLine = isDark ? frost : "#ffffff";

  const glassLine = isDark ? 0.14 : 0.14;

  return {
    mode,
    onFelt,
    gold: accent,
    textPrimary,
    textSecondary,
    textMuted,
    textOnGold: "#FFFFFF",
    panelBorder: isDark
      ? hexToRgba(frostLine, glassLine)
      : hexToRgba(accent, 0.18),
    inputBg: isDark ? hexToRgba(frost, 0.08) : hexToRgba(frost, 0.94),
    inputBorder: isDark
      ? hexToRgba(frost, 0.16)
      : hexToRgba(accent, 0.12),
    inputText: textPrimary,
    btnGoldBg: hexToRgba(accent, isDark ? 0.16 : 0.1),
    btnGoldBorder: hexToRgba(accent, isDark ? 0.28 : 0.22),
    btnGoldText: accent,
    btnSecondaryBg: hexToRgba(frost, isDark ? 0.08 : 0.88),
    btnSecondaryBorder: isDark
      ? hexToRgba(frostLine, glassLine)
      : hexToRgba(accent, 0.14),
    btnSecondaryText: isDark ? hexToRgba(frost, 0.9) : textPrimary,
    btnGhostBorder: hexToRgba(isDark ? frost : accent, isDark ? 0.12 : 0.14),
    btnGhostText: hexToRgba(textPrimary, isDark ? 0.65 : 0.72),
    actionTrackBg: hexToRgba(frost, isDark ? 0.06 : 0.52),
    actionTrackBorder: isDark
      ? hexToRgba(frost, 0.12)
      : hexToRgba(accent, 0.14),
    actionPrimaryBg: hexToRgba(accent, isDark ? 0.18 : 0.12),
    actionPrimaryBorder: hexToRgba(accent, isDark ? 0.32 : 0.22),
    actionPrimaryText: accent,
    actionPrimaryDisabledBg: hexToRgba(frost, isDark ? 0.04 : 0.38),
    actionPrimaryDisabledBorder: hexToRgba(
      isDark ? frost : accent,
      isDark ? 0.1 : 0.1,
    ),
    actionPrimaryDisabledText: hexToRgba(
      textPrimary,
      isDark ? 0.35 : 0.42,
    ),
    actionSecondaryBg: hexToRgba(frost, isDark ? 0.06 : 0.46),
    actionSecondaryBorder: isDark
      ? hexToRgba(frostLine, glassLine)
      : hexToRgba(accent, 0.12),
    actionSecondaryText: isDark ? hexToRgba(frost, 0.88) : textPrimary,
    leaveButtonBg: hexToRgba(frost, isDark ? 0.12 : 0.9),
    leaveButtonBorder: isDark
      ? hexToRgba(frostLine, glassLine)
      : hexToRgba(accent, 0.16),
    leaveButtonText: isDark ? hexToRgba(frost, 0.9) : textPrimary,
    leaveButtonLiveBg: hexToRgba(accent, isDark ? 0.18 : 0.12),
    leaveButtonLiveBorder: hexToRgba(accent, isDark ? 0.32 : 0.22),
    leaveButtonLiveText: accent,
    leaveText: accent,
    modalOverlay: hexToRgba("#000000", isDark ? 0.62 : 0.22),
    modalBorder: isDark
      ? hexToRgba(frostLine, glassLine)
      : hexToRgba(accent, 0.14),
    modalBody: textPrimary,
    emptyTitle: hexToRgba(textPrimary, 0.92),
    emptyBody: hexToRgba(textPrimary, 0.58),
    surface,
    feltWash: "transparent",
    fullscreenScrim: hexToRgba(surface, isDark ? 0.58 : 0.4),
    statusBarStyle: isDark ? "light" : "dark",
    blur: {
      chrome: {
        intensity: isDark ? 40 : 36,
        scrimOpacity: isDark ? 0.14 : 0.11,
        webOpacity: isDark ? 0.04 : 0.26,
        tint: isDark ? "dark" : "light",
      },
      panel: {
        intensity: isDark ? 48 : 44,
        scrimOpacity: isDark ? 0.22 : 0.15,
        webOpacity: isDark ? 0.06 : 0.34,
        tint: isDark ? "dark" : "light",
      },
      modal: {
        intensity: isDark ? 62 : 50,
        scrimOpacity: isDark ? 0.22 : 0.17,
        webOpacity: isDark ? 0.06 : 0.38,
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
