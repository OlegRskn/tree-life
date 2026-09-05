// Spatial timing preserves the existing simulation rules:
// - beginStep rebuilds occupancy and shadows from the current live population;
// - new cells/leaves affect occupancy/shadows immediately;
// - removal frees occupancy immediately, but shadows expire at next beginStep;
// - a mode switch takes full effect at next beginStep.
// Removing that shadow delay is a separate change to evolution outcomes.
export function createSpatial(config) {
  const makeGrid = fill => Array.from({ length: config.WIDTH }, () =>
    Array(config.HEIGHT).fill(fill));
  const occupancyMap = makeGrid(null);
  const canopyMap = makeGrid(0);

  function beginStep(plants, shadowMode) {
    for (let x = 0; x < config.WIDTH; x++) {
      occupancyMap[x].fill(null);
      canopyMap[x].fill(0);
    }
    for (const plant of plants) {
      for (const cell of plant.cells) occupancyMap[cell.x][cell.y] = cell;
    }
    for (let x = 0; x < config.WIDTH; x++) {
      let above = 0;
      for (let y = 0; y < config.HEIGHT; y++) {
        canopyMap[x][y] = above;
        const cell = occupancyMap[x][y];
        if (cell && (shadowMode !== "canopy" || cell.type === "leaf")) above++;
      }
    }
  }

  function incrementShadowBelow(x, y) {
    for (let below = y + 1; below < config.HEIGHT; below++) canopyMap[x][below]++;
  }

  function occupy(cell, shadowMode) {
    occupancyMap[cell.x][cell.y] = cell;
    if (shadowMode !== "canopy") incrementShadowBelow(cell.x, cell.y);
  }

  function markLeaf(cell, shadowMode) {
    if (shadowMode === "canopy") incrementShadowBelow(cell.x, cell.y);
  }

  function release(cell) {
    occupancyMap[cell.x][cell.y] = null;
  }

  function cellAt(x, y) {
    return occupancyMap[x]?.[y] ?? null;
  }

  function isOccupied(x, y) {
    return cellAt(x, y) !== null;
  }

  function countCanopyAbove(x, y) {
    return canopyMap[x][y];
  }

  return { occupancyMap, canopyMap, beginStep, occupy, markLeaf, release,
    cellAt, isOccupied, countCanopyAbove };
}
