/* Gebündelt aus 54 Modulen — nicht von Hand ändern.
   Quelle: src/algo/*.js. Neu bauen mit: npm run build */

/* ===== safetyRules.js ===== */
/**
 * safetyRules.js — die Prüfgrundlage für verderbliche Lebensmittel
 * ================================================================
 * DAS ERGEBNIS DER QUELLENPRÜFUNG, UND ES IST UNBEQUEM:
 *
 * Die Haltbarkeitszahlen der 54 sicherheitskritischen Produkte trugen
 * bisher die Stufe „regulatorisch“ — also „rechtlich definiert“. Das
 * war falsch, und zwar an der empfindlichsten Stelle des Katalogs.
 *
 * Rechtlich definiert ist nämlich NICHT die Anzahl der Tage. Kein
 * Gesetz sagt, dass Hähnchenbrust zwei Tage hält. Rechtlich definiert
 * sind genau zwei andere Dinge:
 *
 *   1. DIE PFLICHT ZUM VERBRAUCHSDATUM.
 *      VO (EU) 1169/2011 (LMIV), Art. 24 und Anhang X: Bei
 *      Lebensmitteln, die „in mikrobiologischer Hinsicht sehr leicht
 *      verderblich sind und daher nach kurzer Zeit eine unmittelbare
 *      Gefahr für die Gesundheit darstellen können", ersetzt das
 *      Verbrauchsdatum das Mindesthaltbarkeitsdatum. Nach dessen
 *      Ablauf ist der Verkauf verboten.
 *
 *   2. DIE HÖCHSTTEMPERATUR.
 *      Tier-LMHV (Anlage 5) in Verbindung mit VO (EG) 853/2004:
 *      Hackfleisch höchstens +2 °C, Innereien +3 °C,
 *      Fleischzubereitungen und Geflügelfleisch +4 °C.
 *
 * Für die TAGE gibt es dagegen bewusst keine amtliche Zahl. Die
 * Behörden nennen keine, weil es keine gibt, die für jedes Produkt,
 * jede Kette und jeden Kühlschrank stimmt. BZfE und BMEL sagen
 * stattdessen zweierlei: es gilt das AUFGEDRUCKTE Datum, und als
 * grobe Orientierung existieren Lagerempfehlungen — Geflügel und rohe
 * Innereien ein bis zwei Tage, Rindfleisch am Stück drei bis vier,
 * Fisch nicht länger als zwei; loses Hackfleisch am selben Tag.
 *
 * DARAUS FOLGEN DREI ENTSCHEIDUNGEN:
 *
 *   a) Die Tageszahlen heißen jetzt ehrlich „leitlinie“ statt
 *      „regulatorisch“. Eine App, die ihre unsicherste Zahl als ihre
 *      sicherste ausweist, ist an genau der Stelle unehrlich, an der
 *      es gefährlich wird.
 *   b) Wo eine Empfehlung eine Spanne nennt, gilt die UNTERE Grenze.
 *      Bei Sicherheit ist der optimistische Wert der falsche.
 *   c) Das aufgedruckte Datum schlägt jede Schätzung. Die Oberfläche
 *      lässt es eintragen, und ab dann rechnet die App damit.
 *
 * Diese Datei ist keine Dokumentation, sondern eine PRÜFUNG:
 * `checkSafetyData` hält den Katalog gegen die Gruppen, und
 * `test/safety.js` bricht ab, sobald ein Produkt darüber liegt oder
 * ohne Beleg dasteht. Damit bleibt die Prüfung gültig, wenn der
 * Katalog wächst — eine einmalige Durchsicht wäre in drei Monaten
 * wieder wertlos.
 * ================================================================
 */

/* Bewusst OHNE Zugriff auf den Katalog: dieses Modul ist die
   Prüfgrundlage, und der Katalog liest sie (für die Temperaturen).
   Andersherum entstünde ein Ring, und die Prüfung würde von dem
   abhängen, was sie prüfen soll. */

/** Rechtsgrundlagen, einmal benannt und überall referenziert. */
const LEGAL = {
  LMIV_24: "VO (EU) 1169/2011 (LMIV), Art. 24 i. V. m. Anhang X — Verbrauchsdatum " +
           "statt MHD bei sehr leicht verderblichen Lebensmitteln; nach Ablauf Abgabeverbot.",
  TIER_LMHV: "Tier-LMHV Anlage 5 i. V. m. VO (EG) 853/2004 — Höchsttemperaturen " +
             "bei Lagerung und Abgabe.",
  BMEL_LAGER: "BMEL, „Zu gut für die Tonne!“, Lagerempfehlungen — Geflügel und rohe " +
              "Innereien 1–2 Tage, Rindfleisch am Stück 3–4 Tage, Fisch höchstens 2 Tage.",
  BZFE_HACK: "BZfE, „Lebensmittel richtig lagern“ — loses Hackfleisch am selben Tag " +
             "(6 bis 8 Stunden), abgepacktes innerhalb des aufgedruckten Verbrauchsdatums."
};

/**
 * Gruppen mit ihren Obergrenzen.
 *
 * `maxDays` ist eine OBERGRENZE, keine Vorgabe: ein Produkt darf
 * kürzer angesetzt sein, nie länger. `maxTempC` ist dagegen die
 * rechtliche Zahl und wird unverändert angezeigt.
 *
 * Die Zuordnung steht als ausdrückliche Liste da und wird NICHT aus
 * Kategorie oder Namen abgeleitet. Bei Sicherheit ist eine Heuristik
 * der falsche Ort für Bequemlichkeit: „Entenbrust“ enthält kein Wort,
 * an dem eine Regel erkennt, dass es Geflügel ist — und genau dieser
 * Eintrag stand vorher mit drei Tagen im Katalog, ein Tag über der
 * Empfehlung für Geflügel.
 */
const SAFETY_GROUPS = [
  {
    id: "hack",
    label: "Hackfleisch, zerkleinertes rohes Fleisch",
    maxDays: 1,
    maxTempC: 2,
    legal: [LEGAL.LMIV_24, LEGAL.TIER_LMHV],
    guide: LEGAL.BZFE_HACK,
    ids: ["hackfleisch", "hack_rind"]
  },
  {
    id: "gefluegel",
    label: "Geflügelfleisch und Zubereitungen daraus",
    maxDays: 2,
    maxTempC: 4,
    legal: [LEGAL.LMIV_24, LEGAL.TIER_LMHV],
    guide: LEGAL.BMEL_LAGER,
    ids: ["haehnchen", "haehnchen_schenkel", "haehnchen_ganz", "haehnchen_fluegel",
      "haehnchen_innen", "haehnchen_nuggets", "putenbrust", "putengeschnetzeltes",
      "entenbrust", "gans"]
  },
  {
    id: "innereien",
    label: "Innereien",
    maxDays: 2,
    maxTempC: 3,
    legal: [LEGAL.LMIV_24, LEGAL.TIER_LMHV],
    guide: LEGAL.BMEL_LAGER,
    ids: ["leber"]
  },
  {
    id: "zubereitung",
    label: "Fleischzubereitungen (mariniert, gewürzt, gewürfelt)",
    maxDays: 2,
    maxTempC: 4,
    legal: [LEGAL.LMIV_24, LEGAL.TIER_LMHV],
    guide: "Abgeleitet aus der Hackfleisch- und Geflügelempfehlung: durch das " +
           "Zerkleinern und Würzen ist die Oberfläche größer und die Haltbarkeit " +
           "kürzer als bei einem Stück Fleisch.",
    ids: ["bratwurst", "gyros_frisch", "merguez", "spiesse_grill", "hackbaellchen_frisch",
      "gulasch"]
  },
  {
    id: "rotfleisch",
    label: "Rotes Fleisch am Stück",
    maxDays: 3,
    maxTempC: 7,
    legal: [LEGAL.LMIV_24, LEGAL.TIER_LMHV],
    guide: LEGAL.BMEL_LAGER,
    ids: ["rindersteak", "rinderhueftsteak", "rinderbraten", "rinderfilet", "tafelspitz",
      "suppenfleisch", "schweineschnitzel", "schweinefilet", "schweinebauch",
      "schweinenacken", "schweinerueckensteak", "lammkotelett", "lammkeule",
      "kalbsschnitzel"]
  },
  {
    id: "fisch",
    label: "Frischer Fisch, Meeresfrüchte",
    maxDays: 2,
    maxTempC: 2,
    legal: [LEGAL.LMIV_24,
      "VO (EG) 853/2004 Anhang III Abschnitt VIII — frische Fischereierzeugnisse " +
      "bei annähernd der Temperatur von schmelzendem Eis."],
    guide: LEGAL.BMEL_LAGER,
    ids: ["fisch_lachs", "fisch_weiss", "forelle", "zander", "dorade", "wolfsbarsch",
      "rotbarsch", "scholle", "hering_frisch", "makrele_frisch", "thunfisch_frisch",
      "garnelen", "muscheln", "tintenfisch", "fischstaebchen_frisch"]
  },
  {
    id: "verzehrfertig",
    label: "Vorzerkleinert und verzehrfertig",
    maxDays: 2,
    maxTempC: 7,
    legal: [LEGAL.LMIV_24],
    guide: "BZfE nennt vorgeschnittene Salate und kleingeschnittenes Obst " +
           "ausdrücklich als Verbrauchsdatum-Produkte; eine Tageszahl nennt keine " +
           "amtliche Quelle. Angesetzt wird deshalb der kürzeste Wert der " +
           "vergleichbaren Gruppen.",
    ids: ["obst_geschnitten", "salat_geschnitten", "sprossen", "sandwich_fertig",
      "salat_fertig", "sushi_fertig"]
  }
];

/** Gruppe eines Produkts — null, wenn es keiner zugeordnet ist. */
function safetyGroupOf(productId) {
  return SAFETY_GROUPS.find((g) => g.ids.includes(productId)) || null;
}

/**
 * Katalog gegen die Gruppen prüfen.
 *
 * @returns {Array<{productId, level, message}>} leer = alles in Ordnung
 */
function checkSafetyData(catalog) {
  const probleme = [];
  if (!Array.isArray(catalog)) return [{ productId: null, level: "fehler", message: "kein Katalog übergeben" }];
  const zugeordnet = new Set();

  catalog.forEach((p) => {
    if (!p.safetyCritical) {
      // Umgekehrt gilt auch: was in einer Gruppe steht, MUSS als
      // sicherheitskritisch geführt sein. Sonst greifen die Sperren
      // in Rezepten und Verlängerungen nicht.
      if (safetyGroupOf(p.id)) {
        probleme.push({ productId: p.id, level: "fehler",
          message: "steht in einer Sicherheitsgruppe, ist aber nicht safetyCritical" });
      }
      return;
    }

    const g = safetyGroupOf(p.id);
    if (!g) {
      probleme.push({ productId: p.id, level: "fehler",
        message: "sicherheitskritisch, aber keiner geprüften Gruppe zugeordnet" });
      return;
    }
    zugeordnet.add(p.id);

    if (p.dateType !== "verbrauchsdatum") {
      probleme.push({ productId: p.id, level: "fehler",
        message: `dateType „${p.dateType}“ statt „verbrauchsdatum“` });
    }
    if (p.shelfLifeDays > g.maxDays) {
      probleme.push({ productId: p.id, level: "fehler",
        message: `${p.shelfLifeDays} Tage — die Gruppe „${g.label}“ erlaubt höchstens ${g.maxDays}` });
    }
    if (p.shelfLifeDays < 0 || !Number.isFinite(p.shelfLifeDays)) {
      probleme.push({ productId: p.id, level: "fehler", message: `unbrauchbare Haltbarkeit: ${p.shelfLifeDays}` });
    }
    if (Number.isFinite(p.shelfLifeOpenedDays) && p.shelfLifeOpenedDays > p.shelfLifeDays) {
      probleme.push({ productId: p.id, level: "fehler",
        message: "angebrochen hält länger als ungeöffnet" });
    }
    // Die Tageszahl ist eine Empfehlung, kein Gesetz. Wer sie als
    // „regulatorisch“ ausweist, behauptet eine Sicherheit, die es
    // nicht gibt — das war der eigentliche Befund der Prüfung.
    if (p.quality === "regulatorisch") {
      probleme.push({ productId: p.id, level: "fehler",
        message: "Haltbarkeit als „regulatorisch“ ausgewiesen — für die Tageszahl gibt es keine Rechtsgrundlage" });
    }
    if (p.maxTempC !== g.maxTempC) {
      probleme.push({ productId: p.id, level: "fehler",
        message: `maxTempC ${p.maxTempC} statt ${g.maxTempC} (${g.label})` });
    }
    if (!p.checked) {
      probleme.push({ productId: p.id, level: "fehler", message: "ohne Prüfdatum" });
    }
  });

  SAFETY_GROUPS.forEach((g) => {
    g.ids.forEach((id) => {
      if (!zugeordnet.has(id) && !catalog.some((p) => p.id === id)) {
        probleme.push({ productId: id, level: "hinweis",
          message: `steht in Gruppe „${g.label}“, fehlt aber im Katalog` });
      }
    });
  });

  return probleme;
}

/**
 * Was die Oberfläche über ein sicherheitskritisches Produkt sagen
 * darf — Rechtsgrundlage und Empfehlung getrennt, nie vermischt.
 */
function safetyFacts(productId) {
  const g = safetyGroupOf(productId);
  if (!g) return null;
  return {
    group: g.id,
    label: g.label,
    maxDays: g.maxDays,
    maxTempC: g.maxTempC,
    legal: g.legal,
    guide: g.guide,
    printedWins: "Es gilt immer das aufgedruckte Verbrauchsdatum. Danach gehört das " +
                 "Produkt in den Abfall — auch wenn es unauffällig aussieht und riecht."
  };
}

/* ===== foodDatabase.js ===== */
/**
 * foodDatabase.js — v4, stark erweitert
 * ================================================================
 * Rund 850 Produkte des deutschen Supermarkt-Sortiments.
 *
 * Die Größe ist kein Selbstzweck. Sie hat zwei Adressaten:
 * den Bonabgleich (productMatcher2) und die Tippsuche
 * (productSearch). Wer beim Hinzufügen „ban“ tippt, soll Bananen
 * bekommen und damit ein Produkt MIT Haltbarkeit, Lagerort und
 * Gewicht — keine freie Textzeile, die nichts lernt. Jede Zeile,
 * die hier fehlt, fällt in der Oberfläche auf den freien Text
 * zurück und ist für Rhythmus, Verderb und Wirkungsmessung
 * unsichtbar.
 *
 * QUALITÄTSSTUFEN (unverändert, weiterhin verbindlich):
 *   "regulatorisch" = Verbrauchsdatum-Pflicht, rechtlich definiert.
 *                     Quelle: BZfE/BLE, Haltbarkeit von Lebensmitteln, 20.02.2025
 *   "leitlinie"     = aus behördlicher Lagerempfehlung abgeleitet.
 *                     Quelle: BZfE/BLE, Lebensmittel richtig lagern, 20.02.2025
 *   "schaetzwert"   = Erfahrungswert OHNE amtliche Quelle.
 *                     Vor Produktivbetrieb gegen belastbare Quelle prüfen.
 *
 * NON-FOOD ist bewusst enthalten (Spülmittel, Klopapier, Zahnpasta).
 * Grund: Diese Zeilen stehen auf jedem Bon. Ohne sie im Katalog
 * würden sie entweder als "unbekannt" auflaufen oder — schlimmer —
 * fälschlich einem Lebensmittel zugeordnet. Sie tragen isFood:false
 * und werden von Haltbarkeits- und Verschwendungslogik ausgenommen.
 *
 * typicalWeightG dient der Wirkungsmessung in Kilogramm
 * (Anforderung der Impact-Investorin aus dem Persona-Bericht).
 * ================================================================
 */

const STORAGE = {
  FRIDGE_BOTTOM: "Kühlschrank unten (kälteste Zone)",
  FRIDGE_MIDDLE: "Kühlschrank Mitte",
  FRIDGE_DOOR: "Kühlschranktür",
  FRIDGE_VEG: "Gemüsefach",
  ROOM: "Zimmertemperatur",
  PANTRY: "Vorratsschrank",
  FREEZER: "Tiefkühler",
  NONE: "kein Lagerhinweis"
};

const DATE_TYPE = { MHD: "mhd", VERBRAUCHSDATUM: "verbrauchsdatum", NONE: "keins" };
const ETHYLENE = { PRODUCER: "produziert", SENSITIVE: "empfindlich", NEUTRAL: "neutral" };



/* Tag der letzten Quellenprüfung der sicherheitskritischen Produkte.
   Steht hier und nicht je Zeile: geprüft wurde alles auf einmal, und
   54-mal dasselbe Datum in die Tabelle zu schreiben lädt nur dazu
   ein, dass eines davon irgendwann nicht mitgezogen wird. */
const SAFETY_CHECKED = "2026-08-13";

const FOOD_DATABASE = [];

function group(category, aisle, storage, rows, groupOpts = {}) {
  rows.forEach((r) => {
    const [id, name, dateType, su, so, quality, price, weightG, aliases = [], opts = {}] = r;
    const sg = safetyGroupOf(id);
    FOOD_DATABASE.push({
      id, name, category, aisle,
      storage: opts.storage || storage,
      dateType,
      shelfLifeDays: su,
      shelfLifeOpenedDays: so,
      quality,
      safetyCritical: dateType === DATE_TYPE.VERBRAUCHSDATUM,
      isFood: groupOpts.isFood !== false && opts.isFood !== false,
      ethylene: opts.ethylene || ETHYLENE.NEUTRAL,
      freezable: opts.freezable !== undefined ? opts.freezable : (groupOpts.freezable !== false),
      typicalPrice: price,
      typicalWeightG: weightG,
      aliases,
      note: opts.note || null,
      /* Die rechtliche Höchsttemperatur kommt aus safetyRules und
         wird NICHT je Zeile gepflegt — sie hängt an der Gruppe, nicht
         am einzelnen Produkt, und eine Zahl, die an 54 Stellen
         wiederholt wird, ist 54 Gelegenheiten, sie falsch zu
         schreiben. */
      maxTempC: sg ? sg.maxTempC : null,
      safetyGroup: sg ? sg.id : null,
      checked: sg ? SAFETY_CHECKED : null
    });
  });
}

const M = DATE_TYPE.MHD, V = DATE_TYPE.VERBRAUCHSDATUM, N = DATE_TYPE.NONE;
const REG = "regulatorisch", LEIT = "leitlinie", EST = "schaetzwert";

// ===================== MILCH, KÄSE, EIER =========================
group("Milchprodukte", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["milch_vollmilch","Vollmilch 3,5 %",M,8,3,EST,1.19,1000,["H-MILCH 3,5%","VOLLMILCH","MILCH FRISCH 3,5%","FRISCHE VOLLMILCH"],{freezable:false,note:"Einfrieren technisch möglich, verändert aber Textur deutlich — wird nicht empfohlen."}],
  ["milch_fettarm","Fettarme Milch 1,5 %",M,8,3,EST,1.09,1000,["FETTARME MILCH","MILCH 1,5%","H-MILCH 1,5%"],{freezable:false}],
  ["milch_haltbar","H-Milch",M,120,3,EST,1.09,1000,["HALTBARE MILCH","H MILCH"],{storage:STORAGE.PANTRY}],
  ["hafermilch","Haferdrink",M,180,4,EST,1.49,1000,["HAFERDRINK","HAFERMILCH"],{storage:STORAGE.PANTRY}],
  ["mandelmilch","Mandeldrink",M,180,4,EST,1.79,1000,["MANDELDRINK","MANDELMILCH"],{storage:STORAGE.PANTRY}],
  ["sojamilch","Sojadrink",M,180,4,EST,1.39,1000,["SOJADRINK","SOJAMILCH"],{storage:STORAGE.PANTRY}],
  ["joghurt_natur","Naturjoghurt",M,21,5,EST,1.09,500,["NATURJOGHURT","JOGHURT NATUR","JOGHURT MILD"],{freezable:false,note:"Laut BZfE oft Wochen nach MHD essbar, wenn Sinnescheck positiv."}],
  ["joghurt_frucht","Fruchtjoghurt",M,21,3,EST,0.55,150,["FRUCHTJOGHURT","JOGHURT ERDBEER","JOGHURT KIRSCHE"],{freezable:false}],
  ["joghurt_griechisch","Griechischer Joghurt",M,21,5,EST,1.29,400,["GRIECHISCHER JOGHURT","JOGHURT GRIECHISCH"]],
  ["skyr","Skyr",M,21,4,EST,1.19,450,["SKYR","SKYR NATUR"],{freezable:false}],
  ["quark","Speisequark",M,14,4,EST,0.99,500,["SPEISEQUARK","MAGERQUARK","QUARK","SPEISEQUARK MAGER"],{freezable:false}],
  ["huettenkaese","Hüttenkäse",M,18,4,EST,1.19,200,["HUETTENKAESE","KOERNIGER FRISCHKAESE"],{freezable:false}],
  ["schmand","Schmand",M,21,5,EST,0.79,200,["SCHMAND"]],
  ["creme_fraiche","Crème fraîche",M,25,5,EST,0.89,200,["CREME FRAICHE"]],
  ["sauerrahm","Saure Sahne",M,21,5,EST,0.65,200,["SAURE SAHNE","SAUERRAHM"],{freezable:false}],
  ["sahne","Schlagsahne",M,21,2,EST,0.99,200,["SCHLAGSAHNE","SAHNE"]],
  ["kaffeesahne","Kaffeesahne",M,120,4,EST,0.69,340,["KAFFEESAHNE","KONDENSMILCH"],{storage:STORAGE.PANTRY}],
  ["butter","Butter",M,40,21,LEIT,2.29,250,["BUTTER","DEUTSCHE MARKENBUTTER","SUESSRAHMBUTTER"],{storage:STORAGE.FRIDGE_DOOR,note:"BZfE: Tür ist korrekt, nur leicht kühlbedürftig."}],
  ["margarine","Margarine",M,60,30,EST,1.29,500,["MARGARINE"],{storage:STORAGE.FRIDGE_DOOR}],
  ["kaese_gouda","Gouda Scheiben",M,30,8,EST,2.19,200,["GOUDA","GOUDA SCHEIBEN","GOUDA JUNG"]],
  ["kaese_emmentaler","Emmentaler",M,30,10,EST,2.49,200,["EMMENTALER"]],
  ["kaese_butterkaese","Butterkäse",M,28,8,EST,1.99,200,["BUTTERKAESE"]],
  ["kaese_bergkaese","Bergkäse",M,40,14,EST,2.99,200,["BERGKAESE"]],
  ["kaese_reibe","Reibekäse",M,25,7,EST,1.79,200,["REIBEKAESE","GERIEBENER KAESE","PIZZAKAESE"]],
  ["parmesan","Parmesan",M,60,21,EST,2.99,150,["PARMESAN","GRANA PADANO"]],
  ["frischkaese","Frischkäse",M,21,7,EST,1.49,200,["FRISCHKAESE","DOPPELRAHMSTUFE"]],
  ["feta","Feta",M,45,7,EST,2.29,200,["FETA","SCHAFSKAESE","HIRTENKAESE"]],
  ["mozzarella","Mozzarella",M,21,2,EST,0.89,125,["MOZZARELLA"]],
  ["camembert","Camembert",M,21,5,EST,1.49,125,["CAMEMBERT","BRIE"]],
  ["harzer","Harzer Käse",M,18,5,EST,0.99,200,["HARZER","HARZER KAESE"]],
  ["mascarpone","Mascarpone",M,25,4,EST,1.49,250,["MASCARPONE"]],
  ["eier","Eier",M,28,28,LEIT,3.29,600,["EIER","FRISCHEIER","BODENHALTUNG EIER"],{note:"Ab Legedatum 28 Tage. Nach MHD nur durcherhitzt verwenden.",freezable:false}],
  ["eier_bio","Bio-Eier",M,28,28,LEIT,4.49,600,["FREILAND EIER"],{freezable:false}],
  ["pudding","Pudding",M,21,2,EST,0.55,150,["PUDDING","SCHOKOPUDDING","GRIESSBREI"]],
  ["milchreis_fertig","Milchreis fertig",M,21,2,EST,0.65,200,["MILCHREIS BECHER"]]
]);

// ===================== FLEISCH & FISCH ===========================
group("Fleisch/Fisch", "Fleisch & Fisch", STORAGE.FRIDGE_BOTTOM, [
  ["hackfleisch","Hackfleisch gemischt",V,1,1,LEIT,4.99,500,["HACKFLEISCH","GEMISCHTES HACK","METT"],{note:"BZfE nennt Hackfleisch ausdrücklich als Verbrauchsdatum-Produkt."}],
  ["hack_rind","Rinderhackfleisch",V,1,1,LEIT,5.99,500,["RINDERHACK","HACKFLEISCH RIND"]],
  ["haehnchen","Hähnchenbrust",V,2,1,LEIT,6.99,400,["HAEHNCHENBRUST","HÄHNCHENBRUSTFILET","GEFLUEGEL BRUST","HAEHNCHENFILET"],{note:"Geflügel laut BZfE Verbrauchsdatum-Produkt."}],
  ["haehnchen_schenkel","Hähnchenschenkel",V,2,1,LEIT,3.99,600,["HAEHNCHENSCHENKEL","HAEHNCHENKEULE"]],
  ["putenbrust","Putenbrust",V,2,1,LEIT,7.49,400,["PUTENBRUST","PUTENSCHNITZEL"]],
  ["schweineschnitzel","Schweineschnitzel",V,3,1,LEIT,5.49,500,["SCHNITZEL","SCHWEINESCHNITZEL"]],
  ["schweinefilet","Schweinefilet",V,3,1,LEIT,7.99,400,["SCHWEINEFILET"]],
  ["rindersteak","Rindersteak",V,3,1,LEIT,9.99,300,["RUMPSTEAK","RINDERSTEAK","ENTRECOTE"]],
  ["gulasch","Gulasch",V,2,1,LEIT,6.49,500,["GULASCH","GULASCHFLEISCH"]],
  ["bratwurst","Bratwurst",V,2,1,LEIT,3.49,400,["BRATWURST","ROSTBRATWURST","NUERNBERGER"]],
  ["fisch_lachs","Lachsfilet",V,1,1,LEIT,8.99,250,["LACHSFILET","LACHS"],{note:"Roher Fisch laut BZfE Verbrauchsdatum-Produkt."}],
  ["fisch_weiss","Weißfischfilet",V,1,1,LEIT,6.99,300,["SEELACHS","KABELJAU","FISCHFILET","PANGASIUS"]],
  ["garnelen","Garnelen",V,1,1,LEIT,5.99,200,["GARNELEN","SHRIMPS"]],
  ["raeucherlachs","Räucherlachs",M,14,2,EST,3.99,100,["RAEUCHERLACHS","GRAVED LACHS"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["thunfisch_dose","Thunfisch, Dose",M,900,2,LEIT,1.29,150,["THUNFISCH DOSE","THUNFISCH"],{storage:STORAGE.PANTRY}]
]);

group("Wurstwaren", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["wurst_aufschnitt","Wurstaufschnitt",M,10,4,EST,1.79,150,["AUFSCHNITT","LYONER","MORTADELLA"]],
  ["salami","Salami",M,25,10,EST,1.99,100,["SALAMI"]],
  ["schinken_gekocht","Kochschinken",M,10,4,EST,1.99,150,["KOCHSCHINKEN","SCHINKEN GEKOCHT"]],
  ["schinken_roh","Rohschinken",M,21,10,EST,2.49,100,["ROHSCHINKEN","SCHWARZWAELDER SCHINKEN","SERRANO"],{note:"Bei geräuchertem Schinken laut Fachquellen bis 2 Wochen über MHD; bei schmierigem Belag entsorgen."}],
  ["leberwurst","Leberwurst",M,18,5,EST,1.49,200,["LEBERWURST"]],
  ["teewurst","Teewurst",M,18,5,EST,1.69,150,["TEEWURST"]],
  ["wiener","Wiener Würstchen",M,21,3,EST,2.29,250,["WIENER","BOCKWURST","WUERSTCHEN"]],
  ["fleischwurst","Fleischwurst",M,14,4,EST,1.79,200,["FLEISCHWURST"]],
  ["bacon","Bacon",M,21,5,EST,1.99,150,["BACON","FRUEHSTUECKSSPECK"]]
]);

// ===================== OBST (Gemüsefach) =========================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["aepfel","Äpfel",M,21,10,LEIT,2.49,1000,["AEPFEL","ÄPFEL","APFEL","ELSTAR","BRAEBURN"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: länger als 7 Tage im Gemüsefach lagern."}],
  ["birnen","Birnen",M,10,5,LEIT,2.29,1000,["BIRNEN"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: im Zimmer reifen, dann Kühlschrank."}],
  ["trauben","Weintrauben",M,7,4,LEIT,2.99,500,["TRAUBEN","WEINTRAUBEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["erdbeeren","Erdbeeren",M,3,2,LEIT,2.99,500,["ERDBEEREN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["heidelbeeren","Heidelbeeren",M,5,3,LEIT,2.49,250,["HEIDELBEEREN","BLAUBEEREN"],{ethylene:ETHYLENE.PRODUCER}],
  ["himbeeren","Himbeeren",M,3,2,LEIT,2.99,250,["HIMBEEREN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["brombeeren","Brombeeren",M,3,2,LEIT,2.49,250,["BROMBEEREN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["kirschen","Kirschen",M,5,3,LEIT,3.99,500,["KIRSCHEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["pflaumen","Pflaumen",M,7,4,LEIT,2.49,500,["PFLAUMEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["pfirsiche","Pfirsiche",M,6,3,LEIT,2.99,500,["PFIRSICHE"],{ethylene:ETHYLENE.PRODUCER}],
  ["aprikosen","Aprikosen",M,6,3,LEIT,2.99,500,["APRIKOSEN","MARILLEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["orangen","Orangen",M,18,7,LEIT,2.49,1000,["ORANGEN","APFELSINEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["mandarinen","Mandarinen",M,14,7,LEIT,2.29,1000,["MANDARINEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["zitronen","Zitronen",M,21,7,LEIT,1.29,500,["ZITRONEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["limetten","Limetten",M,18,7,LEIT,1.49,300,["LIMETTEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["kiwi","Kiwi",M,12,5,LEIT,1.99,500,["KIWI"],{ethylene:ETHYLENE.PRODUCER}],
  ["ananas","Ananas",M,7,3,LEIT,2.49,1200,["ANANAS"],{ethylene:ETHYLENE.SENSITIVE}],
  ["melone","Melone",M,7,3,LEIT,3.49,2000,["MELONE"],{ethylene:ETHYLENE.PRODUCER}],
  ["mango","Mango",M,7,3,LEIT,1.99,400,["MANGO"],{ethylene:ETHYLENE.PRODUCER}],
  ["granatapfel","Granatapfel",M,21,5,LEIT,2.49,400,["GRANATAPFEL"],{ethylene:ETHYLENE.SENSITIVE}],
  ["feigen","Feigen",M,5,3,LEIT,3.49,300,["FEIGEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["obst_geschnitten","Obst, geschnitten",V,1,1,LEIT,2.99,300,["OBSTSALAT","MELONE GESCHNITTEN","ANANAS GESCHNITTEN"],{freezable:false,note:"Kleingeschnittenes Obst laut BZfE Verbrauchsdatum-Produkt."}]
]);

// ===================== OBST/GEMÜSE (Zimmertemperatur) ============
group("Frischware", "Obst & Gemüse", STORAGE.ROOM, [
  ["bananen","Bananen",M,7,3,LEIT,1.79,1000,["BANANEN"],{ethylene:ETHYLENE.PRODUCER,note:"Starker Ethylenproduzent — getrennt lagern."}],
  ["avocado","Avocado",M,6,1,LEIT,1.79,200,["AVOCADO"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: im Zimmer reifen, danach Kühlschrank."}],
  ["tomaten","Tomaten",M,7,3,LEIT,2.49,500,["TOMATEN","STRAUCHTOMATEN"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: Zimmertemperatur, nicht Kühlschrank."}],
  ["gurke","Salatgurke",M,7,3,LEIT,0.99,400,["SALATGURKE","GURKE"],{ethylene:ETHYLENE.SENSITIVE,freezable:false}],
  ["paprika","Paprika",M,8,4,LEIT,2.29,500,["PAPRIKA"],{ethylene:ETHYLENE.SENSITIVE}],
  ["zucchini","Zucchini",M,8,4,LEIT,1.49,400,["ZUCCHINI"],{ethylene:ETHYLENE.SENSITIVE}],
  ["aubergine","Aubergine",M,7,4,LEIT,1.49,400,["AUBERGINE","MELANZANI"],{ethylene:ETHYLENE.SENSITIVE}],
  ["knoblauch","Knoblauch",M,60,21,LEIT,0.99,100,["KNOBLAUCH"]],
  ["ingwer","Ingwer",M,21,10,LEIT,1.29,100,["INGWER"]],
  ["basilikum","Basilikum",M,7,4,LEIT,1.49,50,["BASILIKUM","BASILIKUM TOPF"],{freezable:false,note:"BZfE führt Basilikum ausdrücklich als Kräuter-Ausnahme: nicht kühlen."}],
  ["kuerbis","Kürbis",M,30,5,LEIT,2.49,1500,["KUERBIS","HOKKAIDO","BUTTERNUT"]]
]);

group("Frischware", "Obst & Gemüse", STORAGE.PANTRY, [
  ["kartoffeln","Kartoffeln",M,60,21,LEIT,2.99,2000,["KARTOFFELN","SPEISEKARTOFFELN"],{note:"BZfE: kühl und dunkel, nicht Kühlschrank."}],
  ["suesskartoffel","Süßkartoffeln",M,30,10,LEIT,2.99,1000,["SUESSKARTOFFELN"]],
  ["zwiebeln","Zwiebeln",M,45,14,LEIT,1.49,1000,["ZWIEBELN","SPEISEZWIEBELN","GEMUESEZWIEBEL"]],
  ["schalotten","Schalotten",M,40,14,LEIT,1.99,250,["SCHALOTTEN"]],
  ["rotezwiebeln","Rote Zwiebeln",M,45,14,LEIT,1.69,500,["ROTE ZWIEBELN"]]
]);

// ===================== GEMÜSE (Gemüsefach) ======================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["salat_kopf","Kopfsalat",M,5,2,LEIT,1.39,400,["KOPFSALAT","SALAT KOPF","EISBERG"],{freezable:false,note:"BZfE: Gemüsefach, in Behälter oder feuchtem Tuch."}],
  ["salat_geschnitten","Salatmischung, geschnitten",V,2,1,LEIT,1.29,150,["BLATTSALAT GESCHNITTEN","FELDSALAT BEUTEL","ROHKOSTSALAT"],{freezable:false,note:"Vorgeschnittene Salate laut BZfE Verbrauchsdatum-Produkt."}],
  ["feldsalat","Feldsalat",M,4,2,LEIT,1.99,150,["FELDSALAT","RAPUNZEL"],{freezable:false}],
  ["rucola","Rucola",M,4,2,LEIT,1.49,125,["RUCOLA","RAUKE"],{freezable:false}],
  ["moehren","Möhren",M,21,10,LEIT,1.29,1000,["MOEHREN","KAROTTEN","MÖHREN"],{note:"BZfE: aus dem Folienbeutel nehmen, Grün abschneiden."}],
  ["brokkoli","Brokkoli",M,6,3,LEIT,1.79,500,["BROKKOLI"]],
  ["blumenkohl","Blumenkohl",M,7,3,LEIT,1.99,800,["BLUMENKOHL"]],
  ["champignons","Champignons",M,5,3,LEIT,1.69,250,["CHAMPIGNONS","PILZE","EGERLINGE"]],
  ["lauch","Lauch",M,10,5,LEIT,1.29,400,["LAUCH","PORREE"]],
  ["spinat_frisch","Blattspinat frisch",M,3,2,LEIT,1.99,300,["BLATTSPINAT","SPINAT FRISCH"]],
  ["kraeuter","Frische Kräuter",M,5,3,LEIT,1.49,30,["KRAEUTER","KORIANDER"],{note:"BZfE: Kräuter ins Gemüsefach — ausgenommen Basilikum."}],
  ["sellerie","Sellerie",M,14,7,LEIT,1.49,500,["SELLERIE"]],
  ["kohlrabi","Kohlrabi",M,10,5,LEIT,0.99,400,["KOHLRABI"]],
  ["weisskohl","Weißkohl",M,21,10,LEIT,1.29,1000,["WEISSKOHL"]],
  ["rotkohl","Rotkohl",M,21,10,LEIT,1.49,1000,["ROTKOHL","BLAUKRAUT"]],
  ["wirsing","Wirsing",M,12,6,LEIT,1.49,800,["WIRSING"]],
  ["rosenkohl","Rosenkohl",M,8,4,LEIT,2.29,500,["ROSENKOHL"]],
  ["chicoree","Chicorée",M,8,4,LEIT,1.49,300,["CHICOREE"]],
  ["radieschen","Radieschen",M,7,4,LEIT,0.99,200,["RADIESCHEN"],{note:"BZfE: Grün vorher abschneiden."}],
  ["rote_bete","Rote Bete",M,21,10,LEIT,1.49,500,["ROTE BETE","ROTE RUEBEN"]],
  ["bohnen_gruen","Grüne Bohnen",M,6,3,LEIT,2.49,500,["GRUENE BOHNEN","BUSCHBOHNEN"]],
  ["zuckerschoten","Zuckerschoten",M,5,3,LEIT,2.99,200,["ZUCKERSCHOTEN","ZUCKERERBSEN"]],
  ["spargel","Spargel",M,4,2,LEIT,5.99,500,["SPARGEL","BLEICHSPARGEL"]],
  ["fenchel","Fenchel",M,8,4,LEIT,1.99,400,["FENCHEL"]],
  ["mangold","Mangold",M,5,3,LEIT,1.99,400,["MANGOLD"]],
  ["pastinaken","Pastinaken",M,18,8,LEIT,1.99,500,["PASTINAKEN"]],
  ["lauchzwiebeln","Frühlingszwiebeln",M,7,4,LEIT,0.89,150,["FRUEHLINGSZWIEBELN","LAUCHZWIEBELN"]],
  ["kresse","Kresse",M,5,3,LEIT,0.99,50,["KRESSE"],{freezable:false}],
  ["sprossen","Sprossen",V,2,1,LEIT,1.49,100,["SPROSSEN","MUNGBOHNENSPROSSEN"],{freezable:false}]
]);

// ===================== BACKWAREN =================================
group("Backwaren", "Backwaren", STORAGE.ROOM, [
  ["brot_vollkorn","Vollkornbrot",M,6,5,LEIT,2.49,750,["VOLLKORNBROT","BROT VOLLKORN"],{note:"BZfE: Brot trocknet im Kühlschrank aus — nicht kühlen."}],
  ["brot_mischbrot","Mischbrot",M,5,4,EST,2.29,750,["MISCHBROT","ROGGENMISCHBROT","LANDBROT"]],
  ["brot_roggen","Roggenbrot",M,7,6,EST,2.49,750,["ROGGENBROT","SCHWARZBROT"]],
  ["brot_weiss","Weißbrot",M,4,3,EST,1.99,500,["WEISSBROT"]],
  ["toastbrot","Toastbrot",M,10,7,EST,1.29,500,["TOASTBROT","TOAST","SANDWICHTOAST"]],
  ["broetchen","Brötchen",M,2,1,EST,0.45,60,["BROETCHEN","BRÖTCHEN","SEMMEL","SCHRIPPE"]],
  ["laugengebaeck","Laugengebäck",M,2,1,EST,0.89,80,["BREZEL","LAUGENBROETCHEN"]],
  ["croissant","Croissant",M,3,2,EST,0.99,70,["CROISSANT","BUTTERCROISSANT"]],
  ["knaeckebrot","Knäckebrot",M,270,60,EST,1.49,250,["KNAECKEBROT"],{storage:STORAGE.PANTRY}],
  ["zwieback","Zwieback",M,270,30,EST,1.19,225,["ZWIEBACK"],{storage:STORAGE.PANTRY}],
  ["kuchen","Kuchen",M,4,3,EST,3.99,500,["KUCHEN","MARMORKUCHEN"]],
  ["wraps","Wraps",M,60,7,EST,1.49,370,["WRAPS","TORTILLAS"]]
]);

// ===================== TROCKEN & VORRAT ==========================
group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["nudeln","Nudeln",M,730,180,LEIT,1.29,500,["NUDELN","MAKKARONI","BANDNUDELN"],{note:"BZfE: oft Monate bis Jahre über MHD genießbar."}],
  ["nudeln_vollkorn","Vollkornnudeln",M,540,180,EST,1.79,500,["VOLLKORNNUDELN"]],
  ["reis","Reis",M,730,365,LEIT,2.19,1000,["REIS","LANGKORNREIS"]],
  ["risottoreis","Risottoreis",M,730,365,EST,2.49,500,["RISOTTOREIS","ARBORIO"]],
  ["couscous","Couscous",M,540,180,EST,1.49,500,["COUSCOUS"]],
  ["bulgur","Bulgur",M,540,180,EST,1.69,500,["BULGUR"]],
  ["quinoa","Quinoa",M,540,180,EST,2.99,400,["QUINOA"]],
  ["mehl","Mehl",M,540,180,LEIT,0.89,1000,["MEHL","WEIZENMEHL"],{note:"Helle Mehle oft Wochen bis Monate über MHD haltbar; auf Schädlinge achten."}],
  ["haferflocken","Haferflocken",M,365,120,EST,0.99,500,["HAFERFLOCKEN"]],
  ["muesli","Müsli",M,270,90,EST,2.49,750,["MUESLI","MÜSLI","KNUSPERMUESLI"]],
  ["cornflakes","Cornflakes",M,270,60,EST,2.29,500,["CORNFLAKES","CEREALIEN"]],
  ["zucker","Zucker",M,1460,1460,LEIT,0.99,1000,["ZUCKER","KRISTALLZUCKER"]],
  ["puderzucker","Puderzucker",M,730,365,EST,0.79,250,["PUDERZUCKER"]],
  ["salz","Salz",M,3650,3650,LEIT,0.49,500,["SALZ","SPEISESALZ"]],
  ["pfeffer","Pfeffer",M,730,365,EST,1.49,50,["PFEFFER"]],
  ["gewuerze","Gewürze",M,730,365,EST,1.29,30,["OREGANO","CURRY","KUEMMEL","THYMIAN"]],
  ["backpulver","Backpulver",M,730,365,EST,0.49,45,["BACKPULVER"]],
  ["hefe","Trockenhefe",M,365,90,EST,0.59,21,["TROCKENHEFE","HEFE"]],
  ["oel_raps","Rapsöl",M,540,120,LEIT,2.49,1000,["RAPSOEL","SPEISEOEL"],{note:"BZfE: wird ranzig bei Sauerstoffkontakt, dunkel lagern."}],
  ["oel_oliven","Olivenöl",M,540,180,LEIT,5.99,500,["OLIVENOEL"]],
  ["oel_sonnenblumen","Sonnenblumenöl",M,540,120,LEIT,1.99,1000,["SONNENBLUMENOEL"]],
  ["essig","Essig",M,1095,365,EST,1.19,500,["ESSIG","WEINESSIG"]],
  ["nuesse","Nüsse",M,180,60,LEIT,2.99,200,["NUESSE","CASHEWS"],{note:"BZfE: werden ranzig; Schimmel kann giftige Stoffe bilden."}],
  ["trockenfruechte","Trockenfrüchte",M,270,90,EST,2.49,200,["TROCKENPFLAUMEN"]],
  ["linsen","Linsen",M,730,365,LEIT,1.49,500,["LINSEN","BELUGALINSEN"]],
  ["bohnen_trocken","Trockenbohnen",M,730,365,LEIT,1.49,500,["WEISSE BOHNEN TROCKEN"]],
  ["kichererbsen","Kichererbsen trocken",M,730,365,LEIT,1.29,500,["KICHERERBSEN TROCKEN"]],
  ["kaffee","Kaffee, gemahlen",M,365,21,EST,6.49,500,["KAFFEE","KAFFEE GEMAHLEN","FILTERKAFFEE"]],
  ["kaffee_bohnen","Kaffeebohnen",M,365,30,EST,7.99,1000,["KAFFEEBOHNEN","ESPRESSOBOHNEN"]],
  ["kaffee_kapseln","Kaffeekapseln",M,365,180,EST,3.49,100,["KAFFEEKAPSELN"]],
  ["tee","Tee",M,730,365,EST,2.29,50,["TEE"]],
  ["kakao","Kakaopulver",M,540,180,EST,2.49,250,["KAKAO","KAKAOPULVER"]],
  ["honig","Honig",M,1095,730,EST,4.49,500,["HONIG"]],
  ["marmelade","Marmelade",M,540,60,EST,1.99,450,["MARMELADE","KONFITUERE","FRUCHTAUFSTRICH"]],
  ["nussaufstrich","Nuss-Nougat-Creme",M,365,90,EST,2.99,400,["NUSS NOUGAT CREME"]],
  ["erdnussbutter","Erdnussbutter",M,365,90,EST,2.99,350,["ERDNUSSBUTTER","ERDNUSSMUS"]],
  ["ketchup","Ketchup",M,540,60,EST,1.79,500,["KETCHUP","TOMATENKETCHUP"]],
  ["senf","Senf",M,540,90,EST,0.89,250,["SENF"]],
  ["mayonnaise","Mayonnaise",M,270,60,EST,1.99,250,["MAYONNAISE","MAYO"]],
  ["sojasauce","Sojasauce",M,730,180,EST,1.99,150,["SOJASAUCE","SOJASOSSE"]],
  ["bruehe","Brühe",M,540,180,EST,1.79,250,["GEMUESEBRUEHE","HUEHNERBRUEHE","BRUEHWUERFEL"]],
  ["tomatenmark","Tomatenmark",M,730,7,LEIT,0.69,200,["TOMATENMARK"]],
  ["passata","Passierte Tomaten",M,730,3,LEIT,0.99,500,["PASSATA","PASSIERTE TOMATEN"]],
  ["konserve_tomaten","Tomaten, Dose",M,730,3,LEIT,0.89,400,["GEHACKTE TOMATEN","TOMATEN DOSE","DOSENTOMATEN"],{note:"Geöffnete Konserve umfüllen und kühlen."}],
  ["konserve_mais","Mais, Dose",M,730,3,LEIT,0.79,300,["MAIS"]],
  ["konserve_bohnen","Bohnen, Dose",M,730,3,LEIT,0.89,400,["BOHNEN DOSE"]],
  ["konserve_kichererbsen","Kichererbsen, Dose",M,730,3,LEIT,0.89,400,[]],
  ["kokosmilch","Kokosmilch",M,730,3,LEIT,1.29,400,["KOKOSMILCH"]],
  ["oliven","Oliven",M,540,14,EST,1.99,200,["OLIVEN"]],
  ["gurken_glas","Gewürzgurken",M,730,30,EST,1.49,330,["GEWUERZGURKEN","CORNICHONS","ESSIGGURKEN"]],
  ["sauerkraut","Sauerkraut",M,540,7,EST,1.19,500,["SAUERKRAUT"]],
  ["pesto","Pesto",M,365,7,EST,1.99,190,["PESTO"]],
  ["fertigsauce","Fertigsauce",M,540,4,EST,1.79,400,["TOMATENSAUCE","BOLOGNESE SAUCE","PASTASAUCE"]],
  ["suppe_dose","Suppe, Dose",M,730,3,EST,1.29,400,["SUPPE DOSE","LINSENSUPPE","GULASCHSUPPE"]]
]);

// ===================== GETRÄNKE ==================================
group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["wasser","Mineralwasser",M,365,5,EST,0.39,1500,["MINERALWASSER","WASSER","WASSER SPRUDEL","WASSER STILL"],{freezable:false}],
  ["saft_orange","Orangensaft",M,270,4,LEIT,1.79,1000,["ORANGENSAFT","O-SAFT"],{note:"BZfE: geöffnete Säfte können gären, gekühlt rasch verbrauchen."}],
  ["saft_apfel","Apfelsaft",M,270,4,LEIT,1.49,1000,["APFELSAFT"]],
  ["saft_multi","Multivitaminsaft",M,270,4,LEIT,1.69,1000,["MULTIVITAMINSAFT"]],
  ["limonade","Limonade",M,270,3,EST,0.99,1500,["LIMONADE","BRAUSE"],{freezable:false}],
  ["eistee","Eistee",M,270,3,EST,0.99,1500,["EISTEE"],{freezable:false}],
  ["bier","Bier",M,180,1,EST,0.79,500,["BIER"],{freezable:false}],
  ["wein","Wein",M,1095,3,EST,4.99,750,["WEIN"],{freezable:false}],
  ["sekt","Sekt",M,730,1,EST,4.49,750,["SEKT"],{freezable:false}],
  ["spirituose","Spirituosen",M,1825,730,EST,12.99,700,[],{freezable:false}]
]);

// ===================== TIEFKÜHL ==================================
group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["tk_gemuese","TK-Gemüse",M,365,365,LEIT,1.49,750,["TK GEMUESE","ERBSEN TK","RAHMSPINAT","TIEFKUEHLGEMUESE"]],
  ["tk_pommes","TK-Pommes",M,365,365,EST,2.29,1000,["POMMES","TK POMMES","KARTOFFELECKEN"]],
  ["tk_pizza","TK-Pizza",M,365,365,EST,2.99,350,["TK PIZZA","PIZZA SALAMI","STEINOFENPIZZA"]],
  ["tk_fisch","TK-Fisch",M,365,365,EST,4.49,400,["FISCHSTAEBCHEN","TK FISCH"]],
  ["tk_beeren","TK-Beeren",M,365,365,EST,2.99,300,["TK BEEREN","BEERENMISCHUNG TK"]],
  ["tk_kraeuter","TK-Kräuter",M,365,365,EST,0.99,50,["TK KRAEUTER"]],
  ["eis","Speiseeis",M,365,90,EST,3.49,900,["SPEISEEIS","EISCREME"]],
  ["tk_fertiggericht","TK-Fertiggericht",M,365,365,EST,3.29,400,["FERTIGGERICHT TK"]]
]);

// ===================== SÜSSES & SNACKS ===========================
group("Süßes/Snacks", "Süßwaren", STORAGE.PANTRY, [
  ["schokolade","Schokolade",M,365,30,EST,1.49,100,["SCHOKOLADE","ZARTBITTER"]],
  ["kekse","Kekse",M,270,14,EST,1.79,300,["KEKSE"]],
  ["gummibaerchen","Fruchtgummi",M,365,30,EST,1.29,200,["GUMMIBAERCHEN","FRUCHTGUMMI","WEINGUMMI"]],
  ["chips","Chips",M,180,3,EST,1.99,175,["CHIPS","KARTOFFELCHIPS","TORTILLA CHIPS","NACHOS"]],
  ["salzgebaeck","Salzgebäck",M,270,7,EST,0.99,200,["CRACKER"]],
  ["riegel","Müsliriegel",M,270,14,EST,1.99,150,["MUESLIRIEGEL","KOERNERRIEGEL"]],
  ["popcorn","Popcorn",M,180,5,EST,1.49,100,["POPCORN"]],
  ["bonbons","Bonbons",M,540,90,EST,1.19,150,["BONBONS","LUTSCHER"]]
]);

// ===================== NON-FOOD ==================================
group("Haushalt", "Drogerie", STORAGE.NONE, [
  ["spuelmittel","Spülmittel",N,3650,3650,EST,1.29,500,["SPUELMITTEL"]],
  ["waschmittel","Waschmittel",N,3650,3650,EST,5.99,1500,["WASCHMITTEL","VOLLWASCHMITTEL"]],
  ["klopapier","Toilettenpapier",N,3650,3650,EST,3.99,1000,["TOILETTENPAPIER","KLOPAPIER"]],
  ["kuechenrolle","Küchenrolle",N,3650,3650,EST,1.99,500,["KUECHENROLLE","HAUSHALTSROLLE"]],
  ["muellbeutel","Müllbeutel",N,3650,3650,EST,2.49,300,["MUELLBEUTEL","MUELLSAECKE"]],
  ["alufolie","Alufolie",N,3650,3650,EST,1.99,200,["ALUFOLIE","ALU FOLIE","ALUMINIUMFOLIE"]],
  ["zahnpasta","Zahnpasta",N,1095,365,EST,1.79,75,["ZAHNPASTA","ZAHNCREME"]],
  ["duschgel","Duschgel",N,1095,365,EST,1.99,300,["DUSCHGEL","DUSCHBAD","SHOWER GEL"]],
  ["deo","Deodorant",N,1095,365,EST,2.49,150,["DEO","DEODORANT"]],
  ["putztuecher","Reinigungstücher",N,1095,365,EST,1.49,200,["PUTZTUECHER","SCHWAMM"]],
  ["tierfutter","Tierfutter",M,540,3,EST,1.29,400,["HUNDEFUTTER","KATZENFUTTER","TIERFUTTER"]],
  ["windeln","Windeln",N,1825,1825,EST,8.99,1000,["WINDELN"]]
], { isFood: false, freezable: false });


// ===== PROTEIN & SPORTERNÄHRUNG ==================================
// Ergänzt nach Auswertung eines echten Lidl-Bons (22.07.2026).
// Die ursprüngliche Datenbank bildete einen Standardhaushalt ab und
// kannte keines dieser Produkte — 64 % der Bon-Zeilen liefen ins Leere.
group("Protein/Sport", "Trockenware", STORAGE.PANTRY, [
  ["proteinriegel","Proteinriegel",M,270,14,EST,1.19,60,["PROTEINRIEGEL","PROT.RIEGEL","PR.RIEGEL","PROTEIN-RIEGEL","PROTEIN RIEGEL","EIWEISSRIEGEL"]],
  ["proteinpulver","Proteinpulver",M,540,180,EST,18.99,1000,["PROTEINPULVER","WHEY","EIWEISSPULVER","IRONMAXX","IRONMA"]],
  ["proteindrink","Proteindrink",M,180,2,EST,1.19,250,["PROTEINDRINK","PROTEIN DRINK","PROTEIN SHAKE","EIWEISSDRINK"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["proteinkaffee","Protein-Kaffee",M,180,2,EST,1.15,250,["HIGH PROTEIN KAFFEE","PROTEIN KAFFEE","PROTEIN COFFEE"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["proteinpudding","Protein-Pudding",M,30,2,EST,1.29,200,["PROTEINPUDDING","HIGH PROTEIN PUDDING"],{storage:STORAGE.FRIDGE_MIDDLE}]
]);

// ===== ERGÄNZUNGEN AUS DEM ECHTEN BON ============================
group("Milchprodukte", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["joghurt_2kammer","2-Kammer-Joghurt",M,21,2,EST,0.79,150,["2KAMMER JOGH","2KAMMER JOGHERDBEERE","2KAMMER JOGHSAUERK","2KAMMER JOGHPFIRSICH","ZWEIKAMMER JOGHURT","JOGOBELLA"],{freezable:false}],
  ["skyr_frucht","Skyr mit Frucht",M,21,4,EST,1.49,450,["SKYR ERDBEERE","SKYR FRUCHT","SKYR VANILLE"],{freezable:false}]
]);

group("Fleisch/Fisch", "Fleisch & Fisch", STORAGE.FRIDGE_BOTTOM, [
  ["haehnchen_nuggets","Hähnchen-Nuggets",V,2,1,LEIT,3.99,400,["CHICKENNUG","CHICKEN NUGGETS","HAEHNCHEN NUGGETS","CHICKENNUG.CORNFLAK","NUGGETS"]],
  ["putenaufschnitt","Puten-Aufschnitt",M,10,4,EST,2.69,150,["PUTE GORGONZOLA","PUTENBRUST AUFSCHNITT","PUTE AUFSCHNITT"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["rinderhueftsteak","Rinderhüftsteak",V,3,1,LEIT,4.58,200,["RINDERHUEFTSTEAK","HUEFTSTEAK","RINDERHUEFTE"]]
]);

group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["tk_pfanne","TK-Fertigpfanne",M,365,365,EST,4.79,500,["FROSTA","REISHAEHN","REISPFANNE","GEMUESEPFANNE TK","FROSTA XXL"]]
]);

group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["vitaminwasser","Vitaminwasser",M,270,3,EST,0.69,500,["VIT.-WAS","VITAMINWASSER","VIT WASSER","PFIR.-HOLU"],{freezable:false}]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["nudeln_dinkel","Dinkelnudeln",M,540,180,EST,1.45,500,["DINKEL FUSSILI","BIOLAND DIN. FUSSILI","DINKELNUDELN","DINKEL FUSILLI"]]
]);

group("Haushalt", "Drogerie", STORAGE.NONE, [
  ["tragetasche","Tragetasche",N,3650,3650,EST,0.59,80,["PERM. TRAGETASC","TRAGETASCHE","PERMANENTTRAGETASCHE","EINKAUFSTASCHE"]]
], { isFood: false, freezable: false });

// ===================== NON-FOOD, ERWEITERT =======================
// Die Verbrauchsklassen, Raten und Austauschintervalle stehen NICHT
// hier, sondern in nonFoodCatalog.js — dieser Katalog bleibt die eine
// Quelle für Name, Schreibweisen, Preis und Gewicht, auch für Non-Food.
// Ein zweiter Produktkatalog wäre genau die Doppelpflege, gegen die
// der Bündel-Build gebaut ist.
//
// dateType ist N (kein Datum): Non-Food verdirbt nicht. Die wenigen
// Ausnahmen mit echtem Verfalls- oder Öffnungsdatum tragen ihre Frist
// in nonFoodCatalog.js, nicht als MHD.

group("Körperpflege", "Drogerie", STORAGE.NONE, [
  ["shampoo","Shampoo",N,1095,1095,EST,2.49,300,["SHAMPOO","HAARSHAMPOO","SHAMPOO 300ML"]],
  ["handseife","Handseife",N,1095,1095,EST,1.49,250,["HANDSEIFE","FLUESSIGSEIFE","SEIFENSPENDER","CREMESEIFE","SEIFE"]],
  ["zahnbuerste","Zahnbürste",N,3650,3650,EST,1.95,30,["ZAHNBUERSTE","ZAHNBUERSTEN","HANDZAHNBUERSTE"]],
  ["aufsteckbuersten","Aufsteckbürsten",N,3650,3650,EST,9.99,60,["AUFSTECKBUERSTEN","BUERSTENKOEPFE","ERSATZBUERSTEN"]],
  ["rasierklingen","Rasierklingen",N,3650,3650,EST,8.99,50,["RASIERKLINGEN","RASIERER KLINGEN","SYSTEMKLINGEN"]],
  ["duschschwamm","Duschschwamm",N,3650,3650,EST,1.99,40,["DUSCHSCHWAMM","MASSAGESCHWAMM","DUSCHHANDSCHUH"]],
  ["sonnencreme","Sonnencreme",N,1095,365,EST,7.99,200,["SONNENCREME","SONNENMILCH","SONNENSCHUTZ","LSF"]],
  ["mascara","Mascara",N,1095,180,EST,5.99,10,["MASCARA","WIMPERNTUSCHE"]],
  ["kontaktlinsenloesung","Kontaktlinsenlösung",N,1095,90,EST,4.99,360,["KONTAKTLINSENLOESUNG","PFLEGEMITTEL LINSEN","ALL IN ONE LOESUNG"]],
  ["desinfektionsmittel","Desinfektionsmittel",N,1095,365,EST,3.49,250,["DESINFEKTION","HAENDEDESINFEKTION","DESINFEKTIONSMITTEL"]]
], { isFood: false, freezable: false });

group("Waschen & Reinigen", "Drogerie", STORAGE.NONE, [
  ["weichspueler","Weichspüler",N,1095,1095,EST,2.29,1000,["WEICHSPUELER","WEICHSPUEHLER"]],
  ["spuelmaschinentabs","Spülmaschinentabs",N,1095,1095,EST,7.99,800,["SPUELMASCHINENTABS","GESCHIRRSPUELTABS","TABS ALL IN 1","SPUELTABS"]],
  ["allzweckreiniger","Allzweckreiniger",N,1095,1095,EST,1.49,750,["ALLZWECKREINIGER","UNIVERSALREINIGER","ALLESREINIGER"]],
  ["waschmaschinenreiniger","Waschmaschinenreiniger",N,1095,1095,EST,3.99,250,["WASCHMASCHINENREINIGER","MASCHINENPFLEGE","WM REINIGER"]],
  ["entkalker","Entkalker",N,1095,1095,EST,3.49,500,["ENTKALKER","KALKLOESER","ENTKALKUNG"]],
  ["kuechenschwamm","Küchenschwamm",N,3650,3650,EST,1.49,50,["KUECHENSCHWAMM","TOPFSCHWAMM","SCHWAMMTUCH","SPUELSCHWAMM"]],
  ["spuelbuerste","Spülbürste",N,3650,3650,EST,1.29,60,["SPUELBUERSTE","ABWASCHBUERSTE"]],
  ["wischbezug","Wischbezug",N,3650,3650,EST,3.99,150,["WISCHBEZUG","WISCHMOPP","MOPPBEZUG","BODENWISCHER"]],
  ["staubsaugerbeutel","Staubsaugerbeutel",N,3650,3650,EST,6.99,120,["STAUBSAUGERBEUTEL","FILTERBEUTEL"]],
  ["wasserfilter","Wasserfilterkartusche",N,1095,1095,EST,4.49,100,["WASSERFILTER","FILTERKARTUSCHE","KARTUSCHE"]]
], { isFood: false, freezable: false });

group("Papier & Folie", "Drogerie", STORAGE.NONE, [
  ["taschentuecher","Taschentücher",N,3650,3650,EST,1.19,120,["TASCHENTUECHER","TEMPO","PAPIERTASCHENTUECHER"]],
  ["frischhaltefolie","Frischhaltefolie",N,3650,3650,EST,1.79,200,["FRISCHHALTEFOLIE","KLARSICHTFOLIE"]],
  ["backpapier","Backpapier",N,3650,3650,EST,1.49,200,["BACKPAPIER","BACKTRENNPAPIER"]],
  ["gefrierbeutel","Gefrierbeutel",N,3650,3650,EST,1.99,150,["GEFRIERBEUTEL","GEFRIERBEUTEL 3L","TIEFKUEHLBEUTEL"]]
], { isFood: false, freezable: false });

group("Haushaltszubehör", "Drogerie", STORAGE.NONE, [
  ["batterien","Batterien",N,3650,3650,EST,4.99,100,["BATTERIEN","AA BATTERIEN","AAA BATTERIEN","MIGNON"]],
  ["gluehbirne","Leuchtmittel",N,3650,3650,EST,3.99,50,["GLUEHBIRNE","LED LAMPE","LEUCHTMITTEL","BIRNE E27"]],
  ["kerzen","Kerzen",N,3650,3650,EST,2.99,300,["KERZEN","TEELICHTER","STUMPENKERZE"]],
  ["klebeband","Klebeband",N,3650,3650,EST,1.99,80,["KLEBEBAND","PAKETBAND","TESAFILM"]],
  ["schuhcreme","Schuhcreme",N,3650,3650,EST,2.49,75,["SCHUHCREME","SCHUHPFLEGE","LEDERPFLEGE"]]
], { isFood: false, freezable: false });


/* ================================================================
   ERWEITERUNG: die Breite des Sortiments
   ================================================================
   Der Kern oben ist recherchiert — dort stehen die regulatorischen
   und die aus behördlichen Lagerempfehlungen abgeleiteten Werte.
   Was jetzt folgt, ist BREITE: damit „ban" auch dann Bananen findet,
   wenn im Haushalt Baby-Bananen stehen, und damit eine selbst
   ergänzte Zeile ein echtes Produkt wird statt freier Text.

   Das ist der Unterschied, um den es geht: ein Katalogprodukt fließt
   in ALLE Rechnungen ein — Rhythmus, Bestand, Reichweite, Verderb,
   Saison, Preisgedächtnis, Gangreihenfolge, Einfrier-Empfehlung. Eine
   freie Zeile kann das nicht, weil ihr jede Grundlage fehlt.

   ALLE Werte hier tragen `schaetzwert`. Das ist keine Bescheidenheit,
   sondern die Wahrheit: sie sind aus Warenkunde und Erfahrung
   abgeleitet, nicht aus einer amtlichen Quelle. Der Qualitätsbericht
   unter „Mehr → Datenbasis" weist den Anteil offen aus, und die
   Sicherheitsregel bleibt unberührt — ein Verbrauchsdatum-Produkt
   bekommt nie eine verlängerte Frist.

   Aliase sind bewusst sparsam. Jeder Name und jeder Alias muss im
   Stresstest sein EIGENES Produkt treffen; wer großzügig Synonyme
   verteilt, baut sich Fehlzuordnungen ein, die dann echte Bons
   falsch buchen.
   ================================================================ */

// ===================== OBST, breit ===============================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["bananen_bio","Bio-Bananen",M,7,4,EST,2.29,1000,[],{ethylene:ETHYLENE.PRODUCER,storage:STORAGE.ROOM}],
  ["baby_bananen","Baby-Bananen",M,6,3,EST,2.49,500,[],{ethylene:ETHYLENE.PRODUCER,storage:STORAGE.ROOM}],
  ["kochbananen","Kochbananen",M,10,5,EST,2.99,600,[],{storage:STORAGE.ROOM}],
  ["aepfel_gala","Äpfel Gala",M,21,10,EST,2.79,1000,[],{ethylene:ETHYLENE.PRODUCER}],
  ["aepfel_granny","Äpfel Granny Smith",M,25,10,EST,2.99,1000,[],{ethylene:ETHYLENE.PRODUCER}],
  ["aepfel_pink","Äpfel Pink Lady",M,25,10,EST,3.99,1000,[],{ethylene:ETHYLENE.PRODUCER}],
  ["birnen_williams","Williams-Christ-Birnen",M,9,4,EST,2.79,1000,[],{ethylene:ETHYLENE.PRODUCER}],
  ["birnen_abate","Abate-Birnen",M,11,5,EST,2.99,1000,[]],
  ["nashi","Nashi-Birnen",M,14,6,EST,3.49,600,[]],
  ["quitten","Quitten",M,21,10,EST,3.99,1000,[]],
  ["blutorangen","Blutorangen",M,14,7,EST,3.29,1000,[],{storage:STORAGE.ROOM}],
  ["clementinen","Clementinen",M,14,7,EST,2.99,1000,[],{storage:STORAGE.ROOM}],
  ["satsumas","Satsumas",M,12,6,EST,2.89,1000,[],{storage:STORAGE.ROOM}],
  ["grapefruit","Grapefruit",M,21,9,EST,1.49,400,[],{storage:STORAGE.ROOM}],
  ["pomelo","Pomelo",M,25,10,EST,2.99,1000,[],{storage:STORAGE.ROOM}],
  ["kumquat","Kumquats",M,12,6,EST,3.49,200,[]],
  ["johannisbeeren","Johannisbeeren",M,4,2,EST,2.89,250,[]],
  ["stachelbeeren","Stachelbeeren",M,7,3,EST,2.99,300,[]],
  ["preiselbeeren_frisch","Preiselbeeren frisch",M,7,3,EST,3.49,200,[]],
  ["cranberries_frisch","Cranberries frisch",M,14,7,EST,3.29,250,[]],
  ["sauerkirschen","Sauerkirschen",M,4,2,EST,3.99,500,[]],
  ["zwetschgen","Zwetschgen",M,8,4,EST,2.69,500,[],{ethylene:ETHYLENE.PRODUCER}],
  ["mirabellen","Mirabellen",M,5,3,EST,3.49,500,[]],
  ["nektarinen","Nektarinen",M,6,3,EST,2.99,500,[],{ethylene:ETHYLENE.PRODUCER}],
  ["kaki","Kaki",M,10,5,EST,2.49,400,[],{ethylene:ETHYLENE.SENSITIVE}],
  ["kiwi_gold","Gold-Kiwi",M,12,5,EST,3.49,400,[]],
  ["papaya","Papaya",M,6,3,EST,3.49,600,[],{storage:STORAGE.ROOM}],
  ["melone_wasser","Wassermelone",M,10,3,EST,3.99,4000,[],{storage:STORAGE.ROOM}],
  ["melone_honig","Honigmelone",M,9,3,EST,2.99,1500,[],{storage:STORAGE.ROOM}],
  ["melone_cantaloupe","Cantaloupe-Melone",M,8,3,EST,2.79,1200,[]],
  ["galiamelone","Galiamelone",M,9,3,EST,2.89,1300,[]],
  ["maracuja","Maracuja",M,10,4,EST,3.99,250,[]],
  ["litschi","Litschis",M,7,3,EST,4.49,300,[]],
  ["drachenfrucht","Drachenfrucht",M,8,3,EST,4.99,400,[]],
  ["sharonfrucht","Sharonfrucht",M,10,5,EST,2.99,400,[]],
  ["rhabarber","Rhabarber",M,7,4,EST,2.99,500,[]],
  ["physalis","Physalis",M,14,7,EST,3.49,200,[]],
  ["kokosnuss","Kokosnuss",M,21,3,EST,2.49,800,[],{storage:STORAGE.ROOM}],
  ["obstsalat_frisch","Obstsalat frisch",M,2,1,EST,3.49,400,[],{freezable:false}]
]);

// ===================== GEMÜSE, breit =============================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["tomaten_cherry","Cherrytomaten",M,8,4,EST,1.99,250,[],{ethylene:ETHYLENE.PRODUCER,storage:STORAGE.ROOM}],
  ["tomaten_rispe","Rispentomaten",M,8,4,EST,2.79,500,[],{ethylene:ETHYLENE.PRODUCER,storage:STORAGE.ROOM}],
  ["tomaten_fleisch","Fleischtomaten",M,7,3,EST,3.29,600,[],{storage:STORAGE.ROOM}],
  ["tomaten_datteln","Datteltomaten",M,9,4,EST,2.29,250,[],{storage:STORAGE.ROOM}],
  ["paprika_rot","Paprika rot",M,12,5,EST,1.29,200,[]],
  ["paprika_gelb","Paprika gelb",M,12,5,EST,1.29,200,[]],
  ["paprika_gruen","Paprika grün",M,14,5,EST,0.99,200,[]],
  ["spitzpaprika","Spitzpaprika",M,10,4,EST,2.49,300,[]],
  ["chili_frisch","Chilischoten",M,12,5,EST,1.49,50,[]],
  ["minigurken","Minigurken",M,10,4,EST,1.79,300,[]],
  ["kuerbis_hokkaido","Hokkaido-Kürbis",M,45,5,EST,2.99,1200,[],{storage:STORAGE.ROOM}],
  ["kuerbis_butternut","Butternut-Kürbis",M,50,5,EST,3.49,1000,[],{storage:STORAGE.ROOM}],
  ["bundmoehren","Bundmöhren",M,10,5,EST,1.79,500,[]],
  ["petersilienwurzel","Petersilienwurzel",M,16,7,EST,2.29,400,[]],
  ["sellerie_knolle","Knollensellerie",M,25,10,EST,1.99,700,[]],
  ["staudensellerie","Staudensellerie",M,12,6,EST,1.79,400,[]],
  ["steckruebe","Steckrübe",M,30,12,EST,1.49,800,[]],
  ["rettich","Rettich",M,12,6,EST,1.29,400,[]],
  ["schwarzwurzel","Schwarzwurzeln",M,14,6,EST,2.99,500,[]],
  ["topinambur","Topinambur",M,14,6,EST,3.49,400,[]],
  ["kurkuma_frisch","Kurkuma frisch",M,18,8,EST,2.99,100,[]],
  ["meerrettich_frisch","Meerrettich frisch",M,21,7,EST,2.49,150,[]],
  ["kartoffeln_fest","Kartoffeln festkochend",M,45,14,EST,2.49,2000,[],{storage:STORAGE.PANTRY,ethylene:ETHYLENE.SENSITIVE}],
  ["kartoffeln_mehlig","Kartoffeln mehligkochend",M,45,14,EST,2.29,2000,[],{storage:STORAGE.PANTRY}],
  ["drillinge","Drillinge",M,25,10,EST,2.99,1000,[],{storage:STORAGE.PANTRY}],
  ["romanesco","Romanesco",M,7,4,EST,2.49,700,[]],
  ["spitzkohl","Spitzkohl",M,14,6,EST,1.79,700,[]],
  ["chinakohl","Chinakohl",M,12,6,EST,1.59,800,[]],
  ["pak_choi","Pak Choi",M,7,4,EST,2.29,300,[]],
  ["grunkohl","Grünkohl",M,7,4,EST,2.49,500,[]],
  ["spargel_weiss","Weißer Spargel",M,4,2,EST,7.99,500,[]],
  ["spargel_gruen","Grüner Spargel",M,5,3,EST,5.99,400,[]],
  ["erbsen_frisch","Erbsen frisch",M,5,3,EST,2.79,400,[]],
  ["mais_kolben","Maiskolben",M,6,3,EST,1.99,400,[]],
  ["artischocke","Artischocken",M,8,4,EST,2.49,300,[]],
  ["champignons_braun","Braune Champignons",M,7,3,EST,1.79,250,[]],
  ["kraeuterseitlinge","Kräuterseitlinge",M,8,4,EST,2.99,200,[]],
  ["austernpilze","Austernpilze",M,5,3,EST,2.79,200,[]],
  ["pfifferlinge","Pfifferlinge",M,4,2,EST,6.99,200,[]],
  ["shiitake","Shiitake",M,8,4,EST,3.49,150,[]],
  ["oliven_frisch","Oliven lose",M,21,10,EST,2.49,200,[]],
  ["sauerkraut_frisch","Sauerkraut frisch",M,21,7,EST,1.79,500,[]],
  ["gemuesemix_suppe","Suppengemüse",M,7,4,EST,1.49,500,[]]
]);

// ===================== SALAT & KRÄUTER ===========================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["eisbergsalat","Eisbergsalat",M,8,3,EST,1.29,500,[],{ethylene:ETHYLENE.SENSITIVE}],
  ["romanasalat","Romanasalat",M,7,3,EST,1.49,400,[]],
  ["endivien","Endiviensalat",M,7,3,EST,1.39,400,[]],
  ["radicchio","Radicchio",M,9,4,EST,1.69,300,[]],
  ["lollo_rosso","Lollo Rosso",M,5,2,EST,1.29,300,[]],
  ["babyspinat","Babyspinat",M,4,2,EST,1.99,125,[]],
  ["petersilie","Petersilie",M,7,3,EST,0.99,30,[]],
  ["schnittlauch","Schnittlauch",M,6,3,EST,0.99,25,[]],
  ["basilikum_topf","Basilikum im Topf",M,10,5,EST,1.49,60,[],{storage:STORAGE.ROOM}],
  ["dill","Dill",M,5,3,EST,0.99,25,[]],
  ["koriander_frisch","Koriander frisch",M,5,3,EST,1.19,25,[]],
  ["minze_frisch","Minze frisch",M,6,3,EST,1.29,25,[]],
  ["rosmarin_frisch","Rosmarin frisch",M,10,5,EST,1.29,25,[]],
  ["thymian_frisch","Thymian frisch",M,10,5,EST,1.29,25,[]],
  ["salbei_frisch","Salbei frisch",M,9,4,EST,1.29,20,[]]
]);

// ===================== MILCH & KÄSE, breit =======================
group("Milchprodukte", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["milch_laktosefrei","Laktosefreie Milch",M,10,3,EST,1.39,1000,[],{freezable:false}],
  ["milch_bio","Bio-Vollmilch",M,8,3,EST,1.59,1000,[],{freezable:false}],
  ["buttermilch","Buttermilch",M,14,3,EST,0.89,500,[],{freezable:false}],
  ["kefir","Kefir",M,18,4,EST,1.19,500,[],{freezable:false}],
  ["ayran","Ayran",M,18,2,EST,0.79,250,[],{freezable:false}],
  ["reisdrink","Reisdrink",M,180,4,EST,1.69,1000,[],{storage:STORAGE.PANTRY}],
  ["kokosdrink","Kokosdrink",M,180,4,EST,1.89,1000,[],{storage:STORAGE.PANTRY}],
  ["dinkeldrink","Dinkeldrink",M,180,4,EST,1.89,1000,[],{storage:STORAGE.PANTRY}],
  ["kondensmilch_dose","Kondensmilch Dose",M,300,4,EST,0.99,340,[],{storage:STORAGE.PANTRY}],
  ["schmelzkaese","Schmelzkäse",M,60,14,EST,1.29,200,[]],
  ["kaese_gorgonzola","Gorgonzola",M,25,7,EST,2.79,150,[]],
  ["kaese_ziegen","Ziegenkäse",M,25,7,EST,2.49,150,[]],
  ["kaese_raclette","Raclettekäse",M,30,10,EST,3.49,400,[]],
  ["kaese_halloumi","Halloumi",M,60,5,EST,2.79,225,[]],
  ["kaese_burrata","Burrata",M,14,1,EST,2.99,125,[],{freezable:false}],
  ["kaese_ricotta","Ricotta",M,14,3,EST,1.79,250,[],{freezable:false}],
  ["kaese_maasdamer","Maasdamer",M,30,10,EST,2.39,200,[]],
  ["kaese_tilsiter","Tilsiter",M,30,10,EST,2.29,200,[]],
  ["kaese_appenzeller","Appenzeller",M,40,12,EST,3.29,200,[]],
  ["kaese_cheddar","Cheddar",M,40,12,EST,2.79,200,[]],
  ["kaese_blau","Blauschimmelkäse",M,25,7,EST,2.69,150,[]],
  ["kaese_ziegenfrisch","Ziegenfrischkäse",M,18,5,EST,2.29,150,[]],
  ["kaese_veggie","Käsealternative",M,30,7,EST,2.99,200,[]],
  ["joghurt_laktosefrei","Laktosefreier Joghurt",M,21,4,EST,1.29,500,[],{freezable:false}],
  ["joghurt_pflanzlich","Pflanzlicher Joghurt",M,25,4,EST,1.49,400,[],{freezable:false}],
  ["quark_frucht","Fruchtquark",M,18,3,EST,0.69,150,[],{freezable:false}],
  ["kraeuterquark","Kräuterquark",M,14,3,EST,1.09,200,[],{freezable:false}],
  ["mozzarella_bueffel","Büffelmozzarella",M,18,2,EST,2.29,125,[],{freezable:false}],
  ["sahne_creme","Kochsahne",M,120,3,EST,0.79,200,[],{storage:STORAGE.PANTRY}],
  ["sahne_pflanzlich","Pflanzliche Sahne",M,180,4,EST,1.19,200,[],{storage:STORAGE.PANTRY}],
  ["desserts_becher","Dessertcreme",M,21,2,EST,0.79,150,[]],
  ["tiramisu_frisch","Tiramisu Becher",M,14,1,EST,1.99,200,[],{freezable:false}],
  ["eier_wachtel","Wachteleier",M,21,21,EST,2.99,150,[],{freezable:false}],
  ["eier_gekocht","Gekochte Eier",M,14,7,EST,1.99,300,[],{freezable:false}]
]);

// ===================== FLEISCH & WURST, breit ====================
group("Fleisch/Fisch", "Fleisch & Fisch", STORAGE.FRIDGE_BOTTOM, [
  ["haehnchen_ganz","Hähnchen ganz",V,2,1,LEIT,5.99,1200,[]],
  ["haehnchen_fluegel","Hähnchenflügel",V,2,1,LEIT,3.49,800,[]],
  ["haehnchen_innen","Hähnchen-Innenfilet",V,2,1,LEIT,5.49,400,[]],
  ["putengeschnetzeltes","Putengeschnetzeltes",V,2,1,LEIT,6.49,400,[]],
  ["entenbrust","Entenbrust",V,2,1,LEIT,9.99,350,[]],
  ["gans","Gans",V,2,1,LEIT,24.99,3000,[]],
  ["schweinebauch","Schweinebauch",V,3,1,LEIT,4.99,600,[]],
  ["schweinenacken","Schweinenacken",V,3,1,LEIT,5.49,700,[]],
  ["kasseler","Kasseler",M,10,4,EST,5.99,500,[]],
  ["schweinerueckensteak","Schweinesteak",V,3,1,LEIT,5.29,500,[]],
  ["rinderbraten","Rinderbraten",V,3,1,LEIT,11.99,1000,[]],
  ["rinderfilet","Rinderfilet",V,3,1,LEIT,16.99,400,[]],
  ["tafelspitz","Tafelspitz",V,3,1,LEIT,12.99,800,[]],
  ["suppenfleisch","Suppenfleisch",V,3,1,LEIT,6.99,600,[]],
  ["lammkotelett","Lammkoteletts",V,3,1,LEIT,12.99,400,[]],
  ["lammkeule","Lammkeule",V,3,1,LEIT,15.99,1200,[]],
  ["kalbsschnitzel","Kalbsschnitzel",V,2,1,LEIT,11.99,400,[]],
  ["leber","Leber",V,1,1,LEIT,4.49,300,[]],
  ["hackbaellchen_frisch","Frikadellen frisch",V,2,1,LEIT,4.29,400,[]],
  ["gyros_frisch","Gyros mariniert",V,2,1,LEIT,5.99,500,[]],
  ["spiesse_grill","Grillspieße",V,2,1,LEIT,5.49,400,[]],
  ["currywurst","Currywurst",M,14,3,EST,2.99,300,[]],
  ["weisswurst","Weißwurst",M,7,2,EST,3.49,300,[]],
  ["merguez","Merguez",V,2,1,LEIT,4.99,300,[]],
  ["chorizo","Chorizo",M,40,14,EST,2.99,200,[]],
  ["cabanossi","Cabanossi",M,35,12,EST,2.49,200,[]],
  ["landjaeger","Landjäger",M,60,20,EST,2.79,100,[]],
  ["schinkenwuerfel","Schinkenwürfel",M,14,4,EST,1.49,150,[]],
  ["pastrami","Pastrami",M,14,4,EST,2.99,100,[]],
  ["blutwurst","Blutwurst",M,14,4,EST,2.29,200,[]],
  ["sulze","Sülze",M,10,3,EST,1.99,200,[]],
  ["griebenschmalz","Griebenschmalz",M,60,21,EST,1.79,200,[]],
  ["veggie_schnitzel","Veggie-Schnitzel",M,14,2,EST,2.99,200,[]],
  ["veggie_hack","Veggie-Hack",M,14,2,EST,2.49,200,[]],
  ["tofu_natur","Tofu natur",M,21,3,EST,1.79,200,[]],
  ["tofu_geraeuchert","Räuchertofu",M,25,4,EST,2.19,200,[]],
  ["tempeh","Tempeh",M,21,3,EST,2.99,200,[]],
  ["seitan","Seitan",M,18,3,EST,2.79,200,[]],
  ["veggie_wuerstchen","Veggie-Würstchen",M,21,3,EST,2.49,200,[]]
]);

group("Fleisch/Fisch", "Fleisch & Fisch", STORAGE.FRIDGE_BOTTOM, [
  ["forelle","Forelle",V,1,1,LEIT,5.99,300,[]],
  ["zander","Zanderfilet",V,1,1,LEIT,12.99,300,[]],
  ["dorade","Dorade",V,1,1,LEIT,7.99,400,[]],
  ["wolfsbarsch","Wolfsbarsch",V,1,1,LEIT,9.99,400,[]],
  ["rotbarsch","Rotbarschfilet",V,1,1,LEIT,7.49,300,[]],
  ["scholle","Schollenfilet",V,1,1,LEIT,6.99,300,[]],
  ["hering_frisch","Hering frisch",V,1,1,LEIT,3.99,300,[]],
  ["makrele_frisch","Makrele frisch",V,1,1,LEIT,4.99,400,[]],
  ["thunfisch_frisch","Thunfischsteak",V,1,1,LEIT,13.99,250,[]],
  ["muscheln","Miesmuscheln",V,1,1,LEIT,4.99,1000,[]],
  ["tintenfisch","Tintenfischringe",V,1,1,LEIT,6.49,300,[]],
  ["surimi","Surimi",M,14,2,EST,1.99,200,[]],
  ["matjes","Matjesfilet",M,10,3,EST,3.49,200,[]],
  ["rollmops","Rollmops",M,21,5,EST,2.79,250,[]],
  ["bismarckhering","Bismarckhering",M,18,5,EST,2.49,250,[]],
  ["forelle_geraeuchert","Räucherforelle",M,10,3,EST,4.49,150,[]],
  ["makrele_geraeuchert","Räuchermakrele",M,10,3,EST,3.29,200,[]],
  ["sardellen","Sardellenfilets",M,365,5,EST,2.49,50,[],{storage:STORAGE.PANTRY}],
  ["kaviar_ersatz","Seehasenrogen",M,60,7,EST,3.49,100,[]],
  ["fischstaebchen_frisch","Backfisch",V,2,1,LEIT,4.49,400,[]]
]);

// ===================== BACKWAREN, breit ==========================
group("Backwaren", "Backwaren", STORAGE.ROOM, [
  ["brot_weizen","Weizenbrot",M,4,4,EST,2.19,750,[]],
  ["brot_mehrkorn","Mehrkornbrot",M,6,6,EST,2.69,750,[]],
  ["brot_dinkel","Dinkelbrot",M,5,5,EST,2.89,750,[]],
  ["brot_sauerteig","Sauerteigbrot",M,7,7,EST,3.49,1000,[]],
  ["brot_bauern","Bauernbrot",M,6,6,EST,2.79,1000,[]],
  ["brot_pumpernickel","Pumpernickel",M,90,14,EST,1.99,500,[],{storage:STORAGE.PANTRY}],
  ["brot_toast_vollkorn","Vollkorntoast",M,10,10,EST,1.49,500,[]],
  ["brot_glutenfrei","Glutenfreies Brot",M,14,7,EST,3.49,400,[]],
  ["baguette","Baguette",M,2,2,EST,1.29,250,[]],
  ["ciabatta","Ciabatta",M,3,3,EST,1.59,250,[]],
  ["fladenbrot","Fladenbrot",M,3,3,EST,1.19,400,[]],
  ["naan","Naan-Brot",M,7,3,EST,1.99,250,[]],
  ["tortillas","Weizentortillas",M,60,5,EST,1.99,320,[],{storage:STORAGE.PANTRY}],
  ["wraps_vollkorn","Vollkorn-Wraps",M,60,5,EST,2.29,320,[],{storage:STORAGE.PANTRY}],
  ["pita","Pitabrot",M,5,3,EST,1.49,300,[]],
  ["laugenbrezel","Laugenbrezel",M,2,1,EST,0.89,100,[]],
  ["laugenstange","Laugenstange",M,2,1,EST,0.99,110,[]],
  ["schokobroetchen","Schokobrötchen",M,2,1,EST,1.09,80,[]],
  ["franzbroetchen","Franzbrötchen",M,2,1,EST,1.19,90,[]],
  ["roggenbroetchen","Roggenbrötchen",M,2,2,EST,0.55,60,[]],
  ["koernerbroetchen","Körnerbrötchen",M,2,2,EST,0.65,70,[]],
  ["kaisersemmel","Kaisersemmel",M,2,1,EST,0.45,55,[]],
  ["hefezopf","Hefezopf",M,4,3,EST,2.49,500,[]],
  ["rosinenbroetchen","Rosinenbrötchen",M,3,2,EST,0.89,80,[]],
  ["donut","Donut",M,3,2,EST,1.19,70,[]],
  ["muffin","Muffin",M,5,3,EST,1.29,90,[]],
  ["kuchen_stueck","Kuchenstück",M,3,2,EST,2.29,120,[]],
  ["obstkuchen","Obstkuchen",M,3,2,EST,7.99,800,[]],
  ["kaesekuchen","Käsekuchen",M,4,2,EST,8.99,900,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["baguettebroetchen","Aufbackbrötchen",M,30,3,EST,1.29,300,[],{storage:STORAGE.PANTRY}]
]);

// ===================== TROCKEN & VORRAT, breit ===================
group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["spaghetti","Spaghetti",M,900,180,EST,1.29,500,[]],
  ["penne","Penne",M,900,180,EST,1.29,500,[]],
  ["fusilli","Fusilli",M,900,180,EST,1.29,500,[]],
  ["farfalle","Farfalle",M,900,180,EST,1.35,500,[]],
  ["tagliatelle","Tagliatelle",M,900,180,EST,1.59,500,[]],
  ["lasagneplatten","Lasagneplatten",M,900,180,EST,1.69,250,[]],
  ["nudeln_glutenfrei","Glutenfreie Nudeln",M,730,150,EST,2.49,400,[]],
  ["spaetzle","Spätzle",M,365,60,EST,1.99,500,[]],
  ["gnocchi","Gnocchi",M,120,3,EST,1.49,500,[]],
  ["hirse","Hirse",M,730,120,EST,2.29,500,[]],
  ["buchweizen","Buchweizen",M,730,120,EST,2.49,500,[]],
  ["polenta","Polenta",M,730,120,EST,1.79,500,[]],
  ["reis_basmati","Basmatireis",M,900,180,EST,2.99,500,[]],
  ["reis_jasmin","Jasminreis",M,900,180,EST,2.79,500,[]],
  ["reis_vollkorn","Naturreis",M,540,120,EST,2.19,500,[]],
  ["reis_milchreis","Milchreis roh",M,900,180,EST,1.49,500,[]],
  ["dinkelflocken","Dinkelflocken",M,540,120,EST,1.79,500,[]],
  ["muesli_basis","Basismüsli",M,270,60,EST,2.49,750,[]],
  ["muesli_schoko","Schokomüsli",M,270,60,EST,2.99,750,[]],
  ["granola","Granola",M,270,45,EST,3.49,500,[]],
  ["porridge","Porridge",M,270,60,EST,2.49,400,[]],
  ["linsen_rot","Rote Linsen",M,900,180,EST,1.79,500,[]],
  ["linsen_braun","Braune Linsen",M,900,180,EST,1.59,500,[]],
  ["erbsen_trocken","Trockenerbsen",M,900,180,EST,1.49,500,[]],
  ["sojaschnetzel","Sojaschnetzel",M,540,120,EST,2.29,300,[]],
  ["semmelbroesel","Semmelbrösel",M,365,90,EST,0.99,400,[]]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["tomaten_dose","Tomaten stückig",M,900,3,EST,0.89,400,[]],
  ["mais_dose","Mais Dose",M,900,3,EST,0.89,300,[]],
  ["kidneybohnen","Kidneybohnen Dose",M,900,3,EST,0.89,400,[]],
  ["kichererbsen_dose","Kichererbsen Dose",M,900,3,EST,0.99,400,[]],
  ["weisse_bohnen","Weiße Bohnen Dose",M,900,3,EST,0.85,400,[]],
  ["linsen_dose","Linsen Dose",M,900,3,EST,1.09,400,[]],
  ["erbsen_dose","Erbsen Dose",M,900,3,EST,0.99,400,[]],
  ["champignons_dose","Champignons Dose",M,900,3,EST,1.19,300,[]],
  ["rotkohl_glas","Rotkohl Glas",M,540,7,EST,1.29,700,[]],
  ["sauerkraut_glas","Sauerkraut Glas",M,540,7,EST,1.19,700,[]],
  ["silberzwiebeln","Silberzwiebeln",M,540,21,EST,1.59,300,[]],
  ["oliven_glas","Oliven Glas",M,540,14,EST,2.29,300,[]],
  ["kapern","Kapern",M,730,60,EST,1.99,100,[]],
  ["antipasti","Antipasti eingelegt",M,365,10,EST,2.99,300,[]],
  ["paprika_glas","Paprika eingelegt",M,540,14,EST,1.99,350,[]],
  ["ananas_dose","Ananas Dose",M,900,3,EST,1.29,400,[]],
  ["pfirsich_dose","Pfirsiche Dose",M,900,3,EST,1.19,400,[]],
  ["mandarinen_dose","Mandarinen Dose",M,900,3,EST,1.09,300,[]],
  ["apfelmus","Apfelmus",M,540,7,EST,1.09,700,[]],
  ["rote_bete_glas","Rote Bete Glas",M,540,10,EST,1.29,400,[]],
  ["ravioli_dose","Ravioli Dose",M,730,2,EST,1.79,800,[]],
  ["eintopf_dose","Eintopf Dose",M,730,2,EST,1.99,800,[]],
  ["bruehe_pulver","Gemüsebrühe Pulver",M,540,180,EST,1.99,250,[]],
  ["fond","Fond im Glas",M,540,4,EST,2.49,400,[]],
  ["passierte_paprika","Ajvar",M,540,14,EST,2.29,350,[]]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["sesamoel","Sesamöl",M,365,120,EST,3.99,250,[]],
  ["kokosoel","Kokosöl",M,540,180,EST,4.99,400,[]],
  ["walnussoel","Walnussöl",M,270,90,EST,5.99,250,[]],
  ["essig_balsamico","Balsamico",M,900,365,EST,2.99,500,[]],
  ["essig_apfel","Apfelessig",M,900,365,EST,1.49,500,[]],
  ["essig_weiss","Weißweinessig",M,900,365,EST,1.29,500,[]],
  ["fischsauce","Fischsauce",M,730,180,EST,2.49,200,[]],
  ["worcestershire","Worcestershiresauce",M,730,180,EST,2.79,150,[]],
  ["senf_mittelscharf","Mittelscharfer Senf",M,540,90,EST,0.89,250,[]],
  ["senf_dijon","Dijonsenf",M,540,90,EST,1.49,200,[]],
  ["remoulade","Remoulade",M,270,45,EST,1.89,250,[]],
  ["bbq_sauce","Barbecuesauce",M,540,60,EST,2.29,300,[]],
  ["chilisauce","Chilisauce",M,540,90,EST,2.49,200,[]],
  ["sriracha","Sriracha",M,540,120,EST,2.99,250,[]],
  ["pesto_gruen","Pesto Genovese",M,365,5,EST,2.49,190,[]],
  ["pesto_rot","Pesto Rosso",M,365,5,EST,2.49,190,[]],
  ["hummus","Hummus",M,21,3,EST,1.99,200,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["tzatziki","Tzatziki",M,14,3,EST,1.49,200,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["guacamole","Guacamole",M,10,2,EST,2.29,200,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["salsa","Salsa",M,365,7,EST,1.99,300,[]],
  ["currypaste","Currypaste",M,540,30,EST,2.49,110,[]],
  ["tahini","Tahini",M,540,60,EST,3.99,300,[]],
  ["ahornsirup","Ahornsirup",M,730,180,EST,5.99,250,[]],
  ["agavendicksaft","Agavendicksaft",M,730,180,EST,2.99,250,[]],
  ["marmelade_erdbeer","Erdbeermarmelade",M,540,30,EST,1.99,340,[]],
  ["marmelade_kirsch","Kirschmarmelade",M,540,30,EST,1.99,340,[]],
  ["marmelade_aprikose","Aprikosenkonfitüre",M,540,30,EST,1.99,340,[]],
  ["orangenmarmelade","Orangenmarmelade",M,540,30,EST,2.19,340,[]],
  ["meersalz","Meersalz",M,3650,3650,EST,1.49,500,[]],
  ["pfeffer_schwarz","Schwarzer Pfeffer",M,900,365,EST,1.99,50,[]],
  ["paprikapulver","Paprikapulver",M,730,365,EST,1.29,50,[]],
  ["curry_pulver","Currypulver",M,730,365,EST,1.49,50,[]],
  ["oregano","Oregano getrocknet",M,730,365,EST,0.99,15,[]],
  ["basilikum_getrocknet","Basilikum getrocknet",M,730,365,EST,0.99,15,[]],
  ["thymian_getrocknet","Thymian getrocknet",M,730,365,EST,0.99,15,[]],
  ["rosmarin_getrocknet","Rosmarin getrocknet",M,730,365,EST,0.99,15,[]],
  ["lorbeer","Lorbeerblätter",M,730,365,EST,0.99,10,[]],
  ["muskat","Muskatnuss",M,900,365,EST,1.99,20,[]],
  ["zimt","Zimt",M,730,365,EST,1.19,45,[]],
  ["kreuzkuemmel","Kreuzkümmel",M,730,365,EST,1.29,40,[]],
  ["koriander_gemahlen","Koriander gemahlen",M,730,365,EST,1.19,35,[]],
  ["chiliflocken","Chiliflocken",M,730,365,EST,1.49,35,[]],
  ["knoblauchpulver","Knoblauchpulver",M,730,365,EST,1.29,50,[]],
  ["zwiebelpulver","Zwiebelpulver",M,730,365,EST,1.29,50,[]],
  ["kraeuter_provence","Kräuter der Provence",M,730,365,EST,1.19,20,[]],
  ["gewuerzmischung_grill","Grillgewürz",M,730,365,EST,1.99,60,[]],
  ["vanillezucker","Vanillezucker",M,730,365,EST,0.79,40,[]],
  ["safran","Safran",M,730,365,EST,4.99,1,[]]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["mehl_weizen","Weizenmehl 405",M,540,180,EST,0.89,1000,[]],
  ["mehl_dinkel","Dinkelmehl",M,450,150,EST,1.79,1000,[]],
  ["mehl_vollkorn","Vollkornmehl",M,270,90,EST,1.49,1000,[]],
  ["mehl_roggen","Roggenmehl",M,450,150,EST,1.29,1000,[]],
  ["brauner_zucker","Brauner Zucker",M,900,365,EST,1.49,500,[]],
  ["natron","Natron",M,900,365,EST,0.99,50,[]],
  ["hefe_frisch","Frischhefe",M,14,3,EST,0.35,42,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["speisestaerke","Speisestärke",M,900,365,EST,0.99,400,[]],
  ["gelatine","Gelatine",M,900,365,EST,1.19,20,[]],
  ["agar","Agar-Agar",M,900,365,EST,2.49,30,[]],
  ["schokoladenstueckchen","Schokotropfen",M,365,120,EST,1.79,100,[]],
  ["marzipan","Marzipanrohmasse",M,270,30,EST,2.29,200,[]],
  ["rosinen","Rosinen",M,365,90,EST,1.49,250,[]],
  ["datteln","Datteln",M,270,60,EST,2.99,200,[]],
  ["feigen_getrocknet","Getrocknete Feigen",M,270,60,EST,3.49,200,[]],
  ["aprikosen_getrocknet","Getrocknete Aprikosen",M,270,60,EST,2.99,200,[]],
  ["cranberries_getrocknet","Getrocknete Cranberries",M,270,60,EST,2.79,150,[]],
  ["kokosraspel","Kokosraspeln",M,365,90,EST,1.29,200,[]],
  ["mandeln","Mandeln",M,270,90,EST,3.49,200,[]],
  ["haselnuesse","Haselnüsse",M,270,90,EST,3.29,200,[]],
  ["walnuesse","Walnüsse",M,180,60,EST,3.99,200,[]],
  ["cashewkerne","Cashewkerne",M,270,90,EST,3.79,200,[]],
  ["pistazien","Pistazien",M,270,90,EST,4.49,150,[]],
  ["erdnuesse","Erdnüsse",M,270,90,EST,1.99,200,[]],
  ["pinienkerne","Pinienkerne",M,180,60,EST,4.99,100,[]],
  ["sonnenblumenkerne","Sonnenblumenkerne",M,270,90,EST,1.29,250,[]],
  ["kuerbiskerne","Kürbiskerne",M,270,90,EST,2.49,200,[]],
  ["leinsamen","Leinsamen",M,270,90,EST,1.49,250,[]],
  ["chiasamen","Chiasamen",M,540,120,EST,2.99,250,[]],
  ["sesam","Sesam",M,270,90,EST,1.49,200,[]]
]);

// ===================== GETRÄNKE, breit ===========================
group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["wasser_still","Stilles Wasser",M,540,3,EST,0.29,1500,[]],
  ["wasser_medium","Wasser medium",M,540,3,EST,0.29,1500,[]],
  ["mineralwasser_glas","Mineralwasser Glasflasche",M,540,3,EST,0.45,700,[]],
  ["traubensaft","Traubensaft",M,270,5,EST,1.99,1000,[]],
  ["kirschsaft","Kirschsaft",M,270,5,EST,2.29,1000,[]],
  ["tomatensaft","Tomatensaft",M,270,4,EST,1.29,1000,[]],
  ["gemuesesaft","Gemüsesaft",M,270,4,EST,1.99,750,[]],
  ["johannisbeersaft","Johannisbeernektar",M,270,5,EST,2.49,750,[]],
  ["apfelschorle","Apfelschorle",M,270,3,EST,0.89,1000,[]],
  ["limonade_zitrone","Zitronenlimonade",M,270,3,EST,0.79,1000,[]],
  ["cola","Cola",M,270,3,EST,1.19,1500,[]],
  ["cola_zero","Cola zuckerfrei",M,270,3,EST,1.19,1500,[]],
  ["orangenlimonade","Orangenlimonade",M,270,3,EST,0.99,1500,[]],
  ["tonic","Tonic Water",M,270,2,EST,0.89,1000,[]],
  ["ginger_ale","Ginger Ale",M,270,2,EST,0.99,1000,[]],
  ["eistee_pfirsich","Eistee Pfirsich",M,180,3,EST,0.89,1500,[]],
  ["energydrink","Energydrink",M,365,1,EST,1.09,250,[]],
  ["sirup_himbeer","Himbeersirup",M,540,60,EST,2.49,500,[]],
  ["kaffee_pads","Kaffeepads",M,365,30,EST,3.49,120,[]],
  ["espresso_gemahlen","Espresso gemahlen",M,365,21,EST,4.49,250,[]],
  ["instantkaffee","Löslicher Kaffee",M,540,90,EST,4.99,200,[]],
  ["kakao_trinken","Trinkschokolade",M,365,120,EST,2.49,400,[]],
  ["tee_schwarz","Schwarztee",M,730,180,EST,2.29,50,[]],
  ["tee_gruen","Grüntee",M,730,180,EST,2.79,40,[]],
  ["tee_kraeuter","Kräutertee",M,730,180,EST,1.99,40,[]],
  ["tee_frucht","Früchtetee",M,730,180,EST,1.79,50,[]],
  ["tee_pfefferminz","Pfefferminztee",M,730,180,EST,1.69,35,[]],
  ["tee_kamille","Kamillentee",M,730,180,EST,1.79,30,[]],
  ["tee_rooibos","Rooibostee",M,730,180,EST,2.49,40,[]],
  ["bier_pils","Pils",M,180,1,EST,0.89,500,[]],
  ["bier_weizen","Weizenbier",M,180,1,EST,0.99,500,[]],
  ["bier_hell","Helles",M,180,1,EST,0.95,500,[]],
  ["bier_alkoholfrei","Alkoholfreies Bier",M,180,1,EST,0.85,500,[]],
  ["radler","Radler",M,180,1,EST,0.89,500,[]],
  ["wein_rot","Rotwein",M,900,3,EST,5.99,750,[]],
  ["wein_weiss","Weißwein",M,540,3,EST,5.49,750,[]],
  ["wein_rose","Roséwein",M,365,3,EST,5.49,750,[]],
  ["prosecco","Prosecco",M,540,1,EST,5.99,750,[]],
  ["aperitif","Aperitif",M,900,90,EST,9.99,700,[]],
  ["gin","Gin",M,3650,900,EST,15.99,700,[]],
  ["wodka","Wodka",M,3650,900,EST,12.99,700,[]],
  ["rum","Rum",M,3650,900,EST,14.99,700,[]],
  ["whisky","Whisky",M,3650,900,EST,19.99,700,[]],
  ["likoer","Likör",M,900,180,EST,9.99,700,[]]
]);

// ===================== TIEFKÜHL, breit ===========================
group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["tk_erbsen","TK-Erbsen",M,365,2,EST,1.19,750,[]],
  ["tk_spinat","TK-Spinat",M,365,2,EST,1.09,450,[]],
  ["tk_broccoli","TK-Brokkoli",M,365,2,EST,1.49,750,[]],
  ["tk_gemuesemix","TK-Gemüsemischung",M,365,2,EST,1.79,750,[]],
  ["tk_rahmspinat","TK-Rahmspinat",M,300,2,EST,1.29,450,[]],
  ["tk_himbeeren","TK-Himbeeren",M,365,2,EST,2.79,300,[]],
  ["tk_mango","TK-Mangostücke",M,365,2,EST,2.49,300,[]],
  ["tk_kroketten","TK-Kroketten",M,365,2,EST,2.29,600,[]],
  ["tk_roesti","TK-Rösti",M,365,2,EST,2.49,500,[]],
  ["tk_kartoffelecken","TK-Kartoffelecken",M,365,2,EST,2.19,750,[]],
  ["tk_pizza_salami","TK-Pizza Salami",M,300,1,EST,2.49,320,[]],
  ["tk_pizza_margherita","TK-Pizza Margherita",M,300,1,EST,2.29,300,[]],
  ["tk_baguette","TK-Baguette belegt",M,270,1,EST,1.99,250,[]],
  ["tk_lasagne","TK-Lasagne",M,270,1,EST,2.99,400,[]],
  ["tk_fischstaebchen","TK-Fischstäbchen",M,300,1,EST,2.99,450,[]],
  ["tk_backfisch","TK-Backfisch",M,300,1,EST,3.49,400,[]],
  ["tk_lachs","TK-Lachsfilet",M,180,1,EST,5.99,250,[]],
  ["tk_garnelen","TK-Garnelen",M,180,1,EST,4.99,200,[]],
  ["tk_haehnchen","TK-Hähnchenbrust",M,180,1,EST,5.49,500,[]],
  ["tk_hackbaellchen","TK-Hackbällchen",M,180,1,EST,3.49,400,[]],
  ["tk_gyros","TK-Gyros",M,180,1,EST,4.29,400,[]],
  ["tk_blaetterteig","TK-Blätterteig",M,270,2,EST,1.79,270,[]],
  ["tk_pizzateig","TK-Pizzateig",M,270,2,EST,1.49,300,[]],
  ["tk_broetchen","TK-Brötchen",M,270,2,EST,1.99,400,[]],
  ["tk_eis_vanille","Vanilleeis",M,270,1,EST,2.99,1000,[]],
  ["tk_eis_schoko","Schokoladeneis",M,270,1,EST,2.99,1000,[]],
  ["tk_eis_stiel","Eis am Stiel",M,270,1,EST,2.49,300,[]],
  ["tk_kuchen","TK-Kuchen",M,270,1,EST,3.49,400,[]]
]);

// ===================== SÜSSES & SNACKS, breit ====================
group("Süßes/Snacks", "Süßwaren", STORAGE.PANTRY, [
  ["schokolade_vollmilch","Vollmilchschokolade",M,365,30,EST,1.29,100,[]],
  ["schokolade_zart","Zartbitterschokolade",M,540,30,EST,1.49,100,[]],
  ["schokolade_weiss","Weiße Schokolade",M,300,30,EST,1.39,100,[]],
  ["schokolade_nuss","Nussschokolade",M,330,30,EST,1.59,100,[]],
  ["pralinen","Pralinen",M,180,14,EST,4.99,200,[]],
  ["riegel_schoko","Schokoriegel",M,270,7,EST,0.89,50,[]],
  ["kekse_butter","Butterkekse",M,270,14,EST,1.29,200,[]],
  ["kekse_schoko","Schokokekse",M,270,14,EST,1.79,200,[]],
  ["spekulatius","Spekulatius",M,180,14,EST,1.49,200,[]],
  ["lebkuchen","Lebkuchen",M,180,14,EST,2.49,200,[]],
  ["waffeln","Waffeln",M,180,10,EST,1.99,250,[]],
  ["reiswaffeln","Reiswaffeln",M,270,14,EST,1.29,100,[]],
  ["salzstangen","Salzstangen",M,180,7,EST,0.99,250,[]],
  ["chips_paprika","Paprikachips",M,120,3,EST,1.79,175,[]],
  ["chips_salz","Salzchips",M,120,3,EST,1.69,175,[]],
  ["tortillachips","Tortillachips",M,180,5,EST,1.99,300,[]],
  ["erdnussflips","Erdnussflips",M,150,4,EST,1.29,200,[]],
  ["salzbrezeln","Salzbrezeln",M,180,7,EST,1.19,200,[]],
  ["studentenfutter","Studentenfutter",M,240,30,EST,2.49,200,[]],
  ["lakritz","Lakritz",M,365,14,EST,1.49,200,[]],
  ["kaugummi","Kaugummi",M,540,90,EST,1.19,30,[]],
  ["schokoriegel_gross","Schokotafel groß",M,300,21,EST,2.49,300,[]],
  ["adventskalender","Adventskalender",M,180,14,EST,4.99,200,[]],
  ["pudding_pulver","Puddingpulver",M,540,180,EST,0.49,40,[]],
  ["backmischung","Backmischung",M,365,60,EST,1.99,400,[]]
]);

// ===================== BABY & TIER ===============================
group("Baby", "Drogerie", STORAGE.PANTRY, [
  ["babybrei_obst","Obstbrei",M,540,1,EST,0.79,190,[],{isFood:true}],
  ["babybrei_gemuese","Gemüsebrei",M,540,1,EST,0.99,190,[],{isFood:true}],
  ["babymilch","Säuglingsmilchnahrung",M,540,21,EST,12.99,800,[],{isFood:true}],
  ["babybrei_getreide","Getreidebrei",M,365,30,EST,2.49,400,[],{isFood:true}],
  ["quetschie","Quetschbeutel",M,365,1,EST,0.89,100,[],{isFood:true}],
  ["feuchttuecher","Feuchttücher",N,1095,60,EST,1.49,300,[],{isFood:false,freezable:false}],
  ["wundschutzcreme","Wundschutzcreme",N,1095,180,EST,3.49,75,[],{isFood:false,freezable:false}],
  ["babyshampoo","Babyshampoo",N,1095,365,EST,2.99,250,[],{isFood:false,freezable:false}],
  ["schnuller","Schnuller",N,3650,3650,EST,4.99,20,[],{isFood:false,freezable:false}]
], { freezable: false });

group("Tierbedarf", "Drogerie", STORAGE.PANTRY, [
  ["katzenfutter_nass","Katzenfutter nass",M,540,2,EST,0.69,400,[],{isFood:false}],
  ["katzenfutter_trocken","Katzenfutter trocken",M,540,60,EST,6.99,2000,[],{isFood:false}],
  ["hundefutter_nass","Hundefutter nass",M,540,2,EST,1.19,800,[],{isFood:false}],
  ["hundefutter_trocken","Hundefutter trocken",M,540,60,EST,9.99,3000,[],{isFood:false}],
  ["katzenstreu","Katzenstreu",N,3650,3650,EST,5.99,10000,[],{isFood:false}],
  ["hundeleckerli","Hundeleckerli",M,365,30,EST,2.99,200,[],{isFood:false}],
  ["katzensnack","Katzensnack",M,365,14,EST,1.49,60,[],{isFood:false}],
  ["vogelfutter","Vogelfutter",M,365,90,EST,3.99,1000,[],{isFood:false}],
  ["nagerstreu","Nagerstreu",N,3650,3650,EST,4.49,3000,[],{isFood:false}],
  ["fischfutter","Fischfutter",M,540,90,EST,3.49,100,[],{isFood:false}]
], { freezable: false });

// ===================== DROGERIE, breit ===========================
group("Körperpflege", "Drogerie", STORAGE.NONE, [
  ["shampoo_trocken","Trockenshampoo",N,1095,365,EST,3.49,200,[]],
  ["haarkur","Haarkur",N,1095,365,EST,3.99,200,[]],
  ["haarspray","Haarspray",N,1095,365,EST,2.99,250,[]],
  ["haargel","Haargel",N,1095,365,EST,2.49,150,[]],
  ["haarfarbe","Haarfarbe",N,1095,30,EST,6.99,150,[]],
  ["duschgel_herren","Duschgel für Herren",N,1095,365,EST,2.29,300,[]],
  ["badezusatz","Badezusatz",N,1095,365,EST,2.99,500,[]],
  ["bodylotion","Bodylotion",N,1095,365,EST,3.49,400,[]],
  ["handcreme","Handcreme",N,1095,365,EST,2.49,100,[]],
  ["fusscreme","Fußcreme",N,1095,365,EST,2.99,100,[]],
  ["gesichtscreme","Gesichtscreme",N,1095,180,EST,5.99,50,[]],
  ["gesichtsreinigung","Gesichtsreinigung",N,1095,365,EST,3.99,150,[]],
  ["gesichtsmaske","Gesichtsmaske",N,1095,30,EST,1.99,20,[]],
  ["lippenpflege","Lippenpflege",N,1095,365,EST,1.99,5,[]],
  ["rasierschaum","Rasierschaum",N,1095,365,EST,2.49,200,[]],
  ["rasiergel","Rasiergel",N,1095,365,EST,3.29,200,[]],
  ["aftershave","Aftershave",N,1095,365,EST,5.99,100,[]],
  ["deo_roller","Deo Roll-on",N,1095,365,EST,1.99,50,[]],
  ["deo_spray","Deospray",N,1095,365,EST,2.29,200,[]],
  ["parfum","Parfüm",N,1825,730,EST,24.99,50,[]],
  ["zahnseide","Zahnseide",N,3650,3650,EST,2.49,50,[]],
  ["interdentalbuersten","Interdentalbürsten",N,3650,3650,EST,3.99,20,[]],
  ["mundspuelung","Mundspülung",N,1095,180,EST,2.99,500,[]],
  ["zungenreiniger","Zungenreiniger",N,3650,3650,EST,2.49,15,[]],
  ["wattestaebchen","Wattestäbchen",N,3650,3650,EST,1.29,100,[]],
  ["wattepads","Wattepads",N,3650,3650,EST,1.19,80,[]],
  ["nagelfeile","Nagelfeile",N,3650,3650,EST,1.49,10,[]],
  ["nagellack","Nagellack",N,1095,730,EST,3.99,10,[]],
  ["nagellackentferner","Nagellackentferner",N,1095,365,EST,1.99,100,[]],
  ["pflaster","Pflaster",N,1825,730,EST,2.49,30,[]],
  ["binden","Binden",N,3650,3650,EST,2.29,200,[]],
  ["tampons","Tampons",N,3650,3650,EST,2.99,100,[]],
  ["slipeinlagen","Slipeinlagen",N,3650,3650,EST,1.99,150,[]],
  ["intimpflege","Intimwaschlotion",N,1095,365,EST,2.79,250,[]],
  ["haarbuerste","Haarbürste",N,3650,3650,EST,4.99,80,[]]
], { isFood: false, freezable: false });

group("Waschen & Reinigen", "Drogerie", STORAGE.NONE, [
  ["waschmittel_color","Colorwaschmittel",N,1095,1095,EST,6.49,1500,[]],
  ["waschmittel_fein","Feinwaschmittel",N,1095,1095,EST,4.99,1000,[]],
  ["waschmittel_pulver","Waschpulver",N,1095,1095,EST,7.99,2000,[]],
  ["fleckenentferner","Fleckenentferner",N,1095,1095,EST,3.49,500,[]],
  ["waschmittel_black","Schwarzwaschmittel",N,1095,1095,EST,5.49,1000,[]],
  ["klarspueler","Klarspüler",N,1095,1095,EST,3.29,500,[]],
  ["spuelmaschinensalz","Spülmaschinensalz",N,3650,3650,EST,1.29,2000,[]],
  ["badreiniger","Badreiniger",N,1095,1095,EST,2.29,750,[]],
  ["wc_reiniger","WC-Reiniger",N,1095,1095,EST,1.99,750,[]],
  ["wc_stein","WC-Stein",N,1095,1095,EST,2.49,100,[]],
  ["glasreiniger","Glasreiniger",N,1095,1095,EST,1.99,500,[]],
  ["bodenreiniger","Bodenreiniger",N,1095,1095,EST,2.79,1000,[]],
  ["backofenreiniger","Backofenreiniger",N,1095,1095,EST,3.49,500,[]],
  ["kalkreiniger","Kalkreiniger",N,1095,1095,EST,2.49,750,[]],
  ["moebelpolitur","Möbelpolitur",N,1095,1095,EST,3.29,300,[]],
  ["abflussreiniger","Abflussreiniger",N,1095,1095,EST,3.99,1000,[]],
  ["mikrofasertuch","Mikrofasertuch",N,3650,3650,EST,2.49,50,[]],
  ["putzlappen","Putzlappen",N,3650,3650,EST,1.99,100,[]],
  ["gummihandschuhe","Gummihandschuhe",N,3650,3650,EST,1.79,80,[]],
  ["muellbeutel_klein","Müllbeutel klein",N,3650,3650,EST,1.99,200,[]],
  ["biomuellbeutel","Biomüllbeutel",N,3650,3650,EST,2.29,150,[]],
  ["gelbe_saecke","Gelbe Säcke",N,3650,3650,EST,1.49,150,[]],
  ["lufterfrischer","Lufterfrischer",N,1095,365,EST,2.99,250,[]],
  ["mottenschutz","Mottenschutz",N,1095,365,EST,3.49,50,[]],
  ["insektenspray","Insektenspray",N,1095,365,EST,4.49,400,[]]
], { isFood: false, freezable: false });

group("Papier & Folie", "Drogerie", STORAGE.NONE, [
  ["servietten","Servietten",N,3650,3650,EST,1.49,100,[]],
  ["kuechentuecher_papier","Papiertücher",N,3650,3650,EST,2.29,400,[]],
  ["butterbrotpapier","Butterbrotpapier",N,3650,3650,EST,1.29,150,[]],
  ["muffinfoermchen","Muffinförmchen",N,3650,3650,EST,1.49,50,[]],
  ["zahnstocher","Zahnstocher",N,3650,3650,EST,0.99,30,[]],
  ["strohhalme","Strohhalme",N,3650,3650,EST,1.29,40,[]],
  ["grillschale","Grillschalen",N,3650,3650,EST,2.49,200,[]],
  ["gefrierdosen","Gefrierdosen",N,3650,3650,EST,3.99,300,[]]
], { isFood: false, freezable: false });

group("Haushaltszubehör", "Drogerie", STORAGE.NONE, [
  ["schwammtuecher","Schwammtücher",N,3650,3650,EST,2.29,80,[]],
  ["topfkratzer","Topfkratzer",N,3650,3650,EST,1.49,40,[]],
  ["waescheklammern","Wäscheklammern",N,3650,3650,EST,1.99,200,[]],
  ["buegelbrettbezug","Bügelbrettbezug",N,3650,3650,EST,7.99,400,[]],
  ["schuhbeutel","Schuhbeutel",N,3650,3650,EST,2.49,60,[]],
  ["feuerzeug","Feuerzeug",N,3650,3650,EST,1.19,20,[]],
  ["streichhoelzer","Streichhölzer",N,3650,3650,EST,0.79,30,[]],
  ["blumenerde","Blumenerde",N,3650,3650,EST,3.99,10000,[]],
  ["blumenduenger","Blumendünger",N,1095,1095,EST,3.49,500,[]],
  ["schneidebrett","Schneidebrett",N,3650,3650,EST,5.99,400,[]]
], { isFood: false, freezable: false });

// ===================== FERTIG & INTERNATIONAL ====================
group("Fertiggerichte", "Trockenware", STORAGE.PANTRY, [
  ["fertigsuppe_tuete","Tütensuppe",M,540,1,EST,0.69,60,[]],
  ["instantnudeln","Instantnudeln",M,365,1,EST,0.79,85,[]],
  ["kartoffelpueree_pulver","Kartoffelpüree Pulver",M,540,30,EST,1.29,400,[]],
  ["knoedel","Knödel Fertigmischung",M,365,7,EST,1.99,200,[]],
  ["sossenbinder","Soßenbinder",M,540,90,EST,0.99,250,[]],
  ["bratensosse","Bratensoße Pulver",M,540,90,EST,0.89,250,[]],
  ["pizzabrot_fertig","Pizzateig frisch",M,21,1,EST,1.99,400,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["nudelsauce_glas","Nudelsauce Glas",M,540,5,EST,1.79,400,[]],
  ["fixprodukt","Fix-Würzmischung",M,540,30,EST,0.89,40,[]],
  ["sandwich_fertig","Fertigsandwich",V,2,1,LEIT,2.99,180,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["salat_fertig","Fertigsalat",V,2,1,LEIT,3.49,250,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["sushi_fertig","Sushi Box",V,1,1,LEIT,6.99,250,[],{storage:STORAGE.FRIDGE_BOTTOM}],
  ["suppe_frisch","Frischesuppe",M,14,2,EST,2.99,600,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["auflauf_fertig","Fertigauflauf",M,10,1,EST,3.99,400,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["reisgericht_fertig","Reisgericht Becher",M,300,1,EST,2.49,300,[]]
]);

group("International", "Trockenware", STORAGE.PANTRY, [
  ["reisnudeln","Reisnudeln",M,730,120,EST,1.99,250,[]],
  ["glasnudeln","Glasnudeln",M,730,120,EST,2.29,200,[]],
  ["mie_nudeln","Mie-Nudeln",M,540,90,EST,1.79,250,[]],
  ["reispapier","Reispapier",M,540,90,EST,2.49,200,[]],
  ["nori","Noriblätter",M,540,60,EST,2.99,25,[]],
  ["wasabi","Wasabipaste",M,540,60,EST,2.79,40,[]],
  ["misopaste","Misopaste",M,365,90,EST,3.99,300,[]],
  ["kimchi","Kimchi",M,60,14,EST,3.49,300,[],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["harissa","Harissa",M,540,30,EST,2.49,100,[]],
  ["ras_el_hanout","Ras el Hanout",M,730,365,EST,2.29,50,[]],
  ["garam_masala","Garam Masala",M,730,365,EST,1.99,50,[]],
  ["falafelmischung","Falafelmischung",M,540,60,EST,1.99,200,[]],
  ["bohnenpaste","Bohnenpaste",M,540,30,EST,2.49,200,[]],
  ["tortillachips_blau","Blaue Maischips",M,180,5,EST,2.49,200,[]],
  ["taco_shells","Taco Shells",M,365,7,EST,1.99,150,[]]
]);

// ---- Zugriffsfunktionen ----------------------------------------

/* Bei 850 Produkten wird `find()` in den Schleifen von compute()
   spürbar: dort läuft byId einige tausend Mal je Durchgang. Der Index
   wird beim ersten Zugriff gebaut — nicht beim Laden, denn zu dem
   Zeitpunkt füllen die group()-Aufrufe die Liste noch. */
let ID_INDEX = null;
function byId(id) {
  if (!ID_INDEX) {
    ID_INDEX = new Map();
    FOOD_DATABASE.forEach((p) => ID_INDEX.set(p.id, p));
  }
  return ID_INDEX.get(id) || null;
}

function isSafetyCritical(productId) {
  const p = byId(productId);
  return p ? p.safetyCritical === true : false;
}

function getShelfLife(productId, opened = false) {
  const p = byId(productId);
  if (!p) return null;
  return opened ? p.shelfLifeOpenedDays : p.shelfLifeDays;
}

const byCategory = (c) => FOOD_DATABASE.filter((p) => p.category === c);
const allCategories = () => [...new Set(FOOD_DATABASE.map((p) => p.category))];

function databaseQualityReport() {
  const counts = { regulatorisch: 0, leitlinie: 0, schaetzwert: 0 };
  FOOD_DATABASE.forEach((p) => { counts[p.quality] = (counts[p.quality] || 0) + 1; });
  return {
    total: FOOD_DATABASE.length,
    ...counts,
    safetyCritical: FOOD_DATABASE.filter((p) => p.safetyCritical).length,
    nonFood: FOOD_DATABASE.filter((p) => !p.isFood).length,
    kategorien: allCategories().length,
    aliasesTotal: FOOD_DATABASE.reduce((s, p) => s + p.aliases.length, 0),
    anteilGeschaetzt: Math.round((counts.schaetzwert / FOOD_DATABASE.length) * 100)
  };
}

/* ===== rhythmEngine2.js ===== */
/**
 * rhythmEngine2.js  — überarbeitete Fassung
 * ================================================================
 * Was gegenüber v1 besser ist:
 *
 * 1. MEDIAN STATT MITTELWERT.
 *    Ein einziger Urlaub (28 Tage kein Milchkauf) hat den alten
 *    gewichteten Mittelwert massiv verzogen. Der Median ignoriert
 *    solche Ausreißer strukturell.
 *
 * 2. MAD STATT STANDARDABWEICHUNG für den Vertrauenswert.
 *    Die Standardabweichung wird vom selben Ausreißer verzerrt wie
 *    der Mittelwert. Die "Median Absolute Deviation" nicht.
 *
 * 3. MENGENBEWUSST.
 *    Zwei Liter Milch halten doppelt so lange wie einer. v1 hat
 *    Mengen ignoriert und deshalb bei Vorratskäufen falsche
 *    Rhythmen gelernt. Jetzt wird pro Einheit gerechnet.
 *
 * 4. PAUSENERKENNUNG.
 *    Ein Abstand, der mehr als das Dreifache des Medians beträgt,
 *    wird als Unterbrechung (Urlaub, Krankheit) erkannt und aus
 *    der Rhythmusberechnung ausgeschlossen -- aber protokolliert,
 *    damit er nicht stillschweigend verschwindet.
 *
 * 5. TRENDERKENNUNG.
 *    Vergleicht die jüngere Hälfte der Intervalle mit der älteren.
 *    Verändert sich der Rhythmus dauerhaft (neuer Job, Kind aus dem
 *    Haus), wird das gemeldet statt weggemittelt.
 *
 * Weiterhin: kein KI-Modell. Nur robuste Statistik.
 * ================================================================
 */

const MIN_INTERVALS_FOR_TREND = 6;
const PAUSE_FACTOR = 3;          // ab dem Dreifachen des Medians: Unterbrechung
const MIN_INTERVALS_FULL_CONFIDENCE = 4;

function daysBetween(a, b) {
  const ta = new Date(b).getTime();
  const tb = new Date(a).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return NaN;
  return Math.round((ta - tb) / 86400000);
}

/**
 * Prüft, ob ein Datumswert brauchbar ist.
 * Im Stresstest hat ein einziger kaputter Eintrag ("kein-datum")
 * den gesamten Rhythmus auf NaN gesetzt — bei echten Bons ist ein
 * unlesbares Datum nicht unwahrscheinlich, und ein einzelner
 * Fehler darf nicht die Auswertung aller anderen Käufe zerstören.
 */
function isValidDate(d) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Number.isFinite(t);
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median Absolute Deviation — robustes Streuungsmaß. */
function mad(values) {
  const m = median(values);
  if (m === null) return null;
  return median(values.map((v) => Math.abs(v - m)));
}

/**
 * Berechnet den Rhythmus für ein Produkt.
 *
 * @param {Array<{date:string, quantity?:number}>} purchases
 * @param {{absenceDays?:function}} [opts]
 *   `absenceDays(from, to)` liefert die Tage, an denen der Haushalt in
 *   diesem Zeitraum nicht da war. Sie werden vom Abstand abgezogen,
 *   denn verbraucht wird nur, wenn jemand da ist. Als Funktion statt
 *   als Liste übergeben, damit dieses Modul nichts über Abwesenheiten
 *   wissen muss — die Erkennung steht in absenceDetector.js, und eine
 *   Abhängigkeit dorthin wäre ein Ring.
 * @returns {{
 *   rhythmDays:number|null, confidence:number, sampleSize:number,
 *   lastPurchaseDate:string|null, lastQuantity:number,
 *   pauses:Array, trend:"stabil"|"seltener"|"haeufiger"|"unbekannt",
 *   perUnitDays:number|null
 * }}
 */
function computeRhythm(purchases, opts = {}) {
  const empty = {
    rhythmDays: null, confidence: 0, sampleSize: 0, lastPurchaseDate: null,
    lastQuantity: 1, pauses: [], trend: "unbekannt", perUnitDays: null, invalidEntries: 0
  };
  if (!purchases || purchases.length === 0) return empty;

  // Kaputte Einträge aussortieren, statt die ganze Berechnung zu
  // vergiften: ungültiges Datum, Menge <= 0 oder nicht endlich.
  // Aussortierte Einträge werden gezählt, damit sie nicht
  // stillschweigend verschwinden.
  const invalid = [];
  const clean = purchases.filter((p) => {
    const okDate = isValidDate(p.date);
    const qty = p.quantity === undefined ? 1 : p.quantity;
    const okQty = Number.isFinite(qty) && qty > 0;
    if (!okDate || !okQty) { invalid.push(p); return false; }
    return true;
  }).map((p) => ({ ...p, quantity: p.quantity === undefined ? 1 : p.quantity }));

  if (clean.length === 0) return { ...empty, invalidEntries: invalid.length };

  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  if (sorted.length < 2) {
    return { ...empty, lastPurchaseDate: last.date, lastQuantity: last.quantity || 1, invalidEntries: invalid.length };
  }

  // Rohintervalle, jeweils normiert auf die gekaufte Menge:
  // 2 Liter Milch in 12 Tagen = 6 Tage pro Einheit.
  const rawIntervals = [];
  const absenceOf = typeof opts.absenceDays === "function" ? opts.absenceDays : null;
  let absenceCorrected = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);

    // Abwesenheitstage abziehen: ein Abstand von 24 Tagen mit zwei
    // Wochen Urlaub darin ist ein Abstand von zehn Verbrauchstagen.
    // Mindestens ein Tag bleibt stehen — ein Abstand von null Tagen
    // wäre kein Rhythmus, sondern eine Division durch null.
    let away = 0;
    if (absenceOf) {
      const raw = Number(absenceOf(sorted[i - 1].date, sorted[i].date)) || 0;
      away = Math.max(0, Math.min(gap - 1, raw));
      if (away > 0) absenceCorrected++;
    }
    const effectiveGap = gap - away;

    const qty = sorted[i - 1].quantity || 1;
    const perUnit = effectiveGap / qty;
    // Sicherheitsnetz: nur endliche, nicht-negative Werte verwenden
    if (!Number.isFinite(perUnit) || perUnit < 0) continue;
    rawIntervals.push({ gap: effectiveGap, calendarGap: gap, away, perUnit, from: sorted[i - 1].date, to: sorted[i].date });
  }
  if (rawIntervals.length === 0) {
    return { ...empty, lastPurchaseDate: last.date, lastQuantity: last.quantity || 1, invalidEntries: invalid.length };
  }

  // Erste grobe Schätzung, um Pausen überhaupt erkennen zu können
  const roughMedian = median(rawIntervals.map((r) => r.perUnit));

  // Pausen aussortieren, aber protokollieren
  const pauses = [];
  const usable = rawIntervals.filter((r) => {
    if (roughMedian && r.perUnit > roughMedian * PAUSE_FACTOR) {
      pauses.push({ from: r.from, to: r.to, days: r.gap });
      return false;
    }
    return true;
  });

  const working = usable.length >= 2 ? usable : rawIntervals; // nie alles wegfiltern
  const perUnitValues = working.map((r) => r.perUnit);

  const perUnitDays = median(perUnitValues);
  const lastQuantity = last.quantity || 1;
  // Der ausgegebene Rhythmus bezieht sich auf die zuletzt gekaufte Menge
  const rhythmDays = perUnitDays !== null ? Math.max(1, Math.round(perUnitDays * lastQuantity)) : null;

  // Vertrauen: genug Datenpunkte UND geringe robuste Streuung
  const dispersion = mad(perUnitValues);
  const relativeDispersion = perUnitDays > 0 && dispersion !== null ? dispersion / perUnitDays : 1;
  const sampleFactor = Math.min(1, working.length / MIN_INTERVALS_FULL_CONFIDENCE);
  const stabilityFactor = Math.max(0, 1 - relativeDispersion * 1.5);
  const confidence = Math.round(sampleFactor * stabilityFactor * 100) / 100;

  // Trend: jüngere Hälfte gegen ältere Hälfte
  let trend = "unbekannt";
  if (working.length >= MIN_INTERVALS_FOR_TREND) {
    const half = Math.floor(working.length / 2);
    const older = median(perUnitValues.slice(0, half));
    const newer = median(perUnitValues.slice(half));
    if (older && newer) {
      const change = (newer - older) / older;
      if (change > 0.25) trend = "seltener";
      else if (change < -0.25) trend = "haeufiger";
      else trend = "stabil";
    }
  }

  return {
    rhythmDays, confidence, sampleSize: working.length,
    lastPurchaseDate: last.date, lastQuantity,
    pauses, trend, perUnitDays: perUnitDays !== null ? Math.round(perUnitDays * 10) / 10 : null,
    absenceCorrected,
    invalidEntries: invalid.length
  };
}

/** Rhythmen für alle Produkte eines Haushalts. */
function computeAllRhythms(history, opts = {}) {
  const byProduct = new Map();
  for (const entry of history) {
    if (!byProduct.has(entry.productId)) byProduct.set(entry.productId, []);
    byProduct.get(entry.productId).push(entry);
  }
  const out = new Map();
  for (const [productId, purchases] of byProduct.entries()) {
    out.set(productId, computeRhythm(purchases, opts));
  }
  return out;
}

/* ===== absenceDetector.js ===== */
/**
 * absenceDetector.js — Abwesenheit aus den Bons erkennen
 * ================================================================
 * Der Rhythmus misst Kalendertage zwischen zwei Käufen. Ein Haushalt
 * verbraucht aber keine Kalendertage, sondern Anwesenheitstage. Wer
 * zwei Wochen weg ist, hat danach einen Kaufabstand von 24 statt 10
 * Tagen — und die App lernt daraus, dass zehn Tage falsch waren.
 *
 * `rhythmEngine2` hat dagegen eine Pausenerkennung: Abstände über dem
 * Dreifachen des Medians fliegen raus. Die greift bei kurzen Rhythmen
 * (14 Tage Urlaub sind das Fünffache eines Drei-Tage-Rhythmus) und
 * greift NICHT bei mittleren (dieselben 14 Tage sind das Doppelte
 * eines Zehn-Tage-Rhythmus). Genau dort entsteht der Schaden.
 *
 * Was in der Drei-Jahres-Simulation dabei herauskam: nach jedem
 * Urlaub verlängerten sich die mittleren Rhythmen, die App schlug
 * wochenlang zu spät vor, und die Trefferquote fiel von 80 % auf
 * 44 %. Der Haushalt stand mit leerem Kühlschrank da — ausgerechnet
 * in den Wochen nach der Rückkehr, in denen ohnehin nichts da ist.
 *
 * DER BESSERE UMGANG: Abstände NICHT wegwerfen, sondern korrigieren.
 * Ein Kaufabstand von 24 Tagen mit 14 Tagen Abwesenheit ist ein
 * Abstand von 10 Verbrauchstagen. Das erhält den Datenpunkt, statt
 * ihn zu verlieren.
 *
 * WORAN MAN EINE ABWESENHEIT ERKENNT: nicht daran, dass ein einzelnes
 * Produkt lange nicht gekauft wurde — das kann auch heißen, dass es
 * nicht mehr gebraucht wird. Sondern daran, dass GAR NICHT eingekauft
 * wurde. Eine Lücke in den Bons betrifft den ganzen Haushalt und ist
 * damit die belastbarere Aussage.
 * ================================================================
 */



const MIN_ABSENCE_DAYS = 6;      // ein langes Wochenende ist keine Abwesenheit
const GAP_FACTOR = 3;            // Vielfaches des üblichen Einkaufsabstands
const MIN_SHOPPING_DAYS = 8;     // darunter gibt es keinen üblichen Abstand
const MAX_ABSENCE_DAYS = 90;     // darüber ist es keine Reise, sondern ein Umzug
// Eine noch laufende Lücke — der letzte Einkauf ist lange her und es
// kam noch keiner danach. Sie zählt kürzer als eine abgeschlossene,
// weil sie zweideutig ist: „gerade aus dem Urlaub zurück" und „die
// App seit Wochen nicht mehr benutzt" sehen von hier aus gleich aus.
// Drei Wochen decken jede Reise ab und nicht das Aufgeben.
const MAX_OPEN_ABSENCE_DAYS = 21;

const shift = (dateStr, n) =>
  new Date(new Date(dateStr + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);

function medianGap(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Abwesenheiten aus den Einkaufstagen ableiten.
 *
 * @param {Array} receipts [{date}]
 * @param {string} today
 * @returns {Array} [{from, to, days, reason}] — der INNERE Zeitraum,
 *   also ohne die beiden Einkaufstage, die ihn begrenzen.
 */
function detectAbsences(receipts, today) {
  const days = [...new Set((receipts || [])
    .filter((r) => r && r.date && r.date <= today)
    .map((r) => r.date))].sort();

  if (days.length < MIN_SHOPPING_DAYS) return [];

  const gaps = [];
  for (let i = 1; i < days.length; i++) gaps.push(daysBetween(days[i - 1], days[i]));

  const usual = medianGap(gaps);
  if (!usual || usual <= 0) return [];

  const threshold = Math.max(MIN_ABSENCE_DAYS, usual * GAP_FACTOR);

  const out = [];
  for (let i = 1; i < days.length; i++) {
    const gap = gaps[i - 1];
    if (gap < threshold || gap > MAX_ABSENCE_DAYS) continue;
    // Die Einkaufstage selbst gehören nicht zur Abwesenheit — an
    // ihnen war jemand da. Gezählt wird, was dazwischen liegt, und
    // davon nur der Teil, der über den üblichen Abstand hinausgeht.
    const extra = Math.round(gap - usual);
    if (extra < MIN_ABSENCE_DAYS) continue;
    out.push({
      from: shift(days[i - 1], 1),
      to: shift(days[i], -1),
      days: extra,
      gap,
      usual: Math.round(usual * 10) / 10,
      reason: "keine_einkaeufe"
    });
  }

  // Die noch offene Lücke am Ende: seit dem letzten Einkauf ist zu
  // viel Zeit vergangen. Ohne sie meldet die App jemandem, der gerade
  // aus dem Urlaub kommt und noch nicht einkaufen war, dass sein
  // Zähler bei null steht — im unpassendsten Moment.
  const lastDay = days[days.length - 1];
  const open = daysBetween(lastDay, today);
  if (open >= threshold) {
    const extra = Math.min(MAX_OPEN_ABSENCE_DAYS, Math.round(open - usual));
    if (extra >= MIN_ABSENCE_DAYS) {
      out.push({
        from: shift(lastDay, 1),
        to: shift(lastDay, 1 + extra),
        days: extra,
        gap: open,
        usual: Math.round(usual * 10) / 10,
        reason: "noch_offen"
      });
    }
  }

  return out;
}

/** Eine bekannte Abwesenheit (Urlaubsmodus) in dieselbe Form bringen. */
function knownAbsence(vacation, today) {
  if (!vacation || !vacation.from || !vacation.to) return [];
  const from = vacation.from;
  const to = vacation.to < today ? vacation.to : today;
  if (from >= to) return [];
  const days = daysBetween(from, to);
  if (days < MIN_ABSENCE_DAYS) return [];
  return [{ from, to, days, gap: days, usual: null, reason: "urlaubsmodus" }];
}

/**
 * Abwesenheitstage, die in einen Zeitraum fallen.
 * Überlappungen werden nicht doppelt gezählt.
 */
function absenceDaysBetween(absences, fromDate, toDate) {
  if (!absences || !absences.length || !fromDate || !toDate) return 0;

  const spans = absences
    .map((a) => ({
      from: a.from > fromDate ? a.from : fromDate,
      to: a.to < toDate ? a.to : toDate
    }))
    .filter((a) => a.from < a.to)
    .sort((a, b) => a.from.localeCompare(b.from));

  let total = 0;
  let cursor = null;
  for (const s of spans) {
    const start = cursor && cursor > s.from ? cursor : s.from;
    if (start >= s.to) continue;
    total += daysBetween(start, s.to);
    cursor = s.to;
  }
  return total;
}

/** Alle Abwesenheiten: erkannte und ausdrücklich eingetragene. */
function allAbsences(receipts, vacation, today) {
  return [...detectAbsences(receipts, today), ...knownAbsence(vacation, today)];
}

/* ===== productMatcher2.js ===== */
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
  "bund", "kiste", "korb", "portion", "familienpackung"
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

/* ===== productSearch.js ===== */
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

/* ===== brandSwap.js ===== */
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

/* ===== wasteInference2.js ===== */
/**
 * wasteInference2.js — überarbeitete Fassung
 * ================================================================
 * Was gegenüber v1 besser ist:
 *
 * 1. SICHERHEITSSPERRE.
 *    Produkte mit Verbrauchsdatum (Hackfleisch, Geflügel, roher
 *    Fisch, vorgeschnittener Salat, geschnittenes Obst) werden bei
 *    der Verschwendungsschätzung gesondert behandelt: die App darf
 *    hier NIE andeuten, etwas sei "vermutlich noch gut". Sie darf
 *    nur feststellen, dass zu viel gekauft wurde.
 *
 * 2. MENGENBEZUG.
 *    Verschwendung wird pro Einheit gerechnet, nicht pro Einkauf.
 *    Wer zwei Salatköpfe kauft und einen wegwirft, verschwendet
 *    50 %, nicht 100 %.
 *
 * 3. GEÖFFNET/UNGEÖFFNET.
 *    Ein ungeöffneter Joghurt hält 21 Tage, ein geöffneter 5.
 *    Die Datenbank kennt beide Werte; die Schätzung nutzt den
 *    konservativeren, sobald ein Anbruch wahrscheinlich ist.
 *
 * 4. UNSICHERHEITSBAND STATT SCHEINGENAUIGKEIT.
 *    Ausgabe ist eine Spanne (min/max), nicht ein exakter Betrag.
 *    Aus dem Persona-Bericht: eine falsche Nachkommastelle
 *    untergräbt das Vertrauen in die gesamte App.
 *
 * 5. QUALITÄTSWEITERGABE.
 *    Beruht die Haltbarkeit auf einem reinen Schätzwert, wird das
 *    im Ergebnis mitgeführt -- das UI kann die Aussage dann
 *    entsprechend vorsichtiger formulieren.
 * ================================================================
 */




const ANOMALY_MARGIN = 1.2;
const UNCERTAINTY_BAND = 0.35; // +/- 35 % um den Schätzwert

/**
 * Signal A — strukturelle Verschwendung:
 * Der Kaufrhythmus ist länger als die Haltbarkeit. Dann geht bei
 * praktisch jedem Zyklus ein Anteil verloren.
 */
function inferChronicWaste(productId, rhythmDays, unitPrice, quantity = 1) {
  const p = byId(productId);
  if (!p || !rhythmDays) return null;
  if (p.category === "Trocken/Vorrat" || p.category === "Tiefkühl") return null;

  // Bei mehreren Einheiten: Haltbarkeit gilt pro Einheit, nicht für den Stapel
  const effectiveShelfLife = p.shelfLifeDays;
  const perUnitRhythm = rhythmDays / Math.max(1, quantity);

  if (perUnitRhythm <= effectiveShelfLife) return null;

  const wastedFraction = Math.min(0.9, (perUnitRhythm - effectiveShelfLife) / perUnitRhythm);
  const centre = unitPrice * quantity * wastedFraction;

  return {
    productId,
    type: "chronic",
    estimated: true,
    quality: p.quality,
    safetyCritical: p.safetyCritical,
    wastedFraction: Math.round(wastedFraction * 100) / 100,
    eurosPerCycle: {
      min: Math.round(centre * (1 - UNCERTAINTY_BAND) * 100) / 100,
      max: Math.round(centre * (1 + UNCERTAINTY_BAND) * 100) / 100,
      mid: Math.round(centre * 100) / 100
    },
    reason: p.safetyCritical
      ? `${p.name} hat ein Verbrauchsdatum und hält nur etwa ${effectiveShelfLife} Tage. ` +
        `Gekauft wird alle ${Math.round(perUnitRhythm)} Tage — die Menge passt nicht zum Verbrauch.`
      : `Rhythmus (alle ${Math.round(perUnitRhythm)} Tage je Einheit) ist länger als die typische ` +
        `Haltbarkeit von ${effectiveShelfLife} Tagen.`
  };
}

/**
 * Signal B — einmalige Ausreißer:
 * Rhythmus ist grundsätzlich unbedenklich, ein einzelner Abstand
 * war aber deutlich zu lang.
 */
function inferAnomalies(productId, purchases, rhythmDays) {
  const p = byId(productId);
  if (!p || !rhythmDays || purchases.length < 2) return [];
  if (p.category === "Trocken/Vorrat" || p.category === "Tiefkühl") return [];

  const out = [];
  for (let i = 1; i < purchases.length; i++) {
    const prev = purchases[i - 1];
    const gap = daysBetween(prev.date, purchases[i].date);
    const qty = prev.quantity || 1;
    const shelfForBatch = p.shelfLifeDays * qty;

    if (gap > shelfForBatch * ANOMALY_MARGIN && gap > rhythmDays) {
      const centre = (prev.unitPrice || 0) * qty;
      out.push({
        productId,
        date: purchases[i].date,
        type: "anomaly",
        estimated: true,
        quality: p.quality,
        safetyCritical: p.safetyCritical,
        euros: {
          min: Math.round(centre * (1 - UNCERTAINTY_BAND) * 100) / 100,
          max: Math.round(centre * (1 + UNCERTAINTY_BAND) * 100) / 100,
          mid: Math.round(centre * 100) / 100
        },
        reason: `${gap} Tage bis zum Nachkauf, üblich sind ${rhythmDays}. ` +
                `Haltbarkeit von ${shelfForBatch} Tagen war überschritten.`
      });
    }
  }
  return out;
}

/** Beide Signale über den ganzen Haushalt. */
function inferWaste(history, rhythms) {
  const byProduct = new Map();
  for (const e of history) {
    if (!byProduct.has(e.productId)) byProduct.set(e.productId, []);
    byProduct.get(e.productId).push(e);
  }

  const chronic = [];
  const anomalies = [];

  for (const [productId, arr] of byProduct.entries()) {
    const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    const r = rhythms.get(productId);
    if (!r || !r.rhythmDays) continue;

    const lastEntry = sorted[sorted.length - 1];
    const c = inferChronicWaste(productId, r.rhythmDays, lastEntry.unitPrice || 0, r.lastQuantity || 1);
    if (c) chronic.push(c);

    anomalies.push(...inferAnomalies(productId, sorted, r.rhythmDays));
  }

  anomalies.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { chronic, anomalies };
}

/**
 * Beide Signale zu EINER Bilanz je Produkt zusammenführen.
 * ================================================================
 * DER FEHLER, DEN DIESE FUNKTION BEHEBT:
 *
 * Vorher wurde in der Oberfläche gerechnet
 *
 *     verdorben = round(chronischerAnteil × Käufe) + Ausreißer
 *
 * und damit derselbe Kauf zweimal gezählt. Der chronische Anteil
 * sagt „bei JEDEM Zyklus geht ein Teil verloren“ — die Ausreißer
 * sagen „dieser eine Zyklus ging ganz verloren“. Ein Ausreißer ist
 * kein zusätzlicher Verlust, sondern ein besonders schlimmer Fall
 * desselben Verlusts.
 *
 * Sichtbar wurde es an einer Quote von 105 %: 21 von 20 Käufen
 * verdorben. Eine Zahl, die es nicht geben kann, in einer App, deren
 * ganzer Wert an der Glaubwürdigkeit ihrer Zahlen hängt. Und es blieb
 * nicht bei der Anzeige — dieselbe Quote steuert das Risiko-Zeichen
 * auf der Liste, die Schwelle der Sparvorschläge und den Eurobetrag.
 *
 * Es ist dieselbe Fehlerklasse wie die zwei teuersten Fehler dieses
 * Projekts (das implizite Signal, die absorbierte Rückmeldung):
 * EIN Ereignis, das über ZWEI Kanäle in dieselbe Summe läuft.
 *
 * DIE RECHNUNG JETZT: je Kauf ein Verlustanteil, und zwar der
 * GRÖSSERE der beiden Schätzungen, nie ihre Summe.
 *
 *     Anteil(Kauf) = max(chronischerAnteil, Ausreißer ? 1 : 0)
 *
 * Damit gilt „verdorben ≤ gekauft“ nicht als Prüfung, die man
 * hinterher anklebt, sondern von der Konstruktion her. Und der
 * Eurobetrag wird mit dem TATSÄCHLICH gezahlten Preis je Kauf
 * gerechnet statt mit dem letzten Preis für alle — das war neben der
 * Doppelzählung die zweite Ungenauigkeit.
 * ================================================================
 *
 * DIE AUSNAHME: WAS DER NUTZER SELBST SAGT.
 * ================================================================
 * Alles hier ist Schätzung — abgeleitet aus Kaufabstand und
 * Haltbarkeit, nie beobachtet. Wenn jemand sagt „den Salat vom 3.8.
 * habe ich aufgegessen“, ist das keine weitere Schätzung, sondern
 * eine Tatsache, und sie schlägt jede Ableitung.
 *
 * ZWEI SIGNALE, ZWEI KORREKTUREN — weil sie Verschiedenes behaupten.
 *
 *   `opts.eaten`      Kaufdaten, zu denen der Nutzer gesagt hat:
 *                     aufgebraucht. Passt zum AUSREISSER, denn der
 *                     behauptet ein konkretes Ereignis an einem
 *                     konkreten Datum („die Packung vom 3.8. ist
 *                     weggekommen“). Dem widerspricht man einzeln.
 *
 *   `opts.noChronic`  Der laufende Anteil ist keine Aussage über
 *                     einen Kauf, sondern über das PRODUKT: „dein
 *                     Rhythmus ist länger als die Haltbarkeit, also
 *                     geht bei jedem Zyklus etwas verloren.“ Dem
 *                     widerspricht man einmal, nicht dreißigmal.
 *
 * Die Trennung ist nicht nur Bequemlichkeit. Beim ersten Anlauf
 * bekam JEDER Kauf eine eigene Zeile mit demselben Anteil — zwölf
 * identische Zeilen „etwa 14 % von 2,49 €“, und wer sagen wollte
 * „bei mir verdirbt kein Brot“, hätte dreißigmal tippen müssen. Eine
 * Korrektur, die so mühsam ist, benutzt niemand, und die Schätzung
 * bliebe unwidersprochen stehen.
 *
 * WAS DIE KORREKTUR AUSDRÜCKLICH NICHT TUT: sie zählt keine
 * Rettung. Eine Schätzung zurückzunehmen ist kein Erfolg, den man
 * feiern könnte — es wird nichts gerettet, es war nur nie verloren.
 * Wer das als Rettung buchte, hätte einen Eurobetrag erfunden und
 * ihn zusätzlich in die Meilensteine gezählt: EIN Ereignis über ZWEI
 * Kanäle, die Fehlerklasse dieses Projekts.
 * ================================================================
 *
 * @param {string} productId
 * @param {Array} purchases Käufe dieses Produkts
 * @param {object|null} chronic Ergebnis aus inferChronicWaste
 * @param {Array} anomalies Ausreißer dieses Produkts
 * @param {object} [opts] `eaten`: Kaufdaten, die der Nutzer als
 *                        aufgebraucht bestätigt hat
 * @returns {{purchased, wasted, wastedEuros, wasteRate, spent, chronic, corrected, details}}
 */
function wasteSummary(productId, purchases, chronic, anomalies, opts = {}) {
  const rows = Array.isArray(purchases) ? purchases : [];
  const anomalyDates = new Set((anomalies || []).map((a) => a.date));
  const eaten = opts.eaten instanceof Set ? opts.eaten : new Set(opts.eaten || []);
  const grundanteil = chronic && !opts.noChronic
    ? Math.max(0, Math.min(1, chronic.wastedFraction))
    : 0;

  let wasted = 0;
  let wastedEuros = 0;
  let spent = 0;
  let corrected = 0;
  const details = [];

  rows.forEach((kauf, i) => {
    const menge = Math.max(1, Number(kauf.quantity) || 1);
    const preis = Math.max(0, Number(kauf.unitPrice) || 0) * menge;
    spent += preis;

    /* Ein Ausreißer ist auf DEM Kauf vermerkt, bis zu dem die Lücke
       zu groß war — verdorben ist aber die Ware davor. Deshalb zählt
       der Kauf als Totalverlust, dessen NACHFOLGER als Ausreißer
       geführt wird. */
    const naechster = rows[i + 1];
    const istAusreisser = !!(naechster && anomalyDates.has(naechster.date));

    const geschaetzt = Math.max(grundanteil, istAusreisser ? 1 : 0);
    /* Die Aussage des Nutzers gilt, nicht die Schätzung. */
    const bestaetigt = eaten.has(kauf.date);
    const anteil = bestaetigt ? 0 : geschaetzt;
    if (bestaetigt && geschaetzt > 0) corrected++;

    wasted += anteil;
    wastedEuros += preis * anteil;

    /* In die Aufstellung kommen nur EINZELNE Ereignisse: Ausreißer
       und was der Nutzer dazu gesagt hat. Der laufende Anteil steht
       nicht drin — er gilt für alle Käufe gleich und wäre eine Reihe
       identischer Zeilen ohne eigene Aussage. */
    if (istAusreisser || bestaetigt) {
      details.push({
        date: kauf.date,
        euros: Math.round(preis * 100) / 100,
        share: Math.round(geschaetzt * 100) / 100,
        anomaly: istAusreisser,
        eaten: bestaetigt
      });
    }
  });

  const purchased = rows.length;
  return {
    purchased,
    // Wie viele Käufe der Nutzer aus der Schätzung herausgenommen hat.
    corrected,
    // Der laufende Anteil, den der Nutzer abgestellt hat — für die
    // Oberfläche, damit sie den Schalter richtig herum zeigt.
    chronicOff: !!opts.noChronic,
    chronicShare: chronic ? Math.max(0, Math.min(1, chronic.wastedFraction)) : 0,
    // Absteigend: der jüngste Verdacht zuerst.
    details: details.sort((a, b) => (a.date < b.date ? 1 : -1)),
    // Auf eine Stelle gerundet: „2,4 von 20“ ist ehrlicher als eine
    // ganze Zahl, die eine Genauigkeit vorspiegelt, die es nicht gibt.
    wasted: Math.round(wasted * 10) / 10,
    wastedEuros: Math.round(wastedEuros * 100) / 100,
    // Die Deckelung kann durch die max-Regel gar nicht mehr greifen.
    // Sie bleibt als letzte Sperre stehen: falls hier je wieder
    // addiert statt verglichen wird, fällt es im Test auf und nicht
    // beim Nutzer.
    wasteRate: purchased ? Math.min(1, wasted / purchased) : 0,
    spent: Math.round(spent * 100) / 100,
    chronic: chronic || null
  };
}

/* HIER STAND `reconcileWithUserInput`.
   Sie filterte Ausreißer-Ereignisse heraus, wenn der Nutzer
   „verbraucht“ oder „hab noch“ gesagt hatte — und wurde nie
   aufgerufen. Die Absicht war richtig und ist jetzt in
   `wasteSummary` eingebaut, dort aber wirksam: als Anteil 0 für den
   betroffenen Kauf, der BEIDE Kanäle abschaltet. Ein gefilterter
   Ausreißer allein hätte den chronischen Anteil stehen lassen. */

/* ===== storageAdvisor.js ===== */
/**
 * storageAdvisor.js — NEU
 * ================================================================
 * Nutzt die Lagerdaten der Datenbank für zwei Hinweise, die keine
 * der untersuchten Konkurrenz-Apps gibt und die messbar Verluste
 * senken -- ohne dass der Nutzer irgendetwas eingeben muss:
 *
 * 1. ETHYLEN-TRENNUNG.
 *    Nachreifende Früchte (Bananen, Äpfel, Tomaten, Avocado) geben
 *    Ethylen ab und lassen nicht-nachreifende Ware (Trauben,
 *    Erdbeeren, Gurken, Zitrusfrüchte, Paprika) schneller verderben.
 *    Quelle: BZfE/BLE, "Lebensmittel richtig lagern", Stand 2025.
 *    Sind auf demselben Einkauf beide Gruppen, ist der Hinweis
 *    konkret und sofort umsetzbar.
 *
 * 2. FALSCHER LAGERORT.
 *    Häufigste Fehler laut BZfE: Brot in den Kühlschrank (trocknet
 *    aus), Tomaten und Kartoffeln in den Kühlschrank (gehören bei
 *    Zimmertemperatur), Basilikum in den Kühlschrank (einzige
 *    Kräuter-Ausnahme).
 *
 * Warum das wichtig ist: Der Nutzer bekommt einen Nutzen, BEVOR
 * die App irgendeinen Rhythmus gelernt hat. Das ist ein Baustein
 * gegen das Cold-Start-Problem aus dem Persona-Bericht.
 * ================================================================
 */



/**
 * Prüft einen Einkauf auf Ethylen-Konflikte.
 * @param {Array<{productId:string}>} items
 */
function checkEthyleneConflicts(items) {
  const producers = [];
  const sensitives = [];

  for (const it of items) {
    const p = byId(it.productId);
    if (!p) continue;
    if (p.ethylene === ETHYLENE.PRODUCER) producers.push(p.name);
    if (p.ethylene === ETHYLENE.SENSITIVE) sensitives.push(p.name);
  }

  if (!producers.length || !sensitives.length) return null;

  return {
    type: "ethylen",
    severity: "info",
    producers: [...new Set(producers)],
    sensitives: [...new Set(sensitives)],
    message:
      `${[...new Set(producers)].join(", ")} getrennt von ` +
      `${[...new Set(sensitives)].join(", ")} lagern — sonst verdirbt die zweite Gruppe schneller.`,
    source: "BZfE/BLE, Lebensmittel richtig lagern, Stand 2025"
  };
}

/**
 * Liefert für jedes Produkt des Einkaufs den korrekten Lagerort,
 * sortiert nach Kühlzone -- als Einräumhilfe direkt nach dem Einkauf.
 */
function buildStorageGuide(items) {
  const zones = new Map();
  for (const it of items) {
    const p = byId(it.productId);
    if (!p) continue;
    if (!zones.has(p.storage)) zones.set(p.storage, []);
    zones.get(p.storage).push({ name: p.name, note: p.note || null });
  }

  // Reihenfolge wie beim Einräumen: zuerst das Kritische
  const order = [
    STORAGE.FRIDGE_BOTTOM, STORAGE.FRIDGE_MIDDLE, STORAGE.FRIDGE_VEG,
    STORAGE.FRIDGE_DOOR, STORAGE.FREEZER, STORAGE.ROOM, STORAGE.PANTRY
  ];

  return order
    .filter((z) => zones.has(z))
    .map((z) => ({ zone: z, items: zones.get(z) }));
}

/**
 * Warnt, wenn ein leicht verderbliches Produkt gekauft wurde, das
 * schnell weggeräumt werden muss. BZfE: liegen Fleisch/Fisch länger
 * in der Wärme, vermehren sich Keime auf der Oberfläche.
 */
function urgentStorageItems(items) {
  return items
    .map((it) => byId(it.productId))
    .filter((p) => p && p.storage === STORAGE.FRIDGE_BOTTOM)
    .map((p) => p.name);
}

/* ===== inventoryEstimator.js ===== */
/**
 * inventoryEstimator.js — NEU (Fundament)
 * ================================================================
 * Schätzt, was wahrscheinlich noch da ist — ohne dass der Nutzer
 * jemals einen Bestand pflegt.
 *
 *   gekauft (aus dem Bon)
 *   − geschätzter Verbrauch (aus dem gelernten Rhythmus)
 *   = wahrscheinlicher Restbestand
 *
 * Genau die manuelle Bestandspflege ist der Punkt, an dem NoWaste
 * und FoodShiner in der Nutzung zusammenbrechen. Hier entsteht der
 * Bestand als Nebenprodukt aus Daten, die ohnehin anfallen.
 *
 * WICHTIG: Das Ergebnis ist eine SCHÄTZUNG mit Vertrauenswert.
 * Es wird nirgends als Gewissheit dargestellt, und bei Produkten
 * mit Verbrauchsdatum wird daraus nie eine Aussage zur Genuss-
 * tauglichkeit abgeleitet.
 * ================================================================
 */




/**
 * Ein echtes Kalenderdatum, nicht bloß die richtige Form.
 *
 * `/\d{4}-\d{2}-\d{2}/` lässt „2026-13-45" durch, und daraus wird
 * eine Restzeit von einigen hundert Tagen — auf einem Produkt mit
 * Verbrauchsdatum. Der Test hat genau das gefunden.
 */
function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Schätzt den Restbestand eines Produkts.
 *
 * @param {object} lastPurchase - {date, quantity, unitPrice}
 * @param {object} rhythm - Ergebnis aus computeRhythm
 * @param {string} today
 */
function estimateRemaining(productId, lastPurchase, rhythm, today, opts = {}) {
  const p = byId(productId);
  if (!p || !lastPurchase) return null;

  const daysSince = daysBetween(lastPurchase.date, today);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;

  const quantity = lastPurchase.quantity || 1;

  // Verbrauch pro Einheit: aus dem Rhythmus, sonst Kategorie-Annahme
  const perUnitDays = rhythm && rhythm.perUnitDays ? rhythm.perUnitDays : null;

  const printed = opts.useBy && opts.useBy[productId];
  const printedValid = isRealDate(printed) && printed >= lastPurchase.date;

  let remainingUnits;
  let basis;
  if (perUnitDays && perUnitDays > 0) {
    const consumed = daysSince / perUnitDays;
    remainingUnits = Math.max(0, quantity - consumed);
    basis = "rhythmus";
  } else if (printedValid) {
    // Auch hier zählt das Etikett und nicht die Katalogzahl. Ohne
    // diesen Zweig verschwand ein Produkt aus dem Bestand, obwohl auf
    // der Packung noch fünf Tage standen — die Anzeige rechnete mit
    // dem aufgedruckten Datum, die Frage „ist es überhaupt noch da?"
    // aber weiter mit der Schätzung.
    remainingUnits = today <= printed ? quantity : 0;
    basis = "aufgedruckt";
  } else {
    // Ohne Rhythmus: nur die Haltbarkeit als grobe Schranke
    remainingUnits = daysSince < p.shelfLifeDays ? quantity : 0;
    basis = "haltbarkeit";
  }

  /* Restzeit bis Ablauf.
   *
   * Vorrang hat IMMER das aufgedruckte Datum, wenn es eingetragen
   * wurde. Das ist keine Feinheit: die Katalogzahl ist eine
   * Lagerempfehlung an der unteren Grenze, das Etikett dagegen die
   * Aussage des Herstellers für genau diese Packung. Bei einem
   * Verbrauchsdatum ist es zusätzlich die rechtlich maßgebliche
   * Angabe — nach ihrem Ablauf gehört das Produkt in den Abfall,
   * egal was eine App schätzt.
   *
   * Das aufgedruckte Datum darf dabei in beide Richtungen wirken. Es
   * zu deckeln („höchstens so lange wie geschätzt") klänge vorsichtig,
   * wäre aber Unfug: dann zeigte die App weiter ihre Schätzung und
   * ignorierte die Packung, die der Nutzer in der Hand hält. */
  const daysLeft = printedValid
    ? daysBetween(today, printed)
    : p.shelfLifeDays - daysSince;

  // Vertrauen: hoher Rhythmus-Vertrauenswert und kurze Zeit seit Kauf
  const rhythmConfidence = rhythm ? rhythm.confidence : 0;
  const timeDecay = Math.max(0, 1 - daysSince / Math.max(1, p.shelfLifeDays * 2));
  const confidence = Math.round(rhythmConfidence * timeDecay * 100) / 100;

  return {
    productId,
    name: p.name,
    remainingUnits: Math.round(remainingUnits * 100) / 100,
    likelyPresent: remainingUnits > 0.15 && daysLeft > -1,
    daysLeft,
    expired: daysLeft < 0,
    safetyCritical: p.safetyCritical,
    value: Math.round(remainingUnits * (lastPurchase.unitPrice || p.typicalPrice || 0) * 100) / 100,
    weightG: Math.round(remainingUnits * (p.typicalWeightG || 0)),
    confidence,
    basis,
    // Wer das Etikett eingetragen hat, bekommt keine Schätzung mehr
    // angezeigt, sondern eine Tatsache — und die Oberfläche sagt das.
    dateSource: printedValid ? "aufgedruckt" : "geschaetzt",
    useBy: printedValid ? printed : null,
    estimated: true
  };
}

/**
 * Schätzt den kompletten Haushaltsbestand.
 * @returns {Array} nur Produkte, die wahrscheinlich noch da sind
 */
function estimateInventory(history, rhythms, today, opts = {}) {
  const lastByProduct = new Map();
  for (const h of history) {
    const prev = lastByProduct.get(h.productId);
    if (!prev || h.date > prev.date) lastByProduct.set(h.productId, h);
  }

  const inventory = [];
  for (const [productId, last] of lastByProduct.entries()) {
    const est = estimateRemaining(productId, last, rhythms.get(productId), today, opts);
    if (est && est.likelyPresent) inventory.push(est);
  }

  return inventory.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Bestand im Format, das recipeMatcher erwartet. */
function toRecipeStock(inventory) {
  return inventory.map((i) => ({
    productId: i.productId,
    daysLeft: i.daysLeft,
    price: i.value
  }));
}

/* ===== coldStart.js ===== */
/**
 * coldStart.js — NEU
 * Persona-Anforderung: Business Angel ("Was liefert Tag eins?")
 * ================================================================
 * Das Problem: In den ersten drei bis vier Wochen kennt das System
 * keine Rhythmen. Ohne Antwort darauf springen laut Angel 70–90 %
 * der Nutzer in Woche eins ab.
 *
 * Die Lösung in drei Stufen, je nach Datenlage:
 *
 *   Stufe 0 (0 Bons): Es gibt noch nichts zu rechnen. Wert entsteht
 *     nur über den Lagerberater (Ethylen, Kühlzonen) — der braucht
 *     keine Historie.
 *   Stufe 1 (1 Bon): Ausgabenstruktur, Jahreshochrechnung, die
 *     teuersten Positionen. Sofort, ohne Rhythmus.
 *   Stufe 2 (2+ Bons, noch kein sicherer Rhythmus): Vorschläge auf
 *     Basis von KATEGORIE-STANDARDRHYTHMEN statt individueller
 *     Historie — klar als Annahme gekennzeichnet.
 *   Stufe 3 (genug Historie): normale individuelle Berechnung.
 *
 * Die Standardrhythmen unten sind Annahmen für einen Zwei-Personen-
 * Haushalt und ausdrücklich Startwerte, keine Messwerte. Sie werden
 * durch die individuelle Historie ersetzt, sobald diese verlässlich
 * genug ist.
 * ================================================================
 */



// Startwerte je Kategorie (Tage), Annahme Zwei-Personen-Haushalt
const CATEGORY_DEFAULT_RHYTHM = {
  "Milchprodukte": 7,
  "Backwaren": 4,
  "Frischware": 7,
  "Fleisch/Fisch": 7,
  "Wurstwaren": 10,
  "Trocken/Vorrat": 28,
  "Getränke": 10,
  "Tiefkühl": 21,
  "Süßes/Snacks": 14,
  "Haushalt": 30
};

/** Welche Stufe gilt bei dieser Datenlage? */
function determineStage(history, rhythms) {
  const receipts = new Set(history.map((h) => h.date)).size;
  if (receipts === 0) return { stage: 0, receipts, label: "noch kein Einkauf erfasst" };
  if (receipts === 1) return { stage: 1, receipts, label: "erster Bon" };

  const reliable = [...rhythms.values()].filter((r) => r.confidence >= 0.4 && r.rhythmDays).length;
  if (reliable < 3) return { stage: 2, receipts, label: "Annahmen statt Historie", reliable };
  return { stage: 3, receipts, label: "individuelle Historie", reliable };
}

/**
 * Stufe 1: Sofortwert aus einem einzigen Bon.
 * Kein Rhythmus nötig — nur Struktur und Hochrechnung.
 */
function firstReceiptInsights(receiptItems) {
  const total = receiptItems.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);

  const byCat = new Map();
  for (const item of receiptItems) {
    const p = byId(item.productId);
    if (!p) continue;
    const spend = (item.unitPrice || 0) * (item.quantity || 1);
    byCat.set(p.category, (byCat.get(p.category) || 0) + spend);
  }

  const categories = [...byCat.entries()]
    .map(([name, spend]) => ({ name, spend: Math.round(spend * 100) / 100,
      share: total > 0 ? Math.round((spend / total) * 100) : 0 }))
    .sort((a, b) => b.spend - a.spend);

  const expensive = receiptItems
    .map((i) => ({ ...i, spend: (i.unitPrice || 0) * (i.quantity || 1), product: byId(i.productId) }))
    .filter((i) => i.product)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3)
    .map((i) => ({ name: i.product.name, spend: Math.round(i.spend * 100) / 100 }));

  const foodOnly = receiptItems.filter((i) => { const p = byId(i.productId); return p && p.isFood; });
  const foodSpend = foodOnly.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);

  return {
    total: Math.round(total * 100) / 100,
    foodSpend: Math.round(foodSpend * 100) / 100,
    yearProjection: Math.round(total * 52),
    categories,
    expensive,
    positions: receiptItems.length,
    hint: "Hochrechnung setzt voraus, dass dieser Einkauf typisch für eine Woche ist."
  };
}

/**
 * Stufe 2: Vorschläge aus Kategorie-Standardrhythmen.
 * Nur für Produkte, die der Haushalt schon einmal gekauft hat —
 * die App erfindet keine Produkte, die nie im Korb waren.
 */
function assumptionBasedSuggestions(history, today, householdSize = 2) {
  const lastPurchase = new Map();
  for (const h of history) {
    const prev = lastPurchase.get(h.productId);
    if (!prev || h.date > prev.date) lastPurchase.set(h.productId, h);
  }

  const out = [];
  for (const [productId, entry] of lastPurchase.entries()) {
    const p = byId(productId);
    if (!p || !p.isFood) continue;

    const base = CATEGORY_DEFAULT_RHYTHM[p.category] || 14;
    // Größerer Haushalt verbraucht schneller
    const scaled = Math.max(2, Math.round(base * (2 / Math.max(1, householdSize))));
    const daysSince = Math.round((new Date(today) - new Date(entry.date)) / 86400000);

    if (daysSince >= scaled) {
      out.push({
        productId, name: p.name, category: p.category, aisle: p.aisle,
        price: p.typicalPrice, daysSince,
        rhythmDays: scaled,
        confidence: 0,
        basis: "annahme",
        explanation: `Angenommener Rhythmus für ${p.category} (${scaled} Tage). ` +
                     `Wird durch deine echten Kaufabstände ersetzt, sobald genug Historie da ist.`
      });
    }
  }
  return out.sort((a, b) => b.daysSince - a.daysSince);
}

/* ===== budgetOptimizer.js ===== */
/**
 * budgetOptimizer.js — NEU
 * Persona-Anforderung: Katrin, 38, alleinerziehend, zwei Kinder
 * ("Diese App rechnet mit einem Budget, das ich nicht habe.")
 * ================================================================
 * Aufgabe: Wenn die vorgeschlagene Liste über dem Wochenbudget
 * liegt, soll die App kürzen — nicht der Mensch.
 *
 * Die Reihenfolge, in der gestrichen wird, ist eine Wertentscheidung,
 * keine reine Rechnung. Deshalb ist sie hier ausdrücklich benannt
 * und nicht in einer Formel versteckt:
 *
 *   1. Zuerst raus: Produkte mit hoher Verschwendungsquote.
 *      Das spart Geld, ohne dass tatsächlich weniger gegessen wird.
 *   2. Dann: Süßes, Snacks, Alkohol.
 *   3. Dann: teure Frischware, die ersetzt werden kann.
 *   4. NIEMALS gestrichen: Grundnahrungsmittel (siehe ESSENTIALS).
 *      Eine App, die einem Haushalt mit knappem Budget das Brot
 *      streicht, hat ihren Zweck verfehlt.
 *
 * Zusätzlich: statt nur zu streichen, werden Alternativen
 * vorgeschlagen (kleinere Menge, günstigeres Produkt derselben
 * Kategorie).
 * ================================================================
 */



// Diese Kategorien und Produkte werden nie automatisch gestrichen
const ESSENTIAL_CATEGORIES = new Set(["Backwaren", "Milchprodukte"]);
const ESSENTIAL_IDS = new Set([
  "brot_vollkorn", "brot_mischbrot", "toastbrot", "milch_vollmilch",
  "milch_fettarm", "eier", "nudeln", "reis", "kartoffeln", "mehl", "butter"
]);

// Reihenfolge des Streichens: höherer Wert = fliegt früher raus
const CUT_PRIORITY = {
  "Süßes/Snacks": 100,
  "Getränke": 80,      // Alkohol und Limonade zuerst
  "Tiefkühl": 50,
  "Wurstwaren": 45,
  "Fleisch/Fisch": 40,
  "Frischware": 30,
  "Trocken/Vorrat": 20,
  "Haushalt": 15,
  "Milchprodukte": 10,
  "Backwaren": 5
};

const isEssential = (item) =>
  ESSENTIAL_IDS.has(item.productId) ||
  (ESSENTIAL_CATEGORIES.has(item.category) && (item.price || 0) < 3);

/**
 * Kürzt die Liste auf das Budget.
 *
 * @param {Array} items - Vorschlagsliste mit price, category, wasteRate
 * @param {number} budget - Wochenbudget in Euro
 * @returns {{kept, removed, halved, total, savedByHalving, withinBudget, advice}}
 */
function fitToBudget(items, budget) {
  const working = items.map((i) => ({ ...i, halved: false }));
  const sum = (list) => list.reduce((s, i) => s + (i.halved ? i.price / 2 : i.price), 0);

  if (!budget || sum(working) <= budget) {
    return {
      kept: working, removed: [], halved: [],
      total: Math.round(sum(working) * 100) / 100,
      savedByHalving: 0, withinBudget: true,
      advice: "Liste passt ins Budget."
    };
  }

  const halved = [];
  const removed = [];

  // Schritt 1: Produkte mit hoher Verschwendungsquote halbieren statt streichen.
  // Spart Geld, ohne dass weniger gegessen wird.
  const wasteful = working
    .filter((i) => (i.wasteRate || 0) >= 0.25 && i.price >= 1)
    .sort((a, b) => (b.wasteRate || 0) - (a.wasteRate || 0));

  for (const item of wasteful) {
    if (sum(working) <= budget) break;
    item.halved = true;
    halved.push(item);
  }
  const savedByHalving = halved.reduce((s, i) => s + i.price / 2, 0);

  // Schritt 2: nach Streichreihenfolge entfernen, Grundnahrung bleibt
  const cutOrder = working
    .filter((i) => !isEssential(i))
    .sort((a, b) => {
      const pa = CUT_PRIORITY[a.category] || 25;
      const pb = CUT_PRIORITY[b.category] || 25;
      if (pb !== pa) return pb - pa;
      return b.price - a.price; // innerhalb der Gruppe: teuerstes zuerst
    });

  for (const item of cutOrder) {
    if (sum(working.filter((i) => !removed.includes(i))) <= budget) break;
    removed.push(item);
  }

  const kept = working.filter((i) => !removed.includes(i));
  const total = sum(kept);

  let advice;
  if (total <= budget) {
    const parts = [];
    if (halved.length) parts.push(`${halved.length} Position${halved.length > 1 ? "en" : ""} halbiert`);
    if (removed.length) parts.push(`${removed.length} gestrichen`);
    advice = `Passt jetzt: ${parts.join(", ")}.`;
  } else {
    advice = "Auch nach dem Kürzen über Budget — Grundnahrungsmittel bleiben bewusst auf der Liste.";
  }

  return {
    kept, removed, halved,
    total: Math.round(total * 100) / 100,
    savedByHalving: Math.round(savedByHalving * 100) / 100,
    withinBudget: total <= budget,
    advice
  };
}

/**
 * Sucht günstigere Alternativen in derselben Kategorie.
 * Kein Streichen, sondern Tauschen — Katrins eigentlicher Wunsch.
 */
function cheaperAlternatives(item, maxSuggestions = 2) {
  const p = byId(item.productId);
  if (!p) return [];
  return byCategory(p.category)
    .filter((c) => c.id !== p.id && c.typicalPrice < p.typicalPrice * 0.8 && c.isFood)
    .sort((a, b) => a.typicalPrice - b.typicalPrice)
    .slice(0, maxSuggestions)
    .map((c) => ({
      productId: c.id, name: c.name, price: c.typicalPrice,
      saving: Math.round((p.typicalPrice - c.typicalPrice) * 100) / 100
    }));
}

/* ===== recipeMatcher.js ===== */
/**
 * recipeMatcher.js — NEU
 * Persona-Anforderung: Timo, 29, Single, kocht selten, bestellt oft
 * ("Du hast Hähnchen im Kühlschrank, das morgen abläuft. Koch das,
 *   statt zu bestellen.")
 * ================================================================
 * Der wertvollste Moment für dieses Produkt ist nicht die Planung,
 * sondern der Abend, an dem sonst bestellt würde. Deshalb sortiert
 * dieses Modul NICHT nach "was schmeckt gut", sondern nach
 * "was rettet den größten Betrag, der sonst verdirbt".
 *
 * Bewusst KEINE Nährwerte, keine Kalorien, keine Bewertung von
 * Lebensmitteln — siehe Persona-Bericht (Ernährungsberaterin und
 * Ronny unabhängig voneinander): beim Geld bleiben, nicht beim Körper.
 * ================================================================
 */



/**
 * Rezepte als Zutatenlisten. `core` sind die tragenden Zutaten,
 * `optional` verbessert das Ergebnis, ist aber nicht nötig.
 * Bewusst einfache Alltagsgerichte, keine Kochkunst.
 */
const RECIPES = [
  { id:"nudeln_tomate", name:"Nudeln mit Tomatensauce", minutes:20,
    core:["nudeln","konserve_tomaten"], optional:["zwiebeln","knoblauch","parmesan","basilikum"] },
  { id:"pasta_pesto", name:"Pasta mit Pesto", minutes:15,
    core:["nudeln","pesto"], optional:["parmesan","tomaten"] },
  { id:"haehnchen_reis", name:"Hähnchen mit Reis und Gemüse", minutes:30,
    core:["haehnchen","reis"], optional:["paprika","zwiebeln","brokkoli","sojasauce"] },
  { id:"haehnchen_pfanne", name:"Hähnchen-Gemüse-Pfanne", minutes:25,
    core:["haehnchen","paprika"], optional:["zucchini","zwiebeln","sojasauce","reis"] },
  { id:"omelett", name:"Omelett mit Käse", minutes:10,
    core:["eier"], optional:["kaese_gouda","kraeuter","champignons","tomaten"] },
  { id:"ruehrei_brot", name:"Rührei auf Brot", minutes:10,
    core:["eier","brot_vollkorn"], optional:["butter","schnittlauch","kraeuter"] },
  { id:"salat_feta", name:"Salat mit Feta", minutes:15,
    core:["salat_kopf","feta"], optional:["tomaten","gurke","oliven","oel_oliven"] },
  { id:"gemuesesuppe", name:"Gemüsesuppe", minutes:35,
    core:["moehren","kartoffeln"], optional:["lauch","sellerie","bruehe","zwiebeln"] },
  { id:"kartoffelgratin", name:"Kartoffelgratin", minutes:60,
    core:["kartoffeln","sahne"], optional:["kaese_reibe","knoblauch"] },
  { id:"bratkartoffeln", name:"Bratkartoffeln mit Ei", minutes:30,
    core:["kartoffeln","eier"], optional:["zwiebeln","bacon","kraeuter"] },
  { id:"linsensuppe", name:"Linsensuppe", minutes:40,
    core:["linsen","moehren"], optional:["kartoffeln","zwiebeln","bruehe","wiener"] },
  { id:"chili", name:"Chili sin Carne", minutes:35,
    core:["konserve_bohnen","konserve_tomaten"], optional:["konserve_mais","paprika","zwiebeln","reis"] },
  { id:"bolognese", name:"Bolognese", minutes:40,
    core:["hackfleisch","konserve_tomaten"], optional:["nudeln","zwiebeln","moehren","parmesan"] },
  { id:"auflauf_gemuese", name:"Gemüseauflauf", minutes:45,
    core:["zucchini","kaese_reibe"], optional:["kartoffeln","sahne","tomaten","paprika"] },
  { id:"risotto", name:"Risotto", minutes:35,
    core:["risottoreis","bruehe"], optional:["champignons","parmesan","zwiebeln","wein"] },
  { id:"couscous_salat", name:"Couscous-Salat", minutes:20,
    core:["couscous","gurke"], optional:["tomaten","feta","zitronen","kraeuter"] },
  { id:"kaesebrot", name:"Überbackenes Käsebrot", minutes:12,
    core:["brot_mischbrot","kaese_gouda"], optional:["tomaten","butter","kraeuter"] },
  { id:"pfannkuchen", name:"Pfannkuchen", minutes:25,
    core:["mehl","eier","milch_vollmilch"], optional:["zucker","marmelade"] },
  { id:"milchreis", name:"Milchreis", minutes:35,
    core:["reis","milch_vollmilch"], optional:["zucker","zimt","tk_beeren"] },
  { id:"porridge", name:"Porridge", minutes:10,
    core:["haferflocken","milch_vollmilch"], optional:["bananen","honig","nuesse","heidelbeeren"] },
  { id:"quark_obst", name:"Quark mit Obst", minutes:5,
    core:["quark"], optional:["bananen","heidelbeeren","honig","haferflocken"] },
  { id:"tomatensuppe", name:"Tomatensuppe", minutes:25,
    core:["konserve_tomaten","bruehe"], optional:["sahne","zwiebeln","basilikum","brot_weiss"] },
  { id:"wraps_gemuese", name:"Gemüse-Wraps", minutes:20,
    core:["wraps","paprika"], optional:["frischkaese","salat_kopf","haehnchen","mais"] },
  { id:"fisch_ofen", name:"Ofenfisch mit Gemüse", minutes:35,
    core:["fisch_weiss","zitronen"], optional:["kartoffeln","zucchini","oel_oliven","kraeuter"] },
  { id:"kaiserschmarrn", name:"Kaiserschmarrn", minutes:25,
    core:["mehl","eier","milch_vollmilch"], optional:["zucker","rosinen","puderzucker"] },
  { id:"gemuesecurry", name:"Gemüsecurry", minutes:30,
    core:["kokosmilch","reis"], optional:["paprika","zucchini","zwiebeln","gewuerze","kichererbsen"] }
];

/**
 * Findet Rezepte, die zum Bestand passen.
 *
 * SICHERHEITSSPERRE (im Stresstest gefunden):
 * Eine frühere Fassung schlug vor, mit zwei Tage abgelaufenem
 * Hackfleisch Bolognese zu kochen — und rahmte das als "rettet
 * 4,99 €". Produkte mit Verbrauchsdatum (Hackfleisch, Geflügel,
 * roher Fisch, geschnittener Salat) gehören laut BZfE nach Ablauf
 * in den Müll, weil sie Keime enthalten können, die man weder
 * sieht noch riecht noch schmeckt. Solche Zutaten werden vor der
 * Rezeptsuche ausgeschlossen und gesondert gemeldet.
 *
 * @param {Array<{productId:string, daysLeft:number, price:number}>} stock
 * @param {object} opts
 * @returns {{recipes:Array, unsafe:Array}} oder bei opts.legacyArray=true nur recipes
 */
function suggestRecipes(stock, opts = {}) {
  const maxResults = opts.maxResults || 5;
  const urgentDays = opts.urgentDays ?? 3;
  const safeStock = [];
  const unsafe = [];

  for (const s of stock || []) {
    const p = byId(s.productId);
    if (!p) continue;
    if (p.safetyCritical && s.daysLeft !== undefined && s.daysLeft < 0) {
      unsafe.push({
        productId: s.productId,
        name: p.name,
        daysOverdue: Math.abs(s.daysLeft),
        message: `${p.name}: Verbrauchsdatum seit ${Math.abs(s.daysLeft)} Tag(en) überschritten. ` +
                 `Laut BZfE nicht mehr verwenden — auch nicht durchgegart.`
      });
      continue;
    }
    safeStock.push(s);
  }

  const stockMap = new Map();
  safeStock.forEach((s) => stockMap.set(s.productId, s));

  const results = [];

  for (const recipe of RECIPES) {
    const haveCore = recipe.core.filter((id) => stockMap.has(id));
    const missingCore = recipe.core.filter((id) => !stockMap.has(id));

    // Nur Rezepte, bei denen höchstens eine Kernzutat fehlt
    if (missingCore.length > 1) continue;

    const haveOptional = recipe.optional.filter((id) => stockMap.has(id));

    const used = [...haveCore, ...haveOptional];
    const urgent = used.filter((id) => {
      const s = stockMap.get(id);
      return s && s.daysLeft !== undefined && s.daysLeft <= urgentDays;
    });

    const rescuedValue = urgent.reduce((sum, id) => {
      const s = stockMap.get(id);
      const value = s.price !== undefined ? s.price : (byId(id)?.typicalPrice || 0);
      return sum + Math.max(0, value);
    }, 0);

    const minDaysLeft = used.reduce((min, id) => {
      const s = stockMap.get(id);
      return s && s.daysLeft !== undefined ? Math.min(min, s.daysLeft) : min;
    }, 99);

    results.push({
      recipeId: recipe.id,
      name: recipe.name,
      minutes: recipe.minutes,
      usesFromStock: used.map((id) => byId(id)?.name || id),
      urgentItems: urgent.map((id) => byId(id)?.name || id),
      missing: missingCore.map((id) => byId(id)?.name || id),
      complete: missingCore.length === 0,
      rescuedValue: Math.round(rescuedValue * 100) / 100,
      minDaysLeft,
      score: rescuedValue * 10 + haveOptional.length + (missingCore.length === 0 ? 5 : 0)
    });
  }

  const recipes = results.sort((a, b) => b.score - a.score).slice(0, maxResults);

  // Rückwärtskompatibel: ohne Zutaten-Warnung wird wie bisher ein
  // Array zurückgegeben, damit bestehender Code weiterläuft.
  if (unsafe.length === 0) return recipes;

  recipes.unsafeIngredients = unsafe;
  return recipes;
}

/**
 * Der Moment, auf den es ankommt: Vergleich mit Bestellen.
 * Zahlen bewusst als Annahme gekennzeichnet, nicht als Messung.
 */
function compareWithDelivery(recipe, assumedDeliveryCost = 24) {
  return {
    recipe: recipe.name,
    minutes: recipe.minutes,
    rescuedValue: recipe.rescuedValue,
    assumedDeliveryCost,
    note: `Kochen nutzt ${recipe.rescuedValue.toFixed(2).replace(".", ",")} € Ware, die sonst verdirbt. ` +
          `Der Lieferwert von ${assumedDeliveryCost} € ist eine Annahme, kein gemessener Wert.`
  };
}

/* ===== householdSplit.js ===== */
/**
 * householdSplit.js — NEU
 * Persona-Anforderung: Lena, 24, WG mit vier Personen
 * ("Ist das eine Sparapp oder eine Splitwise-Alternative? Weil das
 *   zweite würde ich sofort installieren.")
 * ================================================================
 * Zwei Dinge, die der Entwurf bisher nicht konnte:
 *
 * 1. ZUORDNUNG. Ein Bon enthält Gemeinsames und Privates in einer
 *    Liste. Ohne Trennung ist weder die Abrechnung fair noch die
 *    Verschwendungsstatistik brauchbar.
 *
 * 2. ABRECHNUNG. Wer hat wie viel ausgelegt, wer schuldet wem was.
 *    Der Ausgleich wird auf möglichst WENIGE Überweisungen
 *    reduziert — niemand will sechs Kleinbeträge hin- und
 *    herschieben.
 *
 * Zusätzlich: Verschwendung bekommt einen Namen. In einer WG
 * verdirbt Essen anonym, weil sich niemand zuständig fühlt.
 * ================================================================
 */



const SPLIT_MODE = { SHARED: "gemeinsam", PRIVATE: "privat" };

/**
 * Ordnet Bon-Positionen zu.
 * @param {Array} receiptItems
 * @param {object} assignment - { [productId]: {mode, person} }
 * @param {string} payer - wer bezahlt hat
 */
function assignItems(receiptItems, assignment, payer) {
  return receiptItems.map((item) => {
    const rule = assignment[item.productId] || { mode: SPLIT_MODE.SHARED };
    return {
      ...item,
      splitMode: rule.mode,
      owner: rule.mode === SPLIT_MODE.PRIVATE ? (rule.person || payer) : null,
      payer,
      total: (item.unitPrice || 0) * (item.quantity || 1)
    };
  });
}

/**
 * Berechnet, wer wem wie viel schuldet.
 *
 * Gerechnet wird durchgehend in CENT als Ganzzahl. Im Stresstest
 * summierten sich die Salden bei Fließkommarechnung um bis zu zwei
 * Cent nicht auf null — in einer WG-Abrechnung genau die Sorte
 * Fehler, über die gestritten wird.
 *
 * Bei nicht glatt teilbaren Beträgen (10 Cent durch 3 Personen)
 * werden die Restcent deterministisch auf die ersten Mitglieder
 * verteilt, statt sie wegzurunden. Dadurch stimmt die Summe exakt.
 *
 * @param {Array} assignedItems - Ergebnis von assignItems
 * @param {Array<string>} members - alle Mitbewohner
 */
function computeBalances(assignedItems, members) {
  if (!members || members.length === 0) return {};

  const cents = new Map(members.map((m) => [m, 0]));
  const add = (person, value) => {
    if (!cents.has(person)) return false; // Unbekannte Person ignorieren
    cents.set(person, cents.get(person) + value);
    return true;
  };

  for (const item of assignedItems) {
    const costCents = Math.round((item.total || 0) * 100);
    if (!Number.isFinite(costCents) || costCents === 0) continue;

    // Zahler muss Mitglied sein, sonst lässt sich nichts zuordnen
    if (!cents.has(item.payer)) continue;

    if (item.splitMode === SPLIT_MODE.SHARED) {
      const base = Math.floor(costCents / members.length);
      let remainder = costCents - base * members.length;
      members.forEach((m, idx) => {
        const share = base + (idx < remainder ? 1 : 0);
        add(m, -share);
      });
      add(item.payer, costCents);
    } else {
      // Privat: Besitzer trägt die Kosten. Unbekannter Besitzer
      // fällt auf den Zahler zurück, damit die Summe stimmt.
      const owner = cents.has(item.owner) ? item.owner : item.payer;
      if (owner !== item.payer) {
        add(item.payer, costCents);
        add(owner, -costCents);
      }
    }
  }

  const result = {};
  for (const [m, v] of cents.entries()) result[m] = v / 100;
  return result;
}

/**
 * Minimiert die Zahl der nötigen Überweisungen.
 * Greedy: größter Schuldner zahlt an größten Gläubiger, bis alles
 * ausgeglichen ist. Nicht immer das theoretische Optimum, aber
 * nachvollziehbar und in der Praxis nah dran.
 *
 * Gerechnet wird in CENT als Ganzzahl. Mit Euro-Fließkommazahlen
 * entstand sonst ein Rundungsrest: die Summe der Überweisungen
 * stimmte um einen Cent nicht mit dem Saldo überein -- in einer
 * WG-Abrechnung genau die Sorte Fehler, die Vertrauen kostet.
 */
function settleUp(balances) {
  const creditors = [];
  const debtors = [];
  for (const [person, amount] of Object.entries(balances)) {
    const cents = Math.round(amount * 100);
    if (cents > 0) creditors.push({ person, cents });
    else if (cents < 0) debtors.push({ person, cents: -cents });
  }
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const transfers = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cents = Math.min(creditors[ci].cents, debtors[di].cents);
    if (cents > 0) {
      transfers.push({
        from: debtors[di].person,
        to: creditors[ci].person,
        amount: cents / 100
      });
    }
    creditors[ci].cents -= cents;
    debtors[di].cents -= cents;
    if (creditors[ci].cents === 0) ci++;
    if (debtors[di].cents === 0) di++;
  }
  return transfers;
}

/**
 * Verschwendung mit Zuständigkeit: In einer WG verdirbt Essen
 * anonym. Diese Zuordnung macht sichtbar, wessen Vorrat es war --
 * bewusst neutral formuliert, ohne Schuldzuweisung.
 */
function attributeWaste(wasteEvents, assignedItems) {
  const ownerByProduct = new Map();
  for (const item of assignedItems) {
    if (item.splitMode === SPLIT_MODE.PRIVATE && item.owner) {
      ownerByProduct.set(item.productId, item.owner);
    }
  }

  return wasteEvents.map((e) => ({
    ...e,
    attributedTo: ownerByProduct.get(e.productId) || "gemeinsam",
    productName: byId(e.productId)?.name || e.productId
  }));
}

/** Was bald abläuft, mit Zuständigkeit -- der eigentliche WG-Nutzen. */
function expiringWithOwner(stock, assignedItems, withinDays = 3) {
  const ownerByProduct = new Map();
  for (const item of assignedItems) {
    if (item.splitMode === SPLIT_MODE.PRIVATE && item.owner) {
      ownerByProduct.set(item.productId, item.owner);
    }
  }

  return stock
    .filter((s) => s.daysLeft !== undefined && s.daysLeft <= withinDays)
    .map((s) => ({
      productId: s.productId,
      name: byId(s.productId)?.name || s.productId,
      daysLeft: s.daysLeft,
      owner: ownerByProduct.get(s.productId) || "gemeinsam",
      message: ownerByProduct.has(s.productId)
        ? `${byId(s.productId)?.name} von ${ownerByProduct.get(s.productId)} läuft in ${s.daysLeft} Tagen ab.`
        : `${byId(s.productId)?.name} (gemeinsam) läuft in ${s.daysLeft} Tagen ab.`
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ===== impactMetrics.js ===== */
/**
 * impactMetrics.js — NEU
 * Persona-Anforderung: Impact-Investorin
 * ("Kilogramm vermiedener Abfall, nicht nur Euro. Und: wirkt die
 *   App, oder zieht sie nur Leute an, die schon sparsam sind?")
 * ================================================================
 * Was dieses Modul liefert:
 *   - Verschwendung in Kilogramm statt nur in Euro
 *   - Vergleich mit dem statistischen Referenzwert
 *   - Vorher/Nachher-Auswertung ab Nutzungsbeginn
 *
 * Was dieses Modul NICHT liefert und auch nicht vortäuscht:
 *   - CO2-Werte. Belastbare Emissionsfaktoren je Lebensmittel
 *     brauchen eine geprüfte Datenbasis; eine erfundene Zahl wäre
 *     hier schlimmer als keine.
 *   - Kausalität. Ein Vorher/Nachher-Vergleich in einem Haushalt
 *     ist kein Wirkungsnachweis. Für die Aussage "die App wirkt"
 *     braucht es die Vergleichsgruppe, die die Investorin
 *     ausdrücklich gefordert hat. Das steht unten als Feld
 *     `evidenceLevel` ehrlich drin.
 *
 * Referenzwerte (extern, mit Quelle):
 *   - Über 70 kg Lebensmittel pro Kopf und Jahr in privaten
 *     Haushalten weggeworfen; mehr als ein Drittel davon, weil es
 *     verdorben ist. Quelle: BZfE/BLE, Lebensmittel richtig lagern,
 *     Stand 20.02.2025.
 *   - Eine vierköpfige Familie kann laut einer forsa-Studie bis zu
 *     940 Euro pro Jahr sparen, wenn nichts in der Tonne landet.
 *     Quelle: ebenda (BZfE zitiert forsa).
 * ================================================================
 */



const REFERENCE = {
  kgPerPersonPerYear: 70,
  shareSpoiled: 0.33,
  forsaMaxSavingFamily4PerYear: 940,
  source: "BZfE/BLE, Lebensmittel richtig lagern, Stand 20.02.2025 (forsa-Studie zitiert)"
};

/**
 * Rechnet geschätzte Verschwendung von Euro in Kilogramm um.
 * Grundlage ist das typische Produktgewicht aus der Datenbank.
 */
function wasteInKilograms(wasteEvents) {
  let grams = 0;
  const byProduct = new Map();

  for (const e of wasteEvents) {
    const p = byId(e.productId);
    if (!p || !p.isFood) continue;

    // Anteil und Zyklen gegen unsinnige Werte absichern.
    // Im Stresstest erzeugten negative Anteile ein negatives
    // Verschwendungsgewicht -- eine Zahl, die es physisch nicht
    // geben kann und die jede Wirkungsaussage entwertet.
    const rawFraction = e.wastedFraction !== undefined ? e.wastedFraction : 1;
    const fraction = Number.isFinite(rawFraction) ? Math.min(1, Math.max(0, rawFraction)) : 0;
    const rawCycles = e.cycles === undefined ? 1 : e.cycles;
    const cycles = Number.isFinite(rawCycles) ? Math.max(0, rawCycles) : 0;

    const g = (p.typicalWeightG || 0) * fraction * cycles;
    if (!Number.isFinite(g) || g <= 0) continue;
    grams += g;

    byProduct.set(p.name, Math.round((byProduct.get(p.name) || 0) + g));
  }

  return {
    kg: Math.round((grams / 1000) * 100) / 100,
    grams: Math.round(grams),
    byProduct: [...byProduct.entries()]
      .map(([name, g]) => ({ name, kg: Math.round((g / 1000) * 100) / 100 }))
      .sort((a, b) => b.kg - a.kg),
    estimated: true
  };
}

/**
 * Ordnet den eigenen Wert in den statistischen Rahmen ein.
 * Bewusst ohne Wertung ("du bist schlechter als der Durchschnitt"),
 * weil das laut Persona-Bericht zum Deinstallieren führt.
 */
function compareToReference(kgPerYear, householdSize = 2) {
  const referenceSpoiled = REFERENCE.kgPerPersonPerYear * REFERENCE.shareSpoiled * householdSize;
  const ratio = referenceSpoiled > 0 ? kgPerYear / referenceSpoiled : 0;

  return {
    ownKgPerYear: Math.round(kgPerYear * 10) / 10,
    referenceKgPerYear: Math.round(referenceSpoiled * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    householdSize,
    note: `Referenz: ${REFERENCE.kgPerPersonPerYear} kg pro Kopf und Jahr, davon rund ` +
          `${Math.round(REFERENCE.shareSpoiled * 100)} % wegen Verderb. Quelle: ${REFERENCE.source}`,
    // Bewusst neutral formuliert, keine Bewertung der Person
    framing: ratio < 1
      ? "Dein geschätzter Wert liegt unter dem statistischen Rahmen."
      : "Dein geschätzter Wert liegt im oder über dem statistischen Rahmen."
  };
}

/**
 * Vorher/Nachher ab Nutzungsbeginn.
 * `evidenceLevel` sagt ehrlich, was die Zahl belegen kann -- und was nicht.
 */
function beforeAfter(wasteBefore, wasteAfter, weeksBefore, weeksAfter) {
  const perWeekBefore = weeksBefore > 0 ? wasteBefore / weeksBefore : 0;
  const perWeekAfter = weeksAfter > 0 ? wasteAfter / weeksAfter : 0;
  const change = perWeekBefore > 0 ? (perWeekAfter - perWeekBefore) / perWeekBefore : 0;

  let evidenceLevel;
  if (weeksBefore < 4 || weeksAfter < 4) evidenceLevel = "unzureichend";
  else if (weeksAfter < 12) evidenceLevel = "erster Hinweis";
  else evidenceLevel = "belastbarer Trend im Einzelhaushalt";

  return {
    perWeekBefore: Math.round(perWeekBefore * 100) / 100,
    perWeekAfter: Math.round(perWeekAfter * 100) / 100,
    changePercent: Math.round(change * 100),
    savedPerYear: Math.round((perWeekBefore - perWeekAfter) * 52 * 100) / 100,
    evidenceLevel,
    caveat: "Ein Vorher/Nachher-Vergleich in einem Haushalt zeigt keine Kausalität. " +
            "Für eine Wirkungsaussage braucht es eine Vergleichsgruppe ohne App."
  };
}

/** Positiv gerahmt: was gerettet wurde statt was verdorben ist. */
function rescuedFraming(savedEurosPerWeek, savedKgPerWeek) {
  return {
    perWeek: { euros: Math.round(savedEurosPerWeek * 100) / 100, kg: Math.round(savedKgPerWeek * 100) / 100 },
    perYear: { euros: Math.round(savedEurosPerWeek * 52), kg: Math.round(savedKgPerWeek * 52 * 10) / 10 },
    headline: `${Math.round(savedEurosPerWeek * 52)} € und ${Math.round(savedKgPerWeek * 52 * 10) / 10} kg im Jahr gerettet`,
    reference: `Zum Vergleich: bis zu ${REFERENCE.forsaMaxSavingFamily4PerYear} € pro Jahr bei einer vierköpfigen Familie, ` +
               `wenn nichts in der Tonne landet (forsa, zitiert nach BZfE).`
  };
}

/* ===== unitPriceCalculator.js ===== */
/**
 * unitPriceCalculator.js — NEU (Feature 1)
 * ================================================================
 * Grundpreis: was kostet das Produkt pro Kilo oder Liter?
 *
 * Der klassischste Sparhebel im Supermarkt — und die Daten liegen
 * bereits vor (typicalPrice und typicalWeightG in der Datenbank,
 * echte Preise und Mengen aus den Bons).
 *
 * Zwei Auswertungen:
 *   1. Grundpreis pro Position -- Vergleichbarkeit über
 *      Packungsgrößen hinweg
 *   2. Vergleich zwischen Packungsgrößen desselben Produkts aus
 *      der eigenen Kaufhistorie: "die große Packung war pro Kilo
 *      30 % günstiger"
 *
 * Ehrlichkeitshinweis: Der Grundpreis allein ist kein Kaufargument.
 * Die größere Packung ist nur dann günstiger, wenn sie auch
 * aufgebraucht wird. Deshalb wird die Verschwendungsquote des
 * Produkts in die Empfehlung einbezogen -- sonst empfiehlt die App
 * genau die Vorratspackung, die später halb weggeworfen wird.
 * ================================================================
 */



const VOLUME_UNITS = new Set(["ml", "l"]);

/**
 * Grundpreis einer einzelnen Position.
 * @param {object} item - {productId, unitPrice, quantity, weightG?}
 */
function unitPrice(item) {
  const p = byId(item.productId);
  if (!p) return null;

  const grams = item.weightG || p.typicalWeightG;
  if (!grams || grams <= 0) return null;

  const totalGrams = grams * (item.quantity || 1);
  const totalPrice = (item.unitPrice || p.typicalPrice || 0) * (item.quantity || 1);
  if (totalGrams <= 0 || totalPrice <= 0) return null;

  const perKg = (totalPrice / totalGrams) * 1000;
  const isVolume = VOLUME_UNITS.has((p.unit || "").toLowerCase()) ||
                   ["Getränke"].includes(p.category);

  return {
    productId: item.productId,
    name: p.name,
    totalPrice: Math.round(totalPrice * 100) / 100,
    totalGrams,
    perKg: Math.round(perKg * 100) / 100,
    unitLabel: isVolume ? "je Liter" : "je kg",
    display: `${(Math.round(perKg * 100) / 100).toFixed(2).replace(".", ",")} € ${isVolume ? "je Liter" : "je kg"}`
  };
}

/**
 * Vergleicht Packungsgrößen desselben Produkts aus der eigenen
 * Kaufhistorie und sagt, welche pro Kilo günstiger war.
 *
 * @param {Array} history - Käufe mit weightG oder quantity
 * @param {Map} wasteStats - optional: productId -> {wasteRate}
 */
function comparePackSizes(history, wasteStats = new Map()) {
  const byProduct = new Map();

  for (const h of history) {
    const p = byId(h.productId);
    if (!p || !p.isFood) continue;
    const grams = h.weightG || p.typicalWeightG;
    if (!grams) continue;

    const totalGrams = grams * (h.quantity || 1);
    const totalPrice = (h.unitPrice || 0) * (h.quantity || 1);
    if (totalPrice <= 0) continue;

    if (!byProduct.has(h.productId)) byProduct.set(h.productId, new Map());
    const sizes = byProduct.get(h.productId);
    const key = totalGrams;
    if (!sizes.has(key)) sizes.set(key, { grams: totalGrams, prices: [] });
    sizes.get(key).prices.push(totalPrice);
  }

  const results = [];
  for (const [productId, sizes] of byProduct.entries()) {
    if (sizes.size < 2) continue; // nur wo wirklich verglichen werden kann

    const options = [...sizes.values()].map((s) => {
      const avgPrice = s.prices.reduce((a, b) => a + b, 0) / s.prices.length;
      return {
        grams: s.grams,
        avgPrice: Math.round(avgPrice * 100) / 100,
        perKg: Math.round((avgPrice / s.grams) * 1000 * 100) / 100,
        timesBought: s.prices.length
      };
    }).sort((a, b) => a.perKg - b.perKg);

    const best = options[0];
    const worst = options[options.length - 1];
    const savingPercent = Math.round(((worst.perKg - best.perKg) / worst.perKg) * 100);
    if (savingPercent < 5) continue; // unter 5 % lohnt der Hinweis nicht

    const p = byId(productId);
    const waste = wasteStats.get(productId);
    const wasteRate = waste ? waste.wasteRate || 0 : 0;

    // Der ehrliche Teil: große Packung nur empfehlen, wenn sie
    // auch aufgebraucht wird.
    const largerIsBetter = best.grams > worst.grams;
    const riskyRecommendation = largerIsBetter && wasteRate >= 0.25;

    results.push({
      productId,
      name: p.name,
      best, worst, savingPercent,
      recommendation: riskyRecommendation
        ? `${best.grams} g wäre pro Kilo ${savingPercent} % günstiger — aber von ${p.name} bleibt bei dir ` +
          `rund ${Math.round(wasteRate * 100)} % übrig. Die große Packung lohnt nur, wenn sie aufgebraucht wird.`
        : `${best.grams} g ist pro Kilo ${savingPercent} % günstiger als ${worst.grams} g.`,
      riskyRecommendation,
      estimatedSavingPerPurchase: Math.round((worst.perKg - best.perKg) * (best.grams / 1000) * 100) / 100
    });
  }

  return results.sort((a, b) => b.savingPercent - a.savingPercent);
}

/** Grundpreise einer ganzen Liste, teuerste zuerst. */
function unitPricesForList(items) {
  return items
    .map(unitPrice)
    .filter(Boolean)
    .sort((a, b) => b.perKg - a.perKg);
}

/* ===== personalInflation.js ===== */
/**
 * personalInflation.js — NEU (Feature 2)
 * ================================================================
 * Nicht "Lebensmittel wurden teurer", sondern:
 * "Dein üblicher Warenkorb kostet 12 % mehr als im Januar."
 *
 * Rechenweg (bewusst wie ein amtlicher Preisindex aufgebaut, damit
 * er nachvollziehbar ist):
 *   1. Warenkorb festlegen: Produkte, die in beiden Zeiträumen
 *      gekauft wurden. Nur so vergleicht man Gleiches mit Gleichem.
 *   2. Je Produkt den Durchschnittspreis pro Kilo/Stück je
 *      Zeitraum bilden.
 *   3. Preisänderungen mit der Kaufhäufigkeit gewichten -- Milch
 *      wiegt schwerer als Safran.
 *
 * Warum das ein starkes Feature ist: Es braucht KEINE fremden
 * Preisdaten, keine Händlerkooperation, keine Schnittstelle. Alles
 * kommt aus den eigenen Bons und kann vollständig lokal auf dem
 * Gerät laufen -- der Datenschutzberater aus dem Persona-Bericht
 * hatte genau das als glaubwürdigstes Unterscheidungsmerkmal
 * bezeichnet.
 *
 * Grenzen, die im Ergebnis mitgeführt werden:
 *   - Wenige gemeinsame Produkte = wenig aussagekräftig
 *   - Wechsel von Marke zu Eigenmarke sieht aus wie Deflation,
 *     ist aber ein Qualitätswechsel. Wird als Hinweis markiert.
 * ================================================================
 */



const MIN_PRODUCTS_FOR_INDEX = 5;

function averagePricePerUnit(purchases) {
  let totalPrice = 0, totalUnits = 0;
  for (const p of purchases) {
    const qty = p.quantity || 1;
    const price = (p.unitPrice || 0) * qty;
    if (price <= 0 || qty <= 0) continue;
    totalPrice += price;
    totalUnits += qty;
  }
  return totalUnits > 0 ? totalPrice / totalUnits : null;
}

function inRange(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

/**
 * Vergleicht zwei Zeiträume.
 *
 * @param {Array} history
 * @param {object} basePeriod - {from, to}
 * @param {object} currentPeriod - {from, to}
 */
function personalInflation(history, basePeriod, currentPeriod) {
  const base = new Map();
  const current = new Map();

  for (const h of history) {
    const p = byId(h.productId);
    if (!p) continue;
    if (inRange(h.date, basePeriod.from, basePeriod.to)) {
      if (!base.has(h.productId)) base.set(h.productId, []);
      base.get(h.productId).push(h);
    } else if (inRange(h.date, currentPeriod.from, currentPeriod.to)) {
      if (!current.has(h.productId)) current.set(h.productId, []);
      current.get(h.productId).push(h);
    }
  }

  const items = [];
  let weightedSum = 0, weightTotal = 0;

  for (const [productId, basePurchases] of base.entries()) {
    const currentPurchases = current.get(productId);
    if (!currentPurchases) continue; // nur gemeinsame Produkte

    const basePrice = averagePricePerUnit(basePurchases);
    const currentPrice = averagePricePerUnit(currentPurchases);
    if (!basePrice || !currentPrice) continue;

    const change = (currentPrice - basePrice) / basePrice;
    // Gewicht: wie oft gekauft (Häufigkeit im Basiszeitraum)
    const weight = basePurchases.length;

    weightedSum += change * weight;
    weightTotal += weight;

    items.push({
      productId,
      name: byId(productId).name,
      basePrice: Math.round(basePrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      changePercent: Math.round(change * 1000) / 10,
      weight
    });
  }

  const indexChange = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const reliable = items.length >= MIN_PRODUCTS_FOR_INDEX;

  items.sort((a, b) => b.changePercent - a.changePercent);

  return {
    changePercent: Math.round(indexChange * 1000) / 10,
    productsCompared: items.length,
    reliable,
    biggestIncreases: items.slice(0, 5),
    biggestDecreases: items.slice(-3).reverse().filter((i) => i.changePercent < 0),
    caveat: reliable
      ? "Verglichen werden nur Produkte, die in beiden Zeiträumen gekauft wurden. " +
        "Ein Wechsel von Marke zu Eigenmarke sieht wie ein Preisrückgang aus, ist aber ein Produktwechsel."
      : `Nur ${items.length} gemeinsame Produkte — zu wenig für eine belastbare Aussage ` +
        `(mindestens ${MIN_PRODUCTS_FOR_INDEX} nötig).`,
    estimated: true
  };
}

/**
 * Monatsreihe für eine Verlaufsgrafik.
 * Basis ist immer der erste Monat mit ausreichend Daten.
 */
function inflationSeries(history, months) {
  if (!months || months.length < 2) return [];
  const baseMonth = months[0];
  const basePeriod = { from: `${baseMonth}-01`, to: `${baseMonth}-31` };

  return months.slice(1).map((m) => {
    const res = personalInflation(history, basePeriod, { from: `${m}-01`, to: `${m}-31` });
    return {
      month: m,
      changePercent: res.changePercent,
      productsCompared: res.productsCompared,
      reliable: res.reliable
    };
  });
}

/* ===== duplicateWarning.js ===== */
/**
 * duplicateWarning.js — NEU (Feature 3)
 * ================================================================
 * "Milch hast du am Dienstag schon gekauft."
 *
 * Der Moment im Laden, in dem eine Warnung tatsächlich etwas
 * verhindert: Der Griff ins Regal ist noch umkehrbar, der Kauf
 * nicht. Verhindert genau die Käufe, die später als Verschwendung
 * in der Statistik auftauchen.
 *
 * Drei Stufen, je nach Sicherheit:
 *   HOCH   -- kürzlich gekauft UND Bestand rechnerisch noch da UND
 *             lange haltbar. Klarer Doppelkauf.
 *   MITTEL -- kürzlich gekauft, Bestand unsicher.
 *   INFO   -- Produkt ist schon auf der aktuellen Liste (zweimal
 *             eingetragen).
 *
 * Bewusst zurückhaltend: Eine Warnung, die dreimal pro Einkauf
 * falsch liegt, wird nach einer Woche ignoriert. Deshalb wird bei
 * unsicherer Bestandsschätzung (niedriger Vertrauenswert) gar
 * nicht gewarnt.
 * ================================================================
 */





const MIN_CONFIDENCE_TO_WARN = 0.35;
// Bis zu dieser Zahl von Tagen ist der Kauf selbst Beweis genug --
// unabhängig davon, wie sicher die Bestandsschätzung ist.
const RECENT_PURCHASE_DAYS = 3;

/**
 * Prüft einen einzelnen Artikel, der gerade in den Wagen soll.
 *
 * @param {string} productId
 * @param {object} ctx - {history, rhythms, today, currentList}
 */
function checkDuplicate(productId, ctx) {
  const p = byId(productId);
  if (!p) return null;

  const { history = [], rhythms = new Map(), today, currentList = [] } = ctx;

  // Stufe INFO: schon auf der Liste
  const onListTwice = currentList.filter((i) => i.productId === productId).length > 1;
  if (onListTwice) {
    return {
      productId, level: "info", name: p.name,
      message: `${p.name} steht zweimal auf der Liste.`
    };
  }

  // Letzter Kauf
  const purchases = history.filter((h) => h.productId === productId);
  if (purchases.length === 0) return null;
  const last = purchases.reduce((a, b) => (a.date > b.date ? a : b));

  const daysSince = daysBetween(last.date, today);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;

  const rhythm = rhythms.get(productId);
  const est = estimateRemaining(productId, last, rhythm, today);
  const weekday = new Date(last.date).toLocaleDateString("de-DE", { weekday: "long" });

  // Regel A: sehr kürzlich gekauft.
  // Hier ist keine Bestandsschätzung nötig -- dass gekauft wurde,
  // steht fest. Nur bei sehr kurzlebiger Ware (Brötchen, frischer
  // Fisch) ist ein Nachkauf nach zwei Tagen normal, deshalb die
  // Haltbarkeitsschranke.
  if (daysSince <= RECENT_PURCHASE_DAYS && p.shelfLifeDays > daysSince + 1) {
    return {
      productId, level: daysSince <= 1 ? "hoch" : "mittel", name: p.name,
      daysSince, lastPurchaseDate: last.date,
      remainingUnits: est ? est.remainingUnits : null,
      daysLeft: est ? est.daysLeft : null,
      confidence: est ? est.confidence : 0,
      message: `${p.name} hast du ${daysSince === 0 ? "heute" : daysSince === 1 ? "gestern" : `am ${weekday}`} gekauft.`,
      basis: "kuerzlich_gekauft",
      estimated: true
    };
  }

  // Regel B: Bestandsschätzung. Nur wenn sie belastbar genug ist --
  // eine Warnung, die dreimal pro Einkauf falsch liegt, wird nach
  // einer Woche ignoriert.
  if (!est || est.confidence < MIN_CONFIDENCE_TO_WARN) return null;
  if (!est.likelyPresent) return null;

  const expected = rhythm && rhythm.rhythmDays ? rhythm.rhythmDays : null;
  const tooEarly = expected ? daysSince < expected * 0.6 : false;
  if (!tooEarly) return null;

  const level = est.confidence >= 0.6 && est.daysLeft > 2 ? "hoch" : "mittel";

  return {
    productId,
    level,
    name: p.name,
    daysSince,
    lastPurchaseDate: last.date,
    remainingUnits: est.remainingUnits,
    daysLeft: est.daysLeft,
    confidence: est.confidence,
    message: level === "hoch"
      ? `${p.name} hast du am ${weekday} gekauft — rechnerisch ist noch etwas da (hält noch ${est.daysLeft} Tage).`
      : `${p.name} hast du vor ${daysSince} Tagen gekauft. Vielleicht ist noch welche da?`,
    basis: "bestandsschaetzung",
    estimated: true
  };
}

/**
 * Prüft eine ganze Liste.
 * Jedes Produkt erscheint höchstens einmal -- eine doppelt
 * eingetragene Position soll nicht auch doppelt gemeldet werden.
 */
function checkList(items, ctx) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    const w = checkDuplicate(item.productId, { ...ctx, currentList: items });
    if (w) out.push(w);
  }

  const order = { hoch: 0, mittel: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/* ===== vacationMode.js ===== */
/**
 * vacationMode.js — NEU (Feature 4)
 * ================================================================
 * Jeder Urlaub produziert denselben Verlust: Der Kühlschrank ist
 * voll, die Abreise kommt, drei Tage später ist alles hin.
 *
 * Zwei Funktionen, beide aus vorhandenen Daten:
 *
 * 1. VOR DER ABREISE: Frischware, die die Abwesenheit nicht
 *    übersteht, wird nicht mehr vorgeschlagen. Stattdessen eine
 *    "aufbrauchen"-Liste aus dem geschätzten Bestand -- inklusive
 *    Hinweis, was sich einfrieren lässt (freezable in der Datenbank).
 *
 * 2. NACH DER RÜCKKEHR: Die Rhythmen wissen bereits, dass eine
 *    Unterbrechung war (Pausenerkennung in rhythmEngine2). Der
 *    Urlaubsmodus meldet das explizit an, damit die Pause nicht
 *    erst nachträglich aus den Daten geschlossen werden muss.
 *
 * Nebeneffekt: Das ist der einzige Moment, in dem ein Nutzer der
 * App freiwillig etwas erzählt (Reisedaten). Diese Angabe macht
 * gleichzeitig die Rhythmuserkennung sauberer.
 * ================================================================
 */




/**
 * Filtert die Vorschlagsliste vor einer Abwesenheit.
 *
 * @param {Array} suggestions - normale Vorschlagsliste
 * @param {string} shoppingDate - wann eingekauft wird
 * @param {string} departureDate
 * @param {string} returnDate
 */
function filterForVacation(suggestions, shoppingDate, departureDate, returnDate) {
  const daysUntilDeparture = daysBetween(shoppingDate, departureDate);
  const absenceDays = daysBetween(departureDate, returnDate);

  if (!Number.isFinite(daysUntilDeparture) || !Number.isFinite(absenceDays)) {
    return { keep: suggestions, skip: [], reduce: [], daysUntilDeparture: null, absenceDays: null, savedEuros: 0 };
  }

  const keep = [], skip = [], reduce = [];

  for (const item of suggestions) {
    const p = byId(item.productId);
    if (!p) { keep.push(item); continue; }

    // Trockenware, Tiefkühl und Non-Food überstehen jede Abwesenheit
    if (!p.isFood || p.shelfLifeDays > daysUntilDeparture + absenceDays) {
      keep.push(item);
      continue;
    }

    // Ab hier: verderbliche Ware, die die Reise NICHT übersteht.
    // Entscheidend ist nicht, ob sie bis zur Abreise hält, sondern
    // ob sie bis dahin auch verbraucht werden kann. Ein Wochenvorrat
    // Milch zwei Tage vor der Abreise ist kein guter Kauf, auch wenn
    // die Milch selbst noch acht Tage hält.
    //
    // Faustregel: sinnvoll ist höchstens der Anteil, der in den
    // verbleibenden Tagen üblicherweise verbraucht wird.
    const rhythmDays = item.rhythmDays || null;
    const consumableShare = rhythmDays && rhythmDays > 0
      ? Math.min(1, daysUntilDeparture / rhythmDays)
      : Math.min(1, daysUntilDeparture / Math.max(1, p.shelfLifeDays));

    if (daysUntilDeparture <= 0) {
      skip.push({ ...item, reason: "Abreise steht unmittelbar bevor" });
    } else if (consumableShare < 0.35) {
      skip.push({
        ...item,
        reason: `nur noch ${daysUntilDeparture} Tag(e) bis zur Abreise — davon würde das meiste verderben`
      });
    } else if (consumableShare < 0.8) {
      reduce.push({
        ...item,
        suggestedShare: Math.round(consumableShare * 100) / 100,
        vacationNote: `kleinere Menge — nur etwa ${Math.round(consumableShare * 100)} % werden bis zur Abreise verbraucht`
      });
    } else {
      keep.push({ ...item, vacationNote: "bis zur Abreise verbrauchen" });
    }
  }

  return {
    keep, skip, reduce,
    daysUntilDeparture, absenceDays,
    savedEuros: Math.round(
      (skip.reduce((s, i) => s + (i.price || 0), 0) +
       reduce.reduce((s, i) => s + (i.price || 0) * (1 - i.suggestedShare), 0)) * 100
    ) / 100
  };
}

/**
 * Aufbrauchliste aus dem geschätzten Bestand.
 * Trennt in "muss weg", "einfrieren möglich" und "übersteht die Reise".
 */
function useUpPlan(inventory, departureDate, returnDate, today) {
  const daysUntilDeparture = daysBetween(today, departureDate);
  const absenceDays = daysBetween(departureDate, returnDate);

  const mustUse = [], freeze = [], survives = [];

  for (const item of inventory) {
    const p = byId(item.productId);
    if (!p || !p.isFood) continue;

    const survivesTrip = item.daysLeft > daysUntilDeparture + absenceDays;
    if (survivesTrip) { survives.push(item); continue; }

    if (p.freezable) {
      freeze.push({
        ...item,
        action: "einfrieren",
        hint: `${p.name} vor der Abreise einfrieren — hält sonst nur noch ${item.daysLeft} Tage.`
      });
    } else {
      mustUse.push({
        ...item,
        action: "aufbrauchen",
        hint: `${p.name} vor der Abreise verbrauchen (nicht einfrierbar, noch ${item.daysLeft} Tage).`
      });
    }
  }

  const valueAtRisk = [...mustUse, ...freeze].reduce((s, i) => s + (i.value || 0), 0);

  return {
    daysUntilDeparture, absenceDays,
    mustUse: mustUse.sort((a, b) => a.daysLeft - b.daysLeft),
    freeze: freeze.sort((a, b) => b.value - a.value),
    survives,
    valueAtRisk: Math.round(valueAtRisk * 100) / 100,
    summary: `${mustUse.length + freeze.length} Positionen im Wert von rund ` +
             `${(Math.round(valueAtRisk * 100) / 100).toFixed(2).replace(".", ",")} € ` +
             `überstehen die Reise nicht.`,
    estimated: true
  };
}

/**
 * Meldet die Abwesenheit an die Rhythmuslogik, damit die Lücke
 * nicht als Verhaltensänderung fehlgedeutet wird.
 */
function registerAbsence(departureDate, returnDate) {
  return {
    type: "abwesenheit",
    from: departureDate,
    to: returnDate,
    days: daysBetween(departureDate, returnDate),
    note: "Kaufabstände über diesen Zeitraum werden aus der Rhythmusberechnung ausgeschlossen."
  };
}

/** Prüft, ob ein Kaufabstand in eine gemeldete Abwesenheit fällt. */
function isDuringAbsence(fromDate, toDate, absences = []) {
  return absences.some((a) => fromDate <= a.to && toDate >= a.from);
}

/* ===== depositTracker.js ===== */
/**
 * depositTracker.js — NEU (Feature 5)
 * ================================================================
 * Leergut liegt wochenlang herum. Aus dem Bon ist das Pfand
 * ablesbar -- und die Rückgabe wird zur Erinnerung mit Betrag.
 *
 * PFANDSÄTZE (Deutschland, Stand 2026):
 *   Einwegpfand nach Verpackungsgesetz: 0,25 € einheitlich für
 *   Einweggetränkeverpackungen (Dosen, PET-Einweg). Dieser Satz
 *   ist gesetzlich einheitlich.
 *
 *   Mehrwegpfand ist NICHT gesetzlich festgelegt, sondern
 *   herstellerabhängig. Die Werte unten sind die im deutschen
 *   Handel üblichen Sätze und ausdrücklich als `typisch`
 *   gekennzeichnet -- sie können je nach Hersteller abweichen.
 *   Deshalb gilt hier dieselbe Regel wie bei den Haltbarkeits-
 *   werten: Schätzwerte werden als solche ausgewiesen, nicht als
 *   Fakten dargestellt.
 * ================================================================
 */



const DEPOSIT_TYPES = {
  EINWEG: { value: 0.25, label: "Einweg (Dose/PET)", quality: "gesetzlich" },
  MEHRWEG_GLAS_BIER: { value: 0.08, label: "Bierflasche Glas", quality: "typisch" },
  MEHRWEG_GLAS_STANDARD: { value: 0.15, label: "Mehrweg Glas", quality: "typisch" },
  MEHRWEG_PET: { value: 0.25, label: "Mehrweg PET", quality: "typisch" },
  KASTEN: { value: 1.50, label: "Getränkekasten", quality: "typisch" },
  KEIN: { value: 0, label: "kein Pfand", quality: "gesetzlich" }
};

/** Ordnet einem Produkt den wahrscheinlichen Pfandtyp zu. */
function depositTypeFor(productId, hint = null) {
  if (hint && DEPOSIT_TYPES[hint]) return DEPOSIT_TYPES[hint];

  const p = byId(productId);
  if (!p) return DEPOSIT_TYPES.KEIN;
  if (p.category !== "Getränke") return DEPOSIT_TYPES.KEIN;

  if (p.id === "bier") return DEPOSIT_TYPES.MEHRWEG_GLAS_BIER;
  if (["wein", "sekt", "spirituose"].includes(p.id)) return DEPOSIT_TYPES.KEIN;
  if (["wasser", "limonade", "eistee"].includes(p.id)) return DEPOSIT_TYPES.EINWEG;
  if (["saft_orange", "saft_apfel", "saft_multi"].includes(p.id)) return DEPOSIT_TYPES.MEHRWEG_GLAS_STANDARD;

  return DEPOSIT_TYPES.KEIN;
}

/** Erfasst das Pfand eines Einkaufs. */
function trackFromReceipt(receiptItems, date) {
  const entries = [];
  let total = 0;

  for (const item of receiptItems) {
    const type = depositTypeFor(item.productId, item.depositHint);
    if (type.value === 0) continue;

    // Negative Mengen kommen auf echten Bons vor (Storno-Zeilen,
    // Rückgaben). Ohne Abfangen entsteht negatives Pfand -- ein
    // Betrag, der im Ergebnis wie ein Guthaben aussieht, aber
    // keines ist. Im Stresstest gefunden.
    const rawQty = item.quantity === undefined ? 1 : item.quantity;
    const qty = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0;
    if (qty === 0) continue;

    const amount = Math.round(type.value * qty * 100) / 100;
    total += amount;

    entries.push({
      productId: item.productId,
      name: byId(item.productId)?.name || item.productId,
      quantity: qty,
      depositPerUnit: type.value,
      amount,
      typeLabel: type.label,
      quality: type.quality,
      date,
      returned: false
    });
  }

  return {
    date,
    entries,
    total: Math.round(total * 100) / 100,
    note: entries.some((e) => e.quality === "typisch")
      ? "Mehrwegpfand ist herstellerabhängig — die Beträge sind übliche Sätze, keine gesetzlichen Werte."
      : null
  };
}

/**
 * Offenes Pfand über alle Einkäufe.
 * Ab welchem Betrag sich der Weg lohnt, entscheidet der Nutzer --
 * die App drängt nicht, sondern zeigt nur den Stand.
 */
function openDeposit(allEntries, today, opts = {}) {
  const reminderThreshold = opts.reminderThreshold ?? 5;
  const open = allEntries.filter((e) => !e.returned);
  const total = open.reduce((s, e) => s + e.amount, 0);

  const oldest = open.length
    ? open.reduce((a, b) => (a.date < b.date ? a : b)).date
    : null;

  const daysOpen = oldest && today
    ? Math.round((new Date(today) - new Date(oldest)) / 86400000)
    : 0;

  const byType = new Map();
  open.forEach((e) => {
    const cur = byType.get(e.typeLabel) || { count: 0, amount: 0 };
    byType.set(e.typeLabel, { count: cur.count + e.quantity, amount: cur.amount + e.amount });
  });

  return {
    total: Math.round(total * 100) / 100,
    positions: open.length,
    units: open.reduce((s, e) => s + e.quantity, 0),
    oldestDate: oldest,
    daysOpen,
    byType: [...byType.entries()].map(([label, v]) => ({
      label, count: v.count, amount: Math.round(v.amount * 100) / 100
    })).sort((a, b) => b.amount - a.amount),
    worthReturning: total >= reminderThreshold,
    message: total >= reminderThreshold
      ? `${total.toFixed(2).replace(".", ",")} € Pfand offen — das älteste liegt seit ${daysOpen} Tagen herum.`
      : `${total.toFixed(2).replace(".", ",")} € Pfand offen.`
  };
}

/** Markiert Leergut als zurückgegeben. */
function markReturned(allEntries, productIds, date) {
  return allEntries.map((e) =>
    productIds.includes(e.productId) && !e.returned
      ? { ...e, returned: true, returnedDate: date }
      : e
  );
}

/** Jahresbilanz: wie viel Pfand fällt überhaupt an. */
function yearlyDepositVolume(allEntries) {
  const total = allEntries.reduce((s, e) => s + e.amount, 0);
  const returned = allEntries.filter((e) => e.returned).reduce((s, e) => s + e.amount, 0);
  return {
    total: Math.round(total * 100) / 100,
    returned: Math.round(returned * 100) / 100,
    open: Math.round((total - returned) * 100) / 100,
    returnRate: total > 0 ? Math.round((returned / total) * 100) : 0
  };
}

/* ===== receiptArchive.js ===== */
/**
 * receiptArchive.js — NEU (Feature 6)
 * ================================================================
 * Der Bon ist ohnehin da. Ihn zusätzlich als Kaufbeleg nutzbar zu
 * machen, kostet fast nichts und gibt einen zweiten Grund, die App
 * zu behalten -- auch für jemanden, der gerade kein Interesse an
 * Verschwendungsstatistik hat.
 *
 * Rechtlicher Rahmen (bewusst vorsichtig formuliert):
 *   - Die gesetzliche Gewährleistung beträgt bei beweglichen Sachen
 *     grundsätzlich zwei Jahre ab Übergabe (§ 438 BGB). Für
 *     gebrauchte Sachen und bei Herstellergarantien gelten
 *     abweichende Regeln.
 *   - Eine Herstellergarantie ist eine freiwillige Zusage und kann
 *     kürzer oder länger sein.
 *   - Ob ein digitaler Beleg im Einzelfall als Nachweis akzeptiert
 *     wird, hängt vom Händler ab. Die App speichert und erinnert,
 *     sie gibt KEINE Rechtsauskunft.
 *
 * Deshalb: Fristen werden als Orientierung angezeigt, nie als
 * verbindliche Rechtsaussage.
 * ================================================================
 */



const WARRANTY_YEARS_DEFAULT = 2;
// Belege für Lebensmittel sind nach kurzer Zeit wertlos --
// Non-Food dagegen über Jahre relevant.
const FOOD_KEEP_DAYS = 60;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr, today) {
  return Math.round((new Date(dateStr) - new Date(today)) / 86400000);
}

/**
 * Legt einen Bon im Archiv ab und markiert die relevanten
 * Positionen (alles, was kein Lebensmittel ist).
 */
function archiveReceipt(receipt) {
  const { date, store, items = [], total, fileRef = null } = receipt;

  const relevant = [];
  for (const item of items) {
    const p = byId(item.productId);
    if (!p) continue;
    // Lebensmittel sind für Garantiezwecke uninteressant
    if (p.isFood) continue;

    const price = (item.unitPrice || 0) * (item.quantity || 1);
    relevant.push({
      productId: item.productId,
      name: p.name,
      price: Math.round(price * 100) / 100,
      warrantyUntil: addDays(date, WARRANTY_YEARS_DEFAULT * 365),
      note: "Gesetzliche Gewährleistung beträgt bei neuen beweglichen Sachen " +
            "grundsätzlich zwei Jahre. Abweichungen möglich — keine Rechtsauskunft."
    });
  }

  const foodTotal = items.reduce((s, i) => {
    const p = byId(i.productId);
    return p && p.isFood ? s + (i.unitPrice || 0) * (i.quantity || 1) : s;
  }, 0);

  return {
    id: `${date}_${store || "unbekannt"}_${Math.round((total || 0) * 100)}`,
    date, store, total: Math.round((total || 0) * 100) / 100,
    positions: items.length,
    foodTotal: Math.round(foodTotal * 100) / 100,
    nonFoodTotal: Math.round((total - foodTotal) * 100) / 100,
    warrantyItems: relevant,
    keepUntil: relevant.length
      ? relevant.reduce((max, r) => (r.warrantyUntil > max ? r.warrantyUntil : max), date)
      : addDays(date, FOOD_KEEP_DAYS),
    fileRef,
    hasWarrantyRelevance: relevant.length > 0
  };
}

/** Volltextsuche über das Archiv. */
function searchArchive(archive, query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];

  return archive.filter((r) => {
    if ((r.store || "").toLowerCase().includes(q)) return true;
    if (r.date.includes(q)) return true;
    return r.warrantyItems.some((i) => i.name.toLowerCase().includes(q));
  });
}

/** Belege, deren Garantiefrist bald endet. */
function expiringWarranties(archive, today, withinDays = 60) {
  const out = [];
  for (const receipt of archive) {
    for (const item of receipt.warrantyItems) {
      const days = daysUntil(item.warrantyUntil, today);
      if (days >= 0 && days <= withinDays) {
        out.push({
          receiptId: receipt.id,
          date: receipt.date,
          store: receipt.store,
          name: item.name,
          price: item.price,
          warrantyUntil: item.warrantyUntil,
          daysLeft: days,
          message: `${item.name} (${receipt.store || "unbekannt"}, ${receipt.date}): ` +
                   `Gewährleistungsfrist endet in ${days} Tagen.`
        });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Aufräumvorschlag: Belege ohne Garantierelevanz, die älter als
 * die Aufbewahrungsfrist sind. Löschen bleibt eine Entscheidung
 * des Nutzers -- die App löscht nichts von selbst.
 */
function cleanupCandidates(archive, today) {
  return archive
    .filter((r) => !r.hasWarrantyRelevance && r.keepUntil < today)
    .map((r) => ({
      id: r.id, date: r.date, store: r.store, total: r.total,
      reason: `Nur Lebensmittel, älter als ${FOOD_KEEP_DAYS} Tage.`
    }));
}

/** Kennzahlen fürs Archiv. */
function archiveStats(archive) {
  const total = archive.reduce((s, r) => s + r.total, 0);
  const stores = new Map();
  archive.forEach((r) => {
    const k = r.store || "unbekannt";
    const cur = stores.get(k) || { visits: 0, spend: 0 };
    stores.set(k, { visits: cur.visits + 1, spend: cur.spend + r.total });
  });

  return {
    receipts: archive.length,
    totalSpend: Math.round(total * 100) / 100,
    warrantyRelevant: archive.filter((r) => r.hasWarrantyRelevance).length,
    stores: [...stores.entries()]
      .map(([name, v]) => ({
        name, visits: v.visits,
        spend: Math.round(v.spend * 100) / 100,
        avgBasket: Math.round((v.spend / v.visits) * 100) / 100
      }))
      .sort((a, b) => b.spend - a.spend)
  };
}

/* ===== expiryWarning.js ===== */
/**
 * expiryWarning.js
 * ----------------------------------------------------------------
 * Erzeugt die präventive Warnung beim Listenaufbau ("Salat läuft
 * bei dir oft ab") -- nicht als Rückschau, sondern im Moment der
 * Entscheidung. Reines Schwellenwert-Regelwerk auf den Zahlen aus
 * wasteInference.js, kein KI-Modell.
 *
 * Tonalität bewusst nach dem Persona-Bericht umgestellt: keine
 * Vorwurfsformulierung ("du hast X weggeworfen"), sondern eine
 * Handlungsoption ("kleinere Menge nehmen?"). Siehe Punkt 2 der
 * Synthese im persona-bericht.md.
 * ----------------------------------------------------------------
 */

const WASTE_RATE_WARNING_THRESHOLD = 0.3; // ab 30 % Verschwendungsquote wird gewarnt

/**
 * @param {string} productId
 * @param {string} productName
 * @param {number} price
 * @param {{wasted:number, purchased:number, wastedEuros:number}} stats
 * @returns {object|null} Warnung oder null, wenn keine nötig ist
 */
function buildExpiryWarning(productId, productName, price, stats) {
  if (!stats || stats.purchased === 0) return null;

  const wasteRate = stats.wasted / stats.purchased;
  if (wasteRate < WASTE_RATE_WARNING_THRESHOLD) return null;

  const timesText = stats.wasted === 1 ? "einmal" : `${stats.wasted}×`;

  return {
    productId,
    severity: wasteRate >= 0.5 ? "high" : "medium",
    // Handlungsorientiert statt anklagend formuliert:
    message: `${productName}: in letzter Zeit ${timesText} übrig geblieben. Kleinere Menge nehmen oder erst nächste Woche?`,
    wasteRate: Math.round(wasteRate * 100) / 100,
    estimatedEurosAtRisk: Math.round(price * wasteRate * 100) / 100,
    suggestedActions: ["halbe_menge", "diese_woche_ueberspringen", "trotzdem_kaufen"]
  };
}

/**
 * Wendet buildExpiryWarning auf eine ganze Vorschlagsliste an.
 * @param {Array} suggestions - aus listGenerator.generateShoppingList
 * @param {Map<string, object>} wasteStatsByProduct
 * @returns {Array} Warnungen, eine pro betroffenem Produkt
 */
function buildWarningsForList(suggestions, wasteStatsByProduct) {
  const warnings = [];
  for (const item of suggestions) {
    const stats = wasteStatsByProduct.get(item.productId);
    const warning = buildExpiryWarning(item.productId, item.name, item.price || 0, stats);
    if (warning) warnings.push(warning);
  }
  return warnings;
}

/* ===== savingsEngine.js ===== */
/**
 * savingsEngine.js
 * ----------------------------------------------------------------
 * Erzeugt die Liste konkreter Sparvorschläge (Tab "Einsparpotenzial"
 * im Entwurf) aus den aggregierten Verschwendungs-Zahlen. Fest
 * hinterlegte Vorschlagsvorlagen (Templates), die anhand von
 * Schwellenwerten ausgewählt und mit den echten Zahlen gefüllt
 * werden. Kein Freitext-Generator, kein KI-Modell -- jeder Satz
 * ist vorab von Hand formuliert und wird nur mit Zahlen bestückt.
 * ----------------------------------------------------------------
 */

const RULES = [
  {
    id: "smaller_quantity",
    appliesWhen: (p) => p.wasteRate >= 0.4,
    title: (p) => `${p.name} als kleinere Menge`,
    detail: (p) =>
      `Verschwendungsquote ${Math.round(p.wasteRate * 100)} % in den letzten ${p.windowWeeks} Wochen. ` +
      `Kleinere Packung oder geringere Menge könnte das senken.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.6 * 100) / 100
  },
  {
    id: "adjust_rhythm",
    appliesWhen: (p) => p.wasteRate >= 0.2 && p.wasteRate < 0.4,
    title: (p) => `${p.name}-Rhythmus anpassen`,
    detail: (p) =>
      `Wird aktuell alle ${p.currentRhythmDays} Tage vorgeschlagen, ` +
      `tatsächlich verbraucht wird eher alle ${p.suggestedRhythmDays} Tage.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.5 * 100) / 100
  },
  {
    id: "portion_on_purchase",
    appliesWhen: (p) => p.category === "Fleisch/Fisch" && p.wasteRate >= 0.15,
    title: (p) => `${p.name} direkt portionieren`,
    detail: (p) =>
      `Teuerste Verlustquelle in dieser Kategorie. Erinnerung am Einkaufstag: ` +
      `einen Teil sofort einfrieren, statt alles auf einmal offen zu lagern.`,
    estimatedWeeklySaving: (p) => Math.round(p.wastedEurosPerWeek * 0.7 * 100) / 100
  }
];

/**
 * @param {Array<object>} productStats - aggregierte Kennzahlen pro Produkt
 *   { productId, name, category, wasteRate, wastedEurosPerWeek,
 *     windowWeeks, currentRhythmDays, suggestedRhythmDays }
 * @returns {Array} Vorschläge, absteigend nach Ersparnis sortiert
 */
function buildSavingsSuggestions(productStats) {
  const suggestions = [];

  for (const p of productStats) {
    for (const rule of RULES) {
      if (rule.appliesWhen(p)) {
        suggestions.push({
          id: `${rule.id}_${p.productId}`,
          productId: p.productId,
          title: rule.title(p),
          detail: rule.detail(p),
          estimatedWeeklySaving: rule.estimatedWeeklySaving(p)
        });
        break; // pro Produkt nur die zuerst zutreffende Regel, keine Doppelvorschläge
      }
    }
  }

  return suggestions.sort((a, b) => b.estimatedWeeklySaving - a.estimatedWeeklySaving);
}

/** Summiert eine Auswahl an Vorschlägen auf Woche und Jahr hoch. */
function totalSavings(selectedSuggestions) {
  const perWeek = selectedSuggestions.reduce((sum, s) => sum + s.estimatedWeeklySaving, 0);
  return {
    perWeek: Math.round(perWeek * 100) / 100,
    perYear: Math.round(perWeek * 52)
  };
}

/* ===== lidlParser.js ===== */
/**
 * lidlParser.js — kalibriert an einem ECHTEN Lidl-Bon (22.07.2026)
 * ================================================================
 * Der alte receiptParser.js war an keiner realen Datei geprüft. Was
 * der echte Bon anders macht, als ich angenommen hatte:
 *
 * 1. RABATTE SIND EIGENE ZEILEN.
 *    "Preisvorteil -0,08" und "Lidl Plus Rabatt -0,23" stehen
 *    eingerückt UNTER der Position und müssen von deren Preis
 *    abgezogen werden. Wer das ignoriert, rechnet mit falschen
 *    Preisen — und damit auch falsche Verschwendungsbeträge.
 *
 * 2. PFAND IST EINE EIGENE POSITION.
 *    "Pfand 0,25 7%EM  0,25 x 2  0,50" folgt dem Getränk. Es ist
 *    kein Lebensmittel und darf weder in die Verschwendungs- noch
 *    in die Kilogrammrechnung. Es gehört aber zum Getränk davor.
 *
 * 3. GEWICHTSWARE HAT EINE FOLGEZEILE.
 *    "0,199 kg x 22,99 EUR/kg" liefert das echte Gewicht — viel
 *    besser als der Schätzwert typicalWeightG aus der Datenbank.
 *
 * 4. MENGE STEHT INLINE.
 *    "High Protein Kaffee  1,15 x  2  2,30" — Einzelpreis, Anzahl,
 *    Gesamtpreis in einer Zeile.
 *
 * 5. STEUERKENNZEICHEN A/B AM ZEILENENDE.
 *    A = ermäßigt (7 %, meist Lebensmittel), B = voll (19 %, meist
 *    Non-Food). Ein brauchbarer, aber nicht perfekter Hinweis:
 *    Vitaminwasser steht hier auf B, ist aber trinkbar.
 *
 * 6. NAMEN SIND BRUTAL ABGEKÜRZT.
 *    "ChickenNug.Cornflak.", "Vit.-Was. Pfir.-Holu", "IronMa.100%
 *    Sahne P." — mit 20 Zeichen Feldbreite. Das ist die eigentliche
 *    Schwierigkeit, nicht das Zerlegen der Zeilen.
 * ================================================================
 */

const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));

// Zeile mit Menge:  Name   1,15 x   2    2,30 A
const RE_QTY   = /^(\S.*?)\s{2,}(\d+[.,]\d{2})\s*x\s*(\d+)\s+(-?\d+[.,]\d{2})\s*([A-Z])?\s*$/;
// Einfache Zeile:   Name                 4,58 A
const RE_SIMPLE = /^(\S.*?)\s{2,}(-?\d+[.,]\d{2})\s*([A-Z])?\s*$/;
// Gewichtszeile:      0,199 kg x 22,99  EUR/kg
const RE_WEIGHT = /^\s+(\d+[.,]\d+)\s*(kg|g)\s*x\s*(\d+[.,]\d{2})\s*EUR\/(kg|g)/i;
// Rabattzeile:        Preisvorteil        -0,08
const RE_DISCOUNT = /^\s+(Preisvorteil|Lidl Plus Rabatt|Rabatt|Coupon)\s+(-\d+[.,]\d{2})/i;
// Pfandzeile
const RE_DEPOSIT = /^Pfand\s/i;

/**
 * Zerlegt den Bon-Text in Positionen.
 * @returns {{items, deposits, discountTotal, sum, warnings}}
 */
function parseLidlReceipt(text, opts = {}) {
  const lines = String(text).split(/\r?\n/);
  const items = [];
  const deposits = [];
  const warnings = [];
  let last = null;          // zuletzt angelegte Warenposition
  let lastAny = null;       // zuletzt angelegte Zeile (auch Pfand)

  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^-{5,}/.test(raw.trim())) break;         // Trennlinie = Ende der Positionen
    if (/^\s*(SUMME|Summe|zu zahlen|Geg\.|Rückgeld)/i.test(raw)) break;

    // (a) Gewichtszeile — gehört zur Position darüber
    const w = raw.match(RE_WEIGHT);
    if (w && lastAny) {
      const value = num(w[1]);
      lastAny.weightG = w[2].toLowerCase() === "kg" ? value * 1000 : value;
      lastAny.pricePerKg = num(w[3]);
      lastAny.byWeight = true;
      continue;
    }

    // (b) Rabattzeile — vom Preis der Position darüber abziehen
    const d = raw.match(RE_DISCOUNT);
    if (d) {
      if (!lastAny) { warnings.push(`Rabatt ohne zugehörige Position: ${raw.trim()}`); continue; }
      const amount = num(d[2]); // negativ
      lastAny.discounts.push({ label: d[1], amount });
      lastAny.paid = Math.round((lastAny.paid + amount) * 100) / 100;
      continue;
    }

    // (c) Position mit Menge
    let m = raw.match(RE_QTY);
    let entry = null;
    if (m) {
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: parseInt(m[3], 10),
        listed: num(m[4]), taxClass: m[5] || null
      };
    } else {
      m = raw.match(RE_SIMPLE);
      if (!m) { warnings.push(`Zeile nicht erkannt: ${raw.trim()}`); continue; }
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: 1,
        listed: num(m[2]), taxClass: m[3] || null
      };
    }

    const record = {
      raw: entry.raw,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      listed: entry.listed,
      paid: entry.listed,
      taxClass: entry.taxClass,
      discounts: [],
      weightG: null,
      pricePerKg: null,
      byWeight: false
    };

    // (d) Pfand: eigene Position, gehört aber zum Getränk davor
    if (RE_DEPOSIT.test(entry.raw)) {
      record.isDeposit = true;
      record.belongsTo = last ? last.raw : null;
      deposits.push(record);
      lastAny = record;
      continue;
    }

    items.push(record);
    last = record;
    lastAny = record;
  }

  // Rechnerische Kontrolle: Einzelpreis × Menge muss dem Zeilenpreis entsprechen
  for (const it of items) {
    const expected = Math.round(it.unitPrice * it.quantity * 100) / 100;
    if (it.quantity > 1 && Math.abs(expected - it.listed) > 0.02) {
      warnings.push(`Rechenprobe: ${it.raw} — ${it.unitPrice} × ${it.quantity} = ${expected}, Bon nennt ${it.listed}`);
    }
    if (it.byWeight && it.pricePerKg) {
      const calc = Math.round((it.weightG / 1000) * it.pricePerKg * 100) / 100;
      if (Math.abs(calc - it.listed) > 0.02) {
        warnings.push(`Gewichtsprobe: ${it.raw} — errechnet ${calc}, Bon nennt ${it.listed}`);
      }
    }
  }

  const discountTotal = [...items, ...deposits]
    .reduce((s, i) => s + i.discounts.reduce((a, d) => a + d.amount, 0), 0);
  const sum = [...items, ...deposits].reduce((s, i) => s + i.paid, 0);

  return {
    items, deposits,
    discountTotal: Math.round(discountTotal * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    warnings
  };
}

/* ===== stockRange.js ===== */
/**
 * stockRange.js — Vorrats-Reichweite
 * ================================================================
 * Beantwortet die Frage, die vor jedem Einkauf im Kopf steht:
 * „Wie lange komme ich noch ohne Einkauf aus?"
 *
 * Zwei Grenzen, und die kleinere gewinnt:
 *   1. MENGE   — wann ist das Produkt aufgebraucht (aus perUnitDays)
 *   2. FRISCHE — wann verdirbt es (aus daysLeft der Bestandsschätzung)
 *
 * Der Unterschied ist wichtig: „reicht noch 4 Tage, weil es alle
 * wird" ist eine Einkaufsplanung, „reicht noch 4 Tage, weil es
 * schlecht wird" ist eine Verlustwarnung. Wer beides in eine Zahl
 * wirft, verschenkt die Handlungsoption.
 *
 * Betrachtet werden nur Grundnahrungsmittel — Schokolade geht aus,
 * aber niemand plant deshalb einen Einkauf.
 * ================================================================
 */



// Produkte, deren Fehlen tatsächlich einen Einkauf auslöst.
const STAPLE_CATEGORIES = ["Milchprodukte", "Backwaren", "Obst", "Gemüse", "Fleisch/Fisch", "Trocken/Vorrat"];

const LIMIT = { QUANTITY: "menge", FRESHNESS: "frische" };

/**
 * @param {Array} inventory  aus estimateInventory
 * @param {Map}   rhythms    aus computeAllRhythms
 * @param {object} opts      { minConfidence }
 * @returns {{days, limitedBy, limiting, byProduct, confidence, estimated, message}}
 */
function stockRange(inventory, rhythms, opts = {}) {
  const minConfidence = opts.minConfidence ?? 0.4;

  const byProduct = [];
  for (const item of inventory) {
    const p = byId(item.productId);
    if (!p || !p.isFood) continue;
    if (!STAPLE_CATEGORIES.includes(p.category)) continue;

    const r = rhythms.get(item.productId);
    if (!r || r.confidence < minConfidence) continue;

    // Menge: Restmenge × Tage je Einheit. Ohne perUnitDays keine Aussage.
    const byQuantity = r.perUnitDays
      ? Math.round(item.remainingUnits * r.perUnitDays * 10) / 10
      : null;
    const byFreshness = Number.isFinite(item.daysLeft) ? item.daysLeft : null;

    if (byQuantity === null && byFreshness === null) continue;

    const candidates = [byQuantity, byFreshness].filter((x) => x !== null);
    const days = Math.max(0, Math.min(...candidates));
    const limitedBy = byFreshness !== null && (byQuantity === null || byFreshness < byQuantity)
      ? LIMIT.FRESHNESS
      : LIMIT.QUANTITY;

    byProduct.push({
      productId: item.productId,
      name: p.name,
      days,
      byQuantity,
      byFreshness,
      limitedBy,
      safetyCritical: p.safetyCritical,
      confidence: Math.round(Math.min(r.confidence, item.confidence) * 100) / 100
    });
  }

  byProduct.sort((a, b) => a.days - b.days);

  if (!byProduct.length) {
    return {
      days: null, limitedBy: null, limiting: [], byProduct: [],
      confidence: 0, estimated: true,
      message: "Noch keine Reichweite schätzbar — dafür braucht es Bestand mit gelerntem Verbrauch."
    };
  }

  // Die Reichweite des Haushalts ist die des knappsten Grundnahrungsmittels.
  const days = byProduct[0].days;
  const limiting = byProduct.filter((x) => x.days <= days + 0.5);
  const confidence = Math.round(
    (limiting.reduce((s, x) => s + x.confidence, 0) / limiting.length) * 100
  ) / 100;

  const names = limiting.slice(0, 2).map((x) => x.name).join(" und ");
  const rounded = Math.round(days);
  const message = rounded <= 0
    ? `${names} ${limiting.length > 1 ? "sind" : "ist"} vermutlich schon alle.`
    : `Dein Vorrat reicht noch etwa ${rounded} ${rounded === 1 ? "Tag" : "Tage"} — dann ${limiting.length > 1 ? "fehlen" : "fehlt"} ${names}.`;

  return {
    days: Math.round(days * 10) / 10,
    limitedBy: byProduct[0].limitedBy,
    limiting,
    byProduct,
    confidence,
    estimated: true,
    message
  };
}

/* ===== freezeAdvisor.js ===== */
/**
 * freezeAdvisor.js — Einfrier-Empfehlung im richtigen Moment
 * ================================================================
 * Beim Einräumen, nicht drei Tage später: „Von den 400 g Hähnchen
 * die Hälfte sofort einfrieren — sonst sind in zwei Tagen 3,50 €
 * weg."
 *
 * Der Moment ist der Punkt. Eine Erinnerung am Tag vor dem Ablauf
 * kommt zu spät (das Fleisch liegt dann schon zwei Tage im
 * Kühlschrank), eine allgemeine Belehrung über Tiefkühlen ändert
 * nichts. Direkt nach dem Einkauf ist die Packung in der Hand.
 *
 * Bedingungen, alle drei müssen gelten:
 *   - `freezable: true` in der Datenbank
 *   - Haltbarkeit kürzer als der gelernte Verbrauch der Menge
 *   - Lebensmittel (Non-Food friert niemand ein)
 *
 * SICHERHEIT: Produkte mit Verbrauchsdatum bekommen die Empfehlung
 * ausdrücklich AUCH — Einfrieren ist bei Hackfleisch und Geflügel
 * die richtige Antwort, solange es SOFORT geschieht. Was die App
 * für diese Produkte nie tut, ist eine Verlängerung nach Ablauf
 * anbieten. Der Unterschied steht in `beforeExpiry`.
 * ================================================================
 */



/**
 * @param {Array} items    gekaufte Positionen [{productId, quantity, unitPrice}]
 * @param {Map}   rhythms  aus computeAllRhythms
 * @returns {Array} Empfehlungen, teuerste zuerst
 */
function freezeSuggestions(items, rhythms = new Map()) {
  const out = [];

  for (const item of items) {
    const p = byId(item.productId);
    if (!p || !p.isFood || !p.freezable) continue;

    const quantity = Math.max(1, Number(item.quantity) || 1);
    const r = rhythms.get(item.productId);

    // Wie lange wird diese Menge im Haushalt gebraucht?
    // Ohne Rhythmus wird angenommen, dass eine Packung die Haltbarkeit
    // knapp übersteht — dann gibt es keine Empfehlung, nur bei belegtem
    // Überschuss. Lieber schweigen als jeden Einkauf kommentieren.
    if (!r || !r.perUnitDays) continue;

    const daysNeeded = r.perUnitDays * quantity;
    if (daysNeeded <= p.shelfLifeDays) continue;   // wird rechtzeitig verbraucht

    // Anteil, der es nicht schafft — aufgerundet auf halbe Packungen,
    // weil niemand 0,37 Packungen einfriert.
    const surplusDays = daysNeeded - p.shelfLifeDays;
    // Auf halbe Packungen runden, aber danach erneut deckeln: 0,75
    // rundet sonst auf 1,0 auf, und „alles einfrieren" ist kein
    // Ratschlag — dann hätte man es gleich gefroren gekauft.
    const rawShare = Math.min(0.75, surplusDays / daysNeeded);
    const share = Math.min(0.75, Math.round(rawShare * 2) / 2) || 0.5;

    const unitPrice = Number(item.unitPrice) || p.typicalPrice || 0;
    const valueAtRisk = Math.round(unitPrice * quantity * share * 100) / 100;
    if (valueAtRisk < 0.5) continue;               // Kleinbeträge sind kein Hinweis wert

    const amount = share === 0.5 ? "die Hälfte" : `etwa ${Math.round(share * 100)} %`;
    const grams = p.typicalWeightG ? Math.round(p.typicalWeightG * quantity * share) : null;

    out.push({
      productId: p.id,
      name: p.name,
      share,
      valueAtRisk,
      shelfLifeDays: p.shelfLifeDays,
      daysNeeded: Math.round(daysNeeded),
      safetyCritical: p.safetyCritical,
      // Bei Verbrauchsdatum gilt: einfrieren nur VOR Ablauf, sofort.
      beforeExpiry: p.safetyCritical,
      message:
        `Von ${quantity > 1 ? quantity + "× " : ""}${p.name} ${amount}` +
        (grams ? ` (rund ${grams} g)` : "") +
        (p.safetyCritical ? " sofort einfrieren" : " einfrieren") +
        ` — sonst sind in ${p.shelfLifeDays} Tagen etwa ` +
        `${valueAtRisk.toFixed(2).replace(".", ",")} € weg.` +
        (p.safetyCritical ? " Verbrauchsdatum: nur frisch einfrieren, nie nach Ablauf." : ""),
      estimated: true
    });
  }

  return out.sort((a, b) => b.valueAtRisk - a.valueAtRisk);
}

/* ===== priceMemory.js ===== */
/**
 * priceMemory.js — Preis-Gedächtnis je Produkt
 * ================================================================
 * „Butter kostet heute 2,79 €, im Schnitt zahlst du 2,29 €."
 *
 * Ausdrücklich KEIN Preisvergleich zwischen Händlern — dafür fehlen
 * die Daten, und fremde Preisdaten wären erfunden. Verglichen wird
 * nur mit der eigenen Historie. Das bleibt lokal und ist trotzdem
 * die Zahl, die im Laden zählt: ob dieser Preis für DICH gut ist.
 *
 * Der Median statt des Mittelwerts, aus demselben Grund wie im
 * Rhythmus: ein einzelner Angebotspreis oder ein Fehlkauf soll den
 * Bezugswert nicht verschieben.
 * ================================================================
 */



const MIN_PURCHASES = 3;      // darunter ist „üblich" eine Behauptung
const NOTABLE_CHANGE = 0.08;  // 8 % — darunter ist es Rauschen

function medianOf(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Preisgedächtnis für ein Produkt.
 * @returns {null|{productId, name, usual, last, lowest, highest, purchases, changePercent, verdict, message}}
 */
function priceMemory(productId, history) {
  const rows = history
    .filter((h) => h.productId === productId && Number.isFinite(h.unitPrice) && h.unitPrice > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length < MIN_PURCHASES) return null;

  const prices = rows.map((r) => r.unitPrice);
  const usual = medianOf(prices);
  const last = prices[prices.length - 1];
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const change = usual > 0 ? (last - usual) / usual : 0;

  let verdict = "üblich";
  if (change <= -NOTABLE_CHANGE) verdict = "günstig";
  else if (change >= NOTABLE_CHANGE) verdict = "teuer";

  const p = byId(productId);
  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";

  const message =
    verdict === "üblich"
      ? `${eur(last)} — dein üblicher Preis.`
      : verdict === "günstig"
        ? `${eur(last)} statt sonst ${eur(usual)} — ${Math.abs(Math.round(change * 100))} % günstiger als üblich.`
        : `${eur(last)} statt sonst ${eur(usual)} — ${Math.round(change * 100)} % über deinem üblichen Preis.`;

  return {
    productId,
    name: p ? p.name : productId,
    usual: Math.round(usual * 100) / 100,
    last: Math.round(last * 100) / 100,
    lowest: Math.round(lowest * 100) / 100,
    highest: Math.round(highest * 100) / 100,
    purchases: rows.length,
    changePercent: Math.round(change * 1000) / 10,
    verdict,
    message,
    lastDate: rows[rows.length - 1].date
  };
}

/** Preisgedächtnis für alle Produkte mit genug Historie. */
function allPriceMemories(history) {
  const out = new Map();
  for (const pid of new Set(history.map((h) => h.productId))) {
    const m = priceMemory(pid, history);
    if (m) out.set(pid, m);
  }
  return out;
}

/* ===== forgottenDetector.js ===== */
/**
 * forgottenDetector.js — Vergessens-Detektor
 * ================================================================
 * „Zahnpasta zuletzt vor 9 Wochen — normalerweise alle 5."
 *
 * Fängt genau die Zwischenkäufe ab, die das Kernversprechen
 * ruinieren: Ein Produkt fällt aus dem Blick, irgendwann fehlt es
 * mitten in der Woche, und es wird ein Extraweg daraus.
 *
 * Der Unterschied zur normalen Liste: dort steht, was FÄLLIG ist.
 * Hier steht, was AUFFÄLLIG lange fehlt — also deutlich über dem
 * Rhythmus liegt und trotzdem nicht auf der Liste gelandet ist,
 * weil das Vertrauen unter der Schwelle blieb oder weil es
 * abgewählt wurde.
 *
 * Non-Food ist ausdrücklich dabei. Klopapier und Zahnpasta sind die
 * klassischen Vergessenskandidaten, gerade weil sie selten sind.
 * ================================================================
 */




const OVERDUE_FACTOR = 1.6;      // ab dem 1,6-fachen des Rhythmus auffällig
const MIN_CONFIDENCE = 0.35;     // darunter ist der Rhythmus selbst fraglich
const MAX_FACTOR = 6;            // darüber: aufgegeben, nicht vergessen

/**
 * @param {Map} rhythms   aus computeAllRhythms
 * @param {string} today  ISO-Datum
 * @param {object} opts   { exclude: Set<productId> — steht schon auf der Liste }
 */
function findForgotten(rhythms, today, opts = {}) {
  const exclude = opts.exclude || new Set();
  const factor = opts.overdueFactor ?? OVERDUE_FACTOR;
  const out = [];

  for (const [productId, r] of rhythms) {
    if (exclude.has(productId)) continue;
    if (!r.rhythmDays || !r.lastPurchaseDate) continue;
    if (r.confidence < MIN_CONFIDENCE) continue;

    const since = daysBetween(r.lastPurchaseDate, today);
    const ratio = since / r.rhythmDays;
    if (ratio < factor || ratio > MAX_FACTOR) continue;

    const p = byId(productId);
    if (!p) continue;

    const weeksSince = Math.round(since / 7);
    const rhythmWeeks = Math.round(r.rhythmDays / 7);

    // Wochen lesen sich bei langen Rhythmen besser, Tage bei kurzen.
    const sinceText = since >= 21 ? `vor ${weeksSince} Wochen` : `vor ${since} Tagen`;
    const rhythmText = r.rhythmDays >= 21
      ? `sonst alle ${rhythmWeeks} Wochen`
      : `sonst alle ${r.rhythmDays} Tage`;

    out.push({
      productId,
      name: p.name,
      category: p.category,
      aisle: p.aisle,
      isFood: p.isFood,
      daysSince: since,
      rhythmDays: r.rhythmDays,
      ratio: Math.round(ratio * 10) / 10,
      confidence: r.confidence,
      typicalPrice: p.typicalPrice,
      message: `${p.name} zuletzt ${sinceText} — ${rhythmText}.`,
      estimated: true
    });
  }

  // Am auffälligsten zuerst, aber Häufiges vor Seltenem: ein Produkt
  // mit 5-Tage-Rhythmus, das 3 Wochen fehlt, ist dringender als eins
  // mit 90-Tage-Rhythmus beim gleichen Verhältnis.
  return out.sort((a, b) => b.ratio - a.ratio || a.rhythmDays - b.rhythmDays);
}

/* ===== safetyAlert.js ===== */
/**
 * safetyAlert.js — Sofortwarnung nach dem Einkauf
 * ================================================================
 * Enthält der Einkauf ein Produkt mit Verbrauchsdatum, kommt beim
 * Verlassen des Ladens eine kurze Meldung: „Hackfleisch dabei —
 * direkt kühlen."
 *
 * Kein Verkaufsargument, aber der einzige Punkt, an dem die App
 * echte Sicherheitsrelevanz hat. Laut BZfE gehören diese Produkte
 * nach Ablauf in den Müll, weil sie Keime enthalten können, die man
 * weder sieht noch riecht noch schmeckt — die Kühlkette davor ist
 * entsprechend das Einzige, was der Nutzer beeinflussen kann.
 *
 * Bewusst knapp und selten: eine Warnung, die bei jedem Einkauf
 * erscheint, wird nach zwei Wochen weggetippt. Deshalb nur
 * Verbrauchsdatum-Produkte, nicht „alles Gekühlte".
 * ================================================================
 */



/**
 * @param {Array} items gekaufte Positionen [{productId, quantity}]
 * @returns {null|{products, coldestZone, message, source}}
 */
function safetyAlert(items) {
  const critical = [];
  const seen = new Set();

  for (const item of items) {
    const p = byId(item.productId);
    if (!p || !p.safetyCritical || seen.has(p.id)) continue;
    seen.add(p.id);
    critical.push({
      productId: p.id,
      name: p.name,
      shelfLifeDays: p.shelfLifeDays,
      storage: p.storage
    });
  }

  if (!critical.length) return null;

  const names = critical.map((c) => c.name);
  const list = names.length === 1
    ? names[0]
    : names.slice(0, -1).join(", ") + " und " + names[names.length - 1];

  const shortest = Math.min(...critical.map((c) => c.shelfLifeDays));

  return {
    products: critical,
    coldestZone: STORAGE.FRIDGE_BOTTOM,
    // Kurzfassung für die Liste, wo der Hinweis dauerhaft steht: ein
    // Satz. Die Langfassung ist für den Moment nach dem Einkauf — da
    // liegt die Packung in der Hand und der Hinweis erscheint einmal.
    short: `${list} direkt kühlen`,
    message:
      `${list} ${names.length === 1 ? "trägt" : "tragen"} ein Verbrauchsdatum. ` +
      `Zu Hause zuerst in die kälteste Zone: ${STORAGE.FRIDGE_BOTTOM}. ` +
      `Haltbar ${shortest} ${shortest === 1 ? "Tag" : "Tage"}; nach Ablauf gehört das in den Müll, ` +
      `auch wenn es unauffällig aussieht und riecht.`,
    source: "BZfE/BLE, Haltbarkeit von Lebensmitteln, Stand 20.02.2025"
  };
}

/* ===== aisleOrder.js ===== */
/**
 * aisleOrder.js — Gangreihenfolge je Markt
 * ================================================================
 * Die Reihenfolge der Gänge ist in jedem Markt anders. Wer die Liste
 * in der falschen Reihenfolge abarbeitet, läuft den Laden zweimal ab.
 * Der Nutzer sortiert einmal, die App merkt es sich je Filiale.
 *
 * Bewusst einfach gehalten: eine Liste von Gangnamen je Markt. Kein
 * Kartenmaterial, keine Koordinaten — das wäre Pflegearbeit ohne
 * Ende und für den Nutzen nicht nötig.
 *
 * Neue Gänge, die in der gespeicherten Reihenfolge fehlen, fallen
 * ans Ende statt raus. Ein Sortierschritt, der Positionen verschluckt,
 * ist im Laden schlimmer als eine falsche Reihenfolge.
 * ================================================================
 */

// Voreinstellung: der Weg durch einen typischen deutschen Supermarkt.
// Frische zuerst, Tiefkühl zuletzt — damit das Eis nicht taut.
const DEFAULT_AISLE_ORDER = [
  "Obst & Gemüse",
  "Backwaren",
  "Kühlregal",
  "Fleisch & Fisch",
  "Konserven",
  "Trockenware",
  "Süßwaren",
  "Getränke",
  "Drogerie",
  "Tiefkühl"
];

/** Die gespeicherte Reihenfolge eines Markts, sonst die Voreinstellung. */
function orderFor(store, saved = {}) {
  const custom = saved[normalizeStore(store)];
  return Array.isArray(custom) && custom.length ? custom : DEFAULT_AISLE_ORDER;
}

const normalizeStore = (s) => String(s || "").trim().toLowerCase() || "standard";

/**
 * Positionen nach Gängen gruppieren, in der Reihenfolge des Markts.
 * @returns {Array<{aisle, items}>}
 */
function groupByAisle(items, order = DEFAULT_AISLE_ORDER) {
  const groups = new Map();
  for (const item of items) {
    const aisle = item.aisle || "Sonstiges";
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(item);
  }

  const out = [];
  for (const aisle of order) {
    if (groups.has(aisle)) {
      out.push({ aisle, items: groups.get(aisle) });
      groups.delete(aisle);
    }
  }
  // Was in der Reihenfolge nicht vorkommt, hängt hinten an — nie weglassen.
  for (const [aisle, group] of groups) out.push({ aisle, items: group });
  return out;
}

/**
 * Einen Gang um eine Position verschieben. Liefert eine neue Liste;
 * unbekannte Gänge oder Züge über den Rand hinaus ändern nichts.
 */
function moveAisle(order, aisle, direction) {
  const list = [...order];
  const from = list.indexOf(aisle);
  if (from === -1) return list;
  const to = from + (direction < 0 ? -1 : 1);
  if (to < 0 || to >= list.length) return list;
  [list[from], list[to]] = [list[to], list[from]];
  return list;
}

/**
 * Reihenfolge aus den tatsächlich benutzten Gängen aufbauen, damit
 * der Nutzer nur sortiert, was er auch kauft.
 */
function relevantAisles(order, items) {
  const used = new Set(items.map((i) => i.aisle || "Sonstiges"));
  const known = order.filter((a) => used.has(a));
  const extra = [...used].filter((a) => !order.includes(a));
  return [...known, ...extra];
}

/* ===== seasonCalendar.js ===== */
/**
 * seasonCalendar.js — Saison für Frischware
 * ================================================================
 * Erdbeeren im Dezember kosten das Dreifache und schmecken
 * schlechter. Ein Sparhinweis, der nicht nach Verzicht klingt.
 *
 * Die Tabelle deckt deutsche Freiland- und Lagerware ab. Sie ist
 * ausdrücklich unvollständig: Produkte ohne Eintrag bekommen keinen
 * Hinweis. Ein erfundener Saisoneintrag wäre schlimmer als keiner —
 * dann stünde bei Bananen „nicht in Saison", was Unsinn ist.
 *
 * Grundlage: Saisonkalender des BZfE. Lagerware (Äpfel, Möhren,
 * Kartoffeln, Zwiebeln, Kohl) gilt über die Lagermonate hinaus als
 * verfügbar, weil sie das faktisch ist.
 * ================================================================
 */



const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

// Monate 1–12. `peak` = Freiland-Hochsaison, `available` = zusätzlich
// aus deutschem Lager verfügbar.
const SEASON = {
  erdbeeren:   { peak: [5, 6, 7], available: [] },
  spargel:     { peak: [4, 5, 6], available: [] },
  kirschen:    { peak: [6, 7, 8], available: [] },
  pflaumen:    { peak: [8, 9], available: [] },
  weintrauben: { peak: [9, 10], available: [] },
  aepfel:      { peak: [9, 10, 11], available: [12, 1, 2, 3, 4] },
  birnen:      { peak: [8, 9, 10], available: [11, 12] },
  tomaten:     { peak: [7, 8, 9], available: [6, 10] },
  gurke:       { peak: [6, 7, 8, 9], available: [5, 10] },
  salat_kopf:  { peak: [5, 6, 7, 8, 9], available: [4, 10] },
  paprika:     { peak: [7, 8, 9], available: [6, 10] },
  zucchini:    { peak: [7, 8, 9], available: [6, 10] },
  kuerbis:     { peak: [9, 10, 11], available: [8, 12] },
  moehren:     { peak: [6, 7, 8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5] },
  kartoffeln:  { peak: [8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5, 6, 7] },
  zwiebeln:    { peak: [8, 9, 10], available: [11, 12, 1, 2, 3, 4, 5, 6, 7] },
  lauch:       { peak: [9, 10, 11], available: [12, 1, 2, 3] },
  brokkoli:    { peak: [6, 7, 8, 9, 10], available: [5] },
  blumenkohl:  { peak: [6, 7, 8, 9, 10], available: [5, 11] },
  spinat:      { peak: [4, 5, 9, 10], available: [3, 6, 11] },
  radieschen:  { peak: [4, 5, 6, 7, 8, 9], available: [3, 10] },
  rosenkohl:   { peak: [10, 11, 12, 1], available: [2] },
  feldsalat:   { peak: [10, 11, 12, 1, 2], available: [3, 9] }
};

const STATUS = { PEAK: "saison", AVAILABLE: "lager", OFF: "importware" };

/**
 * @param {string} productId
 * @param {string|Date} date  Bezugsdatum
 * @returns {null|{productId, name, status, month, peakMonths, message}}
 */
function seasonFor(productId, date) {
  const entry = SEASON[productId];
  if (!entry) return null;                  // keine Tabelle = kein Hinweis

  const d = typeof date === "string" ? new Date(date + "T12:00:00Z") : new Date(date);
  const month = d.getUTCMonth() + 1;

  const status = entry.peak.includes(month)
    ? STATUS.PEAK
    : entry.available.includes(month) ? STATUS.AVAILABLE : STATUS.OFF;

  const p = byId(productId);
  const name = p ? p.name : productId;
  const peakText = entry.peak.map((m) => MONTH_NAMES[m - 1]).join(", ");

  const message =
    status === STATUS.PEAK ? `${name} hat jetzt Saison.`
      : status === STATUS.AVAILABLE ? `${name} kommt jetzt aus dem Lager.`
        : `${name} ist jetzt Importware — Saison ist ${peakText}.`;

  return { productId, name, status, month, peakMonths: entry.peak, message };
}

/** Nur die Positionen einer Liste, die außerhalb der Saison liegen. */
function offSeason(items, date) {
  return items
    .map((i) => seasonFor(i.productId, date))
    .filter((s) => s && s.status === STATUS.OFF);
}

/** Was diesen Monat Hochsaison hat — als Anregung, nicht als Vorschlag. */
function inSeasonNow(date, limit = 8) {
  const d = typeof date === "string" ? new Date(date + "T12:00:00Z") : new Date(date);
  const month = d.getUTCMonth() + 1;
  return Object.entries(SEASON)
    .filter(([, e]) => e.peak.includes(month))
    .map(([id]) => ({ productId: id, name: (byId(id) || {}).name || id }))
    .filter((x) => byId(x.productId))
    .slice(0, limit);
}

/* ===== openedTracker.js ===== */
/**
 * openedTracker.js — angebrochene Packungen
 * ================================================================
 * Nach dem Kochen bleibt eine halbe Dose Tomaten. Die Datenbank
 * kennt `shelfLifeOpenedDays` — eine geöffnete Dose hält 3 Tage,
 * nicht die 1095 des ungeöffneten Produkts. Ohne diesen Zustand
 * rechnet die Bestandsschätzung mit der falschen Zahl und die
 * Reste verderben unbemerkt.
 *
 * Der Nutzer markiert „angebrochen" mit einem Tippen. Mehr Pflege
 * darf es nicht kosten, sonst macht es niemand.
 *
 * SICHERHEIT: Bei Produkten mit Verbrauchsdatum wird nach Ablauf
 * nichts verlängert und nichts vorgeschlagen — die Frist bleibt die
 * Frist, angebrochen oder nicht.
 * ================================================================
 */




/**
 * @param {Array} opened  [{productId, openedDate}]
 * @param {string} today
 * @returns {Array} nach Dringlichkeit sortiert
 */
function openedItems(opened, today) {
  const out = [];

  for (const o of opened) {
    const p = byId(o.productId);
    if (!p) continue;

    const days = p.shelfLifeOpenedDays || p.shelfLifeDays;
    const age = daysBetween(o.openedDate, today);
    const daysLeft = days - age;

    out.push({
      productId: p.id,
      name: p.name,
      openedDate: o.openedDate,
      openedDays: age,
      shelfLifeOpenedDays: days,
      daysLeft,
      expired: daysLeft < 0,
      safetyCritical: p.safetyCritical,
      value: p.typicalPrice,
      urgent: daysLeft <= 1,
      message: daysLeft < 0
        ? (p.safetyCritical
            ? `${p.name} seit ${-daysLeft} Tagen über der Frist — entsorgen.`
            : `${p.name} ist seit ${-daysLeft} Tagen offen über der Haltbarkeit.`)
        : daysLeft === 0
          ? `${p.name} heute aufbrauchen.`
          : `${p.name} noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"} — angebrochen seit ${age} ${age === 1 ? "Tag" : "Tagen"}.`
    });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Bestandsschätzung korrigieren: was angebrochen ist, hält kürzer.
 * Die Restmenge bleibt unangetastet — nur die Frist ändert sich.
 */
function applyOpened(inventory, opened, today) {
  const map = new Map(opened.map((o) => [o.productId, o]));
  return inventory.map((item) => {
    const o = map.get(item.productId);
    if (!o) return item;
    const p = byId(item.productId);
    if (!p) return item;
    const daysLeft = (p.shelfLifeOpenedDays || p.shelfLifeDays) - daysBetween(o.openedDate, today);
    return {
      ...item,
      daysLeft: Math.min(item.daysLeft, daysLeft),
      opened: true,
      openedDate: o.openedDate
    };
  });
}

/** Was aus dem Angebrochenen zuerst weg muss — Grundlage für Rezepte. */
function useUpFirst(opened, today, withinDays = 3) {
  return openedItems(opened, today).filter(
    (x) => !x.expired && x.daysLeft <= withinDays && !(x.safetyCritical && x.daysLeft < 0)
  );
}

/* ===== shoppingDay.js ===== */
/**
 * shoppingDay.js — der eigene Einkaufsrhythmus
 * ================================================================
 * Die App lernt Produktrhythmen. Der Haushalt hat aber auch einen
 * eigenen: die meisten kaufen an denselben Wochentagen. Daraus
 * folgt, welcher Tag als nächstes dran ist — und damit, wie weit
 * die Liste vorausschauen muss.
 *
 * Reine Auszählung über die Bontage, kein Modell. Bei zu wenig
 * Historie gibt es kein Ergebnis statt eines geratenen.
 * ================================================================
 */



const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MIN_RECEIPTS = 6;

const weekdayIndex = (dateStr) => new Date(dateStr + "T12:00:00Z").getUTCDay();

/**
 * @param {Array} receipts [{date, total}]
 * @param {string} today
 * @returns {null|{favouriteDay, dayName, share, trips, perWeek, avgBasket, nextDay, daysUntilNext, byWeekday, message}}
 */
function shoppingPattern(receipts, today) {
  const days = [...new Set(receipts.map((r) => r.date))].sort();
  if (days.length < MIN_RECEIPTS) return null;

  const counts = new Array(7).fill(0);
  days.forEach((d) => { counts[weekdayIndex(d)]++; });

  const favourite = counts.indexOf(Math.max(...counts));
  const share = counts[favourite] / days.length;

  const span = Math.max(1, daysBetween(days[0], days[days.length - 1]));
  const perWeek = Math.round((days.length / (span / 7)) * 10) / 10;

  const totals = receipts.reduce((a, r) => a + (r.total || 0), 0);
  const avgBasket = Math.round((totals / receipts.length) * 100) / 100;

  // Nächster Vorkommen des Lieblingstags, heute eingeschlossen.
  const todayIdx = weekdayIndex(today);
  const daysUntilNext = (favourite - todayIdx + 7) % 7;

  const byWeekday = counts.map((count, i) => ({
    day: i, name: WEEKDAYS[i], count,
    share: Math.round((count / days.length) * 100)
  }));

  // Ein Lieblingstag ist nur einer, wenn er sich abhebt. Bei sieben
  // gleich verteilten Tagen wäre jeder „der Tag" — das ist keine Aussage.
  const distinct = share >= 0.28;

  return {
    favouriteDay: distinct ? favourite : null,
    dayName: distinct ? WEEKDAYS[favourite] : null,
    share: Math.round(share * 100) / 100,
    trips: days.length,
    perWeek,
    avgBasket,
    nextDay: distinct ? WEEKDAYS[favourite] : null,
    daysUntilNext: distinct ? daysUntilNext : null,
    byWeekday,
    message: distinct
      ? (daysUntilNext === 0
          ? `Heute ist dein üblicher Einkaufstag.`
          : `Du kaufst meist ${WEEKDAYS[favourite]}s — das ist in ${daysUntilNext} ${daysUntilNext === 1 ? "Tag" : "Tagen"}.`)
      : `Du kaufst etwa ${perWeek}× pro Woche, ohne festen Tag.`
  };
}

/**
 * Empfohlene Vorausschau: so viele Tage, wie bis zum nächsten
 * üblichen Einkauf vergehen. Ohne erkennbaren Tag der übliche
 * Abstand zwischen zwei Einkäufen.
 */
function suggestedLookahead(pattern) {
  if (!pattern) return null;
  if (pattern.daysUntilNext !== null) return Math.max(1, pattern.daysUntilNext);
  return Math.max(1, Math.round(7 / Math.max(0.5, pattern.perWeek)));
}

// Anteil des Zyklus, den die Vorausschau höchstens vorwegnehmen darf.
const MAX_LOOKAHEAD_SHARE = 0.35;

/**
 * Vorausschau, auf den Zyklus des Produkts bezogen.
 *
 * Die eingestellte Vorausschau ist eine feste Zahl in Tagen — für ein
 * Produkt mit dreißigtägigem Rhythmus sind drei Tage ein Zehntel des
 * Zyklus und damit ein vernünftiger Vorlauf. Für ein Produkt mit
 * viertägigem Rhythmus sind dieselben drei Tage drei Viertel des
 * Zyklus: es steht dann ab dem Tag nach dem Kauf wieder auf der Liste.
 *
 * Das ist kein theoretisches Problem. In der Drei-Jahres-Simulation
 * war es der Auslöser einer Rückkopplung: Milch wurde bei jedem
 * Einkauf vorgeschlagen, also bei jedem Einkauf gekauft, also lag der
 * beobachtete Abstand bei der Einkaufsfrequenz, also wurde der
 * Rhythmus noch kürzer. Die App lernte am Ende ihren eigenen
 * Vorschlag statt den Bedarf des Haushalts, und der Haushalt kaufte
 * 239 von 281 Packungen Milch zu früh. Der gemessene Verderb lag
 * damit über dem eines Haushalts ganz ohne App — eine App, die
 * schadet, statt zu nützen.
 *
 * Deshalb: der Vorlauf ist ein ANTEIL des Zyklus, gedeckelt durch die
 * Einstellung. Nie mehr als ein gutes Drittel.
 */
function effectiveLookahead(rhythmDays, lookaheadDays) {
  const wish = Math.max(0, Number(lookaheadDays) || 0);
  if (!rhythmDays || !Number.isFinite(rhythmDays)) return wish;
  return Math.min(wish, Math.floor(rhythmDays * MAX_LOOKAHEAD_SHARE));
}

/* ===== listExport.js ===== */
/**
 * listExport.js — Liste als Text
 * ================================================================
 * Die Liste muss den Haushalt verlassen können: an den Partner
 * schicken, ausdrucken, in eine Notiz kopieren. Ohne das bleibt die
 * App ein Einzelplatzwerkzeug, und beim gemeinsamen Einkauf greift
 * doch wieder jemand zum Zettel.
 *
 * Reiner Text, nach Gängen sortiert. Kein eigenes Format, keine
 * App-Bindung — was hier herauskommt, liest jedes Programm.
 * ================================================================
 */



const eur = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";

/**
 * @param {Array} items    aktive Listenpositionen
 * @param {object} opts    { order, title, withPrices, total }
 * @returns {string}
 */
function listAsText(items, opts = {}) {
  const order = opts.order || DEFAULT_AISLE_ORDER;
  const withPrices = opts.withPrices !== false;
  const title = opts.title || "Einkaufsliste";

  if (!items.length) return `${title}\n\nNichts auf der Liste.`;

  const lines = [title, ""];
  for (const { aisle, items: group } of groupByAisle(items, order)) {
    lines.push(aisle.toUpperCase());
    for (const i of group) {
      const price = i.halved ? i.price / 2 : i.price;
      lines.push(`  ☐ ${i.name}${withPrices ? `  ${eur(price)}` : ""}${i.halved ? "  (halbe Menge)" : ""}`);
    }
    lines.push("");
  }

  if (withPrices) {
    const sum = items.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    lines.push(`${items.length} Positionen · ${eur(sum)}`);
  }
  return lines.join("\n").trim();
}

/** Kurzfassung für eine Nachricht: eine Zeile, ohne Gänge. */
function listAsLine(items) {
  if (!items.length) return "Nichts auf der Liste.";
  return items.map((i) => i.name).join(", ");
}

/* ===== nonFoodCatalog.js ===== */
/**
 * nonFoodCatalog.js — Verbrauchsmodell für Haushaltsprodukte
 * ================================================================
 * Haushaltsprodukte sind ein anderes Problem als Lebensmittel:
 *
 *   Lebensmittel    Feind ist Verderb — zu viel gekauft.
 *   Haushalt        Feind ist Leerstand — zu spät gekauft.
 *
 * Daraus folgt alles Weitere. Bei Lebensmitteln verzerrt Verschwendung
 * das Signal, deshalb der Median über Kaufabstände. Bei Non-Food gibt
 * es keinen Verderb: die gekaufte Menge wird tatsächlich verbraucht,
 * das Signal ist sauber, und man kann über eine Rate rechnen.
 *
 * Bevorratung ist hier rational statt schädlich — begrenzt nur durch
 * Lagerplatz und Kapitalbindung.
 *
 * Dieser Katalog trägt AUSSCHLIESSLICH das Verbrauchsmodell. Name,
 * Schreibweisen, Preis und Gewicht stehen weiter in foodDatabase.js;
 * verknüpft wird über die Produktkennung. Ein zweiter Produktkatalog
 * wäre genau die Doppelpflege, gegen die der Bündel-Build gebaut ist.
 *
 * ALLE Raten und Intervalle sind Startwerte. Die Quelle steht an
 * jedem Eintrag und wird in der Oberfläche angezeigt — dasselbe
 * Prinzip wie bei den Haltbarkeitsdaten: lieber eine ehrlich als
 * Schätzung gekennzeichnete Zahl als eine, die Genauigkeit vortäuscht.
 * ================================================================ */



/* ---------- Verbrauchsklassen ---------- */
const CLASS = {
  // Menge nimmt näherungsweise linear ab — Prognose über eine Rate.
  RATE: "RATE",
  // Austausch nach Zeit, unabhängig von der Menge. Meist hygienisch
  // begründet. Braucht kein Verbrauchsmodell und keine Historie:
  // Kaufdatum plus Intervall genügt.
  INTERVAL: "INTERVAL",
  // Kein Muster ableitbar. Die App zeigt Historie, aber KEINE
  // Prognose. Diese Klasse existiert, damit nicht geraten wird.
  SPORADIC: "SPORADIC",
  // Echtes Verfalls- oder Öffnungsdatum.
  DATED: "DATED"
};

const SOURCE = {
  SCHAETZUNG: "Schätzung",
  HERSTELLER: "Herstellerangabe",
  FACH: "Fachempfehlung",
  HYGIENE: "Hygieneempfehlung"
};

/* ---------- Haushaltsskalierung (§5.2) ---------------------------
 * Nicht alles skaliert linear mit der Haushaltsgröße. Zahnpasta schon
 * — jede Person putzt. Waschmittel nicht: bei vier Personen läuft die
 * Maschine voller, nicht viermal so oft.
 *
 *   f(n) = n ^ alpha
 * ---------------------------------------------------------------- */
const ALPHA = {
  PER_PERSON: 1.0,     // Zahnpasta, Duschgel, Shampoo, Deo
  SLIGHT: 0.75,        // Klopapier, Taschentücher, Handseife
  DEGRESSIVE: 0.65,    // Waschmittel, Spülmittel, Müllbeutel
  PER_HOUSEHOLD: 0.0   // Entkalker, Allzweckreiniger — einmal je Haushalt
};

/* ---------- Normeinheiten für den Grundpreis (§8.1) ---------- */
const NORM = {
  ML100: { unit: "ml", per: 100, label: "100 ml" },
  G100: { unit: "g", per: 100, label: "100 g" },
  WL: { unit: "WL", per: 1, label: "Waschladung" },
  ROLLE: { unit: "Rolle", per: 1, label: "Rolle" },
  BLATT100: { unit: "Blatt", per: 100, label: "100 Blatt" },
  TAB: { unit: "Tab", per: 1, label: "Tab" },
  STUECK: { unit: "Stück", per: 1, label: "Stück" },
  METER: { unit: "m", per: 1, label: "Meter" },
  TUCH: { unit: "Tuch", per: 100, label: "100 Tücher" }
};

/* ---------- Geräte, die ein Produkt voraussetzt ----------
 * Ohne Kaffeemaschine keine Entkalker-Vorschläge. Ein Vorschlag für
 * ein Gerät, das der Haushalt nicht hat, kostet mehr Vertrauen als
 * er Nutzen bringt.                                                  */
const DEVICE = {
  DISHWASHER: "hasDishwasher",
  WASHER: "hasWashingMachine",
  COFFEE: "hasCoffeeMachine",
  WATERFILTER: "hasWaterFilter"
};

/* ================================================================
   Der Katalog
   ================================================================ */
const NONFOOD = {};

function rate(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.RATE,
    baseRatePerPersonPerDay: opts.rate,
    scalingExponent: opts.alpha,
    rateSource: opts.source || SOURCE.SCHAETZUNG,
    package: { value: opts.pack, unit: opts.norm.unit, norm: opts.norm },
    storageLimitDefault: opts.storage ?? 2,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: opts.pausesOnVacation !== false,
    requiresDevice: opts.device || null,
    hardnessSensitive: opts.hardness === true
  };
}

function interval(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.INTERVAL,
    replacementIntervalDays: opts.days,
    intervalSource: opts.source || SOURCE.SCHAETZUNG,
    package: { value: opts.pack ?? 1, unit: "Stück", norm: NORM.STUECK },
    storageLimitDefault: opts.storage ?? 2,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    // Eine Zahnbürste altert auch im Urlaub — sie wird mitgenommen.
    // Ein Küchenschwamm liegt derweil trocken. Deshalb je Produkt.
    pausesOnVacation: opts.pausesOnVacation === true,
    requiresDevice: opts.device || null,
    hardnessSensitive: opts.hardness === true
  };
}

function sporadic(id, opts = {}) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.SPORADIC,
    package: { value: opts.pack ?? 1, unit: opts.unit || "Stück", norm: opts.norm || NORM.STUECK },
    storageLimitDefault: opts.storage ?? 1,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: true,
    requiresDevice: null,
    hardnessSensitive: false
  };
}

function dated(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.DATED,
    // PAO = Period After Opening. Gilt ab dem Öffnen, und das Datum
    // kennt die App nicht. Das Kaufdatum ist ein Behelf und wird als
    // solcher gekennzeichnet — keine stille Schätzung.
    paoMonths: opts.pao ?? null,
    hasHardExpiry: opts.hardExpiry === true,
    package: { value: opts.pack ?? 1, unit: opts.norm ? opts.norm.unit : "Stück", norm: opts.norm || NORM.STUECK },
    storageLimitDefault: 1,
    promoCycleDaysDefault: 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: false,   // eine Frist läuft im Urlaub weiter
    requiresDevice: null,
    hardnessSensitive: false,
    datedSource: opts.source || SOURCE.HERSTELLER
  };
}

/* ---------- RATE: kontinuierlicher Verbrauch (§7.1) ---------- */
// Körperpflege ist persönlich — in einer WG teilt das niemand.
rate("zahnpasta", { rate: 1.5, alpha: ALPHA.PER_PERSON, pack: 75, norm: NORM.ML100, shared: false });
rate("duschgel", { rate: 10, alpha: ALPHA.PER_PERSON, pack: 300, norm: NORM.ML100, shared: false });
rate("shampoo", { rate: 3.5, alpha: ALPHA.PER_PERSON, pack: 300, norm: NORM.ML100, shared: false });
rate("deo", { rate: 0.7, alpha: ALPHA.PER_PERSON, pack: 50, norm: NORM.ML100, shared: false });
rate("handseife", { rate: 8, alpha: ALPHA.SLIGHT, pack: 250, norm: NORM.ML100 });

rate("klopapier", { rate: 0.14, alpha: ALPHA.SLIGHT, pack: 10, norm: NORM.ROLLE, storage: 3 });
rate("kuechenrolle", { rate: 0.07, alpha: ALPHA.DEGRESSIVE, pack: 4, norm: NORM.ROLLE, storage: 3 });
rate("taschentuecher", { rate: 0.3, alpha: ALPHA.SLIGHT, pack: 60, norm: NORM.TUCH });

rate("waschmittel", { rate: 1.0, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.WL, device: DEVICE.WASHER, hardness: true });
rate("weichspueler", { rate: 0.6, alpha: ALPHA.DEGRESSIVE, pack: 30, norm: NORM.WL, device: DEVICE.WASHER });
rate("spuelmittel", { rate: 6, alpha: ALPHA.DEGRESSIVE, pack: 500, norm: NORM.ML100 });
rate("spuelmaschinentabs", { rate: 0.5, alpha: ALPHA.DEGRESSIVE, pack: 40, norm: NORM.TAB, device: DEVICE.DISHWASHER });
rate("muellbeutel", { rate: 0.25, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.STUECK });
rate("allzweckreiniger", { rate: 5, alpha: ALPHA.PER_HOUSEHOLD, pack: 750, norm: NORM.ML100 });

rate("alufolie", { rate: 0.15, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.METER });
rate("frischhaltefolie", { rate: 0.2, alpha: ALPHA.DEGRESSIVE, pack: 30, norm: NORM.METER });
rate("backpapier", { rate: 0.1, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.METER });
rate("gefrierbeutel", { rate: 0.4, alpha: ALPHA.DEGRESSIVE, pack: 50, norm: NORM.STUECK });

/* ---------- INTERVAL: zeitbasierter Austausch (§7.2) ----------
 * Die schnellste Wirkung im ganzen Modell: kein Kaltstart, keine
 * Historie, kein Lernen. Niemand denkt nach drei Monaten von selbst
 * an die Zahnbürste.                                                */
interval("zahnbuerste", { days: 90, source: SOURCE.FACH, shared: false, pausesOnVacation: false });
interval("aufsteckbuersten", { days: 90, source: SOURCE.FACH, pack: 4, shared: false, pausesOnVacation: false });
interval("kuechenschwamm", { days: 10, source: SOURCE.HYGIENE, pack: 5, pausesOnVacation: true });
interval("spuelbuerste", { days: 60, source: SOURCE.HYGIENE, pausesOnVacation: true });
interval("wischbezug", { days: 120, pausesOnVacation: true });
interval("wasserfilter", { days: 28, source: SOURCE.HERSTELLER, device: DEVICE.WATERFILTER, hardness: true, pausesOnVacation: false });
interval("rasierklingen", { days: 21, pack: 4, shared: false, pausesOnVacation: false });
interval("duschschwamm", { days: 45, source: SOURCE.HYGIENE, shared: false, pausesOnVacation: true });
interval("staubsaugerbeutel", { days: 45, pack: 4, pausesOnVacation: true });
interval("waschmaschinenreiniger", { days: 60, source: SOURCE.HERSTELLER, device: DEVICE.WASHER, hardness: true, pausesOnVacation: true });
interval("entkalker", { days: 90, source: SOURCE.HERSTELLER, device: DEVICE.COFFEE, hardness: true, pausesOnVacation: true });

/* ---------- SPORADIC: kein Muster (§3.3) ---------- */
sporadic("batterien", { pack: 4 });
sporadic("gluehbirne");
sporadic("kerzen", { pack: 6 });
sporadic("klebeband");
sporadic("schuhcreme", { pack: 75, unit: "ml", norm: NORM.ML100, shared: false });
sporadic("tragetasche");
sporadic("putztuecher", { pack: 30, unit: "Tuch", norm: NORM.TUCH });

/* ---------- DATED: echtes Verfalls- oder Öffnungsdatum (§7.4) ---------- */
dated("sonnencreme", { pao: 12, pack: 200, norm: NORM.ML100, shared: false });
dated("kontaktlinsenloesung", { pao: 3, pack: 360, norm: NORM.ML100, shared: false });
dated("desinfektionsmittel", { pao: 12, pack: 250, norm: NORM.ML100 });
dated("mascara", { pao: 6, pack: 10, norm: NORM.ML100, shared: false });

/* ---------- Wasserhärte (§7.3) ----------------------------------
 * In Deutschland gesetzlich in drei Härtebereiche eingeteilt. Härteres
 * Wasser heißt häufiger entkalken und mehr Waschmittel je Ladung.
 * Der Wert kommt vom örtlichen Versorger; die App fragt ihn ab, statt
 * ihn aus der Postleitzahl zu raten.                                 */
const HARDNESS_FACTOR = { weich: 1.6, mittel: 1.0, hart: 0.6 };
const HARDNESS_LABEL = {
  weich: "weich (unter 8,4 °dH)",
  mittel: "mittel (8,4–14 °dH)",
  hart: "hart (über 14 °dH)"
};

/* ---------- Zugriff ---------- */

/** Verbrauchsmodell eines Produkts, sonst null. */
const nonFoodFor = (productId) => NONFOOD[productId] || null;

/** Ist das ein Haushaltsprodukt mit Verbrauchsmodell? */
const isNonFood = (productId) => !!NONFOOD[productId];

/** Alle Produkte einer Verbrauchsklasse. */
function byClass(consumptionClass) {
  return Object.values(NONFOOD).filter((x) => x.consumptionClass === consumptionClass);
}

/**
 * Gilt das Produkt für diesen Haushalt? Fehlt das nötige Gerät, wird
 * es hart ausgefiltert statt schwach gewichtet.
 */
function appliesTo(productId, profile = {}) {
  const e = NONFOOD[productId];
  if (!e) return false;
  if (!e.requiresDevice) return true;
  return profile[e.requiresDevice] === true;
}

/** Katalogeintrag und Verbrauchsmodell in einem Objekt. */
function fullProduct(productId) {
  const p = byId(productId);
  const n = NONFOOD[productId];
  if (!p || !n) return null;
  return { ...p, ...n, domain: "NONFOOD" };
}

/** Bericht über die Belastbarkeit der Non-Food-Daten. */
function nonFoodQualityReport() {
  const all = Object.values(NONFOOD);
  const bySource = {};
  all.forEach((x) => {
    const src = x.rateSource || x.intervalSource || x.datedSource || "—";
    bySource[src] = (bySource[src] || 0) + 1;
  });
  const inCatalog = all.filter((x) => byId(x.id)).length;
  return {
    total: all.length,
    inCatalog,
    missing: all.filter((x) => !byId(x.id)).map((x) => x.id),
    rate: byClass(CLASS.RATE).length,
    interval: byClass(CLASS.INTERVAL).length,
    sporadic: byClass(CLASS.SPORADIC).length,
    datedCount: byClass(CLASS.DATED).length,
    bySource,
    anteilGeschaetzt: Math.round(((bySource[SOURCE.SCHAETZUNG] || 0) / all.length) * 100)
  };
}

/* ===== quantityParser.js ===== */
/**
 * quantityParser.js — Menge und Domäne aus der Bonzeile
 * ================================================================
 * Non-Food-Positionen tragen die Menge fast immer im Artikelnamen:
 * „WASCHMITTEL 20WL", „ZAHNPASTA 75ML", „TOILETTENPAPIER 10ER".
 * Ohne diese Zahl ist kein Grundpreis und keine Reichweite zu rechnen,
 * und der Katalogwert wäre bei jeder abweichenden Packungsgröße falsch.
 *
 * Zweitens die Steuersatz-Heuristik: deutsche Kassenbons weisen den
 * Satz je Position aus. 7 % ist überwiegend Lebensmittel, 19 %
 * überwiegend Non-Food — ein starkes und kostenloses Signal.
 *
 * Es ist aber ein VORFILTER, kein Ersatz für den Produktabgleich. Die
 * Ausnahmen sind zu zahlreich: Getränke, Spirituosen, Tabak und
 * Tiernahrung stehen auf 19 %, Schnittblumen und Zeitschriften auf
 * 7 %. Deshalb greift die Heuristik erst, wenn der Abgleich nichts
 * gefunden hat, und dann nur als Vorschlag zur Bestätigung.
 * ================================================================
 */




// Einheiten, wie sie auf deutschen Bons vorkommen.
const UNIT_ALIASES = {
  ML: "ml", L: "l", CL: "cl",
  G: "g", GR: "g", KG: "kg",
  WL: "WL", WG: "WL",
  ER: "Stück", ST: "Stück", STK: "Stück", STCK: "Stück", STUECK: "Stück",
  BL: "Blatt", BLATT: "Blatt",
  M: "m", METER: "m",
  TAB: "Tab", TABS: "Tab",
  ROLLE: "Rolle", ROLLEN: "Rolle", RL: "Rolle",
  TUCH: "Tuch", TUECHER: "Tuch"
};

const RE_QUANTITY = /(\d+(?:[.,]\d+)?)\s*(ML|CL|L|KG|GR|G|WL|WG|ER|STK|STCK|STUECK|ST|BLATT|BL|METER|M|TABS|TAB|ROLLEN|ROLLE|RL|TUECHER|TUCH)\b/i;

/** Normalisiert Umlaute und Sonderzeichen wie im Produktabgleich. */
const norm = (t) => String(t).toUpperCase()
  .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS");

/**
 * Menge aus einem Artikelnamen ziehen.
 * @returns {null|{value, unit, raw}}
 */
function parseQuantity(text) {
  const m = norm(text).match(RE_QUANTITY);
  if (!m) return null;

  const value = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;

  let unit = UNIT_ALIASES[m[2].toUpperCase()] || m[2].toLowerCase();
  let out = value;

  // Auf die Basiseinheit bringen, in der der Katalog rechnet.
  if (unit === "l") { out = value * 1000; unit = "ml"; }
  else if (unit === "cl") { out = value * 10; unit = "ml"; }
  else if (unit === "kg") { out = value * 1000; unit = "g"; }

  return { value: Math.round(out * 100) / 100, unit, raw: m[0] };
}

/**
 * Packungsmenge für eine Bonposition: erst aus dem Text, sonst aus dem
 * Katalog. Woher der Wert stammt, wird mitgeliefert — ein Katalogwert
 * darf nicht als gemessen durchgehen.
 */
function packageValueFor(productId, rawText) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  const parsed = parseQuantity(rawText || "");
  if (parsed && compatibleUnit(parsed.unit, e.package.unit)) {
    return { value: parsed.value, unit: parsed.unit, source: "bon", confidence: "GEMESSEN" };
  }
  return { value: e.package.value, unit: e.package.unit, source: "katalog", confidence: "REFERENZ" };
}

/** Passt die gefundene Einheit zu der, in der das Produkt rechnet? */
function compatibleUnit(found, expected) {
  if (!found || !expected) return false;
  if (found === expected) return true;
  // „10ER" bei Klopapier meint zehn Rollen, „50ER" bei Gefrierbeuteln
  // fünfzig Stück — Stück und Rolle sind hier dasselbe Zählmaß.
  const countUnits = new Set(["Stück", "Rolle", "Tab", "Blatt", "Tuch"]);
  return countUnits.has(found) && countUnits.has(expected);
}

/* ---------- Steuersatz-Heuristik (§9.1) ---------- */

const VAT = { REDUCED: 7, FULL: 19 };

// 19 %, aber trotzdem kein Haushaltsprodukt.
const FULL_RATE_BUT_FOOD = [
  "WASSER", "COLA", "LIMO", "SAFT", "BIER", "WEIN", "SEKT", "SPIRITUOSE",
  "SCHNAPS", "VODKA", "WHISKY", "GIN", "RUM", "LIKOER", "ENERGY", "EISTEE",
  "TABAK", "ZIGARETTEN", "HUNDEFUTTER", "KATZENFUTTER", "TIERFUTTER", "PFAND"
];

// 7 %, aber trotzdem kein Lebensmittel.
const REDUCED_RATE_BUT_NONFOOD = ["BLUMEN", "ZEITSCHRIFT", "ZEITUNG", "BUCH", "PFLANZE"];

/**
 * Einschätzung der Domäne einer Bonzeile.
 * @returns {{domain, confidence, reason}}  domain: FOOD | NONFOOD | UNKLAR
 */
function guessDomain(rawText, taxClass, vatPercent) {
  const text = norm(rawText || "");

  // Steuerkennzeichen A/B, wie auf Lidl-Bons: A ermäßigt, B voll.
  let vat = vatPercent;
  if (!vat && taxClass) vat = String(taxClass).toUpperCase() === "A" ? VAT.REDUCED : VAT.FULL;

  if (REDUCED_RATE_BUT_NONFOOD.some((w) => text.includes(w))) {
    return { domain: "NONFOOD", confidence: 0.7, reason: "Ausnahme: Non-Food zum ermäßigten Satz" };
  }
  if (FULL_RATE_BUT_FOOD.some((w) => text.includes(w))) {
    return { domain: "FOOD", confidence: 0.7, reason: "Ausnahme: Lebensmittel zum vollen Satz" };
  }
  if (vat === VAT.REDUCED) return { domain: "FOOD", confidence: 0.75, reason: "ermäßigter Steuersatz" };
  if (vat === VAT.FULL) return { domain: "NONFOOD", confidence: 0.6, reason: "voller Steuersatz" };
  return { domain: "UNKLAR", confidence: 0, reason: "kein Steuersatz auf der Zeile" };
}

/**
 * Anreicherung einer bereits zugeordneten Bonposition. Ist ein Produkt
 * erkannt, gilt der Katalog — die Heuristik ist nur für das, was übrig
 * bleibt.
 */
function enrichLine(line) {
  const productId = line.productId;
  const known = productId ? byId(productId) : null;

  if (known) {
    const e = nonFoodFor(productId);
    return {
      ...line,
      domain: known.isFood ? "FOOD" : "NONFOOD",
      domainConfidence: 1,
      domainReason: "im Katalog",
      consumptionClass: e ? e.consumptionClass : null,
      packaging: e ? packageValueFor(productId, line.raw) : null
    };
  }

  const guess = guessDomain(line.raw, line.taxClass, line.vatPercent);
  return {
    ...line,
    domain: guess.domain,
    domainConfidence: guess.confidence,
    domainReason: guess.reason,
    consumptionClass: null,
    packaging: null,
    // Eine Vermutung wird vorgeschlagen, nicht gebucht.
    needsConfirmation: true
  };
}

/* ===== consumptionModel.js ===== */
/**
 * consumptionModel.js — Reichweite von Haushaltsprodukten
 * ================================================================
 * Die Rechnung für `RATE`-Produkte:
 *
 *   tagesverbrauch  = rate × haushaltsgröße^alpha × härtefaktor
 *   restmenge(t)    = letzte Kaufmenge − verbrauchte Tage × verbrauch
 *   reichweite      = restmenge / tagesverbrauch
 *
 * Der Unterschied zur Lebensmittel-Bestandsschätzung ist nicht die
 * Formel, sondern die Datenlage: Non-Food verdirbt nicht, also
 * entspricht die gekaufte Menge tatsächlich der verbrauchten. Bei
 * Lebensmitteln verzerrt der Verderb genau dieses Signal.
 *
 * Die Vorwarnzeit ist NICHT konstant, sondern folgt dem gelernten
 * Einkaufsrhythmus des Haushalts. Wer alle drei Tage einkauft,
 * braucht sieben Tage Vorlauf; wer alle zwei Wochen einkauft, 23.
 * ================================================================
 */





/**
 * Tagesverbrauch eines Produkts in Packungseinheiten — für den GANZEN
 * Haushalt, nicht je Person.
 *
 * `learnedRate` ist bereits eine Haushaltsrate: rateLearner beobachtet,
 * was tatsächlich gekauft wurde, und das ist der Verbrauch aller
 * Personen zusammen. Sie darf deshalb NICHT ein zweites Mal mit der
 * Haushaltsgröße multipliziert werden — genau dieser Fehler ließ in
 * einem Zweipersonenhaushalt jede Packung doppelt so schnell leer
 * erscheinen. Skaliert wird nur der Katalogwert, der pro Person gilt.
 */
function dailyUsage(productId, profile = {}, learnedRate = null) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.RATE) return null;

  if (learnedRate !== null && learnedRate > 0) {
    return Math.round(learnedRate * 1000) / 1000;
  }

  // Haushaltsgröße 0 ist kein sinnvoller Zustand, käme über eine
  // fehlerhafte Sicherung aber durch — und 0^0 wäre 1, also eine
  // stille Falschaussage statt eines Fehlers.
  const persons = Math.max(1, Number(profile.personCount) || 1);
  const scale = Math.pow(persons, e.scalingExponent);

  // Härteres Wasser heißt mehr Waschmittel je Ladung. Der Faktor
  // wirkt umgekehrt zum Entkalkungsintervall: 0,6 verkürzt dort das
  // Intervall, hier erhöht er den Verbrauch — deshalb der Kehrwert.
  const hardness = e.hardnessSensitive
    ? 1 / (HARDNESS_FACTOR[profile.waterHardness] || 1)
    : 1;

  const usage = e.baseRatePerPersonPerDay * scale * hardness;
  return usage > 0 ? Math.round(usage * 1000) / 1000 : null;
}

/**
 * Reichweite eines Produkts.
 * @param {object} entry   { productId, purchases:[{date, quantity, packageValue}] }
 * @param {string} today
 * @param {object} profile Haushaltsprofil
 * @param {object} opts    { learnedRate, confidence, pausedDays }
 */
function supplyFor(entry, today, profile = {}, opts = {}) {
  const productId = entry.productId;
  const e = nonFoodFor(productId);
  const p = byId(productId);
  if (!e || !p) return null;
  if (!appliesTo(productId, profile)) return null;

  // SPORADIC darf NIE eine Reichweite ausgeben. Lieber keine Aussage
  // als eine schlechte — das ist der Zweck dieser Klasse.
  if (e.consumptionClass === CLASS.SPORADIC) {
    return {
      productId, name: p.name, consumptionClass: e.consumptionClass,
      daysOfSupply: null, remaining: null, confidence: "UNREGELMAESSIG",
      dueForPurchase: false,
      message: `${p.name} kaufst du unregelmäßig — keine Vorhersage.`
    };
  }
  if (e.consumptionClass !== CLASS.RATE) return null;

  const purchases = (entry.purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!purchases.length) return null;

  const usage = dailyUsage(productId, profile, opts.learnedRate);
  if (!usage) return null;

  const last = purchases[purchases.length - 1];
  const packageValue = Number(last.packageValue) || e.package.value;
  const bought = packageValue * (Number(last.quantity) || 1);

  // Urlaubstage zählen nicht als Verbrauchstage.
  const elapsed = Math.max(0, daysBetween(last.date, today) - (opts.pausedDays || 0));
  const remaining = Math.max(0, bought - elapsed * usage);
  const daysOfSupply = Math.round((remaining / usage) * 10) / 10;

  const lead = leadTime(profile);
  const confidence = opts.confidence || "REFERENZ";

  return {
    productId,
    name: p.name,
    consumptionClass: e.consumptionClass,
    dailyUsage: usage,
    unit: e.package.unit,
    packageValue,
    bought,
    remaining: Math.round(remaining * 10) / 10,
    daysOfSupply,
    lastPurchase: last.date,
    leadTime: lead,
    // Bei UNSICHER wird gar nichts vorhergesagt — auch kein Nachkauf.
    dueForPurchase: confidence !== "UNSICHER" && daysOfSupply <= lead,
    confidence,
    estimated: true,
    message: confidence === "UNSICHER"
      ? `${p.name} kaufst du unregelmäßig — keine Vorhersage.`
      : daysOfSupply <= 0
        ? `${p.name} ist vermutlich leer.`
        : `${p.name} reicht noch etwa ${Math.round(daysOfSupply)} ${Math.round(daysOfSupply) === 1 ? "Tag" : "Tage"}.`
  };
}

/**
 * Vorwarnzeit aus dem eigenen Einkaufsrhythmus (§5.3).
 * Ohne gelernten Rhythmus ein Wochenrhythmus als Annahme.
 */
function leadTime(profile = {}) {
  const interval = Number(profile.shoppingIntervalDays) || 7;
  return Math.round(interval * 1.5 + 2);
}

/** Alle Haushaltsprodukte eines Haushalts auswerten. */
function supplyOverview(entries, today, profile = {}, rates = new Map()) {
  const out = [];
  for (const entry of entries) {
    const r = rates.get(entry.productId) || {};
    const s = supplyFor(entry, today, profile, {
      learnedRate: r.rate ?? null,
      confidence: r.confidence,
      pausedDays: entry.pausedDays || 0
    });
    if (s) out.push(s);
  }
  // Das Knappste zuerst; ohne Vorhersage ans Ende.
  return out.sort((a, b) => {
    if (a.daysOfSupply === null) return 1;
    if (b.daysOfSupply === null) return -1;
    return a.daysOfSupply - b.daysOfSupply;
  });
}

/* ===== rateLearner.js ===== */
/**
 * rateLearner.js — Verbrauchsrate aus der eigenen Historie
 * ================================================================
 * Das Kaltstartproblem ist bei Haushaltsprodukten größer als bei
 * Lebensmitteln: Zahnpasta wird alle sieben Wochen gekauft, für drei
 * Datenpunkte braucht es fünf Monate. Reines Lernen aus Kaufabständen
 * ist für den Einstieg damit unbrauchbar.
 *
 * Deshalb Referenzwert als Prior, Beobachtung als Posterior:
 *
 *   rate = (w_prior × referenz + w_daten × beobachtet) / (w_prior + w_daten)
 *   w_daten = min(anzahl_käufe, 6),  w_prior = 2
 *
 * Nach sechs Käufen bestimmt die Beobachtung drei Viertel des Werts.
 * Kein externes Modell, keine Bibliothek, jeder Schritt nachrechenbar.
 *
 * Die beobachtete Rate wird über ein gleitendes Fenster gebildet, NICHT
 * über einzelne Kaufabstände: sonst zerstört jeder Vorratskauf die
 * Schätzung. Wer drei Packungen auf einmal kauft, hat nicht plötzlich
 * den dreifachen Verbrauch — er hat länger Ruhe.
 * ================================================================
 */




const WINDOW_DAYS = 180;
// Heißt nicht MIN_PURCHASES — den Namen vergibt priceMemory.js, und
// beide teilen sich im Bündel denselben Namensraum.
const MIN_PURCHASES_FOR_RATE = 2;
const W_PRIOR = 2;
const MAX_W_DATA = 6;
const VK_THRESHOLD = 0.35;     // darüber: unregelmäßig, keine Prognose

const CONFIDENCE = {
  REFERENZ: "REFERENZ",
  VORLAEUFIG: "VORLAEUFIG",
  GELERNT: "GELERNT",
  UNSICHER: "UNSICHER"
};

const CONFIDENCE_LABEL = {
  REFERENZ: "Schätzwert — noch nicht an dich angepasst",
  VORLAEUFIG: "Vorläufig",
  GELERNT: "Aus deinen Käufen gelernt",
  UNSICHER: "Du kaufst das unregelmäßig"
};

/** Variationskoeffizient der Kaufabstände: Streuung geteilt durch Mittel. */
function variationCoefficient(intervals) {
  if (intervals.length < 2) return 0;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return 0;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Rate für ein Produkt.
 * @param {string} productId
 * @param {Array}  purchases [{date, quantity, packageValue}]
 * @param {string} today
 * @param {object} profile   Haushaltsprofil (nur für den Prior)
 * @returns {{rate, confidence, label, observed, reference, purchases, vk, windowDays}}
 */
function learnRate(productId, purchases, today, profile = {}) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.RATE) return null;

  const persons = Math.max(1, Number(profile.personCount) || 1);
  // Der Prior ist die Referenzrate FÜR DIESEN HAUSHALT — sonst
  // mischte man eine Pro-Kopf-Zahl mit einer Haushaltsbeobachtung.
  const reference = e.baseRatePerPersonPerDay * Math.pow(persons, e.scalingExponent);

  const rows = (purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const base = {
    productId, reference: Math.round(reference * 1000) / 1000,
    purchases: rows.length, windowDays: WINDOW_DAYS
  };

  if (rows.length < MIN_PURCHASES_FOR_RATE) {
    return {
      ...base, rate: Math.round(reference * 1000) / 1000, observed: null, vk: null,
      confidence: CONFIDENCE.REFERENZ, label: CONFIDENCE_LABEL.REFERENZ
    };
  }

  // Gleitendes Fenster: alles, was innerhalb der letzten 180 Tage
  // gekauft wurde. Der letzte Kauf zählt NICHT mit — er ist noch nicht
  // verbraucht, sonst rechnete man ihn als schon konsumiert.
  const windowStart = new Date(new Date(today + "T12:00:00Z").getTime() - WINDOW_DAYS * 86400000)
    .toISOString().slice(0, 10);
  const inWindow = rows.filter((r) => r.date >= windowStart);
  const consumed = inWindow.slice(0, -1);

  let observed = null;
  if (consumed.length >= 1) {
    const first = consumed[0].date;
    const lastDate = inWindow[inWindow.length - 1].date;
    const span = Math.max(1, daysBetween(first, lastDate));
    const amount = consumed.reduce(
      (a, r) => a + (Number(r.packageValue) || e.package.value) * (Number(r.quantity) || 1), 0);
    observed = amount / span;
  }

  const intervals = [];
  for (let i = 1; i < rows.length; i++) intervals.push(daysBetween(rows[i - 1].date, rows[i].date));
  const vk = Math.round(variationCoefficient(intervals) * 100) / 100;

  const wData = Math.min(rows.length, MAX_W_DATA);
  const rate = observed !== null && observed > 0
    ? (W_PRIOR * reference + wData * observed) / (W_PRIOR + wData)
    : reference;

  let confidence;
  if (rows.length >= 4 && vk >= VK_THRESHOLD) confidence = CONFIDENCE.UNSICHER;
  else if (rows.length >= 4) confidence = CONFIDENCE.GELERNT;
  else confidence = CONFIDENCE.VORLAEUFIG;

  return {
    ...base,
    rate: Math.round(rate * 1000) / 1000,
    observed: observed !== null ? Math.round(observed * 1000) / 1000 : null,
    vk,
    confidence,
    label: confidence === CONFIDENCE.VORLAEUFIG
      ? `Vorläufig, basiert auf ${rows.length} Käufen`
      : CONFIDENCE_LABEL[confidence]
  };
}

/** Raten für alle Produkte eines Haushalts. */
function learnAllRates(entries, today, profile = {}) {
  const out = new Map();
  for (const entry of entries) {
    const r = learnRate(entry.productId, entry.purchases, today, profile);
    if (r) out.set(entry.productId, r);
  }
  return out;
}

/* ===== intervalTracker.js ===== */
/**
 * intervalTracker.js — zeitbasierter Austausch
 * ================================================================
 * Zahnbürste, Küchenschwamm, Wasserfilter: ersetzt wird nach Zeit,
 * unabhängig von der verbrauchten Menge. Meist hygienisch begründet.
 *
 * Das ist die Klasse mit dem schnellsten Nutzen im ganzen Modell:
 * kein Verbrauchsmodell, kein Lernen, keine Historie. Kaufdatum plus
 * Intervall genügt, und die App weiß etwas, an das von selbst niemand
 * denkt — nach drei Monaten fällt keine Zahnbürste durch Nachdenken
 * auf.
 *
 * Das Ergebnis sind HANDLUNGEN, keine Käufe: „getauscht" setzt den
 * Zähler zurück, ohne dass etwas gekauft wurde. Wer eine Packung mit
 * vier Aufsteckbürsten kauft, tauscht viermal aus einem Kauf.
 * ================================================================
 */





/** Intervall eines Produkts, ggf. an die Wasserhärte angepasst. */
function intervalFor(productId, profile = {}) {
  const e = nonFoodFor(productId);
  if (!e || e.consumptionClass !== CLASS.INTERVAL) return null;
  const factor = e.hardnessSensitive
    ? (HARDNESS_FACTOR[profile.waterHardness] || 1)
    : 1;
  return Math.max(1, Math.round(e.replacementIntervalDays * factor));
}

/**
 * Fälligkeit eines Austausch-Produkts.
 * @param {object} entry  { productId, lastSwap, purchases }
 * @param {string} today
 * @param {object} profile
 * @param {number} pausedDays  Urlaubstage, sofern das Produkt pausiert
 */
function swapStatus(entry, today, profile = {}, pausedDays = 0) {
  const e = nonFoodFor(entry.productId);
  const p = byId(entry.productId);
  if (!e || !p || e.consumptionClass !== CLASS.INTERVAL) return null;
  if (!appliesTo(entry.productId, profile)) return null;

  // Bezugspunkt ist der letzte Tausch, ersatzweise der letzte Kauf.
  const purchases = (entry.purchases || [])
    .filter((x) => x.date && x.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastPurchase = purchases.length ? purchases[purchases.length - 1].date : null;
  const since = entry.lastSwap || lastPurchase;
  if (!since) return null;

  const interval = intervalFor(entry.productId, profile);

  // Eine Zahnbürste altert auch im Urlaub — sie wird mitgenommen.
  // Ein Küchenschwamm liegt trocken und altert nicht. Deshalb steht
  // `pausesOnVacation` am Produkt und nicht am Modus.
  const paused = e.pausesOnVacation ? Math.max(0, pausedDays) : 0;
  const inUse = Math.max(0, daysBetween(since, today) - paused);
  const daysLeft = interval - inUse;

  return {
    productId: p.id,
    name: p.name,
    consumptionClass: CLASS.INTERVAL,
    since,
    fromSwap: !!entry.lastSwap,
    inUse,
    intervalDays: interval,
    baseIntervalDays: e.replacementIntervalDays,
    hardnessAdjusted: e.hardnessSensitive && interval !== e.replacementIntervalDays,
    source: e.intervalSource,
    daysLeft,
    due: daysLeft <= 0,
    soon: daysLeft > 0 && daysLeft <= 7,
    pausesOnVacation: e.pausesOnVacation,
    pausedDays: paused,
    message: daysLeft <= 0
      ? `${p.name} seit ${inUse} Tagen im Einsatz — tauschen.`
      : `${p.name} fällig in ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tagen"}.`
  };
}

/** Alle Austausch-Produkte, das Überfälligste zuerst. */
function dueSwaps(entries, today, profile = {}, pausedDays = 0) {
  const out = [];
  for (const entry of entries) {
    const s = swapStatus(entry, today, profile, entry.pausedDays ?? pausedDays);
    if (s) out.push(s);
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Nach dem Tausch: neuer Bezugspunkt. Reine Funktion, damit der Aufrufer
 * entscheidet, wann gespeichert wird.
 */
function recordSwap(entry, today) {
  return { ...entry, lastSwap: today };
}

/**
 * Braucht der Haushalt Nachschub? Ein Tausch verbraucht ein Stück aus
 * der Packung — bei vier Aufsteckbürsten reicht ein Kauf für vier
 * Tauschvorgänge.
 */
function needsRestock(entry, today, profile = {}) {
  const e = nonFoodFor(entry.productId);
  if (!e || e.consumptionClass !== CLASS.INTERVAL) return false;

  const purchases = (entry.purchases || []).filter((x) => x.date && x.date <= today);
  if (!purchases.length) return false;

  const packSize = e.package.value || 1;
  const bought = purchases.reduce((a, r) => a + packSize * (Number(r.quantity) || 1), 0);
  const swaps = (entry.swaps || []).filter((d) => d <= today).length;
  return bought - swaps <= 0;
}

/* ===== basePrice.js ===== */
/**
 * basePrice.js — Grundpreis und persönliches Preisperzentil
 * ================================================================
 * Bei Haushaltsprodukten ist der Preisvergleich deutlich wertvoller
 * als bei Lebensmitteln: die Packungsgrößen streuen extrem (20 gegen
 * 80 Waschladungen) und die Werbung arbeitet mit Absolutpreisen. Der
 * Grundpreis ist die einzige Zahl, die vergleichbar ist.
 *
 * Bewertet wird AUSSCHLIESSLICH gegen die eigene Kaufhistorie. Keine
 * Preis-API, keine Fremddaten, kein Vergleich über Haushalte hinweg —
 * das wäre Wartungslast und Rechtsrisiko für eine Aussage, die lokal
 * genauso gut zu haben ist: ob dieser Preis für DICH gut ist.
 * ================================================================
 */




// Darunter keine Aussage — nicht etwa Perzentil 0.
const MIN_PRICE_POINTS = 4;

/**
 * Grundpreis je Normeinheit.
 * @returns {null|{value, label, display, packageValue, unit}}
 */
function basePrice(productId, price, packageValue, quantity = 1) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  // Fehlend und ungültig sind zweierlei:
  //   undefined/null = keine Angabe  -> Katalogwert als Behelf
  //   0 oder negativ = falsche Angabe -> gar kein Grundpreis
  // Ohne diese Trennung würde eine „0 ml"-Zeile still mit der
  // Katalogmenge weitergerechnet und sähe aus wie eine Messung.
  const givenAmount = packageValue === undefined || packageValue === null || packageValue === ""
    ? e.package.value
    : Number(packageValue);
  const qty = quantity === undefined || quantity === null ? 1 : Number(quantity);

  if (price === undefined || price === null || price === "") return null;
  const total = Number(price);

  // Sonst entstünde hier NaN oder Infinity und wanderte durch alle
  // Folgerechnungen bis in die Anzeige.
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(givenAmount) || givenAmount <= 0) return null;
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const amount = givenAmount;

  const norm = e.package.norm;
  const units = (amount * qty) / norm.per;
  if (!Number.isFinite(units) || units <= 0) return null;

  const value = total / units;
  if (!Number.isFinite(value)) return null;

  return {
    productId,
    value: Math.round(value * 1000) / 1000,
    label: norm.label,
    display: `${value.toFixed(2).replace(".", ",")} € je ${norm.label}`,
    packageValue: amount,
    unit: e.package.unit
  };
}

/**
 * Einordnung eines Grundpreises in die eigene Historie.
 * @param {Array} history [{price, packageValue, quantity, date}]
 * @returns {null|{percentile, verdict, median, lowest, highest, points, message}}
 */
function pricePercentile(productId, current, history) {
  const p = byId(productId);
  if (!p) return null;

  const points = (history || [])
    .map((h) => basePrice(productId, h.price, h.packageValue, h.quantity))
    .filter((x) => x && x.value > 0)
    .map((x) => x.value);

  // Unter vier Datenpunkten ist „günstig" eine Behauptung.
  if (points.length < MIN_PRICE_POINTS || !Number.isFinite(current) || current <= 0) {
    return {
      productId, percentile: null, verdict: "unbekannt",
      median: null, lowest: null, highest: null, points: points.length,
      message: `Noch zu wenig Historie für eine Preisaussage (${points.length} von ${MIN_PRICE_POINTS}).`
    };
  }

  const sorted = [...points].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < current).length;
  const percentile = below / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const verdict = percentile < 0.25 ? "günstig" : percentile > 0.75 ? "teuer" : "normal";
  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";
  const norm = nonFoodFor(productId).package.norm;

  return {
    productId,
    percentile: Math.round(percentile * 100) / 100,
    verdict,
    median: Math.round(median * 1000) / 1000,
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
    points: sorted.length,
    message: verdict === "günstig"
      ? `${eur(current)} je ${norm.label} — günstig für dich (sonst ${eur(median)}).`
      : verdict === "teuer"
        ? `${eur(current)} je ${norm.label} — teuer für dich (sonst ${eur(median)}).`
        : `${eur(current)} je ${norm.label} — normal für dich.`
  };
}

/**
 * Ersparnis aus günstigen Einkäufen (§8.3).
 *
 * Getrennt von der Lebensmittel-Ersparnis auszuweisen: die eine Zahl
 * ist realisiert (du hast weniger gezahlt), die andere kontrafaktisch
 * (du hättest sonst weggeworfen). Beides zu addieren wäre irreführend.
 */
function nonFoodSavings(entries, today) {
  let total = 0;
  const byProduct = [];

  for (const entry of entries) {
    const e = nonFoodFor(entry.productId);
    const p = byId(entry.productId);
    if (!e || !p) continue;

    const rows = (entry.purchases || []).filter((x) => x.date && x.date <= today);
    const prices = rows
      .map((h) => ({ h, bp: basePrice(entry.productId, h.price, h.packageValue, h.quantity) }))
      .filter((x) => x.bp);
    if (prices.length < MIN_PRICE_POINTS) continue;

    const sorted = prices.map((x) => x.bp.value).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Nur Käufe UNTER dem Median zählen als Ersparnis. Käufe darüber
    // gegenzurechnen wäre eine Strafe für normales Einkaufen.
    let saved = 0;
    for (const { h, bp } of prices) {
      if (bp.value >= median) continue;
      const units = ((Number(h.packageValue) || e.package.value) * (Number(h.quantity) || 1)) / e.package.norm.per;
      saved += (median - bp.value) * units;
    }
    if (saved <= 0.01) continue;

    total += saved;
    byProduct.push({
      productId: entry.productId, name: p.name,
      saved: Math.round(saved * 100) / 100,
      median: Math.round(median * 1000) / 1000,
      purchases: prices.length
    });
  }

  return {
    total: Math.round(total * 100) / 100,
    byProduct: byProduct.sort((a, b) => b.saved - a.saved),
    basis: "eigene Kaufhistorie, Median als Bezug",
    realised: true
  };
}

/* ===== stockUpAdvisor.js ===== */
/**
 * stockUpAdvisor.js — Bevorratung bei gutem Preis
 * ================================================================
 * Non-Food verdirbt nicht: Vorrat bei gutem Preis ist rational, aber
 * durch Lagerplatz und Kapitalbindung begrenzt. Sinnvolle Zielgröße
 * ist der eigene Aktionszyklus — so viel, dass es bis zum nächsten
 * günstigen Angebot reicht, nicht mehr.
 *
 * BEWUSSTE ZURÜCKHALTUNG: Ein Vorschlag zum Mehrkauf setzt eine
 * GELERNTE Verbrauchsrate voraus. Ein Vorratsstapel, der nach vierzehn
 * Monaten noch steht, ist ein Vertrauensverlust und genau das
 * Gegenteil des Produktversprechens. Im Zweifel schweigt die App.
 * ================================================================
 */








const MIN_CYCLE_POINTS = 6;   // darunter der Vorgabewert statt eines gelernten

/**
 * Aktionszyklus aus der eigenen Grundpreishistorie: mittlerer Abstand
 * zwischen lokalen Minima. Erst ab sechs Datenpunkten.
 */
function learnPromoCycle(productId, history) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  const points = (history || [])
    .map((h) => ({ date: h.date, bp: basePrice(productId, h.price, h.packageValue, h.quantity) }))
    .filter((x) => x.date && x.bp)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < MIN_CYCLE_POINTS) {
    return { days: e.promoCycleDaysDefault, learned: false, points: points.length };
  }

  const minima = [];
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].bp.value < points[i - 1].bp.value && points[i].bp.value <= points[i + 1].bp.value) {
      minima.push(points[i].date);
    }
  }
  if (minima.length < 2) {
    return { days: e.promoCycleDaysDefault, learned: false, points: points.length };
  }

  const gaps = [];
  for (let i = 1; i < minima.length; i++) gaps.push(daysBetween(minima[i - 1], minima[i]));
  const mean = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);

  return { days: Math.max(7, mean), learned: true, points: points.length, minima: minima.length };
}

/**
 * Bevorratungsempfehlung.
 * @param {object} supply   Ergebnis aus consumptionModel.supplyFor
 * @param {object} opts     { history, currentPrice, currentPackage, profile, storageLimit }
 * @returns {null|{units, targetDays, reason, percentile, message}}
 */
function stockUpAdvice(supply, opts = {}) {
  if (!supply || supply.consumptionClass !== CLASS.RATE) return null;

  const e = nonFoodFor(supply.productId);
  const p = byId(supply.productId);
  if (!e || !p) return null;

  // Ohne gelernte Rate kein Mehrkauf-Vorschlag. Das ist die wichtigste
  // Bremse in diesem Modul.
  if (supply.confidence !== CONFIDENCE.GELERNT) {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "rate_unsicher",
      message: "Für einen Vorratskauf ist der Verbrauch noch nicht sicher genug gelernt."
    };
  }

  const current = basePrice(supply.productId, opts.currentPrice, opts.currentPackage);
  if (!current) return null;

  const pct = pricePercentile(supply.productId, current.value, opts.history || []);
  if (!pct || pct.percentile === null) {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "preis_unbekannt", percentile: null,
      message: pct ? pct.message : "Noch keine Preishistorie."
    };
  }
  if (pct.verdict !== "günstig") {
    return {
      productId: supply.productId, name: p.name, units: 0,
      reason: "preis_normal", percentile: pct.percentile,
      message: pct.message
    };
  }

  const cycle = learnPromoCycle(supply.productId, opts.history || []);
  const usage = supply.dailyUsage || dailyUsage(supply.productId, opts.profile || {});
  if (!usage || usage <= 0) return null;

  const packageValue = Number(opts.currentPackage) || e.package.value;
  const need = cycle.days * usage - (supply.remaining || 0);
  const raw = Math.ceil(need / packageValue);
  const limit = Number.isFinite(opts.storageLimit) ? opts.storageLimit : e.storageLimitDefault;
  const units = Math.min(Math.max(raw, 0), limit);

  const eur = (n) => n.toFixed(2).replace(".", ",") + " €";
  return {
    productId: supply.productId,
    name: p.name,
    units,
    targetDays: cycle.days,
    cycleLearned: cycle.learned,
    storageLimit: limit,
    cappedByLimit: raw > limit,
    percentile: pct.percentile,
    reason: units > 0 ? "guenstig" : "vorrat_reicht",
    message: units > 0
      ? `${units} ${units === 1 ? "Packung" : "Packungen"} decken ${cycle.days} Tage — ` +
        `${eur(current.value)} je ${current.label} statt ${eur(pct.median)}.`
      : `Preis ist günstig, aber dein Vorrat reicht noch über den Aktionszyklus.`
  };
}

/* ===== feedbackLearner.js ===== */
/**
 * feedbackLearner.js — aus Rückmeldungen lernen
 * ================================================================
 * Bisher war die Rückmeldung des Nutzers folgenlos: „Hab noch da"
 * hat die Position abgewählt und war danach vergessen. Wer dreimal
 * hintereinander sagt, dass Klopapier noch reicht, bekommt es beim
 * vierten Mal wieder vorgeschlagen. Das fühlt sich an wie Ignorieren
 * — und ist der teuerste Fehler, den eine App machen kann, die
 * behauptet zu lernen.
 *
 * WAS EIN SIGNAL IST UND WAS NICHT
 *
 *   „Hab noch da"        Vorschlag kam ZU FRÜH.  -> Rhythmus verlängern
 *   Kauf vor Fälligkeit  Vorschlag kam ZU SPÄT.  -> Rhythmus verkürzen
 *   „Verbraucht"         sagt nichts über den Rhythmus, nur über den
 *                        Bestand. Bewusst NEUTRAL — die Oberfläche
 *                        verspricht genau das: „Rhythmus bleibt".
 *   „Diese Woche nicht"  bewusste Pause, kein Verhaltensmuster.
 *                        Ebenfalls neutral.
 *
 * WARUM NICHT EINFACH MITTELN
 *
 * Der Median über die Kaufabstände ist die tragende Idee des ganzen
 * Rhythmusmodells: er macht das Lernen unempfindlich gegen einzelne
 * Ausreißer. Ein Feedback-Mechanismus, der auf den Mittelwert setzt,
 * würde genau diese Eigenschaft wieder zerstören — ein versehentlicher
 * Tap könnte den Rhythmus kippen. Also auch hier: Median über die
 * Einzelkorrekturen, Mindestanzahl, Deckelung, Verfall.
 *
 * WAS DIESES MODUL NICHT TUT
 *
 * Es fasst die Rohdaten nicht an. Käufe bleiben Käufe. Die Korrektur
 * ist ein eigener, jederzeit abschaltbarer Faktor auf das Ergebnis —
 * und sie ist im Detail-Blatt sichtbar, samt Anzahl der Rückmeldungen,
 * auf denen sie beruht.
 * ================================================================
 */



const REASON = {
  HAVE: "have",           // „Hab noch da"       -> zu früh vorgeschlagen
  EMPTY: "empty",         // „War schon alle"    -> zu spät vorgeschlagen
  CONSUMED: "consumed",   // „Verbraucht"        -> neutral
  SKIP: "skip"            // „Diese Woche nicht" -> neutral
};

const MAX_AGE_DAYS = 180;        // älteres Feedback beschreibt einen alten Haushalt
const MIN_SIGNALS = 3;           // darunter wird nichts korrigiert
const MAX_ADJUST = 0.4;          // Korrektur nie über ±40 %
const MAX_WEIGHT_SIGNALS = 8;    // ab hier wächst der Einfluss nicht weiter
const DISAGREEMENT_THRESHOLD = 0.3;  // Streuung, ab der die Korrektur schrumpft
// Kleinster Rhythmus, mit dem dieses Modul überhaupt rechnet. Alles
// darunter ist kein Einkaufsrhythmus, sondern ein Fehler weiter oben.
const MIN_VALID_RHYTHM_DAYS = 1;
// Alle Signale stammen jetzt aus Nutzeraussagen und wiegen gleich.
// Eine Gewichtung gegen abgeleitete Signale ist nicht mehr nötig —
// abgeleitete gibt es keine mehr (siehe unten).
const EXPLICIT_WEIGHT = 1;

/** Median einer Zahlenliste. Heißt nicht `medianOf` — den Namen
    vergibt priceMemory.js, und beide teilen sich im Bündel denselben
    Namensraum. */
function medianOfSignals(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Ein einzelnes Feedback in eine relative Korrektur übersetzen.
 *
 * `dueIn` ist die Fälligkeit zum Zeitpunkt der Rückmeldung: 0 heißt
 * „heute fällig", negativ heißt „war schon überfällig". Je überfälliger
 * ein Produkt war, als der Nutzer „hab noch da" sagte, desto stärker
 * lag der Rhythmus daneben.
 *
 * @returns {null|number} relative Korrektur, z. B. +0.2 = 20 % länger
 */
function signalFor(entry, rhythmDays) {
  if (!rhythmDays || rhythmDays <= 0) return null;

  if (entry.reason === REASON.HAVE) {
    // Der Vorschlag kam zu früh. Wie viel zu früh, lässt sich nicht
    // messen — der Nutzer sagt nur „noch da", nicht „noch fünf Tage".
    // Ein überfälliges Produkt, das noch da ist, liegt weiter daneben
    // als ein gerade erst fälliges.
    const overdue = Math.max(0, -(Number(entry.dueIn) || 0));
    const relative = (rhythmDays * 0.15 + overdue) / rhythmDays;
    return Math.min(MAX_ADJUST, relative);
  }

  if (entry.reason === REASON.EMPTY) {
    // Der Vorschlag kam zu spät: das Produkt war schon aufgebraucht.
    // Je später er kam, desto weiter lag der Rhythmus daneben — hier
    // ist `dueIn` positiv, das Produkt war also noch gar nicht fällig.
    const late = Math.max(0, Number(entry.dueIn) || 0);
    const relative = (rhythmDays * 0.15 + late) / rhythmDays;
    return -Math.min(MAX_ADJUST, relative);
  }

  // „Verbraucht" und „Diese Woche nicht" sagen nichts über den
  // Rhythmus. Sie werden protokolliert, aber nicht verrechnet.
  return null;
}

/**
 * Korrektur für ein Produkt aus seinem Feedback-Protokoll.
 *
 * @param {Array}  log         [{productId, date, reason, dueIn}]
 * @param {number} rhythmDays  bisher gelernter Rhythmus
 * @param {string} today
 * @returns {{factor, adjustedDays, signals, considered, neutral, disagreement, applied, reason, message}}
 */
/**
 * Ist diese Rückmeldung schon im Rhythmus enthalten?
 *
 * DER PUNKT, AN DEM DIESES MODUL ZWEIMAL DASSELBE ZÄHLTE:
 *
 * „Hab noch da" heißt, dass NICHT gekauft wurde. Sobald danach ein
 * Kauf stattfindet, ist der dadurch verlängerte Abstand in den Daten
 * — und der Median hat ihn gesehen. Die Korrektur trotzdem weiter
 * anzuwenden, verschiebt einen Rhythmus, der sich bereits verschoben
 * hat. Zweimal derselbe Schluss aus derselben Tatsache.
 *
 * In der Drei-Jahres-Simulation kostete das die Hälfte der
 * Trefferquote: nach dem Auszug einer Person häuften sich die
 * „Hab noch"-Antworten, die Rhythmen wurden verlängert — einmal durch
 * die längeren Kaufabstände und ein zweites Mal durch die Korrektur.
 * Die App schlug danach so spät vor, dass sie nur noch 36 % dessen
 * auf die Liste brachte, was der Haushalt brauchte.
 *
 * „War schon alle" verhält sich anders und wird deshalb NICHT
 * verfallen gelassen: dass etwas vor dem Kauf bereits leer war, steht
 * in keinem Kaufabstand. Zwei Käufe im Abstand von zehn Tagen sehen
 * gleich aus, ob dazwischen drei Tage nichts da war oder nicht. Diese
 * Aussage kann nur der Nutzer liefern, und sie bleibt gültig, bis sie
 * veraltet.
 */
function isAbsorbed(entry, lastPurchaseDate) {
  if (!lastPurchaseDate) return false;
  if (entry.reason !== REASON.HAVE) return false;
  return entry.date <= lastPurchaseDate;
}

function feedbackAdjustment(log, rhythmDays, today, opts = {}) {
  const base = {
    factor: 1,
    adjustedDays: rhythmDays,
    signals: 0,
    considered: 0,
    neutral: 0,
    disagreement: 0,
    absorbed: 0,
    applied: false,
    reason: "kein_feedback",
    message: null
  };

  // Ungültiger Rhythmus kommt unverändert zurück — dieses Modul ist
  // nicht die Stelle, an der so etwas repariert wird. „Alle 0,5 Tage"
  // ist kein Einkaufsrhythmus, sondern ein Rechenfehler weiter oben;
  // ihn hier auf 1 zu runden würde ihn verstecken.
  if (!rhythmDays || !Number.isFinite(rhythmDays) || rhythmDays < MIN_VALID_RHYTHM_DAYS) {
    return { ...base, adjustedDays: rhythmDays, reason: "kein_rhythmus" };
  }
  if (!Array.isArray(log) || !log.length) return base;

  // Nur Rückmeldungen aus dem Beobachtungszeitraum. Was jemand vor
  // einem Jahr angetippt hat, beschreibt einen anderen Haushalt.
  const lastPurchaseDate = opts.lastPurchaseDate || null;
  let absorbed = 0;
  const fresh = log.filter((e) => {
    if (!e || !e.date || e.date > today) return false;
    if (daysBetween(e.date, today) > MAX_AGE_DAYS) return false;
    if (isAbsorbed(e, lastPurchaseDate)) { absorbed++; return false; }
    return true;
  });
  if (!fresh.length) {
    return { ...base, absorbed, reason: absorbed ? "im_rhythmus_enthalten" : "nur_altes_feedback" };
  }

  // Gewichtung über Mehrfachnennung: das ist ein gewichteter Median,
  // ohne dafür eine eigene Implementierung zu brauchen.
  const adjustments = [];
  const rawSignals = [];
  let neutral = 0;
  let explicitCount = 0;
  for (const e of fresh) {
    const s = signalFor(e, rhythmDays);
    if (s === null || !Number.isFinite(s)) { neutral++; continue; }
    rawSignals.push(s);
    explicitCount++;
    adjustments.push(s);
  }

  // Nach außen zählt die Zahl der Rückmeldungen, nicht die der Gewichte
  // — „6 Rückmeldungen" wäre eine Lüge, wenn es drei waren.
  const signalCount = fresh.length - neutral;

  if (signalCount < MIN_SIGNALS) {
    return {
      ...base,
      considered: fresh.length,
      signals: signalCount,
      neutral,
      absorbed,
      reason: "zu_wenig_signale",
      message: signalCount
        ? `${signalCount} von ${MIN_SIGNALS} Rückmeldungen — noch keine Anpassung.`
        : null
    };
  }

  // Median statt Mittelwert: ein einzelner Fehltipp darf den Rhythmus
  // nicht kippen. Genau dieselbe Überlegung wie im Rhythmusmodell.
  const central = medianOfSignals(adjustments);

  // Widerspruch messen: streuen die Rückmeldungen stark (mal zu früh,
  // mal zu spät), ist der Rhythmus schlicht unregelmäßig. Dann wird
  // die Korrektur gedämpft statt beherzt in eine Richtung gezogen.
  // Gemessen wird an den UNGEWICHTETEN Signalen — der Widerspruch ist
  // eine Eigenschaft dessen, was gesagt wurde, nicht seiner Gewichte.
  const rawCentre = medianOfSignals(rawSignals);
  const spread = medianOfSignals(rawSignals.map((a) => Math.abs(a - rawCentre))) || 0;
  const disagreement = Math.min(1, spread / Math.max(0.01, MAX_ADJUST));
  const damping = disagreement > DISAGREEMENT_THRESHOLD ? 1 - disagreement : 1;

  // Einfluss wächst mit der Zahl der Rückmeldungen, aber gedeckelt.
  const weight = Math.min(signalCount, MAX_WEIGHT_SIGNALS) / MAX_WEIGHT_SIGNALS;

  const raw = central * weight * damping;
  const clamped = Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, raw));
  const factor = 1 + clamped;

  // Mindestens ein Tag: ein Rhythmus von null Tagen wäre sinnlos und
  // führte weiter unten zu Division durch null.
  const adjustedDays = Math.max(1, Math.round(rhythmDays * factor));

  const percent = Math.round((factor - 1) * 100);
  const message = adjustedDays === rhythmDays
    ? `${signalCount} Rückmeldungen — Rhythmus bleibt bei ${rhythmDays} Tagen.`
    : percent > 0
      ? `${explicitCount || signalCount}× „hab noch da" — Rhythmus von ${rhythmDays} auf ${adjustedDays} Tage verlängert.`
      : `Du kaufst früher als vorhergesagt — Rhythmus von ${rhythmDays} auf ${adjustedDays} Tage verkürzt.`;

  return {
    factor: Math.round(factor * 1000) / 1000,
    adjustedDays,
    signals: signalCount,
    explicitSignals: explicitCount,
    considered: fresh.length,
    neutral,
    absorbed,
    disagreement: Math.round(disagreement * 100) / 100,
    applied: adjustedDays !== rhythmDays,
    reason: "angewandt",
    message
  };
}

/* ---------------------------------------------------------------
 * ENTFERNT: das implizite Gegensignal aus den Kaufdaten.
 *
 * Die Idee war, Käufe zu zählen, die vor der vorhergesagten Fälligkeit
 * lagen, und daraus auf einen zu langen Rhythmus zu schließen. Sie hat
 * einen strukturellen Fehler: der Rhythmus IST der Median der
 * Kaufabstände, also liegt per Konstruktion die Hälfte aller Abstände
 * darunter. Jede Streuung — auch reines Rauschen aus dem Einkaufstag-
 * Raster — erzeugte damit ein einseitiges Verkürzungssignal.
 *
 * In der Demo-Historie feuerten bei völlig stabilem Verhalten (Median
 * exakt 7 Tage) neun Signale, alle in dieselbe Richtung. Der Rhythmus
 * wurde von 7 auf 4 Tage gezogen, und die echten Rückmeldungen des
 * Nutzers kämpften anschließend gegen dieses Phantom an.
 *
 * Dieselben Daten ein zweites Mal auszuwerten kann keine neue
 * Information liefern — nur einen zusätzlichen Fehler. Die Gegenrichtung
 * kommt jetzt dort her, wo sie hingehört: aus einer Aussage des Nutzers
 * („War schon alle").
 * --------------------------------------------------------------- */

/**
 * Rhythmus eines Produkts mit Rückmeldungen korrigieren.
 * Liefert ein neues Objekt; das Original bleibt unangetastet.
 */
function applyFeedback(rhythm, log, today, opts = {}) {
  if (!rhythm) return rhythm;

  // Der letzte Kauf entscheidet, welche „Hab noch"-Antworten schon in
  // den Kaufabständen stecken. `opts.purchases` hat Vorrang, weil dort
  // nach einem Strukturbruch nur die noch gültigen Käufe stehen.
  const rows = Array.isArray(opts.purchases) ? opts.purchases : null;
  const lastPurchaseDate = rows && rows.length
    ? rows.map((p) => p.date).sort().pop()
    : rhythm.lastPurchaseDate || null;

  const adj = feedbackAdjustment(log || [], rhythm.rhythmDays, today, { lastPurchaseDate });

  // Widersprüchliche Rückmeldungen senken das Vertrauen, statt den
  // Rhythmus mit falscher Sicherheit zu verschieben.
  const confidence = adj.signals >= MIN_SIGNALS && adj.disagreement > DISAGREEMENT_THRESHOLD
    ? Math.max(0, Math.round(rhythm.confidence * (1 - adj.disagreement * 0.5) * 100) / 100)
    : rhythm.confidence;

  return {
    ...rhythm,
    rhythmDays: adj.adjustedDays,
    baseRhythmDays: rhythm.rhythmDays,
    confidence,
    feedback: adj
  };
}

/* ===== seasonalRhythm.js ===== */
/**
 * seasonalRhythm.js — Saison aus der EIGENEN Historie
 * ================================================================
 * `seasonCalendar.js` weiß, wann Erdbeeren in Deutschland Saison
 * haben. Das ist Allgemeinwissen und beantwortet nicht die Frage, um
 * die es hier geht: kaufst DU im Sommer mehr Grillfleisch?
 *
 * Der gelernte Rhythmus ist bisher ein einziger Wert über den ganzen
 * Beobachtungszeitraum. Wer im Juli wöchentlich grillt und im Januar
 * gar nicht, bekommt das Mittel aus beidem — im Januar zu oft
 * vorgeschlagen, im Juli zu selten.
 *
 * VORSICHT IST HIER WICHTIGER ALS GENAUIGKEIT. Ein Jahresmuster aus
 * elf Monaten Daten zu lesen ist Kaffeesatz. Deshalb:
 *
 *   - mindestens 12 Monate Historie, sonst gar kein Faktor
 *   - mindestens 8 Käufe, verteilt über mindestens 6 Monate
 *   - Faktor gedeckelt auf ±35 %
 *   - Quartale statt Monate: ein einzelner Monat hat zu wenig Käufe,
 *     um ein Muster von Zufall zu unterscheiden
 *
 * Reicht die Datenlage nicht, liefert das Modul den Faktor 1 und sagt
 * warum. Kein Muster zu behaupten ist hier die richtige Antwort.
 * ================================================================
 */



const MIN_HISTORY_DAYS = 365;
// Heißt nicht MIN_PURCHASES_FOR_SEASON — den Namen vergibt priceMemory.js.
const MIN_PURCHASES_FOR_SEASON = 8;
const MIN_QUARTERS = 3;
const MAX_SEASONAL_ADJUST = 0.35;
// Quartale sind unterschiedlich lang (90–92 Tage). Ein festes Kaufraster
// verteilt sich darüber nie exakt gleichmäßig, und schon das ergibt
// Abweichungen um 5–8 %. Erst ab 12 % ist es ein Muster und kein
// Rechenartefakt.
const MIN_SEASONAL_SIGNAL = 0.12;

const QUARTER_NAMES = ["Winter (Jan–Mär)", "Frühjahr (Apr–Jun)", "Sommer (Jul–Sep)", "Herbst (Okt–Dez)"];

const quarterOf = (dateStr) => Math.floor(new Date(dateStr + "T12:00:00Z").getUTCMonth() / 3);

/**
 * Saisonfaktor eines Produkts für den aktuellen Zeitpunkt.
 *
 * Faktor < 1 heißt: in dieser Jahreszeit wird HÄUFIGER gekauft, der
 * Rhythmus ist also kürzer. Faktor > 1 heißt seltener.
 *
 * @returns {{factor, quarter, quarterName, applied, reason, message, byQuarter, purchases, spanDays}}
 */
function seasonalFactor(purchases, today) {
  const rows = (purchases || [])
    .filter((p) => p && p.date && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const quarter = quarterOf(today);
  const base = {
    factor: 1, quarter, quarterName: QUARTER_NAMES[quarter],
    applied: false, byQuarter: [], purchases: rows.length, spanDays: 0,
    reason: "zu_wenig_daten", message: null
  };

  if (rows.length < MIN_PURCHASES_FOR_SEASON) return base;

  const spanDays = daysBetween(rows[0].date, today);
  base.spanDays = spanDays;

  // Ohne ein volles Jahr gibt es kein Jahresmuster. Punkt.
  if (spanDays < MIN_HISTORY_DAYS) {
    return { ...base, reason: "unter_einem_jahr" };
  }

  // Käufe je Quartal, normiert auf die Tage, die in diesem Quartal
  // überhaupt beobachtet wurden — sonst zählt ein Quartal doppelt,
  // nur weil die Historie dort zweimal hindurchläuft.
  const counts = [0, 0, 0, 0];
  const observedDays = [0, 0, 0, 0];

  rows.forEach((p) => { counts[quarterOf(p.date)]++; });

  // Beobachtete Tage je Quartal auszählen, Tag für Tag über den
  // gesamten Zeitraum. Bei wenigen Jahren ist das billig und exakt.
  const startMs = new Date(rows[0].date + "T12:00:00Z").getTime();
  const endMs = new Date(today + "T12:00:00Z").getTime();
  for (let t = startMs; t <= endMs; t += 86400000) {
    observedDays[Math.floor(new Date(t).getUTCMonth() / 3)]++;
  }

  const rates = counts.map((c, i) => (observedDays[i] > 0 ? c / observedDays[i] : null));
  const active = rates.filter((r) => r !== null && r > 0);
  if (active.length < MIN_QUARTERS) {
    return { ...base, reason: "zu_wenige_quartale", byQuarter: buildByQuarter(counts, observedDays, rates) };
  }

  const overall = rows.length / Math.max(1, spanDays);
  const here = rates[quarter];
  const byQuarter = buildByQuarter(counts, observedDays, rates);

  if (!here || here <= 0 || !overall || overall <= 0) {
    return { ...base, reason: "kein_kauf_in_dieser_saison", byQuarter };
  }

  // Häufiger gekauft = kürzerer Rhythmus. Der Faktor wirkt auf die
  // Tage, also der Kehrwert der Rate.
  const raw = overall / here;
  const clamped = Math.max(1 - MAX_SEASONAL_ADJUST, Math.min(1 + MAX_SEASONAL_ADJUST, raw));
  const percent = Math.round((clamped - 1) * 100);

  return {
    factor: Math.round(clamped * 1000) / 1000,
    quarter,
    quarterName: QUARTER_NAMES[quarter],
    applied: Math.abs(percent) >= MIN_SEASONAL_SIGNAL * 100,
    byQuarter,
    purchases: rows.length,
    spanDays,
    reason: "angewandt",
    message: Math.abs(percent) < MIN_SEASONAL_SIGNAL * 100
      ? `Kein Saisonmuster im ${QUARTER_NAMES[quarter]}.`
      : percent < 0
        ? `Im ${QUARTER_NAMES[quarter]} kaufst du das häufiger — Rhythmus um ${Math.abs(percent)} % verkürzt.`
        : `Im ${QUARTER_NAMES[quarter]} kaufst du das seltener — Rhythmus um ${percent} % verlängert.`
  };
}

function buildByQuarter(counts, observedDays, rates) {
  return counts.map((c, i) => ({
    quarter: i, name: QUARTER_NAMES[i], purchases: c,
    observedDays: observedDays[i],
    ratePerDay: rates[i] !== null ? Math.round(rates[i] * 10000) / 10000 : null
  }));
}

/** Rhythmus mit dem Saisonfaktor korrigieren. */
function applySeason(rhythm, purchases, today) {
  if (!rhythm || !rhythm.rhythmDays) return rhythm;
  const season = seasonalFactor(purchases, today);
  if (!season.applied) return { ...rhythm, season };
  return {
    ...rhythm,
    rhythmDays: Math.max(1, Math.round(rhythm.rhythmDays * season.factor)),
    seasonBaseDays: rhythm.rhythmDays,
    season
  };
}

/* ===== changeDetector.js ===== */
/**
 * changeDetector.js — Strukturbruch im Kaufverhalten
 * ================================================================
 * Ein Mitbewohner zieht aus. Ein Kind kommt in die Kita. Jemand
 * hört auf, Kaffee zu trinken. In allen drei Fällen ändert sich der
 * Verbrauch nicht allmählich, sondern von einem Tag auf den anderen —
 * und der Median über sechs Monate mittelt diesen Bruch weg. Die App
 * braucht danach Monate, um aufzuholen, und liegt die ganze Zeit
 * daneben.
 *
 * `rhythmEngine2` hat bereits eine Trenderkennung. Sie meldet, DASS
 * sich etwas verschoben hat, rechnet aber weiter mit allen Daten.
 * Dieses Modul beantwortet die andere Frage: AB WANN gilt das Neue?
 *
 * Verfahren: für jeden möglichen Trennpunkt die Mediane davor und
 * danach vergleichen und den Punkt mit dem größten Unterschied
 * suchen. Kein Modell, keine Bibliothek — dieselbe robuste Statistik
 * wie im Rest des Systems.
 *
 * ZURÜCKHALTUNG IST HIER ENTSCHEIDEND. Einen Bruch zu behaupten, wo
 * keiner ist, verwirft gute Daten und macht die Vorhersage schlechter.
 * Deshalb: genug Punkte auf beiden Seiten, deutlicher Unterschied,
 * und die Änderung muss nach dem Bruch ANHALTEN — ein einzelner
 * Ausreißer ist kein Strukturbruch, sondern genau das, wogegen der
 * Median ohnehin schützt.
 * ================================================================
 */



const MIN_SIDE = 3;              // Intervalle je Seite
const MIN_RELATIVE_CHANGE = 0.4; // unter 40 % ist es Rauschen
const MIN_AGE_DAYS = 14;         // ein Bruch von gestern ist eine Vermutung
const MAX_LOOKBACK_DAYS = 540;

/**
 * Bruchpunkt in einer Kaufreihe suchen.
 *
 * @param {Array} purchases [{date, quantity}]
 * @param {string} today
 * @returns {{found, date, index, before, after, changePercent, direction, intervals, message}}
 */
function detectChange(purchases, today) {
  const rows = (purchases || [])
    .filter((p) => p && p.date && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((p) => daysBetween(p.date, today) <= MAX_LOOKBACK_DAYS);

  const none = {
    found: false, date: null, index: null,
    before: null, after: null, changePercent: 0,
    direction: null, intervals: 0, message: null, reason: "zu_wenig_daten"
  };

  if (rows.length < MIN_SIDE * 2 + 1) return none;

  // Abstände je Einheit — dieselbe Bezugsgröße wie im Rhythmusmodell,
  // sonst liest sich ein Vorratskauf als Verhaltensänderung.
  const intervals = [];
  for (let i = 1; i < rows.length; i++) {
    const gap = daysBetween(rows[i - 1].date, rows[i].date);
    const qty = Math.max(1, Number(rows[i - 1].quantity) || 1);
    intervals.push({ perUnit: gap / qty, date: rows[i].date });
  }
  if (intervals.length < MIN_SIDE * 2) return { ...none, intervals: intervals.length };

  let best = null;
  for (let split = MIN_SIDE; split <= intervals.length - MIN_SIDE; split++) {
    const before = median(intervals.slice(0, split).map((x) => x.perUnit));
    const after = median(intervals.slice(split).map((x) => x.perUnit));
    if (!before || !after || before <= 0) continue;

    const change = Math.abs(after - before) / before;
    // Bei gleichwertigen Trennpunkten gewinnt der SPÄTERE. Der Median
    // verträgt bis zur Hälfte alte Werte im „danach“-Block, ohne dass
    // sich das Änderungsmaß bewegt — die Trennung ist dann mehrdeutig,
    // und mit „größer“ landete man systematisch zu früh. Gemeldet würde
    // ein Datum, an dem das alte Verhalten noch galt.
    if (!best || change > best.change + 1e-9 || Math.abs(change - best.change) <= 1e-9) {
      best = { split, before, after, change, date: intervals[split].date };
    }
  }

  if (!best) return { ...none, intervals: intervals.length, reason: "kein_trennpunkt" };

  const ageDays = daysBetween(best.date, today);

  if (best.change < MIN_RELATIVE_CHANGE) {
    return {
      ...none, intervals: intervals.length,
      changePercent: Math.round(best.change * 100),
      reason: "unter_schwelle"
    };
  }
  // Ein Bruch, der erst gestern lag, ist noch nicht bestätigt. Erst
  // wenn das neue Verhalten eine Weile anhält, ist es eines.
  if (ageDays < MIN_AGE_DAYS) {
    return {
      ...none, intervals: intervals.length,
      changePercent: Math.round(best.change * 100),
      reason: "zu_frisch"
    };
  }

  const direction = best.after > best.before ? "seltener" : "haeufiger";
  const percent = Math.round(((best.after - best.before) / best.before) * 100);

  return {
    found: true,
    date: best.date,
    index: best.split,
    before: Math.round(best.before * 10) / 10,
    after: Math.round(best.after * 10) / 10,
    changePercent: percent,
    direction,
    intervals: intervals.length,
    ageDays,
    reason: "erkannt",
    message: direction === "seltener"
      ? `Seit ${formatDate(best.date)} kaufst du das seltener — alle ${Math.round(best.after)} statt alle ${Math.round(best.before)} Tage.`
      : `Seit ${formatDate(best.date)} kaufst du das häufiger — alle ${Math.round(best.after)} statt alle ${Math.round(best.before)} Tage.`
  };
}

const formatDate = (d) => {
  const [y, m, dd] = String(d).split("-");
  return `${dd}.${m}.${y}`;
};

/**
 * Käufe ab dem Bruchpunkt. Ohne erkannten Bruch bleibt alles.
 *
 * Ein Puffer von einem Kauf VOR dem Bruch bleibt stehen, damit der
 * erste Abstand nach dem Bruch überhaupt berechenbar ist.
 */
function purchasesSinceChange(purchases, change) {
  if (!change || !change.found) return purchases;
  const rows = [...(purchases || [])].sort((a, b) => a.date.localeCompare(b.date));
  const idx = rows.findIndex((p) => p.date >= change.date);
  if (idx <= 0) return rows;
  return rows.slice(Math.max(0, idx - 1));
}

/* ===== receiptOcr.js ===== */
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

/* ===== backupGuard.js ===== */
/**
 * backupGuard.js — damit drei Jahre nicht an einem Dienstag verschwinden
 * ================================================================
 * DAS PROBLEM, UNGESCHÖNT:
 *
 * Alles, was diese App weiß, liegt im `localStorage` des Browsers.
 * Das ist kein Tresor, sondern ein Zwischenspeicher mit guten
 * Manieren. Er wird geleert, wenn
 *
 *   - der Browser Platz braucht (Eviction bei knappem Speicher),
 *   - jemand „Browserdaten löschen“ tippt, um etwas anderes zu
 *     reparieren,
 *   - Safari zuschlägt: bei Web-Apps, die NICHT auf dem Startbildschirm
 *     installiert sind, räumt die Intelligent Tracking Prevention nach
 *     sieben Tagen ohne Nutzung auf. Sieben Tage sind ein Urlaub.
 *
 * Und der Verlust ist bei dieser App besonders bitter, weil er nicht
 * eine Einstellung kostet, sondern GELERNTES: drei Jahre Rhythmen,
 * jede Rückmeldung, jeden Meilenstein. Das kommt nicht wieder, indem
 * man sich neu anmeldet — es gibt kein Konto, das ist ja der Punkt.
 *
 * WAS DIESES MODUL TUT: es entscheidet, wie gefährdet ein Zustand
 * ist und wann die App etwas sagen muss. Es macht selbst keine
 * Sicherung — das kann nur der Browser, und das steht in ui/backup.js.
 * Hier liegt die Urteilslogik, weil sie sich prüfen lässt.
 *
 * DREI STUFEN DER ABSICHERUNG, in dieser Reihenfolge:
 *
 *   1. DAUERHAFTER SPEICHER (`navigator.storage.persist()`).
 *      Kostet nichts, hilft am meisten, wird aber nur gewährt, wenn
 *      der Browser die App für wichtig hält. Deshalb wird sie nicht
 *      beim ersten Start erbeten, sondern nach dem ersten erfassten
 *      Einkauf: davor ist die Antwort meistens nein, und ein einmal
 *      abgelehntes Gesuch lässt sich nicht wiederholen.
 *   2. SCHATTENKOPIE im selben Speicher. Sie hilft NICHT gegen
 *      Löschen — dagegen hilft nichts im selben Speicher —, sondern
 *      gegen den abgebrochenen Schreibvorgang: volle Quote, Absturz
 *      mitten im Speichern, halbe Datei. Das ist der häufigere Fall.
 *   3. EINE DATEI AUSSERHALB. Nur sie überlebt das Löschen des
 *      Browsers. Wo es geht, schreibt die App sie von selbst; wo
 *      nicht, erinnert sie und macht das Sichern zu einem Tippen.
 *
 * WAS HIER BEWUSST FEHLT: eine Wolke. Ein Server würde das Problem
 * lösen und dabei das Versprechen brechen, auf dem die ganze App
 * steht. Die Antwort ist deshalb nicht „vertraut uns“, sondern
 * „nehmt eure Datei mit“.
 * ================================================================
 */

/* Wann die App wieder etwas sagt. Beides muss zusammenkommen — Zeit
   allein nervt jemanden, der nichts erfasst hat, und Menge allein
   trifft den nicht, der viel auf einmal einträgt. */
const REMIND_AFTER_DAYS = 14;
const REMIND_AFTER_RECEIPTS = 6;

/* Ab hier ist es keine Erinnerung mehr, sondern eine Warnung. */
const CRITICAL_DAYS = 45;
const CRITICAL_RECEIPTS = 20;

/* Unter so vielen Bons lohnt keine Sicherung und keine Meldung — da
   ist noch nichts verloren zu gehen. */
const MIN_RECEIPTS_TO_CARE = 3;

/* Safari räumt bei nicht installierten Web-Apps nach sieben Tagen
   ohne Besuch auf. Der Wert steht hier, damit die Meldung ihn nennen
   kann statt vage zu warnen. */
const WEBKIT_EVICTION_DAYS = 7;

const LEVEL = {
  UNKRITISCH: "unkritisch",   // zu wenig Daten, um etwas zu verlieren
  GESICHERT: "gesichert",     // Datei außerhalb, aktuell
  OK: "ok",                   // gesichert, aber etwas ist dazugekommen
  ERINNERUNG: "erinnerung",   // lange nichts gesichert
  GEFAEHRDET: "gefaehrdet"    // nie gesichert und/oder Speicher flüchtig
};

/* Heißt nicht `isDate` — den Namen vergibt activityLog, und im
   Bündel teilen sich alle Module einen Namensraum. Der Build bricht
   sonst ab, und das ist die freundlichere Variante: vorher überschrieb
   still das eine das andere. */
const isDayString = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function daysBetweenDates(from, to) {
  if (!isDayString(from) || !isDayString(to)) return null;
  const ms = new Date(to + "T12:00:00Z") - new Date(from + "T12:00:00Z");
  return Math.round(ms / 86400000);
}

/**
 * Wie flüchtig ist dieser Speicher?
 *
 * @param {{persisted, installed, webkit}} env
 * @returns {{fluechtig:boolean, grund:string|null, frist:number|null}}
 */
function storageRisk(env = {}) {
  if (env.persisted) {
    return { fluechtig: false, grund: null, frist: null };
  }
  if (env.webkit && !env.installed) {
    return {
      fluechtig: true,
      frist: WEBKIT_EVICTION_DAYS,
      grund: `Auf diesem Browser werden die Daten einer nicht installierten Web-App nach ` +
             `${WEBKIT_EVICTION_DAYS} Tagen ohne Nutzung gelöscht. Zum Startbildschirm hinzufügen hilft dagegen.`
    };
  }
  return {
    fluechtig: true,
    frist: null,
    grund: "Der Browser darf diesen Speicher löschen, wenn er Platz braucht — " +
           "oder wenn jemand die Browserdaten aufräumt."
  };
}

/**
 * Der Gesundheitszustand der Sicherung.
 *
 * @param {object} s
 *   `receipts`        Bons insgesamt
 *   `lastBackupDate`  letzte Sicherung (JJJJ-MM-TT) oder null
 *   `receiptsAtBackup` Bonstand bei der letzten Sicherung
 *   `today`           Stichtag
 *   `auto`            true, wenn eine Datei automatisch mitgeschrieben wird
 *   `env`             siehe storageRisk
 * @returns {{level, title, message, urgent, daysSince, neueBons, risk}}
 */
function backupHealth(s = {}) {
  const today = s.today;
  const receipts = Math.max(0, Number(s.receipts) || 0);
  const receiptsAtBackup = Math.max(0, Number(s.receiptsAtBackup) || 0);
  const neueBons = Math.max(0, receipts - receiptsAtBackup);
  const daysSince = s.lastBackupDate ? daysBetweenDates(s.lastBackupDate, today) : null;
  const risk = storageRisk(s.env);

  const basis = { daysSince, neueBons, risk };

  if (receipts < MIN_RECEIPTS_TO_CARE) {
    return {
      ...basis, level: LEVEL.UNKRITISCH, urgent: false,
      title: "Noch nichts zu verlieren",
      message: "Sobald ein paar Einkäufe erfasst sind, kümmert sich die App um die Sicherung."
    };
  }

  /* Die automatische Datei ist der einzige Zustand, der wirklich
     entspannt ist — und auch nur, solange sie mitgeschrieben wird. */
  if (s.auto && neueBons === 0) {
    return {
      ...basis, level: LEVEL.GESICHERT, urgent: false,
      title: "Automatisch gesichert",
      message: "Jede Änderung wird in deine Sicherungsdatei geschrieben."
    };
  }
  if (s.auto) {
    return {
      ...basis, level: LEVEL.OK, urgent: false,
      title: "Automatisch gesichert",
      message: `${neueBons} ${neueBons === 1 ? "Bon" : "Bons"} seit der letzten Schreibung — wird beim nächsten Mal mitgenommen.`
    };
  }

  if (!s.lastBackupDate) {
    return {
      ...basis,
      level: LEVEL.GEFAEHRDET,
      urgent: true,
      title: "Noch nie gesichert",
      message: `${receipts} Bons und alles Gelernte liegen nur in diesem Browser. ` +
               (risk.grund || "")
    };
  }

  const kritisch = (daysSince !== null && daysSince >= CRITICAL_DAYS) || neueBons >= CRITICAL_RECEIPTS;
  const faellig = (daysSince !== null && daysSince >= REMIND_AFTER_DAYS) && neueBons >= REMIND_AFTER_RECEIPTS;

  if (kritisch) {
    return {
      ...basis, level: LEVEL.GEFAEHRDET, urgent: true,
      title: "Sicherung ist alt",
      message: `Zuletzt vor ${daysSince} Tagen gesichert, seitdem ${neueBons} ${neueBons === 1 ? "Bon" : "Bons"}. ` +
               "Bei einem Verlust wäre genau das weg."
    };
  }
  if (faellig) {
    return {
      ...basis, level: LEVEL.ERINNERUNG, urgent: false,
      title: "Zeit für eine Sicherung",
      message: `Zuletzt vor ${daysSince} Tagen, seitdem ${neueBons} ${neueBons === 1 ? "neuer Bon" : "neue Bons"}.`
    };
  }
  return {
    ...basis, level: LEVEL.OK, urgent: false,
    title: "Gesichert",
    message: daysSince === 0
      ? "Heute gesichert — der Stand liegt als Datei außerhalb des Browsers."
      : `Zuletzt vor ${daysSince} ${daysSince === 1 ? "Tag" : "Tagen"} gesichert` +
        `${neueBons ? `, seitdem ${neueBons} ${neueBons === 1 ? "neuer Bon" : "neue Bons"}` : " — seitdem nichts Neues"}.`
  };
}

/**
 * Darf die App von sich aus damit anfangen?
 *
 * Nur bei „gefährdet“, und höchstens alle paar Tage. Eine Erinnerung,
 * die bei jedem Start erscheint, wird nach dem dritten Mal weggetippt,
 * ohne gelesen zu werden — und dann fehlt sie an dem Tag, an dem sie
 * zählt.
 */
const NAG_SPACING_DAYS = 7;

function shouldRemind(health, lastNagDate, today) {
  if (!health || !health.urgent) return false;
  if (!lastNagDate) return true;
  const d = daysBetweenDates(lastNagDate, today);
  return d === null || d >= NAG_SPACING_DAYS;
}

/**
 * Ist dieser Stand überhaupt eine brauchbare Sicherung?
 *
 * Wird an zwei Stellen gebraucht: beim Zurückholen einer Datei und —
 * wichtiger — beim Start, wenn die Schattenkopie einspringen soll.
 * Eine kaputte Kopie über einen guten Stand zu legen wäre schlimmer
 * als jeder Fehler, den sie beheben soll.
 */
function validateSnapshot(parsed, opts = {}) {
  const fehler = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, fehler: ["kein Objekt"] };
  if (opts.schema !== undefined && parsed.schema !== opts.schema) {
    fehler.push(`Fassung ${parsed.schema} statt ${opts.schema}`);
  }
  if (!Array.isArray(parsed.purchases)) fehler.push("keine Kaufliste");
  if (!Array.isArray(parsed.receipts)) fehler.push("keine Bonliste");
  if (Array.isArray(parsed.purchases)) {
    const kaputt = parsed.purchases.filter((p) => !p || !p.productId || !isDayString(p.date)).length;
    // Ein paar unbrauchbare Zeilen sind normal (alte Fassungen, halb
    // gelöschte Einträge). Die Hälfte ist ein kaputtes Datei-Ende.
    if (parsed.purchases.length && kaputt > parsed.purchases.length / 2) {
      fehler.push(`${kaputt} von ${parsed.purchases.length} Käufen unbrauchbar`);
    }
  }
  return { ok: fehler.length === 0, fehler };
}

/**
 * Welcher von zwei Ständen ist der bessere?
 *
 * Beim Start, wenn beide Kopien lesbar sind. Entschieden wird nach
 * Inhalt, nicht nach Zeitstempel: ein Zeitstempel kann neuer und der
 * Inhalt trotzdem abgeschnitten sein — genau das passiert, wenn die
 * Quote mitten im Schreiben ausgeht.
 */
function pickBetter(a, b, opts = {}) {
  const va = validateSnapshot(a, opts);
  const vb = validateSnapshot(b, opts);
  if (va.ok && !vb.ok) return { chosen: a, why: "zweite Kopie unbrauchbar" };
  if (!va.ok && vb.ok) return { chosen: b, why: "erste Kopie unbrauchbar" };
  if (!va.ok && !vb.ok) return { chosen: null, why: "beide unbrauchbar" };

  const za = (a.purchases || []).length + (a.receipts || []).length;
  const zb = (b.purchases || []).length + (b.receipts || []).length;
  if (za === zb) return { chosen: a, why: "gleichwertig" };
  return za > zb
    ? { chosen: a, why: `mehr Inhalt (${za} zu ${zb})` }
    : { chosen: b, why: `mehr Inhalt (${zb} zu ${za})` };
}

/** Dateiname mit Datum — sortiert sich im Ordner von selbst. */
function backupFileName(today) {
  const d = isDayString(today) ? today : new Date().toISOString().slice(0, 10);
  return `einkaufsanker-${d}.json`;
}

/* ===== activityLog.js ===== */
/**
 * activityLog.js — das Ereignis-Protokoll
 * ================================================================
 * Wochenrückblick, Meilensteine und Streak brauchen alle dieselbe
 * Grundlage: eine Liste dessen, was tatsächlich passiert ist, mit
 * Datum. Drei Module, die sich jeweils ihre eigene Zählung aus den
 * Käufen zusammenrechnen, wären drei Wahrheiten — und spätestens
 * beim ersten Widerspruch („der Rückblick sagt 3, das Abzeichen
 * sagt 4“) ist das Vertrauen weg.
 *
 * Deshalb ein Protokoll, in das jede zählbare Handlung genau einmal
 * geschrieben wird, und drei Module, die nur noch lesen.
 *
 * WAS HIER HINEINGEHÖRT: bestätigte Handlungen mit Datum. Ein Kauf,
 * ein Austausch, ein gerettetes Produkt. Keine Schätzungen über
 * Dinge, die vielleicht passiert sind.
 *
 * ZWEI GELDBETRÄGE, DIE NICHT ZUSAMMENGEHÖREN:
 *
 *   `gerettet`  ist kontrafaktisch — der Wert, der ohne die
 *               Handlung wahrscheinlich verdorben wäre. Eine
 *               Schätzung, und als solche gekennzeichnet.
 *   `guenstig`  ist realisiert — die Differenz zwischen gezahltem
 *               und dem eigenen üblichen Preis. Nachrechenbar.
 *
 * Die beiden werden NIE addiert. Das ist derselbe Grundsatz, mit
 * dem in der Ansicht „Zahlen“ schon die Haushalts-Ersparnis getrennt
 * von der Lebensmittel-Ersparnis steht: eine Summe aus gemessen und
 * geschätzt ist eine Zahl, die nichts mehr bedeutet.
 * ================================================================
 */



const ACTION = {
  GERETTET: "gerettet",         // Verderb abgewendet, vom Nutzer bestätigt
  GUENSTIG: "guenstig",         // unter dem eigenen üblichen Preis gekauft
  GETAUSCHT: "getauscht",       // Austauschprodukt gewechselt
  ERFASST: "erfasst",           // Bon gebucht
  RUECKMELDUNG: "rueckmeldung"  // Antwort auf einen Vorschlag
};

const ACTION_LABEL = {
  gerettet: "gerettet",
  guenstig: "günstig gekauft",
  getauscht: "getauscht",
  erfasst: "erfasst",
  rueckmeldung: "Rückmeldung"
};

const KINDS = Object.values(ACTION);

// Ein Jahr plus Puffer: so weit zurück schaut der längste Streak
// (52 Wochen). Älteres wertet kein Modul mehr aus, und ein Protokoll,
// das unbegrenzt wächst, sprengt irgendwann den Browserspeicher.
const MAX_LEDGER_DAYS = 400;
const MAX_LEDGER_ENTRIES = 1500;

// Unter zehn Cent ist eine „Ersparnis“ Rundungsrauschen.
const MIN_SAVING_EUROS = 0.1;

const isDate = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * Fremde oder alte Einträge auf eine verlässliche Form bringen.
 * Ein einziger kaputter Eintrag aus einer alten Sicherung darf nicht
 * die gesamte Auswertung mitreißen.
 */
function normalizeActions(list) {
  return (Array.isArray(list) ? list : [])
    .filter((a) => a && isDate(a.date) && KINDS.includes(a.kind))
    .map((a) => ({
      date: a.date,
      kind: a.kind,
      productId: a.productId || null,
      euros: Number.isFinite(a.euros) ? Math.max(0, a.euros) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Einträge im Zeitraum, Grenzen eingeschlossen. */
function actionsInRange(list, from, to) {
  return normalizeActions(list).filter((a) => a.date >= from && a.date <= to);
}

/** Anzahl je Art. Fehlende Arten stehen als 0 drin, nicht als undefined. */
function countByKind(list) {
  const out = {};
  KINDS.forEach((k) => { out[k] = 0; });
  normalizeActions(list).forEach((a) => { out[a.kind]++; });
  return out;
}

/** Summe der Beträge einer Art. */
function sumEuros(list, kind) {
  const sum = normalizeActions(list)
    .filter((a) => !kind || a.kind === kind)
    .reduce((a, x) => a + x.euros, 0);
  return Math.round(sum * 100) / 100;
}

/** Protokoll kürzen: erst nach Alter, dann notfalls nach Anzahl. */
function pruneActions(list, today, maxDays = MAX_LEDGER_DAYS) {
  const cutoff = shiftDate(today, -maxDays);
  const kept = normalizeActions(list).filter((a) => a.date >= cutoff);
  return kept.length > MAX_LEDGER_ENTRIES ? kept.slice(kept.length - MAX_LEDGER_ENTRIES) : kept;
}

const shiftDate = (dateStr, days) =>
  new Date(new Date(dateStr + "T12:00:00Z").getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * Realisierte Ersparnis eines Einkaufs: was unter dem eigenen
 * üblichen Preis gezahlt wurde.
 *
 * Verglichen wird gegen die Historie VOR diesem Einkauf. Nähme man
 * die Historie einschließlich der neuen Zeile, verschöbe der günstige
 * Kauf den Bezugswert selbst nach unten und die Ersparnis fiele zu
 * klein aus — bei drei Datenpunkten spürbar.
 *
 * @param {Array} rows [{productId, quantity, unitPrice}]
 * @param {Array} priorHistory Käufe vor diesem Bon
 * @returns {Array} [{productId, euros, usual, paid}]
 */
function receiptSavings(rows, priorHistory) {
  const out = [];
  for (const r of (rows || [])) {
    if (!r || !r.productId) continue;
    const paid = Number(r.unitPrice);
    const qty = Math.max(1, Number(r.quantity) || 1);
    if (!Number.isFinite(paid) || paid <= 0) continue;

    const mem = priceMemory(r.productId, priorHistory || []);
    if (!mem || !mem.usual) continue;

    // Dieselbe Schwelle wie im Preis-Gedächtnis: darunter ist ein
    // Unterschied kein Angebot, sondern Streuung.
    if (paid > mem.usual * (1 - NOTABLE_CHANGE)) continue;

    const euros = Math.round((mem.usual - paid) * qty * 100) / 100;
    if (euros < MIN_SAVING_EUROS) continue;
    out.push({ productId: r.productId, euros, usual: mem.usual, paid: Math.round(paid * 100) / 100 });
  }
  return out;
}

/* ===== streakTracker.js ===== */
/**
 * streakTracker.js — Wochen am Stück, ohne Rangliste
 * ================================================================
 * Ein Streak ist der billigste wirksame Wiederkehrgrund, den es
 * gibt. Er ist aber auch der schnellste Weg, jemanden zu verlieren:
 * Wer nach elf Wochen einmal im Urlaub war und bei null steht,
 * kommt nicht wieder.
 *
 * Deshalb drei Entscheidungen, die von der reinen Snapchat-Logik
 * abweichen:
 *
 *   1. KEINE RANGLISTE. Bei Lebensmittelverschwendung ist ein
 *      öffentlicher Vergleich beschämend, nicht motivierend — wer
 *      hinten steht, deinstalliert. Der Streak gehört dem Haushalt,
 *      nicht einem Wettbewerb.
 *   2. DIE LAUFENDE WOCHE BRICHT NIE. Bis Sonntagabend ist die Woche
 *      offen. Eine App, die dienstags meldet „Streak verloren“, ist
 *      schlicht falsch.
 *   3. EINE KULANZWOCHE. Wer den Streak eine Weile gehalten hat,
 *      verliert ihn nicht an eine einzelne Lücke. Höchstens eine
 *      Kulanz je acht Wochen, sonst wäre die Zahl bedeutungslos.
 *
 * Urlaubswochen zählen als gehalten. Das ist keine Schummelei: die
 * App weiß aus dem Urlaubsmodus, dass in dieser Woche bewusst nicht
 * eingekauft wurde. Sie so zu werten wie eine vergessene Woche wäre
 * eine Fehlmessung.
 * ================================================================
 */



const MAX_WEEKS_BACK = 60;      // etwas mehr als ein Jahr
const GRACE_AFTER_WEEKS = 4;    // erst ab vier Wochen gibt es Kulanz
const GRACE_SPACING = 8;        // höchstens eine Kulanz je acht Wochen

/**
 * ISO-Kalenderwoche als sortierbarer Schlüssel („2026-W32“).
 * Die eine Implementierung im Projekt — data.js reicht sie durch.
 */
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;              // Montag = 0
  d.setUTCDate(d.getUTCDate() - day + 3);           // Donnerstag derselben Woche
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Montag der Woche, in der `dateStr` liegt. */
function mondayOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const weekShift = (dateStr, weeks) =>
  new Date(new Date(dateStr + "T12:00:00Z").getTime() + weeks * 7 * 86400000).toISOString().slice(0, 10);

/**
 * Wochen, die ganz oder teilweise in eine Abwesenheit fallen.
 *
 * Zwei Quellen, gleichwertig behandelt: der eingeschaltete
 * Urlaubsmodus und die aus den Bons ERKANNTE Abwesenheit. Die zweite
 * ist die wichtigere, denn die meisten Haushalte schalten den
 * Urlaubsmodus nicht ein — sie fahren einfach weg.
 *
 * Ohne sie zerfiel der Streak bei jedem Urlaub. In der
 * Drei-Jahres-Simulation stand er nach jeder Reise wieder bei eins:
 * zwei Wochen ohne Einkauf sind zwei Lückenwochen, und die eine
 * Kulanzwoche deckt nur eine davon. Ein Zähler, der zweimal im Jahr
 * abstürzt, weil jemand im Urlaub war, motiviert niemanden — er
 * bestraft das Wegfahren.
 *
 * @param {{from,to}|Array} spans Urlaubsmodus und/oder erkannte Zeiträume
 * @returns {Set<string>} Wochenschlüssel
 */
function vacationWeeks(spans, today) {
  const out = new Set();
  const list = (Array.isArray(spans) ? spans : [spans]).filter((v) => v && v.from && v.to);

  for (const span of list) {
    const from = span.from;
    const to = span.to < today ? span.to : today;
    if (from > to) continue;
    let cursor = mondayOf(from);
    // Obergrenze gegen einen fehlerhaft weit gesetzten Zeitraum.
    for (let i = 0; i <= MAX_WEEKS_BACK && cursor <= to; i++) {
      out.add(isoWeekKey(cursor));
      cursor = weekShift(cursor, 1);
    }
  }
  return out;
}

/**
 * Streak aus dem Ereignis-Protokoll.
 *
 * @param {Array} actions Ereignisse aus activityLog
 * @param {string} today
 * @param {{vacation}} opts
 * @returns {{weeks, thisWeekActive, longest, graceUsed, weekKeys, message, holdBy}}
 */
function weeklyStreak(actions, today, opts = {}) {
  const held = new Set();
  normalizeActions(actions).forEach((a) => held.add(isoWeekKey(a.date)));

  // Urlaubsmodus und erkannte Abwesenheiten zählen gleich.
  const vac = vacationWeeks([opts.vacation, ...(opts.absences || [])], today);
  const isHeld = (wk) => held.has(wk) || vac.has(wk);

  const thisWeek = isoWeekKey(today);
  const thisWeekActive = isHeld(thisWeek);

  let weeks = 0;
  let graceUsed = 0;
  let lastGraceAt = null;
  // Eine Kulanzwoche zählt erst, wenn danach wieder eine gehaltene
  // Woche kommt. Sonst meldete ein lückenlos gehaltener Streak eine
  // verbrauchte Kulanz, nur weil davor irgendwann nichts war.
  let pendingGrace = 0;
  const weekKeys = [];

  for (let i = 0; i < MAX_WEEKS_BACK; i++) {
    const wk = isoWeekKey(weekShift(today, -i));
    if (isHeld(wk)) {
      weeks++;
      weekKeys.push(wk);
      graceUsed += pendingGrace;
      pendingGrace = 0;
      continue;
    }

    // Die laufende Woche ist bis Sonntag offen — sie kann den Streak
    // nicht beenden, sie hat nur noch nicht begonnen.
    if (i === 0) continue;

    const spacingOk = lastGraceAt === null || i - lastGraceAt >= GRACE_SPACING;
    if (weeks >= GRACE_AFTER_WEEKS && spacingOk) {
      pendingGrace++;
      lastGraceAt = i;
      continue;
    }
    break;
  }

  // Längster Streak: dieselbe Regel rückwärts über den gesamten
  // Zeitraum, damit ein Rekord auch nach einer Pause erhalten bleibt.
  let longest = 0, run = 0;
  for (let i = MAX_WEEKS_BACK - 1; i >= 0; i--) {
    if (isHeld(isoWeekKey(weekShift(today, -i)))) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }

  return {
    weeks,
    thisWeekActive,
    longest: Math.max(longest, weeks),
    graceUsed,
    weekKeys,
    holdBy: vac.has(thisWeek) && !held.has(thisWeek) ? "urlaub" : null,
    // Nie eine Verlustmeldung. Wer bei null steht, fängt an — er hat
    // nichts verloren.
    message: weeks === 0
      ? "Diese Woche fängt der Zähler an."
      : thisWeekActive
        ? `${weeks} ${weeks === 1 ? "Woche" : "Wochen"} am Stück.`
        : `${weeks} ${weeks === 1 ? "Woche" : "Wochen"} am Stück — diese Woche ist noch offen.`
  };
}

/** Die letzten `n` Wochen als Punktereihe für die Anzeige. */
function streakDots(actions, today, n = 8, opts = {}) {
  const held = new Set();
  normalizeActions(actions).forEach((a) => held.add(isoWeekKey(a.date)));
  const vac = vacationWeeks([opts.vacation, ...(opts.absences || [])], today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const wk = isoWeekKey(weekShift(today, -i));
    out.push({
      week: wk,
      current: i === 0,
      held: held.has(wk),
      vacation: vac.has(wk) && !held.has(wk)
    });
  }
  return out;
}

/* ===== weeklyReview.js ===== */
/**
 * weeklyReview.js — der Wochenrückblick
 * ================================================================
 * „Diese Woche: 3 Produkte gerettet, 4,20 € günstiger als üblich,
 *  Zahnbürste getauscht.“
 *
 * Das Modul rechnet nichts Neues aus. Es liest das Ereignis-
 * Protokoll und die Bons und fasst zusammen, was ohnehin schon da
 * ist. Genau deshalb kostet es fast nichts und ist trotzdem der
 * Grund, die App am Sonntagabend zu öffnen.
 *
 * DREI REGELN, DAMIT DER RÜCKBLICK NICHT ZUR WERBUNG WIRD:
 *
 *   1. Nur Zeilen mit Inhalt. Eine Woche ohne Austausch zeigt keine
 *      Austausch-Zeile mit einer Null. Ein Rückblick, der immer
 *      gleich lang ist, wird nicht gelesen.
 *   2. Geschätzt und gemessen bleiben getrennt. „Gerettet“ ist eine
 *      Schätzung des abgewendeten Verlusts, „günstiger als üblich“
 *      ist nachrechenbar. Eine Summe aus beidem wäre eine Zahl ohne
 *      Bedeutung.
 *   3. Eine ruhige Woche ist keine schlechte Woche. Wer nichts
 *      erfasst hat, bekommt keine Ermahnung, sondern einen Satz,
 *      der das feststellt und gut ist.
 *
 * Der Rückblick ist ab Sonntagabend fällig und bleibt bis Dienstag
 * abrufbar — sonst verpasst ihn jeder, der sonntags nicht ans Handy
 * geht. Ab Montag bezieht er sich auf die abgeschlossene Vorwoche.
 * ================================================================
 */






const REVIEW_WEEKDAY = 0;      // Sonntag (getUTCDay)
const REVIEW_HOUR = 17;        // ab 17 Uhr — der Abend ist gemeint
const REVIEW_GRACE_DAYS = 2;   // Montag und Dienstag noch nachholbar
const COMPARE_WEEKS = 12;      // Vergleichszeitraum für den Schnitt
const MIN_WEEKS_FOR_COMPARE = 3;

const money = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";
const weekdayOfDate = (d) => new Date(d + "T12:00:00Z").getUTCDay();

/**
 * Welcher Zeitraum ist gerade gemeint?
 *
 * @returns {{weekKey, from, to, complete, label}}
 */
function weekRangeFor(dateStr, offset = 0) {
  const monday = weekShift(mondayOf(dateStr), offset);
  const sunday = weekShift(monday, 1);
  const to = offset < 0 ? new Date(new Date(sunday + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10) : dateStr;
  return {
    weekKey: isoWeekKey(monday),
    from: monday,
    to,
    complete: offset < 0 || weekdayOfDate(dateStr) === REVIEW_WEEKDAY,
    label: offset < 0 ? "Vorige Woche" : "Diese Woche"
  };
}

/**
 * Ist der Rückblick jetzt fällig — und für welche Woche?
 *
 * @param {string} today
 * @param {number} hour Stunde im Ortszeitsystem des Geräts
 * @returns {null|{weekKey, from, to, complete, label}}
 */
function reviewDue(today, hour = 20) {
  const wd = weekdayOfDate(today);
  if (wd === REVIEW_WEEKDAY) {
    return hour >= REVIEW_HOUR ? weekRangeFor(today, 0) : null;
  }
  // Montag = 1, Dienstag = 2 — die Vorwoche ist da abgeschlossen.
  if (wd >= 1 && wd <= REVIEW_GRACE_DAYS) return weekRangeFor(today, -1);
  return null;
}

/** Wochensummen der Bons, jüngste zuerst. */
function weeklySpends(receipts, today, weeks = COMPARE_WEEKS) {
  const byWeek = new Map();
  (receipts || []).forEach((r) => {
    if (!r || !r.date || r.date > today) return;
    if (daysBetween(r.date, today) > weeks * 7) return;
    const wk = isoWeekKey(r.date);
    byWeek.set(wk, (byWeek.get(wk) || 0) + (Number(r.total) || 0));
  });
  return byWeek;
}

function medianOfNumbers(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Der Rückblick für einen Zeitraum.
 *
 * @param {{actions, receipts}} data
 * @param {{weekKey, from, to, complete, label}} range aus weekRangeFor
 * @returns {object}
 */
function weeklyReview(data, range) {
  const actions = actionsInRange(data.actions || [], range.from, range.to);
  const receipts = (data.receipts || []).filter((r) => r && r.date >= range.from && r.date <= range.to);

  const rescued = actions.filter((a) => a.kind === ACTION.GERETTET);
  const cheaper = actions.filter((a) => a.kind === ACTION.GUENSTIG);
  const swaps = actions.filter((a) => a.kind === ACTION.GETAUSCHT);
  const feedback = actions.filter((a) => a.kind === ACTION.RUECKMELDUNG);

  const spend = Math.round(receipts.reduce((a, r) => a + (Number(r.total) || 0), 0) * 100) / 100;

  // Vergleich mit den eigenen Wochen — nicht mit einem Durchschnitts-
  // haushalt. Fremde Vergleichszahlen wären hier erfunden.
  const spends = weeklySpends(data.receipts, range.to);
  spends.delete(range.weekKey);
  const others = [...spends.values()].filter((v) => v > 0);
  let comparison = null;
  if (others.length >= MIN_WEEKS_FOR_COMPARE && spend > 0) {
    const med = medianOfNumbers(others);
    const delta = spend - med;
    comparison = {
      median: Math.round(med * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      weeks: others.length,
      text: Math.abs(delta) < 1
        ? "wie in deinen üblichen Wochen"
        : delta < 0
          ? `${money(-delta)} unter deinem Schnitt`
          : `${money(delta)} über deinem Schnitt`
    };
  }

  const nameOf = (pid) => { const p = byId(pid); return p ? p.name : null; };
  const swapNames = [...new Set(swaps.map((s) => nameOf(s.productId)).filter(Boolean))];
  const rescuedNames = [...new Set(rescued.map((r) => nameOf(r.productId)).filter(Boolean))];

  /* Jede Zeile trägt zwei Fassungen: `label`/`value` für das Blatt,
     `tile` für die drei Kacheln auf der Karte. Ohne die zweite stünde
     dort „1 Produkt gerettet“ neben „ca. 1,25 €“ — dieselbe Aussage
     zweimal, und auf einem schmalen Telefon in zwei Zeilen gebrochen. */
  const lines = [];
  if (rescued.length) {
    lines.push({
      key: "gerettet",
      label: rescued.length === 1 ? "1 Produkt gerettet" : `${rescued.length} Produkte gerettet`,
      value: sumEuros(rescued) > 0 ? "ca. " + money(sumEuros(rescued)) : "",
      note: rescuedNames.slice(0, 3).join(", "),
      tile: { v: String(rescued.length), l: "gerettet" },
      estimated: true
    });
  }
  if (cheaper.length) {
    lines.push({
      key: "guenstig",
      label: "Günstiger als üblich",
      value: money(sumEuros(cheaper)),
      note: `${cheaper.length} ${cheaper.length === 1 ? "Position" : "Positionen"}`,
      tile: { v: money(sumEuros(cheaper)), l: "gespart" },
      estimated: false
    });
  }
  if (swaps.length) {
    lines.push({
      key: "getauscht",
      label: swaps.length === 1 ? "1× getauscht" : `${swaps.length}× getauscht`,
      value: "",
      note: swapNames.slice(0, 3).join(", "),
      tile: { v: swaps.length + "×", l: "getauscht" },
      estimated: false
    });
  }
  if (receipts.length) {
    lines.push({
      key: "einkauf",
      label: receipts.length === 1 ? "1 Einkauf" : `${receipts.length} Einkäufe`,
      value: money(spend),
      note: comparison ? comparison.text : "",
      tile: { v: money(spend), l: receipts.length === 1 ? "1 Einkauf" : `${receipts.length} Einkäufe` },
      estimated: false
    });
  }
  if (feedback.length) {
    lines.push({
      key: "rueckmeldung",
      label: feedback.length === 1 ? "1 Rückmeldung" : `${feedback.length} Rückmeldungen`,
      value: "",
      note: "fließen in die Rhythmen ein",
      tile: { v: String(feedback.length), l: feedback.length === 1 ? "Rückmeldung" : "Rückmeldungen" },
      estimated: false
    });
  }

  const quiet = lines.length === 0;

  return {
    ...range,
    lines,
    quiet,
    spend,
    comparison,
    receipts: receipts.length,
    rescued: { count: rescued.length, euros: sumEuros(rescued), names: rescuedNames },
    cheaper: { count: cheaper.length, euros: sumEuros(cheaper) },
    swaps: { count: swaps.length, names: swapNames },
    feedback: feedback.length,
    headline: buildHeadline({ quiet, rescued, cheaper, swaps, receipts, spend, comparison }),
    // Für die Benachrichtigung: eine Zeile, kein Absatz.
    short: quiet
      ? "Ruhige Woche."
      : lines.slice(0, 3).map((l) => (l.value ? `${l.label} (${l.value})` : l.label)).join(", ")
  };
}

/** Die eine Zeile obenauf: das Stärkste, was diese Woche hergibt. */
function buildHeadline(x) {
  if (x.quiet) return "Ruhige Woche — nichts erfasst.";
  if (x.rescued.length >= 2) {
    return `${x.rescued.length} Produkte gerettet` +
      (x.rescued.length && sumEurosOf(x.rescued) > 0 ? ` — geschätzt ${money(sumEurosOf(x.rescued))} nicht in der Tonne.` : ".");
  }
  if (x.cheaper.length && sumEurosOf(x.cheaper) >= 1) {
    return `${money(sumEurosOf(x.cheaper))} günstiger eingekauft als üblich.`;
  }
  if (x.rescued.length === 1) return "Ein Produkt gerettet.";
  if (x.swaps.length) return `${x.swaps.length}× rechtzeitig getauscht.`;
  if (x.receipts.length) {
    return x.comparison && x.comparison.delta < -1
      ? `${x.receipts.length} ${x.receipts.length === 1 ? "Einkauf" : "Einkäufe"}, ${x.comparison.text}.`
      : `${x.receipts.length} ${x.receipts.length === 1 ? "Einkauf" : "Einkäufe"} für ${money(x.spend)}.`;
  }
  return "Eine Woche mit Rückmeldungen — die Rhythmen sitzen jetzt genauer.";
}

const sumEurosOf = (list) => Math.round(list.reduce((a, x) => a + (x.euros || 0), 0) * 100) / 100;

/* ===== milestones.js ===== */
/**
 * milestones.js — Meilensteine mit echter Bezugsgröße
 * ================================================================
 * Abstrakte Punkte („420 XP“) bedeuten nichts. Diese App hat etwas
 * Besseres: eine bezifferbare Wirkung. „50 Produkte vor dem Verderb
 * bewahrt“ ist keine Spielwährung, sondern eine Zusammenfassung
 * dessen, was der Haushalt getan hat.
 *
 * VIER REGELN:
 *
 *   1. Jede Stufe zählt bestätigte Handlungen aus dem Ereignis-
 *      Protokoll. Keine Stufe misst bloße App-Nutzung — „zehnmal
 *      geöffnet“ ist eine Auszeichnung für die App, nicht für den
 *      Nutzer.
 *   2. Geld und Stückzahl bleiben getrennte Reihen, und die
 *      Geldreihe zählt ausschließlich REALISIERTE Ersparnis. Ein
 *      Abzeichen für geschätzte Beträge wäre eine Auszeichnung für
 *      eine Vermutung.
 *   3. Keine Stufe kann verfallen. Was einmal erreicht ist, bleibt.
 *      Ein rückläufiger Zähler wäre eine Bestrafung für eine
 *      ruhige Phase.
 *   4. Nicht erreichte Stufen werden neutral gezeigt: der Abstand,
 *      nicht das Versäumnis.
 * ================================================================
 */

/* `icon` ist ein SCHLÜSSEL, kein Zeichen. Vorher standen hier
   Unicode-Glyphen (✽ ◆ ↻ ▤ ▪) — der deutlichste Verräter einer
   Gestaltung von der Stange: echte Symbole werden gezeichnet, nicht
   aus dem Zeichensatz gegriffen. Die Zeichnung steht in views.js, wo
   sie hingehört; dieses Modul benennt nur, was gemeint ist. */
const MILESTONES = [
  {
    id: "gerettet",
    label: "Gerettet",
    unit: "Produkte",
    steps: [3, 10, 25, 50, 100, 250],
    icon: "sprout",
    title: (n) => `${n} Produkte vor dem Verderb bewahrt`,
    note: "Zählt Handlungen, die du bestätigt hast: halbe Menge, eingefroren, aufgebraucht, gekocht."
  },
  {
    id: "guenstig",
    label: "Günstig gekauft",
    unit: "€",
    euros: true,
    steps: [10, 25, 50, 100, 250, 500],
    icon: "tag",
    title: (n) => `${n} € unter deinem üblichen Preis`,
    note: "Realisierte Ersparnis: gezahlter Preis gegen deinen eigenen Medianpreis. Nachrechenbar, nicht geschätzt."
  },
  {
    id: "getauscht",
    label: "Getauscht",
    unit: "×",
    steps: [3, 10, 25, 50],
    icon: "cycle",
    title: (n) => `${n}× rechtzeitig getauscht`,
    note: "Zahnbürste, Schwamm, Filter — Austausch nach Zeit, nicht nach Verbrauch."
  },
  {
    id: "erfasst",
    label: "Erfasst",
    unit: "Bons",
    steps: [1, 10, 50, 100, 250],
    icon: "receipt",
    title: (n) => (n === 1 ? "Erster Bon erfasst" : `${n} Bons erfasst`),
    note: "Jeder Bon schärft die Rhythmen. Ohne Historie rät die App nur."
  },
  {
    id: "wochen",
    label: "Am Stück",
    unit: "Wochen",
    steps: [2, 4, 12, 26, 52],
    icon: "tally",
    title: (n) => `${n} Wochen am Stück`,
    note: "Wochen mit mindestens einer Handlung. Urlaubswochen zählen mit."
  }
];

const badgeKey = (id, threshold) => `${id}:${threshold}`;

/**
 * Stand aller Reihen.
 *
 * @param {{gerettet, guenstig, getauscht, erfasst, wochen}} totals
 * @returns {{rows, reached, reachedKeys, count, nextUp}}
 */
function milestoneState(totals) {
  const rows = MILESTONES.map((m) => {
    const raw = Number(totals && totals[m.id]) || 0;
    const value = Math.max(0, m.euros ? Math.round(raw * 100) / 100 : Math.floor(raw));

    const reached = m.steps.filter((s) => value >= s);
    const current = reached.length ? reached[reached.length - 1] : null;
    const next = m.steps.find((s) => value < s) || null;

    // Fortschritt immer zwischen der zuletzt erreichten Stufe und der
    // nächsten — sonst sähe der Sprung von 100 auf 250 aus wie
    // Stillstand, obwohl es der schwerste Abschnitt ist.
    const floor = current || 0;
    const progress = next ? Math.min(1, Math.max(0, (value - floor) / (next - floor))) : 1;

    return {
      id: m.id,
      label: m.label,
      unit: m.unit,
      icon: m.icon,
      euros: !!m.euros,
      note: m.note,
      value,
      steps: m.steps,
      reached,
      reachedKeys: reached.map((s) => badgeKey(m.id, s)),
      level: reached.length,
      maxLevel: m.steps.length,
      current,
      currentTitle: current ? m.title(current) : null,
      next,
      nextTitle: next ? m.title(next) : null,
      remaining: next ? Math.round((next - value) * 100) / 100 : 0,
      progress: Math.round(progress * 100) / 100,
      complete: !next
    };
  });

  const reachedKeys = rows.flatMap((r) => r.reachedKeys);

  // Was am nächsten dran ist — die eine Zeile, die sich zu zeigen lohnt.
  const open = rows.filter((r) => r.next !== null);
  const nextUp = open.length
    ? open.slice().sort((a, b) => b.progress - a.progress)[0]
    : null;

  return {
    rows,
    reachedKeys,
    reached: rows.filter((r) => r.current !== null),
    count: reachedKeys.length,
    total: MILESTONES.reduce((a, m) => a + m.steps.length, 0),
    nextUp
  };
}

/**
 * Stufen, die seit dem letzten Blick dazugekommen sind.
 * `seen` ist die Liste bereits gefeierter Schlüssel.
 */
function newMilestones(state, seen) {
  const known = new Set(Array.isArray(seen) ? seen : []);
  const out = [];
  state.rows.forEach((row) => {
    const def = MILESTONES.find((m) => m.id === row.id);
    row.reached.forEach((step) => {
      const key = badgeKey(row.id, step);
      if (known.has(key)) return;
      out.push({
        key, id: row.id, threshold: step,
        label: row.label, icon: row.icon, unit: row.unit,
        title: def.title(step),
        note: def.note,
        level: row.reached.indexOf(step) + 1,
        maxLevel: row.maxLevel
      });
    });
  });
  // Die höchste Stufe zuerst — wer zwei auf einmal erreicht, soll die
  // größere sehen.
  return out.sort((a, b) => b.threshold - a.threshold);
}

/* ===== weekPulse.js ===== */
/**
 * weekPulse.js — die nächsten sieben Tage als eine Zeile
 * ================================================================
 * Die Startseite soll eine Frage beantworten, bevor irgendetwas
 * angetippt wird: WANN passiert was?
 *
 * Alle Antworten dazu liegen längst in der App verstreut — der
 * Rhythmus sagt, wann ein Produkt wieder fällig ist, die
 * Bestandsschätzung sagt, wann etwas verdirbt, die Austauschliste
 * sagt, wann die Zahnbürste dran ist. Bisher musste man drei
 * Ansichten aufsuchen, um daraus einen Wochenplan zu machen.
 *
 * Hier wird daraus eine Zeile von sieben Tagen, jeder mit den
 * Ereignissen, die auf ihn fallen.
 *
 * DREI REGELN, DIE DAS ERGEBNIS EHRLICH HALTEN:
 *
 * 1. KEINE DOPPELZÄHLUNG. Haushaltsprodukte, deren Reichweite
 *    endet, stehen bereits als Position auf der Liste — `supplies`
 *    wird deshalb NICHT zusätzlich eingelesen. Dieselbe Sache über
 *    zwei Kanäle in dieselbe Summe laufen zu lassen, war in diesem
 *    Projekt schon zweimal der Fehler.
 *
 * 2. VERGANGENES IST HEUTE. Was überfällig ist oder schon verdorben
 *    sein dürfte, fällt auf den heutigen Tag statt aus der Woche zu
 *    fallen. Ein Streifen, der Überfälliges verschweigt, wäre
 *    beruhigender als die Lage.
 *
 * 3. EIN PRODUKT, EIN EREIGNIS JE TAG. Verdirbt etwas an dem Tag,
 *    an dem es auch wieder fällig wäre, zählt das Verderben — die
 *    dringendere der beiden Aussagen. Über die Woche verteilt darf
 *    dasselbe Produkt aber mehrfach vorkommen: dass der Joghurt am
 *    Dienstag aufgebraucht ist und am Freitag wieder ansteht, sind
 *    zwei verschiedene Tatsachen.
 * ================================================================
 */

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const HORIZON = 7;

/* Dringlichkeit, nicht Alphabet. Die Reihenfolge entscheidet, was
   bei einer Kollision stehen bleibt und was in der Anzeige oben
   steht. */
const KIND_RANK = { verderb: 0, tausch: 1, einkauf: 2 };

const KIND_TEXT = {
  verderb: "verdirbt",
  tausch: "tauschen",
  einkauf: "einkaufen"
};

/** Ein Datum um n Tage verschieben. Heißt nicht `addDays` — den
    Namen vergibt receiptArchive.js, und das Bündel duldet keinen
    zweiten. */
function dayPlus(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pulseWeekday(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

/** Auf den Streifen abbilden: alles Vergangene auf heute, alles
    jenseits der Woche fällt weg (null). */
function slotFor(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return null;
  const i = Math.round(days);
  if (i < 0) return 0;
  return i < HORIZON ? i : null;
}

/**
 * Die kommenden sieben Tage.
 *
 * @param {object} input
 * @param {Array} input.items        Vorschlagsliste (enthält Non-Food bereits)
 * @param {Array} input.inventory    geschätzter Bestand mit `daysLeft`
 * @param {Array} input.swapsDue     fällige Austauschprodukte
 * @param {object|null} input.pattern Einkaufsmuster aus shoppingDay.js
 * @param {string} today
 * @returns {{days:Array, total:number, todayCount:number, busiest:object|null,
 *            shoppingSlot:number|null, headline:string}}
 */
function weekPulse(input, today) {
  const items = input.items || [];
  const inventory = input.inventory || [];
  const swapsDue = input.swapsDue || [];
  const pattern = input.pattern || null;

  const days = [];
  for (let i = 0; i < HORIZON; i++) {
    const date = dayPlus(today, i);
    const wd = pulseWeekday(date);
    days.push({
      index: i,
      date,
      weekday: wd,
      name: DAY_NAMES[wd],
      short: DAY_SHORT[wd],
      isToday: i === 0,
      isShoppingDay: false,
      events: [],
      count: 0
    });
  }

  const add = (slot, kind, productId, name, note) => {
    if (slot === null) return;
    const day = days[slot];
    const vorhanden = day.events.findIndex((e) => e.productId === productId && productId);
    const ereignis = { kind, productId: productId || null, name, note: note || KIND_TEXT[kind] };
    if (vorhanden < 0) { day.events.push(ereignis); return; }
    // Regel 3: bei gleichem Produkt am selben Tag gewinnt das
    // dringendere Ereignis, und es bleibt bei einem.
    if (KIND_RANK[kind] < KIND_RANK[day.events[vorhanden].kind]) day.events[vorhanden] = ereignis;
  };

  // Was verdirbt. Nur was wahrscheinlich noch da ist — das hat die
  // Bestandsschätzung schon gefiltert.
  inventory.forEach((inv) => {
    add(slotFor(inv.daysLeft), "verderb", inv.productId, inv.name,
      inv.dateSource === "aufgedruckt" ? "aufgedrucktes Datum" : "geschätzt");
  });

  // Was getauscht werden will.
  swapsDue.forEach((sw) => {
    add(slotFor(sw.due ? 0 : sw.daysLeft), "tausch", sw.productId, sw.name, null);
  });

  // Was auf die Liste gehört. `items` enthält Lebensmittel UND
  // Haushaltsprodukte — siehe Regel 1.
  items.forEach((it) => {
    add(slotFor(it.dueIn), "einkauf", it.productId, it.name, null);
  });

  days.forEach((d) => {
    d.events.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.name.localeCompare(b.name, "de"));
    d.count = d.events.length;
  });

  // Der gelernte Einkaufstag, sofern es einen gibt.
  let shoppingSlot = null;
  if (pattern && pattern.favouriteDay !== null && pattern.favouriteDay !== undefined) {
    const i = days.findIndex((d) => d.weekday === pattern.favouriteDay);
    if (i >= 0) { shoppingSlot = i; days[i].isShoppingDay = true; }
  }

  const total = days.reduce((a, d) => a + d.count, 0);
  const todayCount = days[0].count;
  const busiest = days.reduce((best, d) => (!best || d.count > best.count ? d : best), null);

  return {
    days, total, todayCount,
    busiest: busiest && busiest.count > 0 ? busiest : null,
    shoppingSlot,
    headline: headlineFor(days, total, shoppingSlot)
  };
}

/**
 * Ein Satz über die Woche.
 *
 * Zuerst das Verderbliche: das ist das Einzige, was sich nicht
 * nachholen lässt. Danach der Einkaufstag, weil er die Frage
 * beantwortet, bis wann etwas Zeit hat.
 */
function headlineFor(days, total, shoppingSlot) {
  if (!total) return "Diese Woche steht nichts an.";

  const verderb = days[0].events.filter((e) => e.kind === "verderb");
  if (verderb.length === 1) return `${verderb[0].name} sollte heute weg.`;
  if (verderb.length > 1) return `${verderb.length} Sachen sollten heute weg.`;

  const heute = days[0].count;
  if (heute > 0 && shoppingSlot === 0) return `Heute ist dein Einkaufstag — ${heute} ${heute === 1 ? "Sache" : "Sachen"} stehen an.`;
  if (shoppingSlot !== null && shoppingSlot > 0) {
    const bis = days.slice(0, shoppingSlot + 1).reduce((a, d) => a + d.count, 0);
    return `Bis ${days[shoppingSlot].name} ${bis === 1 ? "kommt eine Sache" : `kommen ${bis} Sachen`} zusammen.`;
  }
  if (heute > 0) return `Heute ${heute === 1 ? "steht eine Sache" : `stehen ${heute} Sachen`} an.`;

  const naechster = days.find((d) => d.count > 0);
  return `Als Nächstes ${naechster.index === 1 ? "morgen" : naechster.name}: ${naechster.count} ${naechster.count === 1 ? "Sache" : "Sachen"}.`;
}

/* ===== hoardDetector.js ===== */
/**
 * hoardDetector.js — Vorratskäufe erkennen
 * ================================================================
 * Ein Vorratskauf ist kein Wochenbedarf. Wer sechs Packungen Nudeln
 * mitnimmt, weil sie im Angebot waren, hat etwas anderes getan als
 * jemand, der eine Packung kauft — und die App soll das
 * unterscheiden können, in beide Richtungen:
 *
 *   GUT   Sechs Packungen Nudeln reichen ein halbes Jahr und halten
 *         zwei. Zum halben Preis war das richtig. Die App soll das
 *         sagen — und ein halbes Jahr lang keine Nudeln vorschlagen.
 *
 *   NICHT Sechs Becher Joghurt reichen bei diesem Haushalt zwölf
 *         Wochen und halten drei. Zwei Drittel davon landen im Müll,
 *         egal wie günstig sie waren. Das ist der Fall, den diese
 *         App verhindern soll, und der Moment dafür ist der Bon —
 *         nicht die Woche, in der es schon verdorben ist.
 *
 * ZWEI SUMMEN, IN DIE HIER NICHTS HINEINLÄUFT:
 *
 * 1. DIE ERSPARNIS. Was ein Vorratskauf günstiger war, zählt bereits
 *    `receiptSavings` beim Buchen — realisierte Preisersparnis, aus
 *    dem Bon. Der Betrag hier ist DERSELBE, nur nach Packungen
 *    aufgeschlüsselt, und dient der Erklärung. Ihn zusätzlich
 *    gutzuschreiben wäre EIN Ereignis über ZWEI Kanäle.
 *
 * 2. DIE VERSCHWENDUNGSBILANZ. Das Verderb-Risiko eines Stapels ist
 *    eine VORHERSAGE über etwas, das noch nicht passiert ist.
 *    `wasteSummary` bilanziert dagegen Vergangenes. Beides zu
 *    addieren hieße, denselben Joghurt einmal als Warnung und einmal
 *    als Verlust zu zählen — und wenn er dann doch aufgegessen wird,
 *    stünde er trotzdem in der Bilanz.
 *
 * Dieses Modul liefert deshalb ausschließlich BESCHREIBUNGEN. Keine
 * Zahl daraus wird irgendwo aufsummiert.
 * ================================================================
 */




/* Ab dem Wievielfachen der üblichen Menge ist es ein Vorratskauf?
   Das Doppelte ist zu wenig — wer sonst eine Packung kauft und
   diesmal zwei, hat Gäste. Ab dem Dreifachen ist es Absicht. */
const HOARD_FACTOR = 3;

/* Und mindestens so viele Einheiten, sonst wird aus „sonst eine
   halbe, heute anderthalb" ein Vorratskauf. */
const MIN_UNITS = 3;

/* Ohne diese Zahl an früheren Käufen gibt es kein „üblich", gegen
   das sich „ungewöhnlich viel" messen ließe. */
const MIN_HISTORY = 3;

/* Anteil des Stapels, der über die Haltbarkeit hinausreicht, ab dem
   gewarnt wird. Darunter ist es der normale Schwund, den die
   Verschwendungsbilanz ohnehin führt. */
const WARN_SHARE = 0.2;

/** Median einer Zahlenreihe. Heißt nicht `medianOf` — den Namen
    vergibt priceMemory.js, und das Bündel teilt einen Namensraum. */
function medianQty(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Einen einzelnen Kauf beurteilen.
 *
 * @param {string} productId
 * @param {object} purchase       {date, quantity, unitPrice}
 * @param {Array}  frühere        Käufe VOR diesem, für „üblich"
 * @param {object|null} rhythm    Ergebnis aus computeRhythm
 * @param {string} today
 * @returns {null|object} Beschreibung oder null
 */
function judgePurchase(productId, purchase, frühere, rhythm, today) {
  const p = byId(productId);
  if (!p) return null;

  const units = Math.max(1, Number(purchase.quantity) || 1);
  if (units < MIN_UNITS) return null;
  if (frühere.length < MIN_HISTORY) return null;

  const üblich = medianQty(frühere.map((h) => Math.max(1, Number(h.quantity) || 1)));
  if (!üblich || units < üblich * HOARD_FACTOR) return null;

  /* Reichweite des Stapels. Ohne gelernten Verbrauch je Einheit gibt
     es keine — und dann sagt die App dazu nichts, statt zu raten. */
  const proEinheit = rhythm && rhythm.perUnitDays > 0 ? rhythm.perUnitDays : null;
  const reichweite = proEinheit === null ? null : Math.round(proEinheit * units);

  /* Wie lange hält der Stapel? Bei Trockenware und Tiefkühl ist die
     Frage gegenstandslos — dort ist die Haltbarkeit lang genug, dass
     die Reichweite immer zuerst endet. */
  const haltbar = p.shelfLifeDays;
  const überschuss = reichweite !== null && reichweite > haltbar
    ? (reichweite - haltbar) / reichweite
    : 0;

  /* Preis: gegen den eigenen Median der früheren Käufe. Ohne
     Vergleichswert keine Aussage über den Preis. */
  const preise = frühere.map((h) => Number(h.unitPrice)).filter((x) => Number.isFinite(x) && x > 0);
  const üblicherPreis = preise.length >= MIN_HISTORY ? medianQty(preise) : null;
  const bezahlt = Number(purchase.unitPrice);
  const günstiger = üblicherPreis !== null && Number.isFinite(bezahlt) && bezahlt < üblicherPreis
    ? Math.round((üblicherPreis - bezahlt) * units * 100) / 100
    : 0;

  /* Reicht der Stapel noch? Was aufgebraucht ist, braucht keinen
     Hinweis mehr — weder Lob noch Warnung. */
  const alter = daysBetween(purchase.date, today);
  const aktiv = reichweite === null ? alter <= 30 : alter < reichweite;

  /* Sicherheitskritisches wird NIE als guter Vorratskauf gelobt.
     Hackfleisch auf Vorrat ist auch zum halben Preis keine gute
     Idee, und die App darf das nicht andeuten. */
  const kritisch = !!p.safetyCritical;
  const zuviel = kritisch || überschuss >= WARN_SHARE;

  return {
    productId,
    name: p.name,
    date: purchase.date,
    kind: zuviel ? "zuviel" : "vorrat",
    units,
    üblicheMenge: üblich,
    reichweiteTage: reichweite,
    haltbarTage: haltbar,
    // Anteil des Stapels, der die Haltbarkeit überdauert. Reine
    // Vorhersage — siehe Kopf: läuft in keine Bilanz.
    überschussAnteil: Math.round(überschuss * 100) / 100,
    // Derselbe Betrag, den `receiptSavings` schon gebucht hat, hier
    // nur nach Packungen aufgeschlüsselt. Nicht addieren.
    günstiger,
    üblicherPreis: üblicherPreis === null ? null : Math.round(üblicherPreis * 100) / 100,
    bezahlt: Number.isFinite(bezahlt) ? Math.round(bezahlt * 100) / 100 : null,
    safetyCritical: kritisch,
    aktiv,
    estimated: true,
    message: satzFür({ p, units, reichweite, haltbar, überschuss, günstiger, kritisch, zuviel })
  };
}

/** Ein Satz, der sagt, was der Fall ist — nicht was zu tun wäre. */
function satzFür({ p, units, reichweite, haltbar, überschuss, günstiger, kritisch, zuviel }) {
  const menge = `${units}×`;
  if (kritisch) {
    return `${menge} ${p.name} auf einmal. Das Produkt trägt ein Verbrauchsdatum und hält etwa ` +
           `${haltbar} ${haltbar === 1 ? "Tag" : "Tage"} — Vorrat ist hier keine Option, auch nicht zum guten Preis.`;
  }
  if (zuviel) {
    const anteil = Math.round(überschuss * 100);
    return `${menge} ${p.name} reichen bei deinem Verbrauch etwa ${reichweite} Tage, ` +
           `haltbar sind sie ${haltbar}. Rund ${anteil} % davon wären über der Frist.`;
  }
  if (reichweite === null) {
    return `${menge} ${p.name} auf einmal — sieht nach Vorrat aus. Wie lange das reicht, ` +
           `weiß die App noch nicht.`;
  }
  const bis = `reicht etwa ${reichweite} Tage`;
  return günstiger > 0
    ? `${menge} ${p.name} zum besseren Preis — ${bis}.`
    : `${menge} ${p.name} als Vorrat — ${bis}.`;
}

/**
 * Alle Vorratskäufe eines Haushalts.
 *
 * @param {Array} history  {productId, date, quantity, unitPrice}
 * @param {Map}   rhythms  productId -> computeRhythm
 * @param {string} today
 * @returns {Array} Beschreibungen, jüngste zuerst
 */
function detectHoards(history, rhythms, today) {
  const byProduct = new Map();
  (history || []).forEach((h) => {
    if (!h || !h.productId) return;
    if (!byProduct.has(h.productId)) byProduct.set(h.productId, []);
    byProduct.get(h.productId).push(h);
  });

  const out = [];
  for (const [productId, arr] of byProduct) {
    const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    sorted.forEach((kauf, i) => {
      const fund = judgePurchase(productId, kauf, sorted.slice(0, i), rhythms.get(productId) || null, today);
      if (fund) out.push(fund);
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Was davon jetzt noch zählt: laufende Stapel.
 * Ein Vorratskauf von vor zwei Jahren ist Geschichte, kein Hinweis.
 */
function activeHoards(hoards) {
  return (hoards || []).filter((h) => h.aktiv);
}

/* ===== priceShare.js ===== */
/**
 * priceShare.js — was das Gerät verlassen dürfte, und was nie
 * ================================================================
 * Für den Schwarm-Preisindex: viele Haushalte melden, was ein
 * Produkt gerade kostet, und alle sehen, wo es ungewöhnlich günstig
 * ist. Der Nutzen ist offensichtlich. Der Preis dafür ist es nicht.
 *
 * WAS EIN KASSENBON ÜBER EINEN MENSCHEN VERRÄT, wenn man ihn
 * überträgt: wo er einkauft (Filiale ≈ Wohnort), wann (Arbeitszeit,
 * Wochenrhythmus), wie viel (Haushaltsgröße, Einkommen) — und was.
 * Das Letzte ist das Heikelste: Babynahrung heißt Schwangerschaft,
 * Halal heißt Religion, Diabetiker-Produkte heißen Gesundheit. Das
 * sind besondere Kategorien nach Art. 9 DSGVO, und sie stehen auf
 * ganz gewöhnlichen Bons.
 *
 * DESHALB IST DIE EINHEIT HIER KEIN KAUF, SONDERN EINE PREISSICHTUNG.
 *
 *     { produkt, kette, kalenderwoche, cent, packung }
 *
 * Nicht enthalten, und zwar jedes einzelne aus einem Grund:
 *
 *   MENGE        verrät die Haushaltsgröße.
 *   DATUM        wird zur Kalenderwoche. Ein Datum plus Kette plus
 *                Produkt ist über mehrere Sichtungen hinweg
 *                verkettbar, eine Woche kaum.
 *   FILIALE      wird zur Kette. Die Filiale ist der Wohnort.
 *   WARENKORB    ist ein Fingerabdruck. Zwölf Positionen in einem
 *                Bon identifizieren einen Haushalt zuverlässiger als
 *                ein Name. Sichtungen werden deshalb EINZELN
 *                übertragen, ohne Bezug zueinander.
 *   KENNUNG      gibt es nicht. Kein Konto, kein Gerät, kein Zufalls-
 *                schlüssel — auch kein „pseudonymer". Ein stabiler
 *                Schlüssel über Wochen ist eine Kennung, egal wie er
 *                heißt.
 *
 * Übrig bleibt eine Aussage über einen HÄNDLER, nicht über einen
 * Menschen: „in Woche 34 kostete Butter bei Lidl 1,49 €". Das ist
 * der Punkt der ganzen Konstruktion.
 *
 * ZWEI REGELN, DIE NICHT VERHANDELBAR SIND:
 *
 * 1. NUR BEKANNTE KETTEN. „Hofladen Müller" wird nicht übertragen.
 *    Ein seltener Händlername ist selbst ein Merkmal — bei einer
 *    Handvoll Kunden ist die Sichtung die Person.
 *
 * 2. NICHTS OHNE k ANDERE. Ein Wert wird erst ausgeliefert, wenn
 *    mindestens k unabhängige Sichtungen vorliegen. Das schützt
 *    doppelt: gegen Rückschlüsse auf den Einzelnen und gegen einen
 *    falsch erkannten Bon, der sonst den Index verschöbe.
 *
 * DIE OFFENE STELLE, UND SIE IST NICHT KLEIN:
 *
 * `buildPriceIndex` zählt SICHTUNGEN, nicht HAUSHALTE. Solange jeder
 * ehrlich einmal meldet, ist das dasselbe. Wer aber dieselbe Sichtung
 * fünfmal schickt, erfüllt die k-Schwelle im Alleingang — und dann
 * schützt sie niemanden mehr und glättet auch nichts.
 *
 * Ohne Kennung lässt sich das nicht auflösen: „ein Haushalt, eine
 * Meldung" zu prüfen setzt voraus, Haushalte unterscheiden zu können,
 * und genau das soll es hier nicht geben. Drei Auswege, alle mit
 * Preis:
 *
 *   a) Ratenbegrenzung je IP. Schwach, aber billig.
 *   b) Ein wöchentlich wechselndes, blind signiertes Ticket
 *      (Privacy-Pass-Verfahren): beweist „eine Meldung je Woche",
 *      ohne den Absender zu kennen. Richtig, und echte Kryptoarbeit.
 *   c) Es bleibt bei „k Meldungen" statt „k Haushalten" — dann muss
 *      die App genau das sagen und nichts anderes behaupten.
 *
 * Vor Stufe 2 muss eine davon gewählt sein. Es ist dieselbe
 * Fehlerklasse wie die Doppelzählungen weiter oben in diesem
 * Projekt: eine Zahl, die über einen Kanal gezählt wird, der etwas
 * anderes misst, als ihr Name sagt.
 *
 * DIESES MODUL ÜBERTRÄGT NICHTS. Es entscheidet nur, was eine
 * übertragbare Sichtung wäre, und rechnet den Index aus fertigen
 * Sichtungen. Beides ist reine Logik und hier prüfbar — die Frage,
 * OB übertragen wird, ist eine Einwilligung und steht woanders.
 * ================================================================
 */



const SHARE_VERSION = 1;

/* Wie viele unabhängige Sichtungen, bevor ein Wert herausgeht.
   Fünf ist die übliche Untergrenze für k-Anonymität und zugleich
   die Zahl, ab der ein Median gegen einen Ausreißer robust ist. */
const K_ANONYMITY = 5;

/* Ketten, die groß genug sind, dass die Nennung niemanden
   heraushebt. Die Liste ist bewusst kurz und bewusst eine Liste:
   „alles außer verdächtig" wäre die falsche Richtung. */
const CHAINS = {
  lidl: ["lidl"],
  aldi: ["aldi", "aldi sued", "aldi süd", "aldi nord"],
  rewe: ["rewe"],
  edeka: ["edeka", "e center", "e-center"],
  kaufland: ["kaufland"],
  penny: ["penny"],
  netto: ["netto"],
  norma: ["norma"],
  real: ["real"],
  globus: ["globus"],
  dm: ["dm", "dm drogerie", "dm-drogerie markt"],
  rossmann: ["rossmann"]
  /* „Müller" stand hier und ist wieder heraus. Der Test hat gezeigt,
     was passiert: „Hofladen Müller" wurde als Drogeriekette erkannt
     und wäre übertragen worden — genau der Fall, den Regel 1
     verhindern soll. Müller ist einer der häufigsten deutschen
     Nachnamen; ein Laden dieses Namens ist häufiger ein Einzelfall
     als eine Filiale. Eine Kette weniger im Index ist der billigere
     Fehler. */
};

/** Händlername auf eine bekannte Kette abbilden — oder auf null. */
function chainOf(store) {
  if (!store) return null;
  const s = String(store).toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[c]))
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  for (const [key, namen] of Object.entries(CHAINS)) {
    // Wortgrenze, nicht Teilzeichenkette: „Realschulweg" ist kein
    // „real", und „Netto Marken-Discount" ist eins.
    if (namen.some((n) => new RegExp(`(^| )${n}( |$)`).test(s))) return key;
  }
  return null;
}

/** ISO-Kalenderwoche. Gröber als ein Datum, fein genug für Angebote. */
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  if (isNaN(d.getTime())) return null;
  const tag = (d.getUTCDay() + 6) % 7;              // Montag = 0
  d.setUTCDate(d.getUTCDate() - tag + 3);           // Donnerstag der Woche
  const jahr = d.getUTCFullYear();
  const ersterDo = new Date(Date.UTC(jahr, 0, 4));
  const versatz = (ersterDo.getUTCDay() + 6) % 7;
  ersterDo.setUTCDate(ersterDo.getUTCDate() - versatz + 3);
  const woche = 1 + Math.round((d - ersterDo) / (7 * 86400000));
  return `${jahr}-W${String(woche).padStart(2, "0")}`;
}

/**
 * Aus einem Kauf eine übertragbare Sichtung machen — oder nicht.
 *
 * @param {object} purchase {productId, date, unitPrice, weightG}
 * @param {string} store    Händlername vom Bon
 * @returns {null|{v, produkt, kette, kw, cent, packung}}
 */
function observationFrom(purchase, store) {
  if (!purchase) return null;
  const p = byId(purchase.productId);
  if (!p) return null;                              // nur Katalogprodukte

  const kette = chainOf(store);
  if (!kette) return null;                          // Regel 1

  const kw = isoWeek(purchase.date);
  if (!kw) return null;

  const preis = Number(purchase.unitPrice);
  if (!Number.isFinite(preis) || preis <= 0) return null;

  /* Grobe Plausibilität gegen den Katalogwert. Eine falsch erkannte
     Bonzeile („1,49" als „149,00") darf nicht in den Index. Die
     Grenzen sind weit — Angebote sind echt, Tippfehler sind es
     nicht. */
  const üblich = p.typicalPrice || 0;
  if (üblich > 0 && (preis < üblich * 0.2 || preis > üblich * 5)) return null;

  return {
    v: SHARE_VERSION,
    produkt: p.id,
    kette,
    kw,
    cent: Math.round(preis * 100),
    // Packungsgröße macht Preise vergleichbar; sie sagt nichts über
    // den Haushalt, weil sie am Produkt hängt und nicht am Kauf.
    packung: purchase.weightG || p.typicalWeightG || null
  };
}

/**
 * Alle übertragbaren Sichtungen eines Zeitraums.
 *
 * Bewusst OHNE Bezug zueinander und in zufälliger Reihenfolge: die
 * Zusammenstellung eines Warenkorbs ist ein Fingerabdruck, und die
 * Reihenfolge auf dem Bon ist der Weg durch den Laden.
 */
function shareableFrom(purchases, storeOf, opts = {}) {
  const out = [];
  (purchases || []).forEach((kauf) => {
    const obs = observationFrom(kauf, storeOf ? storeOf(kauf) : kauf.store);
    if (obs) out.push(obs);
  });

  // Mischen mit einem übergebenen Zufall, damit der Test bestimmt bleibt.
  const rnd = opts.random || Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const keyOf = (o) => `${o.produkt}|${o.kette}|${o.kw}`;

function medianCent(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Sichtungen zu einem Index verdichten.
 *
 * Das ist die Rechnung, die auf dem Server liefe — hier, weil sie
 * dann prüfbar ist und weil dieselbe Funktion für eine geteilte
 * Datei zwischen drei Haushalten reicht, ganz ohne Server.
 *
 * Der Median statt des Mittelwerts, aus demselben Grund wie überall
 * sonst in dieser App: eine falsch erkannte Zeile soll den Wert
 * nicht verschieben.
 *
 * @returns {Array} nur Einträge mit mindestens k Sichtungen
 */
function buildPriceIndex(observations, { k = K_ANONYMITY } = {}) {
  const groups = new Map();
  (observations || []).forEach((o) => {
    if (!o || o.v !== SHARE_VERSION || !o.produkt || !o.kette || !o.kw) return;
    if (!Number.isFinite(o.cent) || o.cent <= 0) return;
    const key = keyOf(o);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o.cent);
  });

  const out = [];
  for (const [key, cents] of groups) {
    if (cents.length < k) continue;                 // Regel 2
    const [produkt, kette, kw] = key.split("|");
    out.push({
      produkt, kette, kw,
      n: cents.length,
      medianCent: medianCent(cents),
      minCent: Math.min(...cents),
      maxCent: Math.max(...cents)
    });
  }
  return out.sort((a, b) => (a.kw < b.kw ? 1 : a.kw > b.kw ? -1 : a.produkt.localeCompare(b.produkt)));
}

/**
 * Wie viele Sichtungen fehlen noch, bis ein Wert herausgehen darf.
 * Für die Oberfläche: „noch 2 Meldungen" ist eine ehrlichere Auskunft
 * als eine leere Stelle.
 */
function missingFor(observations, produkt, kette, kw, k = K_ANONYMITY) {
  const n = (observations || []).filter(
    (o) => o && o.produkt === produkt && o.kette === kette && o.kw === kw
  ).length;
  return Math.max(0, k - n);
}

/* ===== offerAdvisor.js ===== */
/**
 * offerAdvisor.js — lohnt sich Vorrat bei diesem Preis?
 * ================================================================
 * Die Gegenrichtung zu hoardDetector.js: der beurteilt einen
 * Vorratskauf, NACHDEM er passiert ist. Hier steht die Frage
 * davor — bei diesem Preis, wie viel wäre sinnvoll?
 *
 * DIE ZAHL, DIE DIESE APP DAFÜR HAT UND SONST NIEMAND:
 *
 *     Höchstmenge = Haltbarkeit ÷ dein Verbrauch je Einheit
 *
 * Ein Angebotsportal kann sagen, dass Butter gerade billig ist. Was
 * es nicht sagen kann: dass DU 250 g in zwölf Tagen verbrauchst und
 * Butter vier Wochen hält, also drei Packungen die Grenze sind und
 * die vierte im Müll landet. Genau diese Rechnung ist der Grund,
 * warum die Empfehlung hier stehen darf und in einem Prospekt nicht.
 *
 * WOHER DER VERGLEICHSPREIS KOMMT, ist dieser Funktion egal. Sie
 * bekommt ein „üblich" und rechnet. Ob das aus der eigenen Historie
 * stammt (funktioniert heute, ohne Netz, ohne irgendwen) oder aus
 * einem Schwarm-Index (viele Haushalte, siehe priceShare.js), ändert
 * an der Rechnung nichts — nur an der Herkunftsangabe, die
 * mitgeführt und angezeigt wird. Eine Empfehlung ohne Herkunft wäre
 * in dieser App eine Behauptung.
 *
 * WAS SIE NICHT TUT: sie schreibt nichts gut. Die genannte Ersparnis
 * ist eine Vorschau auf einen Kauf, der noch nicht stattgefunden hat.
 * Realisiert wird sie erst beim Buchen, und dort zählt sie
 * `receiptSavings`. Beides zu addieren wäre EIN Ereignis über ZWEI
 * Kanäle — der Fehler, der in diesem Projekt schon dreimal Geld
 * gekostet hat.
 * ================================================================
 */



/* Ab wie viel Prozent unter üblich ist es ein Angebot? Darunter ist
   es Preisrauschen — Butter für 2,25 statt 2,29 ist kein Anlass,
   den Keller vollzustellen. */
const DEAL_THRESHOLD = 0.15;

/* Obergrenze unabhängig von der Rechnung. Auch wenn Reis zehn Jahre
   hält: eine App, die zu vierzig Packungen rät, hat den Bezug zum
   Haushalt verloren — und Kapital ist auch gebunden. */
const MAX_STOCK_UNITS = 8;

/* Unter zwei sinnvollen Einheiten gibt es keinen Vorrat, sondern
   einen normalen Einkauf. Dann schweigt die App. */
const MIN_STOCK_UNITS = 2;

/**
 * Wie viele Einheiten wären bei diesem Preis sinnvoll?
 *
 * @param {string} productId
 * @param {object} lage
 *   `preis`        was es gerade kostet (je Einheit)
 *   `üblich`       Vergleichswert
 *   `herkunft`     "eigen" | "schwarm" — wird nur weitergereicht
 *   `n`            wie viele Sichtungen hinter `üblich` stehen (Schwarm)
 *   `perUnitDays`  gelernter Verbrauch je Einheit, in Tagen
 * @returns {null|object}
 */
function offerAdvice(productId, lage = {}) {
  const p = byId(productId);
  if (!p) return null;

  /* Sicherheitskritisches nie. Ein Verbrauchsdatum lässt sich nicht
     durch einen guten Preis verlängern, und die App darf das an
     keiner Stelle andeuten. */
  if (p.safetyCritical) return null;

  const preis = Number(lage.preis);
  const üblich = Number(lage.üblich);
  if (!Number.isFinite(preis) || !Number.isFinite(üblich) || preis <= 0 || üblich <= 0) return null;

  const nachlass = (üblich - preis) / üblich;
  if (nachlass < DEAL_THRESHOLD) return null;       // kein Angebot

  /* Ohne gelernten Verbrauch keine Höchstmenge — und ohne
     Höchstmenge keine Empfehlung. Lieber nichts sagen als raten:
     ein Vorratsstapel, der nach vierzehn Monaten noch steht, ist
     genau das Gegenteil dessen, was diese App verspricht. */
  const proEinheit = Number(lage.perUnitDays);
  if (!Number.isFinite(proEinheit) || proEinheit <= 0) return null;

  const haltbar = p.shelfLifeDays;
  const maxNachHaltbarkeit = Math.floor(haltbar / proEinheit);
  const einheiten = Math.min(MAX_STOCK_UNITS, maxNachHaltbarkeit);

  if (einheiten < MIN_STOCK_UNITS) {
    /* Der interessante Fall, und er ist eine eigene Aussage: das
       Angebot ist echt, aber die Haltbarkeit gibt keinen Vorrat her.
       Das zu sagen ist nützlicher als zu schweigen — sonst kauft
       jemand sechs, weil sie günstig waren. */
    return {
      productId, name: p.name,
      kind: "kein-vorrat",
      einheiten: 1,
      reichweiteTage: Math.round(proEinheit),
      haltbarTage: haltbar,
      nachlass: Math.round(nachlass * 100) / 100,
      ersparnis: 0,
      herkunft: lage.herkunft || "eigen",
      n: lage.n || null,
      estimated: true,
      message: `${p.name} ist ${Math.round(nachlass * 100)} % günstiger als üblich — ` +
               `für Vorrat reicht die Haltbarkeit aber nicht: ${haltbar} ` +
               `${haltbar === 1 ? "Tag" : "Tage"}, und du verbrauchst eine Einheit in ` +
               `${Math.round(proEinheit)}.`
    };
  }

  const reichweite = Math.round(proEinheit * einheiten);
  // Vorschau, keine Gutschrift. Siehe Kopf.
  const ersparnis = Math.round((üblich - preis) * einheiten * 100) / 100;

  return {
    productId, name: p.name,
    kind: "vorrat",
    einheiten,
    reichweiteTage: reichweite,
    haltbarTage: haltbar,
    // Warum nicht mehr: die Haltbarkeit oder die Obergrenze.
    begrenztDurch: maxNachHaltbarkeit <= MAX_STOCK_UNITS ? "haltbarkeit" : "obergrenze",
    nachlass: Math.round(nachlass * 100) / 100,
    ersparnis,
    herkunft: lage.herkunft || "eigen",
    n: lage.n || null,
    estimated: true,
    message: `${einheiten}× ${p.name} wären hier sinnvoll — das reicht etwa ${reichweite} Tage ` +
             `und bleibt in der Haltbarkeit von ${haltbar}.`
  };
}

/**
 * Die Herkunftsangabe als Satz. Getrennt gehalten, weil sie das
 * Einzige ist, was sich zwischen „eigene Historie" und „Schwarm"
 * unterscheidet — die Rechnung darüber ist dieselbe.
 */
function sourceNote(advice) {
  if (!advice) return "";
  if (advice.herkunft === "schwarm") {
    return advice.n
      ? `Verglichen mit ${advice.n} Meldungen anderer Haushalte aus dieser Woche.`
      : "Verglichen mit Meldungen anderer Haushalte.";
  }
  return "Verglichen mit deinen eigenen bisherigen Preisen für dieses Produkt.";
}
