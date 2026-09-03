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

const { daysBetween } = require("./rhythmEngine2");

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
function signalFor(entry, rhythmDays, awayDays = 0) {
  if (!rhythmDays || rhythmDays <= 0) return null;

  if (entry.reason === REASON.HAVE) {
    // Der Vorschlag kam zu früh. Wie viel zu früh, lässt sich nicht
    // messen — der Nutzer sagt nur „noch da", nicht „noch fünf Tage".
    // Ein überfälliges Produkt, das noch da ist, liegt weiter daneben
    // als ein gerade erst fälliges.
    //
    // DER BÜNDEL-EFFEKT (siehe ausführlich bei `awayDaysFor`): war der
    // Haushalt zwischendurch weg, zählt die Überfälligkeit Tage mit, an
    // denen niemand etwas verbraucht hat. Diese Tage werden abgezogen.
    // Bleibt danach keine Überfälligkeit übrig, war das Produkt ohne die
    // Reise gar nicht fällig — dann sagt „hab noch" nichts über den
    // Rhythmus und die Rückmeldung wird neutral behandelt.
    const away = Number.isFinite(awayDays) && awayDays > 0 ? awayDays : 0;
    const overdue = -(Number(entry.dueIn) || 0) - away;
    if (away > 0 && overdue <= 0) return null;
    const relative = (rhythmDays * 0.15 + Math.max(0, overdue)) / rhythmDays;
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

/**
 * Abwesenheitstage, die in der Überfälligkeit dieser Rückmeldung
 * stecken.
 *
 * DER BÜNDEL-EFFEKT — warum das nötig ist:
 *
 * Fällig wird ein Produkt nach Kalendertagen seit dem letzten Kauf.
 * Verbraucht wird es aber nur an Tagen, an denen jemand da ist. Nach
 * zwei Wochen Urlaub sind deshalb schlagartig viele Produkte
 * rechnerisch fällig — und treffen gebündelt auf einen Schrank, in dem
 * noch alles steht, weil zwei Wochen lang niemand etwas verbraucht
 * hat. Der Nutzer tippt reihenweise „hab noch da", und jede dieser
 * Antworten verlängert einen Rhythmus, der gar nicht falsch war.
 *
 * Der Schaden ist bleibend: die verlängerten Rhythmen schlagen danach
 * zu spät vor, das Produkt ist wirklich alle, und der Haushalt kommt
 * aus dem verschobenen Takt nicht mehr heraus. In der Drei-Jahres-
 * Simulation ist genau dieses Muster als Einbruch im Quartal nach dem
 * Urlaub sichtbar.
 *
 * Die Gegenmaßnahme setzt an der Ursache an und nicht an der
 * Sichtbarkeits-Schwelle (die wurde gemessen und verworfen, siehe
 * test/liste.js): die Abwesenheitstage werden aus der Überfälligkeit
 * herausgerechnet. `rhythmDays` ist über `computeRhythm({absenceDays})`
 * bereits abwesenheitsbereinigt — die Rückmeldung dagegen zu halten,
 * ist also nur folgerichtig.
 *
 * Nur für „hab noch da". „War schon alle" bleibt unangetastet: dass
 * etwas leer war, wird durch eine Reise nicht unwahr — im Gegenteil,
 * wer weg war und trotzdem nichts mehr hat, liefert das stärkere
 * Signal.
 */
function awayDaysFor(entry, lastPurchaseDate, absenceDays) {
  if (typeof absenceDays !== "function") return 0;
  if (!entry || entry.reason !== REASON.HAVE) return 0;
  if (!lastPurchaseDate || !entry.date || entry.date <= lastPurchaseDate) return 0;
  const away = absenceDays(lastPurchaseDate, entry.date);
  return Number.isFinite(away) && away > 0 ? away : 0;
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
    absenceNeutral: 0,
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
  let absenceNeutral = 0;
  let explicitCount = 0;
  for (const e of fresh) {
    const away = awayDaysFor(e, lastPurchaseDate, opts.absenceDays);
    const s = signalFor(e, rhythmDays, away);
    if (s === null || !Number.isFinite(s)) {
      neutral++;
      if (away > 0) absenceNeutral++;
      continue;
    }
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
      absenceNeutral,
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
    absenceNeutral,
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

  const adj = feedbackAdjustment(log || [], rhythm.rhythmDays, today, {
    lastPurchaseDate,
    // Abwesenheiten entschärfen den Bündel-Effekt (siehe `awayDaysFor`).
    // Fehlt die Angabe, verhält sich das Modul wie zuvor.
    absenceDays: opts.absenceDays
  });

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

module.exports = {
  feedbackAdjustment, applyFeedback, signalFor, medianOfSignals, awayDaysFor,
  REASON, MAX_AGE_DAYS, MIN_SIGNALS, MAX_ADJUST, MAX_WEIGHT_SIGNALS,
  DISAGREEMENT_THRESHOLD, MIN_VALID_RHYTHM_DAYS, EXPLICIT_WEIGHT
};
