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
  "st", "fl", "ds", "ew", "sort", "sortiert",
  /* "GL" und "VL" stehen bei Netto als zweibuchstabiges Eigenmarken-
     Kürzel VOR dem eigentlichen Produktnamen (vermutlich "Gut &
     Günstig" bzw. eine zweite Eigenmarke) — anders als ST/FL/DS/EW,
     die am Wortende stehen, blockieren diese am Wortanfang den
     gesamten restlichen Vergleich, nicht nur ein paar Punkte:
     "GL Proteinjogh.sort.200g" (kein Treffer, 0.45) wird ohne "GL"
     zu "Proteinjogh.sort.200g" (Vorschlag: Proteinriegel, 0.74).
     Geprüft: keines der beiden kollidiert mit einem echten
     Katalog-Token (test/matching.js). */
  "gl", "vl",
  /* "AS" (REWE/Netto: "American Style"-Toastbrot) und "KM" (Netto,
     Bedeutung nicht sicher geklärt, aber strukturell identisch zu
     GL/VL: ein zwei Buchstaben langes Kürzel vor dem eigentlichen
     Produktnamen) blockierten ebenfalls nur den Rest der Zeile:
     "AS Sandwich Vollkorn 750g" (kein Treffer) wird ohne "AS" zu
     "Sandwich Vollkorn 750g" (Vorschlag, 0.81). Geprüft: keine
     Kollision mit einem echten Katalog-Token (test/matching.js). */
  "as", "km",
  /* "HP" (High Protein) steht bei Netto und REWE vor drei
     verschiedenen Produkten aus zwei Ketten — "Layenb.HP Skyr",
     "GL HP Drink" und "HP TRIPLE DESS." (letzteres bereits ein
     exakter Katalogtreffer, der die Bedeutung bestätigt). Dasselbe
     Muster wie GL/VL/AS/KM: ein Kürzel vor dem eigentlichen Namen,
     das nur den Vergleich verwässert. "Layenb.HP Skyr sort. 200g"
     geht von 0.70 auf 0.81, "GL HP Drink sort. 330ml" von 0.69 auf
     0.81 — beide bleiben bewusst unter der „sicher"-Schwelle (Skyr-
     und Drink-Sorten unterscheiden sich, Bestätigung bleibt richtig),
     aber der Vorschlag wird eindeutiger. Der Katalog selbst enthält
     "hp" als Token nur in "HP TRIPLE DESS." (Alias) — das exakte
     Treffer-Alias vergleicht `core`, nicht `tokens`, bleibt also von
     dieser Änderung unberührt (test/matching.js). */
  "hp",
  /* "VKE" (Verkaufseinheit) und "QS" (Qualität und Sicherheit, das
     deutsche Fleisch-Prüfsiegel) sind Aufdrucke, keine Produktnamen —
     stehen aber genau dort, wo sie den Vergleich verwässern:
     "Champignon braun 400g VKE" springt ohne "VKE" von 0.78
     (unsicher) auf 0.89 — jetzt SICHER statt bestätigungspflichtig.
     "TK CHICKEN NUGGETS-QS" geht von 0.70 auf 0.81, bleibt bewusst
     unsicher (Fleisch/Fisch bekommt nie einen automatischen Treffer
     durch dieses Kürzel allein). Geprüft: keine Kollision mit einem
     echten Katalog-Token (test/matching.js). */
  "vke", "qs"
]);

/**
 * Trennt zusammengeklebte Wörter an Groß-/Kleinschreibungs- und
 * Ziffern-Grenzen, BEVOR alles klein geschrieben wird -- danach ist
 * dieses Signal für immer weg.
 *
 * Manche Kassen (v. a. Netto) drucken mehrere echte Wörter ohne
 * jedes Leerzeichen als EIN Druckwort: "GLGouda" ist "GL" + "Gouda",
 * "leichtHF3ger" ist "leicht" + "HF" + "3" + "ger". Ohne Trennung
 * bleibt das EIN einziges, langes Token -- Katalogwörter passen dann
 * nur noch über den Teilwort-Vergleich (`compoundSimilarity`, ab
 * fünf Zeichen), und ein kurzes Katalogwort wie "Gouda" (5 Zeichen)
 * geht darin unter, wenn davor noch mehr Buchstaben kleben.
 *
 * Reine Ergänzung, nie Entfernung: es werden ausschließlich
 * Leerzeichen EINGEFÜGT, nie Zeichen entfernt oder verändert. Ein
 * bereits sauber getrenntes „ZottProteinPuddingCho" wird dadurch
 * NICHT schlechter -- es zerfällt in einzelne Wörter, die einzeln
 * exakt auf Katalogtoken treffen, statt nur als langes Teilwort.
 * Volle Korpus-Messung bestätigt das (`test/matching.js`).
 */
function splitGlued(s) {
  return s
    // "GLGouda" -> "GL Gouda": Großbuchstaben-Lauf vor Großbuchstabe+Kleinbuchstabe
    .replace(/([A-ZÄÖÜ]+)([A-ZÄÖÜ][a-zäöüß])/g, "$1 $2")
    // "leichtHF" -> "leicht HF": Kleinbuchstabe vor Großbuchstabe
    .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2")
    // "HF3" -> "HF 3", "3ger" -> "3 ger": Ziffern-Grenzen in beide Richtungen
    .replace(/([A-Za-zÄÖÜäöüß])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-zÄÖÜäöüß])/g, "$1 $2");
}

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

/**
 * Welche Wörter trägt ein PUNKT als Kürzungszeichen — nicht geraten,
 * sondern gelesen, was die Kasse selbst markiert hat.
 *
 * „Proteinjogh." ist keine zufällig kurze Zeichenfolge: der Punkt
 * dahinter sagt „hier fehlt der Rest, abgeschnitten, weil die Spalte
 * zu schmal war". Dasselbe Zeichen, das gleich danach beim Bereinigen
 * zu einem Leerzeichen wird und damit verschwindet — bevor der
 * Vergleich es je zu Gesicht bekommt. Diese Funktion liest es vorher.
 *
 * Absichtlich auf „Buchstaben, dann Punkt" beschränkt: eine Zahl vor
 * einem Punkt ist ein Tausendertrennzeichen („1.234"), kein
 * abgekürztes Wort, und ein einzelner Buchstabe vor einem Punkt ist
 * eine Initiale („M.I Grana Padano"), kein Wortanfang.
 */
function truncatedStems(s) {
  const stems = new Set();
  const re = /([a-zäöüß]{2,})\./g;
  let m;
  while ((m = re.exec(s))) stems.add(m[1]);
  return stems;
}

/** Zerlegt "H-MILCH 3,5% 1L" in { core:"h milch 3,5%", quantity:1, unit:"l" } */
function parseProductName(raw) {
  let s = foldUmlauts(String(raw || "").slice(0, MAX_RAW_LENGTH).toLowerCase());
  const truncated = truncatedStems(s);

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

  return { core, tokens, quantity, unit, truncated };
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
 * Vom Drucker selbst markierte Kürzung — ein Präfix-Treffer, kein
 * Teilwort-Zufall.
 *
 * Der Unterschied zu `compoundSimilarity`: die dort geltende
 * 5-Zeichen-Grenze existiert, weil ein kurzes Teilwort IRGENDWO in
 * einem anderen Wort leicht zufällig passt. Bei einem Wort, das die
 * Kasse selbst mit einem Punkt als abgeschnitten markiert hat, ist
 * das kein Zufallsrisiko mehr — „Prot." VOR einem Katalogwort, das
 * mit „prot" beginnt, ist keine Übereinstimmung, die zufällig
 * entstehen könnte, sie ist die Kürzung. Deshalb reichen hier drei
 * Zeichen, und deshalb ausdrücklich nur PRÄFIX (das Katalogwort
 * beginnt damit), nicht „irgendwo enthalten" — ein Bon kürzt ein
 * Wort am Ende, nie in der Mitte.
 *
 * Gilt nur für `tokensA` (die Bon-Zeile): der Katalog ist die eigene,
 * kuratierte, immer vollständig ausgeschriebene Liste — dort wird
 * nichts gekürzt, also muss dort auch nichts erkannt werden.
 */
function truncationSimilarity(parsedA, tokensB) {
  if (!parsedA.truncated || !parsedA.truncated.size) return 0;
  let score = 0, betroffen = 0;
  for (const a of parsedA.tokens) {
    if (a.length < 3 || !parsedA.truncated.has(a)) continue;
    betroffen++;
    let best = 0;
    for (const b of tokensB) {
      if (b.startsWith(a)) {
        const ratio = a.length / b.length;
        best = Math.max(best, 0.82 + 0.18 * ratio);
      }
    }
    score += best;
  }
  if (!betroffen) return 0;
  return score / Math.max(parsedA.tokens.length, tokensB.length);
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
 * true, wenn JEDES identitätstragende Token der Bon-Zeile eine vom
 * Drucker selbst markierte Kürzung ist ("Semmel." aus "Semmelbrösel",
 * "Mascar." aus "Mascarpone") -- die Zeile besteht dann komplett aus
 * unvollständigen Fragmenten, nicht aus vollständig geschriebenen
 * Wörtern. Ausgelagert, weil sowohl der exakte Treffer in
 * `bestCandidate` als auch `combinedSimilarity` dieselbe Vorsicht
 * brauchen (siehe test/matching.js, Abschnitt L/M für beide Funde).
 */
function nurKuerzungen(parsed) {
  return parsed.tokens.length > 0 && parsed.tokens.every((t) => parsed.truncated.has(t));
}

/**
 * Bestmöglicher Levenshtein-Wert allein aus den LÄNGEN zweier
 * Zeichenketten — ohne die Matrix zu rechnen.
 *
 * Die Editierdistanz ist mindestens der Längenunterschied (jedes
 * fehlende Zeichen kostet eine Einfügung). Daraus ergibt sich eine
 * obere Schranke für die Ähnlichkeit, die in O(1) statt O(n·m) zu
 * haben ist. Wer diese Schranke schon nicht erreicht, kann den
 * bisher besten Kandidaten auch mit der echten Rechnung nicht mehr
 * schlagen — und die echte Rechnung ist die mit Abstand teuerste
 * Einzeloperation im ganzen Abgleich.
 */
function levenshteinObergrenze(a, b) {
  const la = a.length, lb = b.length;
  return 1 - Math.abs(la - lb) / Math.max(la, lb, 1);
}

/**
 * Kombinierter Ähnlichkeitswert.
 * Nimmt bewusst das MAXIMUM mehrerer Sichtweisen, statt zu mitteln:
 * Ein Verfahren darf das andere nicht nach unten ziehen, wenn es
 * für den konkreten Fall ungeeignet ist (Token-Vergleich versagt
 * bei Komposita, Levenshtein bei langen Zusatzwörtern, Jaccard bei
 * unterschiedlich detaillierten Bezeichnungen).
 *
 * `minNoetig` ist reine Beschleunigung, keine fachliche Regel: wer
 * nur wissen will, ob dieser Kandidat den bisher besten SCHLÄGT,
 * übergibt dessen Punktzahl. Steht schon aus den billigen Teilwerten
 * fest, dass das nicht mehr gelingen kann, wird die teure
 * Levenshtein-Matrix übersprungen und ein Wert ≤ `minNoetig`
 * zurückgegeben. Für `minNoetig = 0` (die Vorgabe) ist das Ergebnis
 * bitgenau dasselbe wie ohne diese Abkürzung — ein Test hält das über
 * alle drei Korpora hinweg fest.
 */
function combinedSimilarity(parsedA, parsedB, minNoetig = 0) {
  /* Versucht und wieder entfernt: eine noch billigere Vorstufe, die
     allein aus der WORTANZAHL abschätzt, ob ein Kandidat überhaupt
     gewinnen kann. Sie war falsch UND nutzlos. Falsch, weil
     `compoundSimilarity` über die Wörter der BON-ZEILE summiert und
     durch die größere der beiden Anzahlen teilt -- hat die Bon-Zeile
     mindestens so viele Wörter wie der Katalogeintrag, ist der Wert 1
     erreichbar, und die naheliegende Schranke min/max ist zu
     optimistisch (zwei Zeilen des Korpus bekamen dadurch ein
     schlechteres Ergebnis). Nutzlos, weil eben dieselbe Rechnung die
     Schranke fast immer auf 1 hebt und damit nie greift. Die
     Längen-Schranke unten bleibt, sie ist beides nicht. */
  const jaccard = tokenSimilarity(parsedA.tokens, parsedB.tokens);
  const compound = compoundSimilarity(parsedA.tokens, parsedB.tokens);
  const overlap = overlapSimilarity(parsedA.tokens, parsedB.tokens);
  const trunc = truncationSimilarity(parsedA, parsedB.tokens);
  const tok = Math.max(jaccard, compound);

  if (minNoetig > 0) {
    /* Alles außer Levenshtein ist billig (wenige Token, kurze
       Schleifen). Steht damit plus der reinen Längen-Obergrenze fest,
       dass der Kandidat nicht reicht, entfällt die Matrix ganz. */
    const truncVorab = Math.min(trunc * 0.9, SAFE_THRESHOLD - 0.01);
    const ohneLev = Math.max(tok * 0.9, overlap * 0.92, truncVorab);
    const levMax = levenshteinObergrenze(parsedA.core, parsedB.core);
    let schranke = Math.max(ohneLev, tok * 0.65 + levMax * 0.35, levMax * 0.95);
    if (nurKuerzungen(parsedA)) schranke = Math.min(schranke, SAFE_THRESHOLD - 0.01);
    if (schranke <= minNoetig) return schranke;
  }

  const lev = levenshteinSimilarity(parsedA.core, parsedB.core);

  const weighted = tok * 0.65 + lev * 0.35;
  /* Die Kürzungsregel darf bis an die Bestätigungs-Schwelle heran,
     aber NIE darüber hinaus bis zur „sicher"-Schwelle — auch nicht
     bei einem sehr sauberen Präfix wie „Gurk." → „Gurke". Der Punkt
     ist ein starkes Indiz, aber nie eine Gewissheit: „Kaes." trifft
     genauso auf Käsekuchen wie auf ein Dutzend anderer Käseprodukte,
     und ein Bon nennt nie, welches gemeint war. Jede Kürzung bleibt
     deshalb ein Vorschlag zum Bestätigen — dieselbe Regel, die auch
     für den Umweg über Open Food Facts gilt (siehe offLookup.js). */
  const truncCapped = Math.min(trunc * 0.9, SAFE_THRESHOLD - 0.01);
  const raw = Math.max(weighted, lev * 0.95, tok * 0.9, overlap * 0.92, truncCapped);

  /* Dieselbe Grenze gilt nicht nur für den eigens dafür gebauten
     Kürzungs-Pfad (`truncCapped`), sondern für JEDEN Weg, der zu ihr
     führt. Gefunden an einem echten, aus Open-Food-Facts-Namen
     erzeugten Härtefall: „Mascar." (Kürzung von „Mascarpone") traf
     „Mascara" mit 0.93 -- SICHER, automatisch gebucht -- nicht über
     `truncationSimilarity`, sondern über die gewöhnliche Kompositum-
     und Levenshtein-Bewertung, die den Kürzungspunkt gar nicht sieht
     und „mascar" wie ein vollständiges, sicher geschriebenes Wort
     behandelt. Betroffen ist das nur, wenn ALLE identitätstragenden
     Token der Bon-Zeile selbst gekürzt sind (bei „M.I Grana Padano
     St. 200g" trägt „st" die Kürzung, nicht „grana"/„padano" -- die
     bestehen den Vergleich unverändert als vollständige Wörter). */
  return nurKuerzungen(parsedA) ? Math.min(raw, SAFE_THRESHOLD - 0.01) : raw;
}

let CACHE = null;
let TOKEN_INDEX = null;
let PREFIX_INDEX = null;

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
      //
      // Versucht und wieder verworfen: dieselbe Indizierung zusätzlich
      // für WORTENDEN ("kefir" in "sahnekefir" finden, nicht nur
      // "sahne"). Gemessen über den vollen Bon-Korpus verschlechterte
      // das drei echte Zeilen, um eine einzige zu verbessern —
      // "RouOfenkaesGyrosStyle180g" verlor seinen einzigen Vorschlag
      // komplett (0.66 -> kein Treffer), "GL HP Drink sort. 330ml"
      // sprang auf "Sojamilch" statt "Proteindrink" (falscher Treffer
      // statt richtigem), "Romatomaten" verlor seine spezifischere
      // Zuordnung an die generische "Tomaten". Grund: ein Bon-Token
      // ohne jeden Index-Treffer fällt sonst auf den VOLLEN
      // Katalogvergleich zurück (der eigentlich beste Fall) — ein
      // zusätzlicher, aber falscher Wortenden-Treffer verhindert genau
      // diesen Rückfall. Drei echte Verschlechterungen für einen
      // Einzelfall, der ohnehin nur eine Randnennung geblieben wäre
      // (siehe test/matching.js, Abschnitt K), war der Handel nicht
      // wert.
      if (t.length >= 5) tokens.add(t.slice(0, 5));
    }));
    tokens.forEach((tok) => {
      if (!TOKEN_INDEX.has(tok)) TOKEN_INDEX.set(tok, new Set());
      TOKEN_INDEX.get(tok).add(idx);
    });
  });

  /* Zweiter Index, nur für die Kürzungs-Auflösung (siehe
     `kuerzungsAufloesung`): welcher Eintrag hat ein Token, das mit
     diesen zwei Buchstaben ANFÄNGT. Zwei Buchstaben sind für sich
     völlig unspezifisch -- der Index ist deshalb ausdrücklich KEIN
     Ersatz für TOKEN_INDEX, sondern nur die schnelle Vorauswahl für
     eine Regel, die anschließend mehrere Fragmente gleichzeitig
     verlangt und auf Eindeutigkeit besteht. */
  PREFIX_INDEX = new Map();
  CACHE.forEach((entry, idx) => {
    entry.variants.forEach((v) => v.tokens.forEach((t) => {
      if (t.length < 2) return;
      const p2 = t.slice(0, 2);
      if (!PREFIX_INDEX.has(p2)) PREFIX_INDEX.set(p2, new Set());
      PREFIX_INDEX.get(p2).add(idx);
    }));
  });

  return CACHE;
}

/**
 * Löst eine Bon-Zeile auf, die NUR aus abgeschnittenen Fragmenten
 * besteht und deshalb an der gewöhnlichen Ähnlichkeitsrechnung
 * scheitert: „Dema.R.Sp.400g" (Demae Ramen Spicy), „Milk.S.Kek.100g"
 * (Milka Schoko Keks), „P.Kr.Bal.1L" (Philadelphia Kräuter Balance).
 *
 * Solche Zeilen tragen einzeln betrachtet zu wenig Information --
 * „Kr." passt auf Kräuter, Kraut, Krabben, Kranzkuchen. Die Auflösung
 * entsteht erst aus dem ZUSAMMENSPIEL mehrerer Fragmente: verlangt
 * wird ein Katalogeintrag, bei dem JEDES Fragment ein Wort beginnt,
 * und zwar als EINZIGER im ganzen Katalog. Bleiben zwei Kandidaten
 * übrig, ist die Zeile ehrlich mehrdeutig und es wird nichts geraten.
 *
 * Drei Bedingungen halten das eng:
 *   1. Nur vom Drucker selbst mit einem Punkt als gekürzt markierte
 *      Fragmente zählen -- dieselbe Quelle wie `truncationSimilarity`,
 *      kein Raten an beliebig kurzen Wörtern.
 *   2. Mindestens ZWEI Fragmente. Ein einzelnes „But." darf nie ein
 *      Produkt bestimmen; gemessen am Korpus fällt die Genauigkeit
 *      mit einem einzelnen Fragment von 96 % auf 94,5 %.
 *   3. Genau EIN Katalogeintrag erfüllt alles.
 *
 * Das Ergebnis ist ausdrücklich ein VORSCHLAG zum Bestätigen, nie
 * eine automatische Buchung -- dieselbe Regel, die für jede andere
 * Kürzung gilt (siehe `combinedSimilarity`).
 */
function kuerzungsAufloesung(parsed) {
  if (!PREFIX_INDEX) return null;
  const fragmente = parsed.tokens.filter((t) => parsed.truncated.has(t) && t.length >= 2);
  if (fragmente.length < 2) return null;

  let treffer = null;
  for (const f of fragmente) {
    const grob = PREFIX_INDEX.get(f.slice(0, 2));
    if (!grob) return null;
    const genau = new Set();
    for (const idx of grob) {
      if (treffer && !treffer.has(idx)) continue;
      const entry = CACHE[idx];
      if (entry.variants.some((v) => v.tokens.some((t) => t.startsWith(f)))) genau.add(idx);
    }
    treffer = genau;
    if (treffer.size === 0) return null;
  }
  if (!treffer || treffer.size !== 1) return null;

  const entry = CACHE[[...treffer][0]];
  // Die Fleisch/Fisch-Sperre gilt hier genauso: eine eindeutige
  // Buchstabenfolge ist kein Grund, eine Sicherheitsregel auszusetzen.
  if (conflictsWithCategory(parsed.tokens, entry.product.category)) return null;
  return entry.product.id;
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
  if (hits.size > 0) return [...hits].map((i) => CACHE[i]);

  /* Kein Wort und kein Wortanfang traf -- typisch für eine Zeile aus
     lauter Fragmenten („Le.fei.200g"). Diese Zeilen waren mit Abstand
     die teuersten im ganzen Abgleich (gemessen 9,3 ms gegenüber
     0,07 ms für einen exakten Treffer), weil hier der VOLLE Katalog
     durchgerechnet wird.

     Es bleibt beim vollen Katalog -- aber in anderer REIHENFOLGE:
     wer wenigstens zwei Buchstaben Wortanfang teilt, kommt zuerst
     dran. `bestCandidate` hat damit sehr früh eine hohe Meßlatte, an
     der die Längen-Schranke in `combinedSimilarity` den ganzen Rest
     billig abweist, ohne je eine Levenshtein-Matrix zu rechnen.

     Ausdrücklich NICHT die naheliegendere Abkürzung, die Kandidaten
     ohne gemeinsamen Wortanfang ganz wegzulassen: gemessen über alle
     drei Korpora kostete das 36 Zeilen ihr Ergebnis (17 verloren
     einen sicheren Treffer, 19 ihren Vorschlag) und verbesserte
     genau eine. Ein Treffer kann eben allein aus der Levenshtein-
     Distanz über die ganze Zeile entstehen, ganz ohne gemeinsamen
     Wortanfang. Sortieren kostet nichts davon -- geprüft wird
     weiterhin jeder Eintrag, nur eben in klügerer Folge. */
  const bevorzugt = new Set();
  for (const tok of parsed.tokens) {
    if (tok.length < 2) continue;
    const p2 = PREFIX_INDEX && PREFIX_INDEX.get(tok.slice(0, 2));
    if (p2) p2.forEach((i) => bevorzugt.add(i));
  }
  if (bevorzugt.size === 0) return CACHE;
  const zuerst = [], danach = [];
  CACHE.forEach((entry, i) => (bevorzugt.has(i) ? zuerst : danach).push(entry));
  return zuerst.concat(danach);
}

/**
 * Bester Kandidat für EINE geparste Eingabe, gegen den ganzen Katalog.
 * Getrennt von matchProduct, damit dieselbe Bewertung sich auf mehrere
 * Lesarten derselben Bon-Zeile anwenden lässt (siehe splitGlued unten).
 */
function bestCandidate(parsed) {
  const candidates = candidateEntries(parsed);
  let best = { productId: null, confidence: 0, exact: false };
  /* Hängt nur an der Bon-Zeile, nicht am Kandidaten -- stand aber
     bisher in der inneren Schleife und wurde damit für JEDE der rund
     2500 Namensvarianten neu über alle Fleisch-Wortstämme gerechnet. */
  const nachFleisch = looksLikeMeat(parsed.tokens);
  const istNurKuerzung = nurKuerzungen(parsed);
  const kollidiert = (kategorie) => nachFleisch && !MEAT_OK_CATEGORIES.has(kategorie);

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
       * bleibt die Prüfung scharf: dort IST es eine Vermutung.
       *
       * AUSNAHME: besteht die Bon-Zeile NUR aus Kürzungen, ist „exakt"
       * kein Beweis mehr, nur ein kurzer Zufallstreffer. Gefunden im
       * synthetischen Härtefall-Korpus: „Semmel." (Kürzung von
       * „Semmelbrösel") trifft `core`-gleich auf „SEMMEL", ein echtes
       * Alias für „Brötchen" — Brösel und Brötchen sind aber zwei
       * verschiedene Produkte. Ohne die Ausnahme hätte das mit
       * Konfidenz 1 automatisch gebucht, ganz ohne die Schwellen, die
       * für jeden anderen unsicheren Fall gelten (siehe Abschnitt L
       * für den verwandten Fund am gewöhnlichen Bewertungspfad). */
      if (variant.core === parsed.core && !istNurKuerzung) {
        if (vi === 0) return { productId: entry.product.id, confidence: 1, exact: true };
        if (!kollidiert(entry.product.category)) {
          return { productId: entry.product.id, confidence: 1, exact: true };
        }
      }
      const konflikt = kollidiert(entry.product.category);
      /* Bei Kategoriekonflikt wird am Ende mit 0,45 multipliziert --
         die Schwelle, die der Kandidat VOR der Abwertung reißen muss,
         liegt also entsprechend höher. Das früher zu wissen spart die
         Levenshtein-Matrix in genau den Fällen, die ohnehin verlieren. */
      const minNoetig = konflikt ? best.confidence / 0.45 : best.confidence;
      let score = combinedSimilarity(parsed, variant, minNoetig);
      // Kategoriekonflikt: harte Abwertung statt stiller Fehlzuordnung
      if (konflikt) score *= 0.45;
      if (score > best.confidence) best = { productId: entry.product.id, confidence: score, exact: false };
    }
  }
  return best;
}

/**
 * Die besten `n` VERSCHIEDENEN Produkte für eine geparste Eingabe —
 * für die Bestätigungsfrage in der Oberfläche ("drei Vorschläge"),
 * nicht für den automatischen Abgleich. Ein Produkt taucht höchstens
 * einmal auf, auch wenn mehrere seiner Aliase treffen: nur der beste
 * Treffer pro Produkt zählt.
 */
function topCandidates(parsed, n) {
  const candidates = candidateEntries(parsed);
  const bestPerProduct = new Map();

  for (const entry of candidates) {
    for (let vi = 0; vi < entry.variants.length; vi++) {
      const variant = entry.variants[vi];
      // Dieselbe Ausnahme wie in bestCandidate: eine reine Kürzung darf
      // sich in der Vorschlagsliste nicht als "100 %" ausgeben.
      let score = (variant.core === parsed.core && !nurKuerzungen(parsed))
        ? 1 : combinedSimilarity(parsed, variant);
      if (conflictsWithCategory(parsed.tokens, entry.product.category)) score *= 0.45;
      const prev = bestPerProduct.get(entry.product.id) || 0;
      if (score > prev) bestPerProduct.set(entry.product.id, score);
    }
  }

  return [...bestPerProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([productId, confidence]) => ({ productId, confidence: Math.round(confidence * 100) / 100 }));
}

/**
 * Bis zu `n` Vorschläge für eine rohe Bon-Zeile, sortiert nach
 * Punktzahl — Grundlage für die Drei-Vorschläge-Frage. Nutzt
 * dieselbe Zwei-Lesarten-Logik wie `matchProduct` (Original UND
 * getrennt, siehe `splitGlued`), damit die Vorschläge nie schwächer
 * sind als das, was der automatische Abgleich selbst gefunden hätte.
 */
function topMatches(rawName, catalog = FOOD_DATABASE, n = 3) {
  buildIndex(catalog);
  const rawStr = String(rawName || "");
  const parsed = parseProductName(rawStr);
  const merged = new Map();
  topCandidates(parsed, n).forEach((c) => merged.set(c.productId, c.confidence));

  const alt = splitGlued(rawStr);
  if (alt !== rawStr) {
    topCandidates(parseProductName(alt), n).forEach((c) => {
      const prev = merged.get(c.productId) || 0;
      if (c.confidence > prev) merged.set(c.productId, c.confidence);
    });
  }

  /* Dieselbe Kürzungs-Auflösung wie in `matchProduct`, damit die
     Bestätigungskarte nicht leer bleibt, wo der automatische Abgleich
     sehr wohl einen Vorschlag hat. Nach vorne einsortiert nur, wenn
     die gewöhnliche Rechnung nichts Besseres kennt. */
  const ausFragmenten = kuerzungsAufloesung(parsed);
  if (ausFragmenten && (merged.get(ausFragmenten) || 0) < SAFE_THRESHOLD - 0.01) {
    merged.set(ausFragmenten, SAFE_THRESHOLD - 0.01);
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([productId, confidence]) => ({ productId, confidence }));
}

/**
 * Ordnet einen rohen Bon-Namen einem Produkt zu.
 * @returns {{productId, confidence, method, quantity, needsConfirmation}}
 */
function matchProduct(rawName, catalog = FOOD_DATABASE) {
  buildIndex(catalog);
  const rawStr = String(rawName || "");
  const parsed = parseProductName(rawStr);
  let winner = bestCandidate(parsed);
  let quantity = parsed.quantity;

  /* Zweite Lesart NUR bei tatsächlich zusammengeklebten Wörtern
   * ("GLGouda", "TheRealStrawbKiw") -- und NUR als Ergänzung, nie als
   * Ersatz. Der Grund: Trennen hilft, wenn ein Katalogwort erst durch
   * die Lücke sichtbar wird ("gouda" in "GLGouda") -- schadet aber
   * einem bereits gültigen Treffer, wenn die Kürzung SELBST das
   * passende Alias-Wort war ("IronMa" -> Alias "IRONMA") und die
   * Trennung sie in zwei bedeutungslose Bruchstücke zerlegt
   * ("Iron"+"Ma"). Deshalb wird nie ersetzt, sondern nur verglichen --
   * das schlechtere Ergebnis kann dadurch nie schlechter werden als
   * ohne diese Erweiterung, nachgewiesen über die volle
   * Korpus-Messung (`test/matching.js`, Abschnitt H). */
  if (!winner.exact) {
    const alt = splitGlued(rawStr);
    if (alt !== rawStr) {
      const parsedAlt = parseProductName(alt);
      const winnerAlt = bestCandidate(parsedAlt);
      if (winnerAlt.confidence > winner.confidence) {
        winner = winnerAlt;
        quantity = parsedAlt.quantity;
      }
    }
  }

  if (winner.exact) {
    return { productId: winner.productId, confidence: 1, method: "exakt",
      quantity, needsConfirmation: false };
  }
  if (winner.confidence >= SAFE_THRESHOLD) {
    return { productId: winner.productId, confidence: Math.round(winner.confidence * 100) / 100,
      method: "aehnlich", quantity, needsConfirmation: false };
  }
  if (winner.confidence >= CONFIRM_THRESHOLD) {
    return { productId: winner.productId, confidence: Math.round(winner.confidence * 100) / 100,
      method: "unsicher", quantity, needsConfirmation: true };
  }

  /* Letzter Versuch, und nur hier: die gewöhnliche Ähnlichkeit hat
     nichts gefunden. Eine Zeile aus lauter Fragmenten („Dema.R.Sp.")
     kann trotzdem eindeutig sein, wenn alle Fragmente zusammen auf
     genau einen Katalogeintrag passen -- gemessen am Korpus löst das
     1140 sonst völlig unbeantwortete Zeilen mit 96 % Genauigkeit auf.
     Bewusst NACH allen anderen Wegen: wo die reguläre Rechnung schon
     etwas gefunden hat, wird ihr nicht hineingeredet. Und bewusst als
     Vorschlag, nie als Buchung -- deshalb dieselbe gedeckelte
     Punktzahl, die auch jede andere Kürzung bekommt. */
  const ausFragmenten = kuerzungsAufloesung(parsed);
  if (ausFragmenten) {
    return { productId: ausFragmenten, confidence: SAFE_THRESHOLD - 0.01,
      method: "kuerzung", quantity, needsConfirmation: true };
  }

  return { productId: null, confidence: Math.round(winner.confidence * 100) / 100,
    method: "kein_treffer", quantity, needsConfirmation: false };
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
  matchProduct, matchReceipt, topMatches, parseProductName, combinedSimilarity, levenshtein,
  compoundSimilarity, truncationSimilarity, truncatedStems, splitGlued,
  conflictsWithCategory, looksLikeMeat, MEAT_TOKENS, kuerzungsAufloesung, levenshteinObergrenze,
  CONFIRM_THRESHOLD, SAFE_THRESHOLD
};
