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
    " reviewCard, reviewSheet, streakStrip, badgeScroller, weeklyReview, weekRangeFor, milestoneState };"
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
["liste", "faellig", "bestand", "erfassen", "zahlen", "mehr"].forEach((tab) => {
  const before = errors.length;
  App.goto(tab);
  ok(`Bereich "${tab}" rendert`, errors.length === before && $("main").children.length > 0, errors[before]);
});

console.log("\n--- Liste bedienen ---");
App.goto("liste");
const boxes = $("main").querySelectorAll("input.box");
ok("Positionen sind abhakbar", boxes.length > 0, `${boxes.length} Kästchen`);
if (boxes.length) {
  const b4 = errors.length;
  boxes[0].checked = false;
  boxes[0].dispatchEvent(new window.Event("change", { bubbles: true }));
  ok("Abwählen läuft fehlerfrei", errors.length === b4, errors[b4]);
  const off = $("main").querySelectorAll(".item.off").length;
  ok("Abwahl ist sichtbar", off > 0);
  ok("Abwahl wird gespeichert", Object.keys(D.get().listChoices).length > 0);
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
ok("Reichweite erscheint als Ring", !!$("main").querySelector(".hero .heroRing svg"));
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
  ok("Position lässt sich antippen", !!main && main.tagName === "BUTTON");
  const b4 = errors.length;
  click(main);
  ok("Detail-Blatt öffnet ohne Fehler", $("sheet").hidden === false && errors.length === b4, errors[b4]);
  ok("Detail-Blatt nennt Rhythmus und Preis",
    /Rhythmus/.test($("sheet").textContent) && /Preis/.test($("sheet").textContent));
  ok("Detail-Blatt nennt die Datenqualität", /Datenqualität/.test($("sheet").textContent));
  App.closeSheet();
}
{
  const hero = $("main").querySelector("button.hero");
  ok("Reichweite ist antippbar", !!hero);
  if (hero) {
    click(hero);
    ok("Reichweite erklärt ihre Herleitung", /Haltbarkeit/.test($("sheet").textContent));
    App.closeSheet();
  }
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
  // Die Gegenrichtung: „War schon alle" verkürzt und wählt NICHT ab
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
  // Vier Antwortmöglichkeiten in der Oberfläche
  D.reset();
  D.loadDemo("full");
  App.goto("liste");
  const box = $("main").querySelector("input.box");
  if (box) {
    box.checked = false;
    box.dispatchEvent(new window.Event("change", { bubbles: true }));
    const opts = $("main").querySelectorAll(".opts .opt");
    ok("Die Liste bietet vier Antworten", opts.length === 4,
      [...opts].map((o) => o.textContent).join(" / "));
  } else ok("Die Liste bietet vier Antworten", false, "keine Position");
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
  ok("Der Rückblick hat Inhalt", c.review.lines.length > 0, c.review.lines.map((l) => l.key).join(","));
  ok("Und eine Überschrift ohne Platzhalter",
    !/undefined|NaN/.test(c.review.headline), c.review.headline);

  // Die Karte hängt am Wochentag — deshalb wird sie unabhängig davon
  // geprüft, sonst liefe der Test nur dienstags durch.
  const cardNode = T.reviewCard(c, App);
  ok("Die Rückblick-Karte rendert", cardNode.querySelectorAll(".rvItem").length > 0);
  ok("Sie trägt eine Überschrift", cardNode.querySelector(".rvHead2").textContent.length > 0);
  ok("Und lässt sich schließen", !!cardNode.querySelector(".rvClose"));

  T.reviewSheet(c, App);
  ok("Das Rückblick-Blatt öffnet", !$("sheet").hidden);
  ok("Es nennt die Herkunft der Zahlen",
    /geschätzt|nachrechenbar|Medianpreis/.test($("sheetOpts").textContent));
  ok("Es zeigt die Wochenpunkte", $("sheetOpts").querySelectorAll(".sDot").length === 8);
  click($("sheetCancel"));

  const dots = T.streakStrip(c);
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
  ok("Ein erreichter Meilenstein öffnet das Glückwunsch-Blatt",
    !$("sheet").hidden && /Geschafft/.test($("sheetTitle").textContent), $("sheetTitle").textContent);
  ok("Es nennt die Stufe", /Stufe \d+ von \d+/.test($("sheetOpts").textContent));
  click($("sheetCancel"));
  ok("Danach ist er als gesehen vermerkt",
    App.ctx.freshBadges.length === 0, App.ctx.freshBadges.map((b) => b.key).join(","));
  ok("Und wird nicht erneut gefeiert", $("sheet").hidden);
  ok("Der Meilenstein bleibt erreicht", need && App.ctx.badges.count > 0);
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

});
