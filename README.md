# Einkaufs-Anker — Web-App

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus den eigenen
Kassenbons. Kein KI-Modell, kein Server, kein Konto: robuste Statistik,
Textabgleich und Tabellen, gerechnet im Browser.

```bash
npm install     # nur für die Tests (jsdom)
npm run dev     # baut und startet http://localhost:8000
npm test        # 1462 Tests, Simulation und Drei-Jahres-Langzeitlauf
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
| **Eckige Flächen, runde Punkte** | Karten, Zeilen, Knöpfe, Felder und Balken haben scharfe Kanten. Rund bleibt nur, was ein Punkt ist: Abhak-Kreise, der Pfeilkreis, Streak-Punkte, der Schalter, die Marken. |
| **Eine eigene Schrift** | Manrope, mitgeliefert statt geladen. Halb-grotesk, offene Punzen, sehr ruhige Ziffern, hohe x-Höhe — freundlich, ohne verspielt zu sein. |

Dazu Bewegung mit ein wenig Nachschwingen (`cubic-bezier(.34,1.56,.64,1)`):
Knöpfe federn beim Druck, das Häkchen springt auf, das Glückwunsch-
Abzeichen dreht sich hinein. Bei „Bewegung reduzieren" entfällt alles
davon, ohne dass Inhalt verloren geht.

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

Dabei war alles fertig gebaut. Die Suche über 846 Produkte, das freie
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
| **Start** | Wochenstreifen (sieben Tage, jedes Feld ein Ereignis), die Liste als ein Feld, „Jetzt zu tun“, die Wochenreihe |
| **Liste** | Wochenrückblick (ab Sonntagabend), Wagen mit Buchen-Leiste, eigene Positionen ergänzen, Vorrats-Reichweite, Sicherheitshinweis, Vorschlag mit Detail-Blatt je Zeile, Preis-Gedächtnis, Vergessens-Detektor, Einfrier-Empfehlung, Saisonhinweis, Teilen, Budget, Haushaltsgröße, Vorausschau, Urlaub |
| **Fällig** | kein eigener Reiter mehr — erreichbar über „Start“ und „Bestand“: Austausch-Produkte mit Tausch-Reset, was zur Neige geht, Bevorratung bei gutem Grundpreis |
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
npm test          # alle 1462
npm run test:algo # 923 Modultests (Regression, Stress, Funktionen, Haushalt, Suche, Marken,
                  #   Texterkennung, Sicherheit, Sicherung, Verschwendung, Wochenstreifen,
                  #   Kontrast, Lernen, Rückblick) plus die Simulation
npm run test:ui   # 496 Oberflächentests in jsdom
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
