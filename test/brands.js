/**
 * brands.js — Tests für Marke gegen Eigenmarke
 * ================================================================
 * Der gefährlichste Fehler dieses Moduls ist nicht ein verpasstes
 * Potenzial, sondern eine Zahl, die stimmt zu scheinen vorgibt:
 *
 *   - geschätzte und belegte Beträge zusammengezählt
 *   - 500-g-Marke gegen 250-g-Eigenmarke verglichen
 *   - ein Potenzial hochgerechnet, das der Haushalt längst hebt
 *   - ein Vorschlag für etwas, das jemand PROBIERT und verworfen hat
 *
 * Für jeden dieser vier steht hier ein Test.
 * ================================================================
 */

const {
  brandOf, brandNorm, brandLabel, purchaseBrand, pricePointOf, purchasesPerYear,
  candidateFor, brandSwapCandidates, swapHeadline,
  BRAND_TIER, OWN_BRAND_MARKERS, MANUFACTURER_MARKERS,
  ESTIMATED_SHARE, MIN_YEAR_EUROS, MAX_PER_YEAR
} = require("../src/algo/brandSwap");

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

/** Kaufreihe bauen: alle `everyDays` Tage, rückwärts vom Stichtag. */
function serie({ productId, raw, price, weightG = null, count, everyDays, endOffset = 0 }) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const d = new Date("2026-08-01T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - endOffset - i * everyDays);
    rows.push({
      productId, raw, quantity: 1, unitPrice: price, weightG,
      date: d.toISOString().slice(0, 10)
    });
  }
  return rows;
}

// ================================================================
section("A: Marke einer Bonzeile erkennen");

const ZEILEN = [
  ["EHRMANN ALMIGHURT 150G", BRAND_TIER.MARKE],
  ["MILBONA JOGHURT NATUR", BRAND_TIER.EIGEN],
  ["JA! H-MILCH 1,5% 1L", BRAND_TIER.EIGEN],
  ["GUT&GUENSTIG BUTTER 250G", BRAND_TIER.EIGEN],
  ["K-CLASSIC SPAGHETTI 500G", BRAND_TIER.EIGEN],
  ["MUELLERMILCH", BRAND_TIER.UNBEKANNT],   // ein Wort, kein Marker
  ["MUELLER MILCHREIS", BRAND_TIER.MARKE],
  ["COCA COLA 1,5L", BRAND_TIER.MARKE],
  ["BANANEN LOSE", BRAND_TIER.UNBEKANNT],
  ["TOMATEN 500G", BRAND_TIER.UNBEKANNT],
  ["BALEA DUSCHGEL", BRAND_TIER.EIGEN],
  ["NIVEA DUSCHGEL", BRAND_TIER.MARKE]
];

ZEILEN.forEach(([zeile, erwartet]) => {
  t(`„${zeile}“ ist ${erwartet || "ohne Marke"}`, () => {
    const b = brandOf(zeile);
    return b.tier === erwartet ? true : `erkannt als ${b.tier} (${b.label})`;
  });
});

t("Die Eigenmarke gewinnt gegen den Händlernamen", () => {
  // „EDEKA GUT&GUENSTIG" enthält beides. Andersherum gelesen bekäme
  // der Haushalt den Rat, das zu kaufen, was er schon kauft.
  const b = brandOf("EDEKA GUT & GUENSTIG SONNENBLUMENOEL");
  return b.tier === BRAND_TIER.EIGEN ? true : `${b.tier}/${b.label}`;
});

t("Alle Marker sind bereits normalisiert", () => {
  // Ein Marker mit „ß" oder Großbuchstaben trifft nie, weil die Zeile
  // vor dem Vergleich gefaltet wird — und das fällt sonst niemandem
  // auf, weil das Ergebnis nur „keine Marke" ist.
  const schlecht = [...OWN_BRAND_MARKERS, ...MANUFACTURER_MARKERS]
    .filter((m) => brandNorm(m) !== m);
  return schlecht.length === 0 ? true : `nicht normalisiert: ${schlecht.join(", ")}`;
});

t("Kein Marker steht in beiden Listen", () => {
  const eigen = new Set(OWN_BRAND_MARKERS);
  const doppelt = MANUFACTURER_MARKERS.filter((m) => eigen.has(m));
  return doppelt.length === 0 ? true : `in beiden: ${doppelt.join(", ")}`;
});

t("Keine Dubletten innerhalb einer Liste", () => {
  for (const [name, list] of [["Eigenmarken", OWN_BRAND_MARKERS], ["Marken", MANUFACTURER_MARKERS]]) {
    if (new Set(list).size !== list.length) {
      const seen = new Set(), dop = [];
      list.forEach((m) => { if (seen.has(m)) dop.push(m); seen.add(m); });
      return `${name}: ${dop.join(", ")}`;
    }
  }
  return true;
});

t("Müll erzeugt keine Marke", () => {
  for (const m of ["", null, undefined, 0, [], {}, "!!!", "   "]) {
    const b = brandOf(m);
    if (b.tier !== null) return `${JSON.stringify(m)} -> ${b.tier}`;
  }
  return true;
});

t("Ein Teilwort ist keine Marke", () => {
  // „mars" steckt in „Marsch" — als Wortteil darf das nicht zählen.
  const b = brandOf("MARSCHMELLOWS");
  return b.tier === null ? true : `${b.tier}/${b.label}`;
});

t("Gespeicherte Marke schlägt die Zeile", () => {
  const p = { brand: "eigen", brandLabel: "milbona", raw: "EHRMANN JOGHURT" };
  return purchaseBrand(p).tier === BRAND_TIER.EIGEN ? true : "Zeile hat gewonnen";
});

t("brandLabel macht etwas Lesbares", () => {
  return brandLabel("gut und guenstig") === "Gut Und Guenstig" ? true : brandLabel("gut und guenstig");
});

// ================================================================
section("B: Die vier gefährlichen Rechenfehler");

t("Belegt und geschätzt werden nie addiert", () => {
  const kaeufe = [
    // Joghurt: beides gekauft -> belegt
    ...serie({ productId: "joghurt_natur", raw: "EHRMANN JOGHURT", price: 1.29, count: 6, everyDays: 7, endOffset: 0 }),
    ...serie({ productId: "joghurt_natur", raw: "MILBONA JOGHURT", price: 0.59, count: 3, everyDays: 14, endOffset: 3 }),
    // Kaffee: nur Marke -> geschätzt
    ...serie({ productId: "kaffee", raw: "JACOBS KROENUNG 500G", price: 6.99, count: 6, everyDays: 21 })
  ];
  const r = brandSwapCandidates(kaeufe);
  if (!r.belegt.length) return "nichts belegt";
  if (!r.geschaetzt.length) return "nichts geschätzt";
  if (r.proJahrBelegt + r.proJahrGeschaetzt === r.proJahrBelegt) return "Summen vermischt";
  // Es darf schlicht kein Feld geben, das beides zusammenfasst.
  // Gemeint sind Geldfelder — `zeilenGesamt` zählt Bonzeilen.
  const felder = Object.keys(r).filter((k) => /^proJahr$|^gesamt|^summe/i.test(k));
  return felder.length === 0 ? true : `Sammelfeld vorhanden: ${felder.join(", ")}`;
});

t("Verschiedene Packungsgrößen werden nicht verglichen", () => {
  // 500 g Marke für 2,40 € ist je 100 g GÜNSTIGER als 250 g
  // Eigenmarke für 1,40 € — der nackte Stückpreis behauptete das
  // Gegenteil und meldete 1,00 € Ersparnis je Kauf.
  const kaeufe = [
    ...serie({ productId: "butter", raw: "KERRYGOLD BUTTER 500G", price: 2.40, weightG: 500, count: 5, everyDays: 14 }),
    ...serie({ productId: "butter", raw: "MILBONA BUTTER 250G", price: 1.40, weightG: 250, count: 3, everyDays: 14, endOffset: 100 })
  ];
  const c = candidateFor("butter", kaeufe);
  if (!c) return true;                       // gar kein Vorschlag ist richtig
  if (c.abgelehnt) return true;
  return `Vorschlag trotz teurerer Eigenmarke: ${JSON.stringify(c)}`;
});

t("Je 100 g wird richtig verglichen", () => {
  const kaeufe = [
    ...serie({ productId: "butter", raw: "KERRYGOLD BUTTER 250G", price: 2.60, weightG: 250, count: 6, everyDays: 14 }),
    ...serie({ productId: "butter", raw: "MILBONA BUTTER 250G", price: 1.60, weightG: 250, count: 3, everyDays: 28, endOffset: 7 })
  ];
  const c = candidateFor("butter", kaeufe);
  if (!c || c.abgelehnt) return "kein Vorschlag, obwohl die Eigenmarke günstiger ist";
  if (c.basis !== "100g") return `Basis ${c.basis}`;
  // 1,04 €/100g gegen 0,64 €/100g = 0,40 € je 100 g
  return Math.abs(c.differenz - 0.4) < 0.01 ? true : `Differenz ${c.differenz}`;
});

t("Was der Haushalt schon zur Hälfte hebt, wird nicht voll gezählt", () => {
  // Dieselben zehn Kauftage in beiden Fällen — nur die Verteilung
  // Marke/Eigenmarke ist verschieden. Sonst verglichen sich zwei
  // verschiedene Kaufhäufigkeiten und der Test sagte nichts über den
  // Markenanteil aus.
  const tage = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date("2026-08-01T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - i * 7);
    tage.push(d.toISOString().slice(0, 10));
  }
  const bau = (istEigen) => tage.map((date, i) => ({
    productId: "joghurt_natur", date, quantity: 1, weightG: null,
    raw: istEigen(i) ? "MILBONA JOGHURT" : "EHRMANN JOGHURT",
    unitPrice: istEigen(i) ? 0.60 : 1.20
  }));

  const halb = bau((i) => i % 2 === 1);        // jeder zweite Kauf Eigenmarke
  const ganz = bau((i) => i === 1);            // nur einer

  const a = candidateFor("joghurt_natur", halb);
  const b = candidateFor("joghurt_natur", ganz);
  if (!a || a.abgelehnt) return "halber Fall ergibt keinen Vorschlag";
  if (!b || b.abgelehnt) return "voller Fall ergibt keinen Vorschlag";
  if (a.proJahr !== b.proJahr) return `verschiedene Häufigkeit: ${a.proJahr} zu ${b.proJahr}`;
  return a.jahresPotenzial < b.jahresPotenzial
    ? true
    : `halb (${a.jahresPotenzial}) nicht kleiner als voll (${b.jahresPotenzial})`;
});

t("Probiert und verworfen: kein Vorschlag mehr", () => {
  // Eigenmarke vor einem halben Jahr, seitdem wieder Marke. Das ist
  // eine Antwort, keine Wissenslücke.
  const kaeufe = [
    ...serie({ productId: "kaffee", raw: "DALLMAYR PRODOMO", price: 6.99, count: 8, everyDays: 14 }),
    ...serie({ productId: "kaffee", raw: "BELLAROM KAFFEE", price: 3.49, count: 2, everyDays: 14, endOffset: 180 })
  ];
  const c = candidateFor("kaffee", kaeufe);
  return c && c.abgelehnt ? true : `Vorschlag trotz Rückkehr zur Marke: ${JSON.stringify(c)}`;
});

t("Abgelehnte tauchen in keiner Liste auf, werden aber gezählt", () => {
  const r = brandSwapCandidates([
    ...serie({ productId: "kaffee", raw: "DALLMAYR PRODOMO", price: 6.99, count: 8, everyDays: 14 }),
    ...serie({ productId: "kaffee", raw: "BELLAROM KAFFEE", price: 3.49, count: 2, everyDays: 14, endOffset: 180 })
  ]);
  if (r.belegt.length || r.geschaetzt.length) return "steht doch in einer Liste";
  return r.abgelehnt === 1 ? true : `abgelehnt=${r.abgelehnt}`;
});

// ================================================================
section("C: Zurückhaltung");

t("Ein einzelner Markenkauf ergibt keinen Vorschlag", () => {
  const c = candidateFor("kaffee", serie({
    productId: "kaffee", raw: "JACOBS KROENUNG", price: 6.99, count: 1, everyDays: 14
  }));
  return c === null ? true : JSON.stringify(c);
});

t("Kleinbeträge werden verschwiegen", () => {
  // 4 Cent Unterschied, zweimal im Jahr — darüber redet man nicht.
  const c = candidateFor("salz", serie({
    productId: "salz", raw: "BAD REICHENHALLER SALZ", price: 0.45, count: 4, everyDays: 180
  }));
  return c === null ? true : `Vorschlag über ${c.jahresPotenzial} €`;
});

t("Unter der Jahresschwelle wird nichts gemeldet", () => {
  const r = brandSwapCandidates(serie({
    productId: "senf", raw: "THOMY SENF", price: 1.29, count: 3, everyDays: 120
  }));
  const alle = [...r.belegt, ...r.geschaetzt];
  return alle.every((c) => c.jahresPotenzial >= MIN_YEAR_EUROS)
    ? true
    : `unter ${MIN_YEAR_EUROS} €: ${JSON.stringify(alle)}`;
});

t("Abgestellte Produkte verschwinden vollständig", () => {
  const kaeufe = serie({ productId: "kaffee", raw: "JACOBS KROENUNG", price: 6.99, count: 8, everyDays: 14 });
  const mit = brandSwapCandidates(kaeufe);
  const ohne = brandSwapCandidates(kaeufe, { dismissed: ["kaffee"] });
  if (!mit.erkannt) return "ohne Abstellen schon nichts erkannt";
  return ohne.erkannt === 0 && ohne.proJahrGeschaetzt === 0
    ? true
    : `bleibt sichtbar: ${JSON.stringify(ohne)}`;
});

t("Positionen ohne Bonzeile zählen weder dafür noch dagegen", () => {
  // Im Ladenmodus abgehakt: kein Text, keine Marke, keine Aussage.
  const kaeufe = [
    ...serie({ productId: "kaffee", raw: "JACOBS KROENUNG", price: 6.99, count: 6, everyDays: 14 }),
    ...serie({ productId: "kaffee", raw: null, price: 6.99, count: 4, everyDays: 14, endOffset: 7 })
  ];
  const r = brandSwapCandidates(kaeufe);
  const c = r.geschaetzt[0];
  if (!c) return "gar kein Vorschlag";
  // Markenanteil zählt nur über erkannte Zeilen: 6 von 6.
  return c.markenKaeufe === 6 && c.eigenKaeufe === 0 ? true : JSON.stringify(c);
});

t("Die Hochrechnung ist gedeckelt", () => {
  const kaeufe = serie({ productId: "milch_vollmilch", raw: "WEIHENSTEPHAN MILCH", price: 1.49, count: 20, everyDays: 1 });
  const c = candidateFor("milch_vollmilch", kaeufe);
  return c && c.proJahr <= MAX_PER_YEAR ? true : `proJahr=${c && c.proJahr}`;
});

t("Der Schätzwert ist konservativ und ausgewiesen", () => {
  const c = candidateFor("kaffee", serie({
    productId: "kaffee", raw: "JACOBS KROENUNG", price: 8.00, count: 6, everyDays: 14
  }));
  if (!c) return "kein Vorschlag";
  if (c.belegt) return "als belegt ausgewiesen, obwohl geschätzt";
  return Math.abs(c.eigenPreis - 8 * (1 - ESTIMATED_SHARE)) < 0.01 ? true : `eigenPreis=${c.eigenPreis}`;
});

// ================================================================
section("D: Robustheit");

t("Leere Eingaben stürzen nicht ab", () => {
  for (const x of [[], null, undefined, {}, "keine Liste"]) {
    const r = brandSwapCandidates(x);
    if (!r || !Array.isArray(r.belegt)) return `kaputt bei ${JSON.stringify(x)}`;
  }
  return true;
});

t("Kaputte Käufe werden übersprungen, nicht mitgerechnet", () => {
  const r = brandSwapCandidates([
    { productId: null, date: "2026-01-01", raw: "MUELLER", unitPrice: 1 },
    { productId: "kaffee", date: null, raw: "JACOBS", unitPrice: 1 },
    { productId: "kaffee", date: "2026-01-01", raw: "JACOBS", unitPrice: -5 },
    { productId: "kaffee", date: "kaputt", raw: "JACOBS", unitPrice: NaN },
    ...serie({ productId: "kaffee", raw: "JACOBS KROENUNG", price: 6.99, count: 6, everyDays: 14 })
  ]);
  const c = r.geschaetzt[0];
  return c && Number.isFinite(c.jahresPotenzial) && c.jahresPotenzial > 0
    ? true
    : `unbrauchbares Ergebnis: ${JSON.stringify(c)}`;
});

t("Alle ausgegebenen Zahlen sind endlich", () => {
  const r = brandSwapCandidates([
    ...serie({ productId: "kaffee", raw: "JACOBS KROENUNG", price: 6.99, count: 6, everyDays: 14 }),
    ...serie({ productId: "joghurt_natur", raw: "EHRMANN JOGHURT", price: 1.29, count: 8, everyDays: 7 }),
    ...serie({ productId: "joghurt_natur", raw: "MILBONA JOGHURT", price: 0.59, count: 3, everyDays: 14, endOffset: 3 })
  ]);
  for (const c of [...r.belegt, ...r.geschaetzt]) {
    for (const [k, v] of Object.entries(c)) {
      if (typeof v === "number" && !Number.isFinite(v)) return `${c.productId}.${k} = ${v}`;
    }
  }
  return [r.proJahrBelegt, r.proJahrGeschaetzt].every(Number.isFinite) ? true : "Summe nicht endlich";
});

t("Ohne erkannte Marke gibt es keine Überschrift mit Zahl", () => {
  const r = brandSwapCandidates(serie({
    productId: "bananen", raw: "BANANEN", price: 1.29, count: 8, everyDays: 7
  }));
  const h = swapHeadline(r);
  return h && !/€/.test(h.text) ? true : `Überschrift: ${JSON.stringify(h)}`;
});

t("Belegtes steht in der Überschrift vor Geschätztem", () => {
  const r = brandSwapCandidates([
    ...serie({ productId: "joghurt_natur", raw: "EHRMANN JOGHURT", price: 1.29, count: 8, everyDays: 7 }),
    ...serie({ productId: "joghurt_natur", raw: "MILBONA JOGHURT", price: 0.59, count: 3, everyDays: 14, endOffset: 3 }),
    ...serie({ productId: "kaffee", raw: "JACOBS KROENUNG", price: 9.99, count: 8, everyDays: 10 })
  ]);
  const h = swapHeadline(r);
  return h && /Belegt/.test(h.hint) ? true : `Überschrift: ${JSON.stringify(h)}`;
});

t("Ein leerer Haushalt bekommt gar keine Überschrift", () => {
  return swapHeadline(brandSwapCandidates([])) !== null ? "Überschrift ohne Daten" : true;
});

t("1000 zufällige Kaufreihen bleiben harmlos", () => {
  let seed = 4711;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const zeilen = ["EHRMANN JOGHURT", "MILBONA JOGHURT", "BANANEN", "", null, "JA! MILCH", "MUELLER"];
  for (let i = 0; i < 1000; i++) {
    const rows = [];
    const n = Math.floor(rnd() * 12);
    for (let j = 0; j < n; j++) {
      rows.push({
        productId: rnd() < 0.5 ? "kaffee" : "joghurt_natur",
        raw: zeilen[Math.floor(rnd() * zeilen.length)],
        date: `2026-0${1 + Math.floor(rnd() * 8)}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
        quantity: 1,
        unitPrice: Math.round(rnd() * 900) / 100,
        weightG: rnd() < 0.4 ? Math.round(rnd() * 900) : null
      });
    }
    const r = brandSwapCandidates(rows);
    for (const c of [...r.belegt, ...r.geschaetzt]) {
      if (!(c.jahresPotenzial >= MIN_YEAR_EUROS)) return `Vorschlag unter Schwelle in Runde ${i}`;
      if (c.eigenPreis >= c.markenPreis) return `Eigenmarke nicht günstiger in Runde ${i}`;
    }
  }
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`MARKEN: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
