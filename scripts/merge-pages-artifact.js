#!/usr/bin/env node
/**
 * Merge a web-build into a GitHub Pages artifact without clobbering the other
 * deploy slot (production at site root, development under /dev/).
 *
 * Usage:
 *   node scripts/merge-pages-artifact.js --slot=root|dev [--source=web-build] [--output=pages-artifact]
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");

function getArg(name, fallback) {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const slot = getArg("slot", "root");
const source = path.resolve(repoRoot, getArg("source", "web-build"));
const output = path.resolve(repoRoot, getArg("output", "pages-artifact"));

if (!["root", "dev"].includes(slot)) {
  console.error(`Invalid --slot "${slot}" (expected root or dev).`);
  process.exit(1);
}

if (!fs.existsSync(source)) {
  console.error(`Build source not found: ${source}`);
  process.exit(1);
}

function rmRecursive(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function copyIntoRoot(src, dest, preserveDirs = ["dev"]) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (preserveDirs.includes(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      rmRecursive(to);
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function seedFromGhPages(dest) {
  try {
    execSync("git fetch origin gh-pages --depth=1 2>/dev/null || true", {
      stdio: "inherit",
      cwd: repoRoot,
    });
    const ref = execSync("git rev-parse origin/gh-pages 2>/dev/null", {
      encoding: "utf8",
      cwd: repoRoot,
    }).trim();
    if (!ref) {
      console.log("No origin/gh-pages yet — starting an empty Pages artifact.");
      fs.mkdirSync(dest, { recursive: true });
      return;
    }

    rmRecursive(dest);
    fs.mkdirSync(dest, { recursive: true });
    execSync("git archive --format=tar origin/gh-pages | tar -xf -", {
      cwd: dest,
      stdio: "inherit",
      shell: true,
    });
    console.log(`Seeded artifact from origin/gh-pages (${ref.slice(0, 7)}).`);
  } catch (err) {
    console.warn("Could not seed from gh-pages — using a fresh artifact.", err.message);
    fs.mkdirSync(dest, { recursive: true });
  }
}

seedFromGhPages(output);

if (slot === "dev") {
  const target = path.join(output, "dev");
  rmRecursive(target);
  copyRecursive(source, target);
  // Keep site-wide 404 router in sync (dev paths must not bounce to production).
  const router404 = path.join(source, "404.html");
  if (fs.existsSync(router404)) {
    fs.copyFileSync(router404, path.join(output, "404.html"));
  }
  console.log(`Merged dev build into ${path.relative(repoRoot, target)}`);
} else {
  copyIntoRoot(source, output);
  console.log(`Merged production build into ${path.relative(repoRoot, output)} (kept dev/)`);
}

fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");
console.log(`Pages artifact ready at ${path.relative(repoRoot, output)} (${slot} slot).`);
