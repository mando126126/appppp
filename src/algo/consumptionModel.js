/**
 * consumptionModel.js — Reichweite von Haushaltsprodukten
 * ================================================================
 * Die Rechnung für `RATE`-Produkte:
 *
 *   tagesverbrauch  = rate × haushaltsgröße^alpha × härtefaktor
 *   restmenge(t)    = letzte Kaufmenge − verbrauchte Tage × verbrauch
 *   reichweite      = restmenge / tagesverbrauch
 *
 * Der Unterschied zur Lebensmittel-Bestandsschätzung ist nicht die
 * Formel, sondern die Datenlage: Non-Food verdirbt nicht, also
 * entspricht die gekaufte Menge tatsächlich der verbrauchten. Bei
 * Lebensmitteln verzerrt der Verderb genau dieses Signal.
 *
 * Die Vorwarnzeit ist NICHT konstant, sondern folgt dem gelernten
 * Einkaufsrhythmus des Haushalts. Wer alle drei Tage einkauft,
 * braucht sieben Tage Vorlauf; wer alle zwei Wochen einkauft, 23.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { nonFoodFor, appliesTo, CLASS, HARDNESS_FACTOR } = require("./nonFoodCatalog");
const { daysBetween } = require("./rhythmEngine2");

/**
 * Tagesverbrauch eines Produkts in Packungseinheiten — für den GANZEN
 * Haushalt, nicht je Person.
 *
 * `learnedRate` ist bereits eine Haushaltsrate: rateLearner beobachtet,
 * was tatsächlich gekauft wurde, und das ist der Verbrauch aller
 * Personen zusammen. Sie darf deshalb NICHT ein zweites Mal mit der
 * Haushaltsgröße multipliziert werden — genau dieser Fehler ließ in
 * einem Zweipersonenhaushalt jede Packung doppelt so schnell leer
 * erscheinen. Skaliert wird nur der Katalogwert, der pro Person gilt.
 */
function dailyUsage(productId, profile = {}, learnedRate = null) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.RATE) return null;

  if (learnedRate !== null && learnedRate > 0) {
    return Math.round(learnedRate * 1000) / 1000;
  }

  // Haushaltsgröße 0 ist kein sinnvoller Zustand, käme über eine
  // fehlerhafte Sicherung aber durch — und 0^0 wäre 1, also eine
  // stille Falschaussage statt eines Fehlers.
  const persons = Math.max(1, Number(profile.personCount) || 1);
  const scale = Math.pow(persons, e.scalingExponent);

  // Härteres Wasser heißt mehr Waschmittel je Ladung. Der Faktor
  // wirkt umgekehrt zum Entkalkungsintervall: 0,6 verkürzt dort das
  // Intervall, hier erhöht er den Verbrauch — deshalb der Kehrwert.
  const hardness = e.hardnessSensitive
    ? 1 / (HARDNESS_FACTOR[profile.waterHardness] || 1)
    : 1;

  const usage = e.baseRatePerPersonPerDay * scale * hardness;
  return usage > 0 ? Math.round(usage * 1000) / 1000 : null;
}

/**
 * Reichweite eines Produkts.
 * @param {object} entry   { productId, purchases:[{date, quantity, packageValue}] }
 * @param {string} today
 * @param {object} profile Haushaltsprofil
 * @param {object} opts    { learnedRate, confidence, pausedDays }
 */
function supplyFor(entry, today, profile = {}, opts = {}) {
  const productId = entry.productId;
  const e = nonFoodFor(productId);
  const p = byId(productId);
  if (!e || !p) return null;
  if (!appliesTo(productId, profile)) return null;

  // SPORADIC darf NIE eine Reichweite ausgeben. Lieber keine Aussage
  // als eine schlechte — das ist der Zweck dieser Klasse.
  if (e.consumptionClass === CLASS.SPORADIC) {
    return {
      productId, name: p.name, consumptionClass: e.consumptionClass,
      daysOfSupply: null, remaining: null, confidence: "UNREGELMAESSIG",
      dueForPurchase: false,
      message: `${p.name} kaufst du unregelmäßig — keine Vorhersage.`
    };
  }
  if (e.consumptionClass !== CLASS.RATE) return null;

  const purchases = (entry.purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!purchases.length) return null;

  const usage = dailyUsage(productId, profile, opts.learnedRate);
  if (!usage) return null;

  const last = purchases[purchases.length - 1];
  const packageValue = Number(last.packageValue) || e.package.value;
  const bought = packageValue * (Number(last.quantity) || 1);

  // Urlaubstage zählen nicht als Verbrauchstage.
  const elapsed = Math.max(0, daysBetween(last.date, today) - (opts.pausedDays || 0));
  const remaining = Math.max(0, bought - elapsed * usage);
  const daysOfSupply = Math.round((remaining / usage) * 10) / 10;

  const lead = leadTime(profile);
  const confidence = opts.confidence || "REFERENZ";

  return {
    productId,
    name: p.name,
    consumptionClass: e.consumptionClass,
    dailyUsage: usage,
    unit: e.package.unit,
    packageValue,
    bought,
    remaining: Math.round(remaining * 10) / 10,
    daysOfSupply,
    lastPurchase: last.date,
    leadTime: lead,
    // Bei UNSICHER wird gar nichts vorhergesagt — auch kein Nachkauf.
    dueForPurchase: confidence !== "UNSICHER" && daysOfSupply <= lead,
    confidence,
    estimated: true,
    message: confidence === "UNSICHER"
      ? `${p.name} kaufst du unregelmäßig — keine Vorhersage.`
      : daysOfSupply <= 0
        ? `${p.name} ist vermutlich leer.`
        : `${p.name} reicht noch etwa ${Math.round(daysOfSupply)} ${Math.round(daysOfSupply) === 1 ? "Tag" : "Tage"}.`
  };
}

/**
 * Vorwarnzeit aus dem eigenen Einkaufsrhythmus (§5.3).
 * Ohne gelernten Rhythmus ein Wochenrhythmus als Annahme.
 */
function leadTime(profile = {}) {
  const interval = Number(profile.shoppingIntervalDays) || 7;
  return Math.round(interval * 1.5 + 2);
}

/** Alle Haushaltsprodukte eines Haushalts auswerten. */
function supplyOverview(entries, today, profile = {}, rates = new Map()) {
  const out = [];
  for (const entry of entries) {
    const r = rates.get(entry.productId) || {};
    const s = supplyFor(entry, today, profile, {
      learnedRate: r.rate ?? null,
      confidence: r.confidence,
      pausedDays: entry.pausedDays || 0
    });
    if (s) out.push(s);
  }
  // Das Knappste zuerst; ohne Vorhersage ans Ende.
  return out.sort((a, b) => {
    if (a.daysOfSupply === null) return 1;
    if (b.daysOfSupply === null) return -1;
    return a.daysOfSupply - b.daysOfSupply;
  });
}

module.exports = { dailyUsage, supplyFor, supplyOverview, leadTime };
