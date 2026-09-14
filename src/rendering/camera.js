export function createCamera(config) {
  const camera = { width: 1, height: 1, x: config.WIDTH / 2, y: config.GROUND_LEVEL, zoom: 22, mode: "founder" };
  const minimum = () => Math.min(camera.width / config.WIDTH, camera.height / config.HEIGHT) * 0.9;
  function constrain() {
    camera.zoom = Math.max(minimum(), Math.min(64, camera.zoom));
    camera.x = Math.max(0, Math.min(config.WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(config.HEIGHT, camera.y));
  }
  function resize(width, height) {
    camera.width = Math.max(1, width); camera.height = Math.max(1, height);
    if (camera.mode === "fit") fit(); else constrain();
  }
  function worldAt(x, y) {
    return { x: camera.x + (x - camera.width / 2) / camera.zoom,
      y: camera.y + (y - camera.height / 2) / camera.zoom };
  }
  function screenAt(x, y) {
    return { x: (x - camera.x) * camera.zoom + camera.width / 2,
      y: (y - camera.y) * camera.zoom + camera.height / 2 };
  }
  function zoomAt(factor, x = camera.width / 2, y = camera.height / 2) {
    const point = worldAt(x, y);
    camera.zoom = Math.max(minimum(), Math.min(64, camera.zoom * factor));
    camera.x = point.x - (x - camera.width / 2) / camera.zoom;
    camera.y = point.y - (y - camera.height / 2) / camera.zoom;
    camera.mode = "custom"; constrain();
  }
  function pan(dx, dy) {
    camera.x -= dx / camera.zoom; camera.y -= dy / camera.zoom;
    camera.mode = "custom"; constrain();
  }
  function fit() {
    camera.x = config.WIDTH / 2; camera.y = config.HEIGHT / 2;
    camera.zoom = minimum(); camera.mode = "fit";
  }
  function founder() {
    camera.zoom = Math.min(24, Math.max(12, camera.width / 36));
    camera.x = Math.floor(config.WIDTH / 2) + 0.5;
    camera.y = config.GROUND_LEVEL - camera.height * 0.18 / camera.zoom;
    camera.mode = "founder"; constrain();
  }
  function focus(plant) {
    if (!plant?.alive || !plant.cells.length) return false;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const c of plant.cells) {
      left = Math.min(left, c.x); right = Math.max(right, c.x + 1);
      top = Math.min(top, c.y); bottom = Math.max(bottom, c.y + 1);
    }
    camera.x = (left + right) / 2; camera.y = (top + bottom) / 2;
    camera.zoom = Math.min(32, camera.width / (right - left + 8), camera.height / (bottom - top + 8));
    camera.mode = "focus"; constrain(); return true;
  }
  return Object.assign(camera, { resize, worldAt, screenAt, zoomAt, pan, fit, founder, focus });
}

export function bindCamera(canvas, camera, redraw, select) {
  let gesture;
  const point = event => {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * camera.width / r.width,
      y: (event.clientY - r.top) * camera.height / r.height };
  };
  canvas.addEventListener("wheel", event => {
    event.preventDefault(); const p = point(event);
    camera.zoomAt(Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * 0.003), p.x, p.y); redraw();
  }, { passive: false });
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 || gesture) return;
    const p = point(event); gesture = { id: event.pointerId, start: p, last: p, dragged: false };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const p = point(event);
    if (!gesture.dragged && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) < 5) return;
    gesture.dragged = true;
    camera.pan(p.x - gesture.last.x, p.y - gesture.last.y); gesture.last = p; redraw();
  });
  canvas.addEventListener("pointerup", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dragged = gesture.dragged; gesture = null;
    if (!dragged) { const p = point(event); return select(camera.worldAt(p.x, p.y)); }
  });
  canvas.addEventListener("pointercancel", () => { gesture = null; });
  canvas.addEventListener("lostpointercapture", () => { gesture = null; });
}
