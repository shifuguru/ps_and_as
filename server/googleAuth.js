/**
 * Google auth for `google:{sub}` player-stats writes.
 *
 * Accepts either:
 * 1. A Google ID token (short-lived) — verified via tokeninfo
 * 2. A server-issued session token (psas1.*) — HMAC, ~30 days
 *
 * Clients should exchange an ID token at POST /api/auth/google once, then
 * reuse the session token so PWA restarts keep syncing without re-prompting.
 */
const crypto = require("crypto");

const SESSION_PREFIX = "psas1.";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function getSessionSecret() {
  return (
    process.env.GOOGLE_SESSION_SECRET ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    ""
  );
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

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function fromB64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function signSessionPayload(payloadPart, secret) {
  return crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function issueGoogleSessionToken(sub, email) {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payloadPart = b64urlJson({
    sub,
    email: email || null,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const sig = signSessionPayload(payloadPart, secret);
  return `${SESSION_PREFIX}${payloadPart}.${sig}`;
}

function verifyGoogleSessionToken(token) {
  if (typeof token !== "string" || !token.startsWith(SESSION_PREFIX)) {
    return null;
  }
  const secret = getSessionSecret();
  if (!secret) return null;
  const raw = token.slice(SESSION_PREFIX.length);
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadPart = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = signSessionPayload(payloadPart, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = fromB64urlJson(payloadPart);
    if (!payload?.sub || typeof payload.sub !== "string") return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
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

async function authenticateGoogleBearer(token, expectedSub, audiences) {
  if (!token) return null;

  const session = verifyGoogleSessionToken(token);
  if (session) {
    if (expectedSub && session.sub !== expectedSub) return null;
    return session;
  }

  const idPayload = await verifyGoogleIdToken(token, audiences);
  if (!idPayload) return null;
  if (expectedSub && idPayload.sub !== expectedSub) return null;
  return {
    sub: idPayload.sub,
    email: typeof idPayload.email === "string" ? idPayload.email : null,
  };
}

/**
 * Express middleware factory for PUT /api/player-stats/:playerId.
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
      const auth = await authenticateGoogleBearer(token, sub, audiences);
      if (!auth) {
        return res.status(403).json({ error: "google_auth_mismatch" });
      }
      req.googleAuth = auth;
      return next();
    } catch (err) {
      console.warn("[googleAuth] token verify failed:", err?.message || err);
      return res.status(401).json({ error: "google_auth_invalid" });
    }
  };
}

/**
 * Require a valid Google bearer (session or ID token) for billing routes.
 * Sets req.googleSub / req.googlePlayerId.
 */
function createGoogleBearerRequired() {
  return async function googleBearerRequired(req, res, next) {
    const audiences = readAllowedAudiences();
    if (audiences.length === 0) {
      return res.status(503).json({ error: "google_auth_unconfigured" });
    }
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ error: "google_auth_required" });
    }
    try {
      const auth = await authenticateGoogleBearer(token, null, audiences);
      if (!auth?.sub) {
        return res.status(401).json({ error: "google_auth_invalid" });
      }
      req.googleAuth = auth;
      req.googleSub = auth.sub;
      req.googlePlayerId = `google:${auth.sub}`;
      return next();
    } catch (err) {
      console.warn("[googleAuth] bearer verify failed:", err?.message || err);
      return res.status(401).json({ error: "google_auth_invalid" });
    }
  };
}

/**
 * POST /api/auth/google  body: { idToken }
 * → { accountId, sessionToken, expiresAt }
 */
function createGoogleAuthHandler() {
  return async function googleAuthHandler(req, res) {
    const audiences = readAllowedAudiences();
    if (audiences.length === 0) {
      return res.status(503).json({ error: "google_auth_unconfigured" });
    }
    const idToken =
      typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
    if (!idToken) {
      return res.status(400).json({ error: "missing_id_token" });
    }
    try {
      const payload = await verifyGoogleIdToken(idToken, audiences);
      if (!payload?.sub) {
        return res.status(401).json({ error: "google_auth_invalid" });
      }
      const sessionToken = issueGoogleSessionToken(payload.sub, payload.email);
      if (!sessionToken) {
        return res.status(503).json({ error: "google_session_unconfigured" });
      }
      const exp = Date.now() + SESSION_TTL_MS;
      res.set("Cache-Control", "no-store");
      return res.json({
        accountId: `google:${payload.sub}`,
        sessionToken,
        expiresAt: new Date(exp).toISOString(),
        email: payload.email || null,
        displayName: payload.name || payload.given_name || null,
      });
    } catch (err) {
      console.warn("[googleAuth] exchange failed:", err?.message || err);
      return res.status(401).json({ error: "google_auth_invalid" });
    }
  };
}

module.exports = {
  SESSION_PREFIX,
  parseGoogleSub,
  readAllowedAudiences,
  verifyGoogleIdToken,
  verifyGoogleSessionToken,
  issueGoogleSessionToken,
  createGooglePlayerStatsGuard,
  createGoogleBearerRequired,
  createGoogleAuthHandler,
};
