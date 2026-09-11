// Navigation keeps lightweight locations, not a cache of historical genomes.
export function createLineageNavigation(load, changed = () => {}) {
  const state = { location: null, family: null, origin: null, back: [], tab: "overview", loading: false, error: "", pending: null };
  let version = 0;
  const location = (id, runId, page = 0) => ({ id, runId, page, scroll: 0, windowScroll: 0 });
  const same = (a, b) => a && b && a.id === b.id && a.runId === b.runId;
  function capture(context) {
    const value = { ...state.location, ...context };
    if (same(value, state.origin)) state.origin = { ...value };
    return value;
  }
  async function visit(target, commit) {
    const token = ++version;
    state.loading = true; state.error = ""; state.pending = { target, commit };
    changed(state);
    try {
      const family = await load(target.id, target.runId, target.page);
      if (version !== token) return;
      if (!family) throw new Error(`Plant #${target.id} has no record in run ${target.runId}.`);
      commit(); state.location = target; state.family = family;
      state.loading = false; state.pending = null;
      changed(state, target);
    } catch (error) {
      if (version !== token) return;
      state.loading = false; state.error = error.message;
      changed(state);
    }
  }
  return {
    state,
    clear() {
      version++; Object.assign(state, { location: null, family: null, origin: null, back: [], tab: "overview", loading: false, error: "", pending: null });
    },
    start(id, runId) {
      this.clear(); const target = location(id, runId); state.origin = { ...target };
      return visit(target, () => {});
    },
    navigate(id, context = {}, destinationScroll = 0) {
      if (!state.location) return;
      const previous = capture(context);
      return visit({ ...location(id, previous.runId), windowScroll: destinationScroll }, () => {
        state.back = [...state.back.slice(-49), previous]; state.tab = "lineage";
      });
    },
    previous() {
      const target = state.back.at(-1);
      if (target) return visit({ ...target }, () => { state.back.pop(); state.tab = "lineage"; });
    },
    returnToOrigin() {
      if (state.origin) return visit({ ...state.origin }, () => { state.back = []; state.tab = "lineage"; });
    },
    page(page, context = {}) {
      if (!state.location || !Number.isSafeInteger(page) || page < 0) return;
      const target = { ...capture(context), page };
      return visit(target, () => {});
    },
    refresh(context = {}) {
      if (state.location) return visit(capture(context), () => {});
    },
    retry() { if (state.pending) return visit(state.pending.target, state.pending.commit); },
    tab(name) {
      if (!["overview", "lineage", "dna"].includes(name)) return;
      state.tab = name; changed(state);
    },
  };
}
