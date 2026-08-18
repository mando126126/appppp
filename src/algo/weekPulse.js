/**
 * weekPulse.js — die nächsten sieben Tage als eine Zeile
 * ================================================================
 * Die Startseite soll eine Frage beantworten, bevor irgendetwas
 * angetippt wird: WANN passiert was?
 *
 * Alle Antworten dazu liegen längst in der App verstreut — der
 * Rhythmus sagt, wann ein Produkt wieder fällig ist, die
 * Bestandsschätzung sagt, wann etwas verdirbt, die Austauschliste
 * sagt, wann die Zahnbürste dran ist. Bisher musste man drei
 * Ansichten aufsuchen, um daraus einen Wochenplan zu machen.
 *
 * Hier wird daraus eine Zeile von sieben Tagen, jeder mit den
 * Ereignissen, die auf ihn fallen.
 *
 * DREI REGELN, DIE DAS ERGEBNIS EHRLICH HALTEN:
 *
 * 1. KEINE DOPPELZÄHLUNG. Haushaltsprodukte, deren Reichweite
 *    endet, stehen bereits als Position auf der Liste — `supplies`
 *    wird deshalb NICHT zusätzlich eingelesen. Dieselbe Sache über
 *    zwei Kanäle in dieselbe Summe laufen zu lassen, war in diesem
 *    Projekt schon zweimal der Fehler.
 *
 * 2. VERGANGENES IST HEUTE. Was überfällig ist oder schon verdorben
 *    sein dürfte, fällt auf den heutigen Tag statt aus der Woche zu
 *    fallen. Ein Streifen, der Überfälliges verschweigt, wäre
 *    beruhigender als die Lage.
 *
 * 3. EIN PRODUKT, EIN EREIGNIS JE TAG. Verdirbt etwas an dem Tag,
 *    an dem es auch wieder fällig wäre, zählt das Verderben — die
 *    dringendere der beiden Aussagen. Über die Woche verteilt darf
 *    dasselbe Produkt aber mehrfach vorkommen: dass der Joghurt am
 *    Dienstag aufgebraucht ist und am Freitag wieder ansteht, sind
 *    zwei verschiedene Tatsachen.
 * ================================================================
 */

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const HORIZON = 7;

/* Dringlichkeit, nicht Alphabet. Die Reihenfolge entscheidet, was
   bei einer Kollision stehen bleibt und was in der Anzeige oben
   steht. */
const KIND_RANK = { verderb: 0, tausch: 1, einkauf: 2 };

const KIND_TEXT = {
  verderb: "verdirbt",
  tausch: "tauschen",
  einkauf: "einkaufen"
};

/** Ein Datum um n Tage verschieben. Heißt nicht `addDays` — den
    Namen vergibt receiptArchive.js, und das Bündel duldet keinen
    zweiten. */
function dayPlus(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pulseWeekday(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

/** Auf den Streifen abbilden: alles Vergangene auf heute, alles
    jenseits der Woche fällt weg (null). */
function slotFor(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return null;
  const i = Math.round(days);
  if (i < 0) return 0;
  return i < HORIZON ? i : null;
}

/**
 * Die kommenden sieben Tage.
 *
 * @param {object} input
 * @param {Array} input.items        Vorschlagsliste (enthält Non-Food bereits)
 * @param {Array} input.inventory    geschätzter Bestand mit `daysLeft`
 * @param {Array} input.swapsDue     fällige Austauschprodukte
 * @param {object|null} input.pattern Einkaufsmuster aus shoppingDay.js
 * @param {string} today
 * @returns {{days:Array, total:number, todayCount:number, busiest:object|null,
 *            shoppingSlot:number|null, headline:string}}
 */
function weekPulse(input, today) {
  const items = input.items || [];
  const inventory = input.inventory || [];
  const swapsDue = input.swapsDue || [];
  const pattern = input.pattern || null;

  const days = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = dayPlus(today, i);
    const wd = pulseWeekday(date);
    days.push({
      index: i,
      date,
      weekday: wd,
      name: DAY_NAMES[wd],
      short: DAY_SHORT[wd],
      isToday: i === 0,
      isShoppingDay: false,
      events: [],
      count: 0
    });
  }

  const add = (slot, kind, productId, name, note) => {
    if (slot === null) return;
    const day = days[slot];
    const vorhanden = day.events.findIndex((e) => e.productId === productId && productId);
    const ereignis = { kind, productId: productId || null, name, note: note || KIND_TEXT[kind] };
    if (vorhanden < 0) { day.events.push(ereignis); return; }
    // Regel 3: bei gleichem Produkt am selben Tag gewinnt das
    // dringendere Ereignis, und es bleibt bei einem.
    if (KIND_RANK[kind] < KIND_RANK[day.events[vorhanden].kind]) day.events[vorhanden] = ereignis;
  };

  // Was verdirbt. Nur was wahrscheinlich noch da ist — das hat die
  // Bestandsschätzung schon gefiltert.
  inventory.forEach((inv) => {
    add(slotFor(inv.daysLeft), "verderb", inv.productId, inv.name,
      inv.dateSource === "aufgedruckt" ? "aufgedrucktes Datum" : "geschätzt");
  });

  // Was getauscht werden will.
  swapsDue.forEach((sw) => {
    add(slotFor(sw.due ? 0 : sw.daysLeft), "tausch", sw.productId, sw.name, null);
  });

  // Was auf die Liste gehört. `items` enthält Lebensmittel UND
  // Haushaltsprodukte — siehe Regel 1.
  items.forEach((it) => {
    add(slotFor(it.dueIn), "einkauf", it.productId, it.name, null);
  });

  days.forEach((d) => {
    d.events.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.name.localeCompare(b.name, "de"));
    d.count = d.events.length;
  });

  // Der gelernte Einkaufstag, sofern es einen gibt.
  let shoppingSlot = null;
  if (pattern && pattern.favouriteDay !== null && pattern.favouriteDay !== undefined) {
    const i = days.findIndex((d) => d.weekday === pattern.favouriteDay);
    if (i >= 0) { shoppingSlot = i; days[i].isShoppingDay = true; }
  }

  const total = days.reduce((a, d) => a + d.count, 0);
  const todayCount = days[0].count;
  const busiest = days.reduce((best, d) => (!best || d.count > best.count ? d : best), null);

  return {
    days, total, todayCount,
    busiest: busiest && busiest.count > 0 ? busiest : null,
    shoppingSlot,
    headline: headlineFor(days, total, shoppingSlot)
  };
}

/**
 * Ein Satz über die Woche.
 *
 * Zuerst das Verderbliche: das ist das Einzige, was sich nicht
 * nachholen lässt. Danach der Einkaufstag, weil er die Frage
 * beantwortet, bis wann etwas Zeit hat.
 */
function headlineFor(days, total, shoppingSlot) {
  if (!total) return "Diese Woche steht nichts an.";

  const verderb = days[0].events.filter((e) => e.kind === "verderb");
  if (verderb.length === 1) return `${verderb[0].name} sollte heute weg.`;
  if (verderb.length > 1) return `${verderb.length} Sachen sollten heute weg.`;

  const heute = days[0].count;
  if (heute > 0 && shoppingSlot === 0) return `Heute ist dein Einkaufstag — ${heute} ${heute === 1 ? "Sache" : "Sachen"} stehen an.`;
  if (shoppingSlot !== null && shoppingSlot > 0) {
    const bis = days.slice(0, shoppingSlot + 1).reduce((a, d) => a + d.count, 0);
    return `Bis ${days[shoppingSlot].name} ${bis === 1 ? "kommt eine Sache" : `kommen ${bis} Sachen`} zusammen.`;
  }
  if (heute > 0) return `Heute ${heute === 1 ? "steht eine Sache" : `stehen ${heute} Sachen`} an.`;

  const naechster = days.find((d) => d.count > 0);
  return `Als Nächstes ${naechster.index === 1 ? "morgen" : naechster.name}: ${naechster.count} ${naechster.count === 1 ? "Sache" : "Sachen"}.`;
}

module.exports = { weekPulse, DAY_SHORT, DAY_NAMES, HORIZON, KIND_TEXT };
