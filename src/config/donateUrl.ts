/**
 * Voluntary support link for Keep the Lights On.
 * Override with EXPO_PUBLIC_DONATE_URL when available.
 */
export function resolveDonateUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env?.EXPO_PUBLIC_DONATE_URL?.trim()
      : "";
  if (fromEnv) return fromEnv;
  // Public GitHub Sponsors-style fallback — update when a real link is set.
  return "https://github.com/sponsors/shifuguru";
}
