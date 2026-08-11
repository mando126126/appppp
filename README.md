# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Server, kein Konto: robuste Statistik,
Textabgleich und Tabellen, gerechnet im Browser.

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 842 Tests, Simulation und Drei-Jahres-Langzeitlauf
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

### Wiederkehren, ohne zu beschämen

Vier Funktionen, die alle aus **einer** Quelle lesen: einem dauerhaften
Ereignis-Protokoll (`activityLog.js`). Drei Module, die sich ihre
Zählung jeweils selbst aus den Käufen zusammenrechnen, wären drei
Wahrheiten — und spätestens beim ersten Widerspruch („der Rückblick
sagt 3, das Abzeichen sagt 4") ist das Vertrauen weg. Ins Protokoll
kommt nur, was der Nutzer bestätigt hat, mit Datum.

**Wochenrückblick** (`weeklyReview.js`). Ab Sonntagabend steht er oben
auf der Liste, nachholbar bis Dienstag. Er rechnet nichts Neues, er
fasst zusammen. Drei Regeln halten ihn ehrlich: nur Zeilen mit Inhalt
(ein Rückblick, der immer gleich lang ist, wird nicht gelesen);
geschätzt und gemessen bleiben getrennt; und eine ruhige Woche wird
festgestellt, nicht getadelt.

**Meilensteine** (`milestones.js`). „50 Produkte vor dem Verderb
bewahrt" statt „420 XP" — diese App hat eine bezifferbare Wirkung, das
ist stärker als eine Spielwährung. Keine Stufe misst App-Nutzung, keine
kann verfallen, und die Geldreihe zählt ausschließlich **realisierte**
Preisersparnis. Ein Abzeichen für einen geschätzten Betrag wäre eine
Auszeichnung für eine Vermutung.

**Streak** (`streakTracker.js`) — Wochen am Stück, für den Haushalt,
**ohne Rangliste**. Bei Lebensmittelverschwendung ist ein öffentlicher
Vergleich beschämend statt motivierend; wer hinten steht,
deinstalliert. Drei Abweichungen von der reinen Snapchat-Logik: die
laufende Woche bricht nie (bis Sonntag ist sie offen — eine App, die
dienstags „Streak verloren" meldet, ist schlicht falsch), eine
Kulanzwoche je acht Wochen, und Urlaubswochen zählen als gehalten. Der
Urlaubsmodus weiß ja, dass bewusst nicht eingekauft wurde. Keine
Meldung des Moduls enthält das Wort „verloren".

**Sofort-Rückmeldung.** Jede bestätigte Handlung quittiert die App mit
einem Zeichen, einer Zeile und dem Betrag — „Vollkornbrot eingefroren ·
ca. 1,25 € gerettet". Trivial gebaut, überproportional wirksam.

Zwei Geldbeträge, die **nie** addiert werden: `gerettet` ist
kontrafaktisch (der Wert, der ohne die Handlung wahrscheinlich
verdorben wäre), `guenstig` ist nachrechenbar (gezahlter Preis gegen
den eigenen Medianpreis). Derselbe Grundsatz wie bei der getrennt
ausgewiesenen Haushalts-Ersparnis: eine Summe aus gemessen und
geschätzt ist eine Zahl, die nichts mehr bedeutet.

Als „gerettet" zählt nur eine Handlung, die der Nutzer ausdrücklich
bestätigt: halbe Menge, eingefroren, aufgebraucht, gekocht. Höchstens
einmal je Produkt und Tag — sonst erzeugte ein Knopf, den man an- und
wieder abschaltet, beliebig viele Einträge. Aus einer bloßen Anzeige
eine Rettung zu zählen wäre eine Auszeichnung dafür, dass die App etwas
angezeigt hat.

Die Sonntagabend-Erinnerung ist ausdrücklich **keine** echte
Push-Nachricht: ohne Server kann niemand die App von außen wecken, und
einen Server hat diese App bewusst nicht. Sie erscheint beim nächsten
Öffnen — genau so steht es auch in der Einstellung.

### Drei Jahre am Stück: bringt das überhaupt etwas?

Alle anderen Tests beantworten „rechnet es richtig?". `test/longterm.js`
beantwortet die andere Frage — die, an der Apps scheitern. Ein
simulierter Haushalt lebt 1095 Tage: er verbraucht Tag für Tag, kauft
zweimal die Woche, fährt zweimal im Jahr zwei Wochen weg, und nach
anderthalb Jahren zieht eine Person aus. Dieselbe Welt läuft **dreimal**
mit demselben Startwert, mit drei Strategien — die dritte ist die
gebaute App im simulierten Browser, mit echtem Speicher, echtem
`compute()` und einer stellbaren Uhr.

| Strategie | vergessen | unnötig | verdorben | Leertage | Ausgaben |
|---|---|---|---|---|---|
| Gedächtnis | 28,9 % | 0 % | 1625 € | 3219 | 5103 € |
| Feste Liste | 26,7 % | 59,2 % | 3213 € | 1710 | 7132 € |
| **Einkaufs-Anker** | **7,0 %** | 14,6 % | 2181 € | 1696 | 6188 € |

Der ehrliche Vergleich ist der mit der **festen Liste**, nicht der mit
dem Gedächtnis: Letzteres wirft am wenigsten weg, weil dieser Haushalt
chronisch unterversorgt ist — an 3219 statt 1696 Tagen fehlte etwas.
Wer weniger kauft, verdirbt weniger. Vergleichbar ist nur, was gleich
gut versorgt ist, und da steht es 1696 zu 1710 Leertage bei **944 €
weniger Ausgaben und 1032 € weniger Verderb** über drei Jahre. Rund
315 € im Jahr, ohne dass jemand auf etwas verzichtet.

Die Trefferquote — wie viel von dem, was gebraucht wurde, überhaupt auf
der Liste stand — steigt von 53 % im ersten Quartal auf 88 % und hält
sich dort, auch über den Haushaltsbruch hinweg. Nach drei Jahren:
321 KB Speicher, `compute()` unter einer Viertelsekunde, Rhythmen im
Median auf 30 % am wahren Takt.

**Der Test ist kein Nutzertest.** Die Vergesslichkeitsrate von 30 % und
die Nachschau-Rate von 70 % sind Annahmen, keine Messungen. Belastbar
ist nur der Vergleich: drei Strategien, eine Welt, dieselben
Zufallszahlen.

#### Drei Fehler, die erst dieser Lauf gezeigt hat

**1. Die App war eine Überkauf-Maschine.** Der erste Durchlauf war
vernichtend: 49,8 % unnötige Käufe und **mehr** Verderb als ganz ohne
App. Ursache war die feste Vorausschau von drei Tagen. Bei einem
Rhythmus von dreißig Tagen ist das ein Zehntel des Zyklus, bei vier
Tagen sind es drei Viertel — Milch stand ab dem Tag nach dem Kauf
wieder auf der Liste. Daraus wurde eine Rückkopplung: vorgeschlagen →
gekauft → beobachteter Abstand gleich der Einkaufsfrequenz → Rhythmus
noch kürzer. Die App lernte am Ende ihren eigenen Vorschlag. 239 von
281 Packungen Milch wurden zu früh gekauft. Der Vorlauf ist jetzt ein
**Anteil** des Zyklus (`effectiveLookahead`), gedeckelt durch die
Einstellung.

**2. Rückmeldungen wurden zweimal verrechnet.** Derselbe Fehlertyp wie
das oben verworfene implizite Signal: „Hab noch da" heißt, dass nicht
gekauft wurde — sobald danach ein Kauf kommt, steckt der dadurch
längere Abstand bereits in den Daten und der Median hat ihn gesehen.
Die Korrektur trotzdem obendrauf zu legen, verschiebt einen Rhythmus,
der sich schon verschoben hat. Nach dem Auszug einer Person kostete das
die halbe Trefferquote: die App schlug so spät vor, dass nur noch 36 %
des Bedarfs auf der Liste stand. „Hab noch" verfällt jetzt mit dem
nächsten Kauf. **„War schon alle" nicht** — dass etwas vor dem Kauf
bereits leer war, steht in keinem Kaufabstand.

**3. Jeder Urlaub kostete zwei Wochen Blindflug.** Der Rhythmus misst
Kalendertage, ein Haushalt verbraucht aber Anwesenheitstage. Die
Pausenerkennung greift bei kurzen Rhythmen (14 Urlaubstage sind das
Fünffache von drei) und nicht bei mittleren (dasselbe ist nur das
Doppelte von zehn) — und genau dort entstand der Schaden: nach jeder
Rückkehr verstummte die Liste wochenlang. `absenceDetector.js` erkennt
Abwesenheit an einer Lücke in den **Bons** — das betrifft den ganzen
Haushalt und ist belastbarer als eine Lücke bei einem Produkt — und
zieht die Tage vom Abstand ab, statt den Datenpunkt wegzuwerfen.
Derselbe Befund traf den Streak: der stand nach jeder Reise wieder bei
eins, weil zwei Wochen Urlaub zwei Lückenwochen sind und die Kulanz nur
eine deckt. Erkannte Abwesenheit hält ihn jetzt.

### Abhaken, das sich wie Abhaken anfühlt

Im Ladenmodus wird eine Position nicht mehr nur markiert, sondern
**durchgestrichen** — und der Strich wird gezogen, nicht gesetzt.
`text-decoration: line-through` lässt sich nicht animieren, deshalb ein
Farbverlauf als Hintergrundbild, dessen Breite von null auf hundert
Prozent läuft; das trägt auch über einen Zeilenumbruch.

Dafür musste der Ladenmodus aufhören, sich bei jedem Tippen neu
aufzubauen. Er hing am allgemeinen Neuzeichnen: die neue Zeile war von
Anfang an im Endzustand, ein Übergang fand nie statt. Solange dieselben
Positionen in derselben Reihenfolge anstehen, bleiben die Knöpfe jetzt
stehen und es wechselt nur ihre Klasse — nebenbei auch schneller, denn
im Laden wird jede Position einmal angetippt.

Der Kreis trägt an beiden Stellen keinen Haken mehr, nur noch die
Füllung. Der Haken sagte dasselbe zweimal, und ohne ihn wirkt die Liste
ruhiger.

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

### Papier und Tinte

Die erste Fassung der Gestaltung war eine iOS-Vorlage mit Grün darin:
runde Karten in runden Karten, ein Akzentgrün von der Stange, Ringe und
Fortschrittsbalken als Zierrat, Unicode-Glyphen (`✽ ◆ ↻`) statt
gezeichneter Symbole. Sie hätte genauso eine Fitness-App sein können —
und genau das ist das Problem: **nichts daran war aus dem Gegenstand
hergeleitet.**

Diese App verwaltet Kassenbons und Haushaltsbuchhaltung. Dafür gibt es
eine visuelle Tradition, die älter ist als jedes Betriebssystem: der
Beleg. Papier, Haarlinien, Positionen untereinander, Beträge
rechtsbündig in gleich breiten Ziffern, eine Doppellinie über der
Summe. Zwei Druckfarben, mehr hatte keine Registrierkasse.

Daraus folgt alles andere:

| | |
|---|---|
| **Flächen** | Es gibt keine Karten mehr. Zeilen stehen direkt auf dem Papier, getrennt durch Haarlinien. Karte-in-Karte-in-Karte war das eigentliche Problem: jede Zeile bekam einen Kasten, weil kein Kasten etwas über Wichtigkeit aussagte. |
| **Ziffern** | Alle Zahlen in Monospace, Tabellenbreite, rechtsbündig. Beträge untereinander sollen sich vergleichen lassen, ohne dass man sie liest. |
| **Farbe** | Tinte und ein Stempelrot als einziges Warnsignal. Grün nur dort, wo etwas abgehakt ist — die zweite Farbe im Druck. |
| **Kanten** | Rechtwinklig. Radien nur an Bedienelementen, wo der Finger sie braucht. |
| **Schrift** | Überschriften klein, versal, weit gesperrt — wie der Kopf eines Belegs. |

Konkrete Ersetzungen: der Fortschrittsring der Vorrats-Reichweite ist
eine **Tagesskala** mit Wochenmarken; die Meilenstein-Kacheln sind
**Positionen mit einer Skala aus Strichen**; die fünf Glyphen sind
**gezeichnete Marken** (Keimling, Preisschild, Kreispfeil, Beleg mit
abgerissener Kante, Strichliste); der Streak ist eine **Strichliste**;
Summenzeilen tragen die **Doppellinie**; und das Aktionsblatt hat eine
**Perforation** an der Oberkante — es ist ein herausgetrennter
Abschnitt, und das eine Bild sagt es.

Der dunkle Modus ist kein umgedrehtes Papier, sondern ein Durchschlag:
warmes Schwarz, gebrochenes Weiß, dieselben zwei Farben.

**Nebenbei repariert:** die Einstellung „Schriftgröße" hatte fast keine
Wirkung. Alle Größen standen in Pixeln, der Faktor wirkte nur auf den
Fließtext. Jetzt sitzt er auf der Wurzel und alle Schriftgrößen stehen
in `rem` — Abstände und Rahmen bleiben in Pixeln, denn der Text soll
wachsen, nicht das Gerüst.

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
src/algo/        45 Node-Module — 20 unverändert aus der Vorlage, 25 neue
src/ui/
  index.html     Gerüst
  app.css        eine Gestaltung für Telefon und Rechner
  data.js        Speicher, Demo-Historie, compute() — ruft nur die Module
  views.js       die sechs Ansichten
  app.js         Rahmen: Navigation, Kopfbereich, Ladenmodus, Blätter
build.js         bündelt src/ nach web/
tools/serve.js   Entwicklungsserver ohne Abhängigkeiten
test/            Modultests, Stresstests, Simulation, Oberflächentest
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
| **Liste** | Wochenrückblick (ab Sonntagabend), Vorrats-Reichweite als Ring, Sicherheitshinweis, Vorschlag mit Detail-Blatt je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Saisonhinweis, Teilen, Budget, Haushaltsgröße, Vorausschau, Urlaub |
| **Fällig** | Austausch-Produkte mit Tausch-Reset, was zur Neige geht, Bevorratung bei gutem Grundpreis |
| **Bestand** | geschätzter Vorrat, Haushaltsprodukte mit Reichweite und Konfidenz, angebrochene Packungen, Rezepte, Einräumhilfe, Aufbrauchplan |
| **Erfassen** | Bon-Text auswerten (an einem echten Lidl-Bon kalibriert) oder von Hand; unsichere Zuordnungen werden **gefragt, nicht geraten** |
| **Zahlen** | Streak und Rückblick, Meilensteine, eigener Einkaufsrhythmus, Ausgaben je Monat, persönliche Inflation, Preis-Gedächtnis, gelernte Rhythmen, Sparvorschläge, Packungsgrößen, Wirkung in Kilogramm |
| **Mehr** | Erscheinungsbild, Schriftgröße, Rückblick-Erinnerung, Haushaltsprofil (Wasserhärte, Geräte), Ladenweg je Markt, Saison, Pfand, Bon-Archiv, Rechenweg, Datenqualitätsbericht, Sicherung/Export, Löschen |

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
npm test          # alle 842
npm run test:algo # 597 Modultests (Regression, Stress, Funktionen, Haushalt, Lernen, Rückblick)
npm run test:ui   # 209 Oberflächentests in jsdom
npm run test:long # 36 Prüfungen aus dem Drei-Jahres-Lauf
```

`test/longterm.js` ist der aufwendigste: drei Jahre Haushalt durch die
**gebaute** App, mit gestellter Uhr und im Vergleich gegen zwei
Alternativstrategien. Er hat drei Fehler gefunden, die kein Einzeltest
je erreicht hätte — sie stehen oben ausführlich.

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
