/**
 * duplicateWarning.js — NEU (Feature 3)
 * ================================================================
 * "Milch hast du am Dienstag schon gekauft."
 *
 * Der Moment im Laden, in dem eine Warnung tatsächlich etwas
 * verhindert: Der Griff ins Regal ist noch umkehrbar, der Kauf
 * nicht. Verhindert genau die Käufe, die später als Verschwendung
 * in der Statistik auftauchen.
 *
 * Drei Stufen, je nach Sicherheit:
 *   HOCH   -- kürzlich gekauft UND Bestand rechnerisch noch da UND
 *             lange haltbar. Klarer Doppelkauf.
 *   MITTEL -- kürzlich gekauft, Bestand unsicher.
 *   INFO   -- Produkt ist schon auf der aktuellen Liste (zweimal
 *             eingetragen).
 *
 * Bewusst zurückhaltend: Eine Warnung, die dreimal pro Einkauf
 * falsch liegt, wird nach einer Woche ignoriert. Deshalb wird bei
 * unsicherer Bestandsschätzung (niedriger Vertrauenswert) gar
 * nicht gewarnt.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");
const { estimateRemaining } = require("./inventoryEstimator");

const MIN_CONFIDENCE_TO_WARN = 0.35;
// Bis zu dieser Zahl von Tagen ist der Kauf selbst Beweis genug --
// unabhängig davon, wie sicher die Bestandsschätzung ist.
const RECENT_PURCHASE_DAYS = 3;

/**
 * Prüft einen einzelnen Artikel, der gerade in den Wagen soll.
 *
 * @param {string} productId
 * @param {object} ctx - {history, rhythms, today, currentList}
 */
function checkDuplicate(productId, ctx) {
  const p = byId(productId);
  if (!p) return null;

  const { history = [], rhythms = new Map(), today, currentList = [] } = ctx;

  // Stufe INFO: schon auf der Liste
  const onListTwice = currentList.filter((i) => i.productId === productId).length > 1;
  if (onListTwice) {
    return {
      productId, level: "info", name: p.name,
      message: `${p.name} steht zweimal auf der Liste.`
    };
  }

  // Letzter Kauf
  const purchases = history.filter((h) => h.productId === productId);
  if (purchases.length === 0) return null;
  const last = purchases.reduce((a, b) => (a.date > b.date ? a : b));

  const daysSince = daysBetween(last.date, today);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;

  const rhythm = rhythms.get(productId);
  const est = estimateRemaining(productId, last, rhythm, today);
  const weekday = new Date(last.date).toLocaleDateString("de-DE", { weekday: "long" });

  // Regel A: sehr kürzlich gekauft.
  // Hier ist keine Bestandsschätzung nötig -- dass gekauft wurde,
  // steht fest. Nur bei sehr kurzlebiger Ware (Brötchen, frischer
  // Fisch) ist ein Nachkauf nach zwei Tagen normal, deshalb die
  // Haltbarkeitsschranke.
  if (daysSince <= RECENT_PURCHASE_DAYS && p.shelfLifeDays > daysSince + 1) {
    return {
      productId, level: daysSince <= 1 ? "hoch" : "mittel", name: p.name,
      daysSince, lastPurchaseDate: last.date,
      remainingUnits: est ? est.remainingUnits : null,
      daysLeft: est ? est.daysLeft : null,
      confidence: est ? est.confidence : 0,
      message: `${p.name} hast du ${daysSince === 0 ? "heute" : daysSince === 1 ? "gestern" : `am ${weekday}`} gekauft.`,
      basis: "kuerzlich_gekauft",
      estimated: true
    };
  }

  // Regel B: Bestandsschätzung. Nur wenn sie belastbar genug ist --
  // eine Warnung, die dreimal pro Einkauf falsch liegt, wird nach
  // einer Woche ignoriert.
  if (!est || est.confidence < MIN_CONFIDENCE_TO_WARN) return null;
  if (!est.likelyPresent) return null;

  const expected = rhythm && rhythm.rhythmDays ? rhythm.rhythmDays : null;
  const tooEarly = expected ? daysSince < expected * 0.6 : false;
  if (!tooEarly) return null;

  const level = est.confidence >= 0.6 && est.daysLeft > 2 ? "hoch" : "mittel";

  return {
    productId,
    level,
    name: p.name,
    daysSince,
    lastPurchaseDate: last.date,
    remainingUnits: est.remainingUnits,
    daysLeft: est.daysLeft,
    confidence: est.confidence,
    message: level === "hoch"
      ? `${p.name} hast du am ${weekday} gekauft — rechnerisch ist noch etwas da (hält noch ${est.daysLeft} Tage).`
      : `${p.name} hast du vor ${daysSince} Tagen gekauft. Vielleicht ist noch welche da?`,
    basis: "bestandsschaetzung",
    estimated: true
  };
}

/**
 * Prüft eine ganze Liste.
 * Jedes Produkt erscheint höchstens einmal -- eine doppelt
 * eingetragene Position soll nicht auch doppelt gemeldet werden.
 */
function checkList(items, ctx) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    const w = checkDuplicate(item.productId, { ...ctx, currentList: items });
    if (w) out.push(w);
  }

  const order = { hoch: 0, mittel: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

module.exports = { checkDuplicate, checkList, MIN_CONFIDENCE_TO_WARN };
