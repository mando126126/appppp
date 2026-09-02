/**
 * contrast.js — Lesbarkeit, nachgerechnet statt behauptet
 * ================================================================
 * Anlass: die getönten Marken der Liste („+8 %“, „doppelt?“, „VD“,
 * „3 T“) trugen ihre Palettenfarbe als Schrift auf einer 11-prozentigen
 * Tönung derselben Farbe. Gemessen ergab das 1,93:1 beim Gelb und
 * 2,84:1 beim Grün — die Norm (WCAG 2.1, Kriterium 1.4.3) verlangt
 * 4,5:1 für Fließtext.
 *
 * Das war kein Schönheitsfehler. Diese Marken tragen die Aussagen,
 * für die es die App gibt: ob etwas überfällig ist, ob der Preis
 * abweicht, ob ein Verbrauchsdatum drauf ist.
 *
 * Warum diese Datei existiert und nicht bloß eine einmalige
 * Korrektur: Farben werden angefasst. Ein Ton wird „etwas
 * freundlicher“, eine Deckkraft „etwas leichter“ — und niemand
 * rechnet nach, weil Nachrechnen von Hand niemand macht. Also rechnet
 * es der Test, direkt aus app.css. Wer künftig eine Farbe verschiebt,
 * bekommt hier Bescheid.
 *
 * Gerechnet wird nach WCAG 2.1: relative Leuchtdichte mit sRGB-
 * Linearisierung, Kontrast (L_hell + 0,05) / (L_dunkel + 0,05). Die
 * halbdurchsichtigen Tönungen werden dabei ECHT überlagert — eine
 * Farbe mit 11 % Deckkraft ist nicht die Farbe, sondern ihre Mischung
 * mit dem Grund darunter.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");

const CSS = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "app.css"), "utf8");

let pass = 0, fail = 0;
const problems = [];

function t(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) { pass++; return; }
    fail++; problems.push(`${name}: ${result}`);
    console.log(`  FEHL  ${name}\n        ${result}`);
  } catch (e) {
    fail++; problems.push(`${name}: ABSTURZ ${e.message}`);
    console.log(`  ABSTURZ ${name}\n        ${e.message}`);
  }
}

const section = (title) => console.log(`\n--- ${title} ---`);

/* ---------- Farbrechnung ---------- */

function parseColor(value) {
  const v = String(value).trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)), alpha: 1 };
  }
  const rgba = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4])
    };
  }
  return null;
}

/** Halbdurchsichtige Farbe über einen Grund legen. */
function over(fg, bg) {
  return fg.rgb.map((c, i) => c * fg.alpha + bg[i] * (1 - fg.alpha));
}

function luminance(rgb) {
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  const [hell, dunkel] = la > lb ? [la, lb] : [lb, la];
  return (hell + 0.05) / (dunkel + 0.05);
}

/**
 * Die Farbwerte eines Blocks aus app.css lesen.
 *
 * `bereich` ist entweder "hell" (der Grundblock `:root{...}`) oder
 * "dunkel" (der Block innerhalb der prefers-color-scheme-Abfrage).
 * Der dunkle erbt vom hellen — er überschreibt nur, was er nennt.
 */
function tokens(bereich) {
  const werte = {};
  const grund = CSS.slice(CSS.indexOf(":root{"), CSS.indexOf("@media (prefers-color-scheme: dark)"));
  const sammeln = (text) => {
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const farbe = parseColor(m[2]);
      if (farbe) werte[m[1]] = farbe;
    }
  };
  sammeln(grund);
  if (bereich === "dunkel") {
    const start = CSS.indexOf("@media (prefers-color-scheme: dark)");
    sammeln(CSS.slice(start, CSS.indexOf("}\n}", start)));
  }
  return werte;
}

const HELL = tokens("hell");
const DUNKEL = tokens("dunkel");

/** Kontrast einer Schriftfarbe auf einer Tönung über einer Fläche. */
function chipContrast(werte, textToken, tintToken, flaecheToken) {
  const text = werte[textToken];
  const tint = werte[tintToken];
  const flaeche = werte[flaecheToken];
  if (!text || !tint || !flaeche) return null;
  const grund = over(tint, flaeche.rgb);
  return contrast(over(text, grund), grund);
}

const MIN_TEXT = 4.5;      // WCAG AA, Fließtext
const MIN_GROSS = 3.0;     // WCAG AA, große Schrift ab 18,66 px fett

/* Alle getönten Marken: Schriftfarbe, Tönung, Fläche darunter. Die
   Liste ist die Wahrheit über das, was in app.css zusammengehört —
   wer ein Paar ergänzt, ergänzt es hier. */
const CHIPS = [
  ["Erledigt/gespart", "accent-ink", "accent-soft"],
  ["Dringend/verdorben", "red-ink", "red-soft"],
  ["Geschätzt/überfällig", "amber-ink", "amber-soft"],
  ["Hinweis", "blue-ink", "blue-soft"],
  ["Erreichtes", "violet-ink", "violet-soft"],
  ["Streak", "pink-ink", "pink-soft"]
];

// ================================================================
section("A: Getönte Marken im hellen Modus");

CHIPS.forEach(([name, textToken, tintToken]) => {
  t(`${name} ist lesbar (auf Karte)`, () => {
    const k = chipContrast(HELL, textToken, tintToken, "surface");
    if (k === null) return `Token fehlt: ${textToken} oder ${tintToken}`;
    return k >= MIN_TEXT ? true : `${k.toFixed(2)}:1 — nötig sind ${MIN_TEXT}:1`;
  });
});

CHIPS.forEach(([name, textToken, tintToken]) => {
  t(`${name} ist auch auf dem Seitengrund lesbar`, () => {
    // Marken sitzen meistens auf einer weißen Karte, im Ladenmodus
    // und in Kopfzeilen aber direkt auf dem Papierton.
    const k = chipContrast(HELL, textToken, tintToken, "paper");
    if (k === null) return "Token fehlt";
    return k >= MIN_TEXT ? true : `${k.toFixed(2)}:1`;
  });
});

// ================================================================
section("B: Dieselben Marken im dunklen Modus");

CHIPS.forEach(([name, textToken, tintToken]) => {
  t(`${name} ist im Dunkeln lesbar`, () => {
    const k = chipContrast(DUNKEL, textToken, tintToken, "surface");
    if (k === null) return "Token fehlt";
    return k >= MIN_TEXT ? true : `${k.toFixed(2)}:1`;
  });
});

// ================================================================
section("C: Fließtext und Nebentext");

const TEXTE = [
  ["Haupttext auf Papier", "ink", "paper"],
  ["Haupttext auf Karte", "ink", "surface"],
  ["Nebentext auf Papier", "ink-2", "paper"],
  ["Nebentext auf Karte", "ink-2", "surface"],
  ["Text auf Füllung", "ink-2", "surface"]
];

["hell", "dunkel"].forEach((bereich) => {
  const werte = bereich === "hell" ? HELL : DUNKEL;
  TEXTE.forEach(([name, fg, bg]) => {
    t(`${name} (${bereich})`, () => {
      const a = werte[fg], b = werte[bg];
      if (!a || !b) return `Token fehlt: ${fg}/${bg}`;
      const k = contrast(over(a, b.rgb), b.rgb);
      return k >= MIN_TEXT ? true : `${k.toFixed(2)}:1 — nötig sind ${MIN_TEXT}:1`;
    });
  });
});

t("Der dritte Grauton bleibt für kleine Beschriftungen brauchbar", () => {
  // ink-3 trägt Beschriftungen und Zeitangaben, keinen Fließtext.
  // Dafür gilt die niedrigere Schwelle — aber eine Schwelle gilt.
  for (const [bereich, werte] of [["hell", HELL], ["dunkel", DUNKEL]]) {
    const a = werte["ink-3"], b = werte.paper;
    if (!a || !b) return "Token fehlt";
    const k = contrast(over(a, b.rgb), b.rgb);
    if (k < MIN_GROSS) return `${bereich}: ${k.toFixed(2)}:1`;
  }
  return true;
});

// ================================================================
section("D: Farbige Flächen mit Text darauf");

t("Die Hauptschaltfläche trägt lesbaren Text", () => {
  /* Gefüllte Flächen benutzen NICHT die Palettenfarbe, sondern ihre
     tiefere Schwester. Auf dem hellen Grün lag Weiß bei 3,21:1 — bei
     der Schaltfläche, die in dieser App am häufigsten gedrückt wird. */
  for (const [bereich, werte] of [["hell", HELL], ["dunkel", DUNKEL]]) {
    const fg = werte["on-accent"], bg = werte["accent-strong"];
    if (!fg || !bg) return `Token fehlt (${bereich})`;
    const k = contrast(over(fg, bg.rgb), bg.rgb);
    if (k < MIN_TEXT) return `${bereich}: ${k.toFixed(2)}:1`;
  }
  return true;
});

t("Das Verbrauchsdatum-Zeichen ist auf Rot lesbar", () => {
  /* .pill.safety ist die einzige Marke ohne Tönung — sie ist die
     dringendste und steht deshalb auf voller Fläche. Im Dunkeln ist
     das Rot ein helles Korall; dort lag Weiß darauf bei 2,56:1, und
     die Lösung ist nicht ein anderes Rot, sondern dunkle Schrift. */
  for (const [bereich, werte] of [["hell", HELL], ["dunkel", DUNKEL]]) {
    const fg = werte["on-red"], bg = werte["red-strong"];
    if (!fg || !bg) return `Token fehlt (${bereich})`;
    const k = contrast(over(fg, bg.rgb), bg.rgb);
    if (k < MIN_TEXT) return `${bereich}: ${k.toFixed(2)}:1`;
  }
  return true;
});

// ================================================================
section("F: Gedimmte Zustände");

/* DIE LÜCKE, DIE DIESER ABSCHNITT SCHLIESST.
 *
 * Die Abschnitte A bis D prüfen Farbpaare. Ein Zustand mit `opacity`
 * ist aber kein Farbpaar — dort steht dieselbe Farbe wie überall,
 * und trotzdem kommt hinten etwas anderes heraus, weil Vordergrund
 * UND Hintergrund gemeinsam gegen den Grund verrechnet werden.
 *
 * Genau daran ist die Prüfung vorbeigelaufen: `.item.off` dimmte auf
 * .42, und die Beschriftung der vier Antwortknöpfe landete bei
 * 1,74:1 — unter dem Wert, bei dem etwas noch als „vorhanden“
 * durchgeht. Gefunden hat es kein Test, sondern ein Blick auf einen
 * Bildschirmabzug.
 *
 * Deshalb hier: jeder dauerhafte gedimmte Zustand mit seiner
 * Deckkraft, ausgerechnet in beiden Modi. Vorübergehende Zustände
 * (`:active`, Animationen) stehen bewusst nicht drin — sie dauern
 * Millisekunden. `:disabled` ebenso wenig: was nicht bedienbar ist,
 * muss nach der Norm auch nicht kontrastieren. */
const GEDIMMT = [
  // [Name, Deckkraft, Schrifttoken, Flächentoken]
  ["Abgewählte Position", 0.62, "ink", "surface"],
  ["Artikel im Wagen", 0.62, "ink", "surface"]
];

function dimContrast(werte, deckkraft, textToken, flaecheToken) {
  const text = werte[textToken], flaeche = werte[flaecheToken];
  if (!text || !flaeche) return null;
  // Erst die Farbe auf ihre Fläche, dann beides gemeinsam gedimmt —
  // in dieser Reihenfolge rechnet der Browser auch.
  const voll = over(text, flaeche.rgb);
  const gedimmtText = over({ rgb: voll, alpha: deckkraft }, flaeche.rgb);
  return contrast(gedimmtText, flaeche.rgb);
}

[["hell", HELL], ["dunkel", DUNKEL]].forEach(([bereich, werte]) => {
  GEDIMMT.forEach(([name, deckkraft, textToken, flaecheToken]) => {
    t(`${name} bleibt lesbar (${bereich})`, () => {
      const k = dimContrast(werte, deckkraft, textToken, flaecheToken);
      if (k === null) return `Token fehlt: ${textToken}`;
      return k >= MIN_TEXT ? true : `${k.toFixed(2)}:1 bei ${deckkraft} — nötig sind ${MIN_TEXT}:1`;
    });
  });
});

t("Die Deckkraft im Stil stimmt mit der geprüften überein", () => {
  /* Ohne diese Prüfung wäre die Liste oben eine Behauptung: jemand
     setzt .item.off auf .4 zurück, die Rechnung hier bleibt bei .62
     und meldet weiter „lesbar“. */
  const paare = [
    [/\.item\.off \.top\{opacity:\.(\d+)\}/, 62, "Abgewählte Position"],
    [/\.sItem\.done\{opacity:\.(\d+)\}/, 62, "Artikel im Wagen"]
  ];
  for (const [re, soll, name] of paare) {
    const m = CSS.match(re);
    if (!m) return `${name}: Regel nicht gefunden`;
    if (Number(m[1]) !== soll) return `${name}: ${m[1]} im Stil, ${soll} geprüft`;
  }
  return true;
});

t("Kein Dimmen legt sich über eine ganze Listenzeile", () => {
  /* Die Bauart des Fehlers, nicht seine eine Fundstelle: eine
     Deckkraft auf dem äußeren Element erwischt alles darin — auch
     Knöpfe, die gerade DESHALB da sind, weil etwas zu tun ist. Wer
     dimmen will, dimmt den Teil, den er meint. */
  const schlecht = [];
  const re = /(\.[a-zA-Z][\w.-]*)\{[^}]*opacity:\.(\d\d?)[;}]/g;
  let m;
  while ((m = re.exec(CSS)) !== null) {
    const [, selektor, wert] = m;
    if (Number(wert) >= 60) continue;                 // hell genug
    if (/:active|:disabled|:hover|input|track|glow|confetti/.test(selektor)) continue;
    if (/\.(item|sItem|row|pDay|badge|save|opt)$/.test(selektor)) schlecht.push(`${selektor} auf .${wert}`);
  }
  return schlecht.length === 0 ? true : schlecht.join(", ");
});

// ================================================================
section("E: Die Regel selbst");

t("Für jede Palettenfarbe gibt es eine Schriftvariante", () => {
  const fehlend = ["accent", "red", "amber", "blue", "violet", "pink"]
    .filter((f) => !HELL[`${f}-ink`] || !DUNKEL[`${f}-ink`]);
  return fehlend.length === 0 ? true : `ohne -ink: ${fehlend.join(", ")}`;
});

t("Jede getönte Fläche im Quelltext trägt lesbare Schrift", () => {
  /* Der eigentliche Rückfallschutz, und bewusst nicht als Namensregel:
     wer eine Regel neu schreibt und dabei `color:var(--amber)` auf
     `--amber-soft` setzt, landet wieder bei 1,93:1. Geprüft wird
     deshalb nicht, WIE das Token heißt, sondern was dabei
     herauskommt — jede Paarung aus dem Stylesheet wird gerechnet. */
  const re = /background:var\(--([a-z0-9-]+)\);color:var\(--([a-z0-9-]+)\)/g;
  const schlecht = [];
  let m;
  while ((m = re.exec(CSS)) !== null) {
    const [, bgToken, fgToken] = m;
    for (const [bereich, werte] of [["hell", HELL], ["dunkel", DUNKEL]]) {
      const fg = werte[fgToken], bg = werte[bgToken];
      if (!fg || !bg) continue;                    // kein Farbwert, nichts zu rechnen
      const grund = bg.alpha < 1 ? over(bg, werte.surface.rgb) : bg.rgb;
      const k = contrast(over(fg, grund), grund);
      if (k < MIN_TEXT) schlecht.push(`${bereich}: ${fgToken} auf ${bgToken} = ${k.toFixed(2)}:1`);
    }
  }
  return schlecht.length === 0 ? true : schlecht.join(" | ");
});

t("Die Rechnung selbst stimmt", () => {
  // Zwei bekannte Werte aus der Norm: Schwarz auf Weiß ist 21:1,
  // gleiche Farben sind 1:1. Ein Test, der seine eigene Formel nicht
  // prüft, prüft gar nichts.
  const schwarzWeiss = contrast([0, 0, 0], [255, 255, 255]);
  const gleich = contrast([120, 120, 120], [120, 120, 120]);
  if (Math.abs(schwarzWeiss - 21) > 0.01) return `Schwarz auf Weiß: ${schwarzWeiss}`;
  if (Math.abs(gleich - 1) > 0.001) return `gleiche Farbe: ${gleich}`;
  // Und die Überlagerung: 50 % Schwarz auf Weiß ergibt mittleres Grau.
  const halb = over({ rgb: [0, 0, 0], alpha: 0.5 }, [255, 255, 255]);
  return Math.abs(halb[0] - 127.5) < 0.01 ? true : `Überlagerung: ${halb}`;
});

// ================================================================
console.log("\n" + "=".repeat(60));
console.log(`KONTRAST: ${pass} bestanden, ${fail} fehlgeschlagen`);
console.log("=".repeat(60));
if (fail > 0) {
  console.log("\nOffene Punkte:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
