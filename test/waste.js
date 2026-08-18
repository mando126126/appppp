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

/* ================================================================
   D) Die Nutzerkorrektur — „das habe ich aufgegessen"
   ================================================================
   Sie greift an genau der Stelle, an der schon zweimal doppelt
   gezählt wurde. Geprüft wird deshalb nicht, dass die Zahl sinkt
   (das wäre leicht), sondern dass sie um GENAU das sinkt, was der
   korrigierte Kauf beigetragen hat — und dass nichts anderes sich
   mitverändert.
   ================================================================ */
section("D) Die Nutzerkorrektur");

/** Ein Produkt mit sicherem chronischem Anteil: Rhythmus > Haltbarkeit. */
function chronischeReihe() {
  const kaeufe = serie("salat_kopf", 10, 14, 1.29);          // hält 5 Tage
  const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  return {
    kaeufe,
    chronic: chronic.find((c) => c.productId === "salat_kopf") || null,
    anomalies: anomalies.filter((a) => a.productId === "salat_kopf")
  };
}

t("Ohne Korrektur ändert sich nichts", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const a = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  const b = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [] });
  return a.wasted === b.wasted && a.wastedEuros === b.wastedEuros
    ? true : `${a.wasted} ≠ ${b.wasted}`;
});

t("Ein bestätigter Kauf zählt nicht mehr mit", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const ohne = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  const mit = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [kaeufe[0].date] });
  return mit.wasted < ohne.wasted ? true : `${ohne.wasted} -> ${mit.wasted}`;
});

t("Und zwar um genau seinen Anteil", () => {
  /* Der bestätigte Kauf trug den laufenden Anteil bei — mehr nicht,
     denn ein Ausreißer ist er nicht. Genau der muss verschwinden. */
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const ohne = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  const mit = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [kaeufe[0].date] });
  const diff = ohne.wasted - mit.wasted;
  return Math.abs(diff - ohne.chronicShare) < 0.051
    ? true : `Differenz ${diff.toFixed(2)}, Anteil ${ohne.chronicShare}`;
});

t("Der laufende Anteil lässt sich für das Produkt abstellen", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const ohne = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  const aus = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { noChronic: true });
  if (!(ohne.chronicShare > 0)) return "die Reihe hat gar keinen laufenden Anteil";
  return aus.wasted === 0 && aus.chronicOff === true
    ? true : `${ohne.wasted} -> ${aus.wasted}`;
});

t("Abgestellt heißt abgestellt, nicht halbiert", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const aus = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { noChronic: true });
  return aus.wastedEuros === 0 && aus.wasteRate === 0 ? true : `${aus.wastedEuros} / ${aus.wasteRate}`;
});

t("Ein Ausreißer überlebt das Abstellen des laufenden Anteils", () => {
  /* Beide Signale getrennt: wer sagt „bei mir verdirbt kein Brot“,
     hat damit nicht gesagt, dass die Packung vom 3.8. gegessen wurde.
     Ein Schalter, der beides abräumt, wäre wieder EIN Ereignis über
     ZWEI Kanäle — nur in die andere Richtung. */
  const kaeufe = serie("salat_kopf", 8, 4, 1.29);
  kaeufe[6].date = "2026-07-20";                 // eine echte Lücke
  const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  const c = chronic.find((x) => x.productId === "salat_kopf") || null;
  const an = anomalies.filter((x) => x.productId === "salat_kopf");
  if (!an.length) return true;                   // Aufbau erzeugte keinen Ausreißer
  const aus = wasteSummary("salat_kopf", kaeufe, c, an, { noChronic: true });
  return aus.wasted > 0 && aus.details.some((d) => d.anomaly)
    ? true : "der Ausreißer ist mit verschwunden";
});

t("Beides zusammen ergibt null", () => {
  const kaeufe = serie("salat_kopf", 8, 4, 1.29);
  kaeufe[6].date = "2026-07-20";
  const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  const c = chronic.find((x) => x.productId === "salat_kopf") || null;
  const an = anomalies.filter((x) => x.productId === "salat_kopf");
  const aus = wasteSummary("salat_kopf", kaeufe, c, an, {
    noChronic: true,
    eaten: kaeufe.map((k) => k.date)
  });
  return aus.wasted === 0 && aus.wastedEuros === 0 ? true : `${aus.wasted}`;
});

t("Alle bestätigt heißt kein Verlust", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const mit = wasteSummary("salat_kopf", kaeufe, chronic, anomalies,
    { eaten: kaeufe.map((k) => k.date) });
  return mit.wasted === 0 && mit.wastedEuros === 0 ? true : `${mit.wasted} / ${mit.wastedEuros}`;
});

t("Die Korrektur schaltet BEIDE Schätzungen ab", () => {
  /* Der Punkt, an dem die alte, ungenutzte Fassung falsch gewesen
     wäre: sie filterte nur Ausreißer-Ereignisse. Der chronische
     Anteil wäre stehen geblieben — und die Zahl kaum gesunken. */
  const kaeufe = serie("salat_kopf", 8, 14, 1.29);
  // Eine echte Lücke einbauen: der vorletzte Abstand wird sehr lang.
  kaeufe[6].date = "2026-06-01";
  const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
  const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
  const c = chronic.find((x) => x.productId === "salat_kopf") || null;
  const an = anomalies.filter((x) => x.productId === "salat_kopf");
  if (!c || !an.length) return true;   // Aufbau erzeugte keinen Doppelfall

  // Der Kauf VOR dem Ausreißer ist der als total verloren geführte.
  const i = kaeufe.findIndex((k) => k.date === an[0].date);
  const betroffen = kaeufe[i - 1];
  if (!betroffen) return true;

  const mit = wasteSummary("salat_kopf", kaeufe, c, an, { eaten: [betroffen.date] });
  const zeile = mit.details.find((d) => d.date === betroffen.date);
  return zeile && zeile.eaten && mit.details.filter((d) => d.eaten).length === 1
    ? true : "der bestätigte Kauf trägt weiter bei";
});

t("Bestätigen und zurücknehmen führt zum Ausgangspunkt", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const a = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [kaeufe[2].date] });
  const c = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [] });
  return a.wasted === c.wasted && a.wastedEuros === c.wastedEuros ? true : "nicht umkehrbar";
});

t("Die Quote bleibt in ihren Grenzen", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  for (let n = 0; n <= kaeufe.length; n++) {
    const st = wasteSummary("salat_kopf", kaeufe, chronic, anomalies,
      { eaten: kaeufe.slice(0, n).map((k) => k.date) });
    if (st.wasteRate < 0 || st.wasteRate > 1) return `Quote ${st.wasteRate} bei ${n}`;
    if (st.wasted < 0 || st.wasted > st.purchased) return `verdorben ${st.wasted} von ${st.purchased}`;
    if (st.wastedEuros < 0 || st.wastedEuros > st.spent + 0.01) return `Euro ${st.wastedEuros} von ${st.spent}`;
    if (st.corrected > st.purchased) return `korrigiert ${st.corrected}`;
  }
  return true;
});

t("Ein unbekanntes Datum ändert nichts", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const a = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  const b = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: ["1999-01-01"] });
  return a.wasted === b.wasted && b.corrected === 0 ? true : "erfundenes Datum wirkt";
});

t("Die Aufstellung nennt nur einzelne Ereignisse", () => {
  /* Der laufende Anteil gehört NICHT hinein: er gilt für alle Käufe
     gleich. Beim ersten Anlauf stand er als eigene Zeile bei jedem
     Kauf — zwölf identische „etwa 14 % von 2,49 €“, und wer ihm
     widersprechen wollte, hätte dreißigmal tippen müssen. */
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const st = wasteSummary("salat_kopf", kaeufe, chronic, anomalies, { eaten: [kaeufe[0].date] });
  const alleBekannt = st.details.every((d) => kaeufe.some((k) => k.date === d.date));
  const nurEreignisse = st.details.every((d) => d.anomaly || d.eaten);
  return alleBekannt && nurEreignisse
    ? true : `${st.details.length} Zeilen, davon ${st.details.filter((d) => !d.anomaly && !d.eaten).length} ohne Ereignis`;
});

t("Reihenfolge: der jüngste Verdacht steht oben", () => {
  const { kaeufe, chronic, anomalies } = chronischeReihe();
  const st = wasteSummary("salat_kopf", kaeufe, chronic, anomalies);
  for (let i = 1; i < st.details.length; i++) {
    if (st.details[i - 1].date < st.details[i].date) return "falsch sortiert";
  }
  return true;
});

t("2000 Zufallskorrekturen halten alle Invarianten", () => {
  let seed = 20260818;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 2000; i++) {
    const anzahl = 3 + Math.floor(rnd() * 12);
    const kaeufe = serie("salat_kopf", anzahl, 3 + Math.floor(rnd() * 25), 0.5 + rnd() * 4);
    const rhythms = new Map([["salat_kopf", computeRhythm(kaeufe)]]);
    const { chronic, anomalies } = inferWaste(kaeufe, rhythms);
    const c = chronic.find((x) => x.productId === "salat_kopf") || null;
    const an = anomalies.filter((x) => x.productId === "salat_kopf");
    const eaten = kaeufe.filter(() => rnd() < 0.4).map((k) => k.date);

    const ohne = wasteSummary("salat_kopf", kaeufe, c, an);
    const mit = wasteSummary("salat_kopf", kaeufe, c, an, { eaten });

    if (mit.wasted > ohne.wasted + 1e-9) return "Korrektur erhöht den Verlust";
    if (mit.wastedEuros > ohne.wastedEuros + 0.011) return "Korrektur erhöht die Euro";
    if (mit.wasted < 0 || mit.wasted > mit.purchased) return `verdorben ${mit.wasted}`;
    if (mit.wasteRate < 0 || mit.wasteRate > 1) return `Quote ${mit.wasteRate}`;
    if (mit.spent !== ohne.spent) return "die Ausgaben haben sich verändert";
    if (mit.purchased !== ohne.purchased) return "die Kaufzahl hat sich verändert";
    if (mit.details.some((d) => d.eaten && d.share > 0 && !eaten.includes(d.date))) return "fremde Zeile bestätigt";
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
