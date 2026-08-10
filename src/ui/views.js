/* ================================================================
   views.js — die einzelnen Ansichten.
   Enthält KEINE Fachlogik: jede Zahl kommt aus Data.compute(), das
   wiederum ausschließlich die gebündelten Module aufruft.
   ================================================================ */

/* ---------- kleine Helfer ---------- */
const eur = (n) => (Number(n) || 0).toFixed(2).replace(".", ",") + " €";
const pct = (n) => Math.round((Number(n) || 0) * 100) + " %";
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

const AISLE_ORDER = [
  "Obst & Gemüse", "Backwaren", "Kühlregal", "Fleisch & Fisch",
  "Trockenware", "Konserven", "Tiefkühl", "Süßwaren", "Getränke", "Drogerie"
];

/** Karte mit Titel und optionaler Kennzahl rechts. */
function card(title, statText) {
  const c = el("div", "card");
  if (title) c.append(el("div", "headrow", `<h2>${esc(title)}</h2>${statText ? `<div class="stat">${esc(statText)}</div>` : ""}`));
  return c;
}

function settingRow(label, hint, control) {
  const r = el("div", "setting");
  r.append(el("div", null, `<div class="lbl">${esc(label)}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}`));
  r.append(control);
  return r;
}

function stepper(value, format, onChange, { min = 0, max = Infinity, step = 1 } = {}) {
  const w = el("div", "stepper");
  const dec = el("button", null, "−"); dec.setAttribute("aria-label", "weniger");
  const val = el("div", "val", format(value));
  const inc = el("button", null, "+"); inc.setAttribute("aria-label", "mehr");
  dec.disabled = value - step < min;
  inc.disabled = value + step > max;
  dec.addEventListener("click", () => onChange(Math.max(min, value - step)));
  inc.addEventListener("click", () => onChange(Math.min(max, value + step)));
  w.append(dec, val, inc);
  return w;
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

function tableCard(c, head, rows) {
  const wrap = el("div", "tableWrap");
  wrap.innerHTML =
    `<table><thead><tr>${head.map((h) => `<th${h.num ? ' class="num"' : ""}>${esc(h.t)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table>`;
  c.append(wrap);
  return wrap;
}

/* ================================================================
   1. Liste
   ================================================================ */
function viewListe(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* --- Datenlage zu dünn: erklären statt leere Liste zeigen --- */
  if (ctx.stage.stage <= 1) {
    const first = card("Noch keine Vorschläge", ctx.stage.label);
    first.append(el("p", "sub", ctx.stage.hint || "Vorschläge entstehen aus wiederholten Käufen. Zwei Bons je Produkt genügen für den ersten Rhythmus."));

    if (ctx.history.length) {
      const ins = firstReceiptInsights(
        ctx.history.filter((h) => h.date === ctx.history[ctx.history.length - 1].date)
      );
      first.append(el("div", "note green",
        `<b>${eur(ins.total)}</b> im letzten Einkauf, ${ins.positions} Positionen. ` +
        `Aufs Jahr hochgerechnet wären das <b>${ins.yearProjection} €</b>, wenn das dein Wochenschnitt ist.`));
      tableCard(first, [{ t: "Kategorie" }, { t: "Ausgabe", num: true }, { t: "Anteil", num: true }],
        ins.categories.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${eur(x.spend)}</td><td class="num">${x.share} %</td></tr>`));
      first.append(el("p", "srcnote", ins.hint));
    }

    const go = el("button", "cta", "Einkauf erfassen");
    go.addEventListener("click", () => app.goto("erfassen"));
    first.append(go);

    if (!ctx.history.length) {
      const demo = el("button", "cta light", "Beispieldaten laden (6 Monate)");
      demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Beispielhistorie geladen"); });
      first.append(demo);
    }
    c.append(first);
    return c;
  }

  /* --- Einstellungen für diese Woche --- */
  const set = card("Diese Woche", `${ctx.weekday} · ${ctx.weekKey}`);
  const sumOn = ctx.items.filter((i) => i.on).reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
  const rest = S.settings.budget - sumOn;
  set.append(settingRow(
    "Wochenbudget",
    S.settings.budget ? (rest >= 0 ? `noch ${eur(rest)} Luft` : `${eur(-rest)} darüber`) : "kein Deckel gesetzt",
    stepper(S.settings.budget, (v) => (v ? eur(v) : "aus"), (v) => app.set((s) => { s.settings.budget = v; }), { min: 0, max: 400, step: 5 })
  ));
  set.append(settingRow(
    "Personen im Haushalt",
    "skaliert alle Mengen",
    stepper(S.settings.household, (v) => String(v), (v) => app.set((s) => { s.settings.household = v; }), { min: 1, max: 8, step: 1 })
  ));
  set.append(settingRow(
    "Vorausschau",
    "wie viele Tage der Einkauf mitabdecken soll",
    stepper(S.settings.lookaheadDays, (v) => (v ? `${v} Tage` : "nur fällig"),
      (v) => app.set((s) => { s.settings.lookaheadDays = v; }), { min: 0, max: 7, step: 1 })
  ));

  const v = S.settings.vacation;
  set.append(settingRow(
    "Urlaubsmodus",
    v.active && v.from ? `${deDate(v.from)} bis ${deDate(v.to)}` : "hält Frischware vor der Abreise zurück",
    toggle(v.active, (on) => app.set((s) => {
      s.settings.vacation.active = on;
      if (on && !s.settings.vacation.from) {
        s.settings.vacation.from = Data.plusDays(Data.today(), 2);
        s.settings.vacation.to = Data.plusDays(Data.today(), 16);
      }
    }), "Urlaubsmodus")
  ));

  if (v.active) {
    const f = el("div", "row2");
    [["from", "Abreise"], ["to", "Rückkehr"]].forEach(([key, label]) => {
      const w = el("label", "field", `<span class="lbl">${label}</span>`);
      const i = el("input");
      i.type = "date";
      i.value = v[key] || "";
      i.addEventListener("change", () => app.set((s) => { s.settings.vacation[key] = i.value; }));
      w.append(i);
      f.append(w);
    });
    set.append(f);
  }
  c.append(set);

  /* --- Die Liste --- */
  const list = card("Vorschlag für heute", ctx.stage.label);
  list.append(el("p", "sub", 'Jede Position ist berechnet. Der Rechenweg steht unter jeder Zeile.'));

  if (ctx.budgetResult.removed.length) {
    list.append(el("div", "note gold",
      `<b>${esc(ctx.budgetResult.advice)}</b> Gestrichen: ${ctx.budgetResult.removed.map((r) => esc(r.name)).join(", ")}. ` +
      `Brot, Milch und Eier bleiben immer auf der Liste.`));
  }
  if (ctx.vacation && ctx.vacation.skip.length) {
    list.append(el("div", "note blue",
      `<b>Urlaubsmodus:</b> ${ctx.vacation.skip.length} Frischeposition(en) zurückgestellt — ${eur(ctx.vacation.savedEuros)} gespart. ` +
      ctx.vacation.skip.map((s) => esc(s.name)).join(", ")));
  }

  const ul = el("ul", "items");
  if (!ctx.items.length) {
    ul.append(el("li", "item", '<p class="empty">Diese Woche ist nichts fällig. Alles im Rhythmus.</p>'));
  }

  ctx.items.forEach((it) => {
    const p = byId(it.productId) || {};
    const li = el("li", "item" + (it.on ? "" : " off"));

    const top = el("div", "top");
    const cb = el("input");
    cb.type = "checkbox"; cb.className = "box"; cb.checked = it.on;
    cb.setAttribute("aria-label", it.name + " auf die Liste");
    cb.addEventListener("change", () => app.choose(it.productId, { on: cb.checked, reason: cb.checked ? null : undefined }));

    const main = el("div", "main");
    const nm = el("div", "nm", esc(it.name));
    if (it.dueIn !== undefined && it.dueIn > 0) nm.append(el("span", "pill", `in ${it.dueIn} Tagen fällig`));
    else if (it.dueIn !== undefined && it.dueIn < 0) nm.append(el("span", "pill warn", `${-it.dueIn} Tage überfällig`));
    if (it.rhythmDays) nm.append(el("span", "pill rh", `alle ${it.rhythmDays} Tage`));
    if (it.basis === "annahme") nm.append(el("span", "pill warn", "Annahme"));
    if (it.riskFlag) nm.append(el("span", "pill risk", `${pct(it.wasteRate)} bleibt übrig`));
    if (p.safetyCritical) nm.append(el("span", "pill safety", "Verbrauchsdatum"));
    const dup = ctx.duplicates.find((d) => d.productId === it.productId);
    if (dup) nm.append(el("span", "pill dup", dup.level === "info" ? "doppelt?" : "kürzlich gekauft"));
    if (!it.on && it.reason) {
      const r = REASONS.find((x) => x.key === it.reason);
      if (r) nm.append(el("span", "pill state", r.label));
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
        const h = el("button", "ghost" + (it.halved ? " on" : ""), it.halved ? "✓ halbe Menge" : "Halbe Menge");
        h.setAttribute("aria-pressed", it.halved ? "true" : "false");
        h.style.marginTop = "8px";
        h.addEventListener("click", () => app.choose(it.productId, { halved: !it.halved }));
        n.append(el("div", null, ""), h);
        why.append(n);
      }
    }
    if (why.childNodes.length) li.append(why);

    if (!it.on && (it.perishable || it.price > 3)) {
      const box = el("div", "reasons");
      box.append(el("div", "q", "Warum nicht?"));
      const opts = el("div", "opts");
      REASONS.forEach((r) => {
        const b = el("button", "opt", `<span>${r.label}</span><small>${r.hint}</small>`);
        b.setAttribute("aria-pressed", it.reason === r.key ? "true" : "false");
        b.addEventListener("click", () => app.choose(it.productId, { reason: r.key }));
        opts.append(b);
      });
      box.append(opts);
      if (it.reason === "have") box.append(el("div", "out watch", `Beobachtet: <b>${esc(it.name)}</b> hält typischerweise ${it.shelfLifeDays} Tage.`));
      if (it.reason === "consumed") box.append(el("div", "out", `Als verbraucht notiert. Rhythmus bleibt bei ${it.rhythmDays} Tagen.`));
      if (it.reason === "skip") box.append(el("div", "out", "Übersprungen. Der Rhythmus pausiert."));
      li.append(box);
    }
    ul.append(li);
  });
  list.append(ul);

  const on = ctx.items.filter((i) => i.on);
  const full = ctx.items.reduce((a, i) => a + i.price, 0);
  const tot = el("div", "totals");
  tot.innerHTML =
    `<div><div class="l">${on.length} Positionen</div><div class="big">${eur(sumOn)}</div></div>` +
    `<div class="saved">${full > sumOn ? "− " + eur(full - sumOn) + " gegenüber allem" : ""}</div>`;
  list.append(tot);

  const cta = el("button", "cta", "Einkaufen starten →");
  cta.disabled = !on.length;
  cta.addEventListener("click", () => app.openStore());
  list.append(cta);
  c.append(list);

  if (ctx.ethylene) {
    const e = card("Lagerhinweis für diesen Einkauf");
    e.append(el("div", "note gold", `<b>${esc(ctx.ethylene.message)}</b>`));
    e.append(el("p", "srcnote", "Quelle: " + esc(ctx.ethylene.source)));
    c.append(e);
  }
  return c;
}

/* ================================================================
   2. Bestand und Rezepte
   ================================================================ */
function viewBestand(ctx, app) {
  const c = frag();

  const inv = card("Vermutlich noch da", `${ctx.inventory.length} Positionen`);
  inv.append(el("p", "sub", "Geschätzt aus Einkauf minus Verbrauch — ohne dass du etwas pflegst. Deshalb mit Sicherheitsangabe."));
  if (!ctx.inventory.length) {
    inv.append(el("p", "empty", "Kein Bestand schätzbar. Dafür braucht es mindestens zwei Käufe je Produkt."));
  } else {
    tableCard(inv,
      [{ t: "Produkt" }, { t: "Rest", num: true }, { t: "hält noch", num: true }, { t: "Wert", num: true }],
      ctx.inventory.slice(0, 20).map((i) => {
        const p = byId(i.productId) || {};
        // Haltbarkeit in Tagen ist nur für Frisches eine Aussage.
        // „3640 Tage" bei Klopapier ist rechnerisch richtig und als
        // Angabe trotzdem wertlos — dann lieber gar keine Zahl.
        const longLived = !p.isFood || i.daysLeft > 120;
        const cls = i.daysLeft <= 2 ? "f-miss" : i.daysLeft <= 5 ? "f-gold" : "f-ok";
        const left = longLived
          ? `<span class="flag f-ok">unkritisch</span>`
          : `<span class="flag ${cls}">${i.daysLeft} T</span>`;
        const rest = i.remainingUnits.toFixed(1).replace(".", ",");
        return `<tr><td>${esc(i.name)}<br><small style="color:var(--muted)">Sicherheit ${pct(i.confidence)}</small></td>` +
          `<td class="num">${rest}</td><td class="num">${left}</td><td class="num">${eur(i.value)}</td></tr>`;
      }));
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
    `<small style="color:var(--muted)">nutzt: ${esc(x.usesFromStock.join(", ")) || "—"}</small></span>`)));
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
    plan.mustUse.forEach((x) => pl.append(el("li", null,
      `<span class="flag f-gold">aufbrauchen</span><span>${esc(x.hint)}</span>`)));
    plan.freeze.forEach((x) => pl.append(el("li", null,
      `<span class="flag f-new">einfrieren</span><span>${esc(x.hint)}</span>`)));
    if (!pl.childNodes.length) pl.append(el("li", null, '<span class="empty">Nichts, was die Reise nicht übersteht.</span>'));
    p.append(pl);
    c.append(p);
  }
  return c;
}

/* ================================================================
   3. Erfassen — der Punkt, an dem die App eigene Daten bekommt
   ================================================================ */
function viewErfassen(ctx, app) {
  const c = frag();
  const cap = app.capture;

  const tabs = el("div", "capTabs");
  [["scan", "Bon einlesen"], ["manual", "Von Hand"]].forEach(([k, label]) => {
    const b = el("button", null, label);
    b.setAttribute("aria-selected", cap.tab === k ? "true" : "false");
    b.addEventListener("click", () => { cap.tab = k; app.render(); });
    tabs.append(b);
  });

  const box = card();
  box.prepend(tabs);

  if (cap.tab === "scan") renderScan(box, cap, app);
  else renderManual(box, cap, app);

  c.append(box);

  /* --- Bisher erfasste Bons --- */
  const S = Data.get();
  if (S.receipts.length) {
    const h = card("Erfasste Bons", `${S.receipts.length} gesamt`);
    const ul = el("ul", "plain");
    [...S.receipts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).forEach((rec) => {
      const li = el("li");
      li.append(el("span", "flag f-ok", eur(rec.total)));
      li.append(el("span", null, `<b>${esc(rec.store)}</b> · ${deDate(rec.date)}<br><small style="color:var(--muted)">${rec.itemCount} Positionen</small>`));
      const del = el("button", "del", "×");
      del.setAttribute("aria-label", "Bon löschen");
      del.style.marginLeft = "auto";
      del.addEventListener("click", () => app.confirm(
        "Bon löschen?",
        `${esc(rec.store)} vom ${deDate(rec.date)} — alle Positionen dieses Tages werden aus der Historie entfernt.`,
        () => { Data.removeReceipt(rec.id); app.toast("Bon gelöscht"); }
      ));
      li.append(del);
      ul.append(li);
    });
    h.append(ul);
    c.append(h);
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

  /* --- Ergebnis der Auswertung --- */
  const p = cap.parsed;
  box.append(el("div", "note " + (p.open ? "gold" : "green"),
    `<b>${p.rows.length} Positionen erkannt.</b> ${p.sure} sicher zugeordnet` +
    (p.open ? `, <b>${p.open} brauchen eine Antwort</b> — sonst entstehen falsche Rhythmen.` : ".") +
    (p.discountTotal ? ` Rabatte: ${eur(p.discountTotal)}.` : "")));

  p.warnings.forEach((w) => box.append(el("div", "note red", esc(w))));

  const rows = el("div");
  p.rows.forEach((row, idx) => {
    const r = el("div", "matchRow");
    const left = el("div", "raw");
    left.append(el("div", "r", esc(row.raw)));
    left.append(el("div", "n", row.productName ? esc(row.productName) : "— nicht zugeordnet —"));

    if (row.needsConfirmation) {
      const sel = el("select");
      sel.setAttribute("aria-label", `Zuordnung für ${row.raw}`);
      const opts = [`<option value="">— nicht buchen —</option>`];
      const cands = Data.searchProducts(row.raw.split(/\s+/)[0] || "", 8);
      const pool = new Map();
      if (row.productId && byId(row.productId)) pool.set(row.productId, byId(row.productId));
      cands.forEach((x) => pool.set(x.id, x));
      FOOD_DATABASE.forEach((x) => { if (!pool.has(x.id)) pool.set(x.id, x); });
      [...pool.values()].forEach((x) => {
        opts.push(`<option value="${x.id}"${x.id === row.productId ? " selected" : ""}>${esc(x.name)} · ${esc(x.category)}</option>`);
      });
      sel.innerHTML = opts.join("");
      sel.value = row.productId || "";
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
      left.append(el("div", "r", row.confidence
        ? `bester Treffer ${pct(row.confidence)} — unter der Schwelle, deshalb die Frage`
        : "kein Treffer im Katalog"));
    } else {
      left.append(el("div", "r", `${esc(row.method)} · ${pct(row.confidence)}`));
    }

    const amt = el("div", "amt", `${eur(row.unitPrice * row.quantity)}<small>${row.quantity}× ${eur(row.unitPrice)}</small>`);
    r.append(left, amt);
    rows.append(r);
  });
  box.append(rows);

  if (p.deposits.length) {
    box.append(el("p", "srcnote", `${p.deposits.length} Pfandzeile(n) erkannt und getrennt gebucht — Pfand ist kein Lebensmittel.`));
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
  box.append(el("p", "sub", "Produkt suchen, Menge und Preis prüfen, in den Korb legen. Der Preis kommt aus dem Katalog und lässt sich überschreiben."));

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
    const hits = Data.searchProducts(cap.query || "", 10);
    if (!cap.query) { results.classList.add("hide"); return; }
    results.classList.remove("hide");
    if (!hits.length) {
      results.append(el("li", null, '<div style="padding:12px 13px;font-size:13px;color:var(--muted)">Nichts gefunden.</div>'));
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

  if (cap.basket.length) {
    box.append(el("h3", null, "Korb"));
    const ul = el("ul", "basket");
    cap.basket.forEach((b, i) => {
      const li = el("li");
      li.append(el("span", "bn", esc(b.name)));

      const st = stepper(b.quantity, (v) => String(v), (v) => { cap.basket[i].quantity = v; app.render(); }, { min: 1, max: 99, step: 1 });
      li.append(st);

      const pi = el("input");
      pi.type = "number"; pi.step = "0.01"; pi.min = "0"; pi.value = b.unitPrice.toFixed(2);
      pi.setAttribute("aria-label", `Preis für ${b.name}`);
      pi.style.cssText = "width:84px;padding:8px;border:1px solid var(--hair);border-radius:9px;text-align:right";
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
}

/* ================================================================
   4. Zahlen — Verlauf, Sparen, Wirkung
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
  const k = el("div", "kpis");
  k.innerHTML =
    `<div class="kpi"><div class="l">Ø pro Woche</div><div class="v">${eur(t.spendPerWeek)}</div><div class="t">aus ${t.receipts} Bons</div></div>` +
    `<div class="kpi"><div class="l">zu holen</div><div class="v good">${eur(savingsTotal)}</div><div class="t">pro Woche, ohne Verzicht</div></div>` +
    `<div class="kpi"><div class="l">Verlust geschätzt</div><div class="v warn">${eur(t.wastedPerWeek)}</div><div class="t">${ctx.impact.kg} kg gesamt</div></div>` +
    `<div class="kpi"><div class="l">Rhythmen gelernt</div><div class="v">${[...ctx.rhythms.values()].filter((r) => r.confidence >= 0.4).length}</div><div class="t">von ${ctx.rhythms.size} Produkten</div></div>`;
  c.append(k);

  c.append(el("div", "sectionTitle", "Verlauf"));
  c.append(chartCard(ctx));

  if (ctx.inflation && ctx.inflation.productsCompared) {
    const inf = ctx.inflation;
    const ic = card("Deine persönliche Inflation", `${inf.productsCompared} Produkte verglichen`);
    ic.append(el("p", "sub",
      `Dein Warenkorb heute gegenüber dem Anfang der Historie: <b style="font-size:17px">${inf.changePercent > 0 ? "+" : ""}${inf.changePercent} %</b>`));
    if (inf.biggestIncreases.length) {
      tableCard(ic, [{ t: "Produkt" }, { t: "vorher", num: true }, { t: "jetzt", num: true }, { t: "Änderung", num: true }],
        inf.biggestIncreases.map((i) =>
          `<tr><td>${esc(i.name)}</td><td class="num">${eur(i.basePrice)}</td><td class="num">${eur(i.currentPrice)}</td>` +
          `<td class="num" style="color:${i.changePercent > 0 ? "var(--coral)" : "var(--green)"}">${i.changePercent > 0 ? "+" : ""}${i.changePercent} %</td></tr>`));
    }
    ic.append(el("p", "srcnote", esc(inf.caveat)));
    c.append(ic);
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
  c.append(el("div", "sectionTitle", "Sparen"));
  const sc = card("Was wirklich etwas bringt", `${ctx.savings.length} Vorschläge`);
  sc.append(el("p", "sub", "Aus deinen eigenen Zahlen abgeleitet, nicht aus allgemeinen Tipps."));
  if (!ctx.savings.length) sc.append(el("p", "empty", "Noch keine Vorschläge — dafür braucht es mehr Historie."));
  ctx.savings.forEach((s) => {
    const d = el("div", "save",
      `<div class="amt">${eur(s.estimatedWeeklySaving)}</div>` +
      `<div class="txt"><b>${esc(s.title)}</b><small>${esc(s.detail)}</small></div>`);
    const b = el("button", "ghost" + (s.on ? " on" : ""), s.on ? "✓ übernommen" : "übernehmen");
    b.setAttribute("aria-pressed", s.on ? "true" : "false");
    b.addEventListener("click", () => app.set((st) => {
      st.savingsAccepted = s.on ? st.savingsAccepted.filter((x) => x !== s.id) : [...st.savingsAccepted, s.id];
    }));
    d.append(b);
    sc.append(d);
  });
  const wk = ctx.savings.filter((s) => s.on).reduce((a, s) => a + s.estimatedWeeklySaving, 0);
  sc.append(el("div", "strip",
    `<div><div class="big">${eur(wk)}</div><div class="l">pro Woche übernommen</div></div>` +
    `<div style="text-align:right"><div class="big">${Math.round(wk * 52)} €</div><div class="l">auf zwölf Monate</div></div>`));
  c.append(sc);

  if (ctx.packs.length) {
    const p = card("Packungsgrößen aus deiner Historie");
    p.append(el("p", "sub", "Der Grundpreis allein täuscht, wenn die große Packung halb weggeworfen wird."));
    const ul = el("ul", "plain");
    ctx.packs.forEach((x) => ul.append(el("li", null,
      `<span class="flag ${x.riskyRecommendation ? "f-gold" : "f-ok"}">${x.savingPercent} %</span><span>${esc(x.recommendation)}</span>`)));
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
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="#DDE3DA"/>` +
      `<text x="${pad.l - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#59655C">${tv.toFixed(0)}</text>`;
  });
  months.forEach((m, i) => {
    const x = pad.l + i * bw + bw * 0.22, w = bw * 0.56;
    const top = y(m[1]), base = y(0);
    bars += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(base - top).toFixed(1)}" fill="#1C4B3B" rx="4"/>` +
      `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2, (base - top) * wasteShare).toFixed(1)}" fill="#DC4A1B" rx="4"/>` +
      `<text x="${(x + w / 2).toFixed(1)}" y="${H - pad.b + 17}" text-anchor="middle" font-size="10" fill="#59655C">${m[0].slice(5)}</text>`;
  });

  ch.append(el("div", null,
    `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ausgaben je Monat">${grid}${bars}</svg>`));
  ch.append(el("div", "legend",
    `<span><i style="background:#1C4B3B"></i>gegessen</span><span><i style="background:#DC4A1B"></i>vermutlich verdorben (Schätzung)</span>`));
  return ch;
}

/* ================================================================
   5. Mehr — Pfand, Archiv, Rechenweg, Daten
   ================================================================ */
function viewMehr(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* --- Pfand --- */
  c.append(el("div", "sectionTitle", "Pfand"));
  const d = ctx.deposit;
  const p = card("Offenes Pfand", `${d.units} Gebinde`);
  p.append(el("p", "sub", esc(d.message)));
  const pl = el("ul", "plain");
  d.byType.forEach((t) => pl.append(el("li", null,
    `<span class="flag ${t.label.includes("Einweg") ? "f-new" : "f-gold"}">${eur(t.amount)}</span><span>${t.count}× ${esc(t.label)}</span>`)));
  if (!d.byType.length) pl.append(el("li", null, '<span class="empty">Kein offenes Pfand.</span>'));
  p.append(pl);
  if (ctx.openDepositEntries.length) {
    const back = el("button", "cta light", "Alles zurückgegeben");
    back.addEventListener("click", () => app.set((s) => {
      s.depositReturned = [...new Set([...s.depositReturned, ...ctx.openDepositEntries.map((e) => e.key)])];
    }));
    p.append(back);
  }
  p.append(el("p", "srcnote",
    "Einwegpfand 0,25 € ist gesetzlich einheitlich. Mehrwegsätze sind herstellerabhängig — die Beträge sind übliche Sätze, keine Zusicherung."));
  c.append(p);

  /* --- Archiv --- */
  c.append(el("div", "sectionTitle", "Bon-Archiv"));
  const st = archiveStats(ctx.archive);
  const a = card("Märkte", st.receipts < Data.get().receipts.length
    ? `letzte ${st.receipts} von ${Data.get().receipts.length} Bons`
    : `${st.receipts} Bons`);
  a.append(el("p", "sub", `${eur(st.totalSpend)} gesamt · ${st.warrantyRelevant} mit Garantierelevanz`));
  if (st.stores.length) {
    tableCard(a, [{ t: "Markt" }, { t: "Besuche", num: true }, { t: "Ausgaben", num: true }, { t: "Ø Korb", num: true }],
      st.stores.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">${s.visits}</td><td class="num">${eur(s.spend)}</td><td class="num">${eur(s.avgBasket)}</td></tr>`));
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
  c.append(el("div", "sectionTitle", "Rechenweg"));
  const m = card("Wie die App rechnet");
  m.append(el("p", "sub", "Kein KI-Modell. Robuste Statistik, Textabgleich, Schwellenwerte, Tabellen — alles nachvollziehbar."));
  tableCard(m, [{ t: "Schritt" }, { t: "Verfahren" }], [
    `<tr><td>Bonzeile → Produkt</td><td>Alias-Tabelle, sonst Token- und Levenshtein-Vergleich; 65–85 % = nachfragen statt raten</td></tr>`,
    `<tr><td>Rhythmus</td><td>Median der Kaufabstände je Einheit; Pausen über dem Dreifachen ausgeschlossen</td></tr>`,
    `<tr><td>Vertrauen</td><td>Datenpunkte × (1 − robuste Streuung), MAD statt Standardabweichung</td></tr>`,
    `<tr><td>Bestand</td><td>gekauft − (Tage seit Kauf ÷ Verbrauch je Einheit)</td></tr>`,
    `<tr><td>Verschwendung</td><td>strukturell: Rhythmus &gt; Haltbarkeit · Ausreißer: einzelner Abstand &gt; Haltbarkeit × 1,2</td></tr>`,
    `<tr><td>Budget</td><td>erst Verschwender halbieren, dann Süßes und Alkohol; Grundnahrung nie</td></tr>`,
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
  c.append(el("div", "sectionTitle", "Deine Daten"));
  const dat = card("Alles bleibt auf diesem Gerät");
  dat.append(el("p", "sub",
    "Es gibt keinen Server und kein Konto. Käufe, Einstellungen und gelernte Zuordnungen liegen im Speicher dieses Browsers. " +
    "Das heißt auch: Browserdaten löschen löscht die App-Daten mit."));

  const stats = el("ul", "plain");
  stats.append(el("li", null, `<span class="flag f-ok">${S.purchases.length}</span><span>erfasste Käufe${S.settings.demo ? " (Beispieldaten)" : ""}</span>`));
  stats.append(el("li", null, `<span class="flag f-ok">${S.receipts.length}</span><span>Bons</span>`));
  stats.append(el("li", null, `<span class="flag f-new">${Object.keys(S.aliases).length}</span><span>gelernte Schreibweisen</span>`));
  dat.append(stats);

  const exp = el("button", "cta light", "Sicherung herunterladen");
  exp.addEventListener("click", () => {
    const blob = new Blob([Data.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url;
    a2.download = `einkaufsanker-${Data.today()}.json`;
    a2.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast("Sicherung erstellt");
  });
  dat.append(exp);

  const impLabel = el("label", "cta light");
  impLabel.style.cssText += ";display:block;text-align:center;cursor:pointer";
  impLabel.textContent = "Sicherung einlesen";
  const impInput = el("input");
  impInput.type = "file"; impInput.accept = "application/json,.json";
  impInput.style.display = "none";
  impInput.addEventListener("change", () => {
    const file = impInput.files && impInput.files[0];
    if (!file) return;
    const fr2 = new FileReader();
    fr2.onload = () => {
      try {
        const n = Data.importJson(String(fr2.result));
        app.toast(`${n} Käufe eingelesen`);
      } catch (e) {
        app.toast("Sicherung nicht lesbar");
        console.error(e);
      }
    };
    fr2.readAsText(file);
    impInput.value = "";
  });
  impLabel.append(impInput);
  dat.append(impLabel);

  const demo = el("button", "cta light", S.settings.demo ? "Beispieldaten neu laden" : "Beispieldaten laden (6 Monate)");
  demo.addEventListener("click", () => app.confirm(
    "Beispieldaten laden?",
    "Ersetzt alle erfassten Käufe durch eine erzeugte Historie über sechs Monate. Vorher am besten eine Sicherung herunterladen.",
    () => { Data.loadDemo("full"); app.toast("Beispielhistorie geladen"); app.goto("liste"); }
  ));
  dat.append(demo);

  const del = el("button", "cta danger", "Alles löschen");
  del.addEventListener("click", () => app.confirm(
    "Wirklich alles löschen?",
    "Käufe, Bons, Einstellungen und gelernte Zuordnungen werden entfernt. Das lässt sich nicht rückgängig machen.",
    () => { Data.reset(); app.toast("Alles gelöscht"); app.goto("liste"); }
  ));
  dat.append(del);
  c.append(dat);

  const about = card("Über diese Fassung");
  about.append(el("p", "sub",
    `Web-App, Bauversion <span class="mono">${esc(window.__BUILD__ || "dev")}</span>. Die Algorithmen sind dieselben Node-Module, ` +
    `die unter <span class="mono">npm test</span> mit 142 Tests geprüft werden — gebündelt, nicht abgeschrieben.`));
  about.append(el("p", "srcnote",
    "Quellen der Haltbarkeits- und Lagerdaten: BZfE/BLE „Haltbarkeit von Lebensmitteln\" und „Lebensmittel richtig lagern\" (Stand 20.02.2025), " +
    "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\"."));
  c.append(about);

  return c;
}
