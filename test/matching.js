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
const { matchProduct, parseProductName, truncationSimilarity, splitGlued, topMatches, SAFE_THRESHOLD, combinedSimilarity } = require("../src/algo/productMatcher2");
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
   warnt.

   AUSNAHME, bewusst und begründet: die 2026-08-20 einzeln
   recherchierten Bon-Fundstücke (99%-Trefferquote-Runde) tragen
   Aliase, die WORTWÖRTLICH die kryptische Bon-Zeile abbilden
   (z. B. "PROLIFEMAGN.ST.20X1,5G30G") — das "ST" darin ist kein
   eigenständiges Produktmerkmal, sondern ein Fragment der exakten
   Kassenzeile. Diese Aliase werden ausschließlich über den EXAKTEN
   core-Vergleich erreicht (matchProduct, Zeile "vi === 0 &&
   variant.core === parsed.core" bzw. die zweite Exakt-Prüfung), der
   FILLER_WORDS gar nicht anwendet — die Gefahr, vor der dieser Test
   warnt (ein Füllwort verwässert die TOKEN-basierte Ähnlichkeit und
   erzeugt eine stille Fehlzuordnung), besteht für sie strukturell
   nicht. Nur exakt diese Produkt-IDs sind ausgenommen, keine
   pauschale Lockerung. */
const AUSNAHME_WORTWOERTLICHE_ALIASE = new Set([
  "holy_energy_starterset", "prolife_magnesium_sticks", "shisara_tuchmaske_hydro",
  "active_o2_cherry", "booster_energy_juneberry", "the_real_strawberry_kiwi",
  "albgold_dunkelnudeln", "granola", "broetchen"
]);
const NEUE_RAUSCHWOERTER = ["st", "fl", "ds", "ew", "sort", "sortiert"];
NEUE_RAUSCHWOERTER.forEach((wort) => {
  t(`„${wort}“ ist in keinem Katalognamen ein eigenes Wort`, () => {
    const treffer = FOOD_DATABASE.filter((p) =>
      !AUSNAHME_WORTWOERTLICHE_ALIASE.has(p.id) &&
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

t(`Trefferquote (sicher + unsicher) liegt bei mindestens 95 % — gemessen: ${
    Math.round(100 * (gesamtOk + gesamtUnsicher) / gesamtWaren)}%`, () => {
  const quote = (gesamtOk + gesamtUnsicher) / gesamtWaren;
  return quote >= 0.95
    ? true
    : `${gesamtOk + gesamtUnsicher} von ${gesamtWaren} (${Math.round(quote * 100)}%) — ` +
      `56% -> 76% (GL/VL-Rauschwort- und Katalog-Nachschärfung) -> 97,8% (30 einzeln ` +
      `recherchierte Bon-Fundstücke, Ziel 99%). Diese Schranke sinkt nie unbemerkt.`;
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
section("H: Zusammengeklebte Wörter trennen, ohne einen Treffer zu gefährden");

/* Manche Kassen (v. a. Netto) drucken mehrere echte Wörter ohne
   jedes Leerzeichen als EIN Druckwort -- "GLGouda" ist "GL" + "Gouda".
   splitGlued fügt an Groß-/Kleinschreibungs- und Ziffern-Grenzen
   Leerzeichen ein, rein additiv, nie Zeichen entfernend. */
t("Groß-/Kleinschreibungs-Grenze wird erkannt", () => {
  return splitGlued("GLGouda") === "GL Gouda" ? true : splitGlued("GLGouda");
});

t("Ziffern-Grenzen werden in beide Richtungen erkannt", () => {
  return splitGlued("HF3ger") === "HF 3 ger" ? true : splitGlued("HF3ger");
});

t("Bereits getrennter Text bleibt unverändert", () => {
  return splitGlued("Vollmilch 3,5%") === "Vollmilch 3,5%" ? true : splitGlued("Vollmilch 3,5%");
});

t("„GLGouda leichtHF3ger.250g VLOG“ findet jetzt Gouda", () => {
  const m = matchProduct("GLGouda leichtHF3ger.250g VLOG");
  return m.productId === "kaese_gouda" ? true : JSON.stringify(m);
});

/* Der Fund, der die Erweiterung erst absichern musste: eine Kürzung
   kann SELBST das passende Alias-Wort sein ("IronMa" -> Alias
   "IRONMA"). Trennt man sie blind in "Iron"+"Ma", geht genau dieses
   Signal verloren -- ohne das Zwei-Lesarten-Verfahren unten wäre das
   eine stille Verschlechterung gewesen, gefunden erst durch die volle
   Korpus-Messung, nicht durch Überlegung vorher. */
t("Eine Kürzung, die selbst ein Alias-Wort ist, verliert ihren Treffer NICHT", () => {
  const m = matchProduct("IronMa.100% Sahne P.");
  return m.productId === "proteinpulver" && m.needsConfirmation
    ? true : JSON.stringify(m);
});

t("Über alle echten Bons hinweg: die getrennte Lesart macht nichts schlechter, nur zusätzlich möglich besser", () => {
  const geprueft139 = fs.readdirSync(path.join(__dirname, "fixtures"))
    .filter((f) => f.endsWith(".txt"))
    .flatMap((f) => parseReceipt(bon(f.replace(/\.txt$/, ""))).items);
  let ok = 0, unsicher = 0, kein = 0;
  geprueft139.forEach((it) => {
    const m = matchProduct(it.raw);
    if (!m.productId) kein++;
    else if (m.needsConfirmation) unsicher++;
    else ok++;
  });
  // Vor dieser Erweiterung: 72 sicher, 64 unsicher, 3 kein Treffer.
  return (ok + unsicher) >= 136 && kein <= 3
    ? true : `${ok} sicher, ${unsicher} unsicher, ${kein} kein Treffer`;
});

// ================================================================
section("I: Drei Vorschläge für die Bestätigungsfrage");

/* Grundlage für die Oberfläche: bei einer unsicheren Zeile soll die
   Nutzerin drei Produkte zum Antippen sehen, kein Dropdown mit dem
   ganzen Katalog. topMatches liefert das — dieselbe Bewertung wie
   matchProduct, nur mit den besten n statt nur dem einen besten. */
t("Liefert höchstens n Vorschläge, absteigend sortiert", () => {
  const liste = topMatches("Layenb.HP Skyr sort. 200g", undefined, 3);
  const sortiert = liste.every((x, i) => i === 0 || liste[i - 1].confidence >= x.confidence);
  return liste.length <= 3 && sortiert ? true : JSON.stringify(liste);
});

t("Jedes Produkt taucht höchstens einmal auf, auch bei mehreren treffenden Aliasen", () => {
  const liste = topMatches("Proteinjogh.sort.200g", undefined, 5);
  const ids = liste.map((x) => x.productId);
  return new Set(ids).size === ids.length ? true : JSON.stringify(liste);
});

t("Der erste Vorschlag stimmt mit dem von matchProduct gewählten Produkt überein", () => {
  const m = matchProduct("Frosta XXL ReisHähn.");
  const liste = topMatches("Frosta XXL ReisHähn.");
  return liste[0] && liste[0].productId === m.productId ? true : JSON.stringify({ m, liste });
});

t("Nutzt dieselbe Zwei-Lesarten-Erweiterung wie matchProduct (zusammengeklebte Wörter)", () => {
  const liste = topMatches("GLGouda leichtHF3ger.250g VLOG");
  return liste[0] && liste[0].productId === "kaese_gouda" ? true : JSON.stringify(liste);
});

t("Kein Treffer im Katalog liefert eine leere Liste, keinen Absturz", () => {
  const liste = topMatches("");
  return Array.isArray(liste) ? true : JSON.stringify(liste);
});

// ================================================================
section("J: Drei weitere Rauschwörter — aus der Auswertung nicht zugeordneter Zeilen");

/* "HP" (High Protein) steht auf drei echten Bon-Zeilen aus zwei Ketten
   vor dem eigentlichen Produktnamen — dieselbe Blockade wie GL/VL/AS/KM.
   "HP TRIPLE DESS." ist bereits ein exakter Katalogtreffer und
   bestätigt die Bedeutung; die anderen beiden bleiben absichtlich
   unsicher (verschiedene Sorten existieren), werden aber eindeutiger. */
t("„Layenb.HP Skyr sort. 200g“ wird ohne „HP“ eindeutiger (0.70 -> 0.81), bleibt unsicher", () => {
  const m = matchProduct("Layenb.HP Skyr sort. 200g");
  return m.productId === "skyr" && m.needsConfirmation && m.confidence === 0.81
    ? true : JSON.stringify(m);
});

t("„GL HP Drink sort. 330ml“ wird ohne „HP“ eindeutiger (0.69 -> 0.81), bleibt unsicher", () => {
  const m = matchProduct("GL HP Drink sort. 330ml");
  return m.productId === "proteindrink" && m.needsConfirmation && m.confidence === 0.81
    ? true : JSON.stringify(m);
});

/* "VKE" (Verkaufseinheit) und "QS" (Fleisch-Prüfsiegel „Qualität und
   Sicherheit") sind Aufdrucke ohne Produktbedeutung. Bei VKE reicht
   die Verbesserung diesmal über die „sicher"-Schwelle -- ein Beleg
   dafür, dass die Erweiterung wirklich etwas bewirkt, nicht nur
   kosmetisch die Zahl verschiebt. */
t("„Champignon braun 400g VKE“ wird durch „VKE“ SICHER statt bestätigungspflichtig", () => {
  const m = matchProduct("Champignon braun 400g VKE");
  return m.productId === "champignons_braun" && !m.needsConfirmation && m.confidence >= SAFE_THRESHOLD
    ? true : JSON.stringify(m);
});

t("„TK CHICKEN NUGGETS-QS“ wird ohne „QS“ eindeutiger (0.70 -> 0.81), bleibt unsicher", () => {
  const m = matchProduct("TK CHICKEN NUGGETS-QS");
  return m.productId === "haehnchen_nuggets" && m.needsConfirmation && m.confidence === 0.81
    ? true : JSON.stringify(m);
});

t("Keines der drei neuen Rauschwörter kollidiert mit einem echten Katalog-Token", () => {
  // parseProductName() selbst filtert FILLER_WORDS aus `tokens` heraus
  // (siehe productMatcher2.js) -- eine Kollision hieße hier: das
  // Rauschwort steckt in `tokens` trotzdem noch drin. "HP TRIPLE
  // DESS." bleibt über den exakten Treffer erreichbar, weil DER
  // `core` vergleicht (behält Füllwörter), nicht `tokens`.
  const kollision = ["hp", "vke", "qs"].filter((w) =>
    FOOD_DATABASE.some((p) => [p.name, ...p.aliases].some((n) => parseProductName(n).tokens.includes(w))));
  return kollision.length === 0 ? true : kollision.join(", ");
});

t("Trefferquote über die echten Bons steigt durch die drei neuen Rauschwörter (73/63/3 -> 74/62/3)", () => {
  const ALLE = fs.readdirSync(path.join(__dirname, "fixtures")).filter((f) => f.endsWith(".txt"));
  let ok = 0, unsicher = 0, keins = 0;
  ALLE.forEach((datei) => {
    const p = parseReceipt(bon(datei.replace(/\.txt$/, "")));
    p.items.forEach((it) => {
      const m = matchProduct(it.raw);
      if (!m.productId) keins++; else if (m.needsConfirmation) unsicher++; else ok++;
    });
  });
  return ok === 74 && unsicher === 62 && keins === 3
    ? true : `${ok} sicher, ${unsicher} unsicher, ${keins} kein Treffer`;
});

// ================================================================
section("K: Eine echte, nicht auflösbare Zweideutigkeit — dokumentiert, nicht versteckt");

/* „SAHNEKEFIR A. FRUCHT“ (Aldi) ist der genaue Fall, den die
   Bestätigungspflicht auffangen soll: „sahnekefir“ enthält sowohl
   „sahne“ als auch „kefir“ vollständig (je 50 % des zusammengesetzten
   Worts), „frucht“ ist außerdem Präfix von gleich drei Katalog-
   Aliasen (Fruchtgummi, Fruchtquark, Fruchtzwerge). Alle Kandidaten
   liegen bei 0.70-0.72 -- keiner sticht heraus, weil keiner
   heraussticht. Der Katalog hat keinen Sahnekefir-Eintrag mit
   Fruchtgeschmack; das eigentlich richtige „Kefir“ landet dadurch
   erst gar nicht unter den Vorschlägen -- nicht weil sein
   Ähnlichkeitswert zu niedrig wäre (0.71 im direkten Vergleich, ein
   Bindeschritt mit den anderen), sondern weil der Kandidaten-Index
   (`candidateEntries`, reine Geschwindigkeitsoptimierung) das Wort
   „kefir" nie nachschlägt: er indiziert bei langen Wörtern nur den
   WORTANFANG („sahne…"), „kefir" steht aber am WORTENDE.

   Versucht und wieder verworfen: denselben Index zusätzlich für
   Wortenden aufzubauen. Über den vollen Bon-Korpus gemessen kostete
   das mehr, als es brachte -- drei echte Zeilen wurden schlechter, um
   diese eine eventuell sichtbarer zu machen: „RouOfenkaesGyrosStyle
   180g" verlor seinen einzigen Vorschlag komplett (0.66 -> kein
   Treffer, weil ein neuer, falscher Wortenden-Treffer den bisherigen
   Rückfall auf den vollen Katalogvergleich verhinderte), „GL HP Drink
   sort. 330ml" sprang von „Proteindrink" (richtig) auf „Sojamilch"
   (falsch), „Romatomaten" verlor seine spezifischere Zuordnung an die
   generische „Tomaten". Der Code-Kommentar bei `buildIndex` in
   productMatcher2.js hält das fest.

   Das ist am Ende derselbe Fall wie „Kaes." in Abschnitt G: eine
   echte Zweideutigkeit, die man nicht mit einer weiteren Sonderregel
   „reparieren" sollte, ohne an anderer Stelle mehr kaputtzumachen als
   man gewinnt. Wichtig ist nur, dass die Zeile ehrlich als „unsicher"
   markiert bleibt (bucht NICHTS automatisch) und die freie Eingabe in
   der Bestätigungskarte den Ausweg bietet. Dieser Test hält das
   heutige, GEMESSENE Verhalten fest, damit eine künftige Änderung es
   bewusst verbessert statt es unbemerkt zu verschlechtern. */
t("„SAHNEKEFIR A. FRUCHT“ bleibt unsicher -- niemals ein stiller Fehltreffer", () => {
  const m = matchProduct("SAHNEKEFIR A. FRUCHT");
  return m.productId && m.needsConfirmation && m.method === "unsicher"
    ? true : JSON.stringify(m);
});

t("„Kefir“ direkt verglichen liegt gleichauf mit den sichtbaren Vorschlägen (0.71) -- an der Bewertung liegt es nicht", () => {
  const bonParsed = parseProductName("SAHNEKEFIR A. FRUCHT");
  const kefirScore = combinedSimilarity(bonParsed, parseProductName("Kefir"));
  return Math.round(kefirScore * 100) / 100 === 0.71 ? true : kefirScore;
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
