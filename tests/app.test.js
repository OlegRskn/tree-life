import test from "node:test";
import assert from "node:assert/strict";
import { createRandom } from "../src/simulation/random.js";

// Minimal browser boundary: execute the real entry point, renderer and UI with
// deterministic frames. Real browser layout is checked separately.
test("app integration: frames, selection, labels, shadow, save, sow, delete and restart", async () => {
  const drawnText = [];
  const context = new Proxy({}, { get: (_, key) => key === "fillText"
    ? text => drawnText.push(text) : () => {}, set: () => true });
  class Element {
    constructor() { this.style = {}; this.children = []; this.listeners = {}; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    appendChild(child) { this.children.push(child); }
    getContext() { return context; }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
    get offsetWidth() { return 5040; }
    get offsetHeight() { return 1800; }
  }
  const elements = new Map();
  const doc = new Element();
  doc.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  doc.createElement = () => new Element();
  const win = new Element();
  let promptMessage;
  Object.assign(win, { innerWidth: 1280, innerHeight: 720,
    prompt(message) { promptMessage = message; return "test-genome"; } });
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const frames = [];
  const globals = { document: doc, window: win, localStorage: storage, requestAnimationFrame: callback => frames.push(callback) };
  const original = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalRandom = Math.random;
  try {
    Object.assign(globalThis, globals);
    Math.random = createRandom(16);
    await import("../main.js");
    const element = id => doc.getElementById(id);
    const key = key => doc.listeners.keydown({ key, preventDefault() {} });
    const frame = () => { drawnText.length = 0; frames.shift()(); };
    frame();
    assert.ok(drawnText.includes("tick: 1"));
    assert.equal(frames.length, 1);
    element("world").listeners.click({ clientX: 2410, clientY: 1690 });
    assert.equal(element("info-id").textContent, "#1");
    assert.equal(element("btn-save-genome").disabled, false);
    assert.equal(element("info-dna").children.length, 17);
    assert.match(element("info-born").textContent, /^tick /);
    assert.match(element("genome-list").innerHTML, /No saved genomes/);

    key(" ");
    frame();
    assert.equal(frames.length, 0);
    key("L");
    assert.ok(drawnText.includes("labels: gene"));
    key("S");
    assert.ok(drawnText.includes("shadow: column"));
    key("\u044b"); // Same physical key on a Russian keyboard layout.
    assert.ok(drawnText.includes("shadow: canopy"));
    key("\u0434");
    assert.ok(drawnText.includes("labels: energy"));

    element("btn-save-genome").listeners.click();
    assert.equal(promptMessage, "Genome name:");
    assert.ok(JSON.parse(data.get("genomes"))["test-genome"]);
    const actions = element("genome-list").children[0].children[1];
    assert.equal(actions.children[0].textContent, "Plant");
    actions.children[0].listeners.click();
    key("l");
    assert.ok(drawnText.includes("plants: 2"));
    actions.children[1].listeners.click();
    assert.deepEqual(JSON.parse(data.get("genomes")), {});

    key("\u043a");
    assert.equal(element("info-content").style.display, "none");
    assert.equal(element("btn-save-genome").disabled, true);
    assert.equal(frames.length, 1);
    frame();
    assert.ok(drawnText.includes("tick: 1"));
    assert.ok(drawnText.includes("plants: 1"));
    key("R");
    assert.equal(frames.length, 1, "restart must not create a second frame loop");
  } finally {
    Math.random = originalRandom;
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
