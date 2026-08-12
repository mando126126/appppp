# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Server, kein Konto: robuste Statistik,
Textabgleich und Tabellen, gerechnet im Browser.

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 874 Tests, Simulation und Drei-Jahres-Langzeitlauf
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

### Die Liste gehört dir, nicht dem Algorithmus

Zwei Dinge fehlten, und beide betrafen dasselbe: Die App war ein
**Automat, dem man zusehen konnte.**

**Sie sagte nicht, was sie ist.** Der Bereich hieß „Liste", die
Sektion darin „Fällig", und die Unterzeile zählte Bons und Produkte.
Das ist die Sprache des Algorithmus. Jetzt heißt der Bereich
**Einkaufsliste**, die Unterzeile sagt `für Sonntag · 13 Positionen ·
40,16 €`, und über der Liste steht **„Deine nächste Einkaufsliste"**
mit einer Zeile darunter, woher die Vorschläge kommen.

**Und man konnte nichts hinzufügen.** Was die App nicht wissen KANN —
Gäste am Wochenende, ein Rezept, Blumen für Oma — hatte keinen Weg
hinein. Jetzt schließt ein „Etwas hinzufügen" die Liste ab, mit zwei
Wegen:

- **aus dem Katalog** — Preis, Gang und Kategorie sind bekannt, die
  Position verhält sich wie jede andere
- **frei eingetippt** — für alles, was nicht im Katalog steht

### Der Auftritt bei einem Meilenstein

Ein erreichter Meilenstein bekam bisher dasselbe nüchterne Blatt wie
eine Rückfrage. Jetzt hat er einen eigenen Auftritt: Vollbild, ein
Aufblitzen in der Farbe der Reihe, ein Regen bunter Schnipsel — und
eine Zahl, die wie eine Walze durchläuft und einrastet.

**Was dabei ausdrücklich nicht passiert:** Es wird nichts ausgespielt.
Die Walze zeigt keinen Zufall, sie zählt zur echten Zahl hoch und
hält dort. Kein „fast gewonnen", keine Kiste, die sich öffnet, kein
zweiter Versuch. Der Reiz eines Glücksspiels kommt aus der
Ungewissheit; hier kommt er daher, dass jemand etwas geschafft hat,
und die Bewegung würdigt das nur. Alles andere wäre in einer App
gegen Verschwendung eine merkwürdige Lehre.

Es gilt für **alle** Reihen. Die Farbe kommt aus derselben Palette
wie die Abzeichen unter „Zahlen": grün für Gerettetes, gelb fürs
Sparen, blau fürs Tauschen, violett fürs Erfassen, rosa für den
Streak. Die Stufen stehen als Punkte darunter — in einem Blick
sichtbar, dass es weitergeht, ohne eine Zahl mehr.

Vier Details, die jedes einen Fehler verhindern:

- **Die Schnipsel fliegen hinter der Karte hervor**, nicht davor. Im
  ersten Versuch lagen sie über der Schrift, und der Auftritt
  verdeckte seine eigene Aussage. Sie müssen weit genug fliegen (über
  200 px), sonst bleiben sie vollständig hinter der 340 px breiten
  Karte verborgen — sie flogen, sah nur niemand.
- **Die echte Zahl steht zuerst da**, dann läuft die Walze los. Fällt
  die Bewegung aus — kein `requestAnimationFrame`, Fenster im
  Hintergrund, Sparmodus —, steht trotzdem der richtige Wert da und
  keine leere Fläche.
- **Tabellenziffern.** Proportionale Ziffern sind verschieden breit,
  und eine Zahl, die beim Hochlaufen in jedem Bild ihre Breite
  ändert, wirkt kaputt.
- **Mehrere auf einmal kommen nacheinander**, mit „Weiter (noch 2)".
  Beim ersten Aufbau — Beispieldaten geladen, Sicherung eingespielt —
  wird gar nicht gefeiert: zwanzig Auftritte für etwas, das gerade
  niemand getan hat, sind keine Freude, sondern eine Belästigung.

`prefers-reduced-motion` bekommt dasselbe Fenster mit derselben Zahl,
sofort und still. Weniger Bewegung heißt keine, nicht etwas weniger.

### Ein Bild statt Abtippen

Bis hierher gab es genau einen Weg in die Historie: den Bontext
einfügen. Auf einem Telefon ist das eine Zumutung — abtippen ist
genau die Arbeit, die die App abnehmen soll —, und ein digitaler Bon
aus einer Händler-App liegt ohnehin nur als Screenshot vor. Jetzt
führen zwei Wege zum selben Ziel: **Foto eines Papierbons** oder
**Screenshot eines digitalen Bons**, dazu Einfügen aus der
Zwischenablage (Strg+V) und Hineinziehen auf dem Rechner.

**Die Erkennung läuft auf dem Gerät.** Tesseract als WebAssembly,
alle Dateien unter `web/vendor/` (Herkunft und Fassungen:
`src/ui/vendor/HERKUNFT.md`). Kein Bild geht irgendwohin, keine
fremde Anfrage, ohne Netz funktioniert es genauso. Das kostet 4,4 MB
— und ist die einzige Fassung, die zu einer App passt, deren ganzes
Versprechen lautet, dass die Daten auf dem Gerät bleiben. Ein
Erkennungsdienst in der Cloud hätte es genau dort gebrochen, wo die
empfindlichsten Daten anfallen: beim vollständigen Einkauf. Geladen
wird erst beim ersten Bild; wer nur tippt, zahlt die Megabyte nie.

**Erkennen ist der leichtere Teil.** Was danach kommt, steht in
`receiptOcr.js`, und dort sitzen die Fehler, die still Schaden
anrichten:

- **Spalten werden zu Leerzeichen.** `lidlParser` erkennt eine
  Position an mindestens zwei Leerzeichen zwischen Name und Preis —
  auf dem Bon ist das eine Spalte. Die Erkennung macht daraus mal
  zwei, mal eins. Jede Zeile wird deshalb wieder ausgerichtet, statt
  eine zweite Bon-Grammatik zu schreiben: die eine, die an einem
  echten Bon kalibriert ist, bleibt die einzige.
- **Ziffern werden zu Buchstaben.** Auf Thermopapier ist die Null ein
  O, die Eins ein l. Im Namen ist das harmlos — der Produktabgleich
  verträgt Tippfehler. Im Preis verschwindet die Zeile. Deshalb wird
  ausschließlich **innerhalb eines Betragsworts** zurückübersetzt und
  nur, wenn darin mindestens eine echte Ziffer steht: `2,O9` wird zu
  `2,09`, `Joghurt` bleibt `Joghurt`, `SOO g Mehl` bleibt stehen.
- **Auf dem Bild steht mehr als der Einkauf.** Adresse, Steuernummer,
  Kartenbeleg, Werbespruch — alles mit Zahlen, nichts davon ein
  Produkt.

**Im Zweifel eine Zeile zu wenig.** Eine übersehene Position sieht
man sofort in der Prüfliste und tippt sie nach. Eine erfundene
wandert still in die Historie und verschiebt einen Rhythmus, den
danach niemand mehr erklären kann. Deshalb: kein negativer Preis (das
ist ein Abzug, kein Produkt — der Zufallstest hat genau das gefunden),
kein Betrag über 300 €, kein Name ohne Buchstaben, keine Position
ohne Betrag.

Danach ist der Weg derselbe wie beim Text: dieselbe Prüfliste,
dieselbe Bestätigung Zeile für Zeile. **Eine Texterkennung liest, sie
versteht nicht** — sie darf vorschlagen und niemals buchen. Datum und
Markt werden aus dem Bild übernommen, aber nur, wenn dort etwas
stand.

Gemessen an zwei erzeugten Bon-Fotos (gerade und um 3° gedreht, mit
Schatten und Unschärfe): 2–3 Sekunden, alle Positionen erkannt, alle
Produkte richtig zugeordnet, Rabattzeile und Gewichtszeile korrekt
der Position darüber zugeschlagen. `test/ocr.js` prüft mit 53 Tests
den Weg vom erkannten Text zum Bon — nicht die Erkennung selbst, die
ist ein fremdes Programm mit eigenen Tests.

### Jede Marke erklärt sich

Die Liste ist voller kurzer Zeichen: „von dir", „+8 %", „doppelt?",
„VD", „3 T". Sie sind kurz, weil eine Zeile schmal ist — und genau
deshalb erklärt sich keines von selbst. Wer „+8 %" liest, weiß nicht,
ob das Mehrwertsteuer, Rabatt oder Preisänderung ist, und niemand
tippt eine Zeile an, um es herauszufinden.

Jede Marke ist jetzt antippbar. Auf dem Rechner genügt das Verweilen
mit dem Zeiger (`title`), auf dem Telefon — wo es kein Verweilen gibt
— öffnet ein Tippen dasselbe Blatt, das auch hinter den (i) steckt.

Die Texte sind **generisch**: sie erklären die Art der Marke, nicht
den Einzelfall. „So entsteht diese Zahl", nicht „deine Äpfel sind 8 %
teurer" — der Einzelfall steht im Detail-Blatt, das eine Zeile weiter
aufgeht. Die Frage „was ist das für ein Zeichen?" stellt man einmal,
nicht bei jedem Produkt neu.

Zwei Details, die nicht Kosmetik sind:

- **Der Schlüssel entscheidet über den Text, nicht die Farbe.** Die
  gelbe Marke steht mal für „überfällig", mal für „teurer als sonst".
  Wer die Erklärung aus der CSS-Klasse ableitet, zeigt an einer von
  beiden Stellen still den falschen Text.
- **Marke in Zeile heißt: die Zeile ist keine `<button>` mehr.** Eine
  Schaltfläche in einer Schaltfläche ist ungültiges HTML; Browser
  hängen die innere aus dem Baum aus, und das Antippen ginge ins
  Leere. Beide Zeilen tragen jetzt `role="button"` samt Tastaturweg,
  und ein Test prüft, dass keine Verschachtelung zurückkehrt.

Ein unbekannter Schlüssel lässt die Marke sichtbar, aber stumm. Eine
Marke, die bei einem Tippfehler verschwindet, wäre der schlimmere
Fehler.

### Marke oder Eigenmarke

Ein Potenzial, kein Auftrag (`brandSwap.js`). Die App tauscht nichts,
setzt keine Eigenmarke auf die Liste und bucht keinen Betrag als
Ersparnis — sie zeigt, was ein Wechsel im Jahr bedeuten würde, und
überlässt die Entscheidung dem Haushalt. Wer seinen Kaffee mag, mag
ihn; eine App, die das jede Woche in Frage stellt, wird deinstalliert,
und zwar zu Recht.

**Zwei Arten von Zahl, die nie addiert werden.** *Belegt* heißt: der
Haushalt hat dasselbe Produkt schon beides Mal gekauft, verglichen
werden die Mediane der eigenen Preise — die Differenz ist keine
Behauptung, sondern der eigene Bon. *Geschätzt* heißt: es gibt nur
Markenkäufe, gerechnet wird mit 25 % Abstand, dem unteren Ende der
üblichen Spanne. Das ist ein **Schätzwert ohne belastbare Quelle**,
dieselbe Auflage wie bei den geschätzten Haltbarkeiten im Katalog. Die
beiden Summen stehen unter eigenen Zwischenüberschriften; ein Feld,
das sie zusammenfasst, gibt es nicht — und ein Test prüft, dass es
auch keines gibt.

**Warum hier nichts gebucht wird.** Wer wirklich wechselt, zahlt unter
seinem eigenen Median, und `receiptSavings` bucht die Differenz
ohnehin als realisiert. Denselben Euro hier ein zweites Mal zu zählen
wäre exakt der Fehler, der in diesem Projekt schon zweimal der
teuerste war.

**Drei Zurückhaltungen**, jede gegen einen konkreten Fehlschluss:

- **Probiert und wieder verlassen** — folgen nach dem letzten
  Eigenmarkenkauf mindestens drei Markenkäufe, schweigt die App. Das
  ist eine Antwort, keine Wissenslücke. Ein einzelner Markenkauf
  reicht nicht: dann wechseln sich beide ab, und der Vergleich ist
  gerade dadurch belegt.
- **Nur der Markenanteil wird hochgerechnet.** Was der Haushalt längst
  als Eigenmarke holt, steht nicht noch einmal im Potenzial.
- **Je 100 g, wenn Gewichte da sind.** Der nackte Stückpreis verglich
  sonst 500 g Markenbutter mit 250 g Eigenmarke und meldete eine
  Ersparnis, die es nicht gibt.

Erkannt wird die Marke aus der **Klartextzeile des Bons** und beim
Buchen festgehalten. Der Produktabgleich wirft Markennamen bewusst weg
— sie stören die Zuordnung —, aber davor steht dort „MILBONA JOGHURT"
oder „EHRMANN ALMIGHURT". Positionen, die im Ladenmodus abgehakt
wurden, haben keine Zeile und zählen nirgends mit, weder dafür noch
dagegen. Die beiden Markerlisten sind Pflegearbeit wie die Markenliste
im Matcher; unvollständig ist in Ordnung, weil eine unerkannte Marke
nur ein Potenzial kostet.

Und was einen nicht interessiert, lässt sich dauerhaft abstellen —
kein „für diese Woche".

### 850 Produkte und eine Suche, die deutsch kann

Der freie Text war der Notausgang, und er wurde zu oft benutzt: wer
„Bananen" tippte, bekam eine Zeile ohne Haltbarkeit, ohne Gang, ohne
Gewicht — für Rhythmus, Verderb und Wirkungsmessung unsichtbar. Der
Katalog ist deshalb von 273 auf **846 Produkte** gewachsen, und
darüber liegt eine eigene Suche (`productSearch.js`).

Eigen, weil es eine andere Frage ist als die des Bonabgleichs.
`productMatcher2` bekommt eine vollständige, kryptisch abgekürzte
Zeile und bucht daraus Historie — ein Fehltreffer ist teuer, also
fragt es lieber nach. Die Tippsuche bekommt ein Fragment und stellt
zwölf Vorschläge daneben; ein Fehlvorschlag kostet nichts, ein
fehlender Vorschlag alles.

Acht Stufen, und die Reihenfolge der ersten beiden ist der Kern:

1. ein ganzes Wort ist es (`milch` → H-Milch)
2. **ein Wort endet darauf** (`brot` → Vollkornbrot)
3. der Name beginnt damit (`ban` → Bananen)
4. ein Wort beginnt damit, 5. der Name enthält es, 6. ein Alias
   passt, 7. vertippt, aber nah dran (`jogurt` → Joghurt), 8. der
   Gang passt

Stufe 2 vor Stufe 3 ist deutsche Morphologie: im Kompositum steht das
Grundwort **hinten**. „Vollmilch" ist Milch, „Milchreis" ist Reis. Wer
`milch` tippt, meint fast nie Milchreis — eine Suche, die nur auf
Wortanfänge schaut, zeigt ihm aber genau den zuerst.

Dazu drei Regeln, die jede für sich einen Fehler verhindern:

- **Der Tippfehler-Ausgleich verlangt denselben Anfangsbuchstaben.**
  Ohne ihn wird aus `spargel` ein Haargel — Levenshtein-Abstand 2.
- **Unter vier Zeichen wird nicht geraten.** Kurz ist alles zu allem
  ähnlich.
- **Was der Haushalt schon kauft, steht bei gleichem Rang vorn** — aber
  nur bei gleichem Rang. Die Gewohnheit ordnet, sie entscheidet nicht.

Umlaute, ß und Akzente sind gefaltet: `kaese`, `Käse` und `KAESE`
führen zum selben Ergebnis. Dieselbe Faltung fehlte im Bonabgleich für
Akzente — „Crème fraîche" zerfiel zu `cr me fra che`, und wer `creme`
tippte, bekam Handcreme und Schuhcreme, aber nicht das Produkt, das so
heißt. `test/search.js` prüft das mit 56 Tests, darunter 30 Eingaben,
die ein Mensch wirklich tippt, und der Nachweis, dass **jedes** der 846
Produkte über seinen eigenen Namen auffindbar ist.

Freie Zeilen bekommen **keine Produktkennung**. Sie fließen
ausdrücklich nicht in die Rhythmen ein, tauchen in keiner Verderb-,
Saison- oder Doppelkauf-Prüfung auf und zeigen statt eines erfundenen
Preises einen Strich. Aus „Blumen für Oma" darf die App keinen
Kaufabstand lernen — sie merkt sich nur, dass die Zeile diese Woche
gebraucht wird.

Ergänzte Positionen stehen in einem eigenen Abschnitt **„Von dir
ergänzt"** und tragen eine Marke. Das ist keine Formsache: es
beantwortet die Frage „woher kommt das hier eigentlich?", ohne dass
man eine Zeile antippen muss. Sie gelten für eine Woche, überstehen
die Budgetprüfung (was der Nutzer ausdrücklich draufsetzt, streicht
kein Optimierer weg) und werden mit dem nächsten gebuchten Einkauf
abgeräumt.

### Hell, farbig, rund

Zwei Anläufe waren daneben, und beide auf lehrreiche Weise.

Der erste war eine iOS-Vorlage mit Grün darin: Karten in Karten, ein
Akzent von der Stange, Ringe und Fortschrittsbalken als Zierrat,
Unicode-Glyphen (`✽ ◆ ↻`) statt gezeichneter Symbole. Beliebig — es
hätte genauso eine Fitness-App sein können.

Der zweite war eine Kassenbon-Ästhetik: Sepia, Versalien, Monospace,
Haarlinien, keine Rundungen. Konsequent aus dem Gegenstand hergeleitet
— und kalt wie ein Formular von 1974. **Strenge ist keine Gestaltung,
sie ist nur die andere Art, sich zu drücken.**

Was jetzt gilt: hell, farbig, rund, freundlich. Und trotzdem nicht
beliebig — der Unterschied liegt in vier Dingen, die Mühe machen:

| | |
|---|---|
| **Eine Palette, nicht ein Akzent** | Sechs Farben mit Aufgabe: Grün für Erledigtes, Korall für Dringendes, Bernstein für Schätzungen, Blau für Hinweise, Violett für Erreichtes, Pink nur für Abzeichen. Keine davon ist Dekoration — dass Korall ausschließlich „dringend" heißt, war der Grund für die sechste Farbe. |
| **Gezeichnete Marken** | Fünf Strichzeichnungen in getönten Kacheln, jede in ihrer Farbe: Keimling, Preisschild, Kreispfeil, Beleg, Strichliste. Keine Emoji, keine Glyphen aus dem Zeichensatz. |
| **Echte Hierarchie** | Große, freundliche Zahlen gegen ruhige Beschriftungen. Nicht alles gleich groß, nichts versal gesperrt. |
| **Eine Tiefenstufe** | Genau ein Schatten, überall derselbe. Karten liegen auf dem Grund — nicht Karten auf Karten auf Karten. |

Dazu Bewegung mit ein wenig Nachschwingen (`cubic-bezier(.34,1.56,.64,1)`):
Knöpfe federn beim Druck, das Häkchen springt auf, das Glückwunsch-
Abzeichen dreht sich hinein. Bei „Bewegung reduzieren" entfällt alles
davon, ohne dass Inhalt verloren geht.

Ziffern stehen in Tabellenbreite, damit Beträge untereinander
vergleichbar sind, ohne dass man sie liest — aber in der
Systemschrift, nicht in Schreibmaschine. Der Vorrat wird als große Zahl
mit weichem Balken gezeigt statt als Fortschrittsring (der steckt in
jeder zweiten App) und statt als Messskala (die war das Formular). Der
Wochenrückblick ist die einzige farbige Karte der App — er ist
höchstens drei Tage in der Woche da, also darf er auffallen.

**Nebenbei repariert:** die Einstellung „Schriftgröße" hatte fast keine
Wirkung. Alle Größen standen in Pixeln, der Faktor wirkte nur auf den
Fließtext. Jetzt sitzt er auf der Wurzel und alle Schriftgrößen stehen
in `rem` — Abstände und Rahmen bleiben in Pixeln, denn der Text soll
wachsen, nicht das Gerüst. Die Beschriftung der Tableiste ist
gedeckelt, sonst steht dort bei 130 Prozent „MEH".

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
| **Liste** | Wochenrückblick (ab Sonntagabend), eigene Positionen ergänzen, Vorrats-Reichweite, Sicherheitshinweis, Vorschlag mit Detail-Blatt je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Saisonhinweis, Teilen, Budget, Haushaltsgröße, Vorausschau, Urlaub |
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
npm test          # alle 874
npm run test:algo # 597 Modultests (Regression, Stress, Funktionen, Haushalt, Lernen, Rückblick)
npm run test:ui   # 241 Oberflächentests in jsdom
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
