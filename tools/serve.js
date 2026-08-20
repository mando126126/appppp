/**
 * serve.js — kleiner Entwicklungsserver ohne Abhängigkeiten.
 *
 * Der Service Worker verlangt HTTPS oder localhost. Beim direkten
 * Öffnen der Datei (file://) läuft die App zwar, aber ohne
 * Offline-Betrieb und ohne localStorage-Ursprung — deshalb dieser
 * Server statt "Datei im Browser öffnen".
 *
 *   node tools/serve.js [port]
 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { build } = require("../build");

const ROOT = path.join(__dirname, "..", "web");
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  // Ohne den richtigen Typ lädt der Browser die Schrift zwar, wirft
  // sie aber wieder weg („Failed to decode downloaded font") — und
  // die Seite steht kommentarlos in der Systemschrift.
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  // WebAssembly braucht seinen eigenen Typ, sonst lehnt der Browser
  // das schnelle Übersetzen im Datenstrom ab („Incorrect response
  // MIME type") und fällt auf den langsamen Weg über einen Puffer
  // zurück. Es funktioniert dann noch, aber die Texterkennung
  // startet spürbar träger.
  ".wasm": "application/wasm",
  // Die Sprachdatei wird ausdrücklich NICHT als „gzip-kodiert"
  // ausgeliefert: Tesseract packt sie selbst aus. Wer hier
  // Content-Encoding: gzip setzt, lässt den Browser auspacken —
  // und Tesseract bekommt Klartext, wo es ein Archiv erwartet.
  ".gz": "application/octet-stream"
};

if (!fs.existsSync(path.join(ROOT, "index.html"))) build({ quiet: true });

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(ROOT, url === "/" ? "index.html" : url);

    // Ausbruch aus dem Ausgabeverzeichnis verhindern
    if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
      res.writeHead(403).end("Verboten");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Nicht gefunden");
      return;
    }

    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      // Im Entwicklungsbetrieb nichts zwischenspeichern, sonst
      // liefert der Service Worker hartnäckig alte Stände aus.
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`Einkaufs-Anker läuft auf http://localhost:${PORT}`);

    /* Und dieselbe Adresse für das Telefon im selben Netz. Der Server
       hört ohnehin auf allen Schnittstellen — er hat es bisher nur
       nicht gesagt, und dann sucht man die IP von Hand.

       WICHTIG und deshalb hier ausgeschrieben: über eine solche
       Adresse ist die Seite KEIN sicherer Kontext. Der Service
       Worker meldet sich nicht an (kein Offline-Betrieb), und
       dauerhafter Speicher lässt sich nicht erbitten. Die
       Texterkennung, die Liste und alles andere funktionieren. Zum
       Ausprobieren reicht das; zum Benutzen gehört die App auf eine
       https-Adresse. */
    const adressen = [];
    Object.values(os.networkInterfaces()).forEach((liste) => {
      (liste || []).forEach((n) => {
        if (n.family === "IPv4" && !n.internal) adressen.push(n.address);
      });
    });
    if (adressen.length) {
      console.log("");
      console.log("Vom Telefon im selben WLAN:");
      adressen.forEach((a) => console.log(`  http://${a}:${PORT}`));
      console.log("  (ohne https: kein Offline-Betrieb, kein dauerhafter Speicher)");
    }
    console.log(`Nach Änderungen in src/: npm run build`);
  });
