import test from "node:test";
import assert from "node:assert/strict";
import { createUI } from "../src/ui/ui.js";

function harness(get) {
  const elements = new Map();
  class Element {
    constructor() { this.style = {}; this.children = []; this.listeners = {}; this.value = ""; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    appendChild(child) { this.children.push(child); }
  }
  const document = new Element();
  document.createElement = () => new Element();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const window = Object.assign(new Element(), { innerWidth: 1000, innerHeight: 800 });
  const viewState = { selectedPlant: null, lineageHighlights: [] };
  const simulation = { state: { plantsById: new Map() } };
  const ui = createUI({ document, window, canvas: new Element(), simulation, viewState,
    store: { load: () => ({}) }, redraw: () => ui.drawPlantInfo(),
    archive: { runId: 2, get }, restart() {}, toggleRunning() {} });
  const el = id => document.getElementById(id);
  return { ui, el, viewState, simulation,
    open(id, run = 2) {
      el("archive-run").value = String(run); el("archive-plant").value = String(id);
      return el("archive-open").listeners.click();
    } };
}
const record = (id, children = []) => ({ id, parents: [], children, alive: false,
  generation: 0, bornAt: 0, diedAt: 10, age: 2, maxAge: 80,
  causeOfDeath: "starvation", dna: [[1, 2, 3, 4]], cells: [] });

test("archived lineage links load late children and highlight living descendants", async () => {
  const records = new Map([[1, record(1, [2])], [2, { ...record(2), parents: [1], alive: true }]]);
  const h = harness(async id => records.get(id));
  h.simulation.state.plantsById.set(2, records.get(2));
  await h.open(1);
  assert.equal(h.viewState.selectedPlant.id, 1);
  assert.match(h.el("info-age").textContent, /^2 \(starvation\)/);
  assert.equal(h.viewState.lineageHighlights[0].id, 2);
  await h.el("info-children").children[0].listeners.click();
  assert.equal(h.viewState.selectedPlant, records.get(2));
  await h.el("info-parents").children[0].listeners.click();
  assert.equal(h.viewState.selectedPlant.id, 1);
});

test("late reads cannot replace a newer selection or restore a card after reset", async () => {
  let resolveFirst;
  const h = harness(id => id === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve(record(id)));
  const first = h.open(1);
  await h.open(2);
  resolveFirst(record(1)); await first;
  assert.equal(h.viewState.selectedPlant.id, 2);
  const pending = h.open(1);
  h.ui.clearArchiveSelection();
  resolveFirst(record(1)); await pending;
  assert.equal(h.viewState.selectedPlant, null);
});

test("missing, invalid and unreadable records show errors without stale cards", async () => {
  const h = harness(async id => { if (id === 3) throw new Error("Read denied"); return id === 1 ? record(1) : null; });
  await h.open(1); await h.open(2);
  assert.equal(h.viewState.selectedPlant, null);
  assert.match(h.el("archive-message").textContent, /No record/);
  await h.open(3);
  assert.match(h.el("archive-message").textContent, /Read denied/);
  await h.open(-1);
  assert.match(h.el("archive-message").textContent, /positive whole numbers/);
});

test("historical living records are labelled as incomplete and never highlight a new world", async () => {
  const h = harness(async id => ({ ...record(id), alive: true }));
  await h.open(1, 1);
  assert.match(h.el("archive-message").textContent, /final state unknown/);
  assert.deepEqual(h.viewState.lineageHighlights, []);
});
