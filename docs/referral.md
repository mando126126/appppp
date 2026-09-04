# Einladungen, Prämie, Bestenliste — Entwurf

> Stand: 04.09.2026 · **Entscheidungen sind teilweise gefallen, siehe
> unten §0.** Gebaut ist `src/algo/referralSystem.js` — die reine
> Rechnung für Code-Form, Prämien-Datumsarithmetik und Punkte-Protokoll
> — sowie `src/algo/accountClient.js`, der dokumentierte, aber
> absichtlich UNTÄTIGE Vertrag für eine künftige Gegenstelle:
> `ACCOUNT_ENDPOINT` ist `null`, keine Oberfläche verweist darauf, und
> beides ist testgesichert (`test/referral.js` Abschnitt D,
> `test/uitest.js` „Einladungen/Prämie/Bestenliste sind vorbereitet,
> aber nirgends erreichbar"). Dasselbe Prinzip wie beim
> Schwarm-Preisindex (siehe `docs/schwarm.md`), diesmal für eine
> Funktion, die zusätzlich ein **echtes Konto** und **Geld** berührt —
> mehr offene Punkte, nicht weniger.

## 0. Was der Nutzer bereits entschieden hat

Auf Nachfrage, bevor irgendetwas hiervon gebaut wurde, drei Antworten:

| Frage | Antwort |
|---|---|
| Backend/Hosting jetzt schon? | **Nein** — „erstmal ohne Server, soll ja nur erstmal strukturell da sein." |
| Identität | **Echtes Konto** (E-Mail/Login) — keine anonyme Geräte-Kennung |
| Bestenlisten-Metrik | **Noch offen** — generisches Punktekonto, keine feste Kennzahl |

Das erklärt die Bauart hier: keine Simulation eines Kontos oder einer
Einlösung (das wäre erfundene Funktionalität), sondern ausschließlich
das, was ohne Gegenstelle schon heute wahr ist — Code-Form,
Datumsrechnung, Protokoll-Arithmetik — plus ein dokumentierter,
inaktiver Vertrag für den Tag, an dem die restlichen Punkte in diesem
Dokument geklärt sind.

---

## 1. Worum es geht

Wer erfolgreich jemanden einlädt, bekommt 3 Monate Prämie
(„Premium") geschenkt. Zusätzlich: die Infrastruktur für eine
Bestenliste — noch ohne festgelegte Metrik, aber mit einem
Punkteprotokoll, das später eine beliebige Kennzahl tragen kann, ohne
rückwirkend umgebaut zu werden.

Zwei Dinge unterscheiden das vom Schwarm-Preisindex und machen es
grundsätzlich schwerer:

1. **Ein echtes Konto** statt anonymer Preissichtungen — Identität ist
   hier der Zweck, nicht etwas, das vermieden werden soll.
2. **Geld.** Eine „Prämie" ist wirtschaftlich eine Zahlung in
   Naturalien (geschenkte Nutzungszeit), sobald „Premium" irgendetwas
   kostet, das sonst Geld kosten würde. Das zieht Fernabsatz- und
   Steuerrecht nach sich, sobald „Premium" existiert — unabhängig
   davon, ob die Einladung selbst kostenlos bleibt.

---

## 2. Was bereits gebaut ist, und warum trotz „kein Server"

Drei Rechnungen sind vollständig serverunabhängig (siehe Kopf-Kommentar
in `referralSystem.js` für die ausführliche Begründung):

1. **Code-Form.** Ein Einladungscode ist kurz, eindeutig lesbar, ohne
   verwechselbare Zeichen (kein `0`/`O`, `1`/`I`/`L`) — reine
   Textverarbeitung.
2. **Prämien-Arithmetik.** Eine bestätigte Einladung verlängert die
   Prämie um 3 Monate, gerechnet ab dem späteren von „heute" und
   „bisheriges Ende" — kalendersicher (`addMonths` behandelt
   Monatsenden korrekt, siehe Test „31. Januar + 1 Monat landet im
   Februar, nicht März").
3. **Punkte-Protokoll.** Eine Gutschrift hängt sich an ein Protokoll
   einzelner Einträge (Datum, Punkte, Grund) statt einen mitgeführten
   Kontostand zu führen — dieselbe Buchhaltungslogik wie überall sonst
   in dieser App (`activityLog.js`).

**Keine dieser Funktionen gewährt etwas von selbst.** Sie rechnen nur,
was gelten WÜRDE, wenn ein Ereignis bestätigt wäre. Ob ein
Einladungscode wirklich von einer zweiten, echten Installation
eingelöst wurde, kann ohne Gegenstelle niemand wissen — das zu
behaupten wäre genau die Art Selbstbedienung, gegen die eine
Gegenstelle überhaupt erst schützt. Deshalb ruft heute nichts in der
Oberfläche `applyReferralReward` mit einem selbst ausgedachten
Ergebnis auf; `s.settings.referral` in `data.js` existiert nur als
künftige Form, ohne einen einzigen Leser oder Schreiber.

`accountClient.js` legt zusätzlich den **API-Vertrag** fest — welche
Felder eine künftige Anfrage/Antwort für Einlösen, Bestenliste-Abruf
und Punkte-Abgleich trägt —, ohne dass er heute irgendwo hinginge.
Wenn eine echte Gegenstelle entsteht, ändert sich an dieser Datei im
Idealfall nur `ACCOUNT_ENDPOINT` plus das tatsächliche `fetch`; der
Vertrag selbst ist schon durchdacht und testgesichert.

---

## 3. Was noch fehlt, bevor irgendetwas live gehen darf

| Punkt | Warum es ohne Gegenstelle nicht geht |
|---|---|
| **Ein echter Endpunkt** | `ACCOUNT_ENDPOINT` ist `null` — ohne ihn sendet nichts |
| **Ein echtes Konto-Verfahren** | E-Mail-Bestätigung oder Login braucht jemanden, der die E-Mail-Adresse bestätigt. Ohne Gegenstelle gibt es diesen Jemand nicht |
| **Verantwortlicher + Anschrift** | Impressum, Datenschutzerklärung — dieselbe Formsache wie beim Schwarm-Preisindex, siehe `docs/schwarm.md` §8.2 |
| **Fernabsatz- und Widerrufsrecht, Umsatzsteuer, Zahlungsabwickler** | sobald „Premium" ein Gegenwert ist — auch wenn er nur verschenkt wird. Eine geschenkte Leistung ist rechtlich trotzdem eine Leistung |
| **Schutz gegen Selbst-Einladung** | zwei Installationen derselben Person laden sich sonst gegenseitig ein und erzeugen unbegrenzt Prämie. Ohne Konto-Verifizierung ist das nicht zu unterscheiden von zwei echten Personen |
| **Die Bestenlisten-Metrik** | laut Nutzer-Antwort noch offen — das Protokoll ist bewusst allgemein gehalten (`{date, points, reason}`), damit die Entscheidung später fällt, ohne die Datenform nochmal zu ändern |
| **Ein UI-Einstieg** | den es bis dahin absichtlich nicht gibt (siehe `test/uitest.js`) |

---

## 4. Recht (Deutschland/EU) — was hinzukommt gegenüber dem Schwarm-Preisindex

Die Punkte aus `docs/schwarm.md` §5 (Rechtsgrundlage, Verantwortlicher,
Datenschutzerklärung, Auskunft & Löschung, Impressum) gelten
unverändert — plus, weil hier ein echtes Konto und ein geldwerter
Vorteil entstehen:

- **Vertragsschluss.** Ein Konto anzulegen ist ein Vertrag (AGB nötig,
  auch wenn „Premium" nichts kostet).
- **Widerrufsrecht bei Fernabsatzverträgen** (§ 312g BGB) — auch bei
  einer geschenkten Leistung, sobald sie einen Gegenwert hat.
- **Umsatzsteuerliche Behandlung** einer „kostenlosen" Prämie, die
  sonst Geld gekostet hätte (verdeckte Sachzuwendung).
- **Kopplungsverbot-Nähe** (Art. 7(4) DSGVO): eine Prämie im Tausch
  gegen eine Einladung, die personenbezogene Daten eines Dritten
  überträgt, braucht eine sauber getrennte Einwilligung der
  eingeladenen Person, nicht nur der einladenden.
- **Missbrauchsschutz** ist hier keine Kür wie beim Preisindex, sondern
  Pflicht: ein System, das Geld(-wert) für Einladungen auszahlt, ohne
  Selbst-Einladung zu verhindern, verliert wirtschaftlich, nicht nur
  an Datenqualität.

---

## 5. Was ich brauche, um das live zu schalten

1. **Eine Hosting-Umgebung** mit echtem `ACCOUNT_ENDPOINT`.
2. **Ein Konto-Verfahren** (E-Mail-Bestätigung oder Login-Anbieter).
3. **Einen Verantwortlichen** mit Anschrift für Impressum,
   Datenschutzerklärung und AGB.
4. **Eine Entscheidung zur Bestenlisten-Metrik** — was zählt als
   „Punkt"? (z. B. Verschwendung vermieden, Einladungen, Streak —
   offen laut Nutzer-Antwort in §0)
5. **Eine Entscheidung zum Zahlungs-/Steuer-Rahmen**, sobald „Premium"
   selbst käuflich werden soll, nicht nur verschenkt.

Punkt 4 ist bewusst technisch folgenlos für die heutige Bauart: das
Protokoll in `referralSystem.addScorePoints`/`scoreTotal` ist
metrik-neutral, es summiert Punkte, ohne festzulegen, wofür sie
vergeben werden. Punkte 1–3 sind dieselbe Formsache wie beim
Schwarm-Preisindex. Punkt 5 ist neu gegenüber dem Preisindex und der
eigentliche Grund, warum diese Funktion mehr vorbereitet, aber nichts
zusätzlich behauptet.
