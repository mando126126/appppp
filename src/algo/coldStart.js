/**
 * coldStart.js — NEU
 * Persona-Anforderung: Business Angel ("Was liefert Tag eins?")
 * ================================================================
 * Das Problem: In den ersten drei bis vier Wochen kennt das System
 * keine Rhythmen. Ohne Antwort darauf springen laut Angel 70–90 %
 * der Nutzer in Woche eins ab.
 *
 * Die Lösung in drei Stufen, je nach Datenlage:
 *
 *   Stufe 0 (0 Bons): Es gibt noch nichts zu rechnen. Wert entsteht
 *     nur über den Lagerberater (Ethylen, Kühlzonen) — der braucht
 *     keine Historie.
 *   Stufe 1 (1 Bon): Ausgabenstruktur, Jahreshochrechnung, die
 *     teuersten Positionen. Sofort, ohne Rhythmus.
 *   Stufe 2 (2+ Bons, noch kein sicherer Rhythmus): Vorschläge auf
 *     Basis von KATEGORIE-STANDARDRHYTHMEN statt individueller
 *     Historie — klar als Annahme gekennzeichnet.
 *   Stufe 3 (genug Historie): normale individuelle Berechnung.
 *
 * Die Standardrhythmen unten sind Annahmen für einen Zwei-Personen-
 * Haushalt und ausdrücklich Startwerte, keine Messwerte. Sie werden
 * durch die individuelle Historie ersetzt, sobald diese verlässlich
 * genug ist.
 * ================================================================
 */

const { byId, byCategory } = require("./foodDatabase");

// Startwerte je Kategorie (Tage), Annahme Zwei-Personen-Haushalt
const CATEGORY_DEFAULT_RHYTHM = {
  "Milchprodukte": 7,
  "Backwaren": 4,
  "Frischware": 7,
  "Fleisch/Fisch": 7,
  "Wurstwaren": 10,
  "Trocken/Vorrat": 28,
  "Getränke": 10,
  "Tiefkühl": 21,
  "Süßes/Snacks": 14,
  "Haushalt": 30
};

/** Welche Stufe gilt bei dieser Datenlage? */
function determineStage(history, rhythms) {
  const receipts = new Set(history.map((h) => h.date)).size;
  if (receipts === 0) return { stage: 0, receipts, label: "noch kein Einkauf erfasst" };
  if (receipts === 1) return { stage: 1, receipts, label: "erster Bon" };

  const reliable = [...rhythms.values()].filter((r) => r.confidence >= 0.4 && r.rhythmDays).length;
  if (reliable < 3) return { stage: 2, receipts, label: "Annahmen statt Historie", reliable };
  return { stage: 3, receipts, label: "individuelle Historie", reliable };
}

/**
 * Stufe 1: Sofortwert aus einem einzigen Bon.
 * Kein Rhythmus nötig — nur Struktur und Hochrechnung.
 */
function firstReceiptInsights(receiptItems) {
  const total = receiptItems.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);

  const byCat = new Map();
  for (const item of receiptItems) {
    const p = byId(item.productId);
    if (!p) continue;
    const spend = (item.unitPrice || 0) * (item.quantity || 1);
    byCat.set(p.category, (byCat.get(p.category) || 0) + spend);
  }

  const categories = [...byCat.entries()]
    .map(([name, spend]) => ({ name, spend: Math.round(spend * 100) / 100,
      share: total > 0 ? Math.round((spend / total) * 100) : 0 }))
    .sort((a, b) => b.spend - a.spend);

  const expensive = receiptItems
    .map((i) => ({ ...i, spend: (i.unitPrice || 0) * (i.quantity || 1), product: byId(i.productId) }))
    .filter((i) => i.product)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3)
    .map((i) => ({ name: i.product.name, spend: Math.round(i.spend * 100) / 100 }));

  const foodOnly = receiptItems.filter((i) => { const p = byId(i.productId); return p && p.isFood; });
  const foodSpend = foodOnly.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);

  return {
    total: Math.round(total * 100) / 100,
    foodSpend: Math.round(foodSpend * 100) / 100,
    yearProjection: Math.round(total * 52),
    categories,
    expensive,
    positions: receiptItems.length,
    hint: "Hochrechnung setzt voraus, dass dieser Einkauf typisch für eine Woche ist."
  };
}

/**
 * Stufe 2: Vorschläge aus Kategorie-Standardrhythmen.
 * Nur für Produkte, die der Haushalt schon einmal gekauft hat —
 * die App erfindet keine Produkte, die nie im Korb waren.
 */
function assumptionBasedSuggestions(history, today, householdSize = 2) {
  const lastPurchase = new Map();
  for (const h of history) {
    const prev = lastPurchase.get(h.productId);
    if (!prev || h.date > prev.date) lastPurchase.set(h.productId, h);
  }

  const out = [];
  for (const [productId, entry] of lastPurchase.entries()) {
    const p = byId(productId);
    if (!p || !p.isFood) continue;

    const base = CATEGORY_DEFAULT_RHYTHM[p.category] || 14;
    // Größerer Haushalt verbraucht schneller
    const scaled = Math.max(2, Math.round(base * (2 / Math.max(1, householdSize))));
    const daysSince = Math.round((new Date(today) - new Date(entry.date)) / 86400000);

    if (daysSince >= scaled) {
      out.push({
        productId, name: p.name, category: p.category, aisle: p.aisle,
        price: p.typicalPrice, daysSince,
        rhythmDays: scaled,
        confidence: 0,
        basis: "annahme",
        explanation: `Angenommener Rhythmus für ${p.category} (${scaled} Tage). ` +
                     `Wird durch deine echten Kaufabstände ersetzt, sobald genug Historie da ist.`
      });
    }
  }
  return out.sort((a, b) => b.daysSince - a.daysSince);
}

module.exports = {
  determineStage, firstReceiptInsights, assumptionBasedSuggestions, CATEGORY_DEFAULT_RHYTHM
};
