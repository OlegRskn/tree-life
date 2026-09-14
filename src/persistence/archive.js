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
        createRun(metadata = {}) {
          return transaction(["runs"], "readwrite", (tx, result) => {
            const req = tx.objectStore("runs").add({ ...metadata, createdAt: new Date().toISOString() });
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
        recordInterventions(runId, events) {
          return transaction(["runs"], "readwrite", tx => {
            const runs = tx.objectStore("runs");
            const request = runs.get(runId);
            request.onsuccess = () => {
              const run = request.result;
              if (!run) { tx.abort(); return; }
              const recorded = run.interventions ?? [];
              const ids = new Set(recorded.map(event => event.id));
              run.interventions = [...recorded, ...events.filter(event => !ids.has(event.id))];
              runs.put(run);
            };
          });
        },
        getRun(runId) {
          return transaction(["runs"], "readonly", (tx, result) => {
            const request = tx.objectStore("runs").get(runId);
            request.onsuccess = () => result(request.result ?? null);
          });
        },
        family(runId, id, page = 0, limit = 6) {
          if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || page * limit > 0xffffffff) {
            return Promise.reject(new RangeError("Invalid family page"));
          }
          return transaction(["plants"], "readonly", (tx, result) => {
            const plants = tx.objectStore("plants");
            const request = plants.get([runId, id]);
            request.onsuccess = () => {
              const record = request.result;
              if (!record) { result(null); return; }
              const family = { record, parents: [], children: [], total: 0, page, limit };
              result(family);
              for (const parentId of record.parents.slice(0, 2)) {
                const parent = plants.get([runId, parentId]);
                parent.onsuccess = () => family.parents.push(parent.result ?? { id: parentId, missing: true });
              }
              const index = plants.index("parents");
              const key = `${runId}:${id}`;
              const count = index.count(key);
              count.onsuccess = () => { family.total = count.result; };
              const cursor = index.openCursor(key);
              let skip = page * limit;
              cursor.onsuccess = () => {
                const item = cursor.result;
                if (!item) return;
                if (skip) { const offset = skip; skip = 0; item.advance(offset); return; }
                family.children.push(item.value);
                if (family.children.length < limit) item.continue();
              };
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
    async start(metadata) { runId = await store.createRun(metadata); },
    recordInterventions(events) { return store.recordInterventions(runId, events); },
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
    async family(id, sourceRun = runId, page = 0) {
      const family = await store.family(sourceRun, id, page);
      if (!family) return null;
      const current = record => sourceRun === runId
        ? simulation.state.plantsById.get(record.id) ?? record : record;
      return { ...family, runId: sourceRun, record: current(family.record),
        parents: family.parents.map(current), children: family.children.map(current) };
    },
  };
}
