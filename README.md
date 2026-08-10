# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Server, kein Konto: robuste Statistik,
Textabgleich und Tabellen, gerechnet im Browser.

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 589 Tests + Zwei-Jahres-Simulation
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

### Zehn neue Module

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
| `seasonCalendar.js` | „Erdbeeren sind jetzt Importware — Saison ist Mai bis Juli." Die Tabelle ist bewusst unvollständig: ohne Eintrag kein Hinweis. Bei Bananen „nicht in Saison" wäre Unsinn. |
| `openedTracker.js` | Angebrochene Packungen. Eine geöffnete Dose hält 3 Tage, nicht 730 — ohne diesen Zustand rechnet die Bestandsschätzung mit der falschen Zahl. Ein Tippen genügt. |
| `shoppingDay.js` | „Du kaufst meist samstags." Der Haushalt hat einen eigenen Rhythmus, nicht nur die Produkte. Daraus folgt eine Empfehlung für die Vorausschau. |
| `listExport.js` | Liste als reiner Text, nach Gängen. Damit sie das Gerät verlassen kann: Web Share, sonst Zwischenablage, sonst zum Markieren. |

Dazu in der Oberfläche: helles und dunkles Erscheinungsbild, drei
Schriftgrößen, und Hinweise lassen sich für eine Woche wegtippen statt
dauerhaft zu verschwinden.

### Aus dem Verlauf lernen

Der Rhythmus kam bisher allein aus den Kaufabständen. Drei Dinge fehlten:

**1. Rückmeldungen waren folgenlos.** „Hab noch da" hat die Position
abgewählt und war danach vergessen — `listChoices` wird bei jedem
Einkauf geleert. Wer dreimal sagte, dass Klopapier noch reicht, bekam
es beim vierten Mal wieder vorgeschlagen. Jetzt gibt es ein dauerhaftes
Protokoll und vier Antworten statt drei:

| Antwort | Bedeutung | Wirkung |
|---|---|---|
| „Hab noch" | Vorschlag kam zu früh | Rhythmus verlängern |
| „War schon alle" | Vorschlag kam zu spät | Rhythmus verkürzen |
| „Verbraucht" | sagt nichts über den Takt | **keine** |
| „Diese Woche nicht" | bewusste Pause | **keine** |

Die vierte Antwort ist neu und nötig: ohne sie könnte man nur in eine
Richtung korrigieren, und die App bliebe systematisch zu spät dran.

Die Korrektur ist nach denselben Grundsätzen gebaut wie der Rhythmus
selbst — Median statt Mittelwert, mindestens drei Signale, gedeckelt
auf ±40 %, Verfall nach 180 Tagen. Ein einzelner Fehltipp bewirkt
nichts. Widersprechen sich die Rückmeldungen, wird die Korrektur
gedämpft und das Vertrauen gesenkt, statt beherzt in eine Richtung zu
ziehen. Die Rohdaten bleiben unangetastet; die Korrektur ist ein
eigener Faktor, und das Detail-Blatt zeigt den Wert davor.

**2. Keine Saisonalität im gelernten Wert.** Wer im Juli wöchentlich
grillt und im Januar gar nicht, bekam das Mittel aus beidem.
`seasonalRhythm.js` liest das Muster aus der **eigenen** Historie —
aber erst ab einem vollen Jahr, mit mindestens acht Käufen über drei
Quartale, gedeckelt auf ±35 %. Reicht die Datenlage nicht, gibt es
keinen Faktor und die App sagt warum.

**3. Kein Bruch bei Haushaltsänderungen.** Zieht jemand aus, mittelt der
Median den Sprung über Monate weg. `changeDetector.js` sucht den
Trennpunkt und rechnet ab dort neu — aber nur bei mindestens 40 %
Unterschied, genug Punkten auf beiden Seiten und wenn die Änderung
mindestens 14 Tage anhält. Ein einzelner Ausreißer ist kein Bruch.

**Ein Ansatz, den ich verworfen habe:** Zuerst hatte ich ein implizites
Gegensignal eingebaut — Käufe, die vor der vorhergesagten Fälligkeit
lagen, sollten auf einen zu langen Rhythmus schließen lassen. Das hat
einen strukturellen Fehler: der Rhythmus *ist* der Median der
Kaufabstände, also liegt per Konstruktion die Hälfte darunter. In der
Demo-Historie feuerten bei völlig stabilem Verhalten neun Signale, alle
in dieselbe Richtung; der Rhythmus wurde von 7 auf 4 Tage gezogen, und
die echten Rückmeldungen kämpften anschließend gegen dieses Phantom an.
Dieselben Daten ein zweites Mal auszuwerten liefert keine neue
Information — nur einen zusätzlichen Fehler. Die Gegenrichtung kommt
jetzt aus einer Aussage des Nutzers.

### Haushaltsprodukte rechnen anders

Non-Food ist nicht dieselbe Aufgabe mit anderen Produkten, sondern ein
anderes Problem:

| | Lebensmittel | Haushalt |
|---|---|---|
| Feind | Verderb — zu viel gekauft | Leerstand — zu spät gekauft |
| Kaufabstand ≈ Verbrauch? | nein, Verderb verzerrt | **ja**, sauberes Signal |
| Bevorratung | schädlich | rational |
| Fehler spürbar? | nein | **sofort** |

Deshalb ein eigenes Modell: eine **Verbrauchsrate** statt eines
Kaufrhythmus, skaliert mit der Haushaltsgröße hoch einem Exponenten je
Produkt — Zahnpasta linear, Waschmittel degressiv, Allzweckreiniger gar
nicht. Vier Verbrauchsklassen bestimmen, was gerechnet wird:

| Klasse | Modell | Beispiele |
|---|---|---|
| `RATE` | Menge nimmt linear ab | Zahnpasta, Waschmittel, Klopapier |
| `INTERVAL` | Austausch nach Zeit, unabhängig von der Menge | Zahnbürste (90 T), Küchenschwamm (10 T) |
| `SPORADIC` | **keine Prognose** — nur Historie | Batterien, Glühbirnen |
| `DATED` | echtes Verfalls- oder Öffnungsdatum | Sonnencreme, Mascara |

Sieben Module: `nonFoodCatalog`, `consumptionModel`, `rateLearner`,
`intervalTracker`, `basePrice`, `stockUpAdvisor`, `quantityParser`.

**Das Kaltstartproblem ist hier größer** — Zahnpasta wird alle sieben
Wochen gekauft, drei Datenpunkte brauchen fünf Monate. Deshalb
Referenzwert als Prior, Beobachtung als Posterior: nach sechs Käufen
bestimmt die Beobachtung drei Viertel. Der Nutzer sieht immer, worauf
eine Zahl beruht — gefüllter Punkt heißt gelernt, hohler heißt
Schätzwert. Bei unregelmäßigem Kauf (Variationskoeffizient ab 0,35)
steht ein Strich statt einer Zahl.

`INTERVAL` ist die Klasse mit dem schnellsten Nutzen: kein Kaltstart,
keine Historie, kein Lernen. Kaufdatum plus Intervall genügt, und
niemand denkt nach drei Monaten von selbst an die Zahnbürste. Sie hat
deshalb einen eigenen Bereich **Fällig** — das sind Handlungen, keine
Käufe: „Getauscht" setzt den Zähler zurück, ohne dass etwas gekauft
wurde.

Weitere Entscheidungen, alle bewusst zurückhaltend:

- **Bevorratung nur bei gelernter Rate.** Ein Vorratsstapel, der nach
  vierzehn Monaten noch steht, ist ein Vertrauensverlust.
- **Preisvergleich nur gegen die eigene Historie.** Keine Preis-API,
  keine Fremddaten. Mindestens vier Datenpunkte, sonst keine Aussage —
  nicht etwa Perzentil 0.
- **Ersparnis getrennt ausgewiesen.** Die Non-Food-Ersparnis ist
  realisiert (weniger gezahlt), die Lebensmittel-Ersparnis
  kontrafaktisch (nicht verdorben). Beides zu addieren wäre irreführend.
- **Gerätebesitz filtert hart.** Ohne Kaffeemaschine kein Entkalker.
- **Wasserhärte** wirkt auf Entkalkungsintervall und Waschmitteldosis;
  manuell wählbar, keine Ableitung aus der Postleitzahl.
- **Urlaub je Produkt.** Eine Zahnbürste altert im Urlaub weiter, ein
  Küchenschwamm nicht.
- **Ein Tab, zwei Sektionen.** Kein zweiter Tab für Haushalt — das
  erzeugte zwei mentale Modelle und halbierte die Nutzung beider.

Der Steuersatz auf dem Bon (7 % meist Lebensmittel, 19 % meist
Haushalt) ist ein Vorfilter mit Ausnahmelisten in beide Richtungen,
kein Ersatz für den Produktabgleich.

### Gestaltung: die Fläche zeigt Zahlen, nicht Erklärungen

Jede Erklärung sitzt hinter einem (i) neben der Gruppenüberschrift oder
im Detail-Blatt einer Zeile. Auf der Liste steht der Produktname, ein
Preis und höchstens zwei Marken — kein Rechenweg, keine Fußnote, kein
Absatz. Wer wissen will, warum eine Position vorgeschlagen wird, tippt
sie an: Rhythmus, Vertrauen, Haltbarkeit, Lagerort, Preisspanne,
Bestand, Reichweite, Verlust und Datenqualität stehen dort als Tabelle.

Ehrlichkeit kostet das nichts. Quellen, Schätzcharakter und der
ungeschönte Datenqualitätsbericht sind vollständig da — eine Tippgeste
entfernt statt dauerhaft im Weg.

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
src/algo/        40 Node-Module — 20 unverändert aus der Vorlage, 20 neue
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

## Die sechs Bereiche

| Bereich | Was drin steckt |
|---|---|
| **Liste** | Vorrats-Reichweite als Ring, Sicherheitshinweis, Vorschlag mit Detail-Blatt je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Saisonhinweis, Teilen, Budget, Haushaltsgröße, Vorausschau, Urlaub |
| **Fällig** | Austausch-Produkte mit Tausch-Reset, was zur Neige geht, Bevorratung bei gutem Grundpreis |
| **Bestand** | geschätzter Vorrat, Haushaltsprodukte mit Reichweite und Konfidenz, angebrochene Packungen, Rezepte, Einräumhilfe, Aufbrauchplan |
| **Erfassen** | Bon-Text auswerten (an einem echten Lidl-Bon kalibriert) oder von Hand; unsichere Zuordnungen werden **gefragt, nicht geraten** |
| **Zahlen** | eigener Einkaufsrhythmus, Ausgaben je Monat, persönliche Inflation, Preis-Gedächtnis, gelernte Rhythmen, Sparvorschläge, Packungsgrößen, Wirkung in Kilogramm |
| **Mehr** | Erscheinungsbild, Schriftgröße, Haushaltsprofil (Wasserhärte, Geräte), Ladenweg je Markt, Saison, Pfand, Bon-Archiv, Rechenweg, Datenqualitätsbericht, Sicherung/Export, Löschen |

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
npm test          # alle 589
npm run test:algo # 57 Regressions- + 85 Stress- + 94 Funktions- + 126 Haushalts- + 85 Lerntests
npm run test:ui   # 142 Oberflächentests in jsdom
```

`test/simulation.js` lässt einen simulierten Haushalt zwei Jahre lang
Tag für Tag einkaufen und antworten. Einzeltests prüfen einen Zustand;
sie können nicht sagen, ob ein Regelkreis aus Vorhersage und
Rückmeldung konvergiert oder langsam wegdriftet. Vier Szenarien:
stabiler Takt, langer Takt, Bruch nach einem Jahr, Saisonmuster. Bei
stabilem Verhalten bleibt die Vorhersage trotz 46 Rückmeldungen exakt
auf 7 Tagen — kein Aufschaukeln.

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
   aber nicht geprüft. Das betrifft die Haushaltsprodukt-Erweiterung
   besonders: sie baut vollständig auf dem Parser auf, und die
   Mengenangabe im Artikelnamen („20WL", „75ML") ist dort die
   entscheidende Zahl. Ohne sie greift der Katalogwert — gekennzeichnet
   als Referenz, aber eben nicht gemessen.
3. **Die Verbrauchsraten in `nonFoodCatalog.js` sind Schätzungen.**
   Systematische Abweichung in eine Richtung heißt: Referenztabelle
   korrigieren, nicht das Modell.
4. **Die Markenliste in `productMatcher2.js` ist Pflegearbeit.**
   Kandidaten liefert die Auswertung nicht zugeordneter Bon-Zeilen — die
   App merkt sich bestätigte Schreibweisen inzwischen selbst.
5. **Schwellenwerte sind Startwerte**, keine geprüften Konstanten.

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
