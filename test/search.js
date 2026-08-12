/**
 * search.js — Tests für die Tippsuche
 * ================================================================
 * Die Suche ist die einzige Stelle, an der ein Mensch dem Katalog
 * direkt begegnet. Wenn sie danebenliegt, merkt er es sofort — und
 * anders als beim Bonabgleich gibt es keine zweite Chance über eine
 * Rückfrage: was nicht in den ersten Treffern steht, existiert für
 * ihn nicht.
 *
 * Geprüft wird deshalb nicht „findet irgendwas“, sondern:
 *
 *   A) Erwartungen  — was ein Mensch tippt und was oben stehen muss
 *   B) Rangordnung  — dass die deutschen Komposita richtig fallen
 *   C) Robustheit   — Müll, Leerzeichen, 10.000 Zufallsanfragen
 *   D) Anbindung    — dass die Oberfläche wirklich hier landet
 *
 * Der wichtigste Test ist B: „milch“ darf nicht Milchreis zuerst
 * zeigen. Das ist keine Feinheit, sondern der Unterschied zwischen
 * einer Suche, die deutsch kann, und einer, die Zeichen zählt.
 * ================================================================
 */

const {
  findProducts, searchNorm, rankEntry, buildSearchIndex, resetSearchIndex,
  RANK, MIN_FUZZY_LENGTH
} = require("../src/algo/productSearch");
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

function section(title) {
  console.log(`\n--- ${title} ---`);
}

/** Namen der Treffer, für lesbare Fehlermeldungen. */
const namesOf = (query, limit = 8) => findProducts(query, limit).map((p) => p.name);

/** Steht ein Produktname in den ersten `n` Treffern? */
function within(query, needle, n) {
  const names = namesOf(query, n);
  return names.some((x) => x.toLowerCase().includes(needle.toLowerCase()));
}

// ================================================================
section("A: Was Menschen tippen");

/* Die Liste ist bewusst als Erwartung geschrieben, nicht als
   Momentaufnahme: „ban“ muss Bananen finden, egal wie der Katalog
   sonst wächst. Jede Zeile ist ein echter Anfang, den jemand auf
   einer Telefontastatur tippt, bevor er das Wort zu Ende denkt. */
const ERWARTET = [
  ["ban", "Banane"],
  ["milch", "Milch"],
  ["brot", "Brot"],
  ["butter", "Butter"],
  ["ei", "Eier"],
  ["kaese", "Käse"],
  ["käse", "Käse"],
  ["jog", "Joghurt"],
  ["toma", "Tomate"],
  ["kartof", "Kartoffel"],
  ["nudel", "Nudel"],
  ["reis", "Reis"],
  ["apfel", "Apfel"],
  ["zwiebel", "Zwiebel"],
  ["hack", "Hackfleisch"],
  ["haehnchen", "Hähnchen"],
  ["oel", "öl"],
  ["zucker", "Zucker"],
  ["mehl", "Mehl"],
  ["kaffee", "Kaffee"],
  ["bier", "Bier"],
  ["klopapier", "Toilettenpapier"],
  ["spuel", "Spül"],
  ["zahn", "Zahn"],
  ["katzen", "Katzen"],
  ["windel", "Windel"],
  ["schoko", "Schoko"],
  ["salat", "Salat"],
  ["gurke", "Gurke"],
  ["saft", "saft"]
];

ERWARTET.forEach(([q, erwartet]) => {
  t(`„${q}“ findet ${erwartet}`, () => {
    if (within(q, erwartet, 8)) return true;
    return `stattdessen: ${namesOf(q, 5).join(", ") || "nichts"}`;
  });
});

t("Ein einzelnes Zeichen liefert schon etwas", () => {
  const r = findProducts("m", 5);
  return r.length > 0 ? true : "keine Treffer für „m“";
});

t("Der ganze Produktname findet sich selbst an erster Stelle", () => {
  // Stichprobe über den Katalog, nicht nur ein Beispiel.
  const schritt = Math.max(1, Math.floor(FOOD_DATABASE.length / 120));
  let fehl = 0;
  const beispiele = [];
  for (let i = 0; i < FOOD_DATABASE.length; i += schritt) {
    const p = FOOD_DATABASE[i];
    const treffer = findProducts(p.name, 3);
    if (!treffer.length || treffer[0].id !== p.id) {
      fehl++;
      if (beispiele.length < 5) {
        beispiele.push(`„${p.name}“ -> ${treffer[0] ? treffer[0].name : "nichts"}`);
      }
    }
  }
  return fehl === 0 ? true : `${fehl} Namen finden sich nicht selbst: ${beispiele.join("; ")}`;
});

t("Jedes Produkt ist über seinen Namen überhaupt erreichbar", () => {
  // Schwächer als der Test davor (Platz 1), aber über den GANZEN
  // Katalog: nichts darf unauffindbar sein.
  let fehl = 0;
  const beispiele = [];
  for (const p of FOOD_DATABASE) {
    const treffer = findProducts(p.name, 12);
    if (!treffer.some((x) => x.id === p.id)) {
      fehl++;
      if (beispiele.length < 5) beispiele.push(p.name);
    }
  }
  return fehl === 0 ? true : `${fehl} unauffindbar: ${beispiele.join(", ")}`;
});

// ================================================================
section("B: Rangordnung — deutsche Komposita");

t("„milch“ zeigt Milch vor Milchreis", () => {
  const namen = namesOf("milch", 12);
  const milch = namen.findIndex((n) => /milch/i.test(n) && !/reis|schnitte|brot/i.test(n));
  const reis = namen.findIndex((n) => /milchreis/i.test(n));
  if (milch === -1) return "gar keine Milch gefunden";
  if (reis !== -1 && reis < milch) return `Milchreis (${reis}) vor Milch (${milch}): ${namen.join(", ")}`;
  return true;
});

t("„brot“ zeigt Brote, nicht nur Brotaufstrich", () => {
  const namen = namesOf("brot", 6);
  const echteBrote = namen.filter((n) => /brot$/i.test(n.replace(/[,(].*$/, "").trim()));
  return echteBrote.length >= 2 ? true : `nur: ${namen.join(", ")}`;
});

t("Ein ganzes Wort schlägt einen Wortanfang", () => {
  const eintrag = (name) => ({
    product: { id: "x", name },
    name: searchNorm(name),
    words: searchNorm(name).split(" "),
    aliases: [], aisle: "", category: ""
  });
  const ganz = rankEntry(eintrag("Reis"), "reis");
  const anfang = rankEntry(eintrag("Reissirup"), "reis");
  if (!ganz || !anfang) return "einer der beiden trifft gar nicht";
  return ganz.rank < anfang.rank ? true : `${ganz.rank} nicht besser als ${anfang.rank}`;
});

t("Der kürzere Name gewinnt bei gleichem Rang", () => {
  const namen = namesOf("apfel", 5);
  const kurz = namen.findIndex((n) => /^äpfel|^apfel/i.test(n) && n.length < 12);
  return kurz <= 1 ? true : `kurze Form erst an Stelle ${kurz + 1}: ${namen.join(", ")}`;
});

t("Was der Haushalt schon kauft, steht bei gleichem Rang vorn", () => {
  // Bewusst mit eigenem Katalog: beide Namen enthalten „test“ als
  // ganzes Wort, stehen also auf derselben Stufe. Nur dort darf die
  // Gewohnheit entscheiden — über Stufen hinweg nicht, sonst schöbe
  // eine alte Kondensmilch die H-Milch beiseite, nur weil sie einmal
  // gekauft wurde.
  const eigen = [
    { id: "a", name: "Aaa Test", aliases: [], aisle: "Test", category: "test" },
    { id: "b", name: "Bbb Test", aliases: [], aisle: "Test", category: "test" }
  ];
  const ohne = findProducts("test", 5, { catalog: eigen });
  const mit = findProducts("test", 5, { catalog: eigen, boost: new Set(["b"]) });
  resetSearchIndex();
  if (ohne[0].id !== "a") return `ohne Vorzug schon falsch: ${ohne.map((p) => p.id)}`;
  return mit[0].id === "b" ? true : `Vorzug wirkt nicht: ${mit.map((p) => p.id)}`;
});

t("Der Vorzug verschiebt keine Stufen", () => {
  const namen = namesOf("milch", 12);
  const letzte = findProducts("milch", 12);
  const mit = findProducts("milch", 12, { boost: new Set([letzte[letzte.length - 1].id]) });
  // Dieselben Produkte, nur andere Reihenfolge — nichts fällt raus.
  const a = new Set(letzte.map((p) => p.id));
  const b = new Set(mit.map((p) => p.id));
  if (a.size !== b.size || [...a].some((id) => !b.has(id))) {
    return `Trefferliste verändert: ${namen.join(", ")}`;
  }
  return true;
});

t("Der Vorzug erfindet keine Treffer", () => {
  // Ein Produkt, das gar nicht passt, darf durch `boost` nicht
  // plötzlich auftauchen — sonst schlägt die Gewohnheit die Absicht.
  const treffer = findProducts("banane", 8, { boost: new Set(["reis"]) });
  return treffer.some((p) => p.id === "reis") ? "Reis erscheint bei „banane“" : true;
});

// ================================================================
section("C: Vertippt, Umlaute, Müll");

t("„jogurt“ (ohne h) findet Joghurt", () => within("jogurt", "Joghurt", 8) || `nichts: ${namesOf("jogurt", 5)}`);
t("„youghurt“ bleibt erfolglos statt falsch", () => {
  // Zu weit weg — hier ist Schweigen besser als ein Zufallstreffer.
  const r = namesOf("youghurt", 3);
  return r.every((n) => !/reis|brot|wurst/i.test(n)) ? true : `absurd: ${r.join(", ")}`;
});

t("Der erste Buchstabe muss stimmen — „spargel“ wird nicht zu Haargel", () => {
  const namen = namesOf("spargel", 8);
  return namen.some((n) => /haargel/i.test(n)) ? `Haargel bei „spargel“: ${namen.join(", ")}` : true;
});

t("Unter vier Zeichen wird nicht geraten", () => {
  // „bir“ ist kein Anfang von „Reis“ und kein Wort darin — wenn es
  // trotzdem trifft, hat der Tippfehler-Ausgleich zu früh gegriffen.
  const eintrag = {
    product: { id: "x", name: "Reis" }, name: "reis", words: ["reis"],
    aliases: [], aisle: "", category: ""
  };
  for (const kurz of ["rex", "rix", "rai"]) {
    if (kurz.length >= MIN_FUZZY_LENGTH) return "Testeingabe zu lang";
    const r = rankEntry(eintrag, kurz);
    if (r) return `„${kurz}“ trifft „Reis“ mit Rang ${r.rank}`;
  }
  return true;
});

t("Umlaute, ß und Großschreibung sind gleichwertig", () => {
  const formen = ["Käse", "kaese", "KAESE", "  käse  "];
  const ids = formen.map((f) => findProducts(f, 5).map((p) => p.id).join("|"));
  return new Set(ids).size === 1 ? true : `verschiedene Ergebnisse: ${ids.join(" / ")}`;
});

t("searchNorm faltet, was gefaltet werden muss", () => {
  const f = searchNorm("Crème fraîche 30% – Größe!");
  return /^creme fraiche 30 groesse$/.test(f) || `unerwartet: „${f}“`;
});

const MUELL = ["", "   ", null, undefined, 0, false, [], {}, "!!!", "@@@ ###", "\n\t", "🍌", "-", "42"];
t("Müll führt zu leerem Ergebnis, nicht zum Absturz", () => {
  for (const m of MUELL) {
    const r = findProducts(m);
    if (!Array.isArray(r)) return `kein Array für ${JSON.stringify(m)}`;
  }
  return true;
});

t("Eine sehr lange Eingabe bleibt harmlos", () => {
  const r = findProducts("a".repeat(5000));
  return Array.isArray(r) && r.length === 0 ? true : `${r.length} Treffer für 5000 Zeichen`;
});

t("Die Grenze wird eingehalten", () => {
  for (const limit of [1, 3, 12, 50]) {
    const r = findProducts("e", limit);
    if (r.length > limit) return `${r.length} Treffer bei limit=${limit}`;
  }
  const nullLimit = findProducts("e", 0);
  return nullLimit.length >= 1 ? true : "limit=0 liefert gar nichts";
});

t("Keine Dubletten in den Treffern", () => {
  for (const q of ["milch", "brot", "e", "a", "sa", "wasser"]) {
    const ids = findProducts(q, 12).map((p) => p.id);
    if (new Set(ids).size !== ids.length) return `Dublette bei „${q}“`;
  }
  return true;
});

t("Jeder Treffer ist ein echtes Katalogprodukt", () => {
  for (const q of ["milch", "brot", "zahn", "katzen", "e"]) {
    for (const p of findProducts(q, 12)) {
      if (!p || !p.id || !byId(p.id)) return `Fremdkörper bei „${q}“: ${JSON.stringify(p)}`;
      if (!p.name || !p.aisle) return `unvollständig: ${p.id}`;
    }
  }
  return true;
});

t("10.000 Zufallsanfragen stürzen nicht ab", () => {
  // Fester Startwert: ein Fehlschlag ist morgen derselbe Fehlschlag.
  let seed = 20260812;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const zeichen = "abcdefghijklmnopqrstuvwxyzäöüß 0123456789-.,!";
  for (let i = 0; i < 10000; i++) {
    const len = 1 + Math.floor(rnd() * 12);
    let q = "";
    for (let j = 0; j < len; j++) q += zeichen[Math.floor(rnd() * zeichen.length)];
    const r = findProducts(q, 8);
    if (!Array.isArray(r) || r.length > 8) return `Anfrage „${q}“: ${r && r.length}`;
  }
  return true;
});

// ================================================================
section("D: Geschwindigkeit und Index");

t("Eine Suche bleibt unter fünf Millisekunden", () => {
  const anfragen = ["b", "ba", "ban", "bana", "milch", "vollkorn", "sch", "e", "toma", "kaese"];
  const start = Date.now();
  const runden = 200;
  for (let i = 0; i < runden; i++) findProducts(anfragen[i % anfragen.length], 12);
  const proAnfrage = (Date.now() - start) / runden;
  return proAnfrage < 5 ? true : `${proAnfrage.toFixed(2)} ms je Anfrage`;
});

t("Der Index wird nur einmal gebaut", () => {
  resetSearchIndex();
  const erst = Date.now();
  findProducts("milch");
  const kalt = Date.now() - erst;
  const zweit = Date.now();
  for (let i = 0; i < 50; i++) findProducts("milch");
  const warm = (Date.now() - zweit) / 50;
  return warm <= kalt + 1 ? true : `warm (${warm}) langsamer als kalt (${kalt})`;
});

t("Ein eigener Katalog wird respektiert", () => {
  const eigen = [
    { id: "x1", name: "Testware", aliases: ["tw"], aisle: "Test", category: "test" },
    { id: "x2", name: "Zweitware", aliases: [], aisle: "Test", category: "test" }
  ];
  const r = findProducts("test", 5, { catalog: eigen });
  resetSearchIndex();   // sonst bleibt der Testkatalog stehen
  return r.length && r[0].id === "x1" ? true : `unerwartet: ${JSON.stringify(r)}`;
});

t("Nach resetSearchIndex ist der echte Katalog wieder da", () => {
  const r = findProducts("banane", 3);
  return r.length && byId(r[0].id) ? true : "echter Katalog nicht wiederhergestellt";
});

/* Die Anbindung an die Oberfläche — dass ein Tippen im Hinzufügen-
   Blatt hier landet und der Treffer als echtes Produkt in der Liste
   ankommt — steht in uitest.js, weil dafür das gebaute Bündel im
   Browserkontext laufen muss. */

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`SUCHE: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
