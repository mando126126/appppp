/**
 * productMatcher2.js — überarbeitete Fassung
 * ================================================================
 * Was gegenüber v1 besser ist:
 *
 * 1. TOKEN-VERGLEICH ZUSÄTZLICH ZU LEVENSHTEIN.
 *    "BIO VOLLMILCH FRISCH 3,5%" und "VOLLMILCH 3,5%" haben eine
 *    schlechte Levenshtein-Ähnlichkeit (viele zusätzliche Zeichen),
 *    aber eine sehr gute Token-Überlappung. Der kombinierte Wert
 *    fängt beide Fälle ab.
 *
 * 2. MENGEN- UND EINHEITENERKENNUNG.
 *    "H-MILCH 1L" wird zerlegt in Name + Menge. Die Menge stört den
 *    Namensvergleich nicht mehr und wird gleichzeitig für die
 *    Rhythmusberechnung nutzbar (siehe rhythmEngine2, mengenbewusst).
 *
 * 3. FÜLLWÖRTER UND MARKEN.
 *    "BIO", "FRISCH", "DEUTSCHE", "GUT&GUENSTIG", "JA!" tragen
 *    nichts zur Identifikation bei und werden vor dem Vergleich
 *    entfernt.
 *
 * 4. ZWEISTUFIGE SICHERHEIT.
 *    Über 0.85 gilt ein Treffer als sicher. Zwischen 0.65 und 0.85
 *    wird er als "bestätigen lassen" markiert -- das UI kann dann
 *    einmal nachfragen, statt still falsch zuzuordnen. Genau der
 *    Fall, in dem stille Fehlzuordnungen sonst falsche Rhythmen
 *    erzeugen.
 * ================================================================
 */

const { FOOD_DATABASE } = require("./foodDatabase");

const CONFIRM_THRESHOLD = 0.65;
const SAFE_THRESHOLD = 0.85;

/**
 * Wörter ohne Aussagekraft für die Produktidentität.
 *
 * ACHTUNG bei Erweiterungen: "dose", "glas", "tk", "tiefkuehl" und
 * "gemahlen" gehören BEWUSST NICHT hierher. Sie unterscheiden
 * echte Produkte voneinander (Dosentomaten vs. frische Tomaten,
 * TK-Gemüse vs. frisches Gemüse). Wer sie hier einträgt, erzeugt
 * stille Fehlzuordnungen, die später als falsche Rhythmen
 * auftauchen und schwer zu finden sind.
 *
 * Die Markenliste ist Pflegearbeit und wächst mit der Praxis --
 * Kandidaten liefert die Auswertung nicht zugeordneter Bon-Zeilen.
 */
const FILLER_WORDS = new Set([
  // Qualitäts- und Werbewörter
  "bio", "frisch", "frische", "deutsche", "deutscher", "natur", "classic",
  "original", "gut", "guenstig", "marken", "feine", "beste", "wahl",
  "auslese", "premium", "aktion", "sorte", "sorten",
  // Handelsmarken und Ketten
  "ja", "rewe", "edeka", "lidl", "aldi", "penny", "netto", "kaufland",
  // Herstellermarken (Auszug, wächst mit der Praxis)
  "chiquita", "weihenstephan", "mueller", "danone", "barilla", "oetker",
  "iglo", "alnatura", "landliebe", "ehrmann", "zott", "bauer", "hochland",
  // Verpackungsformen ohne Produktbedeutung
  "schale", "beutel", "netz", "tuete", "packung", "pack", "becher",
  "bund", "kiste", "korb", "portion", "familienpackung",
  /* Verpackungs- UND Sortierungs-Kürzel, wie sie auf echten Bons von
     Netto, REWE und ALDI stehen — bei Lidl kaum, deshalb fielen sie
     bei der Kalibrierung an einem einzigen Bon nicht auf. „ST"
     (Stück), „FL" (Flasche), „DS" (Dose), „EW" (Einweg) sind reine
     Verpackungscodes, keine Produktnamen — anders als das AUSGE-
     SCHRIEBENE Wort „dose", das bewusst NICHT hier steht, weil
     „Dosentomaten" etwas anderes ist als „Tomaten". Die Abkürzung
     „ds" trifft als eigenes Token aber nie ein zusammengesetztes
     Wort wie „dosentomaten" — die Unterscheidung bleibt intakt.
     „sort." (sortiert) hängt an gefühlt jeder zweiten Netto-Zeile
     und trägt nichts zur Identität bei: "GL Proteinjogh.sort.200g"
     verlor allein durch dieses eine Wort mehr Punkte als durch die
     Markenkürzel davor. Geprüft: keines der vier kollidiert mit
     einem echten Katalog-Token (test/matching.js). */
  "st", "fl", "ds", "ew", "sort", "sortiert"
]);

/**
 * Vereinheitlicht Umlaute. Deutsche Kassenbons schreiben denselben
 * Artikel mal "HÄHNCHEN", mal "HAEHNCHEN" -- ohne diese Normalisierung
 * gelten beide als verschiedene Produkte.
 *
 * Danach fallen die übrigen Akzente weg: "Crème fraîche" und
 * "CREME FRAICHE" sind dasselbe, und eine Kasse schreibt zuverlässig
 * die zweite Form. Die Reihenfolge ist wichtig -- erst ae/oe/ue, dann
 * die Akzente. Umgekehrt würde aus "ä" ein "a", und "HAEHNCHEN" träfe
 * "Hähnchen" nicht mehr.
 */
function foldUmlauts(s) {
  return s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Längste sinnvolle Bonzeile. Der längste Katalogname liegt bei rund
 * 40 Zeichen; alles jenseits von 120 ist keine Artikelbezeichnung
 * mehr, sondern ein Einlesefehler oder eine zusammengelaufene Zeile.
 *
 * Die Grenze ist nicht Kosmetik: Levenshtein kostet Länge mal Länge,
 * und seit der Katalog auf 846 Produkte gewachsen ist, wird jede
 * Zeile gegen über tausend Namen und Aliase gehalten. Eine Zeile mit
 * 5000 Zeichen brauchte damit fast eine halbe Sekunde — auf einem
 * Telefon mit einem ganzen Bon voller solcher Zeilen wäre das eine
 * hängende Oberfläche. Der Stresstest hat genau das gemeldet.
 */
const MAX_RAW_LENGTH = 120;

/** Zerlegt "H-MILCH 3,5% 1L" in { core:"h milch 3,5%", quantity:1, unit:"l" } */
function parseProductName(raw) {
  let s = foldUmlauts(String(raw || "").slice(0, MAX_RAW_LENGTH).toLowerCase());

  // Mengenangabe herausziehen (1l, 500g, 10er, 2x)
  let quantity = 1;
  let unit = null;
  const packMatch = s.match(/(\d+)\s*(er|x|stk|stück)\b/);
  if (packMatch) {
    const parsed = parseInt(packMatch[1], 10);
    // "MILCH 0X" oder "EIER 0ER" ergaben im Stresstest Menge 0,
    // was später zu Division durch null in der Rhythmusrechnung
    // führt. Menge ist immer mindestens 1.
    quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    unit = "stk";
  }
  const weightMatch = s.match(/(\d+[.,]?\d*)\s*(kg|g|ml|l)\b/);
  if (weightMatch) { unit = unit || weightMatch[2]; }

  // Mengenangaben und Sonderzeichen für den Namensvergleich entfernen
  const core = s
    .replace(/\d+[.,]?\d*\s*(kg|g|ml|l|er|x|stk|stück)\b/g, " ")
    .replace(/[^a-zäöüß0-9,%\s-]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = core.split(" ").filter((t) => t.length > 1 && !FILLER_WORDS.has(t));

  return { core, tokens, quantity, unit };
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
}

/** Jaccard-Ähnlichkeit zweier Token-Mengen (exakte Treffer). */
function tokenSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

/**
 * Komposita-Ähnlichkeit — für das Deutsche unverzichtbar.
 * "haehnchenbrustfilet" und "haehnchenbrust" sind als Token völlig
 * verschieden, meinen aber dasselbe Produkt. Enthält ein Token das
 * andere (ab 5 Zeichen, um Zufallstreffer zu vermeiden), zählt das
 * als Teiltreffer.
 */
function compoundSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  let score = 0;
  for (const a of tokensA) {
    let bestForToken = 0;
    for (const b of tokensB) {
      if (a === b) { bestForToken = 1; break; }
      if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) {
        // Teiltreffer, gewichtet nach Längenverhältnis
        const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
        bestForToken = Math.max(bestForToken, 0.75 + 0.25 * ratio);
      }
    }
    score += bestForToken;
  }
  return score / Math.max(tokensA.length, tokensB.length);
}

/**
 * Überdeckung — asymmetrisch gedacht.
 * "TK GEMUESE ERBSEN" enthält alle Wörter von "TK GEMUESE"; die
 * Bon-Zeile ist nur genauer als der Katalogeintrag. Jaccard bestraft
 * das (2 von 3 Wörtern), obwohl es ein guter Treffer ist.
 *
 * Die Längenstrafe verhindert dabei den gefährlichen Fall: sonst
 * würde "GEHACKTE TOMATEN DOSE" perfekt auf "Tomaten" (frisch)
 * passen, weil dessen einziges Wort vollständig enthalten ist.
 * Je mehr überzählige Wörter, desto stärker der Abschlag.
 */
function overlapSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;

  let matched = 0;
  for (const s of shorter) {
    let best = 0;
    for (const l of longer) {
      if (s === l) { best = 1; break; }
      if (s.length >= 5 && l.length >= 5 && (s.includes(l) || l.includes(s))) {
        const ratio = Math.min(s.length, l.length) / Math.max(s.length, l.length);
        best = Math.max(best, 0.75 + 0.25 * ratio);
      }
    }
    matched += best;
  }
  const coverage = matched / shorter.length;
  const extraTokens = longer.length - shorter.length;
  // 0,15 je Zusatzwort war zu hart: echte Bon-Zeilen hängen
  // Geschmacksrichtungen an ("Prot.Riegel Erdn-Car", "Vit.-Was.
  // Pfir.-Holu"), die den Kern nicht verändern. Vier Zeilen des
  // Lidl-Bons lagen dadurch bei exakt 64 % — knapp unter der
  // Schwelle. 0,12 löst das, ohne die Dose/frisch-Unterscheidung
  // zu gefährden (dafür sorgt ein Test).
  const lengthPenalty = 1 - Math.min(0.45, 0.12 * extraTokens);
  return coverage * lengthPenalty;
}

/**
 * Sperre gegen gefährliche Fehlzuordnungen.
 *
 * Am echten Lidl-Bon aufgefallen: "ChickenNug.Cornflak." wurde mit
 * 74 % auf "Cornflakes" abgebildet, weil das Teilwort "cornflak"
 * passt. Ein paniertes Hähnchenprodukt hätte damit die Haltbarkeit
 * von Frühstücksflocken bekommen.
 *
 * Die Regel ist BEWUSST ENG auf Fleisch und Fisch beschränkt:
 *   - Dort ist der Schaden am größten (Verbrauchsdatum, kurze
 *     Haltbarkeit, Keimrisiko).
 *   - Eine breitere Regel würde echte Treffer zerstören. "Kokosmilch"
 *     enthält "milch", ist aber Vorratsware; "Fischstäbchen" ist
 *     Tiefkühl, nicht Frischfisch. Deshalb erlaubte Kategorien statt
 *     einer einzigen.
 *
 * Teilwort-Treffer sind hier erlaubt, weil Bon-Namen abgeschnitten
 * werden ("Haehn.", "Nug.", "ChickenNug").
 */
const MEAT_TOKENS = [
  "chicken", "haehn", "hahn", "pute", "rind", "schwein", "hack",
  "lachs", "fisch", "steak", "schnitzel", "nugget", "nug",
  "garnele", "wurst", "schinken", "salami", "bacon", "gefluegel"
];
const MEAT_OK_CATEGORIES = new Set(["Fleisch/Fisch", "Wurstwaren", "Tiefkühl"]);

function looksLikeMeat(tokens) {
  // Nur Wortanfang oder -ende, NICHT irgendwo enthalten.
  // "gehackte Tomaten" enthält "hack", ist aber kein Fleisch —
  // mit der lockeren Prüfung fiel die Dosentomate durchs Raster.
  // "chickennug" (Anfang) und "reishaehn" (Ende) werden weiterhin
  // erkannt, denn genau so kürzen Kassenbons ab.
  return tokens.some((t) =>
    MEAT_TOKENS.some((m) =>
      t === m || (t.length >= 4 && (t.startsWith(m) || t.endsWith(m)))
    )
  );
}

/**
 * true, wenn der Bon-Name klar nach Fleisch/Fisch klingt, der
 * Kandidat aber aus einer unpassenden Kategorie stammt.
 */
function conflictsWithCategory(parsedTokens, candidateCategory) {
  if (!looksLikeMeat(parsedTokens)) return false;
  return !MEAT_OK_CATEGORIES.has(candidateCategory);
}

/**
 * Kombinierter Ähnlichkeitswert.
 * Nimmt bewusst das MAXIMUM mehrerer Sichtweisen, statt zu mitteln:
 * Ein Verfahren darf das andere nicht nach unten ziehen, wenn es
 * für den konkreten Fall ungeeignet ist (Token-Vergleich versagt
 * bei Komposita, Levenshtein bei langen Zusatzwörtern, Jaccard bei
 * unterschiedlich detaillierten Bezeichnungen).
 */
function combinedSimilarity(parsedA, parsedB) {
  const jaccard = tokenSimilarity(parsedA.tokens, parsedB.tokens);
  const compound = compoundSimilarity(parsedA.tokens, parsedB.tokens);
  const overlap = overlapSimilarity(parsedA.tokens, parsedB.tokens);
  const tok = Math.max(jaccard, compound);
  const lev = levenshteinSimilarity(parsedA.core, parsedB.core);

  const weighted = tok * 0.65 + lev * 0.35;
  return Math.max(weighted, lev * 0.95, tok * 0.9, overlap * 0.92);
}

let CACHE = null;
let TOKEN_INDEX = null;

function buildIndex(catalog = FOOD_DATABASE) {
  if (CACHE) return CACHE;
  CACHE = catalog.map((p) => ({
    product: p,
    variants: [p.name, ...p.aliases].map(parseProductName)
  }));

  // Invertierter Index: Token -> Produkteinträge.
  // Ohne ihn wird jede Bon-Zeile gegen ALLE ~700 Namensvarianten
  // verglichen. Der Index reduziert das auf die Kandidaten, die
  // mindestens ein Wort teilen -- bei 1000 Zeilen war das im
  // Stresstest der mit Abstand langsamste Schritt.
  TOKEN_INDEX = new Map();
  CACHE.forEach((entry, idx) => {
    const tokens = new Set();
    entry.variants.forEach((v) => v.tokens.forEach((t) => {
      tokens.add(t);
      // Wortanfänge mitindizieren, damit Komposita gefunden werden
      // ("haehnchenbrustfilet" findet "haehnchenbrust")
      if (t.length >= 5) tokens.add(t.slice(0, 5));
    }));
    tokens.forEach((tok) => {
      if (!TOKEN_INDEX.has(tok)) TOKEN_INDEX.set(tok, new Set());
      TOKEN_INDEX.get(tok).add(idx);
    });
  });

  return CACHE;
}

/**
 * Liefert die Kandidaten, die mindestens ein Wort mit der Eingabe
 * teilen. Findet der Index nichts, wird auf den vollständigen
 * Vergleich zurückgefallen -- Geschwindigkeit darf nie auf Kosten
 * der Trefferqualität gehen.
 */
function candidateEntries(parsed) {
  if (!TOKEN_INDEX || parsed.tokens.length === 0) return CACHE;
  const hits = new Set();
  for (const tok of parsed.tokens) {
    const direct = TOKEN_INDEX.get(tok);
    if (direct) direct.forEach((i) => hits.add(i));
    if (tok.length >= 5) {
      const prefix = TOKEN_INDEX.get(tok.slice(0, 5));
      if (prefix) prefix.forEach((i) => hits.add(i));
    }
  }
  if (hits.size === 0) return CACHE;
  return [...hits].map((i) => CACHE[i]);
}

/**
 * Ordnet einen rohen Bon-Namen einem Produkt zu.
 * @returns {{productId, confidence, method, quantity, needsConfirmation}}
 */
function matchProduct(rawName, catalog = FOOD_DATABASE) {
  buildIndex(catalog);
  const parsed = parseProductName(rawName);
  const candidates = candidateEntries(parsed);

  let best = { productId: null, confidence: 0 };

  for (const entry of candidates) {
    for (let vi = 0; vi < entry.variants.length; vi++) {
      const variant = entry.variants[vi];

      /* Der eigene NAME schlägt alles — auch die Kategorieprüfung.
       *
       * Die Prüfung ist eine Sicherung gegen Fehlzuordnung: „Fischstäbchen"
       * soll nicht bei den Nudeln landen. Sie arbeitet über Wortstämme und
       * schlägt deshalb auch bei „Fischsauce" (Trockenware) und
       * „Fischfutter" (Tierbedarf) an — beide heißen wirklich so und sind
       * kein Fisch. Steht die Eingabe exakt auf dem Produkt, ist das keine
       * Vermutung mehr, die abgesichert werden müsste.
       *
       * `variants[0]` ist der Name, alles danach sind Aliase. Für Aliase
       * bleibt die Prüfung scharf: dort IST es eine Vermutung. */
      if (vi === 0 && variant.core === parsed.core) {
        return {
          productId: entry.product.id, confidence: 1, method: "exakt",
          quantity: parsed.quantity, needsConfirmation: false
        };
      }

      // Exakter Treffer nach Normalisierung
      if (variant.core === parsed.core && !conflictsWithCategory(parsed.tokens, entry.product.category)) {
        return {
          productId: entry.product.id, confidence: 1, method: "exakt",
          quantity: parsed.quantity, needsConfirmation: false
        };
      }
      let score = combinedSimilarity(parsed, variant);
      // Kategoriekonflikt: harte Abwertung statt stiller Fehlzuordnung
      if (conflictsWithCategory(parsed.tokens, entry.product.category)) score *= 0.45;
      if (score > best.confidence) best = { productId: entry.product.id, confidence: score };
    }
  }

  if (best.confidence >= SAFE_THRESHOLD) {
    return { ...best, confidence: Math.round(best.confidence * 100) / 100,
      method: "aehnlich", quantity: parsed.quantity, needsConfirmation: false };
  }
  if (best.confidence >= CONFIRM_THRESHOLD) {
    return { ...best, confidence: Math.round(best.confidence * 100) / 100,
      method: "unsicher", quantity: parsed.quantity, needsConfirmation: true };
  }
  return { productId: null, confidence: Math.round(best.confidence * 100) / 100,
    method: "kein_treffer", quantity: parsed.quantity, needsConfirmation: false };
}

/** Ganze Bon-Liste zuordnen, getrennt nach sicher / bestätigen / unbekannt. */
function matchReceipt(rawItems) {
  const matched = [], toConfirm = [], unmatched = [];
  for (const item of rawItems) {
    const r = matchProduct(item.name);
    const enriched = { ...item, ...r };
    if (r.needsConfirmation) toConfirm.push(enriched);
    else if (r.productId) matched.push(enriched);
    else unmatched.push(enriched);
  }
  return { matched, toConfirm, unmatched };
}

module.exports = {
  MAX_RAW_LENGTH,
  matchProduct, matchReceipt, parseProductName, combinedSimilarity, levenshtein,
  conflictsWithCategory, looksLikeMeat, MEAT_TOKENS,
  CONFIRM_THRESHOLD, SAFE_THRESHOLD
};
