/**
 * calendarModel.js — der Kalender als Rechnung, nicht als Anzeige
 * ================================================================
 * Die App weiß zwei Dinge über Tage, die sie bisher nur einzeln
 * beantwortet hat:
 *
 *   RÜCKWÄRTS  was an einem Tag gekauft wurde und was es gekostet hat
 *   VORWÄRTS   wann ein Produkt voraussichtlich fällig wird, wann der
 *              geschätzte Vorrat aufgebraucht ist und wann etwas
 *              verdirbt
 *
 * Beides steht schon in den Daten. Was fehlte, ist die Achse, auf der
 * es sich vergleichen lässt: der Kalender. Erst dort wird sichtbar,
 * dass die 40 € am Samstag kein Ausreißer waren, sondern der Tag, an
 * dem drei Vierwochenprodukte gleichzeitig fällig waren — und dass
 * nächsten Dienstag dasselbe wieder passiert.
 *
 * WAS DIESES MODUL NICHT TUT
 *
 * Es zeichnet nichts. Es liefert je Tag eine Zeile aus Zahlen, die
 * eine Oberfläche darstellen kann — und wird deshalb ohne Browser
 * geprüft, wie alles in src/algo.
 *
 * EHRLICHKEIT DER VORHERSAGE
 *
 * Für die Zukunft steht hier eine SCHÄTZUNG, und sie wird mit
 * wachsendem Abstand schnell wertlos: der dritte vorhergesagte Kauf
 * eines Produkts hängt an zwei vorhergesagten davor. `HORIZONT_TAGE`
 * ist die Grenze, ab der nichts mehr vorhergesagt wird — lieber eine
 * leere Fläche als eine erfundene. Die Oberfläche sagt das dazu.
 *
 * Vorhergesagt wird außerdem nur, was auch auf der Liste stünde:
 * gelernter Takt, letztes Kaufdatum, Vertrauen über der Schwelle.
 * Ein Kalender, der mehr behauptet als die Liste, wäre ein zweiter
 * Algorithmus mit einer zweiten Wahrheit.
 * ================================================================
 */

const { daysBetween } = require("./rhythmEngine2");
const { isRealDate } = require("./inventoryEstimator");

/** Weiter als das wird nicht vorhergesagt. */
const HORIZONT_TAGE = 120;
/** Dieselbe Schwelle wie in der Liste — eine Wahrheit, nicht zwei.
    Heißt nicht `MIN_CONFIDENCE`: den Namen vergibt forgottenDetector,
    und beide teilen sich im Bündel denselben Namensraum. */
const KALENDER_MIN_CONFIDENCE = 0.4;

/** Tag verschieben, ohne Zeitzonen-Überraschungen. */
function plus(date, n) {
  return new Date(new Date(date + "T12:00:00Z").getTime() + n * 86400000)
    .toISOString().slice(0, 10);
}

/** Leere Tageszeile. */
function leererTag(date) {
  return {
    date,
    ausgegeben: 0,       // tatsächlich, aus den Bons
    gekauft: [],         // [{productId, name, betrag}]
    erwartet: 0,         // geschätzt, für die Zukunft
    faellig: [],         // [{productId, name, betrag}]
    leer: [],            // [{productId, name}] Vorrat aufgebraucht
    verdirbt: []         // [{productId, name, safetyCritical}]
  };
}

/**
 * Was an welchem Tag tatsächlich ausgegeben wurde.
 *
 * Gerechnet wird aus den Einzelposten und nicht aus einer
 * Bon-Endsumme: Pfand, Rabatte und nicht zugeordnete Zeilen gehören
 * nicht in eine Aussage über Produkte.
 */
function ausgabenJeTag(purchases, von, bis) {
  const tage = new Map();
  for (const h of purchases) {
    if (!h || !isRealDate(h.date)) continue;
    if (h.date < von || h.date > bis) continue;
    if (!tage.has(h.date)) tage.set(h.date, { summe: 0, posten: [] });
    const e = tage.get(h.date);
    const betrag = (Number(h.quantity) || 1) * (Number(h.unitPrice) || 0);
    e.summe += betrag;
    e.posten.push({ productId: h.productId, betrag: Math.round(betrag * 100) / 100 });
  }
  return tage;
}

/**
 * Wann wird jedes Produkt voraussichtlich wieder gekauft?
 *
 * Vom letzten Kauf aus in Schritten des gelernten Takts nach vorn.
 * Termine, die in der Vergangenheit liegen, werden übersprungen — sie
 * sind entweder schon passiert (dann steht der echte Kauf da) oder
 * überfällig; ein überfälliges Produkt bekommt seinen nächsten Termin
 * auf HEUTE, weil es genau jetzt auf der Liste steht.
 */
function faelligJeTag(rhythms, heute, von, bis, opts = {}) {
  const grenze = plus(heute, HORIZONT_TAGE);
  const ende = bis < grenze ? bis : grenze;
  const tage = new Map();
  if (ende < heute) return tage;

  const nichtVorhersagbar = opts.skip || (() => false);
  const preisFuer = opts.preisFuer || (() => 0);

  for (const [pid, r] of rhythms) {
    if (!r || !r.rhythmDays || !r.lastPurchaseDate) continue;
    if (!isRealDate(r.lastPurchaseDate)) continue;
    if (typeof r.confidence === "number" && r.confidence < KALENDER_MIN_CONFIDENCE) continue;
    if (nichtVorhersagbar(pid)) continue;

    const takt = Math.max(1, Math.round(r.rhythmDays));
    const betrag = Math.round(preisFuer(pid, r) * 100) / 100;

    /* Der erste Termin ist DERSELBE, den die Liste ansetzt: ein Takt
     * nach dem letzten Kauf. Liegt der schon hinter uns, ist das
     * Produkt überfällig — dann steht es HEUTE an und nicht am
     * nächsten rechnerischen Vielfachen.
     *
     * Die Vielfachen weiterzuzählen wäre die bequemere Rechnung und
     * eine falsche Aussage: sie tut so, als hätte der Haushalt
     * pünktlich weitergekauft. Hat er nicht — sonst stünde das
     * Produkt nicht auf der Liste. */
    const abstand = daysBetween(r.lastPurchaseDate, heute);
    if (!Number.isFinite(abstand)) continue;
    let termin = plus(r.lastPurchaseDate, takt);
    if (termin < heute) termin = heute;

    // Obergrenze für die Zahl der Termine: ohne sie könnte ein
    // kaputter Ein-Tages-Takt hier vierstellig oft schleifen.
    let schutz = 0;
    while (termin <= ende && schutz++ < 400) {
      if (termin >= von) {
        if (!tage.has(termin)) tage.set(termin, { summe: 0, posten: [] });
        const e = tage.get(termin);
        e.summe += betrag;
        e.posten.push({ productId: pid, betrag });
      }
      termin = plus(termin, takt);
    }
  }
  return tage;
}

/**
 * Wann geht der Vorrat aus, und wann verdirbt etwas?
 *
 * Zwei verschiedene Tage, die gern verwechselt werden:
 *
 *   LEER      der geschätzte Vorrat ist aufgebraucht. Rechnet sich aus
 *             Restmenge x Verbrauchsdauer je Einheit.
 *   VERDIRBT  die Haltbarkeit läuft ab, egal wie viel noch da ist.
 *             `daysLeft` aus der Bestandsschätzung, die dafür das
 *             aufgedruckte Datum bevorzugt.
 *
 * Kommt „verdirbt" VOR „leer", ist das die Verschwendung, um die es
 * dieser App geht — deshalb bekommt jeder Eintrag mit, ob er der
 * frühere von beiden ist.
 */
function bestandJeTag(inventory, rhythms, heute, von, bis) {
  const tage = new Map();
  const eintrag = (datum) => {
    if (!tage.has(datum)) tage.set(datum, { leer: [], verdirbt: [] });
    return tage.get(datum);
  };

  for (const i of inventory) {
    if (!i || !i.productId) continue;
    const r = rhythms && rhythms.get ? rhythms.get(i.productId) : null;

    const proEinheit = r && r.perUnitDays > 0 ? r.perUnitDays : null;
    const bisLeer = proEinheit !== null
      ? Math.round(i.remainingUnits * proEinheit)
      : null;
    const bisVerderb = Number.isFinite(i.daysLeft) ? Math.round(i.daysLeft) : null;

    const leerAm = bisLeer !== null && bisLeer >= 0 ? plus(heute, bisLeer) : null;
    const verderbAm = bisVerderb !== null && bisVerderb >= 0 ? plus(heute, bisVerderb) : null;
    // Was zuerst kommt, entscheidet, ob es aufgegessen oder weggeworfen wird.
    const verdirbtZuerst = leerAm !== null && verderbAm !== null && verderbAm < leerAm;

    if (leerAm && leerAm >= von && leerAm <= bis) {
      eintrag(leerAm).leer.push({
        productId: i.productId, name: i.name,
        // Ein Produkt, das vorher verdirbt, wird gar nicht erst leer.
        ueberholt: verdirbtZuerst
      });
    }
    if (verderbAm && verderbAm >= von && verderbAm <= bis) {
      eintrag(verderbAm).verdirbt.push({
        productId: i.productId, name: i.name,
        safetyCritical: !!i.safetyCritical,
        wert: i.value || 0,
        droht: verdirbtZuerst
      });
    }
  }
  return tage;
}

/**
 * Alles zusammen: eine Zeile je Tag im Zeitraum.
 *
 * @param {object} o
 * @param {Array}  o.purchases  [{productId, date, quantity, unitPrice}]
 * @param {Map}    o.rhythms    productId -> Rhythmus
 * @param {Array}  o.inventory  Ergebnis von estimateInventory
 * @param {string} o.heute
 * @param {string} o.von, o.bis
 * @param {function} [o.nameFuer]  productId -> Anzeigename
 * @param {function} [o.preisFuer] (productId, rhythm) -> erwarteter Betrag
 * @param {function} [o.skip]      productId -> nicht vorhersagen
 * @returns {{tage: Array, summeAusgegeben: number, summeErwartet: number, horizont: string}}
 */
function buildCalendar(o = {}) {
  const heute = o.heute;
  const von = o.von;
  const bis = o.bis;
  if (!isRealDate(heute) || !isRealDate(von) || !isRealDate(bis) || von > bis) {
    return { tage: [], summeAusgegeben: 0, summeErwartet: 0, horizont: null };
  }

  const nameFuer = o.nameFuer || ((id) => id);
  const rhythms = o.rhythms || new Map();
  const inventory = o.inventory || [];

  const ausgaben = ausgabenJeTag(o.purchases || [], von, bis < heute ? bis : heute);
  const faellig = faelligJeTag(rhythms, heute, von, bis, {
    skip: o.skip, preisFuer: o.preisFuer
  });
  const bestand = bestandJeTag(inventory, rhythms, heute, von, bis);

  const tage = [];
  const spanne = daysBetween(von, bis);
  for (let n = 0; n <= spanne; n++) {
    const datum = plus(von, n);
    const t = leererTag(datum);

    const a = ausgaben.get(datum);
    if (a) {
      t.ausgegeben = Math.round(a.summe * 100) / 100;
      t.gekauft = a.posten.map((p) => ({ ...p, name: nameFuer(p.productId) }));
    }
    const f = faellig.get(datum);
    if (f) {
      t.erwartet = Math.round(f.summe * 100) / 100;
      t.faellig = f.posten.map((p) => ({ ...p, name: nameFuer(p.productId) }));
    }
    const b = bestand.get(datum);
    if (b) { t.leer = b.leer; t.verdirbt = b.verdirbt; }

    tage.push(t);
  }

  return {
    tage,
    summeAusgegeben: Math.round(tage.reduce((s, t) => s + t.ausgegeben, 0) * 100) / 100,
    summeErwartet: Math.round(tage.reduce((s, t) => s + t.erwartet, 0) * 100) / 100,
    horizont: plus(heute, HORIZONT_TAGE)
  };
}

/** Erster und letzter Tag eines Monats. `monat` ist "JJJJ-MM". */
function monatsSpanne(monat) {
  if (!/^\d{4}-\d{2}$/.test(monat)) return null;
  const [j, m] = monat.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return { von: `${monat}-01`, bis: `${monat}-${String(letzter).padStart(2, "0")}` };
}

/** Monat verschieben, ohne über Jahresgrenzen zu stolpern. */
function monatPlus(monat, n) {
  if (!/^\d{4}-\d{2}$/.test(monat)) return monat;
  const [j, m] = monat.split("-").map(Number);
  const gesamt = j * 12 + (m - 1) + n;
  const nj = Math.floor(gesamt / 12);
  const nm = gesamt - nj * 12 + 1;
  return `${String(nj).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

/**
 * Der Wochentag als Spalte, Montag zuerst.
 * `getUTCDay()` zählt Sonntag als 0 — in Deutschland beginnt die
 * Woche am Montag, und ein Kalender, der das anders macht, wird
 * falsch gelesen, nicht anders.
 */
function spalteFuer(date) {
  const d = new Date(date + "T12:00:00Z").getUTCDay();
  return (d + 6) % 7;
}

module.exports = {
  buildCalendar, ausgabenJeTag, faelligJeTag, bestandJeTag,
  monatsSpanne, monatPlus, spalteFuer,
  HORIZONT_TAGE, KALENDER_MIN_CONFIDENCE
};
