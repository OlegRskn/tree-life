export function createUI({ document, window, canvas, simulation, viewState, store,
  redraw, toggleRunning, restart, archive, onArchiveOpen = () => {}, plantGenome = dna => simulation.plantSavedGenome(dna) }) {
  let selectionVersion = 0;
  let selectedRun;
  let selectedChildren;
  let selectionTarget;
  let renderedDNA, renderedRelations;
  let saveTarget;
  const put = (id, value) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  };
  const archiveMessage = document.getElementById("archive-message");
  function closeGenomeForm() {
    saveTarget = undefined;
    const form = document.getElementById("genome-save-form");
    if (form) form.hidden = true;
    put("genome-save-message", "");
  }
  function clearArchiveSelection() {
    selectionVersion++;
    selectedRun = undefined;
    selectedChildren = undefined;
    selectionTarget = undefined;
    viewState.selectedRun = undefined;
    viewState.selectedPlant = null;
    if (archive) viewState.lineageHighlights = [];
    if (archiveMessage) archiveMessage.textContent = "";
    closeGenomeForm();
  }
  async function selectArchived(id, runId = archive.runId) {
    const version = ++selectionVersion;
    selectionTarget = { id, runId };
    viewState.lineageHighlights = [];
    if (viewState.selectedPlant?.id !== id || selectedRun !== runId) {
      viewState.selectedPlant = null;
      closeGenomeForm();
    }
    archiveMessage.textContent = "Loading history...";
    redraw();
    try {
      const plant = await archive.get(id, runId);
      if (version !== selectionVersion) return;
      if (!plant) { archiveMessage.textContent = "No record for this run and plant ID."; return; }
      selectedRun = runId;
      viewState.selectedRun = runId;
      // Live records must retain identity so their card follows growth and death.
      viewState.selectedPlant = runId === archive.runId
        ? simulation.state.plantsById.get(id) ?? plant : plant;
      selectedChildren = plant.children;
      archiveMessage.textContent = `Run ${runId}${plant.alive && runId !== archive.runId ? " - alive at last recorded birth; final state unknown" : ""}`;
      redraw();
      if (runId !== archive.runId) return;
      // Load lineage only on selection/topology changes, never during rendering.
      // Records are discarded after traversal; the selected card is the cache.
      const queue = [...plant.children];
      const seen = new Set();
      const highlights = [];
      while (queue.length && version === selectionVersion) {
        const childId = queue.pop();
        if (seen.has(childId)) continue;
        seen.add(childId);
        const child = await archive.get(childId, runId);
        if (!child) continue;
        const live = simulation.state.plantsById.get(childId);
        if (live?.alive) highlights.push(live);
        queue.push(...child.children);
      }
      if (version === selectionVersion) { viewState.lineageHighlights = highlights; redraw(); }
    } catch (error) {
      if (version === selectionVersion) archiveMessage.textContent = `Cannot read history: ${error.message}. Try opening the record again.`;
    }
  }
  function refreshArchiveSelection() {
    if (archive && (viewState.selectedPlant || selectionTarget)) {
      return selectArchived(viewState.selectedPlant?.id ?? selectionTarget.id,
        selectionTarget?.runId ?? selectedRun ?? archive.runId);
    }
  }
  function makeLineageLink(plant) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "lineage-link" + (plant.alive ? "" : " dead");
    link.textContent = `#${plant.id}`;
    link.title = archive ? `Open plant #${plant.id}` : plant.alive
      ? `gen ${plant.generation}, tick ${plant.bornAt}`
      : `gen ${plant.generation}, tick ${plant.bornAt} – ${plant.diedAt}`;
    link.addEventListener("click", () => {
      if (archive) return selectArchived(plant.id, selectedRun ?? archive.runId);
      viewState.selectedPlant = plant;
      redraw();
    });
    return link;
  }

  function drawPlantInfo() {
    const empty = document.getElementById("info-empty");
    const content = document.getElementById("info-content");
    const btnSave = document.getElementById("btn-save-genome");

    if (!viewState.selectedPlant) {
      empty.style.display = "block";
      content.style.display = "none";
      btnSave.disabled = true;
      return;
    }

    const p = viewState.selectedPlant;
    empty.style.display = "none";
    content.style.display = "block";
    btnSave.disabled = false;

    const historical = archive && selectedRun !== undefined && selectedRun !== archive.runId;
    const unknown = historical && p.alive;
    put("specimen-context", historical ? `HISTORICAL RECORD · RUN ${selectedRun}` : "CURRENT WORLD");
    put("plant-status", unknown ? "Unknown" : p.alive ? "Alive" : "Dead");
    const status = document.getElementById("plant-status");
    if (status?.dataset) status.dataset.state = p.alive ? "alive" : "dead";
    put("values-caption", unknown ? "Birth record · final state unknown" : p.alive ? "Current values" : "Recorded at death");
    put("age-label", p.alive ? "Age" : "Age at death");
    put("energy-label", p.alive ? "Energy" : "Final energy");
    put("children-count", (selectedChildren ?? p.children).length);
    const death = document.getElementById("death-details");
    if (death) { death.hidden = p.alive; put("death-details", `Died at tick ${p.diedAt} · ${p.causeOfDeath === "starvation" ? "Starvation" : "Old age"}`); }
    const focus = document.getElementById("focus-plant");
    if (focus) focus.disabled = !canFocus();
    put("focus-hint", historical ? "This record belongs to a previous world." : p.alive ? "Move the camera only when you choose." : "This plant is no longer in the world.");

    // Overview values update without replacing the inspector or its details.
    document.getElementById("info-id").textContent = `#${p.id}`;
    document.getElementById("info-generation").textContent = p.generation;
    document.getElementById("info-born").textContent = `tick ${p.bornAt}`;
    document.getElementById("info-energy").textContent = unknown ? "—" : p.energy;
    document.getElementById("info-age").textContent = unknown ? "—" : p.alive
      ? `${p.age} / ${p.maxAge}`
      : `${p.age} (${p.causeOfDeath === "starvation" ? "starvation" : "old age"})`;
    document.getElementById("info-cells").textContent = p.alive && !historical
      ? p.cells.length
      : "—";

    const relations = `${selectedRun}:${p.id}:${p.parents.join()}:${(selectedChildren ?? p.children).map(id => `${id}/${simulation.state.plantsById.get(id)?.alive}`).join()}`;
    if (relations !== renderedRelations) {
    renderedRelations = relations;
    // Parents
    const parentsEl = document.getElementById("info-parents");
    parentsEl.className = "lineage-list";
    parentsEl.innerHTML = "";
    for (const pid of p.parents) {
      const parent = archive ? { id: pid, alive: false } : simulation.state.plantsById.get(pid);
      if (parent) parentsEl.appendChild(makeLineageLink(parent));
    }

    // Children
    const childrenEl = document.getElementById("info-children");
    childrenEl.className = "lineage-list";
    childrenEl.innerHTML = "";
    for (const id of selectedChildren ?? p.children) {
      const child = archive ? { id, alive: selectedRun === archive.runId && simulation.state.plantsById.get(id)?.alive } : simulation.state.plantsById.get(id);
      if (child) childrenEl.appendChild(makeLineageLink(child));
    }
    }

    // Genes used by the plant's current cells
    const usedGenes = new Set(p.cells.map((c) => c.gene));
    const dnaKey = `${selectedRun}:${p.id}:${JSON.stringify(p.dna)}:${[...usedGenes].sort().join()}`;
    if (dnaKey === renderedDNA) return;
    renderedDNA = dnaKey;

    const dnaEl = document.getElementById("info-dna");
    dnaEl.innerHTML = "";

    // Direction header
    const header = document.createElement("div");
    header.className = "dna-gene";
    const emptyIdx = document.createElement("span");
    emptyIdx.className = "gene-index";
    header.appendChild(emptyIdx);
    const headerVals = document.createElement("div");
    headerVals.className = "gene-values";
    ["←", "↑", "→", "↓"].forEach((arrow) => {
      const span = document.createElement("span");
      span.className = "gene-val gene-dir-label";
      span.textContent = arrow;
      headerVals.appendChild(span);
    });
    header.appendChild(headerVals);
    dnaEl.appendChild(header);

    p.dna.forEach((gene, i) => {
      const isUsed = usedGenes.has(i);
      const row = document.createElement("div");
      row.className = "dna-gene" + (isUsed ? " used" : "");

      const idx = document.createElement("span");
      idx.className = "gene-index";
      idx.textContent = i;
      row.appendChild(idx);

      const vals = document.createElement("div");
      vals.className = "gene-values";
      gene.forEach((v) => {
        const span = document.createElement("span");
        span.className = "gene-val" + (v <= 15 ? " active" : "");
        span.textContent = v;
        vals.appendChild(span);
      });
      row.appendChild(vals);
      dnaEl.appendChild(row);
    });
  }

  function renderGenomeList() {
    const list = document.getElementById("genome-list");
    if (!list) return;
    list.innerHTML = "";
    const saved = store.load();
    const entries = Object.entries(saved);
    if (entries.length === 0) {
      list.innerHTML =
        '<p class="muted">No saved genomes yet. Select a plant in Observe and choose Save genome.</p>';
      return;
    }
    for (const [name, dna] of entries) {
      const item = document.createElement("div");
      item.className = "genome-item";

      const nameEl = document.createElement("span");
      nameEl.className = "genome-name";
      nameEl.title = name;
      nameEl.textContent = name;

      const actions = document.createElement("div");
      actions.className = "genome-actions";

      const plantBtn = document.createElement("button");
      plantBtn.className = "genome-btn";
      plantBtn.textContent = "Plant";
      plantBtn.addEventListener("click", async () => {
        try { await plantGenome(dna); } catch (error) { put("library-message", `Could not plant genome: ${error.message}`); }
      });

      const delBtn = document.createElement("button");
      delBtn.className = "genome-btn";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => deleteGenome(name));

      actions.appendChild(plantBtn);
      actions.appendChild(delBtn);
      item.appendChild(nameEl);
      item.appendChild(actions);
      list.appendChild(item);
    }
  }

  function deleteGenome(name) {
    try { store.remove(name); renderGenomeList(); put("library-message", "Genome removed from this collection."); }
    catch (error) { put("library-message", `Could not remove genome: ${error.message}`); }
  }

  document.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY", "A"].includes(event.target?.tagName) || event.target?.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === " ") {
      event.preventDefault();
      toggleRunning();
    }
    if (key === "l" || key === "\u0434") {
      viewState.labelMode = viewState.labelMode === "none" ? "gene"
        : viewState.labelMode === "gene" ? "energy" : "none";
      const control = document.getElementById("labels-mode"); if (control) control.value = viewState.labelMode;
      redraw();
    }
    if (key === "s" || key === "\u044b") {
      simulation.toggleShadowMode();
      const control = document.getElementById("shadow-mode"); if (control) control.value = simulation.state.shadowMode;
      redraw();
    }
    if (key === "r" || key === "\u043a") {
      renderGenomeList();
      return restart();
    }
  });

  canvas.addEventListener("click", (event) => {
    if (viewState.camera) return; // Pointer gestures distinguish dragging from selection.
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (rect.width / canvas.width) / viewState.cellSize);
    const y = Math.floor((event.clientY - rect.top) / (rect.height / canvas.height) / viewState.cellSize);
    return selectAt(x, y);
  });

  function selectAt(x, y) {
    clearArchiveSelection();
    viewState.selectedPlant = simulation.plantAt(x, y);
    selectedRun = archive?.runId;
    viewState.selectedRun = selectedRun;
    redraw(); return refreshArchiveSelection();
  }
  function canFocus() {
    const plant = viewState.selectedPlant;
    return !!(plant?.alive && plant.cells.length && (!archive || selectedRun === undefined || selectedRun === archive.runId)
      && simulation.state.plantsById.get(plant.id) === plant);
  }

  document.getElementById("btn-save-genome").addEventListener("click", () => {
    const form = document.getElementById("genome-save-form");
    if (viewState.camera && form) {
      if (!viewState.selectedPlant) return;
      saveTarget = viewState.selectedPlant;
      form.hidden = false;
      const input = document.getElementById("genome-name-input");
      input.value = `plant-#${saveTarget.id}`; input.focus();
      put("genome-save-message", ""); return;
    }
    const name = window.prompt("Genome name:",
      viewState.selectedPlant ? `plant-#${viewState.selectedPlant.id}` : "");
    if (name && name.trim() && viewState.selectedPlant) {
      store.save(name.trim(), viewState.selectedPlant.dna);
      renderGenomeList();
    }
  });
  const form = document.getElementById("genome-save-form");
  if (viewState.camera && form) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const name = document.getElementById("genome-name-input").value.trim();
      if (!name || !saveTarget) { put("genome-save-message", "Enter a name for this genome."); return; }
      try {
        store.save(name, saveTarget.dna); renderGenomeList(); form.hidden = true;
        put("genome-save-message", `Saved ${name} to Herbarium.`); document.getElementById("btn-save-genome").focus();
      } catch (error) { put("genome-save-message", `Could not save: ${error.message}`); }
    });
    document.getElementById("cancel-genome-save").addEventListener("click", () => { form.hidden = true; document.getElementById("btn-save-genome").focus(); });
  }

  if (archive) document.getElementById("archive-open").addEventListener("click", () => {
    const run = Number(document.getElementById("archive-run").value || archive.runId);
    const id = Number(document.getElementById("archive-plant").value);
    if (!Number.isSafeInteger(run) || run < 1 || !Number.isSafeInteger(id) || id < 1) {
      archiveMessage.textContent = "Enter positive whole numbers for run and plant ID.";
      put("history-message", archiveMessage.textContent);
      return;
    }
    put("history-message", ""); onArchiveOpen();
    return selectArchived(id, run);
  });
  try { renderGenomeList(); } catch (error) { put("library-message", `Genome collection unavailable: ${error.message}`); }
  return { drawPlantInfo, refreshArchiveSelection, clearArchiveSelection, selectAt, canFocus };
}
