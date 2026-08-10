/**
 * freezeAdvisor.js — Einfrier-Empfehlung im richtigen Moment
 * ================================================================
 * Beim Einräumen, nicht drei Tage später: „Von den 400 g Hähnchen
 * die Hälfte sofort einfrieren — sonst sind in zwei Tagen 3,50 €
 * weg."
 *
 * Der Moment ist der Punkt. Eine Erinnerung am Tag vor dem Ablauf
 * kommt zu spät (das Fleisch liegt dann schon zwei Tage im
 * Kühlschrank), eine allgemeine Belehrung über Tiefkühlen ändert
 * nichts. Direkt nach dem Einkauf ist die Packung in der Hand.
 *
 * Bedingungen, alle drei müssen gelten:
 *   - `freezable: true` in der Datenbank
 *   - Haltbarkeit kürzer als der gelernte Verbrauch der Menge
 *   - Lebensmittel (Non-Food friert niemand ein)
 *
 * SICHERHEIT: Produkte mit Verbrauchsdatum bekommen die Empfehlung
 * ausdrücklich AUCH — Einfrieren ist bei Hackfleisch und Geflügel
 * die richtige Antwort, solange es SOFORT geschieht. Was die App
 * für diese Produkte nie tut, ist eine Verlängerung nach Ablauf
 * anbieten. Der Unterschied steht in `beforeExpiry`.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

/**
 * @param {Array} items    gekaufte Positionen [{productId, quantity, unitPrice}]
 * @param {Map}   rhythms  aus computeAllRhythms
 * @returns {Array} Empfehlungen, teuerste zuerst
 */
function freezeSuggestions(items, rhythms = new Map()) {
  const out = [];

  for (const item of items) {
    const p = byId(item.productId);
    if (!p || !p.isFood || !p.freezable) continue;

    const quantity = Math.max(1, Number(item.quantity) || 1);
    const r = rhythms.get(item.productId);

    // Wie lange wird diese Menge im Haushalt gebraucht?
    // Ohne Rhythmus wird angenommen, dass eine Packung die Haltbarkeit
    // knapp übersteht — dann gibt es keine Empfehlung, nur bei belegtem
    // Überschuss. Lieber schweigen als jeden Einkauf kommentieren.
    if (!r || !r.perUnitDays) continue;

    const daysNeeded = r.perUnitDays * quantity;
    if (daysNeeded <= p.shelfLifeDays) continue;   // wird rechtzeitig verbraucht

    // Anteil, der es nicht schafft — aufgerundet auf halbe Packungen,
    // weil niemand 0,37 Packungen einfriert.
    const surplusDays = daysNeeded - p.shelfLifeDays;
    // Auf halbe Packungen runden, aber danach erneut deckeln: 0,75
    // rundet sonst auf 1,0 auf, und „alles einfrieren" ist kein
    // Ratschlag — dann hätte man es gleich gefroren gekauft.
    const rawShare = Math.min(0.75, surplusDays / daysNeeded);
    const share = Math.min(0.75, Math.round(rawShare * 2) / 2) || 0.5;

    const unitPrice = Number(item.unitPrice) || p.typicalPrice || 0;
    const valueAtRisk = Math.round(unitPrice * quantity * share * 100) / 100;
    if (valueAtRisk < 0.5) continue;               // Kleinbeträge sind kein Hinweis wert

    const amount = share === 0.5 ? "die Hälfte" : `etwa ${Math.round(share * 100)} %`;
    const grams = p.typicalWeightG ? Math.round(p.typicalWeightG * quantity * share) : null;

    out.push({
      productId: p.id,
      name: p.name,
      share,
      valueAtRisk,
      shelfLifeDays: p.shelfLifeDays,
      daysNeeded: Math.round(daysNeeded),
      safetyCritical: p.safetyCritical,
      // Bei Verbrauchsdatum gilt: einfrieren nur VOR Ablauf, sofort.
      beforeExpiry: p.safetyCritical,
      message:
        `Von ${quantity > 1 ? quantity + "× " : ""}${p.name} ${amount}` +
        (grams ? ` (rund ${grams} g)` : "") +
        (p.safetyCritical ? " sofort einfrieren" : " einfrieren") +
        ` — sonst sind in ${p.shelfLifeDays} Tagen etwa ` +
        `${valueAtRisk.toFixed(2).replace(".", ",")} € weg.` +
        (p.safetyCritical ? " Verbrauchsdatum: nur frisch einfrieren, nie nach Ablauf." : ""),
      estimated: true
    });
  }

  return out.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
}

module.exports = { freezeSuggestions };
