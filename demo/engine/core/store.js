// The store. One clinic, one store: collections of plain objects keyed by id.
// MemoryStore runs the tests and the browser demo. The Node file store (src/node/store.js) has the
// same five methods and writes every collection to its own JSON file under the clinic's data folder.

export const COLLECTIONS = ['enquiries', 'appointments', 'outbox', 'tasks', 'suppression', 'health', 'alarms', 'events', 'counters'];

export class MemoryStore {
  constructor(initial = {}) {
    this.data = new Map();
    for (const c of COLLECTIONS) this.data.set(c, new Map());
    for (const [c, items] of Object.entries(initial)) {
      for (const item of items) this.put(c, item);
    }
  }

  collection(name) {
    const c = this.data.get(name);
    if (!c) throw new Error(`Unknown collection '${name}'.`);
    return c;
  }

  all(name) {
    return [...this.collection(name).values()];
  }

  get(name, id) {
    return this.collection(name).get(id) || null;
  }

  put(name, item) {
    if (!item || !item.id) throw new Error(`Cannot store an item without an id in '${name}'.`);
    this.collection(name).set(item.id, item);
    this.persist(name);
    return item;
  }

  remove(name, id) {
    const ok = this.collection(name).delete(id);
    this.persist(name);
    return ok;
  }

  find(name, pred) {
    return this.all(name).filter(pred);
  }

  /** Overridden by the file store. */
  persist() {}

  snapshot() {
    const out = {};
    for (const c of COLLECTIONS) out[c] = this.all(c);
    return out;
  }
}
