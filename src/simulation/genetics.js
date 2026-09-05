export function createGenetics(config, random) {
  function randomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function makeRandomDNA() {
    return Array.from({ length: config.GENE_COUNT }, () =>
      Array.from({ length: config.DIRECTIONS }, () =>
        randomInt(0, config.DNA_MAX_VALUE),
      ),
    );
  }

  function pickPointMutation(value) {
    const total = config.MUT_DRIFT_WEIGHT + config.MUT_REPLACE_WEIGHT;
    const roll = random() * total;
    if (roll < config.MUT_DRIFT_WEIGHT) {
      const delta = random() < 0.5 ? -1 : 1;
      return Math.max(0, Math.min(config.DNA_MAX_VALUE, value + delta));
    }
    return randomInt(0, config.DNA_MAX_VALUE);
  }

  function mutateDna(dna, rate = config.MUTATION_RATE) {
    const copy = dna.map((row) => row.slice());

    // 1. Точечные мутации по каждой позиции
    for (let g = 0; g < config.GENE_COUNT; g++) {
      for (let d = 0; d < config.DIRECTIONS; d++) {
        if (random() < rate) {
          copy[g][d] = pickPointMutation(copy[g][d]);
        }
      }
    }

    // 2. Структурная мутация: gene swap (редко, не per-position).
    // Вероятность = rate * MUT_SWAP_WEIGHT / 100.
    // При стрессе rate удвоен, swap тоже учащается вместе с ним.
    if (random() < (rate * config.MUT_SWAP_WEIGHT) / 100) {
      const a = randomInt(0, config.GENE_COUNT - 1);
      const b = randomInt(0, config.GENE_COUNT - 1);
      if (a !== b) {
        [copy[a], copy[b]] = [copy[b], copy[a]];
      }
    }

    return copy;
  }

  function crossover(dnaA, dnaB) {
    const result = [];
    for (let g = 0; g < config.GENE_COUNT; g++) {
      result.push((random() < 0.5 ? dnaA[g] : dnaB[g]).slice());
    }
    return result;
  }

  function speciesHash(dna) {
    return dna
      .flat()
      .map((v) => Math.floor(v / config.SPECIES_BUCKET_SIZE))
      .join(",");
  }

  return { randomInt, makeRandomDNA, mutateDna, crossover, speciesHash };
}
