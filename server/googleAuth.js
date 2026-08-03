/**
 * Verify Google ID tokens for `google:{sub}` player-stats writes.
 * Uses Google's tokeninfo endpoint (no extra npm dependency).
 *
 * Set GOOGLE_CLIENT_ID (or comma-separated GOOGLE_CLIENT_IDS) on the server
 * to enforce Bearer verification for google: profile ids.
 */

function readAllowedAudiences() {
  const raw =
    process.env.GOOGLE_CLIENT_IDS ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGoogleSub(playerId) {
  if (typeof playerId !== "string" || !playerId.startsWith("google:")) {
    return null;
  }
  const sub = playerId.slice("google:".length).trim();
  return sub || null;
}

function extractBearer(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

async function verifyGoogleIdToken(idToken, allowedAudiences) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.sub || typeof data.sub !== "string") return null;
  const aud = typeof data.aud === "string" ? data.aud : "";
  const azp = typeof data.azp === "string" ? data.azp : "";
  if (
    allowedAudiences.length > 0 &&
    !allowedAudiences.includes(aud) &&
    !allowedAudiences.includes(azp)
  ) {
    return null;
  }
  const expMs = Number(data.exp) * 1000;
  if (Number.isFinite(expMs) && expMs < Date.now() - 30_000) {
    return null;
  }
  return data;
}

/**
 * Express middleware factory for PUT /api/player-stats/:playerId.
 * - Non-google ids: pass through (install / Game Center legacy)
 * - google: ids with GOOGLE_CLIENT_ID configured: require matching Bearer ID token
 * - google: ids without server client id: pass through (dev) but log once
 */
function createGooglePlayerStatsGuard() {
  let warnedMissingClientId = false;

  return async function googlePlayerStatsGuard(req, res, next) {
    const playerId = req.params?.playerId;
    const sub = parseGoogleSub(playerId);
    if (!sub) return next();

    const audiences = readAllowedAudiences();
    if (audiences.length === 0) {
      if (!warnedMissingClientId) {
        warnedMissingClientId = true;
        console.warn(
          "[googleAuth] GOOGLE_CLIENT_ID unset — google: stats writes are unrestricted",
        );
      }
      return next();
    }

    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ error: "google_auth_required" });
    }

    try {
      const payload = await verifyGoogleIdToken(token, audiences);
      if (!payload || payload.sub !== sub) {
        return res.status(403).json({ error: "google_auth_mismatch" });
      }
      req.googleAuth = {
        sub: payload.sub,
        email: payload.email || null,
      };
      return next();
    } catch (err) {
      console.warn(
        "[googleAuth] token verify failed:",
        err?.message || err,
      );
      return res.status(401).json({ error: "google_auth_invalid" });
    }
  };
}

module.exports = {
  parseGoogleSub,
  readAllowedAudiences,
  verifyGoogleIdToken,
  createGooglePlayerStatsGuard,
};
