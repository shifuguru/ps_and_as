/**
 * Assert static asset URL resolution for local dev vs deployed builds.
 *
 *   npm run studio:test-paths
 */
import assert from "assert";
import {
  resolveAppBasePath,
  resolveStaticAssetUrl,
} from "../../src/utils/staticAssetPaths";

function withGlobals(
  globals: Record<string, unknown>,
  fn: () => void,
): void {
  const saved = {
    __PS_AND_AS_BASE__: (globalThis as { __PS_AND_AS_BASE__?: string })
      .__PS_AND_AS_BASE__,
    __PS_AND_AS_STATIC_ROOT__: (globalThis as { __PS_AND_AS_STATIC_ROOT__?: string })
      .__PS_AND_AS_STATIC_ROOT__,
    location: (globalThis as { location?: Location }).location,
  };

  Object.assign(globalThis, globals);

  try {
    fn();
  } finally {
    (globalThis as { __PS_AND_AS_BASE__?: string }).__PS_AND_AS_BASE__ =
      saved.__PS_AND_AS_BASE__;
    (globalThis as { __PS_AND_AS_STATIC_ROOT__?: string }).__PS_AND_AS_STATIC_ROOT__ =
      saved.__PS_AND_AS_STATIC_ROOT__;
    (globalThis as { location?: Location }).location = saved.location;
  }
}

withGlobals(
  { location: { hostname: "localhost", pathname: "/ps_and_as/mission-control" } },
  () => {
    assert.strictEqual(
      resolveStaticAssetUrl("studio/dashboard.json"),
      "/studio/dashboard.json",
    );
    assert.strictEqual(resolveAppBasePath(), "/ps_and_as");
  },
);

withGlobals(
  {
    __PS_AND_AS_BASE__: "/ps_and_as",
    location: {
      hostname: "shifuguru.github.io",
      pathname: "/ps_and_as/mission-control",
    },
  },
  () => {
    assert.strictEqual(
      resolveStaticAssetUrl("studio/dashboard.json"),
      "/ps_and_as/studio/dashboard.json",
    );
    assert.strictEqual(resolveStaticAssetUrl("README.md"), "/ps_and_as/README.md");
    assert.strictEqual(resolveAppBasePath(), "/ps_and_as");
  },
);

withGlobals(
  {
    __PS_AND_AS_STATIC_ROOT__: "/custom/root",
    location: { hostname: "example.com", pathname: "/app/" },
  },
  () => {
    assert.strictEqual(
      resolveStaticAssetUrl("studio/dashboard.json"),
      "/custom/root/studio/dashboard.json",
    );
  },
);

console.log("static asset path resolution: OK");
