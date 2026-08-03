/**
 * Google account id helpers + status gating.
 * Run: npx tsx ./scripts/test-google-account-sync.ts
 */
import assert from "assert";
import Module from "module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "react-native") {
    return {
      Platform: { OS: "web", select: (x: Record<string, unknown>) => x.web },
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

async function run() {
  const prev = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const {
    getGoogleAccountSyncStatus,
    getGoogleSignInButtonLabel,
    getGoogleWebClientId,
    parseGoogleSub,
    toGoogleAccountId,
  } = await import("../src/services/googleAccountSync");

  assert.strictEqual(getGoogleWebClientId(), null);
  assert.strictEqual(getGoogleAccountSyncStatus(), "coming_soon");
  assert.ok(getGoogleSignInButtonLabel().toLowerCase().includes("soon"));

  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
    "123456789-test.apps.googleusercontent.com";
  assert.strictEqual(
    getGoogleWebClientId(),
    "123456789-test.apps.googleusercontent.com",
  );
  assert.strictEqual(getGoogleAccountSyncStatus(), "ready");
  assert.strictEqual(getGoogleSignInButtonLabel(), "Continue with Google");

  assert.strictEqual(toGoogleAccountId("abc123"), "google:abc123");
  assert.strictEqual(parseGoogleSub("google:abc123"), "abc123");
  assert.strictEqual(parseGoogleSub("install-xyz"), null);

  const {
    parseGoogleSub: serverParse,
    readAllowedAudiences,
  } = require("../server/googleAuth");
  assert.strictEqual(serverParse("google:sub1"), "sub1");
  assert.strictEqual(serverParse("hw-1234"), null);

  process.env.GOOGLE_CLIENT_ID = "aud-a, aud-b";
  assert.deepStrictEqual(readAllowedAudiences(), ["aud-a", "aud-b"]);

  if (prev === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = prev;
  delete process.env.GOOGLE_CLIENT_ID;

  console.log("test-google-account-sync: all assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
