/**
 * stockRange.js — Vorrats-Reichweite
 * ================================================================
 * Beantwortet die Frage, die vor jedem Einkauf im Kopf steht:
 * „Wie lange komme ich noch ohne Einkauf aus?"
 *
 * Zwei Grenzen, und die kleinere gewinnt:
 *   1. MENGE   — wann ist das Produkt aufgebraucht (aus perUnitDays)
 *   2. FRISCHE — wann verdirbt es (aus daysLeft der Bestandsschätzung)
 *
 * Der Unterschied ist wichtig: „reicht noch 4 Tage, weil es alle
 * wird" ist eine Einkaufsplanung, „reicht noch 4 Tage, weil es
 * schlecht wird" ist eine Verlustwarnung. Wer beides in eine Zahl
 * wirft, verschenkt die Handlungsoption.
 *
 * Betrachtet werden nur Grundnahrungsmittel — Schokolade geht aus,
 * aber niemand plant deshalb einen Einkauf.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

// Produkte, deren Fehlen tatsächlich einen Einkauf auslöst.
const STAPLE_CATEGORIES = ["Milchprodukte", "Backwaren", "Obst", "Gemüse", "Fleisch/Fisch", "Trocken/Vorrat"];

const LIMIT = { QUANTITY: "menge", FRESHNESS: "frische" };

/**
 * @param {Array} inventory  aus estimateInventory
 * @param {Map}   rhythms    aus computeAllRhythms
 * @param {object} opts      { minConfidence }
 * @returns {{days, limitedBy, limiting, byProduct, confidence, estimated, message}}
 */
function stockRange(inventory, rhythms, opts = {}) {
  const minConfidence = opts.minConfidence ?? 0.4;

  const byProduct = [];
  for (const item of inventory) {
    const p = byId(item.productId);
    if (!p || !p.isFood) continue;
    if (!STAPLE_CATEGORIES.includes(p.category)) continue;

    const r = rhythms.get(item.productId);
    if (!r || r.confidence < minConfidence) continue;

    // Menge: Restmenge × Tage je Einheit. Ohne perUnitDays keine Aussage.
    const byQuantity = r.perUnitDays
      ? Math.round(item.remainingUnits * r.perUnitDays * 10) / 10
      : null;
    const byFreshness = Number.isFinite(item.daysLeft) ? item.daysLeft : null;

    if (byQuantity === null && byFreshness === null) continue;

    const candidates = [byQuantity, byFreshness].filter((x) => x !== null);
    const days = Math.max(0, Math.min(...candidates));
    const limitedBy = byFreshness !== null && (byQuantity === null || byFreshness < byQuantity)
      ? LIMIT.FRESHNESS
      : LIMIT.QUANTITY;

    byProduct.push({
      productId: item.productId,
      name: p.name,
      days,
      byQuantity,
      byFreshness,
      limitedBy,
      safetyCritical: p.safetyCritical,
      confidence: Math.round(Math.min(r.confidence, item.confidence) * 100) / 100
    });
  }

  byProduct.sort((a, b) => a.days - b.days);

  if (!byProduct.length) {
    return {
      days: null, limitedBy: null, limiting: [], byProduct: [],
      confidence: 0, estimated: true,
      message: "Noch keine Reichweite schätzbar — dafür braucht es Bestand mit gelerntem Verbrauch."
    };
  }

  // Die Reichweite des Haushalts ist die des knappsten Grundnahrungsmittels.
  const days = byProduct[0].days;
  const limiting = byProduct.filter((x) => x.days <= days + 0.5);
  const confidence = Math.round(
    (limiting.reduce((s, x) => s + x.confidence, 0) / limiting.length) * 100
  ) / 100;

  const names = limiting.slice(0, 2).map((x) => x.name).join(" und ");
  const rounded = Math.round(days);
  const message = rounded <= 0
    ? `${names} ${limiting.length > 1 ? "sind" : "ist"} vermutlich schon alle.`
    : `Dein Vorrat reicht noch etwa ${rounded} ${rounded === 1 ? "Tag" : "Tage"} — dann ${limiting.length > 1 ? "fehlen" : "fehlt"} ${names}.`;

  return {
    days: Math.round(days * 10) / 10,
    limitedBy: byProduct[0].limitedBy,
    limiting,
    byProduct,
    confidence,
    estimated: true,
    message
  };
}

module.exports = { stockRange, STAPLE_CATEGORIES, LIMIT };
