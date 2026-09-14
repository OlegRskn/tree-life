export function createExperimentHistory(limit = 200) {
  const samples = [], events = [];
  let revision = 0;
  return { samples, events, get revision() { return revision; },
    reset(state) { samples.length = 0; events.length = 0; revision++; this.record(state); },
    record(state, force = false) {
      if ((!force && state.tickCount % 100 !== 0) || samples.at(-1)?.tick === state.tickCount) return;
      samples.push({ tick: state.tickCount, plants: state.plants.length, seeds: state.seeds.length });
      if (samples.length > limit) samples.shift(); revision++;
    },
    add(event) { events.push(event); if (events.length > 100) events.shift(); revision++; },
  };
}

export function trendGeometry(samples, events, width = 560, height = 60) {
  const first = samples[0]?.tick ?? 0, last = samples.at(-1)?.tick ?? first;
  const peak = Math.max(1, ...samples.map(s => Math.max(s.plants, s.seeds)));
  const x = tick => (tick - first) / Math.max(100, last - first) * width;
  const path = key => samples.map((s, index) => `${index ? "L" : "M"}${x(s.tick).toFixed(2)},${(height - s[key] / peak * (height - 4)).toFixed(2)}`).join(" ");
  return { plants: path("plants"), seeds: path("seeds"), peak, first, last,
    markers: events.filter(e => e.tick >= first && e.tick <= last).map(e => ({ tick: e.tick, x: x(e.tick) })) };
}
