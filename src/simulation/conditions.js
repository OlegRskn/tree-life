import { defaultConfig } from "./config.js";

export const conditionFields = [
  { key: "LIGHT_MULTIPLIER", label: "Light", min: 0, max: 3, step: 0.1, unit: "×", timing: "Next energy cycle", help: "Scales the energy collected by leaves." },
  { key: "MAINTENANCE_MULTIPLIER", label: "Maintenance", min: 0, max: 3, step: 0.1, unit: "×", timing: "Next energy cycle", help: "Scales the energy cost of all living cells." },
  { key: "MUTATION_RATE", label: "Mutation rate", min: 0, max: 0.2, step: 0.001, scale: 100, unit: "%", timing: "New mutation events", help: "Chance per DNA position. Existing genomes stay unchanged; stress can raise the rate." },
  { key: "CANOPY_LIMIT", label: "Growth under shade", min: 0, max: 10, step: 1, integer: true, unit: "", timing: "Next growth cycle", help: "Maximum shadow sources above a new cell. Seed germination still requires no shade." },
  { key: "STARTING_ENERGY", label: "Starting energy", min: 0, max: 2000, step: 10, integer: true, unit: "", advanced: true, timing: "New plants only", help: "Existing plants keep their current energy." },
  { key: "MIN_AGE", label: "Minimum lifespan", min: 1, max: 300, step: 1, integer: true, unit: "", advanced: true, timing: "New plants only", help: "Growth cycles, not ticks. Each plant receives its limit at birth." },
  { key: "MAX_AGE", label: "Maximum lifespan", min: 1, max: 300, step: 1, integer: true, unit: "", advanced: true, timing: "New plants only", help: "Must be at least the minimum lifespan." },
];
export const readConditions = config => Object.fromEntries(conditionFields.map(({ key }) => [key, config[key]]));
export const defaultConditions = () => readConditions(defaultConfig);
export function validateConditions(config, patch) {
  const next = readConditions(config);
  for (const [key, value] of Object.entries(patch)) {
    const field = conditionFields.find(field => field.key === key);
    if (!field || !Number.isFinite(value) || value < field.min || value > field.max || (field.integer && !Number.isInteger(value))) {
      throw new RangeError(`Invalid value for ${field?.label ?? key}`);
    }
    next[key] = value;
  }
  if (next.MIN_AGE > next.MAX_AGE) throw new RangeError("Minimum lifespan cannot exceed maximum lifespan");
  return next;
}

export function makeStart(kind = "demo", previous, randomSeed = () => {
  const value = new Uint32Array(1); globalThis.crypto.getRandomValues(value); return value[0];
}) {
  if (kind === "repeat") {
    if (!previous) throw new Error("No start to repeat");
    return { ...previous, conditions: { ...previous.conditions } };
  }
  if (!["demo", "random"].includes(kind)) throw new RangeError("Unknown start mode");
  const seed = kind === "demo" ? 16 : randomSeed();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid starting seed");
  return { kind, seed, conditions: defaultConditions(), shadowMode: "canopy" };
}
