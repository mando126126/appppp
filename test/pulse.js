/**
 * pulse.js — Tests für den Wochenstreifen
 * ================================================================
 * Der Streifen auf der Startseite ist die erste Zahl, die jemand
 * sieht — und die einzige, die drei Quellen zusammenführt: Rhythmus,
 * Bestandsschätzung, Austauschintervall. Genau diese Stelle war in
 * diesem Projekt zweimal die Fehlerquelle: EIN Ereignis, das über
 * ZWEI Kanäle in dieselbe Summe läuft.
 *
 * Geprüft wird deshalb weniger das Beispiel als die Invariante:
 *
 *   A) Form         — immer sieben Tage, ab heute, lückenlos
 *   B) Zuordnung    — Überfälliges auf heute, Fernes fällt raus
 *   C) Doppelzählung — dasselbe Produkt am selben Tag nur einmal
 *   D) Satz         — die Überschrift stimmt mit den Tagen überein
 *   E) Zufallsdaten — 3000 erfundene Wochen, keine Ausnahme
 * ================================================================
 */

const { weekPulse, HORIZON } = require("../src/algo/weekPulse");

let pass = 0, fail = 0;
const problems = [];

function t(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) { pass++; return; }
    fail++; problems.push(`${name}: ${result}`);
    console.log(`  FEHL  ${name}\n        ${result}`);
  } catch (e) {
    fail++; problems.push(`${name}: ABSTURZ ${e.message}`);
    console.log(`  ABSTURZ ${name}\n        ${e.message}`);
  }
}

const section = (title) => console.log(`\n--- ${title} ---`);

const HEUTE = "2026-08-13";           // ein Donnerstag
const leer = { items: [], inventory: [], swapsDue: [], pattern: null };

/* ================================================================
   A) Form
   ================================================================ */
section("A) Form");

t("immer sieben Tage", () => {
  const p = weekPulse(leer, HEUTE);
  return p.days.length === HORIZON ? true : `${p.days.length} Tage`;
});

t("erster Tag ist heute", () => {
  const p = weekPulse(leer, HEUTE);
  return p.days[0].date === HEUTE && p.days[0].isToday ? true : p.days[0].date;
});

t("lückenlos aufeinanderfolgend", () => {
  const p = weekPulse(leer, HEUTE);
  for (let i = 1; i < p.days.length; i++) {
    const vor = new Date(p.days[i - 1].date + "T12:00:00Z");
    const jetzt = new Date(p.days[i].date + "T12:00:00Z");
    const diff = (jetzt - vor) / 86400000;
    if (Math.round(diff) !== 1) return `Sprung von ${p.days[i - 1].date} auf ${p.days[i].date}`;
  }
  return true;
});

t("Wochentagsnamen stimmen", () => {
  const p = weekPulse(leer, HEUTE);
  return p.days[0].name === "Donnerstag" && p.days[0].short === "Do"
    ? true : `${p.days[0].name}/${p.days[0].short}`;
});

t("über den Monatswechsel hinweg", () => {
  const p = weekPulse(leer, "2026-08-29");
  return p.days[6].date === "2026-09-04" ? true : p.days[6].date;
});

t("über den Jahreswechsel hinweg", () => {
  const p = weekPulse(leer, "2026-12-30");
  return p.days[6].date === "2027-01-05" ? true : p.days[6].date;
});

t("leere Woche sagt das auch", () => {
  const p = weekPulse(leer, HEUTE);
  return p.total === 0 && /nichts an/.test(p.headline) ? true : p.headline;
});

t("fehlende Felder stürzen nicht ab", () => {
  const p = weekPulse({}, HEUTE);
  return p.days.length === HORIZON && p.total === 0 ? true : "wirft oder rechnet falsch";
});

/* ================================================================
   B) Zuordnung
   ================================================================ */
section("B) Zuordnung");

t("fällig in 2 Tagen landet auf Tag 2", () => {
  const p = weekPulse({ ...leer, items: [{ productId: "milch", name: "Milch", dueIn: 2 }] }, HEUTE);
  return p.days[2].count === 1 && p.days[2].events[0].kind === "einkauf"
    ? true : JSON.stringify(p.days.map((d) => d.count));
});

t("überfällig landet auf heute", () => {
  const p = weekPulse({ ...leer, items: [{ productId: "milch", name: "Milch", dueIn: -9 }] }, HEUTE);
  return p.days[0].count === 1 ? true : "nicht auf heute";
});

t("jenseits der Woche fällt raus", () => {
  const p = weekPulse({ ...leer, items: [{ productId: "reis", name: "Reis", dueIn: 7 }] }, HEUTE);
  return p.total === 0 ? true : "Tag 7 ist noch drin";
});

t("Tag 6 ist noch drin", () => {
  const p = weekPulse({ ...leer, items: [{ productId: "reis", name: "Reis", dueIn: 6 }] }, HEUTE);
  return p.days[6].count === 1 ? true : "Tag 6 fehlt";
});

t("verdorben landet als verderb, nicht als einkauf", () => {
  const p = weekPulse({ ...leer, inventory: [{ productId: "joghurt", name: "Joghurt", daysLeft: 1 }] }, HEUTE);
  return p.days[1].events[0].kind === "verderb" ? true : p.days[1].events[0].kind;
});

t("bereits abgelaufen zählt heute", () => {
  const p = weekPulse({ ...leer, inventory: [{ productId: "joghurt", name: "Joghurt", daysLeft: -3 }] }, HEUTE);
  return p.days[0].count === 1 && p.days[0].events[0].kind === "verderb" ? true : "verschwunden";
});

t("fälliger Austausch zählt heute", () => {
  const p = weekPulse({ ...leer, swapsDue: [{ productId: "zahnbuerste", name: "Zahnbürste", due: true, daysLeft: -4 }] }, HEUTE);
  return p.days[0].events[0].kind === "tausch" ? true : "nicht heute";
});

t("kommender Austausch zählt an seinem Tag", () => {
  const p = weekPulse({ ...leer, swapsDue: [{ productId: "schwamm", name: "Schwamm", due: false, daysLeft: 3 }] }, HEUTE);
  return p.days[3].count === 1 ? true : "falscher Tag";
});

t("manuelle Zeilen ohne Fälligkeit tauchen nicht auf", () => {
  const p = weekPulse({ ...leer, items: [{ productId: null, name: "Blumen für Oma", dueIn: null }] }, HEUTE);
  return p.total === 0 ? true : "erfundener Tag";
});

t("aufgedrucktes Datum wird als solches vermerkt", () => {
  const p = weekPulse({ ...leer,
    inventory: [{ productId: "hack", name: "Hackfleisch", daysLeft: 1, dateSource: "aufgedruckt" }] }, HEUTE);
  return p.days[1].events[0].note === "aufgedrucktes Datum" ? true : p.days[1].events[0].note;
});

/* ================================================================
   C) Keine Doppelzählung
   ================================================================ */
section("C) Keine Doppelzählung");

t("dasselbe Produkt am selben Tag zählt einmal", () => {
  const p = weekPulse({
    ...leer,
    items: [{ productId: "milch", name: "Milch", dueIn: 1 }],
    inventory: [{ productId: "milch", name: "Milch", daysLeft: 1 }]
  }, HEUTE);
  return p.days[1].count === 1 ? true : `${p.days[1].count} Ereignisse`;
});

t("dabei gewinnt das dringendere", () => {
  const p = weekPulse({
    ...leer,
    items: [{ productId: "milch", name: "Milch", dueIn: 1 }],
    inventory: [{ productId: "milch", name: "Milch", daysLeft: 1 }]
  }, HEUTE);
  return p.days[1].events[0].kind === "verderb" ? true : p.days[1].events[0].kind;
});

t("Reihenfolge der Quellen ändert nichts", () => {
  const a = weekPulse({
    ...leer,
    items: [{ productId: "milch", name: "Milch", dueIn: 1 }],
    swapsDue: [{ productId: "milch", name: "Milch", due: false, daysLeft: 1 }]
  }, HEUTE);
  return a.days[1].count === 1 && a.days[1].events[0].kind === "tausch"
    ? true : `${a.days[1].count}/${a.days[1].events[0].kind}`;
});

t("an verschiedenen Tagen zählt dasselbe Produkt zweimal", () => {
  // Das ist kein Fehler: aufgebraucht am Dienstag, wieder fällig am
  // Freitag sind zwei verschiedene Tatsachen.
  const p = weekPulse({
    ...leer,
    items: [{ productId: "milch", name: "Milch", dueIn: 4 }],
    inventory: [{ productId: "milch", name: "Milch", daysLeft: 1 }]
  }, HEUTE);
  return p.total === 2 ? true : `${p.total} statt 2`;
});

t("Vorräte kommen nicht zusätzlich herein", () => {
  // supplies wird bewusst nicht eingelesen — was ausgeht, steht schon
  // als Position in items. Die Signatur darf das nicht heimlich
  // wieder aufnehmen.
  const p = weekPulse({
    ...leer,
    items: [{ productId: "spuelmittel", name: "Spülmittel", dueIn: 2 }],
    supplies: [{ productId: "spuelmittel", name: "Spülmittel", daysOfSupply: 2, dueForPurchase: true }]
  }, HEUTE);
  return p.total === 1 ? true : `${p.total} statt 1`;
});

t("Gesamtzahl ist die Summe der Tage", () => {
  const p = weekPulse({
    ...leer,
    items: [
      { productId: "milch", name: "Milch", dueIn: 0 },
      { productId: "brot", name: "Brot", dueIn: 2 },
      { productId: "eier", name: "Eier", dueIn: 5 }
    ]
  }, HEUTE);
  const summe = p.days.reduce((a, d) => a + d.count, 0);
  return summe === p.total ? true : `${summe} ≠ ${p.total}`;
});

/* ================================================================
   D) Einkaufstag und Satz
   ================================================================ */
section("D) Einkaufstag und Satz");

t("Lieblingstag wird markiert", () => {
  // Heute ist Donnerstag (4); Samstag ist 6, also zwei Tage weiter.
  const p = weekPulse({ ...leer, pattern: { favouriteDay: 6 } }, HEUTE);
  return p.shoppingSlot === 2 && p.days[2].isShoppingDay ? true : String(p.shoppingSlot);
});

t("ohne Lieblingstag keine Markierung", () => {
  const p = weekPulse({ ...leer, pattern: { favouriteDay: null } }, HEUTE);
  return p.shoppingSlot === null && p.days.every((d) => !d.isShoppingDay) ? true : "markiert trotzdem";
});

t("genau ein Tag ist markiert", () => {
  const p = weekPulse({ ...leer, pattern: { favouriteDay: 1 } }, HEUTE);
  return p.days.filter((d) => d.isShoppingDay).length === 1 ? true : "mehrfach markiert";
});

t("Verderbliches steht im Satz vor allem anderen", () => {
  const p = weekPulse({
    ...leer,
    items: [{ productId: "brot", name: "Brot", dueIn: 0 }],
    inventory: [{ productId: "joghurt", name: "Joghurt", daysLeft: 0 }]
  }, HEUTE);
  return /Joghurt/.test(p.headline) ? true : p.headline;
});

t("mehrere Verderbliche werden gezählt, nicht aufgezählt", () => {
  const p = weekPulse({
    ...leer,
    inventory: [
      { productId: "joghurt", name: "Joghurt", daysLeft: 0 },
      { productId: "salat", name: "Salat", daysLeft: 0 }
    ]
  }, HEUTE);
  return /2 Sachen/.test(p.headline) ? true : p.headline;
});

t("Einkaufstag heute wird gesagt", () => {
  const p = weekPulse({
    ...leer,
    items: [{ productId: "brot", name: "Brot", dueIn: 0 }],
    pattern: { favouriteDay: 4 }
  }, HEUTE);
  return /Einkaufstag/.test(p.headline) ? true : p.headline;
});

t("bis zum Einkaufstag wird zusammengezählt", () => {
  const p = weekPulse({
    ...leer,
    items: [
      { productId: "brot", name: "Brot", dueIn: 1 },
      { productId: "milch", name: "Milch", dueIn: 2 }
    ],
    pattern: { favouriteDay: 6 }   // Samstag = Tag 2
  }, HEUTE);
  return /Samstag/.test(p.headline) && /2 Sachen/.test(p.headline) ? true : p.headline;
});

t("nichts heute: der nächste Tag wird genannt", () => {
  const p = weekPulse({ ...leer, items: [{ productId: "brot", name: "Brot", dueIn: 1 }] }, HEUTE);
  return /morgen/.test(p.headline) ? true : p.headline;
});

t("der volle Tag ist der volle Tag", () => {
  const p = weekPulse({
    ...leer,
    items: [
      { productId: "brot", name: "Brot", dueIn: 3 },
      { productId: "milch", name: "Milch", dueIn: 3 },
      { productId: "eier", name: "Eier", dueIn: 5 }
    ]
  }, HEUTE);
  return p.busiest && p.busiest.index === 3 ? true : String(p.busiest && p.busiest.index);
});

t("leere Woche hat keinen vollen Tag", () => {
  const p = weekPulse(leer, HEUTE);
  return p.busiest === null ? true : "busiest gesetzt";
});

t("Ereignisse eines Tages stehen nach Dringlichkeit", () => {
  const p = weekPulse({
    ...leer,
    items: [{ productId: "brot", name: "Brot", dueIn: 0 }],
    swapsDue: [{ productId: "schwamm", name: "Schwamm", due: true }],
    inventory: [{ productId: "joghurt", name: "Joghurt", daysLeft: 0 }]
  }, HEUTE);
  const arten = p.days[0].events.map((e) => e.kind);
  return arten.join(",") === "verderb,tausch,einkauf" ? true : arten.join(",");
});

/* ================================================================
   E) Zufallsdaten
   ================================================================ */
section("E) Zufallsdaten");

let seed = 4711;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (n) => Math.floor(rnd() * n);

t("3000 erfundene Wochen halten alle Invarianten", () => {
  for (let i = 0; i < 3000; i++) {
    const items = [];
    const inventory = [];
    const swapsDue = [];
    for (let k = 0; k < pick(9); k++) {
      items.push({ productId: "p" + pick(12), name: "P" + pick(12), dueIn: pick(30) - 12 });
    }
    for (let k = 0; k < pick(6); k++) {
      inventory.push({ productId: "p" + pick(12), name: "P" + pick(12), daysLeft: pick(30) - 12 });
    }
    for (let k = 0; k < pick(4); k++) {
      swapsDue.push({ productId: "p" + pick(12), name: "P" + pick(12), due: rnd() < 0.4, daysLeft: pick(20) - 5 });
    }
    const heute = `2026-${String(1 + pick(12)).padStart(2, "0")}-${String(1 + pick(28)).padStart(2, "0")}`;
    const pattern = rnd() < 0.6 ? { favouriteDay: pick(7) } : null;
    const p = weekPulse({ items, inventory, swapsDue, pattern }, heute);

    if (p.days.length !== HORIZON) return `Tage: ${p.days.length}`;
    if (p.days[0].date !== heute) return `Start: ${p.days[0].date}`;
    if (p.total !== p.days.reduce((a, d) => a + d.count, 0)) return "Summe stimmt nicht";
    if (p.total > items.length + inventory.length + swapsDue.length) return "mehr Ereignisse als Quellen";
    if (typeof p.headline !== "string" || !p.headline.length) return "kein Satz";
    if (/\bundefined\b|\bNaN\b|\bnull\b/.test(p.headline)) return `kaputter Satz: ${p.headline}`;
    for (const d of p.days) {
      const ids = d.events.map((e) => e.productId).filter(Boolean);
      if (new Set(ids).size !== ids.length) return `Doppelung am ${d.date}`;
      if (d.count !== d.events.length) return "count weicht ab";
    }
    if (p.shoppingSlot !== null && !p.days[p.shoppingSlot].isShoppingDay) return "Markierung daneben";
  }
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`WOCHENSTREIFEN: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
