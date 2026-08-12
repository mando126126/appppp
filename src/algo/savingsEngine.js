/**
 * savingsEngine.js
 * ----------------------------------------------------------------
 * Erzeugt die Liste konkreter Sparvorschläge (Tab "Einsparpotenzial"
 * im Entwurf) aus den aggregierten Verschwendungs-Zahlen. Fest
 * hinterlegte Vorschlagsvorlagen (Templates), die anhand von
 * Schwellenwerten ausgewählt und mit den echten Zahlen gefüllt
 * werden. Kein Freitext-Generator, kein KI-Modell -- jeder Satz
 * ist vorab von Hand formuliert und wird nur mit Zahlen bestückt.
 * ----------------------------------------------------------------
 */

const RULES = [
  {
    id: "smaller_quantity",
    appliesWhen: (p) => p.wasteRate >= 0.4,
    title: (p) => `${p.name} als kleinere Menge`,
    detail: (p) =>
      `Verschwendungsquote ${Math.round(p.wasteRate * 100)} % in den letzten ${p.windowWeeks} Wochen. ` +
      `Kleinere Packung oder geringere Menge könnte das senken.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.6 * 100) / 100
  },
  {
    id: "adjust_rhythm",
    appliesWhen: (p) => p.wasteRate >= 0.2 && p.wasteRate < 0.4,
    title: (p) => `${p.name}-Rhythmus anpassen`,
    detail: (p) =>
      `Wird aktuell alle ${p.currentRhythmDays} Tage vorgeschlagen, ` +
      `tatsächlich verbraucht wird eher alle ${p.suggestedRhythmDays} Tage.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.5 * 100) / 100
  },
  {
    id: "portion_on_purchase",
    appliesWhen: (p) => p.category === "Fleisch/Fisch" && p.wasteRate >= 0.15,
    title: (p) => `${p.name} direkt portionieren`,
    detail: (p) =>
      `Teuerste Verlustquelle in dieser Kategorie. Erinnerung am Einkaufstag: ` +
      `einen Teil sofort einfrieren, statt alles auf einmal offen zu lagern.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.7 * 100) / 100
  }
];

/**
 * @param {Array<object>} productStats - aggregierte Kennzahlen pro Produkt
 *   { productId, name, category, wasteRate, wastedEurosPerWeek,
 *     windowWeeks, currentRhythmDays, suggestedRhythmDays }
 * @returns {Array} Vorschläge, absteigend nach Ersparnis sortiert
 */
function buildSavingsSuggestions(productStats) {
  const suggestions = [];

  for (const p of productStats) {
    for (const rule of RULES) {
      if (rule.appliesWhen(p)) {
        suggestions.push({
          id: `${rule.id}_${p.productId}`,
          productId: p.productId,
          title: rule.title(p),
          detail: rule.detail(p),
          estimatedWeeklySaving: rule.estimatedWeeklySaving(p)
        });
        break; // pro Produkt nur die zuerst zutreffende Regel, keine Doppelvorschläge
      }
    }
  }

  return suggestions.sort((a, b) => b.estimatedWeeklySaving - a.estimatedWeeklySaving);
}

/** Summiert eine Auswahl an Vorschlägen auf Woche und Jahr hoch. */
function totalSavings(selectedSuggestions) {
  const perWeek = selectedSuggestions.reduce((sum, s) => sum + s.estimatedWeeklySaving, 0);
  return {
    perWeek: Math.round(perWeek * 100) / 100,
    perYear: Math.round(perWeek * 52)
  };
}

module.exports = { buildSavingsSuggestions, totalSavings, RULES };
