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

The world opens paused at tick 0, close to its first plant. **Start / Pause**
controls playback; **Step** advances exactly one simulation tick while paused.
Speeds target 30 ticks/s (1x), 120 ticks/s (4x), and 480 ticks/s (16x), with at
most eight steps per frame. Slow rendering or storage reduces actual speed;
the app never skips simulation steps to catch up.

Click a plant for **Overview**. Drag to pan; scroll or use +/- to zoom. **Fit
world** shows the full grid; **Focus in world** frames the selected living plant.
Playback and selection never automatically move the camera. **Space** toggles
playback, **R** opens new-world confirmation, **L** changes labels, and **S**
changes shadow rules. Russian-layout equivalents also work. Shortcuts do not
interfere with form fields or focused buttons. Arrow keys pan a focused Canvas.

**History** and **Herbarium** pause the world. Returning to **Observe** keeps it
paused. Save genomes through the inspector's inline form; Herbarium can plant
them into the current run without starting playback. Genomes use localStorage
for the current browser origin. Parent/child links and raw DNA remain in
expandable inspector sections while richer inspection views are developed.

The inspector keeps its text size independently of the world. On wider screens
it occupies a scrollable sidebar; at widths of 760 CSS pixels or less it sits
below the world and the page scrolls. Canvas fills its camera viewport without
stretching world cells. Very short desktop windows also allow page scrolling.

### Persistent history

History uses IndexedDB in the current browser and origin. The status shows the
current run number. Enter a run number and plant ID in **History**, then click
**Open record**. A blank run field means the current run. Parent/child links
load records on demand; saved genomes remain a separate library.

Each launch or confirmed new-world reset creates a new numbered run. Earlier records remain
available after a page reload. Birth records preserve DNA and parent IDs; death
records add final age, death time, and cause. Children are queried through a
parent index, so offspring born after a parent's death remain discoverable.
If a previous run ended while a plant was alive, its record is labelled as a
birth snapshot with an unknown final state. This archive cannot resume a world
and does not preserve cell shapes or every intermediate energy/age value.

The app waits for a changed batch to commit before advancing another step.
On write failure it pauses, retains uncommitted records, and offers **Retry**.
A successful retry resumes if playback was running. Closing the page during
an unfinished write can lose that pending batch. Browser storage is finite;
clearing site data removes history. Use the same origin (including port) to
access an existing archive. Run management, export/import, and world snapshots
are deferred to later iterations.

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
- integration of the real `src/app.js`, model, renderer, and UI with stubbed DOM,
  storage, and frame scheduling: paused startup, stepping, navigation, toggles,
  saving, confirmed reset, storage recovery, and Overview after death;
- camera coordinate conversion, zoom anchoring, bounded fit/focus/pan, pointer
  cancellation, and drag-versus-selection behavior;
- playback at 60/120 Hz, speed changes, bounded catch-up, and pause/resume;
- archive eviction, failed-write retry, run isolation, late offspring, and
  unchanged worlds after 5000 ticks;
- asynchronous lineage selection, stale-read cancellation, and read errors.

For native IndexedDB checks, run `npm start` and open
http://127.0.0.1:8080/tests/archive-browser.html. The page must report **PASS**
after its automatic reload. It tests atomic aborts, late children, run isolation,
missing records, close/reopen, and reload persistence in a disposable test database.
These browser checks are separate from the Node suite and must also be run when
changing the IndexedDB adapter.

Open http://127.0.0.1:8080/tests/layout-browser.html for layout checks at five
viewport sizes, including narrow and short screens. Each size must report PASS:
readable base text, Canvas viewport sizing, no horizontal overflow, and
accessible long cards through scrolling. Node integration tests also verify
selection at different Canvas sizes and offsets. Browser checks are run separately
from CI, which runs the Node suite.

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
| `main.js` | Starts the browser application |
| `src/app.js` | Connects components, serializes archive writes and schedules frames |
| `src/simulation/simulation.js` | Owns state and advances the model |
| `src/simulation/population.js` | Active population and lineage registry |
| `src/simulation/spatial.js` | Cell occupancy and shadow updates |
| `src/simulation/genetics.js` | DNA generation, mutation, and crossover |
| `src/simulation/random.js` | Independent random generator with a numeric seed |
| `src/simulation/config.js` | Default world rules |
| `src/rendering/renderer.js` | Reads the model and draws on Canvas |
| `src/rendering/camera.js` | World/screen coordinates, zoom, pan, fit/focus, and pointer gestures |
| `src/rendering/config.js` | Display settings |
| `src/ui/ui.js` | Plant inspector, keyboard, selection, and genome library |
| `src/ui/playback.js` | Wall-time tick budget, playback speed, and bounded catch-up |
| `src/persistence/genomes.js` | Reads/writes genomes through supplied storage |
| `src/persistence/archive.js` | IndexedDB records, indexed lineage queries and archive acknowledgements |

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
In a standalone model, `state.plantsById` contains every plant, including dead
records with empty `cells`. The browser app removes dead entries only after a
successful archive transaction. References held by selection and seed parents remain valid.
Age and energy stop changing after death; the children list may still grow.

Model steps, metrics, and normal rendering traverse the active population rather
than the entire history. Selected lineage views still traverse related records.
The browser keeps living records, pending changes, seed parent references, and
the selected card in memory. Archived bodies/DNA are loaded on demand without
a growing record cache. Highlight traversal temporarily holds visited IDs and
can still be expensive for a large lineage. Disk history has no retention limit.

The archive boundary uses `pendingArchiveChanges()` and
`acknowledgeArchiveChanges(records)`. Do not advance or reset the model between
reading a batch and acknowledging it; the application serializes these operations.
Only acknowledge successful transactions. Standalone diagnostics can omit this
boundary and keep the full registry for reference-state comparisons.

`spatial.beginStep()` reconstructs maps at the start of each step. New cells occupy
space immediately, and new shadow sources immediately affect cells below them.
Death frees occupancy and removes shadows immediately. Subsequent plants and seeds
in the same step use updated light. Switching modes immediately reconstructs maps,
even while paused, without changing time or energy. Processing remains sequential:
already-processed plants are not recomputed retroactively. Cell removal accounts
for type and mode, preserves other shadows, and is safe to repeat for the same cell.

### Deferred work

Processing order and growth/energy/seed rules are preserved apart from the documented
shadow fix. Inspector relations and DNA retain their DOM until their data changes;
Overview values update during playback. Full-world saves, a seed input field,
balance changes, a browsable run list, the expanded lineage map, and explanatory
DNA inspection remain deferred. Touch supports dragging and the zoom buttons;
pinch zoom is not implemented. Plans and decisions are recorded in
`PROJECT-DIRECTION.md`.
