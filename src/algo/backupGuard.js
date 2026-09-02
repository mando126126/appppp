/**
 * backupGuard.js — welche von zwei Kopien im Speicher gilt
 * ================================================================
 * `data.js` hält neben dem Hauptstand eine Schattenkopie im selben
 * `localStorage` (siehe SHADOW_KEY dort). Sie hilft NICHT gegen
 * Löschen des Speichers — dagegen hilft nichts im selben Speicher —,
 * sondern gegen den abgebrochenen Schreibvorgang: volle Quote,
 * Absturz mitten im Speichern, halbe Datei. Das ist der häufigere
 * Fall als ein komplett gelöschter Speicher.
 *
 * WAS HIER LIEGT: die Urteilslogik, welcher von zwei gelesenen
 * Ständen der brauchbare ist — geprüft, weil sie sich prüfen lässt,
 * unabhängig vom Speicherzugriff selbst.
 * ================================================================
 */

/* Heißt nicht `isDate` — den Namen vergibt activityLog, und im
   Bündel teilen sich alle Module einen Namensraum. Der Build bricht
   sonst ab, und das ist die freundlichere Variante: vorher überschrieb
   still das eine das andere. */
const isDayString = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * Ist dieser Stand überhaupt eine brauchbare Sicherung?
 *
 * Wird an zwei Stellen gebraucht: beim Zurückholen einer Datei und —
 * wichtiger — beim Start, wenn die Schattenkopie einspringen soll.
 * Eine kaputte Kopie über einen guten Stand zu legen wäre schlimmer
 * als jeder Fehler, den sie beheben soll.
 */
function validateSnapshot(parsed, opts = {}) {
  const fehler = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, fehler: ["kein Objekt"] };
  if (opts.schema !== undefined && parsed.schema !== opts.schema) {
    fehler.push(`Fassung ${parsed.schema} statt ${opts.schema}`);
  }
  if (!Array.isArray(parsed.purchases)) fehler.push("keine Kaufliste");
  if (!Array.isArray(parsed.receipts)) fehler.push("keine Bonliste");
  if (Array.isArray(parsed.purchases)) {
    const kaputt = parsed.purchases.filter((p) => !p || !p.productId || !isDayString(p.date)).length;
    // Ein paar unbrauchbare Zeilen sind normal (alte Fassungen, halb
    // gelöschte Einträge). Die Hälfte ist ein kaputtes Datei-Ende.
    if (parsed.purchases.length && kaputt > parsed.purchases.length / 2) {
      fehler.push(`${kaputt} von ${parsed.purchases.length} Käufen unbrauchbar`);
    }
  }
  return { ok: fehler.length === 0, fehler };
}

/**
 * Welcher von zwei Ständen ist der bessere?
 *
 * Beim Start, wenn beide Kopien lesbar sind. Entschieden wird nach
 * Inhalt, nicht nach Zeitstempel: ein Zeitstempel kann neuer und der
 * Inhalt trotzdem abgeschnitten sein — genau das passiert, wenn die
 * Quote mitten im Schreiben ausgeht.
 */
function pickBetter(a, b, opts = {}) {
  const va = validateSnapshot(a, opts);
  const vb = validateSnapshot(b, opts);
  if (va.ok && !vb.ok) return { chosen: a, why: "zweite Kopie unbrauchbar" };
  if (!va.ok && vb.ok) return { chosen: b, why: "erste Kopie unbrauchbar" };
  if (!va.ok && !vb.ok) return { chosen: null, why: "beide unbrauchbar" };

  const za = (a.purchases || []).length + (a.receipts || []).length;
  const zb = (b.purchases || []).length + (b.receipts || []).length;
  if (za === zb) return { chosen: a, why: "gleichwertig" };
  return za > zb
    ? { chosen: a, why: `mehr Inhalt (${za} zu ${zb})` }
    : { chosen: b, why: `mehr Inhalt (${zb} zu ${za})` };
}

module.exports = { validateSnapshot, pickBetter };
