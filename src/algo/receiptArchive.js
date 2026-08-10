/**
 * receiptArchive.js — NEU (Feature 6)
 * ================================================================
 * Der Bon ist ohnehin da. Ihn zusätzlich als Kaufbeleg nutzbar zu
 * machen, kostet fast nichts und gibt einen zweiten Grund, die App
 * zu behalten -- auch für jemanden, der gerade kein Interesse an
 * Verschwendungsstatistik hat.
 *
 * Rechtlicher Rahmen (bewusst vorsichtig formuliert):
 *   - Die gesetzliche Gewährleistung beträgt bei beweglichen Sachen
 *     grundsätzlich zwei Jahre ab Übergabe (§ 438 BGB). Für
 *     gebrauchte Sachen und bei Herstellergarantien gelten
 *     abweichende Regeln.
 *   - Eine Herstellergarantie ist eine freiwillige Zusage und kann
 *     kürzer oder länger sein.
 *   - Ob ein digitaler Beleg im Einzelfall als Nachweis akzeptiert
 *     wird, hängt vom Händler ab. Die App speichert und erinnert,
 *     sie gibt KEINE Rechtsauskunft.
 *
 * Deshalb: Fristen werden als Orientierung angezeigt, nie als
 * verbindliche Rechtsaussage.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const WARRANTY_YEARS_DEFAULT = 2;
// Belege für Lebensmittel sind nach kurzer Zeit wertlos --
// Non-Food dagegen über Jahre relevant.
const FOOD_KEEP_DAYS = 60;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr, today) {
  return Math.round((new Date(dateStr) - new Date(today)) / 86400000);
}

/**
 * Legt einen Bon im Archiv ab und markiert die relevanten
 * Positionen (alles, was kein Lebensmittel ist).
 */
function archiveReceipt(receipt) {
  const { date, store, items = [], total, fileRef = null } = receipt;

  const relevant = [];
  for (const item of items) {
    const p = byId(item.productId);
    if (!p) continue;
    // Lebensmittel sind für Garantiezwecke uninteressant
    if (p.isFood) continue;

    const price = (item.unitPrice || 0) * (item.quantity || 1);
    relevant.push({
      productId: item.productId,
      name: p.name,
      price: Math.round(price * 100) / 100,
      warrantyUntil: addDays(date, WARRANTY_YEARS_DEFAULT * 365),
      note: "Gesetzliche Gewährleistung beträgt bei neuen beweglichen Sachen " +
            "grundsätzlich zwei Jahre. Abweichungen möglich — keine Rechtsauskunft."
    });
  }

  const foodTotal = items.reduce((s, i) => {
    const p = byId(i.productId);
    return p && p.isFood ? s + (i.unitPrice || 0) * (i.quantity || 1) : s;
  }, 0);

  return {
    id: `${date}_${store || "unbekannt"}_${Math.round((total || 0) * 100)}`,
    date, store, total: Math.round((total || 0) * 100) / 100,
    positions: items.length,
    foodTotal: Math.round(foodTotal * 100) / 100,
    nonFoodTotal: Math.round((total - foodTotal) * 100) / 100,
    warrantyItems: relevant,
    keepUntil: relevant.length
      ? relevant.reduce((max, r) => (r.warrantyUntil > max ? r.warrantyUntil : max), date)
      : addDays(date, FOOD_KEEP_DAYS),
    fileRef,
    hasWarrantyRelevance: relevant.length > 0
  };
}

/** Volltextsuche über das Archiv. */
function searchArchive(archive, query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];

  return archive.filter((r) => {
    if ((r.store || "").toLowerCase().includes(q)) return true;
    if (r.date.includes(q)) return true;
    return r.warrantyItems.some((i) => i.name.toLowerCase().includes(q));
  });
}

/** Belege, deren Garantiefrist bald endet. */
function expiringWarranties(archive, today, withinDays = 60) {
  const out = [];
  for (const receipt of archive) {
    for (const item of receipt.warrantyItems) {
      const days = daysUntil(item.warrantyUntil, today);
      if (days >= 0 && days <= withinDays) {
        out.push({
          receiptId: receipt.id,
          date: receipt.date,
          store: receipt.store,
          name: item.name,
          price: item.price,
          warrantyUntil: item.warrantyUntil,
          daysLeft: days,
          message: `${item.name} (${receipt.store || "unbekannt"}, ${receipt.date}): ` +
                   `Gewährleistungsfrist endet in ${days} Tagen.`
        });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Aufräumvorschlag: Belege ohne Garantierelevanz, die älter als
 * die Aufbewahrungsfrist sind. Löschen bleibt eine Entscheidung
 * des Nutzers -- die App löscht nichts von selbst.
 */
function cleanupCandidates(archive, today) {
  return archive
    .filter((r) => !r.hasWarrantyRelevance && r.keepUntil < today)
    .map((r) => ({
      id: r.id, date: r.date, store: r.store, total: r.total,
      reason: `Nur Lebensmittel, älter als ${FOOD_KEEP_DAYS} Tage.`
    }));
}

/** Kennzahlen fürs Archiv. */
function archiveStats(archive) {
  const total = archive.reduce((s, r) => s + r.total, 0);
  const stores = new Map();
  archive.forEach((r) => {
    const k = r.store || "unbekannt";
    const cur = stores.get(k) || { visits: 0, spend: 0 };
    stores.set(k, { visits: cur.visits + 1, spend: cur.spend + r.total });
  });

  return {
    receipts: archive.length,
    totalSpend: Math.round(total * 100) / 100,
    warrantyRelevant: archive.filter((r) => r.hasWarrantyRelevance).length,
    stores: [...stores.entries()]
      .map(([name, v]) => ({
        name, visits: v.visits,
        spend: Math.round(v.spend * 100) / 100,
        avgBasket: Math.round((v.spend / v.visits) * 100) / 100
      }))
      .sort((a, b) => b.spend - a.spend)
  };
}

module.exports = {
  archiveReceipt, searchArchive, expiringWarranties, cleanupCandidates,
  archiveStats, WARRANTY_YEARS_DEFAULT, FOOD_KEEP_DAYS
};
