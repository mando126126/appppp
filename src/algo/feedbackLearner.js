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
function feedbackAdjustment(log, rhythmDays, today) {
  const base = {
    factor: 1,
    adjustedDays: rhythmDays,
    signals: 0,
    considered: 0,
    neutral: 0,
    disagreement: 0,
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
  const fresh = log.filter((e) => {
    if (!e || !e.date || e.date > today) return false;
    return daysBetween(e.date, today) <= MAX_AGE_DAYS;
  });
  if (!fresh.length) return { ...base, reason: "nur_altes_feedback" };

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

  const adj = feedbackAdjustment(log || [], rhythm.rhythmDays, today);

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
  feedbackAdjustment, applyFeedback, signalFor, medianOfSignals,
  REASON, MAX_AGE_DAYS, MIN_SIGNALS, MAX_ADJUST, MAX_WEIGHT_SIGNALS,
  DISAGREEMENT_THRESHOLD, MIN_VALID_RHYTHM_DAYS, EXPLICIT_WEIGHT
};
