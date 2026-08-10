/**
 * shoppingDay.js — der eigene Einkaufsrhythmus
 * ================================================================
 * Die App lernt Produktrhythmen. Der Haushalt hat aber auch einen
 * eigenen: die meisten kaufen an denselben Wochentagen. Daraus
 * folgt, welcher Tag als nächstes dran ist — und damit, wie weit
 * die Liste vorausschauen muss.
 *
 * Reine Auszählung über die Bontage, kein Modell. Bei zu wenig
 * Historie gibt es kein Ergebnis statt eines geratenen.
 * ================================================================
 */

const { daysBetween } = require("./rhythmEngine2");

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MIN_RECEIPTS = 6;

const weekdayIndex = (dateStr) => new Date(dateStr + "T12:00:00Z").getUTCDay();

/**
 * @param {Array} receipts [{date, total}]
 * @param {string} today
 * @returns {null|{favouriteDay, dayName, share, trips, perWeek, avgBasket, nextDay, daysUntilNext, byWeekday, message}}
 */
function shoppingPattern(receipts, today) {
  const days = [...new Set(receipts.map((r) => r.date))].sort();
  if (days.length < MIN_RECEIPTS) return null;

  const counts = new Array(7).fill(0);
  days.forEach((d) => { counts[weekdayIndex(d)]++; });

  const favourite = counts.indexOf(Math.max(...counts));
  const share = counts[favourite] / days.length;

  const span = Math.max(1, daysBetween(days[0], days[days.length - 1]));
  const perWeek = Math.round((days.length / (span / 7)) * 10) / 10;

  const totals = receipts.reduce((a, r) => a + (r.total || 0), 0);
  const avgBasket = Math.round((totals / receipts.length) * 100) / 100;

  // Nächster Vorkommen des Lieblingstags, heute eingeschlossen.
  const todayIdx = weekdayIndex(today);
  const daysUntilNext = (favourite - todayIdx + 7) % 7;

  const byWeekday = counts.map((count, i) => ({
    day: i, name: WEEKDAYS[i], count,
    share: Math.round((count / days.length) * 100)
  }));

  // Ein Lieblingstag ist nur einer, wenn er sich abhebt. Bei sieben
  // gleich verteilten Tagen wäre jeder „der Tag" — das ist keine Aussage.
  const distinct = share >= 0.28;

  return {
    favouriteDay: distinct ? favourite : null,
    dayName: distinct ? WEEKDAYS[favourite] : null,
    share: Math.round(share * 100) / 100,
    trips: days.length,
    perWeek,
    avgBasket,
    nextDay: distinct ? WEEKDAYS[favourite] : null,
    daysUntilNext: distinct ? daysUntilNext : null,
    byWeekday,
    message: distinct
      ? (daysUntilNext === 0
          ? `Heute ist dein üblicher Einkaufstag.`
          : `Du kaufst meist ${WEEKDAYS[favourite]}s — das ist in ${daysUntilNext} ${daysUntilNext === 1 ? "Tag" : "Tagen"}.`)
      : `Du kaufst etwa ${perWeek}× pro Woche, ohne festen Tag.`
  };
}

/**
 * Empfohlene Vorausschau: so viele Tage, wie bis zum nächsten
 * üblichen Einkauf vergehen. Ohne erkennbaren Tag der übliche
 * Abstand zwischen zwei Einkäufen.
 */
function suggestedLookahead(pattern) {
  if (!pattern) return null;
  if (pattern.daysUntilNext !== null) return Math.max(1, pattern.daysUntilNext);
  return Math.max(1, Math.round(7 / Math.max(0.5, pattern.perWeek)));
}

module.exports = { shoppingPattern, suggestedLookahead, WEEKDAYS, MIN_RECEIPTS };
