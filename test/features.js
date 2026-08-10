/**
 * features.js — Tests der neuen Module
 *   stockRange, freezeAdvisor, priceMemory, forgottenDetector,
 *   safetyAlert, aisleOrder
 *
 *   node test/features.js
 */
const { stockRange, LIMIT } = require("../src/algo/stockRange");
const { freezeSuggestions } = require("../src/algo/freezeAdvisor");
const { priceMemory, allPriceMemories, MIN_PURCHASES } = require("../src/algo/priceMemory");
const { findForgotten } = require("../src/algo/forgottenDetector");
const { safetyAlert } = require("../src/algo/safetyAlert");
const { DEFAULT_AISLE_ORDER, orderFor, groupByAisle, moveAisle, relevantAisles } = require("../src/algo/aisleOrder");
const { computeAllRhythms } = require("../src/algo/rhythmEngine2");
const { estimateInventory } = require("../src/algo/inventoryEstimator");
const { byId } = require("../src/algo/foodDatabase");

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

const day = (offset, from = "2026-08-10") =>
  new Date(new Date(from + "T12:00:00Z").getTime() + offset * 86400000).toISOString().slice(0, 10);

/** Kaufreihe rückwärts von heute. */
function series(productId, everyDays, count, opts = {}) {
  const { lastGap = 0, quantity = 1, unitPrice } = opts;
  const p = byId(productId);
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      productId,
      date: day(-(lastGap + i * everyDays)),
      quantity,
      unitPrice: unitPrice ?? p.typicalPrice
    });
  }
  return rows.reverse();
}

/* ================= stockRange ================= */
section("Vorrats-Reichweite");
{
  const history = [
    ...series("milch_vollmilch", 6, 12, { lastGap: 3, quantity: 2 }),
    ...series("brot_vollkorn", 6, 12, { lastGap: 1 })
  ];
  const rhythms = computeAllRhythms(history);
  const inv = estimateInventory(history, rhythms, day(0));
  const r = stockRange(inv, rhythms);

  ok("Reichweite wird berechnet", typeof r.days === "number" && r.days >= 0, r.days);
  ok("Ergebnis ist als Schätzung markiert", r.estimated === true);
  ok("Das knappste Produkt begrenzt", r.limiting.length >= 1 && r.limiting[0].days <= r.days + 0.5);
  ok("Meldung nennt ein Produkt", /Vollmilch|Vollkornbrot|alle/.test(r.message), r.message);
  ok("Grenze ist benannt", [LIMIT.QUANTITY, LIMIT.FRESHNESS].includes(r.limitedBy), r.limitedBy);
}
{
  const r = stockRange([], new Map());
  ok("Ohne Bestand: keine erfundene Zahl", r.days === null && r.byProduct.length === 0);
  ok("Ohne Bestand: erklärende Meldung", /braucht/.test(r.message));
}
{
  // Frische begrenzt: viel gekauft, aber verderblich
  const history = series("salat_kopf", 14, 8, { lastGap: 5, quantity: 4 });
  const rhythms = computeAllRhythms(history);
  const inv = estimateInventory(history, rhythms, day(0));
  const r = stockRange(inv, rhythms);
  if (r.byProduct.length) {
    const s = r.byProduct.find((x) => x.productId === "salat_kopf");
    ok("Verderbliches wird von der Frische begrenzt, nicht von der Menge",
      !s || s.limitedBy === LIMIT.FRESHNESS || s.byFreshness <= s.byQuantity,
      s && `${s.byFreshness} vs ${s.byQuantity}`);
  } else ok("Verderbliches wird von der Frische begrenzt, nicht von der Menge", true);
}
{
  // Süßwaren lösen keinen Einkauf aus
  const history = series("schokolade", 7, 10, { lastGap: 6, quantity: 2 });
  const rhythms = computeAllRhythms(history);
  const inv = estimateInventory(history, rhythms, day(0));
  const r = stockRange(inv, rhythms);
  ok("Süßwaren zählen nicht als Grundnahrung",
    !r.byProduct.some((x) => x.productId === "schokolade"));
}

/* ================= freezeAdvisor ================= */
section("Einfrier-Empfehlung");
{
  // Hähnchen: 3 Tage haltbar, alle 9 Tage gekauft -> Überschuss
  const history = series("haehnchen", 9, 10, { lastGap: 0 });
  const rhythms = computeAllRhythms(history);
  const s = freezeSuggestions([{ productId: "haehnchen", quantity: 1, unitPrice: 6.99 }], rhythms);
  ok("Überschuss wird erkannt", s.length === 1, s.length);
  if (s.length) {
    ok("Betrag wird beziffert", s[0].valueAtRisk > 0, s[0].valueAtRisk);
    ok("Anteil ist eine halbe oder ganze Packung", (s[0].share * 2) % 1 === 0, s[0].share);
    ok("Verbrauchsdatum wird als solches benannt", s[0].safetyCritical === true && /nie nach Ablauf/.test(s[0].message));
    ok("Meldung nennt Haltbarkeit und Betrag", /Tagen/.test(s[0].message) && /€/.test(s[0].message));
  }
}
{
  // Nudeln halten 540 Tage — nie eine Empfehlung
  const history = series("nudeln", 21, 8, { lastGap: 0, quantity: 2 });
  const rhythms = computeAllRhythms(history);
  const s = freezeSuggestions([{ productId: "nudeln", quantity: 2, unitPrice: 1.29 }], rhythms);
  ok("Lange Haltbarkeit erzeugt keinen Hinweis", s.length === 0);
}
{
  const s = freezeSuggestions([{ productId: "klopapier", quantity: 1, unitPrice: 3.99 }], new Map());
  ok("Non-Food bekommt keine Einfrier-Empfehlung", s.length === 0);
}
{
  const s = freezeSuggestions([{ productId: "haehnchen", quantity: 1 }], new Map());
  ok("Ohne Rhythmus wird nicht geraten", s.length === 0);
}
{
  const s = freezeSuggestions([{ productId: "milch_vollmilch", quantity: 9 }],
    computeAllRhythms(series("milch_vollmilch", 6, 10, { lastGap: 0 })));
  ok("Nicht einfrierbare Produkte bleiben außen vor", s.length === 0);
}

/* ================= priceMemory ================= */
section("Preis-Gedächtnis");
{
  const history = [
    { productId: "butter", date: day(-80), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(-60), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(-40), quantity: 1, unitPrice: 2.19 },
    { productId: "butter", date: day(-20), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(0), quantity: 1, unitPrice: 2.99 }
  ];
  const m = priceMemory("butter", history);
  ok("Üblicher Preis ist der Median", m.usual === 2.29, m.usual);
  ok("Letzter Preis wird erkannt", m.last === 2.99);
  ok("Teuer wird als teuer benannt", m.verdict === "teuer", m.verdict);
  ok("Spanne wird geführt", m.lowest === 2.19 && m.highest === 2.99);
  ok("Meldung nennt beide Preise", /2,99/.test(m.message) && /2,29/.test(m.message), m.message);
}
{
  const history = [
    { productId: "kaffee", date: day(-40), quantity: 1, unitPrice: 7.49 },
    { productId: "kaffee", date: day(-20), quantity: 1, unitPrice: 7.49 },
    { productId: "kaffee", date: day(0), quantity: 1, unitPrice: 4.99 }
  ];
  ok("Günstig wird als günstig benannt", priceMemory("kaffee", history).verdict === "günstig");
}
{
  const few = [
    { productId: "eier", date: day(-10), quantity: 1, unitPrice: 3.29 },
    { productId: "eier", date: day(0), quantity: 1, unitPrice: 3.49 }
  ];
  ok(`Unter ${MIN_PURCHASES} Käufen keine Aussage`, priceMemory("eier", few) === null);
}
{
  const bad = [
    { productId: "eier", date: day(-10), quantity: 1, unitPrice: 0 },
    { productId: "eier", date: day(-5), quantity: 1, unitPrice: null },
    { productId: "eier", date: day(0), quantity: 1, unitPrice: 3.49 }
  ];
  ok("Preise von 0 und null werden verworfen", priceMemory("eier", bad) === null);
}
{
  const history = [
    ...series("butter", 20, 4, { lastGap: 0, unitPrice: 2.29 }),
    ...series("eier", 11, 4, { lastGap: 0, unitPrice: 3.29 })
  ];
  ok("Alle Produkte auf einmal", allPriceMemories(history).size === 2);
}

/* ================= forgottenDetector ================= */
section("Vergessens-Detektor");
{
  // Zahnpasta alle 35 Tage, zuletzt vor 63 Tagen
  const history = [
    { productId: "zahnpasta", date: day(-168), quantity: 1, unitPrice: 1.49 },
    { productId: "zahnpasta", date: day(-133), quantity: 1, unitPrice: 1.49 },
    { productId: "zahnpasta", date: day(-98), quantity: 1, unitPrice: 1.49 },
    { productId: "zahnpasta", date: day(-63), quantity: 1, unitPrice: 1.49 }
  ];
  const rhythms = computeAllRhythms(history);
  const f = findForgotten(rhythms, day(0));
  const hit = f.find((x) => x.productId === "zahnpasta");
  ok("Überfälliges Non-Food wird gefunden", !!hit, byId("zahnpasta") ? "Produkt existiert" : "Produkt fehlt im Katalog");
  if (hit) {
    ok("Verhältnis wird beziffert", hit.ratio >= 1.6, hit.ratio);
    ok("Meldung nennt Zeitraum und Rhythmus", /zuletzt/.test(hit.message) && /sonst/.test(hit.message), hit.message);
    ok("Lange Rhythmen werden in Wochen gelesen", /Wochen/.test(hit.message), hit.message);
  }
}
{
  // Pünktlich gekauft -> nicht vergessen
  const history = series("milch_vollmilch", 6, 10, { lastGap: 2 });
  const rhythms = computeAllRhythms(history);
  ok("Pünktliches wird nicht gemeldet",
    !findForgotten(rhythms, day(0)).some((x) => x.productId === "milch_vollmilch"));
}
{
  // Seit einem halben Jahr nicht mehr -> aufgegeben, nicht vergessen
  const history = [
    { productId: "bier", date: day(-400), quantity: 6, unitPrice: 0.79 },
    { productId: "bier", date: day(-386), quantity: 6, unitPrice: 0.79 },
    { productId: "bier", date: day(-372), quantity: 6, unitPrice: 0.79 }
  ];
  const rhythms = computeAllRhythms(history);
  ok("Endgültig Abgesetztes wird nicht als vergessen gemeldet",
    !findForgotten(rhythms, day(0)).some((x) => x.productId === "bier"));
}
{
  const history = [
    { productId: "butter", date: day(-60), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(-40), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(-20), quantity: 1, unitPrice: 2.29 },
    { productId: "butter", date: day(-45), quantity: 1, unitPrice: 2.29 }
  ];
  const rhythms = computeAllRhythms(history);
  ok("Was auf der Liste steht, wird nicht doppelt gemeldet",
    !findForgotten(rhythms, day(0), { exclude: new Set(["butter"]) }).some((x) => x.productId === "butter"));
}

/* ================= safetyAlert ================= */
section("Sicherheits-Sofortwarnung");
{
  const a = safetyAlert([
    { productId: "haehnchen", quantity: 1 },
    { productId: "nudeln", quantity: 2 }
  ]);
  ok("Verbrauchsdatum löst eine Warnung aus", a !== null);
  ok("Nur das kritische Produkt wird genannt", a.products.length === 1 && a.products[0].productId === "haehnchen");
  ok("Kälteste Zone wird genannt", /kälteste/.test(a.message), a.message);
  ok("Der Müll-Hinweis fehlt nicht", /Müll/.test(a.message));
  ok("Quelle wird mitgeliefert", /BZfE/.test(a.source));
}
{
  ok("Ohne kritisches Produkt keine Warnung",
    safetyAlert([{ productId: "nudeln", quantity: 1 }, { productId: "reis", quantity: 1 }]) === null);
  ok("Leerer Einkauf erzeugt keine Warnung", safetyAlert([]) === null);
}
{
  const a = safetyAlert([
    { productId: "haehnchen", quantity: 1 },
    { productId: "haehnchen", quantity: 1 }
  ]);
  ok("Doppelte Zeilen werden zusammengefasst", a.products.length === 1);
}

/* ================= aisleOrder ================= */
section("Gangreihenfolge");
{
  const items = [
    { name: "Milch", aisle: "Kühlregal" },
    { name: "Banane", aisle: "Obst & Gemüse" },
    { name: "Eis", aisle: "Tiefkühl" }
  ];
  const groups = groupByAisle(items, DEFAULT_AISLE_ORDER);
  ok("Gruppen folgen der Reihenfolge",
    groups.map((g) => g.aisle).join(",") === "Obst & Gemüse,Kühlregal,Tiefkühl",
    groups.map((g) => g.aisle).join(","));
  ok("Tiefkühl steht zuletzt", groups[groups.length - 1].aisle === "Tiefkühl");
}
{
  const items = [{ name: "X", aisle: "Blumen" }, { name: "Y", aisle: "Kühlregal" }];
  const groups = groupByAisle(items, DEFAULT_AISLE_ORDER);
  ok("Unbekannte Gänge fallen ans Ende statt raus",
    groups.length === 2 && groups[1].aisle === "Blumen");
  const count = groups.reduce((s, g) => s + g.items.length, 0);
  ok("Keine Position geht verloren", count === items.length, count);
}
{
  const moved = moveAisle(DEFAULT_AISLE_ORDER, "Getränke", -1);
  ok("Gang lässt sich verschieben",
    moved.indexOf("Getränke") === DEFAULT_AISLE_ORDER.indexOf("Getränke") - 1);
  ok("Zug über den Rand ändert nichts",
    moveAisle(DEFAULT_AISLE_ORDER, "Obst & Gemüse", -1)[0] === "Obst & Gemüse");
  ok("Unbekannter Gang ändert nichts",
    moveAisle(DEFAULT_AISLE_ORDER, "Gibtsnicht", 1).join() === DEFAULT_AISLE_ORDER.join());
  ok("Verschieben verändert die Vorlage nicht",
    DEFAULT_AISLE_ORDER.indexOf("Getränke") === 7, DEFAULT_AISLE_ORDER.indexOf("Getränke"));
}
{
  ok("Ohne Speicherung gilt die Voreinstellung",
    orderFor("REWE", {}).join() === DEFAULT_AISLE_ORDER.join());
  ok("Gespeicherte Reihenfolge wird gefunden (Groß-/Kleinschreibung egal)",
    orderFor("ReWe", { rewe: ["Getränke", "Kühlregal"] }).join() === "Getränke,Kühlregal");
  ok("Leere Speicherung fällt auf die Voreinstellung zurück",
    orderFor("REWE", { rewe: [] }).join() === DEFAULT_AISLE_ORDER.join());
}
{
  const items = [{ aisle: "Kühlregal" }, { aisle: "Blumen" }];
  const rel = relevantAisles(DEFAULT_AISLE_ORDER, items);
  ok("Nur benutzte Gänge werden zum Sortieren angeboten",
    rel.join() === "Kühlregal,Blumen", rel.join());
}

console.log("\n" + "=".repeat(60));
console.log(`NEUE FUNKTIONEN: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
