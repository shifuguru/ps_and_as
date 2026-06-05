/**
 * Integration test: 2 human players + dead hand seat, N full rounds.
 *   npm run server
 *   node scripts/test-two-human-dead-hand.mjs
 *
 * Env: SERVER_URL (default http://localhost:4000), ROUNDS (default 5)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROUNDS = String(process.env.ROUNDS ?? 5);
const SERVER = process.env.SERVER_URL ?? "http://localhost:4000";

const here = dirname(fileURLToPath(import.meta.url));
const matrix = join(here, "test-multiplayer-matrix.mjs");

const child = spawn(
  process.execPath,
  [matrix],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SERVER_URL: SERVER,
      ROUNDS,
      ONLY: "2h",
      SKIP_SLOW: "1",
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
