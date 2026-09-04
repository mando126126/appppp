/**
 * referralSystem.js — Einladungen, Prämie, Punktekonto: die Rechnung
 * ================================================================
 * Dasselbe Prinzip wie bei schwarmClient.js (siehe docs/schwarm.md):
 * die REINE RECHNUNG lässt sich heute schreiben und prüfen, ganz ohne
 * Server. Was eine echte Einladung, ein echtes Konto und eine echte
 * Bestenliste zusätzlich brauchen — eine Gegenstelle, die eine fremde
 * Installation überhaupt bestätigen kann — ist in accountClient.js
 * absichtlich NICHT gebaut. Siehe docs/referral.md für die volle
 * Begründung und die offene Liste, was vor einem Start noch fehlt.
 *
 * WARUM ES DIESES MODUL TROTZDEM SCHON GIBT
 *
 * Drei Rechnungen sind vollständig serverunabhängig und deshalb heute
 * schon richtig oder falsch, unabhängig davon, ob je ein Server dazu-
 * kommt:
 *
 *   1. Ein Einladungscode hat eine FORM (kurz, eindeutig lesbar,
 *      ohne verwechselbare Zeichen) — das ist Textverarbeitung, kein
 *      Netzwerk.
 *   2. Wenn eine Einladung angerechnet wird, verlängert sich eine
 *      Prämie um eine feste Zeitspanne, gerechnet AB DEM SPÄTEREN von
 *      "heute" und "bisheriges Ende" — das ist Datumsarithmetik.
 *   3. Ein Punktekonto ist eine Summe über ein Protokoll einzelner
 *      Gutschriften — dieselbe Buchhaltung wie überall sonst in
 *      dieser App (siehe activityLog.js).
 *
 * KEINE DIESER FUNKTIONEN GEWÄHRT ETWAS VON SELBST. Sie rechnen nur,
 * WAS gelten würde, WENN ein Ereignis bestätigt wäre. Ob ein
 * Einladungscode wirklich von einer zweiten, echten Installation
 * eingelöst wurde, kann ohne Server niemand wissen — das zu behaupten
 * wäre die Art Selbstbedienung, gegen die eine Gegenstelle überhaupt
 * erst schützt. Deshalb ruft heute NICHTS in der Oberfläche
 * `applyReferralReward` mit einem selbst ausgedachten Ergebnis auf;
 * es wartet auf eine Bestätigung, die es noch nicht geben kann.
 * ================================================================
 */

/* Ohne 0/O, 1/I/L und ähnlich verwechselbare Zeichen -- ein Code, der
   am Telefon vorgelesen oder von Hand abgetippt wird, darf keine
   Zeichen enthalten, bei denen zwei Personen zwei verschiedene Dinge
   hören oder tippen. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;             // z. B. "K7M2QXF"
const PREMIUM_MONTHS_PER_REFERRAL = 3;

/**
 * Einen Einladungscode aus einer Zufallsquelle erzeugen.
 *
 * `rnd` ist austauschbar (Standard: Math.random) -- damit ist die
 * Funktion mit einem festen Generator vollständig deterministisch
 * prüfbar, ohne echten Zufall im Test zu brauchen.
 */
function generateReferralCode(rnd = Math.random) {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Hat ein eingegebener Code überhaupt die richtige FORM?
 *
 * Das ist keine Prüfung, ob der Code existiert oder je vergeben
 * wurde -- das kann nur eine Gegenstelle wissen. Hier geht es nur
 * darum, einen Tippfehler oder einen offensichtlichen Unsinnstext
 * sofort zurückzumelden, statt ihn erst nach einer (heute ohnehin
 * nicht stattfindenden) Anfrage abzulehnen.
 */
function isValidCodeFormat(code) {
  if (typeof code !== "string") return false;
  const c = code.trim().toUpperCase();
  if (c.length !== CODE_LENGTH) return false;
  return [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

/** Eingabe robust auf die kanonische Form bringen -- Leerraum, Kleinschreibung. */
function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

/**
 * Monate zu einem Datum addieren, ohne die üblichen Kalenderfallen
 * (31. Januar + 1 Monat darf nicht in den März rutschen).
 */
function addMonths(dateIso, months) {
  const d = new Date(dateIso + "T12:00:00Z");
  const tag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const letzterTagDesZielmonats = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(tag, letzterTagDesZielmonats));
  return d.toISOString().slice(0, 10);
}

/**
 * Prämie aus EINER bestätigten Einladung verlängern.
 *
 * Gerechnet wird ab dem SPÄTEREN von "heute" und "bisheriges Ende" --
 * eine schon laufende Prämie wird verlängert, keine bereits
 * abgelaufene wird rückwirkend wiederbelebt und dann erst ab heute
 * gezählt. Genau das erwartet jeder, der mehrere Freunde einlädt,
 * bevor die erste Prämie überhaupt ausläuft.
 *
 * @param {{active:boolean, until:string|null, source:string|null, months:number}} premium
 * @param {string} today
 * @returns {object} neue Prämie, das Original bleibt unverändert
 */
function applyReferralReward(premium, today) {
  const bisher = premium && premium.until && premium.until > today ? premium.until : today;
  const until = addMonths(bisher, PREMIUM_MONTHS_PER_REFERRAL);
  return {
    active: true,
    until,
    source: "referral",
    // Klammern nicht kosmetisch: `a || 0 + b` würde wegen der
    // Vorrangregel als `a || (0 + b)` gelesen und bei jeder weiteren
    // Einladung stehenbleiben, statt zu addieren.
    months: ((premium && Number(premium.months)) || 0) + PREMIUM_MONTHS_PER_REFERRAL
  };
}

/**
 * Ob eine Prämie heute gilt, und wie viele Tage noch.
 * Reine Ableitung -- verändert nichts, kann jederzeit neu gerechnet werden.
 */
function premiumStatus(premium, today) {
  if (!premium || !premium.until) return { active: false, daysLeft: 0, until: null, source: null };
  const bis = new Date(premium.until + "T12:00:00Z").getTime();
  const heute = new Date(today + "T12:00:00Z").getTime();
  const tage = Math.round((bis - heute) / 86400000);
  return {
    active: tage >= 0,
    daysLeft: Math.max(0, tage),
    until: premium.until,
    source: premium.source || null
  };
}

/**
 * Punktegutschrift anhängen -- ein Protokoll, keine blanke Zahl.
 *
 * Derselbe Grundsatz wie im Ereignis-Protokoll (data.js,
 * `logAction`): eine Summe, die man nicht mehr herleiten kann, ist
 * eine Behauptung. Die Bestenliste, sobald sie eine Metrik hat, liest
 * aus diesem Protokoll, nicht aus einem mitgeführten Zwischenstand.
 */
function addScorePoints(log, points, reason, today) {
  const p = Math.round(Number(points) || 0);
  if (p === 0) return Array.isArray(log) ? log : [];
  const eintrag = { date: today, points: p, reason: String(reason || "unbekannt") };
  return [...(Array.isArray(log) ? log : []), eintrag];
}

function scoreTotal(log) {
  return (Array.isArray(log) ? log : []).reduce((a, e) => a + (Number(e.points) || 0), 0);
}

module.exports = {
  generateReferralCode, isValidCodeFormat, normalizeCode, addMonths,
  applyReferralReward, premiumStatus, addScorePoints, scoreTotal,
  CODE_ALPHABET, CODE_LENGTH, PREMIUM_MONTHS_PER_REFERRAL
};
