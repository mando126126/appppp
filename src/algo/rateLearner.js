/**
 * rateLearner.js — Verbrauchsrate aus der eigenen Historie
 * ================================================================
 * Das Kaltstartproblem ist bei Haushaltsprodukten größer als bei
 * Lebensmitteln: Zahnpasta wird alle sieben Wochen gekauft, für drei
 * Datenpunkte braucht es fünf Monate. Reines Lernen aus Kaufabständen
 * ist für den Einstieg damit unbrauchbar.
 *
 * Deshalb Referenzwert als Prior, Beobachtung als Posterior:
 *
 *   rate = (w_prior × referenz + w_daten × beobachtet) / (w_prior + w_daten)
 *   w_daten = min(anzahl_käufe, 6),  w_prior = 2
 *
 * Nach sechs Käufen bestimmt die Beobachtung drei Viertel des Werts.
 * Kein externes Modell, keine Bibliothek, jeder Schritt nachrechenbar.
 *
 * Die beobachtete Rate wird über ein gleitendes Fenster gebildet, NICHT
 * über einzelne Kaufabstände: sonst zerstört jeder Vorratskauf die
 * Schätzung. Wer drei Packungen auf einmal kauft, hat nicht plötzlich
 * den dreifachen Verbrauch — er hat länger Ruhe.
 * ================================================================
 */

const { nonFoodFor, CLASS } = require("./nonFoodCatalog");
const { daysBetween } = require("./rhythmEngine2");

const WINDOW_DAYS = 180;
// Heißt nicht MIN_PURCHASES — den Namen vergibt priceMemory.js, und
// beide teilen sich im Bündel denselben Namensraum.
const MIN_PURCHASES_FOR_RATE = 2;
const W_PRIOR = 2;
const MAX_W_DATA = 6;
const VK_THRESHOLD = 0.35;     // darüber: unregelmäßig, keine Prognose

const CONFIDENCE = {
  REFERENZ: "REFERENZ",
  VORLAEUFIG: "VORLAEUFIG",
  GELERNT: "GELERNT",
  UNSICHER: "UNSICHER"
};

const CONFIDENCE_LABEL = {
  REFERENZ: "Schätzwert — noch nicht an dich angepasst",
  VORLAEUFIG: "Vorläufig",
  GELERNT: "Aus deinen Käufen gelernt",
  UNSICHER: "Du kaufst das unregelmäßig"
};

/** Variationskoeffizient der Kaufabstände: Streuung geteilt durch Mittel. */
function variationCoefficient(intervals) {
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return 0;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Rate für ein Produkt.
 * @param {string} productId
 * @param {Array}  purchases [{date, quantity, packageValue}]
 * @param {string} today
 * @param {object} profile   Haushaltsprofil (nur für den Prior)
 * @returns {{rate, confidence, label, observed, reference, purchases, vk, windowDays}}
 */
function learnRate(productId, purchases, today, profile = {}) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.RATE) return null;

  const persons = Math.max(1, Number(profile.personCount) || 1);
  // Der Prior ist die Referenzrate FÜR DIESEN HAUSHALT — sonst
  // mischte man eine Pro-Kopf-Zahl mit einer Haushaltsbeobachtung.
  const reference = e.baseRatePerPersonPerDay * Math.pow(persons, e.scalingExponent);

  const rows = (purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const base = {
    productId, reference: Math.round(reference * 1000) / 1000,
    purchases: rows.length, windowDays: WINDOW_DAYS
  };

  if (rows.length < MIN_PURCHASES_FOR_RATE) {
    return {
      ...base, rate: Math.round(reference * 1000) / 1000, observed: null, vk: null,
      confidence: CONFIDENCE.REFERENZ, label: CONFIDENCE_LABEL.REFERENZ
    };
  }

  // Gleitendes Fenster: alles, was innerhalb der letzten 180 Tage
  // gekauft wurde. Der letzte Kauf zählt NICHT mit — er ist noch nicht
  // verbraucht, sonst rechnete man ihn als schon konsumiert.
  const windowStart = new Date(new Date(today + "T12:00:00Z").getTime() - WINDOW_DAYS * 86400000)
    .toISOString().slice(0, 10);
  const inWindow = rows.filter((r) => r.date >= windowStart);
  const consumed = inWindow.slice(0, -1);

  let observed = null;
  if (consumed.length >= 1) {
    const first = consumed[0].date;
    const lastDate = inWindow[inWindow.length - 1].date;
    const span = Math.max(1, daysBetween(first, lastDate));
    const amount = consumed.reduce(
      (a, r) => a + (Number(r.packageValue) || e.package.value) * (Number(r.quantity) || 1), 0);
    observed = amount / span;
  }

  const intervals = [];
  for (let i = 1; i < rows.length; i++) intervals.push(daysBetween(rows[i - 1].date, rows[i].date));
  const vk = Math.round(variationCoefficient(intervals) * 100) / 100;

  const wData = Math.min(rows.length, MAX_W_DATA);
  const rate = observed !== null && observed > 0
    ? (W_PRIOR * reference + wData * observed) / (W_PRIOR + wData)
    : reference;

  let confidence;
  if (rows.length >= 4 && vk >= VK_THRESHOLD) confidence = CONFIDENCE.UNSICHER;
  else if (rows.length >= 4) confidence = CONFIDENCE.GELERNT;
  else confidence = CONFIDENCE.VORLAEUFIG;

  return {
    ...base,
    rate: Math.round(rate * 1000) / 1000,
    observed: observed !== null ? Math.round(observed * 1000) / 1000 : null,
    vk,
    confidence,
    label: confidence === CONFIDENCE.VORLAEUFIG
      ? `Vorläufig, basiert auf ${rows.length} Käufen`
      : CONFIDENCE_LABEL[confidence]
  };
}

/** Raten für alle Produkte eines Haushalts. */
function learnAllRates(entries, today, profile = {}) {
  const out = new Map();
  for (const entry of entries) {
    const r = learnRate(entry.productId, entry.purchases, today, profile);
    if (r) out.set(entry.productId, r);
  }
  return out;
}

module.exports = {
  learnRate, learnAllRates, variationCoefficient,
  CONFIDENCE, CONFIDENCE_LABEL, WINDOW_DAYS, VK_THRESHOLD, W_PRIOR, MAX_W_DATA,
  MIN_PURCHASES_FOR_RATE
};
