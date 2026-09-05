# Tree Life

An experimental evolution sandbox: plants grow from genomes, collect light
energy, and produce seeds with mutations.

## Running the project

Requires Node.js 22 or newer. There are no external dependencies or build step.

```sh
npm start
```

Open http://127.0.0.1:8080. The server listens only on the local interface.
Set the `PORT` environment variable to use another port. Any static HTTP server
rooted at the project directory also works. ES modules may not load via `file://`.

Controls: Space pauses, R creates a new world, L changes labels, and S changes
shadow rules. The corresponding keys on a Russian keyboard layout also work.
Click a plant to inspect it; links in its card navigate to parents and children.
Genomes are saved in localStorage for the current browser origin.

## Tests

```sh
npm test
```

Tests use the built-in `node:test` runner and cover:

- 30 reference states from the original prototype: 3 seeds, 2 shadow modes,
  and ticks 1, 100, 500, 1500, and 5000;
- repeatable resets, independent instances/settings, and planting saved genomes;
- removing dead plants from the active array, preserving age at death,
  lineage, and survivor order when multiple plants die;
- occupancy/shadow updates, world boundaries, and shadow mode changes;
- immediate shadow removal, photosynthesis/germination after a neighbour dies
  in the same step, and independent map reconstruction in runs up to 5000 ticks;
- compatibility with the genome library format and propagation of storage errors;
- integration of the real `main.js`, model, renderer, and UI with stubbed DOM,
  storage, and frame scheduling: selection, pause, toggles, saving, planting,
  deletion, and restart without duplicating the frame loop.

### GitHub Actions

The workflow in `.github/workflows/tests.yml` runs `npm test` on Ubuntu with
Node.js 22 for every branch push and pull request targeting `main`. Once the
workflow reaches the default branch, manual runs are also available in Actions.
New runs cancel outdated checks for the same event and branch.

There are no external npm dependencies, so package installation and caching
are unnecessary. The official [checkout](https://github.com/actions/checkout)
and [setup-node](https://github.com/actions/setup-node) actions are pinned to
commit SHAs. The workflow has read-only repository permissions and does not deploy.
CI covers automated tests; browser UI verification is performed separately.
The workflow alone does not block failed merges: branch protection is not configured.

### Reference states

The SHA-256 values in `tests/fixtures/legacy-states.json` were captured from the
working copy of `main.js` before the 2026-09-05 refactor. They include plants,
genomes, seeds and parents, counters, population history, and spatial maps.
These tests preserve simulation rules; they do not validate biological realism.
Intentional rule changes require reassessing the expectations.

After separating the archive, comparisons reconstruct the original plant order
from the ID registry. A test-only adapter reproduces the old erroneous increase
in dead plants' ages to retain the original hashes. The actual model now stops
age at death; a separate regression test verifies this.

Fixing delayed shadows intentionally changed 4 of the 30 checkpoints: seed 16,
both modes, ticks 1500 and 5000. New values are stored separately in
`tests/fixtures/immediate-shadow-states.json`; the original file is unchanged.
The other 26 checkpoints still use the original values. Additional validation
uses scenarios with known energy/germination outcomes and independent map
reconstruction from plant bodies.

Stubbed-DOM integration tests do not verify browser layout. In a browser, also
check startup, Space/R/L/S, plant selection, lineage navigation, genome saving/
planting/deletion, and resizing.

## Architecture

| Component | Responsibility |
|---|---|
| `main.js` | Connects components and schedules frames |
| `src/simulation/simulation.js` | Owns state and advances the model |
| `src/simulation/population.js` | Active population and lineage registry |
| `src/simulation/spatial.js` | Cell occupancy and shadow updates |
| `src/simulation/genetics.js` | DNA generation, mutation, and crossover |
| `src/simulation/random.js` | Independent random generator with a numeric seed |
| `src/simulation/config.js` | Default world rules |
| `src/rendering/renderer.js` | Reads the model and draws on Canvas |
| `src/rendering/config.js` | Display settings |
| `src/ui/ui.js` | Plant inspector, keyboard, selection, and genome library |
| `src/persistence/genomes.js` | Reads/writes genomes through supplied storage |

The model never accesses the DOM, Canvas, localStorage, or requestAnimationFrame.
The renderer reads state; the UI invokes model operations. Camera, labels, and
selection belong to view state. Shadow mode belongs to the model because it
affects growth and photosynthesis. There are no circular imports.

`consts.js` remains as a compatibility export for older experiments. The app
uses settings from `src/`; edit the relevant config file to change defaults.

### Running without a browser

```js
import { createSimulation } from "./src/simulation/simulation.js";

const simulation = createSimulation({ seed: 16 });
for (let i = 0; i < 5000; i++) simulation.step();
console.log(simulation.state.plants.length); // Living plants only
simulation.reset(); // Repeat the initial state for this seed
```

A seed is an integer from 0 to 4294967295. Without one, the model uses Math.random,
so normal browser launches remain random. For special experiments, supply a
`random` function; it takes precedence over `seed` and continues its sequence
across resets.

`createSimulation({ config: { WIDTH: 120, HEIGHT: 60 }, seed: 16 })` creates a
world with its own settings; ground level is derived from height. Set world
dimensions at creation rather than changing them in a running world.

API: `step()`, `reset()`, `plantSavedGenome(dna)`, `plantAt(x, y)`,
`toggleShadowMode()`, and `state`. State is available for reading and diagnostics;
normal UI code should not mutate plants or maps directly. `reset()` preserves
the `state` object reference but replaces its collections. The UI clears the
old selection when resetting.

### Population and spatial maps

Between steps, `state.plants` contains only living plants. After processing plants,
the array is compacted in place while preserving order; seeds then germinate.
This prevents neighbours from being skipped when multiple plants die in one step.
`state.plantsById` contains every plant: living plants and archived dead records
with empty `cells`. References held by selection and seed parents remain valid.
Age and energy stop changing after death; the children list may still grow.

Model steps, metrics, and normal rendering traverse the active population rather
than the entire history. Selected lineage views still traverse related records.
The metadata/DNA archive has no memory bound yet; retention is a separate task.

`spatial.beginStep()` reconstructs maps at the start of each step. New cells occupy
space immediately, and new shadow sources immediately affect cells below them.
Death frees occupancy and removes shadows immediately. Subsequent plants and seeds
in the same step use updated light. Switching modes immediately reconstructs maps,
even while paused, without changing time or energy. Processing remains sequential:
already-processed plants are not recomputed retroactively. Cell removal accounts
for type and mode, preserves other shadows, and is safe to repeat for the same cell.

### Deferred work

Processing order and growth/energy/seed rules are preserved apart from the documented
shadow fix. The inspector DOM is still rebuilt during rendering. The app advances
one step per frame even though the model can run independently. Full-world saves,
a seed input field, balance changes, and new mechanics are outside these architecture
iterations. Plans and decisions are recorded in `PROJECT-DIRECTION.md`.
