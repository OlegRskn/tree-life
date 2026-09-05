// Uses the existing "genomes" key and DNA format; storage is supplied by the app.
export function createGenomeStore(storage) {
  function load() {
    return JSON.parse(storage.getItem("genomes") || "{}");
  }
  function save(name, dna) {
    const saved = load();
    Object.defineProperty(saved, name, { value: dna, enumerable: true, configurable: true });
    storage.setItem("genomes", JSON.stringify(saved));
  }
  function remove(name) {
    const saved = load();
    delete saved[name];
    storage.setItem("genomes", JSON.stringify(saved));
  }
  return { load, save, remove };
}
