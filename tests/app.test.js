import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { memoryArchive } from "./helpers/archive-store.js";

async function harness(options = {}) {
  const context = new Proxy({}, { get: () => () => {}, set: () => true });
  class Element {
    set id(value) { this.elementId = value; elements.set(value, this); }
    get id() { return this.elementId; }
    constructor() { this.style = {}; this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.value = ""; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    async fire(type, event = {}) { for (const fn of this.listeners[type] ?? []) await fn(event); }
    appendChild(child) { this.children.push(child); }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { doc.activeElement = this; }
    getContext() { return context; }
    getBoundingClientRect() { return this.bounds ?? { left: 20, top: 100, width: 900, height: 500 }; }
  }
  const elements = new Map();
  const doc = new Element();
  doc.getElementById = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  doc.createElement = () => new Element();
  const win = new Element();
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const frames = [];
  const globals = { document: doc, window: win, localStorage: storage, requestAnimationFrame: callback => frames.push(callback) };
  const original = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  const store = options.store ?? memoryArchive();
  const app = await createApp({ openStore: async () => store, simulationOptions: { seed: 16, ...options.simulationOptions } });
  const el = doc.getElementById;
  return { app, store, el, frames, data,
    click: id => el(id).fire("click"),
    key: (key, tagName) => doc.fire("keydown", { key, target: { tagName }, preventDefault() {} }),
    async frame(time) { const callback = frames.shift(); assert.ok(callback, "a frame is scheduled"); await callback(time); },
    async selectFounder() {
      const p = app.viewState.camera.screenAt(120.5, 84.5);
      const rect = el("world").getBoundingClientRect();
      const event = { button: 0, pointerId: 1, clientX: rect.left + p.x, clientY: rect.top + p.y };
      await el("world").fire("pointerdown", event); await el("world").fire("pointerup", event);
    },
    restore() { for (const [key, descriptor] of Object.entries(original)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}

test("Observe starts paused, steps once, preserves camera, saves a genome and confirms reset", async () => {
  const h = await harness();
  try {
    assert.equal(h.app.simulation.state.tickCount, 0); assert.equal(h.frames.length, 0);
    assert.equal(h.el("play-toggle").textContent, "Start");
    await h.selectFounder();
    assert.equal(h.el("info-id").textContent, "#1");
    assert.equal(h.el("focus-plant").disabled, false);
    const position = { x: h.app.viewState.camera.x, y: h.app.viewState.camera.y, zoom: h.app.viewState.camera.zoom };
    await h.click("step-once");
    assert.equal(h.app.simulation.state.tickCount, 1); assert.equal(h.frames.length, 0);
    assert.deepEqual({ x: h.app.viewState.camera.x, y: h.app.viewState.camera.y, zoom: h.app.viewState.camera.zoom }, position);
    await h.click("btn-save-genome");
    h.el("genome-name-input").value = "founder";
    await h.el("genome-save-form").fire("submit", { preventDefault() {} });
    assert.ok(JSON.parse(h.data.get("genomes")).founder);
    assert.match(h.el("genome-save-message").textContent, /Saved founder/);
    await h.click("new-world");
    assert.equal(h.app.simulation.state.tickCount, 1, "confirmation does not reset");
    await h.click("cancel-new-world");
    assert.equal(h.app.viewState.selectedPlant.id, 1);
    await h.click("new-world"); await h.click("confirm-new-world");
    assert.equal(h.app.simulation.state.tickCount, 0);
    assert.equal(h.app.viewState.selectedPlant, null); assert.equal(h.app.playback.running, false);
    assert.equal(h.el("genome-save-message").textContent, "", "a new world clears the previous save notice");
    assert.equal(h.el("genome-save-form").hidden, true);
    assert.equal(h.frames.length, 0);
  } finally { h.restore(); }
});

test("playback follows elapsed time; screen navigation and keyboard focus preserve user intent", async () => {
  const h = await harness();
  try {
    await h.key(" ", "BUTTON"); assert.equal(h.app.playback.running, false);
    await h.key(" ", "INPUT"); assert.equal(h.app.playback.running, false);
    await h.click("play-toggle");
    await h.frame(0); await h.frame(100);
    assert.equal(h.app.simulation.state.tickCount, 3);
    await h.click("speed-4"); await h.frame(110); await h.frame(160);
    assert.equal(h.app.simulation.state.tickCount, 9);
    await h.click("nav-history");
    assert.equal(h.app.playback.running, false);
    await h.frame(200); assert.equal(h.frames.length, 0);
    await h.click("nav-observe"); assert.equal(h.app.playback.running, false);
    await h.key("L"); assert.equal(h.app.viewState.labelMode, "gene");
    await h.key("\u0434"); assert.equal(h.app.viewState.labelMode, "energy");
    await h.key("\u044b"); assert.equal(h.app.simulation.state.shadowMode, "column");
    await h.key("S"); assert.equal(h.app.simulation.state.shadowMode, "canopy");
  } finally { h.restore(); }
});

test("storage errors stop time and retry keeps the intended playback state", async () => {
  const h = await harness();
  try {
    await h.click("play-toggle"); await h.frame(0);
    h.store.fail = true;
    h.app.simulation.plantSavedGenome(h.app.simulation.state.plants[0].dna);
    await h.frame(40);
    assert.equal(h.app.simulation.state.tickCount, 0);
    assert.equal(h.frames.length, 0);
    assert.equal(h.el("archive-error").hidden, false);
    assert.equal(h.el("step-once").disabled, true);
    assert.ok(h.app.simulation.pendingArchiveChanges().length);
    h.store.fail = false; await h.click("archive-retry");
    assert.equal(h.el("archive-error").hidden, true); assert.equal(h.frames.length, 1);
    await h.frame(1000); assert.equal(h.app.simulation.state.tickCount, 0, "no catch-up after storage recovery");
    await h.frame(1040); assert.equal(h.app.simulation.state.tickCount, 1);
  } finally { h.restore(); }
});

test("a failed initial save recovers into a paused world", async () => {
  const store = memoryArchive(); store.fail = true;
  const h = await harness({ store });
  try {
    assert.equal(h.frames.length, 0); assert.equal(h.el("play-toggle").disabled, true);
    store.fail = false; await h.click("archive-retry");
    assert.equal(h.el("play-toggle").disabled, false); assert.equal(h.frames.length, 0);
  } finally { h.restore(); }
});

test("death preserves Overview and ends only when neither plants nor seeds remain", async () => {
  const h = await harness({ simulationOptions: { config: { MIN_AGE: 1, MAX_AGE: 1 } } });
  try {
    await h.selectFounder();
    for (let i = 0; i < 5; i++) await h.click("step-once");
    await Promise.resolve();
    assert.equal(h.el("plant-status").textContent, "Dead");
    assert.equal(h.el("playback-status").textContent, "Ended");
    assert.equal(h.el("btn-save-genome").disabled, false);
    assert.equal(h.el("focus-plant").disabled, true);
    assert.match(h.el("death-details").textContent, /tick 5/);
    const deadDNA = h.app.viewState.selectedPlant.dna;
    h.app.simulation.state.seeds.push({ x: 120, y: 80, age: 0, dna: deadDNA, parents: [] });
    await h.click("step-once");
    assert.equal(h.el("playback-status").textContent, "Paused");
    assert.match(h.el("world-state").textContent, /Waiting for germination/);
  } finally { h.restore(); }
});

test("Lineage tabs and family navigation preserve camera, playback, page and scroll", async () => {
  const h = await harness();
  try {
    const template = h.app.simulation.state.plants[0];
    const records = Array.from({ length: 9 }, (_, i) => ({ ...template, id: i + 2, parents: [1], alive: false, diedAt: 50, generation: 1 }));
    records.push({ ...template, id: 20, parents: [8, 9], alive: false, diedAt: 60, generation: 2 });
    await h.store.write(1, records);
    h.store.get = () => { throw new Error("Unbounded legacy lookup must not be used"); };
    await h.selectFounder();
    await h.click("inspector-tab-lineage");
    assert.equal(h.el("inspector-lineage").hidden, false);
    assert.equal(h.el("family-children").children.length, 6);
    assert.equal(h.el("family-child-count").textContent, "9 children");
    await h.click("family-next");
    assert.equal(h.el("family-page").textContent, "7–9 of 9");
    h.el("info-panel").scrollTop = 280;
    const camera = h.app.viewState.camera;
    const pose = [camera.x, camera.y, camera.zoom];
    await h.click("play-toggle");
    await h.el("family-children").children[0].fire("click");
    assert.equal(h.app.viewState.selectedPlant.id, 8);
    await h.el("family-children").children[0].fire("click");
    assert.equal(h.app.viewState.selectedPlant.id, 20);
    assert.equal(h.el("family-parents").children.length, 2);
    await h.click("family-back"); assert.equal(h.app.viewState.selectedPlant.id, 8);
    await h.click("family-origin");
    assert.equal(h.app.viewState.selectedPlant.id, 1);
    assert.equal(h.el("family-page").textContent, "7–9 of 9");
    assert.equal(h.el("info-panel").scrollTop, 280);
    assert.deepEqual([camera.x, camera.y, camera.zoom], pose);
    assert.equal(h.app.playback.running, true); assert.equal(h.app.simulation.state.tickCount, 0);
    await h.click("inspector-tab-dna"); assert.equal(h.el("inspector-dna").hidden, false);
    await h.selectFounder(); assert.equal(h.el("inspector-overview").hidden, false);
    assert.equal(h.el("family-back").disabled, true);
  } finally { h.restore(); }
});

test("historical family statuses, failed reads and tab keyboard controls remain usable", async () => {
  const h = await harness();
  try {
    const template = h.app.simulation.state.plants[0];
    const run = await h.store.createRun();
    await h.store.write(run, [{ ...template, id: 1, parents: [99] }, { ...template, id: 2, parents: [1] }]);
    h.el("archive-run").value = run; h.el("archive-plant").value = 1;
    await h.click("archive-open");
    assert.equal(h.el("plant-status").textContent, "Unknown");
    assert.equal(h.el("focus-plant").disabled, true);
    await h.el("inspector-tab-overview").fire("keydown", { key: "ArrowRight", preventDefault() {} });
    assert.equal(h.el("inspector-lineage").hidden, false);
    assert.equal(h.el("family-children").children[0].attributes["aria-label"], "Open plant #2, Unknown");
    const childButton = h.el("family-children").children[0];
    await h.store.write(run, [{ ...template, id: 2, parents: [1], alive: false, diedAt: 10 }]);
    await h.click("family-refresh");
    assert.equal(h.el("family-children").children[0], childButton, "refreshing status keeps the existing control");
    assert.equal(childButton.attributes["aria-label"], "Open plant #2, Dead");
    await h.el("family-parents").children[0].fire("click");
    assert.equal(h.el("family-retry").hidden, false);
    assert.match(h.el("archive-message").textContent, /no record/);
    assert.equal(h.app.viewState.selectedPlant.id, 1);
    await h.store.write(run, [{ ...template, id: 99, parents: [] }]);
    await h.click("family-retry");
    assert.equal(h.app.viewState.selectedPlant.id, 99);
    assert.equal(h.el("family-retry").hidden, true);
  } finally { h.restore(); }
});

test("live conditions persist an intervention, preserve interaction, and repeat the original start", async () => {
  const h = await harness();
  try {
    await h.selectFounder(); const plant = h.app.viewState.selectedPlant;
    const camera = h.app.viewState.camera; const pose = [camera.x, camera.y, camera.zoom];
    await h.click("play-toggle"); await h.frame(0); await h.click("show-conditions");
    assert.equal(h.app.playback.running, true);
    h.el("condition-number-LIGHT_MULTIPLIER").value = "0.6";
    await h.el("condition-number-LIGHT_MULTIPLIER").fire("change");
    assert.equal(h.app.simulation.getConditions().LIGHT_MULTIPLIER, 0.6);
    assert.equal(h.app.simulation.state.tickCount, 0); assert.equal(h.app.viewState.selectedPlant, plant);
    assert.deepEqual([camera.x, camera.y, camera.zoom], pose);
    assert.deepEqual(h.store.runs.get(1).interventions[0].after, { LIGHT_MULTIPLIER: 0.6 });
    h.el("condition-number-LIGHT_MULTIPLIER").value = "999";
    await h.el("condition-number-LIGHT_MULTIPLIER").fire("change");
    assert.equal(h.app.simulation.getConditions().LIGHT_MULTIPLIER, 0.6);
    assert.match(h.el("conditions-message").textContent, /Invalid/);
    await h.click("new-world"); h.el("new-world-mode").value = "repeat"; await h.click("confirm-new-world");
    assert.equal(h.app.simulation.getConditions().LIGHT_MULTIPLIER, 1);
    assert.equal(h.store.runs.get(2).start.seed, 16); assert.equal(h.app.playback.running, false);
    assert.equal(h.store.runs.get(1).interventions.length, 1);
  } finally { h.restore(); }
});

test("failed intervention writes stop playback and retry saves exactly once", async () => {
  const h = await harness();
  try {
    await h.click("play-toggle"); await h.frame(0); h.store.fail = true;
    h.el("condition-LIGHT_MULTIPLIER").value = "0"; await h.el("condition-LIGHT_MULTIPLIER").fire("change");
    assert.equal(h.el("archive-error").hidden, false);
    assert.equal(h.app.simulation.state.tickCount, 0);
    h.store.fail = false; await h.click("archive-retry"); await h.click("archive-retry");
    assert.equal(h.store.runs.get(1).interventions.length, 1);
    assert.equal(h.el("archive-error").hidden, true); assert.equal(h.app.playback.running, true);
  } finally { h.restore(); }
});
