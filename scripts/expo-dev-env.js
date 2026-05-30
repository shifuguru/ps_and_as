/**
 * Local Expo dev — inject app version + git build id before starting Metro.
 * Used by `npm start` and `npm run web` so build labels match package.json.
 */
const { execSync, spawnSync } = require("child_process");
const path = require("path");
const pkg = require("../package.json");

function buildDevEnv() {
  const env = { ...process.env };
  if (!env.EXPO_PUBLIC_APP_VERSION?.trim()) {
    env.EXPO_PUBLIC_APP_VERSION = pkg.version;
  }
  if (!env.EXPO_PUBLIC_BUILD_ID?.trim()) {
    try {
      env.EXPO_PUBLIC_BUILD_ID = execSync("git rev-parse HEAD", {
        encoding: "utf8",
        cwd: path.join(__dirname, ".."),
      }).trim();
    } catch {
      env.EXPO_PUBLIC_BUILD_ID = "dev";
    }
  }
  return env;
}

function runExpo(extraArgs) {
  const env = buildDevEnv();
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["expo", "start", ...extraArgs],
    { stdio: "inherit", env, shell: process.platform === "win32" },
  );
  process.exit(result.status ?? 1);
}

if (require.main === module) {
  runExpo(process.argv.slice(2));
}

module.exports = { buildDevEnv, runExpo };
