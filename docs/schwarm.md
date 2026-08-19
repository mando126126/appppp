# Schwarm-Preisindex — Entwurf

> Stand: 19.08.2026 · **Nicht gebaut.** Gebaut sind die beiden
> Module, die die Entscheidungen dieses Entwurfs tragen
> (`src/algo/priceShare.js`, `src/algo/offerAdvisor.js`) samt
> 38 Prüfungen. Was fehlt, ist ein Server — und die Entscheidung,
> ob es ihn geben soll.

## Worum es geht

Viele Haushalte erfassen ohnehin ihre Bons. Aus diesen Bons entsteht
automatisch eine reale Preisdatenbank, und jeder bekommt die
Mitteilung: *bei vielen war dieses Produkt gerade besonders günstig —
Vorrat lohnt sich.*

Der Nutzen ist offensichtlich. Der Preis dafür ist es nicht, und
darum geht es hier.

---

## 1. Was dagegen steht, und zwar konkret

Diese App verspricht an drei Stellen ausdrücklich: **kein Server,
kein Konto, keine Übertragung.** Im README, im „Über"-Blatt und in
den Entscheidungen selbst:

| Entscheidung | Was sie gekostet hat |
|---|---|
| Texterkennung auf dem Gerät | 4,4 MB Auslieferung statt einer Cloud-API mit drei Zeilen |
| Schrift mitgeliefert | 40 KB und ein Vorzieh-Tag statt zweier Zeilen Google Fonts |
| Keine fremde Adresse im Stil | ein Test, der das erzwingt |

Das ist kein Beiwerk, das ist die Bauart. Wer eine Übertragung
einbaut, muss diese drei Sätze ändern — und zwar ehrlich, nicht im
Kleingedruckten.

**Was ein Kassenbon über einen Menschen verrät**, wenn man ihn
überträgt: wo er einkauft (Filiale ≈ Wohnort), wann (Arbeitszeit,
Wochenrhythmus), wie viel (Haushaltsgröße, Einkommen) — und was. Das
Letzte ist das Heikelste: Babynahrung heißt Schwangerschaft, Halal
heißt Religion, Diabetiker-Produkte heißen Gesundheit. Das sind
besondere Kategorien nach **Art. 9 DSGVO**, und sie stehen auf ganz
gewöhnlichen Bons.

---

## 2. Der Entwurf: eine Preissichtung ist kein Kauf

Die übertragene Einheit ist bewusst **keine Kaufhandlung**, sondern
eine Beobachtung über einen Händler:

```json
{ "v": 1, "produkt": "butter", "kette": "lidl",
  "kw": "2026-W34", "cent": 149, "packung": 250 }
```

Nicht enthalten, jedes Einzelne aus einem Grund:

| weggelassen | warum |
|---|---|
| **Menge** | verrät die Haushaltsgröße |
| **Datum** | wird zur Kalenderwoche — ein Datum plus Kette plus Produkt ist über mehrere Sichtungen verkettbar, eine Woche kaum |
| **Filiale** | wird zur Kette. Die Filiale ist der Wohnort |
| **Warenkorb** | ist ein Fingerabdruck. Zwölf Positionen identifizieren einen Haushalt zuverlässiger als ein Name — Sichtungen gehen deshalb **einzeln** und in gemischter Reihenfolge raus |
| **Kennung** | gibt es nicht. Kein Konto, kein Gerät, kein „pseudonymer" Zufallsschlüssel: ein stabiler Schlüssel über Wochen **ist** eine Kennung, egal wie er heißt |

Übrig bleibt eine Aussage über einen **Händler**, nicht über einen
Menschen: „in Woche 34 kostete Butter bei Lidl 1,49 €". Das ist der
Punkt der ganzen Konstruktion — und der Grund, warum das Ergebnis
kein personenbezogenes Datum mehr sein dürfte.

### Zwei Regeln, die nicht verhandelbar sind

**1. Nur bekannte Ketten.** „Hofladen Müller" wird nicht übertragen.
Ein seltener Händlername ist selbst ein Merkmal — bei einer Handvoll
Kunden *ist* die Sichtung die Person. Die Kettenliste ist kurz und
eine Positivliste; „alles außer verdächtig" wäre die falsche
Richtung.

> Beim Testen kam heraus, dass „Müller" in der Liste stand und
> „Hofladen Müller" damit als Drogeriekette durchging. Müller ist
> einer der häufigsten deutschen Nachnamen. Die Kette ist wieder
> raus — eine Kette weniger im Index ist der billigere Fehler.

**2. Nichts ohne k andere.** Ein Wert wird erst ausgeliefert, wenn
**mindestens fünf** unabhängige Sichtungen für (Produkt, Kette,
Woche) vorliegen. Das schützt doppelt: gegen Rückschlüsse auf den
Einzelnen **und** gegen eine falsch erkannte Bonzeile, die sonst den
Index verschöbe.

### Zusätzlich gegen Verkettung über die Leitung

Ohne Kennung im Datensatz bleibt der Übertragungsweg. Deshalb:

- **gebündelt und verzögert** senden — einmal pro Woche, alle
  Sichtungen dieser Woche zusammen, zu zufälliger Zeit. Nie sofort
  beim Buchen (das wäre eine Zeitmarke).
- Keine Cookies, kein Session-Header.
- Server protokolliert keine IP-Adressen (oder kürzt sie sofort).
- Rohdaten werden nach der Verdichtung verworfen, nicht archiviert.

---

## 3. Was der Nutzer davon sieht

> **Butter 1,49 €** — bei Lidl diese Woche 35 % unter dem üblichen
> Preis (aus 47 Meldungen).
> **3 Packungen wären sinnvoll** — das reicht etwa 36 Tage und bleibt
> in der Haltbarkeit von 40. Spart ca. 2,40 €.

Der zweite Absatz ist das, was ein Prospekt **nicht** kann. Die
Rechnung dahinter:

```
Höchstmenge = Haltbarkeit ÷ dein Verbrauch je Einheit
```

Ein Angebotsportal weiß, dass Butter billig ist. Dass *du* 250 g in
zwölf Tagen verbrauchst und die vierte Packung im Müll landet, weiß
nur diese App. Genau deshalb darf die Empfehlung hier stehen.

Grenzen, die schon im Code stehen (`offerAdvisor.js`):

- **Sicherheitskritisches nie.** Ein Verbrauchsdatum lässt sich nicht
  durch einen guten Preis verlängern.
- **Ohne gelernten Verbrauch kein Rat.** Lieber schweigen als raten —
  ein Vorratsstapel, der nach vierzehn Monaten noch steht, ist das
  Gegenteil des Versprechens.
- **Höchstens acht Einheiten**, auch wenn Reis zehn Jahre hält.
- **Unter 15 % Nachlass gar nichts.** Butter für 2,25 statt 2,29 ist
  kein Anlass, den Keller vollzustellen.
- **Nichts wird gutgeschrieben.** Die genannte Ersparnis ist eine
  Vorschau auf einen Kauf, der noch nicht stattgefunden hat.
  Realisiert zählt sie erst `receiptSavings` beim Buchen.

### Die offene Stelle: k zählt Meldungen, nicht Haushalte

`buildPriceIndex` zählt **Sichtungen**. Solange jeder einmal meldet,
ist das dasselbe wie „fünf Haushalte". Wer dieselbe Sichtung fünfmal
schickt, erfüllt die Schwelle aber im Alleingang — und dann schützt
sie niemanden mehr und glättet auch nichts.

Ohne Kennung lässt sich das nicht sauber auflösen: „ein Haushalt,
eine Meldung" zu prüfen setzt voraus, Haushalte unterscheiden zu
können, und genau das soll es nicht geben. Drei Auswege:

| Weg | Bewertung |
|---|---|
| **a) Ratenbegrenzung je IP** | schwach (geteilte Anschlüsse, Mobilfunk-NAT, VPN), aber billig und sofort |
| **b) Blind signiertes Wochenticket** (Privacy-Pass-Verfahren) | beweist „eine Meldung je Woche", ohne den Absender zu kennen. Die richtige Lösung — und echte Kryptoarbeit plus ein zweiter Dienst, der die Tickets ausgibt |
| **c) Ehrlich umbenennen** | es bleibt bei „k **Meldungen**" statt „k Haushalten", und die App sagt genau das |

**Vor Stufe 2 muss eine davon gewählt sein.** Es ist dieselbe
Fehlerklasse wie die Doppelzählungen an anderer Stelle in diesem
Projekt: eine Zahl, die über einen Kanal gezählt wird, der etwas
anderes misst, als ihr Name sagt. Mein Vorschlag für den Anfang: (a)
plus (c) — schwacher Schutz, aber eine ehrliche Beschriftung. (b),
sobald es genug Nutzer gibt, dass sich Missbrauch lohnt.

---

## 4. Missbrauch

Ohne Konten kann jeder beliebige Preise einreichen. Was hilft:

- **Median statt Mittelwert**, plus die k-Schwelle — ein einzelner
  Falschwert bewegt nichts.
- **Plausibilitätsgrenzen** gegen den Katalogwert (unter 20 % oder
  über 500 % des typischen Preises wird verworfen). Fängt auch echte
  Erkennungsfehler ab, nicht nur Böswilligkeit.
- **Ratenbegrenzung** je IP.

Und eine Entscheidung, die wichtiger ist als alle drei: die Funktion
bleibt **beratend**. Sie schreibt nichts auf die Liste, sie bucht
keine Ersparnis, sie verändert keine Bilanz. Wer den Index vergiftet,
erzeugt einen schlechten Vorschlag — keine falschen Zahlen im
Haushalt eines Fremden.

---

## 5. Recht (Deutschland/EU)

| Punkt | Was nötig ist |
|---|---|
| **Rechtsgrundlage** | Einwilligung, Art. 6(1)(a). Nicht „berechtigtes Interesse": der Nutzer ist die Quelle, und der Zweck ist ein neuer. Opt-in, standardmäßig aus, jederzeit widerrufbar |
| **Verantwortlicher** | eine benannte natürliche oder juristische Person mit Anschrift |
| **Datenschutzerklärung** | mit Zweck, Empfängern, Speicherdauer, Rechten |
| **Auskunft & Löschung** | Art. 15/17. Ohne Kennung und ohne Rohdatenhaltung lässt sich ein einzelner Beitrag **nicht** mehr herauslösen. Das ist zulässig, wenn die Daten wirklich anonym sind — muss aber **vor** der Einwilligung klar dastehen, nicht danach |
| **DSFA** | bei Umfang wahrscheinlich, Art. 35. Bei drei Haushalten nicht |
| **Impressum** | DDG § 5, sobald es geschäftsmäßig aussieht |
| **Widerruf** | muss die Übertragung sofort stoppen; Vergangenes ist anonymisiert und bleibt im Aggregat |

Dazu eine Ehrlichkeitspflicht in der App selbst: ein sichtbares
Protokoll, **was** wann übertragen wurde. Wer nicht nachsehen kann,
muss glauben — und dann ist das Versprechen nur noch ein Satz.

---

## 6. Betrieb und Kosten

Technisch klein: ein Endpunkt zum Einliefern, ein Schlüssel-Wert-
Speicher, ein Endpunkt zum Abrufen des verdichteten Index. Als
Serverless-Funktion einstellig Euro im Monat bei kleiner Nutzerzahl.

Teuer ist nicht der Server, sondern das Drumherum: betreiben,
aktualisieren, überwachen, auf Auskunftsersuchen antworten, bei einer
Panne haften. Und die App ist für diese Funktion **nicht mehr
offline** — sie muss also sauber degradieren, wenn nichts erreichbar
ist.

---

## 7. Der Weg dorthin — drei Stufen

### Stufe 0 — gebaut, ohne Server

Die App hat deine eigene Preisdatenbank längst: `priceMemory`,
`basePrice`, dein Tiefstpreis, dein Angebotszyklus. Zusammen mit
`offerAdvisor` steht im Detail-Blatt jedes Produkts schon heute:

> **Wenn es wieder so günstig ist:** 8× wären sinnvoll — reicht etwa
> 40 Tage. Bester Preis bisher 0,65 €, üblich 1,19 €.

Funktioniert offline, braucht keine Einwilligung, stimmt für **deinen**
Haushalt statt für einen Durchschnitt.

### Stufe 1 — Schwarm ohne Server *(Empfehlung)*

Drei Haushalte, die sich kennen, tauschen eine **Datei** mit
Sichtungen aus — dieselbe Datenstruktur, dieselbe
`buildPriceIndex`-Rechnung, k auf die Gruppengröße gesetzt. Die
Sicherungs- und Dateimechanik dafür gibt es in dieser App bereits.

Kein Server, kein Recht-Apparat, kein Vertrauensverlust: die
Beteiligten kennen einander ohnehin. Für die tatsächliche Zielgruppe
— du, deine Mum, deine Freundin — ist das der Schwarm, und er ist ein
Nachmittag Arbeit statt eines Projekts.

### Stufe 2 — der öffentliche Index

Alles aus den Abschnitten 2 bis 6. Das ist ein eigenes Produkt mit
eigenen Pflichten, und es sollte erst anfangen, wenn Stufe 1 gezeigt
hat, dass die Sache überhaupt trägt.

---

## 8. Was ich brauche, um Stufe 2 zu bauen

1. **Eine Entscheidung**, dass die drei Sätze („kein Server, kein
   Konto, keine Übertragung") geändert werden dürfen — und wie sie
   danach lauten.
2. **Einen Verantwortlichen** mit Anschrift für Impressum und
   Datenschutzerklärung.
3. **Eine Hosting-Umgebung**, auf die ich ausliefern kann.

Punkt 1 ist der einzige, der wirklich eine Entscheidung ist. Die
anderen beiden sind Formsachen.
