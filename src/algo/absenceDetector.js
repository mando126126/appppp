/**
 * absenceDetector.js — Abwesenheit aus den Bons erkennen
 * ================================================================
 * Der Rhythmus misst Kalendertage zwischen zwei Käufen. Ein Haushalt
 * verbraucht aber keine Kalendertage, sondern Anwesenheitstage. Wer
 * zwei Wochen weg ist, hat danach einen Kaufabstand von 24 statt 10
 * Tagen — und die App lernt daraus, dass zehn Tage falsch waren.
 *
 * `rhythmEngine2` hat dagegen eine Pausenerkennung: Abstände über dem
 * Dreifachen des Medians fliegen raus. Die greift bei kurzen Rhythmen
 * (14 Tage Urlaub sind das Fünffache eines Drei-Tage-Rhythmus) und
 * greift NICHT bei mittleren (dieselben 14 Tage sind das Doppelte
 * eines Zehn-Tage-Rhythmus). Genau dort entsteht der Schaden.
 *
 * Was in der Drei-Jahres-Simulation dabei herauskam: nach jedem
 * Urlaub verlängerten sich die mittleren Rhythmen, die App schlug
 * wochenlang zu spät vor, und die Trefferquote fiel von 80 % auf
 * 44 %. Der Haushalt stand mit leerem Kühlschrank da — ausgerechnet
 * in den Wochen nach der Rückkehr, in denen ohnehin nichts da ist.
 *
 * DER BESSERE UMGANG: Abstände NICHT wegwerfen, sondern korrigieren.
 * Ein Kaufabstand von 24 Tagen mit 14 Tagen Abwesenheit ist ein
 * Abstand von 10 Verbrauchstagen. Das erhält den Datenpunkt, statt
 * ihn zu verlieren.
 *
 * WORAN MAN EINE ABWESENHEIT ERKENNT: nicht daran, dass ein einzelnes
 * Produkt lange nicht gekauft wurde — das kann auch heißen, dass es
 * nicht mehr gebraucht wird. Sondern daran, dass GAR NICHT eingekauft
 * wurde. Eine Lücke in den Bons betrifft den ganzen Haushalt und ist
 * damit die belastbarere Aussage.
 * ================================================================
 */

const { daysBetween } = require("./rhythmEngine2");

const MIN_ABSENCE_DAYS = 6;      // ein langes Wochenende ist keine Abwesenheit
const GAP_FACTOR = 3;            // Vielfaches des üblichen Einkaufsabstands
const MIN_SHOPPING_DAYS = 8;     // darunter gibt es keinen üblichen Abstand
const MAX_ABSENCE_DAYS = 90;     // darüber ist es keine Reise, sondern ein Umzug
// Eine noch laufende Lücke — der letzte Einkauf ist lange her und es
// kam noch keiner danach. Sie zählt kürzer als eine abgeschlossene,
// weil sie zweideutig ist: „gerade aus dem Urlaub zurück" und „die
// App seit Wochen nicht mehr benutzt" sehen von hier aus gleich aus.
// Drei Wochen decken jede Reise ab und nicht das Aufgeben.
const MAX_OPEN_ABSENCE_DAYS = 21;

const shift = (dateStr, n) =>
  new Date(new Date(dateStr + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

function medianGap(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Abwesenheiten aus den Einkaufstagen ableiten.
 *
 * @param {Array} receipts [{date}]
 * @param {string} today
 * @returns {Array} [{from, to, days, reason}] — der INNERE Zeitraum,
 *   also ohne die beiden Einkaufstage, die ihn begrenzen.
 */
function detectAbsences(receipts, today) {
  const days = [...new Set((receipts || [])
    .filter((r) => r && r.date && r.date <= today)
    .map((r) => r.date))].sort();

  if (days.length < MIN_SHOPPING_DAYS) return [];

  const gaps = [];
  for (let i = 1; i < days.length; i++) gaps.push(daysBetween(days[i - 1], days[i]));

  const usual = medianGap(gaps);
  if (!usual || usual <= 0) return [];

  const threshold = Math.max(MIN_ABSENCE_DAYS, usual * GAP_FACTOR);

  const out = [];
  for (let i = 1; i < days.length; i++) {
    const gap = gaps[i - 1];
    if (gap < threshold || gap > MAX_ABSENCE_DAYS) continue;
    // Die Einkaufstage selbst gehören nicht zur Abwesenheit — an
    // ihnen war jemand da. Gezählt wird, was dazwischen liegt, und
    // davon nur der Teil, der über den üblichen Abstand hinausgeht.
    const extra = Math.round(gap - usual);
    if (extra < MIN_ABSENCE_DAYS) continue;
    out.push({
      from: shift(days[i - 1], 1),
      to: shift(days[i], -1),
      days: extra,
      gap,
      usual: Math.round(usual * 10) / 10,
      reason: "keine_einkaeufe"
    });
  }

  // Die noch offene Lücke am Ende: seit dem letzten Einkauf ist zu
  // viel Zeit vergangen. Ohne sie meldet die App jemandem, der gerade
  // aus dem Urlaub kommt und noch nicht einkaufen war, dass sein
  // Zähler bei null steht — im unpassendsten Moment.
  const lastDay = days[days.length - 1];
  const open = daysBetween(lastDay, today);
  if (open >= threshold) {
    const extra = Math.min(MAX_OPEN_ABSENCE_DAYS, Math.round(open - usual));
    if (extra >= MIN_ABSENCE_DAYS) {
      out.push({
        from: shift(lastDay, 1),
        to: shift(lastDay, 1 + extra),
        days: extra,
        gap: open,
        usual: Math.round(usual * 10) / 10,
        reason: "noch_offen"
      });
    }
  }

  return out;
}

/** Eine bekannte Abwesenheit (Urlaubsmodus) in dieselbe Form bringen. */
function knownAbsence(vacation, today) {
  if (!vacation || !vacation.from || !vacation.to) return [];
  const from = vacation.from;
  const to = vacation.to < today ? vacation.to : today;
  if (from >= to) return [];
  const days = daysBetween(from, to);
  if (days < MIN_ABSENCE_DAYS) return [];
  return [{ from, to, days, gap: days, usual: null, reason: "urlaubsmodus" }];
}

/**
 * Abwesenheitstage, die in einen Zeitraum fallen.
 * Überlappungen werden nicht doppelt gezählt.
 */
function absenceDaysBetween(absences, fromDate, toDate) {
  if (!absences || !absences.length || !fromDate || !toDate) return 0;

  const spans = absences
    .map((a) => ({
      from: a.from > fromDate ? a.from : fromDate,
      to: a.to < toDate ? a.to : toDate
    }))
    .filter((a) => a.from < a.to)
    .sort((a, b) => a.from.localeCompare(b.from));

  let total = 0;
  let cursor = null;
  for (const s of spans) {
    const start = cursor && cursor > s.from ? cursor : s.from;
    if (start >= s.to) continue;
    total += daysBetween(start, s.to);
    cursor = s.to;
  }
  return total;
}

/** Alle Abwesenheiten: erkannte und ausdrücklich eingetragene. */
function allAbsences(receipts, vacation, today) {
  return [...detectAbsences(receipts, today), ...knownAbsence(vacation, today)];
}

module.exports = {
  detectAbsences, knownAbsence, absenceDaysBetween, allAbsences,
  MIN_ABSENCE_DAYS, GAP_FACTOR, MIN_SHOPPING_DAYS, MAX_ABSENCE_DAYS, MAX_OPEN_ABSENCE_DAYS
};
