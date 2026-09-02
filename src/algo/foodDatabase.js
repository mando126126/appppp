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
  ["kaese_gouda","Gouda Scheiben",M,30,8,EST,2.19,200,["GOUDA","GOUDA SCHEIBEN","GOUDA JUNG","GLGOUDA LEICHTHF3GER.250G VLOG"]],
  ["kaese_emmentaler","Emmentaler",M,30,10,EST,2.49,200,["EMMENTALER"]],
  ["kaese_butterkaese","Butterkäse",M,28,8,EST,1.99,200,["BUTTERKAESE"]],
  ["kaese_bergkaese","Bergkäse",M,40,14,EST,2.99,200,["BERGKAESE"]],
  ["kaese_reibe","Reibekäse",M,25,7,EST,1.79,200,["REIBEKAESE","GERIEBENER KAESE","PIZZAKAESE","GER. KAESE A. RI"]],
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
  ["broetchen","Brötchen",M,2,1,EST,0.45,60,["BROETCHEN","BRÖTCHEN","SEMMEL","SCHRIPPE","KM WEIZ/DINK.BR.SORT.360G"]],
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
  // "Ca-Choco Riegel" steht auf dem Bon zwischen zwei anderen
  // Protein-Riegeln ("Prot.Riegel Erdn-Car", "Protein-Riegel Tiger")
  // — Marke über Websuche nicht sicher identifiziert, aber die
  // Position im Kaufkontext ordnet es eindeutig dieser Warengruppe zu.
  ["proteinriegel","Proteinriegel",M,270,14,EST,1.19,60,["PROTEINRIEGEL","PROT.RIEGEL","PR.RIEGEL","PROTEIN-RIEGEL","PROTEIN RIEGEL","EIWEISSRIEGEL","CA-CHOCO RIEGEL"]],
  ["proteinpulver","Proteinpulver",M,540,180,EST,18.99,1000,["PROTEINPULVER","WHEY","EIWEISSPULVER","IRONMAXX","IRONMA"]],
  ["proteindrink","Proteindrink",M,180,2,EST,1.19,250,["PROTEINDRINK","PROTEIN DRINK","PROTEIN SHAKE","EIWEISSDRINK","SCHOKO PR DRINK"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["proteinkaffee","Protein-Kaffee",M,180,2,EST,1.15,250,["HIGH PROTEIN KAFFEE","PROTEIN KAFFEE","PROTEIN COFFEE"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["proteinpudding","Protein-Pudding",M,30,2,EST,1.29,200,["PROTEINPUDDING","HIGH PROTEIN PUDDING","H.PROT.PUD.VANI","HP TRIPLE DESS."],{storage:STORAGE.FRIDGE_MIDDLE}]
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
  ["nudeln_dinkel","Dinkelnudeln",M,540,180,EST,1.45,500,["DINKEL FUSSILI","BIOLAND DIN. FUSSILI","DINKELNUDELN","DINKEL FUSILLI","DINKEL SPAGH.NAT"]]
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
  // "SCHOKOR" ist kein Tippfehler: ALDI schneidet hier ohne Kürzungspunkt
  // exakt bei Spaltenbreite ab ("Creme Dessert mit Schokor[..]"). Als
  // exakter Alias statt als geratenes Vollwort, um nichts zu behaupten.
  ["desserts_becher","Dessertcreme",M,21,2,EST,0.79,150,["CREME DESSERT","CREME DESSERT MIT SCHOKOR"]],
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
  ["schweinebauch","Schweinebauch",V,3,1,LEIT,4.99,600,["BAUCHSPECK"]],
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
  ["cabanossi","Cabanossi",M,35,12,EST,2.49,200,["CABANOSSI","KABANOSSI"]],
  ["landjaeger","Landjäger",M,60,20,EST,2.79,100,["LANDJAEGER","LANDJÄGER"]],
  ["schinkenwuerfel","Schinkenwürfel",M,14,4,EST,1.49,150,[]],
  ["pastrami","Pastrami",M,14,4,EST,2.99,100,[]],
  ["blutwurst","Blutwurst",M,14,4,EST,2.29,200,["BLUTWURST","ROTWURST"]],
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
  ["sardellen","Sardellenfilets",M,365,5,EST,2.49,50,["SARDELLEN"],{storage:STORAGE.PANTRY}],
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
  // "Gran.Pr.pu.Gr." dekodiert als "Granola Protein pur Groß" — die
  // Markenidentität ist unklar, die Warengruppe (Protein-Granola) über
  // die Standard-Kürzel dieses Bons hinreichend sicher.
  ["granola","Granola",M,270,45,EST,3.49,500,["GRAN.PR.PU.GR. SORT. 500G"]],
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
  ["kidneybohnen","Kidneybohnen Dose",M,900,3,EST,0.89,400,["KIDNEYBOHNEN"]],
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
  ["marzipan","Marzipanrohmasse",M,270,30,EST,2.29,200,["MARZIPAN"]],
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
  ["wein_rot","Rotwein",M,900,3,EST,5.99,750,["DORNFELDER"]],
  ["wein_weiss","Weißwein",M,540,3,EST,5.49,750,[]],
  ["wein_rose","Roséwein",M,365,3,EST,5.49,750,[]],
  ["prosecco","Prosecco",M,540,1,EST,5.99,750,[]],
  ["aperitif","Aperitif",M,900,90,EST,9.99,700,["APERITIF","APEROL","CAMPARI"]],
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
  ["abflussreiniger","Abflussreiniger",N,1095,1095,EST,3.99,1000,["ABFLUSSREINIGER","ROHRREINIGER"]],
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
  ["reisgericht_fertig","Reisgericht Becher",M,300,1,EST,2.49,300,[]],
  ["maultaschen","Maultaschen",M,25,3,EST,2.99,300,[],{storage:STORAGE.FRIDGE_MIDDLE}]
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


/* ================================================================
   Kuratierte Ergänzung: gängige deutsche Supermarktartikel, die
   der Katalog nicht kannte.
   ----------------------------------------------------------------
   Nicht geraten, welche fehlen: 112 in deutschen Haushalten übliche
   Artikel wurden gegen den Abgleich gehalten, 37 davon blieben ohne
   sicheren Treffer. Zwei waren dabei nicht nur Lücken, sondern echte
   FEHLZUORDNUNGEN mit Folgen für die Haltbarkeit:
     „Pfefferbeißer"  landete auf „Pfeffer"      (Wurst -> Gewürz)
     „Schinkenspeck"  landete auf „Kochschinken" (roh -> gegart)
   Beide bekommen jetzt einen eigenen Eintrag.

   Datenqualität: durchweg EST (Schätzwert ohne amtliche Quelle) --
   dieselbe ehrliche Einstufung wie bei den übrigen selbst gepflegten
   Einträgen. Haltbarkeiten sind an vergleichbaren Katalogprodukten
   derselben Warenart ausgerichtet, nicht einzeln belegt.

   Sicherheitsregel eingehalten: keiner dieser Einträge trägt ein
   Verbrauchsdatum (V). Rohe Streichwurst (Mettwurst) folgt dem schon
   vorhandenen Muster der Teewurst -- kurzes MHD plus ausdrücklicher
   Hinweis, statt einer Frist, die Sicherheit vortäuscht.
   ================================================================ */
group("Wurstwaren", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["wurst_gelbwurst","Gelbwurst",M,10,4,EST,1.69,150,["GELBWURST","STADTWURST"]],
  ["wurst_schinkenwurst","Schinkenwurst",M,12,4,EST,1.79,150,["SCHINKENWURST"]],
  ["wurst_bierschinken","Bierschinken",M,12,4,EST,1.79,150,["BIERSCHINKEN"]],
  ["wurst_krakauer","Krakauer",M,18,5,EST,2.29,250,["KRAKAUER"]],
  ["wurst_pfefferbeisser","Pfefferbeißer",M,45,14,EST,2.29,150,["PFEFFERBEISSER","PFEFFERBEIßER"]],
  ["wurst_schinkenspeck","Schinkenspeck",M,21,7,EST,2.29,150,["SCHINKENSPECK","DUERRFLEISCH"]],
  ["wurst_mettwurst","Mettwurst",M,18,5,EST,1.99,150,["METTWURST","ZWIEBELMETTWURST"],
    {note:"Streichfähige Rohwurst. Wie bei Teewurst gilt: nach dem Öffnen zügig aufbrauchen, bei Verfärbung oder säuerlichem Geruch entsorgen."}],
]);

group("Körperpflege", "Drogerie", STORAGE.NONE, [
  ["duschcreme","Duschcreme",M,900,180,EST,2.29,300,["DUSCHCREME","CREMEDUSCHE"]],
  ["koerperoel","Körperöl",M,720,180,EST,4.49,200,["KOERPEROEL","BODY OIL"]]
]);

group("Waschen & Reinigen", "Drogerie", STORAGE.NONE, [
  ["waschmittel_fluessig","Flüssigwaschmittel",M,900,365,EST,5.49,1500,["FLUESSIGWASCHMITTEL","WASCHMITTEL FLUESSIG"]],
  ["hygienespueler","Hygienespüler",M,900,365,EST,3.49,1500,["HYGIENESPUELER"]],
]);

group("Haushaltszubehör", "Drogerie", STORAGE.NONE, [
  ["grillkohle","Grillkohle",N,1800,1800,EST,5.99,3000,["GRILLKOHLE","HOLZKOHLE"]],
  ["grillanzuender","Grillanzünder",N,1800,1800,EST,2.49,500,["GRILLANZUENDER"]],
  ["einweggeschirr","Einweggeschirr",N,1800,1800,EST,2.99,300,["EINWEGGESCHIRR","PAPPTELLER","PLASTIKBECHER"]],
  ["frischhaltedosen","Frischhaltedosen",N,3600,3600,EST,4.99,400,["FRISCHHALTEDOSEN","VORRATSDOSEN"]],
  ["geschenkpapier","Geschenkpapier",N,1800,1800,EST,1.99,150,["GESCHENKPAPIER"]],
  ["luftballons","Luftballons",N,1800,1800,EST,2.49,100,["LUFTBALLONS"]]
]);

group("Baby", "Drogerie", STORAGE.NONE, [
  ["babyoel","Babyöl",M,900,180,EST,2.99,200,["BABYOEL"]],
  ["babypuder","Babypuder",M,900,365,EST,2.49,100,["BABYPUDER"]],
  ["stilleinlagen","Stilleinlagen",N,1800,1800,EST,3.99,120,["STILLEINLAGEN"]],
  ["windeleimerbeutel","Windeleimerbeutel",N,1800,1800,EST,4.49,200,["WINDELEIMERBEUTEL"]]
]);

group("Tierbedarf", "Drogerie", STORAGE.NONE, [
  ["hundekauknochen","Hundekauknochen",M,540,90,EST,3.49,200,["HUNDEKAUKNOCHEN","KAUKNOCHEN"]],
  ["katzenminze","Katzenminze",M,720,180,EST,2.99,30,["KATZENMINZE"]],
  ["nagerfutter","Nagerfutter",M,540,90,EST,3.29,1000,["NAGERFUTTER","MEERSCHWEINCHENFUTTER","KANINCHENFUTTER","HAMSTERFUTTER"]],
  ["aquarienfutter","Aquarienfutter",M,720,180,EST,4.49,100,["AQUARIENFUTTER"]]
]);

group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["malzbier","Malzbier",M,270,3,EST,0.99,500,["MALZBIER","MALZTRUNK"]]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["kuvertuere","Kuvertüre",M,540,90,EST,1.99,200,["KUVERTUERE","SCHOKOGLASUR"]],
  ["weizenkleie","Weizenkleie",M,270,60,EST,1.79,250,["WEIZENKLEIE"]],
  ["haferkleie","Haferkleie",M,270,60,EST,2.29,250,["HAFERKLEIE"]]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Milchprodukte", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["off_kerrygold_extra","Kerrygold extra",M,25,4,EST,1.49,250,["KERRYGOLD EXTRA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_parmigiano_reggiano","Parmigiano reggiano",M,25,4,EST,1.49,60,["PARMIGIANO REGGIANO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_streichfein_ungesalzen_butter","Streichfein ungesalzen Butter",M,25,4,EST,1.49,250,["STREICHFEIN UNGESALZEN BUTTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_fermentiertes_sojaprodukt_heidelbeere","Alpro Fermentiertes Sojaprodukt, Heidelbeere",M,25,4,EST,1.49,500,["ALPRO FERMENTIERTES SOJAPRODUKT, HEIDELBEERE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_buko_der_sahnige","Buko - Der Sahnige",M,25,4,EST,1.49,200,["BUKO - DER SAHNIGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_high_protein_pfirsich_orange","High Protein Pfirsich-Orange",M,25,4,EST,1.49,200,["HIGH PROTEIN PFIRSICH-ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_alpro_joghurt_soja_heidelbeere","Danone ALPRO Joghurt Soja Heidelbeere",M,25,4,EST,1.49,400,["DANONE ALPRO JOGHURT SOJA HEIDELBEERE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kerrygold_extra_mit_meersalz","Kerrygold extra mit Meersalz",M,25,4,EST,1.49,250,["KERRYGOLD EXTRA MIT MEERSALZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_creme_joghurt_mild_pfirsich_maracuja","Creme Joghurt mild Pfirsich maracuja",M,25,4,EST,1.49,1000,["CREME JOGHURT MILD PFIRSICH MARACUJA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_geramont","Käse Géramont",M,25,4,EST,1.49,200,["KÄSE GÉRAMONT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kerrygold_cheddar_scheiben_herzhaft","Kerrygold Cheddar Scheiben herzhaft",M,25,4,EST,1.49,150,["KERRYGOLD CHEDDAR SCHEIBEN HERZHAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_obazda_klassisch","Obazda klassisch",M,25,4,EST,1.49,125,["OBAZDA KLASSISCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_buko_balance","Buko - Balance",M,25,4,EST,1.49,200,["BUKO - BALANCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fitline_0_2_fett","Fitline 0,2% Fett",M,25,4,EST,1.49,170,["FITLINE 0,2% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_meggle_streichzart_ungesalzen","Meggle Streichzart - ungesalzen",M,25,4,EST,1.49,250,["MEGGLE STREICHZART - UNGESALZEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_crefee_mit_feinen_kraeutern","Crefee mit feinen Kräutern",M,25,4,EST,1.49,150,["CREFEE MIT FEINEN KRÄUTERN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_philadelphia_balance","Philadelphia Balance",M,25,4,EST,1.49,175,["PHILADELPHIA BALANCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_der_sahnige","Frischkäse der Sahnige",M,25,4,EST,1.49,300,["FRISCHKÄSE DER SAHNIGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_cremefine_zum_kochen_7_fett","Cremefine zum Kochen 7% Fett",M,25,4,EST,1.49,250,["CREMEFINE ZUM KOCHEN 7% FETT","RAMA CREMEFINE 7% 250ML"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bergbauern_kaese","Bergbauern Käse",M,25,4,EST,1.49,150,["BERGBAUERN KÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_miree_franzoesische_kraeuter","Miree - Französische Kräuter",M,25,4,EST,1.49,150,["MIREE - FRANZÖSISCHE KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_brunch_paprika_peperoni","Brunch - Paprika & Peperoni",M,25,4,EST,1.49,200,["BRUNCH - PAPRIKA & PEPERONI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghut_griechischer_art","Joghut Griechischer Art",M,25,4,EST,1.49,250,["JOGHUT GRIECHISCHER ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_buko_typ_india","Buko - Typ India",M,25,4,EST,1.49,200,["BUKO - TYP INDIA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_3_5_fett","Joghurt 3,5% Fett",M,25,4,EST,1.49,250,["JOGHURT 3,5% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_leerdammer_original","Leerdammer Original",M,25,4,EST,1.49,140,["LEERDAMMER ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bio_yogurt_mela_pera","Bio Yogurt mela & pera",M,25,4,EST,1.49,150,["BIO YOGURT MELA & PERA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_geramont_cremig_leicht","Geramont Cremig-leicht",M,25,4,EST,1.49,250,["GERAMONT CREMIG-LEICHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fruehlingsquark","Frühlingsquark",M,25,4,EST,1.49,185,["FRÜHLINGSQUARK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_proactiv","Proactiv",M,25,4,EST,1.49,250,["PROACTIV"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_edamer","Edamer",M,25,4,EST,1.49,400,["EDAMER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_hirtenkaese_nach_traditioneller_art","Hirtenkäse nach traditioneller Art",M,25,4,EST,1.49,200,["HIRTENKÄSE NACH TRADITIONELLER ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_dovgan","Dovgan",M,25,4,EST,1.49,250,["DOVGAN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_gruenlaender_mild_nussig_das_original","Grünländer Mild & Nussig Das Original",M,25,4,EST,1.49,140,["GRÜNLÄNDER MILD & NUSSIG DAS ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_brunch","Brunch",M,25,4,EST,1.49,185,["BRUNCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kerrygold_irische_butter","Kerrygold Irische Butter",M,25,4,EST,1.49,200,["KERRYGOLD IRISCHE BUTTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_haltbare_milch_3_8_fett","Haltbare Milch 3,8% Fett",M,25,4,EST,1.49,1000,["HALTBARE MILCH 3,8% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_camembert_cremig_wuerzig","Camembert Cremig-Würzig",M,25,4,EST,1.49,200,["CAMEMBERT CREMIG-WÜRZIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_napolact_bio_chefir","Napolact Bio Chefir",M,25,4,EST,1.49,250,["NAPOLACT BIO CHEFIR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_caractere","Caractère",M,25,4,EST,1.49,140,["CARACTÈRE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_k_rgarden_ungesalzen","Kærgården - ungesalzen",M,25,4,EST,1.49,100,["KÆRGÅRDEN - UNGESALZEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_cremefine_zum_kochen_15_fett","Cremefine zum Kochen 15% Fett",M,25,4,EST,1.49,250,["CREMEFINE ZUM KOCHEN 15% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_alpro_joghurt_soja_natur","Danone ALPRO Joghurt Soja Natur",M,25,4,EST,1.49,400,["DANONE ALPRO JOGHURT SOJA NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_patros_natur","Patros Natur",M,25,4,EST,1.49,180,["PATROS NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_leerdammer","Leerdammer",M,25,4,EST,1.49,250,["LEERDAMMER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_old_amsterdam","Old Amsterdam",M,25,4,EST,1.49,125,["OLD AMSTERDAM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_brunch_natur","Brunch - Natur",M,25,4,EST,1.49,185,["BRUNCH - NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_frischkaese_pur","Käse Frischkäse Pur",M,25,4,EST,1.49,300,["KÄSE FRISCHKÄSE PUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fettarmer_fruchtjoghurt_aprikose","Fettarmer Fruchtjoghurt Aprikose",M,25,4,EST,1.49,250,["FETTARMER FRUCHTJOGHURT APRIKOSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_speisequark_20_fett","Speisequark 20% Fett",M,25,4,EST,1.49,250,["SPEISEQUARK 20% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_buko_pikante_kraeuter","Buko Pikante Kräuter",M,25,4,EST,1.49,200,["BUKO PIKANTE KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_streichfein_gesalzen","Streichfein, gesalzen",M,25,4,EST,1.49,250,["STREICHFEIN, GESALZEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bavaria_blu_der_wuerzige","Bavaria blu Der Würzige",M,25,4,EST,1.49,175,["BAVARIA BLU DER WÜRZIGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fettarmer_joghurt_mild_1_5","Fettarmer Joghurt mild 1,5 %",M,25,4,EST,1.49,500,["FETTARMER JOGHURT MILD 1,5 %"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_aufschnitt","Käse-Aufschnitt",M,25,4,EST,1.49,250,["KÄSE-AUFSCHNITT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_emmentaler_in_scheiben","Emmentaler in Scheiben",M,25,4,EST,1.49,250,["EMMENTALER IN SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_doppelrahmstufe_waermebehandelt","Frischkäse Doppelrahmstufe wärmebehandelt",M,25,4,EST,1.49,300,["FRISCHKÄSE DOPPELRAHMSTUFE WÄRMEBEHANDELT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_mit_feinen_kraeutern","Frischkäse mit feinen Kräutern",M,25,4,EST,1.49,300,["FRISCHKÄSE MIT FEINEN KRÄUTERN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_mild_3_8_fett","Joghurt mild 3,8 % Fett",M,25,4,EST,1.49,500,["JOGHURT MILD 3,8 % FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_mit_joghurt","Frischkäse mit Joghurt",M,25,4,EST,1.49,200,["FRISCHKÄSE MIT JOGHURT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_koerniger_frischkaese_33_fett","Körniger Frischkäse 33 % Fett",M,25,4,EST,1.49,250,["KÖRNIGER FRISCHKÄSE 33 % FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_zott_cheese_snack_x4","Zott Cheese Snack X4",M,25,4,EST,1.49,2,["ZOTT CHEESE SNACK X4"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_streichzart","Streichzart",M,25,4,EST,1.49,250,["STREICHZART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_buko_typ_toskana","Buko - Typ Toskana",M,25,4,EST,1.49,200,["BUKO - TYP TOSKANA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_mit_der_ecke_schoko_balls","Joghurt mit der Ecke - Schoko Balls",M,25,4,EST,1.49,150,["JOGHURT MIT DER ECKE - SCHOKO BALLS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_griechisches_joghurt_2_fett","Griechisches Joghurt 2% Fett",M,25,4,EST,1.49,1000,["GRIECHISCHES JOGHURT 2% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_in_salzlake","Käse in Salzlake",M,25,4,EST,1.49,1000,["KÄSE IN SALZLAKE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_crefee","Crefée",M,25,4,EST,1.49,150,["CREFÉE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bio_landkaese_mild_nussig","Bio-Landkäse mild-nussig",M,25,4,EST,1.49,200,["BIO-LANDKÄSE MILD-NUSSIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bergbauern_kaese_wuerzig_nussig","Bergbauern Käse würzig-nussig",M,25,4,EST,1.49,150,["BERGBAUERN KÄSE WÜRZIG-NUSSIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fitline_protein_pfirsich_maracuja","Fitline Protein Pfirsich-Maracuja",M,25,4,EST,1.49,400,["FITLINE PROTEIN PFIRSICH-MARACUJA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bifidus","Bifidus",M,25,4,EST,1.49,150,["BIFIDUS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_mueritzer_original_cremig_wuerzig","Müritzer Original cremig würzig",M,25,4,EST,1.49,150,["MÜRITZER ORIGINAL CREMIG WÜRZIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_saint_albray_vollmundig_wuerzig","Saint Albray vollmundig & würzig",M,25,4,EST,1.49,180,["SAINT ALBRAY VOLLMUNDIG & WÜRZIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_premium_cheddar_extra_mature","Premium Cheddar Extra Mature",M,25,4,EST,1.49,125,["PREMIUM CHEDDAR EXTRA MATURE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_cremosano_leichte_creme_zum_kochen","Cremosano leichte Creme zum Kochen",M,25,4,EST,1.49,250,["CREMOSANO LEICHTE CREME ZUM KOCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_smalgarden","Smålgarden",M,25,4,EST,1.49,250,["SMÅLGARDEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_k_rgarden_bio_ungesalzen_butter","Kærgården Bio ungesalzen-Butter",M,25,4,EST,1.49,200,["KÆRGÅRDEN BIO UNGESALZEN-BUTTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_philadelphia_kraeuter_balance","Philadelphia Kräuter Balance",M,25,4,EST,1.49,175,["PHILADELPHIA KRÄUTER BALANCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_geramont_cremig_zarte_scheiben","Géramont cremig-zarte Scheiben",M,25,4,EST,1.49,150,["GÉRAMONT CREMIG-ZARTE SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_k_rgarden_gesalzen","Kærgården gesalzen",M,25,4,EST,1.49,250,["KÆRGÅRDEN GESALZEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_quark_nach_russischer_art","Quark nach russischer Art",M,25,4,EST,1.49,250,["QUARK NACH RUSSISCHER ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_creme_fraiche_30_fett","Crème fraiche 30% Fett",M,25,4,EST,1.49,200,["CRÈME FRAICHE 30% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_grill_und_pfannenkaese","Grill- und Pfannenkäse",M,25,4,EST,1.49,200,["GRILL- UND PFANNENKÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fruehlings_quark_7_kraeuter","Frühlings Quark 7 Kräuter",M,25,4,EST,1.49,185,["FRÜHLINGS QUARK 7 KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_ziegencreme","Ziegencreme",M,25,4,EST,1.49,150,["ZIEGENCREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_edelblu_classic","Edelblu Classic",M,25,4,EST,1.49,100,["EDELBLU CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_fass_kraeuter","Frischkäse-Fass - Kräuter",M,25,4,EST,1.49,200,["FRISCHKÄSE-FASS - KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_emmentaler_am_stueck","Emmentaler am Stück",M,25,4,EST,1.49,400,["EMMENTALER AM STÜCK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_ziegenkaese_in_salzlake","Ziegenkäse in Salzlake",M,25,4,EST,1.49,800,["ZIEGENKÄSE IN SALZLAKE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_gruenlaender_wuerzig","Grünländer Würzig",M,25,4,EST,1.49,120,["GRÜNLÄNDER WÜRZIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_exquisa_balance_frischkaese","Exquisa Balance Frischkäse",M,25,4,EST,1.49,200,["EXQUISA BALANCE FRISCHKÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_sylter_kaese","Sylter Käse",M,25,4,EST,1.49,150,["SYLTER KÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_philadelphia_so_leicht","Philadelphia So leicht",M,25,4,EST,1.49,175,["PHILADELPHIA SO LEICHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_geramont_mit_joghurt","Geramont mit Joghurt",M,25,4,EST,1.49,250,["GERAMONT MIT JOGHURT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_frischkaese_kraeuter","Käse Frischkäse Kräuter",M,25,4,EST,1.49,300,["KÄSE FRISCHKÄSE KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_saint_albray","Käse - Saint Albray",M,25,4,EST,1.49,180,["KÄSE - SAINT ALBRAY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_burlander_herzhaft","Burlander Herzhaft",M,25,4,EST,1.49,150,["BURLANDER HERZHAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_miree_paprika_chili","Miree Paprika-Chili",M,25,4,EST,1.49,150,["MIREE PAPRIKA-CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kiri","Kiri",M,25,4,EST,1.49,108,["KIRI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_caractere_wuerzig_intensiv","Caractere würzig&intensiv",M,25,4,EST,1.49,130,["CARACTERE WÜRZIG&INTENSIV"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_legere_nussig_mild","Légère nussig & mild",M,25,4,EST,1.49,150,["LÉGÈRE NUSSIG & MILD"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_weidekaese_wuerzig","Weidekäse würzig",M,25,4,EST,1.49,140,["WEIDEKÄSE WÜRZIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_philadelphia","Philadelphia",M,25,4,EST,1.49,265,["PHILADELPHIA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fitline_quark_joghurt_creme_vanille","Fitline Quark-Joghurt-Creme Vanille",M,25,4,EST,1.49,400,["FITLINE QUARK-JOGHURT-CREME VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_original_obazda_lauchzwiebel_ohne_kuemmel","Original Obazda Lauchzwiebel (ohne Kümmel)",M,25,4,EST,1.49,125,["ORIGINAL OBAZDA LAUCHZWIEBEL (OHNE KÜMMEL)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischkaese_mit_kreutern","Frischkäse mit Kreutern",M,25,4,EST,1.49,300,["FRISCHKÄSE MIT KREUTERN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kaese_mueritzer_herzhaft","Käse Müritzer, herzhaft",M,25,4,EST,1.49,150,["KÄSE MÜRITZER, HERZHAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_fruchtzwerge_erdbeere_himbeere_kirsche","Danone FruchtZwerge Erdbeere/Himbeere/Kirsche",M,25,4,EST,1.49,300,["DANONE FRUCHTZWERGE ERDBEERE/HIMBEERE/KIRSCHE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_kerrygold_frisch_cremig_kirschpaprika","Kerrygold Frisch & Cremig - Kirschpaprika",M,25,4,EST,1.49,150,["KERRYGOLD FRISCH & CREMIG - KIRSCHPAPRIKA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bergbauernkaese","Bergbauernkäse",M,25,4,EST,1.49,150,["BERGBAUERNKÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_feta_24_5_mg","Feta (24,5% MG)",M,25,4,EST,1.49,150,["FETA (24,5% MG)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bresso_balance","Bresso Balance",M,25,4,EST,1.49,150,["BRESSO BALANCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fruchtzwerge","Fruchtzwerge",M,25,4,EST,1.49,300,["FRUCHTZWERGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fitline_protein_fraise","Fitline protein fraise",M,25,4,EST,1.49,400,["FITLINE PROTEIN FRAISE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_mozzarella_minis_light","Mozzarella-Minis - Light",M,25,4,EST,1.49,250,["MOZZARELLA-MINIS - LIGHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_mini_babybel_original","Mini-Babybel Original",M,25,4,EST,1.49,120,["MINI-BABYBEL ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_franzoesischer_weichkaese_60_fett_i_tr","Französischer Weichkäse 60 % Fett i. Tr.",M,25,4,EST,1.49,200,["FRANZÖSISCHER WEICHKÄSE 60 % FETT I. TR."],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_exquisa_frischkaese_fitline_0_2_kraeuter","Exquisa Frischkäse Fitline 0,2% Kräuter",M,25,4,EST,1.49,200,["EXQUISA FRISCHKÄSE FITLINE 0,2% KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_nordlicht","Nordlicht",M,25,4,EST,1.49,250,["NORDLICHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_frischella_frischkaese_mit_joghurt_kraeutern","Frischella Frischkäse mit Joghurt & Kräutern",M,25,4,EST,1.49,200,["FRISCHELLA FRISCHKÄSE MIT JOGHURT & KRÄUTERN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_hoehlenkaese_classic","Höhlenkäse Classic",M,25,4,EST,1.49,150,["HÖHLENKÄSE CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_ziegenkaese_in_scheiben","Ziegenkäse in Scheiben",M,25,4,EST,1.49,150,["ZIEGENKÄSE IN SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_8_frischkaese_portionen_feine_kraeuter","8 Frischkäse-Portionen - Feine Kräuter",M,25,4,EST,1.49,120,["8 FRISCHKÄSE-PORTIONEN - FEINE KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_eatlean_kaese","Eatlean Käse",M,25,4,EST,1.49,250,["EATLEAN KÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_mango_ohne_zuckerzusatz","Mango Ohne Zuckerzusatz",M,25,4,EST,1.49,400,["MANGO OHNE ZUCKERZUSATZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_fermentiertes_sojaprodukt_ungesuesst","Fermentiertes Sojaprodukt, Ungesüßt",M,25,4,EST,1.49,500,["FERMENTIERTES SOJAPRODUKT, UNGESÜSST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_sojagurt_classic_ohne_zucker","Sojagurt Classic ohne Zucker",M,25,4,EST,1.49,500,["SOJAGURT CLASSIC OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_alpro_joghurt_soja_natur_ungesuesst","Danone ALPRO Joghurt Soja Natur ungesüßt",M,25,4,EST,1.49,400,["DANONE ALPRO JOGHURT SOJA NATUR UNGESÜSST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_fermentiertes_sojaprodukt_kirsche","Alpro Fermentiertes Sojaprodukt, Kirsche",M,25,4,EST,1.49,500,["ALPRO FERMENTIERTES SOJAPRODUKT, KIRSCHE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_alpro_joghurt_soja_vanille","Danone ALPRO Joghurt Soja Vanille",M,25,4,EST,1.49,400,["DANONE ALPRO JOGHURT SOJA VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_alpro_joghurt_soja_hafer","Danone ALPRO Joghurt Soja Hafer",M,25,4,EST,1.49,400,["DANONE ALPRO JOGHURT SOJA HAFER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_mild_3_5_fett","Joghurt mild 3,5% Fett",M,25,4,EST,1.49,500,["JOGHURT MILD 3,5% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_pfirsich_aus_soja","Pfirsich aus Soja",M,25,4,EST,1.49,400,["PFIRSICH AUS SOJA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_activia_100_pflanzlich_natur_ungesuesst","Danone ACTIVIA 100% Pflanzlich Natur ungesüßt",M,25,4,EST,1.49,400,["DANONE ACTIVIA 100% PFLANZLICH NATUR UNGESÜSST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_vemondo_vegan_kokosdessert_pfirsich_maracuja","Vemondo vegan Kokosdessert Pfirsich Maracuja",M,25,4,EST,1.49,150,["VEMONDO VEGAN KOKOSDESSERT PFIRSICH MARACUJA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_high_protein_caramel_style_pudding","High Protein Caramel Style Pudding",M,25,4,EST,1.49,200,["HIGH PROTEIN CARAMEL STYLE PUDDING"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_mit_der_ecke_schoko_flakes","Joghurt mit der Ecke - Schoko-Flakes",M,25,4,EST,1.49,150,["JOGHURT MIT DER ECKE - SCHOKO-FLAKES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_roeryoghurt_halfvol","Roeryoghurt halfvol",M,25,4,EST,1.49,500,["ROERYOGHURT HALFVOL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_der_grosse_bauer_heidelbeer_cassis","Der große Bauer Heidelbeer-Cassis",M,25,4,EST,1.49,250,["DER GROSSE BAUER HEIDELBEER-CASSIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_joghurt_griechischer_art_pur","Joghurt Griechischer Art (pur)",M,25,4,EST,1.49,250,["JOGHURT GRIECHISCHER ART (PUR)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_cremiger_bio_joghurt_mild_3_8_fett","Cremiger Bio-Joghurt mild - 3,8 % Fett",M,25,4,EST,1.49,500,["CREMIGER BIO-JOGHURT MILD - 3,8 % FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_danone_activia_natur_3_5_4_x_115g","Danone ACTIVIA Natur 3,5% 4 x 115g =",M,25,4,EST,1.49,460,["DANONE ACTIVIA NATUR 3,5% 4 X 115G ="],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_knusperjoghurt_waffelcrunchies","Knusperjoghurt Waffelcrunchies",M,25,4,EST,1.49,175,["KNUSPERJOGHURT WAFFELCRUNCHIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bio_jogurt_mild_natur","Bio-Jogurt mild Natur",M,25,4,EST,1.49,500,["BIO-JOGURT MILD NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_der_grosse_bauer_erdbeere","Der große Bauer - Erdbeere",M,25,4,EST,1.49,250,["DER GROSSE BAUER - ERDBEERE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bio_organic_cremiger_joghurt_mild_3_8_fett","Bio Organic Cremiger Joghurt Mild (3,8% Fett)",M,25,4,EST,1.49,500,["BIO ORGANIC CREMIGER JOGHURT MILD (3,8% FETT)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_ritter_sport_joghurt","Ritter Sport Joghurt",M,25,4,EST,1.49,100,["RITTER SPORT JOGHURT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_biojoghurt_fettarm_1_8","Biojoghurt Fettarm 1.8%",M,25,4,EST,1.49,250,["BIOJOGHURT FETTARM 1.8%"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}],
  ["off_bio_ziegenjoghurt","Bio-Ziegenjoghurt",M,25,4,EST,1.49,500,["BIO-ZIEGENJOGHURT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Milchprodukte-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["off_bon_gelati_eiscreme_mit_schlagsahne","Bon Gelati Eiscreme mit Schlagsahne",M,300,2,EST,2.49,1000,["BON GELATI EISCREME MIT SCHLAGSAHNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesepfanne_alla_toscana","Gemüsepfanne alla Toscana",M,300,2,EST,2.49,480,["GEMÜSEPFANNE ALLA TOSCANA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuese_junger_spinat","Gemüse Junger Spinat",M,300,2,EST,2.49,225,["GEMÜSE JUNGER SPINAT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesepfanne_asiatische_art","Gemüsepfanne Asiatische Art",M,300,2,EST,2.49,750,["GEMÜSEPFANNE ASIATISCHE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_pfannengemuese_italienische_art","Pfannengemüse Italienische Art",M,300,2,EST,2.49,750,["PFANNENGEMÜSE ITALIENISCHE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_pfannengemuese_asiatische_art","Pfannengemüse - Asiatische Art",M,300,2,EST,2.49,750,["PFANNENGEMÜSE - ASIATISCHE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_edamamebohnen","Edamamebohnen",M,300,2,EST,2.49,200,["EDAMAMEBOHNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_chocolate_fudge_brownie","Chocolate Fudge Brownie",M,300,2,EST,2.49,408,["CHOCOLATE FUDGE BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_bourbon_vanille_eis","Bourbon Vanille Eis",M,300,2,EST,2.49,1000,["BOURBON VANILLE EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_mon_cherie","Mon Cherie",M,300,2,EST,2.49,315,["MON CHERIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eis","Eis",M,300,2,EST,2.49,250,["EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesestaebchen","Gemüsestäbchen",M,300,2,EST,2.49,250,["GEMÜSESTÄBCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_mandel_cranberry_mix","Mandel-Cranberry-Mix",M,300,2,EST,2.49,150,["MANDEL-CRANBERRY-MIX"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_mandelstieleis","Mandelstieleis",M,300,2,EST,2.49,84,["MANDELSTIELEIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_mochi","Mochi",M,300,2,EST,2.49,250,["MOCHI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_helado_sorbete_de_mango","Helado sorbete de mango",M,300,2,EST,2.49,600,["HELADO SORBETE DE MANGO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_heidelbeere_mit_80_fruchtanteil","Heidelbeere mit 80% Fruchtanteil",M,300,2,EST,2.49,250,["HEIDELBEERE MIT 80% FRUCHTANTEIL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_reiswaffeln_mit_salz","Reiswaffeln mit Salz",M,300,2,EST,2.49,100,["REISWAFFELN MIT SALZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_stracciatella_premium_eis","Stracciatella Premium Eis",M,300,2,EST,2.49,518,["STRACCIATELLA PREMIUM EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_rahm_spinat_mit_dem_blubb","Rahm-Spinat mit dem Blubb",M,300,2,EST,2.49,750,["RAHM-SPINAT MIT DEM BLUBB"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_salted_caramel_cake","Salted caramel cake",M,300,2,EST,2.49,251,["SALTED CARAMEL CAKE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_strawberry_ice_cream_premium","Strawberry ice cream premium",M,300,2,EST,2.49,1000,["STRAWBERRY ICE CREAM PREMIUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_maple_walnuts_eis","Maple Walnuts Eis",M,300,2,EST,2.49,476,["MAPLE WALNUTS EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmerfilet_brokkoli_mandel","Schlemmerfilet Brokkoli Mandel",M,300,2,EST,2.49,250,["SCHLEMMERFILET BROKKOLI MANDEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_bami_goreng_4008366001309","Bami Goreng 4008366001309",M,300,2,EST,2.49,500,["BAMI GORENG 4008366001309"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_netflix_chill_d_peanut_butter_ice_cream","Netflix & Chill'd Peanut Butter Ice Cream",M,300,2,EST,2.49,405,["NETFLIX & CHILL'D PEANUT BUTTER ICE CREAM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_cremissimo_bourbon_vanilleeis","Cremissimo Bourbon Vanilleeis",M,300,2,EST,2.49,250,["CREMISSIMO BOURBON VANILLEEIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesepfanne_alla_mediterranea","Gemüsepfanne alla Mediterranea",M,300,2,EST,2.49,480,["GEMÜSEPFANNE ALLA MEDITERRANEA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_salted_caramel","Salted Caramel",M,300,2,EST,2.49,430,["SALTED CARAMEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_duo_dough_brownie","Duo dough&brownie",M,300,2,EST,2.49,250,["DUO DOUGH&BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_cremissimo_eis","Cremissimo Eis",M,300,2,EST,2.49,250,["CREMISSIMO EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_biscoff_ice_cream_schoko","Biscoff Ice Cream Schoko",M,300,2,EST,2.49,90,["BISCOFF ICE CREAM SCHOKO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gyros_reis_pfanne","Gyros Reis-Pfanne",M,300,2,EST,2.49,750,["GYROS REIS-PFANNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmerfiler_bordolaise","Schlemmerfiler Bordolaise",M,300,2,EST,2.49,380,["SCHLEMMERFILER BORDOLAISE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_cookies_cream","Cookies & Cream",M,300,2,EST,2.49,460,["COOKIES & CREAM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_frosta_spaetzle_pfanne","Frosta Spätzle Pfanne",M,300,2,EST,2.49,500,["FROSTA SPÄTZLE PFANNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eis_after_dinner_classic","Eis After Dinner Classic",M,300,2,EST,2.49,250,["EIS AFTER DINNER CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_vegan_sea_salt_caramel","Vegan sea salt caramel",M,300,2,EST,2.49,270,["VEGAN SEA SALT CARAMEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_magnum_mini_double","Magnum Mini Double",M,300,2,EST,2.49,360,["MAGNUM MINI DOUBLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eis_auf_kokosnussmilchbasis","Eis auf Kokosnussmilchbasis",M,300,2,EST,2.49,276,["EIS AUF KOKOSNUSSMILCHBASIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuese_pfanne_curry_kokos","Gemüse Pfanne Curry Kokos",M,300,2,EST,2.49,480,["GEMÜSE PFANNE CURRY KOKOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmerfilet_bordelaise_knusper","Schlemmerfilet Bordelaise Knusper",M,300,2,EST,2.49,250,["SCHLEMMERFILET BORDELAISE KNUSPER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_capri","Capri",M,300,2,EST,2.49,495,["CAPRI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_salted_caramel_brownie","Salted Caramel Brownie",M,300,2,EST,2.49,250,["SALTED CARAMEL BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmerfilet_italiano","Schlemmerfilet Italiano",M,300,2,EST,2.49,380,["SCHLEMMERFILET ITALIANO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_choco_crisp_eis","Choco Crisp Eis",M,300,2,EST,2.49,180,["CHOCO CRISP EIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_vantastic_fish_fingers","Vantastic Fish Fingers",M,300,2,EST,2.49,450,["VANTASTIC FISH FINGERS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_cinnamon_roll","Cinnamon Roll",M,300,2,EST,2.49,473,["CINNAMON ROLL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_nogger_choc","Nogger Choc",M,300,2,EST,2.49,90,["NOGGER CHOC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_paella","Paella",M,300,2,EST,2.49,450,["PAELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmerfilet_bordelaise","Schlemmerfilet Bordelaise",M,300,2,EST,2.49,380,["SCHLEMMERFILET BORDELAISE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eiscreme_bourbon_vanille","Eiscreme Bourbon-Vanille",M,300,2,EST,2.49,750,["EISCREME BOURBON-VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_chef_frites","Chef Frites",M,300,2,EST,2.49,750,["CHEF FRITES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_kaugummi_himbeere_vanille","Kaugummi Himbeere Vanille",M,300,2,EST,2.49,250,["KAUGUMMI HIMBEERE VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_jumbo_fries_pommes","Jumbo Fries Pommes",M,300,2,EST,2.49,1000,["JUMBO FRIES POMMES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesepfanne_sommergarten","Gemüsepfanne Sommergarten",M,300,2,EST,2.49,480,["GEMÜSEPFANNE SOMMERGARTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eis_stracciatella","Eis Stracciatella",M,300,2,EST,2.49,520,["EIS STRACCIATELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_caramelita","Caramelita",M,300,2,EST,2.49,200,["CARAMELITA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_nom_nom_noodles","Nom Nom Noodles",M,300,2,EST,2.49,500,["NOM NOM NOODLES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_tortellini_tomaten_sahne_vegetarisch","Tortellini Tomaten-Sahne (vegetarisch)",M,300,2,EST,2.49,500,["TORTELLINI TOMATEN-SAHNE (VEGETARISCH)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_less_tasty_cookie_dough","Less & Tasty - Cookie Dough",M,300,2,EST,2.49,500,["LESS & TASTY - COOKIE DOUGH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_eis_vanilla_brownie","Eis Vanilla Brownie",M,300,2,EST,2.49,500,["EIS VANILLA BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_27g_high_protein_ice_cream_double_chocolate","27g High Protein Ice Cream Double Chocolate",M,300,2,EST,2.49,290,["27G HIGH PROTEIN ICE CREAM DOUBLE CHOCOLATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_kalamata_oliven_ohne_stein","Kalamata Oliven ohne Stein",M,300,2,EST,2.49,350,["KALAMATA OLIVEN OHNE STEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_snickers_ice_cream","Snickers Ice Cream",M,300,2,EST,2.49,73,["SNICKERS ICE CREAM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_sensation_mini","Sensation Mini",M,300,2,EST,2.49,429,["SENSATION MINI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_frites_deluxe","Frites Deluxe",M,300,2,EST,2.49,1000,["FRITES DELUXE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_mit_gemuese_mediterraner_art","Pasta mit Gemüse mediterraner Art",M,300,2,EST,2.49,375,["PASTA MIT GEMÜSE MEDITERRANER ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_filegro_sauerteig_panade","Filegro Sauerteig Panade",M,300,2,EST,2.49,250,["FILEGRO SAUERTEIG PANADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}],
  ["off_gemuese_pfanne_mit_falafeln_bunten_karotten","Gemüse Pfanne mit Falafeln & bunten Karotten",M,300,2,EST,2.49,400,["GEMÜSE PFANNE MIT FALAFELN & BUNTEN KAROTTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Tiefkühl-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["off_caffe_latte_macchiato","Caffe Latte Macchiato",M,365,4,EST,1.79,230,["CAFFE LATTE MACCHIATO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_100_pur_jus_citron_vert_bio","100% pur jus citron vert Bio",M,365,4,EST,1.79,250,["100% PUR JUS CITRON VERT BIO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fruiity_pfirsich_melone","Fruiity Pfirsich Melone",M,365,4,EST,1.79,250,["FRUIITY PFIRSICH MELONE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_geroestete_mandel_ohne_zucker","Geröstete Mandel Ohne Zucker",M,365,4,EST,1.79,1000,["GERÖSTETE MANDEL OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_ohne_zucker_hafer","Ohne Zucker Hafer",M,365,4,EST,1.79,1000,["OHNE ZUCKER HAFER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_barista_hafer","Barista Hafer",M,365,4,EST,1.79,1000,["BARISTA HAFER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_kokonuss_mit_reis","Bio Kokonuss mit Reis",M,365,4,EST,1.79,1000,["BIO KOKONUSS MIT REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_haferdrink_ungesuesst_1_l_fresh","Alpro Haferdrink, Ungesüßt 1 L, FRESH",M,365,4,EST,1.79,1000,["ALPRO HAFERDRINK, UNGESÜSST 1 L, FRESH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_not_milk","Alpro Not Milk",M,365,4,EST,1.79,1000,["ALPRO NOT MILK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_ungesuesst","Alpro Sojadrink, Ungesüßt",M,365,4,EST,1.79,1000,["ALPRO SOJADRINK, UNGESÜSST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_wasser_volvic_naturelle","Wasser Volvic naturelle",M,365,4,EST,1.79,1500,["WASSER VOLVIC NATURELLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_barista_haferdrink_1_l_uht","Alpro Barista Haferdrink, 1 L, UHT",M,365,4,EST,1.79,1000,["ALPRO BARISTA HAFERDRINK, 1 L, UHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_red_bull_original","Red Bull original",M,365,4,EST,1.79,250,["RED BULL ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_mandel_vanille_geschmack","Mandel Vanille Geschmack",M,365,4,EST,1.79,1000,["MANDEL VANILLE GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_mandeldrink_ungesuesst_1_l_fresh","Alpro Mandeldrink Ungesüßt, 1 L, FRESH",M,365,4,EST,1.79,1000,["ALPRO MANDELDRINK UNGESÜSST, 1 L, FRESH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_mandeldrink_ungesuesst_ungeroestet_1_lt","Alpro Mandeldrink Ungesüßt, Ungeröstet 1 LT",M,365,4,EST,1.79,1000,["ALPRO MANDELDRINK UNGESÜSST, UNGERÖSTET 1 LT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_red_bull_sugarfree","Red Bull sugarfree",M,365,4,EST,1.79,250,["RED BULL SUGARFREE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_evian_150cl_pet","Evian 150cl PET",M,365,4,EST,1.79,250,["EVIAN 150CL PET"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_zero_sugar_zero_koffein","Zero Sugar Zero Koffein",M,365,4,EST,1.79,1250,["ZERO SUGAR ZERO KOFFEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_coke_zero","Coke Zero",M,365,4,EST,1.79,250,["COKE ZERO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_vanille_geschmack","Alpro Sojadrink, Vanille-Geschmack",M,365,4,EST,1.79,1000,["ALPRO SOJADRINK, VANILLE-GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_ungesuesst_fresh","Alpro Sojadrink, Ungesüßt fresh",M,365,4,EST,1.79,1000,["ALPRO SOJADRINK, UNGESÜSST FRESH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_mamas_babydream_stillsaft","Mamas Babydream Stillsaft",M,365,4,EST,1.79,500,["MAMAS BABYDREAM STILLSAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_barista_mandeldrink_1_l_uht","Alpro Barista Mandeldrink, 1 L, UHT",M,365,4,EST,1.79,1000,["ALPRO BARISTA MANDELDRINK, 1 L, UHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_spezi","Spezi",M,365,4,EST,1.79,250,["SPEZI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_banane","Alpro Sojadrink, Banane",M,365,4,EST,1.79,1000,["ALPRO SOJADRINK, BANANE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_cocoa","Bio cocoa",M,365,4,EST,1.79,225,["BIO COCOA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_this_is_food_classic_choco","This is Food classic choco",M,365,4,EST,1.79,500,["THIS IS FOOD CLASSIC CHOCO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_coca_cola_zero_sugar","Coca Cola Zero Sugar",M,365,4,EST,1.79,500,["COCA COLA ZERO SUGAR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_soja_drink_natur","Soja Drink Natur",M,365,4,EST,1.79,1000,["SOJA DRINK NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_monster_energy_ultra","Monster Energy Ultra",M,365,4,EST,1.79,500,["MONSTER ENERGY ULTRA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_kokosnussdrink_mit_soja_barista","Kokosnussdrink mit Soja, Barista",M,365,4,EST,1.79,1000,["KOKOSNUSSDRINK MIT SOJA, BARISTA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_mandel_ohne_zucker","Bio Mandel ohne Zucker",M,365,4,EST,1.79,1000,["BIO MANDEL OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_pepsi","Pepsi",M,365,4,EST,1.79,1500,["PEPSI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_jack_daniel_s_old_no_7_whiskey","Jack Daniel's old No. 7 Whiskey",M,365,4,EST,1.79,250,["JACK DANIEL'S OLD NO. 7 WHISKEY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_monster_energy_punch","Monster Energy Punch",M,365,4,EST,1.79,500,["MONSTER ENERGY PUNCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_gerolsteiner_med","Gerolsteiner med",M,365,4,EST,1.79,250,["GEROLSTEINER MED"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_volvic_touch_wasser","Volvic Touch Wasser",M,365,4,EST,1.79,1500,["VOLVIC TOUCH WASSER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_haferdrink_original_1_l_uht_21","Alpro Haferdrink Original, 1 L, UHT, 21",M,365,4,EST,1.79,1000,["ALPRO HAFERDRINK ORIGINAL, 1 L, UHT, 21"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_nescafe_gold_original","Nescafé Gold - Original",M,365,4,EST,1.79,200,["NESCAFÉ GOLD - ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_gerolsteiner_medium","Gerolsteiner Medium",M,365,4,EST,1.79,1500,["GEROLSTEINER MEDIUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_goody_cao","Goody Cao",M,365,4,EST,1.79,800,["GOODY CAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_apfel_direktsaft_naturtrueb","Apfel-Direktsaft Naturtrüb",M,365,4,EST,1.79,1000,["APFEL-DIREKTSAFT NATURTRÜB"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_tassimo_milka","Tassimo Milka",M,365,4,EST,1.79,250,["TASSIMO MILKA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_coca_cola_zero","Coca-Cola Zero",M,365,4,EST,1.79,1500,["COCA-COLA ZERO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_barista_haferdrink_mit_soja","Barista Haferdrink mit Soja",M,365,4,EST,1.79,1000,["BARISTA HAFERDRINK MIT SOJA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_schovit","Schovit",M,365,4,EST,1.79,800,["SCHOVIT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fritz_kola_original","Fritz-kola Original",M,365,4,EST,1.79,330,["FRITZ-KOLA ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_smooth_vanilla","Smooth Vanilla",M,365,4,EST,1.79,500,["SMOOTH VANILLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_sprudel_medium","Sprudel Medium",M,365,4,EST,1.79,1500,["SPRUDEL MEDIUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_kokos_blaubeere_weiss","Kokos Blaubeere (Weiß)",M,365,4,EST,1.79,250,["KOKOS BLAUBEERE (WEISS)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_lagerbier_hell","Lagerbier Hell",M,365,4,EST,1.79,500,["LAGERBIER HELL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_juiced_mango_loco","Juiced Mango Loco",M,365,4,EST,1.79,500,["JUICED MANGO LOCO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_barista","Alpro Sojadrink, Barista",M,365,4,EST,1.79,1000,["ALPRO SOJADRINK, BARISTA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_no_milk_hafer_3_5_fett","No Milk Hafer 3,5% Fett",M,365,4,EST,1.79,1000,["NO MILK HAFER 3,5% FETT","VEHAPPY NO MILK 3,5% 1L"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fresh_berry","Fresh Berry",M,365,4,EST,1.79,500,["FRESH BERRY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_cold_brew_coffee","Cold Brew Coffee",M,365,4,EST,1.79,500,["COLD BREW COFFEE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_soja_drink_calcium","Soja drink calcium",M,365,4,EST,1.79,1000,["SOJA DRINK CALCIUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_premium_indian_tonic","Premium Indian Tonic",M,365,4,EST,1.79,200,["PREMIUM INDIAN TONIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_naturalis_still","Naturalis - Still",M,365,4,EST,1.79,1500,["NATURALIS - STILL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_hafer_mandeldrink","Alpro Hafer-Mandeldrink",M,365,4,EST,1.79,1000,["ALPRO HAFER-MANDELDRINK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_absolut_vodka","Absolut Vodka",M,365,4,EST,1.79,700,["ABSOLUT VODKA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_pepsi_zero","Pepsi Zero",M,365,4,EST,1.79,1500,["PEPSI ZERO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_pepsi_max_getraenkesirup","Pepsi Max Getränkesirup",M,365,4,EST,1.79,440,["PEPSI MAX GETRÄNKESIRUP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fanta","Fanta",M,365,4,EST,1.79,250,["FANTA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_smoothie_triple_yellow","Smoothie - Triple Yellow",M,365,4,EST,1.79,750,["SMOOTHIE - TRIPLE YELLOW"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_vitamin_well_reload","Vitamin Well Reload",M,365,4,EST,1.79,500,["VITAMIN WELL RELOAD","WELL VIT. RELOAD"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_my_veggie_hafer","My Veggie Hafer",M,365,4,EST,1.79,1000,["MY VEGGIE HAFER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_focuswater_active_pineapple_mango","Focuswater Active Pineapple & Mango",M,365,4,EST,1.79,500,["FOCUSWATER ACTIVE PINEAPPLE & MANGO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_no_milk_hafer_1_8_fett","No Milk Hafer 1,8% fett",M,365,4,EST,1.79,250,["NO MILK HAFER 1,8% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_mountain_blast_blue","Mountain Blast - Blue",M,365,4,EST,1.79,500,["MOUNTAIN BLAST - BLUE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_smoothie_triple_pink","Smoothie - Triple Pink",M,365,4,EST,1.79,750,["SMOOTHIE - TRIPLE PINK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_jever_fun_4008948194016_pilsener_alkoholfrei","Jever fun 4008948194016 Pilsener alkoholfrei",M,365,4,EST,1.79,500,["JEVER FUN 4008948194016 PILSENER ALKOHOLFREI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fuzetea","FuzeTea",M,365,4,EST,1.79,500,["FUZETEA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_german_krombacher_pils","German Krombacher Pils",M,365,4,EST,1.79,500,["GERMAN KROMBACHER PILS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_frische_milch_3_8_fett","Frische Milch 3,8% Fett",M,365,4,EST,1.79,1000,["FRISCHE MILCH 3,8% FETT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_ovomaltine","Ovomaltine",M,365,4,EST,1.79,500,["OVOMALTINE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_haferdrink_mit_mandel","Bio-Haferdrink mit Mandel",M,365,4,EST,1.79,1000,["BIO-HAFERDRINK MIT MANDEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_jacobs_gold","Jacobs Gold",M,365,4,EST,1.79,200,["JACOBS GOLD"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_jim_beam_kentucky_straight_bourbon_whiskey","Jim Beam - Kentucky Straight Bourbon Whiskey",M,365,4,EST,1.79,700,["JIM BEAM - KENTUCKY STRAIGHT BOURBON WHISKEY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_ice_tea_pfirsich","Ice Tea - Pfirsich",M,365,4,EST,1.79,2000,["ICE TEA - PFIRSICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_juneberry_sommeredition","Juneberry Sommeredition",M,365,4,EST,1.79,250,["JUNEBERRY SOMMEREDITION"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_mandeldrink_ungesuesst_geroestet","Bio-Mandeldrink ungesüßt & geröstet",M,365,4,EST,1.79,1000,["BIO-MANDELDRINK UNGESÜSST & GERÖSTET"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadrink_schokoladen_geschmack","Alpro Sojadrink, Schokoladen-Geschmack",M,365,4,EST,1.79,250,["ALPRO SOJADRINK, SCHOKOLADEN-GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_hafer_drink_ohne_zucker","Hafer Drink ohne Zucker",M,365,4,EST,1.79,1000,["HAFER DRINK OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_hohes_c_plus_eisen","Hohes C PLUS Eisen",M,365,4,EST,1.79,1000,["HOHES C PLUS EISEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_hafer_drink_vanille","Hafer Drink Vanille",M,365,4,EST,1.79,250,["HAFER DRINK VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_mio_mio_mate_original","Mio Mio Mate original",M,365,4,EST,1.79,500,["MIO MIO MATE ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_gerlosteiner_medium","Gerlosteiner Medium",M,365,4,EST,1.79,750,["GERLOSTEINER MEDIUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_nescafe_classic","Nescafé Classic",M,365,4,EST,1.79,200,["NESCAFÉ CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_krombacher","Krombacher",M,365,4,EST,1.79,250,["KROMBACHER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_muellermilch_erdbeer_geschmack","Müllermilch Erdbeer-Geschmack",M,365,4,EST,1.79,250,["MÜLLERMILCH ERDBEER-GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_soja_ohne_zucker","Bio Soja ohne Zucker",M,365,4,EST,1.79,1000,["BIO SOJA OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_gerolsteiner_sprudelwasser_classic","Gerolsteiner Sprudelwasser Classic",M,365,4,EST,1.79,250,["GEROLSTEINER SPRUDELWASSER CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_biologischer_sojadrink","Alpro Biologischer Sojadrink",M,365,4,EST,1.79,1000,["ALPRO BIOLOGISCHER SOJADRINK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_happy_day_100_orange","Happy day | 100% Orange",M,365,4,EST,1.79,1000,["HAPPY DAY | 100% ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_volvic_bio_tee_hibiskus","Volvic Bio Tee Hibiskus",M,365,4,EST,1.79,750,["VOLVIC BIO TEE HIBISKUS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_coconut_milk_kati","Coconut Milk - Kati",M,365,4,EST,1.79,250,["COCONUT MILK - KATI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_jever_fun","Jever Fun",M,365,4,EST,1.79,330,["JEVER FUN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_drink_mandel_ungesuesst_bio","Drink Mandel Ungesüsst Bio",M,365,4,EST,1.79,1000,["DRINK MANDEL UNGESÜSST BIO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bio_hafer_mandeldrink_ungesuesst","Bio-Hafer-Mandeldrink ungesüßt",M,365,4,EST,1.79,1000,["BIO-HAFER-MANDELDRINK UNGESÜSST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_provamel_bio_haferdrink_no_sugars","Provamel Bio Haferdrink, no sugars",M,365,4,EST,1.79,1000,["PROVAMEL BIO HAFERDRINK, NO SUGARS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_bionade_nat_orange","Bionade Nat. Orange",M,365,4,EST,1.79,330,["BIONADE NAT. ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fanta_exotic","Fanta exotic",M,365,4,EST,1.79,330,["FANTA EXOTIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_iso_light_grapefruit_citrus","Iso Light - Grapefruit-Citrus",M,365,4,EST,1.79,500,["ISO LIGHT - GRAPEFRUIT-CITRUS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_volvic_touch_zero_wassermelone","Volvic Touch Zero Wassermelone",M,365,4,EST,1.79,1500,["VOLVIC TOUCH ZERO WASSERMELONE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_sprite","Sprite",M,365,4,EST,1.79,1250,["SPRITE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_getraenke_fanta_orange","Getränke - FANTA Orange",M,365,4,EST,1.79,500,["GETRÄNKE - FANTA ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_fanta_lemon_ohne_zucker","Fanta Lemon Ohne Zucker",M,365,4,EST,1.79,1250,["FANTA LEMON OHNE ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_coca_cola_light","Coca Cola light",M,365,4,EST,1.79,500,["COCA COLA LIGHT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_volvic_tee_pfirsich","Volvic Tee Pfirsich",M,365,4,EST,1.79,1500,["VOLVIC TEE PFIRSICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_cola_max_cherry_zero","Cola - Max Cherry Zero",M,365,4,EST,1.79,1500,["COLA - MAX CHERRY ZERO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  // "Val.Sport+pinkGrapef." bleibt markenmäßig unklar (nicht dieselbe
  // Schreibweise wie "IsoSport"), aber "Sport" + "pink Grapef[ruit]"
  // legt die Warengruppe (isotonisches Sportgetränk, Grapefruit) fest
  // — die einzige unsichere Stelle ist die genaue Marke, nicht mehr.
  ["off_isosport_grapefruit_citrus","IsoSport Grapefruit-Citrus",M,365,4,EST,1.79,500,["ISOSPORT GRAPEFRUIT-CITRUS","VAL.SPORT+PINKGRAPEF.0,5L"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_rivella_rot","Rivella rot",M,365,4,EST,1.79,500,["RIVELLA ROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_volvic_essence_orange_holunderbluete_75cl_pet","Volvic Essence Orange-Holunderblüte 75cl PET",M,365,4,EST,1.79,750,["VOLVIC ESSENCE ORANGE-HOLUNDERBLÜTE 75CL PET"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_schwip_schwap_cola_orange","Schwip Schwap - Cola & Orange",M,365,4,EST,1.79,1500,["SCHWIP SCHWAP - COLA & ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_exotik","Exotik",M,365,4,EST,1.79,330,["EXOTIK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_orangina_original","Orangina Original",M,365,4,EST,1.79,500,["ORANGINA ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_schwip_schwap_zero","Schwip Schwap Zero",M,365,4,EST,1.79,1500,["SCHWIP SCHWAP ZERO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}],
  ["off_red_bull_pink_sugafree","Red Bull Pink sugafree",M,365,4,EST,1.79,250,["RED BULL PINK SUGAFREE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Getränke-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["off_bio_knusper_muesli_fruechte","Bio Knusper Müsli Früchte",M,8,4,EST,2.49,500,["BIO KNUSPER MÜSLI FRÜCHTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_marmelade_fruchtaufstrich_erdbeere","Marmelade - Fruchtaufstrich Erdbeere",M,8,4,EST,2.49,250,["MARMELADE - FRUCHTAUFSTRICH ERDBEERE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_erdbeere_extra_zero_ohne_zuckerzusatz","Erdbeere Extra, ZERO ohne Zuckerzusatz",M,8,4,EST,2.49,280,["ERDBEERE EXTRA, ZERO OHNE ZUCKERZUSATZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_beerenmischung_mit_sauerkirschen","Beerenmischung mit Sauerkirschen",M,8,4,EST,2.49,750,["BEERENMISCHUNG MIT SAUERKIRSCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_bananen_suess_samtig","Bananen süß & samtig",M,8,4,EST,2.49,250,["BANANEN SÜSS & SAMTIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_sultaninen","Sultaninen",M,8,4,EST,2.49,250,["SULTANINEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_mangoschnitze_getrocknet","Mangoschnitze getrocknet",M,8,4,EST,2.49,200,["MANGOSCHNITZE GETROCKNET"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_wildpreiselbeeren_fruchtig_herb","Wildpreiselbeeren, fruchtig-herb",M,8,4,EST,2.49,400,["WILDPREISELBEEREN, FRUCHTIG-HERB"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tafel_trauben_kernlos","Tafel-Trauben Kernlos",M,8,4,EST,2.49,500,["TAFEL-TRAUBEN KERNLOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_trauben_dunkel_kernlose","Trauben dunkel kernlose",M,8,4,EST,2.49,500,["TRAUBEN DUNKEL KERNLOSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_aepfel_krumme_dinger","Äpfel Krumme Dinger",M,8,4,EST,2.49,2000,["ÄPFEL KRUMME DINGER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_apfel_kirsch_getraenk","Apfel Kirsch Getränk",M,8,4,EST,2.49,200,["APFEL KIRSCH GETRÄNK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_datteln_trader_joe_s","Datteln Trader Joe´s",M,8,4,EST,2.49,200,["DATTELN TRADER JOE´S"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_apfel_suess_saeuerlich","Apfel süß-säuerlich",M,8,4,EST,2.49,2000,["APFEL SÜSS-SÄUERLICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_trauben_dunkel_kernlos","Trauben dunkel kernlos",M,8,4,EST,2.49,500,["TRAUBEN DUNKEL KERNLOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_apfel_rot_braeburn","Apfel rot Braeburn",M,8,4,EST,2.49,250,["APFEL ROT BRAEBURN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_beerenmix_mit_sauerkirschen","Beerenmix mit Sauerkirschen",M,8,4,EST,2.49,750,["BEERENMIX MIT SAUERKIRSCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tafeltrauben_kernlos","Tafeltrauben kernlos",M,8,4,EST,2.49,500,["TAFELTRAUBEN KERNLOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_aepfel_braeburn_70_80_mm","Äpfel Braeburn 70/80 mm",M,8,4,EST,2.49,1000,["ÄPFEL BRAEBURN 70/80 MM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tafeltrauben","Tafeltrauben",M,8,4,EST,2.49,500,["TAFELTRAUBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_red_jonaprince_apfel","Red Jonaprince Apfel",M,8,4,EST,2.49,250,["RED JONAPRINCE APFEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_manzana","Manzana",M,8,4,EST,2.49,250,["MANZANA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_ananas_in_scheiben","Ananas in Scheiben",M,8,4,EST,2.49,340,["ANANAS IN SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_hella","Hella",M,8,4,EST,2.49,1500,["HELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_fruchtmark_apfel_mango","Fruchtmark Apfel-Mango",M,8,4,EST,2.49,360,["FRUCHTMARK APFEL-MANGO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_trauben_hell_kernlos","Trauben hell kernlos",M,8,4,EST,2.49,500,["TRAUBEN HELL KERNLOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_obst_ananas_dessertstuecke","Obst - Ananas Dessertstücke",M,8,4,EST,2.49,227,["OBST - ANANAS DESSERTSTÜCKE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_mangue","Mangue",M,8,4,EST,2.49,250,["MANGUE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_polpa_fine_tomatenfruchtfleisch_fein","Polpa fine - Tomatenfruchtfleisch fein",M,8,4,EST,2.49,400,["POLPA FINE - TOMATENFRUCHTFLEISCH FEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_pelati_geschaelte_tomaten","Pelati Geschälte Tomaten",M,8,4,EST,2.49,240,["PELATI GESCHÄLTE TOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_cherry_roma_tomaten","Cherry Roma Tomaten",M,8,4,EST,2.49,250,["CHERRY ROMA TOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_fruchtfleisch_basilikum","Tomaten Fruchtfleisch Basilikum",M,8,4,EST,2.49,250,["TOMATEN FRUCHTFLEISCH BASILIKUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_spreelinge","Spreelinge",M,8,4,EST,2.49,670,["SPREELINGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmertoepfchen_gew_gurken","Schlemmertöpfchen gew. Gurken",M,8,4,EST,2.49,530,["SCHLEMMERTÖPFCHEN GEW. GURKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_kirschtomaten_in_tomatensaft","Tomaten (Kirschtomaten) in Tomatensaft",M,8,4,EST,2.49,400,["TOMATEN (KIRSCHTOMATEN) IN TOMATENSAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_in_stuecken","Tomaten in Stücken",M,8,4,EST,2.49,250,["TOMATEN IN STÜCKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_rotkohl_nach_traditionsrezept","Rotkohl nach Traditionsrezept",M,8,4,EST,2.49,650,["ROTKOHL NACH TRADITIONSREZEPT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesepfanne_bio_mediterrane_art","Gemüsepfanne Bio Mediterrane Art",M,8,4,EST,2.49,600,["GEMÜSEPFANNE BIO MEDITERRANE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_rotkohl_mit_apfelstuecken","Rotkohl mit Apfelstücken",M,8,4,EST,2.49,370,["ROTKOHL MIT APFELSTÜCKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_mini_roma_tomaten","Mini Roma Tomaten",M,8,4,EST,2.49,250,["MINI ROMA TOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_remolacha_cocida_pelada","Remolacha cocida pelada",M,8,4,EST,2.49,450,["REMOLACHA COCIDA PELADA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_mini_pflaumen_tomaten","Mini-Pflaumen Tomaten",M,8,4,EST,2.49,500,["MINI-PFLAUMEN TOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_feinwuerzige_gurken_suess_sauer","Feinwürzige Gurken - süß-sauer",M,8,4,EST,2.49,530,["FEINWÜRZIGE GURKEN - SÜSS-SAUER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_geschaelte_tomaten_gehackt_in_tomatensaft","Geschälte Tomaten gehackt in Tomatensaft",M,8,4,EST,2.49,400,["GESCHÄLTE TOMATEN GEHACKT IN TOMATENSAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_cherry_romatomaten","Cherry-Romatomaten",M,8,4,EST,2.49,250,["CHERRY-ROMATOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_bio_cocktail_strauch_tomaten","Bio Cocktail Strauch Tomaten",M,8,4,EST,2.49,350,["BIO COCKTAIL STRAUCH TOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_schlemmer_toepfchen_chili_gurken","Schlemmer Töpfchen chili Gurken",M,8,4,EST,2.49,250,["SCHLEMMER TÖPFCHEN CHILI GURKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_gehackte_tomaten_in_tomatensaft","Gehackte Tomaten in Tomatensaft",M,8,4,EST,2.49,400,["GEHACKTE TOMATEN IN TOMATENSAFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_multicolor_salat_mit_wurzeln","Multicolor Salat mit Wurzeln",M,8,4,EST,2.49,160,["MULTICOLOR SALAT MIT WURZELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomatenfruchtfleisch_in_stuecken","Tomatenfruchtfleisch in Stücken",M,8,4,EST,2.49,500,["TOMATENFRUCHTFLEISCH IN STÜCKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_pfefferonen_mild_pikant","Pfefferonen mild-pikant",M,8,4,EST,2.49,500,["PFEFFERONEN MILD-PIKANT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_sahne_sauce","Tomaten-Sahne-Sauce",M,8,4,EST,2.49,250,["TOMATEN-SAHNE-SAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_ganze_tomaten_geschaelt","Ganze Tomaten Geschält",M,8,4,EST,2.49,240,["GANZE TOMATEN GESCHÄLT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_stueckig_mit_basilikum","Tomaten Stückig mit Basilikum",M,8,4,EST,2.49,400,["TOMATEN STÜCKIG MIT BASILIKUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_roma_rispentomaten_aromatica_klasse_1","ROMA RISPENTOMATEN AROMATICA, Klasse 1",M,8,4,EST,2.49,250,["ROMA RISPENTOMATEN AROMATICA, KLASSE 1"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_in_stuecken_tetrapack","Tomaten in Stücken Tetrapack",M,8,4,EST,2.49,390,["TOMATEN IN STÜCKEN TETRAPACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_geschaelt_kirschtomaten","Tomaten geschält Kirschtomaten",M,8,4,EST,2.49,400,["TOMATEN GESCHÄLT KIRSCHTOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_apfelrotkohl_kuehne","Apfelrotkohl Kühne",M,8,4,EST,2.49,700,["APFELROTKOHL KÜHNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_bio_speisemoehren","Bio-Speisemöhren",M,8,4,EST,2.49,1000,["BIO-SPEISEMÖHREN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_feurig_scharfe_jalapeno_in_scheiben","Feurig scharfe Jalapeño in Scheiben",M,8,4,EST,2.49,330,["FEURIG SCHARFE JALAPEÑO IN SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_mini_roma_rispentomaten","Mini-Roma-Rispentomaten",M,8,4,EST,2.49,300,["MINI-ROMA-RISPENTOMATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_stuecke_kraeuter_alnatura","Tomaten Stücke Kräuter Alnatura",M,8,4,EST,2.49,400,["TOMATEN STÜCKE KRÄUTER ALNATURA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_bio_rote_beete","Bio-Rote Beete",M,8,4,EST,2.49,330,["BIO-ROTE BEETE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}],
  ["off_champinon_blanco","Champiñón blanco",M,8,4,EST,2.49,433,["CHAMPIÑÓN BLANCO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Frischware-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["off_polpa_rustica_di_pomodoro","Polpa Rustica di Pomodoro",M,540,90,EST,2,690,["POLPA RUSTICA DI POMODORO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_feshona","Feshona",M,540,90,EST,2,250,["FESHONA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_ketchup_ohne_zuckerzusatz","Tomaten Ketchup ohne Zuckerzusatz",M,540,90,EST,2,435,["TOMATEN KETCHUP OHNE ZUCKERZUSATZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_junge_erbsen_extra_fein","Junge Erbsen extra fein",M,540,90,EST,2,280,["JUNGE ERBSEN EXTRA FEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tomato_al_gusto_kraeuter","Tomato al Gusto - Kräuter",M,540,90,EST,2,370,["TOMATO AL GUSTO - KRÄUTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_steirische_kaeferbohnen","Steirische Käferbohnen",M,540,90,EST,2,250,["STEIRISCHE KÄFERBOHNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_gruene_peperoni_gefuellt_mit_frischkaese","Grüne Peperoni gefüllt mit Frischkäse",M,540,90,EST,2,150,["GRÜNE PEPERONI GEFÜLLT MIT FRISCHKÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_girandole_torsades_n_34","Girandole Torsades N° 34",M,540,90,EST,2,500,["GIRANDOLE TORSADES N° 34"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_chow_mein_nudeln","Chow Mein Nudeln",M,540,90,EST,2,250,["CHOW MEIN NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_premium_tortellini_prosciuttto_crudo","Premium Tortellini Prosciuttto Crudo",M,540,90,EST,2,250,["PREMIUM TORTELLINI PROSCIUTTTO CRUDO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_lasagne_platten_n_189","Lasagne Platten n. 189",M,540,90,EST,2,500,["LASAGNE PLATTEN N. 189"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_maultaschen_traditionell_schwaebisch","Maultaschen traditionell schwäbisch",M,540,90,EST,2,360,["MAULTASCHEN TRADITIONELL SCHWÄBISCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bavette_n_13","Bavette N°13",M,540,90,EST,2,500,["BAVETTE N°13"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fettucine_n_166","Fettucine n.166",M,540,90,EST,2,500,["FETTUCINE N.166"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fusilli_aus_kichererbsen","Fusilli aus Kichererbsen",M,540,90,EST,2,250,["FUSILLI AUS KICHERERBSEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_nudeln_conchiglie_rigate_n_50","Nudeln Conchiglie Rigate n°50",M,540,90,EST,2,500,["NUDELN CONCHIGLIE RIGATE N°50"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fusilli_mit_hirse","Fusilli mit Hirse",M,540,90,EST,2,500,["FUSILLI MIT HIRSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glutenfrei_fusili","Glutenfrei Fusili",M,540,90,EST,2,500,["GLUTENFREI FUSILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fusilli_nudeln_aus_bio_hartweizengriess","Fusilli Nudeln aus Bio-Hartweizengrieß",M,540,90,EST,2,500,["FUSILLI NUDELN AUS BIO-HARTWEIZENGRIESS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_udon_noodles","Udon Noodles",M,540,90,EST,2,300,["UDON NOODLES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelini","Tortelini",M,540,90,EST,2,500,["TORTELINI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bami_goreng","Bami Goreng",M,540,90,EST,2,750,["BAMI GORENG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_cappelletti","Cappelletti",M,540,90,EST,2,250,["CAPPELLETTI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bio_penne_vollkorn_nudeln","Bio-Penne Vollkorn Nudeln",M,540,90,EST,2,500,["BIO-PENNE VOLLKORN NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortellini_ricotta_spinaci","Tortellini Ricotta & Spinaci",M,540,90,EST,2,250,["TORTELLINI RICOTTA & SPINACI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pappardelle_creme_spinaci","Pappardelle Crème Spinaci",M,540,90,EST,2,500,["PAPPARDELLE CRÈME SPINACI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_formagiana","Pasta Formagiana",M,540,90,EST,2,163,["PASTA FORMAGIANA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_spirelli_fusilli_nr_19","Spirelli Fusilli Nr. 19",M,540,90,EST,2,500,["SPIRELLI FUSILLI NR. 19"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_gruene_erbsen_penne","Grüne-Erbsen-Penne",M,540,90,EST,2,250,["GRÜNE-ERBSEN-PENNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_prosciutto","Tortelloni - Prosciutto",M,540,90,EST,2,250,["TORTELLONI - PROSCIUTTO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_vollkorn_spaghetti_no_3","Vollkorn Spaghetti No 3",M,540,90,EST,2,500,["VOLLKORN SPAGHETTI NO 3"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_5_minuten_spaghetti_bolognese","5 Minuten Spaghetti Bolognese",M,540,90,EST,2,60,["5 MINUTEN SPAGHETTI BOLOGNESE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_spinat_ricotta_tortelloni","Spinat-Ricotta Tortelloni",M,540,90,EST,2,250,["SPINAT-RICOTTA TORTELLONI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_fusilli_rote_linsen_nudeln","Pasta Fusilli Rote Linsen Nudeln",M,540,90,EST,2,300,["PASTA FUSILLI ROTE LINSEN NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_mit_spinat_ricotta","Tortelloni mit Spinat Ricotta",M,540,90,EST,2,400,["TORTELLONI MIT SPINAT RICOTTA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_ricotta_spinaci","Tortelloni - Ricotta & Spinaci",M,540,90,EST,2,250,["TORTELLONI - RICOTTA & SPINACI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_mit_ricotta_und_spinat_aus_eu","Tortelloni mit Ricotta und Spinat aus EU",M,540,90,EST,2,250,["TORTELLONI MIT RICOTTA UND SPINAT AUS EU"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_mini_penne_rigate_n_66","Mini Penne Rigate N° 66",M,540,90,EST,2,500,["MINI PENNE RIGATE N° 66"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_wok_nudeln_wellenband","Wok-Nudeln - Wellenband",M,540,90,EST,2,250,["WOK-NUDELN - WELLENBAND"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_funghi_porcini_steinpilze","Tortelloni Funghi Porcini Steinpilze",M,540,90,EST,2,250,["TORTELLONI FUNGHI PORCINI STEINPILZE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_linguine","Linguine",M,540,90,EST,2,500,["LINGUINE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fusilli_aus_100_dinkel","Fusilli aus 100% Dinkel",M,540,90,EST,2,500,["FUSILLI AUS 100% DINKEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_vollkorn_fusilli_aus_hartweizengriess","Vollkorn Fusilli aus Hartweizengrieß",M,540,90,EST,2,500,["VOLLKORN FUSILLI AUS HARTWEIZENGRIESS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_dinkel_vollkorn_locken_nudeln","Dinkel Vollkorn Locken Nudeln",M,540,90,EST,2,500,["DINKEL VOLLKORN LOCKEN NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fettucine","Fettucine",M,540,90,EST,2,250,["FETTUCINE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_vollkorn_penne_rigate","Vollkorn Penne rigate",M,540,90,EST,2,500,["VOLLKORN PENNE RIGATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_ricotta_epinards","Tortelloni ricotta épinards",M,540,90,EST,2,750,["TORTELLONI RICOTTA ÉPINARDS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_maultaschen_original_schwaebisch","Maultaschen original schwäbisch",M,540,90,EST,2,300,["MAULTASCHEN ORIGINAL SCHWÄBISCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_nudeln_tortiglioni_rigatoni","Nudeln Tortiglioni ( Rigatoni )",M,540,90,EST,2,500,["NUDELN TORTIGLIONI ( RIGATONI )"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelli_ricotta_tomate","Tortelli - Ricotta-Tomate",M,540,90,EST,2,300,["TORTELLI - RICOTTA-TOMATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_dinkel_tortelloni_ricotta_spinat","Dinkel Tortelloni Ricotta Spinat",M,540,90,EST,2,250,["DINKEL TORTELLONI RICOTTA SPINAT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_mie_noodle_dinkel","Mie-noodle Dinkel",M,540,90,EST,2,250,["MIE-NOODLE DINKEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tagliatelle_pilz_pfanne","Tagliatelle Pilz-Pfanne",M,540,90,EST,2,450,["TAGLIATELLE PILZ-PFANNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_soba_yakitori_chicken","Soba Yakitori Chicken",M,540,90,EST,2,89,["SOBA YAKITORI CHICKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortellini_kaese_sahne_vegetarisch","Tortellini Käse-Sahne (vegetarisch)",M,540,90,EST,2,500,["TORTELLINI KÄSE-SAHNE (VEGETARISCH)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_aus_100_linsen","Pasta aus 100% Linsen",M,540,90,EST,2,250,["PASTA AUS 100% LINSEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_ricotta_e_spinaci_maxi_pack","Tortelloni Ricotta e Spinaci Maxi-Pack",M,540,90,EST,2,500,["TORTELLONI RICOTTA E SPINACI MAXI-PACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortelloni_funghi_porcini_maxi_pack","Tortelloni Funghi Porcini Maxi-Pack",M,540,90,EST,2,500,["TORTELLONI FUNGHI PORCINI MAXI-PACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glutenfrei_pates_spaghetti_schaer","Glutenfrei Pâtes Spaghetti Schär",M,540,90,EST,2,500,["GLUTENFREI PÂTES SPAGHETTI SCHÄR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_piccolini_mini_farfalle","Piccolini Mini Farfalle",M,540,90,EST,2,500,["PICCOLINI MINI FARFALLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_vollkornspaghetti","Vollkornspaghetti",M,540,90,EST,2,275,["VOLLKORNSPAGHETTI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_nudeln_bandnudeln_rest","Nudeln - Bandnudeln rest",M,540,90,EST,2,500,["NUDELN - BANDNUDELN REST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_frischeier_schwaebische_spaetzle","Frischeier schwäbische Spätzle",M,540,90,EST,2,500,["FRISCHEIER SCHWÄBISCHE SPÄTZLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_integrale_eliche_vollkorn","Integrale Eliche Vollkorn",M,540,90,EST,2,500,["INTEGRALE ELICHE VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_nudeln_penne_rigate","Nudeln: Penne Rigate",M,540,90,EST,2,500,["NUDELN: PENNE RIGATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_penne_aus_maismehl","Penne aus Maismehl",M,540,90,EST,2,500,["PENNE AUS MAISMEHL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tortellini_prosciutto_crudo_maxi_pack","Tortellini Prosciutto Crudo Maxi-Pack",M,540,90,EST,2,500,["TORTELLINI PROSCIUTTO CRUDO MAXI-PACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_penne_no_66","Penne no 66",M,540,90,EST,2,500,["PENNE NO 66"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_ravioli_funghi_porcini_mit_steinpilzen","Ravioli Funghi Porcini mit Steinpilzen",M,540,90,EST,2,250,["RAVIOLI FUNGHI PORCINI MIT STEINPILZEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_penne_rigate_nudeln","Penne Rigate Nudeln",M,540,90,EST,2,500,["PENNE RIGATE NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_milchreis_high_protein_schoko","Milchreis High Protein Schoko",M,540,90,EST,2,180,["MILCHREIS HIGH PROTEIN SCHOKO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_langkorn_spitzenreis_im_kochbeutel","Langkorn Spitzenreis im Kochbeutel",M,540,90,EST,2,250,["LANGKORN SPITZENREIS IM KOCHBEUTEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_express_reis_mediterran","Express-Reis - Mediterran",M,540,90,EST,2,250,["EXPRESS-REIS - MEDITERRAN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_reis_jasmin_reis","Reis Jasmin Reis",M,540,90,EST,2,1000,["REIS JASMIN REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_himalaya_basmati_reis","Himalaya Basmati Reis",M,540,90,EST,2,1000,["HIMALAYA BASMATI REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_himalaya_basmati_vollkorn_reis","Himalaya Basmati Vollkorn Reis",M,540,90,EST,2,500,["HIMALAYA BASMATI VOLLKORN REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_express_basmati_reis_gedaempft","Express Basmati-Reis gedämpft",M,540,90,EST,2,250,["EXPRESS BASMATI-REIS GEDÄMPFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_express_reis_naturreis_vollkorn","Express-Reis - Naturreis Vollkorn",M,540,90,EST,2,220,["EXPRESS-REIS - NATURREIS VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bio_organic_langkon_reis","Bio Organic Langkon Reis",M,540,90,EST,2,250,["BIO ORGANIC LANGKON REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_reis_basmati_wildreis_im_glad","Reis, Basmati & Wildreis im Glad",M,540,90,EST,2,500,["REIS, BASMATI & WILDREIS IM GLAD"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_langkorn_reis_4x2_portionen_4x_je_125g","Langkorn Reis - 4x2 Portionen (4x je 125g)",M,540,90,EST,2,125,["LANGKORN REIS - 4X2 PORTIONEN (4X JE 125G)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_parboiled_spitzenreis_langkornreis","Parboiled Spitzenreis Langkornreis",M,540,90,EST,2,100,["PARBOILED SPITZENREIS LANGKORNREIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bon_ri_express_reis_parboiled_asiatische_art","BON-RI Express Reis Parboiled Asiatische Art",M,540,90,EST,2,250,["BON-RI EXPRESS REIS PARBOILED ASIATISCHE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_express_reis_langkorn_reis","Express-Reis - Langkorn-Reis",M,540,90,EST,2,250,["EXPRESS-REIS - LANGKORN-REIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_wild_rice_mix","Wild Rice Mix",M,540,90,EST,2,1000,["WILD RICE MIX"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_langkorn_reis_im_kochbeutel","Langkorn Reis im Kochbeutel",M,540,90,EST,2,1000,["LANGKORN REIS IM KOCHBEUTEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_express_reis_basmatireis","Express-Reis - Basmatireis",M,540,90,EST,2,250,["EXPRESS-REIS - BASMATIREIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_reis_papier_fuer_fruehlingsrollen","Reis Papier für Frühlingsrollen",M,540,90,EST,2,250,["REIS PAPIER FÜR FRÜHLINGSROLLEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bio_basmati_reis_braun","Bio Basmati Reis braun",M,540,90,EST,2,5000,["BIO BASMATI REIS BRAUN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_reis_naturreis_spitzen_langkorn","Reis Naturreis Spitzen-Langkorn",M,540,90,EST,2,250,["REIS NATURREIS SPITZEN-LANGKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_parboiled_langkorn_und_wildreis","Parboiled Langkorn- und Wildreis",M,540,90,EST,2,500,["PARBOILED LANGKORN- UND WILDREIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sonnenmais","Sonnenmais",M,540,90,EST,2,340,["SONNENMAIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_konserve_kidneybohnen","Konserve Kidneybohnen",M,540,90,EST,2,207,["KONSERVE KIDNEYBOHNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_rote_bete_in_scheiben","Rote Bete in Scheiben",M,540,90,EST,2,430,["ROTE BETE IN SCHEIBEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_zarte_filets_vom_hering_in_tomaten_creme","Zarte Filets vom Hering in Tomaten-Creme",M,540,90,EST,2,200,["ZARTE FILETS VOM HERING IN TOMATEN-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_beanz","Beanz",M,540,90,EST,2,415,["BEANZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_cucumber","Cucumber",M,540,90,EST,2,250,["CUCUMBER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_tomaten_creme","Heringsfilets Tomaten-Creme",M,540,90,EST,2,200,["HERINGSFILETS TOMATEN-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_goldmais","Goldmais",M,540,90,EST,2,330,["GOLDMAIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_fruehstuecksfleisch","Frühstücksfleisch",M,540,90,EST,2,250,["FRÜHSTÜCKSFLEISCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_erbsen_mit_moehrchen","Erbsen mit Möhrchen",M,540,90,EST,2,800,["ERBSEN MIT MÖHRCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sardinen_in_sonnenblumenoel_klassik","Sardinen in Sonnenblumenöl - Klassik",M,540,90,EST,2,125,["SARDINEN IN SONNENBLUMENÖL - KLASSIK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_chili_beans","Chili Beans",M,540,90,EST,2,420,["CHILI BEANS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilet_in_pfeffer_creme","Heringsfilet in Pfeffer-Creme",M,540,90,EST,2,200,["HERINGSFILET IN PFEFFER-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_balkan_sauce","Heringsfilets Balkan-Sauce",M,540,90,EST,2,200,["HERINGSFILETS BALKAN-SAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_spanische_gruene_oliven_mit_stein","Spanische grüne Oliven mit Stein",M,540,90,EST,2,600,["SPANISCHE GRÜNE OLIVEN MIT STEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_premium_cornichous","Premium Cornichous",M,540,90,EST,2,190,["PREMIUM CORNICHOUS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_frucht_cocktail_leicht_gezuckert","Frucht-Cocktail, leicht gezuckert",M,540,90,EST,2,820,["FRUCHT-COCKTAIL, LEICHT GEZUCKERT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bohnen_weisse_bohnen_in_tomatensauce","Bohnen - Weisse Bohnen in Tomatensauce",M,540,90,EST,2,250,["BOHNEN - WEISSE BOHNEN IN TOMATENSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_in_pfeffersauce","Heringsfilets in Pfeffersauce",M,540,90,EST,2,200,["HERINGSFILETS IN PFEFFERSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glas_gurken_cornichons_mit_chili","Glas Gurken Cornichons mit Chili",M,540,90,EST,2,190,["GLAS GURKEN CORNICHONS MIT CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_herring_fillets_tomate_pfeffer","Herring Fillets Tomate Pfeffer",M,540,90,EST,2,200,["HERRING FILLETS TOMATE PFEFFER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sardinen_in_sonnenblumenoel","Sardinen in Sonnenblumenöl",M,540,90,EST,2,90,["SARDINEN IN SONNENBLUMENÖL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_konserve_gurkensticks","Konserve Gurkensticks",M,540,90,EST,2,360,["KONSERVE GURKENSTICKS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glas_gurken_cornichons","Glas Gurken Cornichons",M,540,90,EST,2,670,["GLAS GURKEN CORNICHONS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_chili_sin_carne_vegan","Chili sin carne (vegan)",M,540,90,EST,2,400,["CHILI SIN CARNE (VEGAN)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_tomatensauce_geteilt","Heringsfilets - Tomatensauce, geteilt",M,540,90,EST,2,200,["HERINGSFILETS - TOMATENSAUCE, GETEILT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_beanz_in_tomatensauce","Beanz in Tomatensauce",M,540,90,EST,2,415,["BEANZ IN TOMATENSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_cornichons_mit_feiner_honignote","Cornichons mit feiner Honignote",M,540,90,EST,2,190,["CORNICHONS MIT FEINER HONIGNOTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_kichererbsen_eintopf","Kichererbsen Eintopf",M,540,90,EST,2,400,["KICHERERBSEN EINTOPF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_salz_dill_gurken","Salz-Dill Gurken",M,540,90,EST,2,650,["SALZ-DILL GURKEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_dill_kraeuter_creme","Heringsfilets Dill-Kräuter-Creme",M,540,90,EST,2,200,["HERINGSFILETS DILL-KRÄUTER-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_linseneintopf_vegan","Linseneintopf - vegan",M,540,90,EST,2,800,["LINSENEINTOPF - VEGAN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_paprika_geroestet_mild_suess_sauer","Paprika geröstet mild süß-sauer",M,540,90,EST,2,530,["PAPRIKA GERÖSTET MILD SÜSS-SAUER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_rote_kidney_bohnen","Rote Kidney-Bohnen",M,540,90,EST,2,255,["ROTE KIDNEY-BOHNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_gourmetplatte","Heringsfilets Gourmetplatte",M,540,90,EST,2,200,["HERINGSFILETS GOURMETPLATTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_knax_die_riesen","Knax - Die Riesen",M,540,90,EST,2,250,["KNAX - DIE RIESEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_red_kidney_bohnen","Red Kidney Bohnen",M,540,90,EST,2,230,["RED KIDNEY BOHNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sardines_a_l_huile_d_olive","Sardines à l’huile d’olive",M,540,90,EST,2,125,["SARDINES À L’HUILE D’OLIVE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_feinwuerzige_gurken_feurig_pikant","Feinwürzige Gurken - feurig-pikant",M,540,90,EST,2,530,["FEINWÜRZIGE GURKEN - FEURIG-PIKANT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glas_gurken_cornichons_chili","Glas Gurken Cornichons Chili",M,540,90,EST,2,350,["GLAS GURKEN CORNICHONS CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_delikatess_rote_bete_in_kugeln","Delikatess Rote Bete in Kugeln",M,540,90,EST,2,219,["DELIKATESS ROTE BETE IN KUGELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sardinen_in_sonnenblumenoel_mit_chili","Sardinen in Sonnenblumenöl mit Chili",M,540,90,EST,2,125,["SARDINEN IN SONNENBLUMENÖL MIT CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_getrocknete_tomaten_in_oel","Getrocknete Tomaten in Öl",M,540,90,EST,2,280,["GETROCKNETE TOMATEN IN ÖL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bio_goldmais","Bio Goldmais",M,540,90,EST,2,150,["BIO GOLDMAIS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilet_in_paprika_creme","Heringsfilet in Paprika-Creme",M,540,90,EST,2,200,["HERINGSFILET IN PAPRIKA-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_bio_sonnenmais_supersweet","Bio-Sonnenmais supersweet",M,540,90,EST,2,140,["BIO-SONNENMAIS SUPERSWEET"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_reiseintopf_mit_fleischbaellchen","Reiseintopf mit Fleischbällchen",M,540,90,EST,2,800,["REISEINTOPF MIT FLEISCHBÄLLCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heringsfilets_in_pfeffer_creme","Heringsfilets in Pfeffer-Creme",M,540,90,EST,2,200,["HERINGSFILETS IN PFEFFER-CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_gemuesemais_gross","Gemüsemais groß",M,540,90,EST,2,285,["GEMÜSEMAIS GROSS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_ravioli_mit_tomatensosse","Ravioli mit Tomatensoße",M,540,90,EST,2,800,["RAVIOLI MIT TOMATENSOSSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_erasco_reistopf_mit_fleischkloesschen","Erasco Reistopf mit Fleischklößchen",M,540,90,EST,2,250,["ERASCO REISTOPF MIT FLEISCHKLÖSSCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_champignons_ganze_koepfe","Champignons ganze Köpfe",M,540,90,EST,2,400,["CHAMPIGNONS GANZE KÖPFE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_daenischer_gurkensalat","Dänischer Gurkensalat",M,540,90,EST,2,670,["DÄNISCHER GURKENSALAT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_hering_in_pfeffer_creme","Hering in Pfeffer Creme",M,540,90,EST,2,200,["HERING IN PFEFFER CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_corned_beef","Corned Beef",M,540,90,EST,2,340,["CORNED BEEF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_linsen_mit_suppengruen","Linsen mit Suppengrün",M,540,90,EST,2,800,["LINSEN MIT SUPPENGRÜN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_knax_polnische_art","Knax Polnische Art",M,540,90,EST,2,670,["KNAX POLNISCHE ART"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_erbsen_und_karotten","Erbsen und Karotten",M,540,90,EST,2,340,["ERBSEN UND KAROTTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sjoerapport","Sjörapport",M,540,90,EST,2,85,["SJÖRAPPORT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_zarte_hertingsfilets_in_tomatensauce","Zarte Hertingsfilets in Tomatensauce",M,540,90,EST,2,200,["ZARTE HERTINGSFILETS IN TOMATENSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_zarte_filets_eier_senf","Zarte Filets Eier-Senf",M,540,90,EST,2,200,["ZARTE FILETS EIER-SENF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_brotzeit_gurken_suess_sauer","Brotzeit Gurken süß-sauer",M,540,90,EST,2,290,["BROTZEIT GURKEN SÜSS-SAUER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_rotebete_in_scheiben_suess_sauer_eingelegt","Rotebete in Scheiben süß-sauer eingelegt",M,540,90,EST,2,220,["ROTEBETE IN SCHEIBEN SÜSS-SAUER EINGELEGT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tomaten_ketchup_heinz","Tomaten Ketchup Heinz",M,540,90,EST,2,250,["TOMATEN KETCHUP HEINZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sweet_chilli_sauce_vitasia","Sweet Chilli sauce - Vitasia",M,540,90,EST,2,700,["SWEET CHILLI SAUCE - VITASIA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_tomatensauce_mit_basilikum","Tomatensauce mit Basilikum",M,540,90,EST,2,400,["TOMATENSAUCE MIT BASILIKUM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_maggi","Maggi",M,540,90,EST,2,202,["MAGGI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_aceto_balsamico_di_modena","Aceto Balsamico Di Modena",M,540,90,EST,2,500,["ACETO BALSAMICO DI MODENA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pesto_basilico_vegan","Pesto Basilico Vegan",M,540,90,EST,2,195,["PESTO BASILICO VEGAN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_glutenfreie_sojasauce_tamari","Glutenfreie Sojasauce (Tamari)",M,540,90,EST,2,250,["GLUTENFREIE SOJASAUCE (TAMARI)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_salz_alpen","Salz, Alpen",M,540,90,EST,2,500,["SALZ, ALPEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heinz_worcester_sauce","Heinz Worcester Sauce",M,540,90,EST,2,150,["HEINZ WORCESTER SAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_heinz_zero_tomaten_ketchup","Heinz Zero Tomaten Ketchup",M,540,90,EST,2,425,["HEINZ ZERO TOMATEN KETCHUP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_sauce_arrabbiata","Pasta Sauce Arrabbiata",M,540,90,EST,2,400,["PASTA SAUCE ARRABBIATA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  // "Alpen Jod Salz" (off_alpen_jod_salz) entfernt: reine Dublette zu
  // dieser Zeile, nur der Wortabstand unterschied sich ("Jod Salz" vs
  // "JodSalz") -- unsichtbar für die Dublettenprüfung beim Import
  // (die nur Satzzeichen normalisiert hat), sichtbar geworden erst
  // durch das neue Trennen zusammengeklebter Wörter.
  ["off_alpen_jodsalz","Alpen JodSalz",M,540,90,EST,2,250,["ALPEN JODSALZ"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_pesto_rustico_verdure_mediterrane","Pesto Rustico Verdure Mediterrane",M,540,90,EST,2,200,["PESTO RUSTICO VERDURE MEDITERRANE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_alpro_sojadessert_vanille_geschmack","Alpro Sojadessert, Vanille-Geschmack",M,540,90,EST,2,525,["ALPRO SOJADESSERT, VANILLE-GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_salz_jod_fluorid","Salz +Jod + Fluorid",M,540,90,EST,2,500,["SALZ +JOD + FLUORID"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_sauce_hollandaise","Sauce Hollandaise",M,540,90,EST,2,250,["SAUCE HOLLANDAISE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_dip_hot_cheese","Dip Hot Cheese",M,540,90,EST,2,250,["DIP HOT CHEESE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_red_curry_paste","Red Curry Paste",M,540,90,EST,2,250,["RED CURRY PASTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_burger_style_chipotle","Burger Style Chipotle",M,540,90,EST,2,235,["BURGER STYLE CHIPOTLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_passata_fein_passiert_natur","Passata Fein Passiert Natur",M,540,90,EST,2,660,["PASSATA FEIN PASSIERT NATUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_cassia_zimt_gemahlen","Cassia Zimt gemahlen",M,540,90,EST,2,40,["CASSIA ZIMT GEMAHLEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_loewensenf_extra_scharf","Löwensenf extra scharf",M,540,90,EST,2,250,["LÖWENSENF EXTRA SCHARF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_maggi_wuerze","Maggi Würze",M,540,90,EST,2,200,["MAGGI WÜRZE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_jodsalz_fein","Jodsalz fein",M,540,90,EST,2,500,["JODSALZ FEIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}],
  ["off_miracel","Miracel",M,540,90,EST,2,500,["MIRACEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Trocken/Vorrat-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Backwaren", "Backwaren", STORAGE.ROOM, [
  ["off_finn_crisp_original","Finn Crisp Original",M,4,3,EST,1,200,["FINN CRISP ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_roggenvollkornbrot","Roggenvollkornbrot",M,4,3,EST,1,500,["ROGGENVOLLKORNBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_das_pure_bio_haferbrot_mit_29_oelsaaten","Das Pure - Bio-Haferbrot mit 29% Ölsaaten",M,4,3,EST,1,300,["DAS PURE - BIO-HAFERBROT MIT 29% ÖLSAATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_dinkel_sandwich_4071800047812","Dinkel Sandwich 4071800047812",M,4,3,EST,1,375,["DINKEL SANDWICH 4071800047812"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_finn_crisp_multigrain","Finn Crisp | Multigrain",M,4,3,EST,1,175,["FINN CRISP | MULTIGRAIN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_eiweissreiches_weizenvollkornbrot","Eiweißreiches Weizenvollkornbrot",M,4,3,EST,1,500,["EIWEISSREICHES WEIZENVOLLKORNBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_brot_eiweiss_brot","Brot Eiweiß-Brot",M,4,3,EST,1,500,["BROT EIWEISS-BROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_sesam_volkorn_knaeckebrot","Sesam Volkorn-Knäckebrot",M,4,3,EST,1,250,["SESAM VOLKORN-KNÄCKEBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knaeckebrot_rustikal_vollkorn","Knäckebrot Rustikal, Vollkorn",M,4,3,EST,1,275,["KNÄCKEBROT RUSTIKAL, VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_pure_kornkraft_haferbrot","Pure Kornkraft Haferbrot",M,4,3,EST,1,400,["PURE KORNKRAFT HAFERBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_das_pure_haferbrot_mit_oelsaaten","Das Pure Haferbrot mit Ölsaaten",M,4,3,EST,1,400,["DAS PURE HAFERBROT MIT ÖLSAATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_brot_vital_fit","Brot Vital +Fit",M,4,3,EST,1,500,["BROT VITAL +FIT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_balance_brot","Balance Brot",M,4,3,EST,1,500,["BALANCE BROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_koerner_balance_sandwich","Körner Balance Sandwich",M,4,3,EST,1,750,["KÖRNER BALANCE SANDWICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knusperbrot_dunkel","Knusperbrot Dunkel",M,4,3,EST,1,125,["KNUSPERBROT DUNKEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_meisterbaeckers_vital_mit_sauerteig","Meisterbäckers Vital mit Sauerteig",M,4,3,EST,1,350,["MEISTERBÄCKERS VITAL MIT SAUERTEIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_das_pure_haferbrot_mit_27_oelsaaten","Das Pure - Haferbrot mit 27% Ölsaaten",M,4,3,EST,1,400,["DAS PURE - HAFERBROT MIT 27% ÖLSAATEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_protein_knaecke_kuerbiskern","Protein Knäcke Kürbiskern",M,4,3,EST,1,150,["PROTEIN KNÄCKE KÜRBISKERN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_fit_vital_brot","Fit & Vital Brot",M,4,3,EST,1,250,["FIT & VITAL BROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_hefebroetchen_glutenfrei","Hefebrötchen glutenfrei",M,4,3,EST,1,200,["HEFEBRÖTCHEN GLUTENFREI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knaeckebrot_roggen_dinkel","Knäckebrot Roggen & Dinkel",M,4,3,EST,1,250,["KNÄCKEBROT ROGGEN & DINKEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_sandwichtoast_saaten_harmonie","Sandwichtoast Saaten-Harmonie",M,4,3,EST,1,375,["SANDWICHTOAST SAATEN-HARMONIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_koerner_harmonie_sandwich","Körner-Harmonie Sandwich",M,4,3,EST,1,750,["KÖRNER-HARMONIE SANDWICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_american_style_sandwich_vollkorn","American Style Sandwich Vollkorn",M,4,3,EST,1,750,["AMERICAN STYLE SANDWICH VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_harry_1688_unser_mildes_weizenmischbrot","Harry 1688 Unser Mildes (Weizenmischbrot)",M,4,3,EST,1,500,["HARRY 1688 UNSER MILDES (WEIZENMISCHBROT)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knaeckebrot_sesamoel_und_seasalt","Knäckebrot Sesamöl und Seasalt",M,4,3,EST,1,15,["KNÄCKEBROT SESAMÖL UND SEASALT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_burger_buns","Burger buns",M,4,3,EST,1,250,["BURGER BUNS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_fitnessbrot","Fitnessbrot",M,4,3,EST,1,250,["FITNESSBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_dueruem","Dürüm",M,4,3,EST,1,800,["DÜRÜM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_sonneblumenvollkornbrot","Sonneblumenvollkornbrot",M,4,3,EST,1,500,["SONNEBLUMENVOLLKORNBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knaeckebrot_roggen_sauerteig","Knäckebrot - Roggen Sauerteig",M,4,3,EST,1,235,["KNÄCKEBROT - ROGGEN SAUERTEIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_dinkel_harmonie_sandwich","Dinkel-Harmonie Sandwich",M,4,3,EST,1,750,["DINKEL-HARMONIE SANDWICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_tasty_snacks_french_herbs_rounds","Tasty snacks french herbs rounds",M,4,3,EST,1,205,["TASTY SNACKS FRENCH HERBS ROUNDS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_finn_crisp_rustikal","Finn Crisp Rustikal",M,4,3,EST,1,200,["FINN CRISP RUSTIKAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_eiweissbrot","Eiweissbrot",M,4,3,EST,1,250,["EIWEISSBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_brot_dinkel_zwieback","Brot Dinkel Zwieback",M,4,3,EST,1,200,["BROT DINKEL ZWIEBACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_bauernmild_brot","Bauernmild Brot",M,4,3,EST,1,500,["BAUERNMILD BROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_knaeckebrot_milch_joghurt","Knäckebrot Milch & Joghurt",M,4,3,EST,1,230,["KNÄCKEBROT MILCH & JOGHURT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_eiweiss_toast_broetchen","Eiweiß-Toast Brötchen",M,4,3,EST,1,260,["EIWEISS-TOAST BRÖTCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_fit_vital_dinkel_vollkorn","Fit&Vital Dinkel Vollkorn",M,4,3,EST,1,400,["FIT&VITAL DINKEL VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_eiweissbrot_bio","Eiweißbrot Bio",M,4,3,EST,1,250,["EIWEISSBROT BIO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_bauernschnitten","Bauernschnitten",M,4,3,EST,1,500,["BAUERNSCHNITTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_xxl_burger_broetchen","XXL Burger Brötchen",M,4,3,EST,1,250,["XXL BURGER BRÖTCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_vollkornbrot_unser_pures","Vollkornbrot - Unser Pures",M,4,3,EST,1,300,["VOLLKORNBROT - UNSER PURES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_american_sandwich_super_soft","American Sandwich super soft",M,4,3,EST,1,750,["AMERICAN SANDWICH SUPER SOFT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_wasa","Wasa",M,4,3,EST,1,275,["WASA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_weizen_mais_torillas","Weizen-Mais-Torillas",M,4,3,EST,1,250,["WEIZEN-MAIS-TORILLAS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_bruschette_chips_mediterranean_vegetables","Bruschette Chips Mediterranean Vegetables",M,4,3,EST,1,150,["BRUSCHETTE CHIPS MEDITERRANEAN VEGETABLES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_super_soft_sandwich","Super Soft Sandwich",M,4,3,EST,1,250,["SUPER SOFT SANDWICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_golden_toast_high_protein_toast","Golden Toast high-protein Toast",M,4,3,EST,1,500,["GOLDEN TOAST HIGH-PROTEIN TOAST"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_weizen_tortillas_mit_leinsamen","Weizen Tortillas mit Leinsamen",M,4,3,EST,1,432,["WEIZEN TORTILLAS MIT LEINSAMEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_vollkorn_harmonie_sandwich","Vollkorn-Harmonie Sandwich",M,4,3,EST,1,750,["VOLLKORN-HARMONIE SANDWICH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_vollkornbrot_mit_sonnenblumenkernen","Vollkornbrot mit Sonnenblumenkernen",M,4,3,EST,1,500,["VOLLKORNBROT MIT SONNENBLUMENKERNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_vollkorn_mit_sonnenblumenkernen","Vollkorn mit Sonnenblumenkernen",M,4,3,EST,1,500,["VOLLKORN MIT SONNENBLUMENKERNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_roggen_vollkorn_knaeckebrot","Roggen Vollkorn-Knäckebrot",M,4,3,EST,1,250,["ROGGEN VOLLKORN-KNÄCKEBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_mehrkornschnitten","Mehrkornschnitten",M,4,3,EST,1,500,["MEHRKORNSCHNITTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_eiweissbrot_mit_walnuessen_250g_4000446011413","Eiweißbrot mit Walnüssen 250G 4000446011413",M,4,3,EST,1,250,["EIWEISSBROT MIT WALNÜSSEN 250G 4000446011413"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_bauernmildes_weizenmischbrot","Bauernmildes Weizenmischbrot",M,4,3,EST,1,500,["BAUERNMILDES WEIZENMISCHBROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_roggenvollkornbrot_mit_sonnenblumenkernen","Roggenvollkornbrot mit Sonnenblumenkernen",M,4,3,EST,1,500,["ROGGENVOLLKORNBROT MIT SONNENBLUMENKERNEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}],
  ["off_anno_1688_rustikal","Anno 1688 Rustikal",M,4,3,EST,1,500,["ANNO 1688 RUSTIKAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Backwaren-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Süßes/Snacks", "Süßwaren", STORAGE.PANTRY, [
  ["off_choco_brownie","Choco Brownie",M,270,14,EST,1.49,150,["CHOCO BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_mini_marzipan_butterstollen_konfekt_classic","Mini Marzipan Butterstollen Konfekt Classic",M,270,14,EST,1.49,350,["MINI MARZIPAN BUTTERSTOLLEN KONFEKT CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kuchen_mini_windbeutel_sahne","Kuchen Mini Windbeutel Sahne",M,270,14,EST,1.49,250,["KUCHEN MINI WINDBEUTEL SAHNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_pflanzliche_brownies","Pflanzliche Brownies",M,270,14,EST,1.49,480,["PFLANZLICHE BROWNIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_rollino_latte","Rollino Latte",M,270,14,EST,1.49,222,["ROLLINO LATTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_monte_snack","Monte Snack",M,270,14,EST,1.49,250,["MONTE SNACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_chocolate_brownie","Chocolate Brownie",M,270,14,EST,1.49,50,["CHOCOLATE BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_premium_protein_bar_dark_chocolate_fudge","Premium Protein Bar - Dark Chocolate Fudge",M,270,14,EST,1.49,45,["PREMIUM PROTEIN BAR - DARK CHOCOLATE FUDGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_rollino_cacao","Rollino Cacao",M,270,14,EST,1.49,37,["ROLLINO CACAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_tortencreme","Tortencreme",M,270,14,EST,1.49,140,["TORTENCREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_milka_schokoladen_haselnuss_torte","Milka Schokoladen & Haselnuss torte",M,270,14,EST,1.49,400,["MILKA SCHOKOLADEN & HASELNUSS TORTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_mandel_bienenstich_torte","Mandel-Bienenstich Torte",M,270,14,EST,1.49,360,["MANDEL-BIENENSTICH TORTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_dr_oetker_schokino_kuchen","Dr. Oetker Schokino Kuchen",M,270,14,EST,1.49,480,["DR. OETKER SCHOKINO KUCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_lust_auf_kuchen_hot_chocolate_brownie","Lust auf Kuchen - Hot Chocolate Brownie",M,270,14,EST,1.49,465,["LUST AUF KUCHEN - HOT CHOCOLATE BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_puk_s","Puk's",M,270,14,EST,1.49,62,["PUK'S"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_mini_donuts_kakao","Mini-Donuts - Kakao",M,270,14,EST,1.49,162,["MINI-DONUTS - KAKAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_cheesecake_lemon","Cheesecake Lemon",M,270,14,EST,1.49,70,["CHEESECAKE LEMON"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_mini_magdalenas_4042116810001","Mini-Magdalenas 4042116810001",M,270,14,EST,1.49,300,["MINI-MAGDALENAS 4042116810001"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kuchen_zitrone_kleine_kuchen","Kuchen - Zitrone Kleine Kuchen",M,270,14,EST,1.49,35,["KUCHEN - ZITRONE KLEINE KUCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kuchen_ruehrkuchenrolle_kakao","Kuchen - Rührkuchenrolle Kakao",M,270,14,EST,1.49,400,["KUCHEN - RÜHRKUCHENROLLE KAKAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_schwarzwaelder_kirschtorte","Schwarzwälder Kirschtorte",M,270,14,EST,1.49,750,["SCHWARZWÄLDER KIRSCHTORTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_4x_citrone","4x citrone",M,270,14,EST,1.49,35,["4X CITRONE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_bio_hafer_cookies","Bio Hafer Cookies",M,270,14,EST,1.49,200,["BIO HAFER COOKIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_knoppers","Knoppers",M,270,14,EST,1.49,25,["KNOPPERS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_prinzenrolle","Prinzenrolle",M,270,14,EST,1.49,250,["PRINZENROLLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_hanuta","Hanuta",M,270,14,EST,1.49,220,["HANUTA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_oreo_double_creme","Oreo Double Creme",M,270,14,EST,1.49,157,["OREO DOUBLE CREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kinder_tronky","Kinder Tronky",M,270,14,EST,1.49,90,["KINDER TRONKY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_hobbits_kernig","Hobbits kernig",M,270,14,EST,1.49,250,["HOBBITS KERNIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kinder_maxi_king","Kinder Maxi King",M,270,14,EST,1.49,105,["KINDER MAXI KING"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_captain_rondo_gout_vanille","Captain Rondo goût vanille",M,270,14,EST,1.49,500,["CAPTAIN RONDO GOÛT VANILLE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_balisto_yoberry","Balisto yoberry",M,270,14,EST,1.49,167,["BALISTO YOBERRY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_original_neapolitaner","Original Neapolitaner",M,270,14,EST,1.49,400,["ORIGINAL NEAPOLITANER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_buttergebaeck_schokolade_muerbegebaeck","Buttergebäck & Schokolade Mürbegebäck",M,270,14,EST,1.49,750,["BUTTERGEBÄCK & SCHOKOLADE MÜRBEGEBÄCK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_napolitaner","Napolitaner",M,270,14,EST,1.49,175,["NAPOLITANER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_leibniz_keks_kakao","Leibniz Keks - Kakao",M,270,14,EST,1.49,200,["LEIBNIZ KEKS - KAKAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_butterkeks_30_weniger_zucker","Butterkeks 30% weniger Zucker",M,270,14,EST,1.49,150,["BUTTERKEKS 30% WENIGER ZUCKER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_milka_schoko_keks","Milka Schoko & Keks",M,270,14,EST,1.49,300,["MILKA SCHOKO & KEKS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_choco_leibniz_edelherb","CHOCO LEIBNIZ EDELHERB",M,270,14,EST,1.49,125,["CHOCO LEIBNIZ EDELHERB"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_choco_chip_cookies","Choco Chip Cookies",M,270,14,EST,1.49,200,["CHOCO CHIP COOKIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_abbracci","Abbracci",M,270,14,EST,1.49,350,["ABBRACCI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_leibniz_keks","Leibniz Keks",M,270,14,EST,1.49,150,["LEIBNIZ KEKS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_giotto_haselnuss","GiOTTO HASELNUSS",M,270,14,EST,1.49,154,["GIOTTO HASELNUSS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_american_cookies_mit_chocolate_chips","American Cookies mit Chocolate Chips",M,270,14,EST,1.49,225,["AMERICAN COOKIES MIT CHOCOLATE CHIPS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_bio_hafercookies_mit_zartbitterschokolade","Bio-Hafercookies mit Zartbitterschokolade",M,270,14,EST,1.49,200,["BIO-HAFERCOOKIES MIT ZARTBITTERSCHOKOLADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_direktive_biscuits","Direktive Biscuits",M,270,14,EST,1.49,250,["DIREKTIVE BISCUITS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_pop_tarts_frosted_chocotastic","Pop Tarts Frosted Chocotastic",M,270,14,EST,1.49,8,["POP TARTS FROSTED CHOCOTASTIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_soft_cake_orange","Soft Cake Orange",M,270,14,EST,1.49,250,["SOFT CAKE ORANGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_gaufrettes_croustillantes","Gaufrettes croustillantes",M,270,14,EST,1.49,175,["GAUFRETTES CROUSTILLANTES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_leipniz_choco_cream","Leipniz Choco Cream",M,270,14,EST,1.49,228,["LEIPNIZ CHOCO CREAM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_golden_oreo","Golden Oreo",M,270,14,EST,1.49,154,["GOLDEN OREO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_milka_mmmax_strawberry_cheescake","Milka MMMAX Strawberry Cheescake",M,270,14,EST,1.49,250,["MILKA MMMAX STRAWBERRY CHEESCAKE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_kafferep_aveia","Kafferep (Aveia)",M,270,14,EST,1.49,600,["KAFFEREP (AVEIA)"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_doppelkeks_kakaocreme","Doppelkeks Kakaocreme",M,270,14,EST,1.49,500,["DOPPELKEKS KAKAOCREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_haferkeks","Haferkeks",M,270,14,EST,1.49,230,["HAFERKEKS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_pick_up_original","Pick up Original",M,270,14,EST,1.49,140,["PICK UP ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_manner_original","Manner original",M,270,14,EST,1.49,75,["MANNER ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_choco_sticks","Choco Sticks",M,270,14,EST,1.49,90,["CHOCO STICKS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_toggenburger","Toggenburger",M,270,14,EST,1.49,200,["TOGGENBURGER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_catago_gebaeckvariationen","Catago Gebäckvariationen",M,270,14,EST,1.49,500,["CATAGO GEBÄCKVARIATIONEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_mikado_milch_schokolade","Mikado Milch Schokolade",M,270,14,EST,1.49,75,["MIKADO MILCH SCHOKOLADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_nature_bakes","Nature Bakes",M,270,14,EST,1.49,150,["NATURE BAKES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_balisto_noisettes_raisins_x9","Balisto Noisettes Raisins x9",M,270,14,EST,1.49,167,["BALISTO NOISETTES RAISINS X9"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_pretzels_honey_mustard_onion","Pretzels Honey Mustard & Onion",M,270,14,EST,1.49,160,["PRETZELS HONEY MUSTARD & ONION"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_hafercookies_mit_zartbitterschokolade","Hafercookies mit Zartbitterschokolade",M,270,14,EST,1.49,200,["HAFERCOOKIES MIT ZARTBITTERSCHOKOLADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_cakes","Cakes",M,270,14,EST,1.49,200,["CAKES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_danish_butter_cookies","Danish Butter Cookies",M,270,14,EST,1.49,500,["DANISH BUTTER COOKIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_schoko_butterkeks_zartbitter","Schoko-Butterkeks - Zartbitter",M,270,14,EST,1.49,125,["SCHOKO-BUTTERKEKS - ZARTBITTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_abc_russisch_brot","ABC Russisch Brot",M,270,14,EST,1.49,100,["ABC RUSSISCH BROT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_milka_cookies_sensations_coeur_choco","Milka Cookies Sensations Coeur Choco",M,270,14,EST,1.49,156,["MILKA COOKIES SENSATIONS COEUR CHOCO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_schoko_keks_milchcreme","Schoko & Keks Milchcreme",M,270,14,EST,1.49,33,["SCHOKO & KEKS MILCHCREME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_frollini_integrali","Frollini Integrali",M,270,14,EST,1.49,400,["FROLLINI INTEGRALI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_balisto_korn_cereal","Balisto korn cereal",M,270,14,EST,1.49,250,["BALISTO KORN CEREAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_neo_original","Neo Original",M,270,14,EST,1.49,154,["NEO ORIGINAL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_manner_schnitten_vollkorn_beutel","Manner Schnitten Vollkorn Beutel",M,270,14,EST,1.49,300,["MANNER SCHNITTEN VOLLKORN BEUTEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_bio_hafer_cookie","Bio hafer cookie",M,270,14,EST,1.49,200,["BIO HAFER COOKIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_dinkel_doppelkeks_zartbitter","Dinkel Doppelkeks Zartbitter",M,270,14,EST,1.49,330,["DINKEL DOPPELKEKS ZARTBITTER"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_waffelmischung","Waffelmischung",M,270,14,EST,1.49,400,["WAFFELMISCHUNG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_nature_bakes_apfel_hafer_haselnuss","Nature Bakes Apfel, Hafer & Haselnuss",M,270,14,EST,1.49,150,["NATURE BAKES APFEL, HAFER & HASELNUSS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_pick_up","Pick up",M,270,14,EST,1.49,140,["PICK UP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_vitalgebaeck","Vitalgebäck",M,270,14,EST,1.49,200,["VITALGEBÄCK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_zuckerfrei_wiener_sandringe","Zuckerfrei Wiener Sandringe",M,270,14,EST,1.49,200,["ZUCKERFREI WIENER SANDRINGE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_leibniz_choco_vollkorn","Leibniz Choco Vollkorn",M,270,14,EST,1.49,125,["LEIBNIZ CHOCO VOLLKORN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_schoko_butterkeks_vollmilch","Schoko-Butterkeks - Vollmilch",M,270,14,EST,1.49,125,["SCHOKO-BUTTERKEKS - VOLLMILCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_cookies_griesson","Cookies Griesson",M,270,14,EST,1.49,150,["COOKIES GRIESSON"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_hafer_cookies","Hafer Cookies",M,270,14,EST,1.49,300,["HAFER COOKIES"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_gewuerzspekulatius","Gewürzspekulatius",M,270,14,EST,1.49,600,["GEWÜRZSPEKULATIUS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_hafer_cookies_mit_zartbitterschokolade","Hafer-Cookies mit Zartbitterschokolade",M,270,14,EST,1.49,200,["HAFER-COOKIES MIT ZARTBITTERSCHOKOLADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_knusprige_waffeln_mit_kakao","Knusprige Waffeln mit Kakao",M,270,14,EST,1.49,250,["KNUSPRIGE WAFFELN MIT KAKAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}],
  ["off_bio_hafercookies_mit_vollmilchschokolade","Bio-Hafercookies mit Vollmilchschokolade",M,270,14,EST,1.49,200,["BIO-HAFERCOOKIES MIT VOLLMILCHSCHOKOLADE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Süßes/Snacks-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Fertiggerichte", "Trockenware", STORAGE.PANTRY, [
  ["off_instant_nudeln_chicken_flavour","Instant Nudeln, Chicken Flavour",M,453,4,EST,2,60,["INSTANT NUDELN, CHICKEN FLAVOUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_beef","Beef",M,453,4,EST,2,60,["BEEF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_shin_ramyun_instant_nudeln_spicy","Shin Ramyun Instant Nudeln Spicy",M,453,4,EST,2,120,["SHIN RAMYUN INSTANT NUDELN SPICY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_soba_cup_noodles_teriyaki","Soba Cup Noodles Teriyaki",M,453,4,EST,2,90,["SOBA CUP NOODLES TERIYAKI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_instant_nudeln_duck_flavour","Instant Nudeln, Duck Flavour",M,453,4,EST,2,60,["INSTANT NUDELN, DUCK FLAVOUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_japanese_chicken_flavor","Japanese Chicken Flavor",M,453,4,EST,2,60,["JAPANESE CHICKEN FLAVOR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_miso_japanese_style_soup","Miso Japanese style soup",M,453,4,EST,2,250,["MISO JAPANESE STYLE SOUP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_asia_noodles_huhn_geschmack370g_port","Asia Noodles Huhn Geschmack370g/Port.",M,453,4,EST,2,250,["ASIA NOODLES HUHN GESCHMACK370G/PORT."],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_huehnersuppe","Hühnersuppe",M,453,4,EST,2,750,["HÜHNERSUPPE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_buchstaben_suppe","Buchstaben Suppe",M,453,4,EST,2,250,["BUCHSTABEN SUPPE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_roasted_duck_sweet_onion_soup","Roasted Duck Sweet Onion Soup",M,453,4,EST,2,65,["ROASTED DUCK SWEET ONION SOUP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_5_minuten_nudeln_in_rahmsauce","5 Minuten Nudeln in Rahmsauce",M,453,4,EST,2,61,["5 MINUTEN NUDELN IN RAHMSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_asia_noodles_chicken_mit_huehnerfleischaroma","Asia noodles chicken mit hühnerfleischaroma",M,453,4,EST,2,70,["ASIA NOODLES CHICKEN MIT HÜHNERFLEISCHAROMA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_instant_nudeln_chicken_sriracha_geschmack","Instant-Nudeln Chicken Sriracha Geschmack",M,453,4,EST,2,98,["INSTANT-NUDELN CHICKEN SRIRACHA GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_asia_noodle_cup_duck","Asia Noodle Cup Duck",M,453,4,EST,2,63,["ASIA NOODLE CUP DUCK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_vegetarischer_linsen_eintopf","Vegetarischer Linsen-Eintopf",M,453,4,EST,2,800,["VEGETARISCHER LINSEN-EINTOPF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_linsen_eintopf_mit_wuerstchen","Linsen-Eintopf mit Würstchen",M,453,4,EST,2,800,["LINSEN-EINTOPF MIT WÜRSTCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_huehner_nudel_topf","Hühner Nudel Topf",M,453,4,EST,2,800,["HÜHNER NUDEL TOPF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_erasco_linsen_eintopf_mit_essig","Erasco Linsen-Eintopf mit Essig",M,453,4,EST,2,250,["ERASCO LINSEN-EINTOPF MIT ESSIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_konserve_erbseneintopf","Konserve Erbseneintopf",M,453,4,EST,2,800,["KONSERVE ERBSENEINTOPF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_erbsen_eintopf_mit_wuerstchen","Erbsen-Eintopf mit Würstchen",M,453,4,EST,2,800,["ERBSEN-EINTOPF MIT WÜRSTCHEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_kichererbsen_mit_quinoa_gemuese","Kichererbsen mit Quinoa & Gemüse",M,453,4,EST,2,250,["KICHERERBSEN MIT QUINOA & GEMÜSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_vegetale","Ristorante Pizza Vegetale",M,453,4,EST,2,385,["RISTORANTE PIZZA VEGETALE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_mozzarella","Ristorante Pizza Mozzarella",M,453,4,EST,2,355,["RISTORANTE PIZZA MOZZARELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_tonno","Ristorante Pizza Tonno",M,453,4,EST,2,355,["RISTORANTE PIZZA TONNO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_speciale","Ristorante Pizza Speciale",M,453,4,EST,2,330,["RISTORANTE PIZZA SPECIALE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_mozzarella_steinofen","Pizza Mozzarella Steinofen",M,453,4,EST,2,250,["PIZZA MOZZARELLA STEINOFEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_die_backfrische_mozzarella","Pizza Die Backfrische Mozzarella",M,453,4,EST,2,350,["PIZZA DIE BACKFRISCHE MOZZARELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_funghi","Ristorante Pizza Funghi",M,453,4,EST,2,365,["RISTORANTE PIZZA FUNGHI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_protein_lovers_pizza","Protein Lovers Pizza",M,453,4,EST,2,435,["PROTEIN LOVERS PIZZA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_ristorante_pizza_spinaci","Ristorante Pizza Spinaci",M,453,4,EST,2,390,["RISTORANTE PIZZA SPINACI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_all_american_pizza_cheesy_spinach","All american Pizza Cheesy Spinach",M,453,4,EST,2,500,["ALL AMERICAN PIZZA CHEESY SPINACH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_ristorante_salame","Pizza Ristorante Salame",M,453,4,EST,2,320,["PIZZA RISTORANTE SALAME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_tonno_e_cipolla","Pizza Tonno E Cipolla",M,453,4,EST,2,475,["PIZZA TONNO E CIPOLLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_dr_oetker_ristorante_pizza_salame","Dr. Oetker Ristorante Pizza Salame",M,453,4,EST,2,320,["DR. OETKER RISTORANTE PIZZA SALAME"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_bastoncini_di_pesce","Pizza Bastoncini di Pesce",M,453,4,EST,2,555,["PIZZA BASTONCINI DI PESCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_salame_piccante","Pizza Salame Piccante",M,453,4,EST,2,475,["PIZZA SALAME PICCANTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_big_city_pizza_sydney","Big City Pizza Sydney",M,453,4,EST,2,425,["BIG CITY PIZZA SYDNEY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_speciale_extra_luftig","Pizza Speciale Extra Luftig",M,453,4,EST,2,355,["PIZZA SPECIALE EXTRA LUFTIG"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}],
  ["off_pizza_deliziosa_tonno","Pizza Deliziosa Tonno",M,453,4,EST,2,710,["PIZZA DELIZIOSA TONNO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Fertiggerichte-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("International", "Trockenware", STORAGE.PANTRY, [
  ["off_soba_classic","Soba classic",M,540,60,EST,2.49,90,["SOBA CLASSIC"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_buldak_hot_chicken_flavour_ramen_2x_spicy","Buldak Hot Chicken Flavour Ramen 2x spicy",M,540,60,EST,2.49,140,["BULDAK HOT CHICKEN FLAVOUR RAMEN 2X SPICY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_soba_chili_mit_yakisoba_sauce","Soba Chili mit Yakisoba-Sauce",M,540,60,EST,2.49,92,["SOBA CHILI MIT YAKISOBA-SAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_demae_ramen_spicy","Demae Ramen Spicy",M,540,60,EST,2.49,100,["DEMAE RAMEN SPICY"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_soba_wok_style_terriyaki","Soba Wok Style Terriyaki",M,540,60,EST,2.49,110,["SOBA WOK STYLE TERRIYAKI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_soba_chili","Soba Chili",M,540,60,EST,2.49,111,["SOBA CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_instantnudeln_demae_ramen_beef","Instantnudeln Demae Ramen Beef",M,540,60,EST,2.49,100,["INSTANTNUDELN DEMAE RAMEN BEEF"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_fix_magic_asia_gebratene_nudeln","Fix Magic Asia Gebratene Nudeln",M,540,60,EST,2.49,121,["FIX MAGIC ASIA GEBRATENE NUDELN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_saucy_noodles_sweet_chili","Saucy Noodles Sweet Chili",M,540,60,EST,2.49,75,["SAUCY NOODLES SWEET CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_snack_pot_kaese_sahne","Snack Pot Käse Sahne",M,540,60,EST,2.49,250,["SNACK POT KÄSE SAHNE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_pot_brokkoli_kaese","Pasta Pot - Brokkoli & Käse",M,540,60,EST,2.49,62,["PASTA POT - BROKKOLI & KÄSE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_express_reis_sweet_chili","Express-Reis - Sweet Chili",M,540,60,EST,2.49,220,["EXPRESS-REIS - SWEET CHILI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_oyakata_miso_ramen","Oyakata Miso Ramen",M,540,60,EST,2.49,89,["OYAKATA MISO RAMEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_noodle_snack","Noodle Snack",M,540,60,EST,2.49,250,["NOODLE SNACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_nudeln_in_tomaten_mozzarella_sauce","Nudeln In Tomaten-Mozzarella-Sauce",M,540,60,EST,2.49,100,["NUDELN IN TOMATEN-MOZZARELLA-SAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_instant_nudeln_mit_huehnerfleischgeschmack","Instant Nudeln mit Hühnerfleischgeschmack",M,540,60,EST,2.49,255,["INSTANT NUDELN MIT HÜHNERFLEISCHGESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_korean_ramen","Korean Ramen",M,540,60,EST,2.49,250,["KOREAN RAMEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_asia_noodles_chicken_taste","Asia Noodles - Chicken Taste",M,540,60,EST,2.49,65,["ASIA NOODLES - CHICKEN TASTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_gebratene_nudeln_ente","Gebratene Nudeln - Ente",M,540,60,EST,2.49,250,["GEBRATENE NUDELN - ENTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_instant_nudeln_huhn","Instant Nudeln, Huhn",M,540,60,EST,2.49,475,["INSTANT NUDELN, HUHN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_nudelsnack_ente","Nudelsnack Ente",M,540,60,EST,2.49,62,["NUDELSNACK ENTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_penne_mit_broccoli","Penne mit Broccoli",M,540,60,EST,2.49,146,["PENNE MIT BROCCOLI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_soba_thai","Soba Thai",M,540,60,EST,2.49,87,["SOBA THAI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_pasta_snack_pot_pilz_rahm","Pasta Snack Pot Pilz & Rahm",M,540,60,EST,2.49,250,["PASTA SNACK POT PILZ & RAHM"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_instant_nudel_shrimp","Instant-Nudel Shrimp",M,540,60,EST,2.49,250,["INSTANT-NUDEL SHRIMP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_nissin_yakisoba","Nissin Yakisoba",M,540,60,EST,2.49,100,["NISSIN YAKISOBA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_instant_reisnudeln_mit_huehnerfleischgeschmack","Instant-Reisnudeln mit Hühnerfleischgeschmack",M,540,60,EST,2.49,250,["INSTANT-REISNUDELN MIT HÜHNERFLEISCHGESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_5_minuten_spaghetti_in_tomatensauce","5-Minuten: Spaghetti in Tomatensauce",M,540,60,EST,2.49,250,["5-MINUTEN: SPAGHETTI IN TOMATENSAUCE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_asia_noodles_duck_taste","Asia Noodles - Duck Taste",M,540,60,EST,2.49,61,["ASIA NOODLES - DUCK TASTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_oyakata_chicken_ramen","Oyakata Chicken Ramen",M,540,60,EST,2.49,63,["OYAKATA CHICKEN RAMEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_tasty_noodles_sesame_chicken_taste","Tasty Noodles - Sesame-Chicken-Taste",M,540,60,EST,2.49,75,["TASTY NOODLES - SESAME-CHICKEN-TASTE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}],
  ["off_saucy_noodles_teriyaki","Saucy Noodles Teriyaki",M,540,60,EST,2.49,75,["SAUCY NOODLES TERIYAKI"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender International-Produkte), nicht einzeln geprüft."}]
]);


/* Aus Open Food Facts ergänzt (2026-08-20). Kategorie-Schätzwert, siehe Kommentar je Zeile. */
group("Protein/Sport", "Trockenware", STORAGE.FRIDGE_MIDDLE, [
  ["off_ironmaxx_protein_bar","IronMaxx Protein Bar",M,180,2,EST,1.19,45,["IRONMAXX PROTEIN BAR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_vegan_protein_bar_cookies_cream_geschmack","Vegan Protein Bar Cookies & Cream Geschmack",M,180,2,EST,1.19,40,["VEGAN PROTEIN BAR COOKIES & CREAM GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_bar_salty_peanut","Protein Bar Salty Peanut",M,180,2,EST,1.19,55,["PROTEIN BAR SALTY PEANUT"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_50_crispy_white_chocolate","Protein 50% Crispy-White-Chocolate",M,180,2,EST,1.19,45,["PROTEIN 50% CRISPY-WHITE-CHOCOLATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_60_caramell_toffee_crisp","Protein 60% caramell-toffee-crisp",M,180,2,EST,1.19,45,["PROTEIN 60% CARAMELL-TOFFEE-CRISP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_proteinriegel_50_crispy_stracciatella","Proteinriegel 50% • Crispy Stracciatella",M,180,2,EST,1.19,45,["PROTEINRIEGEL 50% • CRISPY STRACCIATELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_bar_stracciatella","Protein bar stracciatella",M,180,2,EST,1.19,45,["PROTEIN BAR STRACCIATELLA"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_magnesium_brausetabletten","Magnesium Brausetabletten",M,180,2,EST,1.19,250,["MAGNESIUM BRAUSETABLETTEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_proteinriegel_34_peanut_caramel_geschmack","Proteinriegel 34%, Peanut Caramel Geschmack",M,180,2,EST,1.19,40,["PROTEINRIEGEL 34%, PEANUT CARAMEL GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_whey_protein_vanille_geschmack","Whey Protein Vanille-Geschmack",M,180,2,EST,1.19,450,["WHEY PROTEIN VANILLE-GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_flohsamenschalen","Flohsamenschalen",M,180,2,EST,1.19,250,["FLOHSAMENSCHALEN"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_vegan_pur","Protein vegan pur",M,180,2,EST,1.19,300,["PROTEIN VEGAN PUR"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_bar_kokos","Protein Bar Kokos",M,180,2,EST,1.19,45,["PROTEIN BAR KOKOS"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_milchreis_high_protein_klassik","Milchreis High Protein Klassik",M,180,2,EST,1.19,180,["MILCHREIS HIGH PROTEIN KLASSIK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_vegan_protein_chocolate","Vegan Protein Chocolate",M,180,2,EST,1.19,600,["VEGAN PROTEIN CHOCOLATE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_vivede_magnesium_b_komplex_vitamin_c_und_e","Vivede Magnesium + B Komplex, Vitamin C und E",M,180,2,EST,1.19,102,["VIVEDE MAGNESIUM + B KOMPLEX, VITAMIN C UND E"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_this_is_food_hazelnut_chocolate_riegel","This is Food - Hazelnut Chocolate Riegel",M,180,2,EST,1.19,60,["THIS IS FOOD - HAZELNUT CHOCOLATE RIEGEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_natural_protein_salty_peanut_crunch","Natural Protein Salty Peanut Crunch",M,180,2,EST,1.19,40,["NATURAL PROTEIN SALTY PEANUT CRUNCH"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_vitamin_c_zink_selen_und_vitamin_d3","Vitamin C + Zink, Selen, und Vitamin D3",M,180,2,EST,1.19,102,["VITAMIN C + ZINK, SELEN, UND VITAMIN D3"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_50_protein_cookie_dough_geschmack","50% Protein Cookie Dough Geschmack",M,180,2,EST,1.19,50,["50% PROTEIN COOKIE DOUGH GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_crispy_protein_bar_crunchy_brownie","Crispy Protein Bar crunchy brownie",M,180,2,EST,1.19,45,["CRISPY PROTEIN BAR CRUNCHY BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_salted_caramel","Protein Salted Caramel",M,180,2,EST,1.19,45,["PROTEIN SALTED CARAMEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_proteinriegel_50_white_chocolate_crisp","Proteinriegel 50 % - White Chocolate Crisp",M,180,2,EST,1.19,45,["PROTEINRIEGEL 50 % - WHITE CHOCOLATE CRISP"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_100_whey_protein_vanillegeschmack","100 % Whey Protein Vanillegeschmack",M,180,2,EST,1.19,420,["100 % WHEY PROTEIN VANILLEGESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_barretta_proteica_fragola_e_cacao","Barretta proteica Fragola e Cacao",M,180,2,EST,1.19,45,["BARRETTA PROTEICA FRAGOLA E CACAO"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_protein_big_block","Protein Big Block",M,180,2,EST,1.19,100,["PROTEIN BIG BLOCK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_designer_whey_protein_vanilla_milk","Designer Whey Protein Vanilla Milk",M,180,2,EST,1.19,420,["DESIGNER WHEY PROTEIN VANILLA MILK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_designer_bar_fudge_brownie","Designer Bar • Fudge Brownie",M,180,2,EST,1.19,45,["DESIGNER BAR • FUDGE BROWNIE"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_slim_shake_vanille_sahne_geschmack","Slim Shake Vanille-Sahne Geschmack",M,180,2,EST,1.19,250,["SLIM SHAKE VANILLE-SAHNE GESCHMACK"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}],
  ["off_filled_proteinriegel_peanut_caramel","Filled Proteinriegel - Peanut-Caramel",M,180,2,EST,1.19,45,["FILLED PROTEINRIEGEL - PEANUT-CARAMEL"],{note:"Aus Open Food Facts übernommen, Haltbarkeit ist ein Kategorie-Schätzwert (Median bestehender Protein/Sport-Produkte), nicht einzeln geprüft."}]
]);

/* ==================================================================
   Einzeln recherchierte Bon-Fundstücke (2026-08-20)
   ------------------------------------------------------------------
   Anders als der Open-Food-Facts-Massenimport oben: jedes dieser 15
   Produkte wurde EINZELN über eine echte Websuche identifiziert, weil
   es als kryptische Bon-Zeile in test/matching.js keinen Treffer
   erzielte (Ziel: Trefferquote Richtung 99 %). Haltbarkeit bleibt
   trotzdem ein Kategorie-Schätzwert, angelehnt an vergleichbare
   Katalogeinträge derselben Kategorie — auch eine bestätigte
   Markenidentität ersetzt keine amtliche Haltbarkeitsquelle.
   ================================================================== */
group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["picco_belli_mini_pizza","Picco Belli Mini-Pizza",M,270,3,EST,2.49,360,["PICCO BELLI MINI PIZZEN"]],
  ["asc_frost_linguine_garnelen","Linguine mit Garnelen (ASC)",M,365,3,EST,3.49,450,["ASCFROSTLINGU.M.GARN.450G"]],
  // Bestätigt per Websuche: "Schofrulade" ist ein echter, exakt so
  // heißender Markenname (gefrorene Himbeeren in Vollmilchschokolade),
  // keine Verschreibung.
  ["schofrulade_himbeer","Schofrulade Himbeer",M,270,3,EST,2.29,130,["SCHOFRULADEHIMBVOLLM.130G"]]
]);

group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["booster_energy_juneberry","Booster Energy Drink Juneberry",M,365,3,EST,0.85,330,["BOOSTER JUNEBERRY 0,33L DS"]],
  ["active_o2_cherry","Active O2 Cherry",M,365,3,EST,1.29,750,["ACTIVE O2 CHERRY 1X0,75L FL"]],
  ["the_real_strawberry_kiwi","The Real Strawberry-Kiwi",M,270,3,EST,0.89,330,["THEREALSTRAWBKIW0,33L DS"]],
  ["naturalis_beerenmix","Naturalis Fruchtsaftgetränk Beeren-Mix",M,270,3,EST,0.75,500,["NATU+FRBEERMIXEW1X0,5LFL"]],
  ["captains_tea_pfirsich_zero","Captains Tea Eistee Pfirsich Zero",M,270,3,EST,0.65,500,["CAPT.TEAPFIZEROEW1X0,5LFL"]],
  ["caffreddo","Caffreddo Latte",M,25,2,EST,1.19,250,["CAFFREDDO"],{storage:STORAGE.FRIDGE_MIDDLE}]
]);

group("Protein/Sport", "Trockenware", STORAGE.PANTRY, [
  ["holy_energy_starterset","HOLY Energy Starter-Set",M,365,30,EST,9.99,100,["HOLY EN.STARTERSETSORT.ST"]],
  ["prolife_magnesium_sticks","ProLife Magnesium-Sticks",M,540,90,EST,1.99,30,["PROLIFEMAGN.ST.20X1,5G30G"]]
]);

group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["albgold_dunkelnudeln","Alb-Gold Dunkelnudeln",M,730,120,EST,1.99,500,["ALBH.DUNKELNUD.SORT.500G"]]
]);

group("Milchprodukte", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["finello_hp_mozzarella","Finello High Protein Mozzarella",M,21,3,EST,1.49,150,["FINELLO HIGH PROTEIN 150G"]]
]);

group("Wurstwaren", "Kühlregal", STORAGE.FRIDGE_MIDDLE, [
  ["stickado","Stickado Salami-Sticks",M,60,5,EST,1.79,70,["STICKADO"]]
]);

group("Körperpflege", "Drogerie", STORAGE.NONE, [
  ["shisara_tuchmaske_hydro","Shisara Tuchmaske Hydro",N,1095,null,EST,0.79,8,["SHISARA TUCHMASKEHYDRO ST"]]
], { isFood: false, freezable: false });

group("Waschen & Reinigen", "Drogerie", STORAGE.NONE, [
  ["domestos_wc_gel_floral","Domestos WC-Gel Floral",N,1095,null,EST,2.29,750,["DOMESTOSWCGEL FLORAL750ML"]]
], { isFood: false, freezable: false });

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
