// IndexedDB stores birth/death records, not resumable world snapshots.
export function openArchive(indexedDB = globalThis.indexedDB, name = "tree-life-history") {
  return new Promise((resolve, reject) => {
    if (!indexedDB) return reject(new Error("IndexedDB is unavailable"));
    const request = indexedDB.open(name, 1);
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error("Close other Tree Life tabs and retry")); };
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("runs", { keyPath: "id", autoIncrement: true });
      const plants = db.createObjectStore("plants", { keyPath: ["runId", "id"] });
      plants.createIndex("parents", "parentKeys", { multiEntry: true });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      function transaction(stores, mode, work) {
        return new Promise((done, fail) => {
          const tx = db.transaction(stores, mode);
          let value;
          tx.oncomplete = () => done(value);
          tx.onabort = () => fail(tx.error ?? new Error("Archive transaction aborted"));
          tx.onerror = () => {}; // Abort is the authoritative failure signal.
          try { work(tx, result => { value = result; }); }
          catch (error) { tx.abort(); fail(error); }
        });
      }
      resolve({
        close: () => db.close(),
        createRun() {
          return transaction(["runs"], "readwrite", (tx, result) => {
            const req = tx.objectStore("runs").add({ createdAt: new Date().toISOString() });
            req.onsuccess = () => result(req.result);
          });
        },
        write(runId, plants) {
          return transaction(["plants"], "readwrite", tx => {
            const store = tx.objectStore("plants");
            for (const plant of plants) store.put({ ...plant, runId,
              cells: [], children: [], parentKeys: plant.parents.map(id => `${runId}:${id}`) });
          });
        },
        get(runId, id) {
          return transaction(["plants"], "readonly", (tx, result) => {
            const store = tx.objectStore("plants");
            const req = store.get([runId, id]);
            req.onsuccess = () => {
              if (!req.result) { result(null); return; }
              const plant = req.result;
              const children = store.index("parents").getAllKeys(`${runId}:${id}`);
              children.onsuccess = () => result({ ...plant, children: children.result.map(key => key[1]) });
            };
          });
        },
      });
    };
  });
}

// Serial application steps provide backpressure: there is at most one pending
// batch. Failed writes leave the model records intact so a retry is lossless.
export function createArchiveSession(store, simulation) {
  let runId;
  return {
    get runId() { return runId; },
    async start() { runId = await store.createRun(); },
    async flush() {
      const changes = simulation.pendingArchiveChanges();
      if (!changes.length) return false;
      await store.write(runId, changes);
      simulation.acknowledgeArchiveChanges(changes);
      return true;
    },
    async get(id, sourceRun = runId) {
      const live = sourceRun === runId && simulation.state.plantsById.get(id);
      const archived = await store.get(sourceRun, id);
      if (live) return { ...live, runId: sourceRun,
        children: archived?.children ?? live.children };
      return archived;
    },
  };
}
