/* ================================================================
   views.js — die einzelnen Ansichten.

   Grundsatz für die Gestaltung: die Fläche zeigt Zahlen und
   Entscheidungen, keine Erklärungen. Alles, was erklärt, steckt
   hinter einem (i) oder im Detail-Blatt einer Zeile. Ehrlichkeit
   geht dabei nicht verloren — Quellen, Schätzcharakter und
   Datenqualität stehen weiterhin da, nur eine Tippgeste entfernt.

   Fachlogik steht hier keine: jede Zahl kommt aus Data.compute().
   ================================================================ */

/* ---------- kleine Helfer ---------- */
// eur() steht im Bündel (listExport.js) — hier nicht noch einmal.
const pct = (n) => Math.round((Number(n) || 0) * 100) + " %";
/** Zahl mit deutschem Dezimalkomma. Die Module liefern Zahlen, keine
    Zeichenketten — die Schreibweise entscheidet die Oberfläche. */
const de = (n) => String(n).replace(".", ",");
const sign = (n) => (n > 0 ? "+" : "") + de(n);
/**
 * Tage mit richtiger Einzahl.
 *
 * An vier Stellen stand `n === 1 ? "Tag" : "Tage"` ausgeschrieben, an
 * mindestens sechs anderen nur „Tage“ — und die trafen alle
 * regelmäßig die Eins: ein gelernter Rhythmus von einem Tag (Brot,
 * Milch), ein Vorrat, der noch einen Tag reicht, Hackfleisch, das
 * angebrochen einen Tag hält. „noch 1 Tage“ stand also nicht in
 * einem Randfall, sondern jeden Tag irgendwo auf dem Bildschirm.
 *
 * Eine Beugung, eine Stelle. Ausgeschriebene Bedingungen an zehn
 * Orten sind kein Zufall, der schiefgeht, sondern einer, der
 * schiefgehen MUSS: die zehnte schreibt sie irgendwann keiner mehr.
 */
const zahlwort = (n, eins, viele) => `${de(n)} ${Number(n) === 1 ? eins : viele}`;
const tage = (n) => zahlwort(n, "Tag", "Tage");
/** Dieselbe Zahl im Dativ: „seit einem Tag“, „fällig in 3 Tagen“. */
const tagen = (n) => zahlwort(n, "Tag", "Tagen");
/** Ein Rhythmus von einem Tag heißt nicht „alle 1 Tage“. */
const alleTage = (n) => (Number(n) === 1 ? "täglich" : `alle ${de(n)} Tage`);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const frag = () => document.createDocumentFragment();
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const deDate = (d) => {
  const [y, m, dd] = String(d).split("-");
  return `${dd}.${m}.${y}`;
};

/* DREI ANTWORTEN, ZWEI FRAGEN.
   ----------------------------------------------------------------
   Es waren vier unter einer Frage, und zwei davon passten dort nicht:

   „VERBRAUCHT" ist ersatzlos weg. Sie bewirkte im ganzen Programm
   exakt dasselbe wie „Diese Woche nicht" — `on: false`, kein Signal
   an den Rhythmus, dieselbe Protokollzeile. Zwei Knöpfe, ein Effekt,
   und keine Möglichkeit zu wissen, welchen man nehmen soll. Dazu
   stand sie inhaltlich verkehrt herum: aufgebraucht ist ein Grund,
   etwas zu KAUFEN, nicht es wegzulassen. (In wasteInference2 steht
   eine `reconcileWithUserInput`, die „verbraucht" als „ich habe es
   gegessen, nicht weggeworfen" auswerten würde — sie wird nirgends
   aufgerufen. Das wäre ein echter Zweck, aber im Bestand, nicht auf
   der Einkaufsliste.)

   „WAR SCHON ALLE" bleibt, steht aber nicht mehr unter „Brauchst du
   das diese Woche?". Sie ist die einzige Antwort dort, die die
   Position DRAUF lässt — man tippt sie an, das Blatt schließt sich,
   und scheinbar passiert nichts. Sie beantwortet auch eine andere
   Frage: nicht „brauchst du das?", sondern „war ich rechtzeitig?".

   Ihr Platz ist jetzt der Moment, in dem sie wahr wird — beim
   Hinzufügen eines Produkts, das noch gar nicht fällig war. Siehe
   `askLate`. Denn sie ist zugleich die WICHTIGSTE: „Hab noch"
   verlängert den gelernten Abstand, und nur diese hier verkürzt ihn.
   Ohne sie könnte der Nutzer nur in eine Richtung korrigieren, und
   die App bliebe systematisch zu spät dran.                        */
const REASONS = [
  { key: "have", label: "Hab noch" },
  { key: "empty", label: "War schon alle" },
  { key: "skip", label: "Diese Woche nicht" }
];

/* Was im Blatt einer Position zur Wahl steht: die Wochenfrage, und
   die beantworten genau diese beiden. */
const WEEK_REASONS = ["have", "skip"];

/* ---------- Gezeichnete Marken ----------
   Fünf Strichzeichnungen für die Meilensteine. Vorher standen dort
   Unicode-Glyphen — bequem, aber sie sehen auf jedem Gerät anders aus,
   passen zu nichts und verraten sofort, dass niemand hingesehen hat.
   Jede Marke bezieht sich auf ihre Sache: ein Keimling für Gerettetes,
   ein Preisschild, ein Kreispfeil, ein Beleg mit abgerissener Kante,
   eine Strichliste. */
const MARKS = {
  sprout: '<path d="M12 21v-9"/><path d="M12 14c0-4.4 3.1-7.5 7.5-7.5C19.5 10.9 16.4 14 12 14z"/>' +
          '<path d="M12 17c0-3.3-2.5-5.8-5.8-5.8C6.2 14.5 8.7 17 12 17z"/>',
  tag: '<path d="M12.8 3.2H20v7.2l-9.2 9.2L3.6 12.4l9.2-9.2z"/><circle cx="16.6" cy="7.4" r="1.3"/>',
  cycle: '<path d="M4.2 11.2A8 8 0 0117.6 6"/><path d="M19.8 12.8A8 8 0 016.4 18"/>' +
         '<path d="M17.6 2.6V6h-3.4"/><path d="M6.4 21.4V18h3.4"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  tally: '<path d="M5 6.5v11M9 6.5v11M13 6.5v11M17 6.5v11"/><path d="M3.4 17.6L18.6 6.4"/>'
};

const markSvg = (key) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${MARKS[key] || MARKS.receipt}</svg>`;

/* ================================================================
   Das Wesen — ein Begleiter, keine Illustration
   ================================================================
   PLATZHALTER-FORM, ausdrücklich: die erste von zehn Varianten
   ("Organischer Blob"), die dem Referenzbild vorgezogen wurde, bis
   echtes Bild-/Videomaterial existiert (siehe README, "Das Wesen").
   Wenn dieses Material da ist, ersetzt es NUR die Körperform bzw.
   den Loop — Stimmungslogik (mascotMood), Platzierung und die
   Interaktionen unten bleiben unverändert, weil sie an der Fachlogik
   hängen, nicht an der Zeichnung.
   ================================================================ */
const MASCOT_BODY_PATH = "M50,8 C68,6 88,18 92,40 C96,64 84,88 60,94 C38,99 14,88 8,64 " +
  "C3,42 14,18 34,10 C39,8 45,9 50,8 Z";

const MASCOT_FACE = {
  froh: {
    browL: "M33,39 Q38,35 44,38", browR: "M56,38 Q62,35 67,39",
    mouth: '<path class="mascotMouth filled" d="M39,63 Q50,76 61,63 Q50,71 39,63 Z"/>'
  },
  neutral: {
    browL: "M33,38 L44,38", browR: "M56,38 L67,38",
    mouth: '<path class="mascotMouth" d="M42,65 Q50,68.5 58,65"/>'
  },
  besorgt: {
    browL: "M33,40 L44,34", browR: "M67,40 L56,34",
    mouth: '<path class="mascotMouth" d="M42,67 Q50,63.5 58,67"/>'
  },
  alarm: {
    browL: "M32,42 L44,32", browR: "M68,42 L56,32",
    mouth: '<ellipse class="mascotMouth filled" cx="50" cy="66" rx="5" ry="6.5"/>'
  }
};

/**
 * Baut das Wesen als eigenständiges SVG. `mood` eine der vier
 * Stimmungen aus MASCOT_FACE — unbekannte fallen auf "neutral".
 */
function mascotSvg(mood, size = 58) {
  // Dieselbe Rückfallregel für Ausdruck UND Farbe -- sonst bekäme eine
  // unbekannte Stimmung ein neutrales Gesicht ohne jede Mundfarbe, weil
  // app.css nur die vier benannten Klassen mit --m-body/--m-eye belegt.
  const gueltig = MASCOT_FACE[mood] ? mood : "neutral";
  const face = MASCOT_FACE[gueltig];
  const eye = (cx) =>
    `<g class="mascotBlink">` +
    `<ellipse class="mascotEyeWhite" cx="${cx}" cy="50" rx="8.5" ry="10.5"/>` +
    `<circle class="mascotPupil" cx="${cx}" cy="51" r="4"/>` +
    `<circle class="mascotPupil" cx="${cx - 2}" cy="47.5" r="1.4" opacity=".8"/>` +
    `</g>`;
  return `<svg class="mascot ${gueltig}" viewBox="0 0 100 100" width="${size}" height="${size}" ` +
    `aria-hidden="true" focusable="false">` +
    `<path class="mascotBody" d="${MASCOT_BODY_PATH}"/>` +
    `<ellipse class="mascotCheek" cx="27" cy="66" rx="6.5" ry="4.5"/>` +
    `<ellipse class="mascotCheek" cx="73" cy="66" rx="6.5" ry="4.5"/>` +
    eye(38) + eye(62) +
    `<path class="mascotBrow" d="${face.browL}"/><path class="mascotBrow" d="${face.browR}"/>` +
    face.mouth +
    `</svg>`;
}

/**
 * Welche Stimmung, aus Signalen, die die App schon hat — keines davon
 * neu berechnet, nur neu gelesen. Reihenfolge ist Dringlichkeit:
 * ein akutes Risiko schlägt einen guten Streak.
 */
function mascotMood(ctx) {
  if (ctx.safety) return "alarm";
  const heuteVerdirbt = ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] &&
    ctx.pulse.days[0].events.some((e) => e.kind === "verderb");
  if (heuteVerdirbt) return "alarm";
  if (ctx.forgotten && ctx.forgotten.length) return "besorgt";
  if (ctx.streak && ctx.streak.weeks > 0) return "froh";
  return "neutral";
}

/**
 * Fingerabdruck des akuten Signals, das gerade hinter der Stimmung
 * "alarm" steckt -- dieselbe Rangfolge wie in mascotMood() (Kühlkette
 * schlägt Verderb heute), aber als Zeichenkette statt als Farbe.
 *
 * Dient dem "neu"-Punkt am Wesen: App.mascotSeenAlarm hält fest,
 * welcher Fingerabdruck beim letzten Antippen sichtbar war. Ändert
 * sich das Signal seither (eine andere Kühlketten-Meldung, ein
 * anderer Verderb-Tag), ist er ungleich -- ohne akutes Signal ist er
 * die leere Zeichenkette und zeigt nie einen Punkt.
 */
function mascotAlarmSignature(ctx) {
  if (ctx.safety) return "safety:" + ctx.safety.short;
  const heuteVerdirbt = ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] &&
    ctx.pulse.days[0].events.some((e) => e.kind === "verderb");
  if (heuteVerdirbt) return "verderb:" + ctx.pulse.headline;
  return "";
}

/* ================================================================
   Das Wesen — was es sagt, wenn man es antippt
   ================================================================
   Kein Blatt, keine zweite Erklärseite: eine kleine Sprechblase neben
   dem Wesen (siehe App.toggleMascotBubble() in app.js). Ihr Inhalt
   kommt aus MASCOT_RULES — je Reiter eine Liste von Aussagen, jede an
   eine Bedingung geknüpft, die nur liest, was ctx ohnehin schon hat.
   Keine Zahl wird hier neu geschätzt; jede kommt aus Data.compute()
   oder aus Text, der an anderer Stelle in der App bereits so steht
   (z. B. ctx.streak.message, ctx.brandHeadline.text) — dieselbe Regel
   wie bei PILL_INFO und collectHints(): eine Erklärung, ein Ort.

   mascotMessage() sammelt die zutreffenden Regeln des aktuellen
   Reiters und wählt reihum eine aus, gesteuert vom `seed`, den
   App.toggleMascotBubble() mitgibt (ein Zähler je Reiter, kein
   Zufall) — wiederholtes Antippen zeigt so nacheinander verschiedene,
   aber immer nachvollziehbare Aussagen. Jede Liste endet mit einer
   Regel ohne Bedingung, damit die Sprechblase nie leer bleibt. */
const MASCOT_RULES = {
  start: [
    // Nicht ctx.safety.short -- das steht auf diesem Reiter schon
    // prominent in "Jetzt zu tun" (todoCard()). Ein Antippen im
    // Alarmfall soll etwas sagen, das man dort noch nicht sieht, statt
    // wortgleich zu wiederholen, was zwei Zeilen tiefer schon steht.
    { when: (ctx) => !!ctx.safety, say: (ctx) => `Am besten dorthin: ${ctx.safety.coldestZone}.` },
    { when: (ctx) => ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] &&
        ctx.pulse.days[0].events.some((e) => e.kind === "verderb"),
      say: (ctx) => ctx.pulse.headline },
    { when: (ctx) => ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] &&
        !ctx.pulse.days[0].events.some((e) => e.kind === "verderb") &&
        ctx.pulse.days[0].events.some((e) => e.kind === "tausch"),
      say: () => "Heute steht laut deinem Rhythmus ein Austausch an." },
    { when: (ctx) => ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] &&
        !ctx.pulse.days[0].events.some((e) => e.kind === "verderb") &&
        ctx.pulse.days[0].events.some((e) => e.kind === "einkauf"),
      say: () => "Heute ist laut deinem Rhythmus ein guter Einkaufstag." },
    { when: (ctx) => ctx.pulse && ctx.pulse.days && ctx.pulse.days[0] && ctx.pulse.days[0].count === 0,
      say: () => "Für heute steht nach deinem Rhythmus nichts Bestimmtes an." },
    { when: (ctx) => ctx.forgotten && ctx.forgotten.length > 0,
      say: (ctx) => `${zahlwort(ctx.forgotten.length, "vergessenes Produkt", "vergessene Produkte")} — unter den Hinweisen zu finden.` },
    { when: (ctx) => ctx.freeze && ctx.freeze.length > 0,
      say: (ctx) => `${zahlwort(ctx.freeze.length, "Produkt lohnt", "Produkte lohnen")} sich einzufrieren, bevor es verdirbt.` },
    { when: (ctx) => (ctx.hoards || []).some((h) => h.kind === "zuviel"),
      say: () => "Von etwas liegt gerade mehr da, als bis zur Haltbarkeit aufgebraucht wird." },
    { when: (ctx) => ctx.swapsDue && ctx.swapsDue.some((x) => x.due),
      say: (ctx) => `${zahlwort(ctx.swapsDue.filter((x) => x.due).length, "Produkt ist", "Produkte sind")} zum Tauschen fällig.` },
    { when: (ctx) => ctx.foodDeals && ctx.foodDeals.length > 0,
      say: (ctx) => `${zahlwort(ctx.foodDeals.length, "Lebensmittel war", "Lebensmittel waren")} beim letzten Kauf spürbar günstiger als sonst.` },
    { when: (ctx) => ctx.review && ctx.review.due, say: () => "Dein Wochenrückblick ist fertig." },
    { when: (ctx) => ctx.streak && ctx.streak.weeks > 0, say: (ctx) => ctx.streak.message },
    { when: (ctx) => ctx.streak && ctx.streak.weeks === 0 && ctx.history.length > 0,
      say: () => "Noch kein Lauf am Stück — der nächste vollständige Einkauf startet einen." },
    { when: (ctx) => ctx.badges && ctx.badges.nextUp,
      say: (ctx) => `Auf dem Weg zu „${ctx.badges.nextUp.nextTitle}“: ${Math.round(ctx.badges.nextUp.progress * 100)} %.` },
    { when: (ctx) => ctx.items && ctx.items.some((i) => i.on),
      say: (ctx) => {
        const on = ctx.items.filter((i) => i.on);
        const sum = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
        return `Auf deiner Liste stehen ${zahlwort(on.length, "Position", "Positionen")} für ${eur(sum)}.`;
      } },
    { when: (ctx) => ctx.items && !ctx.items.some((i) => i.on) && ctx.history.length > 0,
      say: () => "Auf deiner Liste steht gerade nichts." },
    { when: (ctx) => ctx.history.length === 0,
      say: () => "Noch keine Einkäufe erfasst — der erste Bon reicht schon für die ersten Zahlen." },
    { when: (ctx) => ctx.history.length > 0 && ctx.stage && ctx.stage.stage < 3,
      say: () => "Die App lernt deinen Rhythmus noch — je mehr Bons, desto genauer wird die Liste." },
    { when: (ctx) => ctx.totals && ctx.totals.receipts > 0,
      say: (ctx) => `Bislang ${zahlwort(ctx.totals.receipts, "Bon", "Bons")} erfasst.` },
    { when: (ctx) => ctx.review && !ctx.review.due && ctx.streak && ctx.streak.weeks === 0 &&
        (!ctx.forgotten || !ctx.forgotten.length),
      say: () => "Ein ruhiger Moment — nichts Dringendes gerade." },
    { when: () => true, say: () => "Gerade steht nichts Dringendes an." }
  ],

  liste: [
    // Dieselbe Überlegung wie beim Reiter "start": ctx.safety.short
    // steht hier schon als dringende Zeile über der Liste (hintsRow()),
    // wenn etwas ansteht -- die Blase ergänzt statt zu wiederholen.
    { when: (ctx) => !!ctx.safety, say: (ctx) => `Am besten dorthin: ${ctx.safety.coldestZone}.` },
    { when: (ctx) => ctx.budgetResult && ctx.budgetResult.removed.length > 0,
      say: (ctx) => `${zahlwort(ctx.budgetResult.removed.length, "Position wurde", "Positionen wurden")} wegen deines Budgets gestrichen.` },
    { when: (ctx) => ctx.vacation && ctx.vacation.skip && ctx.vacation.skip.length > 0,
      say: (ctx) => `Wegen deines Urlaubs sind ${zahlwort(ctx.vacation.skip.length, "Position", "Positionen")} zurückgestellt — das spart ${eur(ctx.vacation.savedEuros)}.` },
    { when: (ctx) => ctx.duplicates && ctx.duplicates.length > 0,
      say: (ctx) => `${zahlwort(ctx.duplicates.length, "Position könnte", "Positionen könnten")} doppelt gekauft werden — vielleicht ist noch etwas da.` },
    { when: (ctx) => ctx.items && ctx.items.filter((i) => !i.on).length > 0,
      say: (ctx) => `${zahlwort(ctx.items.filter((i) => !i.on).length, "Position steht", "Positionen stehen")} unter „Nicht diese Woche“.` },
    { when: (ctx) => ctx.items && ctx.items.some((i) => i.on && i.riskFlag),
      say: (ctx) => `${zahlwort(ctx.items.filter((i) => i.on && i.riskFlag).length, "Position bleibt", "Positionen bleiben")} öfter übrig — halbe Menge könnte sich lohnen.` },
    { when: (ctx) => ctx.items && ctx.items.some((i) => i.on && i.basis === "manuell"),
      say: (ctx) => `${zahlwort(ctx.items.filter((i) => i.on && i.basis === "manuell").length, "Position hast", "Positionen hast")} du selbst ergänzt.` },
    { when: (ctx) => ctx.items && ctx.items.some((i) => i.on && i.dueIn !== null && i.dueIn < 0),
      say: (ctx) => `${zahlwort(ctx.items.filter((i) => i.on && i.dueIn !== null && i.dueIn < 0).length, "Position ist", "Positionen sind")} schon überfällig.` },
    { when: (ctx) => ctx.stage && ctx.stage.stage <= 1 && ctx.history.length > 0,
      say: (ctx) => `${zahlwort(ctx.totals.receipts, "Bon", "Bons")} erfasst — ab dem zweiten Kauf je Produkt lernt die App deinen Rhythmus.` },
    { when: (ctx) => ctx.stage && ctx.stage.stage <= 1 && ctx.history.length === 0,
      say: () => "Noch keine Einkäufe erfasst — bis dahin ist das hier deine ganz normale Einkaufsliste." },
    { when: (ctx) => ctx.items && ctx.items.filter((i) => i.on).length > 0,
      say: (ctx) => {
        const on = ctx.items.filter((i) => i.on);
        const sum = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
        return `${zahlwort(on.length, "Position", "Positionen")} im Wert von ${eur(sum)}.`;
      } },
    { when: (ctx) => ctx.items && ctx.items.length === 0,
      say: () => "Die Liste ist leer — unten lässt sich etwas hinzufügen." },
    { when: (ctx) => ctx.forgotten && ctx.forgotten.length > 0,
      say: (ctx) => `${zahlwort(ctx.forgotten.length, "Produkt fehlt", "Produkte fehlen")} dir vielleicht — sieh bei den Hinweisen nach.` },
    { when: (ctx) => ctx.freeze && ctx.freeze.length > 0,
      say: () => "Einfrieren rettet manches, das sonst verdirbt, bevor es wieder auf die Liste kommt." },
    { when: (ctx) => ctx.season && ctx.season.length > 0,
      say: (ctx) => `${ctx.season[0].name} hat gerade keine Saison hier — Importware.` },
    { when: (ctx) => !!ctx.ethylene,
      say: () => "Manches auf deiner Liste lässt anderes schneller reifen — getrennt lagern hilft." },
    { when: (ctx) => ctx.pattern && ctx.pattern.dayName,
      say: (ctx) => `Du kaufst meist ${ctx.pattern.dayName} ein.` },
    { when: (ctx) => ctx.items && ctx.items.some((i) => i.on) && (!ctx.duplicates || !ctx.duplicates.length) && !ctx.safety,
      say: () => "Auf den ersten Blick nichts Auffälliges auf der Liste." },
    { when: (ctx) => !!ctx.store, say: (ctx) => `Zuletzt bei ${ctx.store} eingekauft — „Nach Gängen“ sortiert danach.` },
    { when: (ctx) => !ctx.store, say: () => "Noch kein Markt bekannt — „Nach Gängen“ sortiert, sobald einer feststeht." },
    { when: () => true, say: () => "Was hier steht, kommt aus deinem gelernten Rhythmus oder von dir selbst." }
  ],

  bestand: [
    { when: (ctx) => (!ctx.inventory || !ctx.inventory.length) && (!ctx.supplies || !ctx.supplies.length),
      say: () => "Noch kein Bestand zu schätzen." },
    { when: (ctx) => ctx.opened && ctx.opened.some((o) => o.expired),
      say: (ctx) => `${zahlwort(ctx.opened.filter((o) => o.expired).length, "angebrochene Packung ist", "angebrochene Packungen sind")} über der Frist.` },
    { when: (ctx) => ctx.opened && ctx.opened.some((o) => !o.expired && o.urgent),
      say: (ctx) => `${zahlwort(ctx.opened.filter((o) => !o.expired && o.urgent).length, "angebrochene Packung wird", "angebrochene Packungen werden")} bald knapp.` },
    { when: (ctx) => ctx.opened && ctx.opened.length === 0 && ctx.inventory && ctx.inventory.length > 0,
      say: () => "Gerade nichts angebrochen." },
    { when: (ctx) => ctx.opened && ctx.opened.length > 0,
      say: (ctx) => `${zahlwort(ctx.opened.length, "Packung ist", "Packungen sind")} gerade angebrochen markiert.` },
    { when: (ctx) => ctx.inventory && ctx.inventory.some((i) => i.daysLeft <= 2),
      say: (ctx) => `${zahlwort(ctx.inventory.filter((i) => i.daysLeft <= 2).length, "Produkt hält", "Produkte halten")} vermutlich nur noch kurz.` },
    { when: (ctx) => ctx.range && ctx.range.days !== null,
      say: (ctx) => `Dein Vorrat reicht geschätzt noch ${tage(Math.round(ctx.range.days))}.` },
    { when: (ctx) => ctx.range && ctx.range.days !== null && ctx.range.days < 3,
      say: () => "Dein Vorrat wird knapp." },
    { when: (ctx) => ctx.supplies && ctx.supplies.some((s) => s.dueForPurchase),
      say: (ctx) => `${zahlwort(ctx.supplies.filter((s) => s.dueForPurchase).length, "Haushaltsprodukt geht", "Haushaltsprodukte gehen")} bald aus.` },
    { when: (ctx) => ctx.supplies && ctx.supplies.length > 0 && !ctx.supplies.some((s) => s.dueForPurchase),
      say: () => "Bei den Haushaltsprodukten ist gerade nichts fällig." },
    { when: (ctx) => ctx.inventory && ctx.inventory.length > 0,
      say: (ctx) => `Dein geschätzter Bestand ist gerade ${eur(ctx.inventory.reduce((a, i) => a + i.value, 0))} wert.` },
    { when: (ctx) => ctx.swapsDue && ctx.swapsDue.some((x) => x.due),
      say: () => "Ein paar Haushaltsprodukte sind zum Tauschen fällig — unter „Fällig“." },
    { when: (ctx) => (ctx.hoards || []).some((h) => h.kind === "zuviel"),
      say: () => "Von etwas liegt mehr da, als bis zur Haltbarkeit aufgebraucht wird." },
    { when: () => Data.get().settings.vacation.active,
      say: () => "Urlaubsmodus ist an — was bis zur Rückkehr verderben würde, steht unter „Vor der Abreise“." },
    { when: (ctx) => ctx.chronic && ctx.chronic.length > 0,
      say: (ctx) => `${zahlwort(ctx.chronic.length, "Produkt bleibt", "Produkte bleiben")} bei dir öfter übrig, als es müsste.` },
    { when: (ctx) => ctx.range && ctx.range.byProduct && ctx.range.byProduct.length > 0,
      say: () => "Jedes Produkt im Bestand hat sein eigenes Detail-Blatt mit Reichweite und Sicherheit." },
    { when: (ctx) => ctx.knownItems && ctx.knownItems.filter((i) => i.on).length > 0,
      say: () => "Unter „Kochen“ stehen Rezepte, sortiert nach gerettetem Betrag, nicht nach Geschmack." },
    { when: () => true,
      say: () => "Der Bestand hier ist eine Schätzung — Einkauf minus gelernten Verbrauch, kein gezählter Kühlschrank." }
  ],

  erfassen: [
    { when: (ctx) => ctx.history.length === 0, say: () => "Dein erster Bon macht sofort deine Ausgaben sichtbar." },
    { when: (ctx) => ctx.history.length > 0 && ctx.totals.receipts < 5,
      say: (ctx) => `Bislang ${zahlwort(ctx.totals.receipts, "Bon", "Bons")} erfasst — je mehr, desto genauer wird der Rhythmus.` },
    { when: (ctx) => ctx.totals && ctx.totals.receipts >= 5,
      say: (ctx) => `${zahlwort(ctx.totals.receipts, "Bon", "Bons")} sind schon erfasst.` },
    { when: (ctx) => ctx.stage && ctx.stage.stage >= 3,
      say: () => "Dein Rhythmus ist gelernt — jeder neue Bon schärft ihn weiter nach." },
    { when: () => Data.get().settings.demo,
      say: () => "Das sind erzeugte Beispieldaten. Ein eigener Bon ersetzt sie." },
    { when: (ctx) => !!ctx.safety, say: (ctx) => ctx.safety.short },
    { when: () => OCR.supported(), say: () => "Ein Foto des Bons reicht — Beträge und Mengen liest die App direkt heraus." },
    { when: () => !OCR.supported(), say: () => "Dieser Browser liest Fotos nicht automatisch — von Hand eintragen geht trotzdem." },
    { when: (ctx) => ctx.rhythms && ctx.rhythms.size > 0,
      say: (ctx) => `Für ${zahlwort(ctx.rhythms.size, "Produkt", "Produkte")} hat die App schon einen Rhythmus gelernt.` },
    { when: (ctx) => ctx.streak && ctx.streak.weeks > 0, say: (ctx) => ctx.streak.message },
    { when: (ctx) => ctx.duplicates && ctx.duplicates.length > 0,
      say: () => "Nach dem Erfassen lohnt sich ein Blick auf die Liste — manches könnte doppelt gekauft werden." },
    { when: (ctx) => ctx.forgotten && ctx.forgotten.length > 0,
      say: (ctx) => `${zahlwort(ctx.forgotten.length, "Produkt fehlt", "Produkte fehlen")} dir vielleicht schon.` },
    { when: (ctx) => ctx.review && ctx.review.due, say: () => "Dein Wochenrückblick wartet schon — er läuft nicht weg." },
    { when: (ctx) => ctx.totals && ctx.totals.spendPerWeek > 0,
      say: (ctx) => `Im Schnitt gibst du ${eur(ctx.totals.spendPerWeek)} pro Woche aus.` },
    { when: () => true, say: () => "Jeder Bon zählt — die App merkt sich Preise, Rhythmus und Menge daraus." }
  ],

  zahlen: [
    { when: (ctx) => ctx.history.length === 0, say: () => "Noch keine Zahlen — der erste Bon reicht für die ersten." },
    { when: (ctx) => ctx.totals && ctx.totals.receipts > 0,
      say: (ctx) => `Im Schnitt gibst du ${eur(ctx.totals.spendPerWeek)} pro Woche aus, über ${zahlwort(ctx.totals.receipts, "Bon", "Bons")}.` },
    { when: (ctx) => ctx.savings && ctx.savings.length > 0,
      say: (ctx) => `Unter „Sparen“ stehen ${eur(ctx.savings.reduce((a, x) => a + x.estimatedWeeklySaving, 0))} pro Woche zum Mitnehmen — ohne Verzicht.` },
    { when: (ctx) => ctx.savings && ctx.savings.length === 0 && ctx.history.length > 0,
      say: () => "Gerade keine Sparvorschläge — nichts Auffälliges in deinen Zahlen." },
    { when: (ctx) => ctx.totals && ctx.totals.wastedPerWeek > 0,
      say: (ctx) => `Geschätzter Verlust: ${eur(ctx.totals.wastedPerWeek)} pro Woche, ${de(ctx.impact.kg)} kg insgesamt.` },
    { when: (ctx) => ctx.totals && ctx.totals.wastedPerWeek === 0 && ctx.history.length > 0,
      say: () => "Gerade kein geschätzter Verlust in deinen Zahlen." },
    { when: (ctx) => ctx.rhythms && ctx.rhythms.size > 0,
      say: (ctx) => `Für ${[...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length} von ${ctx.rhythms.size} Produkten ist der Rhythmus schon gut belegt.` },
    { when: (ctx) => ctx.rhythms && ctx.rhythms.size === 0, say: () => "Noch keine Rhythmen gelernt." },
    { when: (ctx) => ctx.streak && ctx.streak.weeks > 0, say: (ctx) => ctx.streak.message },
    { when: (ctx) => ctx.badges && ctx.badges.total > 0,
      say: (ctx) => `${ctx.badges.count} von ${ctx.badges.total} Meilensteinen erreicht.` },
    { when: (ctx) => ctx.badges && ctx.badges.count === ctx.badges.total && ctx.badges.total > 0,
      say: () => "Alle bisherigen Meilensteine erreicht." },
    { when: (ctx) => ctx.badges && ctx.badges.nextUp,
      say: (ctx) => `Bis „${ctx.badges.nextUp.nextTitle}“ fehlen noch ${100 - Math.round(ctx.badges.nextUp.progress * 100)} %.` },
    { when: (ctx) => ctx.review && !ctx.review.quiet, say: (ctx) => ctx.review.short },
    { when: (ctx) => ctx.review && ctx.review.quiet, say: () => "In der aktuellen Woche ist bisher nichts erfasst." },
    { when: (ctx) => ctx.pattern && ctx.pattern.dayName,
      say: (ctx) => `Du kaufst am häufigsten ${ctx.pattern.dayName} ein, im Schnitt für ${eur(ctx.pattern.avgBasket)}.` },
    { when: (ctx) => ctx.inflation && ctx.inflation.productsCompared,
      say: (ctx) => `Dein Warenkorb hat sich um ${sign(ctx.inflation.changePercent)} % verändert, über ${zahlwort(ctx.inflation.productsCompared, "Produkt", "Produkte")}.` },
    { when: (ctx) => ctx.prices && [...ctx.prices.values()].some((m) => m.verdict === "günstig"),
      say: (ctx) => `${zahlwort([...ctx.prices.values()].filter((m) => m.verdict === "günstig").length, "Produkt lag", "Produkte lagen")} zuletzt unter deinem üblichen Preis.` },
    { when: (ctx) => ctx.prices && [...ctx.prices.values()].some((m) => m.verdict === "teuer"),
      say: (ctx) => `${zahlwort([...ctx.prices.values()].filter((m) => m.verdict === "teuer").length, "Produkt lag", "Produkte lagen")} zuletzt über deinem üblichen Preis.` },
    { when: (ctx) => !!ctx.brandHeadline, say: (ctx) => ctx.brandHeadline.text },
    { when: (ctx) => ctx.nonFoodSaved && ctx.nonFoodSaved.total > 0,
      say: (ctx) => `Bei Haushaltsprodukten hast du schon ${eur(ctx.nonFoodSaved.total)} unter deinem üblichen Grundpreis bezahlt.` },
    { when: (ctx) => ctx.packs && ctx.packs.length > 0,
      say: () => "Bei ein paar Packungsgrößen lohnt sich ein zweiter Blick auf den Grundpreis." },
    { when: (ctx) => ctx.impact && ctx.impact.byProduct && ctx.impact.byProduct.length > 0,
      say: (ctx) => `${ctx.impact.byProduct[0].name} steht oben in der Verschwendungsschätzung.` },
    { when: () => true, say: () => "Alle Zahlen hier kommen aus deinen eigenen Bons, nicht aus allgemeinen Schätzwerten." }
  ],

  mehr: [
    { when: () => Data.get().settings.demo,
      say: () => "Das ist erzeugte Beispieldaten-Historie. Unter „Daten“ lässt sie sich ersetzen." },
    { when: () => Data.get().review.notify, say: () => "Die Erinnerung an den Wochenrückblick ist an." },
    { when: () => !Data.get().review.notify,
      say: () => "Ohne echte Push-Nachrichten meldet sich der Rückblick erst beim nächsten Öffnen." },
    { when: () => Data.get().settings.vacation.active,
      say: () => "Urlaubsmodus ist an — die Liste stellt zurück, was bis zur Rückkehr verderben würde." },
    { when: () => !Data.get().settings.vacation.active, say: () => "Urlaubsmodus ist aus." },
    { when: () => Data.get().settings.budget > 0,
      say: () => `Dein Budget für die Liste steht auf ${eur(Data.get().settings.budget)}.` },
    { when: () => Data.get().settings.budget === 0,
      say: () => "Für die Liste ist kein Budget gesetzt — nichts wird deswegen gestrichen." },
    { when: () => Data.get().settings.household > 1,
      say: () => `Die Mengen sind auf ${Data.get().settings.household} Personen skaliert.` },
    { when: () => Data.get().purchases.length > 0,
      say: () => `${zahlwort(Data.get().purchases.length, "Kauf", "Käufe")} gespeichert, nur auf diesem Gerät.` },
    { when: () => Object.keys(Data.get().aliases).length > 0,
      say: () => `${zahlwort(Object.keys(Data.get().aliases).length, "Schreibweise hat", "Schreibweisen hat")} die App schon gelernt.` },
    { when: (ctx) => ctx.seasonNow && ctx.seasonNow.length > 0,
      say: (ctx) => `Gerade Saison: ${ctx.seasonNow.map((x) => x.name).join(", ")}.` },
    { when: (ctx) => ctx.deposit && ctx.deposit.byType && ctx.deposit.byType.length > 0,
      say: (ctx) => `Noch offenes Pfand: ${eur(ctx.deposit.byType.reduce((a, t) => a + t.amount, 0))}.` },
    { when: (ctx) => ctx.deposit && (!ctx.deposit.byType || !ctx.deposit.byType.length),
      say: () => "Gerade kein offenes Pfand." },
    { when: (ctx) => archiveStats(ctx.archive).stores.length > 0,
      say: (ctx) => `Du kaufst bei ${zahlwort(archiveStats(ctx.archive).stores.length, "einem Markt", "verschiedenen Märkten")}.` },
    { when: (ctx) => expiringWarranties(ctx.archive, ctx.ref, 800).length > 0,
      say: (ctx) => `${zahlwort(expiringWarranties(ctx.archive, ctx.ref, 800).length, "Gewährleistungsfrist läuft", "Gewährleistungsfristen laufen")} bald aus.` },
    { when: () => Data.get().household.hasCoffeeMachine,
      say: () => "Für die Kaffeemaschine rechnet die App mit deiner eingestellten Wasserhärte." },
    { when: () => !Data.get().household.hasCoffeeMachine,
      say: () => "Ohne eingetragene Kaffeemaschine schlägt die App auch keinen Entkalker vor." },
    { when: () => Data.get().household.hasWashingMachine,
      say: () => "Für die Waschmaschine berücksichtigt die App ebenfalls deine Wasserhärte." },
    { when: () => Data.get().household.hasDishwasher,
      say: () => "Für die Spülmaschine gilt dieselbe Rechnung wie bei der Waschmaschine — nur eine eigene Rate." },
    { when: (ctx) => relevantAisles(ctx.aisleList, ctx.items).length > 1,
      say: () => "Die Gangreihenfolge unter „Nach Gängen“ merkt sich die App je Markt." },
    { when: () => true, say: () => "Alles hier liegt nur auf diesem Gerät — kein Konto, kein Server." }
  ],

  faellig: [
    { when: (ctx) => !ctx.swapsDue.length && !ctx.supplies.some((x) => x.dueForPurchase),
      say: (ctx) => (ctx.nonFoodEntries.length ? "Nichts fällig. Alles im Rhythmus." : "Noch keine Haushaltsprodukte erfasst.") },
    { when: (ctx) => ctx.swapsDue.some((x) => x.due),
      say: (ctx) => `${zahlwort(ctx.swapsDue.filter((x) => x.due).length, "Produkt ist", "Produkte sind")} zum Tauschen fällig.` },
    { when: (ctx) => ctx.swapsDue.filter((x) => x.due).length > 1,
      say: (ctx) => ctx.swapsDue.filter((x) => x.due).slice(0, 3).map((x) => x.name).join(", ") },
    { when: (ctx) => ctx.swapsDue.some((x) => !x.due),
      say: (ctx) => `${zahlwort(ctx.swapsDue.filter((x) => !x.due).length, "Produkt wird", "Produkte werden")} demnächst zum Tauschen fällig.` },
    { when: (ctx) => ctx.supplies.some((x) => x.dueForPurchase),
      say: (ctx) => `${zahlwort(ctx.supplies.filter((x) => x.dueForPurchase).length, "Haushaltsprodukt geht", "Haushaltsprodukte gehen")} aus.` },
    { when: (ctx) => ctx.stockUp.length > 0,
      say: (ctx) => `${zahlwort(ctx.stockUp.length, "Produkt lohnt", "Produkte lohnen")} sich gerade zu bevorraten.` },
    { when: (ctx) => ctx.stockUp.length === 0 && ctx.supplies.length > 0,
      say: () => "Gerade keine Bevorratungs-Empfehlung — Preis oder Verbrauchsrate sind dafür noch nicht belastbar genug." },
    { when: (ctx) => ctx.stockUp.some((a) => a.cycleLearned),
      say: () => "Bei manchen Bevorratungs-Vorschlägen kennt die App schon deinen eigenen Aktionszyklus." },
    { when: (ctx) => ctx.stockUp.some((a) => !a.cycleLearned) && ctx.stockUp.length > 0,
      say: () => "Manche Bevorratungs-Vorschläge rechnen noch mit einem Vorgabewert, nicht mit deiner eigenen Historie." },
    { when: (ctx) => ctx.stockUp.some((a) => a.cappedByLimit),
      say: () => "Bei manchen Vorschlägen begrenzt dein Lagerplatz die empfohlene Menge." },
    { when: (ctx) => ctx.nonFoodEntries.length > 0,
      say: (ctx) => `Für ${zahlwort(ctx.nonFoodEntries.length, "Haushaltsprodukt", "Haushaltsprodukte")} hat die App Kaufhistorie.` },
    { when: (ctx) => ctx.supplies.some((s) => s.confidence === "UNSICHER"),
      say: () => "Bei manchen Haushaltsprodukten ist der Verbrauch noch zu unregelmäßig für eine Reichweite." },
    { when: (ctx) => !ctx.swapsDue.length && !ctx.stockUp.length && ctx.nonFoodEntries.length > 0,
      say: () => "Bei deinen Haushaltsprodukten ist gerade nichts zu tun." },
    { when: (ctx) => ctx.swapsDue.filter((x) => x.due).length + ctx.supplies.filter((x) => x.dueForPurchase).length > 3,
      say: () => "Einiges steht hier gerade an — am besten der Reihe nach." },
    { when: (ctx) => ctx.supplies.length > 0,
      say: () => "Austausch läuft nach Zeit, Nachschub nach geschätztem Verbrauch — zwei verschiedene Uhren." },
    { when: (ctx) => ctx.swapsDue.length > 0 && ctx.stockUp.length === 0,
      say: () => "Austausch steht an, Bevorratung gerade nicht — zwei unabhängige Listen hier." },
    { when: (ctx) => ctx.nonFoodEntries.length === 0,
      say: () => "Noch keine Haushaltsprodukte erfasst — Austausch und Nachschub brauchen erst Kaufhistorie." },
    { when: () => true,
      say: () => "Austausch, Nachschub und günstige Bevorratung — alles zu Haushaltsprodukten, nicht zu Lebensmitteln." }
  ],

  angebote: [
    { when: (ctx) => !ctx.foodDeals.length,
      say: () => "Gerade keine Angebote erkannt — das braucht noch etwas mehr Preisgeschichte je Produkt." },
    { when: (ctx) => ctx.foodDeals.length > 0,
      say: (ctx) => `${zahlwort(ctx.foodDeals.length, "Lebensmittel war", "Lebensmittel waren")} beim letzten Einkauf mindestens 15 % günstiger als sonst.` },
    { when: (ctx) => ctx.foodDeals.some((d) => d.kind === "vorrat"),
      say: (ctx) => `Bei ${ctx.foodDeals.find((d) => d.kind === "vorrat").name} könnte sich eine kleine Vorratsmenge lohnen.` },
    { when: (ctx) => ctx.foodDeals.some((d) => d.kind !== "vorrat"),
      say: (ctx) => `${zahlwort(ctx.foodDeals.filter((d) => d.kind !== "vorrat").length, "Angebot passt", "Angebote passen")} zu deiner Haltbarkeit, ohne Vorratsmenge.` },
    { when: (ctx) => ctx.foodDeals.length > 0,
      say: (ctx) => {
        const best = [...ctx.foodDeals].sort((a, b) => b.nachlass - a.nachlass)[0];
        return `${best.name} lag ${Math.round(best.nachlass * 100)} % unter deinem üblichen Preis.`;
      } },
    { when: (ctx) => ctx.foodDeals.length > 0, say: (ctx) => `Zuletzt gekauft: ${deDate(ctx.foodDeals[0].lastDate)}.` },
    { when: (ctx) => ctx.foodDeals.length === 1,
      say: (ctx) => `Nur ${ctx.foodDeals[0].name} ist gerade auffällig günstig.` },
    { when: (ctx) => ctx.foodDeals.length >= 3, say: () => "Gleich mehrere Angebote gerade — ein guter Moment für einen Blick." },
    { when: (ctx) => ctx.stockUp && ctx.stockUp.length > 0,
      say: () => "Bei Haushaltsprodukten heißt die entsprechende Seite „Fällig“, nicht „Angebote“ — die verderben ja nicht." },
    { when: (ctx) => ctx.foodDeals.length > 0,
      say: () => "Die Menge ist immer durch die Haltbarkeit begrenzt — nie mehr, als bis dahin aufgebraucht wäre." },
    { when: (ctx) => ctx.foodDeals.filter((d) => d.kind === "vorrat").length > 1,
      say: (ctx) => `${zahlwort(ctx.foodDeals.filter((d) => d.kind === "vorrat").length, "Angebot lohnt", "Angebote lohnen")} sich als kleine Vorratsmenge.` },
    { when: (ctx) => ctx.history.length === 0,
      say: () => "Ohne erfasste Einkäufe hat die App noch keinen üblichen Preis zum Vergleichen." },
    { when: (ctx) => ctx.foodDeals.length > 0 && ctx.rhythms && ctx.rhythms.size > 0,
      say: () => "Ein Angebot erscheint hier nur bei Lebensmitteln mit gelernter Preisgeschichte." },
    { when: () => true,
      say: () => "Grundlage ist immer dein zuletzt gezahlter Preis, nicht ein aktueller Regalpreis — den kennt die App nicht." }
  ]
};

/**
 * Der Text der Sprechblase für den aktuellen Reiter.
 *
 * Sammelt die zutreffenden Regeln aus MASCOT_RULES[tab] und wählt
 * reihum eine aus (`seed` kommt von App.toggleMascotBubble() — ein
 * Zähler je Reiter, kein Zufall, damit sich das prüfen lässt). Jede
 * Liste endet mit einer Regel ohne Bedingung, daher ist `eligible`
 * praktisch nie leer -- der Rückfalltext greift trotzdem, falls eine
 * neue Liste diese Regel einmal vergessen sollte.
 */
function mascotMessage(ctx, tab, seed = 0) {
  const rules = MASCOT_RULES[tab] || MASCOT_RULES.start;
  const eligible = rules.filter((r) => {
    try { return !!r.when(ctx); } catch (e) { return false; }
  });
  if (!eligible.length) return "Gerade nichts Besonderes hier.";
  const idx = ((seed % eligible.length) + eligible.length) % eligible.length;
  return eligible[idx].say(ctx);
}

/* ================================================================
   Was bedeutet dieses Zeichen?
   ================================================================
   Die Liste ist voller kleiner Marken: „von dir“, „+8 %“, „doppelt?“,
   „VD“, „3 T“. Sie sind kurz, weil eine Zeile schmal ist — und genau
   deshalb erklärt sich keine von selbst. Wer „+8 %“ liest, weiß
   nicht, ob das Mehrwertsteuer, Rabatt oder Preisänderung ist, und
   niemand tippt eine Zeile an, um das herauszufinden.

   Also: jede Marke ist antippbar und erklärt sich. Auf dem Rechner
   reicht das Verweilen mit dem Zeiger (`title`), auf dem Telefon —
   wo es kein Verweilen gibt — öffnet ein Tippen dasselbe Blatt, das
   auch hinter den (i) steckt.

   Die Texte sind GENERISCH. Sie erklären die Art der Marke, nicht den
   Einzelfall: „so entsteht diese Zahl“, nicht „deine Äpfel sind 8 %
   teurer“. Der Einzelfall steht im Detail-Blatt, das eine Zeile
   weiter aufgeht — hier geht es um die Frage „was ist das für ein
   Zeichen?“, und die stellt man einmal, nicht bei jedem Produkt neu.
   ================================================================ */
/* Der Beispielmarkt im Feld „Markt". Zweimal steht dasselbe Feld in
   der App — beim Bon und beim Erfassen von Hand — und es stand
   einmal „Lidl" und einmal „REWE" darin. Ein Platzhalter ist ein
   Beispiel, kein Vorschlag; zwei verschiedene Beispiele für dasselbe
   Feld lesen sich wie zwei verschiedene Felder. */
const MARKT_BEISPIEL = "REWE";

/**
 * Erklärungen zu den antippbaren Marken.
 *
 * WANN EINE MARKE HIERHER GEHÖRT — und wann nicht:
 *
 * Nicht „Zeile oder Blatt". Die Frage ist, ob der Zusammenhang die
 * Marke schon erklärt. „3 T" in der Reichweiten-Übersicht steht
 * unter einer Quellenzeile, die genau sagt, wie die Zahl entsteht;
 * „aufbrauchen" im Urlaubsplan steht unter der Zusammenfassung, die
 * es sagt. Beide brauchen nichts. „Verbrauchsdatum" am Rand einer
 * Listenzeile steht nackt da — es ist ein Wort, das niemand
 * angefordert hat und neben dem nichts steht.
 *
 * Was NICHT hierher gehört, ist ein Text, den es woanders schon
 * gibt. Sechs Einträge standen hier ohne jede Marke, die sie
 * geöffnet hätte: „überfällig", „Verderb-Risiko", „teuer",
 * „günstig", „Deine Antwort", „Vorratskauf". Die ersten vier
 * erklärten Zahlen, die längst ins Detail-Blatt gewandert sind und
 * ihren Rechenweg unter *Zahlen* und *Mehr → Rechenweg* führen; die
 * fünfte beschrieb Antworten, die es nicht mehr gibt; die sechste
 * war eine zweite, allgemeinere Fassung dessen, was der Hinweis
 * „Zu viel auf einmal" ohnehin konkret sagt.
 *
 * Eine Erklärung darf an genau einer Stelle stehen. Zwei Fassungen
 * desselben Sachverhalts driften auseinander, und die falsche
 * bleibt stehen — die fünfte hier sprach noch von „war schon leer",
 * einer Antwort, die seit Wochen gelöscht ist.
 */
const PILL_INFO = {
  own: ["Von dir ergänzt",
    "Diese Zeile hast du selbst auf die Liste gesetzt, die App hat sie nicht vorgeschlagen.\n\n" +
    "Selbst ergänzte Zeilen verändern keinen Rhythmus: aus einem einmaligen Wunsch lernt die App " +
    "keinen Kaufabstand. Sie gelten für eine Woche und verschwinden mit dem nächsten gebuchten Einkauf."],

  vd: ["Verbrauchsdatum",
    "Dieses Produkt trägt ein Verbrauchsdatum, kein Mindesthaltbarkeitsdatum. Das ist ein " +
    "rechtlicher Unterschied, kein sprachlicher.\n\nNach Ablauf darf es nicht mehr verzehrt werden — " +
    "hier verlängert die App niemals etwas und schlägt auch keine Resteverwertung vor."],

  doppelt: ["Vielleicht doppelt",
    "Etwas sehr Ähnliches steht schon auf der Liste oder wurde gerade erst gekauft.\n\nDie App " +
    "streicht deshalb nichts — sie fragt nur. Manchmal braucht man wirklich zwei."],

  rest: ["Resthaltbarkeit",
    "Geschätzte Tage, die dieses Produkt bei richtiger Lagerung noch hat — gerechnet ab dem Kaufdatum " +
    "mit dem Katalogwert.\n\nEine Schätzung, kein Datum von der Packung. Was du aufgedruckt hast, " +
    "gilt immer mehr als diese Zahl."],

  haltbar: ["Lange haltbar",
    "Bei diesem Produkt ist die Haltbarkeit kein Thema — Reis, Nudeln, Konserven.\n\nDie App zeigt " +
    "deshalb keine Tage: eine Zahl wie „400 T“ wäre richtig und trotzdem nutzlos."],

  kuehlen: ["Kühlkette",
    "Dieses Produkt sollte auf dem Heimweg gekühlt bleiben.\n\nDer Hinweis kommt beim Verlassen des " +
    "Ladens und nur bei Produkten mit Verbrauchsdatum. Bei jedem Einkauf gezeigt, würde er " +
    "weggetippt — und dann fehlte er, wenn er zählt."],

  angebrochen: ["Angebrochen",
    "Als geöffnet vermerkt. Eine offene Packung hält nicht mehr so lange wie eine geschlossene — die " +
    "App rechnet ab dem Öffnen mit der kürzeren Frist.\n\nOhne diesen Zustand schätzt sie den " +
    "Vorrat zu großzügig."],

  marke: ["Herstellermarke",
    "Auf der Bonzeile stand ein Markenname.\n\nDie Marke wird nur für den Preisvergleich " +
    "festgehalten. Für die Produktzuordnung wird sie weggeworfen — sonst wären „Marken-Butter“ und " +
    "„Butter“ für die App zwei verschiedene Dinge."],

  zerowaste: ["Zero Waste",
    "Alles, was dafür sorgt, dass nichts weggeworfen werden muss: Kühlkette, was zuerst " +
    "aufgebraucht werden sollte, was sich einzufrieren lohnt, ein Vorratskauf, der nicht aufgeht, " +
    "vergessene Produkte, Saison und Lagerung.\n\nDer gemeinsame Nenner ist der Zeitpunkt: jeder " +
    "dieser Hinweise kommt, solange sich noch etwas machen lässt. Hinterher wäre es eine Bilanz " +
    "und keine Hilfe."],

  hinweise: ["Hinweise",
    "Alles, was die App zu sagen hat außer der Liste selbst: Kühlkette, vergessene Produkte, was sich " +
    "einzufrieren lohnt, Saison und Lagerhinweise.\n\nDiese Hinweise standen früher einzeln auf der " +
    "Startseite. Sie sind nicht weniger geworden — sie stehen nur nicht mehr im Weg."],

  tauschen: ["Zum Tauschen fällig",
    "Manche Haushaltsprodukte werden nach Zeit gewechselt, nicht nach Verbrauch — Zahnbürste, " +
    "Spülschwamm, Rasierklinge.\n\nDie Frist kommt aus dem Intervall des Produkts und läuft ab dem " +
    "letzten Wechsel. „Getauscht“ setzt den Zähler zurück, auch wenn nichts gekauft wurde."],

  eigenmarke: ["Eigenmarke",
    "Die Handelsmarke des Händlers — ja!, Gut&Günstig, K-Classic, Milbona und so weiter.\n\n" +
    "Die App empfiehlt nichts davon. Sie zeigt nur, was der Unterschied bei dir ausmachen würde."],

  angebote: ["Angebote",
    "Bei deinem letzten Einkauf hast du für dieses Produkt deutlich weniger bezahlt als sonst — " +
    "mindestens 15 % unter deinem üblichen Preis.\n\n" +
    "Das ist kein aktueller Regalpreis: die App hat keinen Zugang zu dem, was gerade im Laden " +
    "steht, sondern nur zu dem, was auf deinen Bons stand. Die Menge richtet sich nach der " +
    "Haltbarkeit und deinem gelernten Verbrauch — nie mehr, als bis dahin aufgebraucht wäre."]
};

/**
 * Eine antippbare Marke. `key` wählt die Erklärung, `cls` die Farbe —
 * getrennt, weil dieselbe Farbe verschiedene Dinge bedeutet: die
 * gelbe Marke steht mal für „überfällig“, mal für „teurer als
 * üblich“. Aus der Farbe die Erklärung abzuleiten, hätte genau dort
 * still den falschen Text gezeigt.
 */
function pill(key, cls, label) {
  const info = PILL_INFO[key];
  const e = el("span", "pill " + cls, esc(label));
  if (!info) return e;                       // unbekannter Schlüssel: stumm, aber sichtbar
  e.setAttribute("role", "button");
  e.setAttribute("tabindex", "0");
  e.setAttribute("title", info[0]);          // Zeiger auf dem Rechner
  e.setAttribute("aria-label", `${label} — ${info[0]}, Erklärung anzeigen`);
  const open = (ev) => {
    // Sonst öffnet zusätzlich das Detail-Blatt der Zeile darunter.
    ev.stopPropagation();
    ev.preventDefault();
    App.notice(info[0], info[1]);
  };
  e.addEventListener("click", open);
  e.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") open(ev);
  });
  return e;
}

/** Dasselbe für die breiteren Marken rechts in Listenzeilen. */
function flag(key, cls, label) {
  const e = pill(key, cls, label);
  e.className = "flag " + cls;
  return e;
}

/* ---------- Bausteine ---------- */

/**
 * Gruppierte Liste. `info` landet hinter einem (i) statt als Fließtext
 * auf der Fläche — heißt nicht `group`, den Namen vergibt foodDatabase.js.
 */
function uiGroup(title, info) {
  const g = el("div", "group");
  if (title || info) {
    const head = el("div", "groupTitle");
    head.append(el("span", null, esc(title || "")));
    if (info) {
      const b = el("button", "infoBtn", "i");
      b.setAttribute("aria-label", `Erklärung: ${title || "Hinweis"}`);
      b.addEventListener("click", () => App.notice(title || "Hinweis", info));
      head.append(b);
    }
    g.append(head);
  }
  const body = el("div", "groupBody");
  g.append(body);
  g.body = body;
  return g;
}

/** Eine Zeile. `value` steht rechts, `onClick` macht sie antippbar. */
function uiRow(title, sub, control, opts = {}) {
  const r = el(opts.onClick ? "button" : "div", "row" + (opts.stacked ? " stacked" : ""));
  const main = el("div", "rowMain");
  main.append(el("div", "rowTitle", esc(title)));
  if (sub) main.append(el("div", "rowSub", esc(sub)));
  r.append(main);
  if (control) r.append(control);
  if (opts.value !== undefined) r.append(el("div", "rowValue", esc(opts.value)));
  if (opts.onClick) { r.append(el("div", "chev")); r.addEventListener("click", opts.onClick); }
  return r;
}

function card(title, statText) {
  const c = el("div", "card");
  if (title) c.append(el("div", "headrow", `<h2>${esc(title)}</h2>${statText ? `<div class="stat">${esc(statText)}</div>` : ""}`));
  return c;
}

function stepper(value, format, onChange, { min = 0, max = Infinity, step = 1 } = {}) {
  const wrap = el("div", "stepWrap");
  wrap.append(el("div", "stepVal", format(value)));
  const s = el("div", "stepper");
  const dec = el("button", null, "−"); dec.setAttribute("aria-label", "weniger");
  const inc = el("button", null, "+"); inc.setAttribute("aria-label", "mehr");
  dec.disabled = value - step < min;
  inc.disabled = value + step > max;
  dec.addEventListener("click", () => onChange(Math.max(min, value - step)));
  inc.addEventListener("click", () => onChange(Math.min(max, value + step)));
  s.append(dec, inc);
  wrap.append(s);
  return wrap;
}

function toggle(checked, onChange, label) {
  const w = el("label", "switch");
  const i = el("input");
  i.type = "checkbox";
  i.checked = checked;
  if (label) i.setAttribute("aria-label", label);
  i.addEventListener("change", () => onChange(i.checked));
  w.append(i, el("span", "track"));
  return w;
}

function segmented(options, current, onChange, label) {
  const s = el("div", "segmented");
  s.setAttribute("role", "tablist");
  if (label) s.setAttribute("aria-label", label);
  options.forEach(([value, text]) => {
    const b = el("button", null, esc(text));
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", current === value ? "true" : "false");
    b.addEventListener("click", () => onChange(value));
    s.append(b);
  });
  return s;
}

function tile(label, value, note, cls) {
  return el("div", "tile",
    `<div class="l">${esc(label)}</div><div class="v ${cls || ""}">${esc(value)}</div>` +
    (note ? `<div class="t">${esc(note)}</div>` : ""));
}

/** Leerzustand: ein Satz und ein Knopf, nicht mehr. */
/**
 * Leere-Ansicht — jetzt mit dem Wesen statt einer Textzeile allein.
 * `mood` ist bewusst nicht `mascotMood(ctx)`: eine leere Ansicht hat
 * meist gar keine der Signale, aus denen jene Funktion wählt, und
 * "neutral" (abwartend) passt hier eher als eine geratene Stimmung.
 * "Nichts fällig, alles im Rhythmus" ist die eine Ausnahme, die
 * ausdrücklich "froh" übergibt — das ist eine echte gute Nachricht,
 * keine leere Fläche.
 */
function emptyView(text, actionLabel, onAction, mood = "neutral") {
  const c = card();
  c.append(el("div", "emptyMascot", mascotSvg(mood, 52)));
  c.append(el("p", "empty", esc(text)));
  if (actionLabel) {
    const b = el("button", "cta", actionLabel);
    b.addEventListener("click", onAction);
    c.append(b);
  }
  return c;
}


/**
 * Konfidenzmarke. Grundsatz aus der Spezifikation: nie eine Zahl ohne
 * sie, und bei UNSICHER gar keine Zahl. Ein gefüllter Punkt heißt
 * gelernt, ein hohler geschätzt.
 */
function confidenceMark(confidence) {
  const map = {
    GELERNT: ["dot full", "aus deinen Käufen gelernt"],
    VORLAEUFIG: ["dot half", "vorläufig"],
    REFERENZ: ["dot", "Schätzwert"],
    UNSICHER: ["dot none", "unregelmäßig"],
    UNREGELMAESSIG: ["dot none", "unregelmäßig"]
  };
  const [cls, label] = map[confidence] || map.REFERENZ;
  const e = el("span", cls);
  e.setAttribute("title", label);
  e.setAttribute("aria-label", label);
  return e;
}

/** Reichweite mit Konfidenz — oder ein Strich, wenn nichts zu sagen ist. */
function supplyValue(sup) {
  const w = el("span", "supplyVal");
  if (sup.daysOfSupply === null || sup.confidence === "UNSICHER") {
    w.append(el("span", "rowValue", "—"));
  } else {
    w.append(el("span", "rowValue", `${Math.round(sup.daysOfSupply)} T`));
  }
  w.append(confidenceMark(sup.confidence));
  return w;
}

/* ================================================================
   Detail-Blatt: alles, was sonst als Fließtext auf der Liste stünde
   ================================================================ */
/**
 * „Doch aufgegessen“ — die Schätzung widersprechbar machen.
 * ================================================================
 * Der Verlust dieser App ist die einzige große Zahl, die NIE
 * beobachtet wurde. Sie wird abgeleitet: Kaufabstand länger als
 * Haltbarkeit heißt „ein Teil geht verloren“, eine ungewöhnlich
 * lange Lücke heißt „das davor ist weggekommen“. Beides sind gute
 * Gründe für einen Verdacht und schlechte Gründe für eine
 * Behauptung.
 *
 * Bisher konnte der Nutzer dem nicht widersprechen. Die App sagte
 * „10,04 € über 30 Käufe“, und wer wusste, dass er den Salat damals
 * aufgegessen hatte, konnte nichts tun als die Zahl zu ignorieren —
 * und mit ihr alles, was daran hängt.
 *
 * Hier stehen deshalb die einzelnen Verdachtsfälle mit Datum und
 * Betrag, jeder einzeln zurücknehmbar und jeder einzeln wieder
 * einschaltbar. Eine Korrektur, die man nicht rückgängig machen
 * kann, wäre schlimmer als die Schätzung, die sie korrigiert.
 *
 * WAS DABEI NICHT PASSIERT: nichts wird gutgeschrieben. Kein
 * Eurobetrag, keine Rettung, kein Meilenstein. Eine Schätzung
 * zurückzunehmen ist kein Erfolg — es war nur nie ein Verlust.
 * ================================================================
 */
function wasteSheetGroup(productId, st, ctx) {
  const g = uiGroup("Was die App für verdorben hält",
    "Keine dieser Zeilen ist beobachtet — alle sind aus Kaufabstand und Haltbarkeit abgeleitet.\n\n" +
    "Es sind zwei verschiedene Behauptungen, und du kannst beiden getrennt widersprechen. Der " +
    "LAUFENDE ANTEIL sagt etwas über das Produkt: dein Kaufabstand ist länger als die Haltbarkeit, " +
    "also geht bei jedem Zyklus ein Teil verloren. Ein AUSREISSER sagt etwas über einen bestimmten " +
    "Tag: nach diesem Kauf verging so viel Zeit, dass die Packung kaum aufgebraucht worden sein kann.\n\n" +
    "Es wird nichts gutgeschrieben: eine Schätzung zurückzunehmen ist kein Erfolg, es war nur nie ein " +
    "Verlust. Rückgängig geht beides jederzeit.");

  /* Die Summe, um die es geht -- vorher stand sie als Zeile
     „Verlust: 123,03 € über 20 Käufe (85 %)" in der allgemeinen
     Faktenliste, also weit weg von den Fällen, aus denen sie besteht.
     Hier oben steht sie da, wo man ihr auch widersprechen kann. */
  if (st.wastedEuros > 0) {
    g.body.append(uiRow("Geschätzter Verlust",
      `über ${zahlwort(st.purchased, "Kauf", "Käufe")} · ${pct(st.wasteRate)} der Menge`,
      null, { value: eur(st.wastedEuros) }));
  }

  /* Der laufende Anteil: EIN Schalter, nicht einer je Kauf. */
  if (st.chronicShare > 0) {
    const r = el("div", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">Laufender Anteil</div>` +
      `<div class="rowSub">${esc(st.chronicOff
        ? "abgestellt — zählt nicht mehr mit"
        : `etwa ${pct(st.chronicShare)} bei jedem Kauf`)}</div>`));
    const b = el("button", "pillBtn" + (st.chronicOff ? " on" : ""),
      st.chronicOff ? "✓ abgestellt" : "Bei mir nicht");
    b.setAttribute("aria-pressed", st.chronicOff ? "true" : "false");
    b.addEventListener("click", () => {
      const aus = Data.toggleNoChronic(productId);
      App.toast(aus ? "Zählt nicht mehr als Verlust" : "Wieder als Schätzung geführt", { icon: "·" });
      App.closeSheet();
    });
    r.append(b);
    g.body.append(r);
  }

  /* Die einzelnen Ausreißer: je einer eine eigene Zeile, weil jeder
     ein eigenes Ereignis behauptet.
     Sichtbar sind die drei jüngsten -- bei Hähnchenbrust standen hier
     zwölf gleich aussehende Zeilen mit je einem Knopf und schoben
     alles darunter aus dem Blick. Wer widersprechen will, meint fast
     immer den letzten Kauf; die älteren bleiben erreichbar, nur
     eingeklappt. */
  const OFFEN = 3;
  const spaeter = st.details.length > OFFEN
    ? el("details", "pMore") : null;
  if (spaeter) {
    spaeter.append(el("summary", null,
      `${st.details.length - OFFEN} ältere ${st.details.length - OFFEN === 1 ? "Fall" : "Fälle"}`));
  }
  st.details.slice(0, 12).forEach((d, i) => {
    const ziel = i < OFFEN ? g.body : spaeter;
    if (!ziel) return;
    const r = el("div", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(deDate(d.date))}</div>` +
      `<div class="rowSub">${esc(d.eaten
        ? "von dir als aufgebraucht bestätigt"
        : `ganze Packung — ${eur(d.euros)}`)}</div>`));
    const b = el("button", "pillBtn" + (d.eaten ? " on" : ""), d.eaten ? "✓ gegessen" : "Doch gegessen");
    b.setAttribute("aria-pressed", d.eaten ? "true" : "false");
    b.setAttribute("aria-label",
      `Kauf vom ${deDate(d.date)}: ${d.eaten ? "Bestätigung zurücknehmen" : "als aufgebraucht bestätigen"}`);
    b.addEventListener("click", () => {
      const jetzt = Data.toggleEaten(productId, d.date);
      // Kein `rescue`: hier wird nichts gerettet, nur eine Schätzung
      // zurückgenommen. Der Hinweis sagt genau das.
      App.toast(jetzt ? "Zählt nicht mehr als Verlust" : "Wieder als Verdacht geführt", { icon: "·" });
      App.closeSheet();
    });
    r.append(b);
    ziel.append(r);
  });
  if (spaeter) g.body.append(spaeter);

  if (st.details.length > 12) {
    g.body.append(el("p", "srcnote", `${st.details.length - 12} ältere Fälle nicht gezeigt.`));
  }
  if (st.corrected) {
    g.body.append(el("p", "srcnote",
      `${st.corrected} ${st.corrected === 1 ? "Kauf zählt" : "Käufe zählen"} nicht mehr mit — ` +
      "deine Angabe, nicht die Schätzung."));
  }
  return g;
}

/**
 * Ein Leitwert, dann Gruppen, dann die Herkunft — in dieser Reihenfolge.
 *
 * Vorher war dieses Blatt EINE flache Liste aus zehn gleich
 * aussehenden Zeilen: „Kategorie: Fleisch/Fisch" stand da genauso
 * groß wie „Verbrauchsdatum: höchstens 2 Tage · max. 4 °C". Alles
 * gleich gewichtet heißt: nichts gewichtet. Wer das Blatt öffnete,
 * musste zehn Zeilen lesen, um die eine zu finden, die zählt — und
 * bei Hähnchenbrust waren das 85 % Verlust und ein Verbrauchsdatum,
 * versteckt auf Position acht und zehn.
 *
 * Jetzt beantwortet das Blatt drei Fragen in fester Reihenfolge:
 *
 *   1. WAS IST MIT DIESEM PRODUKT LOS?  — ein Leitwert, groß, oben.
 *      Welcher das ist, entscheidet die Dringlichkeit, nicht die
 *      Reihenfolge im Datensatz: Verbrauchsdatum schlägt Verlust,
 *      Verlust schlägt Rhythmus, Rhythmus schlägt den Preis.
 *   2. WAS MUSS ICH WISSEN?             — wenige Kacheln, dann
 *      Gruppen mit Überschrift, jede nur wenn sie Inhalt hat.
 *   3. WO KOMMT DAS HER?                — eingeklappt. Herkunft,
 *      Datenqualität, Rückmeldungen: wichtig für das Vertrauen,
 *      aber nicht beim Öffnen.
 *
 * Nichts ist weggefallen. Jede Angabe der alten Liste steht weiter
 * im Blatt, nur an einem Ort, der ihrer Bedeutung entspricht.
 */
function productSheet(productId, ctx) {
  const p = byId(productId);
  if (!p) return;

  const r = ctx.rhythms.get(productId);
  const pm = ctx.prices.get(productId);
  const st = ctx.wasteStats.get(productId);
  const inv = ctx.inventory.find((i) => i.productId === productId);
  const range = ctx.range.byProduct.find((x) => x.productId === productId);
  const season = seasonFor(productId, ctx.ref);
  const isOpen = Data.get().opened.some((o) => o.productId === productId);
  const nf = nonFoodFor(productId);
  const chg = ctx.changes && ctx.changes.get(productId);
  const sicherheit = p.safetyCritical ? safetyFacts(productId) : null;

  const body = el("div");

  /* ---------- 1. Der Leitwert ---------- */
  /* Genau EINE Aussage, und zwar die dringendste. Die Reihenfolge
     ist eine Rangfolge der Folgen, nicht der Verfügbarkeit: ein
     Verbrauchsdatum kann krank machen, ein hoher Verlust kostet
     Geld, ein Rhythmus ist nützlich, ein Preis ist Beiwerk. */
  const leit = (() => {
    if (sicherheit) {
      return { ton: "red", wert: "max. " + tage(sicherheit.maxDays), was: "Verbrauchsdatum",
        dazu: `bei höchstens ${de(sicherheit.maxTempC)} °C · das aufgedruckte Datum gilt immer` };
    }
    if (st && st.wasteRate >= 0.25 && st.wastedEuros > 0) {
      return { ton: "red", wert: pct(st.wasteRate), was: "landen im Müll",
        dazu: `${eur(st.wastedEuros)} über ${zahlwort(st.purchased, "Kauf", "Käufe")} — geschätzt, nicht gemessen` };
    }
    if (!nf && r && r.rhythmDays) {
      return { ton: null, wert: alleTage(r.rhythmDays), was: "kaufst du das",
        dazu: (r.lastPurchaseDate ? `zuletzt am ${deDate(r.lastPurchaseDate)}` : "") +
          ` · Vertrauen ${pct(r.confidence)}` };
    }
    if (nf) {
      const sup = ctx.supplies.find((x) => x.productId === productId);
      if (sup && sup.daysOfSupply !== null && sup.confidence !== "UNSICHER") {
        return { ton: null, wert: tage(sup.daysOfSupply), was: "reicht der Vorrat noch",
          dazu: `${de(nf.package.value)} ${nf.package.unit} je Packung` };
      }
    }
    return { ton: null, wert: eur(pm ? pm.usual : p.typicalPrice), was: "üblicher Preis",
      dazu: p.category + (r && r.lastPurchaseDate ? ` · zuletzt am ${deDate(r.lastPurchaseDate)}` : "") };
  })();

  const kopf = el("div", "pLead" + (leit.ton ? " " + leit.ton : ""));
  kopf.append(el("div", "pLeadVal", esc(leit.wert)));
  kopf.append(el("div", "pLeadWhat", esc(leit.was)));
  if (leit.dazu) kopf.append(el("div", "pLeadSub", esc(leit.dazu.trim().replace(/^· /, ""))));
  body.append(kopf);

  /* ---------- 1b. Die Kennzahlen, die NICHT der Leitwert sind ----------
     Der Leitwert kann immer nur eine Sache zeigen. Ohne diese Zeile
     verschwand die zweitwichtigste komplett: bei Hähnchenbrust nannte
     das Blatt das Verbrauchsdatum und verlor dabei den Rhythmus
     (alle 10 Tage) UND die Verlustquote (85 %, 123,03 €) -- beides
     stand in der alten flachen Liste noch da. Gemessen an einem
     Alt-gegen-Neu-Abgleich über alle Produkte der Beispieldaten, nicht
     im Nachhinein bemerkt. Gezeigt wird nur, was der Leitwert nicht
     schon sagt, höchstens drei Werte. */
  const kennzahlen = [];
  const schonImLeit = leit.was;
  if (!nf && r && r.rhythmDays && schonImLeit !== "kaufst du das") {
    kennzahlen.push({ v: alleTage(r.rhythmDays), l: "Rhythmus" });
  }
  if (st && st.wastedEuros > 0 && schonImLeit !== "landen im Müll") {
    kennzahlen.push({ v: pct(st.wasteRate), l: "Verlust", ton: st.wasteRate >= 0.25 ? "warn" : null });
  }
  /* Der zuletzt gezahlte Preis gehört hierher, nicht in einen eigenen
     Abschnitt mit Überschrift: er ist eine Kennzahl wie die anderen.
     Die Farbe trägt den Vergleich mit dem üblichen Preis -- rot heißt
     teurer als sonst, grün günstiger. Damit braucht es keine zweite
     Zeile, die dasselbe noch einmal als Zahl danebenstellt; „üblich"
     und „Spanne" stehen als Bezugswerte unten in der Faktenliste. */
  if (pm && schonImLeit !== "üblicher Preis") {
    kennzahlen.push({ v: eur(pm.last), l: "zuletzt",
      ton: pm.last > pm.usual * 1.08 ? "warn" : pm.last < pm.usual * 0.92 ? "good" : null });
  }
  if (!nf && range && kennzahlen.length < 3) {
    kennzahlen.push({ v: tage(range.days), l: "reicht noch" });
  }
  if (kennzahlen.length) {
    const kz = el("div", "pStats");
    kennzahlen.slice(0, 3).forEach((k) => kz.append(el("div", "pStat" + (k.ton ? " " + k.ton : ""),
      `<div class="v">${esc(k.v)}</div><div class="l">${esc(k.l)}</div>`)));
    body.append(kz);
  }

  /* ---------- 2. Die Wochenentscheidung ---------- */
  /* Bleibt direkt unter dem Leitwert: sie ist der Grund, aus dem
     dieses Blatt aus der Liste heraus geöffnet wird. */
  const aufDerListe = (ctx.items || []).find((i) => i.productId === productId && i.basis !== "manuell");
  if (aufDerListe) body.append(weekChoice(aufDerListe, ctx, App, () => App.closeSheet()));

  /* ---------- Bausteine für die Abschnitte ---------- */
  const abschnitt = (titel) => {
    const t = el("div", "sheetGroupTitle", esc(titel));
    const dl = el("dl", "facts");
    let leer = true;
    return {
      zeile(k, v) { if (v === null || v === undefined || v === "") return;
        dl.append(el("dt", null, esc(k)), el("dd", null, esc(v))); leer = false; },
      anhaengen(node) { if (node) { body.append(t); body.append(dl); body.append(node); leer = false; } },
      fertig() { if (!leer) { body.append(t); body.append(dl); } }
    };
  };

  /* ---------- 3. Eine Faktenliste, keine Abschnittsparade ----------
     Vorher hatte dieses Blatt für den Preis einen eigenen Abschnitt
     mit Versal-Überschrift und drei umrandeten Kästchen, direkt über
     dem nächsten Abschnitt mit Versal-Überschrift. Zwei solche
     Blöcke übereinander sehen nach Gliederung aus und sind in
     Wahrheit nur Lärm: sechs zusätzliche Trennlinien, zwei laute
     Überschriften, für vier Zahlen.
     Jetzt trägt die Kennzahlenzeile oben den zuletzt gezahlten Preis
     (mit Farbe als Vergleich), und „üblich" und „Spanne" stehen als
     das, was sie sind: Bezugswerte in derselben Liste wie
     Haltbarkeit und Lagerort. Ein Block statt drei. */
  if (!nf) {
    const a = abschnitt("Frische & Lagerung");
    a.zeile("Haltbarkeit", p.isFood
      ? `${tage(p.shelfLifeDays)}${p.shelfLifeOpenedDays ? `, offen ${tage(p.shelfLifeOpenedDays)}` : ""}`
      : null);
    a.zeile("Lagerort", p.storage !== "kein Lagerhinweis" ? p.storage : null);
    if (pm) {
      a.zeile("üblicher Preis", eur(pm.usual));
      // Nur EIN Eurozeichen: „6,99 €–7,49 €" brach auf schmalen
      // Geräten hinter dem zweiten € um und ließ das Zeichen allein
      // in der nächsten Zeile stehen. „6,99–7,49 €" ist zudem die
      // übliche deutsche Schreibweise für eine Spanne.
      a.zeile("Preisspanne", `${de(pm.lowest.toFixed(2))}–${eur(pm.highest)}`);
    } else {
      a.zeile("üblicher Preis", `${eur(p.typicalPrice)} · noch ohne eigenen Kauf`);
    }
    /* Das Verbrauchsdatum steht NICHT noch einmal als Faktenzeile:
       es ist bereits der Leitwert ganz oben und wird gleich darunter
       im roten Hinweis erklärt. Dreimal dasselbe auf einem Bildschirm
       macht es nicht wichtiger, nur unübersichtlicher. */
    a.fertig();

    if (sicherheit) {
      /* Kurz. Der Leitwert ganz oben nennt die Frist schon in Rot und
         nennt sie beim Namen; dieser Hinweis muss nur noch sagen, was
         daraus folgt. Die ausführliche Fassung stand vorher hier als
         vierzeiliger Block, obwohl direkt darunter der Knopf steht,
         der genau das erklärt. */
      const note = el("div", "note red");
      note.innerHTML = "Nach Ablauf in den Müll — Keime sieht und riecht man nicht.";
      body.append(note);
      const q = el("button", "linkBtn", "Worauf beruht das?");
      q.addEventListener("click", () => App.notice(p.name,
        `Gruppe: ${sicherheit.label}.\n\n` +
        `RECHTLICH GEREGELT ist zweierlei:\n${sicherheit.legal.join("\n\n")}\n\n` +
        `NICHT geregelt ist die Anzahl der Tage. Dafür gibt es keine amtliche Zahl. ` +
        `Die App rechnet mit höchstens ${tagen(sicherheit.maxDays)} — das ist die untere Grenze ` +
        `dieser Lagerempfehlung:\n\n${sicherheit.guide}\n\n${sicherheit.printedWins}`));
      body.append(q);
    }
    if (season && season.status === "importware") body.append(el("div", "note gold", esc(season.message)));

    // Angebrochen: ein Tippen, mehr Pflege darf es nicht kosten.
    if (p.isFood && p.shelfLifeOpenedDays && p.shelfLifeOpenedDays < p.shelfLifeDays) {
      const b = el("button", "cta light", isOpen ? "✓ angebrochen" : "Als angebrochen markieren");
      b.addEventListener("click", () => {
        Data.toggleOpened(productId);
        App.closeSheet();
        App.toast(isOpen ? "Markierung entfernt" : `Hält noch ${tage(p.shelfLifeOpenedDays)}`);
      });
      body.append(b);
    }

    /* Das aufgedruckte Datum eintragen. Für sicherheitskritische
       Produkte ist das die einzige belastbare Angabe, die es gibt —
       und sie steht auf der Packung, die gerade in der Hand liegt. */
    if (p.isFood && ctx.history.some((h) => h.productId === productId)) {
      const gesetzt = (Data.get().useBy || {})[productId] || "";
      const wrap = el("label", "field");
      wrap.append(el("span", "lbl", p.safetyCritical
        ? "Aufgedrucktes Verbrauchsdatum"
        : "Aufgedrucktes Mindesthaltbarkeitsdatum"));
      const inp = el("input");
      inp.type = "date";
      inp.value = gesetzt;
      inp.setAttribute("aria-label", `Aufgedrucktes Datum für ${p.name}`);
      inp.addEventListener("change", () => {
        const ok = Data.setUseBy(productId, inp.value || null);
        if (!ok) { App.toast("Das Datum liegt vor dem Kauf"); inp.value = gesetzt; return; }
        App.closeSheet();
        App.toast(inp.value ? "Es gilt jetzt dein Datum" : "Wieder geschätzt");
      });
      wrap.append(inp);
      body.append(wrap);
      body.append(el("p", "srcnote", gesetzt
        ? "Die Bestandsanzeige rechnet mit diesem Datum, nicht mehr mit der Schätzung."
        : "Ohne Eintrag rechnet die App mit einer Lagerempfehlung. Das Etikett ist genauer — es gilt für genau diese Packung."));
    }
  }

  /* ---------- 5. Vorrat ---------- */
  /* Nur wenn es etwas zu sagen gibt. Eine Überschrift „Vorrat" über
     der einzigen Zeile „Bestand — nicht schätzbar" kostet drei Zeilen
     Platz, um mitzuteilen, dass nichts bekannt ist. Wo die App nichts
     weiß, schweigt sie hier; die Erklärung dazu steht unten unter
     „Wie die App darauf kommt". */
  if (!nf && (inv || range)) {
    const a = abschnitt("Vorrat");
    a.zeile("Bestand", inv
      ? `${de(inv.remainingUnits.toFixed(1))}× · noch ${tage(inv.daysLeft)} · Sicherheit ${pct(inv.confidence)}`
      : null);
    a.zeile("Reichweite", range ? `${tage(range.days)} · begrenzt durch ${range.limitedBy === "frische" ? "Frische" : "Menge"}` : null);
    a.fertig();
  }

  /* ---------- 6. Haushaltsprodukte rechnen anders ---------- */
  if (nf) {
    const sup = ctx.supplies.find((x) => x.productId === productId);
    const swap = ctx.swapsDue.find((x) => x.productId === productId);
    const rate = ctx.nonFoodRates.get(productId);
    const CLASS_LABEL = {
      RATE: "wird aufgebraucht", INTERVAL: "wird ausgetauscht",
      SPORADIC: "unregelmäßig", DATED: "hat ein Ablaufdatum"
    };
    const a = abschnitt("Verbrauch");
    a.zeile("Verbrauchsart", CLASS_LABEL[nf.consumptionClass]);
    a.zeile("Packung", `${de(nf.package.value)} ${nf.package.unit}`);
    if (rate) a.zeile("Verbrauch", `${de(rate.rate)} ${nf.package.unit}/Tag · ${rate.label}`);
    if (sup && sup.daysOfSupply !== null && sup.confidence !== "UNSICHER") {
      a.zeile("Reicht noch", tage(sup.daysOfSupply));
    }
    if (swap) {
      a.zeile("Austausch", `${alleTage(swap.intervalDays)} · ${swap.source}` +
        (swap.hardnessAdjusted ? " · an die Wasserhärte angepasst" : ""));
      a.zeile("Im Einsatz", tage(swap.inUse));
    }
    const bp = ctx.basePrices && ctx.basePrices.get(productId);
    if (bp) a.zeile("Grundpreis", bp.message);
    // Wie bei den Lebensmitteln: der zuletzt gezahlte Preis steht als
    // Kennzahl oben, die Bezugswerte hier als Zeilen.
    if (pm) {
      a.zeile("üblicher Preis", eur(pm.usual));
      a.zeile("Preisspanne", `${de(pm.lowest.toFixed(2))}–${eur(pm.highest)}`);
    } else {
      a.zeile("üblicher Preis", `${eur(p.typicalPrice)} · noch ohne eigenen Kauf`);
    }
    if (nf.paoMonths) a.zeile("Nach dem Öffnen", `${nf.paoMonths} Monate haltbar`);
    a.zeile("In der WG", nf.sharedByDefault ? "geteilt" : "persönlich");
    if (nf.requiresDevice) a.zeile("Braucht", {
      hasDishwasher: "Spülmaschine", hasWashingMachine: "Waschmaschine",
      hasCoffeeMachine: "Kaffeemaschine", hasWaterFilter: "Wasserfilter"
    }[nf.requiresDevice]);
    a.fertig();

    if (nf.paoMonths) {
      body.append(el("div", "note gold",
        "Die Frist läuft ab dem Öffnen. Die App kennt dieses Datum nicht und rechnet ab dem Kauf — das ist eine Annahme, keine Messung."));
    }
    if (nf.consumptionClass === "SPORADIC") {
      body.append(el("div", "note",
        "Für dieses Produkt macht die App keine Vorhersage. Der Kaufabstand lässt kein Muster erkennen."));
    }
  }

  /* ---------- 7. Verlust: die Schätzung widersprechbar machen ---------- */
  if (st && (st.chronicShare > 0 || (st.details && st.details.length))) {
    body.append(wasteSheetGroup(productId, st, ctx));
  }

  /* ---------- 8. Was bei einem guten Preis sinnvoll wäre ---------- */
  if (pm && pm.lowest && pm.usual && r && r.perUnitDays) {
    const rat = offerAdvice(productId, {
      preis: pm.lowest, üblich: pm.usual, perUnitDays: r.perUnitDays, herkunft: "eigen"
    });
    if (rat) {
      const g = uiGroup("Wenn es wieder so günstig ist",
        "Die Höchstmenge ist keine Meinung, sondern eine Rechnung: Haltbarkeit geteilt durch deinen " +
        "Verbrauch je Einheit. Ein Angebotsprospekt kann sagen, dass etwas billig ist — dass DU davon " +
        "genau so viel verbrauchst, bevor es schlecht wird, kann nur diese App sagen.\n\n" +
        "Nichts davon wird gutgeschrieben: das ist eine Vorschau auf einen Kauf, der noch nicht " +
        "stattgefunden hat. Gezählt wird erst, was tatsächlich auf einem Bon steht.");
      g.body.append(uiRow(
        rat.kind === "vorrat" ? `${rat.einheiten}× wären sinnvoll` : "Für Vorrat zu kurz haltbar",
        rat.message, null,
        rat.kind === "vorrat" ? { value: "ca. " + eur(rat.ersparnis) } : {}));
      g.body.append(el("p", "srcnote",
        `Bester Preis bisher: ${eur(pm.lowest)}, üblich ${eur(pm.usual)}. ` + sourceNote(rat)));
      body.append(g);
    }
  }

  /* ---------- 9. Hinweise, die eine Änderung erklären ---------- */
  if (!nf && r && r.feedback && r.feedback.message) {
    body.append(el("div", "note", esc(r.feedback.message)));
  }
  if (!nf && chg && chg.found) body.append(el("div", "note blue", esc(chg.message)));
  if (p.note) body.append(el("div", "note", esc(p.note)));

  /* ---------- 10. Herkunft der Zahlen — eingeklappt ---------- */
  /* Alles, was erklärt, WOHER eine Zahl kommt. Das ist der Kern des
     Vertrauensversprechens dieser App und darf nicht verschwinden —
     aber es ist nichts, was beim Öffnen des Blattes im Weg stehen
     muss. `<details>` statt eigener Klapp-Logik: der Inhalt bleibt
     im Dokument (auch für die Suche und für Vorlesehilfen), das
     Auf- und Zuklappen kann der Browser selbst, und die Tastatur
     bedient es ohne eine Zeile JavaScript. */
  const herkunft = el("details", "pMore");
  const sum = el("summary", null, "Wie die App darauf kommt");
  herkunft.append(sum);
  const hdl = el("dl", "facts");
  const hz = (k, v) => { if (v === null || v === undefined || v === "") return;
    hdl.append(el("dt", null, esc(k)), el("dd", null, esc(v))); };

  hz("Kategorie", p.category);
  if (!nf) {
    /* Das Vertrauen in den gelernten Rhythmus -- immer hier, auch
       wenn der Rhythmus schon der Leitwert ist. Zwei Gründe: es sagt
       nicht, WAS gilt, sondern wie sicher die App sich ist, und
       genau das ist die Frage dieses Abschnitts. Und es hält das
       Wort „Rhythmus" im Blatt, das der Leitwert bewusst umschreibt
       („alle 7 Tage · kaufst du das"). */
    if (r && r.rhythmDays) hz("Vertrauen in den Rhythmus", pct(r.confidence));
    /* Wo die App nichts weiß, sagt sie es -- aber hier unten, nicht
       als eigene Überschrift mit einer einzigen Zeile darunter. Die
       alte Fassung zeigte „Bestand: nicht schätzbar" und „Verlust:
       keiner erkannt" ganz oben zwischen den echten Angaben. */
    if (!inv) hz("Bestand", "nicht schätzbar");
    if (!st || !(st.wastedEuros > 0)) hz("Verlust", "keiner erkannt");
    hz("Datenqualität", {
      regulatorisch: "rechtlich definiert",
      leitlinie: "behördliche Lagerempfehlung",
      schaetzwert: "Schätzwert ohne amtliche Quelle"
    }[p.quality]);
    if (r && r.baseRhythmDays && r.baseRhythmDays !== r.rhythmDays) {
      hz("davor gelernt", alleTage(r.baseRhythmDays));
    }
    if (r && r.feedback && r.feedback.signals) {
      hz("Rückmeldungen", `${r.feedback.signals} · ${r.feedback.applied ? "wirken auf den Rhythmus" : "noch ohne Wirkung"}`);
    }
    if (r && r.season && r.season.applied) hz("Saison", r.season.message);
    if (chg && chg.found) hz("Verhalten geändert", chg.message);
  }
  if (nf) hz("Quelle", nf.rateSource || nf.intervalSource || nf.datedSource);
  hz("Zuletzt gekauft", r && r.lastPurchaseDate ? deDate(r.lastPurchaseDate) : null);
  herkunft.append(hdl);
  body.append(herkunft);

  App.sheet(p.name, null, body);
}

/* ================================================================
   1. Start — die Übersicht
   ================================================================
   Die Einkaufsliste war die Startseite, und das war falsch. Eine
   Liste ist ein Werkzeug für einen bestimmten Moment — kurz vor dem
   Einkauf. Wer die App an einem Dienstagabend öffnet, hält keine
   Liste in der Hand, sondern hat eine Frage:

       WAS KOMMT AUF MICH ZU?

   Diese Seite beantwortet sie in dieser Reihenfolge:

     1. Die Liste      — ein Feld, ein Preis, ein Knopf.
     2. Jetzt zu tun   — nur, was heute eine Handlung braucht.
     3. Dein Lauf      — die Wochenreihe, sonst nichts.

   WAS SIE AUSDRÜCKLICH NICHT IST: vier gleich große Kacheln mit
   Zahlen darin. Kacheln sehen nach Übersicht aus und sind keine —
   sie zeigen alles gleich groß und beantworten damit nichts.

   Alles hier ist ANSICHT auf Vorhandenes. Keine Zahl entsteht auf
   dieser Seite, keine wird hier ein zweites Mal gezählt.
   ================================================================ */
function viewStart(ctx, app) {
  const c = frag();

  /* --- Kaltstart: erst einmal Daten ---
     Das ist die ganze Einführung, die es gibt — bewusst eine einzige
     Karte statt eines mehrschrittigen Dialogs. Drei kurze Zeilen
     statt eines Fließtexts, weil die drei Fragen, die hier zählen
     (was macht das, wo bleiben meine Daten, was tue ich als Erstes),
     sich nicht der Reihe nach lesen lassen wollen, sondern auf einen
     Blick beantwortet sein sollen. */
  if (!ctx.history.length) {
    const w = card();
    w.append(el("p", "welcomeTitle", "Willkommen bei Einkaufs-Anker"));
    w.append(el("ul", "welcomePoints",
      "<li>Lernt aus deinen Kassenbons, was wann bei dir ausgeht, und sagt es dir vorher.</li>" +
      "<li>Bleibt auf deinem Gerät — kein Konto, kein Server, keine Übertragung.</li>" +
      "<li>Schon der erste Bon zeigt deine Ausgaben; die Einkaufsliste kommt mit der Zeit dazu.</li>"));
    const b = el("button", "cta", "Ersten Bon erfassen");
    b.addEventListener("click", () => app.goto("erfassen"));
    w.append(b);
    const demo = el("button", "cta light", "Erst mal ansehen");
    demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Beispieldaten geladen"); });
    w.append(demo);
    c.append(w);
    return c;
  }

  c.append(listCard(ctx, app));

  const todo = todoCard(ctx, app);
  if (todo) c.append(todo);

  if (ctx.stage.stage >= 2) c.append(runCard(ctx, app));
  return c;
}

/**
 * Die Liste als ein einziges Feld.
 *
 * Nicht die Liste selbst — die hat ihre eigene Seite. Hier steht,
 * was darauf steht und was es kostet, und ein Knopf führt hin. Die
 * ersten Namen stehen mit dabei: ohne sie ist „13 Positionen" eine
 * Zahl, mit ihnen ist es die eigene Liste.
 */
function listCard(ctx, app) {
  const on = ctx.items.filter((i) => i.on);
  const sum = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);

  const g = uiGroup();
  const b = el("button", "bigAction");
  const main = el("div", "baMain");
  main.append(el("div", "baTitle", "Einkaufsliste"));
  main.append(el("div", "baSub", esc(on.length
    ? `${on.length} ${on.length === 1 ? "Position" : "Positionen"} · ${eur(sum)}`
    : ctx.stage.stage <= 1 ? "wird noch gelernt" : "noch nichts drauf")));
  if (on.length) {
    // Zwei Elemente statt eines: "und N weitere" ist die Auskunft, die
    // zählt, und darf deshalb nie mitten im Wort abgeschnitten werden
    // (bei 390px Breite und drei längeren Namen geschah genau das:
    // "...und 10 weite…"). Nur die Namensliste selbst -- unbegrenzt
    // lang, je nach Einkauf -- bekommt die Ellipse; der Zusatz bleibt
    // als eigenes, nie schrumpfendes Element immer vollständig lesbar.
    const namen = on.slice(0, 3).map((i) => i.name).join(", ");
    const rest = on.length - 3;
    const preview = el("div", "baPreview");
    preview.append(el("span", "baNames", esc(namen)));
    if (rest > 0) preview.append(el("span", "baRest", esc(`und ${rest} weitere`)));
    main.append(preview);
  }
  b.append(main);
  b.append(el("div", "baGo", "→"));
  b.addEventListener("click", () => app.goto("liste"));
  g.body.append(b);
  return g;
}

/**
 * Jetzt zu tun.
 *
 * Die Regel für diese Gruppe: hier steht nur, was HEUTE eine
 * Handlung braucht. Kein Hinweis, keine Zahl, kein Fortschritt —
 * dafür sind die anderen Seiten da. Ist nichts zu tun, fehlt die
 * Gruppe ganz. Eine Sammelstelle, die auch leer dasteht, macht aus
 * „nichts zu tun" eine Nachricht statt eines Zustands.
 */
function todoCard(ctx, app) {
  const rows = [];

  if (ctx.safety) {
    rows.push(["Kühlkette", ctx.safety.short, flag("kuehlen", "f-miss", "!"),
      () => app.notice("Kühlkette", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source)]);
  }

  const faellig = ctx.swapsDue.filter((x) => x.due);
  if (faellig.length) {
    rows.push([faellig.length === 1 ? `${faellig[0].name} tauschen` : `${zahlwort(faellig.length, "Produkt", "Produkte")} tauschen`,
      faellig.length === 1 ? "nach Zeit fällig" : faellig.slice(0, 3).map((x) => x.name).join(", "),
      flag("tauschen", "f-gold", String(faellig.length)), () => app.goto("faellig")]);
  }

  if (ctx.foodDeals.length) {
    rows.push([`${zahlwort(ctx.foodDeals.length, "Angebot", "Angebote")} erkannt`,
      ctx.foodDeals.slice(0, 3).map((d) => d.name).join(", "),
      flag("angebote", "f-ok", String(ctx.foodDeals.length)), () => app.goto("angebote")]);
  }

  if (ctx.review.due) {
    rows.push(["Wochenrückblick", ctx.review.short || "fertig", null, () => reviewSheet(ctx, app)]);
  }

  // Alles Übrige läuft weiter über das Sammelblatt der Liste — es ist
  // dasselbe Blatt, nicht eine zweite Fassung davon.
  const hinweise = collectHints(ctx).filter((h) => !h.urgent);
  if (hinweise.length) {
    rows.push([`${hinweise.length} ${hinweise.length === 1 ? "Hinweis" : "Hinweise"}`,
      hinweise.slice(0, 3).map((h) => h.title).join(" · "),
      flag("hinweise", "", String(hinweise.length)), () => hintsSheet(ctx, app)]);
  }

  if (!rows.length) return null;

  const g = uiGroup("Jetzt zu tun");
  rows.slice(0, 5).forEach(([title, sub, control, onClick]) =>
    g.body.append(uiRow(title, sub, control, { onClick })));
  return g;
}

/**
 * Dein Lauf — eine Zeile, kein Kachelfeld.
 *
 * Die Wochenreihe steht hier, weil sie das Einzige ist, was diese
 * Seite über Vergangenes sagen muss: bleibst du dabei? Alles andere
 * — Ausgaben, Ersparnis, Verlust, Rhythmen — steht unter „Zahlen",
 * und dorthin führt diese Zeile.
 */
function runCard(ctx, app) {
  const g = uiGroup("Dein Lauf");
  const b = el("button", "runRow");
  b.append(streakStrip(ctx));
  b.append(el("div", "chev"));
  b.addEventListener("click", () => app.goto("zahlen"));
  g.body.append(b);
  if (ctx.badges.nextUp) {
    g.body.append(uiRow("Als Nächstes", ctx.badges.nextUp.nextTitle, null, {
      value: `${Math.round(ctx.badges.nextUp.progress * 100)} %`,
      onClick: () => app.goto("zahlen")
    }));
  }
  return g;
}

/* ================================================================
   2. Liste
   ================================================================
   RÜCKMELDUNG AUS DER ZIELGRUPPE, und sie war eindeutig: zu voll.

   Die Seite hatte bis zu zehn Blöcke — Vorratsanzeige, Sicherheit,
   die Liste, zwei Knöpfe, vergessene Produkte, Einfrieren, Saison,
   Lagerhinweis und vier Einstellungen. Jeder für sich war begründet.
   Zusammen beantworteten sie zehn Fragen, obwohl beim Öffnen genau
   eine im Kopf ist:

       WAS MUSS ICH EINKAUFEN?

   Alles andere ist entweder eine Antwort auf eine Frage, die man
   später stellt, oder eine Einstellung. Beides gehört nicht auf die
   erste Seite.

   WAS GEBLIEBEN IST: die Liste, ein Knopf zum Loslaufen, ein Weg
   etwas zu ergänzen. Mehr nicht.

   WAS UMGEZOGEN IST — nichts wurde gelöscht, alles ist einen Tipp
   entfernt:
     · Vorrat, Reichweite            -> Bestand
     · Budget, Personen, Vorausschau,
       Urlaub                        -> Mehr
     · Sicherheit, Vergessenes,
       Einfrieren, Saison, Lagern    -> eine Zeile „Hinweise“

   WAS RUHIGER GEWORDEN IST: höchstens EIN Zeichen je Zeile statt
   drei. Die Erklärzeile über der Liste ist ins (i) gewandert. Und
   die Überschrift sagt, was hier ist, statt es zu erklären.
   ================================================================ */
function viewListe(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* KEIN AUSSTIEG MEHR FÜR DIE FRÜHEN WOCHEN.
     ----------------------------------------------------------------
     Hier stand ein `return`: bis die App zwei Bons je Produkt gesehen
     hatte, zeigte diese Seite einen Satz und einen Knopf. Vier bis
     acht Wochen lang. Gemessen an einem einzigen erfassten Bon war
     das der gesamte Inhalt:

         „Zwei Bons je Produkt, dann kommen die Vorschläge."

     Und weil das Erfassen am Ende `goto("liste")` aufruft, war das
     der erste Bildschirm nach der ersten echten Handlung eines neuen
     Nutzers. Er sagte: kann ich noch nicht.

     Dabei war alles da. Die Suche über 846 Produkte, das freie
     Eintippen, der Ladenmodus, das Teilen, der Wagen — nur gesperrt,
     weil noch keine VORHERSAGE möglich war. Als könnte man eine
     Einkaufsliste nur schreiben, wenn ein Algorithmus mithilft.

     Jetzt ist die Seite von der ersten Minute an eine Einkaufsliste,
     die man selbst füllt. Was die App dazulernt, kommt oben drauf,
     wenn es so weit ist — und bis dahin sagt eine Zeile am Ende,
     woran es liegt. */

  // Der Rückblick steht obenan, aber nur wenn er fällig ist. Eine
  // Karte, die jeden Tag da ist, ist kein Anlass mehr.
  if (ctx.review.due) c.append(reviewCard(ctx, app));

  const hinweise = collectHints(ctx);
  const dringend = hinweise.some((h) => h.urgent);
  if (dringend) c.append(hintsRow(ctx, app, hinweise));

  /* --- Die Liste --- */
  const on = ctx.items.filter((i) => i.on);
  const sumOn = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);

  /* Ohne Überschrift: die Seite heißt schon „Einkaufsliste“, und
     eine Karte, die darunter noch einmal „Deine Einkaufsliste“ sagt,
     kostet eine Zeile und sagt nichts. Die Erklärung sitzt unten an
     der Summe, wo man ohnehin hinschaut, wenn man wissen will, wie
     das zustande kommt. */
  const listInfo =
    "Die App füllt die Liste aus deinen Rhythmen vor: Lebensmittel nach dem gelernten Kaufabstand " +
    "zuzüglich der eingestellten Vorausschau, Haushaltsprodukte nach ihrer Verbrauchsrate.\n\n" +
    "Sie gehört trotzdem dir. Haken wegnehmen, halbe Menge wählen, eigene Positionen ergänzen. " +
    "Der Rechenweg jeder Zeile steht in ihrem Detail-Blatt — einfach antippen.\n\n" +
    "Vorrat und Reichweite stehen unter „Bestand“, Budget und Vorausschau unter „Mehr“.";
  const list = uiGroup();

  if (ctx.budgetResult.removed.length) {
    list.body.append(uiRow(`${ctx.budgetResult.removed.length} wegen Budget gestrichen`,
      ctx.budgetResult.removed.map((r) => r.name).join(", "), null, {
        onClick: () => app.notice("Budget", ctx.budgetResult.advice +
          " Brot, Milch und Eier bleiben immer auf der Liste.")
      }));
    // Nicht nur sagen, was fehlt -- auch, womit es sich ersetzen
    // ließe. cheaperAlternatives() lag bislang ungenutzt in
    // budgetOptimizer.js; Streichen war nie der eigentliche Wunsch,
    // Tauschen ist es (siehe Kommentar dort).
    ctx.budgetResult.removed.forEach((removed) => {
      if (!removed.productId) return;
      const alts = cheaperAlternatives(removed);
      alts.forEach((alt) => list.body.append(budgetSwapRow(removed, alt, ctx, app)));
    });
  }
  if (ctx.vacation && ctx.vacation.skip.length) {
    list.body.append(uiRow(`Urlaub: ${ctx.vacation.skip.length} zurückgestellt`,
      ctx.vacation.skip.map((s) => s.name).join(", "), null, { value: "− " + eur(ctx.vacation.savedEuros) }));
  }

  // Drei Sektionen: was die App vorschlägt (Lebensmittel, Haushalt)
  // und was du selbst ergänzt hast. Die Trennung beantwortet die
  // Frage „woher kommt das hier eigentlich?“, ohne dass man eine
  // Zeile antippen muss.
  /* Nur was ansteht. Abgewähltes stand vorher grau zwischen den
     anderen Zeilen und sah aus wie eine Position mit hohlem Kreis —
     seit der Kreis „im Wagen“ heißt, wäre das nicht mehr zu
     unterscheiden. Es sammelt sich deshalb unten in einer Zeile. */
  const auto = ctx.items.filter((i) => i.on && i.basis !== "manuell");
  const eigene = ctx.items.filter((i) => i.on && i.basis === "manuell");
  const abgewaehlt = ctx.items.filter((i) => !i.on);
  const food = auto.filter((i) => !isNonFood(i.productId));
  const home = auto.filter((i) => isNonFood(i.productId));

  const ul = el("ul", "items");
  if (!ctx.items.length) {
    ul.append(el("li", "item", `<p class="empty">${esc(ctx.stage.stage >= 2
      ? "Nichts fällig — die Liste ist leer."
      : "Noch nichts drauf. Tippe unten auf „Etwas hinzufügen“.")}</p>`));
  }
  if (home.length && food.length) ul.append(el("li", "sectionRow", "Lebensmittel"));
  food.forEach((it) => ul.append(listItem(it, ctx, app)));
  if (home.length && food.length) ul.append(el("li", "sectionRow", "Haushalt"));
  home.forEach((it) => ul.append(listItem(it, ctx, app)));
  if (eigene.length) {
    ul.append(el("li", "sectionRow", "Von dir ergänzt"));
    eigene.forEach((it) => ul.append(listItem(it, ctx, app)));
  }
  list.body.append(ul);

  if (abgewaehlt.length) {
    list.body.append(uiRow("Nicht diese Woche",
      abgewaehlt.slice(0, 3).map((i) => i.name).join(", "), null, {
        value: String(abgewaehlt.length),
        onClick: () => weekOffSheet(ctx, app)
      }));
  }

  // Der wichtigste Knopf dieser Seite: ohne ihn ist die App ein
  // Automat, den man nur ansehen kann.
  const add = el("button", "row action addRow");
  add.innerHTML = '<span class="plusMark">+</span>' +
    '<div class="rowMain"><div class="rowTitle">Etwas hinzufügen</div>' +
    '<div class="rowSub">Produkt suchen oder frei eintippen</div></div>';
  add.addEventListener("click", () => addSheet(ctx, app));
  list.body.append(add);

  /* Warum hier (noch) nichts vorgeschlagen wird. Eine Zeile am Ende,
     nicht ein Satz anstelle der Seite: die Auskunft ist richtig, aber
     sie ist kein Grund, das Werkzeug wegzunehmen. */
  if (ctx.stage.stage <= 1) {
    list.body.append(uiRow(
      ctx.history.length ? "Vorschläge kommen noch" : "Noch keine Einkäufe erfasst",
      ctx.history.length
        ? `${ctx.totals.receipts} ${ctx.totals.receipts === 1 ? "Bon" : "Bons"} erfasst — ab dem zweiten je Produkt lernt die App den Rhythmus`
        : "Bis dahin ist das hier deine normale Einkaufsliste",
      null, { onClick: () => app.goto("erfassen") }));
  }

  /* Die Summe erst, wenn es etwas zu summieren gibt. „0 Positionen ·
     0,00 €“ unter einer leeren Liste ist keine Auskunft, sondern ein
     Formular, das sich selbst ausfüllt. */
  if (ctx.items.length) list.body.append(listTotals(ctx, on, sumOn, listInfo));
  c.append(list);

  return finishListe(c, ctx, app, on, sumOn, hinweise, dringend);
}

/** Die Summenzeile am Fuß der Liste. */
function listTotals(ctx, on, sumOn, listInfo) {
  const full = ctx.items.filter((i) => i.on).reduce((a, i) => a + i.price, 0);
  const tot = el("div", "totals");
  const links = el("div");
  const label = el("div", "l");
  label.append(document.createTextNode(`${on.length} ${on.length === 1 ? "Position" : "Positionen"}`));
  const info = el("button", "infoBtn", "i");
  info.setAttribute("aria-label", "Erklärung: wie diese Liste entsteht");
  info.addEventListener("click", () => App.notice("Wie diese Liste entsteht", listInfo));
  label.append(info);
  links.append(label, el("div", "big", eur(sumOn)));
  tot.append(links, el("div", "saved", full > sumOn ? "− " + eur(full - sumOn) : ""));
  return tot;
}

/** Wagen, Knöpfe und Hinweise unter der Liste. */
function finishListe(c, ctx, app, on, sumOn, hinweise, dringend) {
  /* --- Der Wagen ---
   * Nur wenn etwas drin liegt. Eine Leiste, die auch leer dasteht,
   * macht aus „nichts im Wagen“ eine Nachricht statt eines Zustands
   * — und sie stünde die ganze Woche im Weg, obwohl eingekauft wird
   * an einem Tag.
   *
   * `position: sticky` mit einem Abstand über der Leiste: solange die
   * Liste weiterläuft, klebt sie am unteren Rand; am Ende der Seite
   * setzt sie sich an ihren eigenen Platz. Deshalb steht sie VOR den
   * Knöpfen und nicht dahinter — ein klebendes Element als letztes
   * Element im Fluss hat nichts, woran es kleben könnte. */
  const wagen = app.cartItems(ctx);
  if (wagen.length) {
    const wSum = wagen.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    const bar = el("div", "cartBar");
    bar.append(el("div", "t",
      `<b>${wagen.length} von ${on.length} im Wagen</b>` +
      `<span>${esc(eur(wSum))} von ${esc(eur(sumOn))}</span>`));
    const book = el("button", "cta", "Einkauf buchen");
    book.addEventListener("click", () => app.bookCart());
    bar.append(book);
    c.append(bar);
  }

  /* --- Losgehen --- */
  const actions = el("div", "ctaRow");
  // "Nach Gängen" stand hier zusätzlich zum immer sichtbaren Knopf
  // oben im Kopfbereich (renderBar in app.js) -- derselbe Text, dieselbe
  // Aktion, zweimal im selben Bild. Der Kopfbereich-Knopf bleibt beim
  // Scrollen erreichbar, deshalb reicht der eine.
  const share = el("button", "cta light", "Teilen");
  share.disabled = !on.length;
  share.addEventListener("click", () => app.shareList());
  actions.append(share);
  c.append(actions);

  /* Ohne jede Historie bleibt der Weg zu den Beispieldaten stehen —
     er war vorher Teil des Leerzustands, den es nicht mehr gibt. */
  if (!ctx.history.length) {
    const demo = el("button", "cta light", "Beispieldaten ansehen");
    demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Geladen"); });
    c.append(demo);
  }

  if (hinweise.length && !dringend) c.append(hintsRow(ctx, app, hinweise));

  return c;
}

/**
 * Alles Ratgeberische in EINER Zeile.
 *
 * Fünf Gruppen sind zu einer Zeile geworden. Sie erscheint nur, wenn
 * es etwas zu sagen gibt, und sie sagt, wie viel — damit man
 * entscheiden kann, ob es sich gerade lohnt.
 *
 * Ist etwas Dringendes dabei (Kühlkette), steht sie ÜBER der Liste
 * und nennt die Sache beim Namen. Sonst darunter. Eine Warnung, die
 * man erst erscrollen muss, ist keine — dieselbe Regel wie bei der
 * Sicherung unter „Mehr“.
 */
function hintsRow(ctx, app, hinweise) {
  const g = uiGroup();
  const dringend = hinweise.find((h) => h.urgent);
  g.body.append(uiRow(
    dringend ? dringend.title : `Zero Waste · ${hinweise.length}`,
    dringend
      ? (hinweise.length > 1 ? `und ${hinweise.length - 1} ${hinweise.length === 2 ? "weiterer" : "weitere"}` : dringend.sub)
      : hinweise.slice(0, 3).map((h) => h.title).join(" · "),
    flag(dringend ? "kuehlen" : "zerowaste", dringend ? "f-miss" : "", String(hinweise.length)),
    { onClick: () => hintsSheet(ctx, app) }));
  return g;
}

/**
 * Alles einsammeln, was die App zu sagen hat — außer der Liste.
 *
 * Jeder Eintrag trägt seine eigene Handlung mit. Das ist der
 * Unterschied zwischen einem Sammelblatt und einer Abstellkammer:
 * was hier landet, bleibt bedienbar.
 */
function collectHints(ctx) {
  const out = [];

  if (ctx.safety) {
    out.push({
      key: "safety", urgent: true,
      group: "Sicherheit",
      title: ctx.safety.short,
      sub: ctx.safety.coldestZone,
      badge: "kühlen",
      onOpen: (app) => app.notice("Kühlkette", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source)
    });
  }

  /* Vorratskäufe, die nicht aufgehen. Sie stehen weit oben, weil
     sie die einzige Sorte Hinweis sind, bei der noch etwas zu retten
     ist: einfrieren, verschenken, verteilen — solange die Frist
     nicht abgelaufen ist. Danach ist es nur noch Bilanz. */
  (ctx.hoards || []).filter((h) => h.kind === "zuviel").slice(0, 3).forEach((h) => out.push({
    key: "hoard:" + h.productId + ":" + h.date,
    urgent: h.safetyCritical,
    group: "Zu viel auf einmal",
    title: `${h.units}× ${h.name}`,
    sub: h.safetyCritical
      ? `Verbrauchsdatum — hält nur ${tage(h.haltbarTage)}`
      : `reicht ${tage(h.reichweiteTage)}, haltbar ${h.haltbarTage}`,
    onOpen: (app) => app.notice("Zu viel auf einmal", h.message +
      "\n\nEine Vorhersage, keine Bilanz: was hier steht, ist noch nicht passiert. Einfrieren, " +
      "verschenken oder verteilen ändert es." +
      (h.günstiger > 0 ? `\n\nGünstiger war der Kauf trotzdem — um ${eur(h.günstiger)}.` : ""))
  }));

  ctx.forgotten.slice(0, 4).forEach((f) => out.push({
    key: "forgotten:" + f.productId,
    title: f.name,
    sub: `zuletzt vor ${tagen(f.daysSince)}, sonst ${alleTage(f.rhythmDays)}`,
    group: "Fehlt dir das?",
    actions: [
      { label: "Dazu", primary: true, run: (app) => { app.addToList(f.productId); app.toast(f.name + " dazu"); } },
      { label: "Nein", run: (app) => { app.dismiss("forgotten", f.productId); app.toast("Nicht mehr gefragt"); } }
    ]
  }));

  ctx.freeze.slice(0, 3).forEach((f) => out.push({
    key: "freeze:" + f.productId,
    title: `${f.name}: ${f.share === 0.5 ? "die Hälfte" : "ein Teil"} einfrieren`,
    sub: `rettet ${eur(f.valueAtRisk)}`,
    group: "Einfrieren",
    actions: [
      { label: "Eingefroren", primary: true, run: (app) => {
        app.dismiss("freeze", f.productId);
        app.rescue(f.productId, `${f.name} eingefroren`, f.valueAtRisk);
      } }
    ]
  }));

  /* Kein Verb im Titel: aus „Äpfel“ und „ist Importware“ wird
     „Äpfel ist Importware“, und Produktnamen sind mal Einzahl, mal
     Mehrzahl. Der Doppelpunkt umgeht die Grammatik, statt sie zu
     raten. */
  ctx.season.forEach((s) => out.push({
    key: "season:" + s.productId,
    title: s.name,
    sub: "Importware · Saison: " + s.peakMonths.map((m) => MONTH_NAMES[m - 1]).join(", "),
    group: "Saison"
  }));

  if (ctx.ethylene) {
    out.push({
      key: "ethylene",
      title: "Getrennt lagern",
      sub: "Ethylen lässt die zweite Gruppe schneller verderben",
      group: "Lagern",
      onOpen: (app) => app.notice("Lagern", ctx.ethylene.message + "\n\nQuelle: " + ctx.ethylene.source)
    });
  }

  return out;
}

/** Das Sammelblatt. Gruppiert, mit den Handlungen von vorher. */
function hintsSheet(ctx, app) {
  const body = el("div");
  const hinweise = collectHints(ctx);

  let letzteGruppe = null;
  hinweise.forEach((h) => {
    if (h.group && h.group !== letzteGruppe) {
      body.append(el("div", "sheetGroupTitle", esc(h.group)));
      letzteGruppe = h.group;
    }
    const r = el("div", "row");
    const haupt = h.onOpen ? el("button", "rowMain plainBtn") : el("div", "rowMain");
    haupt.innerHTML = `<div class="rowTitle">${esc(h.title)}</div><div class="rowSub">${esc(h.sub || "")}</div>`;
    if (h.onOpen) haupt.addEventListener("click", () => h.onOpen(app));
    r.append(haupt);

    if (h.badge) r.append(flag("kuehlen", "f-miss", h.badge));
    if (h.actions) {
      const acts = el("div", "rowActions");
      h.actions.forEach((a) => {
        const b = el("button", "pillBtn" + (a.primary ? " on" : ""), esc(a.label));
        b.addEventListener("click", () => { a.run(app); app.closeSheet(); });
        acts.append(b);
      });
      r.append(acts);
    }
    body.append(r);
  });

  body.append(el("p", "srcnote",
    "Alles hier hat denselben Zweck: dass nichts weggeworfen werden muss. Jeder Hinweis kommt, " +
    "solange sich noch etwas machen lässt — nicht hinterher."));

  app.sheet("Zero Waste", `${hinweise.length} ${hinweise.length === 1 ? "Hinweis" : "Hinweise"}`, body);
}

/**
 * Vorrats-Reichweite als Tagesskala.
 *
 * Vorher war das ein Fortschrittsring — ein Standardbauteil, das in
 * jeder zweiten App steckt und über den Gegenstand nichts aussagt.
 * Eine Skala mit Tagesstrichen sagt dasselbe und ist am Gegenstand:
 * man sieht, wie viele Tage noch abgetragen werden können und wo die
 * Woche endet.
 */
function rangeHero(ctx, app) {
  const r = ctx.range;
  const days = Math.max(0, Math.round(r.days));
  const SPAN = 14;                       // zwei Wochen sind der Maßstab
  const frac = Math.min(1, days / SPAN);
  const color = days <= 1 ? "var(--red)" : days <= 3 ? "var(--amber)" : "var(--accent)";

  // Balken mit runden Enden. Gezeichnet als Linie mit runder Kappe und
  // `vector-effect`, damit die Rundung rund bleibt, wenn die Fläche in
  // die Breite gezogen wird — ein Rechteck mit `rx` würde zur Ellipse.
  const W = 300, PAD = 6;
  const x1 = PAD + frac * (W - PAD * 2);
  const bar = (to, stroke) =>
    `<line x1="${PAD}" y1="6" x2="${to.toFixed(1)}" y2="6" stroke="${stroke}" stroke-width="12" ` +
    `stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;

  const h = el("button", "hero");
  const txt = el("div", "txt");
  txt.append(el("b", null, "Vorrat reicht"));
  txt.append(el("small", null, esc(r.limiting.slice(0, 2).map((x) => x.name).join(", "))));
  h.append(txt);
  h.append(el("div", "heroRing",
    `<div class="val"><div class="n">${days}</div><div class="u">${days === 1 ? "Tag" : "Tage"}</div></div>` +
    `<svg viewBox="0 0 ${W} 12" preserveAspectRatio="none" aria-hidden="true">` +
    bar(W - PAD, "var(--fill-2)") + (days > 0 ? bar(x1, color) : "") + `</svg>`));
  h.append(el("div", "chev"));

  h.addEventListener("click", () => {
    const body = el("div");
    const list = el("ul", "plain");
    r.byProduct.slice(0, 10).forEach((x) => list.append(el("li", null,
      `<span class="flag ${x.days <= 1 ? "f-miss" : x.days <= 3 ? "f-gold" : "f-ok"}">${de(Math.round(x.days))} T</span>` +
      `<span>${esc(x.name)}<br><small>begrenzt durch ${x.limitedBy === "frische" ? "Frische" : "Menge"} · Sicherheit ${pct(x.confidence)}</small></span>`)));
    body.append(list);
    body.append(el("p", "srcnote",
      "Restbestand mal gelerntem Verbrauch, begrenzt durch die verbleibende Haltbarkeit. Der kleinere der beiden Werte gilt."));
    app.sheet("Vorrats-Reichweite", r.message, body);
  });
  return h;
}

/* ================================================================
   Wochenrückblick, Streak, Meilensteine
   ================================================================
   Drei Anzeigen aus einer Quelle: dem Ereignis-Protokoll. Sie
   rechnen hier nichts — jede Zahl kommt fertig aus compute().
   ================================================================ */

/** Die Karte, die sonntags oben auf der Liste steht. */
function reviewCard(ctx, app) {
  const r = ctx.review;
  const box = el("div", "reviewCard");

  const head = el("div", "rvHead");
  head.append(el("span", "rvTag", esc(r.label)));
  const close = el("button", "rvClose", "×");
  close.setAttribute("aria-label", "Rückblick schließen");
  close.addEventListener("click", (e) => { e.stopPropagation(); Data.markReviewSeen(r.weekKey); });
  head.append(close);
  box.append(head);

  const open = el("button", "rvBody");
  open.append(el("div", "rvHead2", esc(r.headline)));

  const strip = el("div", "rvStrip");
  r.lines.slice(0, 3).forEach((l) => {
    strip.append(el("div", "rvItem",
      `<div class="v">${esc(l.tile.v)}</div><div class="l">${esc(l.tile.l)}</div>`));
  });
  if (r.lines.length) open.append(strip);

  if (ctx.streak.weeks > 0) open.append(el("div", "rvStreak", esc(ctx.streak.message)));
  open.addEventListener("click", () => reviewSheet(ctx, app, { markSeen: true }));
  box.append(open);
  return box;
}

/**
 * Der ganze Rückblick, mit Herkunft jeder Zahl.
 *
 * Aus der Karte geöffnet gilt er als gelesen — dafür braucht es
 * keinen zweiten Knopf neben „Fertig“. Aus „Zahlen“ oder „Mehr“
 * geöffnet nicht: dort blättert man auch durch ältere Wochen, und
 * ein Blick zurück darf den fälligen Rückblick nicht wegräumen.
 */
function reviewSheet(ctx, app, opts = {}) {
  const r = ctx.review;
  const body = el("div");

  body.append(el("div", "note green", esc(r.headline)));

  if (r.quiet) {
    body.append(el("p", "sheetPara",
      "Nichts erfasst in diesem Zeitraum. Das ist keine schlechte Woche — die App zählt nur, was sie sieht."));
  } else {
    const facts = el("dl", "facts");
    r.lines.forEach((l) => {
      facts.append(el("dt", null, esc(l.label)));
      facts.append(el("dd", null,
        esc([l.value, l.note].filter(Boolean).join(" · ")) + (l.estimated ? ' <span class="pill warn">geschätzt</span>' : "")));
    });
    body.append(facts);
  }

  body.append(streakStrip(ctx));

  body.append(el("p", "srcnote",
    "„Gerettet“ ist eine Schätzung des abgewendeten Verlusts, „günstiger als üblich“ ist die nachrechenbare " +
    "Differenz zu deinem eigenen Medianpreis. Die beiden werden nicht addiert — eine Summe aus geschätzt und " +
    "gemessen wäre eine Zahl ohne Bedeutung."));

  app.sheet("Wochenrückblick", `${deDate(r.from)} – ${deDate(r.to)}`, body);
  if (opts.markSeen) Data.markReviewSeen(r.weekKey);
}

/** Acht Wochen als Punktereihe. Kein Ranking, kein Vergleich. */
function streakStrip(ctx) {
  const wrap = el("div", "streak");
  const dots = el("div", "sDots");
  ctx.streakWeeks.forEach((w) => {
    const d = el("span", "sDot" +
      (w.held ? " on" : w.vacation ? " vac" : "") + (w.current ? " now" : ""));
    d.setAttribute("title", w.week + (w.vacation ? " · Urlaub" : w.held ? "" : " · ohne Eintrag"));
    dots.append(d);
  });
  wrap.append(dots);
  wrap.append(el("div", "sTxt", esc(ctx.streak.message)));
  return wrap;
}

/** Meilensteine als waagerechte Reihe. */
function badgeScroller(ctx, app) {
  // Eigene Klasse statt `.scroller`: der steht mit negativen Rändern
  // am Seitenrand, hier sitzt er in einer gruppierten Liste mit
  // abgeschnittenen Ecken.
  const s = el("div", "badgeRow");
  ctx.badges.rows.forEach((row) => {
    const b = el("button", `badge m-${row.id}${row.current ? " on" : ""}`);
    b.append(el("div", "bIcon", markSvg(row.icon)));
    b.append(el("div", "bLbl", esc(row.label)));
    b.append(el("div", "bVal", esc(row.euros ? eur(row.value) : String(row.value))));
    const bar = el("div", "bBar");
    const fill = el("i");
    fill.style.width = Math.round(row.progress * 100) + "%";
    bar.append(fill);
    b.append(bar);
    // Nur der Abstand, nicht auch noch das Ziel: auf 132 Pixeln bricht
    // „noch 8,00 € bis 10 €“ in drei Zeilen. Das Ziel steht im Blatt.
    b.append(el("div", "bNext", esc(row.next
      ? `noch ${row.euros ? eur(row.remaining) : row.remaining}`
      : "alle Stufen erreicht")));
    b.addEventListener("click", () => badgeSheet(row, app));
    s.append(b);
  });
  return s;
}

function badgeSheet(row, app) {
  const body = el("div");
  const list = el("ul", "plain");
  row.steps.forEach((step) => {
    const done = row.value >= step;
    list.append(el("li", null,
      `<span class="flag ${done ? "f-ok" : ""}">${done ? "✓" : "–"}</span>` +
      `<span>${esc(row.euros ? step + " €" : `${step} ${row.unit}`)}` +
      `<br><small>${done ? "erreicht" : `noch ${esc(row.euros ? eur(step - row.value) : String(step - row.value))}`}</small></span>`));
  });
  body.append(list);
  body.append(el("p", "srcnote", esc(row.note)));
  app.sheet(row.label, row.currentTitle || `Stand: ${row.euros ? eur(row.value) : row.value} ${row.euros ? "" : row.unit}`, body);
}

/* ================================================================
   Einen gebuchten Bon korrigieren
   ================================================================
   Die Texterkennung liest, sie versteht nicht — und die Prüfliste
   fängt nicht alles ab. Wer einen Fehltreffer erst später bemerkt,
   musste bisher den ganzen Bon löschen und neu erfassen. Das ist der
   Moment, in dem eine App zum ersten Mal als lästig erlebt wird.

   Die Korrektur zieht Summe, Anzahl und den Erfassungsbetrag im
   Protokoll mit; was dabei passiert, steht in data.js. Hier steht
   nur, wie man drankommt.
   ================================================================ */
function receiptSheet(rec, app) {
  const body = el("div");
  const zeilen = Data.receiptLines(rec.id);

  // Datum und Markt stehen schon in der Überschrift des Blatts.
  body.append(el("p", "sheetPara",
    `${zeilen.length} ${zeilen.length === 1 ? "Position" : "Positionen"}. Eine antippen, um sie einem ` +
    "anderen Produkt zuzuordnen — oder mit × entfernen."));

  const liste = el("div");
  zeilen.forEach((kauf) => {
    const p = byId(kauf.productId);
    const r = el("div", "row");
    const haupt = el("button", "rowMain plainBtn");
    haupt.innerHTML =
      `<div class="rowTitle">${esc(p ? p.name : kauf.productId)}</div>` +
      `<div class="rowSub">${esc(`${de(kauf.quantity)}× ${eur(kauf.unitPrice)}`)}</div>`;
    haupt.addEventListener("click", () => reassignSheet(kauf, rec, app));
    r.append(haupt);
    r.append(el("div", "rowValue", eur(kauf.unitPrice * kauf.quantity)));

    const del = el("button", "del", "×");
    del.setAttribute("aria-label", `${p ? p.name : "Position"} entfernen`);
    del.addEventListener("click", () => {
      Data.updatePurchase(kauf.id, null);
      app.closeSheet();
      app.toast("Position entfernt");
    });
    r.append(del);
    liste.append(r);
  });
  body.append(liste);

  body.append(el("p", "srcnote",
    "Eine Korrektur zieht Summe und Anzahl mit. Erreichte Meilensteine bleiben — was einmal " +
    "geschafft war, verfällt nicht, auch nicht durch einen behobenen Tippfehler."));

  const del = el("button", "cta danger", "Ganzen Bon löschen");
  del.addEventListener("click", () => app.confirm("Bon löschen?",
    `${rec.store}, ${deDate(rec.date)} — ${zahlwort(zeilen.length, "Position", "Positionen")} und alles, was daraus gelernt wurde.`,
    () => { Data.removeReceipt(rec.id); app.closeSheet(); app.toast("Gelöscht"); }, "Löschen"));
  body.append(del);

  app.sheet(rec.store, deDate(rec.date), body);
}

/** Eine Position einem anderen Produkt zuordnen. */
function reassignSheet(kauf, rec, app) {
  const body = el("div");
  const p = byId(kauf.productId);
  body.append(el("p", "sheetPara",
    `Zurzeit gebucht als ${p ? p.name : kauf.productId}. Ein anderes Produkt suchen — ` +
    "der Rhythmus zieht mit um."));

  const feld = el("label", "field");
  const eingabe = el("input");
  eingabe.type = "search";
  eingabe.placeholder = "Produkt suchen";
  eingabe.setAttribute("aria-label", "Anderes Produkt suchen");
  feld.append(eingabe);
  body.append(feld);

  const treffer = el("ul", "results");
  body.append(treffer);

  const zeigen = () => {
    treffer.innerHTML = "";
    const query = eingabe.value.trim();
    if (!query) return;
    Data.searchProducts(query, 8).forEach((x) => {
      const li = el("li");
      const b = el("button");
      b.innerHTML = `<span class="rn">${esc(x.name)}</span><span class="rc">${esc(x.aisle)}</span>`;
      b.addEventListener("click", () => {
        Data.updatePurchase(kauf.id, { productId: x.id });
        // Und die Schreibweise merken, damit derselbe Fehltreffer
        // beim nächsten Bon nicht wieder passiert.
        if (kauf.raw) Data.learnAlias(kauf.raw, x.id);
        app.closeSheet();
        app.toast(`Jetzt ${x.name}`);
      });
      li.append(b);
      treffer.append(li);
    });
  };
  eingabe.addEventListener("input", zeigen);
  body.append(el("p", "srcnote",
    "Die Zuordnung gilt rückwirkend: der alte Rhythmus verliert diesen Kauf, der neue bekommt ihn."));

  app.sheet("Anders zuordnen", p ? p.name : null, body);
}

/* ================================================================
   Marke oder Eigenmarke
   ================================================================
   Ein Potenzial, kein Auftrag. Die App tauscht nichts, sie zeigt nur,
   was ein Wechsel im Jahr bedeuten würde — und trennt dabei strikt,
   was aus den eigenen Bons BELEGT ist von dem, was nur GESCHÄTZT ist.

   Die Reihenfolge in der Ansicht ist Absicht: Belegtes zuerst, weil
   es die einzige Zahl ist, für die der Haushalt selbst der Beleg ist.
   Geschätztes steht darunter, mit eigenem Titel und eigener Summe.
   Eine gemeinsame Zahl gibt es nicht — nicht, weil sie schwer zu
   rechnen wäre, sondern weil sie nichts bedeutete.
   ================================================================ */
function brandRow(c, app) {
  // Kurz halten: auf 390 Pixeln bricht jede dritte Angabe in eine
  // zweite Zeile, und dann liest niemand mehr die erste. Der
  // Prozentsatz und die Basis stehen im Blatt.
  const sub = `${eur(c.markenPreis)} gegen ${eur(c.eigenPreis)} · ${de(c.proJahr)}×/Jahr`;
  return uiRow(c.name, sub, null, {
    value: eur(c.jahresPotenzial),
    onClick: () => brandSheet(c, app)
  });
}

function brandSheet(c, app) {
  const body = el("div");
  const einheit = c.basis === "100g" ? "je 100 g" : "je Packung";

  // „M“ und „E“ sind genau die Art Kürzel, die man einmal erklärt
  // haben will — beide Marken sind deshalb antippbar.
  const zeile = (key, cls, kuerzel, titel, unten) => {
    const li = el("li");
    li.append(flag(key, cls, kuerzel));
    li.append(el("span", null, `${esc(titel)}<br><small>${esc(unten)}</small>`));
    return li;
  };
  const list = el("ul", "plain");
  list.append(zeile("marke", "", "M", c.marke ? brandLabel(c.marke) : "Marke",
    `${eur(c.markenPreis)} ${einheit} · ${zahlwort(c.markenKaeufe, "Kauf", "Käufe")}`));
  list.append(zeile("eigenmarke", "f-ok", "E", c.eigenmarke ? brandLabel(c.eigenmarke) : "Eigenmarke",
    `${eur(c.eigenPreis)} ${einheit}${c.belegt ? " · " + c.eigenKaeufe + " Käufe" : " · geschätzt"}`));
  body.append(list);

  body.append(uiRow("Unterschied", einheit, null, { value: eur(c.differenz) }));
  body.append(uiRow("Im Jahr", `bei ${de(c.proJahr)} Käufen`, null, { value: eur(c.jahresPotenzial) }));

  body.append(el("p", "srcnote", esc(c.belegt
    ? "Belegt: Du hast beides schon gekauft. Verglichen werden die Mediane deiner eigenen Preise — " +
      "ein einzelnes Angebot verschiebt die Zahl nicht."
    : "Geschätzt: Für dieses Produkt gibt es noch keinen eigenen Eigenmarken-Preis. Gerechnet wird mit " +
      Math.round(ESTIMATED_SHARE * 100) + " % Abstand, dem unteren Ende der üblichen Spanne. " +
      "Kauf die Eigenmarke einmal, und aus der Schätzung wird deine eigene Zahl.")));

  body.append(el("p", "srcnote",
    "Hochgerechnet wird nur auf den Anteil, den du wirklich als Marke kaufst. " +
    "Was du längst als Eigenmarke holst, steht hier nicht noch einmal."));

  // Der Blatt-Titel nennt das Produkt schon — „Nicht mehr für
  // Kaffee, gemahlen" wäre nur länger und läse sich schlechter.
  const off = el("button", "cta light", "Nicht mehr vorschlagen");
  off.addEventListener("click", () => {
    Data.toggleBrandOff(c.productId);
    app.closeSheet();
    app.toast(c.name + ": kein Vergleich mehr");
  });
  body.append(off);

  app.sheet(c.name, c.belegt ? "aus deinen Bons belegt" : "geschätzt", body);
}

/* ================================================================
   Etwas hinzufügen
   ================================================================
   Bis hierher war die Liste ein Automat: sie füllte sich selbst und
   ließ sich nur abwählen. Was die App nicht wissen KANN — Gäste am
   Wochenende, ein Rezept, Blumen für Oma — hatte keinen Weg hinein.

   Zwei Wege, einer davon ohne Katalog: wer etwas eintippt, das die
   Datenbank nicht kennt, bekommt es trotzdem auf die Liste. Diese
   freien Zeilen fließen ausdrücklich NICHT in die Rhythmen ein — aus
   „Blumen für Oma“ darf die App keinen Kaufabstand lernen.
   ================================================================ */
/**
 * „War die App zu spät?“ — gefragt in dem Moment, in dem es wahr ist.
 * ================================================================
 * DAS PROBLEM, DAS DAS LÖST.
 *
 * Von den Rückmeldungen hatte genau eine keinen natürlichen Moment.
 * „Hab noch“ hat einen: du gehst die Liste durch, siehst Milch,
 * weißt dass noch welche da ist, nimmst sie runter — der Moment IST
 * die Handlung. „War schon alle“ dagegen wird Tage vorher wahr, vor
 * dem leeren Kühlschrank. Bis jemand die Liste aufmacht, ist der
 * Ärger vorbei, und niemand öffnet ein Detail-Blatt, um zu melden,
 * dass eine App zu spät war.
 *
 * Damit konnte die App gut lernen, dass sie zu FRÜH ist, und
 * praktisch gar nicht, dass sie zu SPÄT ist. Eine Schieflage in
 * genau die unangenehmere Richtung.
 *
 * Der Moment, in dem es wahr wird, ist dieser: jemand setzt ein
 * Produkt selbst auf die Liste, das die App noch gar nicht
 * vorgeschlagen hätte. Dann war sie zu spät, und zwar jetzt gerade.
 *
 * WARUM GEFRAGT UND NICHT GESCHLOSSEN. Aus „hat es selbst
 * hinzugefügt“ automatisch „App war zu spät“ abzuleiten, wäre ein
 * stilles Signal, das neben den Kaufdaten in dieselbe Korrektur
 * liefe — die Doppelzählung, die dieses Projekt schon dreimal Geld
 * gekostet hat. Es gibt genug andere Gründe, etwas früher zu kaufen:
 * Gäste, ein Rezept, ein Angebot. Deshalb eine Frage mit einer
 * Antwort, die man auch weglassen kann.
 *
 * @returns {boolean} ob gefragt wurde — der Aufrufer unterdrückt
 *                    dann seine eigene Bestätigung.
 * ================================================================
 */
function askLate(productId, ctx, app) {
  // Haushaltsprodukte rechnen über eine Verbrauchsrate, nicht über
  // einen Kaufabstand — für sie gibt es nichts zu korrigieren.
  if (isNonFood(productId)) return false;

  const r = ctx.rhythms.get(productId);
  if (!r || !r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) return false;

  const dueIn = r.rhythmDays - daysBetween(r.lastPurchaseDate, ctx.ref);
  /* Erst ab zwei Tagen fragen. Wer einen Tag vor der Fälligkeit
     einkauft, hat nicht die App korrigiert, sondern eingekauft. */
  if (!(dueIn >= 2)) return false;

  const p = byId(productId);
  const body = frag();
  const g = uiGroup(`Die App hätte ${p.name} erst in ${tagen(dueIn)} vorgeschlagen.`,
    "Ein Ja verkürzt den gelernten Kaufabstand — es ist die einzige Rückmeldung, die das tut.\n\n" +
    "Deshalb wird gefragt statt geschlossen: dass du etwas früher kaufst, kann auch an Gästen, einem " +
    "Rezept oder einem Angebot liegen. Nur du weißt, ob es wirklich schon alle war.\n\n" +
    "Auch ein Ja wirkt nicht sofort: erst ab drei Rückmeldungen zu einem Produkt passt die App den " +
    "Rhythmus an, und höchstens um 40 %.");

  const ja = el("button", "row");
  ja.append(el("div", "rowMain",
    '<div class="rowTitle">Ja, war schon alle</div>' +
    '<div class="rowSub">der Abstand wird kürzer</div>'));
  ja.addEventListener("click", () => {
    Data.recordFeedback(productId, "empty", dueIn);
    App.closeSheet();
    app.toast("Notiert — der Takt wird angepasst", { icon: "↻" });
  });

  const nein = el("button", "row");
  nein.append(el("div", "rowMain",
    '<div class="rowTitle">Nein, nur diesmal</div>' +
    '<div class="rowSub">der Rhythmus bleibt, wie er ist</div>'));
  nein.addEventListener("click", () => App.closeSheet());

  g.body.append(ja, nein);
  body.append(g);
  app.sheet("Kam das zu spät?", p.name, body);
  return true;
}

function addSheet(ctx, app) {
  const body = el("div");

  const field = el("label", "field");
  const input = el("input");
  input.type = "search";
  input.placeholder = "Was fehlt noch?";
  input.setAttribute("aria-label", "Produkt suchen oder frei eintippen");
  field.append(input);
  body.append(field);

  const results = el("ul", "results");
  body.append(results);

  const put = (opts) => {
    const entry = Data.addManual({ ...opts, week: ctx.weekKey });
    if (!entry) return;
    app.closeSheet();
    /* Die Bestätigung nur, wenn nichts nachgefragt wird. Sonst legt
       sich der Hinweis über das Blatt und verdeckt die Antwort, um
       die gerade gebeten wird — das Blatt IST dann die Bestätigung. */
    if (!(opts.productId && askLate(opts.productId, ctx, app))) {
      app.toast(`${entry.name} auf der Liste`, { icon: "+" });
    }
  };

  function render() {
    const q = input.value.trim();
    results.innerHTML = "";

    Data.searchProducts(q, 8).forEach((p) => {
      const li = el("li");
      const b = el("button", null,
        `<span class="rn">${esc(p.name)}</span><span class="rc">${eur(p.typicalPrice)}</span>`);
      b.addEventListener("click", () => put({ productId: p.id }));
      li.append(b);
      results.append(li);
    });

    // Freie Zeile immer als letzte Möglichkeit — auch wenn der Katalog
    // etwas gefunden hat. Vielleicht ist „Brot“ hier die Sorte vom
    // Bäcker und nicht das Produkt aus der Datenbank.
    if (q) {
      const li = el("li", "freeRow");
      const b = el("button", null,
        `<span class="rn">„${esc(q)}“ frei eintragen</span><span class="rc">ohne Preis</span>`);
      b.addEventListener("click", () => put({ name: q }));
      li.append(b);
      results.append(li);
    }
    if (!q) results.append(el("li", null, '<div class="noHit">Tippe los — Katalog oder eigener Text.</div>'));
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = results.querySelector("button");
    if (first) first.click();
  });
  render();

  app.sheet("Etwas hinzufügen", "Kommt auf die Liste dieser Woche.", body);
  // Nach dem Öffnen des Blatts: sonst nimmt der Schließen-Knopf den
  // Fokus und die Tastatur bleibt zu.
  setTimeout(() => input.focus(), 0);
}

/** Kleines Blatt für eine frei eingetragene Zeile. */
function manualSheet(it, app) {
  const body = el("div");
  body.append(el("p", "sheetPara", "Von dir ergänzt — die App hat diese Zeile nicht vorgeschlagen."));
  if (!it.productId) {
    body.append(el("p", "sheetPara",
      "Sie steht nicht im Katalog. Deshalb rechnet die App damit keinen Rhythmus, keinen Vorrat und keinen Preis — " +
      "sie merkt sich nur, dass du sie diese Woche brauchst."));
  }
  const del = el("button", "cta danger", "Von der Liste nehmen");
  del.addEventListener("click", () => {
    Data.removeManual(it.manualId);
    app.closeSheet();
    app.toast(`${it.name} entfernt`, { icon: "−" });
  });
  body.append(del);
  app.sheet(it.name, null, body);
}

/** Eine Position der Vorschlagsliste. Knapp — Details im Blatt. */
/**
 * Eine Position der Liste.
 *
 * DER KREIS HEISST „IM WAGEN“, NICHT „AUF DER LISTE“.
 * Begründung steht bei App.toggleCart. Was hier folgt, ist die
 * Konsequenz: die Zeile kennt nur noch zwei Zustände — sie steht an,
 * oder sie liegt im Wagen. „Diese Woche nicht“ nimmt sie aus der
 * Liste heraus, dann steht sie hier gar nicht mehr.
 */
function listItem(it, ctx, app) {
  const p = byId(it.productId) || {};
  const manuell = it.basis === "manuell";
  const imWagen = Data.get().storeChecked.includes(it.choiceKey);
  const li = el("li", "item" + (imWagen ? " imWagen" : ""));

  const top = el("div", "top");
  const cb = el("input");
  cb.type = "checkbox"; cb.className = "box"; cb.checked = imWagen;
  cb.setAttribute("aria-label", `${it.name} in den Wagen`);
  cb.addEventListener("change", () => app.toggleCart(it.choiceKey));

  // Kein <button>, sondern ein Element mit Schaltflächen-Rolle: die
  // Marken darin sind selbst antippbar, und eine Schaltfläche in
  // einer Schaltfläche ist ungültiges HTML — Browser hängen die
  // innere dann aus dem Baum aus, und das Antippen ginge ins Leere.
  const main = el("div", "main");
  main.setAttribute("role", "button");
  main.setAttribute("tabindex", "0");
  main.setAttribute("aria-label", `Details zu ${it.name}`);
  const nm = el("div", "nm", esc(it.name));

  /* HÖCHSTENS EIN ZEICHEN, und nur wenn es eine HANDLUNG auslöst.
     Vorher konnten fünf nebeneinander stehen. Die Zielgruppe nannte
     das „überladen“, und der Grund ist nicht die Menge allein: „+8,4 %“
     ändert nichts an der Entscheidung, die Milch zu kaufen. Es ist
     eine Beobachtung, keine Aufforderung — und Beobachtungen gehören
     ins Detail-Blatt, das ein Tippen entfernt ist.

     Was bleibt, verlangt eine Entscheidung, BEVOR man losgeht:
       doppelt?  — vielleicht gar nicht kaufen
       hab noch  — die eigene Antwort, damit sie nicht vergessen wird
       von dir   — nicht die App hat das vorgeschlagen, du warst es
       VD        — direkt kühlen, nicht erst nach dem Kaffee
     Preisabweichung, Verderb-Risiko und „3 T überfällig“ stehen
     unverändert im Detail-Blatt. Überfällig ist ohnehin der GRUND,
     warum die Zeile hier steht — sie erklärt sich damit selbst. */
  const zeichen = [];
  if (ctx.duplicates.some((d) => d.productId === it.productId)) {
    zeichen.push(["doppelt", "dup", "doppelt?"]);
  }
  /* Die Marke „Deine Antwort" stand hier für abgewählte Positionen.
     Seit abgewählte Positionen die Liste verlassen und sich unten in
     „Nicht diese Woche" sammeln, kann sie nie mehr erscheinen — sie
     wäre ab jetzt toter Code, der bei jeder Zeile mitgeprüft wird. */
  if (manuell) zeichen.push(["own", "own", "von dir"]);
  /* Ausgeschrieben, nicht abgekürzt.
     „VD“ stand hier zwei Buchstaben lang und erklärte sich nur dem,
     der es antippt — und antippen tut man nur, was man versteht. Die
     Marke, die vor der einzigen rechtlich harten Frist der App warnt,
     darf kein Rätsel sein. Sie ist damit die längste Marke der Liste;
     das ist der Preis und er ist richtig herum bezahlt. */
  if (p.safetyCritical) zeichen.push(["vd", "safety", "Verbrauchsdatum"]);
  if (zeichen.length) nm.append(pill(...zeichen[0]));
  main.append(nm);
  main.addEventListener("keydown", (ev) => {
    if (ev.target !== main) return;          // eine Marke hat ihre eigene Taste
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); main.click(); }
  });
  main.addEventListener("click", () => {
    // Eine frei eingetragene Zeile hat kein Detail-Blatt — sie hat ja
    // keine Daten. Sie bekommt ihr eigenes, kleines.
    if (manuell && (!it.productId || !byId(it.productId))) manualSheet(it, app);
    else if (manuell) manualSheet(it, app);
    else productSheet(it.productId, ctx);
  });

  // Ohne Preis keine Preisspalte — „0,00 €“ wäre eine Behauptung.
  top.append(cb, main, el("div", "price", it.price > 0 ? eur(it.halved ? it.price / 2 : it.price) : "—"));
  /* Der Winkel am Ende. Der Name öffnet seit jeher das Detail-Blatt,
     aber nichts sagte das: überall sonst in der App markiert genau
     dieser Winkel eine Zeile, die sich öffnen lässt — nur auf der
     Liste fehlte er. Damit war das Blatt mit Rhythmus, Preisverlauf
     und Datenqualität für jeden unsichtbar, der nicht zufällig
     draufgetippt hat. */
  top.append(el("div", "chev"));
  li.append(top);

  /* Der Vorschlag zur halben Menge.
     Vorher stand hier ein grauer Knopf „Halbe Menge“ ohne jeden
     Zusammenhang — die einzige Zeile der Liste, die doppelt so hoch
     war, und niemand wusste, warum sie es war. Jetzt sagt sie den
     Grund und ist selbst die Antwort darauf: ein Satz, den man
     antippt. Das ist dieselbe Handlung, nur verständlich. */
  if (it.on && it.riskFlag) {
    const p2 = byId(it.productId) || {};
    // Kurz halten: auf 390 Pixeln bricht jeder längere Satz um, und
    // eine zweizeilige Zeile in einer Liste sieht wieder nach Ballast
    // aus — genau dem, was hier abgebaut werden sollte.
    const grund = p2.shelfLifeDays && p2.shelfLifeDays <= 7
      ? `Hält ${tage(p2.shelfLifeDays)}`
      : "Bleibt oft übrig";
    const h = el("button", "halfRow" + (it.halved ? " on" : ""));
    h.setAttribute("aria-pressed", it.halved ? "true" : "false");
    h.innerHTML = it.halved
      ? `<span class="hMark">✓</span><span>Halbe Menge · spart ${esc(eur(it.price / 2))}</span>`
      : `<span class="hMark">½</span><span>${esc(grund)} — halbe Menge?</span>`;
    h.addEventListener("click", () => {
      const now = !it.halved;
      app.choose(it.choiceKey, { halved: now });
      // Nur beim Setzen. Gegen mehrfaches Zählen sperrt zusätzlich
      // Data.recordRescue — ein Produkt kann höchstens einmal am Tag
      // gerettet werden.
      if (now) app.rescue(it.productId, `${it.name}: halbe Menge`, it.price / 2);
    });
    li.append(h);
  }

  return li;
}

/**
 * Die vier Antworten — jetzt an einem benannten Ort.
 *
 * Sie standen in der Zeile und erschienen, sobald man den Haken
 * wegnahm. Das war eine Frage ohne Überschrift („warum eigentlich?“)
 * und dazu falsch aufgehängt: „War schon alle“ heißt ja gerade, dass
 * das Produkt gebraucht wird — es korrigiert nur den Takt und bleibt
 * auf der Liste. Als Antwort auf „warum weg?“ ergab das keinen Sinn.
 *
 * Jetzt steht die Frage ausgeschrieben da, und die Antworten sagen
 * jeweils, was sie bewirken.
 */
function weekChoice(it, ctx, app, onDone) {
  const g = uiGroup("Brauchst du das diese Woche?",
    "„Hab noch“ sagt der App, dass ihr Vorschlag zu früh kam — der gelernte Kaufabstand wird länger. " +
    "„Diese Woche nicht“ ist eine bewusste Pause und lässt den Rhythmus in Ruhe.\n\n" +
    "Nichts davon wird sofort verrechnet: erst ab drei Rückmeldungen zu einem Produkt passt die App " +
    "den Rhythmus an, und höchstens um 40 %. Eine einzelne Antwort kippt nichts um.\n\n" +
    "Die Gegenrichtung — „war schon alle, du warst zu spät“ — wird nicht hier gefragt, sondern in dem " +
    "Moment, in dem sie wahr ist: wenn du ein Produkt selbst hinzufügst, das noch gar nicht fällig war.");

  WEEK_REASONS.map((k) => REASONS.find((r) => r.key === k)).forEach((rr) => {
    const gewaehlt = it.reason === rr.key;
    const r = el("button", "row" + (gewaehlt ? " chosen" : ""));
    r.setAttribute("aria-pressed", gewaehlt ? "true" : "false");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(rr.label)}</div><div class="rowSub">${esc(REASON_EFFECT[rr.key])}</div>`));
    if (gewaehlt) r.append(el("div", "rowValue", "✓"));
    r.addEventListener("click", () => {
      app.choose(it.choiceKey, { reason: rr.key });
      if (onDone) onDone();
    });
    g.body.append(r);
  });

  if (!it.on) {
    const zurueck = el("button", "row");
    zurueck.append(el("div", "rowMain",
      '<div class="rowTitle">Doch drauf</div><div class="rowSub">zurück auf die Liste dieser Woche</div>'));
    zurueck.addEventListener("click", () => {
      app.choose(it.choiceKey, { on: true, reason: null });
      if (onDone) onDone();
    });
    g.body.append(zurueck);
  }
  return g;
}

/** Was jede Antwort bewirkt — in einem Halbsatz, nicht in einem Absatz. */
const REASON_EFFECT = {
  have: "der Vorschlag kam zu früh — der Abstand wird länger",
  empty: "kam zu spät — der Abstand wird kürzer",
  skip: "eine bewusste Pause, ohne Wirkung auf den Rhythmus"
};

/** Was diese Woche nicht gebraucht wird — gesammelt statt verstreut. */
function weekOffSheet(ctx, app) {
  const off = ctx.items.filter((i) => !i.on);
  const body = frag();
  if (!off.length) body.append(el("p", "empty", "Nichts abgewählt."));
  off.forEach((it) => {
    const g = uiGroup(it.name, null);
    const rr = REASONS.find((x) => x.key === it.reason);
    g.body.append(uiRow(rr ? rr.label : "abgewählt", rr ? REASON_EFFECT[rr.key] : null, null, {}));
    const zurueck = el("button", "row");
    zurueck.append(el("div", "rowMain",
      '<div class="rowTitle">Doch drauf</div><div class="rowSub">zurück auf die Liste dieser Woche</div>'));
    zurueck.addEventListener("click", () => {
      app.choose(it.choiceKey, { on: true, reason: null });
      App.closeSheet();
    });
    g.body.append(zurueck);
    body.append(g);
  });
  app.sheet("Nicht diese Woche", `${off.length} ${off.length === 1 ? "Position" : "Positionen"}`, body);
}


/* ================================================================
   Fällig — Austausch und Nachschub bei Haushaltsprodukten
   ================================================================
   Die Klasse INTERVAL braucht kein Verbrauchsmodell und keine
   Historie: Kaufdatum plus Intervall genügt. Das Ergebnis sind
   Handlungen, keine Käufe — „getauscht“ setzt den Zähler zurück,
   ohne dass etwas gekauft wurde.
   ================================================================ */
function viewFaellig(ctx, app) {
  const c = frag();

  const due = ctx.swapsDue.filter((x) => x.due);
  const soon = ctx.swapsDue.filter((x) => !x.due);
  const lowSupply = ctx.supplies.filter((x) => x.dueForPurchase);

  if (!ctx.swapsDue.length && !lowSupply.length) {
    c.append(emptyView(
      ctx.nonFoodEntries.length
        ? "Nichts fällig. Alles im Rhythmus."
        : "Noch keine Haushaltsprodukte erfasst.",
      ctx.nonFoodEntries.length ? null : "Einkauf erfassen",
      () => app.goto("erfassen"),
      ctx.nonFoodEntries.length ? "froh" : "neutral"));
    return c;
  }

  /* --- Austausch: die eigentliche Neuerung --- */
  if (due.length) {
    const g = uiGroup("Jetzt tauschen",
      "Austausch nach Zeit, unabhängig vom Verbrauch — meist hygienisch begründet. " +
      "Ein Tippen auf „Getauscht\“ setzt den Zähler zurück, auch ohne Kauf.");
    due.forEach((x) => g.body.append(swapRow(x, ctx, app)));
    c.append(g);
  }
  if (soon.length) {
    const g = uiGroup("Demnächst");
    soon.forEach((x) => g.body.append(swapRow(x, ctx, app)));
    c.append(g);
  }

  /* --- Nachschub: hier geht etwas aus --- */
  if (lowSupply.length) {
    const g = uiGroup("Geht aus",
      "Geschätzt aus Packungsmenge und gelerntem Verbrauch. Die Vorwarnzeit richtet sich nach deinem " +
      "eigenen Einkaufsrhythmus: wer selten einkauft, bekommt früher Bescheid.");
    lowSupply.forEach((sup) => {
      const r = el("button", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(sup.name)}</div>` +
        `<div class="rowSub">${esc(supplyText(sup))}</div>`));
      r.append(supplyValue(sup));
      r.append(el("div", "chev"));
      r.addEventListener("click", () => productSheet(sup.productId, ctx));
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Bevorratung: nur bei gutem Preis UND gelernter Rate --- */
  if (ctx.stockUp.length) {
    const g = uiGroup("Günstig bevorraten",
      "Haushaltsprodukte verderben nicht — Vorrat bei gutem Preis ist sinnvoll. Der Vorschlag " +
      "erscheint nur, wenn der Verbrauch gelernt ist und der Grundpreis unter deinem üblichen liegt.");
    ctx.stockUp.forEach((a) => g.body.append(uiRow(a.name, a.message, null, {
      value: `${a.units}×`,
      onClick: () => app.notice(a.name, a.message +
        (a.cappedByLimit ? `\n\nBegrenzt auf ${a.storageLimit} Packungen Lagerplatz.` : "") +
        (a.cycleLearned ? "\n\nAktionszyklus aus deiner Preishistorie gelernt." : "\n\nAktionszyklus als Vorgabewert."))
    })));
    c.append(g);
  }

  return c;
}

/**
 * Lebensmittel, die beim letzten Einkauf deutlich unter dem eigenen
 * üblichen Preis lagen — die Lebensmittel-Entsprechung zu „Günstig
 * bevorraten" oben, das nur Haushaltsprodukte kennt.
 *
 * Bewusst getrennt von jenem Abschnitt statt eingemischt: der eine
 * Grund für eine Empfehlung (Haltbarkeit) und der andere (Lagerplatz,
 * Aktionszyklus) haben kaum etwas gemeinsam, und eine Liste, die beide
 * mischt, beantwortet keine der beiden Fragen mehr sauber.
 */
function viewAngebote(ctx, app) {
  const c = frag();

  if (!ctx.foodDeals.length) {
    c.append(emptyView(
      "Gerade keine Angebote erkannt. Das braucht ein paar Einkäufe mehr Preisgeschichte je Produkt.",
      "Einkauf erfassen", () => app.goto("erfassen")));
    return c;
  }

  const g = uiGroup("Zuletzt günstig gekauft",
    "Bei diesen Produkten hast du beim letzten Einkauf mindestens 15 % unter deinem üblichen " +
    "Preis bezahlt. Kein aktueller Regalpreis — die App kennt nur, was auf deinen Bons stand.\n\n" +
    "Die Menge ist durch die Haltbarkeit begrenzt: nie mehr, als bis dahin aufgebraucht wäre.");
  ctx.foodDeals.forEach((a) => g.body.append(uiRow(a.name,
    `${Math.round(a.nachlass * 100)} % günstiger · zuletzt ${deDate(a.lastDate)}`, null, {
      value: a.kind === "vorrat" ? `${a.einheiten}×` : null,
      onClick: () => productSheet(a.productId, ctx)
    })));
  c.append(g);
  return c;
}

/** Restlaufzeit als Satz, mit richtigem Numerus. */
function supplyText(sup) {
  if (sup.daysOfSupply === null || sup.confidence === "UNSICHER") return "unregelmäßig";
  const d = Math.round(sup.daysOfSupply);
  if (d <= 0) return "vermutlich leer";
  return d === 1 ? "reicht noch einen Tag" : `reicht noch ${tage(d)}`;
}

/**
 * Eine Austauschzeile. Der Name führt zum Detail-Blatt, rechts steht
 * die eine Handlung, um die es geht.
 */
/** Eine günstigere Alternative zu einer wegen Budget gestrichenen
 *  Position -- Tauschen statt nur Streichen (siehe budgetOptimizer.js). */
function budgetSwapRow(removed, alt, ctx, app) {
  const r = el("div", "row");
  const main = el("div", "rowMain");
  main.innerHTML =
    `<div class="rowTitle">${esc(alt.name)} ${esc(eur(alt.price))}</div>` +
    `<div class="rowSub">statt ${esc(removed.name)} &middot; ${esc(eur(alt.saving))} sparen</div>`;
  r.append(main);

  const swap = el("button", "pillBtn swapBtn", "Tauschen");
  swap.addEventListener("click", () => {
    Data.addManual({ productId: alt.productId, week: ctx.weekKey });
    app.toast(`${alt.name} statt ${removed.name}`);
  });
  r.append(swap);
  return r;
}

function swapRow(x, ctx, app) {
  const r = el("div", "row");
  const main = el("button", "rowMain plainBtn");
  main.setAttribute("aria-label", `Details zu ${x.name}`);
  main.innerHTML =
    `<div class="rowTitle">${esc(x.name)}</div>` +
    `<div class="rowSub">${esc(x.due
      ? `seit ${tagen(x.inUse)} im Einsatz`
      : `fällig in ${tagen(x.daysLeft)}`)}</div>`;
  main.addEventListener("click", () => productSheet(x.productId, ctx));
  r.append(main);

  // "swapBtn" statt der geteilten .pillBtn.on-Vollfläche: dieselbe
  // Farbe volltonig zu geben wie dem einen Hauptknopf einer Seite
  // (.cta) verliert ihr Gewicht, sobald sie mehrfach untereinander in
  // einer Liste steht -- hier oft mehrmals, je ein "Getauscht" pro
  // fälligem Produkt.
  const swap = el("button", "pillBtn swapBtn" + (x.due ? " on" : ""), "Getauscht");
  swap.addEventListener("click", () => app.swap(x.productId, x.name));
  r.append(swap);
  return r;
}

/* ================================================================
   3. Bestand
   ================================================================ */
function viewBestand(ctx, app) {
  const c = frag();

  if (!ctx.inventory.length && !ctx.supplies.length) {
    c.append(emptyView("Kein Bestand schätzbar.", "Einkauf erfassen", () => app.goto("erfassen")));
    return c;
  }

  const S = Data.get();
  const urlaub = S.settings.vacation;
  const urlaubAktiv = urlaub.active && !!urlaub.from;

  // Drei Unterbereiche statt einer Einzelseite, die mit Beispieldaten
  // auf über 2300px Höhe kommt, nur durch Überschriften getrennt --
  // dasselbe Symptom, das "Zahlen" und "Mehr" mit einem Segment schon
  // einmal gelöst haben (siehe deren Kommentare). "Reise" erscheint
  // nur, wenn wirklich etwas dagegen abzuwägen ist.
  const tabs = [["vorrat", "Vorrat"], ["kueche", "Küche"]];
  if (urlaubAktiv) tabs.push(["reise", "Reise"]);
  const nav = el("div", "group");
  nav.append(segmented(tabs, app.bestandTab, (k) => { app.bestandTab = k; app.render(); }, "Bereich"));
  c.append(nav);

  if (app.bestandTab === "kueche") renderBestandKueche(c, ctx, app);
  else if (app.bestandTab === "reise" && urlaubAktiv) renderBestandReise(c, ctx, urlaub);
  else renderBestandVorrat(c, ctx, app);

  return c;
}

/** Unterbereich "Vorrat": Reichweite, Angebrochenes, was vermutlich noch da ist. */
function renderBestandVorrat(c, ctx, app) {
  if (ctx.range.days !== null) c.append(rangeHero(ctx, app));

  /* --- Angebrochen --- */
  if (ctx.opened.length) {
    const g = uiGroup("Angebrochen",
      "Geöffnete Packungen halten kürzer. Ab der Markierung rechnet die Bestandsschätzung mit der kurzen Frist.");
    ctx.opened.forEach((o) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(o.name)}</div><div class="rowSub">seit ${tagen(o.openedDays)}</div>`));
      r.append(flag(o.expired ? "angebrochen" : "rest",
        o.expired ? "f-miss" : o.urgent ? "f-gold" : "f-ok",
        o.expired ? "über Frist" : `${o.daysLeft} T`));
      // Aufgebraucht statt nur „weg“: eine angebrochene Packung, die
      // vor ihrer Frist leer wird, ist genau der Fall, den die App
      // verhindern helfen soll. Nach Fristablauf zählt sie nicht mehr
      // — dann war es keine Rettung.
      const inv = ctx.inventory.find((i) => i.productId === o.productId);
      const undo = el("button", "pillBtn", "Aufgebraucht");
      undo.setAttribute("aria-label", `${o.name} aufgebraucht`);
      undo.addEventListener("click", () => {
        Data.toggleOpened(o.productId);
        if (o.expired) app.toast("Notiert", { icon: "·" });
        else app.rescue(o.productId, `${o.name} aufgebraucht`, inv ? inv.value : 0);
      });
      r.append(undo);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Bestand --- */
  const inv = uiGroup("Vermutlich noch da",
    "Geschätzt aus Einkauf minus Verbrauch, ohne dass du etwas pflegst. Die Zahl vor dem „×“ ist ein " +
    "Vielfaches deiner zuletzt gekauften Menge — „0,6×“ heißt: etwa 60 % von dem, was du beim letzten " +
    "Mal mitgenommen hast. Die Sicherheitsangabe steht im Detail-Blatt jeder Zeile.");
  const renderInvRow = (i) => {
    const p = byId(i.productId) || {};
    const longLived = !p.isFood || i.daysLeft > 120;
    const flagCls = i.daysLeft <= 2 ? "f-miss" : i.daysLeft <= 5 ? "f-gold" : "f-ok";
    // Wie in der Liste: die Marke rechts ist selbst antippbar, also
    // darf die Zeile keine echte Schaltfläche sein.
    const r = el("div", "row");
    r.setAttribute("role", "button");
    r.setAttribute("tabindex", "0");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(i.name)}${i.opened ? ' <span class="pill">offen</span>' : ""}</div>` +
      `<div class="rowSub">${de(i.remainingUnits.toFixed(1))}× · ${eur(i.value)}</div>`));
    r.append(flag(longLived ? "haltbar" : "rest", longLived ? "f-ok" : flagCls,
      longLived ? "haltbar" : `${i.daysLeft} T`));
    r.addEventListener("keydown", (ev) => {
      if (ev.target !== r) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); r.click(); }
    });
    r.append(el("div", "chev"));
    r.addEventListener("click", () => productSheet(i.productId, ctx));
    return r;
  };
  // Vorher schnitt die Liste bei 20 Positionen kommentarlos ab. Jetzt
  // dasselbe "Alle N ansehen"-Muster wie in moneyBarSection() --
  // dieselbe Kante, dieselbe Beschriftung, nicht neu erfunden.
  const INV_VISIBLE = 20;
  ctx.inventory.slice(0, INV_VISIBLE).forEach((i) => inv.body.append(renderInvRow(i)));
  const invRest = ctx.inventory.slice(INV_VISIBLE);
  if (invRest.length) {
    const btn = el("button", "moneyMore", `Alle ${ctx.inventory.length} ansehen`);
    btn.addEventListener("click", () => {
      invRest.forEach((i) => btn.before(renderInvRow(i)));
      btn.remove();
    });
    inv.body.append(btn);
  }

  /* --- Haushaltsprodukte: eigene Rechnung, eigene Gruppe --- */
  let hh = null;
  if (ctx.supplies.length) {
    hh = uiGroup("Haushalt",
      "Andere Rechnung als bei Lebensmitteln: Haushaltsprodukte verderben nicht, also entspricht die " +
      "gekaufte Menge der verbrauchten. Deshalb eine Verbrauchsrate statt eines Kaufrhythmus.\n\n" +
      "Der Punkt hinter der Zahl zeigt, worauf sie beruht: gefüllt heißt aus deinen Käufen gelernt, " +
      "hohl heißt Schätzwert. Bei unregelmäßigem Kauf steht ein Strich statt einer Zahl.");
    ctx.supplies.forEach((sup) => {
      const r = el("button", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(sup.name)}</div>` +
        `<div class="rowSub">${esc(sup.daysOfSupply === null || sup.confidence === "UNSICHER"
          ? "unregelmäßig"
          : `${de(Math.round(sup.remaining))} ${sup.unit} übrig`)}</div>`));
      r.append(supplyValue(sup));
      r.append(el("div", "chev"));
      r.addEventListener("click", () => productSheet(sup.productId, ctx));
      hh.body.append(r);
    });

    /* Der Weg zu „Fällig“.
     *
     * Seit die Seite keinen eigenen Reiter mehr hat, führt die
     * Startseite nur dorthin, wenn wirklich etwas zu tauschen ist.
     * Ohne diese Zeile wäre sie an ruhigen Tagen nur noch über die
     * Adresse erreichbar — und „Demnächst“, „Geht aus“ und
     * „Günstig bevorraten“ wären damit verschwunden statt umgezogen.
     * (Ein zweiter, dauerhafter Weg steht seither auch unter
     * Mehr → Auswertungen, für den Fall, dass auch das nicht zutrifft.) */
    if (ctx.swapsDue.length || ctx.stockUp.length) {
      const offen = ctx.swapsDue.filter((x) => x.due).length;
      hh.body.append(uiRow("Austausch und Nachschub",
        offen ? `${offen} ${offen === 1 ? "Produkt ist" : "Produkte sind"} fällig` : "nichts fällig",
        null, { onClick: () => app.goto("faellig") }));
    }
  }

  // Auf dem Rechner nebeneinander statt untereinander: zwei
  // unabhängige, gleich aufgebaute Listen -- ein Lehrbuchfall für die
  // vorbereitete .cards2-Regel aus app.css, die vorher in keiner
  // Ansicht verwendet wurde. Auf dem Telefon bewirkt .cards2 nichts
  // (die Regel steht nur im ≥900px-Media-Query), beide bleiben also
  // wie gewohnt untereinander.
  if (hh) {
    const pair = el("div", "cards2");
    pair.append(inv, hh);
    c.append(pair);
  } else {
    c.append(inv);
  }
}

/** Unterbereich "Küche": Rezeptvorschläge und Einräumhilfe. */
function renderBestandKueche(c, ctx, app) {
  /* --- Rezepte --- */
  const rec = suggestRecipes(toRecipeStock(ctx.inventory), { maxResults: 5 });
  const g = uiGroup("Kochen", "Sortiert nach gerettetem Betrag, nicht nach Geschmack. Bewusst ohne Nährwerte.");
  (rec.unsafeIngredients || []).forEach((u) => g.body.append(uiRow(u.message, null, el("span", "flag f-miss", "!"))));
  if (!rec.length) g.body.append(el("p", "empty", "Kein passendes Rezept."));
  rec.forEach((x) => {
    const r = el("div", "row");
    const main = el("button", "rowMain plainBtn");
    main.innerHTML =
      `<div class="rowTitle">${esc(x.name)}</div>` +
      `<div class="rowSub">${esc(`${x.minutes} Min${x.complete ? "" : " · fehlt: " + x.missing.join(", ")}`)}</div>`;
    main.addEventListener("click", () => app.notice(x.name,
      `${x.minutes} Minuten.\n\nNutzt aus deinem Bestand: ${x.usesFromStock.join(", ") || "—"}` +
      (x.complete ? "" : `\n\nFehlt: ${x.missing.join(", ")}`)));
    r.append(main);
    if (x.rescuedValue > 0) r.append(el("div", "rowValue", eur(x.rescuedValue)));
    // Ein Rezept anzuzeigen rettet nichts. Erst das Kochen tut es —
    // deshalb der Knopf, und deshalb zählt nur er.
    if (x.complete && x.usesFromStock.length) {
      const cooked = el("button", "pillBtn", "Gekocht");
      cooked.setAttribute("aria-label", `${x.name} gekocht`);
      cooked.addEventListener("click", () => {
        // `usesFromStock` trägt Namen, das Protokoll braucht eine
        // Produktkennung — sonst stünde im Rückblick der Rezeptname
        // an der Stelle, an der ein Produkt erwartet wird.
        const used = ctx.inventory.filter((i) => x.usesFromStock.includes(i.name));
        app.rescue(used.length ? used[0].productId : null, `${x.name} gekocht`, x.rescuedValue);
      });
      r.append(cooked);
    }
    g.body.append(r);
  });
  c.append(g);

  /* --- Einräumen --- */
  const guide = buildStorageGuide(ctx.knownItems.filter((i) => i.on));
  if (guide.length) {
    const s = uiGroup("Einräumen", "Reihenfolge nach der Kühlschrankgrafik des BZfE: das Kritischste zuerst.");
    guide.forEach((z) => s.body.append(uiRow(z.zone.split("(")[0].trim(), z.items.map((i) => i.name).join(", "))));
    c.append(s);
  }
}

/** Unterbereich "Reise": was vor der Abreise noch aufgebraucht werden sollte. */
function renderBestandReise(c, ctx, urlaub) {
  const plan = useUpPlan(ctx.inventory, urlaub.from, urlaub.to, ctx.ref);
  const p = uiGroup("Vor der Abreise", plan.summary);
  plan.mustUse.forEach((x) => p.body.append(uiRow(x.name, `noch ${tage(x.daysLeft)}`, el("span", "flag f-gold", "aufbrauchen"))));
  plan.freeze.forEach((x) => p.body.append(uiRow(x.name, eur(x.value), el("span", "flag f-new", "einfrieren"))));
  if (!plan.mustUse.length && !plan.freeze.length) p.body.append(el("p", "empty", "Nichts gefährdet."));
  c.append(p);
}

/* ================================================================
   4. Erfassen
   ================================================================ */
function viewErfassen(ctx, app) {
  const c = frag();
  const cap = app.capture;

  const tabs = el("div", "group");
  tabs.append(segmented([["scan", "Bon"], ["manual", "Von Hand"]], cap.tab,
    (k) => { cap.tab = k; app.render(); }, "Erfassungsart"));
  c.append(tabs);

  const box = card();
  if (cap.tab === "scan") renderScan(box, cap, app);
  else renderManual(box, cap, app);
  c.append(box);

  const S = Data.get();
  if (S.receipts.length) {
    const g = uiGroup("Bons");
    [...S.receipts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).forEach((rec) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(rec.store)}</div><div class="rowSub">${deDate(rec.date)} · ${zahlwort(rec.itemCount, "Position", "Positionen")}</div>`));
      r.append(el("div", "rowValue", eur(rec.total)));
      // Antippen öffnet die Positionen. Bis hierher konnte man einen
      // Bon nur ganz löschen — nach einem Fehltreffer der Erkennung
      // hieß das: alles wegwerfen und neu erfassen.
      const oeffnen = el("button", "rowOpen");
      oeffnen.setAttribute("aria-label", `Bon vom ${deDate(rec.date)} ansehen`);
      oeffnen.append(el("div", "chev"));
      oeffnen.addEventListener("click", () => receiptSheet(rec, app));
      r.append(oeffnen);
      g.body.append(r);
    });
    c.append(g);
  }
  return c;
}

/**
 * Zweite Stufe im Hintergrund anstoßen — für Zeilen, die der eigene
 * Katalog nicht einordnen konnte. Läuft nach dem Rendern, still, und
 * zeichnet nur neu, wenn sich wirklich etwas ergeben hat.
 *
 * Die Prüfung `cap.parsed !== parsed` fängt den Fall ab, dass der
 * Nutzer während der Anfrage schon den nächsten Bon fotografiert
 * oder das Feld geleert hat — sonst würde eine späte Antwort auf
 * einen Bon, der gar nicht mehr angezeigt wird, trotzdem die
 * Oberfläche verändern.
 */
function nachschlagen(cap, app) {
  const parsed = cap.parsed;
  if (!parsed) return;
  Data.enrichUnmatched(parsed).then((geaendert) => {
    if (geaendert && cap.parsed === parsed) app.render();
  });
}

/* ================================================================
   Bild statt Abtippen
   ================================================================
   Zwei Wege führen zum selben Ziel: das Foto eines Papierbons und
   der Screenshot eines digitalen Bons aus der Händler-App. Beides
   ist ein Bild, beides landet nach der Erkennung im selben Textfeld
   und derselben Prüfliste — die Zuordnung bestätigt weiterhin ein
   Mensch, Zeile für Zeile.

   Das ist keine Bequemlichkeit, sondern die Bedingung: eine
   Texterkennung liest, sie versteht nicht. Sie darf Vorschläge
   machen und niemals buchen.
   ================================================================ */
function ocrPicker(box, cap, app) {
  const wrap = el("div", "shot");

  // Aus dem System-Teilen-Menü angekommen (siehe App.consumeSharedIfAny).
  // Nur einmal abgeholt — sofort leeren, sonst griffe ein späterer
  // erneuter Aufbau dieser Ansicht denselben Fund noch einmal auf.
  //
  // Text übernehmen und ein falsches Dateiformat melden passiert HIER,
  // vor der Weiche nach Texterkennungs-Unterstützung: sonst würde eine
  // geteilte PDF-Datei in einem Browser ohne Texterkennung spurlos
  // verschwinden, statt wenigstens gesagt zu bekommen, dass sie nicht
  // gelesen werden konnte.
  const geteilt = app.pendingShare;
  if (geteilt) app.pendingShare = null;
  const bildhaft = !!(geteilt && geteilt.datei && /^image\//.test(geteilt.datei.type || ""));
  if (geteilt && geteilt.datei && !bildhaft) {
    // Manche Händler-Apps bieten den eBon als PDF zum Teilen an, nicht
    // als Bild. Die Texterkennung liest bisher nur Bilder.
    app.notice("Dieses Format liest die Texterkennung noch nicht",
      `Aus dem Teilen-Menü kam eine Datei vom Typ „${geteilt.datei.type || "unbekannt"}" — ` +
      "die Texterkennung liest bisher nur Bilder.\n\n" +
      "Zwei Wege bleiben: den Bon-Text unten einfügen, oder in der Händler-App statt der " +
      "Datei einen Screenshot teilen.");
  }
  if (geteilt && geteilt.text && !cap.text) cap.text = geteilt.text;

  if (!OCR.supported()) {
    // Kein Vorwurf und kein Fehler: der Textweg steht ja darunter.
    wrap.append(el("p", "srcnote", esc(OCR.reason())));
    box.append(wrap);
    return;
  }

  const status = el("div", "shotStatus");
  const bar = el("div", "shotBar");
  const fill = el("i");
  bar.append(fill);

  const setStatus = (text, anteil) => {
    status.textContent = text;
    bar.hidden = anteil === null;
    fill.style.width = Math.round((anteil || 0) * 100) + "%";
  };

  const input = el("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  input.setAttribute("aria-label", "Bon-Bild wählen");

  const kamera = el("input");
  kamera.type = "file";
  kamera.accept = "image/*";
  // Sagt dem Telefon: Kamera, Rückseite. Auf dem Rechner ohne Wirkung.
  // Als Attribut, nicht als Eigenschaft: `capture` ist nicht überall
  // an eine Eigenschaft gebunden, das Attribut wird dagegen von jedem
  // Browser gelesen, der es kennt.
  kamera.setAttribute("capture", "environment");
  kamera.hidden = true;
  kamera.setAttribute("aria-label", "Bon fotografieren");

  let laeuft = false;

  const lies = (datei) => {
    if (!datei || laeuft) return;
    if (!/^image\//.test(datei.type || "")) { app.toast("Das ist kein Bild"); return; }
    laeuft = true;
    cap.shotName = datei.name || "Bild";
    setStatus("Bild wird gelesen …", 0);
    app.render();

    OCR.read(datei, (phase, anteil) => {
      setStatus(phase === "liest" ? "Text wird gelesen …" : "Texterkennung wird geladen …", anteil);
    })
      .then((text) => {
        const gelesen = readReceiptImage(text, { today: Data.today() });
        laeuft = false;
        cap.text = gelesen.text;
        cap.ocr = gelesen;
        // Datum und Markt nur setzen, wenn im Bild etwas stand —
        // eine leere Vorgabe zu überschreiben hilft, eine bewusst
        // gesetzte zu überschreiben ärgert.
        if (gelesen.date) cap.date = gelesen.date;
        if (gelesen.store) cap.store = gelesen.store;
        cap.parsed = gelesen.quality.ok ? Data.parseReceiptText(gelesen.text) : null;
        app.render();
        if (!gelesen.quality.ok) app.notice("Nicht genug erkannt", gelesen.quality.message);
        nachschlagen(cap, app);
      })
      .catch((e) => {
        laeuft = false;
        cap.ocr = null;
        app.render();
        app.notice("Texterkennung fehlgeschlagen",
          (e && e.message ? e.message + ".\n\n" : "") +
          "Der Bontext lässt sich weiter unten von Hand einfügen — daran ändert das nichts.");
      });
  };

  input.addEventListener("change", () => lies(input.files && input.files[0]));
  kamera.addEventListener("change", () => lies(kamera.files && kamera.files[0]));

  // Bild: sofort durch dieselbe Erkennung schicken wie beim Einfügen
  // oder Ablegen eines Bildes. Text und Format-Hinweis stehen bereits
  // oben — hier nur noch der Teil, der Texterkennung voraussetzt.
  if (bildhaft) lies(geteilt.datei);

  const knoepfe = el("div", "shotRow");
  const foto = el("button", "cta shotFoto", "Fotografieren");
  foto.addEventListener("click", () => kamera.click());
  const waehlen = el("button", "cta light shotWaehlen", "Bild wählen");
  waehlen.addEventListener("click", () => input.click());
  knoepfe.append(foto, waehlen);

  wrap.append(knoepfe, input, kamera, status, bar);
  bar.hidden = true;

  // Auf dem Rechner ist Einfügen der schnellste Weg: Screenshot
  // machen, hierher, Strg+V. Der Hörer bekommt das Fenster, nicht
  // die Schaltfläche — sonst müsste man erst hineinklicken.
  const einfuegen = (ev) => {
    const items = (ev.clipboardData && ev.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        ev.preventDefault();
        lies(it.getAsFile());
        return;
      }
    }
  };
  document.addEventListener("paste", einfuegen);
  // Beim nächsten Aufbau der Ansicht wieder abmelden, sonst hängen
  // nach zehn Wechseln zehn Hörer am Fenster.
  app.onLeaveView(() => document.removeEventListener("paste", einfuegen));

  wrap.addEventListener("dragover", (ev) => { ev.preventDefault(); wrap.classList.add("over"); });
  wrap.addEventListener("dragleave", () => wrap.classList.remove("over"));
  wrap.addEventListener("drop", (ev) => {
    ev.preventDefault();
    wrap.classList.remove("over");
    const datei = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    lies(datei);
  });

  wrap.append(el("p", "srcnote",
    "Foto eines Papierbons oder Screenshot aus der Händler-App. Bild und Text bleiben auf dem " +
    "Gerät — erkannt wird hier, nicht auf einem Server. Nur ein unbekannter Produktname geht als " +
    "reiner Name, ohne Preis, Datum oder Markt, an Open Food Facts."));

  if (cap.ocr) {
    const q = cap.ocr.quality;
    wrap.append(uiRow(q.level === "gut" ? "Erkannt" : "Durchsehen", q.message, null, {}));
  }

  box.append(wrap);
}

/**
 * Eine unsichere Bon-Zeile nach der anderen bestätigen — nie alle auf
 * einmal. Drei Vorschläge zum Antippen (dieselbe Bewertung wie der
 * automatische Abgleich, nur die besten drei statt nur der einen),
 * dazu die Möglichkeit, selbst etwas einzutragen, und eine Zeile
 * bewusst nicht zu buchen. Kein Dropdown mit dem ganzen Katalog —
 * genau DAS war die Beschwerde, die zu dieser Karte geführt hat.
 */
function renderConfirmStep(box, p, app) {
  const idx = p.rows.findIndex((r) => r.needsConfirmation);
  if (idx === -1) return;
  const rowData = p.rows[idx];

  const entscheiden = (productId) => {
    p.rows[idx].productId = productId;
    p.rows[idx].productName = productId ? byId(productId).name : null;
    p.rows[idx].needsConfirmation = false;
    p.rows[idx].learn = !!productId;
    p.sure = p.rows.filter((x) => !x.needsConfirmation).length;
    p.open = p.rows.filter((x) => x.needsConfirmation).length;
    app.render();
  };

  const card = el("div", "confirmCard");
  card.append(el("div", "confirmProgress",
    `${zahlwort(p.open, "Position", "Positionen")} noch zu bestätigen`));
  card.append(el("div", "confirmRaw", esc(rowData.raw)));
  // Auch hier schon sichtbar, nicht erst nach dem Bestätigen: ein
  // Vorschlag über den Umweg Open Food Facts bleibt ein Vorschlag
  // über zwei Ecken, das gehört zur Entscheidung dazu.
  if (String(rowData.method || "").startsWith("extern:")) {
    card.append(el("div", "srcnote", "über Internet-Abgleich vorgeschlagen, bitte prüfen"));
  }

  const choices = el("div", "confirmChoices");
  topMatches(rowData.raw, undefined, 3).forEach((v) => {
    const prod = byId(v.productId);
    if (!prod) return;
    const b = el("button", "confirmChoice", esc(prod.name));
    b.addEventListener("click", () => entscheiden(v.productId));
    choices.append(b);
  });
  card.append(choices);

  const searchWrap = el("div", "confirmSearchWrap hide");
  const inp = el("input");
  inp.type = "search";
  inp.placeholder = "Anderes Produkt suchen";
  inp.setAttribute("aria-label", "Anderes Produkt suchen");
  const results = el("ul", "results");
  inp.addEventListener("input", () => {
    results.innerHTML = "";
    const q = inp.value.trim();
    if (!q) return;
    Data.searchProducts(q, 6).forEach((x) => {
      const li = el("li");
      const b = el("button", null, `<span class="rn">${esc(x.name)}</span>`);
      b.addEventListener("click", () => entscheiden(x.id));
      li.append(b);
      results.append(li);
    });
  });
  searchWrap.append(inp, results);
  card.append(searchWrap);

  const foot = el("div", "confirmFoot");
  const altBtn = el("button", "confirmAlt", "Anders? Selbst eintragen");
  altBtn.addEventListener("click", () => {
    searchWrap.classList.toggle("hide");
    if (!searchWrap.classList.contains("hide")) inp.focus();
  });
  const skip = el("button", "confirmSkip", "nicht buchen");
  skip.addEventListener("click", () => entscheiden(null));
  foot.append(altBtn, skip);
  card.append(foot);

  box.append(card);
}

function renderScan(box, cap, app) {
  ocrPicker(box, cap, app);

  const ta = el("textarea");
  ta.value = cap.text || "";
  ta.placeholder = "… oder Bon-Text einfügen";
  ta.setAttribute("aria-label", "Bon-Text");
  ta.addEventListener("input", () => { cap.text = ta.value; });
  const f = el("label", "field");
  f.append(ta);
  box.append(f);

  const meta = el("div", "row2");
  const df = el("label", "field", '<span class="lbl">Datum</span>');
  const di = el("input"); di.type = "date"; di.value = cap.date || Data.today();
  di.addEventListener("change", () => { cap.date = di.value; });
  df.append(di);
  const sf = el("label", "field", '<span class="lbl">Markt</span>');
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = MARKT_BEISPIEL;
  si.addEventListener("input", () => { cap.store = si.value; });
  sf.append(si);
  meta.append(df, sf);
  box.append(meta);

  const go = el("button", "cta", "Auswerten");
  go.addEventListener("click", () => {
    const text = (cap.text || "").trim();
    if (!text) { app.toast("Kein Text"); return; }
    try {
      cap.parsed = Data.parseReceiptText(text);
      cap.date = di.value;
      cap.store = si.value.trim() || "Unbekannt";
      if (!cap.parsed.rows.length) app.toast("Nichts erkannt");
    } catch (e) { app.toast("Nicht lesbar"); console.error(e); }
    app.render();
    nachschlagen(cap, app);
  });
  box.append(go);

  if (!cap.parsed) return;
  const p = cap.parsed;

  box.append(uiRow(`${p.rows.length} erkannt, ${p.sure} sicher`,
    p.open ? "unsichere werden gefragt, nicht geraten" : null,
    el("span", "flag " + (p.open ? "f-gold" : "f-ok"), p.open ? p.open + " offen" : "fertig")));

  /* Die Gegenprobe gegen die aufgedruckte Summe.
     Sie steht bewusst GANZ OBEN und nicht in der Warnliste weiter
     unten: sie ist die einzige Aussage hier, die der Bon selbst
     belegen kann. Alles andere ist Vermutung der Erkennung, das
     hier ist Arithmetik.

     Und sie korrigiert nichts. „Es fehlen 1,19 €" ist ein Hinweis,
     wo nachzusehen ist — welche Zeile fehlt, sieht nur der Mensch,
     der den Bon in der Hand hält. */
  if (p.printedTotal !== null && p.printedTotal !== undefined) {
    const stimmt = p.totalOk;
    const fehlt = p.totalDiff > 0;
    box.append(uiRow(
      stimmt ? `Summe stimmt: ${eur(p.printedTotal)}` : `Summe weicht ab: ${eur(Math.abs(p.totalDiff))}`,
      stimmt
        ? "Preise, Mengen, Rabatte und Pfand gehen zusammen auf"
        : (fehlt
          ? `Der Bon nennt ${eur(p.printedTotal)}, erkannt wurden ${eur(p.sum)} — es fehlt vermutlich eine Zeile`
          : `Der Bon nennt ${eur(p.printedTotal)}, erkannt wurden ${eur(p.sum)} — eine Zeile ist vermutlich doppelt`),
      el("span", "flag " + (stimmt ? "f-ok" : "f-gold"), stimmt ? "geprüft" : "prüfen")));
  }

  if (p.warnings.length) {
    box.append(uiRow(`${p.warnings.length} Rechenprobe(n) auffällig`, null, null,
      { onClick: () => app.notice("Rechenprobe", p.warnings.join("\n\n")) }));
  }

  renderConfirmStep(box, p, app);

  const rows = el("div");
  p.rows.forEach((rowData) => {
    // Unsichere Zeilen laufen jetzt über die Karte oben, eine nach der
    // anderen — hier stehen sie erst, sobald sie entschieden sind.
    if (rowData.needsConfirmation) return;
    const r = el("div", "matchRow");
    const left = el("div", "raw");
    left.append(el("div", "n", rowData.productName ? esc(rowData.productName) : "nicht zugeordnet"));
    left.append(el("div", "r", esc(rowData.raw)));
    // Ein Vorschlag über zwei Ecken (fremder Dienst, dann der eigene
    // Katalog) sieht sonst aus wie ein normaler Treffer — das wäre
    // nicht falsch, aber es verschweigt, woher er kommt.
    if (String(rowData.method || "").startsWith("extern:")) {
      left.append(el("div", "srcnote", "über Internet-Abgleich vorgeschlagen, bitte prüfen"));
    }

    r.append(left, el("div", "amt",
      `${eur(rowData.unitPrice * rowData.quantity)}<small>${rowData.quantity}×</small>`));
    rows.append(r);
  });
  box.append(rows);

  /* „N übernehmen“ hieß dieser Knopf, und er tut dasselbe wie der in
     der Liste und der in den Gängen: einen Einkauf buchen. Die Zahl
     bleibt, weil sie hier etwas sagt, was nirgends sonst steht —
     wie viele der erkannten Zeilen tatsächlich gebucht werden. Das
     Verb ist jetzt überall dasselbe.

     Gesperrt, solange p.open > 0: erst wenn jede unsichere Zeile oben
     in der Karte eine Entscheidung bekommen hat — ausgewählt, selbst
     eingetragen oder bewusst „nicht buchen" —, ist überhaupt etwas zu
     buchen, das nicht nur eine unbestätigte Vermutung ist. */
  const buchbar = p.rows.filter((r) => r.productId && !r.needsConfirmation).length;
  const save = el("button", "cta", `${zahlwort(buchbar, "Position", "Positionen")} buchen`);
  save.disabled = p.open > 0 || buchbar === 0;
  save.addEventListener("click", () => {
    p.rows.forEach((r) => { if (r.learn && r.productId) Data.learnAlias(r.raw, r.productId); });
    const res = Data.addReceipt({ date: cap.date, store: cap.store, items: p.rows });
    cap.parsed = null; cap.text = "";
    app.toast(`${zahlwort(res.count, "Position", "Positionen")} gebucht`, { detail: bookedDetail(res) });
    app.goto("liste");
  });
  box.append(save);
}

function renderManual(box, cap, app) {
  const f = el("label", "field");
  const inp = el("input");
  inp.type = "search";
  inp.placeholder = "Produkt suchen";
  inp.setAttribute("aria-label", "Produkt suchen");
  inp.value = cap.query || "";
  inp.addEventListener("input", () => { cap.query = inp.value; renderResults(); });
  f.append(inp);
  box.append(f);

  const results = el("ul", "results");
  box.append(results);

  function renderResults() {
    results.innerHTML = "";
    if (!cap.query) { results.classList.add("hide"); return; }
    results.classList.remove("hide");
    const hits = Data.searchProducts(cap.query, 10);
    if (!hits.length) { results.append(el("li", null, '<div class="noHit">Nichts gefunden.</div>')); return; }
    hits.forEach((p) => {
      const li = el("li");
      const b = el("button", null, `<span class="rn">${esc(p.name)}</span><span class="rc">${eur(p.typicalPrice)}</span>`);
      b.addEventListener("click", () => {
        const ex = cap.basket.find((x) => x.productId === p.id);
        if (ex) ex.quantity += 1;
        else cap.basket.push({ productId: p.id, name: p.name, quantity: 1, unitPrice: p.typicalPrice });
        cap.query = "";
        app.render();
      });
      li.append(b);
      results.append(li);
    });
  }
  renderResults();

  if (!cap.basket.length) return;

  const ul = el("ul", "basket");
  cap.basket.forEach((b, i) => {
    const li = el("li");
    li.append(el("span", "bn", esc(b.name)));
    li.append(stepper(b.quantity, String, (v) => { cap.basket[i].quantity = v; app.render(); }, { min: 1, max: 99, step: 1 }));
    const pi = el("input", "priceIn");
    pi.type = "number"; pi.step = "0.01"; pi.min = "0"; pi.value = b.unitPrice.toFixed(2);
    pi.setAttribute("aria-label", `Preis für ${b.name}`);
    pi.addEventListener("change", () => { cap.basket[i].unitPrice = parseFloat(pi.value) || 0; app.render(); });
    li.append(pi);
    const del = el("button", "del", "×");
    del.setAttribute("aria-label", `${b.name} entfernen`);
    del.addEventListener("click", () => { cap.basket.splice(i, 1); app.render(); });
    li.append(del);
    ul.append(li);
  });
  box.append(ul);

  const total = cap.basket.reduce((a, b) => a + b.unitPrice * b.quantity, 0);
  const tot = el("div", "totals bare");
  tot.innerHTML = `<div><div class="l">${zahlwort(cap.basket.length, "Position", "Positionen")}</div><div class="big">${eur(total)}</div></div>`;
  box.append(tot);

  const meta = el("div", "row2");
  const df = el("label", "field", '<span class="lbl">Datum</span>');
  const di = el("input"); di.type = "date"; di.value = cap.date || Data.today();
  di.addEventListener("change", () => { cap.date = di.value; });
  df.append(di);
  const sf = el("label", "field", '<span class="lbl">Markt</span>');
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = MARKT_BEISPIEL;
  si.addEventListener("input", () => { cap.store = si.value; });
  sf.append(si);
  meta.append(df, sf);
  box.append(meta);

  const save = el("button", "cta", "Einkauf buchen");
  save.addEventListener("click", () => {
    const res = Data.addReceipt({ date: di.value, store: si.value.trim() || "Unbekannt", items: cap.basket });
    cap.basket = [];
    app.toast(`${zahlwort(res.count, "Position", "Positionen")} gebucht`, { detail: bookedDetail(res) });
    app.goto("liste");
  });
  box.append(save);
}

/* ================================================================
   5. Zahlen
   ================================================================ */
function viewZahlen(ctx, app) {
  const c = frag();
  const t = ctx.totals;

  if (!ctx.history.length) {
    c.append(emptyView("Noch keine Zahlen.", "Einkauf erfassen", () => app.goto("erfassen")));
    return c;
  }

  const savingsTotal = ctx.savings.reduce((a, x) => a + x.estimatedWeeklySaving, 0);
  const s = el("div", "scroller");
  s.append(tile("Am Stück", `${ctx.streak.weeks}`,
    ctx.streak.weeks === 1 ? "Woche" : "Wochen", ctx.streak.weeks > 0 ? "good" : null));
  // "gesamt" im Namen, nicht nur im Kopf: direkt darunter zeigt "Wo
  // dein Geld hingeht" einen ZWEITEN Wochendurchschnitt für den dort
  // gewählten Zeitraum -- ohne die Unterscheidung im Wortlaut selbst
  // sehen zwei fast gleiche Zahlen wie ein Rechenfehler aus, sind aber
  // nur zwei verschiedene Zeiträume (Lebenszeit hier, frei wählbar dort).
  s.append(tile("Ø/Woche gesamt", eur(t.spendPerWeek), zahlwort(t.receipts, "Bon", "Bons")));
  s.append(tile("zu holen", eur(savingsTotal), "ohne Verzicht", "good"));
  s.append(tile("Verlust", eur(t.wastedPerWeek), `${de(ctx.impact.kg)} kg gesamt`, "warn"));
  s.append(tile("Rhythmen", String([...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length),
    `von ${ctx.rhythms.size}`));
  c.append(s);

  // Drei Unterbereiche statt eines endlosen Scrolls: hier standen über
  // 20 Abschnitte hintereinander, nur durch Überschriften getrennt. Die
  // Aufteilung folgt der Frage, mit der man herkommt -- "wofür gebe ich
  // aus", "wie kaufe ich ein", "was bringt mir das" -- statt der
  // Reihenfolge, in der die Abschnitte entstanden sind. Das Segment
  // steht direkt unter der Kachelzeile: wer zu "Verhalten" oder
  // "Bilanz" will, braucht so einen Tipp statt eines langen Scrolls.
  // "Wo dein Geld hingeht" ist selbst eine Ausgaben-Frage und steht
  // deshalb nur noch im Ausgaben-Tab, nicht mehr vor allen dreien.
  const nav = el("div", "group");
  nav.append(segmented(
    [["ausgaben", "Ausgaben"], ["verhalten", "Verhalten"], ["bilanz", "Bilanz"]],
    app.zahlenTab, (k) => { app.zahlenTab = k; app.render(); }, "Bereich"));
  c.append(nav);

  if (app.zahlenTab === "bilanz") renderZahlenBilanz(c, ctx, app);
  else if (app.zahlenTab === "verhalten") renderZahlenVerhalten(c, ctx, app);
  else { c.append(moneyFlowCard(ctx, app)); renderZahlenAusgaben(c, ctx, app); }

  return c;
}

/** Unterbereich "Bilanz": was das bisherige Verhalten gebracht hat. */
function renderZahlenBilanz(c, ctx, app) {
  /* --- Wochenrückblick: immer abrufbar, nicht nur sonntags --- */
  const rv = uiGroup("Rückblick",
    "Fasst zusammen, was im Zeitraum tatsächlich passiert ist — aus dem Ereignis-Protokoll, nicht aus einer " +
    "Hochrechnung. Der Rückblick meldet sich von selbst ab Sonntagabend.");
  rv.body.append(uiRow(ctx.review.label, ctx.review.quiet ? "nichts erfasst" : ctx.review.short, null, {
    onClick: () => reviewSheet(ctx, app)
  }));
  const prev = ctx.review.label === "Vorige Woche" ? null : "Vorige Woche";
  if (prev) {
    rv.body.append(uiRow(prev, null, null, {
      onClick: () => {
        const range = weekRangeFor(ctx.ref, -1);
        const past = weeklyReview({ actions: ctx.actions, receipts: Data.get().receipts }, range);
        past.due = false;
        reviewSheet({ ...ctx, review: past }, app);
      }
    }));
  }
  rv.body.append(streakStrip(ctx));
  c.append(rv);

  /* --- Meilensteine --- */
  const ms = uiGroup(`Erreicht · ${ctx.badges.count} von ${ctx.badges.total}`,
    "Stufen zählen bestätigte Handlungen, keine App-Nutzung. Geld und Stückzahl bleiben getrennte Reihen: " +
    "die Geldreihe zählt ausschließlich realisierte Preisersparnis, nie geschätzte Beträge.\n\n" +
    "Erreichtes verfällt nicht. Eine ruhige Phase kostet keine Stufe.");
  ms.body.append(badgeScroller(ctx, app));
  if (ctx.badges.nextUp) {
    ms.body.append(uiRow("Als Nächstes", ctx.badges.nextUp.nextTitle, null, {
      value: `${Math.round(ctx.badges.nextUp.progress * 100)} %`
    }));
  }
  c.append(ms);

  /* --- Sparen --- */
  const sc = uiGroup("Sparen", "Aus deinen eigenen Zahlen abgeleitet, nicht aus allgemeinen Tipps.");
  if (!ctx.savings.length) sc.body.append(el("p", "empty", "Noch keine Vorschläge."));
  ctx.savings.forEach((x) => {
    const d = el("div", "save",
      `<div class="amt">${eur(x.estimatedWeeklySaving)}</div><div class="txt"><b>${esc(x.title)}</b></div>`);
    const b = el("button", "pillBtn" + (x.on ? " on" : ""), x.on ? "✓" : "nehmen");
    b.setAttribute("aria-pressed", x.on ? "true" : "false");
    b.setAttribute("aria-label", x.title);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      app.set((st) => {
        st.savingsAccepted = x.on ? st.savingsAccepted.filter((y) => y !== x.id) : [...st.savingsAccepted, x.id];
      });
    });
    d.addEventListener("click", () => app.notice(x.title, x.detail));
    d.append(b);
    sc.body.append(d);
  });
  const wk = ctx.savings.filter((x) => x.on).reduce((a, x) => a + x.estimatedWeeklySaving, 0);
  sc.body.append(el("div", "strip",
    `<div><div class="big">${eur(wk)}</div><div class="l">pro Woche</div></div>` +
    `<div style="text-align:right"><div class="big">${Math.round(wk * 52)} €</div><div class="l">im Jahr</div></div>`));
  c.append(sc);

  /* --- Wirkung --- */
  const cmp = compareToReference(ctx.impact.kg, Data.get().settings.household);
  const ig = uiGroup("Wirkung", cmp.framing + "\n\n" + cmp.note +
    "\n\nJede dieser Zahlen ist abgeleitet, keine ist gewogen. Ein Tippen auf ein Produkt zeigt die " +
    "einzelnen Verdachtsfälle — und lässt dich widersprechen, wo du es besser weißt.");
  ig.body.append(uiRow("Geschätzter Verlust", null, null, { value: de(ctx.impact.kg) + " kg" }));
  ctx.impact.byProduct.slice(0, 5).forEach((x) => {
    // Antippbar: von der Gesamtzahl zu den Fällen, aus denen sie besteht.
    const pid = (FOOD_DATABASE.find((f) => f.name === x.name) || {}).id;
    ig.body.append(uiRow(x.name, null, null, {
      value: de(x.kg) + " kg",
      onClick: pid ? () => productSheet(pid, ctx) : undefined
    }));
  });
  c.append(ig);
}

/** Unterbereich "Verhalten": wie und wann eingekauft wird. */
function renderZahlenVerhalten(c, ctx, app) {
  /* --- Einkaufsmuster --- */
  if (ctx.pattern) {
    const g = uiGroup("Dein Einkaufsrhythmus",
      "Ausgezählt über die Bontage. Ohne erkennbaren Lieblingstag nennt die App nur die Häufigkeit.");
    g.body.append(uiRow(ctx.pattern.dayName || "kein fester Tag",
      ctx.pattern.dayName ? `${pct(ctx.pattern.share)} deiner Einkäufe` : null,
      null, { value: `${de(ctx.pattern.perWeek)}×/Woche` }));
    g.body.append(uiRow("Ø Korb", null, null, { value: eur(ctx.pattern.avgBasket) }));
    const suggested = suggestedLookahead(ctx.pattern);
    const cur = Data.get().settings.lookaheadDays;
    if (suggested && suggested !== cur) {
      g.body.append(uiRow(`Vorausschau auf ${tage(suggested)}`, `aktuell ${cur}`, null, {
        onClick: () => { app.set((st) => { st.settings.lookaheadDays = suggested; }); app.toast("Übernommen"); }
      }));
    }
    c.append(g);
  }

  /* --- Rhythmen --- */
  const rg = uiGroup("Rhythmen",
    "Median der Kaufabstände je Einheit. Pausen über dem Dreifachen werden ausgeschlossen statt weggemittelt.");
  [...ctx.rhythms.entries()].sort((a, b) => b[1].confidence - a[1].confidence).slice(0, 12).forEach(([pid, r]) => {
    const p = byId(pid);
    if (!p) return;
    rg.body.append(uiRow(p.name, `Vertrauen ${pct(r.confidence)}`, null, {
      value: r.rhythmDays ? `${r.rhythmDays} T` : "–",
      onClick: () => productSheet(pid, ctx)
    }));
  });
  c.append(rg);

  /* --- Inflation --- */
  if (ctx.inflation && ctx.inflation.productsCompared) {
    const inf = ctx.inflation;
    const g = uiGroup("Persönliche Inflation", inf.caveat);
    g.body.append(uiRow("Dein Warenkorb", `${zahlwort(inf.productsCompared, "Produkt", "Produkte")} verglichen`,
      null, { value: sign(inf.changePercent) + " %" }));
    inf.biggestIncreases.slice(0, 5).forEach((i) => g.body.append(
      uiRow(i.name, `${eur(i.basePrice)} → ${eur(i.currentPrice)}`, null, { value: sign(i.changePercent) + " %" })));
    c.append(g);
  }

  /* --- Preis-Gedächtnis --- */
  const notable = [...ctx.prices.values()]
    .filter((m) => m.verdict !== "üblich")
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  if (notable.length) {
    const g = uiGroup("Preise", "Median der eigenen Kaufpreise. Kein Vergleich zwischen Händlern — dafür fehlen die Daten.");
    notable.slice(0, 8).forEach((m) => g.body.append(uiRow(m.name, `üblich ${eur(m.usual)}`, null,
      { value: eur(m.last), onClick: () => productSheet(m.productId, ctx) })));
    c.append(g);
  }
}

/** Unterbereich "Ausgaben": wofür das Geld weggeht, jenseits der Geld-Karte oben. */
function renderZahlenAusgaben(c, ctx, app) {
  /* --- Marke oder Eigenmarke --- */
  if (ctx.brandHeadline) {
    const h = ctx.brandHeadline;
    const b = ctx.brands;
    const g = uiGroup("Marke oder Eigenmarke",
      "Zeigt, was ein Wechsel zur Eigenmarke im Jahr bedeuten würde. Mehr nicht: nichts davon landet auf " +
      "der Liste, nichts wird als Ersparnis gebucht.\n\n" +
      "Belegt heißt: du hast beides schon gekauft, verglichen werden deine eigenen Preise. Geschätzt heißt: " +
      "es gibt nur Markenkäufe, gerechnet wird mit einem Erfahrungswert. Die beiden Summen werden nie addiert.\n\n" +
      "Wer eine Eigenmarke probiert und wieder zur Marke zurückgeht, bekommt den Vorschlag nicht mehr. " +
      "Das ist eine Antwort, keine Lücke.");
    g.body.append(uiRow(h.text, h.hint, null, {}));
    // Zwei Zwischenüberschriften mit je eigener Summe. Die Trennung
    // steht damit nicht nur im Erklärtext, sondern im Aufbau der
    // Ansicht — man KANN die beiden Zahlen gar nicht als eine lesen.
    if (b.belegt.length) {
      g.body.append(uiRow("Belegt", "aus deinen eigenen Bons", null, { value: eur(b.proJahrBelegt) }));
      b.belegt.slice(0, 5).forEach((x) => g.body.append(brandRow(x, app)));
    }
    if (b.geschaetzt.length) {
      g.body.append(uiRow("Geschätzt", `${b.geschaetzt.length} ohne eigenen Vergleich`, null, {
        value: eur(b.proJahrGeschaetzt)
      }));
      b.geschaetzt.slice(0, 5).forEach((x) => g.body.append(brandRow(x, app)));
    }
    if (b.abgelehnt) {
      g.body.append(el("p", "srcnote",
        `${b.abgelehnt} ${b.abgelehnt === 1 ? "Produkt" : "Produkte"} ausgelassen: dort hast du die ` +
        "Eigenmarke probiert und bist zur Marke zurück."));
    }
    c.append(g);
  }

  c.append(chartCard(ctx));

  /* --- Ersparnis bei Haushaltsprodukten: getrennt ausweisen --- */
  if (ctx.nonFoodSaved.total > 0) {
    const g = uiGroup("Günstig eingekauft",
      "Realisierte Ersparnis: du hast weniger gezahlt als deinen üblichen Grundpreis. Getrennt von der " +
      "Lebensmittel-Ersparnis, denn die ist kontrafaktisch — dort geht es um Verderb, der nicht eingetreten ist. " +
      "Beides zu addieren wäre irreführend.");
    g.body.append(uiRow("Haushaltsprodukte", ctx.nonFoodSaved.basis, null,
      { value: eur(ctx.nonFoodSaved.total) }));
    ctx.nonFoodSaved.byProduct.slice(0, 5).forEach((x) =>
      g.body.append(uiRow(x.name, `${zahlwort(x.purchases, "Kauf", "Käufe")}`, null, { value: eur(x.saved) })));
    c.append(g);
  }

  /* --- Packungsgrößen --- */
  if (ctx.packs.length) {
    const g = uiGroup("Packungsgrößen", "Der Grundpreis allein täuscht, wenn die große Packung halb weggeworfen wird.");
    ctx.packs.forEach((x) => g.body.append(uiRow(x.recommendation.split(":")[0] || x.recommendation, null,
      el("span", "flag " + (x.riskyRecommendation ? "f-gold" : "f-ok"), de(x.savingPercent) + " %"),
      { onClick: () => app.notice("Packungsgröße", x.recommendation) })));
    c.append(g);
  }
}

/**
 * Vom Filter gewählter Zeitraum als {from, to} (ISO-Daten, from kann
 * null sein für "Gesamt"). Eigener Fensterausdruck statt fester
 * Wochenzahl in `compute()` — das hier ist eine reine Anzeigefrage,
 * berührt keine Rhythmen oder Rückblicke.
 */
function zahlenSpanne(filter, ref) {
  if (filter.range === "custom") return { from: filter.from || Data.plusDays(ref, -84), to: filter.to || ref };
  if (filter.range === "all") return { from: null, to: ref };
  const wochen = { "4w": 4, "12w": 12, "year": 52 }[filter.range] || 12;
  return { from: Data.plusDays(ref, -wochen * 7), to: ref };
}

/**
 * Balken mit rundem Kappenende, dieselbe Form wie beim Vorrats-Balken
 * (`rangeHero`): Track in `--fill-2`, Füllung in Akzentfarbe, gezeichnet
 * als `<line>` mit `stroke-linecap="round"` und `non-scaling-stroke`,
 * damit die Rundung rund bleibt, wenn die Fläche in die Breite gezogen
 * wird — ein Rechteck mit `border-radius` würde bei Streckung oval.
 *
 * `frac` bemisst sich am GRÖSSTEN Wert der Liste, nicht am Gesamtbetrag:
 * die längste Zeile füllt den Balken voll aus, das liest sich als
 * Rangfolge. Der Anteil an der Gesamtsumme steht daneben als Zahl,
 * unabhängig von der Balkenlänge.
 */
function moneyBarSvg(frac, muted) {
  const W = 300, PAD = 4.5, SW = 9;
  const bar = (to, stroke) =>
    `<line x1="${PAD}" y1="${SW / 2}" x2="${to.toFixed(1)}" y2="${SW / 2}" stroke="${stroke}" ` +
    `stroke-width="${SW}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const x1 = PAD + Math.max(0, Math.min(1, frac)) * (W - PAD * 2);
  return `<svg class="moneyBarSvg" viewBox="0 0 ${W} ${SW}" preserveAspectRatio="none" aria-hidden="true">` +
    bar(W - PAD, "var(--fill-2)") + (frac > 0 ? bar(x1, muted ? "var(--ink-3)" : "var(--accent)") : "") + `</svg>`;
}

/**
 * Kleine Verlaufslinie: mehrere Monatswerte, letzter Punkt betont.
 * Entspricht dem "trend"-Baustein einer Kennzahl-Kachel — eine
 * de-emphasis-farbene Linie, der aktuelle Wert als Punkt in
 * Akzentfarbe. Zu wenig Datenpunkte (< 3, sonst ist "Verlauf" nur
 * geraten) liefern kein Ergebnis, statt eine bedeutungslose Linie
 * durch zwei Punkte zu ziehen.
 */
function moneySparklineSvg(values) {
  if (values.length < 3 || values.every((v) => v === 0)) return "";
  const W = 56, H = 20, PAD = 2.5;
  const max = Math.max(...values, 0.01);
  const step = (W - PAD * 2) / (values.length - 1);
  const punkte = values.map((v, i) => [
    PAD + i * step,
    H - PAD - (v / max) * (H - PAD * 2)
  ]);
  const pfad = punkte.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = punkte[punkte.length - 1];
  return `<svg class="moneySparkline" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
    `<path d="${pfad}" fill="none" stroke="var(--ink-3)" stroke-width="1.6" ` +
    `stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.4" fill="var(--accent)"/></svg>`;
}

/** Eine Rangzeile: Name, Verlauf und Betrag/Anteil oben, Balken darunter.
 *  `muted` markiert "Sonstige" — eine Sammelzeile ist keine echte
 *  Kategorie und soll sich nicht wie eine anfühlen (Emphasis-Prinzip:
 *  die echten Zeilen tragen die Akzentfarbe, der Rest tritt zurück).
 *  `wasteFrac` (0..1, optional) blendet einen roten Verlust-Hinweis
 *  unter dem Balken ein. `verlauf` (Array Monatsbeträge, optional)
 *  wird zur kleinen Trendlinie neben dem Betrag. `onClick` (optional)
 *  macht die Zeile zum Knopf — bei Produkten öffnet das dasselbe
 *  Detail-Blatt wie bei „Preise“ und „Rhythmen“ weiter unten, statt
 *  eine zweite, verkürzte Ansicht für dieselben Fakten zu bauen. */
/**
 * Eine Rangliste in "Wo dein Geld hingeht", auf die ersten
 * `visible` Zeilen begrenzt -- der Rest kommt erst nach einem
 * Antippen dazu, statt die Karte, die laut eigenem Anspruch immer
 * sichtbar bleiben soll, selbst zum endlosen Scroll zu machen (genau
 * das Problem, das die drei Unterbereiche von "Zahlen" an anderer
 * Stelle schon einmal gelöst haben). `items` ist bereits auf
 * höchstens 7 plus "Sonstige" begrenzt (topNMitSonstige) -- hier wird
 * nur noch die Voreinstellung kürzer gemacht, nichts an Daten fehlt.
 */
function moneyBarSection(h, title, items, renderRow, visible = 4) {
  h.append(el("div", "moneySection", title));
  const rest = items.slice(visible);
  items.slice(0, visible).forEach((item) => h.append(renderRow(item)));
  if (!rest.length) return;
  const btn = el("button", "moneyMore", `Alle ${items.length} ansehen`);
  btn.addEventListener("click", () => {
    rest.forEach((item) => btn.before(renderRow(item)));
    btn.remove();
  });
  h.append(btn);
}

function moneyBarRow(label, amount, share, frac, muted, wasteFrac, verlauf, onClick) {
  const r = el(onClick ? "button" : "div", "moneyBarRow" + (muted ? " muted" : ""));
  const spark = verlauf ? moneySparklineSvg(verlauf) : "";
  r.innerHTML =
    `<div class="moneyBarHead"><span class="moneyBarLabel">${esc(label)}</span>` +
    (spark ? `<span class="moneySparklineWrap" title="Verlauf der letzten Monate">${spark}</span>` : "") +
    `<span class="moneyBarValue">${eur(amount)}<small>${pct(share)}</small></span></div>` +
    moneyBarSvg(frac, muted) +
    (wasteFrac >= 0.05
      ? `<div class="moneyWaste">${Math.round(wasteFrac * 100)} % davon meist verschwendet, laut deinem Kauf-Verlauf</div>`
      : "");
  if (onClick) r.addEventListener("click", onClick);
  return r;
}

/**
 * Monatsbeträge für die letzten `n` echten Kalendermonate (nicht
 * 30-Tage-Schritte, die gegen Monatsenden verrutschen), gruppiert
 * über `gruppe(h)` — liefert einen Schlüssel oder `null`, um eine
 * Zeile auszuschließen. Immer über die VOLLE Historie, unabhängig vom
 * Zeitraum-Filter oben — aus demselben Grund wie bei `kategorieVerlust`:
 * ein Verlauf über vier gefilterte Wochen wäre kein Verlauf, sondern
 * ein einzelner Punkt.
 */
function monatsverlaufNach(ctx, n, gruppe) {
  const [jahr, monat] = Data.today().slice(0, 7).split("-").map(Number);
  const monate = [];
  for (let i = n - 1; i >= 0; i--) {
    let m = monat - i, j = jahr;
    while (m <= 0) { m += 12; j -= 1; }
    monate.push(`${j}-${String(m).padStart(2, "0")}`);
  }
  const monatsIndex = new Map(monate.map((m, i) => [m, i]));

  const byGruppe = new Map();
  ctx.history.forEach((h) => {
    const idx = monatsIndex.get(h.date.slice(0, 7));
    if (idx === undefined) return;
    const key = gruppe(h);
    if (key === null) return;
    if (!byGruppe.has(key)) byGruppe.set(key, new Array(n).fill(0));
    byGruppe.get(key)[idx] += h.unitPrice * h.quantity;
  });
  return byGruppe;
}

function kategorieMonatsverlauf(ctx, n) {
  return monatsverlaufNach(ctx, n, (h) => {
    const p = h.productId ? byId(h.productId) : null;
    return p ? p.category : "Ohne Kategorie";
  });
}

/**
 * Nur Produkte mit einem gelernten Rhythmus (`ctx.rhythms`) — das ist
 * die Definition dieser App für "wird immer wieder gekauft", dieselbe
 * wie im Abschnitt „Rhythmen" weiter unten. Ein einmaliger Kauf hat
 * keinen Verlauf, den man als "mehr oder weniger" lesen könnte.
 */
function produktMonatsverlauf(ctx, n) {
  return monatsverlaufNach(ctx, n, (h) => {
    if (!h.productId || !ctx.rhythms.has(h.productId)) return null;
    const p = byId(h.productId);
    return p ? p.name : null;
  });
}

/**
 * Top-`n` einer Betrags-Map, der Rest als EINE "Sonstige"-Zeile
 * zusammengefasst statt kommentarlos abgeschnitten. Ohne das ergäben
 * die gezeigten Prozente nie 100 % — bei einem Haushalt mit vielen
 * Kategorien eine stille, wachsende Lücke (siehe README).
 */
function topNMitSonstige(map, n) {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) top.push(["Sonstige", rest, true]);
  return top;
}

/**
 * Markt-Namen werden bei jeder Erfassung neu eingetippt, ohne Abgleich
 * gegen frühere Schreibweisen — "REWE", "Rewe City" und "rewe" wären
 * sonst drei Balken statt einer. Hier wird nur für die ANZEIGE nach
 * Groß-/Kleinschreibung und Leerraum zusammengefasst (nicht in den
 * gespeicherten Daten verändert); angezeigt wird die Schreibweise, die
 * am häufigsten vorkam.
 */
function marktGruppen(rows) {
  const buckets = new Map(); // normalisiert -> { total, formen: Map<original, count> }
  rows.forEach((x) => {
    const roh = (x.store || "Unbekannt").trim() || "Unbekannt";
    const key = roh.toLowerCase();
    if (!buckets.has(key)) buckets.set(key, { total: 0, formen: new Map() });
    const b = buckets.get(key);
    b.total += x.unitPrice * x.quantity;
    b.formen.set(roh, (b.formen.get(roh) || 0) + 1);
  });
  const byStore = new Map();
  buckets.forEach((b) => {
    const label = [...b.formen.entries()].sort((a, b2) => b2[1] - a[1])[0][0];
    byStore.set(label, b.total);
  });
  return byStore;
}

/**
 * Verlustanteil je Kategorie — aus `ctx.wasteStats`, das schon jedes
 * Produkt einzeln nach chronischer Verschwendung und Ausreißern
 * auswertet (siehe `wasteInference2.js`). Hier nur nach Kategorie
 * aufsummiert, nicht neu geschätzt.
 *
 * BEWUSST unabhängig vom oben gewählten Zeitraum-Filter: `wasteStats`
 * rechnet über den GESAMTEN Kauf-Verlauf je Produkt (chronische Muster
 * brauchen genug Käufe, um erkennbar zu sein — ein 4-Wochen-Fenster
 * hätte oft nur einen einzigen Kauf, keine Grundlage für „chronisch").
 * Eine erfundene 4-Wochen-Verlustquote wäre keine ehrlichere Zahl als
 * gar keine. Deshalb ausdrücklich im Infotext erklärt, nicht verschwiegen.
 */
function kategorieVerlust(ctx) {
  const spent = new Map(), wasted = new Map();
  ctx.wasteStats.forEach((st, pid) => {
    const p = byId(pid);
    if (!p || !st.spent) return;
    const cat = p.category;
    spent.set(cat, (spent.get(cat) || 0) + st.spent);
    wasted.set(cat, (wasted.get(cat) || 0) + st.wastedEuros);
  });
  const share = new Map();
  spent.forEach((s, cat) => { if (s > 0) share.set(cat, (wasted.get(cat) || 0) / s); });
  return share;
}

/** Wie `kategorieVerlust`, nur ohne Umweg über eine Summe: `wasteStats`
 *  ist bereits je Produkt, hier nur auf den Produktnamen umgeschlüsselt. */
function produktVerlust(ctx) {
  const share = new Map();
  ctx.wasteStats.forEach((st, pid) => {
    const p = byId(pid);
    if (p && st.spent > 0) share.set(p.name, st.wastedEuros / st.spent);
  });
  return share;
}

/**
 * Ausgaben je Produkt im gewählten Zeitraum — nur Produkte mit einem
 * gelernten Rhythmus (siehe `produktMonatsverlauf`): ein Produkt, das
 * genau einmal gekauft wurde, kann man nicht als "mehr oder weniger
 * als sonst" lesen, es gibt kein "sonst".
 */
function produktRang(ctx, rows) {
  const byProdukt = new Map();
  rows.forEach((x) => {
    if (!x.productId || !ctx.rhythms.has(x.productId)) return;
    const p = byId(x.productId);
    if (!p) return;
    byProdukt.set(p.name, (byProdukt.get(p.name) || 0) + x.unitPrice * x.quantity);
  });
  return byProdukt;
}

/**
 * Direkt vorangehender Zeitraum GLEICHER LÄNGE — die einzige faire
 * Vergleichsbasis für "mehr oder weniger als sonst". Für "Gesamt"
 * gibt es keine sinnvolle Vorperiode (nichts liegt vor dem Anfang der
 * eigenen Geschichte), dafür wird bewusst nichts erfunden.
 */
function zahlenVorperiode(filter, from, to) {
  if (filter.range === "all") return null;
  const tage = daysBetween(from, to) + 1;
  const prevTo = Data.plusDays(from, -1);
  return { from: Data.plusDays(prevTo, -(tage - 1)), to: prevTo };
}

/**
 * „Wo dein Geld hingeht“ — ein eigener, erhöhter Bereich (siehe
 * `.moneyHero` in app.css), nicht nur eine weitere Karte in der Liste.
 * Kategorien und Märkte für einen frei wählbaren Zeitraum, mit
 * vorgeschlagenen Zeiträumen als Chips und einem eigenen Zeitraum als
 * Ausweg. Rein additive Anzeige: nichts hier verändert Rhythmen,
 * Rückblick oder eine andere Auswertung — nur `ctx.history`, gefiltert
 * nach Datum.
 */
function moneyFlowCard(ctx, app) {
  const h = el("div", "moneyHero");
  const head = el("div", "moneyHeroHead");
  head.append(el("span", null, "Wo dein Geld hingeht"));
  // Erklärung antippbar statt dauerhaft im Weg -- dasselbe Muster wie
  // bei jeder anderen Karte (`uiGroup`s `infoBtn`), nicht neu erfunden,
  // nur hier von Hand nachgebaut, weil dieser Bereich kein `uiGroup` ist.
  const infoBtn = el("button", "infoBtn", "i");
  infoBtn.setAttribute("aria-label", "Erklärung: Wo dein Geld hingeht");
  infoBtn.addEventListener("click", () => app.notice("Wo dein Geld hingeht",
    "Aus deinen eigenen Bons, nach Kategorie und Markt aufgeteilt, für den gewählten Zeitraum. " +
    "Frei erfasste Zeilen ohne Produkt zählen unter „Ohne Kategorie“. " +
    "„Sonstige“ fasst alles jenseits der sieben größten Zeilen zusammen, damit die Prozente " +
    "immer auf 100 % kommen. Marktnamen werden nur für diese Ansicht nach Groß-/Kleinschreibung " +
    "zusammengefasst — deine erfassten Bons bleiben unverändert.\n\n" +
    "Der rote Verlust-Hinweis unter einer Kategorie rechnet über deinen GESAMTEN Kauf-Verlauf, " +
    "unabhängig vom Zeitraum oben: chronische Verschwendung braucht genug Käufe, um erkennbar zu " +
    "sein — ein kurzes Zeitfenster hätte oft nur einen einzigen Kauf, keine tragfähige Grundlage.\n\n" +
    "„Immer wieder gekauft“ zeigt nur Produkte mit einem gelernten Rhythmus (derselbe Rhythmus wie " +
    "weiter unten in der Ansicht) — ein einmaliger Kauf hat kein „mehr oder weniger als sonst“."));
  head.append(infoBtn);
  h.append(head);

  const filter = App.zahlenFilter;
  const ref = Data.today();

  const chipRow = el("div", "row stacked");
  chipRow.append(segmented(
    [["4w", "4 Wochen"], ["12w", "12 Wochen"], ["year", "Jahr"], ["all", "Gesamt"], ["custom", "eigener"]],
    filter.range,
    (v) => { filter.range = v; app.render(); },
    "Zeitraum für Geldaufteilung"
  ));
  h.append(chipRow);

  if (filter.range === "custom") {
    const row = el("div", "row2");
    const ff = el("label", "field", '<span class="lbl">Von</span>');
    const fi = el("input"); fi.type = "date"; fi.value = filter.from || Data.plusDays(ref, -84);
    fi.addEventListener("change", () => { filter.from = fi.value; app.render(); });
    ff.append(fi);
    const tf = el("label", "field", '<span class="lbl">Bis</span>');
    const ti = el("input"); ti.type = "date"; ti.value = filter.to || ref;
    ti.addEventListener("change", () => { filter.to = ti.value; app.render(); });
    tf.append(ti);
    row.append(ff, tf);
    h.append(row);
  }

  const { from, to } = zahlenSpanne(filter, ref);
  const rows = ctx.history.filter((x) => (!from || x.date >= from) && x.date <= to);

  if (!rows.length) {
    h.append(el("p", "moneyEmpty", "Keine Käufe in diesem Zeitraum."));
    return h;
  }

  const total = rows.reduce((a, x) => a + x.unitPrice * x.quantity, 0);
  const tage = Math.max(1, daysBetween(from || rows[0].date, to) + 1);
  const proWoche = total / (tage / 7);

  /* Vorperiode gleicher Länge: die einzige ehrliche Antwort auf "ist
     das viel?". Nur gezeigt, wenn davor überhaupt etwas liegt — sonst
     wäre "+100 %" gegen eine leere Vorperiode eine erfundene Zahl. */
  let deltaHtml = "";
  const vor = zahlenVorperiode(filter, from || rows[0].date, to);
  if (vor) {
    const vorRows = ctx.history.filter((x) => x.date >= vor.from && x.date <= vor.to);
    const vorTotal = vorRows.reduce((a, x) => a + x.unitPrice * x.quantity, 0);
    if (vorRows.length && vorTotal > 0) {
      const deltaFrac = (total - vorTotal) / vorTotal;
      const pfeil = deltaFrac > 0.005 ? "↑" : deltaFrac < -0.005 ? "↓" : "→";
      deltaHtml = ` <span class="moneyDelta">${pfeil} ${Math.round(Math.abs(deltaFrac) * 100)} % ggü. Vorperiode</span>`;
    }
  }

  h.append(el("div", "moneyTotal",
    `<span class="n">${eur(total)}</span>` +
    `<span class="sub">Ø ${eur(proWoche)}/Woche · ${zahlwort(rows.length, "Position", "Positionen")}${deltaHtml}</span>`));

  const byCat = new Map();
  rows.forEach((x) => {
    const p = x.productId ? byId(x.productId) : null;
    const cat = p ? p.category : "Ohne Kategorie";
    byCat.set(cat, (byCat.get(cat) || 0) + x.unitPrice * x.quantity);
  });
  const byStore = marktGruppen(rows);

  const kategorien = topNMitSonstige(byCat, 7), maerkte = topNMitSonstige(byStore, 7);
  const maxCat = kategorien.length ? Math.max(...kategorien.map((x) => x[1])) : 0;
  const maxStore = maerkte.length ? Math.max(...maerkte.map((x) => x[1])) : 0;

  const verlustAnteil = kategorieVerlust(ctx);
  const monatsverlauf = kategorieMonatsverlauf(ctx, 6);
  moneyBarSection(h, "Kategorien", kategorien, ([label, amount, sonstige]) =>
    moneyBarRow(label, amount, total > 0 ? amount / total : 0, maxCat > 0 ? amount / maxCat : 0,
      sonstige, sonstige ? 0 : (verlustAnteil.get(label) || 0), sonstige ? null : monatsverlauf.get(label)));

  moneyBarSection(h, "Märkte", maerkte, ([label, amount, sonstige]) =>
    moneyBarRow(label, amount, total > 0 ? amount / total : 0, maxStore > 0 ? amount / maxStore : 0, sonstige));

  /* Produkte, die immer wieder gekauft werden: dieselbe Rangliste wie
     oben, nur je Produkt statt je Kategorie/Markt — damit sichtbar
     wird, ob ein einzelnes, regelmäßig gekauftes Produkt über die Zeit
     mehr oder weniger kostet, nicht nur die ganze Kategorie drumherum. */
  const byProdukt = produktRang(ctx, rows);
  if (byProdukt.size) {
    // Name -> ID, nur für den Antipp-Aufruf unten. produktRang() bleibt
    // namensbasiert wie byCat/byStore, damit topNMitSonstige unverändert
    // auf allen drei Listen funktioniert.
    const idByName = new Map();
    ctx.rhythms.forEach((r, pid) => { const p = byId(pid); if (p) idByName.set(p.name, pid); });

    const produkte = topNMitSonstige(byProdukt, 7);
    const maxProdukt = Math.max(...produkte.map((x) => x[1]));
    const produktVerlustAnteil = produktVerlust(ctx);
    const produktVerlauf = produktMonatsverlauf(ctx, 6);
    moneyBarSection(h, "Immer wieder gekauft", produkte, ([label, amount, sonstige]) => {
      const pid = idByName.get(label);
      return moneyBarRow(label, amount, total > 0 ? amount / total : 0, maxProdukt > 0 ? amount / maxProdukt : 0,
        sonstige, sonstige ? 0 : (produktVerlustAnteil.get(label) || 0), sonstige ? null : produktVerlauf.get(label),
        pid ? () => productSheet(pid, ctx) : null);
    });
  }

  return h;
}

/** Balken je Monat, mit geschätztem Verderb-Anteil obenauf. */
function chartCard(ctx) {
  const byMonth = new Map();
  ctx.history.forEach((h) => {
    const m = h.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + h.unitPrice * h.quantity);
  });
  const months = [...byMonth.entries()].sort();
  const g = uiGroup("Ausgaben je Monat",
    "Der rote Anteil ist geschätzt: Rhythmus länger als Haltbarkeit, hochgerechnet auf den Zeitraum. Keine gemessene Zahl.");
  if (!months.length) { g.body.append(el("p", "empty", "Keine Daten.")); return g; }

  const W = 760, H = 210, pad = { l: 44, r: 12, t: 10, b: 28 };
  const max = Math.max(...months.map((m) => m[1]), 10) * 1.15;
  const bw = (W - pad.l - pad.r) / months.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const wasteShare = ctx.totals.spend > 0 ? ctx.totals.wastedEuros / ctx.totals.spend : 0;

  let grid = "", bars = "";
  [0, max / 2, max].forEach((tv) => {
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="currentColor" opacity=".12"/>` +
      `<text x="${pad.l - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" opacity=".45">${tv.toFixed(0)}</text>`;
  });
  months.forEach((m, i) => {
    const x = pad.l + i * bw + bw * 0.26, w = bw * 0.48;
    const top = y(m[1]), base = y(0);
    bars += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(base - top).toFixed(1)}" fill="var(--accent)" rx="6"/>` +
      `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(3, (base - top) * wasteShare).toFixed(1)}" fill="var(--red)" rx="6"/>` +
      `<text x="${(x + w / 2).toFixed(1)}" y="${H - pad.b + 17}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".45">${m[0].slice(5)}</text>`;
  });

  const box = el("div", "chartBox");
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ausgaben je Monat">${grid}${bars}</svg>` +
    `<div class="legend"><span><i style="background:var(--accent)"></i>gegessen</span>` +
    `<span><i style="background:var(--red)"></i>verdorben (Schätzung)</span></div>`;
  g.body.append(box);
  return g;
}

/* ================================================================
   6. Mehr
   ================================================================ */
function viewMehr(ctx, app) {
  const c = frag();

  // Zwei Bereiche statt 13 Karten in einem Scroll: "Einstellungen" für
  // alles, was man einmal anfasst und dann lange nicht wieder, und
  // "Auswertungen" für alles, was man nachschlägt. Die Gefahrenzone
  // bleibt bei den Einstellungen, nie bei den Auswertungen.
  const nav = el("div", "group");
  nav.append(segmented(
    [["einstellungen", "Einstellungen"], ["auswertungen", "Auswertungen"]],
    app.mehrTab, (k) => { app.mehrTab = k; app.render(); }, "Bereich"));
  c.append(nav);

  if (app.mehrTab === "auswertungen") renderMehrAuswertungen(c, ctx, app);
  else renderMehrEinstellungen(c, ctx, app);

  return c;
}

/** Unterbereich "Einstellungen": Dinge, die man selten anfasst. */
function renderMehrEinstellungen(c, ctx, app) {
  const S = Data.get();

  /* --- Darstellung --- */
  const look = uiGroup("Darstellung");
  look.body.append(uiRow("Erscheinungsbild", null,
    segmented([["system", "System"], ["hell", "Hell"], ["dunkel", "Dunkel"]], S.settings.theme,
      (v) => app.set((s) => { s.settings.theme = v; }), "Erscheinungsbild"), { stacked: true }));
  look.body.append(uiRow("Schriftgröße", null,
    segmented([[1, "Normal"], [1.15, "Groß"], [1.3, "Sehr groß"]], S.settings.textScale,
      (v) => app.set((s) => { s.settings.textScale = v; }), "Schriftgröße"), { stacked: true }));

  /* --- Einstellungen für die Liste ---
     Standen früher unten auf der Startseite, dann ganz unten hier.
     Beides falsch: es sind die vier Werte mit der höchsten
     Handlungsdichte in "Mehr" -- wer öfter am Budget dreht, sollte
     nicht an Wochenrückblick, Haushaltsgeräten und einer potenziell
     langen Gangreihenfolge vorbeiscrollen müssen. */
  const wl = uiGroup("Deine Liste",
    "Diese vier Werte steuern, was auf der Einkaufsliste landet.\n\n" +
    "Das Budget streicht die teuersten entbehrlichen Positionen — Brot, Milch und Eier bleiben immer drauf. " +
    "Die Personenzahl skaliert die Mengen. Die Vorausschau nimmt mit, was in den nächsten Tagen fällig wird, " +
    "damit man nicht zweimal geht. Und der Urlaubsmodus stellt zurück, was bis zur Rückkehr verderben würde.");
  const restBudget = S.settings.budget - ctx.items.filter((i) => i.on)
    .reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
  wl.body.append(uiRow("Budget",
    S.settings.budget ? (restBudget >= 0 ? `${eur(restBudget)} Luft` : `${eur(-restBudget)} drüber`) : null,
    stepper(S.settings.budget, (v) => (v ? eur(v) : "aus"),
      (v) => app.set((s) => { s.settings.budget = v; }), { min: 0, max: 400, step: 5 })));
  wl.body.append(uiRow("Personen", null,
    stepper(S.settings.household, String,
      (v) => app.set((s) => { s.settings.household = v; }), { min: 1, max: 8, step: 1 })));
  wl.body.append(uiRow("Vorausschau",
    ctx.pattern && ctx.pattern.dayName ? `nächster Einkauf ${ctx.pattern.dayName}` : null,
    stepper(S.settings.lookaheadDays, (v) => (v ? tage(v) : "aus"),
      (v) => app.set((s) => { s.settings.lookaheadDays = v; }), { min: 0, max: 7, step: 1 })));

  const urlaub = S.settings.vacation;
  wl.body.append(uiRow("Urlaub",
    urlaub.active && urlaub.from ? `${deDate(urlaub.from)}–${deDate(urlaub.to)}` : null,
    toggle(urlaub.active, (onOff) => app.set((s) => {
      s.settings.vacation.active = onOff;
      if (onOff && !s.settings.vacation.from) {
        s.settings.vacation.from = Data.plusDays(Data.today(), 2);
        s.settings.vacation.to = Data.plusDays(Data.today(), 16);
      }
    }), "Urlaubsmodus")));
  if (urlaub.active) {
    const f = el("div", "dateRow");
    [["from", "Abreise"], ["to", "Rückkehr"]].forEach(([key, label]) => {
      const w = el("label", "field", `<span class="lbl">${label}</span>`);
      const i = el("input");
      i.type = "date";
      i.value = urlaub[key] || "";
      i.addEventListener("change", () => app.set((s) => { s.settings.vacation[key] = i.value; }));
      w.append(i);
      f.append(w);
    });
    wl.body.append(f);
  }

  // Auf dem Rechner nebeneinander statt untereinander: zwei kurze,
  // unabhängige Gruppen -- dieselbe vorbereitete .cards2-Regel wie in
  // "Bestand", die vorher in keiner Ansicht verwendet wurde. Auf dem
  // Telefon bewirkt .cards2 nichts (Regel nur im ≥900px-Media-Query),
  // beide bleiben also wie gewohnt untereinander.
  const lookWl = el("div", "cards2");
  lookWl.append(look, wl);
  c.append(lookWl);

  /* --- Rückblick --- */
  const rv = uiGroup("Wochenrückblick",
    "Der Rückblick erscheint ab Sonntagabend oben auf der Liste und bleibt bis Dienstag abrufbar.\n\n" +
    "Die Erinnerung ist ausdrücklich KEINE echte Push-Nachricht: ohne Server kann niemand die App von " +
    "außen wecken, und einen Server hat diese App bewusst nicht. Die Meldung erscheint deshalb beim " +
    "nächsten Öffnen, wenn der Rückblick fällig ist.");
  rv.body.append(uiRow("Erinnern", "beim nächsten Öffnen",
    toggle(!!S.review.notify, (on) => app.askNotify(on), "Erinnerung an den Wochenrückblick")));
  rv.body.append(uiRow("Diese Woche ansehen", null, null, { onClick: () => reviewSheet(ctx, app) }));

  /* --- Haushalt: bestimmt Verbrauchsraten und filtert Produkte --- */
  const hh = uiGroup("Haushalt",
    "Diese Angaben steuern die Verbrauchsraten der Haushaltsprodukte. Fehlt ein Gerät, verschwinden " +
    "die zugehörigen Produkte ganz — ein Entkalker-Vorschlag ohne Kaffeemaschine kostet mehr Vertrauen als er nützt.\n\n" +
    "Die Wasserhärte steht auf der Rechnung deines Wasserversorgers. Sie ist in Deutschland gesetzlich in " +
    "drei Bereiche eingeteilt und bestimmt, wie oft entkalkt und wie hoch dosiert werden muss.");
  hh.body.append(uiRow("Wasserhärte", HARDNESS_LABEL[S.household.waterHardness],
    segmented([["weich", "Weich"], ["mittel", "Mittel"], ["hart", "Hart"]], S.household.waterHardness,
      (v) => app.set((st) => { st.household.waterHardness = v; }), "Wasserhärte"), { stacked: true }));
  [
    ["hasWashingMachine", "Waschmaschine"],
    ["hasDishwasher", "Spülmaschine"],
    ["hasCoffeeMachine", "Kaffeemaschine"],
    ["hasWaterFilter", "Wasserfilter"]
  ].forEach(([key, label]) => {
    hh.body.append(uiRow(label, null,
      toggle(S.household[key], (on) => app.set((st) => { st.household[key] = on; }), label)));
  });

  const rvHh = el("div", "cards2");
  rvHh.append(rv, hh);
  c.append(rvHh);

  /* --- Gangreihenfolge --- */
  const aisles = relevantAisles(ctx.aisleList, ctx.items);
  if (aisles.length > 1) {
    /* Heißt wie der Knopf, der dorthin führt. „Ladenweg“ als
       Überschrift und „Nach Gängen“ als Knopf waren zwei Namen für
       dieselbe Reihenfolge — man sucht die Einstellung dann dort,
       wo sie nicht steht. */
    const g = uiGroup("Nach Gängen" + (ctx.store ? ` · ${ctx.store}` : ""),
      "Die Reihenfolge, in der die Liste beim Einkaufen durchlaufen wird. Sie wird je Markt gemerkt. " +
      "Der Griff links lässt sich ziehen -- schneller als die Pfeile, wenn viele Gänge umsortiert werden sollen.");
    aisles.forEach((aisle, i) => {
      const r = el("div", "row aisleRow");
      const handle = el("span", "aisleHandle",
        '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="6" cy="5" r="1.5"/><circle cx="14" cy="5" r="1.5"/>' +
        '<circle cx="6" cy="10" r="1.5"/><circle cx="14" cy="10" r="1.5"/><circle cx="6" cy="15" r="1.5"/><circle cx="14" cy="15" r="1.5"/></svg>');
      handle.setAttribute("aria-hidden", "true");
      r.append(handle);
      r.append(el("div", "rowMain", `<div class="rowTitle">${esc(aisle)}</div>`));
      const acts = el("div", "rowActions");
      [["↑", -1, i === 0], ["↓", 1, i === aisles.length - 1]].forEach(([sym, dir, disabled]) => {
        const b = el("button", "pillBtn", sym);
        b.setAttribute("aria-label", `${aisle} nach ${dir < 0 ? "oben" : "unten"}`);
        b.disabled = disabled;
        if (!disabled) b.addEventListener("click", () => app.moveAisle(aisle, dir));
        acts.append(b);
      });
      r.append(acts);
      g.body.append(r);
      attachAisleDrag(handle, r, g.body, i, aisle, app);
    });
    c.append(g);
  }

  /* --- Daten --- */
  const dat = uiGroup("Daten",
    "Alles liegt im Speicher dieses Browsers. Browserdaten löschen löscht die App-Daten mit.");
  dat.body.append(uiRow("Käufe", S.settings.demo ? "Beispieldaten" : null, null, { value: String(S.purchases.length) }));
  dat.body.append(uiRow("Bons", null, null, { value: String(S.receipts.length) }));
  dat.body.append(uiRow("Gelernte Schreibweisen", null, null, { value: String(Object.keys(S.aliases).length) }));
  c.append(dat);

  const actions = uiGroup();
  const demo = el("button", "row action");
  demo.append(el("div", "rowMain",
    `<div class="rowTitle">${S.settings.demo ? "Beispieldaten neu laden" : "Beispieldaten laden"}</div>`));
  demo.addEventListener("click", () => app.confirm("Beispieldaten laden?",
    "Ersetzt alle erfassten Käufe durch sechs Monate erzeugte Historie.",
    () => { Data.loadDemo("full"); app.toast("Geladen"); app.goto("liste"); }));
  actions.body.append(demo);

  const del = el("button", "row action danger");
  del.append(el("div", "rowMain", '<div class="rowTitle">Alles löschen</div>'));
  del.addEventListener("click", () => app.confirm("Alles löschen?",
    "Käufe, Bons, Einstellungen und gelernte Zuordnungen. Nicht umkehrbar.",
    () => { Data.reset(); app.toast("Gelöscht"); app.goto("liste"); }));
  actions.body.append(del);
  c.append(actions);
}

/**
 * Eine Gangreihenfolge-Zeile per Zeigergeste an eine andere Stelle
 * ziehen -- die Pfeiltasten bleiben daneben bestehen (Tastatur,
 * Vorleseprogramm); das hier ist der bequemere Weg für viele Gänge.
 *
 * Bewusst ohne die Zeilen währenddessen wirklich im DOM umzuhängen:
 * jede Nachbarzeile bekommt nur ein `transform`, solange gezogen
 * wird, verschoben um genau eine Zeilenhöhe in die passende Richtung.
 * Erst beim Loslassen wird `App.reorderAisleTo()` aufgerufen, das
 * Ergebnis kommt über den ganz normalen Neuaufbau der Ansicht --
 * kein Sonderfall, kein Nachräumen von Hand nötig.
 */
function attachAisleDrag(handle, row, list, startIndex, aisle, app) {
  let dragging = false, startY = 0, rowHeight = 0, steps = 0, pointerId = null;

  const rows = () => [...list.children];

  const onMove = (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const gesamt = rows().length;
    let neu = Math.round(dy / rowHeight);
    neu = Math.max(-startIndex, Math.min(gesamt - 1 - startIndex, neu));
    if (neu !== steps) {
      steps = neu;
      rows().forEach((r, i) => {
        if (r === row) return;
        if (i > startIndex && i <= startIndex + steps) r.style.transform = `translateY(${-rowHeight}px)`;
        else if (i < startIndex && i >= startIndex + steps) r.style.transform = `translateY(${rowHeight}px)`;
        else r.style.transform = "";
      });
    }
    row.style.transform = `translateY(${dy}px)`;
  };

  const ende = (e) => {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(pointerId); } catch (err) { /* schon losgelassen */ }
    row.classList.remove("dragging");
    rows().forEach((r) => { r.style.transform = ""; });
    if (steps !== 0) app.reorderAisleTo(aisle, startIndex + steps);
  };

  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    steps = 0;
    rowHeight = row.getBoundingClientRect().height;
    row.classList.add("dragging");
    handle.setPointerCapture(pointerId);
    e.preventDefault();
  });
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", ende);
  handle.addEventListener("pointercancel", ende);
}

/** Unterbereich "Auswertungen": Dinge, die man nachschlägt statt anfasst. */
function renderMehrAuswertungen(c, ctx, app) {
  /* --- Fällig & Angebote: dauerhafter Einstiegspunkt ---
     Beide Seiten haben seit der Startseiten-Umstellung keinen eigenen
     Reiter mehr und hängen sonst nur an bedingten Zeilen auf Start
     (nur bei wirklich Fälligem bzw. erkannten Angeboten) und Bestand
     (nur bei Austausch- oder Nachschubbedarf). Sind alle diese
     Bedingungen gleichzeitig falsch, verschwindet jeder Weg dorthin
     komplett -- diese Gruppe bleibt immer da, bewusst unauffällig
     (kein Flag, keine Zahl in der Ruhe), wenn gerade nichts ansteht. */
  const goto2 = uiGroup("Fällig & Angebote");
  const faelligOffen = ctx.swapsDue.filter((x) => x.due).length;
  goto2.body.append(uiRow("Fällig",
    faelligOffen ? zahlwort(faelligOffen, "Produkt", "Produkte") : "nichts offen",
    null, { onClick: () => app.goto("faellig") }));
  goto2.body.append(uiRow("Angebote",
    ctx.foodDeals.length ? zahlwort(ctx.foodDeals.length, "Angebot", "Angebote") + " erkannt" : "keine erkannt",
    null, { onClick: () => app.goto("angebote") }));
  c.append(goto2);

  /* --- Saison --- */
  if (ctx.seasonNow.length) {
    const g = uiGroup("Jetzt Saison", "Saisonkalender des BZfE. Anregung, kein Vorschlag.");
    g.body.append(uiRow(ctx.seasonNow.map((x) => x.name).join(", ")));
    c.append(g);
  }

  /* --- Pfand --- */
  const d = ctx.deposit;
  const pg = uiGroup("Pfand",
    "Einwegpfand 0,25 € ist gesetzlich einheitlich. Mehrwegsätze sind herstellerabhängig — die Beträge sind übliche Sätze, keine Zusicherung.");
  if (!d.byType.length) {
    pg.body.append(uiRow("Nichts offen", null, null, { value: "0,00 €" }));
  } else {
    d.byType.forEach((t) => pg.body.append(uiRow(t.label, `${t.count} Gebinde`, null, { value: eur(t.amount) })));
    pg.body.append(uiRow("Alles zurückgegeben", `ältestes seit ${tagen(d.daysOpen)}`, null, {
      onClick: () => {
        app.set((s) => {
          s.depositReturned = [...new Set([...s.depositReturned, ...ctx.openDepositEntries.map((e) => e.key)])];
        });
        app.toast("Notiert");
      }
    }));
  }
  c.append(pg);

  /* --- Archiv --- */
  const st = archiveStats(ctx.archive);
  const ag = uiGroup("Märkte",
    "Die App speichert und erinnert. Sie gibt keine Rechtsauskunft — Fristen und Kulanz hängen vom Einzelfall ab.");
  st.stores.forEach((x) => ag.body.append(uiRow(x.name, `${x.visits} Besuche · Ø ${eur(x.avgBasket)}`,
    null, { value: eur(x.spend) })));
  if (!st.stores.length) ag.body.append(el("p", "empty", "Noch keine Bons."));
  const fr = expiringWarranties(ctx.archive, ctx.ref, 800);
  if (fr.length) {
    ag.body.append(uiRow(`${fr.length} Gewährleistungsfrist(en)`, fr[0].message, null,
      { onClick: () => app.notice("Gewährleistung", fr.slice(0, 8).map((f) => f.message).join("\n\n")) }));
  }
  c.append(ag);

  /* --- Rechenweg --- */
  const m = uiGroup("Rechenweg");
  m.body.append(uiRow("Wie die App rechnet", "kein KI-Modell", null, {
    onClick: () => app.notice("Rechenweg", [
      "Bonzeile → Produkt: Alias-Tabelle, sonst Token- und Levenshtein-Vergleich. 65–85 % werden gefragt statt geraten. Der Steuersatz auf dem Bon ist ein Vorfilter (7 % meist Lebensmittel, 19 % meist Haushalt), kein Ersatz für den Abgleich.",
      "Rhythmus: Median der Kaufabstände je Einheit. Pausen über dem Dreifachen ausgeschlossen.",
      "Vertrauen: Datenpunkte × (1 − robuste Streuung), MAD statt Standardabweichung.",
      "Bestand: gekauft − (Tage seit Kauf ÷ Verbrauch je Einheit).",
      "Reichweite: kleinerer Wert aus Restmenge × Verbrauch und verbleibender Haltbarkeit.",
      "Verschwendung: strukturell, wenn Rhythmus > Haltbarkeit; Ausreißer bei Abstand > Haltbarkeit × 1,2. Geschätzt heißt: die App sieht, dass wieder gekauft wurde, bevor die Haltbarkeit reichen konnte. Sie hat nicht in deinen Kühlschrank geschaut.",
      "Budget: erst Verschwender halbieren, dann Süßes und Alkohol. Grundnahrung nie.",
      "Preis: Median der eigenen Kaufpreise, ab 8 % Abweichung gemeldet. Der Median statt des Durchschnitts, damit ein einzelnes Angebot den Bezugswert nicht verschiebt. Kein Vergleich zwischen Märkten — dafür fehlen die Daten, und fremde Preise wären erfunden.",
      "Inflation: gewichteter Preisindex über Produkte aus beiden Zeiträumen.",
      "Haushaltsprodukte rechnen anders: sie verderben nicht, also entspricht die gekaufte Menge der verbrauchten. Statt eines Kaufrhythmus gilt eine Verbrauchsrate, skaliert mit der Haushaltsgröße hoch einem Exponenten je Produkt — Zahnpasta linear, Waschmittel degressiv, Allzweckreiniger gar nicht.",
      "Rate: Referenzwert als Prior, Beobachtung über ein 180-Tage-Fenster als Posterior, gewichtet mit min(Käufe, 6) gegen 2. Nach sechs Käufen bestimmt die Beobachtung drei Viertel.",
      "Austausch: Kaufdatum plus Intervall, ohne Verbrauchsmodell. Bei unregelmäßigem Kauf (Variationskoeffizient ab 0,35) sagt die App gar nichts statt etwas Falsches."
    ].join("\n\n"))
  }));

  const q = databaseQualityReport();
  m.body.append(uiRow("Datenbasis", `${zahlwort(q.total, "Produkt", "Produkte")} · ${q.anteilGeschaetzt} % geschätzt`, null, {
    onClick: () => app.notice("Datenbasis, ungeschönt",
      `${zahlwort(q.total, "Produkt", "Produkte")}, ${zahlwort(q.kategorien, "Kategorie", "Kategorien")}, ${q.aliasesTotal} Schreibweisen, ${q.nonFood} Non-Food.\n\n` +
      `rechtlich definiert: ${q.regulatorisch}\n` +
      `Leitlinie: ${q.leitlinie} — aus behördlicher Lagerempfehlung abgeleitet (BZfE, BMEL)\n` +
      `Schätzwert: ${q.schaetzwert} — ohne amtliche Quelle, vor Produktivbetrieb prüfen\n\n` +
      `${q.anteilGeschaetzt} % der Haltbarkeitswerte sind Schätzungen. Das ist der ehrliche Preis für die Abdeckung von ${q.total} Produkten.\n\n` +
      `${zahlwort(q.safetyCritical, "Produkt", "Produkte")} tragen ein Verbrauchsdatum. Für sie schlägt die App nie eine Weiterverwendung vor — und ihre Tageszahlen ` +
      `stehen ausdrücklich NICHT als „rechtlich definiert“ da: geregelt sind die Pflicht zum Verbrauchsdatum (LMIV Art. 24) und die ` +
      `Höchsttemperatur (Tier-LMHV Anlage 5), nicht die Anzahl der Tage. Die Tage sind Lagerempfehlungen, jeweils an der unteren Grenze. ` +
      `Es gilt immer das aufgedruckte Datum.`)
  }));
  m.body.append(uiRow("Über", `Bauversion ${window.__BUILD__ || "dev"}`, null, {
    onClick: () => app.notice("Einkaufs-Anker",
      "Alle Zahlen werden im Browser gerechnet. Kein Server, kein Konto, keine Übertragung.\n\n" +
      "Quellen: BZfE/BLE „Haltbarkeit von Lebensmitteln\“ und „Lebensmittel richtig lagern\“ (20.02.2025), " +
      "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\“.")
  }));
  c.append(m);
}
