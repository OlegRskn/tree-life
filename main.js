const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

// === WORLD ===
const WIDTH = 120;
const HEIGHT = 60;
const GROUND_LEVEL = HEIGHT - 5;
const cellSize = 20;
canvas.width = WIDTH * cellSize;
canvas.height = HEIGHT * cellSize;

// === TIMING ===
const GROWTH_INTERVAL = 10;
const ENERGY_INTERVAL = 10;
const SEED_FALL_INTERVAL = 2;
const CLEANUP_INTERVAL = 1000;

// === ECONOMICS ===
const UPKEEP_WOOD = 1;
const UPKEEP_LEAF = 3;
const UPKEEP_SPROUT = 3;

const STARTING_ENERGY = 300;
const MIN_AGE = 88;
const MAX_AGE = 92;
const GERMINATION_TIME = 30;

// Семена: спраут, который не смог расти, тратит энергию растения,
// чтобы накопить SEED_THRESHOLD. Когда накопил — становится "ready".
const SEED_ENERGY_COST = 50;
const SEED_THRESHOLD = 100;

// Тень: над клеткой больше CANOPY_LIMIT листьев — рост невозможен.
const CANOPY_LIMIT = 3;

// Мутации: с вероятностью MUTATION_RATE на каждую из 64 позиций ДНК
// применяется один из операторов: мягкий сдвиг, полная замена или обмен генов.
const MUTATION_RATE = 0.02;
const MUT_DRIFT_WEIGHT = 70;    // % мутаций — мягкий сдвиг ±1
const MUT_REPLACE_WEIGHT = 25;  // % мутаций — полная замена
const MUT_SWAP_WEIGHT = 5;      // % мутаций — обмен двух генов (структурная)
const STRESS_MULTIPLIER = 2;    // множитель рейта у голодных родителей

// === DNA ===
const GENE_COUNT = 16;
const DIRECTIONS = 4;
const DNA_MAX_VALUE = 31;
// 0: left, 1: up, 2: right, 3: down — same order as positions in a gene
const DIR_VECTORS = [
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
];

// === STATE ===
let tickCount = 0;
let plants = [];
let seeds = [];
let labelMode = "none"; // 'none' | 'gene' | 'energy'
let shadowMode = "canopy"; // 'canopy' | 'column'
let selectedPlant = null;

// === TEMP PARAMS ===

const world = Array.from({ length: WIDTH }, () =>
  Array.from({ length: HEIGHT }, (_, y) => (y < GROUND_LEVEL ? "air" : "soil")),
);

// Кэш-карты, перестраиваются раз за тик. Делают isOccupied и countCanopyAbove
// O(1) вместо O(plants × cells).
let occupancyMap = makeEmptyGrid(null);
let canopyMap = makeEmptyGrid(0);

plants.push(makePlant(Math.floor(WIDTH / 2), GROUND_LEVEL - 1));

// === DRAWING ===
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld();
  drawPlants();
  drawSeeds();
  drawHud();
  drawPlantInfo();
}

function drawWorld() {
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      ctx.fillStyle = worldColor(world[x][y]);
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

function worldColor(t) {
  return t === "air" ? "skyblue" : "saddlebrown";
}

function drawPlants() {
  for (const plant of plants) {
    if (!plant.alive) continue;
    for (const cell of plant.cells) {
      ctx.fillStyle = cellColor(plant, cell);
      ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
      if (plant === selectedPlant) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          cell.x * cellSize,
          cell.y * cellSize,
          cellSize,
          cellSize,
        );
      }
      drawCellLabel(cell);
    }
  }
}
function drawPlantInfo() {
  const empty = document.getElementById("info-empty");
  const content = document.getElementById("info-content");

  if (!selectedPlant || !selectedPlant.alive) {
    empty.style.display = "block";
    content.style.display = "none";
    return;
  }

  const p = selectedPlant;
  empty.style.display = "none";
  content.style.display = "block";

  document.getElementById("info-energy").textContent = p.energy;
  document.getElementById("info-age").textContent = `${p.age} / ${p.maxAge}`;
  document.getElementById("info-cells").textContent = p.cells.length;

  // Гены, которые используются клетками растения
  const usedGenes = new Set(p.cells.map((c) => c.gene));

  const dnaEl = document.getElementById("info-dna");
  dnaEl.innerHTML = "";

  // Заголовок направлений
  const header = document.createElement("div");
  header.className = "dna-gene";
  const emptyIdx = document.createElement("span");
  emptyIdx.className = "gene-index";
  header.appendChild(emptyIdx);
  const headerVals = document.createElement("div");
  headerVals.className = "gene-values";
  ["←", "↑", "→", "↓"].forEach((arrow) => {
    const span = document.createElement("span");
    span.className = "gene-val gene-dir-label";
    span.textContent = arrow;
    headerVals.appendChild(span);
  });
  header.appendChild(headerVals);
  dnaEl.appendChild(header);

  p.dna.forEach((gene, i) => {
    const isUsed = usedGenes.has(i);
    const row = document.createElement("div");
    row.className = "dna-gene" + (isUsed ? " used" : "");

    const idx = document.createElement("span");
    idx.className = "gene-index";
    idx.textContent = i;
    row.appendChild(idx);

    const vals = document.createElement("div");
    vals.className = "gene-values";
    gene.forEach((v) => {
      const span = document.createElement("span");
      span.className = "gene-val" + (v <= 15 ? " active" : "");
      span.textContent = v;
      vals.appendChild(span);
    });
    row.appendChild(vals);
    dnaEl.appendChild(row);
  });
}
function drawCellLabel(cell) {
  if (labelMode === "none") return;

  let text;
  if (labelMode === "gene") {
    text = String(cell.gene);
  } else {
    // energy - только для листьев

    if (cell.type !== "leaf") return;
    const above = countCanopyAbove(cell.x, cell.y);
    const multiplier = above === 0 ? 3 : above === 1 ? 2 : above === 2 ? 1 : 0;
    const level = GROUND_LEVEL - cell.y + 5;
    text = String(multiplier * level);
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "14px monospace";
  ctx.fillStyle = "white";
  ctx.fillText(
    text,
    cell.x * cellSize + cellSize / 2,
    cell.y * cellSize + cellSize / 2,
  );
  ctx.restore();
}

function cellColor(plant, cell) {
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
  ctx.fillStyle = "yellow";
  for (const seed of seeds) {
    ctx.fillRect(seed.x * cellSize, seed.y * cellSize, cellSize, cellSize);
  }
}

function drawHud() {
  const aliveCount = plants.filter((p) => p.alive).length;
  ctx.fillStyle = "white";
  ctx.font = "14px monospace";
  ctx.fillText(`tick: ${tickCount}`, 10, 20);
  ctx.fillText(`plants alive: ${aliveCount}`, 10, 40);
  ctx.fillText(`seeds: ${seeds.length}`, 10, 60);
  ctx.fillText(`plants array: ${plants.length}`, 10, 80);
  ctx.fillText(`labels: ${labelMode}`, 10, 100);
  ctx.fillText(`shadow: ${shadowMode}`, 10, 120);
}

// === MAIN LOOP ===
let running = true;
let scheduled = false;

function scheduleTick() {
  if (scheduled || !running) return;
  scheduled = true;
  requestAnimationFrame(tick);
}

function tick() {
  scheduled = false;
  if (!running) return;
  tickCount++;

  rebuildCaches();

  for (const plant of plants) {
    if (!plant.alive) continue;
    if (tickCount % GROWTH_INTERVAL === 0) {
      growPlant(plant);
    }
    if (tickCount % ENERGY_INTERVAL === 0) {
      collectEnergy(plant);
      applyUpkeep(plant);
    }
  }

  if (tickCount % SEED_FALL_INTERVAL === 0) {
    for (const seed of seeds) {
      updateSeed(seed);
    }
    seeds = seeds.filter((s) => !s.germinated);
  }

  if (tickCount % CLEANUP_INTERVAL === 0) {
    plants = plants.filter((p) => p.alive);
  }

  draw();
  scheduleTick();
}

// === CACHES ===
function makeEmptyGrid(fill) {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(fill));
}

function rebuildCaches() {
  // Очистка
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      occupancyMap[x][y] = null;
      canopyMap[x][y] = 0;
    }
  }
  // Заполнение occupancy
  for (const plant of plants) {
    if (!plant.alive) continue;
    for (const cell of plant.cells) {
      occupancyMap[cell.x][cell.y] = cell;
    }
  }
  // Заполнение canopy зависит от режима
  if (shadowMode === "canopy") {
    // только листья отбрасывают тень
    for (let x = 0; x < WIDTH; x++) {
      let count = 0;
      for (let y = 0; y < HEIGHT; y++) {
        canopyMap[x][y] = count;
        const cell = occupancyMap[x][y];
        if (cell && cell.type === "leaf") count++;
      }
    }
  } else {
    // column: любая клетка отбрасывает тень
    for (let x = 0; x < WIDTH; x++) {
      let count = 0;
      for (let y = 0; y < HEIGHT; y++) {
        canopyMap[x][y] = count;
        if (occupancyMap[x][y] !== null) count++;
      }
    }
  }
}

function isOccupiedByPlant(x, y) {
  return occupancyMap[x][y] !== null;
}

function countCanopyAbove(x, y) {
  return canopyMap[x][y];
}

// Инкрементальное обновление canopyMap при появлении нового листа —
// без этого внутри одного тика растения "просачиваются" в свежезатенённые клетки.
function markLeaf(x, y) {
  if (shadowMode !== "canopy") return;
  for (let yy = y + 1; yy < HEIGHT; yy++) {
    canopyMap[x][yy]++;
  }
}

function markCell(x, y) {
  if (shadowMode === "canopy") return;
  for (let yy = y + 1; yy < HEIGHT; yy++) {
    canopyMap[x][yy]++;
  }
}

// === PLANT GROWTH ===
function growPlant(plant) {
  plant.age++;
  if (checkDeath(plant)) return;
  // snapshot sprouts BEFORE the loop so newly added cells don't grow this tick
  const sprouts = plant.cells.filter((c) => c.type === "sprout");
  for (const sprout of sprouts) {
    growSprout(plant, sprout);
  }
}

function checkDeath(plant) {
  if (!plant.alive) return true;
  if (plant.age >= plant.maxAge) {
    plant.causeOfDeath = "age";
    killPlant(plant);
    return true;
  }
  if (plant.energy < 0) {
    plant.causeOfDeath = "starvation";
    killPlant(plant);
    return true;
  }
  return false;
}

function growSprout(plant, sprout) {
  const gene = plant.dna[sprout.gene];
  let grewAny = false;
  let wantedGrowth = false;
  for (let dir = 0; dir < DIRECTIONS; dir++) {
    const value = gene[dir];
    if (value > 15) continue;
    wantedGrowth = true;
    const newX = sprout.x + DIR_VECTORS[dir].dx;
    const newY = sprout.y + DIR_VECTORS[dir].dy;
    if (newX < 0 || newX >= WIDTH) continue;
    if (newY < 0 || newY >= GROUND_LEVEL) continue;
    if (isOccupiedByPlant(newX, newY)) continue;
    if (countCanopyAbove(newX, newY) > CANOPY_LIMIT) continue;
    const newCell = {
      x: newX,
      y: newY,
      type: "sprout",
      gene: value,
      accumulator: 0,
    };
    plant.cells.push(newCell);
    occupancyMap[newX][newY] = newCell;
    markCell(newX, newY); // в column-режиме новая клетка сразу отбрасывает тень
    grewAny = true;
  }
  if (grewAny) {
    sprout.type = "wood";
    return;
  }
  if (!wantedGrowth) {
    sprout.type = "leaf";
    markLeaf(sprout.x, sprout.y);
    return;
  }
  // спраут хотел расти, но не смог — копит на семя
  if (plant.energy >= SEED_ENERGY_COST) {
    plant.energy -= SEED_ENERGY_COST;
    sprout.accumulator += SEED_ENERGY_COST;
    if (sprout.accumulator >= SEED_THRESHOLD) {
      sprout.type = "ready";
    }
  }
}

function killPlant(plant) {
  if (!plant.alive) return;
  plant.alive = false;
  const stressed = plant.causeOfDeath === "starvation";
  for (const cell of plant.cells) {
    occupancyMap[cell.x][cell.y] = null;
    if (cell.type !== "ready") continue;
    seeds.push(makeSeed(cell.x, cell.y, plant.dna, stressed));
  }
}

// === ENERGY ===
function collectEnergy(plant) {
  for (const cell of plant.cells) {
    if (cell.type !== "leaf") continue;
    const above = countCanopyAbove(cell.x, cell.y);
    let multiplier;
    if (above === 0) multiplier = 3;
    else if (above === 1) multiplier = 2;
    else if (above === 2) multiplier = 1;
    else multiplier = 0;
    const level = GROUND_LEVEL - cell.y + 5;
    plant.energy += multiplier * level;
  }
}

function applyUpkeep(plant) {
  let total = 0;
  for (const cell of plant.cells) {
    switch (cell.type) {
      case "wood":
        total += UPKEEP_WOOD;
        break;
      case "leaf":
        total += UPKEEP_LEAF;
        break;
      case "sprout":
      case "ready":
        total += UPKEEP_SPROUT;
        break;
    }
  }
  plant.energy -= total;
  checkDeath(plant);
}

// === SEEDS ===
function updateSeed(seed) {
  if (seed.germinated) return; // уже обработано (например, как партнёр по кроссоверу)

  const below = seed.y + 1;
  const onSoil = below >= GROUND_LEVEL;
  const onPlant = !onSoil && isOccupiedByPlant(seed.x, below);

  if (!onSoil && !onPlant) {
    seed.y = below;
    return;
  }
  if (!onSoil) return;

  seed.age++;
  if (seed.age >= GERMINATION_TIME) {
    if (isOccupiedByPlant(seed.x, seed.y)) {
      seed.germinated = true;
      return;
    }
    if (countCanopyAbove(seed.x, seed.y) > 0) {
      // под кроной нет солнца — семя не прорастает
      seed.germinated = true;
      return;
    }

    // Кроссовер: ищем другое созревшее семя на той же клетке
    const partner = seeds.find(
      (s) => s !== seed && !s.germinated &&
             s.x === seed.x && s.y === seed.y &&
             s.age >= GERMINATION_TIME,
    );

    let plantDna;
    if (partner) {
      // Скрещиваем ДНК двух семян + мутируем потомка
      plantDna = mutateDna(crossover(seed.dna, partner.dna));
      partner.germinated = true;
    } else {
      plantDna = seed.dna;
    }

    plants.push(makePlant(seed.x, seed.y, plantDna));
    seed.germinated = true;
  }
}

// === HELPERS ===
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRandomDNA() {
  return Array.from({ length: GENE_COUNT }, () =>
    Array.from({ length: DIRECTIONS }, () => randomInt(0, DNA_MAX_VALUE)),
  );
}

function makePlant(x, y, dna) {
  const plant = {
    cells: [{ x, y, type: "sprout", gene: 0, accumulator: 0 }],
    age: 0,
    maxAge: randomInt(MIN_AGE, MAX_AGE),
    energy: STARTING_ENERGY,
    alive: true,
    dna: dna || makeRandomDNA(),
    hue: Math.floor(Math.random() * 360),
    causeOfDeath: null,
  };
  // Сразу же отражаем стартовую клетку в кэше — иначе в текущем тике
  // другие проверки `isOccupied` и тени её не увидят.
  occupancyMap[x][y] = plant.cells[0];
  markCell(x, y);
  return plant;
}

// Возвращает мутированное значение: drift ±1 (70%) или полная замена (25%).
// Вес swap не учитывается здесь — он применяется отдельно на уровне гена.
function pickPointMutation(value) {
  const total = MUT_DRIFT_WEIGHT + MUT_REPLACE_WEIGHT;
  const roll = Math.random() * total;
  if (roll < MUT_DRIFT_WEIGHT) {
    const delta = Math.random() < 0.5 ? -1 : 1;
    return Math.max(0, Math.min(DNA_MAX_VALUE, value + delta));
  }
  return randomInt(0, DNA_MAX_VALUE);
}

// Применяет точечные мутации (drift/replace) и структурную (gene swap).
// rate — вероятность мутации на позицию (по умолчанию MUTATION_RATE).
function mutateDna(dna, rate = MUTATION_RATE) {
  const copy = dna.map((row) => row.slice());

  // 1. Точечные мутации по каждой позиции
  for (let g = 0; g < GENE_COUNT; g++) {
    for (let d = 0; d < DIRECTIONS; d++) {
      if (Math.random() < rate) {
        copy[g][d] = pickPointMutation(copy[g][d]);
      }
    }
  }

  // 2. Структурная мутация: gene swap.
  // Срабатывает с вероятностью MUT_SWAP_WEIGHT% на семя (независимо от per-position rate).
  // При стрессе масштабируется вместе с rate — поэтому делим на MUTATION_RATE и умножаем на rate.
  const swapProb = (MUT_SWAP_WEIGHT / 100) * (rate / MUTATION_RATE);
  if (Math.random() < swapProb) {
    const a = randomInt(0, GENE_COUNT - 1);
    const b = randomInt(0, GENE_COUNT - 1);
    if (a !== b) {
      [copy[a], copy[b]] = [copy[b], copy[a]];
    }
  }

  return copy;
}

// Рекомбинация: для каждого гена берём целиком от одного из двух родителей.
function crossover(dnaA, dnaB) {
  const result = [];
  for (let g = 0; g < GENE_COUNT; g++) {
    result.push((Math.random() < 0.5 ? dnaA[g] : dnaB[g]).slice());
  }
  return result;
}

// stressed=true — удваивает рейт мутации (родитель умер от голода).
function makeSeed(x, y, dna, stressed = false) {
  const rate = stressed ? MUTATION_RATE * STRESS_MULTIPLIER : MUTATION_RATE;
  return {
    x,
    y,
    dna: mutateDna(dna, rate),
    age: 0,
  };
}

// === START ===
document.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    running = !running;
    if (running) scheduleTick();
  }
  if (
    event.key === "l" ||
    event.key === "L" ||
    event.key === "д" ||
    event.key === "Д"
  ) {
    if (labelMode === "none") labelMode = "gene";
    else if (labelMode === "gene") labelMode = "energy";
    else labelMode = "none";
    draw();
  }
  if (
    event.key === "s" ||
    event.key === "S" ||
    event.key === "ы" ||
    event.key === "Ы"
  ) {
    shadowMode = shadowMode === "canopy" ? "column" : "canopy";
    draw();
  }

  if (
    event.key === "r" ||
    event.key === "R" ||
    event.key === "к" ||
    event.key === "К"
  ) {
    tickCount = 0;
    plants = [];
    seeds = [];
    selectedPlant = null;
    occupancyMap = makeEmptyGrid(null);
    canopyMap = makeEmptyGrid(0);
    plants.push(makePlant(Math.floor(WIDTH / 2), GROUND_LEVEL - 1));

    running = true;
    draw();
    scheduleTick();
  }
});

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const x = Math.floor((event.clientX - rect.left) / scaleX / cellSize);
  const y = Math.floor((event.clientY - rect.top) / scaleY / cellSize);
  const cell = occupancyMap[x]?.[y];
  selectedPlant = cell
    ? plants.find((p) => p.alive && p.cells.includes(cell))
    : null;
  draw();
});

// === RESPONSIVE SCALING ===
function fitToViewport() {
  const app = document.getElementById("app");
  // сбрасываем трансформацию чтобы измерить реальный размер
  app.style.transform = "translate(-50%, -50%)";
  const appW = app.offsetWidth;
  const appH = app.offsetHeight;
  const scale = Math.min(
    window.innerWidth / appW,
    window.innerHeight / appH,
    1,
  );
  app.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener("resize", fitToViewport);
fitToViewport();

scheduleTick();
