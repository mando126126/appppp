/**
 * build.js
 * ================================================================
 * Baut aus `src/` das auslieferbare Web-Verzeichnis `web/`.
 *
 * Zwei Schritte:
 *   1. Die Node-Module aus src/algo werden zu einer Browser-Datei
 *      gebündelt (bundle.js). Das Verfahren ist bewusst simpel —
 *      kein Webpack, keine Abhängigkeiten: require-Zeilen und
 *      module.exports entfernen, Dateien in Abhängigkeitsreihenfolge
 *      aneinanderhängen. Das funktioniert, weil alle Module im
 *      selben Namensraum arbeiten und keine Namen doppelt vergeben
 *      sind — geprüft wird das unten, der Build bricht sonst ab.
 *   2. Die Oberfläche (HTML, CSS, JS, Symbole, Manifest, Service
 *      Worker) wird kopiert. Dabei bekommt der Service Worker die
 *      Bauversion eingesetzt, damit alte Zwischenspeicher beim
 *      nächsten Besuch sicher verworfen werden.
 *
 * Warum überhaupt bündeln: Die frühere HTML-Fassung enthielt eine
 * HANDKOPIE der Algorithmen. Jede Verbesserung musste zweimal
 * eingepflegt werden — genau die Sorte Doppelpflege, bei der
 * Fassungen auseinanderlaufen. Es gibt eine Quelle: src/algo.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ALGO = path.join(ROOT, "src", "algo");
const UI = path.join(ROOT, "src", "ui");
const OUT = path.join(ROOT, "web");

// Reihenfolge = Abhängigkeitsreihenfolge
const MODULES = [
  "foodDatabase.js",
  "rhythmEngine2.js",
  "productMatcher2.js",
  "wasteInference2.js",
  "storageAdvisor.js",
  "inventoryEstimator.js",
  "coldStart.js",
  "budgetOptimizer.js",
  "recipeMatcher.js",
  "householdSplit.js",
  "impactMetrics.js",
  "unitPriceCalculator.js",
  "personalInflation.js",
  "duplicateWarning.js",
  "vacationMode.js",
  "depositTracker.js",
  "receiptArchive.js",
  "expiryWarning.js",
  "savingsEngine.js",
  "lidlParser.js",
  "stockRange.js",
  "freezeAdvisor.js",
  "priceMemory.js",
  "forgottenDetector.js",
  "safetyAlert.js",
  "aisleOrder.js",
  "seasonCalendar.js",
  "openedTracker.js",
  "shoppingDay.js",
  "listExport.js",
  "nonFoodCatalog.js",
  "quantityParser.js",
  "consumptionModel.js",
  "rateLearner.js",
  "intervalTracker.js",
  "basePrice.js",
  "stockUpAdvisor.js"
];

// Oberflächendateien in Ladereihenfolge — dieselbe Liste nutzt
// index.html für die <script>-Zeilen und sw.js für den Cache.
const UI_SCRIPTS = ["bundle.js", "data.js", "views.js", "app.js"];
const UI_ASSETS = ["index.html", "app.css", "manifest.webmanifest", "sw.js"];
const ICONS = ["icon-180.png", "icon-192.png", "icon-512.png"];

function strip(src) {
  return src
    // require-Zeilen entfernen (auch mehrzeilige Destrukturierung)
    .replace(/const\s*\{[^}]*\}\s*=\s*require\([^)]*\);?/gs, "")
    .replace(/const\s+\w+\s*=\s*require\([^)]*\);?/g, "")
    // module.exports bis zum schließenden Semikolon entfernen
    .replace(/module\.exports\s*=\s*\{[^}]*\};?/gs, "")
    .replace(/module\.exports\s*=\s*[^;]+;/g, "")
    .trim();
}

/** Prüft auf doppelt vergebene Namen auf oberster Ebene. */
function checkCollisions(parts) {
  const declared = new Map();
  const problems = [];

  parts.forEach(({ file, code }) => {
    const re = /^(?:const|let|function)\s+(\w+)/gm;
    let m;
    while ((m = re.exec(code)) !== null) {
      const name = m[1];
      if (declared.has(name)) {
        problems.push(`"${name}" doppelt: ${declared.get(name)} und ${file}`);
      } else {
        declared.set(name, file);
      }
    }
  });
  return problems;
}

function buildBundle() {
  const parts = MODULES.map((file) => ({
    file,
    code: strip(fs.readFileSync(path.join(ALGO, file), "utf8"))
  }));

  const collisions = checkCollisions(parts);
  if (collisions.length) {
    console.error("Namenskonflikte im Bündel — Build abgebrochen:");
    collisions.forEach((c) => console.error("  " + c));
    process.exit(1);
  }

  const banner =
    `/* Gebündelt aus ${MODULES.length} Modulen — nicht von Hand ändern.\n` +
    `   Quelle: src/algo/*.js. Neu bauen mit: npm run build */\n`;

  return banner + parts.map((p) => `\n/* ===== ${p.file} ===== */\n${p.code}\n`).join("");
}

/** Bauversion aus dem Inhalt: ändert sich nur, wenn sich etwas ändert. */
function fingerprint(strings) {
  let h = 5381;
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function build({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;

  fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });

  const bundle = buildBundle();
  fs.writeFileSync(path.join(OUT, "bundle.js"), bundle, "utf8");

  const uiFiles = UI_SCRIPTS.filter((f) => f !== "bundle.js");
  const uiSources = uiFiles.map((f) => fs.readFileSync(path.join(UI, f), "utf8"));

  // Die Oberfläche teilt sich den Namensraum mit dem Bündel — sie wird
  // als weitere <script>-Datei geladen, nicht als Modul. Ein Name, den
  // beide vergeben, überschreibt still den anderen: `group` aus
  // foodDatabase.js gegen einen Layout-Helfer gleichen Namens war genau
  // das, und im Browser ging es zufällig gut, weil bundle.js zuerst
  // lief. Deshalb hier dieselbe Prüfung wie für die Module.
  const uiCollisions = checkCollisions([
    { file: "bundle.js", code: bundle },
    ...uiFiles.map((f, i) => ({ file: f, code: uiSources[i] }))
  ]);
  if (uiCollisions.length) {
    console.error("Namenskonflikte zwischen Bündel und Oberfläche — Build abgebrochen:");
    uiCollisions.forEach((c) => console.error("  " + c));
    process.exit(1);
  }

  const version = fingerprint([bundle, ...uiSources]);

  UI_SCRIPTS.filter((f) => f !== "bundle.js").forEach((f, i) => {
    fs.writeFileSync(path.join(OUT, f), uiSources[i], "utf8");
  });

  UI_ASSETS.forEach((f) => {
    let src = fs.readFileSync(path.join(UI, f), "utf8");
    // Bauversion einsetzen. Der Platzhalter ist bewusst kein gültiger
    // Bezeichner — sonst überschriebe die Ersetzung auch den
    // Eigenschaftsnamen window.__BUILD__ und die Seite wäre kaputt.
    src = src.replace(/%%BUILD%%/g, version);
    fs.writeFileSync(path.join(OUT, f), src, "utf8");
  });

  ICONS.forEach((f) => {
    fs.copyFileSync(path.join(UI, "icons", f), path.join(OUT, "icons", f));
  });

  const kb = (s) => Math.round(s.length / 1024) + " KB";
  log(`Bündel:      ${MODULES.length} Module, ${kb(bundle)}`);
  log(`Oberfläche:  ${UI_SCRIPTS.length - 1} Skripte, ${UI_ASSETS.length} Dateien, ${ICONS.length} Symbole`);
  log(`Bauversion:  ${version}`);
  log(`Ziel:        ${path.relative(ROOT, OUT)}/`);
  return { bundle, version };
}

if (require.main === module) build();
module.exports = { build, buildBundle, MODULES, UI_SCRIPTS, UI_ASSETS, ICONS };
