import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../src/simulation/simulation.js";
import { createRenderer } from "../src/rendering/renderer.js";
import { createUI } from "../src/ui/ui.js";

test("a selected dead ancestor remains inspectable and links to descendants", () => {
  const simulation = createSimulation({ seed: 16 });
  const founder = simulation.state.plants[0];
  const viewState = { cellSize: 20, labelMode: "none", selectedPlant: founder };
  const labels = [];
  const context = new Proxy({}, { get: (_, key) => key === "fillText"
    ? text => labels.push(text) : () => {}, set: () => true });
  function element() {
    return {
      style: {}, children: [], listeners: {}, offsetWidth: 5000, offsetHeight: 1800,
      set innerHTML(value) { this.children = []; },
      appendChild(child) { this.children.push(child); },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      getContext: () => context,
    };
  }
  const elements = new Map();
  const document = {
    addEventListener() {}, createElement: element,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
  };
  const canvas = element();
  const renderer = createRenderer(canvas, simulation, viewState);
  const ui = createUI({ document, window: { innerWidth: 1280, innerHeight: 720, addEventListener() {} },
    canvas, simulation, viewState, store: { load: () => ({}) },
    redraw: () => { renderer.draw(); ui.drawPlantInfo(); },
  });
  for (let i = 0; i < 1000; i++) simulation.step();
  renderer.draw();
  ui.drawPlantInfo();
  assert.equal(founder.alive, false);
  assert.ok(!simulation.state.plants.includes(founder));
  assert.equal(document.getElementById("info-id").textContent, "#1");
  assert.match(document.getElementById("info-born").textContent, /–/);
  assert.equal(document.getElementById("info-cells").textContent, "—");
  assert.equal(document.getElementById("btn-save-genome").disabled, false);
  assert.ok(labels.includes(`plants: ${simulation.state.plants.length}`));
  assert.ok(labels.includes(`total ever: ${simulation.state.plantsById.size}`));

  document.getElementById("info-children").children[0].listeners.click();
  assert.ok(viewState.selectedPlant.parents.includes(founder.id));
  document.getElementById("info-parents").children[0].listeners.click();
  assert.equal(viewState.selectedPlant, founder);
});
