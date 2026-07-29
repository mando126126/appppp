// Zentraler Datenspeicher.
//
// Modell: alles ist ein "Entry" – { id, room, kind, data, updated_at, deleted }.
// Ein einziges Schema für Termine, Aufgaben, Ausgaben usw. hält die Synchro-
// nisation simpel: eine Tabelle, ein Realtime-Kanal, ein Konfliktregel-Satz
// (last write wins über updated_at).
//
// Der Store ist offline-first: geschrieben wird immer zuerst lokal
// (localStorage), erst danach versucht sync.js den Upload.

const CONFIG_KEY = 'kh.config';

export const KINDS = {
  COUPLE: 'couple',   // { nameA, nameB, since, anniversaries: [{label,date}] }
  EVENT: 'event',     // { title, date, time, place, note }
  TASK: 'task',       // { title, done, due, assignee }
  SHOP: 'shop',       // { title, done, qty }
  EXPENSE: 'expense', // { title, amount, payer: 'a'|'b', date, split: 'half'|'full', category }
  NOTE: 'note',       // { body, author }
  IDEA: 'idea',       // { title, tag, done }
  MOOD: 'mood',       // { date, who, emoji, text }
};

/* ---------- Konfiguration (nur lokal, nie synchronisiert) ---------- */

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

/* ---------- Store ---------- */

const listeners = new Set();
let entries = new Map();
let room = null;
let onLocalWrite = () => {};

export const store = {
  /** Lädt den lokalen Cache eines Paar-Codes. */
  open(roomCode) {
    room = roomCode;
    entries = new Map();
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey())) || [];
      for (const e of raw) entries.set(e.id, e);
    } catch { /* beschädigter Cache: einfach leer starten */ }
  },

  /** Wird von sync.js gesetzt, um lokale Änderungen hochzuladen. */
  set uploader(fn) { onLocalWrite = fn; },

  get room() { return room; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  all() {
    return [...entries.values()].filter((e) => !e.deleted);
  },

  list(kind) {
    return this.all().filter((e) => e.kind === kind);
  },

  get(id) {
    const e = entries.get(id);
    return e && !e.deleted ? e : null;
  },

  /** Erstellt oder ersetzt einen Eintrag und stößt den Upload an. */
  put(kind, data, id = uid()) {
    const entry = { id, room, kind, data, updated_at: new Date().toISOString(), deleted: false };
    entries.set(id, entry);
    commit(entry);
    return entry;
  },

  /** Ändert einzelne Felder eines bestehenden Eintrags. */
  patch(id, changes) {
    const cur = entries.get(id);
    if (!cur) return null;
    const entry = {
      ...cur,
      data: { ...cur.data, ...changes },
      updated_at: new Date().toISOString(),
    };
    entries.set(id, entry);
    commit(entry);
    return entry;
  },

  /** Soft-Delete – nötig, damit die Löschung beim Partner ankommt. */
  remove(id) {
    const cur = entries.get(id);
    if (!cur) return;
    const entry = { ...cur, deleted: true, updated_at: new Date().toISOString() };
    entries.set(id, entry);
    commit(entry);
  },

  /**
   * Übernimmt einen Eintrag vom Server. Gewinnt nur, wenn er neuer ist.
   * @returns {boolean} ob sich etwas geändert hat
   */
  merge(remote) {
    const cur = entries.get(remote.id);
    if (cur && cur.updated_at >= remote.updated_at) return false;
    entries.set(remote.id, remote);
    persist();
    return true;
  },

  /** Mehrere Server-Einträge auf einmal (initialer Pull). */
  mergeAll(list) {
    let changed = false;
    for (const r of list) {
      const cur = entries.get(r.id);
      if (cur && cur.updated_at >= r.updated_at) continue;
      entries.set(r.id, r);
      changed = true;
    }
    if (changed) persist();
    return changed;
  },

  notify() {
    for (const fn of listeners) fn();
  },

  /* ----- Bequeme Ansichten ----- */

  /** Paar-Profil (Namen, Beziehungsstart, Jahrestage) – genau ein Eintrag. */
  couple() {
    const e = this.list(KINDS.COUPLE)[0];
    return e ? { id: e.id, ...e.data } : null;
  },

  saveCouple(data) {
    const { id: _ignored, ...fields } = data; // couple() liefert die id mit – nicht mitspeichern
    const cur = this.list(KINDS.COUPLE)[0];
    return cur ? this.patch(cur.id, fields) : this.put(KINDS.COUPLE, fields);
  },
};

function commit(entry) {
  persist();
  store.notify();
  onLocalWrite(entry);
}

function persist() {
  if (!room) return;
  try {
    localStorage.setItem(cacheKey(), JSON.stringify([...entries.values()]));
  } catch { /* Quota voll – der Server bleibt die Wahrheit */ }
}

const cacheKey = () => `kh.data.${room}`;

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
