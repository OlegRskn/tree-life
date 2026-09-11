import { createLineageNavigation } from "./lineage-navigation.js";

export function createFamilyInspector({ document, window, archive, simulation, apply, redraw }) {
  const el = id => document.getElementById(id);
  const text = (id, value) => { if (el(id).textContent !== String(value)) el(id).textContent = String(value); };
  const context = () => ({ scroll: el("info-panel").scrollTop || 0, windowScroll: window.scrollY || 0 });
  let signature;
  let renderedCards = [];
  const navigation = createLineageNavigation((id, run, page) => archive.family(id, run, page), (state, restore) => {
    if (state.family) apply(state.family);
    text("archive-message", state.loading ? "Loading family…" : state.error ? `Cannot open family: ${state.error}` : "");
    el("family-retry").hidden = !state.error;
    redraw();
    if (restore) {
      el(`inspector-tab-${state.tab}`).focus({ preventScroll: true });
      el("info-panel").scrollTop = restore.scroll;
      window.scrollTo?.({ top: restore.windowScroll, behavior: "instant" });
    }
  });
  const tabs = ["overview", "lineage", "dna"];
  for (const [index, name] of tabs.entries()) {
    const button = el(`inspector-tab-${name}`);
    button.addEventListener("click", () => navigation.tab(name));
    button.addEventListener("keydown", event => {
      const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
      if (next === null) return;
      event.preventDefault(); navigation.tab(tabs[next]); el(`inspector-tab-${tabs[next]}`).focus();
    });
  }
  el("family-back").addEventListener("click", () => navigation.previous());
  el("family-origin").addEventListener("click", () => navigation.returnToOrigin());
  el("family-prev").addEventListener("click", () => navigation.page(navigation.state.location.page - 1, context()));
  el("family-next").addEventListener("click", () => navigation.page(navigation.state.location.page + 1, context()));
  el("family-refresh").addEventListener("click", () => navigation.refresh(context()));
  el("family-retry").addEventListener("click", () => navigation.retry());

  function current(record, run) {
    return run === archive.runId ? simulation.state.plantsById.get(record.id) ?? record : record;
  }
  function status(record, run) {
    if (record.missing) return "Missing record";
    return !record.alive ? "Dead" : run === archive.runId ? "Alive" : "Unknown";
  }
  function card(record, run) {
    const p = current(record, run);
    const button = document.createElement("button"); button.type = "button"; button.className = "family-card";
    const label = status(p, run); button.dataset.state = label.toLowerCase();
    button.setAttribute("aria-label", `Open plant #${p.id}, ${label}`);
    const title = document.createElement("span"); title.className = "family-card-title"; title.textContent = `Plant #${p.id}`;
    const state = document.createElement("span"); state.className = "family-card-status"; state.textContent = label;
    const detail = document.createElement("span"); detail.className = "family-card-detail";
    detail.textContent = p.missing ? "Record unavailable" : `Generation ${p.generation} · Born ${p.bornAt}`;
    button.appendChild(title); button.appendChild(state); button.appendChild(detail);
    button.addEventListener("click", () => {
      const top = window.innerWidth <= 760 ? el("info-panel").getBoundingClientRect().top + window.scrollY : window.scrollY || 0;
      return navigation.navigate(p.id, context(), Math.max(0, top));
    });
    renderedCards.push({ button, state, record, run });
    return button;
  }
  function draw() {
    const state = navigation.state;
    for (const name of tabs) {
      const selected = name === state.tab;
      el(`inspector-tab-${name}`).setAttribute("aria-selected", String(selected));
      el(`inspector-tab-${name}`).tabIndex = selected ? 0 : -1;
      el(`inspector-${name}`).hidden = !selected;
    }
    const family = state.family;
    el("family-back").disabled = !state.back.length || state.loading;
    el("family-origin").disabled = !state.back.length || state.loading;
    el("family-refresh").disabled = !family || state.loading;
    el("inspector-lineage").setAttribute("aria-busy", String(state.loading));
    if (!family) return;
    const run = family.runId;
    text("family-origin-label", `Origin · Plant #${state.origin.id} · Run ${state.origin.runId}`);
    text("family-selected", `Plant #${family.record.id}`);
    text("family-selected-detail", `Generation ${family.record.generation} · ${status(current(family.record, run), run)}`);
    text("family-child-count", `${family.total} ${family.total === 1 ? "child" : "children"}`);
    text("family-page", family.total ? `${family.page * family.limit + 1}–${family.page * family.limit + family.children.length} of ${family.total}` : "No children recorded");
    el("family-prev").disabled = state.loading || family.page === 0;
    el("family-next").disabled = state.loading || (family.page + 1) * family.limit >= family.total;
    // This first iteration refreshes topology only on explicit navigation/refresh.
    // Loaded current-run records retain identity so status changes remain visible.
    const records = [...family.parents, ...family.children];
    const key = `${run}/${family.record.id}/${family.page}/${family.total}/` + records.map(p => `${p.id}:${!!p.missing}`).join();
    if (key === signature) renderedCards.forEach((card, index) => { card.record = records[index]; });
    for (const card of renderedCards) {
      const label = status(current(card.record, card.run), card.run);
      if (card.state.textContent !== label) {
        card.state.textContent = label; card.button.dataset.state = label.toLowerCase();
        card.button.setAttribute("aria-label", `Open plant #${card.record.id}, ${label}`);
      }
    }
    if (key === signature) return;
    signature = key;
    renderedCards = [];
    el("family-parents").dataset.count = String(family.parents.length);
    el("family-parents").innerHTML = ""; el("family-children").innerHTML = "";
    if (!family.parents.length) {
      const note = document.createElement("p"); note.className = "family-empty"; note.textContent = "Founder · No parents recorded";
      el("family-parents").appendChild(note);
    }
    for (const parent of family.parents) el("family-parents").appendChild(card(parent, run));
    for (const child of family.children) el("family-children").appendChild(card(child, run));
  }
  return { navigation, draw };
}
