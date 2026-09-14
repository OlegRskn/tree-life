import { createSimulation } from "./simulation/simulation.js";
import { createRenderer } from "./rendering/renderer.js";
import { defaultViewConfig } from "./rendering/config.js";
import { createCamera, bindCamera } from "./rendering/camera.js";
import { createUI } from "./ui/ui.js";
import { createPlayback } from "./ui/playback.js";
import { createGenomeStore } from "./persistence/genomes.js";
import { openArchive, createArchiveSession } from "./persistence/archive.js";

export async function createApp({ openStore = openArchive, simulationOptions } = {}) {
  const simulation = createSimulation(simulationOptions);
  const playback = createPlayback();
  const camera = createCamera(simulation.state.config);
  const viewState = { ...defaultViewConfig, selectedPlant: null, labelMode: "none", lineageHighlights: [], camera };
  const el = id => document.getElementById(id);
  const canvas = el("world");
  const renderer = createRenderer(canvas, simulation, viewState);
  let scheduled = false, busy = false, failed = false, ready = false;
  let archive, epoch = 0, screen = "observe";
  let operations = Promise.resolve();
  const ended = () => !simulation.state.plants.length && !simulation.state.seeds.length;
  function text(id, value) { if (el(id).textContent !== String(value)) el(id).textContent = String(value); }
  function updateControls() {
    const state = simulation.state;
    const empty = ended();
    const mode = failed ? "Storage paused" : !ready ? "Opening history" : empty ? "Ended" : playback.running ? "Live" : "Paused";
    text("playback-status", mode);
    el("playback-status").dataset.state = failed ? "error" : playback.running ? "live" : "paused";
    text("play-toggle", playback.running ? "Pause" : state.tickCount ? "Resume" : "Start");
    el("play-toggle").disabled = !ready || failed || empty || screen !== "observe";
    el("step-once").disabled = !ready || failed || empty || playback.running || busy || screen !== "observe";
    el("new-world").disabled = !ready || busy || failed;
    text("tick-value", state.tickCount.toLocaleString("en-US"));
    text("run-id", archive?.runId ? `Run ${String(archive.runId).padStart(2, "0")}` : "Opening...");
    text("plant-count", `${state.plants.length} ${state.plants.length === 1 ? "plant" : "plants"}`);
    text("seed-count", `${state.seeds.length} ${state.seeds.length === 1 ? "seed" : "seeds"}`);
    let gen = 0; for (const plant of state.plants) gen = Math.max(gen, plant.generation);
    text("generation-count", `Generation ${gen}`);
    text("world-state", empty ? "No living plants or seeds remain." : !state.plants.length ? "Seeds remain. Waiting for germination." : "");
    el("world-notice").hidden = !ready || failed || !!state.plants.length;
    text("world-notice-title", empty ? "This world has fallen quiet" : "Life is waiting");
    text("world-notice-copy", empty ? "Your records and genomes are still here." : "Seeds can still germinate. Let time continue.");
    el("review-run").hidden = !empty;
    el("founder-hint").hidden = !!viewState.selectedPlant || state.tickCount !== 0 || camera.mode !== "founder";
    text("camera-mode", camera.mode === "founder" ? "Founder view" : camera.mode === "fit" ? "Whole world" : "Exploring");
    text("zoom-value", `${Math.round(camera.zoom / 24 * 100)}%`);
    for (const speed of [1, 4, 16]) el(`speed-${speed}`).setAttribute("aria-pressed", String(playback.speed === speed));
    el("archive-retry").hidden = !failed;
    el("archive-error").hidden = !failed;
  }
  function draw() { if (screen === "observe") renderer.draw(); ui.drawPlantInfo(); updateControls(); }
  function pause() { epoch++; playback.pause(); draw(); }
  function scheduleTick() {
    if (scheduled || !playback.running || busy || failed || !ready || ended()) return;
    scheduled = true; requestAnimationFrame(tick);
  }
  function persist(action) {
    operations = operations.then(() => performPersist(action));
    return operations;
  }
  async function performPersist(action = () => {}) {
    busy = true; updateControls();
    try {
      if (!archive) archive = createArchiveSession(await openStore(), simulation);
      if (archive.runId === undefined) await archive.start();
      let changed = await archive.flush();
      await action();
      changed = await archive.flush() || changed;
      ready = true; failed = false;
      text("archive-status", "History saved locally");
      if (changed) ui.refreshArchiveSelection();
      if (ended()) playback.pause();
    } catch (error) {
      failed = true; playback.resetClock();
      text("archive-status", "History not saved");
      text("archive-error-message", `Playback is paused. ${error.message}. Your pending records are kept in memory. Retry before closing this page.`);
    } finally { busy = false; draw(); scheduleTick(); }
  }
  async function tick(time) {
    scheduled = false;
    if (!playback.running || busy || failed || ended()) return;
    const token = epoch;
    const due = playback.due(time);
    for (let i = 0; i < due; i++) {
      if (token !== epoch || !playback.running || failed || ended()) break;
      await persist(() => { if (token === epoch && playback.running) simulation.step(); });
    }
    draw(); scheduleTick();
  }
  function toggleRunning() {
    if (!ready || failed || ended() || screen !== "observe") return;
    if (playback.running) pause(); else { playback.play(); draw(); scheduleTick(); }
  }
  function stepOnce() {
    if (!ready || failed || ended() || playback.running || busy || screen !== "observe") return;
    return persist(() => simulation.step());
  }
  function showScreen(name) {
    pause(); screen = name;
    for (const item of ["observe", "history", "herbarium"]) {
      el(`${item}-screen`).hidden = item !== name;
      el(`nav-${item}`).setAttribute("aria-current", item === name ? "page" : "false");
    }
    draw();
  }
  async function restart() {
    pause(); el("new-world-confirm").hidden = true;
    await persist(async () => {
      await archive.start(); simulation.reset(); ui.clearArchiveSelection();
      camera.founder(); playback.pause();
    });
  }
  function requestRestart() {
    if (!ready || failed) return;
    pause(); el("new-world-confirm").hidden = false; el("cancel-new-world").focus();
  }
  const ui = createUI({ document, window, canvas, simulation, viewState,
    store: createGenomeStore(localStorage), redraw: draw,
    archive: {
      get runId() { return archive?.runId; },
      async get(id, runId) {
        if (!archive) throw new Error("History is unavailable");
        return archive.get(id, runId);
      },
      async family(id, runId, page) {
        if (!archive) throw new Error("History is unavailable");
        return archive.family(id, runId, page);
      },
    },
    plantGenome(dna) {
      pause(); return persist(() => { simulation.plantSavedGenome(dna); showScreen("observe"); });
    },
    toggleRunning, restart: requestRestart,
    onArchiveOpen() { showScreen("observe"); },
  });
  bindCamera(canvas, camera, draw, point => ui.selectAt(Math.floor(point.x), Math.floor(point.y)));
  for (const name of ["observe", "history", "herbarium"]) el(`nav-${name}`).addEventListener("click", () => showScreen(name));
  el("brand-home").addEventListener("click", () => showScreen("observe"));
  el("play-toggle").addEventListener("click", toggleRunning);
  el("step-once").addEventListener("click", stepOnce);
  for (const speed of [1, 4, 16]) el(`speed-${speed}`).addEventListener("click", () => { playback.setSpeed(speed); draw(); });
  el("archive-retry").addEventListener("click", () => persist());
  el("new-world").addEventListener("click", requestRestart);
  el("confirm-new-world").addEventListener("click", restart);
  el("cancel-new-world").addEventListener("click", () => { el("new-world-confirm").hidden = true; el("new-world").focus(); });
  el("review-run").addEventListener("click", () => { el("archive-run").value = archive.runId; showScreen("history"); });
  el("zoom-in").addEventListener("click", () => { camera.zoomAt(1.3); draw(); });
  el("zoom-out").addEventListener("click", () => { camera.zoomAt(1 / 1.3); draw(); });
  el("fit-world").addEventListener("click", () => { camera.fit(); draw(); });
  el("focus-plant").addEventListener("click", () => { if (ui.canFocus()) { camera.focus(viewState.selectedPlant); draw(); } });
  el("labels-mode").addEventListener("change", event => { viewState.labelMode = event.target.value; draw(); });
  el("shadow-mode").addEventListener("change", event => { if (event.target.value !== simulation.state.shadowMode) simulation.toggleShadowMode(); draw(); });
  canvas.addEventListener("keydown", event => {
    const arrows = { ArrowLeft: [50, 0], ArrowRight: [-50, 0], ArrowUp: [0, 50], ArrowDown: [0, -50] };
    if (arrows[event.key]) { event.preventDefault(); camera.pan(...arrows[event.key]); draw(); }
  });
  const bounds = canvas.getBoundingClientRect();
  camera.resize(bounds.width || 800, bounds.height || 500); camera.founder();
  window.addEventListener("resize", draw);
  if (globalThis.ResizeObserver) new ResizeObserver(draw).observe(el("world-stage"));
  draw(); await persist();
  return { simulation, viewState, playback, toggleRunning, stepOnce, restart, showScreen };
}
