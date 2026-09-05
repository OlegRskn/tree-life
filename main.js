import { createSimulation } from "./src/simulation/simulation.js";
import { createRenderer } from "./src/rendering/renderer.js";
import { defaultViewConfig } from "./src/rendering/config.js";
import { createUI } from "./src/ui/ui.js";
import { createGenomeStore } from "./src/persistence/genomes.js";

const simulation = createSimulation();
const viewState = { ...defaultViewConfig, selectedPlant: null, labelMode: "none" };
const canvas = document.getElementById("world");
const renderer = createRenderer(canvas, simulation, viewState);
let running = true;
let scheduled = false;

function draw() {
  renderer.draw();
  ui.drawPlantInfo();
}

function scheduleTick() {
  if (scheduled || !running) return;
  scheduled = true;
  requestAnimationFrame(tick);
}

function tick() {
  scheduled = false;
  if (!running) return;
  simulation.step();
  draw();
  scheduleTick();
}

const ui = createUI({
  document, window, canvas, simulation, viewState,
  store: createGenomeStore(localStorage),
  redraw: draw,
  toggleRunning() {
    running = !running;
    if (running) scheduleTick();
  },
  restart() {
    simulation.reset();
    running = true;
    draw();
    scheduleTick();
  },
});

scheduleTick();
