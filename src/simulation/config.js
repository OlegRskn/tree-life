export const defaultConfig = {
  // === WORLD ===
  WIDTH: 240,
  HEIGHT: 90,
  get GROUND_LEVEL() {
    return this.HEIGHT - 5;
  },


  // === TIMING ===
  GROWTH_INTERVAL: 5,
  ENERGY_INTERVAL: 5,
  SEED_FALL_INTERVAL: 3,

  // === ECONOMICS ===
  UPKEEP_WOOD: 1,
  UPKEEP_LEAF: 2,
  UPKEEP_SPROUT: 1,
  STARTING_ENERGY: 300,
  MIN_AGE: 88,
  MAX_AGE: 92,
  GERMINATION_TIME: 30,

  // Seeds: a blocked sprout spends plant energy
  // to accumulate SEED_THRESHOLD, then becomes "ready".
  SEED_ENERGY_COST: 100,
  SEED_THRESHOLD: 500,

  // Growth is blocked when more than CANOPY_LIMIT leaves are above a cell.
  CANOPY_LIMIT: 3,

  // Each of the 64 DNA positions has MUTATION_RATE probability
  // of a point mutation; a separate rare operation swaps genes.
  MUTATION_RATE: 0.02,
  MUT_DRIFT_WEIGHT: 70, // relative weight for drift by +/-1
  MUT_REPLACE_WEIGHT: 25, // relative weight for replacement
  MUT_SWAP_WEIGHT: 5, // scales the separate gene-swap probability
  STRESS_MULTIPLIER: 2, // mutation-rate multiplier for starving parents

  // === DNA ===
  GENE_COUNT: 16,
  DIRECTIONS: 4,
  DNA_MAX_VALUE: 31,
  // 0: left, 1: up, 2: right, 3: down — same order as positions in a gene
  DIR_VECTORS: [
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
  ],

  // === POPULATION METRICS ===
  POPULATION_SNAPSHOT_INTERVAL: 100,
  HISTORY_MAX_SNAPSHOTS: 200,
  SPECIES_BUCKET_SIZE: 4,
};
