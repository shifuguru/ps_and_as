const { execSync, spawnSync } = require("child_process");
const path = require("path");
const pkg = require("../package.json");

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
    /* not a git repo */
  }
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["expo", "start", "--web", ...process.argv.slice(2)],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
