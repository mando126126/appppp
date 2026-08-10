/**
 * basePrice.js — Grundpreis und persönliches Preisperzentil
 * ================================================================
 * Bei Haushaltsprodukten ist der Preisvergleich deutlich wertvoller
 * als bei Lebensmitteln: die Packungsgrößen streuen extrem (20 gegen
 * 80 Waschladungen) und die Werbung arbeitet mit Absolutpreisen. Der
 * Grundpreis ist die einzige Zahl, die vergleichbar ist.
 *
 * Bewertet wird AUSSCHLIESSLICH gegen die eigene Kaufhistorie. Keine
 * Preis-API, keine Fremddaten, kein Vergleich über Haushalte hinweg —
 * das wäre Wartungslast und Rechtsrisiko für eine Aussage, die lokal
 * genauso gut zu haben ist: ob dieser Preis für DICH gut ist.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { nonFoodFor } = require("./nonFoodCatalog");

// Darunter keine Aussage — nicht etwa Perzentil 0.
const MIN_PRICE_POINTS = 4;

/**
 * Grundpreis je Normeinheit.
 * @returns {null|{value, label, display, packageValue, unit}}
 */
function basePrice(productId, price, packageValue, quantity = 1) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  // Fehlend und ungültig sind zweierlei:
  //   undefined/null = keine Angabe  -> Katalogwert als Behelf
  //   0 oder negativ = falsche Angabe -> gar kein Grundpreis
  // Ohne diese Trennung würde eine „0 ml"-Zeile still mit der
  // Katalogmenge weitergerechnet und sähe aus wie eine Messung.
  const givenAmount = packageValue === undefined || packageValue === null || packageValue === ""
    ? e.package.value
    : Number(packageValue);
  const qty = quantity === undefined || quantity === null ? 1 : Number(quantity);

  if (price === undefined || price === null || price === "") return null;
  const total = Number(price);

  // Sonst entstünde hier NaN oder Infinity und wanderte durch alle
  // Folgerechnungen bis in die Anzeige.
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(givenAmount) || givenAmount <= 0) return null;
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const amount = givenAmount;

  const norm = e.package.norm;
  const units = (amount * qty) / norm.per;
  if (!Number.isFinite(units) || units <= 0) return null;

  const value = total / units;
  if (!Number.isFinite(value)) return null;

  return {
    productId,
    value: Math.round(value * 1000) / 1000,
    label: norm.label,
    display: `${value.toFixed(2).replace(".", ",")} € je ${norm.label}`,
    packageValue: amount,
    unit: e.package.unit
  };
}

/**
 * Einordnung eines Grundpreises in die eigene Historie.
 * @param {Array} history [{price, packageValue, quantity, date}]
 * @returns {null|{percentile, verdict, median, lowest, highest, points, message}}
 */
function pricePercentile(productId, current, history) {
  const p = byId(productId);
  if (!p) return null;

  const points = (history || [])
    .map((h) => basePrice(productId, h.price, h.packageValue, h.quantity))
    .filter((x) => x && x.value > 0)
    .map((x) => x.value);

  // Unter vier Datenpunkten ist „günstig" eine Behauptung.
  if (points.length < MIN_PRICE_POINTS || !Number.isFinite(current) || current <= 0) {
    return {
      productId, percentile: null, verdict: "unbekannt",
      median: null, lowest: null, highest: null, points: points.length,
      message: `Noch zu wenig Historie für eine Preisaussage (${points.length} von ${MIN_PRICE_POINTS}).`
    };
  }

  const sorted = [...points].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < current).length;
  const percentile = below / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const verdict = percentile < 0.25 ? "günstig" : percentile > 0.75 ? "teuer" : "normal";
  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";
  const norm = nonFoodFor(productId).package.norm;

  return {
    productId,
    percentile: Math.round(percentile * 100) / 100,
    verdict,
    median: Math.round(median * 1000) / 1000,
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
    points: sorted.length,
    message: verdict === "günstig"
      ? `${eur(current)} je ${norm.label} — günstig für dich (sonst ${eur(median)}).`
      : verdict === "teuer"
        ? `${eur(current)} je ${norm.label} — teuer für dich (sonst ${eur(median)}).`
        : `${eur(current)} je ${norm.label} — normal für dich.`
  };
}

/**
 * Ersparnis aus günstigen Einkäufen (§8.3).
 *
 * Getrennt von der Lebensmittel-Ersparnis auszuweisen: die eine Zahl
 * ist realisiert (du hast weniger gezahlt), die andere kontrafaktisch
 * (du hättest sonst weggeworfen). Beides zu addieren wäre irreführend.
 */
function nonFoodSavings(entries, today) {
  let total = 0;
  const byProduct = [];

  for (const entry of entries) {
    const e = nonFoodFor(entry.productId);
    const p = byId(entry.productId);
    if (!e || !p) continue;

    const rows = (entry.purchases || []).filter((x) => x.date && x.date <= today);
    const prices = rows
      .map((h) => ({ h, bp: basePrice(entry.productId, h.price, h.packageValue, h.quantity) }))
      .filter((x) => x.bp);
    if (prices.length < MIN_PRICE_POINTS) continue;

    const sorted = prices.map((x) => x.bp.value).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Nur Käufe UNTER dem Median zählen als Ersparnis. Käufe darüber
    // gegenzurechnen wäre eine Strafe für normales Einkaufen.
    let saved = 0;
    for (const { h, bp } of prices) {
      if (bp.value >= median) continue;
      const units = ((Number(h.packageValue) || e.package.value) * (Number(h.quantity) || 1)) / e.package.norm.per;
      saved += (median - bp.value) * units;
    }
    if (saved <= 0.01) continue;

    total += saved;
    byProduct.push({
      productId: entry.productId, name: p.name,
      saved: Math.round(saved * 100) / 100,
      median: Math.round(median * 1000) / 1000,
      purchases: prices.length
    });
  }

  return {
    total: Math.round(total * 100) / 100,
    byProduct: byProduct.sort((a, b) => b.saved - a.saved),
    basis: "eigene Kaufhistorie, Median als Bezug",
    realised: true
  };
}

module.exports = { basePrice, pricePercentile, nonFoodSavings, MIN_PRICE_POINTS };
