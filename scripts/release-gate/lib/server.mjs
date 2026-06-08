/**
 * Server health probe and optional spawn for release-gate orchestrator.
 */
import { spawn } from "child_process";
import { io } from "socket.io-client";

const DEFAULT_URL = process.env.SERVER_URL ?? "http://localhost:4000";

function serverOrigin(url = DEFAULT_URL) {
  try {
    return new URL(url).origin;
  } catch {
    return DEFAULT_URL;
  }
}

export async function probeServer(url = DEFAULT_URL, timeoutMs = 5000) {
  const origin = serverOrigin(url);
  return new Promise((resolve) => {
    const socket = io(origin, { transports: ["websocket"], timeout: timeoutMs });
    const t = setTimeout(() => {
      socket.disconnect();
      resolve(false);
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(t);
      socket.disconnect();
      resolve(true);
    });
    socket.on("connect_error", () => {
      clearTimeout(t);
      socket.disconnect();
      resolve(false);
    });
  });
}

export async function ensureServer(url = DEFAULT_URL) {
  if (await probeServer(url)) return { spawned: false, child: null };

  if (process.env.RELEASE_GATE_SPAWN_SERVER !== "1") {
    return { spawned: false, child: null, unreachable: true };
  }

  const child = spawn("node", ["server/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: process.env.PORT ?? "4000" },
  });

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (await probeServer(url, 3000)) {
      return { spawned: true, child };
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  child.kill("SIGTERM");
  throw new Error(
    `Server did not become reachable at ${url} within 25s after spawn`,
  );
}

export function stopSpawnedServer(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}
