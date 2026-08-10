/* ================================================================
   views.js — die einzelnen Ansichten.
   Enthält KEINE Fachlogik: jede Zahl kommt aus Data.compute(), das
   wiederum ausschließlich die gebündelten Module aufruft.
   ================================================================ */

/* ---------- kleine Helfer ---------- */
const eur = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";
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
  { key: "have", label: "Hab noch da", hint: "wird bis zum Ablauf beobachtet" },
  { key: "consumed", label: "Verbraucht", hint: "keine Erinnerung, Rhythmus bleibt" },
  { key: "skip", label: "Nicht diese Woche", hint: "Rhythmus pausiert" }
];

/* ---------- Bausteine im iOS-Stil ---------- */

/** Gruppierte Liste: Überschrift, Körper, Fußnote.
    Heißt nicht `group` — diesen Namen vergibt bereits foodDatabase.js
    im Bündel, und beide teilen sich denselben Namensraum. */
function uiGroup(title, note) {
  const g = el("div", "group");
  if (title) g.append(el("div", "groupTitle", esc(title)));
  const body = el("div", "groupBody");
  g.append(body);
  if (note) g.append(el("div", "groupNote", note));
  g.body = body;
  return g;
}

/** Eine Zeile darin. `control` steht rechts. */
function uiRow(title, sub, control, opts = {}) {
  const r = el(opts.onClick ? "button" : "div", "row");
  const main = el("div", "rowMain");
  main.append(el("div", "rowTitle", esc(title)));
  if (sub) main.append(el("div", "rowSub", esc(sub)));
  r.append(main);
  if (control) r.append(control);
  if (opts.value !== undefined) r.append(el("div", "rowValue", esc(opts.value)));
  if (opts.onClick) { r.append(el("div", "chev")); r.addEventListener("click", opts.onClick); }
  if (opts.stacked) r.classList.add("stacked");
  return r;
}

function card(title, statText) {
  const c = el("div", "card");
  if (title) c.append(el("div", "headrow", `<h2>${esc(title)}</h2>${statText ? `<div class="stat">${esc(statText)}</div>` : ""}`));
  return c;
}

function stepper(value, format, onChange, { min = 0, max = Infinity, step = 1 } = {}) {
  const wrap = el("div", null);
  wrap.style.cssText = "display:flex;align-items:center;gap:10px;flex:0 0 auto";
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

function tableCard(c, head, rows) {
  const wrap = el("div", "tableWrap");
  wrap.innerHTML =
    `<table><thead><tr>${head.map((h) => `<th${h.num ? ' class="num"' : ""}>${esc(h.t)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`;
  c.append(wrap);
  return wrap;
}

function tile(label, value, note, cls) {
  return el("div", "tile",
    `<div class="l">${esc(label)}</div><div class="v ${cls || ""}">${esc(value)}</div>` +
    (note ? `<div class="t">${esc(note)}</div>` : ""));
}

/* ================================================================
   1. Liste
   ================================================================ */
function viewListe(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* --- Datenlage zu dünn --- */
  if (ctx.stage.stage <= 1) {
    const first = card("Noch keine Vorschläge", ctx.stage.label);
    first.append(el("p", "sub", ctx.stage.hint ||
      "Vorschläge entstehen aus wiederholten Käufen. Zwei Bons je Produkt genügen für den ersten Rhythmus."));

    if (ctx.history.length) {
      const last = ctx.history[ctx.history.length - 1].date;
      const ins = firstReceiptInsights(ctx.history.filter((h) => h.date === last));
      first.append(el("div", "note green",
        `<b>${eur(ins.total)}</b> im letzten Einkauf, ${ins.positions} Positionen. ` +
        `Aufs Jahr hochgerechnet wären das <b>${ins.yearProjection} €</b>, wenn das dein Wochenschnitt ist.`));
      tableCard(first, [{ t: "Kategorie" }, { t: "Ausgabe", num: true }, { t: "Anteil", num: true }],
        ins.categories.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${eur(x.spend)}</td><td class="num">${de(x.share)} %</td></tr>`));
      first.append(el("p", "srcnote", ins.hint));
    }

    const go = el("button", "cta", "Einkauf erfassen");
    go.addEventListener("click", () => app.goto("erfassen"));
    first.append(go);

    if (!ctx.history.length) {
      const demo = el("button", "cta light", "Beispieldaten laden");
      demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Beispielhistorie geladen"); });
      first.append(demo);
    }
    c.append(first);
    return c;
  }

  /* --- Vorrats-Reichweite: die Frage vor dem Einkauf --- */
  if (ctx.range.days !== null) c.append(rangeHero(ctx));

  /* --- Sicherheitswarnung: kurz, oben, nicht wegklickbar --- */
  if (ctx.safety) {
    const g = uiGroup("Sicherheit");
    const r = el("div", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(ctx.safety.short)}</div>` +
      `<div class="rowSub">Verbrauchsdatum: nach Ablauf in den Müll, auch wenn nichts auffällt.</div>`));
    r.append(el("span", "flag f-miss", "kühlen"));
    g.body.append(r);
    g.append(el("div", "groupNote", esc("Quelle: " + ctx.safety.source)));
    c.append(g);
  }

  /* --- Die Liste --- */
  const listGroup = uiGroup("Vorschlag für heute", esc(
    ctx.budgetResult.removed.length
      ? `${ctx.budgetResult.advice} Gestrichen: ${ctx.budgetResult.removed.map((r) => r.name).join(", ")}. Brot, Milch und Eier bleiben immer.`
      : "Jede Position ist berechnet. Der Rechenweg steht unter jeder Zeile."));

  if (ctx.vacation && ctx.vacation.skip.length) {
    const n = el("div", "note blue");
    n.style.margin = "0";
    n.innerHTML = `<b>Urlaubsmodus:</b> ${ctx.vacation.skip.length} Frischeposition(en) zurückgestellt — ` +
      `${eur(ctx.vacation.savedEuros)} gespart. ${esc(ctx.vacation.skip.map((s) => s.name).join(", "))}`;
    listGroup.body.append(n);
  }

  const ul = el("ul", "items");
  if (!ctx.items.length) ul.append(el("li", "item", '<p class="empty">Diese Woche ist nichts fällig. Alles im Rhythmus.</p>'));
  ctx.items.forEach((it) => ul.append(listItem(it, ctx, app)));
  listGroup.body.append(ul);

  const on = ctx.items.filter((i) => i.on);
  const sumOn = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
  const full = ctx.items.reduce((a, i) => a + i.price, 0);
  const tot = el("div", "totals");
  tot.innerHTML =
    `<div><div class="l">${on.length} Positionen</div><div class="big">${eur(sumOn)}</div></div>` +
    `<div class="saved">${full > sumOn ? "− " + eur(full - sumOn) + " gegenüber allem" : ""}</div>`;
  listGroup.body.append(tot);
  c.append(listGroup);

  const cta = el("button", "cta", "Einkaufen starten");
  cta.disabled = !on.length;
  cta.addEventListener("click", () => app.openStore());
  c.append(cta);

  /* --- Vergessens-Detektor --- */
  if (ctx.forgotten.length) {
    const g = uiGroup("Fehlt dir das?", "Produkte, die deutlich über ihrem Rhythmus liegen und nicht auf der Liste stehen.");
    ctx.forgotten.slice(0, 5).forEach((f) => {
      const r = el("div", "row");
      const main = el("div", "rowMain");
      main.append(el("div", "rowTitle", esc(f.name)));
      main.append(el("div", "rowSub", esc(`zuletzt vor ${f.daysSince} Tagen · sonst alle ${f.rhythmDays} Tage`)));
      r.append(main);

      const add = el("button", "pillBtn", "Dazu");
      add.addEventListener("click", () => { app.addToList(f.productId); app.toast(`${f.name} auf der Liste`); });
      const no = el("button", "pillBtn", "Nein");
      no.setAttribute("aria-label", `${f.name} nicht mehr vorschlagen`);
      no.addEventListener("click", () => app.dismiss("forgotten", f.productId));
      const acts = el("div");
      acts.style.cssText = "display:flex;gap:7px;flex:0 0 auto";
      acts.append(add, no);
      r.append(acts);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Einfrier-Empfehlungen --- */
  if (ctx.freeze.length) {
    const g = uiGroup("Gleich einfrieren", "Nur, wo die gekaufte Menge die Haltbarkeit überschreitet.");
    ctx.freeze.slice(0, 4).forEach((f) => {
      const r = el("div", "row");
      const main = el("div", "rowMain");
      main.append(el("div", "rowTitle", esc(f.name)));
      main.append(el("div", "rowSub", esc(f.message)));
      r.append(main);
      const done = el("button", "pillBtn", "Erledigt");
      done.addEventListener("click", () => app.dismiss("freeze", f.productId));
      r.append(done);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Lagerhinweis --- */
  if (ctx.ethylene) {
    const g = uiGroup("Lagerhinweis", esc("Quelle: " + ctx.ethylene.source));
    const n = el("div", "note gold");
    n.style.margin = "0";
    n.innerHTML = `<b>${esc(ctx.ethylene.message)}</b>`;
    g.body.append(n);
    c.append(g);
  }

  /* --- Einstellungen dieser Woche --- */
  const set = uiGroup("Diese Woche");
  const rest = S.settings.budget - sumOn;
  set.body.append(uiRow("Wochenbudget",
    S.settings.budget ? (rest >= 0 ? `noch ${eur(rest)} Luft` : `${eur(-rest)} darüber`) : "kein Deckel gesetzt",
    stepper(S.settings.budget, (v) => (v ? eur(v) : "aus"),
      (v) => app.set((s) => { s.settings.budget = v; }), { min: 0, max: 400, step: 5 })));
  set.body.append(uiRow("Personen im Haushalt", "skaliert alle Mengen",
    stepper(S.settings.household, String,
      (v) => app.set((s) => { s.settings.household = v; }), { min: 1, max: 8, step: 1 })));
  set.body.append(uiRow("Vorausschau", "wie viele Tage der Einkauf mitabdecken soll",
    stepper(S.settings.lookaheadDays, (v) => (v ? `${v} Tage` : "nur fällig"),
      (v) => app.set((s) => { s.settings.lookaheadDays = v; }), { min: 0, max: 7, step: 1 })));

  const v = S.settings.vacation;
  set.body.append(uiRow("Urlaubsmodus",
    v.active && v.from ? `${deDate(v.from)} bis ${deDate(v.to)}` : "hält Frischware vor der Abreise zurück",
    toggle(v.active, (onOff) => app.set((s) => {
      s.settings.vacation.active = onOff;
      if (onOff && !s.settings.vacation.from) {
        s.settings.vacation.from = Data.plusDays(Data.today(), 2);
        s.settings.vacation.to = Data.plusDays(Data.today(), 16);
      }
    }), "Urlaubsmodus")));

  if (v.active) {
    const f = el("div");
    f.style.cssText = "padding:12px 16px;display:flex;gap:10px";
    [["from", "Abreise"], ["to", "Rückkehr"]].forEach(([key, label]) => {
      const w = el("label", "field", `<span class="lbl">${label}</span>`);
      w.style.margin = "0";
      w.style.flex = "1";
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

/** Ring mit der Vorrats-Reichweite. */
function rangeHero(ctx) {
  const r = ctx.range;
  const days = Math.max(0, Math.round(r.days));
  const full = 7;                                   // Ring füllt sich über eine Woche
  const frac = Math.min(1, days / full);
  const C = 2 * Math.PI * 31;
  const color = days <= 1 ? "var(--red)" : days <= 3 ? "var(--amber)" : "var(--accent)";

  const h = el("div", "hero");
  h.append(el("div", "heroRing",
    `<svg viewBox="0 0 74 74" aria-hidden="true">
       <circle cx="37" cy="37" r="31" fill="none" stroke="var(--fill)" stroke-width="7"/>
       <circle cx="37" cy="37" r="31" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
               stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/>
     </svg>
     <div class="val"><div class="n">${days}</div><div class="u">${days === 1 ? "Tag" : "Tage"}</div></div>`));

  const txt = el("div", "txt");
  txt.append(el("b", null, "Vorrat reicht noch"));
  txt.append(el("small", null, esc(r.message) +
    ` Geschätzt aus Bestand und Verbrauch, Sicherheit ${pct(r.confidence)}.`));
  h.append(txt);
  return h;
}

/** Eine Position der Vorschlagsliste. */
function listItem(it, ctx, app) {
  const p = byId(it.productId) || {};
  const li = el("li", "item" + (it.on ? "" : " off"));

  const top = el("div", "top");
  const cb = el("input");
  cb.type = "checkbox"; cb.className = "box"; cb.checked = it.on;
  cb.setAttribute("aria-label", it.name + " auf die Liste");
  cb.addEventListener("change", () => app.choose(it.productId, { on: cb.checked, reason: cb.checked ? null : undefined }));

  const main = el("div", "main");
  const nm = el("div", "nm", esc(it.name));
  // Bewusst wenige Marken je Zeile: der Rhythmus steht ohnehin im
  // Rechenweg darunter, und drei gestapelte Pillen lesen sich als Lärm.
  if (it.dueIn !== undefined && it.dueIn < 0) nm.append(el("span", "pill warn", `${-it.dueIn} Tage überfällig`));
  else if (it.dueIn > 0) nm.append(el("span", "pill", `in ${it.dueIn} Tagen`));
  if (it.basis === "annahme") nm.append(el("span", "pill warn", "Annahme"));
  if (it.riskFlag) nm.append(el("span", "pill risk", `${pct(it.wasteRate)} bleibt übrig`));
  if (p.safetyCritical) nm.append(el("span", "pill safety", "Verbrauchsdatum"));

  // Preis-Gedächtnis: nur melden, wenn es abweicht.
  const pm = ctx.prices.get(it.productId);
  if (pm && pm.verdict !== "üblich") {
    nm.append(el("span", "pill " + (pm.verdict === "günstig" ? "cheap" : "warn"),
      pm.verdict === "günstig" ? `sonst ${eur(pm.usual)}` : `sonst nur ${eur(pm.usual)}`));
  }

  const dup = ctx.duplicates.find((d) => d.productId === it.productId);
  if (dup) nm.append(el("span", "pill dup", dup.level === "info" ? "doppelt?" : "kürzlich gekauft"));
  if (!it.on && it.reason) {
    const rr = REASONS.find((x) => x.key === it.reason);
    if (rr) nm.append(el("span", "pill state", rr.label));
  }
  main.append(nm);

  const up = unitPrice({ productId: it.productId, unitPrice: p.typicalPrice, quantity: 1 });
  const price = el("div", "price",
    eur(it.halved ? it.price / 2 : it.price) + (up ? `<small>${esc(up.display)}</small>` : ""));

  top.append(cb, main, price);
  li.append(top);

  li.append(el("div", "calc", it.basis === "annahme"
    ? `Kategorie-Annahme ${it.rhythmDays} Tage · noch keine eigene Historie`
    : `zuletzt vor ${it.daysSince} Tagen · Rhythmus ${it.rhythmDays} Tage · Vertrauen ${pct(it.confidence)}`));

  const why = el("div", "why");
  if (dup) why.append(el("div", "note blue", esc(dup.message)));

  if (it.on && it.riskFlag) {
    const w = buildExpiryWarning(it.productId, it.name, it.price, ctx.wasteStats.get(it.productId));
    if (w) {
      const n = el("div", "note gold", `<b>${esc(w.message)}</b>`);
      const h = el("button", "pillBtn" + (it.halved ? " on" : ""), it.halved ? "✓ halbe Menge" : "Halbe Menge");
      h.setAttribute("aria-pressed", it.halved ? "true" : "false");
      h.style.marginTop = "9px";
      h.addEventListener("click", () => app.choose(it.productId, { halved: !it.halved }));
      n.append(el("div"), h);
      why.append(n);
    }
  }
  if (why.childNodes.length) li.append(why);

  if (!it.on && (it.perishable || it.price > 3)) {
    const box = el("div", "reasons");
    box.append(el("div", "q", "Warum nicht?"));
    const opts = el("div", "opts");
    REASONS.forEach((rr) => {
      const b = el("button", "opt", `<span>${rr.label}</span><small>${rr.hint}</small>`);
      b.setAttribute("aria-pressed", it.reason === rr.key ? "true" : "false");
      b.addEventListener("click", () => app.choose(it.productId, { reason: rr.key }));
      opts.append(b);
    });
    box.append(opts);
    if (it.reason === "have") box.append(el("div", "out watch", `Beobachtet: <b>${esc(it.name)}</b> hält typischerweise ${it.shelfLifeDays} Tage.`));
    if (it.reason === "consumed") box.append(el("div", "out", `Als verbraucht notiert. Rhythmus bleibt bei ${it.rhythmDays} Tagen.`));
    if (it.reason === "skip") box.append(el("div", "out", "Übersprungen. Der Rhythmus pausiert."));
    li.append(box);
  }
  return li;
}

/* ================================================================
   2. Bestand und Rezepte
   ================================================================ */
function viewBestand(ctx, app) {
  const c = frag();

  if (ctx.range.days !== null) c.append(rangeHero(ctx));

  const inv = uiGroup("Vermutlich noch da",
    "Geschätzt aus Einkauf minus Verbrauch — ohne dass du etwas pflegst. Deshalb mit Sicherheitsangabe.");

  if (!ctx.inventory.length) {
    inv.body.append(el("p", "empty", "Kein Bestand schätzbar. Dafür braucht es mindestens zwei Käufe je Produkt."));
  } else {
    ctx.inventory.slice(0, 20).forEach((i) => {
      const p = byId(i.productId) || {};
      // Haltbarkeit in Tagen ist nur für Frisches eine Aussage.
      // „3640 Tage" bei Klopapier ist richtig gerechnet und wertlos.
      const longLived = !p.isFood || i.daysLeft > 120;
      const range = ctx.range.byProduct.find((x) => x.productId === i.productId);

      const r = el("div", "row");
      const main = el("div", "rowMain");
      main.append(el("div", "rowTitle", esc(i.name)));
      const parts = [`${i.remainingUnits.toFixed(1).replace(".", ",")} übrig`, `Sicherheit ${pct(i.confidence)}`];
      if (range) parts.push(range.limitedBy === "frische" ? "Frische begrenzt" : "Menge begrenzt");
      main.append(el("div", "rowSub", parts.join(" · ")));
      r.append(main);

      const flagCls = i.daysLeft <= 2 ? "f-miss" : i.daysLeft <= 5 ? "f-gold" : "f-ok";
      const right = el("div");
      right.style.cssText = "display:flex;align-items:center;gap:10px;flex:0 0 auto";
      right.append(el("span", "flag " + (longLived ? "f-ok" : flagCls), longLived ? "unkritisch" : `${i.daysLeft} T`));
      right.append(el("span", "rowValue", eur(i.value)));
      r.append(right);
      inv.body.append(r);
    });
  }
  c.append(inv);

  /* --- Rezepte aus dem Bestand --- */
  const stock = toRecipeStock(ctx.inventory);
  const rec = suggestRecipes(stock, { maxResults: 5 });
  const r = card("Koch das, bevor es schlecht wird");
  r.append(el("p", "sub", "Sortiert nach gerettetem Betrag, nicht nach Geschmack. Bewusst ohne Nährwerte."));
  (rec.unsafeIngredients || []).forEach((u) => r.append(el("div", "note red", `<b>${esc(u.message)}</b>`)));
  const rl = el("ul", "plain");
  if (!rec.length) rl.append(el("li", null, '<span class="empty">Kein passendes Rezept im Bestand.</span>'));
  rec.forEach((x) => rl.append(el("li", null,
    `<span class="flag ${x.rescuedValue > 0 ? "f-ok" : "f-new"}">${x.rescuedValue > 0 ? eur(x.rescuedValue) : x.minutes + " Min"}</span>` +
    `<span><b>${esc(x.name)}</b> · ${x.minutes} Min${x.complete ? "" : " · fehlt: " + esc(x.missing.join(", "))}<br>` +
    `<small style="color:var(--ink-2)">nutzt: ${esc(x.usesFromStock.join(", ")) || "—"}</small></span>`)));
  r.append(rl);
  c.append(r);

  /* --- Einräumhilfe --- */
  const guide = buildStorageGuide(ctx.items.filter((i) => i.on));
  if (guide.length) {
    const g = card("Einräumen nach Kühlzonen");
    g.append(el("p", "sub", "Reihenfolge nach der Kühlschrankgrafik des BZfE: das Kritischste zuerst."));
    const gl = el("ul", "plain");
    guide.forEach((z) => gl.append(el("li", null,
      `<span class="flag f-new">${esc(z.zone.split("(")[0].trim())}</span><span>${esc(z.items.map((i) => i.name).join(", "))}</span>`)));
    g.append(gl);
    c.append(g);
  }

  /* --- Urlaubs-Aufbrauchplan --- */
  const S = Data.get();
  if (S.settings.vacation.active && S.settings.vacation.from) {
    const v = S.settings.vacation;
    const plan = useUpPlan(ctx.inventory, v.from, v.to, ctx.ref);
    const p = card("Vor der Abreise", `${plan.daysUntilDeparture} Tage`);
    p.append(el("p", "sub", esc(plan.summary)));
    const pl = el("ul", "plain");
    plan.mustUse.forEach((x) => pl.append(el("li", null, `<span class="flag f-gold">aufbrauchen</span><span>${esc(x.hint)}</span>`)));
    plan.freeze.forEach((x) => pl.append(el("li", null, `<span class="flag f-new">einfrieren</span><span>${esc(x.hint)}</span>`)));
    if (!pl.childNodes.length) pl.append(el("li", null, '<span class="empty">Nichts, was die Reise nicht übersteht.</span>'));
    p.append(pl);
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
  tabs.append(segmented([["scan", "Bon einlesen"], ["manual", "Von Hand"]], cap.tab,
    (k) => { cap.tab = k; app.render(); }, "Erfassungsart"));
  c.append(tabs);

  const box = card();
  if (cap.tab === "scan") renderScan(box, cap, app);
  else renderManual(box, cap, app);
  c.append(box);

  /* --- Bisher erfasste Bons --- */
  const S = Data.get();
  if (S.receipts.length) {
    const g = uiGroup("Erfasste Bons", `${S.receipts.length} gesamt`);
    [...S.receipts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).forEach((rec) => {
      const r = el("div", "row");
      const main = el("div", "rowMain");
      main.append(el("div", "rowTitle", esc(rec.store)));
      main.append(el("div", "rowSub", `${deDate(rec.date)} · ${rec.itemCount} Positionen`));
      r.append(main);
      r.append(el("div", "rowValue", eur(rec.total)));
      const del = el("button", "del", "×");
      del.setAttribute("aria-label", `Bon vom ${deDate(rec.date)} löschen`);
      del.addEventListener("click", () => app.confirm(
        "Bon löschen?",
        `${rec.store} vom ${deDate(rec.date)} — alle Positionen dieses Tages werden aus der Historie entfernt.`,
        () => { Data.removeReceipt(rec.id); app.toast("Bon gelöscht"); }
      ));
      r.append(del);
      g.body.append(r);
    });
    c.append(g);
  }
  return c;
}

function renderScan(box, cap, app) {
  box.append(el("p", "sub",
    "Bon-Text hier einfügen — aus der eBon-App, einer PDF oder abgetippt. Der Parser ist an einem echten Lidl-Bon geprüft; andere Märkte folgen demselben Aufbau."));

  const ta = el("textarea");
  ta.value = cap.text || "";
  ta.placeholder = "Vollmilch 3,5%          1,29 A\nNaturjoghurt        0,55 x  2   1,10 A\n  Lidl Plus Rabatt          -0,20\nHähnchenbrust           4,58 A\n  0,199 kg x 22,99 EUR/kg";
  ta.setAttribute("aria-label", "Bon-Text");
  ta.addEventListener("input", () => { cap.text = ta.value; });
  const f = el("label", "field", '<span class="lbl">Bon-Text</span>');
  f.append(ta);
  box.append(f);

  const meta = el("div", "row2");
  const df = el("label", "field", '<span class="lbl">Datum</span>');
  const di = el("input"); di.type = "date"; di.value = cap.date || Data.today();
  di.addEventListener("change", () => { cap.date = di.value; });
  df.append(di);
  const sf = el("label", "field", '<span class="lbl">Markt</span>');
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = "z. B. Lidl";
  si.addEventListener("input", () => { cap.store = si.value; });
  sf.append(si);
  meta.append(df, sf);
  box.append(meta);

  const go = el("button", "cta", "Auswerten");
  go.addEventListener("click", () => {
    const text = (cap.text || "").trim();
    if (!text) { app.toast("Kein Text eingegeben"); return; }
    try {
      cap.parsed = Data.parseReceiptText(text);
      cap.date = di.value;
      cap.store = si.value.trim() || "Unbekannt";
      if (!cap.parsed.rows.length) app.toast("Keine Positionen erkannt");
    } catch (e) {
      app.toast("Bon nicht lesbar");
      console.error(e);
    }
    app.render();
  });
  box.append(go);

  if (!cap.parsed) return;

  const p = cap.parsed;
  box.append(el("div", "note " + (p.open ? "gold" : "green"),
    `<b>${p.rows.length} Positionen erkannt.</b> ${p.sure} sicher zugeordnet` +
    (p.open ? `, <b>${p.open} brauchen eine Antwort</b> — sonst entstehen falsche Rhythmen.` : ".") +
    (p.discountTotal ? ` Rabatte: ${eur(p.discountTotal)}.` : "")));
  p.warnings.forEach((w) => box.append(el("div", "note red", esc(w))));

  const rows = el("div");
  p.rows.forEach((rowData, idx) => {
    const r = el("div", "matchRow");
    const left = el("div", "raw");
    left.append(el("div", "r", esc(rowData.raw)));
    left.append(el("div", "n", rowData.productName ? esc(rowData.productName) : "— nicht zugeordnet —"));

    if (rowData.needsConfirmation) {
      const sel = el("select");
      sel.setAttribute("aria-label", `Zuordnung für ${rowData.raw}`);
      const pool = new Map();
      if (rowData.productId && byId(rowData.productId)) pool.set(rowData.productId, byId(rowData.productId));
      Data.searchProducts(rowData.raw.split(/\s+/)[0] || "", 8).forEach((x) => pool.set(x.id, x));
      FOOD_DATABASE.forEach((x) => { if (!pool.has(x.id)) pool.set(x.id, x); });
      sel.innerHTML = `<option value="">— nicht buchen —</option>` +
        [...pool.values()].map((x) => `<option value="${x.id}">${esc(x.name)} · ${esc(x.category)}</option>`).join("");
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
      left.append(el("div", "r", rowData.confidence
        ? `bester Treffer ${pct(rowData.confidence)} — unter der Schwelle, deshalb die Frage`
        : "kein Treffer im Katalog"));
    } else {
      left.append(el("div", "r", `${esc(rowData.method)} · ${pct(rowData.confidence)}`));
    }

    r.append(left, el("div", "amt",
      `${eur(rowData.unitPrice * rowData.quantity)}<small>${rowData.quantity}× ${eur(rowData.unitPrice)}</small>`));
    rows.append(r);
  });
  box.append(rows);

  if (p.deposits.length) {
    box.append(el("p", "srcnote",
      `${p.deposits.length} Pfandzeile(n) erkannt und getrennt gebucht — Pfand ist kein Lebensmittel.`));
  }

  const save = el("button", "cta", `${p.rows.filter((r) => r.productId).length} Positionen übernehmen`);
  save.disabled = !p.rows.some((r) => r.productId);
  save.addEventListener("click", () => {
    p.rows.forEach((r) => { if (r.learn && r.productId) Data.learnAlias(r.raw, r.productId); });
    const n = Data.addReceipt({ date: cap.date, store: cap.store, items: p.rows });
    cap.parsed = null; cap.text = "";
    app.toast(`${n} Positionen gebucht`);
    app.goto("liste");
  });
  box.append(save);
}

function renderManual(box, cap, app) {
  box.append(el("p", "sub",
    "Produkt suchen, Menge und Preis prüfen, in den Korb legen. Der Preis kommt aus dem Katalog und lässt sich überschreiben."));

  const f = el("label", "field", '<span class="lbl">Produkt suchen</span>');
  const inp = el("input");
  inp.type = "search";
  inp.placeholder = "z. B. Milch, Joghurt, Klopapier";
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
    if (!hits.length) {
      results.append(el("li", null, '<div style="padding:13px 14px;font-size:15px;color:var(--ink-2)">Nichts gefunden.</div>'));
      return;
    }
    hits.forEach((p) => {
      const li = el("li");
      const b = el("button", null,
        `<span class="rn">${esc(p.name)}</span><span class="rc">${esc(p.category)} · ${eur(p.typicalPrice)}</span>`);
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

  box.append(el("h3", null, "Korb"));
  const ul = el("ul", "basket");
  cap.basket.forEach((b, i) => {
    const li = el("li");
    li.append(el("span", "bn", esc(b.name)));
    li.append(stepper(b.quantity, String, (v) => { cap.basket[i].quantity = v; app.render(); }, { min: 1, max: 99, step: 1 }));

    const pi = el("input");
    pi.type = "number"; pi.step = "0.01"; pi.min = "0"; pi.value = b.unitPrice.toFixed(2);
    pi.setAttribute("aria-label", `Preis für ${b.name}`);
    pi.style.cssText = "width:88px;padding:9px;border:none;border-radius:9px;background:var(--surface-2);text-align:right";
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
  const tot = el("div", "totals");
  tot.style.padding = "14px 0 0";
  tot.innerHTML = `<div><div class="l">${cap.basket.length} Positionen</div><div class="big">${eur(total)}</div></div>`;
  box.append(tot);

  const meta = el("div", "row2");
  const df = el("label", "field", '<span class="lbl">Datum</span>');
  const di = el("input"); di.type = "date"; di.value = cap.date || Data.today();
  di.addEventListener("change", () => { cap.date = di.value; });
  df.append(di);
  const sf = el("label", "field", '<span class="lbl">Markt</span>');
  const si = el("input"); si.type = "text"; si.value = cap.store || ""; si.placeholder = "z. B. REWE";
  si.addEventListener("input", () => { cap.store = si.value; });
  sf.append(si);
  meta.append(df, sf);
  box.append(meta);

  const save = el("button", "cta", "Einkauf buchen");
  save.addEventListener("click", () => {
    const n = Data.addReceipt({ date: di.value, store: si.value.trim() || "Unbekannt", items: cap.basket });
    cap.basket = [];
    app.toast(`${n} Positionen gebucht`);
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
    const e = card("Noch keine Zahlen");
    e.append(el("p", "sub", "Sobald der erste Einkauf erfasst ist, stehen hier Ausgaben, Verlust und persönliche Inflation."));
    const go = el("button", "cta", "Einkauf erfassen");
    go.addEventListener("click", () => app.goto("erfassen"));
    e.append(go);
    c.append(e);
    return c;
  }

  const savingsTotal = ctx.savings.reduce((a, x) => a + x.estimatedWeeklySaving, 0);
  const s = el("div", "scroller");
  s.append(tile("Ø pro Woche", eur(t.spendPerWeek), `aus ${t.receipts} Bons`));
  s.append(tile("zu holen", eur(savingsTotal), "pro Woche, ohne Verzicht", "good"));
  s.append(tile("Verlust geschätzt", eur(t.wastedPerWeek), `${ctx.impact.kg} kg gesamt`, "warn"));
  s.append(tile("Rhythmen", String([...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length),
    `von ${ctx.rhythms.size} Produkten`));
  c.append(s);

  c.append(chartCard(ctx));

  if (ctx.inflation && ctx.inflation.productsCompared) {
    const inf = ctx.inflation;
    const ic = card("Deine persönliche Inflation", `${inf.productsCompared} Produkte verglichen`);
    ic.append(el("p", "sub",
      `Dein Warenkorb heute gegenüber dem Anfang der Historie: <b style="font-size:19px">${sign(inf.changePercent)} %</b>`));
    if (inf.biggestIncreases.length) {
      tableCard(ic, [{ t: "Produkt" }, { t: "vorher", num: true }, { t: "jetzt", num: true }, { t: "Änderung", num: true }],
        inf.biggestIncreases.map((i) =>
          `<tr><td>${esc(i.name)}</td><td class="num">${eur(i.basePrice)}</td><td class="num">${eur(i.currentPrice)}</td>` +
          `<td class="num" style="color:${i.changePercent > 0 ? "var(--red)" : "var(--green)"}">${sign(i.changePercent)} %</td></tr>`));
    }
    ic.append(el("p", "srcnote", esc(inf.caveat)));
    c.append(ic);
  }

  /* --- Preis-Gedächtnis --- */
  if (ctx.prices.size) {
    const notable = [...ctx.prices.values()]
      .filter((m) => m.verdict !== "üblich")
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    const pc = card("Preis-Gedächtnis", `${ctx.prices.size} Produkte`);
    pc.append(el("p", "sub",
      "Was du zuletzt gezahlt hast, gegen deinen üblichen Preis (Median). Kein Vergleich zwischen Händlern — nur deine eigene Historie."));
    if (!notable.length) {
      pc.append(el("p", "empty", "Alle letzten Preise lagen im üblichen Rahmen."));
    } else {
      tableCard(pc, [{ t: "Produkt" }, { t: "üblich", num: true }, { t: "zuletzt", num: true }, { t: "Spanne", num: true }],
        notable.slice(0, 12).map((m) =>
          `<tr><td>${esc(m.name)}<br><small style="color:var(--ink-2)">${m.purchases} Käufe</small></td>` +
          `<td class="num">${eur(m.usual)}</td>` +
          `<td class="num" style="color:${m.verdict === "teuer" ? "var(--red)" : "var(--green)"}">${eur(m.last)}<br>` +
          `<small>${sign(m.changePercent)} %</small></td>` +
          `<td class="num"><small>${eur(m.lowest)}<br>${eur(m.highest)}</small></td></tr>`));
    }
    c.append(pc);
  }

  const rc = card("Gelernte Rhythmen");
  rc.append(el("p", "sub", "Median der Kaufabstände je Einheit. Pausen über dem Dreifachen werden ausgeschlossen statt weggemittelt."));
  tableCard(rc, [{ t: "Produkt" }, { t: "Rhythmus", num: true }, { t: "Vertrauen", num: true }, { t: "Käufe", num: true }, { t: "Verlust", num: true }],
    [...ctx.rhythms.entries()].sort((a, b) => b[1].confidence - a[1].confidence).slice(0, 15).map(([pid, r]) => {
      const st = ctx.wasteStats.get(pid) || {};
      const p = byId(pid);
      return `<tr><td>${esc(p ? p.name : pid)}</td><td class="num">${r.rhythmDays ? "alle " + r.rhythmDays + " T" : "–"}</td>` +
        `<td class="num">${pct(r.confidence)}</td><td class="num">${st.purchased || 0}</td>` +
        `<td class="num">${st.wastedEuros > 0 ? eur(st.wastedEuros) : "–"}</td></tr>`;
    }));
  c.append(rc);

  /* --- Sparen --- */
  const sc = uiGroup("Was wirklich etwas bringt", "Aus deinen eigenen Zahlen abgeleitet, nicht aus allgemeinen Tipps.");
  if (!ctx.savings.length) sc.body.append(el("p", "empty", "Noch keine Vorschläge — dafür braucht es mehr Historie."));
  ctx.savings.forEach((x) => {
    const d = el("div", "save",
      `<div class="amt">${eur(x.estimatedWeeklySaving)}</div>` +
      `<div class="txt"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div>`);
    const b = el("button", "pillBtn" + (x.on ? " on" : ""), x.on ? "✓ übernommen" : "übernehmen");
    b.setAttribute("aria-pressed", x.on ? "true" : "false");
    b.addEventListener("click", () => app.set((st) => {
      st.savingsAccepted = x.on ? st.savingsAccepted.filter((y) => y !== x.id) : [...st.savingsAccepted, x.id];
    }));
    d.append(b);
    sc.body.append(d);
  });
  const wk = ctx.savings.filter((x) => x.on).reduce((a, x) => a + x.estimatedWeeklySaving, 0);
  sc.body.append(el("div", "strip",
    `<div><div class="big">${eur(wk)}</div><div class="l">pro Woche übernommen</div></div>` +
    `<div style="text-align:right"><div class="big">${Math.round(wk * 52)} €</div><div class="l">auf zwölf Monate</div></div>`));
  c.append(sc);

  if (ctx.packs.length) {
    const p = card("Packungsgrößen aus deiner Historie");
    p.append(el("p", "sub", "Der Grundpreis allein täuscht, wenn die große Packung halb weggeworfen wird."));
    const ul = el("ul", "plain");
    ctx.packs.forEach((x) => ul.append(el("li", null,
      `<span class="flag ${x.riskyRecommendation ? "f-gold" : "f-ok"}">${de(x.savingPercent)} %</span><span>${esc(x.recommendation)}</span>`)));
    p.append(ul);
    c.append(p);
  }

  const im = card("Wirkung in Kilogramm");
  const cmp = compareToReference(ctx.impact.kg, Data.get().settings.household);
  im.append(el("p", "sub", `Geschätzt <b>${ctx.impact.kg} kg</b> im betrachteten Zeitraum. ${esc(cmp.framing)}`));
  const il = el("ul", "plain");
  ctx.impact.byProduct.slice(0, 6).forEach((x) => il.append(el("li", null,
    `<span class="flag f-miss">${x.kg} kg</span><span>${esc(x.name)}</span>`)));
  if (!ctx.impact.byProduct.length) il.append(el("li", null, '<span class="empty">Keine strukturelle Verschwendung erkannt.</span>'));
  im.append(il);
  im.append(el("p", "srcnote", esc(cmp.note)));
  c.append(im);

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
  const ch = card("Ausgaben je Monat", `${months.length} Monate`);
  if (!months.length) { ch.append(el("p", "empty", "Keine Daten.")); return ch; }

  const W = 760, H = 230, pad = { l: 46, r: 14, t: 12, b: 30 };
  const max = Math.max(...months.map((m) => m[1]), 10) * 1.15;
  const bw = (W - pad.l - pad.r) / months.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const wasteShare = ctx.totals.spend > 0 ? ctx.totals.wastedEuros / ctx.totals.spend : 0;

  let grid = "", bars = "";
  [0, max / 2, max].forEach((tv) => {
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="currentColor" opacity=".14"/>` +
      `<text x="${pad.l - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" opacity=".55">${tv.toFixed(0)}</text>`;
  });
  months.forEach((m, i) => {
    const x = pad.l + i * bw + bw * 0.24, w = bw * 0.52;
    const top = y(m[1]), base = y(0);
    bars += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(base - top).toFixed(1)}" fill="var(--accent)" rx="5"/>` +
      `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2, (base - top) * wasteShare).toFixed(1)}" fill="var(--red)" rx="5"/>` +
      `<text x="${(x + w / 2).toFixed(1)}" y="${H - pad.b + 18}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".55">${m[0].slice(5)}</text>`;
  });

  ch.append(el("div", null,
    `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ausgaben je Monat">${grid}${bars}</svg>`));
  ch.append(el("div", "legend",
    `<span><i style="background:var(--accent)"></i>gegessen</span><span><i style="background:var(--red)"></i>vermutlich verdorben (Schätzung)</span>`));
  return ch;
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
  c.append(look);

  /* --- Gangreihenfolge --- */
  const aisles = relevantAisles(ctx.aisleList, ctx.items);
  if (aisles.length > 1) {
    const g = uiGroup("Gangreihenfolge" + (ctx.store ? ` · ${ctx.store}` : ""),
      "So läufst du im Ladenmodus durch den Markt. Die Reihenfolge wird je Markt gemerkt.");
    aisles.forEach((aisle, i) => {
      const r = el("div", "row");
      r.append(el("div", "rowMain", `<div class="rowTitle">${esc(aisle)}</div>`));
      const acts = el("div");
      acts.style.cssText = "display:flex;gap:6px;flex:0 0 auto";
      [["↑", -1, i === 0], ["↓", 1, i === aisles.length - 1]].forEach(([sym, dir, disabled]) => {
        const b = el("button", "pillBtn", sym);
        b.setAttribute("aria-label", `${aisle} nach ${dir < 0 ? "oben" : "unten"}`);
        b.disabled = disabled;
        if (disabled) b.style.opacity = ".3";
        else b.addEventListener("click", () => app.moveAisle(aisle, dir));
        acts.append(b);
      });
      r.append(acts);
      g.body.append(r);
    });
    c.append(g);
  }

  /* --- Pfand --- */
  const d = ctx.deposit;
  const pg = uiGroup("Pfand",
    "Einwegpfand 0,25 € ist gesetzlich einheitlich. Mehrwegsätze sind herstellerabhängig — die Beträge sind übliche Sätze, keine Zusicherung.");
  if (!d.byType.length) {
    pg.body.append(uiRow("Kein offenes Pfand", null, null, { value: "0,00 €" }));
  } else {
    d.byType.forEach((t) => pg.body.append(uiRow(t.label, `${t.count} Gebinde`, null, { value: eur(t.amount) })));
    const back = el("button", "row");
    back.style.color = "var(--accent)";
    back.append(el("div", "rowMain", `<div class="rowTitle" style="color:var(--accent)">Alles zurückgegeben</div>` +
      `<div class="rowSub">${esc(d.message)}</div>`));
    back.addEventListener("click", () => {
      app.set((s) => {
        s.depositReturned = [...new Set([...s.depositReturned, ...ctx.openDepositEntries.map((e) => e.key)])];
      });
      app.toast("Pfand als zurückgegeben notiert");
    });
    pg.body.append(back);
  }
  c.append(pg);

  /* --- Archiv --- */
  const st = archiveStats(ctx.archive);
  const a = card("Bon-Archiv", st.receipts < S.receipts.length
    ? `letzte ${st.receipts} von ${S.receipts.length} Bons`
    : `${st.receipts} Bons`);
  a.append(el("p", "sub", `${eur(st.totalSpend)} gesamt · ${st.warrantyRelevant} mit Garantierelevanz`));
  if (st.stores.length) {
    tableCard(a, [{ t: "Markt" }, { t: "Besuche", num: true }, { t: "Ausgaben", num: true }, { t: "Ø Korb", num: true }],
      st.stores.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.visits}</td><td class="num">${eur(x.spend)}</td><td class="num">${eur(x.avgBasket)}</td></tr>`));
  } else {
    a.append(el("p", "empty", "Noch keine Bons erfasst."));
  }
  const fr = expiringWarranties(ctx.archive, ctx.ref, 800);
  if (fr.length) {
    a.append(el("h3", null, "Gewährleistungsfristen"));
    const fu = el("ul", "plain");
    fr.slice(0, 6).forEach((f) => fu.append(el("li", null, `<span class="flag f-gold">${f.daysLeft} T</span><span>${esc(f.message)}</span>`)));
    a.append(fu);
  }
  a.append(el("p", "srcnote", "Die App speichert und erinnert. Sie gibt keine Rechtsauskunft — Fristen und Kulanz hängen vom Einzelfall ab."));
  c.append(a);

  /* --- Rechenweg --- */
  const m = card("Wie die App rechnet");
  m.append(el("p", "sub", "Kein KI-Modell. Robuste Statistik, Textabgleich, Schwellenwerte, Tabellen — alles nachvollziehbar."));
  tableCard(m, [{ t: "Schritt" }, { t: "Verfahren" }], [
    `<tr><td>Bonzeile → Produkt</td><td>Alias-Tabelle, sonst Token- und Levenshtein-Vergleich; 65–85 % = nachfragen statt raten</td></tr>`,
    `<tr><td>Rhythmus</td><td>Median der Kaufabstände je Einheit; Pausen über dem Dreifachen ausgeschlossen</td></tr>`,
    `<tr><td>Vertrauen</td><td>Datenpunkte × (1 − robuste Streuung), MAD statt Standardabweichung</td></tr>`,
    `<tr><td>Bestand</td><td>gekauft − (Tage seit Kauf ÷ Verbrauch je Einheit)</td></tr>`,
    `<tr><td>Reichweite</td><td>kleinerer Wert aus Restmenge × Verbrauch und verbleibender Haltbarkeit</td></tr>`,
    `<tr><td>Verschwendung</td><td>strukturell: Rhythmus &gt; Haltbarkeit · Ausreißer: einzelner Abstand &gt; Haltbarkeit × 1,2</td></tr>`,
    `<tr><td>Budget</td><td>erst Verschwender halbieren, dann Süßes und Alkohol; Grundnahrung nie</td></tr>`,
    `<tr><td>Preis-Gedächtnis</td><td>Median der eigenen Kaufpreise; ab 8 % Abweichung wird es gemeldet</td></tr>`,
    `<tr><td>Inflation</td><td>gewichteter Preisindex über Produkte, die in beiden Zeiträumen gekauft wurden</td></tr>`
  ]);
  c.append(m);

  const q = databaseQualityReport();
  const db = card("Datenbasis, ungeschönt");
  db.append(el("p", "sub", `${q.total} Produkte, ${q.kategorien} Kategorien, ${q.aliasesTotal} Schreibweisen, ${q.nonFood} Non-Food.`));
  tableCard(db, [{ t: "Belastbarkeit" }, { t: "Produkte", num: true }, { t: "Bedeutung" }], [
    `<tr><td>regulatorisch</td><td class="num">${q.regulatorisch}</td><td>Verbrauchsdatum-Pflicht, rechtlich definiert (BZfE/BLE)</td></tr>`,
    `<tr><td>Leitlinie</td><td class="num">${q.leitlinie}</td><td>aus behördlicher Lagerempfehlung abgeleitet (BZfE/BLE)</td></tr>`,
    `<tr><td>Schätzwert</td><td class="num">${q.schaetzwert}</td><td><b>ohne amtliche Quelle — vor Produktivbetrieb prüfen</b></td></tr>`
  ]);
  db.append(el("div", "note gold",
    `<b>${q.anteilGeschaetzt} % der Haltbarkeitswerte sind Schätzungen.</b> Das ist der ehrliche Preis für die Abdeckung von ${q.total} Produkten. ` +
    `${q.safetyCritical} Produkte tragen ein Verbrauchsdatum — für sie schlägt die App nie eine Weiterverwendung vor.`));
  c.append(db);

  /* --- Daten --- */
  const dat = uiGroup("Deine Daten",
    "Es gibt keinen Server und kein Konto. Alles liegt im Speicher dieses Browsers — Browserdaten löschen löscht die App-Daten mit.");
  dat.body.append(uiRow("Erfasste Käufe", S.settings.demo ? "Beispieldaten" : null, null, { value: String(S.purchases.length) }));
  dat.body.append(uiRow("Bons", null, null, { value: String(S.receipts.length) }));
  dat.body.append(uiRow("Gelernte Schreibweisen", null, null, { value: String(Object.keys(S.aliases).length) }));
  c.append(dat);

  const actions = uiGroup();
  const exp = el("button", "row");
  exp.append(el("div", "rowMain", '<div class="rowTitle" style="color:var(--accent)">Sicherung herunterladen</div>'));
  exp.addEventListener("click", () => {
    const blob = new Blob([Data.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `einkaufsanker-${Data.today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast("Sicherung erstellt");
  });
  actions.body.append(exp);

  const impRow = el("label", "row");
  impRow.style.cursor = "pointer";
  impRow.append(el("div", "rowMain", '<div class="rowTitle" style="color:var(--accent)">Sicherung einlesen</div>'));
  const impInput = el("input");
  impInput.type = "file"; impInput.accept = "application/json,.json";
  impInput.style.display = "none";
  impInput.addEventListener("change", () => {
    const file = impInput.files && impInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { app.toast(`${Data.importJson(String(reader.result))} Käufe eingelesen`); }
      catch (e) { app.toast("Sicherung nicht lesbar"); console.error(e); }
    };
    reader.readAsText(file);
    impInput.value = "";
  });
  impRow.append(impInput);
  actions.body.append(impRow);

  const demo = el("button", "row");
  demo.append(el("div", "rowMain",
    `<div class="rowTitle" style="color:var(--accent)">${S.settings.demo ? "Beispieldaten neu laden" : "Beispieldaten laden"}</div>`));
  demo.addEventListener("click", () => app.confirm(
    "Beispieldaten laden?",
    "Ersetzt alle erfassten Käufe durch eine erzeugte Historie über sechs Monate. Vorher am besten eine Sicherung herunterladen.",
    () => { Data.loadDemo("full"); app.toast("Beispielhistorie geladen"); app.goto("liste"); }
  ));
  actions.body.append(demo);

  const del = el("button", "row");
  del.append(el("div", "rowMain", '<div class="rowTitle" style="color:var(--red)">Alles löschen</div>'));
  del.addEventListener("click", () => app.confirm(
    "Wirklich alles löschen?",
    "Käufe, Bons, Einstellungen und gelernte Zuordnungen werden entfernt. Das lässt sich nicht rückgängig machen.",
    () => { Data.reset(); app.toast("Alles gelöscht"); app.goto("liste"); }
  ));
  actions.body.append(del);
  c.append(actions);

  const about = card("Über diese Fassung");
  about.append(el("p", "sub",
    `Web-App, Bauversion <span class="mono">${esc(window.__BUILD__ || "dev")}</span>. Die Algorithmen sind dieselben Node-Module, ` +
    `die unter <span class="mono">npm test</span> geprüft werden — gebündelt, nicht abgeschrieben.`));
  about.append(el("p", "srcnote",
    "Quellen der Haltbarkeits- und Lagerdaten: BZfE/BLE „Haltbarkeit von Lebensmitteln\" und „Lebensmittel richtig lagern\" (Stand 20.02.2025), " +
    "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\"."));
  c.append(about);

  return c;
}
