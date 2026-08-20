/**
 * ocr.js — Tests für den Weg vom erkannten Text zum Bon
 * ================================================================
 * Getestet wird NICHT die Texterkennung. Die ist ein fremdes
 * Programm, läuft im Browser und hat ihre eigenen Tests; was sie aus
 * einem bestimmten Foto macht, hängt an Licht, Winkel und Papier und
 * ist in einem Unit-Test nicht nachstellbar.
 *
 * Getestet wird, was DANACH kommt — und dort sitzen die Fehler, die
 * still Schaden anrichten:
 *
 *   A) Ziffern zurückdrehen, ohne Namen zu zerstören
 *   B) Zeilen ausrichten, damit der echte Bon-Parser sie liest
 *   C) Rauschen aussortieren: Adresse, Summe, Kartenbeleg
 *   D) Zusammenspiel mit receiptParser — die eine Bon-Grammatik
 *   E) Robustheit: alles, was kein Bon ist
 *
 * Die Eingaben sind absichtlich hässlich. Ein sauberer Text wäre
 * kein Test — die Texterkennung liefert nie einen sauberen Text.
 * ================================================================
 */

const {
  readReceiptImage, ocrToReceiptText, alignLine, cleanLine, repairDigits,
  isNoise, ocrDate, ocrStore, ocrQuality, MAX_ITEM_EUROS
} = require("../src/algo/receiptOcr");
const { parseReceipt } = require("../src/algo/receiptParser");
const { matchProduct } = require("../src/algo/productMatcher2");

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

/* Ein Lidl-Bon, wie ihn eine Texterkennung von einem Foto liefert:
   Spalten zu einfachen Leerzeichen zerfallen, Nullen als O, Einsen
   als l, ein verrutschter Kopf und der Kartenbeleg am Ende. */
const FOTO_BON = `LIDL
Musterstrasse 12
12345 Musterstadt
Tel. 0800/1234567

12.08.2026 17:42 Kasse 3

Vollmilch 3,5% l,29 A
Naturjoghurt O,59 A
Preisvorteil -O,O8
Bananen lose 1,89 A
Hackfleisch gem. 4,58 A
0,432 kg x 10,60 EUR/kg
High Protein Kaffee 1,15 x 2 2,30 A
Spuelmittel Ultra 1,39 B
Pfand 0,25 0,50 B

SUMME EUR 12,46
Geg. Kartenzahlung 12,46
MwSt A 7% 0,72
MwSt B 19% 0,30

Vielen Dank fuer Ihren Einkauf
UST-ID DE 123 456 789`;

/* Ein digitaler Bon aus einer Händler-App: sauberer erkannt, aber
   ganz anderer Aufbau — kein Spaltenraster, dafür Zeilenumbrüche
   zwischen Name und Preis. */
const APP_BON = `REWE
Mein Einkauf
05.08.2026

Bio Vollmilch 1L 1,49
Naturjoghurt 500g 0,89
Roggenbrot 2,29
Gouda jung 250g 2,19
Zwiebeln 1kg 1,79

Zwischensumme 8,65
Summe 8,65
Bezahlt mit PAYBACK Pay`;

// ================================================================
section("A: Ziffern zurückdrehen, Namen unangetastet");

const ZIFFERN = [
  ["l,29", "1,29"],
  ["O,59", "0,59"],
  ["-O,O8", "-0,08"],
  ["2,S0", "2,50"],
  ["l2,46", "12,46"],
  // Und was NICHT angefasst werden darf:
  ["Bio Milch 1,29", "Bio Milch 1,29"],
  ["Soja Drink 2,49", "Soja Drink 2,49"],
  ["Müsli Mix 3,49", "Müsli Mix 3,49"],
  ["Gouda jung", "Gouda jung"],
  ["Bratwurst", "Bratwurst"],
  ["SOO g Mehl", "SOO g Mehl"],
  ["12.08.2026", "12.08.2026"]
];

ZIFFERN.forEach(([ein, aus]) => {
  t(`„${ein}“ wird zu „${aus}“`, () => {
    const r = repairDigits(ein);
    return r === aus ? true : `stattdessen „${r}“`;
  });
});

t("Kein Produktname verliert Buchstaben", () => {
  // Der teuerste Fehler dieses Moduls wäre, im Namen zu korrigieren:
  // der Produktabgleich lebt davon, dass der Name lesbar bleibt.
  const namen = ["Joghurt", "Bohnen", "Gouda", "Tomaten", "Zitrone", "Butter",
    "Basilikum", "Schokolade", "Olivenöl", "Salami", "Toastbrot", "Gorgonzola"];
  const kaputt = namen.filter((n) => repairDigits(n) !== n);
  return kaputt.length === 0 ? true : `verändert: ${kaputt.join(", ")}`;
});

t("Ein Betragswort ohne echte Ziffer bleibt in Ruhe", () => {
  // „Sl,SO" könnte 51,50 heißen — oder eine Abkürzung sein. Raten
  // hilft hier niemandem.
  return repairDigits("Sl,SO") === "Sl,SO" ? true : repairDigits("Sl,SO");
});

// ================================================================
section("B: Zeilen ausrichten");

t("Aus einem Leerzeichen werden zwei", () => {
  // Genau daran erkennt receiptParser eine Position. Die Texterkennung
  // macht aus der Spalte mal ein Leerzeichen, mal sieben.
  const a = alignLine("Vollmilch 3,5% 1,29 A");
  return /Vollmilch 3,5% {2,}1,29/.test(a) ? true : JSON.stringify(a);
});

t("Das Steuerkennzeichen fliegt raus", () => {
  const a = alignLine("Spuelmittel 1,39 B");
  return a && !/\bB\b/.test(a) ? true : JSON.stringify(a);
});

t("Menge inline bleibt erhalten", () => {
  const a = alignLine("High Protein Kaffee 1,15 x 2 2,30 A");
  const p = parseReceipt(a);
  return p.items[0] && p.items[0].quantity === 2 && p.items[0].unitPrice === 1.15
    ? true : JSON.stringify(p.items[0]);
});

t("Die Gewichtszeile behält ihre Einrückung", () => {
  const a = alignLine("0,432 kg x 10,60 EUR/kg");
  return a && /^\s{2,}/.test(a) && /EUR\/kg/.test(a) ? true : JSON.stringify(a);
});

t("Die Rabattzeile auch", () => {
  const a = alignLine("Preisvorteil -O,O8");
  return a && /^\s{2,}Preisvorteil\s+-0,08/.test(a) ? true : JSON.stringify(a);
});

t("Ein Betrag mitten in der Zeile ist nicht der Preis", () => {
  // „2,50 EUR/kg Aufschlag 1,20" — gezählt wird der letzte Betrag.
  const a = alignLine("Rinderhack 2,50 x 2 5,00");
  const p = parseReceipt(a);
  return p.items[0] && p.items[0].unitPrice === 2.5 ? true : JSON.stringify(p.items[0]);
});

// ================================================================
section("C: Rauschen aussortieren");

const RAUSCHEN = [
  "Geg. Kartenzahlung 12,46",
  "MwSt A 7% 0,72",
  "UST-ID DE 123 456 789",
  "12.08.2026 17:42 Kasse 3",
  "Tel. 0800/1234567",
  "Vielen Dank fuer Ihren Einkauf",
  "www.lidl.de",
  "Zwischensumme 8,65",
  "1234 5678 9012 3456"
];

RAUSCHEN.forEach((z) => {
  t(`„${z}“ wird nicht zur Position`, () => {
    const a = alignLine(z);
    return a === null ? true : `wurde zu „${a}“`;
  });
});

t("Eine Zeile ohne Buchstaben ist keine Position", () => {
  return alignLine("123 456 1,29") === null ? true : alignLine("123 456 1,29");
});

/* Die Summenzeile ist der eine Sonderfall: sie darf NICHT
   verschwinden. Sie ist Rauschen im Sinne von „kein Einkauf", aber
   sie ist der Schlussstrich — und ohne sie liest der Parser den
   ganzen Werbefuß als Waren. Sie muss also durchkommen UND darf
   trotzdem nie eine Position werden. */
t("Die Summenzeile überlebt die Ausrichtung", () => {
  const a = alignLine("SUMME EUR 12,46");
  return /^SUMME\s+12,46$/.test(a || "") ? true : `wurde zu „${a}“`;
});

t("Die Summenzeile wird trotzdem nie eine Position", () => {
  const p = parseReceipt(alignLine("Vollmilch  1,29") + "\n" + alignLine("SUMME EUR 12,46"));
  return p.items.length === 1 && p.items[0].raw === "Vollmilch"
    ? true : JSON.stringify(p.items.map((i) => i.raw));
});

t("Die Summenzeile liefert die Gegenprobe", () => {
  const p = parseReceipt(alignLine("Vollmilch  1,29") + "\n" + alignLine("SUMME EUR 12,46"));
  return p.printedTotal === 12.46 && p.totalOk === false
    ? true : `${p.printedTotal} / ${p.totalOk}`;
});

t("Die Zwischensumme ist NICHT die Endsumme", () => {
  return alignLine("Zwischensumme 8,65") === null ? true : alignLine("Zwischensumme 8,65");
});

t("Die Steuertabelle nennt keine Endsumme", () => {
  const a = alignLine("SUMME MWST      1,73        13,11");
  return a === null ? true : `wurde zu „${a}“`;
});

t("Ein absurder Betrag ist kein Lebensmittel", () => {
  const a = alignLine(`Kartennummer ${MAX_ITEM_EUROS + 50},00`);
  return a === null ? true : `wurde zu „${a}“`;
});

t("Eine Position ohne Betrag fällt weg", () => {
  return alignLine("Bananen lose") === null ? true : alignLine("Bananen lose");
});

t("Pfand bleibt drin", () => {
  // Es ist kein Lebensmittel, aber der Parser braucht die Zeile —
  // sonst fehlt das Pfand in der Pfandrechnung.
  const a = alignLine("Pfand 0,25 0,50 B");
  return a && /^Pfand/.test(a) ? true : JSON.stringify(a);
});

// ================================================================
section("D: Zusammenspiel mit dem echten Bon-Parser");

t("Der Foto-Bon ergibt die richtigen Positionen", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  const namen = p.items.map((i) => i.raw);
  const erwartet = ["Vollmilch", "Naturjoghurt", "Bananen", "Hackfleisch", "Kaffee", "Spuelmittel"];
  const fehlt = erwartet.filter((e) => !namen.some((n) => n.includes(e)));
  return fehlt.length === 0 ? true : `fehlen: ${fehlt.join(", ")} — erkannt: ${namen.join(" | ")}`;
});

t("Und keine erfundenen dazu", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  return p.items.length === 6 ? true : `${p.items.length} Positionen: ${p.items.map((i) => i.raw).join(" | ")}`;
});

t("Die verwechselten Ziffern sind zurückgedreht", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  const milch = p.items.find((i) => /Vollmilch/.test(i.raw));
  const jog = p.items.find((i) => /Naturjoghurt/.test(i.raw));
  if (!milch || milch.unitPrice !== 1.29) return `Milch: ${milch && milch.unitPrice}`;
  if (!jog || jog.listed !== 0.59) return `Joghurt: ${jog && jog.listed}`;
  return true;
});

t("Der Rabatt landet bei der richtigen Position", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  const jog = p.items.find((i) => /Naturjoghurt/.test(i.raw));
  return jog && Math.abs(jog.paid - 0.51) < 0.001 ? true : `bezahlt ${jog && jog.paid}`;
});

t("Das Gewicht aus der Folgezeile kommt an", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  const hack = p.items.find((i) => /Hackfleisch/.test(i.raw));
  return hack && hack.weightG === 432 ? true : `weightG=${hack && hack.weightG}`;
});

t("Das Pfand bleibt eine eigene Position", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  return p.deposits.length === 1 ? true : `${p.deposits.length} Pfandzeilen`;
});

t("Die erkannten Namen finden ihre Produkte", () => {
  const r = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  const ohne = p.items.filter((i) => !matchProduct(i.raw).productId);
  return ohne.length === 0 ? true : `ohne Zuordnung: ${ohne.map((i) => i.raw).join(", ")}`;
});

t("Der App-Bon funktioniert genauso", () => {
  const r = readReceiptImage(APP_BON, { today: "2026-08-12" });
  const p = parseReceipt(r.text);
  return p.items.length === 5 ? true : `${p.items.length}: ${p.items.map((i) => i.raw).join(" | ")}`;
});

t("Datum und Markt kommen aus dem Bild", () => {
  const a = readReceiptImage(FOTO_BON, { today: "2026-08-12" });
  const b = readReceiptImage(APP_BON, { today: "2026-08-12" });
  if (a.date !== "2026-08-12" || a.store !== "Lidl") return `Foto: ${a.date} / ${a.store}`;
  if (b.date !== "2026-08-05" || b.store !== "Rewe") return `App: ${b.date} / ${b.store}`;
  return true;
});

t("Ein Datum aus der Zukunft wird verworfen", () => {
  return ocrDate("Gueltig bis 01.01.2099", "2026-08-12") === null ? true : "angenommen";
});

t("Und eine Steuernummer wird nicht zum Datum", () => {
  return ocrDate("Steuernr 12.34.1998", "2026-08-12") === null ? true : "angenommen";
});

t("Der längere Marktname gewinnt", () => {
  return ocrStore("ALDI SÜD Filiale 3") === "Aldi Süd" ? true : ocrStore("ALDI SÜD Filiale 3");
});

// ================================================================
section("E: Wenn es kein Bon war");

t("Ein Bild ohne Text sagt das", () => {
  const q = ocrQuality(ocrToReceiptText(""));
  return q.ok === false && q.level === "leer" ? true : JSON.stringify(q);
});

t("Ein Bild von etwas anderem sagt das auch", () => {
  const q = readReceiptImage("Herzlichen Glueckwunsch zum Geburtstag\nAlles Gute").quality;
  return q.ok === false ? true : JSON.stringify(q);
});

t("Und der Hinweis ist eine Anleitung, kein Vorwurf", () => {
  const q = readReceiptImage("nur Kauderwelsch ohne alles").quality;
  return /näher|Schatten|gerade/.test(q.message) ? true : q.message;
});

t("Viel Rauschen um wenige Positionen wird gemeldet", () => {
  const viel = Array.from({ length: 40 }, (_, i) => `Zeile ohne Sinn Nummer ${i}`).join("\n");
  const q = readReceiptImage(`${viel}\nMilch 1,29\nBrot 2,49\nEier 3,49`).quality;
  return q.ok && q.level === "unsicher" ? true : JSON.stringify(q);
});

t("Müll stürzt nicht ab", () => {
  for (const m of ["", null, undefined, 0, [], {}, "\n\n\n", " ", "🍌🍌🍌"]) {
    const r = readReceiptImage(m);
    if (typeof r.text !== "string") return `kaputt bei ${JSON.stringify(m)}`;
    if (!r.quality || typeof r.quality.message !== "string") return `kein Urteil bei ${JSON.stringify(m)}`;
  }
  return true;
});

t("Eine sehr lange Zeile bleibt harmlos", () => {
  const r = readReceiptImage("A".repeat(20000) + " 1,29");
  return r.kept === 0 ? true : `${r.kept} Positionen aus einer 20.000-Zeichen-Zeile`;
});

t("2000 zufällige Zeilen erzeugen nichts Unmögliches", () => {
  let seed = 987654321;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const teile = ["Milch", "1,29", "O,59", "SUMME", "12.08.2026", "x 2", "kg", "-0,08",
    "###", "Pfand", "EUR", "", "A", "B", "Joghurt 500g"];
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rnd() * 6);
    let zeile = "";
    for (let j = 0; j < n; j++) zeile += teile[Math.floor(rnd() * teile.length)] + " ";
    const a = alignLine(zeile);
    if (a === null) continue;
    const p = parseReceipt(a);
    for (const it of p.items) {
      if (!Number.isFinite(it.unitPrice) || it.unitPrice <= 0) return `Preis ${it.unitPrice} aus „${zeile}“`;
      if (it.unitPrice > MAX_ITEM_EUROS) return `Preis ${it.unitPrice} aus „${zeile}“`;
      if (!Number.isFinite(it.quantity) || it.quantity < 1) return `Menge ${it.quantity} aus „${zeile}“`;
    }
  }
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`TEXTERKENNUNG: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
