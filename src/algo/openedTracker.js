/**
 * openedTracker.js — angebrochene Packungen
 * ================================================================
 * Nach dem Kochen bleibt eine halbe Dose Tomaten. Die Datenbank
 * kennt `shelfLifeOpenedDays` — eine geöffnete Dose hält 3 Tage,
 * nicht die 1095 des ungeöffneten Produkts. Ohne diesen Zustand
 * rechnet die Bestandsschätzung mit der falschen Zahl und die
 * Reste verderben unbemerkt.
 *
 * Der Nutzer markiert „angebrochen" mit einem Tippen. Mehr Pflege
 * darf es nicht kosten, sonst macht es niemand.
 *
 * SICHERHEIT: Bei Produkten mit Verbrauchsdatum wird nach Ablauf
 * nichts verlängert und nichts vorgeschlagen — die Frist bleibt die
 * Frist, angebrochen oder nicht.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");

/**
 * @param {Array} opened  [{productId, openedDate}]
 * @param {string} today
 * @returns {Array} nach Dringlichkeit sortiert
 */
function openedItems(opened, today) {
  const out = [];

  for (const o of opened) {
    const p = byId(o.productId);
    if (!p) continue;

    const days = p.shelfLifeOpenedDays || p.shelfLifeDays;
    const age = daysBetween(o.openedDate, today);
    const daysLeft = days - age;

    out.push({
      productId: p.id,
      name: p.name,
      openedDate: o.openedDate,
      openedDays: age,
      shelfLifeOpenedDays: days,
      daysLeft,
      expired: daysLeft < 0,
      safetyCritical: p.safetyCritical,
      value: p.typicalPrice,
      urgent: daysLeft <= 1,
      message: daysLeft < 0
        ? (p.safetyCritical
            ? `${p.name} seit ${-daysLeft} Tagen über der Frist — entsorgen.`
            : `${p.name} ist seit ${-daysLeft} Tagen offen über der Haltbarkeit.`)
        : daysLeft === 0
          ? `${p.name} heute aufbrauchen.`
          : `${p.name} noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"} — angebrochen seit ${age} ${age === 1 ? "Tag" : "Tagen"}.`
    });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Bestandsschätzung korrigieren: was angebrochen ist, hält kürzer.
 * Die Restmenge bleibt unangetastet — nur die Frist ändert sich.
 */
function applyOpened(inventory, opened, today) {
  const map = new Map(opened.map((o) => [o.productId, o]));
  return inventory.map((item) => {
    const o = map.get(item.productId);
    if (!o) return item;
    const p = byId(item.productId);
    if (!p) return item;
    const daysLeft = (p.shelfLifeOpenedDays || p.shelfLifeDays) - daysBetween(o.openedDate, today);
    return {
      ...item,
      daysLeft: Math.min(item.daysLeft, daysLeft),
      opened: true,
      openedDate: o.openedDate
    };
  });
}

/** Was aus dem Angebrochenen zuerst weg muss — Grundlage für Rezepte. */
function useUpFirst(opened, today, withinDays = 3) {
  return openedItems(opened, today).filter(
    (x) => !x.expired && x.daysLeft <= withinDays && !(x.safetyCritical && x.daysLeft < 0)
  );
}

module.exports = { openedItems, applyOpened, useUpFirst };
