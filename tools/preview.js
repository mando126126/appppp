/**
 * preview.js — die ganze App in einer einzigen HTML-Datei
 * ================================================================
 * Für die Frage „kann ich mir das mal eben ansehen?“. Die gebaute
 * App besteht aus acht Dateien plus Symbolen; eine davon lässt sich
 * verschicken, in eine Vorschau legen oder per Doppelklick öffnen,
 * acht nicht.
 *
 * Eingebettet wird alles, was klein ist: Stil, Skripte, Symbole als
 * data:-Adressen. NICHT eingebettet wird die Texterkennung — die
 * 4,4 MB unter vendor/ blieben auch base64-kodiert 4,4 MB, und eine
 * Vorschaudatei von sechs Megabyte verfehlt ihren Zweck. Die App
 * merkt das von selbst: der Bildweg meldet, dass die Erkennung fehlt,
 * und der Textweg funktioniert weiter.
 *
 * Das Ergebnis ist eine VORSCHAU, kein Ersatz für die Auslieferung.
 * Ohne Service Worker gibt es keinen Offline-Betrieb, und ohne
 * eigenen Ursprung teilt sie sich den Speicher mit allem anderen,
 * was unter derselben Adresse liegt.
 * ================================================================
 */

const fs = require("fs");
const path = require("path");
const { build, UI_SCRIPTS } = require("../build.js");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");

function inline() {
  build({ quiet: true });

  let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");

  // Stil
  let css = fs.readFileSync(path.join(WEB, "app.css"), "utf8");

  /* Die Schrift muss mit hinein, sonst zeigt die Vorschau eine App,
     die es nicht gibt: eine einzelne Datei hat kein fonts/ neben
     sich, der Browser fände nichts und fiele auf die Systemschrift
     zurück — und genau die abzulösen war der Punkt. 25 KB werden
     base64-kodiert zu 33 KB; das ist zu verkraften. */
  ["manrope-latin.woff2", "manrope-latin-ext.woff2"].forEach((f) => {
    const b64 = fs.readFileSync(path.join(WEB, "fonts", f)).toString("base64");
    css = css.split(`url("fonts/${f}")`).join(`url("data:font/woff2;base64,${b64}")`);
  });

  html = html.replace(
    /<link rel="stylesheet" href="app\.css">/,
    `<style>\n${css}\n</style>`
  );

  // Skripte in ihrer Ladereihenfolge
  UI_SCRIPTS.forEach((file) => {
    const code = fs.readFileSync(path.join(WEB, file), "utf8");
    // Ein `</script>` im Quelltext würde das umschließende Element
    // beenden — in Zeichenketten und Kommentaren kommt das vor.
    const safe = code.replace(/<\/script>/gi, "<\\/script>");
    html = html.replace(
      new RegExp(`<script src="${file.replace(".", "\\.")}"></script>`),
      `<script>\n${safe}\n</script>`
    );
  });

  // Symbole als data:-Adressen, damit auch das Lesezeichen stimmt
  ["icon-180.png", "icon-192.png", "icon-512.png"].forEach((icon) => {
    const b64 = fs.readFileSync(path.join(WEB, "icons", icon)).toString("base64");
    html = html.split(`icons/${icon}`).join(`data:image/png;base64,${b64}`);
  });

  // Manifest und Service Worker fallen weg: beide brauchen echte
  // Dateien unter einer echten Adresse.
  html = html.replace(/<link rel="manifest"[^>]*>/, "");
  // Die Vorzieh-Zeile für die Schrift ebenso — die Datei steckt hier
  // im Stil, und ein Vorziehen ins Leere wäre ein 404 in der Konsole.
  html = html.replace(/<link rel="preload"[^>]*>/, "");

  /* Und die Bilderfassung sagt, warum sie hier fehlt. Ohne diese
     Zeile stünden die Knöpfe da, und ein Tippen liefe in einen
     Ladefehler — die Vorschau würde einen Mangel vorführen, den die
     ausgelieferte App nicht hat. */
  html = html.replace("</body>", `<script>
OCR.off = "Diese Vorschau ist eine einzelne Datei — die Texterkennung (4,4 MB) ist darin nicht enthalten. " +
  "In der ausgelieferten App funktioniert das Fotografieren. Der Bontext lässt sich hier trotzdem einfügen.";
App.render();
</script>
</body>`);

  const out = path.join(ROOT, "preview.html");
  fs.writeFileSync(out, html, "utf8");

  const kb = Math.round(html.length / 1024);
  console.log(`Vorschau:    ${path.relative(ROOT, out)} (${kb} KB)`);
  console.log("             Texterkennung ist NICHT enthalten — dafür web/ ausliefern.");
  return out;
}

if (require.main === module) inline();
module.exports = { inline };
