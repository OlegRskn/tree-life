import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createSimulation } from "../src/simulation/simulation.js";
import { makeStart } from "../src/simulation/conditions.js";
import { createExperimentHistory, trendGeometry } from "../src/ui/experiment-history.js";

function fingerprint(state) {
  return createHash("sha256").update(JSON.stringify({ plants: [...state.plantsById.values()],
    seeds: state.seeds.map(s => ({ ...s, parents: s.parents.map(p => p.id) })), tick: state.tickCount,
    next: state.nextPlantId, deaths: state.deathCounts })).digest("hex");
}
test("the demo reaches generation 20 and repeats its complete deterministic trajectory", () => {
  const start = makeStart(); const simulation = createSimulation({ seed: start.seed });
  const run = () => {
    let generation = 0;
    for (let tick = 0; tick < 15000; tick++) {
      simulation.step();
      for (const p of simulation.state.plants) generation = Math.max(generation, p.generation);
    }
    assert.ok(generation >= 20); assert.ok(simulation.state.plants.length > 0);
    return fingerprint(simulation.state);
  };
  const first = run();
  simulation.setConditions({ LIGHT_MULTIPLIER: 0 }); simulation.toggleShadowMode();
  simulation.reset(start); assert.equal(simulation.state.shadowMode, "canopy");
  assert.equal(run(), first);
});

test("conditions validate atomically and do not rewrite existing DNA, energy or lifespan", () => {
  const s = createSimulation({ seed: 16 }); const founder = s.state.plants[0];
  const original = structuredClone(founder);
  const before = s.getConditions();
  for (const patch of [{ LIGHT_MULTIPLIER: NaN }, { MUTATION_RATE: 2 }, { CANOPY_LIMIT: 1.5 },
    { WIDTH: 10 }, { LIGHT_MULTIPLIER: 2, MAX_AGE: 1 }, { MIN_AGE: 0 }]) {
    assert.throws(() => s.setConditions(patch), RangeError); assert.deepEqual(s.getConditions(), before);
  }
  s.setConditions({ MUTATION_RATE: 0.2, STARTING_ENERGY: 500, MIN_AGE: 30, MAX_AGE: 30 });
  assert.deepEqual(founder, original); assert.equal(s.state.tickCount, 0);
  s.plantSavedGenome(founder.dna);
  const child = s.state.plants.at(-1); assert.equal(child.energy, 500); assert.equal(child.maxAge, 30);
  assert.deepEqual(child.dna, original.dna);
  const state = fingerprint(s.state);
  assert.throws(() => s.reset({ seed: -1, conditions: { LIGHT_MULTIPLIER: 0 } }), RangeError);
  assert.equal(fingerprint(s.state), state);
});

test("light and maintenance affect the next energy cycle with default rules preserved", () => {
  const a = createSimulation({ seed: 16 }), b = createSimulation({ seed: 16 });
  const leaf = Array.from({ length: 16 }, () => [31, 31, 31, 31]);
  a.plantSavedGenome(leaf); b.plantSavedGenome(leaf);
  b.setConditions({ LIGHT_MULTIPLIER: 2, MAINTENANCE_MULTIPLIER: 0 });
  for (let i = 0; i < 4; i++) { a.step(); b.step(); }
  assert.equal(a.state.plants.at(-1).energy, b.state.plants.at(-1).energy);
  a.step(); b.step();
  assert.equal(a.state.plants.at(-1).energy, 310); assert.equal(b.state.plants.at(-1).energy, 324);
});

test("random starts have explicit seeds and repeat copies the original settings", () => {
  const start = makeStart("random", undefined, () => 123);
  assert.equal(start.seed, 123); const repeat = makeStart("repeat", start);
  repeat.conditions.LIGHT_MULTIPLIER = 0; assert.equal(start.conditions.LIGHT_MULTIPLIER, 1);
  assert.throws(() => makeStart("random", undefined, () => -1));
});

test("trend history is bounded and markers align with recorded ticks, including a paused intervention", () => {
  const history = createExperimentHistory(3);
  const state = { tickCount: 0, plants: [1], seeds: [] }; history.reset(state);
  for (const tick of [100, 200, 300]) { state.tickCount = tick; history.record(state); }
  assert.equal(history.samples.length, 3); assert.equal(history.samples[0].tick, 100);
  state.tickCount = 350; history.record(state, true); history.add({ id: 1, tick: 350 });
  const graph = trendGeometry(history.samples, history.events);
  assert.equal(graph.markers[0].x, 560); assert.equal(graph.last, 350);
  assert.doesNotMatch(graph.seeds, /NaN|Infinity/);
  for (let id = 2; id < 110; id++) history.add({ id, tick: 350 });
  assert.equal(history.events.length, 100); history.reset(state); assert.equal(history.events.length, 0);
});
