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

/* Die vier Antworten sind bewusst so gewählt, dass zwei davon den
   Rhythmus korrigieren und zwei ihn ausdrücklich in Ruhe lassen:

     „Hab noch“        Vorschlag kam zu früh  -> Rhythmus verlängern
     „War schon alle“  Vorschlag kam zu spät  -> Rhythmus verkürzen
     „Verbraucht“      sagt nichts über den Takt
     „Diese Woche nicht“ bewusste Pause

   Ohne die zweite Antwort könnte der Nutzer nur in eine Richtung
   korrigieren, und die App bliebe systematisch zu spät dran. */
const REASONS = [
  { key: "have", label: "Hab noch" },
  { key: "empty", label: "War schon alle" },
  { key: "consumed", label: "Verbraucht" },
  { key: "skip", label: "Diese Woche nicht" }
];

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
function emptyView(text, actionLabel, onAction) {
  const c = card();
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

  const body = el("div");
  const facts = el("dl", "facts");
  const fact = (k, v) => {
    if (v === null || v === undefined || v === "") return;
    facts.append(el("dt", null, esc(k)), el("dd", null, esc(v)));
  };

  // Haushaltsprodukte rechnen anders — und zeigen deshalb andere
  // Fakten. Ein Kaufrhythmus wäre dort irreführend (die Menge zählt,
  // nicht der Abstand), und die Lebensmittel-Bestandsschätzung liefert
  // bei einer Haltbarkeit von zehn Jahren „noch 3633 Tage“.
  const nf = nonFoodFor(productId);

  fact("Kategorie", p.category);
  if (!nf) {
    fact("Rhythmus", r && r.rhythmDays ? `alle ${r.rhythmDays} Tage · Vertrauen ${pct(r.confidence)}` : "noch nicht gelernt");
    // Was der rohe Median sagte, bevor Bruch, Saison und Rückmeldungen
    // darauf gewirkt haben. Ohne diese Zeile wäre die Zahl oben eine
    // Behauptung ohne Herkunft.
    if (r && r.baseRhythmDays && r.baseRhythmDays !== r.rhythmDays) {
      fact("davor gelernt", `alle ${r.baseRhythmDays} Tage`);
    }
    if (r && r.feedback && r.feedback.signals) {
      fact("Rückmeldungen", `${r.feedback.signals} · ${r.feedback.applied ? "wirken auf den Rhythmus" : "noch ohne Wirkung"}`);
    }
    if (r && r.season && r.season.applied) fact("Saison", r.season.message);
    const chg = ctx.changes && ctx.changes.get(productId);
    if (chg && chg.found) fact("Verhalten geändert", chg.message);
  }
  fact("Zuletzt", r && r.lastPurchaseDate ? deDate(r.lastPurchaseDate) : null);
  if (!nf) {
    fact("Haltbarkeit", p.isFood
      ? `${p.shelfLifeDays} Tage${p.shelfLifeOpenedDays ? `, offen ${p.shelfLifeOpenedDays}` : ""}`
      : null);
  }
  fact("Lagerort", p.storage !== "kein Lagerhinweis" ? p.storage : null);
  fact("Preis", pm
    ? `zuletzt ${eur(pm.last)} · üblich ${eur(pm.usual)} · Spanne ${eur(pm.lowest)}–${eur(pm.highest)}`
    : `üblich ${eur(p.typicalPrice)}`);
  if (!nf) {
    fact("Bestand", inv
      ? `${de(inv.remainingUnits.toFixed(1))} · noch ${inv.daysLeft} Tage · Sicherheit ${pct(inv.confidence)}`
      : "nicht schätzbar");
    fact("Reichweite", range ? `${de(range.days)} Tage · begrenzt durch ${range.limitedBy === "frische" ? "Frische" : "Menge"}` : null);
    fact("Verlust", st && st.wastedEuros > 0
      ? `${eur(st.wastedEuros)} über ${st.purchased} Käufe (${pct(st.wasteRate)})`
      : "keiner erkannt");
    fact("Datenqualität", {
      regulatorisch: "regulatorisch (BZfE)",
      leitlinie: "Leitlinie (BZfE)",
      schaetzwert: "Schätzwert ohne amtliche Quelle"
    }[p.quality]);
  }
  if (nf) {
    const sup = ctx.supplies.find((x) => x.productId === productId);
    const swap = ctx.swapsDue.find((x) => x.productId === productId);
    const rate = ctx.nonFoodRates.get(productId);
    const CLASS_LABEL = {
      RATE: "wird aufgebraucht", INTERVAL: "wird ausgetauscht",
      SPORADIC: "unregelmäßig", DATED: "hat ein Ablaufdatum"
    };
    fact("Verbrauchsart", CLASS_LABEL[nf.consumptionClass]);
    fact("Packung", `${de(nf.package.value)} ${nf.package.unit}`);
    if (rate) fact("Verbrauch", `${de(rate.rate)} ${nf.package.unit}/Tag · ${rate.label}`);
    if (sup && sup.daysOfSupply !== null && sup.confidence !== "UNSICHER") {
      fact("Reicht noch", `${de(sup.daysOfSupply)} Tage`);
    }
    if (swap) {
      fact("Austausch", `alle ${swap.intervalDays} Tage · ${swap.source}` +
        (swap.hardnessAdjusted ? " · an die Wasserhärte angepasst" : ""));
      fact("Im Einsatz", `${swap.inUse} Tage`);
    }
    const bp = ctx.basePrices && ctx.basePrices.get(productId);
    if (bp) fact("Grundpreis", bp.message);
    if (nf.paoMonths) fact("Nach dem Öffnen", `${nf.paoMonths} Monate haltbar`);
    fact("Quelle", nf.rateSource || nf.intervalSource || nf.datedSource);
    fact("In der WG", nf.sharedByDefault ? "geteilt" : "persönlich");
    if (nf.requiresDevice) fact("Braucht", {
      hasDishwasher: "Spülmaschine", hasWashingMachine: "Waschmaschine",
      hasCoffeeMachine: "Kaffeemaschine", hasWaterFilter: "Wasserfilter"
    }[nf.requiresDevice]);
  }
  body.append(facts);

  if (nf && nf.paoMonths) {
    body.append(el("div", "note gold",
      `Die Frist läuft ab dem Öffnen. Die App kennt dieses Datum nicht und rechnet ab dem Kauf — das ist eine Annahme, keine Messung.`));
  }
  if (nf && nf.consumptionClass === "SPORADIC") {
    body.append(el("div", "note",
      "Für dieses Produkt macht die App keine Vorhersage. Der Kaufabstand lässt kein Muster erkennen."));
  }

  if (!nf && r && r.feedback && r.feedback.message) {
    body.append(el("div", "note", esc(r.feedback.message)));
  }
  if (!nf) {
    const chg = ctx.changes && ctx.changes.get(productId);
    if (chg && chg.found) body.append(el("div", "note blue", esc(chg.message)));
  }
  if (p.safetyCritical) {
    body.append(el("div", "note red",
      "<b>Verbrauchsdatum.</b> Nach Ablauf in den Müll — Keime sind weder zu sehen noch zu riechen. Die App verlängert diese Frist nie."));
  }
  if (season && season.status === "importware") body.append(el("div", "note gold", esc(season.message)));
  if (p.note) body.append(el("div", "note", esc(p.note)));

  // Angebrochen: ein Tippen, mehr Pflege darf es nicht kosten.
  if (p.isFood && p.shelfLifeOpenedDays && p.shelfLifeOpenedDays < p.shelfLifeDays) {
    const b = el("button", "cta light", isOpen ? "✓ angebrochen" : "Als angebrochen markieren");
    b.addEventListener("click", () => {
      Data.toggleOpened(productId);
      App.closeSheet();
      App.toast(isOpen ? "Markierung entfernt" : `Hält noch ${p.shelfLifeOpenedDays} Tage`);
    });
    body.append(b);
  }

  App.sheet(p.name, null, body);
}

/* ================================================================
   1. Liste
   ================================================================ */
function viewListe(ctx, app) {
  const c = frag();
  const S = Data.get();

  if (ctx.stage.stage <= 1) {
    const e = emptyView(
      ctx.history.length ? "Zwei Bons je Produkt, dann kommen die Vorschläge." : "Noch keine Daten.",
      "Einkauf erfassen", () => app.goto("erfassen"));
    if (!ctx.history.length) {
      const demo = el("button", "cta light", "Beispieldaten laden");
      demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Geladen"); });
      e.append(demo);
    }
    c.append(e);
    return c;
  }

  // Der Rückblick steht obenan, aber nur wenn er fällig ist. Eine
  // Karte, die jeden Tag da ist, ist kein Anlass mehr.
  if (ctx.review.due) c.append(reviewCard(ctx, app));

  if (ctx.range.days !== null) c.append(rangeHero(ctx, app));

  /* --- Sicherheit: eine Zeile --- */
  if (ctx.safety) {
    const g = uiGroup("Sicherheit", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source);
    g.body.append(uiRow(ctx.safety.short, ctx.safety.coldestZone,
      el("span", "flag f-miss", "kühlen"), {
        onClick: () => app.notice("Kühlkette", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source)
      }));
    c.append(g);
  }

  /* --- Die Liste --- */
  const on = ctx.items.filter((i) => i.on);
  const sumOn = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);

  // „Fällig“ war die Sprache des Algorithmus, nicht die des Nutzers.
  // Was hier steht, ist eine Einkaufsliste — und das darf sie sagen.
  const list = uiGroup("Deine nächste Einkaufsliste",
    "Die App füllt die Liste aus deinen Rhythmen vor: Lebensmittel nach dem gelernten Kaufabstand " +
    "zuzüglich der eingestellten Vorausschau, Haushaltsprodukte nach ihrer Verbrauchsrate.\n\n" +
    "Sie gehört trotzdem dir. Haken wegnehmen, halbe Menge wählen, eigene Positionen ergänzen — " +
    "alles unten über „Etwas hinzufügen“. Der Rechenweg jeder vorgeschlagenen Zeile steht in ihrem " +
    "Detail-Blatt, einfach antippen.");
  list.body.append(el("div", "listLead",
    `<span>Vorgeschlagen aus deinen Rhythmen${ctx.pattern && ctx.pattern.dayName
      ? " · nächster Einkauf " + esc(ctx.pattern.dayName) : ""}</span>`));

  if (ctx.budgetResult.removed.length) {
    list.body.append(uiRow(`${ctx.budgetResult.removed.length} wegen Budget gestrichen`,
      ctx.budgetResult.removed.map((r) => r.name).join(", "), null, {
        onClick: () => app.notice("Budget", ctx.budgetResult.advice +
          " Brot, Milch und Eier bleiben immer auf der Liste.")
      }));
  }
  if (ctx.vacation && ctx.vacation.skip.length) {
    list.body.append(uiRow(`Urlaub: ${ctx.vacation.skip.length} zurückgestellt`,
      ctx.vacation.skip.map((s) => s.name).join(", "), null, { value: "− " + eur(ctx.vacation.savedEuros) }));
  }

  // Drei Sektionen: was die App vorschlägt (Lebensmittel, Haushalt)
  // und was du selbst ergänzt hast. Die Trennung ist keine Formsache —
  // sie beantwortet die Frage „woher kommt das hier eigentlich?“, ohne
  // dass man eine Zeile antippen muss.
  const auto = ctx.items.filter((i) => i.basis !== "manuell");
  const eigene = ctx.items.filter((i) => i.basis === "manuell");
  const food = auto.filter((i) => !isNonFood(i.productId));
  const home = auto.filter((i) => isNonFood(i.productId));

  const ul = el("ul", "items");
  if (!ctx.items.length) {
    ul.append(el("li", "item", '<p class="empty">Nichts fällig — die Liste ist leer.</p>'));
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

  // Der wichtigste Knopf dieser Seite: ohne ihn ist die App ein
  // Automat, den man nur zusehen kann.
  const add = el("button", "row action addRow");
  add.innerHTML = '<span class="plusMark">+</span>' +
    '<div class="rowMain"><div class="rowTitle">Etwas hinzufügen</div>' +
    '<div class="rowSub">Produkt suchen oder frei eintippen</div></div>';
  add.addEventListener("click", () => addSheet(ctx, app));
  list.body.append(add);

  const full = ctx.items.reduce((a, i) => a + i.price, 0);
  const tot = el("div", "totals");
  tot.innerHTML =
    `<div><div class="l">${on.length} Positionen</div><div class="big">${eur(sumOn)}</div></div>` +
    `<div class="saved">${full > sumOn ? "− " + eur(full - sumOn) : ""}</div>`;
  list.body.append(tot);
  c.append(list);

  const actions = el("div", "ctaRow");
  const go = el("button", "cta", "Einkaufen");
  go.disabled = !on.length;
  go.addEventListener("click", () => app.openStore());
  const share = el("button", "cta light", "Teilen");
  share.disabled = !on.length;
  share.addEventListener("click", () => app.shareList());
  actions.append(go, share);
  c.append(actions);

  /* --- Vergessen --- */
  if (ctx.forgotten.length) {
    const g = uiGroup("Fehlt dir das?",
      "Produkte, die deutlich über ihrem gelernten Rhythmus liegen und nicht auf der Liste stehen.");
    ctx.forgotten.slice(0, 4).forEach((f) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(f.name)}</div><div class="rowSub">${f.daysSince} statt ${f.rhythmDays} Tage</div>`));
      const acts = el("div", "rowActions");
      const add = el("button", "pillBtn on", "Dazu");
      add.addEventListener("click", () => { app.addToList(f.productId); app.toast(f.name + " dazu"); });
      const no = el("button", "pillBtn", "Nein");
      no.setAttribute("aria-label", `${f.name} nicht mehr vorschlagen`);
      no.addEventListener("click", () => app.dismiss("forgotten", f.productId));
      acts.append(add, no);
      r.append(acts);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Einfrieren --- */
  if (ctx.freeze.length) {
    const g = uiGroup("Einfrieren", "Erscheint nur, wenn die gekaufte Menge länger reicht als die Haltbarkeit.");
    ctx.freeze.slice(0, 3).forEach((f) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(f.name)}: ${f.share === 0.5 ? "die Hälfte" : "ein Teil"}</div>` +
        `<div class="rowSub">rettet ${eur(f.valueAtRisk)}</div>`));
      const done = el("button", "pillBtn", "Eingefroren");
      done.addEventListener("click", () => {
        app.dismiss("freeze", f.productId);
        app.rescue(f.productId, `${f.name} eingefroren`, f.valueAtRisk);
      });
      r.append(done);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Saison --- */
  if (ctx.season.length) {
    const g = uiGroup("Nicht in Saison", "Saisonkalender des BZfE. Produkte ohne Eintrag bekommen keinen Hinweis.");
    ctx.season.forEach((s) => g.body.append(uiRow(s.name,
      "Saison: " + s.peakMonths.map((m) => MONTH_NAMES[m - 1]).join(", "), null, { value: "Import" })));
    c.append(g);
  }

  /* --- Lagerhinweis --- */
  if (ctx.ethylene) {
    const g = uiGroup("Lagern");
    g.body.append(uiRow("Getrennt lagern", "Ethylen lässt die zweite Gruppe schneller verderben", null, {
      onClick: () => app.notice("Lagern", ctx.ethylene.message + "\n\nQuelle: " + ctx.ethylene.source)
    }));
    c.append(g);
  }

  /* --- Einstellungen --- */
  const set = uiGroup("Diese Woche");
  const rest = S.settings.budget - sumOn;
  set.body.append(uiRow("Budget",
    S.settings.budget ? (rest >= 0 ? `${eur(rest)} Luft` : `${eur(-rest)} drüber`) : null,
    stepper(S.settings.budget, (v) => (v ? eur(v) : "aus"),
      (v) => app.set((s) => { s.settings.budget = v; }), { min: 0, max: 400, step: 5 })));
  set.body.append(uiRow("Personen", null,
    stepper(S.settings.household, String,
      (v) => app.set((s) => { s.settings.household = v; }), { min: 1, max: 8, step: 1 })));
  set.body.append(uiRow("Vorausschau",
    ctx.pattern && ctx.pattern.dayName ? `nächster Einkauf ${ctx.pattern.dayName}` : null,
    stepper(S.settings.lookaheadDays, (v) => (v ? `${v} Tage` : "aus"),
      (v) => app.set((s) => { s.settings.lookaheadDays = v; }), { min: 0, max: 7, step: 1 })));

  const v = S.settings.vacation;
  set.body.append(uiRow("Urlaub", v.active && v.from ? `${deDate(v.from)}–${deDate(v.to)}` : null,
    toggle(v.active, (onOff) => app.set((s) => {
      s.settings.vacation.active = onOff;
      if (onOff && !s.settings.vacation.from) {
        s.settings.vacation.from = Data.plusDays(Data.today(), 2);
        s.settings.vacation.to = Data.plusDays(Data.today(), 16);
      }
    }), "Urlaubsmodus")));

  if (v.active) {
    const f = el("div", "dateRow");
    [["from", "Abreise"], ["to", "Rückkehr"]].forEach(([key, label]) => {
      const w = el("label", "field", `<span class="lbl">${label}</span>`);
      const i = el("input");
      i.type = "date";
      i.value = v[key] || "";
      i.addEventListener("change", () => app.set((s) => { s.settings.vacation[key] = i.value; }));
      w.append(i);
      f.append(w);
    });
    set.body.append(f);
  }
  c.append(set);
  return c;
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

  const list = el("ul", "plain");
  list.append(el("li", null,
    `<span class="flag">M</span><span>${esc(c.marke ? brandLabel(c.marke) : "Marke")}` +
    `<br><small>${esc(eur(c.markenPreis) + " " + einheit + " · " + c.markenKaeufe + " Käufe")}</small></span>`));
  list.append(el("li", null,
    `<span class="flag f-ok">E</span><span>${esc(c.eigenmarke ? brandLabel(c.eigenmarke) : "Eigenmarke")}` +
    `<br><small>${esc(eur(c.eigenPreis) + " " + einheit +
      (c.belegt ? " · " + c.eigenKaeufe + " Käufe" : " · geschätzt"))}</small></span>`));
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
    app.toast(`${entry.name} auf der Liste`, { icon: "+" });
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
function listItem(it, ctx, app) {
  const p = byId(it.productId) || {};
  const manuell = it.basis === "manuell";
  const li = el("li", "item" + (it.on ? "" : " off"));

  const top = el("div", "top");
  const cb = el("input");
  cb.type = "checkbox"; cb.className = "box"; cb.checked = it.on;
  cb.setAttribute("aria-label", it.name);
  cb.addEventListener("change", () => app.choose(it.choiceKey, { on: cb.checked, reason: cb.checked ? null : undefined }));

  const main = el("button", "main");
  main.setAttribute("aria-label", `Details zu ${it.name}`);
  const nm = el("div", "nm", esc(it.name));
  if (manuell) nm.append(el("span", "pill own", "von dir"));
  if (!manuell && it.dueIn < 0) nm.append(el("span", "pill warn", `${-it.dueIn} T überfällig`));
  if (it.riskFlag) nm.append(el("span", "pill risk", pct(it.wasteRate)));
  if (p.safetyCritical) nm.append(el("span", "pill safety", "VD"));
  const pm = ctx.prices.get(it.productId);
  if (pm && pm.verdict !== "üblich") {
    nm.append(el("span", "pill " + (pm.verdict === "günstig" ? "cheap" : "warn"), sign(pm.changePercent) + " %"));
  }
  if (ctx.duplicates.some((d) => d.productId === it.productId)) nm.append(el("span", "pill dup", "doppelt?"));
  if (!it.on && it.reason) {
    const rr = REASONS.find((x) => x.key === it.reason);
    if (rr) nm.append(el("span", "pill state", rr.label));
  }
  main.append(nm);
  main.addEventListener("click", () => {
    // Eine frei eingetragene Zeile hat kein Detail-Blatt — sie hat ja
    // keine Daten. Sie bekommt ihr eigenes, kleines.
    if (manuell && (!it.productId || !byId(it.productId))) manualSheet(it, app);
    else if (manuell) manualSheet(it, app);
    else productSheet(it.productId, ctx);
  });

  // Ohne Preis keine Preisspalte — „0,00 €“ wäre eine Behauptung.
  top.append(cb, main, el("div", "price", it.price > 0 ? eur(it.halved ? it.price / 2 : it.price) : "—"));
  li.append(top);

  if (it.on && it.riskFlag) {
    const acts = el("div", "inlineActions");
    const h = el("button", "pillBtn" + (it.halved ? " on" : ""), it.halved ? "✓ halbe Menge" : "Halbe Menge");
    h.setAttribute("aria-pressed", it.halved ? "true" : "false");
    h.addEventListener("click", () => {
      const now = !it.halved;
      app.choose(it.choiceKey, { halved: now });
      // Nur beim Setzen. Gegen mehrfaches Zählen sperrt zusätzlich
      // Data.recordRescue — ein Produkt kann höchstens einmal am Tag
      // gerettet werden.
      if (now) app.rescue(it.productId, `${it.name}: halbe Menge`, it.price / 2);
    });
    acts.append(h);
    li.append(acts);
  }

  // Die vier Antworten korrigieren einen Rhythmus. Eine selbst
  // ergänzte Zeile hat keinen, also gibt es dort auch nichts zu fragen.
  if (!manuell && !it.on && (it.perishable || it.price > 3)) {
    const opts = el("div", "opts");
    REASONS.forEach((rr) => {
      const b = el("button", "opt", esc(rr.label));
      b.setAttribute("aria-pressed", it.reason === rr.key ? "true" : "false");
      b.addEventListener("click", () => app.choose(it.choiceKey, { reason: rr.key }));
      opts.append(b);
    });
    li.append(opts);
  }
  return li;
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
      () => app.goto("erfassen")));
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

/** Restlaufzeit als Satz, mit richtigem Numerus. */
function supplyText(sup) {
  if (sup.daysOfSupply === null || sup.confidence === "UNSICHER") return "unregelmäßig";
  const d = Math.round(sup.daysOfSupply);
  if (d <= 0) return "vermutlich leer";
  return d === 1 ? "reicht noch einen Tag" : `reicht noch ${d} Tage`;
}

/**
 * Eine Austauschzeile. Der Name führt zum Detail-Blatt, rechts steht
 * die eine Handlung, um die es geht.
 */
function swapRow(x, ctx, app) {
  const r = el("div", "row");
  const main = el("button", "rowMain plainBtn");
  main.setAttribute("aria-label", `Details zu ${x.name}`);
  main.innerHTML =
    `<div class="rowTitle">${esc(x.name)}</div>` +
    `<div class="rowSub">${esc(x.due
      ? `seit ${x.inUse} ${x.inUse === 1 ? "Tag" : "Tagen"} im Einsatz`
      : `fällig in ${x.daysLeft} ${x.daysLeft === 1 ? "Tag" : "Tagen"}`)}</div>`;
  main.addEventListener("click", () => productSheet(x.productId, ctx));
  r.append(main);

  const swap = el("button", "pillBtn" + (x.due ? " on" : ""), "Getauscht");
  swap.addEventListener("click", () => app.swap(x.productId, x.name));
  r.append(swap);
  return r;
}

/* ================================================================
   2. Bestand
   ================================================================ */
function viewBestand(ctx, app) {
  const c = frag();

  if (!ctx.inventory.length && !ctx.supplies.length) {
    c.append(emptyView("Kein Bestand schätzbar.", "Einkauf erfassen", () => app.goto("erfassen")));
    return c;
  }

  if (ctx.range.days !== null) c.append(rangeHero(ctx, app));

  /* --- Angebrochen --- */
  if (ctx.opened.length) {
    const g = uiGroup("Angebrochen",
      "Geöffnete Packungen halten kürzer. Ab der Markierung rechnet die Bestandsschätzung mit der kurzen Frist.");
    ctx.opened.forEach((o) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain",
        `<div class="rowTitle">${esc(o.name)}</div><div class="rowSub">seit ${o.openedDays} ${o.openedDays === 1 ? "Tag" : "Tagen"}</div>`));
      r.append(el("span", "flag " + (o.expired ? "f-miss" : o.urgent ? "f-gold" : "f-ok"),
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
    "Geschätzt aus Einkauf minus Verbrauch, ohne dass du etwas pflegst. Die Sicherheitsangabe steht im Detail-Blatt jeder Zeile.");
  ctx.inventory.slice(0, 20).forEach((i) => {
    const p = byId(i.productId) || {};
    const longLived = !p.isFood || i.daysLeft > 120;
    const flagCls = i.daysLeft <= 2 ? "f-miss" : i.daysLeft <= 5 ? "f-gold" : "f-ok";
    const r = el("button", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(i.name)}${i.opened ? ' <span class="pill">offen</span>' : ""}</div>` +
      `<div class="rowSub">${de(i.remainingUnits.toFixed(1))} · ${eur(i.value)}</div>`));
    r.append(el("span", "flag " + (longLived ? "f-ok" : flagCls), longLived ? "haltbar" : `${i.daysLeft} T`));
    r.append(el("div", "chev"));
    r.addEventListener("click", () => productSheet(i.productId, ctx));
    inv.body.append(r);
  });
  c.append(inv);

  /* --- Haushaltsprodukte: eigene Rechnung, eigene Gruppe --- */
  if (ctx.supplies.length) {
    const g = uiGroup("Haushalt",
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
      g.body.append(r);
    });
    c.append(g);
  }

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

  /* --- Urlaub --- */
  const S = Data.get();
  if (S.settings.vacation.active && S.settings.vacation.from) {
    const v = S.settings.vacation;
    const plan = useUpPlan(ctx.inventory, v.from, v.to, ctx.ref);
    const p = uiGroup("Vor der Abreise", plan.summary);
    plan.mustUse.forEach((x) => p.body.append(uiRow(x.name, `noch ${x.daysLeft} Tage`, el("span", "flag f-gold", "aufbrauchen"))));
    plan.freeze.forEach((x) => p.body.append(uiRow(x.name, eur(x.value), el("span", "flag f-new", "einfrieren"))));
    if (!plan.mustUse.length && !plan.freeze.length) p.body.append(el("p", "empty", "Nichts gefährdet."));
    c.append(p);
  }
  return c;
}

/* ================================================================
   3. Erfassen
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
        `<div class="rowTitle">${esc(rec.store)}</div><div class="rowSub">${deDate(rec.date)} · ${rec.itemCount} Positionen</div>`));
      r.append(el("div", "rowValue", eur(rec.total)));
      const del = el("button", "del", "×");
      del.setAttribute("aria-label", `Bon vom ${deDate(rec.date)} löschen`);
      del.addEventListener("click", () => app.confirm("Bon löschen?",
        `${rec.store}, ${deDate(rec.date)}`,
        () => { Data.removeReceipt(rec.id); app.toast("Gelöscht"); }));
      r.append(del);
      g.body.append(r);
    });
    c.append(g);
  }
  return c;
}

function renderScan(box, cap, app) {
  const ta = el("textarea");
  ta.value = cap.text || "";
  ta.placeholder = "Bon-Text einfügen …";
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
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = "Lidl";
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
  });
  box.append(go);

  if (!cap.parsed) return;
  const p = cap.parsed;

  box.append(uiRow(`${p.rows.length} erkannt, ${p.sure} sicher`,
    p.open ? "unsichere werden gefragt, nicht geraten" : null,
    el("span", "flag " + (p.open ? "f-gold" : "f-ok"), p.open ? p.open + " offen" : "fertig")));

  if (p.warnings.length) {
    box.append(uiRow(`${p.warnings.length} Rechenprobe(n) auffällig`, null, null,
      { onClick: () => app.notice("Rechenprobe", p.warnings.join("\n\n")) }));
  }

  const rows = el("div");
  p.rows.forEach((rowData, idx) => {
    const r = el("div", "matchRow");
    const left = el("div", "raw");
    left.append(el("div", "n", rowData.productName ? esc(rowData.productName) : "nicht zugeordnet"));
    left.append(el("div", "r", esc(rowData.raw)));

    if (rowData.needsConfirmation) {
      const sel = el("select");
      sel.setAttribute("aria-label", `Zuordnung für ${rowData.raw}`);
      const pool = new Map();
      if (rowData.productId && byId(rowData.productId)) pool.set(rowData.productId, byId(rowData.productId));
      Data.searchProducts(rowData.raw.split(/\s+/)[0] || "", 8).forEach((x) => pool.set(x.id, x));
      FOOD_DATABASE.forEach((x) => { if (!pool.has(x.id)) pool.set(x.id, x); });
      sel.innerHTML = `<option value="">— nicht buchen —</option>` +
        [...pool.values()].map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
      sel.value = rowData.productId || "";
      sel.addEventListener("change", () => {
        p.rows[idx].productId = sel.value || null;
        p.rows[idx].productName = sel.value ? byId(sel.value).name : null;
        p.rows[idx].needsConfirmation = false;
        p.rows[idx].learn = !!sel.value;
        p.sure = p.rows.filter((x) => !x.needsConfirmation).length;
        p.open = p.rows.filter((x) => x.needsConfirmation).length;
        app.render();
      });
      left.append(sel);
    }

    r.append(left, el("div", "amt",
      `${eur(rowData.unitPrice * rowData.quantity)}<small>${rowData.quantity}×</small>`));
    rows.append(r);
  });
  box.append(rows);

  const save = el("button", "cta", `${p.rows.filter((r) => r.productId).length} übernehmen`);
  save.disabled = !p.rows.some((r) => r.productId);
  save.addEventListener("click", () => {
    p.rows.forEach((r) => { if (r.learn && r.productId) Data.learnAlias(r.raw, r.productId); });
    const res = Data.addReceipt({ date: cap.date, store: cap.store, items: p.rows });
    cap.parsed = null; cap.text = "";
    app.toast(`${res.count} gebucht`, { detail: bookedDetail(res) });
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
  tot.innerHTML = `<div><div class="l">${cap.basket.length} Positionen</div><div class="big">${eur(total)}</div></div>`;
  box.append(tot);

  const meta = el("div", "row2");
  const df = el("label", "field", '<span class="lbl">Datum</span>');
  const di = el("input"); di.type = "date"; di.value = cap.date || Data.today();
  di.addEventListener("change", () => { cap.date = di.value; });
  df.append(di);
  const sf = el("label", "field", '<span class="lbl">Markt</span>');
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = "REWE";
  si.addEventListener("input", () => { cap.store = si.value; });
  sf.append(si);
  meta.append(df, sf);
  box.append(meta);

  const save = el("button", "cta", "Buchen");
  save.addEventListener("click", () => {
    const res = Data.addReceipt({ date: di.value, store: si.value.trim() || "Unbekannt", items: cap.basket });
    cap.basket = [];
    app.toast(`${res.count} gebucht`, { detail: bookedDetail(res) });
    app.goto("liste");
  });
  box.append(save);
}

/* ================================================================
   4. Zahlen
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
  s.append(tile("Ø pro Woche", eur(t.spendPerWeek), `${t.receipts} Bons`));
  s.append(tile("zu holen", eur(savingsTotal), "ohne Verzicht", "good"));
  s.append(tile("Verlust", eur(t.wastedPerWeek), `${de(ctx.impact.kg)} kg gesamt`, "warn"));
  s.append(tile("Rhythmen", String([...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length),
    `von ${ctx.rhythms.size}`));
  c.append(s);

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
      g.body.append(uiRow(`Vorausschau auf ${suggested} Tage`, `aktuell ${cur}`, null, {
        onClick: () => { app.set((st) => { st.settings.lookaheadDays = suggested; }); app.toast("Übernommen"); }
      }));
    }
    c.append(g);
  }

  c.append(chartCard(ctx));

  /* --- Inflation --- */
  if (ctx.inflation && ctx.inflation.productsCompared) {
    const inf = ctx.inflation;
    const g = uiGroup("Persönliche Inflation", inf.caveat);
    g.body.append(uiRow("Dein Warenkorb", `${inf.productsCompared} Produkte verglichen`,
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

  /* --- Ersparnis bei Haushaltsprodukten: getrennt ausweisen --- */
  if (ctx.nonFoodSaved.total > 0) {
    const g = uiGroup("Günstig eingekauft",
      "Realisierte Ersparnis: du hast weniger gezahlt als deinen üblichen Grundpreis. Getrennt von der " +
      "Lebensmittel-Ersparnis, denn die ist kontrafaktisch — dort geht es um Verderb, der nicht eingetreten ist. " +
      "Beides zu addieren wäre irreführend.");
    g.body.append(uiRow("Haushaltsprodukte", ctx.nonFoodSaved.basis, null,
      { value: eur(ctx.nonFoodSaved.total) }));
    ctx.nonFoodSaved.byProduct.slice(0, 5).forEach((x) =>
      g.body.append(uiRow(x.name, `${x.purchases} Käufe`, null, { value: eur(x.saved) })));
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

  /* --- Wirkung --- */
  const cmp = compareToReference(ctx.impact.kg, Data.get().settings.household);
  const ig = uiGroup("Wirkung", cmp.framing + "\n\n" + cmp.note);
  ig.body.append(uiRow("Geschätzter Verlust", null, null, { value: de(ctx.impact.kg) + " kg" }));
  ctx.impact.byProduct.slice(0, 5).forEach((x) =>
    ig.body.append(uiRow(x.name, null, null, { value: de(x.kg) + " kg" })));
  c.append(ig);

  return c;
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
   5. Mehr
   ================================================================ */
function viewMehr(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* --- Darstellung --- */
  const look = uiGroup("Darstellung");
  look.body.append(uiRow("Erscheinungsbild", null,
    segmented([["system", "System"], ["hell", "Hell"], ["dunkel", "Dunkel"]], S.settings.theme,
      (v) => app.set((s) => { s.settings.theme = v; }), "Erscheinungsbild"), { stacked: true }));
  look.body.append(uiRow("Schriftgröße", null,
    segmented([[1, "Normal"], [1.15, "Groß"], [1.3, "Sehr groß"]], S.settings.textScale,
      (v) => app.set((s) => { s.settings.textScale = v; }), "Schriftgröße"), { stacked: true }));
  c.append(look);

  /* --- Rückblick --- */
  const rv = uiGroup("Wochenrückblick",
    "Der Rückblick erscheint ab Sonntagabend oben auf der Liste und bleibt bis Dienstag abrufbar.\n\n" +
    "Die Erinnerung ist ausdrücklich KEINE echte Push-Nachricht: ohne Server kann niemand die App von " +
    "außen wecken, und einen Server hat diese App bewusst nicht. Die Meldung erscheint deshalb beim " +
    "nächsten Öffnen, wenn der Rückblick fällig ist.");
  rv.body.append(uiRow("Erinnern", "beim nächsten Öffnen",
    toggle(!!S.review.notify, (on) => app.askNotify(on), "Erinnerung an den Wochenrückblick")));
  rv.body.append(uiRow("Diese Woche ansehen", null, null, { onClick: () => reviewSheet(ctx, app) }));
  c.append(rv);

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
  c.append(hh);

  /* --- Gangreihenfolge --- */
  const aisles = relevantAisles(ctx.aisleList, ctx.items);
  if (aisles.length > 1) {
    const g = uiGroup("Ladenweg" + (ctx.store ? ` · ${ctx.store}` : ""),
      "So läufst du im Ladenmodus durch den Markt. Die Reihenfolge wird je Markt gemerkt.");
    aisles.forEach((aisle, i) => {
      const r = el("div", "row");
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
    });
    c.append(g);
  }

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
    pg.body.append(uiRow("Alles zurückgegeben", `ältestes seit ${d.daysOpen} Tagen`, null, {
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
      "Verschwendung: strukturell, wenn Rhythmus > Haltbarkeit; Ausreißer bei Abstand > Haltbarkeit × 1,2.",
      "Budget: erst Verschwender halbieren, dann Süßes und Alkohol. Grundnahrung nie.",
      "Preis: Median der eigenen Kaufpreise, ab 8 % Abweichung gemeldet.",
      "Inflation: gewichteter Preisindex über Produkte aus beiden Zeiträumen.",
      "Haushaltsprodukte rechnen anders: sie verderben nicht, also entspricht die gekaufte Menge der verbrauchten. Statt eines Kaufrhythmus gilt eine Verbrauchsrate, skaliert mit der Haushaltsgröße hoch einem Exponenten je Produkt — Zahnpasta linear, Waschmittel degressiv, Allzweckreiniger gar nicht.",
      "Rate: Referenzwert als Prior, Beobachtung über ein 180-Tage-Fenster als Posterior, gewichtet mit min(Käufe, 6) gegen 2. Nach sechs Käufen bestimmt die Beobachtung drei Viertel.",
      "Austausch: Kaufdatum plus Intervall, ohne Verbrauchsmodell. Bei unregelmäßigem Kauf (Variationskoeffizient ab 0,35) sagt die App gar nichts statt etwas Falsches."
    ].join("\n\n"))
  }));

  const q = databaseQualityReport();
  m.body.append(uiRow("Datenbasis", `${q.total} Produkte · ${q.anteilGeschaetzt} % geschätzt`, null, {
    onClick: () => app.notice("Datenbasis, ungeschönt",
      `${q.total} Produkte, ${q.kategorien} Kategorien, ${q.aliasesTotal} Schreibweisen, ${q.nonFood} Non-Food.\n\n` +
      `regulatorisch: ${q.regulatorisch} — Verbrauchsdatum-Pflicht, rechtlich definiert (BZfE/BLE)\n` +
      `Leitlinie: ${q.leitlinie} — aus behördlicher Lagerempfehlung abgeleitet (BZfE/BLE)\n` +
      `Schätzwert: ${q.schaetzwert} — ohne amtliche Quelle, vor Produktivbetrieb prüfen\n\n` +
      `${q.anteilGeschaetzt} % der Haltbarkeitswerte sind Schätzungen. Das ist der ehrliche Preis für die Abdeckung von ${q.total} Produkten.\n\n` +
      `${q.safetyCritical} Produkte tragen ein Verbrauchsdatum — für sie schlägt die App nie eine Weiterverwendung vor.`)
  }));
  m.body.append(uiRow("Über", `Bauversion ${window.__BUILD__ || "dev"}`, null, {
    onClick: () => app.notice("Einkaufs-Anker",
      "Alle Zahlen werden im Browser gerechnet. Kein Server, kein Konto, keine Übertragung.\n\n" +
      "Quellen: BZfE/BLE „Haltbarkeit von Lebensmitteln\“ und „Lebensmittel richtig lagern\“ (20.02.2025), " +
      "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\“.")
  }));
  c.append(m);

  /* --- Daten --- */
  const dat = uiGroup("Daten",
    "Alles liegt im Speicher dieses Browsers. Browserdaten löschen löscht die App-Daten mit — deshalb die Sicherung.");
  dat.body.append(uiRow("Käufe", S.settings.demo ? "Beispieldaten" : null, null, { value: String(S.purchases.length) }));
  dat.body.append(uiRow("Bons", null, null, { value: String(S.receipts.length) }));
  dat.body.append(uiRow("Gelernte Schreibweisen", null, null, { value: String(Object.keys(S.aliases).length) }));
  c.append(dat);

  const actions = uiGroup();
  const exp = el("button", "row action");
  exp.append(el("div", "rowMain", '<div class="rowTitle">Sicherung herunterladen</div>'));
  exp.addEventListener("click", () => {
    const blob = new Blob([Data.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `einkaufsanker-${Data.today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast("Gesichert");
  });
  actions.body.append(exp);

  const impRow = el("label", "row action");
  impRow.append(el("div", "rowMain", '<div class="rowTitle">Sicherung einlesen</div>'));
  const impInput = el("input");
  impInput.type = "file"; impInput.accept = "application/json,.json";
  impInput.className = "hide";
  impInput.addEventListener("change", () => {
    const file = impInput.files && impInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { app.toast(`${Data.importJson(String(reader.result))} Käufe eingelesen`); }
      catch (e) { app.toast("Nicht lesbar"); console.error(e); }
    };
    reader.readAsText(file);
    impInput.value = "";
  });
  impRow.append(impInput);
  actions.body.append(impRow);

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

  return c;
}
