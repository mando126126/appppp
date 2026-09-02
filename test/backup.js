/**
 * backup.js — Tests für die Wiederherstellung
 * ================================================================
 * `data.js` hält neben dem Hauptstand eine Schattenkopie im selben
 * `localStorage`, gegen den abgebrochenen Schreibvorgang: volle
 * Quote, Absturz mitten im Speichern, halbe Datei. Geprüft wird hier
 * die Urteilslogik aus backupGuard.js: welche von zwei Kopien gilt,
 * und was mit einer kaputten passiert.
 * ================================================================
 */

const { validateSnapshot, pickBetter } = require("../src/algo/backupGuard");

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

/** Ein brauchbarer Stand. */
const stand = (n = 20) => ({
  schema: 1,
  purchases: Array.from({ length: n }, (_, i) => ({
    productId: "milch_vollmilch", date: "2026-08-01", quantity: 1, unitPrice: 1.29
  })),
  receipts: Array.from({ length: Math.ceil(n / 4) }, () => ({ date: "2026-08-01", total: 12 }))
});

// ================================================================
section("Welche Kopie gilt");

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
console.log("\n" + "=".repeat(60));
console.log(`WIEDERHERSTELLUNG: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
