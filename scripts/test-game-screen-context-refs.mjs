#!/usr/bin/env node
/**
 * Regression: parent GameScreen refs used in GameScreenBoard must be passed
 * through GameScreenRuntimeContext (or declared locally on the board).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/screens/GameScreen.tsx"), "utf8");

const parentEnd = src.indexOf("function GameScreenBoard()");
const parent = src.slice(0, parentEnd);
const board = src.slice(parentEnd);

const provMatch = parent.match(
  /<GameScreenRuntimeContext\.Provider[\s\S]*?value=\{\{([\s\S]*?)\n\s*\}\}/,
);
if (!provMatch) {
  throw new Error("GameScreenRuntimeContext.Provider value block not found");
}
const provided = new Set(
  [...provMatch[1].matchAll(/^\s+([a-zA-Z_][a-zA-Z0-9_]*),/gm)].map((m) => m[1]),
);

const parentRefs = [
  ...parent.matchAll(/\bconst ([a-zA-Z_][a-zA-Z0-9_]*Ref) =/g),
].map((m) => m[1]);

const boardEarly = board.slice(0, board.indexOf("} = useContext(GameScreenRuntimeContext)"));
const earlyBound = new Set(
  [...boardEarly.matchAll(/const ([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g)].map((m) => m[1]),
);

const missing = parentRefs.filter(
  (ref) =>
    new RegExp(`\\b${ref}\\b`).test(board) &&
    !provided.has(ref) &&
    !earlyBound.has(ref) &&
    !new RegExp(`\\bconst ${ref} =`).test(board),
);

if (missing.length > 0) {
  throw new Error(
    `GameScreenBoard uses parent refs without context wiring: ${missing.join(", ")}`,
  );
}

if (!provided.has("trickPauseOnClosingLandRef")) {
  throw new Error("trickPauseOnClosingLandRef missing from GameScreenRuntimeContext");
}

console.log("test-game-screen-context-refs: ok");
