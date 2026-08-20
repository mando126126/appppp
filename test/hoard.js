/**
 * hoard.js — Tests für die Vorratserkennung
 * ================================================================
 * Geprüft wird in drei Richtungen, und die dritte ist die
 * wichtigste:
 *
 *   A) Erkennen     — was ein Vorratskauf ist und was nicht
 *   B) Beurteilen   — haltbar heißt gut, verderblich heißt Warnung
 *   C) Nichts läuft doppelt — weder in die Ersparnis noch in die
 *                     Verschwendungsbilanz
 *
 * C ist der Grund, warum es dieses Modul überhaupt einzeln gibt.
 * Ein Vorratskauf berührt zwei Summen, die in diesem Projekt schon
 * dreimal doppelt gezählt wurden: die realisierte Ersparnis (steht
 * im Bon) und den Verlust (steht in der Bilanz). Das Modul darf
 * beides BESCHREIBEN und in keins davon einzahlen.
 * ================================================================
 */

const { detectHoards, activeHoards, judgePurchase, HOARD_FACTOR, MIN_UNITS } =
  require("../src/algo/hoardDetector");
const { computeRhythm } = require("../src/algo/rhythmEngine2");
const { wasteSummary, inferWaste } = require("../src/algo/wasteInference2");
const { byId } = require("../src/algo/foodDatabase");

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

const HEUTE = "2026-05-01";

/** Regelmäßige Kaufreihe, danach optional ein großer Kauf. */
function reihe(pid, { n = 6, abstand = 14, preis = 1.49, menge = 1, start = "2026-01-05" } = {}) {
  const rows = [];
  const d = new Date(start + "T12:00:00Z");
  for (let i = 0; i < n; i++) {
    rows.push({ productId: pid, date: d.toISOString().slice(0, 10), quantity: menge, unitPrice: preis });
    d.setUTCDate(d.getUTCDate() + abstand);
  }
  return rows;
}
function mitHortung(rows, { menge = 6, preis = 0.79, date = "2026-04-20" } = {}) {
  return [...rows, { productId: rows[0].productId, date, quantity: menge, unitPrice: preis }];
}
function funde(rows, today = HEUTE) {
  const rh = new Map([[rows[0].productId, computeRhythm(rows)]]);
  return detectHoards(rows, rh, today);
}

/* ================================================================
   A) Erkennen
   ================================================================ */
section("A) Erkennen");

t("Sechs statt einer ist ein Vorratskauf", () => {
  const f = funde(mitHortung(reihe("nudeln")));
  return f.length === 1 && f[0].units === 6 ? true : JSON.stringify(f.map((x) => x.units));
});

t("Zwei statt einer ist keiner", () => {
  // Wer sonst eine kauft und diesmal zwei, hat Gäste.
  const f = funde(mitHortung(reihe("nudeln"), { menge: 2 }));
  return f.length === 0 ? true : `${f.length} Funde`;
});

t("Die Schwelle ist das Dreifache", () => {
  const knapp = funde(mitHortung(reihe("nudeln"), { menge: HOARD_FACTOR - 1 }));
  const drüber = funde(mitHortung(reihe("nudeln"), { menge: HOARD_FACTOR }));
  return knapp.length === 0 && drüber.length === 1
    ? true : `${knapp.length} / ${drüber.length}`;
});

t("Unter drei Einheiten nie", () => {
  // Auch das Dreifache von 0,5 bleibt eine Kleinigkeit.
  const f = funde(mitHortung(reihe("nudeln", { menge: 0.5 }), { menge: MIN_UNITS - 1 }));
  return f.length === 0 ? true : `${f.length} Funde`;
});

t("Wer immer sechs kauft, hortet nicht", () => {
  const f = funde(mitHortung(reihe("nudeln", { menge: 6 }), { menge: 6 }));
  return f.length === 0 ? true : `${f.length} Funde`;
});

t("Ohne Historie kein Urteil", () => {
  const rows = [{ productId: "nudeln", date: "2026-04-20", quantity: 6, unitPrice: 0.79 }];
  return funde(rows).length === 0 ? true : "urteilt ohne Vergleich";
});

t("Ein unbekanntes Produkt liefert nichts", () => {
  const rows = reihe("gibtsnicht");
  return funde(mitHortung(rows)).length === 0 ? true : "erfindet ein Produkt";
});

t("Aufgebrauchte Stapel sind nicht mehr aktiv", () => {
  // 6 × 14 Tage = 84 Tage Reichweite, Kauf liegt 200 Tage zurück.
  const f = detectHoards(
    mitHortung(reihe("nudeln")),
    new Map([["nudeln", computeRhythm(mitHortung(reihe("nudeln")))]]),
    "2026-11-06"
  );
  return f.length === 1 && f[0].aktiv === false ? true : JSON.stringify(f.map((x) => x.aktiv));
});

t("activeHoards filtert genau die heraus", () => {
  const alle = [{ aktiv: true }, { aktiv: false }, { aktiv: true }];
  return activeHoards(alle).length === 2 ? true : "filtert falsch";
});

/* ================================================================
   B) Beurteilen
   ================================================================ */
section("B) Beurteilen");

t("Haltbares ist ein Vorrat", () => {
  const f = funde(mitHortung(reihe("nudeln")));
  return f[0].kind === "vorrat" ? true : f[0].kind;
});

t("Verderbliches ist zu viel", () => {
  const f = funde(mitHortung(reihe("joghurt_natur", { preis: 0.89 }), { preis: 0.55 }));
  return f[0].kind === "zuviel" ? true : `${f[0].kind} (${f[0].reichweiteTage}/${f[0].haltbarTage})`;
});

t("Und sagt, wie viel darüber liegt", () => {
  const f = funde(mitHortung(reihe("joghurt_natur", { preis: 0.89 }), { preis: 0.55 }));
  const h = f[0];
  const erwartet = (h.reichweiteTage - h.haltbarTage) / h.reichweiteTage;
  return Math.abs(h.überschussAnteil - erwartet) < 0.011
    ? true : `${h.überschussAnteil} statt ${erwartet.toFixed(2)}`;
});

t("Sicherheitskritisches wird nie gelobt", () => {
  /* Hackfleisch auf Vorrat ist auch zum halben Preis keine gute
     Idee. Die App darf das nicht andeuten — auch dann nicht, wenn
     die Rechnung zufällig aufginge. */
  const f = funde(mitHortung(reihe("hackfleisch", { abstand: 30, preis: 4.99 }), { preis: 2.49 }));
  if (!f.length) return true;
  return f[0].kind === "zuviel" && f[0].safetyCritical
    ? true : `${f[0].kind} / ${f[0].safetyCritical}`;
});

t("Der Satz nennt bei Verbrauchsdatum den Grund", () => {
  const f = funde(mitHortung(reihe("hackfleisch", { abstand: 30, preis: 4.99 }), { preis: 2.49 }));
  return !f.length || /Verbrauchsdatum/.test(f[0].message) ? true : f[0].message;
});

t("Ohne gelernten Verbrauch keine Reichweite", () => {
  const rows = [
    { productId: "nudeln", date: "2026-01-05", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-06", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-07", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-08", quantity: 6, unitPrice: 0.79 }
  ];
  const f = detectHoards(rows, new Map(), "2026-01-10");
  return f.every((h) => h.reichweiteTage === null && h.kind === "vorrat")
    ? true : JSON.stringify(f.map((h) => h.reichweiteTage));
});

t("Und behauptet dann auch nichts", () => {
  const rows = [
    { productId: "nudeln", date: "2026-01-05", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-06", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-07", quantity: 1, unitPrice: 1.49 },
    { productId: "nudeln", date: "2026-01-08", quantity: 6, unitPrice: 0.79 }
  ];
  const f = detectHoards(rows, new Map(), "2026-01-10");
  return !f.length || /weiß die App noch nicht/.test(f[0].message) ? true : f[0].message;
});

t("Der bessere Preis wird beziffert", () => {
  const f = funde(mitHortung(reihe("nudeln", { preis: 1.49 }), { preis: 0.79, menge: 6 }));
  // (1,49 − 0,79) × 6 = 4,20
  return Math.abs(f[0].günstiger - 4.2) < 0.011 ? true : String(f[0].günstiger);
});

t("Ohne besseren Preis steht dort null", () => {
  const f = funde(mitHortung(reihe("nudeln", { preis: 1.49 }), { preis: 1.99, menge: 6 }));
  return f[0].günstiger === 0 ? true : String(f[0].günstiger);
});

t("Jeder Fund trägt einen Satz ohne Platzhalter", () => {
  const f = [
    ...funde(mitHortung(reihe("nudeln"))),
    ...funde(mitHortung(reihe("joghurt_natur"))),
    ...funde(mitHortung(reihe("reis")))
  ];
  const kaputt = f.filter((h) => !h.message || /\bundefined\b|\bNaN\b|\bnull\b/.test(h.message));
  return kaputt.length === 0 ? true : kaputt.map((h) => h.message).join(" | ");
});

/* ================================================================
   C) Nichts läuft doppelt
   ================================================================ */
section("C) Nichts läuft doppelt");

t("Das Modul verändert die Verschwendungsbilanz nicht", () => {
  /* Der Kern: die Warnung ist eine VORHERSAGE über einen Stapel,
     der noch da ist. Die Bilanz zählt Vergangenes. Wer beides
     addiert, zählt denselben Joghurt zweimal — und wenn er dann
     doch gegessen wird, steht er trotzdem drin. */
  const rows = mitHortung(reihe("joghurt_natur", { preis: 0.89 }), { preis: 0.55 });
  const rh = new Map([["joghurt_natur", computeRhythm(rows)]]);
  const { chronic, anomalies } = inferWaste(rows, rh);
  const vorher = wasteSummary("joghurt_natur", rows,
    chronic.find((c) => c.productId === "joghurt_natur") || null,
    anomalies.filter((a) => a.productId === "joghurt_natur"));

  const gefunden = detectHoards(rows, rh, HEUTE);

  const nachher = wasteSummary("joghurt_natur", rows,
    chronic.find((c) => c.productId === "joghurt_natur") || null,
    anomalies.filter((a) => a.productId === "joghurt_natur"));

  return gefunden.length > 0 &&
    vorher.wasted === nachher.wasted &&
    vorher.wastedEuros === nachher.wastedEuros
    ? true : `${vorher.wastedEuros} -> ${nachher.wastedEuros}`;
});

t("Der Betrag ist derselbe wie im Bon, nicht ein zweiter", () => {
  /* `günstiger` beziffert dieselbe Ersparnis, die beim Buchen als
     realisiert gezählt wird — nur nach Packungen aufgeschlüsselt.
     Geprüft wird die Rechnung, damit niemand später auf die Idee
     kommt, sie als eigenen Topf zu behandeln. */
  const f = funde(mitHortung(reihe("nudeln", { preis: 1.49 }), { preis: 0.79, menge: 5 }));
  const h = f[0];
  return Math.abs(h.günstiger - (h.üblicherPreis - h.bezahlt) * h.units) < 0.011
    ? true : `${h.günstiger} gegen ${(h.üblicherPreis - h.bezahlt) * h.units}`;
});

t("Ein Fund je Kauf, nie mehrere", () => {
  const rows = mitHortung(mitHortung(reihe("nudeln")), { date: "2026-04-25", menge: 7 });
  const f = funde(rows);
  const daten = f.map((h) => h.date);
  return new Set(daten).size === daten.length ? true : daten.join(", ");
});

t("Reihenfolge: der jüngste Kauf zuerst", () => {
  const rows = mitHortung(mitHortung(reihe("nudeln")), { date: "2026-04-25", menge: 7 });
  const f = funde(rows);
  for (let i = 1; i < f.length; i++) if (f[i - 1].date < f[i].date) return "falsch sortiert";
  return true;
});

t("3000 Zufallshaushalte halten alle Invarianten", () => {
  let seed = 815;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const ids = ["nudeln", "joghurt_natur", "reis", "milch_vollmilch", "hackfleisch", "brot_vollkorn"];

  for (let i = 0; i < 3000; i++) {
    const pid = ids[Math.floor(rnd() * ids.length)];
    let rows = reihe(pid, {
      n: 2 + Math.floor(rnd() * 10),
      abstand: 2 + Math.floor(rnd() * 30),
      preis: Math.round((0.3 + rnd() * 6) * 100) / 100,
      menge: 1 + Math.floor(rnd() * 3)
    });
    if (rnd() < 0.6) rows = mitHortung(rows, { menge: 1 + Math.floor(rnd() * 12), preis: Math.round(rnd() * 500) / 100 });

    const rh = new Map([[pid, computeRhythm(rows)]]);
    const f = detectHoards(rows, rh, HEUTE);

    if (f.length > rows.length) return "mehr Funde als Käufe";
    for (const h of f) {
      if (!(h.units >= MIN_UNITS)) return `Menge ${h.units}`;
      if (h.günstiger < 0) return `negative Ersparnis ${h.günstiger}`;
      if (h.überschussAnteil < 0 || h.überschussAnteil > 1) return `Anteil ${h.überschussAnteil}`;
      if (h.reichweiteTage !== null && h.reichweiteTage < 0) return `Reichweite ${h.reichweiteTage}`;
      if (!["vorrat", "zuviel"].includes(h.kind)) return `Art ${h.kind}`;
      if (h.safetyCritical && h.kind !== "zuviel") return "Sicherheitskritisches gelobt";
      if (/\bundefined\b|\bNaN\b|\bnull\b/.test(h.message)) return `Satz: ${h.message}`;
      if (!rows.some((r) => r.date === h.date)) return "Fund ohne Kauf";
      const p = byId(h.productId);
      if (!p) return "Fund ohne Produkt";
    }
  }
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`VORRAT: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
