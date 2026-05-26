// services/wallpaper.ts
// Helper to persist and retrieve user-chosen wallpaper images and a tint color
// for felt-style wallpapers. Returns either a local require(...) object for
// the default wallpaper or an { uri } object for a device image. If the stored
// value is an asset marker (e.g. 'asset:felt_grey') it will return the
// corresponding bundled require.

const STORAGE_KEY = "@ps_and_as_wallpaper";
const STORAGE_TINT_KEY = "@ps_and_as_wallpaper_tint";

export const DEFAULT_WALLPAPER = require("../../assets/ps_and_as_bg.png");
export const FELT_WALLPAPER = require("../../assets/felt_grey.png");
const FELT_GREY_ASSET_MARKER = "asset:felt_grey";
export type FeltPreset = {
  hex: string;
  name: string;
};

/** Classic card-table felt tints (approximate swatches over grey felt texture). */
export const FELT_PRESETS: FeltPreset[] = [
  { hex: "#0f5132", name: "Casino Green" },
  { hex: "#6b1c23", name: "Baccarat Red" },
  { hex: "#1e3a5f", name: "Tournament Blue" },
  { hex: "#2a2a2a", name: "Charcoal" },
  { hex: "#4a2352", name: "Royal Purple" },
  { hex: "#5a8a3d", name: "Olive Green" },
];

export const DEFAULT_FELT_COLOR = FELT_PRESETS[0].hex;

/** Accept `#rrggbb`, `rrggbb`, or `#rrggbbaa` and return a canonical `#rrggbb`. */
export function normalizeHexColor(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{8}$/.test(withHash)) {
    return withHash.slice(0, 7).toLowerCase();
  }
  return null;
}

export async function getWallpaperUri(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    return val || null;
  } catch (e) {
    return null;
  }
}

export async function setWallpaperUri(uri: string | null): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    if (!uri) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, uri);
  } catch (e) {
    // ignore storage failures
  }
}

export async function getWallpaperTint(): Promise<string | null> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const val = await AsyncStorage.getItem(STORAGE_TINT_KEY);
    return val || DEFAULT_FELT_COLOR;
  } catch (e) {
    return DEFAULT_FELT_COLOR;
  }
}

export async function setWallpaperTint(hex: string | null): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    if (!hex) {
      await AsyncStorage.removeItem(STORAGE_TINT_KEY);
      return;
    }
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;
    await AsyncStorage.setItem(STORAGE_TINT_KEY, normalized);
  } catch (e) {
    // ignore
  }
}

export async function getWallpaperSource(): Promise<any> {
  const uri = await getWallpaperUri();
  // When there is no explicit user-selected image, use the bundled felt texture
  // as the default background so the feltColor overlay can be applied.
  if (!uri) return FELT_WALLPAPER;

  if (uri === FELT_GREY_ASSET_MARKER) {
    return FELT_WALLPAPER;
  }

  return { uri };
}

export async function resetWallpaper(): Promise<void> {
  await setWallpaperUri(null);
  await setWallpaperTint(null);
}

export { FELT_GREY_ASSET_MARKER };
