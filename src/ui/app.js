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
    // Austausch-Produkte sind HANDLUNGEN, keine Käufe — und der
    // wahrscheinlichste tägliche Öffnungsgrund der App. Deshalb ein
    // eigener Platz in der Leiste statt einer Sektion weiter unten.
    id: "faellig", label: "Fällig", title: "Fällig", view: viewFaellig,
    icon: '<circle cx="12" cy="12.5" r="8"/><path d="M12 8.5v4.2l2.8 1.7"/><path d="M9 3h6"/>'
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

/**
 * Zusatzzeile für die Buchungsbestätigung: was diesmal unter dem
 * eigenen üblichen Preis lag. Nur wenn es etwas zu sagen gibt —
 * „0,00 € gespart“ ist keine Rückmeldung, sondern Rauschen.
 */
function bookedDetail(res) {
  const saved = (res.savings || []).reduce((a, s) => a + s.euros, 0);
  return saved > 0 ? `${eur(saved)} unter deinem üblichen Preis` : null;
}

const App = {
  tab: "liste",
  ctx: null,
  storeOpen: false,
  capture: { tab: "scan", text: "", parsed: null, basket: [], query: "", date: null, store: "" },

  /* ---------- Zustand ändern ---------- */
  set(fn) { Data.update(fn); },

  /** Eine Wochenentscheidung zu einer Position festhalten. */
  choose(productId, patch) {
    // Ein neu gesetzter Grund wird dauerhaft protokolliert, nicht nur
    // für diese Woche. Ohne das war die Rückmeldung folgenlos: wer
    // dreimal „hab noch da" sagte, bekam das Produkt beim vierten Mal
    // wieder vorgeschlagen.
    const previous = (Data.get().listChoices[productId] || {}).reason || null;
    if (patch.reason && patch.reason !== previous) {
      const item = App.ctx.items.find((i) => i.productId === productId);
      Data.recordFeedback(productId, patch.reason, item ? item.dueIn : 0);
    }

    Data.update((s) => {
      if (s.listWeek !== App.ctx.weekKey) { s.listWeek = App.ctx.weekKey; s.listChoices = {}; }
      const cur = s.listChoices[productId] || {};
      const next = { ...cur, ...patch };
      if (patch.on === true) next.reason = null;
      // „War schon alle“ ist kein Abwahlgrund — das Produkt wird ja
      // gebraucht. Es korrigiert nur den Takt und bleibt auf der Liste.
      if (patch.reason !== undefined && patch.on === undefined) {
        next.on = patch.reason === "empty" ? cur.on !== false : false;
      }
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

  /** Austausch eintragen — setzt den Zähler zurück, ohne Kauf. */
  swap(productId, name) {
    Data.recordSwapFor(productId);
    App.toast(`${name} getauscht`, { icon: "↻" });
  },

  /**
   * Eine bestätigte Rettung festhalten.
   *
   * Bewusst nur an Stellen aufgerufen, an denen der Nutzer eine
   * Handlung ausdrücklich bestätigt — halbe Menge, eingefroren,
   * aufgebraucht, gekocht. Aus einer bloßen Anzeige eine Rettung zu
   * zählen wäre eine Auszeichnung dafür, dass die App etwas
   * angezeigt hat.
   */
  rescue(productId, text, euros) {
    const counted = Data.recordRescue(productId, euros);
    App.toast(text, {
      icon: "✓",
      detail: counted && euros > 0 ? "ca. " + eur(euros) + " gerettet" : null
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
      meta.setAttribute("content", dark ? "#0E1013" : "#F4F5F7");
    }
  },

  /* ---------- Rückmeldungen ---------- */
  /**
   * Kurze Bestätigung. Sie ist der einzige Ort, an dem die App auf
   * eine Handlung sofort antwortet — ohne sie fühlt sich jedes
   * Abhaken an, als wäre nichts passiert.
   *
   * Zweites Argument war früher die Dauer in Millisekunden. Beide
   * Formen bleiben gültig, damit ältere Aufrufe weiterlaufen.
   */
  toast(text, opts = {}) {
    const o = typeof opts === "number" ? { ms: opts } : opts;
    const ms = o.ms || (o.detail ? 2800 : 2200);
    const t = document.getElementById("toast");

    t.innerHTML = "";
    if (o.icon !== null) t.append(el("span", "tIcon", esc(o.icon || "✓")));
    const txt = el("span", "tTxt");
    txt.append(el("b", null, esc(text)));
    if (o.detail) txt.append(el("small", null, esc(o.detail)));
    t.append(txt);

    t.hidden = false;
    // Neustart der Animation: ohne das bleibt der zweite Toast in
    // Folge stumm stehen, weil die Animation schon gelaufen ist.
    t.classList.remove("in");
    void t.offsetWidth;
    t.classList.add("in");

    // Ein kurzer Impuls, wo das Gerät ihn kann. Bewusst sehr kurz —
    // spürbar, nicht störend.
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* egal */ } }

    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  },

  /* ---------- Meilensteine ---------- */
  /**
   * Neue Stufen feiern — aber nur die, die in dieser Sitzung erreicht
   * wurden. Beim ersten Durchlauf wird der Stand still übernommen:
   * wer die App mit 100 erfassten Bons öffnet, hat diese Bons nicht
   * gerade eben erfasst, und ein Schwall Glückwünsche entwertet die
   * Auszeichnung, bevor sie zum ersten Mal zählt.
   */
  checkBadges(firstRun) {
    const fresh = (App.ctx.freshBadges || []);
    if (!fresh.length || App._badgeBusy) return;

    App._badgeBusy = true;
    Data.markBadgesSeen(fresh.map((b) => b.key));
    App._badgeBusy = false;

    if (!firstRun) App.celebrate(fresh[0], fresh.length - 1);
  },

  celebrate(badge, more = 0) {
    const body = el("div", "celebrate");
    body.append(el("div", `cIcon m-${badge.id}`, markSvg(badge.icon)));
    body.append(el("div", "cTitle", esc(badge.title)));
    body.append(el("div", "cLevel", `Stufe ${badge.level} von ${badge.maxLevel}`));
    body.append(el("p", "cNote", esc(badge.note)));
    if (more > 0) {
      body.append(el("p", "cNote", `Dazu ${more} weitere${more === 1 ? "r" : ""} Meilenstein${more === 1 ? "" : "e"} — alle unter „Zahlen“.`));
    }
    App.sheet("Geschafft", null, body);
    // Die Überschrift mittig, wie der Rest des Blatts. Der Titel
    // bleibt ein echtes Element — er beschriftet den Dialog.
    document.getElementById("sheet").classList.add("celebration");
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
    sheet.classList.remove("celebration");
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
    App._storeSig = null;          // beim Öffnen frisch aufbauen
    document.getElementById("store").hidden = false;
    document.body.style.overflow = "hidden";
    App.renderStore();
  },
  closeStore() {
    App.storeOpen = false;
    App._storeSig = null;
    document.getElementById("store").hidden = true;
    document.body.style.overflow = "";
    App.render();
  },

  /**
   * Der Ladenmodus baut sich NICHT bei jedem Abhaken neu auf.
   *
   * Er hing bisher am allgemeinen Neuzeichnen: ein Tippen änderte den
   * Zustand, das Neuzeichnen warf die Liste weg und setzte sie neu —
   * die neue Zeile war von Anfang an durchgestrichen, und ein Übergang
   * von „nicht durchgestrichen“ nach „durchgestrichen“ fand nie statt.
   * Genau der soll aber zu sehen sein.
   *
   * Deshalb: solange dieselben Positionen in derselben Reihenfolge
   * anstehen, bleiben die Knöpfe stehen und es wechselt nur ihre
   * Klasse. Nebenbei ist das auch schneller — im Laden wird jede
   * Position einmal angetippt.
   */
  renderStore() {
    const ctx = App.ctx;
    const S = Data.get();
    const active = ctx.items.filter((i) => i.on);
    const body = document.getElementById("storeBody");
    const groups = groupByAisle(active, ctx.aisleList);

    const signature = groups.map((g) => g.aisle + ":" + g.items.map((i) => i.productId).join(",")).join("|");
    if (App._storeSig !== signature) {
      App._storeSig = signature;
      App._storeNodes = new Map();
      body.innerHTML = "";

      // Gangreihenfolge kommt aus dem Modul, nicht aus einer Liste hier.
      groups.forEach(({ aisle, items }) => {
        body.append(el("div", "aisle", esc(aisle)));
        const box = el("div", "aisleGroup");
        items.forEach((i) => {
          const dup = ctx.duplicates.find((d) => d.productId === i.productId);
          const b = el("button", "sItem");
          b.innerHTML =
            `<span class="tick"></span>` +
            `<span class="sn"><span class="strike">${esc(i.name)}</span>` +
            `${dup ? `<small>${esc(dup.message)}</small>` : ""}</span>` +
            `<span class="sp">${eur(i.halved ? i.price / 2 : i.price)}</span>`;
          b.addEventListener("click", () => {
            // Erst sichtbar, dann gespeichert: der Strich läuft los,
            // bevor irgendetwas gerechnet wird.
            b.classList.toggle("done");
            b.setAttribute("aria-pressed", b.classList.contains("done") ? "true" : "false");
            Data.update((s) => {
              s.storeChecked = s.storeChecked.includes(i.productId)
                ? s.storeChecked.filter((x) => x !== i.productId)
                : [...s.storeChecked, i.productId];
            });
          });
          App._storeNodes.set(i.productId, b);
          box.append(b);
        });
        body.append(box);
      });

      if (!active.length) body.append(el("p", "empty", "Nichts auf der Liste."));
    }

    // Zustand auffrischen. Beim Neuaufbau geschieht das noch vor dem
    // ersten Bild, also ohne Animation — beim Öffnen soll nichts
    // durchgestrichen werden, was schon durchgestrichen war.
    App._storeNodes.forEach((node, pid) => {
      const done = S.storeChecked.includes(pid);
      node.classList.toggle("done", done);
      node.setAttribute("aria-pressed", done ? "true" : "false");
    });

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
        const res = Data.addReceipt({
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
        else App.toast(`${res.count} Positionen gebucht`, { detail: bookedDetail(res) });
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
    if (App.tab === "zahlen" || App.tab === "bestand" || App.tab === "faellig") {
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

    const first = !App._seeded;
    App._seeded = true;
    App.checkBadges(first);
  },

  /* ---------- Wochenrückblick ---------- */
  /**
   * Erinnerung am Sonntagabend.
   *
   * EHRLICH BLEIBEN: Das ist keine echte Push-Nachricht. Ohne Server
   * kann niemand die App von außen wecken — und einen Server hat
   * diese App bewusst nicht. Die Meldung erscheint deshalb beim
   * nächsten Öffnen, wenn der Rückblick fällig ist. Genau so steht
   * es auch in der Einstellung.
   */
  maybeNotifyReview() {
    const S = Data.get();
    const r = App.ctx.review;
    if (!S.review.notify || !r.due) return;
    if (S.review.lastNotifiedWeek === r.weekKey) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("Wochenrückblick", { body: r.headline, icon: "icons/icon-192.png", tag: "rueckblick" });
      Data.markReviewNotified(r.weekKey);
    } catch (e) {
      console.warn("Erinnerung nicht möglich:", e);
    }
  },

  /** Erlaubnis für die Erinnerung einholen. */
  askNotify(on) {
    if (!on) { Data.update((s) => { s.review.notify = false; }); return; }
    if (typeof Notification === "undefined") {
      App.toast("Dieser Browser kann das nicht", { icon: "!" });
      return;
    }
    const apply = (perm) => {
      Data.update((s) => { s.review.notify = perm === "granted"; });
      if (perm !== "granted") App.toast("Ohne Erlaubnis geht es nicht", { icon: "!" });
    };
    if (Notification.permission === "granted") return apply("granted");
    const res = Notification.requestPermission(apply);
    if (res && typeof res.then === "function") res.then(apply).catch(() => apply("denied"));
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
  App.maybeNotifyReview();

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
