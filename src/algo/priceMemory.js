/**
 * priceMemory.js — Preis-Gedächtnis je Produkt
 * ================================================================
 * „Butter kostet heute 2,79 €, im Schnitt zahlst du 2,29 €."
 *
 * Ausdrücklich KEIN Preisvergleich zwischen Händlern — dafür fehlen
 * die Daten, und fremde Preisdaten wären erfunden. Verglichen wird
 * nur mit der eigenen Historie. Das bleibt lokal und ist trotzdem
 * die Zahl, die im Laden zählt: ob dieser Preis für DICH gut ist.
 *
 * Der Median statt des Mittelwerts, aus demselben Grund wie im
 * Rhythmus: ein einzelner Angebotspreis oder ein Fehlkauf soll den
 * Bezugswert nicht verschieben.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const MIN_PURCHASES = 3;      // darunter ist „üblich" eine Behauptung
const NOTABLE_CHANGE = 0.08;  // 8 % — darunter ist es Rauschen

function medianOf(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Preisgedächtnis für ein Produkt.
 * @returns {null|{productId, name, usual, last, lowest, highest, purchases, changePercent, verdict, message}}
 */
function priceMemory(productId, history) {
  const rows = history
    .filter((h) => h.productId === productId && Number.isFinite(h.unitPrice) && h.unitPrice > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length < MIN_PURCHASES) return null;

  const prices = rows.map((r) => r.unitPrice);
  const usual = medianOf(prices);
  const last = prices[prices.length - 1];
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const change = usual > 0 ? (last - usual) / usual : 0;

  let verdict = "üblich";
  if (change <= -NOTABLE_CHANGE) verdict = "günstig";
  else if (change >= NOTABLE_CHANGE) verdict = "teuer";

  const p = byId(productId);
  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";

  const message =
    verdict === "üblich"
      ? `${eur(last)} — dein üblicher Preis.`
      : verdict === "günstig"
        ? `${eur(last)} statt sonst ${eur(usual)} — ${Math.abs(Math.round(change * 100))} % günstiger als üblich.`
        : `${eur(last)} statt sonst ${eur(usual)} — ${Math.round(change * 100)} % über deinem üblichen Preis.`;

  return {
    productId,
    name: p ? p.name : productId,
    usual: Math.round(usual * 100) / 100,
    last: Math.round(last * 100) / 100,
    lowest: Math.round(lowest * 100) / 100,
    highest: Math.round(highest * 100) / 100,
    purchases: rows.length,
    changePercent: Math.round(change * 1000) / 10,
    verdict,
    message,
    lastDate: rows[rows.length - 1].date
  };
}

/** Preisgedächtnis für alle Produkte mit genug Historie. */
function allPriceMemories(history) {
  const out = new Map();
  for (const pid of new Set(history.map((h) => h.productId))) {
    const m = priceMemory(pid, history);
    if (m) out.set(pid, m);
  }
  return out;
}

module.exports = { priceMemory, allPriceMemories, MIN_PURCHASES, NOTABLE_CHANGE };
