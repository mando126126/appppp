/**
 * offerAdvisor.js — lohnt sich Vorrat bei diesem Preis?
 * ================================================================
 * Die Gegenrichtung zu hoardDetector.js: der beurteilt einen
 * Vorratskauf, NACHDEM er passiert ist. Hier steht die Frage
 * davor — bei diesem Preis, wie viel wäre sinnvoll?
 *
 * DIE ZAHL, DIE DIESE APP DAFÜR HAT UND SONST NIEMAND:
 *
 *     Höchstmenge = Haltbarkeit ÷ dein Verbrauch je Einheit
 *
 * Ein Angebotsportal kann sagen, dass Butter gerade billig ist. Was
 * es nicht sagen kann: dass DU 250 g in zwölf Tagen verbrauchst und
 * Butter vier Wochen hält, also drei Packungen die Grenze sind und
 * die vierte im Müll landet. Genau diese Rechnung ist der Grund,
 * warum die Empfehlung hier stehen darf und in einem Prospekt nicht.
 *
 * WOHER DER VERGLEICHSPREIS KOMMT, ist dieser Funktion egal. Sie
 * bekommt ein „üblich" und rechnet. Ob das aus der eigenen Historie
 * stammt (funktioniert heute, ohne Netz, ohne irgendwen) oder aus
 * einem Schwarm-Index (viele Haushalte, siehe priceShare.js), ändert
 * an der Rechnung nichts — nur an der Herkunftsangabe, die
 * mitgeführt und angezeigt wird. Eine Empfehlung ohne Herkunft wäre
 * in dieser App eine Behauptung.
 *
 * WAS SIE NICHT TUT: sie schreibt nichts gut. Die genannte Ersparnis
 * ist eine Vorschau auf einen Kauf, der noch nicht stattgefunden hat.
 * Realisiert wird sie erst beim Buchen, und dort zählt sie
 * `receiptSavings`. Beides zu addieren wäre EIN Ereignis über ZWEI
 * Kanäle — der Fehler, der in diesem Projekt schon dreimal Geld
 * gekostet hat.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

/* Ab wie viel Prozent unter üblich ist es ein Angebot? Darunter ist
   es Preisrauschen — Butter für 2,25 statt 2,29 ist kein Anlass,
   den Keller vollzustellen. */
const DEAL_THRESHOLD = 0.15;

/* Obergrenze unabhängig von der Rechnung. Auch wenn Reis zehn Jahre
   hält: eine App, die zu vierzig Packungen rät, hat den Bezug zum
   Haushalt verloren — und Kapital ist auch gebunden. */
const MAX_STOCK_UNITS = 8;

/* Unter zwei sinnvollen Einheiten gibt es keinen Vorrat, sondern
   einen normalen Einkauf. Dann schweigt die App. */
const MIN_STOCK_UNITS = 2;

/**
 * Wie viele Einheiten wären bei diesem Preis sinnvoll?
 *
 * @param {string} productId
 * @param {object} lage
 *   `preis`        was es gerade kostet (je Einheit)
 *   `üblich`       Vergleichswert
 *   `herkunft`     "eigen" | "schwarm" — wird nur weitergereicht
 *   `n`            wie viele Sichtungen hinter `üblich` stehen (Schwarm)
 *   `perUnitDays`  gelernter Verbrauch je Einheit, in Tagen
 * @returns {null|object}
 */
function offerAdvice(productId, lage = {}) {
  const p = byId(productId);
  if (!p) return null;

  /* Sicherheitskritisches nie. Ein Verbrauchsdatum lässt sich nicht
     durch einen guten Preis verlängern, und die App darf das an
     keiner Stelle andeuten. */
  if (p.safetyCritical) return null;

  const preis = Number(lage.preis);
  const üblich = Number(lage.üblich);
  if (!Number.isFinite(preis) || !Number.isFinite(üblich) || preis <= 0 || üblich <= 0) return null;

  const nachlass = (üblich - preis) / üblich;
  if (nachlass < DEAL_THRESHOLD) return null;       // kein Angebot

  /* Ohne gelernten Verbrauch keine Höchstmenge — und ohne
     Höchstmenge keine Empfehlung. Lieber nichts sagen als raten:
     ein Vorratsstapel, der nach vierzehn Monaten noch steht, ist
     genau das Gegenteil dessen, was diese App verspricht. */
  const proEinheit = Number(lage.perUnitDays);
  if (!Number.isFinite(proEinheit) || proEinheit <= 0) return null;

  const haltbar = p.shelfLifeDays;
  const maxNachHaltbarkeit = Math.floor(haltbar / proEinheit);
  const einheiten = Math.min(MAX_STOCK_UNITS, maxNachHaltbarkeit);

  if (einheiten < MIN_STOCK_UNITS) {
    /* Der interessante Fall, und er ist eine eigene Aussage: das
       Angebot ist echt, aber die Haltbarkeit gibt keinen Vorrat her.
       Das zu sagen ist nützlicher als zu schweigen — sonst kauft
       jemand sechs, weil sie günstig waren. */
    return {
      productId, name: p.name,
      kind: "kein-vorrat",
      einheiten: 1,
      reichweiteTage: Math.round(proEinheit),
      haltbarTage: haltbar,
      nachlass: Math.round(nachlass * 100) / 100,
      ersparnis: 0,
      herkunft: lage.herkunft || "eigen",
      n: lage.n || null,
      estimated: true,
      message: `${p.name} ist ${Math.round(nachlass * 100)} % günstiger als üblich — ` +
               `für Vorrat reicht die Haltbarkeit aber nicht: ${haltbar} ` +
               `${haltbar === 1 ? "Tag" : "Tage"}, und du verbrauchst eine Einheit in ` +
               `${Math.round(proEinheit)}.`
    };
  }

  const reichweite = Math.round(proEinheit * einheiten);
  // Vorschau, keine Gutschrift. Siehe Kopf.
  const ersparnis = Math.round((üblich - preis) * einheiten * 100) / 100;

  return {
    productId, name: p.name,
    kind: "vorrat",
    einheiten,
    reichweiteTage: reichweite,
    haltbarTage: haltbar,
    // Warum nicht mehr: die Haltbarkeit oder die Obergrenze.
    begrenztDurch: maxNachHaltbarkeit <= MAX_STOCK_UNITS ? "haltbarkeit" : "obergrenze",
    nachlass: Math.round(nachlass * 100) / 100,
    ersparnis,
    herkunft: lage.herkunft || "eigen",
    n: lage.n || null,
    estimated: true,
    message: `${einheiten}× ${p.name} wären hier sinnvoll — das reicht etwa ${reichweite} Tage ` +
             `und bleibt in der Haltbarkeit von ${haltbar}.`
  };
}

/**
 * Die Herkunftsangabe als Satz. Getrennt gehalten, weil sie das
 * Einzige ist, was sich zwischen „eigene Historie" und „Schwarm"
 * unterscheidet — die Rechnung darüber ist dieselbe.
 */
function sourceNote(advice) {
  if (!advice) return "";
  if (advice.herkunft === "schwarm") {
    return advice.n
      ? `Verglichen mit ${advice.n} Meldungen anderer Haushalte aus dieser Woche.`
      : "Verglichen mit Meldungen anderer Haushalte.";
  }
  return "Verglichen mit deinen eigenen bisherigen Preisen für dieses Produkt.";
}

module.exports = { offerAdvice, sourceNote, DEAL_THRESHOLD, MAX_STOCK_UNITS, MIN_STOCK_UNITS };
