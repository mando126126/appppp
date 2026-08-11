/**
 * weeklyReview.js — der Wochenrückblick
 * ================================================================
 * „Diese Woche: 3 Produkte gerettet, 4,20 € günstiger als üblich,
 *  Zahnbürste getauscht.“
 *
 * Das Modul rechnet nichts Neues aus. Es liest das Ereignis-
 * Protokoll und die Bons und fasst zusammen, was ohnehin schon da
 * ist. Genau deshalb kostet es fast nichts und ist trotzdem der
 * Grund, die App am Sonntagabend zu öffnen.
 *
 * DREI REGELN, DAMIT DER RÜCKBLICK NICHT ZUR WERBUNG WIRD:
 *
 *   1. Nur Zeilen mit Inhalt. Eine Woche ohne Austausch zeigt keine
 *      Austausch-Zeile mit einer Null. Ein Rückblick, der immer
 *      gleich lang ist, wird nicht gelesen.
 *   2. Geschätzt und gemessen bleiben getrennt. „Gerettet“ ist eine
 *      Schätzung des abgewendeten Verlusts, „günstiger als üblich“
 *      ist nachrechenbar. Eine Summe aus beidem wäre eine Zahl ohne
 *      Bedeutung.
 *   3. Eine ruhige Woche ist keine schlechte Woche. Wer nichts
 *      erfasst hat, bekommt keine Ermahnung, sondern einen Satz,
 *      der das feststellt und gut ist.
 *
 * Der Rückblick ist ab Sonntagabend fällig und bleibt bis Dienstag
 * abrufbar — sonst verpasst ihn jeder, der sonntags nicht ans Handy
 * geht. Ab Montag bezieht er sich auf die abgeschlossene Vorwoche.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");
const { actionsInRange, sumEuros, ACTION } = require("./activityLog");
const { isoWeekKey, mondayOf, weekShift } = require("./streakTracker");

const REVIEW_WEEKDAY = 0;      // Sonntag (getUTCDay)
const REVIEW_HOUR = 17;        // ab 17 Uhr — der Abend ist gemeint
const REVIEW_GRACE_DAYS = 2;   // Montag und Dienstag noch nachholbar
const COMPARE_WEEKS = 12;      // Vergleichszeitraum für den Schnitt
const MIN_WEEKS_FOR_COMPARE = 3;

const money = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";
const weekdayOfDate = (d) => new Date(d + "T12:00:00Z").getUTCDay();

/**
 * Welcher Zeitraum ist gerade gemeint?
 *
 * @returns {{weekKey, from, to, complete, label}}
 */
function weekRangeFor(dateStr, offset = 0) {
  const monday = weekShift(mondayOf(dateStr), offset);
  const sunday = weekShift(monday, 1);
  const to = offset < 0 ? new Date(new Date(sunday + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10) : dateStr;
  return {
    weekKey: isoWeekKey(monday),
    from: monday,
    to,
    complete: offset < 0 || weekdayOfDate(dateStr) === REVIEW_WEEKDAY,
    label: offset < 0 ? "Vorige Woche" : "Diese Woche"
  };
}

/**
 * Ist der Rückblick jetzt fällig — und für welche Woche?
 *
 * @param {string} today
 * @param {number} hour Stunde im Ortszeitsystem des Geräts
 * @returns {null|{weekKey, from, to, complete, label}}
 */
function reviewDue(today, hour = 20) {
  const wd = weekdayOfDate(today);
  if (wd === REVIEW_WEEKDAY) {
    return hour >= REVIEW_HOUR ? weekRangeFor(today, 0) : null;
  }
  // Montag = 1, Dienstag = 2 — die Vorwoche ist da abgeschlossen.
  if (wd >= 1 && wd <= REVIEW_GRACE_DAYS) return weekRangeFor(today, -1);
  return null;
}

/** Wochensummen der Bons, jüngste zuerst. */
function weeklySpends(receipts, today, weeks = COMPARE_WEEKS) {
  const byWeek = new Map();
  (receipts || []).forEach((r) => {
    if (!r || !r.date || r.date > today) return;
    if (daysBetween(r.date, today) > weeks * 7) return;
    const wk = isoWeekKey(r.date);
    byWeek.set(wk, (byWeek.get(wk) || 0) + (Number(r.total) || 0));
  });
  return byWeek;
}

function medianOfNumbers(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Der Rückblick für einen Zeitraum.
 *
 * @param {{actions, receipts}} data
 * @param {{weekKey, from, to, complete, label}} range aus weekRangeFor
 * @returns {object}
 */
function weeklyReview(data, range) {
  const actions = actionsInRange(data.actions || [], range.from, range.to);
  const receipts = (data.receipts || []).filter((r) => r && r.date >= range.from && r.date <= range.to);

  const rescued = actions.filter((a) => a.kind === ACTION.GERETTET);
  const cheaper = actions.filter((a) => a.kind === ACTION.GUENSTIG);
  const swaps = actions.filter((a) => a.kind === ACTION.GETAUSCHT);
  const feedback = actions.filter((a) => a.kind === ACTION.RUECKMELDUNG);

  const spend = Math.round(receipts.reduce((a, r) => a + (Number(r.total) || 0), 0) * 100) / 100;

  // Vergleich mit den eigenen Wochen — nicht mit einem Durchschnitts-
  // haushalt. Fremde Vergleichszahlen wären hier erfunden.
  const spends = weeklySpends(data.receipts, range.to);
  spends.delete(range.weekKey);
  const others = [...spends.values()].filter((v) => v > 0);
  let comparison = null;
  if (others.length >= MIN_WEEKS_FOR_COMPARE && spend > 0) {
    const med = medianOfNumbers(others);
    const delta = spend - med;
    comparison = {
      median: Math.round(med * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      weeks: others.length,
      text: Math.abs(delta) < 1
        ? "wie in deinen üblichen Wochen"
        : delta < 0
          ? `${money(-delta)} unter deinem Schnitt`
          : `${money(delta)} über deinem Schnitt`
    };
  }

  const nameOf = (pid) => { const p = byId(pid); return p ? p.name : null; };
  const swapNames = [...new Set(swaps.map((s) => nameOf(s.productId)).filter(Boolean))];
  const rescuedNames = [...new Set(rescued.map((r) => nameOf(r.productId)).filter(Boolean))];

  /* Jede Zeile trägt zwei Fassungen: `label`/`value` für das Blatt,
     `tile` für die drei Kacheln auf der Karte. Ohne die zweite stünde
     dort „1 Produkt gerettet“ neben „ca. 1,25 €“ — dieselbe Aussage
     zweimal, und auf einem schmalen Telefon in zwei Zeilen gebrochen. */
  const lines = [];
  if (rescued.length) {
    lines.push({
      key: "gerettet",
      label: rescued.length === 1 ? "1 Produkt gerettet" : `${rescued.length} Produkte gerettet`,
      value: sumEuros(rescued) > 0 ? "ca. " + money(sumEuros(rescued)) : "",
      note: rescuedNames.slice(0, 3).join(", "),
      tile: { v: String(rescued.length), l: "gerettet" },
      estimated: true
    });
  }
  if (cheaper.length) {
    lines.push({
      key: "guenstig",
      label: "Günstiger als üblich",
      value: money(sumEuros(cheaper)),
      note: `${cheaper.length} ${cheaper.length === 1 ? "Position" : "Positionen"}`,
      tile: { v: money(sumEuros(cheaper)), l: "gespart" },
      estimated: false
    });
  }
  if (swaps.length) {
    lines.push({
      key: "getauscht",
      label: swaps.length === 1 ? "1× getauscht" : `${swaps.length}× getauscht`,
      value: "",
      note: swapNames.slice(0, 3).join(", "),
      tile: { v: swaps.length + "×", l: "getauscht" },
      estimated: false
    });
  }
  if (receipts.length) {
    lines.push({
      key: "einkauf",
      label: receipts.length === 1 ? "1 Einkauf" : `${receipts.length} Einkäufe`,
      value: money(spend),
      note: comparison ? comparison.text : "",
      tile: { v: money(spend), l: receipts.length === 1 ? "1 Einkauf" : `${receipts.length} Einkäufe` },
      estimated: false
    });
  }
  if (feedback.length) {
    lines.push({
      key: "rueckmeldung",
      label: feedback.length === 1 ? "1 Rückmeldung" : `${feedback.length} Rückmeldungen`,
      value: "",
      note: "fließen in die Rhythmen ein",
      tile: { v: String(feedback.length), l: feedback.length === 1 ? "Rückmeldung" : "Rückmeldungen" },
      estimated: false
    });
  }

  const quiet = lines.length === 0;

  return {
    ...range,
    lines,
    quiet,
    spend,
    comparison,
    receipts: receipts.length,
    rescued: { count: rescued.length, euros: sumEuros(rescued), names: rescuedNames },
    cheaper: { count: cheaper.length, euros: sumEuros(cheaper) },
    swaps: { count: swaps.length, names: swapNames },
    feedback: feedback.length,
    headline: buildHeadline({ quiet, rescued, cheaper, swaps, receipts, spend, comparison }),
    // Für die Benachrichtigung: eine Zeile, kein Absatz.
    short: quiet
      ? "Ruhige Woche."
      : lines.slice(0, 3).map((l) => (l.value ? `${l.label} (${l.value})` : l.label)).join(", ")
  };
}

/** Die eine Zeile obenauf: das Stärkste, was diese Woche hergibt. */
function buildHeadline(x) {
  if (x.quiet) return "Ruhige Woche — nichts erfasst.";
  if (x.rescued.length >= 2) {
    return `${x.rescued.length} Produkte gerettet` +
      (x.rescued.length && sumEurosOf(x.rescued) > 0 ? ` — geschätzt ${money(sumEurosOf(x.rescued))} nicht in der Tonne.` : ".");
  }
  if (x.cheaper.length && sumEurosOf(x.cheaper) >= 1) {
    return `${money(sumEurosOf(x.cheaper))} günstiger eingekauft als üblich.`;
  }
  if (x.rescued.length === 1) return "Ein Produkt gerettet.";
  if (x.swaps.length) return `${x.swaps.length}× rechtzeitig getauscht.`;
  if (x.receipts.length) {
    return x.comparison && x.comparison.delta < -1
      ? `${x.receipts.length} ${x.receipts.length === 1 ? "Einkauf" : "Einkäufe"}, ${x.comparison.text}.`
      : `${x.receipts.length} ${x.receipts.length === 1 ? "Einkauf" : "Einkäufe"} für ${money(x.spend)}.`;
  }
  return "Eine Woche mit Rückmeldungen — die Rhythmen sitzen jetzt genauer.";
}

const sumEurosOf = (list) => Math.round(list.reduce((a, x) => a + (x.euros || 0), 0) * 100) / 100;

module.exports = {
  weeklyReview, reviewDue, weekRangeFor, weeklySpends,
  REVIEW_WEEKDAY, REVIEW_HOUR, REVIEW_GRACE_DAYS, COMPARE_WEEKS, MIN_WEEKS_FOR_COMPARE
};
