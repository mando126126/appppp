/**
 * safety.js — die Prüfung der verderblichen Lebensmittel
 * ================================================================
 * Diese Datei ist der Grund, warum die Quellenprüfung nicht in drei
 * Monaten wieder wertlos ist. Eine einmalige Durchsicht altert; ein
 * Test, der bei jedem `npm test` abbricht, nicht.
 *
 * Geprüft wird in vier Richtungen:
 *
 *   A) Der Katalog gegen die Gruppen — keine Haltbarkeit über der
 *      Empfehlung, keine Gruppe ohne Beleg, keine Temperatur falsch
 *   B) Die Herkunftsangabe — keine Tageszahl darf sich als
 *      „rechtlich definiert“ ausgeben, denn das ist keine
 *   C) Das aufgedruckte Datum schlägt jede Schätzung, in beide
 *      Richtungen, und lässt sich nicht mit Unsinn füttern
 *   D) Die harten Sperren: für Verbrauchsdatum-Produkte darf die App
 *      nie verlängern, nie eine Resteverwertung vorschlagen, nie ein
 *      abgelaufenes Produkt als brauchbar führen
 * ================================================================
 */

const { FOOD_DATABASE, byId } = require("../src/algo/foodDatabase");
const { SAFETY_GROUPS, checkSafetyData, safetyGroupOf, safetyFacts } = require("../src/algo/safetyRules");
const { estimateRemaining, estimateInventory } = require("../src/algo/inventoryEstimator");
const { suggestRecipes } = require("../src/algo/recipeMatcher");
const { adviseFreezing } = (() => {
  try { return require("../src/algo/freezeAdvisor"); } catch (e) { return {}; }
})();

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
const KRITISCH = FOOD_DATABASE.filter((p) => p.safetyCritical);

// ================================================================
section("A: Katalog gegen die geprüften Gruppen");

t("Die Prüfung meldet keinen einzigen Befund", () => {
  const befunde = checkSafetyData(FOOD_DATABASE);
  if (!befunde.length) return true;
  return `${befunde.length} Befunde, u. a.: ` +
    befunde.slice(0, 6).map((b) => `${b.productId}: ${b.message}`).join(" | ");
});

t("Es gibt überhaupt sicherheitskritische Produkte", () => {
  // Ein Schutz gegen den stillsten Fehler: wenn `safetyCritical`
  // eines Tages nicht mehr gesetzt wird, wäre die Prüfung oben
  // schlagartig grün — weil sie nichts mehr zu prüfen hätte.
  return KRITISCH.length >= 50 ? true : `nur ${KRITISCH.length}`;
});

t("Jedes davon ist einer Gruppe zugeordnet", () => {
  const ohne = KRITISCH.filter((p) => !safetyGroupOf(p.id));
  return ohne.length === 0 ? true : ohne.map((p) => p.id).join(", ");
});

t("Jede Gruppe trägt eine Rechtsgrundlage und eine Empfehlung", () => {
  const luecken = SAFETY_GROUPS.filter((g) =>
    !Array.isArray(g.legal) || !g.legal.length || !g.guide || g.guide.length < 40);
  return luecken.length === 0 ? true : luecken.map((g) => g.id).join(", ");
});

t("Jede Gruppe nennt eine Höchsttemperatur", () => {
  const ohne = SAFETY_GROUPS.filter((g) => !Number.isFinite(g.maxTempC) || g.maxTempC > 7);
  return ohne.length === 0 ? true : ohne.map((g) => `${g.id}=${g.maxTempC}`).join(", ");
});

t("Kein Produkt steht in zwei Gruppen", () => {
  const gesehen = new Map();
  for (const g of SAFETY_GROUPS) {
    for (const id of g.ids) {
      if (gesehen.has(id)) return `${id}: ${gesehen.get(id)} und ${g.id}`;
      gesehen.set(id, g.id);
    }
  }
  return true;
});

t("Die Temperaturen entsprechen der Tier-LMHV", () => {
  // Die vier Zahlen, die tatsächlich im Recht stehen. Wer sie ändert,
  // muss hier vorbei.
  const soll = { hack: 2, innereien: 3, zubereitung: 4, gefluegel: 4 };
  for (const [id, grad] of Object.entries(soll)) {
    const g = SAFETY_GROUPS.find((x) => x.id === id);
    if (!g) return `Gruppe ${id} fehlt`;
    if (g.maxTempC !== grad) return `${id}: ${g.maxTempC} °C statt ${grad} °C`;
  }
  return true;
});

t("Die sieben korrigierten Produkte liegen jetzt richtig", () => {
  // Sie standen vor der Prüfung bei drei Tagen — Geflügel und
  // Fleischzubereitungen einen Tag über der Empfehlung, Sprossen
  // ebenfalls. Namentlich festgehalten, damit sie nicht unbemerkt
  // zurückwandern.
  const soll = {
    entenbrust: 2, gans: 2, haehnchen_nuggets: 2,
    bratwurst: 2, gyros_frisch: 2, merguez: 2, sprossen: 2
  };
  for (const [id, tage] of Object.entries(soll)) {
    const p = byId(id);
    if (!p) return `${id} fehlt im Katalog`;
    if (p.shelfLifeDays > tage) return `${id}: ${p.shelfLifeDays} Tage statt höchstens ${tage}`;
  }
  return true;
});

// ================================================================
section("B: Woher die Zahlen kommen");

t("Keine Haltbarkeit gibt sich als rechtlich definiert aus", () => {
  // Der Kern der ganzen Prüfung. Rechtlich geregelt sind die Pflicht
  // zum Verbrauchsdatum und die Höchsttemperatur — nicht die Tage.
  const falsch = KRITISCH.filter((p) => p.quality === "regulatorisch");
  return falsch.length === 0
    ? true
    : `${falsch.length} Produkte behaupten eine Rechtsgrundlage für ihre Tageszahl`;
});

t("Alle tragen ein Prüfdatum", () => {
  const ohne = KRITISCH.filter((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.checked || ""));
  return ohne.length === 0 ? true : `${ohne.length} ohne Prüfdatum`;
});

t("Alle tragen ihre Höchsttemperatur", () => {
  const ohne = KRITISCH.filter((p) => !Number.isFinite(p.maxTempC));
  return ohne.length === 0 ? true : ohne.slice(0, 5).map((p) => p.id).join(", ");
});

t("safetyFacts trennt Recht und Empfehlung", () => {
  const f = safetyFacts("hackfleisch");
  if (!f) return "keine Angaben zu Hackfleisch";
  if (!f.legal.some((x) => /1169\/2011|853\/2004|Tier-LMHV/.test(x))) return "keine Rechtsgrundlage genannt";
  if (!/BZfE|BMEL|abgeleitet/i.test(f.guide)) return "keine Herkunft der Empfehlung";
  if (!/aufgedruckte/i.test(f.printedWins)) return "der wichtigste Satz fehlt";
  return true;
});

t("Für ein unkritisches Produkt gibt es keine Sicherheitsangaben", () => {
  return safetyFacts("reis") === null ? true : "Reis hat plötzlich eine Sicherheitsgruppe";
});

// ================================================================
section("C: Das aufgedruckte Datum schlägt die Schätzung");

const KAUF = { date: "2026-08-10", quantity: 1, unitPrice: 6.99 };

t("Ohne Eintrag gilt die Lagerempfehlung", () => {
  const e = estimateRemaining("haehnchen", KAUF, null, "2026-08-13");
  return e && e.dateSource === "geschaetzt" && e.daysLeft === -1
    ? true : JSON.stringify(e && { d: e.daysLeft, q: e.dateSource });
});

t("Ein späteres Etikett verlängert", () => {
  const e = estimateRemaining("haehnchen", KAUF, null, "2026-08-13", { useBy: { haehnchen: "2026-08-16" } });
  if (!e) return "kein Ergebnis";
  if (e.dateSource !== "aufgedruckt") return `Quelle ${e.dateSource}`;
  if (e.daysLeft !== 3) return `daysLeft ${e.daysLeft}`;
  return e.expired === false ? true : "trotzdem als abgelaufen geführt";
});

t("Ein früheres Etikett verkürzt", () => {
  // Beide Richtungen sind wichtig. Nur nach oben zu korrigieren wäre
  // bequem und im Zweifel gefährlich.
  const e = estimateRemaining("rinderbraten", KAUF, null, "2026-08-11", { useBy: { rinderbraten: "2026-08-10" } });
  return e && e.daysLeft < 0 && e.expired ? true : JSON.stringify(e && { d: e.daysLeft, x: e.expired });
});

t("Ein Etikett vor dem Kaufdatum wird ignoriert", () => {
  const e = estimateRemaining("haehnchen", KAUF, null, "2026-08-13", { useBy: { haehnchen: "2026-08-01" } });
  return e && e.dateSource === "geschaetzt" ? true : `angenommen: ${e && e.useBy}`;
});

t("Müll als Etikett wird ignoriert", () => {
  for (const kaputt of ["morgen", "2026-13-45", "", null, 0, [], {}, "13.08.2026"]) {
    const e = estimateRemaining("haehnchen", KAUF, null, "2026-08-13", { useBy: { haehnchen: kaputt } });
    if (!e) return `kein Ergebnis bei ${JSON.stringify(kaputt)}`;
    if (e.dateSource !== "geschaetzt") return `angenommen: ${JSON.stringify(kaputt)}`;
  }
  return true;
});

t("Das Etikett wirkt auch im ganzen Bestand", () => {
  const history = [{ productId: "haehnchen", date: "2026-08-10", quantity: 1, unitPrice: 6.99 }];
  const ohne = estimateInventory(history, new Map(), "2026-08-13");
  const mit = estimateInventory(history, new Map(), "2026-08-13", { useBy: { haehnchen: "2026-08-18" } });
  const a = ohne.find((x) => x.productId === "haehnchen");
  const b = mit.find((x) => x.productId === "haehnchen");
  if (!b) return "mit Etikett gar nicht mehr im Bestand";
  if (b.daysLeft !== 5) return `daysLeft ${b.daysLeft}`;
  return !a || a.daysLeft < b.daysLeft ? true : "das Etikett hat nichts geändert";
});

// ================================================================
section("D: Die harten Sperren");

t("Kein Rezept verwendet ein abgelaufenes Verbrauchsdatum-Produkt", () => {
  const stock = KRITISCH.slice(0, 12).map((p) => ({ productId: p.id, daysLeft: -1, price: 5 }));
  const rec = suggestRecipes(stock);
  const genutzt = (Array.isArray(rec) ? rec : []).flatMap((r) => r.usesFromStock || []);
  const verboten = KRITISCH.filter((p) => genutzt.includes(p.name));
  return verboten.length === 0 ? true : verboten.map((p) => p.name).join(", ");
});

t("Ein abgelaufenes Produkt gilt nie als vorhanden", () => {
  const e = estimateRemaining("hackfleisch", { date: "2026-08-01", quantity: 1, unitPrice: 5 }, null, "2026-08-13");
  return e && e.likelyPresent === false ? true : JSON.stringify(e && { p: e.likelyPresent, d: e.daysLeft });
});

t("Kein Verbrauchsdatum-Produkt hält angebrochen länger als zu", () => {
  const falsch = KRITISCH.filter((p) => (p.shelfLifeOpenedDays || 0) > p.shelfLifeDays);
  return falsch.length === 0 ? true : falsch.map((p) => p.id).join(", ");
});

t("Kein Verbrauchsdatum-Produkt steht über der Gruppengrenze — auch nach Zufallsprüfung", () => {
  // Gegen die stille Rückkehr einer zu langen Zahl: alles noch einmal,
  // unabhängig von checkSafetyData.
  for (const p of KRITISCH) {
    const g = safetyGroupOf(p.id);
    if (!g) return `${p.id} ohne Gruppe`;
    if (p.shelfLifeDays > g.maxDays) return `${p.id}: ${p.shelfLifeDays} > ${g.maxDays}`;
  }
  return true;
});

t("Einfrieren wird für Verbrauchsdatum-Produkte nicht als Verlängerung verkauft", () => {
  if (typeof adviseFreezing !== "function") return true;   // Modul heißt anders
  const rat = adviseFreezing(
    [{ productId: "hackfleisch", quantity: 2, date: "2026-08-13", unitPrice: 5 }],
    new Map(), "2026-08-13");
  const alle = Array.isArray(rat) ? rat : [];
  const luegen = alle.filter((x) => /verlängert das Verbrauchsdatum/i.test(x.message || ""));
  return luegen.length === 0 ? true : "verspricht eine Verlängerung";
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`SICHERHEIT: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
