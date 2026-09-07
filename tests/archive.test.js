import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../src/simulation/simulation.js";
import { createArchiveSession, openArchive } from "../src/persistence/archive.js";
import { memoryArchive } from "./helpers/archive-store.js";

test("archiving preserves deterministic worlds, late offspring, and complete lineage", async () => {
  const baseline = createSimulation({ seed: 16 });
  const sim = createSimulation({ seed: 16 });
  const store = memoryArchive();
  const archive = createArchiveSession(store, sim);
  await archive.start();
  await archive.flush();
  for (let tick = 0; tick < 5000; tick++) {
    baseline.step(); sim.step(); await archive.flush();
    assert.equal(sim.state.plantsById.size, sim.state.plants.length);
  }
  assert.deepEqual(sim.state.plants, baseline.state.plants);
  assert.deepEqual(sim.state.seeds, baseline.state.seeds);
  assert.deepEqual(sim.state.deathCounts, baseline.state.deathCounts);
  assert.equal(store.records.size, baseline.state.nextPlantId - 1);
  for (const p of baseline.state.plantsById.values()) {
    const saved = await archive.get(p.id);
    assert.deepEqual(saved.parents, p.parents);
    assert.deepEqual(saved.children, p.children);
    assert.deepEqual(saved.dna, p.dna);
    assert.equal(saved.diedAt, p.diedAt);
    assert.equal(saved.causeOfDeath, p.causeOfDeath);
  }
});

test("failed writes keep dead records and retry without duplicates", async () => {
  const sim = createSimulation({ seed: 1 });
  const store = memoryArchive();
  const archive = createArchiveSession(store, sim);
  await archive.start(); await archive.flush();
  while (sim.state.plants[0]?.alive) sim.step();
  store.fail = true;
  await assert.rejects(archive.flush(), /Disk full/);
  assert.ok(sim.state.plantsById.has(1));
  assert.ok(sim.pendingArchiveChanges().length);
  store.fail = false;
  await archive.flush();
  assert.equal(sim.state.plantsById.size, 0);
  assert.equal(sim.pendingArchiveChanges().length, 0);
  assert.equal((await archive.get(1)).alive, false);
  assert.equal(store.records.size, 1);
});

test("run IDs isolate resets and a new session can inspect an earlier run", async () => {
  const sim = createSimulation({ seed: 1 });
  const store = memoryArchive();
  const first = createArchiveSession(store, sim);
  await first.start(); await first.flush();
  const oldRun = first.runId;
  sim.reset();
  const reopened = createArchiveSession(store, sim);
  await reopened.start(); await reopened.flush();
  assert.notEqual(reopened.runId, oldRun);
  assert.equal((await reopened.get(1, oldRun)).runId, oldRun);
  assert.equal((await reopened.get(1)).runId, reopened.runId);
  assert.equal(await reopened.get(999), null);
});

test("unavailable IndexedDB produces an actionable failure", async () => {
  await assert.rejects(openArchive(null), /unavailable/);
});
