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
    ok("Anteil ist eine halbe Packung oder weniger", (s[0].share * 4) % 1 === 0 && s[0].share <= 0.75, s[0].share);
    ok("Nie die ganze Packung — dann hätte man gefroren gekauft", s[0].share < 1, s[0].share);
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


/* ================= seasonCalendar ================= */
const { seasonFor, offSeason, inSeasonNow, STATUS } = require("../src/algo/seasonCalendar");
section("Saison");
{
  const juni = seasonFor("erdbeeren", "2026-06-15");
  ok("Erdbeeren im Juni: Saison", juni.status === STATUS.PEAK, juni.status);
  const dez = seasonFor("erdbeeren", "2026-12-15");
  ok("Erdbeeren im Dezember: Importware", dez.status === STATUS.OFF, dez.status);
  ok("Meldung nennt die Saisonmonate", /Mai|Juni|Juli/.test(dez.message), dez.message);
  ok("Äpfel im Januar kommen aus dem Lager", seasonFor("aepfel", "2026-01-15").status === STATUS.AVAILABLE);
}
{
  ok("Produkte ohne Tabelle bekommen keinen Hinweis", seasonFor("bananen", "2026-12-15") === null);
  ok("Unbekannte Kennung bekommt keinen Hinweis", seasonFor("gibtsnicht", "2026-12-15") === null);
}
{
  const off = offSeason([{ productId: "erdbeeren" }, { productId: "bananen" }, { productId: "moehren" }], "2026-12-15");
  ok("Nur Ware außerhalb der Saison wird gemeldet",
    off.length === 1 && off[0].productId === "erdbeeren", off.map((o) => o.productId).join());
}
{
  const now = inSeasonNow("2026-06-15");
  ok("Was jetzt Saison hat, wird gelistet", now.length > 0, now.map((x) => x.productId).join());
  ok("Nur Produkte aus dem Katalog", now.every((x) => !!byId(x.productId)));
}

/* ================= openedTracker ================= */
const { openedItems, applyOpened, useUpFirst } = require("../src/algo/openedTracker");
section("Angebrochene Packungen");
{
  const opened = [{ productId: "konserve_tomaten", openedDate: day(-2) }];
  const items = openedItems(opened, day(0));
  if (items.length) {
    ok("Angebrochenes rechnet mit der kurzen Frist",
      items[0].shelfLifeOpenedDays < (byId("konserve_tomaten") || {}).shelfLifeDays,
      `${items[0].shelfLifeOpenedDays} statt ${(byId("konserve_tomaten") || {}).shelfLifeDays}`);
    ok("Verbleibende Tage werden gerechnet", Number.isFinite(items[0].daysLeft), items[0].daysLeft);
    ok("Meldung nennt den Namen", /Dose|Tomaten/i.test(items[0].message), items[0].message);
  } else {
    ok("Angebrochenes rechnet mit der kurzen Frist", false, "konserve_tomaten fehlt im Katalog");
    ok("Verbleibende Tage werden gerechnet", false);
    ok("Meldung nennt den Namen", false);
  }
}
{
  const opened = [{ productId: "joghurt_natur", openedDate: day(-30) }];
  const items = openedItems(opened, day(0));
  ok("Überfälliges wird als überfällig gemeldet", items[0].expired === true);
  ok("Überfälliges steht vorn", items[0].daysLeft < 0);
}
{
  const opened = [{ productId: "haehnchen", openedDate: day(-10) }];
  const items = openedItems(opened, day(0));
  ok("Verbrauchsdatum verlangt Entsorgung statt Verwertung",
    /entsorgen/i.test(items[0].message), items[0].message);
  ok("Abgelaufenes mit Verbrauchsdatum landet nicht im Aufbrauchplan",
    !useUpFirst(opened, day(0)).some((x) => x.productId === "haehnchen"));
}
{
  const inv = [{ productId: "joghurt_natur", name: "Naturjoghurt", daysLeft: 18, remainingUnits: 1, confidence: .8 }];
  const applied = applyOpened(inv, [{ productId: "joghurt_natur", openedDate: day(-3) }], day(0));
  ok("Bestandsschätzung übernimmt die kürzere Frist", applied[0].daysLeft < 18, applied[0].daysLeft);
  ok("Der Zustand wird vermerkt", applied[0].opened === true);
  ok("Restmenge bleibt unverändert", applied[0].remainingUnits === 1);
  const untouched = applyOpened(inv, [], day(0));
  ok("Ohne Angabe bleibt alles wie es war", untouched[0].daysLeft === 18 && !untouched[0].opened);
}

/* ================= shoppingDay ================= */
const { shoppingPattern, suggestedLookahead, MIN_RECEIPTS } = require("../src/algo/shoppingDay");
section("Einkaufsrhythmus des Haushalts");
{
  // Immer samstags, zehn Wochen lang
  const receipts = [];
  for (let i = 0; i < 10; i++) receipts.push({ date: day(-(i * 7)), total: 40 });
  const p = shoppingPattern(receipts, day(0));
  ok("Fester Wochentag wird erkannt", p.favouriteDay !== null, p.dayName);
  ok("Anteil wird beziffert", p.share >= 0.9, p.share);
  ok("Einkäufe pro Woche werden gerechnet", p.perWeek >= 0.8 && p.perWeek <= 1.3, p.perWeek);
  ok("Durchschnittskorb wird gerechnet", p.avgBasket === 40, p.avgBasket);
  ok("Nächster Einkaufstag wird genannt", p.daysUntilNext !== null && p.daysUntilNext >= 0, p.daysUntilNext);
  ok("Vorausschau folgt dem Abstand", suggestedLookahead(p) >= 1);
}
{
  // Gleichmäßig über alle Wochentage: kein Lieblingstag
  const receipts = [];
  for (let i = 0; i < 28; i++) receipts.push({ date: day(-i), total: 20 });
  const p = shoppingPattern(receipts, day(0));
  ok("Ohne Muster wird kein Tag behauptet", p.favouriteDay === null, p.dayName);
  ok("Stattdessen die Häufigkeit", /pro Woche/.test(p.message), p.message);
}
{
  const few = [{ date: day(-1), total: 10 }, { date: day(-8), total: 10 }];
  ok(`Unter ${MIN_RECEIPTS} Einkäufen keine Aussage`, shoppingPattern(few, day(0)) === null);
  ok("Ohne Muster keine Vorausschau-Empfehlung", suggestedLookahead(null) === null);
}

/* ================= listExport ================= */
const { listAsText, listAsLine } = require("../src/algo/listExport");
section("Liste als Text");
{
  const items = [
    { productId: "bananen", name: "Bananen", aisle: "Obst & Gemüse", price: 1.79 },
    { productId: "milch_vollmilch", name: "Vollmilch", aisle: "Kühlregal", price: 1.29, halved: true }
  ];
  const text = listAsText(items, { title: "Samstag" });
  ok("Überschrift steht oben", text.startsWith("Samstag"), text.split("\n")[0]);
  ok("Gänge werden benannt", /OBST & GEMÜSE/.test(text) && /KÜHLREGAL/.test(text));
  ok("Jede Position bekommt ein Kästchen", (text.match(/☐/g) || []).length === 2);
  ok("Halbe Menge wird vermerkt", /halbe Menge/.test(text));
  ok("Summe rechnet die halbe Menge mit", /2,44 €/.test(text), text.split("\n").pop());
  ok("Ohne Preise bleibt der Text preisfrei", !/€/.test(listAsText(items, { withPrices: false })));
}
{
  ok("Leere Liste sagt das auch", /Nichts auf der Liste/.test(listAsText([])));
  ok("Kurzfassung ist eine Zeile",
    listAsLine([{ name: "A" }, { name: "B" }]) === "A, B");
  ok("Leere Kurzfassung sagt das auch", /Nichts/.test(listAsLine([])));
}

console.log("\n" + "=".repeat(60));
console.log(`NEUE FUNKTIONEN: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
