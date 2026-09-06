// Dead entries remain until the application acknowledges durable archival.
// Seeds retain parent references for generation calculation and late offspring.
export function createPopulation() {
  const active = [];
  const byId = new Map();

  function register(plant, parents = plant.parents.map(id => byId.get(id))) {
    byId.set(plant.id, plant);
    active.push(plant);
    for (const parent of parents) {
      parent.children.push(plant.id);
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
