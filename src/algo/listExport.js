/**
 * listExport.js — Liste als Text
 * ================================================================
 * Die Liste muss den Haushalt verlassen können: an den Partner
 * schicken, ausdrucken, in eine Notiz kopieren. Ohne das bleibt die
 * App ein Einzelplatzwerkzeug, und beim gemeinsamen Einkauf greift
 * doch wieder jemand zum Zettel.
 *
 * Reiner Text, nach Gängen sortiert. Kein eigenes Format, keine
 * App-Bindung — was hier herauskommt, liest jedes Programm.
 * ================================================================
 */

const { groupByAisle, DEFAULT_AISLE_ORDER } = require("./aisleOrder");

const eur = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";

/**
 * @param {Array} items    aktive Listenpositionen
 * @param {object} opts    { order, title, withPrices, total }
 * @returns {string}
 */
function listAsText(items, opts = {}) {
  const order = opts.order || DEFAULT_AISLE_ORDER;
  const withPrices = opts.withPrices !== false;
  const title = opts.title || "Einkaufsliste";

  if (!items.length) return `${title}\n\nNichts auf der Liste.`;

  const lines = [title, ""];
  for (const { aisle, items: group } of groupByAisle(items, order)) {
    lines.push(aisle.toUpperCase());
    for (const i of group) {
      const price = i.halved ? i.price / 2 : i.price;
      lines.push(`  ☐ ${i.name}${withPrices ? `  ${eur(price)}` : ""}${i.halved ? "  (halbe Menge)" : ""}`);
    }
    lines.push("");
  }

  if (withPrices) {
    const sum = items.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    lines.push(`${items.length} Positionen · ${eur(sum)}`);
  }
  return lines.join("\n").trim();
}

/** Kurzfassung für eine Nachricht: eine Zeile, ohne Gänge. */
function listAsLine(items) {
  if (!items.length) return "Nichts auf der Liste.";
  return items.map((i) => i.name).join(", ");
}

module.exports = { listAsText, listAsLine };
