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

module.exports = {
  SAFETY_GROUPS, LEGAL, safetyGroupOf, checkSafetyData, safetyFacts
};
