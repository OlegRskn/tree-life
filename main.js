const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

// === WORLD ===
const WIDTH = 240;
const HEIGHT = 100;
const GROUND_LEVEL = HEIGHT - 5;
const cellSize = 16;
canvas.width = WIDTH * cellSize;
canvas.height = HEIGHT * cellSize;

// === TIMING ===
const GROWTH_INTERVAL = 5;
const ENERGY_INTERVAL = 120;
const SEED_FALL_INTERVAL = 1;
const CLEANUP_INTERVAL = 1000;

// === ECONOMICS ===
const UPKEEP_WOOD = 1;
const UPKEEP_LEAF = 13;
const UPKEEP_SPROUT = 1;
const STARTING_ENERGY = 300;
const MIN_AGE = 88;
const MAX_AGE = 92;
const GERMINATION_TIME = 30;

// Семена: спраут, который не смог расти, тратит энергию растения,
// чтобы накопить SEED_THRESHOLD. Когда накопил — становится "ready".
const SEED_ENERGY_COST = 5;
const SEED_THRESHOLD = 30;

// Тень: над клеткой больше CANOPY_LIMIT листьев — рост невозможен.
const CANOPY_LIMIT = 3;

// Мутации: с вероятностью MUTATION_RATE на каждую из 64 позиций ДНК
// при создании семени значение заменяется на случайное.
const MUTATION_RATE = 0.02;

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
    }
  }
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
  ctx.fillText(`plants: ${aliveCount}`, 10, 40);
  ctx.fillText(`seeds: ${seeds.length}`, 10, 60);
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
  // Заполнение canopy: для каждой колонки сверху вниз накапливаем счётчик листьев
  for (let x = 0; x < WIDTH; x++) {
    let count = 0;
    for (let y = 0; y < HEIGHT; y++) {
      canopyMap[x][y] = count;
      const cell = occupancyMap[x][y];
      if (cell && cell.type === "leaf") count++;
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
  for (let yy = y + 1; yy < HEIGHT; yy++) {
    canopyMap[x][yy]++;
  }
}

// === PLANT GROWTH ===
function growPlant(plant) {
  plant.age++;
  if (plant.age >= plant.maxAge) {
    killPlant(plant);
    return;
  }
  // snapshot sprouts BEFORE the loop so newly added cells don't grow this tick
  const sprouts = plant.cells.filter((c) => c.type === "sprout");
  for (const sprout of sprouts) {
    growSprout(plant, sprout);
  }
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
    const newCell = { x: newX, y: newY, type: "sprout", gene: value, accumulator: 0 };
    plant.cells.push(newCell);
    occupancyMap[newX][newY] = newCell;
    grewAny = true;
  }
  if (grewAny) {
    sprout.type = "wood";
    return;
  }
  if (!wantedGrowth) {
    sprout.type = "leaf";
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
  for (const cell of plant.cells) {
    occupancyMap[cell.x][cell.y] = null;
    if (cell.type !== "ready") continue;
    seeds.push(makeSeed(cell.x, cell.y, plant.dna));
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
  if (plant.energy < 0) {
    killPlant(plant);
  }
}

// === SEEDS ===
function updateSeed(seed) {
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
    plants.push(makePlant(seed.x, seed.y, seed.dna));
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
  return {
    cells: [{ x, y, type: "sprout", gene: 0, accumulator: 0 }],
    age: 0,
    maxAge: randomInt(MIN_AGE, MAX_AGE),
    energy: STARTING_ENERGY,
    alive: true,
    dna: dna || makeRandomDNA(),
    hue: Math.floor(Math.random() * 360),
  };
}

function makeSeed(x, y, dna) {
  return {
    x,
    y,
    dna: dna.map((row) => row.slice()),
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
});

scheduleTick();
