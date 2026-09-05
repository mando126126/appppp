# Ernährungsweisen — Konzept

> Stand: 05.09.2026 · Stufe 1 ist gebaut (`src/algo/dietProfiles.js`,
> siehe README „Ernährungsweisen — rein optional"). Dieses Dokument
> entwickelt daraus das vollständige Konzept: was die App über
> Ernährung sagen kann, was sie ausdrücklich nicht sagt, in welcher
> Reihenfolge das gebaut wird und woran man erkennt, dass es
> funktioniert.

---

## 0. Der Satz, an dem sich alles entscheidet

**Die App bewertet nicht deine Ernährung. Sie misst deinen Korb an
einem Ziel, das du dir selbst gesetzt hast.**

Das ist keine Formulierungsfrage, sondern die Bedingung, unter der
diese Funktion in dieser App überhaupt existieren darf. Denn es gibt
eine ältere, ausdrückliche Entscheidung dagegen — sie steht im Kopf
von `recipeMatcher.js`:

> „Bewusst KEINE Nährwerte, keine Kalorien, keine Bewertung von
> Lebensmitteln — siehe Persona-Bericht (Ernährungsberaterin und Ronny
> unabhängig voneinander): beim Geld bleiben, nicht beim Körper."

Diese Entscheidung wird hier **nicht aufgehoben, sondern präzisiert**.
Sie richtete sich gegen etwas Bestimmtes: gegen eine App, die dem
Nutzer sagt, wie er zu essen hat. Der Unterschied, auf dem das ganze
Konzept steht:

| Was die App NICHT tut | Was die App tut |
|---|---|
| „Du isst zu viel Zucker." | „22 % deiner Lebensmittel-Ausgaben gingen an Süßes. Dein Ziel: 15 %." |
| „Fleisch ist ungesund." | „Fleischanteil, 12 Wochen: 31 → 24 %." |
| „Du brauchst mehr Eiweiß." | „Im Korb dieser Woche: 405 g Protein aus 75 Positionen." |
| Bewertet Lebensmittel | Zählt, was gekauft wurde |
| Setzt Ziele | Rechnet gegen ein Ziel, das der Nutzer gesetzt hat |

Der zweite Teil der Persona-Erkenntnis gilt unverändert und ist hier
noch strenger anzuwenden als beim Geld: **kein Vergleich mit anderen,
keine Wertung, kein Vorwurf** (`impactMetrics.js`: „bewusst ohne
Wertung … weil das laut Persona-Bericht zum Deinstallieren führt";
`expiryWarning.js`: „keine Vorwurfsformulierung, sondern eine
Handlungsoption"). Beim Essen ist die Fallhöhe höher als beim Geld —
wer sich für seinen Einkauf schämt, löscht die App noch schneller.

**Und der harte Vorbehalt, der in jeder Ansicht mitläuft: der Korb ist
nicht der Teller.** Die App sieht Bons. Sie sieht keine Kantine, kein
Restaurant, keine Einladung, keine Reste, nichts von dem, was im
Haushalt tatsächlich wovon isst. Jede Aussage hier ist eine Aussage
über **Einkäufe**, und sie sagt das auch.

---

## 1. Warum diese App das überhaupt kann — und fast niemand sonst

Jede Ernährungs-App der Welt scheitert an derselben Stelle: sie
verlangt ein Tagebuch. Wiegen, tippen, schätzen, jeden Tag. Nach zwei
Wochen hört das auf, und die Datenlage ist tot.

Diese App hat das Tagebuch schon — es heißt Kassenbon, es wird ohnehin
erfasst, es ist vollständig, es lügt nicht und es kostet keine
zusätzliche Handlung. Was hier möglich ist, ist deshalb nicht ein
schlechteres Yazio, sondern etwas, das Yazio nicht kann:

- **Monate statt Momente.** Nicht „was habe ich heute gegessen",
  sondern „wie hat sich mein Einkauf über zwölf Wochen verschoben".
- **Vollständigkeit statt Stichprobe.** Kein Vergessen, kein
  Schönrechnen — es steht auf dem Bon oder es wurde nicht gekauft.
- **Der Haushalt statt der Person.** Was für eine Ernährungs-App eine
  Schwäche ist (die App weiß nicht, wer was isst), ist hier ehrlich
  benannter Rahmen: es geht um den Einkauf eines Haushalts.
- **Die Verbindung zu Geld und Verderb.** Nur diese App weiß, dass die
  Umstellung auf mehr Frischware auch mehr Verderb bedeutet — und was
  das kostet. Das ist der ehrlichste Ernährungsratschlag, den es gibt,
  und ihn gibt sonst niemand.

---

## 2. Datengrundlage: drei Quellen, drei Qualitäten

Dieselbe Disziplin wie bei den Haltbarkeiten in `foodDatabase.js`
(„regulatorisch / leitlinie / schaetzwert"): **jede Aussage kennt ihre
Herkunft, und wo die Herkunft dünn ist, sagt die App das.**

### Quelle A — der eigene Katalog (1727 Produkte, offline, geprüft)

Trägt heute schon: Kategorie, Name, Gang, Lagerort, Haltbarkeit,
üblicher Preis, übliches Gewicht. Daraus **strukturell** ableitbar und
ohne jede Nährwertangabe belastbar:

- Ist das Fleisch, Fisch, Milchprodukt, Gemüse, Süßware, Fertiggericht?
- Wie viel Gewicht und wie viel Geld entfällt worauf?

Das ist die Grundlage für alles Wichtige. Sie ist offline, prüfbar und
verändert sich nur, wenn jemand den Katalog ändert.

### Quelle B — die Merkmalstabelle (neu, kuratiert, offline)

Was Quelle A nicht hergibt, aber ohne Nährwerte entscheidbar ist,
kommt in eine **eigene Merkmalstabelle** — die geordnete Fortsetzung
dessen, was Stufe 1 als Stammlisten begonnen hat:

```
merkmale("wurst_salami") → ["tierisch", "fleisch", "schwein", "verarbeitet"]
merkmale("linsen")       → ["pflanzlich", "huelsenfrucht", "ballaststoffreich"]
merkmale("bier")         → ["alkohol"]
merkmale("brot_vollkorn")→ ["pflanzlich", "vollkorn"]
```

Merkmale sind **Eigenschaften, keine Bewertungen**. „ballaststoffreich"
ist eine Aussage über Linsen, „gesund" wäre eine über den Menschen.

Qualitätsstufe: kuratiert. Getestet wird nicht nur die Zuordnung,
sondern — nach zwei einschlägigen Fehlern in Stufe 1 — auch, **dass es
jede genannte Kennung im Katalog wirklich gibt.**

### Quelle C — Open Food Facts (vorhanden, opt-in, zwischengespeichert)

`src/ui/offLookup.js` fragt heute schon genau einen fremden Dienst,
und zwar nach ausgeschriebenen Produktnamen für Bon-Zeilen, die der
lokale Abgleich nicht kennt. Vier Grenzen stehen dort bereits: nur der
Name geht raus, jede Schreibweise höchstens einmal, ohne Netz still
übersprungen, Timeout.

Dieselbe Leitung trägt mehr: OFF liefert zu einem Treffer auch
`labels_tags` (u. a. `en:vegan`, `en:vegetarian`), `nutriments` und
`allergens_tags`. Das ist der einzige realistische Weg, über die 1727
Katalogprodukte hinaus etwas über **Markenprodukte** zu wissen.

Bedingungen, unter denen das zulässig ist — alle vier, nicht drei:

1. **Nur was der Nutzer ohnehin gekauft hat**, nie ein Vorratsabruf
   ganzer Datenbanken.
2. **Dauerhaft auf dem Gerät zwischengespeichert**, dieselbe
   Schreibweise fragt nie zweimal (gilt heute schon).
3. **Immer als Fremdaussage gekennzeichnet:** „laut Open Food Facts",
   mit Datum. OFF ist von Freiwilligen gepflegt, unvollständig und
   stellenweise falsch — als Herkunftsangabe ist das in Ordnung, als
   stille Wahrheit nicht.
4. **Niemals für Allergien** (siehe §7).

### Was ausdrücklich NICHT hereinkommt

| Nicht übernommen | Grund |
|---|---|
| **Nutri-Score** | Ein Buchstabe, der ein Lebensmittel bewertet — genau das, wogegen die Persona-Entscheidung steht. Der ehrliche lokale Ersatz ist der Anteil („Süßes: 22 %"), nicht die Note. |
| **NOVA-Verarbeitungsgrad** | Dasselbe in Grün: eine fremde Skala, die Produkte einordnet. Der Katalog kann „Fertiggericht: ja/nein" selbst, offline und nachvollziehbar. |
| **Kalorien** | Zählen setzt voraus, dass gegessen wird, was gekauft wurde. Tut es nicht. Eine Kalorienzahl auf Bon-Basis wäre eine erfundene Genauigkeit. |
| **Vergleich mit anderen Haushalten** | Persona-Bericht, ausdrücklich. Führt zum Deinstallieren. |

---

## 3. Die drei Arten von Profil

Der Kern des Konzepts: „Ernährungsweise" ist **nicht eine Liste von
Etiketten**, sondern drei verschiedene Fragen, die verschieden
beantwortet werden müssen. Wer sie in einen Topf wirft, bekommt
entweder eine App, die vegan kann und sonst nichts, oder eine, die
alles markiert und damit nervt.

### Art A — Ausschluss: *Was soll gar nicht in den Korb?*

| Profil | Schließt aus | Datenlage |
|---|---|---|
| **Vegetarisch** | Fleisch, Fisch, Gelatine | gebaut |
| **Vegan** | zusätzlich Milch, Ei, Honig | gebaut |
| **Pescetarisch** | Fleisch, nicht Fisch | braucht Trennung `fleisch`/`fisch` — heute in einem Topf |
| **Ohne Schweinefleisch** | Schwein, Schweinegelatine | am Namen entscheidbar, sauber testbar |
| **Ohne Alkohol** | Bier, Wein, Spirituosen | am Namen entscheidbar |

**Wirkung:** eine ruhige Marke „passt nicht" auf der Liste, Ersatz aus
derselben Kategorie im Detail-Blatt. **Nie ein Entfernen.** Die Zeile
steht dort, weil das Produkt gekauft wird; sie stillschweigend zu
streichen wäre eine Entscheidung, die der App nicht zusteht.

**Drei Antworten, nicht zwei** (gebaut und beizubehalten): passt /
passt nicht / **lässt sich nicht sagen**. Rund ein Viertel des
Katalogs fällt in die dritte Gruppe, weil bei Saucen, Fertiggerichten
und Süßwaren die Zutatenliste entscheidet und nicht der Name. Unklares
wird **nicht markiert** und **nicht mitgezählt**, sondern getrennt
ausgewiesen. Ein falscher Haken ist schlimmer als gar keiner.

> **Ausdrücklich kein Profil: „halal" und „koscher".** Am Namen ist
> „kein Schweinefleisch" entscheidbar — Halal ist es nicht, dazu
> gehören Schlachtung und Zertifikat, von denen der Katalog nichts
> weiß. Die App bietet deshalb die Tatsache an („ohne
> Schweinefleisch") und nennt sie nicht nach der Religion. Wer mehr
> braucht, wird von einer falschen Zusage schlechter bedient als von
> keiner.

### Art B — Richtung: *Wovon mehr, wovon weniger?*

Das ist das eigentlich Neue, und es funktioniert grundlegend anders
als Art A: **keine Marke an einzelnen Zeilen.** Ein Profil „weniger
Süßes", das jede Tafel Schokolade auf der Liste antippt, ist genau die
erziehende App, die niemand will.

Stattdessen: **ein Anteil, ein selbst gesetztes Ziel, ein Verlauf.**

| Richtung | Gemessen als | Quelle |
|---|---|---|
| Weniger Fleisch | Anteil an den Lebensmittel-Ausgaben | Katalog |
| Mehr pflanzlich | Anteil pflanzlich | Katalog |
| Mehr Gemüse & Obst | Anteil Frischware, nach Gewicht | Katalog |
| Weniger Süßes & Softdrinks | Anteil Süßes/Snacks + gezuckerte Getränke | Katalog |
| Weniger Fertiggerichte | Anteil Fertiggerichte | Katalog |
| Mehr Vollkorn | Anteil Vollkorn an Backwaren/Trockenware | Merkmalstabelle |
| Mehr Hülsenfrüchte | Anteil Hülsenfrüchte | Merkmalstabelle |
| Weniger Alkohol | Anteil Alkohol an Getränken | Merkmalstabelle |

Zwei Betriebsarten je Richtung, und die erste ist die Vorgabe:

- **Nur beobachten** (kein Ziel): die App zeigt den Anteil und seinen
  Verlauf. Sie bewertet nichts, sie sagt nicht „zu viel". Für viele
  ist das schon der ganze Nutzen — man sieht zum ersten Mal, wie der
  eigene Einkauf zusammengesetzt ist.
- **Mit Ziel** (Zahl vom Nutzer): „Fleisch höchstens 20 %". Erst
  dadurch entsteht ein Soll — und es ist seins, nicht das der App.
  **Die App schlägt nie von sich aus eine Zielzahl vor.** Sobald sie
  das täte, wäre sie wieder Ernährungsberaterin.

**Gemessen wird in Geld, wahlweise in Gewicht.** Geld ist die
Leitwährung der App und für Fleisch die ehrlichere Größe (Fleisch ist
teuer, ein Anteil nach Stückzahl verharmlost). Für „mehr Gemüse" ist
Gewicht ehrlicher (Gemüse ist billig und schwer). Die Einheit steht
deshalb je Richtung fest und wird genannt, statt sie den Nutzer
raten zu lassen.

### Art C — Fokus: *Wovon ist überhaupt etwas im Korb?*

Für Menschen, die aus einem Grund auf etwas Bestimmtes achten — und
besonders für die, die gerade auf vegetarisch oder vegan umstellen und
zu Recht wissen wollen, ob ihr Korb die klassischen Lücken hat.

| Fokus | Rechnet | Datenlage |
|---|---|---|
| **Protein** | g je Woche, stärkste Quellen | gebaut (kuratierte Tabelle) |
| **Ballaststoffe** | g je Woche | Merkmalstabelle + Referenzwerte |
| **Eisen** | mg je Woche, pflanzlich/tierisch getrennt | Referenzwerte, dünn |
| **Kalzium** | mg je Woche | Referenzwerte, dünn |

Hier verläuft die medizinische Grenze, und sie ist scharf zu ziehen:

- Die App nennt **den Inhalt des Korbs**, nie einen Bedarf für *dich*.
- Ein Referenzwert (DGE, Erwachsene) darf **als Orientierung mit
  Quelle** danebenstehen — aber mit dem Satz, dass er für Erwachsene
  allgemein gilt, keine Empfehlung für eine bestimmte Person ist, und
  dass die App nicht weiß, was davon gegessen wurde.
- **Keine Warnung, kein Mangel-Hinweis, keine Empfehlung.** „Dir fehlt
  Eisen" ist eine Diagnose. Die darf hier niemand stellen.
- **Immer mit Abdeckung:** „gerechnet aus 75 von 112 Positionen".
  Ohne diese Zahl ist eine Grammangabe eine Behauptung.

---

## 4. Wo das in der App auftaucht — und wo ausdrücklich nicht

Die Regel dieser App: **eine Ansicht, eine Frage.** Ernährung darf
nicht überall gleichzeitig aufpoppen, sonst ist sie das Thema der App
und nicht mehr ein Werkzeug darin.

| Ort | Was dort erscheint | Warum |
|---|---|---|
| **Liste** | Ausschluss-Marke + Ersatz im Detail-Blatt | Der Moment vor dem Einkauf ist der einzige, in dem ein Ersatz noch möglich ist. Höchstens EINE Marke je Zeile (bestehende Regel). |
| **Zahlen → Ausgaben** | Zusammensetzungs-Karte, Ziele, Verlauf | Hier stellt man ohnehin die Frage „wo geht es hin". |
| **Wochenrückblick** | **Ein** Satz, nur bei gewählter Richtung, nur wenn er etwas sagt | Der Rückblick ist die einzige regelmäßige Zusammenfassung — der richtige Ort für Verlauf, der falsche für Details. |
| **Bestand** | Im Umstellungs-Modus: was noch aufzubrauchen ist | §5 |
| **Rezepte** | Filter auf die gewählte Weise; im Umstieg Vorrang für Aufzubrauchendes | Rezepte gibt es schon (`recipeMatcher.js`), sie werden nur passend sortiert |
| **Erfassen / nach dem Buchen** | **NICHTS** | Der Moment nach dem Kauf ist zu spät für eine Entscheidung und zu früh für eine Bilanz. Ein Ernährungskommentar dort ist reine Bevormundung. Dieser Platz gehört der Anlass-Frage und der Ersparnis. |
| **Startseite** | **NICHTS** eigenes | Start beantwortet „was kommt auf mich zu". Ernährung ist keine Fälligkeit. |

---

## 5. Der Umstieg — das Stück, das sonst niemand baut

Wer heute beschließt, vegetarisch zu leben, hat morgen einen
Kühlschrank voll von gestern. Jede andere App schaltet um und
markiert ab sofort alles rot. Das Ergebnis ist entweder ein schlechtes
Gewissen oder ein voller Mülleimer — und der Mülleimer ist genau das,
wogegen diese App überhaupt gebaut wurde.

**Der Umstellungs-Modus** (startet automatisch bei jedem Wechsel zu
einem strengeren Ausschluss-Profil, mit einer Frage, nicht ungefragt):

1. **Was schon im Vorrat liegt, wird nicht markiert.** Es ist gekauft.
   Es wegzuwerfen wäre schlechter als es zu essen.
2. **Rezepte bekommen eine Aufgabe:** aufbrauchen, was nicht mehr
   passt, bevor es verdirbt — sortiert nach Verderbnähe, genau wie
   `recipeMatcher` es ohnehin tut („was rettet den größten Betrag").
3. **Die Liste hört sofort auf, es nachzukaufen.** Das ist der
   eigentliche Umstieg: nicht der Kühlschrank ändert sich, sondern der
   Rhythmus.
4. **Der Modus endet von selbst**, wenn der betroffene Vorrat
   aufgebraucht ist — und sagt das einmal („Der letzte Rest ist weg.
   Ab jetzt zählt nur noch, was neu dazukommt."). Ein Modus, den man
   selbst beenden muss, bleibt ewig an.
5. **Ehrliche Vorwarnung beim Umschalten**, weil nur diese App sie
   geben kann: *„In deinem Vorrat liegen 6 Positionen, die nicht mehr
   passen — Wert etwa 24 €. Die Rezepte helfen beim Aufbrauchen."*

**Und die unbequeme Wahrheit dazu, die trotzdem hingehört:** eine
Umstellung auf mehr Frischware erhöht in aller Regel den Verderb. Die
App weiß das aus den eigenen Zahlen und sagt es einmal beim
Umschalten, statt es den Nutzer nach zwei Monaten selbst herausfinden
zu lassen — mit dem passenden Gegenmittel aus dem eigenen Bestand
(kleinere Mengen, Einfrieren, kürzere Vorausschau).

---

## 6. Ein Haushalt, mehrere Menschen

`settings.household` kennt die Personenzahl. In den meisten Haushalten
mit einem Vegetarier lebt kein zweiter — und trotzdem gibt es **eine**
Einkaufsliste.

Die Lösung ist keine Personen-Verwaltung (das wäre eine andere App),
sondern zwei Regeln:

1. **Profile markieren, sie streichen nie.** Damit bleibt eine
   gemischte Liste vollständig benutzbar; die Marke ist eine Auskunft
   für den, der sie braucht.
2. **Ziele gelten für so viele Personen, wie man angibt.** „Vegetarisch
   für 1 von 2 Personen" heißt: die Richtungs-Ziele rechnen gegen den
   anteiligen Einkauf, nicht gegen den ganzen. Ohne diese Zahl ist
   jedes Ziel in einem gemischten Haushalt automatisch verfehlt — und
   ein Ziel, das systematisch scheitert, wird abgeschaltet, nicht
   erreicht.

---

## 7. Allergien und Unverträglichkeiten — Stufe 5, ausdrücklich nicht gebaut

Das ist die meistgewünschte und die gefährlichste Funktion, und sie
bekommt deshalb dieselbe Behandlung wie der Server in
`docs/schwarm.md`: durchdacht, benannt, **nicht gebaut**.

**Warum nicht:** Glutenfrei und laktosefrei sind keine Vorlieben,
sondern Unverträglichkeiten. Eine falsche Zusage macht jemanden krank.
Der Katalog kennt weder Zutatenlisten noch Spurenkennzeichnung
(„kann Spuren von … enthalten"), und genau die Spuren sind bei einer
Zöliakie der entscheidende Teil. Was die Datenlage hergibt, reicht für
„enthält vermutlich kein Fleisch" — niemals für „ist sicher
glutenfrei". Dieselbe Linie wie bei den Verbrauchsdaten: lieber
schweigen als etwas zusagen, dessen Grundlage fehlt.

**Was es später geben könnte** — und nur unter allen vier Bedingungen:

1. Eine Zutaten- und Allergenquelle je Produkt (OFF `allergens_tags`
   wäre eine, ist aber unvollständig und von Freiwilligen gepflegt).
2. Die Funktion heißt **nicht** „glutenfrei", sondern **„Hinweis auf
   Weizen"** — sie warnt vor Anwesenheit, sie bescheinigt nie
   Abwesenheit. Das ist der ganze Unterschied.
3. Ein nicht wegklickbarer Satz an jeder Stelle: keine
   Sicherheitsfunktion, immer die Packung lesen.
4. Eine bewusste Entscheidung eines Menschen, dass die App dieses
   Risiko trägt. Ich treffe sie nicht nebenbei in einem Commit.

Bis dahin steht in der Oberfläche, **warum** es fehlt. Eine Lücke, die
sich erklärt, ist besser als eine, die wie Vergesslichkeit aussieht.

---

## 8. Datenmodell

Stufe 1 speichert `settings.diet` als Zeichenkette (`"vegan"`). Das
trägt die drei Profilarten nicht. Zielform:

```js
settings.diet = {
  ausschluss: "vegetarisch",        // oder null
  richtungen: [                     // leer = keine
    { id: "weniger_fleisch", ziel: 20 },      // Ziel in %, null = nur beobachten
    { id: "mehr_gemuese",    ziel: null }
  ],
  fokus: ["protein"],               // leer = keiner
  personen: 1,                      // für wie viele im Haushalt (Vorgabe: alle)
  umstellung: {                     // null, wenn keine läuft
    seit: "2026-09-05",
    vorher: null                    // das vorige Ausschluss-Profil
  }
}
```

**Wanderung, und sie muss stillschweigend gelingen:** eine alte
Zeichenkette wird zu `{ ausschluss: "vegan", richtungen: [], fokus: [],
personen: <household>, umstellung: null }`, `"proteinreich"` zu
`{ ausschluss: null, …, fokus: ["protein"] }`. `merge()` in `data.js`
darf über einer Zeichenkette an dieser Stelle **nicht abstürzen** —
gespeicherte Zustände aus Stufe 1 sind bereits im Umlauf. Ein Test
dafür gehört in dieselbe Änderung wie die Umstellung des Feldes.

---

## 9. Stufenplan

| Stufe | Inhalt | Aufwand | Wert |
|---|---|---|---|
| **1 — gebaut** | Vegetarisch, vegan, proteinreich; Marke, Ersatz, Anteile, Abdeckung | — | — |
| **2** | Merkmalstabelle als eigene Datei; Ausschluss um pescetarisch / ohne Schwein / ohne Alkohol erweitert; **Richtungs-Profile mit Ziel und Verlauf**; ein Satz im Wochenrückblick; Datenmodell + Wanderung | mittel | **hoch** — hier entsteht das eigentlich Neue |
| **3** | Umstellungs-Modus, Rezeptfilter, Bestand-Ansicht | mittel | hoch, und einzigartig |
| **4** | Fokus-Nährstoffe über OFF (opt-in, zwischengespeichert) für Markenprodukte | groß | mittel — erst sinnvoll, wenn 2 und 3 stehen |
| **5** | Allergie-Hinweise | — | **nicht gebaut**, siehe §7 |

Empfohlene Reihenfolge: **2 → 3 → 4.** Stufe 2 bringt den größten
Zuwachs pro Zeile Code und braucht keine fremde Quelle. Stufe 3 ist
das Stück, das die App von allen anderen unterscheidet. Stufe 4 ist
nützlich, aber sie hängt an einer fremden Datenbank und sollte nicht
vor dem stehen, was offline funktioniert.

---

## 10. Wortwahl — verbindlich

Diese App hat einen Ton, und beim Essen ist er wichtiger als sonst.

| Nicht | Sondern |
|---|---|
| „ungesund", „zu viel", „zu wenig" | „22 % · dein Ziel: 15 %" |
| „du solltest", „besser wäre" | „Ersatz aus demselben Regal" |
| „Mangel", „Defizit" | „im Korb dieser Woche: … " |
| „gesunde Alternative" | „passt zu deiner Weise" |
| „deine Ernährung" | „dein Einkauf", „im Korb" |
| Rot für Ernährungshinweise | Rot bleibt Dringendem vorbehalten (bestehende Regel); Ernährung ist neutral gefärbt |
| Prozentzahl ohne Bezug | „… der Lebensmittel-Ausgaben, 12 Wochen" |
| Anteil ohne Abdeckung | „bezieht sich auf 88 % der Ausgaben" |

Und eine Regel für den Rückblick: **kein Satz ohne Zahl, keine Zahl
ohne Zeitraum, kein Zeitraum ohne Abdeckung.**

---

## 11. Woran man erkennt, dass es funktioniert (Testgarantien)

In der Reihenfolge ihrer Wichtigkeit — die erste ist die, die diese
Funktion überhaupt vertretbar macht:

1. **Ohne Profil ändert sich nichts.** Keine Marke, keine Karte, kein
   Satz, kein Rechenweg. (Gebaut, gilt weiter für jede neue Stufe.)
2. **Kein falscher Haken.** Ein veganes Produkt darf nie als tierisch
   markiert werden. Wo der Name nicht reicht, wird geschwiegen — und
   das Schweigen ist geprüft, nicht nur beabsichtigt.
3. **Jede genannte Kennung existiert im Katalog.** Der Fehler, der
   Räuchertofu zu Fleisch machte und zehn Protein-Werte wirkungslos
   ließ, darf sich nicht wiederholen.
4. **Keine Zahl ohne Abdeckung.** Jede Anteils- und Grammangabe führt
   mit, welchen Teil des Einkaufs sie erfasst.
5. **Kein Ziel von der App.** Kein Standard-Zielwert, keine
   vorgeschlagene Zahl — geprüft, dass das Ziel `null` bleibt, bis
   jemand es setzt.
6. **Der Umstellungs-Modus endet von selbst** und markiert vorhandenen
   Vorrat nicht.
7. **Kein Satz im Rückblick ohne Datenbasis.** Bei zu dünner Woche
   schweigt er.
8. **Nichts geht ohne Einwilligung raus.** Für Stufe 4 gilt Wort für
   Wort dieselbe Garantie wie in `test/schwarm.js`: ohne Zustimmung
   keine Anfrage, und die Abwesenheit der Anfrage ist getestet.

---

## 12. Was ich dafür von dir brauche

1. **Freigabe für die Lesart aus §0** — dass „beim Geld bleiben, nicht
   beim Körper" als *„keine Bewertung des Menschen"* gilt und nicht
   als *„keine Zusammensetzung des Korbs"*. Das ist die einzige
   inhaltliche Entscheidung, die ich nicht allein treffen sollte, weil
   sie eine ältere, ausdrücklich dokumentierte Entscheidung
   präzisiert.
2. **Eine Reihenfolge** — mein Vorschlag steht in §9 (2 → 3 → 4).
3. **Für Stufe 4 später**: die Entscheidung, dass Nährwerte aus einer
   fremden Datenbank überhaupt in die App dürfen. Der Weg dorthin
   existiert bereits und ist eingezäunt (§2 Quelle C), die
   Entscheidung ist trotzdem eine eigene.

Nichts davon blockiert Stufe 2. Die kann sofort losgehen.
