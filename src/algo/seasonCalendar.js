/**
 * seasonCalendar.js — Saison für Frischware
 * ================================================================
 * Erdbeeren im Dezember kosten das Dreifache und schmecken
 * schlechter. Ein Sparhinweis, der nicht nach Verzicht klingt.
 *
 * Die Tabelle deckt deutsche Freiland- und Lagerware ab. Sie ist
 * ausdrücklich unvollständig: Produkte ohne Eintrag bekommen keinen
 * Hinweis. Ein erfundener Saisoneintrag wäre schlimmer als keiner —
 * dann stünde bei Bananen „nicht in Saison", was Unsinn ist.
 *
 * Grundlage: Saisonkalender des BZfE. Lagerware (Äpfel, Möhren,
 * Kartoffeln, Zwiebeln, Kohl) gilt über die Lagermonate hinaus als
 * verfügbar, weil sie das faktisch ist.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

// Monate 1–12. `peak` = Freiland-Hochsaison, `available` = zusätzlich
// aus deutschem Lager verfügbar.
const SEASON = {
  erdbeeren:   { peak: [5, 6, 7], available: [] },
  spargel:     { peak: [4, 5, 6], available: [] },
  kirschen:    { peak: [6, 7, 8], available: [] },
  pflaumen:    { peak: [8, 9], available: [] },
  weintrauben: { peak: [9, 10], available: [] },
  aepfel:      { peak: [9, 10, 11], available: [12, 1, 2, 3, 4] },
  birnen:      { peak: [8, 9, 10], available: [11, 12] },
  tomaten:     { peak: [7, 8, 9], available: [6, 10] },
  gurke:       { peak: [6, 7, 8, 9], available: [5, 10] },
  salat_kopf:  { peak: [5, 6, 7, 8, 9], available: [4, 10] },
  paprika:     { peak: [7, 8, 9], available: [6, 10] },
  zucchini:    { peak: [7, 8, 9], available: [6, 10] },
  kuerbis:     { peak: [9, 10, 11], available: [8, 12] },
  moehren:     { peak: [6, 7, 8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5] },
  kartoffeln:  { peak: [8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5, 6, 7] },
  zwiebeln:    { peak: [8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5, 6, 7] },
  lauch:       { peak: [9, 10, 11], available: [12, 1, 2, 3] },
  brokkoli:    { peak: [6, 7, 8, 9, 10], available: [5] },
  blumenkohl:  { peak: [6, 7, 8, 9, 10], available: [5, 11] },
  spinat:      { peak: [4, 5, 9, 10], available: [3, 6, 11] },
  radieschen:  { peak: [4, 5, 6, 7, 8, 9], available: [3, 10] },
  rosenkohl:   { peak: [10, 11, 12, 1], available: [2] },
  feldsalat:   { peak: [10, 11, 12, 1, 2], available: [3, 9] }
};

const STATUS = { PEAK: "saison", AVAILABLE: "lager", OFF: "importware" };

/**
 * @param {string} productId
 * @param {string|Date} date  Bezugsdatum
 * @returns {null|{productId, name, status, month, peakMonths, message}}
 */
function seasonFor(productId, date) {
  const entry = SEASON[productId];
  if (!entry) return null;                  // keine Tabelle = kein Hinweis

  const d = typeof date === "string" ? new Date(date + "T12:00:00Z") : new Date(date);
  const month = d.getUTCMonth() + 1;

  const status = entry.peak.includes(month)
    ? STATUS.PEAK
    : entry.available.includes(month) ? STATUS.AVAILABLE : STATUS.OFF;

  const p = byId(productId);
  const name = p ? p.name : productId;
  const peakText = entry.peak.map((m) => MONTH_NAMES[m - 1]).join(", ");

  const message =
    status === STATUS.PEAK ? `${name} hat jetzt Saison.`
      : status === STATUS.AVAILABLE ? `${name} kommt jetzt aus dem Lager.`
        : `${name} ist jetzt Importware — Saison ist ${peakText}.`;

  return { productId, name, status, month, peakMonths: entry.peak, message };
}

/** Nur die Positionen einer Liste, die außerhalb der Saison liegen. */
function offSeason(items, date) {
  return items
    .map((i) => seasonFor(i.productId, date))
    .filter((s) => s && s.status === STATUS.OFF);
}

/** Was diesen Monat Hochsaison hat — als Anregung, nicht als Vorschlag. */
function inSeasonNow(date, limit = 8) {
  const d = typeof date === "string" ? new Date(date + "T12:00:00Z") : new Date(date);
  const month = d.getUTCMonth() + 1;
  return Object.entries(SEASON)
    .filter(([, e]) => e.peak.includes(month))
    .map(([id]) => ({ productId: id, name: (byId(id) || {}).name || id }))
    .filter((x) => byId(x.productId))
    .slice(0, limit);
}

module.exports = { seasonFor, offSeason, inSeasonNow, SEASON, STATUS, MONTH_NAMES };
