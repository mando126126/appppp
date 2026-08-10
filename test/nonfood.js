/**
 * nonfood.js — Tests der Haushaltsprodukt-Erweiterung
 *
 * Schwerpunkt sind Zeitreisen: alle Prognosen hängen am Datum, und
 * genau dort liegen die Fehler, die ein Test mit festem „heute" nie
 * sieht. Dazu die Grenzfälle aus der Spezifikation — Vorratskauf,
 * fehlende Menge, Division durch null, SPORADIC ohne Reichweite.
 *
 *   node test/nonfood.js
 */
const {
  NONFOOD, CLASS, nonFoodFor, isNonFood, byClass, appliesTo, fullProduct,
  nonFoodQualityReport, HARDNESS_FACTOR
} = require("../src/algo/nonFoodCatalog");
const { dailyUsage, supplyFor, supplyOverview, leadTime } = require("../src/algo/consumptionModel");
const { learnRate, learnAllRates, variationCoefficient, CONFIDENCE } = require("../src/algo/rateLearner");
const { intervalFor, swapStatus, dueSwaps, recordSwap, needsRestock } = require("../src/algo/intervalTracker");
const { basePrice, pricePercentile, nonFoodSavings, MIN_PRICE_POINTS } = require("../src/algo/basePrice");
const { stockUpAdvice, learnPromoCycle } = require("../src/algo/stockUpAdvisor");
const { parseQuantity, packageValueFor, guessDomain, enrichLine } = require("../src/algo/quantityParser");
const { byId } = require("../src/algo/foodDatabase");

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

const T0 = "2026-08-10";
const day = (offset, from = T0) =>
  new Date(new Date(from + "T12:00:00Z").getTime() + offset * 86400000).toISOString().slice(0, 10);

const HOUSEHOLD = { personCount: 2, waterHardness: "mittel", shoppingIntervalDays: 6,
  hasDishwasher: true, hasWashingMachine: true, hasCoffeeMachine: true, hasWaterFilter: true };

/* ================= Katalog ================= */
section("Katalog");
{
  const q = nonFoodQualityReport();
  ok("Alle Verbrauchsmodelle haben ein Katalogprodukt", q.missing.length === 0, q.missing.join(", "));
  ok("Vier Verbrauchsklassen sind belegt",
    q.rate > 0 && q.interval > 0 && q.sporadic > 0 && q.datedCount > 0,
    `RATE ${q.rate}, INTERVAL ${q.interval}, SPORADIC ${q.sporadic}, DATED ${q.datedCount}`);
  ok("Alle 18 Rate-Produkte aus der Referenztabelle sind da", q.rate >= 18, q.rate);
  ok("Alle 9 Intervall-Produkte sind da", q.interval >= 9, q.interval);
  ok("Jeder Eintrag nennt eine Quelle",
    Object.values(NONFOOD).every((x) => x.rateSource || x.intervalSource || x.datedSource || x.consumptionClass === CLASS.SPORADIC));
}
{
  ok("Körperpflege ist in der WG nicht geteilt",
    ["zahnpasta", "deo", "shampoo", "duschgel"].every((id) => nonFoodFor(id).sharedByDefault === false));
  ok("Haushaltsware ist in der WG geteilt",
    ["klopapier", "spuelmittel", "muellbeutel"].every((id) => nonFoodFor(id).sharedByDefault === true));
}
{
  ok("Entkalker braucht eine Kaffeemaschine",
    !appliesTo("entkalker", { hasCoffeeMachine: false }) && appliesTo("entkalker", { hasCoffeeMachine: true }));
  ok("Spülmaschinentabs brauchen eine Spülmaschine",
    !appliesTo("spuelmaschinentabs", { hasDishwasher: false }));
  ok("Produkte ohne Gerätebedarf gelten immer", appliesTo("klopapier", {}));
}

/* ================= Verbrauchsmodell ================= */
section("Verbrauchsmodell");
{
  const one = dailyUsage("zahnpasta", { personCount: 1 });
  const four = dailyUsage("zahnpasta", { personCount: 4 });
  ok("Zahnpasta skaliert linear", Math.abs(four - one * 4) < 0.01, `${one} -> ${four}`);

  const w1 = dailyUsage("waschmittel", { personCount: 1 });
  const w4 = dailyUsage("waschmittel", { personCount: 4 });
  ok("Waschmittel skaliert degressiv", w4 > w1 && w4 < w1 * 4, `${w1} -> ${w4}`);

  const a1 = dailyUsage("allzweckreiniger", { personCount: 1 });
  const a4 = dailyUsage("allzweckreiniger", { personCount: 4 });
  ok("Allzweckreiniger skaliert gar nicht", Math.abs(a4 - a1) < 0.001, `${a1} -> ${a4}`);
}
{
  // Die gelernte Rate ist bereits eine HAUSHALTSrate. Wird sie erneut
  // mit der Haushaltsgröße multipliziert, ist jede Packung doppelt so
  // schnell leer — dieser Fehler war einmal drin und fiel erst in der
  // Demo-Historie auf, wo plötzlich alles auf 0 Tagen stand.
  const learned = 3.0;
  ok("Gelernte Rate wird nicht ein zweites Mal skaliert",
    dailyUsage("zahnpasta", { personCount: 2 }, learned) === learned,
    dailyUsage("zahnpasta", { personCount: 2 }, learned));
  ok("Gelernte Rate ist von der Haushaltsgröße unabhängig",
    dailyUsage("zahnpasta", { personCount: 1 }, learned) ===
    dailyUsage("zahnpasta", { personCount: 6 }, learned));
  ok("Ohne gelernte Rate wird der Katalogwert skaliert",
    dailyUsage("zahnpasta", { personCount: 2 }) === 3, dailyUsage("zahnpasta", { personCount: 2 }));

  // Gegenprobe über die ganze Kette: regelmäßige Käufe alle 25 Tage,
  // Packung 75 ml, zuletzt vor 22 Tagen -> es muss Rest übrig sein.
  const purchases = [-150, -125, -100, -75, -50, -25].map((d) =>
    ({ date: day(d), quantity: 1, packageValue: 75 }));
  purchases.push({ date: day(-22), quantity: 1, packageValue: 75 });
  const r2 = learnRate("zahnpasta", purchases, T0, HOUSEHOLD);
  const s2 = supplyFor({ productId: "zahnpasta", purchases }, T0, HOUSEHOLD,
    { learnedRate: r2.rate, confidence: r2.confidence });
  ok("Regelmäßiger Kauf hinterlässt Restmenge statt leerer Packung",
    s2.remaining > 0 && s2.daysOfSupply > 0,
    `Rate ${r2.rate}, Rest ${s2.remaining}, ${s2.daysOfSupply} Tage`);
}
{
  ok("Haushaltsgröße 0 erzeugt keine Division durch null",
    dailyUsage("zahnpasta", { personCount: 0 }) > 0, dailyUsage("zahnpasta", { personCount: 0 }));
  ok("Fehlendes Profil erzeugt keinen Fehler", dailyUsage("klopapier", {}) > 0);
  ok("Nicht-Rate-Produkte liefern keine Rate", dailyUsage("zahnbuerste", HOUSEHOLD) === null);
}
{
  const hard = dailyUsage("waschmittel", { ...HOUSEHOLD, waterHardness: "hart" });
  const soft = dailyUsage("waschmittel", { ...HOUSEHOLD, waterHardness: "weich" });
  ok("Hartes Wasser verbraucht mehr Waschmittel", hard > soft, `hart ${hard} > weich ${soft}`);
  ok("Zahnpasta ist von der Wasserhärte unberührt",
    dailyUsage("zahnpasta", { ...HOUSEHOLD, waterHardness: "hart" }) ===
    dailyUsage("zahnpasta", { ...HOUSEHOLD, waterHardness: "weich" }));
}
{
  const entry = { productId: "zahnpasta", purchases: [{ date: day(-10), quantity: 1, packageValue: 75 }] };
  const s = supplyFor(entry, T0, HOUSEHOLD);
  ok("Reichweite wird berechnet", s.daysOfSupply > 0, s.daysOfSupply);
  ok("Restmenge sinkt mit der Zeit", s.remaining < 75, s.remaining);
  ok("Meldung nennt Tage", /reicht noch/.test(s.message), s.message);
  ok("Vorwarnzeit folgt dem Einkaufsrhythmus", s.leadTime === Math.round(6 * 1.5 + 2), s.leadTime);
}
{
  // Zeitreise: dieselbe Packung, weit in der Zukunft
  const entry = { productId: "zahnpasta", purchases: [{ date: day(-10), quantity: 1, packageValue: 75 }] };
  const later = supplyFor(entry, day(60), HOUSEHOLD);
  ok("Restmenge wird nie negativ", later.remaining >= 0, later.remaining);
  ok("Reichweite wird nie negativ", later.daysOfSupply >= 0, later.daysOfSupply);
  ok("Leere Packung wird als leer gemeldet", /leer/.test(later.message), later.message);
}
{
  const entry = { productId: "batterien", purchases: [{ date: day(-30), quantity: 1 }] };
  const s = supplyFor(entry, T0, HOUSEHOLD);
  ok("SPORADIC gibt NIE eine Reichweite aus", s.daysOfSupply === null, s.daysOfSupply);
  ok("SPORADIC schlägt keinen Nachkauf vor", s.dueForPurchase === false);
  ok("SPORADIC sagt das auch", /unregelmäßig/.test(s.message), s.message);
}
{
  const entry = { productId: "entkalker", purchases: [{ date: day(-30), quantity: 1 }] };
  ok("Ohne Kaffeemaschine keine Auswertung",
    supplyFor(entry, T0, { ...HOUSEHOLD, hasCoffeeMachine: false }) === null);
}
{
  const entry = { productId: "spuelmittel", purchases: [] };
  ok("Ohne Kauf keine Aussage", supplyFor(entry, T0, HOUSEHOLD) === null);
}

/* ================= Lernverfahren ================= */
section("Lernverfahren");
{
  const one = [{ date: day(-30), quantity: 1, packageValue: 75 }];
  const r = learnRate("zahnpasta", one, T0, HOUSEHOLD);
  ok("Ein einziger Kauf bleibt REFERENZ", r.confidence === CONFIDENCE.REFERENZ, r.confidence);
  ok("Referenzwert ist für den Haushalt gerechnet", r.rate === r.reference, `${r.rate} / ${r.reference}`);
  ok("Keine falsche Präzision", r.observed === null);
}
{
  const three = [-150, -100, -50].map((d) => ({ date: day(d), quantity: 1, packageValue: 75 }));
  const r = learnRate("zahnpasta", three, T0, HOUSEHOLD);
  ok("Drei Käufe sind VORLAEUFIG", r.confidence === CONFIDENCE.VORLAEUFIG, r.confidence);
  ok("Beschriftung nennt die Anzahl", /3 Käufen/.test(r.label), r.label);
}
{
  const regular = [-160, -120, -80, -40, 0].map((d) => ({ date: day(d), quantity: 1, packageValue: 75 }));
  const r = learnRate("zahnpasta", regular, T0, HOUSEHOLD);
  ok("Regelmäßige Käufe werden GELERNT", r.confidence === CONFIDENCE.GELERNT, `${r.confidence}, VK ${r.vk}`);
  ok("Beobachtung verschiebt die Rate", r.observed !== null && r.rate !== r.reference,
    `Prior ${r.reference}, beobachtet ${r.observed}, gemischt ${r.rate}`);
  ok("Gemischte Rate liegt zwischen Prior und Beobachtung",
    (r.rate >= Math.min(r.reference, r.observed) && r.rate <= Math.max(r.reference, r.observed)));
}
{
  const erratic = [-170, -168, -90, -85, -10].map((d) => ({ date: day(d), quantity: 1, packageValue: 75 }));
  const r = learnRate("zahnpasta", erratic, T0, HOUSEHOLD);
  ok("Unregelmäßige Käufe werden UNSICHER", r.confidence === CONFIDENCE.UNSICHER, `VK ${r.vk}`);

  const entry = { productId: "zahnpasta", purchases: erratic };
  const s = supplyFor(entry, T0, HOUSEHOLD, { confidence: r.confidence, learnedRate: r.rate });
  ok("Bei UNSICHER wird kein Nachkauf vorgeschlagen", s.dueForPurchase === false);
  ok("Bei UNSICHER sagt die App das offen", /unregelmäßig/.test(s.message), s.message);
}
{
  // Grenzfall aus der Spezifikation: Vorratskauf darf die Rate nicht verzerren
  const normal = [-180, -140, -100, -60, -20].map((d) => ({ date: day(d), quantity: 1, packageValue: 20 }));
  const withStockUp = [...normal];
  withStockUp[2] = { date: day(-100), quantity: 3, packageValue: 20 };

  const a = learnRate("waschmittel", normal, T0, HOUSEHOLD);
  const b = learnRate("waschmittel", withStockUp, T0, HOUSEHOLD);
  ok("Vorratskauf verdreifacht die Rate nicht", b.rate < a.rate * 2, `${a.rate} -> ${b.rate}`);
  ok("Vorratskauf bleibt bei denselben Abständen gleich sicher",
    b.confidence === a.confidence, `${a.confidence} / ${b.confidence}`);
}
{
  ok("Variationskoeffizient bei Gleichmaß ist 0", variationCoefficient([10, 10, 10]) === 0);
  ok("Variationskoeffizient bei leerer Liste ist 0", variationCoefficient([]) === 0);
  ok("Variationskoeffizient bei Nullen bleibt endlich",
    Number.isFinite(variationCoefficient([0, 0, 0])));
}

/* ================= Austauschintervalle ================= */
section("Austauschintervalle");
{
  const entry = { productId: "zahnbuerste", purchases: [{ date: day(-30), quantity: 1 }] };
  const s = swapStatus(entry, T0, HOUSEHOLD);
  ok("Vor Ablauf nicht fällig", s.due === false, s.daysLeft);
  ok("Restzeit wird beziffert", s.daysLeft === 60, s.daysLeft);
  ok("Quelle wird mitgeliefert", !!s.source, s.source);

  // Zeitreise: 97 Tage nach dem Kauf
  const later = swapStatus(entry, day(67), HOUSEHOLD);
  ok("Nach 97 Tagen ist die Zahnbürste fällig", later.due === true, `${later.inUse} Tage`);
  ok("Meldung nennt die Einsatzdauer", /97 Tagen/.test(later.message), later.message);
}
{
  const entry = { productId: "zahnbuerste", purchases: [{ date: day(-100), quantity: 1 }] };
  const after = recordSwap(entry, T0);
  const s = swapStatus(after, T0, HOUSEHOLD);
  ok("Tausch setzt den Zähler zurück", s.due === false && s.inUse === 0, s.inUse);
  ok("Der Bezugspunkt ist danach der Tausch", s.fromSwap === true);
}
{
  // Urlaub: Zahnbürste altert weiter, Küchenschwamm nicht
  const brush = { productId: "zahnbuerste", purchases: [{ date: day(-95), quantity: 1 }] };
  const sponge = { productId: "kuechenschwamm", purchases: [{ date: day(-12), quantity: 1 }] };

  const brushPaused = swapStatus(brush, T0, HOUSEHOLD, 14);
  const spongePaused = swapStatus(sponge, T0, HOUSEHOLD, 14);
  ok("Zahnbürste altert im Urlaub weiter", brushPaused.inUse === 95, brushPaused.inUse);
  ok("Zahnbürste ist trotz Urlaub fällig", brushPaused.due === true);
  ok("Küchenschwamm pausiert im Urlaub", spongePaused.inUse === 0, spongePaused.inUse);
  ok("Küchenschwamm ist dadurch nicht fällig", spongePaused.due === false, spongePaused.daysLeft);
}
{
  const soft = intervalFor("entkalker", { waterHardness: "weich" });
  const hard = intervalFor("entkalker", { waterHardness: "hart" });
  ok("Weiches Wasser verlängert das Entkalkungsintervall", soft > hard, `${soft} vs ${hard}`);
  ok("Faktoren stimmen mit der Tabelle überein",
    soft === Math.round(90 * HARDNESS_FACTOR.weich) && hard === Math.round(90 * HARDNESS_FACTOR.hart));
  ok("Zahnbürste ist von der Wasserhärte unberührt",
    intervalFor("zahnbuerste", { waterHardness: "hart" }) === 90);
}
{
  const entries = [
    { productId: "kuechenschwamm", purchases: [{ date: day(-20), quantity: 1 }] },
    { productId: "zahnbuerste", purchases: [{ date: day(-30), quantity: 1 }] },
    { productId: "wasserfilter", purchases: [{ date: day(-25), quantity: 1 }] }
  ];
  const due = dueSwaps(entries, T0, HOUSEHOLD);
  ok("Alle Austauschprodukte werden ausgewertet", due.length === 3, due.length);
  ok("Das Überfälligste steht vorn", due[0].daysLeft <= due[1].daysLeft);
  ok("Fällige werden erkannt", due.some((x) => x.due), due.filter((x) => x.due).map((x) => x.name).join());
}
{
  const entry = {
    productId: "aufsteckbuersten",
    purchases: [{ date: day(-100), quantity: 1 }],
    swaps: [day(-100), day(-10)]
  };
  ok("Packung mit vier Stück reicht für mehrere Tauschvorgänge",
    needsRestock(entry, T0, HOUSEHOLD) === false);
  const used = { ...entry, swaps: [day(-100), day(-70), day(-40), day(-10)] };
  ok("Nach vier Tauschvorgängen braucht es Nachschub",
    needsRestock(used, T0, HOUSEHOLD) === true);
}
{
  ok("Rate-Produkte haben keinen Tauschstatus",
    swapStatus({ productId: "zahnpasta", purchases: [{ date: T0, quantity: 1 }] }, T0, HOUSEHOLD) === null);
  ok("Ohne Kauf und ohne Tausch keine Aussage",
    swapStatus({ productId: "zahnbuerste", purchases: [] }, T0, HOUSEHOLD) === null);
}

/* ================= Grundpreis und Perzentil ================= */
section("Grundpreis");
{
  const bp = basePrice("waschmittel", 5.99, 20);
  ok("Grundpreis je Waschladung", Math.abs(bp.value - 0.2995) < 0.001, bp.value);
  ok("Anzeige nennt die Normeinheit", /Waschladung/.test(bp.display), bp.display);

  const big = basePrice("waschmittel", 17.99, 80);
  ok("Große Packung ist je Einheit günstiger", big.value < bp.value, `${big.value} < ${bp.value}`);
}
{
  ok("Fehlende Menge erzeugt kein NaN", basePrice("waschmittel", 5.99, 0) === null);
  ok("Negative Menge erzeugt kein Infinity", basePrice("waschmittel", 5.99, -5) === null);
  ok("Fehlender Preis erzeugt keine Zahl", basePrice("waschmittel", null, 20) === null);
  ok("Unbekanntes Produkt liefert nichts", basePrice("gibtsnicht", 1, 1) === null);
}
{
  const history = [0.30, 0.32, 0.28, 0.35].map((v, i) =>
    ({ date: day(-100 + i * 20), price: v * 20, packageValue: 20, quantity: 1 }));
  ok("Günstiger Preis wird als günstig erkannt",
    pricePercentile("waschmittel", 0.22, history).verdict === "günstig");
  ok("Teurer Preis wird als teuer erkannt",
    pricePercentile("waschmittel", 0.40, history).verdict === "teuer");
  ok("Normaler Preis wird als normal erkannt",
    pricePercentile("waschmittel", 0.31, history).verdict === "normal");
}
{
  const few = [{ date: day(-10), price: 5.99, packageValue: 20, quantity: 1 }];
  const r = pricePercentile("waschmittel", 0.2, few);
  ok(`Unter ${MIN_PRICE_POINTS} Datenpunkten keine Aussage`, r.percentile === null, r.percentile);
  ok("Und nicht etwa Perzentil 0", r.verdict === "unbekannt", r.verdict);
  ok("Die Meldung erklärt warum", /zu wenig Historie/.test(r.message), r.message);
}
{
  const entries = [{
    productId: "waschmittel",
    purchases: [0.35, 0.34, 0.36, 0.20, 0.33].map((v, i) =>
      ({ date: day(-120 + i * 25), price: v * 20, packageValue: 20, quantity: 1 }))
  }];
  const s = nonFoodSavings(entries, T0);
  ok("Ersparnis wird beziffert", s.total > 0, s.total);
  ok("Ersparnis ist als realisiert gekennzeichnet", s.realised === true);
  ok("Ersparnis nennt ihre Grundlage", /Median/.test(s.basis), s.basis);
}

/* ================= Bevorratung ================= */
section("Bevorratung");
{
  const purchases = [-160, -120, -80, -40, 0].map((d) =>
    ({ date: day(d), quantity: 1, packageValue: 20, price: 6.99 }));
  const rate = learnRate("waschmittel", purchases, T0, HOUSEHOLD);
  const supply = supplyFor({ productId: "waschmittel", purchases }, T0, HOUSEHOLD,
    { learnedRate: rate.rate, confidence: rate.confidence });

  const history = [0.35, 0.34, 0.36, 0.33, 0.35].map((v, i) =>
    ({ date: day(-120 + i * 25), price: v * 20, packageValue: 20, quantity: 1 }));

  const advice = stockUpAdvice(supply, { history, currentPrice: 4.20, currentPackage: 20, profile: HOUSEHOLD });
  ok("Günstiger Preis löst einen Vorratsvorschlag aus", advice.units > 0, JSON.stringify(advice));
  ok("Menge bleibt im Lagerlimit", advice.units <= advice.storageLimit, `${advice.units}/${advice.storageLimit}`);
  ok("Vorschlag nennt den Zeitraum", /Tage/.test(advice.message), advice.message);
}
{
  // Die wichtigste Bremse: ohne gelernte Rate kein Mehrkauf
  const purchases = [{ date: day(-20), quantity: 1, packageValue: 20, price: 6.99 }];
  const rate = learnRate("waschmittel", purchases, T0, HOUSEHOLD);
  const supply = supplyFor({ productId: "waschmittel", purchases }, T0, HOUSEHOLD,
    { learnedRate: rate.rate, confidence: rate.confidence });
  const history = [0.35, 0.34, 0.36, 0.33].map((v, i) =>
    ({ date: day(-100 + i * 25), price: v * 20, packageValue: 20, quantity: 1 }));
  const advice = stockUpAdvice(supply, { history, currentPrice: 3.00, currentPackage: 20, profile: HOUSEHOLD });
  ok("Ohne gelernte Rate wird nie zum Mehrkauf geraten", advice.units === 0, advice.reason);
  ok("Und die App sagt warum", /nicht sicher genug/.test(advice.message), advice.message);
}
{
  const purchases = [-160, -120, -80, -40, 0].map((d) =>
    ({ date: day(d), quantity: 1, packageValue: 20, price: 6.99 }));
  const rate = learnRate("waschmittel", purchases, T0, HOUSEHOLD);
  const supply = supplyFor({ productId: "waschmittel", purchases }, T0, HOUSEHOLD,
    { learnedRate: rate.rate, confidence: rate.confidence });
  const history = [0.30, 0.31, 0.29, 0.32].map((v, i) =>
    ({ date: day(-100 + i * 25), price: v * 20, packageValue: 20, quantity: 1 }));
  const advice = stockUpAdvice(supply, { history, currentPrice: 6.40, currentPackage: 20, profile: HOUSEHOLD });
  ok("Bei normalem Preis kein Vorratsvorschlag", advice.units === 0, advice.reason);
}
{
  const few = [{ date: day(-10), price: 5.99, packageValue: 20, quantity: 1 }];
  const c = learnPromoCycle("waschmittel", few);
  ok("Ohne genug Punkte gilt der Vorgabezyklus", c.learned === false && c.days === 56, JSON.stringify(c));

  const wave = [0.35, 0.25, 0.36, 0.24, 0.37, 0.23, 0.35].map((v, i) =>
    ({ date: day(-180 + i * 28), price: v * 20, packageValue: 20, quantity: 1 }));
  const learned = learnPromoCycle("waschmittel", wave);
  ok("Aus Preiswellen wird ein Zyklus gelernt", learned.learned === true, JSON.stringify(learned));
}

/* ================= Bonzeile ================= */
section("Bon: Menge und Domäne");
{
  ok("Milliliter werden erkannt", parseQuantity("ZAHNPASTA 75ML").value === 75);
  ok("Waschladungen werden erkannt", parseQuantity("WASCHMITTEL 20WL").value === 20);
  ok("ER-Angaben werden erkannt", parseQuantity("TOILETTENPAPIER 10ER").value === 10);
  ok("Liter werden auf Milliliter gebracht", parseQuantity("WEICHSPUELER 1,5L").value === 1500);
  ok("Kilogramm werden auf Gramm gebracht", parseQuantity("WASCHPULVER 2KG").value === 2000);
  ok("Ohne Menge kein Ergebnis", parseQuantity("SPUELMITTEL") === null);
  ok("Umlaute stören nicht", parseQuantity("TASCHENTÜCHER 60 STÜCK").value === 60);
}
{
  const fromBon = packageValueFor("waschmittel", "WASCHMITTEL 80WL");
  ok("Menge vom Bon schlägt den Katalog", fromBon.value === 80 && fromBon.source === "bon", JSON.stringify(fromBon));
  const fallback = packageValueFor("waschmittel", "WASCHMITTEL");
  ok("Ohne Menge greift der Katalogwert", fallback.source === "katalog" && fallback.value === 20);
  ok("Der Katalogwert wird als Referenz gekennzeichnet", fallback.confidence === "REFERENZ");
}
{
  ok("Ermäßigter Satz deutet auf Lebensmittel", guessDomain("MILCH", "A").domain === "FOOD");
  ok("Voller Satz deutet auf Non-Food", guessDomain("SPUELMITTEL", "B").domain === "NONFOOD");
  ok("Bier bleibt Lebensmittel trotz vollem Satz", guessDomain("BIER 0,5L", "B").domain === "FOOD");
  ok("Tierfutter bleibt Lebensmittel trotz vollem Satz", guessDomain("KATZENFUTTER", "B").domain === "FOOD");
  ok("Blumen bleiben Non-Food trotz ermäßigtem Satz", guessDomain("BLUMEN STRAUSS", "A").domain === "NONFOOD");
  ok("Ohne Steuersatz keine Aussage", guessDomain("IRGENDWAS", null).domain === "UNKLAR");
}
{
  const known = enrichLine({ raw: "SPUELMITTEL 500ML", productId: "spuelmittel", taxClass: "B" });
  ok("Bekanntes Produkt kommt aus dem Katalog, nicht aus der Heuristik",
    known.domain === "NONFOOD" && known.domainConfidence === 1, known.domainReason);
  ok("Verbrauchsklasse wird mitgeliefert", known.consumptionClass === CLASS.RATE);
  ok("Packungsmenge wird mitgeliefert", known.packaging.value === 500, JSON.stringify(known.packaging));

  const unknown = enrichLine({ raw: "SUPERPUTZ XY 750ML", productId: null, taxClass: "B" });
  ok("Unbekanntes wird vermutet, nicht gebucht", unknown.needsConfirmation === true);
  ok("Die Vermutung ist als solche gekennzeichnet", unknown.domainConfidence < 1, unknown.domainConfidence);
}

/* ================= Zusammenspiel ================= */
section("Zusammenspiel und Zeitreise");
{
  const entries = [
    { productId: "zahnpasta", purchases: [-150, -100, -50, 0].map((d) => ({ date: day(d), quantity: 1, packageValue: 75 })) },
    { productId: "klopapier", purchases: [-120, -80, -40, 0].map((d) => ({ date: day(d), quantity: 1, packageValue: 10 })) },
    { productId: "batterien", purchases: [{ date: day(-60), quantity: 1 }] }
  ];
  const rates = learnAllRates(entries, T0, HOUSEHOLD);
  const overview = supplyOverview(entries, T0, HOUSEHOLD, rates);
  ok("Alle Produkte werden ausgewertet", overview.length === 3, overview.length);
  ok("Das Knappste steht vorn",
    overview[0].daysOfSupply === null || overview[1].daysOfSupply === null ||
    overview[0].daysOfSupply <= overview[1].daysOfSupply);
  ok("SPORADIC steht am Ende", overview[overview.length - 1].daysOfSupply === null);
  ok("Jede Zeile trägt eine Konfidenz", overview.every((x) => !!x.confidence));
}
{
  // Haushaltsgröße ändern: alles muss neu und plausibel rechnen
  const entries = [{ productId: "zahnpasta", purchases: [{ date: day(-10), quantity: 1, packageValue: 75 }] }];
  const small = supplyOverview(entries, T0, { ...HOUSEHOLD, personCount: 1 })[0];
  const large = supplyOverview(entries, T0, { ...HOUSEHOLD, personCount: 5 })[0];
  ok("Mehr Personen heißt kürzere Reichweite", large.daysOfSupply < small.daysOfSupply,
    `1 Person ${small.daysOfSupply}, 5 Personen ${large.daysOfSupply}`);
  ok("Keine negative Restmenge bei großem Haushalt", large.remaining >= 0, large.remaining);
}
{
  // Zeitreise über ein halbes Jahr in Wochenschritten: nichts darf kippen
  const entries = [
    { productId: "waschmittel", purchases: [{ date: day(-10), quantity: 1, packageValue: 20 }] },
    { productId: "zahnbuerste", purchases: [{ date: day(-10), quantity: 1 }] }
  ];
  let broken = null;
  for (let w = 0; w <= 26 && !broken; w++) {
    const t = day(w * 7);
    const sup = supplyOverview(entries.slice(0, 1), t, HOUSEHOLD)[0];
    const swap = dueSwaps(entries.slice(1), t, HOUSEHOLD)[0];
    if (sup.remaining < 0 || sup.daysOfSupply < 0) broken = `Woche ${w}: Restmenge ${sup.remaining}`;
    if (!Number.isFinite(swap.daysLeft)) broken = `Woche ${w}: daysLeft ${swap.daysLeft}`;
  }
  ok("Ein halbes Jahr Zeitreise bleibt stabil", broken === null, broken);
}
{
  const p = fullProduct("klopapier");
  ok("Katalog und Verbrauchsmodell lassen sich zusammenführen",
    p && p.name === "Toilettenpapier" && p.consumptionClass === CLASS.RATE && p.domain === "NONFOOD");
  ok("Lebensmittel haben kein Verbrauchsmodell", fullProduct("milch_vollmilch") === null);
  ok("isNonFood unterscheidet sauber", isNonFood("klopapier") && !isNonFood("milch_vollmilch"));
}

console.log("\n" + "=".repeat(60));
console.log(`HAUSHALTSPRODUKTE: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
