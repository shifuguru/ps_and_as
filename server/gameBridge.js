const path = require("path");

// Load shared TypeScript rules from the app (same logic as clients).
require(path.join(__dirname, "../node_modules/ts-node")).register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    target: "ES2020",
    strict: false,
  },
});

module.exports = require("../src/game/core.ts");
