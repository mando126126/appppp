/**
 * learning.js — Tests des Lernens aus dem Verlauf
 *   feedbackLearner, seasonalRhythm, changeDetector
 *
 * Der Schwerpunkt liegt auf feedbackLearner. Ein Lernmechanismus, der
 * bei einem einzelnen Fehltipp kippt, ist schlimmer als keiner: er
 * macht die Vorhersage schlechter UND untergräbt das Vertrauen. Also
 * wird hier nicht nur geprüft, dass er lernt, sondern vor allem, dass
 * er die Grenzen einhält, die ihn ungefährlich machen.
 *
 * Drei Prüfebenen:
 *   1. Einzelfälle — tut er das Richtige?
 *   2. Invarianten — gelten sie IMMER, auch bei Unsinn als Eingabe?
 *   3. Zufallsdaten — halten die Invarianten über tausende Läufe?
 *
 *   node test/learning.js
 */
const {
  feedbackAdjustment, applyFeedback, signalFor, medianOfSignals, awayDaysFor,
  REASON, MAX_AGE_DAYS, MIN_SIGNALS, MAX_ADJUST, MAX_WEIGHT_SIGNALS,
  DISAGREEMENT_THRESHOLD, MIN_VALID_RHYTHM_DAYS
} = require("../src/algo/feedbackLearner");
const {
  seasonalFactor, applySeason, MIN_HISTORY_DAYS, MIN_PURCHASES_FOR_SEASON, MAX_SEASONAL_ADJUST
} = require("../src/algo/seasonalRhythm");
const {
  detectChange, purchasesSinceChange, MIN_RELATIVE_CHANGE, MIN_AGE_DAYS
, MIN_AFTER_SIDE, MIN_AFTER_CYCLES
} = require("../src/algo/changeDetector");
const { computeRhythm } = require("../src/algo/rhythmEngine2");
const { effectiveLookahead } = require("../src/algo/shoppingDay");
const { detectAbsences, knownAbsence, absenceDaysBetween } = require("../src/algo/absenceDetector");
const { abandonFactor, applyAbandon, ABANDON_START, ABANDON_FULL } = require("../src/algo/abandonDetector");

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

const T0 = "2026-08-10";
const day = (offset, from = T0) =>
  new Date(new Date(from + "T12:00:00Z").getTime() + offset * 86400000).toISOString().slice(0, 10);

/** n Rückmeldungen desselben Grundes, gleichmäßig in die Vergangenheit. */
const feedback = (reason, count, { dueIn = 0, spacing = 7, start = 0 } = {}) =>
  Array.from({ length: count }, (_, i) =>
    ({ productId: "x", date: day(-(start + i * spacing)), reason, dueIn }));

/* ================================================================
   1. Einzelfälle: tut es das Richtige?
   ================================================================ */
section("Feedback: Grundverhalten");
{
  const r = feedbackAdjustment([], 7, T0);
  ok("Ohne Feedback bleibt der Rhythmus exakt gleich", r.adjustedDays === 7 && r.factor === 1, JSON.stringify(r));
  ok("Ohne Feedback wird nichts angewandt", r.applied === false && r.reason === "kein_feedback");
}
{
  const r = feedbackAdjustment(feedback(REASON.HAVE, 5), 7, T0);
  ok("Fünfmal „hab noch da“ verlängert den Rhythmus", r.adjustedDays > 7, `${r.adjustedDays} statt 7`);
  ok("Die Anpassung wird als angewandt gemeldet", r.applied === true);
  ok("Die Meldung nennt den alten und neuen Wert",
    /7/.test(r.message) && new RegExp(String(r.adjustedDays)).test(r.message), r.message);
  ok("Die Zahl der Signale wird ausgewiesen", r.signals === 5, r.signals);
}
{
  const r = feedbackAdjustment(feedback(REASON.CONSUMED, 8), 7, T0);
  ok("„Verbraucht“ ändert den Rhythmus NICHT", r.adjustedDays === 7 && r.factor === 1, JSON.stringify(r));
  ok("„Verbraucht“ wird als neutral gezählt", r.neutral === 8, r.neutral);
}
{
  const r = feedbackAdjustment(feedback(REASON.SKIP, 8), 7, T0);
  ok("„Diese Woche nicht“ ändert den Rhythmus NICHT", r.adjustedDays === 7 && r.factor === 1);
  ok("Und wird ebenfalls als neutral gezählt", r.neutral === 8, r.neutral);
}
{
  const mixed = [...feedback(REASON.HAVE, 4), ...feedback(REASON.CONSUMED, 6, { start: 60 })];
  const onlyHave = feedbackAdjustment(feedback(REASON.HAVE, 4), 7, T0);
  const withNeutral = feedbackAdjustment(mixed, 7, T0);
  ok("Neutrale Rückmeldungen verwässern das Signal nicht",
    withNeutral.adjustedDays === onlyHave.adjustedDays,
    `${onlyHave.adjustedDays} vs ${withNeutral.adjustedDays}`);
}
{
  const overdue = feedbackAdjustment(feedback(REASON.HAVE, 5, { dueIn: -6 }), 7, T0);
  const onTime = feedbackAdjustment(feedback(REASON.HAVE, 5, { dueIn: 0 }), 7, T0);
  ok("Überfälliges „hab noch da“ wiegt schwerer als pünktliches",
    overdue.adjustedDays > onTime.adjustedDays, `${onTime.adjustedDays} vs ${overdue.adjustedDays}`);
}

section("Feedback: Schwellen und Grenzen");
{
  for (let n = 0; n < MIN_SIGNALS; n++) {
    const r = feedbackAdjustment(feedback(REASON.HAVE, n), 7, T0);
    ok(`${n} Signal(e): keine Anpassung (Schwelle ${MIN_SIGNALS})`,
      r.adjustedDays === 7 && r.factor === 1, `${r.adjustedDays}, ${r.reason}`);
  }
  const atThreshold = feedbackAdjustment(feedback(REASON.HAVE, MIN_SIGNALS), 7, T0);
  ok(`${MIN_SIGNALS} Signale: greift`, atThreshold.signals === MIN_SIGNALS && atThreshold.reason === "angewandt");
}
{
  // Extremfall: sehr viele, sehr starke Signale
  const many = feedbackAdjustment(feedback(REASON.HAVE, 50, { dueIn: -500, spacing: 3 }), 7, T0);
  ok(`Korrektur bleibt unter ${MAX_ADJUST * 100} %`,
    Math.abs(many.factor - 1) <= MAX_ADJUST + 1e-9, many.factor);
  ok("Auch bei 50 Rückmeldungen kein Ausreißer", many.adjustedDays <= Math.ceil(7 * (1 + MAX_ADJUST)), many.adjustedDays);
}
{
  const old = feedback(REASON.HAVE, 6, { start: MAX_AGE_DAYS + 30, spacing: 5 });
  const r = feedbackAdjustment(old, 7, T0);
  ok(`Feedback älter als ${MAX_AGE_DAYS} Tage verfällt`,
    r.adjustedDays === 7 && r.reason === "nur_altes_feedback", JSON.stringify(r));
}
{
  const future = [{ productId: "x", date: day(30), reason: REASON.HAVE, dueIn: 0 }];
  const r = feedbackAdjustment([...future, ...feedback(REASON.HAVE, 4)], 7, T0);
  ok("Feedback aus der Zukunft wird ignoriert", r.signals === 4, r.signals);
}

section("Feedback: Robustheit gegen Fehltipps");
{
  // Der entscheidende Test: EIN versehentlicher Tap unter vielen
  // gegenteiligen darf die Richtung nicht drehen.
  const purchases = Array.from({ length: 8 }, (_, i) => ({ date: day(-(70 - i * 10)), quantity: 1 }));
  const oneStray = [{ productId: "x", date: day(-3), reason: REASON.HAVE, dueIn: 0 }];
  const r = feedbackAdjustment(oneStray, 10, T0);
  ok("Ein einzelner Fehltipp ändert gar nichts", r.adjustedDays === 10, JSON.stringify(r));
}
{
  // Median-Eigenschaft: ein extremer Ausreißer unter normalen Signalen
  const normal = feedback(REASON.HAVE, 6, { dueIn: 0 });
  const withOutlier = [...normal, { productId: "x", date: day(-1), reason: REASON.HAVE, dueIn: -9999 }];
  const a = feedbackAdjustment(normal, 7, T0);
  const b = feedbackAdjustment(withOutlier, 7, T0);
  ok("Ein extremer Ausreißer verschiebt den Median kaum",
    Math.abs(b.adjustedDays - a.adjustedDays) <= 1, `${a.adjustedDays} -> ${b.adjustedDays}`);
}
{
  // Widersprüchliche Signale: mal zu früh, mal zu spät
  const conflicting = [
    ...feedback(REASON.HAVE, 4, { dueIn: -10 }),
    ...Array.from({ length: 4 }, (_, i) =>
      ({ productId: "x", date: day(-(i * 9 + 2)), reason: REASON.EMPTY, dueIn: 6 }))
  ];
  const r = feedbackAdjustment(conflicting, 14, T0);
  ok("Widerspruch wird als solcher erkannt", r.disagreement > 0, r.disagreement);
  ok("Bei Widerspruch bleibt die Korrektur klein",
    Math.abs(r.adjustedDays - 14) <= 14 * MAX_ADJUST, `${r.adjustedDays} statt 14`);
}
{
  const rhythm = { rhythmDays: 14, confidence: 0.9, lastPurchaseDate: day(-45) };
  const conflicting = [
    ...feedback(REASON.HAVE, 5, { dueIn: -12 }),
    ...Array.from({ length: 5 }, (_, i) =>
      ({ productId: "x", date: day(-(i * 7 + 3)), reason: REASON.EMPTY, dueIn: 7 }))
  ];
  const out = applyFeedback(rhythm, conflicting, T0, { usePurchases: false });
  ok("Widersprüchliches Feedback senkt das Vertrauen",
    out.confidence < rhythm.confidence, `${rhythm.confidence} -> ${out.confidence}`);
  ok("Das Vertrauen bleibt dabei im gültigen Bereich",
    out.confidence >= 0 && out.confidence <= 1, out.confidence);
}

section("Feedback: die Gegenrichtung");
{
  const r = feedbackAdjustment(feedback(REASON.EMPTY, 5), 14, T0);
  ok("„War schon alle“ verkürzt den Rhythmus", r.adjustedDays < 14, `${r.adjustedDays} statt 14`);
  ok("Die Meldung sagt das auch", /verkürzt/.test(r.message), r.message);
}
{
  const late = feedbackAdjustment(feedback(REASON.EMPTY, 5, { dueIn: 8 }), 14, T0);
  const onTime = feedbackAdjustment(feedback(REASON.EMPTY, 5, { dueIn: 0 }), 14, T0);
  ok("Je später der Vorschlag kam, desto stärker die Korrektur",
    late.adjustedDays < onTime.adjustedDays, `${onTime.adjustedDays} vs ${late.adjustedDays}`);
}
{
  // Symmetrie: gleich viele „hab noch“ und „war alle“ heben sich auf
  const balanced = [...feedback(REASON.HAVE, 4), ...feedback(REASON.EMPTY, 4, { start: 40 })];
  const r = feedbackAdjustment(balanced, 14, T0);
  ok("Gleich starke Gegenaussagen heben sich weitgehend auf",
    Math.abs(r.adjustedDays - 14) <= 1, `${r.adjustedDays} statt 14`);
  ok("Und der Widerspruch wird sichtbar gemacht", r.disagreement > 0, r.disagreement);
}
{
  // Der Bias, der zur Entfernung des impliziten Signals führte: bei
  // völlig stabilem Kaufverhalten darf NICHTS korrigiert werden.
  const rhythm = { rhythmDays: 7, confidence: 1 };
  const steady = Array.from({ length: 12 }, (_, i) =>
    ({ productId: "x", date: day(-(77 - i * 7)), quantity: 1 }));
  const out = applyFeedback(rhythm, [], T0, { purchases: steady });
  ok("Stabiles Kaufverhalten ohne Rückmeldung ändert nichts",
    out.rhythmDays === 7, `${out.rhythmDays} statt 7`);

  // Auch nicht bei Streuung durch das Einkaufstag-Raster
  const jittered = [];
  let off = 90;
  [7, 3, 7, 4, 7, 7, 3, 7, 7, 4, 7].forEach((gap) => { jittered.push({ productId: "x", date: day(-off) }); off -= gap; });
  const out2 = applyFeedback({ rhythmDays: 7, confidence: 1 }, [], T0, { purchases: jittered });
  ok("Streuung im Kaufraster erzeugt kein Phantomsignal",
    out2.rhythmDays === 7, `${out2.rhythmDays} statt 7`);
}

section("Feedback: applyFeedback verändert keine Rohdaten");
{
  const rhythm = Object.freeze({ rhythmDays: 7, confidence: 0.8, lastPurchaseDate: day(-45), sampleSize: 9 });
  const log = feedback(REASON.HAVE, 5);
  const logCopy = JSON.parse(JSON.stringify(log));
  const out = applyFeedback(rhythm, log, T0, { usePurchases: false });

  ok("Das Original bleibt unangetastet", rhythm.rhythmDays === 7);
  ok("Das Protokoll bleibt unangetastet", JSON.stringify(log) === JSON.stringify(logCopy));
  ok("Der ursprüngliche Wert bleibt nachvollziehbar", out.baseRhythmDays === 7, out.baseRhythmDays);
  ok("Alle übrigen Felder bleiben erhalten",
    out.sampleSize === 9 && out.lastPurchaseDate === rhythm.lastPurchaseDate);
  ok("Die Herleitung hängt am Ergebnis", !!out.feedback && out.feedback.signals === 5);
}

/* ================================================================
   2. Invarianten: gelten sie IMMER?
   ================================================================ */
section("Feedback: Invarianten");

/** Prüft alle Invarianten auf einmal. Gibt null zurück oder den Bruch. */
function checkInvariants(result, rhythmDays) {
  if (!Number.isFinite(result.factor)) return `factor nicht endlich: ${result.factor}`;
  if (!Number.isFinite(result.adjustedDays)) return `adjustedDays nicht endlich: ${result.adjustedDays}`;
  if (result.adjustedDays < 1) return `adjustedDays unter 1: ${result.adjustedDays}`;
  if (!Number.isInteger(result.adjustedDays)) return `adjustedDays keine ganze Zahl: ${result.adjustedDays}`;
  if (Math.abs(result.factor - 1) > MAX_ADJUST + 1e-9) return `Deckelung verletzt: ${result.factor}`;
  if (result.signals < 0 || result.neutral < 0) return "negative Zählung";
  if (result.disagreement < 0 || result.disagreement > 1) return `disagreement außerhalb 0..1: ${result.disagreement}`;
  if (rhythmDays > 0 && result.signals < MIN_SIGNALS && result.adjustedDays !== rhythmDays) {
    return `unter der Schwelle trotzdem verändert: ${result.adjustedDays} statt ${rhythmDays}`;
  }
  return null;
}

{
  const junk = [
    null, undefined, [], {}, "text", 0, -5, NaN, Infinity,
    [null], [{}], [{ reason: "unbekannt" }], [{ date: "kaputt", reason: REASON.HAVE }],
    [{ date: T0, reason: REASON.HAVE, dueIn: NaN }],
    [{ date: T0, reason: REASON.HAVE, dueIn: Infinity }],
    [{ date: T0, reason: null, dueIn: null }]
  ];
  let broke = null;
  for (const log of junk) {
    for (const rd of [7, 1, 0, -3, null, undefined, NaN, Infinity, 0.5, 9999]) {
      let r;
      try { r = feedbackAdjustment(log, rd, T0); }
      catch (e) { broke = `Absturz bei ${JSON.stringify(log)} / ${rd}: ${e.message}`; break; }
      if (Number.isFinite(rd) && rd >= MIN_VALID_RHYTHM_DAYS) {
        const v = checkInvariants(r, rd);
        if (v) { broke = `${v} bei ${JSON.stringify(log)} / ${rd}`; break; }
      } else if (!Object.is(r.adjustedDays, rd)) {
        // Object.is statt !==: NaN !== NaN ist immer wahr und würde
        // hier einen Fehler melden, wo der Wert korrekt durchgereicht wird.
        broke = `ungültiger Rhythmus ${rd} wurde verändert zu ${r.adjustedDays}`;
        break;
      }
    }
    if (broke) break;
  }
  ok("Unsinnige Eingaben stürzen nicht ab und verletzen keine Invariante", broke === null, broke);
}
{
  // Monotonie: mehr „hab noch da“ darf nie einen KÜRZEREN Rhythmus ergeben
  let broke = null;
  let prev = 0;
  for (let n = MIN_SIGNALS; n <= 30; n++) {
    const r = feedbackAdjustment(feedback(REASON.HAVE, n, { spacing: 5 }), 10, T0);
    if (r.adjustedDays < prev) { broke = `${n} Signale: ${r.adjustedDays} < ${prev}`; break; }
    prev = r.adjustedDays;
  }
  ok("Mehr „hab noch da“ ergibt nie einen kürzeren Rhythmus", broke === null, broke);
}
{
  // Idempotenz: gleiche Eingabe, gleiches Ergebnis
  const log = feedback(REASON.HAVE, 6);
  const a = feedbackAdjustment(log, 9, T0);
  const b = feedbackAdjustment(log, 9, T0);
  ok("Gleiche Eingabe ergibt exakt dasselbe Ergebnis", JSON.stringify(a) === JSON.stringify(b));
}
{
  // Kein Aufschaukeln: die Korrektur zweimal anzuwenden darf nicht
  // dieselbe Korrektur nochmal draufrechnen.
  const rhythm = { rhythmDays: 10, confidence: 0.8 };
  const log = feedback(REASON.HAVE, 6);
  const once = applyFeedback(rhythm, log, T0, { usePurchases: false });
  const twice = applyFeedback({ ...rhythm, rhythmDays: rhythm.rhythmDays }, log, T0, { usePurchases: false });
  ok("Die Korrektur schaukelt sich über Läufe nicht auf",
    once.rhythmDays === twice.rhythmDays, `${once.rhythmDays} vs ${twice.rhythmDays}`);
  ok("Der Basiswert bleibt der ursprüngliche", once.baseRhythmDays === 10);
}
{
  // Sehr kurze und sehr lange Rhythmen
  let broke = null;
  for (const rd of [1, 2, 3, 7, 30, 90, 365, 1000]) {
    const r = feedbackAdjustment(feedback(REASON.HAVE, 8), rd, T0);
    const v = checkInvariants(r, rd);
    if (v) { broke = `${v} bei Rhythmus ${rd}`; break; }
    if (r.adjustedDays < 1) { broke = `Rhythmus ${rd} ergab ${r.adjustedDays}`; break; }
  }
  ok("Invarianten halten über alle Rhythmuslängen", broke === null, broke);
}

section("Feedback: Zufallsdaten");
{
  // Deterministischer Zufall, damit ein Fehlschlag reproduzierbar ist.
  let seed = 20260810;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const reasons = [REASON.HAVE, REASON.EMPTY, REASON.CONSUMED, REASON.SKIP, "unbekannt", null];

  let broke = null;
  for (let run = 0; run < 4000 && !broke; run++) {
    const rd = 1 + Math.floor(rnd() * 120);
    const n = Math.floor(rnd() * 25);
    const log = Array.from({ length: n }, () => ({
      productId: "x",
      date: day(-Math.floor(rnd() * 400)),
      reason: reasons[Math.floor(rnd() * reasons.length)],
      dueIn: Math.floor(rnd() * 60) - 30
    }));
    let r;
    try { r = feedbackAdjustment(log, rd, T0); }
    catch (e) { broke = `Lauf ${run}: Absturz ${e.message}`; break; }
    const v = checkInvariants(r, rd);
    if (v) broke = `Lauf ${run} (Rhythmus ${rd}, ${n} Einträge): ${v}`;
  }
  ok("4000 Zufallsläufe halten alle Invarianten", broke === null, broke);
}
{
  // Zufällige Rhythmus-Objekte durch applyFeedback
  let seed = 42;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let broke = null;
  for (let run = 0; run < 2000 && !broke; run++) {
    const rhythm = { rhythmDays: 1 + Math.floor(rnd() * 60), confidence: rnd() };
    const log = Array.from({ length: Math.floor(rnd() * 15) }, () => ({
      productId: "x", date: day(-Math.floor(rnd() * 250)),
      reason: rnd() > 0.5 ? REASON.HAVE : REASON.CONSUMED,
      dueIn: Math.floor(rnd() * 20) - 10
    }));
    const purchases = Array.from({ length: Math.floor(rnd() * 12) }, (_, i) =>
      ({ date: day(-(i * (1 + Math.floor(rnd() * 20)))), quantity: 1 + Math.floor(rnd() * 3) }));
    let out;
    try { out = applyFeedback(rhythm, log, T0, { purchases }); }
    catch (e) { broke = `Lauf ${run}: Absturz ${e.message}`; break; }
    if (!Number.isFinite(out.rhythmDays) || out.rhythmDays < 1) broke = `Lauf ${run}: rhythmDays ${out.rhythmDays}`;
    else if (out.confidence < 0 || out.confidence > 1) broke = `Lauf ${run}: confidence ${out.confidence}`;
    else if (out.baseRhythmDays !== rhythm.rhythmDays) broke = `Lauf ${run}: Basis verloren`;
  }
  ok("2000 Zufallsläufe durch applyFeedback bleiben gültig", broke === null, broke);
}

/* ================================================================
   3. Zeitreihe: verhält es sich über Monate richtig?
   ================================================================ */
section("Feedback: Verlauf über Monate");
{
  // Ein Haushalt, dem Klopapier zu oft vorgeschlagen wird. Er meldet
  // jede Woche „hab noch da“. Nach einigen Wochen muss der Rhythmus
  // spürbar länger sein — aber nie ins Absurde laufen.
  const log = [];
  const seen = [];
  for (let week = 0; week < 20; week++) {
    log.push({ productId: "klopapier", date: day(-(140 - week * 7)), reason: REASON.HAVE, dueIn: 0 });
    seen.push(feedbackAdjustment(log, 14, T0).adjustedDays);
  }
  ok("Der Rhythmus wächst mit den Rückmeldungen", seen[19] > seen[0], `${seen[0]} -> ${seen[19]}`);
  ok("Er wächst monoton", seen.every((v, i) => i === 0 || v >= seen[i - 1]), seen.join(","));
  ok("Er läuft nicht ins Absurde", seen[19] <= Math.ceil(14 * (1 + MAX_ADJUST)), seen[19]);
  // seen[i] ist der Stand NACH i+1 Rückmeldungen.
  ok("Vor der Schwelle passiert nichts, ab der Schwelle greift es",
    seen[MIN_SIGNALS - 2] === 14 && seen[MIN_SIGNALS - 1] > 14,
    `nach ${MIN_SIGNALS - 1}: ${seen[MIN_SIGNALS - 2]}, nach ${MIN_SIGNALS}: ${seen[MIN_SIGNALS - 1]}`);
}
{
  // Der Nutzer ändert sein Verhalten: erst „hab noch“, dann kauft er
  // pünktlich. Das alte Feedback muss ausklingen.
  const oldLog = feedback(REASON.HAVE, 6, { start: MAX_AGE_DAYS - 20, spacing: 4 });
  const nowStale = oldLog.map((e) => ({ ...e, date: day(-(MAX_AGE_DAYS + 20)) }));
  const before = feedbackAdjustment(oldLog, 10, T0);
  const after = feedbackAdjustment(nowStale, 10, T0);
  ok("Frisches Feedback wirkt", before.adjustedDays > 10, before.adjustedDays);
  ok("Dasselbe Feedback wirkt nach Ablauf nicht mehr", after.adjustedDays === 10, after.adjustedDays);
}
{
  // Zusammenspiel mit dem echten Rhythmusmodell
  // Die Reihe endet vor 20 Tagen: die Rückmeldungen danach stecken
  // noch in keinem Kaufabstand und dürfen deshalb wirken.
  const purchases = Array.from({ length: 10 }, (_, i) =>
    ({ productId: "milch", date: day(-(83 - i * 7)), quantity: 1, unitPrice: 1.29 }));
  const rhythm = computeRhythm(purchases);
  ok("Das Rhythmusmodell liefert einen Wert", rhythm.rhythmDays > 0, rhythm.rhythmDays);

  const corrected = applyFeedback(rhythm, feedback(REASON.HAVE, 6, { spacing: 3 }), T0, { usePurchases: false });
  ok("Die Korrektur greift auf einem echten Rhythmus", corrected.rhythmDays > rhythm.rhythmDays,
    `${rhythm.rhythmDays} -> ${corrected.rhythmDays}`);
  ok("Alle Felder des Rhythmus überleben",
    corrected.sampleSize === rhythm.sampleSize && corrected.trend === rhythm.trend);
}

/* ================================================================
   Saisonalität
   ================================================================ */
section("Saison aus eigener Historie");
{
  const few = Array.from({ length: 5 }, (_, i) => ({ date: day(-(i * 20)) }));
  const r = seasonalFactor(few, T0);
  ok(`Unter ${MIN_PURCHASES_FOR_SEASON} Käufen kein Faktor`, r.factor === 1 && r.applied === false, r.reason);
}
{
  // Ein halbes Jahr Historie reicht nicht für ein Jahresmuster
  const halfYear = Array.from({ length: 15 }, (_, i) => ({ date: day(-(i * 12)) }));
  const r = seasonalFactor(halfYear, T0);
  ok("Unter einem Jahr kein Saisonfaktor", r.applied === false && r.reason === "unter_einem_jahr", r.reason);
}
{
  // Zwei Jahre, im Sommer (Q3) doppelt so oft gekauft
  const rows = [];
  for (let d = 730; d >= 0; d -= 1) {
    const date = day(-d);
    const q = Math.floor(new Date(date + "T12:00:00Z").getUTCMonth() / 3);
    const every = q === 2 ? 7 : 21;
    if (d % every === 0) rows.push({ date });
  }
  const r = seasonalFactor(rows, "2026-08-10");   // August = Q3
  ok("Zwei Jahre Historie ergeben einen Faktor", r.reason === "angewandt", r.reason);
  ok("Im Sommer wird der Rhythmus verkürzt", r.factor < 1, r.factor);
  ok("Der Faktor bleibt gedeckelt", r.factor >= 1 - MAX_SEASONAL_ADJUST - 1e-9, r.factor);
  ok("Alle vier Quartale werden ausgewiesen", r.byQuarter.length === 4);
  ok("Die Meldung nennt die Jahreszeit", /Sommer/.test(r.message), r.message);

  const winter = seasonalFactor(rows, "2027-01-15");
  ok("Im Winter wird der Rhythmus verlängert", winter.factor > 1, winter.factor);
}
{
  // Gleichmäßig übers Jahr: kein Muster
  const rows = [];
  for (let d = 730; d >= 0; d -= 10) rows.push({ date: day(-d) });
  const r = seasonalFactor(rows, T0);
  ok("Gleichmäßiges Kaufen erzeugt kein Saisonmuster",
    r.applied === false || Math.abs(r.factor - 1) < 0.05, `${r.factor}, ${r.reason}`);
}
{
  const rhythm = { rhythmDays: 14, confidence: 0.8 };
  const unchanged = applySeason(rhythm, [{ date: day(-10) }], T0);
  ok("Ohne belastbares Muster bleibt der Rhythmus gleich", unchanged.rhythmDays === 14);
  ok("Die Begründung hängt trotzdem am Ergebnis", !!unchanged.season);
}
{
  let broke = null;
  for (const junk of [null, undefined, [], [{}], [{ date: null }], [{ date: "kaputt" }]]) {
    try {
      const r = seasonalFactor(junk, T0);
      if (!Number.isFinite(r.factor) || r.factor <= 0) broke = `Faktor ${r.factor} bei ${JSON.stringify(junk)}`;
    } catch (e) { broke = `Absturz bei ${JSON.stringify(junk)}: ${e.message}`; }
    if (broke) break;
  }
  ok("Unsinnige Eingaben erzeugen Faktor 1 statt Fehler", broke === null, broke);
}

/* ================================================================
   Strukturbruch
   ================================================================ */
section("Strukturbruch");
{
  // Erst alle 4 Tage, dann alle 12 — jemand ist ausgezogen
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push({ date: day(-(300 - i * 4)), quantity: 1 });
  for (let i = 0; i < 10; i++) rows.push({ date: day(-(250 - i * 12)), quantity: 1 });
  const c = detectChange(rows, T0);
  ok("Der Bruch wird gefunden", c.found === true, c.reason);
  ok("Die Richtung stimmt", c.direction === "seltener", c.direction);
  ok("Vorher und nachher werden beziffert", c.before < c.after, `${c.before} -> ${c.after}`);
  ok("Die Meldung nennt beide Werte", /statt/.test(c.message), c.message);

  const since = purchasesSinceChange(rows, c);
  ok("Nur die Käufe ab dem Bruch werden weitergegeben", since.length < rows.length,
    `${since.length} von ${rows.length}`);
  ok("Ein Kauf davor bleibt als Bezugspunkt stehen",
    since[0].date < c.date, `${since[0].date} < ${c.date}`);

  const rhythmAll = computeRhythm(rows);
  const rhythmSince = computeRhythm(since);
  ok("Der Rhythmus ab dem Bruch weicht vom gemittelten ab",
    rhythmSince.rhythmDays !== rhythmAll.rhythmDays,
    `alles: ${rhythmAll.rhythmDays}, ab Bruch: ${rhythmSince.rhythmDays}`);
}
{
  // Gleichmäßig: kein Bruch
  const rows = Array.from({ length: 20 }, (_, i) => ({ date: day(-(140 - i * 7)), quantity: 1 }));
  const c = detectChange(rows, T0);
  ok("Gleichmäßiges Kaufen erzeugt keinen Bruch", c.found === false, `${c.reason}, ${c.changePercent} %`);
}
{
  // Ein einzelner Ausreißer ist kein Strukturbruch
  const rows = Array.from({ length: 20 }, (_, i) => ({ date: day(-(140 - i * 7)), quantity: 1 }));
  rows[10] = { date: day(-(140 - 10 * 7) + 25), quantity: 1 };
  const c = detectChange(rows, T0);
  ok("Ein einzelner Ausreißer gilt nicht als Bruch", c.found === false, `${c.reason}, ${c.changePercent} %`);
}
{
  // Ein frischer Bruch: davor alle 20 Tage, in den letzten Tagen
  // plötzlich täglich. Der Trennpunkt liegt so weit hinten, dass er
  // gefunden wird — aber er ist jünger als die Bestätigungsfrist.
  const rows = [];
  for (let i = 0; i < 9; i++) rows.push({ date: day(-(190 - i * 20)), quantity: 1 });
  for (let i = 0; i < 4; i++) rows.push({ date: day(-(9 - i * 3)), quantity: 1 });
  const c = detectChange(rows, T0);
  ok(`Ein Bruch jünger als ${MIN_AGE_DAYS} Tage wird nicht behauptet`,
    c.found === false, `${c.reason}`);
}
{
  // Vorratskauf: doppelte Menge, doppelter Abstand -> kein Bruch
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push({ date: day(-(200 - i * 7)), quantity: 1 });
  for (let i = 0; i < 8; i++) rows.push({ date: day(-(130 - i * 14)), quantity: 2 });
  const c = detectChange(rows, T0);
  ok("Vorratskauf mit doppelter Menge gilt nicht als Verhaltensänderung",
    c.found === false, `${c.reason}, ${c.changePercent} %`);
}
{
  ok("Ohne Bruch bleibt die Kaufreihe unverändert",
    purchasesSinceChange([{ date: T0 }], { found: false }).length === 1);
  let broke = null;
  for (const junk of [null, undefined, [], [{}], [{ date: "kaputt", quantity: NaN }]]) {
    try {
      const c = detectChange(junk, T0);
      if (typeof c.found !== "boolean") broke = `found ist ${c.found}`;
    } catch (e) { broke = `Absturz: ${e.message}`; }
    if (broke) break;
  }
  ok("Unsinnige Eingaben stürzen nicht ab", broke === null, broke);
}
{
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let broke = null;
  for (let run = 0; run < 1500 && !broke; run++) {
    const n = Math.floor(rnd() * 30);
    const rows = Array.from({ length: n }, (_, i) =>
      ({ date: day(-Math.floor(rnd() * 500)), quantity: 1 + Math.floor(rnd() * 4) }));
    try {
      const c = detectChange(rows, T0);
      if (c.found && (!c.date || !Number.isFinite(c.before) || !Number.isFinite(c.after))) {
        broke = `Lauf ${run}: unvollständiges Ergebnis ${JSON.stringify(c)}`;
      }
      const since = purchasesSinceChange(rows, c);
      if (since.length > rows.length) broke = `Lauf ${run}: mehr Käufe als vorher`;
    } catch (e) { broke = `Lauf ${run}: Absturz ${e.message}`; }
  }
  ok("1500 Zufallsläufe der Brucherkennung bleiben gültig", broke === null, broke);
}

/* ================================================================
   Alle drei zusammen
   ================================================================ */
section("Zusammenspiel");
{
  // Ein Produkt mit Bruch, Saison und Feedback gleichzeitig
  const rows = [];
  for (let d = 700; d >= 0; d -= 1) {
    const date = day(-d);
    const q = Math.floor(new Date(date + "T12:00:00Z").getUTCMonth() / 3);
    const every = d > 300 ? (q === 2 ? 5 : 14) : (q === 2 ? 9 : 25);
    if (d % every === 0) rows.push({ productId: "x", date, quantity: 1 });
  }
  const change = detectChange(rows, T0);
  const relevant = purchasesSinceChange(rows, change);
  let rhythm = computeRhythm(relevant);
  rhythm = applySeason(rhythm, relevant, T0);
  rhythm = applyFeedback(rhythm, feedback(REASON.HAVE, 5), T0, { purchases: relevant });

  ok("Die Kette läuft ohne Fehler durch", Number.isFinite(rhythm.rhythmDays) && rhythm.rhythmDays >= 1,
    rhythm.rhythmDays);
  ok("Jede Stufe bleibt nachvollziehbar",
    !!rhythm.season && !!rhythm.feedback, JSON.stringify({ season: !!rhythm.season, fb: !!rhythm.feedback }));
  ok("Das Vertrauen bleibt gültig", rhythm.confidence >= 0 && rhythm.confidence <= 1, rhythm.confidence);
}
{
  // Reihenfolge: Saison und Feedback dürfen sich nicht gegenseitig
  // aufheben oder verdoppeln
  const purchases = Array.from({ length: 12 }, (_, i) => ({ date: day(-(84 - i * 7)), quantity: 1 }));
  const base = computeRhythm(purchases);
  const onlyFeedback = applyFeedback(base, feedback(REASON.HAVE, 6), T0, { usePurchases: false });
  const bothWays = applyFeedback(applySeason(base, purchases, T0), feedback(REASON.HAVE, 6), T0, { usePurchases: false });
  ok("Ohne Saisonmuster ändert die Saisonstufe nichts",
    onlyFeedback.rhythmDays === bothWays.rhythmDays,
    `${onlyFeedback.rhythmDays} vs ${bothWays.rhythmDays}`);
}


/* ================================================================
   Rückmeldungen, die schon im Rhythmus stecken
   ================================================================
   Der zweite Fall derselben Sorte wie das entfernte implizite Signal:
   dieselbe Tatsache zweimal verrechnen. „Hab noch da“ heißt, dass
   nicht gekauft wurde — sobald danach ein Kauf kommt, ist der dadurch
   längere Abstand in den Daten und der Median hat ihn gesehen.
   ================================================================ */
section("Feedback: nicht zweimal dasselbe zählen");
{
  const log = feedback(REASON.HAVE, 6, { spacing: 4, start: 4 });   // Tag -4 bis -24
  const offen = feedbackAdjustment(log, 10, T0, { lastPurchaseDate: day(-40) });
  const gekauft = feedbackAdjustment(log, 10, T0, { lastPurchaseDate: day(-2) });

  ok("Ohne Kauf danach wirkt die Rückmeldung", offen.adjustedDays > 10, offen.adjustedDays);
  ok("Nach einem Kauf steckt sie im Abstand", gekauft.adjustedDays === 10, gekauft.adjustedDays);
  ok("Und wird als solche ausgewiesen", gekauft.absorbed === 6, gekauft.absorbed);
  ok("Der Grund wird benannt", gekauft.reason === "im_rhythmus_enthalten", gekauft.reason);
}
{
  // Teilweise: was nach dem letzten Kauf kam, zählt weiter.
  const log = feedback(REASON.HAVE, 8, { spacing: 5 });             // Tag 0 bis -35
  const r = feedbackAdjustment(log, 12, T0, { lastPurchaseDate: day(-18) });
  ok("Nur die jüngeren Rückmeldungen zählen", r.signals === 4, `${r.signals} von 8`);
  ok("Die älteren sind verrechnet", r.absorbed === 4, r.absorbed);
  ok("Und die Korrektur greift trotzdem", r.adjustedDays > 12, r.adjustedDays);
}
{
  // „War schon alle“ verhält sich anders: dass etwas VOR dem Kauf leer
  // war, steht in keinem Kaufabstand. Diese Aussage bleibt gültig.
  const log = feedback(REASON.EMPTY, 5, { spacing: 6, start: 6, dueIn: 5 });
  const r = feedbackAdjustment(log, 12, T0, { lastPurchaseDate: day(-1) });
  ok("„War schon alle“ überlebt den nächsten Kauf", r.adjustedDays < 12, r.adjustedDays);
  ok("Es wird nicht als verrechnet gezählt", r.absorbed === 0, r.absorbed);
}
{
  // Ohne bekannten letzten Kauf ändert sich nichts am alten Verhalten.
  const log = feedback(REASON.HAVE, 5);
  const a = feedbackAdjustment(log, 9, T0);
  const b = feedbackAdjustment(log, 9, T0, { lastPurchaseDate: null });
  ok("Ohne Kaufdatum bleibt alles beim Alten", a.adjustedDays === b.adjustedDays && a.adjustedDays > 9);
}
{
  // Der Regelkreis, um den es geht: Nutzer sagt „hab noch“, kauft
  // später, der Abstand wächst — die Korrektur darf dann NICHT
  // obendrauf kommen.
  const rhythmus = { rhythmDays: 10, confidence: 0.8, lastPurchaseDate: day(-2) };
  const spaeterGekauft = applyFeedback(rhythmus, feedback(REASON.HAVE, 5, { start: 5, spacing: 4 }), T0,
    { purchases: [{ date: day(-30) }, { date: day(-2) }] });
  ok("Nach dem Kauf wird nicht nachkorrigiert", spaeterGekauft.rhythmDays === 10, spaeterGekauft.rhythmDays);
  ok("Die Begründung steht am Ergebnis",
    spaeterGekauft.feedback.absorbed === 5, spaeterGekauft.feedback.absorbed);
}

/* ================================================================
   Der Bündel-Effekt: „hab noch“ nach einer Abwesenheit
   ================================================================
   Fällig wird nach Kalendertagen, verbraucht wird an Anwesenheitstagen.
   Nach einem Urlaub sind deshalb schlagartig viele Produkte
   rechnerisch überfällig und treffen auf einen vollen Schrank — der
   Nutzer tippt reihenweise „hab noch da“, und jede dieser Antworten
   verlängert einen Rhythmus, der gar nicht falsch war.

   Der Rhythmus selbst ist über `computeRhythm({absenceDays})` bereits
   abwesenheitsbereinigt. Die Rückmeldung dagegen zu halten, ohne sie
   ebenso zu bereinigen, vergleicht zwei verschiedene Zeitrechnungen.
   ================================================================ */
section("Feedback: Abwesenheit verzerrt die Überfälligkeit");
{
  // Zwölf Tage weg. Das Produkt gilt als 10 Tage überfällig — davon
  // sind zehn Tage Abwesenheit. Ohne die Reise war es nicht fällig.
  const abwesend = () => 12;
  const log = feedback(REASON.HAVE, 5, { spacing: 3, dueIn: -10 });
  const ohne = feedbackAdjustment(log, 14, T0, { lastPurchaseDate: day(-40) });
  const mit = feedbackAdjustment(log, 14, T0, { lastPurchaseDate: day(-40), absenceDays: abwesend });

  ok("Ohne Abwesenheitswissen wird verlängert", ohne.adjustedDays > 14, ohne.adjustedDays);
  ok("Mit Abwesenheitswissen bleibt der Rhythmus stehen", mit.adjustedDays === 14, mit.adjustedDays);
  ok("Die neutralisierten Rückmeldungen werden ausgewiesen",
    mit.absenceNeutral === 5, mit.absenceNeutral);
}
{
  // Teilweise: vier Tage weg, aber acht Tage überfällig. Da bleibt
  // eine echte Überfälligkeit übrig — die Rückmeldung zählt weiter,
  // nur schwächer. (Langer Rhythmus, damit die Deckelung bei ±40 %
  // den Unterschied nicht verschluckt.)
  const log = feedback(REASON.HAVE, 5, { spacing: 3, dueIn: -8 });
  const ohne = feedbackAdjustment(log, 60, T0, { lastPurchaseDate: day(-40) });
  const mit = feedbackAdjustment(log, 60, T0,
    { lastPurchaseDate: day(-40), absenceDays: () => 4 });

  ok("Die Korrektur greift weiterhin", mit.adjustedDays > 60, mit.adjustedDays);
  ok("Aber schwächer als ohne Abwesenheitswissen",
    mit.adjustedDays < ohne.adjustedDays, `${mit.adjustedDays} vs ${ohne.adjustedDays}`);
}
{
  // „War schon alle“ wird NICHT entschärft: wer weg war und trotzdem
  // nichts mehr hat, liefert das stärkere Signal, nicht das schwächere.
  const log = feedback(REASON.EMPTY, 5, { spacing: 3, dueIn: 8 });
  const ohne = feedbackAdjustment(log, 20, T0, { lastPurchaseDate: day(-40) });
  const mit = feedbackAdjustment(log, 20, T0,
    { lastPurchaseDate: day(-40), absenceDays: () => 30 });
  ok("„War schon alle“ bleibt unangetastet", mit.adjustedDays === ohne.adjustedDays,
    `${mit.adjustedDays} vs ${ohne.adjustedDays}`);
  ok("Und wird nicht als abwesenheitsbedingt gezählt", mit.absenceNeutral === 0, mit.absenceNeutral);
}
{
  // Ohne Abwesenheit ändert die neue Rechnung nichts am alten Verhalten.
  const log = feedback(REASON.HAVE, 5, { spacing: 3, dueIn: -4 });
  const alt = feedbackAdjustment(log, 12, T0, { lastPurchaseDate: day(-40) });
  const neu = feedbackAdjustment(log, 12, T0,
    { lastPurchaseDate: day(-40), absenceDays: () => 0 });
  ok("Ohne Reise bleibt alles beim Alten",
    alt.adjustedDays === neu.adjustedDays && alt.adjustedDays > 12, alt.adjustedDays);
  ok("Und nichts wird neutralisiert", neu.absenceNeutral === 0, neu.absenceNeutral);
}
{
  // Der Zeitraum, über den gefragt wird, ist „letzter Kauf bis
  // Rückmeldung“ — nicht irgendein Fenster. Abwesenheiten davor sind
  // im Kaufabstand schon berücksichtigt.
  const gefragt = [];
  const log = [{ productId: "x", date: day(-5), reason: REASON.HAVE, dueIn: -9 }];
  feedbackAdjustment(log, 14, T0, {
    lastPurchaseDate: day(-30),
    absenceDays: (von, bis) => { gefragt.push([von, bis]); return 0; }
  });
  ok("Gefragt wird vom letzten Kauf bis zur Rückmeldung",
    gefragt.length === 1 && gefragt[0][0] === day(-30) && gefragt[0][1] === day(-5),
    JSON.stringify(gefragt));
}
{
  // Rückmeldungen VOR dem letzten Kauf sind ohnehin verrechnet — dort
  // darf gar nicht erst nach Abwesenheiten gefragt werden.
  let gefragt = 0;
  const log = feedback(REASON.HAVE, 4, { spacing: 3, start: 10 });
  const r = feedbackAdjustment(log, 12, T0, {
    lastPurchaseDate: day(-1),
    absenceDays: () => { gefragt++; return 20; }
  });
  ok("Verrechnete Rückmeldungen fragen nicht nach Abwesenheit", gefragt === 0, gefragt);
  ok("Sie bleiben schlicht verrechnet", r.absorbed === 4, r.absorbed);
}
{
  // Über applyFeedback durchgereicht — so nutzt data.js es.
  const rhythmus = { rhythmDays: 14, confidence: 0.8, lastPurchaseDate: day(-26) };
  const log = feedback(REASON.HAVE, 5, { spacing: 3, dueIn: -10 });
  const ohne = applyFeedback(rhythmus, log, T0, { purchases: [{ date: day(-26) }] });
  const mit = applyFeedback(rhythmus, log, T0,
    { purchases: [{ date: day(-26) }], absenceDays: () => 12 });
  ok("applyFeedback reicht die Abwesenheit durch",
    ohne.rhythmDays > 14 && mit.rhythmDays === 14, `${ohne.rhythmDays} / ${mit.rhythmDays}`);
  ok("Die Begründung steht am Ergebnis", mit.feedback.absenceNeutral === 5,
    mit.feedback.absenceNeutral);
}
{
  // awayDaysFor selbst: die kleinen Fälle.
  const eintrag = { date: day(-5), reason: REASON.HAVE, dueIn: -9 };
  ok("Ohne Funktion null", awayDaysFor(eintrag, day(-30), undefined) === 0);
  ok("Ohne Kaufdatum null", awayDaysFor(eintrag, null, () => 9) === 0);
  ok("Nur für „hab noch da“",
    awayDaysFor({ ...eintrag, reason: REASON.EMPTY }, day(-30), () => 9) === 0);
  ok("Unsinnige Rückgaben werden verworfen",
    awayDaysFor(eintrag, day(-30), () => NaN) === 0 &&
    awayDaysFor(eintrag, day(-30), () => -3) === 0);
  ok("Sonst der gemeldete Wert", awayDaysFor(eintrag, day(-30), () => 9) === 9);
}


/* ================================================================
   Aufgegebene Produkte
   ================================================================
   Der Median rechnet über abgeschlossene Kaufabstände. Die offene
   Lücke seit dem letzten Kauf taucht in seiner Rechnung nicht auf —
   er kann noch so robust sein, er sieht sie strukturell nicht. Ohne
   eine eigene Prüfung wird ein aufgegebenes Produkt mit jedem Tag
   „überfälliger“ und steht damit immer weiter oben auf der Liste.
   ================================================================ */
section("Aufgegeben statt überfällig");
{
  ok("Im normalen Bereich bleibt alles unverändert",
    abandonFactor(10, 5) === 1 && abandonFactor(10, 20) === 1);
  ok(`Genau an der Zweifelsschwelle (${ABANDON_START}x) noch voll`,
    abandonFactor(10, 10 * ABANDON_START) === 1);
  ok(`Ab dem ${ABANDON_FULL}-fachen ist nichts mehr übrig`,
    abandonFactor(10, 10 * ABANDON_FULL) === 0 && abandonFactor(10, 999) === 0);
  ok("Dazwischen wird es weich weniger",
    abandonFactor(10, 40) > 0 && abandonFactor(10, 40) < 1, abandonFactor(10, 40));
  ok("Und zwar monoton",
    abandonFactor(10, 30) > abandonFactor(10, 40) && abandonFactor(10, 40) > abandonFactor(10, 50));
  ok("Ein kurzer Takt verzeiht weniger Tage als ein langer",
    abandonFactor(3, 15) < abandonFactor(30, 15));

  ok("Unsinn ändert nichts",
    abandonFactor(0, 100) === 1 && abandonFactor(null, 100) === 1 &&
    abandonFactor(10, NaN) === 1 && abandonFactor(10, -5) === 1);
}
{
  const r = { rhythmDays: 10, confidence: 0.8, lastPurchaseDate: day(-45), sampleSize: 12 };
  const unberuehrt = applyAbandon(r, 15);
  ok("Ein überfälliges Produkt behält sein Vertrauen", unberuehrt === r);

  const leiser = applyAbandon(r, 40);
  ok("Ein lange nicht gekauftes verliert Vertrauen", leiser.confidence < 0.8, leiser.confidence);
  ok("Der ursprüngliche Wert bleibt nachvollziehbar", leiser.baseConfidence === 0.8);
  ok("Der Takt selbst wird NICHT verändert", leiser.rhythmDays === 10);
  ok("Die Begründung hängt am Ergebnis",
    !!leiser.abandon && leiser.abandon.multiple === 4 && /nicht gekauft/.test(leiser.abandon.message));

  const weg = applyAbandon(r, 10 * ABANDON_FULL + 10);
  ok("Irgendwann fällt es unter jede Schwelle", weg.confidence === 0, weg.confidence);
  ok("Und sagt das auch", /nicht mehr von einem Rhythmus/.test(weg.abandon.message));

  ok("Ohne Takt passiert nichts", applyAbandon({ confidence: 0.9 }, 500).confidence === 0.9);
  ok("Ohne Rhythmus-Objekt kein Absturz", applyAbandon(null, 500) === null);
}
{
  // Der Regelkreis, um den es geht: die 0,4er-Schwelle der Liste
  // muss irgendwann greifen, sonst bleibt das Produkt für immer.
  const r = { rhythmDays: 7, confidence: 0.75 };
  const tage = [];
  for (let d = 7; d <= 7 * ABANDON_FULL; d += 7) tage.push(applyAbandon(r, d).confidence);
  ok("Ein aufgegebenes Produkt fällt unter die Listenschwelle von 0,4",
    tage[tage.length - 1] < 0.4, tage.join(" "));
  ok("Aber nicht schon nach zwei Takten", applyAbandon(r, 14).confidence >= 0.4);
}

/* ================================================================
   Strukturbruch: wie viel Neues er braucht
   ================================================================ */
section("Strukturbruch braucht bestätigtes Neues");
{
  // 40 gleichmässige Abstände, dann drei kurze. Drei Abstände sind
  // kein neues Verhalten, sondern drei Abstände.
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ date: day(-(400 - i * 9)), quantity: 1 });
  for (let i = 0; i < 3; i++) rows.push({ date: day(-(9 - i * 3)), quantity: 1 });
  const c = detectChange(rows, T0);
  ok("Drei frische Abstände verwerfen nicht vierzig alte", c.found === false, c.reason);
  ok("Die ganze Historie bleibt erhalten",
    purchasesSinceChange(rows, c).length === rows.length);
}
{
  // Dasselbe Muster, aber das Neue hat lange genug angehalten.
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ date: day(-(520 - i * 9)), quantity: 1 });
  for (let i = 0; i < 12; i++) rows.push({ date: day(-(240 - i * 20)), quantity: 1 });
  const c = detectChange(rows, T0);
  ok("Zwölf Abstände über Monate schon", c.found === true, `${c.reason} ${c.changePercent} %`);
  ok("Und dann wird die Historie auch gekürzt",
    purchasesSinceChange(rows, c).length < rows.length);
}
{
  ok(`Ein Bruch braucht mindestens ${MIN_AFTER_SIDE} neue Abstände`, MIN_AFTER_SIDE >= 6);
  ok(`... und mindestens ${MIN_AFTER_CYCLES} neue Takte Zeit`, MIN_AFTER_CYCLES >= 2);
}

/* ================================================================
   Saison: Abwesenheiten verfälschen die Jahreszeit
   ================================================================ */
section("Saison rechnet Abwesenheiten heraus");
{
  /* Ein Sommerprodukt: von Mai bis September doppelt so oft gekauft
     wie sonst. Mitten in der Hochsaison zwei Wochen Urlaub. Ohne
     Bereinigung sinkt die Rate „Käufe je Tag“ im Sommerquartal, und
     der Sommer sieht aus wie die ruhige Jahreszeit. */
  const kaeufe = [];
  const start = new Date("2024-01-01T12:00:00Z").getTime();
  for (let t = 0; t < 730; t++) {
    const d = new Date(start + t * 86400000);
    const m = d.getUTCMonth();
    const sommer = m >= 5 && m <= 7;          // Juni bis August
    const jeder = sommer ? 4 : 12;
    if (t % jeder === 0) kaeufe.push({ date: d.toISOString().slice(0, 10), quantity: 1 });
  }
  const heute = "2025-12-31";
  // Urlaub jeweils im Juli
  const urlaube = [{ from: "2024-07-05", to: "2024-07-25" }, { from: "2025-07-05", to: "2025-07-25" }];
  const ohne = seasonalFactor(kaeufe.filter((k) =>
    !urlaube.some((u) => k.date >= u.from && k.date <= u.to)), heute);
  const mit = seasonalFactor(kaeufe.filter((k) =>
    !urlaube.some((u) => k.date >= u.from && k.date <= u.to)), heute, { absences: urlaube });

  const hoch = (s) => s.byQuarter.map((q) => q.ratePerDay || 0)
    .indexOf(Math.max(...s.byQuarter.map((q) => q.ratePerDay || 0)));
  ok("Mit Abwesenheitswissen liegt das Hoch im Sommerquartal", hoch(mit) === 2,
    `Q${hoch(mit)} statt Q2`);
  ok("Die Sommerrate steigt durch die Bereinigung",
    mit.byQuarter[2].ratePerDay > ohne.byQuarter[2].ratePerDay,
    `${mit.byQuarter[2].ratePerDay} > ${ohne.byQuarter[2].ratePerDay}`);
  ok("Die beobachteten Tage im Sommer sind weniger geworden",
    mit.byQuarter[2].observedDays < ohne.byQuarter[2].observedDays,
    `${mit.byQuarter[2].observedDays} < ${ohne.byQuarter[2].observedDays}`);
  ok("Quartale ohne Urlaub bleiben unberührt",
    mit.byQuarter[0].observedDays === ohne.byQuarter[0].observedDays);
  ok("Ohne Angabe verhält sich alles wie bisher",
    JSON.stringify(seasonalFactor(kaeufe, heute)) === JSON.stringify(seasonalFactor(kaeufe, heute, {})));
}

/* ================================================================
   Vorratsschätzung: Reste gehen nicht verloren
   ================================================================ */
section("Bestand: Reste aus früheren Käufen");
{
  const { estimateRemaining } = require("../src/algo/inventoryEstimator");
  const pid = "milch_vollmilch";
  const rhythm = { perUnitDays: 6, confidence: 0.8 };
  // Alle 4 Tage eine Packung gekauft, obwohl eine 6 Tage reicht --
  // es sammelt sich etwas an.
  const rows = [];
  for (let i = 10; i >= 0; i--) rows.push({ productId: pid, date: day(-i * 4), quantity: 1, unitPrice: 1.19 });
  const letzter = rows[rows.length - 1];

  const ohne = estimateRemaining(pid, letzter, rhythm, T0);
  const mit = estimateRemaining(pid, letzter, rhythm, T0, { rows });
  ok("Ohne Übertrag zählt nur der letzte Kauf", ohne.remainingUnits <= 1, ohne.remainingUnits);
  ok("Mit Übertrag ist mehr da", mit.remainingUnits > ohne.remainingUnits,
    `${mit.remainingUnits} > ${ohne.remainingUnits}`);
  ok("Aber nicht beliebig viel — der Übertrag ist gedeckelt",
    mit.remainingUnits <= 2.01, mit.remainingUnits);

  // Eine Nutzerkorrektur schlägt den Übertrag: wer sagt „ist leer“,
  // hat recht, egal was die Rechnung meint.
  const korrigiert = estimateRemaining(pid, letzter, rhythm, T0, {
    rows, corrections: { [pid]: { date: T0, remainingUnits: 0 } }
  });
  ok("„Ist leer“ schlägt den Übertrag", korrigiert.remainingUnits === 0, korrigiert.remainingUnits);
}

/* ================================================================
   Vorlauf als Anteil des Zyklus
   ================================================================ */
section("Vorausschau");
{
  ok("Bei langem Rhythmus bleibt die Einstellung stehen",
    effectiveLookahead(30, 3) === 3, effectiveLookahead(30, 3));
  ok("Bei kurzem Rhythmus wird sie beschnitten",
    effectiveLookahead(4, 3) === 1, effectiveLookahead(4, 3));
  ok("Ein Zwei-Tage-Rhythmus bekommt gar keinen Vorlauf",
    effectiveLookahead(2, 3) === 0, effectiveLookahead(2, 3));
  ok("Nie mehr als die Einstellung",
    effectiveLookahead(100, 2) === 2, effectiveLookahead(100, 2));
  ok("Ohne Rhythmus gilt die Einstellung",
    effectiveLookahead(null, 3) === 3);
  ok("Der Anteil bleibt unter der Hälfte des Zyklus",
    [3, 5, 7, 10, 14, 21, 30, 60].every((r) => effectiveLookahead(r, 99) < r / 2));
  ok("Nie negativ", [1, 2, 3].every((r) => effectiveLookahead(r, 5) >= 0));
}

/* ================================================================
   Abwesenheit
   ================================================================ */
section("Abwesenheit");
{
  // Zweimal die Woche einkaufen, dann zwei Wochen weg.
  const bons = [];
  for (let d = 90; d >= 40; d -= 4) bons.push({ date: day(-d) });
  for (let d = 12; d >= 0; d -= 4) bons.push({ date: day(-d) });

  const abw = detectAbsences(bons, T0);
  ok("Die Lücke wird erkannt", abw.length === 1, abw.length);
  // Die Lücke liegt zwischen dem letzten Bon der ersten Reihe und dem
  // ersten der zweiten — die Bontage selbst gehören nicht dazu.
  ok("Sie liegt zwischen den beiden Reihen", abw[0].from > day(-43) && abw[0].to < day(-11),
    `${abw[0] && abw[0].from}–${abw[0] && abw[0].to}`);
  ok("Gezählt wird nur, was über den üblichen Abstand hinausgeht",
    abw[0].days < abw[0].gap, `${abw[0].days} von ${abw[0].gap}`);

  ok("Ohne genug Bons keine Behauptung", detectAbsences(bons.slice(0, 4), T0).length === 0);
  ok("Regelmäßige Einkäufe ergeben keine Abwesenheit",
    detectAbsences(bons.slice(0, 13), day(-40)).length === 0);
}
{
  const abw = [{ from: day(-20), to: day(-10) }];
  ok("Überschneidung wird gezählt", absenceDaysBetween(abw, day(-30), T0) === 10);
  ok("Teilüberschneidung anteilig", absenceDaysBetween(abw, day(-15), T0) === 5);
  ok("Keine Überschneidung, keine Tage", absenceDaysBetween(abw, day(-5), T0) === 0);
  ok("Ohne Abwesenheit null", absenceDaysBetween([], day(-30), T0) === 0);

  // Überlappende Zeiträume dürfen nicht doppelt zählen — sonst könnte
  // ein Abstand rechnerisch negativ werden.
  const doppelt = [{ from: day(-20), to: day(-10) }, { from: day(-15), to: day(-5) }];
  ok("Überlappungen zählen einfach", absenceDaysBetween(doppelt, day(-30), T0) === 15,
    absenceDaysBetween(doppelt, day(-30), T0));
}
{
  // Der Kern: ein Abstand mit Urlaub darin ist kürzer, als er aussieht.
  const kaeufe = [
    { date: day(-60), quantity: 1 }, { date: day(-50), quantity: 1 },
    { date: day(-40), quantity: 1 }, { date: day(-16), quantity: 1 },
    { date: day(-6), quantity: 1 }
  ];
  const ohne = computeRhythm(kaeufe);
  const mit = computeRhythm(kaeufe, {
    absenceDays: (from, to) => absenceDaysBetween([{ from: day(-36), to: day(-22) }], from, to)
  });
  ok("Ohne Korrektur zieht der Urlaub den Rhythmus hoch",
    ohne.rhythmDays >= 10, ohne.rhythmDays);
  ok("Mit Korrektur bleibt er beim wahren Takt",
    mit.rhythmDays === 10, mit.rhythmDays);
  ok("Die Korrektur wird gezählt", mit.absenceCorrected === 1, mit.absenceCorrected);
  ok("Ein Abstand bleibt immer mindestens ein Tag",
    computeRhythm(kaeufe, { absenceDays: () => 9999 }).rhythmDays >= 1);
}
{
  const bekannt = knownAbsence({ from: day(-20), to: day(-8) }, T0);
  ok("Der Urlaubsmodus liefert einen Zeitraum", bekannt.length === 1);
  ok("Ein Wochenende ist keine Abwesenheit",
    knownAbsence({ from: day(-10), to: day(-8) }, T0).length === 0);
  ok("Ohne Daten kein Zeitraum", knownAbsence({}, T0).length === 0 && knownAbsence(null, T0).length === 0);
  ok("Ein Urlaub in der Zukunft wird bis heute beschnitten",
    knownAbsence({ from: day(-20), to: day(30) }, T0)[0].to === T0);
}

console.log("\n" + "=".repeat(60));
console.log(`LERNEN: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
