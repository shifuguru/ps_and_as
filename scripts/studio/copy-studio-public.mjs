#!/usr/bin/env node
/**
 * Copy studio/ → target directory for web dev or deploy.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "studio");
const targetArg = process.argv[2];
const TARGET = targetArg
  ? path.resolve(targetArg)
  : path.join(ROOT, "public", "studio");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`studio/ not found at ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

copyDir(SRC, TARGET);
console.log(`Copied studio/ → ${path.relative(ROOT, TARGET)}/`);
