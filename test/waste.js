/**
 * waste.js — Tests für die Verschwendungsbilanz
 * ================================================================
 * Anlass ist ein gefundener Fehler: die Quote konnte über 100 %
 * gehen. „21 von 20 Käufen verdorben“ stand in der Oberfläche, weil
 * chronischer Anteil und Ausreißer addiert statt verglichen wurden —
 * derselbe Kauf lief über zwei Kanäle in dieselbe Summe.
 *
 * Diese Datei prüft deshalb nicht nur den einen Fall, sondern die
 * INVARIANTEN, die er verletzt hat. Eine Zahl, die es nicht geben
 * kann, muss an einer Regel scheitern und nicht an einem Beispiel:
 *
 *   A) Was immer gelten muss — verdorben ≤ gekauft, Euro ≤ Ausgaben
 *   B) Die Regel selbst: der größere Anteil zählt, nie die Summe
 *   C) Zufallsdaten: 5000 erfundene Haushalte, keine Ausnahme
 * ================================================================
 */

const { wasteSummary, inferWaste, inferChronicWaste } = require("../src/algo/wasteInference2");
const { computeRhythm } = require("../src/algo/rhythmEngine2");
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

const section = (title) => console.log(`\n--- ${title} ---`);

/** Kaufreihe mit festem Abstand. */
function serie(productId, anzahl, abstandTage, preis = 5, menge = 1) {
  const rows = [];
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date("2026-08-13T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - i * abstandTage);
    rows.push({ productId, date: d.toISOString().slice(0, 10), quantity: menge, unitPrice: preis });
  }
  return rows;
}

// ================================================================
section("A: Was immer gelten muss");

t("Verdorben ist nie mehr als gekauft — der gefundene Fall", () => {
  // Genau die Lage aus der Demo: Hähnchen alle 10 Tage, Haltbarkeit
  // 2 Tage, dazu fünf besonders lange Lücken.
  const kaeufe = serie("haehnchen", 20, 10, 7.49);
  const chronic = { wastedFraction: 0.8 };
  const ausreisser = [3, 7, 11, 15, 19].map((i) => ({ date: kaeufe[i].date }));
  const s = wasteSummary("haehnchen", kaeufe, chronic, ausreisser);
  if (s.wasted > s.purchased) return `${s.wasted} von ${s.purchased}`;
  if (s.wasteRate > 1) return `Quote ${s.wasteRate}`;
  return true;
});

t("Der Eurobetrag übersteigt nie die Ausgaben", () => {
  const kaeufe = serie("haehnchen", 20, 10, 7.49);
  const s = wasteSummary("haehnchen", kaeufe, { wastedFraction: 0.9 },
    kaeufe.map((k) => ({ date: k.date })));
  return s.wastedEuros <= s.spent ? true : `${s.wastedEuros} € von ${s.spent} € Ausgaben`;
});

t("Ohne Signal ist nichts verdorben", () => {
  const s = wasteSummary("reis", serie("reis", 10, 30, 2.19), null, []);
  return s.wasted === 0 && s.wastedEuros === 0 && s.wasteRate === 0 ? true : JSON.stringify(s);
});

t("Ohne Käufe bleibt alles null, ohne Division durch null", () => {
  const s = wasteSummary("reis", [], { wastedFraction: 0.5 }, [{ date: "2026-08-01" }]);
  return s.purchased === 0 && s.wasteRate === 0 && Number.isFinite(s.wastedEuros)
    ? true : JSON.stringify(s);
});

t("Alle ausgegebenen Zahlen sind endlich", () => {
  const faelle = [
    [serie("milch_vollmilch", 5, 7), { wastedFraction: 0.3 }, []],
    [serie("milch_vollmilch", 5, 7, 0), { wastedFraction: 1 }, [{ date: "2026-08-13" }]],
    [[{ productId: "x", date: "2026-08-01", quantity: 0, unitPrice: NaN }], { wastedFraction: 0.5 }, []],
    [[{ productId: "x" }, null].filter(Boolean), null, []]
  ];
  for (const [k, c, a] of faelle) {
    const s = wasteSummary("x", k, c, a);
    for (const [feld, wert] of Object.entries(s)) {
      if (typeof wert === "number" && !Number.isFinite(wert)) return `${feld} = ${wert}`;
    }
  }
  return true;
});

t("Müll als Eingabe stürzt nicht ab", () => {
  for (const k of [null, undefined, "keine Liste", {}, 42]) {
    const s = wasteSummary("x", k, null, null);
    if (!s || s.purchased !== 0) return `kaputt bei ${JSON.stringify(k)}`;
  }
  return true;
});

// ================================================================
section("B: Der größere Anteil zählt, nie die Summe");

t("Ein Ausreißer erhöht den chronischen Anteil auf höchstens 1", () => {
  const kaeufe = serie("haehnchen", 4, 10, 10);
  const ohne = wasteSummary("haehnchen", kaeufe, { wastedFraction: 0.5 }, []);
  // Der Ausreißer steht auf dem NACHFOLGER des verlorenen Kaufs.
  const mit = wasteSummary("haehnchen", kaeufe, { wastedFraction: 0.5 }, [{ date: kaeufe[2].date }]);
  const zuwachs = mit.wasted - ohne.wasted;
  // Ein Kauf geht von 0,5 auf 1,0 — also plus 0,5, nicht plus 1.
  return Math.abs(zuwachs - 0.5) < 0.001 ? true : `Zuwachs ${zuwachs} statt 0,5`;
});

t("Ohne chronisches Muster zählt ein Ausreißer voll", () => {
  const kaeufe = serie("salat_kopf", 4, 10, 2);
  const s = wasteSummary("salat_kopf", kaeufe, null, [{ date: kaeufe[2].date }]);
  return Math.abs(s.wasted - 1) < 0.001 ? true : `${s.wasted} statt 1`;
});

t("Zehn Ausreißer bei zehn Käufen ergeben zehn, nicht zwanzig", () => {
  const kaeufe = serie("haehnchen", 10, 10, 5);
  const s = wasteSummary("haehnchen", kaeufe, { wastedFraction: 0.9 },
    kaeufe.map((k) => ({ date: k.date })));
  return s.wasted <= 10 ? true : `${s.wasted}`;
});

t("Der Betrag rechnet mit dem gezahlten Preis je Kauf", () => {
  // Früher galt der letzte Preis für alle Käufe. Bei steigenden
  // Preisen war der Verlust dadurch systematisch zu hoch.
  const kaeufe = [
    { productId: "x", date: "2026-01-01", quantity: 1, unitPrice: 1 },
    { productId: "x", date: "2026-02-01", quantity: 1, unitPrice: 9 }
  ];
  const s = wasteSummary("x", kaeufe, { wastedFraction: 1 }, []);
  return Math.abs(s.wastedEuros - 10) < 0.001 ? true : `${s.wastedEuros} statt 10`;
});

t("Die Menge geht in den Betrag ein", () => {
  const einzeln = wasteSummary("x", [{ productId: "x", date: "2026-01-01", quantity: 1, unitPrice: 3 }],
    { wastedFraction: 1 }, []);
  const dreifach = wasteSummary("x", [{ productId: "x", date: "2026-01-01", quantity: 3, unitPrice: 3 }],
    { wastedFraction: 1 }, []);
  return Math.abs(dreifach.wastedEuros - einzeln.wastedEuros * 3) < 0.001
    ? true : `${dreifach.wastedEuros} statt ${einzeln.wastedEuros * 3}`;
});

t("Ein Ausreißer auf dem ersten Kauf wirkt auf niemanden", () => {
  // Vor dem ersten Kauf gibt es keine Ware, die verderben konnte.
  const kaeufe = serie("salat_kopf", 3, 20, 2);
  const s = wasteSummary("salat_kopf", kaeufe, null, [{ date: kaeufe[0].date }]);
  return s.wasted === 0 ? true : `${s.wasted} verdorben ohne vorherigen Kauf`;
});

// ================================================================
section("C: Zusammenspiel mit den Signalen");

t("Echte Historie: chronisch verschwenderisches Produkt bleibt unter 100 %", () => {
  const kaeufe = serie("salat_kopf", 30, 9, 1.49);
  const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  const s = wasteSummary("salat_kopf", kaeufe,
    chronic.find((c) => c.productId === "salat_kopf") || null,
    anomalies.filter((a) => a.productId === "salat_kopf"));
  if (s.wasteRate > 1) return `Quote ${s.wasteRate}`;
  if (s.wasted > s.purchased) return `${s.wasted} von ${s.purchased}`;
  return true;
});

t("Ein sparsames Produkt bekommt keine Verschwendung angedichtet", () => {
  // Milch alle 3 Tage, Haltbarkeit 8 — da geht nichts verloren.
  const kaeufe = serie("milch_vollmilch", 20, 3, 1.19);
  const rhythms = new Map([["milch_vollmilch", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  const s = wasteSummary("milch_vollmilch", kaeufe,
    chronic.find((c) => c.productId === "milch_vollmilch") || null,
    anomalies.filter((a) => a.productId === "milch_vollmilch"));
  return s.wasted === 0 ? true : `${s.wasted} verdorben bei passendem Rhythmus`;
});

t("5000 zufällige Haushalte verletzen keine Invariante", () => {
  let seed = 20260813;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ids = FOOD_DATABASE.filter((p) => p.isFood).map((p) => p.id);

  for (let i = 0; i < 5000; i++) {
    const pid = ids[Math.floor(rnd() * ids.length)];
    const n = 1 + Math.floor(rnd() * 25);
    const abstand = 1 + Math.floor(rnd() * 40);
    const preis = Math.round(rnd() * 900) / 100;
    const menge = 1 + Math.floor(rnd() * 3);
    const kaeufe = serie(pid, n, abstand, preis, menge);

    const rhythms = new Map([[pid, computeRhythm(kaeufe)]]);
    const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
    const s = wasteSummary(pid, kaeufe,
      chronic.find((c) => c.productId === pid) || null,
      anomalies.filter((a) => a.productId === pid));

    if (s.wasted > s.purchased + 0.001) return `${pid}: ${s.wasted} von ${s.purchased} (Runde ${i})`;
    if (s.wasteRate > 1.001) return `${pid}: Quote ${s.wasteRate} (Runde ${i})`;
    if (s.wastedEuros > s.spent + 0.011) return `${pid}: ${s.wastedEuros} € von ${s.spent} € (Runde ${i})`;
    if (!Number.isFinite(s.wastedEuros) || s.wastedEuros < 0) return `${pid}: Betrag ${s.wastedEuros}`;
  }
  return true;
});

t("Trockenware und Tiefkühl bleiben ausgenommen", () => {
  // Reis verdirbt nicht, egal wie selten er gekauft wird.
  const kaeufe = serie("reis", 12, 200, 2.19);
  const rhythms = new Map([["reis", computeRhythm(kaeufe)]]);
  const { chronic } = inferWaste(kaeufe, rhythms);
  return chronic.every((c) => c.productId !== "reis")
    ? true : "Reis gilt als chronisch verschwenderisch";
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`VERSCHWENDUNG: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
