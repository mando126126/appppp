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
 *    `lidlParser` erkennt eine Position daran, dass zwischen Name
 *    und Preis MINDESTENS ZWEI Leerzeichen stehen — auf einem Bon
 *    ist das eine Spalte, kein Zufall. Die Texterkennung macht
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
 * GRUNDSATZ: LIEBER EINE ZEILE ZU WENIG.
 * Eine übersehene Position merkt der Nutzer sofort — sie fehlt in
 * der Liste, die er vor sich sieht, und er tippt sie nach. Eine
 * erfundene Position dagegen wandert still in die Historie und
 * verschiebt einen Rhythmus, den danach niemand mehr erklären kann.
 * Deshalb sind alle Schwellen hier streng und alle Zweifel gehen
 * gegen die Zeile.
 *
 * Das Ergebnis ist bewusst wieder TEXT im Format, das
 * `lidlParser` ohnehin liest. Keine zweite Bon-Grammatik: die eine,
 * die an einem echten Bon kalibriert ist, bleibt die einzige.
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
  "zwischensumme", "trinkgeld", "aut", "gen nr", "ta-nr", "as-zeit"
];

/* Zeilen mit diesen Wörtern SIND Positionen, auch wenn sie oben
   verdächtig aussehen — „Pfand" beginnt mit P, aber der Parser
   braucht die Zeile. */
const KEEP_PREFIX = ["pfand", "leergut", "preisvorteil", "rabatt", "lidl plus"];

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
    .replace(/(\d[.,]\d{2})\s+[A-Z12]\s*$/, "$1")
    .replace(/[«»“”„"‚'`´]/g, "")
    .replace(/[¥€$]/g, " ")
    .replace(/\s*€\s*/g, " ")
    .replace(/\bEUR\b/gi, " ")
    .replace(/[^\wÄÖÜäöüß0-9,.\-+*%/&()\s]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trimEnd();
}

/** Ist das eine Kopf-, Fuß- oder Zahlungszeile? */
function isNoise(line) {
  const l = line.trim().toLowerCase();
  if (!l) return true;
  if (KEEP_PREFIX.some((k) => l.startsWith(k))) return false;
  if (NOISE_PREFIX.some((n) => l.startsWith(n))) return true;
  // Datum, Uhrzeit, lange Nummernfolgen: nie ein Produkt.
  if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/.test(l)) return true;
  if (/^\d{1,2}:\d{2}/.test(l)) return true;
  if (/^[\d\s.\-*#]{8,}$/.test(l)) return true;
  // Reine Großbuchstaben-Adresse ohne Betrag ist ein Kopf.
  if (!RE_AMOUNT.test(line) && l.length > 24) { RE_AMOUNT.lastIndex = 0; return true; }
  RE_AMOUNT.lastIndex = 0;
  return false;
}

/**
 * Eine Zeile in die Spaltenform bringen, die `lidlParser` erwartet:
 * Name, mindestens zwei Leerzeichen, Betrag.
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

  // Rabatt- und Pfandzeilen: eingerückt, damit der Parser sie der
  // Position darüber zuschlägt.
  const rabatt = clean.match(/^\s*(Preisvorteil|Lidl Plus Rabatt|Rabatt|Coupon)\s+(-?\d+[.,]\d{2})/i);
  if (rabatt) return `   ${rabatt[1]} -${rabatt[2].replace("-", "")}`;

  if (isNoise(clean)) return null;

  const betraege = [...clean.matchAll(RE_AMOUNT)];
  if (!betraege.length) return null;

  const letzter = betraege[betraege.length - 1];
  const roh = parseFloat(letzter[1].replace(",", "."));
  const wert = Math.abs(roh);
  if (!Number.isFinite(wert) || wert === 0 || wert > MAX_ITEM_EUROS) return null;

  /* Ein negativer Betrag ist ein Abzug, kein Produktpreis. Die
     Abzugszeilen sind oben schon abgefangen (sie tragen ihr Wort und
     werden eingerückt weitergereicht); was hier noch negativ ankommt,
     ist Leergut, eine Stornierung oder ein Lesefehler. Eine Position
     mit negativem Preis würde in der Historie einen Kaufpreis unter
     null erzeugen — der Zufallstest hat genau das gefunden. */
  if (roh < 0) return null;

  // Kein „x" in dieser Klasse: aus „Müsli Mix" würde sonst „Müsli Mi".
  const name = clean.slice(0, letzter.index).replace(/[\s.\-*]+$/, "").trim();
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
      if (kopf.length >= MIN_NAME_LENGTH) {
        return `${kopf}  ${menge[1].replace(".", ",")} x ${menge[2]}  ${menge[3].replace(".", ",")}`;
      }
    }
  }

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

/** Markt aus dem Kopf des Bons. */
function ocrStore(raw) {
  const kopf = String(raw || "").split(/\r?\n/).slice(0, 12).join(" ").toLowerCase();
  // Längste Treffer zuerst, damit „Aldi Süd" vor „Aldi" gewinnt.
  const sortiert = [...STORE_NAMES].sort((a, b) => b.length - a.length);
  for (const s of sortiert) {
    if (kopf.includes(s.toLowerCase())) return s;
  }
  return null;
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
  STORE_NAMES, NOISE_PREFIX, MAX_ITEM_EUROS, MIN_ITEM_LINES, LOW_QUALITY_RATIO
};
