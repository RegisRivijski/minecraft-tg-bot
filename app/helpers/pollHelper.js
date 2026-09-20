export function startPolling(run, intervalMs, { name } = {}) {
  let timer = null;
  let inFlight = false;

  const tick = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      await run();
    } catch (err) {
      console.warn(`[${name || 'poll'}]`, err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  tick();

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
