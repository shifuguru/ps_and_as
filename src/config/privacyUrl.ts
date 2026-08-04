/**
 * Player-facing privacy policy URL (GitHub Pages).
 * Override with EXPO_PUBLIC_PRIVACY_URL when hosting elsewhere.
 */
export function resolvePrivacyUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env?.EXPO_PUBLIC_PRIVACY_URL?.trim()
      : "";
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && window.location?.origin) {
    const base =
      (globalThis as { __PS_AND_AS_BASE__?: string }).__PS_AND_AS_BASE__ ||
      (window.location.pathname.includes("/ps_and_as")
        ? "/ps_and_as"
        : "");
    const origin = window.location.origin;
    if (base) return `${origin}${base.replace(/\/+$/, "")}/privacy.html`;
    return `${origin}/privacy.html`;
  }

  return "https://shifuguru.github.io/ps_and_as/privacy.html";
}

/** GitHub security policy / disclosure landing. */
export function resolveSecurityPolicyUrl(): string {
  return "https://github.com/shifuguru/ps_and_as/security/policy";
}
