/**
 * Bump semver patch by 0.0.1 (e.g. 1.0.0 → 1.0.1).
 * Updates package.json, app.json, and package-lock.json.
 */
const fs = require("fs");
const path = require("path");

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Invalid semver (expected major.minor.patch): ${version}`);
  }
  const patch = Number(match[3]) + 1;
  return `${match[1]}.${match[2]}.${patch}`;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const appPath = path.join(root, "app.json");
const lockPath = path.join(root, "package-lock.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const previous = pkg.version;
const next = bumpPatch(previous);

pkg.version = next;
writeJson(pkgPath, pkg);

const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
app.expo.version = next;
writeJson(appPath, app);

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.version = next;
  if (lock.packages?.[""]) {
    lock.packages[""].version = next;
  }
  writeJson(lockPath, lock);
}

console.log(`Version bumped: ${previous} → ${next}`);
