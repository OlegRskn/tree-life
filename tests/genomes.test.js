import test from "node:test";
import assert from "node:assert/strict";
import { createGenomeStore } from "../src/persistence/genomes.js";

test("existing genome format can be loaded, saved and removed", () => {
  const data = new Map([["genomes", JSON.stringify({ old: [[1, 2, 3, 4]] })]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createGenomeStore(storage);
  const dna = [[5, 6, 7, 8]];
  store.save("new", dna);
  dna[0][0] = 0;
  assert.deepEqual(store.load(), { old: [[1, 2, 3, 4]], new: [[5, 6, 7, 8]] });
  store.remove("old");
  assert.deepEqual(store.load(), { new: [[5, 6, 7, 8]] });
  store.remove("new");
  assert.deepEqual(store.load(), {});
});

test("empty storage loads an empty library; storage failures propagate", () => {
  assert.deepEqual(createGenomeStore({ getItem: () => null }).load(), {});
  assert.throws(() => createGenomeStore({ getItem() { throw new Error("unavailable"); } }).load(), /unavailable/);
});
