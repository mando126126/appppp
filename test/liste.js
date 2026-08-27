/**
 * liste.js — Rückvergleich für den Listen-Algorithmus
 * ================================================================
 * Die Frage, die dieses Projekt lange nicht gemessen hat: sagt die
 * Einkaufsliste voraus, was tatsächlich gekauft wird?
 *
 * Verfahren: für jeden Einkaufstag einer synthetischen Haushalts-
 * historie die Liste NUR aus den Daten davor erzeugen und mit dem
 * vergleichen, was an dem Tag wirklich gekauft wurde.
 *
 *   Treffer     — vorgeschlagen UND gekauft
 *   Fehlalarm   — vorgeschlagen, nicht gekauft
 *   Übersehen   — gekauft, nicht vorgeschlagen
 *
 * WAS DIESER TEST KANN UND WAS NICHT — beides gehört hierher, weil
 * die Grenze schon einmal eine Änderung durchgewinkt hätte, die
 * tatsächlich schadet:
 *
 * KANN: die Vorschlagsqualität eines FESTEN Algorithmus gegen einen
 * festen Verlauf messen, reproduzierbar und in Sekunden.
 *
 * KANN NICHT: die Rückkopplung sehen. Die simulierten Haushalte
 * kaufen nach ihrem eigenen Takt und richten sich nicht nach den
 * Vorschlägen der App. Echte Haushalte tun das sehr wohl — sie kaufen
 * früher, weil die App es sagt, und die App lernt daraus einen
 * kürzeren Rhythmus. Genau diese Schleife hat `test/longterm.js` im
 * Blick, dieser Test nicht. Deshalb gilt: eine Verbesserung hier ist
 * ein Hinweis, kein Beweis. Erst wenn der Drei-Jahres-Lauf sie
 * bestätigt, ist sie eine.
 *
 * Gemessen und VERWORFEN (damit niemand dieselben Wege noch einmal
 * geht, siehe README):
 *   - Vorlauf an den Einkaufsabstand koppeln statt fest: F1 58,7 %
 *     gegen 59,1 % — kein Gewinn.
 *   - Vertrauensschwelle von 0,40 auf 0,25 senken: im Rückvergleich
 *     126 übersehene Käufe weniger, im Drei-Jahres-Lauf aber 53
 *     zusätzliche Tage mit leerem Schrank. Ursache: zu frühe
 *     Vorschläge lösen „Hab noch" aus, das verlängert den gelernten
 *     Rhythmus, und danach kommt das Produkt zu spät.
 *   - Stichprobengröße als Wurzel statt als Gerade werten (n=1
 *     Intervall zählte nur ein Viertel, obwohl gerade die erste
 *     Wiederholung am meisten aussagt): im Rückvergleich der beste
 *     bisher gemessene Stand — Trefferquote 80,7 % statt 77,7 %, in
 *     den ersten zwanzig Käufen sogar 17,2 % statt 4,8 %, und reife
 *     Haushalte blieben unberührt (84,2 % -> 84,5 %). Im
 *     Drei-Jahres-Lauf trotzdem 75 zusätzliche Leertage. Der Schaden
 *     entsteht IM Kaltstart und bleibt danach: die zu früh
 *     vorgeschlagenen Produkte lösen „Hab noch" aus, der gelernte
 *     Rhythmus wird länger, und der Haushalt kommt davon nicht mehr
 *     los. Dass die reife Phase sauber aussieht, hat genau nichts zu
 *     bedeuten — sie erbt einen bereits verdorbenen Takt.
 *   - Den Vorlauf am Vertrauen bemessen (Vorlauf = Einstellung x
 *     Vertrauen), als Gegenmittel gegen ebenjene Schleife: sah im
 *     Rückvergleich auf jeder Achse besser aus als der Ausgangsstand
 *     (Genauigkeit 49,3 %, Trefferquote 78,3 %, F1 60,5 %) und
 *     scheiterte trotzdem — 1786 statt 1696 Leertage. Ohne die
 *     Wurzel darüber immer noch 1719. Das Mittel wirkt also nicht
 *     gegen die Ursache: es kürzt den Vorlauf ALLER Produkte, auch
 *     der gut belegten, und verliert dort mehr, als es im Kaltstart
 *     gewinnt.
 *   - Nach Rhythmuslänge statt nach Überfälligkeit sortieren: hebt
 *     die Genauigkeit der ersten Zeile von 40,9 % auf 58,6 % — aber
 *     die Kennzahl belohnt, das Offensichtliche zuerst zu nennen.
 *     An Milch erinnert sich jeder; der Wert einer Liste liegt beim
 *     Unregelmäßigen. Die Simulation vergisst gleichmäßig und kann
 *     den Unterschied nicht messen, also bleibt es beim Bisherigen.
 * ================================================================
 */
const { haushalt } = require("./fixtures/haushalte");
const { computeAllRhythms, computeRhythm, daysBetween } = require("../src/algo/rhythmEngine2");
const { effectiveLookahead } = require("../src/algo/shoppingDay");
const { isNonFood } = require("../src/algo/nonFoodCatalog");

let pass = 0, fail = 0;
const problems = [];
function t(name, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) { pass++; return; }
    fail++; problems.push(`${name}: ${r}`);
    console.log(`  FEHL  ${name}\n        ${r}`);
  } catch (e) {
    fail++; problems.push(`${name}: ABSTURZ ${e.message}`);
    console.log(`  KNALL ${name}\n        ${e.stack.split("\n").slice(0, 3).join("\n        ")}`);
  }
}
const section = (s) => console.log(`\n--- ${s} ---`);
const pct = (x) => `${(x * 100).toFixed(1)} %`;

/* Dieselbe Auswahlregel wie in `compute()` (data.js). Absichtlich
   hier gespiegelt statt importiert: data.js ist eine Browser-Datei
   ohne Modulausgang. Ein Test hält das fest -- weicht die Regel dort
   ab, muss auch diese Zeile nachgezogen werden. */
function listeFuer(rhythms, ref, lookahead = 3) {
  const out = [];
  for (const [pid, r] of rhythms) {
    if (isNonFood(pid)) continue;
    if (!r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) continue;
    const since = daysBetween(r.lastPurchaseDate, ref);
    if (r.rhythmDays - since > effectiveLookahead(r.rhythmDays, lookahead)) continue;
    out.push(pid);
  }
  return out;
}

const HAUSHALTE = [];
for (let s = 1; s <= 14; s++) HAUSHALTE.push(haushalt(s * 7919));

let treffer = 0, fehlalarm = 0, uebersehen = 0, einkaufstage = 0;
let spaeterDochGekauft = 0, nieGekauft = 0;
let listeSumme = 0, korbSumme = 0;
const leereListen = [];

HAUSHALTE.forEach((H, idx) => {
  const tage = [...new Set(H.map((h) => h.date))].sort();
  tage.forEach((tag) => {
    const davor = H.filter((h) => h.date < tag);
    if (davor.length < 40) return;
    const heute = new Set(H.filter((h) => h.date === tag).map((h) => h.productId));
    if (heute.size === 0) return;
    einkaufstage++;

    const liste = new Set(listeFuer(computeAllRhythms(davor, { ref: tag }), tag));
    listeSumme += liste.size;
    korbSumme += heute.size;
    if (liste.size === 0) leereListen.push(`${idx}/${tag}`);

    const grenze = new Date(Date.parse(tag) + 14 * 86400000).toISOString().slice(0, 10);
    liste.forEach((id) => {
      if (heute.has(id)) { treffer++; return; }
      fehlalarm++;
      if (H.some((h) => h.productId === id && h.date > tag && h.date <= grenze)) spaeterDochGekauft++;
      else nieGekauft++;
    });
    heute.forEach((id) => { if (!liste.has(id)) uebersehen++; });
  });
});

const praezision = treffer / (treffer + fehlalarm);
const trefferquote = treffer / (treffer + uebersehen);
const f1 = 2 * praezision * trefferquote / (praezision + trefferquote);

console.log(`\n${HAUSHALTE.length} Haushalte, ${einkaufstage} Einkaufstage nachgerechnet.`);
console.log(`  Treffer ${treffer} · Fehlalarm ${fehlalarm} · Übersehen ${uebersehen}`);
console.log(`  Genauigkeit ${pct(praezision)} · Trefferquote ${pct(trefferquote)} · F1 ${pct(f1)}`);
console.log(`  Liste im Schnitt ${(listeSumme / einkaufstage).toFixed(1)} Positionen, ` +
  `Einkauf ${(korbSumme / einkaufstage).toFixed(1)}`);

// ================================================================
section("A: Die Liste findet, was gebraucht wird");

t(`Trefferquote mindestens 75 % — gemessen ${pct(trefferquote)}`,
  () => trefferquote >= 0.75 ? true : pct(trefferquote));

/* Eine leere Liste ist nicht per se ein Fehler: wer alle zwei Tage
   mit kleinem Korb einkauft, hat an manchen Tagen schlicht nichts
   offen. Nachgesehen, statt es als Fehler zu buchen -- alle zwölf
   Fälle stammen von Haushalten mit zwei bis fünf Tagen Einkaufs-
   abstand und zwei bis vier Positionen je Einkauf. Dort ist Schweigen
   die ehrliche Antwort, und die App hat für solche Tage andere
   Karten. Was dieser Test verhindert, ist der Rückschritt: wenn
   plötzlich JEDER zwanzigste Einkauf ohne Vorschlag dasteht, stimmt
   etwas mit der Auswahl nicht. */
const anteilLeer = leereListen.length / einkaufstage;
t(`Höchstens 3 % der Einkaufstage stehen ganz ohne Vorschlag da — gemessen ${pct(anteilLeer)}`,
  () => anteilLeer <= 0.03 ? true : `${leereListen.length} von ${einkaufstage}, z. B. ${leereListen.slice(0, 3).join(", ")}`);

// ================================================================
section("B: Was „Genauigkeit“ hier wirklich heißt");

/* Die rohe Genauigkeit von rund 47 % sieht schlecht aus und ist es
   nicht. Zwei Gründe, beide gemessen:

   1. Sie ist STRUKTURELL gedeckelt. Die Liste nennt im Schnitt 5,7
      Positionen, der Einkauf umfasst 3,5 — mehr als etwa 61 % kann
      selbst ein perfekter Algorithmus nicht treffen, weil der
      Haushalt an einem Tag gar nicht alles kauft, was fällig ist.
   2. Vier von fünf „Fehlalarmen" werden binnen zwei Wochen doch
      gekauft. Der Vorschlag war also berechtigt, nur früh.

   Deshalb prüft dieser Abschnitt nicht die rohe Zahl, sondern die
   beiden Aussagen dahinter. */
const obergrenze = Math.min(1, korbSumme / listeSumme);
t(`Die rohe Genauigkeit erreicht ihre strukturelle Obergrenze zu mindestens 75 % — ` +
  `${pct(praezision)} von möglichen ${pct(obergrenze)}`,
() => praezision / obergrenze >= 0.75 ? true : `${pct(praezision)} von ${pct(obergrenze)}`);

const anteilSpaeter = spaeterDochGekauft / (spaeterDochGekauft + nieGekauft);
t(`Mindestens 70 % der Fehlalarme werden binnen 14 Tagen doch gekauft — gemessen ${pct(anteilSpaeter)}`,
  () => anteilSpaeter >= 0.70 ? true : pct(anteilSpaeter));

// ================================================================
section("C: Die Liste bleibt kurz genug, um gelesen zu werden");

t(`Im Schnitt höchstens 8 Positionen — gemessen ${(listeSumme / einkaufstage).toFixed(1)}`,
  () => listeSumme / einkaufstage <= 8 ? true : (listeSumme / einkaufstage).toFixed(1));

/* Eine Liste, die deutlich länger ist als der Einkauf, ist keine
   Liste mehr, sondern ein Katalog. */
t(`Höchstens doppelt so lang wie der tatsächliche Einkauf — ` +
  `${(listeSumme / einkaufstage).toFixed(1)} zu ${(korbSumme / einkaufstage).toFixed(1)}`,
() => listeSumme <= korbSumme * 2 ? true : `${(listeSumme / korbSumme).toFixed(2)}-fach`);

// ================================================================
section("D: Der Vorlauf bleibt gedeckelt — die wichtigste Sicherung");

/* Warum das hier steht: der Rückvergleich oben würde einen größeren
   Vorlauf JEDES MAL belohnen (mehr Vorschläge, mehr Treffer). Er kann
   den Preis dafür nicht sehen. Der Preis steht in shoppingDay.js: ein
   zu großer Vorlauf lässt den Haushalt früher kaufen, verkürzt den
   gelernten Rhythmus und zieht den nächsten Vorschlag noch weiter vor
   — bis die App mehr Verderb erzeugt als ein Haushalt ganz ohne App.
   Diese Prüfung hält die Deckelung gegen genau die Kennzahl fest, die
   sie aufzuweichen empfehlen würde. */
t("Der Vorlauf nimmt nie mehr als ein gutes Drittel des Zyklus vorweg", () => {
  const faelle = [[7, 30], [14, 30], [3, 30], [60, 30]];
  const schlecht = faelle.filter(([rhythmus, wunsch]) =>
    effectiveLookahead(rhythmus, wunsch) > rhythmus * 0.35 + 1e-9);
  return schlecht.length === 0 ? true : JSON.stringify(schlecht);
});

t("Und nie mehr, als eingestellt ist", () => {
  const schlecht = [[7, 2], [30, 1], [10, 0]].filter(([rh, w]) => effectiveLookahead(rh, w) > w);
  return schlecht.length === 0 ? true : "Vorlauf über der Einstellung";
});

// ================================================================
section("E: Der Kaltstart — was ein neuer Haushalt zu sehen bekommt");

/* Der Rückvergleich oben überspringt die ersten 40 Käufe. Genau dort
   ist die App aber am schwächsten, und genau dort entscheidet sich,
   ob jemand sie behält. Deshalb hier ohne Aufwärmfilter, nach
   Erfahrungsalter aufgeschlüsselt. Die Zahlen sind kein Ruhmesblatt
   und sollen es auch nicht sein — sie stehen hier, damit die
   Schwäche benannt und messbar ist statt unsichtbar. */
const STUFEN = [[0, 20], [20, 40], [40, 80], [80, 1e9]];
const kalt = STUFEN.map(() => ({ tr: 0, ue: 0 }));
HAUSHALTE.forEach((H) => {
  const tage = [...new Set(H.map((h) => h.date))].sort();
  tage.forEach((tag) => {
    const davor = H.filter((h) => h.date < tag);
    if (davor.length < 5) return;
    const heute = new Set(H.filter((h) => h.date === tag).map((h) => h.productId));
    if (heute.size === 0) return;
    const si = STUFEN.findIndex(([a, b]) => davor.length >= a && davor.length < b);
    const liste = new Set(listeFuer(computeAllRhythms(davor, { ref: tag }), tag));
    heute.forEach((id) => { if (liste.has(id)) kalt[si].tr++; else kalt[si].ue++; });
  });
});
const quote = (i) => kalt[i].tr / (kalt[i].tr + kalt[i].ue);
console.log("\n  Erfahrung        Trefferquote");
STUFEN.forEach(([a, b], i) => console.log(
  `  ${(b > 1e8 ? `ab ${a} Käufen` : `${a}-${b} Käufe`).padEnd(16)} ${pct(quote(i))}`));

/* Die Trefferquote muss mit der Erfahrung STEIGEN. Fällt sie
   irgendwo, lernt die App aus mehr Daten schlechter statt besser —
   das wäre ein Fehler, keine Kinderkrankheit. */
t("Mehr Erfahrung heißt nie schlechtere Vorschläge", () => {
  const brueche = STUFEN.map((_, i) => i).slice(1)
    .filter((i) => quote(i) < quote(i - 1) - 0.01);
  return brueche.length === 0 ? true
    : `Rückschritt bei Stufe ${brueche.join(", ")}`;
});

/* Untergrenzen als Rückschrittsicherung, knapp unter dem heute
   Gemessenen (4,8 % / 27,5 % / 54,5 %): sie sollen einen echten
   Verfall melden, nicht bei jeder Nachkommastelle anschlagen.

   Dass die erste Schwelle bei 4 % steht, ist kein Zielwert, sondern
   ein Befund: in den ersten zwanzig Käufen findet die Liste so gut
   wie nichts. Der Grund ist strukturell — ein Produkt braucht vier
   Intervalle, also fünf Käufe, für volles Vertrauen, und so weit ist
   in Woche eins kein einziges. Zwei Anläufe, das zu heben, sind am
   Drei-Jahres-Lauf gescheitert (siehe Kopf dieser Datei). Solange das
   so ist, gehört die Zahl sichtbar hierher und nicht in eine Fußnote. */
t(`In den ersten 20 Käufen wenigstens 4 % — gemessen ${pct(quote(0))}`,
  () => quote(0) >= 0.04 ? true : pct(quote(0)));
t(`Nach 40 Käufen wenigstens 50 % — gemessen ${pct(quote(2))}`,
  () => quote(2) >= 0.50 ? true : pct(quote(2)));

// ================================================================
section("F: Die Streuungs-Stützung für dünn belegte Produkte");

/* Ein Produkt mit zwei, drei Käufen wurde zweimal bestraft: einmal
   offen über die Stichprobengröße, und einmal verdeckt, weil seine
   gemessene Streuung bei so wenigen Werten fast nur Rauschen ist.
   Die Stützung mischt deshalb den Erfahrungswert DIESES Haushalts
   dazu. Diese Prüfungen halten die drei Eigenschaften fest, auf die
   es dabei ankommt. */

/* Käufe aus einer Liste von Abständen bauen — so steht die Streuung
   ausdrücklich im Test und ist nicht Nebenwirkung einer Formel.
   (Abwechselnde Abstände wie 19,1,19,1 wären KEIN unsteter Haushalt:
   der Median trifft dort den häufigeren Wert, und die MAD fällt auf
   null. Deshalb hier echte, ungleiche Abstände.) */
const kaeufe = (id, abstaende) => {
  let t0 = Date.parse("2026-01-01");
  const out = [{ productId: id, date: "2026-01-01", quantity: 1 }];
  abstaende.forEach((d) => {
    t0 += d * 86400000;
    out.push({ productId: id, date: new Date(t0).toISOString().slice(0, 10), quantity: 1 });
  });
  return out;
};
const REGELMAESSIG = [10, 10, 10, 10, 10];
const UNSTET = [3, 17, 8, 22, 5];
const NEU = [7, 9];                  // zwei Intervalle, leicht schwankend

const bauHaushalt = (abstaende) => [
  ...kaeufe("a", abstaende), ...kaeufe("b", abstaende),
  ...kaeufe("c", abstaende), ...kaeufe("d", abstaende),
  ...kaeufe("neu", NEU)
];
const alleinConfidence = (H, id) =>
  computeRhythm(H.filter((h) => h.productId === id)).confidence;

t("Ein regelmäßiger Haushalt vertraut einem neuen Produkt schneller", () => {
  const H = bauHaushalt(REGELMAESSIG);
  const mit = computeAllRhythms(H).get("neu").confidence;
  const ohne = alleinConfidence(H, "neu");
  return mit > ohne ? true : `mit Stützung ${mit}, ohne ${ohne}`;
});

t("Ein unsteter Haushalt bleibt dagegen vorsichtig — die Stützung wirkt in beide Richtungen", () => {
  const H = bauHaushalt(UNSTET);
  const mit = computeAllRhythms(H).get("neu").confidence;
  const ohne = alleinConfidence(H, "neu");
  return mit < ohne ? true : `mit Stützung ${mit}, ohne ${ohne} — hätte fallen müssen`;
});

t("Gut belegte Produkte bleiben unberührt", () => {
  const H = bauHaushalt(REGELMAESSIG);
  const alle = computeAllRhythms(H);
  const schlecht = ["a", "b", "c", "d"]
    .filter((id) => alle.get(id).confidence !== alleinConfidence(H, id));
  return schlecht.length === 0 ? true : `verändert: ${schlecht.join(", ")}`;
});

/* Ohne genug belastbare Produkte gibt es kein Vorwissen — dann muss
   alles bleiben, wie es war. Sonst würde die Stützung sich auf einen
   einzelnen Zufallswert stützen. */
t("Ohne genug belastbare Produkte bleibt alles beim Alten", () => {
  const H = [...kaeufe("neu", NEU), ...kaeufe("auch_neu", [9, 7])];
  const mit = computeAllRhythms(H).get("neu").confidence;
  const ohne = alleinConfidence(H, "neu");
  return mit === ohne ? true : `${mit} statt ${ohne}`;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`LISTE: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
