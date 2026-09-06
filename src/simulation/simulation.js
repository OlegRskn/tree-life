import { defaultConfig } from "./config.js";
import { createGenetics } from "./genetics.js";
import { createRandom } from "./random.js";
import { createPopulation } from "./population.js";
import { createSpatial } from "./spatial.js";

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
  let population;
  let spatial;
  let archiveChanges;

  function reset() {
    archiveChanges = new Set();
    random = suppliedRandom ?? (seed === undefined ? Math.random : createRandom(seed));
    population = createPopulation();
    spatial = createSpatial(config);
    Object.assign(state, {
      tickCount: 0, plants: population.active, seeds: [], nextPlantId: 1,
      plantsById: population.byId, deathCounts: { age: 0, starvation: 0 },
      populationHistory: [], occupancyMap: spatial.occupancyMap,
      canopyMap: spatial.canopyMap,
      world: Array.from({ length: config.WIDTH }, () =>
        Array.from({ length: config.HEIGHT }, (_, y) =>
          y < config.GROUND_LEVEL ? "air" : "soil")),
    });
    makePlant(Math.floor(config.WIDTH / 2), config.GROUND_LEVEL - 1);
  }

  function toggleShadowMode() {
    state.shadowMode = state.shadowMode === "canopy" ? "column" : "canopy";
    spatial.beginStep(state.plants, state.shadowMode);
  }

  function plantAt(x, y) {
    const cell = spatial.cellAt(x, y);
    return cell ? state.plantsById.get(cell.plantId) : null;
  }

  function step() {
    state.tickCount++;

    spatial.beginStep(state.plants, state.shadowMode);

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

    population.finishPlantPhase();

    if (state.tickCount % config.SEED_FALL_INTERVAL === 0) {
      for (const seed of state.seeds) {
        updateSeed(seed);
      }
      state.seeds = state.seeds.filter((s) => !s.germinated);
    }

    // Population snapshot for the graph
    if (state.tickCount % config.POPULATION_SNAPSHOT_INTERVAL === 0) {
      const aliveGens = state.plants.map((p) => p.generation);
      state.populationHistory.push({
        tick: state.tickCount,
        alive: state.plants.length,
        maxGen: aliveGens.length ? Math.max(...aliveGens) : 0,
      });
      if (state.populationHistory.length > config.HISTORY_MAX_SNAPSHOTS) {
        state.populationHistory.shift();
      }
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
      if (spatial.isOccupied(newX, newY)) continue;
      if (spatial.countCanopyAbove(newX, newY) > config.CANOPY_LIMIT) continue;
      const newCell = {
        x: newX,
        y: newY,
        type: "sprout",
        gene: value,
        accumulator: 0,
        plantId: plant.id,
      };
      plant.cells.push(newCell);
      spatial.occupy(newCell, state.shadowMode);
      grewAny = true;
    }
    if (grewAny) {
      sprout.type = "wood";
      return;
    }
    if (!wantedGrowth) {
      sprout.type = "leaf";
      spatial.markLeaf(sprout, state.shadowMode);
      return;
    }
    // A blocked sprout accumulates energy for a seed.
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
    if (!plant.causeOfDeath) plant.causeOfDeath = "age"; // Fallback for calls that bypass checkDeath.
    state.deathCounts[plant.causeOfDeath]++;
    const stressed = plant.causeOfDeath === "starvation";
    for (const cell of plant.cells) {
      spatial.release(cell, state.shadowMode);
      if (cell.type === "ready") {
        state.seeds.push(makeSeed(cell.x, cell.y, plant.dna, stressed, [plant]));
      }
    }
    plant.cells = []; // Release cells while retaining metadata and DNA.
    archiveChanges.add(plant);
  }

  function collectEnergy(plant) {
    for (const cell of plant.cells) {
      if (cell.type !== "leaf") continue;
      const above = spatial.countCanopyAbove(cell.x, cell.y);
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
    if (seed.germinated) return; // Already processed, for example as a crossover partner.

    const below = seed.y + 1;
    const onSoil = below >= config.GROUND_LEVEL;
    const onPlant = !onSoil && spatial.isOccupied(seed.x, below);

    if (!onSoil && !onPlant) {
      seed.y = below;
      return;
    }
    if (!onSoil) return;

    seed.age++;
    if (seed.age >= config.GERMINATION_TIME) {
      if (spatial.isOccupied(seed.x, seed.y)) {
        seed.germinated = true;
        return;
      }
      if (spatial.countCanopyAbove(seed.x, seed.y) > 0) {
        // Seeds cannot germinate under a canopy.
        seed.germinated = true;
        return;
      }

      // Crossover: find another mature seed at the same cell.
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
        // Combine both seeds' DNA and mutate the offspring.
        plantDna = mutateDna(crossover(seed.dna, partner.dna));
        // Deduplicate by reference when both seeds share a parent.
        plantParents = [...new Set([...seed.parents, ...partner.parents])];
        partner.germinated = true;
      } else {
        plantDna = seed.dna;
        plantParents = seed.parents;
      }

      makePlant(seed.x, seed.y, plantDna, plantParents);
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

    // Cache the genome group signature; DNA is fixed for life.
    plant.speciesHash = speciesHash(plant.dna);

    population.register(plant, parents);
    archiveChanges.add(plant);
    spatial.occupy(plant.cells[0], state.shadowMode);
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
    // Plant a saved genome near the center of the world.
    // Deep-copy DNA so separate plantings do not share arrays.

    const dnaCopy = dna.map((row) => row.slice());
    // Find an empty column near the center.
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.floor(config.WIDTH / 2) + randomInt(-10, 10);
      if (x < 0 || x >= config.WIDTH) continue;
      if (!spatial.isOccupied(x, config.GROUND_LEVEL - 1)) {
        makePlant(x, config.GROUND_LEVEL - 1, dnaCopy);
        return;
      }
    }
  }

  reset();
  // The caller acknowledges only after durable storage succeeds. Standalone
  // simulations retain their full registry for diagnostics and replay tests.
  function pendingArchiveChanges() { return [...archiveChanges]; }
  function acknowledgeArchiveChanges(plants) {
    for (const plant of plants) {
      archiveChanges.delete(plant);
      if (!plant.alive && state.plantsById.get(plant.id) === plant) {
        state.plantsById.delete(plant.id);
      }
    }
  }
  return { state, step, reset, plantSavedGenome, plantAt, toggleShadowMode,
    pendingArchiveChanges, acknowledgeArchiveChanges };
}
