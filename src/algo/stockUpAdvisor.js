/**
 * stockUpAdvisor.js — Bevorratung bei gutem Preis
 * ================================================================
 * Non-Food verdirbt nicht: Vorrat bei gutem Preis ist rational, aber
 * durch Lagerplatz und Kapitalbindung begrenzt. Sinnvolle Zielgröße
 * ist der eigene Aktionszyklus — so viel, dass es bis zum nächsten
 * günstigen Angebot reicht, nicht mehr.
 *
 * BEWUSSTE ZURÜCKHALTUNG: Ein Vorschlag zum Mehrkauf setzt eine
 * GELERNTE Verbrauchsrate voraus. Ein Vorratsstapel, der nach vierzehn
 * Monaten noch steht, ist ein Vertrauensverlust und genau das
 * Gegenteil des Produktversprechens. Im Zweifel schweigt die App.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { nonFoodFor, CLASS } = require("./nonFoodCatalog");
const { basePrice, pricePercentile } = require("./basePrice");
const { dailyUsage } = require("./consumptionModel");
const { CONFIDENCE } = require("./rateLearner");
const { daysBetween } = require("./rhythmEngine2");

const MIN_CYCLE_POINTS = 6;   // darunter der Vorgabewert statt eines gelernten

/**
 * Aktionszyklus aus der eigenen Grundpreishistorie: mittlerer Abstand
 * zwischen lokalen Minima. Erst ab sechs Datenpunkten.
 */
function learnPromoCycle(productId, history) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  const points = (history || [])
    .map((h) => ({ date: h.date, bp: basePrice(productId, h.price, h.packageValue, h.quantity) }))
    .filter((x) => x.date && x.bp)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < MIN_CYCLE_POINTS) {
    return { days: e.promoCycleDaysDefault, learned: false, points: points.length };
  }

  const minima = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].bp.value < points[i - 1].bp.value && points[i].bp.value <= points[i + 1].bp.value) {
      minima.push(points[i].date);
    }
  }
  if (minima.length < 2) {
    return { days: e.promoCycleDaysDefault, learned: false, points: points.length };
  }

  const gaps = [];
  for (let i = 1; i < minima.length; i++) gaps.push(daysBetween(minima[i - 1], minima[i]));
  const mean = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);

  return { days: Math.max(7, mean), learned: true, points: points.length, minima: minima.length };
}

/**
 * Bevorratungsempfehlung.
 * @param {object} supply   Ergebnis aus consumptionModel.supplyFor
 * @param {object} opts     { history, currentPrice, currentPackage, profile, storageLimit }
 * @returns {null|{units, targetDays, reason, percentile, message}}
 */
function stockUpAdvice(supply, opts = {}) {
  if (!supply || supply.consumptionClass !== CLASS.RATE) return null;

  const e = nonFoodFor(supply.productId);
  const p = byId(supply.productId);
  if (!e || !p) return null;

  // Ohne gelernte Rate kein Mehrkauf-Vorschlag. Das ist die wichtigste
  // Bremse in diesem Modul.
  if (supply.confidence !== CONFIDENCE.GELERNT) {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "rate_unsicher",
      message: "Für einen Vorratskauf ist der Verbrauch noch nicht sicher genug gelernt."
    };
  }

  const current = basePrice(supply.productId, opts.currentPrice, opts.currentPackage);
  if (!current) return null;

  const pct = pricePercentile(supply.productId, current.value, opts.history || []);
  if (!pct || pct.percentile === null) {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "preis_unbekannt", percentile: null,
      message: pct ? pct.message : "Noch keine Preishistorie."
    };
  }
  if (pct.verdict !== "günstig") {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "preis_normal", percentile: pct.percentile,
      message: pct.message
    };
  }

  const cycle = learnPromoCycle(supply.productId, opts.history || []);
  const usage = supply.dailyUsage || dailyUsage(supply.productId, opts.profile || {});
  if (!usage || usage <= 0) return null;

  const packageValue = Number(opts.currentPackage) || e.package.value;
  const need = cycle.days * usage - (supply.remaining || 0);
  const raw = Math.ceil(need / packageValue);
  const limit = Number.isFinite(opts.storageLimit) ? opts.storageLimit : e.storageLimitDefault;
  const units = Math.min(Math.max(raw, 0), limit);

  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";
  return {
    productId: supply.productId,
    name: p.name,
    units,
    targetDays: cycle.days,
    cycleLearned: cycle.learned,
    storageLimit: limit,
    cappedByLimit: raw > limit,
    percentile: pct.percentile,
    reason: units > 0 ? "guenstig" : "vorrat_reicht",
    message: units > 0
      ? `${units} ${units === 1 ? "Packung" : "Packungen"} decken ${cycle.days} Tage — ` +
        `${eur(current.value)} je ${current.label} statt ${eur(pct.median)}.`
      : `Preis ist günstig, aber dein Vorrat reicht noch über den Aktionszyklus.`
  };
}

module.exports = { stockUpAdvice, learnPromoCycle, MIN_CYCLE_POINTS };
