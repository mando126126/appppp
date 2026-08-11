/**
 * activityLog.js — das Ereignis-Protokoll
 * ================================================================
 * Wochenrückblick, Meilensteine und Streak brauchen alle dieselbe
 * Grundlage: eine Liste dessen, was tatsächlich passiert ist, mit
 * Datum. Drei Module, die sich jeweils ihre eigene Zählung aus den
 * Käufen zusammenrechnen, wären drei Wahrheiten — und spätestens
 * beim ersten Widerspruch („der Rückblick sagt 3, das Abzeichen
 * sagt 4“) ist das Vertrauen weg.
 *
 * Deshalb ein Protokoll, in das jede zählbare Handlung genau einmal
 * geschrieben wird, und drei Module, die nur noch lesen.
 *
 * WAS HIER HINEINGEHÖRT: bestätigte Handlungen mit Datum. Ein Kauf,
 * ein Austausch, ein gerettetes Produkt. Keine Schätzungen über
 * Dinge, die vielleicht passiert sind.
 *
 * ZWEI GELDBETRÄGE, DIE NICHT ZUSAMMENGEHÖREN:
 *
 *   `gerettet`  ist kontrafaktisch — der Wert, der ohne die
 *               Handlung wahrscheinlich verdorben wäre. Eine
 *               Schätzung, und als solche gekennzeichnet.
 *   `guenstig`  ist realisiert — die Differenz zwischen gezahltem
 *               und dem eigenen üblichen Preis. Nachrechenbar.
 *
 * Die beiden werden NIE addiert. Das ist derselbe Grundsatz, mit
 * dem in der Ansicht „Zahlen“ schon die Haushalts-Ersparnis getrennt
 * von der Lebensmittel-Ersparnis steht: eine Summe aus gemessen und
 * geschätzt ist eine Zahl, die nichts mehr bedeutet.
 * ================================================================
 */

const { priceMemory, NOTABLE_CHANGE } = require("./priceMemory");

const ACTION = {
  GERETTET: "gerettet",         // Verderb abgewendet, vom Nutzer bestätigt
  GUENSTIG: "guenstig",         // unter dem eigenen üblichen Preis gekauft
  GETAUSCHT: "getauscht",       // Austauschprodukt gewechselt
  ERFASST: "erfasst",           // Bon gebucht
  RUECKMELDUNG: "rueckmeldung"  // Antwort auf einen Vorschlag
};

const ACTION_LABEL = {
  gerettet: "gerettet",
  guenstig: "günstig gekauft",
  getauscht: "getauscht",
  erfasst: "erfasst",
  rueckmeldung: "Rückmeldung"
};

const KINDS = Object.values(ACTION);

// Ein Jahr plus Puffer: so weit zurück schaut der längste Streak
// (52 Wochen). Älteres wertet kein Modul mehr aus, und ein Protokoll,
// das unbegrenzt wächst, sprengt irgendwann den Browserspeicher.
const MAX_LEDGER_DAYS = 400;
const MAX_LEDGER_ENTRIES = 1500;

// Unter zehn Cent ist eine „Ersparnis“ Rundungsrauschen.
const MIN_SAVING_EUROS = 0.1;

const isDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * Fremde oder alte Einträge auf eine verlässliche Form bringen.
 * Ein einziger kaputter Eintrag aus einer alten Sicherung darf nicht
 * die gesamte Auswertung mitreißen.
 */
function normalizeActions(list) {
  return (Array.isArray(list) ? list : [])
    .filter((a) => a && isDate(a.date) && KINDS.includes(a.kind))
    .map((a) => ({
      date: a.date,
      kind: a.kind,
      productId: a.productId || null,
      euros: Number.isFinite(a.euros) ? Math.max(0, a.euros) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Einträge im Zeitraum, Grenzen eingeschlossen. */
function actionsInRange(list, from, to) {
  return normalizeActions(list).filter((a) => a.date >= from && a.date <= to);
}

/** Anzahl je Art. Fehlende Arten stehen als 0 drin, nicht als undefined. */
function countByKind(list) {
  const out = {};
  KINDS.forEach((k) => { out[k] = 0; });
  normalizeActions(list).forEach((a) => { out[a.kind]++; });
  return out;
}

/** Summe der Beträge einer Art. */
function sumEuros(list, kind) {
  const sum = normalizeActions(list)
    .filter((a) => !kind || a.kind === kind)
    .reduce((a, x) => a + x.euros, 0);
  return Math.round(sum * 100) / 100;
}

/** Protokoll kürzen: erst nach Alter, dann notfalls nach Anzahl. */
function pruneActions(list, today, maxDays = MAX_LEDGER_DAYS) {
  const cutoff = shiftDate(today, -maxDays);
  const kept = normalizeActions(list).filter((a) => a.date >= cutoff);
  return kept.length > MAX_LEDGER_ENTRIES ? kept.slice(kept.length - MAX_LEDGER_ENTRIES) : kept;
}

const shiftDate = (dateStr, days) =>
  new Date(new Date(dateStr + "T12:00:00Z").getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * Realisierte Ersparnis eines Einkaufs: was unter dem eigenen
 * üblichen Preis gezahlt wurde.
 *
 * Verglichen wird gegen die Historie VOR diesem Einkauf. Nähme man
 * die Historie einschließlich der neuen Zeile, verschöbe der günstige
 * Kauf den Bezugswert selbst nach unten und die Ersparnis fiele zu
 * klein aus — bei drei Datenpunkten spürbar.
 *
 * @param {Array} rows [{productId, quantity, unitPrice}]
 * @param {Array} priorHistory Käufe vor diesem Bon
 * @returns {Array} [{productId, euros, usual, paid}]
 */
function receiptSavings(rows, priorHistory) {
  const out = [];
  for (const r of (rows || [])) {
    if (!r || !r.productId) continue;
    const paid = Number(r.unitPrice);
    const qty = Math.max(1, Number(r.quantity) || 1);
    if (!Number.isFinite(paid) || paid <= 0) continue;

    const mem = priceMemory(r.productId, priorHistory || []);
    if (!mem || !mem.usual) continue;

    // Dieselbe Schwelle wie im Preis-Gedächtnis: darunter ist ein
    // Unterschied kein Angebot, sondern Streuung.
    if (paid > mem.usual * (1 - NOTABLE_CHANGE)) continue;

    const euros = Math.round((mem.usual - paid) * qty * 100) / 100;
    if (euros < MIN_SAVING_EUROS) continue;
    out.push({ productId: r.productId, euros, usual: mem.usual, paid: Math.round(paid * 100) / 100 });
  }
  return out;
}

module.exports = {
  ACTION, ACTION_LABEL, KINDS,
  normalizeActions, actionsInRange, countByKind, sumEuros, pruneActions,
  receiptSavings, shiftDate,
  MAX_LEDGER_DAYS, MAX_LEDGER_ENTRIES, MIN_SAVING_EUROS
};
