/**
 * aisleOrder.js — Gangreihenfolge je Markt
 * ================================================================
 * Die Reihenfolge der Gänge ist in jedem Markt anders. Wer die Liste
 * in der falschen Reihenfolge abarbeitet, läuft den Laden zweimal ab.
 * Der Nutzer sortiert einmal, die App merkt es sich je Filiale.
 *
 * Bewusst einfach gehalten: eine Liste von Gangnamen je Markt. Kein
 * Kartenmaterial, keine Koordinaten — das wäre Pflegearbeit ohne
 * Ende und für den Nutzen nicht nötig.
 *
 * Neue Gänge, die in der gespeicherten Reihenfolge fehlen, fallen
 * ans Ende statt raus. Ein Sortierschritt, der Positionen verschluckt,
 * ist im Laden schlimmer als eine falsche Reihenfolge.
 * ================================================================
 */

// Voreinstellung: der Weg durch einen typischen deutschen Supermarkt.
// Frische zuerst, Tiefkühl zuletzt — damit das Eis nicht taut.
const DEFAULT_AISLE_ORDER = [
  "Obst & Gemüse",
  "Backwaren",
  "Kühlregal",
  "Fleisch & Fisch",
  "Konserven",
  "Trockenware",
  "Süßwaren",
  "Getränke",
  "Drogerie",
  "Tiefkühl"
];

/** Die gespeicherte Reihenfolge eines Markts, sonst die Voreinstellung. */
function orderFor(store, saved = {}) {
  const custom = saved[normalizeStore(store)];
  return Array.isArray(custom) && custom.length ? custom : DEFAULT_AISLE_ORDER;
}

const normalizeStore = (s) => String(s || "").trim().toLowerCase() || "standard";

/**
 * Positionen nach Gängen gruppieren, in der Reihenfolge des Markts.
 * @returns {Array<{aisle, items}>}
 */
function groupByAisle(items, order = DEFAULT_AISLE_ORDER) {
  const groups = new Map();
  for (const item of items) {
    const aisle = item.aisle || "Sonstiges";
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(item);
  }

  const out = [];
  for (const aisle of order) {
    if (groups.has(aisle)) {
      out.push({ aisle, items: groups.get(aisle) });
      groups.delete(aisle);
    }
  }
  // Was in der Reihenfolge nicht vorkommt, hängt hinten an — nie weglassen.
  for (const [aisle, group] of groups) out.push({ aisle, items: group });
  return out;
}

/**
 * Einen Gang um eine Position verschieben. Liefert eine neue Liste;
 * unbekannte Gänge oder Züge über den Rand hinaus ändern nichts.
 */
function moveAisle(order, aisle, direction) {
  const list = [...order];
  const from = list.indexOf(aisle);
  if (from === -1) return list;
  const to = from + (direction < 0 ? -1 : 1);
  if (to < 0 || to >= list.length) return list;
  [list[from], list[to]] = [list[to], list[from]];
  return list;
}

/**
 * Reihenfolge aus den tatsächlich benutzten Gängen aufbauen, damit
 * der Nutzer nur sortiert, was er auch kauft.
 */
function relevantAisles(order, items) {
  const used = new Set(items.map((i) => i.aisle || "Sonstiges"));
  const known = order.filter((a) => used.has(a));
  const extra = [...used].filter((a) => !order.includes(a));
  return [...known, ...extra];
}

module.exports = { DEFAULT_AISLE_ORDER, orderFor, groupByAisle, moveAisle, relevantAisles, normalizeStore };
