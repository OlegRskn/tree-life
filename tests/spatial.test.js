import test from "node:test";
import assert from "node:assert/strict";
import { createSpatial } from "../src/simulation/spatial.js";

const config = { WIDTH: 3, HEIGHT: 6 };

test("new cells occupy space immediately; only leaves cast canopy shadows", () => {
  const spatial = createSpatial(config);
  const cell = { x: 1, y: 2, type: "sprout" };
  spatial.occupy(cell, "canopy");
  assert.equal(spatial.cellAt(1, 2), cell);
  assert.equal(spatial.isOccupied(1, 2), true);
  assert.equal(spatial.countCanopyAbove(1, 3), 0);
  cell.type = "leaf";
  spatial.markLeaf(cell, "canopy");
  assert.deepEqual(spatial.canopyMap[1], [0, 0, 0, 1, 1, 1]);
  assert.equal(spatial.countCanopyAbove(0, 3), 0);
});

test("column shadows count each cell once, including a sprout becoming a leaf", () => {
  const spatial = createSpatial(config);
  const cell = { x: 0, y: 0, type: "sprout" };
  spatial.occupy(cell, "column");
  cell.type = "leaf";
  spatial.markLeaf(cell, "column");
  spatial.occupy({ x: 0, y: 4, type: "wood" }, "column");
  assert.deepEqual(spatial.canopyMap[0], [0, 1, 1, 1, 1, 2]);
});

test("removal frees the cell and its shadow immediately", () => {
  for (const mode of ["canopy", "column"]) {
    const spatial = createSpatial(config);
    const leaf = { x: 1, y: 0, type: "leaf" };
    spatial.beginStep([{ cells: [leaf] }], mode);
    spatial.release(leaf, mode);
    assert.equal(spatial.cellAt(1, 0), null);
    assert.equal(spatial.countCanopyAbove(1, 1), 0);
    spatial.beginStep([], mode);
    assert.deepEqual(spatial.canopyMap[1], [0, 0, 0, 0, 0, 0]);
  }
});

test("removing one source preserves other shadows and repeated removal is harmless", () => {
  for (const mode of ["canopy", "column"]) {
    const spatial = createSpatial(config);
    const upper = { x: 1, y: 0, type: "leaf" };
    const lower = { x: 1, y: 2, type: "leaf" };
    spatial.beginStep([{ cells: [upper, lower] }], mode);
    spatial.release(upper, mode);
    spatial.release(upper, mode);
    assert.deepEqual(spatial.canopyMap[1], [0, 0, 0, 1, 1, 1]);
    assert.equal(spatial.cellAt(1, 2), lower);
  }
});

test("removing wood in canopy mode does not remove a leaf's shadow", () => {
  const spatial = createSpatial(config);
  const wood = { x: 1, y: 0, type: "wood" };
  const leaf = { x: 1, y: 2, type: "leaf" };
  spatial.beginStep([{ cells: [wood, leaf] }], "canopy");
  spatial.release(wood, "canopy");
  assert.deepEqual(spatial.canopyMap[1], [0, 0, 0, 1, 1, 1]);
});

test("beginStep rebuilds maps for a new mode and keeps their identities", () => {
  const spatial = createSpatial(config);
  const occupancy = spatial.occupancyMap;
  const canopy = spatial.canopyMap;
  const cells = [{ x: 1, y: 0, type: "wood" }, { x: 1, y: 2, type: "leaf" }];
  spatial.beginStep([{ cells }], "column");
  assert.equal(spatial.countCanopyAbove(1, 5), 2);
  spatial.beginStep([{ cells }], "canopy");
  assert.equal(spatial.countCanopyAbove(1, 5), 1);
  assert.equal(spatial.occupancyMap, occupancy);
  assert.equal(spatial.canopyMap, canopy);
  assert.equal(spatial.cellAt(1, 2), cells[1]);
  spatial.beginStep([], "canopy");
  assert.equal(spatial.isOccupied(1, 2), false);
});

test("edge cells, out-of-bounds selection and independent worlds", () => {
  const a = createSpatial(config);
  const b = createSpatial(config);
  const cell = { x: 2, y: 5, type: "sprout" };
  a.occupy(cell, "column");
  assert.equal(a.cellAt(2, 5), cell);
  assert.equal(a.cellAt(-1, 0), null);
  assert.equal(a.cellAt(3, 0), null);
  assert.equal(a.cellAt(0, 6), null);
  assert.equal(b.cellAt(2, 5), null);
  assert.deepEqual(a.canopyMap[2], [0, 0, 0, 0, 0, 0]);
});
