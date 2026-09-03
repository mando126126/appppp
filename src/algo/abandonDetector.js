/**
 * abandonDetector.js — Produkte, die der Haushalt aufgegeben hat
 * ================================================================
 * DER FEHLER, DEN DAS BEHEBT.
 *
 * Ein Haushalt steigt von Gouda auf Emmentaler um. Ab diesem Tag
 * wird Gouda nie wieder gebraucht — aber sein gelernter Takt bleibt
 * bestehen, und mit jedem Tag wird er „überfälliger". Die Liste
 * kennt bisher nur eine Obergrenze nach vorn (der Vorlauf), keine
 * nach hinten: je länger ein Produkt nicht gekauft wurde, desto
 * sicherer stand es oben auf der Liste.
 *
 * Im Drei-Jahres-Lauf war das messbar. Vierhundert Tage nach dem
 * Umstieg stand Gouda immer noch auf der Liste, und der simulierte
 * Haushalt kaufte ihn alle paar Wochen aus Gewohnheit mit — die App
 * hatte ihm ein Produkt antrainiert, das er abgeschafft hatte.
 *
 * WARUM DER RHYTHMUS DAS NICHT VON SELBST MERKT.
 *
 * Der Median rechnet über abgeschlossene KAUFABSTÄNDE. Solange kein
 * neuer Kauf kommt, entsteht kein neuer Abstand — die offene Lücke
 * taucht in seiner Rechnung schlicht nicht auf. Er kann noch so
 * robust sein; er sieht diese Tatsache gar nicht. Das ist keine
 * Doppelzählung, sondern die eine Information, die dem Median
 * strukturell fehlt.
 *
 * WARUM NICHT HART ABSCHNEIDEN.
 *
 * „Länger als das Dreifache nicht gekauft, also weg" wäre eine
 * Behauptung, die die App nicht belegen kann: vielleicht hat jemand
 * das Produkt wirklich nur vergessen, und dann ist es genau der
 * Vorschlag, der zählt. Deshalb ein WEICHER Übergang auf das
 * Vertrauen statt eines Schnitts auf die Sichtbarkeit. Das Vertrauen
 * ist die Grösse, an der in dieser App ohnehin alles hängt — die
 * Listenschwelle, die Vorhersage im Kalender, die Sicherheitsangabe
 * im Detail-Blatt. Ein Produkt verschwindet dadurch nicht plötzlich,
 * es verliert allmählich an Gewicht und fällt irgendwann unter die
 * Schwelle.
 *
 * ABWESENHEIT ZÄHLT NICHT MIT.
 *
 * Wer zwei Wochen weg war, hat nichts aufgegeben. Der Aufrufer gibt
 * deshalb die um Abwesenheiten bereinigten Tage herein — bei einem
 * Produkt mit dreitägigem Takt läge sonst schon ein normaler Urlaub
 * jenseits der Zweifelsschwelle.
 * ================================================================
 */

/** Bis hierhin ist ein Produkt einfach überfällig, nicht aufgegeben. */
const ABANDON_START = 2.5;
/** Ab hier ist der Vorschlag nichts mehr wert. */
const ABANDON_FULL = 6;

/**
 * Wie viel vom Vertrauen bleibt, wenn ein Produkt lange nicht
 * gekauft wurde?
 *
 * @param {number} rhythmDays  gelernter Takt
 * @param {number} daysSince   Tage seit dem letzten Kauf, OHNE Abwesenheiten
 * @returns {number} Faktor zwischen 0 und 1
 */
function abandonFactor(rhythmDays, daysSince) {
  if (!rhythmDays || !Number.isFinite(rhythmDays) || rhythmDays <= 0) return 1;
  if (!Number.isFinite(daysSince) || daysSince <= 0) return 1;
  const vielfaches = daysSince / rhythmDays;
  if (vielfaches <= ABANDON_START) return 1;
  if (vielfaches >= ABANDON_FULL) return 0;
  const anteil = (vielfaches - ABANDON_START) / (ABANDON_FULL - ABANDON_START);
  return Math.round((1 - anteil) * 100) / 100;
}

/**
 * Den Faktor auf einen Rhythmus anwenden.
 *
 * Liefert ein neues Objekt und hängt die Begründung an, damit im
 * Detail-Blatt nachvollziehbar bleibt, warum ein Produkt leiser
 * geworden ist. `baseConfidence` bleibt erhalten — ohne sie wäre
 * nicht mehr zu sehen, wie sicher der Takt selbst ist.
 */
function applyAbandon(rhythm, daysSinceWithoutAbsence) {
  if (!rhythm || !rhythm.rhythmDays) return rhythm;
  const faktor = abandonFactor(rhythm.rhythmDays, daysSinceWithoutAbsence);
  if (faktor >= 1) return rhythm;
  return {
    ...rhythm,
    confidence: Math.round(rhythm.confidence * faktor * 100) / 100,
    baseConfidence: rhythm.confidence,
    abandon: {
      factor: faktor,
      daysSince: daysSinceWithoutAbsence,
      multiple: Math.round((daysSinceWithoutAbsence / rhythm.rhythmDays) * 10) / 10,
      message: faktor === 0
        ? "So lange nicht gekauft, dass die App nicht mehr von einem Rhythmus ausgeht."
        : "Länger nicht gekauft als üblich — die App wird unsicherer, statt lauter zu werden."
    }
  };
}

module.exports = { abandonFactor, applyAbandon, ABANDON_START, ABANDON_FULL };
