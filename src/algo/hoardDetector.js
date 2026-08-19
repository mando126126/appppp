/**
 * hoardDetector.js — Vorratskäufe erkennen
 * ================================================================
 * Ein Vorratskauf ist kein Wochenbedarf. Wer sechs Packungen Nudeln
 * mitnimmt, weil sie im Angebot waren, hat etwas anderes getan als
 * jemand, der eine Packung kauft — und die App soll das
 * unterscheiden können, in beide Richtungen:
 *
 *   GUT   Sechs Packungen Nudeln reichen ein halbes Jahr und halten
 *         zwei. Zum halben Preis war das richtig. Die App soll das
 *         sagen — und ein halbes Jahr lang keine Nudeln vorschlagen.
 *
 *   NICHT Sechs Becher Joghurt reichen bei diesem Haushalt zwölf
 *         Wochen und halten drei. Zwei Drittel davon landen im Müll,
 *         egal wie günstig sie waren. Das ist der Fall, den diese
 *         App verhindern soll, und der Moment dafür ist der Bon —
 *         nicht die Woche, in der es schon verdorben ist.
 *
 * ZWEI SUMMEN, IN DIE HIER NICHTS HINEINLÄUFT:
 *
 * 1. DIE ERSPARNIS. Was ein Vorratskauf günstiger war, zählt bereits
 *    `receiptSavings` beim Buchen — realisierte Preisersparnis, aus
 *    dem Bon. Der Betrag hier ist DERSELBE, nur nach Packungen
 *    aufgeschlüsselt, und dient der Erklärung. Ihn zusätzlich
 *    gutzuschreiben wäre EIN Ereignis über ZWEI Kanäle.
 *
 * 2. DIE VERSCHWENDUNGSBILANZ. Das Verderb-Risiko eines Stapels ist
 *    eine VORHERSAGE über etwas, das noch nicht passiert ist.
 *    `wasteSummary` bilanziert dagegen Vergangenes. Beides zu
 *    addieren hieße, denselben Joghurt einmal als Warnung und einmal
 *    als Verlust zu zählen — und wenn er dann doch aufgegessen wird,
 *    stünde er trotzdem in der Bilanz.
 *
 * Dieses Modul liefert deshalb ausschließlich BESCHREIBUNGEN. Keine
 * Zahl daraus wird irgendwo aufsummiert.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");

/* Ab dem Wievielfachen der üblichen Menge ist es ein Vorratskauf?
   Das Doppelte ist zu wenig — wer sonst eine Packung kauft und
   diesmal zwei, hat Gäste. Ab dem Dreifachen ist es Absicht. */
const HOARD_FACTOR = 3;

/* Und mindestens so viele Einheiten, sonst wird aus „sonst eine
   halbe, heute anderthalb" ein Vorratskauf. */
const MIN_UNITS = 3;

/* Ohne diese Zahl an früheren Käufen gibt es kein „üblich", gegen
   das sich „ungewöhnlich viel" messen ließe. */
const MIN_HISTORY = 3;

/* Anteil des Stapels, der über die Haltbarkeit hinausreicht, ab dem
   gewarnt wird. Darunter ist es der normale Schwund, den die
   Verschwendungsbilanz ohnehin führt. */
const WARN_SHARE = 0.2;

/** Median einer Zahlenreihe. Heißt nicht `medianOf` — den Namen
    vergibt priceMemory.js, und das Bündel teilt einen Namensraum. */
function medianQty(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Einen einzelnen Kauf beurteilen.
 *
 * @param {string} productId
 * @param {object} purchase       {date, quantity, unitPrice}
 * @param {Array}  frühere        Käufe VOR diesem, für „üblich"
 * @param {object|null} rhythm    Ergebnis aus computeRhythm
 * @param {string} today
 * @returns {null|object} Beschreibung oder null
 */
function judgePurchase(productId, purchase, frühere, rhythm, today) {
  const p = byId(productId);
  if (!p) return null;

  const units = Math.max(1, Number(purchase.quantity) || 1);
  if (units < MIN_UNITS) return null;
  if (frühere.length < MIN_HISTORY) return null;

  const üblich = medianQty(frühere.map((h) => Math.max(1, Number(h.quantity) || 1)));
  if (!üblich || units < üblich * HOARD_FACTOR) return null;

  /* Reichweite des Stapels. Ohne gelernten Verbrauch je Einheit gibt
     es keine — und dann sagt die App dazu nichts, statt zu raten. */
  const proEinheit = rhythm && rhythm.perUnitDays > 0 ? rhythm.perUnitDays : null;
  const reichweite = proEinheit === null ? null : Math.round(proEinheit * units);

  /* Wie lange hält der Stapel? Bei Trockenware und Tiefkühl ist die
     Frage gegenstandslos — dort ist die Haltbarkeit lang genug, dass
     die Reichweite immer zuerst endet. */
  const haltbar = p.shelfLifeDays;
  const überschuss = reichweite !== null && reichweite > haltbar
    ? (reichweite - haltbar) / reichweite
    : 0;

  /* Preis: gegen den eigenen Median der früheren Käufe. Ohne
     Vergleichswert keine Aussage über den Preis. */
  const preise = frühere.map((h) => Number(h.unitPrice)).filter((x) => Number.isFinite(x) && x > 0);
  const üblicherPreis = preise.length >= MIN_HISTORY ? medianQty(preise) : null;
  const bezahlt = Number(purchase.unitPrice);
  const günstiger = üblicherPreis !== null && Number.isFinite(bezahlt) && bezahlt < üblicherPreis
    ? Math.round((üblicherPreis - bezahlt) * units * 100) / 100
    : 0;

  /* Reicht der Stapel noch? Was aufgebraucht ist, braucht keinen
     Hinweis mehr — weder Lob noch Warnung. */
  const alter = daysBetween(purchase.date, today);
  const aktiv = reichweite === null ? alter <= 30 : alter < reichweite;

  /* Sicherheitskritisches wird NIE als guter Vorratskauf gelobt.
     Hackfleisch auf Vorrat ist auch zum halben Preis keine gute
     Idee, und die App darf das nicht andeuten. */
  const kritisch = !!p.safetyCritical;
  const zuviel = kritisch || überschuss >= WARN_SHARE;

  return {
    productId,
    name: p.name,
    date: purchase.date,
    kind: zuviel ? "zuviel" : "vorrat",
    units,
    üblicheMenge: üblich,
    reichweiteTage: reichweite,
    haltbarTage: haltbar,
    // Anteil des Stapels, der die Haltbarkeit überdauert. Reine
    // Vorhersage — siehe Kopf: läuft in keine Bilanz.
    überschussAnteil: Math.round(überschuss * 100) / 100,
    // Derselbe Betrag, den `receiptSavings` schon gebucht hat, hier
    // nur nach Packungen aufgeschlüsselt. Nicht addieren.
    günstiger,
    üblicherPreis: üblicherPreis === null ? null : Math.round(üblicherPreis * 100) / 100,
    bezahlt: Number.isFinite(bezahlt) ? Math.round(bezahlt * 100) / 100 : null,
    safetyCritical: kritisch,
    aktiv,
    estimated: true,
    message: satzFür({ p, units, reichweite, haltbar, überschuss, günstiger, kritisch, zuviel })
  };
}

/** Ein Satz, der sagt, was der Fall ist — nicht was zu tun wäre. */
function satzFür({ p, units, reichweite, haltbar, überschuss, günstiger, kritisch, zuviel }) {
  const menge = `${units}×`;
  if (kritisch) {
    return `${menge} ${p.name} auf einmal. Das Produkt trägt ein Verbrauchsdatum und hält etwa ` +
           `${haltbar} ${haltbar === 1 ? "Tag" : "Tage"} — Vorrat ist hier keine Option, auch nicht zum guten Preis.`;
  }
  if (zuviel) {
    const anteil = Math.round(überschuss * 100);
    return `${menge} ${p.name} reichen bei deinem Verbrauch etwa ${reichweite} Tage, ` +
           `haltbar sind sie ${haltbar}. Rund ${anteil} % davon wären über der Frist.`;
  }
  if (reichweite === null) {
    return `${menge} ${p.name} auf einmal — sieht nach Vorrat aus. Wie lange das reicht, ` +
           `weiß die App noch nicht.`;
  }
  const bis = `reicht etwa ${reichweite} Tage`;
  return günstiger > 0
    ? `${menge} ${p.name} zum besseren Preis — ${bis}.`
    : `${menge} ${p.name} als Vorrat — ${bis}.`;
}

/**
 * Alle Vorratskäufe eines Haushalts.
 *
 * @param {Array} history  {productId, date, quantity, unitPrice}
 * @param {Map}   rhythms  productId -> computeRhythm
 * @param {string} today
 * @returns {Array} Beschreibungen, jüngste zuerst
 */
function detectHoards(history, rhythms, today) {
  const byProduct = new Map();
  (history || []).forEach((h) => {
    if (!h || !h.productId) return;
    if (!byProduct.has(h.productId)) byProduct.set(h.productId, []);
    byProduct.get(h.productId).push(h);
  });

  const out = [];
  for (const [productId, arr] of byProduct) {
    const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    sorted.forEach((kauf, i) => {
      const fund = judgePurchase(productId, kauf, sorted.slice(0, i), rhythms.get(productId) || null, today);
      if (fund) out.push(fund);
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Was davon jetzt noch zählt: laufende Stapel.
 * Ein Vorratskauf von vor zwei Jahren ist Geschichte, kein Hinweis.
 */
function activeHoards(hoards) {
  return (hoards || []).filter((h) => h.aktiv);
}

module.exports = {
  detectHoards, activeHoards, judgePurchase,
  HOARD_FACTOR, MIN_UNITS, MIN_HISTORY, WARN_SHARE
};
