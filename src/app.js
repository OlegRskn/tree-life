import { createSimulation } from "./simulation/simulation.js";
import { createRenderer } from "./rendering/renderer.js";
import { defaultViewConfig } from "./rendering/config.js";
import { createUI } from "./ui/ui.js";
import { createGenomeStore } from "./persistence/genomes.js";
import { openArchive, createArchiveSession } from "./persistence/archive.js";

export async function createApp({ openStore = openArchive } = {}) {
  const simulation = createSimulation();
  const viewState = { ...defaultViewConfig, selectedPlant: null, labelMode: "none", lineageHighlights: [] };
  const canvas = document.getElementById("world");
  const renderer = createRenderer(canvas, simulation, viewState);
  let running = true;
  let scheduled = false;
  let busy = false;
  let failed = false;
  let archive;
  let operations = Promise.resolve();
  const status = document.getElementById("archive-status");
  function draw() { renderer.draw(); ui.drawPlantInfo(); }
  function scheduleTick() {
    if (scheduled || !running || busy || failed) return;
    scheduled = true;
    requestAnimationFrame(tick);
  }
  function persist(action) {
    operations = operations.then(() => performPersist(action));
    return operations;
  }
  async function performPersist(action = () => {}) {
    busy = true;
    try {
      if (!archive) archive = createArchiveSession(await openStore(), simulation);
      if (archive.runId === undefined) await archive.start();
      await archive.flush();
      await action();
      const changed = await archive.flush();
      failed = false;
      status.textContent = `History saved - run ${archive.runId}`;
      if (changed) ui.refreshArchiveSelection();
    } catch (error) {
      failed = true;
      status.textContent = `History not saved - paused. ${error.message}. Click Retry.`;
    } finally {
      busy = false;
      draw();
      scheduleTick();
    }
  }
  async function tick() {
    scheduled = false;
    if (!running || busy || failed) return;
    await persist(() => simulation.step());
  }
  const ui = createUI({
    document, window, canvas, simulation, viewState,
    store: createGenomeStore(localStorage), redraw: draw,
    archive: {
      get runId() { return archive?.runId; },
      async get(id, runId) {
        if (!archive) throw new Error("History is unavailable");
        return archive.get(id, runId);
      },
    },
    plantGenome(dna) { return persist(() => simulation.plantSavedGenome(dna)); },
    toggleRunning() { running = !running; scheduleTick(); },
    restart() {
      return persist(async () => {
        await archive.start();
        simulation.reset();
        ui.clearArchiveSelection();
        running = true;
      });
    },
  });
  document.getElementById("archive-retry").addEventListener("click", () => persist());
  draw();
  await persist();
  return { simulation, viewState };
}
