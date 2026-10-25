import { test } from "node:test";
import assert from "node:assert/strict";
import { reduce } from "../src/data/reducer";
import { seed as emptySeed } from "../src/data/seed";
function seed() {
  const state = emptySeed();
  state.messages = [{ id: "existing", role: "agent", kind: "text", text: "Existing message", createdAt: "2026-10-24T00:00:00Z" }];
  state.tasks = (["need", "review", "run"] as const).map((status, i) => ({ id: `task-${i}`, title: "Test task", channel: "website", status, source: "cal", summary: "", updatedAt: "2026-10-24T00:00:00Z" }));
  return state;
}
import { channelStatus } from "../src/data/types";
test("replayed SSE messages are idempotent and unrelated message objects stay stable", () => {
  const state = seed();
  const message = {
    id: "new",
    role: "agent" as const,
    kind: "text" as const,
    text: "hello",
    createdAt: new Date().toISOString(),
  };
  const first = reduce(state, { type: "message", data: message });
  const second = reduce(first, { type: "message", data: message });
  assert.equal(second.messages.length, state.messages.length + 1);
  assert.equal(second.messages[0], state.messages[0]);
});
test("channel status prioritizes need over run, then review", () => {
  const state = seed();
  assert.equal(channelStatus(state.tasks, "website"), "need");
  const withoutNeed = state.tasks.map((t) =>
    t.channel === "website" && t.status === "need"
      ? { ...t, status: "done" as const }
      : t,
  );
  assert.equal(channelStatus(withoutNeed, "website"), "run");
  const withoutRun = withoutNeed.map(t => t.status === "run" ? { ...t, status: "done" as const } : t);
  assert.equal(channelStatus(withoutRun, "website"), "review");
  assert.equal(channelStatus(state.tasks, "missing"), "done");
});
test("task events do not replace messages, and removed tasks disappear", () => {
  const state = seed();
  const next = reduce(state, {
    type: "task_update",
    data: { ...state.tasks[0]!, status: "done" },
  });
  assert.equal(next.messages, state.messages);
  assert.equal(
    reduce(next, { type: "task_removed", data: { id: state.tasks[0]!.id } })
      .tasks.length,
    state.tasks.length - 1,
  );
});
