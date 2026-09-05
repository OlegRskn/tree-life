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

  // Семена: спраут, который не смог расти, тратит энергию растения,
  // чтобы накопить SEED_THRESHOLD. Когда накопил — становится "ready".
  SEED_ENERGY_COST: 100,
  SEED_THRESHOLD: 500,

  // Тень: над клеткой больше CANOPY_LIMIT листьев — рост невозможен.
  CANOPY_LIMIT: 3,

  // Мутации: с вероятностью MUTATION_RATE на каждую из 64 позиций ДНК
  // применяется один из операторов: мягкий сдвиг, полная замена или обмен генов.
  MUTATION_RATE: 0.02,
  MUT_DRIFT_WEIGHT: 70, // % мутаций — мягкий сдвиг ±1
  MUT_REPLACE_WEIGHT: 25, // % мутаций — полная замена
  MUT_SWAP_WEIGHT: 5, // % мутаций — обмен двух генов (структурная)
  STRESS_MULTIPLIER: 2, // множитель рейта у голодных родителей

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
