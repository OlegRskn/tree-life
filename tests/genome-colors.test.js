import test from "node:test";
import assert from "node:assert/strict";
import { genomePalette } from "../src/rendering/genome-colors.js";
import { createRenderer } from "../src/rendering/renderer.js";
import { createSimulation } from "../src/simulation/simulation.js";

const dnaOf = value => Array.from({ length: 16 }, () => Array(4).fill(value));
const distance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test("genome colors survive serialization and do not mutate DNA", () => {
  const dna = dnaOf(15), saved = JSON.stringify(dna);
  assert.deepEqual(genomePalette(dna), genomePalette(JSON.parse(saved)));
  assert.equal(JSON.stringify(dna), saved);
  assert.ok(distance(genomePalette(dnaOf(0)).hue, genomePalette(dnaOf(31)).hue) > 60);
});

test("every one-position mutation stays close, including hue wraparound", () => {
  for (const initial of [0, 15, 31]) {
    const dna = dnaOf(initial), base = genomePalette(dna).hue;
    for (let i = 0; i < 64; i++) for (const value of [0, 14, 16, 31]) {
      const changed = structuredClone(dna); changed[Math.floor(i / 4)][i % 4] = value;
      const delta = distance(base, genomePalette(changed).hue);
      assert.ok(delta <= 18.01);
      if (Math.abs(value - initial) === 1) assert.ok(delta < 0.6);
    }
  }
});

test("renderer colors each body and seed by its own genome without changing model state", () => {
  const simulation = createSimulation({ seed: 16 });
  const plant = simulation.state.plants[0];
  plant.cells = ["leaf", "wood", "sprout", "ready"].map((type, x) => ({ type, x, y: 10 }));
  const dna = dnaOf(0); simulation.state.seeds.push({ dna, x: 8, y: 9 });
  const before = JSON.stringify(simulation.state);
  const fills = [], strokes = [];
  const ctx = new Proxy({ fillRect(x, y) { fills.push({ x, y, color: this.fillStyle }); },
    strokeRect() { strokes.push(this.strokeStyle); } }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = { getContext: () => ctx };
  createRenderer(canvas, simulation, { cellSize: 20, selectedPlant: plant, labelMode: "none", lineageHighlights: [] }).draw();
  for (const cell of plant.cells) assert.equal(fills.find(f => f.x === cell.x * 20 && f.y === 200 && f.color.startsWith("hsl"))?.color, genomePalette(plant.dna)[cell.type]);
  assert.equal(fills.at(-1).color, genomePalette(dna).seed);
  assert.ok(strokes.every(color => color === "white"));
  assert.equal(JSON.stringify(simulation.state), before);
});
