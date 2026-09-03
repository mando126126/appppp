/**
 * inventoryEstimator.js — NEU (Fundament)
 * ================================================================
 * Schätzt, was wahrscheinlich noch da ist — ohne dass der Nutzer
 * jemals einen Bestand pflegt.
 *
 *   gekauft (aus dem Bon)
 *   − geschätzter Verbrauch (aus dem gelernten Rhythmus)
 *   = wahrscheinlicher Restbestand
 *
 * Genau die manuelle Bestandspflege ist der Punkt, an dem NoWaste
 * und FoodShiner in der Nutzung zusammenbrechen. Hier entsteht der
 * Bestand als Nebenprodukt aus Daten, die ohnehin anfallen.
 *
 * WICHTIG: Das Ergebnis ist eine SCHÄTZUNG mit Vertrauenswert.
 * Es wird nirgends als Gewissheit dargestellt, und bei Produkten
 * mit Verbrauchsdatum wird daraus nie eine Aussage zur Genuss-
 * tauglichkeit abgeleitet.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");

/**
 * Ein echtes Kalenderdatum, nicht bloß die richtige Form.
 *
 * `/\d{4}-\d{2}-\d{2}/` lässt „2026-13-45" durch, und daraus wird
 * eine Restzeit von einigen hundert Tagen — auf einem Produkt mit
 * Verbrauchsdatum. Der Test hat genau das gefunden.
 */
function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Schätzt den Restbestand eines Produkts.
 *
 * @param {object} lastPurchase - {date, quantity, unitPrice}
 * @param {object} rhythm - Ergebnis aus computeRhythm
 * @param {string} today
 */
function estimateRemaining(productId, lastPurchase, rhythm, today, opts = {}) {
  const p = byId(productId);
  if (!p || !lastPurchase) return null;

  /* Eine Nutzerkorrektur ("Ist leer" / "etwa richtig" / "mehr als
   * gedacht", siehe Data.setStockCorrection) wirkt wie ein neuer,
   * kleiner Kauf: die Rechnung läuft ab da vom Korrekturdatum und der
   * korrigierten Menge weiter, statt vom ursprünglichen Kauf. Nur
   * solange sie NACH dem letzten echten Kauf liegt -- ein neuer Kauf
   * setzt ohnehin frisch auf, eine ältere Korrektur wäre dann nur
   * noch Rauschen. */
  const correction = opts.corrections && opts.corrections[productId];
  const correctionValid = correction && isRealDate(correction.date) &&
    correction.date >= lastPurchase.date && correction.date <= today &&
    Number.isFinite(correction.remainingUnits);

  const anchorDate = correctionValid ? correction.date : lastPurchase.date;
  const daysSince = daysBetween(anchorDate, today);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;

  const quantity = correctionValid ? correction.remainingUnits : (lastPurchase.quantity || 1);

  // Verbrauch pro Einheit: aus dem Rhythmus, sonst Kategorie-Annahme
  const perUnitDays = rhythm && rhythm.perUnitDays ? rhythm.perUnitDays : null;

  const printed = opts.useBy && opts.useBy[productId];
  const printedValid = isRealDate(printed) && printed >= lastPurchase.date;

  let remainingUnits;
  let basis;
  if (perUnitDays && perUnitDays > 0) {
    const consumed = daysSince / perUnitDays;
    let start = quantity;
    if (!correctionValid && Array.isArray(opts.rows) && opts.rows.length > 1) {
      let rest = 0, prev = null;
      for (const row of opts.rows) {
        const qty = row.quantity || 1;
        if (prev) rest = Math.max(0, rest - daysBetween(prev, row.date) / perUnitDays);
        rest = Math.min(rest, qty, p.shelfLifeDays / perUnitDays) + qty;
        prev = row.date;
      }
      start = rest;
    }
    remainingUnits = Math.max(0, start - consumed);
    basis = "rhythmus";
  } else if (printedValid) {
    // Auch hier zählt das Etikett und nicht die Katalogzahl. Ohne
    // diesen Zweig verschwand ein Produkt aus dem Bestand, obwohl auf
    // der Packung noch fünf Tage standen — die Anzeige rechnete mit
    // dem aufgedruckten Datum, die Frage „ist es überhaupt noch da?"
    // aber weiter mit der Schätzung.
    remainingUnits = today <= printed ? quantity : 0;
    basis = "aufgedruckt";
  } else {
    // Ohne Rhythmus: nur die Haltbarkeit als grobe Schranke
    remainingUnits = daysSince < p.shelfLifeDays ? quantity : 0;
    basis = "haltbarkeit";
  }

  /* Restzeit bis Ablauf.
   *
   * Vorrang hat IMMER das aufgedruckte Datum, wenn es eingetragen
   * wurde. Das ist keine Feinheit: die Katalogzahl ist eine
   * Lagerempfehlung an der unteren Grenze, das Etikett dagegen die
   * Aussage des Herstellers für genau diese Packung. Bei einem
   * Verbrauchsdatum ist es zusätzlich die rechtlich maßgebliche
   * Angabe — nach ihrem Ablauf gehört das Produkt in den Abfall,
   * egal was eine App schätzt.
   *
   * Das aufgedruckte Datum darf dabei in beide Richtungen wirken. Es
   * zu deckeln („höchstens so lange wie geschätzt") klänge vorsichtig,
   * wäre aber Unfug: dann zeigte die App weiter ihre Schätzung und
   * ignorierte die Packung, die der Nutzer in der Hand hält. */
  const daysLeft = printedValid
    ? daysBetween(today, printed)
    : p.shelfLifeDays - daysSince;

  // Vertrauen: hoher Rhythmus-Vertrauenswert und kurze Zeit seit Kauf
  const rhythmConfidence = rhythm ? rhythm.confidence : 0;
  const timeDecay = Math.max(0, 1 - daysSince / Math.max(1, p.shelfLifeDays * 2));
  const confidence = Math.round(rhythmConfidence * timeDecay * 100) / 100;

  return {
    productId,
    name: p.name,
    remainingUnits: Math.round(remainingUnits * 100) / 100,
    likelyPresent: remainingUnits > 0.15 && daysLeft > -1,
    daysLeft,
    expired: daysLeft < 0,
    safetyCritical: p.safetyCritical,
    value: Math.round(remainingUnits * (lastPurchase.unitPrice || p.typicalPrice || 0) * 100) / 100,
    weightG: Math.round(remainingUnits * (p.typicalWeightG || 0)),
    confidence,
    basis,
    // Wer das Etikett eingetragen hat, bekommt keine Schätzung mehr
    // angezeigt, sondern eine Tatsache — und die Oberfläche sagt das.
    dateSource: printedValid ? "aufgedruckt" : "geschaetzt",
    useBy: printedValid ? printed : null,
    estimated: true
  };
}

/**
 * Schätzt den kompletten Haushaltsbestand.
 * @returns {Array} nur Produkte, die wahrscheinlich noch da sind
 */
function estimateInventory(history, rhythms, today, opts = {}) {
  const lastByProduct = new Map();
  for (const h of history) {
    const prev = lastByProduct.get(h.productId);
    if (!prev || h.date > prev.date) lastByProduct.set(h.productId, h);
  }

  const rowsByProduct = new Map();
  for (const h of history) {
    if (!rowsByProduct.has(h.productId)) rowsByProduct.set(h.productId, []);
    rowsByProduct.get(h.productId).push(h);
  }
  for (const rows of rowsByProduct.values()) rows.sort((a, b) => (a.date < b.date ? -1 : 1));

  const inventory = [];
  for (const [productId, last] of lastByProduct.entries()) {
    const est = estimateRemaining(productId, last, rhythms.get(productId), today,
      { ...opts, rows: rowsByProduct.get(productId) });
    if (est && est.likelyPresent) inventory.push(est);
  }

  return inventory.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Bestand im Format, das recipeMatcher erwartet. */
function toRecipeStock(inventory) {
  return inventory.map((i) => ({
    productId: i.productId,
    daysLeft: i.daysLeft,
    price: i.value
  }));
}

module.exports = {
  isRealDate, estimateRemaining, estimateInventory, toRecipeStock };
