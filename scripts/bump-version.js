/**
 * Bump semver patch by 0.0.1 (e.g. 1.0.0 → 1.0.1).
 * Updates package.json, app.json, package-lock.json, and assigns a release codename.
 */
const fs = require("fs");
const path = require("path");
const CODENAME_POOL = require("./codename-pool");

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

function readUsedCodenames(codenamesPath) {
  const text = fs.readFileSync(codenamesPath, "utf8");
  const used = new Set();
  for (const match of text.matchAll(/:\s*"([^"]+)"/g)) {
    used.add(match[1]);
  }
  return used;
}

function pickCodename(usedNames) {
  const available = CODENAME_POOL.filter((name) => !usedNames.has(name));
  const pool = available.length > 0 ? available : CODENAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

function assignCodename(codenamesPath, version) {
  const used = readUsedCodenames(codenamesPath);
  const codename = pickCodename(used);
  let text = fs.readFileSync(codenamesPath, "utf8");
  const marker = "};";
  const insert = `  "${version}": "${codename}",\n`;
  if (text.includes(`"${version}"`)) {
    return codename;
  }
  const idx = text.lastIndexOf(marker);
  if (idx < 0) {
    throw new Error(`Could not find BUILD_CODENAMES closing brace in ${codenamesPath}`);
  }
  text = `${text.slice(0, idx)}${insert}${text.slice(idx)}`;
  fs.writeFileSync(codenamesPath, text, "utf8");
  return codename;
}

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const appPath = path.join(root, "app.json");
const lockPath = path.join(root, "package-lock.json");
const codenamesPath = path.join(root, "src/config/buildCodenames.ts");

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

const codename = assignCodename(codenamesPath, next);

console.log(`Version bumped: ${previous} → ${next} (“${codename}”)`);
