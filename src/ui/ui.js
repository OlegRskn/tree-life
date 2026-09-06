export function createUI({ document, window, canvas, simulation, viewState, store,
  redraw, toggleRunning, restart, archive, plantGenome = dna => simulation.plantSavedGenome(dna) }) {
  let selectionVersion = 0;
  let selectedRun;
  let selectedChildren;
  let selectionTarget;
  const archiveMessage = document.getElementById("archive-message");
  function clearArchiveSelection() {
    selectionVersion++;
    selectedRun = undefined;
    selectedChildren = undefined;
    selectionTarget = undefined;
    viewState.selectedPlant = null;
    if (archive) viewState.lineageHighlights = [];
    if (archiveMessage) archiveMessage.textContent = "";
  }
  async function selectArchived(id, runId = archive.runId) {
    const version = ++selectionVersion;
    selectionTarget = { id, runId };
    selectedRun = runId;
    viewState.lineageHighlights = [];
    viewState.selectedPlant = null;
    archiveMessage.textContent = "Loading history...";
    redraw();
    try {
      const plant = await archive.get(id, runId);
      if (version !== selectionVersion) return;
      if (!plant) { archiveMessage.textContent = "No record for this run and plant ID."; return; }
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
    const link = document.createElement("span");
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

    // Basic fields
    document.getElementById("info-id").textContent = `#${p.id}`;
    document.getElementById("info-generation").textContent = p.generation;
    document.getElementById("info-born").textContent = p.alive
      ? `tick ${p.bornAt}`
      : `tick ${p.bornAt} – ${p.diedAt}`;
    document.getElementById("info-energy").textContent = p.alive ? p.energy : "—";
    document.getElementById("info-age").textContent = p.alive
      ? `${p.age} / ${p.maxAge}`
      : `${p.age} (${p.causeOfDeath === "starvation" ? "starvation" : "old age"})`;
    document.getElementById("info-cells").textContent = p.alive
      ? p.cells.length
      : "—";

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

    // Genes used by the plant's current cells
    const usedGenes = new Set(p.cells.map((c) => c.gene));

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

  function fitToViewport() {
    const app = document.getElementById("app");
    // Reset the transform to measure the unscaled size.
    app.style.transform = "translate(-50%, -50%)";
    const appW = app.offsetWidth;
    const appH = app.offsetHeight;
    const scale = Math.min(
      window.innerWidth / appW,
      window.innerHeight / appH,
      1,
    );
    app.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function renderGenomeList() {
    const list = document.getElementById("genome-list");
    if (!list) return;
    list.innerHTML = "";
    const saved = store.load();
    const entries = Object.entries(saved);
    if (entries.length === 0) {
      list.innerHTML =
        '<span style="color:#555;font-size:12px">No saved genomes</span>';
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
      plantBtn.addEventListener("click", () => plantGenome(dna));

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
    store.remove(name);
    renderGenomeList();
  }

  document.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === " ") {
      event.preventDefault();
      toggleRunning();
    }
    if (key === "l" || key === "\u0434") {
      viewState.labelMode = viewState.labelMode === "none" ? "gene"
        : viewState.labelMode === "gene" ? "energy" : "none";
      redraw();
    }
    if (key === "s" || key === "\u044b") {
      simulation.toggleShadowMode();
      redraw();
    }
    if (key === "r" || key === "\u043a") {
      clearArchiveSelection();
      renderGenomeList();
      return restart();
    }
  });

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (rect.width / canvas.width) / viewState.cellSize);
    const y = Math.floor((event.clientY - rect.top) / (rect.height / canvas.height) / viewState.cellSize);
    clearArchiveSelection();
    viewState.selectedPlant = simulation.plantAt(x, y);
    redraw();
    return refreshArchiveSelection();
  });

  document.getElementById("btn-save-genome").addEventListener("click", () => {
    const name = window.prompt("Genome name:",
      viewState.selectedPlant ? `plant-#${viewState.selectedPlant.id}` : "");
    if (name && name.trim() && viewState.selectedPlant) {
      store.save(name.trim(), viewState.selectedPlant.dna);
      renderGenomeList();
    }
  });

  window.addEventListener("resize", fitToViewport);
  if (archive) document.getElementById("archive-open").addEventListener("click", () => {
    const run = Number(document.getElementById("archive-run").value || archive.runId);
    const id = Number(document.getElementById("archive-plant").value);
    if (!Number.isSafeInteger(run) || run < 1 || !Number.isSafeInteger(id) || id < 1) {
      archiveMessage.textContent = "Enter positive whole numbers for run and plant ID.";
      return;
    }
    return selectArchived(id, run);
  });
  fitToViewport();
  renderGenomeList();
  return { drawPlantInfo, refreshArchiveSelection, clearArchiveSelection };
}
