/**
 * engagement.js — Tests für Protokoll, Rückblick, Streak, Meilensteine
 *
 * Drei Ebenen wie in learning.js:
 *   1. Einzelfälle — das erwartete Verhalten
 *   2. Invarianten — was NIE passieren darf, egal bei welcher Eingabe
 *   3. Zufallsläufe mit festem Startwert — reproduzierbar, nicht flatterhaft
 *
 * Der wunde Punkt dieser vier Module ist nicht die Rechnung, sondern
 * die Ehrlichkeit: eine Belohnung, die sich doppelt zählen lässt, ist
 * wertlos, und eine Streak-Anzeige, die zu früh „verloren“ meldet,
 * vertreibt genau die Nutzer, für die sie gedacht war. Beides wird
 * hier ausdrücklich geprüft.
 *
 *   node test/engagement.js
 */
const {
  ACTION, normalizeActions, actionsInRange, countByKind, sumEuros,
  pruneActions, receiptSavings, shiftDate, MAX_LEDGER_DAYS, MAX_LEDGER_ENTRIES
} = require("../src/algo/activityLog");
const {
  weeklyStreak, streakDots, isoWeekKey, mondayOf, weekShift, vacationWeeks,
  GRACE_AFTER_WEEKS, GRACE_SPACING
} = require("../src/algo/streakTracker");
const {
  weeklyReview, reviewDue, weekRangeFor, REVIEW_HOUR
} = require("../src/algo/weeklyReview");
const { MILESTONES, milestoneState, newMilestones, badgeKey } = require("../src/algo/milestones");
const { byId } = require("../src/algo/foodDatabase");

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

const TODAY = "2026-08-11";              // ein Dienstag
const day = (offset, from = TODAY) => shiftDate(from, offset);
const act = (offset, kind, opts = {}) =>
  ({ date: day(offset), kind, productId: opts.productId || null, euros: opts.euros || 0 });

/* ================================================================
   1. Ereignis-Protokoll
   ================================================================ */
section("Protokoll");
{
  const raw = [
    { date: "2026-08-01", kind: ACTION.ERFASST, euros: 12.5 },
    { date: "kaputt", kind: ACTION.ERFASST },
    { date: "2026-08-02", kind: "erfundene_art" },
    null,
    { date: "2026-07-30", kind: ACTION.GERETTET, productId: "salat_kopf", euros: -3 }
  ];
  const norm = normalizeActions(raw);
  ok("Kaputte Einträge fliegen raus", norm.length === 2, norm.length);
  ok("Unbekannte Arten fliegen raus", !norm.some((a) => a.kind === "erfundene_art"));
  ok("Ergebnis ist chronologisch", norm[0].date <= norm[1].date);
  ok("Negative Beträge werden auf null gesetzt", norm[0].euros === 0, norm[0].euros);
  ok("Ein einzelner Schrotteintrag reißt nichts mit", Array.isArray(norm));
}
{
  ok("Nicht-Listen ergeben eine leere Liste", normalizeActions(null).length === 0);
  ok("Auch bei einem String", normalizeActions("hallo").length === 0);
  ok("Zählung nennt alle Arten, auch die mit null",
    Object.keys(countByKind([])).length === Object.keys(ACTION).length);
}
{
  const list = [act(-1, ACTION.GERETTET, { euros: 2 }), act(-10, ACTION.GERETTET, { euros: 3 }), act(-1, ACTION.ERFASST, { euros: 40 })];
  ok("Zeitraum schneidet richtig", actionsInRange(list, day(-3), TODAY).length === 2);
  ok("Grenzen sind eingeschlossen", actionsInRange(list, day(-10), day(-10)).length === 1);
  ok("Summe je Art", sumEuros(list, ACTION.GERETTET) === 5, sumEuros(list, ACTION.GERETTET));
  ok("Summe ohne Art ist die Gesamtsumme", sumEuros(list) === 45, sumEuros(list));
}
{
  const alt = [act(-MAX_LEDGER_DAYS - 5, ACTION.ERFASST), act(-3, ACTION.ERFASST)];
  const kept = pruneActions(alt, TODAY);
  ok("Zu Altes wird gekürzt", kept.length === 1 && kept[0].date === day(-3));

  const many = [];
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 300; i++) many.push(act(-(i % 300), ACTION.ERFASST));
  const capped = pruneActions(many, TODAY);
  ok("Das Protokoll bleibt begrenzt", capped.length === MAX_LEDGER_ENTRIES, capped.length);
  ok("Und behält die jüngsten Einträge", capped[capped.length - 1].date === TODAY);
}

/* --- Realisierte Ersparnis ------------------------------------- */
section("Ersparnis aus dem Bon");
{
  const history = [
    { productId: "butter", date: day(-40), quantity: 1, unitPrice: 2.4 },
    { productId: "butter", date: day(-30), quantity: 1, unitPrice: 2.5 },
    { productId: "butter", date: day(-20), quantity: 1, unitPrice: 2.6 }
  ];
  const cheap = receiptSavings([{ productId: "butter", quantity: 2, unitPrice: 1.99 }], history);
  ok("Günstiger Kauf wird erkannt", cheap.length === 1);
  ok("Betrag rechnet die Menge mit", cheap[0].euros === Math.round((2.5 - 1.99) * 2 * 100) / 100, cheap[0] && cheap[0].euros);
  ok("Bezug ist der eigene Medianpreis", cheap[0].usual === 2.5, cheap[0] && cheap[0].usual);

  ok("Üblicher Preis ist keine Ersparnis",
    receiptSavings([{ productId: "butter", quantity: 1, unitPrice: 2.48 }], history).length === 0);
  ok("Teurer Kauf ist keine Ersparnis",
    receiptSavings([{ productId: "butter", quantity: 1, unitPrice: 3.2 }], history).length === 0);
  ok("Ohne Historie keine Behauptung",
    receiptSavings([{ productId: "butter", quantity: 1, unitPrice: 0.5 }], []).length === 0);
  ok("Zwei Datenpunkte reichen nicht",
    receiptSavings([{ productId: "butter", quantity: 1, unitPrice: 0.5 }], history.slice(0, 2)).length === 0);
  ok("Zeilen ohne Produkt werden übersprungen",
    receiptSavings([{ productId: null, quantity: 1, unitPrice: 1 }], history).length === 0);
  ok("Preis null erzeugt keine Ersparnis",
    receiptSavings([{ productId: "butter", quantity: 1, unitPrice: 0 }], history).length === 0);
}
{
  // Der Bezug muss die Historie VOR dem Kauf sein. Nähme man die
  // Historie samt neuer Zeile, zöge der günstige Kauf den Median
  // selbst nach unten und die Ersparnis fiele zu klein aus.
  const history = [
    { productId: "kaffee", date: day(-40), quantity: 1, unitPrice: 5 },
    { productId: "kaffee", date: day(-30), quantity: 1, unitPrice: 7 },
    { productId: "kaffee", date: day(-20), quantity: 1, unitPrice: 7 }
  ];
  const neu = { productId: "kaffee", quantity: 1, unitPrice: 4 };
  const vorher = receiptSavings([neu], history);
  const mitDrin = receiptSavings([neu], [...history, { ...neu, date: TODAY }]);
  ok("Der neue Kauf verschiebt den Bezugswert nicht",
    vorher[0].euros === 3 && mitDrin[0].euros === 2,
    `${vorher[0].euros} vs ${mitDrin[0].euros}`);
}

/* ================================================================
   2. Streak
   ================================================================ */
section("Streak");
const weekAct = (weeksBack, kind = ACTION.ERFASST) =>
  ({ date: weekShift(TODAY, -weeksBack), kind, productId: null, euros: 0 });

{
  ok("Wochenschlüssel ist ISO", isoWeekKey("2026-01-01") === "2026-W01", isoWeekKey("2026-01-01"));
  ok("Silvester gehört zur ersten Woche des Folgejahres",
    isoWeekKey("2025-12-29") === "2026-W01", isoWeekKey("2025-12-29"));
  ok("Montag wird richtig bestimmt", mondayOf("2026-08-11") === "2026-08-10", mondayOf("2026-08-11"));
  ok("Am Montag selbst bleibt es der Tag", mondayOf("2026-08-10") === "2026-08-10");
}
{
  const s = weeklyStreak([0, 1, 2, 3, 4].map((i) => weekAct(i)), TODAY);
  ok("Fünf Wochen am Stück", s.weeks === 5, s.weeks);
  ok("Diese Woche ist aktiv", s.thisWeekActive === true);
  ok("Keine Kulanz nötig", s.graceUsed === 0);
}
{
  // Der wichtigste Fall: die laufende Woche darf nie abbrechen.
  const s = weeklyStreak([1, 2, 3, 4, 5].map((i) => weekAct(i)), TODAY);
  ok("Eine leere laufende Woche beendet nichts", s.weeks === 5, s.weeks);
  ok("Sie wird aber als offen gemeldet", s.thisWeekActive === false);
  ok("Und die Meldung sagt das auch", /noch offen/.test(s.message), s.message);
  ok("Keine Verlustmeldung, nirgends", !/verloren|verpasst|leider/i.test(s.message), s.message);
}
{
  const s = weeklyStreak([0, 1, 2, 3, 4, 6, 7, 8].map((i) => weekAct(i)), TODAY);
  ok("Eine Lücke nach fünf Wochen wird verziehen", s.weeks === 8, s.weeks);
  ok("Die Kulanz wird ausgewiesen", s.graceUsed === 1, s.graceUsed);
}
{
  const s = weeklyStreak([0, 1, 3, 4, 5].map((i) => weekAct(i)), TODAY);
  ok(`Vor ${GRACE_AFTER_WEEKS} Wochen gibt es keine Kulanz`, s.weeks === 2, s.weeks);
}
{
  const s = weeklyStreak([0, 1, 2, 3, 4, 6, 8, 9, 10].map((i) => weekAct(i)), TODAY);
  ok(`Höchstens eine Kulanz je ${GRACE_SPACING} Wochen`, s.weeks === 6 && s.graceUsed === 1,
    `${s.weeks}/${s.graceUsed}`);
}
{
  const s = weeklyStreak([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => weekAct(i)), TODAY);
  ok("Ein lückenloser Streak verbraucht keine Kulanz", s.graceUsed === 0, s.graceUsed);
}
{
  const s = weeklyStreak([], TODAY);
  ok("Ohne Ereignisse steht der Zähler bei null", s.weeks === 0);
  ok("Und die Meldung lädt ein, statt zu tadeln", /fängt der Zähler an/.test(s.message), s.message);
  ok("Auch der Rekord ist null", s.longest === 0);
}
{
  // Urlaub: die App weiß, dass bewusst nicht eingekauft wurde.
  const vacation = { active: true, from: weekShift(TODAY, -2), to: weekShift(TODAY, -1) };
  const ohne = weeklyStreak([0, 3, 4, 5].map((i) => weekAct(i)), TODAY);
  const mit = weeklyStreak([0, 3, 4, 5].map((i) => weekAct(i)), TODAY, { vacation });
  ok("Ohne Urlaub bricht die Lücke den Streak", ohne.weeks === 1, ohne.weeks);
  ok("Urlaubswochen halten den Streak", mit.weeks === 6, mit.weeks);
  ok("Urlaubswochen werden gezählt", vacationWeeks(vacation, TODAY).size === 2, vacationWeeks(vacation, TODAY).size);
  ok("Ohne Datum kein Urlaub", vacationWeeks({ active: true }, TODAY).size === 0);
  ok("Ein Urlaub in der Zukunft zählt nicht rückwirkend",
    vacationWeeks({ active: true, from: weekShift(TODAY, 3), to: weekShift(TODAY, 5) }, TODAY).size === 0);
}
{
  const s = weeklyStreak([0, 1, 2].map((i) => weekAct(i)).concat([20, 21, 22, 23, 24, 25].map((i) => weekAct(i))), TODAY);
  ok("Der Rekord überlebt eine lange Pause", s.longest >= 6, s.longest);
  ok("Der laufende Streak tut das nicht", s.weeks === 3, s.weeks);
}
{
  const dots = streakDots([0, 2].map((i) => weekAct(i)), TODAY, 8);
  ok("Punktereihe hat die verlangte Länge", dots.length === 8);
  ok("Die letzte ist die laufende Woche", dots[7].current === true && dots[7].held === true);
  ok("Reihenfolge ist alt nach neu", dots[0].week < dots[7].week);
}

/* ================================================================
   3. Wochenrückblick
   ================================================================ */
section("Rückblick");
{
  const sonntag = "2026-08-09", montag = "2026-08-10", mittwoch = "2026-08-12";
  ok("Sonntagmittag noch nicht fällig", reviewDue(sonntag, REVIEW_HOUR - 1) === null);
  ok("Sonntagabend fällig", reviewDue(sonntag, REVIEW_HOUR) !== null);
  ok("Montag nachholbar", reviewDue(montag, 9) !== null);
  ok("Dienstag auch", reviewDue("2026-08-11", 9) !== null);
  ok("Mittwoch nicht mehr", reviewDue(mittwoch, 20) === null);
  ok("Sonntagabend und Montag meinen dieselbe Woche",
    reviewDue(sonntag, 20).weekKey === reviewDue(montag, 9).weekKey,
    `${reviewDue(sonntag, 20).weekKey} / ${reviewDue(montag, 9).weekKey}`);
  ok("Und die ist abgeschlossen", reviewDue(montag, 9).complete === true);
}
{
  const r = weekRangeFor("2026-01-01", -1);
  ok("Vorwoche über den Jahreswechsel", r.from === "2025-12-22" && r.to === "2025-12-28", `${r.from}–${r.to}`);
  ok("Und trägt den Vorjahresschlüssel", r.weekKey === "2025-W52", r.weekKey);
  const cur = weekRangeFor(TODAY, 0);
  ok("Die laufende Woche endet heute", cur.to === TODAY);
  ok("Sie ist unter der Woche nicht abgeschlossen", cur.complete === false);
}
{
  const range = weekRangeFor(TODAY, 0);
  const actions = [
    { date: day(-1), kind: ACTION.GERETTET, productId: "salat_kopf", euros: 1.4 },
    { date: day(0), kind: ACTION.GERETTET, productId: "haehnchen", euros: 2.8 },
    { date: day(0), kind: ACTION.GUENSTIG, productId: "butter", euros: 0.8 },
    { date: day(-1), kind: ACTION.GETAUSCHT, productId: "zahnbuerste", euros: 0 },
    { date: day(-1), kind: ACTION.RUECKMELDUNG, productId: "milch_vollmilch", euros: 0 },
    { date: day(-40), kind: ACTION.GERETTET, productId: "tomaten", euros: 9 }
  ];
  const receipts = [{ date: day(-1), total: 42.3 }, { date: day(-40), total: 30 }];
  const rv = weeklyReview({ actions, receipts }, range);

  ok("Nur der Zeitraum zählt", rv.rescued.count === 2, rv.rescued.count);
  ok("Gerettete Beträge werden summiert", rv.rescued.euros === 4.2, rv.rescued.euros);
  ok("Realisierte Ersparnis getrennt", rv.cheaper.euros === 0.8, rv.cheaper.euros);
  ok("Austausch wird benannt", rv.swaps.names[0] === byId("zahnbuerste").name, rv.swaps.names[0]);
  ok("Ausgaben nur aus diesem Zeitraum", rv.spend === 42.3, rv.spend);
  ok("Es gibt eine Überschrift", typeof rv.headline === "string" && rv.headline.length > 0);
  ok("Und eine Einzeiler-Fassung für die Meldung", rv.short.length > 0 && !/\n/.test(rv.short));
  ok("Die Rettungszeile ist als Schätzung markiert",
    rv.lines.find((l) => l.key === "gerettet").estimated === true);
  ok("Die Preiszeile ist es nicht",
    rv.lines.find((l) => l.key === "guenstig").estimated === false);
  ok("Geschätzt und gemessen werden nie addiert",
    !rv.lines.some((l) => l.value && l.value.includes(String(rv.rescued.euros + rv.cheaper.euros))));
}
{
  const rv = weeklyReview({ actions: [], receipts: [] }, weekRangeFor(TODAY, 0));
  ok("Leere Woche hat keine Zeilen", rv.lines.length === 0 && rv.quiet === true);
  ok("Und wird nicht getadelt", !/leider|solltest|verpasst/i.test(rv.headline), rv.headline);
  ok("Sondern schlicht festgestellt", /Ruhige Woche/.test(rv.headline), rv.headline);
}
{
  // Zeilen ohne Inhalt dürfen nicht erscheinen — ein Rückblick, der
  // immer gleich lang ist, wird nicht gelesen.
  const rv = weeklyReview(
    { actions: [{ date: day(0), kind: ACTION.GETAUSCHT, productId: "zahnbuerste", euros: 0 }], receipts: [] },
    weekRangeFor(TODAY, 0));
  ok("Nur Zeilen mit Inhalt", rv.lines.length === 1 && rv.lines[0].key === "getauscht",
    rv.lines.map((l) => l.key).join(","));
  ok("Keine Nullzeilen", !rv.lines.some((l) => /^0/.test(l.value || "")));
}
{
  // Vergleich mit den eigenen Wochen, nicht mit einem Fremdhaushalt.
  const receipts = [];
  for (let w = 1; w <= 8; w++) receipts.push({ date: weekShift(TODAY, -w), total: 50 });
  receipts.push({ date: day(0), total: 30 });
  const rv = weeklyReview({ actions: [], receipts }, weekRangeFor(TODAY, 0));
  ok("Vergleich entsteht ab genug Wochen", rv.comparison !== null);
  ok("Der Bezug ist der eigene Median", rv.comparison.median === 50, rv.comparison && rv.comparison.median);
  ok("Weniger als sonst wird als solches benannt", /unter deinem Schnitt/.test(rv.comparison.text), rv.comparison.text);

  const knapp = weeklyReview({ actions: [], receipts: receipts.slice(-3) }, weekRangeFor(TODAY, 0));
  ok("Ohne genug Wochen kein Vergleich", knapp.comparison === null);
}

/* ================================================================
   4. Meilensteine
   ================================================================ */
section("Meilensteine");
{
  const m = milestoneState({ gerettet: 12, guenstig: 33.4, getauscht: 0, erfasst: 60, wochen: 5 });
  const ger = m.rows.find((r) => r.id === "gerettet");
  ok("Erreichte Stufen werden gezählt", ger.level === 2, ger.level);
  ok("Die aktuelle Stufe ist die höchste erreichte", ger.current === 10, ger.current);
  ok("Die nächste ist die kleinste offene", ger.next === 25, ger.next);
  ok("Der Abstand stimmt", ger.remaining === 13, ger.remaining);
  ok("Fortschritt liegt zwischen den beiden Stufen",
    ger.progress > 0 && ger.progress < 1, ger.progress);

  const leer = m.rows.find((r) => r.id === "getauscht");
  ok("Ohne Handlungen keine Stufe", leer.level === 0 && leer.current === null);
  ok("Aber ein benanntes Ziel", leer.nextTitle && leer.nextTitle.length > 0);
  ok("Es gibt einen nächstliegenden Meilenstein", m.nextUp !== null);
}
{
  const m = milestoneState({});
  ok("Leere Eingabe stürzt nicht ab", m.rows.length === MILESTONES.length);
  ok("Und erreicht nichts", m.count === 0);
  ok("Fortschritt bleibt endlich", m.rows.every((r) => Number.isFinite(r.progress)));
}
{
  const m = milestoneState({ gerettet: 9999, guenstig: 9999, getauscht: 9999, erfasst: 9999, wochen: 9999 });
  ok("Alles erreicht: keine nächste Stufe", m.rows.every((r) => r.next === null && r.complete));
  ok("Fortschritt ist dann voll", m.rows.every((r) => r.progress === 1));
  ok("Und es gibt nichts mehr vorzuschlagen", m.nextUp === null);
}
{
  const m = milestoneState({ gerettet: -5, guenstig: NaN, erfasst: "viele", wochen: undefined });
  ok("Unsinnige Werte werden auf null gesetzt", m.rows.every((r) => r.value >= 0));
  ok("Keine NaN im Ergebnis", m.rows.every((r) => Number.isFinite(r.value) && Number.isFinite(r.progress)));
}
{
  const m = milestoneState({ gerettet: 12 });
  const alle = newMilestones(m, []);
  ok("Ohne Vorwissen sind alle erreichten neu", alle.length === m.count, `${alle.length}/${m.count}`);
  ok("Die höchste Stufe steht vorn", alle[0].threshold >= alle[alle.length - 1].threshold);
  ok("Mit vollem Vorwissen ist nichts neu", newMilestones(m, m.reachedKeys).length === 0);

  const teil = newMilestones(m, [badgeKey("gerettet", 3)]);
  ok("Teilwissen meldet nur den Rest", teil.length === m.count - 1, teil.length);
  ok("Jede Meldung trägt Text und Stufe",
    teil.every((b) => b.title && b.note && b.level >= 1 && b.level <= b.maxLevel));
}
{
  // Kein Zähler darf zurückfallen — eine Auszeichnung, die
  // verschwindet, ist schlimmer als gar keine.
  const a = milestoneState({ gerettet: 25 });
  const b = milestoneState({ gerettet: 25, erfasst: 3 });
  ok("Mehr Handlungen nehmen nichts weg",
    a.reachedKeys.every((k) => b.reachedKeys.includes(k)));
}
{
  const geld = MILESTONES.find((m) => m.id === "guenstig");
  ok("Die Geldreihe ist als Geld gekennzeichnet", geld.euros === true);
  ok("Und sie zählt ausdrücklich Realisiertes", /[Rr]ealisiert/.test(geld.note), geld.note);
  ok("Keine Reihe zählt bloße App-Nutzung",
    !MILESTONES.some((m) => /geöffnet|Öffnungen|Besuche/i.test(m.label + m.note)));
}

/* ================================================================
   5. Invarianten
   ================================================================ */
section("Invarianten");

function checkStreakInvariants(s, label) {
  const problems = [];
  if (!Number.isInteger(s.weeks) || s.weeks < 0) problems.push("weeks=" + s.weeks);
  if (!Number.isInteger(s.longest) || s.longest < s.weeks) problems.push("longest=" + s.longest);
  if (s.graceUsed < 0) problems.push("grace=" + s.graceUsed);
  if (typeof s.message !== "string" || !s.message) problems.push("keine Meldung");
  if (/verloren|verpasst|leider|schade/i.test(s.message)) problems.push("tadelnde Meldung: " + s.message);
  if (s.weekKeys.length > s.weeks) problems.push("mehr Wochenschlüssel als Wochen");
  return problems.length ? `${label}: ${problems.join(", ")}` : null;
}

function checkReviewInvariants(r, label) {
  const problems = [];
  if (r.from > r.to) problems.push("Zeitraum verdreht");
  if (!Number.isFinite(r.spend) || r.spend < 0) problems.push("spend=" + r.spend);
  if (r.rescued.euros < 0 || r.cheaper.euros < 0) problems.push("negative Beträge");
  if (r.quiet && r.lines.length) problems.push("ruhig, aber mit Zeilen");
  if (!r.quiet && !r.lines.length) problems.push("nicht ruhig, aber ohne Zeilen");
  if (typeof r.headline !== "string" || !r.headline) problems.push("keine Überschrift");
  if (r.lines.some((l) => !l.label)) problems.push("Zeile ohne Beschriftung");
  // Die Karte zeigt drei Kacheln — jede Zeile braucht dafür eine
  // kurze Fassung, sonst steht dort ein Loch.
  if (r.lines.some((l) => !l.tile || !l.tile.v || !l.tile.l)) problems.push("Zeile ohne Kachel-Fassung");
  if (r.lines.some((l) => /undefined|NaN/.test(l.tile.v + l.tile.l))) problems.push("Platzhalter in der Kachel");
  if (r.short.includes("undefined") || r.headline.includes("undefined")) problems.push("undefined im Text");
  if (r.headline.includes("NaN") || r.short.includes("NaN")) problems.push("NaN im Text");
  return problems.length ? `${label}: ${problems.join(", ")}` : null;
}

function checkMilestoneInvariants(m, label) {
  const problems = [];
  m.rows.forEach((r) => {
    if (!Number.isFinite(r.value) || r.value < 0) problems.push(r.id + ".value=" + r.value);
    if (!Number.isFinite(r.progress) || r.progress < 0 || r.progress > 1) problems.push(r.id + ".progress=" + r.progress);
    if (r.level < 0 || r.level > r.maxLevel) problems.push(r.id + ".level=" + r.level);
    if (r.next !== null && r.remaining <= 0) problems.push(r.id + ".remaining=" + r.remaining);
    if (r.next === null && !r.complete) problems.push(r.id + " ohne nächste Stufe, aber unvollständig");
    if (r.current !== null && r.value < r.current) problems.push(r.id + " Stufe über dem Wert");
  });
  if (m.count !== m.reachedKeys.length) problems.push("Zählung passt nicht zu den Schlüsseln");
  if (new Set(m.reachedKeys).size !== m.reachedKeys.length) problems.push("doppelte Schlüssel");
  return problems.length ? `${label}: ${problems.join(", ")}` : null;
}

/* ================================================================
   6. Zufallsläufe — fester Startwert, damit sie reproduzierbar sind
   ================================================================ */
section("Zufallsläufe");

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const KINDS = Object.values(ACTION);
const PIDS = ["salat_kopf", "haehnchen", "butter", "zahnbuerste", "milch_vollmilch", "nichtexistent"];

{
  let problems = [];
  const rnd = lcg(20260811);
  for (let run = 0; run < 3000 && problems.length < 4; run++) {
    const n = Math.floor(rnd() * 40);
    const actions = [];
    for (let i = 0; i < n; i++) {
      actions.push({
        date: day(-Math.floor(rnd() * 420)),
        kind: KINDS[Math.floor(rnd() * KINDS.length)],
        productId: PIDS[Math.floor(rnd() * PIDS.length)],
        euros: rnd() < 0.2 ? 0 : Math.round(rnd() * 2000) / 100
      });
    }
    const vac = rnd() < 0.25
      ? { active: true, from: day(-Math.floor(rnd() * 90) - 14), to: day(-Math.floor(rnd() * 14)) }
      : null;
    const s = weeklyStreak(actions, TODAY, { vacation: vac });
    const bad = checkStreakInvariants(s, "Lauf " + run);
    if (bad) problems.push(bad);
  }
  ok("3000 Zufallsläufe: Streak bleibt gültig", problems.length === 0, problems.join(" | "));
}
{
  let problems = [];
  const rnd = lcg(777);
  for (let run = 0; run < 2000 && problems.length < 4; run++) {
    const n = Math.floor(rnd() * 25);
    const actions = [];
    const receipts = [];
    for (let i = 0; i < n; i++) {
      actions.push({
        date: day(-Math.floor(rnd() * 30)),
        kind: KINDS[Math.floor(rnd() * KINDS.length)],
        productId: PIDS[Math.floor(rnd() * PIDS.length)],
        euros: Math.round(rnd() * 900) / 100
      });
      if (rnd() < 0.5) receipts.push({ date: day(-Math.floor(rnd() * 120)), total: Math.round(rnd() * 12000) / 100 });
    }
    const offset = rnd() < 0.5 ? 0 : -1;
    const r = weeklyReview({ actions, receipts }, weekRangeFor(TODAY, offset));
    const bad = checkReviewInvariants(r, "Lauf " + run);
    if (bad) problems.push(bad);
  }
  ok("2000 Zufallsläufe: Rückblick bleibt gültig", problems.length === 0, problems.join(" | "));
}
{
  let problems = [];
  const rnd = lcg(4242);
  for (let run = 0; run < 3000 && problems.length < 4; run++) {
    const totals = {
      gerettet: Math.floor(rnd() * 400) - 20,
      guenstig: Math.round((rnd() * 900 - 40) * 100) / 100,
      getauscht: Math.floor(rnd() * 80),
      erfasst: Math.floor(rnd() * 400),
      wochen: Math.floor(rnd() * 70)
    };
    if (rnd() < 0.1) totals.gerettet = NaN;
    if (rnd() < 0.1) totals.erfasst = "viel";
    const m = milestoneState(totals);
    const bad = checkMilestoneInvariants(m, "Lauf " + run);
    if (bad) { problems.push(bad); continue; }
    // Neue Stufen dürfen nie zurückgehen, wenn der Zähler steigt.
    const mehr = milestoneState({ ...totals, getauscht: (Number(totals.getauscht) || 0) + 5 });
    if (!m.reachedKeys.every((k) => mehr.reachedKeys.includes(k))) problems.push("Lauf " + run + ": Stufe verloren");
  }
  ok("3000 Zufallsläufe: Meilensteine bleiben gültig", problems.length === 0, problems.join(" | "));
}
{
  // Protokoll: was hineingeht, muss unverändert wieder herauskommen,
  // solange es gültig und jung genug ist.
  let problems = [];
  const rnd = lcg(31337);
  for (let run = 0; run < 1500 && problems.length < 4; run++) {
    const list = [];
    for (let i = 0, n = Math.floor(rnd() * 30); i < n; i++) {
      list.push({
        date: day(-Math.floor(rnd() * 200)),
        kind: KINDS[Math.floor(rnd() * KINDS.length)],
        euros: Math.round(rnd() * 500) / 100
      });
    }
    const norm = normalizeActions(list);
    if (norm.length !== list.length) { problems.push("Lauf " + run + ": Einträge verloren"); continue; }
    if (Math.abs(sumEuros(norm) - Math.round(list.reduce((a, x) => a + x.euros, 0) * 100) / 100) > 0.011) {
      problems.push("Lauf " + run + ": Summe verschoben");
      continue;
    }
    const kept = pruneActions(list, TODAY);
    if (kept.length !== list.length) problems.push("Lauf " + run + ": junge Einträge gekürzt");
  }
  ok("1500 Zufallsläufe: Protokoll bleibt vollständig", problems.length === 0, problems.join(" | "));
}

console.log("\n" + "=".repeat(60));
console.log(`RÜCKBLICK: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
