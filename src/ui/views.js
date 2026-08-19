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

/* DREI ANTWORTEN, ZWEI FRAGEN.
   ----------------------------------------------------------------
   Es waren vier unter einer Frage, und zwei davon passten dort nicht:

   „VERBRAUCHT" ist ersatzlos weg. Sie bewirkte im ganzen Programm
   exakt dasselbe wie „Diese Woche nicht" — `on: false`, kein Signal
   an den Rhythmus, dieselbe Protokollzeile. Zwei Knöpfe, ein Effekt,
   und keine Möglichkeit zu wissen, welchen man nehmen soll. Dazu
   stand sie inhaltlich verkehrt herum: aufgebraucht ist ein Grund,
   etwas zu KAUFEN, nicht es wegzulassen. (In wasteInference2 steht
   eine `reconcileWithUserInput`, die „verbraucht" als „ich habe es
   gegessen, nicht weggeworfen" auswerten würde — sie wird nirgends
   aufgerufen. Das wäre ein echter Zweck, aber im Bestand, nicht auf
   der Einkaufsliste.)

   „WAR SCHON ALLE" bleibt, steht aber nicht mehr unter „Brauchst du
   das diese Woche?". Sie ist die einzige Antwort dort, die die
   Position DRAUF lässt — man tippt sie an, das Blatt schließt sich,
   und scheinbar passiert nichts. Sie beantwortet auch eine andere
   Frage: nicht „brauchst du das?", sondern „war ich rechtzeitig?".

   Ihr Platz ist jetzt der Moment, in dem sie wahr wird — beim
   Hinzufügen eines Produkts, das noch gar nicht fällig war. Siehe
   `askLate`. Denn sie ist zugleich die WICHTIGSTE: „Hab noch"
   verlängert den gelernten Abstand, und nur diese hier verkürzt ihn.
   Ohne sie könnte der Nutzer nur in eine Richtung korrigieren, und
   die App bliebe systematisch zu spät dran.                        */
const REASONS = [
  { key: "have", label: "Hab noch" },
  { key: "empty", label: "War schon alle" },
  { key: "skip", label: "Diese Woche nicht" }
];

/* Was im Blatt einer Position zur Wahl steht: die Wochenfrage, und
   die beantworten genau diese beiden. */
const WEEK_REASONS = ["have", "skip"];

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

/* ================================================================
   Was bedeutet dieses Zeichen?
   ================================================================
   Die Liste ist voller kleiner Marken: „von dir“, „+8 %“, „doppelt?“,
   „VD“, „3 T“. Sie sind kurz, weil eine Zeile schmal ist — und genau
   deshalb erklärt sich keine von selbst. Wer „+8 %“ liest, weiß
   nicht, ob das Mehrwertsteuer, Rabatt oder Preisänderung ist, und
   niemand tippt eine Zeile an, um das herauszufinden.

   Also: jede Marke ist antippbar und erklärt sich. Auf dem Rechner
   reicht das Verweilen mit dem Zeiger (`title`), auf dem Telefon —
   wo es kein Verweilen gibt — öffnet ein Tippen dasselbe Blatt, das
   auch hinter den (i) steckt.

   Die Texte sind GENERISCH. Sie erklären die Art der Marke, nicht den
   Einzelfall: „so entsteht diese Zahl“, nicht „deine Äpfel sind 8 %
   teurer“. Der Einzelfall steht im Detail-Blatt, das eine Zeile
   weiter aufgeht — hier geht es um die Frage „was ist das für ein
   Zeichen?“, und die stellt man einmal, nicht bei jedem Produkt neu.
   ================================================================ */
const PILL_INFO = {
  own: ["Von dir ergänzt",
    "Diese Zeile hast du selbst auf die Liste gesetzt, die App hat sie nicht vorgeschlagen.\n\n" +
    "Selbst ergänzte Zeilen verändern keinen Rhythmus: aus einem einmaligen Wunsch lernt die App " +
    "keinen Kaufabstand. Sie gelten für eine Woche und verschwinden mit dem nächsten gebuchten Einkauf."],

  ueberfaellig: ["Überfällig",
    "Der aus deinen Käufen gelernte Abstand ist überschritten — so viele Tage länger als sonst ist es " +
    "her.\n\nDas ist eine Schätzung aus deiner Historie, keine Ansage. Wenn du das Produkt noch hast, " +
    "sag es der App: sie rechnet die Antwort in den Rhythmus ein."],

  risiko: ["Verderb-Risiko",
    "Von diesem Produkt landet bei dir überdurchschnittlich viel im Müll. Der Prozentsatz ist der " +
    "geschätzte Anteil, der bisher verdorben ist.\n\nGeschätzt heißt: die App sieht, dass wieder " +
    "gekauft wurde, bevor die Haltbarkeit reichen konnte. Sie hat nicht in deinen Kühlschrank geschaut."],

  vd: ["Verbrauchsdatum",
    "Dieses Produkt trägt ein Verbrauchsdatum, kein Mindesthaltbarkeitsdatum. Das ist ein " +
    "rechtlicher Unterschied, kein sprachlicher.\n\nNach Ablauf darf es nicht mehr verzehrt werden — " +
    "hier verlängert die App niemals etwas und schlägt auch keine Resteverwertung vor."],

  teuer: ["Über deinem üblichen Preis",
    "Verglichen wird mit DEINEM üblichen Preis: dem Median dessen, was du für dieses Produkt bisher " +
    "gezahlt hast.\n\nKein Vergleich zwischen Märkten — dafür hat die App keine Daten, und fremde " +
    "Preise wären erfunden. Der Median statt des Durchschnitts, damit ein einzelnes Angebot den " +
    "Bezugswert nicht verschiebt."],

  guenstig: ["Unter deinem üblichen Preis",
    "Günstiger als der Median deiner bisherigen Käufe dieses Produkts.\n\nNur diese Differenz zählt " +
    "die App als tatsächlich gesparte Euros — sie ist nachrechenbar, im Gegensatz zu allem " +
    "Geschätzten."],

  doppelt: ["Vielleicht doppelt",
    "Etwas sehr Ähnliches steht schon auf der Liste oder wurde gerade erst gekauft.\n\nDie App " +
    "streicht deshalb nichts — sie fragt nur. Manchmal braucht man wirklich zwei."],

  zustand: ["Deine Antwort",
    "Deine Rückmeldung zu diesem Vorschlag, für diese Woche festgehalten.\n\nSie bleibt nicht ohne " +
    "Folgen: „hab ich noch“ verlängert den gelernten Abstand, „war schon leer“ verkürzt ihn. Deshalb " +
    "lohnt sich das Antippen mehr als das bloße Abwählen."],

  rest: ["Resthaltbarkeit",
    "Geschätzte Tage, die dieses Produkt bei richtiger Lagerung noch hat — gerechnet ab dem Kaufdatum " +
    "mit dem Katalogwert.\n\nEine Schätzung, kein Datum von der Packung. Was du aufgedruckt hast, " +
    "gilt immer mehr als diese Zahl."],

  haltbar: ["Lange haltbar",
    "Bei diesem Produkt ist die Haltbarkeit kein Thema — Reis, Nudeln, Konserven.\n\nDie App zeigt " +
    "deshalb keine Tage: eine Zahl wie „400 T“ wäre richtig und trotzdem nutzlos."],

  kuehlen: ["Kühlkette",
    "Dieses Produkt sollte auf dem Heimweg gekühlt bleiben.\n\nDer Hinweis kommt beim Verlassen des " +
    "Ladens und nur bei Produkten mit Verbrauchsdatum. Bei jedem Einkauf gezeigt, würde er " +
    "weggetippt — und dann fehlte er, wenn er zählt."],

  angebrochen: ["Angebrochen",
    "Als geöffnet vermerkt. Eine offene Packung hält nicht mehr so lange wie eine geschlossene — die " +
    "App rechnet ab dem Öffnen mit der kürzeren Frist.\n\nOhne diesen Zustand schätzt sie den " +
    "Vorrat zu großzügig."],

  marke: ["Herstellermarke",
    "Auf der Bonzeile stand ein Markenname.\n\nDie Marke wird nur für den Preisvergleich " +
    "festgehalten. Für die Produktzuordnung wird sie weggeworfen — sonst wären „Marken-Butter“ und " +
    "„Butter“ für die App zwei verschiedene Dinge."],

  zerowaste: ["Zero Waste",
    "Alles, was dafür sorgt, dass nichts weggeworfen werden muss: Kühlkette, was zuerst " +
    "aufgebraucht werden sollte, was sich einzufrieren lohnt, ein Vorratskauf, der nicht aufgeht, " +
    "vergessene Produkte, Saison und Lagerung.\n\nDer gemeinsame Nenner ist der Zeitpunkt: jeder " +
    "dieser Hinweise kommt, solange sich noch etwas machen lässt. Hinterher wäre es eine Bilanz " +
    "und keine Hilfe."],

  hoard: ["Vorratskauf",
    "Ungewöhnlich viel von einem Produkt auf einmal — mindestens das Dreifache deiner sonstigen " +
    "Menge.\n\nBei Haltbarem ist das eine gute Sache, besonders zum guten Preis, und die App " +
    "schlägt das Produkt dann so lange nicht vor, wie der Vorrat reicht. Bei Verderblichem rechnet " +
    "sie nach, wie viel davon über der Frist läge — das ist eine Vorhersage und keine Bilanz."],

  hinweise: ["Hinweise",
    "Alles, was die App zu sagen hat außer der Liste selbst: Kühlkette, vergessene Produkte, was sich " +
    "einzufrieren lohnt, Saison und Lagerhinweise.\n\nDiese Hinweise standen früher einzeln auf der " +
    "Startseite. Sie sind nicht weniger geworden — sie stehen nur nicht mehr im Weg."],

  gesichert: ["Sicherung",
    "Zeigt, ob die Daten außerhalb dieses Browsers liegen.\n\nEine Sicherungsdatei ist das Einzige, " +
    "was „Browserdaten löschen“, ein neues Gerät oder einen kaputten Speicher überlebt. Die App hat " +
    "keinen Server, der einspringen könnte — das ist Absicht und deshalb deine Datei."],

  gefaehrdet: ["Nicht gesichert",
    "Alles Gelernte liegt nur in diesem Browser: Rhythmen, Rückmeldungen, Meilensteine.\n\nEs gibt " +
    "kein Konto, mit dem sich das wiederherstellen ließe. Eine Datei herunterzuladen dauert einen " +
    "Wimpernschlag und ist der Unterschied zwischen einem Ärgernis und drei verlorenen Jahren."],

  tauschen: ["Zum Tauschen fällig",
    "Manche Haushaltsprodukte werden nach Zeit gewechselt, nicht nach Verbrauch — Zahnbürste, " +
    "Spülschwamm, Rasierklinge.\n\nDie Frist kommt aus dem Intervall des Produkts und läuft ab dem " +
    "letzten Wechsel. „Getauscht“ setzt den Zähler zurück, auch wenn nichts gekauft wurde."],

  eigenmarke: ["Eigenmarke",
    "Die Handelsmarke des Händlers — ja!, Gut&Günstig, K-Classic, Milbona und so weiter.\n\n" +
    "Die App empfiehlt nichts davon. Sie zeigt nur, was der Unterschied bei dir ausmachen würde."]
};

/**
 * Eine antippbare Marke. `key` wählt die Erklärung, `cls` die Farbe —
 * getrennt, weil dieselbe Farbe verschiedene Dinge bedeutet: die
 * gelbe Marke steht mal für „überfällig“, mal für „teurer als
 * üblich“. Aus der Farbe die Erklärung abzuleiten, hätte genau dort
 * still den falschen Text gezeigt.
 */
function pill(key, cls, label) {
  const info = PILL_INFO[key];
  const e = el("span", "pill " + cls, esc(label));
  if (!info) return e;                       // unbekannter Schlüssel: stumm, aber sichtbar
  e.setAttribute("role", "button");
  e.setAttribute("tabindex", "0");
  e.setAttribute("title", info[0]);          // Zeiger auf dem Rechner
  e.setAttribute("aria-label", `${label} — ${info[0]}, Erklärung anzeigen`);
  const open = (ev) => {
    // Sonst öffnet zusätzlich das Detail-Blatt der Zeile darunter.
    ev.stopPropagation();
    ev.preventDefault();
    App.notice(info[0], info[1]);
  };
  e.addEventListener("click", open);
  e.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") open(ev);
  });
  return e;
}

/** Dasselbe für die breiteren Marken rechts in Listenzeilen. */
function flag(key, cls, label) {
  const e = pill(key, cls, label);
  e.className = "flag " + cls;
  return e;
}

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
/**
 * „Doch aufgegessen“ — die Schätzung widersprechbar machen.
 * ================================================================
 * Der Verlust dieser App ist die einzige große Zahl, die NIE
 * beobachtet wurde. Sie wird abgeleitet: Kaufabstand länger als
 * Haltbarkeit heißt „ein Teil geht verloren“, eine ungewöhnlich
 * lange Lücke heißt „das davor ist weggekommen“. Beides sind gute
 * Gründe für einen Verdacht und schlechte Gründe für eine
 * Behauptung.
 *
 * Bisher konnte der Nutzer dem nicht widersprechen. Die App sagte
 * „10,04 € über 30 Käufe“, und wer wusste, dass er den Salat damals
 * aufgegessen hatte, konnte nichts tun als die Zahl zu ignorieren —
 * und mit ihr alles, was daran hängt.
 *
 * Hier stehen deshalb die einzelnen Verdachtsfälle mit Datum und
 * Betrag, jeder einzeln zurücknehmbar und jeder einzeln wieder
 * einschaltbar. Eine Korrektur, die man nicht rückgängig machen
 * kann, wäre schlimmer als die Schätzung, die sie korrigiert.
 *
 * WAS DABEI NICHT PASSIERT: nichts wird gutgeschrieben. Kein
 * Eurobetrag, keine Rettung, kein Meilenstein. Eine Schätzung
 * zurückzunehmen ist kein Erfolg — es war nur nie ein Verlust.
 * ================================================================
 */
function wasteSheetGroup(productId, st, ctx) {
  const g = uiGroup("Was die App für verdorben hält",
    "Keine dieser Zeilen ist beobachtet — alle sind aus Kaufabstand und Haltbarkeit abgeleitet.\n\n" +
    "Es sind zwei verschiedene Behauptungen, und du kannst beiden getrennt widersprechen. Der " +
    "LAUFENDE ANTEIL sagt etwas über das Produkt: dein Kaufabstand ist länger als die Haltbarkeit, " +
    "also geht bei jedem Zyklus ein Teil verloren. Ein AUSREISSER sagt etwas über einen bestimmten " +
    "Tag: nach diesem Kauf verging so viel Zeit, dass die Packung kaum aufgebraucht worden sein kann.\n\n" +
    "Es wird nichts gutgeschrieben: eine Schätzung zurückzunehmen ist kein Erfolg, es war nur nie ein " +
    "Verlust. Rückgängig geht beides jederzeit.");

  /* Der laufende Anteil: EIN Schalter, nicht einer je Kauf. */
  if (st.chronicShare > 0) {
    const r = el("div", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">Laufender Anteil</div>` +
      `<div class="rowSub">${esc(st.chronicOff
        ? "abgestellt — zählt nicht mehr mit"
        : `etwa ${pct(st.chronicShare)} bei jedem Kauf`)}</div>`));
    const b = el("button", "pillBtn" + (st.chronicOff ? " on" : ""),
      st.chronicOff ? "✓ abgestellt" : "Bei mir nicht");
    b.setAttribute("aria-pressed", st.chronicOff ? "true" : "false");
    b.addEventListener("click", () => {
      const aus = Data.toggleNoChronic(productId);
      App.toast(aus ? "Zählt nicht mehr als Verlust" : "Wieder als Schätzung geführt", { icon: "·" });
      App.closeSheet();
    });
    r.append(b);
    g.body.append(r);
  }

  /* Die einzelnen Ausreißer: je einer eine eigene Zeile, weil jeder
     ein eigenes Ereignis behauptet. */
  st.details.slice(0, 12).forEach((d) => {
    const r = el("div", "row");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(deDate(d.date))}</div>` +
      `<div class="rowSub">${esc(d.eaten
        ? "von dir als aufgebraucht bestätigt"
        : `ganze Packung — ${eur(d.euros)}`)}</div>`));
    const b = el("button", "pillBtn" + (d.eaten ? " on" : ""), d.eaten ? "✓ gegessen" : "Doch gegessen");
    b.setAttribute("aria-pressed", d.eaten ? "true" : "false");
    b.setAttribute("aria-label",
      `Kauf vom ${deDate(d.date)}: ${d.eaten ? "Bestätigung zurücknehmen" : "als aufgebraucht bestätigen"}`);
    b.addEventListener("click", () => {
      const jetzt = Data.toggleEaten(productId, d.date);
      // Kein `rescue`: hier wird nichts gerettet, nur eine Schätzung
      // zurückgenommen. Der Hinweis sagt genau das.
      App.toast(jetzt ? "Zählt nicht mehr als Verlust" : "Wieder als Verdacht geführt", { icon: "·" });
      App.closeSheet();
    });
    r.append(b);
    g.body.append(r);
  });

  if (st.details.length > 12) {
    g.body.append(el("p", "srcnote", `${st.details.length - 12} ältere Fälle nicht gezeigt.`));
  }
  if (st.corrected) {
    g.body.append(el("p", "srcnote",
      `${st.corrected} ${st.corrected === 1 ? "Kauf zählt" : "Käufe zählen"} nicht mehr mit — ` +
      "deine Angabe, nicht die Schätzung."));
  }
  return g;
}

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

  /* Die Wochenentscheidung steht ganz oben, vor allen Fakten.
     Sie ist der Grund, aus dem dieses Blatt in der Liste geöffnet
     wird — Rhythmus, Preisverlauf und Datenqualität sind Nachschlag.
     Nur wenn das Produkt diese Woche überhaupt ansteht: im Bestand
     oder im Wochenstreifen wäre die Frage gegenstandslos. */
  const aufDerListe = (ctx.items || []).find((i) => i.productId === productId && i.basis !== "manuell");
  if (aufDerListe) body.append(weekChoice(aufDerListe, ctx, App, () => App.closeSheet()));

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
      regulatorisch: "rechtlich definiert",
      leitlinie: "behördliche Lagerempfehlung",
      schaetzwert: "Schätzwert ohne amtliche Quelle"
    }[p.quality]);
    // Bei sicherheitskritischen Produkten reicht die Stufe nicht: dort
    // steht die Rechtsgrundlage daneben, und der wichtigste Satz ist,
    // dass das aufgedruckte Datum jede Schätzung schlägt.
    if (p.safetyCritical) {
      const f = safetyFacts(productId);
      if (f) {
        fact("Verbrauchsdatum", `höchstens ${f.maxDays} ${f.maxDays === 1 ? "Tag" : "Tage"} · max. ${de(f.maxTempC)} °C`);
      }
    }
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

  /* Was bei einem guten Preis sinnvoll wäre.
     Herkunft heute: die eigene Preishistorie. Dieselbe Rechnung
     nimmt später einen Schwarm-Index entgegen — offerAdvisor.js
     interessiert nicht, woher das „üblich" kommt, nur dass die
     Herkunft mitgeführt und angezeigt wird. */
  if (pm && pm.lowest && pm.usual && r && r.perUnitDays) {
    const rat = offerAdvice(productId, {
      preis: pm.lowest, üblich: pm.usual, perUnitDays: r.perUnitDays, herkunft: "eigen"
    });
    if (rat) {
      const g = uiGroup("Wenn es wieder so günstig ist",
        "Die Höchstmenge ist keine Meinung, sondern eine Rechnung: Haltbarkeit geteilt durch deinen " +
        "Verbrauch je Einheit. Ein Angebotsprospekt kann sagen, dass etwas billig ist — dass DU davon " +
        "genau so viel verbrauchst, bevor es schlecht wird, kann nur diese App sagen.\n\n" +
        "Nichts davon wird gutgeschrieben: das ist eine Vorschau auf einen Kauf, der noch nicht " +
        "stattgefunden hat. Gezählt wird erst, was tatsächlich auf einem Bon steht.");
      g.body.append(uiRow(
        rat.kind === "vorrat" ? `${rat.einheiten}× wären sinnvoll` : "Für Vorrat zu kurz haltbar",
        rat.message, null,
        rat.kind === "vorrat" ? { value: "ca. " + eur(rat.ersparnis) } : {}));
      g.body.append(el("p", "srcnote",
        `Bester Preis bisher: ${eur(pm.lowest)}, üblich ${eur(pm.usual)}. ` + sourceNote(rat)));
      body.append(g);
    }
  }

  /* Die Schätzung widersprechbar machen. */
  if (st && (st.chronicShare > 0 || (st.details && st.details.length))) {
    body.append(wasteSheetGroup(productId, st, ctx));
  }

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
    const f = safetyFacts(productId);
    const note = el("div", "note red");
    note.innerHTML = "<b>Verbrauchsdatum.</b> Nach Ablauf in den Müll — Keime sind weder zu sehen noch zu riechen. " +
      "Die App verlängert diese Frist nie.";
    body.append(note);
    if (f) {
      // Rechtsgrundlage und Empfehlung getrennt, nie vermischt: das
      // eine ist Gesetz, das andere ein Erfahrungswert. Wer beides in
      // einen Satz packt, verleiht dem Erfahrungswert eine Autorität,
      // die er nicht hat.
      const q = el("button", "linkBtn", "Worauf beruht das?");
      q.addEventListener("click", () => App.notice(p.name,
        `Gruppe: ${f.label}.\n\n` +
        `RECHTLICH GEREGELT ist zweierlei:\n${f.legal.join("\n\n")}\n\n` +
        `NICHT geregelt ist die Anzahl der Tage. Dafür gibt es keine amtliche Zahl. ` +
        `Die App rechnet mit höchstens ${f.maxDays} ${f.maxDays === 1 ? "Tag" : "Tagen"} — das ist die untere Grenze ` +
        `dieser Lagerempfehlung:\n\n${f.guide}\n\n${f.printedWins}`));
      body.append(q);
    }
  }

  /* Das aufgedruckte Datum eintragen.
     Für sicherheitskritische Produkte ist das die einzige belastbare
     Angabe, die es gibt — und sie steht auf der Packung, die gerade
     in der Hand liegt. Ab dem Eintrag rechnet die App damit statt mit
     ihrer Lagerempfehlung, und die Bestandsanzeige sagt, dass die
     Zahl nicht mehr geschätzt ist. */
  if (p.isFood && ctx.history.some((h) => h.productId === productId)) {
    const gesetzt = (Data.get().useBy || {})[productId] || "";
    const wrap = el("label", "field");
    wrap.append(el("span", "lbl", p.safetyCritical
      ? "Aufgedrucktes Verbrauchsdatum"
      : "Aufgedrucktes Mindesthaltbarkeitsdatum"));
    const inp = el("input");
    inp.type = "date";
    inp.value = gesetzt;
    inp.setAttribute("aria-label", `Aufgedrucktes Datum für ${p.name}`);
    inp.addEventListener("change", () => {
      const ok = Data.setUseBy(productId, inp.value || null);
      if (!ok) { App.toast("Das Datum liegt vor dem Kauf"); inp.value = gesetzt; return; }
      App.closeSheet();
      App.toast(inp.value ? "Es gilt jetzt dein Datum" : "Wieder geschätzt");
    });
    wrap.append(inp);
    body.append(wrap);
    body.append(el("p", "srcnote", gesetzt
      ? "Die Bestandsanzeige rechnet mit diesem Datum, nicht mehr mit der Schätzung."
      : "Ohne Eintrag rechnet die App mit einer Lagerempfehlung. Das Etikett ist genauer — es gilt für genau diese Packung."));
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
   1. Start — die Übersicht
   ================================================================
   Die Einkaufsliste war die Startseite, und das war falsch. Eine
   Liste ist ein Werkzeug für einen bestimmten Moment — kurz vor dem
   Einkauf. Wer die App an einem Dienstagabend öffnet, hält keine
   Liste in der Hand, sondern hat eine Frage:

       WAS KOMMT AUF MICH ZU?

   Diese Seite beantwortet sie in dieser Reihenfolge:

     1. Die Woche      — sieben Tage, jede Sache ein Feld.
                         Steigt die Säule, steht mehr an.
     2. Die Liste      — ein Feld, ein Preis, ein Knopf.
     3. Jetzt zu tun   — nur, was heute eine Handlung braucht.
     4. Dein Lauf      — die Wochenreihe, sonst nichts.

   WAS SIE AUSDRÜCKLICH NICHT IST: vier gleich große Kacheln mit
   Zahlen darin. Kacheln sehen nach Übersicht aus und sind keine —
   sie zeigen alles gleich groß und beantworten damit nichts. Hier
   ist genau eine Sache groß, und das ist die Woche.

   Alles hier ist ANSICHT auf Vorhandenes. Keine Zahl entsteht auf
   dieser Seite, keine wird hier ein zweites Mal gezählt.
   ================================================================ */
function viewStart(ctx, app) {
  const c = frag();

  /* --- Kaltstart: erst einmal Daten --- */
  if (!ctx.history.length) {
    const w = card();
    w.append(el("p", "welcome",
      "Einkaufs-Anker lernt aus deinen Kassenbons, was wann bei dir ausgeht — " +
      "und sagt es dir, bevor es fehlt."));
    const b = el("button", "cta", "Ersten Bon erfassen");
    b.addEventListener("click", () => app.goto("erfassen"));
    w.append(b);
    const demo = el("button", "cta light", "Erst mal ansehen");
    demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Beispieldaten geladen"); });
    w.append(demo);
    c.append(w);
    return c;
  }

  c.append(pulseCard(ctx, app));
  c.append(listCard(ctx, app));

  const todo = todoCard(ctx, app);
  if (todo) c.append(todo);

  if (ctx.stage.stage >= 2) c.append(runCard(ctx, app));
  return c;
}

/* Farbe je Ereignisart. Dieselben drei Farben wie überall sonst:
   Korall heißt dringend, Bernstein heißt geschätzt oder fällig,
   Grün heißt Einkauf. Eine eigene Palette für die Startseite hätte
   die Bedeutungen auseinandergerissen. */
const PULSE_KIND = {
  verderb: ["k-red", "verdirbt"],
  tausch: ["k-amber", "tauschen"],
  einkauf: ["k-green", "einkaufen"]
};

/**
 * Die Woche als sieben Säulen.
 *
 * Jedes Feld ist EIN Ereignis — keine normierte Höhe, kein
 * Maßstab, der sich mit den Daten verschiebt. Damit ist Dienstag
 * genau dann höher als Mittwoch, wenn dienstags mehr ansteht, und
 * zwar auch im Vergleich zur Woche davor. Ein Balken, der sich
 * selbst normiert, sieht immer gleich aus, egal wie viel los ist.
 *
 * Über fünf Feldern wird abgeschnitten und die Zahl dazugeschrieben:
 * eine Säule, die alles zeigt, wäre bei zwölf Positionen einen
 * halben Bildschirm hoch.
 */
function pulseCard(ctx, app) {
  const p = ctx.pulse;
  const g = uiGroup("Deine Woche",
    "Sieben Tage ab heute. Jedes Feld ist eine Sache, die an diesem Tag ansteht: etwas verdirbt, " +
    "etwas ist zu tauschen, etwas gehört eingekauft.\n\n" +
    "Woher die Tage kommen: Verderbliches aus der Bestandsschätzung, Einkäufe aus deinem gelernten " +
    "Kaufabstand, Austausch aus dem Intervall des Produkts. Überfälliges steht auf heute — " +
    "nicht, weil es heute passiert, sondern weil es liegen geblieben ist.\n\n" +
    "Was ausgeht, steht nur einmal da: als Einkauf. Eine Sache wird hier nie zweimal gezählt.");

  const box = el("div", "pulse");
  box.append(el("div", "pulseHead", esc(p.headline)));

  const strip = el("div", "pulseDays");
  const hoch = Math.min(5, Math.max(1, ...p.days.map((d) => d.count)));

  p.days.forEach((d) => {
    const b = el("button", "pDay" +
      (d.isToday ? " today" : "") +
      (d.isShoppingDay ? " shop" : "") +
      (d.count ? "" : " quiet"));
    b.setAttribute("aria-label",
      `${d.name}, ${d.count === 0 ? "nichts" : d.count === 1 ? "eine Sache" : d.count + " Sachen"}` +
      (d.isShoppingDay ? ", dein Einkaufstag" : ""));

    // Die Zahl steht ÜBER der Säule, nicht darunter: darunter steht
    // der Wochentag, und zwei Angaben an derselben Kante lesen sich
    // als eine. Sie steht immer da, wo etwas ansteht — sonst müsste
    // man Felder zählen, und ab dem sechsten ginge das nicht mehr.
    b.append(el("div", "pNum", d.count ? String(d.count) : ""));

    const col = el("div", "pCol");
    col.style.setProperty("--rows", String(hoch));
    if (!d.count) col.append(el("i", "pFlat"));
    d.events.slice(0, 5).forEach((e) => col.append(el("i", "pSeg " + PULSE_KIND[e.kind][0])));
    b.append(col);

    b.append(el("div", "pName", esc(d.isToday ? "heute" : d.short)));
    b.append(el("div", "pShop", d.isShoppingDay ? "<i></i>" : ""));
    b.addEventListener("click", () => daySheet(d, ctx, app));
    strip.append(b);
  });
  box.append(strip);

  // Die Legende steht nur da, wenn die Farben auch vorkommen.
  const arten = new Set();
  p.days.forEach((d) => d.events.forEach((e) => arten.add(e.kind)));
  if (arten.size) {
    const leg = el("div", "pLegend");
    ["verderb", "tausch", "einkauf"].filter((k) => arten.has(k)).forEach((k) => {
      leg.append(el("span", null, `<i class="${PULSE_KIND[k][0]}"></i>${PULSE_KIND[k][1]}`));
    });
    if (p.shoppingSlot !== null) leg.append(el("span", "legShop", "<i></i>Einkaufstag"));
    box.append(leg);
  }

  g.body.append(box);
  return g;
}

/** Was an einem Tag ansteht — mit Weg zu jedem einzelnen Produkt. */
function daySheet(day, ctx, app) {
  const body = frag();
  if (!day.count) {
    body.append(el("p", "empty", "An diesem Tag steht nichts an."));
  } else {
    ["verderb", "tausch", "einkauf"].forEach((kind) => {
      const rows = day.events.filter((e) => e.kind === kind);
      if (!rows.length) return;
      const g = uiGroup(PULSE_KIND[kind][1].replace(/^./, (m) => m.toUpperCase()));
      rows.forEach((e) => g.body.append(uiRow(e.name,
        // Die Bemerkung nur, wenn sie etwas hinzufügt. Unter der
        // Überschrift „Einkaufen“ noch einmal „einkaufen“ zu
        // schreiben, füllt eine Zeile und sagt nichts; bei
        // Verderblichem steht dort dagegen, woher das Datum kommt.
        kind === "verderb" ? e.note : null, null,
        e.productId && byId(e.productId)
          ? { onClick: () => productSheet(e.productId, ctx) }
          : {})));
      body.append(g);
    });
  }
  const sub = deDate(day.date) + (day.isShoppingDay ? " · dein Einkaufstag" : "");
  app.sheet(day.isToday ? "Heute" : day.name, sub, body);
}

/**
 * Die Liste als ein einziges Feld.
 *
 * Nicht die Liste selbst — die hat ihre eigene Seite. Hier steht,
 * was darauf steht und was es kostet, und ein Knopf führt hin. Die
 * ersten Namen stehen mit dabei: ohne sie ist „13 Positionen" eine
 * Zahl, mit ihnen ist es die eigene Liste.
 */
function listCard(ctx, app) {
  const on = ctx.items.filter((i) => i.on);
  const sum = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);

  const g = uiGroup();
  const b = el("button", "bigAction");
  const main = el("div", "baMain");
  main.append(el("div", "baTitle", "Einkaufsliste"));
  main.append(el("div", "baSub", esc(on.length
    ? `${on.length} ${on.length === 1 ? "Position" : "Positionen"} · ${eur(sum)}`
    : ctx.stage.stage <= 1 ? "wird noch gelernt" : "noch nichts drauf")));
  if (on.length) {
    const namen = on.slice(0, 3).map((i) => i.name).join(", ");
    const rest = on.length - 3;
    main.append(el("div", "baPreview", esc(rest > 0 ? `${namen} und ${rest} weitere` : namen)));
  }
  b.append(main);
  b.append(el("div", "baGo", "→"));
  b.addEventListener("click", () => app.goto("liste"));
  g.body.append(b);
  return g;
}

/**
 * Jetzt zu tun.
 *
 * Die Regel für diese Gruppe: hier steht nur, was HEUTE eine
 * Handlung braucht. Kein Hinweis, keine Zahl, kein Fortschritt —
 * dafür sind die anderen Seiten da. Ist nichts zu tun, fehlt die
 * Gruppe ganz. Eine Sammelstelle, die auch leer dasteht, macht aus
 * „nichts zu tun" eine Nachricht statt eines Zustands.
 */
function todoCard(ctx, app) {
  const rows = [];

  if (ctx.safety) {
    rows.push(["Kühlkette", ctx.safety.short, flag("kuehlen", "f-miss", "!"),
      () => app.notice("Kühlkette", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source)]);
  }

  if (ctx.backup.urgent) {
    rows.push(["Daten sichern", ctx.backup.title || "nur in diesem Browser",
      flag("gefaehrdet", "f-miss", "!"), () => app.goto("mehr")]);
  }

  const faellig = ctx.swapsDue.filter((x) => x.due);
  if (faellig.length) {
    rows.push([faellig.length === 1 ? `${faellig[0].name} tauschen` : `${faellig.length} Sachen tauschen`,
      faellig.length === 1 ? "nach Zeit fällig" : faellig.slice(0, 3).map((x) => x.name).join(", "),
      flag("tauschen", "f-gold", String(faellig.length)), () => app.goto("faellig")]);
  }

  if (ctx.review.due) {
    rows.push(["Wochenrückblick", ctx.review.short || "fertig", null, () => reviewSheet(ctx, app)]);
  }

  // Alles Übrige läuft weiter über das Sammelblatt der Liste — es ist
  // dasselbe Blatt, nicht eine zweite Fassung davon.
  const hinweise = collectHints(ctx).filter((h) => !h.urgent);
  if (hinweise.length) {
    rows.push([`${hinweise.length} ${hinweise.length === 1 ? "Hinweis" : "Hinweise"}`,
      hinweise.slice(0, 3).map((h) => h.title).join(" · "),
      flag("hinweise", "", String(hinweise.length)), () => hintsSheet(ctx, app)]);
  }

  if (!rows.length) return null;

  const g = uiGroup("Jetzt zu tun");
  rows.slice(0, 5).forEach(([title, sub, control, onClick]) =>
    g.body.append(uiRow(title, sub, control, { onClick })));
  return g;
}

/**
 * Dein Lauf — eine Zeile, kein Kachelfeld.
 *
 * Die Wochenreihe steht hier, weil sie das Einzige ist, was diese
 * Seite über Vergangenes sagen muss: bleibst du dabei? Alles andere
 * — Ausgaben, Ersparnis, Verlust, Rhythmen — steht unter „Zahlen",
 * und dorthin führt diese Zeile.
 */
function runCard(ctx, app) {
  const g = uiGroup("Dein Lauf");
  const b = el("button", "runRow");
  b.append(streakStrip(ctx));
  b.append(el("div", "chev"));
  b.addEventListener("click", () => app.goto("zahlen"));
  g.body.append(b);
  if (ctx.badges.nextUp) {
    g.body.append(uiRow("Als Nächstes", ctx.badges.nextUp.nextTitle, null, {
      value: `${Math.round(ctx.badges.nextUp.progress * 100)} %`,
      onClick: () => app.goto("zahlen")
    }));
  }
  return g;
}

/* ================================================================
   2. Liste
   ================================================================
   RÜCKMELDUNG AUS DER ZIELGRUPPE, und sie war eindeutig: zu voll.

   Die Seite hatte bis zu zehn Blöcke — Vorratsanzeige, Sicherheit,
   die Liste, zwei Knöpfe, vergessene Produkte, Einfrieren, Saison,
   Lagerhinweis und vier Einstellungen. Jeder für sich war begründet.
   Zusammen beantworteten sie zehn Fragen, obwohl beim Öffnen genau
   eine im Kopf ist:

       WAS MUSS ICH EINKAUFEN?

   Alles andere ist entweder eine Antwort auf eine Frage, die man
   später stellt, oder eine Einstellung. Beides gehört nicht auf die
   erste Seite.

   WAS GEBLIEBEN IST: die Liste, ein Knopf zum Loslaufen, ein Weg
   etwas zu ergänzen. Mehr nicht.

   WAS UMGEZOGEN IST — nichts wurde gelöscht, alles ist einen Tipp
   entfernt:
     · Vorrat, Reichweite            -> Bestand
     · Budget, Personen, Vorausschau,
       Urlaub                        -> Mehr
     · Sicherheit, Vergessenes,
       Einfrieren, Saison, Lagern    -> eine Zeile „Hinweise“

   WAS RUHIGER GEWORDEN IST: höchstens EIN Zeichen je Zeile statt
   drei. Die Erklärzeile über der Liste ist ins (i) gewandert. Und
   die Überschrift sagt, was hier ist, statt es zu erklären.
   ================================================================ */
function viewListe(ctx, app) {
  const c = frag();
  const S = Data.get();

  /* KEIN AUSSTIEG MEHR FÜR DIE FRÜHEN WOCHEN.
     ----------------------------------------------------------------
     Hier stand ein `return`: bis die App zwei Bons je Produkt gesehen
     hatte, zeigte diese Seite einen Satz und einen Knopf. Vier bis
     acht Wochen lang. Gemessen an einem einzigen erfassten Bon war
     das der gesamte Inhalt:

         „Zwei Bons je Produkt, dann kommen die Vorschläge."

     Und weil das Erfassen am Ende `goto("liste")` aufruft, war das
     der erste Bildschirm nach der ersten echten Handlung eines neuen
     Nutzers. Er sagte: kann ich noch nicht.

     Dabei war alles da. Die Suche über 846 Produkte, das freie
     Eintippen, der Ladenmodus, das Teilen, der Wagen — nur gesperrt,
     weil noch keine VORHERSAGE möglich war. Als könnte man eine
     Einkaufsliste nur schreiben, wenn ein Algorithmus mithilft.

     Jetzt ist die Seite von der ersten Minute an eine Einkaufsliste,
     die man selbst füllt. Was die App dazulernt, kommt oben drauf,
     wenn es so weit ist — und bis dahin sagt eine Zeile am Ende,
     woran es liegt. */

  // Der Rückblick steht obenan, aber nur wenn er fällig ist. Eine
  // Karte, die jeden Tag da ist, ist kein Anlass mehr.
  if (ctx.review.due) c.append(reviewCard(ctx, app));

  const hinweise = collectHints(ctx);
  const dringend = hinweise.some((h) => h.urgent);
  if (dringend) c.append(hintsRow(ctx, app, hinweise));

  /* --- Die Liste --- */
  const on = ctx.items.filter((i) => i.on);
  const sumOn = on.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);

  /* Ohne Überschrift: die Seite heißt schon „Einkaufsliste“, und
     eine Karte, die darunter noch einmal „Deine Einkaufsliste“ sagt,
     kostet eine Zeile und sagt nichts. Die Erklärung sitzt unten an
     der Summe, wo man ohnehin hinschaut, wenn man wissen will, wie
     das zustande kommt. */
  const listInfo =
    "Die App füllt die Liste aus deinen Rhythmen vor: Lebensmittel nach dem gelernten Kaufabstand " +
    "zuzüglich der eingestellten Vorausschau, Haushaltsprodukte nach ihrer Verbrauchsrate.\n\n" +
    "Sie gehört trotzdem dir. Haken wegnehmen, halbe Menge wählen, eigene Positionen ergänzen. " +
    "Der Rechenweg jeder Zeile steht in ihrem Detail-Blatt — einfach antippen.\n\n" +
    "Vorrat und Reichweite stehen unter „Bestand“, Budget und Vorausschau unter „Mehr“.";
  const list = uiGroup();

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
  // und was du selbst ergänzt hast. Die Trennung beantwortet die
  // Frage „woher kommt das hier eigentlich?“, ohne dass man eine
  // Zeile antippen muss.
  /* Nur was ansteht. Abgewähltes stand vorher grau zwischen den
     anderen Zeilen und sah aus wie eine Position mit hohlem Kreis —
     seit der Kreis „im Wagen“ heißt, wäre das nicht mehr zu
     unterscheiden. Es sammelt sich deshalb unten in einer Zeile. */
  const auto = ctx.items.filter((i) => i.on && i.basis !== "manuell");
  const eigene = ctx.items.filter((i) => i.on && i.basis === "manuell");
  const abgewaehlt = ctx.items.filter((i) => !i.on);
  const food = auto.filter((i) => !isNonFood(i.productId));
  const home = auto.filter((i) => isNonFood(i.productId));

  const ul = el("ul", "items");
  if (!ctx.items.length) {
    ul.append(el("li", "item", `<p class="empty">${esc(ctx.stage.stage >= 2
      ? "Nichts fällig — die Liste ist leer."
      : "Noch nichts drauf. Tippe unten auf „Etwas hinzufügen“.")}</p>`));
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

  if (abgewaehlt.length) {
    list.body.append(uiRow("Nicht diese Woche",
      abgewaehlt.slice(0, 3).map((i) => i.name).join(", "), null, {
        value: String(abgewaehlt.length),
        onClick: () => weekOffSheet(ctx, app)
      }));
  }

  // Der wichtigste Knopf dieser Seite: ohne ihn ist die App ein
  // Automat, den man nur ansehen kann.
  const add = el("button", "row action addRow");
  add.innerHTML = '<span class="plusMark">+</span>' +
    '<div class="rowMain"><div class="rowTitle">Etwas hinzufügen</div>' +
    '<div class="rowSub">Produkt suchen oder frei eintippen</div></div>';
  add.addEventListener("click", () => addSheet(ctx, app));
  list.body.append(add);

  /* Warum hier (noch) nichts vorgeschlagen wird. Eine Zeile am Ende,
     nicht ein Satz anstelle der Seite: die Auskunft ist richtig, aber
     sie ist kein Grund, das Werkzeug wegzunehmen. */
  if (ctx.stage.stage <= 1) {
    list.body.append(uiRow(
      ctx.history.length ? "Vorschläge kommen noch" : "Noch keine Einkäufe erfasst",
      ctx.history.length
        ? `${ctx.totals.receipts} ${ctx.totals.receipts === 1 ? "Bon" : "Bons"} erfasst — ab dem zweiten je Produkt lernt die App den Rhythmus`
        : "Bis dahin ist das hier deine normale Einkaufsliste",
      null, { onClick: () => app.goto("erfassen") }));
  }

  /* Die Summe erst, wenn es etwas zu summieren gibt. „0 Positionen ·
     0,00 €“ unter einer leeren Liste ist keine Auskunft, sondern ein
     Formular, das sich selbst ausfüllt. */
  if (ctx.items.length) list.body.append(listTotals(ctx, on, sumOn, listInfo));
  c.append(list);

  return finishListe(c, ctx, app, on, sumOn, hinweise, dringend);
}

/** Die Summenzeile am Fuß der Liste. */
function listTotals(ctx, on, sumOn, listInfo) {
  const full = ctx.items.filter((i) => i.on).reduce((a, i) => a + i.price, 0);
  const tot = el("div", "totals");
  const links = el("div");
  const label = el("div", "l");
  label.append(document.createTextNode(`${on.length} ${on.length === 1 ? "Position" : "Positionen"}`));
  const info = el("button", "infoBtn", "i");
  info.setAttribute("aria-label", "Erklärung: wie diese Liste entsteht");
  info.addEventListener("click", () => App.notice("Wie diese Liste entsteht", listInfo));
  label.append(info);
  links.append(label, el("div", "big", eur(sumOn)));
  tot.append(links, el("div", "saved", full > sumOn ? "− " + eur(full - sumOn) : ""));
  return tot;
}

/** Wagen, Knöpfe und Hinweise unter der Liste. */
function finishListe(c, ctx, app, on, sumOn, hinweise, dringend) {
  /* --- Der Wagen ---
   * Nur wenn etwas drin liegt. Eine Leiste, die auch leer dasteht,
   * macht aus „nichts im Wagen“ eine Nachricht statt eines Zustands
   * — und sie stünde die ganze Woche im Weg, obwohl eingekauft wird
   * an einem Tag.
   *
   * `position: sticky` mit einem Abstand über der Leiste: solange die
   * Liste weiterläuft, klebt sie am unteren Rand; am Ende der Seite
   * setzt sie sich an ihren eigenen Platz. Deshalb steht sie VOR den
   * Knöpfen und nicht dahinter — ein klebendes Element als letztes
   * Element im Fluss hat nichts, woran es kleben könnte. */
  const wagen = app.cartItems(ctx);
  if (wagen.length) {
    const wSum = wagen.reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
    const bar = el("div", "cartBar");
    bar.append(el("div", "t",
      `<b>${wagen.length} von ${on.length} im Wagen</b>` +
      `<span>${esc(eur(wSum))} von ${esc(eur(sumOn))}</span>`));
    const book = el("button", "cta", "Einkauf buchen");
    book.addEventListener("click", () => app.bookCart());
    bar.append(book);
    c.append(bar);
  }

  /* --- Losgehen --- */
  const actions = el("div", "ctaRow");
  /* Kein zweiter Modus, eine andere Sicht: derselbe Wagen, nach
     Gängen sortiert und mit großen Zielen. Deshalb auch nicht mehr
     der auffälligste Knopf der Seite — das ist jetzt das Buchen. */
  const go = el("button", "cta light", "Nach Gängen");
  go.disabled = !on.length;
  go.addEventListener("click", () => app.openStore());
  const share = el("button", "cta light", "Teilen");
  share.disabled = !on.length;
  share.addEventListener("click", () => app.shareList());
  actions.append(go, share);
  c.append(actions);

  /* Ohne jede Historie bleibt der Weg zu den Beispieldaten stehen —
     er war vorher Teil des Leerzustands, den es nicht mehr gibt. */
  if (!ctx.history.length) {
    const demo = el("button", "cta light", "Beispieldaten ansehen");
    demo.addEventListener("click", () => { Data.loadDemo("full"); app.toast("Geladen"); });
    c.append(demo);
  }

  if (hinweise.length && !dringend) c.append(hintsRow(ctx, app, hinweise));

  return c;
}

/**
 * Alles Ratgeberische in EINER Zeile.
 *
 * Fünf Gruppen sind zu einer Zeile geworden. Sie erscheint nur, wenn
 * es etwas zu sagen gibt, und sie sagt, wie viel — damit man
 * entscheiden kann, ob es sich gerade lohnt.
 *
 * Ist etwas Dringendes dabei (Kühlkette), steht sie ÜBER der Liste
 * und nennt die Sache beim Namen. Sonst darunter. Eine Warnung, die
 * man erst erscrollen muss, ist keine — dieselbe Regel wie bei der
 * Sicherung unter „Mehr“.
 */
function hintsRow(ctx, app, hinweise) {
  const g = uiGroup();
  const dringend = hinweise.find((h) => h.urgent);
  g.body.append(uiRow(
    dringend ? dringend.title : `Zero Waste · ${hinweise.length}`,
    dringend
      ? (hinweise.length > 1 ? `und ${hinweise.length - 1} ${hinweise.length === 2 ? "weiterer" : "weitere"}` : dringend.sub)
      : hinweise.slice(0, 3).map((h) => h.title).join(" · "),
    flag(dringend ? "kuehlen" : "zerowaste", dringend ? "f-miss" : "", String(hinweise.length)),
    { onClick: () => hintsSheet(ctx, app) }));
  return g;
}

/**
 * Alles einsammeln, was die App zu sagen hat — außer der Liste.
 *
 * Jeder Eintrag trägt seine eigene Handlung mit. Das ist der
 * Unterschied zwischen einem Sammelblatt und einer Abstellkammer:
 * was hier landet, bleibt bedienbar.
 */
function collectHints(ctx) {
  const out = [];

  if (ctx.safety) {
    out.push({
      key: "safety", urgent: true,
      group: "Sicherheit",
      title: ctx.safety.short,
      sub: ctx.safety.coldestZone,
      badge: "kühlen",
      onOpen: (app) => app.notice("Kühlkette", ctx.safety.message + "\n\nQuelle: " + ctx.safety.source)
    });
  }

  /* Vorratskäufe, die nicht aufgehen. Sie stehen weit oben, weil
     sie die einzige Sorte Hinweis sind, bei der noch etwas zu retten
     ist: einfrieren, verschenken, verteilen — solange die Frist
     nicht abgelaufen ist. Danach ist es nur noch Bilanz. */
  (ctx.hoards || []).filter((h) => h.kind === "zuviel").slice(0, 3).forEach((h) => out.push({
    key: "hoard:" + h.productId + ":" + h.date,
    urgent: h.safetyCritical,
    group: "Zu viel auf einmal",
    title: `${h.units}× ${h.name}`,
    sub: h.safetyCritical
      ? `Verbrauchsdatum — hält nur ${h.haltbarTage} ${h.haltbarTage === 1 ? "Tag" : "Tage"}`
      : `reicht ${h.reichweiteTage} Tage, haltbar ${h.haltbarTage}`,
    onOpen: (app) => app.notice("Zu viel auf einmal", h.message +
      "\n\nEine Vorhersage, keine Bilanz: was hier steht, ist noch nicht passiert. Einfrieren, " +
      "verschenken oder verteilen ändert es." +
      (h.günstiger > 0 ? `\n\nGünstiger war der Kauf trotzdem — um ${eur(h.günstiger)}.` : ""))
  }));

  ctx.forgotten.slice(0, 4).forEach((f) => out.push({
    key: "forgotten:" + f.productId,
    title: f.name,
    sub: `zuletzt vor ${f.daysSince} Tagen, sonst alle ${f.rhythmDays}`,
    group: "Fehlt dir das?",
    actions: [
      { label: "Dazu", primary: true, run: (app) => { app.addToList(f.productId); app.toast(f.name + " dazu"); } },
      { label: "Nein", run: (app) => { app.dismiss("forgotten", f.productId); app.toast("Nicht mehr gefragt"); } }
    ]
  }));

  ctx.freeze.slice(0, 3).forEach((f) => out.push({
    key: "freeze:" + f.productId,
    title: `${f.name}: ${f.share === 0.5 ? "die Hälfte" : "ein Teil"} einfrieren`,
    sub: `rettet ${eur(f.valueAtRisk)}`,
    group: "Einfrieren",
    actions: [
      { label: "Eingefroren", primary: true, run: (app) => {
        app.dismiss("freeze", f.productId);
        app.rescue(f.productId, `${f.name} eingefroren`, f.valueAtRisk);
      } }
    ]
  }));

  /* Kein Verb im Titel: aus „Äpfel“ und „ist Importware“ wird
     „Äpfel ist Importware“, und Produktnamen sind mal Einzahl, mal
     Mehrzahl. Der Doppelpunkt umgeht die Grammatik, statt sie zu
     raten. */
  ctx.season.forEach((s) => out.push({
    key: "season:" + s.productId,
    title: s.name,
    sub: "Importware · Saison: " + s.peakMonths.map((m) => MONTH_NAMES[m - 1]).join(", "),
    group: "Saison"
  }));

  if (ctx.ethylene) {
    out.push({
      key: "ethylene",
      title: "Getrennt lagern",
      sub: "Ethylen lässt die zweite Gruppe schneller verderben",
      group: "Lagern",
      onOpen: (app) => app.notice("Lagern", ctx.ethylene.message + "\n\nQuelle: " + ctx.ethylene.source)
    });
  }

  return out;
}

/** Das Sammelblatt. Gruppiert, mit den Handlungen von vorher. */
function hintsSheet(ctx, app) {
  const body = el("div");
  const hinweise = collectHints(ctx);

  let letzteGruppe = null;
  hinweise.forEach((h) => {
    if (h.group && h.group !== letzteGruppe) {
      body.append(el("div", "sheetGroupTitle", esc(h.group)));
      letzteGruppe = h.group;
    }
    const r = el("div", "row");
    const haupt = h.onOpen ? el("button", "rowMain plainBtn") : el("div", "rowMain");
    haupt.innerHTML = `<div class="rowTitle">${esc(h.title)}</div><div class="rowSub">${esc(h.sub || "")}</div>`;
    if (h.onOpen) haupt.addEventListener("click", () => h.onOpen(app));
    r.append(haupt);

    if (h.badge) r.append(flag("kuehlen", "f-miss", h.badge));
    if (h.actions) {
      const acts = el("div", "rowActions");
      h.actions.forEach((a) => {
        const b = el("button", "pillBtn" + (a.primary ? " on" : ""), esc(a.label));
        b.addEventListener("click", () => { a.run(app); app.closeSheet(); });
        acts.append(b);
      });
      r.append(acts);
    }
    body.append(r);
  });

  body.append(el("p", "srcnote",
    "Alles hier hat denselben Zweck: dass nichts weggeworfen werden muss. Jeder Hinweis kommt, " +
    "solange sich noch etwas machen lässt — nicht hinterher."));

  app.sheet("Zero Waste", `${hinweise.length} ${hinweise.length === 1 ? "Sache" : "Sachen"}`, body);
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
   Einen gebuchten Bon korrigieren
   ================================================================
   Die Texterkennung liest, sie versteht nicht — und die Prüfliste
   fängt nicht alles ab. Wer einen Fehltreffer erst später bemerkt,
   musste bisher den ganzen Bon löschen und neu erfassen. Das ist der
   Moment, in dem eine App zum ersten Mal als lästig erlebt wird.

   Die Korrektur zieht Summe, Anzahl und den Erfassungsbetrag im
   Protokoll mit; was dabei passiert, steht in data.js. Hier steht
   nur, wie man drankommt.
   ================================================================ */
function receiptSheet(rec, app) {
  const body = el("div");
  const zeilen = Data.receiptLines(rec.id);

  // Datum und Markt stehen schon in der Überschrift des Blatts.
  body.append(el("p", "sheetPara",
    `${zeilen.length} ${zeilen.length === 1 ? "Position" : "Positionen"}. Eine antippen, um sie einem ` +
    "anderen Produkt zuzuordnen — oder mit × entfernen."));

  const liste = el("div");
  zeilen.forEach((kauf) => {
    const p = byId(kauf.productId);
    const r = el("div", "row");
    const haupt = el("button", "rowMain plainBtn");
    haupt.innerHTML =
      `<div class="rowTitle">${esc(p ? p.name : kauf.productId)}</div>` +
      `<div class="rowSub">${esc(`${de(kauf.quantity)}× ${eur(kauf.unitPrice)}`)}</div>`;
    haupt.addEventListener("click", () => reassignSheet(kauf, rec, app));
    r.append(haupt);
    r.append(el("div", "rowValue", eur(kauf.unitPrice * kauf.quantity)));

    const del = el("button", "del", "×");
    del.setAttribute("aria-label", `${p ? p.name : "Position"} entfernen`);
    del.addEventListener("click", () => {
      Data.updatePurchase(kauf.id, null);
      app.closeSheet();
      app.toast("Position entfernt");
    });
    r.append(del);
    liste.append(r);
  });
  body.append(liste);

  body.append(el("p", "srcnote",
    "Eine Korrektur zieht Summe und Anzahl mit. Erreichte Meilensteine bleiben — was einmal " +
    "geschafft war, verfällt nicht, auch nicht durch einen behobenen Tippfehler."));

  const del = el("button", "cta danger", "Ganzen Bon löschen");
  del.addEventListener("click", () => app.confirm("Bon löschen?",
    `${rec.store}, ${deDate(rec.date)} — ${zeilen.length} Positionen und alles, was daraus gelernt wurde.`,
    () => { Data.removeReceipt(rec.id); app.closeSheet(); app.toast("Gelöscht"); }, "Löschen"));
  body.append(del);

  app.sheet(rec.store, deDate(rec.date), body);
}

/** Eine Position einem anderen Produkt zuordnen. */
function reassignSheet(kauf, rec, app) {
  const body = el("div");
  const p = byId(kauf.productId);
  body.append(el("p", "sheetPara",
    `Zurzeit gebucht als ${p ? p.name : kauf.productId}. Ein anderes Produkt suchen — ` +
    "der Rhythmus zieht mit um."));

  const feld = el("label", "field");
  const eingabe = el("input");
  eingabe.type = "search";
  eingabe.placeholder = "Produkt suchen";
  eingabe.setAttribute("aria-label", "Anderes Produkt suchen");
  feld.append(eingabe);
  body.append(feld);

  const treffer = el("ul", "results");
  body.append(treffer);

  const zeigen = () => {
    treffer.innerHTML = "";
    const query = eingabe.value.trim();
    if (!query) return;
    Data.searchProducts(query, 8).forEach((x) => {
      const li = el("li");
      const b = el("button");
      b.innerHTML = `<span class="rn">${esc(x.name)}</span><span class="rc">${esc(x.aisle)}</span>`;
      b.addEventListener("click", () => {
        Data.updatePurchase(kauf.id, { productId: x.id });
        // Und die Schreibweise merken, damit derselbe Fehltreffer
        // beim nächsten Bon nicht wieder passiert.
        if (kauf.raw) Data.learnAlias(kauf.raw, x.id);
        app.closeSheet();
        app.toast(`Jetzt ${x.name}`);
      });
      li.append(b);
      treffer.append(li);
    });
  };
  eingabe.addEventListener("input", zeigen);
  body.append(el("p", "srcnote",
    "Die Zuordnung gilt rückwirkend: der alte Rhythmus verliert diesen Kauf, der neue bekommt ihn."));

  app.sheet("Anders zuordnen", p ? p.name : null, body);
}

/* ================================================================
   Sicherung
   ================================================================
   Der Text hier ist Teil der Funktion. Eine Zeile „nicht gesichert“
   bewegt niemanden; „40 Bons und drei Jahre gelernter Rhythmus liegen
   nur in diesem Browser“ schon. Deshalb nennt jede Meldung, was
   konkret auf dem Spiel steht, und jede bietet den Handgriff daneben
   an, statt ihn in eine zweite Ebene zu legen.
   ================================================================ */
function backupGroup(ctx, app) {
  const S = Data.get();
  const h = ctx.backup;
  const g = uiGroup("Sicherung",
    "Diese App hat keinen Server und kein Konto — das ist Absicht, und es hat einen Preis: die Daten " +
    "liegen ausschließlich in diesem Browser.\n\n" +
    "Browser dürfen ihren Speicher aufräumen. Auf iPhone und iPad löscht Safari die Daten einer nicht " +
    "installierten Web-App nach sieben Tagen ohne Nutzung. Und „Browserdaten löschen“ trifft die App mit.\n\n" +
    "Drei Stufen helfen dagegen, in dieser Reihenfolge: dauerhaften Speicher erlauben, die App zum " +
    "Startbildschirm hinzufügen, und eine Sicherungsdatei außerhalb des Browsers halten. Nur die letzte " +
    "überlebt wirklich alles.");

  const klasse = { gesichert: "f-ok", ok: "f-ok", erinnerung: "f-gold", gefaehrdet: "f-miss", unkritisch: "" }[h.level] || "";
  g.body.append(uiRow(h.title, h.message, flag(
    h.level === "gefaehrdet" ? "gefaehrdet" : "gesichert",
    klasse,
    { gesichert: "sicher", ok: "sicher", erinnerung: "fällig", gefaehrdet: "Achtung", unkritisch: "—" }[h.level] || "—"
  )));

  /* Dauerhafter Speicher. Wenn der Browser ihn schon gewährt hat,
     steht es da; sonst ist es ein Tippen. */
  if (!h.risk.fluechtig) {
    g.body.append(uiRow("Dauerhafter Speicher", "Der Browser räumt diese Daten nicht mehr weg.", null, { value: "an" }));
  } else {
    const b = el("button", "row action");
    // Nicht denselben Satz wie oben: der Grund steht schon im
    // Zustand darüber, und zweimal dasselbe zu lesen lässt beide
    // Zeilen unwichtig wirken.
    b.append(el("div", "rowMain",
      '<div class="rowTitle">Dauerhaften Speicher erlauben</div>' +
      '<div class="rowSub">Nimmt die Daten vom automatischen Aufräumen aus. Kostet nichts, hilft sofort.</div>'));
    b.addEventListener("click", () => {
      Backup.requestPersist().then((ok) => {
        app.render();
        app.notice(ok ? "Erlaubt" : "Nicht erlaubt", ok
          ? "Der Browser räumt diese Daten jetzt nicht mehr von selbst weg. Gegen „Browserdaten löschen“ hilft trotzdem nur eine Datei."
          : "Dieser Browser hat abgelehnt — das entscheidet er selbst, oft nach Nutzungsdauer. Umso wichtiger ist eine Sicherungsdatei; " +
            "auf iPhone und iPad hilft zusätzlich, die App zum Startbildschirm hinzuzufügen.");
      });
    });
    g.body.append(b);
  }

  /* Automatische Datei — der einzige Zustand, der ohne Disziplin
     auskommt. Wo der Browser sie nicht kann, wird das gesagt statt
     eine tote Schaltfläche zu zeigen. */
  if (Backup.supportsAutoFile()) {
    if (Backup.handle) {
      const row = el("button", "row action");
      row.append(el("div", "rowMain",
        '<div class="rowTitle">Automatische Sicherung läuft</div>' +
        `<div class="rowSub">${esc(Backup.handle.name || "gewählte Datei")} — wird bei jeder Änderung mitgeschrieben</div>`));
      row.addEventListener("click", () => app.confirm("Automatik beenden?",
        "Die Datei bleibt liegen, sie wird nur nicht mehr fortgeschrieben.",
        () => { Backup.forgetTarget().then(() => { app.render(); app.toast("Beendet"); }); }, "Beenden"));
      g.body.append(row);
    } else {
      const row = el("button", "row action");
      row.append(el("div", "rowMain",
        '<div class="rowTitle">Datei wählen und automatisch sichern</div>' +
        '<div class="rowSub">Einmal auswählen, danach schreibt die App bei jeder Änderung selbst hinein</div>'));
      row.addEventListener("click", () => {
        Backup.chooseTarget(backupFileName(Data.today()))
          .then(() => Backup.writeNow(Data.exportJson()))
          .then((ok) => {
            if (ok) Data.noteBackup("auto");
            app.render();
            app.toast(ok ? "Automatik läuft" : "Nicht geschrieben");
          })
          .catch(() => { /* abgebrochen — keine Meldung nötig */ });
      });
      g.body.append(row);
    }
  }

  /* Der Weg, der überall geht. */
  const dl = el("button", "row action");
  dl.append(el("div", "rowMain",
    '<div class="rowTitle">Sicherung jetzt herunterladen</div>' +
    `<div class="rowSub">${S.purchases.length} Käufe, ${S.receipts.length} Bons, alles Gelernte</div>`));
  dl.addEventListener("click", () => {
    const ok = Backup.download(Data.exportJson(), backupFileName(Data.today()));
    if (ok) Data.noteBackup("datei");
    app.render();
    app.toast(ok ? "Gesichert" : "Nicht möglich");
  });
  g.body.append(dl);

  if (!Backup.supportsAutoFile()) {
    g.body.append(el("p", "srcnote",
      "Dieser Browser kann keine Datei automatisch fortschreiben. Deshalb erinnert die App daran — " +
      "und deshalb ist es hier wichtiger als anderswo, die Datei irgendwohin zu legen, wo sie gesichert wird."));
  }

  return g;
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

  // „M“ und „E“ sind genau die Art Kürzel, die man einmal erklärt
  // haben will — beide Marken sind deshalb antippbar.
  const zeile = (key, cls, kuerzel, titel, unten) => {
    const li = el("li");
    li.append(flag(key, cls, kuerzel));
    li.append(el("span", null, `${esc(titel)}<br><small>${esc(unten)}</small>`));
    return li;
  };
  const list = el("ul", "plain");
  list.append(zeile("marke", "", "M", c.marke ? brandLabel(c.marke) : "Marke",
    `${eur(c.markenPreis)} ${einheit} · ${c.markenKaeufe} Käufe`));
  list.append(zeile("eigenmarke", "f-ok", "E", c.eigenmarke ? brandLabel(c.eigenmarke) : "Eigenmarke",
    `${eur(c.eigenPreis)} ${einheit}${c.belegt ? " · " + c.eigenKaeufe + " Käufe" : " · geschätzt"}`));
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
/**
 * „War die App zu spät?“ — gefragt in dem Moment, in dem es wahr ist.
 * ================================================================
 * DAS PROBLEM, DAS DAS LÖST.
 *
 * Von den Rückmeldungen hatte genau eine keinen natürlichen Moment.
 * „Hab noch“ hat einen: du gehst die Liste durch, siehst Milch,
 * weißt dass noch welche da ist, nimmst sie runter — der Moment IST
 * die Handlung. „War schon alle“ dagegen wird Tage vorher wahr, vor
 * dem leeren Kühlschrank. Bis jemand die Liste aufmacht, ist der
 * Ärger vorbei, und niemand öffnet ein Detail-Blatt, um zu melden,
 * dass eine App zu spät war.
 *
 * Damit konnte die App gut lernen, dass sie zu FRÜH ist, und
 * praktisch gar nicht, dass sie zu SPÄT ist. Eine Schieflage in
 * genau die unangenehmere Richtung.
 *
 * Der Moment, in dem es wahr wird, ist dieser: jemand setzt ein
 * Produkt selbst auf die Liste, das die App noch gar nicht
 * vorgeschlagen hätte. Dann war sie zu spät, und zwar jetzt gerade.
 *
 * WARUM GEFRAGT UND NICHT GESCHLOSSEN. Aus „hat es selbst
 * hinzugefügt“ automatisch „App war zu spät“ abzuleiten, wäre ein
 * stilles Signal, das neben den Kaufdaten in dieselbe Korrektur
 * liefe — die Doppelzählung, die dieses Projekt schon dreimal Geld
 * gekostet hat. Es gibt genug andere Gründe, etwas früher zu kaufen:
 * Gäste, ein Rezept, ein Angebot. Deshalb eine Frage mit einer
 * Antwort, die man auch weglassen kann.
 *
 * @returns {boolean} ob gefragt wurde — der Aufrufer unterdrückt
 *                    dann seine eigene Bestätigung.
 * ================================================================
 */
function askLate(productId, ctx, app) {
  // Haushaltsprodukte rechnen über eine Verbrauchsrate, nicht über
  // einen Kaufabstand — für sie gibt es nichts zu korrigieren.
  if (isNonFood(productId)) return false;

  const r = ctx.rhythms.get(productId);
  if (!r || !r.rhythmDays || !r.lastPurchaseDate || r.confidence < 0.4) return false;

  const dueIn = r.rhythmDays - daysBetween(r.lastPurchaseDate, ctx.ref);
  /* Erst ab zwei Tagen fragen. Wer einen Tag vor der Fälligkeit
     einkauft, hat nicht die App korrigiert, sondern eingekauft. */
  if (!(dueIn >= 2)) return false;

  const p = byId(productId);
  const body = frag();
  const g = uiGroup(`Die App hätte ${p.name} erst in ${dueIn} Tagen vorgeschlagen.`,
    "Ein Ja verkürzt den gelernten Kaufabstand — es ist die einzige Rückmeldung, die das tut.\n\n" +
    "Deshalb wird gefragt statt geschlossen: dass du etwas früher kaufst, kann auch an Gästen, einem " +
    "Rezept oder einem Angebot liegen. Nur du weißt, ob es wirklich schon alle war.\n\n" +
    "Auch ein Ja wirkt nicht sofort: erst ab drei Rückmeldungen zu einem Produkt passt die App den " +
    "Rhythmus an, und höchstens um 40 %.");

  const ja = el("button", "row");
  ja.append(el("div", "rowMain",
    '<div class="rowTitle">Ja, war schon alle</div>' +
    '<div class="rowSub">der Abstand wird kürzer</div>'));
  ja.addEventListener("click", () => {
    Data.recordFeedback(productId, "empty", dueIn);
    App.closeSheet();
    app.toast("Notiert — der Takt wird angepasst", { icon: "↻" });
  });

  const nein = el("button", "row");
  nein.append(el("div", "rowMain",
    '<div class="rowTitle">Nein, nur diesmal</div>' +
    '<div class="rowSub">der Rhythmus bleibt, wie er ist</div>'));
  nein.addEventListener("click", () => App.closeSheet());

  g.body.append(ja, nein);
  body.append(g);
  app.sheet("Kam das zu spät?", p.name, body);
  return true;
}

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
    /* Die Bestätigung nur, wenn nichts nachgefragt wird. Sonst legt
       sich der Hinweis über das Blatt und verdeckt die Antwort, um
       die gerade gebeten wird — das Blatt IST dann die Bestätigung. */
    if (!(opts.productId && askLate(opts.productId, ctx, app))) {
      app.toast(`${entry.name} auf der Liste`, { icon: "+" });
    }
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
/**
 * Eine Position der Liste.
 *
 * DER KREIS HEISST „IM WAGEN“, NICHT „AUF DER LISTE“.
 * Begründung steht bei App.toggleCart. Was hier folgt, ist die
 * Konsequenz: die Zeile kennt nur noch zwei Zustände — sie steht an,
 * oder sie liegt im Wagen. „Diese Woche nicht“ nimmt sie aus der
 * Liste heraus, dann steht sie hier gar nicht mehr.
 */
function listItem(it, ctx, app) {
  const p = byId(it.productId) || {};
  const manuell = it.basis === "manuell";
  const imWagen = Data.get().storeChecked.includes(it.choiceKey);
  const li = el("li", "item" + (imWagen ? " imWagen" : ""));

  const top = el("div", "top");
  const cb = el("input");
  cb.type = "checkbox"; cb.className = "box"; cb.checked = imWagen;
  cb.setAttribute("aria-label", `${it.name} in den Wagen`);
  cb.addEventListener("change", () => app.toggleCart(it.choiceKey));

  // Kein <button>, sondern ein Element mit Schaltflächen-Rolle: die
  // Marken darin sind selbst antippbar, und eine Schaltfläche in
  // einer Schaltfläche ist ungültiges HTML — Browser hängen die
  // innere dann aus dem Baum aus, und das Antippen ginge ins Leere.
  const main = el("div", "main");
  main.setAttribute("role", "button");
  main.setAttribute("tabindex", "0");
  main.setAttribute("aria-label", `Details zu ${it.name}`);
  const nm = el("div", "nm", esc(it.name));

  /* HÖCHSTENS EIN ZEICHEN JE ZEILE.
     Vorher konnten fünf nebeneinander stehen — „von dir“, „3 T
     überfällig“, „38 %“, „VD“, „+8 %“, „doppelt?“ —, und eine Zeile
     mit fünf bunten Marken liest niemand mehr als Zeile. Die
     Zielgruppe nannte das „überladen“, und sie hatte recht.
     Sortiert nach dem, was eine Entscheidung ändert: ein möglicher
     Doppelkauf zuerst (den will man wissen, BEVOR man losgeht), dann
     die eigene Antwort, dann Sicherheit, dann der Preis. Alles
     Übrige steht unverändert im Detail-Blatt der Zeile. */
  /* HÖCHSTENS EIN ZEICHEN, und nur wenn es eine HANDLUNG auslöst.
     Vorher konnten fünf nebeneinander stehen. Die Zielgruppe nannte
     das „überladen“, und der Grund ist nicht die Menge allein: „+8,4 %“
     ändert nichts an der Entscheidung, die Milch zu kaufen. Es ist
     eine Beobachtung, keine Aufforderung — und Beobachtungen gehören
     ins Detail-Blatt, das ein Tippen entfernt ist.

     Was bleibt, verlangt eine Entscheidung, BEVOR man losgeht:
       doppelt?  — vielleicht gar nicht kaufen
       hab noch  — die eigene Antwort, damit sie nicht vergessen wird
       von dir   — nicht die App hat das vorgeschlagen, du warst es
       VD        — direkt kühlen, nicht erst nach dem Kaffee
     Preisabweichung, Verderb-Risiko und „3 T überfällig“ stehen
     unverändert im Detail-Blatt. Überfällig ist ohnehin der GRUND,
     warum die Zeile hier steht — sie erklärt sich damit selbst. */
  const zeichen = [];
  if (ctx.duplicates.some((d) => d.productId === it.productId)) {
    zeichen.push(["doppelt", "dup", "doppelt?"]);
  }
  /* Die Marke „Deine Antwort" stand hier für abgewählte Positionen.
     Seit abgewählte Positionen die Liste verlassen und sich unten in
     „Nicht diese Woche" sammeln, kann sie nie mehr erscheinen — sie
     wäre ab jetzt toter Code, der bei jeder Zeile mitgeprüft wird. */
  if (manuell) zeichen.push(["own", "own", "von dir"]);
  /* Ausgeschrieben, nicht abgekürzt.
     „VD“ stand hier zwei Buchstaben lang und erklärte sich nur dem,
     der es antippt — und antippen tut man nur, was man versteht. Die
     Marke, die vor der einzigen rechtlich harten Frist der App warnt,
     darf kein Rätsel sein. Sie ist damit die längste Marke der Liste;
     das ist der Preis und er ist richtig herum bezahlt. */
  if (p.safetyCritical) zeichen.push(["vd", "safety", "Verbrauchsdatum"]);
  if (zeichen.length) nm.append(pill(...zeichen[0]));
  main.append(nm);
  main.addEventListener("keydown", (ev) => {
    if (ev.target !== main) return;          // eine Marke hat ihre eigene Taste
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); main.click(); }
  });
  main.addEventListener("click", () => {
    // Eine frei eingetragene Zeile hat kein Detail-Blatt — sie hat ja
    // keine Daten. Sie bekommt ihr eigenes, kleines.
    if (manuell && (!it.productId || !byId(it.productId))) manualSheet(it, app);
    else if (manuell) manualSheet(it, app);
    else productSheet(it.productId, ctx);
  });

  // Ohne Preis keine Preisspalte — „0,00 €“ wäre eine Behauptung.
  top.append(cb, main, el("div", "price", it.price > 0 ? eur(it.halved ? it.price / 2 : it.price) : "—"));
  /* Der Winkel am Ende. Der Name öffnet seit jeher das Detail-Blatt,
     aber nichts sagte das: überall sonst in der App markiert genau
     dieser Winkel eine Zeile, die sich öffnen lässt — nur auf der
     Liste fehlte er. Damit war das Blatt mit Rhythmus, Preisverlauf
     und Datenqualität für jeden unsichtbar, der nicht zufällig
     draufgetippt hat. */
  top.append(el("div", "chev"));
  li.append(top);

  /* Der Vorschlag zur halben Menge.
     Vorher stand hier ein grauer Knopf „Halbe Menge“ ohne jeden
     Zusammenhang — die einzige Zeile der Liste, die doppelt so hoch
     war, und niemand wusste, warum sie es war. Jetzt sagt sie den
     Grund und ist selbst die Antwort darauf: ein Satz, den man
     antippt. Das ist dieselbe Handlung, nur verständlich. */
  if (it.on && it.riskFlag) {
    const p2 = byId(it.productId) || {};
    // Kurz halten: auf 390 Pixeln bricht jeder längere Satz um, und
    // eine zweizeilige Zeile in einer Liste sieht wieder nach Ballast
    // aus — genau dem, was hier abgebaut werden sollte.
    const grund = p2.shelfLifeDays && p2.shelfLifeDays <= 7
      ? `Hält ${p2.shelfLifeDays} ${p2.shelfLifeDays === 1 ? "Tag" : "Tage"}`
      : "Bleibt oft übrig";
    const h = el("button", "halfRow" + (it.halved ? " on" : ""));
    h.setAttribute("aria-pressed", it.halved ? "true" : "false");
    h.innerHTML = it.halved
      ? `<span class="hMark">✓</span><span>Halbe Menge · spart ${esc(eur(it.price / 2))}</span>`
      : `<span class="hMark">½</span><span>${esc(grund)} — halbe Menge?</span>`;
    h.addEventListener("click", () => {
      const now = !it.halved;
      app.choose(it.choiceKey, { halved: now });
      // Nur beim Setzen. Gegen mehrfaches Zählen sperrt zusätzlich
      // Data.recordRescue — ein Produkt kann höchstens einmal am Tag
      // gerettet werden.
      if (now) app.rescue(it.productId, `${it.name}: halbe Menge`, it.price / 2);
    });
    li.append(h);
  }

  return li;
}

/**
 * Die vier Antworten — jetzt an einem benannten Ort.
 *
 * Sie standen in der Zeile und erschienen, sobald man den Haken
 * wegnahm. Das war eine Frage ohne Überschrift („warum eigentlich?“)
 * und dazu falsch aufgehängt: „War schon alle“ heißt ja gerade, dass
 * das Produkt gebraucht wird — es korrigiert nur den Takt und bleibt
 * auf der Liste. Als Antwort auf „warum weg?“ ergab das keinen Sinn.
 *
 * Jetzt steht die Frage ausgeschrieben da, und die Antworten sagen
 * jeweils, was sie bewirken.
 */
function weekChoice(it, ctx, app, onDone) {
  const g = uiGroup("Brauchst du das diese Woche?",
    "„Hab noch“ sagt der App, dass ihr Vorschlag zu früh kam — der gelernte Kaufabstand wird länger. " +
    "„Diese Woche nicht“ ist eine bewusste Pause und lässt den Rhythmus in Ruhe.\n\n" +
    "Nichts davon wird sofort verrechnet: erst ab drei Rückmeldungen zu einem Produkt passt die App " +
    "den Rhythmus an, und höchstens um 40 %. Eine einzelne Antwort kippt nichts um.\n\n" +
    "Die Gegenrichtung — „war schon alle, du warst zu spät“ — wird nicht hier gefragt, sondern in dem " +
    "Moment, in dem sie wahr ist: wenn du ein Produkt selbst hinzufügst, das noch gar nicht fällig war.");

  WEEK_REASONS.map((k) => REASONS.find((r) => r.key === k)).forEach((rr) => {
    const gewaehlt = it.reason === rr.key;
    const r = el("button", "row" + (gewaehlt ? " chosen" : ""));
    r.setAttribute("aria-pressed", gewaehlt ? "true" : "false");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(rr.label)}</div><div class="rowSub">${esc(REASON_EFFECT[rr.key])}</div>`));
    if (gewaehlt) r.append(el("div", "rowValue", "✓"));
    r.addEventListener("click", () => {
      app.choose(it.choiceKey, { reason: rr.key });
      if (onDone) onDone();
    });
    g.body.append(r);
  });

  if (!it.on) {
    const zurueck = el("button", "row");
    zurueck.append(el("div", "rowMain",
      '<div class="rowTitle">Doch drauf</div><div class="rowSub">zurück auf die Liste dieser Woche</div>'));
    zurueck.addEventListener("click", () => {
      app.choose(it.choiceKey, { on: true, reason: null });
      if (onDone) onDone();
    });
    g.body.append(zurueck);
  }
  return g;
}

/** Was jede Antwort bewirkt — in einem Halbsatz, nicht in einem Absatz. */
const REASON_EFFECT = {
  have: "der Vorschlag kam zu früh — der Abstand wird länger",
  empty: "kam zu spät — der Abstand wird kürzer",
  skip: "eine bewusste Pause, ohne Wirkung auf den Rhythmus"
};

/** Was diese Woche nicht gebraucht wird — gesammelt statt verstreut. */
function weekOffSheet(ctx, app) {
  const off = ctx.items.filter((i) => !i.on);
  const body = frag();
  if (!off.length) body.append(el("p", "empty", "Nichts abgewählt."));
  off.forEach((it) => {
    const g = uiGroup(it.name, null);
    const rr = REASONS.find((x) => x.key === it.reason);
    g.body.append(uiRow(rr ? rr.label : "abgewählt", rr ? REASON_EFFECT[rr.key] : null, null, {}));
    const zurueck = el("button", "row");
    zurueck.append(el("div", "rowMain",
      '<div class="rowTitle">Doch drauf</div><div class="rowSub">zurück auf die Liste dieser Woche</div>'));
    zurueck.addEventListener("click", () => {
      app.choose(it.choiceKey, { on: true, reason: null });
      App.closeSheet();
    });
    g.body.append(zurueck);
    body.append(g);
  });
  app.sheet("Nicht diese Woche", `${off.length} ${off.length === 1 ? "Position" : "Positionen"}`, body);
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
   3. Bestand
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
      r.append(flag(o.expired ? "angebrochen" : "rest",
        o.expired ? "f-miss" : o.urgent ? "f-gold" : "f-ok",
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
    // Wie in der Liste: die Marke rechts ist selbst antippbar, also
    // darf die Zeile keine echte Schaltfläche sein.
    const r = el("div", "row");
    r.setAttribute("role", "button");
    r.setAttribute("tabindex", "0");
    r.append(el("div", "rowMain",
      `<div class="rowTitle">${esc(i.name)}${i.opened ? ' <span class="pill">offen</span>' : ""}</div>` +
      `<div class="rowSub">${de(i.remainingUnits.toFixed(1))} · ${eur(i.value)}</div>`));
    r.append(flag(longLived ? "haltbar" : "rest", longLived ? "f-ok" : flagCls,
      longLived ? "haltbar" : `${i.daysLeft} T`));
    r.addEventListener("keydown", (ev) => {
      if (ev.target !== r) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); r.click(); }
    });
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

    /* Der Weg zu „Fällig“.
     *
     * Seit die Seite keinen eigenen Reiter mehr hat, führt die
     * Startseite nur dorthin, wenn wirklich etwas zu tauschen ist.
     * Ohne diese Zeile wäre sie an ruhigen Tagen nur noch über die
     * Adresse erreichbar — und „Demnächst“, „Geht aus“ und
     * „Günstig bevorraten“ wären damit verschwunden statt umgezogen. */
    if (ctx.swapsDue.length || ctx.stockUp.length) {
      const offen = ctx.swapsDue.filter((x) => x.due).length;
      g.body.append(uiRow("Austausch und Nachschub",
        offen ? `${offen} ${offen === 1 ? "Sache ist" : "Sachen sind"} fällig` : "nichts fällig",
        null, { onClick: () => app.goto("faellig") }));
    }
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
   4. Erfassen
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
      // Antippen öffnet die Positionen. Bis hierher konnte man einen
      // Bon nur ganz löschen — nach einem Fehltreffer der Erkennung
      // hieß das: alles wegwerfen und neu erfassen.
      const oeffnen = el("button", "rowOpen");
      oeffnen.setAttribute("aria-label", `Bon vom ${deDate(rec.date)} ansehen`);
      oeffnen.append(el("div", "chev"));
      oeffnen.addEventListener("click", () => receiptSheet(rec, app));
      r.append(oeffnen);
      g.body.append(r);
    });
    c.append(g);
  }
  return c;
}

/* ================================================================
   Bild statt Abtippen
   ================================================================
   Zwei Wege führen zum selben Ziel: das Foto eines Papierbons und
   der Screenshot eines digitalen Bons aus der Händler-App. Beides
   ist ein Bild, beides landet nach der Erkennung im selben Textfeld
   und derselben Prüfliste — die Zuordnung bestätigt weiterhin ein
   Mensch, Zeile für Zeile.

   Das ist keine Bequemlichkeit, sondern die Bedingung: eine
   Texterkennung liest, sie versteht nicht. Sie darf Vorschläge
   machen und niemals buchen.
   ================================================================ */
function ocrPicker(box, cap, app) {
  const wrap = el("div", "shot");

  if (!OCR.supported()) {
    // Kein Vorwurf und kein Fehler: der Textweg steht ja darunter.
    wrap.append(el("p", "srcnote", esc(OCR.reason())));
    box.append(wrap);
    return;
  }

  const status = el("div", "shotStatus");
  const bar = el("div", "shotBar");
  const fill = el("i");
  bar.append(fill);

  const setStatus = (text, anteil) => {
    status.textContent = text;
    bar.hidden = anteil === null;
    fill.style.width = Math.round((anteil || 0) * 100) + "%";
  };

  const input = el("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  input.setAttribute("aria-label", "Bon-Bild wählen");

  const kamera = el("input");
  kamera.type = "file";
  kamera.accept = "image/*";
  // Sagt dem Telefon: Kamera, Rückseite. Auf dem Rechner ohne Wirkung.
  // Als Attribut, nicht als Eigenschaft: `capture` ist nicht überall
  // an eine Eigenschaft gebunden, das Attribut wird dagegen von jedem
  // Browser gelesen, der es kennt.
  kamera.setAttribute("capture", "environment");
  kamera.hidden = true;
  kamera.setAttribute("aria-label", "Bon fotografieren");

  let laeuft = false;

  const lies = (datei) => {
    if (!datei || laeuft) return;
    if (!/^image\//.test(datei.type || "")) { app.toast("Das ist kein Bild"); return; }
    laeuft = true;
    cap.shotName = datei.name || "Bild";
    setStatus("Bild wird gelesen …", 0);
    app.render();

    OCR.read(datei, (phase, anteil) => {
      setStatus(phase === "liest" ? "Text wird gelesen …" : "Texterkennung wird geladen …", anteil);
    })
      .then((text) => {
        const gelesen = readReceiptImage(text, { today: Data.today() });
        laeuft = false;
        cap.text = gelesen.text;
        cap.ocr = gelesen;
        // Datum und Markt nur setzen, wenn im Bild etwas stand —
        // eine leere Vorgabe zu überschreiben hilft, eine bewusst
        // gesetzte zu überschreiben ärgert.
        if (gelesen.date) cap.date = gelesen.date;
        if (gelesen.store) cap.store = gelesen.store;
        cap.parsed = gelesen.quality.ok ? Data.parseReceiptText(gelesen.text) : null;
        app.render();
        if (!gelesen.quality.ok) app.notice("Nicht genug erkannt", gelesen.quality.message);
      })
      .catch((e) => {
        laeuft = false;
        cap.ocr = null;
        app.render();
        app.notice("Texterkennung fehlgeschlagen",
          (e && e.message ? e.message + ".\n\n" : "") +
          "Der Bontext lässt sich weiter unten von Hand einfügen — daran ändert das nichts.");
      });
  };

  input.addEventListener("change", () => lies(input.files && input.files[0]));
  kamera.addEventListener("change", () => lies(kamera.files && kamera.files[0]));

  const knoepfe = el("div", "shotRow");
  const foto = el("button", "cta", "Fotografieren");
  foto.addEventListener("click", () => kamera.click());
  const waehlen = el("button", "cta light", "Bild wählen");
  waehlen.addEventListener("click", () => input.click());
  knoepfe.append(foto, waehlen);

  wrap.append(knoepfe, input, kamera, status, bar);
  bar.hidden = true;

  // Auf dem Rechner ist Einfügen der schnellste Weg: Screenshot
  // machen, hierher, Strg+V. Der Hörer bekommt das Fenster, nicht
  // die Schaltfläche — sonst müsste man erst hineinklicken.
  const einfuegen = (ev) => {
    const items = (ev.clipboardData && ev.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.startsWith("image/")) {
        ev.preventDefault();
        lies(it.getAsFile());
        return;
      }
    }
  };
  document.addEventListener("paste", einfuegen);
  // Beim nächsten Aufbau der Ansicht wieder abmelden, sonst hängen
  // nach zehn Wechseln zehn Hörer am Fenster.
  app.onLeaveView(() => document.removeEventListener("paste", einfuegen));

  wrap.addEventListener("dragover", (ev) => { ev.preventDefault(); wrap.classList.add("over"); });
  wrap.addEventListener("dragleave", () => wrap.classList.remove("over"));
  wrap.addEventListener("drop", (ev) => {
    ev.preventDefault();
    wrap.classList.remove("over");
    const datei = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    lies(datei);
  });

  wrap.append(el("p", "srcnote",
    "Foto eines Papierbons oder Screenshot aus der Händler-App. Das Bild bleibt auf dem Gerät — " +
    "die Erkennung läuft hier, nicht auf einem Server."));

  if (cap.ocr) {
    const q = cap.ocr.quality;
    wrap.append(uiRow(q.level === "gut" ? "Erkannt" : "Durchsehen", q.message, null, {}));
  }

  box.append(wrap);
}

function renderScan(box, cap, app) {
  ocrPicker(box, cap, app);

  const ta = el("textarea");
  ta.value = cap.text || "";
  ta.placeholder = "… oder Bon-Text einfügen";
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
    app.askPersist();
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
   5. Zahlen
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
  const ig = uiGroup("Wirkung", cmp.framing + "\n\n" + cmp.note +
    "\n\nJede dieser Zahlen ist abgeleitet, keine ist gewogen. Ein Tippen auf ein Produkt zeigt die " +
    "einzelnen Verdachtsfälle — und lässt dich widersprechen, wo du es besser weißt.");
  ig.body.append(uiRow("Geschätzter Verlust", null, null, { value: de(ctx.impact.kg) + " kg" }));
  ctx.impact.byProduct.slice(0, 5).forEach((x) => {
    // Antippbar: von der Gesamtzahl zu den Fällen, aus denen sie besteht.
    const pid = (FOOD_DATABASE.find((f) => f.name === x.name) || {}).id;
    ig.body.append(uiRow(x.name, null, null, {
      value: de(x.kg) + " kg",
      onClick: pid ? () => productSheet(pid, ctx) : undefined
    }));
  });
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
   6. Mehr
   ================================================================ */
function viewMehr(ctx, app) {
  const c = frag();
  if (ctx.backup.urgent) c.append(backupGroup(ctx, app));
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
      `rechtlich definiert: ${q.regulatorisch}\n` +
      `Leitlinie: ${q.leitlinie} — aus behördlicher Lagerempfehlung abgeleitet (BZfE, BMEL)\n` +
      `Schätzwert: ${q.schaetzwert} — ohne amtliche Quelle, vor Produktivbetrieb prüfen\n\n` +
      `${q.anteilGeschaetzt} % der Haltbarkeitswerte sind Schätzungen. Das ist der ehrliche Preis für die Abdeckung von ${q.total} Produkten.\n\n` +
      `${q.safetyCritical} Produkte tragen ein Verbrauchsdatum. Für sie schlägt die App nie eine Weiterverwendung vor — und ihre Tageszahlen ` +
      `stehen ausdrücklich NICHT als „rechtlich definiert“ da: geregelt sind die Pflicht zum Verbrauchsdatum (LMIV Art. 24) und die ` +
      `Höchsttemperatur (Tier-LMHV Anlage 5), nicht die Anzahl der Tage. Die Tage sind Lagerempfehlungen, jeweils an der unteren Grenze. ` +
      `Es gilt immer das aufgedruckte Datum.`)
  }));
  m.body.append(uiRow("Über", `Bauversion ${window.__BUILD__ || "dev"}`, null, {
    onClick: () => app.notice("Einkaufs-Anker",
      "Alle Zahlen werden im Browser gerechnet. Kein Server, kein Konto, keine Übertragung.\n\n" +
      "Quellen: BZfE/BLE „Haltbarkeit von Lebensmitteln\“ und „Lebensmittel richtig lagern\“ (20.02.2025), " +
      "Verbraucherzentrale „MHD ist nicht gleich Verbrauchsdatum\“.")
  }));
  c.append(m);

  /* --- Sicherung ---
     Steht normalerweise hier unten bei den Daten, wo man sie sucht.
     Ist der Bestand aber wirklich gefährdet, wandert sie nach ganz
     oben — eine Warnung, die man erst erscrollen muss, ist keine.
     Der Zustand kommt aus backupGuard, die Handgriffe aus
     ui/backup.js. */
  if (!ctx.backup.urgent) c.append(backupGroup(ctx, app));

  /* --- Einstellungen für die Liste ---
     Standen bis hierher unten auf der Startseite. Sie sind
     Einstellungen: man fasst sie einmal an und danach monatelang
     nicht mehr — auf der Seite, die man täglich öffnet, waren sie
     vier Blöcke Ballast. */
  const wl = uiGroup("Deine Liste",
    "Diese vier Werte steuern, was auf der Einkaufsliste landet.\n\n" +
    "Das Budget streicht die teuersten entbehrlichen Positionen — Brot, Milch und Eier bleiben immer drauf. " +
    "Die Personenzahl skaliert die Mengen. Die Vorausschau nimmt mit, was in den nächsten Tagen fällig wird, " +
    "damit man nicht zweimal geht. Und der Urlaubsmodus stellt zurück, was bis zur Rückkehr verderben würde.");
  const restBudget = S.settings.budget - ctx.items.filter((i) => i.on)
    .reduce((a, i) => a + (i.halved ? i.price / 2 : i.price), 0);
  wl.body.append(uiRow("Budget",
    S.settings.budget ? (restBudget >= 0 ? `${eur(restBudget)} Luft` : `${eur(-restBudget)} drüber`) : null,
    stepper(S.settings.budget, (v) => (v ? eur(v) : "aus"),
      (v) => app.set((s) => { s.settings.budget = v; }), { min: 0, max: 400, step: 5 })));
  wl.body.append(uiRow("Personen", null,
    stepper(S.settings.household, String,
      (v) => app.set((s) => { s.settings.household = v; }), { min: 1, max: 8, step: 1 })));
  wl.body.append(uiRow("Vorausschau",
    ctx.pattern && ctx.pattern.dayName ? `nächster Einkauf ${ctx.pattern.dayName}` : null,
    stepper(S.settings.lookaheadDays, (v) => (v ? `${v} Tage` : "aus"),
      (v) => app.set((s) => { s.settings.lookaheadDays = v; }), { min: 0, max: 7, step: 1 })));

  const urlaub = S.settings.vacation;
  wl.body.append(uiRow("Urlaub",
    urlaub.active && urlaub.from ? `${deDate(urlaub.from)}–${deDate(urlaub.to)}` : null,
    toggle(urlaub.active, (onOff) => app.set((s) => {
      s.settings.vacation.active = onOff;
      if (onOff && !s.settings.vacation.from) {
        s.settings.vacation.from = Data.plusDays(Data.today(), 2);
        s.settings.vacation.to = Data.plusDays(Data.today(), 16);
      }
    }), "Urlaubsmodus")));
  if (urlaub.active) {
    const f = el("div", "dateRow");
    [["from", "Abreise"], ["to", "Rückkehr"]].forEach(([key, label]) => {
      const w = el("label", "field", `<span class="lbl">${label}</span>`);
      const i = el("input");
      i.type = "date";
      i.value = urlaub[key] || "";
      i.addEventListener("change", () => app.set((s) => { s.settings.vacation[key] = i.value; }));
      w.append(i);
      f.append(w);
    });
    wl.body.append(f);
  }
  c.append(wl);

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
