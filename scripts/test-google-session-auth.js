/**
 * Google session token round-trip.
 * Run: node ./scripts/test-google-session-auth.js
 */
const assert = require("assert");

process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_SESSION_SECRET = "unit-test-secret";

const {
  issueGoogleSessionToken,
  verifyGoogleSessionToken,
  SESSION_PREFIX,
} = require("../server/googleAuth");

const token = issueGoogleSessionToken("sub-123", "a@b.com");
assert.ok(token && token.startsWith(SESSION_PREFIX));
const verified = verifyGoogleSessionToken(token);
assert.deepStrictEqual(verified, { sub: "sub-123", email: "a@b.com" });

assert.strictEqual(verifyGoogleSessionToken("nope"), null);
assert.strictEqual(verifyGoogleSessionToken(`${token}x`), null);

const other = issueGoogleSessionToken("sub-999");
assert.strictEqual(verifyGoogleSessionToken(other).sub, "sub-999");

console.log("test-google-session-auth: all assertions passed");
