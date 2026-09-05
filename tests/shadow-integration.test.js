import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../src/simulation/simulation.js";

test("switching shadow mode updates light without advancing time or plants", () => {
  const simulation = createSimulation({ seed: 16 });
  const state = simulation.state;
  const plant = state.plants[0];
  const { x, y } = plant.cells[0];
  const plantsBefore = JSON.stringify(state.plants);
  assert.equal(state.canopyMap[x][y + 1], 0);
  simulation.toggleShadowMode();
  assert.equal(state.canopyMap[x][y + 1], 1);
  simulation.toggleShadowMode();
  assert.equal(state.canopyMap[x][y + 1], 0);
  assert.equal(state.tickCount, 0);
  assert.equal(JSON.stringify(state.plants), plantsBefore);
});

test("a later plant gets unshaded energy in the same step its neighbour dies", () => {
  const simulation = createSimulation({ seed: 16, config: { GROWTH_INTERVAL: 1, ENERGY_INTERVAL: 1 } });
  const upper = simulation.state.plants[0];
  simulation.plantSavedGenome(upper.dna);
  const lower = simulation.state.plants[1];
  assert.ok(lower);
  // Controlled geometry: the first plant dies above the second plant's leaf.
  upper.cells = [{ x: 120, y: 80, type: "leaf", gene: 0, plantId: upper.id }];
  upper.maxAge = 1;
  lower.cells = [{ x: 120, y: 82, type: "leaf", gene: 0, plantId: lower.id }];
  lower.maxAge = 1000;
  lower.energy = 0;
  simulation.step();
  assert.equal(upper.alive, false);
  assert.equal(lower.energy, 14); // 2 × (85 - 82 + 5) - 2 upkeep
  assert.equal(simulation.state.canopyMap[120][82], 0);
});

test("a seed germinates on the step that the canopy above it dies", () => {
  const simulation = createSimulation({ seed: 16, config: {
    GROWTH_INTERVAL: 1, ENERGY_INTERVAL: 1, SEED_FALL_INTERVAL: 1, GERMINATION_TIME: 1,
  } });
  const parent = simulation.state.plants[0];
  parent.cells = [{ x: 120, y: 80, type: "leaf", gene: 0, plantId: parent.id }];
  parent.maxAge = 1;
  simulation.state.seeds.push({ x: 120, y: 84, dna: parent.dna, age: 0, parents: [parent] });
  simulation.step();
  assert.equal(parent.alive, false);
  assert.equal(simulation.state.plants.length, 1);
  assert.equal(simulation.state.plants[0].generation, 1);
  assert.deepEqual(parent.children, [simulation.state.plants[0].id]);
});

// Independent oracle: derive occupancy from bodies, then count sources top-down.
// Does not call createSpatial or its incremental update helpers.
function assertMaps(state) {
  const occupied = new Map();
  for (const plant of state.plants) {
    for (const cell of plant.cells) {
      const key = `${cell.x},${cell.y}`;
      assert.ok(!occupied.has(key), `overlap at ${key}`);
      occupied.set(key, cell);
    }
  }
  for (let x = 0; x < state.config.WIDTH; x++) {
    let above = 0;
    for (let y = 0; y < state.config.HEIGHT; y++) {
      const cell = occupied.get(`${x},${y}`) ?? null;
      assert.equal(state.occupancyMap[x][y], cell);
      assert.equal(state.canopyMap[x][y], above, `shadow at ${x},${y}, tick ${state.tickCount}`);
      if (cell && (state.shadowMode === "column" || cell.type === "leaf")) above++;
    }
  }
}

for (const mode of ["canopy", "column"]) {
  test(`long run maps match independent reconstruction: ${mode}`, () => {
    const simulation = createSimulation({ seed: 16 });
    if (mode === "column") simulation.toggleShadowMode();
    for (let i = 0; i < 5000; i++) {
      const before = simulation.state.deathCounts.age + simulation.state.deathCounts.starvation;
      simulation.step();
      const after = simulation.state.deathCounts.age + simulation.state.deathCounts.starvation;
      if (after !== before || simulation.state.tickCount % 100 === 0) assertMaps(simulation.state);
    }
    simulation.toggleShadowMode();
    assertMaps(simulation.state);
    simulation.toggleShadowMode();
    assertMaps(simulation.state);
  });
}
