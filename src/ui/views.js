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

const REASONS = [
  { key: "have", label: "Hab noch" },
  { key: "consumed", label: "Verbraucht" },
  { key: "skip", label: "Diese Woche nicht" }
];

/* ---------- Bausteine im iOS-Stil ---------- */

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

  fact("Kategorie", p.category);
  fact("Rhythmus", r && r.rhythmDays ? `alle ${r.rhythmDays} Tage · Vertrauen ${pct(r.confidence)}` : "noch nicht gelernt");
  fact("Zuletzt", r && r.lastPurchaseDate ? deDate(r.lastPurchaseDate) : null);
  fact("Haltbarkeit", p.isFood
    ? `${p.shelfLifeDays} Tage${p.shelfLifeOpenedDays ? `, offen ${p.shelfLifeOpenedDays}` : ""}`
    : null);
  fact("Lagerort", p.storage !== "kein Lagerhinweis" ? p.storage : null);
  fact("Preis", pm
    ? `zuletzt ${eur(pm.last)} · üblich ${eur(pm.usual)} · Spanne ${eur(pm.lowest)}–${eur(pm.highest)}`
    : `üblich ${eur(p.typicalPrice)}`);
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
  body.append(facts);

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

  const list = uiGroup("Fällig",
    "Vorgeschlagen wird, was nach dem gelernten Rhythmus dran ist, zuzüglich der eingestellten Vorausschau.\n\n" +
    "Der Rechenweg jeder Position steht in ihrem Detail-Blatt — Zeile antippen.");

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

  const ul = el("ul", "items");
  if (!ctx.items.length) ul.append(el("li", "item", '<p class="empty">Nichts fällig.</p>'));
  ctx.items.forEach((it) => ul.append(listItem(it, ctx, app)));
  list.body.append(ul);

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
        `<div class="rowTitle">${esc(f.name)}: ${f.share === 0.5 ? "die Hälfte" : Math.round(f.share * 100) + " %"}</div>` +
        `<div class="rowSub">rettet ${eur(f.valueAtRisk)}</div>`));
      const done = el("button", "pillBtn", "Erledigt");
      done.addEventListener("click", () => app.dismiss("freeze", f.productId));
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

/** Ring mit der Vorrats-Reichweite. Antippen öffnet die Herleitung. */
function rangeHero(ctx, app) {
  const r = ctx.range;
  const days = Math.max(0, Math.round(r.days));
  const frac = Math.min(1, days / 7);
  const C = 2 * Math.PI * 31;
  const color = days <= 1 ? "var(--red)" : days <= 3 ? "var(--amber)" : "var(--accent)";

  const h = el("button", "hero");
  h.append(el("div", "heroRing",
    `<svg viewBox="0 0 74 74" aria-hidden="true">
       <circle cx="37" cy="37" r="31" fill="none" stroke="var(--fill)" stroke-width="7"/>
       <circle cx="37" cy="37" r="31" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
               stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/>
     </svg>
     <div class="val"><div class="n">${days}</div><div class="u">${days === 1 ? "Tag" : "Tage"}</div></div>`));

  const txt = el("div", "txt");
  txt.append(el("b", null, "Vorrat reicht"));
  txt.append(el("small", null, esc(r.limiting.slice(0, 2).map((x) => x.name).join(", "))));
  h.append(txt);
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

/** Eine Position der Vorschlagsliste. Knapp — Details im Blatt. */
function listItem(it, ctx, app) {
  const p = byId(it.productId) || {};
  const li = el("li", "item" + (it.on ? "" : " off"));

  const top = el("div", "top");
  const cb = el("input");
  cb.type = "checkbox"; cb.className = "box"; cb.checked = it.on;
  cb.setAttribute("aria-label", it.name);
  cb.addEventListener("change", () => app.choose(it.productId, { on: cb.checked, reason: cb.checked ? null : undefined }));

  const main = el("button", "main");
  main.setAttribute("aria-label", `Details zu ${it.name}`);
  const nm = el("div", "nm", esc(it.name));
  if (it.dueIn < 0) nm.append(el("span", "pill warn", `${-it.dueIn} T überfällig`));
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
  main.addEventListener("click", () => productSheet(it.productId, ctx));

  top.append(cb, main, el("div", "price", eur(it.halved ? it.price / 2 : it.price)));
  li.append(top);

  if (it.on && it.riskFlag) {
    const acts = el("div", "inlineActions");
    const h = el("button", "pillBtn" + (it.halved ? " on" : ""), it.halved ? "✓ halbe Menge" : "Halbe Menge");
    h.setAttribute("aria-pressed", it.halved ? "true" : "false");
    h.addEventListener("click", () => app.choose(it.productId, { halved: !it.halved }));
    acts.append(h);
    li.append(acts);
  }

  if (!it.on && (it.perishable || it.price > 3)) {
    const opts = el("div", "opts");
    REASONS.forEach((rr) => {
      const b = el("button", "opt", esc(rr.label));
      b.setAttribute("aria-pressed", it.reason === rr.key ? "true" : "false");
      b.addEventListener("click", () => app.choose(it.productId, { reason: rr.key }));
      opts.append(b);
    });
    li.append(opts);
  }
  return li;
}

/* ================================================================
   2. Bestand
   ================================================================ */
function viewBestand(ctx, app) {
  const c = frag();

  if (!ctx.inventory.length) {
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
      const undo = el("button", "pillBtn", "Weg");
      undo.setAttribute("aria-label", `${o.name} nicht mehr als angebrochen führen`);
      undo.addEventListener("click", () => { Data.toggleOpened(o.productId); app.toast("Entfernt"); });
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

  /* --- Rezepte --- */
  const rec = suggestRecipes(toRecipeStock(ctx.inventory), { maxResults: 5 });
  const g = uiGroup("Kochen", "Sortiert nach gerettetem Betrag, nicht nach Geschmack. Bewusst ohne Nährwerte.");
  (rec.unsafeIngredients || []).forEach((u) => g.body.append(uiRow(u.message, null, el("span", "flag f-miss", "!"))));
  if (!rec.length) g.body.append(el("p", "empty", "Kein passendes Rezept."));
  rec.forEach((x) => g.body.append(uiRow(x.name,
    `${x.minutes} Min${x.complete ? "" : " · fehlt: " + x.missing.join(", ")}`, null, {
      value: x.rescuedValue > 0 ? eur(x.rescuedValue) : "",
      onClick: () => app.notice(x.name,
        `${x.minutes} Minuten.\n\nNutzt aus deinem Bestand: ${x.usesFromStock.join(", ") || "—"}` +
        (x.complete ? "" : `\n\nFehlt: ${x.missing.join(", ")}`))
    })));
  c.append(g);

  /* --- Einräumen --- */
  const guide = buildStorageGuide(ctx.items.filter((i) => i.on));
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
    const n = Data.addReceipt({ date: cap.date, store: cap.store, items: p.rows });
    cap.parsed = null; cap.text = "";
    app.toast(`${n} gebucht`);
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
    const n = Data.addReceipt({ date: di.value, store: si.value.trim() || "Unbekannt", items: cap.basket });
    cap.basket = [];
    app.toast(`${n} gebucht`);
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
  s.append(tile("Ø pro Woche", eur(t.spendPerWeek), `${t.receipts} Bons`));
  s.append(tile("zu holen", eur(savingsTotal), "ohne Verzicht", "good"));
  s.append(tile("Verlust", eur(t.wastedPerWeek), `${de(ctx.impact.kg)} kg gesamt`, "warn"));
  s.append(tile("Rhythmen", String([...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length),
    `von ${ctx.rhythms.size}`));
  c.append(s);

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
      `<text x="${pad.l - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" opacity=".5">${tv.toFixed(0)}</text>`;
  });
  months.forEach((m, i) => {
    const x = pad.l + i * bw + bw * 0.26, w = bw * 0.48;
    const top = y(m[1]), base = y(0);
    bars += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(base - top).toFixed(1)}" fill="var(--accent)" rx="5"/>` +
      `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2, (base - top) * wasteShare).toFixed(1)}" fill="var(--red)" rx="5"/>` +
      `<text x="${(x + w / 2).toFixed(1)}" y="${H - pad.b + 17}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".5">${m[0].slice(5)}</text>`;
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
      "Bonzeile → Produkt: Alias-Tabelle, sonst Token- und Levenshtein-Vergleich. 65–85 % werden gefragt statt geraten.",
      "Rhythmus: Median der Kaufabstände je Einheit. Pausen über dem Dreifachen ausgeschlossen.",
      "Vertrauen: Datenpunkte × (1 − robuste Streuung), MAD statt Standardabweichung.",
      "Bestand: gekauft − (Tage seit Kauf ÷ Verbrauch je Einheit).",
      "Reichweite: kleinerer Wert aus Restmenge × Verbrauch und verbleibender Haltbarkeit.",
      "Verschwendung: strukturell, wenn Rhythmus > Haltbarkeit; Ausreißer bei Abstand > Haltbarkeit × 1,2.",
      "Budget: erst Verschwender halbieren, dann Süßes und Alkohol. Grundnahrung nie.",
      "Preis: Median der eigenen Kaufpreise, ab 8 % Abweichung gemeldet.",
      "Inflation: gewichteter Preisindex über Produkte aus beiden Zeiträumen."
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
      "Quellen: BZfE/BLE „Haltbarkeit von Lebensmitteln\" und „Lebensmittel richtig lagern\" (20.02.2025), " +
      "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\".")
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
