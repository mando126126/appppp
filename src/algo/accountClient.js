/**
 * accountClient.js — Infrastruktur für Konten, Einladungen, Bestenliste
 * ================================================================
 * Vorbereitet, aber NICHT live -- genau wie schwarmClient.js, und aus
 * denselben Gründen (siehe docs/schwarm.md für das ausführliche
 * Vorbild, docs/referral.md für dieses Modul). Kein Menü-Eintrag
 * verweist hierher, keine Oberfläche kann ein Konto anlegen oder
 * einen Code einlösen, und -- das Wichtigste -- es gibt keinen
 * Zeitpunkt im Code, an dem etwas das Gerät tatsächlich verlässt.
 * `ENDPOINT` ist `null`. Jede Funktion hier prüft das zuerst und
 * verweigert sich sonst.
 *
 * WARUM DAS TROTZDEM SCHON EXISTIERT
 *
 * Als dokumentierter API-VERTRAG: die Form jeder Anfrage und Antwort
 * steht hier bereits fest, geprüft gegen die Rechnung aus
 * referralSystem.js. Wenn eine echte Gegenstelle entsteht, ändert
 * sich an dieser Datei im Idealfall nur eine Zeile (`ENDPOINT`) plus
 * das tatsächliche `fetch`; der Vertrag selbst -- welche Felder rein-
 * und rausgehen -- ist schon durchdacht und testgesichert.
 *
 * WAS FEHLT, BEVOR IRGENDETWAS HIERVON LIVE GEHEN DARF
 * (siehe docs/referral.md für die Begründung, hier nur die Liste):
 *   - ENDPOINT auf eine echte, betriebene Adresse setzen
 *   - Ein echtes Konto-Verfahren (E-Mail-Bestätigung oder Login) --
 *     ohne Gegenstelle gibt es heute niemanden, der eine
 *     E-Mail-Adresse bestätigen könnte
 *   - Verantwortlicher + Anschrift (Impressum, Datenschutzerklärung),
 *     dazu bei einer bezahlten Prämie: Fernabsatz- und
 *     Widerrufsrecht, Umsatzsteuer, Zahlungsabwickler
 *   - Ein Schutz gegen Selbst-Einladung (zwei Installationen auf
 *     demselben Gerät/derselben Person laden sich gegenseitig ein)
 *   - Ein UI-Einstieg, den es bis dahin absichtlich nicht gibt
 * ================================================================
 */

/* Absichtlich null -- siehe Kopf. Keine Umgebungsvariable, kein
   Vorgabewert, der sich versehentlich mitschleppen ließe. */
const ACCOUNT_ENDPOINT = null;

function accountConfigured() {
  return typeof ACCOUNT_ENDPOINT === "string" && ACCOUNT_ENDPOINT.length > 0;
}

/**
 * Der Vertrag für „Code einlösen".
 *
 * ANFRAGE (wenn `accountConfigured()` je wahr wäre):
 *   POST {ENDPOINT}/referral/redeem
 *   { code: string }                 -- kein Geräte-/Konto-Bezug im
 *                                        Klartext; das übernimmt eine
 *                                        Sitzung/ein Header, keine
 *                                        Nutzlast
 *
 * ANTWORT (Vertrag, nicht real):
 *   { ok: true }  oder  { ok: false, reason: "code_unbekannt" | "bereits_eingeloest" | "selbsteinladung" }
 *
 * Die Prämie selbst wird NICHT hier ausgerechnet, sondern nach einer
 * echten Bestätigung mit `referralSystem.applyReferralReward()` --
 * derselbe Grundsatz wie überall in diesem Projekt: die Rechnung und
 * der Netzwerkaufruf sind zwei verschiedene Funktionen, damit die
 * Rechnung ohne Netzwerk geprüft werden kann.
 */
function attemptRedeem(code) {
  if (!accountConfigured()) {
    return { ok: false, reason: "keine Gegenstelle eingetragen (ENDPOINT ist leer)" };
  }
  // Bis hierher kommt der Code heute nie: accountConfigured() ist
  // immer false. Der Zweig steht trotzdem hier, damit er beim Einbau der
  // echten Übertragung an der richtigen Stelle ergänzt wird.
  return { ok: false, reason: "Übertragung noch nicht gebaut" };
}

/**
 * Der Vertrag für „Bestenliste abrufen".
 *
 * ANFRAGE:  GET {ENDPOINT}/leaderboard?limit=50
 * ANTWORT:  { einträge: [{ platz: number, anzeigename: string, punkte: number }] }
 *
 * Bewusst OHNE feste Metrik hier festgelegt -- welche Zahl "Punkte"
 * ist, entscheidet sich erst mit der Metrik-Frage aus docs/referral.md.
 * `punkte` ist deshalb ein bereits vom Server aufbereiteter, für die
 * gewählte Metrik passender Wert, kein Rohkontostand.
 */
function attemptFetchLeaderboard() {
  if (!accountConfigured()) {
    return { ok: false, reason: "keine Gegenstelle eingetragen (ENDPOINT ist leer)", einträge: [] };
  }
  return { ok: false, reason: "Übertragung noch nicht gebaut", einträge: [] };
}

/**
 * Der Vertrag für „eigenes Punktekonto abgleichen".
 *
 * ANFRAGE:  POST {ENDPOINT}/score/sync
 *   { log: [{date, points, reason}] }   -- dasselbe Protokoll, das
 *                                          referralSystem.js lokal führt
 * ANTWORT:  { ok: true, gesamt: number }
 */
function attemptSyncScore(log) {
  if (!accountConfigured()) {
    return { ok: false, reason: "keine Gegenstelle eingetragen (ENDPOINT ist leer)" };
  }
  return { ok: false, reason: "Übertragung noch nicht gebaut" };
}

module.exports = { ACCOUNT_ENDPOINT, accountConfigured, attemptRedeem, attemptFetchLeaderboard, attemptSyncScore };
