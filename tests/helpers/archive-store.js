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
    async family(run, id, page = 0, limit = 6) {
      const record = records.get(`${run}:${id}`);
      if (!record) return null;
      const children = [...records.values()].filter(p => p.runId === run && p.parents.includes(id)).sort((a, b) => a.id - b.id);
      return structuredClone({ record, parents: record.parents.slice(0, 2).map(id => records.get(`${run}:${id}`) ?? { id, missing: true }),
        children: children.slice(page * limit, (page + 1) * limit), total: children.length, page, limit });
    },
  };
}
