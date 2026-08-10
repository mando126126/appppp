/**
 * rhythmEngine2.js  — überarbeitete Fassung
 * ================================================================
 * Was gegenüber v1 besser ist:
 *
 * 1. MEDIAN STATT MITTELWERT.
 *    Ein einziger Urlaub (28 Tage kein Milchkauf) hat den alten
 *    gewichteten Mittelwert massiv verzogen. Der Median ignoriert
 *    solche Ausreißer strukturell.
 *
 * 2. MAD STATT STANDARDABWEICHUNG für den Vertrauenswert.
 *    Die Standardabweichung wird vom selben Ausreißer verzerrt wie
 *    der Mittelwert. Die "Median Absolute Deviation" nicht.
 *
 * 3. MENGENBEWUSST.
 *    Zwei Liter Milch halten doppelt so lange wie einer. v1 hat
 *    Mengen ignoriert und deshalb bei Vorratskäufen falsche
 *    Rhythmen gelernt. Jetzt wird pro Einheit gerechnet.
 *
 * 4. PAUSENERKENNUNG.
 *    Ein Abstand, der mehr als das Dreifache des Medians beträgt,
 *    wird als Unterbrechung (Urlaub, Krankheit) erkannt und aus
 *    der Rhythmusberechnung ausgeschlossen -- aber protokolliert,
 *    damit er nicht stillschweigend verschwindet.
 *
 * 5. TRENDERKENNUNG.
 *    Vergleicht die jüngere Hälfte der Intervalle mit der älteren.
 *    Verändert sich der Rhythmus dauerhaft (neuer Job, Kind aus dem
 *    Haus), wird das gemeldet statt weggemittelt.
 *
 * Weiterhin: kein KI-Modell. Nur robuste Statistik.
 * ================================================================
 */

const MIN_INTERVALS_FOR_TREND = 6;
const PAUSE_FACTOR = 3;          // ab dem Dreifachen des Medians: Unterbrechung
const MIN_INTERVALS_FULL_CONFIDENCE = 4;

function daysBetween(a, b) {
  const ta = new Date(b).getTime();
  const tb = new Date(a).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return NaN;
  return Math.round((ta - tb) / 86400000);
}

/**
 * Prüft, ob ein Datumswert brauchbar ist.
 * Im Stresstest hat ein einziger kaputter Eintrag ("kein-datum")
 * den gesamten Rhythmus auf NaN gesetzt — bei echten Bons ist ein
 * unlesbares Datum nicht unwahrscheinlich, und ein einzelner
 * Fehler darf nicht die Auswertung aller anderen Käufe zerstören.
 */
function isValidDate(d) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Number.isFinite(t);
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median Absolute Deviation — robustes Streuungsmaß. */
function mad(values) {
  const m = median(values);
  if (m === null) return null;
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Berechnet den Rhythmus für ein Produkt.
 *
 * @param {Array<{date:string, quantity?:number}>} purchases
 * @returns {{
 *   rhythmDays:number|null, confidence:number, sampleSize:number,
 *   lastPurchaseDate:string|null, lastQuantity:number,
 *   pauses:Array, trend:"stabil"|"seltener"|"haeufiger"|"unbekannt",
 *   perUnitDays:number|null
 * }}
 */
function computeRhythm(purchases) {
  const empty = {
    rhythmDays: null, confidence: 0, sampleSize: 0, lastPurchaseDate: null,
    lastQuantity: 1, pauses: [], trend: "unbekannt", perUnitDays: null, invalidEntries: 0
  };
  if (!purchases || purchases.length === 0) return empty;

  // Kaputte Einträge aussortieren, statt die ganze Berechnung zu
  // vergiften: ungültiges Datum, Menge <= 0 oder nicht endlich.
  // Aussortierte Einträge werden gezählt, damit sie nicht
  // stillschweigend verschwinden.
  const invalid = [];
  const clean = purchases.filter((p) => {
    const okDate = isValidDate(p.date);
    const qty = p.quantity === undefined ? 1 : p.quantity;
    const okQty = Number.isFinite(qty) && qty > 0;
    if (!okDate || !okQty) { invalid.push(p); return false; }
    return true;
  }).map((p) => ({ ...p, quantity: p.quantity === undefined ? 1 : p.quantity }));

  if (clean.length === 0) return { ...empty, invalidEntries: invalid.length };

  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  if (sorted.length < 2) {
    return { ...empty, lastPurchaseDate: last.date, lastQuantity: last.quantity || 1, invalidEntries: invalid.length };
  }

  // Rohintervalle, jeweils normiert auf die gekaufte Menge:
  // 2 Liter Milch in 12 Tagen = 6 Tage pro Einheit.
  const rawIntervals = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    const qty = sorted[i - 1].quantity || 1;
    const perUnit = gap / qty;
    // Sicherheitsnetz: nur endliche, nicht-negative Werte verwenden
    if (!Number.isFinite(perUnit) || perUnit < 0) continue;
    rawIntervals.push({ gap, perUnit, from: sorted[i - 1].date, to: sorted[i].date });
  }
  if (rawIntervals.length === 0) {
    return { ...empty, lastPurchaseDate: last.date, lastQuantity: last.quantity || 1, invalidEntries: invalid.length };
  }

  // Erste grobe Schätzung, um Pausen überhaupt erkennen zu können
  const roughMedian = median(rawIntervals.map((r) => r.perUnit));

  // Pausen aussortieren, aber protokollieren
  const pauses = [];
  const usable = rawIntervals.filter((r) => {
    if (roughMedian && r.perUnit > roughMedian * PAUSE_FACTOR) {
      pauses.push({ from: r.from, to: r.to, days: r.gap });
      return false;
    }
    return true;
  });

  const working = usable.length >= 2 ? usable : rawIntervals; // nie alles wegfiltern
  const perUnitValues = working.map((r) => r.perUnit);

  const perUnitDays = median(perUnitValues);
  const lastQuantity = last.quantity || 1;
  // Der ausgegebene Rhythmus bezieht sich auf die zuletzt gekaufte Menge
  const rhythmDays = perUnitDays !== null ? Math.max(1, Math.round(perUnitDays * lastQuantity)) : null;

  // Vertrauen: genug Datenpunkte UND geringe robuste Streuung
  const dispersion = mad(perUnitValues);
  const relativeDispersion = perUnitDays > 0 && dispersion !== null ? dispersion / perUnitDays : 1;
  const sampleFactor = Math.min(1, working.length / MIN_INTERVALS_FULL_CONFIDENCE);
  const stabilityFactor = Math.max(0, 1 - relativeDispersion * 1.5);
  const confidence = Math.round(sampleFactor * stabilityFactor * 100) / 100;

  // Trend: jüngere Hälfte gegen ältere Hälfte
  let trend = "unbekannt";
  if (working.length >= MIN_INTERVALS_FOR_TREND) {
    const half = Math.floor(working.length / 2);
    const older = median(perUnitValues.slice(0, half));
    const newer = median(perUnitValues.slice(half));
    if (older && newer) {
      const change = (newer - older) / older;
      if (change > 0.25) trend = "seltener";
      else if (change < -0.25) trend = "haeufiger";
      else trend = "stabil";
    }
  }

  return {
    rhythmDays, confidence, sampleSize: working.length,
    lastPurchaseDate: last.date, lastQuantity,
    pauses, trend, perUnitDays: perUnitDays !== null ? Math.round(perUnitDays * 10) / 10 : null,
    invalidEntries: invalid.length
  };
}

/** Rhythmen für alle Produkte eines Haushalts. */
function computeAllRhythms(history) {
  const byProduct = new Map();
  for (const entry of history) {
    if (!byProduct.has(entry.productId)) byProduct.set(entry.productId, []);
    byProduct.get(entry.productId).push(entry);
  }
  const out = new Map();
  for (const [productId, purchases] of byProduct.entries()) {
    out.set(productId, computeRhythm(purchases));
  }
  return out;
}

module.exports = { computeRhythm, computeAllRhythms, daysBetween, isValidDate, median, mad, PAUSE_FACTOR };
