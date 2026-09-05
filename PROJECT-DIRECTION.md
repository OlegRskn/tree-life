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
PR #1 is ready for review; it has not been merged into main.

### English repository content

2026-09-06: the user requested English throughout GitHub and confirmed that this
also includes repository documentation and code comments. Chat remains in Russian.
Branch `chore/english-project-content` translates tracked documentation, comments,
and interface text. Keyboard aliases for the Russian layout remain supported.
Acceptance: no remaining Cyrillic prose in tracked text, unchanged simulation
checkpoints, tests passing locally and on GitHub, and English UI verified in a browser.
Existing untracked local files are outside this translation and are not published.
