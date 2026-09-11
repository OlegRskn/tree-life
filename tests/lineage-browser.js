import { createApp } from "../src/app.js";
import { memoryArchive } from "./helpers/archive-store.js";

const output = parent.document.getElementById("result");
const el = id => document.getElementById(id);
const check = (ok, message) => { if (!ok) throw new Error(message); };
async function until(predicate) {
  const deadline = performance.now() + 3000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("UI did not settle");
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}
try {
  const store = memoryArchive();
  const run = await store.createRun();
  const template = { parents: [], children: [], dna: Array.from({ length: 16 }, () => [31, 31, 31, 31]), cells: [],
    alive: false, diedAt: 300, age: 60, maxAge: 60, energy: 90, causeOfDeath: "oldAge", bornAt: 0, generation: 0 };
  await store.write(run, [{ ...template, id: 1 }, { ...template, id: 2 },
    { ...template, id: 10, parents: [1, 2], generation: 1 },
    ...Array.from({ length: 14 }, (_, i) => ({ ...template, id: i + 11, parents: [10], generation: 2, bornAt: 30 + i, alive: i === 2 })),
    { ...template, id: 50, parents: [17], generation: 3 }]);
  const app = await createApp({ openStore: async () => store, simulationOptions: { seed: 16 } });
  const camera = app.viewState.camera;
  const pose = [camera.x, camera.y, camera.zoom].join();
  el("nav-history").click(); el("archive-run").value = run; el("archive-plant").value = 10; el("archive-open").click();
  await until(() => el("info-id").textContent === "#10");
  el("inspector-tab-lineage").click();
  check(el("family-parents").children.length === 2, "Crossover parents missing");
  check(el("family-children").children.length === 6, "Page is not bounded");
  check(el("family-children").textContent.includes("Unknown"), "Historical birth-only status missing");
  el("family-next").click(); await until(() => el("family-page").textContent === "7–12 of 14");
  el("info-panel").scrollTop = 300;
  const scroll = el("info-panel").scrollTop;
  if (innerWidth <= 760) window.scrollTo(0, el("info-panel").offsetTop + 120);
  const pageScroll = window.scrollY;
  el("family-children").children[0].click(); await until(() => el("info-id").textContent === "#17");
  if (innerWidth <= 760) check(el("info-panel").getBoundingClientRect().top <= 1, "Mobile relative navigation jumped out of the inspector");
  el("family-children").children[0].click(); await until(() => el("info-id").textContent === "#50");
  el("family-back").click(); await until(() => el("info-id").textContent === "#17");
  el("family-origin").click(); await until(() => el("info-id").textContent === "#10");
  check(el("family-page").textContent === "7–12 of 14", "Origin page not restored");
  check(el("info-panel").scrollTop === scroll, "Inspector scroll not restored");
  check(window.scrollY === pageScroll, "Page scroll not restored");
  check(!app.playback.running && app.simulation.state.tickCount === 0, "Navigation changed playback");
  check([camera.x, camera.y, camera.zoom].join() === pose, "Navigation changed camera");
  check(el("focus-plant").disabled, "Historical plant offers focus");
  el("inspector-tab-lineage").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  check(!el("inspector-dna").hidden, "Keyboard tab navigation failed");
  el("inspector-tab-lineage").click(); el("family-prev").click();
  await until(() => el("family-page").textContent === "1–6 of 14");
  el("info-panel").scrollTop = 0;
  check(document.documentElement.scrollWidth <= innerWidth, "Horizontal page overflow");
  output.textContent = `PASS: family navigation, two parents, bounded pages, historical status, Back/origin scroll, tabs, and unchanged camera/playback (${innerWidth}px). Synthetic fixture; user history is untouched.`;
} catch (error) { output.textContent = `FAIL: ${error.stack}`; }
