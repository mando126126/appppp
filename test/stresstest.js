/**
 * stresstest.js
 * ================================================================
 * Testet NICHT, ob die Algorithmen bei sauberen Daten stimmen
 * (das macht tests.js), sondern was passiert, wenn Daten kaputt,
 * extrem, widersprüchlich oder schlicht bösartig sind.
 *
 * Vier Arten von Prüfung:
 *   A) Grenzfälle    — leer, null, negativ, riesig, doppelt
 *   B) Invarianten   — Aussagen, die IMMER gelten müssen
 *   C) Zufallsdaten  — 10.000 zufällige Eingaben, nichts darf abstürzen
 *   D) Last          — reicht die Geschwindigkeit für echte Datenmengen
 * ================================================================
 */

const { computeRhythm, computeAllRhythms, daysBetween } = require("../src/algo/rhythmEngine2");
const { inferWaste, inferChronicWaste } = require("../src/algo/wasteInference2");
const { matchProduct, matchReceipt, parseProductName } = require("../src/algo/productMatcher2");
const { fitToBudget, cheaperAlternatives } = require("../src/algo/budgetOptimizer");
const { suggestRecipes } = require("../src/algo/recipeMatcher");
const { assignItems, computeBalances, settleUp, SPLIT_MODE } = require("../src/algo/householdSplit");
const { wasteInKilograms, beforeAfter, compareToReference } = require("../src/algo/impactMetrics");
const { determineStage, firstReceiptInsights, assumptionBasedSuggestions } = require("../src/algo/coldStart");
const { checkEthyleneConflicts, buildStorageGuide } = require("../src/algo/storageAdvisor");
const { FOOD_DATABASE, byId } = require("../src/algo/foodDatabase");

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
const section = (s) => console.log(`\n--- ${s} ---`);

// ================================================================
section("A1: Leere und fehlende Eingaben");

t("computeRhythm([])", () => computeRhythm([]).rhythmDays === null);
t("computeRhythm(null)", () => computeRhythm(null).rhythmDays === null);
t("computeRhythm(undefined)", () => computeRhythm(undefined).rhythmDays === null);
t("computeAllRhythms([])", () => computeAllRhythms([]).size === 0);
t("matchProduct('')", () => matchProduct("").productId === null);
t("matchProduct(null)", () => matchProduct(null).productId === null);
t("matchProduct(undefined)", () => matchProduct(undefined).productId === null);
t("matchReceipt([])", () => matchReceipt([]).matched.length === 0);
t("fitToBudget([], 50)", () => fitToBudget([], 50).total === 0);
t("suggestRecipes([])", () => Array.isArray(suggestRecipes([])));
t("computeBalances([], [])", () => Object.keys(computeBalances([], [])).length === 0);
t("settleUp({})", () => settleUp({}).length === 0);
t("wasteInKilograms([])", () => wasteInKilograms([]).kg === 0);
t("firstReceiptInsights([])", () => firstReceiptInsights([]).total === 0);
t("checkEthyleneConflicts([])", () => checkEthyleneConflicts([]) === null);
t("buildStorageGuide([])", () => buildStorageGuide([]).length === 0);
t("determineStage([], neue Map)", () => determineStage([], new Map()).stage === 0);

// ================================================================
section("A2: Unsinnige Werte");

t("Negativer Preis stürzt nicht ab", () => {
  const r = fitToBudget([{ productId: "milch_vollmilch", name: "X", category: "Milchprodukte", price: -5, wasteRate: 0 }], 10);
  return typeof r.total === "number";
});
t("Menge 0 erzeugt keine Division durch Null", () => {
  const r = computeRhythm([
    { date: "2026-01-01", quantity: 0 }, { date: "2026-01-07", quantity: 0 }
  ]);
  return Number.isFinite(r.rhythmDays) || r.rhythmDays === null;
});
t("Negative Menge", () => {
  const r = computeRhythm([{ date: "2026-01-01", quantity: -3 }, { date: "2026-01-07", quantity: -3 }]);
  return r.rhythmDays === null || Number.isFinite(r.rhythmDays);
});
t("Ungültiges Datum ergibt kein NaN im Rhythmus", () => {
  const r = computeRhythm([{ date: "kein-datum", quantity: 1 }, { date: "2026-01-07", quantity: 1 }]);
  return r.rhythmDays === null || Number.isFinite(r.rhythmDays)
    ? true : `rhythmDays=${r.rhythmDays}`;
});
t("Zukunftsdatum", () => {
  const r = computeRhythm([{ date: "2026-01-01", quantity: 1 }, { date: "2099-01-01", quantity: 1 }]);
  return Number.isFinite(r.rhythmDays);
});
t("Alle Käufe am selben Tag", () => {
  const r = computeRhythm([
    { date: "2026-01-01", quantity: 1 }, { date: "2026-01-01", quantity: 1 }, { date: "2026-01-01", quantity: 1 }
  ]);
  return r.rhythmDays === null || r.rhythmDays >= 1 ? true : `rhythmDays=${r.rhythmDays}`;
});
t("Unsortierte Historie wird korrekt sortiert", () => {
  const a = computeRhythm([
    { date: "2026-01-13", quantity: 1 }, { date: "2026-01-01", quantity: 1 }, { date: "2026-01-07", quantity: 1 }
  ]);
  const b = computeRhythm([
    { date: "2026-01-01", quantity: 1 }, { date: "2026-01-07", quantity: 1 }, { date: "2026-01-13", quantity: 1 }
  ]);
  return a.rhythmDays === b.rhythmDays ? true : `${a.rhythmDays} != ${b.rhythmDays}`;
});
t("Riesige Menge", () => {
  const r = computeRhythm([{ date: "2026-01-01", quantity: 1e6 }, { date: "2026-01-07", quantity: 1e6 }]);
  return Number.isFinite(r.rhythmDays);
});
t("Budget negativ", () => {
  const r = fitToBudget([{ productId: "chips", name: "Chips", category: "Süßes/Snacks", price: 2, wasteRate: 0 }], -100);
  return typeof r.total === "number";
});
t("Budget null (kein Budget gesetzt)", () => {
  const r = fitToBudget([{ productId: "chips", name: "C", category: "Süßes/Snacks", price: 2, wasteRate: 0 }], null);
  return r.withinBudget === true;
});
t("Unbekannte productId in Verschwendung", () => {
  const r = wasteInKilograms([{ productId: "gibtsnicht", wastedFraction: 1, cycles: 5 }]);
  return r.kg === 0;
});
t("compareToReference mit Haushaltsgröße 0", () => {
  const r = compareToReference(10, 0);
  return Number.isFinite(r.ratio) ? true : `ratio=${r.ratio}`;
});
t("beforeAfter mit 0 Wochen", () => {
  const r = beforeAfter(10, 5, 0, 0);
  return Number.isFinite(r.perWeekBefore) && Number.isFinite(r.perWeekAfter);
});
t("WG-Abrechnung ohne Mitglieder", () => {
  const items = assignItems([{ productId: "milch_vollmilch", quantity: 1, unitPrice: 1 }], {}, "A");
  const b = computeBalances(items, []);
  return Object.keys(b).length === 0;
});
t("WG-Abrechnung mit einem Mitglied", () => {
  const items = assignItems([{ productId: "milch_vollmilch", quantity: 1, unitPrice: 1 }], {}, "A");
  const b = computeBalances(items, ["A"]);
  return Math.abs(b.A) < 0.001 ? true : `Saldo ${b.A} statt 0`;
});

// ================================================================
section("A3: Bösartige Zeichenketten");

const evil = [
  "'; DROP TABLE produkte; --",
  "<script>alert(1)</script>",
  "A".repeat(10000),
  "\u0000\u0001\u0002",
  "🍌🍎🥕",
  "....................",
  "MILCH".repeat(500),
  "\\n\\r\\t",
  "%s%d%n",
  "../../etc/passwd"
];
evil.forEach((s, i) => {
  t(`Bösartige Eingabe #${i + 1} stürzt nicht ab`, () => {
    const r = matchProduct(s);
    return r && typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1;
  });
});
t("Sehr langer Name bleibt schnell (< 500 ms)", () => {
  const start = Date.now();
  matchProduct("X".repeat(5000));
  const ms = Date.now() - start;
  return ms < 500 ? true : `${ms} ms — zu langsam`;
});

// ================================================================
section("B: Invarianten (müssen IMMER gelten)");

t("Rhythmus ist nie 0 oder negativ", () => {
  for (let i = 0; i < 500; i++) {
    const n = 2 + Math.floor(Math.random() * 10);
    const dates = [];
    let d = new Date(2026, 0, 1);
    for (let j = 0; j < n; j++) {
      d = new Date(d.getTime() + Math.floor(Math.random() * 40) * 86400000);
      dates.push({ date: d.toISOString().slice(0, 10), quantity: 1 + Math.floor(Math.random() * 5) });
    }
    const r = computeRhythm(dates);
    if (r.rhythmDays !== null && r.rhythmDays < 1) return `rhythmDays=${r.rhythmDays}`;
  }
  return true;
});

t("Vertrauenswert liegt immer zwischen 0 und 1", () => {
  for (let i = 0; i < 500; i++) {
    const n = 2 + Math.floor(Math.random() * 15);
    const dates = [];
    let d = new Date(2026, 0, 1);
    for (let j = 0; j < n; j++) {
      d = new Date(d.getTime() + Math.floor(Math.random() * 90) * 86400000);
      dates.push({ date: d.toISOString().slice(0, 10), quantity: 1 });
    }
    const r = computeRhythm(dates);
    if (r.confidence < 0 || r.confidence > 1) return `confidence=${r.confidence}`;
  }
  return true;
});

t("Verschwendungsanteil überschreitet nie 90 %", () => {
  for (const p of FOOD_DATABASE) {
    for (const rhythm of [1, 5, 30, 365, 10000]) {
      const c = inferChronicWaste(p.id, rhythm, p.typicalPrice || 1, 1);
      if (c && c.wastedFraction > 0.9) return `${p.id}: ${c.wastedFraction}`;
    }
  }
  return true;
});

t("Verschwendungsspanne ist immer min <= mid <= max", () => {
  for (const p of FOOD_DATABASE.slice(0, 80)) {
    const c = inferChronicWaste(p.id, 60, p.typicalPrice || 1, 1);
    if (c && !(c.eurosPerCycle.min <= c.eurosPerCycle.mid && c.eurosPerCycle.mid <= c.eurosPerCycle.max)) {
      return `${p.id}: ${JSON.stringify(c.eurosPerCycle)}`;
    }
  }
  return true;
});

t("Budget-Kürzung streicht NIE Grundnahrungsmittel (200 Zufallslisten)", () => {
  const essentials = ["brot_mischbrot", "brot_vollkorn", "milch_vollmilch", "eier", "nudeln", "reis", "kartoffeln", "mehl", "butter", "toastbrot"];
  for (let i = 0; i < 200; i++) {
    const list = [];
    const n = 5 + Math.floor(Math.random() * 20);
    for (let j = 0; j < n; j++) {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      list.push({ productId: p.id, name: p.name, category: p.category,
        price: p.typicalPrice || 1, wasteRate: Math.random() });
    }
    const budget = Math.random() * 20; // absichtlich viel zu knapp
    const r = fitToBudget(list, budget);
    const gestrichen = r.removed.find((x) => essentials.includes(x.productId));
    if (gestrichen) return `Budget ${budget.toFixed(2)}: ${gestrichen.productId} gestrichen`;
  }
  return true;
});

t("Kürzung entfernt nie mehr als vorhanden", () => {
  for (let i = 0; i < 100; i++) {
    const list = Array.from({ length: 10 }, () => {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      return { productId: p.id, name: p.name, category: p.category, price: p.typicalPrice || 1, wasteRate: 0 };
    });
    const r = fitToBudget(list, 1);
    if (r.kept.length + r.removed.length !== list.length) {
      return `kept ${r.kept.length} + removed ${r.removed.length} != ${list.length}`;
    }
  }
  return true;
});

t("WG-Ausgleich summiert immer exakt auf null (300 Zufallsfälle)", () => {
  for (let i = 0; i < 300; i++) {
    const members = ["A", "B", "C", "D", "E"].slice(0, 2 + Math.floor(Math.random() * 4));
    const items = [];
    for (let j = 0; j < 1 + Math.floor(Math.random() * 8); j++) {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      items.push({ productId: p.id, quantity: 1 + Math.floor(Math.random() * 3),
        unitPrice: Math.round(Math.random() * 900) / 100 });
    }
    const assignment = {};
    items.forEach((it) => {
      if (Math.random() > 0.6) {
        assignment[it.productId] = { mode: SPLIT_MODE.PRIVATE, person: members[Math.floor(Math.random() * members.length)] };
      }
    });
    const payer = members[Math.floor(Math.random() * members.length)];
    const assigned = assignItems(items, assignment, payer);
    const balances = computeBalances(assigned, members);

    const sumBal = Math.round(Object.values(balances).reduce((s, v) => s + v, 0) * 100);
    if (Math.abs(sumBal) > 1) return `Salden summieren auf ${sumBal} Cent statt 0`;

    const transfers = settleUp(balances);
    const credits = Math.round(Object.values(balances).filter((v) => v > 0).reduce((s, v) => s + v, 0) * 100);
    const sent = Math.round(transfers.reduce((s, tr) => s + tr.amount, 0) * 100);
    if (Math.abs(sent - credits) > 1) return `Überweisungen ${sent} != Guthaben ${credits} (Cent)`;
  }
  return true;
});

t("Rezepte schlagen nie Zutaten vor, die nicht im Bestand sind (als vorhanden)", () => {
  for (let i = 0; i < 200; i++) {
    const stock = [];
    const n = 1 + Math.floor(Math.random() * 8);
    for (let j = 0; j < n; j++) {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      stock.push({ productId: p.id, daysLeft: Math.floor(Math.random() * 20), price: p.typicalPrice || 1 });
    }
    const stockIds = new Set(stock.map((s) => byId(s.productId)?.name));
    const recipes = suggestRecipes(stock);
    for (const r of recipes) {
      for (const used of r.usesFromStock) {
        if (!stockIds.has(used)) return `${r.name} nennt "${used}" als vorhanden, ist es aber nicht`;
      }
    }
  }
  return true;
});

t("Rezepte melden nie negativen geretteten Wert", () => {
  for (let i = 0; i < 100; i++) {
    const stock = Array.from({ length: 6 }, () => {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      return { productId: p.id, daysLeft: Math.floor(Math.random() * 10) - 3, price: p.typicalPrice || 1 };
    });
    for (const r of suggestRecipes(stock)) {
      if (r.rescuedValue < 0) return `${r.name}: ${r.rescuedValue}`;
    }
  }
  return true;
});

t("Kilogramm-Wert ist nie negativ oder unendlich", () => {
  for (let i = 0; i < 200; i++) {
    const events = Array.from({ length: 5 }, () => {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      return { productId: p.id, wastedFraction: Math.random() * 2 - 0.5, cycles: Math.floor(Math.random() * 50) };
    });
    const r = wasteInKilograms(events);
    if (!Number.isFinite(r.kg) || r.kg < 0) return `kg=${r.kg}`;
  }
  return true;
});

t("Sicherheitskritische Produkte behalten ihr Flag durchgehend", () => {
  const critical = FOOD_DATABASE.filter((p) => p.dateType === "verbrauchsdatum");
  for (const p of critical) {
    if (p.safetyCritical !== true) return `${p.id} hat Verbrauchsdatum aber safetyCritical=${p.safetyCritical}`;
    const c = inferChronicWaste(p.id, 30, p.typicalPrice || 1, 1);
    if (c && c.safetyCritical !== true) return `${p.id}: Flag geht in der Verschwendungslogik verloren`;
  }
  return true;
});

t("Non-Food taucht nie in Lebensmittel-Kilogramm auf", () => {
  const nonFood = FOOD_DATABASE.filter((p) => !p.isFood);
  const r = wasteInKilograms(nonFood.map((p) => ({ productId: p.id, wastedFraction: 1, cycles: 10 })));
  return r.kg === 0 ? true : `${r.kg} kg aus Non-Food`;
});

t("Produktabgleich liefert immer gültige Struktur (2000 Zufallsnamen)", () => {
  const teile = ["BIO", "FRISCH", "MILCH", "BROT", "500G", "1KG", "XYZ", "SALAT", "2X", "%%%", "DOSE", "TK"];
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(Math.random() * 5);
    const name = Array.from({ length: n }, () => teile[Math.floor(Math.random() * teile.length)]).join(" ");
    const r = matchProduct(name);
    if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) return `${name}: ${r.confidence}`;
    if (r.productId !== null && !byId(r.productId)) return `${name}: unbekannte ID ${r.productId}`;
    if (r.needsConfirmation && r.productId === null) return `${name}: soll bestätigt werden, hat aber keinen Treffer`;
  }
  return true;
});

t("Mengenerkennung liefert nie 0 oder negativ", () => {
  const namen = ["MILCH 0X", "BROT -5ER", "EIER 0ER", "SAFT 1000L", "X 99999ER"];
  for (const n of namen) {
    const p = parseProductName(n);
    if (p.quantity < 1) return `${n}: quantity=${p.quantity}`;
  }
  return true;
});

// ================================================================
section("C: Zufallsdaten — nichts darf abstürzen");

t("5000 zufällige Kaufhistorien durchlaufen fehlerfrei", () => {
  for (let i = 0; i < 5000; i++) {
    const history = [];
    const n = Math.floor(Math.random() * 12);
    for (let j = 0; j < n; j++) {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      const day = 1 + Math.floor(Math.random() * 28);
      const month = 1 + Math.floor(Math.random() * 12);
      history.push({
        productId: p.id,
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        quantity: Math.floor(Math.random() * 4),
        unitPrice: Math.round(Math.random() * 1500) / 100
      });
    }
    const rhythms = computeAllRhythms(history);
    inferWaste(history, rhythms);
    assumptionBasedSuggestions(history, "2026-12-31", 1 + Math.floor(Math.random() * 6));
    determineStage(history, rhythms);
  }
  return true;
});

// ================================================================
section("D: Last");

t("10.000 Käufe: Rhythmusberechnung unter 2 Sekunden", () => {
  const history = [];
  for (let i = 0; i < 10000; i++) {
    const p = FOOD_DATABASE[i % FOOD_DATABASE.length];
    const d = new Date(2020, 0, 1 + i);
    history.push({ productId: p.id, date: d.toISOString().slice(0, 10), quantity: 1, unitPrice: 1 });
  }
  const start = Date.now();
  const rhythms = computeAllRhythms(history);
  inferWaste(history, rhythms);
  const ms = Date.now() - start;
  console.log(`        (10.000 Käufe in ${ms} ms)`);
  return ms < 2000 ? true : `${ms} ms`;
});

t("1000 Bon-Zeilen zuordnen unter 3 Sekunden", () => {
  const namen = FOOD_DATABASE.map((p) => p.aliases[0] || p.name);
  const items = Array.from({ length: 1000 }, (_, i) => ({ name: namen[i % namen.length] }));
  const start = Date.now();
  matchReceipt(items);
  const ms = Date.now() - start;
  console.log(`        (1000 Zeilen in ${ms} ms)`);
  return ms < 3000 ? true : `${ms} ms`;
});

t("Budgetkürzung bei 500 Positionen unter 1 Sekunde", () => {
  const list = Array.from({ length: 500 }, () => {
    const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
    return { productId: p.id, name: p.name, category: p.category, price: p.typicalPrice || 1, wasteRate: Math.random() };
  });
  const start = Date.now();
  fitToBudget(list, 50);
  const ms = Date.now() - start;
  console.log(`        (500 Positionen in ${ms} ms)`);
  return ms < 1000 ? true : `${ms} ms`;
});


// ================================================================
section("E: Sicherheit (im Stresstest gefundene Fehler)");

t("Abgelaufenes Verbrauchsdatum-Produkt wird NIE zum Kochen vorgeschlagen", () => {
  const critical = FOOD_DATABASE.filter((p) => p.safetyCritical);
  for (const p of critical) {
    const stock = [
      { productId: p.id, daysLeft: -2, price: p.typicalPrice || 1 },
      { productId: "nudeln", daysLeft: 400, price: 1.29 },
      { productId: "konserve_tomaten", daysLeft: 400, price: 0.89 },
      { productId: "reis", daysLeft: 400, price: 2.19 }
    ];
    const recipes = suggestRecipes(stock);
    for (const r of recipes) {
      if (r.usesFromStock.includes(p.name)) {
        return `${p.name} (abgelaufen) wird in "${r.name}" verwendet`;
      }
    }
    if (!recipes.unsafeIngredients || !recipes.unsafeIngredients.length) {
      return `${p.name}: keine Warnung ausgegeben`;
    }
  }
  return true;
});

t("MHD-Produkte bleiben nach Ablauf verwendbar (Sinnescheck erlaubt)", () => {
  const stock = [
    { productId: "joghurt_natur", daysLeft: -2, price: 1.09 },
    { productId: "haferflocken", daysLeft: 300, price: 0.99 },
    { productId: "milch_vollmilch", daysLeft: 5, price: 1.19 }
  ];
  const recipes = suggestRecipes(stock);
  if (recipes.unsafeIngredients && recipes.unsafeIngredients.length) {
    return "MHD-Produkt fälschlich gesperrt";
  }
  return true;
});

t("Verbrauchsdatum-Produkt VOR Ablauf bleibt nutzbar", () => {
  const stock = [
    { productId: "haehnchen", daysLeft: 1, price: 6.99 },
    { productId: "reis", daysLeft: 400, price: 2.19 },
    { productId: "paprika", daysLeft: 3, price: 2.29 }
  ];
  const recipes = suggestRecipes(stock);
  const genutzt = recipes.some((r) => r.usesFromStock.includes("Hähnchenbrust"));
  return genutzt ? true : "frisches Hähnchen wird nicht mehr verwendet";
});

// Ohne Zahl im Titel: der Katalog wächst, und ein Titel, der bei
// jeder Erweiterung nachgezogen werden muss, wird irgendwann falsch
// und niemand merkt es.
t("Produktabgleich: jeder Name und jeder Alias trifft sein eigenes Produkt", () => {
  let fehl = 0, geprueft = 0;
  const beispiele = [];
  for (const p of FOOD_DATABASE) {
    for (const n of [p.name, ...p.aliases]) {
      geprueft++;
      const treffer = matchProduct(n).productId;
      if (treffer !== p.id) {
        fehl++;
        if (beispiele.length < 5) beispiele.push(`„${n}“ -> ${treffer || "nichts"} statt ${p.id}`);
      }
    }
  }
  if (geprueft < 1000) return `nur ${geprueft} Bezeichnungen geprüft — Katalog geschrumpft?`;
  return fehl === 0 ? true : `${fehl} von ${geprueft} treffen falsch: ${beispiele.join("; ")}`;
});

t("Kaputtes Datum vergiftet nicht die ganze Historie", () => {
  const r = computeRhythm([
    { date: "kaputt", quantity: 1 },
    { date: "2026-01-01", quantity: 1 },
    { date: "2026-01-07", quantity: 1 },
    { date: "2026-01-13", quantity: 1 }
  ]);
  if (!Number.isFinite(r.rhythmDays)) return `rhythmDays=${r.rhythmDays}`;
  if (r.invalidEntries !== 1) return `aussortiert ${r.invalidEntries} statt 1`;
  return true;
});


// ================================================================
section("F: Neue Features (Bestand, Grundpreis, Inflation, Urlaub, Pfand, Archiv)");

const { estimateInventory, estimateRemaining } = require("../src/algo/inventoryEstimator");
const { unitPrice, comparePackSizes } = require("../src/algo/unitPriceCalculator");
const { personalInflation } = require("../src/algo/personalInflation");
const { checkList, checkDuplicate } = require("../src/algo/duplicateWarning");
const { filterForVacation, useUpPlan } = require("../src/algo/vacationMode");
const { trackFromReceipt, openDeposit, markReturned, yearlyDepositVolume } = require("../src/algo/depositTracker");
const { archiveReceipt, expiringWarranties, searchArchive, archiveStats, cleanupCandidates } = require("../src/algo/receiptArchive");

t("Alle neuen Module überstehen leere Eingaben", () => {
  estimateInventory([], new Map(), "2026-08-08");
  unitPrice({ productId: "gibtsnicht" });
  comparePackSizes([]);
  personalInflation([], { from: "2026-01-01", to: "2026-01-31" }, { from: "2026-02-01", to: "2026-02-28" });
  checkList([], { history: [], rhythms: new Map(), today: "2026-08-08" });
  filterForVacation([], "2026-08-08", "2026-08-10", "2026-08-24");
  useUpPlan([], "2026-08-10", "2026-08-24", "2026-08-08");
  trackFromReceipt([], "2026-08-08");
  openDeposit([], "2026-08-08");
  archiveReceipt({ date: "2026-08-08", store: "X", items: [], total: 0 });
  expiringWarranties([], "2026-08-08");
  searchArchive([], "");
  archiveStats([]);
  return true;
});

t("Bestandsschätzung liefert nie negative Mengen oder Werte", () => {
  for (let i = 0; i < 500; i++) {
    const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
    const daysAgo = Math.floor(Math.random() * 400);
    const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    const est = estimateRemaining(p.id,
      { date: d, quantity: 1 + Math.floor(Math.random() * 5), unitPrice: Math.random() * 10 },
      { perUnitDays: Math.random() * 30, confidence: Math.random() },
      new Date().toISOString().slice(0, 10));
    if (!est) continue;
    if (est.remainingUnits < 0) return `remainingUnits=${est.remainingUnits}`;
    if (est.value < 0) return `value=${est.value}`;
    if (est.confidence < 0 || est.confidence > 1) return `confidence=${est.confidence}`;
  }
  return true;
});

t("Bestand schätzt nie mehr, als gekauft wurde", () => {
  for (let i = 0; i < 200; i++) {
    const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
    const qty = 1 + Math.floor(Math.random() * 5);
    const est = estimateRemaining(p.id,
      { date: "2026-08-01", quantity: qty, unitPrice: 2 },
      { perUnitDays: 10, confidence: 0.8 }, "2026-08-08");
    if (est && est.remainingUnits > qty + 0.001) return `${est.remainingUnits} > gekauft ${qty}`;
  }
  return true;
});

t("Grundpreis ist nie negativ oder unendlich", () => {
  for (const p of FOOD_DATABASE) {
    const u = unitPrice({ productId: p.id, unitPrice: p.typicalPrice, quantity: 1 });
    if (u && (!Number.isFinite(u.perKg) || u.perKg <= 0)) return `${p.id}: perKg=${u.perKg}`;
  }
  return true;
});

t("Grundpreis bei Gewicht 0 stürzt nicht ab", () => {
  const u = unitPrice({ productId: "milch_vollmilch", unitPrice: 1.19, quantity: 1, weightG: 0 });
  return u === null || Number.isFinite(u.perKg);
});

t("Inflation ohne gemeinsame Produkte meldet sich als unzuverlässig", () => {
  const hist = [
    { productId: "milch_vollmilch", date: "2026-01-05", quantity: 1, unitPrice: 1 },
    { productId: "nudeln", date: "2026-06-05", quantity: 1, unitPrice: 1 }
  ];
  const r = personalInflation(hist, { from: "2026-01-01", to: "2026-01-31" }, { from: "2026-06-01", to: "2026-06-30" });
  return r.reliable === false && r.productsCompared === 0;
});

t("Inflation ist nie NaN oder unendlich (300 Zufallshistorien)", () => {
  for (let i = 0; i < 300; i++) {
    const hist = [];
    for (let j = 0; j < 20; j++) {
      const p = FOOD_DATABASE[Math.floor(Math.random() * 20)];
      const month = Math.random() > 0.5 ? "01" : "06";
      hist.push({ productId: p.id, date: `2026-${month}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
        quantity: Math.floor(Math.random() * 3), unitPrice: Math.random() * 10 - 2 });
    }
    const r = personalInflation(hist, { from: "2026-01-01", to: "2026-01-31" }, { from: "2026-06-01", to: "2026-06-30" });
    if (!Number.isFinite(r.changePercent)) return `changePercent=${r.changePercent}`;
  }
  return true;
});

t("Doppelkauf-Warnung meldet jedes Produkt höchstens einmal", () => {
  const items = [
    { productId: "milch_vollmilch" }, { productId: "milch_vollmilch" },
    { productId: "milch_vollmilch" }, { productId: "brot_vollkorn" }
  ];
  const hist = [{ productId: "milch_vollmilch", date: "2026-08-07", quantity: 1, unitPrice: 1.19 }];
  const w = checkList(items, { history: hist, rhythms: new Map(), today: "2026-08-08" });
  const ids = w.map((x) => x.productId);
  return new Set(ids).size === ids.length ? true : `Doppelmeldung: ${ids.join(", ")}`;
});

t("Doppelkauf warnt nie bei Produkten ohne Kaufhistorie", () => {
  const w = checkDuplicate("kaffee", { history: [], rhythms: new Map(), today: "2026-08-08" });
  return w === null;
});

t("Urlaubsfilter verliert keine Positionen", () => {
  for (let i = 0; i < 200; i++) {
    const list = Array.from({ length: 8 }, () => {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      return { productId: p.id, name: p.name, price: p.typicalPrice || 1, rhythmDays: 1 + Math.floor(Math.random() * 30) };
    });
    const r = filterForVacation(list, "2026-08-08", "2026-08-10", "2026-08-24");
    if (r.keep.length + r.skip.length + r.reduce.length !== list.length) {
      return `${r.keep.length}+${r.skip.length}+${r.reduce.length} != ${list.length}`;
    }
  }
  return true;
});

t("Urlaubsmodus: Trockenware wird nie zurückgehalten", () => {
  const list = [
    { productId: "nudeln", name: "Nudeln", price: 1.29, rhythmDays: 21 },
    { productId: "reis", name: "Reis", price: 2.19, rhythmDays: 30 },
    { productId: "salz", name: "Salz", price: 0.49, rhythmDays: 200 }
  ];
  const r = filterForVacation(list, "2026-08-08", "2026-08-09", "2026-09-09");
  return r.skip.length === 0 ? true : `zurückgehalten: ${r.skip.map(i => i.name).join(", ")}`;
});

t("Urlaubsmodus empfiehlt nie Einfrieren bei nicht einfrierbarer Ware", () => {
  const inv = FOOD_DATABASE.filter((p) => p.isFood && !p.freezable).slice(0, 20).map((p) => ({
    productId: p.id, name: p.name, daysLeft: 2, value: p.typicalPrice || 1, remainingUnits: 1
  }));
  const plan = useUpPlan(inv, "2026-08-10", "2026-08-24", "2026-08-08");
  const falsch = plan.freeze.find((f) => !byId(f.productId).freezable);
  return falsch ? `${falsch.name} soll eingefroren werden, ist aber nicht einfrierbar` : true;
});

t("Pfandbetrag ist nie negativ", () => {
  for (let i = 0; i < 200; i++) {
    const items = Array.from({ length: 5 }, () => {
      const p = FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
      return { productId: p.id, quantity: Math.floor(Math.random() * 24) - 2 };
    });
    const r = trackFromReceipt(items, "2026-08-08");
    if (r.total < 0) return `total=${r.total}`;
  }
  return true;
});

t("Pfand: kein Pfand auf Nicht-Getränke", () => {
  const nonDrinks = FOOD_DATABASE.filter((p) => p.category !== "Getränke");
  const r = trackFromReceipt(nonDrinks.map((p) => ({ productId: p.id, quantity: 1 })), "2026-08-08");
  return r.total === 0 ? true : `${r.total} € Pfand auf Nicht-Getränke`;
});

t("Pfand: Rückgabe reduziert den offenen Betrag korrekt", () => {
  const r = trackFromReceipt([{ productId: "wasser", quantity: 6 }, { productId: "bier", quantity: 6 }], "2026-08-01");
  const vorher = openDeposit(r.entries, "2026-08-08").total;
  const nachher = openDeposit(markReturned(r.entries, ["wasser"], "2026-08-08"), "2026-08-08").total;
  const bilanz = yearlyDepositVolume(markReturned(r.entries, ["wasser"], "2026-08-08"));
  if (nachher >= vorher) return `offen nach Rückgabe ${nachher} >= vorher ${vorher}`;
  if (Math.abs(bilanz.total - (bilanz.returned + bilanz.open)) > 0.01) return "Bilanz stimmt nicht";
  return true;
});

t("Archiv: Lebensmittel erzeugen nie Garantieeinträge", () => {
  const food = FOOD_DATABASE.filter((p) => p.isFood).slice(0, 50);
  const r = archiveReceipt({ date: "2026-08-08", store: "X", total: 100,
    items: food.map((p) => ({ productId: p.id, quantity: 1, unitPrice: p.typicalPrice || 1 })) });
  return r.warrantyItems.length === 0 ? true : `${r.warrantyItems.length} Garantieeinträge für Lebensmittel`;
});

t("Archiv: Non-Food erzeugt immer Garantieeintrag mit 2-Jahres-Frist", () => {
  const nonFood = FOOD_DATABASE.filter((p) => !p.isFood);
  const r = archiveReceipt({ date: "2026-01-01", store: "X", total: 100,
    items: nonFood.map((p) => ({ productId: p.id, quantity: 1, unitPrice: p.typicalPrice || 1 })) });
  if (r.warrantyItems.length !== nonFood.length) return `${r.warrantyItems.length} statt ${nonFood.length}`;
  const falsch = r.warrantyItems.find((i) => i.warrantyUntil < "2027-12-01");
  return falsch ? `Frist zu kurz: ${falsch.warrantyUntil}` : true;
});

t("Archiv: Suche findet nichts bei leerer Anfrage", () => {
  const bons = [archiveReceipt({ date: "2026-08-08", store: "REWE", total: 10,
    items: [{ productId: "klopapier", quantity: 1, unitPrice: 3.99 }] })];
  return searchArchive(bons, "").length === 0 && searchArchive(bons, "   ").length === 0;
});

t("Archiv: Aufräumvorschlag betrifft nie garantierelevante Bons", () => {
  const bons = [
    archiveReceipt({ date: "2020-01-01", store: "A", total: 10, items: [{ productId: "klopapier", quantity: 1, unitPrice: 3.99 }] }),
    archiveReceipt({ date: "2020-01-01", store: "B", total: 10, items: [{ productId: "milch_vollmilch", quantity: 1, unitPrice: 1.19 }] })
  ];
  const c = cleanupCandidates(bons, "2026-08-08");
  return c.every((x) => x.store === "B") ? true : "garantierelevanter Bon zum Löschen vorgeschlagen";
});

// ================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`STRESSTEST: ${pass} bestanden, ${fail} fehlgeschlagen`);
if (problems.length) {
  console.log(`\nGefundene Probleme:`);
  problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
}
console.log("");
process.exit(fail > 0 ? 1 : 0);
