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
  return "https://ko-fi.com/shifuguru";
}
