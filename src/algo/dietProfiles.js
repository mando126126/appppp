/**
 * dietProfiles.js — Ernährungsweisen, rein optional
 * ================================================================
 * Wer sich vegetarisch, vegan oder bewusst proteinreich ernährt,
 * stellt beim Einkauf zwei Fragen, die diese App aus den Bons
 * beantworten kann:
 *
 *   PASST DAS?      Steht auf der Vorschlagsliste etwas, das nicht
 *                   zur gewählten Ernährungsweise passt — und gibt
 *                   es im Katalog einen Ersatz dafür?
 *   WIE LIEGE ICH?  Wie viel des eigenen Lebensmittel-Einkaufs war
 *                   pflanzlich, wie viel Protein steckt darin?
 *
 * AUSDRÜCKLICH OPTIONAL. Ohne gewähltes Profil ändert sich nichts:
 * keine Markierung, keine Kachel, kein Hinweis. Eine App, die
 * ungefragt den Einkaufszettel kommentiert, erzieht — und das ist
 * nicht ihre Aufgabe.
 *
 * WAS HIER BEWUSST NICHT DRINSTEHT: glutenfrei und laktosefrei.
 * Das sind keine Vorlieben, sondern Unverträglichkeiten, und eine
 * falsche Zusage macht jemanden krank. Der Katalog kennt weder
 * Zutatenlisten noch Spurenkennzeichnung — was er hergibt, reicht
 * für „enthält vermutlich kein Fleisch", aber niemals für „ist
 * sicher glutenfrei". Dieselbe Linie wie bei den Verbrauchsdaten:
 * lieber schweigen als etwas zusagen, dessen Grundlage fehlt.
 *
 * DREI ANTWORTEN, NICHT ZWEI. Jede Einordnung darf auch „unklar"
 * sagen — und tut das oft: bei Backwaren, Süßwaren und
 * Fertiggerichten entscheidet die Zutatenliste, nicht der Name.
 * „unklar" wird in der Oberfläche NICHT markiert und in den
 * Anteilen NICHT mitgezählt, sondern offen ausgewiesen. Ein
 * geschätzter Anteil, der so tut, als wüsste er es, wäre schlimmer
 * als eine ehrliche Lücke.
 *
 * QUELLENLAGE PROTEIN: Der Katalog führt keine Nährwerte. Die
 * Tabelle unten ist deshalb eine eigene, bewusst grobe Zuordnung
 * von Referenzwerten je 100 g für die Produkte, bei denen Protein
 * überhaupt ins Gewicht fällt — Qualitätsstufe "schaetzwert" im
 * Sinne von foodDatabase.js: Größenordnung, kein Laborwert, und
 * für Produkte ohne Eintrag wird NICHTS geschätzt. Die Oberfläche
 * sagt dazu, wie viel des Einkaufs die Rechnung überhaupt erfasst.
 * ================================================================
 */

const { byId, FOOD_DATABASE } = require("./foodDatabase");

/** Die Einordnung eines Produkts. */
const DIET_KIND = {
  PLANT: "pflanzlich",      // ohne tierische Bestandteile
  VEGGIE: "vegetarisch",    // tierisch, aber kein Tier gestorben (Milch, Ei, Honig)
  MEAT: "fleisch",          // Fleisch, Fisch, Gelatine
  UNCLEAR: "unklar"         // entscheidet die Zutatenliste, nicht der Name
};

/** Die wählbaren Profile. `null` heißt: keins, und dann tut nichts. */
const DIET_PROFILES = [
  { id: "vegetarisch", label: "Vegetarisch", excludes: [DIET_KIND.MEAT] },
  { id: "vegan", label: "Vegan", excludes: [DIET_KIND.MEAT, DIET_KIND.VEGGIE] },
  // Proteinreich schließt nichts aus -- es hebt hervor. Deshalb eine
  // leere Ausschlussliste und stattdessen die Protein-Rechnung unten.
  { id: "proteinreich", label: "Proteinreich", excludes: [] }
];

const dietProfileById = (id) => DIET_PROFILES.find((p) => p.id === id) || null;

/* ================================================================
   1. Einordnung
   ================================================================
   Reihenfolge ist Absicht: die Ausnahmen zuerst, die Kategorie
   zuletzt. „Tofu natur" und „Veggie-Hack" stehen im Katalog in der
   Kategorie Fleisch/Fisch — sie liegen im Laden dort, und der
   Katalog bildet den Laden ab, nicht den Speiseplan. Eine Regel,
   die nur die Kategorie liest, macht daraus Fleisch. */

/* Eindeutig pflanzlich, obwohl Name oder Kategorie anderes nahelegen.
   Die Kennungen sind die aus foodDatabase.js -- ein Tippfehler hier
   wirkt nicht, er fällt nur nicht auf ("tofu_raeucher" statt
   "tofu_geraeuchert" machte aus Räuchertofu stillschweigend Fleisch).
   Der Test dazu prüft deshalb, dass es jede dieser Kennungen im
   Katalog überhaupt gibt. */
const PLANT_OVERRIDES = new Set([
  "tofu_natur", "tofu_geraeuchert", "tempeh", "seitan", "sojaschnetzel",
  "veggie_schnitzel", "veggie_hack", "veggie_wuerstchen",
  "hafermilch", "mandelmilch", "sojamilch", "reisdrink", "kokosmilch",
  "margarine"
]);

/* Pflanzliche Ersatzprodukte tragen die Namen ihrer Vorbilder:
   "Sojajoghurt", "Hafer-Drink", "Vollmilchschokolade mit Hafer".
   Steht ein solcher Hinweis im Namen, wird NICHT auf vegetarisch
   entschieden, sondern auf "unklar" -- lieber schweigen als ein
   veganes Produkt fälschlich als tierisch markieren. Ein falscher
   Haken ist schlimmer als gar keiner. */
const PLANT_MARKERS = [
  "soja", "hafer", "mandel", "kokos", "cashew", "lupine", "erbsenprotein",
  "dinkeldrink", "dinkel drink",
  "vegan", "veggie", "pflanzlich", "pflanzen", "no milk", "alpro", "provamel"
];

/* DEUTSCHE KOMPOSITA, und warum hier Wortstämme stehen statt Wörter.
   ----------------------------------------------------------------
   Erster Versuch prüfte auf ganze Wörter mit Wortgrenze. Das ist im
   Deutschen die falsche Regel: "Fischsauce", "Müllermilch" und
   "Hähnchenbrust" sind EIN Wort, und keine Wortgrenze trennt den
   Stamm ab. Beide Saucen liefen als pflanzlich durch.

   Also Teilzeichenketten — aber nur lange, eindeutige Stämme. Kurze
   ("ei", "rind") machen aus "Eistee" ein Ei und aus "Rinde" ein
   Rind; die stehen deshalb unten getrennt und werden weiterhin mit
   Wortgrenze geprüft. Was trotzdem falsch anschlägt, steht in der
   Ausnahmeliste daneben — mit Beispiel, damit später niemand raten
   muss, wogegen die Zeile schützt. */

/** Lange, eindeutige Stämme für Fleisch und Fisch (Teiltreffer). */
const MEAT_STEMS = [
  "fleisch", "hackfleisch", "wurst", "schinken", "speck", "bacon", "salami",
  "haehnchen", "haehnchen", "hendl", "puten", "putenbrust", "schwein",
  "rinder", "rindfleisch", "lammfleisch", "lammkeule", "lammkotelett",
  "kalbs", "entenbrust", "gefluegel", "gulasch", "kasseler", "frikadelle",
  "gyros", "leberkaes", "leberwurst", "mettwurst", "krakauer", "cabanossi",
  "landjaeger", "pastrami", "chorizo", "merguez", "bierschinken",
  "pfefferbeisser", "tafelspitz", "prosciutto", "bolognese", "doener",
  "schnitzel", "schmalz", "suelze", "gelatine", "wuerstchen",
  "fisch", "lachs", "thunfisch", "garnele", "hering", "makrele", "forelle",
  "zander", "dorade", "barsch", "scholle", "matjes", "rollmops", "sardelle",
  "sardine", "muschel", "tintenfisch", "surimi", "rogen", "krabben",
  "shrimp", "kabeljau", "seelachs", "pangasius", "anchovis", "worcester"
];

/* Kurze, mehrdeutige Stämme — nur als ganzes Wort.
   NICHT dabei: "aufschnitt" (Käse-Aufschnitt ist keiner) und
   "wiener" (Wiener Sandringe sind Gebäck). Wurstaufschnitt und
   Wiener Würstchen fangen die Stämme "wurst" bzw. "wuerstchen". */
const MEAT_WORDS = [
  "rind", "pute", "lamm", "kalb", "ente", "gans", "steak", "braten",
  "leber", "mett", "gulasch", "nuggets", "grillspiesse", "keule",
  "koteletts", "suppenfleisch", "backfisch"
];

/** Trifft einen Fleisch-Stamm, ist aber keins. */
const MEAT_EXCEPTIONS = [
  "fleischtomate",       // Tomate
  "fruchtfleisch",       // Tomatenmark, Obst
  "kokosfleisch",
  "veggie",              // Veggie-Schnitzel, Veggie-Würstchen
  "vegan",
  "vegetarisch",
  "fischstaebchen_vegan"
];

/** Lange, eindeutige Stämme für tierische, fleischlose Erzeugnisse. */
const ANIMAL_STEMS = [
  "milch", "kaese", "joghurt", "jogurt", "quark", "sahne", "rahm",
  "butter", "molke", "whey", "honig", "mozzarella", "feta", "parmesan",
  "camembert", "brie", "gouda", "emmentaler", "harzer", "mascarpone",
  "ricotta", "skyr", "kefir", "schmand", "pudding", "kondens", "lactose",
  "laktose", "ziegen", "schafs", "creme fraiche", "creme fraiche"
];

/** Kurze, mehrdeutige Stämme — nur als ganzes Wort. */
const ANIMAL_WORDS = ["ei", "eier", "eigelb", "eiweiss"];

/** Trifft einen Tier-Stamm, ist aber keins. */
const ANIMAL_EXCEPTIONS = [
  "kokosmilch", "sojamilch", "hafermilch", "mandelmilch", "reismilch",
  "sojadrink", "haferdrink", "mandeldrink", "reisdrink", "hafer drink",
  "erdnussbutter", "butternut", "kakaobutter", "sheabutter", "mandelbutter",
  "honigmelone", "buttersalat", "butterkopfsalat", "milchsaeure",
  "veganer kaese", "vegan", "pflanzendrink", "kokosjoghurt", "sojajoghurt"
];

/* Verarbeitetes, über das der Name nichts aussagt: bei Saucen, Suppen,
   Füllungen und Süßwaren entscheidet die Zutatenliste. Diese Treffer
   führen zu "unklar" — nicht zu einer Vermutung in die eine oder
   andere Richtung. */
const UNCLEAR_STEMS = [
  "sauce", "sosse", "dressing", "mayonnaise", "mayo", "aioli", "pesto",
  "bruehe", "fond", "suppe", "bouillon", "eintopf",
  "ravioli", "tortellini", "maultasche", "lasagne", "gnocchi", "pizza",
  "schoko", "nougat", "praline", "riegel", "keks", "kuchen", "waffel",
  "creme", "eiscreme", "speiseeis", "chips", "cracker", "muesli", "fertig",
  "cookie", "torte", "bienenstich"
];

/** Kategorien, deren Inhalt ohne Zutatenliste nicht zu entscheiden ist. */
const UNCLEAR_CATEGORIES = new Set([
  "Backwaren", "Süßes/Snacks", "Fertiggerichte", "International",
  "Tiefkühl", "Protein/Sport", "Baby"
]);

/** Kategorien, die praktisch vollständig pflanzlich sind. */
const PLANT_CATEGORIES = new Set(["Frischware"]);

const normalize = (s) => String(s || "").toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

/** Kommt einer der Stämme irgendwo im Text vor (Kompositum inbegriffen)? */
function hasStem(text, stems) {
  const t = normalize(text);
  return stems.some((s) => t.includes(normalize(s)));
}

/** Steht eines der Wörter als eigenes Wort da? Für kurze, mehrdeutige. */
function hasWord(text, words) {
  const t = normalize(text);
  return words.some((w) => new RegExp(`(^|[^a-z0-9])${normalize(w)}([^a-z0-9]|$)`).test(t));
}

/**
 * Wie ist dieses Produkt einzuordnen?
 * `null` für alles, was kein Lebensmittel ist — dort ist die Frage
 * gegenstandslos, und "unklar" wäre die falsche Antwort darauf.
 */
function dietKindOf(productId) {
  const p = byId(productId);
  if (!p || !p.isFood) return null;
  if (PLANT_OVERRIDES.has(p.id)) return DIET_KIND.PLANT;

  /* Nur Name und Kennung, NICHT die Aliase: die Aliase sind
     Bon-Schreibweisen und enthalten Markennamen, Mengen und
     Abkürzungen ("GLGOUDA LEICHTHF3GER.250G VLOG"). Was dort
     zufällig einen Stamm trifft, sagt nichts über den Inhalt. */
  const text = `${p.name} ${p.id}`;
  const istAusnahme = (liste) => hasStem(text, liste);

  if (!istAusnahme(MEAT_EXCEPTIONS) &&
      (hasStem(text, MEAT_STEMS) || hasWord(text, MEAT_WORDS))) return DIET_KIND.MEAT;
  if (p.category === "Fleisch/Fisch" || p.category === "Wurstwaren") return DIET_KIND.MEAT;

  const tierisch = !istAusnahme(ANIMAL_EXCEPTIONS) &&
    (hasStem(text, ANIMAL_STEMS) || hasWord(text, ANIMAL_WORDS));
  // Pflanzlicher Hinweis im Namen schlägt den tierischen Stamm nicht
  // ins Gegenteil um, sondern ins Offene: "Joghurt Soja Natur" ist
  // kein Joghurt im Sinne dieser Frage, aber "Hafercookies mit
  // Vollmilchschokolade" eben doch Milch. Beides sicher zu trennen
  // gibt der Name nicht her -- also "unklar" statt eines Fehlurteils.
  const pflanzlicherHinweis = hasStem(text, PLANT_MARKERS);
  if (tierisch) return pflanzlicherHinweis ? DIET_KIND.UNCLEAR : DIET_KIND.VEGGIE;
  if (p.category === "Milchprodukte") {
    return pflanzlicherHinweis ? DIET_KIND.UNCLEAR : DIET_KIND.VEGGIE;
  }

  // Erst nach den tierischen Stämmen: eine Käsesauce ist vegetarisch,
  // eine Fertigsauce ohne Hinweis dagegen wirklich nicht zu sagen.
  if (hasStem(text, UNCLEAR_STEMS)) return DIET_KIND.UNCLEAR;

  if (PLANT_CATEGORIES.has(p.category)) return DIET_KIND.PLANT;
  if (UNCLEAR_CATEGORIES.has(p.category)) return DIET_KIND.UNCLEAR;
  return DIET_KIND.PLANT;
}

/**
 * Passt das Produkt zum Profil?
 * Drei Antworten, nicht zwei: `true`, `false` und `null` für
 * „lässt sich hier nicht sagen". `null` wird nirgends markiert.
 */
function fitsDiet(productId, profileId) {
  const profile = dietProfileById(profileId);
  if (!profile || !profile.excludes.length) return true;
  const kind = dietKindOf(productId);
  if (kind === null) return true;                 // Non-Food betrifft es nicht
  if (kind === DIET_KIND.UNCLEAR) return null;
  return !profile.excludes.includes(kind);
}

/* ================================================================
   2. Ersatz aus dem eigenen Katalog
   ================================================================ */

/**
 * Was aus derselben Ecke des Ladens passt stattdessen?
 *
 * Gesucht wird in derselben Kategorie, damit der Vorschlag im Regal
 * daneben steht und nicht im nächsten Gang. Vorgeschlagen wird nur,
 * was eindeutig passt — ein „vielleicht passt das" ist als Ersatz
 * wertlos.
 */
function dietAlternatives(productId, profileId, limit = 3) {
  const p = byId(productId);
  const profile = dietProfileById(profileId);
  if (!p || !profile || !profile.excludes.length) return [];
  if (fitsDiet(productId, profileId) !== false) return [];

  /* Reihenfolge: erst die vergleichbare Packung, dann der ähnliche
     Preis. Nach reinem Preis stand für Vollmilch die Margarine ganz
     oben — dieselbe Kategorie, aber ein Brotaufstrich statt eines
     Getränks. Die übliche Packungsgröße trennt beide, ohne dass der
     Katalog dafür eine Unterkategorie bräuchte: 1 l gegen 500 g.
     Genauer wird es hier nicht, und die Oberfläche verspricht
     entsprechend „aus demselben Regal", nicht „dasselbe in grün". */
  const gewicht = p.typicalWeightG || 0;
  const preis = p.typicalPrice || 0;
  const abstand = (k) => {
    const g = k.typicalWeightG || 0;
    const vh = gewicht && g ? Math.max(g / gewicht, gewicht / g) : 4;
    return vh * 10 + Math.abs((k.typicalPrice || 0) - preis);
  };

  return FOOD_DATABASE
    .filter((k) => k.isFood && k.id !== p.id && k.category === p.category &&
      fitsDiet(k.id, profileId) === true)
    .sort((a, b) => abstand(a) - abstand(b))
    .slice(0, limit)
    .map((k) => ({ productId: k.id, name: k.name, price: k.typicalPrice }));
}

/* ================================================================
   3. Anteile aus den eigenen Käufen
   ================================================================ */

/**
 * Wie viel des Lebensmittel-Einkaufs war pflanzlich?
 *
 * Gerechnet über den Preis, nicht über die Stückzahl: zehn Packungen
 * Nudeln und ein Rinderfilet sind nach Stück ein pflanzlicher
 * Einkauf und nach Geld keiner. Non-Food bleibt außen vor — Spülmittel
 * hat keine Ernährungsweise.
 *
 * `unklar` wird ausgewiesen, nicht verteilt: der Anteil bezieht sich
 * ausdrücklich auf den eingeordneten Teil, und die Oberfläche sagt,
 * wie groß der ist.
 */
function dietShares(purchases, { from = null, to = null } = {}) {
  const summe = { [DIET_KIND.PLANT]: 0, [DIET_KIND.VEGGIE]: 0, [DIET_KIND.MEAT]: 0, [DIET_KIND.UNCLEAR]: 0 };
  let gesamt = 0;

  for (const h of purchases || []) {
    if (from && h.date < from) continue;
    if (to && h.date > to) continue;
    const kind = dietKindOf(h.productId);
    if (kind === null) continue;
    const wert = (Number(h.unitPrice) || 0) * (Number(h.quantity) || 1);
    if (wert <= 0) continue;
    summe[kind] += wert;
    gesamt += wert;
  }

  const eingeordnet = gesamt - summe[DIET_KIND.UNCLEAR];
  const anteil = (k) => (eingeordnet > 0 ? Math.round((summe[k] / eingeordnet) * 100) : null);

  return {
    euros: {
      pflanzlich: Math.round(summe[DIET_KIND.PLANT] * 100) / 100,
      vegetarisch: Math.round(summe[DIET_KIND.VEGGIE] * 100) / 100,
      fleisch: Math.round(summe[DIET_KIND.MEAT] * 100) / 100,
      unklar: Math.round(summe[DIET_KIND.UNCLEAR] * 100) / 100
    },
    gesamt: Math.round(gesamt * 100) / 100,
    eingeordnet: Math.round(eingeordnet * 100) / 100,
    // Anteile beziehen sich auf den EINGEORDNETEN Teil, nie auf alles.
    prozentPflanzlich: anteil(DIET_KIND.PLANT),
    prozentVegetarisch: anteil(DIET_KIND.VEGGIE),
    prozentFleisch: anteil(DIET_KIND.MEAT),
    // Wie viel des Einkaufs die Aussage überhaupt trägt.
    abdeckung: gesamt > 0 ? Math.round((eingeordnet / gesamt) * 100) : null
  };
}

/* ================================================================
   4. Protein
   ================================================================
   Referenzwerte je 100 g, Größenordnung. Sie stehen hier und nicht
   in foodDatabase.js, weil sie eine andere Quellenlage haben als
   Haltbarkeit und Lagerung: die dortigen Stufen "regulatorisch" und
   "leitlinie" haben eine Behörde hinter sich, diese Zahlen nicht.
   Wer sie später gegen eine belastbare Nährwertquelle austauscht,
   findet sie an einer Stelle. */
const PROTEIN_PER_100G = {
  // Hülsenfrüchte, trocken bzw. Dose
  linsen: 24, kichererbsen: 19, weisse_bohnen: 7, kidneybohnen: 8,
  bohnen_trocken: 21, erbsen_trocken: 23, erbsen_dose: 5,
  konserve_kichererbsen: 7, konserve_bohnen: 7, sojaschnetzel: 50,
  // Fleisch, Fisch, Ei
  haehnchen: 23, haehnchen_schenkel: 19, putenbrust: 24, rindersteak: 26,
  hackfleisch: 18, hack_rind: 20, schweineschnitzel: 22, schweinefilet: 21,
  fisch_lachs: 20, thunfisch_dose: 24, garnelen: 20, forelle: 20,
  eier: 13, eier_bio: 13,
  // Milchprodukte
  quark: 12, skyr: 11, huettenkaese: 13, joghurt_natur: 4,
  joghurt_griechisch: 6, milch_vollmilch: 3.4, milch_fettarm: 3.5,
  kaese_gouda: 25, kaese_emmentaler: 28, parmesan: 32, feta: 17,
  mozzarella: 18, frischkaese: 8, harzer: 30,
  // Pflanzlich
  tofu_natur: 15, tofu_geraeuchert: 17, tempeh: 19, seitan: 25,
  sojamilch: 3.5, hafermilch: 1, mandelmilch: 0.5,
  erdnussbutter: 25, mandeln: 21,
  haferflocken: 13, mehl_dinkel: 12, mehl: 10, nudeln: 12,
  nudeln_vollkorn: 14, reis: 7, quinoa: 14, couscous: 12, bulgur: 12,
  brot_vollkorn: 8, brot_mischbrot: 7, knaeckebrot: 10,
  // Sport
  proteinpulver: 75, proteinriegel: 30, proteindrink: 10, proteinpudding: 10
};

/** Protein je 100 g — `null`, wenn es dafür keinen Wert gibt. */
function proteinPer100g(productId) {
  const v = PROTEIN_PER_100G[productId];
  return typeof v === "number" ? v : null;
}

/**
 * Wie viel Protein steckt in den Käufen eines Zeitraums?
 *
 * Nur aus Produkten mit hinterlegtem Wert. Was keinen hat, wird
 * NICHT geschätzt, sondern gezählt: `ohneWert` sagt, wie viele
 * Positionen die Rechnung nicht erfasst. Eine Grammzahl, die so
 * tut, als kenne sie den ganzen Einkauf, wäre eine Behauptung.
 */
function dietProtein(purchases, { from = null, to = null, wochen = 1 } = {}) {
  let gramm = 0, mitWert = 0, ohneWert = 0;
  const quellen = new Map();

  for (const h of purchases || []) {
    if (from && h.date < from) continue;
    if (to && h.date > to) continue;
    const p = byId(h.productId);
    if (!p || !p.isFood) continue;

    const je100 = proteinPer100g(h.productId);
    const gewicht = Number(h.weightG) || p.typicalWeightG || 0;
    if (je100 === null || !gewicht) { ohneWert++; continue; }

    const g = (je100 / 100) * gewicht * (Number(h.quantity) || 1);
    gramm += g;
    mitWert++;
    quellen.set(h.productId, (quellen.get(h.productId) || 0) + g);
  }

  const top = [...quellen.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, g]) => ({ productId: id, name: (byId(id) || {}).name || id, gramm: Math.round(g) }));

  const w = Math.max(1, Number(wochen) || 1);
  return {
    gramm: Math.round(gramm),
    grammProWoche: Math.round(gramm / w),
    grammProTag: Math.round(gramm / (w * 7)),
    mitWert,
    ohneWert,
    top,
    hinweis: "Referenzwerte je 100 g, keine Laborwerte — und nur aus Positionen, " +
             "für die ein Wert hinterlegt ist."
  };
}

module.exports = {
  DIET_KIND, DIET_PROFILES, dietProfileById,
  dietKindOf, fitsDiet, dietAlternatives,
  dietShares, proteinPer100g, dietProtein,
  PROTEIN_PER_100G, PLANT_OVERRIDES
};
