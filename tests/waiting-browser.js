import { createApp } from "../src/app.js";
import { memoryArchive } from "./helpers/archive-store.js";
const el = id => document.getElementById(id);
const check = (ok, message) => { if (!ok) throw new Error(message); };
try {
  const app = await createApp({ openStore: async () => memoryArchive(), simulationOptions: { seed: 16, config: { MIN_AGE: 1, MAX_AGE: 1 } } });
  const dna = app.simulation.state.plants[0].dna;
  for (let i = 0; i < 5; i++) await app.stepOnce();
  check(!el("world-notice").hidden, "Extinction should retain its review notice");
  const addSeed = () => app.simulation.state.seeds.push({ x: 120, y: 84, age: 28, dna, parents: [] });
  addSeed(); await app.stepOnce();
  check(el("world-notice").hidden && el("world-state").textContent === "Waiting for seeds to sprout", "Waiting must only show a compact status");
  check(!el("play-toggle").disabled, "Waiting must allow playback");
  for (let i = 0; i < 3; i++) await app.stepOnce();
  check(app.simulation.state.plants.length > 0 && !el("world-state").textContent && el("world-notice").hidden, "Germination should clear the waiting status");
  await app.stepOnce(); addSeed(); await app.stepOnce();
  check(el("world-notice").hidden, "Waiting notice returned");
  parent.document.getElementById("result").textContent = "PASS: compact waiting status, unobstructed seeds, germination clears status, extinction retains review. Disposable history.";
} catch (error) { parent.document.getElementById("result").textContent = `FAIL: ${error.stack}`; }
