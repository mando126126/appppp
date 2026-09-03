/**
 * seasonalRhythm.js — Saison aus der EIGENEN Historie
 * ================================================================
 * `seasonCalendar.js` weiß, wann Erdbeeren in Deutschland Saison
 * haben. Das ist Allgemeinwissen und beantwortet nicht die Frage, um
 * die es hier geht: kaufst DU im Sommer mehr Grillfleisch?
 *
 * Der gelernte Rhythmus ist bisher ein einziger Wert über den ganzen
 * Beobachtungszeitraum. Wer im Juli wöchentlich grillt und im Januar
 * gar nicht, bekommt das Mittel aus beidem — im Januar zu oft
 * vorgeschlagen, im Juli zu selten.
 *
 * VORSICHT IST HIER WICHTIGER ALS GENAUIGKEIT. Ein Jahresmuster aus
 * elf Monaten Daten zu lesen ist Kaffeesatz. Deshalb:
 *
 *   - mindestens 12 Monate Historie, sonst gar kein Faktor
 *   - mindestens 8 Käufe, verteilt über mindestens 6 Monate
 *   - Faktor gedeckelt auf ±35 %
 *   - Quartale statt Monate: ein einzelner Monat hat zu wenig Käufe,
 *     um ein Muster von Zufall zu unterscheiden
 *
 * Reicht die Datenlage nicht, liefert das Modul den Faktor 1 und sagt
 * warum. Kein Muster zu behaupten ist hier die richtige Antwort.
 * ================================================================
 */

const { daysBetween } = require("./rhythmEngine2");

const MIN_HISTORY_DAYS = 365;
// Heißt nicht MIN_PURCHASES_FOR_SEASON — den Namen vergibt priceMemory.js.
const MIN_PURCHASES_FOR_SEASON = 8;
const MIN_QUARTERS = 3;
const MAX_SEASONAL_ADJUST = 0.35;
// Quartale sind unterschiedlich lang (90–92 Tage). Ein festes Kaufraster
// verteilt sich darüber nie exakt gleichmäßig, und schon das ergibt
// Abweichungen um 5–8 %. Erst ab 12 % ist es ein Muster und kein
// Rechenartefakt.
const MIN_SEASONAL_SIGNAL = 0.12;

const QUARTER_NAMES = ["Winter (Jan–Mär)", "Frühjahr (Apr–Jun)", "Sommer (Jul–Sep)", "Herbst (Okt–Dez)"];

const quarterOf = (dateStr) => Math.floor(new Date(dateStr + "T12:00:00Z").getUTCMonth() / 3);

/**
 * Saisonfaktor eines Produkts für den aktuellen Zeitpunkt.
 *
 * Faktor < 1 heißt: in dieser Jahreszeit wird HÄUFIGER gekauft, der
 * Rhythmus ist also kürzer. Faktor > 1 heißt seltener.
 *
 * @returns {{factor, quarter, quarterName, applied, reason, message, byQuarter, purchases, spanDays}}
 */
function seasonalFactor(purchases, today, opts = {}) {
  const rows = (purchases || [])
    .filter((p) => p && p.date && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const quarter = quarterOf(today);
  const base = {
    factor: 1, quarter, quarterName: QUARTER_NAMES[quarter],
    applied: false, byQuarter: [], purchases: rows.length, spanDays: 0,
    reason: "zu_wenig_daten", message: null
  };

  if (rows.length < MIN_PURCHASES_FOR_SEASON) return base;

  const spanDays = daysBetween(rows[0].date, today);
  base.spanDays = spanDays;

  // Ohne ein volles Jahr gibt es kein Jahresmuster. Punkt.
  if (spanDays < MIN_HISTORY_DAYS) {
    return { ...base, reason: "unter_einem_jahr" };
  }

  // Käufe je Quartal, normiert auf die Tage, die in diesem Quartal
  // überhaupt beobachtet wurden — sonst zählt ein Quartal doppelt,
  // nur weil die Historie dort zweimal hindurchläuft.
  const counts = [0, 0, 0, 0];
  const observedDays = [0, 0, 0, 0];

  rows.forEach((p) => { counts[quarterOf(p.date)]++; });

  /* Beobachtete Tage je Quartal auszählen, Tag für Tag über den
     gesamten Zeitraum. Bei wenigen Jahren ist das billig und exakt.

     ABWESENHEITEN ZÄHLEN NICHT MIT — und das ist keine Feinheit,
     sondern der Unterschied zwischen einem Saisonmuster und dessen
     Gegenteil. Wer im Juli zwei Wochen wegfährt, kauft in diesem
     Quartal an vierzehn Tagen nichts. Die Rate „Käufe je Tag" sinkt
     dadurch, und der Sommer sieht aus wie die ruhige Jahreszeit.
     Genau das ist im Drei-Jahres-Lauf passiert, sobald dort echter
     Saisonverbrauch modelliert wurde: Salat wurde als Frühjahrs-
     produkt erkannt, weil der Sommerurlaub in seiner Hochsaison lag.

     Die Rhythmus-Berechnung rechnet Abwesenheiten längst heraus
     (`computeRhythm({absenceDays})`). Dass diese Stufe es nicht tat,
     war eine Lücke, keine Absicht — sie ist nur nie aufgefallen,
     weil in der alten Simulation niemand saisonal verbraucht hat. */
  const absences = Array.isArray(opts.absences) ? opts.absences : [];
  const abwesend = (iso) => absences.some((a) => a && a.from && a.to && iso >= a.from && iso <= a.to);

  const startMs = new Date(rows[0].date + "T12:00:00Z").getTime();
  const endMs = new Date(today + "T12:00:00Z").getTime();
  let beobachteteTage = 0;
  for (let t = startMs; t <= endMs; t += 86400000) {
    const d = new Date(t);
    if (absences.length && abwesend(d.toISOString().slice(0, 10))) continue;
    observedDays[Math.floor(d.getUTCMonth() / 3)]++;
    beobachteteTage++;
  }

  const rates = counts.map((c, i) => (observedDays[i] > 0 ? c / observedDays[i] : null));
  const active = rates.filter((r) => r !== null && r > 0);
  if (active.length < MIN_QUARTERS) {
    return { ...base, reason: "zu_wenige_quartale", byQuarter: buildByQuarter(counts, observedDays, rates) };
  }

  // Dieselbe Bereinigung für den Jahresdurchschnitt: sonst würde die
  // Saison gegen einen Durchschnitt gemessen, der die Reisetage
  // mitzählt, und jede Jahreszeit sähe geschäftiger aus als sie ist.
  const overall = rows.length / Math.max(1, beobachteteTage || spanDays);
  const here = rates[quarter];
  const byQuarter = buildByQuarter(counts, observedDays, rates);

  if (!here || here <= 0 || !overall || overall <= 0) {
    return { ...base, reason: "kein_kauf_in_dieser_saison", byQuarter };
  }

  // Häufiger gekauft = kürzerer Rhythmus. Der Faktor wirkt auf die
  // Tage, also der Kehrwert der Rate.
  const raw = overall / here;
  const clamped = Math.max(1 - MAX_SEASONAL_ADJUST, Math.min(1 + MAX_SEASONAL_ADJUST, raw));
  const percent = Math.round((clamped - 1) * 100);

  return {
    factor: Math.round(clamped * 1000) / 1000,
    quarter,
    quarterName: QUARTER_NAMES[quarter],
    applied: Math.abs(percent) >= MIN_SEASONAL_SIGNAL * 100,
    byQuarter,
    purchases: rows.length,
    spanDays,
    reason: "angewandt",
    message: Math.abs(percent) < MIN_SEASONAL_SIGNAL * 100
      ? `Kein Saisonmuster im ${QUARTER_NAMES[quarter]}.`
      : percent < 0
        ? `Im ${QUARTER_NAMES[quarter]} kaufst du das häufiger — Rhythmus um ${Math.abs(percent)} % verkürzt.`
        : `Im ${QUARTER_NAMES[quarter]} kaufst du das seltener — Rhythmus um ${percent} % verlängert.`
  };
}

function buildByQuarter(counts, observedDays, rates) {
  return counts.map((c, i) => ({
    quarter: i, name: QUARTER_NAMES[i], purchases: c,
    observedDays: observedDays[i],
    ratePerDay: rates[i] !== null ? Math.round(rates[i] * 10000) / 10000 : null
  }));
}

/** Rhythmus mit dem Saisonfaktor korrigieren. */
function applySeason(rhythm, purchases, today, opts = {}) {
  if (!rhythm || !rhythm.rhythmDays) return rhythm;
  const season = seasonalFactor(purchases, today, opts);
  if (!season.applied) return { ...rhythm, season };
  return {
    ...rhythm,
    rhythmDays: Math.max(1, Math.round(rhythm.rhythmDays * season.factor)),
    seasonBaseDays: rhythm.rhythmDays,
    season
  };
}

module.exports = {
  seasonalFactor, applySeason, quarterOf,
  QUARTER_NAMES, MIN_HISTORY_DAYS, MIN_PURCHASES_FOR_SEASON, MIN_QUARTERS,
  MAX_SEASONAL_ADJUST, MIN_SEASONAL_SIGNAL
};
