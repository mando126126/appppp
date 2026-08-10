# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Server, kein Konto: robuste Statistik,
Textabgleich und Tabellen, gerechnet im Browser.

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 267 Tests: Module, Grenzfälle, neue Funktionen, Oberfläche
```

---

## Was diese Fassung gegenüber der Vorlage ändert

Die Vorlage enthielt zwei Oberflächen — eine für breite Bildschirme
(`ui/`), eine fürs iPhone (`ios/`) — und beide waren **Vorführungen**:
eine fest verdrahtete Historie im Quelltext, ein fest verdrahtetes
„heute" (8. August 2026), nach dem Neuladen war alles wieder wie vorher.
Vier Dinge fehlten, damit daraus eine benutzbare App wird:

| | vorher | jetzt |
|---|---|---|
| **Eigene Daten** | nicht möglich | Bon einlesen oder von Hand erfassen (`Erfassen`) |
| **Bleiben die Daten?** | nein, alles im Quelltext | `localStorage`, mit Sicherung als Datei |
| **Heute** | fest auf 2026‑08‑08 | echtes Datum, Demo-Historie relativ dazu erzeugt |
| **Bildschirmgrößen** | zwei getrennte Fassungen | eine, ab 900 px mit Seitenleiste |

Der Kreislauf ist damit geschlossen: Liste → Ladenmodus → Einkauf buchen
→ neue Rhythmen → nächste Liste. Ohne den Schritt „buchen" lernt die App
nichts, und ohne gelernte Rhythmen ist jede Ansicht leer — das war die
eigentliche Lücke der Vorlage.

### Die Algorithmen sind unverändert

`src/algo/` ist der Code aus der Vorlage, Zeile für Zeile. Die
Oberfläche enthält **keine Fachlogik**; sie ruft nur auf. `build.js`
bündelt die Node-Module für den Browser und bricht ab, wenn zwei Module
denselben Namen auf oberster Ebene vergeben. Es gibt eine Quelle, keine
Handkopie.

### Sechs neue Module

Alle rechnen aus Daten, die schon da waren — kein neues Feld in der
Datenbank, keine fremde Datenquelle. Fachlogik gehört nach `src/algo`,
also steht sie dort und nicht in der Oberfläche.

| Modul | Was es beantwortet |
|---|---|
| `stockRange.js` | „Wie lange komme ich ohne Einkauf aus?" Kleinerer Wert aus Menge (Restbestand × Verbrauch) und Frische (Resthaltbarkeit) — und die App sagt, welche der beiden Grenzen greift. |
| `freezeAdvisor.js` | „Von den 400 g Hähnchen die Hälfte sofort einfrieren." Nur wenn die gekaufte Menge die Haltbarkeit überschreitet, nur bei `freezable`, mit beziffertem Betrag. |
| `priceMemory.js` | „2,99 € statt sonst 2,29 €." Median der eigenen Kaufpreise. Kein Vergleich zwischen Händlern — dafür fehlen die Daten. |
| `forgottenDetector.js` | „Zahnpasta zuletzt vor 9 Wochen — sonst alle 5." Fängt die Zwischenkäufe ab. Ab dem 1,6-fachen Rhythmus, über dem 6-fachen nicht mehr: das ist abgesetzt, nicht vergessen. |
| `safetyAlert.js` | Beim Verlassen des Ladens: „Hähnchenbrust direkt kühlen." Nur Verbrauchsdatum-Produkte — eine Warnung bei jedem Einkauf würde weggetippt. |
| `aisleOrder.js` | Gangreihenfolge je Markt, im Ladenmodus angewandt. Unbekannte Gänge fallen ans Ende, nie raus. |

Dazu in der Oberfläche: helles und dunkles Erscheinungsbild (System,
Hell, Dunkel), und Hinweise lassen sich für eine Woche wegtippen statt
dauerhaft zu verschwinden.

### Gestaltung

Orientierung ist iOS: großer Titel, der beim Scrollen in die Leiste
zusammenfällt; gruppierte Listen mit Einzug statt Karten mit Schatten;
Materials mit Unschärfe für Leisten und Blätter; Systemschriften statt
Webfonts. Farben stehen ausschließlich als Variablen und existieren
doppelt — wer eine Farbe fest ins Regelwerk schreibt, bricht einen der
beiden Modi.

Zwei weitere Ergänzungen auf Oberflächenebene, beide sichtbar und einstellbar:

- **Vorausschau (Vorgabe 3 Tage).** Die Vorlage schlug nur vor, was
  *heute* fällig ist — bei einem festen Demo-Datum fiel das nicht auf,
  mit echtem Datum standen an manchen Tagen zwei Positionen auf der
  Liste. Es ist dieselbe Terminregel wie vorher, nur mit einem
  einstellbaren Puffer statt einem festen Tag.
- **Pfandrückgabe.** Ohne sie sammelt die Historie ein halbes Jahr
  Leergut an und meldet 45 € offenes Pfand.

---

## Aufbau

```
src/algo/        26 Node-Module — 20 unverändert aus der Vorlage, 6 neue
src/ui/
  index.html     Gerüst
  app.css        eine Gestaltung für Telefon und Rechner
  data.js        Speicher, Demo-Historie, compute() — ruft nur die Module
  views.js       die fünf Ansichten
  app.js         Rahmen: Navigation, Kopfbereich, Ladenmodus, Blätter
build.js         bündelt src/ nach web/
tools/serve.js   Entwicklungsserver ohne Abhängigkeiten
test/            Modultests, Stresstests, Oberflächentest
web/             Bauergebnis — das, was auf den Server kommt
```

`build.js` prüft auch, dass Bündel und Oberfläche keine Namen doppelt
vergeben — beide werden als `<script>` in denselben Namensraum geladen.
Ein `group()` in `foodDatabase.js` gegen einen Layout-Helfer gleichen
Namens ging im Browser zufällig gut und war trotzdem ein Fehler.

`web/` ist erzeugt und liegt trotzdem im Git: so lässt sich das
Verzeichnis ohne Node-Installation ausliefern. Nach Änderungen in `src/`
gehört `npm run build` in denselben Commit.

## Die fünf Bereiche

| Bereich | Was drin steckt |
|---|---|
| **Liste** | Vorrats-Reichweite, Sicherheitshinweis, Vorschlag mit Rechenweg je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Budgetdeckel, Haushaltsgröße, Vorausschau, Urlaubsmodus, Lagerhinweis |
| **Bestand** | geschätzter Vorrat mit Sicherheitsangabe, Rezepte nach gerettetem Betrag, Einräumhilfe nach Kühlzonen, Aufbrauchplan vor der Reise |
| **Erfassen** | Bon-Text auswerten (an einem echten Lidl-Bon kalibriert) oder von Hand; unsichere Zuordnungen werden **gefragt, nicht geraten** |
| **Zahlen** | Ausgaben je Monat, persönliche Inflation, Preis-Gedächtnis, gelernte Rhythmen, Sparvorschläge, Packungsgrößen, Wirkung in Kilogramm |
| **Mehr** | Erscheinungsbild, Gangreihenfolge je Markt, Pfand, Bon-Archiv mit Gewährleistungsfristen, Rechenweg, Datenqualitätsbericht, Sicherung/Export, Löschen |

Dazu der **Ladenmodus** als Vollbild: nach Gängen sortiert, große
Ziele, am Ende ein Knopf, der den Einkauf in die Historie schreibt.

## Wo die Daten liegen

Im `localStorage` dieses Browsers. Kein Server, kein Konto, keine
Übertragung. Das heißt auch: Browserdaten löschen löscht die App-Daten
mit, und iOS räumt den Speicher von Web-Apps auf, die wochenlang
ungenutzt bleiben. Deshalb gibt es unter **Mehr → Deine Daten** eine
Sicherung als JSON-Datei. Ein Import prüft die Schemafassung und lehnt
Fremdformate ab.

## Als App installieren

Die App ist eine PWA: `web/` auf einen HTTPS-Server legen (GitHub Pages,
Netlify, Vercel), Adresse aufrufen, „Zum Home-Bildschirm" wählen. Danach
startet sie im Vollbild und funktioniert offline. Auf iOS geht die
Installation nur aus Safari.

Der Service Worker braucht HTTPS oder localhost — beim direkten Öffnen
der Datei (`file://`) läuft die App, aber ohne Offline-Betrieb.

## Tests

```bash
npm test          # alle 267
npm run test:algo # 57 Regressions- + 85 Stress- + 54 Funktionstests
npm run test:ui   # 71 Oberflächentests in jsdom
```

Der Oberflächentest fährt die **gebaute** App in einem simulierten
Browser hoch, lädt Beispieldaten, klickt jeden Bereich durch, wählt
Positionen ab, schaltet Budget und Urlaubsmodus, öffnet den Ladenmodus,
bucht einen Einkauf, liest einen echten Bon ein, erfasst von Hand,
sichert, setzt zurück und stellt wieder her. Jeder Fehler in der Konsole
lässt den Test scheitern. Er lädt auch die **eingebetteten** Skripte aus
`index.html` — dort steckte einmal ein Fehler, den nur der Browser sah.

## Offen vor dem produktiven Einsatz

Unverändert die Punkte aus der Vorlage, keiner davon durch diese Fassung
erledigt:

1. **122 der 230 Haltbarkeitswerte (53 %) sind Schätzungen** ohne
   amtliche Quelle. Vor echten Nutzern müssen mindestens die
   verderblichen Produkte gegen eine belastbare Quelle geprüft werden —
   „Zu gut für die Tonne! Lebensmittel A–Z" des BMEL wäre der
   naheliegende Ausgangspunkt. Der Bericht dazu steht ungeschönt in der
   App unter *Mehr → Rechenweg*.
2. **Der Bon-Parser ist an einem einzigen echten Bon kalibriert** (Lidl,
   22.07.2026). REWE, EDEKA und Kaufland folgen demselben Aufbau, sind
   aber nicht geprüft.
3. **Die Markenliste in `productMatcher2.js` ist Pflegearbeit.**
   Kandidaten liefert die Auswertung nicht zugeordneter Bon-Zeilen — die
   App merkt sich bestätigte Schreibweisen inzwischen selbst.
4. **Schwellenwerte sind Startwerte**, keine geprüften Konstanten.

### Sicherheitsregel (nicht verhandelbar)

16 Produkte tragen ein **Verbrauchsdatum** statt eines MHD: Hackfleisch,
Geflügel, roher Fisch, Garnelen, geschnittener Salat, Sprossen und
weitere. Laut BZfE gehören sie nach Ablauf in den Müll, weil sie Keime
enthalten können, die man weder sieht noch riecht noch schmeckt. Für
diese Produkte darf die App **niemals** eine Verlängerung oder ein
„wahrscheinlich noch gut" anbieten. Vier Tests sichern das ab.

### Warnung für spätere Änderungen

In `src/algo/productMatcher2.js` stehen `dose`, `glas`, `tk`,
`tiefkuehl` und `gemahlen` **bewusst nicht** in der Füllwortliste. Sie
unterscheiden echte Produkte (Dosentomaten gegen frische Tomaten). Wer
sie einträgt, erzeugt stille Fehlzuordnungen. Vier Tests in
`test/tests.js` sichern genau das ab.

## Quellen

- BZfE/BLE, „Haltbarkeit von Lebensmitteln", Stand 20.02.2025
- BZfE/BLE, „Lebensmittel richtig lagern", Stand 20.02.2025
  (Kühlzonen, Ethylen-Listen)
- Verbraucherzentrale, „MHD ist nicht gleich Verbrauchsdatum"

Einwegpfand 0,25 € ist gesetzlich einheitlich; Mehrwegsätze sind
herstellerabhängig und in der App als übliche Sätze gekennzeichnet. Das
Bon-Archiv erinnert an Gewährleistungsfristen und gibt ausdrücklich
**keine Rechtsauskunft**.

---

## Nicht übernommen

Aus den Vorlagen-Archiven blieben draußen:

- `swift/` — die SwiftUI-Portierung. Nie kompiliert, zweite Codebasis,
  gehört nicht in eine Web-App. Die Archive liegen unverändert vor.
- `ui/` und `ios/` — die beiden alten Oberflächen. Ersetzt durch die
  eine responsive Fassung in `src/ui/`.
- `foodDatabase-v2-klein.js`, `rhythmEngine.js`, `wasteInference.js`,
  `productMatcher.js`, `productCatalog.js`, `listGenerator.js`,
  `levenshtein.js` — v1-Vorgänger der Module, die jetzt im Bündel
  stecken. Alle 20 Dateien in `src/algo/` sind im Bündel; tote Fracht
  gibt es dort keine.
- `receiptParser.js` — der unkalibrierte Bon-Parser, ersetzt durch
  `lidlParser.js`.
- `demo*.js` — die Vorführskripte aus dem Node-Paket.
