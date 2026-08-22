/**
 * generate.js — zieht echte, ausgeschriebene Produktnamen von Open
 * Food Facts (kostenfrei, ohne Login, https://world.openfoodfacts.org)
 * für eine Stichprobe der eigenen Lebensmittel-Katalogeinträge und
 * verwandelt sie in realistische Bon-Zeilen (mangle.js) -- Grundlage
 * für test/fixtures/off-hardcases.json, den synthetischen Härtefall-
 * Korpus, den test/matching.js (Abschnitt M) gegen den Abgleich fährt.
 *
 * BRAUCHT NETZZUGANG. Läuft NICHT als Teil von `npm test` -- die
 * Fixture-Datei wird einmalig erzeugt und danach committet, damit die
 * Tests offline und reproduzierbar bleiben. Erneut ausführen, wenn
 * der eigene Katalog wächst und ein größerer/aktuellerer Korpus
 * gewünscht ist:
 *
 *   node tools/off_hardcase_corpus/generate.js
 *
 * Deterministisch bis auf das, was Open Food Facts selbst liefert:
 * dieselbe Katalog-Stichprobe, dieselbe Mangle-Funktion (mangle.js,
 * seed aus der productId) -- nur die von OFF zurückgegebenen Namen
 * können sich über die Zeit ändern, wenn dort neue Produkte oder
 * bessere deutsche Übersetzungen einlaufen.
 */
const fs = require("fs");
const path = require("path");
const { FOOD_DATABASE } = require("../../src/algo/foodDatabase");
const { mangleLine, hash } = require("./mangle");

const OUT_FILE = path.join(__dirname, "..", "..", "test", "fixtures", "off-hardcases.json");

/* Nur Lebensmittel-Kategorien -- Open Food Facts deckt Haushalt,
   Körperpflege, Papier & Folie etc. kaum bis gar nicht ab, eine
   Anfrage dorthin liefert fast nie einen brauchbaren Treffer. */
const FOOD_CATEGORIES = new Set([
  "Milchprodukte", "Fleisch/Fisch", "Wurstwaren", "Frischware", "Backwaren",
  "Trocken/Vorrat", "Getränke", "Tiefkühl", "Süßes/Snacks", "Protein/Sport",
  "Fertiggerichte", "International"
]);

function stratifiedSample() {
  const byCategory = new Map();
  FOOD_DATABASE.forEach((p) => {
    if (!FOOD_CATEGORIES.has(p.category)) return;
    if (p.id.startsWith("off_")) return; // selbst schon aus OFF importiert, kein Mehrwert
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  });
  const sample = [];
  byCategory.forEach((list) => {
    // Bis zu 22 je Kategorie, deterministisch (gleichmäßig verteilte
    // Schritte statt Zufall), damit der Lauf wiederholbar bleibt.
    const step = Math.max(1, Math.floor(list.length / 22));
    for (let i = 0; i < list.length; i += step) sample.push(list[i]);
  });
  return sample;
}

/* Freitext-Suche über OFF trifft oft ein Produkt, das den gesuchten
   Begriff nur ERWÄHNT ("Galettes boulghour parmesan & tomates
   confites" für die Suche "Parmesan") statt ihn zu SEIN. Ein erster
   Lauf ohne diese Prüfung lieferte genau solche Fehlpaarungen -- eine
   Bon-Zeile aus "Galettes ..." unter der erwarteten productId
   "parmesan" hätte den Algorithmus für einen Fehler bestraft, den in
   Wahrheit die Testdaten gemacht hätten, nicht der Abgleich. Deshalb:
   nur ein Treffer, bei dem der gesuchte Begriff eines der ERSTEN ZWEI
   Wörter ist UND der Name insgesamt kurz genug bleibt, um dasselbe
   Produkt zu sein, kein zusammengesetztes Gericht. */
function passtWirklich(suchbegriff, offName) {
  const woerter = offName.toLowerCase().split(/\s+/).filter(Boolean);
  if (woerter.length > 5) return false;
  const ziel = suchbegriff.toLowerCase();
  return woerter.slice(0, 2).some((w) => w.startsWith(ziel.slice(0, 5)) || ziel.startsWith(w.slice(0, 5)));
}

async function offSearch(name) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}` +
    `&search_simple=1&action=process&json=1&page_size=8&lc=de&countries_tags_en=germany`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EinkaufsAnker-Testkorpus/1.0 (nicht-kommerziell, siehe README)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const kandidaten = (data.products || []).filter((p) => p.product_name_de || p.product_name);
    const hit = kandidaten.find((p) => passtWirklich(name, p.product_name_de || p.product_name));
    return hit ? (hit.product_name_de || hit.product_name) : null;
  } catch (e) {
    return null; // Netzwerkfehler zählt wie kein Treffer, kein Absturz
  }
}

(async () => {
  const sample = stratifiedSample();
  console.log(`Ziehe echte Namen für ${sample.length} eigene Katalogeinträge von Open Food Facts...`);
  const corpus = [];
  for (let i = 0; i < sample.length; i++) {
    const p = sample[i];
    const offName = await offSearch(p.name);
    if (offName) {
      const seed = hash(p.id);
      corpus.push({ productId: p.id, catalogName: p.name, offName, line: mangleLine(offName, p.category, seed) });
      process.stdout.write(".");
    } else {
      process.stdout.write("x");
    }
    await new Promise((r) => setTimeout(r, 250)); // höflich zum kostenfreien Dienst
  }
  console.log(`\n${corpus.length} von ${sample.length} lieferten einen echten Namen -> ${corpus.length} Bon-Zeilen.`);
  fs.writeFileSync(OUT_FILE, JSON.stringify(corpus, null, 1) + "\n");
  console.log(`Geschrieben: ${path.relative(process.cwd(), OUT_FILE)}`);
})();
