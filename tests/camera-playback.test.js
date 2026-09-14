import test from "node:test";
import assert from "node:assert/strict";
import { createCamera, bindCamera } from "../src/rendering/camera.js";
import { createPlayback } from "../src/ui/playback.js";
const config = { WIDTH: 240, HEIGHT: 90, GROUND_LEVEL: 85 };

test("camera transforms round trip and zoom preserves the pointer's world point", () => {
  const c = createCamera(config); c.resize(900, 500); c.founder();
  const point = c.worldAt(310, 190); c.zoomAt(1.4, 310, 190);
  assert.ok(Math.abs(c.worldAt(310, 190).x - point.x) < 1e-10);
  assert.ok(Math.abs(c.worldAt(310, 190).y - point.y) < 1e-10);
  const screen = c.screenAt(point.x, point.y);
  assert.ok(Math.abs(screen.x - 310) < 1e-10);
  assert.ok(Math.abs(screen.y - 190) < 1e-10);
  const center = [c.x, c.y]; c.resize(390, 600); assert.deepEqual([c.x, c.y], center);
});

test("fit contains the world, focus contains the plant, and dead plants do not move the camera", () => {
  const c = createCamera(config); c.resize(900, 500); c.fit();
  assert.ok(c.screenAt(0, 0).x >= 0 && c.screenAt(240, 90).y <= 500);
  assert.equal(c.focus({ alive: true, cells: [{ x: 120, y: 70 }, { x: 128, y: 84 }] }), true);
  assert.ok(c.screenAt(120, 70).x > 0 && c.screenAt(129, 85).y < 500);
  const center = [c.x, c.y, c.zoom];
  assert.equal(c.focus({ alive: false, cells: [] }), false);
  assert.deepEqual([c.x, c.y, c.zoom], center);
  c.pan(1e7, -1e7); assert.equal(c.x, 0); assert.equal(c.y, 90);
  c.zoomAt(1e7); assert.equal(c.zoom, 64);
});

test("pointer drag and cancel do not select, while a tap does", () => {
  const listeners = {}; const selections = [];
  const canvas = { addEventListener(name, fn) { listeners[name] = fn; }, getBoundingClientRect: () => ({ left: 10, top: 30, width: 900, height: 500 }) };
  const c = createCamera(config); c.resize(900, 500); c.founder();
  bindCamera(canvas, c, () => {}, p => selections.push(p));
  const event = (x, y) => ({ button: 0, pointerId: 1, clientX: x, clientY: y });
  listeners.pointerdown(event(100, 200)); listeners.pointermove(event(200, 200)); listeners.pointerup(event(200, 200));
  assert.equal(selections.length, 0);
  listeners.pointerdown(event(100, 200)); listeners.pointercancel(); listeners.pointerup(event(100, 200));
  assert.equal(selections.length, 0);
  listeners.pointerdown(event(100, 200)); listeners.pointerup(event(100, 200));
  assert.equal(selections.length, 1);
});

test("playback produces the same tick budget at 60Hz and 120Hz", () => {
  for (const hz of [60, 120]) {
    const p = createPlayback(); p.play(); p.due(0);
    let ticks = 0; for (let i = 1; i <= hz; i++) ticks += p.due(i * 1000 / hz);
    assert.equal(ticks, 30);
    p.pause(); assert.equal(p.due(2000), 0);
    p.play(); assert.equal(p.due(90000), 0);
  }
});

test("speed and elapsed catch-up are bounded without skipping simulation steps", () => {
  const p = createPlayback(); p.setSpeed(16); p.play(); p.due(0);
  assert.equal(p.due(10000), 8);
  assert.equal(p.due(10000), 0);
  assert.throws(() => p.setSpeed(100), /Unsupported/);
  assert.equal(p.due(NaN), 0);
});
