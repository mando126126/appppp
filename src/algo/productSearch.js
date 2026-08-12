/**
 * productSearch.js — Produkte finden, während man tippt
 * ================================================================
 * `productMatcher2` beantwortet eine andere Frage: „welches Produkt
 * ist diese BONZEILE?" Dort geht es um eine vollständige, oft kryptisch
 * abgekürzte Zeichenkette, und ein falscher Treffer bucht eine falsche
 * Historie — deshalb ist der Matcher streng und fragt lieber nach.
 *
 * Hier ist es umgekehrt. Der Nutzer tippt „ban" und erwartet Bananen,
 * bevor er das dritte Zeichen loslässt. Ein Fragment ist kein Fehler,
 * sondern der Normalfall, und eine Fehlanzeige kostet nichts: die
 * Liste steht daneben, man sieht sofort, ob das Richtige dabei ist.
 *
 * FÜNF STUFEN, in dieser Reihenfolge:
 *
 *   1. Ein ganzes Wort ist es        „milch"  -> H-Milch
 *   2. Ein Wort endet darauf         „brot"   -> Vollkornbrot
 *   3. Der Name beginnt damit        „ban"    -> Bananen
 *   4. Ein Wort beginnt damit        „toma"   -> Tomaten
 *   5. Der Name enthält es           „creme"  -> Crème fraîche
 *   6. Ein Alias passt               „tempo"  -> Taschentücher
 *   7. Vertippt, aber nah dran       „jogurt" -> Joghurt
 *
 * Die Reihenfolge der ersten beiden Stufen ist der Kern und deutsch
 * begründet: in einem Kompositum steht das Grundwort HINTEN.
 * „Vollmilch" ist Milch, „Milchreis" ist Reis. Wer „milch" tippt,
 * meint fast nie Milchreis — eine Suche, die nur auf Wortanfänge
 * schaut, zeigt ihm aber genau den zuerst.
 *
 * Innerhalb einer Stufe gewinnt der kürzere Name. Das ist keine
 * Willkür: „Milch" ist die wahrscheinlichere Absicht als
 * „Milchreis fertig", und wer das Längere will, tippt weiter.
 *
 * Umlaute, ß und Groß-/Kleinschreibung sind egal — „kaese", „Käse"
 * und „KAESE" führen zum selben Ergebnis. Auf einer Telefontastatur
 * ist das kein Komfort, sondern Voraussetzung.
 * ================================================================
 */

const { FOOD_DATABASE } = require("./foodDatabase");
const { levenshtein } = require("./productMatcher2");

const MAX_RESULTS = 12;
const MIN_FUZZY_LENGTH = 4;      // unter vier Zeichen ist alles „nah dran“
const MAX_FUZZY_DISTANCE = 2;

// Die Stufen als Zahlen — kleiner ist besser.
const RANK = {
  WORD_EXACT: 0,
  WORD_SUFFIX: 1,
  NAME_PREFIX: 2,
  WORD_PREFIX: 3,
  NAME_PART: 4,
  ALIAS: 5,
  FUZZY: 6,
  AISLE: 7
};

/**
 * Vereinheitlichen, was auf einer Tastatur verschieden aussieht und
 * dasselbe meint. Heißt nicht `norm` oder `foldUmlauts` — beide Namen
 * vergibt productMatcher2, und im Bündel teilen sich alle Module
 * denselben Namensraum.
 */
function searchNorm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    // Erst die Umlaute, dann die übrigen Akzente: sonst würde aus „ä“
    // ein „a“ und „kaese“ fände „Käse“ nicht mehr. Ohne diesen Schritt
    // zerfiel „Crème fraîche“ zu „cr me fra che“ — wer „creme“ tippte,
    // bekam Handcreme und Schuhcreme, aber nicht das Produkt, das so
    // heißt.
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Der Suchindex wird einmal gebaut und danach nur gelesen. Bei 850
   Produkten ist die Alternative — bei jedem Tastendruck alle Namen
   normalisieren — spürbar: das sind 850 Zeichenkettenoperationen pro
   Anschlag, auf einem älteren Telefon zu viel. */
let SEARCH_INDEX = null;

function buildSearchIndex(catalog = FOOD_DATABASE) {
  SEARCH_INDEX = catalog.map((p) => {
    const name = searchNorm(p.name);
    return {
      product: p,
      name,
      words: name.split(" ").filter(Boolean),
      aliases: p.aliases.map(searchNorm),
      aisle: searchNorm(p.aisle),
      category: searchNorm(p.category)
    };
  });
  return SEARCH_INDEX;
}

/** Nach einer Katalogänderung neu bauen. */
function resetSearchIndex() { SEARCH_INDEX = null; }

/**
 * Bewertung eines Eintrags gegen eine Suchanfrage.
 * @returns {null|{rank, hit}} null = kein Treffer
 */
function rankEntry(entry, q) {
  if (entry.words.some((w) => w === q)) return { rank: RANK.WORD_EXACT };
  // Grundwort hinten: „brot“ findet Vollkornbrot, „milch“ Vollmilch.
  if (q.length >= 3 && entry.words.some((w) => w !== q && w.endsWith(q))) return { rank: RANK.WORD_SUFFIX };
  if (entry.name.startsWith(q)) return { rank: RANK.NAME_PREFIX };
  if (entry.words.some((w) => w.startsWith(q))) return { rank: RANK.WORD_PREFIX };
  if (entry.name.includes(q)) return { rank: RANK.NAME_PART };
  if (entry.aliases.some((a) => a.startsWith(q) || a.includes(q))) return { rank: RANK.ALIAS };

  // Vertippt: nur bei ausreichend langer Eingabe, sonst wird jedes
  // kurze Fragment zu jedem Produkt „ähnlich“. Zusätzlich muss der
  // erste Buchstabe stimmen — sonst wird aus „spargel“ ein „Haargel“,
  // und der Tippfehler-Ausgleich kostet mehr, als er einbringt.
  if (q.length >= MIN_FUZZY_LENGTH) {
    for (const w of entry.words) {
      if (w[0] !== q[0]) continue;
      // Nur Wörter ähnlicher Länge vergleichen — „jogurt“ gegen
      // „joghurt“ ist eine Frage, „jogurt“ gegen „joghurtbereiter“
      // ist keine.
      if (Math.abs(w.length - q.length) > MAX_FUZZY_DISTANCE) continue;
      if (levenshtein(w, q) <= MAX_FUZZY_DISTANCE) return { rank: RANK.FUZZY };
    }
  }

  // Zuletzt der Gang: „obst“ soll das Obstregal zeigen, wenn sonst
  // nichts passt.
  if (q.length >= 3 && (entry.aisle.includes(q) || entry.category.includes(q))) {
    return { rank: RANK.AISLE };
  }
  return null;
}

/**
 * Produkte zu einer Eingabe finden.
 *
 * @param {string} query
 * @param {number} limit
 * @param {{catalog, boost}} [opts] `boost` = Kennungen, die bei
 *   gleichem Rang vorn stehen (z. B. was der Haushalt schon kauft).
 * @returns {Array} Produkte in Reihenfolge der Passung
 */
function findProducts(query, limit = MAX_RESULTS, opts = {}) {
  const q = searchNorm(query);
  if (!q) return [];

  const index = opts.catalog ? buildSearchIndex(opts.catalog) : (SEARCH_INDEX || buildSearchIndex());
  const boost = opts.boost instanceof Set ? opts.boost : new Set(opts.boost || []);

  const hits = [];
  for (const entry of index) {
    const r = rankEntry(entry, q);
    if (!r) continue;
    hits.push({
      product: entry.product,
      rank: r.rank,
      // Was der Haushalt ohnehin kauft, steht bei gleichem Rang vorn.
      known: boost.has(entry.product.id) ? 0 : 1,
      length: entry.name.length,
      name: entry.name
    });
  }

  hits.sort((a, b) =>
    a.rank - b.rank ||
    a.known - b.known ||
    a.length - b.length ||
    a.name.localeCompare(b.name));

  return hits.slice(0, Math.max(1, limit)).map((h) => h.product);
}

module.exports = {
  findProducts, searchNorm, rankEntry, buildSearchIndex, resetSearchIndex,
  RANK, MAX_RESULTS, MIN_FUZZY_LENGTH, MAX_FUZZY_DISTANCE
};
