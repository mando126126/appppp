/**
 * referral.js — Tests für Einladungen, Prämie, Punktekonto
 * ================================================================
 * Dieselbe Zweiteilung wie test/schwarm.js, aus demselben Grund:
 * bevor irgendetwas dieser Infrastruktur live gehen darf, muss
 * belegt sein, dass sie heute STILL bleibt.
 *
 *   A) Ein Einladungscode hat eine geprüfte Form
 *   B) Die Prämie rechnet richtig — auch bei mehreren Einladungen
 *   C) Das Punktekonto ist ein Protokoll, keine blanke Zahl
 *   D) accountClient.js sendet unter KEINER Kombination etwas,
 *      solange keine Gegenstelle eingetragen ist — die Garantie,
 *      die „kein Server" heute noch wahr macht, trotz der neuen Datei
 * ================================================================
 */

const {
  generateReferralCode, isValidCodeFormat, normalizeCode, addMonths,
  applyReferralReward, premiumStatus, addScorePoints, scoreTotal,
  CODE_ALPHABET, CODE_LENGTH, PREMIUM_MONTHS_PER_REFERRAL
} = require("../src/algo/referralSystem");
const {
  ACCOUNT_ENDPOINT, accountConfigured, attemptRedeem, attemptFetchLeaderboard, attemptSyncScore
} = require("../src/algo/accountClient");

let pass = 0, fail = 0;
const problems = [];
function t(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) { pass++; return; }
    fail++; problems.push(`${name}: ${result}`);
    console.log(`  FEHL  ${name}\n        ${result}`);
  } catch (e) {
    fail++; problems.push(`${name}: ABSTURZ ${e.message}`);
    console.log(`  ABSTURZ ${name}\n        ${e.message}`);
  }
}
const section = (s) => console.log(`\n--- ${s} ---`);

/* Ein fester, wiederholbarer "Zufalls"-Generator -- derselbe Griff
   wie überall in diesem Projekt, wo Zufall geprüft werden muss: eine
   Folge, deren nächster Wert im Voraus bekannt ist. */
function festeFolge(werte) {
  let i = 0;
  return () => werte[i++ % werte.length];
}

// ================================================================
section("A: Ein Einladungscode hat eine geprüfte Form");

t("Ein erzeugter Code hat die richtige Länge", () => generateReferralCode().length === CODE_LENGTH);
t("Nur Zeichen aus dem erlaubten Alphabet",
  () => [...generateReferralCode()].every((c) => CODE_ALPHABET.includes(c)));
t("Keine verwechselbaren Zeichen im Alphabet (0/O, 1/I/L)",
  () => !/[01OIL]/.test(CODE_ALPHABET));
t("Derselbe Zufallsgenerator erzeugt denselben Code -- deterministisch prüfbar", () =>
  generateReferralCode(festeFolge([0, 0, 0, 0, 0, 0, 0])) ===
  generateReferralCode(festeFolge([0, 0, 0, 0, 0, 0, 0])));
t("Unterschiedliche Folgen erzeugen unterschiedliche Codes", () =>
  generateReferralCode(festeFolge([0])) !== generateReferralCode(festeFolge([0.99])));

t("Ein gültig geformter Code besteht die Formprüfung", () => isValidCodeFormat(generateReferralCode()));
t("Kleinschreibung besteht die Formprüfung ebenfalls",
  () => isValidCodeFormat(generateReferralCode().toLowerCase()) === true);
t("Zu kurz fällt durch", () => isValidCodeFormat("AB3") === false);
t("Zu lang fällt durch", () => isValidCodeFormat(generateReferralCode() + "X") === false);
t("Verwechselbare Zeichen fallen durch", () => isValidCodeFormat("O1IL2345".slice(0, CODE_LENGTH)) === false);
t("Leerstring fällt durch", () => isValidCodeFormat("") === false);
t("Unsinn-Typen stürzen nicht ab", () => isValidCodeFormat(null) === false && isValidCodeFormat(42) === false &&
  isValidCodeFormat(undefined) === false);

t("normalizeCode trimmt und schreibt groß", () => normalizeCode("  ab3k9zq  ") === "AB3K9ZQ");
t("normalizeCode auf Unsinn liefert leeren String", () => normalizeCode(null) === "" && normalizeCode(123) === "");

// ================================================================
section("B: Die Prämie rechnet richtig");

t(`Eine Einladung verlängert um ${PREMIUM_MONTHS_PER_REFERRAL} Monate`, () =>
  applyReferralReward(null, "2026-01-15").until === addMonths("2026-01-15", PREMIUM_MONTHS_PER_REFERRAL));
t("Die neue Prämie ist aktiv", () => applyReferralReward(null, "2026-01-15").active === true);
t("Die Quelle wird benannt", () => applyReferralReward(null, "2026-01-15").source === "referral");

t("Eine noch laufende Prämie wird VERLÄNGERT, nicht auf heute zurückgesetzt", () => {
  const laufend = { active: true, until: "2026-06-01", source: "referral", months: 3 };
  const r = applyReferralReward(laufend, "2026-01-15");   // heute lange vor dem bisherigen Ende
  return r.until === addMonths("2026-06-01", PREMIUM_MONTHS_PER_REFERRAL)
    ? true : `${r.until} statt ${addMonths("2026-06-01", PREMIUM_MONTHS_PER_REFERRAL)}`;
});
t("Eine bereits abgelaufene Prämie zählt erst wieder AB HEUTE, nicht rückwirkend", () => {
  const abgelaufen = { active: false, until: "2025-01-01", source: "referral", months: 3 };
  const r = applyReferralReward(abgelaufen, "2026-01-15");
  return r.until === addMonths("2026-01-15", PREMIUM_MONTHS_PER_REFERRAL) ? true : r.until;
});
t("Der Monatszähler summiert über mehrere Einladungen, statt stehenzubleiben", () => {
  // Genau der Fehler, der bei falscher Operator-Vorrangregel entsteht:
  // `a || 0 + b` würde als `a || (0 + b)` gelesen und nach der ersten
  // echten Einladung nie wieder wachsen.
  let p = applyReferralReward(null, "2026-01-01");
  p = applyReferralReward(p, "2026-01-02");
  p = applyReferralReward(p, "2026-01-03");
  return p.months === PREMIUM_MONTHS_PER_REFERRAL * 3 ? true : p.months;
});

t("addMonths bleibt im Kalender: 31. Januar + 1 Monat landet im Februar, nicht März",
  () => addMonths("2026-01-31", 1) === "2026-02-28");
t("addMonths im Schaltjahr trifft den 29.", () => addMonths("2024-01-31", 1) === "2024-02-29");
t("addMonths über einen Jahreswechsel", () => addMonths("2026-12-15", 3) === "2027-03-15");

t("premiumStatus: aktiv, wenn das Enddatum noch nicht erreicht ist",
  () => premiumStatus({ until: "2026-06-01", source: "referral" }, "2026-05-01").active === true);
t("premiumStatus: inaktiv, wenn das Enddatum überschritten ist",
  () => premiumStatus({ until: "2026-01-01", source: "referral" }, "2026-06-01").active === false);
t("premiumStatus: am letzten Tag noch aktiv (>= 0 Tage übrig)",
  () => premiumStatus({ until: "2026-06-01", source: "referral" }, "2026-06-01").active === true);
t("premiumStatus zählt die verbleibenden Tage",
  () => premiumStatus({ until: "2026-01-11", source: "referral" }, "2026-01-01").daysLeft === 10);
t("Ohne Prämie ist der Status ehrlich leer", () =>
  JSON.stringify(premiumStatus(null, "2026-01-01")) ===
  JSON.stringify({ active: false, daysLeft: 0, until: null, source: null }));
t("Kaputte Eingaben stürzen nicht ab", () => {
  premiumStatus({}, "2026-01-01"); premiumStatus(undefined, "2026-01-01");
  applyReferralReward({}, "2026-01-01"); applyReferralReward(undefined, "2026-01-01");
  return true;
});

// ================================================================
section("C: Das Punktekonto ist ein Protokoll");

t("Eine Gutschrift hängt sich ans Protokoll", () => addScorePoints([], 10, "test", "2026-01-01").length === 1);
t("Frühere Einträge bleiben erhalten", () =>
  addScorePoints([{ date: "2025-01-01", points: 5, reason: "alt" }], 10, "neu", "2026-01-01").length === 2);
t("Das Original-Protokoll wird nicht verändert (kein Seiteneffekt)", () => {
  const log = [{ date: "2025-01-01", points: 5, reason: "alt" }];
  addScorePoints(log, 10, "neu", "2026-01-01");
  return log.length === 1 ? true : log.length;
});
t("Null Punkte erzeugen keinen Eintrag", () => addScorePoints([], 0, "nichts", "2026-01-01").length === 0);
t("Nicht-numerische Punkte stürzen nicht ab, sondern zählen als 0",
  () => addScorePoints([], "unsinn", "kaputt", "2026-01-01").length === 0);
t("scoreTotal summiert korrekt",
  () => scoreTotal([{ points: 3 }, { points: 7 }, { points: -2 }]) === 8);
t("scoreTotal auf einem leeren/kaputten Protokoll ist 0",
  () => scoreTotal([]) === 0 && scoreTotal(null) === 0 && scoreTotal(undefined) === 0);

// ================================================================
section("D: accountClient.js sendet nichts, solange keine Gegenstelle eingetragen ist");
/* Dieselbe Garantie wie test/schwarm.js Abschnitt F, für das
   Konto/Referral-Modul. Geprüft wird nicht, dass die Funktionen
   funktionieren -- sondern dass sie unter KEINER Eingabe tatsächlich
   etwas senden, solange ACCOUNT_ENDPOINT leer ist. */

t("Keine Gegenstelle eingetragen", () => ACCOUNT_ENDPOINT === null);
t("accountConfigured() sagt das auch so", () => accountConfigured() === false);

t("attemptRedeem lehnt jeden Code ab, auch einen formal gültigen",
  () => attemptRedeem(generateReferralCode()).ok === false);
t("Der Grund wird genannt, nicht nur ein 'nein'", () => {
  const r = attemptRedeem("ABCDEFG");
  return typeof r.reason === "string" && r.reason.length > 0 ? true : r.reason;
});
t("attemptFetchLeaderboard liefert eine leere, ehrliche Liste",
  () => Array.isArray(attemptFetchLeaderboard().einträge) && attemptFetchLeaderboard().einträge.length === 0);
t("attemptFetchLeaderboard meldet ok:false statt erfundener Plätze",
  () => attemptFetchLeaderboard().ok === false);
t("attemptSyncScore sendet das Protokoll nicht wirklich ab",
  () => attemptSyncScore([{ date: "2026-01-01", points: 5, reason: "x" }]).ok === false);
t("Auch mit leerem Protokoll bleibt es bei 'nein'", () => attemptSyncScore([]).ok === false);

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`REFERRAL: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
