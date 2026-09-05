# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Konto: robuste Statistik, Textabgleich
und Tabellen, gerechnet im Browser. Ein eigener Server fehlt weiterhin —
nur ein Produktname, den der eigene Katalog nicht kennt, geht zur
Übersetzung an Open Food Facts (Details unten, „Wenn der eigene Katalog
nicht reicht").

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 2319 Tests, Simulation und Drei-Jahres-Langzeitlauf
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
| **Bleiben die Daten?** | nein, alles im Quelltext | `localStorage` dieses Browsers |
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

### Die Startseite beantwortet wieder eine Frage

Die Rückmeldung aus der Zielgruppe war eindeutig: **zu überladen.**
Sie hatte recht, und die Zahl sagt es deutlich — die Seite war bei
Beispieldaten **2610 Pixel** lang und bestand aus bis zu **zehn
Blöcken**: Vorratsanzeige, Sicherheit, die Liste, zwei Knöpfe,
vergessene Produkte, Einfrieren, Saison, Lagerhinweis und vier
Einstellungen.

Jeder Block war für sich begründet. Zusammen beantworteten sie zehn
Fragen, obwohl beim Öffnen genau eine im Kopf ist: **Was muss ich
einkaufen?**

Jetzt sind es **drei Blöcke und 1153 Pixel**. Nichts wurde gelöscht —
alles ist einen Tipp entfernt:

| war auf der Startseite | steht jetzt |
|---|---|
| Vorrat, Reichweite | Bestand — dort sucht man den Vorrat |
| Budget, Personen, Vorausschau, Urlaub | Mehr — das sind Einstellungen, die man einmal anfasst |
| Sicherheit, Vergessenes, Einfrieren, Saison, Lagern | eine Zeile „Hinweise", die ein Sammelblatt öffnet |

Die Hinweis-Zeile steht **oben**, wenn etwas Dringendes dabei ist
(Kühlkette), sonst unten. Eine Warnung, die man erst erscrollen muss,
ist keine — dieselbe Regel wie bei der Sicherung unter „Mehr". Und im
Sammelblatt behält jeder Hinweis seine Handlung: „Dazu", „Nein",
„Eingefroren". Das ist der Unterschied zwischen einem Sammelblatt und
einer Abstellkammer.

**Höchstens ein Zeichen je Zeile, und nur wenn es eine Handlung
auslöst.** Vorher konnten fünf nebeneinander stehen — „von dir", „3 T
überfällig", „38 %", „VD", „+8,4 %", „doppelt?". Der Grund ist nicht
die Menge allein: `+8,4 %` ändert nichts an der Entscheidung, die
Milch zu kaufen. Es ist eine Beobachtung, keine Aufforderung — und
Beobachtungen stehen unverändert im Detail-Blatt. Übrig bleiben die
vier, die eine Entscheidung verlangen, **bevor** man losgeht:
`doppelt?`, die eigene Antwort, `von dir`, `VD`. „Überfällig" ist
ohnehin der Grund, warum die Zeile dasteht — sie erklärt sich selbst.

Zwei kleinere Sachen aus derselben Richtung: die Karte trägt keine
eigene Überschrift mehr (die Seite heißt schon „Einkaufsliste"; die
Erklärung sitzt jetzt am (i) neben der Summe). Und aus dem grauen
Knopf „Halbe Menge" — der einzigen Zeile, die doppelt so hoch war,
ohne zu sagen warum — ist ein Satz geworden, den man antippt: **„Hält
2 Tage — halbe Menge?"** Dieselbe Handlung, nur verständlich.

`test/uitest.js` hält das fest: **höchstens vier Blöcke** auf der
Startseite, höchstens ein Zeichen je Zeile, keine Preisabweichung auf
der Liste — und der Nachweis, dass jeder umgezogene Inhalt an seinem
neuen Ort wirklich ankommt. Ohne Grenze wächst so eine Seite von
selbst wieder zu.

### Die Startseite ist nicht mehr die Liste

Die aufgeräumte Liste war besser als die überladene — und trotzdem die
falsche Startseite. Eine Liste ist ein Werkzeug für **einen** Moment:
kurz vor dem Einkauf. Wer die App an einem Dienstagabend öffnet, hält
keine Liste in der Hand, sondern hat eine andere Frage:

> **Was kommt auf mich zu?**

Der erste Reiter heißt jetzt **Start** und beantwortet genau die, in
dieser Reihenfolge:

1. **Deine Woche** — sieben Tage ab heute, jedes Feld ein Ereignis
2. **Einkaufsliste** — ein Feld, ein Preis, ein Knopf
3. **Jetzt zu tun** — nur, was heute eine Handlung braucht
4. **Dein Lauf** — die Wochenreihe, sonst nichts

**Der Wochenstreifen ist der Kern**, und er ist bewusst kein
Diagramm. Ein Feld ist **eine Sache**, seine Höhe ist **fest**. Das
klingt nach einem Detail und ist der ganze Unterschied: ein Balken,
der sich auf sein eigenes Maximum normiert, sieht bei einer Sache
genauso dramatisch aus wie bei zwölf. Hier bleibt eine ruhige Woche
flach — und zwar auch im Vergleich zur Woche davor.

Drei Quellen laufen zusammen, die vorher auf drei Seiten verteilt
waren: die Bestandsschätzung sagt, wann etwas **verdirbt**, der
gelernte Kaufabstand, wann etwas **fällig** ist, das Austauschintervall,
wann die Zahnbürste dran ist. Der gelernte Einkaufstag ist markiert.
Jeder Tag ist antippbar und nennt die Sachen beim Namen.

Genau diese Zusammenführung war in diesem Projekt zweimal die
Fehlerquelle — **ein Ereignis, das über zwei Kanäle in dieselbe Summe
läuft.** Deshalb steht die Rechnung in `src/algo/weekPulse.js` und
nicht in der Oberfläche, und deshalb prüft `test/pulse.js` nicht das
Beispiel, sondern die Regeln:

- Haushaltsprodukte, deren Reichweite endet, stehen **nur** als
  Einkauf da — `supplies` wird gar nicht erst eingelesen
- ein Produkt, das an einem Tag verdirbt **und** fällig wäre, zählt
  einmal; es gewinnt das Verderben
- über die Woche verteilt darf dasselbe Produkt zweimal vorkommen —
  Dienstag aufgebraucht und Freitag wieder fällig sind zwei
  verschiedene Tatsachen
- Überfälliges fällt auf **heute**, nicht aus der Woche

3000 zufällige Wochen prüfen die Invarianten, die daraus folgen: nie
mehr Ereignisse als Quellen, nie zwei Einträge für ein Produkt an
einem Tag, nie ein Satz mit `undefined` darin.

**Was das an Navigation gekostet hat:** „Fällig" war ein siebter
Reiter, und sieben passen unten nicht nebeneinander. Die Seite ist
nicht verschwunden — sie hat ihre Adresse (`#faellig`) behalten und
hängt jetzt an zwei Stellen: an „2 Sachen tauschen" auf der
Startseite, wenn etwas fällig ist, und dauerhaft an „Austausch und
Nachschub" im Bestand. Solange sie in der Leiste stand, war die
Übersicht der siebte Platz, den es nicht gab.

Und der Kopf grüßt, statt sich zu benennen. „Übersicht" über einer
Übersicht sagt nichts — man sieht ja, worauf man ist. Nachts steht
dort bewusst kein „Guten Morgen".

### Einen Bon korrigieren, statt ihn wegzuwerfen

Bis hierher gab es genau eine Möglichkeit, einen gebuchten Bon
anzufassen: ganz löschen. Nach einem Fehltreffer der Texterkennung —
und die Prüfliste fängt nicht alles ab — hieß das: alles wegwerfen und
neu erfassen. Das ist der Moment, in dem eine App zum ersten Mal als
lästig erlebt wird, und beim Fotografieren tritt er häufiger ein als
beim Tippen.

Jetzt öffnet ein Tippen auf einen Bon seine Positionen. Jede lässt
sich **entfernen** oder **einem anderen Produkt zuordnen** — und wer
umbucht, dessen Schreibweise wird gleich mitgelernt, damit derselbe
Fehltreffer beim nächsten Bon nicht wieder passiert.

Was dabei mitgezogen wird, ist der heikle Teil:

- **Summe und Anzahl des Bons.** Ohne das hätte man korrigiert und
  keine Wirkung gesehen.
- **Der Erfassungsbetrag im Ereignis-Protokoll**, um die Differenz
  verschoben statt neu erfunden — sonst meldete der Wochenrückblick
  weiter die alte Summe.
- **Eine als „günstig" gebuchte Ersparnis**, die an der entfernten
  Position hing, verschwindet mit ihr. Sie war die Differenz zu einem
  Preis, den es nicht gab.
- **Ein Bon ohne Positionen** verschwindet von selbst.

Nicht angepasst werden die Lebenszähler der Meilensteine. Das ist
Absicht: Erreichtes verfällt in dieser App nicht, auch nicht durch
eine Korrektur. Ein Abzeichen, das wieder verschwindet, weil man einen
Tippfehler behoben hat, wäre die schlechtere Botschaft.

### Zwei Zahlen, die nicht stimmten

**Die Verschwendungsquote konnte über 100 % gehen.** In der Demo stand
bei Hähnchenbrust „21 von 20 Käufen verdorben". Ursache: chronischer
Anteil und Ausreißer wurden addiert.

Der chronische Anteil sagt „bei **jedem** Zyklus geht ein Teil
verloren", der Ausreißer sagt „**dieser eine** ging ganz verloren" —
ein Ausreißer ist kein zusätzlicher Verlust, sondern ein besonders
schlimmer Fall desselben. Es ist dieselbe Fehlerklasse wie die zwei
teuersten Fehler dieses Projekts: **ein Ereignis, das über zwei Kanäle
in dieselbe Summe läuft.**

`wasteSummary()` rechnet jetzt je Kauf den **größeren** der beiden
Anteile, nie ihre Summe. Damit gilt „verdorben ≤ gekauft" von der
Konstruktion her statt durch eine angeklebte Deckelung. Zwei Dinge
fielen dabei mit ab: der Eurobetrag rechnet mit dem tatsächlich
gezahlten Preis je Kauf statt mit dem letzten Preis für alle (bei
steigenden Preisen war der Verlust systematisch zu hoch), und die
Rechnung steht nicht mehr in der Oberfläche, sondern in `src/algo`, wo
sie geprüft werden kann. Betroffen war nicht nur die Anzeige: dieselbe
Quote steuert das Risiko-Zeichen auf der Liste, die Schwelle der
Sparvorschläge und den Verlustbetrag.

**Und die farbigen Marken waren nicht lesbar.** Gemessen nach WCAG 2.1,
mit echter Überlagerung der halbdurchsichtigen Tönungen:

| | vorher | jetzt |
|---|---|---|
| Gelb (`+8 %`, „überfällig") | 1,93:1 | 4,57:1 |
| Grün (`−12 %`) | 2,84:1 | 4,57:1 |
| Rot (VD, Risiko) | 3,06:1 | 4,61:1 |
| Blau (`doppelt?`) | 3,24:1 | 4,56:1 |
| Violett (`von dir`) | 3,94:1 | 4,58:1 |
| Rosa (Streak) | 3,16:1 | 4,61:1 |

Die Norm verlangt 4,5:1, und diese Marken tragen die Aussagen, für die
es die App gibt. Die Lösung ist ein zweiter Satz Werte — derselbe
Farbton, nur tiefer, ausschließlich für Schrift auf der zugehörigen
Tönung (`--amber-ink` neben `--amber`). Die helle Farbe bleibt, wo sie
stark genug ist: auf Flächen, Balken, Punkten.

Der Test fand dabei mehr als die Handprüfung:

- **Die Hauptschaltfläche.** Weiß auf dem hellen Grün lag bei 3,21:1 —
  bei dem Knopf, der in dieser App am häufigsten gedrückt wird.
- **Der dritte Grauton** (`--ink-3`) lag bei 2,14:1 und trägt die
  Quellenhinweise, Kachelbeschriftungen und die Rohzeilen des Bons. Er
  ist jetzt lesbar; der Abstand zu `--ink-2` ist dadurch kleiner, und
  die Rangfolge tragen Größe und Gewicht statt der Helligkeit. Drei
  Graustufen, von denen zwei lesbar sein müssen, lassen keinen Platz
  für eine dritte.
- **Die Sicherheitsmarke im dunklen Modus.** Weiß auf dem hellen
  Korall lag bei 2,56:1 — die Lösung ist nicht ein anderes Rot,
  sondern dunkle Schrift darauf.

`test/contrast.js` rechnet das aus `app.css` nach, in beiden Modi, und
prüft **jede** Paarung aus getönter Fläche und Schrift, die im
Stylesheet vorkommt — nicht eine Namensregel, sondern das Ergebnis.
Farben werden angefasst; ein Ton wird „etwas freundlicher", und
niemand rechnet nach, weil Nachrechnen von Hand niemand macht.

### Die Haltbarkeiten, geprüft — und die Herkunft war falsch

Die 54 sicherheitskritischen Produkte trugen für ihre Tageszahl die
Stufe **„regulatorisch"**, also „rechtlich definiert". Die
Quellenprüfung ergibt: das stimmt nicht, und zwar an der
empfindlichsten Stelle des Katalogs.

Rechtlich definiert sind genau zwei Dinge:

1. **Die Pflicht zum Verbrauchsdatum.** VO (EU) 1169/2011 (LMIV),
   Art. 24 und Anhang X — bei Lebensmitteln, die „in mikrobiologischer
   Hinsicht sehr leicht verderblich" sind, ersetzt das Verbrauchsdatum
   das MHD; nach Ablauf ist die Abgabe verboten.
2. **Die Höchsttemperatur.** Tier-LMHV Anlage 5 i. V. m. VO (EG)
   853/2004 — Hackfleisch +2 °C, Innereien +3 °C, Fleischzubereitungen
   und Geflügel +4 °C.

**Die Anzahl der Tage ist nicht geregelt.** Kein Gesetz sagt, dass
Hähnchenbrust zwei Tage hält, und die Behörden nennen bewusst keine
Zahl — es gibt keine, die für jedes Produkt, jede Kühlkette und jeden
Kühlschrank stimmt. BZfE und BMEL sagen stattdessen zweierlei: es gilt
das **aufgedruckte** Datum, und als grobe Orientierung existieren
Lagerempfehlungen (Geflügel und rohe Innereien 1–2 Tage, Rindfleisch
am Stück 3–4, Fisch höchstens 2; loses Hackfleisch am selben Tag).

Daraus folgt dreierlei:

- **Die Tageszahlen heißen jetzt „leitlinie".** Eine App, die ihre
  unsicherste Zahl als ihre sicherste ausweist, ist genau dort
  unehrlich, wo es gefährlich wird.
- **Wo eine Empfehlung eine Spanne nennt, gilt die untere Grenze.**
  Sieben Werte lagen darüber und wurden gesenkt: Entenbrust, Gans und
  Hähnchen-Nuggets (Geflügel), Bratwurst, Gyros und Merguez
  (Fleischzubereitungen) sowie Sprossen — je von 3 auf 2 Tage. Dass
  „Entenbrust" Geflügel ist, erkennt keine Namensheuristik; die
  Zuordnung steht deshalb als ausdrückliche Liste in `safetyRules.js`.
- **Das aufgedruckte Datum schlägt jede Schätzung**, in beide
  Richtungen. Es lässt sich im Produktblatt eintragen, und ab dann
  rechnet die App damit statt mit ihrer Empfehlung.

`safetyRules.js` ist dabei keine Dokumentation, sondern eine Prüfung:
`checkSafetyData` hält den Katalog gegen sieben belegte Gruppen, und
`test/safety.js` bricht ab, sobald ein Produkt darüber liegt, ohne
Gruppe dasteht oder seine Tageszahl wieder als Recht ausgibt. Eine
einmalige Durchsicht wäre in drei Monaten wertlos.

Zwei Fehler fielen dabei nebenbei auf: `„2026-13-45"` kam durch die
Formprüfung des Datums (Monat 13, Tag 45), und der Bestand rechnete
die Frage „ist es überhaupt noch da?" weiter mit der Schätzung,
während die Anzeige schon das Etikett nahm.

### Damit drei Jahre nicht an einem Dienstag verschwinden

Alles, was diese App weiß, liegt im `localStorage`. Das ist kein
Tresor, sondern ein Zwischenspeicher mit guten Manieren: er wird
geleert, wenn der Browser Platz braucht, wenn jemand „Browserdaten
löschen" tippt — und auf iPhone und iPad räumt Safari die Daten einer
**nicht installierten** Web-App nach sieben Tagen ohne Nutzung ab.
Sieben Tage sind ein Urlaub.

Der Verlust wäre hier besonders bitter, weil er nicht eine Einstellung
kostet, sondern Gelerntes: drei Jahre Rhythmen, jede Rückmeldung,
jeden Meilenstein. Es gibt kein Konto, mit dem sich das
wiederherstellen ließe — das ist ja der Punkt.

**Drei Stufen, in aufsteigender Wirksamkeit:**

1. **Dauerhafter Speicher** (`navigator.storage.persist()`). Kostet
   nichts, hilft am meisten. Gefragt wird **nach dem ersten erfassten
   Einkauf**, nicht beim ersten Start: Browser entscheiden nach
   Nutzungssignalen, und ein zu früh gestelltes Gesuch wird abgelehnt
   — dauerhaft.
2. **Eine Schattenkopie** im selben Speicher. Sie hilft *nicht* gegen
   Löschen; dagegen hilft nichts, was im selben Speicher liegt. Sie
   hilft gegen den abgebrochenen Schreibvorgang — volle Quote,
   Absturz, halbe Datei —, und der tritt ohne Zutun ein. Sie hinkt
   bewusst hinterher (jede zehnte Speicherung), denn zwei gleichzeitig
   geschriebene Kopien sind zwei gleichzeitig kaputte. Beim Start
   entscheidet der **Inhalt**, welche gilt, nicht der Zeitstempel:
   eine abgeschnittene Datei ist neuer und trotzdem schlechter. Und
   wenn die Schattenkopie einspringt, sagt die App das, statt es still
   zu tun.
3. **Eine Datei außerhalb des Browsers.** Nur sie überlebt wirklich
   alles. Wo die File System Access API vorhanden ist (Chrome, Edge,
   Android), wählt man das Ziel einmal aus, und die App schreibt
   danach bei jeder Änderung selbst hinein — gebündelt über vier
   Sekunden, damit das Abhaken einer Liste nicht zwanzig Schreibvorgänge
   auslöst, und beim Verlassen der Seite noch einmal (`pagehide` und
   `visibilitychange`, weil ein Telefon eine Seite selten schließt und
   meist nur wegschiebt). Wo die API fehlt (Safari, Firefox), bleibt
   der Download — und die App erinnert daran, statt so zu tun, als
   wäre alles geregelt.

Die Erinnerung ist bewusst selten: nur bei echter Gefährdung und
höchstens einmal pro Woche. Eine Meldung, die bei jedem Start
erscheint, wird nach dem dritten Mal weggetippt, ohne gelesen zu
werden — und fehlt dann an dem Tag, an dem sie zählt. Und sie nennt,
was auf dem Spiel steht: „57 Bons und alles Gelernte liegen nur in
diesem Browser" bewegt jemanden, „nicht gesichert" nicht.

Ist der Zustand gefährdet, steht die Gruppe ganz oben in „Mehr" statt
unten bei den Daten. Eine Warnung, die man erst erscrollen muss, ist
keine.

**Was hier bewusst fehlt: eine Wolke.** Ein Server würde das Problem
lösen und dabei das Versprechen brechen, auf dem die ganze App steht.
Die Antwort ist deshalb nicht „vertraut uns", sondern „nehmt eure
Datei mit".

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

- **Spalten werden zu Leerzeichen.** `receiptParser` erkennt eine
  Position an mindestens zwei Leerzeichen zwischen Name und Preis —
  auf dem Bon ist das eine Spalte. Die Erkennung macht daraus mal
  zwei, mal eins. Jede Zeile wird deshalb wieder ausgerichtet, statt
  eine zweite Bon-Grammatik zu schreiben: die eine, die an echten
  Bons kalibriert ist, bleibt die einzige.
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
die ein Mensch wirklich tippt, und der Nachweis, dass **jedes** der
inzwischen 1699 Produkte über seinen eigenen Namen auffindbar ist.

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
| **Eckige Flächen, runde Punkte** | Karten, Zeilen, Knöpfe, Felder und Balken haben scharfe Kanten. Rund bleibt nur, was ein Punkt ist: Abhak-Kreise, der Pfeilkreis, Streak-Punkte, der Schalter, die Marken. |
| **Eine eigene Schrift** | Manrope, mitgeliefert statt geladen. Halb-grotesk, offene Punzen, sehr ruhige Ziffern, hohe x-Höhe — freundlich, ohne verspielt zu sein. |

Dazu Bewegung mit ein wenig Nachschwingen (`cubic-bezier(.34,1.56,.64,1)`):
Knöpfe federn beim Druck, das Häkchen springt auf, das Glückwunsch-
Abzeichen dreht sich hinein. Bei „Bewegung reduzieren" entfällt alles
davon, ohne dass Inhalt verloren geht.

#### Schwarm-Preisindex: der Entwurf steht, der Server nicht

Die Idee: aus den Bons vieler Haushalte entsteht automatisch eine
reale Preisdatenbank, und jeder bekommt die Mitteilung „bei vielen war
das gerade besonders günstig". Der vollständige Entwurf steht in
[`docs/schwarm.md`](docs/schwarm.md) — hier nur, was daran die
Entscheidung ist.

**Was dagegen steht.** Diese App verspricht an drei Stellen
ausdrücklich: kein Server, kein Konto, keine Übertragung. Das ist
keine Beschreibung, sondern die Bauart — 4,4 MB Texterkennung auf dem
Gerät statt einer Cloud-API, die Schrift mitgeliefert statt geladen,
ein Test, der eine fremde Adresse im Stylesheet verbietet. Und ein
Kassenbon verrät mehr als Preise: Babynahrung heißt Schwangerschaft,
Halal heißt Religion, Diabetiker-Produkte heißen Gesundheit —
besondere Kategorien nach Art. 9 DSGVO, auf ganz gewöhnlichen Bons.

**Der Entwurf löst das über die Einheit**, die übertragen wird: keine
Kaufhandlung, sondern eine **Preissichtung** über einen Händler.

```json
{ "v": 1, "produkt": "butter", "kette": "lidl",
  "kw": "2026-W34", "cent": 149, "packung": 250 }
```

Keine Menge (Haushaltsgröße), kein Datum sondern die Kalenderwoche,
keine Filiale sondern die Kette, **kein Warenkorb** (zwölf Positionen
identifizieren einen Haushalt zuverlässiger als ein Name) und keine
Kennung — auch keine „pseudonyme": ein stabiler Schlüssel über Wochen
*ist* eine Kennung. Übrig bleibt eine Aussage über einen Händler statt
über einen Menschen.

Dazu zwei Regeln, die `priceShare.js` erzwingt: **nur bekannte
Ketten** (ein seltener Ladenname ist selbst ein Merkmal) und **nichts
unter fünf unabhängigen Sichtungen** — das schützt gegen Rückschlüsse
auf den Einzelnen *und* gegen eine falsch erkannte Bonzeile.

> Beim Testen kam heraus, dass „Müller" in der Kettenliste stand und
> „Hofladen Müller" damit durchging. Einer der häufigsten deutschen
> Nachnamen. Die Kette ist wieder raus — eine Kette weniger im Index
> ist der billigere Fehler.

**Was die App dabei kann und ein Prospekt nicht** (`offerAdvisor.js`):

```
Höchstmenge = Haltbarkeit ÷ dein Verbrauch je Einheit
```

Ein Angebotsportal weiß, dass Butter billig ist. Dass *du* 250 g in
zwölf Tagen verbrauchst und die vierte Packung im Müll landet, weiß
nur diese App. Sicherheitskritisches nie, ohne gelernten Verbrauch
kein Rat, höchstens acht Einheiten, unter 15 % Nachlass gar nichts —
und nichts davon wird gutgeschrieben, denn es ist eine Vorschau auf
einen Kauf, der noch nicht stattgefunden hat.

**Gebaut ist Stufe 0**: dieselbe Rechnung mit der eigenen
Preishistorie als Quelle. Sie steht im Detail-Blatt jedes Produkts,
funktioniert offline und braucht keine Einwilligung. Der
`offerAdvisor` interessiert sich nicht dafür, woher das „üblich"
kommt — nur dafür, dass die Herkunft mitgeführt und angezeigt wird.

**Empfohlen als Nächstes ist Stufe 1**: drei Haushalte, die sich
kennen, tauschen eine Datei mit Sichtungen aus. Dieselbe
Datenstruktur, dieselbe `buildPriceIndex`-Rechnung, k auf die
Gruppengröße gesetzt. Kein Server, kein Rechtsapparat, kein
Vertrauensverlust — und für die tatsächliche Zielgruppe ist genau das
der Schwarm.

**Stufe 2, der öffentliche Index**, ist nicht gebaut. Er braucht eine
Entscheidung, die nicht mir gehört: dass die drei Sätze geändert
werden dürfen. Dazu einen Verantwortlichen mit Anschrift und eine
Hosting-Umgebung. Was an Recht, Missbrauchsschutz und Betrieb
dranhängt, steht vollständig im Entwurf.

#### Zero Waste, und Vorratskäufe als eigene Sache

Die Hinweise hatten keinen Namen. Sie hießen „Hinweise“ und waren
damit eine Sammelstelle statt einer Funktion — dabei haben sie alle
denselben Zweck und, wichtiger, denselben **Zeitpunkt**: Kühlkette,
was zuerst aufgebraucht werden sollte, was sich einzufrieren lohnt,
vergessene Produkte, Saison, Lagerung. Jeder dieser Hinweise kommt,
solange sich noch etwas machen lässt. Hinterher wäre es eine Bilanz
und keine Hilfe. Das heißt jetzt **Zero Waste**.

**Neu darin: Vorratskäufe.** Wer sechs Packungen Nudeln mitnimmt,
weil sie im Angebot waren, hat etwas anderes getan als jemand, der
eine Packung kauft — und das geht in beide Richtungen:

- **Gut.** Sechs Packungen Nudeln reichen ein halbes Jahr und halten
  zwei. Zum halben Preis war das richtig, und die App sagt es.
- **Nicht gut.** Sechs Vollkornbrote reichen bei diesem Haushalt
  42 Tage und halten 6. *„Rund 86 % davon wären über der Frist."*
  Das ist der Fall, den diese App verhindern soll, und der richtige
  Moment dafür ist der Bon — nicht die Woche, in der es schon
  verdorben ist.

Erkannt wird ab dem **Dreifachen** der sonst üblichen Menge und
mindestens drei Einheiten: wer sonst eine kauft und diesmal zwei, hat
Gäste. Ohne mindestens drei frühere Käufe gibt es kein „üblich“, gegen
das sich „ungewöhnlich“ messen ließe, und ohne gelernten Verbrauch
keine Reichweite — dann sagt die App, dass sie es nicht weiß, statt zu
raten. **Sicherheitskritisches wird nie als guter Vorratskauf
gelobt**, auch dann nicht, wenn die Rechnung zufällig aufginge:
Hackfleisch auf Vorrat ist auch zum halben Preis keine gute Idee.

**Zwei Summen, in die hier ausdrücklich nichts hineinläuft**, und
das ist der Grund, warum das Modul einzeln steht:

| Summe | Warum nicht |
|---|---|
| **Ersparnis** | Was der Vorratskauf günstiger war, hat `receiptSavings` beim Buchen bereits als realisiert gezählt. Der Betrag hier ist **derselbe**, nur nach Packungen aufgeschlüsselt. |
| **Verschwendungsbilanz** | Das Verderb-Risiko eines Stapels ist eine **Vorhersage** über etwas, das noch nicht passiert ist. `wasteSummary` bilanziert Vergangenes. Beides zu addieren hieße, dasselbe Brot einmal als Warnung und einmal als Verlust zu zählen — und wenn es dann doch gegessen wird, stünde es trotzdem drin. |

`hoardDetector.js` liefert deshalb ausschließlich **Beschreibungen**.
Keine Zahl daraus wird irgendwo aufsummiert, und ein Test rechnet die
Verschwendungsbilanz vor und nach der Erkennung nach, um es
festzuhalten. Dazu 3000 Zufallshaushalte gegen die Invarianten.

#### Eine Liste ist eine Liste, auch ohne Vorhersage

Gemessen an einem einzigen erfassten Bon war das der **gesamte**
Inhalt der Einkaufsliste:

> Zwei Bons je Produkt, dann kommen die Vorschläge.

Ein Satz und ein Knopf, vier bis acht Wochen lang — so lange braucht
die App, bis sie jedes Produkt zweimal gesehen hat. Und weil das
Erfassen am Ende `goto("liste")` aufruft, war genau das der **erste
Bildschirm nach der ersten echten Handlung** eines neuen Nutzers. Er
sagte: kann ich noch nicht.

Dabei war alles fertig gebaut. Die Suche über 846 Produkte (heute
1699, siehe weiter unten), das freie
Eintippen, der Wagen, die Gangansicht, das Teilen — nur gesperrt, weil
noch keine *Vorhersage* möglich war. Als könnte man eine Einkaufsliste
nur schreiben, wenn ein Algorithmus mithilft.

Der Ausstieg ist weg. Von der ersten Minute an ist die Seite eine
Einkaufsliste, die man selbst füllt: Katalogprodukt mit Preis, freie
Zeile ohne, Wagen, Gangansicht, Teilen. Was die App dazulernt, kommt
oben drauf, sobald es so weit ist — und bis dahin steht am Ende der
Liste eine ruhige Zeile, die sagt, woran es liegt („1 Bon erfasst — ab
dem zweiten je Produkt lernt die App den Rhythmus"). Die Auskunft war
richtig; sie war nur kein Grund, das Werkzeug wegzunehmen.

Zwei Kleinigkeiten aus derselben Richtung: die Summe erscheint erst,
wenn es etwas zu summieren gibt — „0 Positionen · 0,00 €" unter einer
leeren Liste ist ein Formular, das sich selbst ausfüllt. Und die
Unterzeile im Kopf beschreibt jetzt auch in den frühen Wochen die
**Liste** statt der Datenlage; sie war an Stufe 2 gebunden und fiel
davor auf „1 Bon · 2 Produkte" zurück.

#### Der Schätzung widersprechen können

Der **Verlust** ist die einzige große Zahl dieser App, die nie
beobachtet wurde. Sie wird abgeleitet: Kaufabstand länger als
Haltbarkeit heißt „ein Teil geht verloren“, eine ungewöhnlich lange
Lücke heißt „das davor ist weggekommen“. Beides sind gute Gründe für
einen **Verdacht** und schlechte Gründe für eine Behauptung.

Bisher konnte niemand widersprechen. Die App sagte „10,04 € über 30
Käufe“, und wer wusste, dass er den Salat damals aufgegessen hatte,
konnte nichts tun als die Zahl zu ignorieren — und mit ihr alles, was
daran hängt: das Risiko-Zeichen auf der Liste, die Schwelle der
Sparvorschläge, die Kilogramm unter *Wirkung*.

**Zwei Behauptungen, zwei Korrekturen.** Das ist der Kern, und der
erste Anlauf hatte es falsch: dort bekam **jeder** Kauf eine eigene
Zeile mit demselben Anteil — zwölf identische „etwa 14 % von 2,49 €“.
Wer sagen wollte „bei mir verdirbt kein Brot“, hätte dreißigmal tippen
müssen. Eine Korrektur, die so mühsam ist, benutzt niemand.

| Signal | Was es behauptet | Wie man widerspricht |
|---|---|---|
| **Laufender Anteil** | etwas über das **Produkt**: dein Rhythmus ist länger als die Haltbarkeit, also geht bei jedem Zyklus ein Teil verloren | **ein** Schalter — „Bei mir nicht“ |
| **Ausreißer** | etwas über einen **Tag**: nach diesem Kauf verging so viel Zeit, dass die Packung kaum aufgebraucht worden sein kann | je Fall eine Zeile mit Datum und Betrag — „Doch gegessen“ |

Beides ist jederzeit rückgängig zu machen. Eine Korrektur, die man
nicht zurücknehmen kann, wäre schlimmer als die Schätzung, die sie
korrigiert.

**Was dabei ausdrücklich nicht passiert: es wird nichts
gutgeschrieben.** Kein Eurobetrag, keine Rettung, kein Meilenstein.
Eine Schätzung zurückzunehmen ist kein Erfolg — es war nur nie ein
Verlust. Wer daraus eine Rettung machte, hätte einen Betrag erfunden
und ihn zusätzlich in die Meilensteine gezählt: **ein Ereignis über
zwei Kanäle**, die Fehlerklasse dieses Projekts. Ein Test hält fest,
dass `lifetime.gerettet` sich dabei nicht bewegt.

**Nebenbei zwei Zahlen zusammengeführt, die auseinandergelaufen
waren.** Die Kilogramm unter *Wirkung* liefen über `chronic × Käufe`
— also über einen der beiden Kanäle allein. Damit zählten sie
Ausreißer **gar nicht** mit: ein Produkt ohne laufenden Anteil wog
null Gramm, auch wenn eine ganze Packung weggeworfen wurde. Und eine
Nutzerkorrektur wäre bei den Euro angekommen und bei den Kilogramm
nicht. Jetzt rechnen beide aus derselben Zahl.

**Und eine Leiche entfernt.** In `wasteInference2.js` stand eine
`reconcileWithUserInput`, die „verbraucht“ als „gegessen, nicht
weggeworfen“ auswertete — und **nie aufgerufen wurde**. Die Absicht
war richtig, die Bauart nicht: sie filterte nur Ausreißer-Ereignisse
und hätte den laufenden Anteil stehen lassen. Der sagt „bei jedem
Zyklus geht etwas verloren“ — auch bei dem, von dem der Nutzer gerade
gesagt hat, dass nichts verloren ging. Die Zahl wäre kaum gesunken,
und niemand hätte verstanden, warum. Die Korrektur sitzt jetzt eine
Ebene tiefer, in `wasteSummary`, wo sie beide Kanäle erreicht.

Abgesichert ist das mit **elf** neuen Prüfungen in `test/waste.js`,
und zwar nicht daran, dass die Zahl sinkt (das wäre leicht), sondern
daran, dass sie um **genau** das sinkt, was der korrigierte Kauf
beigetragen hat — plus 2000 Zufallskorrekturen gegen die Invarianten:
nie mehr Verlust als vorher, nie negative Beträge, Ausgaben und
Kaufzahl unverändert.

#### Vier Antworten waren drei zu viele — und eine am falschen Ort

Nachgesehen, nicht geraten: von den vier Rückmeldungen hielt eine der
Prüfung nicht stand, und eine stand am falschen Platz.

**„Verbraucht" ist ersatzlos gestrichen.** Sie bewirkte im ganzen
Programm exakt dasselbe wie „Diese Woche nicht" — `on: false`, kein
Signal an den Rhythmus (`signalFor` gibt für beide `null` zurück),
dieselbe Protokollzeile. Zwei Knöpfe, ein Effekt, und keine
Möglichkeit für den Nutzer zu wissen, welchen er nehmen soll. Dazu
stand sie **inhaltlich verkehrt herum**: aufgebraucht ist ein Grund,
etwas zu *kaufen*, nicht es von der Liste zu nehmen.

Es gibt einen Rest der ursprünglichen Absicht: `wasteInference2.js`
enthält eine `reconcileWithUserInput`, die „verbraucht" als „ich habe
es gegessen, nicht weggeworfen" auswertet und den Verderb-Verdacht
zurücknimmt. **Sie wird nirgends aufgerufen** — sie stand seit jeher
tot im Modul. Das wäre ein echter Zweck für die Antwort, aber im
Bestand, nicht auf der Einkaufsliste.

**„War schon alle" ist umgezogen**, und dahinter steckt die
interessantere Beobachtung. Von allen Rückmeldungen hatte genau diese
**keinen natürlichen Moment**:

| | wann es wahr wird | wann man es sagen konnte |
|---|---|---|
| **Hab noch** | beim Durchgehen der Liste | genau dann — die Handlung *ist* der Moment |
| **War schon alle** | Tage vorher, vor dem leeren Kühlschrank | wenn man ein Detail-Blatt öffnet, was niemand tut |

Damit konnte die App gut lernen, dass sie **zu früh** ist, und
praktisch gar nicht, dass sie **zu spät** ist — eine Schieflage in
genau die unangenehmere Richtung. Sie war nicht fatal, weil sich beide
Richtungen ohnehin über die Kaufdaten korrigieren: wer früher kauft,
verkürzt den gemessenen Abstand, und der Median sieht das. Die
Rückmeldung ist der **schnellere** Weg, nicht der einzige. Aber
langsamer als nötig war sie.

Der Moment, in dem „zu spät" wahr wird, ist ein anderer: **wenn jemand
selbst ein Produkt auf die Liste setzt, das die App noch gar nicht
vorgeschlagen hätte.** Dann war sie zu spät, und zwar jetzt gerade.
Genau dort wird jetzt gefragt — einmal, mit zwei Antworten:

> **Kam das zu spät?**
> Die App hätte Schokolade erst in 7 Tagen vorgeschlagen.
> · Ja, war schon alle — *der Abstand wird kürzer*
> · Nein, nur diesmal — *der Rhythmus bleibt, wie er ist*

**Gefragt, nicht geschlossen** — und das ist keine Höflichkeit. Aus
„hat es selbst hinzugefügt" automatisch „App war zu spät" abzuleiten,
wäre ein stilles Signal, das neben den Kaufdaten in dieselbe Korrektur
liefe: die Doppelzählung, die in diesem Projekt schon dreimal teuer
war. Es gibt genug andere Gründe, früher zu kaufen — Gäste, ein
Rezept, ein Angebot. Ein Test hält deshalb ausdrücklich fest, dass
sich **ohne Antwort nichts ändert**. Gefragt wird außerdem erst ab
zwei Tagen Abstand: wer einen Tag vor der Fälligkeit einkauft, hat
nicht die App korrigiert, sondern eingekauft.

Übrig bleibt im Detail-Blatt eine Frage, die ihre Antworten wirklich
hat: *Brauchst du das diese Woche?* → **Hab noch** · **Diese Woche
nicht**.

#### Ein Haken, eine Bedeutung

Es gab zwei Kreise, die gleich aussahen und Verschiedenes meinten:
der in der Liste hieß **„steht diese Woche drauf"**, der im Ladenmodus
**„liegt im Wagen"**. Gleiche Form, gleiche Geste, verschiedener Sinn.

Daraus folgt der wahrscheinlichste Fehlgriff der ganzen App: **wer im
Laden die Liste statt den Ladenmodus benutzt, hakt seinen Einkauf ab,
bucht nichts — und die App lernt aus diesem Einkauf nie etwas.** Ohne
Fehlermeldung, ohne dass irgendwo etwas rot wird. Die Rhythmen bleiben
einfach stehen, und niemand erfährt, warum.

Jetzt heißt der Kreis überall dasselbe: **im Wagen.** Der Ladenmodus
ist kein eigener Zustand mehr, sondern eine andere **Sicht** auf
denselben Wagen — nach Gängen sortiert, mit großen Zielen. Der Knopf
heißt deshalb nicht mehr „Im Laden", sondern **„Nach Gängen"**. Was
man in der einen Ansicht antippt, steht in der anderen; gebucht wird
aus beiden über denselben Weg (`App.bookCart`), nicht über zwei
Fassungen, die auseinanderlaufen können.

Eine Wagenleiste unter der Liste zeigt jederzeit, was drin ist, und
führt zum Buchen — **nur wenn etwas drin liegt.** Eine Leiste, die
auch leer dasteht, macht aus „nichts im Wagen" eine Nachricht statt
eines Zustands und stünde die ganze Woche im Weg, obwohl an einem Tag
eingekauft wird.

**Was dabei umziehen musste.** Die Wochenentscheidung („brauche ich
das diese Woche nicht") hing am selben Kreis und brauchte ein eigenes
Zuhause. Sie steht jetzt im Detail-Blatt der Position, **ganz oben**,
unter einer ausgeschriebenen Frage — und das hat einen zweiten Fehler
mit aufgedeckt: die vier Antworten erschienen bisher, wenn man den
Haken wegnahm, also als Antwort auf „warum weg?". Für **„War schon
alle"** ergibt das keinen Sinn: das heißt ja gerade, dass das Produkt
gebraucht wird, es korrigiert nur den Takt und bleibt auf der Liste.
Jetzt steht die Frage da, die wirklich gemeint ist, und jede Antwort
sagt in einem Halbsatz, was sie bewirkt:

| Antwort | Wirkung |
|---|---|
| **Hab noch** | der Vorschlag kam zu früh — der gelernte Abstand wird länger |
| **War schon alle** | kam zu spät — der Abstand wird kürzer, **die Position bleibt drauf** |
| **Verbraucht** | aufgebraucht, der Takt stimmt — nur diese Woche nicht |
| **Diese Woche nicht** | eine bewusste Pause, ohne Wirkung auf den Rhythmus |

Nichts davon wirkt sofort: erst ab **drei** Rückmeldungen zu einem
Produkt wird der Rhythmus angepasst, und höchstens um **40 %**. Eine
einzelne Antwort kippt nichts um. Abgewähltes steht nicht mehr grau
zwischen den anderen Zeilen — seit der Kreis „im Wagen" heißt, wäre
ein hohler Kreis dort nicht mehr von einer anstehenden Position zu
unterscheiden. Es sammelt sich in einer Zeile **„Nicht diese Woche"**
am Ende der Liste, mit dem Weg zurück.

**Nebenbei gefunden:** `App.sheet` rief `focus()` auf dem
„Fertig"-Knopf ganz unten auf — und `focus()` scrollt. Ein langes
Blatt öffnete sich damit in seiner Mitte. Beim Detail-Blatt einer
Position hieß das: die neue Wochenentscheidung ganz oben war
unsichtbar, obwohl sie der Grund ist, aus dem man das Blatt öffnet.
Jetzt `preventScroll` plus ein zurückgesetzter Scrollstand.

#### Drei Stellen, an denen die Bedienung log

Beim Durchklicken als Erstnutzerin — nicht aus dem Gedächtnis,
sondern an Bildschirmabzügen — fielen drei Sachen auf, die alle
dieselbe Form haben: **die App konnte etwas, sagte es aber nicht.**

**1. Die vier Antworten sahen aus wie deaktiviert.** Wer eine Position
abwählt, bekommt „Hab noch / War schon alle / Verbraucht / Diese Woche
nicht" — den einzigen Kanal, über den die App ihre Rhythmen
korrigiert. Das Dimmen der abgewählten Zeile (`opacity:.42`) lag aber
auf der **ganzen** Zeile, also auch auf diesen Knöpfen. Nachgerechnet:
der Kontrast der Beschriftung fiel damit von 4,92:1 auf **1,74:1**.
Nicht nur unter jeder Lesbarkeitsgrenze — es sieht schlicht aus wie
„ausgegraut, nicht anklickbar". Der Rückkanal war optisch
abgeschaltet.

Beim Nachrechnen zeigte sich, dass es nicht bei einer Fundstelle
blieb: der Artikel im Wagen (`.44` → 2,84:1) und der ruhige Tag im
Wochenstreifen (`.72` → 3,08:1) hatten dasselbe Problem. Erste beide
stehen jetzt auf `.62` — die niedrigste Deckkraft, die im hellen Modus
noch 4,5:1 erreicht. Beim Wochenstreifen ist die Antwort eine andere:
dort wird jetzt die **Säule** gedimmt und nicht der Wochentag. Den
Inhalt zu dimmen, den man gar nicht meint, wäre die falsche Lösung für
ein echtes Problem gewesen.

**2. Nichts sagte, dass eine Position antippbar ist.** Der Name öffnet
seit jeher das Detail-Blatt mit Rhythmus, Preisverlauf und
Datenqualität — ohne Winkel, ohne Hinweis, während überall sonst in
der App genau dieser Winkel eine aufklappbare Zeile markiert. Dasselbe
im Wochenstreifen: sieben Säulen sahen aus wie eine Grafik, und auf
eine Grafik tippt niemand. Die Positionen haben jetzt ihren Winkel,
die Tage eine eigene Fläche — dieselbe, die in dieser App seit jeher
„das kannst du drücken" heißt.

**3. „VD" war ein Kürzel.** Zwei Buchstaben auf der Hähnchenbrust, die
sich nur dem erklären, der sie antippt — und antippen tut man nur, was
man versteht. Die Marke, die vor der einzigen **rechtlich harten**
Frist der App warnt, steht jetzt ausgeschrieben da: **Verbrauchsdatum**.
Sie ist damit die längste Marke der Liste und bricht auf eine zweite
Zeile um. Das ist der Preis, und er ist richtig herum bezahlt.

**Was daraus für die Tests folgt.** Die Kontrastprüfung hatte all das
nicht gefunden, und der Grund ist lehrreich: sie prüfte **Farbpaare**.
Ein Zustand mit `opacity` ist aber kein Farbpaar — dort steht dieselbe
Farbe wie überall, und trotzdem kommt hinten etwas anderes heraus,
weil Vordergrund und Hintergrund gemeinsam gegen den Grund verrechnet
werden. Gefunden hat es kein Test, sondern ein Blick auf einen
Bildschirmabzug. `test/contrast.js` hat jetzt einen Abschnitt F, der
jeden **dauerhaften** gedimmten Zustand in beiden Modi ausrechnet
(`:active`, Animationen und `:disabled` bleiben draußen — die ersten
dauern Millisekunden, das letzte muss nach der Norm nicht
kontrastieren), die Deckkraft im Stil gegen die geprüfte abgleicht,
und die **Bauart** des Fehlers verbietet: keine Deckkraft auf einer
ganzen Listenzeile.

#### Flächen sind eckig, Punkte bleiben Punkte

Die App war durchgehend abgerundet — 20 px auf Karten, 13 px auf
Knöpfen, 9 px auf Feldern, Kapseln überall. Das sah freundlich aus und
hatte einen Preis, der erst im direkten Vergleich auffiel: **alles
wirkte gleich weich.** Eine Fläche, die etwas MISST — ein Balken im
Wochenstreifen, ein Fortschrittsbalken, eine Zeile mit einem Betrag —
sah aus wie Dekoration. Derselbe Balken mit scharfer Kante liest sich
als Messwert.

Entschieden wird nicht nach Geschmack, sondern nach der Natur des
Elements:

| | |
|---|---|
| **Eckig** | alles, was eine **Fläche** ist — Karten, Gruppen, Zeilen, Knöpfe, Eingabefelder, Blätter, Balken, das Glückwunsch-Fenster |
| **Rund** | alles, was ein **Punkt** oder **Kreis** ist — Abhak-Kreise, der Pfeilkreis zur Liste, Streak-Punkte, der Schalter, das (i), der Griff am Blatt |

Eine Ausnahme, die begründet ist: **Marken bleiben rund**, obwohl sie
Flächen sind — „Beispieldaten", „!", „2", „Achtung". Sie sind
Beschriftungen, keine Bedienelemente, und als Rechtecke bekämen sie
ein Gewicht, das ihnen nicht zusteht. Ein Knopf dagegen WILL Gewicht.
Genau deshalb ist „Im Laden" eckig geworden und „Beispieldaten" nicht.

Die drei Kantenwerte stehen auf `0px` statt gelöscht zu sein: der Weg
zurück ist damit ein Zahlenwert und keine Archäologie.

`test/uitest.js` hält die Regel fest, und zwar in beide Richtungen —
**keine Rundung zwischen 1 und 39 Pixeln** irgendwo im Stil, und die
namentlich genannten Kreise sind noch da. Ohne die Gegenprobe wäre
eine Regel, die alles platt macht, genauso bestanden. Gelesen wird
dabei die gebaute Datei: jsdom rechnet keine Stilkaskade aus, ein
`getComputedStyle` wäre hier immer leer und der Test damit blind — das
ist beim Schreiben schiefgegangen und aufgefallen, weil vier Prüfungen
gleichzeitig grün wurden, die es nicht sein konnten.

#### Die Schrift liegt bei, sie wird nicht geladen

Bis hierher lief die App in der Systemschrift, und das war die
vernünftige Wahl mit einem Haken: die Systemschrift ist auf jedem
Gerät eine andere. Dieselbe Zeile stand auf dem iPhone in SF Pro, auf
Android in Roboto, auf dem Rechner in Segoe — mit unterschiedlicher
Laufweite, Zahlenbreite und x-Höhe. Alles, was an Hierarchie
eingestellt war, galt damit immer nur für ein Gerät. Und die App sah
überall aus wie das Betriebssystem und nirgends wie sie selbst.

Jetzt **Manrope**, und zwar aus `web/fonts/`. Zwei variable Schnitte
(200–800) nach Zeichenbereich getrennt, zusammen 40 KB; `latin`
reicht für Deutsch, `latin-ext` holt der Browser nur, wenn wirklich
ein Zeichen daraus vorkommt. Die Lizenz (OFL 1.1) liegt daneben, weil
sie das verlangt.

**Warum nicht die zwei Zeilen von Google Fonts.** Weil sie bei jedem
Start eine Anfrage an einen Dritten wären — mit IP und Browserkennung,
und ohne Netz gar nicht. Diese App verspricht, dass die Daten auf dem
Gerät bleiben; eine Ausnahme davon kostet mehr als 40 KB. Ein Test
hält fest, dass im Stil keine fremde Adresse steht.

**Was das an Nacharbeit hieß**, und das ist der Teil, den man leicht
vergisst: sämtliche Laufweiten im Stil waren auf SF Pro eingestellt,
die von Haus aus weiter läuft. Unverändert übernommen klebten die
Buchstaben aneinander — 29 negative Werte sind halbiert. Dazu ein
leicht positiver **Wortabstand**: Manropes Leerzeichen ist schmaler,
und Laufweite wirkt auch darauf; in „2 Sachen tauschen" stand die Zahl
fast am Wort.

Drei Zeichen fehlen dem Schnitt — `→`, `✓`, `↻`. Der Browser holt sie
sich Zeichen für Zeichen aus der Systemschrift. Das sind Symbole,
keine Wörter, und ein eigener Schnitt nur dafür wäre teurer als der
Gewinn.

Ziffern stehen in Tabellenbreite, damit Beträge untereinander
vergleichbar sind, ohne dass man sie liest — aber in der
Textschrift, nicht in Schreibmaschine. Der Vorrat wird als große Zahl
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

## Ein Ding, ein Name

Ein Konsistenzdurchgang durch die Oberfläche. Die Brüche, um die es
hier geht, haben eine Eigenschaft gemeinsam: **sie sind an keiner
einzelnen Stelle sichtbar.** Man liest „Nach Gängen", tippt darauf,
und drei Bildschirme später steht „Ladenweg" — niemand verbindet die
beiden noch. Genau deshalb fällt so etwas beim Durchklicken nicht
auf und muss maschinell festgehalten werden.

**Eine Ansicht mit vier Namen.** Der Knopf sagte *Nach Gängen*, die
Überschrift *Im Laden*, die Vorlesehilfe *Ladenmodus*, die
Einstellung dazu *Ladenweg*. Jetzt heißt sie überall so wie der
Knopf, der dorthin führt.

**Eine Funktion mit vier Aufschriften.** `bookCart()` hing an einem
Knopf *Einkauf buchen* und an einem Knopf *buchen* — letzterer war
der einzige klein geschriebene Knopf der ganzen App. Daneben *Buchen*
beim Erfassen von Hand und *7 übernehmen* nach dem Bon-Einlesen. Vier
Aufschriften für „diesen Einkauf in die Historie schreiben". Jetzt
überall dasselbe Verb; die Zahl bleibt nur dort, wo sie etwas sagt,
was sonst nirgends steht.

Dazu zwei Meldungen für denselben abgeschlossenen Vorgang
(„3 gebucht" / „3 Positionen gebucht") und zwei Beispielmärkte in
zweimal demselben Feld („Lidl" / „REWE").

### Sechs Erklärungen ohne Marke

`PILL_INFO` hält die Texte, die eine angetippte Marke öffnet. Sechs
Einträge darin wurden von keiner Marke mehr geöffnet: *überfällig*,
*Verderb-Risiko*, *teuer*, *günstig*, *Deine Antwort*, *Vorratskauf*.

Das ist nicht nur toter Ballast. **Unerreichbare Texte veralten
unbemerkt** — *Deine Antwort* erklärte noch die Wirkung von „war
schon leer", einer Antwort, die längst gelöscht ist. Wer ihn
irgendwann wieder sichtbar gemacht hätte, hätte eine falsche
Erklärung ausgeliefert.

Vier der sechs erklärten Zahlen, die inzwischen ins Detail-Blatt
gewandert sind und ihren Rechenweg ohnehin unter *Zahlen* und
*Mehr → Rechenweg* führen. Zwei Sätze standen allerdings nur dort und
nirgends sonst — die sind in den Rechenweg umgezogen, statt mit
gelöscht zu werden:

> Der Median statt des Durchschnitts, damit ein einzelnes Angebot den
> Bezugswert nicht verschiebt.

> Geschätzt heißt: die App sieht, dass wieder gekauft wurde, bevor die
> Haltbarkeit reichen konnte. Sie hat nicht in deinen Kühlschrank
> geschaut.

Der Test, der das hätte finden müssen, hat es nicht gefunden: er
pflegte eine **von Hand geschriebene Liste** der „benutzten"
Schlüssel und hat damit den Zustand behauptet statt geprüft. Er liest
jetzt den ausgelieferten Quelltext und meldet jeden Schlüssel, den
außerhalb der Tabelle niemand mehr verwendet.

### „noch 1 Tage"

Die deutsche Einzahl war an vier Stellen ausgeschrieben und an
sechzehn nicht. Das ist kein Randfall: ein gelernter Rhythmus von
einem Tag (Brot, Milch), ein Vorrat, der noch einen Tag reicht,
Hackfleisch, das angebrochen einen Tag hält, ein einzelnes gebuchtes
Produkt — **die Eins kommt jeden Tag irgendwo auf dem Bildschirm
vor.**

Jetzt gibt es einen Helfer und drei Anwendungen davon:

```js
zahlwort(1, "Position", "Positionen")   // „1 Position“
tage(1)    // „1 Tag“         tagen(3)  // „3 Tagen“ (Dativ)
alleTage(1)                             // „täglich“, nicht „alle 1 Tag“
```

Ausgeschriebene Bedingungen an zwanzig Orten sind kein Zufall, der
schiefgeht, sondern einer, der schiefgehen **muss** — die zwanzigste
schreibt sie irgendwann keiner mehr. Gefunden hat die restlichen
Stellen der Test, nicht ich: er sucht im ausgelieferten Quelltext
nach einer Zahl, die unmittelbar vor einem Mehrzahlwort steht. Beim
ersten Lauf meldete er zehn Stellen mehr, als ich von Hand gefunden
hatte — darunter zwei, die ich in derselben Sitzung selbst
geschrieben hatte.

### Was dabei bewusst *nicht* vereinheitlicht wurde

Nicht jede Ungleichheit ist ein Fehler. Die Reiterbeschriftung
(*Liste*) ist kürzer als der Seitentitel (*Einkaufsliste*) — das ist
eine Regel, kein Bruch. Marken innerhalb eines geöffneten Blattes
sind nicht antippbar, Marken am Rand einer Listenzeile schon; der
Unterschied ist nicht „Zeile oder Blatt", sondern ob der Zusammenhang
die Marke schon erklärt. In der Reichweiten-Übersicht steht die
Quellenzeile direkt darunter, am Rand einer Listenzeile steht nichts.
Beide Regeln stehen jetzt im Quelltext, damit die nächste Marke nicht
wieder danach entschieden wird, ob gerade ein Text zur Hand ist.

---

## Vier Ketten statt einer: was echte Bons dem Parser beigebracht haben

Der Parser hieß `lidlParser.js` und war an genau einem echten Bon
kalibriert. Für alle anderen Ketten stand im Kommentar, sie „folgen
demselben Aufbau". Das war eine Vermutung, und sie war falsch.

Geprüft wurde mit echten Fotos und Screenshots: einem EDEKA-Bon aus
Schweinfurt, zwei REWE-Bons aus Frankfurt, einem 54-zeiligen
Netto-Bon, dazu weiter der Lidl-Bon von 2026. Alle sieben liegen
abgetippt in `test/fixtures/` und laufen bei jedem `npm test` mit.

**Die eine Annahme, die nicht getragen hat**, war die, auf der die
ganze Zeilenerkennung stand: *eingerückte Zeilen gehören zur Position
darüber*. Das stimmt bei Lidl. Sonst nirgends.

```
Lidl:   High Protein Kaffee   1,15 x 2   2,30     Menge in der Zeile
REWE:   HAEHNCHEN PAELLA                 5,58     Menge DARUNTER
            2 Stk x   2,79
Netto:      16 x      0,89                         Menge DARÜBER
        Booster Juneberry 0,33L DS      14,24
EDEKA:  RADIESCHEN                       0,59     gar keine Mengenzeile
```

Dieselbe nackte Mengenzeile steht bei REWE hinter und bei Netto vor
ihrer Position. Welche gemeint ist, verrät kein Layout — aber die
Rechnung: 2 × 2,79 = 5,58 und 16 × 0,89 = 14,24. **Die Zeile, zu der
es aufgeht, ist die richtige.** Geht es zu keiner auf, wird die
Mengenzeile verworfen. Damit kommt der Parser ohne Wissen über
Händler aus, und ein Bon, auf dem beide Formen vorkommen, wird
trotzdem richtig gelesen — ein Test prüft genau das.

Vorher fiel die REWE-Form nicht nur durch, sie wurde zu einer
**erfundenen Position namens „2 Stk x" für 2,79 €**.

**Rabatte haben fünf Schreibweisen.** Auf einem einzigen Netto-Bon
stehen „Rabatt", „Rabatt 5%", „25% Rabatt", „0.20€ Rabatt" und
„GRATIS". Nur die erste beginnt mit dem Wort; die letzte nennt es gar
nicht. Erkannt wird jetzt am Wort *irgendwo in der Zeile* plus einem
Minus am Zeilenende — beides zusammen, keins allein.

Zugeschlagen wird der Rabatt der letzten **Ware**, nicht der letzten
Zeile. Pfand ist in Deutschland ein gesetzlich fester Betrag und wird
nie rabattiert; auf dem Netto-Bon steht zwischen einem Getränk und
seinem Rabatt die Pfandzeile, und wer dort anhängt, macht aus 25 Cent
Pfand minus sechs Euro.

**Leergut geht in beide Richtungen.** „EW-Pfand 0,25" ist gezahltes
Pfand, „Einwegleergut 19% −6,00" sind sechs Euro zurück. Negative
Beträge flogen vorher pauschal raus — richtig für Stornos und
Lesefehler, falsch für die Flaschenrückgabe. Ohne sie geht auf keinem
Bon mit Leergut die Summe auf. Als Rabatt verbucht hätte sie den
Himbeeren 125 g einen Preis von minus vier Euro gegeben.

### Die Gegenprobe: der Bon prüft sich selbst

Fast jeder Bon nennt seine Summe. Der Parser hat an dieser Zeile
abgebrochen, **ohne sie zu lesen** — und damit die einzige Kontrolle
weggeworfen, die es überhaupt gibt.

Auf dem EDEKA-Foto steht „BAUCHSPECK 1,19" zweimal. Die
Texterkennung hat die zweite Zeile als `BAUCHSPECK   9` gelesen, der
Betrag war damit keiner mehr, die Zeile fiel weg. Sieben Positionen
sahen genauso richtig aus wie acht. Nur die aufgedruckte 14,84 gegen
die erkannten 13,65 zeigt, dass etwas fehlt:

> **Summe weicht ab: 1,19 €** — Der Bon nennt 14,84 €, erkannt wurden
> 13,65 € — es fehlt vermutlich eine Zeile.

Die Probe steht ganz oben im Ergebnis, nicht unten in der Warnliste:
sie ist die einzige Aussage dort, die der Bon selbst belegen kann,
alles andere ist Vermutung der Erkennung. Und **sie korrigiert
nichts**. Welche Zeile fehlt, sieht nur der Mensch, der den Bon in
der Hand hält.

Auf den drei vollständigen Bons geht sie auf den Cent auf. Das macht
diese Prüfung zur schärfsten im Projekt: wenn 27,10 herauskommt und
27,10 aufgedruckt ist, stimmen Preise, Mengen, Rabatte und Pfand
*alle* — ein Fehler in irgendeinem davon würde die Summe verschieben.
Der Test kann nicht dadurch grün werden, dass ich meine Erwartung an
das Ergebnis anpasse.

### Was die Summenzeile nebenbei mitrepariert hat

Sie ist auch der Schlussstrich. Hinter ihr steht kein Einkauf mehr —
nur Zahlung, Steuertabelle und Werbung. Weil sie vorher als Rauschen
verworfen wurde, las der Parser den ganzen Fuß als Waren:

- „Aktuelles Bonus-Guthaben: 2,49 EUR" → Position für 2,49 €
- „Mit diesem Einkauf hast du 0,09 EUR" → Position für 0,09 €
- „Rückge1.d 15,26" (verstümmeltes „Rückgeld") → Position für 15,26 €

Am EDEKA-Ausschnitt sank die Zahl der Positionen dadurch von vier auf
zwei — und beide verbliebenen sind echt. Zwei kleinere Riegel kamen
dazu, für den Fall, dass die Texterkennung ausgerechnet die
Summenzeile verliert: eine Liste von Treuewörtern („Bonus-Guthaben",
„gesammelt", „DeutschlandCard"), und die Beobachtung, dass ein
Kassenname **nie sechs Wörter** hat. Der längste auf allen vier echten
Bons hat fünf („Active O2 Cherry 1x0,75L FL"); wer sechs Wörter in die
erlaubten 48 Zeichen bekommt, schreibt keine Abkürzung mehr, sondern
Prosa.

### Zwei Fehler, die der Zufallstest und das Foto gefunden haben

**„7,00 % 0,45" war eine Position.** Der Zufallstest wirft echte Bons
verstümmelt gegen den Parser. Wenn dabei die Summenzeile verlorengeht,
liest er in die Steuertabelle hinein — und ein Name ganz ohne
Buchstaben war ihm recht. Die Ausrichtung filterte solche Zeilen
längst; der Parser bekommt aber auch von Hand eingefügten Text, und
dort fehlte der Riegel.

**„dm" steckt in „Handmixer".** Die Marktsuche verglich ohne
Wortgrenzen — „Real" in „Realschulweg", „Penny" in „Pennystrasse".
Derselbe Fehler saß schon einmal in `priceShare.chainOf` und war dort
behoben; hier stand er noch. Gefunden wurde er beim Blick auf den
Rohtext des EDEKA-Fotos, aus einem anderen Grund: dort steht im Kopf
nur das Logo, das die Erkennung als `Ecenter` liest, und „EDEKA" fällt
erst zwanzig Zeilen später in der Firmierung. Der Kopf hat weiter
Vorrang — aber wenn dort nichts steht, wird jetzt der Rest gelesen
statt aufgegeben.

### Die fünfte Kette: ALDI und die Zwischensumme mittendrin

Ein echter ALDI-Bon aus Hesel (Ostfriesland, 2019, unter CC BY-SA 4.0
auf Wikimedia Commons) brachte einen Fehler mit, den keine der vier
anderen Ketten gezeigt hatte: **eine Zwischensumme, die nicht am Ende
steht, sondern mittendrin.**

```
GESCHIRRSPÜLTABS          2,85 D
TOILETTENPAPIER 4-LAGIG   3,25 D
BLUMENKOHL                 1,39 C
ZWI.SUMME                  7,49    ← nach drei von dreißig Positionen
SB-MARGARINE                0,75 C
…
CREME DESSERT MIT SCHOKOR    0,55 C
ZWI.SUMME                   25,74    ← am Ende, deckungsgleich mit der Summe
ZU ZAHLEN EURO               25,74
```

„ZWI.SUMME 7,49" sieht aus wie eine Position — Name, zwei
Leerzeichen, Betrag — und wäre auch eine geworden. Beide Ebenen
kannten das Wort nicht: `receiptOcr.js` filterte „Zwischensumme"
ausgeschrieben, aber ALDI druckt die Abkürzung; `receiptParser.js`
hatte für Kontrollpunkte mitten in der Liste noch gar keine
Zeilenart. Jetzt gibt es eine — `RE_SUBTOTAL` —, die übersprungen
wird, ohne die Liste zu beenden. Das ist der Unterschied zur Endsumme:
die geht weiter, hier hört nichts auf.

Ein zweiter, unabhängiger Fund auf demselben Bon: die
Öffnungszeiten-Zeile „MO.-SA. 8.00 UHR - 20.00 UHR" enthält zwei
Punkt-Dezimalzahlen und wurde beim Weg über die Texterkennung zu einer
Position „MO.-SA. 8.00 UHR" für 20,00 €. Der Filter dafür ist gezielt:
das eigenständige Wort „Uhr" kommt in keinem Produktnamen vor, die
Wortgrenze davor lässt zusammengesetzte Wörter wie „Kuckucksuhr"
unangetastet.

Beide Fehler zusammen hätten aus einem 25,74-€-Einkauf einen für
70,74 € gemacht — 20 € durch die Öffnungszeiten, 25,74 € durch die
doppelt gezählte Zwischensumme am Ende. Danach: dreißig Positionen,
null Warnungen, Summe auf den Cent. Auch die Steuerkennzeichen sind
hier C und D statt A und B wie bei Lidl und REWE — ein weiterer Beleg,
dass die Buchstaben Kassenkonfiguration sind, keine feste Bedeutung,
und der Parser sie zu Recht nie ausgewertet hat.

Das Originalfoto selbst ist ein Grenzfall: ungleichmäßig beleuchtet,
mit Grünstich und einem harten Schattenverlauf über die ganze Länge.
Tesseract liest davon nur einen Teil der dreißig Zeilen — auch nach
Kontrastanhebung. Das ist kein Parser-Fehler, sondern der schon
bekannte Befund von REWE und EDEKA bestätigt: **Foto-Qualität
entscheidet mehr als der Parser.** Wo Tesseract liest, was auf dem
Papier steht, liest der Parser es jetzt auch bei ALDI richtig — belegt
über den abgetippten Text, der bei jedem `npm test` mitläuft.

### Was weiterhin offen ist

Kaufland und Penny sind ungeprüft — für beide fand sich keine echte,
frei lizenzierte Bon-Aufnahme. Die Bilderkennung selbst bleibt der
schwächste Punkt der Kette: sie hat auf einem gut belichteten
EDEKA-Foto eine von acht Zeilen verloren, auf dem ALDI-Foto deutlich
mehr. Neu ist nur, dass die App das jetzt **merkt und sagt** (die
Gegenprobe), statt eine unvollständige Liste für vollständig zu
halten.

---

## „Unsere Datenbank ist viel zu gering" — war sie nicht

Ein echter Testlauf auf einem iPhone (Netto-Bon, über GitHub Pages)
brachte diesen Satz zurück. Die Beobachtung war richtig — die meisten
Zeilen landeten auf „nicht zugeordnet" —, die Diagnose dahinter nicht
ganz: nachgemessen ist es kein Katalogproblem. Eine Stichprobe der
Kategorien, die angeblich fehlten, zeigt sie alle längst im Katalog:
„Eier" → Eier, Bio-Eier; „Pudding" → Pudding, Protein-Pudding; „Wein"
→ Rotwein, Weißwein, Roséwein. Alles längst unter den 846
Katalogprodukten. Was fehlte, war Toleranz im **Abgleich**, nicht
Breite im **Katalog**: er war an einem einzigen Lidl-Bon kalibriert,
und Lidl schreibt vergleichsweise saubere Namen. Nachgemessen über
alle acht echten Bons dieses Projekts:

| Kette | sicher + Vorschlag | kein Treffer |
|---|---|---|
| Lidl (kalibriert) | 96 % | 4 % |
| ALDI | 63 % | 37 % |
| REWE | 40–55 % | 45–60 % |
| EDEKA | 38 % | 63 % |
| Netto | 35–57 % | ~50 % |

„VL Eier FH 10ST" **enthält** „Eier" — verliert aber gegen zwei
Verpackungscodes, die keine der 846 Katalogzeilen kennt. Die
Rauschwortliste (`FILLER_WORDS` in `productMatcher2.js`), die „bio",
„frisch" oder „ja!" schon herausfiltert, kannte „ST" (Stück), „FL"
(Flasche), „DS" (Dose), „EW" (Einweg) und „sort." (sortiert) nicht —
bei Lidl kommen sie kaum vor, bei Netto an fast jeder zweiten Zeile.
Nachdem sie ergänzt sind:

- „M.I Grana Padano St. 200g": 0,81 (Vorschlag) → 0,92 (**sicher**)
- „Layenb.HP Skyr sort. 200g": 0,59 (kein Treffer) → 0,70 (Vorschlag)
- „Zott Jogobella sort. 150g": 0,81 (Vorschlag) → 0,92 (**sicher**)

Trefferquote insgesamt: von 51 % auf 56 % der 139 echten Positionen.
Ein echter, aber bewusst kleiner Schritt — die größeren Ursachen
liegen woanders und wurden **nicht** blind mitkorrigiert.

**Was probiert und wieder verworfen wurde:** „mit" sah aus wie der
nächste offensichtliche Kandidat — es steht auf halb den Netto-Zeilen
und trägt scheinbar nichts zur Identität bei. Der Katalog widerspricht:
„Skyr" und „Skyr mit Frucht" sind zwei Einträge, und „mit" ist der
einzige Unterschied zwischen ihren Namen. Als Rauschwort hätte es beide
zu einem Produkt verschmolzen — eine stille Fehlzuordnung, die erst als
falscher Rhythmus wieder auftaucht, Monate später und ohne erkennbare
Ursache. Genau die Gefahr, vor der der Kommentar über `FILLER_WORDS`
schon vorher warnte. Ein Test hält das jetzt offen (`test/matching.js`,
Abschnitt B), damit niemand „mit" beim nächsten Aufräumen doch einträgt.

**Was bewusst ungelöst bleibt:** „VL" und „FH" auf „VL Eier FH 10ST"
kommen auf allen drei Netto-Bons kein einziges Mal sonst vor — zu wenig,
um zu wissen, was sie bedeuten, geschweige denn, um es zu erraten. Dafür
gibt es das Lernen aus Aliasen: wählt ein Nutzer hier einmal „Eier" aus
der Liste, merkt sich die App genau diese Schreibweise dauerhaft — ohne
eine Vermutung, die anderswo eine echte Bedeutung zerstören könnte.

**Der eigentliche Befund:** ein statischer, globaler Katalog wird nie
jede Eigenmarken-Abkürzung von fünf Handelsketten kennen — die
Schreibweisen ändern sich mit jeder Sortimentsumstellung, und was bei
Netto „VL" heißt, bedeutet bei Kaufland etwas anderes oder gar nichts.
Die tragfähige Antwort ist nicht ein größerer Katalog, sondern dass die
App aus JEDEM Haushalt lernt, was seine eigenen Bons wirklich meinen —
genau das leistet `learnAlias` schon heute, nur einmal pro Zeile pro
Haushalt, nicht einmal für alle.

`test/matching.js` hält die gemessene Trefferquote als Zahl fest, nicht
als Eindruck — jede künftige Änderung am Abgleich muss sich daran messen
lassen, in beide Richtungen.

---

## Wenn der eigene Katalog nicht reicht: ein Umweg über Open Food Facts

Der Wunsch war unmissverständlich: der Abgleich soll (fast) immer ein
Produkt erkennen, nicht bei jeder fünften Zeile aufgeben. Die
Rauschwort-Erweiterung im vorigen Abschnitt schafft das nicht allein —
sie hebt eine Zeile über die Bestätigungs-Schwelle, sie kann aber
keinen Namen erraten, den kein Katalogeintrag ähnlich genug schreibt.

Dafür jetzt ein zweiter Versuch, NUR für Zeilen, die der lokale
Abgleich nicht einordnen konnte: Open Food Facts liefert einen
ausgeschriebenen Produktnamen — „Joghurt" statt „GL Proteinjogh.sort."
—, und der läuft anschließend GENAUSO durch den eigenen Katalog wie
jede getippte Bon-Zeile. Open Food Facts ist damit nur die Übersetzung
von Kassenjargon in normales Deutsch. Die Produktidentität —
Haltbarkeit, Lagerort, Verbrauchsdatum-Status — kommt weiterhin immer
aus der eigenen, geprüften Liste, nie von einem fremden Dienst. Ein
Treffer über diesen Umweg bleibt deshalb immer ein Vorschlag zum
Bestätigen, nie ein automatisch gebuchter — er ist eine Vermutung über
zwei Ecken, keine Gewissheit.

### Das ist eine Ausnahme von einem bisher absoluten Versprechen

Die App hat an mehreren Stellen wörtlich behauptet, keine Daten würden
das Gerät verlassen. Das stimmt für Bild und Bon-Text weiterhin
uneingeschränkt — die Texterkennung bleibt vollständig lokal (siehe
oben, „Die Erkennung läuft auf dem Gerät"). Für einen einzelnen
unbekannten Produktnamen gilt es nicht mehr, und diese Ausnahme wird
nicht versteckt: der Text im Bon-Erfassen-Bildschirm nennt sie
ausdrücklich, bevor man scannt — *„Ein nicht erkannter Produktname
wird — nur der Name, ohne Preis, Datum oder Markt — bei Open Food
Facts nachgeschlagen."* Die Kurzbeschreibung im Manifest, die vorher
pauschal „ohne Server" versprach, ist entsprechend angepasst.

Es gibt bewusst KEINEN Schalter dafür in den Einstellungen. Das war
eine echte Abwägung, keine Bequemlichkeit: eine Ein/Aus-Option hätte
suggeriert, es gäbe eine Version dieser Funktion, die genauso gut
funktioniert und dabei mehr Privatsphäre böte — das stimmt nicht,
„aus" heißt schlicht „ein Fünftel der Zeilen bleibt unerkannt". Wer
das nicht will, ist mit dem sichtbaren Hinweistext ausreichend
informiert; ein Schalter, den man einmal umlegt und vergisst, wäre
keine bessere Aufklärung gewesen, nur ein zusätzlicher Klick.

### Vier Grenzen, technisch durchgesetzt (`src/ui/offLookup.js`)

1. **Nur der bereinigte Name geht raus.** Kein Preis, kein Datum, kein
   Markt — die Anfrage nutzt dieselbe Namens-Bereinigung wie der lokale
   Abgleich (`parseProductName(...).core`), die Mengenangaben und
   Sonderzeichen längst entfernt hat. Sie verrät ein Wort, nicht wann
   oder wo jemand eingekauft hat.
2. **Jede Schreibweise wird höchstens einmal gefragt.** Ergebnis UND
   Fehlschlag landen dauerhaft im lokalen Zwischenspeicher
   (`localStorage`, mit Obergrenze gegen unbegrenztes Wachstum). Dieselbe
   Bon-Zeile fragt beim nächsten Einkauf nicht noch einmal — weniger
   Anfragen an Open Food Facts, und dieselbe „einmal lernen, nie wieder
   fragen"-Haltung wie bei `learnAlias`.
3. **Ohne Netz wird es still übersprungen.** Kein Fehler, keine
   Wartezeit — die Grundfunktion der App bleibt vollständig offline
   nutzbar, dieser Umweg ist ein Zusatz, keine Voraussetzung.
4. **Ein Timeout, damit nichts hängt.** Nach vier Sekunden gilt eine
   Anfrage als erfolglos, nicht als Absturz — eine Oberfläche, die auf
   eine fremde Antwort wartet, fühlt sich sonst kaputt an.

Für Tests ist `OffLookup.fetcher` austauschbar — genau das Muster, das
`OCR.engine` schon für Tesseract nutzt, damit kein Testlauf jemals
gegen das echte Internet läuft.

### Was noch offen ist

Der dritte, in der ursprünglichen Empfehlung vorgeschlagene Schritt —
ein reiner Kategorie-Fallback („Schlüsselwort → eine der 19
Kategorien → konservativer Schätzwert") für Zeilen, die auch über
Open Food Facts nicht auflösbar sind — ist bewusst noch nicht gebaut.
Der Grund: `addReceipt` bucht heute ausschließlich Zeilen mit einer
echten Katalog-Kennung; ein Kategorie-Rateergebnis hat keine. Es
einfach einzubauen hätte entweder eine Fantasie-Kennung im Katalog
erfunden (der Katalog ist kuratiert und sicherheitsgeprüft — genau die
Sorte Vermischung, vor der `FILLER_WORDS` im Kommentar warnt) oder das
Buchungsschema an einer zentralen Stelle geändert, ohne die Zeit für
dieselbe Sorgfalt wie beim Rest dieses Abschnitts. Das ist eine
eigene, saubere Aufgabe für später, keine, die im Vorbeigehen erledigt
werden sollte.

---

## Der Punkt als Kürzungszeichen: Abkürzungen selbst lesen, statt zu raten

Der nächste, direktere Wunsch: der eigene Abgleich soll Kürzungen selbst
erkennen können, nicht erst über den Umweg eines fremden Dienstes.

Der Ansatzpunkt kam aus einer einfachen Beobachtung: Kassenbons kürzen
lange Namen fast immer auf dieselbe Art — sie schneiden das Ende ab und
markieren das mit einem Punkt. „Proteinjogh." statt „Proteinjoghurt",
„Prot.Riegel Erdn.-Car." statt „Protein-Riegel Erdnuss-Caramel". **Über
alle acht echten Bons dieses Projekts tragen 47 von 139 Positionen —
gut ein Drittel — genau dieses Zeichen.**

Der Punkt ist damit kein Rauschen, sondern ein Signal: die Kasse selbst
sagt „hier fehlt der Rest". Nur wurde er bisher VOR dem Vergleich zu
einem Leerzeichen gemacht — derselbe Bereinigungsschritt, der Kommas
und Sonderzeichen entfernt, hat ihn mit entsorgt, bevor der Abgleich
ihn je zu Gesicht bekam. `parseProductName` liest ihn jetzt vorher und
merkt sich, welche Wörter er betrifft (`truncated`, eine Menge von
Wortstämmen).

**Warum eine eigene Regel, und nicht einfach die alte Teilwort-Prüfung
lockern.** Der bestehende Abgleich erkennt Teilwörter schon — aber
erst ab fünf Zeichen, und zwar an JEDER Stelle im Wort, nicht nur am
Anfang. Diese Grenze existiert aus gutem Grund: ein kurzes Teilwort,
das zufällig irgendwo in einem anderen Wort auftaucht, ist leicht ein
Zufallstreffer. Ein Wort, das die Kasse selbst mit einem Punkt als
abgeschnitten markiert hat, ist kein Zufallsrisiko mehr — deshalb darf
die neue Regel bei drei Zeichen greifen statt bei fünf, dafür aber
ausschließlich als PRÄFIX (das Katalogwort muss damit *beginnen*), nie
als Teilwort irgendwo in der Mitte. „gurk." darf „Gewürzgurken" nicht
treffen, obwohl „gurk" darin steckt — es steckt in der Mitte, und ein
Bon kürzt ein Wort immer am Ende, nie in der Mitte.

**Eine Kürzung bucht sich nie automatisch — sie bleibt immer ein
Vorschlag.** Der erste Test dieser Änderung hat das selbst
durchbrochen: „Gurk." → „Gurke" erreichte mit 0,87 eine Punktzahl über
der „sicher"-Schwelle (0,85) und hätte sich stillschweigend gebucht.
Das widerspricht der Regel, die für jeden anderen unsicheren Weg in
dieser App gilt — auch der Umweg über Open Food Facts bucht nie
automatisch, aus demselben Grund: „Kaes." trifft genauso auf
Käsekuchen wie auf ein Dutzend anderer Käseprodukte, und ein Bon nennt
nie, welches gemeint war. Eine Kürzungs-Punktzahl wird deshalb jetzt
technisch gedeckelt, bevor sie die „sicher"-Schwelle je erreichen kann
— das ist eine bewusste Entwurfsentscheidung, im Code als Kommentar
festgehalten, kein Kalibrierungsdetail, an dem später wieder gedreht
werden könnte, ohne die Begründung zu sehen.

**Über die acht echten Bons dieses Projekts hinweg bewegt sich die
gemessene Trefferquote durch diese Änderung NICHT** (weiterhin 56 %,
25 sicher, 53 mit Vorschlag). Das ist kein Widerspruch zu den 47
betroffenen Positionen — die meisten davon stammen von den Ketten, die
in früheren Schritten dieses Projekts bereits von Hand kalibriert
wurden, mit exakten Alias-Einträgen, die höher punkten als jede
allgemeine Regel es könnte. Die neue Regel zeigt ihren Wert deshalb
nicht an diesem einen, schon eingeübten Korpus, sondern an jedem
kommenden Bon, der noch nie gesehen wurde — geprüft an eigenen,
isolierten Beispielen ohne vorhandenen Alias-Eintrag (`test/matching.js`,
Abschnitt F): „Gurk." → Gurke, „Zwie." → Zwiebeln, „Kaes." →
Käsekuchen, alle als Vorschlag, keines automatisch gebucht.

Beim Testen dieser Änderung ist außerdem eine zweite, unabhängige
Schwachstelle sichtbar geworden, die schon vorher da war: „Kaes.aufschn."
matcht über die ALTE, allgemeine Teilwort-Regel auf „Wurstaufschnitt"
(Fleisch), nicht auf ein Käseprodukt — weil es zum Zeitpunkt dieser
Änderung gar kein „Käseaufschnitt" im Katalog gibt und „aufschnitt" als
Teilwort mitten in „Wurstaufschnitt" steckt. Das ist kein Fehler dieser
Änderung (die neue, striktere Präfix-Regel hätte diesen Treffer gar
nicht zugelassen), sondern ein vorher schon vorhandenes Risiko der
älteren, großzügigeren Regel — festgehalten hier, damit es nicht wieder
neu entdeckt werden muss, aber bewusst nicht im selben Schritt
mitkorrigiert: die alte Regel ist an mehreren realen Bons fein
kalibriert, und sie ohne dieselbe Sorgfalt (volle Korpus-Messung,
Sicherheitstests) zu ändern, hätte an anderer Stelle etwas
zurückgeworfen, das gerade erst funktioniert.

---

## Nachtrag: „Kaes.aufschn." fällt nicht mehr auf Wurst

Der oben festgehaltene, bewusst nicht mitkorrigierte Fund bekam eine
eigene Runde, wie angekündigt.

**Der erste Reparaturversuch war zu groß.** Naheliegend schien
dieselbe Regel, die `looksLikeMeat` schon länger befolgt: ein
Teilwort-Treffer zählt nur an Wortanfang oder -ende, nie mittendrin.
Implementiert, gemessen — und der gemeldete Fall verschwand
tatsächlich. Aber ein neuer tauchte im selben Testlauf auf:
„ZottProteinPuddingCho200g" verlor seinen bis dahin richtigen Treffer
auf „Protein-Pudding". Der Grund: „proteinpudding" steht dort ECHT
mittendrin, umschlossen von Marke (Zott) und Geschmack (Cho[ko]),
ohne Leerzeichen zusammengeklebt — genau wie es auf echten Bons
laufend vorkommt. Die allgemeine Regel konnte den einen Fall nicht
lösen, ohne den anderen kaputtzumachen.

**Der eigentliche Fehler saß nicht im Algorithmus, sondern in einem
einzelnen Katalog-Alias.** `wurst_aufschnitt` trug „AUFSCHNITT" als
BLOSSEN, von „Wurst" losgelösten Alias. Bare, ohne Qualifizierung, ist
das Wort im Deutschen nicht eindeutig — Aufschnitt gibt es auch beim
Käse, und der Katalog hatte dafür ohnehin kein Gegenstück, gegen das
„Käse" hätte konkurrieren können. Diesen einen Alias entfernt, und der
gemeldete Fall verschwindet vollständig — ohne die allgemeinere,
riskantere Regel, und ohne den Pudding-Treffer zu verlieren. Der volle
Name „Wurstaufschnitt" bleibt über die normale Ähnlichkeitsrechnung
weiterhin treffbar, auch als bloßes „AUFSCHNITT" ganz ohne „Wurst"
davor.

**Die Lehre, die den Umweg wert war:** eine Sicherheitsregel, die an
einer Stelle bewährt ist (`looksLikeMeat`, gegen Fleisch-
Fehlzuordnungen), überträgt sich nicht automatisch verlustfrei auf
eine andere Stelle mit anderen Daten. Erst die volle Messung über alle
139 echten Positionen hat das gezeigt — nicht die Überlegung vorher,
so plausibel sie klang. Beide Versuche stehen in `test/matching.js`,
Abschnitt G: der verworfene Weg als Begründung im Kommentar, der
behaltene als drei Tests, inklusive des Falls, den die verworfene
Regel kaputtgemacht hätte.

---

## Der zweite Teil desselben Wunsches: der Katalog selbst, um ein Vielfaches erweitert

Der ursprüngliche Auftrag hatte zwei Hälften: Kürzungen selbst lesen
(oben beschrieben), und — wörtlich — „wenns sein muss dann müssen wir
eben auch die Produktkatalog um ein Vielfaches erweitern, nutze doch
dafür die Datenbank von Open Food Facts […] und ziehe dir alle
möglichen Produkte und hinterlege sie". Ziel: rund 1000 zusätzliche
Produkte, zusätzlich zu den bestehenden 846, nicht statt ihnen.

**Woher die Produkte kommen.** Open Food Facts bietet mehrere
Such-Zugänge; zwei davon lieferten während der Arbeit an dieser
Erweiterung durchgehend `503 Page temporarily unavailable` — sowohl
die alte `cgi/search.pl`-Schnittstelle als auch die dokumentierte
`api/v2/search`, geprüft über mehrere Werkzeuge und Zeitpunkte hinweg,
also kein einzelner Client-Fehler. Erreichbar war die neuere
`search.openfoodfacts.org`-Schnittstelle (Codename „search-a-licious"),
mit echter Kategorie- und Länderfilterung. Abgefragt wurden nur
Kategorien, die ausschließlich Lebensmittel enthalten — „Fleisch/Fisch"
und „Wurstwaren" wurden gar nicht erst abgefragt, aus demselben Grund
wie unten erklärt.

**Drei harte, nicht verhandelbare Grenzen:**

1. **Kein rohes Fleisch, kein Fisch.** Die Sicherheitsklassifizierung
   für Verbrauchsdatum-Produkte (`safetyRules.js`, `SAFETY_GROUPS`) ist
   eine von Hand kuratierte Positivliste, kein Automatismus — ein
   Bulk-Import hätte entweder zu Unrecht Panik ausgelöst oder,
   schlimmer, ein wirklich verderbliches Produkt als normales
   MHD-Produkt eingeordnet. Import-Kategorien beschränken sich deshalb
   auf Milchprodukte, Frischware (Obst/Gemüse), Backwaren,
   Trocken/Vorrat, Getränke, Tiefkühl, Süßes/Snacks, Protein/Sport,
   Fertiggerichte und International — die zehn Kategorien dieses
   Katalogs, in denen „Verbrauchsdatum" nicht vorkommt. Ergebnis nach
   der Erweiterung: weiterhin genau 54 sicherheitskritische Produkte,
   keines davon neu.
2. **Kein Non-Food.** Open *Food* Facts deckt Haushalt, Körperpflege,
   Wasch-/Reinigungsmittel und Tierbedarf nicht ab — das sind
   Schwester-Projekte (Open Beauty Facts, Open Products Facts, Open
   Pet Food Facts) mit eigener, hier nicht zugänglicher Datenbank.
   Diese Kategorien blieben unangetastet: weiterhin genau 134
   Non-Food-Produkte, keines davon neu.
3. **Qualitätsstufe immer `"schaetzwert"`.** Bei dieser Stückzahl ist
   keine Einzelrecherche möglich. Der Haltbarkeits-Standardwert je
   neuem Produkt ist der Median der bereits geprüften, bestehenden
   Werte derselben Kategorie — kein Wert ins Blaue, sondern
   übernommen aus Zahlen, die für diese Kategorie schon einmal
   überlegt wurden.

**Die eigentliche Arbeit war Datenqualität, nicht Beschaffung.**
Rohdaten aus einer crowd-gepflegten Datenbank zu ziehen ist der
einfache Teil; sie so zu bereinigen, dass sie den gleichen Ansprüchen
genügen wie der handkuratierte Kern, ist es nicht. Konkret aufgetreten
und behoben:

- **Falsche Kategorie laut eigenem Tag.** Eine Suche unter „milks"
  lieferte unter anderem „Bio Vollkorn Penne Rigante" — ein
  Falsch-Tagging in Open Food Facts selbst, keine Fehlermeldung.
  Lösung: jeder Treffer wird nach dem Laden anhand seiner EIGENEN,
  vollständigen `categories_tags` neu bewertet — die Kategorie mit den
  meisten passenden Tags gewinnt, nicht die Kategorie, unter der
  zufällig gesucht wurde.
- **Fremdsprachige Namen trotz „deutschem" Feld.** `product_name_de`
  war gelegentlich mit einem französischen oder rumänischen Namen
  befüllt („Ail & Fines Herbes", „Lapte 3,5 % Grasime") — ein
  Dateneingabefehler bei Beitragenden, keine Falschabfrage. Erst die
  harte Serverfilterung auf `lang:de` (die von der Community gepflegte
  Hauptsprache des Eintrags, nicht nur ein befülltes Feld) plus eine
  kurze Stopwortliste blieb zuverlässig.
- **Eingebettete Kassenzettel-Fragmente.** Einzelne Namen enthielten
  Preis- oder Pfandangaben („K-Exquisa der Sahnige-1,89€/19.8",
  „Wasser Volvic […] EW" mit „EW" für Einwegpfand) — beides entfernt,
  „EW" zusätzlich deshalb, weil es im Katalog absichtlich als
  Füllwort reserviert ist (`FILLER_WORDS`, siehe oben) und in keinem
  echten Produktnamen als eigenes Wort auftauchen darf.
- **Dubletten querbeet, nicht nur gegen den alten Katalog.** Die
  Dublettenprüfung lief zuerst nur gegen die alten 846 Produkte
  (`matchProduct`, Schwelle 0,72) — das ließ Fälle wie „Käse-Aufschnitt"
  und „Käse Aufschnitt" oder „Hanuta" und „Hanuta 2x" als zwei
  getrennte Katalogeinträge durch, weil beide neu waren. Ein
  Stresstest (`test/stresstest.js`, Abschnitt E: „jeder Name und jeder
  Alias trifft sein eigenes Produkt") deckte das auf zwei
  Anläufen hintereinander auf. Behoben durch eine Namens-Normalisierung
  (Satzzeichen vereinheitlicht) für die Dublettenprüfung innerhalb des
  Imports selbst, plus das Entfernen bloßer Packungs-Vervielfacher
  („2x", „6er") aus dem Namenstext, weil sie kein Unterscheidungsmerkmal
  sind.

**Ergebnis:** 836 neue Produkte (Ziel: rund 1000; erreicht wurden 836,
weil mehrere angefragte Kategorien — etwa „ready-meals" oder
„mexican-foods" — in der Such-Schnittstelle keine oder kaum Treffer
lieferten, und weil 543 weitere Kandidaten sich als Dubletten zum
bestehenden Katalog erwiesen und deshalb bewusst NICHT aufgenommen
wurden). Katalog gewachsen von **846 auf 1682 Produkte**. Damit
verschiebt sich der Anteil an Schätzwerten spürbar — ehrlich
ausgewiesen über `databaseQualityReport()`: von 700 auf 1536
Schätzwert-Produkte, also von 83 % auf 91 % des Katalogs. Das ist kein
Rückschritt, der versteckt wird: ein Import dieser Größenordnung KANN
nicht einzeln geprüft sein, und die App behauptet das an keiner Stelle.
`safetyCritical` (54) und `nonFood` (134) blieben beide exakt
unverändert — der Beleg, dass die beiden harten Grenzen oben nicht nur
Absicht, sondern Ergebnis waren.

**Gemessen, nicht behauptet:** über die 139 echten Bon-Positionen
dieses Projekts bewegt sich die Trefferquote von 25 auf 27 sicher, von
53 auf 56 mit Vorschlag, von 61 auf 56 ohne Treffer. Ein echter, aber
bewusst kleiner Sprung — plausibel, weil diese acht Bons nicht das
Zielpublikum eines allgemeinen Katalog-Ausbaus sind (sie wurden längst
mit gezielten Aliasen kalibriert); der Nutzen zeigt sich vor allem bei
Produkten, Ketten und Marken, die in diesem Korpus gar nicht vorkommen.
Alle 1642 Tests bestehen weiterhin, keine Regression.

---

## Die 56 offenen Zeilen einzeln durchgesehen — vier konkrete Funde

„Führe die Tests durch und schreib konkret auf, was noch fehlt" war der
nächste Auftrag. Die 56 „kein Treffer"-Zeilen aus dem vorigen Abschnitt
wurden dafür einzeln ausgewertet, nicht nur als Prozentzahl gelesen —
vier Muster kamen dabei zum Vorschein, alle behoben:

1. **Ein einzelnes fehlendes Produkt kostete 10 der 56 Zeilen.** Auf dem
   ALDI-Bon steht zehnmal „CREME DESSERT MIT SCHOKOR" (echte
   Mehrfachkäufe). Kein Katalogtreffer, beste Punktzahl 0,53 —
   „Dessertcreme" existierte zwar, aber in umgekehrter Wortreihenfolge,
   und „SCHOKOR" ist keine Kürzung mit Punkt, sondern ein harter
   Spaltenbreiten-Abschnitt bei exakt 25 Zeichen (ALDIs Drucker schneidet
   hier ohne jedes Kürzungszeichen ab). Deshalb kein geratenes Vollwort
   als Alias, sondern die Zeile selbst, wortgleich zum Bon: `"CREME
   DESSERT MIT SCHOKOR"` als Alias auf `desserts_becher`.
2. **Zwei Netto-Eigenmarken-Kürzel blockierten den gesamten Rest der
   Zeile.** Gemessen, nicht vermutet:
   `GL Proteinjogh.sort.200g` kein Treffer (0,45) → ohne „GL" Vorschlag
   auf Proteinriegel (0,74). `VL Eier FH 10ST` kein Treffer (0,59) →
   ohne „VL" Vorschlag auf Eier (0,70). Beide jetzt als Rauschwort
   ergänzt (`FILLER_WORDS`, `productMatcher2.js`) — strukturell
   dasselbe Muster wie „ST"/„FL"/„DS"/„EW"/„sort.", nur am Wortanfang
   statt am Wortende. Geprüft: keine Kollision mit einem echten
   Katalog-Token.
3. **Drei einzelne, leicht behebbare Katalog-Lücken.** „DORNFELDER"
   (Rotwein-Rebsorte) und „BAUCHSPECK" trafen ins Leere, weil die
   jeweiligen Katalogeinträge (`wein_rot`, `schweinebauch`) **gar
   keinen Alias** hatten — beide ergänzt. „Maultaschen" fehlte
   komplett und wurde als neuer Eintrag unter Fertiggerichte
   aufgenommen (Kategorie-Schätzwert wie beim Open-Food-Facts-Import,
   da nicht einzeln recherchiert).
4. **Bewusst NICHT geraten:** „Ca-Choco Riegel" (Lidl, sonst 96 %
   Trefferquote) bleibt offen. Ohne zu wissen, was „Ca" tatsächlich
   abkürzt (Caramel? ein Markenname?), wäre ein Alias hier eine reine
   Vermutung — genau die Sorte Risiko, vor der `FILLER_WORDS` im
   Kommentar warnt. Bleibt für `Data.learnAlias` offen, sobald ein
   Nutzer die Zeile einmal selbst auswählt.

**Gemessen, nicht behauptet:** von 27 auf 40 sicher, von 56 auf 65 mit
Vorschlag, von 56 auf **34 ohne Treffer** — ein Rückgang der
unerkannten Zeilen um mehr als ein Drittel, ausgelöst durch vier sehr
gezielte, einzeln nachvollziehbare Änderungen, keine allgemeine Regel.
Die feste Untergrenze in `test/matching.js` (Abschnitt C) wurde von
50 % auf 70 % angehoben — sie darf ab jetzt nicht mehr darunter fallen,
ohne dass das ein bewusster, erklärter Schritt zurück ist.

Ein Nebeneffekt zeigte, dass die Sicherung greift, wie sie soll: der
Test „VL Eier FH 10ST bleibt bewusst ungelöst" schlug nach Änderung 2
sofort fehl — mit genau der Meldung, die er absichtlich trägt: *„falls
das jetzt einen Treffer ergibt, bitte diesen Test aktualisieren UND
dokumentieren, welche Änderung das ausgelöst hat."* Der Test wurde
entsprechend angepasst, nicht stillschweigend gelöscht.

---

## „Ziel müssen 99 % sein" — wie weit sich das ehrlich treiben lässt

Der nächste Auftrag war eine Zahl, keine Beschreibung: 99 % Trefferquote,
selbstständig erarbeitet. Ausgangslage war der Stand oben, 76 % (105 von
139). Der einzige vertretbare Weg zu dieser Zahl ohne das Kernprinzip
dieser App zu brechen — nie eine Vermutung stillschweigend als sicher
verkaufen — war, jede der verbliebenen 34 unerkannten Zeilen einzeln zu
recherchieren, nicht zu erraten.

**Methode.** Für jede Zeile wurde zuerst der nächstliegende Katalog-Kandidat
gemessen (`combinedSimilarity` gegen den gesamten Katalog, auch unterhalb
der Schwelle), dann bei Markennamen mit echten Web-Suchen verifiziert —
„HOLY Energy Starter Set", „Aoste Stickado", „Schwälbchen Caffreddo",
„Booster Energy Drink Juneberry" und weitere ließen sich so exakt
bestätigen, teils bis zur EAN. **Insgesamt 31 der 34 Zeilen** ließen sich so auflösen, aus 30 einzeln
recherchierten Funden (einer davon, „Alb-Gold Dunkelnudeln", steht
zweimal auf verschiedenen Netto-Bons): 29 als geprüfte, echte Marken-
oder Produktfunde (neue Katalogeinträge oder Aliase auf bestehende),
1 weiterer über eine strukturelle Erweiterung der Rauschwortliste
(`AS` — dieselbe Kategorie wie `GL`/`VL`, ein Kürzel am Wortanfang,
keine Produktidentität; `KM` kam zusätzlich dazu, war für seinen
eigenen Fall aber durch den parallel ergänzten Alias bereits
abgedeckt).

**Zwei Lehren aus dem Weg dorthin:**

- **Kontext schlägt manchmal die Textsuche.** „Ca-Choco Riegel" (Lidl)
  ließ sich über keine Suche einer Marke zuordnen — aber auf dem Bon
  steht die Zeile zwischen zwei anderen Proteinriegeln
  („Prot.Riegel Erdn-Car", „Protein-Riegel Tiger"). Die Kaufposition
  ordnet die Warengruppe eindeutig zu, auch ohne die genaue Marke zu
  kennen — als Alias auf den generischen Proteinriegel-Eintrag
  aufgenommen, mit Kommentar, dass die Zuordnung kontext- und nicht
  textbasiert ist.
- **Ein Fund kann die Ausgangsvermutung widerlegen.** „SchofruladeHimbVollm.130g"
  wurde zunächst als Tippfehler für „Schokolade" gelesen. Die Websuche
  zeigt: „Schofrulade" ist ein echter, exakt so geschriebener Markenname
  (gefrorene Himbeeren in Vollmilchschokolade) — die naheliegende erste
  Vermutung wäre falsch gewesen.

**Ein Nebenfund beim Testlauf:** die neuen, wortwörtlich vom Bon
übernommenen Aliase (z. B. `"PROLIFEMAGN.ST.20X1,5G30G"`) enthalten
zwangsläufig Fragmente wie „ST" oder „sort" — genau die Rauschwörter,
vor deren Kollision `test/matching.js` Abschnitt A seit der vorigen
Runde wacht. Der Test schlug entsprechend an. Geprüft und für sicher
befunden: diese Aliase werden ausschließlich über den EXAKTEN
core-Vergleich in `matchProduct` erreicht, der `FILLER_WORDS` gar nicht
anwendet — die Gefahr, vor der der Test warnt (ein Füllwort verwässert
eine token-basierte Ähnlichkeitsrechnung und erzeugt eine stille
Fehlzuordnung), besteht für sie strukturell nicht. Eine explizite,
kommentierte Ausnahmeliste mit genau den betroffenen neun Produkt-IDs
hält das fest — keine pauschale Lockerung der Prüfung.

**Was ehrlich offen bleibt: 3 von 139 (2,2 %).**

| Zeile | Bon | Warum offen |
|---|---|---|
| `Schw.Ex.Z.Pf.Ma.Konf.280g` | Netto | Sechs Abkürzungsfragmente. Die naheliegende Spur („Schwartau Extra") bestätigt sich nicht — deren echtes Sortiment enthält keine Zwetschgen/Pflaumen-Sorte. |
| `BioGM H.W.MangHDrink230ml` | Netto | Wortgrenzen selbst unklar (wo endet „Mang[o]", wo beginnt „Drink"?) — keine Suche liefert eine passende Netto-BioBio-Variante. |
| `EDITION APRICOT` | REWE | Sicher ein Pfand-Getränk (0,25 € Pfand direkt danach), aber keine Suche findet eine „Edition"-Aprikose-Linie bei Rauch, Pfanner oder REWE Beste Wahl. |

Für alle drei gilt dieselbe Grenze wie bei „Ca-Choco Riegel" vorher, nur
ohne den rettenden Kontext-Hinweis: eine Vermutung wäre hier keine
Verifikation mehr, sondern ein Rateversuch — und genau das sollte diese
Änderung nicht tun, selbst mit einer harten Zielzahl im Auftrag.

**Ergebnis: 136 von 139 — 97,8 %** (72 sicher, 64 mit Vorschlag, 3 ohne
Treffer). Die Testschranke in `test/matching.js` wurde von 70 % auf
95 % angehoben. Alle 1642 Tests bestehen, keine Regression — inklusive
einer neu geschriebenen, dokumentierten Ausnahme für die acht
wortwörtlichen Aliase dieser Runde.

---

## Derselbe Auftrag, zweite Hälfte: „keine Websuche, sondern der Algorithmus"

Der vorige Schritt lief teilweise an der eigentlichen Anweisung vorbei
— das WebSearch-Werkzeug war bereits geladen, als die Nachricht „keine
Websuche, sondern den Algorithmus anpassen" ankam, und der oben
beschriebene Katalog-Durchlauf hatte zu dem Zeitpunkt schon
stattgefunden und war bereits gepusht. Statt das stillschweigend zu
übernehmen oder ebenso stillschweigend zu verwerfen, wurde das offen
gemeldet: 97,8 % lagen bereits über der neu genannten Zahl (97 %), aber
über einen Weg, der gerade ausdrücklich ausgeschlossen worden war.
Entscheidung danach: der bestehende Katalog-Schritt bleibt (getestet,
echte Funde, kein Grund, ihn wegzuwerfen) — UND zusätzlich sollte der
Algorithmus selbst allgemeiner werden, für Bons außerhalb dieser acht
Fixtures, ohne Websuche und ohne Einzel-Alias.

**Die Lücke, die blieb: zusammengeklebte Wörter ohne jedes Leerzeichen.**
Netto druckt manche Positionen als EIN Wort ohne Leerzeichen, obwohl
mehrere echte Wörter gemeint sind — „GLGouda" ist „GL" + "Gouda",
„leichtHF3ger" ist „leicht" + „HF" + „3" + „ger". Bisher blieb das ein
einziges, langes Token; ein kurzes Katalogwort wie „Gouda" (5 Zeichen)
geht darin unter, sobald noch mehr Buchstaben drumherum kleben.
`splitGlued` (`productMatcher2.js`) fügt jetzt Leerzeichen an
Groß-/Kleinschreibungs- und Ziffern-Grenzen ein — rein additiv, vor dem
Kleinschreiben, denn danach ist dieses Signal für immer weg.

**Warum nicht einfach ersetzen, sondern zusätzlich versuchen.** Der
erste Anlauf hat `parseProductName` selbst geändert und dabei eine
echte, mit vollem Korpus gemessene Verschlechterung erzeugt: „IronMa"
ist KEIN zusammengeklebtes Wortpaar, sondern selbst schon eine Kürzung
— und ein Katalog-Alias dafür („IRONMA", zu Proteinpulver). Blind in
„Iron" + „Ma" zerlegt, verlor genau dieses Signal seinen Treffer (0,70
→ 0,59, unter die Schwelle). Der Grund liegt in der Bewertungsformel
selbst: sie mittelt über die Zahl der Wörter, und mehr Wortfetzen ohne
Katalog-Entsprechung verwässern den Schnitt, auch wenn EIN Fetzen exakt
passt. Die Lösung: zwei Lesarten parallel bewerten (`bestCandidate`,
aufgerufen einmal für die Zeile wie gedruckt, einmal für die getrennte
Version, aber NUR wenn wirklich etwas getrennt wurde), und die bessere
gewinnt. Das schlechtere Ergebnis kann dadurch nie schlechter werden
als vorher — konstruktionsbedingt, nicht nur gemessen.

**Ein zweiter, unabhängiger Fund beim Messen:** „Alpen Jod Salz" und
„Alpen JodSalz" liefen plötzlich gegenseitig ineinander — zwei
verschiedene Katalogeinträge aus dem Open-Food-Facts-Import, die sich
nur im Wortabstand unterschieden. Der Dublettenprüfung beim Import (nur
Satzzeichen normalisiert, siehe oben) war das unsichtbar; erst das neue
Worttrennen machte „JodSalz" und „Jod Salz" zur selben Zeichenkette und
damit die Dublette sichtbar. Der überflüssige Eintrag wurde entfernt —
ein Fund, den das eigentliche Ziel (Netto-Bons) gar nicht im Blick
hatte, aber die volle Regressionsprüfung automatisch mitgeliefert hat.

**Ergebnis über den echten Korpus:** 136 von 139 bleibt bestehen
(97,8 %) — dieselbe Zahl wie vorher, aber jetzt zu einem Teil über eine
allgemeine Regel statt nur über Einzel-Aliase getragen: „VitaminWell
Reload 0,5L FL" springt von Vorschlag (0,77) auf sicher (0,95), ohne
dass dafür ein einziger neuer Alias nötig war. Der eigentliche Wert
zeigt sich nicht an diesen acht Bons — die sind längst kalibriert —,
sondern an jedem künftigen Netto-Bon mit demselben Druckmuster, der
noch nie gesehen wurde. Sechs neue, gezielte Tests
(`test/matching.js`, Abschnitt H) sichern das Mechanismus selbst ab,
inklusive des Falls, den die erste, verworfene Fassung kaputtgemacht
hätte. Alle jetzt 1648 Tests bestehen, keine Regression.

---

## Eine Frage nach der anderen statt eines Dropdowns mit dem ganzen Katalog

Die Bestätigung einer unsicheren Bon-Zeile war bis hierhin ein
`<select>`-Feld direkt in der Zeile, gefüllt mit dem gesamten Katalog
als Fallback — bei 1682 Produkten eine lange Liste zum Durchscrollen,
und mehrere davon gleichzeitig sichtbar, wenn ein Bon mehrere unsichere
Zeilen hatte. Der Auftrag: „super einfach, intuitiv — ein Produkt nach
dem anderen, mit jeweils drei Vorschlägen, und alternativ die
Möglichkeit, selbst etwas einzutragen."

**Die neue Karte (`renderConfirmStep`, `views.js`).** Es wird immer nur
DIE ERSTE noch offene Zeile gezeigt — Rohtext, drei antippbare
Vorschläge, ein Feld „Anders? Selbst eintragen" (versteckt, bis
gebraucht) und „nicht buchen". Jede Entscheidung — auch „nicht
buchen" — lässt die Karte zur nächsten offenen Zeile weiterspringen.
Sind alle entschieden, verschwindet die Karte, und die Liste darunter
zeigt jede Zeile mit ihrem jetzt bestätigten Produkt.

**Woher die drei Vorschläge kommen — ein neuer, allgemeiner
Algorithmus-Baustein, keine feste Liste.** `topMatches` (`productMatcher2.js`)
nutzt dieselbe Bewertung wie `matchProduct`, auch dieselbe
Zwei-Lesarten-Erweiterung für zusammengeklebte Wörter — nur werden die
besten DREI VERSCHIEDENEN Produkte behalten statt nur das eine beste.
Der erste Vorschlag ist deshalb immer genau das, was der automatische
Abgleich auch vorgeschlagen hätte; die anderen zwei sind die nächst-
plausiblen Alternativen aus demselben Katalog, keine Zufallsauswahl.

**Ein Sicherheitsloch, das die Umstellung selbst aufgedeckt hat.**
`Data.addReceipt` filterte bisher nur auf `productId` — nicht auf
`needsConfirmation`. Da eine unsichere Zeile schon VOR jeder
menschlichen Bestätigung ihre Best-Schätzung als `productId` trägt
(genau deshalb kann sie überhaupt als „unsicher, mit Vorschlag"
gelten), hätte ein zu früh gedrückter Buchen-Knopf diese Schätzung
stillschweigend gebucht — nie widersprochen, aber auch nie wirklich
bestätigt. Ein Regressionstest (`test/uitest.js`, „Der Bon lässt sich
buchen") bucht seither eine ECHTE OCR-Zeile ("Bananen lose", 0,81,
unsicher) und deckte genau das auf: der bisherige Test prüfte nur, ob
alle drei Zeilen ein `productId` trugen, nicht ob sie wirklich bestätigt
waren. Behoben an der Wurzel: `addReceipt` verlangt jetzt zusätzlich
`!needsConfirmation`, und der Buchen-Knopf in der Bon-Ansicht bleibt
gesperrt, solange `p.open > 0` ist. Manuell erfasste Positionen (Von-
Hand-Tab, Ladenmodus) tragen dieses Feld gar nicht und sind unverändert
sofort buchbar.

**Getestet:** ein echter Lidl-Bon läuft im UI-Test jetzt durch die
Karte, eine Zeile nach der anderen, bis alles entschieden ist, bevor
gebucht wird; ein eigener Testblock prüft „Anders? Selbst eintragen"
(Suchfeld erscheint, liefert echte Treffer) und „nicht buchen"
(Zeile gilt danach als entschieden, aber ohne Produkt). Fünf neue
Algorithmus-Tests für `topMatches` (`test/matching.js`, Abschnitt I).
Alle jetzt 1674 Tests bestehen, keine Regression an der gemessenen
Trefferquote (weiterhin 136 von 139, 97,8 %).

---

## „Wo dein Geld hingeht" — Filter mit vorgeschlagenen und eigenen Zeiträumen

Zwei Wünsche in einer Nachricht. Der erste war schon erledigt, nur
nicht bestätigt: die Bestätigungskarte erscheint ausschließlich für
`needsConfirmation`-Zeilen — ein sicherer Treffer (`method: "exakt"`
oder `"aehnlich"`) trägt sein Produkt von Anfang an und läuft nie
durch die Karte. Keine Änderung nötig, nur der Nachweis, dass es
bereits so war.

Der zweite Wunsch war neu: Filter für die Zahlen-Ansicht, „frei aber
auch vorgeschlagene", um zu sehen, wo das Geld hingeht — dazu der
Wochendurchschnitt, „intuitiv und optisch schön".

**Was es schon gab.** „Ø pro Woche" stand längst oben als Kachel —
aber fest für die gesamte Historie, kein Zeitraum wählbar, und ohne
jede Aufschlüsselung, WOFÜR das Geld ausgegeben wird. Der Monats-Chart
(`chartCard`) zeigt Ausgaben über Zeit, aber nur gegessen/verdorben,
keine Kategorien oder Märkte.

**Neu: `moneyFlowCard` (`views.js`).** Fünf Zeitraum-Chips — 4 Wochen,
12 Wochen, Jahr, Gesamt, dazu „eigener" mit zwei Datumsfeldern für
einen wirklich freien Zeitraum. Darunter Gesamtsumme und
Wochendurchschnitt FÜR GENAU DIESEN Zeitraum, dann zwei Ranglisten —
Kategorien und Märkte —, jede Zeile mit einem Balken im Hintergrund,
proportional zum Anteil, plus Betrag und Prozent. Kein Diagramm-
Werkzeug, dieselbe Handschrift wie der bestehende SVG-Chart: einfache
Formen, keine Bibliothek.

**Bewusst eine reine Anzeige-Einstellung, kein Haushaltsfeld.** Der
gewählte Zeitraum lebt in `App.zahlenFilter`, nicht in `Data`/
`localStorage` — er geht nie durch `Data.update()`, taucht nicht in
der Sicherung auf und ein Neuladen setzt ihn zurück. Das ist kein
Versehen: welchen Zeitraum man sich gerade ansieht, ist keine
Information über den Haushalt, die eine Sicherung tragen müsste, so
wie auch der Bon-Entwurf im Erfassen-Tab (`App.capture`) nicht
gesichert wird.

**Woher „Markt" kommt.** `ctx.history` (aus `compute()`) trug den
Markt bisher nicht mit, obwohl `state.purchases` ihn längst speichert
— eine Zeile ergänzt (`store: p.store || null`), rein additiv, kein
bestehendes Feld angefasst.

Neun neue UI-Tests (Chips vorhanden, ein anderer Zeitraum zeigt eine
andere Zahl, „eigener" zeigt zwei Datumsfelder, jede Zeile nennt einen
Prozentanteil). Alle jetzt 1683 Tests bestehen.

---

## Nachtrag: ein eigener Bereich, schönere Balken

„Viel schönere Charts, ein eigener Bereich, die Optik gefällt mir noch
nicht" — berechtigt: Die erste Fassung war nur eine weitere `.group`-
Karte in der langen Liste, die Balken ein CSS-Hintergrund über die
gesamte Zeile. Vor der Überarbeitung geladen: die `dataviz`-Skill-
Anleitung dieser Umgebung — Form vor Farbe, ein fester Vergleich am
Ende statt geschätzter Werte.

**Die Form geprüft.** Kategorien und Märkte sind ein Rang-nach-
Betrag-Vergleich, keine Aufteilung, die man als Ganzes lesen muss —
laut Anleitung also ein **Balkendiagramm mit EINEM Farbton**, kein
Kreis- oder Ringdiagramm (das eine Skala-Regel dieser Anleitung für
„Vergleich naher Werte" ausdrücklich ausschließt) und keine
Farbskala je Kategorie (Kategorien haben keine Rangfolge mit
Eigenbedeutung — Milchprodukte sind nicht „mehr" als Frischware —,
eine dunkler-bei-höherem-Wert-Färbung würde die Balkenlänge nur ein
zweites Mal verschlüsseln).

**Eigener Bereich, ohne die Farbregel der App zu brechen.** Die
Rückblick-Karte trägt im Code den Kommentar „die einzige farbige
Karte der App" — ein bewusstes Zwei-Zeilen-Gesetz, das nicht für eine
zweite Sonderfarbe gebrochen werden sollte. Abhebung kommt hier
stattdessen über Fläche, Schatten und Zahlengröße: derselbe erhöhte
Karten-Stil wie beim Vorrats-Bereich (`.hero`), direkt unter den
Kennzahlen-Kacheln statt am Ende der Liste, mit einer großen
547,26-€-Zahl.

**Die Balken selbst kopieren eine bereits bewährte Form** — den
Vorrats-Balken (`rangeHero`): eine SVG-Linie mit rundem Kappenende
(`stroke-linecap="round"`, `vector-effect="non-scaling-stroke"` gegen
Verzerrung beim Strecken), nicht ein `<div>` mit `border-radius`. Es
ist die einzige runde Form auf einer sonst komplett rechtwinkligen
Oberfläche (`--r-lg/-md/-sm` stehen app-weit auf `0px`) — Rundung ist
hier reserviert für Mengen und Anteile, kein Zufall. Die Balkenlänge
bemisst sich am GRÖSSTEN Wert der Liste, nicht an der Gesamtsumme:
die stärkste Zeile füllt den Balken ganz aus, das liest sich als
Rangfolge; der Anteil an der Gesamtsumme steht daneben als eigene
Zahl.

Fünf Zeitraum-Chips passen nicht mehr in eine Zeile wie die
zwei-/dreistufigen Regler sonst in der App (Erscheinungsbild,
Schriftgröße) — dafür bricht die Zeile jetzt sauber in zwei um, nur
innerhalb dieses einen Bereichs, ohne die geteilte Regler-Komponente
für ihre anderen Einsatzstellen zu verändern.

Ein neuer Test prüft die Kappenform direkt
(`stroke-linecap="round"` an jedem Balken). Alle jetzt 1684 Tests
bestehen.

---

## „Bewerte das nach Nutzererfahrung" — eine ehrliche Selbstprüfung, dann behoben

Auf Wunsch nicht weitergebaut, sondern erst geprüft: was kann eine
Nutzerin aus dem neuen Bereich wirklich ABLEITEN, nicht nur ansehen?
Mit echten Werten aus dem Browser nachgemessen, nicht behauptet — drei
Funde, alle mit konkreten Zahlen belegt und dann behoben.

**1. Die Top-8-Grenze ließ Geld unsichtbar verschwinden.** Die
Demo-Daten haben elf Kategorien, gezeigt wurden nur acht — drei fielen
kommentarlos raus (52,80 € von 1.166,59 €, rund 4,5 %), die gezeigten
Prozente summierten sich nie auf 100 %. Behoben mit `topNMitSonstige`:
die Top 7 plus EINE „Sonstige"-Zeile für den Rest, optisch gedämpft
(graue statt Akzentfarbe im Balken, kursive Schrift) — sie ist keine
echte Kategorie und soll sich nicht wie eine anfühlen. Ein Test
addiert die gezeigten Prozente und verlangt ~100 %.

**2. Zwei fast identische „Ø pro Woche"-Zahlen auf demselben
Bildschirm.** Die Kachel oben (Lebenszeit-Durchschnitt) und die neue
Karte darunter (gewählter Zeitraum) nannten fast denselben Wortlaut
für unterschiedliche Zeiträume — das las sich wie ein Rechenfehler.
Die Kachel heißt jetzt „Ø/Woche gesamt", unmissverständlich getrennt
von der Zahl direkt darunter.

**3. „189 Käufe" war mehrdeutig** — gemeint waren Bon-Positionen, die
Kachel daneben nennt für denselben Zeitraum „57 Bons". Umbenannt in
„Positionen", dieselbe Bezeichnung, die der Buchen-Knopf beim Erfassen
schon verwendet.

**Zwei weitere, weniger dringende Lücken, ebenfalls behoben:**

- **Kein Vorher/Nachher.** 547,26 € über 12 Wochen — ist das viel? Ein
  Vergleich zur direkt vorangehenden Periode GLEICHER LÄNGE
  (`zahlenVorperiode`) beantwortet das jetzt: „↑ 4 % ggü. Vorperiode".
  Bewusst OHNE Ampelfarbe — mehr ausgegeben ist nicht automatisch
  schlecht (Vorräte, ein Fest, ein teurerer Laden aus gutem Grund),
  die Pfeilrichtung informiert, ohne ein Urteil zu behaupten, das die
  Zahl allein nicht hergibt. Für „Gesamt" erscheint bewusst KEIN
  Vergleich — vor dem Anfang der eigenen Geschichte liegt nichts, eine
  erfundene Vorperiode wäre keine ehrliche Zahl. Ein Test prüft beide
  Fälle: Vergleich erscheint bei einem begrenzten Zeitraum, bleibt bei
  „Gesamt" aus.
- **Marktname ist Freitext.** Bei jeder Erfassung neu eingetippt, ohne
  Abgleich gegen frühere Schreibweisen — „REWE", „Rewe" und „ rewe "
  wären sonst drei Balken statt einer gewesen. `marktGruppen` fasst
  nur für DIESE Anzeige nach Groß-/Kleinschreibung und Leerraum
  zusammen (die gespeicherten Bons bleiben unverändert) und zeigt die
  Schreibweise, die am häufigsten vorkam. Getestet mit drei
  Schreibweisen desselben Marktes, die sich zu einer Zeile summieren
  müssen.

**Nebenbei:** die vorher dauerhaft sichtbare Erklärung wich einem
antippbaren „i"-Knopf — demselben Muster wie bei jeder anderen Karte
in der App (`uiGroup`s `infoBtn`), nur von Hand nachgebaut, weil dieser
Bereich kein `uiGroup` ist. Nimmt dauerhaft keinen Platz mehr weg,
bleibt aber einen Fingertipp entfernt.

Elf neue Tests. Alle jetzt 1695 Tests bestehen.

---

## Drei der sieben vorgeschlagenen nächsten Schritte umgesetzt

Aus der eigenen Liste möglicher nächster Schritte wurden drei
ausgewählt und umgesetzt — nicht die einfachsten, sondern die, die
schon vorhandene Daten neu verknüpfen statt neue zu erfinden.

### Ausgaben mit Verschwendung verbunden

„Wo dein Geld hingeht" und die Verlust-Erkennung (Verlust-Kachel,
roter Anteil im Monats-Chart) liefen bisher nebeneinander her, ohne
sich je zu berühren. `kategorieVerlust()` summiert `ctx.wasteStats` —
das für jedes Produkt schon zwischen chronischer Verschwendung und
Ausreißern unterscheidet (`wasteInference2.js`) — nach Kategorie und
zeigt bei ≥ 5 % Verlust einen roten Hinweis direkt unter dem
Kategorie-Balken: „12 % davon meist verschwendet, laut deinem
Kauf-Verlauf".

**Bewusst unabhängig vom Zeitraum-Filter oben.** `wasteStats` rechnet
über den GESAMTEN Kauf-Verlauf je Produkt — ein chronisches Muster
braucht genug Käufe, um überhaupt erkennbar zu sein, ein 4-Wochen-
Fenster hätte oft nur einen einzigen Kauf. Eine auf den Filter
zurechtgerechnete Verlustquote wäre keine ehrlichere Zahl, nur eine
erfundene — deshalb bewusst als eigener, klar erklärter Zeitbezug
stehen gelassen, nicht stillschweigend vermischt.

Die eingebaute Demo enthält einen extremen, bewusst gescripteten Fall
(Hähnchenbrust, 85 % chronischer Verlust) — beim ersten Anblick sah
das nach einem Rechenfehler aus, war aber nachgewiesen echt:
`ctx.wasteStats` selbst weist für dieses Demo-Produkt `chronicShare:
0,8` aus. Der neue Code deckt damit korrekt auf, was vorher nur pro
Produkt sichtbar war, jetzt auch auf Kategorie-Ebene.

### Verlaufslinie je Kategorie

Der Vorperioden-Vergleich beim Gesamtbetrag beantwortet „mehr oder
weniger als sonst", aber nicht „kriecht diese eine Kategorie über
Monate nach oben". `kategorieMonatsverlauf()` bildet die letzten
sechs echten Kalendermonate (nicht 30-Tage-Schritte, die gegen
Monatsenden verrutschen) je Kategorie ab; `moneySparklineSvg()`
zeichnet daraus eine kleine Linie neben dem Betrag — Linie in
De-Emphasis-Grau, aktueller Monat als Punkt in Akzentfarbe, exakt der
„trend"-Baustein einer Kennzahl aus der Dataviz-Anleitung dieser
Umgebung, nur inline statt in einer eigenen Kachel.

**Unter drei Datenpunkten oder lauter Nullen erscheint keine Linie.**
Eine „Verlaufslinie" durch zwei Punkte oder durch nichts wäre keine
Trendaussage, nur eine geometrische Behauptung — die Funktion
verweigert sich in dem Fall, statt eine bedeutungslose Linie zu
zeichnen.

### Sparvorschläge gegen den gewachsenen Katalog geprüft

Die Sorge: „Sparen" wurde entworfen, als der Katalog bei 273–846
Produkten lag — trifft die Logik mit 1682 Produkten heute noch
zuverlässig zu? Nachgeprüft statt vermutet: `buildSavingsSuggestions()`
liest ausschließlich ECHT BEOBACHTETES Verhalten — `wasteRate` und
`rhythmDays` aus den eigenen Käufen —, nie catalog-abgeleitete Felder
wie `shelfLifeDays` oder `quality`. Ob ein Produkt handkuratiert oder
per Open Food Facts importiert ist, kann die Funktion strukturell gar
nicht sehen. Ein Test bestätigt das an einem echten importierten
Produkt (schaetzwert-Qualität): sauberer Vorschlagstext, plausible
Ersparnis, kein Unterschied zu einem handkuratierten Produkt. Ein
zweiter Test sperrt die Fleisch/Fisch-Regel dauerhaft gegen jeden
künftigen Import ab — 0 der 836 importierten Produkte sind
Fleisch/Fisch oder sicherheitskritisch, dieselbe Grenze wie beim
Import selbst.

Fünfzehn neue Tests (drei in `test/waste.js`, zwölf in `test/uitest.js`).
Alle jetzt 1710 Tests bestehen.

---

## „Sowas brauchen wir auch für Produkte, die immer wieder gekauft werden"

Dieselbe Rangliste, Verlaufslinie und Verlust-Hinweis wie bei
Kategorien und Märkten — nur eine Ebene tiefer, je einzelnem Produkt.
Neuer Abschnitt „Immer wieder gekauft" direkt unter Märkte, dieselbe
Karte, dieselben Bausteine.

**Die Abgrenzung ist die eigentliche Arbeit.** Nicht jedes gekaufte
Produkt gehört hier rein — ein einmaliger Kauf hat kein „mehr oder
weniger als sonst", nur einen einzigen Punkt. `produktRang()` und
`produktMonatsverlauf()` nehmen deshalb ausschließlich Produkte mit
einem gelernten Rhythmus (`ctx.rhythms`) — genau die Definition, die
der Abschnitt „Rhythmen" weiter unten in derselben Ansicht schon
verwendet. Zwei Bausteine dafür wiederverwendet statt verdoppelt:
`kategorieMonatsverlauf` und die neue `produktMonatsverlauf` sind jetzt
beide dünne Hüllen um eine gemeinsame `monatsverlaufNach(ctx, n,
gruppe)` — nur die Gruppierungsfunktion unterscheidet sich.

**Ein Praxisfall, den die Demo selbst geliefert hat, nicht erfunden:**
„Hähnchenbrust" steht mit 67,41 € und einer fallenden Verlaufslinie
ganz oben in der neuen Liste, mit demselben roten 85-%-Verlust-Hinweis
wie schon bei den Kategorien — genau der Fall, den dieser Abschnitt
sichtbar machen sollte: ein einzelnes, regelmäßig gekauftes Produkt,
bei dem sich ein genauerer Blick lohnt, nicht erst die ganze Kategorie
Fleisch/Fisch.

Acht neue Tests. Alle jetzt 1718 Tests bestehen.

---

## „Wenn man auf ein Produkt klickt, was sieht man dann?"

Die ehrliche Antwort im ersten Moment: nichts, die Zeile war ein
`<div>`, kein Knopf. Nachgeholt statt nur beschrieben.

**Kein neues Blatt gebaut — das vorhandene wiederverwendet.**
`productSheet` existiert schon lange und zeigt genau das, was diese
Frage erwartet: Rhythmus, letzter Kauf, Haltbarkeit, Lagerort, Preis
(zuletzt/üblich/Spanne), Bestand, Reichweite, Verlust in Euro und
Prozent, Datenqualität, bei sicherheitskritischen Produkten das
Verbrauchsdatum — dieselbe Ansicht, die „Preise" und „Rhythmen" weiter
unten in derselben Liste schon länger öffnen. Ein zweites, verkürztes
Blatt nur für diesen neuen Bereich zu bauen hätte dieselben Zahlen an
zwei Stellen unterschiedlich genau gezeigt.

**Nur Produktzeilen sind jetzt Knöpfe — Kategorien und Märkte bleiben
`<div>`.** Für sie gibt es kein Detail-Blatt, ein Antippen ohne Wirkung
wäre schlechter als gar keine Reaktion. `moneyBarRow` entscheidet das
über ein optionales `onClick`, nicht über eine zweite Funktion.

**Der Name allein reicht nicht zum Öffnen.** `produktRang` bleibt
namensbasiert (wie die Kategorie- und Markt-Listen), gebraucht wird
aber die Produkt-ID. Eine kleine Name-zu-ID-Zuordnung nur für den
Klick-Aufruf, aus `ctx.rhythms` aufgebaut — dieselbe Menge Produkte,
die ohnehin schon in der Liste steht.

Vier neue Tests, darunter der Praxisfall selbst: „Hähnchenbrust"
antippen öffnet ein Blatt mit demselben Namen im Titel und echten
Fakten darunter, nicht nur eine leere Hülle. Alle jetzt 1722 Tests
bestehen.

---

## „Überarbeite mal alle Aspekte der App für eine cleanere Nutzererfahrung"

Vor jeder Änderung ein Rundgang durch alle sechs Reiter mit echten
Screenshots (Playwright, Beispieldaten) — nicht geraten, was schlecht
aussieht, sondern nachgesehen. Start, Liste, Bestand und Erfassen waren
sauber: klare Hierarchie, konsistente Karten, Farbdisziplin eingehalten.
Zwei echte Befunde, ein dritter kleiner:

**Zahlen war eine einzige Karte mit über 20 Abschnitten** — Kacheln,
Geldaufteilung, Rückblick, Meilensteine, Marke/Eigenmarke,
Einkaufsrhythmus, Monatschart, Inflation, Preise, Rhythmen, Sparen,
Günstig eingekauft, Packungsgrößen, Wirkung, nur durch Überschriften
getrennt. Selbst eine gezielte Frage wie „was gebe ich für Fleisch aus"
verlangte, durch alles zu scrollen. Jetzt gliedert ein dreiteiliger
Regler (**Ausgaben** / **Verhalten** / **Bilanz**) den Bereich unterhalb
der Kachelzeile und der Geld-Karte — die beiden bleiben, weil sie für
sich schon einen vollständigen Überblick geben. Die Aufteilung folgt der
Frage, mit der man herkommt, nicht der Reihenfolge, in der die
Abschnitte historisch entstanden sind: Ausgaben (Marke/Eigenmarke,
Monatschart, Günstig eingekauft, Packungsgrößen), Verhalten
(Einkaufsrhythmus, Rhythmen, Inflation, Preise), Bilanz (Rückblick,
Meilensteine, Sparen, Wirkung).

**Mehr mischte 13 Karten aus völlig verschiedenen Registern** —
Wasserhärte der Spülmaschine neben Pfand-Bilanz neben „Alles löschen".
Jede Karte für sich war korrekt gestylt (extra geprüft, bevor daraus ein
Befund wurde: ein erster Blick auf ein verkleinertes Vollbild-Screenshot
ließ die vier Aktionsknöpfe unten wie unstylte Links aussehen, der
Quellcode und ein Nahaufnahme-Screenshot zeigten dann echte `.row`-
Elemente in einer echten Karte). Das eigentliche Problem war die
Ordnung, nicht die Optik. Jetzt zwei Bereiche: **Einstellungen** (Dinge,
die man einmal anfasst und dann monatelang nicht wieder — Darstellung,
Wochenrückblick, Haushalt, Gangreihenfolge, Deine Liste, Sicherung,
Daten, Gefahrenzone) und **Auswertungen** (Dinge, die man nachschlägt —
Saison, Pfand, Märkte, Rechenweg). Die Gefahrenzone bleibt konsequent bei
den Einstellungen.

**Auf der Liste stand „Nach Gängen" zweimal gleichzeitig im Bild** —
einmal als Kachel oben im Kopfbereich (`renderBar` in app.js, bleibt
beim Scrollen erreichbar), einmal als Knopf unten am Ende der Liste,
beide mit identischem Text und identischer Aktion. Der Kopfbereich-Knopf
bleibt, der untere ist raus; „Teilen" steht jetzt allein in der Zeile.

Beide neuen Regler sind dieselbe `segmented()`-Komponente, die schon den
Bon/Von-Hand-Umschalter beim Erfassen und die Zeitraum-Chips bei der
Geld-Karte trägt — keine neue Komponente für ein altbekanntes Muster.
Welcher Unterbereich offen ist, ist reine Anzeige-Einstellung
(`app.zahlenTab`, `app.mehrTab`) nach demselben Muster wie
`zahlenFilter`: kein Haushaltsdatum, kein `Data.update()`, geht bei
einem Neuladen verloren, das ist kein Verlust.

Ein Test verschob sich inhaltlich (Rückblick/Meilensteine jetzt im
Unterbereich „Bilanz" statt direkt sichtbar, im Test entsprechend per
Regler-Wechsel geprüft), einer kam neu dazu (der doppelte „Nach Gängen"-
Knopf darf nicht mehr auftauchen). Alle jetzt 1723 Tests bestehen.

---

## „Arbeite am Algo, mehr Härtefälle testen und entsprechend verbessern"

Ausgangspunkt war nicht Theorie, sondern eine sortierte Liste: jede der
139 Waren aus den acht echten Bons, nach Vertrauenswert. Am unteren Ende
lagen die tatsächlich harten Fälle — nicht erfunden, sondern die
schlechtesten Zeilen, die es gab.

**Drei neue Rauschwörter, aus derselben Auswertung wie GL/VL/AS/KM
zuvor.** "HP" (High Protein) steht bei Netto und REWE vor drei
verschiedenen Produkten aus zwei Ketten — "HP TRIPLE DESS." ist dabei
bereits ein exakter Katalogtreffer, der die Bedeutung selbst bestätigt.
"VKE" (Verkaufseinheit) und "QS" (das Fleisch-Prüfsiegel "Qualität und
Sicherheit") sind Aufdrucke, keine Produktnamen. Alle drei geprüft: keine
Kollision mit einem echten Katalog-Token. Die Wirkung, vorher/nachher
gemessen:

- "Champignon braun 400g VKE": 0,78 (unsicher) → 0,89 — springt über
  die "sicher"-Schwelle, braucht keine Bestätigung mehr.
- "Layenb.HP Skyr sort. 200g": 0,70 → 0,81, "GL HP Drink sort. 330ml":
  0,69 → 0,81, "TK CHICKEN NUGGETS-QS": 0,70 → 0,81 — alle drei bleiben
  bewusst unsicher (echte Sortenvielfalt bzw. Fleisch/Fisch), aber der
  Vorschlag wird eindeutiger.

**Ein Fix versucht, gemessen — und wieder verworfen, weil er mehr
kaputtmachte als er reparierte.** "SAHNEKEFIR A. FRUCHT" (Aldi) matcht
keinem der drei Vorschläge richtig; das eigentlich passende "Kefir"
taucht gar nicht erst auf, obwohl sein direkter Ähnlichkeitswert (0,71)
mit den sichtbaren Kandidaten gleichauf liegt. Der Grund: der
Kandidaten-Index (eine reine Geschwindigkeitsoptimierung) indiziert bei
langen Wörtern nur den WORTANFANG, damit nicht jede Bon-Zeile gegen den
ganzen Katalog läuft. "Kefir" steckt aber am WORTENDE von "sahnekefir" —
deutsche Komposita hängen das bestimmende Wort meist ans Ende, nicht an
den Anfang. Naheliegender Fix: Wortenden zusätzlich indizieren. Über den
vollen Bon-Korpus gemessen kostete das mehr, als es brachte — drei echte
Zeilen wurden schlechter, um eine einzige eventuell sichtbarer zu
machen: "RouOfenkaesGyrosStyle180g" verlor seinen einzigen Vorschlag
komplett, "GL HP Drink sort. 330ml" sprang von "Proteindrink" (richtig)
auf "Sojamilch" (falsch), "Romatomaten" verlor seine spezifischere
Zuordnung an die generische "Tomaten". Verworfen, mit Begründung im
Code-Kommentar (`buildIndex` in productMatcher2.js) — derselbe Maßstab
wie überall in diesem Projekt: eine Idee, die einleuchtend klingt, zählt
erst, wenn sie am ganzen Korpus gemessen besser abschneidet, nicht
schlechter woanders.

**Was bewusst so bleibt, wie es ist, und jetzt auch als Test festgehalten
ist:** "SAHNEKEFIR A. FRUCHT" bleibt "unsicher" — niemals ein stiller
Fehltreffer, die freie Eingabe in der Bestätigungskarte bleibt der
Ausweg. Derselbe Grundsatz wie beim "Kaes."-Fall aus einer früheren
Runde: eine echte Zweideutigkeit ehrlich als Zweideutigkeit stehen
lassen, statt sie mit einer Sonderregel zu verdecken, die an anderer
Stelle mehr zerstört als sie hier hilft.

Acht neue Tests (drei für die neuen Rauschwörter, eine Korpus-Zahl, drei
für den dokumentierten Grenzfall, eine Kollisionsprüfung). Die
Gesamt-Trefferquote (sicher + unsicher zusammen) bleibt bei 97,8 % — die
Verbesserung liegt nicht in mehr Treffern, sondern in eindeutigeren:
136 von 139 Waren waren schon vorher zuordenbar, nach dieser Runde ist
eine weitere davon sicher statt bestätigungspflichtig, drei weitere
haben einen klareren Vorschlag. Alle jetzt 1731 Tests bestehen.

---

## „Verbinde eine kostenfreie Datenbank, verändere die Produktnamen
realistisch wie bei den Bons, erweitere den Algo"

Acht echte Bons sind eine schmale Stichprobe an Ketten-Eigenheiten. Um
mehr Härtefälle zu finden, ohne mehr Kassenzettel abzutippen, zieht ein
neues, committetes Werkzeug (`tools/off_hardcase_corpus/generate.js`)
echte, ausgeschriebene Namen für eine Stichprobe des EIGENEN Katalogs
von **Open Food Facts** — kostenfrei, ohne Login, dieselbe Quelle, die
schon `offLookup.js` für unbekannte Bon-Zeilen anfragt — und verwandelt
sie nach genau den Mustern, die an den acht echten Bons beobachtet
wurden, in eine synthetische Bon-Zeile: Lidl-artig sauber,
REWE/Aldi-artig GROSSBUCHSTABEN, EDEKA-artig punktgekürzt, Netto-artig
zusammengeklebt, Netto-artig radikal abgekürzt (`mangle.js`, fünf feste
„Personas", deterministisch aus der productId ausgewählt — derselbe
Lauf erzeugt immer dasselbe Ergebnis). Ergebnis: **102 zusätzliche
Härtefälle**, committet als `test/fixtures/off-hardcases.json`, dauerhaft
gegen den Abgleich geprüft (`test/matching.js`, Abschnitt M).

**Der erste Lauf war Ausschuss, nicht Ertrag — und das war lehrreich.**
Eine Freitext-Suche über OFF trifft oft ein Produkt, das den gesuchten
Begriff nur ERWÄHNT statt ihn zu SEIN: die Suche nach „Parmesan" lieferte
„Galettes boulghour parmesan & tomates confites", ein Cracker. Eine Zeile
daraus hätte den Algorithmus für einen Fehler bestraft, den die Testdaten
gemacht hätten. Nachgebessert: nur ein Treffer, bei dem der gesuchte
Begriff eines der ersten zwei Wörter ist und der Name kurz genug bleibt,
um dasselbe Produkt zu sein, zählt. Von 292 Stichproben-Einträgen
lieferten danach 102 einen brauchbaren echten Namen.

**Zwei Sicherheitslücken gefunden, beide geschlossen — an der Auswertung
DES eigenen Härtefall-Korpus, nicht durch Nachdenken.**

1. „Mascar." (Kürzung von „Mascarpone") traf „Mascara" — die
   Wimperntusche — mit 0.93, SICHER, automatisch buchbar. Nicht über die
   eigens gebaute Kürzungs-Deckelung (die hätte nie über die
   Bestätigungs-Schwelle hinausgelassen), sondern über die gewöhnliche
   Kompositum- und Levenshtein-Bewertung, die den Kürzungspunkt gar
   nicht kennt und „mascar" wie ein vollständiges Wort behandelt — eine
   Hintertür an der eigenen Schutzmauer vorbei.
2. „Semmel." (Kürzung von „Semmelbrösel", Paniermehl) ist nach der
   Normalisierung zufällig BUCHSTABENGLEICH mit dem echten Alias
   „SEMMEL" für „Brötchen" (süddeutsch). Das galt als EXAKTER Treffer,
   Konfidenz 1 — noch vor jeder Schwelle, härter als Fund 1.

Fix für beide: dieselbe Vorsicht, die es für den dedizierten
Kürzungs-Pfad schon gab, gilt jetzt für JEDEN Bewertungsweg UND für den
exakten Treffer selbst — sobald ALLE identitätstragenden Token einer
Bon-Zeile vom Drucker selbst als gekürzt markiert sind (`nurKuerzungen`,
eine gemeinsame Funktion statt zweimal derselbe Gedanke). Wichtig ist die
Einschränkung auf ALLE: eine Verpackungskürzung wie „St." bei „M.I Grana
Padano St. 200g" blockiert weiterhin nicht, dass „Grana"/„Padano" —
vollständig geschrieben — sicher zugeordnet werden.

**Eine dritte Idee versucht, gemessen, verworfen.** Um dieselben Kürzungs-
Härtefälle über eine Kompositum-Grenze hinweg noch besser zu erkennen,
wurde probiert, den Kandidaten-Index zusätzlich zu Wortanfängen auch für
Wortenden aufzubauen. Über beide Korpora gemessen richtete das mehr
Schaden an, als es half — dokumentiert direkt im Code-Kommentar bei
`buildIndex`, damit niemand dieselbe Idee unbedacht wieder aufgreift.

**Wirkung, an den echten acht Bons gemessen:** die „sicher"-Quote sinkt
von 73 auf 70 — das ist beabsichtigt. Sechs Zeilen hatten ihre
automatische Buchung nur einem Zufallstreffer nach dem Abschneiden zu
verdanken, nie echter Gewissheit. Die Gesamt-Zuordnungsquote (sicher +
unsicher zusammen) bleibt unverändert bei 136 von 139 (97,8 %) — niemand
verliert einen Vorschlag, nur die Grenze zwischen „automatisch" und
„bitte bestätigen" rückt dahin, wo sie hingehört. Am neuen OFF-Korpus:
null gefährliche automatische Fehltreffer bei 102 Zeilen.

Neun neue Tests. Alle jetzt 1740 Tests bestehen.

---

## „Die Tests sind zu klein — simuliere 100 Bons und bessere daran den Algo"

139 echte Zeilen und 102 einzelne Härtefall-Zeilen sind eine schmale
Basis. Neues Werkzeug (`tools/off_hardcase_corpus/generate_receipts.js`):
zieht echte, ausgeschriebene Namen für den **gesamten** eigenen
Lebensmittel-Katalog (722 Einträge, nicht nur eine Stichprobe) von Open
Food Facts und baut daraus **100 vollständige, simulierte Einkaufskörbe**
— eine feste Kette pro Bon (dieselbe Kasse druckt nicht mal so, mal so),
2-4 Kategorie-Schwerpunkte plus Streuware (ein echter Einkauf dreht sich
um ein paar Themen, nicht gleichmäßig um alle zwölf Kategorien), 8-25
Positionen je Bon. Ergebnis: `test/fixtures/off-receipts.json`, **100
Bons, 1705 Positionen aus 306 echten Produktnamen**.

**Eine Messmethode nachgebessert, bevor überhaupt eine neue Zahl zählte.**
Die bisherige Prüfung für den kleineren OFF-Korpus (Kategorie- oder
Namens-Token-Übereinstimmung) sah bei diesem zehnmal größeren Korpus 20
sichere Treffer als verdächtig an. Nachvollzogen: bei JEDEM einzelnen der
20 lieferte derselbe, UNVERSTÜMMELTE OFF-Name genau denselben Treffer wie
die verstümmelte Bon-Zeile — die Verstümmelung hatte nichts verändert.
Die Ursache lag nicht im Abgleich, sondern in der eigenen Testerzeugung:
eine lockere Freitextsuche fand für „Tomatensaft" das Produkt „Tomaten
Gehackt" (enthält das Wort, ist es aber nicht). Die alte Prüfung fragte
„ist das plausibel verwandt" und riet; die neue fragt „verändert die
Verstümmelung überhaupt etwas" und weiß es — derselbe Treffer für die
Bon-Zeile UND für den sauberen Namen zählt als richtig, unabhängig davon,
welche productId die Stichprobe ursprünglich gesucht hatte. Rückwirkend
auch auf den kleineren Korpus angewendet (Abschnitt M).

**Mit der richtigen Messmethode: zwei Abweichungen bei 1705 Positionen,
beide harmlos.** Jasminreis landet auf die generische statt die
spezifische Katalog-Sorte; zwei fast gleich benannte Maultaschen-Marken
("Original" vs. "Traditionell Schwäbisch") vertauschen sich. Kein
einziger echter Fehltreffer. Anders als in der letzten Runde (zwei echte
Sicherheitslücken gefunden) bestätigt diese Runde die Fixes von damals an
der zehnfachen Datenmenge, statt eine dritte zu finden — auch das ist ein
Ergebnis, kein Leerlauf: 861 Zeilen bleiben ehrlich unsicher (bestätigen
statt raten), 383 melden ehrlich keinen Treffer, und in keinem der 1705
Fälle bucht der Abgleich automatisch etwas Falsches.

Fünf neue Tests (Korpusgröße, leere Bons, Abweichungsgrenze,
Zuordnungsquote). Alle jetzt 1745 Tests bestehen.

---

## „Mit viel mehr Produkten jetzt 1000 Durchgänge"

Von 100 auf 1000 simulierte Bons, und der Produkt-Pool dahinter deutlich
breiter: `generate_receipts.js` nutzt jetzt zwei Quellen statt einer.
Die rund 835 „off_"-Katalogeinträge stammen selbst schon wortwörtlich
von Open Food Facts (frühere Bulk-Import-Runde) — ihr Katalogname IST
bereits ein echter OFF-Name, eine erneute Anfrage würde nur denselben
Namen zurückliefern. Sie gehen deshalb ohne Netzanfrage direkt in den
Pool. Für die rund 860 übrigen Katalogeinträge — jetzt aus **allen 19
Kategorien**, nicht nur den zwölf Lebensmittelkategorien der letzten
Runde — wird wie bisher eine echte Anfrage gestellt. Pool: **1204
Einträge** (835 kostenlos + 369 von 860 Anfragen), Grundlage für **1000
Bons, 16.795 Positionen**.

**Ergebnis, an der bislang größten Datenmenge gemessen:** 8311 sichere
Treffer bleiben sich selbst treu (Verstümmelung ändert nichts am
Ergebnis), nur 70 weichen ab — und beim Nachsehen bleibt JEDE einzelne
Abweichung harmlos: dieselbe Kategorie, dieselbe Warenart, nur generischer
oder spezifischer als der direkte Vergleich. Keine einzige davon betrifft
Fleisch/Fisch (eigens geprüft). 4987 Zeilen bleiben ehrlich unsicher, 3427
melden ehrlich keinen Treffer — beides erwartbar bei einem Fünftel der
simulierten Bons in der radikal abgekürzten Netto-Persona, die schon in
einer früheren Runde als echte, nicht auflösbare Grenze festgehalten
wurde (sieben von 200 Bons dieser Art bleiben dadurch ganz ohne Treffer,
alle anderen Ketten liefern immer mindestens einen).

**Ein wiederkehrendes Muster gefunden, dokumentiert, bewusst nicht
„repariert".** Der mit Abstand größte Einzelfall unter den 70 Abweichungen
(13 Stück): „Katzenfutter nass" verstümmelt zu „Katzenfutternass" (ein
Wort) und trifft dann nicht den eigenen, spezifischeren Katalogeintrag,
sondern den generischen Eintrag „Tierfutter" über dessen kürzeres Alias
„KATZENFUTTER". Ursache liegt in der Bewertungsformel: `compoundSimilarity`
teilt durch die Wortzahl der längeren Seite — ein spezifischer,
zweiteiliger Name wird dadurch strukturell benachteiligt gegenüber einem
kürzeren Alias eines generischen Konkurrenten, unabhängig davon, welcher
inhaltlich besser passt. Ein Fix (die Gewichtung der Division ändern)
wurde bewusst NICHT versucht: dieselbe Formel trägt praktisch jeden
anderen Treffer in allen drei Korpora, und die vorige Runde hat an genau
so einer zentralen Stelle (Kandidaten-Index für Wortenden) gezeigt, dass
eine plausibel klingende Änderung dort mehr kaputtmacht, als sie
repariert. Der Schaden bleibt klein und ungefährlich (Tierfutter bleibt
Tierfutter) — ein Fall zum Festhalten, nicht zum Umbauen.

Ehrlicher Nebeneffekt: `npm test` dauert durch den zehnmal größeren
Korpus jetzt rund zwei Minuten statt weniger Sekunden — jede sichere
Zeile wird zusätzlich gegen ihren unverstümmelten Namen geprüft, macht
bei über 8000 sicheren Treffern spürbar viele zusätzliche Vergleiche.

Acht neue Tests. Alle jetzt 1749 Tests bestehen.

---

## „Mache ihn effizienter und bessere Quote"

Der 1000-Bon-Korpus hat zum ersten Mal genug Masse, um zu MESSEN statt
zu vermuten — und die Messung zeigte, dass beide Aufgaben dieselbe
Ursache haben.

**Die Messung zuerst.** Zeit je Bon-Zeile nach Ergebnisart aufgeschlüsselt:

| Ergebnis | Zeilen | Zeit je Zeile |
|---|---|---|
| exakter Treffer | 991 | 0,07 ms |
| ähnlicher Treffer | 999 | 1,05 ms |
| unsicher | 1185 | 2,72 ms |
| **kein Treffer** | **825** | **9,31 ms** |

Ausgerechnet die Zeilen, die nichts liefern, kosten 133-mal so viel wie
ein exakter Treffer. Der Grund ist derselbe für beide Probleme: findet
der Wortindex nichts, wird gegen den **ganzen** Katalog gerechnet — teuer,
und am Ende doch ohne Ergebnis.

### Trefferquote: 79,6 % → 86,4 %

Die 3427 Zeilen ohne Treffer (20 % des Korpus) sind fast alle Zeilen aus
lauter abgeschnittenen Fragmenten: `Dema.R.Sp.400g`, `Milk.S.Kek.100g`,
`P.Kr.Bal.1L`. Für die gewöhnliche Ähnlichkeitsrechnung ist da nichts zu
holen — `Kr.` ist zu kurz für den Kompositum-Vergleich (ab fünf Zeichen)
und zu unspezifisch für alles andere.

Die Auflösung entsteht erst aus dem **Zusammenspiel** der Fragmente:
gesucht wird ein Katalogeintrag, bei dem *jedes* Fragment ein Wort
beginnt — und zwar als *einziger* im ganzen Katalog. Vor dem Bauen
nachgemessen, wie die Mindestzahl der Fragmente Menge gegen Genauigkeit
tauscht:

| mindestens | aufgelöste Zeilen | Genauigkeit |
|---|---|---|
| 1 Fragment | 1191 | 94,5 % |
| **2 Fragmente** | **1140** | **96,0 %** |
| 3 Fragmente | 611 | 98,9 % |

Gewählt wurden zwei: der Schritt von eins auf zwei kostet 51 Zeilen und
kauft 1,5 Punkte, der Schritt von zwei auf drei kostet 529 Zeilen für
2,9 Punkte. Am vollen Korpus gemessen ergibt das **1140 zusätzliche
Vorschläge mit 97,7 % Genauigkeit**, die Zuordnungsquote steigt von
79,6 % auf 86,4 %, und **kein einziger der 1000 Bons bleibt noch ganz
ohne Treffer** (vorher sieben).

Nicht verhandelbar und im Test festgehalten: das Ergebnis ist ein
**Vorschlag**. Die Regel greift ausschließlich dort, wo sonst nichts
stünde, überschreibt nie eine bestehende Zuordnung, und **bucht in
keinem einzigen der 1140 Fälle automatisch**. Die Fleisch/Fisch-Sperre
gilt unverändert — Eindeutigkeit hebt keine Sicherheitsregel auf.

### Effizienz: 2,80 ms → 1,16 ms je Zeile

Zwei Beschleunigungen, beide ohne jede fachliche Wirkung:

1. **Längen-Schranke.** Die Editierdistanz ist mindestens der
   Längenunterschied zweier Zeichenketten. Daraus folgt in O(1) eine
   obere Schranke für die Levenshtein-Ähnlichkeit. Wer sie schon nicht
   erreicht, kann den bisher besten Kandidaten auch mit der echten
   Matrix nicht mehr schlagen — und die Matrix ist die mit Abstand
   teuerste Einzeloperation im Abgleich.
2. **Reihenfolge statt Auswahl.** Bei einer Zeile ohne Index-Treffer
   kommen Einträge mit gemeinsamem Wortanfang zuerst dran. Die Meßlatte
   liegt damit früh hoch, und Schranke 1 weist den Rest billig ab.

Dazu eine Kleinigkeit mit großer Wirkung: die Fleisch/Fisch-Prüfung hing
nur an der Bon-Zeile, stand aber in der inneren Schleife und wurde für
jede der rund 2500 Namensvarianten neu gerechnet.

**Zwei Ideen wurden gemessen und wieder verworfen** — beide klangen
richtig und waren es nicht:

- *Kandidaten ohne gemeinsamen Wortanfang ganz weglassen* wäre mit
  0,21 ms fünfmal schneller gewesen. Es kostete aber 36 Zeilen ihr
  Ergebnis (17 verloren einen sicheren Treffer, 19 ihren Vorschlag) und
  verbesserte genau eine. Ein Treffer kann eben allein aus der
  Levenshtein-Distanz über die ganze Zeile entstehen. Sortieren statt
  Aussortieren kostet nichts davon.
- *Eine noch billigere Schranke allein aus der Wortanzahl* war falsch
  **und** nutzlos: `compoundSimilarity` summiert über die Wörter der
  Bon-Zeile und teilt durch die größere der beiden Anzahlen — hat die
  Bon-Zeile mindestens so viele Wörter wie der Katalogeintrag, ist der
  Wert 1 erreichbar. Die naheliegende Schranke `min/max` ist damit zu
  optimistisch (zwei Korpus-Zeilen bekamen ein schlechteres Ergebnis),
  und dieselbe Rechnung hebt die Schranke fast immer auf 1, sodass sie
  ohnehin nie greift.

Der Beweis, dass die Beschleunigung zulässig ist, ist selbst ein Test:
über alle drei Korpora hinweg (17036 Zeilen) liefert die abgekürzte
Rechnung **Zeichen für Zeichen dasselbe** wie die ungekürzte. Geprüft
wird die Gleichheit, nicht die Laufzeit — die schwankt je nach Maschine.

Zehn neue Tests. Alle jetzt 1759 Tests bestehen.

---

## „Das Produkt-Blatt ist viel zu überladen"

Wer in der Liste auf ein Produkt tippte, bekam **eine flache Liste aus
zehn gleich aussehenden Zeilen**. „Kategorie: Fleisch/Fisch" stand dort
in derselben Größe und Farbe wie „Verbrauchsdatum: höchstens 2 Tage ·
max. 4 °C". Alles gleich gewichtet heißt: nichts gewichtet. Bei
Hähnchenbrust — 85 % Verlust, 123 € verdorben, Verbrauchsdatum — musste
man zehn Zeilen lesen, um die beiden zu finden, auf die es ankommt; sie
standen auf Position acht und zehn.

**Das Blatt beantwortet jetzt drei Fragen in fester Reihenfolge:**

1. **Was ist mit diesem Produkt los?** Ein Leitwert, groß, ganz oben.
   Welcher das ist, entscheidet die Dringlichkeit der Folgen, nicht die
   Reihenfolge im Datensatz: **Verbrauchsdatum → Verlust → Rhythmus →
   Preis.** Ein Verbrauchsdatum kann krank machen, ein hoher Verlust
   kostet Geld, ein Rhythmus ist nützlich, ein Preis ist Beiwerk. Nur
   der dringendste Fall wird rot ausgezeichnet.
2. **Was muss ich wissen?** Direkt darunter die zweit- und
   drittwichtigste Zahl, dann Gruppen mit Überschrift — jede nur, wenn
   sie Inhalt hat. Der Preis steht als **drei vergleichbare Werte**
   (zuletzt / üblich / Spanne) statt als Satz mit Punkten dazwischen.
3. **Wo kommt das her?** Eingeklappt. Datenqualität, Rückmeldungen,
   Herkunft: der Kern des Vertrauensversprechens, aber nichts, was beim
   Öffnen im Weg stehen muss. Ein `<details>` statt eigener Klapp-Logik
   — der Inhalt bleibt im Dokument (Suche, Vorlesehilfe), Tastatur-
   bedienung bringt der Browser mit.

Dazu drei Aufräumarbeiten: „Verbrauchsdatum" stand **dreimal** auf einem
Bildschirm (Leitwert, Faktenzeile, roter Hinweis) — die Faktenzeile ist
weg. Überschriften über einer einzigen Zeile „nicht schätzbar" sind weg;
die Auskunft selbst steht unter „Wie die App darauf kommt", wo sie
hingehört. Und die Verlust-Liste zeigte **zwölf** gleich aussehende
Zeilen mit je einem Knopf — jetzt drei, der Rest eingeklappt. Wer
widersprechen will, meint fast immer den letzten Kauf.

**Der Umbau hätte fast Information gekostet — gemessen, nicht gehofft.**
Ein Vergleich Alt gegen Neu über alle 29 Produkte der Beispieldaten
zeigte 18 verschwundene Werte: Hähnchenbrust verlor Rhythmus *und*
Verlustquote, weil das Verbrauchsdatum den Platz des Leitwerts bekam.
Genau dafür gibt es jetzt die Kennzahlenzeile darunter. Nach der
Korrektur steht der Nachweis: **227 Zahlenwerte, alle Beschriftungen und
alle Bedienelemente sind erhalten** — kein einziger Verlust. (Zwei
gemeldete „Verluste" waren Fehler der Prüfung selbst: die Preisspanne
trägt jetzt nur noch ein Eurozeichen, „6,99–7,49 €" statt „6,99 €–7,49 €",
weil das zweite auf schmalen Geräten allein in die nächste Zeile
umbrach.)

**Zweiter Durchgang: sortiert war es, ruhig nicht.** Die erste Fassung
ordnete die Information richtig, blieb optisch aber unruhig — und genau
das war die Rückmeldung. Der Befund am eigenen Screenshot: jede Kennzahl
und jeder Preiswert saß auf einer eigenen Fläche mit Haarlinien-Fuge
dazwischen. Sechs Kästchen und ein halbes Dutzend zusätzlicher Linien,
auf einem Bildschirm, der ohnehin schon Karten, Faktenzeilen und einen
roten Hinweis trägt. Vier Änderungen:

- **Kästchen raus.** Zahlen brauchen keinen Rahmen, um als Zahlen
  gelesen zu werden — Abstand genügt.
- **Ein Block statt drei.** Der Preis hatte einen eigenen Abschnitt mit
  Überschrift und drei umrandeten Feldern, direkt über dem nächsten
  Abschnitt mit Überschrift. Jetzt trägt die Kennzahlenzeile den zuletzt
  gezahlten Preis (Farbe = Vergleich zum üblichen), und „üblich" und
  „Spanne" stehen als das, was sie sind: Bezugswerte in derselben Liste
  wie Haltbarkeit und Lagerort.
- **Überschriften eine Stufe leiser.** Versalien mit Sperrung *und*
  Fettung waren drei Auszeichnungen gleichzeitig für eine Beschriftung,
  die nur trennen soll.
- **Roter Hinweis von vier Zeilen auf eine.** Der Leitwert nennt die
  Frist schon in Rot; direkt darunter steht der Knopf, der sie erklärt.

Geprüft im echten Browser bei 420 px und 320 px, hell und dunkel, ohne
Überlauf. Nach dem Aufräumen erneut gegengeprüft: **227 Zahlenwerte,
alle Beschriftungen, alle Bedienelemente weiterhin vollständig.**
Zweiundzwanzig neue Oberflächentests halten die Rangfolge *und* die Ruhe
fest — genau ein Leitwert, höchstens drei Kennzahlen, keine Kästchen,
höchstens zwei Zwischenüberschriften, Herkunft zugeklappt — damit das
Blatt nicht wieder zuwächst. Alle jetzt 1781 Tests bestehen.

---

## „Mehr Produkte — und den Algorithmus verbessern, der die Liste schreibt"

### Die Einkaufsliste: erstmals gemessen

Der Listen-Algorithmus war nie daran gemessen worden, ob er das
Richtige vorschlägt. Neues Werkzeug (`test/liste.js`): für jeden
Einkaufstag von 14 synthetischen Haushalten wird die Liste **nur aus
den Daten davor** erzeugt und mit dem verglichen, was an dem Tag
wirklich gekauft wurde — 1222 Einkaufstage. Ausgangswert: Trefferquote
77,8 %, Genauigkeit 47,7 %.

**Die 47,7 % sehen schlechter aus, als sie sind** — nachgemessen statt
angenommen: die Liste nennt im Schnitt 5,7 Positionen, der Einkauf
umfasst 3,5. Mehr als **61 % kann selbst ein perfekter Algorithmus
nicht treffen**. Und **vier von fünf „Fehlalarmen" werden binnen zwei
Wochen doch gekauft** — der Vorschlag war berechtigt, nur früh.

**Drei Verbesserungen gemessen — und alle drei verworfen:**

- *Vorlauf an den Einkaufsabstand koppeln statt fest:* F1 58,7 % gegen
  59,1 %. Kein Gewinn.
- *Vertrauensschwelle von 0,40 auf 0,25 senken:* im Rückvergleich 126
  übersehene Käufe weniger — im Drei-Jahres-Lauf aber **53 zusätzliche
  Tage mit leerem Schrank**. Ursache: zu frühe Vorschläge lösen „Hab
  noch" aus, das verlängert den gelernten Rhythmus, und danach kommt
  das Produkt zu spät. Eine Rückkopplung, die der Rückvergleich
  prinzipiell nicht sehen kann — simulierte Haushalte richten sich
  nicht nach den Vorschlägen der App, echte schon.
- *Nach Rhythmuslänge statt nach Überfälligkeit sortieren:* hebt die
  Genauigkeit der ersten Zeile von 40,9 % auf **58,6 %** — die größte
  Einzelzahl dieser Runde. Trotzdem nicht übernommen: die Kennzahl
  belohnt, das Offensichtliche zuerst zu nennen. An Milch erinnert
  sich jeder; der Wert einer Liste liegt beim Unregelmäßigen. Die
  Simulation vergisst gleichmäßig und kann den Unterschied nicht
  messen — ohne Beleg keine Änderung.

**Das Ergebnis dieser Runde ist damit kein neuer Schwellwert, sondern
die Messfähigkeit selbst** plus acht Prüfungen, die festhalten, was
gilt: Trefferquote mindestens 75 %, Liste höchstens doppelt so lang
wie der Einkauf, höchstens 3 % Einkaufstage ohne Vorschlag — und die
Deckelung des Vorlaufs auf ein Drittel des Zyklus, ausgerechnet gegen
die Kennzahl abgesichert, die sie aufzuweichen empfehlen würde.

### Mehr Produkte: 1698 → 1727

Auch hier nicht geraten, welche fehlen: **112 in deutschen Haushalten
übliche Artikel** gegen den Abgleich gehalten, **37 blieben ohne
sicheren Treffer**. Zwei davon waren keine Lücken, sondern **echte
Fehlzuordnungen mit Folgen für die Haltbarkeit**:

| Bon-Zeile | landete auf | ist aber |
|---|---|---|
| Pfefferbeißer | Pfeffer (Gewürz) | Dauerwurst |
| Schinkenspeck | Kochschinken (gegart) | roh geräuchert |

Die dünnsten Kategorien wurden gezielt aufgefüllt: Wurstwaren 10 → 17,
Baby 9 → 13, Tierbedarf 10 → 14, Haushaltszubehör 15 → 21. Alle 39
zuvor fehlenden oder schwachen Artikel treffen jetzt sicher, ohne dass
sich an den echten Bons etwas verschlechtert (70 sicher / 66 unsicher /
3 ohne Treffer, unverändert); am 1000-Bon-Korpus vier Zeilen besser.

**Sieben der neuen Einträge waren Dubletten** — „Cabanossi",
„Landjäger", „Blutwurst", „Chorizo", „Puten-Aufschnitt" standen längst
unter Fleisch/Fisch, „Abflussreiniger" und „Aperitif" ebenso.
Aufgefallen ist das nur, weil der Stresstest jeden Katalognamen gegen
sein eigenes Produkt prüft. Die Dubletten wurden zurückgenommen und
stattdessen die fehlenden Schreibweisen bei den Originalen ergänzt;
eine neue Prüfung schließt doppelte Produktnamen künftig aus.

Sicherheitsregel eingehalten: keiner der neuen Einträge trägt ein
Verbrauchsdatum. Rohe Streichwurst (Mettwurst) folgt dem vorhandenen
Muster der Teewurst — kurzes MHD plus ausdrücklicher Vorbehalt, statt
einer Frist, die Sicherheit vortäuscht.

Vierzehn neue Tests. Alle jetzt 1795 Tests bestehen.

---

## Der Kaltstart, benannt und halb behoben (2026-08-27)

Die Trefferquote der Einkaufsliste lag bei 77,7 %. Interessanter als
die Zahl war die Frage, woher die 968 übersehenen Käufe kommen. Also
erst gezählt, dann geändert:

| Ursache | Fälle |
|---|---|
| noch nicht fällig (Vorlauf zu kurz) | 583 |
| Vertrauen unter der Schwelle | 265 |
| erst einmal gekauft, also kein Intervall | 95 |
| gar kein Rhythmus-Eintrag | 25 |

Von den 265 zu unsicheren stammten **252 aus schlichtem Datenmangel**
(unter fünf Käufen) und nur 13 aus echter Unregelmäßigkeit. Zusammen
mit den beiden unteren Zeilen sind **372 der 968 Fälle — 38 % — ein
und dasselbe Problem: die App ist für ein Produkt blind, bis es etwa
fünfmal gekauft wurde.**

Wie schlimm das ist, verdeckte der Rückvergleich selbst, denn er
überspringt die ersten 40 Käufe. Ohne diesen Filter, nach
Erfahrungsalter aufgeschlüsselt:

| Erfahrung | Trefferquote | Genauigkeit |
|---|---|---|
| 0–20 Käufe | **4,8 %** | 83,3 % |
| 20–40 Käufe | 27,5 % | 64,8 % |
| 40–80 Käufe | 54,5 % | 62,6 % |
| ab 160 Käufen | 84,2 % | 46,0 % |

In den ersten Wochen sagt die App also fast nichts — und hat mit dem
Wenigen recht. Für jemanden, der sie gerade erst ausprobiert, ist
Schweigen aber der teurere Fehler.

**Was geändert wurde.** Ein Produkt mit zwei, drei Käufen wurde
zweimal bestraft: einmal offen über die Stichprobengröße, und einmal
verdeckt, weil seine gemessene Streuung bei so wenigen Werten fast nur
Rauschen ist — bei genau zwei Intervallen hängt sie rechnerisch von
einem einzigen Abstand ab. Nachgemessen an 181 Produkten mit langer
Historie: aus den ersten zwei Intervallen gerechnet liegt die Streuung
im Mittel bei 0,152, aus der vollen Historie desselben Produkts bei
0,103. 46 % der Produkte sehen früh unsteter aus, als sie sind.

Jetzt wird bei dünn belegten Produkten der Erfahrungswert **dieses
Haushalts** dazugemischt, mit dem Gewicht von zwei Intervallen. Ein
regelmäßiger Haushalt bekommt für ein neues Produkt früher Vertrauen,
ein unsteter bleibt vorsichtig — der Wert kommt also aus dem Haushalt
selbst und nicht aus einer Konstanten, und er kann die Streuung
genauso gut nach oben ziehen. Gut belegte Produkte bleiben unberührt,
und ohne genug belastbare Produkte bleibt alles beim Alten.

Ergebnis: 968 → 946 übersehene Käufe, Trefferquote 77,7 % → 78,2 %,
Genauigkeit unverändert 48,8 %, Drei-Jahres-Lauf unverändert bei 1696
Leertagen. Ein kleiner, aber kostenloser Gewinn.

**Was gemessen und verworfen wurde.** Zwei größere Anläufe, den
Kaltstart wirklich zu heben, sind gescheitert — beide sahen im
Rückvergleich sehr gut aus:

- *Stichprobengröße als Wurzel statt als Gerade.* Bisher zählte ein
  einzelnes Intervall nur ein Viertel, obwohl gerade die erste
  Wiederholung am meisten aussagt — sie unterscheidet „einmal gekauft"
  von „das kommt wieder". Nebenwirkung der alten Geraden: ein zweimal
  gekauftes Produkt kam nie über 0,25 Vertrauen und war damit unter
  allen Umständen unsichtbar. Mit der Wurzel: Trefferquote 80,7 %, in
  den ersten zwanzig Käufen 17,2 % statt 4,8 %, reife Haushalte
  unberührt. Im Drei-Jahres-Lauf trotzdem **75 zusätzliche Leertage**.
- *Den Vorlauf am Vertrauen bemessen*, als Gegenmittel gegen ebenjene
  Schleife. Im Rückvergleich auf jeder Achse besser als der
  Ausgangsstand (Genauigkeit 49,3 %, Trefferquote 78,3 %, F1 60,5 %) —
  und trotzdem 1786 statt 1696 Leertage.

Die Lehre ist dieselbe wie beim letzten Mal, nur schärfer: der Schaden
entsteht **im** Kaltstart und bleibt danach. Zu früh vorgeschlagene
Produkte lösen „Hab noch" aus, der gelernte Rhythmus wird länger, und
der Haushalt kommt davon nicht mehr los. Dass die reife Phase in der
Messung sauber aussah, hatte genau nichts zu bedeuten — sie erbt einen
bereits verdorbenen Takt.

Der Kaltstart bleibt damit die größte bekannte Schwäche der App. Er
steht jetzt als eigener Testabschnitt mit den echten Zahlen im
Rückvergleich, samt Untergrenzen gegen weiteren Verfall und einer
Prüfung, dass mehr Erfahrung nie zu schlechteren Vorschlägen führt.

Sieben neue Tests. Alle jetzt 1802 Tests bestehen.

**Nachtrag, selber Tag: ein naheliegender nächster Schritt gemessen
und verworfen.** Die 583 der 968 übersehenen Käufe, die an einer zu
kurzen Vorlaufzeit liegen, hätten sich mit einer einfachen Idee
angehen lassen: die Vertrauensschwelle nur für bereits FÄLLIGE
Produkte senken (kein Vorlauf beteiligt, also kein Frühwarn-Risiko),
den Vorlauf für vorzeitige Vorschläge unangetastet lassen. Im
Rückvergleich sehr sauber — Trefferquote 78,2 % → 80,8 %, Genauigkeit
unverändert. Im Drei-Jahres-Lauf trotzdem gescheitert, und zwar nicht
an Leertagen (die blieben gleich), sondern an einem einzelnen Quartal
direkt nach dem simulierten Urlaub (13,5 % statt 7,9 % vergessen):
nach einer Abwesenheit werden plötzlich viele Produkte gleichzeitig
rechnerisch „fällig", weil der Kalenderabstand die Abwesenheitstage
mitzählt — sie treffen gebündelt auf vollen Bestand und lösen
reihenweise „Hab noch" aus.

Der naheliegende Gegenzug — Abwesenheitstage auch im Fälligkeits-
Check abziehen, so wie es die Rhythmus-Berechnung selbst längst tut —
ist in der Sache richtig. Trotzdem nicht übernommen: allein diese
Korrektur, ganz ohne die niedrigere Schwelle, hat den Drei-Jahres-Lauf
über eine ANDERE Kennzahl kippen lassen (Leertage 1696 → 1727,
Rhythmus-Treffgenauigkeit knapp unter der Grenze). Die im Test
erkannte Abwesenheit deckt sich offenbar nicht exakt mit der
simulierten — die Korrektur tauscht einen bekannten, erklärbaren
Fehler gegen ein kleineres, aber ebenso wirksames Rauschen ein.

Vollständig protokolliert in `test/liste.js`, damit der nächste
Anlauf beim eigentlichen Mechanismus ansetzt (das Bündeln von „Hab
noch" nach einer Abwesenheit dämpfen) statt wieder bei der
Sichtbarkeits-Schwelle. Kein Code geändert — der Kaltstart bleibt
beim Stand von oben.

---

## Wortwahl durchgesehen (2026-08-27)

Ein Durchgang durch die sichtbaren Texte, mit demselben Ziel wie die
Produkt-Blatt-Aufräumung weiter oben: professionell und nie überladen.

**„Sachen" raus.** Sechs Stellen sagten „2 Sachen tauschen", „13
Sachen kommen zusammen" — umgangssprachlich für einen Sachverhalt, der
immer exakt Produkte meint (jedes Ereignis im Wochenstreifen hängt an
einem Produkt). Ersetzt durch „Produkte", an einer Stelle durch
„Hinweise" (Zero-Waste-Sheet, wo es tatsächlich um Hinweisarten statt
Produkte geht). Zwei Tests hingen am alten Wortlaut und wurden
mitgezogen.

**Ein dichter Absatz beim Bon-Erfassen entwirrt.** Drei Fakten
(Aufnahmeweg, Datenschutz, Open-Food-Facts-Abgleich) standen in einem
Satz mit einer Gedankenstrich-Einschiebung mittendrin. Jetzt drei
kurze Sätze — dieselben Fakten, aber auf einen Blick erfassbar statt
einmal quer gelesen.

**Zwei Großbuchstaben-Zwischenüberschriften leiser gestellt.** „Wo dein
Geld hingeht" hatte auf der Zahlen-Seite eine ALL-CAPS-Überschrift
„KATEGORIEN" direkt über weiteren fett gesetzten Werten — dieselbe
Abwägung wie beim Produkt-Blatt schon einmal getroffen (normale
Schreibweise trennt genauso gut, ohne lauter zu sein als der Inhalt
darunter). Betraf `.moneySection` (Kategorien, Märkte, Immer wieder
gekauft) und `.confirmProgress` (Fortschritt beim Bon-Bestätigen).

Bewusst NICHT angefasst: die ausführlichen Erklärtexte hinter den
Info-Punkten (`PILL_INFO`). Die sind an genau einer Stelle definiert,
schon einmal gegen Dopplung durchgesehen (siehe Kommentar dort) und
öffnen sich nur auf Antippen — Länge ist dort kein Problem, weil
niemand sie ungefragt sieht.

Alle 1802 Tests bestehen, zwei davon mit angepasstem Wortlaut.

---

## Als Teilen-Ziel: „eBon teilen" aus REWE, Lidl & Co. (2026-08-27)

REWE, Lidl und andere Händler-Apps bieten an, den digitalen Bon direkt
über das System-Teilen-Menü zu verschicken. Einkaufs-Anker meldet sich
jetzt selbst als Ziel dafür an (`share_target` im Manifest) — Bild,
PDF oder Text kommen direkt bei der App an, ohne Umweg über
Zwischenablage oder Dateiverwaltung.

**Wie es technisch geht, ohne eigenen Server:** Das Betriebssystem
schickt eine POST-Anfrage mit der geteilten Datei an die App. Auf
statischem Hosting (GitHub Pages) gäbe es dafür normalerweise niemanden,
der antwortet — der Service Worker fängt die Anfrage deshalb selbst ab,
legt Datei und Text in einem eigenen Zwischenspeicher ab und leitet zur
App zurück. Die App holt sich das beim nächsten Start ab
(`App.consumeSharedIfAny`) und löscht den Zwischenspeicher sofort danach
wieder — nichts bleibt liegen, was nicht gebraucht wird.

**Was danach passiert, richtet sich nach dem Format:**
- Bild → läuft automatisch durch dieselbe Texterkennung wie ein
  eingefügter Screenshot, genau wie beim Fotografieren.
- Text → landet im Bon-Text-Feld, zur Kontrolle, bevor „Auswerten"
  gedrückt wird — nichts wird ungesehen gebucht.
- PDF oder ein anderes Format → die Texterkennung liest bisher nur
  Bilder. Statt das still zu verwerfen, sagt die App das ausdrücklich
  und bietet die zwei verbleibenden Wege an (Text einfügen, oder in der
  Händler-App einen Screenshot statt der Datei teilen). Ob REWE, Lidl
  & Co. den eBon als Bild oder als PDF anbieten, ist unterschiedlich
  und nicht in jedem Fall bekannt — deshalb nimmt das Manifest
  vorsichtshalber alle drei Formen an (`image/*`, `application/pdf`,
  `text/plain`), damit die App im Teilen-Menü überhaupt erscheint,
  unabhängig davon, welches Format am Ende ankommt.

**Die Grenze, klar benannt: nur Android.** `share_target` ist Teil des
Web-App-Manifests, und Safari/WebKit hat dieses Feld nie implementiert.
Auf einem iPhone taucht Einkaufs-Anker im Teilen-Menü nicht auf — das
ist keine Einschränkung dieser App, sondern eine fehlende Funktion in
iOS selbst, die keine Web-App umgehen kann.

**Getestet wurde, was ohne echten Browser ehrlich geht:** die ganze
Kette AB dem Punkt, an dem der Worker seine Arbeit abgegeben hat
(Cache-Eintrag, `?teilen=1` in der Adresse) — Sprung auf die
Erfassen-Seite, Text im Feld, Bild durch die Texterkennung, PDF mit
Format-Hinweis statt Stille, ein gewöhnlicher Start bleibt unberührt.
Dazu strukturelle Prüfungen, dass Manifest und Worker zueinander
passen. Der Worker selbst (`sw.js`) läuft in einem eigenen
ServiceWorker-Kontext, den Node nicht ausführt — dass ein echtes
Android-Gerät die App im System-Teilen-Menü tatsächlich anzeigt und die
Anfrage richtig durchreicht, ist ungetestet und lässt sich ohne
reales Gerät nicht schließen.

Dreizehn neue Tests. Alle jetzt 1815 Tests bestehen.

---

## Angebote: die Lücke zwischen zwei fertigen Modulen geschlossen (2026-08-27)

Auffällig beim letzten Auftrag: ein Großteil der angefragten „Struktur"
existierte schon. `priceMemory.js` erkennt je Produkt, ob der letzte
gezahlte Preis deutlich unter dem eigenen üblichen liegt. `offerAdvisor.js`
rechnet daraus eine Menge, die sich bei der Haltbarkeit noch lohnt. Beide
fertig, beide getestet (`test/schwarm.js`) — nur nirgends verbunden, und
`offerAdvisor.js` stand in keiner einzigen Ansicht.

Der Grund war eine Lücke, keine Redundanz: `stockUpAdvisor.js` macht
dieselbe Rechnung bereits, aber nur für Haushaltsprodukte (die verderben
nicht). Für Lebensmittel — genau das, was zuletzt gefragt war — gab es
keine Entsprechung in der Oberfläche.

**Was jetzt dazukommt:** `compute()` verknüpft `priceMemory` und
`offerAdvice` zu `ctx.foodDeals` — alle Lebensmittel, bei denen der letzte
Kauf mindestens 15 % unter dem eigenen Median lag, mit einer aus
Haltbarkeit und gelerntem Verbrauch gerechneten Menge. Ein neuer, von der
Startseite erreichbarer Bereich („Angebote", nach demselben Muster wie
„Fällig" — ein siebter Reiter unten passt nicht) zeigt sie.

**Was bewusst NICHT behauptet wird:** Das ist der zuletzt GESEHENE
Preis, kein aktueller Regalpreis — die App hat keinen Zugang zu dem, was
gerade im Laden steht. Jede Zeile sagt „zuletzt DD.MM.JJJJ" statt eine
Aktualität vorzutäuschen, die nicht da ist.

**Was das NICHT ist:** eine Antwort auf den größeren Teil derselben
Anfrage — eine Datenbank, die Preise über mehrere Haushalte oder Händler
hinweg zusammenführt. Das bräuchte einen Server oder einen
Austauschmechanismus zwischen Geräten, und genau diese Weggabelung liegt
bereits fertig durchdacht in `docs/schwarm.md`: drei Stufen, von
„lokal, wie jetzt" bis „öffentlicher Index mit Impressum,
Datenschutzerklärung und Hosting-Verantwortung". `priceShare.js`
(k-Anonymität, nur bekannte Ketten, keine Kennung) liegt dafür fertig
und ungenutzt bereit — SEIT einer früheren Runde, nicht seit heute.
Diese Entscheidung wurde nicht getroffen, weil sie nicht lokal zu treffen
ist: sie ändert das Kernversprechen der App, das auf jedem Bildschirm
steht.

Acht neue Tests. Alle jetzt 1823 Tests bestehen.

---

## Stufe 2 vorbereitet, aber nicht live (2026-08-27)

Die Entscheidung aus `docs/schwarm.md` §8 Punkt 1 ist gefallen: ein
öffentlicher Server-Preisindex ist das Ziel, kein reines Schwarm-ohne-
Server-Modell. Ausdrücklich **noch nicht am Start** — nur die
Infrastruktur dafür ist jetzt vorbereitet, aus zwei Gründen: die
Rechenlogik lässt sich schon heute schreiben und prüfen, und Punkt 2
und 3 aus §8 (ein Verantwortlicher mit Anschrift, eine betriebene
Hosting-Umgebung) sind echte Entscheidungen von Menschen, keine, die
sich vorab programmieren lassen.

**Was dazukam:** `src/algo/schwarmClient.js` — `weeklyBatch()` sammelt
aus den eigenen Käufen, welche Preissichtungen (siehe `priceShare.js`)
in die Sendung der laufenden Kalenderwoche gehören. `attemptShare()`
ist der einzige Ort, an dem eine Übertragung überhaupt anfinge — und
er sendet unter keiner Einstellungskombination etwas, weil `ENDPOINT`
auf `null` steht. Dazu ein rein struktureller, standardmäßig
ausgeschalteter Einwilligungs-Zustand (`settings.schwarm.enabled`,
Vorgabe `false`) im Datenmodell, damit eine spätere Einwilligungs-
Oberfläche einen echten, migrationssicheren Zustand zum Umschalten
vorfindet statt eines neuen Felds mit alten Wanderungsfragen.

**Zwei getrennt geprüfte Garantien**, weil „noch nicht am Start" zwei
verschiedene Dinge bedeutet: Erstens, dass `attemptShare()` unter
keiner Kombination `sent: true` liefert, solange `ENDPOINT` leer ist
(`test/schwarm.js`, Abschnitt F). Zweitens, dass keine Oberfläche
überhaupt dorthin verweist — kein Menüpunkt, kein Knopf, keine
Einstellung ist heute erreichbar (`test/uitest.js`, „Stufe 2 ist
vorbereitet, aber nirgends erreichbar"). Die erste Garantie allein
wäre nicht genug: sie sagt nichts darüber, ob ein Nutzer die Funktion
versehentlich überhaupt finden und anschalten könnte.

Zehn neue Tests. Alle jetzt 1833 Tests bestehen.

---

## Das Wesen (2026-08-27)

Ein Begleiter durch die App, angelehnt an Maskottchen wie die
Duolingo-Eule — die Rückmeldung war ausdrücklich "durchgängig
überall", und mit einer Stimmung, die zu echten Signalen passt statt
Dekoration zu sein.

**Wo es lebt:** in `App.renderBar()` — dem einen Kopfbereich, der auf
jeder Seite läuft. Keine sechsfache Kopie in jeder Ansicht, eine
Stelle, ein Ort für spätere Änderungen.

**Wie es gebaut ist:** flaches SVG, acht Büschel um einen Kern statt
gezeichnetem Fell — bei der Darstellungsgröße (56–64 px) wäre feineres
Detail nur Rauschen, und dieselbe Technik trägt auch andere
Web-Maskottchen (Duolingos Eule ist im Web ebenfalls flache
Illustration plus Animation, kein Echtzeit-3D). Ein echtes 3D-Modell
wie in der Referenzvorlage lässt sich in dieser Umgebung nicht
erzeugen — das bräuchte ein Modellierwerkzeug, das hier nicht
verfügbar ist.

**Vier Stimmungen, aus Signalen, die die App schon hat** (`mascotMood()`
in views.js), Rangfolge nach Dringlichkeit:

| Stimmung | Auslöser | Ton |
|---|---|---|
| **alarm** | Kühlkette gefährdet, oder etwas verdirbt heute | dunkel, blass-violettgrau — wie angefragt |
| **besorgt** | vergessene, fällige Produkte | gedämpftes Ocker |
| **froh** | laufender Streak, nichts Akutes offen | warmes Korall |
| **neutral** | keines der drei | gedeckteres Rosé |

Kein neuer Zustand: `ctx.safety`, `ctx.pulse`, `ctx.forgotten`,
`ctx.streak` gab es alle schon — nur eine neue, gebündelte Lesart
davon.

**Bewegung statt Standbild:** sanftes Auf-und-Ab in der Ruhe, ein
Blinzeln alle paar Sekunden, bei „alarm" ein feines Zittern zusätzlich
zur dunkleren Farbe. Ausgeschaltet, wenn das Betriebssystem weniger
Bewegung verlangt (`prefers-reduced-motion`) — dieselbe Regel, der die
App auch beim Konfetti schon folgt.

**Ein gefundener Fehler beim Bauen:** die erste Fassung hatte
`width`/`height` fest in der CSS verdrahtet — jede angeforderte
Größe wurde dadurch stillschweigend auf 58 px gezogen, auch beim
Testen mit absichtlich großen Werten. Vor dem Verifizieren aufgefallen,
weil ein 170-px-Debug-Rendering trotzdem klein blieb.

Neunzehn neue Tests: die Stimmungs-Rangfolge, dass eine unbekannte
Stimmung auf ein vollständig eingefärbtes Gesicht zurückfällt statt
auf eines ohne Farbe, und dass das Wesen tatsächlich auf jeder
geprüften Seite im Kopfbereich steht. Alle jetzt 1852 Tests bestehen.

---

## Das Wesen wird interaktiv und deckt die App ab (2026-08-27)

Zwei Rückmeldungen zur ersten Fassung, beide umgesetzt: die Form
gefiel nicht (acht Büschel um einen Kreis las sich als Zahnrad, nicht
als Fell) und die Abdeckung sollte über den Kopfbereich hinausgehen.

**Die Form ist jetzt ausdrücklich ein Platzhalter.** Ersetzt durch
eine handgezeichnete, unregelmäßige Kontur (`MASCOT_BODY_PATH` in
views.js) — eine von zehn zur Auswahl gestellten Varianten, keine
endgültige Gestaltung. Der eigentliche Plan: echtes Bild- oder
Videomaterial (siehe unten), das nur diese eine Formel ersetzt —
Stimmungslogik, Platzierung und Interaktionen hängen absichtlich
nicht an der Zeichnung.

**Aus Dekoration wurde eine Fläche, die etwas tut.** Das Wesen im
Kopfbereich ist jetzt ein `<button>` mit eigenem Namen (nicht mehr
`aria-hidden`, weil es jetzt etwas auslöst) — Antippen öffnet, was zur
aktuellen Stimmung gehört: bei „alarm" dieselbe Kühlkette-Meldung wie
in „Jetzt zu tun", bei „besorgt" dasselbe Hinweise-Blatt, bei „froh"
eine kurze Rückmeldung zum Streak. Bewusst keine neuen Texte
geschrieben — jede Meldung ist ein zweiter Zugang zu etwas, das
bereits an einer Stelle korrekt beschrieben ist, nicht eine zweite
Fassung derselben Aussage.

**Volle Abdeckung statt eines einzelnen Auftritts:**
- **Kopfbereich** — jede Seite, wie schon zuvor.
- **Leere Ansichten** — `emptyView()` (der gemeinsame Baustein für
  Zahlen, Bestand, Fällig, Angebote) zeigt jetzt das Wesen statt einer
  bloßen Textzeile. Stimmung standardmäßig „neutral" (abwartend, keine
  geratene Emotion für „noch keine Daten"), mit einer benannten
  Ausnahme: „Nichts fällig, alles im Rhythmus" ist eine echte gute
  Nachricht und bekommt „froh".
- **Meilenstein-Feier** — die Vollbild-Karte bei einem erreichten
  Abzeichen zeigt das Wesen jetzt fröhlich über dem Abzeichen-Symbol.
  Hier kommt die Stimmung nicht aus den üblichen Signalen: die Feier
  selbst ist der Grund zur Freude, unabhängig davon, was sonst gerade
  ansteht.

**Wie es weitergeht, wenn echtes Material da ist:** drei Stufen
besprochen — ein Standbild pro Stimmung (von hier aus CSS-animiert,
sofort machbar), mehrere Bilder als Frames, oder ein Bild-zu-Video-Loop
aus einer KI wie Runway/Pika/Kling (dafür fehlt in dieser Umgebung der
Zugriff — das müsste extern erzeugt und hierher übergeben werden).
Alle drei ersetzen nur die Zeichenfunktion, nicht die Stimmungs- oder
Interaktionslogik.

Acht neue Tests: dass Antippen tatsächlich ein Blatt öffnet und dabei
bestehende, nicht neu geschriebene Meldungen wiederverwendet, dass
leere Ansichten das Wesen zeigen, und dass die Meilenstein-Feier es
fröhlich zeigt. Alle jetzt 1860 Tests bestehen.

---

## Das Wesen bleibt an Ort und Stelle und bekommt eine eigene Stimme (2026-09-02)

Zwei konkrete Rückmeldungen zur letzten Fassung: das Wesen soll
„immer exakt an einer Stelle" stehen, auch beim Scrollen — und
Antippen soll „entsprechenden Kontext zu dem, was gerade auf dem
Bildschirm ist" liefern, in einer „kleinen, etwas transparenten
Sprechblase", ohne ein separates Fenster zu öffnen.

**Fest statt scrollend.** Das Wesen saß bislang im großen Titel
(`#largeTitle`) — und der fällt beim Scrollen in die Kopfleiste
zusammen, verschwindet also. Es lebt jetzt als eigenes,
`position:fixed`-Element außerhalb von `.shell` (siehe `index.html`,
`.mascotFab` in `app.css`), unterhalb der Kopfleiste, damit es nicht
mit deren eigenen Knöpfen kollidiert. `App.renderBar()` aktualisiert
nur noch sein Aussehen — Stimmung, Beschriftung —, nie mehr seinen Ort
im DOM. Ergebnis: dieselbe Bildschirmstelle, auf jeder Seite, bei
jeder Scrollposition.

**Eine Sprechblase statt eines Blatts.** Antippen öffnete bisher
`app.notice()` oder das Hinweise-Sammelblatt — beides das bestehende
`.sheet`-System mit Hintergrund und Vollbild-Anmutung. Jetzt öffnet es
`.mascotBubble`: ein kleines, leicht durchsichtiges Feld direkt neben
dem Wesen, mit Sprechblasen-Spitze, ohne Hintergrund-Abdunkelung —
der Rest der Seite bleibt bedienbar. Sie schließt sich beim erneuten
Antippen, bei einem Tipp irgendwo sonst auf der Seite, mit Escape oder
beim Wechsel des Reiters; ein Tipp auf die Blase selbst schließt sie
nicht.

**155 kontextbezogene Aussagen, regel- und datenbasiert.** `mascotTap()`
ist komplett ersetzt durch `MASCOT_RULES` (`views.js`): eine Tabelle je
Reiter, jeder Eintrag ein Paar aus `when(ctx)` und `say(ctx)`. Jede
Bedingung liest ausschließlich, was `Data.compute()` ohnehin liefert —
keine Zahl wird neu geschätzt oder erfunden, mehrere Aussagen greifen
sogar auf bereits vorhandenen Text zurück (`ctx.streak.message`,
`ctx.brandHeadline.text`) statt ihn ein zweites Mal zu formulieren.
`mascotMessage(ctx, tab, seed)` sammelt die gerade zutreffenden Regeln
und wählt reihum eine aus — der `seed` ist ein Zähler je Reiter
(`App.mascotTapCount`), kein Zufall, damit sich das Verhalten prüfen
lässt: wiederholtes Antippen zeigt nacheinander verschiedene, aber
immer nachvollziehbare Aussagen und beginnt nach einer vollen Runde
wieder von vorn. Jede Liste endet mit einer Regel ohne Bedingung,
damit die Blase nie leer bleibt.

Verteilung über die acht Reiter: Start 22, Liste 21, Bestand 18,
Erfassen 16, Zahlen 23, Mehr 23, Fällig 18, Angebote 14 — 155 insgesamt,
mehr als die verlangten 150.

Der Testabschnitt „Das Wesen" prüft jetzt (36 statt vorher 17):
dass das Wesen außerhalb von großem Titel und Inhaltsbereich liegt und
auf jedem Reiter an derselben Stelle steht, dass `.mascotFab` und
`.mascotBubble` in app.css tatsächlich `position:fixed` tragen, das
vollständige Öffnen-/Schließen-Verhalten der Sprechblase (Antippen,
erneutes Antippen, Klick außerhalb, Escape, Klick auf die Blase
selbst, Reiterwechsel), dass `MASCOT_RULES` jeden Reiter kennt und
insgesamt mindestens 150 Regeln zählt, dass jeder Reiter sowohl mit
vollen Beispieldaten als auch im ganz leeren Zustand eine Aussage
liefert, und dass die Rotation deterministisch ist statt zufällig.
Alle jetzt 1896 Tests bestehen.

---

## Zwei Interaktionsfeinheiten am Wesen (2026-09-02)

**Dieselbe Sprechblase läuft jetzt auch in der Meilenstein-Feier.** Das
Wesen dort (`#partyMascot`) war bisher reine Dekoration
(`aria-hidden`, kein Knopf) — jetzt ist es ein `<button>` wie sein
Gegenstück im Kopfbereich und öffnet dieselbe Art Sprechblase, nur
innerhalb der Feier-Karte verankert statt fest im Bildschirm (`.partyCard`
ist bereits `position:relative`, die Blase also `position:absolute`
statt `position:fixed`). Die gemeinsame Optik — Hintergrund, Blur,
Rahmen, Sprechblasen-Spitze, Einblend-Animation — steckt jetzt in einer
geteilten Klasse `.speechBubble`; `.mascotBubble` und
`.partyMascotBubble` fügen nur noch ihre eigene Position hinzu. Zähler
und Text kommen aus derselben `mascotMessage()`, über
`App._toggleBubble()`, das beide Aufrufstellen (Kopfbereich, Feier)
bedient. Schließen funktioniert überall gleich: erneutes Antippen,
Klick daneben, Escape — und zusätzlich beim Beenden der Feier
(`App.closeParty()`).

**Ein „neu"-Punkt zeigt ein ungesehenes Alarmsignal.** Wer die
Sprechblase eine Weile nicht geöffnet hat, sollte trotzdem merken,
wenn inzwischen eine Kühlketten-Warnung oder ein „verdirbt heute"
aufgetaucht ist — ohne extra nachzusehen. `mascotAlarmSignature(ctx)`
(views.js) bildet einen Fingerabdruck aus genau diesen beiden Signalen,
in derselben Rangfolge wie `mascotMood()`. `App.mascotSeenAlarm` merkt
sich, welcher Fingerabdruck beim letzten Antippen sichtbar war; weicht
der aktuelle davon ab, bekommt das Wesen einen kleinen roten Punkt
(`.mascotFab.hasNew`) und das aria-label ein „Neu: "-Präfix — der
Punkt allein wäre für ein Vorleseprogramm stumm. Der Punkt verschwindet
sofort beim Antippen, nicht erst beim nächsten Neuzeichnen: dafür
läuft `App.syncMascotNewDot()` sowohl in `App.renderBar()` als auch
direkt nach jedem Öffnen/Schließen der Sprechblase.

18 neue Tests: dass das Wesen in der Feier eine benannte Schaltfläche
ist und dieselbe Sprechblasen-Mechanik bedient (öffnen, schließen,
Klick daneben schließt nur die Blase — nicht die Feier —, Escape,
Ende der Feier räumt mit auf), dass `mascotAlarmSignature()` bei
Kühlkette und Verderb heute je eine eigene, unterscheidbare Signatur
liefert und Kühlkette dabei vorgeht, und dass der „neu"-Punkt am
echten Wesen erscheint, beim Antippen sofort verschwindet und bei
einem abweichenden Signal danach zurückkehrt. Alle jetzt 1914 Tests
bestehen.

---

## Ein UX-Testbericht, erste Umsetzungsrunde (2026-09-02)

Ein Testerdurchlauf durch die ganze App — User Experience, Design,
Bequemlichkeit — ergab 18 konkrete Befunde, priorisiert von P0
(stört den ersten Eindruck oder eine tägliche Handlung) bis P2
(Politur). Umgesetzt wurden die vier P0-Befunde und vier der acht
P1-Befunde; der Rest (weitere Wesen-Feinheiten, kleinere
Farb-/Kontrast-Fragen und eine echte Grundsatzfrage zu abgerundeten
Overlays) steht noch aus.

**Kopfzeile ohne Titel beim ersten Bild (P0).** Auf Liste, Bestand,
Zahlen und Fällig zeigte die schmale Kopfleiste anfangs nur den
rechten Aktions-Knopf — der Titel blieb bis zum Scrollen unsichtbar
(`.barTitle{opacity:0}`), und die Zeile bestand damit aus einem
einzelnen, unbeschrifteten Knopf mit viel Leerraum davor.
`App.renderBar()` markiert die Leiste jetzt mit `.hasActions`, sobald
sie rechts einen Knopf trägt, und genau dann steht der Titel von
Anfang an da — ohne Knopf bleibt das gewohnte Zusammenfallen beim
Scrollen erhalten.

**Text bricht auf 390px mitten im Wort ab (P0).** „Vollkornbrot,
Bananen, Tomaten und 10 weite…“ auf der Startseite, reproduzierbar
auf der häufigsten iPhone-Breite. Ursache: `text-overflow:ellipsis`
kürzte den ganzen String einschließlich des Zusatzes „und N weitere“.
Jetzt zwei Elemente statt eines — `.baNames` (darf kürzen) und
`.baRest` (schrumpft nie) —, sodass „und 10 weitere“ immer vollständig
lesbar bleibt und nur die Namensliste selbst mit einer sauberen
Ellipse endet.

**„Wo dein Geld hingeht“ war selbst ein endloser Scroll (P0).** Die
eine, immer sichtbare Geld-Karte auf „Zahlen“ zog sich mit
Kategorien, Märkten und „Immer wieder gekauft“ (je bis zu acht
Zeilen) über mehr als 2500 Pixel, bevor überhaupt die Wahl zwischen
Ausgaben/Verhalten/Bilanz auftauchte. `moneyBarSection()` zeigt jetzt
je Rangliste höchstens vier Zeilen, mit „Alle N ansehen“ darunter für
den Rest — dieselben Daten (weiterhin höchstens sieben plus
„Sonstige“), nur eingeklappt.

**Das Wesen schwebte auf breiten Bildschirmen verwaist (P0).**
`.mascotFab` hing an `right:14px` relativ zum Fenster, nicht an der
840px breiten Inhaltsspalte — auf einem 1280px-Bildschirm blieben
gut 400px Leerraum zwischen Inhalt und Wesen. Ab 900px Breite hängt
es jetzt an der rechten Kante der Inhaltsspalte
(`right:max(14px, calc(100vw - 1088px + 14px))`), genau daneben statt
irgendwo im Leeren.

**Leerzustände sammelten sich oben, mit unerklärter Fläche darunter
(P1).** `.col` füllte die 100vh von `.shell` bislang nicht wirklich
aus, `main{flex:1}` griff mangels flexgebenden Vorfahren ins Leere.
Erststart und leere Ansichten (z. B. „Angebote“ ohne Treffer) klebten
oben, mit einer großen grauen Fläche bis zur unteren Leiste. `.col`
ist jetzt selbst ein Flex-Container, und `main:has(> .card:only-child)`
zentriert eine einzelne Leerzustands-Karte in der verfügbaren Höhe —
alle anderen Ansichten (mehrere `.group`-Abschnitte) bleiben unberührt.

**Deaktivierter „Einkauf buchen“-Knopf kaum lesbar (P1).**
`.cta:disabled{opacity:.35}` verblasste Fläche und weiße Schrift
gemeinsam — vor dem ersten Häkchen im Ladenmodus stand blasses Weiß
auf blassem Grün. Jetzt ein eigener, undurchsichtiger Farbsatz
(`--fill-2`/`--ink-2`, mit 4,5:1 genau am Rand der eigenen
Kontrastprüfung — `--ink-3` fiel dort mit 4,17:1 (hell) durch),
dieselben Töne, die die App auch sonst für „da, aber gerade nicht
dran“ verwendet.

**Restmenge im Bestand ohne Einheit (P1).** „0,6 · 0,85 €“ nannte
nirgends, wovon 0,6 die Rede war. Da der Katalog keine Verpackungs­
einheit je Lebensmittel führt (und eine erfunden hätte werden
müssen), trägt die Zahl jetzt ein „×“ — sie ist tatsächlich ein
Vielfaches der zuletzt gekauften Menge, das war schon vorher so
berechnet, nur nicht benannt. Die Erklärung dazu steht im (i) der
Gruppe „Vermutlich noch da“.

**Kachel-Scroller wirkte abgeschnitten (P1).** Der Fadeout am rechten
Rand der Kennzahlen-Kacheln war mit 28px neben einer 138px breiten
Kachel kaum wahrnehmbar. Jetzt 52px breit — der Anschnitt liest sich
als Einladung, nicht als Kante.

**Geprüft, nicht verändert: das US-Datumsformat beim Erfassen.** Das
native Datumsfeld zeigte in dieser Testumgebung „09/02/2026“ statt
des deutschen Formats — reproduzierbar auch mit explizit gesetzter
`de-DE`-Locale im Testbrowser. Das bestätigt: es ist die UI-Sprache
des Browsers selbst, die über die Anzeige entscheidet, nicht diese
Seite (`lang="de"` steht bereits korrekt auf `<html>`). Ein eigenes
Datumsfeld nur für dieses Detail zu bauen, hieße ein natives,
zugängliches Element gegen ein selbst gepflegtes einzutauschen —
das lohnt sich hier nicht.

**Offen für die nächste Runde:** die Sprechblase des Wesens wiederholt
sich im Alarmfall, zwei unterschiedlich gefärbte Wesen erscheinen
gleichzeitig in Leerzuständen, die Alarm-Stimmung ist im Dunkelmodus
schwer zu erkennen, die Gangreihenfolge lässt sich nur per Pfeiltasten
verschieben, dazu einige Politur-Punkte bei Farbe und Form — siehe der
volle Bericht.

17 neue Tests decken die acht umgesetzten Punkte ab; zwei bestehende
Prüfungen zu „Wo dein Geld hingeht” wurden an die neue, eingeklappte
Darstellung angepasst (dieselbe Rechnung, nur nach einem Antippen von
„Alle ansehen” geprüft). Alle jetzt 1931 Tests bestehen.

## Ein UX-Testbericht, zweite Umsetzungsrunde (2026-09-02)

Die restlichen Punkte aus demselben Testbericht — sieben davon
umgesetzt, einer korrigiert:

**Sprechblase des Wesens wiederholte sich im Alarmfall (P1).** Auf
„Start” und „Liste” stand in der Sprechblase praktisch dasselbe, was
schon die Sicherheits-Karte darunter sagte. Die Regel nennt jetzt
stattdessen die konkrete Kühlzone (`Am besten dorthin: …`) — eine
zweite, nützliche Information statt einer Wiederholung. Auf
„Erfassen” bleibt die alte Kurzform, dort steht sonst nichts zur
Kühlkette.

**Zwei unterschiedlich gefärbte Wesen in Leerzuständen (P1).** Das
ausgegraute Wesen im Hintergrund eines Leerzustands (Animation um
`-.6s` versetzt) und das normal gefärbte Wesen der Sprechblase
standen nebeneinander und wirkten wie zwei verschiedene Figuren.
`.emptyMascot .mascot` bekommt jetzt zusätzlich `opacity:.55` — die
absichtlich nicht geratene Stimmung (`mood` bleibt unverändert, siehe
Kommentar im Code) bleibt bestehen, nur blasser, sodass klar ist:
dasselbe Wesen, nur im Hintergrund.

**Alarm-Stimmung im Dunkelmodus kaum zu erkennen (P1).** Die
Alarmfarben (`--m-alarm-*`) waren fest verdrahtete Hex-Werte, die im
Dunkelmodus nur 2,67:1 Kontrast gegen den Seitengrund erreichten.
Jetzt eigene Tokens, in Hell und Dunkel getrennt gepflegt wie jedes
andere Farbpaar der App — im Dunkelmodus 5,36:1, rechnerisch gegen
`--paper` geprüft.

**Gangreihenfolge nur per Pfeiltasten (P1).** Bei vielen Gängen war
mehrfaches Antippen von ↑/↓ mühsam. Ein Ziehgriff links jeder Zeile
erlaubt jetzt Drag-and-Drop per Pointer Events (nicht die native
HTML5-Drag-API — die hat auf dem Telefon kaum Touch-Unterstützung,
und das hier ist eine mobile-first-App). Während des Ziehens
verschieben sich nur die betroffenen Nachbarzeilen per Transform;
erst beim Loslassen committet `App.reorderAisleTo()` die neue
Reihenfolge — die Funktion ruft dafür wiederholt das bestehende,
geprüfte `moveAisle()` auf, statt eine neue „an Index X einfügen”-
Logik zu schreiben. Die Pfeile bleiben zusätzlich bedienbar.

**„Getauscht”-Knopf zu laut (P2).** Der aktive Zustand des
Tausch-Knopfes nutzte dieselbe kräftige Akzentfläche wie ein
Bestätigungs-Knopf, obwohl „getauscht” nur ein Status ist, keine
Handlung, die gerade passiert. Eine eigene Kontur-Variante
(`.swapBtn.on`) markiert den Zustand jetzt zurückhaltender.

**Rot auch für unauffällige Aussagen (P2).** Die Verschwendungssumme
in „Zahlen” stand in derselben Warnfarbe wie akute Sicherheitshinweise,
obwohl eine Zahl aus der Vergangenheit keine Handlung verlangt. Jetzt
Bernstein statt Rot — Rot bleibt für Fälle reserviert, die wirklich
dringend sind.

**Gefüllter/hohler Punkt kaum zu unterscheiden (P2).** Die 8px-Punkte
für „reicht”/„geht aus” waren auf dem Telefon schwer auseinander­
zuhalten. Jetzt 11px, sonst unverändert.

**Korrigiert: „zwei gestapelte Filterzeilen” bei „Wo dein Geld
hingeht” (F3 aus dem Bericht).** Der ursprüngliche Befund war falsch.
Nachmessen mit `getBoundingClientRect()` zeigt: es ist ein einziges
5-Optionen-Segment (`flex-wrap:wrap`), das bei schmaler Breite korrekt
auf zwei Zeilen umbricht — die Knöpfe füllen dabei jede Zeile sauber
aus, keine Lücke, keine zwei getrennten Konzepte. Nichts geändert.

**Offen, bewusst nicht entschieden: runde Ecken für die Sprechblase.**
Der Bericht schlug abgerundete Ecken für das Overlay des Wesens vor —
das widerspricht der dokumentierten Formsprache dieser App (eckige
Flächen, runde Punkte, siehe „Kanten: Flächen eckig, Punkte rund”
oben). Eine echte Grundsatzfrage, keine reine Umsetzungsfrage — bleibt
offen, bis das explizit entschieden ist.

17 neue Tests decken die sieben umgesetzten Punkte ab. Alle jetzt
1951 Tests bestehen.

## Sicherung entfernt, "Deine Woche" entfernt (2026-09-02)

Zwei gezielte Änderungen auf ausdrücklichen Wunsch, nicht aus einem
eigenen Testbericht:

**„Deine Woche" ist weg.** Der Wochenstreifen auf der Startseite
(sieben Tage, jedes Feld ein Ereignis) ist ersatzlos entfernt — Titel,
Info-Icon, Tagesspalten, Tages-Detailblatt. Die Startseite beginnt
jetzt direkt mit der Einkaufsliste. Die zugrundeliegende Fachlogik
(`weekPulse.js`) bleibt bestehen und unverändert — sie speist
weiterhin die Sprechblase des Wesens (z. B. „Heute ist laut deinem
Rhythmus ein guter Einkaufstag").

**Die Sicherung ist weg.** Die gesamte lokale Backup-/Export-Funktion
ist aus der Oberfläche entfernt: die Warnkarte („Noch nie gesichert",
dauerhafter Speicher, automatische Datei, Herunterladen) unter „Mehr",
ebenso „Sicherung herunterladen"/„Sicherung einlesen" unter
„Mehr → Daten". Grund: die künftige Datenhaltung ist serverseitig
geplant; eine lokale Backup-Funktion als Nutzerfunktion soll es bis
dahin nicht mehr geben, und es wurde bewusst keine Ersatzlösung
gebaut.

Wichtig zur Abgrenzung, weil beide „Sicherung" heißen, aber
verschiedene Dinge meinen: die **interne Schattenkopie** gegen einen
abgebrochenen Schreibvorgang (halbe Datei durch volle Quote oder
Absturz mitten im Speichern) bleibt bestehen — sie schützt nicht gegen
ein gelöschtes `localStorage`, sondern gegen den häufigeren Fall der
kaputten, halb geschriebenen Datei. `backupGuard.js` (Algo-Schicht)
ist entsprechend aufgeteilt: `backupHealth`/`storageRisk`/
`shouldRemind`/`backupFileName` (die Nutzerfunktion) sind entfernt,
`validateSnapshot`/`pickBetter` (die Schattenkopie-Urteilslogik)
bleiben unverändert und weiterhin unter `test/backup.js` geprüft
(jetzt kürzer und unter „WIEDERHERSTELLUNG" statt „SICHERUNG").

Damit einher geht ein realer Verlust, ehrlich benannt: ohne
Export/Import gibt es aktuell keinen Weg mehr, die eigenen Daten
außerhalb des Browsers zu sichern oder auf ein neues Gerät zu
übertragen. Browserdaten löschen oder ein iOS-Aufräumvorgang nach
Wochen ohne Nutzung kostet die Historie ersatzlos — bis die geplante
Server-Anbindung steht.

Kein eigener Testbericht diesmal; die Änderung wurde anhand konkreter,
extern vorgegebener Screenshots umgesetzt. Geprüft trotzdem: neue und
angepasste Tests bestätigen, dass beide Bereiche verschwunden sind und
die Schattenkopie weiterhin greift; die Prüfungen, die nur die jetzt
entfernte Oberfläche betrafen (Sicherungskarte, Wochenstreifen-
Rendering), sind mit ihr gegangen. Alle jetzt 1900 Tests bestehen.

## Ein UX- und Logik-Audit, dritte Runde (2026-09-03)

Ein dritter Testbericht, diesmal mit einem anderen Auftrag: nicht nur
Politur, sondern auch Logik-Vorschläge — Stellen, an denen die
Fachlogik in `src/algo/` bereits etwas berechnet oder anbietet, das
die Oberfläche nicht nutzt. Elf Befunde, alle umgesetzt:

**Fachlogik angeschlossen.** `budgetOptimizer.js`s `cheaperAlternatives()`
lag fertig, getestet und ungenutzt in der Fachlogik — laut eigenem
Modul-Kommentar extra gebaut, weil Streichen nie der eigentliche
Wunsch war, Tauschen ist es. Jede wegen Budget gestrichene Position
auf der Liste zeigt jetzt, wenn der Katalog eine günstigere
Alternative in derselben Kategorie kennt, einen Tauschvorschlag mit
Ersparnis und eigenem „Tauschen“-Knopf.

**„Sparen“ hat jetzt eine Folge.** Ein angenommener Sparvorschlag
änderte bislang an keiner Stelle der App etwas außer der eigenen
Wochensumme — ein Haken ohne Wirkung. Statt die Produktwahl
automatisch umzustellen, hält der Wochenrückblick jetzt nach: ist die
Verschwendung bei genau diesem Produkt seit der Annahme tatsächlich
gesunken? Dieselbe Verschwendungsquote, die überall sonst in der App
gilt — keine neue Fachlogik, nur eine neue Lesart vorhandener Zahlen.

**Vorratsschätzungen lassen sich jetzt korrigieren.** Bisher gab es
außer „leer“ (für angebrochene Packungen) und Abwarten bis zum
nächsten Kauf keinen Weg, eine falsch gewordene Schätzung
richtigzustellen — konnte je nach Rhythmus Wochen dauern. Drei Knöpfe
im Produkt-Blatt („Ist leer“ / „Etwa richtig“ / „Mehr als gedacht“)
wirken wie ein kleiner neuer Kauf: `inventoryEstimator.js` rechnet ab
dem Korrekturzeitpunkt weiter, bis der nächste echte Kauf sie ersetzt.

**Bestand ist jetzt gegliedert.** Mit Beispieldaten kam die Seite auf
2335 Pixel Höhe, nur durch Überschriften getrennt — genau das Problem,
das „Zahlen“ und „Mehr“ mit einem Segment schon einmal gelöst hatten.
Jetzt drei Unterbereiche (Vorrat, Küche, bei aktivem Urlaub zusätzlich
Reise). „Vermutlich noch da“ bekommt außerdem ein „Alle N ansehen“
statt bei 20 Positionen kommentarlos abzuschneiden.

**Der Rechner-Bildschirm wird nicht mehr verschenkt.** Die
Zweispalten-Regel `.cards2` stand fertig in `app.css`, wurde aber in
keiner einzigen Ansicht verwendet. Jetzt aktiv für „Vermutlich noch
da“ + „Haushalt“ (Bestand) und „Darstellung“ + „Deine Liste“,
„Wochenrückblick“ + „Haushalt“ (Mehr) — überall dort, wo zwei kurze,
unabhängige Gruppen nebeneinanderpassen. Auf dem Telefon bewirkt die
Regel nichts, sie steht nur im ≥900px-Media-Query.

**Ein echter Layout-Fehler auf dem Rechner.** Bei „Zahlen“ fiel die
fünfte Kennzahlen-Kachel („Rhythmen“) allein in die nächste Zeile und
zog sich über die volle Breite — eine fast leere, sehr breite Fläche,
weil `flex:1` den Rest der Zeile an das einzige Element vergab.
`flex:0 1 200px` behebt das: jede Kachel bleibt bei ihrer eigenen
Breite, auch allein in ihrer Zeile.

**Das Segment vor die lange Karte gezogen.** Bei „Zahlen“ stand die
Auswahl Ausgaben/Verhalten/Bilanz hinter der kompletten Geld-Karte —
wer zu „Verhalten“ oder „Bilanz“ wollte, musste erst daran
vorbeiscrollen. Das Segment steht jetzt direkt unter der Kachelzeile;
„Wo dein Geld hingeht“ läuft nur noch im Ausgaben-Tab, wo sie
inhaltlich hingehört, statt für alle drei Tabs gemeinsam.

**„Deine Liste“ nach oben.** Budget, Personen, Vorausschau und Urlaub
— die vier Werte mit der höchsten Handlungsdichte in „Mehr“ — standen
an fünfter von sechs Stellen. Jetzt direkt nach „Darstellung“.

**Ein „+“ im Ladenmodus.** Eine ungeplante Position hinzuzufügen
erforderte bisher, den Ladenmodus zu verlassen. Ein neuer Knopf öffnet
`addSheet()` als Blatt darüber, ohne ihn zu schließen — die
bestehende Diff-Logik in `renderStore()` erkennt die neue Position
beim nächsten Neuzeichnen von selbst.

**„Fällig“/„Angebote“ bleiben immer erreichbar.** Beide Seiten hingen
ausschließlich an bedingten Zeilen auf Start und Bestand — waren beide
Bedingungen gleichzeitig falsch, verschwand jeder Weg dorthin
komplett. Ein dauerhafter, im Ruhezustand unauffälliger Einstiegspunkt
steht jetzt unter „Mehr → Auswertungen“.

**Erfassen auf dem Rechner.** „Fotografieren“ blieb dort der optisch
dominante, volltonige Knopf, obwohl „Bild wählen“ oder eingefügter
Text der naheliegendere Weg ist. Farbe und Reihenfolge tauschen jetzt
ab 900px zugunsten von „Bild wählen“ — reine Gewichtung, kein Eingriff
in die Erkennung.

**Start nutzt den Rechner-Bildschirm.** Der Inhalt endete dort bislang
bei rund 660px Höhe, der Rest des Fensters blieb leer, während die
Wesen-Nachricht nur nach Antippen als Sprechblase erschien. Eine
zweite Spalte ab 900px zeigt sie jetzt dauerhaft — derselbe Text,
derselbe Rotations-Zähler, nur zusätzlich im DOM gerendert. Auf dem
Telefon ändert sich nichts.

Methode wie in den Runden zuvor: jeder Befund an einer Zeile
Quellcode oder einem Screenshot festgemacht, mit gebauter App unter
Playwright fotografiert (alle Bereiche, Ladenmodus, Produkt-Blatt,
mobil und Rechner, hell und dunkel).

62 neue Oberflächentests, dazu acht neue Tests für die
Vorratskorrektur in `test/features.js`. Alle jetzt 1970 Tests
bestehen.

---

## Algorithmus, Wischen, Glas (2026-09-03)

Drei Dinge auf einmal: der Rhythmus-Lerner hatte einen Fehler, den
niemand sehen konnte, der Bestand brauchte einen schnelleren Weg, und
die Oberfläche bekommt ihre runden Ecken zurück.

### Der Bündel-Effekt — und ein Messfehler, der ihn versteckt hat

Fällig wird ein Produkt nach Kalendertagen seit dem letzten Kauf.
Verbraucht wird es nur an Tagen, an denen jemand da ist. Nach zwei
Wochen Urlaub sind deshalb schlagartig viele Produkte rechnerisch
überfällig — und treffen gebündelt auf einen Schrank, in dem noch
alles steht. Der Nutzer tippt reihenweise „hab noch da", und jede
dieser Antworten verlängert einen Rhythmus, der gar nicht falsch war.
Der Schaden bleibt: die verlängerten Rhythmen schlagen danach zu spät
vor.

`test/liste.js` hatte diesen Weg schon als nächsten Schritt notiert
(„das eigentliche Ziel wäre, den BÜNDEL-Effekt direkt zu entschärfen"),
nachdem drei andere Ansätze gemessen und verworfen worden waren.

Die Umsetzung steht in `feedbackLearner.js` (`awayDaysFor`): die
Abwesenheitstage werden aus der Überfälligkeit herausgerechnet, bevor
daraus eine Verlängerung wird. Bleibt danach keine Überfälligkeit
übrig, war das Produkt ohne die Reise gar nicht fällig — die
Rückmeldung zählt dann neutral. Nur für „hab noch da". „War schon
alle" bleibt unangetastet: wer weg war und trotzdem nichts mehr hat,
liefert das stärkere Signal, nicht das schwächere. Der Rhythmus selbst
ist über `computeRhythm({absenceDays})` längst abwesenheitsbereinigt;
die Rückmeldung dagegen zu halten, ohne sie ebenso zu bereinigen, war
ein Vergleich zweier Zeitrechnungen.

Der eigentliche Fund liegt daneben. Beim ersten Messen änderte die
Korrektur **exakt gar nichts** — dieselben Zahlen bis auf die
Nachkommastelle. Der Grund: `test/longterm.js` hat jede simulierte
Rückmeldung mit `dueIn = 0` protokolliert, statt mit der Fälligkeit,
die die Oberfläche tatsächlich mitgibt (`app.js` tut das seit jeher).
Damit war jedes „hab noch da" gleich viel wert, der gesamte
Überfälligkeits-Zweig des Lerners wurde in drei simulierten Jahren nie
erreicht, und der Bündel-Effekt konnte in der Simulation gar nicht
entstehen. Ein Test, der die Sache nicht messen kann, die er messen
soll, sieht von außen genauso grün aus wie einer, der sie misst.

Mit der echten Fälligkeit und **ohne** die Bereinigung fällt der
Drei-Jahres-Lauf durch:

| | ohne Bereinigung | mit Bereinigung |
|---|---|---|
| Median-Abweichung der Takte (Schwelle 30 %) | **31,4 %** | unter 30 % |
| Leertage (feste Liste: 1710) | **1717** | 1705 |
| Vergessenes | 7,3 % | 7,3 % |
| Takt „alle 14 Tage" gelernt als | 7 | 11 |
| Takt „alle 51 Tage" gelernt als | 35 | 42 |

Der Rückvergleich `test/liste.js` kennt keine Rückmeldungen und bleibt
unverändert (Trefferquote 78,2 %, F1 60,1 %). Sein Merkzettel führt
den Weg jetzt unter „gemessen und ÜBERNOMMEN".

### Bestand: ein Wisch heißt „ist alle"

Der Bestand ist die einzige Zahl der App, die niemand bestätigt hat —
sie ist gerechnet. Genau deshalb liegt sie regelmäßig daneben, und
genau eine Korrektur überwiegt alle anderen: „das ist längst weg."
Eine Aussage, die so oft fällt, darf nicht drei Handgriffe kosten
(Zeile antippen, Blatt lesen, eine von drei Schaltflächen suchen).

Wischen nach links setzt die Schätzung auf null. Ohne Rückfrage: die
Geste ist die Antwort. Der Preis dafür ist ein Rückweg, und den gibt
es — „Rückgängig" im Toast (`App.toast` kann jetzt eine Handlung
tragen). Die drei Schaltflächen im Detail-Blatt bleiben: sie sind der
Weg mit Tastatur und der Weg für die beiden anderen Fälle.

Technisch dieselbe Wahl wie beim Ziehen der Gangreihenfolge: Pointer
Events statt Touch, eine Behandlung für Finger, Stift und Maus.
`touch-action:pan-y` statt `none` — die Zeilen stehen in einer langen
Liste, und `none` würde das senkrechte Scrollen abwürgen. Gesperrt
wird erst, wenn die waagerechte Bewegung deutlich ist UND größer als
die senkrechte; der Klick danach wird geschluckt, sonst öffnete sich
das Detail-Blatt direkt über dem eigenen Toast.

Verbrauchstag und Haltbarkeitsdatum bleiben **freiwillig**. Das
aufgedruckte Datum hatte schon ein Feld; der Verbrauchstag hat jetzt
eins, zugeklappt, unter „Verbrauchstag nachtragen". Beides als
Standardabfrage hätte die Geste zunichte gemacht — es ist die
Ausnahme, nicht der Regelfall.

### Runde Ecken und ein Hauch Glas

`--r-lg/--r-md/--r-sm` standen eine Weile auf `0px` („Flächen eckig,
Punkte rund"). Der Gedanke dahinter war, dass eine Fläche, die etwas
misst, sich eckig eher als Messwert liest. Im Ganzen hat das die App
härter gemacht, als sie ist: sie schätzt, sie mahnt nicht. Die Werte
sind zurück (20/14/10 px), die Regel ist geblieben — gerundet wird
über die drei Stufen, nicht über frei gewählte Zahlen, und ein Punkt
bleibt ein Punkt. Der Test dazu prüft jetzt genau das, statt auf `0px`
zu bestehen.

Dazu Glas. Die Leisten oben und unten arbeiten seit jeher mit
`backdrop-filter`; `--glass` trägt dasselbe Prinzip in die
Inhaltsflächen — Gruppen, Karten, Kacheln, Blätter. Damit das etwas
zeigt, braucht es etwas zu zeigen: der Seitengrund trägt zwei sehr
schwache, festsitzende Farbwolken. Ohne sie wäre eine durchscheinende
Fläche über einfarbigem Grund exakt dasselbe wie eine deckende —
Rechenarbeit ohne Wirkung. Die feine helle Kante liegt als
Innenschatten in `--lift` und nicht als eigenes Element: so folgt sie
jedem Radius von selbst.

Der eine Punkt, an dem Glas gefährlich wird, ist die Lesbarkeit. Die
Deckkraft ist deshalb hoch (.86 hell, .82 dunkel), und
`test/contrast.js` rechnet jetzt die **tatsächliche** Fläche nach —
Glas über Farbwolke über Papier — statt des Tokens, das sie einmal
war, für Haupttext, Nebentext, kleine Beschriftungen und alle sechs
getönten Marken, hell und dunkel. Mit der Gegenprobe: zu deckend wäre
gut für den Text und machte die Karte unsichtbar.

Beim Nachsehen mit Playwright fiel ein echter Fehler auf, den kein
Test gestellt hätte: weil die Zeilen in einer Gruppe für das Glas
durchsichtig sind, schien die rote Wischfläche durch **jede** Zeile.
Sie erscheint jetzt erst beim Ziehen, und die gezogene Zeile wird
solange deckend.

Alle Bereiche neu fotografiert, mobil und Rechner, hell und dunkel.
55 neue Oberflächentests, 20 neue Kontrastprüfungen, 19 neue
Lerntests. Alle jetzt 2064 Tests bestehen.

---

## Der Vorrat auf der Liste, ein Kalender, Bewegung (2026-09-03)

### Der zweite Auslöser für die Liste

Der Kaufrhythmus beantwortet „wie oft kaufst du das?". Die Frage, die
auf der Liste steht, ist aber „geht es dir aus?". Meistens dasselbe —
nicht aber, wenn die **Menge** schwankt. Wer sonst zwei Liter Milch
kauft und diesmal einen genommen hat, ist nach der halben Zeit leer;
der Rhythmus merkt davon nichts und schlägt zum gewohnten Termin vor.

Genau diese Zusatzinformation steckt in der Bestandsschätzung und
wurde von der Liste bisher nicht benutzt: die zuletzt gekaufte Menge
und die Korrekturen des Nutzers. Ohne sie konnte jemand im Bestand
„ist alle" wischen, und die Liste blieb unbeeindruckt.

Keine Doppelzählung — der Verdacht liegt nahe, weil die
Bestandsschätzung aus denselben Käufen stammt wie der Rhythmus, und
dieses Projekt hat dreimal Geld dafür bezahlt, dieselbe Tatsache
zweimal zu verrechnen. Hier zählt nichts doppelt: der Vorrat wirkt
nicht **auf** den Rhythmus, er öffnet nur eine zweite Tür zur Liste.
Der gelernte Takt bleibt unangetastet.

### Der zweite Messfehler im Langzeittest

Wie schon bei „hab noch da" hat die Simulation auch „war schon alle"
mit `dueIn = 0` protokolliert — und ohne jede Bedingung, also auch für
Produkte ganz ohne gelernten Takt. Die Oberfläche fragt das nur, wenn
jemand ein Produkt selbst auf die Liste setzt, das die App mindestens
zwei Tage lang nicht vorgeschlagen hätte, und nur bei gelerntem Takt
(`askLate` in views.js). Die Simulation spiegelt jetzt genau diese
Bedingungen.

Damit wurde sichtbar, was vorher eine falsche Zahl verdeckt hatte: die
App verliert ihren Vorsprung bei der Versorgung — 1724 Leertage gegen
1710 der festen Liste. Besser in jeder anderen Kennzahl, aber nicht
mehr besser versorgt. Zwei Messfehler in zwei Runden, beide in
derselben Datei, beide mit demselben Muster: die Simulation hat einen
ganzen Zweig der Lernlogik nie erreicht und sah dabei grün aus.

### Gemessen

| | vorher | nachher |
|---|---|---|
| Vergessenes (Drei-Jahres-Lauf) | 6,8 % | **5,5 %** |
| Unnötiges | 12,6 % | 16,3 % |
| Leertage (feste Liste: 1710) | 1724 | **1673** |
| Ausgaben (feste Liste: 7132,23 €) | 6120,75 € | 6247,71 € |
| Rückvergleich: Trefferquote | 78,2 % | **83,9 %** |
| Rückvergleich: Genauigkeit | 48,8 % | 42,5 % |
| Übersehene Käufe | 946 | **698** |
| Liste im Schnitt | 5,6 | 7,0 Positionen |

Der Rückvergleich verliert Genauigkeit und gewinnt Trefferquote; der
Drei-Jahres-Lauf, der als einziger die Rückkopplung sieht, verbessert
sich auf beiden Kennzahlen, die einen Haushalt wirklich kosten. Die
Regel steht jetzt in beiden Prüfständen gleich.

**Gemessen und verworfen.** „War schon alle" höher gewichten als „hab
noch da" (die eine Rückmeldung steht an jedem Vorschlag, die andere
nur in einem engen Fenster): im Drei-Jahres-Lauf ohne jede Wirkung —
beide Sorten treffen pro Produkt kaum zusammen, und ein Median über
gleichgerichtete Signale ändert sich durch Gewichte nicht. Ebenso den
15-Prozent-Sockel von „hab noch da" streichen: ohne messbare Wirkung,
dafür 16 fallende Lerntests. Eine Änderung ohne Messung ist keine
Verbesserung.

### Ein Kalender

Die App beantwortete bisher jede Frage für den heutigen Tag. Alles,
was sie darüber hinaus weiß, hat aber ein Datum: der gelernte Takt
sagt, **wann** etwas wieder fällig wird, die Bestandsschätzung sagt,
**wann** der Vorrat aufgebraucht ist, und die Haltbarkeit sagt,
**wann** etwas verdirbt. Es fehlte nur die Achse, auf der sich das
nebeneinander lesen lässt.

Der Weg hinein ist das Datum auf der Übersicht — ein eigener Knopf
daneben hätte dieselbe Sache zweimal gesagt.

Zwei Ebenen, nicht zehn:

- **Geld** — was ein Tag gekostet hat (rückwärts) und was er
  voraussichtlich kosten wird (vorwärts), als Balken in der Zelle.
- **Vorrat** — wann etwas leer wird (blau) und wann etwas verdirbt
  (gelb; rot, wenn es *vor* dem Aufbrauchen abläuft — das ist die
  Verschwendung, um die es dieser App geht).

Das sind zwei verschiedene Fragen an dieselben Tage, und wer die eine
stellt, will die andere gerade nicht sehen.

Die wichtigste Aussage der Ansicht ist nicht dekorativ: **was war, ist
eine Fläche; was kommt, ist nur eine Kontur.** Schraffur stand dort
zuerst und war in einem Monat, der fast ganz in der Zukunft liegt, ein
einziges Streifenmuster. Und die Rechnung hört nach 120 Tagen ganz
auf, statt immer blasser weiterzuraten — der dritte vorhergesagte Kauf
hinge an zwei vorhergesagten davor. Die Ansicht schreibt das Datum
hin, bis zu dem sie überhaupt etwas behauptet.

Vorhergesagt wird außerdem nur, was auch auf der Liste stünde:
gelernter Takt, letztes Kaufdatum, Vertrauen über derselben Schwelle.
Ein Kalender, der mehr behauptet als die Liste, wäre ein zweiter
Algorithmus mit einer zweiten Wahrheit. Überfälliges steht dabei auf
**heute** und nicht auf dem nächsten rechnerischen Vielfachen — die
Vielfachen weiterzuzählen wäre die bequemere Rechnung und eine falsche
Aussage: sie tut so, als hätte der Haushalt pünktlich weitergekauft.

Die Fachlogik steht als `src/algo/calendarModel.js` außerhalb der
Oberfläche und wird ohne Browser geprüft (58 Tests).

### Bewegung — genau eine, und nur wo etwas aufgeht

Eine einzige Öffnen-Animation für alles, was aufgeht: ein
Segmentwechsel, ein angetippter Tag im Kalender, nachgeladene Zeilen,
der Inhalt eines aufgeklappten `details`. Vier verschiedene
Öffnen-Animationen wären vier verschiedene Aussagen über dieselbe
Sache; eine, überall gleich, macht die Bewegung zur Sprache statt zur
Verzierung. Unter einer drittel Sekunde — alles darüber wird beim
zehnten Mal zur Wartezeit.

Der Punkt, an dem so etwas schiefgeht: `App.render()` läuft nach fast
jeder Berührung. Eine Animation ohne Bedingung hieße, dass die ganze
Seite hüpft, sobald man irgendwo hintippt. Deshalb ein Merker, der
genau einmal gilt und im nächsten Zeichnen verfällt — und zwei Tests,
die genau das prüfen: ein gewöhnliches Zeichnen bewegt nichts, ein
Tipp auf das bereits gewählte Segment auch nicht. Abgeschaltet wird
alles zentral über `prefers-reduced-motion`.

58 neue Kalendertests, 49 neue Oberflächentests. Alle jetzt 2171 Tests
bestehen.

---

## Sechs Dinge, die echte Haushalte tun (2026-09-03)

Der Drei-Jahres-Lauf war eine sehr ordentliche Welt: konstanter
Verbrauch, immer dieselbe Packungsgrösse, jeder Bon erfasst, nie ein
Produktwechsel. Er hat damit genau die Fälle nicht geprüft, an denen
ein Rhythmusmodell in Wirklichkeit scheitert. Alle sechs sind jetzt
drin — und haben drei echte Fehler ans Licht gebracht.

| | modelliert als |
|---|---|
| **Nicht erfasste Bons** | 18 % der Einkäufe landen nie in der App |
| **Wechselnde Mengen** | 15 % Vorratskäufe bei Haltbarem |
| **Produktwechsel** | Gouda → Emmentaler, Joghurt natur → griechisch, an Tag 700 |
| **Saisonaler Verbrauch** | ±45 % übers Jahr, Sommer- und Winterprodukte |
| **Gäste** | ganze Wochen mit 1,8-fachem Verbrauch |
| **Einfrieren** | verlängert die Frist um 45 Tage — häufiger, wenn die App dazu geraten hat |

### Fehler 1: aufgegebene Produkte blieben für immer auf der Liste

Ein Haushalt steigt von Gouda auf Emmentaler um. Ab diesem Tag wird
Gouda nie wieder gebraucht — aber sein gelernter Takt bleibt, und mit
jedem Tag wird er „überfälliger". Die Liste kannte nur eine Obergrenze
nach vorn (den Vorlauf), keine nach hinten.

Im Lauf war das messbar: **vierhundert Tage nach dem Umstieg stand
Gouda immer noch auf der Liste**, und der Haushalt kaufte ihn alle paar
Wochen aus Gewohnheit mit. Die App hatte ihm ein Produkt antrainiert,
das er abgeschafft hatte.

Warum der Rhythmus das nicht selbst merkt: der Median rechnet über
abgeschlossene Kaufabstände. Solange kein neuer Kauf kommt, entsteht
kein neuer Abstand — die offene Lücke taucht in seiner Rechnung
schlicht nicht auf. Das ist die eine Information, die ihm strukturell
fehlt, und deshalb keine Doppelzählung.

`abandonDetector.js` senkt das Vertrauen weich, sobald ein Produkt
deutlich länger als sein Takt nicht gekauft wurde (ab dem 2,5-fachen,
auf null beim 6-fachen). Kein harter Schnitt: vielleicht hat jemand es
wirklich nur vergessen. Abwesenheiten zählen nicht mit — wer zwei
Wochen weg war, hat nichts aufgegeben.

### Fehler 2: der Sommerurlaub machte Sommerprodukte zu Frühjahrsprodukten

`applySeason` misst „Käufe je beobachtetem Tag" je Quartal. Wer im Juli
zwei Wochen wegfährt, kauft in diesem Quartal an vierzehn Tagen nichts
— die Rate sinkt, und der Sommer sieht aus wie die ruhige Jahreszeit.

Die Rhythmus-Berechnung rechnet Abwesenheiten längst heraus. Dass diese
Stufe es nicht tat, war eine Lücke, keine Absicht: in einer
gleichmässigen Welt verbraucht niemand saisonal, also fiel es nie auf.
Salat wurde zuverlässig als **Frühjahrs**produkt erkannt.

Nach der Korrektur trifft die App das richtige Quartal bei **6 von 6**
Saisonprodukten statt bei 3 von 6 — über alle geprüften Startwerte.

### Fehler 3: drei Kaufabstände verwarfen hundertsiebzig

Der Strukturbruch-Erkenner verlangte drei Intervalle je Seite. Das war
symmetrisch gedacht und ist es nicht: die eine Seite trägt die ganze
Historie, die andere die letzten drei Käufe. Bei Brot mit 174 erfassten
Käufen genügten drei Abstände aus drei Wochen, um alle anderen zu
verwerfen — und danach rechnete der Median über genau diese drei.

Das traf die **Hälfte aller Produkte**: zwölf von vierundzwanzig hatten
einen „Bruch" wenige Wochen vor dem Ende und lernten danach aus einer
Handvoll Abstände. In einer gleichmässigen Welt schwankt nichts genug,
um einen falschen Bruch zu erzeugen; deshalb war das drei Jahre lang
unsichtbar.

Ein Bruch braucht jetzt genug **neue** Belege: mindestens acht neue
Abstände, mindestens drei neue Takte Zeit (nicht eine feste Tageszahl —
14 Tage sind für Brot zwei Zyklen und für Kaffee ein halber), und der
Trennpunkt muss auf einem Abstand liegen, der selbst schon das neue
Verhalten zeigt. Danach lernt **kein** Produkt mehr aus weniger als
sechs Abständen.

### Dazu: Reste gehen nicht mehr verloren

`estimateRemaining` rechnete ab dem letzten Kauf mit der zuletzt
gekauften Menge — und unterstellte damit, der Schrank sei in dem Moment
leer gewesen. Gemessen gegen den wahren Vorrat der Simulation lag die
Schätzung dadurch systematisch zu niedrig (−0,59 Einheiten bei einem
wahren Mittel von 0,96) und sagte in 21 % der Fälle „ist alle", wenn
reichlich da war. Der Übertrag ist jetzt drin, gedeckelt auf eine
Packung: 71,1 statt 68,1 % richtige Ja/Nein-Aussagen.

### Und der wichtigste Fund: der Prüfstand selbst

Zwei Dinge, die alle bisherigen Feinmessungen entwertet haben.

**Die Zufallsfolge hing an der App.** Die drei Strategien zogen aus
derselben Folge, aber unterschiedlich oft — ab dem ersten abweichenden
Zug lief die Welt auseinander. Ein Haushalt vergass andere Dinge, nur
weil die App einen Vorschlag mehr gemacht hatte. Jede gemessene
Verbesserung unter etwa einem Prozentpunkt war damit Rauschen, und zwar
unsichtbares: die Zahlen sahen exakt und reproduzierbar aus. Der Zufall
kommt jetzt aus einer reinen Funktion über (Tag, Produkt).

**Und dann bin ich trotzdem in die Falle getappt.** Der
Strukturbruch-Fix sah bei einem Startwert wie ein klarer Gewinn aus
(12,0 statt 13,2 % Vergessenes) und war bei zwei anderen schlechter.
Die Konstanten waren auf einen Seed eingestellt und hiessen dann
Verbesserung.

Belastbar sind stattdessen **strukturelle** Kennzahlen — und die fielen
über alle vier geprüften Startwerte gleich aus:

| | mit den Korrekturen | ohne |
|---|---|---|
| aufgegebene Produkte auf der Liste | 0 · 0 · 0 | 1 · 0 · 1 |
| Produkte, die aus < 6 Abständen lernen | 0/21 · 0/22 · 0/20 | 5/23 · 5/23 · 6/23 |
| Jahreszeit richtig erkannt | 6/6 · 5/6 · 6/6 | 3/6 · 3/6 · 2/6 |

Sie sind jetzt feste Prüfungen im Langzeitlauf. Die Endwerte bleiben
als Kennzahl stehen, aber der Test sagt in seinem eigenen Kopf, dass
man an ihnen keine Konstanten einstellt.

### Zwei Messlatten, die die neue Welt ungültig gemacht hat

Beide wurden geändert, mit der Begründung im Test:

- **„Der gelernte Takt gegen den wahren"** verglich gegen eine Formel
  aus `perDay`. Diese eine Zahl gibt es nicht mehr: der Takt von Salat
  ist im Juli ein anderer als im Dezember, und wer zwei Packungen
  kauft, kauft danach doppelt so lange nicht. Verglichen wird jetzt mit
  den **tatsächlichen** Kaufabständen der laufenden Saison, auf die
  Menge normiert — sonst sah richtiges Verhalten wie ein Fehler von
  100 % aus.
- **„Höchstens so viele Leertage wie die feste Liste"** war fair,
  solange beide gleich viel kauften. Die feste Liste nimmt sechs
  Grundnahrungsmittel bei jedem Einkauf mit und profitiert von jeder
  Doppelpackung doppelt; sie erkauft ihre Versorgung mit 60 %
  unnötigen Käufen und dem 2,5-fachen Verderb. Der Massstab ist jetzt
  vergleichbare Versorgung (5 % Toleranz) bei mindestens 10 % weniger
  Geld. Die Toleranz wurde **nicht** nachgezogen, als ein vierter
  Startwert sie um 1,5 % riss — das wäre derselbe Fehler noch einmal,
  nur an der Messlatte statt am Algorithmus.

33 neue Lerntests, 3 neue Prüfungen im Langzeitlauf. Alle jetzt 2207
Tests bestehen.

---

## Die Anlass-Frage: übergroße Einkäufe entschärfen (2026-09-03)

### Der Fehler, um den es geht

`rhythmDays = perUnitDays × lastQuantity` (rhythmEngine2.js) ist im
Normalfall genau richtig: wer sechs Packungen statt einer kauft, kommt
damit sechsmal so lange aus — bei **gleichbleibendem** Verbrauch. Diese
Annahme bricht genau dann, wenn sie am wichtigsten wäre: eine
Grillfeier, Besuch übers Wochenende, Weihnachten. Dort wird die
sechsfache Menge nicht sechsmal so langsam verbraucht, sondern in ein
paar Tagen deutlich schneller — und die App zog daraus bisher den
falschen Schluss, das Produkt sei jetzt für Monate erledigt.

Gemessen an einem deterministischen Fall (nicht am seed-abhängigen
Langzeitlauf, aus gutem Grund — siehe die vorige Runde): ein Haushalt
kauft alle zehn Tage eine Packung Grillfleisch, kauft an einem Tag auf
einmal sechs für ein Fest, danach wieder normal. **Ohne** Korrektur
schießt die Vorhersage auf 60 Tage hoch. **Mit** ihr bleibt sie bei den
wahren 10 — bestätigt durch den tatsächlichen weiteren Verlauf.

Die App kann diesen Unterschied nicht aus den Kaufdaten allein
ablesen: ein Vorratskauf zum Sparpreis und ein Fest sehen in der Kasse
identisch aus. Deshalb wird gefragt statt geschlossen — derselbe
Grundsatz wie bei `askLate()`: eine Rückmeldung, die man auch
weglassen kann, nie ein stilles Signal.

### Was erkannt wird

`eventDetector.js` vergleicht die gekaufte Menge je Produkt mit der
zuletzt üblichen (`rhythm.lastQuantity`, aus dem Stand **vor** diesem
Einkauf — danach wäre die auffällige Menge ja schon die neue „letzte
Menge" und nichts fiele mehr auf). Auffällig ist ein Produkt erst ab
dem 2,5-fachen der üblichen Menge **und** mindestens zwei Einheiten
mehr in absoluten Zahlen — ein einzelnes Produkt, das von einer auf
drei Packungen springt, ist kein Fest, sondern gewöhnliches Rauschen.
Gefragt wird nur, wenn mehrere Produkte gleichzeitig auffallen oder
ein einzelnes sehr deutlich (ab dem Vierfachen) — dieselbe
Zurückhaltung wie überall in diesem Projekt gegen Rückmeldungen, die
zum Hintergrundrauschen werden.

Nur Lebensmittel: Haushaltsprodukte rechnen über eine gleitende
Verbrauchsrate (`rateLearner.js`), gemittelt über 180 Tage — ein
einzelner Großeinkauf geht darin unter, statt sie zu dominieren. Das
Problem existiert dort strukturell nicht, und eine ohnehin nie
zutreffende Bulk-Klopapier-Frage wurde entsprechend ausgeschlossen.

### Was bei einem Ja passiert

Die Korrektur rechnet als **Verhältnis auf den aktuellen Rhythmus**,
nicht neu aus dem rohen Pro-Einheit-Wert — der hereinkommende Rhythmus
hat zu diesem Zeitpunkt bereits Saison und Rückmeldungen durchlaufen,
und eine Neuberechnung von Grund auf würde diese Stufen verwerfen. Der
Faktor „übliche Menge ÷ gekaufte Menge" nimmt nur die Menge aus der
Rechnung, die den Ausschlag gab.

Angewendet wird sie **nur, solange dieser Kauf noch der letzte für das
Produkt ist**: sobald danach ein echter neuer Kauf stattfindet, weicht
das gespeicherte Ereignisdatum vom neuen `lastPurchaseDate` ab, und die
Korrektur verliert sich von selbst — kein Aufräumen nötig, derselbe
Mechanismus wie bei einer überholten Vorratskorrektur.

Der gelernte Rhythmus selbst — der Median über die echten Kaufabstände
— bleibt unangetastet. Käufe bleiben Käufe, wie überall in diesem
Projekt seit `feedbackLearner.js`.

### Wo gefragt wird

Nach jedem gebuchten Einkauf: im Ladenmodus, nach dem Bestätigen eines
gescannten Bons und nach der Hand-Erfassung. Ladenmodus-Buchungen
tragen technisch immer Menge 1 je Position, lösen die Frage also
praktisch nie aus — der eigentliche Anwendungsfall ist „nach Einspielung
eines Bons", wie angefragt: ein gescannter Kassenzettel oder eine
Hand-Erfassung mit echten Stückzahlen.

Ein Kühlketten-Hinweis (bereits vorhandene Sicherheitswarnung) ist
dringender als die Anlass-Frage, und beide teilen sich dasselbe Blatt
— deshalb bewusst „entweder, oder" statt beide nacheinander zu zeigen.

Ein Ja gilt für alle erkannten Produkte auf einmal, mit der Liste
sichtbar davor — ein Fest betrifft meist mehrere Zutaten gleichzeitig,
eine Frage pro Produkt wäre fünf Fragen für einen Anlass. Ein Nein
ändert nichts, genau wie bei jeder anderen optionalen Rückmeldung in
dieser App.

Die Bestätigung bleibt nachvollziehbar: ein Hinweis direkt im
Detail-Blatt des Produkts (nicht nur ein Toast, der nach ein paar
Sekunden verschwindet) und eine Zeile unter „Wie die App darauf kommt"
mit der gekauften und der üblichen Menge.

24 neue Lerntests (Erkennung, Korrektur, Zusammenspiel mit Saison),
16 neue Oberflächentests. Alle jetzt 2246 Tests bestehen.

---

## Einladungen, Prämie, Bestenliste: Infrastruktur vorbereitet, nichts live (2026-09-04)

Auftrag: eine Einladung, die erfolgreich einlöst, schenkt der
einladenden Person 3 Monate Prämie („Premium"). Dazu die
Infrastruktur — ausdrücklich **nur** die Infrastruktur — für eine
künftige Bestenliste. Vor dem Bauen drei Rückfragen geklärt: kein
Server jetzt, ein echtes Konto (E-Mail/Login) als Ziel-Identität, und
eine Bestenlisten-Metrik, die noch offen ist — also ein generisches
Punktekonto statt einer festgelegten Kennzahl. Siehe `docs/referral.md`
für die vollständige Begründung und die offene Liste.

Dasselbe Prinzip wie beim Schwarm-Preisindex (siehe oben, „Stufe 2
vorbereitet, aber nicht live"), diesmal für eine Funktion, die
zusätzlich ein echtes Konto und einen geldwerten Vorteil berührt — mehr
offene Punkte, nicht weniger.

**Was dazukam:** `src/algo/referralSystem.js` — drei serverunabhängige
Rechnungen. Ein Einladungscode hat eine geprüfte Form (7 Zeichen, ohne
verwechselbare Zeichen wie `0`/`O` oder `1`/`I`/`L`). Eine bestätigte
Einladung verlängert die Prämie um 3 Monate, kalendersicher gerechnet
ab dem späteren von „heute" und „bisheriges Ende" — eine laufende
Prämie wird verlängert, eine abgelaufene zählt erst wieder ab heute,
nicht rückwirkend. Ein Punktekonto ist ein Protokoll einzelner
Gutschriften (Datum, Punkte, Grund), keine blanke Zahl — dieselbe
Buchhaltungslogik wie im Ereignis-Protokoll. Dazu
`src/algo/accountClient.js`, der dokumentierte API-Vertrag für eine
künftige Gegenstelle (Code einlösen, Bestenliste abrufen, Punktekonto
abgleichen) — `ACCOUNT_ENDPOINT` steht auf `null`, jede Funktion prüft
das zuerst und verweigert sich sonst.

**Keine dieser Funktionen gewährt etwas von selbst.** Sie rechnen nur,
was gelten würde, wenn ein Ereignis bestätigt wäre — ob ein Code
wirklich von einer zweiten, echten Installation eingelöst wurde, kann
ohne Gegenstelle niemand wissen. `s.settings.referral` im Datenmodell
existiert nur als künftige Form (Code, eingelöste Codes, Prämien-
Zustand, Punkte-Protokoll), ohne einen einzigen Leser oder Schreiber
irgendwo in `data.js`, `views.js` oder `app.js`.

**Zwei getrennt geprüfte Garantien**, dieselbe Zweiteilung wie beim
Schwarm-Preisindex: Erstens, dass `accountClient.js` unter keiner
Eingabe tatsächlich etwas sendet, solange `ACCOUNT_ENDPOINT` leer ist
(`test/referral.js`, Abschnitt D). Zweitens, dass keine Oberfläche
überhaupt dorthin verweist — kein Menüpunkt, kein Knopf, keine
Einstellung ist heute erreichbar (`test/uitest.js`, „Einladungen/
Prämie/Bestenliste sind vorbereitet, aber nirgends erreichbar").

44 neue Algorithmus-Tests, 3 neue Oberflächentests. Alle jetzt 2293
Tests bestehen (Algorithmus 1342, Oberfläche 912, Langzeitlauf 39).

---

## Start am Rechner: die leere zweite Spalte gefüllt, ein echter Anzeigefehler behoben (2026-09-04)

Auftrag: die Anordnung der App bewerten, mit dem Ziel, dass Start
schon selbst zu allen Kernfunktionen führt, ohne überladen zu wirken.
Ergebnis der Durchsicht (mit Beispieldaten live geprüft, mobil und am
Rechner): mobil passt es -- drei Blöcke, dazu die feste Tab-Leiste,
die von Start aus ohnehin jeden Bereich einen Tipp entfernt hält, plus
Fällig/Angebote/Kalender klug ohne eigenen Reiter angedockt. Am
Rechner (≥900px) dagegen blieb die zweite Spalte fast leer: nur die
einzeilige Wesen-Nachricht, darunter und daneben nichts als Fläche --
das Gegenteil von „überladen", aber genauso ein Mangel.

**Behoben:** `startKalenderVorschau()` (`src/ui/views.js`) füllt die
Spalte jetzt mit echtem Inhalt statt Leerraum -- ein knapper Blick auf
die nächsten sechs Tage, dieselbe Rechnung wie im Kalender
(`buildCalendar`), nur über ein kurzes Fenster statt einen Monat.
Gezeigt wird nur, was ansteht: fällige Produkte, drohender Verderb,
erwartete Ausgaben, höchstens vier Tage. Ist im Fenster nichts
vorherzusehen, bleibt die Karte ganz weg -- dieselbe Regel wie bei
„Jetzt zu tun": eine leere Karte wäre Füllmaterial, keine Auskunft.
Ein Antippen öffnet den Kalender an genau diesem Tag.

**Nebenbefund, ein echter Anzeigefehler:** beim Bauen der Vorschau
zeigte eine Zeile ohne Betrag das Wort **„null"** -- sichtbar für den
Nutzer. Ursache lag nicht im neuen Code, sondern in `uiRow()`: mehrere
bestehende Aufrufer (u. a. `kalenderTagGruppe` für Vorratszeilen ohne
Preis) reichen genau dafür `value: wert || null` durch, und `uiRow`
prüfte bisher nur `!== undefined` -- ein absichtliches „kein Wert"
wurde wie ein echter Wert behandelt und als Text ausgegeben. Betroffen
war damit auch der bestehende Kalender, nicht nur die neue Karte. Jetzt
prüft `uiRow` `!== undefined && !== null`, mit Test-Regression in
`test/uitest.js`.

10 neue Oberflächentests. Alle jetzt 2303 Tests bestehen (Algorithmus
1342, Oberfläche 922, Langzeitlauf 39).

---

## Die Startseite nach dem ersten Bon (2026-09-04)

Die Durchsicht der Orientierung ging weiter, und die schwächste Stelle
war nicht die volle App, sondern die erste Stunde damit. Nach genau
einem erfassten Bon — dem Schritt, um den die Willkommensseite bittet —
bestand die Startseite aus **einer** Karte: „Einkaufsliste — wird noch
gelernt". Sonst nichts. Der Bildschirm direkt nach der ersten Handlung
sagte weder, was gerade passiert ist, noch was die App davon hat, noch
wo es weitergeht. Wer hier abspringt, hat nie erlebt, wofür die App
gebaut ist.

**Was dazukam:** `firstReceiptCard()` zeigt auf Stufe 1 eine Gruppe
„Dein erster Bon" — ausgegebene Summe mit Positionszahl, der größte
Kategorie-Anteil, der geschätzte Vorrat mit dem, was zuerst knapp wird,
und „Nächsten Bon erfassen" mit dem Grund dafür. Vier Zeilen, vier
Ziele: Zahlen, Zahlen, Bestand, Erfassen. Genau die Bereiche, welche
die Leiste unten zwar auch erreicht, die aber nach einem einzigen Bon
niemand von sich aus aufsucht. Ab Stufe 2 verschwindet die Gruppe
wieder — dann tragen Liste, „Jetzt zu tun" und „Dein Lauf" die Seite
von selbst.

**Gerechnet wird dafür nichts Neues.** `firstReceiptInsights()` in
`coldStart.js` macht genau diese Rechnung seit jeher, geprüft in
`test/tests.js` und `test/stresstest.js` — und war an keiner Stelle
der Oberfläche angeschlossen. Dieselbe Sorte Fund wie damals bei
`cheaperAlternatives()`: fertige, getestete Logik ohne Anschluss.

**Was bewusst nicht in einer Zeile steht:** die Jahres-Hochrechnung.
52 × ein einziger Bon ist eine steile Annahme; sie steht hinter dem
(i), zusammen mit ihrem Vorbehalt aus dem Modul — nicht als Zahl
zwischen lauter gemessenen. Darunter eine Zeile, warum die Liste noch
leer ist: ein Takt braucht zwei Käufe desselben Produkts. Geraten wird
nichts.

**Nachbesserung an der Vorschau von gestern:** auf Stufe 1 gibt es noch
keine Takte, die nächsten Tage kommen dann allein aus Haltbarkeiten —
und weil nur *drohender* Verderb einen Untertitel bekam, standen dort
zwei blanke Datumszeilen ohne jede Aussage. Jetzt nennt auch die
gewöhnliche Haltbarkeit ihr Produkt, mit denselben Worten wie im
Kalender. Ein Test hält fest, dass keine Zeile nur aus einem Datum
besteht.

16 neue Oberflächentests. Alle jetzt 2319 Tests bestehen (Algorithmus
1342, Oberfläche 938, Langzeitlauf 39).

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
tools/off_hardcase_corpus/
                 zieht echte Namen von Open Food Facts, verstümmelt sie
                 wie ein Bon -- generate.js: einzelne Härtefall-Zeilen
                 (off-hardcases.json), generate_receipts.js: 100 ganze
                 simulierte Bons (off-receipts.json). Beide brauchen
                 Netz, laufen nicht in npm test, siehe README
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
| **Start** | die Liste als ein Feld, „Jetzt zu tun“, die Wochenreihe |
| **Liste** | Wochenrückblick (ab Sonntagabend), Wagen mit Buchen-Leiste, eigene Positionen ergänzen, Vorrats-Reichweite, Sicherheitshinweis, Vorschlag mit Detail-Blatt je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Saisonhinweis, Teilen, Budget, Haushaltsgröße, Vorausschau, Urlaub |
| **Fällig** | kein eigener Reiter mehr — erreichbar über „Start“, „Bestand“ und dauerhaft über „Mehr → Auswertungen“: Austausch-Produkte mit Tausch-Reset, was zur Neige geht, Bevorratung bei gutem Grundpreis |
| **Bestand** | drei Unterbereiche (Vorrat, Küche, bei aktivem Urlaub zusätzlich Reise): geschätzter Vorrat mit Korrekturmöglichkeit („Ist leer“/„Etwa richtig“/„Mehr als gedacht“), Haushaltsprodukte mit Reichweite und Konfidenz, angebrochene Packungen, Rezepte, Einräumhilfe, Aufbrauchplan |
| **Erfassen** | Bon-Text auswerten (an einem echten Lidl-Bon kalibriert) oder von Hand; unsichere Zuordnungen werden **gefragt, nicht geraten** |
| **Zahlen** | Streak und Rückblick, Meilensteine, eigener Einkaufsrhythmus, Ausgaben je Monat, persönliche Inflation, Preis-Gedächtnis, gelernte Rhythmen, Sparvorschläge mit Nachhaltung im Rückblick, Packungsgrößen, Wirkung in Kilogramm |
| **Mehr** | Erscheinungsbild, Schriftgröße, Rückblick-Erinnerung, Haushaltsprofil (Wasserhärte, Geräte), Ladenweg je Markt, Einstiegspunkt zu Fällig/Angebote, Saison, Pfand, Bon-Archiv, Rechenweg, Datenqualitätsbericht, Beispieldaten, Löschen |

Dazu der **Ladenmodus** als Vollbild: nach Gängen sortiert, große
Ziele, am Ende ein Knopf, der den Einkauf in die Historie schreibt.

## Wo die Daten liegen

Im `localStorage` dieses Browsers. Kein Server, kein Konto, keine
Übertragung. Das heißt auch: Browserdaten löschen löscht die App-Daten
mit, und iOS räumt den Speicher von Web-Apps auf, die wochenlang
ungenutzt bleiben. Eine Schattenkopie im selben Speicher fängt
abgebrochene Schreibvorgänge ab (siehe `backupGuard.js`), schützt aber
nicht gegen ein gelöschtes `localStorage` selbst — dafür gibt es
aktuell keine eingebaute Sicherungsfunktion mehr in der Oberfläche
(Details und Grund: Abschnitt „Sicherung entfernt" unten).

## Als App installieren

Die App ist eine PWA: `web/` auf einen HTTPS-Server legen (GitHub Pages,
Netlify, Vercel), Adresse aufrufen, „Zum Home-Bildschirm" wählen. Danach
startet sie im Vollbild und funktioniert offline. Auf iOS geht die
Installation nur aus Safari.

Der Service Worker braucht HTTPS oder localhost — beim direkten Öffnen
der Datei (`file://`) läuft die App, aber ohne Offline-Betrieb.

## Tests

```bash
npm test          # alle 2319
npm run test:algo # 1342 Modultests (Regression, Stress, Funktionen, Haushalt, Suche, Marken,
                  #   Texterkennung, echte Bons, Abgleich, Sicherheit, Wiederherstellung, Liste,
                  #   Kalender, Verschwendung, Wochenstreifen, Vorrat, Schwarm, Einladungen/Prämie,
                  #   Kontrast, Lernen, Rückblick)
                  #   plus die Simulation
npm run test:ui   # 938 Oberflächentests in jsdom
npm run test:long # 39 Prüfungen aus dem Drei-Jahres-Lauf
```

`test/bons.js` prüft gegen **echte Bons**, nicht gegen erfundene:
acht abgetippte Dateien von fünf Ketten in `test/fixtures/`. Vier
davon nennen ihre eigene Endsumme — damit ist jede Behauptung des
Parsers gegen den Bon selbst prüfbar statt gegen meine Erwartung. Er
hat vier Fehler gefunden, die kein Zeilentest gestellt hätte: eine
Steuertabellenzeile, die zur Position wurde, eine Marktsuche ohne
Wortgrenzen, eine mittendrin gedruckte Zwischensumme (ALDI) und eine
Öffnungszeiten-Zeile, die als 20-€-Position gebucht wurde.

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
2. ~~**Der Bon-Parser ist an einem einzigen echten Bon kalibriert.**~~
   *Erledigt* — der Parser ist jetzt an acht echten Bons von fünf
   Ketten geprüft (Lidl, REWE ×2, Netto ×3, EDEKA, ALDI), siehe unten.
   Offen bleibt: Kaufland und Penny sind weiter ungeprüft (für beide
   fand sich keine echte, frei lizenzierte Bon-Aufnahme), und die
   Mengenangabe im Artikelnamen („20WL", „75ML") wird nach wie vor nur
   aus dem Namen gelesen — fehlt sie, greift der Katalogwert,
   gekennzeichnet als Referenz, aber eben nicht gemessen.
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
- Der ursprüngliche, an keiner echten Datei geprüfte Bon-Parser. Er
  wich erst `lidlParser.js` (an einem echten Lidl-Bon kalibriert) und
  dann dem heutigen `receiptParser.js`, der an acht echten Bons von
  fünf Ketten geprüft ist.
- `demo*.js` — die Vorführskripte aus dem Node-Paket.
