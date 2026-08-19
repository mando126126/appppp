/**
 * priceShare.js — was das Gerät verlassen dürfte, und was nie
 * ================================================================
 * Für den Schwarm-Preisindex: viele Haushalte melden, was ein
 * Produkt gerade kostet, und alle sehen, wo es ungewöhnlich günstig
 * ist. Der Nutzen ist offensichtlich. Der Preis dafür ist es nicht.
 *
 * WAS EIN KASSENBON ÜBER EINEN MENSCHEN VERRÄT, wenn man ihn
 * überträgt: wo er einkauft (Filiale ≈ Wohnort), wann (Arbeitszeit,
 * Wochenrhythmus), wie viel (Haushaltsgröße, Einkommen) — und was.
 * Das Letzte ist das Heikelste: Babynahrung heißt Schwangerschaft,
 * Halal heißt Religion, Diabetiker-Produkte heißen Gesundheit. Das
 * sind besondere Kategorien nach Art. 9 DSGVO, und sie stehen auf
 * ganz gewöhnlichen Bons.
 *
 * DESHALB IST DIE EINHEIT HIER KEIN KAUF, SONDERN EINE PREISSICHTUNG.
 *
 *     { produkt, kette, kalenderwoche, cent, packung }
 *
 * Nicht enthalten, und zwar jedes einzelne aus einem Grund:
 *
 *   MENGE        verrät die Haushaltsgröße.
 *   DATUM        wird zur Kalenderwoche. Ein Datum plus Kette plus
 *                Produkt ist über mehrere Sichtungen hinweg
 *                verkettbar, eine Woche kaum.
 *   FILIALE      wird zur Kette. Die Filiale ist der Wohnort.
 *   WARENKORB    ist ein Fingerabdruck. Zwölf Positionen in einem
 *                Bon identifizieren einen Haushalt zuverlässiger als
 *                ein Name. Sichtungen werden deshalb EINZELN
 *                übertragen, ohne Bezug zueinander.
 *   KENNUNG      gibt es nicht. Kein Konto, kein Gerät, kein Zufalls-
 *                schlüssel — auch kein „pseudonymer". Ein stabiler
 *                Schlüssel über Wochen ist eine Kennung, egal wie er
 *                heißt.
 *
 * Übrig bleibt eine Aussage über einen HÄNDLER, nicht über einen
 * Menschen: „in Woche 34 kostete Butter bei Lidl 1,49 €". Das ist
 * der Punkt der ganzen Konstruktion.
 *
 * ZWEI REGELN, DIE NICHT VERHANDELBAR SIND:
 *
 * 1. NUR BEKANNTE KETTEN. „Hofladen Müller" wird nicht übertragen.
 *    Ein seltener Händlername ist selbst ein Merkmal — bei einer
 *    Handvoll Kunden ist die Sichtung die Person.
 *
 * 2. NICHTS OHNE k ANDERE. Ein Wert wird erst ausgeliefert, wenn
 *    mindestens k unabhängige Sichtungen vorliegen. Das schützt
 *    doppelt: gegen Rückschlüsse auf den Einzelnen und gegen einen
 *    falsch erkannten Bon, der sonst den Index verschöbe.
 *
 * DIE OFFENE STELLE, UND SIE IST NICHT KLEIN:
 *
 * `buildPriceIndex` zählt SICHTUNGEN, nicht HAUSHALTE. Solange jeder
 * ehrlich einmal meldet, ist das dasselbe. Wer aber dieselbe Sichtung
 * fünfmal schickt, erfüllt die k-Schwelle im Alleingang — und dann
 * schützt sie niemanden mehr und glättet auch nichts.
 *
 * Ohne Kennung lässt sich das nicht auflösen: „ein Haushalt, eine
 * Meldung" zu prüfen setzt voraus, Haushalte unterscheiden zu können,
 * und genau das soll es hier nicht geben. Drei Auswege, alle mit
 * Preis:
 *
 *   a) Ratenbegrenzung je IP. Schwach, aber billig.
 *   b) Ein wöchentlich wechselndes, blind signiertes Ticket
 *      (Privacy-Pass-Verfahren): beweist „eine Meldung je Woche",
 *      ohne den Absender zu kennen. Richtig, und echte Kryptoarbeit.
 *   c) Es bleibt bei „k Meldungen" statt „k Haushalten" — dann muss
 *      die App genau das sagen und nichts anderes behaupten.
 *
 * Vor Stufe 2 muss eine davon gewählt sein. Es ist dieselbe
 * Fehlerklasse wie die Doppelzählungen weiter oben in diesem
 * Projekt: eine Zahl, die über einen Kanal gezählt wird, der etwas
 * anderes misst, als ihr Name sagt.
 *
 * DIESES MODUL ÜBERTRÄGT NICHTS. Es entscheidet nur, was eine
 * übertragbare Sichtung wäre, und rechnet den Index aus fertigen
 * Sichtungen. Beides ist reine Logik und hier prüfbar — die Frage,
 * OB übertragen wird, ist eine Einwilligung und steht woanders.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const SHARE_VERSION = 1;

/* Wie viele unabhängige Sichtungen, bevor ein Wert herausgeht.
   Fünf ist die übliche Untergrenze für k-Anonymität und zugleich
   die Zahl, ab der ein Median gegen einen Ausreißer robust ist. */
const K_ANONYMITY = 5;

/* Ketten, die groß genug sind, dass die Nennung niemanden
   heraushebt. Die Liste ist bewusst kurz und bewusst eine Liste:
   „alles außer verdächtig" wäre die falsche Richtung. */
const CHAINS = {
  lidl: ["lidl"],
  aldi: ["aldi", "aldi sued", "aldi süd", "aldi nord"],
  rewe: ["rewe"],
  edeka: ["edeka", "e center", "e-center"],
  kaufland: ["kaufland"],
  penny: ["penny"],
  netto: ["netto"],
  norma: ["norma"],
  real: ["real"],
  globus: ["globus"],
  dm: ["dm", "dm drogerie", "dm-drogerie markt"],
  rossmann: ["rossmann"]
  /* „Müller" stand hier und ist wieder heraus. Der Test hat gezeigt,
     was passiert: „Hofladen Müller" wurde als Drogeriekette erkannt
     und wäre übertragen worden — genau der Fall, den Regel 1
     verhindern soll. Müller ist einer der häufigsten deutschen
     Nachnamen; ein Laden dieses Namens ist häufiger ein Einzelfall
     als eine Filiale. Eine Kette weniger im Index ist der billigere
     Fehler. */
};

/** Händlername auf eine bekannte Kette abbilden — oder auf null. */
function chainOf(store) {
  if (!store) return null;
  const s = String(store).toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[c]))
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  for (const [key, namen] of Object.entries(CHAINS)) {
    // Wortgrenze, nicht Teilzeichenkette: „Realschulweg" ist kein
    // „real", und „Netto Marken-Discount" ist eins.
    if (namen.some((n) => new RegExp(`(^| )${n}( |$)`).test(s))) return key;
  }
  return null;
}

/** ISO-Kalenderwoche. Gröber als ein Datum, fein genug für Angebote. */
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  if (isNaN(d.getTime())) return null;
  const tag = (d.getUTCDay() + 6) % 7;              // Montag = 0
  d.setUTCDate(d.getUTCDate() - tag + 3);           // Donnerstag der Woche
  const jahr = d.getUTCFullYear();
  const ersterDo = new Date(Date.UTC(jahr, 0, 4));
  const versatz = (ersterDo.getUTCDay() + 6) % 7;
  ersterDo.setUTCDate(ersterDo.getUTCDate() - versatz + 3);
  const woche = 1 + Math.round((d - ersterDo) / (7 * 86400000));
  return `${jahr}-W${String(woche).padStart(2, "0")}`;
}

/**
 * Aus einem Kauf eine übertragbare Sichtung machen — oder nicht.
 *
 * @param {object} purchase {productId, date, unitPrice, weightG}
 * @param {string} store    Händlername vom Bon
 * @returns {null|{v, produkt, kette, kw, cent, packung}}
 */
function observationFrom(purchase, store) {
  if (!purchase) return null;
  const p = byId(purchase.productId);
  if (!p) return null;                              // nur Katalogprodukte

  const kette = chainOf(store);
  if (!kette) return null;                          // Regel 1

  const kw = isoWeek(purchase.date);
  if (!kw) return null;

  const preis = Number(purchase.unitPrice);
  if (!Number.isFinite(preis) || preis <= 0) return null;

  /* Grobe Plausibilität gegen den Katalogwert. Eine falsch erkannte
     Bonzeile („1,49" als „149,00") darf nicht in den Index. Die
     Grenzen sind weit — Angebote sind echt, Tippfehler sind es
     nicht. */
  const üblich = p.typicalPrice || 0;
  if (üblich > 0 && (preis < üblich * 0.2 || preis > üblich * 5)) return null;

  return {
    v: SHARE_VERSION,
    produkt: p.id,
    kette,
    kw,
    cent: Math.round(preis * 100),
    // Packungsgröße macht Preise vergleichbar; sie sagt nichts über
    // den Haushalt, weil sie am Produkt hängt und nicht am Kauf.
    packung: purchase.weightG || p.typicalWeightG || null
  };
}

/**
 * Alle übertragbaren Sichtungen eines Zeitraums.
 *
 * Bewusst OHNE Bezug zueinander und in zufälliger Reihenfolge: die
 * Zusammenstellung eines Warenkorbs ist ein Fingerabdruck, und die
 * Reihenfolge auf dem Bon ist der Weg durch den Laden.
 */
function shareableFrom(purchases, storeOf, opts = {}) {
  const out = [];
  (purchases || []).forEach((kauf) => {
    const obs = observationFrom(kauf, storeOf ? storeOf(kauf) : kauf.store);
    if (obs) out.push(obs);
  });

  // Mischen mit einem übergebenen Zufall, damit der Test bestimmt bleibt.
  const rnd = opts.random || Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const keyOf = (o) => `${o.produkt}|${o.kette}|${o.kw}`;

function medianCent(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Sichtungen zu einem Index verdichten.
 *
 * Das ist die Rechnung, die auf dem Server liefe — hier, weil sie
 * dann prüfbar ist und weil dieselbe Funktion für eine geteilte
 * Datei zwischen drei Haushalten reicht, ganz ohne Server.
 *
 * Der Median statt des Mittelwerts, aus demselben Grund wie überall
 * sonst in dieser App: eine falsch erkannte Zeile soll den Wert
 * nicht verschieben.
 *
 * @returns {Array} nur Einträge mit mindestens k Sichtungen
 */
function buildPriceIndex(observations, { k = K_ANONYMITY } = {}) {
  const groups = new Map();
  (observations || []).forEach((o) => {
    if (!o || o.v !== SHARE_VERSION || !o.produkt || !o.kette || !o.kw) return;
    if (!Number.isFinite(o.cent) || o.cent <= 0) return;
    const key = keyOf(o);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o.cent);
  });

  const out = [];
  for (const [key, cents] of groups) {
    if (cents.length < k) continue;                 // Regel 2
    const [produkt, kette, kw] = key.split("|");
    out.push({
      produkt, kette, kw,
      n: cents.length,
      medianCent: medianCent(cents),
      minCent: Math.min(...cents),
      maxCent: Math.max(...cents)
    });
  }
  return out.sort((a, b) => (a.kw < b.kw ? 1 : a.kw > b.kw ? -1 : a.produkt.localeCompare(b.produkt)));
}

/**
 * Wie viele Sichtungen fehlen noch, bis ein Wert herausgehen darf.
 * Für die Oberfläche: „noch 2 Meldungen" ist eine ehrlichere Auskunft
 * als eine leere Stelle.
 */
function missingFor(observations, produkt, kette, kw, k = K_ANONYMITY) {
  const n = (observations || []).filter(
    (o) => o && o.produkt === produkt && o.kette === kette && o.kw === kw
  ).length;
  return Math.max(0, k - n);
}

module.exports = {
  chainOf, isoWeek, observationFrom, shareableFrom, buildPriceIndex, missingFor,
  SHARE_VERSION, K_ANONYMITY, CHAINS
};
