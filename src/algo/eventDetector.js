/**
 * eventDetector.js — übergroße Einkäufe erkennen und entschärfen
 * ================================================================
 * DAS PROBLEM.
 *
 * `rhythmDays = perUnitDays * lastQuantity` (rhythmEngine2.js) ist im
 * Normalfall genau richtig: wer sechs Packungen statt einer kauft,
 * kommt damit sechsmal so lange aus — bei GLEICHBLEIBENDEM Verbrauch.
 * Diese Annahme bricht genau dann, wenn sie am wichtigsten wäre: eine
 * Grillfeier, Besuch übers Wochenende, Weihnachten. Dort wird die
 * sechsfache Menge nicht sechsmal so langsam verbraucht, sondern in
 * ein paar Tagen deutlich schneller — und die App zieht daraus den
 * falschen Schluss, dieses Produkt sei jetzt für Monate erledigt.
 *
 * Die App kann diesen Unterschied nicht aus den Kaufdaten ablesen:
 * ein Vorratskauf zum Sparpreis und ein Fest sehen in der Kasse
 * identisch aus. Deshalb wird gefragt statt geschlossen — derselbe
 * Grundsatz wie bei askLate() (views.js): eine Rückmeldung, die man
 * auch weglassen kann, nie ein stilles Signal.
 *
 * WAS DIESES MODUL TUT UND WAS NICHT.
 *
 * `detectEventPurchase` erkennt NUR, welche Produkte eines gerade
 * gebuchten Einkaufs auffällig groß sind — es fragt nichts und
 * speichert nichts, das macht die Oberfläche.
 *
 * `applyEventCorrection` wirkt erst, nachdem der Nutzer bestätigt
 * hat. Sie rechnet NICHT den Rhythmus um (der Median aus den echten
 * Kaufabständen bleibt unangetastet — Käufe bleiben Käufe, wie in
 * feedbackLearner.js), sondern nur die Vorhersage, die aus der
 * zuletzt gekauften Menge folgt: wie lange DIESE Packung reichen
 * wird. Genau dort und nirgends sonst wirkt die falsche Annahme.
 *
 * WARUM NUR LEBENSMITTEL.
 *
 * Haushaltsprodukte rechnen über eine gleitende VerbrauchsRATE
 * (rateLearner.js), gemittelt über 180 Tage — ein einzelner
 * Groß­einkauf geht darin unter, statt sie zu dominieren. Das Problem,
 * das dieses Modul löst, existiert dort strukturell nicht.
 * ================================================================
 */

const { isNonFood } = require("./nonFoodCatalog");

// Mindestens das Vielfache der sonst gekauften Menge …
const EVENT_FACTOR = 2.5;
// … UND mindestens so viel mehr in echten Einheiten. Ohne diese
// zweite Bedingung würde "sonst 1, diesmal 3" schon reichen — bei
// einem Produkt, das ohnehin nur in Einzelpackungen gekauft wird,
// ist das kein Fest, sondern ganz gewöhnliches Rauschen.
const MIN_EXTRA_UNITS = 2;
// Der Rhythmus muss auf echten Wiederholungen stehen, nicht auf
// einer einzigen Beobachtung — sonst ist "die übliche Menge" selbst
// nur eine Vermutung.
const MIN_SAMPLE = 3;
// Heißt nicht MIN_CONFIDENCE: den Namen vergibt forgottenDetector,
// und beide teilen sich im Bündel denselben Namensraum.
const EVENT_MIN_CONFIDENCE = 0.4;    // dieselbe Schwelle wie überall
// Ab wie vielen betroffenen Produkten der ganze Einkauf auffällt —
// ODER ein einzelnes, aber sehr extremes Produkt (SOLO_FACTOR).
const MIN_CANDIDATES = 2;
const SOLO_FACTOR = 4;

/**
 * Welche Produkte eines Einkaufs deutlich größer ausfielen als sonst.
 *
 * @param {Array} items    [{productId, quantity}] — GENAU dieser Bon,
 *                         Mengen je Produkt bereits zusammengezählt
 * @param {Map}   rhythms  Rhythmen VOR diesem Einkauf (der Aufrufer
 *                         übergibt den Stand vor dem Buchen — danach
 *                         ist die auffällige Menge ja schon die neue
 *                         "letzte Menge" und nichts fiele mehr auf)
 * @returns {Array<{productId, quantity, typical, factor}>}
 */
function candidateProducts(items, rhythms) {
  const summe = new Map();
  for (const it of items || []) {
    if (!it || !it.productId) continue;
    summe.set(it.productId, (summe.get(it.productId) || 0) + (Math.max(1, Number(it.quantity) || 1)));
  }

  const out = [];
  for (const [productId, gekauft] of summe) {
    if (isNonFood(productId)) continue;
    const r = rhythms && rhythms.get ? rhythms.get(productId) : null;
    if (!r || !r.rhythmDays || (r.confidence || 0) < EVENT_MIN_CONFIDENCE) continue;
    if ((r.sampleSize || 0) < MIN_SAMPLE) continue;

    const typical = Math.max(1, r.lastQuantity || 1);
    const factor = gekauft / typical;
    if (factor < EVENT_FACTOR) continue;
    if (gekauft - typical < MIN_EXTRA_UNITS) continue;

    out.push({ productId, quantity: gekauft, typical, factor: Math.round(factor * 10) / 10 });
  }
  return out.sort((a, b) => b.factor - a.factor);
}

/**
 * Ist dieser Einkauf als Ganzes auffällig — lohnt sich die Frage?
 *
 * Bewusst zurückhaltend: gefragt wird nur, wenn mehrere Produkte
 * gleichzeitig aus dem Rahmen fallen, oder ein einzelnes sehr
 * deutlich. Eine Frage nach jedem übergroßen Fünf-Kilo-Sack Reis
 * würde schnell zum Rauschen, gegen das dieses Projekt an anderer
 * Stelle schon einmal angetreten ist (siehe feedbackLearner.js).
 */
function detectEventPurchase(items, rhythms) {
  const kandidaten = candidateProducts(items, rhythms);
  const auffaellig = kandidaten.length >= MIN_CANDIDATES ||
    (kandidaten.length >= 1 && kandidaten[0].factor >= SOLO_FACTOR);
  return { isEvent: auffaellig, products: kandidaten };
}

/**
 * Die Vorhersage für EIN Produkt entschärfen, nachdem der Nutzer
 * bestätigt hat, dass es für einen Anlass war.
 *
 * `eventInfo` kommt unverändert aus der Erkennung von oben plus dem
 * Datum, an dem gefragt wurde — `{productId, date, quantity, typical}`.
 * Die Korrektur wirkt NUR, solange dieser Kauf noch der letzte ist:
 * sobald danach ein echter neuer Kauf stattfindet, weicht
 * `rhythm.lastPurchaseDate` vom gespeicherten Datum ab, und der
 * Eintrag wird von selbst wirkungslos — genau wie eine überholte
 * Vorratskorrektur in inventoryEstimator.js. Kein Aufräumen nötig.
 *
 * GERECHNET WIRD ALS VERHÄLTNIS AUF DEN AKTUELLEN RHYTHMUS, nicht neu
 * aus perUnitDays. Der hereinkommende `rhythm` hat bereits Saison und
 * Rückmeldungen durchlaufen (applySeason, applyFeedback) — eine
 * Neuberechnung aus dem rohen Pro-Einheit-Wert würde genau diese
 * Stufen wieder verwerfen. Der Faktor typical/gekauft nimmt nur die
 * MENGE aus der Rechnung, die den Ausschlag gegeben hat, und lässt
 * jede andere Korrektur, die schon angewandt wurde, unangetastet —
 * derselbe Grundsatz wie überall in dieser Kette: jede Stufe hängt
 * ihre eigene Begründung ans Ergebnis, ohne die vorherigen zu tilgen.
 */
function applyEventCorrection(rhythm, eventInfo) {
  if (!rhythm || !rhythm.rhythmDays) return rhythm;
  if (!eventInfo || !eventInfo.date || eventInfo.date !== rhythm.lastPurchaseDate) return rhythm;

  const bought = Math.max(1, Number(rhythm.lastQuantity) || 1);
  const typical = Math.max(1, Number(eventInfo.typical) || 1);
  if (typical >= bought) return rhythm;   // nichts zu korrigieren

  const correctedDays = Math.max(1, Math.round(rhythm.rhythmDays * (typical / bought)));
  if (correctedDays === rhythm.rhythmDays) return rhythm;

  return {
    ...rhythm,
    rhythmDays: correctedDays,
    eventBaseDays: rhythm.rhythmDays,
    event: {
      date: eventInfo.date,
      boughtQuantity: bought,
      typicalQuantity: typical,
      message: `Am ${eventInfo.date} wurde deutlich mehr gekauft als sonst — der nächste Vorschlag ` +
        "richtet sich nach der üblichen Menge, nicht nach dieser."
    }
  };
}

module.exports = {
  detectEventPurchase, candidateProducts, applyEventCorrection,
  EVENT_FACTOR, MIN_EXTRA_UNITS, MIN_SAMPLE, EVENT_MIN_CONFIDENCE, MIN_CANDIDATES, SOLO_FACTOR
};
