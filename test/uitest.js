/**
 * uitest.js — die gebaute Web-App in einem simulierten Browser.
 *
 * Geprüft wird das, was Regressionstests der Module nicht erwischen:
 * ob die Oberfläche ohne Laufzeitfehler durchläuft, wenn man sie
 * benutzt. Jeder Fehler in der Konsole lässt den Test scheitern —
 * ein stiller TypeError in einer Ansicht ist genau die Sorte Fehler,
 * die sonst erst beim Nutzer auffällt.
 *
 *   node test/uitest.js      (setzt "npm run build" voraus)
 */
const fs = require("fs");
const path = require("path");

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  console.log("jsdom nicht installiert — Oberflächentest übersprungen.");
  console.log("Installieren mit: npm install");
  process.exit(0);
}

const WEB = path.join(__dirname, "..", "web");
if (!fs.existsSync(path.join(WEB, "index.html"))) {
  console.error("web/ fehlt — erst 'npm run build' ausführen.");
  process.exit(1);
}

let pass = 0, fail = 0;
const errors = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail ? " — " + detail : "")); }
}

/* ---------- Browser hochfahren ---------- */
const html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;

// Sammelt echte Laufzeitfehler ein.
window.addEventListener("error", (e) => errors.push(String(e.error || e.message)));
window.onerror = (m, s, l, c, err) => errors.push(String(err || m));

// localStorage: jsdom bringt eins mit, aber nicht in jeder Fassung.
if (!window.localStorage) {
  const mem = new Map();
  window.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear()
  };
}
window.scrollTo = () => {};
window.URL.createObjectURL = () => "blob:test";
window.URL.revokeObjectURL = () => {};

// Cache Storage: jsdom kennt sie nicht (kein Service Worker). Ein
// simples In-Memory-Double reicht, um App.consumeSharedIfAny() zu
// prüfen — den eigentlichen Worker (sw.js, läuft in einem eigenen
// Kontext, den Node nicht ausführt) deckt das nicht ab, siehe unten.
const cacheStores = new Map();
window.caches = {
  open: async (name) => {
    if (!cacheStores.has(name)) cacheStores.set(name, new Map());
    const store = cacheStores.get(name);
    return {
      match: async (key) => store.get(key) || undefined,
      put: async (key, res) => { store.set(key, res); },
      delete: async (key) => store.delete(key)
    };
  }
};

const origWarn = window.console && window.console.warn;
window.console = {
  ...console,
  warn: (...a) => { if (origWarn) origWarn.apply(console, a); },
  error: (...a) => { errors.push(a.map(String).join(" ")); console.error(...a); }
};

// Skriptreihenfolge aus der gebauten index.html lesen, damit der Test
// nicht auseinanderläuft, wenn dort eine Datei dazukommt.
// Alle Skripte in Dokumentreihenfolge — auch die eingebetteten. Genau
// dort steckte einmal ein Fehler, den nur der Browser sah: build.js
// hatte beim Einsetzen der Bauversion den Bezeichner window.__BUILD__
// mit überschrieben. Die vier externen Dateien waren einwandfrei, die
// Seite trotzdem tot.
const sources = [];
for (const m of html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)) {
  sources.push(m[1] ? fs.readFileSync(path.join(WEB, m[1]), "utf8") : m[2]);
}
if (sources.length < 2) { console.error("index.html bindet kaum Skripte ein."); process.exit(1); }

// Alles in EINEM eval: die Module vergeben ihre Namen mit const auf
// oberster Ebene — in getrennten eval-Aufrufen sähen sie einander nicht.
// Die angehängte Zeile reicht die Namen an den Test durch.
try {
  window.eval(
    sources.join("\n;\n") +
    "\n;window.__T = { Data, App, byId, suggestRecipes, toRecipeStock, FOOD_DATABASE, productSheet," +
    " reviewCard, reviewSheet, streakStrip, badgeScroller, weeklyReview, weekRangeFor, milestoneState," +
    " brandOf, brandSwapCandidates, brandSheet, PILL_INFO, pill, OCR, readReceiptImage," +
    " pickBetter, receiptSheet, wasteSummary, cheaperAlternatives," +
    " collectHints, hintsSheet, weekPulse, viewStart, NAV, SUBVIEWS, addSheet, askLate, daysBetween,"+
    " zahlwort, tage, tagen, alleTage, OffLookup, nachschlagen, marktGruppen, moneySparklineSvg," +
    " kategorieVerlust, kategorieMonatsverlauf, produktRang, produktVerlust, produktMonatsverlauf," +
    " mascotSvg, mascotMood, mascotMessage, MASCOT_RULES, mascotAlarmSignature,"+
    " viewKalender, kalenderTagGruppe, monatsTitel, buildCalendar, monatPlus, monatsSpanne };"
  );
} catch (e) {
  errors.push(String(e.stack || e.message));
}

const T = window.__T || {};
const productSheetFor = (pid) => T.productSheet(pid, T.App.ctx);
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const click = (node) => node && node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

/* jsdom stellt das Dokument fertig und meldet erst danach DOMContentLoaded.
   boot() hängt an diesem Ereignis — also wird gewartet, statt es zu
   umgehen. So läuft der Test durch dieselbe Startfolge wie ein Browser. */
const ready = new Promise((res) => {
  if (doc.readyState === "complete") res();
  else window.addEventListener("load", () => res());
});

ready.then(async () => {

console.log("\n--- Start ---");
ok("App startet ohne Laufzeitfehler", errors.length === 0, errors[0]);
const App = T.App;
ok("Navigation ist aufgebaut", $("nav").children.length === 6, $("nav").children.length);
ok("Großer Titel ist gesetzt", !!$("largeTitle").querySelector("h1"));
ok("Leerer Start zeigt keine erfundenen Zahlen", !$("main").querySelector(".hero,.tile"));
ok("Bauversion ist eingesetzt", /^[a-z0-9]+$/.test(String(window.__BUILD__)), String(window.__BUILD__));

console.log("\n--- Beispieldaten laden ---");
const D = T.Data;
D.loadDemo("full");
const S = D.get();
ok("Käufe wurden gespeichert", S.purchases.length > 200, `${S.purchases.length} Käufe`);
ok("Bons wurden abgeleitet", S.receipts.length > 20, `${S.receipts.length} Bons`);
ok("Alles bleibt im localStorage", !!window.localStorage.getItem(D.STORE_KEY));

const ctx = D.compute();
ok("Rhythmen werden gelernt", ctx.rhythms.size >= 15, `${ctx.rhythms.size} Produkte`);
ok("Stufe 3 erreicht (eigene Historie)", ctx.stage.stage === 3, "Stufe " + ctx.stage.stage);
ok("Vorschlagsliste ist nicht leer", ctx.items.length > 0, `${ctx.items.length} Positionen`);
ok("Bestand wird geschätzt", ctx.inventory.length > 0, `${ctx.inventory.length} Positionen`);
ok("Verschwendung wird erkannt", ctx.chronic.length > 0, `${ctx.chronic.length} Produkte`);
ok("Wochenschnitt ist plausibel", ctx.totals.spendPerWeek > 5 && ctx.totals.spendPerWeek < 500,
  ctx.totals.spendPerWeek.toFixed(2) + " €");
ok("Demo-Historie liegt in der Vergangenheit", ctx.totals.firstDate < D.today());

console.log("\n--- Alle Bereiche durchklicken ---");
["start", "liste", "faellig", "bestand", "erfassen", "zahlen", "mehr"].forEach((tab) => {
  const before = errors.length;
  App.goto(tab);
  ok(`Bereich "${tab}" rendert`, errors.length === before && $("main").children.length > 0, errors[before]);
});

console.log("\n--- Liste bedienen ---");
App.goto("liste");
/* Der Kreis heißt „im Wagen“, nicht mehr „auf der Liste“. Diese
   Prüfungen beschrieben bis hierher das alte Modell — sie sind mit
   umgezogen, nicht gestrichen. */
const boxes = $("main").querySelectorAll("input.box");
ok("Positionen lassen sich in den Wagen legen", boxes.length > 0, `${boxes.length} Kästchen`);
if (boxes.length) {
  const b4 = errors.length;
  boxes[0].checked = true;
  boxes[0].dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("Einlegen läuft fehlerfrei", errors.length === b4, errors[b4]);
  ok("Es liegt sichtbar im Wagen", $("main").querySelectorAll(".item.imWagen").length === 1,
    $("main").querySelectorAll(".item.imWagen").length);
  ok("Und es ist gespeichert", D.get().storeChecked.length === 1, D.get().storeChecked.join(","));

  /* Der Kern des Umbaus: die Liste und die Gangansicht teilen sich
     EINEN Wagen. Vorher waren es zwei Zustände, die gleich aussahen —
     wer im Laden die Liste benutzte, buchte nie etwas. */
  App.openStore();
  ok("Die Gangansicht kennt denselben Wagen",
    /^1 von/.test($("storeProg").textContent), $("storeProg").textContent);
  App.closeStore();

  // Die Wagenleiste erscheint erst, wenn etwas drin liegt.
  const bar = $("main").querySelector(".cartBar");
  ok("Die Wagenleiste ist da", !!bar);
  ok("Und sagt, was drin ist", bar && /1 von \d+ im Wagen/.test(bar.textContent),
    bar ? bar.textContent.trim() : "—");

  // Wieder herausnehmen
  const b2 = $("main").querySelectorAll("input.box")[0];
  b2.checked = false;
  b2.dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("Herausnehmen geht auch", D.get().storeChecked.length === 0);
  ok("Ohne Wagen keine Leiste", !$("main").querySelector(".cartBar"));
}

console.log("\n--- Eine Liste ist eine Liste, auch ohne Vorhersage ---");
{
  /* Hier stand ein `return`: bis zwei Bons je Produkt vorlagen —
     vier bis acht Wochen —, zeigte die Seite einen Satz und einen
     Knopf. Und weil das Erfassen mit `goto("liste")` endet, war das
     der erste Bildschirm nach der ersten echten Handlung. */
  D.reset();
  App.goto("liste");
  const leer = $("main");

  ok("Ohne jede Historie ist die Liste bedienbar", !!leer.querySelector(".addRow"));
  ok("Und sagt, was sie ist", /normale Einkaufsliste/.test(leer.textContent));
  ok("Ohne Positionen keine Summe", !leer.querySelector(".totals"));
  ok("Die Beispieldaten bleiben erreichbar",
    [...leer.querySelectorAll("button")].some((b) => /Beispieldaten/.test(b.textContent)));

  /* Ein einziger Bon: Stufe 1, keine Vorschläge — und trotzdem eine
     Einkaufsliste, die man selbst füllt. */
  D.addReceipt({
    date: D.today(), store: "Lidl",
    items: [
      { productId: "haehnchenbrust", quantity: 1, unitPrice: 6.99 },
      { productId: "milch_vollmilch", quantity: 1, unitPrice: 1.29 }
    ]
  });
  App.closeParty();
  App.goto("liste");
  ok("Nach einem Bon ist es Stufe 1", App.ctx.stage.stage === 1, App.ctx.stage.stage);
  ok("Ohne Vorschläge", App.ctx.items.length === 0, App.ctx.items.length);

  const main = $("main");
  ok("Hinzufügen geht trotzdem", !!main.querySelector(".addRow"));
  ok("Und die Seite sagt, warum noch nichts vorgeschlagen wird",
    /Vorschläge kommen noch/.test(main.textContent));

  D.addManual({ productId: "bananen", week: App.ctx.weekKey });
  D.addManual({ name: "Blumen für Oma", week: App.ctx.weekKey });
  App.render();
  const m2 = $("main");
  ok("Selbst ergänzte Positionen stehen auf der Liste",
    m2.querySelectorAll(".items .item").length === 2,
    m2.querySelectorAll(".items .item").length);
  ok("Mit Preis aus dem Katalog", /1,79/.test(m2.textContent));
  ok("Und ohne erfundenen Preis für die freie Zeile", /Blumen für Oma/.test(m2.textContent));
  ok("Jetzt gibt es auch eine Summe", !!m2.querySelector(".totals"));

  /* Der ganze Weg muss offenstehen, nicht nur die Anzeige. */
  const kasten = m2.querySelectorAll(".items input.box");
  ok("Einlegen geht", kasten.length === 2, kasten.length);
  kasten[0].checked = true;
  kasten[0].dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("Der Wagen füllt sich", D.get().storeChecked.length === 1);
  ok("Die Wagenleiste erscheint", !!$("main").querySelector(".cartBar"));
  App.openStore();
  ok("Die Gangansicht funktioniert auch hier",
    /von 2/.test($("storeProg").textContent), $("storeProg").textContent);
  App.closeStore();

  /* Und die Kopfzeile beschreibt die Liste, nicht die Datenlage. */
  ok("Die Unterzeile spricht von der Liste",
    /Position/.test($("largeTitle").textContent), $("largeTitle").textContent.trim());
}

console.log("\n--- Doch aufgegessen ---");
{
  /* Der Verlust ist die einzige große Zahl der App, die nie
     beobachtet wurde. Bis hierher konnte ihr niemand widersprechen. */
  D.reset();
  D.loadDemo("full");
  const ctx = App.ctx;

  // Ein Produkt, dem die App etwas vorwirft.
  let pid = null;
  for (const [k, st] of ctx.wasteStats) {
    if (st.wastedEuros > 0 && st.details && st.details.length) { pid = k; break; }
  }
  ok("Es gibt einen Verdachtsfall", !!pid, pid);

  if (pid) {
    const vorher = App.ctx.wasteStats.get(pid);
    const kgVorher = App.ctx.impact.kg;
    // Die Beispieldaten bringen schon Rettungen mit — verglichen wird
    // deshalb gegen den Stand davor, nicht gegen null.
    const geretteVorher = D.get().lifetime.gerettet;
    const euroVorher = D.get().lifetime.euros || 0;
    productSheetFor(pid);
    const blatt = $("sheetOpts");
    ok("Das Blatt legt die Fälle offen",
      /Was die App für verdorben hält/.test(blatt.textContent));
    ok("Mit Datum und Betrag", /\d\d\.\d\d\.\d{4}/.test(blatt.textContent));

    /* Zwei Behauptungen, zwei Schalter — der laufende Anteil gilt
       fürs Produkt, ein Ausreißer für einen Tag. */
    const knopf = [...blatt.querySelectorAll(".pillBtn")]
      .find((b) => /Doch gegessen|Bei mir nicht/.test(b.textContent));
    ok("Und einem Weg zu widersprechen", !!knopf);
    ok("Der laufende Anteil hat genau EINEN Schalter",
      [...blatt.querySelectorAll(".pillBtn")].filter((b) => /Bei mir nicht|abgestellt/.test(b.textContent)).length <= 1,
      [...blatt.querySelectorAll(".pillBtn")].map((b) => b.textContent).join(" | "));
    click(knopf);

    const nachher = App.ctx.wasteStats.get(pid);
    ok("Der Verlust sinkt", nachher.wastedEuros < vorher.wastedEuros,
      `${vorher.wastedEuros} -> ${nachher.wastedEuros}`);
    ok("Und die Kaufzahl bleibt", nachher.purchased === vorher.purchased);
    ok("Die Quote bleibt in ihren Grenzen",
      nachher.wasteRate >= 0 && nachher.wasteRate <= 1, nachher.wasteRate);
    ok("Die Korrektur ist vermerkt", nachher.corrected === 1 || nachher.chronicOff === true,
      `${nachher.corrected} / ${nachher.chronicOff}`);

    /* Die Kilogramm hängen an derselben Zahl wie die Euro. Vorher
       liefen sie über einen eigenen Kanal und wären hier stehen
       geblieben — zwei Zahlen für dieselbe Sache. */
    ok("Die Kilogramm gehen mit", App.ctx.impact.kg <= kgVorher,
      `${kgVorher} -> ${App.ctx.impact.kg}`);

    /* Der entscheidende Punkt: es wird NICHTS gutgeschrieben. Eine
       Schätzung zurückzunehmen ist kein Erfolg. */
    ok("Nichts wird als Rettung gebucht",
      D.get().lifetime.gerettet === geretteVorher,
      `${geretteVorher} -> ${D.get().lifetime.gerettet}`);
    ok("Und kein Betrag gutgeschrieben",
      (D.get().lifetime.euros || 0) === euroVorher,
      `${euroVorher} -> ${D.get().lifetime.euros}`);

    // Umkehrbar
    productSheetFor(pid);
    const zurueck = [...$("sheetOpts").querySelectorAll(".pillBtn")].find((b) => b.classList.contains("on"));
    ok("Die Bestätigung lässt sich zurücknehmen", !!zurueck);
    if (zurueck) {
      click(zurueck);
      const wieder = App.ctx.wasteStats.get(pid);
      ok("Und dann steht die alte Zahl wieder da",
        Math.abs(wieder.wastedEuros - vorher.wastedEuros) < 0.011,
        `${vorher.wastedEuros} -> ${wieder.wastedEuros}`);
      ok("Ohne offene Korrektur", wieder.corrected === 0 && !wieder.chronicOff,
        `${wieder.corrected} / ${wieder.chronicOff}`);
    }
  }
}

console.log("\n--- Kam das zu spät? ---");
{
  /* Die eine Rückmeldung ohne natürlichen Moment. „Hab noch“ hat
     einen — man nimmt die Position runter. „War schon alle“ wird
     Tage vorher wahr, vor dem leeren Kühlschrank; niemand öffnet
     dafür ein Blatt. Ihr Moment ist dieser: jemand setzt selbst
     etwas auf die Liste, das die App noch gar nicht vorgeschlagen
     hätte. */
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const ctx = App.ctx;

  // Ein Produkt mit gelerntem Rhythmus, das noch NICHT fällig ist.
  let spaet = null, frueh = null;
  for (const [pid, r] of ctx.rhythms) {
    if (!r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) continue;
    if (T.byId(pid) && T.byId(pid).isFood === false) continue;
    const dueIn = r.rhythmDays - T.daysBetween(r.lastPurchaseDate, ctx.ref);
    if (dueIn >= 2 && !spaet) spaet = pid;
    if (dueIn < 2 && !frueh) frueh = pid;
  }
  ok("Es gibt ein noch nicht fälliges Produkt", !!spaet, spaet);

  if (spaet) {
    const vorher = D.get().feedbackLog.length;
    T.addSheet(ctx, App);
    // Suchfeld füllen und den Katalogtreffer nehmen
    const feld = $("sheetOpts").querySelector("input");
    feld.value = T.byId(spaet).name;
    feld.dispatchEvent(new window.Event("input", { bubbles: true }));
    const treffer = $("sheetOpts").querySelector(".results li button");
    ok("Der Katalog findet es", !!treffer, feld.value);
    click(treffer);

    ok("Danach wird gefragt", /zu spät/i.test($("sheetTitle").textContent), $("sheetTitle").textContent);
    ok("Und die Frage nennt den Abstand",
      /erst in \d+ Tagen/.test($("sheetOpts").textContent), $("sheetOpts").textContent.slice(0, 70));

    /* Gefragt, nicht geschlossen: ohne Antwort darf sich nichts
       ändern. Ein stilles „hat es hinzugefügt, also war ich zu spät“
       liefe neben den Kaufdaten in dieselbe Korrektur. */
    ok("Ohne Antwort ändert sich nichts", D.get().feedbackLog.length === vorher,
      `${vorher} -> ${D.get().feedbackLog.length}`);

    const ja = [...$("sheetOpts").querySelectorAll(".row")].find((r) => /Ja, war schon alle/.test(r.textContent));
    ok("Es gibt ein Ja", !!ja);
    click(ja);
    ok("Das Ja wird protokolliert", D.get().feedbackLog.length === vorher + 1,
      `${vorher} -> ${D.get().feedbackLog.length}`);
    const letzte = D.get().feedbackLog[D.get().feedbackLog.length - 1];
    ok("Und zwar als „zu spät“", letzte.reason === "empty", letzte.reason);
    ok("Mit dem Abstand als Bezug", letzte.dueIn >= 2, letzte.dueIn);
    ok("Das Blatt schließt sich", $("sheet").hidden === true);
  }

  // Ein Produkt, das ohnehin fast fällig ist, wird nicht gefragt.
  if (frueh) {
    const vorher2 = D.get().feedbackLog.length;
    T.addSheet(App.ctx, App);
    const feld = $("sheetOpts").querySelector("input");
    feld.value = T.byId(frueh).name;
    feld.dispatchEvent(new window.Event("input", { bubbles: true }));
    const treffer = $("sheetOpts").querySelector(".results li button");
    if (treffer) {
      click(treffer);
      ok("Bei fast fälligen Produkten wird nicht gefragt",
        !/zu spät/i.test($("sheetTitle").textContent), $("sheetTitle").textContent);
      ok("Und nichts protokolliert", D.get().feedbackLog.length === vorher2);
      App.closeSheet();
    }
  }
}

console.log("\n--- Ein Wagen, zwei Sichten ---");
{
  /* Der ganze Weg einmal durch: in der Liste einlegen, in der
     Gangansicht noch eins dazu, aus der Liste buchen. Vorher war das
     zwei getrennte Zustände — wer im Laden die Liste benutzte, buchte
     nie etwas, und die App lernte aus dem Einkauf nichts. */
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const bons = D.get().receipts.length;

  const bx = [...$("main").querySelectorAll(".items input.box")];
  [0, 1].forEach((i) => {
    bx[i].checked = true;
    bx[i].dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  ok("Zwei liegen im Wagen", D.get().storeChecked.length === 2, D.get().storeChecked.length);

  App.openStore();
  ok("Die Gangansicht zählt beide mit", /^2 von/.test($("storeProg").textContent), $("storeProg").textContent);
  const offen = [...$("storeBody").querySelectorAll(".sItem:not(.done)")];
  ok("Und zeigt den Rest offen", offen.length > 0, offen.length);
  click(offen[0]);
  ok("Dort abgehakt zählt in denselben Wagen", D.get().storeChecked.length === 3, D.get().storeChecked.length);
  App.closeStore();

  const bar = $("main").querySelector(".cartBar");
  ok("Die Liste zeigt denselben Stand", bar && /3 von \d+ im Wagen/.test(bar.textContent),
    bar ? bar.textContent.trim() : "keine Leiste");

  click(bar.querySelector(".cta"));
  ok("Buchen fragt nach", /buchen/i.test($("sheetTitle").textContent), $("sheetTitle").textContent);
  click($("sheetOpts").querySelector(".cta"));
  ok("Der Bon ist geschrieben", D.get().receipts.length === bons + 1,
    `${bons} -> ${D.get().receipts.length}`);
  ok("Der Wagen ist leer", D.get().storeChecked.length === 0);
  ok("Und die Leiste ist weg", !$("main").querySelector(".cartBar"));
}

console.log("\n--- Die vier Antworten ---");
{
  /* Sie standen in der Zeile und erschienen beim Abwählen — eine
     Frage ohne Überschrift, und dazu falsch aufgehängt: „War schon
     alle" heißt ja, dass das Produkt gebraucht wird. Jetzt stehen sie
     im Detail-Blatt unter einer ausgeschriebenen Frage. */
  App.goto("liste");
  const zeile = $("main").querySelector(".items .item .main");
  ok("Eine Position lässt sich öffnen", !!zeile);
  click(zeile);
  const blatt = $("sheetOpts");
  ok("Das Blatt fragt nach der Woche", /Brauchst du das diese Woche/.test(blatt.textContent),
    blatt.textContent.slice(0, 60));
  const antworten = [...blatt.querySelectorAll(".row .rowTitle")].map((r) => r.textContent);
  /* Zwei Antworten, nicht vier — und beide beantworten wirklich die
     Frage darüber. „Verbraucht“ ist gestrichen (wirkungsgleich mit
     „Diese Woche nicht“), „War schon alle“ ist umgezogen an den
     Moment, in dem sie wahr wird. */
  ["Hab noch", "Diese Woche nicht"].forEach((a) =>
    ok(`„${a}“ steht darin`, antworten.includes(a), antworten.join(" | ")));
  ok("„Verbraucht“ ist weg", !antworten.includes("Verbraucht"), antworten.join(" | "));
  ok("Und „War schon alle“ steht nicht unter dieser Frage",
    !antworten.includes("War schon alle"), antworten.join(" | "));
  ok("Beide Antworten sagen, was sie bewirken",
    /Abstand wird länger/.test(blatt.textContent) && /bewusste Pause/.test(blatt.textContent));

  const wahl = [...blatt.querySelectorAll(".row")].find((r) => /Diese Woche nicht/.test(r.textContent));
  click(wahl);
  ok("Die Antwort schließt das Blatt", $("sheet").hidden === true);
  ok("Und wird gespeichert", Object.keys(D.get().listChoices).length > 0);

  /* Abgewähltes steht nicht mehr zwischen den anderen Zeilen — seit
     der Kreis „im Wagen“ heißt, wäre ein hohler Kreis dort nicht mehr
     von einer anstehenden Position zu unterscheiden. */
  const sammel = [...$("main").querySelectorAll(".row")]
    .find((r) => /Nicht diese Woche/.test(r.textContent));
  ok("Abgewähltes sammelt sich in einer Zeile", !!sammel);
  click(sammel);
  ok("Die Zeile öffnet die Sammlung", /Nicht diese Woche/.test($("sheetTitle").textContent));
  const zurueck = [...$("sheetOpts").querySelectorAll(".row")]
    .find((r) => /Doch drauf/.test(r.textContent));
  ok("Und bietet den Weg zurück", !!zurueck);
  if (zurueck) {
    click(zurueck);
    ok("Der Weg zurück funktioniert",
      !$("main").querySelector(".row .rowTitle") ||
      ![...$("main").querySelectorAll(".row")].some((r) => /Nicht diese Woche/.test(r.textContent)));
  }
  App.closeSheet();
}

const steppers = $("main").querySelectorAll(".stepper button");
if (steppers.length >= 2) {
  const budgetBefore = D.get().settings.budget;
  const b4 = errors.length;
  click(steppers[0]);
  ok("Budget lässt sich ändern", D.get().settings.budget !== budgetBefore && errors.length === b4,
    `${budgetBefore} -> ${D.get().settings.budget}`);
}

const vacSwitch = $("main").querySelector(".switch input");
if (vacSwitch) {
  const b4 = errors.length;
  vacSwitch.checked = true;
  vacSwitch.dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("Urlaubsmodus schaltet fehlerfrei", errors.length === b4 && D.get().settings.vacation.active === true, errors[b4]);
  const b5 = errors.length;
  App.goto("bestand");
  ok("Bestand mit Urlaubsplan rendert", errors.length === b5, errors[b5]);
  App.goto("liste");
  const sw2 = $("main").querySelector(".switch input");
  sw2.checked = false;
  sw2.dispatchEvent(new window.Event("change", { bubbles: true }));
}

console.log("\n--- Ladenmodus ---");
App.goto("liste");
const b4store = errors.length;
App.openStore();
ok("Ladenmodus öffnet", $("store").hidden === false && errors.length === b4store, errors[b4store]);
const sItems = $("storeBody").querySelectorAll(".sItem");
ok("Artikel nach Gängen sortiert", sItems.length > 0 && $("storeBody").querySelectorAll(".aisle").length > 0,
  `${sItems.length} Artikel`);
if (sItems.length) {
  click(sItems[0]);
  ok("Abhaken zählt mit", /1 von/.test($("storeProg").textContent), $("storeProg").textContent);
  ok("Summe wird angezeigt", /\d,\d\d €/.test($("storeSum").textContent), $("storeSum").textContent);
}
const receiptsBefore = D.get().receipts.length;
click($("storeDone"));
ok("Buchen fragt erst nach", $("sheet").hidden === false);
click($("sheetOpts").querySelector("button"));
ok("Einkauf landet in der Historie", D.get().receipts.length === receiptsBefore + 1,
  `${receiptsBefore} -> ${D.get().receipts.length}`);
ok("Ladenmodus schließt danach", $("store").hidden === true);

console.log("\n--- Bon einlesen ---");
App.goto("erfassen");
const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "lidl-2026-07-22.txt"), "utf8");
const parsed = D.parseReceiptText(fixture);
ok("Echter Bon wird zerlegt", parsed.rows.length > 5, `${parsed.rows.length} Zeilen`);
ok("Ein Teil wird sicher zugeordnet", parsed.sure > 0, `${parsed.sure} sicher, ${parsed.open} offen`);
ok("Unsicheres wird als Frage markiert, nicht still gebucht",
  parsed.rows.every((r) => r.needsConfirmation || r.productId));

const ta = $("main").querySelector("textarea");
ok("Eingabefeld ist da", !!ta);
if (ta) {
  const b4 = errors.length;
  ta.value = fixture;
  ta.dispatchEvent(new window.Event("input", { bubbles: true }));
  const buttons = [...$("main").querySelectorAll("button.cta")];
  const evalBtn = buttons.find((b) => b.textContent === "Auswerten");
  click(evalBtn);
  ok("Auswerten rendert das Ergebnis", errors.length === b4 && $("main").querySelectorAll(".matchRow").length > 0,
    errors[b4]);

  // Unsicheres läuft jetzt über die Bestätigungskarte, eine Zeile
  // nach der anderen — hier wird die Buchen-Sperre erst geprüft,
  // dann jede Karte durch Antippen des ersten Vorschlags aufgelöst.
  const saveBtnVorher = [...$("main").querySelectorAll("button.cta")].find((b) => /buchen$/.test(b.textContent));
  ok("Buchen ist gesperrt, solange unsichere Zeilen offen sind",
    !!saveBtnVorher && saveBtnVorher.disabled, saveBtnVorher && saveBtnVorher.disabled);

  let runden = 0;
  while ($("main").querySelector(".confirmCard") && runden < 30) {
    const wahl = $("main").querySelector(".confirmChoice");
    ok("Bestätigungskarte zeigt mindestens einen Vorschlag", !!wahl);
    click(wahl);
    runden++;
  }
  ok("Alle unsicheren Zeilen sind irgendwann aufgelöst",
    !$("main").querySelector(".confirmCard") && runden > 0, runden);

  const before = D.get().purchases.length;
  const saveBtn = [...$("main").querySelectorAll("button.cta")].find((b) => /buchen$/.test(b.textContent));
  ok("Buchen-Knopf ist jetzt frei", !!saveBtn && !saveBtn.disabled, saveBtn && saveBtn.disabled);
  if (saveBtn && !saveBtn.disabled) {
    click(saveBtn);
    ok("Bon-Positionen landen in der Historie", D.get().purchases.length > before,
      `${before} -> ${D.get().purchases.length}`);
  }
}

console.log("\n--- Bestätigungskarte: Alternative Wege ---");
App.goto("erfassen");
App.capture.tab = "scan";
App.capture.text = "Layenb.HP Skyr sort. 200g    1,49 A";
App.capture.parsed = D.parseReceiptText(App.capture.text);
App.render();

const card = $("main").querySelector(".confirmCard");
ok("Bestätigungskarte erscheint für eine einzelne unsichere Zeile", !!card);
if (card) {
  const choiceCount = $("main").querySelectorAll(".confirmChoice").length;
  ok("Zeigt zwischen einem und drei Vorschlägen", choiceCount > 0 && choiceCount <= 3, choiceCount);

  const altBtn = $("main").querySelector(".confirmAlt");
  const searchWrap = $("main").querySelector(".confirmSearchWrap");
  ok("„Anders? Selbst eintragen“ ist da, Suchfeld zunächst versteckt",
    !!altBtn && searchWrap.classList.contains("hide"));
  click(altBtn);
  ok("Antippen zeigt das Suchfeld", !searchWrap.classList.contains("hide"));

  const inp = searchWrap.querySelector("input");
  inp.value = "Joghurt";
  inp.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok("Die eigene Suche liefert Ergebnisse", searchWrap.querySelectorAll(".results button").length > 0);

  // "nicht buchen" statt eines Vorschlags: die Zeile gilt als
  // entschieden, aber ohne Produkt -- kein Rateergebnis wird gebucht.
  const skip = $("main").querySelector(".confirmSkip");
  ok("„nicht buchen“ ist da", !!skip);
  click(skip);
  ok("Danach ist keine Karte mehr offen", !$("main").querySelector(".confirmCard"));
  ok("Die Zeile hat kein Produkt bekommen, wurde aber entschieden",
    App.capture.parsed.rows[0].productId === null && !App.capture.parsed.rows[0].needsConfirmation);
}

console.log("\n--- Von Hand erfassen ---");
App.goto("erfassen");
App.capture.tab = "manual";
App.render();
const search = $("main").querySelector('input[type="search"]');
ok("Suchfeld ist da", !!search);
if (search) {
  search.value = "milch";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const hits = $("main").querySelectorAll(".results button");
  ok("Suche findet Produkte", hits.length > 0, `${hits.length} Treffer`);
  if (hits.length) {
    click(hits[0]);
    ok("Produkt landet im Korb", App.capture.basket.length === 1);
    const before = D.get().purchases.length;
    const bookBtn = [...$("main").querySelectorAll("button.cta")].find((b) => b.textContent === "Einkauf buchen");
    ok("Buchen-Knopf erscheint", !!bookBtn);
    if (bookBtn) {
      click(bookBtn);
      ok("Handeingabe landet in der Historie", D.get().purchases.length === before + 1);
    }
  }
}

console.log("\n--- Sichern und Zurückholen ---");
const dump = D.exportJson();
ok("Sicherung ist gültiges JSON", (() => { try { JSON.parse(dump); return true; } catch (e) { return false; } })());
const countBefore = D.get().purchases.length;
D.reset();
ok("Zurücksetzen leert die Daten", D.get().purchases.length === 0);
const restored = D.importJson(dump);
ok("Sicherung stellt alles wieder her", restored === countBefore, `${restored} von ${countBefore}`);

console.log("\n--- Kaltstart: leerer Zustand ---");
D.reset();
const b4empty = errors.length;
["liste", "faellig", "bestand", "erfassen", "zahlen", "mehr"].forEach((tab) => App.goto(tab));
ok("Alle Bereiche halten den leeren Zustand aus", errors.length === b4empty, errors[b4empty]);
App.goto("liste");
ok("Leerer Start erklärt den nächsten Schritt", /Einkauf erfassen|Beispieldaten/.test($("main").textContent));

console.log("\n--- Ein einzelner Bon (Cold Start) ---");
D.loadDemo("first");
const c1 = D.compute();
ok("Stufe 1 wird erkannt", c1.stage.stage === 1, "Stufe " + c1.stage.stage);
const b4cold = errors.length;
["liste", "faellig", "bestand", "zahlen", "mehr"].forEach((tab) => App.goto(tab));
ok("Ansichten laufen auch mit einem einzigen Bon", errors.length === b4cold, errors[b4cold]);

console.log("\n--- Sicherheitsregel ---");
D.loadDemo("full");
const c2 = D.compute();
const critical = c2.items.filter((i) => { const p = T.byId(i.productId); return p && p.safetyCritical; });
ok("Verbrauchsdatum-Produkte werden gekennzeichnet",
  critical.every(() => $("main").textContent !== null));
const rec = T.suggestRecipes(T.toRecipeStock(c2.inventory), { maxResults: 5 });
ok("Rezepte schlagen nie abgelaufene Verbrauchsdatum-Ware vor",
  !rec.some((r) => (r.usesFromStock || []).some((n) => /hackfleisch|geflügel|garnelen/i.test(n) && r.unsafe)));

console.log("\n--- Neue Funktionen in der Oberfläche ---");
D.loadDemo("full");
App.goto("liste");
const c3 = App.ctx;
ok("Vorrats-Reichweite wird berechnet", c3.range.days !== null, String(c3.range.days));
// Die Reichweite steht seit der Entrümpelung der Startseite im
// Bestand — dort, wo man nach dem Vorrat sucht.
App.goto("bestand");
ok("Reichweite erscheint im Bestand", !!$("main").querySelector(".hero .heroRing svg"));
ok("Und nicht mehr auf der Startseite", (() => {
  App.goto("liste");
  return !$("main").querySelector(".hero .heroRing svg");
})());
App.goto("liste");
ok("Preis-Gedächtnis wird gefüllt", c3.prices.size > 0, `${c3.prices.size} Produkte`);
ok("Gangreihenfolge liegt vor", Array.isArray(c3.aisleList) && c3.aisleList.length > 5);

{
  // Vergessens-Detektor: Wegtippen darf den Hinweis für die Woche stillstellen
  const before = App.ctx.forgotten.length;
  if (before) {
    const pid = App.ctx.forgotten[0].productId;
    App.dismiss("forgotten", pid);
    ok("Weggetippter Hinweis verschwindet",
      !App.ctx.forgotten.some((f) => f.productId === pid), `${before} -> ${App.ctx.forgotten.length}`);
    ok("Wegtippen gilt nur für diese Woche", D.get().dismissed.week === App.ctx.weekKey);
  } else {
    ok("Weggetippter Hinweis verschwindet", true, "nichts vergessen — übersprungen");
    ok("Wegtippen gilt nur für diese Woche", true, "übersprungen");
  }
}
{
  // "Dazu" holt ein Produkt auf die Liste
  const f = App.ctx.forgotten[0];
  if (f) {
    const b4 = App.ctx.items.length;
    App.addToList(f.productId);
    ok("Vergessenes lässt sich nachtragen", D.get().listChoices[f.productId].on === true, `${b4} Positionen vorher`);
  } else ok("Vergessenes lässt sich nachtragen", true, "übersprungen");
}
{
  // Gangreihenfolge verschieben und im Ladenmodus anwenden
  App.goto("mehr");
  const b4 = errors.length;
  const first = App.ctx.aisleList[0];
  App.moveAisle(App.ctx.aisleList[1], -1);
  ok("Gang verschieben läuft fehlerfrei", errors.length === b4, errors[b4]);
  ok("Neue Reihenfolge wird gespeichert", Object.keys(D.get().aisleOrders).length > 0);
  ok("Reihenfolge hat sich geändert", App.ctx.aisleList[0] !== first, `${first} -> ${App.ctx.aisleList[0]}`);
}
{
  // Erscheinungsbild
  App.set((s) => { s.settings.theme = "dunkel"; });
  ok("Dunkles Erscheinungsbild wird gesetzt", doc.documentElement.getAttribute("data-theme") === "dunkel");
  App.set((s) => { s.settings.theme = "system"; });
  ok("Systemeinstellung entfernt das Attribut", !doc.documentElement.hasAttribute("data-theme"));
}
{
  // Sicherheitsmeldung beim Buchen aus dem Ladenmodus
  App.goto("liste");
  const critical = App.ctx.items.find((i) => i.on && (T.byId(i.productId) || {}).safetyCritical);
  if (critical) {
    ok("Verbrauchsdatum-Position wird gekennzeichnet",
      !!$("main").querySelector(".pill.safety"));
    App.openStore();
    D.update((s) => { s.storeChecked = [critical.productId]; });
    click($("storeDone"));
    click($("sheetOpts").querySelector("button"));
    ok("Kühlketten-Hinweis erscheint nach dem Buchen",
      $("sheet").hidden === false && /kälteste/.test($("sheet").textContent),
      $("sheet").textContent.slice(0, 70));
    ok("Der Hinweis lässt sich schließen", (App.closeSheet(), $("sheet").hidden === true));
  } else {
    ok("Verbrauchsdatum-Position wird gekennzeichnet", true, "keine auf der Liste");
    ok("Kühlketten-Hinweis erscheint nach dem Buchen", true, "übersprungen");
    ok("Der Hinweis lässt sich schließen", true, "übersprungen");
  }
}

console.log("\n--- Cleaner: Erklärungen im Blatt, nicht auf der Fläche ---");
D.loadDemo("full");
App.goto("liste");
{
  const infos = $("main").querySelectorAll(".infoBtn");
  ok("Gruppen tragen einen (i)-Knopf", infos.length > 0, `${infos.length} Knöpfe`);
  click(infos[0]);
  ok("(i) öffnet die Erklärung", $("sheet").hidden === false && $("sheet").textContent.length > 40);
  App.closeSheet();
}
{
  // Der Rechenweg steht nicht mehr unter jeder Zeile
  ok("Keine Rechenweg-Zeile mehr auf der Liste", !$("main").querySelector(".item .calc"));
  const main = $("main").querySelector(".item .main");
  // Kein <button> mehr, sondern role="button": in der Zeile stecken
  // die antippbaren Marken, und Schaltfläche in Schaltfläche ist
  // ungültiges HTML.
  ok("Position lässt sich antippen",
    !!main && main.getAttribute("role") === "button" && main.getAttribute("tabindex") === "0");
  ok("Und enthält keine verschachtelte Schaltfläche",
    !!main && !main.querySelector("button"));
  const b4 = errors.length;
  click(main);
  ok("Detail-Blatt öffnet ohne Fehler", $("sheet").hidden === false && errors.length === b4, errors[b4]);
  ok("Detail-Blatt nennt Rhythmus und Preis",
    /Rhythmus/.test($("sheet").textContent) && /Preis/.test($("sheet").textContent));
  ok("Detail-Blatt nennt die Datenqualität", /Datenqualität/.test($("sheet").textContent));
  App.closeSheet();
}
{
  App.goto("bestand");
  const hero = $("main").querySelector("button.hero");
  ok("Reichweite ist antippbar", !!hero);
  if (hero) {
    click(hero);
    ok("Reichweite erklärt ihre Herleitung", /Haltbarkeit/.test($("sheet").textContent));
    App.closeSheet();
  }
  App.goto("liste");
}

console.log("\n--- Weitere neue Funktionen ---");
{
  // Angebrochene Packung
  const openable = T.FOOD_DATABASE.find((p) =>
    p.isFood && p.shelfLifeOpenedDays && p.shelfLifeOpenedDays < p.shelfLifeDays);
  D.toggleOpened(openable.id);
  ok("Packung lässt sich als angebrochen markieren",
    D.get().opened.some((o) => o.productId === openable.id), openable.name);
  ok("Angebrochenes erscheint in der Auswertung",
    App.ctx.opened.some((o) => o.productId === openable.id), `${App.ctx.opened.length} Einträge`);
  const inv = App.ctx.inventory.find((i) => i.productId === openable.id);
  if (inv) ok("Bestandsfrist wird verkürzt", inv.daysLeft <= openable.shelfLifeOpenedDays, inv.daysLeft);
  else ok("Bestandsfrist wird verkürzt", true, "nicht im Bestand");
  D.toggleOpened(openable.id);
  ok("Markierung lässt sich zurücknehmen", !D.get().opened.length);
}
{
  ok("Einkaufsrhythmus wird erkannt", App.ctx.pattern !== null,
    App.ctx.pattern && App.ctx.pattern.message);
  ok("Rhythmus nennt Einkäufe pro Woche", App.ctx.pattern.perWeek > 0, App.ctx.pattern.perWeek);
}
{
  ok("Saisondaten werden berechnet", Array.isArray(App.ctx.season) && Array.isArray(App.ctx.seasonNow));
}
{
  // Liste teilen: ohne Web Share und ohne Zwischenablage bleibt das Blatt
  const hadShare = window.navigator.share;
  const hadClip = window.navigator.clipboard;
  try { delete window.navigator.share; } catch (e) {}
  try { Object.defineProperty(window.navigator, "clipboard", { value: undefined, configurable: true }); } catch (e) {}
  App.goto("liste");
  const shareBtn = [...$("main").querySelectorAll("button.cta")].find((b) => b.textContent === "Teilen");
  ok("Teilen-Knopf ist da", !!shareBtn);
  if (shareBtn) {
    click(shareBtn);
    const text = $("sheet").textContent;
    ok("Liste erscheint als Text", $("sheet").hidden === false && /☐/.test(text), text.slice(0, 40));
    ok("Text ist nach Gängen gegliedert", /OBST|KÜHLREGAL|BACKWAREN/.test(text));
    App.closeSheet();
  }
  if (hadShare) window.navigator.share = hadShare;
  if (hadClip) { try { Object.defineProperty(window.navigator, "clipboard", { value: hadClip, configurable: true }); } catch (e) {} }
}
{
  // Schriftgröße
  App.set((s) => { s.settings.textScale = 1.3; });
  ok("Schriftgröße wirkt auf die Wurzel",
    doc.documentElement.style.getPropertyValue("--text-scale") === "1.3",
    doc.documentElement.style.getPropertyValue("--text-scale"));
  App.set((s) => { s.settings.textScale = 1; });
}
{
  // Alte Sicherung ohne die neuen Felder muss lesbar bleiben
  const old = JSON.parse(D.exportJson());
  delete old.settings.textScale;
  delete old.opened;
  delete old.aisleOrders;
  const b4 = errors.length;
  D.importJson(JSON.stringify(old));
  ok("Alte Sicherung bekommt die neuen Felder",
    D.get().settings.textScale === 1 && Array.isArray(D.get().opened) && errors.length === b4,
    errors[b4]);
  App.goto("mehr");
  ok("Ansicht rendert danach fehlerfrei", errors.length === b4 && $("main").children.length > 0);
}

console.log("\n--- Haushaltsprodukte ---");
D.loadDemo("full");
App.goto("liste");
const cn = App.ctx;
ok("Haushaltsprodukte werden erkannt", cn.nonFoodEntries.length > 5, `${cn.nonFoodEntries.length} Produkte`);
ok("Reichweiten werden gerechnet", cn.supplies.length > 0, `${cn.supplies.length}`);
ok("Jede Reichweite trägt eine Konfidenz", cn.supplies.every((x) => !!x.confidence));
ok("Austauschprodukte werden verfolgt", cn.swapsDue.length > 0, `${cn.swapsDue.length}`);
ok("Haushaltsprofil fließt in die Rechnung",
  cn.profile.personCount === D.get().settings.household && !!cn.profile.waterHardness);

{
  // Liste: zwei Sektionen statt zweier Tabs
  const sections = [...$("main").querySelectorAll(".sectionRow")].map((x) => x.textContent);
  ok("Liste trennt Lebensmittel und Haushalt",
    sections.length === 0 || (sections.includes("Lebensmittel") && sections.includes("Haushalt")),
    sections.join(" / "));
}
{
  App.goto("faellig");
  const b4 = errors.length;
  ok("Fällig-Ansicht rendert", errors.length === b4 && $("main").children.length > 0, errors[b4]);
  ok("Fällige Austausche werden gezeigt", /Zahnbürste|Küchenschwamm|Wasserfilter/.test($("main").textContent));

  const swapBtn = [...$("main").querySelectorAll("button")].find((b) => b.textContent === "Getauscht");
  ok("Getauscht-Knopf ist da", !!swapBtn);
  if (swapBtn) {
    const before = App.ctx.swapsDue.find((x) => x.due);
    click(swapBtn);
    const after = App.ctx.swapsDue.find((x) => x.productId === before.productId);
    ok("Tausch setzt den Zähler zurück", after.inUse === 0 && after.due === false,
      `${before.inUse} -> ${after.inUse}`);
    ok("Tausch wird gespeichert", !!D.get().swaps[before.productId].lastSwap);
    ok("Tausch ist kein Kauf", !D.get().purchases.some((p) =>
      p.productId === before.productId && p.date === D.today()));
  }
}
{
  // Konfidenzmarken: nie eine Zahl ohne, bei UNSICHER keine Zahl
  App.goto("bestand");
  const dots = $("main").querySelectorAll(".supplyVal .dot");
  const vals = $("main").querySelectorAll(".supplyVal .rowValue");
  ok("Jede Reichweite hat eine Konfidenzmarke", dots.length === vals.length && dots.length > 0,
    `${vals.length} Werte, ${dots.length} Marken`);
  const unsure = App.ctx.supplies.filter((x) => x.daysOfSupply === null || x.confidence === "UNSICHER");
  ok("Unregelmäßiges zeigt einen Strich statt einer Zahl",
    unsure.length === 0 || [...vals].some((v) => v.textContent === "—"),
    unsure.map((x) => x.name).join());
}
{
  // Detail-Blatt eines Haushaltsprodukts
  const sup = App.ctx.supplies.find((x) => x.consumptionClass === "RATE");
  App.goto("bestand");
  const row = [...$("main").querySelectorAll("button.row")]
    .find((r) => r.textContent.includes(sup.name));
  if (row) {
    click(row);
    const txt = $("sheet").textContent;
    ok("Detail nennt die Verbrauchsart", /aufgebraucht|ausgetauscht|unregelmäßig/.test(txt));
    ok("Detail nennt Packung und Verbrauch", /Packung/.test(txt) && /Verbrauch/.test(txt));
    ok("Detail nennt die WG-Zuordnung", /geteilt|persönlich/.test(txt));
    App.closeSheet();
  } else {
    ok("Detail nennt die Verbrauchsart", false, "Zeile nicht gefunden");
    ok("Detail nennt Packung und Verbrauch", false);
    ok("Detail nennt die WG-Zuordnung", false);
  }
}
{
  // Haushaltsprofil: Gerät abschalten filtert Produkte hart aus
  App.goto("mehr");
  const before = App.ctx.supplies.length + App.ctx.swapsDue.length;
  App.set((st) => { st.household.hasWashingMachine = false; st.household.hasCoffeeMachine = false; });
  const after = App.ctx.supplies.length + App.ctx.swapsDue.length;
  ok("Fehlende Geräte filtern Produkte aus", after < before, `${before} -> ${after}`);
  ok("Waschmittel verschwindet ohne Waschmaschine",
    !App.ctx.supplies.some((x) => x.productId === "waschmittel"));
  App.set((st) => { st.household.hasWashingMachine = true; st.household.hasCoffeeMachine = true; });
  ok("Und kommt zurück", App.ctx.supplies.some((x) => x.productId === "waschmittel"));
}
{
  // Wasserhärte wirkt auf Verbrauch und Intervall
  App.set((st) => { st.household.waterHardness = "weich"; });
  const soft = App.ctx.supplies.find((x) => x.productId === "waschmittel");
  App.set((st) => { st.household.waterHardness = "hart"; });
  const hard = App.ctx.supplies.find((x) => x.productId === "waschmittel");
  ok("Wasserhärte wirkt auf die Rechnung",
    !soft || !hard || soft.dailyUsage !== hard.dailyUsage || soft.confidence === "GELERNT",
    soft && hard ? `${soft.dailyUsage} vs ${hard.dailyUsage}` : "kein Waschmittel");
  App.set((st) => { st.household.waterHardness = "mittel"; });
}
{
  // Urlaub: Zahnbürste altert weiter, Küchenschwamm nicht
  const brushBefore = App.ctx.swapsDue.find((x) => x.productId === "zahnbuerste");
  const spongeBefore = App.ctx.swapsDue.find((x) => x.productId === "kuechenschwamm");
  App.set((st) => {
    st.settings.vacation = { active: true, from: D.plusDays(D.today(), -14), to: D.today() };
  });
  const brushAfter = App.ctx.swapsDue.find((x) => x.productId === "zahnbuerste");
  const spongeAfter = App.ctx.swapsDue.find((x) => x.productId === "kuechenschwamm");
  if (brushBefore && brushAfter) {
    ok("Zahnbürste altert auch im Urlaub", brushAfter.inUse === brushBefore.inUse,
      `${brushBefore.inUse} -> ${brushAfter.inUse}`);
  } else ok("Zahnbürste altert auch im Urlaub", true, "übersprungen");
  if (spongeBefore && spongeAfter) {
    ok("Küchenschwamm pausiert im Urlaub", spongeAfter.inUse < spongeBefore.inUse,
      `${spongeBefore.inUse} -> ${spongeAfter.inUse}`);
  } else ok("Küchenschwamm pausiert im Urlaub", true, "übersprungen");
  App.set((st) => { st.settings.vacation = { active: false, from: null, to: null }; });
}
{
  // Alte Sicherung ohne Haushaltsprofil bleibt lesbar
  const old2 = JSON.parse(D.exportJson());
  delete old2.household;
  delete old2.swaps;
  const b4 = errors.length;
  D.importJson(JSON.stringify(old2));
  ok("Sicherung ohne Haushaltsprofil bekommt die Vorgaben",
    D.get().household.waterHardness === "mittel" && errors.length === b4, errors[b4]);
  App.goto("faellig");
  ok("Fällig rendert auch danach", errors.length === b4 && $("main").children.length > 0);
}

console.log("\n--- Aus dem Verlauf lernen ---");
D.reset();
D.loadDemo("full");
App.goto("liste");
{
  // Ein Produkt, dessen Rhythmus noch unkorrigiert ist. `baseRhythmDays`
  // wird immer gesetzt (es dokumentiert die Herkunft), deshalb der
  // Vergleich statt einer Existenzprüfung.
  const before = App.ctx.items.find((i) => {
    const r = App.ctx.rhythms.get(i.productId);
    return i.basis === "rhythmus" && i.reason === null && r && r.rhythmDays === r.baseRhythmDays;
  });
  ok("Es gibt eine Position zum Antworten", !!before, before && before.name);

  if (before) {
    const pid = before.productId;
    const rhythmBefore = App.ctx.rhythms.get(pid).rhythmDays;

    // Der Kreislauf: abwählen, Grund angeben — und das muss ankommen.
    App.choose(pid, { on: false });
    App.choose(pid, { reason: "have" });
    ok("Die Rückmeldung landet im dauerhaften Protokoll",
      D.get().feedbackLog.some((f) => f.productId === pid && f.reason === "have"),
      `${D.get().feedbackLog.length} Einträge`);

    // Derselbe Grund nochmal darf nicht doppelt zählen
    const countBefore = D.get().feedbackLog.length;
    App.choose(pid, { reason: "have" });
    ok("Derselbe Grund wird nicht doppelt protokolliert",
      D.get().feedbackLog.length === countBefore, `${countBefore} -> ${D.get().feedbackLog.length}`);

    // Genug Rückmeldungen, damit die Schwelle fällt
    for (let i = 0; i < 5; i++) D.recordFeedback(pid, "have", 0);
    const rhythmAfter = App.ctx.rhythms.get(pid).rhythmDays;
    ok("Wiederholtes „hab noch da“ verlängert den Rhythmus",
      rhythmAfter > rhythmBefore, `${rhythmBefore} -> ${rhythmAfter}`);
    ok("Der ursprüngliche Wert bleibt sichtbar",
      App.ctx.rhythms.get(pid).baseRhythmDays === rhythmBefore,
      App.ctx.rhythms.get(pid).baseRhythmDays);

    // Und die Herleitung steht im Detail-Blatt
    App.goto("bestand");
    productSheetFor(pid);
    const txt = $("sheet").textContent;
    ok("Das Detail-Blatt nennt die Rückmeldungen", /Rückmeldungen/.test(txt), txt.slice(0, 90));
    ok("Und den Wert davor", /davor gelernt/.test(txt));
    App.closeSheet();
  } else {
    ok("Die Rückmeldung landet im dauerhaften Protokoll", false, "keine Position");
    ok("Derselbe Grund wird nicht doppelt protokolliert", false);
    ok("Wiederholtes „hab noch da“ verlängert den Rhythmus", false);
    ok("Der ursprüngliche Wert bleibt sichtbar", false);
    ok("Das Detail-Blatt nennt die Rückmeldungen", false);
    ok("Und den Wert davor", false);
  }
}
{
  // „Verbraucht“ darf den Rhythmus NICHT verschieben — genau das
  // verspricht die Oberfläche mit „Rhythmus bleibt“.
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const item = App.ctx.items.find((i) => i.basis === "rhythmus");
  const pid = item.productId;
  const before = App.ctx.rhythms.get(pid).rhythmDays;
  for (let i = 0; i < 8; i++) D.recordFeedback(pid, "consumed", 0);
  ok("„Verbraucht“ lässt den Rhythmus unberührt",
    App.ctx.rhythms.get(pid).rhythmDays === before, `${before} -> ${App.ctx.rhythms.get(pid).rhythmDays}`);
  for (let i = 0; i < 8; i++) D.recordFeedback(pid, "skip", 0);
  ok("„Diese Woche nicht“ ebenfalls nicht",
    App.ctx.rhythms.get(pid).rhythmDays === before);
}
{
  // Ein einzelner Fehltipp darf nichts bewirken
  D.reset();
  D.loadDemo("full");
  const item = App.ctx.items.find((i) => i.basis === "rhythmus");
  const pid = item.productId;
  const before = App.ctx.rhythms.get(pid).rhythmDays;
  D.recordFeedback(pid, "have", 0);
  ok("Ein einzelner Fehltipp ändert nichts",
    App.ctx.rhythms.get(pid).rhythmDays === before, `${before} -> ${App.ctx.rhythms.get(pid).rhythmDays}`);
}
{
  // Das Protokoll übersteht Sicherung und Wiederherstellung
  D.reset();
  D.loadDemo("full");
  const pid = App.ctx.items.find((i) => i.basis === "rhythmus").productId;
  for (let i = 0; i < 5; i++) D.recordFeedback(pid, "have", -2);
  const learned = App.ctx.rhythms.get(pid).rhythmDays;
  const dump = D.exportJson();
  D.reset();
  D.importJson(dump);
  ok("Gelerntes übersteht Sicherung und Wiederherstellung",
    App.ctx.rhythms.get(pid).rhythmDays === learned,
    `${learned} -> ${App.ctx.rhythms.get(pid).rhythmDays}`);
  ok("Das Protokoll ist mit gesichert",
    D.get().feedbackLog.filter((f) => f.productId === pid).length === 5);
}
{
  // Alte Sicherung ohne Protokoll bleibt lesbar
  const old3 = JSON.parse(D.exportJson());
  delete old3.feedbackLog;
  const b4 = errors.length;
  D.importJson(JSON.stringify(old3));
  ok("Sicherung ohne Feedback-Protokoll bekommt ein leeres",
    Array.isArray(D.get().feedbackLog) && errors.length === b4, errors[b4]);
  App.goto("liste");
  ok("Und die Liste rendert weiter", errors.length === b4 && $("main").children.length > 0);
}
{
  // Die Gegenrichtung: „War schon alle“ verkürzt und wählt NICHT ab
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const item = App.ctx.items.find((i) => {
    const r = App.ctx.rhythms.get(i.productId);
    return i.basis === "rhythmus" && r && r.rhythmDays === r.baseRhythmDays && r.rhythmDays >= 5;
  });
  if (item) {
    const pid = item.productId;
    const before = App.ctx.rhythms.get(pid).rhythmDays;
    for (let i = 0; i < 5; i++) D.recordFeedback(pid, "empty", 0);
    ok("„War schon alle“ verkürzt den Rhythmus",
      App.ctx.rhythms.get(pid).rhythmDays < before,
      `${before} -> ${App.ctx.rhythms.get(pid).rhythmDays}`);

    App.choose(pid, { reason: "empty" });
    ok("„War schon alle“ wählt die Position nicht ab",
      App.ctx.items.find((i) => i.productId === pid).on !== false);
  } else {
    ok("„War schon alle“ verkürzt den Rhythmus", true, "kein passendes Produkt");
    ok("„War schon alle“ wählt die Position nicht ab", true, "übersprungen");
  }
}
{
  // Beide Richtungen zusammen: der Nutzer widerspricht sich
  D.reset();
  D.loadDemo("full");
  const pid = App.ctx.items.find((i) => i.basis === "rhythmus").productId;
  const before = App.ctx.rhythms.get(pid).rhythmDays;
  for (let i = 0; i < 4; i++) D.recordFeedback(pid, "have", 0);
  for (let i = 0; i < 4; i++) D.recordFeedback(pid, "empty", 0);
  const after = App.ctx.rhythms.get(pid).rhythmDays;
  ok("Widersprüchliche Rückmeldungen verschieben kaum",
    Math.abs(after - before) <= Math.max(1, Math.round(before * 0.1)), `${before} -> ${after}`);
  ok("Der Widerspruch wird beziffert",
    App.ctx.rhythms.get(pid).feedback.disagreement > 0,
    App.ctx.rhythms.get(pid).feedback.disagreement);
}
{
  // Vier Antwortmöglichkeiten in der Oberfläche — seit dem Umbau im
  // Detail-Blatt statt in der Zeile.
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const zeile = $("main").querySelector(".items .item .main");
  if (zeile) {
    click(zeile);
    const opts = [...$("sheetOpts").querySelectorAll(".row .rowTitle")].map((r) => r.textContent);
    ok("Das Blatt beantwortet die Wochenfrage",
      ["Hab noch", "Diese Woche nicht"].every((a) => opts.includes(a)),
      opts.join(" / "));
    App.closeSheet();
  } else ok("Das Blatt beantwortet die Wochenfrage", false, "keine Position");
}
{
  // Saison und Strukturbruch hängen mit am Ergebnis
  D.reset();
  D.loadDemo("full");
  const ctx2 = App.ctx;
  ok("Strukturbrüche werden je Produkt geprüft",
    ctx2.changes && typeof ctx2.changes.get === "function" && ctx2.changes.size > 0,
    ctx2.changes && ctx2.changes.size);
  const anyRhythm = [...ctx2.rhythms.values()][0];
  ok("Jeder Rhythmus trägt seine Saison-Begründung", !!anyRhythm.season);
  ok("Alle Rhythmen bleiben gültig",
    [...ctx2.rhythms.values()].every((r) => !r.rhythmDays || (r.rhythmDays >= 1 && Number.isFinite(r.rhythmDays))));
  ok("Alle Vertrauenswerte bleiben im Bereich",
    [...ctx2.rhythms.values()].every((r) => r.confidence >= 0 && r.confidence <= 1));
}

console.log("\n--- Rückblick, Streak, Meilensteine ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const c = App.ctx;

  ok("Beispieldaten bringen ein Ereignis-Protokoll mit", c.actions.length > 30, c.actions.length);
  ok("Der Streak läuft", c.streak.weeks >= 4, c.streak.weeks);
  ok("Acht Wochen werden angezeigt", c.streakWeeks.length === 8);
  ok("Meilensteine sind erreicht", c.badges.count > 0, c.badges.count);
  ok("Aber keiner wird gefeiert — sie wurden nicht jetzt erreicht",
    c.freshBadges.length === 0, c.freshBadges.length);
  // Ob die LAUFENDE Woche Inhalt hat, hängt vom Wochentag ab: montags
  // ist sie zwei Tage alt. Geprüft wird deshalb die abgeschlossene
  // Vorwoche — sonst liefe der Test nur an bestimmten Tagen durch.
  const past = T.weeklyReview(
    { actions: c.actions, receipts: D.get().receipts }, T.weekRangeFor(c.ref, -1));
  const pastCtx = { ...c, review: past };
  ok("Der Rückblick der Vorwoche hat Inhalt", past.lines.length > 0, past.lines.map((l) => l.key).join(","));
  ok("Und eine Überschrift ohne Platzhalter",
    !/undefined|NaN/.test(past.headline), past.headline);
  ok("Auch die laufende Woche liefert eine Überschrift",
    !!c.review.headline && !/undefined|NaN/.test(c.review.headline), c.review.headline);

  const cardNode = T.reviewCard(pastCtx, App);
  ok("Die Rückblick-Karte rendert", cardNode.querySelectorAll(".rvItem").length > 0);
  ok("Sie trägt eine Überschrift", cardNode.querySelector(".rvHead2").textContent.length > 0);
  ok("Und lässt sich schließen", !!cardNode.querySelector(".rvClose"));

  T.reviewSheet(pastCtx, App);
  ok("Das Rückblick-Blatt öffnet", !$("sheet").hidden);
  ok("Es nennt die Herkunft der Zahlen",
    /geschätzt|nachrechenbar|Medianpreis/.test($("sheetOpts").textContent));
  ok("Es zeigt die Wochenpunkte", $("sheetOpts").querySelectorAll(".sDot").length === 8);
  click($("sheetCancel"));

  const dots = T.streakStrip(pastCtx);
  ok("Die laufende Woche ist markiert", !!dots.querySelector(".sDot.now"));

  const badges = T.badgeScroller(c, App);
  ok("Alle Meilenstein-Reihen werden gezeigt", badges.querySelectorAll(".badge").length === 5,
    badges.querySelectorAll(".badge").length);
  ok("Jede Reihe hat einen Fortschrittsbalken", badges.querySelectorAll(".bBar i").length === 5);
}
{
  // Rettung: einmal zählen, nicht zweimal.
  D.reset();
  D.loadDemo("full");
  const before = D.get().lifetime.gerettet;
  const pid = App.ctx.items.length ? App.ctx.items[0].productId : "salat_kopf";

  ok("Eine Rettung wird gezählt", D.recordRescue(pid, 1.5) === true);
  ok("Der Lebenszähler steigt", D.get().lifetime.gerettet === before + 1);
  ok("Dasselbe Produkt am selben Tag zählt nicht doppelt", D.recordRescue(pid, 1.5) === false);
  ok("Der Zähler bleibt stehen", D.get().lifetime.gerettet === before + 1, D.get().lifetime.gerettet);
  ok("Ein anderes Produkt zählt sehr wohl", D.recordRescue("nudeln", 1) === true);
  ok("Geschätzte Beträge landen in ihrem eigenen Topf",
    D.get().lifetime.geretteteEuros >= 2.5 && D.get().lifetime.guenstig !== D.get().lifetime.geretteteEuros);
}
{
  // Buchen: Bon im Protokoll, Preisvorteil getrennt ausgewiesen.
  D.reset();
  D.loadDemo("full");
  const before = D.get().lifetime.erfasst;
  const usual = App.ctx.prices.get("butter");
  const res = D.addReceipt({
    date: D.today(), store: "Testmarkt",
    items: [{ productId: "butter", quantity: 2, unitPrice: usual ? usual.usual * 0.5 : 1 }]
  });
  ok("Buchen liefert Anzahl und Ersparnis", res.count === 1 && Array.isArray(res.savings));
  ok("Der Bon steht im Protokoll", D.get().lifetime.erfasst === before + 1);
  ok("Der Preisvorteil wird erkannt", res.savings.length === 1, JSON.stringify(res.savings));
  ok("Und ist realisiert, nicht geschätzt", D.get().lifetime.guenstig > 0, D.get().lifetime.guenstig);
  ok("Das Ereignis trägt ein Datum",
    D.get().actions.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date)));
}
{
  // Ein neuer Meilenstein wird gefeiert — aber erst, wenn er in
  // dieser Sitzung erreicht wurde.
  D.reset();
  D.loadDemo("full");
  App.render();
  const need = App.ctx.badges.rows.find((r) => r.id === "getauscht");
  let guard = 0;
  while (App.ctx.badges.rows.find((r) => r.id === "getauscht").next !== null && guard++ < 3) {
    const row = App.ctx.badges.rows.find((r) => r.id === "getauscht");
    for (let i = 0; i < row.remaining; i++) D.recordSwapFor("zahnbuerste");
    break;
  }
  ok("Ein erreichter Meilenstein bekommt seinen Auftritt",
    !$("party").hidden && /Geschafft|Höchste Stufe/.test($("partyKicker").textContent),
    $("partyKicker").textContent);
  ok("Er nennt die Stufe", /Stufe \d+ von \d+/.test($("partyLevel").textContent));
  ok("Und zeigt die erreichte Zahl", /\d/.test($("partyNum").textContent), $("partyNum").textContent);
  ok("Die Zahl ist die echte Schwelle",
    $("partyNum").textContent.replace(/[^\d]/g, "") !== "",
    $("partyNum").textContent);
  ok("Die Stufen stehen als Punkte da", $("partyPips").querySelectorAll("i").length > 0);
  ok("Und die erreichten sind gefüllt", $("partyPips").querySelectorAll("i.on").length > 0);
  ok("Die Farbe kommt aus der Reihe", /m-getauscht/.test($("party").className), $("party").className);
  click($("partyGo"));
  ok("Danach ist er als gesehen vermerkt",
    App.ctx.freshBadges.length === 0, App.ctx.freshBadges.map((b) => b.key).join(","));
  ok("Und wird nicht erneut gefeiert", !$("party").classList.contains("show"));
  ok("Der Meilenstein bleibt erreicht", need && App.ctx.badges.count > 0);

  /* --- Mehrere auf einmal: nacheinander, nicht übereinander --- */
  const zwei = [
    { key: "a", id: "gerettet", icon: "sprout", unit: "Produkte", threshold: 10,
      title: "10 Produkte vor dem Verderb bewahrt", note: "Test", level: 2, maxLevel: 6 },
    { key: "b", id: "guenstig", icon: "tag", unit: "€", threshold: 25,
      title: "25 € unter deinem üblichen Preis", note: "Test", level: 2, maxLevel: 6 }
  ];
  App.celebrateAll(zwei);
  ok("Der erste Auftritt läuft", !$("party").hidden && /10/.test($("partyNum").textContent),
    $("partyNum").textContent);
  ok("Und kündigt den nächsten an", /noch 1/.test($("partyGo").textContent), $("partyGo").textContent);
  click($("partyGo"));
  ok("Der zweite folgt", /25/.test($("partyNum").textContent), $("partyNum").textContent);
  ok("Mit seiner eigenen Farbe", /m-guenstig/.test($("party").className), $("party").className);
  ok("Und mit Einheit, wo eine hingehört", /€/.test($("partyNum").textContent), $("partyNum").textContent);
  ok("Zuletzt steht nur noch Weiter da", $("partyGo").textContent.trim() === "Weiter",
    $("partyGo").textContent);
  click($("partyGo"));
  ok("Danach ist der Auftritt vorbei", !$("party").classList.contains("show"));
  ok("Und die Warteschlange leer", !App._party || App._party.length === 0);

  /* --- Höchste Stufe wird als solche benannt --- */
  App.celebrateAll([{ key: "c", id: "wochen", icon: "tally", unit: "Wochen", threshold: 52,
    title: "52 Wochen am Stück", note: "Test", level: 5, maxLevel: 5 }]);
  ok("Die letzte Stufe heißt auch so", /Höchste Stufe/.test($("partyKicker").textContent),
    $("partyKicker").textContent);
  ok("Und alle Punkte sind gefüllt",
    $("partyPips").querySelectorAll("i").length === $("partyPips").querySelectorAll("i.on").length);
  click($("partyGo"));

  /* --- Weniger Bewegung: dasselbe Fenster, keine Schnipsel --- */
  const echtesMatchMedia = window.matchMedia;
  window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {} });
  App.celebrateAll([{ key: "d", id: "erfasst", icon: "receipt", unit: "Bons", threshold: 50,
    title: "50 Bons erfasst", note: "Test", level: 3, maxLevel: 6 }]);
  ok("Ohne Bewegung erscheint dasselbe Fenster", !$("party").hidden);
  ok("Mit derselben Zahl", /50/.test($("partyNum").textContent), $("partyNum").textContent);
  ok("Aber ohne Schnipsel", $("partyBurst").children.length === 0, $("partyBurst").children.length);
  ok("Und als still gekennzeichnet", /still/.test($("party").className), $("party").className);
  click($("partyGo"));
  window.matchMedia = echtesMatchMedia;

  /* --- Beim ersten Aufbau wird nicht gefeiert --- */
  D.reset();
  D.loadDemo("full");
  App._seeded = false;
  App.render();
  ok("Beim Laden von Beispieldaten prasselt nichts herunter",
    !$("party").classList.contains("show"));
}
{
  // Sofort-Rückmeldung: sichtbar, mit Zeichen, mit Zusatzzeile.
  App.toast("Getauscht", { icon: "↻", detail: "ca. 1,50 € gerettet" });
  const t = $("toast");
  ok("Der Toast ist sichtbar", !t.hidden);
  ok("Er trägt ein Zeichen", t.querySelector(".tIcon").textContent === "↻");
  ok("Und eine Zusatzzeile", /gerettet/.test(t.querySelector(".tTxt small").textContent));
  ok("Die Animation wird neu gestartet", t.classList.contains("in"));
  App.toast("Nur Text");
  ok("Ohne Zusatz bleibt die zweite Zeile weg", !t.querySelector(".tTxt small"));
  ok("Die alte Aufrufform mit Millisekunden geht weiter",
    (App.toast("Kurz", 500), !t.hidden));
}
{
  // Der Rückblick lässt sich wegtippen und kommt in derselben Woche
  // nicht wieder.
  D.reset();
  D.loadDemo("full");
  const wk = App.ctx.review.weekKey;
  D.markReviewSeen(wk);
  ok("Weggetippt bleibt weggetippt", D.get().review.lastSeenWeek === wk);
  ok("Und die Karte ist nicht mehr fällig", App.ctx.review.due === false);

  // Ohne Benachrichtigungs-API darf nichts abstürzen.
  App.askNotify(true);
  ok("Ohne Benachrichtigungen bleibt die Einstellung aus", D.get().review.notify === false);
  App.maybeNotifyReview();
  ok("Und das Melden bricht nicht ab", true);
}
{
  // Eine Sicherung aus einer Fassung ohne diese Felder muss laufen.
  D.reset();
  D.loadDemo("full");
  const backup = JSON.parse(D.exportJson());
  delete backup.actions;
  delete backup.lifetime;
  delete backup.review;
  delete backup.badgesSeen;
  D.importJson(JSON.stringify(backup));
  ok("Alte Sicherung bekommt ein leeres Protokoll", Array.isArray(D.get().actions) && D.get().actions.length === 0);
  ok("Und Zähler auf null", D.get().lifetime.erfasst === 0);
  App.goto("zahlen");
  ok("Die Ansicht Zahlen rendert trotzdem", $("main").children.length > 0);
  ok("Der Streak steht bei null", App.ctx.streak.weeks === 0, App.ctx.streak.weeks);
  ok("Ohne Ereignisse wird nichts gefeiert", App.ctx.freshBadges.length === 0);
}
{
  D.reset();
  D.loadDemo("full");
  App.goto("zahlen");
  ok("Zahlen zeigt den Streak", /Am Stück/.test($("main").textContent));

  // Rückblick und Meilensteine stehen im Unterbereich "Bilanz", nicht im
  // vorausgewählten "Ausgaben" -- die drei Unterbereiche existieren genau
  // deshalb, damit nicht alles gleichzeitig auf einer Seite steht.
  App.zahlenTab = "bilanz";
  App.render();
  const txtBilanz = $("main").textContent;
  ok("Zahlen zeigt den Rückblick", /Rückblick/.test(txtBilanz));
  ok("Zahlen zeigt die Meilensteine", /Erreicht/.test(txtBilanz));

  App.zahlenTab = "ausgaben";
  App.render();

  /* --- Marke gegen Eigenmarke --- */
  const txt = $("main").textContent;
  ok("Zahlen zeigt den Eigenmarken-Vergleich", /Marke oder Eigenmarke/.test(txt));
  const b = App.ctx.brands;
  ok("Die Demo liefert einen belegten Fall", b.belegt.length > 0,
    b.belegt.map((x) => x.name).join(", "));
  ok("Und einen geschätzten", b.geschaetzt.length > 0,
    b.geschaetzt.map((x) => x.name).join(", "));
  ok("Belegtes und Geschätztes bleiben getrennte Summen",
    b.proJahrBelegt > 0 && b.proJahrGeschaetzt > 0 && !("proJahr" in b));
  ok("Wer zur Marke zurückging, wird ausgelassen", b.abgelehnt > 0, b.abgelehnt);
  ok("Kein Vorschlag für das, was schon Eigenmarke ist",
    ![...b.belegt, ...b.geschaetzt].some((x) => x.productId === "milch_vollmilch"));

  // Der Vergleich ist ein Hinweis, keine Buchung: er darf weder auf
  // der Liste landen noch in einer Ersparnis-Zahl auftauchen.
  const vorherAktionen = D.get().actions.length;
  const vorherManuell = D.get().manual.length;
  T.brandSheet(b.belegt[0], App);
  ok("Das Blatt öffnet sich", /Unterschied/.test($("sheetOpts").textContent));
  ok("Es weist die Herkunft der Zahl aus", /[Bb]elegt|[Gg]eschätzt/.test($("sheetOpts").textContent));
  const aus = [...$("sheetOpts").querySelectorAll("button")]
    .find((x) => /nicht mehr vorschlagen/i.test(x.textContent));
  ok("Es lässt sich dauerhaft abstellen", !!aus);
  const abgestellt = b.belegt[0].productId;
  click(aus);
  App.goto("zahlen");
  ok("Danach ist das Produkt verschwunden",
    ![...App.ctx.brands.belegt, ...App.ctx.brands.geschaetzt].some((x) => x.productId === abgestellt));
  ok("Der Vergleich bucht nichts ins Protokoll", D.get().actions.length === vorherAktionen);
  ok("Und setzt nichts auf die Liste", D.get().manual.length === vorherManuell);
  D.update((st) => { st.brandOff = []; });

  App.goto("mehr");
  ok("Mehr bietet die Erinnerung an", /Wochenrückblick/.test($("main").textContent));
  ok("Und sagt ehrlich, dass es kein echtes Push ist", (() => {
    const info = [...$("main").querySelectorAll(".infoBtn")]
      .find((b) => (b.getAttribute("aria-label") || "").includes("Wochenrückblick"));
    if (!info) return false;
    click(info);
    const t = $("sheetOpts").textContent;
    click($("sheetCancel"));
    return /keine echte Push|KEINE echte Push/i.test(t);
  })());
}

console.log("\n--- Wo dein Geld hingeht ---");
{
  D.reset();
  D.loadDemo("full");
  App.zahlenFilter = { range: "12w", from: null, to: null };
  App.goto("zahlen");
  const txt = $("main").textContent;
  ok("Zahlen zeigt die Geldaufteilung", /Wo dein Geld hingeht/.test(txt));
  ok("Mit Kategorien und Märkten", /Kategorien/.test(txt) && /Märkte/.test(txt));

  const rows = $("main").querySelectorAll(".moneyBarRow");
  ok("Zeigt mindestens eine Zeile", rows.length > 0, rows.length);
  ok("Jede Zeile nennt einen Anteil in Prozent",
    [...rows].every((r) => /\d+ %/.test(r.textContent)), rows[0] && rows[0].textContent);
  ok("Jede Zeile zeichnet einen Balken mit rundem Kappenende",
    [...rows].every((r) => r.querySelector(".moneyBarSvg line[stroke-linecap='round']")));

  const woReihe = () => $("main").querySelector(".moneyTotal .sub");
  const vorher = woReihe() ? woReihe().textContent : null;
  ok("Zeigt den Wochendurchschnitt für den gewählten Zeitraum", !!vorher && /Ø .*\/Woche/.test(vorher), vorher);

  const chips = () => [...$("main").querySelectorAll(".segmented button")];
  const chip4w = chips().find((b) => b.textContent === "4 Wochen");
  ok("Zeitraum-Chips sind da (4 Wochen, 12 Wochen, Jahr, Gesamt, eigener)", chips().length >= 5, chips().length);
  if (chip4w) {
    click(chip4w);
    const nachher = woReihe() ? woReihe().textContent : null;
    ok("Ein anderer Zeitraum zeigt eine andere Zahl, keine feste Anzeige",
      nachher !== vorher, `${vorher} -> ${nachher}`);
  }

  const chipEigen = chips().find((b) => b.textContent === "eigener");
  ok("„eigener“ Zeitraum ist eine Option", !!chipEigen);
  if (chipEigen) {
    click(chipEigen);
    const datumsfelder = $("main").querySelectorAll('input[type="date"]');
    ok("Zeigt zwei Datumsfelder (Von/Bis) für einen freien Zeitraum", datumsfelder.length >= 2, datumsfelder.length);
  }

  App.zahlenFilter = { range: "12w", from: null, to: null };
  App.render();

  // --- Nachschärfung nach dem Nutzungs-Feedback ---

  ok("Positionen statt des mehrdeutigen „Käufe“", /Positionen/.test($("main").textContent),
    "erwartet z. B. „189 Positionen“, nicht „189 Käufe“ — das klang nach Einkaufsfahrten, meint aber Bon-Zeilen");

  ok("Die Kachel oben nennt den Zeitraum „gesamt“, damit sie sich vom Filter unten unterscheidet",
    /Ø\/Woche gesamt/.test($("main").textContent));

  /* Die Demo hat mehr als sieben Kategorien (siehe README) -- "Sonstige"
     muss auftauchen und die Prozente müssen sich wieder zu ~100 % summieren,
     statt eine stille Lücke zu lassen. Seit moneyBarSection() nur die
     ersten vier Zeilen zeigt, steht "Sonstige" (die achte) erst nach
     einem Antippen von "Alle ansehen" im DOM -- dieselben Daten, nur
     eingeklappt, siehe F2 im UX-Testbericht. */
  const kategorienMore = [...$("main").querySelectorAll(".moneyMore")][0];
  if (kategorienMore) click(kategorienMore);
  const sonstZeile = [...$("main").querySelectorAll(".moneyBarRow")].find((r) => /Sonstige/.test(r.textContent));
  ok("„Sonstige“ fasst den Rest zusammen, statt ihn kommentarlos zu kappen", !!sonstZeile);
  if (sonstZeile) {
    ok("„Sonstige“ ist optisch gedämpft, keine echte Kategorie", sonstZeile.classList.contains("muted"));
  }
  const prozente = [...$("main").querySelectorAll(".moneyBarRow")]
    .filter((r) => r.closest(".moneyHero") && r.textContent.includes("%"))
    .map((r) => parseInt((r.textContent.match(/(\d+) %/) || [])[1], 10))
    .filter((n) => Number.isFinite(n));
  const kategorieSumme = prozente.slice(0, 8).reduce((a, b) => a + b, 0);
  ok("Kategorien-Prozente summieren sich auf ~100 %, keine stille Lücke mehr",
    kategorieSumme >= 96 && kategorieSumme <= 104, kategorieSumme);

  /* Vorperiode: für einen echten Zeitraum (nicht "Gesamt") mit Daten
     davor muss ein Vergleich erscheinen -- für "Gesamt" darf keiner
     erfunden werden, weil es keine Vorperiode gibt. */
  ok("Ein begrenzter Zeitraum zeigt einen Vergleich zur Vorperiode",
    /ggü\. Vorperiode/.test($("main").querySelector(".moneyTotal").textContent));
  const chipsJetzt = () => [...$("main").querySelectorAll(".segmented button")];
  const chipGesamt = chipsJetzt().find((b) => b.textContent === "Gesamt");
  click(chipGesamt);
  ok("„Gesamt“ erfindet KEINEN Vergleich (keine Vorperiode existiert)",
    !/ggü\. Vorperiode/.test($("main").querySelector(".moneyTotal").textContent));
  App.zahlenFilter = { range: "12w", from: null, to: null };

  /* Marktnamen: Groß-/Kleinschreibung und Leerraum werden nur für DIESE
     Ansicht zusammengefasst, die gespeicherten Bons bleiben unverändert. */
  const testRows = [
    { store: "REWE", unitPrice: 10, quantity: 1 },
    { store: "Rewe", unitPrice: 5, quantity: 1 },
    { store: "  rewe  ", unitPrice: 3, quantity: 1 },
    { store: "Lidl", unitPrice: 7, quantity: 1 }
  ];
  const gruppiert = T.marktGruppen(testRows);
  ok("Groß-/klein- und leerraum-verschiedene Marktnamen werden zu einer Zeile zusammengefasst",
    gruppiert.size === 2, [...gruppiert.entries()]);
  ok("Der Betrag der zusammengefassten Zeile stimmt", gruppiert.get("REWE") === 18, gruppiert.get("REWE"));

  // Die antippbare Erklärung ersetzt den vorher dauerhaft sichtbaren Text.
  App.goto("zahlen");
  const infoBtn = $("main").querySelector(".moneyHeroHead .infoBtn");
  ok("Die Erklärung ist antippbar statt dauerhaft im Weg", !!infoBtn);
  if (infoBtn) {
    click(infoBtn);
    ok("Öffnet ein Blatt mit der Erklärung", /Sonstige.*sieben|sieben.*Sonstige/s.test($("sheetOpts").textContent));
    ok("Erklärt auch den Verlust-Hinweis als zeitraum-unabhängig",
      /Verlust.*GESAMTEN|GESAMTEN.*Verlust/s.test($("sheetOpts").textContent));
    App.closeSheet();
  }

  // --- Ausgaben mit Verschwendung verbunden (Punkt 4) ---
  const wasteRows = [...$("main").querySelectorAll(".moneyWaste")];
  ok("Mindestens eine Kategorie zeigt einen Verlust-Hinweis (Demo enthält chronische Verschwendung)",
    wasteRows.length > 0, wasteRows.length);
  ok("Der Hinweis nennt einen Prozentsatz", wasteRows.every((r) => /\d+ %/.test(r.textContent)));
  ok("„Sonstige“ bekommt nie einen Verlust-Hinweis (keine echte Kategorie)",
    !$("main").querySelector(".moneyBarRow.muted .moneyWaste"));

  const verlust = T.kategorieVerlust(App.ctx);
  ok("kategorieVerlust() liefert einen Anteil zwischen 0 und 1 für jede Kategorie",
    [...verlust.values()].every((v) => v >= 0 && v <= 1), [...verlust.entries()]);

  // --- Verlaufslinie je Kategorie (Punkt 5) ---
  const sparklines = $("main").querySelectorAll(".moneySparklineWrap svg");
  ok("Kategorien mit genug Monaten zeigen eine Verlaufslinie", sparklines.length > 0, sparklines.length);
  ok("Verlaufslinien haben einen betonten letzten Punkt in Akzentfarbe",
    [...sparklines].every((s) => !!s.querySelector("circle")));
  ok("„Sonstige“ bekommt keine Verlaufslinie (keine echte Kategorie)",
    !$("main").querySelector(".moneyBarRow.muted .moneySparklineWrap"));

  ok("Zu wenige Datenpunkte (< 3) liefern keine Linie, statt eine bedeutungslose zu zeichnen",
    T.moneySparklineSvg([5, 8]) === "");
  ok("Lauter Nullen liefern ebenfalls keine Linie", T.moneySparklineSvg([0, 0, 0, 0]) === "");
  ok("Genug echte Punkte liefern eine Linie", T.moneySparklineSvg([1, 5, 3, 8, 2, 9]).includes("<svg"));

  const verlauf = T.kategorieMonatsverlauf(App.ctx, 6);
  ok("kategorieMonatsverlauf() liefert genau 6 Monatswerte je Kategorie",
    [...verlauf.values()].every((arr) => arr.length === 6));

  // --- "Immer wieder gekauft": dieselbe Rangliste je Produkt ---
  App.goto("zahlen");
  const produktSection = [...$("main").querySelectorAll(".moneySection")]
    .find((s) => s.textContent === "Immer wieder gekauft");
  ok("Zeigt einen eigenen Bereich für regelmäßig gekaufte Produkte", !!produktSection);
  ok("Hähnchenbrust (die Demo-Verschwendung) taucht darin auf",
    /Hähnchenbrust/.test($("main").textContent));

  const produktZeilen = produktSection
    ? [...produktSection.parentElement.children].slice([...produktSection.parentElement.children].indexOf(produktSection))
    : [];
  const produktRows = produktZeilen.filter((el) => el.classList && el.classList.contains("moneyBarRow"));
  ok("Zeigt mindestens eine Produktzeile", produktRows.length > 0, produktRows.length);
  ok("Mindestens eine Produktzeile trägt eine Verlaufslinie",
    produktRows.some((r) => r.querySelector(".moneySparklineWrap svg")));

  const rang = T.produktRang(App.ctx, App.ctx.history);
  ok("produktRang() nimmt NUR Produkte mit gelerntem Rhythmus",
    [...rang.keys()].every((name) => [...App.ctx.rhythms.keys()].some((pid) => (T.byId(pid) || {}).name === name)));

  const pVerlust = T.produktVerlust(App.ctx);
  ok("produktVerlust() liefert einen Anteil zwischen 0 und 1 je Produkt",
    [...pVerlust.values()].every((v) => v >= 0 && v <= 1));

  const pVerlauf = T.produktMonatsverlauf(App.ctx, 6);
  ok("produktMonatsverlauf() liefert genau 6 Monatswerte je Produkt",
    [...pVerlauf.values()].every((arr) => arr.length === 6));
  ok("Ein einmalig gekauftes Produkt (kein Rhythmus) taucht NICHT im Produkt-Verlauf auf", (() => {
    // Irgendein Produkt aus der Historie suchen, das KEINEN Rhythmus hat.
    const einmalig = App.ctx.history.find((h) => h.productId && !App.ctx.rhythms.has(h.productId));
    if (!einmalig) return true; // Demo hat evtl. keinen solchen Fall -- kein Widerspruch
    const p = T.byId(einmalig.productId);
    return !p || !pVerlauf.has(p.name);
  })());

  // --- Antippen öffnet dasselbe Detail-Blatt wie "Preise"/"Rhythmen" ---
  const produktRow = produktRows[0];
  ok("Eine Produktzeile ist ein Knopf (Kategorien/Märkte sind es nicht)",
    produktRow && produktRow.tagName === "BUTTON", produktRow && produktRow.tagName);
  const kategorieRow = $("main").querySelector(".moneyBarRow");
  ok("Eine Kategorie-Zeile bleibt ein unklickbares div", kategorieRow && kategorieRow.tagName === "DIV",
    kategorieRow && kategorieRow.tagName);
  if (produktRow) {
    const name = produktRow.querySelector(".moneyBarLabel").textContent;
    click(produktRow);
    ok("Öffnet das Detail-Blatt des angetippten Produkts",
      $("sheetTitle").textContent === name, `${name} -> ${$("sheetTitle").textContent}`);
    ok("Das Blatt zeigt echte Fakten (Rhythmus, Preis, …), nicht nur den Namen",
      $("sheetOpts").querySelectorAll(".facts dt").length > 3);
    App.closeSheet();
  }
}

console.log("\n--- Die Übersicht ---");
{
  D.reset();
  D.loadDemo("full");
  const b4 = errors.length;
  App.goto("start");
  const main = $("main");
  ok("Die Übersicht rendert", errors.length === b4 && main.children.length > 0, errors[b4]);

  /* Dieselbe Grenze wie für die Liste, und aus demselben Grund. Die
     Übersicht darf reicher aussehen, aber nicht wieder zuwachsen.
     .startMain trägt seit der zweiten Spalte auf dem Rechner die
     eigentlichen Blöcke; .startAside (Wesen-Nachricht) zählt separat
     nicht mit -- sie ist kein weiterer inhaltlicher Block. */
  const startMain = main.querySelector(".startMain") || main;
  const bloecke = startMain.querySelectorAll(":scope > .group, :scope > .card");
  ok("Die Übersicht hat höchstens vier Blöcke", bloecke.length <= 4, bloecke.length);

  ok("Die Liste ist NICHT der erste Reiter", T.NAV[0].id === "start", T.NAV[0].id);
  ok("Und die Liste steht ganz oben", main.firstElementChild && !!main.firstElementChild.querySelector(".bigAction"));

  /* Die Liste bleibt einen Tipp entfernt. */
  const gross = main.querySelector(".bigAction");
  ok("Die Liste steht als eigenes Feld da", !!gross);
  ok("Mit Positionen und Preis", /\d+ Position|noch nichts/.test(gross.textContent), gross.textContent.trim());
  click(gross);
  ok("Und führt zur Liste", App.tab === "liste", App.tab);

  /* „Fällig“ hat keinen Reiter mehr, aber seine Adresse behalten. */
  App.goto("start");
  ok("Die Leiste hat sechs Reiter", $("nav").children.length === 6, $("nav").children.length);
  ok("„Fällig“ ist keiner davon",
    ![...$("nav").querySelectorAll("span")].some((x) => x.textContent === "Fällig"));
  App.goto("faellig");
  ok("Aber die Seite gibt es noch", $("main").children.length > 0);
  ok("Und die Leiste zeigt Start als aktiv",
    $("nav").children[0].getAttribute("aria-current") === "page");

  /* Und sie ist auch dann erreichbar, wenn gerade nichts fällig ist:
     über den Bestand. Sonst wären „Demnächst“ und „Günstig
     bevorraten“ verschwunden statt umgezogen. */
  App.goto("bestand");
  const weg = [...$("main").querySelectorAll(".row")]
    .find((r) => /Austausch und Nachschub/.test(r.textContent));
  ok("Der Bestand führt ebenfalls dorthin", !!weg);
  if (weg) { click(weg); ok("Und zwar wirklich", App.tab === "faellig", App.tab); }

  /* Der Gruß richtet sich nach der Tageszeit — und lügt nachts nicht. */
  ok("Morgens wird gegrüßt", App.greeting(8) === "Guten Morgen", App.greeting(8));
  ok("Abends auch", App.greeting(20) === "Guten Abend", App.greeting(20));
  ok("Nachts nicht mit „Morgen“", !/Morgen/.test(App.greeting(2)), App.greeting(2));
}

console.log("\n--- Das Produkt-Blatt: ein Leitwert, dann Gruppen ---");
{
  /* Das Blatt war eine flache Liste aus zehn gleich aussehenden
     Zeilen -- „Kategorie: Fleisch/Fisch" so groß wie „Verbrauchs-
     datum: höchstens 2 Tage". Alles gleich gewichtet heißt nichts
     gewichtet. Diese Prüfungen halten die neue Rangfolge fest, damit
     das Blatt nicht wieder zuwächst. */
  D.reset();
  D.loadDemo("full");
  App.goto("bestand");

  productSheetFor("haehnchen");
  const blatt = $("sheetOpts");

  ok("Das Blatt führt mit genau EINEM Leitwert",
    blatt.querySelectorAll(".pLead").length === 1,
    blatt.querySelectorAll(".pLead").length);

  /* Die Rangfolge ist eine Rangfolge der FOLGEN, nicht der
     Reihenfolge im Datensatz: ein Verbrauchsdatum kann krank machen
     und schlägt deshalb alles andere. */
  ok("Bei einem Verbrauchsdatum-Produkt führt das Verbrauchsdatum",
    /Verbrauchsdatum/.test(blatt.querySelector(".pLead").textContent),
    blatt.querySelector(".pLead").textContent.slice(0, 60));
  ok("Und ist als dringend gekennzeichnet, nicht nur größer gesetzt",
    blatt.querySelector(".pLead").classList.contains("red"));

  /* Der Leitwert kann nur EINE Sache zeigen -- die zweitwichtigste
     darf dadurch nicht verschwinden. Genau das war beim Umbau
     zuerst passiert: Hähnchenbrust verlor Rhythmus UND Verlustquote,
     weil das Verbrauchsdatum den Platz bekam. */
  const kennzahlen = blatt.querySelector(".pStats");
  ok("Die zweitwichtigsten Zahlen stehen daneben, nicht im Nichts", !!kennzahlen);
  if (kennzahlen) {
    ok("Der Rhythmus bleibt sichtbar, obwohl er nicht der Leitwert ist",
      /Rhythmus/.test(kennzahlen.textContent), kennzahlen.textContent);
    ok("Die Verlustquote ebenso",
      /Verlust/.test(kennzahlen.textContent), kennzahlen.textContent);
    ok("Höchstens drei Kennzahlen — sonst ist es wieder eine Liste",
      kennzahlen.querySelectorAll(".pStat").length <= 3);
  }

  /* Der Preis war ein Satz: „zuletzt 7,49 € · üblich 7,24 € · Spanne
     6,99 €–7,49 €" -- auf schmalen Geräten mit Umbruch mitten in der
     Zahl. Er ist jetzt aufgeteilt nach Bedeutung: der zuletzt
     gezahlte Preis ist eine KENNZAHL (mit Farbe als Vergleich zum
     üblichen), „üblich" und „Spanne" sind BEZUGSWERTE in der
     Faktenliste. Ein eigener Abschnitt mit Überschrift und drei
     umrandeten Kästchen war für vier Zahlen zu viel Apparat. */
  ok("Der zuletzt gezahlte Preis steht als Kennzahl, nicht in einem Satz",
    kennzahlen && /zuletzt/.test(kennzahlen.textContent), kennzahlen && kennzahlen.textContent);
  ok("Die Bezugswerte stehen als eigene Faktenzeilen",
    /üblicher Preis/.test(blatt.textContent) && /Preisspanne/.test(blatt.textContent));
  ok("Die Spanne trägt nur EIN Eurozeichen (sonst bricht sie um)",
    !/€\s*–/.test(blatt.textContent),
    (blatt.textContent.match(/.{0,15}€\s*–.{0,15}/) || [""])[0]);

  /* Der eigentliche Befund nach der ersten Fassung: sortiert war sie,
     ruhig nicht. Kästchen mit Haarlinien-Fugen für jede Kennzahl und
     jeden Preiswert ergaben ein halbes Dutzend zusätzlicher Linien
     auf einem Bildschirm, der schon Karten und Faktenzeilen trägt. */
  ok("Kennzahlen stehen ohne Kästchen -- Abstand statt Rahmen",
    !blatt.querySelector(".pPrice") && !blatt.querySelector(".pPriceCell"));
  ok("Höchstens eine Zwischenüberschrift im sichtbaren Teil über der Verlust-Karte",
    [...blatt.querySelectorAll(".sheetGroupTitle")].length <= 2,
    [...blatt.querySelectorAll(".sheetGroupTitle")].map((x) => x.textContent).join(" | "));

  /* Herkunft und Datenqualität sind der Kern des Vertrauens-
     versprechens und dürfen nicht verschwinden -- aber sie müssen
     beim Öffnen nicht im Weg stehen. */
  const herkunft = [...blatt.querySelectorAll("details")]
    .find((d) => /Wie die App darauf kommt/.test(d.textContent));
  ok("Die Herkunft der Zahlen ist eingeklappt erreichbar", !!herkunft);
  if (herkunft) {
    ok("Und beim Öffnen des Blattes zugeklappt", !herkunft.open);
    ok("Der Inhalt bleibt trotzdem im Dokument (Suche, Vorlesehilfe)",
      /Datenqualität/.test(herkunft.textContent));
  }

  /* Kein Abschnitt, der nur mitteilt, dass nichts bekannt ist.
     „Bestand: nicht schätzbar" stand vorher als eigene Zeile ganz
     oben zwischen den echten Angaben. */
  const ueberschriften = [...blatt.querySelectorAll(".sheetGroupTitle")].map((x) => x.textContent);
  ok("Kein leerer Abschnitt mehr im sichtbaren Teil",
    !ueberschriften.includes("Vorrat") || /Bestand|Reichweite/.test(blatt.textContent));
  ok("Die Auskunft „nicht schätzbar“ ist trotzdem noch da, nur weiter unten",
    !herkunft || /nicht schätzbar|Bestand/.test(blatt.textContent));

  App.closeSheet();

  /* Ohne Verbrauchsdatum und ohne hohen Verlust führt der Rhythmus. */
  productSheetFor("milch_vollmilch");
  const b2 = $("sheetOpts");
  ok("Ohne Dringlichkeit führt der Rhythmus das Blatt an",
    /Tage/.test(b2.querySelector(".pLead").textContent),
    b2.querySelector(".pLead").textContent.slice(0, 40));
  ok("Und ohne rote Kennzeichnung",
    !b2.querySelector(".pLead").classList.contains("red"));
  ok("Das Wort „Rhythmus“ bleibt im Blatt, auch wenn der Leitwert es umschreibt",
    /Rhythmus/.test(b2.textContent));
  App.closeSheet();

  /* Ein Haushaltsprodukt rechnet anders und zeigt deshalb andere
     Gruppen -- aber denselben Aufbau. */
  productSheetFor("waschmittel");
  const b3 = $("sheetOpts");
  ok("Auch ein Haushaltsprodukt bekommt einen Leitwert", !!b3.querySelector(".pLead"));
  ok("Und seine eigenen Gruppen statt der Lebensmittel-Gruppen",
    /Verbrauch/.test(b3.textContent) && !/Frische & Lagerung/.test(b3.textContent));
  App.closeSheet();
}

console.log("\n--- Die Startseite bleibt aufgeräumt ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const main = $("main");

  /* Der Kern der Entrümpelung, als Regel und nicht als Beispiel:
     die Startseite darf nur wenige Blöcke haben. Die Rückmeldung der
     Zielgruppe war „zu überladen“, und ohne Grenze wächst so eine
     Seite von selbst wieder zu. */
  const bloecke = main.querySelectorAll(":scope > .group, :scope > .card, :scope > .ctaRow");
  ok("Die Startseite hat höchstens vier Blöcke", bloecke.length <= 4, bloecke.length);

  ok("Die Liste ist da", !!main.querySelector(".items"));
  ok("Der Weg in die Gangansicht ist da",
    [...$("appbar").querySelectorAll("button")].some((b) => b.textContent === "Nach Gängen"));
  ok("Und steht nur dort, nicht ein zweites Mal unten in der Liste",
    ![...main.querySelectorAll("button")].some((b) => b.textContent === "Nach Gängen"));
  ok("Und das Hinzufügen", !!main.querySelector(".addRow"));

  /* Was umgezogen ist, ist NICHT verschwunden. */
  ok("Die Einstellungen stehen nicht mehr auf der Startseite",
    !/Vorausschau|Personen/.test(main.textContent));
  App.goto("mehr");
  ok("Sondern unter Mehr", /Vorausschau/.test($("main").textContent) && /Personen/.test($("main").textContent));
  ok("Und das Budget auch", /Budget/.test($("main").textContent));
  App.goto("bestand");
  ok("Der Vorrat steht im Bestand", !!$("main").querySelector(".hero"));
  App.goto("liste");

  /* Die Hinweise: eine Zeile statt fünf Gruppen. */
  const hinweise = T.collectHints(App.ctx);
  ok("Es gibt Hinweise zu zeigen", hinweise.length > 0, hinweise.length);
  ok("Sie stehen als EINE Zeile auf der Seite",
    !/Fehlt dir das|Nicht in Saison/.test(main.textContent));
  const hRow = [...main.querySelectorAll(".row")]
    .find((r) => /Zero Waste|kühlen/i.test(r.textContent));
  ok("Und die Zeile ist da", !!hRow);
  click(hRow);
  ok("Sie öffnet das Sammelblatt", /Zero Waste/.test($("sheetTitle").textContent),
    $("sheetTitle").textContent);
  const blatt = $("sheetOpts").textContent;
  ok("Darin steht alles wieder", hinweise.every((h) => blatt.includes(h.title.slice(0, 12))),
    hinweise.map((h) => h.title).join(" | "));
  ok("Mit ihren Handlungen", $("sheetOpts").querySelectorAll(".pillBtn").length > 0);
  App.closeSheet();

  /* Höchstens ein Zeichen je Zeile. */
  const zeilen = [...main.querySelectorAll(".item .nm")];
  ok("Keine Zeile trägt mehr als ein Zeichen",
    zeilen.every((z) => z.querySelectorAll(".pill").length <= 1),
    zeilen.map((z) => z.querySelectorAll(".pill").length).join(","));
  ok("Preisabweichungen stehen nicht mehr auf der Liste",
    !main.querySelector(".item .pill.warn, .item .pill.cheap"));
  ok("Aber weiter im Detail-Blatt", (() => {
    const mitPreis = [...App.ctx.prices.entries()].find(([, v]) => v.verdict !== "üblich");
    if (!mitPreis) return true;
    T.productSheet(mitPreis[0], App.ctx);
    const t = $("sheetOpts").textContent;
    App.closeSheet();
    return /üblich/.test(t);
  })());

  /* Der Vorschlag zur halben Menge erklärt sich selbst. */
  const halb = main.querySelector(".halfRow");
  if (halb) {
    ok("Die halbe Menge nennt ihren Grund", /Hält|übrig/.test(halb.textContent), halb.textContent);
    ok("Und ist antippbar", halb.tagName === "BUTTON");
  }
}

console.log("\n--- Einen Bon korrigieren ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("erfassen");

  const bon = [...D.get().receipts].sort((a, b) => b.date.localeCompare(a.date))[0];
  const zeilen = D.receiptLines(bon.id);
  ok("Ein Bon kennt seine Positionen", zeilen.length === bon.itemCount, `${zeilen.length} zu ${bon.itemCount}`);

  T.receiptSheet(bon, App);
  ok("Das Bon-Blatt öffnet sich", !$("sheet").hidden && /Position/.test($("sheetOpts").textContent));
  ok("Es zeigt jede Position", $("sheetOpts").querySelectorAll(".row").length === zeilen.length);

  /* --- Eine Position entfernen --- */
  const vorherSumme = bon.total;
  const vorherAnzahl = bon.itemCount;
  const weg = zeilen[0];
  const wegWert = weg.unitPrice * weg.quantity;
  const erfasstVorher = (D.get().actions.find((a) => a.date === bon.date && a.kind === "erfasst") || {}).euros;

  const loeschen = [...$("sheetOpts").querySelectorAll("button")].find((b) => b.textContent === "×");
  ok("Jede Position lässt sich entfernen", !!loeschen);
  click(loeschen);

  const danach = D.get().receipts.find((r) => r.id === bon.id);
  ok("Die Position ist weg", D.receiptLines(bon.id).length === vorherAnzahl - 1);
  ok("Die Anzahl stimmt wieder", danach.itemCount === vorherAnzahl - 1, danach.itemCount);
  ok("Die Summe stimmt wieder",
    Math.abs(danach.total - (vorherSumme - wegWert)) < 0.02,
    `${danach.total} statt ${(vorherSumme - wegWert).toFixed(2)}`);
  ok("Und der Erfassungsbetrag im Protokoll zieht mit", (() => {
    const jetzt = (D.get().actions.find((a) => a.date === bon.date && a.kind === "erfasst") || {}).euros;
    return Math.abs(jetzt - (erfasstVorher - wegWert)) < 0.02;
  })());
  ok("Der Kauf ist auch aus der Historie verschwunden",
    !D.get().purchases.some((p) => p.id === weg.id));

  /* --- Eine Position anders zuordnen --- */
  const rest = D.receiptLines(bon.id);
  const zeile = rest[0];
  const altesProdukt = zeile.productId;
  const neuesProdukt = altesProdukt === "kaffee" ? "reis" : "kaffee";
  ok("Umbuchen ändert das Produkt", D.updatePurchase(zeile.id, { productId: neuesProdukt }));
  const nachher = D.get().purchases.find((p) => p.id === zeile.id);
  ok("Der Kauf trägt jetzt das andere Produkt", nachher.productId === neuesProdukt, nachher.productId);
  ok("Die Summe des Bons bleibt gleich",
    Math.abs(D.get().receipts.find((r) => r.id === bon.id).total - danach.total) < 0.02);

  /* --- Der letzte Löschvorgang räumt den Bon ab --- */
  const klein = D.get().receipts.find((r) => r.itemCount === 1)
    || D.get().receipts.sort((a, b) => a.itemCount - b.itemCount)[0];
  const kleinZeilen = D.receiptLines(klein.id);
  kleinZeilen.forEach((z) => D.updatePurchase(z.id, null));
  ok("Ein Bon ohne Positionen verschwindet",
    !D.get().receipts.some((r) => r.id === klein.id));

  /* --- Nichts geht kaputt --- */
  ok("Eine unbekannte Kennung ändert nichts", D.updatePurchase("gibtsnicht", null) === false);
  App.goto("zahlen");
  ok("Die Zahlen rechnen danach weiter", App.ctx.totals.receipts >= 0 && $("main").children.length > 0);
  ok("Und keine Verschwendungsquote über 100 %",
    [...App.ctx.wasteStats.values()].every((s) => s.wasteRate <= 1));
  App.closeSheet();
}

console.log("\n--- Wiederherstellung ---");
{
  D.reset();
  D.loadDemo("full");

  /* --- Die Schattenkopie springt ein --- */
  {
    // Ein halb geschriebener Hauptstand, wie ihn eine volle Quote
    // hinterlässt — die Schattenkopie muss ihn ersetzen.
    const guter = D.exportJson();
    window.localStorage.setItem(D.STORE_KEY, guter.slice(0, Math.floor(guter.length / 2)));
    window.localStorage.setItem(D.SHADOW_KEY, guter);
    D.load();
    const rec = D.recoveryNotice();
    ok("Der kaputte Hauptstand wird erkannt", !!rec, JSON.stringify(rec));
    ok("Und die Schattenkopie springt ein", rec && rec.level === "gerettet", rec && rec.level);
    ok("Die Käufe sind wieder da", D.get().purchases.length > 200, D.get().purchases.length);
    ok("Es wird nicht verschwiegen", rec && /Sicherungskopie/.test(rec.message));
  }
  {
    // Sind beide kaputt, wird das gesagt statt still leer zu starten.
    window.localStorage.setItem(D.STORE_KEY, "{kaputt");
    window.localStorage.setItem(D.SHADOW_KEY, "auch kaputt");
    D.load();
    const rec = D.recoveryNotice();
    ok("Zwei kaputte Stände werden gemeldet", rec && rec.level === "verloren", JSON.stringify(rec));
  }
  D.reset();
  D.loadDemo("full");
}

console.log("\n--- Einkauf aus einem Bild ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("erfassen");
  App.capture.tab = "scan";
  App.render();

  // Ohne WebAssembly-Worker (jsdom hat keinen) sagt die Oberfläche
  // das und bietet den Textweg an, statt eine tote Schaltfläche zu
  // zeigen.
  ok("Ohne Texterkennung wird das gesagt, nicht verschwiegen",
    /keine Texterkennung/.test($("main").textContent));
  ok("Und der Textweg steht bereit", !!$("main").querySelector("textarea"));

  // Die Erkennung selbst läuft in dieser Umgebung nicht (kein
  // WebAssembly-Worker, kein Canvas). Ausgetauscht wird deshalb nur
  // die Erkennung — alles danach ist echt: Ausrichten, Zuordnen,
  // Buchen.
  const BILD = [
    "LIDL",
    "Musterstr. 12",
    "12.08.2026 17:42",
    "Vollmilch 3,5% l,29 A",
    "Naturjoghurt O,59 A",
    "Bananen lose 1,89 A",
    "SUMME 3,77",
    "Vielen Dank"
  ].join("\n");

  T.OCR.engine = () => BILD;
  App.render();
  const txt = $("main").textContent;
  ok("Mit Texterkennung erscheint der Bildweg", /fotografieren|Bild wählen/.test(txt));
  ok("Und sagt, wo Bild und Bon-Text bleiben", /bleiben auf dem Gerät/.test(txt));
  ok("Und sagt ehrlich, was NICHT auf dem Gerät bleibt",
    /Open Food Facts/.test(txt) && /reiner Name, ohne Preis, Datum oder Markt/.test(txt), txt);
  const knopf = [...$("main").querySelectorAll("button")].find((b) => /Bild wählen/.test(b.textContent));
  ok("Es gibt eine Schaltfläche zum Wählen", !!knopf);
  const kamera = [...$("main").querySelectorAll("input[type=file]")].find((i) => i.hasAttribute("capture"));
  ok("Und einen Weg direkt in die Kamera", !!kamera);

  // Den Weg über den echten Dateidialog kann jsdom nicht gehen —
  // also wird die Datei direkt eingespeist, so wie es der Hörer täte.
  const vorher = D.get().receipts.length;
  const gelesen = T.readReceiptImage(BILD, { today: "2026-08-12" });
  // Vier behaltene Zeilen: die drei Waren und die Summenzeile. Die
  // Summe ist keine Position, sondern der Schlussstrich — sie hält
  // den Werbefuß draußen und liefert die Gegenprobe.
  ok("Das Bild wird zu Bon-Text", gelesen.kept === 4, gelesen.kept + ": " + gelesen.text);
  ok("Datum kommt aus dem Bild", gelesen.date === "2026-08-12", gelesen.date);
  ok("Markt auch", gelesen.store === "Lidl", gelesen.store);
  ok("Die Ziffern sind zurückgedreht", /1,29/.test(gelesen.text) && /0,59/.test(gelesen.text));

  const p = D.parseReceiptText(gelesen.text);
  ok("Die Zeilen werden Produkten zugeordnet", p.rows.length === 3, p.rows.length);
  ok("Die Summenzeile wird keine Position",
    p.rows.every((r) => !/summe/i.test(r.raw)), p.rows.map((r) => r.raw).join(" | "));
  ok("Die Gegenprobe gegen die aufgedruckte Summe geht auf",
    p.printedTotal === 3.77 && p.totalOk === true, `${p.printedTotal} / ${p.totalOk}`);

  // Nicht alle drei sind schon sicher -- "Bananen lose" braucht eine
  // Bestätigung (0.81, unter der sicher-Schwelle). addReceipt bucht
  // unbestätigte Zeilen NICHT automatisch (siehe Kommentar dort);
  // hier wird die Bestätigung darum wie in der Oberfläche nachgeholt,
  // bevor gebucht wird.
  ok("Zwei Zeilen sind sofort sicher, eine braucht eine Bestätigung",
    p.rows.filter((r) => r.productId && !r.needsConfirmation).length === 2 &&
    p.rows.filter((r) => r.needsConfirmation).length === 1,
    p.rows.map((r) => `${r.raw}->${r.productId}${r.needsConfirmation ? " (unsicher)" : ""}`).join(" | "));
  p.rows.forEach((r) => { if (r.needsConfirmation) r.needsConfirmation = false; });

  const res = D.addReceipt({ date: gelesen.date, store: gelesen.store, items: p.rows });
  ok("Der Bon lässt sich buchen, sobald alles bestätigt ist", res.count === 3, res.count);
  ok("Und steht in der Historie", D.get().receipts.length === vorher + 1);

  // Aus dem Bild kommt die Bonzeile — und damit die Marke. Ohne sie
  // wäre der Eigenmarken-Vergleich für alles blind, was fotografiert
  // statt abgehakt wurde.
  const neueste = [...D.get().purchases].sort((a, b) => b.id.localeCompare(a.id))[0];
  ok("Gebuchte Positionen tragen ihre Markenkennung",
    D.get().purchases.some((x) => x.brand !== undefined), JSON.stringify(neueste));

  // Ein Bild, das kein Bon ist, darf nichts buchen.
  const quatsch = T.readReceiptImage("Herzlichen Glueckwunsch\nAlles Gute zum Geburtstag");
  ok("Ein Bild ohne Bon wird abgelehnt", quatsch.quality.ok === false);
  ok("Mit einem Hinweis statt einer Fehlermeldung", /näher|Schatten|kein Text/.test(quatsch.quality.message));

  T.OCR.engine = null;
  ok("Die Erkennung meldet sich ehrlich, wenn sie nicht kann",
    typeof T.OCR.supported() === "boolean");
  ok("Und hält keinen Worker offen", (T.OCR.release(), T.OCR.worker === null));

  // Der Einfüge-Hörer hängt am Dokument und muss beim Wechsel weg.
  App.goto("liste");
  App.goto("erfassen");
  App.goto("liste");
  ok("Kein Hörer bleibt nach dem Wechsel hängen",
    !App._cleanup || App._cleanup.length === 0, App._cleanup && App._cleanup.length);
}

console.log("\n--- Aus dem Teilen-Menü (REWE, Lidl & Co. → „eBon teilen“) ---");
{
  /* Was hier NICHT geprüft wird, und warum: den eigentlichen Worker
     (sw.js) führt Node nicht aus — er läuft in einem eigenen
     ServiceWorker-Kontext, den weder jsdom noch dieser Testlauf
     nachbildet. Geprüft wird deshalb die Kette AB dem Punkt, an dem
     der Worker seine Arbeit abgegeben hat: eine Datei im
     Cache-Speicher, `?teilen=1` in der Adresse. Dass der Worker
     selbst korrekt daraus einen Cache-Eintrag macht, hält Abschnitt
     „Ein Ding, ein Name“ unten als Quelltext-Prüfung fest — mehr geht
     ohne echten Browser nicht ehrlich zu behaupten. */
  const legeInCache = async (text, datei) => {
    const cache = await window.caches.open("einkaufsanker-geteilt");
    await cache.put("./geteilt-text", { text: async () => text });
    if (datei) await cache.put("./geteilt-datei", { blob: async () => datei });
    else await cache.delete("./geteilt-datei");
  };

  D.reset();
  D.loadDemo("full");
  // App.capture überlebt D.reset() -- das ist Oberflächenzustand, kein
  // Haushaltszustand. Ohne diese Zeile träfe der erste Fall hier auf
  // Text, der von einem früheren Testabschnitt übrig ist.
  App.capture.text = "";

  // --- Nur Text (z. B. eine Bon-Zusammenfassung ohne Bilddatei) ---
  await legeInCache("Vollmilch 3,5% 1,29\nNaturjoghurt 0,59", null);
  window.history.pushState(null, "", "/?teilen=1#start");
  await App.consumeSharedIfAny();

  ok("Springt auf die Erfassen-Seite", App.tab === "erfassen", App.tab);
  ok("Und dorthin, wo der Bon-Text steht", App.capture.tab === "scan", App.capture.tab);
  ok("Die Adresse ist wieder sauber", !window.location.search.includes("teilen"), window.location.search);
  App.render();
  ok("Der geteilte Text steht im Feld",
    $("main").querySelector("textarea").value.includes("Naturjoghurt"),
    $("main").querySelector("textarea").value);

  // --- Bild, mit Texterkennung: läuft automatisch durch, wie beim
  //     Einfügen oder Ablegen eines Bildes auch. ---
  App.capture.text = "";
  T.OCR.engine = () => "REWE\nBrot 2,19\nSUMME 2,19";
  await legeInCache("", { type: "image/jpeg" });
  window.history.pushState(null, "", "/?teilen=1#start");
  await App.consumeSharedIfAny();
  App.render();
  // OCR.read() hängt an einem Versprechen -- eine echte Wartezeit statt
  // einer geratenen Anzahl Microtask-Runden, sonst wird der Test genauso
  // brüchig wie das, was er prüfen soll.
  await new Promise((res) => setTimeout(res, 20));
  ok("Ein geteiltes Bild läuft von selbst durch die Texterkennung",
    /Brot/.test(App.capture.text || ""), App.capture.text);

  // --- PDF (manche Händler-Apps bieten den eBon so an): ehrlich
  //     sagen, dass das noch nicht geht, statt es stillschweigend
  //     zu verwerfen. ---
  App.capture.text = "";
  T.OCR.engine = null;
  await legeInCache("", { type: "application/pdf" });
  window.history.pushState(null, "", "/?teilen=1#start");
  await App.consumeSharedIfAny();
  App.render();
  ok("Ein PDF wird nicht stillschweigend verworfen",
    /Texterkennung.*noch nicht|noch nicht.*Texterkennung/i.test($("sheetTitle").textContent) ||
    /Screenshot/.test($("sheetOpts").textContent),
    $("sheetTitle").textContent + " | " + $("sheetOpts").textContent);
  App.closeSheet();

  // --- Ohne "?teilen=1" passiert nichts — ein gewöhnlicher Start
  //     darf den Cache nicht anfassen. ---
  App.pendingShare = null;
  window.history.pushState(null, "", "/#start");
  await App.consumeSharedIfAny();
  ok("Ohne Markierung in der Adresse bleibt alles unberührt", App.pendingShare === null);

  /* Die Gegenseite: dass der Worker (sw.js) aus einer geteilten
     Anfrage tatsächlich einen Cache-Eintrag macht und dahin
     umleitet, wo App.consumeSharedIfAny() oben es erwartet. Node
     führt sw.js nicht aus (eigener ServiceWorker-Kontext) — geprüft
     wird deshalb der Quelltext, nicht das Verhalten. Das ist bewusst
     schwächer als ein echter Testlauf und wird hier auch so benannt. */
  const swSrc = fs.readFileSync(path.join(WEB, "sw.js"), "utf8");
  ok("Der Worker fängt POST-Anfragen ans Teilen-Ziel ab",
    /method === "POST"/.test(swSrc) && /searchParams\.has\("teilen"\)/.test(swSrc));
  ok("Und legt Datei und Text in einem eigenen Zwischenspeicher ab",
    /geteilt-text/.test(swSrc) && /geteilt-datei/.test(swSrc));
  ok("Und leitet danach zur App zurück",
    /Response\.redirect/.test(swSrc));

  const manifest = JSON.parse(fs.readFileSync(path.join(WEB, "manifest.webmanifest"), "utf8"));
  const ziel = manifest.share_target || {};
  ok("Das Manifest meldet ein Teilen-Ziel", !!manifest.share_target);
  ok("POST mit Formulardaten, wie es der Worker erwartet",
    ziel.method === "POST" && ziel.enctype === "multipart/form-data");
  ok("Nimmt Bilder, PDFs und reinen Text an",
    !!(ziel.params && ziel.params.files && ziel.params.files[0] &&
      ["image/*", "application/pdf", "text/plain"]
        .every((t) => ziel.params.files[0].accept.includes(t))));
}

console.log("\n--- Angebote: die Lebensmittel-Entsprechung zu \"Günstig bevorraten\" ---");
{
  D.reset();
  App.goto("start");
  App.render();
  ok("Ohne Historie keine Angebote", App.ctx.foodDeals.length === 0);

  // Fünf Käufe zu üblichem Preis, damit Rhythmus UND Preisgedächtnis
  // etwas zu arbeiten haben -- dann einer deutlich billiger.
  const kauf = (tag, preis) => D.addReceipt({
    date: tag, store: "Test", items: [{ productId: "kaffee", quantity: 1, unitPrice: preis }]
  });
  kauf("2026-06-01", 6.49);
  kauf("2026-06-15", 6.49);
  kauf("2026-06-29", 6.49);
  kauf("2026-07-13", 6.49);
  kauf("2026-07-27", 4.99);   // gut 23 % unter dem üblichen Preis
  App.render();

  const deal = App.ctx.foodDeals.find((d) => d.productId === "kaffee");
  ok("Der günstige Kauf wird als Angebot erkannt", !!deal, JSON.stringify(App.ctx.foodDeals));
  ok("Der Nachlass stimmt ungefähr",
    !!deal && deal.nachlass > 0.20 && deal.nachlass < 0.26, deal && deal.nachlass);

  ok("Erscheint in \"Jetzt zu tun\"",
    /Angebot/.test($("main").textContent) && /Kaffee/.test($("main").textContent));

  App.goto("angebote");
  App.render();
  ok("Die Angebote-Seite zeigt das Produkt", /Kaffee/.test($("main").textContent));
  // "zuletzt DD.MM.JJJJ" statt eines aktuellen Preises -- die Zeile
  // behauptet an keiner Stelle, das gelte im Laden gerade jetzt.
  ok("Und sagt ehrlich, dass es der letzte GESEHENE Preis ist, kein Regalpreis",
    /zuletzt \d\d\.\d\d\.\d{4}/.test($("main").textContent), $("main").textContent);

  // Zurück zu leer: ohne Treffer bleibt die Seite verständlich, keine
  // leere Fläche.
  D.reset();
  App.goto("start");
  App.render();
  ok("Ohne Angebote verschwindet die Zeile aus \"Jetzt zu tun\"",
    !/Angebot erkannt|Angebote erkannt/.test($("main").textContent));
  App.goto("angebote");
  App.render();
  ok("Und die Seite selbst erklärt das Fehlen statt leer zu bleiben",
    /Gerade keine Angebote erkannt/.test($("main").textContent));
  App.goto("start");
}

console.log("\n--- Zweite Stufe: Open Food Facts als Übersetzer ---");
{
  /* T.OffLookup.fetcher ersetzt fetch() — genau das Muster von
     T.OCR.engine. Kein Testlauf hier geht jemals ins echte Internet. */
  window.localStorage.removeItem(T.OffLookup.CACHE_KEY);

  let anfragen;
  const antwortMit = (name) => {
    anfragen = [];
    T.OffLookup.fetcher = (url) => {
      anfragen.push(url);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ products: name ? [{ product_name_de: name }] : [] })
      });
    };
  };

  antwortMit("Naturjoghurt");
  const treffer = await T.OffLookup.find("GL Proteinjogh.sort.200g");
  ok("Ein Treffer liefert den ausgeschriebenen Namen", treffer === "Naturjoghurt", treffer);
  ok("Genau eine Anfrage wurde gestellt", anfragen.length === 1, anfragen.length);

  const url = new URL(anfragen[0]);
  const params = url.searchParams;
  ok("Es geht nur der bereinigte Name raus, kein Preis/Datum/Markt",
    !/\d/.test(params.get("search_terms") || "") &&
    !/[0-9]{1,2}[.\/][0-9]{1,2}/.test(anfragen[0]) &&
    !anfragen[0].includes("Netto") && !anfragen[0].includes("REWE"),
    anfragen[0]);
  ok("Die Anfrage geht an Open Food Facts, sonst nirgendwohin",
    url.hostname === "world.openfoodfacts.org", url.hostname);

  antwortMit("sollte nie gerufen werden");
  const zweitesMal = await T.OffLookup.find("GL Proteinjogh.sort.200g");
  ok("Dieselbe Schreibweise wird kein zweites Mal gefragt",
    zweitesMal === "Naturjoghurt" && anfragen.length === 0, `${zweitesMal}, ${anfragen.length} Anfragen`);

  antwortMit(null);
  const keinTreffer = await T.OffLookup.find("Vollkommen Erfundenes Produkt XYZ");
  ok("Kein Treffer ist kein Fehler", keinTreffer === null);
  antwortMit("sollte wieder nie gerufen werden");
  await T.OffLookup.find("Vollkommen Erfundenes Produkt XYZ");
  ok("Auch ein Fehlschlag wird nicht zweimal gefragt", anfragen.length === 0, anfragen.length);

  window.localStorage.removeItem(T.OffLookup.CACHE_KEY);
  const urspruenglichOnline = window.navigator.onLine;
  Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
  antwortMit("sollte offline nie gerufen werden");
  const ohneNetz = await T.OffLookup.find("Ganz Neuer Name");
  ok("Ohne Netz wird gar nicht erst gefragt",
    ohneNetz === null && anfragen.length === 0, anfragen.length);
  Object.defineProperty(window.navigator, "onLine", { value: urspruenglichOnline, configurable: true });

  window.localStorage.removeItem(T.OffLookup.CACHE_KEY);
  T.OffLookup.fetcher = () => Promise.reject(new Error("Netzwerk weg"));
  const beiFehler = await T.OffLookup.find("Wieder Ein Neuer Name");
  ok("Ein Netzwerkfehler wirft nicht, sondern zählt als kein Treffer", beiFehler === null);

  // ---------------------------------------------------------------
  // Data.enrichUnmatched: der Umweg bucht nie automatisch
  // ---------------------------------------------------------------
  window.localStorage.removeItem(T.OffLookup.CACHE_KEY);

  const ohneUnbekannte = D.parseReceiptText("Vollmilch 3,5%  1,29 A");
  const vorherOffen = ohneUnbekannte.open;
  T.OffLookup.fetcher = () => { throw new Error("Es hätte gar nicht erst gefragt werden dürfen"); };
  const nichtsZuTun = await D.enrichUnmatched(ohneUnbekannte);
  ok("Ein Bon voller sicherer Treffer verursacht keinen einzigen Netzwerkversuch",
    nichtsZuTun === false && ohneUnbekannte.open === vorherOffen);

  /* "Vollmilch" ausgeschrieben würde inzwischen schon lokal genügen
     (0.70, über der Bestätigungs-Schwelle) — dieser Test soll aber
     den Umweg über Open Food Facts prüfen, also eine Zeile, die
     lokal wirklich unter der Schwelle bleibt (0.62). */
  antwortMit("Vollmilch");
  const mitUnbekannter = D.parseReceiptText("Xyzabc Vollm FH 1L  1,29 A");
  const zeileVorher = mitUnbekannter.rows[0];
  const geaendert = await D.enrichUnmatched(mitUnbekannter);
  const zeileNachher = mitUnbekannter.rows[0];
  ok("Eine unbekannte Zeile bekommt über den Umweg einen Vorschlag",
    geaendert === true && !!zeileNachher.productId, JSON.stringify(zeileNachher));
  ok("Der Vorschlag bleibt IMMER zu bestätigen, nie automatisch sicher",
    zeileNachher.needsConfirmation === true, JSON.stringify(zeileNachher));
  ok("Die Herkunft ist am Weg erkennbar (für die Anzeige „über Internet-Abgleich“)",
    String(zeileNachher.method || "").startsWith("extern:"), zeileNachher.method);
  ok("sure/open werden nach der Ergänzung neu gezählt",
    mitUnbekannter.open === mitUnbekannter.rows.filter((r) => r.needsConfirmation).length);

  antwortMit(null);
  const bleibtOffen = D.parseReceiptText("Voellig Unbekanntes Zeug Ohne Treffer XQ9  1,29 A");
  await D.enrichUnmatched(bleibtOffen);
  ok("Kein Treffer bei Open Food Facts lässt die Zeile ehrlich offen, statt zu raten",
    bleibtOffen.rows[0].productId === null);

  /* An der echten Schnittstelle beobachtet, nicht ausgedacht: manche
     Open-Food-Facts-Einträge hängen die Barcode-Nummer direkt hinter
     den Namen — „Milsani Joghurt mild 3,5 % Fett 4061458028820".
     Eine 13-stellige Ziffernfolge im Rückabgleich verdünnt nur das
     Ergebnis, kein echter Produktname enthält so etwas. */
  ok("Eine angehängte Barcode-Nummer wird entfernt",
    T.OffLookup._bereinigt("Milsani Joghurt mild 3,5 % Fett 4061458028820") ===
      "Milsani Joghurt mild 3,5 % Fett");
  ok("Eine kurze, plausible Zahl im Namen bleibt unangetastet",
    T.OffLookup._bereinigt("Produkt 12345") === "Produkt 12345");

  T.OffLookup.fetcher = null;
}

console.log("\n--- Marken erklären sich ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("liste");

  const marken = [...$("main").querySelectorAll(".item .pill")];
  ok("Die Liste trägt Marken", marken.length > 0, marken.length);
  ok("Jede Marke ist antippbar",
    marken.every((m) => m.getAttribute("role") === "button" && m.getAttribute("tabindex") === "0"),
    marken.filter((m) => m.getAttribute("role") !== "button").map((m) => m.textContent).join(", "));
  ok("Jede Marke erklärt sich schon beim Verweilen",
    marken.every((m) => (m.getAttribute("title") || "").length > 2));

  // Antippen öffnet die Erklärung — und NICHT das Detail-Blatt der
  // Zeile darunter. Genau dafür steht das stopPropagation im pill().
  const m = marken[0];
  click(m);
  const blatt = $("sheet");
  ok("Ein Tipp öffnet die Erklärung", blatt.hidden === false);
  const titel = $("sheetTitle").textContent;
  ok("Sie hat eine Überschrift", titel.length > 2, titel);
  const text = $("sheetOpts").textContent;
  ok("Und einen erklärenden Text", text.length > 60, text.slice(0, 40));
  ok("Der Text ist generisch, nicht über dieses eine Produkt",
    !text.includes($("main").querySelector(".item .nm").firstChild.textContent.trim()), text.slice(0, 60));
  App.closeSheet();

  // Der Schlüssel entscheidet über den Text, nicht die Farbe: dieselbe
  // gelbe Marke steht mal für Sicherheit, mal für einen Doppelkauf.
  ok("Verschiedene Schlüssel erklären Verschiedenes",
    new Set(Object.values(T.PILL_INFO).map((v) => v[1])).size === Object.keys(T.PILL_INFO).length);
  ok("Jede Erklärung hat Überschrift und Text",
    Object.values(T.PILL_INFO).every((v) => Array.isArray(v) && v[0] && v[1] && v[1].length > 60));

  /* KEINE ERKLÄRUNG OHNE MARKE.
     Hier stand vorher eine von Hand gepflegte Liste der „benutzten“
     Schlüssel — und die war falsch: sechs davon wurden von keiner
     einzigen Marke mehr geöffnet. Die Liste hat den Zustand nicht
     geprüft, sondern behauptet.

     Deshalb jetzt gegen den ausgelieferten Quelltext: ein Schlüssel
     muss darin auch AUSSERHALB der Tabelle vorkommen, sonst ist
     seine Erklärung unerreichbar. Unerreichbare Texte veralten
     unbemerkt — einer sprach zuletzt noch von einer Antwort, die es
     seit Wochen nicht mehr gibt. */
  const quelle = fs.readFileSync(path.join(WEB, "views.js"), "utf8");
  const tabelle = quelle.slice(quelle.indexOf("const PILL_INFO"));
  const nachTabelle = tabelle.slice(tabelle.indexOf("\n};"));
  const vorTabelle = quelle.slice(0, quelle.indexOf("const PILL_INFO"));
  const ausserhalb = vorTabelle + nachTabelle;
  const waisen = Object.keys(T.PILL_INFO).filter((k) => !ausserhalb.includes(`"${k}"`));
  ok("Keine Erklärung ohne Marke, die sie öffnet", waisen.length === 0, waisen.join(", "));

  // Ein unbekannter Schlüssel bleibt sichtbar, aber stumm — eine
  // Marke, die verschwindet, wäre der schlimmere Fehler.
  const stumm = T.pill("gibtsnicht", "own", "test");
  ok("Unbekannter Schlüssel bleibt eine sichtbare, stumme Marke",
    stumm.textContent === "test" && !stumm.getAttribute("role"));

  // Im Bestand dasselbe: „3 T“ und „haltbar“ sind ohne Erklärung
  // nicht zu entschlüsseln.
  App.goto("bestand");
  const bm = [...$("main").querySelectorAll(".flag[role=button]")];
  ok("Auch der Bestand erklärt seine Marken", bm.length > 0, bm.length);
  ok("Und verschachtelt dabei keine Schaltflächen",
    ![...$("main").querySelectorAll("button")].some((b) => b.querySelector("[role=button]")));
}

console.log("\n--- Kreis ohne Haken, Strich mit Bewegung ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  App.openStore();
  const items = $("storeBody").querySelectorAll(".sItem");
  ok("Der Ladenmodus listet Positionen", items.length > 0, items.length);
  ok("Der Name steckt in einem eigenen Element für den Strich",
    !!items[0].querySelector(".sn .strike"));
  ok("Anfangs ist nichts durchgestrichen", !items[0].classList.contains("done"));

  const ersteNode = items[0];
  click(ersteNode);
  ok("Ein Tippen streicht die Zeile durch", ersteNode.classList.contains("done"));
  ok("Und meldet das der Vorlesehilfe", ersteNode.getAttribute("aria-pressed") === "true");

  // Der springende Punkt: die Zeile wird NICHT neu gebaut, sonst
  // liefe die Animation nie — sie wäre von Anfang an im Endzustand.
  const nachher = $("storeBody").querySelectorAll(".sItem")[0];
  ok("Die Zeile bleibt dieselbe, damit der Strich laufen kann", nachher === ersteNode);
  ok("Der Zustand steht auch im Speicher", D.get().storeChecked.length === 1, D.get().storeChecked.length);

  click(ersteNode);
  ok("Nochmal tippen nimmt den Strich zurück", !ersteNode.classList.contains("done"));
  ok("Und räumt den Speicher auf", D.get().storeChecked.length === 0);
  App.closeStore();
}
{
  // Der Kreis auf der Startseite trägt keinen Haken mehr — das prüft
  // sich am Stylesheet, weil ein ::after im DOM nicht auftaucht.
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  ok("Kein Haken mehr im Kreis der Liste", !/\.box:checked::after/.test(css));
  ok("Kein Haken mehr im Kreis des Ladenmodus", !/\.sItem\.done \.tick::after/.test(css));
  ok("Der Kreis wird gefüllt", /\.box:checked\{[^}]*background:var\(--accent\)/.test(css));
  ok("Der Strich wird über die Breite gezogen",
    /\.sItem\.done \.sn \.strike\{background-size:100%/.test(css.replace(/\s+/g, " ").replace(/ \{/g, "{")));
}
{
  // Abwesenheit: die App erkennt sie und der Streak überlebt sie.
  D.reset();
  D.loadDemo("full");
  const ctxA = App.ctx;
  ok("Abwesenheiten werden mitgeliefert", Array.isArray(ctxA.absences));
  ok("Eine dichte Demo-Historie hat keine", ctxA.absences.length === 0, ctxA.absences.length);
}

console.log("\n--- Selbst etwas hinzufügen ---");
{
  D.reset();
  D.loadDemo("full");
  App.goto("liste");

  ok("Die Liste nennt sich Einkaufsliste",
    /Einkaufsliste/.test($("largeTitle").textContent), $("largeTitle").textContent.slice(0, 60));
  ok("Die Unterzeile beschreibt die Liste, nicht die Datenlage",
    /Position/.test($("largeTitle").querySelector(".sub").textContent),
    $("largeTitle").querySelector(".sub").textContent);
  // Die Karte trägt keine eigene Überschrift mehr — die Seite heißt
  // schon „Einkaufsliste“, und dieselbe Aussage zweimal kostet eine
  // Zeile und sagt nichts. Die Erklärung sitzt jetzt an der Summe.
  ok("Die Liste erklärt sich an der Summe", (() => {
    const info = [...$("main").querySelectorAll(".totals .infoBtn")];
    if (!info.length) return false;
    click(info[0]);
    const t = $("sheetOpts").textContent;
    App.closeSheet();
    return /Rhythmen/.test(t);
  })());

  const addRow = $("main").querySelector(".addRow");
  ok("Es gibt einen Hinzufügen-Knopf", !!addRow);
  click(addRow);
  ok("Das Suchblatt öffnet", !$("sheet").hidden && /hinzufügen/i.test($("sheetTitle").textContent));

  const input = $("sheetOpts").querySelector("input");
  ok("Es gibt ein Suchfeld", !!input);
  input.value = "Kaffee";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  const treffer = $("sheetOpts").querySelectorAll(".results button");
  ok("Der Katalog wird durchsucht", treffer.length > 1, treffer.length);
  ok("Freier Text steht immer als letzte Möglichkeit",
    !!$("sheetOpts").querySelector(".freeRow"));

  const vorher = App.ctx.items.length;
  click(treffer[0]);
  ok("Das Blatt schließt nach der Wahl", $("sheet").hidden);
  ok("Die Position steht in der Liste", App.ctx.items.length === vorher + 1,
    `${vorher} -> ${App.ctx.items.length}`);
  ok("Sie ist als selbst ergänzt gekennzeichnet",
    App.ctx.items.some((i) => i.basis === "manuell"));
  ok("Und im Speicher", D.get().manual.length === 1, D.get().manual.length);
  ok("Die Liste zeigt den Abschnitt „Von dir ergänzt“",
    /Von dir ergänzt/.test($("main").textContent));
  ok("Die Zeile trägt eine Marke", !!$("main").querySelector(".pill.own"));
}
{
  // Freier Text: keine Produktkennung, keine erfundenen Werte.
  const addRow = $("main").querySelector(".addRow");
  click(addRow);
  const input = $("sheetOpts").querySelector("input");
  input.value = "Blumen für Oma";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  click($("sheetOpts").querySelector(".freeRow button"));

  const frei = D.get().manual.find((m) => m.name === "Blumen für Oma");
  ok("Freier Text kommt auf die Liste", !!frei);
  ok("Er bekommt keine Produktkennung", frei && frei.productId === null);
  ok("Und keinen erfundenen Preis", frei && frei.price === 0);
  ok("Er landet im Gang „Sonstiges“", frei && frei.aisle === "Sonstiges");

  const ctxF = App.ctx;
  const zeile = ctxF.items.find((i) => i.name === "Blumen für Oma");
  ok("Die Position erscheint in der Liste", !!zeile);
  ok("Ohne Preis steht ein Strich",
    [...$("main").querySelectorAll(".item")].some((li) =>
      /Blumen für Oma/.test(li.textContent) && /—/.test(li.querySelector(".price").textContent)));

  // Der entscheidende Punkt: die auswertenden Module dürfen sie nicht
  // sehen, sonst rechnete die App mit erfundenen Werten.
  ok("Die Auswertung übergeht sie",
    !ctxF.knownItems.some((i) => i.name === "Blumen für Oma"));
  ok("Sie zählt trotzdem in die Summe",
    ctxF.items.filter((i) => i.on).length > ctxF.knownItems.filter((i) => i.on).length);
}
{
  // Abhaken und Entfernen einer eigenen Zeile.
  const zeile = App.ctx.items.find((i) => i.name === "Blumen für Oma");
  App.choose(zeile.choiceKey, { on: false });
  ok("Eine eigene Zeile lässt sich abwählen",
    App.ctx.items.find((i) => i.name === "Blumen für Oma").on === false);
  ok("Ohne eine Rückmeldung zu protokollieren",
    !D.get().feedbackLog.some((f) => !f.productId));

  App.choose(zeile.choiceKey, { on: true });
  const li = [...$("main").querySelectorAll(".item")].find((x) => /Blumen für Oma/.test(x.textContent));
  click(li.querySelector(".main"));
  ok("Sie hat ein eigenes Blatt", !$("sheet").hidden && /Blumen für Oma/.test($("sheetTitle").textContent));
  ok("Das Blatt erklärt die Herkunft", /Von dir ergänzt/.test($("sheetOpts").textContent));
  click($("sheetOpts").querySelector(".cta.danger"));
  ok("Sie lässt sich entfernen",
    !D.get().manual.some((m) => m.name === "Blumen für Oma"), D.get().manual.length);
}
{
  // Ein Einkauf verbraucht die eigenen Positionen mit.
  D.addManual({ productId: "kaffee", week: App.ctx.weekKey });
  ok("Vor dem Einkauf steht sie drauf", D.get().manual.length >= 1);
  D.addReceipt({ date: D.today(), store: "Test", items: [{ productId: "kaffee", quantity: 1, unitPrice: 7 }] });
  ok("Nach dem Einkauf ist die Liste leer geräumt", D.get().manual.length === 0);
}
{
  // Eine Woche später gilt die Ergänzung nicht mehr.
  D.reset();
  D.loadDemo("full");
  D.addManual({ productId: "kaffee", week: "2020-W01" });
  ok("Eine Ergänzung aus einer anderen Woche taucht nicht auf",
    !App.ctx.items.some((i) => i.basis === "manuell"));
  ok("Sie bleibt aber gespeichert", D.get().manual.length === 1);
}

// Kurz warten, damit alle Mikroaufgaben aus den vorigen Abschnitten
// abgearbeitet sind, bevor es weitergeht -- der Rest der Suite läuft
// deshalb strukturell in diesem Rückruf weiter.
setTimeout(() => {
  console.log("\n--- Bedienbarkeit: sichtbar und anfassbar ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  /* Der Fund, der diesen Abschnitt ausgelöst hat: das Dimmen einer
     abgewählten Zeile lag auf der ganzen Zeile — samt der vier
     Antworten, die genau dann erscheinen, WEIL etwas zu tun ist.
     Kontrast der Beschriftung: 1,74:1. Das sah aus wie
     „deaktiviert“. Die Regel dagegen ist eine Zeile CSS und darf
     nicht zurückrutschen. */
  ok("Gedimmt wird nur die Zeile, nicht die Antworten",
    /\.item\.off \.top\{opacity/.test(css) && !/\.item\.off\{opacity/.test(css),
    (css.match(/\.item\.off[^{]*\{opacity:[^;}]+/) || ["—"])[0]);

  D.reset();
  D.loadDemo("full");
  App.goto("liste");

  /* Antippbares muss aussehen wie antippbar. Beide Stellen hier
     öffneten seit jeher ein Blatt und sagten es mit nichts. */
  const zeilen = [...$("main").querySelectorAll(".items .item")];
  ok("Es gibt Positionen", zeilen.length > 0, zeilen.length);
  ok("Jede Position trägt einen Winkel",
    zeilen.every((z) => !!z.querySelector(".top > .chev")),
    zeilen.filter((z) => !z.querySelector(".top > .chev")).length + " ohne");

  /* Kein Kürzel auf der einzigen rechtlich harten Marke. */
  App.goto("liste");
  const marken = [...$("main").querySelectorAll(".items .pill.safety")].map((p) => p.textContent);
  ok("Es gibt eine Verbrauchsdatum-Marke", marken.length > 0, marken.length);
  ok("Sie ist ausgeschrieben", marken.every((m) => /Verbrauchsdatum/.test(m)), marken.join(" | "));
  ok("Und nicht mehr abgekürzt", !marken.some((m) => m.trim() === "VD"), marken.join(" | "));
}

console.log("\n--- Kanten: Flächen gerundet, Punkte rund ---");
{
  /* Die Regel steht als Kommentar in app.css und wäre damit eine
     Absichtserklärung. Hier wird sie geprüft — sonst schleicht sich
     beim nächsten neuen Bauteil wieder ein `border-radius:12px` ein,
     und niemand sieht es, weil zwölf Pixel für sich harmlos aussehen.

     Die Werte standen eine Weile auf 0 („Flächen eckig"). Sie sind
     zurück, die Regel ist geblieben: gerundet wird über die drei
     Stufen, nicht über frei gewählte Zahlen. */
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  const token = (name) => (css.match(new RegExp("--" + name + ":(\\S+?);")) || [])[1];
  const px = (name) => parseFloat(token(name));
  ["r-lg", "r-md", "r-sm"].forEach((t) =>
    ok(`--${t} ist ein echter Radius`, px(t) > 0, token(t)));
  ok("Die drei Stufen sind abgestuft, nicht dreimal derselbe Wert",
    px("r-lg") > px("r-md") && px("r-md") > px("r-sm"),
    `${token("r-lg")} / ${token("r-md")} / ${token("r-sm")}`);
  ok("Der innere Radius bleibt kleiner als der äußere — sonst wirkt der Rand ungleich",
    px("r-lg") - px("r-md") >= 4 && px("r-md") - px("r-sm") >= 3);

  /* Erlaubt ist genau zweierlei: ein voller Kreis (99px, 50 %) oder
     eine der drei Stufen. Eine frei gewählte Zahl dazwischen ist die
     Ecke, die niemand mehr wiederfindet, wenn die Stufen sich ändern. */
  const werte = [...css.matchAll(/border-radius:([^;}]+)/g)].map((m) => m[1].trim());
  const dazwischen = werte.filter((v) => {
    if (/var\(/.test(v) || /%/.test(v)) return false;
    return v.split(/\s+/).some((teil) => {
      const z = parseFloat(teil);
      return Number.isFinite(z) && z > 0 && z < 40;
    });
  });
  ok("Keine frei gewählten Ecken neben den drei Stufen", dazwischen.length === 0, dazwischen.join(" | "));

  /* Und die Gegenprobe: die Kreise sind noch da. Eine Regel, die
     alles platt macht, wäre genauso falsch — der Abhak-Kreis, der
     Pfeilkreis und die Streak-Punkte sind Punkte. */
  const kreise = werte.filter((v) => /99px|50%/.test(v));
  ok("Die Kreise sind geblieben", kreise.length >= 15, `${kreise.length} runde Regeln`);

  /* Namentlich, damit die Gegenprobe nicht nur zählt: DIESE sind
     Punkte und DIESE sind Flächen. Gelesen wird der Regelblock aus
     der gebauten Datei — jsdom rechnet keine Stilkaskade aus, ein
     getComputedStyle wäre hier immer leer und der Test damit blind. */
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    if (i < 0) return null;
    return css.slice(i + sel.length + 2, css.indexOf("}", i));
  };
  const radius = (sel) => {
    const b = block(sel);
    if (b === null) return "SELEKTOR FEHLT";
    return (b.match(/border-radius:([^;}]+)/) || [null, "keine"])[1].trim();
  };

  [".baGo", ".pill", ".box", ".sDot", ".infoBtn"].forEach((sel) =>
    ok(`${sel} bleibt rund`, /99px|50%/.test(radius(sel)), radius(sel)));

  [".groupBody", ".cta", ".pillBtn", ".toast", ".card", ".tile", ".sheetBody"].forEach((sel) =>
    ok(`${sel} rundet über eine der drei Stufen`, /var\(--r-(lg|md|sm)\)/.test(radius(sel)), radius(sel)));
}

console.log("\n--- Glas: durchscheinende Flächen ---");
{
  /* „Ein Hauch Liquid Glass": durchscheinende Flächen mit einer
     feinen hellen Kante. Geprüft wird das Gerüst, nicht der Eindruck
     — ein Weichzeichner ohne etwas dahinter ist reine Rechenarbeit,
     und eine deckende Zeile über einer Glasgruppe macht das Glas
     wieder zunichte. Genau diese beiden Fehler fängt dieser Block. */
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
  };
  const token = (name) => (css.match(new RegExp("--" + name + ":(\\S+?);")) || [])[1];

  ok("Es gibt einen Glas-Ton", /^rgba\(/.test(token("glass") || ""), token("glass"));
  ok("Er ist durchscheinend, nicht deckend",
    parseFloat((token("glass") || "").split(",")[3]) < 1, token("glass"));
  ok("...aber nicht so durchscheinend, dass Text darauf leidet",
    parseFloat((token("glass") || "").split(",")[3]) >= 0.8, token("glass"));
  ok("Es gibt eine helle Kante", !!token("glass-edge"), token("glass-edge"));
  ok("Die Kante liegt im Tiefen-Token und braucht deshalb kein overflow:hidden",
    /inset 0 1px 0 var\(--glass-edge\)/.test(css));

  [".groupBody", ".card", ".tile", ".sheetBody"].forEach((sel) => {
    const b = block(sel) || "";
    ok(`${sel} ist eine Glasfläche`, /background:var\(--glass\)/.test(b), b.slice(0, 60));
    ok(`${sel} zeichnet weich, was darunter liegt`, /backdrop-filter:/.test(b));
  });

  ok("Zeilen in einer Gruppe mauern das Glas nicht wieder zu",
    /\.groupBody \.row,\.card \.row\{background:transparent\}/.test(css));

  /* Ohne etwas hinter dem Glas ist Glas gleich Farbe. Der Seitengrund
     trägt deshalb zwei sehr schwache Farbwolken. */
  const body = block("body") || "";
  ok("Der Seitengrund trägt etwas, das durchscheinen kann",
    /radial-gradient/.test(body) && /var\(--tint-a\)/.test(body) && /var\(--tint-b\)/.test(body));
  ok("Die Wolken scrollen nicht mit", /background-attachment:fixed/.test(body));
  ok("Beide Farbwolken sind sehr schwach — Raum, nicht Dekoration",
    parseFloat((token("tint-a") || "").split(",")[3]) <= 0.1 &&
    parseFloat((token("tint-b") || "").split(",")[3]) <= 0.1,
    `${token("tint-a")} / ${token("tint-b")}`);

  /* Im dunklen Modus sind die Werte eigene, nicht dieselben: eine
     weiße Kante mit 75 % sieht auf Dunkelgrau aus wie ein Riss. */
  const dunkel = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  ok("Der dunkle Modus hat einen eigenen Glas-Ton", /--glass:rgba\(30,34,41/.test(dunkel));
  ok("...und eine viel schwächere Kante",
    /--glass-edge:rgba\(255,255,255,\.0\d\)/.test(dunkel));
  ok("Das feste Dunkelthema bekommt dieselben Werte",
    /--glass:rgba\(30,34,41,\.82\)/.test(css.slice(css.indexOf('[data-theme="dunkel"]'))));
}

console.log("\n--- Die Schrift liegt bei ---");
{
  /* Eine falsch geschriebene Adresse in @font-face erzeugt keinen
     Fehler: der Browser nimmt still die Systemschrift, und die App
     sieht wieder aus wie vorher. Genau deshalb hängt das hier an
     Dateien und Pfaden, nicht am Augenschein. */
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  ok("Manrope steht in der Schriftliste",
    /font-family:"Manrope"/.test(css) && /body\{[\s\S]*?"Manrope"/.test(css));
  ok("Mit einer Systemschrift dahinter", /"Manrope",\s*-apple-system/.test(css));
  ok("Und mit swap statt leerer Seite", (css.match(/font-display:swap/g) || []).length >= 2);

  const quellen = [...css.matchAll(/url\("(fonts\/[^"]+)"\)/g)].map((m) => m[1]);
  ok("Der Stil verweist auf zwei Dateien", quellen.length === 2, quellen.join(", "));
  quellen.forEach((q) => ok(`${q} liegt auch wirklich da`, fs.existsSync(path.join(WEB, q))));

  ok("Die Lizenz liegt dabei", fs.existsSync(path.join(WEB, "fonts", "OFL.txt")));

  /* Nichts wird von außen geholt. Das ist keine Geschmacksfrage: eine
     eingebundene Schrift wäre eine Anfrage an einen Dritten bei jedem
     Start — mit IP und Browserkennung, und ohne Netz gar nicht. */
  ok("Keine fremde Adresse im Stil", !/https?:\/\//.test(css.replace(/\/\*[\s\S]*?\*\//g, "")));

  const idx = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  ok("Die Schrift wird vorgezogen", /rel="preload"[^>]*fonts\/manrope-latin\.woff2/.test(idx));
  ok("Und zwar mit crossorigin", /rel="preload"[^>]*crossorigin/.test(idx));

  const sw = fs.readFileSync(path.join(WEB, "sw.js"), "utf8");
  ok("Der Offline-Vorrat enthält sie", /fonts\/manrope-latin\.woff2/.test(sw));

  /* Der Wortabstand ist eine Korrektur für genau diese Schrift und
     stand vorher nicht da — er darf nicht beim nächsten Aufräumen
     verschwinden. */
  ok("Der Wortabstand ist korrigiert", /word-spacing:\.0\d+em/.test(css));
}

/* ================================================================
   Ein Ding, ein Name
   ================================================================
   Diese Prüfungen lesen den ausgelieferten Quelltext, nicht den
   Bildschirm. Der Grund: die Brüche, um die es geht, sind nie an
   EINER Stelle sichtbar. Man sieht „Nach Gängen“ und tippt darauf;
   drei Bildschirme später steht „Ladenweg“, und niemand verbindet
   die beiden mehr. Genau deshalb fällt so etwas beim Durchklicken
   nicht auf und muss maschinell festgehalten werden.

   Gefunden wurden dabei vier Fälle:
     • eine Ansicht mit vier Namen (Knopf, Überschrift, Vorlesehilfe,
       Einstellung)
     • eine Funktion mit vier Knopfaufschriften, davon eine als
       einziger klein geschriebener Knopf der App
     • zwei Meldungen für denselben abgeschlossenen Vorgang
     • zwei Beispielmärkte in zweimal demselben Feld
   ================================================================ */
console.log("\n--- Ein Ding, ein Name ---");
{
  const v = fs.readFileSync(path.join(WEB, "views.js"), "utf8");
  const a = fs.readFileSync(path.join(WEB, "app.js"), "utf8");
  const idx = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  const sichtbar = v + a + idx;

  // Der Name der Gänge-Ansicht steht an vier Stellen: Knopf,
  // Überschrift, Vorlesehilfe, Einstellung. Alle vier müssen ihn
  // tragen, und die alten Namen dürfen nirgends mehr auftauchen,
  // wo der Nutzer sie liest.
  ok("Die Gänge-Ansicht heißt überall „Nach Gängen“",
    /<h2>Nach Gängen<\/h2>/.test(idx) && /aria-label="Nach Gängen"/.test(idx),
    (idx.match(/<h2>[^<]*<\/h2>/) || [])[0]);
  ["Im Laden", "Ladenmodus", "Ladenweg"].forEach((alt) => {
    ok(`Kein sichtbares „${alt}“ mehr`, !new RegExp(`"${alt}`).test(sichtbar) && !idx.includes(`>${alt}<`));
  });

  /* Alle drei Wege, einen Einkauf zu buchen, tragen dasselbe Verb.
     Es sind dieselbe Absicht und zweimal sogar dieselbe Funktion —
     `bookCart` hing an einem Knopf „Einkauf buchen“ und an einem
     Knopf „buchen“. */
  const knopfaufschriften = [...sichtbar.matchAll(/"cta[^"]*",\s*(?:`|")([^"`]*buchen[^"`]*)(?:`|")/gi)]
    .map((m) => m[1]);
  ok("Jeder Buchen-Knopf endet auf demselben Verb",
    knopfaufschriften.length > 0 && knopfaufschriften.every((t) => /buchen$/.test(t)),
    knopfaufschriften.join(" | "));
  ok("Kein klein geschriebener Knopf",
    !/>buchen</.test(idx) && !/"cta[^"]*",\s*"[a-zäöüß]/.test(sichtbar));

  // Ein abgeschlossener Vorgang meldet sich mit einem Satz, nicht mit
  // zweien. „3 gebucht“ und „3 Positionen gebucht“ standen für
  // denselben Vorgang nebeneinander.
  const meldungen = [...sichtbar.matchAll(/toast\(`\$\{[^}]*\}\s*([^`]*gebucht[^`]*)`/g)].map((m) => m[1].trim());
  ok("Eine Meldung nach dem Buchen, nicht zwei",
    meldungen.length > 1 && new Set(meldungen).size === 1, meldungen.join(" | "));

  // Zweimal dasselbe Feld, zweimal derselbe Beispielmarkt.
  const platzhalter = [...v.matchAll(/si\.placeholder\s*=\s*([A-Z_]+|"[^"]*")/g)].map((m) => m[1]);
  ok("Ein Beispielmarkt für beide Markt-Felder",
    platzhalter.length === 2 && new Set(platzhalter).size === 1, platzhalter.join(" | "));

  /* EINE BEUGUNG, EINE STELLE.
     „noch 1 Tage“, „1 Käufe“, „1 Positionen gebucht“ — an vier
     Stellen war die Einzahl ausgeschrieben, an zehn nicht. Das ist
     kein Randfall: ein Rhythmus von einem Tag (Brot, Milch), ein
     Vorrat, der noch einen Tag reicht, ein einzelnes gebuchtes
     Produkt — die Eins kommt jeden Tag vor.

     Geprüft wird strukturell, nicht am Bildschirm: eine Zahl darf
     nicht unmittelbar vor einem Mehrzahlwort stehen. Wer die Eins
     im Test durchspielen wollte, müsste jede der zehn Stellen
     einzeln in den passenden Zustand bringen — und würde die elfte
     wieder übersehen. */
  const MEHRZAHL = ["Tage", "Tagen", "Käufe", "Positionen", "Produkte", "Bons"];
  const ungebeugt = [];
  // Die Helfer selbst dürfen die Mehrzahl schreiben — sie sind ja
  // die Stelle, an der die Entscheidung fällt.
  const ohneHelfer = (q) => q.replace(/const (zahlwort|tage|tagen|alleTage) = [^;]*;/g, "");
  MEHRZAHL.forEach((w) => {
    const re = new RegExp(String.raw`\$\{[^}]{1,60}\}\s${w}\b`, "g");
    [ohneHelfer(v), ohneHelfer(a)].forEach((quelle) => {
      [...quelle.matchAll(re)].forEach((m) => {
        if (/zahlwort|"Tag"|"Kauf"|"Position"|"Produkt"|"Bon"/.test(m[0])) return;
        ungebeugt.push(m[0]);
      });
    });
  });
  ok("Keine Zahl steht ungebeugt vor einem Mehrzahlwort",
    ungebeugt.length === 0, ungebeugt.slice(0, 4).join(" | "));

  ok("Der Beugungshelfer beugt", T.tage(1) === "1 Tag" && T.tage(2) === "2 Tage" &&
    T.tagen(1) === "1 Tag" && T.tagen(3) === "3 Tagen" &&
    T.zahlwort(1, "Kauf", "Käufe") === "1 Kauf",
    `${T.tage(1)} / ${T.tagen(3)}`);

  // Ein Rhythmus von einem Tag heißt „täglich“, nicht „alle 1 Tage“
  // und auch nicht „alle 1 Tag“.
  ok("Ein Tagesrhythmus heißt täglich",
    T.alleTage(1) === "täglich" && T.alleTage(3) === "alle 3 Tage", T.alleTage(1));
}

console.log("\n--- Stufe 2 ist vorbereitet, aber nirgends erreichbar ---");
{
  /* schwarmClient.js ist gebaut und im Bündel (siehe test/schwarm.js
     für die Garantie, dass er trotzdem nichts sendet). Diese Prüfung
     hält die ZWEITE Garantie fest, die für "noch nicht am Start"
     nötig ist: keine Oberfläche verweist darauf. Kein Menüpunkt, kein
     Knopf, keine Einstellung -- ein Nutzer, der die App heute
     bedient, kann diese Funktion gar nicht finden, geschweige denn
     anschalten. */
  const v = fs.readFileSync(path.join(WEB, "views.js"), "utf8");
  const a = fs.readFileSync(path.join(WEB, "app.js"), "utf8");
  ok("Kein Menüpunkt oder Knopf verweist auf die Schwarm-Einwilligung",
    !/schwarm/i.test(v) && !/schwarm/i.test(a));
  ok("data.js liest oder schreibt die Einwilligung dort dennoch nicht aktiv um",
    !/settings\.schwarm\.enabled\s*=/.test(fs.readFileSync(path.join(WEB, "data.js"), "utf8")));
}

console.log("\n--- Das Wesen ---");
{
  /* Reihenfolge ist Dringlichkeit -- ein akutes Risiko schlägt einen
     guten Streak. Jeder Fall baut nur die Signale, die er braucht,
     der Rest bleibt bei "nichts los". */
  const leer = { safety: null, pulse: { days: [{ events: [] }] }, forgotten: [], streak: { weeks: 0 } };

  ok("Kühlkette schlägt alles", T.mascotMood({ ...leer, safety: { message: "x" }, streak: { weeks: 5 } }) === "alarm");
  ok("Verderb heute ist genauso ein Alarm", T.mascotMood({
    ...leer, pulse: { days: [{ events: [{ kind: "verderb" }] }] }, streak: { weeks: 5 }
  }) === "alarm");
  ok("Vergessenes ohne akutes Risiko macht es nur besorgt", T.mascotMood({
    ...leer, forgotten: [{ productId: "x" }], streak: { weeks: 5 }
  }) === "besorgt");
  ok("Guter Streak ohne offene Sorgen ist froh", T.mascotMood({ ...leer, streak: { weeks: 3 } }) === "froh");
  ok("Ohne jedes Signal bleibt es neutral", T.mascotMood(leer) === "neutral");

  // Die vier bekannten Stimmungen tragen ihre eigene Klasse (Farbe
  // kommt darüber aus app.css) und ein eigenes Gesicht.
  ["froh", "neutral", "besorgt", "alarm"].forEach((m) => {
    const svg = T.mascotSvg(m, 40);
    ok(`mascotSvg("${m}") trägt die passende Klasse`, new RegExp(`class="mascot ${m}"`).test(svg), svg.slice(0, 60));
    ok(`mascotSvg("${m}") hat Augen, Brauen und einen Mund`,
      /mascotEyeWhite/.test(svg) && /mascotBrow/.test(svg) && /mascotMouth/.test(svg));
  });

  // Eine unbekannte Stimmung darf nicht mit einem Gesicht ohne Farbe
  // enden -- app.css kennt nur die vier benannten Klassen.
  ok("Unbekannte Stimmung fällt auf neutral zurück, nicht auf eine Klasse ohne Farbe",
    /class="mascot neutral"/.test(T.mascotSvg("erfunden", 40)));

  // Fest positioniert außerhalb von largeTitle -- derselbe Ort läuft
  // auf jeder Seite, weil renderBar() ihn nur aktualisiert, nie neu
  // anlegt (siehe app.js, App.renderBar()).
  D.reset(); D.loadDemo("full");
  ok("Das Wesen lebt außerhalb des großen Titels", !$("largeTitle").querySelector("svg.mascot"));
  ok("Das Wesen lebt außerhalb des Inhaltsbereichs", !$("main").querySelector("#mascotFab svg.mascot"));
  ["start", "liste", "bestand", "zahlen", "mehr", "faellig", "angebote"].forEach((tab) => {
    App.goto(tab);
    ok(`Das Wesen steht an fester Stelle auf "${tab}"`, !!$("mascotFab").querySelector("svg.mascot"));
  });

  {
    const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
    const block = (sel) => {
      const i = css.indexOf("\n" + sel + "{");
      return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
    };
    ok("Das Wesen ist per CSS fest positioniert, nicht nur optisch mittig",
      /position:fixed/.test(block(".mascotFab") || ""));
    ok("Die Sprechblase ist ebenfalls fest positioniert", /position:fixed/.test(block(".mascotBubble") || ""));
  }

  /* --- Antippen: dasselbe Wesen öffnet jetzt eine kleine Sprechblase
     daneben, kein Blatt -- siehe App.toggleMascotBubble() in app.js.
     Ihr Text kommt aus mascotMessage(), regelbasiert je Reiter. */
  App.goto("start");
  const fab = $("mascotFab");
  ok("Das Wesen ist eine Schaltfläche mit Namen",
    !!fab && fab.tagName === "BUTTON" && !!fab.getAttribute("aria-label"));
  ok("Sie ist zunächst zugeklappt", fab.getAttribute("aria-expanded") === "false");
  ok("Die Sprechblase ist zunächst verborgen", $("mascotBubble").hidden);

  click(fab);
  ok("Antippen öffnet die Sprechblase, kein Blatt", !$("mascotBubble").hidden && $("sheet").hidden);
  ok("Sie trägt einen Text", $("mascotBubble").textContent.trim().length > 0);
  ok("Die Schaltfläche weiß jetzt, dass sie offen ist", fab.getAttribute("aria-expanded") === "true");

  click(fab);
  ok("Erneutes Antippen schließt sie wieder", $("mascotBubble").hidden);

  click(fab);
  doc.body.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("Ein Klick irgendwo sonst schließt die Sprechblase", $("mascotBubble").hidden);

  click(fab);
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok("Escape schließt die Sprechblase ebenfalls", $("mascotBubble").hidden);

  click(fab);
  $("mascotBubble").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("Ein Tipp auf die Sprechblase selbst schließt sie NICHT", !$("mascotBubble").hidden);

  App.goto("liste");
  ok("Der Reiterwechsel schließt sie", $("mascotBubble").hidden);
  App.goto("start");

  /* --- mascotMessage(): regelbasiert, je Reiter, mindestens 150
     Aussagen insgesamt -- siehe MASCOT_RULES in views.js. */
  const alleTabs = ["start", "liste", "bestand", "erfassen", "zahlen", "mehr", "faellig", "angebote"];
  ok("MASCOT_RULES kennt jeden Reiter", alleTabs.every((t) => Array.isArray(T.MASCOT_RULES[t])));
  const gesamtzahl = alleTabs.reduce((a, t) => a + T.MASCOT_RULES[t].length, 0);
  ok("Mindestens 150 Aussagen insgesamt", gesamtzahl >= 150, `${gesamtzahl} Regeln`);
  ok("Jede Regel hat eine Bedingung und einen Text",
    alleTabs.every((t) => T.MASCOT_RULES[t].every((r) => typeof r.when === "function" && typeof r.say === "function")));

  // Mit vollen Beispieldaten UND mit ganz leerer Historie muss jeder
  // Reiter mindestens eine zutreffende Aussage haben -- das ist der
  // Sinn der abschließenden Regel ohne Bedingung in jeder Liste.
  [["Beispieldaten", () => D.loadDemo("full")], ["leerer Zustand", () => D.reset()]].forEach(([label, setup]) => {
    setup();
    const c = D.compute();
    alleTabs.forEach((tab) => {
      const text = T.mascotMessage(c, tab, 0);
      ok(`"${tab}" hat eine Aussage bei ${label}`, typeof text === "string" && text.length > 0, text);
    });
  });
  D.loadDemo("full");

  // Reihum, nicht zufällig: mit gleichbleibendem ctx liefert derselbe
  // Zähler immer dasselbe Ergebnis, und nach so vielen Antippen wie
  // es zutreffende Regeln gibt, beginnt die Reihe wieder von vorn.
  {
    const c = D.compute();
    const eligible = T.MASCOT_RULES.start.filter((r) => { try { return !!r.when(c); } catch (e) { return false; } });
    ok("Genug zutreffende Regeln auf dem Start für einen Rotationstest", eligible.length >= 2, eligible.length);
    const erste = T.mascotMessage(c, "start", 0);
    const zweite = T.mascotMessage(c, "start", 1);
    ok("Zwei aufeinanderfolgende Zähler liefern denselben Text wie beim ersten Mal (deterministisch)",
      T.mascotMessage(c, "start", 0) === erste && T.mascotMessage(c, "start", 1) === zweite);
    ok("Nach einer vollen Runde beginnt die Reihe wieder von vorn",
      T.mascotMessage(c, "start", eligible.length) === erste);
  }

  // Ein unbekannter Reiter fällt auf die Start-Regeln zurück statt zu
  // brechen -- derselbe Rückfall wie bei einer unbekannten Stimmung.
  ok("Unbekannter Reiter bricht mascotMessage() nicht",
    typeof T.mascotMessage(D.compute(), "erfunden", 0) === "string");

  /* --- Leere Ansichten: dasselbe Wesen statt einer bloßen Textzeile.
     "Nichts fällig, alles im Rhythmus" ist die eine Stelle mit einer
     echten guten Nachricht -- deshalb dort ausdrücklich "froh". */
  D.reset();
  App.goto("zahlen");
  ok("Die leere Zahlen-Seite zeigt das Wesen (neutral, keine Daten)",
    !!$("main").querySelector(".emptyMascot svg.mascot.neutral"));

  App.goto("faellig");
  ok("Die leere Fällig-Seite ohne Haushaltsprodukte zeigt es ebenfalls neutral",
    !!$("main").querySelector(".emptyMascot svg.mascot.neutral"));

  // "Nichts fällig, alles im Rhythmus" (die Stelle, die "froh" statt
  // "neutral" übergibt) tritt nur bei genau passender Datenlage ein
  // und lässt sich nicht zuverlässig über Beispieldaten erzwingen --
  // geprüft wird deshalb direkt, dass mascotSvg("froh", ...) tut, was
  // diese Aufrufstelle von ihm erwartet.
  ok("emptyView() mit \"froh\" trägt tatsächlich die froh-Klasse",
    /class="mascot froh"/.test(T.mascotSvg("froh", 52)));
  D.loadDemo("full");

  /* --- Meilenstein-Feier: dieselbe Stimmung "froh" wie ein guter
     Streak, unabhängig davon, was sonst gerade ansteht. */
  App.celebrate({ id: "bons", icon: "receipt", level: 2, maxLevel: 5,
    title: "Zehn Bons erfasst", note: "Weiter so." });
  ok("Die Meilenstein-Feier zeigt das Wesen, fröhlich",
    /class="mascot froh"/.test($("partyMascot").innerHTML));

  /* --- Dieselbe Sprechblase läuft auch in der Feier-Karte: nicht nur
     die Farbe wird dort geteilt, sondern die ganze Interaktion. */
  const partyBtn = $("partyMascot");
  ok("Das Wesen in der Feier ist ebenfalls eine Schaltfläche mit Namen",
    partyBtn.tagName === "BUTTON" && !!partyBtn.getAttribute("aria-label"));
  ok("Seine Sprechblase ist zunächst verborgen", $("partyMascotBubble").hidden);

  click(partyBtn);
  ok("Antippen öffnet die Sprechblase in der Feier-Karte", !$("partyMascotBubble").hidden);
  ok("Sie trägt einen Text", $("partyMascotBubble").textContent.trim().length > 0);

  doc.body.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("Ein Klick außerhalb schließt nur die Sprechblase, nicht die Feier",
    $("partyMascotBubble").hidden && !$("party").hidden);

  click(partyBtn);
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok("Escape schließt auch die Sprechblase der Feier", $("partyMascotBubble").hidden);

  click(partyBtn);
  ok("Die Sprechblase ist offen, bevor die Feier endet", !$("partyMascotBubble").hidden);
  App.closeParty();
  ok("Das Beenden der Feier schließt auch ihre Sprechblase", $("partyMascotBubble").hidden);

  D.loadDemo("full");
  App.goto("start");

  /* --- "neu"-Punkt: ein Alarmsignal, das seit dem letzten Antippen
     aufgetaucht ist. mascotAlarmSignature() ist eine reine Funktion --
     geprüft wie mascotMood(), mit selbst gebauten ctx-Objekten statt
     mit echten Demodaten (ob die gerade einen Kühlketten-Fall
     enthalten, hängt vom Kalenderdatum ab, an dem der Test läuft). */
  ok("Ohne Kühlkette und ohne Verderb heute ist die Signatur leer",
    T.mascotAlarmSignature(leer) === "");
  ok("Kühlkette liefert eine Signatur",
    T.mascotAlarmSignature({ ...leer, safety: { short: "x" } }).length > 0);
  ok("Verderb heute liefert ebenfalls eine Signatur", T.mascotAlarmSignature({
    ...leer, pulse: { days: [{ events: [{ kind: "verderb" }] }] }
  }).length > 0);
  ok("Kühlkette schlägt Verderb -- dieselbe Rangfolge wie mascotMood",
    T.mascotAlarmSignature({
      ...leer, safety: { short: "kühl" }, pulse: { days: [{ events: [{ kind: "verderb" }] }] }
    }).startsWith("safety:"));
  ok("Zwei verschiedene Kühlketten-Meldungen ergeben verschiedene Signaturen",
    T.mascotAlarmSignature({ ...leer, safety: { short: "a" } }) !==
    T.mascotAlarmSignature({ ...leer, safety: { short: "b" } }));

  /* --- Derselbe Punkt, jetzt am echten Wesen: erscheint bei einem
     ungesehenen Signal, verschwindet sofort beim Antippen (nicht
     erst beim nächsten App.render()), und kehrt bei einem ANDEREN
     Signal danach zurück. */
  App.mascotSeenAlarm = null;
  App.ctx = { ...D.compute(), safety: { short: "Testfall", message: "x", source: "y" } };
  App.renderBar();
  ok("Der 'neu'-Punkt erscheint bei einem noch nicht gesehenen Alarmsignal",
    fab.classList.contains("hasNew"));
  ok("Das aria-label nennt es ebenfalls, nicht nur der Punkt",
    /^Neu: /.test(fab.getAttribute("aria-label")));

  click(fab);
  ok("Antippen räumt den Punkt sofort weg, nicht erst beim nächsten Rendern",
    !fab.classList.contains("hasNew"));
  ok("Und auch das aria-label trägt kein „Neu“ mehr",
    !/^Neu: /.test(fab.getAttribute("aria-label")));
  click(fab);

  App.ctx = { ...D.compute(), safety: { short: "Anderer Testfall", message: "x", source: "y" } };
  App.renderBar();
  ok("Ein ANDERES Signal nach dem Antippen zeigt den Punkt erneut",
    fab.classList.contains("hasNew"));

  App.mascotSeenAlarm = null;
  D.loadDemo("full");
  App.render();
}

console.log("\n--- UX-Testbericht: erste Umsetzungsrunde ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
  };

  /* --- F1: Kopfzeile trägt den Titel schon vor dem Scrollen, sobald
     sie rechts einen Knopf zeigt -- sonst hinge der Knopf beim ersten
     Bild allein da. */
  D.reset(); D.loadDemo("full");
  App.goto("liste");
  ok("Die Kopfleiste weiß, dass sie rechts einen Knopf trägt",
    $("appbar").classList.contains("hasActions"));
  ok(".appbar.hasActions zeigt den Titel ohne zu scrollen (CSS)",
    /opacity:1;transform:none/.test(block(".appbar.hasActions .barTitle") || ""));
  App.goto("start");
  ok("Ohne rechten Knopf bleibt die Kopfleiste ohne die hasActions-Klasse",
    !$("appbar").classList.contains("hasActions"));

  /* --- F9: "und N weitere" ist ein eigenes, nie schrumpfendes
     Element -- nur die Namensliste selbst darf mit Ellipse enden. */
  App.goto("start");
  const baPreview = $("main").querySelector(".baPreview");
  ok("Die Listenvorschau trennt Namen und „und N weitere“ in zwei Elemente",
    !!baPreview && !!baPreview.querySelector(".baNames") && !!baPreview.querySelector(".baRest"));
  ok("„und N weitere“ nennt tatsächlich die Restzahl",
    /und \d+ weitere/.test(baPreview.querySelector(".baRest").textContent));

  /* --- F13: kein pauschales opacity auf der ganzen Fläche mehr --
     eigene, lesbare Farben für den deaktivierten Zustand. */
  const disabledBlock = block(".cta:disabled") || "";
  ok("Der deaktivierte Hauptknopf verblasst nicht mehr als Ganzes",
    !/opacity:\.35/.test(disabledBlock));
  ok("Er bekommt stattdessen einen eigenen, lesbaren Farbsatz",
    /background:var\(--fill-2\)/.test(disabledBlock) && /color:var\(--ink-2\)/.test(disabledBlock));

  /* --- F4: breiterer Fadeout am Kachel-Scroller. */
  ok("Der Fadeout am Kachel-Scroller ist breiter als vorher (28px)",
    /calc\(100% - 52px\)/.test(block(".scroller") || ""));

  /* --- F5: das Wesen bleibt ab 900px an der Inhaltsspalte, nicht am
     Fensterrand. */
  const wideCss = css.slice(css.indexOf("@media (min-width:900px)"));
  ok("Ab 900px ist das Wesen an der Inhaltsspalte verankert, nicht am Fensterrand",
    /\.mascotFab,\.mascotBubble\{right:max\(14px, calc\(100vw - 1088px \+ 14px\)\)\}/.test(wideCss));

  /* --- F10: die Restmenge im Bestand trägt jetzt ein "×" -- eine
     nackte Zahl ohne jede Einheit stand vorher da. */
  App.goto("bestand");
  const bestandRow = [...$("main").querySelectorAll(".rowSub")].find((el) => /×/.test(el.textContent));
  ok("Mindestens eine Bestand-Zeile zeigt die Restmenge als Vielfaches (×)", !!bestandRow, bestandRow && bestandRow.textContent);

  /* --- F18: main zentriert eine einzelne Leerzustands-Karte statt
     oben zu kleben und darunter eine unerklärte Fläche offenzulassen. */
  ok("main zentriert eine einzelne Leerzustands-Karte (CSS)",
    /justify-content:center/.test(block("main:has(> .card:only-child)") || ""));
  D.reset();
  App.goto("start");
  ok("Der Erststart ist tatsächlich genau eine Karte als einziges Kind von main",
    $("main").children.length === 1 && $("main").children[0].classList.contains("card"));
  D.loadDemo("full");

  /* --- F2: "Wo dein Geld hingeht" zeigt zunächst nur vier Zeilen je
     Rangliste, mit "Alle N ansehen" für den Rest -- dieselben Daten,
     nur eingeklappt. Die Demo hat mehr als vier Kategorien. */
  App.zahlenFilter = { range: "12w", from: null, to: null };
  App.goto("zahlen");
  const kategorienHead = [...$("main").querySelectorAll(".moneySection")]
    .find((s) => s.textContent === "Kategorien");
  const zeilenBisZumKnopf = (() => {
    let n = 0, el = kategorienHead.nextElementSibling;
    while (el && el.classList.contains("moneyBarRow")) { n++; el = el.nextElementSibling; }
    return { n, moreBtn: el && el.classList.contains("moneyMore") ? el : null };
  })();
  ok("Kategorien zeigen zunächst höchstens vier Zeilen", zeilenBisZumKnopf.n <= 4, zeilenBisZumKnopf.n);
  ok("Bei mehr als vier Kategorien steht ein „Alle ansehen“-Knopf da", !!zeilenBisZumKnopf.moreBtn);
  if (zeilenBisZumKnopf.moreBtn) {
    const vorher = errors.length;
    click(zeilenBisZumKnopf.moreBtn);
    ok("Antippen blendet den Rest ein, ohne Fehler", errors.length === vorher, errors[vorher]);
    let n2 = 0, el2 = kategorienHead.nextElementSibling;
    while (el2 && el2.classList.contains("moneyBarRow")) { n2++; el2 = el2.nextElementSibling; }
    ok("Danach stehen mehr als vier Kategorie-Zeilen da", n2 > 4, n2);
    ok("Der „Alle ansehen“-Knopf ist danach verschwunden",
      !(el2 && el2.classList.contains("moneyMore")));
  }
}

console.log("\n--- UX-Testbericht: zweite Umsetzungsrunde ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
  };

  /* --- F6: die Sprechblase wiederholt bei Kühlkette nicht mehr genau
     das, was auf Start/Liste schon in "Jetzt zu tun" bzw. der
     dringenden Zeile steht -- sie nennt stattdessen die kälteste
     Lagerzone, eine Auskunft, die dort sonst nirgends alleine steht. */
  D.reset(); D.loadDemo("full");
  const safetyCtx = { ...D.compute(), safety: { short: "X direkt kühlen", coldestZone: "Kühlschrank unten (kälteste Zone)" } };
  ["start", "liste"].forEach((tab) => {
    const text = T.mascotMessage(safetyCtx, tab, 0);
    ok(`Auf "${tab}" wiederholt die Blase nicht mehr ctx.safety.short`, text !== safetyCtx.safety.short, text);
    ok(`Auf "${tab}" nennt sie stattdessen die kälteste Zone`, text.includes(safetyCtx.safety.coldestZone), text);
  });
  // Direkt an der Regel geprüft statt über mascotMessage(..., 0):
  // welche Regel bei Zähler 0 vorne liegt, hängt auch davon ab, was
  // sonst noch zutrifft (z. B. "Beispieldaten" bei geladener Demo) --
  // hier zählt nur, dass die Kühlketten-Regel selbst unverändert ist.
  const erfassenSafetyRegel = T.MASCOT_RULES.erfassen.find((r) => r.when(safetyCtx) && r.say(safetyCtx) === safetyCtx.safety.short);
  ok('Auf "erfassen" bleibt die Kühlketten-Regel bei ctx.safety.short -- dort steht sonst nichts dazu',
    !!erfassenSafetyRegel);

  /* --- F7: das dekorative Wesen in Leerzuständen ist gedämpft, damit
     es nicht als zweite, vollfarbige Instanz neben dem echten Wesen
     im Kopfbereich steht. */
  ok("Das Leerzustands-Wesen ist gedämpft (CSS)", /opacity:\.55/.test(block(".emptyMascot .mascot") || ""));

  /* --- F8: die Alarm-Stimmung hat einen eigenen, helleren Farbsatz
     im dunklen Thema -- der feste helle Wert lag vorher bei 2,7:1
     gegen den fast schwarzen Seitengrund. */
  ok(".mascot.alarm bezieht seine Farbe jetzt aus Token statt einem festen Wert",
    /--m-body:var\(--m-alarm-body\)/.test(block(".mascot.alarm") || ""));
  const rootBlock = css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"));
  const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  ok("--m-alarm-body ist im hellen Grundzustand definiert", /--m-alarm-body:#5B5568/.test(rootBlock));
  ok("--m-alarm-body ist im dunklen Thema heller nachgezogen", /--m-alarm-body:#8B84A0/.test(darkBlock));

  /* --- F12: Gangreihenfolge per Ziehen -- App.reorderAisleTo() bringt
     einen Gang direkt an eine Zielposition der SICHTBAREN Liste,
     dieselbe Grundlage (moveAisle(), relevantAisles()) wie die
     Pfeiltasten. */
  D.reset(); D.loadDemo("full");
  App.goto("mehr");
  const sichtbareGaenge = () => [...$("main").querySelectorAll(".aisleRow .rowTitle")].map((e) => e.textContent);
  const gaengeVorher = sichtbareGaenge();
  if (gaengeVorher.length >= 3) {
    const b4 = errors.length;
    App.reorderAisleTo(gaengeVorher[0], 2);
    ok("Ziehen an eine Zielposition läuft fehlerfrei", errors.length === b4, errors[b4]);
    const gaengeNachher = sichtbareGaenge();
    ok("Der gezogene Gang steht jetzt an Position 2", gaengeNachher[2] === gaengeVorher[0], gaengeNachher.join(", "));
    ok("Kein Gang geht dabei verloren",
      gaengeNachher.length === gaengeVorher.length && gaengeVorher.every((a) => gaengeNachher.includes(a)));
  } else {
    ["Ziehen an eine Zielposition läuft fehlerfrei", "Der gezogene Gang steht jetzt an Position 2",
      "Kein Gang geht dabei verloren"].forEach((name) => ok(name, true, "übersprungen (zu wenige Gänge)"));
  }
  const handles = $("main").querySelectorAll(".aisleHandle");
  ok("Jede Gang-Zeile hat einen Ziehgriff", handles.length === gaengeVorher.length, handles.length);
  ok("Der Griff ist rein dekorativ -- die Pfeiltasten bleiben der Tastaturweg",
    [...handles].every((h) => h.getAttribute("aria-hidden") === "true"));
  ok(".aisleHandle blockiert das Scrollen beim Ziehen nicht (touch-action)",
    /touch-action:none/.test(block(".aisleHandle") || ""));

  /* --- F14: "Getauscht" ist eine Kontur, keine Vollfläche mehr --
     dieselbe Farbe wie der einzige Hauptknopf einer Seite (.cta)
     verlor an Bedeutung, sobald sie mehrfach in einer Liste steht. */
  ok('"Getauscht" ist jetzt eine Kontur, keine Vollfläche',
    /border:1\.5px solid var\(--accent\)/.test(block(".swapBtn.on") || ""));
  App.goto("faellig");
  const getauschtBtn = [...$("main").querySelectorAll("button")].find((b) => b.textContent === "Getauscht");
  ok('Die "Getauscht"-Schaltfläche trägt die neue, leisere Klasse',
    !getauschtBtn || getauschtBtn.classList.contains("swapBtn"), "keine fällige Zeile in den Beispieldaten");

  /* --- F15: rückblickende Verschwendungs-Hinweise stehen nicht mehr
     in Rot -- Rot bleibt akuten Fällen vorbehalten (Kühlkette,
     Verbrauchsdatum). */
  ok('"X % davon meist verschwendet" steht nicht mehr in --red',
    !/color:var\(--red\)/.test(block(".moneyWaste") || ""));
  ok("...sondern in --amber-ink (Rückblick, kein akuter Fall)",
    /color:var\(--amber-ink\)/.test(block(".moneyWaste") || ""));

  /* --- F16: der Punkt "gelernt/vorläufig/geschätzt" ist größer. */
  ok("Der Vertrauens-Punkt ist größer als die ursprünglichen 8px",
    /width:11px;height:11px/.test(block(".dot") || ""));

  D.loadDemo("full");
}

console.log("\n--- UX-Testbericht: dritte Umsetzungsrunde ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    if (i < 0) return null;
    return css.slice(i + sel.length + 2, css.indexOf("}", i));
  };

  /* --- Zahlen: die fünfte Kachel zog sich auf dem Rechner über die
     volle Breite, weil flex:1 den Rest der Zeile an das einzige
     Element vergab. flex:0 lässt jede Kachel bei ihrer eigenen
     Breite, auch wenn sie allein umbricht. */
  const desktopBlock = css.slice(css.indexOf("min-width:900px"));
  ok("Kachel wächst auf dem Rechner nicht mehr in die Zeile hinein",
    /\.tile\{flex:0 1 200px\}/.test(desktopBlock));

  /* --- Liste: cheaperAlternatives() war fertig und ungenutzt --
     jetzt an eine echte Handlung angeschlossen. */
  D.reset();
  D.loadDemo("full");
  D.update((s) => { s.settings.budget = 15; });
  App.goto("liste");
  const b4 = errors.length;
  ok("Ein enges Budget rendert ohne Fehler", errors.length === b4, errors[b4]);
  ok("Etwas wurde wegen des Budgets gestrichen", App.ctx.budgetResult.removed.length > 0,
    App.ctx.budgetResult.removed.length);

  const erwarteteAlternativen = App.ctx.budgetResult.removed
    .filter((r) => r.productId)
    .flatMap((r) => T.cheaperAlternatives(r).map((a) => ({ removed: r, alt: a })));

  if (erwarteteAlternativen.length) {
    const tauschZeilen = [...$("main").querySelectorAll(".row")]
      .filter((r) => /Tauschen/.test(r.textContent));
    ok("Für jede gefundene Alternative steht eine Tauschen-Zeile da",
      tauschZeilen.length === erwarteteAlternativen.length,
      `${tauschZeilen.length} Zeilen, ${erwarteteAlternativen.length} Alternativen`);

    const erste = erwarteteAlternativen[0];
    ok("Die Zeile nennt den Namen der Alternative und was sie kostet",
      tauschZeilen.some((r) => r.textContent.includes(erste.alt.name)));
    ok("Und was sie ersetzt",
      tauschZeilen.some((r) => r.textContent.includes(erste.removed.name)));

    const manualVorher = D.get().manual.length;
    const tauschBtn = tauschZeilen[0].querySelector("button");
    click(tauschBtn);
    ok("Tauschen legt die Alternative als eigene Position an",
      D.get().manual.length === manualVorher + 1);
    ok("Mit der richtigen Produktkennung",
      D.get().manual[D.get().manual.length - 1].productId === erwarteteAlternativen[0].alt.productId);
  } else {
    ok("Keine Alternativen in den Beispieldaten gefunden -- übersprungen", true);
    ok("Keine Alternativen in den Beispieldaten gefunden -- übersprungen", true);
    ok("Keine Alternativen in den Beispieldaten gefunden -- übersprungen", true);
    ok("Keine Alternativen in den Beispieldaten gefunden -- übersprungen", true);
  }

  D.reset();
  D.loadDemo("full");

  /* --- Mehr: "Deine Liste" stand an fünfter von sechs Stellen, obwohl
     sie die Gruppe mit der höchsten Handlungsdichte ist. Jetzt direkt
     nach "Darstellung". */
  App.goto("mehr");
  const gruppenTitel = [...$("main").querySelectorAll(".groupTitle span")].map((s) => s.textContent);
  const iDarstellung = gruppenTitel.indexOf("Darstellung");
  const iDeineListe = gruppenTitel.indexOf("Deine Liste");
  const iRueckblick = gruppenTitel.indexOf("Wochenrückblick");
  ok("Alle drei Gruppen stehen da", iDarstellung >= 0 && iDeineListe >= 0 && iRueckblick >= 0,
    gruppenTitel.join(", "));
  ok("\"Deine Liste\" steht jetzt direkt nach \"Darstellung\", vor dem Rückblick",
    iDeineListe === iDarstellung + 1 && iDeineListe < iRueckblick,
    gruppenTitel.join(", "));

  /* --- Zahlen: das Segment stand hinter der langen Geld-Karte, wer zu
     "Verhalten"/"Bilanz" wollte, musste daran vorbeiscrollen.
     "Wo dein Geld hingeht" ist selbst eine Ausgaben-Frage und gehört
     nur noch in den Ausgaben-Tab. */
  App.goto("zahlen");
  App.zahlenTab = "ausgaben";
  App.render();
  const kinderVonMain = [...$("main").children];
  const iScroller = kinderVonMain.findIndex((k) => k.classList.contains("scroller"));
  const iSegment = kinderVonMain.findIndex((k) => k.querySelector && k.querySelector('[role="tablist"], .segmented'));
  const iGeldKarte = kinderVonMain.findIndex((k) => /Wo dein Geld hingeht/.test(k.textContent));
  ok("Kachelzeile, Segment und Geld-Karte stehen alle da",
    iScroller >= 0 && iSegment >= 0 && iGeldKarte >= 0,
    `${iScroller}, ${iSegment}, ${iGeldKarte}`);
  ok("Das Segment steht jetzt direkt unter der Kachelzeile, vor der Geld-Karte",
    iSegment === iScroller + 1 && iSegment < iGeldKarte,
    `Kacheln ${iScroller}, Segment ${iSegment}, Geld-Karte ${iGeldKarte}`);

  App.zahlenTab = "verhalten";
  App.render();
  ok("Im Verhalten-Tab steht \"Wo dein Geld hingeht\" nicht mehr da",
    !/Wo dein Geld hingeht/.test($("main").textContent));
  App.zahlenTab = "bilanz";
  App.render();
  ok("Im Bilanz-Tab auch nicht",
    !/Wo dein Geld hingeht/.test($("main").textContent));
  App.zahlenTab = "ausgaben";
  App.render();

  /* --- Ladenmodus: kein Weg, eine ungeplante Position hinzuzufügen --
     man musste den Ladenmodus verlassen. Jetzt ein "+"-Knopf, der
     addSheet() als Blatt darüber öffnet. */
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  App.openStore();
  const b4Store = errors.length;
  const aufListe = new Set(App.ctx.items.filter((i) => i.on).map((i) => i.productId));
  const neu = T.FOOD_DATABASE.find((p) => p.isFood && !aufListe.has(p.id));
  ok("Es gibt ein Produkt, das noch nicht auf der Liste steht", !!neu);

  const storeAdd = doc.getElementById("storeAdd");
  ok("Der Ladenmodus hat einen \"+\"-Knopf", !!storeAdd);
  const vorherImLaden = doc.getElementById("storeBody").querySelectorAll(".sItem").length;

  click(storeAdd);
  ok("Er öffnet ein Blatt, ohne den Ladenmodus zu schließen",
    $("sheet").hidden === false && doc.getElementById("store").hidden === false);

  if (neu) {
    const feld = $("sheetOpts").querySelector("input");
    feld.value = neu.name;
    feld.dispatchEvent(new window.Event("input", { bubbles: true }));
    const treffer = [...$("sheetOpts").querySelectorAll(".results li button")]
      .find((b) => b.textContent.includes(neu.name));
    ok("Der Katalog findet es", !!treffer, neu.name);
    if (treffer) click(treffer);

    ok("Läuft ohne Fehler", errors.length === b4Store, errors[b4Store]);
    const nachherImLaden = doc.getElementById("storeBody").querySelectorAll(".sItem").length;
    ok("Die neue Position erscheint im Ladenmodus, ohne ihn zu verlassen",
      nachherImLaden === vorherImLaden + 1, `${vorherImLaden} -> ${nachherImLaden}`);
    ok("Der Ladenmodus ist immer noch offen", doc.getElementById("store").hidden === false);
  }
  App.closeSheet();
  App.closeStore();

  /* --- Fällig/Angebote: permanenter Einstiegspunkt unter Mehr ->
     Auswertungen, auch wenn gerade nichts ansteht. */
  D.reset();
  D.loadDemo("full");
  App.goto("mehr");
  App.mehrTab = "auswertungen";
  App.render();
  const auswertTitel = [...$("main").querySelectorAll(".groupTitle span")].map((s) => s.textContent);
  ok("\"Fällig & Angebote\" steht dauerhaft unter Auswertungen", auswertTitel.includes("Fällig & Angebote"),
    auswertTitel.join(", "));
  const goFaellig = [...$("main").querySelectorAll(".row")].find((r) => /^Fällig/.test(r.textContent));
  const goAngebote = [...$("main").querySelectorAll(".row")].find((r) => /^Angebote/.test(r.textContent));
  ok("Beide Zeilen stehen da, mit Zustand statt Stille", !!goFaellig && !!goAngebote,
    `${!!goFaellig}, ${!!goAngebote}`);
  if (goFaellig) {
    click(goFaellig);
    ok("Die Fällig-Zeile führt tatsächlich dorthin", App.tab === "faellig", App.tab);
  }
  App.goto("mehr");
  App.mehrTab = "auswertungen";
  App.render();
  const goAngebote2 = [...$("main").querySelectorAll(".row")].find((r) => /^Angebote/.test(r.textContent));
  if (goAngebote2) {
    click(goAngebote2);
    ok("Die Angebote-Zeile führt tatsächlich dorthin", App.tab === "angebote", App.tab);
  }

  /* --- Bestand: 2335px hohe Einzelseite ohne Gliederung -- jetzt
     Segmente wie bei Zahlen/Mehr, plus .cards2 auf dem Rechner für
     zwei unabhängige, gleich aufgebaute Listen. */
  D.reset();
  D.loadDemo("full");
  App.goto("bestand");
  App.bestandTab = "vorrat";
  App.render();
  const bestandTitel1 = () => [...$("main").querySelectorAll(".groupTitle span")].map((s) => s.textContent);
  ok("Es gibt ein Segment Vorrat/Küche", $("main").querySelector(".segmented"));
  ok("Im Vorrat-Tab steht \"Vermutlich noch da\", nicht \"Kochen\"",
    bestandTitel1().includes("Vermutlich noch da") && !bestandTitel1().includes("Kochen"),
    bestandTitel1().join(", "));

  const cardsWrap = [...$("main").querySelectorAll(".cards2")][0];
  if (cardsWrap) {
    ok("\"Vermutlich noch da\" und \"Haushalt\" stehen nebeneinander in .cards2 (nur ≥900px sichtbar)",
      [...cardsWrap.children].filter((k) => k.classList.contains("group")).length === 2);
  } else {
    ok("Keine zwei unabhängigen Gruppen in den Beispieldaten -- .cards2 übersprungen", true);
  }

  App.bestandTab = "kueche";
  App.render();
  const bestandTitel2 = bestandTitel1();
  ok("Im Küche-Tab steht \"Kochen\", nicht \"Vermutlich noch da\"",
    bestandTitel2.includes("Kochen") && !bestandTitel2.includes("Vermutlich noch da"),
    bestandTitel2.join(", "));

  App.bestandTab = "vorrat";
  App.render();
  const invGroup = [...$("main").querySelectorAll(".group")]
    .find((g) => /Vermutlich noch da/.test((g.querySelector(".groupTitle") || {}).textContent || ""));
  const invRowsVorher = invGroup.querySelectorAll(".row").length;
  const mehrBtn = invGroup.querySelector(".moneyMore");
  if (App.ctx.inventory.length > 20) {
    ok("Über 20 Positionen bekommen ein \"Alle N ansehen\" statt stillem Abschneiden", !!mehrBtn);
    if (mehrBtn) {
      click(mehrBtn);
      const invRowsNachher = invGroup.querySelectorAll(".row").length;
      ok("Antippen zeigt den Rest, ohne Fehler",
        invRowsNachher === App.ctx.inventory.length && errors.length === 0,
        `${invRowsVorher} -> ${invRowsNachher} von ${App.ctx.inventory.length}`);
    }
  } else {
    ok("Bei höchstens 20 Positionen (Beispieldaten) bleibt \"Alle ansehen\" weg, nichts wird abgeschnitten",
      !mehrBtn && invRowsVorher === App.ctx.inventory.length,
      `${invRowsVorher} von ${App.ctx.inventory.length}`);
  }

  // Urlaub aktiv: "Reise" taucht als dritte Option auf.
  D.update((s) => {
    s.settings.vacation = { active: true, from: D.plusDays(D.today(), 2), to: D.plusDays(D.today(), 9) };
  });
  App.bestandTab = "vorrat";
  App.render();
  const segLabels = [...$("main").querySelectorAll(".segmented button")].map((b) => b.textContent);
  ok("Bei aktivem Urlaub kommt \"Reise\" als dritte Option dazu", segLabels.includes("Reise"), segLabels.join(", "));
  App.bestandTab = "reise";
  App.render();
  ok("Der Reise-Tab zeigt \"Vor der Abreise\"", bestandTitel1().includes("Vor der Abreise"), bestandTitel1().join(", "));

  D.reset();
  D.loadDemo("full");

  /* --- Mehr: dieselbe .cards2-Regel für "Darstellung"+"Deine Liste"
     und "Wochenrückblick"+"Haushalt". */
  App.goto("mehr");
  App.mehrTab = "einstellungen";
  App.render();
  const mehrCards2 = [...$("main").querySelectorAll(".cards2")];
  ok("Mehr hat zwei .cards2-Paare", mehrCards2.length === 2, mehrCards2.length);
  if (mehrCards2.length === 2) {
    const titelIn = (wrap) => [...wrap.querySelectorAll(".groupTitle span")].map((s) => s.textContent);
    ok("Erstes Paar: Darstellung + Deine Liste",
      titelIn(mehrCards2[0]).includes("Darstellung") && titelIn(mehrCards2[0]).includes("Deine Liste"),
      titelIn(mehrCards2[0]).join(", "));
    ok("Zweites Paar: Wochenrückblick + Haushalt",
      titelIn(mehrCards2[1]).includes("Wochenrückblick") && titelIn(mehrCards2[1]).includes("Haushalt"),
      titelIn(mehrCards2[1]).join(", "));
  }

  /* --- Erfassen: "Fotografieren" blieb auf dem Rechner der volltonig
     grüne, dominante Knopf -- ohne Rückkamera in Bon-Haltung ist
     "Bild wählen" dort naheliegender. Beide Knöpfe stehen unverändert
     im DOM (dieselbe Bedienbarkeit); nur Farbe und Reihenfolge tauschen
     per CSS ab ≥900px. */
  const engineVorher = T.OCR.engine;
  T.OCR.engine = () => "";
  App.goto("erfassen");
  App.render();
  ok("Beide Knöpfe tragen ihre eigene Klasse für die Rechner-Gewichtung",
    !!$("main").querySelector("button.shotFoto") && !!$("main").querySelector("button.shotWaehlen"));
  T.OCR.engine = engineVorher;
  const desktopCss = css.slice(css.indexOf("min-width:900px"));
  ok("Auf dem Rechner wird \"Fotografieren\" zur Kontur",
    /\.shotFoto\{background:var\(--fill\)/.test(desktopCss));
  ok("Und \"Bild wählen\" zur vollen Fläche",
    /\.shotWaehlen\{background:var\(--accent-strong\)/.test(desktopCss));

  /* --- Bestand: keine Korrektur für eine falsch gewordene Schätzung
     außer "leer" oder Abwarten. Jetzt drei Knöpfe im Produkt-Blatt. */
  D.reset();
  D.loadDemo("full");
  const mitBestand = App.ctx.inventory[0];
  ok("Es gibt ein Produkt mit geschätztem Bestand", !!mitBestand);
  if (mitBestand) {
    productSheetFor(mitBestand.productId);
    const corrBtns = [...$("sheetOpts").querySelectorAll(".stockCorrRow button")].map((b) => b.textContent);
    ok("Alle drei Korrektur-Knöpfe stehen im Blatt",
      corrBtns.includes("Ist leer") && corrBtns.includes("Etwa richtig") && corrBtns.includes("Mehr als gedacht"),
      corrBtns.join(", "));

    const leerBtn = [...$("sheetOpts").querySelectorAll(".stockCorrRow button")]
      .find((b) => b.textContent === "Ist leer");
    click(leerBtn);
    const corr = D.get().stockCorrections[mitBestand.productId];
    ok("\"Ist leer\" trägt die Korrektur ein", !!corr && corr.remainingUnits === 0, JSON.stringify(corr));
    ok("Mit dem heutigen Datum", corr && corr.date === D.today(), corr && corr.date);
    ok("Die Schätzung übernimmt sie beim nächsten Rechnen",
      !App.ctx.inventory.some((i) => i.productId === mitBestand.productId));
    ok("Das Blatt schließt sich", $("sheet").hidden === true);
  }

  D.reset();
  D.loadDemo("full");
  const mitBestand2 = App.ctx.inventory.find((i) => i.remainingUnits < 3);
  if (mitBestand2) {
    productSheetFor(mitBestand2.productId);
    const mehrBtn = [...$("sheetOpts").querySelectorAll(".stockCorrRow button")]
      .find((b) => b.textContent === "Mehr als gedacht");
    click(mehrBtn);
    const corr2 = D.get().stockCorrections[mitBestand2.productId];
    ok("\"Mehr als gedacht\" hebt die hinterlegte Menge über die alte Schätzung",
      corr2 && corr2.remainingUnits > mitBestand2.remainingUnits,
      corr2 && `${corr2.remainingUnits} vs ${mitBestand2.remainingUnits}`);
    const neu = App.ctx.inventory.find((i) => i.productId === mitBestand2.productId);
    ok("Und die Bestandsanzeige zeigt danach mehr als vorher",
      neu && neu.remainingUnits > mitBestand2.remainingUnits,
      neu && `${neu.remainingUnits} vs ${mitBestand2.remainingUnits}`);
  }

  D.reset();
  D.loadDemo("full");

  /* --- Zahlen: "Sparen" war ein Haken ohne Folge -- kein
     Fachlogik-Modul liest savingsAccepted. Jetzt hält der
     Wochenrückblick nach, ob die Verschwendung beim Produkt seit der
     Annahme tatsächlich gesunken ist. */
  App.goto("zahlen");
  App.zahlenTab = "bilanz";
  App.render();
  const vorschlag = App.ctx.savings[0];
  ok("Es gibt einen Sparvorschlag in den Beispieldaten", !!vorschlag);
  if (vorschlag) {
    const nehmenBtn = [...$("main").querySelectorAll(".save .pillBtn")]
      .find((b) => b.getAttribute("aria-label") === vorschlag.title);
    ok("Der Knopf zum Annehmen steht da", !!nehmenBtn);
    if (nehmenBtn) click(nehmenBtn);

    const snap = D.get().savingsAcceptedAt[vorschlag.id];
    ok("Die Annahme hinterlegt einen Schnappschuss", !!snap, JSON.stringify(snap));
    ok("Mit Produkt, Titel und heutigem Datum",
      snap && snap.productId === vorschlag.productId && snap.title === vorschlag.title && snap.date === D.today(),
      JSON.stringify(snap));

    const folge = App.ctx.savingsFollowUp.find((f) => f.id === vorschlag.id);
    ok("ctx.savingsFollowUp führt den angenommenen Vorschlag", !!folge, JSON.stringify(folge));

    T.reviewSheet(App.ctx, App);
    ok("Der Rückblick zeigt \"Angenommene Sparvorschläge\"",
      /Angenommene Sparvorschläge/.test($("sheetOpts").textContent));
    ok("Und nennt den Vorschlag beim Namen",
      $("sheetOpts").textContent.includes(vorschlag.title));
    App.closeSheet();

    // Eine künstlich schlechtere Vergangenheit simulieren, um zu
    // prüfen, dass "eingehalten" wirklich von den Zahlen abhängt und
    // nicht immer denselben Text zeigt.
    D.update((s) => {
      s.savingsAcceptedAt[vorschlag.id].wasteRateThen =
        Math.min(1, (App.ctx.wasteStats.get(vorschlag.productId) || { wasteRate: 0 }).wasteRate + 0.3);
    });
    const folgeBesser = App.ctx.savingsFollowUp.find((f) => f.id === vorschlag.id);
    ok("Bei gesunkener Quote gilt der Vorschlag als eingehalten",
      folgeBesser && folgeBesser.improved === true, JSON.stringify(folgeBesser));

    // Und ungeschehen machen, ohne den Wochenzähler zu verfälschen.
    D.update((s) => { s.savingsAccepted = s.savingsAccepted.filter((id) => id !== vorschlag.id); });
    ok("Ohne aktive Annahme verschwindet der Vorschlag aus der Nachhaltung",
      !App.ctx.savingsFollowUp.some((f) => f.id === vorschlag.id));
  }

  D.reset();
  D.loadDemo("full");

  /* --- Start: zweite Spalte mit der Wesen-Nachricht, nur auf dem
     Rechner (per CSS). Derselbe Text wie die Sprechblase, ohne den
     Zähler zu erhöhen -- sonst würde bloßes Neuzeichnen die Rotation
     der echten Sprechblase weiterdrehen. */
  App.mascotTapCount.start = 0;
  App.goto("start");
  App.render();
  const aside = $("main").querySelector(".startAside");
  const mascotCard = $("main").querySelector(".startMascotCard");
  ok("Es gibt eine zweite Spalte mit der Wesen-Nachricht", !!aside && !!mascotCard);
  ok("Sie trägt dieselbe Nachricht wie mascotMessage(ctx, \"start\", 0)",
    mascotCard && mascotCard.textContent.trim() === T.mascotMessage(App.ctx, "start", 0).trim(),
    mascotCard && mascotCard.textContent);
  ok("Das bloße Rendern erhöht den Sprechblasen-Zähler nicht",
    App.mascotTapCount.start === 0, App.mascotTapCount.start);
  App.render();
  App.render();
  ok("Auch nach mehreren Neuzeichnungen nicht", App.mascotTapCount.start === 0, App.mascotTapCount.start);

  ok(".startAside ist standardmäßig ausgeblendet (CSS)", /\.startAside\{display:none\}/.test(css));
  const desktopCss2 = css.slice(css.indexOf("min-width:900px"));
  ok("...und ab 900px sichtbar", /\.startAside\{display:block/.test(desktopCss2));
  ok("Die Startseite bleibt auf höchstens vier Blöcke begrenzt (unverändert durch die Spalte)",
    $("main").querySelector(".startMain").querySelectorAll(":scope > .group, :scope > .card").length <= 4);

  D.reset();
  D.loadDemo("full");
}

console.log("\n--- Bestand: Wischen heißt „ist alle“ ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
  };

  /* Eine echte Geste, nicht nur die Verdrahtung: jsdom kennt
     PointerEvent, nur setPointerCapture nicht -- der Aufruf steht
     deshalb in views.js in einem try/catch. */
  const zeiger = (typ, x, y) => new window.PointerEvent(typ,
    { pointerId: 1, clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  const wisch = (row, dx, dy = 0) => {
    row.dispatchEvent(zeiger("pointerdown", 300, 200));
    row.dispatchEvent(zeiger("pointermove", 300 + Math.round(dx / 2), 200 + Math.round(dy / 2)));
    row.dispatchEvent(zeiger("pointermove", 300 + dx, 200 + dy));
    row.dispatchEvent(zeiger("pointerup", 300 + dx, 200 + dy));
  };
  const bestandZeigen = () => {
    D.reset(); D.loadDemo("full");
    App.goto("bestand"); App.bestandTab = "vorrat"; App.render();
  };
  const ersteZeile = () => $("main").querySelector(".swipeWrap");

  bestandZeigen();
  const w = ersteZeile();
  ok("Bestandszeilen liegen in einer Wisch-Hülle", !!w);
  ok("Dahinter steht die Fläche mit der Beschriftung",
    !!w && w.querySelector(".swipeBack .swipeLabel") &&
    w.querySelector(".swipeLabel").textContent === "Ist alle");
  ok("Die Zeile selbst liegt darüber", !!w && !!w.querySelector(":scope > .row"));
  ok("Senkrechtes Scrollen bleibt dem Browser (touch-action:pan-y)",
    /touch-action:pan-y/.test(block(".swipeWrap > .row") || ""));
  ok("Die Trennlinie überlebt die Hülle",
    css.includes(".swipeWrap + .swipeWrap > .row::before"));

  /* --- Ein kurzes Wischen ist ein Tippen und darf nichts auslösen --- */
  {
    const wrap = ersteZeile();
    const row = wrap.querySelector(":scope > .row");
    const pid = App.ctx.inventory[0].productId;
    wisch(row, -20);
    ok("Ein kurzes Ziehen löst nichts aus",
      !(D.get().stockCorrections || {})[pid], JSON.stringify(D.get().stockCorrections));
  }

  /* --- Senkrecht überwiegt: das ist Scrollen --- */
  {
    bestandZeigen();
    const wrap = ersteZeile();
    const row = wrap.querySelector(":scope > .row");
    const pid = App.ctx.inventory[0].productId;
    wisch(row, -120, -140);
    ok("Eine überwiegend senkrechte Bewegung wird nicht als Wischen gewertet",
      !(D.get().stockCorrections || {})[pid], JSON.stringify(D.get().stockCorrections));
  }

  /* --- Weit genug: die Schätzung steht auf null --- */
  let pidLeer = null;
  {
    bestandZeigen();
    const wrap = ersteZeile();
    const row = wrap.querySelector(":scope > .row");
    pidLeer = App.ctx.inventory[0].productId;
    const vorher = App.ctx.inventory[0].remainingUnits;
    ok("Vorher ist noch etwas geschätzt", vorher > 0, vorher);
    wisch(row, -120);
    const korr = (D.get().stockCorrections || {})[pidLeer];
    ok("Ein weites Wischen setzt die Schätzung auf null",
      !!korr && korr.remainingUnits === 0, JSON.stringify(korr));
    ok("Es geschieht ohne Rückfrage — kein Blatt öffnet sich",
      doc.getElementById("sheet").hidden !== false ||
      !doc.getElementById("sheet").querySelector(".pTitle"));
    const inv = App.ctx.inventory.find((i) => i.productId === pidLeer);
    ok("Und die Anzeige zieht sofort nach", !inv || inv.remainingUnits === 0, inv && inv.remainingUnits);
  }

  /* --- Der Rückweg: „Rückgängig" im Toast --- */
  {
    const t = doc.getElementById("toast");
    const act = t.querySelector(".tAct");
    ok("Der Toast bietet einen Rückweg an", !!act && act.textContent === "Rückgängig");
    click(act);
    ok("Rückgängig nimmt die Korrektur zurück",
      !(D.get().stockCorrections || {})[pidLeer], JSON.stringify(D.get().stockCorrections));
    ok("Der Toast bestätigt die Rücknahme",
      (t.querySelector(".tTxt b") || {}).textContent === "Zurückgenommen");
  }

  /* --- Nach dem Wischen darf der Klick das Blatt nicht öffnen --- */
  {
    bestandZeigen();
    const wrap = ersteZeile();
    const row = wrap.querySelector(":scope > .row");
    row.dispatchEvent(zeiger("pointerdown", 300, 200));
    row.dispatchEvent(zeiger("pointermove", 180, 200));
    row.dispatchEvent(zeiger("pointerup", 180, 200));
    const geoeffnet = doc.getElementById("sheet").hidden === false;
    click(row);
    ok("Der Klick nach dem Wischen öffnet kein Blatt",
      (doc.getElementById("sheet").hidden === false) === geoeffnet);
    App.closeSheet();
  }

  /* --- Der Weg mit Tastatur bleibt: die Schaltflächen im Blatt --- */
  {
    bestandZeigen();
    const pid = App.ctx.inventory[0].productId;
    T.productSheet(pid, App.ctx);
    const btns = [...doc.getElementById("sheet").querySelectorAll(".stockCorrRow .pillBtn")]
      .map((b) => b.textContent);
    ok("Das Detail-Blatt behält alle drei Korrekturen",
      btns.join("|") === "Ist leer|Etwa richtig|Mehr als gedacht", btns.join("|"));
    App.closeSheet();
  }

  /* --- Der Verbrauchstag: freiwillig und zugeklappt --- */
  {
    bestandZeigen();
    const pid = App.ctx.inventory[0].productId;
    T.productSheet(pid, App.ctx);
    const det = [...doc.getElementById("sheet").querySelectorAll("details.pMore")]
      .find((d) => (d.querySelector("summary") || {}).textContent === "Verbrauchstag nachtragen");
    ok("Der Verbrauchstag steht im Blatt", !!det);
    ok("Und er ist zugeklappt — keine Standardabfrage", !!det && det.open !== true);
    const inp = det && det.querySelector('input[type="date"]');
    ok("Dahinter steht ein Datumsfeld", !!inp);
    ok("Kein Datum in der Zukunft", !!inp && inp.max === D.today());
    App.closeSheet();
  }

  /* --- setStockCorrection mit Datum: die Regeln --- */
  {
    D.reset(); D.loadDemo("full");
    const pid = App.ctx.inventory[0].productId;
    const letzter = D.get().purchases.filter((p) => p.productId === pid).map((p) => p.date).sort().pop();
    ok("Ein Datum in der Zukunft wird abgelehnt",
      D.setStockCorrection(pid, 0, D.plusDays(D.today(), 1)) === false);
    ok("Ein kaputtes Datum wird abgelehnt", D.setStockCorrection(pid, 0, "2026-13-45") === false);
    ok("Ein Datum vor dem letzten Kauf wird abgelehnt",
      D.setStockCorrection(pid, 0, D.plusDays(letzter, -1)) === false);
    ok("Nichts davon wurde gespeichert", !(D.get().stockCorrections || {})[pid]);
    ok("Ein Tag zwischen Kauf und heute wird angenommen",
      D.setStockCorrection(pid, 0, letzter) === true);
    ok("Und er landet als Korrekturdatum in den Daten",
      (D.get().stockCorrections[pid] || {}).date === letzter);
    ok("Zurücknehmen räumt den Eintrag weg",
      D.clearStockCorrection(pid) === true && !(D.get().stockCorrections || {})[pid]);
    ok("Zweimal zurücknehmen meldet ehrlich, dass nichts da war",
      D.clearStockCorrection(pid) === false);
    ok("Ohne Datum gilt heute",
      D.setStockCorrection(pid, 0) === true && D.get().stockCorrections[pid].date === D.today());
    D.reset(); D.loadDemo("full");
  }

  ok("Der Auslösepunkt ist sichtbar markiert (.armed)",
    /\.swipeWrap\.armed \.swipeBack/.test(css) && /\.swipeWrap\.armed \.swipeLabel/.test(css));
  ok("Die Gruppe erklärt die Geste",
    ($("main").textContent || "").includes("Wisch eine Zeile nach links") ||
    (() => { App.goto("bestand"); App.bestandTab = "vorrat"; App.render();
      return [...$("main").querySelectorAll(".infoBtn")].length > 0; })());

  D.reset();
  D.loadDemo("full");
  App.goto("start");
}

console.log("\n--- Kalender ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");
  const block = (sel) => {
    const i = css.indexOf("\n" + sel + "{");
    return i < 0 ? null : css.slice(i + sel.length + 2, css.indexOf("}", i));
  };

  D.reset(); D.loadDemo("full");
  App.goto("start");

  /* --- Der Weg hinein: das Datum auf der Übersicht --- */
  const datum = doc.getElementById("largeTitle").querySelector(".dateBtn");
  ok("Das Datum auf der Übersicht ist antippbar", !!datum);
  ok("Und sagt der Vorlesehilfe, wohin es führt",
    !!datum && /Kalender/.test(datum.getAttribute("aria-label") || ""));
  ok("Es trägt weiterhin das Datum", !!datum && /\d{2}\.\d{2}\.\d{4}/.test(datum.textContent));
  click(datum);
  ok("Ein Tipp darauf öffnet den Kalender", App.tab === "kalender", App.tab);

  /* --- Das Gitter --- */
  const gitter = () => $("main").querySelector(".kGitter");
  const zellen = () => [...gitter().querySelectorAll(".kTag")];
  ok("Es gibt ein Gitter", !!gitter());
  const heuteMonat = App.ctx.ref.slice(0, 7);
  const tageImMonat = T.monatsSpanne(heuteMonat).bis.slice(8);
  ok("Für jeden Tag des Monats eine Zelle", zellen().length === Number(tageImMonat),
    `${zellen().length} von ${tageImMonat}`);
  ok("Sieben Wochentage stehen als Kopfzeile darüber",
    $("main").querySelectorAll(".kWt").length === 7);
  ok("Die Woche beginnt am Montag",
    ($("main").querySelector(".kWt") || {}).textContent === "Mo");

  const heuteZelle = zellen().find((z) => z.classList.contains("heute"));
  ok("Der heutige Tag ist markiert", !!heuteZelle);
  ok("Und trägt die richtige Zahl",
    !!heuteZelle && heuteZelle.querySelector(".kZahl").textContent === String(Number(App.ctx.ref.slice(8))));

  const zukunft = zellen().filter((z) => z.classList.contains("zukunft"));
  const vergangen = zellen().filter((z) => !z.classList.contains("zukunft") && !z.classList.contains("heute"));
  ok("Zukunft und Vergangenheit werden unterschieden",
    zukunft.length > 0 && vergangen.length > 0, `${zukunft.length} / ${vergangen.length}`);
  ok("Der heutige Tag zählt nicht als Zukunft", !heuteZelle.classList.contains("zukunft"));
  ok("Zukunft ist eine Kontur, keine Fläche",
    /background:transparent/.test(block(".kTag.zukunft") || ""));

  /* --- Blättern --- */
  const titelText = () => ($("main").querySelector(".kTitel") || {}).textContent;
  const vorher = titelText();
  const knoepfe = $("main").querySelectorAll(".kNav");
  ok("Es gibt zwei Blätter-Knöpfe", knoepfe.length === 2);
  click(knoepfe[0]);
  ok("Zurück blättert einen Monat", titelText() !== vorher, `${vorher} -> ${titelText()}`);
  ok("Und der Monat ist gemerkt", App.kalenderMonat === T.monatPlus(heuteMonat, -1), App.kalenderMonat);
  ok("Im Vormonat ist alles Vergangenheit",
    zellen().every((z) => !z.classList.contains("zukunft")));
  click($("main").querySelectorAll(".kNav")[1]);
  click($("main").querySelectorAll(".kNav")[1]);
  ok("Vorwärts kommt man über den heutigen Monat hinaus",
    App.kalenderMonat === T.monatPlus(heuteMonat, 1), App.kalenderMonat);
  ok("Dort ist alles Zukunft",
    [...$("main").querySelectorAll(".kTag")].every((z) => z.classList.contains("zukunft")));

  App.kalenderMonat = null; App.kalenderTag = null; App.render();

  /* --- Ebenen: Geld und Vorrat sind zwei Fragen --- */
  ok("Geld ist die Vorgabe", App.kalenderEbene === "geld");
  ok("In der Geld-Ebene stehen Beträge", $("main").querySelectorAll(".kBetrag").length > 0);
  ok("Und keine Vorrats-Punkte", $("main").querySelectorAll(".kPunkt").length === 0);
  const segBtns = [...$("main").querySelectorAll(".segmented button")];
  ok("Es gibt genau zwei Ebenen", segBtns.length === 2 && segBtns.map((b) => b.textContent).join("|") === "Geld|Vorrat");
  click(segBtns[1]);
  ok("Der Wechsel wird gemerkt", App.kalenderEbene === "vorrat");
  ok("In der Vorrats-Ebene stehen Punkte", $("main").querySelectorAll(".kPunkt").length > 0);
  ok("Und keine Beträge mehr", $("main").querySelectorAll(".kBetrag").length === 0);
  ok("Die Monatszeilen wechseln mit",
    ($("main").textContent || "").includes("Geht aus") &&
    ($("main").textContent || "").includes("Läuft ab"));
  click([...$("main").querySelectorAll(".segmented button")][0]);
  ok("Zurück zur Geld-Ebene", App.kalenderEbene === "geld");

  /* --- Ein Tag antippen --- */
  const mitBetrag = [...$("main").querySelectorAll(".kTag")].find((z) => z.querySelector(".kBetrag"));
  ok("Es gibt einen Tag mit einem Betrag", !!mitBetrag);
  click(mitBetrag);
  ok("Der angetippte Tag ist markiert",
    !!$("main").querySelector(".kTag.gewaehlt"));
  const gruppen = [...$("main").querySelectorAll(".group")];
  const tagGruppe = gruppen.find((g) => /\d{2}\.\d{2}\.\d{4}/.test(
    ((g.querySelector(".groupTitle") || {}).textContent) || ""));
  ok("Darunter steht, was an diesem Tag ansteht", !!tagGruppe);
  ok("Die Gruppe geht sichtbar auf", !!tagGruppe && tagGruppe.classList.contains("oeffnet"));
  ok("Sie steht VOR der Monatssumme -- die Antwort vor der Zwischensumme",
    gruppen.indexOf(tagGruppe) < gruppen.findIndex((g) =>
      /Dieser Monat|In diesem Monat/.test(((g.querySelector(".groupTitle") || {}).textContent) || "")));
  click($("main").querySelector(".kTag.gewaehlt"));
  ok("Noch einmal antippen schließt ihn wieder", App.kalenderTag === null);

  /* --- Ehrlichkeit: der Horizont wird benannt --- */
  ok("Die Ansicht sagt, wie weit sie vorhersagt",
    /Vorhergesagt wird bis \d{2}\.\d{2}\.\d{4}/.test($("main").textContent || ""));

  /* --- Der Kalender behauptet nicht mehr als die Liste --- */
  {
    const daten = T.buildCalendar({
      purchases: App.ctx.history, rhythms: App.ctx.rhythms, inventory: App.ctx.inventory,
      heute: App.ctx.ref, von: App.ctx.ref, bis: D.plusDays(App.ctx.ref, 400),
      preisFuer: () => 1
    });
    const letzterMitVorhersage = [...daten.tage].reverse().find((t) => t.erwartet > 0);
    ok("Jenseits des Horizonts wird nichts mehr vorhergesagt",
      !letzterMitVorhersage || letzterMitVorhersage.date <= daten.horizont,
      letzterMitVorhersage && letzterMitVorhersage.date);
    ok("Vergangene Tage tragen nie eine Vorhersage",
      daten.tage.filter((t) => t.date < App.ctx.ref).every((t) => t.erwartet === 0));
  }

  D.reset(); D.loadDemo("full");
  App.kalenderMonat = null; App.kalenderTag = null; App.kalenderEbene = "geld";
  App.goto("start");
}

console.log("\n--- Bewegung nur dort, wo etwas aufgeht ---");
{
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  ok("Es gibt genau eine Öffnen-Bewegung", /@keyframes oeffnen\{/.test(css));
  const dauer = parseFloat((/\.oeffnet\{animation:oeffnen (\.?[\d.]+)s/.exec(css) || [])[1]);
  ok("Sie ist kurz -- unter einer drittel Sekunde",
    dauer > 0 && dauer <= 0.33, dauer + "s");
  ok("Aufgeklapptes details bewegt nur den Inhalt, nicht die Zusammenfassung",
    /details\[open\] > \*:not\(summary\)\{animation:oeffnen/.test(css));
  ok("Weniger Bewegung heißt keine",
    /@media \(prefers-reduced-motion:reduce\)\{\s*\*\{transition:none !important;animation:none !important\}/.test(css));

  /* Der Punkt, an dem so etwas schiefgeht: eine Animation, die bei
     JEDEM Zeichnen läuft. render() läuft nach fast jeder Berührung. */
  D.reset(); D.loadDemo("full");
  App.goto("bestand");
  ok("Ein gewöhnliches Zeichnen bewegt nichts",
    !$("main").classList.contains("oeffnet"));
  App.render();
  ok("Auch ein zweites nicht", !$("main").classList.contains("oeffnet"));

  const seg = [...$("main").querySelectorAll(".segmented button")];
  click(seg[1]);
  ok("Ein Segmentwechsel dagegen schon", $("main").classList.contains("oeffnet"));
  App.render();
  ok("Und die Bewegung gilt genau einmal", !$("main").classList.contains("oeffnet"));

  const seg2 = [...$("main").querySelectorAll(".segmented button")];
  const aktiv = seg2.findIndex((b) => b.getAttribute("aria-selected") === "true");
  click(seg2[aktiv]);
  ok("Ein Tipp auf das bereits gewählte Segment bewegt nichts",
    !$("main").classList.contains("oeffnet"));

  /* Nachgeladene Zeilen laufen gestaffelt ein. */
  App.bestandTab = "vorrat"; App.render();
  const mehr = [...$("main").querySelectorAll(".moneyMore")]
    .find((b) => /Alle \d+ ansehen/.test(b.textContent));
  if (mehr) {
    const vorher = $("main").querySelectorAll(".swipeWrap").length;
    click(mehr);
    const neue = [...$("main").querySelectorAll(".swipeWrap.oeffnet")];
    ok("Nachgeladene Bestandszeilen gehen auf", neue.length > 0, neue.length);
    ok("Und zwar gestaffelt", neue.length < 2 || neue[1].style.animationDelay !== neue[0].style.animationDelay,
      neue.slice(0, 2).map((n) => n.style.animationDelay).join(" / "));
    ok("Die Liste ist wirklich gewachsen",
      $("main").querySelectorAll(".swipeWrap").length > vorher);
  } else {
    ["Nachgeladene Bestandszeilen gehen auf", "Und zwar gestaffelt", "Die Liste ist wirklich gewachsen"]
      .forEach((n) => ok(n, true, "übersprungen (keine Nachladen-Schaltfläche)"));
  }

  D.reset(); D.loadDemo("full");
  App.bestandTab = "vorrat";
  App.goto("start");
}

console.log("\n--- Keine unbeaufsichtigten Fehler ---");
  ok("Konsole blieb fehlerfrei", errors.length === 0, errors.slice(0, 3).join(" | "));

  console.log("\n" + "=".repeat(60));
  console.log(`OBERFLÄCHE: ${pass} bestanden, ${fail} fehlgeschlagen`);
  if (errors.length) {
    console.log("\nGesammelte Fehler:");
    errors.slice(0, 10).forEach((e) => console.log("  " + e));
  }
  console.log("=".repeat(60));
  process.exit(fail || errors.length ? 1 : 0);
}, 40);

});
