import test from "node:test";
import assert from "node:assert/strict";
import { createLineageNavigation } from "../src/ui/lineage-navigation.js";

const family = (id, runId, page) => ({ record: { id }, runId, page });

test("family navigation restores page and scroll, keeps an origin, and starts a fresh exploration", async () => {
  let restored;
  const nav = createLineageNavigation(async (...args) => family(...args), (_, target) => { if (target) restored = target; });
  await nav.start(1, 8); nav.tab("lineage");
  await nav.page(2);
  await nav.navigate(9, { scroll: 375, windowScroll: 620 });
  await nav.navigate(12, { scroll: 90, windowScroll: 200 });
  await nav.previous();
  assert.deepEqual(restored, { id: 9, runId: 8, page: 0, scroll: 90, windowScroll: 200 });
  await nav.returnToOrigin();
  assert.deepEqual(restored, { id: 1, runId: 8, page: 2, scroll: 375, windowScroll: 620 });
  assert.equal(nav.state.tab, "lineage"); assert.equal(nav.state.back.length, 0);
  await nav.start(1, 9);
  assert.equal(nav.state.origin.runId, 9); assert.equal(nav.state.tab, "overview");
});

test("failed relatives keep the current card and retry without adding phantom history", async () => {
  let fail = true;
  const nav = createLineageNavigation(async (id, ...rest) => {
    if (id === 2 && fail) throw new Error("Read failed");
    return id === 99 ? null : family(id, ...rest);
  });
  await nav.start(1, 3); await nav.navigate(2);
  assert.equal(nav.state.family.record.id, 1); assert.equal(nav.state.back.length, 0);
  assert.match(nav.state.error, /Read failed/);
  fail = false; await nav.retry();
  assert.equal(nav.state.family.record.id, 2); assert.equal(nav.state.back.length, 1);
  await nav.navigate(99); assert.match(nav.state.error, /no record/);
  assert.equal(nav.state.family.record.id, 2); assert.equal(nav.state.back.length, 1);
});

test("out-of-order reads and reset cannot replace a newer family", async () => {
  const pending = new Map();
  const nav = createLineageNavigation(id => new Promise(resolve => pending.set(id, resolve)));
  const first = nav.start(1, 1);
  const second = nav.start(2, 1); pending.get(2)(family(2, 1, 0)); await second;
  pending.get(1)(family(1, 1, 0)); await first;
  assert.equal(nav.state.family.record.id, 2);
  const third = nav.navigate(3); nav.clear(); pending.get(3)(family(3, 1, 0)); await third;
  assert.equal(nav.state.family, null); assert.equal(nav.state.origin, null);
});

test("history is bounded while origin stays reachable", async () => {
  const nav = createLineageNavigation(async (...args) => family(...args));
  await nav.start(1, 1);
  for (let id = 2; id < 80; id++) await nav.navigate(id);
  assert.equal(nav.state.back.length, 50);
  await nav.returnToOrigin(); assert.equal(nav.state.location.id, 1);
});
