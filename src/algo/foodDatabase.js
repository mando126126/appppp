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

const { safetyGroupOf } = require("./safetyRules");

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
  /* „AUFSCHNITT" stand hier lange als eigener, von „Wurst" losgelöster
     Alias. Bare, ohne Qualifizierung ist das Wort im Deutschen aber
     nicht eindeutig — Aufschnitt gibt es auch beim Käse. Eine echte
     Bon-Zeile „Kaes.aufschn." landete deshalb bei Wurst statt Käse:
     die Kürzungsregel griff exakt auf diesen isolierten Alias zu.
     Der volle Name „Wurstaufschnitt" bleibt über die allgemeine
     Endungs-Erkennung (boundaryOverlap) weiterhin treffbar — auch als
     bloßes „AUFSCHNITT" ohne „Wurst" davor —, nur eben nicht mehr als
     Vorrang-Kurzschluss vor jeder Käse-Zeile. */
  ["wurst_aufschnitt","Wurstaufschnitt",M,10,4,EST,1.79,150,["LYONER","MORTADELLA"]],
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

module.exports = {
  FOOD_DATABASE, STORAGE, DATE_TYPE, ETHYLENE,
  byId, isSafetyCritical, getShelfLife, byCategory, allCategories, databaseQualityReport
};
