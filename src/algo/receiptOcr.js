/**
 * receiptOcr.js — vom erkannten Text zum lesbaren Bon
 * ================================================================
 * Die Texterkennung selbst steckt nicht hier. Sie ist ein fremdes
 * Programm (Tesseract, siehe src/ui/vendor), läuft im Browser und
 * liefert eine Zeichenkette. Was sie liefert, ist aber noch kein
 * Bon — und dieser Abstand ist die eigentliche Arbeit.
 *
 * DREI DINGE GEHEN BEI EINEM FOTO SCHIEF:
 *
 * 1. SPALTEN WERDEN ZU LEERZEICHEN.
 *    `receiptParser` erkennt eine Position daran, dass zwischen
 *    Name und Preis MINDESTENS ZWEI Leerzeichen stehen — auf einem
 *    Bon ist das eine Spalte, kein Zufall. Die Texterkennung macht
 *    daraus mal zwei, mal eins, mal sieben. Ohne Ausrichtung fällt
 *    jede zweite Zeile durch.
 *
 * 2. ZIFFERN WERDEN ZU BUCHSTABEN.
 *    Auf Thermopapier ist die Null ein O, die Eins ein l, die Fünf
 *    ein S. Im NAMEN ist das halb so wild — der Produktabgleich
 *    verträgt Tippfehler. Im PREIS ist es fatal: aus 2,O9 wird gar
 *    kein Betrag, die Zeile verschwindet. Deshalb wird ausdrücklich
 *    NUR im Zahlenbereich zurückübersetzt, nie im Namen. „SOO g
 *    Mehl" darf nicht zu „500 g" werden, wenn es „Soo" heißt.
 *
 * 3. ES STEHT MEHR AUF DEM BILD ALS DER EINKAUF.
 *    Kopfzeilen, Steuer-Nummer, Adresse, Öffnungszeiten, ein
 *    Werbespruch, der Kartenbeleg. Alles hat Zahlen, nichts davon
 *    ist ein Produkt.
 *
 *    Der schlimmste Fall ist der Treue-Block am Fuß. „Aktuelles
 *    Bonus-Guthaben: 2,49 EUR" sieht aus wie eine Position und
 *    wurde auch als eine gebucht. Dagegen hilft kein Wörterbuch,
 *    sondern eine Struktur: hinter der Summenzeile steht kein
 *    Einkauf mehr. Deshalb wird die Summenzeile jetzt ausdrücklich
 *    DURCHGELASSEN statt als Rauschen verworfen — sie ist der
 *    Schlussstrich, und ohne sie liest der Parser den ganzen Fuß
 *    als Waren.
 *
 * GRUNDSATZ: LIEBER EINE ZEILE ZU WENIG.
 * Eine übersehene Position merkt der Nutzer sofort — sie fehlt in
 * der Liste, die er vor sich sieht, und er tippt sie nach. Eine
 * erfundene Position dagegen wandert still in die Historie und
 * verschiebt einen Rhythmus, den danach niemand mehr erklären kann.
 * Deshalb sind alle Schwellen hier streng und alle Zweifel gehen
 * gegen die Zeile.
 *
 * Das Ergebnis ist bewusst wieder TEXT im Format, das
 * `receiptParser` ohnehin liest. Keine zweite Bon-Grammatik: die
 * eine, die an echten Bons kalibriert ist, bleibt die einzige.
 * ================================================================
 */

/* Ein Betrag am Zeilenende: 1,29 / -0,08 / 12.99 — die
   Texterkennung verwechselt Komma und Punkt nach Belieben. */
const RE_AMOUNT = /(-?\d{1,4}[.,]\d{2})(?!\d)/g;

/* Zeilen, die nie eine Position sind. Bewusst als Anfang geprüft:
   „Summe" mitten im Produktnamen gibt es, am Zeilenanfang nicht. */
const NOISE_PREFIX = [
  "summe", "gesamt", "zu zahlen", "zahlen", "geg", "rueckgeld", "rückgeld",
  "bar", "ec", "girocard", "kartenzahlung", "mastercard", "visa", "kontaktlos",
  "mwst", "ust", "steuer", "netto", "brutto", "betrag", "trm", "terminal",
  "beleg", "bon", "kassenbon", "rechnung", "quittung", "datum", "uhrzeit",
  "kasse", "bediener", "vielen dank", "danke", "auf wiedersehen", "tel",
  "telefon", "ustid", "ust-id", "steuernr", "hdb", "filiale", "markt",
  "oeffnungszeiten", "öffnungszeiten", "www", "http", "punkte", "karte",
  "eur", "gutschein", "coupon-", "posten", "artikel", "stk gesamt",
  "zwischensumme", "trinkgeld", "aut", "gen nr", "ta-nr", "as-zeit",
  // ALDI druckt die Zwischensumme abgekürzt UND mittendrin, nicht nur
  // am Ende: „ZWI.SUMME 7,49" nach den ersten drei Positionen, dann
  // noch einmal „ZWI.SUMME 25,74" nach der letzten. Der ausgeschriebene
  // Eintrag oben fängt das nicht — „zwi." ist ein anderes Wort.
  "zwi.summe", "zwi summe", "zwi.-summe"
];

/* Zeilen mit diesen Wörtern SIND Positionen, auch wenn sie oben
   verdächtig aussehen — „Pfand" beginnt mit P, aber der Parser
   braucht die Zeile. */
const KEEP_PREFIX = [
  "pfand", "leergut", "mehrwegleergut", "einwegleergut", "ew-pfand", "mw-pfand",
  "preisvorteil", "rabatt", "lidl plus", "gratis"
];

/* Der Treue- und Werbeblock am Fuß. Diese Wörter stehen NIE in
   einem Produktnamen und mitten in der Zeile, nicht am Anfang —
   deshalb eine eigene Liste, die überall sucht.

   Sie ist der zweite Riegel, nicht der erste: normalerweise
   schneidet die Summenzeile den ganzen Fuß ohnehin ab. Erst wenn
   die Texterkennung genau diese eine Zeile verliert, wird die
   Liste gebraucht. */
const NOISE_CONTAINS = [
  "bonus-guthaben", "bonusguthaben", "bonus-vorteile", "bonus-coupon", "bonuspunkte",
  "guthaben", "gesammelt", "deutschlandcard", "payback", "treuepunkte",
  "rabattberechtigt", "punkte erhalten", "app aktivieren", "gutschein-code"
];

/* Ab wann eine Zahl kein Preis mehr ist. Über 300 € steht auf einem
   Lebensmittelbon höchstens die Kartennummer oder das Jahr. */
const MAX_ITEM_EUROS = 300;

/* Ein Produktname ist kürzer als das, was die Erkennung aus einer
   Adresszeile macht — und länger als ein Rest von Rauschen. */
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 48;

/* Unter diesem Anteil brauchbarer Zeilen war es kein Bon, sondern
   ein Bild von etwas anderem. */
const MIN_ITEM_LINES = 2;
const LOW_QUALITY_RATIO = 0.15;

/** Bekannte Ketten — für den Markt-Namen, nicht für die Logik. */
const STORE_NAMES = [
  "Lidl", "Aldi", "Aldi Süd", "Aldi Nord", "Rewe", "Edeka", "Penny", "Netto",
  "Kaufland", "Real", "Norma", "Tegut", "Denns", "Alnatura", "dm", "Rossmann",
  "Müller", "Globus", "Famila", "Combi", "Marktkauf", "Hit", "Nahkauf",
  "Trinkgut", "Getränkeland", "Bio Company", "Basic", "Metro", "Selgros"
];

/* Schreibweisen, unter denen dieselbe Kette auf dem Bon steht.
   Der E-center-Bon trägt im Kopf nur das Logo — „EDEKA" fällt erst
   zwanzig Zeilen weiter unten in der Firmierung. Wer nur nach
   „Edeka" sucht, findet auf einem EDEKA-Bon keinen Markt. */
const STORE_ALIASES = {
  "ecenter": "Edeka", "e center": "Edeka", "e neukauf": "Edeka",
  "aldi sued": "Aldi Süd", "aldi nord": "Aldi Nord",
  "netto marken discount": "Netto", "netto online": "Netto",
  "penny markt": "Penny", "rewe city": "Rewe", "rewe center": "Rewe"
};

/**
 * Ziffernverwechslungen zurückdrehen — NUR in einem Betragswort.
 *
 * Was als Betragswort gilt, entscheidet `RE_AMOUNT_WORD` unten, und
 * das ist der ganze Trick: „2,O9" steht zwischen Nicht-Buchstaben und
 * enthält eine echte Ziffer, „Joghurt" nicht. Ohne diese Eingrenzung
 * wird aus jedem Namen Kauderwelsch, und der Produktabgleich, der
 * Tippfehler ohnehin verträgt, verliert seine beste Grundlage.
 */
const DIGIT_LOOKALIKE = {
  O: "0", o: "0", Q: "0", D: "0",
  I: "1", l: "1", "|": "1", "!": "1", i: "1",
  S: "5", s: "5", B: "8", G: "6", T: "7", Z: "2", g: "9", b: "6"
};

const LOOKALIKE_CLASS = "0-9OoQDIl|!iSsBGTZgb";

/* Ein Betragswort: bis zu vier Stellen, Trennzeichen, zwei Stellen —
   wobei jede „Stelle" auch ein verwechseltes Zeichen sein darf. Die
   Grenzen links und rechts sind der Kern: direkt an einem Buchstaben
   ist es kein Betrag, sondern ein Wortteil. Ohne diese Grenzen wird
   aus „Bio" ein „8io" und aus „Soja" ein „5oja". */
const RE_AMOUNT_WORD = new RegExp(
  `(^|[^A-Za-zÄÖÜäöüß])([${LOOKALIKE_CLASS}]{1,4}[.,][${LOOKALIKE_CLASS}]{2})(?![A-Za-zÄÖÜäöüß0-9])`,
  "g"
);

function repairDigits(line) {
  return String(line).replace(RE_AMOUNT_WORD, (ganz, vorher, wort) => {
    // Ein Betragswort ohne eine einzige echte Ziffer ist wahrscheinlich
    // gar keine Zahl („Sl,SO" könnte alles sein) — Finger weg.
    if (!/[0-9]/.test(wort)) return ganz;
    const repariert = [...wort]
      .map((c) => (c === "." || c === "," ? c : DIGIT_LOOKALIKE[c] || c))
      .join("");
    return vorher + repariert;
  });
}

/**
 * Zeilenweise aufräumen: Zeichen, die keine Kasse druckt, raus;
 * Punkt zwischen Ziffern zu Komma, weil die Erkennung beides
 * verwechselt und der Parser mit beidem umgehen kann, der Mensch
 * beim Nachlesen aber nicht.
 */
function cleanLine(line) {
  return repairDigits(String(line))
    // Steuerkennzeichen am Zeilenende (A/B/1/2) — es steht HINTER dem
    // Betrag und schiebt sich sonst zwischen Preis und Zeilenende.
    // Damit scheitert die Mengenerkennung, und aus „1,15 x 2  2,30"
    // wird eine Position zum Gesamtpreis mit Menge 1.
    //
    // Der Stern für „nicht rabattfähig" steht mal davor, mal
    // dahinter: REWE druckt „0,25 A *", Netto „4,00* A". Beide
    // Stellungen müssen weg, sonst bleibt ein Zeichen zwischen
    // Betrag und Zeilenende stehen und die Zeile fällt durch.
    .replace(/(\d[.,]\d{2})\s*\*?\s*[A-Z12]?\s*\*?\s*$/, "$1")
    .replace(/[«»“”„"‚'`´]/g, "")
    .replace(/[¥€$]/g, " ")
    .replace(/\s*€\s*/g, " ")
    // Auch ausgeschrieben: REWE druckt „PFAND 0,25 EURO".
    .replace(/\bEUROS?\b/gi, " ")
    .replace(/\bEUR\b/gi, " ")
    .replace(/[^\wÄÖÜäöüß0-9,.\-+*%/&()\s]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trimEnd();
}

/**
 * Ist dieser Name ein Satz statt eines Produkts?
 *
 * Kassennamen sind abgekürzt bis zur Unkenntlichkeit — der längste
 * auf allen vier echten Bons hat fünf Wörter („Active O2 Cherry
 * 1x0,75L FL"), die allermeisten haben zwei oder drei. Wer sechs
 * Wörter in die 48 Zeichen bekommt, die ein Name hier haben darf,
 * schreibt keine Abkürzungen mehr, sondern Prosa: „Mit diesem
 * Einkauf hast du 0,09 EUR". Das ist der Werbefuß, und der ist
 * kein Einkauf.
 *
 * Geprüft wird erst am fertigen Namen, nicht am Zeilenrest: sonst
 * zählt bei „High Protein Kaffee 1,15 x 2 2,30" die Mengenangabe
 * als drei Wörter mit, und eine echte Position fällt durch.
 */
function istProsa(name) {
  return String(name).trim().split(/\s+/).length >= 6;
}

/** Ist das eine Kopf-, Fuß- oder Zahlungszeile? */
function isNoise(line) {
  const l = line.trim().toLowerCase();
  if (!l) return true;
  if (KEEP_PREFIX.some((k) => l.startsWith(k))) return false;
  if (NOISE_PREFIX.some((n) => l.startsWith(n))) return true;
  if (NOISE_CONTAINS.some((n) => l.includes(n))) return true;
  // Datum, Uhrzeit, lange Nummernfolgen: nie ein Produkt.
  if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/.test(l)) return true;
  if (/^\d{1,2}:\d{2}/.test(l)) return true;
  if (/^[\d\s.\-*#]{8,}$/.test(l)) return true;
  /* Öffnungszeiten schreiben die Uhrzeit auch mit Punkt statt
     Doppelpunkt: „MO.-SA. 8.00 UHR - 20.00 UHR". Ohne dieses Wort
     sieht „20.00" aus wie ein Betrag mit Komma-Punkt-Verwechslung —
     genau der Fall, den repairDigits eigentlich reparieren soll —
     und „MO.-SA. 8.00 UHR" wird zum Produktnamen. Das Wortende „uhr"
     als eigenständiges Wort kommt in keinem Produktnamen vor; die
     Wortgrenze davor lässt „Kuckucksuhr" unangetastet. Gefunden an
     einem echten ALDI-Bon (Hesel, 2019), dessen Öffnungszeiten-Zeile
     sonst zu einer 20-Euro-Fantasieposition geworden wäre. */
  if (/\buhr\b/i.test(l)) return true;
  // Reine Großbuchstaben-Adresse ohne Betrag ist ein Kopf.
  if (!RE_AMOUNT.test(line) && l.length > 24) { RE_AMOUNT.lastIndex = 0; return true; }
  RE_AMOUNT.lastIndex = 0;
  return false;
}

/**
 * Eine Zeile in die Spaltenform bringen, die `receiptParser`
 * erwartet: Name, mindestens zwei Leerzeichen, Betrag.
 *
 * @returns {null|string} null = keine Position
 */
function alignLine(line) {
  const clean = cleanLine(line);
  if (!clean.trim()) return null;

  // Gewichtszeile („0,199 kg x 22,99 EUR/kg") gehört zur Position
  // darüber und behält ihre Einrückung — der Parser erkennt sie
  // genau daran.
  const gewicht = clean.match(/^\s*(\d+[.,]\d+)\s*(kg|g)\s*[xX*]\s*(\d+[.,]\d{2})/);
  if (gewicht) return `   ${gewicht[1]} ${gewicht[2]} x ${gewicht[3]} EUR/${gewicht[2]}`;

  /* Nackte Mengenzeile: „2 Stk x 2,79" (REWE, steht UNTER der
     Position) oder „16 x 0,89" (Netto, steht DARÜBER). Vorher fiel
     die REWE-Form durch und wurde zu einer erfundenen Position
     namens „2 Stk x" — die Netto-Form flog raus, weil „16 x" keine
     zwei Buchstaben hat. Beides ist jetzt dieselbe Zeilenart; wohin
     sie gehört, rechnet der Parser aus. */
  const menge = clean.match(/^\s*(\d{1,3})\s*(?:Stk|St|Stck|Stück)?\.?\s*[xX*]\s*(\d+[.,]\d{2})\s*$/i);
  if (menge) return `   ${menge[1]} x ${menge[2].replace(".", ",")}`;

  /* Die Summenzeile — ausdrücklich behalten, nicht verwerfen.
     Sie ist für den Parser der Schlussstrich (alles danach ist
     Zahlung, Steuer und Werbung) UND die einzige Gegenprobe, die
     ein Bon von sich aus anbietet. Die Steuertabelle nennt ihre
     Zwischensummen auch „SUMME MwSt" — die ist keine. */
  if (/^\s*(SUMME|Summe|GESAMT|Gesamtbetrag|Gesamtsumme|zu zahlen)\b/i.test(clean) &&
      !/\b(MwSt|MWST|USt|UST|Steuer)\b/i.test(clean)) {
    const betraege = [...clean.matchAll(RE_AMOUNT)];
    RE_AMOUNT.lastIndex = 0;
    if (betraege.length) return `SUMME  ${betraege[betraege.length - 1][1].replace(".", ",")}`;
    return null;
  }

  /* Rabattzeile. Das Rabattwort steht nicht immer vorn: Netto
     schreibt „25% Rabatt" und „0.20€ Rabatt". Anker sind deshalb
     das Wort IRGENDWO und das Minus am Zeilenende. */
  const rabatt = clean.match(/^\s*(\S.*?)\s+(-\d+[.,]\d{2})\s*$/);
  if (rabatt && /(Preisvorteil|Lidl\s*Plus\s*Rabatt|Sofortrabatt|Treuerabatt|Rabatt|Nachlass|Coupon|Gutschein|GRATIS|Gratis)/i.test(rabatt[1])) {
    return `   ${rabatt[1].trim()}  ${rabatt[2].replace(".", ",")}`;
  }

  if (isNoise(clean)) return null;

  const betraege = [...clean.matchAll(RE_AMOUNT)];
  if (!betraege.length) return null;

  const letzter = betraege[betraege.length - 1];
  const roh = parseFloat(letzter[1].replace(",", "."));
  const wert = Math.abs(roh);
  if (!Number.isFinite(wert) || wert === 0 || wert > MAX_ITEM_EUROS) return null;

  // Kein „x" in dieser Klasse: aus „Müsli Mix" würde sonst „Müsli Mi".
  const name = clean.slice(0, letzter.index).replace(/[\s.\-*]+$/, "").trim();

  /* Ein negativer Betrag ist ein Abzug, kein Produktpreis. Die
     Rabattzeilen sind oben schon abgefangen; was hier noch negativ
     ankommt, ist entweder zurückgegebenes Leergut oder eine
     Stornierung, ein Lesefehler.

     ZURÜCKGEGEBENES LEERGUT MUSS DURCH. „Einwegleergut 19% -6,00"
     sind sechs Euro, die der Kunde wiederbekommt. Wer die Zeile
     wegwirft, bekommt die Endsumme nie hin und hält am Ende jeden
     Bon mit Flaschenrückgabe für falsch gelesen. Alles andere
     Negative fliegt weiter raus: eine Position mit negativem Preis
     würde in der Historie einen Kaufpreis unter null erzeugen —
     der Zufallstest hat genau das gefunden. */
  if (roh < 0 && !/^\s*(?:einweg|mehrweg|ew|mw)?[-\s]?(?:pfand|leergut)/i.test(name)) return null;
  if (name.length < MIN_NAME_LENGTH) return null;
  if (name.length > MAX_NAME_LENGTH) return null;
  // Ein Name, der nur aus Ziffern besteht, ist eine Nummer.
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(name)) return null;

  const preis = letzter[1].replace(".", ",");

  // Menge inline: „Name 1,15 x 2 2,30" — der Parser kann das, aber
  // nur in genau dieser Schreibweise.
  if (betraege.length >= 2) {
    const menge = clean.match(/(\d+[.,]\d{2})\s*[xX*]\s*(\d+)\s+(-?\d+[.,]\d{2})\s*$/);
    if (menge) {
      const kopf = clean.slice(0, clean.indexOf(menge[0])).replace(/[\s.\-]+$/, "").trim();
      if (kopf.length >= MIN_NAME_LENGTH && !istProsa(kopf)) {
        return `${kopf}  ${menge[1].replace(".", ",")} x ${menge[2]}  ${menge[3].replace(".", ",")}`;
      }
    }
  }

  if (istProsa(name)) return null;

  return `${name}  ${preis}`;
}

/**
 * Erkannten Text in Bon-Text übersetzen.
 * @returns {{text:string, lines:number, kept:number, dropped:Array<string>}}
 */
function ocrToReceiptText(raw) {
  const zeilen = String(raw || "").split(/\r?\n/);
  const out = [];
  const dropped = [];
  zeilen.forEach((z) => {
    if (!z.trim()) return;
    const a = alignLine(z);
    if (a) out.push(a);
    else if (z.trim().length > 3) dropped.push(z.trim());
  });
  return {
    text: out.join("\n"),
    lines: zeilen.filter((z) => z.trim()).length,
    kept: out.length,
    dropped
  };
}

/** Datum aus dem Bild: erstes plausibles Tagesdatum. */
function ocrDate(raw, today) {
  const text = String(raw || "");
  const treffer = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!treffer) return null;
  let [, t, m, j] = treffer;
  t = parseInt(t, 10); m = parseInt(m, 10); j = parseInt(j, 10);
  if (j < 100) j += 2000;
  if (m < 1 || m > 12 || t < 1 || t > 31) return null;
  const iso = `${j}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
  // Ein Bon aus der Zukunft ist ein Lesefehler, kein Einkauf.
  if (today && iso > today) return null;
  // Und einer von 2011 ist die Steuernummer.
  if (today && iso < String(Number(today.slice(0, 4)) - 2) + today.slice(4)) return null;
  return iso;
}

/**
 * Markt aus dem Bon.
 *
 * ZWEI DINGE, DIE HIER SCHON SCHIEFGEGANGEN SIND:
 *
 * 1. GESUCHT WURDE OHNE WORTGRENZEN.
 *    „dm" steht in der Liste — und in „Handmixer", „Sandmehl",
 *    „Feldmais". „Real" steckt in „Realschulweg". Ein Teilstring
 *    ist kein Markt; gesucht wird jetzt nach ganzen Wörtern.
 *    (Derselbe Fehler saß in priceShare.chainOf und ist dort
 *    schon behoben — hier stand er noch.)
 *
 * 2. GESUCHT WURDE NUR IM KOPF.
 *    Auf dem E-center-Bon steht oben nur das Logo; „EDEKA" fällt
 *    erst in Zeile 21 in der Firmierung. Der Kopf hat weiter
 *    Vorrang — dort steht der Markt, wenn er irgendwo steht —
 *    aber wenn er dort fehlt, wird der Rest gelesen, statt
 *    aufzugeben.
 */
function ocrStore(raw) {
  const text = String(raw || "");
  const kopf = text.split(/\r?\n/).slice(0, 12).join(" ");

  const suche = (heuhaufen) => {
    // Alles, was kein Buchstabe und keine Ziffer ist, wird zur
    // Wortgrenze — „E-center", „E center" und „Ecenter." sind
    // danach dasselbe.
    const h = " " + heuhaufen.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim() + " ";
    const treffer = (schreibweise) => h.includes(" " + schreibweise + " ");

    for (const [alias, kette] of Object.entries(STORE_ALIASES)) {
      if (treffer(alias)) return kette;
    }
    // Längste Treffer zuerst, damit „Aldi Süd" vor „Aldi" gewinnt.
    const sortiert = [...STORE_NAMES].sort((a, b) => b.length - a.length);
    for (const s of sortiert) {
      if (treffer(s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").trim())) return s;
    }
    return null;
  };

  return suche(kopf) || suche(text);
}

/**
 * Wie gut war das Bild? Ein Urteil, kein Wert zwischen 0 und 1 —
 * der Nutzer braucht einen Satz, keine Prozentzahl, die ihm nichts
 * sagt und die er nicht beeinflussen kann.
 */
function ocrQuality(result) {
  const { lines, kept } = result;
  if (!lines) return { ok: false, level: "leer", message: "Auf dem Bild war kein Text zu finden." };
  if (kept < MIN_ITEM_LINES) {
    return {
      ok: false, level: "wenig",
      message: "Kaum Positionen erkannt. Meist hilft: näher heran, alles im Bild, " +
               "gerade von oben und ohne Schatten."
    };
  }
  if (kept / lines < LOW_QUALITY_RATIO) {
    return {
      ok: true, level: "unsicher",
      message: `${kept} Positionen erkannt, aber viel Unlesbares drumherum. Bitte durchsehen — ` +
               "was fehlt, lässt sich unten von Hand ergänzen."
    };
  }
  return {
    ok: true, level: "gut",
    message: `${kept} Positionen erkannt. Bitte einmal durchsehen: die Erkennung liest, ` +
             "sie versteht nicht."
  };
}

/** Alles zusammen — was die Oberfläche braucht. */
function readReceiptImage(rawText, opts = {}) {
  const result = ocrToReceiptText(rawText);
  return {
    ...result,
    date: ocrDate(rawText, opts.today),
    store: ocrStore(rawText),
    quality: ocrQuality(result)
  };
}

module.exports = {
  readReceiptImage, ocrToReceiptText, alignLine, cleanLine, repairDigits,
  isNoise, ocrDate, ocrStore, ocrQuality,
  istProsa,
  STORE_NAMES, STORE_ALIASES, NOISE_PREFIX, NOISE_CONTAINS, KEEP_PREFIX,
  MAX_ITEM_EUROS, MIN_ITEM_LINES, LOW_QUALITY_RATIO
};
