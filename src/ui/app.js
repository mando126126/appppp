/* ================================================================
   app.js — Rahmen: Navigation, Kopfbereich, Ladenmodus, Blätter.
   Die Ansichten stehen in views.js, die Berechnung in data.js.
   ================================================================ */

const NAV = [
  {
    // Die Startseite ist nicht mehr die Liste. Begründung steht bei
    // viewStart: eine Liste ist ein Werkzeug für den Moment vor dem
    // Einkauf, keine Antwort auf „was kommt auf mich zu?“.
    id: "start", label: "Start", title: "Übersicht", view: viewStart,
    icon: '<path d="M4 11.2L12 4.5l8 6.7"/><path d="M6.2 12.6V19a1 1 0 001 1h9.6a1 1 0 001-1v-6.4"/><path d="M10 20v-4.6h4V20"/>'
  },
  {
    id: "liste", label: "Liste", title: "Einkaufsliste", view: viewListe,
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

/* Ansichten ohne eigenen Platz in der Leiste.
 *
 * „Fällig“ war ein siebter Reiter, und sieben passen unten nicht
 * nebeneinander. Verschwunden ist die Seite deshalb nicht: sie hängt
 * jetzt an der Zeile „tauschen“ auf der Startseite und behält ihre
 * eigene Adresse (#faellig) — Lesezeichen und der Zurück-Knopf
 * funktionieren weiter. `parent` sagt, welcher Reiter währenddessen
 * als aktiv gilt; ohne das stünde die Leiste auf keinem Eintrag und
 * die App fühlte sich verloren an. */
const SUBVIEWS = [
  {
    id: "faellig", label: "Fällig", title: "Fällig", view: viewFaellig, parent: "start",
    icon: '<circle cx="12" cy="12.5" r="8"/><path d="M12 8.5v4.2l2.8 1.7"/><path d="M9 3h6"/>'
  },
  {
    id: "angebote", label: "Angebote", title: "Angebote", view: viewAngebote, parent: "start",
    icon: '<path d="M12 3.5l2.4 5.1 5.6.8-4 4 1 5.6-5-2.6-5 2.6 1-5.6-4-4 5.6-.8z"/>'
  }
];

const VIEWS = [...NAV, ...SUBVIEWS];

/** Der Eintrag zu einer Adresse — Reiter oder Unteransicht. */
const viewFor = (id) => VIEWS.find((v) => v.id === id) || NAV[0];

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
  tab: "start",
  ctx: null,
  storeOpen: false,
  capture: { tab: "scan", text: "", parsed: null, basket: [], query: "", date: null, store: "" },
  // Aus dem System-Teilen-Menü übernommen (REWE, Lidl & Co. → „eBon
  // teilen" → Einkaufs-Anker). Wird einmal von ocrPicker() abgeholt
  // und danach sofort geleert — kein dauerhafter Zustand, keine
  // Sicherung nötig.
  pendingShare: null,
  // Nur die Ansicht, nicht der Haushalt: der gewählte Zeitraum in
  // "Wo dein Geld hingeht" ist eine Anzeige-Einstellung, kein
  // Haushaltsdatum -- sie geht deshalb nicht über Data.update() und
  // landet nicht in der Sicherung. Ein Neuladen setzt sie zurück,
  // das ist hier kein Verlust.
  zahlenFilter: { range: "12w", from: null, to: null },
  // Gleicher Grund wie bei zahlenFilter: reine Anzeige-Einstellung, welcher
  // Unterbereich gerade offen ist -- kein Haushaltsdatum, kein Data.update().
  zahlenTab: "ausgaben",
  mehrTab: "einstellungen",
  // Wie oft die Sprechblase je Reiter schon geöffnet wurde -- steuert
  // nur, welche der zutreffenden Aussagen als Nächstes dran ist
  // (mascotMessage() rotiert reihum, nicht zufällig). Reine
  // Anzeige-Einstellung wie zahlenFilter, kein Haushaltsdatum.
  mascotTapCount: {},
  // Welches Alarmsignal (siehe mascotAlarmSignature()) beim letzten
  // Antippen des Wesens sichtbar war -- null heißt "noch nie
  // angetippt". Weicht das aktuelle Signal davon ab, zeigt der
  // "neu"-Punkt an, dass seither etwas Neues aufgetaucht ist.
  mascotSeenAlarm: null,

  /* ---------- Zustand ändern ---------- */
  set(fn) { Data.update(fn); },

  /**
   * Holt ab, was der Worker aus dem Teilen-Menü zwischengelegt hat
   * (siehe sw.js, `handleShare`). Nur aktiv, wenn die URL das
   * verrät (`?teilen=1`) — an jedem gewöhnlichen Start ein einziger
   * synchroner Vergleich, kein Cache-Zugriff.
   *
   * Die URL wird sofort bereinigt, bevor überhaupt etwas gelesen ist:
   * schlägt das Lesen fehl, soll ein Neuladen nicht denselben Versuch
   * wiederholen und wieder scheitern.
   */
  async consumeSharedIfAny() {
    const url = new URL(location.href);
    if (!url.searchParams.has("teilen")) return;
    url.searchParams.delete("teilen");
    history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);

    if (!("caches" in window)) return;
    try {
      const cache = await caches.open("einkaufsanker-geteilt");
      const [textRes, datenRes] = await Promise.all([
        cache.match("./geteilt-text"), cache.match("./geteilt-datei")
      ]);
      const text = textRes ? await textRes.text() : "";
      const datei = datenRes ? await datenRes.blob() : null;
      await Promise.all([cache.delete("./geteilt-text"), cache.delete("./geteilt-datei")]);
      if (!text && !datei) return;

      App.pendingShare = { text, datei };
      App.tab = "erfassen";
      App.capture.tab = "scan";
      location.hash = "erfassen";
      App.render();
    } catch (e) {
      console.warn("Geteilten Bon nicht lesen können.", e);
    }
  },

  /**
   * Eine Wochenentscheidung zu einer Position festhalten.
   * `key` ist die Produktkennung — bei selbst ergänzten Zeilen deren
   * eigene Kennung, denn die haben womöglich gar kein Produkt.
   */
  choose(key, patch) {
    const item = App.ctx.items.find((i) => i.choiceKey === key);
    // Ein neu gesetzter Grund wird dauerhaft protokolliert, nicht nur
    // für diese Woche. Ohne das war die Rückmeldung folgenlos: wer
    // dreimal „hab noch da“ sagte, bekam das Produkt beim vierten Mal
    // wieder vorgeschlagen. Eine selbst ergänzte Zeile korrigiert
    // keinen Rhythmus — sie hat keinen.
    const previous = (Data.get().listChoices[key] || {}).reason || null;
    if (patch.reason && patch.reason !== previous && item && item.productId && item.basis !== "manuell") {
      Data.recordFeedback(item.productId, patch.reason, item.dueIn || 0);
    }

    Data.update((s) => {
      if (s.listWeek !== App.ctx.weekKey) { s.listWeek = App.ctx.weekKey; s.listChoices = {}; }
      const cur = s.listChoices[key] || {};
      const next = { ...cur, ...patch };
      if (patch.on === true) next.reason = null;
      // „War schon alle“ ist kein Abwahlgrund — das Produkt wird ja
      // gebraucht. Es korrigiert nur den Takt und bleibt auf der Liste.
      if (patch.reason !== undefined && patch.on === undefined) {
        next.on = patch.reason === "empty" ? cur.on !== false : false;
      }
      s.listChoices[key] = next;
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

  /**
   * Gang per Ziehen an eine bestimmte Stelle der SICHTBAREN
   * (relevanten) Liste bringen -- die Pfeiltasten bleiben für
   * Tastatur und Vorleseprogramm, das Ziehen ist der bequemere Weg
   * für viele Gänge auf einmal.
   *
   * Arbeitet auf derselben Volltliste und demselben moveAisle() wie
   * die Pfeiltasten, nur wiederholt: Gänge, die gerade nicht gekauft
   * werden, liegen irgendwo dazwischen und dürfen nicht mitgezählt
   * werden, deshalb prüft jeder Schritt die tatsächlich sichtbare
   * Reihenfolge (relevantAisles(), dieselbe Funktion, die auch die
   * Liste zeichnet) statt nur stur zu zählen.
   */
  reorderAisleTo(aisle, targetVisibleIndex) {
    const store = App.ctx.store;
    Data.update((s) => {
      const key = normalizeStore(store);
      let current = orderFor(store, s.aisleOrders);
      let guard = current.length * 2;
      while (guard-- > 0) {
        const sichtbar = relevantAisles(current, App.ctx.items);
        const an = sichtbar.indexOf(aisle);
        if (an === -1 || an === targetVisibleIndex) break;
        current = moveAisle(current, aisle, an < targetVisibleIndex ? 1 : -1);
      }
      s.aisleOrders[key] = current;
    });
  },

  goto(tab) {
    App.closeMascotBubble();
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

    // Beim allerersten Aufbau (Beispieldaten geladen, Sicherung
    // eingespielt) wird nicht gefeiert — sonst prasseln zwanzig
    // Auftritte hintereinander herunter für etwas, das der Nutzer
    // gerade nicht getan hat.
    if (!firstRun) App.celebrateAll(fresh);
  },

  /* ================================================================
     Der Auftritt
     ================================================================
     Ein Meilenstein ist der einzige Moment, in dem diese App etwas
     feiert. Er hat deshalb einen eigenen Auftritt und nicht dasselbe
     nüchterne Blatt wie eine Nachfrage: Vollbild, ein Aufblitzen in
     der Farbe der Reihe, ein Regen bunter Schnipsel — und eine Zahl,
     die wie eine Walze durchläuft und auf dem Wert stehen bleibt.

     WAS DABEI NICHT PASSIERT, und darauf kommt es an: Es wird
     nichts ausgespielt. Die Walze zeigt keinen Zufall, sie zählt zur
     ECHTEN Zahl hoch und hält dort. Kein „fast gewonnen", keine
     Kiste, die sich öffnet, kein zweiter Versuch. Der Reiz eines
     Glücksspiels kommt aus der Ungewissheit; hier kommt er daher,
     dass jemand etwas geschafft hat, und die Bewegung würdigt das
     nur. Alles andere wäre in einer App gegen Verschwendung eine
     merkwürdige Lehre.

     Wer keine Bewegung will (`prefers-reduced-motion`), bekommt
     dasselbe Fenster mit derselben Zahl, nur sofort und still.
     ================================================================ */

  /** Alle frisch erreichten nacheinander zeigen, größte zuerst. */
  celebrateAll(list) {
    App._party = (App._party || []).concat(list);
    if (!App._partyOpen) App.nextParty();
  },

  nextParty() {
    const queue = App._party || [];
    const badge = queue.shift();
    if (!badge) { App.closeParty(); return; }
    App.celebrate(badge, queue.length);
  },

  celebrate(badge, more = 0) {
    const still = App.reducedMotion();
    const box = document.getElementById("party");
    const card = document.getElementById("partyCard");
    const glow = document.getElementById("partyGlow");

    App.closeMascotBubble();
    App._partyOpen = true;
    box.hidden = false;
    box.className = "party show m-" + badge.id + (still ? " still" : "");
    glow.className = "partyGlow";

    // Ein Meilenstein ist der einzige Moment, in dem die Stimmung
    // nicht aus mascotMood(ctx) kommt: die Feier selbst ist der
    // Grund zur Freude, unabhängig davon, was sonst gerade ansteht.
    // Antippbar wie sein Gegenstück im Kopfbereich -- dieselbe
    // Sprechblase, derselbe Zähler, siehe togglePartyMascotBubble().
    const partyMascot = document.getElementById("partyMascot");
    partyMascot.innerHTML = mascotSvg("froh", 64);
    partyMascot.setAttribute("aria-label", App.mascotLabel(false));
    partyMascot.onclick = () => App.togglePartyMascotBubble();
    document.getElementById("partyKicker").textContent =
      badge.level >= badge.maxLevel ? "Höchste Stufe" : "Geschafft";
    document.getElementById("partyMark").innerHTML = markSvg(badge.icon);
    document.getElementById("partyTitle").textContent = badge.title;
    document.getElementById("partyLevel").textContent =
      `Stufe ${badge.level} von ${badge.maxLevel}`;
    document.getElementById("partyNote").textContent = badge.note;

    // Stufen als Punkte: was erreicht ist, ist voll. Das zeigt in
    // einem Blick, dass es weitergeht — ohne eine Zahl mehr.
    const pips = document.getElementById("partyPips");
    pips.innerHTML = "";
    for (let i = 1; i <= badge.maxLevel; i++) {
      pips.append(el("i", i <= badge.level ? "on" : null));
    }

    const go = document.getElementById("partyGo");
    go.textContent = more > 0 ? `Weiter (noch ${more})` : "Weiter";
    go.onclick = () => (more > 0 ? App.nextParty() : App.closeParty());

    App.rollNumber(badge, still);
    if (!still) App.burst(badge);

    // Der Knopf bekommt den Fokus, damit der Auftritt auch mit
    // Tastatur und Vorleseprogramm einen Ausgang hat.
    go.focus();
  },

  /**
   * Die Zahl läuft hoch und bleibt stehen.
   *
   * Nicht linear: der Anfang ist schnell, das Ende zäh
   * (Ease-Out-Quartik). Genau daran erkennt man eine Walze, die
   * ausläuft — eine gleichmäßig laufende Zahl wirkt wie ein
   * Ladebalken.
   */
  rollNumber(badge, still) {
    const out = document.getElementById("partyNum");
    const ziel = badge.threshold;
    const einheit = badge.unit === "€" ? " €" : "";
    const zeige = (n) => { out.textContent = de(Math.round(n)) + einheit; };

    if (App._rollTimer) cancelAnimationFrame(App._rollTimer);

    // Zuerst die richtige Zahl hinschreiben, dann erst hochlaufen
    // lassen. Wenn die Bewegung ausfällt — kein requestAnimationFrame,
    // Fenster im Hintergrund, Sparmodus —, steht trotzdem der echte
    // Wert da und nicht eine leere Fläche oder eine Null.
    zeige(ziel);
    if (still) return;

    const dauer = 1100;
    const start = performance.now();
    const schritt = (jetzt) => {
      const t = Math.min(1, (jetzt - start) / dauer);
      const eased = 1 - Math.pow(1 - t, 4);
      zeige(ziel * eased);
      if (t < 1) { App._rollTimer = requestAnimationFrame(schritt); return; }
      App._rollTimer = null;
      zeige(ziel);
      // Der kleine Stoß am Ende ist der Punkt, an dem die Walze
      // einrastet. Ohne ihn hört die Zahl einfach auf.
      out.classList.remove("land");
      void out.offsetWidth;
      out.classList.add("land");
    };
    App._rollTimer = requestAnimationFrame(schritt);
  },

  /** Schnipselregen. Reine Elemente mit CSS-Bewegung, keine Bibliothek. */
  burst(badge) {
    const feld = document.getElementById("partyBurst");
    feld.innerHTML = "";
    const STUECK = 28;
    for (let i = 0; i < STUECK; i++) {
      const p = el("i");
      // Auffächern statt Zufall über die ganze Breite: von der Mitte
      // nach außen, damit es aus dem Abzeichen zu kommen scheint.
      const winkel = (i / STUECK) * Math.PI * 2;
      // Weit genug, um hinter der Karte hervorzukommen: die ist rund
      // 340 Pixel breit, ein Wurf über 90 Pixel bliebe vollständig
      // dahinter verborgen. Genau das war der erste Versuch — die
      // Schnipsel flogen, sah nur niemand.
      const weite = 200 + (i % 5) * 62;
      p.style.setProperty("--x", `${Math.cos(winkel) * weite}px`);
      p.style.setProperty("--y", `${Math.sin(winkel) * weite - 40}px`);
      p.style.setProperty("--r", `${(i % 7) * 90}deg`);
      p.style.setProperty("--d", `${(i % 6) * 45}ms`);
      p.className = "p" + (i % 6);
      feld.append(p);
    }
    // Nach der Bewegung wieder wegräumen: 28 Elemente, die im
    // Hintergrund stehen bleiben, kosten bei jedem Neuzeichnen Zeit.
    clearTimeout(App._burstTimer);
    App._burstTimer = setTimeout(() => { feld.innerHTML = ""; }, 2400);
  },

  closeParty() {
    const box = document.getElementById("party");
    App.closeMascotBubble();
    App._partyOpen = false;
    App._party = [];
    if (App._rollTimer) { cancelAnimationFrame(App._rollTimer); App._rollTimer = null; }
    box.classList.remove("show");
    document.getElementById("partyBurst").innerHTML = "";
    // Erst nach dem Ausblenden verstecken, sonst springt es weg.
    clearTimeout(App._partyTimer);
    App._partyTimer = setTimeout(() => { box.hidden = true; }, App.reducedMotion() ? 0 : 220);
  },

  /** Systemeinstellung „weniger Bewegung" — sie gilt hier wirklich. */
  reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
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

    /* Oben anfangen, und den Fokus setzen, ohne dorthin zu springen.
       Vorher tat `focus()` beides: es setzte den Fokus auf „Fertig“
       ganz unten UND scrollte dorthin. Ein langes Blatt öffnete sich
       damit in seiner Mitte — beim Detail-Blatt einer Position hieß
       das, dass die Wochenentscheidung ganz oben unsichtbar blieb,
       obwohl sie der Grund ist, aus dem man das Blatt öffnet. */
    const body = sheet.querySelector(".sheetBody");
    if (body) body.scrollTop = 0;
    document.getElementById("sheetCancel").focus({ preventScroll: true });
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

  /* ---------- Das Wesen: Sprechblase ---------- */
  /**
   * Antippen öffnet oder schließt die Sprechblase -- kein Blatt, kein
   * Vollbild, nichts, was den Rest der Seite blockiert. Der Text kommt
   * aus mascotMessage(): regelbasiert, für den gerade offenen Reiter.
   * Ein Zähler je Reiter sorgt dafür, dass wiederholtes Antippen durch
   * die zutreffenden Aussagen rotiert statt jedes Mal dieselbe zu
   * zeigen -- deterministisch, nicht zufällig, damit es sich prüfen
   * lässt.
   *
   * Dieselbe Blase läuft an zwei Stellen im DOM: fest am Wesen im
   * Kopfbereich und, seit die Meilenstein-Feier ebenfalls ein
   * antippbares Wesen hat, in der Feier-Karte. Beide Aufrufstellen
   * unterscheiden sich nur in Blase und Schaltfläche, teilen sich
   * aber Zähler, Text und den "gesehen"-Stand des Alarmsignals.
   */
  toggleMascotBubble() { App._toggleBubble("mascotBubble", "mascotFab"); },
  togglePartyMascotBubble() { App._toggleBubble("partyMascotBubble", "partyMascot"); },

  _toggleBubble(bubbleId, anchorId) {
    const bubble = document.getElementById(bubbleId);
    const schonOffen = !bubble.hidden;
    App.closeMascotBubble();
    if (schonOffen) return;
    const seed = App.mascotTapCount[App.tab] || 0;
    App.mascotTapCount[App.tab] = seed + 1;
    App.mascotSeenAlarm = mascotAlarmSignature(App.ctx);
    bubble.textContent = mascotMessage(App.ctx, App.tab, seed);
    bubble.hidden = false;
    App._setMascotAnchorState(anchorId, true);
  },

  /** Beide Sprechblasen schließen -- Reiterwechsel, Escape, Klick daneben, Feierende. */
  closeMascotBubble() {
    [["mascotBubble", "mascotFab"], ["partyMascotBubble", "partyMascot"]].forEach(([bubbleId, anchorId]) => {
      const bubble = document.getElementById(bubbleId);
      if (!bubble || bubble.hidden) return;
      bubble.hidden = true;
      App._setMascotAnchorState(anchorId, false);
    });
  },

  _setMascotAnchorState(anchorId, offen) {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    anchor.setAttribute("aria-expanded", String(offen));
    anchor.setAttribute("aria-label", App.mascotLabel(offen));
    // Der Punkt hängt an mascotSeenAlarm, das sich gerade geändert
    // haben kann -- ohne diesen Aufruf bliebe er bis zum nächsten
    // App.render() stehen, obwohl das Antippen ihn schon erledigt hat.
    App.syncMascotNewDot();
  },

  /** Zeigt/verbirgt den "neu"-Punkt am Wesen im Kopfbereich. */
  syncMascotNewDot() {
    if (!App.ctx) return;
    const fab = document.getElementById("mascotFab");
    const sig = mascotAlarmSignature(App.ctx);
    fab.classList.toggle("hasNew", !!sig && sig !== App.mascotSeenAlarm);
  },

  /**
   * Beschriftung des Wesens -- nennt auch, wenn seit dem letzten
   * Antippen ein neues Alarmsignal aufgetaucht ist (Kühlkette,
   * Verderb heute). Derselbe Text steht als "Neu: "-Präfix im
   * aria-label, damit die Information nicht nur am Punkt aus app.css
   * hängt, den ein Vorleseprogramm nicht sieht.
   */
  mascotLabel(offen) {
    const sig = mascotAlarmSignature(App.ctx);
    const neu = sig && sig !== App.mascotSeenAlarm;
    const basis = offen ? "Hinweis vom Wesen schließen" : "Hinweis vom Wesen anzeigen";
    return neu ? "Neu: " + basis : basis;
  },

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

  /* ---------- Der Wagen ----------
   * EIN HAKEN, EINE BEDEUTUNG.
   *
   * Vorher gab es zwei Kreise, die gleich aussahen und Verschiedenes
   * meinten: der in der Liste hieß „steht diese Woche drauf", der im
   * Ladenmodus „liegt im Wagen". Gleiche Form, gleiche Geste,
   * verschiedener Sinn — und der wahrscheinlichste Fehlgriff der
   * ganzen App: wer im Laden die Liste statt den Ladenmodus benutzt,
   * hakt seinen Einkauf ab, bucht nichts, und die App lernt aus
   * diesem Einkauf nie etwas. Still, ohne Fehlermeldung.
   *
   * Jetzt heißt der Kreis überall dasselbe. Der Ladenmodus ist kein
   * eigener Zustand mehr, sondern eine andere SICHT auf denselben
   * Wagen — nach Gängen sortiert, mit großen Zielen. Was man in der
   * einen antippt, steht in der anderen.
   *
   * Die Wochenentscheidung („brauche ich diese Woche nicht") ist
   * dadurch aus dem Kreis ausgezogen und hat im Detail-Blatt ein
   * eigenes, benanntes Zuhause bekommen.
   */

  /**
   * Schlüssel ist die `choiceKey`, nicht die Produktkennung.
   *
   * Bei Katalogprodukten sind beide gleich — bestehende Wagen bleiben
   * also gültig. Bei frei eingetippten Zeilen ist die Produktkennung
   * `null`, und `[null, null].includes(null)` ist für zwei
   * verschiedene Zeilen dieselbe Antwort: sie hätten sich einen
   * Haken geteilt.
   */
  toggleCart(key) {
    Data.update((s) => {
      s.storeChecked = s.storeChecked.includes(key)
        ? s.storeChecked.filter((x) => x !== key)
        : [...s.storeChecked, key];
    });
  },

  /** Was gerade im Wagen liegt — aus der Liste dieser Woche. */
  cartItems(ctx) {
    const gewaehlt = new Set(Data.get().storeChecked);
    return (ctx || App.ctx).items.filter((i) => i.on && gewaehlt.has(i.choiceKey));
  },

  /**
   * Den Wagen als Bon buchen. EIN Weg, zwei Knöpfe.
   *
   * Vorher hing dieser Ablauf im Ladenmodus fest. Damit die Liste
   * denselben Abschluss anbieten kann, ohne ihn nachzubauen — zwei
   * Fassungen desselben Buchungswegs wären genau die Doppelpflege,
   * bei der Fassungen auseinanderlaufen — steht er hier.
   */
  bookCart() {
    const inCart = App.cartItems();
    if (!inCart.length) return;
    const sum = inCart.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    App.confirm(
      "Einkauf buchen?",
      `${inCart.length} ${inCart.length === 1 ? "Position" : "Positionen"} für ${eur(sum)} kommen in die Historie. ` +
      "Daraus lernt die App die Rhythmen.",
      () => {
        // Nur Katalogprodukte: eine frei eingetippte Zeile hat kein
        // Produkt und damit auch keine Sicherheitsangabe.
        const alert = safetyAlert(inCart.filter((i) => i.productId && byId(i.productId)));
        const res = Data.addReceipt({
          date: Data.today(),
          store: App.ctx.store || "Einkauf",
          items: inCart.map((i) => ({
            productId: i.productId,
            quantity: 1,
            unitPrice: i.halved ? i.price / 2 : i.price
          }))
        });
        if (App.storeOpen) App.closeStore();
        // Sicherheitshinweis im richtigen Moment: beim Verlassen des
        // Ladens, nicht drei Tage später in einer Liste.
        if (alert) App.notice("Kühlkette", alert.message);
        else App.toast(`${zahlwort(res.count, "Position", "Positionen")} gebucht`, { detail: bookedDetail(res) });
      },
      "Buchen"
    );
  },

  /* ---------- Ladenmodus: dieselbe Liste, nach Gängen ---------- */
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
            App.toggleCart(i.choiceKey);
          });
          App._storeNodes.set(i.choiceKey, b);
          box.append(b);
        });
        body.append(box);
      });

      if (!active.length) body.append(el("p", "empty", "Nichts auf der Liste."));
    }

    // Zustand auffrischen. Beim Neuaufbau geschieht das noch vor dem
    // ersten Bild, also ohne Animation — beim Öffnen soll nichts
    // durchgestrichen werden, was schon durchgestrichen war.
    App._storeNodes.forEach((node, key) => {
      const done = S.storeChecked.includes(key);
      node.classList.toggle("done", done);
      node.setAttribute("aria-pressed", done ? "true" : "false");
    });

    const inCart = App.cartItems(ctx);
    const sum = inCart.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    document.getElementById("storeProg").textContent = `${inCart.length} von ${active.length}`;
    document.getElementById("storeSum").textContent = eur(sum);

    // Abschluss: den Einkauf gleich als Bon buchen. Ohne diesen Schritt
    // bliebe der Kreislauf offen — die Liste würde nie zu Historie.
    /* Dieselbe Aufschrift wie in der Liste. Es ist derselbe Knopf,
       derselbe Wagen und dieselbe Funktion (`bookCart`) — er hieß
       hier nur „3 buchen“ und dort „Einkauf buchen“, und war damit
       der einzige klein geschriebene Knopf der ganzen App. Die
       Anzahl steht ohnehin schon zweimal auf dieser Ansicht: oben
       als „3 von 8“ und links daneben als Betrag. */
    const done = document.getElementById("storeDone");
    done.disabled = !inCart.length;
    done.onclick = () => App.bookCart();
  },

  /**
   * Gruß nach Tageszeit.
   *
   * Vier Abschnitte, keine Uhrzeit auf die Minute — „Guten Abend“ um
   * 17:59 und „Guten Tag“ um 18:01 wäre eine Genauigkeit, die
   * niemand will. Nachts steht bewusst kein „Guten Morgen“: wer um
   * halb zwei einkaufen plant, soll nicht angelogen werden.
   */
  greeting(hour) {
    const h = hour === undefined ? new Date().getHours() : hour;
    if (h < 5) return "Noch wach";
    if (h < 11) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  },

  /* ---------- Kopfbereich ---------- */
  renderBar() {
    const ctx = App.ctx;
    const S = Data.get();
    const entry = viewFor(App.tab);

    const bar = document.getElementById("appbar");
    bar.innerHTML = "";
    const rowEl = el("barRow" === "" ? "div" : "div", "barRow");
    /* Die Übersicht grüßt, statt sich zu benennen.
     *
     * „Übersicht“ als Überschrift über einer Übersicht sagt nichts —
     * man sieht ja, worauf man ist. Die Tageszeit dagegen macht aus
     * der Seite einen Ort, an dem jemand ankommt. Für die Zielgruppe
     * dieser App war genau das der Unterschied zwischen „Werkzeug“
     * und „meine App“. */
    const titel = App.tab === "start" ? App.greeting() : entry.title;
    rowEl.append(el("div", "barTitle", esc(titel)));

    const actions = el("div", "barActions");
    if (App.tab === "liste" && ctx.items.some((i) => i.on)) {
      /* Hieß „Im Laden" und klang damit nach einem eigenen Zustand,
         den man betritt und verlässt. Es ist keiner: dieselbe Liste,
         derselbe Wagen, nur nach Gängen sortiert und mit großen
         Zielen. Der Name sagt das jetzt. */
      const b = el("button", "barBtn filled", "Nach Gängen");
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
    // Trägt die Leiste rechts einen Knopf, steht der Titel links von
    // Anfang an da statt erst nach dem Scrollen -- sonst hinge der
    // Knopf beim ersten Bild allein da, ohne irgendetwas links davon.
    bar.classList.toggle("hasActions", actions.children.length > 0);

    // Großer Titel im Inhalt — fällt beim Scrollen in die Leiste zusammen.
    const large = document.getElementById("largeTitle");
    large.innerHTML = "";
    const textBlock = el("div", "largeTitleText");
    large.append(textBlock);
    textBlock.append(el("h1", null, esc(titel)));
    const sub = el("div", "sub");
    // Auf der Liste beschreibt die Unterzeile die LISTE, nicht die
    // Datenlage. „57 Bons · 29 Produkte“ beantwortet eine Frage, die
    // hier niemand hat — die Frage ist: was steht drauf und was
    // kostet es?
    let subText;
    if (!ctx.history.length) {
      subText = "noch keine Daten — leg mit einem Einkauf los";
    } else if (App.tab === "start") {
      // Auf der Übersicht: das Datum. Es ist die einzige Angabe, die
      // dem Wochenstreifen darunter etwas hinzufügt.
      subText = `${ctx.weekday}, ${deDate(ctx.ref)}`;
    } else if (App.tab === "liste") {
      /* Auch in den frühen Wochen: die Unterzeile beschreibt die
         LISTE. Sie war an Stufe 2 gebunden und fiel davor auf
         „57 Bons · 29 Produkte“ zurück — eine Auskunft über die
         Datenlage auf einer Seite, auf der man wissen will, was
         drauf steht und was es kostet. */
      const on = ctx.items.filter((i) => i.on);
      const sum = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
      const wann = ctx.pattern && ctx.pattern.dayName ? `für ${ctx.pattern.dayName}` : `ab ${ctx.weekday}`;
      subText = on.length
        ? `${wann} · ${on.length} ${on.length === 1 ? "Position" : "Positionen"} · ${eur(sum)}`
        : `${wann} · noch nichts drauf`;
    } else {
      subText = `${ctx.weekday} · ${zahlwort(ctx.totals.receipts, "Bon", "Bons")} · ${zahlwort(ctx.rhythms.size, "Produkt", "Produkte")}`;
    }
    sub.append(document.createTextNode(subText));
    // Erzeugte Historie bleibt dauerhaft als solche gekennzeichnet.
    if (S.settings.demo) {
      const tag = el("button", "pill warn", "Beispieldaten");
      tag.title = "Diese Historie ist erzeugt, nicht erfasst. Hier tippen, um sie zu ersetzen.";
      tag.addEventListener("click", () => App.goto("mehr"));
      sub.append(tag);
    }
    textBlock.append(sub);

    // Das Wesen: fest positioniert außerhalb von largeTitle (siehe
    // index.html, app.css .mascotFab) -- renderBar() aktualisiert nur
    // sein Aussehen, nie seinen Ort im DOM, damit es auch beim
    // Scrollen an derselben Bildschirmstelle bleibt. Die Stimmung
    // kommt aus mascotMood(ctx), beide lesen nur Signale, die es
    // schon gibt.
    const fab = document.getElementById("mascotFab");
    fab.innerHTML = mascotSvg(mascotMood(ctx), 46);
    App.syncMascotNewDot();
    const offen = !document.getElementById("mascotBubble").hidden;
    fab.setAttribute("aria-expanded", String(offen));
    fab.setAttribute("aria-label", App.mascotLabel(offen));
    fab.onclick = () => App.toggleMascotBubble();
  },

  renderNav() {
    const nav = document.getElementById("nav");
    nav.innerHTML = "";
    // Eine Unteransicht lässt den Reiter aktiv, zu dem sie gehört.
    const aktiv = viewFor(App.tab).parent || App.tab;
    NAV.forEach((n) => {
      const b = el("button", null,
        `<svg viewBox="0 0 24 24" aria-hidden="true">${n.icon}</svg><span>${n.label}</span>`);
      if (aktiv === n.id) b.setAttribute("aria-current", "page");
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
  /**
   * Aufräumarbeit für die nächste Neuzeichnung anmelden.
   *
   * Die Ansichten hängen ihre Hörer an ihre eigenen Elemente — die
   * verschwinden mit `innerHTML = ""` von selbst. Wer aber am
   * Dokument lauscht (die Bilderfassung tut das, für Einfügen mit
   * der Tastatur), überlebt jede Neuzeichnung. Nach zehn Wechseln
   * hingen sonst zehn Hörer da und ein eingefügtes Bild würde
   * zehnmal gelesen.
   */
  onLeaveView(fn) { (App._cleanup || (App._cleanup = [])).push(fn); },

  render() {
    (App._cleanup || []).forEach((fn) => { try { fn(); } catch (e) { /* egal */ } });
    App._cleanup = [];

    App.ctx = Data.compute();
    App.applyTheme();
    App.renderBar();
    App.renderNav();

    const main = document.getElementById("main");
    main.innerHTML = "";
    const entry = viewFor(App.tab);
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
  if (VIEWS.some((n) => n.id === hash)) App.tab = hash;

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (VIEWS.some((n) => n.id === h) && h !== App.tab) { App.tab = h; App.render(); }
  });

  window.addEventListener("scroll", App.onScroll, { passive: true });

  // Systemweiter Wechsel hell/dunkel, solange „System“ eingestellt ist.
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
  const irgendeineSprechblaseOffen = () =>
    !document.getElementById("mascotBubble").hidden || !document.getElementById("partyMascotBubble").hidden;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("sheet").hidden) App.closeSheet();
    else if (App.storeOpen) App.closeStore();
    else if (irgendeineSprechblaseOffen()) App.closeMascotBubble();
  });
  // Sprechblase ist absichtlich kein Blatt -- also schließt sie auch
  // nicht wie eines, sondern wie jedes andere Popover: ein Tipp
  // irgendwo sonst auf der Seite räumt sie weg. Gilt für beide
  // Blasen -- die am Kopfbereich und die in der Feier-Karte.
  document.addEventListener("click", (e) => {
    if (!irgendeineSprechblaseOffen()) return;
    if (e.target.closest("#mascotBubble, #mascotFab, #partyMascotBubble, #partyMascot")) return;
    App.closeMascotBubble();
  });

  Data.subscribe(() => App.render());
  App.render();
  App.consumeSharedIfAny();

  const rec = Data.recoveryNotice();
  if (rec) {
    App.notice(rec.level === "gerettet" ? "Stand wiederhergestellt" : "Daten verloren",
      rec.message + (rec.level === "gerettet"
        ? "\n\nEs kann sein, dass die letzten Änderungen fehlen. Sieh die letzten Bons durch."
        : ""));
  } else {
    App.maybeNotifyReview();
  }

  /* Service Worker: macht die App offline nutzbar. Fehlschlag ist
     kein Grund zum Abbruch — die App läuft auch ohne.

     Übersprungen wird er, wenn kein Manifest verlinkt ist. Das ist
     kein Umweg, sondern das ehrliche Kennzeichen: eine Seite ohne
     Manifest ist keine installierbare App, sondern eine Vorschau in
     einer einzelnen Datei (tools/preview.js). Dort gäbe es keine
     sw.js, und die Anmeldung liefe in einen 404 — sichtbar nur in
     der Entwicklerkonsole, aber eben doch ein Fehler, der keiner
     sein muss. */
  const alsAppInstallierbar = !!document.querySelector('link[rel="manifest"]');
  if ("serviceWorker" in navigator && location.protocol !== "file:" && alsAppInstallierbar) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline-Betrieb nicht verfügbar:", e));
    });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
