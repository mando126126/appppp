/**
 * unitPriceCalculator.js — NEU (Feature 1)
 * ================================================================
 * Grundpreis: was kostet das Produkt pro Kilo oder Liter?
 *
 * Der klassischste Sparhebel im Supermarkt — und die Daten liegen
 * bereits vor (typicalPrice und typicalWeightG in der Datenbank,
 * echte Preise und Mengen aus den Bons).
 *
 * Zwei Auswertungen:
 *   1. Grundpreis pro Position -- Vergleichbarkeit über
 *      Packungsgrößen hinweg
 *   2. Vergleich zwischen Packungsgrößen desselben Produkts aus
 *      der eigenen Kaufhistorie: "die große Packung war pro Kilo
 *      30 % günstiger"
 *
 * Ehrlichkeitshinweis: Der Grundpreis allein ist kein Kaufargument.
 * Die größere Packung ist nur dann günstiger, wenn sie auch
 * aufgebraucht wird. Deshalb wird die Verschwendungsquote des
 * Produkts in die Empfehlung einbezogen -- sonst empfiehlt die App
 * genau die Vorratspackung, die später halb weggeworfen wird.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const VOLUME_UNITS = new Set(["ml", "l"]);

/**
 * Grundpreis einer einzelnen Position.
 * @param {object} item - {productId, unitPrice, quantity, weightG?}
 */
function unitPrice(item) {
  const p = byId(item.productId);
  if (!p) return null;

  const grams = item.weightG || p.typicalWeightG;
  if (!grams || grams <= 0) return null;

  const totalGrams = grams * (item.quantity || 1);
  const totalPrice = (item.unitPrice || p.typicalPrice || 0) * (item.quantity || 1);
  if (totalGrams <= 0 || totalPrice <= 0) return null;

  const perKg = (totalPrice / totalGrams) * 1000;
  const isVolume = VOLUME_UNITS.has((p.unit || "").toLowerCase()) ||
                   ["Getränke"].includes(p.category);

  return {
    productId: item.productId,
    name: p.name,
    totalPrice: Math.round(totalPrice * 100) / 100,
    totalGrams,
    perKg: Math.round(perKg * 100) / 100,
    unitLabel: isVolume ? "je Liter" : "je kg",
    display: `${(Math.round(perKg * 100) / 100).toFixed(2).replace(".", ",")} € ${isVolume ? "je Liter" : "je kg"}`
  };
}

/**
 * Vergleicht Packungsgrößen desselben Produkts aus der eigenen
 * Kaufhistorie und sagt, welche pro Kilo günstiger war.
 *
 * @param {Array} history - Käufe mit weightG oder quantity
 * @param {Map} wasteStats - optional: productId -> {wasteRate}
 */
function comparePackSizes(history, wasteStats = new Map()) {
  const byProduct = new Map();

  for (const h of history) {
    const p = byId(h.productId);
    if (!p || !p.isFood) continue;
    const grams = h.weightG || p.typicalWeightG;
    if (!grams) continue;

    const totalGrams = grams * (h.quantity || 1);
    const totalPrice = (h.unitPrice || 0) * (h.quantity || 1);
    if (totalPrice <= 0) continue;

    if (!byProduct.has(h.productId)) byProduct.set(h.productId, new Map());
    const sizes = byProduct.get(h.productId);
    const key = totalGrams;
    if (!sizes.has(key)) sizes.set(key, { grams: totalGrams, prices: [] });
    sizes.get(key).prices.push(totalPrice);
  }

  const results = [];
  for (const [productId, sizes] of byProduct.entries()) {
    if (sizes.size < 2) continue; // nur wo wirklich verglichen werden kann

    const options = [...sizes.values()].map((s) => {
      const avgPrice = s.prices.reduce((a, b) => a + b, 0) / s.prices.length;
      return {
        grams: s.grams,
        avgPrice: Math.round(avgPrice * 100) / 100,
        perKg: Math.round((avgPrice / s.grams) * 1000 * 100) / 100,
        timesBought: s.prices.length
      };
    }).sort((a, b) => a.perKg - b.perKg);

    const best = options[0];
    const worst = options[options.length - 1];
    const savingPercent = Math.round(((worst.perKg - best.perKg) / worst.perKg) * 100);
    if (savingPercent < 5) continue; // unter 5 % lohnt der Hinweis nicht

    const p = byId(productId);
    const waste = wasteStats.get(productId);
    const wasteRate = waste ? waste.wasteRate || 0 : 0;

    // Der ehrliche Teil: große Packung nur empfehlen, wenn sie
    // auch aufgebraucht wird.
    const largerIsBetter = best.grams > worst.grams;
    const riskyRecommendation = largerIsBetter && wasteRate >= 0.25;

    results.push({
      productId,
      name: p.name,
      best, worst, savingPercent,
      recommendation: riskyRecommendation
        ? `${best.grams} g wäre pro Kilo ${savingPercent} % günstiger — aber von ${p.name} bleibt bei dir ` +
          `rund ${Math.round(wasteRate * 100)} % übrig. Die große Packung lohnt nur, wenn sie aufgebraucht wird.`
        : `${best.grams} g ist pro Kilo ${savingPercent} % günstiger als ${worst.grams} g.`,
      riskyRecommendation,
      estimatedSavingPerPurchase: Math.round((worst.perKg - best.perKg) * (best.grams / 1000) * 100) / 100
    });
  }

  return results.sort((a, b) => b.savingPercent - a.savingPercent);
}

/** Grundpreise einer ganzen Liste, teuerste zuerst. */
function unitPricesForList(items) {
  return items
    .map(unitPrice)
    .filter(Boolean)
    .sort((a, b) => b.perKg - a.perKg);
}

module.exports = { unitPrice, comparePackSizes, unitPricesForList };
