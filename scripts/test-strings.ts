import assert from "node:assert/strict";
import { format } from "../src/strings";

assert.strictEqual(format("Hello, {{name}}!", { name: "Ada" }), "Hello, Ada!");
assert.strictEqual(
  format("{{greeting}}, {{name}}!", { greeting: "Hello", name: "Ada" }),
  "Hello, Ada!",
);
assert.strictEqual(format("Unknown: {{missing}}", {}), "Unknown: {{missing}}");
assert.strictEqual(format("Score: {{score}}", { score: 42 }), "Score: 42");
assert.strictEqual(
  format("{{name}} met {{name}}", { name: "Ada" }),
  "Ada met Ada",
);
assert.strictEqual(format("Hello, {{ name }}!", { name: "Ada" }), "Hello, Ada!");
assert.strictEqual(format("Plain text"), "Plain text");
assert.strictEqual(
  format("{{toString}} {{constructor}} {{__proto__}}", {}),
  "{{toString}} {{constructor}} {{__proto__}}",
);

console.log("String formatter tests passed");