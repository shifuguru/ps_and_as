#!/usr/bin/env node
/**
 * Regression: table-chat state must live in GameScreenBoard (where the modal
 * renders), not only in GameScreen parent / runtime context.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/screens/GameScreen.tsx"), "utf8");

const boardStart = src.indexOf("function GameScreenBoard()");
const parentEnd = src.indexOf("function GameScreenBoard()");
const parent = src.slice(0, boardStart);
const board = src.slice(boardStart);

if (!board.includes("const [tableChatModalVisible, setTableChatModalVisible]")) {
  throw new Error("GameScreenBoard missing tableChatModalVisible state");
}
if (!board.includes("handleTableChatSelect")) {
  throw new Error("GameScreenBoard missing handleTableChatSelect");
}
if (!board.includes('<TableChatModal')) {
  throw new Error("GameScreenBoard missing TableChatModal render");
}

if (/tableChatModalVisible\s*,/.test(parent)) {
  throw new Error(
    "tableChatModalVisible must not be passed through GameScreenRuntimeContext",
  );
}

console.log("test-table-chat-context: ok");
