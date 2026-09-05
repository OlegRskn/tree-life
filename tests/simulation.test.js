import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createSimulation } from "../src/simulation/simulation.js";
import { createRandom } from "../src/simulation/random.js";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/legacy-states.json", import.meta.url)));

// Hashes captured from the unmodified working copy before extraction, using the
// same RNG. Include cells, DNA, seeds/parents, archives, counters and spatial maps.
function fingerprint(state) {
  const { tickCount, seeds, nextPlantId, deathCounts,
    populationHistory, occupancyMap, canopyMap } = state;
  // Reconstruct the old wire shape from the registry, without changing state.
  // The original loop incorrectly incremented dead plants' ages every growth
  // tick. Only this obsolete field is adapted; all old golden hashes stay intact.
  const plants = [...state.plantsById.values()];
  function legacyAge(key, value) {
    if (key === "age" && this.alive === false) {
      const interval = state.config.GROWTH_INTERVAL;
      return value + Math.floor(tickCount / interval) - Math.floor(this.diedAt / interval);
    }
    return value;
  }
  return createHash("sha256").update(JSON.stringify({ tickCount, plants, seeds,
    nextPlantId, deathCounts, populationHistory, occupancyMap, canopyMap }, legacyAge)).digest("hex");
}

for (const mode of ["canopy", "column"]) {
  for (const seed of [1, 16, 18]) {
    test(`legacy equivalence: seed ${seed}, ${mode}`, () => {
      const simulation = createSimulation({ seed });
      if (mode === "column") simulation.toggleShadowMode();
      for (const fixture of fixtures.filter(f => f.seed === seed && f.mode === mode)) {
        while (simulation.state.tickCount < fixture.tick) simulation.step();
        assert.equal(fingerprint(simulation.state), fixture.hash, `tick ${fixture.tick}`);
      }
    });
  }
}

test("seeded reset repeats initial state and keeps state reference and shadow rule", () => {
  const simulation = createSimulation({ seed: 16 });
  const state = simulation.state;
  const initial = fingerprint(state);
  for (let i = 0; i < 600; i++) simulation.step();
  simulation.reset();
  assert.equal(simulation.state, state);
  assert.equal(fingerprint(state), initial);
  simulation.toggleShadowMode();
  simulation.reset();
  assert.equal(state.shadowMode, "column");
  assert.equal(state.canopyMap[state.plants[0].cells[0].x][state.config.GROUND_LEVEL], 1);
});

test("simulations have independent state, config and randomness", () => {
  const a = createSimulation({ seed: 16, config: { WIDTH: 30, HEIGHT: 25 } });
  const b = createSimulation({ seed: 16 });
  const initial = fingerprint(b.state);
  a.step();
  a.state.config.UPKEEP_LEAF = 99;
  a.state.config.DIR_VECTORS[0].dx = 99;
  assert.equal(fingerprint(b.state), initial);
  assert.equal(b.state.config.UPKEEP_LEAF, 2);
  assert.equal(b.state.config.DIR_VECTORS[0].dx, -1);
  assert.equal(a.state.config.GROUND_LEVEL, 20);
  assert.equal(a.state.world.length, 30);
  assert.equal(a.state.world[0].length, 25);
});

test("planting copies saved DNA and occupancy supports safe selection", () => {
  const simulation = createSimulation({ seed: 16 });
  const dna = simulation.state.plants[0].dna.map(row => row.slice());
  simulation.plantSavedGenome(dna);
  const plant = simulation.state.plants.at(-1);
  assert.equal(simulation.state.plants.length, 2);
  assert.deepEqual(plant.dna, dna);
  dna[0][0] = -1;
  assert.notEqual(plant.dna[0][0], -1);
  const cell = plant.cells[0];
  assert.equal(simulation.plantAt(cell.x, cell.y), plant);
  assert.equal(simulation.plantAt(-1, 0), null);
  assert.equal(simulation.plantAt(10000, 10000), null);
});

test("seed validation rejects invalid inputs", () => {
  for (const seed of [-1, 1.5, NaN, 2 ** 32, "16"]) {
    assert.throws(() => createRandom(seed), RangeError);
  }
});
