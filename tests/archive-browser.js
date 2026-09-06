import { openArchive } from "../src/persistence/archive.js";

const result = document.getElementById("result");
const key = "tree-life-archive-test-reload";
let store;
function check(value, message) { if (!value) throw new Error(message); }
try {
  const saved = sessionStorage.getItem(key);
  if (saved) {
    const { name, run } = JSON.parse(saved);
    sessionStorage.removeItem(key);
    store = await openArchive(indexedDB, name);
    const parent = await store.get(run, 1);
    check(parent.diedAt === 10, "Death must survive page reload");
    check(parent.children.join() === "2,3", "Late offspring must survive page reload");
    check(parent.dna[0][0] === 1, "DNA must survive page reload");
    store.close();
    indexedDB.deleteDatabase(name);
    result.textContent = "PASS: native IndexedDB writes, late children, run isolation, atomic abort, missing records, close/reopen, and page reload.";
  } else {
    const name = `tree-life-test-${crypto.randomUUID()}`;
    store = await openArchive(indexedDB, name);
    const run = await store.createRun();
    const otherRun = await store.createRun();
    const parent = { id: 1, parents: [], children: [], dna: [[1]], alive: false, diedAt: 10 };
    await store.write(run, [parent]);
    await store.write(run, [{ ...parent, id: 2, parents: [1] }, { ...parent, id: 3, parents: [1] }]);
    await store.write(otherRun, [{ ...parent, dna: [[9]] }]);
    check((await store.get(otherRun, 1)).dna[0][0] === 9, "Runs must isolate colliding IDs");
    check(await store.get(run, 99) === null, "Missing records must return null");
    let rejected = false;
    try { await store.write(run, [{ ...parent, id: 4 }, { ...parent, id: 5, invalid: () => {} }]); }
    catch { rejected = true; }
    check(rejected, "Invalid data must reject the transaction");
    check(await store.get(run, 4) === null, "Failed batch must not partially commit");
    store.close();
    store = await openArchive(indexedDB, name);
    check((await store.get(run, 1)).children.length === 2, "Close/reopen must preserve lineage");
    store.close();
    sessionStorage.setItem(key, JSON.stringify({ name, run }));
    location.reload();
  }
} catch (error) {
  store?.close();
  sessionStorage.removeItem(key);
  result.textContent = `FAIL: ${error.stack}`;
}
