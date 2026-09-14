# Tree Life: directions and initial plan

Date: 2026-09-05. A working hypothesis for discussion; the product direction has not been chosen yet.

## What already exists

A browser simulation built with JavaScript and Canvas, without a build system. The world has 240 x 90 cells. A genome of 16 genes controls growth in four directions. The model includes leaves, wood, energy costs, shading, aging, seeds, mutations, and a crossover mechanism.

IDs, parents and children, lineage navigation, relative highlighting, population history, genome grouping, and localStorage genome saves are already implemented. The earlier local `ui-plan.md` should therefore be treated as a historical implementation plan: most of its steps already exist in code.

## Core hypothesis

Observation becomes interesting when simple rules produce different viable forms and the interface helps people recognize and explain their success.

Proposed first experience: start a world -> notice an unusual plant -> follow its lineage -> save its genome -> change one condition -> compare outcomes.

## Possible directions

1. **A living evolutionary garden.** Focus on observation, interesting shapes, successive generations, and stories of individual lineages. Few required actions. Question: do people want to return to see what happened?
2. **An artificial-life laboratory.** Focus on reproducible experiments, environment settings, and comparisons of genomes and outcomes. Question: can someone ask a question and obtain an understandable result?
3. **A world-growing game.** Focus on player decisions, resource constraints, goals, and consequences of intervention. Question: is there an interesting choice beyond waiting? This requires a separate gameplay loop.

Initial hypothesis: combine the garden with a few laboratory tools. The final direction depends on the author's interests.

## Observations informing the plan

These describe the initial prototype; later implementation notes record subsequent changes.

- The starting population is one random plant. In a diagnostic sample of 20 fixed random sequences, 18 runs ended without offspring; two reached generation 9 by tick 5000. This is a small sample, not a probability estimate for all launches. The model ran in Node without rendering, with Math.random replaced by an LCG; the browser interface was not inspected in this initial experiment.
- Reproduction depends on blocked growth: a blocked sprout accumulates energy for a seed. Seeds are released only after death. This determines selection, not just appearance.
- Seeds fall vertically; there is no separate wind or horizontal transport mechanism. A parent's horizontal growth can still spread seeds horizontally.
- Under the current reproduction rules, a living parent and its offspring do not coexist. Highlighting living ancestors is therefore of limited use; shape history and highlighting related contemporary plants may be more useful.
- Plant colour is random and not inherited, making lineages harder to recognize.
- The species counter rounds DNA values into buckets. These are technical genome groups, not established species or strategies. Gene numbers reference instructions: nearby numbers do not necessarily imply similar behavior.
- One tick runs per requestAnimationFrame callback, so world speed depends on frame rate.
- Initially, dead plants remained in the main array; history and repeated traversal costs grew over time.
- The Canvas is 4800 x 1800, and the entire UI, including its panel, scales down to fit the window. Panel readability needs checking and should be independent of world scale.

## Stage 1. Reliable, measurable experiments

Goal: understand why the world survives or becomes extinct, and reproduce the result.

- Separate model steps from rendering and allow setting the initial random-generator state.
- Add pause, single-step execution, speed controls, and replay from the same starting state.
- Prepare a demo using known viable genomes; retain fully random starts for experiments.
- Record births, deaths, generations, viable offspring, and population size. Increasing generation numbers alone do not establish adaptation.
- Use repeated runs to examine energy balance, seed production, and actual crossover frequency.
- Separate active plants from the archive and define history limits.

Acceptance: selected runs are reproducible; demo scenarios reach at least 20 generations; extinction is visible and explained by data. The generation count is an initial technical target, not proof of an engaging experience.

## Stage 2. Make events understandable

- Keep the panel readable and add world-camera zoom and panning.
- Colour plants by lineage, with a separate indication of mixed ancestry if needed.
- Explain energy sources, expenses, growth obstacles, and offspring in the plant card.
- Compare parent and child DNA and small shape snapshots at similar ages.
- Keep a small event log: first offspring, lineage extinction, and generation records. Store events and occasional snapshots rather than every frame.

Acceptance: without reading code, an observer can describe one lineage's story and suggest a reason for its success. That explanation still needs experimental verification.

## Stage 3. One meaningful intervention

Choose one variable, such as light intensity. Run the same starting state at two values, repeat across several starting states, and show population size, reproduction, and shape distributions.

Add wind, soil variation, seasons, or new organisms as separate experiments when observations reveal what diversity is missing.

Acceptance: changing the condition produces a distinguishable, reproducible result and encourages the user to test another hypothesis.

## Stage 4. Test interest

Give the prototype to 3-5 people for a short, open-ended session. Observe what they notice, where they get lost, whether they save plants, and whether they repeat experiments on their own. Then choose the main direction: garden, laboratory, or game.

## Ideas for later experiments

- **Herbarium:** a genome collection with snapshots, ancestry, and successful conditions.
- **What changed?:** compare neighbouring generations and highlight mutations.
- **World fork:** copy a state to test one environment change.
- **Dynasty history:** a short account of a lineage spreading and disappearing.
- **Different places, different forms:** several niches with different lighting.

## Defer for now

Accounts, a backend, multiplayer, monetization, a large genome editor, complex species classification, and replacing the technology stack. Revisit when a concrete need emerges.

## Questions for the next discussion

- Does the author care most about observing life, exploring its rules, or controlling it as a player?
- Is biological realism important, or are engaging abstract rules sufficient?
- Which moment in the current prototype already made the author want to keep watching?

Next practical iteration: reproducible starts, a stable demonstration scenario, and clear birth/extinction indicators. Use those results to decide which growth and reproduction rules to change.

## Agreed architecture and progress

2026-09-05: agreed to extract an independent simulation model, genetics, rendering, UI, and persistence. The first pass preserves existing rules; the second separates active bodies from the archive and clarifies spatial maps.

First-pass results:

- `main.js` connects modules and schedules frames; the model runs without a browser.
- Each simulation owns state and settings; a numeric seed enables reproducible experiments through the API.
- Display settings are separate from rules. Shading remains a model rule.
- The genome library keeps its localStorage key and format.
- Local tests and dependency-free startup were added; commands and module responsibilities are documented in README.md.

Acceptance criteria: match 30 original reference states, run without a DOM, isolate instances, and preserve controls and genome storage. All 13 automated tests passed. Browser checks covered startup, pause, reset, selection, the DNA card, and L/S toggles. Codex's in-app browser does not support the existing `prompt()`; the actual name-entry dialog still needs checking in a normal browser. Saving/planting/deleting passed an integration test with stubbed dialogs and storage.

The work was committed on `refactor/simulation-modules`; it had not been merged at this stage. The original working tree contained uncommitted changes, including main.js, index.html, and style.css. This iteration preserved the existing HTML/CSS.

### Second pass: active population and spatial maps

2026-09-06, branch `refactor/active-population-spatial`, based on the first pass.

Agreed outcome: process only living plants, keep dead plants' lineage accessible, and extract spatial maps without changing balance.

- `population.js` separates the active array from the full ID registry. Dead plants leave the active array after the plant phase, preserving survivor order without skipping neighbours. They retain DNA and relationships but release their cells.
- Fixed age increasing after death. Regression tests reproduced the previous behavior before passing on the new implementation.
- `spatial.js` owns occupancy/shadow maps and updates. At this stage, the existing delay in removing shadows after death was preserved and documented as a separate task.
- Normal rendering and population metrics use the active array; lineage inspection uses the ID registry.

Acceptance criteria were met: all 25 local tests passed; 30 original checkpoints matched with adaptation only for the old erroneous post-death age. Browser checks covered startup, selection, keeping a card open after death, and navigating from a dead parent to a living child and back. No console errors were observed. Saving through prompt was not rechecked; the in-app browser limitation remained, while the genome-library integration test passed.

Limitations: the DNA/metadata archive still grows, maps are rebuilt each step, and traversing a large selected lineage can be expensive. This iteration removes dead-plant traversal from ordinary steps and rendering; it does not solve every memory constraint.

Next separate tasks: immediate shadow updates on death/mode changes, history retention, then speed controls and a reliable demo scenario.

### Immediate shadow updates

2026-09-06, branch `fix/immediate-shadow-updates`, based on the second pass.

Result: a dead cell's shadow is subtracted immediately; mode changes rebuild maps immediately, including while paused. Growth, energy coefficients, mutations, and processing order were unchanged. Repeated cell removal does not alter maps; removing one source preserves other sources.

Regression tests first reproduced the delay. In a controlled example, a leaf below a dead neighbour received 10 energy units after upkeep instead of 14. It now receives the unshaded amount; a seed can germinate in the same step its covering canopy disappears.

All 32 tests passed. Maps were independently reconstructed from living cells after steps with deaths and every 100 ticks in two runs up to 5000 ticks. Browser checks exercised S in both directions while paused with a card open: age and energy stayed unchanged, with no console errors. Map values were verified through automated tests, not by visual inspection of Canvas.

Comparison with the previous commit bfe67f2, seed 16, tick 5000:

| Mode | Living before -> after | Births before -> after | Seeds before -> after | Max generation before -> after |
|---|---|---|---|---|
| canopy | 34 -> 34 | 538 -> 538 | 12 -> 12 | 9 -> 9 |
| column | 1 -> 18 | 125 -> 147 | 24 -> 9 | 8 -> 9 |

Matching summary counts in canopy mode does not imply identical full states: internal plant data differs. Four of 30 old hashes changed (seed 16, both modes, ticks 1500/5000). New values are stored separately; the original hashes were not overwritten. This is a diagnostic comparison of one seed, not evidence of better balance.

History retention, speed controls, and a reliable demo scenario remain separate tasks. Long-run outcomes can change after removing shadow delay; that is an expected effect of the fix.

### Merging and CI

2026-09-06: at the user's instruction, the three completed branches were merged into `main` in order using fast-forward merges. The resulting b08746b was pushed to GitHub. All 32 tests passed locally on the combined state.

Following the user's request, `ci/automated-tests` adds GitHub Actions: `npm test`, Node.js 22, Ubuntu, all branch pushes, and pull requests targeting main. Acceptance requires a successful first GitHub run. No build or package installation is needed. Deployment and branch protection are outside this iteration. The previous rule deferring CI/CD was replaced in AGENTS.md.

CI passed for dc9bc7381b69d697e75e952f93177f3b729e8959:
https://github.com/OlegRskn/tree-life/actions/runs/33996412736.
PR #1 and the English-content PR #2 were subsequently merged at the user's
instruction. Local and remote completed branches were deleted after confirming
that their commits were included in main (a9087c1).

### English repository content

2026-09-06: the user requested English throughout GitHub and confirmed that this
also includes repository documentation and code comments. Chat remains in Russian.
Branch `chore/english-project-content` translates tracked documentation, comments,
and interface text. Keyboard aliases for the Russian layout remain supported.
Acceptance: no remaining Cyrillic prose in tracked text, unchanged simulation
checkpoints, tests passing locally and on GitHub, and English UI verified in a browser.
Existing untracked local files are outside this translation and are not published.

### Persistent lineage archive: iteration 1

2026-09-06, branch `feature/persistent-lineage-archive`. The user chose persistent
history instead of deleting old records and approved the first implementation
iteration. Outcome: store history in IndexedDB, evict acknowledged dead records
from the browser's model registry, and load lineage cards on demand.

Acceptance criteria:

- Birth/death records and DNA survive page reload; run IDs isolate resets.
- Late offspring remain linked after a dead parent has left memory.
- A failed transaction retains pending records, pauses stepping, and supports retry.
- Selection changes and resets cancel stale asynchronous card updates.
- Simulation results and existing reference checkpoints remain unchanged.

Implementation uses a parent index instead of rewriting archived parent records.
The model does not access IndexedDB. The app serializes writes and model changes,
with no external dependencies. A minimal run/plant ID lookup makes previous
history accessible; a run list, storage management, deletion, export/import,
and full-world resume belong to later iterations.

Validation: 40 Node tests pass, including a 5000-tick comparison with archival
enabled, complete late-child relationships, write failure/retry, and asynchronous
UI behavior. Native IndexedDB tests pass for atomic abort, isolation, missing
records, reopening, and page reload. Browser inspection verified a live card,
its transition to death, and reopening that dead record from an earlier run
after reload; no console errors were observed.

Limitations: birth records of plants still alive when a page closes have an
unknown final state; a pending write can be lost on abrupt closure. History is
local to one browser origin and has no disk retention limit. Seeds retain parent
objects while needed. Lineage highlighting traverses records asynchronously
and temporarily holds visited IDs; very large lineages may be slow. The existing
whole-app scaling still makes the panel small. Readable panels/camera controls
remain a separate UI iteration. No cell-shape history or world resume is added.

### Readable inspector

2026-09-07: the user approved merging archive PR #3 and proceeding with the
readable panel. PR #3 was merged after successful CI (main: 07ff13d).
Branch `feature/readable-inspector` removes whole-app scaling. The world fits
its own area while the inspector retains a 14px base font and independent
scrolling. At 720px or narrower the panel moves below the world with page scrolling.
Form controls inherit the panel font, and muted DNA/lineage labels have improved
contrast. No simulation rules, camera controls, or archive format changes are included.

Acceptance: readable text independent of world scale; no horizontal overflow;
long cards remain reachable; Canvas aspect ratio and plant selection stay correct.
Validation: 40 Node tests pass, including selection at resized/offset Canvas
bounds. The persistent browser layout test passes at 1280x720, 1000x320, 720x720,
390x844, and 320x640. Live browser inspection covers historical card opening and
panel scrolling. Canvas HUD text still scales with the world; a separate HUD
and camera navigation remain future work.

### UI design exploration (draft, not approved for implementation)

2026-09-07: the user requested a deliberate UI/UX design discussion with creative
freedom and explicitly prohibited coding for now. PR #4 remains open. No new
implementation or merge is authorized by this design discussion.

Proposed direction: a botanical observatory. The cellular world is the visual
focus; restrained forest/charcoal surfaces, warm neutral text, sage accents,
and amber seeds support observation. Use a readable sans-serif for labels and
monospaced numerals for data. Preserve square-cell organisms; avoid decorative
particles that could be mistaken for simulation entities. The generated image
is a brainstorming concept with sample data, not a specification or a capture
of the running application.

Observed issues in the current screen:
- Archive lookup and an always-visible Retry button precede the selected plant.
- World/HUD scale hides important information and leaves organisms very small.
- Playback controls and a clear paused state are not visible.
- Extinction leaves an unexplained empty world.
- A historical specimen is displayed beside the current world with weak context.
- DNA occupies substantial space before the user understands the organism.

Code-level interaction risks still needing focused reproduction:
- Archive refresh clears selection before loading, potentially flashing the
  empty inspector during ordinary topology updates.
- Per-frame inspector reconstruction may disturb interaction/focus/scroll.
- Space is handled globally even when a button has keyboard focus.
The user's own bug examples are requested and remain pending.

Proposed information architecture:
- Observe: world, persistent playback state/controls, a few population metrics,
  contextual specimen inspector, optional events/population graph.
- History: browsable runs and records, explicit historical context; opening
  history should pause current playback while preserving its prior state.
- Herbarium: intentionally saved genomes, with naming and planting actions.

Inspector: Overview / Lineage / DNA; keep specimen identity, status, and save
visible. Loading must preserve the existing card and scroll position. Selection
should survive death. Never imply that a historical specimen can be focused in
an active world or that a population graph can rewind the simulation.

Interaction proposals to evaluate before implementation: zoom anchored at the
pointer, explicit Fit world and Focus selected, drag-to-pan distinct from click,
visible Step and speed controls, hover feedback at adequate zoom, a mobile
bottom inspector that does not compete with world gestures. Exact camera,
keyboard, touch, focus, and pause/resume behavior must be specified first.

Important dependencies: historical shape previews require storing snapshots;
current records do not contain cell shapes. Energy trend explanations need
measurements. The current reproduction rules do not allow living parents and
their offspring to coexist: illustrative mockup events must not suggest this.
No preview should invent missing data or promise unimplemented rewind/resume.

Next design milestones: agree on visual direction; specify Observe and the
inspector; design initial, selected, paused, dead, extinct, loading, error, and
historical states plus mobile layout; prioritize confirmed bugs; then agree on
small implementation iterations. Export/import and large genealogy views are
not prerequisites for the first visual redesign. This is an uncommitted draft.

Design follow-up: the user endorsed the botanical observatory direction and
requested an initial-state concept with one founder. The refined concept uses
one square sprout, flat soil, an initial close-up, concise inspection guidance,
and visible transport controls. Proposed (not yet approved): start new worlds
paused at tick 0 so the founder cannot die before the user begins observation.
A click opens the inspector without starting time; Start begins playback.
The camera must not automatically move after its initial framing. Fit world
is an explicit action. Keep initial guidance dismissible after selection and
show population history only after samples exist. Exact zoom/speed values in
the concept are illustrative. Coding remains deferred; the next design state
is selecting and observing the founder, followed by death/extinction states.

Design agreement: the user approved starting new worlds paused with an initial
founder close-up. Selection does not start time, and camera movement remains
explicit. The user then requested a paired living/dead specimen concept.

The paired concept retains the selected specimen, active inspector tab, save
action, and world camera after death. Living values become explicitly labelled
final values; age, energy, death tick and cause remain inspectable. Focus in
world becomes unavailable for a dead body; DNA can still be saved. No historical
shape is invented. Mockup values and shapes are illustrative.

Death of a selected plant must not stop a world containing other plants or seeds.
Only zero living plants AND zero seeds triggers the proposed ended state, which
stops automatic stepping and offers run review without resetting or closing
the inspector. Seeds remaining without plants is a separate waiting state.
The refined concept disables Resume/Step for an ended run. Whether planting a
saved genome reopens that run or starts a new one remains an open product choice.
The recorded-at-death caption applies to final organism measurements; descendant
relationships can still change when surviving seeds germinate. These are design
notes, not implementation authorization. No code or PR changes were made.

Lineage design exploration: the user requested the next concept. A local family
view shows immediate parents, the selected specimen, and a bounded page of
children rather than loading a full historical tree. Support zero, one, or two
parents; crossover makes ancestry a graph rather than a strict tree.

Proposed navigation: a relative opens in the same inspector and keeps Lineage
active; Back restores the previous record, filter, page, and scroll. Return to
the original specimen provides an explicit anchor for an exploration session.
Selecting a relative does not move the camera. Locate is a separate action,
available only for living specimens in the current run. World highlights must
identify whether they cover all loaded descendants or only the displayed family;
never imply that a partially loaded lineage is complete.

For large offspring lists, use stable ordering and pagination with counts; do
not reorder rows under the pointer when births or deaths arrive. Diagram and
list must use the same filter/page. The concept repeats children as nodes and
rows to compare structure and details; evaluate collapsing this duplication in
a narrow inspector. Three rows in the image are illustrative, not a fixed limit.

Historical records with no recorded death may have unknown final status; they
must not be labelled currently Alive or offered Locate. Include an Unknown
status/filter where applicable. Children counts may grow after a parent's death.
Handle missing records, read failures, no parents, no children yet, loading, and
two-parent crossover explicitly before implementation. Keyboard-accessible
record controls and non-color status labels are required. On narrow screens,
prefer stacked parents/selected/children over a miniature unreadable graph.

The image is a design concept with sample plants and data. The direction still
needs user evaluation. No code, dependency, archive schema, commit, push, or PR
changes are authorized by this design exploration.

Expanded lineage map concept: the user liked the two-level approach (immediate
relatives in the inspector plus an expandable full-area graph) and requested a
complex-family sketch. The concept shows a two-parent crossover, four generation
rows, and a collapsed group of immediate children. Selected specimen and the
exploration origin have distinct labels/borders. Highlighted connections explain
the route between them; Return to origin restores the exploration anchor.

Proposed semantics: nodes open records without recentering; Expand loads another
bounded portion of a family, preserving the selected node's screen position.
Shared ancestors/offspring have one identity in the graph, not duplicated plants.
Generation rows indicate genealogical depth, not elapsed time; crossover parents
can occupy different generation rows. A collapsed count denotes immediate hidden
children, not all descendants. Living branches retains dead connecting ancestors.
Do not classify incompletely loaded branches as extinct or complete.

Keep graph geometry stable while inspecting. New topology is offered through
an explicit update rather than automatic rearrangement. Display the graph's
snapshot tick so Alive labels are not mistaken for guaranteed current status;
any Locate action must recheck that a specimen is alive in the current world.
Back to world restores the earlier world camera and selection context. Status
unknown, errors, empty filters, large overlapping pedigrees, and mobile graph
navigation still need design before implementation. This sketch is illustrative,
not a fixed layout algorithm or an implementation approval.

### DNA inspector exploration

2026-09-08: the user asked to continue the no-code UI design work. The concept
connects the specimen, its 16-row/four-direction genome, and a selected instruction
explanation. It is an illustrative expanded DNA view, not generated simulation
output or an approved change in model rules.

Confirmed current semantics: values 0..15 request a new sprout in that direction
and assign its gene index. Values 16..31 issue no growth command. Directions are
left, up, right, down. New founders start at gene 0. Growth can fail because of
occupancy, boundaries, soil, or shading; a genome is not a guaranteed final shape.
A sprout with all directions disabled becomes a leaf. A sprout with commands
but no successful growth can accumulate seed energy if the plant can pay.

Example: gene 03 = [05, 09, 22, 17] requests left/up growth with new genes 05/09,
while right/down are disabled. Keep raw inactive values readable: 22 and 17 have
the same immediate disabled behavior but are distinct genetic values that may
respond differently to future mutations. Do not encode numbers as intensity.

Proposed interactions: row selection highlights matching current sprout cells;
cell selection reveals its stored gene and cell type; selecting a valid target
value navigates to its gene with Back navigation. Clarify whether highlighting
means matching stored gene IDs or currently executable sprout instructions.
No matching current sprout does not mean the gene was never used or is useless.
Selection/hover must not move the camera, edit DNA, or change playback implicitly.
A dense DNA inspection view can offer an explicit Pause action, preserving the
user's choice. On narrow screens, the instruction explanation goes below the
matrix instead of compressing the numbers.

For dead plants, preserve the matrix and command explanation but omit lost body
highlights. Exact historical execution and cell-shape previews require additional
stored data. A later parent comparison should label positional DNA differences,
not inferred mutation events or proven causes of a phenotype; two-parent origins
cannot always be reconstructed from final DNA alone. Explain all-disabled genes,
self-references/cycles, blocked growth, missing historical data, and unknown
activity without declaring an error. DNA editing and speculative growth previews
remain out of scope. Prototype labels/art need cleanup (e.g. active-tab wording
and cells drawn within soil) before any implementation specification is final.

Next: consolidate approved direction and proposed behaviors across Observe,
Overview, Lineage, expanded map, and DNA; review unresolved state transitions and
mobile layout, then agree on implementation iterations. Code remains unchanged.

### Observatory implementation: iteration 1

2026-09-08: the user authorized implementation of the agreed plan and deferred
a separate investigation of previously noticed bugs. Branch
`feature/observatory-observe` builds on readable-inspector PR #4, already merged
on GitHub as `df2a8bb`. This iteration requires an explicit merge instruction.

Scope: observatory Observe shell and Overview, paused founder close-up, explicit
play/pause/step and 1x/4x/16x controls, pointer-anchored zoom/pan, fit/focus,
readable world statistics, and initial/dead/waiting/ended/storage-error states.
Keep existing history lookup, saved genomes, lineage links, and raw DNA available;
expanded map and explanatory DNA redesign are later iterations.

Acceptance: startup/reset at tick 0 paused; one step advances exactly one tick;
1x targets 30 ticks/s independently of frame rate with bounded catch-up; storage
failure stops stepping without losing pending records; selection and camera do
not change with playback; dragging does not select; zoom anchors at pointer;
Overview remains available after death; extinction requires no plants or seeds.
Entering History/Herbarium pauses; returning to Observe stays paused. New-world
creation uses explicit confirmation. Planting into an empty run keeps its run
identity and leaves playback paused until the user resumes. Responsive layout
and keyboard controls must be checked in browser. No new dependencies.

Implemented outcome: Observe and Overview now use the dark observatory layout,
with camera and playback extracted into independent modules. History lookup and
the genome library remain available as separate screens. Saved-genome naming is
inline; resetting asks for confirmation and preserves archived records. Overview
keeps the selected record after death and distinguishes previous-run snapshots.
DNA and relative controls retain their DOM until their data changes.

Validation: `npm test` passes all 49 tests, including camera gestures/transforms,
frame-rate-independent playback, one-tick stepping, storage recovery, confirmed
reset, and death/waiting/ended states. Native browser layout checks pass at
1280x720, 1000x320, 720x720, 390x844, and 320x640. Browser interaction checks cover
selection, Step, fit/focus, playback through death, inline genome save, planting
from Herbarium, confirmed reset, and reopening a record from the previous run.
GitHub Actions passed for implementation commit `7dfee5f` (run 34201923927).
The open review is PR #5; subsequent commits also require successful checks.

Limits: speeds are targets subject to rendering/storage throughput; touch uses
dragging and zoom buttons (no pinch gesture). Physical touch-device behavior and
cross-browser testing beyond the available browser remain unverified. No new
blocking issues were found in the checked flows. The separate existing-bug review
remains deferred at the user's request. Next planned iteration: the bounded local
family view and its navigation states; expanded lineage map and explanatory DNA
follow afterward.

### Local lineage: iteration 1

2026-09-11: following approval of the two-part lineage plan, implement family
navigation on `feature/local-lineage`. Add Overview/Lineage/DNA tabs, immediate
parents and children, Back, and Return to origin. World selection or archive
lookup begins a new exploration; relative navigation keeps Lineage active.
Restore the previous record, page, and inspector scroll on Back. Camera and
playback must remain unchanged. Historical birth-only records show Unknown.

Use the existing parent index to load a bounded page rather than traversing
descendants. Basic page navigation belongs to this foundation; automatic new-child
counts and richer live-update behavior remain the second iteration. Provide
explicit refresh, missing-record/read-error handling, and keyboard navigation.
No dependencies, archive schema migration, or simulation rule changes.

Acceptance: traverse parent -> child -> grandchild and restore context; handle
zero/one/two parents, missing records, failed and stale reads, and resets. Load
only the selected record, at most two parents, and six children per page. Verify
run isolation, unknown historical status, bounded native IndexedDB reads, and
desktop/mobile layout. Existing-bug investigation remains deferred.

Implemented: family tabs, bounded indexed pages, explicit refresh, relative
navigation, a 50-location Back history plus origin, and retry without discarding
the currently inspected record. Loaded statuses update without replacing focused
controls. Mobile navigation stays at the inspector; Back/origin restore page scroll.
No automatic descendant traversal or misleading full-lineage highlight remains
in the production UI. Legacy lookup remains available for existing API callers.

Validation: 55 Node tests; native IndexedDB checks with a 500-child family; five
layout sizes; full synthetic-family browser scenarios on desktop and at 390px.
The mobile jump-to-world issue was reproduced by the browser regression test
before its fix and passed afterward. Physical touch devices, other browser engines,
and large-scale performance benchmarks remain unverified. No known blocking issue
remains in these checked flows. New-child notifications and richer live updates
remain iteration 2. This branch builds on open PR #5; neither PR is merged by this
iteration. CI must pass on the final pushed commit before merge.

### Demonstration and live experiments

2026-09-11: approved a three-part demo plan on `feature/demo-experiments`:
1. Reproducible demo/random/repeat starts; the demo reaches at least generation 20.
2. Conditions panel with live light, maintenance, mutation, and shade controls;
   newborn-only energy/lifespan settings, validation, and explicit application timing.
3. Population/seed trends and intervention markers, explanatory first-run copy,
   and a complete desktop/mobile demo flow.

Acceptance: demo seed 16 reaches generation 20 without intervention; repeats
restore the same seed and starting conditions. Parameter edits apply between model
steps, preserve camera/selection/playback, and never rewrite existing DNA or
assigned lifespan/energy. Invalid values leave the model unchanged. Applied edits
have a tick and before/after record; trend history is bounded. Preserve existing
reference simulations at default settings. Verify local tests, native storage,
browser flows, and CI. Earlier PRs #5/#6 remain unmerged dependencies.

2026-09-14: implemented all three parts. Browser startup uses demo seed 16 at
4x, paused; new worlds offer demo, random, and repeat. Conditions use validated
atomic model updates and explicit timing descriptions. The sidebar includes
newborn settings, per-field/group restoration, and recent edits. A bounded chart
tracks plants and seeds with intervention markers. Run metadata stores the start
and applied edits, with retry deduplication and no archive schema migration.

Validation: 62 Node tests pass, including two identical 15,000-tick demo runs
reaching generation 28 with living plants. Native IndexedDB checks pass for
metadata, intervention retry/reload, and existing archive scenarios. The complete
demo browser scenario passes at desktop, 390px, and 320px widths, including edits
while paused/running, invalid values, keyboard focus, repeat/random/demo resets,
chart markers, and no horizontal overflow. Five existing layout sizes pass.
The production page reached generation 22 at tick 11,695 in the browser with
native storage, a populated trend chart, and no console errors.
Default reference simulations remain unchanged. README documents test commands,
application timing, persistence, and repeat semantics.

Limits: old-run condition metadata is stored but not yet exposed by History;
the Display shadow-mode switch is outside the Conditions intervention log.
Repeat restores the baseline rather than replaying interventions or plantings.
Physical touch devices and other browser engines remain unverified. No deployment
or merge is part of this iteration; final pushed CI must pass before merge.

### Genome-derived colors

Approved iteration: derive plant and seed colors from existing DNA in the renderer.
Acceptance: identical DNA retains its palette across serialization/replanting;
single-position mutations cause small hue shifts; stems remain darker than leaves,
seeds use their own genome, and selection keeps its independent white outline.
Simulation rules, random draws, and archive records must remain unchanged.
Use a stable weighted projection rather than an avalanche hash. Color similarity
is only a visual hint, never evidence of shared ancestry or a unique species ID.

Implemented with a weak DNA-keyed rendering cache. Validation: 65 Node tests pass,
including serialized palette identity, all 64 point-mutation positions, renderer
seed/body colors, selection outline, and unchanged model state. Browser inspection
at generation 16 shows distinct green/teal families on the dark background.

### Unobstructed seed waiting

User-requested follow-up: replace the seed-only overlay with a compact status
beside the population counts. Acceptance: seeds remain visible, playback stays
available, germination clears the status, and true extinction retains Review run.
The regression test reproduced the unwanted overlay before the fix. This is a
separate fix branch built on the genome-color iteration.

Validation: all 65 Node tests pass after the fix. The browser scenario passes on
desktop and at 390px: seed-only waiting stays unobstructed, germination clears
the status, and extinction still offers review. Both layouts were visually checked.
