# Fremde Dateien — Herkunft und Grund

Alles in diesem Ordner ist **nicht selbst geschrieben**. Es steht hier
eingecheckt statt in einer package.json, weil die App ohne Bauschritt
ausgeliefert wird und weil sie ohne Netz funktionieren muss: eine
Texterkennung, die beim ersten Foto erst ein fremdes CDN fragt, ist
für eine App, die damit wirbt, dass nichts das Gerät verlässt, keine
Texterkennung.

| Datei | Herkunft | Fassung | Lizenz |
|---|---|---|---|
| `tesseract.min.js` | npm `tesseract.js` | 6.0.1 | Apache-2.0 |
| `worker.min.js` | npm `tesseract.js` | 6.0.1 | Apache-2.0 |
| `tesseract-core-simd-lstm.js` | npm `tesseract.js-core` | 6.1.2 | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm` | npm `tesseract.js-core` | 6.1.2 | Apache-2.0 |
| `deu.traineddata.gz` | npm `@tesseract.js-data/deu`, Variante `4.0.0_best_int` | 1.0.0 | MIT (Modell: Apache-2.0, Google/tesseract-ocr) |

Zusammen rund 4,4 MB. Der Service Worker lädt sie **nicht** bei der
Installation, sondern erst, wenn jemand zum ersten Mal ein Bild
erfasst — wer nur tippt, zahlt diese Megabyte nie.

## Warum diese Auswahl und keine andere

**Nur die SIMD-Fassung des Kerns.** Der Kern gibt es in vier
Varianten (mit/ohne SIMD, mit/ohne die alte Nicht-LSTM-Engine).
Jede weitere kostet 2,7 MB. SIMD ist in Chrome seit 91, in Firefox
seit 89 und in Safari seit 16.4 vorhanden — auf einem Telefon, das
diese App als PWA installieren kann, also praktisch immer. Fehlt es
doch, meldet die Oberfläche das und bietet den Textweg an, statt still
nichts zu tun.

**Der Kern als `.js` plus `.wasm`, nicht als `.wasm.js`.** Die
Einzeldatei-Fassung trägt das WebAssembly base64-kodiert im
Quelltext und ist dadurch 3,8 statt 2,9 MB. `worker.min.js` lädt den
Kern per `importScripts`, und weil beide im selben Ordner liegen,
findet die Emscripten-Brücke ihr `.wasm` von selbst.

**`4.0.0_best_int` statt `4.0.0` oder `_fast`.** Die volle Fassung
wiegt 7,1 MB, die schnelle erkennt Kassenbon-Schrift merklich
schlechter. Die ganzzahlige „best"-Fassung ist der Kompromiss:
1,3 MB bei fast der Qualität der vollen.

## Aktualisieren

```
npm i tesseract.js@<v> tesseract.js-core@<v> @tesseract.js-data/deu
cp node_modules/tesseract.js/dist/{tesseract.min.js,worker.min.js} src/ui/vendor/
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.{js,wasm} src/ui/vendor/
cp node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz src/ui/vendor/
```

Danach die Fassungen in dieser Tabelle nachziehen und `npm test`
laufen lassen — `test/ocr.js` prüft die Logik um die Erkennung herum,
nicht die Erkennung selbst.
