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

// Anteil des Zyklus, den die Vorausschau höchstens vorwegnehmen darf.
const MAX_LOOKAHEAD_SHARE = 0.35;

/**
 * Vorausschau, auf den Zyklus des Produkts bezogen.
 *
 * Die eingestellte Vorausschau ist eine feste Zahl in Tagen — für ein
 * Produkt mit dreißigtägigem Rhythmus sind drei Tage ein Zehntel des
 * Zyklus und damit ein vernünftiger Vorlauf. Für ein Produkt mit
 * viertägigem Rhythmus sind dieselben drei Tage drei Viertel des
 * Zyklus: es steht dann ab dem Tag nach dem Kauf wieder auf der Liste.
 *
 * Das ist kein theoretisches Problem. In der Drei-Jahres-Simulation
 * war es der Auslöser einer Rückkopplung: Milch wurde bei jedem
 * Einkauf vorgeschlagen, also bei jedem Einkauf gekauft, also lag der
 * beobachtete Abstand bei der Einkaufsfrequenz, also wurde der
 * Rhythmus noch kürzer. Die App lernte am Ende ihren eigenen
 * Vorschlag statt den Bedarf des Haushalts, und der Haushalt kaufte
 * 239 von 281 Packungen Milch zu früh. Der gemessene Verderb lag
 * damit über dem eines Haushalts ganz ohne App — eine App, die
 * schadet, statt zu nützen.
 *
 * Deshalb: der Vorlauf ist ein ANTEIL des Zyklus, gedeckelt durch die
 * Einstellung. Nie mehr als ein gutes Drittel.
 */
function effectiveLookahead(rhythmDays, lookaheadDays) {
  const wish = Math.max(0, Number(lookaheadDays) || 0);
  if (!rhythmDays || !Number.isFinite(rhythmDays)) return wish;
  return Math.min(wish, Math.floor(rhythmDays * MAX_LOOKAHEAD_SHARE));
}

module.exports = {
  shoppingPattern, suggestedLookahead, effectiveLookahead,
  WEEKDAYS, MIN_RECEIPTS, MAX_LOOKAHEAD_SHARE
};
