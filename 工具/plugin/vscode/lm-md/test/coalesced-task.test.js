const test = require("node:test");
const assert = require("node:assert/strict");
const { createCoalescedTask } = require("../src/coalesced-task");

function createFakeTimers() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    callbacks,
    setTimeout(callback, delay) {
      const id = nextId++;
      callbacks.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    },
    runPending() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const task of pending) task.callback();
    },
  };
}

test("coalesces rapid refresh requests and runs once with the latest value", () => {
  const timers = createFakeTimers();
  const received = [];
  const task = createCoalescedTask((value) => received.push(value), 120, timers);

  task.schedule("first");
  task.schedule("second");
  task.schedule("latest");

  assert.equal(timers.callbacks.size, 1);
  assert.equal([...timers.callbacks.values()][0].delay, 120);
  timers.runPending();
  assert.deepEqual(received, ["latest"]);
});

test("flush runs the pending refresh immediately and cancels its timer", () => {
  const timers = createFakeTimers();
  const received = [];
  const task = createCoalescedTask((value) => received.push(value), 120, timers);

  task.schedule("latest");
  task.flush();

  assert.deepEqual(received, ["latest"]);
  assert.equal(timers.callbacks.size, 0);
});

test("dispose cancels pending work and prevents later refreshes", () => {
  const timers = createFakeTimers();
  const received = [];
  const task = createCoalescedTask((value) => received.push(value), 120, timers);

  task.schedule("pending");
  task.dispose();
  timers.runPending();
  task.schedule("after-dispose");

  assert.deepEqual(received, []);
  assert.equal(timers.callbacks.size, 0);
});
