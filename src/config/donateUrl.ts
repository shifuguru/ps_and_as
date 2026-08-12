/**
 * Voluntary support link for the Player Hub Ko-fi button.
 * Override with EXPO_PUBLIC_DONATE_URL when available.
 */
export function resolveDonateUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env?.EXPO_PUBLIC_DONATE_URL?.trim()
      : "";
  if (fromEnv) return fromEnv;
  // Opens Ko-fi's tip/payment form directly (not the full profile feed).
  return "https://ko-fi.com/shifuguru/tip";
}
