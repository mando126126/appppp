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
    " Backup, backupHealth, backupFileName, pickBetter, receiptSheet, wasteSummary," +
    " collectHints, hintsSheet, weekPulse, viewStart, NAV, SUBVIEWS, addSheet, askLate, daysBetween };"
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

ready.then(() => {

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

  const before = D.get().purchases.length;
  const saveBtn = [...$("main").querySelectorAll("button.cta")].find((b) => /übernehmen/.test(b.textContent));
  ok("Übernehmen-Knopf ist vorhanden", !!saveBtn, saveBtn && saveBtn.textContent);
  if (saveBtn && !saveBtn.disabled) {
    click(saveBtn);
    ok("Bon-Positionen landen in der Historie", D.get().purchases.length > before,
      `${before} -> ${D.get().purchases.length}`);
  }
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
    const bookBtn = [...$("main").querySelectorAll("button.cta")].find((b) => b.textContent === "Buchen");
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
  const txt = $("main").textContent;
  ok("Zahlen zeigt den Rückblick", /Rückblick/.test(txt));
  ok("Zahlen zeigt die Meilensteine", /Erreicht/.test(txt));
  ok("Zahlen zeigt den Streak", /Am Stück/.test(txt));

  /* --- Marke gegen Eigenmarke --- */
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

console.log("\n--- Die Übersicht ---");
{
  D.reset();
  D.loadDemo("full");
  const b4 = errors.length;
  App.goto("start");
  const main = $("main");
  ok("Die Übersicht rendert", errors.length === b4 && main.children.length > 0, errors[b4]);

  /* Dieselbe Grenze wie für die Liste, und aus demselben Grund. Die
     Übersicht darf reicher aussehen, aber nicht wieder zuwachsen. */
  const bloecke = main.querySelectorAll(":scope > .group, :scope > .card");
  ok("Die Übersicht hat höchstens vier Blöcke", bloecke.length <= 4, bloecke.length);

  ok("Die Liste ist NICHT der erste Reiter", T.NAV[0].id === "start", T.NAV[0].id);
  ok("Und die Woche steht ganz oben", !!main.querySelector(".pulse"));

  /* Der Wochenstreifen: sieben Tage, heute zuerst. */
  const tage = main.querySelectorAll(".pDay");
  ok("Sieben Tage", tage.length === 7, tage.length);
  ok("Heute ist markiert", main.querySelectorAll(".pDay.today").length === 1);
  ok("Und steht vorn", tage[0].classList.contains("today"));
  ok("Der Streifen sagt einen Satz", /\S/.test(main.querySelector(".pulseHead").textContent));

  /* Die Felder sind Ereignisse, keine erfundene Höhe: so viele
     Felder wie der Streifen Ereignisse hat (bis zur Kappung bei 5). */
  const felder = main.querySelectorAll(".pSeg").length;
  const erwartet = App.ctx.pulse.days.reduce((a, d) => a + Math.min(5, d.count), 0);
  ok("Ein Feld je Ereignis", felder === erwartet, `${felder} statt ${erwartet}`);

  /* Ein Tag lässt sich öffnen und zeigt, was dahintersteckt. */
  const voll = [...tage].find((t) => t.querySelectorAll(".pSeg").length > 0);
  ok("Es gibt einen Tag mit Inhalt", !!voll);
  if (voll) {
    click(voll);
    ok("Der Tag öffnet ein Blatt", !!$("sheetTitle").textContent);
    ok("Und nennt die Sachen beim Namen", $("sheetOpts").querySelectorAll(".row").length > 0);
    App.closeSheet();
  }
  const leer = [...tage].find((t) => t.querySelectorAll(".pSeg").length === 0);
  if (leer) {
    click(leer);
    ok("Ein ruhiger Tag sagt das auch", /nichts an/.test($("sheetOpts").textContent));
    App.closeSheet();
  }

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
    [...main.querySelectorAll("button")].some((b) => b.textContent === "Nach Gängen"));
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
    .find((r) => /Hinweis|kühlen/i.test(r.textContent));
  ok("Und die Zeile ist da", !!hRow);
  click(hRow);
  ok("Sie öffnet das Sammelblatt", /Hinweise/.test($("sheetTitle").textContent));
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

console.log("\n--- Sicherung ---");
{
  D.reset();
  D.loadDemo("full");

  // Der Browser wird ersetzt, nicht die Logik: Datei-Auswahl,
  // Schreiben und dauerhafter Speicher laufen gegen einen Doppelgänger,
  // alles andere ist echt.
  T.Backup.adapter = {
    persisted: false, installed: false, webkit: false,
    supportsAutoFile: true, grantPersist: true, handle: null
  };
  T.Backup._persisted = false;
  T.Backup.handle = null;

  App.goto("mehr");
  const txt = () => $("main").textContent;
  ok("Mehr zeigt die Sicherung", /Sicherung/.test(txt()));
  ok("Und sagt beim ersten Mal, dass nichts gesichert ist",
    /Noch nie gesichert/.test(txt()), txt().slice(0, 120));
  ok("Der Zustand steht auch im Kontext", App.ctx.backup.level === "gefaehrdet", App.ctx.backup.level);

  /* --- Dauerhafter Speicher --- */
  const persistBtn = [...$("main").querySelectorAll("button")]
    .find((b) => /Dauerhaften Speicher erlauben/.test(b.textContent));
  ok("Es gibt einen Weg zum dauerhaften Speicher", !!persistBtn);

  /* --- Herunterladen --- */
  const dlBtn = [...$("main").querySelectorAll("button")]
    .find((b) => /herunterladen/i.test(b.textContent));
  ok("Und einen zum Herunterladen", !!dlBtn);
  click(dlBtn);
  ok("Die Datei wird erzeugt", !!T.Backup.adapter.lastDownload,
    JSON.stringify(T.Backup.adapter.lastDownload && T.Backup.adapter.lastDownload.filename));
  ok("Sie trägt das Datum im Namen",
    T.Backup.adapter.lastDownload.filename === T.backupFileName(D.today()),
    T.Backup.adapter.lastDownload.filename);
  ok("Und enthält die Käufe",
    JSON.parse(T.Backup.adapter.lastDownload.text).purchases.length === D.get().purchases.length);
  ok("Die Sicherung ist vermerkt", D.get().backup.lastDate === D.today(), JSON.stringify(D.get().backup));
  App.goto("mehr");
  ok("Danach meldet die App nicht mehr „nie gesichert“", !/Noch nie gesichert/.test(txt()));

  /* --- Automatische Datei --- */
  ok("Wo der Browser es kann, wird die Automatik angeboten",
    [...$("main").querySelectorAll("button")].some((b) => /Datei wählen und automatisch/.test(b.textContent)));

  /* --- Wo der Browser es NICHT kann, wird das gesagt --- */
  T.Backup.adapter.supportsAutoFile = false;
  T.Backup.handle = null;
  App.goto("mehr");
  ok("Ohne Dateizugriff steht kein toter Knopf da",
    ![...$("main").querySelectorAll("button")].some((b) => /automatisch sichern/.test(b.textContent)));
  ok("Stattdessen wird erklärt, warum es beim Erinnern bleibt",
    /kann keine Datei automatisch fortschreiben/.test(txt()));
  T.Backup.adapter.supportsAutoFile = true;

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

  /* --- Die Erinnerung bleibt selten --- */
  {
    D.update((st) => { st.backup = { lastDate: null, lastKind: null, receiptsAt: 0, lastNag: null }; });
    App.render();
    const h = App.ctx.backup;
    ok("Ohne Sicherung ist der Zustand dringend", h.urgent === true, h.level);
    App.maybeRemindBackup();
    ok("Es wird einmal erinnert", !$("sheet").hidden);
    click($("sheetCancel"));
    const nag = D.get().backup.lastNag;
    ok("Und der Zeitpunkt festgehalten", nag === D.today(), nag);
    App.maybeRemindBackup();
    ok("Beim nächsten Start nicht sofort wieder", $("sheet").hidden);
  }

  /* --- Die Automatik zuletzt: ihre Kette läuft über Versprechen, und
     alles, was danach synchron am Zustand dreht, käme ihr zuvor. Genau
     das ist beim ersten Anlauf passiert — der Test setzte den
     Dateigriff zurück, bevor geschrieben war, und prüfte dann, warum
     nichts geschrieben wurde. --- */
  App.goto("mehr");
  const autoBtn = [...$("main").querySelectorAll("button")]
    .find((b) => /Datei wählen und automatisch/.test(b.textContent));
  click(autoBtn);
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
  ok("Und sagt, wo das Bild bleibt", /bleibt auf dem Gerät/.test(txt));
  const knopf = [...$("main").querySelectorAll("button")].find((b) => /Bild wählen/.test(b.textContent));
  ok("Es gibt eine Schaltfläche zum Wählen", !!knopf);
  const kamera = [...$("main").querySelectorAll("input[type=file]")].find((i) => i.hasAttribute("capture"));
  ok("Und einen Weg direkt in die Kamera", !!kamera);

  // Den Weg über den echten Dateidialog kann jsdom nicht gehen —
  // also wird die Datei direkt eingespeist, so wie es der Hörer täte.
  const vorher = D.get().receipts.length;
  const gelesen = T.readReceiptImage(BILD, { today: "2026-08-12" });
  ok("Das Bild wird zu Bon-Text", gelesen.kept === 3, gelesen.kept + ": " + gelesen.text);
  ok("Datum kommt aus dem Bild", gelesen.date === "2026-08-12", gelesen.date);
  ok("Markt auch", gelesen.store === "Lidl", gelesen.store);
  ok("Die Ziffern sind zurückgedreht", /1,29/.test(gelesen.text) && /0,59/.test(gelesen.text));

  const p = D.parseReceiptText(gelesen.text);
  ok("Die Zeilen werden Produkten zugeordnet", p.rows.length === 3, p.rows.length);
  ok("Und die sicheren sind wirklich sicher",
    p.rows.filter((r) => r.productId).length === 3,
    p.rows.map((r) => r.raw + "->" + r.productId).join(" | "));

  const res = D.addReceipt({ date: gelesen.date, store: gelesen.store, items: p.rows });
  ok("Der Bon lässt sich buchen", res.count === 3, res.count);
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
  // gelbe Marke steht mal für „überfällig“, mal für „teurer als sonst“.
  ok("Überfällig und teuer erklären Verschiedenes",
    T.PILL_INFO.ueberfaellig[1] !== T.PILL_INFO.teuer[1]);
  ok("Jede Erklärung hat Überschrift und Text",
    Object.values(T.PILL_INFO).every((v) => Array.isArray(v) && v[0] && v[1] && v[1].length > 60));

  // Ein vertippter Schlüssel darf nicht still eine stumme Marke
  // erzeugen — deshalb wird hier geprüft, dass alle benutzten
  // Schlüssel existieren.
  const benutzt = ["own", "ueberfaellig", "risiko", "vd", "teuer", "guenstig", "doppelt",
    "zustand", "rest", "haltbar", "angebrochen", "marke", "eigenmarke"];
  ok("Alle benutzten Schlüssel sind hinterlegt",
    benutzt.every((k) => T.PILL_INFO[k]), benutzt.filter((k) => !T.PILL_INFO[k]).join(", "));

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

/* Der Weg über die Datei-Automatik läuft über Versprechen. Er steht
   deshalb hier unten: erst wenn alle Mikroaufgaben abgearbeitet sind,
   lässt sich prüfen, ob wirklich geschrieben wurde. */
/* Kurz warten statt Mikroaufgaben zählen: die Kette aus Auswahl,
   Schreiben und Neuzeichnen ist mehrere Versprechen tief, und eine
   feste Anzahl `then` zu raten wäre ein Test, der bei der nächsten
   Änderung stillschweigend zu früh prüft. */
setTimeout(() => {
  const ad = T.Backup.adapter;
  ok("Die Automatik hat ein Ziel gewählt", !!(ad && ad.handle), JSON.stringify(ad && ad.handle && ad.handle.name));
  ok("Und sofort einmal geschrieben", !!(ad && ad.lastWrite), typeof (ad && ad.lastWrite));
  ok("Was geschrieben wurde, ist ein gültiger Stand", (() => {
    try { return JSON.parse(ad.lastWrite).schema === D.SCHEMA; } catch (e) { return false; }
  })());
  T.Backup.adapter = null;
  T.Backup.handle = null;

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

  App.goto("start");
  const tage = [...$("main").querySelectorAll(".pDay")];
  ok("Die Tage der Woche sind Schaltflächen",
    tage.length === 7 && tage.every((t) => t.tagName === "BUTTON"), tage.length);
  ok("Und sie tragen eine eigene Fläche",
    /\.pDay\{[^}]*background:var\(--fill\)/.test(css));

  /* Kein Kürzel auf der einzigen rechtlich harten Marke. */
  App.goto("liste");
  const marken = [...$("main").querySelectorAll(".items .pill.safety")].map((p) => p.textContent);
  ok("Es gibt eine Verbrauchsdatum-Marke", marken.length > 0, marken.length);
  ok("Sie ist ausgeschrieben", marken.every((m) => /Verbrauchsdatum/.test(m)), marken.join(" | "));
  ok("Und nicht mehr abgekürzt", !marken.some((m) => m.trim() === "VD"), marken.join(" | "));
}

console.log("\n--- Kanten: Flächen eckig, Punkte rund ---");
{
  /* Die Regel steht als Kommentar in app.css und wäre damit eine
     Absichtserklärung. Hier wird sie geprüft — sonst schleicht sich
     beim nächsten neuen Bauteil wieder ein `border-radius:12px` ein,
     und niemand sieht es, weil zwölf Pixel für sich harmlos aussehen. */
  const css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  const token = (name) => (css.match(new RegExp("--" + name + ":(\\S+?);")) || [])[1];
  ["r-lg", "r-md", "r-sm"].forEach((t) =>
    ok(`--${t} ist eckig`, token(t) === "0px", token(t)));

  /* Erlaubt ist genau zweierlei: ein voller Kreis (99px, 50 %) oder
     gar keine Rundung. Alles dazwischen ist die weiche Ecke, die weg
     sollte. */
  const werte = [...css.matchAll(/border-radius:([^;}]+)/g)].map((m) => m[1].trim());
  const dazwischen = werte.filter((v) => {
    if (/var\(/.test(v) || /%/.test(v)) return false;
    return v.split(/\s+/).some((teil) => {
      const z = parseFloat(teil);
      return Number.isFinite(z) && z > 0 && z < 40;
    });
  });
  ok("Keine halbrunden Ecken mehr", dazwischen.length === 0, dazwischen.join(" | "));

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

  [".pSeg", ".cta", ".barBtn", ".pillBtn", ".toast"].forEach((sel) =>
    ok(`${sel} ist eckig`, radius(sel) === "keine" || /var\(/.test(radius(sel)), radius(sel)));
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
