/**
 * brandSwap.js — Marke gegen Eigenmarke, als Potenzial
 * ================================================================
 * „Du kaufst Joghurt fast immer als Marke. Wärst du im letzten Jahr
 *  auf die Eigenmarke gegangen, wären das rund 31 € gewesen."
 *
 * WAS DIESES MODUL NICHT TUT, und das ist die wichtigere Hälfte:
 *
 *   Es tauscht nichts. Es setzt keine Eigenmarke auf die Liste, es
 *   ändert keine Position, es rechnet keinen Betrag in die Ersparnis
 *   ein. Es zeigt eine Möglichkeit und überlässt die Entscheidung
 *   dem Haushalt. Wer seinen Kaffee mag, mag ihn — eine App, die das
 *   jede Woche in Frage stellt, wird deinstalliert, und zwar zu
 *   Recht.
 *
 * ZWEI ARTEN VON ZAHL, DIE NIE ADDIERT WERDEN:
 *
 *   BELEGT     Der Haushalt hat dasselbe Produkt schon beides Mal
 *              gekauft — als Marke und als Eigenmarke. Dann ist die
 *              Differenz keine Behauptung, sondern der eigene Bon.
 *              Das ist die starke Aussage, und sie steht zuerst.
 *
 *   GESCHÄTZT  Es gibt nur Markenkäufe. Dann bleibt ein
 *              Erfahrungswert (ESTIMATED_SHARE), und er ist als
 *              solcher gekennzeichnet — derselbe Grundsatz wie bei
 *              den Haltbarkeiten im Katalog, wo „schaetzwert" neben
 *              „regulatorisch" steht und nicht so tut, als wäre es
 *              dasselbe.
 *
 * Die Trennung ist nicht Formsache. `activityLog` bucht als
 * `guenstig` nur, was tatsächlich unter dem eigenen üblichen Preis
 * bezahlt wurde. Wer hier geschätzte Potenziale einrechnete, hätte
 * eine Ersparnis-Zahl, die aus Hoffnung und Bon gemischt ist — und
 * damit eine Zahl, die nichts mehr bedeutet.
 *
 * WER TATSÄCHLICH WECHSELT, wird von der bestehenden Logik ohne
 * Zutun erfasst: der niedrigere Preis liegt unter dem eigenen
 * Median, `receiptSavings` bucht die Differenz als realisiert. Genau
 * deshalb darf hier nichts gebucht werden — sonst stünde derselbe
 * Euro zweimal in der Bilanz. Doppelzählung war in diesem Projekt
 * schon zweimal der teuerste Fehler.
 *
 * ZWEI ZURÜCKHALTUNGEN, die keine Vorsicht sind, sondern Respekt:
 *
 *   1. Wer die Eigenmarke PROBIERT UND WIEDER VERLASSEN hat, bekommt
 *      den Vorschlag nicht mehr. Das ist keine Wissenslücke, das ist
 *      eine Antwort — sie schmeckte nicht.
 *   2. Vorschläge lassen sich dauerhaft abstellen. Manches ist
 *      Geschmack und nicht Rechnen.
 *
 * DATENQUELLE ist die Klartextzeile des Bons. Der Produktabgleich
 * wirft Markennamen bewusst weg (sie stören die Zuordnung), aber
 * bevor er das tut, steht dort „MILBONA JOGHURT" oder „EHRMANN
 * ALMIGHURT" — und genau darin steckt die Antwort. Positionen ohne
 * Bonzeile (im Ladenmodus abgehakt) tragen keine Marke und zählen
 * hier nirgends mit, weder dafür noch dagegen.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const BRAND_TIER = {
  EIGEN: "eigen",       // Handelsmarke des Händlers
  MARKE: "marke",       // Herstellermarke
  UNBEKANNT: null       // keine Zeile, kein Marker — keine Aussage
};

/* Ab wann eine Aussage überhaupt zulässig ist. Ein einzelner Kauf
   ist kein Muster, und ein Vorschlag auf einer Beobachtung wäre
   geraten. */
const MIN_BRANDED_PURCHASES = 2;
const MIN_TOTAL_PURCHASES = 3;      // für die Häufigkeit im Jahr

/* Wann gilt die Eigenmarke als PROBIERT UND VERWORFEN: erst, wenn
   nach dem letzten Eigenmarkenkauf mindestens so viele Markenkäufe
   folgen. Einer allein wäre zu wenig — ein Regal ist auch mal leer,
   und aus einem einzigen Griff zur Marke eine Geschmacksentscheidung
   zu lesen, wäre dieselbe Überinterpretation, die anderswo schon zu
   Doppelzählungen geführt hat. */
const MIN_RETURN_PURCHASES = 3;

/* Schwellen gegen Kleinkram. Zehn Cent im Jahr sind kein Potenzial,
   sondern eine Meldung, die man wegtippt. */
const MIN_DIFF_EUROS = 0.15;
const MIN_YEAR_EUROS = 3;

/**
 * Erfahrungswert für den Fall ohne eigenen Vergleich: Handelsmarken
 * liegen typischerweise deutlich unter der Herstellermarke. 25 % ist
 * bewusst das untere Ende der gängigen Spanne — lieber zu wenig
 * versprechen. Ein zu hoher Wert erzeugt eine Zahl, die beim ersten
 * echten Wechsel nicht eintritt, und damit Misstrauen gegen jede
 * andere Zahl der App.
 *
 * ACHTUNG: Dies ist ein SCHÄTZWERT ohne belastbare Quelle. Vor
 * Produktivbetrieb gegen eine solche prüfen — dieselbe Auflage wie
 * für die geschätzten Haltbarkeiten im Katalog.
 */
const ESTIMATED_SHARE = 0.25;

/* Häufigkeit deckeln: bei einem einmaligen Doppelkauf ergäbe die
   Hochrechnung sonst „365 mal im Jahr". */
const MAX_PER_YEAR = 104;

/**
 * Handelsmarken der großen deutschen Ketten.
 *
 * Die Liste ist Pflegearbeit, genau wie die Markenliste in
 * productMatcher2 — Kandidaten liefert die Auswertung der Zeilen,
 * die als „unbekannt" durchlaufen. Sie muss nicht vollständig sein:
 * eine unerkannte Eigenmarke führt dazu, dass ein Potenzial NICHT
 * gezeigt wird. Das ist der harmlose Fehler.
 */
const OWN_BRAND_MARKERS = [
  // Lidl
  "milbona", "combino", "crownfield", "pilos", "dulano", "chef select",
  "alesto", "bellarom", "vitasia", "saskia", "solevita", "kania", "baresa",
  "cien", "w5", "formil", "livarno", "silvercrest", "ernesto", "floralys",
  "lupilu", "freeway", "nixe", "argus", "perlenbacher", "linessa",
  "fin carre", "mister choc", "sondey", "milla", "harvest basket",
  // Aldi
  "milsani", "milfina", "gut bio", "tandil", "ombia", "rio d oro", "river",
  "almare", "mamia", "goldaehren", "wonnemeyer", "le gusto", "westcliff",
  "fair und gut", "meine metzgerei", "sonnentracht",
  // Rewe
  "ja", "rewe beste wahl", "beste wahl", "rewe bio", "rewe feine welt",
  // Edeka
  "gut und guenstig", "gut guenstig", "gg", "edeka bio", "edeka",
  // Kaufland
  "k classic", "k bio", "k take it veggie", "purland", "bevola",
  // Netto / Penny
  "biobio", "elkos", "mibell", "gutes land", "bon ri", "ichbins",
  "san fabio", "today",
  // Drogerie
  "balea", "denkmit", "alverde", "isana", "domol", "sunozon", "facelle",
  "babydream", "prokudent", "perlodent", "sanft und sicher", "das gesunde plus",
  "dmbio", "enerbio", "alnavit"
];

/**
 * Herstellermarken. Auch hier gilt: unvollständig ist in Ordnung.
 * Eine unerkannte Marke kostet ein Potenzial, eine falsch als Marke
 * gelesene Eigenmarke erzeugt einen Vorschlag, der ins Leere geht —
 * deshalb steht im Zweifel nichts in dieser Liste.
 */
const MANUFACTURER_MARKERS = [
  // Molkerei
  "mueller", "danone", "ehrmann", "zott", "landliebe", "weihenstephan",
  "baerenmarke", "meggle", "kerrygold", "exquisa", "hochland", "almighurt",
  "activia", "actimel", "fruchtzwerge", "alpenhain", "bauer", "andechser",
  "arla", "hansano", "berchtesgadener", "rama", "becel",
  // Trocken, Konserve, Backen
  "oetker", "barilla", "knorr", "maggi", "kuehne", "hengstenberg", "develey",
  "thomy", "bahlsen", "leibniz", "wasa", "harry", "golden toast", "mestemacher",
  "rapunzel", "alnatura", "bonduelle", "erasco", "iglo", "frosta", "birds eye",
  "uncle ben s", "reis fit", "buitoni", "miracoli",
  // Süß und Snack
  "milka", "ritter sport", "haribo", "nutella", "ferrero", "duplo",
  "hanuta", "mars", "snickers", "twix", "bounty", "toffifee", "merci",
  "pringles", "lorenz", "chio", "funny frisch", "lay s", "nestle", "lindt",
  "storck", "werther s", "katjes", "trolli",
  // Getränke
  "coca cola", "fanta", "sprite", "pepsi", "volvic", "gerolsteiner",
  "adelholzener", "vittel", "evian", "granini", "hohes c", "valensina",
  "jacobs", "dallmayr", "tchibo", "melitta", "moevenpick", "lavazza",
  "segafredo", "teekanne", "messmer", "bitburger", "krombacher",
  "beck s", "warsteiner", "jever", "paulaner", "erdinger", "radeberger",
  "veltins", "hasseroeder", "koenig pilsener", "red bull",
  // Drogerie und Haushalt
  "persil", "ariel", "lenor", "frosch", "pril", "fairy", "domestos",
  "meister proper", "sagrotan", "nivea", "dove", "garnier", "l oreal",
  "colgate", "odol", "elmex", "aronal", "sensodyne", "signal", "blend a med",
  "oral b", "always", "o b", "tempo", "zewa", "hakle", "pampers", "penaten",
  "bebivita", "hipp", "alete", "swiffer", "vanish", "calgon", "somat",
  "finish", "weisser riese", "spee", "perwoll", "coral",
  // Tier
  "whiskas", "sheba", "felix", "pedigree", "frolic", "chappi", "kitekat",
  "royal canin", "purina", "gourmet"
];

/**
 * Bonzeilen normalisieren. Eigener Name, weil `norm`, `foldUmlauts`
 * und `searchNorm` im Bündel schon vergeben sind — alle Module
 * teilen sich einen Namensraum.
 */
function brandNorm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Steht `marker` als ganzes Wort (oder ganze Wortfolge) in `line`? */
function markerHits(line, marker) {
  return (" " + line + " ").includes(" " + marker + " ");
}

/**
 * Marke einer Bonzeile bestimmen.
 *
 * Eigenmarken werden ZUERST geprüft. Grund: „EDEKA GUT&GUENSTIG
 * BUTTER" enthält beides — den Händler und seine Handelsmarke — und
 * ist eindeutig die Eigenmarke. Andersherum gelesen wäre daraus eine
 * Herstellermarke geworden, und der Haushalt bekäme den Rat, das zu
 * kaufen, was er längst kauft.
 *
 * @returns {{tier: string|null, label: string|null}}
 */
function brandOf(rawLine) {
  const line = brandNorm(rawLine);
  if (!line) return { tier: BRAND_TIER.UNBEKANNT, label: null };

  for (const m of OWN_BRAND_MARKERS) {
    if (markerHits(line, m)) return { tier: BRAND_TIER.EIGEN, label: m };
  }
  for (const m of MANUFACTURER_MARKERS) {
    if (markerHits(line, m)) return { tier: BRAND_TIER.MARKE, label: m };
  }
  return { tier: BRAND_TIER.UNBEKANNT, label: null };
}

/**
 * Aus dem normalisierten Marker wieder etwas Lesbares machen:
 * „gut und guenstig" -> „Gut Und Guenstig". Bewusst schlicht — der
 * Marker steht in der Oberfläche als Beleg neben dem Preis, nicht
 * als Werbung. Eine gepflegte Schreibweisen-Tabelle wäre dritte
 * Pflegearbeit für einen Nebensatz.
 */
function brandLabel(marker) {
  if (!marker) return null;
  return String(marker).split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Die Marke eines gespeicherten Kaufs. Bevorzugt das, was beim
 * Buchen festgehalten wurde; sonst wird die Bonzeile nachträglich
 * gelesen. Alte Käufe aus der Zeit vor diesem Modul haben beides
 * nicht — die zählen als „unbekannt" und stören nichts.
 */
function purchaseBrand(p) {
  if (p && p.brand && (p.brand === BRAND_TIER.EIGEN || p.brand === BRAND_TIER.MARKE)) {
    return { tier: p.brand, label: p.brandLabel || null };
  }
  if (p && p.brand && typeof p.brand === "object" && p.brand.tier) return p.brand;
  if (p && p.raw) return brandOf(p.raw);
  return { tier: BRAND_TIER.UNBEKANNT, label: null };
}

/**
 * Vergleichsbasis eines Kaufs.
 *
 * Der nackte Stückpreis vergleicht sonst 500 g Markenbutter mit
 * 250 g Eigenmarke und meldet eine Ersparnis, die es nicht gibt.
 * Liegt ein Gewicht vor, wird auf 100 g gerechnet; sonst bleibt es
 * beim Stück. Verglichen wird nur INNERHALB einer Basis — gemischte
 * Vergleiche sind der schnellste Weg zu einer falschen Zahl.
 */
function pricePointOf(p) {
  const price = Number(p.unitPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const g = Number(p.weightG);
  if (Number.isFinite(g) && g > 0) return { basis: "100g", value: (price / g) * 100 };
  return { basis: "stueck", value: price };
}

function brandMedian(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median der Abstände zwischen Käufen, hochgerechnet aufs Jahr. */
function purchasesPerYear(dates) {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
    if (Number.isFinite(d) && d > 0) gaps.push(d);
  }
  const med = brandMedian(gaps);
  if (!med || med <= 0) return null;
  return Math.min(MAX_PER_YEAR, 365 / med);
}

/**
 * Käufe eines Produkts in die drei Lager sortieren und daraus
 * ableiten, ob sich eine Aussage lohnt.
 *
 * @returns {null|object} null, wenn zu wenig oder zu uneindeutig
 */
function candidateFor(productId, rows) {
  const marke = [], eigen = [];
  rows.forEach((p) => {
    const b = purchaseBrand(p);
    if (b.tier === BRAND_TIER.MARKE) marke.push({ ...p, _label: b.label });
    else if (b.tier === BRAND_TIER.EIGEN) eigen.push({ ...p, _label: b.label });
  });

  if (marke.length < MIN_BRANDED_PURCHASES) return null;
  if (rows.length < MIN_TOTAL_PURCHASES) return null;

  /* Probiert und wieder verlassen: seit dem letzten Eigenmarkenkauf
     nur noch Marke, und das mehrfach. Das ist eine Antwort, keine
     Lücke — hier hat der Haushalt entschieden, und die App hat zu
     schweigen. Ein einzelner Markenkauf danach reicht nicht: dann
     wechseln sich beide ab, und der Vergleich ist gerade dadurch
     belegt. */
  if (eigen.length) {
    const letzteEigen = eigen.map((p) => p.date).sort().pop();
    const seither = marke.filter((p) => p.date > letzteEigen).length;
    if (seither >= MIN_RETURN_PURCHASES) return { productId, abgelehnt: true };
  }

  // Die Basis mit der besseren Datenlage gewinnt; gemischt wird nicht.
  const punkte = (list) => list.map(pricePointOf).filter(Boolean);
  const markePunkte = punkte(marke);
  const eigenPunkte = punkte(eigen);
  const basisZaehler = {};
  markePunkte.forEach((x) => { basisZaehler[x.basis] = (basisZaehler[x.basis] || 0) + 1; });
  const basis = Object.keys(basisZaehler).sort((a, b) => basisZaehler[b] - basisZaehler[a])[0];
  if (!basis) return null;

  const markePreis = brandMedian(markePunkte.filter((x) => x.basis === basis).map((x) => x.value));
  const eigenGleicheBasis = eigenPunkte.filter((x) => x.basis === basis).map((x) => x.value);
  const eigenPreis = eigenGleicheBasis.length ? brandMedian(eigenGleicheBasis) : null;
  if (!markePreis) return null;

  const belegt = eigenPreis !== null && eigenPreis < markePreis;
  const referenz = belegt ? eigenPreis : markePreis * (1 - ESTIMATED_SHARE);
  const diffJeEinheit = markePreis - referenz;
  if (diffJeEinheit < MIN_DIFF_EUROS) return null;

  const proJahr = purchasesPerYear(rows.map((p) => p.date));
  if (!proJahr) return null;

  /* Hochgerechnet wird auf den MARKENANTEIL: wer schon zur Hälfte
     Eigenmarke kauft, hat die andere Hälfte bereits gehoben. Alles
     andere wäre doppelt gezählt. */
  const markenAnteil = marke.length / (marke.length + eigen.length);
  const jahresPotenzial = diffJeEinheit * proJahr * markenAnteil;
  if (jahresPotenzial < MIN_YEAR_EUROS) return null;

  const produkt = byId(productId);
  return {
    productId,
    name: produkt ? produkt.name : productId,
    aisle: produkt ? produkt.aisle : null,
    belegt,
    basis,
    markenPreis: Math.round(markePreis * 100) / 100,
    eigenPreis: Math.round(referenz * 100) / 100,
    differenz: Math.round(diffJeEinheit * 100) / 100,
    anteilProzent: Math.round((diffJeEinheit / markePreis) * 100),
    markenKaeufe: marke.length,
    eigenKaeufe: eigen.length,
    proJahr: Math.round(proJahr * 10) / 10,
    jahresPotenzial: Math.round(jahresPotenzial * 100) / 100,
    marke: marke.map((p) => p._label).filter(Boolean).pop() || null,
    eigenmarke: eigen.map((p) => p._label).filter(Boolean).pop() || null
  };
}

/**
 * Alle Tauschmöglichkeiten eines Haushalts.
 *
 * @param {Array} purchases Käufe mit `raw` oder `brand`
 * @param {{dismissed:Array<string>}} [opts] dauerhaft abgestellte Produkte
 * @returns {{belegt:Array, geschaetzt:Array, proJahrBelegt:number,
 *            proJahrGeschaetzt:number, abgelehnt:number, erkannt:number,
 *            zeilenMitMarke:number, zeilenGesamt:number}}
 */
function brandSwapCandidates(purchases, opts = {}) {
  const dismissed = new Set(opts.dismissed || []);
  const list = Array.isArray(purchases) ? purchases : [];

  const byProduct = new Map();
  let zeilenMitMarke = 0;
  list.forEach((p) => {
    if (!p || !p.productId || !p.date) return;
    if (purchaseBrand(p).tier) zeilenMitMarke++;
    if (!byProduct.has(p.productId)) byProduct.set(p.productId, []);
    byProduct.get(p.productId).push(p);
  });

  const belegt = [], geschaetzt = [];
  let abgelehnt = 0;
  byProduct.forEach((rows, productId) => {
    if (dismissed.has(productId)) return;
    const c = candidateFor(productId, rows);
    if (!c) return;
    if (c.abgelehnt) { abgelehnt++; return; }
    (c.belegt ? belegt : geschaetzt).push(c);
  });

  const nachPotenzial = (a, b) => b.jahresPotenzial - a.jahresPotenzial;
  belegt.sort(nachPotenzial);
  geschaetzt.sort(nachPotenzial);

  const summe = (arr) => Math.round(arr.reduce((a, x) => a + x.jahresPotenzial, 0) * 100) / 100;

  return {
    belegt,
    geschaetzt,
    // Getrennt, und zwar bis in die Oberfläche. Eine Summe aus beidem
    // gäbe es hier nicht zu berechnen, sondern nur zu verwechseln.
    proJahrBelegt: summe(belegt),
    proJahrGeschaetzt: summe(geschaetzt),
    abgelehnt,
    erkannt: belegt.length + geschaetzt.length,
    zeilenMitMarke,
    zeilenGesamt: list.length
  };
}

/**
 * Ein Satz für die Übersicht — oder null, wenn es nichts zu sagen
 * gibt. Kein „0,00 € Potenzial": eine Null ist keine Nachricht.
 */
function swapHeadline(result) {
  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";
  if (!result || !result.erkannt) {
    // Ohne jeden Kauf ist auch der Hinweis „noch keine Marken" eine
    // Meldung zu viel — da ist nicht die Erkennung das Problem,
    // sondern dass noch nichts erfasst wurde.
    if (result && result.zeilenGesamt && !result.zeilenMitMarke) {
      return {
        text: "Noch keine Marken erkannt",
        hint: "Marken stehen auf der Bonzeile. Wer den Bontext erfasst statt nur abzuhaken, bekommt diesen Vergleich."
      };
    }
    return null;
  }
  if (result.belegt.length) {
    const top = result.belegt[0];
    return {
      text: `${eur(result.proJahrBelegt)} im Jahr`,
      hint: `Belegt aus deinen eigenen Bons, z. B. ${top.name}: ` +
            `${eur(top.markenPreis)} gegen ${eur(top.eigenPreis)}.`
    };
  }
  const top = result.geschaetzt[0];
  return {
    text: `rund ${eur(result.proJahrGeschaetzt)} im Jahr`,
    hint: `Geschätzt: ${top.name} und ${result.geschaetzt.length - 1} weitere. ` +
          `Sobald du eine Eigenmarke einmal kaufst, wird daraus eine belegte Zahl.`
  };
}

module.exports = {
  brandOf, brandNorm, brandLabel, purchaseBrand, pricePointOf, purchasesPerYear,
  candidateFor, brandSwapCandidates, swapHeadline,
  BRAND_TIER, OWN_BRAND_MARKERS, MANUFACTURER_MARKERS,
  MIN_BRANDED_PURCHASES, MIN_TOTAL_PURCHASES, MIN_RETURN_PURCHASES,
  MIN_DIFF_EUROS, MIN_YEAR_EUROS,
  ESTIMATED_SHARE, MAX_PER_YEAR
};
