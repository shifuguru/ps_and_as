#!/usr/bin/env node
/**
 * Regression: table-chat state must be passed through GameScreenRuntimeContext
 * because GameScreenBoard renders the modal (not GameScreen).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/screens/GameScreen.tsx"), "utf8");

const required = [
  "tableChatModalVisible",
  "setTableChatModalVisible",
  "tableChatByPlayerId",
  "handleTableChatSelect",
];

for (const key of required) {
  const inProvider = new RegExp(`\\b${key}\\s*,`).test(src);
  const inBoardDestructure = new RegExp(
    `\\n\\s+${key}\\s*,`,
  ).test(src.slice(src.indexOf("function GameScreenBoard")));
  if (!inProvider) {
    throw new Error(`GameScreen context provider missing: ${key}`);
  }
  if (!inBoardDestructure) {
    throw new Error(`GameScreenBoard destructure missing: ${key}`);
  }
}

console.log("test-table-chat-context: ok");
