/**
 * milestones.js — Meilensteine mit echter Bezugsgröße
 * ================================================================
 * Abstrakte Punkte („420 XP“) bedeuten nichts. Diese App hat etwas
 * Besseres: eine bezifferbare Wirkung. „50 Produkte vor dem Verderb
 * bewahrt“ ist keine Spielwährung, sondern eine Zusammenfassung
 * dessen, was der Haushalt getan hat.
 *
 * VIER REGELN:
 *
 *   1. Jede Stufe zählt bestätigte Handlungen aus dem Ereignis-
 *      Protokoll. Keine Stufe misst bloße App-Nutzung — „zehnmal
 *      geöffnet“ ist eine Auszeichnung für die App, nicht für den
 *      Nutzer.
 *   2. Geld und Stückzahl bleiben getrennte Reihen, und die
 *      Geldreihe zählt ausschließlich REALISIERTE Ersparnis. Ein
 *      Abzeichen für geschätzte Beträge wäre eine Auszeichnung für
 *      eine Vermutung.
 *   3. Keine Stufe kann verfallen. Was einmal erreicht ist, bleibt.
 *      Ein rückläufiger Zähler wäre eine Bestrafung für eine
 *      ruhige Phase.
 *   4. Nicht erreichte Stufen werden neutral gezeigt: der Abstand,
 *      nicht das Versäumnis.
 * ================================================================
 */

/* `icon` ist ein SCHLÜSSEL, kein Zeichen. Vorher standen hier
   Unicode-Glyphen (✽ ◆ ↻ ▤ ▪) — der deutlichste Verräter einer
   Gestaltung von der Stange: echte Symbole werden gezeichnet, nicht
   aus dem Zeichensatz gegriffen. Die Zeichnung steht in views.js, wo
   sie hingehört; dieses Modul benennt nur, was gemeint ist. */
const MILESTONES = [
  {
    id: "gerettet",
    label: "Gerettet",
    unit: "Produkte",
    steps: [3, 10, 25, 50, 100, 250],
    icon: "sprout",
    title: (n) => `${n} Produkte vor dem Verderb bewahrt`,
    note: "Zählt Handlungen, die du bestätigt hast: halbe Menge, eingefroren, aufgebraucht, gekocht."
  },
  {
    id: "guenstig",
    label: "Günstig gekauft",
    unit: "€",
    euros: true,
    steps: [10, 25, 50, 100, 250, 500],
    icon: "tag",
    title: (n) => `${n} € unter deinem üblichen Preis`,
    note: "Realisierte Ersparnis: gezahlter Preis gegen deinen eigenen Medianpreis. Nachrechenbar, nicht geschätzt."
  },
  {
    id: "getauscht",
    label: "Getauscht",
    unit: "×",
    steps: [3, 10, 25, 50],
    icon: "cycle",
    title: (n) => `${n}× rechtzeitig getauscht`,
    note: "Zahnbürste, Schwamm, Filter — Austausch nach Zeit, nicht nach Verbrauch."
  },
  {
    id: "erfasst",
    label: "Erfasst",
    unit: "Bons",
    steps: [1, 10, 50, 100, 250],
    icon: "receipt",
    title: (n) => (n === 1 ? "Erster Bon erfasst" : `${n} Bons erfasst`),
    note: "Jeder Bon schärft die Rhythmen. Ohne Historie rät die App nur."
  },
  {
    id: "wochen",
    label: "Am Stück",
    unit: "Wochen",
    steps: [2, 4, 12, 26, 52],
    icon: "tally",
    title: (n) => `${n} Wochen am Stück`,
    note: "Wochen mit mindestens einer Handlung. Urlaubswochen zählen mit."
  }
];

const badgeKey = (id, threshold) => `${id}:${threshold}`;

/**
 * Stand aller Reihen.
 *
 * @param {{gerettet, guenstig, getauscht, erfasst, wochen}} totals
 * @returns {{rows, reached, reachedKeys, count, nextUp}}
 */
function milestoneState(totals) {
  const rows = MILESTONES.map((m) => {
    const raw = Number(totals && totals[m.id]) || 0;
    const value = Math.max(0, m.euros ? Math.round(raw * 100) / 100 : Math.floor(raw));

    const reached = m.steps.filter((s) => value >= s);
    const current = reached.length ? reached[reached.length - 1] : null;
    const next = m.steps.find((s) => value < s) || null;

    // Fortschritt immer zwischen der zuletzt erreichten Stufe und der
    // nächsten — sonst sähe der Sprung von 100 auf 250 aus wie
    // Stillstand, obwohl es der schwerste Abschnitt ist.
    const floor = current || 0;
    const progress = next ? Math.min(1, Math.max(0, (value - floor) / (next - floor))) : 1;

    return {
      id: m.id,
      label: m.label,
      unit: m.unit,
      icon: m.icon,
      euros: !!m.euros,
      note: m.note,
      value,
      steps: m.steps,
      reached,
      reachedKeys: reached.map((s) => badgeKey(m.id, s)),
      level: reached.length,
      maxLevel: m.steps.length,
      current,
      currentTitle: current ? m.title(current) : null,
      next,
      nextTitle: next ? m.title(next) : null,
      remaining: next ? Math.round((next - value) * 100) / 100 : 0,
      progress: Math.round(progress * 100) / 100,
      complete: !next
    };
  });

  const reachedKeys = rows.flatMap((r) => r.reachedKeys);

  // Was am nächsten dran ist — die eine Zeile, die sich zu zeigen lohnt.
  const open = rows.filter((r) => r.next !== null);
  const nextUp = open.length
    ? open.slice().sort((a, b) => b.progress - a.progress)[0]
    : null;

  return {
    rows,
    reachedKeys,
    reached: rows.filter((r) => r.current !== null),
    count: reachedKeys.length,
    total: MILESTONES.reduce((a, m) => a + m.steps.length, 0),
    nextUp
  };
}

/**
 * Stufen, die seit dem letzten Blick dazugekommen sind.
 * `seen` ist die Liste bereits gefeierter Schlüssel.
 */
function newMilestones(state, seen) {
  const known = new Set(Array.isArray(seen) ? seen : []);
  const out = [];
  state.rows.forEach((row) => {
    const def = MILESTONES.find((m) => m.id === row.id);
    row.reached.forEach((step) => {
      const key = badgeKey(row.id, step);
      if (known.has(key)) return;
      out.push({
        key, id: row.id, threshold: step,
        label: row.label, icon: row.icon, unit: row.unit,
        title: def.title(step),
        note: def.note,
        level: row.reached.indexOf(step) + 1,
        maxLevel: row.maxLevel
      });
    });
  });
  // Die höchste Stufe zuerst — wer zwei auf einmal erreicht, soll die
  // größere sehen.
  return out.sort((a, b) => b.threshold - a.threshold);
}

module.exports = { MILESTONES, milestoneState, newMilestones, badgeKey };
