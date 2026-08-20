/**
 * backup.js — Tests für die Sicherung
 * ================================================================
 * Der Datenverlust ist der einzige Fehler dieser App, den niemand
 * bemerkt, bevor es zu spät ist. Ein falscher Rhythmus fällt auf,
 * eine falsche Zahl auch — ein gelöschter Speicher ist einfach weg,
 * und mit ihm drei Jahre Gelerntes.
 *
 * Geprüft wird deshalb in drei Richtungen:
 *
 *   A) Das Urteil: wann ist ein Zustand gefährdet, wann reicht ein
 *      Hinweis, wann muss die App still sein
 *   B) Die Wiederherstellung: welche von zwei Kopien gilt, und was
 *      passiert mit einer kaputten
 *   C) Die Erinnerung: sie muss selten sein, sonst wird sie
 *      weggetippt und fehlt an dem Tag, an dem sie zählt
 * ================================================================
 */

const {
  backupHealth, storageRisk, shouldRemind, validateSnapshot, pickBetter,
  backupFileName, daysBetweenDates,
  LEVEL, CRITICAL_DAYS, MIN_RECEIPTS_TO_CARE, NAG_SPACING_DAYS, WEBKIT_EVICTION_DAYS
} = require("../src/algo/backupGuard");

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

const section = (title) => console.log(`\n--- ${title} ---`);
const HEUTE = "2026-08-13";

/** Ein brauchbarer Stand. */
const stand = (n = 20) => ({
  schema: 1,
  purchases: Array.from({ length: n }, (_, i) => ({
    productId: "milch_vollmilch", date: "2026-08-01", quantity: 1, unitPrice: 1.29
  })),
  receipts: Array.from({ length: Math.ceil(n / 4) }, () => ({ date: "2026-08-01", total: 12 }))
});

// ================================================================
section("A: Wie gefährdet ist dieser Zustand?");

t("Ohne Daten wird nicht gewarnt", () => {
  const h = backupHealth({ receipts: MIN_RECEIPTS_TO_CARE - 1, today: HEUTE });
  return h.level === LEVEL.UNKRITISCH && !h.urgent ? true : JSON.stringify(h);
});

t("Nie gesichert und etwas zu verlieren: dringend", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE });
  if (h.level !== LEVEL.GEFAEHRDET) return h.level;
  return h.urgent && /40 Bons/.test(h.message) ? true : h.message;
});

t("Die Meldung nennt, was auf dem Spiel steht", () => {
  // „Nicht gesichert“ bewegt niemanden. Eine Zahl schon.
  const h = backupHealth({ receipts: 57, today: HEUTE });
  return /57/.test(h.message) ? true : h.message;
});

t("Auf Safari ohne Installation wird die Sieben-Tage-Frist genannt", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE, env: { webkit: true, installed: false } });
  return new RegExp(String(WEBKIT_EVICTION_DAYS)).test(h.message) ? true : h.message;
});

t("Installiert wird sie nicht genannt", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE, env: { webkit: true, installed: true } });
  return !/sieben|7 Tagen/.test(h.message) ? true : h.message;
});

t("Dauerhafter Speicher senkt das Risiko, ersetzt aber keine Datei", () => {
  const r = storageRisk({ persisted: true });
  const h = backupHealth({ receipts: 40, today: HEUTE, env: { persisted: true } });
  if (r.fluechtig) return "dauerhaft gilt als flüchtig";
  return h.level === LEVEL.GEFAEHRDET ? true : `ohne Datei nur ${h.level}`;
});

t("Frisch gesichert ist in Ordnung", () => {
  const h = backupHealth({ receipts: 20, receiptsAtBackup: 20, lastBackupDate: HEUTE, today: HEUTE });
  return h.level === LEVEL.OK && !h.urgent ? true : JSON.stringify(h);
});

t("Alte Sicherung wird zur Warnung", () => {
  const h = backupHealth({ receipts: 60, receiptsAtBackup: 40, lastBackupDate: "2026-06-01", today: HEUTE });
  return h.level === LEVEL.GEFAEHRDET && h.urgent ? true : JSON.stringify(h);
});

t("Alt allein reicht nicht, wenn nichts dazugekommen ist", () => {
  // Wer seit sechs Wochen nicht eingekauft hat, hat auch nichts
  // Neues zu verlieren. Eine Warnung wäre hier nur Lärm.
  const h = backupHealth({ receipts: 40, receiptsAtBackup: 40, lastBackupDate: "2026-07-20", today: HEUTE });
  return h.level === LEVEL.OK ? true : `${h.level}: ${h.message}`;
});

t("Viel Neues allein reicht auch ohne Zeitablauf", () => {
  const h = backupHealth({ receipts: 60, receiptsAtBackup: 39, lastBackupDate: "2026-08-12", today: HEUTE });
  return h.urgent ? true : `${h.level}: ${h.message}`;
});

t("Automatische Datei ist der entspannte Zustand", () => {
  const h = backupHealth({ receipts: 60, receiptsAtBackup: 60, lastBackupDate: HEUTE, today: HEUTE, auto: true });
  return h.level === LEVEL.GESICHERT && !h.urgent ? true : JSON.stringify(h);
});

t("Auch die automatische Datei warnt nicht, wenn sie hinterherhinkt", () => {
  const h = backupHealth({ receipts: 62, receiptsAtBackup: 60, lastBackupDate: HEUTE, today: HEUTE, auto: true });
  return h.level === LEVEL.OK && !h.urgent ? true : JSON.stringify(h);
});

t("Jede Stufe hat Überschrift und Text", () => {
  const faelle = [
    { receipts: 1, today: HEUTE },
    { receipts: 40, today: HEUTE },
    { receipts: 40, receiptsAtBackup: 40, lastBackupDate: HEUTE, today: HEUTE },
    { receipts: 80, receiptsAtBackup: 40, lastBackupDate: "2026-05-01", today: HEUTE },
    { receipts: 40, receiptsAtBackup: 40, lastBackupDate: HEUTE, today: HEUTE, auto: true }
  ];
  for (const f of faelle) {
    const h = backupHealth(f);
    if (!h.title || h.title.length < 5) return `ohne Überschrift: ${JSON.stringify(f)}`;
    if (!h.message || h.message.length < 20) return `ohne Text: ${h.level}`;
    if (!Object.values(LEVEL).includes(h.level)) return `unbekannte Stufe ${h.level}`;
  }
  return true;
});

t("Müll stürzt nicht ab", () => {
  for (const x of [undefined, {}, { receipts: -5 }, { receipts: NaN, today: "kaputt" },
    { receipts: 10, lastBackupDate: "morgen", today: HEUTE }]) {
    const h = backupHealth(x);
    if (!h || !h.level) return `kaputt bei ${JSON.stringify(x)}`;
  }
  return true;
});

// ================================================================
section("B: Welche Kopie gilt");

t("Ein guter Stand wird angenommen", () => {
  const v = validateSnapshot(stand(10), { schema: 1 });
  return v.ok ? true : v.fehler.join(", ");
});

t("Eine falsche Fassung wird abgelehnt", () => {
  const v = validateSnapshot({ ...stand(10), schema: 99 }, { schema: 1 });
  return !v.ok ? true : "angenommen";
});

t("Eine halbe Datei wird abgelehnt", () => {
  // Der eigentliche Fall: die Quote ging mitten im Schreiben aus.
  const halb = { schema: 1, purchases: [{ productId: null, date: null }, { productId: null }], receipts: [] };
  return !validateSnapshot(halb, { schema: 1 }).ok ? true : "angenommen";
});

t("Ein paar kaputte Zeilen sind kein Grund, alles wegzuwerfen", () => {
  const s = stand(20);
  s.purchases[0] = { productId: null };
  s.purchases[1] = { date: "kaputt" };
  return validateSnapshot(s, { schema: 1 }).ok ? true : "verworfen";
});

t("Von zwei Kopien gewinnt die inhaltsreichere", () => {
  const w = pickBetter(stand(5), stand(30), { schema: 1 });
  return w.chosen && w.chosen.purchases.length === 30 ? true : JSON.stringify(w.why);
});

t("Eine kaputte Kopie verliert gegen eine gute", () => {
  const kaputt = { schema: 1, purchases: "keine Liste", receipts: [] };
  const a = pickBetter(kaputt, stand(10), { schema: 1 });
  const b = pickBetter(stand(10), kaputt, { schema: 1 });
  return a.chosen && b.chosen && a.chosen.purchases.length === 10 && b.chosen.purchases.length === 10
    ? true : "kaputte Kopie hat gewonnen";
});

t("Sind beide kaputt, wird nichts gewählt", () => {
  const w = pickBetter({}, null, { schema: 1 });
  return w.chosen === null ? true : "es wurde etwas gewählt";
});

t("Der Zeitstempel entscheidet ausdrücklich nicht", () => {
  // Eine abgeschnittene Datei ist neuer und trotzdem schlechter.
  const alt = { ...stand(30), exportedAt: "2026-01-01T00:00:00Z" };
  const neuAberKurz = { ...stand(3), exportedAt: "2026-08-13T00:00:00Z" };
  const w = pickBetter(alt, neuAberKurz, { schema: 1 });
  return w.chosen === alt ? true : "die neuere, kürzere Kopie hat gewonnen";
});

// ================================================================
section("C: Erinnern, aber selten");

t("Ohne Dringlichkeit wird nicht erinnert", () => {
  const h = backupHealth({ receipts: 20, receiptsAtBackup: 20, lastBackupDate: HEUTE, today: HEUTE });
  return shouldRemind(h, null, HEUTE) === false ? true : "erinnert trotzdem";
});

t("Beim ersten Mal wird erinnert", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE });
  return shouldRemind(h, null, HEUTE) === true ? true : "schweigt";
});

t("Am selben Tag nicht noch einmal", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE });
  return shouldRemind(h, HEUTE, HEUTE) === false ? true : "erinnert zweimal am Tag";
});

t("Nach einer Woche wieder", () => {
  const h = backupHealth({ receipts: 40, today: HEUTE });
  const vor = "2026-08-06";   // sieben Tage
  if (daysBetweenDates(vor, HEUTE) !== NAG_SPACING_DAYS) return "Testdaten passen nicht zum Abstand";
  return shouldRemind(h, vor, HEUTE) === true ? true : "schweigt zu lange";
});

t("Der Dateiname trägt das Datum", () => {
  const n = backupFileName(HEUTE);
  return n === `einkaufsanker-${HEUTE}.json` ? true : n;
});

t("Auch mit Müll als Datum entsteht ein brauchbarer Name", () => {
  const n = backupFileName("morgen");
  return /^einkaufsanker-\d{4}-\d{2}-\d{2}\.json$/.test(n) ? true : n;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`SICHERUNG: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
