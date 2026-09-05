import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../src/simulation/simulation.js";

test("dead plants leave the active population but remain available by ID", () => {
  const simulation = createSimulation({ seed: 1 });
  const parent = simulation.state.plants[0];
  while (parent.alive) simulation.step();
  assert.equal(simulation.state.plants.length, 0);
  assert.equal(simulation.state.plantsById.get(parent.id), parent);
  assert.deepEqual(parent.cells, []);
});

test("age at death stops changing after subsequent growth ticks", () => {
  const simulation = createSimulation({ seed: 1 });
  const plant = simulation.state.plants[0];
  while (plant.alive) simulation.step();
  const ageAtDeath = plant.age;
  const death = { ...simulation.state.deathCounts };
  for (let i = 0; i < 100; i++) simulation.step();
  assert.equal(plant.age, ageAtDeath);
  assert.deepEqual(simulation.state.deathCounts, death);
});

test("several deaths in one step do not skip the next plant", () => {
  const simulation = createSimulation({ seed: 16, config: { MIN_AGE: 1, MAX_AGE: 1 } });
  const dna = simulation.state.plants[0].dna;
  simulation.plantSavedGenome(dna);
  simulation.plantSavedGenome(dna);
  assert.equal(simulation.state.plants.length, 3);
  const active = simulation.state.plants;
  for (let i = 0; i < 5; i++) simulation.step();
  assert.equal(simulation.state.plants.length, 0);
  assert.equal(simulation.state.plantsById.size, 3);
  assert.equal(simulation.state.deathCounts.age, 3);
  assert.equal(simulation.state.plants, active);
});

test("compaction preserves survivors and their order", () => {
  const simulation = createSimulation({ seed: 16 });
  const first = simulation.state.plants[0];
  simulation.plantSavedGenome(first.dna);
  simulation.plantSavedGenome(first.dna);
  const [a, b, c] = simulation.state.plants;
  // Controlled world fixture: the middle plant dies at the next growth step.
  b.maxAge = 1;
  for (let i = 0; i < 5; i++) simulation.step();
  assert.deepEqual(simulation.state.plants.map(plant => plant.id), [a.id, c.id]);
  assert.equal(a.age, 1);
  assert.equal(c.age, 1);
  assert.equal(simulation.state.plantsById.get(b.id), b);
});

test("the step does not inspect archived bodies even when recording population history", () => {
  const simulation = createSimulation({ seed: 1 });
  const plant = simulation.state.plants[0];
  while (plant.alive) simulation.step();
  for (const key of ["age", "cells", "energy"]) {
    Object.defineProperty(plant, key, { get() { throw new Error(`Archive read: ${key}`); } });
  }
  for (let i = 0; i < 100; i++) simulation.step();
  assert.equal(simulation.state.populationHistory.at(-1).alive, 0);
});

test("descendants link to archived parents and reset clears both collections", () => {
  const simulation = createSimulation({ seed: 16 });
  const founder = simulation.state.plants[0];
  for (let i = 0; i < 1000; i++) simulation.step();
  assert.equal(founder.alive, false);
  assert.ok(founder.children.length > 0);
  assert.ok(!simulation.state.plants.includes(founder));
  for (const id of founder.children) {
    assert.ok(simulation.state.plantsById.get(id).parents.includes(founder.id));
  }
  assert.ok(simulation.state.plants.every(plant => plant.alive));
  const state = simulation.state;
  simulation.reset();
  assert.equal(simulation.state, state);
  assert.equal(state.plants.length, 1);
  assert.equal(state.plantsById.size, 1);
  assert.notEqual(state.plantsById.get(1), founder);
});
