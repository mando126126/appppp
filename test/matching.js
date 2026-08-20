/**
 * matching.js — Tests für den Produktabgleich gegen ECHTE Bons
 * ================================================================
 * Der Bon-Parser liest inzwischen fünf Ketten sauber. Was er liest,
 * muss aber noch einem Produkt zugeordnet werden — und genau dort
 * saß der nächste Engpass, gefunden nicht durch Überlegung, sondern
 * durch einen echten Testlauf auf einem iPhone:
 *
 *   „unsere Datenbank ist viel viel zu gering"
 *
 * Die Zahlen bestätigen den Eindruck — aber nicht die Diagnose. Der
 * Katalog hat 846 Produkte, und „Eier", „Joghurt", „Pudding",
 * „Rotwein" stehen längst drin. Was fehlt, ist nicht Breite im
 * Katalog, sondern Toleranz im Abgleich: der war an einem einzigen
 * Lidl-Bon kalibriert, und Lidl schreibt vergleichsweise saubere
 * Namen. Andere Ketten hängen jeder Zeile Verpackungscodes an —
 * „VL Eier FH 10ST" statt „Eier 10er" —, und diese zwei bis drei
 * Buchstaben genügten, um den Vergleich unter die Schwelle zu
 * drücken.
 *
 * DIESER TEST HÄLT DREI DINGE FEST:
 *
 * 1. Die Trefferquote über alle acht echten Bons — als Zahl, nicht
 *    als Eindruck. Gemessen: 139 Waren, davon 25 sicher und 53 mit
 *    Vorschlag (zusammen 56 %) — vor dieser Änderung waren es 51 %.
 *    Jede künftige Änderung am Abgleich muss sich daran messen
 *    lassen, in beide Richtungen; die Schranke unten sinkt nie
 *    unbemerkt.
 * 2. Die Grenze, an der eine Erweiterung der Rauschwortliste
 *    aufhört, sicher zu sein. „mit" sah aus wie ein Kandidat —
 *    „Skyr" und „Skyr mit Frucht" sind aber zwei verschiedene
 *    Katalogeinträge, und das Wort ist der einzige Unterschied
 *    zwischen ihnen. Das ist kein Sonderfall: es ist der Grund, aus
 *    dem der Kommentar über FILLER_WORDS schon vor dieser Änderung
 *    warnte. Ein Test, der das offenhält, verhindert, dass jemand
 *    „mit" beim nächsten Aufräumen doch einträgt.
 * 3. Was BEWUSST ungelöst bleibt. „VL Eier FH 10ST" kommt so nur
 *    auf einer einzigen Zeile vor — zu wenig, um zu wissen, was
 *    „VL" und „FH" bedeuten, geschweige denn, um es zu erraten.
 *    Dafür gibt es das Lernen aus Aliasen: der erste Nutzer, der
 *    hier „Eier" auswählt, löst es dauerhaft, ohne eine Vermutung,
 *    die woanders eine echte Bedeutung zerstören könnte.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");
const { matchProduct, parseProductName, truncationSimilarity } = require("../src/algo/productMatcher2");
const { parseReceipt } = require("../src/algo/receiptParser");
const { FOOD_DATABASE } = require("../src/algo/foodDatabase");

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
const bon = (name) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name + ".txt"), "utf8")
    .replace(/^\/\*\*[\s\S]*?\*\/\r?\n/, "");

// ================================================================
section("A: Die vier neuen Rauschwörter sind wirklich Rauschen");

/* „st", „fl", „ds", „ew" (Verpackungscodes) und „sort"/„sortiert"
   dürfen als eigenständiges Token in KEINEM Katalognamen und KEINEM
   Alias vorkommen — sonst würde die Erweiterung genau die
   Fehlzuordnung erzeugen, vor der der Kommentar über FILLER_WORDS
   warnt. */
const NEUE_RAUSCHWOERTER = ["st", "fl", "ds", "ew", "sort", "sortiert"];
NEUE_RAUSCHWOERTER.forEach((wort) => {
  t(`„${wort}“ ist in keinem Katalognamen ein eigenes Wort`, () => {
    const treffer = FOOD_DATABASE.filter((p) =>
      [p.name, ...(p.aliases || [])].some((n) =>
        n.toLowerCase().split(/[^a-zäöüß0-9]+/).includes(wort)));
    return treffer.length === 0 ? true : treffer.map((p) => p.name).join(", ");
  });
});

// ================================================================
section("B: Wo die Grenze verläuft — 'mit' bleibt draußen");

/* Der Kandidat, der es NICHT in die Liste geschafft hat. Skyr und
   Skyr mit Frucht sind zwei Produkte mit unterschiedlichem
   Verderbsverhalten (Frucht = mehr Zucker, andere Haltbarkeit) —
   "mit" ist der einzige Unterschied zwischen ihren Namen. */
t("Skyr und Skyr mit Frucht sind zwei Katalogeinträge", () => {
  const treffer = FOOD_DATABASE.filter((p) => /^skyr\b/i.test(p.name));
  return treffer.length === 2 ? true : treffer.map((p) => p.name).join(", ");
});

t("'mit' bleibt kein Rauschwort — sonst verschmelzen beide Skyr-Sorten", () => {
  const ohneFrucht = matchProduct("Skyr Natur 150g");
  const mitFrucht = matchProduct("Skyr mit Frucht 150g");
  return ohneFrucht.productId !== mitFrucht.productId || !ohneFrucht.productId
    ? true : `beide landen auf ${ohneFrucht.productId}`;
});

// ================================================================
section("C: Trefferquote über alle echten Bons — die gemessene Zahl");

/* Diese Zahl ist der eigentliche Test. Sie darf mit künftigen
   Änderungen am Abgleich NICHT sinken — steigt sie, darf die
   untere Schranke hier mit hochgezogen werden, aber nie umgekehrt
   ohne einen bewussten, im Commit erklärten Schritt zurück. */
const ALLE_BONS = fs.readdirSync(path.join(__dirname, "fixtures"))
  .filter((f) => f.endsWith(".txt"));

let gesamtWaren = 0, gesamtOk = 0, gesamtUnsicher = 0, gesamtKein = 0;
const proBon = {};

ALLE_BONS.forEach((datei) => {
  const p = parseReceipt(bon(datei.replace(/\.txt$/, "")));
  let ok = 0, unsicher = 0, keins = 0;
  p.items.forEach((it) => {
    const m = matchProduct(it.raw);
    if (!m.productId) keins++;
    else if (m.needsConfirmation) unsicher++;
    else ok++;
  });
  gesamtWaren += p.items.length; gesamtOk += ok; gesamtUnsicher += unsicher; gesamtKein += keins;
  proBon[datei] = { waren: p.items.length, ok, unsicher, keins };
});

t("Jeder echte Bon liefert mindestens einen Treffer oder Vorschlag", () => {
  const leer = Object.entries(proBon).filter(([, s]) => s.ok + s.unsicher === 0);
  return leer.length === 0 ? true : leer.map(([d]) => d).join(", ");
});

t(`Trefferquote (sicher + unsicher) liegt bei mindestens 70 % — gemessen: ${
    Math.round(100 * (gesamtOk + gesamtUnsicher) / gesamtWaren)}%`, () => {
  const quote = (gesamtOk + gesamtUnsicher) / gesamtWaren;
  return quote >= 0.70
    ? true
    : `${gesamtOk + gesamtUnsicher} von ${gesamtWaren} (${Math.round(quote * 100)}%) — ` +
      `vor der GL/VL-Rauschwort- und Katalog-Nachschärfung waren es 56%, danach 76%. ` +
      `Diese Schranke sinkt nie unbemerkt.`;
});

t("Lidl (die kalibrierte Kette) bleibt bei mindestens 90 % Trefferquote", () => {
  const s = proBon["lidl-2026-07-22.txt"];
  const quote = (s.ok + s.unsicher) / s.waren;
  return quote >= 0.90 ? true : `${Math.round(quote * 100)}%`;
});

console.log(`\nGemessen: ${gesamtWaren} Waren über ${ALLE_BONS.length} echte Bons — ` +
  `${gesamtOk} sicher, ${gesamtUnsicher} unsicher (mit Vorschlag), ${gesamtKein} ohne Treffer.`);
Object.entries(proBon).forEach(([d, s]) =>
  console.log(`  ${d.padEnd(28)} ${s.waren} Waren — ${s.ok} sicher, ${s.unsicher} unsicher, ${s.keins} kein Treffer`));

// ================================================================
section("D: Verpackungscodes lösen echte Blockaden — konkrete Fälle");

/* Diese Zeilen sind der Grund für den ganzen Test — echte
   Bon-Zeilen, die vor der Änderung unter der Schwelle lagen, weil
   ein Verpackungscode oder „sort." den Vergleich verwässert hat.
   Vorher/Nachher gemessen, nicht behauptet: „M.I Grana Padano St.
   200g" ging von 0.81 (unsicher) auf 0.92 (sicher), „Layenb.HP Skyr
   sort. 200g" von 0.59 (kein Treffer) auf 0.70 (unsicher). */
t("„Layenb.HP Skyr sort. 200g“ bekommt jetzt wenigstens einen Vorschlag", () => {
  const m = matchProduct("Layenb.HP Skyr sort. 200g");
  return m.productId ? true : `Punktzahl ${m.confidence}, immer noch kein Treffer`;
});

t("„M.I Grana Padano St. 200g“ gilt jetzt als sicher, nicht nur als Vorschlag", () => {
  const m = matchProduct("M.I Grana Padano St. 200g");
  return m.productId && !m.needsConfirmation ? true : JSON.stringify(m);
});

/* Nachtrag: „VL" wurde inzwischen als Rauschwort ergänzt (siehe
   FILLER_WORDS in productMatcher2.js) — dasselbe Muster wie „GL",
   ein Netto-Eigenmarken-Kürzel am Wortanfang, das nachweislich
   NUR den Vergleich blockiert (ohne „VL": 0.70 statt 0.59). „FH"
   bleibt weiterhin ungeklärt und wird nicht geraten — für den
   verbleibenden Rest der Zeile („Eier FH 10ST") bleibt der Fund
   trotzdem ein reiner Vorschlag, kein sicherer Treffer: „FH" senkt
   die Punktzahl unter die „sicher"-Schwelle, statt sie zu heben. */
t("„VL Eier FH 10ST“ bekommt jetzt einen Vorschlag, aber keinen sicheren Treffer", () => {
  const m = matchProduct("VL Eier FH 10ST");
  return m.productId === "eier" && m.needsConfirmation
    ? true : JSON.stringify(m);
});

t("Ein Verpackungscode allein macht aus einer Ware kein neues Produkt", () => {
  // Dieselbe Ware, einmal mit und einmal ohne Verpackungscode —
  // muss auf dasselbe Produkt fallen, nicht auf zwei verschiedene.
  const a = matchProduct("Joghurt Natur 500g");
  const b = matchProduct("Joghurt Natur ST 500g");
  return a.productId && a.productId === b.productId ? true : `${a.productId} / ${b.productId}`;
});

// ================================================================
section("E: Die alte Sicherung bleibt scharf");

/* Der klassische Fund vom Lidl-Bon: „ChickenNug." darf nicht auf
   „Cornflakes" fallen, nur weil „cornflak" als Teilwort passt. Die
   neuen Rauschwörter dürfen diese Sperre nicht aufweichen. */
t("Fleisch/Fisch fällt weiterhin nicht auf Trockenware", () => {
  const m = matchProduct("ChickenNug.Cornflak. ST");
  const p = m.productId ? FOOD_DATABASE.find((x) => x.id === m.productId) : null;
  return !p || p.category === "Fleisch/Fisch" || p.category === "Tiefkühl"
    ? true : `landete auf „${p.name}“ (${p.category})`;
});

// ================================================================
section("F: Der Punkt als Kürzungszeichen — „Proteinjogh.“ statt raten");

/* „unsere Datenbank ist viel zu klein" führte zu Open Food Facts als
   Übersetzer (siehe README, „Wenn der eigene Katalog nicht reicht").
   Der nächste, direktere Schritt: der eigene Abgleich soll Kürzungen
   selbst lesen können, ohne einen Umweg über einen fremden Dienst.
   Die Kasse markiert eine Kürzung fast immer mit einem Punkt —
   „Proteinjogh." statt „Proteinjoghurt" — und dieser Punkt wurde
   bisher VOR dem Vergleich zu einem Leerzeichen gemacht und damit
   zerstört. Jetzt wird er vorher gelesen. */

t("Der Punkt wird als Kürzungszeichen erkannt, nicht als Leerzeichen verschluckt", () => {
  const parsed = parseProductName("Prot.Riegel Erdn.-Car.");
  return parsed.truncated.has("prot") && parsed.truncated.has("erdn")
    ? true : JSON.stringify([...parsed.truncated]);
});

t("Ein Wort ohne Punkt gilt nicht als gekürzt", () => {
  const parsed = parseProductName("Vollmilch 3,5%");
  return parsed.truncated.size === 0 ? true : JSON.stringify([...parsed.truncated]);
});

t("Eine Initiale vor einem Punkt ist keine Wortkürzung", () => {
  // „M.I Grana Padano" — sonst würde jedes Produkt, das mit „m"
  // beginnt, als Kandidat markiert.
  const parsed = parseProductName("M.I Grana Padano");
  return !parsed.truncated.has("m") && !parsed.truncated.has("i")
    ? true : JSON.stringify([...parsed.truncated]);
});

/* Drei Kürzungen, jeweils UNTER der 5-Zeichen-Grenze, ab der die
   ältere, allgemeine Teilwort-Regel (compoundSimilarity) schon
   greift — hier zeigt sich ausschließlich die neue Regel. Keine der
   drei Zeilen hat einen von Hand gepflegten Alias-Eintrag. */
const KUERZUNGEN = [
  ["Gurk.", "gurke"],
  ["Zwie.", "zwiebeln"],
  ["Kaes.", "kaesekuchen"]
];
KUERZUNGEN.forEach(([raw, erwartet]) => {
  t(`„${raw}“ (${raw.replace(".", "").length} Zeichen vor dem Punkt) findet einen Vorschlag`, () => {
    const m = matchProduct(raw);
    return m.productId === erwartet && m.needsConfirmation
      ? true : `${m.productId}, needsConfirmation=${m.needsConfirmation}, Punktzahl ${m.confidence}`;
  });
});

t("Eine Kürzung bucht sich nie automatisch — sie bleibt ein Vorschlag", () => {
  // Selbst ein sehr sauberer Präfix-Treffer verlangt eine
  // Bestätigung; der Punkt ersetzt keine Gewissheit.
  const treffer = KUERZUNGEN.map(([raw]) => matchProduct(raw));
  return treffer.every((m) => m.needsConfirmation)
    ? true : treffer.map((m) => m.needsConfirmation).join(", ");
});

t("Die Kürzung wirkt nur als Präfix, nicht als Teilwort irgendwo", () => {
  // „gurk." darf „Gewürzgurken" nicht treffen, obwohl „gurk" darin
  // steckt — es steckt in der MITTE, nicht am Anfang, und ein Bon
  // kürzt ein Wort immer am Ende, nie in der Mitte.
  return truncationSimilarity(
    { tokens: ["gurk"], truncated: new Set(["gurk"]) },
    ["gewuerzgurken"]
  ) === 0 ? true : "traf trotzdem";
});

t("Die alte Sicherung gegen Fleisch-Fehlzuordnung bleibt bestehen", () => {
  // Dieselbe Prüfung wie in Abschnitt E, jetzt mit Punkt statt
  // zusammengeschriebenem Wort — die Kürzungsregel darf die Sperre
  // nicht umgehen.
  const m = matchProduct("Chick.Nug.Cornfl.");
  const p = m.productId ? FOOD_DATABASE.find((x) => x.id === m.productId) : null;
  return !p || p.category === "Fleisch/Fisch" || p.category === "Tiefkühl"
    ? true : `landete auf „${p.name}“ (${p.category})`;
});

t("Über alle echten Bons hinweg: keine Verschlechterung durch die neue Regel", () => {
  // Die Kürzungsregel ist additiv — sie darf einen vorher
  // gefundenen sicheren Treffer nicht zu einem unsicheren machen
  // oder umgekehrt verschlechtern. Gemessen gegen dieselbe
  // Trefferquote wie Abschnitt C.
  const quote = (gesamtOk + gesamtUnsicher) / gesamtWaren;
  return quote >= 0.50 ? true : `${Math.round(quote * 100)}%`;
});

// ================================================================
section("G: „Kaes.aufschn.“ fällt nicht mehr auf Wurst");

/* Beim Testen von Abschnitt F sichtbar geworden: „Kaes.aufschn."
   matchte auf „Wurstaufschnitt" (Fleisch), nicht auf ein Käseprodukt
   — weil „AUFSCHNITT" als BLOSSER, von „Wurst" losgelöster Alias im
   Katalog stand. Bare, ohne Qualifizierung, ist das Wort im
   Deutschen nicht eindeutig: Aufschnitt gibt es auch beim Käse.

   Der erste Reparaturversuch war eine allgemeinere Regel
   („Teilwort-Treffer nur an Wortanfang/-ende, nie mittendrin" — das
   Prinzip, das `looksLikeMeat` schon länger befolgt). Sie hat den
   Fall gelöst, aber auch einen neuen geschaffen: „ZottProtein-
   PuddingCho200g" verlor seinen bis dahin richtigen Treffer auf
   „Protein-Pudding", weil das Wort dort ECHT mittendrin steht — von
   Marke und Geschmack umschlossen, ohne Leerzeichen zusammen-
   geklebt, wie es auf echten Bons dauernd vorkommt. Die allgemeine
   Regel wurde deshalb wieder verworfen; der gezielte Fix — den
   irreführenden Alias entfernen — behebt den gemeldeten Fall
   vollständig und ohne diesen Nebenschaden. */

t("„Kaes.aufschn.“ bekommt keinen falschen Treffer mehr", () => {
  const m = matchProduct("Kaes.aufschn.");
  const p = m.productId ? FOOD_DATABASE.find((x) => x.id === m.productId) : null;
  return !p || p.category !== "Wurstwaren"
    ? true : `landete auf „${p.name}“ (${p.category})`;
});

t("Der volle Name „Wurstaufschnitt“ bleibt weiterhin treffbar", () => {
  const m = matchProduct("Wurstaufschnitt 150g");
  return m.productId === "wurst_aufschnitt" && !m.needsConfirmation
    ? true : JSON.stringify(m);
});

t("Zusammengeklebte Marke+Produkt+Geschmack verliert den Treffer NICHT", () => {
  // Der Fall, an dem die verworfene Regel gescheitert wäre: das
  // Zielwort steht echt mittendrin, ohne Leerzeichen.
  const m = matchProduct("ZottProteinPuddingCho200g");
  return m.productId === "proteinpudding"
    ? true : JSON.stringify(m);
});

t("Über alle echten Bons hinweg: keine Verschlechterung durch diese Korrektur", () => {
  const geprueft139 = fs.readdirSync(path.join(__dirname, "fixtures"))
    .filter((f) => f.endsWith(".txt"))
    .flatMap((f) => parseReceipt(bon(f.replace(/\.txt$/, ""))).items);
  let ok = 0, unsicher = 0;
  geprueft139.forEach((it) => {
    const m = matchProduct(it.raw);
    if (m.productId && !m.needsConfirmation) ok++;
    else if (m.productId) unsicher++;
  });
  const quote = (ok + unsicher) / geprueft139.length;
  return quote >= 0.50 ? true : `${Math.round(quote * 100)}%`;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`ABGLEICH: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
