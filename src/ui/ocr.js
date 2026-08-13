/* ================================================================
   ocr.js — Bild rein, Text raus.
   ================================================================
   Der Weg über den Bontext war für eine Handy-App eine Zumutung:
   Text abtippen ist die Arbeit, die die App abnehmen soll, und ein
   digitaler Bon aus einer Händler-App liegt sowieso nur als
   Screenshot vor. Deshalb hier der zweite Weg — Foto oder Screenshot.

   DREI ENTSCHEIDUNGEN, DIE HIER FESTLIEGEN:

   1. DIE ERKENNUNG LÄUFT AUF DEM GERÄT.
      Tesseract als WebAssembly, alle Dateien liegen unter vendor/
      im Auslieferungsverzeichnis. Kein Bild geht irgendwohin, keine
      fremde Anfrage, und ohne Netz funktioniert es genauso. Das ist
      teuer — 4,4 MB — aber es ist die einzige Fassung, die zu einer
      App passt, deren ganzes Versprechen lautet, dass die Daten auf
      dem Gerät bleiben. Ein Erkennungsdienst in der Cloud hätte das
      Versprechen gebrochen, und zwar genau an der Stelle, an der die
      empfindlichsten Daten anfallen: dem vollständigen Einkauf.

   2. GELADEN WIRD ERST BEIM ERSTEN BILD.
      Wer nie ein Foto erfasst, lädt die 4,4 MB nie. Der Service
      Worker legt sie beim ersten Mal in den Zwischenspeicher, danach
      ist auch das erste Bild nach dem Neustart sofort da.

   3. DAS BILD WIRD VORBEHANDELT, ABER NICHT ENTSTELLT.
      Verkleinern, Graustufen, Kontrast strecken — mehr nicht.
      Schwellenwert-Binarisierung sieht auf einem sauberen Scan gut
      aus und frisst auf einem Foto mit Schatten die halbe Seite.
      Tesseract bringt sein eigenes Verfahren dafür mit, das besser
      ist als eines, das ich hier nebenbei schreibe.

   Was danach kommt — Zeilen ausrichten, Ziffern zurückdrehen,
   Rauschen aussortieren — steht in src/algo/receiptOcr.js, ist reine
   Logik und wird dort getestet. Hier steht nur, was ohne Browser
   nicht geht.
   ================================================================ */

const OCR = {
  /* Alle fremden Dateien liegen nebeneinander. Das ist keine
     Ordnungsliebe: worker.min.js lädt den Kern per importScripts,
     und die Emscripten-Brücke sucht ihr .wasm relativ zum Worker.
     Liegen sie auseinander, findet sie es nicht. */
  VENDOR: "vendor/",
  LANG: "deu",

  /* Kassenbon-Schrift ist klein. Unter etwa 1600 Pixeln Höhe wird
     jede zweite Ziffer geraten, über 2600 wird es langsam, ohne
     besser zu werden. */
  MAX_SIDE: 2200,

  /* 6 = ein zusammenhängender Block Text. Die Voreinstellung (3)
     sucht zuerst nach Spalten und Absätzen und zerlegt einen Bon
     gern in zwei Hälften, die dann verschränkt ausgegeben werden —
     danach steht der Preis der einen Zeile hinter dem Namen der
     anderen. */
  PSM: 6,

  worker: null,
  loading: null,

  /** Für Tests austauschbar: eine Funktion (bild) => Text. */
  engine: null,

  /* Abschaltgrund. Gesetzt heißt: die Erkennung steht hier nicht zur
     Verfügung, und DAS HIER ist der Grund. Der Weg über einen Grund
     statt über ein `false` existiert wegen der Vorschaudatei
     (tools/preview.js): dort fehlt die Erkennung nicht, weil der
     Browser sie nicht kann, sondern weil 4,4 MB nicht in eine
     Vorschau gehören. Eine App, die in diesem Fall „dein Browser kann
     das nicht" sagt, schiebt die Schuld auf das falsche Gerät. */
  off: null,

  /**
   * Ist die Erkennung überhaupt möglich?
   *
   * Eine eingesetzte `engine` zählt als möglich — dann läuft das
   * Lesen woanders, und die Voraussetzungen für Tesseract sind
   * gegenstandslos. Genau das nutzt der Oberflächentest: er prüft den
   * ganzen Weg vom Bild bis zum gebuchten Bon, ohne WebAssembly.
   */
  supported() {
    if (OCR.engine) return true;
    if (OCR.off) return false;
    return typeof Worker !== "undefined" &&
           typeof WebAssembly === "object" &&
           typeof createImageBitmap === "function";
  },

  /** Warum geht es hier nicht? Ein Satz, der stimmt. */
  reason() {
    return OCR.off ||
      "Dieser Browser kann keine Texterkennung. Der Bontext lässt sich weiter unten einfügen.";
  },

  /**
   * Tesseract nachladen. Erst beim ersten Bild, und nur einmal —
   * `loading` verhindert, dass zwei schnelle Klicks zwei Worker
   * erzeugen (jeder davon lädt 4 MB).
   */
  load(onStatus) {
    if (OCR.worker) return Promise.resolve(OCR.worker);
    if (OCR.loading) return OCR.loading;

    OCR.loading = new Promise((resolve, reject) => {
      const done = () => {
        if (typeof Tesseract === "undefined") {
          reject(new Error("Texterkennung nicht gefunden"));
          return;
        }
        /* Absolute Adressen, und der Worker NICHT über eine
           Blob-URL. Beides hängt zusammen und war der einzige Grund,
           warum die Erkennung anfangs stumm hing:

           Tesseract packt den Worker normalerweise in eine Blob-URL.
           Darin ist `self.location` ein `blob:`-Eintrag, und die
           Emscripten-Brücke, die ihr `.wasm` neben sich sucht, kann
           daraus keine Adresse mehr bilden — sie ruft `fetch` mit
           „tesseract-core-simd-lstm.wasm" auf, ohne Basis, und der
           Browser bricht mit „Failed to parse URL" ab. Sichtbar war
           davon nichts: der Ladebalken stand bei 0 und blieb dort.

           Mit `workerBlobURL: false` liegt der Worker unter seiner
           echten Adresse in vendor/, und der Kern findet sein
           WebAssembly als Nachbarn. Die Pfade müssen dann absolut
           sein, sonst löst der Worker sie gegen sein eigenes
           Verzeichnis auf und sucht in vendor/vendor/. */
        const basis = new URL(OCR.VENDOR, document.baseURI).href;
        Tesseract.createWorker(OCR.LANG, 1, {
          workerPath: basis + "worker.min.js",
          corePath: basis + "tesseract-core-simd-lstm.js",
          langPath: basis,
          workerBlobURL: false,
          gzip: true,
          logger: (m) => {
            if (!onStatus) return;
            if (m.status === "recognizing text") onStatus("liest", m.progress);
            else onStatus("lädt", m.progress);
          }
        }).then((w) => w.setParameters({
          tessedit_pageseg_mode: String(OCR.PSM),
          // Ohne das fallen die Spalten zusammen, und aus
          // „Milch      1,29" wird „Milch 1,29" — genau die Grenze,
          // an der der Bon-Parser eine Position erkennt.
          preserve_interword_spaces: "1"
        }).then(() => w)).then((w) => {
          OCR.worker = w;
          resolve(w);
        }).catch(reject);
      };

      if (typeof Tesseract !== "undefined") { done(); return; }
      const s = document.createElement("script");
      s.src = OCR.VENDOR + "tesseract.min.js";
      s.onload = done;
      s.onerror = () => reject(new Error("Texterkennung nicht verfügbar"));
      document.head.append(s);
    });

    OCR.loading.catch(() => { OCR.loading = null; });
    return OCR.loading;
  },

  /**
   * Bild vorbehandeln: verkleinern, Graustufen, Kontrast strecken.
   *
   * Der Kontrast wird auf das 2.- und 98.-Perzentil gestreckt, nicht
   * auf Minimum und Maximum: ein einzelner schwarzer Punkt am Rand —
   * eine Fingerkuppe, ein Schatten — würde sonst die ganze Spreizung
   * auffressen und das Bild bliebe grau.
   */
  prepare(bitmap) {
    const scale = Math.min(1, OCR.MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    const hist = new Uint32Array(256);

    for (let i = 0; i < px.length; i += 4) {
      // Wahrgenommene Helligkeit, nicht der Mittelwert der Kanäle:
      // Rot auf Weiß (Werbeaufdruck) bliebe sonst dunkler als es
      // aussieht und würde als Schrift gelesen.
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = px[i + 1] = px[i + 2] = g;
      hist[g]++;
    }

    const total = w * h;
    const untenGrenze = total * 0.02;
    const obenGrenze = total * 0.98;
    let summe = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { summe += hist[v]; if (summe >= untenGrenze) { lo = v; break; } }
    summe = 0;
    for (let v = 0; v < 256; v++) { summe += hist[v]; if (summe >= obenGrenze) { hi = v; break; } }

    // Zu wenig Unterschied: dann ist das Bild flau, und Strecken
    // würde nur das Rauschen verstärken.
    if (hi - lo > 24) {
      const spanne = hi - lo;
      const tabelle = new Uint8Array(256);
      for (let v = 0; v < 256; v++) {
        tabelle[v] = Math.max(0, Math.min(255, Math.round(((v - lo) / spanne) * 255)));
      }
      for (let i = 0; i < px.length; i += 4) {
        const g = tabelle[px[i]];
        px[i] = px[i + 1] = px[i + 2] = g;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas;
  },

  /**
   * Ein Bild lesen.
   * @param {Blob|File} file
   * @param {(phase:string, progress:number)=>void} [onStatus]
   * @returns {Promise<string>} erkannter Text
   */
  read(file, onStatus) {
    if (OCR.engine) return Promise.resolve(OCR.engine(file));
    if (!OCR.supported()) return Promise.reject(new Error("Dieses Gerät kann keine Texterkennung"));

    return createImageBitmap(file)
      .then((bitmap) => {
        const canvas = OCR.prepare(bitmap);
        if (bitmap.close) bitmap.close();
        return OCR.load(onStatus).then((worker) => worker.recognize(canvas));
      })
      .then((res) => (res && res.data ? res.data.text : ""));
  },

  /** Worker freigeben — der hält sonst dauerhaft Speicher. */
  release() {
    if (OCR.worker) { try { OCR.worker.terminate(); } catch (e) { /* egal */ } }
    OCR.worker = null;
    OCR.loading = null;
  }
};
