#!/usr/bin/env node
/**
 * Regression: GameScreenBoard must not reference parent-only bindings, and
 * module-level styles must be initialized before components (TDZ / HMR).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/screens/GameScreen.tsx"), "utf8");

const boardStart = src.indexOf("function GameScreenBoard()");
const parentEnd = boardStart;
const parent = src.slice(0, parentEnd);
const board = src.slice(boardStart);

const localIdx = src.indexOf("const local = StyleSheet.create");
if (localIdx < 0 || localIdx > boardStart) {
  throw new Error(
    "const local StyleSheet must be declared before GameScreenBoard (avoids TDZ / [ROUND-END-CRASH])",
  );
}

const provMatch = parent.match(
  /<GameScreenRuntimeContext\.Provider[\s\S]*?value=\{\{([\s\S]*?)\n\s*\}\}/,
);
if (!provMatch) {
  throw new Error("GameScreenRuntimeContext.Provider value block not found");
}
const provided = new Set(
  [...provMatch[1].matchAll(/^\s+([a-zA-Z_][a-zA-Z0-9_]*),/gm)].map((m) => m[1]),
);

if (!provided.has("onTrickPauseClosingPlayLanded")) {
  throw new Error("onTrickPauseClosingPlayLanded missing from GameScreenRuntimeContext");
}

const boardEarly = board.slice(0, board.indexOf("} = useContext(GameScreenRuntimeContext)"));
const earlyBound = new Set(
  [...boardEarly.matchAll(/const ([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g)].map((m) => m[1]),
);

if (!earlyBound.has("onTrickPauseClosingPlayLanded")) {
  throw new Error("GameScreenBoard must early-bind onTrickPauseClosingPlayLanded");
}

if (/\btrickPauseOnClosingLandRef\b/.test(board)) {
  throw new Error(
    "GameScreenBoard must not reference trickPauseOnClosingLandRef directly — use onTrickPauseClosingPlayLanded from context",
  );
}

const parentRefs = [
  ...parent.matchAll(/\bconst ([a-zA-Z_][a-zA-Z0-9_]*Ref) =/g),
].map((m) => m[1]);

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

console.log("test-game-screen-context-refs: ok");
