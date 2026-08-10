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
const SCHEMA = 1;

/* ---------- Datumshilfen ---------- */
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const today = () => iso(Date.now());
const plusDays = (dateStr, n) => iso(new Date(dateStr + "T12:00:00Z").getTime() + n * 86400000);
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const weekdayOf = (dateStr) => WEEKDAYS[new Date(dateStr + "T12:00:00Z").getUTCDay()];

/** Kalenderwoche als Schlüssel, damit Abwahl-Entscheidungen genau
    eine Woche gelten und danach von selbst verfallen. */
function weekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;              // Montag = 0
  d.setUTCDate(d.getUTCDate() - day + 3);           // Donnerstag derselben Woche
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

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
      // — für „einmal die Woche einkaufen" ist ein Tag zu knapp, sonst
      // steht die Hälfte des Bedarfs erst übermorgen auf der Liste.
      lookaheadDays: 3,
      vacation: { active: false, from: null, to: null },
      demo: false
    },
    purchases: [],        // {id, productId, date, quantity, unitPrice, weightG, store}
    receipts: [],         // {id, date, store, total, itemCount}
    aliases: {},          // gelernte Zuordnung Bonzeile -> Produkt
    listWeek: null,       // Woche, für die die Entscheidungen unten gelten
    listChoices: {},      // productId -> {on, reason, halved}
    savingsAccepted: [],  // ids angenommener Sparvorschläge
    storeChecked: [],     // im Ladenmodus abgehakt
    depositReturned: []   // zurückgegebene Pfandgebinde
  };
}

/* ---------- Laden und Sichern ---------- */
let state = emptyState();
const listeners = new Set();

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (e) {
    // Privater Modus oder blockierter Speicher: die App läuft weiter,
    // merkt sich aber nichts. Besser als ein Absturz beim Start.
    console.warn("Speicher nicht verfügbar — Daten gehen beim Neuladen verloren.", e);
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schema === SCHEMA) state = { ...emptyState(), ...parsed };
    } catch (e) {
      console.warn("Gespeicherte Daten unlesbar — starte leer.", e);
    }
  }
  if (!state.purchases.length && !state.settings.demo && !state.createdAt) state.createdAt = today();
  return state;
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Konnte nicht speichern.", e);
  }
}

function get() { return state; }

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
  const rows = receipt.items.filter((i) => i.productId);
  update((s) => {
    rows.forEach((i) => {
      s.purchases.push({
        id: newId(),
        productId: i.productId,
        date,
        quantity: Math.max(1, Number(i.quantity) || 1),
        unitPrice: Math.max(0, Number(i.unitPrice) || 0),
        weightG: i.weightG || null,
        store
      });
    });
    s.receipts.push({
      id: newId(),
      date,
      store,
      total: Math.round(rows.reduce((a, i) => a + i.unitPrice * i.quantity, 0) * 100) / 100,
      itemCount: rows.length
    });
    // Neuer Einkauf: die Wochenentscheidungen sind verbraucht.
    s.listWeek = null;
    s.listChoices = {};
    s.storeChecked = [];
  });
  return rows.length;
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
      jitter = 1
    } = opts;

    let offset = lastGap;
    let i = 0;
    let previous = null;
    while (offset <= DAYS) {
      const snapped = snap(offset);
      if (snapped !== previous) {
        const date = plusDays(ref, -snapped);
        if (date >= start) {
          // Zweite Hälfte des Zeitraums teurer als die erste
          H.push({
            productId: pid, date, quantity: qty,
            unitPrice: snapped <= DAYS / 2 ? priceLate : priceEarly,
            weightG: null
          });
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
  series("milch_vollmilch", 6, { lastGap: 6, qty: 2, priceLate: 1.29, priceEarly: 1.09 });
  series("brot_vollkorn", 6, { lastGap: 7, priceLate: 2.49, priceEarly: 2.29 });
  series("joghurt_natur", 5, { lastGap: 5, qty: 2, priceLate: 1.19, priceEarly: 1.09 });
  series("eier", 11, { lastGap: 10, priceLate: 3.49, priceEarly: 3.29 });
  series("butter", 20, { lastGap: 19, priceLate: 2.79, priceEarly: 1.99 });
  series("kaese_gouda", 10, { lastGap: 4, priceLate: 2.39, priceEarly: 2.19 });
  series("nudeln", 21, { lastGap: 15, qty: 2, priceLate: 1.35, priceEarly: 1.29 });
  series("reis", 35, { lastGap: 30, priceLate: 2.29, priceEarly: 2.19 });
  series("kaffee", 30, { lastGap: 28, priceLate: 7.49, priceEarly: 5.99 });

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

  // Non-Food fürs Archiv und den Grundpreisvergleich
  series("klopapier", 30, { lastGap: 12, priceLate: 4.29, priceEarly: 3.99 });
  series("spuelmittel", 45, { lastGap: 20, priceLate: 1.39, priceEarly: 1.29 });
  series("schokolade", 9, { lastGap: 2, qty: 2, priceLate: 1.29, priceEarly: 1.19 });

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

    s.settings.demo = true;
    s.listWeek = null;
    s.listChoices = {};
    s.storeChecked = [];
  });
}

/* ---------- Sichern und Zurückholen ---------- */
function exportJson() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Keine gültige Sicherung.");
  if (parsed.schema !== SCHEMA) throw new Error(`Sicherung hat Fassung ${parsed.schema}, erwartet ${SCHEMA}.`);
  if (!Array.isArray(parsed.purchases)) throw new Error("Sicherung enthält keine Käufe.");
  state = { ...emptyState(), ...parsed };
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
    weightG: p.weightG
  }));

  const rhythms = computeAllRhythms(history);
  const stage = determineStage(history, rhythms);
  const { chronic, anomalies } = inferWaste(history, rhythms);

  // Verschwendung je Produkt zusammenfassen (für Warnungen und Sparen)
  const wasteStats = new Map();
  for (const [pid] of rhythms) {
    const purchased = history.filter((h) => h.productId === pid).length;
    const c = chronic.find((x) => x.productId === pid);
    const an = anomalies.filter((x) => x.productId === pid);
    const euros = (c ? c.eurosPerCycle.mid * purchased : 0) + an.reduce((a, x) => a + x.euros.mid, 0);
    const wasted = (c ? Math.round(c.wastedFraction * purchased) : 0) + an.length;
    wasteStats.set(pid, {
      purchased, wasted, wastedEuros: euros,
      wasteRate: purchased ? wasted / purchased : 0, chronic: c
    });
  }

  const inventory = estimateInventory(history, rhythms, ref);

  /* --- Vorschlagsliste: gelernte Rhythmen, sonst Kategorie-Annahmen --- */
  let base = [];
  const lookahead = Math.max(0, Number(s.settings.lookaheadDays) || 0);
  if (stage.stage >= 3) {
    for (const [pid, r] of rhythms) {
      if (!r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) continue;
      const since = daysBetween(r.lastPurchaseDate, ref);
      const dueIn = r.rhythmDays - since;   // negativ = überfällig
      if (dueIn > lookahead) continue;
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
      on: c.on !== undefined ? c.on : true,
      reason: c.reason || null,
      halved: k.halved || c.halved || false
    };
  });

  const duplicates = checkList(items, { history, rhythms, today: ref });

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

  const spend = history.reduce((a, h) => a + h.unitPrice * h.quantity, 0);
  const weeks = Math.max(1, Math.round(spanDays / 7) || 1);
  const wastedEuros = [...wasteStats.values()].reduce((a, x) => a + x.wastedEuros, 0);

  return {
    ref, weekKey: wk, weekday: weekdayOf(ref),
    history, rhythms, stage, chronic, anomalies, wasteStats, inventory,
    items, duplicates, budgetResult, vacation, savings,
    deposit, depositEntries, openDepositEntries: openEntries, archive,
    inflation,
    ethylene: checkEthyleneConflicts(items.filter((i) => i.on)),
    packs: comparePackSizes(history, wasteStats),
    impact: wasteInKilograms(
      chronic.map((c) => ({
        productId: c.productId,
        wastedFraction: c.wastedFraction,
        cycles: (wasteStats.get(c.productId) || {}).purchased || 1
      }))
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

/* ---------- Bon-Text auswerten ---------- */
/**
 * Text eines Kassenbons in Vorschlagszeilen übersetzen.
 * Der Parser ist an einem echten Lidl-Bon kalibriert; andere Märkte
 * folgen demselben Aufbau (Name, Preis, optional Menge). Was nicht
 * sicher zugeordnet werden kann, landet in `open` — die Oberfläche
 * fragt nach, statt still etwas Falsches zu buchen.
 */
function parseReceiptText(text) {
  const parsed = parseLidlReceipt(text);
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
    warnings: parsed.warnings,
    sure: rows.filter((r) => !r.needsConfirmation).length,
    open: rows.filter((r) => r.needsConfirmation).length
  };
}

/** Produktsuche für die Nachfrage-Liste und das manuelle Erfassen. */
function searchProducts(query, limit = 12) {
  const q = String(query).toLowerCase().trim();
  if (!q) return [];
  const hits = [];
  for (const p of FOOD_DATABASE) {
    const inName = p.name.toLowerCase().indexOf(q);
    const inAlias = p.aliases.some((a) => a.toLowerCase().includes(q));
    if (inName === 0) hits.push({ p, rank: 0 });
    else if (inName > 0) hits.push({ p, rank: 1 });
    else if (inAlias) hits.push({ p, rank: 2 });
    if (hits.length > 200) break;
  }
  return hits.sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name)).slice(0, limit).map((h) => h.p);
}

const Data = {
  STORE_KEY, SCHEMA,
  load, save, get, update, subscribe, reset,
  addReceipt, removeReceipt, learnAlias,
  loadDemo, buildDemoHistory, buildFirstReceipt,
  exportJson, importJson,
  compute, parseReceiptText, searchProducts,
  today, plusDays, weekKey, weekdayOf
};
