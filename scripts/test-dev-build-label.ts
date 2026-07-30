/**
 * Local build label must follow package.json, not the production index.html stamp.
 * Run: npx tsx ./scripts/test-dev-build-label.ts
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
  if (request === "expo-constants") {
    return {
      default: {
        expoConfig: {
          extra: {
            appVersion: "9.9.9-extra",
            buildId: "extra-build",
          },
        },
      },
    };
  }
  return originalLoad(request, parent, isMain);
};

(globalThis as { __DEV__?: boolean }).__DEV__ = true;
(globalThis as { __PS_AND_AS_BUILD__?: unknown }).__PS_AND_AS_BUILD__ = {
  version: "1.1.11",
  buildId: "stale-production-stamp",
  channel: "production",
  codename: "Asshole Ascendant",
};
process.env.EXPO_PUBLIC_APP_VERSION = "1.1.18";
process.env.EXPO_PUBLIC_BUILD_ID = "localgitsha0001";

const {
  resolveAppVersion,
  resolveClientBuildInfo,
  formatBuildLabel,
  resolveDeployChannel,
} = require("../src/config/buildVersion") as typeof import("../src/config/buildVersion");

assert.equal(
  resolveAppVersion(),
  "1.1.18",
  "dev should prefer EXPO_PUBLIC_APP_VERSION over __PS_AND_AS_BUILD__",
);
assert.equal(resolveDeployChannel(), "development");

const info = resolveClientBuildInfo();
assert.equal(info.version, "1.1.18");
assert.equal(info.buildId, "localgitsha0001");
assert.equal(info.channel, "development");

const label = formatBuildLabel(info);
assert.ok(label.startsWith("Dev · "), `expected Dev prefix, got ${label}`);
assert.ok(label.includes("1.1.18"), `expected 1.1.18 in ${label}`);
assert.ok(!label.includes("1.1.11"), `must not show stale stamp in ${label}`);

console.log("dev build label tests passed:", label);
