import { createApp } from "../src/app.js";
import { memoryArchive } from "./helpers/archive-store.js";

const output = parent.document.getElementById("result"), el = id => document.getElementById(id);
const check = (ok, message) => { if (!ok) throw new Error(message); };
async function until(predicate) {
  const end = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() > end) throw new Error("UI did not settle");
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
async function edit(key, value) {
  const input = el(`condition-number-${key}`); input.value = String(value);
  input.dispatchEvent(new Event("change"));
  await new Promise(resolve => requestAnimationFrame(resolve));
  await until(() => !input.disabled);
}
try {
  const store = memoryArchive(); const app = await createApp({ openStore: async () => store });
  check(el("play-toggle").textContent === "Start demo" && app.playback.speed === 4 && !app.playback.running, "Demo must start paused at 4x");
  const originalDNA = JSON.stringify(app.simulation.state.plants[0].dna);
  el("show-conditions").click();
  check(!el("conditions-panel").hidden && el("plant-panel").hidden, "Conditions panel did not open");
  const camera = app.viewState.camera, pose = [camera.x, camera.y, camera.zoom].join();
  await edit("LIGHT_MULTIPLIER", 0.6);
  await until(() => app.simulation.getConditions().LIGHT_MULTIPLIER === 0.6 && store.runs.get(1).interventions?.length === 1);
  check(app.simulation.state.tickCount === 0, "Paused editing advanced time");
  const lightSlider = el("condition-LIGHT_MULTIPLIER"); lightSlider.focus(); lightSlider.value = "0.5";
  lightSlider.dispatchEvent(new Event("change"));
  await new Promise(resolve => requestAnimationFrame(resolve));
  await until(() => !lightSlider.disabled && document.activeElement === lightSlider);
  check(app.simulation.getConditions().LIGHT_MULTIPLIER === 0.5, "Focused slider change did not apply");
  await edit("LIGHT_MULTIPLIER", 99);
  check(app.simulation.getConditions().LIGHT_MULTIPLIER === 0.5 && el("conditions-message").textContent.includes("Invalid"), "Invalid input changed the model");
  const plant = app.simulation.state.plants[0], ageLimit = plant.maxAge;
  await edit("STARTING_ENERGY", 500);
  check(plant.energy === 300 && plant.maxAge === ageLimit, "Newborn setting rewrote existing plant values");
  el("conditions-reset").click(); await until(() => app.simulation.getConditions().LIGHT_MULTIPLIER === 1 && !el("conditions-reset").disabled);
  el("play-toggle").click(); await until(() => app.simulation.state.tickCount >= 100);
  await edit("MAINTENANCE_MULTIPLIER", 0.8);
  await until(() => app.simulation.getConditions().MAINTENANCE_MULTIPLIER === 0.8);
  check(app.playback.running, "Editing paused live playback");
  el("play-toggle").click();
  check(el("trend-plants").getAttribute("d").includes("L"), "Population chart did not advance");
  check(el("trend-markers").children.length > 0, "Intervention markers missing");
  check([camera.x, camera.y, camera.zoom].join() === pose, "Conditions moved the camera");
  el("new-world").click(); el("new-world-mode").value = "repeat"; el("confirm-new-world").click();
  await until(() => store.runs.has(2) && app.simulation.state.tickCount === 0 && !el("new-world").disabled);
  check(JSON.stringify(app.simulation.state.plants[0].dna) === originalDNA, "Repeat did not restore the founder");
  check(app.simulation.getConditions().MAINTENANCE_MULTIPLIER === 1 && !app.playback.running, "Repeat did not restore paused starting conditions");
  el("new-world").click(); el("new-world-mode").value = "random"; el("confirm-new-world").click();
  await until(() => store.runs.has(3) && !el("new-world").disabled);
  check(store.runs.get(3).start.kind === "random" && Number.isInteger(store.runs.get(3).start.seed), "Random world lacks an explicit seed");
  el("new-world").click(); el("new-world-mode").value = "demo"; el("confirm-new-world").click();
  await until(() => store.runs.has(4) && !el("new-world").disabled);
  check(el("play-toggle").textContent === "Start demo", "Cannot return to demo");
  check(document.documentElement.scrollWidth <= innerWidth, "Horizontal page overflow");
  check(el("info-panel").scrollWidth <= el("info-panel").clientWidth, "Conditions overflow their panel");
  el("info-panel").scrollTop = 0;
  output.textContent = `PASS: demo/random/repeat, live and paused edits, validation, keyboard focus, stored interventions, chart, and layout (${innerWidth}×${innerHeight}). User history is untouched.`;
} catch (error) { output.textContent = `FAIL: ${error.stack}`; }
