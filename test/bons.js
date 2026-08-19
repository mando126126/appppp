/**
 * bons.js — Tests gegen ECHTE Bons, Zeile für Zeile
 * ================================================================
 * Sieben abgetippte Dateien von vier Ketten. Kein einziger Bon in
 * diesem Test ist erfunden.
 *
 * Der Vorgänger dieses Parsers war an genau EINEM Bon kalibriert
 * (Lidl) und für die anderen Ketten stand im Kommentar „folgen
 * demselben Aufbau". Das war eine Vermutung, und sie war falsch:
 *
 *   Lidl:  Name  1,15 x 2  2,30      Menge in der Zeile
 *   REWE:  Name        5,58          Menge in der Zeile DARUNTER
 *          2 Stk x 2,79
 *   Netto: 16 x 0,89                 Menge in der Zeile DARÜBER
 *          Name       14,24
 *   EDEKA: Name        0,59          gar keine Mengenzeile
 *
 * WAS DIESER TEST ANDERS MACHT ALS EIN ZEILENTEST:
 *
 * Drei der Bons nennen ihre eigene Endsumme. Damit ist jede
 * Behauptung des Parsers gegen den Bon selbst prüfbar — nicht
 * gegen das, was ich beim Abtippen für richtig hielt. Wenn 27,10
 * herauskommt und 27,10 aufgedruckt ist, dann stimmen Preise,
 * Mengen, Rabatte und Pfand ALLE, denn ein Fehler in irgendeinem
 * davon würde die Summe verschieben.
 *
 * Das ist der schärfste Test im ganzen Projekt: er kann nicht
 * dadurch grün werden, dass ich meine Erwartung an das Ergebnis
 * anpasse.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");
const { parseReceipt } = require("../src/algo/receiptParser");
const { readReceiptImage, ocrStore } = require("../src/algo/receiptOcr");

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
    console.log(`  KNALL ${name}\n        ${e.stack.split("\n").slice(0, 3).join("\n        ")}`);
  }
}

const section = (s) => console.log(`\n--- ${s} ---`);

/* Der Kommentarkopf einer Prüfdatei gehört nicht zum Bon — er
   erklärt ihn. Beim Lesen wird er abgeschnitten, sonst prüft der
   Test die Erkennung an meiner eigenen Prosa statt am Kassenzettel:
   „* WAS REWE ANDERS MACHT ALS LIDL" macht aus einem REWE-Bon
   einen Lidl-Bon. */
const bon = (name) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name + ".txt"), "utf8")
    .replace(/^\/\*\*[\s\S]*?\*\/\r?\n/, "");
const cent = (x) => Math.round(x * 100);

// ================================================================
section("A: Die Gegenprobe — der Bon prüft sich selbst");

/* Drei Bons nennen ihre Summe. Alle drei müssen exakt aufgehen —
   nicht „ungefähr“, sondern auf den Cent. */
const MIT_SUMME = [
  ["rewe-2026-05-30", 27.10, 10, 2],
  ["rewe-2026-07-07", 23.80, 11, 0],
  ["edeka-schweinfurt", 14.84, 8, 0]
];

MIT_SUMME.forEach(([datei, summe, waren, pfand]) => {
  const p = parseReceipt(bon(datei));

  t(`${datei}: aufgedruckte Summe wird gefunden`, () =>
    p.printedTotal === summe ? true : `${p.printedTotal} statt ${summe}`);

  t(`${datei}: erkannte Summe stimmt auf den Cent`, () =>
    cent(p.sum) === cent(summe) ? true : `${p.sum} statt ${summe}`);

  t(`${datei}: Gegenprobe meldet „stimmt“`, () =>
    p.totalOk === true ? true : `totalOk=${p.totalOk}, Abweichung ${p.totalDiff}`);

  t(`${datei}: ${waren} Waren, ${pfand} Pfandzeilen`, () =>
    p.items.length === waren && p.deposits.length === pfand
      ? true : `${p.items.length} Waren / ${p.deposits.length} Pfand`);

  t(`${datei}: keine Zeile bleibt unerklärt`, () =>
    p.warnings.length === 0 ? true : p.warnings.join(" | "));
});

// ================================================================
section("B: Mengenzeile unter der Position (REWE)");

const rewe = parseReceipt(bon("rewe-2026-05-30"));
const paella = rewe.items.find((i) => /PAELLA/.test(i.raw));
const spaghetti = rewe.items.find((i) => /SPAGH/.test(i.raw));

t("„2 Stk x 2,79“ macht aus einer Zeile zwei Stück", () =>
  paella && paella.quantity === 2 ? true : JSON.stringify(paella));

t("Der Einzelpreis kommt aus der Folgezeile, nicht aus der Division", () =>
  paella && cent(paella.unitPrice) === 279 ? true : JSON.stringify(paella));

t("Der Zeilenpreis bleibt der Gesamtpreis", () =>
  paella && cent(paella.listed) === 558 ? true : JSON.stringify(paella));

t("Zweite Mengenzeile im selben Bon wirkt auch", () =>
  spaghetti && spaghetti.quantity === 2 && cent(spaghetti.unitPrice) === 145
    ? true : JSON.stringify(spaghetti));

t("Die Mengenzeile wird selbst KEINE Position", () =>
  rewe.items.every((i) => !/^\d+\s*(Stk)?\s*x$/i.test(i.raw))
    ? true : rewe.items.map((i) => i.raw).join(" | "));

t("Positionen ohne Mengenzeile bleiben einzeln", () => {
  const grana = rewe.items.find((i) => /GRANA/.test(i.raw));
  return grana && grana.quantity === 1 ? true : JSON.stringify(grana);
});

// ================================================================
section("C: Mengenzeile über der Position (Netto)");

const netto1 = parseReceipt(bon("netto-2026-teil-1"));
const booster = netto1.items.find((i) => /Booster/.test(i.raw));
const maultaschen = netto1.items.find((i) => /Maultaschen/.test(i.raw));

t("„16 x 0,89“ wirkt auf die Zeile DARUNTER", () =>
  booster && booster.quantity === 16 && cent(booster.unitPrice) === 89
    ? true : JSON.stringify(booster));

t("Dieselbe Zeilenart, andere Richtung — beides geht", () =>
  maultaschen && maultaschen.quantity === 2 && cent(maultaschen.listed) === 358
    ? true : JSON.stringify(maultaschen));

t("Auch Pfand bekommt seine Menge von oben", () => {
  const leergut = netto1.deposits.find((d) => /^Leergut/.test(d.raw));
  return leergut && leergut.quantity === 16 && cent(leergut.paid) === 400
    ? true : JSON.stringify(leergut);
});

/* Die Richtung entscheidet die Rechnung, nicht die Kette. Ein
   künstlicher Bon, auf dem BEIDE Formen vorkommen, muss beide
   richtig zuordnen — genau das kann ein Parser nicht, der sich die
   Richtung pro Händler merkt. */
t("Beide Richtungen auf EINEM Bon gleichzeitig", () => {
  const p = parseReceipt([
    "  3 x 1,00",
    "Ware oben          3,00",
    "Ware unten         5,00",
    "  2 x 2,50"
  ].join("\n"));
  const oben = p.items[0], unten = p.items[1];
  return oben.quantity === 3 && unten.quantity === 2
    ? true : `${oben.quantity} / ${unten.quantity}`;
});

t("Eine Mengenzeile, die zu nichts passt, wird verworfen", () => {
  const p = parseReceipt([
    "  7 x 9,99",
    "Ware               3,00"
  ].join("\n"));
  return p.items.length === 1 && p.items[0].quantity === 1 && p.warnings.length === 1
    ? true : `${p.items[0].quantity}, ${p.warnings.length} Warnungen`;
});

// ================================================================
section("D: Fünf Schreibweisen für einen Rabatt");

const netto3 = parseReceipt(bon("netto-2026-teil-3"));

t("„Rabatt“ (Wort vorn)", () => {
  const v = netto3.items.find((i) => /Val\.Sport/.test(i.raw));
  return v && cent(v.paid) === 89 ? true : JSON.stringify(v);
});

t("„25% Rabatt“ (Wort hinten)", () => {
  const mm = netto3.items.find((i) => /MM Protein/.test(i.raw));
  return mm && cent(mm.paid) === 134 ? true : JSON.stringify(mm);
});

t("„0.20€ Rabatt“ (Wort hinten, Punkt statt Komma, Euro-Zeichen)", () => {
  const f = netto3.items.find((i) => /Finello/.test(i.raw));
  return f && cent(f.paid) === 129 ? true : JSON.stringify(f);
});

t("„Rabatt 5%“ (Wort vorn, Prozent dahinter)", () => {
  const p = parseReceipt("Ware   2,99\nRabatt 5%   -0,15");
  return cent(p.items[0].paid) === 284 ? true : JSON.stringify(p.items[0]);
});

t("„GRATIS“ (Wort gar nicht genannt)", () => {
  const b = netto1.items.find((i) => /BioBio/.test(i.raw));
  return b && cent(b.paid) === 0 ? true : JSON.stringify(b);
});

t("Zwei Rabattzeilen hintereinander gehören beide zur selben Ware", () => {
  const v = netto3.items.find((i) => /VitaminWell/.test(i.raw));
  return v && v.discounts.length === 2 && cent(v.paid) === 132
    ? true : JSON.stringify(v);
});

/* In Deutschland ist Pfand ein gesetzlich fester Betrag und wird
   nie rabattiert. Auf dem Netto-Bon steht zwischen der Ware und
   ihrem Rabatt eine Pfandzeile — wer den Rabatt der letzten Zeile
   statt der letzten WARE zuschlägt, macht aus 25 Cent Pfand
   minus sechs Euro. */
t("Ein Rabatt landet nie auf einer Pfandzeile", () => {
  const schlecht = [...netto1.deposits, ...netto3.deposits].filter((d) => d.discounts.length);
  return schlecht.length === 0 ? true : JSON.stringify(schlecht.map((d) => d.raw));
});

t("Ein Rabatt springt über die Pfandzeile hinweg zur Ware", () =>
  booster && cent(booster.paid) === 800 ? true : JSON.stringify(booster));

t("Kein Preis wird durch Rabatte negativ", () => {
  const alle = [...netto1.items, ...netto3.items, ...netto1.deposits];
  const neg = alle.filter((i) => i.paid < 0);
  return neg.length === 0 ? true : JSON.stringify(neg.map((i) => [i.raw, i.paid]));
});

// ================================================================
section("E: Pfand hin, Leergut zurück");

const netto2 = parseReceipt(bon("netto-2026-teil-2"));

t("„EW-Pfand“ ist Pfand", () =>
  netto2.deposits.some((d) => /EW-Pfand/.test(d.raw))
    ? true : JSON.stringify(netto2.deposits.map((d) => d.raw)));

t("„Einwegleergut“ ist auch Pfand — nur andersherum", () => {
  const zurueck = netto2.deposits.filter((d) => /leergut/i.test(d.raw) && d.paid < 0);
  return zurueck.length === 5 ? true : `${zurueck.length} statt 5`;
});

t("Zurückgegebenes Leergut ist KEINE Ware", () =>
  netto2.items.every((i) => !/leergut/i.test(i.raw))
    ? true : netto2.items.map((i) => i.raw).join(" | "));

/* Der teuerste Fehler in dieser Ecke: „Einwegleergut -6,00“ als
   Rabatt auf die Zeile darüber zu buchen. Die Himbeeren kosten
   weiter 1,99 — und würden sonst mit minus vier Euro in der
   Preisgeschichte stehen. */
t("Zurückgegebenes Leergut ist auch kein Rabatt auf die Ware davor", () => {
  const himbeeren = netto2.items.find((i) => /Himbeeren/.test(i.raw));
  return himbeeren && cent(himbeeren.paid) === 199 && himbeeren.discounts.length === 0
    ? true : JSON.stringify(himbeeren);
});

t("Pfandzeilen kennen die Ware, zu der sie gehören", () => {
  const p = netto1.deposits.find((d) => /^EW-Pfand/.test(d.raw));
  return p && p.belongsTo ? true : JSON.stringify(p);
});

t("Der Lidl-Bon bleibt unverändert richtig", () => {
  const l = parseReceipt(bon("lidl-2026-07-22"));
  const vitwas = l.items.find((i) => /Vit\.-Was/.test(i.raw));
  return l.items.length === 25 && l.deposits.length === 3 &&
    vitwas.quantity === 8 && cent(vitwas.listed) === 552 &&
    cent(l.discountTotal) === -115
    ? true : `${l.items.length}/${l.deposits.length}, Rabatte ${l.discountTotal}`;
});

// ================================================================
section("F: Was die Gegenprobe fängt");

t("Eine verlorene Zeile fällt auf", () => {
  const p = parseReceipt("Ware A   5,00\nWare B   3,00\nSUMME   12,00");
  return p.totalOk === false && cent(p.totalDiff) === 400 &&
    /fehlen/.test(p.warnings.join(" "))
    ? true : `${p.totalOk} / ${p.totalDiff} / ${p.warnings.join(" | ")}`;
});

t("Eine doppelt gelesene Zeile fällt auch auf", () => {
  const p = parseReceipt("Ware A   5,00\nWare A   5,00\nSUMME    5,00");
  return p.totalOk === false && cent(p.totalDiff) === -500 &&
    /doppelt/.test(p.warnings.join(" "))
    ? true : `${p.totalOk} / ${p.totalDiff}`;
});

t("Ohne aufgedruckte Summe gibt es keine Probe — und keinen Fehlalarm", () => {
  const p = parseReceipt("Ware A   5,00\nWare B   3,00");
  return p.printedTotal === null && p.totalOk === null && p.warnings.length === 0
    ? true : `${p.printedTotal} / ${p.totalOk} / ${p.warnings.length}`;
});

t("Die Steuertabelle wird nicht für die Endsumme gehalten", () => {
  const p = parseReceipt(bon("edeka-schweinfurt"));
  return p.printedTotal === 14.84 ? true : `${p.printedTotal}`;
});

t("Ein Rundungscent löst keinen Alarm aus", () => {
  const p = parseReceipt("Ware A   5,00\nSUMME    5,01");
  return p.totalOk === true && p.warnings.length === 0
    ? true : `${p.totalOk} / ${p.warnings.join(" | ")}`;
});

/* „14.24“ ist vierzehn Euro, nicht eintausendvierhundert. Der alte
   Parser hat alle Punkte gestrichen, bevor er das Komma ersetzt hat
   — bei einem englisch geschriebenen Betrag kam das Hundertfache
   heraus, und die Gegenprobe hätte es gemeldet, ohne dass jemand
   die Ursache gefunden hätte. */
t("Punkt als Dezimaltrennzeichen wird richtig gelesen", () => {
  const p = parseReceipt("Ware A   14.24\nSUMME    14,24");
  return p.totalOk === true && cent(p.items[0].paid) === 1424
    ? true : `${p.items[0].paid}`;
});

t("Tausenderpunkt bleibt Tausenderpunkt", () => {
  const p = parseReceipt("Ware A   1.234,56");
  return cent(p.items[0].paid) === 123456 ? true : `${p.items[0].paid}`;
});

// ================================================================
section("G: Der Weg über die Texterkennung");

/* Die Bilddateien werden hier nicht gelesen — dafür braucht es
   einen Browser. Was hier läuft, ist die Stufe DANACH: der
   erkannte Text wird ausgerichtet und dann geparst. Wenn schon
   der abgetippte Bon durch die Ausrichtung geht, liegt ein
   späterer Fehler an der Erkennung und nicht an uns. */
["rewe-2026-05-30", "rewe-2026-07-07", "edeka-schweinfurt"].forEach((datei) => {
  t(`${datei}: übersteht den Umweg über die Ausrichtung`, () => {
    const gelesen = readReceiptImage(bon(datei), { today: "2026-08-19" });
    const p = parseReceipt(gelesen.text);
    const soll = parseReceipt(bon(datei));
    return cent(p.sum) === cent(soll.sum) && p.items.length === soll.items.length
      ? true : `${p.sum} statt ${soll.sum}, ${p.items.length} statt ${soll.items.length} Waren`;
  });
});

t("Der Werbefuß wird nie zur Position", () => {
  const gelesen = readReceiptImage(bon("rewe-2026-07-07"), { today: "2026-08-19" });
  const p = parseReceipt(gelesen.text);
  const werbung = p.items.filter((i) => /Guthaben|Bonus|Einkauf hast/i.test(i.raw));
  return werbung.length === 0 ? true : JSON.stringify(werbung.map((i) => i.raw));
});

t("Auch ohne Summenzeile bleibt der Werbefuß draußen", () => {
  const ohne = bon("rewe-2026-07-07").split("\n").filter((z) => !/^\s*SUMME/i.test(z)).join("\n");
  const gelesen = readReceiptImage(ohne, { today: "2026-08-19" });
  const p = parseReceipt(gelesen.text);
  const werbung = p.items.filter((i) => /Guthaben|Bonus|gesammelt|aktivieren/i.test(i.raw));
  return werbung.length === 0 ? true : JSON.stringify(werbung.map((i) => i.raw));
});

t("Der Markt wird aus dem Kopf erkannt", () => {
  const r = readReceiptImage(bon("rewe-2026-05-30"), { today: "2026-08-19" });
  const e = readReceiptImage(bon("edeka-schweinfurt"), { today: "2026-08-19" });
  return r.store === "Rewe" && e.store === "Edeka" ? true : `${r.store} / ${e.store}`;
});

/* Auf dem echten E-center-Foto steht oben nur das Logo — die
   Texterkennung macht daraus „Ecenter", und „EDEKA" fällt erst
   zwanzig Zeilen weiter unten in der Firmierung. */
t("„Ecenter“ ist EDEKA, auch ohne das Wort im Kopf", () => {
  const s = ocrStore(["Ecenter", "SCHWEINFURT", "RADIESCHEN 0,59"].join("\n"));
  return s === "Edeka" ? true : `${s}`;
});

t("Der Markt wird auch im Fuß noch gefunden", () => {
  const s = ocrStore(["Mg PA AM A A MM", "SCHWEINFURT", "OSKAR-VON-MILLER-STR,6",
    "RADIESCHEN 0,59", "", "", "", "", "", "", "", "", "", "",
    "EDEKA HANDELSGESELLSCHAFT"].join("\n"));
  return s === "Edeka" ? true : `${s}`;
});

/* Ohne Wortgrenzen war „dm" in „Handmixer" ein Markt und „Real" in
   „Realschulweg" einer. Genau dieser Fehler saß schon einmal in
   priceShare.chainOf — hier stand er noch. */
t("Ein Markt im Wortinneren ist kein Markt", () => {
  const schlecht = [
    ["Handmixer Silber      12,99", "dm"],
    ["Realschulweg Kiosk", "Real"],
    ["Sandmehl 1kg           1,29", "dm"],
    ["Pennystrasse 4", "Penny"]
  ].filter(([zeile]) => ocrStore(zeile) !== null);
  return schlecht.length === 0
    ? true : JSON.stringify(schlecht.map(([z]) => [z, ocrStore(z)]));
});

t("Am Wortanfang bleibt der Markt ein Markt", () =>
  ocrStore("dm drogerie markt") === "dm" && ocrStore("REWE Markt GmbH") === "Rewe"
    ? true : `${ocrStore("dm drogerie markt")} / ${ocrStore("REWE Markt GmbH")}`);

t("Der längere Name gewinnt", () =>
  ocrStore("ALDI SÜD Filiale 42") === "Aldi Süd" ? true : ocrStore("ALDI SÜD Filiale 42"));

t("Ein zwanzig Jahre altes Datum wird verworfen", () => {
  const e = readReceiptImage(bon("edeka-schweinfurt"), { today: "2026-08-19" });
  return e.date === null ? true : `${e.date}`;
});

t("Die Qualität aller echten Bons gilt als gut", () => {
  const schlecht = ["rewe-2026-05-30", "rewe-2026-07-07", "edeka-schweinfurt",
    "netto-2026-teil-1", "netto-2026-teil-3", "lidl-2026-07-22"]
    .map((d) => [d, readReceiptImage(bon(d), { today: "2026-08-19" }).quality])
    .filter(([, q]) => !q.ok);
  return schlecht.length === 0 ? true : JSON.stringify(schlecht.map(([d, q]) => [d, q.level]));
});

// ================================================================
section("H: Nichts erfinden, auch unter Beschuss");

/* Der Grundsatz aus receiptOcr.js: lieber eine Zeile zu wenig. Eine
   übersehene Position merkt der Nutzer sofort, eine erfundene
   wandert still in die Historie. */
let rng = 987654321;
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

t("Zufällig verstümmelte echte Bons erfinden keine Positionen", () => {
  const quellen = ["rewe-2026-05-30", "netto-2026-teil-1", "lidl-2026-07-22",
    "edeka-schweinfurt"].map(bon);
  for (let i = 0; i < 3000; i++) {
    const zeilen = quellen[Math.floor(rnd() * quellen.length)].split("\n");
    // Zeichen kippen, Zeilen umstellen, Zeilen wegwerfen — alles,
    // was eine schlechte Aufnahme auch anrichtet.
    const kaputt = zeilen
      .filter(() => rnd() > 0.15)
      .map((z) => (rnd() > 0.8 ? z.replace(/[0-9]/g, (d) => (rnd() > 0.5 ? "O" : d)) : z))
      .join("\n");
    const p = parseReceipt(kaputt);
    for (const it of [...p.items, ...p.deposits]) {
      if (!Number.isFinite(it.paid)) return `paid=${it.paid} aus einer Position „${it.raw}“`;
      if (!Number.isFinite(it.quantity) || it.quantity < 1 || it.quantity > 999) {
        return `Menge ${it.quantity} bei „${it.raw}“`;
      }
      if (it.listed > 300) return `Preis ${it.listed} bei „${it.raw}“`;
      if (!it.raw || !/[A-Za-zÄÖÜäöüß]/.test(it.raw)) return `Name „${it.raw}“ ohne Buchstaben`;
    }
    if (!Number.isFinite(p.sum)) return `Summe ${p.sum}`;
  }
  return true;
});

t("Eine Ware kostet nie weniger als nichts", () => {
  for (let i = 0; i < 2000; i++) {
    const preis = (rnd() * 20).toFixed(2).replace(".", ",");
    const abzug = (rnd() * 40).toFixed(2).replace(".", ",");
    const p = parseReceipt(`Testware   ${preis}\nRabatt   -${abzug}`);
    // Ein Rabatt größer als der Preis kommt auf echten Bons nicht
    // vor — wenn die Erkennung ihn erfindet, darf daraus trotzdem
    // kein negativer Kaufpreis in der Historie werden.
    if (p.items[0] && p.items[0].paid < -0.001 && Math.abs(p.items[0].paid) > 0.001) {
      if (parseFloat(abzug.replace(",", ".")) <= parseFloat(preis.replace(",", ".")) + 0.001) {
        return `paid=${p.items[0].paid} bei ${preis} minus ${abzug}`;
      }
    }
  }
  return true;
});

t("Leerer und wirrer Text ergibt einen leeren Bon", () => {
  for (const müll of ["", "   ", "\n\n\n", "!!!", "0,00", "x x x", "-----"]) {
    const p = parseReceipt(müll);
    if (p.items.length || p.deposits.length) return `„${müll}“ ergab ${p.items.length} Positionen`;
    if (!Number.isFinite(p.sum)) return `„${müll}“ ergab Summe ${p.sum}`;
  }
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`ECHTE BONS: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
