export function memoryArchive() {
  const records = new Map();
  let lastRun = 0;
  return {
    records,
    fail: false,
    async createRun() { return ++lastRun; },
    async write(run, plants) {
      if (this.fail) throw new Error("Disk full");
      for (const p of plants) records.set(`${run}:${p.id}`, structuredClone({ ...p, runId: run, cells: [], children: [] }));
    },
    async get(run, id) {
      const p = records.get(`${run}:${id}`);
      if (!p) return null;
      return structuredClone({ ...p, children: [...records.values()]
        .filter(c => c.runId === run && c.parents.includes(id)).map(c => c.id) });
    },
  };
}
