/**
 * Verwandelt einen ausgeschriebenen Open-Food-Facts-Namen in eine
 * realistische Bon-Zeile -- nach denselben Mustern, die an den ECHTEN
 * Bons in test/fixtures/*.txt beobachtet wurden (siehe der
 * Kopfkommentar von test/bons.js für die Ketten-Eigenheiten):
 *
 *   Lidl:   saubere Namen, kaum Kürzel
 *   REWE:   saubere Namen, GROSSBUCHSTABEN
 *   EDEKA:  meist sauber, gelegentlich mit Punkt abgekürzt
 *   Aldi:   GROSSBUCHSTABEN, gelegentlich zusammengezogen
 *   Netto:  am aggressivsten -- Wortenden mit Punkt gekürzt,
 *           zusammengeklebte Wörter, Verpackungscode-Präfixe/-Suffixe
 *
 * Deterministisch (kein Math.random): dieselbe productId erzeugt
 * immer dieselbe Bon-Zeile, damit der erzeugte Korpus reproduzierbar
 * und als Fixture committbar ist.
 */

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h;
}

const FILLER_PREFIX = ["GL", "VL", "AS", "KM", "HP"];
const FILLER_SUFFIX = ["ST", "FL", "DS", "EW", "VKE", "QS", "sort.", "sortiert"];

const WEIGHTS_BY_CATEGORY = {
  "Milchprodukte": ["200g", "500g", "500ml", "1L", "250g"],
  "Fleisch/Fisch": ["300g", "500g", "400g", "250g"],
  "Wurstwaren": ["150g", "200g", "100g"],
  "Frischware": ["500g", "1kg", "300g"],
  "Backwaren": ["500g", "250g", "400g"],
  "Trocken/Vorrat": ["500g", "1kg", "400g", "250g"],
  "Getränke": ["1L", "0,5L", "1,5L", "0,33L"],
  "Tiefkühl": ["450g", "600g", "1kg"],
  "Süßes/Snacks": ["100g", "200g", "150g"],
  "Protein/Sport": ["500g", "330ml", "60g"],
  "Fertiggerichte": ["400g", "300g"],
  "International": ["300g", "400g"]
};

function foldForCaps(s) {
  return s.toUpperCase();
}

/** Wörter über `maxLen` Zeichen werden auf 3-6 Zeichen + Punkt gekürzt. */
function dotTruncateWords(name, seed) {
  return name.split(" ").map((w, i) => {
    const clean = w.replace(/[^A-Za-zÄÖÜäöüß-]/g, "");
    if (clean.length <= 5) return w;
    const cutAt = 3 + ((seed + i * 7) % 4); // 3..6 Zeichen
    return w.slice(0, cutAt) + ".";
  }).join(" ");
}

/** Klebt zwei bis drei benachbarte Wörter ohne Leerzeichen zusammen (CamelCase-Grenze bleibt). */
function glueWords(name, seed) {
  const words = name.split(" ").filter(Boolean);
  if (words.length < 2) return name;
  const start = seed % Math.max(1, words.length - 1);
  const span = 2 + (seed % Math.min(2, words.length - start - 1) || 0);
  const glued = words.slice(start, start + span).join("");
  return [...words.slice(0, start), glued, ...words.slice(start + span)].join(" ");
}

/** "Schw.Ex.Z.Pf.Ma.Konf." -- jedes Wort auf 1-4 Buchstaben plus Punkt, aneinandergereiht. */
function heavyAbbreviate(name, seed) {
  return name.split(" ").filter(Boolean).map((w, i) => {
    const clean = w.replace(/[^A-Za-zÄÖÜäöüß-]/g, "");
    if (!clean) return "";
    const cutAt = 1 + ((seed + i * 5) % 4); // 1..4 Zeichen
    return clean.slice(0, cutAt) + ".";
  }).filter(Boolean).join("");
}

function pick(list, seed) { return list[((seed % list.length) + list.length) % list.length]; }

/**
 * Erzeugt EINE realistische Bon-Zeile für einen echten OFF-Namen.
 * `persona` (0-4) wählt den Ketten-Stil, deterministisch aus der
 * productId abgeleitet -- dieselbe Ware bekommt über mehrere Läufe
 * immer denselben Zeilentyp.
 */
function mangleLine(offName, category, seed) {
  const persona = seed % 5;
  const weight = pick(WEIGHTS_BY_CATEGORY[category] || ["300g"], seed >>> 3);
  let core = offName.trim();

  if (persona === 0) {
    // Lidl-artig: sauberer Name, Groß-/Kleinschreibung wie geschrieben, Menge dran
    return `${core} ${weight}`.trim();
  }
  if (persona === 1) {
    // REWE/Aldi-artig: GROSSBUCHSTABEN, gelegentlich ein Suffix-Kürzel
    const withCode = seed % 2 === 0 ? core : `${core} ${pick(FILLER_SUFFIX, seed >>> 4)}`;
    return foldForCaps(withCode);
  }
  if (persona === 2) {
    // EDEKA-artig: ein einzelnes Wort abgekürzt, sonst unverändert
    return dotTruncateWords(core, seed) + (seed % 3 === 0 ? "." : "");
  }
  if (persona === 3) {
    // Netto-artig, moderat: Präfix-Kürzel + zusammengeklebte Wörter + Menge
    const prefix = pick(FILLER_PREFIX, seed >>> 2);
    const glued = glueWords(core, seed >>> 1);
    return `${prefix} ${glued}${weight}`.replace(/\s+(?=\d)/, "");
  }
  // persona === 4: Netto-artig, hart -- durchgehend abgekürzt
  return `${heavyAbbreviate(core, seed)}${weight}`;
}

module.exports = { mangleLine, hash };
