/**
 * kalender.js — der Kalender als Rechnung
 * ================================================================
 * `calendarModel.js` liefert je Tag eine Zeile aus Zahlen. Geprüft
 * wird genau das und nicht die Darstellung: die Oberflächentests in
 * uitest.js sehen das Gitter, dieser Test sieht die Rechnung.
 *
 * Drei Dinge, bei denen ein Kalender schnell lügt, und die deshalb
 * hier einzeln stehen:
 *
 *   1. VERGANGENHEIT UND ZUKUNFT VERMISCHEN. Ein Tag darf nicht
 *      gleichzeitig „hat 12 € gekostet" und „wird 12 € kosten"
 *      behaupten.
 *   2. ZU WEIT VORAUSSAGEN. Der dritte vorhergesagte Kauf hängt an
 *      zwei vorhergesagten davor. Ab `HORIZONT_TAGE` hört die
 *      Rechnung auf, statt blasser weiterzuraten.
 *   3. LEER UND VERDORBEN VERWECHSELN. Das sind zwei verschiedene
 *      Tage, und der Unterschied ist der ganze Zweck dieser App.
 *
 *   node test/kalender.js
 */
const {
  buildCalendar, ausgabenJeTag, faelligJeTag, bestandJeTag,
  monatsSpanne, monatPlus, spalteFuer, HORIZONT_TAGE
} = require("../src/algo/calendarModel");

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

const T0 = "2026-09-03";
const tag = (n, von = T0) =>
  new Date(new Date(von + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

const rhythmus = (o) => ({ rhythmDays: 7, confidence: 0.8, lastPurchaseDate: tag(-2), lastQuantity: 1, perUnitDays: 7, ...o });
const tagFuer = (erg, datum) => erg.tage.find((t) => t.date === datum);

/* ================================================================
   Monatsrechnung
   ================================================================ */
section("Monate");
{
  ok("Ein normaler Monat", JSON.stringify(monatsSpanne("2026-09")) ===
    JSON.stringify({ von: "2026-09-01", bis: "2026-09-30" }));
  ok("Der Februar hat 28 Tage", monatsSpanne("2026-02").bis === "2026-02-28");
  ok("Im Schaltjahr 29", monatsSpanne("2024-02").bis === "2024-02-29");
  ok("Dezember", monatsSpanne("2026-12").bis === "2026-12-31");
  ok("Unsinn wird abgelehnt", monatsSpanne("2026-13") === null && monatsSpanne("quatsch") === null);

  ok("Einen Monat vor", monatPlus("2026-09", 1) === "2026-10");
  ok("Über den Jahreswechsel vor", monatPlus("2026-12", 1) === "2027-01");
  ok("Über den Jahreswechsel zurück", monatPlus("2026-01", -1) === "2025-12");
  ok("Ein ganzes Jahr", monatPlus("2026-05", 12) === "2027-05");
  ok("Zwölf zurück", monatPlus("2026-05", -12) === "2025-05");
}

section("Die Woche beginnt am Montag");
{
  // 2026-09-07 ist ein Montag.
  ok("Montag ist Spalte 0", spalteFuer("2026-09-07") === 0);
  ok("Sonntag ist Spalte 6", spalteFuer("2026-09-13") === 6);
  ok("Samstag ist Spalte 5", spalteFuer("2026-09-12") === 5);
}

/* ================================================================
   Was war
   ================================================================ */
section("Ausgaben aus den Bons");
{
  const kaeufe = [
    { productId: "milch", date: tag(-5), quantity: 2, unitPrice: 1.19 },
    { productId: "brot", date: tag(-5), quantity: 1, unitPrice: 2.39 },
    { productId: "brot", date: tag(-1), quantity: 1, unitPrice: 2.39 },
    { productId: "alt", date: tag(-90), quantity: 1, unitPrice: 9.99 }
  ];
  const m = ausgabenJeTag(kaeufe, tag(-30), T0);
  ok("Ein Tag mit zwei Posten wird summiert",
    Math.abs(m.get(tag(-5)).summe - (2 * 1.19 + 2.39)) < 0.001, m.get(tag(-5)).summe);
  ok("Beide Posten bleiben einzeln erhalten", m.get(tag(-5)).posten.length === 2);
  ok("Ein Tag außerhalb des Zeitraums fehlt", !m.has(tag(-90)));
  ok("Ein Tag ohne Einkauf taucht gar nicht erst auf", !m.has(tag(-4)));

  const kaputt = ausgabenJeTag([
    { productId: "x", date: "2026-13-45", quantity: 1, unitPrice: 3 },
    { productId: "y", date: null, quantity: 1, unitPrice: 3 },
    { productId: "z", date: tag(-1) }
  ], tag(-30), T0);
  ok("Kaputte Daten fallen raus, sie stürzen nicht ab", kaputt.size === 1);
  ok("Ein Posten ohne Preis zählt null", kaputt.get(tag(-1)).summe === 0);
}

/* ================================================================
   Was kommt
   ================================================================ */
section("Vorhergesagte Fälligkeiten");
{
  const rs = new Map([["milch", rhythmus({ rhythmDays: 7, lastPurchaseDate: tag(-2) })]]);
  const m = faelligJeTag(rs, T0, T0, tag(30), { preisFuer: () => 2 });

  ok("Der erste Termin liegt einen Takt nach dem letzten Kauf", m.has(tag(5)), [...m.keys()].join(", "));
  ok("Und dann alle sieben Tage weiter", m.has(tag(12)) && m.has(tag(19)) && m.has(tag(26)));
  ok("Nichts dazwischen", !m.has(tag(6)) && !m.has(tag(11)));
  ok("Der Betrag steht dran", m.get(tag(5)).summe === 2);
}
{
  // Überfälliges bekommt seinen Termin auf HEUTE — es steht ja
  // gerade jetzt auf der Liste.
  const rs = new Map([["milch", rhythmus({ rhythmDays: 7, lastPurchaseDate: tag(-20) })]]);
  const m = faelligJeTag(rs, T0, T0, tag(30), { preisFuer: () => 2 });
  ok("Überfälliges steht heute an", m.has(T0), [...m.keys()].slice(0, 3).join(", "));
  ok("Kein Termin liegt in der Vergangenheit",
    [...m.keys()].every((d) => d >= T0));
}
{
  const rs = new Map([
    ["gut", rhythmus({ confidence: 0.8 })],
    ["unsicher", rhythmus({ confidence: 0.2 })],
    ["ohneTakt", rhythmus({ rhythmDays: null })],
    ["ohneKauf", rhythmus({ lastPurchaseDate: null })],
    ["kaputtesDatum", rhythmus({ lastPurchaseDate: "2026-13-45" })]
  ]);
  const m = faelligJeTag(rs, T0, T0, tag(30), { preisFuer: () => 1 });
  const alle = [...m.values()].flatMap((e) => e.posten.map((p) => p.productId));
  ok("Nur was auch auf der Liste stünde, wird vorhergesagt",
    [...new Set(alle)].join(",") === "gut", [...new Set(alle)].join(","));
}
{
  const rs = new Map([["milch", rhythmus()], ["nonfood", rhythmus()]]);
  const m = faelligJeTag(rs, T0, T0, tag(30), { preisFuer: () => 1, skip: (id) => id === "nonfood" });
  const alle = [...m.values()].flatMap((e) => e.posten.map((p) => p.productId));
  ok("Was übersprungen werden soll, taucht nicht auf", !alle.includes("nonfood"));
}
{
  // Der Horizont: weiter voraus wird nichts behauptet.
  const rs = new Map([["milch", rhythmus({ rhythmDays: 7 })]]);
  const weit = faelligJeTag(rs, T0, T0, tag(400), { preisFuer: () => 1 });
  const letzter = [...weit.keys()].sort().pop();
  ok(`Nach ${HORIZONT_TAGE} Tagen hört die Vorhersage auf`,
    letzter <= tag(HORIZONT_TAGE), letzter);
  ok("Bis dahin wird aber gerechnet", letzter > tag(HORIZONT_TAGE - 8), letzter);
}
{
  // Ein kaputter Takt darf nicht in eine Endlosschleife führen.
  const rs = new Map([["kaputt", rhythmus({ rhythmDays: 0.2, perUnitDays: 0.2 })]]);
  const t0 = Date.now();
  const m = faelligJeTag(rs, T0, T0, tag(400), { preisFuer: () => 1 });
  ok("Ein Ein-Tages-Takt bleibt beherrschbar", Date.now() - t0 < 1000 && m.size <= 400, m.size);
}

/* ================================================================
   Leer und verdorben sind zwei verschiedene Tage
   ================================================================ */
section("Vorrat: leer gegen verdorben");
{
  const inv = [
    // Reicht rechnerisch 10 Tage, hält aber nur 4 -> verdirbt zuerst.
    { productId: "salat", name: "Salat", remainingUnits: 2, daysLeft: 4, value: 1.5 },
    // Reicht 3 Tage, hält 30 -> wird aufgebraucht.
    { productId: "milch", name: "Milch", remainingUnits: 1, daysLeft: 30, value: 1.2 }
  ];
  const rs = new Map([
    ["salat", rhythmus({ perUnitDays: 5 })],
    ["milch", rhythmus({ perUnitDays: 3 })]
  ]);
  const m = bestandJeTag(inv, rs, T0, T0, tag(60));

  ok("Salat verdirbt an Tag 4", (m.get(tag(4)) || {}).verdirbt.length === 1);
  ok("Salat wäre erst an Tag 10 leer", (m.get(tag(10)) || {}).leer.length === 1);
  ok("Und das wird als überholt markiert", m.get(tag(10)).leer[0].ueberholt === true);
  ok("Beim Verderb steht die Warnung dran", m.get(tag(4)).verdirbt[0].droht === true);

  ok("Milch ist an Tag 3 leer", (m.get(tag(3)) || {}).leer.length === 1);
  ok("Und das ist keine Verschwendung", m.get(tag(3)).leer[0].ueberholt === false);
  ok("Ihre Haltbarkeit endet erst an Tag 30", (m.get(tag(30)) || {}).verdirbt.length === 1);
  ok("Ohne Warnung", m.get(tag(30)).verdirbt[0].droht === false);
}
{
  // Ohne Verbrauchsdauer gibt es kein „leer", nur ein „verdirbt".
  const inv = [{ productId: "x", name: "X", remainingUnits: 2, daysLeft: 9 }];
  const m = bestandJeTag(inv, new Map([["x", rhythmus({ perUnitDays: null })]]), T0, T0, tag(60));
  const leer = [...m.values()].reduce((a, e) => a + e.leer.length, 0);
  ok("Ohne Verbrauchsdauer wird kein Leer-Tag erfunden", leer === 0);
  ok("Der Verderbstag steht trotzdem", (m.get(tag(9)) || {}).verdirbt.length === 1);
}
{
  const inv = [{ productId: "x", name: "X", remainingUnits: 1, daysLeft: 3 }];
  const m = bestandJeTag(inv, new Map([["x", rhythmus({ perUnitDays: 5 })]]), T0, tag(10), tag(60));
  ok("Was vor dem Zeitraum liegt, taucht nicht auf", m.size === 0, m.size);
}

/* ================================================================
   Alles zusammen
   ================================================================ */
section("Der ganze Monat");
{
  const kaufe = [
    { productId: "milch", date: tag(-2), quantity: 2, unitPrice: 1.19 },
    { productId: "brot", date: tag(-2), quantity: 1, unitPrice: 2.39 }
  ];
  const rs = new Map([["milch", rhythmus({ rhythmDays: 7, lastPurchaseDate: tag(-2) })]]);
  const inv = [{ productId: "milch", name: "Milch", remainingUnits: 1, daysLeft: 8, value: 1.19 }];
  const erg = buildCalendar({
    purchases: kaufe, rhythms: rs, inventory: inv,
    heute: T0, von: "2026-09-01", bis: "2026-09-30",
    nameFuer: (id) => id.toUpperCase(),
    preisFuer: () => 2.38
  });

  ok("Für jeden Tag des Monats eine Zeile", erg.tage.length === 30, erg.tage.length);
  ok("Die Zeilen stehen in der richtigen Reihenfolge",
    erg.tage[0].date === "2026-09-01" && erg.tage[29].date === "2026-09-30");

  const gestern = tagFuer(erg, tag(-2));
  ok("Der Einkauf steht am richtigen Tag",
    Math.abs(gestern.ausgegeben - (2 * 1.19 + 2.39)) < 0.001, gestern.ausgegeben);
  ok("Und er ist keine Vorhersage", gestern.erwartet === 0);
  ok("Der Name kommt aus der Oberfläche, nicht aus dem Modul",
    gestern.gekauft.some((p) => p.name === "MILCH"));

  const kuenftig = tagFuer(erg, tag(5));
  ok("Der vorhergesagte Kauf steht am richtigen Tag", kuenftig.erwartet === 2.38, kuenftig.erwartet);
  ok("Und er ist keine Ausgabe", kuenftig.ausgegeben === 0);

  ok("Ein Tag ohne alles bleibt leer, statt zu fehlen",
    tagFuer(erg, tag(1)).ausgegeben === 0 && tagFuer(erg, tag(1)).gekauft.length === 0);

  ok("Die Monatssumme zählt nur, was war",
    Math.abs(erg.summeAusgegeben - (2 * 1.19 + 2.39)) < 0.001, erg.summeAusgegeben);
  ok("Die erwartete Summe zählt nur, was kommt", erg.summeErwartet > 0);
  ok("Beide Summen bleiben getrennt", erg.summeAusgegeben !== erg.summeErwartet);
  ok("Der Horizont wird mitgeliefert", erg.horizont === tag(HORIZONT_TAGE), erg.horizont);
}
{
  // Kein Tag der Vergangenheit trägt eine Vorhersage, kein Tag der
  // Zukunft eine Ausgabe. Das ist die Zusage der ganzen Ansicht.
  const rs = new Map([["milch", rhythmus({ rhythmDays: 3, lastPurchaseDate: tag(-40) })]]);
  const erg = buildCalendar({
    purchases: [{ productId: "milch", date: tag(-10), quantity: 1, unitPrice: 1 }],
    rhythms: rs, inventory: [], heute: T0,
    von: "2026-08-01", bis: "2026-09-30", preisFuer: () => 1
  });
  ok("Keine Vorhersage in der Vergangenheit",
    erg.tage.filter((t) => t.date < T0).every((t) => t.erwartet === 0));
  ok("Keine Ausgabe in der Zukunft",
    erg.tage.filter((t) => t.date > T0).every((t) => t.ausgegeben === 0));
}
{
  const leer = buildCalendar({ heute: T0, von: "2026-09-01", bis: "2026-09-30" });
  ok("Ohne Daten kommt ein leerer Monat zurück, kein Absturz",
    leer.tage.length === 30 && leer.summeAusgegeben === 0);
  ok("Unsinnige Zeiträume liefern nichts",
    buildCalendar({ heute: T0, von: "2026-09-30", bis: "2026-09-01" }).tage.length === 0);
  ok("Kaputte Daten liefern nichts",
    buildCalendar({ heute: "quatsch", von: "2026-09-01", bis: "2026-09-30" }).tage.length === 0);
}

console.log("\n" + "=".repeat(60));
console.log(`KALENDER: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
