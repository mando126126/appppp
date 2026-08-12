/**
 * forgottenDetector.js — Vergessens-Detektor
 * ================================================================
 * „Zahnpasta zuletzt vor 9 Wochen — normalerweise alle 5."
 *
 * Fängt genau die Zwischenkäufe ab, die das Kernversprechen
 * ruinieren: Ein Produkt fällt aus dem Blick, irgendwann fehlt es
 * mitten in der Woche, und es wird ein Extraweg daraus.
 *
 * Der Unterschied zur normalen Liste: dort steht, was FÄLLIG ist.
 * Hier steht, was AUFFÄLLIG lange fehlt — also deutlich über dem
 * Rhythmus liegt und trotzdem nicht auf der Liste gelandet ist,
 * weil das Vertrauen unter der Schwelle blieb oder weil es
 * abgewählt wurde.
 *
 * Non-Food ist ausdrücklich dabei. Klopapier und Zahnpasta sind die
 * klassischen Vergessenskandidaten, gerade weil sie selten sind.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");

const OVERDUE_FACTOR = 1.6;      // ab dem 1,6-fachen des Rhythmus auffällig
const MIN_CONFIDENCE = 0.35;     // darunter ist der Rhythmus selbst fraglich
const MAX_FACTOR = 6;            // darüber: aufgegeben, nicht vergessen

/**
 * @param {Map} rhythms   aus computeAllRhythms
 * @param {string} today  ISO-Datum
 * @param {object} opts   { exclude: Set<productId> — steht schon auf der Liste }
 */
function findForgotten(rhythms, today, opts = {}) {
  const exclude = opts.exclude || new Set();
  const factor = opts.overdueFactor ?? OVERDUE_FACTOR;
  const out = [];

  for (const [productId, r] of rhythms) {
    if (exclude.has(productId)) continue;
    if (!r.rhythmDays || !r.lastPurchaseDate) continue;
    if (r.confidence < MIN_CONFIDENCE) continue;

    const since = daysBetween(r.lastPurchaseDate, today);
    const ratio = since / r.rhythmDays;
    if (ratio < factor || ratio > MAX_FACTOR) continue;

    const p = byId(productId);
    if (!p) continue;

    const weeksSince = Math.round(since / 7);
    const rhythmWeeks = Math.round(r.rhythmDays / 7);

    // Wochen lesen sich bei langen Rhythmen besser, Tage bei kurzen.
    const sinceText = since >= 21 ? `vor ${weeksSince} Wochen` : `vor ${since} Tagen`;
    const rhythmText = r.rhythmDays >= 21
      ? `sonst alle ${rhythmWeeks} Wochen`
      : `sonst alle ${r.rhythmDays} Tage`;

    out.push({
      productId,
      name: p.name,
      category: p.category,
      aisle: p.aisle,
      isFood: p.isFood,
      daysSince: since,
      rhythmDays: r.rhythmDays,
      ratio: Math.round(ratio * 10) / 10,
      confidence: r.confidence,
      typicalPrice: p.typicalPrice,
      message: `${p.name} zuletzt ${sinceText} — ${rhythmText}.`,
      estimated: true
    });
  }

  // Am auffälligsten zuerst, aber Häufiges vor Seltenem: ein Produkt
  // mit 5-Tage-Rhythmus, das 3 Wochen fehlt, ist dringender als eins
  // mit 90-Tage-Rhythmus beim gleichen Verhältnis.
  return out.sort((a, b) => b.ratio - a.ratio || a.rhythmDays - b.rhythmDays);
}

module.exports = { findForgotten, OVERDUE_FACTOR, MIN_CONFIDENCE, MAX_FACTOR };
