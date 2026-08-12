/**
 * tests.js — Regressionstests
 * ================================================================
 * Mit `node tests.js` ausführen. Diese Tests halten fest, was schon
 * einmal kaputt war: jede Zeile hier entspricht einem Fehler, der
 * beim Bauen tatsächlich aufgetreten ist. Wer die Algorithmen
 * ändert, sieht sofort, ob er etwas zurückgebrochen hat.
 * ================================================================
 */

const { matchProduct } = require("../src/algo/productMatcher2");
const { computeRhythm } = require("../src/algo/rhythmEngine2");
const { inferWaste } = require("../src/algo/wasteInference2");
const { checkEthyleneConflicts } = require("../src/algo/storageAdvisor");
const { byId, isSafetyCritical } = require("../src/algo/foodDatabase");

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? passed++ : failed++;
  console.log(`${ok ? "OK  " : "FEHL"} ${name}${ok ? "" : `\n      erwartet: ${JSON.stringify(expected)}\n      erhalten: ${JSON.stringify(actual)}`}`);
}

console.log("\n--- Produktabgleich ---");
const matchCases = [
  ["BIO VOLLMILCH FRISCH 3,5% 1L", "milch_vollmilch"],
  ["H-MILCH 3,5%", "milch_vollmilch"],
  ["HAEHNCHENBRUSTFILET 400G", "haehnchen"],   // Komposita, war einmal kaputt
  ["HÄHNCHENBRUST", "haehnchen"],              // Umlaut vs. ae
  ["GEMISCHTES HACK 500G", "hackfleisch"],
  ["BANANEN CHIQUITA 1KG", "bananen"],         // Markenname
  ["ERDBEEREN 500G SCHALE", "erdbeeren"],      // Verpackungswort
  ["TK GEMUESE ERBSEN", "tk_gemuese"],         // mehr Wörter als der Katalogeintrag
  ["SPEISEQUARK MAGER 500G", "quark"],
  ["TORTILLA CHIPS", "chips"],                 // seit v3 im Katalog
  ["SCHOKORIEGEL", "riegel_schoko"],           // eigenes Produkt, seit der Katalog breit ist
  ["XYZ PHANTASIEPRODUKT", null]               // muss weiterhin unerkannt bleiben
];
matchCases.forEach(([input, expected]) => {
  check(`"${input}"`, matchProduct(input).productId, expected);
});

console.log("\n--- Gefährliche Fehlzuordnungen (dürfen nicht passieren) ---");
// Dose vs. frisch: verschiedene Haltbarkeit, verschiedene Lagerung
check('"GEHACKTE TOMATEN DOSE" ist NICHT frische Tomate',
  matchProduct("GEHACKTE TOMATEN DOSE").productId, "konserve_tomaten");
check('"PASSIERTE TOMATEN" ist NICHT frische Tomate',
  matchProduct("PASSIERTE TOMATEN").productId, "passata");
check('"FRISCHE TOMATEN LOSE" ist NICHT Dosentomate',
  matchProduct("FRISCHE TOMATEN LOSE").productId, "tomaten");
// Geschnittener Salat hat ein Verbrauchsdatum, Kopfsalat nicht
check('"SALATMISCHUNG BEUTEL" ist NICHT Kopfsalat',
  matchProduct("SALATMISCHUNG BEUTEL").productId, "salat_geschnitten");

console.log("\n--- Sicherheitsregeln ---");
check("Hackfleisch ist sicherheitskritisch", isSafetyCritical("hackfleisch"), true);
check("Geflügel ist sicherheitskritisch", isSafetyCritical("haehnchen"), true);
check("Geschnittener Salat ist sicherheitskritisch", isSafetyCritical("salat_geschnitten"), true);
check("Geschnittenes Obst ist sicherheitskritisch", isSafetyCritical("obst_geschnitten"), true);
check("Joghurt ist NICHT sicherheitskritisch", isSafetyCritical("joghurt_natur"), false);
check("Nudeln sind NICHT sicherheitskritisch", isSafetyCritical("nudeln"), false);

console.log("\n--- Rhythmus: Robustheit ---");
// Urlaubsfall: 6-Tage-Rhythmus mit einer 28-Tage-Lücke
const urlaub = ["2026-06-01","2026-06-07","2026-06-13","2026-06-19","2026-06-25",
                "2026-07-23","2026-07-29","2026-08-04","2026-08-10"]
  .map(d => ({ date: d, quantity: 1, unitPrice: 1.19 }));
const ur = computeRhythm(urlaub);
check("Urlaub verzerrt den Rhythmus nicht (6 Tage erwartet)", ur.rhythmDays, 6);
check("Unterbrechung wird erkannt", ur.pauses.length, 1);

// Mengenfall: 2 Liter alle 12 Tage = 6 Tage pro Liter
const menge = ["2026-06-01","2026-06-13","2026-06-25","2026-07-07"]
  .map(d => ({ date: d, quantity: 2, unitPrice: 1.19 }));
const mr = computeRhythm(menge);
check("Verbrauch je Einheit korrekt (6 Tage)", mr.perUnitDays, 6);
check("Nachkauf-Rhythmus für übliche Menge (12 Tage)", mr.rhythmDays, 12);

// Ein einziger Kauf darf keinen Rhythmus erzeugen (Cold Start)
const einzeln = computeRhythm([{ date: "2026-08-01", quantity: 1, unitPrice: 1 }]);
check("Ein Kauf ergibt keinen Rhythmus", einzeln.rhythmDays, null);
check("Ein Kauf ergibt kein Vertrauen", einzeln.confidence, 0);

console.log("\n--- Verschwendung ---");
const hist = [];
["2026-06-01","2026-06-08","2026-06-15","2026-06-22","2026-06-29"].forEach(d =>
  hist.push({ productId: "salat_kopf", date: d, quantity: 1, unitPrice: 1.39 }));
["2026-06-04","2026-06-26","2026-07-18"].forEach(d =>
  hist.push({ productId: "nudeln", date: d, quantity: 1, unitPrice: 1.29 }));
const rhythms = new Map();
rhythms.set("salat_kopf", computeRhythm(hist.filter(h => h.productId === "salat_kopf")));
rhythms.set("nudeln", computeRhythm(hist.filter(h => h.productId === "nudeln")));
const { chronic } = inferWaste(hist, rhythms);
check("Salat als strukturelle Verschwendung erkannt",
  chronic.some(c => c.productId === "salat_kopf"), true);
check("Nudeln NICHT als Verschwendung markiert (Vorratsware)",
  chronic.some(c => c.productId === "nudeln"), false);
check("Ergebnis ist eine Spanne, kein exakter Wert",
  typeof chronic.find(c => c.productId === "salat_kopf").eurosPerCycle.min === "number", true);

console.log("\n--- Lagerberater ---");
const conflict = checkEthyleneConflicts([
  { productId: "bananen" }, { productId: "trauben" }
]);
check("Ethylen-Konflikt Banane/Traube erkannt", conflict !== null, true);
const noConflict = checkEthyleneConflicts([
  { productId: "nudeln" }, { productId: "milch_vollmilch" }
]);
check("Kein Konflikt bei Trockenware", noConflict, null);

console.log(`\n--- Zwischenstand v2: ${passed} bestanden, ${failed} fehlgeschlagen ---`);

// ================================================================
// Tests für die Persona-Funktionen (v3)
// ================================================================
const { fitToBudget, isEssential } = require("../src/algo/budgetOptimizer");
const { suggestRecipes } = require("../src/algo/recipeMatcher");
const { assignItems, computeBalances, settleUp, SPLIT_MODE } = require("../src/algo/householdSplit");
const { wasteInKilograms, beforeAfter } = require("../src/algo/impactMetrics");
const { determineStage, firstReceiptInsights } = require("../src/algo/coldStart");
const { databaseQualityReport } = require("../src/algo/foodDatabase");

console.log("\n--- Datenbank v3 ---");
const rep = databaseQualityReport();
check("Mindestens 200 Produkte", rep.total >= 200, true);
check("Non-Food ist enthalten", rep.nonFood > 0, true);
check("Sicherheitskritische Produkte vorhanden", rep.safetyCritical >= 10, true);

console.log("\n--- Budget-Optimierer ---");
const testList = [
  { productId:"brot_mischbrot", name:"Brot", category:"Backwaren", price:2.29, wasteRate:0 },
  { productId:"milch_vollmilch", name:"Milch", category:"Milchprodukte", price:1.19, wasteRate:0 },
  { productId:"schokolade", name:"Schokolade", category:"Süßes/Snacks", price:4.47, wasteRate:0 },
  { productId:"bier", name:"Bier", category:"Getränke", price:4.74, wasteRate:0 },
  { productId:"salat_kopf", name:"Salat", category:"Frischware", price:2.78, wasteRate:0.5 }
];
const r1 = fitToBudget(testList, 8);
check("Brot wird NIE gestrichen", r1.removed.some(i=>i.productId==="brot_mischbrot"), false);
check("Milch wird NIE gestrichen", r1.removed.some(i=>i.productId==="milch_vollmilch"), false);
check("Süßes fliegt zuerst", r1.removed.some(i=>i.category==="Süßes/Snacks"), true);
check("Verschwender wird halbiert", r1.halved.some(i=>i.productId==="salat_kopf"), true);
check("Brot gilt als Grundnahrungsmittel", isEssential({productId:"brot_mischbrot",category:"Backwaren",price:2.29}), true);
const r2 = fitToBudget(testList, 999);
check("Genug Budget: nichts wird gekürzt", r2.removed.length + r2.halved.length, 0);

console.log("\n--- Rezeptvorschläge ---");
const stock = [
  { productId:"haehnchen", daysLeft:1, price:6.99 },
  { productId:"reis", daysLeft:400, price:2.19 },
  { productId:"paprika", daysLeft:2, price:2.29 }
];
const rec = suggestRecipes(stock, { maxResults: 3 });
check("Rezepte gefunden", rec.length > 0, true);
check("Dringendes wird priorisiert", rec[0].rescuedValue > 0, true);
check("Vollständige Rezepte werden erkannt", rec.some(r=>r.complete), true);
const leer = suggestRecipes([{ productId:"salz", daysLeft:900, price:0.49 }]);
check("Ohne passenden Bestand keine Fantasie-Rezepte", leer.every(r=>r.rescuedValue===0), true);

console.log("\n--- WG-Abrechnung ---");
const members = ["A","B","C","D"];
const bon = [
  { productId:"milch_vollmilch", quantity:2, unitPrice:1.00 },
  { productId:"bier", quantity:6, unitPrice:1.00 }
];
const assigned = assignItems(bon, { bier: { mode: SPLIT_MODE.PRIVATE, person: "D" } }, "A");
const balances = computeBalances(assigned, members);
check("Zahler bekommt Auslage zurück", balances.A > 0, true);
check("Privatkäufer trägt eigene Kosten", balances.D < 0, true);
const transfers = settleUp(balances);
const sumTransfers = Math.round(transfers.reduce((s,t)=>s+t.amount,0)*100);
const sumCredits = Math.round(Object.values(balances).filter(v=>v>0).reduce((s,v)=>s+v,0)*100);
check("Überweisungen gleichen Saldo exakt aus (keine Cent-Differenz)", sumTransfers, sumCredits);

console.log("\n--- Wirkungsmessung ---");
const kgRes = wasteInKilograms([{ productId:"bananen", wastedFraction:0.25, cycles:20 }]);
check("Kilogramm werden berechnet", kgRes.kg > 0, true);
check("Ergebnis ist als Schätzung markiert", kgRes.estimated, true);
const nonFoodKg = wasteInKilograms([{ productId:"klopapier", wastedFraction:1, cycles:5 }]);
check("Non-Food zählt NICHT als Lebensmittelverschwendung", nonFoodKg.kg, 0);
const ev = beforeAfter(10, 5, 2, 2);
check("Zu kurzer Zeitraum wird als unzureichend markiert", ev.evidenceLevel, "unzureichend");

console.log("\n--- Cold Start ---");
const st0 = determineStage([], new Map());
check("Ohne Bon: Stufe 0", st0.stage, 0);
const st1 = determineStage([{productId:"milch_vollmilch",date:"2026-08-01"}], new Map());
check("Ein Bon: Stufe 1", st1.stage, 1);
const insights = firstReceiptInsights([
  { productId:"milch_vollmilch", quantity:2, unitPrice:1.19 },
  { productId:"klopapier", quantity:1, unitPrice:3.99 }
]);
check("Jahreshochrechnung wird geliefert", insights.yearProjection > 0, true);
check("Lebensmittel getrennt von Non-Food", insights.foodSpend < insights.total, true);

console.log(`\n${"=".repeat(50)}\nGESAMT: ${passed} bestanden, ${failed} fehlgeschlagen\n`);

process.exit(failed > 0 ? 1 : 0);
