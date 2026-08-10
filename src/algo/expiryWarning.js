/**
 * expiryWarning.js
 * ----------------------------------------------------------------
 * Erzeugt die präventive Warnung beim Listenaufbau ("Salat läuft
 * bei dir oft ab") -- nicht als Rückschau, sondern im Moment der
 * Entscheidung. Reines Schwellenwert-Regelwerk auf den Zahlen aus
 * wasteInference.js, kein KI-Modell.
 *
 * Tonalität bewusst nach dem Persona-Bericht umgestellt: keine
 * Vorwurfsformulierung ("du hast X weggeworfen"), sondern eine
 * Handlungsoption ("kleinere Menge nehmen?"). Siehe Punkt 2 der
 * Synthese im persona-bericht.md.
 * ----------------------------------------------------------------
 */

const WASTE_RATE_WARNING_THRESHOLD = 0.3; // ab 30 % Verschwendungsquote wird gewarnt

/**
 * @param {string} productId
 * @param {string} productName
 * @param {number} price
 * @param {{wasted:number, purchased:number, wastedEuros:number}} stats
 * @returns {object|null} Warnung oder null, wenn keine nötig ist
 */
function buildExpiryWarning(productId, productName, price, stats) {
  if (!stats || stats.purchased === 0) return null;

  const wasteRate = stats.wasted / stats.purchased;
  if (wasteRate < WASTE_RATE_WARNING_THRESHOLD) return null;

  const timesText = stats.wasted === 1 ? "einmal" : `${stats.wasted}×`;

  return {
    productId,
    severity: wasteRate >= 0.5 ? "high" : "medium",
    // Handlungsorientiert statt anklagend formuliert:
    message: `${productName}: in letzter Zeit ${timesText} übrig geblieben. Kleinere Menge nehmen oder erst nächste Woche?`,
    wasteRate: Math.round(wasteRate * 100) / 100,
    estimatedEurosAtRisk: Math.round(price * wasteRate * 100) / 100,
    suggestedActions: ["halbe_menge", "diese_woche_ueberspringen", "trotzdem_kaufen"]
  };
}

/**
 * Wendet buildExpiryWarning auf eine ganze Vorschlagsliste an.
 * @param {Array} suggestions - aus listGenerator.generateShoppingList
 * @param {Map<string, object>} wasteStatsByProduct
 * @returns {Array} Warnungen, eine pro betroffenem Produkt
 */
function buildWarningsForList(suggestions, wasteStatsByProduct) {
  const warnings = [];
  for (const item of suggestions) {
    const stats = wasteStatsByProduct.get(item.productId);
    const warning = buildExpiryWarning(item.productId, item.name, item.price || 0, stats);
    if (warning) warnings.push(warning);
  }
  return warnings;
}

module.exports = { buildExpiryWarning, buildWarningsForList, WASTE_RATE_WARNING_THRESHOLD };
