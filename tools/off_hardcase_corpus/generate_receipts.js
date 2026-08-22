/**
 * generate_receipts.js — simuliert 1000 vollständige Bons, nicht nur
 * einzelne Zeilen. Zieht dafür echte, ausgeschriebene Namen für den
 * GESAMTEN eigenen Katalog (alle 19 Kategorien, nicht nur eine
 * Stichprobe und nicht nur Lebensmittel) und baut daraus realistische
 * Einkaufskörbe (8-25 Positionen, mehrere Kategorien gemischt, wie
 * ein echter Einkauf), jede Zeile verstümmelt nach dem Muster EINER
 * Kette pro Bon (dieselbe Kasse druckt nicht mal so, mal so).
 *
 * ZWEI QUELLEN FÜR DEN PRODUKT-POOL:
 * 1. Die rund 835 "off_"-Produkte im eigenen Katalog stammen selbst
 *    schon wortwörtlich von Open Food Facts (frühere Bulk-Import-
 *    Runde) -- ihr Katalogname IST bereits ein echter OFF-Name, eine
 *    erneute Anfrage würde nur denselben Namen zurückbringen. Sie
 *    gehen deshalb OHNE Netzanfrage direkt in den Pool.
 * 2. Für die rund 860 übrigen (nicht aus OFF importierten) Einträge
 *    wird wie bisher eine echte Anfrage gestellt.
 * Ergebnis: ein deutlich größerer, aber trotzdem höflicher Pool --
 * nur gut 860 statt 1700 echte Netzanfragen für über 1000 mögliche
 * Pool-Einträge.
 *
 * BRAUCHT NETZZUGANG, läuft NICHT als Teil von `npm test`. Erzeugt
 * test/fixtures/off-receipts.json, gegen den test/matching.js
 * (Abschnitt N) dauerhaft misst.
 *
 *   node tools/off_hardcase_corpus/generate_receipts.js
 *
 * Deterministisch bis auf das, was Open Food Facts selbst liefert.
 */
const fs = require("fs");
const path = require("path");
const { FOOD_DATABASE } = require("../../src/algo/foodDatabase");
const { mangleLine, hash } = require("./mangle");

const OUT_FILE = path.join(__dirname, "..", "..", "test", "fixtures", "off-receipts.json");
const RECEIPT_COUNT = 1000;
const STORES = ["Lidl-artig", "REWE/Aldi-artig", "EDEKA-artig", "Netto-artig (mittel)", "Netto-artig (hart)"];

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
    return null;
  }
}

/* Ein Mulberry32-PRNG statt Math.random(): deterministisch bei
   festem Seed, damit derselbe Lauf immer denselben Korpus erzeugt. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildReceipt(index, pool) {
  const rand = rng(hash("receipt-" + index));
  const store = STORES[index % STORES.length];
  const persona = index % STORES.length;
  const size = 8 + Math.floor(rand() * 18); // 8..25 Positionen

  // Ein echter Einkauf streut nicht gleichmäßig über alle 12
  // Kategorien -- er dreht sich um zwei bis vier Schwerpunkte
  // (z.B. "Frühstück": Milchprodukte + Backwaren + Getränke) plus
  // Streuware. Schwerpunkte deterministisch aus dem Kategorien-Pool.
  const alleKategorien = [...new Set(pool.map((p) => p.category))];
  const schwerpunkte = new Set();
  const anzahlSchwerpunkte = 2 + Math.floor(rand() * 3); // 2..4
  while (schwerpunkte.size < anzahlSchwerpunkte && schwerpunkte.size < alleKategorien.length) {
    schwerpunkte.add(alleKategorien[Math.floor(rand() * alleKategorien.length)]);
  }

  const kandidaten = pool.filter((p) => schwerpunkte.has(p.category));
  const streuware = pool;
  const items = [];
  const genutzt = new Set();
  for (let i = 0; i < size; i++) {
    // 80% aus den Schwerpunkten, 20% Streuware -- Standardwaren wie
    // Klopapier landen so auch im "Frühstücks"-Einkauf, ohne die
    // Kategorien-Konzentration zu verwässern.
    const quelle = (rand() < 0.8 && kandidaten.length) ? kandidaten : streuware;
    let versuche = 0, gewaehlt;
    do {
      gewaehlt = quelle[Math.floor(rand() * quelle.length)];
      versuche++;
    } while (genutzt.has(gewaehlt.productId) && versuche < 10);
    genutzt.add(gewaehlt.productId);
    const seed = hash(`${gewaehlt.productId}-r${index}-i${i}`);
    // Persona liegt fest (dieselbe Kasse), aber der Seed variiert je
    // Position -- sonst würde derselbe Zufallsteil (Menge, Kürzel)
    // immer gleich ausfallen, egal welches Produkt dransteht.
    const mangleSeed = (seed - (seed % 5)) + persona;
    items.push({
      productId: gewaehlt.productId,
      catalogName: gewaehlt.catalogName,
      offName: gewaehlt.offName,
      line: mangleLine(gewaehlt.offName, gewaehlt.category, mangleSeed)
    });
  }
  return { id: index, store, items };
}

(async () => {
  const bereitsAusOff = FOOD_DATABASE.filter((p) => p.id.startsWith("off_"));
  const pool = bereitsAusOff.map((p) => ({ productId: p.id, catalogName: p.name, category: p.category, offName: p.name }));
  console.log(`${pool.length} Katalogeinträge stammen schon von OFF -- direkt in den Pool, keine Anfrage nötig.`);

  const kandidaten = FOOD_DATABASE.filter((p) => !p.id.startsWith("off_"));
  console.log(`Ziehe echte Namen für den GESAMTEN übrigen Katalog (${kandidaten.length} Einträge, alle Kategorien) von Open Food Facts...`);
  for (let i = 0; i < kandidaten.length; i++) {
    const p = kandidaten[i];
    const offName = await offSearch(p.name);
    if (offName) {
      pool.push({ productId: p.id, catalogName: p.name, category: p.category, offName });
      process.stdout.write(".");
    } else {
      process.stdout.write("x");
    }
    if (i % 100 === 99) process.stdout.write(` [${i + 1}/${kandidaten.length}]\n`);
    await new Promise((r) => setTimeout(r, 220)); // höflich zum kostenfreien Dienst
  }
  console.log(`\nPool insgesamt: ${pool.length} Einträge (${bereitsAusOff.length} direkt + ${pool.length - bereitsAusOff.length} von ${kandidaten.length} echten Anfragen) -- Grundlage für ${RECEIPT_COUNT} simulierte Bons.`);

  const receipts = [];
  for (let i = 0; i < RECEIPT_COUNT; i++) receipts.push(buildReceipt(i, pool));
  const totalItems = receipts.reduce((a, r) => a + r.items.length, 0);

  fs.writeFileSync(OUT_FILE, JSON.stringify(receipts, null, 1) + "\n");
  console.log(`${receipts.length} Bons, ${totalItems} Positionen insgesamt -> ${path.relative(process.cwd(), OUT_FILE)}`);
})();
