import { leafMultiplier } from "../simulation/simulation.js";

export function createRenderer(canvas, simulation, viewState) {
  const ctx = canvas.getContext("2d");
  const state = simulation.state;
  const config = state.config;
  canvas.width = config.WIDTH * viewState.cellSize;
  canvas.height = config.HEIGHT * viewState.cellSize;

  function draw() {
    if (viewState.camera) {
      const camera = viewState.camera;
      const rect = canvas.getBoundingClientRect();
      camera.resize(rect.width || 800, rect.height || 500);
      const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
      const width = Math.round(camera.width * ratio), height = Math.round(camera.height * ratio);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = ratio * camera.zoom / viewState.cellSize;
      ctx.setTransform(scale, 0, 0, scale,
        ratio * (camera.width / 2 - camera.x * camera.zoom),
        ratio * (camera.height / 2 - camera.y * camera.zoom));
      drawWorld(); drawPlants(); drawLineageHighlights(); drawSeeds();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWorld();
    drawPlants();
    drawLineageHighlights();
    drawSeeds();
    drawPopulationGraph();
    drawHud();
  }

  function drawLineageHighlights() {
    if (!viewState.selectedPlant) return;
    if (viewState.lineageHighlights) {
      for (const plant of viewState.lineageHighlights) {
        if (plant.alive) drawPlantOutline(plant, "rgba(100, 220, 100, 0.7)", 2);
      }
      return;
    }

    for (const p of collectAncestors(viewState.selectedPlant)) {
      if (p.alive) drawPlantOutline(p, "rgba(100, 150, 255, 0.7)", 2);
    }
    for (const p of collectDescendants(viewState.selectedPlant)) {
      if (p.alive) drawPlantOutline(p, "rgba(100, 220, 100, 0.7)", 2);
    }
  }

  function collectAncestors(plant) {
    const result = [];
    const queue = [...plant.parents];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const p = state.plantsById.get(id);
      if (!p) continue;
      result.push(p);
      queue.push(...p.parents);
    }
    return result;
  }

  function collectDescendants(plant) {
    const result = [];
    const queue = [...plant.children];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const p = state.plantsById.get(id);
      if (!p) continue;
      result.push(p);
      queue.push(...(p.children || []));
    }
    return result;
  }

  function drawPlantOutline(plant, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (const cell of plant.cells) {
      ctx.strokeRect(
        cell.x * viewState.cellSize,
        cell.y * viewState.cellSize,
        viewState.cellSize,
        viewState.cellSize,
      );
    }
  }

  function drawWorld() {
    if (viewState.camera) {
      const size = viewState.cellSize;
      ctx.fillStyle = "#101e25";
      ctx.fillRect(0, 0, config.WIDTH * size, config.GROUND_LEVEL * size);
      ctx.fillStyle = "#443b30";
      ctx.fillRect(0, config.GROUND_LEVEL * size, config.WIDTH * size, (config.HEIGHT - config.GROUND_LEVEL) * size);
      ctx.strokeStyle = "#716348"; ctx.lineWidth = size / viewState.camera.zoom;
      ctx.beginPath(); ctx.moveTo(0, config.GROUND_LEVEL * size);
      ctx.lineTo(config.WIDTH * size, config.GROUND_LEVEL * size); ctx.stroke();
      return;
    }
    for (let x = 0; x < config.WIDTH; x++) {
      for (let y = 0; y < config.HEIGHT; y++) {
        ctx.fillStyle = worldColor(state.world[x][y]);
        ctx.fillRect(
          x * viewState.cellSize,
          y * viewState.cellSize,
          viewState.cellSize,
          viewState.cellSize,
        );
      }
    }
  }

  function worldColor(t) {
    return t === "air" ? "skyblue" : "saddlebrown";
  }

  function drawPlants() {
    for (const plant of state.plants) {
      for (const cell of plant.cells) {
        ctx.fillStyle = cellColor(plant, cell);
        ctx.fillRect(
          cell.x * viewState.cellSize,
          cell.y * viewState.cellSize,
          viewState.cellSize,
          viewState.cellSize,
        );
        if (plant === viewState.selectedPlant) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = viewState.camera ? 2 * viewState.cellSize / viewState.camera.zoom : 1;
          ctx.strokeRect(
            cell.x * viewState.cellSize,
            cell.y * viewState.cellSize,
            viewState.cellSize,
            viewState.cellSize,
          );
        }
        drawCellLabel(cell);
      }
    }
  }

  function drawCellLabel(cell) {
    if (viewState.labelMode === "none") return;
    if (viewState.camera && viewState.camera.zoom < 14) return;

    let text;
    if (viewState.labelMode === "gene") {
      text = String(cell.gene);
    } else {
      // Energy labels apply only to leaves.

      if (cell.type !== "leaf") return;
      const above = state.canopyMap[cell.x][cell.y];
      const level = config.GROUND_LEVEL - cell.y + 5;
      text = String(leafMultiplier(above) * level);
    }
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "14px monospace";
    ctx.fillStyle = "white";
    ctx.fillText(
      text,
      cell.x * viewState.cellSize + viewState.cellSize / 2,
      cell.y * viewState.cellSize + viewState.cellSize / 2,
    );
    ctx.restore();
  }

  function cellColor(plant, cell) {
    if (viewState.camera) {
      return { sprout: "#e8dfc7", ready: "#d6ad63", wood: "#786248",
        leaf: `hsl(${85 + plant.hue % 45}, 25%, ${43 + plant.hue % 12}%)` }[cell.type] ?? "#a9b4b0";
    }
    switch (cell.type) {
      case "sprout":
        return "white";
      case "ready":
        return "gold";
      case "leaf":
        return `hsl(${plant.hue}, 70%, 40%)`;
      case "wood":
        return `hsl(${plant.hue}, 30%, 25%)`;
      default:
        return "gray";
    }
  }

  function drawSeeds() {
    ctx.fillStyle = viewState.camera ? "#d6ad63" : "yellow";
    for (const seed of state.seeds) {
      ctx.fillRect(
        seed.x * viewState.cellSize,
        seed.y * viewState.cellSize,
        viewState.cellSize,
        viewState.cellSize,
      );
    }
  }

  function drawHud() {
    let aliveCount = 0;
    let genSum = 0;
    let maxGen = 0;
    const speciesCounts = new Map();

    for (const p of state.plants) {
      aliveCount++;
      genSum += p.generation;
      if (p.generation > maxGen) maxGen = p.generation;
      speciesCounts.set(
        p.speciesHash,
        (speciesCounts.get(p.speciesHash) || 0) + 1,
      );
    }
    const avgGen = aliveCount ? (genSum / aliveCount).toFixed(1) : 0;

    let topSpecies = 0;
    for (const c of speciesCounts.values()) if (c > topSpecies) topSpecies = c;

    ctx.fillStyle = "white";
    ctx.font = "14px monospace";
    let y = 20;
    const line = (text) => {
      ctx.fillText(text, 10, y);
      y += 20;
    };

    line(`tick: ${state.tickCount}`);
    line(`plants: ${aliveCount}`);
    line(`seeds: ${state.seeds.length}`);
    line(`gen max: ${maxGen}`);
    line(`gen avg: ${avgGen}`);
    line(`total ever: ${state.nextPlantId - 1}`);
    line(`died old: ${state.deathCounts.age}`);
    line(`died hungry: ${state.deathCounts.starvation}`);
    line(`species: ${speciesCounts.size}`);
    line(`top species: ${topSpecies}`);
    line(`labels: ${viewState.labelMode}`);
    line(`shadow: ${state.shadowMode}`);
  }

  function drawPopulationGraph() {
    if (state.populationHistory.length < 2) return;
    const w = 200;
    const h = 60;
    const x0 = canvas.width - w - 10;
    const y0 = 10;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x0, y0, w, h);

    const maxAlive = Math.max(...state.populationHistory.map((p) => p.alive), 1);
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    state.populationHistory.forEach((snap, i) => {
      const px = x0 + (i / (state.populationHistory.length - 1)) * w;
      const py = y0 + h - (snap.alive / maxAlive) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px monospace";
    ctx.fillText(
      `pop ${state.populationHistory[state.populationHistory.length - 1].alive}`,
      x0 + 4,
      y0 + 12,
    );
  }

  return { draw };
}
