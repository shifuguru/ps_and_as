/**
 * Wait for game server before autonomous league runs.
 */

/**
 * @param {string} serverUrl
 * @param {number} [timeoutMs]
 */
export async function waitForServer(serverUrl, timeoutMs = 30_000) {
  const base = serverUrl.replace(/\/$/, "");
  const url = `${base}/api/online-players`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  throw new Error(
    `Server not reachable at ${url} — start with: npm run server`,
  );
}
