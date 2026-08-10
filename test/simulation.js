/**
 * simulation.js — zwei Jahre Haushalt am Stück
 *
 * Einzeltests prüfen einen Zustand. Sie können nicht beantworten, ob
 * das Lernen über die Zeit KONVERGIERT oder ob es driftet, schwingt
 * oder sich aufschaukelt — und genau das ist bei einem Regelkreis aus
 * Vorhersage und Rückmeldung die eigentliche Gefahr.
 *
 * Hier läuft deshalb ein simulierter Haushalt Tag für Tag über zwei
 * Jahre. Er kauft nach einem echten, der App unbekannten Takt und
 * antwortet, wenn die Vorhersage danebenliegt. Geprüft wird, ob die
 * App diesem Takt folgt — und ob sie bei stabilem Verhalten trotz
 * dutzender Rückmeldungen stehen bleibt, statt langsam wegzulaufen.
 *
 *   node test/simulation.js
 */
const { computeRhythm } = require("../src/algo/rhythmEngine2");
const { applyFeedback, REASON } = require("../src/algo/feedbackLearner");
const { applySeason } = require("../src/algo/seasonalRhythm");
const { detectChange, purchasesSinceChange } = require("../src/algo/changeDetector");

const day = (o, from = "2026-08-10") =>
  new Date(new Date(from + "T12:00:00Z").getTime() + o * 86400000).toISOString().slice(0, 10);

function simulate(label, trueRhythm, opts = {}) {
  const purchases = [];
  const log = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const history = [];
  let broke = null;

  for (let d = -700; d <= 0; d++) {
    const today = day(d);
    const actual = typeof trueRhythm === "function" ? trueRhythm(d) : trueRhythm;

    // Der Haushalt kauft nach seinem echten Takt, mit etwas Streuung.
    const last = purchases.length ? purchases[purchases.length - 1] : null;
    const since = last ? (new Date(today) - new Date(last.date)) / 864e5 : 999;
    if (since >= actual + Math.round((rnd() - 0.5) * 2)) {
      purchases.push({ productId: "x", date: today, quantity: 1 });
    }

    if (purchases.length < 4) continue;

    // Was die App vorhersagt
    const change = detectChange(purchases, today);
    let r = computeRhythm(purchasesSinceChange(purchases, change));
    r = applySeason(r, purchases, today);
    r = applyFeedback(r, log, today, {});

    if (!Number.isFinite(r.rhythmDays) || r.rhythmDays < 1) { broke = `Tag ${d}: ${r.rhythmDays}`; break; }
    if (r.confidence < 0 || r.confidence > 1) { broke = `Tag ${d}: confidence ${r.confidence}`; break; }

    // Der Nutzer antwortet, wenn die App danebenliegt
    if (last && r.rhythmDays && since >= r.rhythmDays && rnd() < 0.5) {
      const stillHas = since < actual;
      log.push({ productId: "x", date: today, reason: stillHas ? REASON.HAVE : REASON.CONSUMED, dueIn: 0 });
    }
    if (last && r.rhythmDays && since > actual + 2 && since < r.rhythmDays && rnd() < 0.5) {
      log.push({ productId: "x", date: today, reason: REASON.EMPTY, dueIn: r.rhythmDays - since });
    }

    if (d % 60 === 0) history.push({ d, predicted: r.rhythmDays, actual, log: log.length });
  }

  const last5 = history.slice(-5);
  const avgErr = last5.reduce((a, h) => a + Math.abs(h.predicted - h.actual), 0) / Math.max(1, last5.length);
  console.log(`\n${label}`);
  console.log("  " + history.map((h) => `${h.d}d:${h.predicted}/${h.actual}`).join("  "));
  console.log(`  Rückmeldungen: ${log.length} | mittlerer Fehler zuletzt: ${avgErr.toFixed(1)} Tage`);
  if (broke) console.log("  ABBRUCH: " + broke);
  return { broke, avgErr, history };
}

let bad = 0;
const a = simulate("Stabil, alle 7 Tage", 7);
if (a.broke || a.avgErr > 2) { console.log("  -> FEHLER"); bad++; }

const b = simulate("Stabil, alle 21 Tage", 21);
if (b.broke || b.avgErr > 5) { console.log("  -> FEHLER"); bad++; }

// Haushalt schrumpft nach einem Jahr: 7 -> 14 Tage
const c = simulate("Bruch nach einem Jahr (7 -> 14)", (d) => (d < -350 ? 7 : 14));
if (c.broke || c.avgErr > 5) { console.log("  -> FEHLER"); bad++; }

// Saisonal: im Sommer doppelt so oft
const e = simulate("Saisonal (Sommer 7, sonst 14)", (d) => {
  const m = new Date(day(d) + "T12:00:00Z").getUTCMonth();
  return (m >= 6 && m <= 8) ? 7 : 14;
});
if (e.broke) { console.log("  -> FEHLER"); bad++; }

console.log("\n" + "=".repeat(50));
console.log(bad === 0 ? "SIMULATION: alle Szenarien konvergieren" : `SIMULATION: ${bad} Szenario(en) fehlerhaft`);
process.exit(bad ? 1 : 0);
