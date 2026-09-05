import { defaultConfig } from "./config.js";
import { createGenetics } from "./genetics.js";
import { createRandom } from "./random.js";

export function leafMultiplier(above) {
  if (above === 0) return 2;
  if (above === 1) return 1.5;
  if (above === 2) return 1;
  return 0;
}

// The model owns its state and never accesses the DOM, storage, or frame scheduling.
// A seed replays the same initial world on reset. Injected random functions continue
// their sequence on reset, as Math.random did in the original implementation.
export function createSimulation({ config: overrides = {}, seed, random: suppliedRandom } = {}) {
  const config = Object.assign(
    Object.defineProperties({}, Object.getOwnPropertyDescriptors(defaultConfig)),
    overrides,
  );
  config.DIR_VECTORS = config.DIR_VECTORS.map(vector => ({ ...vector }));
  let random;
  const genetics = createGenetics(config, () => random());
  const { randomInt, makeRandomDNA, mutateDna, crossover, speciesHash } = genetics;
  const state = { config, shadowMode: "canopy" };

  function reset() {
    random = suppliedRandom ?? (seed === undefined ? Math.random : createRandom(seed));
    Object.assign(state, {
      tickCount: 0, plants: [], seeds: [], nextPlantId: 1,
      plantsById: new Map(), deathCounts: { age: 0, starvation: 0 },
      populationHistory: [], occupancyMap: makeEmptyGrid(null),
      canopyMap: makeEmptyGrid(0),
      world: Array.from({ length: config.WIDTH }, () =>
        Array.from({ length: config.HEIGHT }, (_, y) =>
          y < config.GROUND_LEVEL ? "air" : "soil")),
    });
    state.plants.push(makePlant(Math.floor(config.WIDTH / 2), config.GROUND_LEVEL - 1));
  }

  function toggleShadowMode() {
    state.shadowMode = state.shadowMode === "canopy" ? "column" : "canopy";
  }

  function plantAt(x, y) {
    const cell = state.occupancyMap[x]?.[y];
    return cell ? state.plantsById.get(cell.plantId) : null;
  }

  function step() {
    state.tickCount++;

    rebuildCaches();

    for (const plant of state.plants) {
      if (state.tickCount % config.GROWTH_INTERVAL === 0) {
        growPlant(plant);
        if (!plant.alive) continue;
      }
      if (state.tickCount % config.ENERGY_INTERVAL === 0) {
        collectEnergy(plant);
        applyUpkeep(plant);
      }
    }

    if (state.tickCount % config.SEED_FALL_INTERVAL === 0) {
      for (const seed of state.seeds) {
        updateSeed(seed);
      }
      state.seeds = state.seeds.filter((s) => !s.germinated);
    }

    // Снимок численности популяции для графика
    if (state.tickCount % config.POPULATION_SNAPSHOT_INTERVAL === 0) {
      const alive = state.plants.filter((p) => p.alive);
      const aliveGens = alive.map((p) => p.generation);
      state.populationHistory.push({
        tick: state.tickCount,
        alive: alive.length,
        maxGen: aliveGens.length ? Math.max(...aliveGens) : 0,
      });
      if (state.populationHistory.length > config.HISTORY_MAX_SNAPSHOTS) {
        state.populationHistory.shift();
      }
    }

  }

  function makeEmptyGrid(fill) {
    return Array.from({ length: config.WIDTH }, () =>
      Array(config.HEIGHT).fill(fill),
    );
  }

  function rebuildCaches() {
    // Очистка
    for (let x = 0; x < config.WIDTH; x++) {
      for (let y = 0; y < config.HEIGHT; y++) {
        state.occupancyMap[x][y] = null;
        state.canopyMap[x][y] = 0;
      }
    }
    // Заполнение occupancy
    for (const plant of state.plants) {
      if (!plant.alive) continue;
      for (const cell of plant.cells) {
        state.occupancyMap[cell.x][cell.y] = cell;
      }
    }
    // Заполнение canopy зависит от режима
    if (state.shadowMode === "canopy") {
      // только листья отбрасывают тень
      for (let x = 0; x < config.WIDTH; x++) {
        let count = 0;
        for (let y = 0; y < config.HEIGHT; y++) {
          state.canopyMap[x][y] = count;
          const cell = state.occupancyMap[x][y];
          if (cell && cell.type === "leaf") count++;
        }
      }
    } else {
      // column: любая клетка отбрасывает тень
      for (let x = 0; x < config.WIDTH; x++) {
        let count = 0;
        for (let y = 0; y < config.HEIGHT; y++) {
          state.canopyMap[x][y] = count;
          if (state.occupancyMap[x][y] !== null) count++;
        }
      }
    }
  }

  function isOccupiedByPlant(x, y) {
    return state.occupancyMap[x][y] !== null;
  }

  function countCanopyAbove(x, y) {
    return state.canopyMap[x][y];
  }

  function markLeaf(x, y) {
    if (state.shadowMode !== "canopy") return;
    for (let yy = y + 1; yy < config.HEIGHT; yy++) {
      state.canopyMap[x][yy]++;
    }
  }

  function markCell(x, y) {
    if (state.shadowMode === "canopy") return;
    for (let yy = y + 1; yy < config.HEIGHT; yy++) {
      state.canopyMap[x][yy]++;
    }
  }

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
    for (let dir = 0; dir < config.DIRECTIONS; dir++) {
      const value = gene[dir];
      if (value > 15) continue;
      wantedGrowth = true;
      const newX = sprout.x + config.DIR_VECTORS[dir].dx;
      const newY = sprout.y + config.DIR_VECTORS[dir].dy;
      if (newX < 0 || newX >= config.WIDTH) continue;
      if (newY < 0 || newY >= config.GROUND_LEVEL) continue;
      if (isOccupiedByPlant(newX, newY)) continue;
      if (countCanopyAbove(newX, newY) > config.CANOPY_LIMIT) continue;
      const newCell = {
        x: newX,
        y: newY,
        type: "sprout",
        gene: value,
        accumulator: 0,
        plantId: plant.id,
      };
      plant.cells.push(newCell);
      state.occupancyMap[newX][newY] = newCell;
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
    if (plant.energy >= config.SEED_ENERGY_COST) {
      plant.energy -= config.SEED_ENERGY_COST;
      sprout.accumulator += config.SEED_ENERGY_COST;
      if (sprout.accumulator >= config.SEED_THRESHOLD) {
        sprout.type = "ready";
      }
    }
  }

  function killPlant(plant) {
    if (!plant.alive) return;
    plant.alive = false;
    plant.diedAt = state.tickCount;
    if (!plant.causeOfDeath) plant.causeOfDeath = "age"; // защита, если кто-то вызвал killPlant без checkDeath
    state.deathCounts[plant.causeOfDeath]++;
    const stressed = plant.causeOfDeath === "starvation";
    for (const cell of plant.cells) {
      state.occupancyMap[cell.x][cell.y] = null;
      if (cell.type === "ready") {
        state.seeds.push(makeSeed(cell.x, cell.y, plant.dna, stressed, [plant]));
      }
    }
    plant.cells = []; // освобождаем память, метаданные и ДНК остаются
  }

  function collectEnergy(plant) {
    for (const cell of plant.cells) {
      if (cell.type !== "leaf") continue;
      const above = countCanopyAbove(cell.x, cell.y);
      const level = config.GROUND_LEVEL - cell.y + 5;
      plant.energy += leafMultiplier(above) * level;
    }
  }

  function applyUpkeep(plant) {
    let total = 0;
    for (const cell of plant.cells) {
      switch (cell.type) {
        case "wood":
          total += config.UPKEEP_WOOD;
          break;
        case "leaf":
          total += config.UPKEEP_LEAF;
          break;
        case "sprout":
        case "ready":
          total += config.UPKEEP_SPROUT;
          break;
      }
    }
    plant.energy -= total;
    checkDeath(plant);
  }

  function updateSeed(seed) {
    if (seed.germinated) return; // уже обработано (например, как партнёр по кроссоверу)

    const below = seed.y + 1;
    const onSoil = below >= config.GROUND_LEVEL;
    const onPlant = !onSoil && isOccupiedByPlant(seed.x, below);

    if (!onSoil && !onPlant) {
      seed.y = below;
      return;
    }
    if (!onSoil) return;

    seed.age++;
    if (seed.age >= config.GERMINATION_TIME) {
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
      const partner = state.seeds.find(
        (s) =>
          s !== seed &&
          !s.germinated &&
          s.x === seed.x &&
          s.y === seed.y &&
          s.age >= config.GERMINATION_TIME,
      );

      let plantDna;
      let plantParents;
      if (partner) {
        // Скрещиваем ДНК двух семян + мутируем потомка
        plantDna = mutateDna(crossover(seed.dna, partner.dna));
        // Дедуплицируем по reference: если оба семени с того же родителя — он будет один.
        plantParents = [...new Set([...seed.parents, ...partner.parents])];
        partner.germinated = true;
      } else {
        plantDna = seed.dna;
        plantParents = seed.parents;
      }

      state.plants.push(makePlant(seed.x, seed.y, plantDna, plantParents));
      seed.germinated = true;
    }
  }

  function makePlant(x, y, dna, parents = []) {
    const id = state.nextPlantId++;

    const generation =
      parents.length === 0
        ? 0
        : Math.max(...parents.map((p) => p.generation)) + 1;

    const plant = {
      id,
      parents: parents.map((p) => p.id),
      children: [],
      generation,
      bornAt: state.tickCount,
      diedAt: null,

      cells: [{ x, y, type: "sprout", gene: 0, accumulator: 0, plantId: id }],
      age: 0,
      maxAge: randomInt(config.MIN_AGE, config.MAX_AGE),
      energy: config.STARTING_ENERGY,
      alive: true,
      dna: dna || makeRandomDNA(),
      hue: Math.floor(random() * 360),
      causeOfDeath: null,
    };

    // Кешируем сигнатуру вида — ДНК фиксирована до конца жизни.
    plant.speciesHash = speciesHash(plant.dna);

    // Регистрируем в индексе
    state.plantsById.set(id, plant);

    // Пушим ID нового растения в children каждого родителя (O(1) поиск потомков)
    for (const parent of parents) {
      parent.children.push(id);
    }

    // Сразу же отражаем стартовую клетку в кэше — иначе в текущем тике
    // другие проверки `isOccupied` и тени её не увидят.


    state.occupancyMap[x][y] = plant.cells[0];
    markCell(x, y);
    return plant;
  }

  function makeSeed(x, y, dna, stressed = false, parents = []) {
    const rate = stressed
      ? config.MUTATION_RATE * config.STRESS_MULTIPLIER
      : config.MUTATION_RATE;
    return {
      x,
      y,
      dna: mutateDna(dna, rate),
      age: 0,
      parents,
    };
  }

  function plantSavedGenome(dna) {
    // Сажаем растение с сохранённым геномом в центре мира.
    // Делаем глубокую копию, чтобы все посадки не делили один и тот же массив.

    const dnaCopy = dna.map((row) => row.slice());
    // ищем свободную колонку рядом с центром
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.floor(config.WIDTH / 2) + randomInt(-10, 10);
      if (x < 0 || x >= config.WIDTH) continue;
      if (!isOccupiedByPlant(x, config.GROUND_LEVEL - 1)) {
        state.plants.push(makePlant(x, config.GROUND_LEVEL - 1, dnaCopy));
        return;
      }
    }
  }

  reset();
  return { state, step, reset, plantSavedGenome, plantAt, toggleShadowMode };
}
