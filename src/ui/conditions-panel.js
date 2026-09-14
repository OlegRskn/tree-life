import { conditionFields } from "../simulation/conditions.js";
import { trendGeometry } from "./experiment-history.js";

export function createConditionsPanel({ document, history, change, restore }) {
  const el = id => document.getElementById(id);
  const text = (id, value) => { if (el(id).textContent !== String(value)) el(id).textContent = String(value); };
  const format = (key, value) => {
    const field = conditionFields.find(f => f.key === key);
    return field ? `${Number((value * (field.scale ?? 1)).toFixed(3))}${field.unit}` : String(value);
  };
  for (const field of conditionFields) {
    const group = document.createElement("div"); group.className = "condition-field";
    const title = document.createElement("label"); title.textContent = `${field.label}${field.unit ? ` (${field.unit})` : ""}`; title.setAttribute("for", `condition-${field.key}`);
    const row = document.createElement("div"); row.className = "condition-controls";
    const slider = document.createElement("input"); slider.type = "range"; slider.id = `condition-${field.key}`;
    const number = document.createElement("input"); number.type = "number"; number.id = `condition-number-${field.key}`;
    const scale = field.scale ?? 1;
    for (const input of [slider, number]) {
      input.min = field.min * scale; input.max = field.max * scale; input.step = field.step * scale;
      input.setAttribute("aria-label", `${field.label}${field.unit ? ` (${field.unit})` : ""}${input === number ? " value" : ""}`);
      input.setAttribute("aria-describedby", `condition-help-${field.key}`);
      input.addEventListener("change", async () => {
        const focused = document.activeElement === input;
        await change({ [field.key]: input.value.trim() === "" ? NaN : Number(input.value) / scale });
        // Temporary write backpressure must not strand keyboard users on the body.
        if (focused && document.activeElement === document.body) input.focus({ preventScroll: true });
      });
    }
    slider.addEventListener("input", () => { number.value = slider.value; });
    const reset = document.createElement("button"); reset.className = "condition-reset"; reset.textContent = "↺";
    reset.id = `condition-reset-${field.key}`;
    reset.setAttribute("aria-label", `Reset ${field.label}`); reset.addEventListener("click", () => restore(field.key));
    const help = document.createElement("p"); help.id = `condition-help-${field.key}`; help.textContent = `${field.timing}. ${field.help}`;
    row.appendChild(slider); row.appendChild(number); row.appendChild(reset);
    group.appendChild(title); group.appendChild(row); group.appendChild(help);
    el(field.advanced ? "conditions-advanced" : "conditions-fields").appendChild(group);
  }
  el("conditions-reset").addEventListener("click", () => restore());
  let chartRevision = -1, eventRevision = -1;
  return {
    sync(values) {
      for (const field of conditionFields) for (const prefix of ["condition-", "condition-number-"]) {
        el(`${prefix}${field.key}`).value = String(Number((values[field.key] * (field.scale ?? 1)).toFixed(3)));
      }
    },
    message(value) { text("conditions-message", value); },
    draw(disabled) {
      for (const field of conditionFields) for (const prefix of ["condition-", "condition-number-", "condition-reset-"]) el(`${prefix}${field.key}`).disabled = disabled;
      el("conditions-reset").disabled = disabled;
      if (chartRevision !== history.revision) {
        chartRevision = history.revision;
        const graph = trendGeometry(history.samples, history.events);
        el("trend-plants").setAttribute("d", graph.plants); el("trend-seeds").setAttribute("d", graph.seeds);
        el("trend-markers").innerHTML = graph.markers.map(m => `<line x1="${m.x}" x2="${m.x}" y1="0" y2="60"/>`).join("");
        text("trend-range", `Ticks ${graph.first.toLocaleString("en-US")}–${graph.last.toLocaleString("en-US")} · Peak ${graph.peak}`);
        el("population-trend").setAttribute("aria-label", `Population trend. Latest sample: ${history.samples.at(-1)?.plants ?? 0} plants and ${history.samples.at(-1)?.seeds ?? 0} seeds. Peak count ${graph.peak}.`);
      }
      const eventKey = history.events.map(e => e.id).join();
      if (eventRevision === eventKey) return; eventRevision = eventKey;
      const list = el("conditions-events"); list.innerHTML = "";
      if (!history.events.length) { const p = document.createElement("p"); p.textContent = "No changes yet. Try lowering Light and watch the trend."; list.appendChild(p); }
      for (const event of history.events.slice(-6).reverse()) {
        const p = document.createElement("p");
        p.textContent = `Tick ${event.tick} · ` + Object.keys(event.after).map(key => `${conditionFields.find(f => f.key === key)?.label ?? key}: ${format(key, event.before[key])} → ${format(key, event.after[key])}`).join("; ");
        list.appendChild(p);
      }
    },
  };
}
