function createCoalescedTask(callback, delayMs = 150, timers = globalThis) {
  let timer = null;
  let pendingArgs = null;
  let disposed = false;

  const run = () => {
    if (disposed || pendingArgs === null) return undefined;
    const args = pendingArgs;
    pendingArgs = null;
    return callback(...args);
  };

  return {
    schedule(...args) {
      if (disposed) return;
      pendingArgs = args;
      if (timer !== null) timers.clearTimeout(timer);
      timer = timers.setTimeout(() => {
        timer = null;
        run();
      }, Math.max(0, Number(delayMs) || 0));
    },
    flush() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      return run();
    },
    dispose() {
      disposed = true;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      pendingArgs = null;
    },
    get isPending() {
      return pendingArgs !== null;
    },
  };
}

module.exports = { createCoalescedTask };
