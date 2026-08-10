/**
 * safetyAlert.js — Sofortwarnung nach dem Einkauf
 * ================================================================
 * Enthält der Einkauf ein Produkt mit Verbrauchsdatum, kommt beim
 * Verlassen des Ladens eine kurze Meldung: „Hackfleisch dabei —
 * direkt kühlen."
 *
 * Kein Verkaufsargument, aber der einzige Punkt, an dem die App
 * echte Sicherheitsrelevanz hat. Laut BZfE gehören diese Produkte
 * nach Ablauf in den Müll, weil sie Keime enthalten können, die man
 * weder sieht noch riecht noch schmeckt — die Kühlkette davor ist
 * entsprechend das Einzige, was der Nutzer beeinflussen kann.
 *
 * Bewusst knapp und selten: eine Warnung, die bei jedem Einkauf
 * erscheint, wird nach zwei Wochen weggetippt. Deshalb nur
 * Verbrauchsdatum-Produkte, nicht „alles Gekühlte".
 * ================================================================
 */

const { byId, STORAGE } = require("./foodDatabase");

/**
 * @param {Array} items gekaufte Positionen [{productId, quantity}]
 * @returns {null|{products, coldestZone, message, source}}
 */
function safetyAlert(items) {
  const critical = [];
  const seen = new Set();

  for (const item of items) {
    const p = byId(item.productId);
    if (!p || !p.safetyCritical || seen.has(p.id)) continue;
    seen.add(p.id);
    critical.push({
      productId: p.id,
      name: p.name,
      shelfLifeDays: p.shelfLifeDays,
      storage: p.storage
    });
  }

  if (!critical.length) return null;

  const names = critical.map((c) => c.name);
  const list = names.length === 1
    ? names[0]
    : names.slice(0, -1).join(", ") + " und " + names[names.length - 1];

  const shortest = Math.min(...critical.map((c) => c.shelfLifeDays));

  return {
    products: critical,
    coldestZone: STORAGE.FRIDGE_BOTTOM,
    // Kurzfassung für die Liste, wo der Hinweis dauerhaft steht: ein
    // Satz. Die Langfassung ist für den Moment nach dem Einkauf — da
    // liegt die Packung in der Hand und der Hinweis erscheint einmal.
    short: `${list} direkt kühlen`,
    message:
      `${list} ${names.length === 1 ? "trägt" : "tragen"} ein Verbrauchsdatum. ` +
      `Zu Hause zuerst in die kälteste Zone: ${STORAGE.FRIDGE_BOTTOM}. ` +
      `Haltbar ${shortest} ${shortest === 1 ? "Tag" : "Tage"}; nach Ablauf gehört das in den Müll, ` +
      `auch wenn es unauffällig aussieht und riecht.`,
    source: "BZfE/BLE, Haltbarkeit von Lebensmitteln, Stand 20.02.2025"
  };
}

module.exports = { safetyAlert };
