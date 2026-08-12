/**
 * personalInflation.js — NEU (Feature 2)
 * ================================================================
 * Nicht "Lebensmittel wurden teurer", sondern:
 * "Dein üblicher Warenkorb kostet 12 % mehr als im Januar."
 *
 * Rechenweg (bewusst wie ein amtlicher Preisindex aufgebaut, damit
 * er nachvollziehbar ist):
 *   1. Warenkorb festlegen: Produkte, die in beiden Zeiträumen
 *      gekauft wurden. Nur so vergleicht man Gleiches mit Gleichem.
 *   2. Je Produkt den Durchschnittspreis pro Kilo/Stück je
 *      Zeitraum bilden.
 *   3. Preisänderungen mit der Kaufhäufigkeit gewichten -- Milch
 *      wiegt schwerer als Safran.
 *
 * Warum das ein starkes Feature ist: Es braucht KEINE fremden
 * Preisdaten, keine Händlerkooperation, keine Schnittstelle. Alles
 * kommt aus den eigenen Bons und kann vollständig lokal auf dem
 * Gerät laufen -- der Datenschutzberater aus dem Persona-Bericht
 * hatte genau das als glaubwürdigstes Unterscheidungsmerkmal
 * bezeichnet.
 *
 * Grenzen, die im Ergebnis mitgeführt werden:
 *   - Wenige gemeinsame Produkte = wenig aussagekräftig
 *   - Wechsel von Marke zu Eigenmarke sieht aus wie Deflation,
 *     ist aber ein Qualitätswechsel. Wird als Hinweis markiert.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const MIN_PRODUCTS_FOR_INDEX = 5;

function averagePricePerUnit(purchases) {
  let totalPrice = 0, totalUnits = 0;
  for (const p of purchases) {
    const qty = p.quantity || 1;
    const price = (p.unitPrice || 0) * qty;
    if (price <= 0 || qty <= 0) continue;
    totalPrice += price;
    totalUnits += qty;
  }
  return totalUnits > 0 ? totalPrice / totalUnits : null;
}

function inRange(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

/**
 * Vergleicht zwei Zeiträume.
 *
 * @param {Array} history
 * @param {object} basePeriod - {from, to}
 * @param {object} currentPeriod - {from, to}
 */
function personalInflation(history, basePeriod, currentPeriod) {
  const base = new Map();
  const current = new Map();

  for (const h of history) {
    const p = byId(h.productId);
    if (!p) continue;
    if (inRange(h.date, basePeriod.from, basePeriod.to)) {
      if (!base.has(h.productId)) base.set(h.productId, []);
      base.get(h.productId).push(h);
    } else if (inRange(h.date, currentPeriod.from, currentPeriod.to)) {
      if (!current.has(h.productId)) current.set(h.productId, []);
      current.get(h.productId).push(h);
    }
  }

  const items = [];
  let weightedSum = 0, weightTotal = 0;

  for (const [productId, basePurchases] of base.entries()) {
    const currentPurchases = current.get(productId);
    if (!currentPurchases) continue; // nur gemeinsame Produkte

    const basePrice = averagePricePerUnit(basePurchases);
    const currentPrice = averagePricePerUnit(currentPurchases);
    if (!basePrice || !currentPrice) continue;

    const change = (currentPrice - basePrice) / basePrice;
    // Gewicht: wie oft gekauft (Häufigkeit im Basiszeitraum)
    const weight = basePurchases.length;

    weightedSum += change * weight;
    weightTotal += weight;

    items.push({
      productId,
      name: byId(productId).name,
      basePrice: Math.round(basePrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      changePercent: Math.round(change * 1000) / 10,
      weight
    });
  }

  const indexChange = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const reliable = items.length >= MIN_PRODUCTS_FOR_INDEX;

  items.sort((a, b) => b.changePercent - a.changePercent);

  return {
    changePercent: Math.round(indexChange * 1000) / 10,
    productsCompared: items.length,
    reliable,
    biggestIncreases: items.slice(0, 5),
    biggestDecreases: items.slice(-3).reverse().filter((i) => i.changePercent < 0),
    caveat: reliable
      ? "Verglichen werden nur Produkte, die in beiden Zeiträumen gekauft wurden. " +
        "Ein Wechsel von Marke zu Eigenmarke sieht wie ein Preisrückgang aus, ist aber ein Produktwechsel."
      : `Nur ${items.length} gemeinsame Produkte — zu wenig für eine belastbare Aussage ` +
        `(mindestens ${MIN_PRODUCTS_FOR_INDEX} nötig).`,
    estimated: true
  };
}

/**
 * Monatsreihe für eine Verlaufsgrafik.
 * Basis ist immer der erste Monat mit ausreichend Daten.
 */
function inflationSeries(history, months) {
  if (!months || months.length < 2) return [];
  const baseMonth = months[0];
  const basePeriod = { from: `${baseMonth}-01`, to: `${baseMonth}-31` };

  return months.slice(1).map((m) => {
    const res = personalInflation(history, basePeriod, { from: `${m}-01`, to: `${m}-31` });
    return {
      month: m,
      changePercent: res.changePercent,
      productsCompared: res.productsCompared,
      reliable: res.reliable
    };
  });
}

module.exports = { personalInflation, inflationSeries, MIN_PRODUCTS_FOR_INDEX };
