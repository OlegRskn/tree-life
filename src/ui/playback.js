// Wall time controls only how many deterministic model steps to request.
// Work and catch-up are bounded; slow storage slows playback rather than
// creating an unbounded backlog or skipping model steps.
export function createPlayback() {
  let lastTime = null;
  let credit = 0;
  const playback = { running: false, speed: 1,
    resetClock() { lastTime = null; credit = 0; },
    pause() { playback.running = false; playback.resetClock(); },
    play() { playback.running = true; playback.resetClock(); },
    setSpeed(value) {
      if (![1, 4, 16].includes(value)) throw new RangeError("Unsupported speed");
      playback.speed = value; playback.resetClock();
    },
    due(time) {
      if (!playback.running || !Number.isFinite(time)) return 0;
      if (lastTime === null) { lastTime = time; return 0; }
      const elapsed = Math.max(0, Math.min(250, time - lastTime)); lastTime = time;
      credit = Math.min(8, credit + elapsed * 30 * playback.speed / 1000);
      const count = Math.floor(credit + 1e-9); credit -= count;
      return count;
    },
  };
  return playback;
}
