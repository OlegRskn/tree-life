// Spatial updates are visible to subsequent operations in the same step:
// - beginStep rebuilds occupancy and shadows from the current live population;
// - new cells/leaves affect occupancy/shadows immediately;
// - removal frees occupancy and subtracts that cell's shadow immediately;
// - the simulation rebuilds maps immediately when switching shadow modes.
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

  function changeShadowBelow(x, y, delta) {
    for (let below = y + 1; below < config.HEIGHT; below++) canopyMap[x][below] += delta;
  }

  function occupy(cell, shadowMode) {
    occupancyMap[cell.x][cell.y] = cell;
    if (shadowMode !== "canopy" || cell.type === "leaf") changeShadowBelow(cell.x, cell.y, 1);
  }

  function markLeaf(cell, shadowMode) {
    if (shadowMode === "canopy") changeShadowBelow(cell.x, cell.y, 1);
  }

  function release(cell, shadowMode) {
    if (occupancyMap[cell.x][cell.y] !== cell) return;
    occupancyMap[cell.x][cell.y] = null;
    if (shadowMode !== "canopy" || cell.type === "leaf") changeShadowBelow(cell.x, cell.y, -1);
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
