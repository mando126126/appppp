/* ================================================================
   app.js — Rahmen: Navigation, Kopfbereich, Ladenmodus, Blätter.
   Die Ansichten stehen in views.js, die Berechnung in data.js.
   ================================================================ */

const NAV = [
  {
    id: "liste", label: "Liste", view: viewListe,
    icon: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6l1.5 1.5L7 5"/><path d="M3 12l1.5 1.5L7 11"/><path d="M3 18l1.5 1.5L7 17"/>'
  },
  {
    id: "bestand", label: "Bestand", view: viewBestand,
    icon: '<path d="M4 7h16v13H4z"/><path d="M4 12h16"/><path d="M9 7V4h6v3"/>'
  },
  {
    id: "erfassen", label: "Erfassen", view: viewErfassen,
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
  },
  {
    id: "zahlen", label: "Zahlen", view: viewZahlen,
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  },
  {
    id: "mehr", label: "Mehr", view: viewMehr,
    icon: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'
  }
];

const App = {
  tab: "liste",
  ctx: null,
  storeOpen: false,
  capture: { tab: "scan", text: "", parsed: null, basket: [], query: "", date: null, store: "" },

  /* ---------- Zustand ändern ---------- */
  set(fn) { Data.update(fn); },

  /** Eine Wochenentscheidung zu einer Position festhalten. */
  choose(productId, patch) {
    Data.update((s) => {
      if (s.listWeek !== App.ctx.weekKey) { s.listWeek = App.ctx.weekKey; s.listChoices = {}; }
      const cur = s.listChoices[productId] || {};
      const next = { ...cur, ...patch };
      if (patch.on === true) next.reason = null;
      if (patch.reason !== undefined && patch.on === undefined) next.on = false;
      s.listChoices[productId] = next;
    });
  },

  goto(tab) {
    App.tab = tab;
    if (location.hash !== "#" + tab) location.hash = tab;
    window.scrollTo(0, 0);
    App.render();
  },

  /* ---------- Rückmeldungen ---------- */
  toast(text, ms = 2200) {
    const t = document.getElementById("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  },

  /** Aktionsblatt für alles, was sich nicht zurücknehmen lässt. */
  confirm(title, text, onYes, yesLabel = "Ja, machen") {
    const sheet = document.getElementById("sheet");
    document.getElementById("sheetTitle").textContent = title;
    document.getElementById("sheetSub").textContent = text;
    const opts = document.getElementById("sheetOpts");
    opts.innerHTML = "";
    const yes = document.createElement("button");
    yes.className = "cta danger";
    yes.textContent = yesLabel;
    yes.addEventListener("click", () => { App.closeSheet(); onYes(); });
    opts.append(yes);
    sheet.hidden = false;
    yes.focus();
  },
  closeSheet() { document.getElementById("sheet").hidden = true; },

  /* ---------- Ladenmodus ---------- */
  openStore() {
    App.storeOpen = true;
    document.getElementById("store").hidden = false;
    document.body.style.overflow = "hidden";
    App.renderStore();
  },
  closeStore() {
    App.storeOpen = false;
    document.getElementById("store").hidden = true;
    document.body.style.overflow = "";
    App.render();
  },

  renderStore() {
    const ctx = App.ctx;
    const S = Data.get();
    const active = ctx.items.filter((i) => i.on);
    const body = document.getElementById("storeBody");
    body.innerHTML = "";

    const seen = new Set();
    const aisles = [...AISLE_ORDER, ...active.map((i) => i.aisle)].filter((a) => {
      if (!a || seen.has(a)) return false;
      seen.add(a);
      return true;
    });

    aisles.forEach((aisle) => {
      const group = active.filter((i) => i.aisle === aisle);
      if (!group.length) return;
      body.append(el("div", "aisle", esc(aisle)));
      group.forEach((i) => {
        const done = S.storeChecked.includes(i.productId);
        const dup = ctx.duplicates.find((d) => d.productId === i.productId);
        const b = el("button", "sItem" + (done ? " done" : ""));
        b.setAttribute("aria-pressed", done ? "true" : "false");
        b.innerHTML =
          `<span class="tick"></span>` +
          `<span class="sn">${esc(i.name)}${dup ? `<small>${esc(dup.message)}</small>` : ""}</span>` +
          `<span class="sp">${eur(i.halved ? i.price / 2 : i.price)}</span>`;
        b.addEventListener("click", () => {
          Data.update((s) => {
            s.storeChecked = s.storeChecked.includes(i.productId)
              ? s.storeChecked.filter((x) => x !== i.productId)
              : [...s.storeChecked, i.productId];
          });
        });
        body.append(b);
      });
    });

    if (!active.length) body.append(el("p", "empty", "Nichts auf der Liste."));

    const inCart = active.filter((i) => S.storeChecked.includes(i.productId));
    const sum = inCart.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    document.getElementById("storeProg").textContent = `${inCart.length} von ${active.length}`;
    document.getElementById("storeSum").textContent = eur(sum);

    // Abschluss: den Einkauf gleich als Bon buchen. Ohne diesen Schritt
    // bliebe der Kreislauf offen — die Liste würde nie zu Historie.
    const done = document.getElementById("storeDone");
    done.disabled = !inCart.length;
    done.textContent = inCart.length ? `${inCart.length} buchen` : "buchen";
    done.onclick = () => {
      App.confirm(
        "Einkauf buchen?",
        `${inCart.length} Positionen für ${eur(sum)} kommen in die Historie. Daraus lernt die App die Rhythmen.`,
        () => {
          const n = Data.addReceipt({
            date: Data.today(),
            store: "Einkauf",
            items: inCart.map((i) => ({
              productId: i.productId,
              quantity: 1,
              unitPrice: i.halved ? i.price / 2 : i.price
            }))
          });
          App.closeStore();
          App.toast(`${n} Positionen gebucht`);
        },
        "Buchen"
      );
    };
  },

  /* ---------- Kopfbereich ---------- */
  renderBar() {
    const ctx = App.ctx;
    const S = Data.get();
    const bar = document.getElementById("appbar");
    bar.innerHTML = "";

    const line = el("div", "line1");
    const titles = {
      liste: "Deine Liste", bestand: "Bestand", erfassen: "Einkauf erfassen",
      zahlen: "Deine Zahlen", mehr: "Mehr"
    };
    const sub = ctx.history.length
      ? `${ctx.weekday} · ${ctx.totals.receipts} Bons · ${ctx.rhythms.size} Produkte`
      : "noch keine Daten — leg mit einem Einkauf los";

    const head = el("div", null, `<h1>${esc(titles[App.tab])}</h1>`);
    const subLine = el("div", "sub", esc(sub));
    // Erzeugte Historie bleibt dauerhaft als solche gekennzeichnet —
    // ein Nutzer darf nie im Zweifel sein, ob eine Zahl seine eigene ist.
    if (S.settings.demo) {
      const tag = el("button", "demoTag", "Beispieldaten");
      tag.title = "Diese Historie ist erzeugt, nicht erfasst. Hier tippen, um sie zu ersetzen.";
      tag.addEventListener("click", () => App.goto("mehr"));
      subLine.append(document.createTextNode(" "), tag);
    }
    head.append(subLine);
    line.append(head);

    if (App.tab === "liste" && ctx.items.some((i) => i.on)) {
      const b = el("button", "barBtn", "Im Laden");
      b.addEventListener("click", () => App.openStore());
      line.append(b);
    }
    bar.append(line);

    if (!ctx.history.length) return;

    const nums = el("div", "heroNums");
    const savings = ctx.savings.reduce((a, x) => a + x.estimatedWeeklySaving, 0);
    const facts = [
      { k: eur(savings), l: "pro Woche zu holen, ohne Verzicht", cls: "lime" },
      { k: eur(ctx.totals.spendPerWeek), l: "dein Wochenschnitt" },
      { k: String(ctx.items.filter((i) => i.on).length), l: "Positionen heute fällig" },
      { k: String(ctx.inventory.length), l: "Positionen vermutlich noch da" },
      { k: eur(ctx.deposit.total), l: "Pfand offen", cls: ctx.deposit.worthReturning ? "warn" : "" }
    ];
    facts.forEach((f) => nums.append(el("div", "heroNum",
      `<div class="k ${f.cls || ""}">${esc(f.k)}</div><div class="l">${esc(f.l)}</div>`)));
    bar.append(nums);
  },

  renderNav() {
    const nav = document.getElementById("nav");
    nav.innerHTML = "";
    NAV.forEach((n) => {
      const b = el("button", null,
        `<svg viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg><span>${n.label}</span>`);
      if (App.tab === n.id) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => App.goto(n.id));
      nav.append(b);
    });
  },

  /* ---------- Hauptdurchlauf ---------- */
  render() {
    App.ctx = Data.compute();
    App.renderBar();
    App.renderNav();

    const main = document.getElementById("main");
    main.innerHTML = "";
    const entry = NAV.find((n) => n.id === App.tab) || NAV[0];
    main.append(entry.view(App.ctx, App));

    if (App.storeOpen) App.renderStore();
  }
};

/* ---------- Start ---------- */
function boot() {
  Data.load();

  // Erststart ohne Daten: sichtbar machen, dass die App etwas kann,
  // ohne ungefragt eine erfundene Historie zu speichern. Der Nutzer
  // entscheidet auf der Liste, ob er Beispieldaten will.
  const hash = location.hash.replace("#", "");
  if (NAV.some((n) => n.id === hash)) App.tab = hash;

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (NAV.some((n) => n.id === h) && h !== App.tab) { App.tab = h; App.render(); }
  });

  document.getElementById("storeClose").addEventListener("click", () => App.closeStore());
  document.getElementById("sheetCancel").addEventListener("click", () => App.closeSheet());
  document.getElementById("sheet").addEventListener("click", (e) => {
    if (e.target.id === "sheet") App.closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("sheet").hidden) App.closeSheet();
    else if (App.storeOpen) App.closeStore();
  });

  Data.subscribe(() => App.render());
  App.render();

  // Service Worker: macht die App offline nutzbar. Fehlschlag ist
  // kein Grund zum Abbruch — die App läuft auch ohne.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline-Betrieb nicht verfügbar:", e));
    });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
