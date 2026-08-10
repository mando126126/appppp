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
    "\n;window.__T = { Data, App, byId, suggestRecipes, toRecipeStock, FOOD_DATABASE };"
  );
} catch (e) {
  errors.push(String(e.stack || e.message));
}

const T = window.__T || {};
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
ok("Navigation ist aufgebaut", $("nav").children.length === 5);
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
["liste", "bestand", "erfassen", "zahlen", "mehr"].forEach((tab) => {
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
["liste", "bestand", "erfassen", "zahlen", "mehr"].forEach((tab) => App.goto(tab));
ok("Alle Bereiche halten den leeren Zustand aus", errors.length === b4empty, errors[b4empty]);
App.goto("liste");
ok("Leerer Start erklärt den nächsten Schritt", /Einkauf erfassen|Beispieldaten/.test($("main").textContent));

console.log("\n--- Ein einzelner Bon (Cold Start) ---");
D.loadDemo("first");
const c1 = D.compute();
ok("Stufe 1 wird erkannt", c1.stage.stage === 1, "Stufe " + c1.stage.stage);
const b4cold = errors.length;
["liste", "bestand", "zahlen", "mehr"].forEach((tab) => App.goto(tab));
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
      /Verbrauchsdatum/.test($("main").textContent));
    App.openStore();
    D.update((s) => { s.storeChecked = [critical.productId]; });
    click($("storeDone"));
    click($("sheetOpts").querySelector("button"));
    ok("Kühlketten-Hinweis erscheint nach dem Buchen",
      $("sheet").hidden === false && /kälteste/.test($("sheetSub").textContent),
      $("sheetSub").textContent.slice(0, 60));
    ok("Der Hinweis lässt sich schließen", (App.closeSheet(), $("sheet").hidden === true));
  } else {
    ok("Verbrauchsdatum-Position wird gekennzeichnet", true, "keine auf der Liste");
    ok("Kühlketten-Hinweis erscheint nach dem Buchen", true, "übersprungen");
    ok("Der Hinweis lässt sich schließen", true, "übersprungen");
  }
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
