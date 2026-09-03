/* ================================================================
   data.js — Speicher und Ableitungen.
   ================================================================
   Die beiden Vorgänger-Oberflächen (ui/ und ios/) waren Vorführungen:
   eine fest verdrahtete Historie im Quelltext, nach dem Neuladen war
   alles wieder wie vorher. Für eine Web-App ist das der fehlende
   Baustein — ohne eigene Käufe lernt kein Rhythmus, und ohne Rhythmus
   ist jede Ansicht leer.

   Deshalb hier drei Dinge:
     1. Ein Speicher im Browser (localStorage). Alles bleibt auf dem
        Gerät — es gibt keinen Server, an den etwas ginge.
     2. Eine Demo-Historie, die relativ zu HEUTE erzeugt wird statt
        auf feste Daten von 2026 zu zeigen. Sonst wäre die App nach
        wenigen Monaten scheinbar kaputt.
     3. compute(): ruft ausschließlich die gebündelten Module auf.
        Hier steht KEINE Fachlogik — nur Zusammenbau.

   Fachlogik gehört nach src/algo. Wer hier rechnet, erzeugt genau die
   zweite Wahrheit, gegen die der Bündel-Build gebaut wurde.
   ================================================================ */

const STORE_KEY = "einkaufsanker.v1";

/* Die Schattenkopie. Sie schützt NICHT gegen das Löschen des
   Browsers — dagegen hilft nichts, was im selben Speicher liegt —,
   sondern gegen den abgebrochenen Schreibvorgang: volle Quote,
   Absturz, halb geschriebene Zeichenkette. Das ist der Fall, der
   ohne Zutun eintritt, und er hinterlässt einen Speicher, der
   vorhanden und unlesbar ist. Beim Start entscheidet der Inhalt,
   welche Kopie gilt, nicht der Zeitstempel: eine abgeschnittene
   Datei ist neuer und trotzdem schlechter. */
const SHADOW_KEY = "einkaufsanker.v1.schatten";
const SCHEMA = 1;

/* ---------- Datumshilfen ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const today = () => iso(Date.now());
const plusDays = (dateStr, n) => iso(new Date(dateStr + "T12:00:00Z").getTime() + n * 86400000);
// WEEKDAYS liefert shoppingDay.js aus dem Bündel — nicht doppelt führen.
const weekdayOf = (dateStr) => WEEKDAYS[new Date(dateStr + "T12:00:00Z").getUTCDay()];

/** Kalenderwoche als Schlüssel, damit Abwahl-Entscheidungen genau
    eine Woche gelten und danach von selbst verfallen. Die Rechnung
    steht in streakTracker.js — sie wird dort für den Streak ohnehin
    gebraucht, und zwei Fassungen derselben Wochenzählung liefen
    unweigerlich am Jahreswechsel auseinander. */
const weekKey = (dateStr) => isoWeekKey(dateStr);

/* ---------- Grundzustand ---------- */
function emptyState() {
  return {
    schema: SCHEMA,
    createdAt: today(),
    settings: {
      budget: 95,
      household: 2,
      // Vorausschau: wie viele Tage der nächste Einkauf mit abdecken
      // soll. listGenerator.js kennt das als BUFFER_DAYS mit Vorgabe 1
      // — für „einmal die Woche einkaufen“ ist ein Tag zu knapp, sonst
      // steht die Hälfte des Bedarfs erst übermorgen auf der Liste.
      lookaheadDays: 3,
      vacation: { active: false, from: null, to: null },
      theme: "system",          // system | hell | dunkel
      textScale: 1,             // Schriftgröße 1 | 1.15 | 1.3
      demo: false,
      // Stufe 2 aus docs/schwarm.md, vorbereitet und absichtlich
      // untätig: kein Menüpunkt setzt das je auf true, und selbst
      // wenn — schwarmClient.js sendet trotzdem nichts, solange dort
      // keine Gegenstelle eingetragen ist. Steht hier schon, damit
      // spätere Einwilligungs-Oberfläche einen echten, gesicherten
      // Zustand zum Umschalten hat statt eines neuen Felds mit allen
      // Wanderungsfragen, die ein neues Feld sonst aufwirft.
      schwarm: { enabled: false }
    },
    // Haushaltsprofil: bestimmt Verbrauchsraten und filtert Produkte,
    // für die das Gerät fehlt. Ohne Kaffeemaschine kein Entkalker.
    household: {
      waterHardness: "mittel",   // weich | mittel | hart
      hasDishwasher: true,
      hasWashingMachine: true,
      hasCoffeeMachine: true,
      hasWaterFilter: false
    },
    swaps: {},                  // productId -> { lastSwap, history:[Datum] }
    // Rückmeldungen dauerhaft. `listChoices` wird bei jedem Einkauf
    // geleert und ist deshalb nur der Zustand der laufenden Woche —
    // zum Lernen braucht es ein Protokoll, das bleibt.
    feedbackLog: [],            // [{productId, date, reason, dueIn}]
    // Ereignis-Protokoll: die eine Quelle für Wochenrückblick,
    // Meilensteine und Streak. Nur bestätigte Handlungen mit Datum.
    actions: [],                // [{date, kind, productId, euros}]
    // Lebenszähler. Das Protokoll wird nach gut einem Jahr gekürzt —
    // ein Meilenstein „100 Bons“ darf davon nicht zurückfallen.
    lifetime: { gerettet: 0, geretteteEuros: 0, guenstig: 0, getauscht: 0, erfasst: 0, rueckmeldungen: 0 },
    badgesSeen: [],             // schon gefeierte Meilensteine
    review: {
      lastSeenWeek: null,       // Rückblick dieser Woche weggetippt
      lastNotifiedWeek: null,
      notify: false             // Erinnerung am Sonntagabend
    },
    aisleOrders: {},            // Markt -> Gangreihenfolge
    opened: [],                 // angebrochene Packungen [{productId, openedDate}]
    // Aufgedruckte Verbrauchs- und Mindesthaltbarkeitsdaten, je
    // Produkt für den jeweils letzten Kauf. Das ist die einzige
    // belastbare Zahl, die es gibt — alles andere im Katalog ist
    // Lagerempfehlung. Sie schlägt deshalb jede Schätzung.
    useBy: {},                  // productId -> "JJJJ-MM-TT"
    // Nutzerkorrektur einer Vorratsschätzung, die einfach zu hoch
    // oder zu niedrig geworden ist -- neuer Anker für die Rechnung,
    // bis der nächste Kauf sie ohnehin ersetzt. Siehe setStockCorrection().
    stockCorrections: {},       // productId -> {date, remainingUnits}
    lastStore: "",              // zuletzt benutzter Markt (für die Gangfolge)
    dismissed: {                // weggetippte Hinweise, je Woche
      week: null,
      forgotten: [],
      freeze: []
    },
    purchases: [],        // {id, productId, date, quantity, unitPrice, weightG, store, brand}
    receipts: [],         // {id, date, store, total, itemCount}
    aliases: {},          // gelernte Zuordnung Bonzeile -> Produkt
    listWeek: null,       // Woche, für die die Entscheidungen unten gelten
    listChoices: {},      // productId -> {on, reason, halved}
    // Selbst ergänzte Positionen. Die App schlägt vor, was ihre
    // Rhythmen hergeben — alles andere weiß nur der Haushalt: Gäste
    // am Wochenende, ein Rezept, Blumen für Oma. Ohne diese Liste ist
    // die App ein Automat, den man nicht bedienen kann.
    manual: [],           // [{id, productId|null, name, price, aisle, category, week}]
    savingsAccepted: [],  // ids angenommener Sparvorschläge
    // Schnappschuss bei Annahme, damit der Wochenrückblick später
    // nachhalten kann, ob sich seither tatsächlich etwas geändert hat.
    savingsAcceptedAt: {}, // id -> {date, productId, title, wasteRateThen}
    // Produkte, für die kein Eigenmarken-Vergleich mehr gezeigt wird.
    // Manches ist Geschmack und nicht Rechnen — wer seinen Kaffee mag,
    // soll nicht jede Woche gefragt werden.
    brandOff: [],
    storeChecked: [],     // im Ladenmodus abgehakt
    /* Käufe, von denen der Nutzer gesagt hat: aufgegessen, nichts
       weggeworfen. Sie nehmen die Verschwendungsschätzung für genau
       diesen Kauf zurück — siehe wasteSummary. Format: "produkt|datum". */
    eaten: [],
    /* Produkte, bei denen der Nutzer dem LAUFENDEN Verlustanteil
       widersprochen hat („bei mir verdirbt kein Brot“). Das ist eine
       Aussage über das Produkt, nicht über einen einzelnen Kauf. */
    noChronic: [],
    depositReturned: [],  // zurückgegebene Pfandgebinde
    // Wann zuletzt gesichert wurde und wie. Ohne diese drei Felder
    // kann die App nicht sagen, ob eine Sicherung fehlt — und eine
    // Erinnerung, die nicht weiß, wovon sie redet, ist Lärm.
    backup: { lastDate: null, lastKind: null, receiptsAt: 0, lastNag: null }
  };
}

/* ---------- Laden und Sichern ---------- */
let state = emptyState();
const listeners = new Set();

/**
 * Gespeicherten Stand auf den aktuellen Grundzustand legen. Nötig,
 * weil neue Fassungen Felder ergänzen: ein flaches Überschreiben
 * würde eine alte Sicherung ohne `settings.theme` mit einem
 * undefinierten Wert zurücklassen. Nur eine Ebene tief — tiefer wird
 * hier nichts verschachtelt, und ein allgemeiner Tiefmerge wäre mehr
 * Code als Nutzen.
 */
function merge(parsed) {
  const base = emptyState();
  const out = { ...base, ...parsed };
  for (const key of ["settings", "dismissed", "household", "lifetime", "review", "backup"]) {
    out[key] = { ...base[key], ...(parsed[key] || {}) };
  }
  out.settings.vacation = { ...base.settings.vacation, ...(parsed.settings || {}).vacation };
  return out;
}

/** Eine Kopie lesen und lesbar zurückgeben — oder null. */
function readSlot(key) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/* Was beim letzten Start passiert ist — die Oberfläche sagt es dem
   Nutzer, wenn die Schattenkopie einspringen musste. Ein stiller
   Rückgriff wäre bequemer und würde verschweigen, dass gerade etwas
   schiefgegangen ist. */
let lastRecovery = null;

function load() {
  const haupt = readSlot(STORE_KEY);
  const schatten = readSlot(SHADOW_KEY);
  lastRecovery = null;

  if (haupt === null && schatten === null) {
    try {
      if (localStorage.getItem(STORE_KEY)) {
        lastRecovery = { level: "verloren", message: "Der gespeicherte Stand war unlesbar." };
      }
    } catch (e) {
      console.warn("Speicher nicht verfügbar — Daten gehen beim Neuladen verloren.", e);
    }
  } else {
    const wahl = pickBetter(haupt, schatten, { schema: SCHEMA });
    if (wahl.chosen) {
      state = merge(wahl.chosen);
      // Nur melden, wenn die Schattenkopie wirklich gerettet hat.
      if (wahl.chosen === schatten && haupt !== null) {
        lastRecovery = { level: "gerettet", message: `Der Hauptstand war unbrauchbar (${wahl.why}) — die Sicherungskopie im Browser ist eingesprungen.` };
      } else if (wahl.chosen === schatten && haupt === null) {
        lastRecovery = { level: "gerettet", message: "Der Hauptstand fehlte — die Sicherungskopie im Browser ist eingesprungen." };
      }
    } else {
      lastRecovery = { level: "verloren", message: "Beide gespeicherten Stände waren unbrauchbar." };
    }
  }
  if (!state.purchases.length && !state.settings.demo && !state.createdAt) state.createdAt = today();
  return state;
}

/* Wie oft die Schattenkopie mitgezogen wird. Nicht bei jeder
   Änderung: dann wären beide Kopien gleichzeitig kaputt, wenn der
   Speicher mitten im Schreiben ausgeht — und genau davor soll sie
   schützen. Sie hinkt bewusst hinterher. */
const SHADOW_EVERY = 10;
let saveCount = 0;

function save() {
  let text;
  try {
    text = JSON.stringify(state);
  } catch (e) {
    console.warn("Zustand nicht serialisierbar.", e);
    return;
  }
  try {
    localStorage.setItem(STORE_KEY, text);
  } catch (e) {
    console.warn("Konnte nicht speichern.", e);
    return;
  }
  // Erst NACH dem erfolgreichen Hauptschreiben, und nur ab und zu.
  if (saveCount++ % SHADOW_EVERY === 0) {
    try {
      localStorage.setItem(SHADOW_KEY, text);
    } catch (e) {
      // Kein Drama: die Schattenkopie ist ein Extra, kein Muss.
    }
  }
}

function recoveryNotice() { return lastRecovery; }

function get() { return state; }

/** Urlaub nur, wenn er auch eingeschaltet ist — sonst zählen alte
    Daten aus einem abgeschalteten Urlaubsmodus als Pause weiter. */
const activeVacation = (s) => (s.settings.vacation && s.settings.vacation.active ? s.settings.vacation : null);

/** Zustand ändern, sichern und die Oberfläche benachrichtigen. */
function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l());
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function reset() {
  state = emptyState();
  save();
  listeners.forEach((l) => l());
}

/* ---------- Käufe erfassen ---------- */
let idCounter = 0;
const newId = () => `${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/**
 * Schreibt einen Bon in die Historie.
 * @param {{date, store, items:[{productId, quantity, unitPrice, weightG}]}} receipt
 */
function addReceipt(receipt) {
  const date = receipt.date || today();
  const store = receipt.store || "Unbekannt";
  // needsConfirmation heißt: der Abgleich hat einen Kandidaten
  // gefunden, aber noch NICHT bestätigt bekommen. Ohne diesen Filter
  // würde ein zu früh gedrückter Buchen-Knopf denselben Kandidaten
  // stillschweigend buchen — die Vermutung wäre nie wirklich
  // bestätigt worden, nur nicht widersprochen. Manuell erfasste
  // Positionen tragen dieses Feld gar nicht (undefined ist falsy),
  // sind also unverändert buchbar.
  const rows = receipt.items.filter((i) => i.productId && !i.needsConfirmation);

  // Vor dem Einbuchen: gegen welchen üblichen Preis wurde gekauft?
  // Danach wäre die Antwort verfälscht — der neue Kauf verschöbe den
  // Bezugswert selbst.
  const savings = receiptSavings(rows, state.purchases);

  update((s) => {
    rows.forEach((i) => {
      // Die Marke wird BEIM BUCHEN festgehalten, nicht später aus der
      // Zeile gelesen: die Bonzeile selbst wird nicht gespeichert
      // (sie ist lang, redundant und für nichts anderes nötig), und
      // ohne diesen Schritt wäre die Information mit dem Buchen weg.
      // Positionen aus dem Ladenmodus haben keine Zeile — die tragen
      // `null` und zählen im Markenvergleich nirgends mit.
      const b = i.raw ? brandOf(i.raw) : { tier: null, label: null };
      s.purchases.push({
        id: newId(),
        productId: i.productId,
        date,
        quantity: Math.max(1, Number(i.quantity) || 1),
        unitPrice: Math.max(0, Number(i.unitPrice) || 0),
        weightG: i.weightG || null,
        store,
        brand: b.tier,
        brandLabel: b.label
      });
    });
    s.receipts.push({
      id: newId(),
      date,
      store,
      total: Math.round(rows.reduce((a, i) => a + i.unitPrice * i.quantity, 0) * 100) / 100,
      itemCount: rows.length
    });
    // Neuer Einkauf: die Wochenentscheidungen sind verbraucht — und
    // die selbst ergänzten Positionen ebenso, die waren ja der Grund
    // für den Einkauf.
    s.listWeek = null;
    s.listChoices = {};
    s.storeChecked = [];
    s.manual = [];
  });

  logAction(ACTION.ERFASST, {
    date,
    euros: Math.round(rows.reduce((a, i) => a + i.unitPrice * i.quantity, 0) * 100) / 100
  });
  savings.forEach((sv) => logAction(ACTION.GUENSTIG, { date, productId: sv.productId, euros: sv.euros }));

  return { count: rows.length, savings };
}

function removeReceipt(receiptId) {
  update((s) => {
    const r = s.receipts.find((x) => x.id === receiptId);
    if (!r) return;
    s.receipts = s.receipts.filter((x) => x.id !== receiptId);
    // Käufe desselben Tages und Markts entfernen — die Einzelkäufe
    // tragen keine Bon-Kennung, Tag und Markt genügen in der Praxis.
    s.purchases = s.purchases.filter((p) => !(p.date === r.date && p.store === r.store));
  });
}

/**
 * Die Positionen eines Bons.
 *
 * Käufe tragen keine Bon-Kennung — sie werden über Tag und Markt
 * zugeordnet, wie beim Löschen auch. Zwei Einkäufe am selben Tag im
 * selben Markt wären für diese Zuordnung dasselbe; das kommt vor,
 * bleibt aber die seltene Ausnahme, und die Alternative (eine Kennung
 * nachträglich in jede alte Sicherung schreiben) wäre teurer als der
 * Fehler.
 */
function receiptLines(receiptId) {
  const r = state.receipts.find((x) => x.id === receiptId);
  if (!r) return [];
  return state.purchases.filter((p) => p.date === r.date && p.store === r.store);
}

/**
 * Eine gebuchte Position ändern oder entfernen.
 * ================================================================
 * WARUM ES DAS BRAUCHT: bis hierher gab es nur „ganzen Bon löschen“.
 * Nach einem Fehltreffer der Texterkennung — und die Prüfliste fängt
 * nicht alles ab — hieß das: alles wegwerfen und neu erfassen. Das
 * ist der Moment, in dem eine App zum ersten Mal als lästig erlebt
 * wird, und er tritt beim Fotografieren häufiger ein als beim Tippen.
 *
 * WAS DABEI MITGEZOGEN WIRD, und das ist der heikle Teil:
 *
 *   - Der Bon selbst: Summe und Anzahl stimmen danach wieder.
 *   - Das Ereignis-Protokoll: der `erfasst`-Eintrag dieses Tages
 *     trägt einen Betrag, und der wäre nach einer Korrektur falsch.
 *     Er wird um die Differenz angepasst, nicht neu erfunden.
 *   - Eine als `guenstig` gebuchte Ersparnis, die an der entfernten
 *     Position hing, verschwindet mit ihr. Sie war die Differenz zu
 *     einem Preis, den es nicht gab.
 *
 * NICHT angepasst werden die Lebenszähler der Meilensteine. Das ist
 * Absicht: Erreichtes verfällt in dieser App nicht, auch nicht durch
 * eine Korrektur. Ein Abzeichen, das wieder verschwindet, weil man
 * einen Tippfehler behoben hat, wäre die schlechtere Botschaft.
 * ================================================================
 *
 * @param {string} purchaseId
 * @param {null|{productId, quantity, unitPrice}} patch null = entfernen
 * @returns {boolean} ob etwas geändert wurde
 */
function updatePurchase(purchaseId, patch) {
  const alt = state.purchases.find((p) => p.id === purchaseId);
  if (!alt) return false;

  const alterWert = (Number(alt.unitPrice) || 0) * (Number(alt.quantity) || 1);
  let neuerWert = 0;

  update((s) => {
    const i = s.purchases.findIndex((p) => p.id === purchaseId);
    if (i < 0) return;

    if (patch === null) {
      s.purchases.splice(i, 1);
    } else {
      const p = s.purchases[i];
      if (patch.productId) p.productId = patch.productId;
      if (Number.isFinite(patch.quantity)) p.quantity = Math.max(1, patch.quantity);
      if (Number.isFinite(patch.unitPrice)) p.unitPrice = Math.max(0, patch.unitPrice);
      neuerWert = (Number(p.unitPrice) || 0) * (Number(p.quantity) || 1);
    }

    // Bon nachziehen. Ohne das zeigte die Liste weiter die alte Summe
    // — und der Nutzer hätte die Korrektur gemacht und keine Wirkung
    // gesehen.
    const bon = s.receipts.find((x) => x.date === alt.date && x.store === alt.store);
    if (bon) {
      const zeilen = s.purchases.filter((p) => p.date === bon.date && p.store === bon.store);
      bon.itemCount = zeilen.length;
      bon.total = Math.round(zeilen.reduce((a, p) => a + p.unitPrice * p.quantity, 0) * 100) / 100;
      if (!zeilen.length) s.receipts = s.receipts.filter((x) => x.id !== bon.id);
    }

    // Protokoll: den Erfassungsbetrag dieses Tages um die Differenz
    // verschieben, nie unter null.
    const differenz = neuerWert - alterWert;
    if (differenz !== 0) {
      const eintrag = s.actions.find((a) => a.date === alt.date && a.kind === ACTION.ERFASST);
      if (eintrag) eintrag.euros = Math.max(0, Math.round((eintrag.euros + differenz) * 100) / 100);
    }

    if (patch === null || (patch.productId && patch.productId !== alt.productId)) {
      s.actions = s.actions.filter((a) =>
        !(a.kind === ACTION.GUENSTIG && a.date === alt.date && a.productId === alt.productId));
    }
  });
  return true;
}

/** Packung als angebrochen markieren oder die Markierung entfernen. */
function toggleOpened(productId) {
  update((s) => {
    const i = s.opened.findIndex((o) => o.productId === productId);
    if (i >= 0) s.opened.splice(i, 1);
    else s.opened.push({ productId, openedDate: today() });
  });
}

/**
 * Eine Vorratsschätzung von Hand korrigieren -- für die neun von zehn
 * Fällen, in denen sie einfach nur zu hoch oder zu niedrig geworden
 * ist (mehr gegessen als sonst, etwas verschüttet, eine zweite
 * Packung im Schrank vergessen). Bisher gab es dafür keinen Weg außer
 * abzuwarten, bis der nächste Kauf die Schätzung zurücksetzt -- das
 * kann je nach Rhythmus Wochen dauern.
 *
 * Wirkt wie ein neuer, kleiner Kauf: `inventoryEstimator.js` rechnet
 * ab jetzt vom heutigen Tag und der korrigierten Menge weiter, bis
 * ein echter Kauf sie ersetzt. `remainingUnits` in Vielfachen der
 * zuletzt gekauften Menge, wie überall sonst im Bestand ("0,6×").
 *
 * `date` ist der Tag, an dem der gemeldete Stand galt -- also der
 * Verbrauchstag, wenn jemand nachträglich sagt „das war schon letzte
 * Woche alle". Ohne Angabe: heute. Ein Datum vor dem letzten Kauf
 * oder in der Zukunft wird abgelehnt statt stillschweigend auf heute
 * gebogen; `inventoryEstimator.js` verwirft es sonst ohnehin, und
 * eine Korrektur, die spurlos verpufft, ist schlimmer als eine, die
 * ehrlich fehlschlägt.
 */
function setStockCorrection(productId, remainingUnits, date) {
  if (!productId) return false;
  const value = Math.max(0, Number(remainingUnits) || 0);
  let tag = today();
  if (date) {
    if (!isRealDate(date) || date > tag) return false;
    const letzter = state.purchases
      .filter((p) => p.productId === productId)
      .map((p) => p.date)
      .sort()
      .pop();
    if (letzter && date < letzter) return false;
    tag = date;
  }
  update((s) => {
    if (!s.stockCorrections) s.stockCorrections = {};
    s.stockCorrections[productId] = { date: tag, remainingUnits: value };
  });
  return true;
}

/** Eine Korrektur zurücknehmen — der Rückweg zur reinen Schätzung.
    Ohne ihn wäre die Wisch-Geste im Bestand unumkehrbar. */
function clearStockCorrection(productId) {
  if (!productId) return false;
  let weg = false;
  update((s) => {
    if (s.stockCorrections && s.stockCorrections[productId]) {
      delete s.stockCorrections[productId];
      weg = true;
    }
  });
  return weg;
}

/* ---------- Ereignis-Protokoll ---------- */
/**
 * Eine bestätigte Handlung festhalten. Einziger Schreibweg ins
 * Protokoll — Wochenrückblick, Meilensteine und Streak lesen nur.
 *
 * Der Lebenszähler läuft mit, weil das Protokoll nach gut einem Jahr
 * gekürzt wird. Ohne ihn fiele ein erreichter Meilenstein wieder
 * zurück, und eine Auszeichnung, die verschwindet, ist schlimmer als
 * gar keine.
 */
function logAction(kind, { date, productId = null, euros = 0 } = {}) {
  update((s) => {
    const d = date || today();
    s.actions.push({ date: d, kind, productId, euros: Math.max(0, Number(euros) || 0) });
    s.actions = pruneActions(s.actions, today());

    const lt = s.lifetime;
    if (kind === ACTION.GERETTET) {
      lt.gerettet++;
      lt.geretteteEuros = Math.round((lt.geretteteEuros + (Number(euros) || 0)) * 100) / 100;
    } else if (kind === ACTION.GUENSTIG) {
      lt.guenstig = Math.round((lt.guenstig + (Number(euros) || 0)) * 100) / 100;
    } else if (kind === ACTION.GETAUSCHT) lt.getauscht++;
    else if (kind === ACTION.ERFASST) lt.erfasst++;
    else if (kind === ACTION.RUECKMELDUNG) lt.rueckmeldungen++;
  });
}

/**
 * Ein Produkt gerettet — der Nutzer hat eine Handlung bestätigt, die
 * Verderb abwendet: halbe Menge, eingefroren, aufgebraucht, verkocht.
 *
 * `euros` ist ausdrücklich eine SCHÄTZUNG des abgewendeten Verlusts,
 * kein realisierter Betrag. Die Trennung von der Preisersparnis zieht
 * sich durch alle drei auswertenden Module.
 */
function recordRescue(productId, euros) {
  // Höchstens eine Rettung je Produkt und Tag. Ohne diese Sperre
  // erzeugte ein Knopf, den man an- und wieder abschaltet, beliebig
  // viele Einträge — der schnellste Weg, eine Auszeichnung wertlos
  // zu machen.
  const t = today();
  if (state.actions.some((a) => a.kind === ACTION.GERETTET && a.productId === productId && a.date === t)) return false;
  logAction(ACTION.GERETTET, { productId, euros });
  return true;
}

/** Meilensteine als gesehen markieren, ohne sie zu feiern. */
function seedBadges(keys) {
  update((s) => { s.badgesSeen = [...new Set(keys)]; });
}

function markBadgesSeen(keys) {
  update((s) => { s.badgesSeen = [...new Set([...s.badgesSeen, ...keys])]; });
}

/** Wochenrückblick für diese Woche als gelesen ablegen. */
function markReviewSeen(wk) {
  update((s) => { s.review.lastSeenWeek = wk; });
}

function markReviewNotified(wk) {
  update((s) => { s.review.lastNotifiedWeek = wk; });
}

/**
 * Eine Rückmeldung dauerhaft festhalten. `dueIn` sagt, wie weit die
 * Vorhersage danebenlag: 0 heißt „heute fällig“, negativ „war schon
 * überfällig". Ohne diesen Bezug ließe sich später nicht mehr sagen,
 * wie stark der Rhythmus verschoben werden muss.
 */
function recordFeedback(productId, reason, dueIn) {
  update((s) => {
    s.feedbackLog.push({
      productId, reason,
      date: today(),
      dueIn: Number.isFinite(dueIn) ? dueIn : 0
    });
    // Das Protokoll wächst sonst unbegrenzt. Älteres als ein Jahr
    // wertet ohnehin kein Modul mehr aus.
    const cutoff = plusDays(today(), -365);
    s.feedbackLog = s.feedbackLog.filter((e) => e.date >= cutoff);
  });
  logAction(ACTION.RUECKMELDUNG, { productId });
}

/**
 * Austausch eines INTERVAL-Produkts protokollieren. Das ist eine
 * HANDLUNG, kein Kauf: eine Packung mit vier Aufsteckbürsten trägt
 * vier Tauschvorgänge.
 */
function recordSwapFor(productId) {
  update((s) => {
    const cur = s.swaps[productId] || { lastSwap: null, history: [] };
    const t = today();
    s.swaps[productId] = { lastSwap: t, history: [...cur.history, t] };
  });
  logAction(ACTION.GETAUSCHT, { productId });
}

/**
 * Eine Position von Hand auf die Liste setzen.
 *
 * Zwei Fälle: ein Produkt aus dem Katalog (dann kennt die App Preis,
 * Gang und Kategorie) oder freier Text. Freier Text bekommt KEINE
 * Produktkennung — er darf nicht in die Rhythmen einfließen, sonst
 * lernte die App aus „Blumen für Oma“ einen Kaufabstand.
 */
function addManual({ productId = null, name, price = 0, week }) {
  // Kommt eine Produktkennung, liefert der Katalog den Namen. Ohne
  // diese Zeile bräuchte jeder Aufrufer beides — und der erste, der
  // nur die Kennung übergab, bekam still `null` zurück.
  const p = productId ? byId(productId) : null;
  const label = p ? p.name : String(name || "").trim();
  if (!label) return null;
  const entry = {
    id: newId(),
    productId: p ? productId : null,
    name: label,
    price: p ? p.typicalPrice : Math.max(0, Number(price) || 0),
    aisle: p ? p.aisle : "Sonstiges",
    category: p ? p.category : "Sonstiges",
    week: week || weekKey(today()),
    addedAt: today()
  };
  update((s) => { s.manual.push(entry); });
  return entry;
}

function removeManual(id) {
  update((s) => { s.manual = s.manual.filter((m) => m.id !== id); });
}

function learnAlias(rawLine, productId) {
  update((s) => { s.aliases[normalizeRaw(rawLine)] = productId; });
}

const normalizeRaw = (t) => String(t).toLowerCase().replace(/\s+/g, " ").trim();

/* ---------- Demo-Historie ---------- */
/**
 * Sechs Monate Einkäufe, erzeugt relativ zu heute. Enthält bewusst
 * die Muster, an denen die Algorithmen etwas zeigen können:
 * steigende Preise (persönliche Inflation), einen Rhythmus länger
 * als die Haltbarkeit (strukturelle Verschwendung), Vorratskäufe
 * mit Menge, Pfandgebinde und Non-Food fürs Archiv.
 */
function buildDemoHistory(ref = today()) {
  const H = [];
  const DAYS = 182;
  const start = plusDays(ref, -DAYS);

  // Echte Haushalte kaufen an Einkaufstagen, nicht täglich. Ohne
  // dieses Raster verteilt sich jedes Produkt auf einen eigenen Tag
  // und die Historie besteht aus 180 Bons mit je zwei Positionen —
  // Marktstatistik und Bon-Archiv wären damit wertlos.
  const SHOPPING_DAYS = [];
  for (let o = 0, i = 0; o <= DAYS + 4; i++) { SHOPPING_DAYS.push(o); o += i % 2 ? 4 : 3; }
  const snap = (offset) =>
    SHOPPING_DAYS.reduce((best, d) => (Math.abs(d - offset) < Math.abs(best - offset) ? d : best), SHOPPING_DAYS[0]);

  /**
   * Eine Kaufreihe rückwärts von "zuletzt vor `lastGap` Tagen" bis zum
   * Beginn des Zeitraums. Rückwärts, damit `lastGap` genau steuert, ob
   * das Produkt heute fällig ist — vorwärts gerechnet hinge das vom
   * Zufall der Reihenlänge ab, und die Demo sähe an manchen Tagen leer
   * aus. `priceLate`/`priceEarly` erzeugen die persönliche Inflation.
   */
  function series(pid, everyDays, opts = {}) {
    const p = byId(pid);
    if (!p) return;
    const {
      lastGap = 0, qty = 1,
      priceLate = p.typicalPrice,
      priceEarly = priceLate,
      jitter = 1,
      brandCycle = null
    } = opts;

    let offset = lastGap;
    let i = 0;
    let gekauft = 0;
    let previous = null;
    while (offset <= DAYS) {
      const snapped = snap(offset);
      if (snapped !== previous) {
        const date = plusDays(ref, -snapped);
        if (date >= start) {
          // Zweite Hälfte des Zeitraums teurer als die erste
          const grundpreis = snapped <= DAYS / 2 ? priceLate : priceEarly;
          // Marke reihum. Ohne Marken auf den Demo-Käufen bliebe der
          // Eigenmarken-Vergleich in der Vorführung leer — und genau
          // dort soll er zeigen, was er kann.
          const b = brandCycle ? brandCycle[gekauft % brandCycle.length] : null;
          const marke = b ? brandOf(b.raw) : { tier: null, label: null };
          H.push({
            productId: pid, date, quantity: qty,
            unitPrice: Math.round(grundpreis * (b && b.faktor ? b.faktor : 1) * 100) / 100,
            weightG: null,
            brand: marke.tier,
            brandLabel: marke.label
          });
          gekauft++;
        }
        previous = snapped;
      }
      // Leichte Streuung: ohne sie wäre der Median künstlich perfekt
      // und der Vertrauenswert überall 100 % — das gibt es real nicht.
      offset += everyDays + (jitter ? [0, 1, 0, -1, 0][i % 5] : 0);
      i++;
    }
  }

  // Grundnahrung: kurze Rhythmen, teils überfällig, teils bald fällig
  series("milch_vollmilch", 6, { lastGap: 6, qty: 2, priceLate: 1.29, priceEarly: 1.09,
    brandCycle: [{ raw: "JA! H-MILCH 3,5%" }] });   // schon Eigenmarke: kein Vorschlag
  series("brot_vollkorn", 6, { lastGap: 7, priceLate: 2.49, priceEarly: 2.29 });
  series("joghurt_natur", 5, { lastGap: 5, qty: 2, priceLate: 1.19, priceEarly: 1.09,
    // Meist Marke, ab und zu Eigenmarke — daraus wird eine BELEGTE Zahl.
    brandCycle: [
      { raw: "EHRMANN JOGHURT NATUR" },
      { raw: "EHRMANN JOGHURT NATUR" },
      { raw: "MILBONA JOGHURT NATUR", faktor: 0.5 }
    ] });
  series("eier", 11, { lastGap: 10, priceLate: 3.49, priceEarly: 3.29 });
  series("butter", 20, { lastGap: 19, priceLate: 2.79, priceEarly: 1.99,
    brandCycle: [{ raw: "KERRYGOLD BUTTER" }] });
  series("kaese_gouda", 10, { lastGap: 4, priceLate: 2.39, priceEarly: 2.19 });
  series("nudeln", 21, { lastGap: 15, qty: 2, priceLate: 1.35, priceEarly: 1.29 });
  series("reis", 35, { lastGap: 30, priceLate: 2.29, priceEarly: 2.19 });
  series("kaffee", 30, { lastGap: 28, priceLate: 7.49, priceEarly: 5.99,
    brandCycle: [{ raw: "JACOBS KROENUNG" }] });   // nur Marke: GESCHÄTZTE Zahl

  // Obst und Gemüse
  series("bananen", 7, { lastGap: 6, priceLate: 1.89, priceEarly: 1.79 });
  series("aepfel", 12, { lastGap: 11, priceLate: 2.69, priceEarly: 2.49 });

  // Verschwendungsmuster: Rhythmus länger als Haltbarkeit
  series("salat_kopf", 7, { lastGap: 5, priceLate: 1.49, priceEarly: 1.39 });
  series("haehnchen", 9, { lastGap: 8, priceLate: 7.49, priceEarly: 6.99 });
  series("paprika", 8, { lastGap: 3, priceLate: 2.49, priceEarly: 2.29 });
  series("tomaten", 7, { lastGap: 7, priceLate: 2.69, priceEarly: 2.49 });

  // Getränke für die Pfandrechnung
  series("wasser", 7, { lastGap: 4, qty: 6, priceLate: 0.39 });
  series("bier", 14, { lastGap: 9, qty: 6, priceLate: 0.85, priceEarly: 0.79 });

  series("schokolade", 9, { lastGap: 2, qty: 2, priceLate: 1.29, priceEarly: 1.19,
    // Probiert und verworfen: die letzten Käufe sind wieder Marke.
    brandCycle: [
      { raw: "MILKA ALPENMILCH" }, { raw: "MILKA ALPENMILCH" },
      { raw: "MILKA ALPENMILCH" }, { raw: "FIN CARRE ALPENMILCH", faktor: 0.55 }
    ] });

  // Haushaltsprodukte: eigene Rechnung (Rate statt Kaufabstand), also
  // auch eigene Muster. Klopapier knapp, Waschmittel mit Preiswellen
  // für den Grundpreisvergleich, Zahnbürste überfällig.
  series("klopapier", 40, { lastGap: 34, priceLate: 4.29, priceEarly: 3.99 });
  series("spuelmittel", 45, { lastGap: 40, priceLate: 1.39, priceEarly: 1.29 });
  series("zahnpasta", 25, { lastGap: 22, priceLate: 1.95, priceEarly: 1.79 });
  series("waschmittel", 20, { lastGap: 17, priceLate: 6.99, priceEarly: 5.99,
    brandCycle: [{ raw: "PERSIL UNIVERSAL" }] });
  series("kuechenrolle", 35, { lastGap: 30, priceLate: 2.19, priceEarly: 1.99 });
  series("muellbeutel", 50, { lastGap: 44, priceLate: 2.69, priceEarly: 2.49 });
  series("duschgel", 15, { lastGap: 12, priceLate: 2.19, priceEarly: 1.99,
    brandCycle: [{ raw: "NIVEA MEN DUSCHGEL" }] });

  // INTERVAL: der Tausch ist überfällig, ohne dass etwas fehlt.
  series("zahnbuerste", 95, { lastGap: 97, priceLate: 1.95 });
  series("kuechenschwamm", 30, { lastGap: 14, qty: 1, priceLate: 1.49 });
  series("wasserfilter", 30, { lastGap: 25, priceLate: 4.49 });

  // SPORADIC: unregelmäßig, damit die App zeigen kann, dass sie schweigt.
  [-140, -95, -30].forEach((o) => H.push(
    { productId: "batterien", date: plusDays(ref, o), quantity: 1, unitPrice: 4.99, weightG: null }));

  // Packungsgrößen-Vergleich Kaffee: klein oft, groß selten
  [120, 90].forEach((o) => H.push({ productId: "kaffee", date: plusDays(ref, -o), quantity: 1, unitPrice: 3.99, weightG: 250 }));
  H.push({ productId: "kaffee", date: plusDays(ref, -40), quantity: 1, unitPrice: 6.49, weightG: 500 });

  return H.filter((h) => h.date <= ref && byId(h.productId)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Ein einzelner, realistischer erster Einkauf für die Cold-Start-Ansicht. */
function buildFirstReceipt(ref = today()) {
  return [
    ["milch_vollmilch", 2], ["brot_vollkorn", 1], ["haehnchen", 1], ["kaffee", 1],
    ["joghurt_natur", 2], ["tomaten", 1], ["salat_kopf", 1], ["eier", 1],
    ["nudeln", 2], ["klopapier", 1], ["wasser", 6], ["schokolade", 2]
  ]
    .filter(([pid]) => byId(pid))
    .map(([pid, qty]) => ({ productId: pid, date: ref, quantity: qty, unitPrice: byId(pid).typicalPrice, weightG: null }));
}

/**
 * Ereignis-Protokoll zur Demo-Historie.
 *
 * Ohne das blieben Wochenrückblick, Meilensteine und Streak in den
 * Beispieldaten leer — und wer die App zum ersten Mal öffnet, sähe
 * drei tote Bereiche. Die Ereignisse werden aus derselben erzeugten
 * Historie abgeleitet, sind also in sich stimmig: die Bons stehen im
 * Protokoll, die Preisvorteile sind aus den Preisen gerechnet, die
 * Austausche liegen auf echten Kaufdaten.
 */
function buildDemoActions(purchases, receipts, ref) {
  const out = [];

  // Bons und die dabei realisierten Preisvorteile, chronologisch —
  // dieselbe Rechnung wie beim echten Erfassen.
  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((rec) => {
    out.push({ date: rec.date, kind: ACTION.ERFASST, productId: null, euros: rec.total });
    const rows = purchases.filter((p) => p.date === rec.date && p.store === rec.store);
    const before = purchases.filter((p) => p.date < rec.date);
    receiptSavings(rows, before).forEach((sv) =>
      out.push({ date: rec.date, kind: ACTION.GUENSTIG, productId: sv.productId, euros: sv.euros }));
  });

  // Austausch: die INTERVAL-Produkte, jeweils zum Kaufdatum.
  purchases
    .filter((p) => ["zahnbuerste", "kuechenschwamm", "wasserfilter"].includes(p.productId))
    .forEach((p) => out.push({ date: p.date, kind: ACTION.GETAUSCHT, productId: p.productId, euros: 0 }));

  // Gerettet: verderbliche Produkte, über das letzte Vierteljahr
  // verteilt. Bewusst nicht bei jedem Kauf — eine App, in der jeder
  // Einkauf eine Rettung ist, zählt keine Handlungen mehr.
  const risky = ["salat_kopf", "haehnchen", "paprika", "tomaten", "brot_vollkorn"];
  let n = 0;
  for (let d = 88; d >= 1; d -= 6) {
    const pid = risky[n % risky.length];
    const p = byId(pid);
    if (p) out.push({
      date: plusDays(ref, -d), kind: ACTION.GERETTET, productId: pid,
      euros: Math.round(p.typicalPrice * 50) / 100
    });
    n++;
  }

  // Rückmeldungen: gelegentlich, nicht wöchentlich.
  for (let d = 75; d >= 3; d -= 17) {
    out.push({ date: plusDays(ref, -d), kind: ACTION.RUECKMELDUNG, productId: "milch_vollmilch", euros: 0 });
  }

  return pruneActions(out, ref);
}

/** Lebenszähler aus einem Protokoll aufsummieren. */
function lifetimeFrom(actions) {
  const lt = { gerettet: 0, geretteteEuros: 0, guenstig: 0, getauscht: 0, erfasst: 0, rueckmeldungen: 0 };
  actions.forEach((a) => {
    if (a.kind === ACTION.GERETTET) { lt.gerettet++; lt.geretteteEuros += a.euros; }
    else if (a.kind === ACTION.GUENSTIG) lt.guenstig += a.euros;
    else if (a.kind === ACTION.GETAUSCHT) lt.getauscht++;
    else if (a.kind === ACTION.ERFASST) lt.erfasst++;
    else if (a.kind === ACTION.RUECKMELDUNG) lt.rueckmeldungen++;
  });
  lt.geretteteEuros = Math.round(lt.geretteteEuros * 100) / 100;
  lt.guenstig = Math.round(lt.guenstig * 100) / 100;
  return lt;
}

function loadDemo(kind = "full") {
  const ref = today();
  const rows = kind === "first" ? buildFirstReceipt(ref) : buildDemoHistory(ref);
  const stores = ["REWE", "EDEKA", "Kaufland", "Lidl"];
  // Ein Einkauf ist ein Markt an einem Tag — nicht ein Markt je Zeile.
  // Sonst zerfällt die Historie in hunderte Ein-Positionen-Bons und
  // die Archiv- und Marktstatistik wird unbrauchbar.
  const storeOfDay = (date) =>
    stores[(date.charCodeAt(5) + date.charCodeAt(8) + date.charCodeAt(9)) % stores.length];

  update((s) => {
    s.purchases = rows.map((r) => ({ id: newId(), ...r, store: storeOfDay(r.date) }));
    const byDate = new Map();
    s.purchases.forEach((p) => {
      if (!byDate.has(p.date + p.store)) byDate.set(p.date + p.store, []);
      byDate.get(p.date + p.store).push(p);
    });
    s.receipts = [...byDate.values()].map((items) => ({
      id: newId(),
      date: items[0].date,
      store: items[0].store,
      total: Math.round(items.reduce((a, i) => a + i.unitPrice * i.quantity, 0) * 100) / 100,
      itemCount: items.length
    }));
    // Pfand älter als drei Wochen gilt als zurückgegeben. Ohne diesen
    // Schritt sammelt die Demo ein halbes Jahr Leergut an und meldet
    // 45 € offenes Pfand — eine Zahl, die kein Haushalt je erreicht.
    const cutoff = plusDays(ref, -21);
    s.depositReturned = s.purchases
      .filter((p) => p.date < cutoff && depositTypeFor(p.productId).value > 0)
      .map((p) => `${p.date}|${p.productId}`);

    s.actions = buildDemoActions(s.purchases, s.receipts, ref);
    s.lifetime = lifetimeFrom(s.actions);
    // Beispieldaten feiern keine Meilensteine: der Nutzer hat sie
    // nicht erreicht, und ein Schwall Glückwünsche beim ersten Start
    // entwertet die Auszeichnung, bevor sie zum ersten Mal zählt.
    s.badgesSeen = milestoneState({
      ...s.lifetime,
      wochen: weeklyStreak(s.actions, ref, { vacation: activeVacation(s) }).weeks
    }).reachedKeys;
    s.review = { lastSeenWeek: null, lastNotifiedWeek: null, notify: s.review.notify };

    s.settings.demo = true;
    s.listWeek = null;
    s.listChoices = {};
    s.storeChecked = [];
  });
}

/* ---------- Zustand als JSON ----------
   Kein Nutzerweg mehr dahinter — es gibt keine Sicherung/Export-
   Funktion in der Oberfläche mehr. Bleibt intern für den Schema-
   Wechsel-Test: alte Zustände müssen beim Einlesen weiterhin die
   Vorgaben für neue Felder bekommen, und das lässt sich nur über
   einen echten Hin- und Rückweg prüfen. */
function exportJson() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Kein gültiger Zustand.");
  if (parsed.schema !== SCHEMA) throw new Error(`Fassung ${parsed.schema} statt ${SCHEMA}.`);
  if (!Array.isArray(parsed.purchases)) throw new Error("Enthält keine Käufe.");
  state = merge(parsed);
  // Ein eingelesener Zustand bringt fertige Zähler mit. Was darin
  // schon erreicht war, wurde nicht jetzt erreicht — also kein
  // Glückwunsch-Schwall nach dem Einlesen.
  state.badgesSeen = milestoneState({
    ...state.lifetime,
    wochen: weeklyStreak(state.actions, today(), { vacation: activeVacation(state) }).weeks
  }).reachedKeys;
  save();
  listeners.forEach((l) => l());
  return state.purchases.length;
}

/* ================================================================
   compute() — der eine Ort, an dem die Module aufgerufen werden.
   Ergebnis ist ein reines Datenobjekt; die Ansichten lesen nur.
   ================================================================ */
function compute() {
  const ref = today();
  const s = state;
  const history = s.purchases.map((p) => ({
    productId: p.productId,
    date: p.date,
    quantity: p.quantity,
    unitPrice: p.unitPrice,
    weightG: p.weightG,
    brand: p.brand || null,
    brandLabel: p.brandLabel || null,
    store: p.store || null
  }));

  /* --- Rhythmen, dreifach nachgeschärft ---------------------------
   * Reihenfolge ist nicht beliebig:
   *   1. Strukturbruch  — welche Daten gelten überhaupt noch?
   *   2. Rhythmus       — aus genau diesen Daten
   *   3. Saison         — wirkt auf den gelernten Wert
   *   4. Rückmeldungen  — korrigieren zuletzt, weil sie die direkteste
   *                       Aussage des Nutzers sind
   * Jede Stufe hängt ihre Begründung ans Ergebnis, damit im Detail-Blatt
   * nachvollziehbar bleibt, warum eine Zahl von der rohen abweicht.   */
  const byProduct = new Map();
  history.forEach((h) => {
    if (!byProduct.has(h.productId)) byProduct.set(h.productId, []);
    byProduct.get(h.productId).push(h);
  });

  // Abwesenheiten zuerst: sie wirken auf JEDEN Kaufabstand. Erkannt
  // werden sie an Lücken in den Bons, nicht an Lücken bei einem
  // einzelnen Produkt — dass zwei Wochen gar nicht eingekauft wurde,
  // betrifft den ganzen Haushalt und ist die belastbarere Aussage.
  const absences = allAbsences(s.receipts, s.settings.vacation, ref);
  const absenceDays = (from, to) => absenceDaysBetween(absences, from, to);

  const changes = new Map();
  const rhythms = new Map();
  for (const [pid, rows] of byProduct) {
    const change = detectChange(rows, ref);
    changes.set(pid, change);

    // Nach einem Bruch zählt nur das neue Verhalten. Vorher mittelte
    // der Median monatelang über zwei verschiedene Haushalte.
    const relevant = purchasesSinceChange(rows, change);
    let r = computeRhythm(relevant, { absenceDays });

    r = applySeason(r, rows, ref);
    // `absenceDays` geht auch in die Rückmeldungen: nach einer Reise
    // wird vieles gleichzeitig rechnerisch fällig und löst gebündelt
    // „hab noch da" aus. Ohne diese Korrektur verlängerte jede dieser
    // Antworten einen Rhythmus, der gar nicht falsch war.
    r = applyFeedback(r, s.feedbackLog.filter((f) => f.productId === pid), ref,
      { purchases: relevant, absenceDays });
    rhythms.set(pid, r);
  }
  const stage = determineStage(history, rhythms);
  const { chronic, anomalies } = inferWaste(history, rhythms);

  // Verschwendung je Produkt zusammenfassen (für Warnungen und Sparen)
  /* Die Zusammenführung beider Verschwendungssignale steht in
     wasteInference2 und nicht mehr hier. Hier gerechnet, war sie eine
     Doppelzählung: chronischer Anteil plus Ausreißer ergaben 21 von
     20 Käufen. Fachlogik gehört nach src/algo — auch damit sie
     geprüft werden kann. */
  const wasteStats = new Map();
  for (const [pid] of rhythms) {
    const kaeufe = history
      .filter((h) => h.productId === pid)
      .sort((a, b) => a.date.localeCompare(b.date));
    wasteStats.set(pid, wasteSummary(
      pid,
      kaeufe,
      chronic.find((x) => x.productId === pid) || null,
      anomalies.filter((x) => x.productId === pid),
      // Was der Nutzer selbst bestätigt hat, schlägt die Schätzung.
      { eaten: eatenDates(s.eaten, pid), noChronic: (s.noChronic || []).includes(pid) }
    ));
  }

  // Angebrochenes hält kürzer als die Packung — die Korrektur muss vor
  // Reichweite und Rezepten greifen, sonst rechnen beide mit der Frist
  // der ungeöffneten Ware.
  const inventory = applyOpened(estimateInventory(history, rhythms, ref,
    { useBy: s.useBy, corrections: s.stockCorrections }), s.opened, ref)
    .filter((i) => !isNonFood(i.productId));
  const opened = openedItems(s.opened, ref);

  /* --- Haushaltsprodukte -------------------------------------------
   * Andere Rechnung als bei Lebensmitteln: Non-Food verdirbt nicht,
   * also entspricht die gekaufte Menge der verbrauchten und man kann
   * über eine Rate rechnen statt über Kaufabstände.                  */
  const pattern = shoppingPattern(s.receipts, ref);

  // Urlaubstage, die schon vergangen sind — nur die zählen als Pause.
  const vac = s.settings.vacation;
  let pausedDays = 0;
  if (vac.active && vac.from && vac.to) {
    const from = vac.from < ref ? vac.from : ref;
    const to = vac.to < ref ? vac.to : ref;
    pausedDays = Math.max(0, daysBetween(from, to));
  }

  const profile = {
    ...s.household,
    personCount: s.settings.household,
    shoppingIntervalDays: pattern ? Math.round(7 / Math.max(0.5, pattern.perWeek)) : 7
  };

  // Kaufhistorie je Haushaltsprodukt, mit Packungsmenge aus dem Bon,
  // sonst aus dem Katalog.
  const nonFoodEntries = [];
  for (const pid of new Set(s.purchases.map((x) => x.productId))) {
    if (!isNonFood(pid)) continue;
    const rows = s.purchases
      .filter((x) => x.productId === pid)
      .map((x) => ({
        date: x.date,
        quantity: x.quantity,
        price: x.unitPrice * x.quantity,
        packageValue: x.packageValue || null
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const swap = s.swaps[pid] || {};
    nonFoodEntries.push({
      productId: pid,
      purchases: rows,
      lastSwap: swap.lastSwap || null,
      swaps: swap.history || [],
      pausedDays
    });
  }

  const nonFoodRates = learnAllRates(nonFoodEntries, ref, profile);
  const supplies = supplyOverview(nonFoodEntries, ref, profile, nonFoodRates);
  const swapsDue = dueSwaps(nonFoodEntries, ref, profile, pausedDays);
  const nonFoodSaved = nonFoodSavings(nonFoodEntries, ref);

  // Grundpreis-Einschätzung des letzten Kaufs, für das Detail-Blatt.
  const basePrices = new Map();
  for (const entry of nonFoodEntries) {
    if (!entry.purchases.length) continue;
    const last = entry.purchases[entry.purchases.length - 1];
    const bp = basePrice(entry.productId, last.price, last.packageValue, last.quantity);
    if (!bp) continue;
    const pct2 = pricePercentile(entry.productId, bp.value, entry.purchases);
    basePrices.set(entry.productId, pct2 && pct2.percentile !== null ? pct2 : { message: bp.display });
  }

  // Bevorratung nur, wo Preis UND Rate belastbar sind.
  const stockUp = [];
  for (const sup of supplies) {
    const entry = nonFoodEntries.find((e) => e.productId === sup.productId);
    if (!entry || !entry.purchases.length) continue;
    const last = entry.purchases[entry.purchases.length - 1];
    const advice = stockUpAdvice(sup, {
      history: entry.purchases,
      currentPrice: last.price,
      currentPackage: last.packageValue,
      profile
    });
    if (advice && advice.units > 0) stockUp.push(advice);
  }
  /* --- Vorschlagsliste: gelernte Rhythmen, sonst Kategorie-Annahmen --- */
  let base = [];
  const lookahead = Math.max(0, Number(s.settings.lookaheadDays) || 0);
  // Für den zweiten Auslöser weiter unten: was laut Schätzung noch da
  // ist. `inventory` enthält nur, was wahrscheinlich vorhanden ist --
  // wer hier fehlt, gilt als aufgebraucht.
  const invByProduct = new Map(inventory.map((i) => [i.productId, i]));
  if (stage.stage >= 3) {
    for (const [pid, r] of rhythms) {
      // Haushaltsprodukte laufen NICHT über den Kaufrhythmus. Bei
      // ihnen entspricht die gekaufte Menge der verbrauchten, also
      // rechnet das Verbrauchsmodell weiter unten — mit der Reichweite
      // als Auslöser statt mit dem Kaufabstand.
      if (isNonFood(pid)) continue;
      if (!r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) continue;
      const since = daysBetween(r.lastPurchaseDate, ref);
      const dueIn = r.rhythmDays - since;   // negativ = überfällig
      // Vorlauf als Anteil des Zyklus, nicht als feste Tageszahl —
      // sonst steht ein Produkt mit kurzem Rhythmus ab dem Tag nach
      // dem Kauf wieder auf der Liste. Begründung in shoppingDay.js.
      const vorlauf = effectiveLookahead(r.rhythmDays, lookahead);

      /* ZWEITER AUSLÖSER: der geschätzte Vorrat ist aufgebraucht.
       *
       * Der Kaufrhythmus beantwortet „wie oft kaufst du das?". Die
       * Frage, die auf der Liste steht, ist aber „geht es dir aus?".
       * Meistens ist das dasselbe -- aber nicht, wenn die MENGE
       * schwankt. Wer sonst zwei Liter Milch kauft und diesmal einen
       * genommen hat, ist nach der halben Zeit leer; der Rhythmus
       * merkt davon nichts und schlägt zum gewohnten Termin vor.
       *
       * Genau diese Zusatzinformation steckt in der Bestands-
       * schätzung und wurde von der Liste bisher nicht benutzt:
       * `lastQuantity` und die Korrekturen des Nutzers
       * (setStockCorrection, die Wisch-Geste im Bestand). Ohne sie
       * konnte jemand „ist alle" wischen, und die Liste blieb
       * unbeeindruckt.
       *
       * KEINE DOPPELZÄHLUNG. Der Verdacht liegt nahe -- die
       * Bestandsschätzung stammt aus denselben Käufen wie der
       * Rhythmus, und dieses Projekt hat dreimal Geld dafür bezahlt,
       * dieselbe Tatsache zweimal zu verrechnen. Hier zählt aber
       * nichts doppelt: der Vorrat wirkt nicht AUF den Rhythmus, er
       * öffnet nur eine zweite Tür zur Liste. Der gelernte Takt
       * bleibt unangetastet.
       *
       * Gemessen (Zahlen in test/liste.js und README): der
       * Rückvergleich verliert Genauigkeit (48,8 -> 42,5 %) und
       * gewinnt Trefferquote (78,2 -> 83,9 %); der Drei-Jahres-Lauf,
       * der als einziger die Rückkopplung sieht, verbessert sich
       * deutlich -- 1641 statt 1724 Leertage, 5,1 statt 6,8 %
       * Vergessenes.                                                */
      const invE = invByProduct.get(pid);
      const reichweite = invE && r.perUnitDays
        ? invE.remainingUnits * r.perUnitDays : null;
      // Gar nicht mehr im Bestand heißt: die Schätzung sagt, es ist weg.
      const leer = !invE || (reichweite !== null && reichweite <= vorlauf);
      if (dueIn > vorlauf && !leer) continue;
      const p = byId(pid);
      if (!p) continue;
      const st = wasteStats.get(pid) || {};
      base.push({
        productId: pid, name: p.name, category: p.category, aisle: p.aisle,
        price: p.typicalPrice * (r.lastQuantity || 1),
        rhythmDays: r.rhythmDays, confidence: r.confidence, daysSince: since,
        dueIn,
        wasteRate: st.wasteRate || 0, riskFlag: (st.wasteRate || 0) >= 0.3,
        shelfLifeDays: p.shelfLifeDays,
        perishable: p.isFood && p.shelfLifeDays < 30,
        basis: "rhythmus"
      });
    }
    // Überfälliges zuerst — das ist es, was tatsächlich fehlt.
    base.sort((a, b) => a.dueIn - b.dueIn);
  } else if (stage.stage === 2) {
    base = assumptionBasedSuggestions(history, ref, s.settings.household).map((x) => ({
      ...x, wasteRate: 0, riskFlag: false,
      shelfLifeDays: (byId(x.productId) || {}).shelfLifeDays || 7,
      perishable: true
    }));
  }

  // Haushaltsgröße skaliert die Mengen (Bezugsgröße: 2 Personen)
  const scale = s.settings.household / 2;
  base = base.map((b) => ({ ...b, price: Math.round(b.price * scale * 100) / 100 }));

  // Haushaltsprodukte kommen über ihre Reichweite auf die Liste. Die
  // Menge skaliert hier NICHT mit der Haushaltsgröße — das steckt
  // schon in der Verbrauchsrate. UNSICHER und SPORADIC liefern
  // `dueForPurchase: false` und tauchen deshalb gar nicht erst auf.
  for (const sup of supplies) {
    if (!sup.dueForPurchase) continue;
    const p = byId(sup.productId);
    if (!p) continue;
    base.push({
      productId: sup.productId, name: p.name, category: p.category, aisle: p.aisle,
      price: p.typicalPrice,
      rhythmDays: null, confidence: null,
      daysSince: daysBetween(sup.lastPurchase, ref),
      dueIn: Math.round(sup.daysOfSupply),
      wasteRate: 0, riskFlag: false,
      shelfLifeDays: p.shelfLifeDays, perishable: false,
      basis: "verbrauch",
      supply: sup
    });
  }
  base.sort((a, b) => (a.dueIn ?? 99) - (b.dueIn ?? 99));

  // Urlaubsmodus
  let vacation = null;
  const v = s.settings.vacation;
  if (v.active && v.from && v.to) {
    vacation = filterForVacation(base, ref, v.from, v.to);
    base = [
      ...vacation.keep,
      ...vacation.reduce.map((r) => ({ ...r, price: Math.round(r.price * r.suggestedShare * 100) / 100 }))
    ];
  }

  const budgetResult = fitToBudget(base, s.settings.budget);

  // Wochenentscheidungen anwenden; eine neue Woche setzt sie zurück
  const wk = weekKey(ref);
  const choices = s.listWeek === wk ? s.listChoices : {};
  const items = budgetResult.kept.map((k) => {
    const c = choices[k.productId] || {};
    return {
      ...k,
      // Schlüssel für die Wochenentscheidung. Bei Vorschlägen ist das
      // die Produktkennung, bei selbst ergänzten Zeilen deren eigene —
      // sonst teilten sich zwei Zeilen desselben Produkts einen Haken.
      choiceKey: k.productId,
      on: c.on !== undefined ? c.on : true,
      reason: c.reason || null,
      halved: k.halved || c.halved || false
    };
  });

  /* --- Selbst ergänzte Positionen -------------------------------
   * Sie kommen NACH der Budgetprüfung dazu: was der Nutzer
   * ausdrücklich auf die Liste gesetzt hat, streicht kein Optimierer
   * wieder weg. Sie zählen in die Summe, sind aber als eigene
   * Herkunft gekennzeichnet.                                        */
  const manualItems = s.manual
    .filter((m) => m.week === wk)
    .map((m) => {
      const c = choices[m.id] || {};
      return {
        productId: m.productId, manualId: m.id, choiceKey: m.id, name: m.name,
        category: m.category, aisle: m.aisle,
        price: m.price, rhythmDays: null, confidence: null, daysSince: null,
        dueIn: null, wasteRate: 0, riskFlag: false,
        shelfLifeDays: m.productId ? (byId(m.productId) || {}).shelfLifeDays : null,
        perishable: false, basis: "manuell",
        on: c.on !== undefined ? c.on : true,
        reason: c.reason || null,
        halved: c.halved || false
      };
    });
  items.push(...manualItems);

  /* Die auswertenden Module bekommen nur, was im Katalog steht. Eine
   * freie Zeile wie „Blumen für Oma“ hat keine Haltbarkeit, keinen
   * Gang und keinen Rhythmus — sie durch die Verderb-, Saison- und
   * Doppelkauf-Prüfung zu schicken hieße, sich Werte auszudenken. */
  const known = items.filter((i) => i.productId && byId(i.productId));

  const duplicates = checkList(known, { history, rhythms, today: ref });

  /* --- Sparvorschläge --- */
  const statsForSavings = [];
  for (const [pid, st] of wasteStats) {
    if (!st.wasted) continue;
    const p = byId(pid), r = rhythms.get(pid);
    if (!p || !r || !r.rhythmDays) continue;
    statsForSavings.push({
      productId: pid, name: p.name, category: p.category,
      wasteRate: st.wasteRate,
      wastedEurosPerWeek: st.wastedEuros / 26, windowWeeks: 26,
      currentRhythmDays: r.rhythmDays,
      suggestedRhythmDays: Math.round(r.rhythmDays * 1.3),
      rhythmDays: r.rhythmDays
    });
  }
  const savings = buildSavingsSuggestions(statsForSavings).map((x) => ({
    ...x, on: s.savingsAccepted.includes(x.id)
  }));

  /* Ein angenommener Sparvorschlag änderte bisher an keiner Stelle
   * der App etwas außer der eigenen Wochensumme -- ein Haken ohne
   * Folge. Statt die Produktwahl automatisch umzustellen (das wäre
   * eine Automatisierung, die niemand ausdrücklich erbeten hat),
   * hält der Wochenrückblick jetzt nach: ist die Verschwendung bei
   * genau diesem Produkt seit der Annahme messbar gesunken? Dieselbe
   * Verschwendungsquote, die überall sonst in der App auch gilt --
   * keine neue Fachlogik, nur eine neue Lesart vorhandener Zahlen. */
  const savingsFollowUp = Object.entries(s.savingsAcceptedAt || {})
    .filter(([id]) => s.savingsAccepted.includes(id))
    .map(([id, snap]) => {
      const now = wasteStats.get(snap.productId);
      const wasteRateNow = now ? now.wasteRate : null;
      const wasteRateThen = typeof snap.wasteRateThen === "number" ? snap.wasteRateThen : null;
      return {
        id, title: snap.title, productId: snap.productId, date: snap.date,
        wasteRateThen, wasteRateNow,
        // Drei Prozentpunkte Toleranz, damit dieselbe Quote nicht
        // durch reine Rundung als "eingehalten" durchgeht.
        improved: wasteRateNow !== null && wasteRateThen !== null && wasteRateNow <= wasteRateThen - 0.03,
        messbar: wasteRateNow !== null && wasteRateThen !== null
      };
    })
    .sort((a, b) => a.date < b.date ? 1 : -1);

  /* --- Pfand und Archiv aus den echten Bons --- */
  const byReceipt = new Map();
  s.purchases.forEach((p) => {
    const key = p.date + "|" + p.store;
    if (!byReceipt.has(key)) byReceipt.set(key, []);
    byReceipt.get(key).push(p);
  });

  const depositEntries = [];
  for (const [key, rows] of byReceipt) {
    const date = key.split("|")[0];
    // trackFromReceipt vergibt keine Kennung — Tag und Produkt sind
    // eindeutig genug, um eine Rückgabe wiederzufinden.
    trackFromReceipt(rows, date).entries.forEach((e) =>
      depositEntries.push({ ...e, key: `${e.date}|${e.productId}` })
    );
  }
  const openEntries = depositEntries.filter((e) => !s.depositReturned.includes(e.key));
  const deposit = openDeposit(openEntries.slice(-60), ref);

  const archive = [...byReceipt.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-40)
    .map(([key, rows]) => {
      const [date, store] = key.split("|");
      return archiveReceipt({
        date, store,
        total: rows.reduce((a, r) => a + r.unitPrice * r.quantity, 0),
        items: rows
      });
    });

  /* --- Vergleichszeiträume für die persönliche Inflation --- */
  const first = history.length ? history[0].date : ref;
  const spanDays = daysBetween(first, ref);
  const inflation = spanDays >= 60
    ? personalInflation(
        history,
        { from: first, to: plusDays(first, Math.floor(spanDays / 3)) },
        { from: plusDays(ref, -Math.floor(spanDays / 3)), to: ref }
      )
    : null;

  /* --- Neue Auswertungen: alle aus vorhandenen Daten, kein neues Feld --- */
  const range = stockRange(inventory, rhythms);
  const prices = allPriceMemories(history);

  /* Lebensmittel-Angebote: die Lücke zu stockUpAdvice oben, das nur
     Haushaltsprodukte kennt (die verderben nicht). offerAdvice
     rechnet dieselbe Frage für Lebensmittel — begrenzt durch die
     Haltbarkeit, nicht nur durch Lagerplatz. Beide Module standen
     lange nebeneinander; offerAdvisor.js war fertig und ungenutzt.
     Grundlage ist der ZULETZT gezahlte Preis aus dem Preisgedächtnis
     oben, nicht ein Preis, der jetzt im Laden gilt — die App hat
     keinen Zugang zu aktuellen Regalpreisen und behauptet das nicht. */
  const foodDeals = [];
  for (const [pid, pm] of prices) {
    if (pm.verdict !== "günstig") continue;
    const p = byId(pid);
    if (!p || !p.isFood || p.safetyCritical) continue;
    const r = rhythms.get(pid);
    const advice = offerAdvice(pid, {
      preis: pm.last, üblich: pm.usual, herkunft: "eigen",
      perUnitDays: r && r.perUnitDays
    });
    if (advice) foodDeals.push({ ...advice, lastDate: pm.lastDate, nachlassProzent: pm.changePercent });
  }
  foodDeals.sort((a, b) => b.nachlass - a.nachlass);

  // Weggetippte Hinweise gelten eine Woche, danach kommen sie wieder.
  const dis = s.dismissed.week === wk ? s.dismissed : { forgotten: [], freeze: [] };

  const onList = new Set(known.filter((i) => i.on).map((i) => i.productId));
  const forgotten = findForgotten(rhythms, ref, { exclude: onList })
    .filter((f) => !dis.forgotten.includes(f.productId));

  // Einfrieren bezieht sich auf das, was gerade gekauft wird.
  const freeze = freezeSuggestions(
    known.filter((i) => i.on).map((i) => ({
      productId: i.productId,
      quantity: i.halved ? 0.5 : 1,
      unitPrice: (byId(i.productId) || {}).typicalPrice
    })),
    rhythms
  ).filter((f) => !dis.freeze.includes(f.productId));

  const safety = safetyAlert(known.filter((i) => i.on));

  const season = offSeason(known.filter((i) => i.on), ref);
  const seasonNow = inSeasonNow(ref);

  // Gangreihenfolge des zuletzt benutzten Markts
  const store = s.lastStore || (s.receipts.length ? s.receipts[s.receipts.length - 1].store : "");
  const aisleList = orderFor(store, s.aisleOrders);

  const spend = history.reduce((a, h) => a + h.unitPrice * h.quantity, 0);
  const weeks = Math.max(1, Math.round(spanDays / 7) || 1);
  const wastedEuros = [...wasteStats.values()].reduce((a, x) => a + x.wastedEuros, 0);

  /* --- Rückblick, Streak, Meilensteine ---------------------------
   * Alle drei lesen dasselbe Ereignis-Protokoll. Keine der Zahlen
   * wird hier gerechnet — sonst stünde die Fachlogik wieder in der
   * Oberfläche.                                                    */
  // Abwesenheit hält den Streak — egal ob eingetragen oder erkannt.
  // Wer im Urlaub war, hat nichts versäumt.
  const streakOpts = { vacation: activeVacation(s), absences };
  const streak = weeklyStreak(s.actions, ref, streakOpts);
  const streakWeeks = streakDots(s.actions, ref, 8, streakOpts);

  const dueRange = reviewDue(ref, new Date().getHours());
  const reviewRange = dueRange || weekRangeFor(ref, 0);
  const review = weeklyReview({ actions: s.actions, receipts: s.receipts }, reviewRange);
  review.due = !!dueRange && s.review.lastSeenWeek !== reviewRange.weekKey;

  /* Marke gegen Eigenmarke. Rein informativ: nichts davon wandert in
     die Liste, in die Ersparnis oder in eine Stufe. Wer wirklich
     wechselt, wird ohnehin von `receiptSavings` erfasst — den Euro
     hier ein zweites Mal zu zählen, wäre der Fehler, der in diesem
     Projekt schon zweimal teuer war. */
  const brands = brandSwapCandidates(history, { dismissed: s.brandOff });
  const brandHeadline = swapHeadline(brands);

  const badges = milestoneState({ ...s.lifetime, wochen: streak.weeks });
  const freshBadges = newMilestones(badges, s.badgesSeen);

  /* Die kommenden sieben Tage. Bewusst NACH allem anderen, denn der
     Streifen erfindet nichts — er ordnet nur, was oben schon
     gerechnet wurde, nach Tagen. `supplies` bleibt draußen: was
     ausgeht, steht bereits in `items`. */
  const pulse = weekPulse({ items, inventory, swapsDue, pattern }, ref);

  /* Vorratskäufe. Rein beschreibend — weder die Ersparnis noch das
     Verderb-Risiko wird irgendwo aufsummiert; beides steht schon in
     `savings` bzw. `wasteStats`. Siehe Kopf von hoardDetector.js. */
  const hoards = activeHoards(detectHoards(history, rhythms, ref));

  return {
    ref, weekKey: wk, weekday: weekdayOf(ref),
    history, rhythms, stage, chronic, anomalies, wasteStats, inventory,
    items, manualItems, knownItems: known, duplicates, budgetResult, vacation, savings, savingsFollowUp,
    deposit, depositEntries, openDepositEntries: openEntries, archive,
    inflation,
    range, prices, foodDeals, forgotten, freeze, safety,
    opened, pattern, season, seasonNow,
    profile, nonFoodEntries, nonFoodRates, supplies, swapsDue, nonFoodSaved, stockUp, pausedDays, basePrices,
    changes, feedbackLog: s.feedbackLog, absences,
    actions: s.actions, review, streak, streakWeeks, badges, freshBadges, pulse, hoards,
    brands, brandHeadline, recovery: lastRecovery,
    store, aisleList,
    ethylene: checkEthyleneConflicts(known.filter((i) => i.on)),
    packs: comparePackSizes(history, wasteStats),
    /* Kilogramm aus DERSELBEN Zahl wie die Euro.
     *
     * Vorher lief das über `chronic` mal Käufe — also über einen der
     * beiden Kanäle allein. Damit zählte die Kilogramm-Angabe
     * Ausreißer gar nicht mit (ein Produkt ohne chronischen Anteil
     * wog null Gramm, auch wenn eine ganze Packung weggeworfen
     * wurde), und eine Nutzerkorrektur wäre bei den Euro angekommen
     * und bei den Kilogramm nicht. Zwei Zahlen für dieselbe Sache,
     * die auseinanderlaufen — dieselbe Fehlerklasse wie die
     * Doppelzählung, nur andersherum.
     *
     * Jetzt: Anteil 1 mal der bereits verrechneten Stückzahl. */
    impact: wasteInKilograms(
      [...wasteStats.entries()]
        .filter(([, st]) => st.wasted > 0)
        .map(([pid, st]) => ({ productId: pid, wastedFraction: 1, cycles: st.wasted }))
    ),
    totals: {
      spend,
      weeks,
      spendPerWeek: spend / weeks,
      wastedEuros,
      wastedPerWeek: wastedEuros / weeks,
      receipts: s.receipts.length,
      firstDate: history.length ? first : null
    }
  };
}

/**
 * Aufgedrucktes Datum eintragen — oder wieder entfernen.
 *
 * Es gilt für den jeweils letzten Kauf dieses Produkts. Ein Datum,
 * das vor dem Kauf liegt, wird abgelehnt: das ist ein Vertipper,
 * kein abgelaufenes Produkt, und es würde den Bestand sofort auf
 * „verdorben" setzen.
 */
function setUseBy(productId, date) {
  if (!productId) return false;
  // Dieselbe echte Datumsprüfung wie im Bestand — die Form allein
  // lässt „2026-13-45" durch.
  const gueltig = isRealDate(date);
  if (date && !gueltig) return false;
  const letzter = state.purchases
    .filter((p) => p.productId === productId)
    .map((p) => p.date)
    .sort()
    .pop();
  if (gueltig && letzter && date < letzter) return false;
  update((st) => {
    if (!st.useBy) st.useBy = {};
    if (gueltig) st.useBy[productId] = date;
    else delete st.useBy[productId];
  });
  return true;
}

/* ---------- Aufgegessen statt weggeworfen ---------- */
/** Schlüssel eines einzelnen Kaufs. Produkt und Datum, sonst nichts —
    zwei Käufe desselben Produkts am selben Tag sind für diese Frage
    derselbe Kauf. */
const eatenKey = (productId, date) => `${productId}|${date}`;

/** Die bestätigten Kaufdaten eines Produkts, als Menge. */
function eatenDates(list, productId) {
  const out = new Set();
  (list || []).forEach((k) => {
    const [pid, date] = String(k).split("|");
    if (pid === productId && date) out.add(date);
  });
  return out;
}

/**
 * „Das habe ich aufgegessen“ — für einen einzelnen Kauf.
 *
 * Nimmt die Verschwendungsschätzung für genau diesen Kauf zurück.
 * Umschaltbar, weil eine Korrektur, die man nicht zurücknehmen kann,
 * schlimmer ist als die Schätzung, die sie korrigiert.
 *
 * ES WIRD NICHTS GUTGESCHRIEBEN. Kein Eurobetrag, keine Rettung,
 * kein Meilenstein. Eine Schätzung zurückzunehmen ist kein Erfolg —
 * es war nur nie ein Verlust. Wer daraus eine Rettung machte, hätte
 * einen Betrag erfunden und ihn ein zweites Mal gezählt.
 *
 * @returns {boolean} ob der Kauf jetzt als aufgegessen gilt
 */
function toggleEaten(productId, date) {
  if (!productId || !date) return false;
  const key = eatenKey(productId, date);
  let jetztAn = false;
  update((s) => {
    const list = s.eaten || (s.eaten = []);
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else { list.push(key); jetztAn = true; }
  });
  return jetztAn;
}

/**
 * Dem laufenden Verlustanteil eines Produkts widersprechen.
 *
 * Eine Aussage über das Produkt, nicht über einen einzelnen Kauf —
 * deshalb ein Schalter und keine dreißig. Auch hier wird nichts
 * gutgeschrieben.
 *
 * @returns {boolean} ob der Anteil jetzt abgestellt ist
 */
function toggleNoChronic(productId) {
  if (!productId) return false;
  let jetztAus = false;
  update((s) => {
    const list = s.noChronic || (s.noChronic = []);
    const i = list.indexOf(productId);
    if (i >= 0) list.splice(i, 1);
    else { list.push(productId); jetztAus = true; }
  });
  return jetztAus;
}

/**
 * Eigenmarken-Vergleich für ein Produkt dauerhaft abstellen — oder
 * wieder einschalten. Kein „für diese Woche": wer einmal gesagt hat,
 * dass sein Kaffee nicht zur Debatte steht, hat es gesagt.
 */
function toggleBrandOff(productId) {
  if (!productId) return false;
  let jetztAus = false;
  update((s) => {
    const list = s.brandOff || (s.brandOff = []);
    const i = list.indexOf(productId);
    if (i >= 0) list.splice(i, 1);
    else { list.push(productId); jetztAus = true; }
  });
  return jetztAus;
}

/* ---------- Bon-Text auswerten ---------- */
/**
 * Text eines Kassenbons in Vorschlagszeilen übersetzen.
 * Der Parser ist an echten Bons von Lidl, REWE, Netto und EDEKA
 * kalibriert. Was nicht sicher zugeordnet werden kann, landet in
 * `open` — die Oberfläche fragt nach, statt still etwas Falsches
 * zu buchen.
 */
function parseReceiptText(text) {
  const parsed = parseReceipt(text);
  const rows = parsed.items.map((it) => {
    const learned = state.aliases[normalizeRaw(it.raw)];
    const m = learned
      ? { productId: learned, confidence: 1, method: "gelernt", needsConfirmation: false }
      : matchProduct(it.raw);
    const p = m.productId ? byId(m.productId) : null;
    return {
      raw: it.raw,
      quantity: it.quantity || 1,
      unitPrice: it.paid && it.quantity ? Math.round((it.paid / it.quantity) * 100) / 100 : it.unitPrice,
      weightG: it.weightG,
      productId: m.productId,
      productName: p ? p.name : null,
      confidence: m.confidence,
      method: m.method,
      needsConfirmation: m.needsConfirmation || !m.productId
    };
  });
  return {
    rows,
    deposits: parsed.deposits,
    sum: parsed.sum,
    discountTotal: parsed.discountTotal,
    // Die Gegenprobe gegen die aufgedruckte Summe. `null` heißt
    // „der Bon nennt keine" — das ist kein Fehler, nur keine Probe.
    printedTotal: parsed.printedTotal,
    totalDiff: parsed.totalDiff,
    totalOk: parsed.totalOk,
    warnings: parsed.warnings,
    sure: rows.filter((r) => !r.needsConfirmation).length,
    open: rows.filter((r) => r.needsConfirmation).length
  };
}

/**
 * Zweite Stufe für Zeilen, die `parseReceiptText` nicht zuordnen
 * konnte — ein Umweg über Open Food Facts, Details und Grenzen (nur
 * der Name geht raus, jede Schreibweise höchstens einmal, ohne Netz
 * übersprungen) stehen in offLookup.js.
 *
 * WAS HIER BEWUSST GLEICH BLEIBT: die Produktidentität kommt immer
 * aus dem eigenen Katalog. Open Food Facts liefert nur einen
 * ausgeschriebenen Namen („Joghurt" statt „GL Proteinjogh.sort."),
 * der danach GENAUSO durch `matchProduct` läuft wie jede getippte
 * Zeile. Ein Treffer über diesen Umweg bleibt deshalb immer
 * `needsConfirmation: true` — er ist ein Vorschlag über zwei Ecken
 * (fremder Dienst, dann der eigene Abgleich), keine Gewissheit, und
 * bucht sich nie von selbst.
 *
 * Verändert `parsed.rows` in-place und aktualisiert `sure`/`open`
 * gleich mit — die Oberfläche muss sonst zwei Zählweisen synchron
 * halten.
 *
 * @returns {Promise<boolean>} ob sich überhaupt etwas geändert hat.
 *   Die Oberfläche zeichnet nur dann neu; ein Bon voller sicherer
 *   Treffer verursacht keinen einzigen Netzwerkversuch.
 */
async function enrichUnmatched(parsed) {
  const kandidaten = parsed.rows.filter((r) => !r.productId);
  if (!kandidaten.length) return false;

  let geaendert = false;
  for (const row of kandidaten) {
    const uebersetzt = await OffLookup.find(row.raw);
    if (!uebersetzt) continue;
    const learned = state.aliases[normalizeRaw(uebersetzt)];
    const m = learned
      ? { productId: learned, confidence: 1, method: "gelernt" }
      : matchProduct(uebersetzt);
    if (!m.productId) continue;
    const p = byId(m.productId);
    row.productId = m.productId;
    row.productName = p ? p.name : null;
    row.confidence = m.confidence;
    row.method = "extern:" + m.method;
    row.needsConfirmation = true;
    geaendert = true;
  }

  if (geaendert) {
    parsed.sure = parsed.rows.filter((r) => !r.needsConfirmation).length;
    parsed.open = parsed.rows.filter((r) => r.needsConfirmation).length;
  }
  return geaendert;
}

/**
 * Produktsuche für die Nachfrage-Liste und das manuelle Erfassen.
 *
 * Die Rangfolge steht in productSearch.js — hier wird nur ergänzt,
 * was nur der Speicher weiß: was dieser Haushalt schon gekauft hat.
 * Bei gleichem Rang steht das vorn. Wer einmal Haferdrink gekauft
 * hat, meint bei „hafer" mit einiger Sicherheit wieder den.
 */
function searchProducts(query, limit = 12) {
  return findProducts(query, limit, { boost: new Set(state.purchases.map((p) => p.productId)) });
}

const Data = {
  STORE_KEY, SHADOW_KEY, SCHEMA,
  load, save, get, update, subscribe, reset,
  addReceipt, removeReceipt, receiptLines, updatePurchase, learnAlias, toggleOpened,
  setStockCorrection, clearStockCorrection,
  recordSwapFor, recordFeedback,
  toggleEaten, toggleNoChronic,
  toggleBrandOff, setUseBy, recoveryNotice,
  addManual, removeManual,
  logAction, recordRescue, seedBadges, markBadgesSeen, markReviewSeen, markReviewNotified,
  loadDemo, buildDemoHistory, buildFirstReceipt,
  exportJson, importJson,
  compute, parseReceiptText, enrichUnmatched, searchProducts,
  today, plusDays, weekKey, weekdayOf
};
