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

const { normalizeActions } = require("./activityLog");

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
 * Wochen, die ganz oder teilweise in einen Urlaub fallen.
 * @returns {Set<string>} Wochenschlüssel
 */
function vacationWeeks(vacation, today) {
  const out = new Set();
  if (!vacation || !vacation.from || !vacation.to) return out;
  const from = vacation.from;
  const to = vacation.to < today ? vacation.to : today;
  if (from > to) return out;
  let cursor = mondayOf(from);
  // Obergrenze gegen eine fehlerhaft weit gesetzte Rückkehr.
  for (let i = 0; i <= MAX_WEEKS_BACK && cursor <= to; i++) {
    out.add(isoWeekKey(cursor));
    cursor = weekShift(cursor, 1);
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

  const vac = vacationWeeks(opts.vacation, today);
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
  const vac = vacationWeeks(opts.vacation, today);
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

module.exports = {
  weeklyStreak, streakDots, isoWeekKey, mondayOf, weekShift, vacationWeeks,
  MAX_WEEKS_BACK, GRACE_AFTER_WEEKS, GRACE_SPACING
};
