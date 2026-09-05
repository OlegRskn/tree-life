// Compatibility export for existing experiments. New modules use separate configs.
import { defaultConfig } from "./src/simulation/config.js";
import { defaultViewConfig } from "./src/rendering/config.js";
export const consts = Object.assign(
  Object.defineProperties({}, Object.getOwnPropertyDescriptors(defaultConfig)),
  defaultViewConfig,
);
