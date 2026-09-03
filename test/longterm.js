/**
 * longterm.js — drei Jahre Haushalt durch die gebaute App
 * ================================================================
 * Alle anderen Tests beantworten die Frage „rechnet es richtig?".
 * Dieser beantwortet eine andere: **bringt es dem Haushalt über Jahre
 * etwas?** Das sind zwei verschiedene Fragen, und die zweite ist die,
 * an der Apps scheitern — nicht an falschen Zahlen, sondern daran,
 * dass sie nach vier Monaten nichts mehr beitragen, was der Nutzer
 * nicht ohnehin wüsste.
 *
 * VERFAHREN
 * Ein simulierter Haushalt lebt 1095 Tage. Er verbraucht Tag für Tag,
 * kauft zweimal die Woche ein, fährt zweimal im Jahr in Urlaub, und
 * nach anderthalb Jahren zieht eine Person aus. Diese Welt läuft
 * DREIMAL mit demselben Startwert, mit drei verschiedenen Strategien:
 *
 *   1. GEDÄCHTNIS   — der Haushalt kauft, woran er sich erinnert
 *   2. FESTE LISTE  — dieselbe Standardliste bei jedem Einkauf
 *   3. EINKAUFS-ANKER — die gebaute App, im simulierten Browser,
 *                       mit echtem Speicher und echtem compute()
 *
 * Gemessen wird, was einen Haushalt tatsächlich Geld und Nerven
 * kostet:
 *   - VERGESSEN: gebraucht, aber nicht gekauft (der zweite Weg zum Laden)
 *   - UNNÖTIG:   gekauft, obwohl noch genug da war (die spätere Tonne)
 *   - VERDORBEN: in Euro, aus verfallenen Packungen
 *   - LEERTAGE:  Tage, an denen etwas fehlte
 *
 * WAS DIESER TEST NICHT IST
 * Er misst kein echtes Nutzerverhalten. Die Vergesslichkeitsrate von
 * 30 % ist eine Annahme, keine Messung, und ein echter Haushalt ist
 * unordentlicher als jedes Modell. Belastbar ist deshalb nur der
 * VERGLEICH: drei Strategien in derselben Welt, mit denselben
 * Zufallszahlen. Die absoluten Zahlen sind Modellwerte.
 *
 * Dazu die Alterungsfragen, die kein Einzeltest stellt: wächst der
 * Speicher unbegrenzt, wird compute() mit den Jahren langsam, driften
 * die Rhythmen weg, bleiben Streak und Meilensteine widerspruchsfrei?
 *
 *   node test/longterm.js      (setzt "npm run build" voraus)
 */
const fs = require("fs");
const path = require("path");

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  console.log("jsdom nicht installiert — Langzeittest übersprungen.");
  process.exit(0);
}

const WEB = path.join(__dirname, "..", "web");
if (!fs.existsSync(path.join(WEB, "index.html"))) {
  console.error("web/ fehlt — erst 'npm run build' ausführen.");
  process.exit(1);
}

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("OK   " + name); }
  else { fail++; console.log("FEHL " + name + (detail !== undefined ? " — " + detail : "")); }
}
function section(t) { console.log("\n--- " + t + " ---"); }

/* ================================================================
   Die Welt: ein Haushalt, der wirklich verbraucht
   ================================================================ */
const START = "2024-01-01";
const DAYS = 1095;                 // drei Jahre
const BREAK_DAY = 550;             // eine Person zieht aus
const FORGET_RATE = 0.3;           // Annahme, keine Messung
const CHECK_RATE = 0.7;            // wie oft der Nutzer wirklich nachsieht

const shift = (d, n) => new Date(new Date(d + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const dayOf = (i) => shift(START, i);

/**
 * Produkte mit ihrem WAHREN Verbrauch. Die App kennt diese Zahlen
 * nicht — sie sieht nur Kaufdaten und muss daraus zurückrechnen.
 * `perDay` in Packungen je Tag, `shelf` in Tagen (null = verdirbt nicht).
 */
const WORLD = [
  { id: "milch_vollmilch", perDay: 1 / 3, pack: 2, shelf: 8, price: 1.19 },
  { id: "brot_vollkorn", perDay: 1 / 5, pack: 1, shelf: 6, price: 2.39 },
  { id: "joghurt_natur", perDay: 1 / 4, pack: 2, shelf: 14, price: 1.15 },
  { id: "eier", perDay: 1 / 11, pack: 1, shelf: 21, price: 3.39 },
  { id: "butter", perDay: 1 / 19, pack: 1, shelf: 40, price: 2.49 },
  { id: "kaese_gouda", perDay: 1 / 9, pack: 1, shelf: 18, price: 2.29 },
  { id: "nudeln", perDay: 1 / 12, pack: 2, shelf: null, price: 1.32 },
  { id: "reis", perDay: 1 / 34, pack: 1, shelf: null, price: 2.25 },
  { id: "kaffee", perDay: 1 / 28, pack: 1, shelf: null, price: 6.79 },
  { id: "bananen", perDay: 1 / 6, pack: 1, shelf: 7, price: 1.84 },
  { id: "aepfel", perDay: 1 / 11, pack: 1, shelf: 20, price: 2.59 },
  { id: "salat_kopf", perDay: 1 / 7, pack: 1, shelf: 5, price: 1.44 },
  { id: "haehnchen", perDay: 1 / 9, pack: 1, shelf: 3, price: 7.19 },
  { id: "paprika", perDay: 1 / 8, pack: 1, shelf: 10, price: 2.39 },
  { id: "tomaten", perDay: 1 / 7, pack: 1, shelf: 8, price: 2.59 },
  { id: "schokolade", perDay: 1 / 9, pack: 2, shelf: null, price: 1.24 },
  { id: "klopapier", perDay: 1 / 38, pack: 1, shelf: null, price: 4.19 },
  { id: "spuelmittel", perDay: 1 / 44, pack: 1, shelf: null, price: 1.34 },
  { id: "zahnpasta", perDay: 1 / 24, pack: 1, shelf: null, price: 1.89 },
  { id: "waschmittel", perDay: 1 / 21, pack: 1, shelf: null, price: 6.49 },
  { id: "kuechenrolle", perDay: 1 / 33, pack: 1, shelf: null, price: 2.09 },
  { id: "duschgel", perDay: 1 / 16, pack: 1, shelf: null, price: 2.09 }
];

// Die feste Liste: was ein Haushalt „immer" mitnimmt. Bewusst die
// häufigsten Produkte — die Strategie ist nicht dumm, nur starr.
const FIXED_LIST = ["milch_vollmilch", "brot_vollkorn", "joghurt_natur", "bananen", "tomaten", "salat_kopf"];

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Einkaufstage: Dienstag und Samstag, mit gelegentlichem Ausfall. */
function shoppingDays(rnd) {
  const out = [];
  for (let i = 0; i < DAYS; i++) {
    const wd = new Date(dayOf(i) + "T12:00:00Z").getUTCDay();
    if ((wd === 2 || wd === 6) && rnd() > 0.06) out.push(i);
  }
  return out;
}

/** Zwei Urlaube im Jahr, je zwei Wochen. */
function vacations() {
  const out = [];
  for (let y = 0; y < 3; y++) {
    out.push({ from: 190 + y * 365, to: 204 + y * 365 });
    out.push({ from: 350 + y * 365, to: 360 + y * 365 });
  }
  return out.filter((v) => v.to < DAYS);
}

/**
 * Der Haushalt als Zustandsmaschine. `strategy` liefert für einen
 * Einkaufstag die Liste der Produkte, die gekauft werden.
 */
function runWorld(seed, strategy, hooks = {}) {
  const rnd = lcg(seed);
  const days = shoppingDays(lcg(seed));   // für alle Strategien gleich
  const vacs = vacations();
  const daySet = new Set(days);

  // Vorrat als Chargen, damit Verderb überhaupt entstehen kann.
  const stock = new Map();
  WORLD.forEach((p) => stock.set(p.id, [{ units: p.pack, date: 0, expires: p.shelf ? p.shelf : Infinity }]));

  const m = {
    vergessen: 0, unnoetig: 0, verdorbenEuro: 0, leertage: 0,
    gekauft: 0, ausgaben: 0, bedarfGesamt: 0,
    quartale: []
  };
  let q = { vergessen: 0, bedarf: 0, unnoetig: 0, verdorben: 0, leertage: 0 };

  const onVacation = (i) => vacs.some((v) => i >= v.from && i <= v.to);
  const factor = (i) => (i >= BREAK_DAY ? 1 / 1.5 : 1);   // Person zieht aus
  const unitsLeft = (pid) => (stock.get(pid) || []).reduce((a, b) => a + b.units, 0);

  for (let i = 0; i < DAYS; i++) {
    /* --- Verbrauch und Verderb --- */
    for (const p of WORLD) {
      const batches = stock.get(p.id);

      // Verfallenes zuerst aussortieren — das ist der Verlust.
      for (let b = batches.length - 1; b >= 0; b--) {
        if (batches[b].expires <= i && batches[b].units > 0) {
          const lost = batches[b].units;
          m.verdorbenEuro += lost * p.price;
          q.verdorben += lost * p.price;
          batches.splice(b, 1);
        }
      }

      if (onVacation(i)) continue;      // im Urlaub wird nichts verbraucht
      let need = p.perDay * factor(i);
      // Zuerst das, was am ehesten verdirbt.
      batches.sort((a, b) => a.expires - b.expires);
      while (need > 0 && batches.length) {
        const take = Math.min(need, batches[0].units);
        batches[0].units -= take;
        need -= take;
        if (batches[0].units <= 1e-9) batches.shift();
      }
      if (need > 1e-9) { m.leertage++; q.leertage++; }
    }

    if (!daySet.has(i) || onVacation(i)) {
      if ((i + 1) % 91 === 0) { m.quartale.push({ ...q, tag: i }); q = { vergessen: 0, bedarf: 0, unnoetig: 0, verdorben: 0, leertage: 0 }; }
      continue;
    }

    /* --- Was der Haushalt WIRKLICH braucht ---
     * Bis zum übernächsten Einkaufstag muss es reichen. Alles andere
     * wäre eine Wette darauf, morgen noch einmal zu gehen.           */
    // Gebraucht wird, was bis zum NÄCHSTEN Einkauf reichen muss —
    // nicht bis zum übernächsten. Wer zweimal die Woche einkauft,
    // erwartet keinen Wochenvorrat; er erwartet, dass es bis Samstag
    // reicht. Die Definition gilt für alle drei Strategien gleich.
    const nextIdx = days.indexOf(i);
    const horizon = (days[nextIdx + 1] || i + 4) - i;
    const bedarf = new Set();
    for (const p of WORLD) {
      if (unitsLeft(p.id) < p.perDay * factor(i) * horizon) bedarf.add(p.id);
    }
    m.bedarfGesamt += bedarf.size;
    q.bedarf += bedarf.size;

    /* --- Die Strategie entscheidet --- */
    const kauf = strategy({ day: i, date: dayOf(i), bedarf, unitsLeft, horizon, rnd, factor: factor(i) });

    /* --- Buchhaltung --- */
    bedarf.forEach((pid) => { if (!kauf.includes(pid)) { m.vergessen++; q.vergessen++; } });
    kauf.forEach((pid) => {
      const p = WORLD.find((x) => x.id === pid);
      if (!p) return;
      if (!bedarf.has(pid)) { m.unnoetig++; q.unnoetig++; }
      stock.get(pid).push({ units: p.pack, date: i, expires: p.shelf ? i + p.shelf : Infinity });
      m.gekauft++;
      m.ausgaben += p.price * p.pack;
    });

    if (hooks.afterShopping) hooks.afterShopping({ day: i, date: dayOf(i), kauf, bedarf, unitsLeft, horizon });
    if (hooks.perProduct) kauf.forEach((pid) => hooks.perProduct(pid, bedarf.has(pid), i));

    if ((i + 1) % 91 === 0) { m.quartale.push({ ...q, tag: i }); q = { vergessen: 0, bedarf: 0, unnoetig: 0, verdorben: 0, leertage: 0 }; }
  }

  m.vergessenAnteil = m.bedarfGesamt ? m.vergessen / m.bedarfGesamt : 0;
  m.unnoetigAnteil = m.gekauft ? m.unnoetig / m.gekauft : 0;
  return m;
}

/* ================================================================
   Strategie 1 und 2: ohne App
   ================================================================ */
const erinnert = (rnd) => rnd() > FORGET_RATE;

function strategieGedaechtnis({ bedarf, rnd }) {
  return [...bedarf].filter(() => erinnert(rnd));
}

function strategieFesteListe({ bedarf, unitsLeft, horizon, rnd, factor }) {
  const kauf = new Set();
  // Die Standardliste kommt immer mit — auch wenn noch genug da ist.
  FIXED_LIST.forEach((pid) => kauf.add(pid));
  // Alles andere nur, wenn man daran denkt.
  bedarf.forEach((pid) => { if (!kauf.has(pid) && erinnert(rnd)) kauf.add(pid); });
  return [...kauf];
}

/* ================================================================
   Strategie 3: die gebaute App im simulierten Browser
   ================================================================ */
function bootApp() {
  const html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];

  window.addEventListener("error", (e) => errors.push(String(e.error || e.message)));
  window.onerror = (msg, s, l, c, err) => errors.push(String(err || msg));

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
  window.console = { ...console, warn: () => {}, error: (...a) => errors.push(a.map(String).join(" ")) };

  /* Zeitreise: die App fragt überall `new Date()` und `Date.now()`.
     Ohne eine steuerbare Uhr ließe sich kein einziger Tag simulieren
     — und ein Langzeittest, der die Uhr nicht stellen kann, prüft
     nur den heutigen Tag dreitausendmal. */
  const RealDate = window.Date;
  const clock = { ms: Date.parse(START + "T12:00:00Z") };
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(clock.ms); else super(...args); }
    static now() { return clock.ms; }
  }
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  window.Date = FakeDate;

  const sources = [];
  for (const m of html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)) {
    sources.push(m[1] ? fs.readFileSync(path.join(WEB, m[1]), "utf8") : m[2]);
  }
  window.eval(sources.join("\n;\n") + "\n;window.__T = { Data, App, daysBetween };");

  return { window, errors, clock, T: window.__T };
}

const app = bootApp();
const { Data } = app.T;
const T = app.T;

const setClock = (dateStr) => { app.clock.ms = Date.parse(dateStr + "T12:00:00Z"); };

section("Start");
setClock(START);
Data.load();
Data.reset();
ok("Die App startet ohne Laufzeitfehler", app.errors.length === 0, app.errors[0]);
ok("Die Uhr lässt sich stellen", Data.today() === START, Data.today());

/* Kennzahlen der Alterung, quartalsweise erhoben. */
const alterung = [];
let computeMsMax = 0;
let letzterCtx = null;

function strategieAnker({ date, bedarf, unitsLeft, horizon, rnd, factor: f, day }) {
  setClock(date);

  const t0 = process.hrtime.bigint();
  const ctx = Data.compute();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms > computeMsMax) computeMsMax = ms;
  letzterCtx = ctx;

  const vorschlag = ctx.items.map((i) => i.productId);
  // Die Fälligkeit, die die Oberfläche in diesem Moment anzeigt. Sie
  // gehört zur Rückmeldung dazu: `app.js` gibt sie mit, und der
  // Feedback-Lerner gewichtet danach, WIE weit der Rhythmus daneben
  // lag. Hier stand lange eine feste 0 — damit war jede Rückmeldung
  // gleich viel wert und der ganze Überfälligkeits-Zweig des Lerners
  // in drei Jahren Simulation nie erreicht.
  const faellig = new Map(ctx.items.map((i) => [i.productId, i.dueIn || 0]));
  const kauf = new Set();

  // Trefferquote: wie viel von dem, was der Haushalt braucht, steht
  // überhaupt auf der Liste? Das ist die eine Zahl, an der sich eine
  // Vorschlagsfunktion messen lassen muss.
  TREFFER.push({ day, bedarf: bedarf.size, getroffen: [...bedarf].filter((p) => vorschlag.includes(p)).length,
    vorgeschlagen: vorschlag.length });

  vorschlag.forEach((pid) => {
    const p = WORLD.find((x) => x.id === pid);
    if (!p) return;
    // Der Nutzer schaut in den Kühlschrank — aber nicht immer.
    // Sieht er, dass noch genug da ist, antwortet er „Hab noch"; das
    // ist die Rückmeldung, aus der die App lernen soll, und sie muss
    // in derselben Simulation stattfinden.
    //
    // Ein Nutzer, der IMMER blind kauft, was die App sagt, wäre die
    // bequemere Annahme — und die unehrlichere: er verwandelt jeden
    // Vorschlag in einen Kauf und damit in einen Lernwert, was jede
    // Rückkopplung verdeckt. Ein Nutzer, der IMMER nachsieht, wäre
    // ebenso unrealistisch. `CHECK_RATE` ist eine Annahme, keine
    // Messung, und wird unten in beide Richtungen variiert.
    const genug = unitsLeft(pid) >= p.perDay * f * horizon;
    if (genug && rnd() < CHECK_RATE) {
      Data.recordFeedback(pid, "have", faellig.get(pid) || 0);
      return;
    }
    kauf.add(pid);
  });

  // Was fehlt und NICHT vorgeschlagen wurde, muss der Haushalt selbst
  // einfallen — mit derselben Vergesslichkeit wie ohne App.
  bedarf.forEach((pid) => {
    if (kauf.has(pid)) return;
    if (!erinnert(rnd)) return;
    kauf.add(pid);
    /* „War schon alle": die App lag zu spät.
     *
     * Die Bedingungen sind dieselben wie in askLate() (views.js) --
     * dort wird gefragt, wenn jemand ein Produkt selbst auf die Liste
     * setzt, das die App noch nicht vorgeschlagen hätte. Hier stand
     * lange eine feste 0 ohne jede Bedingung: die Rückmeldung feuerte
     * auch für Produkte ohne gelernten Rhythmus und immer mit dem
     * schwächstmöglichen Signal. Beides zusammen hat den
     * Verkürzungs-Zweig des Lerners in drei simulierten Jahren
     * praktisch stillgelegt -- eine Simulation, die eine ganze
     * Lernrichtung nicht erreicht, kann sie auch nicht prüfen. */
    const r = ctx.rhythms.get(pid);
    if (!r || !r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) return;
    const dueIn = r.rhythmDays - T.daysBetween(r.lastPurchaseDate, date);
    if (!(dueIn >= 2)) return;
    if (rnd() < 0.5) Data.recordFeedback(pid, "empty", dueIn);
  });

  return [...kauf];
}

function ankerNachEinkauf({ date, kauf }) {
  setClock(date);
  if (!kauf.length) return;
  Data.addReceipt({
    date,
    store: "Supermarkt",
    items: kauf.map((pid) => {
      const p = WORLD.find((x) => x.id === pid);
      // Preise schwanken wie im echten Leben, sonst gäbe es kein
      // Preis-Gedächtnis und keine realisierte Ersparnis.
      const swing = 0.88 + ((date.charCodeAt(8) + date.charCodeAt(9) + pid.length) % 25) / 100;
      return { productId: pid, quantity: p.pack, unitPrice: Math.round(p.price * swing * 100) / 100 };
    })
  });
}

section("Drei Jahre, dreimal dieselbe Welt");
const SEED = 20260811;
const t0 = Date.now();
const gedaechtnis = runWorld(SEED, strategieGedaechtnis);
const feste = runWorld(SEED, strategieFesteListe);
const DIAG = new Map();
const TREFFER = [];
let letztesHalbjahr = -1;
const anker = runWorld(SEED, strategieAnker, {
  perProduct: (pid, needed, day) => {
    if (!DIAG.has(pid)) DIAG.set(pid, { kauf: 0, unnoetig: 0, unnoetigNachBruch: 0 });
    const d = DIAG.get(pid);
    d.kauf++;
    if (!needed) { d.unnoetig++; if (day >= BREAK_DAY) d.unnoetigNachBruch++; }
  },
  afterShopping: (x) => {
    ankerNachEinkauf(x);
    // Einkaufstage liegen nicht auf runden Zahlen — es zählt, welches
    // Halbjahr gerade begonnen hat, nicht ob der Tag teilbar ist.
    const halbjahr = Math.floor(x.day / 182);
    if (halbjahr > letztesHalbjahr) {
      letztesHalbjahr = halbjahr;
      const s = Data.get();
      alterung.push({
        tag: x.day,
        kaeufe: s.purchases.length,
        bons: s.receipts.length,
        protokoll: s.actions.length,
        rueckmeldungen: s.feedbackLog.length,
        bytes: JSON.stringify(s).length,
        streak: letzterCtx.streak.weeks,
        stufen: letzterCtx.badges.count
      });
    }
  }
});
const dauer = ((Date.now() - t0) / 1000).toFixed(1);

const pct = (x) => (x * 100).toFixed(1) + " %";
const eur = (x) => x.toFixed(2).replace(".", ",") + " €";

console.log(`\n  ${DAYS} Tage, ${WORLD.length} Produkte, Bruch an Tag ${BREAK_DAY}, ${vacations().length} Urlaube`);
console.log(`  Rechenzeit gesamt: ${dauer} s\n`);
console.log("  Strategie        vergessen   unnötig    verdorben   Leertage   Ausgaben");
console.log("  " + "-".repeat(74));
const zeile = (name, m) =>
  console.log(`  ${name.padEnd(16)} ${pct(m.vergessenAnteil).padStart(8)} ${pct(m.unnoetigAnteil).padStart(10)} ` +
    `${eur(m.verdorbenEuro).padStart(11)} ${String(m.leertage).padStart(9)} ${eur(m.ausgaben).padStart(11)}`);
zeile("Gedächtnis", gedaechtnis);
zeile("Feste Liste", feste);
zeile("Einkaufs-Anker", anker);
if (process.env.DIAG) {
  console.log("\n  Produkt              Käufe  unnötig  davon nach Bruch");
  [...DIAG.entries()].sort((a,b)=>b[1].unnoetig-a[1].unnoetig).forEach(([pid,d])=>
    console.log(`  ${pid.padEnd(20)} ${String(d.kauf).padStart(5)} ${String(d.unnoetig).padStart(8)} ${String(d.unnoetigNachBruch).padStart(17)}`));
}

/* ================================================================
   1. Bringt die App dem Haushalt etwas?
   ================================================================ */
section("Nutzen gegenüber den Alternativen");
{
  ok("Weniger Vergessenes als aus dem Gedächtnis",
    anker.vergessenAnteil < gedaechtnis.vergessenAnteil,
    `${pct(anker.vergessenAnteil)} gegen ${pct(gedaechtnis.vergessenAnteil)}`);
  ok("Und zwar deutlich — mindestens ein Drittel weniger",
    anker.vergessenAnteil < gedaechtnis.vergessenAnteil * 0.67,
    `${pct(anker.vergessenAnteil)} gegen ${pct(gedaechtnis.vergessenAnteil)}`);
  ok("Weniger Vergessenes als mit fester Liste",
    anker.vergessenAnteil < feste.vergessenAnteil,
    `${pct(anker.vergessenAnteil)} gegen ${pct(feste.vergessenAnteil)}`);

  // Die feste Liste kauft alles immer mit — sie vergisst weniger als
  // das Gedächtnis, kauft dafür massenhaft Überflüssiges. Genau
  // dieser Handel darf die App NICHT machen.
  ok("Ohne dafür wahllos einzukaufen",
    anker.unnoetigAnteil < feste.unnoetigAnteil,
    `${pct(anker.unnoetigAnteil)} gegen ${pct(feste.unnoetigAnteil)}`);
  ok("Weniger verdorbene Ware als mit fester Liste",
    anker.verdorbenEuro < feste.verdorbenEuro,
    `${eur(anker.verdorbenEuro)} gegen ${eur(feste.verdorbenEuro)}`);
  ok("Weniger Tage, an denen etwas fehlt, als aus dem Gedächtnis",
    anker.leertage < gedaechtnis.leertage,
    `${anker.leertage} gegen ${gedaechtnis.leertage}`);

  /* --- Der ehrliche Vergleich ------------------------------------
   * Das Gedächtnis wirft am wenigsten weg. Das ist KEIN Sieg dieser
   * Strategie, sondern die Folge davon, dass dieser Haushalt
   * chronisch unterversorgt ist: er hat an doppelt so vielen Tagen
   * nichts da und wirft deshalb weniger weg. Wer weniger kauft,
   * verdirbt weniger — und steht öfter vor dem leeren Kühlschrank.
   *
   * Vergleichbar ist nur, was gleich gut versorgt ist. Genau dafür
   * ist die feste Liste da: sie erreicht dasselbe Versorgungsniveau
   * und ist deshalb der Maßstab, an dem sich die App messen lassen
   * muss.                                                          */
  console.log(`\n  Bei gleichem Versorgungsniveau (${anker.leertage} zu ${feste.leertage} Leertage):`);
  console.log(`    Ausgaben  ${eur(anker.ausgaben)} gegen ${eur(feste.ausgaben)}  (${eur(feste.ausgaben - anker.ausgaben)} weniger)`);
  console.log(`    Verderb   ${eur(anker.verdorbenEuro)} gegen ${eur(feste.verdorbenEuro)}  (${eur(feste.verdorbenEuro - anker.verdorbenEuro)} weniger)`);
  console.log(`    Das sind ${eur((feste.ausgaben - anker.ausgaben) / 3)} im Jahr, ohne dass jemand auf etwas verzichtet.`);
  console.log(`\n  Das Gedächtnis verdirbt weniger (${eur(gedaechtnis.verdorbenEuro)}) — weil dieser Haushalt`);
  console.log(`  an ${gedaechtnis.leertage} statt ${anker.leertage} Tagen etwas fehlte. Wer weniger kauft, verdirbt weniger.`);

  ok("Bei gleicher Versorgung wird weniger ausgegeben",
    anker.ausgaben < feste.ausgaben && anker.leertage <= feste.leertage,
    `${eur(anker.ausgaben)} bei ${anker.leertage} Leertagen gegen ${eur(feste.ausgaben)} bei ${feste.leertage}`);
}

/* ================================================================
   2. Wird es über die Jahre besser — oder schlechter?
   ================================================================ */
section("Verlauf über drei Jahre");
{
  const qs = anker.quartale.filter((q) => q.bedarf > 0);
  const rate = (q) => q.vergessen / q.bedarf;
  console.log("  Vergessen je Quartal: " + qs.map((q) => pct(rate(q))).join("  "));
  console.log("  absolut (vergessen/bedarf): " + qs.map((q) => `${q.vergessen}/${q.bedarf}`).join("  "));
  const tq = [];
  for (let i = 0; i < 12; i++) {
    const teil = TREFFER.filter((t) => t.day >= i * 91 && t.day < (i + 1) * 91);
    const b = teil.reduce((a, t) => a + t.bedarf, 0);
    const g = teil.reduce((a, t) => a + t.getroffen, 0);
    const v = teil.reduce((a, t) => a + t.vorgeschlagen, 0);
    if (b) tq.push({ q: i + 1, recall: g / b, listenlaenge: v / teil.length });
  }
  console.log("  Trefferquote je Quartal:    " + tq.map((t) => pct(t.recall)).join("  "));
  console.log("  Listenlänge je Einkauf:     " + tq.map((t) => t.listenlaenge.toFixed(1)).join("    "));
  if (process.env.DIAG) {
    console.log("  Um den Urlaub 920-934 herum (Tag: getroffen/bedarf, Liste):");
    console.log("    " + TREFFER.filter((t) => t.day >= 890 && t.day <= 1000)
      .map((t) => `${t.day}:${t.getroffen}/${t.bedarf}(${t.vorgeschlagen})`).join("  "));
  }

  const ersteJahr = qs.slice(0, 4);
  const letztesJahr = qs.slice(-4);
  const mittel = (list) => list.reduce((a, q) => a + rate(q), 0) / Math.max(1, list.length);

  ok("Das dritte Jahr ist besser als das erste",
    mittel(letztesJahr) <= mittel(ersteJahr),
    `${pct(mittel(letztesJahr))} gegen ${pct(mittel(ersteJahr))}`);
  ok("Kein Quartal fällt hinter das Gedächtnis zurück",
    qs.every((q) => rate(q) < FORGET_RATE),
    qs.map((q) => pct(rate(q))).join(" "));

  // Der Bruch an Tag 550: eine Person zieht aus, alles hält länger.
  // Die App muss das merken, statt weiter im alten Takt zu drängeln.
  const vorBruch = qs.filter((q) => q.tag < BREAK_DAY);
  const nachBruch = qs.filter((q) => q.tag > BREAK_DAY + 200);
  ok("Der Haushaltsbruch wird verkraftet",
    mittel(nachBruch) <= mittel(vorBruch) + 0.05,
    `vorher ${pct(mittel(vorBruch))}, ein halbes Jahr danach ${pct(mittel(nachBruch))}`);

  const spaeteQuartale = qs.slice(-6).map(rate);
  const spanne = Math.max(...spaeteQuartale) - Math.min(...spaeteQuartale);
  ok("Es schwingt sich nicht auf", spanne < 0.2, "Spanne " + pct(spanne));
}

/* ================================================================
   3. Altert die App? Speicher, Rechenzeit, Widersprüche
   ================================================================ */
section("Alterung");
{
  console.log("  Halbjahr | Käufe | Bons | Protokoll | Rückmeld. | Speicher | Streak | Stufen");
  alterung.forEach((a, i) => console.log(
    `  ${String(i + 1).padStart(8)} | ${String(a.kaeufe).padStart(5)} | ${String(a.bons).padStart(4)} | ` +
    `${String(a.protokoll).padStart(9)} | ${String(a.rueckmeldungen).padStart(9)} | ` +
    `${String(Math.round(a.bytes / 1024) + " KB").padStart(8)} | ${String(a.streak).padStart(6)} | ${String(a.stufen).padStart(6)}`));

  const letzte = alterung[alterung.length - 1];
  const S = Data.get();

  ok("Der Speicher bleibt unter einem Megabyte", letzte.bytes < 1024 * 1024,
    Math.round(letzte.bytes / 1024) + " KB");
  ok("Das Ereignis-Protokoll läuft nicht über", S.actions.length <= 1500, S.actions.length);
  ok("Die Rückmeldungen laufen nicht über", S.feedbackLog.length < 2000, S.feedbackLog.length);

  // Käufe wachsen zwangsläufig — das ist die Historie und soll so
  // sein. Protokoll und Rückmeldungen aber nicht: die werden gekürzt.
  const p = alterung.map((a) => a.protokoll);
  ok("Das Protokoll wächst langsamer als die Historie",
    p[p.length - 1] / p[0] < letzte.kaeufe / alterung[0].kaeufe,
    `Protokoll ×${(p[p.length - 1] / p[0]).toFixed(1)}, Käufe ×${(letzte.kaeufe / alterung[0].kaeufe).toFixed(1)}`);

  ok("compute() bleibt unter einer Viertelsekunde", computeMsMax < 250, computeMsMax.toFixed(0) + " ms");
  const hoch = alterung.reduce((a, x) => Math.max(a, x.streak), 0);
  console.log(`  Streak-Verlauf: ${alterung.map((a) => a.streak).join(" -> ")} (höchster: ${hoch})`);
  ok("Der Streak überlebt Urlaube", hoch >= 50, hoch);
  ok("Meilensteine sind erreicht, aber nicht alle",
    letzte.stufen >= 4 && letzte.stufen < letzterCtx.badges.total,
    `${letzte.stufen} von ${letzterCtx.badges.total}`);
}

/* ================================================================
   4. Stimmt nach drei Jahren noch alles?
   ================================================================ */
section("Zustand nach drei Jahren");
{
  setClock(dayOf(DAYS - 1));
  const ctx = Data.compute();
  const S = Data.get();

  ok("Rhythmen für alle Produkte gelernt", ctx.rhythms.size >= WORLD.length - 2,
    `${ctx.rhythms.size} von ${WORLD.length}`);
  ok("Alle Rhythmen sind gültige Zahlen",
    [...ctx.rhythms.values()].every((r) => !r.rhythmDays || (Number.isFinite(r.rhythmDays) && r.rhythmDays >= 1)));
  ok("Alle Vertrauenswerte im Bereich",
    [...ctx.rhythms.values()].every((r) => r.confidence >= 0 && r.confidence <= 1));

  // Die eigentliche Probe: kennt die App den WAHREN Takt? Sie hat ihn
  // nie gesehen, nur Kaufdaten. Nach dem Bruch ist er 1,5-mal länger.
  const abweichungen = [];
  for (const p of WORLD) {
    const r = ctx.rhythms.get(p.id);
    if (!r || !r.rhythmDays || r.confidence < 0.4) continue;
    const wahr = (1 / p.perDay) * p.pack * 1.5;
    abweichungen.push({ id: p.id, ist: r.rhythmDays, soll: Math.round(wahr), rel: Math.abs(r.rhythmDays - wahr) / wahr });
  }
  const medianRel = abweichungen.map((a) => a.rel).sort((a, b) => a - b)[Math.floor(abweichungen.length / 2)];
  console.log("  Rhythmus (ist/soll): " + abweichungen.slice(0, 8).map((a) => `${a.ist}/${a.soll}`).join("  "));
  ok("Der gelernte Takt trifft den wahren im Median auf 30 % genau",
    medianRel < 0.3, "Median-Abweichung " + pct(medianRel));
  ok("Kein Produkt liegt um mehr als das Doppelte daneben",
    abweichungen.every((a) => a.rel < 1), abweichungen.filter((a) => a.rel >= 1).map((a) => a.id).join(","));

  ok("Die Liste ist nicht leer", ctx.items.length > 0, ctx.items.length);
  ok("Und auch nicht absurd lang", ctx.items.length < WORLD.length, ctx.items.length);
  ok("Der Vorrat wird geschätzt", ctx.inventory.length > 0);
  ok("Die Zahlen enthalten keine Platzhalter",
    !/undefined|NaN/.test(JSON.stringify({
      totals: ctx.totals, range: ctx.range, review: ctx.review,
      streak: ctx.streak.message, impact: ctx.impact
    })));
  ok("Der Wochenrückblick trägt noch eine Überschrift", !!ctx.review.headline);
  console.log(`  Abwesenheiten erkannt: ${ctx.absences.length}, Streak am Ende: ${ctx.streak.weeks} Wochen`);
  ok("Abwesenheiten werden aus den Bons erkannt", ctx.absences.length >= 5, ctx.absences.length);
  ok("Der Streak steht nach drei Jahren hoch", ctx.streak.weeks >= 50, ctx.streak.weeks);
  ok("Strukturbrüche wurden erkannt",
    [...ctx.changes.values()].some((c) => c.found),
    [...ctx.changes.values()].filter((c) => c.found).length + " Produkte");

  // Sicherung und Wiederherstellung nach drei Jahren Datenwuchs.
  const backup = Data.exportJson();
  const n = Data.importJson(backup);
  ok("Drei Jahre lassen sich sichern und zurückholen", n === S.purchases.length, `${n} Käufe`);
  ok("Die Sicherung ist noch handhabbar groß", backup.length < 2 * 1024 * 1024,
    Math.round(backup.length / 1024) + " KB");

  ok("Keine unbeaufsichtigten Fehler in drei Jahren", app.errors.length === 0, app.errors.slice(0, 2).join(" | "));
}

console.log("\n" + "=".repeat(60));
console.log(`LANGZEIT: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
process.exit(fail ? 1 : 0);
