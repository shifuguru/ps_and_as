/**
 * Ensure we can detect the official H5 adsbygoogle.push stub.
 * Run: npx tsx ./scripts/test-ads-h5-stub.ts
 */
import assert from "assert";

function isAdBreakStub(fn: unknown): boolean {
  if (typeof fn !== "function") return true;
  const src = Function.prototype.toString.call(fn);
  return /adsbygoogle\.push/i.test(src);
}

const stub = function (o: unknown) {
  (globalThis as { adsbygoogle?: unknown[] }).adsbygoogle =
    (globalThis as { adsbygoogle?: unknown[] }).adsbygoogle || [];
  (globalThis as { adsbygoogle: unknown[] }).adsbygoogle.push(o);
};

assert.strictEqual(isAdBreakStub(stub), true);
assert.strictEqual(
  isAdBreakStub(function adBreak() {
    /* real-looking placeholder without push */
  }),
  false,
);
assert.strictEqual(isAdBreakStub(undefined), true);

console.log("test-ads-h5-stub: ok");
