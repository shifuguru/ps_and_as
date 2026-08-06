/**
 * Smoke test for resolvePrivacyUrl defaults used by Play Console / Settings.
 */
import assert from "assert";
import { resolvePrivacyUrl, resolveSecurityPolicyUrl } from "../src/config/privacyUrl";

const DEFAULT_PRIVACY = "https://shifuguru.github.io/ps_and_as/privacy.html";

delete process.env.EXPO_PUBLIC_PRIVACY_URL;
assert.strictEqual(resolvePrivacyUrl(), DEFAULT_PRIVACY);

process.env.EXPO_PUBLIC_PRIVACY_URL = "https://example.com/privacy";
assert.strictEqual(resolvePrivacyUrl(), "https://example.com/privacy");
delete process.env.EXPO_PUBLIC_PRIVACY_URL;

assert.strictEqual(
  resolveSecurityPolicyUrl(),
  "https://github.com/shifuguru/ps_and_as/security/policy",
);

console.log("test-privacy-url: ok");
