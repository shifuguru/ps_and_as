/**
 * Mobile browser onboarding funnel — unit coverage.
 * Run: npx tsx ./scripts/test-web-onboarding.ts
 */
import assert from "assert";
import Module from "module";

type Store = Map<string, string>;

const memory: Store = new Map();

const asyncStorageMock = {
  async getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
  },
  async removeItem(key: string) {
    memory.delete(key);
  },
  async clear() {
    memory.clear();
  },
};

let mockOfferAddToHome = true;

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: asyncStorageMock, ...asyncStorageMock };
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "web", select: (x: Record<string, unknown>) => x.web },
    };
  }
  if (request === "../utils/webAppInstall" || request.endsWith("/utils/webAppInstall")) {
    return {
      shouldOfferAddToHomeScreen: () => mockOfferAddToHome,
    };
  }
  return originalLoad.apply(this, [request, parent, isMain]);
};

async function run() {
  // Fresh module load after mocks
  const path = require("path");
  const webInstallPath = path.resolve(__dirname, "../src/utils/webAppInstall.ts");
  const ModuleAny = Module as unknown as { _cache: Record<string, unknown> };
  // Ensure webAppInstall resolves through our mock via relative require from webOnboarding
  const {
    WEB_INSTALL_DECLINED_KEY,
    clearWebInstallDeclined,
    isWebInstallDeclined,
    markWebInstallDeclined,
    needsWebInstallCoach,
    resolveWebOnboardingState,
  } = await import("../src/services/webOnboarding");
  const {
    getGoogleAccountSyncStatus,
    getGoogleSignInButtonLabel,
    isGoogleAccountSyncOffered,
  } = await import("../src/services/googleAccountSync");

  void webInstallPath;
  void ModuleAny;

  function reset() {
    memory.clear();
    mockOfferAddToHome = true;
  }

  // Pure gate
  assert.strictEqual(
    needsWebInstallCoach({
      mobileBrowserTab: true,
      installDeclined: false,
      needsDisplayNameSetup: true,
    }),
    true,
    "fresh mobile browser + name setup → coach",
  );
  assert.strictEqual(
    needsWebInstallCoach({
      mobileBrowserTab: true,
      installDeclined: true,
      needsDisplayNameSetup: true,
    }),
    false,
    "declined install → no coach",
  );
  assert.strictEqual(
    needsWebInstallCoach({
      mobileBrowserTab: true,
      installDeclined: false,
      needsDisplayNameSetup: false,
    }),
    false,
    "existing named player → no blocking coach",
  );
  assert.strictEqual(
    needsWebInstallCoach({
      mobileBrowserTab: false,
      installDeclined: false,
      needsDisplayNameSetup: true,
    }),
    false,
    "standalone/desktop → no coach",
  );

  // Resolve: first visit mobile browser
  reset();
  mockOfferAddToHome = true;
  let snap = await resolveWebOnboardingState({ needsDisplayNameSetup: true });
  assert.strictEqual(snap.phase, "install-coach", "first visit shows install coach");
  assert.strictEqual(snap.coupleNameWithGoogleSync, false);

  // Decline → couple name with Google sync
  await markWebInstallDeclined();
  assert.strictEqual(await isWebInstallDeclined(), true);
  assert.strictEqual(
    memory.get(WEB_INSTALL_DECLINED_KEY),
    "1",
    "decline persisted",
  );
  assert.strictEqual(
    memory.get("@ps_and_as_dismiss_add_to_home_banner"),
    "1",
    "soft banner dismissed with decline",
  );

  snap = await resolveWebOnboardingState({ needsDisplayNameSetup: true });
  assert.strictEqual(snap.phase, "ready", "after decline → ready for name");
  assert.strictEqual(
    snap.coupleNameWithGoogleSync,
    true,
    "decline + name setup couples Google sync",
  );

  // Named player after decline — no Google couple on setup (already named)
  snap = await resolveWebOnboardingState({ needsDisplayNameSetup: false });
  assert.strictEqual(snap.phase, "ready");
  assert.strictEqual(snap.coupleNameWithGoogleSync, false);

  // Standalone / no offer
  reset();
  mockOfferAddToHome = false;
  snap = await resolveWebOnboardingState({ needsDisplayNameSetup: true });
  assert.strictEqual(snap.phase, "ready");
  assert.strictEqual(snap.mobileBrowserTab, false);
  assert.strictEqual(snap.coupleNameWithGoogleSync, false);

  await clearWebInstallDeclined();

  // Google stub surface
  assert.strictEqual(getGoogleAccountSyncStatus(), "coming_soon");
  assert.strictEqual(isGoogleAccountSyncOffered(), true);
  assert.ok(getGoogleSignInButtonLabel().includes("Google"));

  console.log("test-web-onboarding: all assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
