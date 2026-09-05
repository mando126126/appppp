/**
 * diet.js — Tests für die optionalen Ernährungsweisen
 * ================================================================
 * Drei Dinge müssen stimmen, und das dritte ist das wichtigste:
 *
 *   A) Die Einordnung trifft, was sie trifft — auch quer durch
 *      deutsche Komposita ("Fischsauce", "Müllermilch")
 *   B) Anteile und Protein rechnen richtig und behaupten nichts
 *      über den Teil, den sie nicht kennen
 *   C) OHNE gewähltes Profil ändert sich NICHTS. Eine Funktion,
 *      die ungefragt Einkäufe kommentiert, wäre übergriffig —
 *      dieselbe Garantie wie bei schwarm/referral, nur andersherum
 * ================================================================
 */

const {
  DIET_KIND, DIET_PROFILES, dietProfileById, dietKindOf, fitsDiet,
  dietAlternatives, dietShares, proteinPer100g, dietProtein,
  PLANT_OVERRIDES, PROTEIN_PER_100G
} = require("../src/algo/dietProfiles");
const { byId, FOOD_DATABASE } = require("../src/algo/foodDatabase");

let pass = 0, fail = 0;
const problems = [];
function t(name, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) { pass++; return; }
    fail++; problems.push(`${name}: ${r}`);
    console.log(`  FEHL  ${name}\n        ${r}`);
  } catch (e) {
    fail++; problems.push(`${name}: ABSTURZ ${e.message}`);
    console.log(`  ABSTURZ ${name}\n        ${e.message}`);
  }
}
const section = (s) => console.log(`\n--- ${s} ---`);

/** Findet ein Katalogprodukt über seinen Namen. */
const idVon = (name) => (FOOD_DATABASE.find((p) => p.name === name) || {}).id;

// ================================================================
section("A: Die Einordnung");

t("Hackfleisch ist Fleisch", () => dietKindOf("hackfleisch") === DIET_KIND.MEAT);
t("Lachsfilet auch", () => dietKindOf("fisch_lachs") === DIET_KIND.MEAT);
t("Vollmilch ist vegetarisch", () => dietKindOf("milch_vollmilch") === DIET_KIND.VEGGIE);
t("Gouda ebenso", () => dietKindOf("kaese_gouda") === DIET_KIND.VEGGIE);
t("Eier ebenso", () => dietKindOf("eier") === DIET_KIND.VEGGIE);
t("Linsen sind pflanzlich", () => dietKindOf("linsen") === DIET_KIND.PLANT);
t("Bananen auch", () => dietKindOf("bananen") === DIET_KIND.PLANT);

/* Der Katalog bildet den LADEN ab: Tofu liegt beim Fleisch. Eine
   Regel, die nur die Kategorie liest, macht daraus Fleisch. */
t("Tofu steht beim Fleisch und ist trotzdem pflanzlich",
  () => byId("tofu_natur").category === "Fleisch/Fisch" &&
    dietKindOf("tofu_natur") === DIET_KIND.PLANT);
t("Räuchertofu ebenso -- die Kennung im Katalog heißt tofu_geraeuchert",
  () => dietKindOf("tofu_geraeuchert") === DIET_KIND.PLANT);
t("Veggie-Hack ebenso", () => dietKindOf("veggie_hack") === DIET_KIND.PLANT);
t("Jede Kennung in PLANT_OVERRIDES gibt es auch im Katalog", () => {
  const fehlend = [...PLANT_OVERRIDES].filter((id) => !byId(id));
  return fehlend.length === 0 ? true : "unbekannt: " + fehlend.join(", ");
});

/* Deutsche Komposita: der Stamm steht mitten im Wort, keine
   Wortgrenze trennt ihn ab. Genau daran scheiterte die erste
   Fassung -- beide Saucen liefen als pflanzlich durch. */
t("Fischsauce ist kein pflanzliches Produkt",
  () => dietKindOf(idVon("Fischsauce")) === DIET_KIND.MEAT);
t("Worcestershiresauce auch nicht (Sardellen)",
  () => dietKindOf(idVon("Worcestershiresauce")) === DIET_KIND.MEAT);
t("Gelatine ebenso", () => dietKindOf(idVon("Gelatine")) === DIET_KIND.MEAT);

/* Und die Gegenprobe: kurze Stämme dürfen NICHT mitten im Wort
   greifen, sonst wird aus Eistee ein Ei und aus Rinde ein Rind. */
t("Eistee bleibt frei von Ei", () => dietKindOf(idVon("Eistee")) !== DIET_KIND.VEGGIE);
t("Fleischtomaten sind eine Tomate",
  () => dietKindOf(idVon("Fleischtomaten")) === DIET_KIND.PLANT);
t("Erdnussbutter ist keine Butter",
  () => dietKindOf(idVon("Erdnussbutter")) === DIET_KIND.PLANT);
t("Honigmelone ist kein Honig",
  () => dietKindOf(idVon("Honigmelone")) === DIET_KIND.PLANT);
t("Kokosmilch ist keine Milch", () => dietKindOf("kokosmilch") === DIET_KIND.PLANT);
t("Käse-Aufschnitt ist Käse, nicht Wurst",
  () => dietKindOf(idVon("Käse-Aufschnitt")) === DIET_KIND.VEGGIE);

/* Wo der Name nichts hergibt, wird nicht geraten. */
t("Eine Fertigsauce bleibt unklar",
  () => dietKindOf(idVon("Fertigsauce")) === DIET_KIND.UNCLEAR);
t("Ein Sojajoghurt wird nicht fälschlich als tierisch markiert", () => {
  const id = (FOOD_DATABASE.find((p) => /joghurt soja natur/i.test(p.name)) || {}).id;
  if (!id) return true;                       // im Katalog nicht vorhanden: nichts zu prüfen
  return dietKindOf(id) !== DIET_KIND.VEGGIE ? true : "als vegetarisch eingeordnet";
});
t("Nicht-Lebensmittel haben gar keine Einordnung",
  () => dietKindOf("spuelmittel") === null || byId("spuelmittel") === undefined);

t("Kein Produkt der Kategorie Fleisch/Fisch rutscht als vegetarisch durch", () => {
  const falsch = FOOD_DATABASE.filter((p) => p.category === "Fleisch/Fisch" &&
    dietKindOf(p.id) === DIET_KIND.VEGGIE);
  return falsch.length === 0 ? true : falsch.map((p) => p.name).join(", ");
});
t("Jedes Lebensmittel bekommt eine der vier Antworten", () => {
  const gueltig = new Set(Object.values(DIET_KIND));
  const kaputt = FOOD_DATABASE.filter((p) => p.isFood && !gueltig.has(dietKindOf(p.id)));
  return kaputt.length === 0 ? true : kaputt.slice(0, 3).map((p) => p.name).join(", ");
});

// ================================================================
section("B: Passt das zum Profil?");

t("Vegan schließt Milch aus", () => fitsDiet("milch_vollmilch", "vegan") === false);
t("Vegetarisch nicht", () => fitsDiet("milch_vollmilch", "vegetarisch") === true);
t("Beide schließen Fleisch aus",
  () => fitsDiet("hackfleisch", "vegan") === false && fitsDiet("hackfleisch", "vegetarisch") === false);
t("Unklares bekommt kein Urteil, sondern null",
  () => fitsDiet(idVon("Fertigsauce"), "vegan") === null);
t("Ohne Profil passt alles", () => fitsDiet("hackfleisch", null) === true);
t("Proteinreich schließt nichts aus -- es hebt hervor",
  () => fitsDiet("hackfleisch", "proteinreich") === true);
t("Ein unbekanntes Profil ändert nichts", () => fitsDiet("hackfleisch", "quatsch") === true);
t("Es gibt genau drei Profile", () => DIET_PROFILES.length === 3);
t("dietProfileById findet sie", () => dietProfileById("vegan").label === "Vegan");
t("Und liefert für Unsinn null",
  () => dietProfileById("quatsch") === null && dietProfileById(null) === null);

section("Ersatz aus demselben Regal");
t("Für Vollmilch gibt es vegane Alternativen",
  () => dietAlternatives("milch_vollmilch", "vegan").length > 0);
t("Und es sind Drinks, keine Streichfette -- die Packungsgröße entscheidet mit", () => {
  const namen = dietAlternatives("milch_vollmilch", "vegan").map((a) => a.name);
  return /drink/i.test(namen[0]) ? true : namen.join(", ");
});
t("Jede vorgeschlagene Alternative passt wirklich zum Profil", () => {
  const schlecht = dietAlternatives("hackfleisch", "vegetarisch")
    .filter((a) => fitsDiet(a.productId, "vegetarisch") !== true);
  return schlecht.length === 0 ? true : schlecht.map((a) => a.name).join(", ");
});
t("Für etwas Passendes gibt es keinen Ersatz -- die Frage stellt sich nicht",
  () => dietAlternatives("linsen", "vegan").length === 0);
t("Ohne Profil gibt es keine Vorschläge",
  () => dietAlternatives("hackfleisch", null).length === 0);
t("Proteinreich schlägt keinen Ersatz vor",
  () => dietAlternatives("hackfleisch", "proteinreich").length === 0);

// ================================================================
section("C: Anteile aus den eigenen Käufen");

const kaeufe = [
  { productId: "hackfleisch", date: "2026-01-05", quantity: 1, unitPrice: 5 },
  { productId: "milch_vollmilch", date: "2026-01-05", quantity: 2, unitPrice: 1 },
  { productId: "linsen", date: "2026-01-06", quantity: 1, unitPrice: 3 },
  { productId: "spuelmittel", date: "2026-01-06", quantity: 1, unitPrice: 99 }
];

t("Non-Food bleibt außen vor -- Spülmittel hat keine Ernährungsweise", () => {
  const s = dietShares(kaeufe);
  return s.gesamt === 10 ? true : String(s.gesamt);
});
t("Fleisch, Milch und Pflanzliches werden getrennt", () => {
  const s = dietShares(kaeufe);
  return s.euros.fleisch === 5 && s.euros.vegetarisch === 2 && s.euros.pflanzlich === 3
    ? true : JSON.stringify(s.euros);
});
t("Der pflanzliche Anteil stimmt", () => dietShares(kaeufe).prozentPflanzlich === 30);
t("Ein Zeitraum grenzt ein",
  () => dietShares(kaeufe, { from: "2026-01-06" }).euros.fleisch === 0);
t("Ohne Käufe stürzt nichts ab und es wird nichts behauptet", () => {
  const s = dietShares([]);
  return s.gesamt === 0 && s.prozentPflanzlich === null ? true : JSON.stringify(s);
});

/* Der wichtigste Teil: Unklares wird ausgewiesen, nicht verteilt. */
t("Unklares zählt nicht in die Anteile hinein", () => {
  const mitUnklar = [...kaeufe, { productId: idVon("Fertigsauce"), date: "2026-01-07", quantity: 1, unitPrice: 10 }];
  const s = dietShares(mitUnklar);
  return s.prozentPflanzlich === 30 ? true : `${s.prozentPflanzlich} % statt 30 %`;
});
t("Sondern taucht als eigener Betrag auf", () => {
  const mitUnklar = [...kaeufe, { productId: idVon("Fertigsauce"), date: "2026-01-07", quantity: 1, unitPrice: 10 }];
  return dietShares(mitUnklar).euros.unklar === 10;
});
t("Und die Abdeckung sagt, wie viel die Aussage überhaupt trägt", () => {
  const mitUnklar = [...kaeufe, { productId: idVon("Fertigsauce"), date: "2026-01-07", quantity: 1, unitPrice: 10 }];
  return dietShares(mitUnklar).abdeckung === 50;
});

// ================================================================
section("D: Protein");

t("Für Linsen gibt es einen Wert", () => proteinPer100g("linsen") > 0);
t("Für eine Gurke nicht -- und dann wird nichts geschätzt",
  () => proteinPer100g("gurke") === null);
t("Alle Kennungen der Protein-Tabelle gibt es im Katalog", () => {
  const fehlend = Object.keys(PROTEIN_PER_100G).filter((id) => !byId(id));
  return fehlend.length === 0 ? true : "unbekannt: " + fehlend.join(", ");
});

t("Aus Gewicht und Menge wird gerechnet", () => {
  // 500 g Linsen à 24 g/100 g = 120 g Protein
  const p = dietProtein([{ productId: "linsen", date: "2026-01-01", quantity: 1, weightG: 500 }]);
  return p.gramm === 120 ? true : String(p.gramm);
});
t("Die Menge zählt mit", () => {
  const p = dietProtein([{ productId: "linsen", date: "2026-01-01", quantity: 2, weightG: 500 }]);
  return p.gramm === 240 ? true : String(p.gramm);
});
t("Ohne eigenes Gewicht gilt das übliche aus dem Katalog", () => {
  const p = dietProtein([{ productId: "linsen", date: "2026-01-01", quantity: 1 }]);
  return p.gramm > 0 ? true : "nichts gerechnet";
});
t("Was keinen Wert hat, wird gezählt statt geschätzt", () => {
  const p = dietProtein([
    { productId: "linsen", date: "2026-01-01", quantity: 1, weightG: 500 },
    { productId: "gurke", date: "2026-01-01", quantity: 1, weightG: 400 }
  ]);
  return p.mitWert === 1 && p.ohneWert === 1 ? true : `${p.mitWert}/${p.ohneWert}`;
});
t("Je Woche wird durch die Wochen geteilt", () => {
  const p = dietProtein([{ productId: "linsen", date: "2026-01-01", quantity: 1, weightG: 500 }], { wochen: 4 });
  return p.grammProWoche === 30 ? true : String(p.grammProWoche);
});
t("Null Wochen führen nicht zu einer Division durch null", () => {
  const p = dietProtein([{ productId: "linsen", date: "2026-01-01", quantity: 1, weightG: 500 }], { wochen: 0 });
  return Number.isFinite(p.grammProWoche);
});
t("Die stärksten Quellen werden genannt", () => {
  const p = dietProtein([
    { productId: "linsen", date: "2026-01-01", quantity: 1, weightG: 500 },
    { productId: "joghurt_natur", date: "2026-01-01", quantity: 1, weightG: 500 }
  ]);
  return p.top[0].productId === "linsen" ? true : JSON.stringify(p.top);
});
t("Und die Rechnung sagt selbst, was sie ist",
  () => /Referenzwerte/.test(dietProtein([]).hinweis));

// ================================================================
section("E: Ohne Profil passiert nichts");
/* Die Garantie, die „rein optional" wahr macht. Sie steht hier und
   nicht nur in der Oberfläche: keine dieser Funktionen darf ohne
   gewähltes Profil ein Urteil fällen. */

t("fitsDiet gibt ohne Profil immer true zurück", () => {
  const alle = ["hackfleisch", "milch_vollmilch", "linsen", "eier"];
  return alle.every((id) => fitsDiet(id, null) === true &&
    fitsDiet(id, undefined) === true && fitsDiet(id, "") === true);
});
t("dietAlternatives schlägt ohne Profil nichts vor", () => {
  const alle = ["hackfleisch", "milch_vollmilch", "eier"];
  return alle.every((id) => dietAlternatives(id, null).length === 0);
});
t("dietKindOf urteilt zwar, aber ändert nichts -- es ist eine reine Auskunft", () => {
  const vorher = JSON.stringify(byId("hackfleisch"));
  dietKindOf("hackfleisch");
  return JSON.stringify(byId("hackfleisch")) === vorher;
});
t("Kaputte Eingaben stürzen nirgends ab", () => {
  dietKindOf(null); dietKindOf(undefined); dietKindOf("gibtsnicht");
  fitsDiet(null, "vegan"); dietAlternatives(null, "vegan");
  dietShares(null); dietShares(undefined);
  dietProtein(null); dietProtein(undefined);
  return true;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`ERNÄHRUNG: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
