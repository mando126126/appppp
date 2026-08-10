/**
 * budgetOptimizer.js — NEU
 * Persona-Anforderung: Katrin, 38, alleinerziehend, zwei Kinder
 * ("Diese App rechnet mit einem Budget, das ich nicht habe.")
 * ================================================================
 * Aufgabe: Wenn die vorgeschlagene Liste über dem Wochenbudget
 * liegt, soll die App kürzen — nicht der Mensch.
 *
 * Die Reihenfolge, in der gestrichen wird, ist eine Wertentscheidung,
 * keine reine Rechnung. Deshalb ist sie hier ausdrücklich benannt
 * und nicht in einer Formel versteckt:
 *
 *   1. Zuerst raus: Produkte mit hoher Verschwendungsquote.
 *      Das spart Geld, ohne dass tatsächlich weniger gegessen wird.
 *   2. Dann: Süßes, Snacks, Alkohol.
 *   3. Dann: teure Frischware, die ersetzt werden kann.
 *   4. NIEMALS gestrichen: Grundnahrungsmittel (siehe ESSENTIALS).
 *      Eine App, die einem Haushalt mit knappem Budget das Brot
 *      streicht, hat ihren Zweck verfehlt.
 *
 * Zusätzlich: statt nur zu streichen, werden Alternativen
 * vorgeschlagen (kleinere Menge, günstigeres Produkt derselben
 * Kategorie).
 * ================================================================
 */

const { byId, byCategory } = require("./foodDatabase");

// Diese Kategorien und Produkte werden nie automatisch gestrichen
const ESSENTIAL_CATEGORIES = new Set(["Backwaren", "Milchprodukte"]);
const ESSENTIAL_IDS = new Set([
  "brot_vollkorn", "brot_mischbrot", "toastbrot", "milch_vollmilch",
  "milch_fettarm", "eier", "nudeln", "reis", "kartoffeln", "mehl", "butter"
]);

// Reihenfolge des Streichens: höherer Wert = fliegt früher raus
const CUT_PRIORITY = {
  "Süßes/Snacks": 100,
  "Getränke": 80,      // Alkohol und Limonade zuerst
  "Tiefkühl": 50,
  "Wurstwaren": 45,
  "Fleisch/Fisch": 40,
  "Frischware": 30,
  "Trocken/Vorrat": 20,
  "Haushalt": 15,
  "Milchprodukte": 10,
  "Backwaren": 5
};

const isEssential = (item) =>
  ESSENTIAL_IDS.has(item.productId) ||
  (ESSENTIAL_CATEGORIES.has(item.category) && (item.price || 0) < 3);

/**
 * Kürzt die Liste auf das Budget.
 *
 * @param {Array} items - Vorschlagsliste mit price, category, wasteRate
 * @param {number} budget - Wochenbudget in Euro
 * @returns {{kept, removed, halved, total, savedByHalving, withinBudget, advice}}
 */
function fitToBudget(items, budget) {
  const working = items.map((i) => ({ ...i, halved: false }));
  const sum = (list) => list.reduce((s, i) => s + (i.halved ? i.price / 2 : i.price), 0);

  if (!budget || sum(working) <= budget) {
    return {
      kept: working, removed: [], halved: [],
      total: Math.round(sum(working) * 100) / 100,
      savedByHalving: 0, withinBudget: true,
      advice: "Liste passt ins Budget."
    };
  }

  const halved = [];
  const removed = [];

  // Schritt 1: Produkte mit hoher Verschwendungsquote halbieren statt streichen.
  // Spart Geld, ohne dass weniger gegessen wird.
  const wasteful = working
    .filter((i) => (i.wasteRate || 0) >= 0.25 && i.price >= 1)
    .sort((a, b) => (b.wasteRate || 0) - (a.wasteRate || 0));

  for (const item of wasteful) {
    if (sum(working) <= budget) break;
    item.halved = true;
    halved.push(item);
  }
  const savedByHalving = halved.reduce((s, i) => s + i.price / 2, 0);

  // Schritt 2: nach Streichreihenfolge entfernen, Grundnahrung bleibt
  const cutOrder = working
    .filter((i) => !isEssential(i))
    .sort((a, b) => {
      const pa = CUT_PRIORITY[a.category] || 25;
      const pb = CUT_PRIORITY[b.category] || 25;
      if (pb !== pa) return pb - pa;
      return b.price - a.price; // innerhalb der Gruppe: teuerstes zuerst
    });

  for (const item of cutOrder) {
    if (sum(working.filter((i) => !removed.includes(i))) <= budget) break;
    removed.push(item);
  }

  const kept = working.filter((i) => !removed.includes(i));
  const total = sum(kept);

  let advice;
  if (total <= budget) {
    const parts = [];
    if (halved.length) parts.push(`${halved.length} Position${halved.length > 1 ? "en" : ""} halbiert`);
    if (removed.length) parts.push(`${removed.length} gestrichen`);
    advice = `Passt jetzt: ${parts.join(", ")}.`;
  } else {
    advice = "Auch nach dem Kürzen über Budget — Grundnahrungsmittel bleiben bewusst auf der Liste.";
  }

  return {
    kept, removed, halved,
    total: Math.round(total * 100) / 100,
    savedByHalving: Math.round(savedByHalving * 100) / 100,
    withinBudget: total <= budget,
    advice
  };
}

/**
 * Sucht günstigere Alternativen in derselben Kategorie.
 * Kein Streichen, sondern Tauschen — Katrins eigentlicher Wunsch.
 */
function cheaperAlternatives(item, maxSuggestions = 2) {
  const p = byId(item.productId);
  if (!p) return [];
  return byCategory(p.category)
    .filter((c) => c.id !== p.id && c.typicalPrice < p.typicalPrice * 0.8 && c.isFood)
    .sort((a, b) => a.typicalPrice - b.typicalPrice)
    .slice(0, maxSuggestions)
    .map((c) => ({
      productId: c.id, name: c.name, price: c.typicalPrice,
      saving: Math.round((p.typicalPrice - c.typicalPrice) * 100) / 100
    }));
}

module.exports = { fitToBudget, cheaperAlternatives, isEssential, CUT_PRIORITY, ESSENTIAL_IDS };
