// Active bodies and the lineage registry have different lifetimes. Dead entries
// remain in byId (with cells released by the simulation), including their DNA.
export function createPopulation() {
  const active = [];
  const byId = new Map();

  function register(plant) {
    byId.set(plant.id, plant);
    active.push(plant);
    for (const id of plant.parents) {
      byId.get(id).children.push(plant.id);
    }
  }

  // Run after the plant loop, before germination. Removing during iteration would
  // skip neighbours. In-place compaction preserves order and the array reference.
  function finishPlantPhase() {
    let write = 0;
    for (let read = 0; read < active.length; read++) {
      if (active[read].alive) active[write++] = active[read];
    }
    active.length = write;
  }

  return { active, byId, register, finishPlantPhase };
}
