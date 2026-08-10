/* Gebündelt aus 26 Modulen — nicht von Hand ändern.
   Quelle: src/algo/*.js. Neu bauen mit: npm run build */

/* ===== foodDatabase.js ===== */
/**
 * foodDatabase.js — v3, stark erweitert
 * ================================================================
 * Rund 320 Produkte des deutschen Supermarkt-Sortiments.
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

const FOOD_DATABASE = [];

function group(category, aisle, storage, rows, groupOpts = {}) {
  rows.forEach((r) => {
    const [id, name, dateType, su, so, quality, price, weightG, aliases = [], opts = {}] = r;
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
      note: opts.note || null
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
  ["hackfleisch","Hackfleisch gemischt",V,1,1,REG,4.99,500,["HACKFLEISCH","GEMISCHTES HACK","METT"],{note:"BZfE nennt Hackfleisch ausdrücklich als Verbrauchsdatum-Produkt."}],
  ["hack_rind","Rinderhackfleisch",V,1,1,REG,5.99,500,["RINDERHACK","HACKFLEISCH RIND"]],
  ["haehnchen","Hähnchenbrust",V,2,1,REG,6.99,400,["HAEHNCHENBRUST","HÄHNCHENBRUSTFILET","GEFLUEGEL BRUST","HAEHNCHENFILET"],{note:"Geflügel laut BZfE Verbrauchsdatum-Produkt."}],
  ["haehnchen_schenkel","Hähnchenschenkel",V,2,1,REG,3.99,600,["HAEHNCHENSCHENKEL","HAEHNCHENKEULE"]],
  ["putenbrust","Putenbrust",V,2,1,REG,7.49,400,["PUTENBRUST","PUTENSCHNITZEL"]],
  ["schweineschnitzel","Schweineschnitzel",V,3,1,REG,5.49,500,["SCHNITZEL","SCHWEINESCHNITZEL"]],
  ["schweinefilet","Schweinefilet",V,3,1,REG,7.99,400,["SCHWEINEFILET"]],
  ["rindersteak","Rindersteak",V,3,1,REG,9.99,300,["RUMPSTEAK","RINDERSTEAK","ENTRECOTE"]],
  ["gulasch","Gulasch",V,2,1,REG,6.49,500,["GULASCH","GULASCHFLEISCH"]],
  ["bratwurst","Bratwurst",V,3,1,REG,3.49,400,["BRATWURST","ROSTBRATWURST","NUERNBERGER"]],
  ["fisch_lachs","Lachsfilet",V,1,1,REG,8.99,250,["LACHSFILET","LACHS"],{note:"Roher Fisch laut BZfE Verbrauchsdatum-Produkt."}],
  ["fisch_weiss","Weißfischfilet",V,1,1,REG,6.99,300,["SEELACHS","KABELJAU","FISCHFILET","PANGASIUS"]],
  ["garnelen","Garnelen",V,1,1,REG,5.99,200,["GARNELEN","SHRIMPS"]],
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
  ["pflaumen","Pflaumen",M,7,4,LEIT,2.49,500,["PFLAUMEN","ZWETSCHGEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["pfirsiche","Pfirsiche",M,6,3,LEIT,2.99,500,["PFIRSICHE","NEKTARINEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["aprikosen","Aprikosen",M,6,3,LEIT,2.99,500,["APRIKOSEN","MARILLEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["orangen","Orangen",M,18,7,LEIT,2.49,1000,["ORANGEN","APFELSINEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["mandarinen","Mandarinen",M,14,7,LEIT,2.29,1000,["MANDARINEN","CLEMENTINEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["zitronen","Zitronen",M,21,7,LEIT,1.29,500,["ZITRONEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["limetten","Limetten",M,18,7,LEIT,1.49,300,["LIMETTEN"],{ethylene:ETHYLENE.SENSITIVE}],
  ["kiwi","Kiwi",M,12,5,LEIT,1.99,500,["KIWI"],{ethylene:ETHYLENE.PRODUCER}],
  ["ananas","Ananas",M,7,3,LEIT,2.49,1200,["ANANAS"],{ethylene:ETHYLENE.SENSITIVE}],
  ["melone","Melone",M,7,3,LEIT,3.49,2000,["WASSERMELONE","HONIGMELONE","MELONE"],{ethylene:ETHYLENE.PRODUCER}],
  ["mango","Mango",M,7,3,LEIT,1.99,400,["MANGO"],{ethylene:ETHYLENE.PRODUCER}],
  ["granatapfel","Granatapfel",M,21,5,LEIT,2.49,400,["GRANATAPFEL"],{ethylene:ETHYLENE.SENSITIVE}],
  ["feigen","Feigen",M,5,3,LEIT,3.49,300,["FEIGEN"],{ethylene:ETHYLENE.PRODUCER}],
  ["obst_geschnitten","Obst, geschnitten",V,1,1,REG,2.99,300,["OBSTSALAT","MELONE GESCHNITTEN","ANANAS GESCHNITTEN"],{freezable:false,note:"Kleingeschnittenes Obst laut BZfE Verbrauchsdatum-Produkt."}]
]);

// ===================== OBST/GEMÜSE (Zimmertemperatur) ============
group("Frischware", "Obst & Gemüse", STORAGE.ROOM, [
  ["bananen","Bananen",M,7,3,LEIT,1.79,1000,["BANANEN"],{ethylene:ETHYLENE.PRODUCER,note:"Starker Ethylenproduzent — getrennt lagern."}],
  ["avocado","Avocado",M,6,1,LEIT,1.79,200,["AVOCADO"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: im Zimmer reifen, danach Kühlschrank."}],
  ["tomaten","Tomaten",M,7,3,LEIT,2.49,500,["TOMATEN","RISPENTOMATEN","CHERRYTOMATEN","STRAUCHTOMATEN"],{ethylene:ETHYLENE.PRODUCER,note:"BZfE: Zimmertemperatur, nicht Kühlschrank."}],
  ["gurke","Salatgurke",M,7,3,LEIT,0.99,400,["SALATGURKE","GURKE"],{ethylene:ETHYLENE.SENSITIVE,freezable:false}],
  ["paprika","Paprika",M,8,4,LEIT,2.29,500,["PAPRIKA","PAPRIKA ROT","SPITZPAPRIKA"],{ethylene:ETHYLENE.SENSITIVE}],
  ["zucchini","Zucchini",M,8,4,LEIT,1.49,400,["ZUCCHINI"],{ethylene:ETHYLENE.SENSITIVE}],
  ["aubergine","Aubergine",M,7,4,LEIT,1.49,400,["AUBERGINE","MELANZANI"],{ethylene:ETHYLENE.SENSITIVE}],
  ["knoblauch","Knoblauch",M,60,21,LEIT,0.99,100,["KNOBLAUCH"]],
  ["ingwer","Ingwer",M,21,10,LEIT,1.29,100,["INGWER"]],
  ["basilikum","Basilikum",M,7,4,LEIT,1.49,50,["BASILIKUM","BASILIKUM TOPF"],{freezable:false,note:"BZfE führt Basilikum ausdrücklich als Kräuter-Ausnahme: nicht kühlen."}],
  ["kuerbis","Kürbis",M,30,5,LEIT,2.49,1500,["KUERBIS","HOKKAIDO","BUTTERNUT"]]
]);

group("Frischware", "Obst & Gemüse", STORAGE.PANTRY, [
  ["kartoffeln","Kartoffeln",M,60,21,LEIT,2.99,2000,["KARTOFFELN","SPEISEKARTOFFELN","DRILLINGE"],{note:"BZfE: kühl und dunkel, nicht Kühlschrank."}],
  ["suesskartoffel","Süßkartoffeln",M,30,10,LEIT,2.99,1000,["SUESSKARTOFFELN"]],
  ["zwiebeln","Zwiebeln",M,45,14,LEIT,1.49,1000,["ZWIEBELN","SPEISEZWIEBELN","GEMUESEZWIEBEL"]],
  ["schalotten","Schalotten",M,40,14,LEIT,1.99,250,["SCHALOTTEN"]],
  ["rotezwiebeln","Rote Zwiebeln",M,45,14,LEIT,1.69,500,["ROTE ZWIEBELN"]]
]);

// ===================== GEMÜSE (Gemüsefach) ======================
group("Frischware", "Obst & Gemüse", STORAGE.FRIDGE_VEG, [
  ["salat_kopf","Kopfsalat",M,5,2,LEIT,1.39,400,["KOPFSALAT","SALAT KOPF","EISBERGSALAT","EISBERG"],{freezable:false,note:"BZfE: Gemüsefach, in Behälter oder feuchtem Tuch."}],
  ["salat_geschnitten","Salatmischung, geschnitten",V,2,1,REG,1.29,150,["SALATMISCHUNG","BLATTSALAT GESCHNITTEN","FELDSALAT BEUTEL","ROHKOSTSALAT"],{freezable:false,note:"Vorgeschnittene Salate laut BZfE Verbrauchsdatum-Produkt."}],
  ["feldsalat","Feldsalat",M,4,2,LEIT,1.99,150,["FELDSALAT","RAPUNZEL"],{freezable:false}],
  ["rucola","Rucola",M,4,2,LEIT,1.49,125,["RUCOLA","RAUKE"],{freezable:false}],
  ["moehren","Möhren",M,21,10,LEIT,1.29,1000,["MOEHREN","KAROTTEN","MÖHREN"],{note:"BZfE: aus dem Folienbeutel nehmen, Grün abschneiden."}],
  ["brokkoli","Brokkoli",M,6,3,LEIT,1.79,500,["BROKKOLI"]],
  ["blumenkohl","Blumenkohl",M,7,3,LEIT,1.99,800,["BLUMENKOHL"]],
  ["champignons","Champignons",M,5,3,LEIT,1.69,250,["CHAMPIGNONS","PILZE","EGERLINGE"]],
  ["lauch","Lauch",M,10,5,LEIT,1.29,400,["LAUCH","PORREE"]],
  ["spinat_frisch","Blattspinat frisch",M,3,2,LEIT,1.99,300,["BLATTSPINAT","SPINAT FRISCH","BABYSPINAT"]],
  ["kraeuter","Frische Kräuter",M,5,3,LEIT,1.49,30,["PETERSILIE","SCHNITTLAUCH","KRAEUTER","DILL","KORIANDER"],{note:"BZfE: Kräuter ins Gemüsefach — ausgenommen Basilikum."}],
  ["sellerie","Sellerie",M,14,7,LEIT,1.49,500,["SELLERIE","STAUDENSELLERIE","KNOLLENSELLERIE"]],
  ["kohlrabi","Kohlrabi",M,10,5,LEIT,0.99,400,["KOHLRABI"]],
  ["weisskohl","Weißkohl",M,21,10,LEIT,1.29,1000,["WEISSKOHL","SPITZKOHL"]],
  ["rotkohl","Rotkohl",M,21,10,LEIT,1.49,1000,["ROTKOHL","BLAUKRAUT"]],
  ["wirsing","Wirsing",M,12,6,LEIT,1.49,800,["WIRSING"]],
  ["rosenkohl","Rosenkohl",M,8,4,LEIT,2.29,500,["ROSENKOHL"]],
  ["chicoree","Chicorée",M,8,4,LEIT,1.49,300,["CHICOREE"]],
  ["radieschen","Radieschen",M,7,4,LEIT,0.99,200,["RADIESCHEN"],{note:"BZfE: Grün vorher abschneiden."}],
  ["rote_bete","Rote Bete",M,21,10,LEIT,1.49,500,["ROTE BETE","ROTE RUEBEN"]],
  ["bohnen_gruen","Grüne Bohnen",M,6,3,LEIT,2.49,500,["GRUENE BOHNEN","BUSCHBOHNEN"]],
  ["zuckerschoten","Zuckerschoten",M,5,3,LEIT,2.99,200,["ZUCKERSCHOTEN","ZUCKERERBSEN"]],
  ["spargel","Spargel",M,4,2,LEIT,5.99,500,["SPARGEL","BLEICHSPARGEL","GRUENER SPARGEL"]],
  ["fenchel","Fenchel",M,8,4,LEIT,1.99,400,["FENCHEL"]],
  ["mangold","Mangold",M,5,3,LEIT,1.99,400,["MANGOLD"]],
  ["pastinaken","Pastinaken",M,18,8,LEIT,1.99,500,["PASTINAKEN"]],
  ["lauchzwiebeln","Frühlingszwiebeln",M,7,4,LEIT,0.89,150,["FRUEHLINGSZWIEBELN","LAUCHZWIEBELN"]],
  ["kresse","Kresse",M,5,3,LEIT,0.99,50,["KRESSE"],{freezable:false}],
  ["sprossen","Sprossen",V,3,1,REG,1.49,100,["SPROSSEN","MUNGBOHNENSPROSSEN"],{freezable:false}]
]);

// ===================== BACKWAREN =================================
group("Backwaren", "Backwaren", STORAGE.ROOM, [
  ["brot_vollkorn","Vollkornbrot",M,6,5,LEIT,2.49,750,["VOLLKORNBROT","BROT VOLLKORN"],{note:"BZfE: Brot trocknet im Kühlschrank aus — nicht kühlen."}],
  ["brot_mischbrot","Mischbrot",M,5,4,EST,2.29,750,["MISCHBROT","ROGGENMISCHBROT","BAUERNBROT","LANDBROT"]],
  ["brot_roggen","Roggenbrot",M,7,6,EST,2.49,750,["ROGGENBROT","SCHWARZBROT","PUMPERNICKEL"]],
  ["brot_weiss","Weißbrot",M,4,3,EST,1.99,500,["WEISSBROT","BAGUETTE","CIABATTA"]],
  ["toastbrot","Toastbrot",M,10,7,EST,1.29,500,["TOASTBROT","TOAST","SANDWICHTOAST"]],
  ["broetchen","Brötchen",M,2,1,EST,0.45,60,["BROETCHEN","BRÖTCHEN","SEMMEL","SCHRIPPE"]],
  ["laugengebaeck","Laugengebäck",M,2,1,EST,0.89,80,["BREZEL","LAUGENSTANGE","LAUGENBROETCHEN"]],
  ["croissant","Croissant",M,3,2,EST,0.99,70,["CROISSANT","BUTTERCROISSANT"]],
  ["knaeckebrot","Knäckebrot",M,270,60,EST,1.49,250,["KNAECKEBROT"],{storage:STORAGE.PANTRY}],
  ["zwieback","Zwieback",M,270,30,EST,1.19,225,["ZWIEBACK"],{storage:STORAGE.PANTRY}],
  ["kuchen","Kuchen",M,4,3,EST,3.99,500,["KUCHEN","OBSTKUCHEN","MARMORKUCHEN"]],
  ["wraps","Wraps",M,60,7,EST,1.49,370,["WRAPS","TORTILLAS","FLADENBROT"]]
]);

// ===================== TROCKEN & VORRAT ==========================
group("Trocken/Vorrat", "Trockenware", STORAGE.PANTRY, [
  ["nudeln","Nudeln",M,730,180,LEIT,1.29,500,["SPAGHETTI","NUDELN","PENNE","FUSILLI","MAKKARONI","BANDNUDELN"],{note:"BZfE: oft Monate bis Jahre über MHD genießbar."}],
  ["nudeln_vollkorn","Vollkornnudeln",M,540,180,EST,1.79,500,["VOLLKORNNUDELN"]],
  ["reis","Reis",M,730,365,LEIT,2.19,1000,["REIS","LANGKORNREIS","BASMATIREIS","JASMINREIS"]],
  ["risottoreis","Risottoreis",M,730,365,EST,2.49,500,["RISOTTOREIS","ARBORIO"]],
  ["couscous","Couscous",M,540,180,EST,1.49,500,["COUSCOUS"]],
  ["bulgur","Bulgur",M,540,180,EST,1.69,500,["BULGUR"]],
  ["quinoa","Quinoa",M,540,180,EST,2.99,400,["QUINOA"]],
  ["mehl","Mehl",M,540,180,LEIT,0.89,1000,["MEHL","WEIZENMEHL","DINKELMEHL"],{note:"Helle Mehle oft Wochen bis Monate über MHD haltbar; auf Schädlinge achten."}],
  ["haferflocken","Haferflocken",M,365,120,EST,0.99,500,["HAFERFLOCKEN"]],
  ["muesli","Müsli",M,270,90,EST,2.49,750,["MUESLI","MÜSLI","KNUSPERMUESLI","GRANOLA"]],
  ["cornflakes","Cornflakes",M,270,60,EST,2.29,500,["CORNFLAKES","CEREALIEN"]],
  ["zucker","Zucker",M,1460,1460,LEIT,0.99,1000,["ZUCKER","KRISTALLZUCKER"]],
  ["puderzucker","Puderzucker",M,730,365,EST,0.79,250,["PUDERZUCKER"]],
  ["salz","Salz",M,3650,3650,LEIT,0.49,500,["SALZ","SPEISESALZ","MEERSALZ"]],
  ["pfeffer","Pfeffer",M,730,365,EST,1.49,50,["PFEFFER"]],
  ["gewuerze","Gewürze",M,730,365,EST,1.29,30,["PAPRIKAPULVER","OREGANO","CURRY","ZIMT","KUEMMEL","THYMIAN"]],
  ["backpulver","Backpulver",M,730,365,EST,0.49,45,["BACKPULVER","NATRON"]],
  ["hefe","Trockenhefe",M,365,90,EST,0.59,21,["TROCKENHEFE","HEFE"]],
  ["oel_raps","Rapsöl",M,540,120,LEIT,2.49,1000,["RAPSOEL","SPEISEOEL"],{note:"BZfE: wird ranzig bei Sauerstoffkontakt, dunkel lagern."}],
  ["oel_oliven","Olivenöl",M,540,180,LEIT,5.99,500,["OLIVENOEL"]],
  ["oel_sonnenblumen","Sonnenblumenöl",M,540,120,LEIT,1.99,1000,["SONNENBLUMENOEL"]],
  ["essig","Essig",M,1095,365,EST,1.19,500,["ESSIG","BALSAMICO","APFELESSIG","WEINESSIG"]],
  ["nuesse","Nüsse",M,180,60,LEIT,2.99,200,["NUESSE","WALNUESSE","MANDELN","HASELNUESSE","CASHEWS"],{note:"BZfE: werden ranzig; Schimmel kann giftige Stoffe bilden."}],
  ["trockenfruechte","Trockenfrüchte",M,270,90,EST,2.49,200,["ROSINEN","DATTELN","TROCKENPFLAUMEN"]],
  ["linsen","Linsen",M,730,365,LEIT,1.49,500,["LINSEN","ROTE LINSEN","BELUGALINSEN"]],
  ["bohnen_trocken","Trockenbohnen",M,730,365,LEIT,1.49,500,["WEISSE BOHNEN TROCKEN"]],
  ["kichererbsen","Kichererbsen trocken",M,730,365,LEIT,1.29,500,["KICHERERBSEN TROCKEN"]],
  ["kaffee","Kaffee, gemahlen",M,365,21,EST,6.49,500,["KAFFEE","KAFFEE GEMAHLEN","FILTERKAFFEE"]],
  ["kaffee_bohnen","Kaffeebohnen",M,365,30,EST,7.99,1000,["KAFFEEBOHNEN","ESPRESSOBOHNEN"]],
  ["kaffee_kapseln","Kaffeekapseln",M,365,180,EST,3.49,100,["KAFFEEKAPSELN","KAFFEEPADS"]],
  ["tee","Tee",M,730,365,EST,2.29,50,["TEE","SCHWARZTEE","KRAEUTERTEE","GRUENTEE"]],
  ["kakao","Kakaopulver",M,540,180,EST,2.49,250,["KAKAO","KAKAOPULVER"]],
  ["honig","Honig",M,1095,730,EST,4.49,500,["HONIG"]],
  ["marmelade","Marmelade",M,540,60,EST,1.99,450,["MARMELADE","KONFITUERE","FRUCHTAUFSTRICH"]],
  ["nussaufstrich","Nuss-Nougat-Creme",M,365,90,EST,2.99,400,["NUSS NOUGAT CREME"]],
  ["erdnussbutter","Erdnussbutter",M,365,90,EST,2.99,350,["ERDNUSSBUTTER","ERDNUSSMUS"]],
  ["ketchup","Ketchup",M,540,60,EST,1.79,500,["KETCHUP","TOMATENKETCHUP"]],
  ["senf","Senf",M,540,90,EST,0.89,250,["SENF","MITTELSCHARFER SENF"]],
  ["mayonnaise","Mayonnaise",M,270,60,EST,1.99,250,["MAYONNAISE","MAYO","REMOULADE"]],
  ["sojasauce","Sojasauce",M,730,180,EST,1.99,150,["SOJASAUCE","SOJASOSSE"]],
  ["bruehe","Brühe",M,540,180,EST,1.79,250,["GEMUESEBRUEHE","HUEHNERBRUEHE","BRUEHWUERFEL"]],
  ["tomatenmark","Tomatenmark",M,730,7,LEIT,0.69,200,["TOMATENMARK"]],
  ["passata","Passierte Tomaten",M,730,3,LEIT,0.99,500,["PASSATA","PASSIERTE TOMATEN"]],
  ["konserve_tomaten","Tomaten, Dose",M,730,3,LEIT,0.89,400,["GEHACKTE TOMATEN","TOMATEN DOSE","DOSENTOMATEN"],{note:"Geöffnete Konserve umfüllen und kühlen."}],
  ["konserve_mais","Mais, Dose",M,730,3,LEIT,0.79,300,["MAIS DOSE","MAIS"]],
  ["konserve_bohnen","Bohnen, Dose",M,730,3,LEIT,0.89,400,["KIDNEYBOHNEN DOSE","BOHNEN DOSE"]],
  ["konserve_kichererbsen","Kichererbsen, Dose",M,730,3,LEIT,0.89,400,["KICHERERBSEN DOSE"]],
  ["kokosmilch","Kokosmilch",M,730,3,LEIT,1.29,400,["KOKOSMILCH"]],
  ["oliven","Oliven",M,540,14,EST,1.99,200,["OLIVEN"]],
  ["gurken_glas","Gewürzgurken",M,730,30,EST,1.49,330,["GEWUERZGURKEN","CORNICHONS","ESSIGGURKEN"]],
  ["sauerkraut","Sauerkraut",M,540,7,EST,1.19,500,["SAUERKRAUT"]],
  ["pesto","Pesto",M,365,7,EST,1.99,190,["PESTO","PESTO GENOVESE"]],
  ["fertigsauce","Fertigsauce",M,540,4,EST,1.79,400,["TOMATENSAUCE","BOLOGNESE SAUCE","PASTASAUCE"]],
  ["suppe_dose","Suppe, Dose",M,730,3,EST,1.29,400,["SUPPE DOSE","LINSENSUPPE","GULASCHSUPPE"]]
]);

// ===================== GETRÄNKE ==================================
group("Getränke", "Getränke", STORAGE.PANTRY, [
  ["wasser","Mineralwasser",M,365,5,EST,0.39,1500,["MINERALWASSER","WASSER","WASSER SPRUDEL","WASSER STILL"],{freezable:false}],
  ["saft_orange","Orangensaft",M,270,4,LEIT,1.79,1000,["ORANGENSAFT","O-SAFT"],{note:"BZfE: geöffnete Säfte können gären, gekühlt rasch verbrauchen."}],
  ["saft_apfel","Apfelsaft",M,270,4,LEIT,1.49,1000,["APFELSAFT","APFELSCHORLE"]],
  ["saft_multi","Multivitaminsaft",M,270,4,LEIT,1.69,1000,["MULTIVITAMINSAFT"]],
  ["limonade","Limonade",M,270,3,EST,0.99,1500,["COLA","LIMONADE","BRAUSE"],{freezable:false}],
  ["eistee","Eistee",M,270,3,EST,0.99,1500,["EISTEE"],{freezable:false}],
  ["bier","Bier",M,180,1,EST,0.79,500,["BIER","PILS","WEIZENBIER","RADLER"],{freezable:false}],
  ["wein","Wein",M,1095,3,EST,4.99,750,["ROTWEIN","WEISSWEIN","WEIN"],{freezable:false}],
  ["sekt","Sekt",M,730,1,EST,4.49,750,["SEKT","PROSECCO"],{freezable:false}],
  ["spirituose","Spirituosen",M,1825,730,EST,12.99,700,["WODKA","GIN","WHISKY","RUM"],{freezable:false}]
]);

// ===================== TIEFKÜHL ==================================
group("Tiefkühl", "Tiefkühl", STORAGE.FREEZER, [
  ["tk_gemuese","TK-Gemüse",M,365,365,LEIT,1.49,750,["TK GEMUESE","ERBSEN TK","RAHMSPINAT","TK ERBSEN","TIEFKUEHLGEMUESE"]],
  ["tk_pommes","TK-Pommes",M,365,365,EST,2.29,1000,["POMMES","TK POMMES","KARTOFFELECKEN"]],
  ["tk_pizza","TK-Pizza",M,365,365,EST,2.99,350,["TK PIZZA","PIZZA SALAMI","STEINOFENPIZZA"]],
  ["tk_fisch","TK-Fisch",M,365,365,EST,4.49,400,["FISCHSTAEBCHEN","TK FISCH","BACKFISCH"]],
  ["tk_beeren","TK-Beeren",M,365,365,EST,2.99,300,["TK BEEREN","BEERENMISCHUNG TK"]],
  ["tk_kraeuter","TK-Kräuter",M,365,365,EST,0.99,50,["TK KRAEUTER"]],
  ["eis","Speiseeis",M,365,90,EST,3.49,900,["SPEISEEIS","VANILLEEIS","EISCREME"]],
  ["tk_fertiggericht","TK-Fertiggericht",M,365,365,EST,3.29,400,["TK LASAGNE","FERTIGGERICHT TK"]]
]);

// ===================== SÜSSES & SNACKS ===========================
group("Süßes/Snacks", "Süßwaren", STORAGE.PANTRY, [
  ["schokolade","Schokolade",M,365,30,EST,1.49,100,["SCHOKOLADE","VOLLMILCHSCHOKOLADE","ZARTBITTER"]],
  ["kekse","Kekse",M,270,14,EST,1.79,300,["KEKSE","BUTTERKEKSE","SCHOKOKEKSE"]],
  ["gummibaerchen","Fruchtgummi",M,365,30,EST,1.29,200,["GUMMIBAERCHEN","FRUCHTGUMMI","WEINGUMMI"]],
  ["chips","Chips",M,180,3,EST,1.99,175,["CHIPS","KARTOFFELCHIPS","TORTILLA CHIPS","NACHOS"]],
  ["salzgebaeck","Salzgebäck",M,270,7,EST,0.99,200,["SALZSTANGEN","CRACKER","ERDNUSSFLIPS"]],
  ["riegel","Müsliriegel",M,270,14,EST,1.99,150,["MUESLIRIEGEL","SCHOKORIEGEL","KOERNERRIEGEL"]],
  ["popcorn","Popcorn",M,180,5,EST,1.49,100,["POPCORN"]],
  ["bonbons","Bonbons",M,540,90,EST,1.19,150,["BONBONS","LUTSCHER","KAUGUMMI"]]
]);

// ===================== NON-FOOD ==================================
group("Haushalt", "Drogerie", STORAGE.NONE, [
  ["spuelmittel","Spülmittel",N,3650,3650,EST,1.29,500,["SPUELMITTEL"]],
  ["waschmittel","Waschmittel",N,3650,3650,EST,5.99,1500,["WASCHMITTEL","VOLLWASCHMITTEL"]],
  ["klopapier","Toilettenpapier",N,3650,3650,EST,3.99,1000,["TOILETTENPAPIER","KLOPAPIER"]],
  ["kuechenrolle","Küchenrolle",N,3650,3650,EST,1.99,500,["KUECHENROLLE","HAUSHALTSROLLE"]],
  ["muellbeutel","Müllbeutel",N,3650,3650,EST,2.49,300,["MUELLBEUTEL","MUELLSAECKE"]],
  ["alufolie","Alufolie",N,3650,3650,EST,1.99,200,["ALUFOLIE","FRISCHHALTEFOLIE","BACKPAPIER"]],
  ["zahnpasta","Zahnpasta",N,1095,365,EST,1.79,75,["ZAHNPASTA","ZAHNCREME"]],
  ["duschgel","Duschgel",N,1095,365,EST,1.99,300,["DUSCHGEL","SHAMPOO","SEIFE"]],
  ["deo","Deodorant",N,1095,365,EST,2.49,150,["DEO","DEODORANT"]],
  ["putztuecher","Reinigungstücher",N,1095,365,EST,1.49,200,["PUTZTUECHER","SCHWAMM","MIKROFASERTUCH"]],
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
  ["haehnchen_nuggets","Hähnchen-Nuggets",V,3,1,REG,3.99,400,["CHICKENNUG","CHICKEN NUGGETS","HAEHNCHEN NUGGETS","CHICKENNUG.CORNFLAK","NUGGETS"]],
  ["putenaufschnitt","Puten-Aufschnitt",M,10,4,EST,2.69,150,["PUTE GORGONZOLA","PUTENBRUST AUFSCHNITT","PUTE AUFSCHNITT"],{storage:STORAGE.FRIDGE_MIDDLE}],
  ["rinderhueftsteak","Rinderhüftsteak",V,3,1,REG,4.58,200,["RINDERHUEFTSTEAK","HUEFTSTEAK","RINDERHUEFTE"]]
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

// ---- Zugriffsfunktionen ----------------------------------------

const byId = (id) => FOOD_DATABASE.find((p) => p.id === id) || null;

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
 * @returns {{
 *   rhythmDays:number|null, confidence:number, sampleSize:number,
 *   lastPurchaseDate:string|null, lastQuantity:number,
 *   pauses:Array, trend:"stabil"|"seltener"|"haeufiger"|"unbekannt",
 *   perUnitDays:number|null
 * }}
 */
function computeRhythm(purchases) {
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
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    const qty = sorted[i - 1].quantity || 1;
    const perUnit = gap / qty;
    // Sicherheitsnetz: nur endliche, nicht-negative Werte verwenden
    if (!Number.isFinite(perUnit) || perUnit < 0) continue;
    rawIntervals.push({ gap, perUnit, from: sorted[i - 1].date, to: sorted[i].date });
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
    invalidEntries: invalid.length
  };
}

/** Rhythmen für alle Produkte eines Haushalts. */
function computeAllRhythms(history) {
  const byProduct = new Map();
  for (const entry of history) {
    if (!byProduct.has(entry.productId)) byProduct.set(entry.productId, []);
    byProduct.get(entry.productId).push(entry);
  }
  const out = new Map();
  for (const [productId, purchases] of byProduct.entries()) {
    out.set(productId, computeRhythm(purchases));
  }
  return out;
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
 */
function foldUmlauts(s) {
  return s
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/** Zerlegt "H-MILCH 3,5% 1L" in { core:"h milch 3,5%", quantity:1, unit:"l" } */
function parseProductName(raw) {
  let s = foldUmlauts(String(raw || "").toLowerCase());

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
    for (const variant of entry.variants) {
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
 * Explizite Nutzerangabe schlägt jede Schätzung.
 * "consumed" oder "have" heißt: nichts weggeworfen.
 */
function reconcileWithUserInput(events, userInput) {
  if (!userInput) return events;
  if (userInput.userReason === "consumed" || userInput.userReason === "have") {
    return events.filter((e) => !(e.productId === userInput.productId && e.date === userInput.date));
  }
  return events;
}

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
 * Schätzt den Restbestand eines Produkts.
 *
 * @param {object} lastPurchase - {date, quantity, unitPrice}
 * @param {object} rhythm - Ergebnis aus computeRhythm
 * @param {string} today
 */
function estimateRemaining(productId, lastPurchase, rhythm, today) {
  const p = byId(productId);
  if (!p || !lastPurchase) return null;

  const daysSince = daysBetween(lastPurchase.date, today);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;

  const quantity = lastPurchase.quantity || 1;

  // Verbrauch pro Einheit: aus dem Rhythmus, sonst Kategorie-Annahme
  const perUnitDays = rhythm && rhythm.perUnitDays ? rhythm.perUnitDays : null;

  let remainingUnits;
  let basis;
  if (perUnitDays && perUnitDays > 0) {
    const consumed = daysSince / perUnitDays;
    remainingUnits = Math.max(0, quantity - consumed);
    basis = "rhythmus";
  } else {
    // Ohne Rhythmus: nur die Haltbarkeit als grobe Schranke
    remainingUnits = daysSince < p.shelfLifeDays ? quantity : 0;
    basis = "haltbarkeit";
  }

  // Restzeit bis Ablauf, gerechnet ab Kaufdatum
  const daysLeft = p.shelfLifeDays - daysSince;

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
    estimated: true
  };
}

/**
 * Schätzt den kompletten Haushaltsbestand.
 * @returns {Array} nur Produkte, die wahrscheinlich noch da sind
 */
function estimateInventory(history, rhythms, today) {
  const lastByProduct = new Map();
  for (const h of history) {
    const prev = lastByProduct.get(h.productId);
    if (!prev || h.date > prev.date) lastByProduct.set(h.productId, h);
  }

  const inventory = [];
  for (const [productId, last] of lastByProduct.entries()) {
    const est = estimateRemaining(productId, last, rhythms.get(productId), today);
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
    const rawShare = Math.min(0.75, surplusDays / daysNeeded);
    const share = Math.round(rawShare * 2) / 2 || 0.5;

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
    short: `${list} direkt kühlen — ${STORAGE.FRIDGE_BOTTOM}.`,
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
