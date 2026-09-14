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

The demo opens paused at tick 0 with seed 16 and 4x speed, close to its first plant. **Start demo / Pause**
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
for the current browser origin. The inspector has **Overview**, **Lineage**, and
**DNA** tabs. Left/right arrows, Home, and End switch focused tabs.

### Exploring a family

Lineage shows the selected plant, up to two parents, and six immediate children
per page, ordered by plant ID. Click a relative to open its Lineage. **Back**
restores the previous record, children page, and scroll; **Return to origin**
restores the starting plant. Selecting a plant in the world or opening a History
record begins a new exploration. Navigation does not move the camera or change
playback. **Focus in world** remains an explicit action for current living plants.

Children pages and the Overview child count remain stable during playback; the
count is labelled **Children at refresh**. **Refresh family** includes newly
recorded children; automatic new-child notifications are planned separately.
Loaded living records update their status without replacing the controls.
Historical birth-only records show **Unknown**, never a claim of current life.
Read failures retain the current card and offer **Retry family**. Missing parents
remain explicit. DNA currently shows the raw matrix, without command explanations.

The inspector keeps its text size independently of the world. On wider screens
it occupies a scrollable sidebar; at widths of 760 CSS pixels or less it sits
below the world and the page scrolls. Canvas fills its camera viewport without
stretching world cells. Very short desktop windows also allow page scrolling.

### Trying the demo and changing conditions

Start the demo, watch the founder grow and produce seeds, then use **Fit world**
to follow the population. With the starting settings and no interventions, seed 16
reaches generation 20 at tick 10,677 and generation 28 by tick 15,000. These are
deterministic model results; playback time depends on the device and storage.

**New world** offers the reproducible demo, a random genome with an explicit seed,
or **Repeat this start**. Repeat restores the current run's original seed,
conditions, and shadow rule. It does not replay later edits or planted genomes.
Every new world starts paused and preserves earlier archive records.

Open **Conditions** beside **Plant** to experiment while running or paused.
Release a slider or finish editing a number to apply it between simulation steps.
Each setting has a reset button; **Restore starting conditions** resets the group.

| Setting | Range | When it takes effect |
|---|---|---|
| Light | 0–3x | Next energy cycle; scales leaf energy collection |
| Maintenance | 0–3x | Next energy cycle; scales living-cell costs |
| Mutation rate | 0–20% | New mutation events; existing DNA stays unchanged, stress can raise the rate |
| Growth under shade | 0–10 sources | Next growth cycle; germination still requires no shade |
| Starting energy | 0–2,000 | New plants only |
| Minimum / maximum age | 1–300 cycles | New plants only; minimum must not exceed maximum |

Energy and growth cycles occur every five simulation ticks. Changing newborn
settings never rewrites an existing plant's energy or assigned lifespan. Invalid
values leave the model unchanged. Editing preserves camera, selection, and
playback; a storage failure pauses advancement until a successful retry.

The population chart shares one count scale for plants and seeds. It retains up
to 200 samples, taken every 100 ticks and at edits or extinction. Markers show
Conditions edits within the visible interval; the sidebar lists the latest six.
Up to 100 recent edits stay in memory, while the run archive stores all applied
Conditions edits with their tick and before/after values, plus the starting
metadata. The existing Display shadow-mode switch is outside this edit log.
Archived settings are not yet browsable in History, and the chart is not a saved
world or evidence of causation. Repeat a start to compare another setting.

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
- repeatable 15,000-tick demo survival, condition validation/application timing,
  newborn-only changes, bounded trends, and intervention write-failure recovery.

For native IndexedDB checks, run `npm start` and open
http://127.0.0.1:8080/tests/archive-browser.html. The page must report **PASS**
after its automatic reload. It tests atomic aborts, late children, run isolation,
missing records, close/reopen, and reload persistence in a disposable test database.
It also checks bounded family pages with 500 children, two-parent crossover,
missing parents, page order, and late children without loading all child IDs.
Start metadata and intervention deduplication also survive its automatic reload.
These browser checks are separate from the Node suite and must also be run when
changing the IndexedDB adapter.

Open http://127.0.0.1:8080/tests/layout-browser.html for layout checks at five
viewport sizes, including narrow and short screens. Each size must report PASS:
readable base text, Canvas viewport sizing, no horizontal overflow, and
accessible long cards through scrolling. Node integration tests also verify
selection at different Canvas sizes and offsets. Browser checks are run separately
from CI, which runs the Node suite.

Open http://127.0.0.1:8080/tests/lineage-browser.html for the complete family
navigation scenario using synthetic in-memory records and the real app. Add
`?width=390` to check mobile navigation and page-scroll restoration. Both must
report PASS. These fixtures do not write the user's history or genome collection.

Open http://127.0.0.1:8080/tests/demo-browser.html for demo/random/repeat starts,
live and paused edits, invalid input, keyboard focus, chart markers, and layout.
Also run with `?width=390` and `?width=320`. Each must report PASS. This scenario
uses disposable in-memory history and the real application.

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
| `src/simulation/conditions.js` | Editable condition descriptors, atomic validation, and seeded starts |
| `src/rendering/renderer.js` | Reads the model and draws on Canvas |
| `src/rendering/camera.js` | World/screen coordinates, zoom, pan, fit/focus, and pointer gestures |
| `src/rendering/config.js` | Display settings |
| `src/ui/ui.js` | Plant inspector, keyboard, selection, and genome library |
| `src/ui/playback.js` | Wall-time tick budget, playback speed, and bounded catch-up |
| `src/ui/lineage-navigation.js` | Async family navigation, bounded Back history, origin, and stale-read cancellation |
| `src/ui/family-inspector.js` | Inspector tabs, family cards, pages, and scroll restoration |
| `src/ui/conditions-panel.js` | Conditions controls, application feedback, and trend rendering |
| `src/ui/experiment-history.js` | Bounded population samples, interventions, and chart geometry |
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

A seed is an integer from 0 to 4294967295. Without one, the standalone model uses
Math.random; the browser app explicitly starts demo seed 16. For special experiments, supply a
`random` function; it takes precedence over `seed` and continues its sequence
across resets.

`createSimulation({ config: { WIDTH: 120, HEIGHT: 60 }, seed: 16 })` creates a
world with its own settings; ground level is derived from height. Set world
dimensions at creation rather than changing them in a running world.

API: `step()`, `reset({ seed, conditions, shadowMode } = {})`, `getConditions()`,
`setConditions(patch)`, `plantSavedGenome(dna)`, `plantAt(x, y)`,
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
than the entire history. The local family view uses a single readonly IndexedDB
transaction to read the selected record, at most two parents, and six children.
The existing parent index supplies counts and a cursor page; the production UI
does not recursively load descendants or imply complete descendant highlights.
Earlier API callers can still use the legacy `get` operation with all child IDs.

The browser keeps living records, pending changes, seed parent references, and
the displayed family in memory. Back keeps at most 50 lightweight locations plus
the origin, with no historical genome cache. Deep pages use cursor advancement;
large-scale performance benchmarking remains future work. Disk history has no
retention limit.

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
