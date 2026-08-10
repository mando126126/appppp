/**
 * changeDetector.js — Strukturbruch im Kaufverhalten
 * ================================================================
 * Ein Mitbewohner zieht aus. Ein Kind kommt in die Kita. Jemand
 * hört auf, Kaffee zu trinken. In allen drei Fällen ändert sich der
 * Verbrauch nicht allmählich, sondern von einem Tag auf den anderen —
 * und der Median über sechs Monate mittelt diesen Bruch weg. Die App
 * braucht danach Monate, um aufzuholen, und liegt die ganze Zeit
 * daneben.
 *
 * `rhythmEngine2` hat bereits eine Trenderkennung. Sie meldet, DASS
 * sich etwas verschoben hat, rechnet aber weiter mit allen Daten.
 * Dieses Modul beantwortet die andere Frage: AB WANN gilt das Neue?
 *
 * Verfahren: für jeden möglichen Trennpunkt die Mediane davor und
 * danach vergleichen und den Punkt mit dem größten Unterschied
 * suchen. Kein Modell, keine Bibliothek — dieselbe robuste Statistik
 * wie im Rest des Systems.
 *
 * ZURÜCKHALTUNG IST HIER ENTSCHEIDEND. Einen Bruch zu behaupten, wo
 * keiner ist, verwirft gute Daten und macht die Vorhersage schlechter.
 * Deshalb: genug Punkte auf beiden Seiten, deutlicher Unterschied,
 * und die Änderung muss nach dem Bruch ANHALTEN — ein einzelner
 * Ausreißer ist kein Strukturbruch, sondern genau das, wogegen der
 * Median ohnehin schützt.
 * ================================================================
 */

const { daysBetween, median } = require("./rhythmEngine2");

const MIN_SIDE = 3;              // Intervalle je Seite
const MIN_RELATIVE_CHANGE = 0.4; // unter 40 % ist es Rauschen
const MIN_AGE_DAYS = 14;         // ein Bruch von gestern ist eine Vermutung
const MAX_LOOKBACK_DAYS = 540;

/**
 * Bruchpunkt in einer Kaufreihe suchen.
 *
 * @param {Array} purchases [{date, quantity}]
 * @param {string} today
 * @returns {{found, date, index, before, after, changePercent, direction, intervals, message}}
 */
function detectChange(purchases, today) {
  const rows = (purchases || [])
    .filter((p) => p && p.date && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((p) => daysBetween(p.date, today) <= MAX_LOOKBACK_DAYS);

  const none = {
    found: false, date: null, index: null,
    before: null, after: null, changePercent: 0,
    direction: null, intervals: 0, message: null, reason: "zu_wenig_daten"
  };

  if (rows.length < MIN_SIDE * 2 + 1) return none;

  // Abstände je Einheit — dieselbe Bezugsgröße wie im Rhythmusmodell,
  // sonst liest sich ein Vorratskauf als Verhaltensänderung.
  const intervals = [];
  for (let i = 1; i < rows.length; i++) {
    const gap = daysBetween(rows[i - 1].date, rows[i].date);
    const qty = Math.max(1, Number(rows[i - 1].quantity) || 1);
    intervals.push({ perUnit: gap / qty, date: rows[i].date });
  }
  if (intervals.length < MIN_SIDE * 2) return { ...none, intervals: intervals.length };

  let best = null;
  for (let split = MIN_SIDE; split <= intervals.length - MIN_SIDE; split++) {
    const before = median(intervals.slice(0, split).map((x) => x.perUnit));
    const after = median(intervals.slice(split).map((x) => x.perUnit));
    if (!before || !after || before <= 0) continue;

    const change = Math.abs(after - before) / before;
    // Bei gleichwertigen Trennpunkten gewinnt der SPÄTERE. Der Median
    // verträgt bis zur Hälfte alte Werte im „danach“-Block, ohne dass
    // sich das Änderungsmaß bewegt — die Trennung ist dann mehrdeutig,
    // und mit „größer“ landete man systematisch zu früh. Gemeldet würde
    // ein Datum, an dem das alte Verhalten noch galt.
    if (!best || change > best.change + 1e-9 || Math.abs(change - best.change) <= 1e-9) {
      best = { split, before, after, change, date: intervals[split].date };
    }
  }

  if (!best) return { ...none, intervals: intervals.length, reason: "kein_trennpunkt" };

  const ageDays = daysBetween(best.date, today);

  if (best.change < MIN_RELATIVE_CHANGE) {
    return {
      ...none, intervals: intervals.length,
      changePercent: Math.round(best.change * 100),
      reason: "unter_schwelle"
    };
  }
  // Ein Bruch, der erst gestern lag, ist noch nicht bestätigt. Erst
  // wenn das neue Verhalten eine Weile anhält, ist es eines.
  if (ageDays < MIN_AGE_DAYS) {
    return {
      ...none, intervals: intervals.length,
      changePercent: Math.round(best.change * 100),
      reason: "zu_frisch"
    };
  }

  const direction = best.after > best.before ? "seltener" : "haeufiger";
  const percent = Math.round(((best.after - best.before) / best.before) * 100);

  return {
    found: true,
    date: best.date,
    index: best.split,
    before: Math.round(best.before * 10) / 10,
    after: Math.round(best.after * 10) / 10,
    changePercent: percent,
    direction,
    intervals: intervals.length,
    ageDays,
    reason: "erkannt",
    message: direction === "seltener"
      ? `Seit ${formatDate(best.date)} kaufst du das seltener — alle ${Math.round(best.after)} statt alle ${Math.round(best.before)} Tage.`
      : `Seit ${formatDate(best.date)} kaufst du das häufiger — alle ${Math.round(best.after)} statt alle ${Math.round(best.before)} Tage.`
  };
}

const formatDate = (d) => {
  const [y, m, dd] = String(d).split("-");
  return `${dd}.${m}.${y}`;
};

/**
 * Käufe ab dem Bruchpunkt. Ohne erkannten Bruch bleibt alles.
 *
 * Ein Puffer von einem Kauf VOR dem Bruch bleibt stehen, damit der
 * erste Abstand nach dem Bruch überhaupt berechenbar ist.
 */
function purchasesSinceChange(purchases, change) {
  if (!change || !change.found) return purchases;
  const rows = [...(purchases || [])].sort((a, b) => a.date.localeCompare(b.date));
  const idx = rows.findIndex((p) => p.date >= change.date);
  if (idx <= 0) return rows;
  return rows.slice(Math.max(0, idx - 1));
}

module.exports = {
  detectChange, purchasesSinceChange,
  MIN_SIDE, MIN_RELATIVE_CHANGE, MIN_AGE_DAYS, MAX_LOOKBACK_DAYS
};
