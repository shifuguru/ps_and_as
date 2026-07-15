import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { createUiStyles, type UiStyles } from "../styles/createUiStyles";
import {
  buildThemeBundle,
  type AppThemeColors,
  type FeltPalette,
  type ThemeMode,
} from "../styles/themeColors";
import {
  getAppearancePreference,
  getTextContrastPreference,
  setAppearancePreference as persistAppearancePreference,
  setTextContrastPreference as persistTextContrastPreference,
  type AppearancePreference,
  type TextContrastPreference,
} from "../services/themePreferences";
import {
  DEFAULT_FELT_COLOR,
  getWallpaperTint,
} from "../services/wallpaper";

type ThemeContextValue = {
  mode: ThemeMode;
  appearancePreference: AppearancePreference;
  textContrastPreference: TextContrastPreference;
  feltTint: string;
  palette: FeltPalette;
  colors: AppThemeColors;
  ui: UiStyles;
  blur: AppThemeColors["blur"];
  environment: AppThemeColors["environment"];
  setAppearancePreference: (preference: AppearancePreference) => Promise<void>;
  setTextContrastPreference: (preference: TextContrastPreference) => Promise<void>;
  setFeltTint: (hex: string) => void;
  refreshFeltTint: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(
  preference: AppearancePreference,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeMode {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemScheme === "light" ? "light" : "dark";
}

function buildValue(
  feltTint: string,
  mode: ThemeMode,
  textContrastPreference: TextContrastPreference,
  appearancePreference: AppearancePreference,
  setters: Pick<
    ThemeContextValue,
    | "setAppearancePreference"
    | "setTextContrastPreference"
    | "setFeltTint"
    | "refreshFeltTint"
  >,
): ThemeContextValue {
  const { colors, palette } = buildThemeBundle(
    feltTint,
    mode,
    textContrastPreference,
  );
  return {
    mode,
    appearancePreference,
    textContrastPreference,
    feltTint,
    palette,
    colors,
    ui: createUiStyles(colors),
    blur: colors.blur,
    environment: colors.environment,
    ...setters,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearancePreference, setAppearancePreferenceState] =
    useState<AppearancePreference>("system");
  const [textContrastPreference, setTextContrastPreferenceState] =
    useState<TextContrastPreference>("auto");
  const [feltTint, setFeltTintState] = useState(DEFAULT_FELT_COLOR);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const [appearance, textContrast, tint] = await Promise.all([
        getAppearancePreference(),
        getTextContrastPreference(),
        getWallpaperTint(),
      ]);
      setAppearancePreferenceState(appearance);
      setTextContrastPreferenceState(textContrast);
      setFeltTintState(tint ?? DEFAULT_FELT_COLOR);
      setPrefsLoaded(true);
    })();
  }, []);

  const mode = resolveMode(appearancePreference, systemScheme);

  const setAppearancePreference = useCallback(
    async (preference: AppearancePreference) => {
      setAppearancePreferenceState(preference);
      await persistAppearancePreference(preference);
    },
    [],
  );

  const setTextContrastPreference = useCallback(
    async (preference: TextContrastPreference) => {
      setTextContrastPreferenceState(preference);
      await persistTextContrastPreference(preference);
    },
    [],
  );

  const setFeltTint = useCallback((hex: string) => {
    setFeltTintState(hex);
  }, []);

  const refreshFeltTint = useCallback(async () => {
    const tint = await getWallpaperTint();
    setFeltTintState(tint ?? DEFAULT_FELT_COLOR);
  }, []);

  const setters = {
    setAppearancePreference,
    setTextContrastPreference,
    setFeltTint,
    refreshFeltTint,
  };

  const value = useMemo(
    () =>
      buildValue(
        feltTint,
        mode,
        textContrastPreference,
        appearancePreference,
        setters,
      ),
    [
      feltTint,
      mode,
      textContrastPreference,
      appearancePreference,
      setAppearancePreference,
      setTextContrastPreference,
      setFeltTint,
      refreshFeltTint,
    ],
  );

  if (!prefsLoaded) {
    return (
      <ThemeContext.Provider
        value={buildValue(
          DEFAULT_FELT_COLOR,
          resolveMode("system", systemScheme),
          "auto",
          "system",
          setters,
        )}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const fallback = buildThemeBundle(DEFAULT_FELT_COLOR, "dark", "auto");
    return {
      mode: "dark",
      appearancePreference: "system",
      textContrastPreference: "auto",
      feltTint: DEFAULT_FELT_COLOR,
      palette: fallback.palette,
      colors: fallback.colors,
      ui: createUiStyles(fallback.colors),
      blur: fallback.colors.blur,
      environment: fallback.colors.environment,
      setAppearancePreference: async () => {},
      setTextContrastPreference: async () => {},
      setFeltTint: () => {},
      refreshFeltTint: async () => {},
    };
  }
  return ctx;
}
