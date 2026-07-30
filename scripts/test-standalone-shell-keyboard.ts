/**
 * Standalone PWA shell must stay pinned when the keyboard opens.
 * Run: npx tsx ./scripts/test-standalone-shell-keyboard.ts
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
  return originalLoad(request, parent, isMain);
};

// Standalone navigator before importing modules that read it.
(globalThis as { navigator?: { standalone?: boolean } }).navigator = {
  standalone: true,
};
(globalThis as { window?: unknown; matchMedia?: unknown }).matchMedia = () => ({
  matches: true,
});
(globalThis as { window?: unknown }).window = globalThis;

const {
  keyboardLikelyOpen,
  readWebShellHeight,
  readWebShellTop,
} = require("../src/utils/webViewport") as typeof import("../src/utils/webViewport");

function makeWin(opts: {
  innerHeight: number;
  vvHeight: number;
  offsetTop?: number;
}) {
  return {
    innerHeight: opts.innerHeight,
    visualViewport: {
      height: opts.vvHeight,
      offsetTop: opts.offsetTop ?? 0,
    },
  };
}

const full = makeWin({ innerHeight: 844, vvHeight: 844 });
assert.equal(keyboardLikelyOpen(full), false, "closed keyboard");
assert.equal(readWebShellTop(full), 0);

const open = makeWin({ innerHeight: 844, vvHeight: 480, offsetTop: 0 });
assert.equal(keyboardLikelyOpen(open), true, "open keyboard");
assert.equal(
  readWebShellTop(open),
  0,
  "standalone shell top stays 0 with keyboard",
);
const openH = readWebShellHeight(open);
assert.ok(
  openH >= 844,
  `standalone shell height must not shrink to vv (${openH})`,
);

const scrolled = makeWin({ innerHeight: 844, vvHeight: 480, offsetTop: 40 });
assert.equal(readWebShellTop(scrolled), 0, "standalone ignores vv.offsetTop");

console.log("standalone shell keyboard tests passed");
