import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAgent,
  defaultAgent,
  randomAgent,
  shapes,
  agentColors,
} from "../src/data/agent";
test("legacy settings receive a full default figure", () => {
  assert.deepEqual(normalizeAgent(), defaultAgent);
  assert.equal(normalizeAgent({ name: "   " }).name, "curdr");
});
test("the creator normalizes unknown values and bounds the displayed name", () => {
  const a = normalizeAgent({
    shape: "untrusted" as never,
    color: "url(http://example.com)" as never,
    name: "a".repeat(80),
  });
  assert.equal(a.shape, defaultAgent.shape);
  assert.equal(a.color, defaultAgent.color);
  assert.equal(a.name.length, 28);
});
test("randomize keeps the chosen name and always produces valid parts", () => {
  for (let i = 0; i < 30; i++) {
    const a = randomAgent({ ...defaultAgent, name: "Pico" });
    assert.equal(a.name, "Pico");
    assert.ok(shapes.includes(a.shape));
    assert.ok((agentColors as readonly string[]).includes(a.color));
    assert.deepEqual(a, normalizeAgent(a));
  }
});
