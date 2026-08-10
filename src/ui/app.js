/* ================================================================
   app.js — Rahmen: Navigation, Kopfbereich, Ladenmodus, Blätter.
   Die Ansichten stehen in views.js, die Berechnung in data.js.
   ================================================================ */

const NAV = [
  {
    id: "liste", label: "Liste", title: "Liste", view: viewListe,
    icon: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6.2l1.3 1.3 2.4-2.6"/><path d="M3.5 12.2l1.3 1.3 2.4-2.6"/><path d="M3.5 18.2l1.3 1.3 2.4-2.6"/>'
  },
  {
    id: "bestand", label: "Bestand", title: "Bestand", view: viewBestand,
    icon: '<rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/><path d="M3.5 12.5h17"/><path d="M9 7.5V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5v2"/>'
  },
  {
    id: "erfassen", label: "Erfassen", title: "Einkauf erfassen", view: viewErfassen,
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2v7.6M8.2 12h7.6"/>'
  },
  {
    id: "zahlen", label: "Zahlen", title: "Zahlen", view: viewZahlen,
    icon: '<path d="M4 20.5V12M9.3 20.5V4.5M14.7 20.5v-5.5M20 20.5V8.5"/>'
  },
  {
    id: "mehr", label: "Mehr", title: "Mehr", view: viewMehr,
    icon: '<circle cx="12" cy="6.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17.5" r="1.6"/>'
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

  /** Vergessenes Produkt nachträglich auf die Liste holen. */
  addToList(productId) {
    Data.update((s) => {
      if (s.listWeek !== App.ctx.weekKey) { s.listWeek = App.ctx.weekKey; s.listChoices = {}; }
      s.listChoices[productId] = { ...(s.listChoices[productId] || {}), on: true, extra: true, reason: null };
    });
  },

  /** Hinweis für diese Woche wegtippen. */
  dismiss(kind, productId) {
    Data.update((s) => {
      if (s.dismissed.week !== App.ctx.weekKey) {
        s.dismissed = { week: App.ctx.weekKey, forgotten: [], freeze: [] };
      }
      if (!s.dismissed[kind].includes(productId)) s.dismissed[kind].push(productId);
    });
  },

  /** Gang im Ladenweg des aktuellen Markts verschieben. */
  moveAisle(aisle, direction) {
    const store = App.ctx.store;
    Data.update((s) => {
      const key = normalizeStore(store);
      const current = orderFor(store, s.aisleOrders);
      s.aisleOrders[key] = moveAisle(current, aisle, direction);
    });
  },

  goto(tab) {
    App.tab = tab;
    if (location.hash !== "#" + tab) location.hash = tab;
    window.scrollTo(0, 0);
    App.render();
  },

  /* ---------- Erscheinungsbild ---------- */
  applyTheme() {
    const settings = Data.get().settings;
    const theme = settings.theme || "system";
    const root = document.documentElement;
    // Schriftgröße als Faktor auf die Wurzel: alle Maße stehen in rem
    // bzw. leiten sich davon ab, damit ein Wert reicht.
    root.style.setProperty("--text-scale", String(settings.textScale || 1));
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);

    // Die Statusleiste des Systems soll zur Seite passen.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = theme === "dunkel" ||
        (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#000000" : "#F2F2F7");
    }
  },

  /* ---------- Rückmeldungen ---------- */
  toast(text, ms = 2200) {
    const t = document.getElementById("toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  },

  /**
   * Blatt mit beliebigem Inhalt. Es trägt die Erklärungen, die früher
   * als Fließtext auf der Fläche standen — die Liste bleibt dadurch
   * knapp, ohne dass Quellen oder Schätzcharakter verschwinden.
   */
  sheet(title, sub, content) {
    const sheet = document.getElementById("sheet");
    document.getElementById("sheetTitle").textContent = title || "";
    const subEl = document.getElementById("sheetSub");
    subEl.textContent = sub || "";
    subEl.hidden = !sub;
    const opts = document.getElementById("sheetOpts");
    opts.innerHTML = "";
    if (content) opts.append(content);
    // Ein Blatt, das nur informiert, wird nicht "abgebrochen".
    document.getElementById("sheetCancel").textContent = "Fertig";
    sheet.hidden = false;
    document.getElementById("sheetCancel").focus();
  },

  /** Nur zur Kenntnis: Text in Absätzen. */
  notice(title, text) {
    const body = document.createElement("div");
    String(text).split("\n\n").forEach((para) => {
      const p = document.createElement("p");
      p.className = "sheetPara";
      p.textContent = para;
      body.append(p);
    });
    App.sheet(title, null, body);
  },

  /** Aktionsblatt für alles, was sich nicht zurücknehmen lässt. */
  confirm(title, text, onYes, yesLabel = "Ja, machen") {
    const yes = document.createElement("button");
    yes.className = "cta danger";
    yes.textContent = yesLabel;
    yes.addEventListener("click", () => { App.closeSheet(); onYes(); });
    App.sheet(title, text, yes);
    document.getElementById("sheetCancel").textContent = "Abbrechen";
    yes.focus();
  },
  closeSheet() { document.getElementById("sheet").hidden = true; },

  /**
   * Liste als Text weitergeben. Web Share, wo es das gibt, sonst
   * Zwischenablage, sonst das Blatt zum Markieren — auf einem Rechner
   * ohne beides wäre der Knopf sonst wirkungslos.
   */
  shareList() {
    const items = App.ctx.items.filter((i) => i.on);
    const text = listAsText(items, {
      order: App.ctx.aisleList,
      title: `Einkauf ${App.ctx.weekday}`
    });
    if (navigator.share) {
      navigator.share({ title: "Einkaufsliste", text }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => App.toast("In die Zwischenablage kopiert"))
        .catch(() => App.showListText(text));
      return;
    }
    App.showListText(text);
  },

  showListText(text) {
    const pre = document.createElement("pre");
    pre.className = "shareText";
    pre.textContent = text;
    App.sheet("Einkaufsliste", null, pre);
  },

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

    // Gangreihenfolge kommt aus dem Modul, nicht aus einer Liste hier.
    groupByAisle(active, ctx.aisleList).forEach(({ aisle, items }) => {
      body.append(el("div", "aisle", esc(aisle)));
      const box = el("div", "aisleGroup");
      items.forEach((i) => {
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
        box.append(b);
      });
      body.append(box);
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
    done.onclick = () => App.confirm(
      "Einkauf buchen?",
      `${inCart.length} Positionen für ${eur(sum)} kommen in die Historie. Daraus lernt die App die Rhythmen.`,
      () => {
        const alert = safetyAlert(inCart);
        const n = Data.addReceipt({
          date: Data.today(),
          store: App.ctx.store || "Einkauf",
          items: inCart.map((i) => ({
            productId: i.productId,
            quantity: 1,
            unitPrice: i.halved ? i.price / 2 : i.price
          }))
        });
        App.closeStore();
        // Sicherheitshinweis im richtigen Moment: beim Verlassen des
        // Ladens, nicht drei Tage später in einer Liste.
        if (alert) App.notice("Kühlkette", alert.message);
        else App.toast(`${n} Positionen gebucht`);
      },
      "Buchen"
    );
  },

  /* ---------- Kopfbereich ---------- */
  renderBar() {
    const ctx = App.ctx;
    const S = Data.get();
    const entry = NAV.find((n) => n.id === App.tab) || NAV[0];

    const bar = document.getElementById("appbar");
    bar.innerHTML = "";
    const rowEl = el("barRow" === "" ? "div" : "div", "barRow");
    rowEl.append(el("div", "barTitle", esc(entry.title)));

    const actions = el("div", "barActions");
    if (App.tab === "liste" && ctx.items.some((i) => i.on)) {
      const b = el("button", "barBtn filled", "Im Laden");
      b.addEventListener("click", () => App.openStore());
      actions.append(b);
    }
    if (App.tab === "zahlen" || App.tab === "bestand") {
      const b = el("button", "barBtn", "Erfassen");
      b.addEventListener("click", () => App.goto("erfassen"));
      actions.append(b);
    }
    rowEl.append(actions);
    bar.append(rowEl);

    // Großer Titel im Inhalt — fällt beim Scrollen in die Leiste zusammen.
    const large = document.getElementById("largeTitle");
    large.innerHTML = "";
    large.append(el("h1", null, esc(entry.title)));
    const sub = el("div", "sub");
    sub.append(document.createTextNode(ctx.history.length
      ? `${ctx.weekday} · ${ctx.totals.receipts} Bons · ${ctx.rhythms.size} Produkte`
      : "noch keine Daten — leg mit einem Einkauf los"));
    // Erzeugte Historie bleibt dauerhaft als solche gekennzeichnet.
    if (S.settings.demo) {
      const tag = el("button", "pill warn", "Beispieldaten");
      tag.title = "Diese Historie ist erzeugt, nicht erfasst. Hier tippen, um sie zu ersetzen.";
      tag.addEventListener("click", () => App.goto("mehr"));
      sub.append(tag);
    }
    large.append(sub);
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

  /** Trennlinie unter der Leiste erst zeigen, wenn Inhalt darunter läuft. */
  onScroll() {
    const bar = document.getElementById("appbar");
    if (!bar) return;
    const scrolled = window.scrollY > 26;
    bar.classList.toggle("scrolled", scrolled);
  },

  /* ---------- Hauptdurchlauf ---------- */
  render() {
    App.ctx = Data.compute();
    App.applyTheme();
    App.renderBar();
    App.renderNav();

    const main = document.getElementById("main");
    main.innerHTML = "";
    const entry = NAV.find((n) => n.id === App.tab) || NAV[0];
    main.append(entry.view(App.ctx, App));

    App.onScroll();
    if (App.storeOpen) App.renderStore();
  }
};

/* ---------- Start ---------- */
function boot() {
  Data.load();

  const hash = location.hash.replace("#", "");
  if (NAV.some((n) => n.id === hash)) App.tab = hash;

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (NAV.some((n) => n.id === h) && h !== App.tab) { App.tab = h; App.render(); }
  });

  window.addEventListener("scroll", App.onScroll, { passive: true });

  // Systemweiter Wechsel hell/dunkel, solange „System" eingestellt ist.
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (Data.get().settings.theme === "system") App.applyTheme(); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

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
