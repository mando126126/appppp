/**
 * intervalTracker.js — zeitbasierter Austausch
 * ================================================================
 * Zahnbürste, Küchenschwamm, Wasserfilter: ersetzt wird nach Zeit,
 * unabhängig von der verbrauchten Menge. Meist hygienisch begründet.
 *
 * Das ist die Klasse mit dem schnellsten Nutzen im ganzen Modell:
 * kein Verbrauchsmodell, kein Lernen, keine Historie. Kaufdatum plus
 * Intervall genügt, und die App weiß etwas, an das von selbst niemand
 * denkt — nach drei Monaten fällt keine Zahnbürste durch Nachdenken
 * auf.
 *
 * Das Ergebnis sind HANDLUNGEN, keine Käufe: „getauscht" setzt den
 * Zähler zurück, ohne dass etwas gekauft wurde. Wer eine Packung mit
 * vier Aufsteckbürsten kauft, tauscht viermal aus einem Kauf.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { nonFoodFor, appliesTo, CLASS, HARDNESS_FACTOR } = require("./nonFoodCatalog");
const { daysBetween } = require("./rhythmEngine2");

/** Intervall eines Produkts, ggf. an die Wasserhärte angepasst. */
function intervalFor(productId, profile = {}) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.INTERVAL) return null;
  const factor = e.hardnessSensitive
    ? (HARDNESS_FACTOR[profile.waterHardness] || 1)
    : 1;
  return Math.max(1, Math.round(e.replacementIntervalDays * factor));
}

/**
 * Fälligkeit eines Austausch-Produkts.
 * @param {object} entry  { productId, lastSwap, purchases }
 * @param {string} today
 * @param {object} profile
 * @param {number} pausedDays  Urlaubstage, sofern das Produkt pausiert
 */
function swapStatus(entry, today, profile = {}, pausedDays = 0) {
  const e = nonFoodFor(entry.productId);
  const p = byId(entry.productId);
  if (!e || !p || e.consumptionClass !== CLASS.INTERVAL) return null;
  if (!appliesTo(entry.productId, profile)) return null;

  // Bezugspunkt ist der letzte Tausch, ersatzweise der letzte Kauf.
  const purchases = (entry.purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastPurchase = purchases.length ? purchases[purchases.length - 1].date : null;
  const since = entry.lastSwap || lastPurchase;
  if (!since) return null;

  const interval = intervalFor(entry.productId, profile);

  // Eine Zahnbürste altert auch im Urlaub — sie wird mitgenommen.
  // Ein Küchenschwamm liegt trocken und altert nicht. Deshalb steht
  // `pausesOnVacation` am Produkt und nicht am Modus.
  const paused = e.pausesOnVacation ? Math.max(0, pausedDays) : 0;
  const inUse = Math.max(0, daysBetween(since, today) - paused);
  const daysLeft = interval - inUse;

  return {
    productId: p.id,
    name: p.name,
    consumptionClass: CLASS.INTERVAL,
    since,
    fromSwap: !!entry.lastSwap,
    inUse,
    intervalDays: interval,
    baseIntervalDays: e.replacementIntervalDays,
    hardnessAdjusted: e.hardnessSensitive && interval !== e.replacementIntervalDays,
    source: e.intervalSource,
    daysLeft,
    due: daysLeft <= 0,
    soon: daysLeft > 0 && daysLeft <= 7,
    pausesOnVacation: e.pausesOnVacation,
    pausedDays: paused,
    message: daysLeft <= 0
      ? `${p.name} seit ${inUse} Tagen im Einsatz — tauschen.`
      : `${p.name} fällig in ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tagen"}.`
  };
}

/** Alle Austausch-Produkte, das Überfälligste zuerst. */
function dueSwaps(entries, today, profile = {}, pausedDays = 0) {
  const out = [];
  for (const entry of entries) {
    const s = swapStatus(entry, today, profile, entry.pausedDays ?? pausedDays);
    if (s) out.push(s);
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Nach dem Tausch: neuer Bezugspunkt. Reine Funktion, damit der Aufrufer
 * entscheidet, wann gespeichert wird.
 */
function recordSwap(entry, today) {
  return { ...entry, lastSwap: today };
}

/**
 * Braucht der Haushalt Nachschub? Ein Tausch verbraucht ein Stück aus
 * der Packung — bei vier Aufsteckbürsten reicht ein Kauf für vier
 * Tauschvorgänge.
 */
function needsRestock(entry, today, profile = {}) {
  const e = nonFoodFor(entry.productId);
  if (!e || e.consumptionClass !== CLASS.INTERVAL) return false;

  const purchases = (entry.purchases || []).filter((x) => x.date && x.date <= today);
  if (!purchases.length) return false;

  const packSize = e.package.value || 1;
  const bought = purchases.reduce((a, r) => a + packSize * (Number(r.quantity) || 1), 0);
  const swaps = (entry.swaps || []).filter((d) => d <= today).length;
  return bought - swaps <= 0;
}

module.exports = { intervalFor, swapStatus, dueSwaps, recordSwap, needsRestock };
