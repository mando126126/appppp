/**
 * schwarm.js — Tests für Preisteilung und Angebotsrat
 * ================================================================
 * Der Schwarm-Preisindex ist die erste Funktion dieser App, bei der
 * überhaupt etwas das Gerät verlassen könnte. Alles bisher —
 * Texterkennung, Schrift, Rhythmen — wurde bewusst teuer lokal
 * gebaut, um das zu vermeiden.
 *
 * Diese Datei prüft deshalb nicht in erster Linie, dass die Funktion
 * funktioniert, sondern dass sie SCHWEIGT, wo sie schweigen muss:
 *
 *   A) Was niemals eine Sichtung wird
 *   B) Was in einer Sichtung nicht drinsteht
 *   C) Der Index gibt nichts unter k heraus
 *   D) Der Angebotsrat rechnet mit der Haltbarkeit, nicht mit Lust
 *   E) Zufallsdaten gegen alle Invarianten
 * ================================================================
 */

const {
  chainOf, isoWeek, observationFrom, shareableFrom, buildPriceIndex, missingFor,
  SHARE_VERSION, K_ANONYMITY
} = require("../src/algo/priceShare");
const { offerAdvice, sourceNote, DEAL_THRESHOLD, MAX_STOCK_UNITS } = require("../src/algo/offerAdvisor");
const { byId, FOOD_DATABASE } = require("../src/algo/foodDatabase");

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

const kauf = (over = {}) => ({
  productId: "butter", date: "2026-08-18", unitPrice: 1.49, ...over
});

/* ================================================================
   A) Was niemals eine Sichtung wird
   ================================================================ */
section("A) Was nie übertragen wird");

t("Ein unbekannter Händler wird nicht geteilt", () => {
  return observationFrom(kauf(), "Hofladen Müller") === null ? true : "wird geteilt";
});

t("Auch nicht der Bäcker um die Ecke", () => {
  return observationFrom(kauf(), "Bäckerei Schmidt") === null ? true : "wird geteilt";
});

t("Ohne Händler gar nichts", () => {
  return observationFrom(kauf(), "") === null && observationFrom(kauf(), null) === null
    ? true : "teilt ohne Händler";
});

t("Ein Straßenname macht keine Kette", () => {
  /* Teilzeichenketten wären hier fatal: „Realschulweg" enthält
     „real", „Pennystraße" enthält „penny". */
  return chainOf("Realschulweg Kiosk") === null && chainOf("Pennystrasse 4") === null
    ? true : `${chainOf("Realschulweg Kiosk")} / ${chainOf("Pennystrasse 4")}`;
});

t("„Müller“ ist ein Nachname, keine Kette", () => {
  // Stand einmal in der Liste und wurde beim Testen gefunden.
  return chainOf("Hofladen Müller") === null && chainOf("Müller Drogerie") === null
    ? true : "erkennt Müller als Kette";
});

t("Ein Produkt außerhalb des Katalogs wird nicht geteilt", () => {
  return observationFrom(kauf({ productId: "gibtsnicht" }), "Lidl") === null
    ? true : "teilt Unbekanntes";
});

t("Ein unmöglicher Preis wird nicht geteilt", () => {
  /* Eine falsch erkannte Bonzeile („1,49" als „149,00") darf den
     Index nicht verschieben. */
  const zuHoch = observationFrom(kauf({ unitPrice: 149 }), "Lidl");
  const zuNiedrig = observationFrom(kauf({ unitPrice: 0.01 }), "Lidl");
  return zuHoch === null && zuNiedrig === null ? true : "teilt Unsinn";
});

t("Preis null oder negativ wird nicht geteilt", () => {
  return observationFrom(kauf({ unitPrice: 0 }), "Lidl") === null &&
         observationFrom(kauf({ unitPrice: -2 }), "Lidl") === null
    ? true : "teilt Unmögliches";
});

t("Ein kaputtes Datum wird nicht geteilt", () => {
  return observationFrom(kauf({ date: "kein datum" }), "Lidl") === null
    ? true : "teilt ohne Woche";
});

/* ================================================================
   B) Was in einer Sichtung NICHT drinsteht
   ================================================================ */
section("B) Was nicht drinsteht");

t("Eine Sichtung hat genau sechs Felder", () => {
  const o = observationFrom(kauf(), "Lidl");
  const felder = Object.keys(o).sort().join(",");
  return felder === "cent,kette,kw,packung,produkt,v" ? true : felder;
});

t("Keine Menge — sie verrät die Haushaltsgröße", () => {
  const o = observationFrom(kauf({ quantity: 6 }), "Lidl");
  return o.quantity === undefined && !("menge" in o) ? true : "Menge ist drin";
});

t("Kein Datum, nur die Woche", () => {
  const o = observationFrom(kauf(), "Lidl");
  const roh = JSON.stringify(o);
  return o.kw === "2026-W34" && !/2026-08-18/.test(roh) ? true : roh;
});

t("Keine Filiale, nur die Kette", () => {
  const o = observationFrom(kauf(), "LIDL Filiale 4711 Musterstadt");
  return o.kette === "lidl" && !/4711|Musterstadt/i.test(JSON.stringify(o))
    ? true : JSON.stringify(o);
});

t("Keine Kennung, kein Schlüssel, kein Gerät", () => {
  const a = JSON.stringify(observationFrom(kauf(), "Lidl"));
  const b = JSON.stringify(observationFrom(kauf(), "Lidl"));
  // Zwei gleiche Käufe ergeben identische Sichtungen — es gibt also
  // nichts darin, was einen Absender unterscheidbar machte.
  return a === b ? true : `${a} ≠ ${b}`;
});

t("Der Warenkorb wird auseinandergerissen", () => {
  /* Zwölf Positionen in einem Bon sind ein Fingerabdruck. Die
     Sichtungen dürfen keinen Bezug zueinander tragen. */
  const bon = [
    kauf({ productId: "butter" }),
    kauf({ productId: "milch_vollmilch", unitPrice: 1.29 }),
    kauf({ productId: "brot_vollkorn", unitPrice: 2.49 })
  ].map((k) => ({ ...k, store: "Lidl" }));
  const obs = shareableFrom(bon, null, { random: () => 0.5 });
  const gemeinsam = obs.every((o) => !("bon" in o) && !("id" in o) && !("korb" in o));
  return obs.length === 3 && gemeinsam ? true : JSON.stringify(obs);
});

t("Die Kalenderwoche stimmt auch am Jahreswechsel", () => {
  // 2026-01-01 ist ein Donnerstag und gehört zu KW 1.
  return isoWeek("2026-01-01") === "2026-W01" ? true : isoWeek("2026-01-01");
});

t("Und am anderen Ende", () => {
  // 2026-12-31 ist ein Donnerstag, KW 53.
  return isoWeek("2026-12-31") === "2026-W53" ? true : isoWeek("2026-12-31");
});

/* ================================================================
   C) Der Index gibt nichts unter k heraus
   ================================================================ */
section("C) Nichts unter k");

const vieleSichtungen = (n, preis = 1.49) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(observationFrom(kauf({ unitPrice: preis }), "Lidl"));
  return out;
};

t("Vier Sichtungen ergeben nichts", () => {
  return buildPriceIndex(vieleSichtungen(K_ANONYMITY - 1)).length === 0 ? true : "gibt heraus";
});

t("Fünf ergeben einen Wert", () => {
  const idx = buildPriceIndex(vieleSichtungen(K_ANONYMITY));
  return idx.length === 1 && idx[0].n === K_ANONYMITY ? true : JSON.stringify(idx);
});

t("Die Schwelle lässt sich nicht heimlich senken", () => {
  // Auch mit eigenem k bleibt die Regel dieselbe Regel.
  const idx = buildPriceIndex(vieleSichtungen(3), { k: 3 });
  return idx.length === 1 && idx[0].n === 3 ? true : "k wird ignoriert";
});

t("Der Index nennt den Median, nicht den Mittelwert", () => {
  /* Ein einzelner Ausreißer — etwa eine falsch erkannte Zeile — darf
     den Wert nicht ziehen. */
  const obs = [
    ...vieleSichtungen(4, 1.5),
    observationFrom(kauf({ unitPrice: 4.99 }), "Lidl")
  ];
  const idx = buildPriceIndex(obs);
  return idx[0].medianCent === 150 ? true : String(idx[0].medianCent);
});

t("Verschiedene Wochen bleiben getrennt", () => {
  const obs = [
    ...vieleSichtungen(5),
    ...Array.from({ length: 5 }, () => observationFrom(kauf({ date: "2026-08-25" }), "Lidl"))
  ];
  return buildPriceIndex(obs).length === 2 ? true : String(buildPriceIndex(obs).length);
});

t("Verschiedene Ketten bleiben getrennt", () => {
  const obs = [
    ...vieleSichtungen(5),
    ...Array.from({ length: 5 }, () => observationFrom(kauf(), "Aldi"))
  ];
  const idx = buildPriceIndex(obs);
  return idx.length === 2 && new Set(idx.map((x) => x.kette)).size === 2
    ? true : JSON.stringify(idx.map((x) => x.kette));
});

t("Eine fremde Fassung wird nicht eingerechnet", () => {
  const obs = vieleSichtungen(5).map((o) => ({ ...o, v: SHARE_VERSION + 1 }));
  return buildPriceIndex(obs).length === 0 ? true : "rechnet Fremdes mit";
});

t("Die App sagt, wie viel noch fehlt", () => {
  const obs = vieleSichtungen(2);
  return missingFor(obs, "butter", "lidl", "2026-W34") === K_ANONYMITY - 2
    ? true : String(missingFor(obs, "butter", "lidl", "2026-W34"));
});

/* ================================================================
   D) Der Angebotsrat
   ================================================================ */
section("D) Der Angebotsrat");

t("Kein Nachlass, kein Rat", () => {
  return offerAdvice("butter", { preis: 2.25, üblich: 2.29, perUnitDays: 12 }) === null
    ? true : "rät bei Preisrauschen";
});

t("Ab der Schwelle schon", () => {
  const knapp = offerAdvice("butter", { preis: 2.29 * (1 - DEAL_THRESHOLD + 0.01), üblich: 2.29, perUnitDays: 12 });
  const drüber = offerAdvice("butter", { preis: 2.29 * (1 - DEAL_THRESHOLD - 0.01), üblich: 2.29, perUnitDays: 12 });
  return knapp === null && drüber !== null ? true : `${!!knapp} / ${!!drüber}`;
});

t("Die Haltbarkeit begrenzt die Menge", () => {
  /* Der Kern der ganzen Funktion: Höchstmenge = Haltbarkeit ÷
     Verbrauch je Einheit. Butter hält 40 Tage, 12 Tage je Packung
     ergibt 3. */
  const a = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12 });
  return a.einheiten === 3 && a.begrenztDurch === "haltbarkeit"
    ? true : `${a.einheiten} / ${a.begrenztDurch}`;
});

t("Der Vorrat bleibt in der Haltbarkeit", () => {
  const p = byId("butter");
  const a = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12 });
  return a.reichweiteTage <= p.shelfLifeDays
    ? true : `${a.reichweiteTage} > ${p.shelfLifeDays}`;
});

t("Zu kurz haltbar heißt: kein Vorrat, und das wird gesagt", () => {
  const a = offerAdvice("salat_kopf", { preis: 0.59, üblich: 1.29, perUnitDays: 14 });
  return a && a.kind === "kein-vorrat" && /Haltbarkeit aber nicht/.test(a.message)
    ? true : JSON.stringify(a);
});

t("Ohne gelernten Verbrauch kein Rat", () => {
  return offerAdvice("butter", { preis: 1.49, üblich: 2.29 }) === null &&
         offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 0 }) === null
    ? true : "rät ins Blaue";
});

t("Sicherheitskritisches nie", () => {
  /* Ein Verbrauchsdatum lässt sich nicht durch einen guten Preis
     verlängern. */
  const kritisch = FOOD_DATABASE.filter((p) => p.safetyCritical);
  const geraten = kritisch.filter((p) =>
    offerAdvice(p.id, { preis: 1, üblich: 10, perUnitDays: 1 }) !== null);
  return geraten.length === 0 ? true : geraten.map((p) => p.name).join(", ");
});

t("Nie mehr als die Obergrenze", () => {
  const a = offerAdvice("reis", { preis: 0.5, üblich: 2.19, perUnitDays: 200 });
  return !a || a.einheiten <= MAX_STOCK_UNITS ? true : String(a.einheiten);
});

t("Die Ersparnis ist die Vorschau, nicht die Bilanz", () => {
  /* Sie wird nirgends gutgeschrieben — realisiert zählt sie erst
     `receiptSavings` beim Buchen. Geprüft wird nur die Rechnung. */
  const a = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12 });
  return Math.abs(a.ersparnis - (2.29 - 1.49) * a.einheiten) < 0.011
    ? true : String(a.ersparnis);
});

t("Die Herkunft steht dabei", () => {
  const eigen = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12 });
  const schwarm = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12, herkunft: "schwarm", n: 47 });
  return /eigenen bisherigen Preisen/.test(sourceNote(eigen)) &&
         /47 Meldungen/.test(sourceNote(schwarm))
    ? true : `${sourceNote(eigen)} | ${sourceNote(schwarm)}`;
});

t("Und die Rechnung ist unabhängig von der Herkunft", () => {
  const a = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12 });
  const b = offerAdvice("butter", { preis: 1.49, üblich: 2.29, perUnitDays: 12, herkunft: "schwarm", n: 47 });
  return a.einheiten === b.einheiten && a.ersparnis === b.ersparnis
    ? true : "die Herkunft ändert die Zahl";
});

/* ================================================================
   E) Zufallsdaten
   ================================================================ */
section("E) Zufallsdaten");

t("5000 Zufallskäufe teilen nie etwas Verbotenes", () => {
  let seed = 4711;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const laeden = ["Lidl", "Aldi Süd", "Hofladen Müller", "REWE Markt", "Kiosk am Eck",
    "Bäckerei Schmidt", "", null, "Realschulweg", "Netto Marken-Discount"];

  for (let i = 0; i < 5000; i++) {
    const p = FOOD_DATABASE[Math.floor(rnd() * FOOD_DATABASE.length)];
    const laden = laeden[Math.floor(rnd() * laeden.length)];
    const o = observationFrom({
      productId: p.id,
      date: `2026-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
      unitPrice: Math.round(rnd() * 2000) / 100,
      quantity: 1 + Math.floor(rnd() * 8)
    }, laden);
    if (!o) continue;

    if (chainOf(laden) === null) return `geteilt trotz unbekanntem Laden: ${laden}`;
    if (Object.keys(o).length !== 6) return `${Object.keys(o).length} Felder: ${Object.keys(o)}`;
    if ("quantity" in o || "menge" in o) return "Menge im Datensatz";
    if (!/^\d{4}-W\d{2}$/.test(o.kw)) return `Woche ${o.kw}`;
    if (!Number.isInteger(o.cent) || o.cent <= 0) return `Cent ${o.cent}`;
    if (JSON.stringify(o).includes(laden)) return "Ladenname im Datensatz";
  }
  return true;
});

t("3000 Angebotslagen halten die Haltbarkeitsgrenze ein", () => {
  let seed = 99;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 3000; i++) {
    const p = FOOD_DATABASE[Math.floor(rnd() * FOOD_DATABASE.length)];
    const üblich = 0.5 + rnd() * 8;
    const a = offerAdvice(p.id, {
      preis: üblich * rnd(),
      üblich,
      perUnitDays: 1 + rnd() * 60
    });
    if (!a) continue;
    if (p.safetyCritical) return `rät bei ${p.name}`;
    if (a.einheiten < 1 || a.einheiten > MAX_STOCK_UNITS) return `Menge ${a.einheiten}`;
    if (a.kind === "vorrat" && a.reichweiteTage > p.shelfLifeDays) {
      return `${a.reichweiteTage} Tage bei ${p.shelfLifeDays} Haltbarkeit (${p.name})`;
    }
    if (a.ersparnis < 0) return `negative Ersparnis ${a.ersparnis}`;
    /* Wortgrenzen, nicht Teilzeichenketten. Ohne sie schlug dieser
       Test bei „Schnuller" an — das Wort enthält „null". Genau die
       Sorte Fehlalarm, die man einmal wegklickt und beim zweiten Mal
       nicht mehr ernst nimmt. */
    if (/\bundefined\b|\bNaN\b|\bnull\b/.test(a.message)) return a.message;
  }
  return true;
});

// ================================================================
section("F: Stufe-2-Infrastruktur, vorbereitet und absichtlich untätig");

/* schwarmClient.js ist der einzige Ort im Code, an dem eine
   Übertragung überhaupt vorkäme. Diese Sektion prüft nicht, dass er
   funktioniert -- sie prüft, dass er unter KEINER Kombination aus
   Einstellungen tatsächlich sendet, solange keine Gegenstelle
   eingetragen ist. Das ist die Garantie, die "kein Server, keine
   Übertragung" heute noch wahr macht, trotz der neuen Datei. */
const { ENDPOINT, configured, weeklyBatch, attemptShare } = require("../src/algo/schwarmClient");

t("Keine Gegenstelle eingetragen", () => ENDPOINT === null);
t("configured() sagt das auch so", () => configured() === false);

t("attemptShare sendet nichts, auch ohne Einwilligung", () => {
  const r = attemptShare({ enabled: false }, [kauf()], () => "Lidl", "2026-08-18");
  return r.sent === false ? true : JSON.stringify(r);
});

t("Und sendet auch nichts, wenn die Einwilligung (hypothetisch) an wäre", () => {
  // Genau der Fall, der gefährlich wäre, wenn er anders liefe: ein
  // Zustand, in dem nur noch ENDPOINT fehlt. Muss trotzdem schweigen.
  const r = attemptShare({ enabled: true }, [kauf()], () => "Lidl", "2026-08-18");
  return r.sent === false ? true : JSON.stringify(r);
});

t("Der Grund wird genannt, nicht nur ein 'nein'", () => {
  const r = attemptShare({ enabled: true }, [kauf()], () => "Lidl", "2026-08-18");
  return typeof r.reason === "string" && r.reason.length > 0 ? true : r.reason;
});

t("weeklyBatch nimmt nur Käufe der angefragten Kalenderwoche", () => {
  const b = weeklyBatch([
    kauf({ date: "2026-08-18" }),               // Woche 34
    kauf({ productId: "milch", date: "2026-08-25" }) // Woche 35
  ], () => "Lidl", "2026-08-18");
  return b.length === 1 && b[0].produkt === "butter" ? true : JSON.stringify(b);
});

t("weeklyBatch bleibt leer ohne bekannte Kette -- dieselbe Regel wie shareableFrom", () => {
  const b = weeklyBatch([kauf()], () => "Hofladen Müller", "2026-08-18");
  return b.length === 0 ? true : JSON.stringify(b);
});

t("Ohne gültiges Bezugsdatum keine Sichtungen, kein Absturz",
  () => weeklyBatch([kauf()], () => "Lidl", "keine-woche").length === 0);

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`SCHWARM: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
