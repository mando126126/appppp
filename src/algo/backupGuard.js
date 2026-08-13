/**
 * backupGuard.js — damit drei Jahre nicht an einem Dienstag verschwinden
 * ================================================================
 * DAS PROBLEM, UNGESCHÖNT:
 *
 * Alles, was diese App weiß, liegt im `localStorage` des Browsers.
 * Das ist kein Tresor, sondern ein Zwischenspeicher mit guten
 * Manieren. Er wird geleert, wenn
 *
 *   - der Browser Platz braucht (Eviction bei knappem Speicher),
 *   - jemand „Browserdaten löschen“ tippt, um etwas anderes zu
 *     reparieren,
 *   - Safari zuschlägt: bei Web-Apps, die NICHT auf dem Startbildschirm
 *     installiert sind, räumt die Intelligent Tracking Prevention nach
 *     sieben Tagen ohne Nutzung auf. Sieben Tage sind ein Urlaub.
 *
 * Und der Verlust ist bei dieser App besonders bitter, weil er nicht
 * eine Einstellung kostet, sondern GELERNTES: drei Jahre Rhythmen,
 * jede Rückmeldung, jeden Meilenstein. Das kommt nicht wieder, indem
 * man sich neu anmeldet — es gibt kein Konto, das ist ja der Punkt.
 *
 * WAS DIESES MODUL TUT: es entscheidet, wie gefährdet ein Zustand
 * ist und wann die App etwas sagen muss. Es macht selbst keine
 * Sicherung — das kann nur der Browser, und das steht in ui/backup.js.
 * Hier liegt die Urteilslogik, weil sie sich prüfen lässt.
 *
 * DREI STUFEN DER ABSICHERUNG, in dieser Reihenfolge:
 *
 *   1. DAUERHAFTER SPEICHER (`navigator.storage.persist()`).
 *      Kostet nichts, hilft am meisten, wird aber nur gewährt, wenn
 *      der Browser die App für wichtig hält. Deshalb wird sie nicht
 *      beim ersten Start erbeten, sondern nach dem ersten erfassten
 *      Einkauf: davor ist die Antwort meistens nein, und ein einmal
 *      abgelehntes Gesuch lässt sich nicht wiederholen.
 *   2. SCHATTENKOPIE im selben Speicher. Sie hilft NICHT gegen
 *      Löschen — dagegen hilft nichts im selben Speicher —, sondern
 *      gegen den abgebrochenen Schreibvorgang: volle Quote, Absturz
 *      mitten im Speichern, halbe Datei. Das ist der häufigere Fall.
 *   3. EINE DATEI AUSSERHALB. Nur sie überlebt das Löschen des
 *      Browsers. Wo es geht, schreibt die App sie von selbst; wo
 *      nicht, erinnert sie und macht das Sichern zu einem Tippen.
 *
 * WAS HIER BEWUSST FEHLT: eine Wolke. Ein Server würde das Problem
 * lösen und dabei das Versprechen brechen, auf dem die ganze App
 * steht. Die Antwort ist deshalb nicht „vertraut uns“, sondern
 * „nehmt eure Datei mit“.
 * ================================================================
 */

/* Wann die App wieder etwas sagt. Beides muss zusammenkommen — Zeit
   allein nervt jemanden, der nichts erfasst hat, und Menge allein
   trifft den nicht, der viel auf einmal einträgt. */
const REMIND_AFTER_DAYS = 14;
const REMIND_AFTER_RECEIPTS = 6;

/* Ab hier ist es keine Erinnerung mehr, sondern eine Warnung. */
const CRITICAL_DAYS = 45;
const CRITICAL_RECEIPTS = 20;

/* Unter so vielen Bons lohnt keine Sicherung und keine Meldung — da
   ist noch nichts verloren zu gehen. */
const MIN_RECEIPTS_TO_CARE = 3;

/* Safari räumt bei nicht installierten Web-Apps nach sieben Tagen
   ohne Besuch auf. Der Wert steht hier, damit die Meldung ihn nennen
   kann statt vage zu warnen. */
const WEBKIT_EVICTION_DAYS = 7;

const LEVEL = {
  UNKRITISCH: "unkritisch",   // zu wenig Daten, um etwas zu verlieren
  GESICHERT: "gesichert",     // Datei außerhalb, aktuell
  OK: "ok",                   // gesichert, aber etwas ist dazugekommen
  ERINNERUNG: "erinnerung",   // lange nichts gesichert
  GEFAEHRDET: "gefaehrdet"    // nie gesichert und/oder Speicher flüchtig
};

/* Heißt nicht `isDate` — den Namen vergibt activityLog, und im
   Bündel teilen sich alle Module einen Namensraum. Der Build bricht
   sonst ab, und das ist die freundlichere Variante: vorher überschrieb
   still das eine das andere. */
const isDayString = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function daysBetweenDates(from, to) {
  if (!isDayString(from) || !isDayString(to)) return null;
  const ms = new Date(to + "T12:00:00Z") - new Date(from + "T12:00:00Z");
  return Math.round(ms / 86400000);
}

/**
 * Wie flüchtig ist dieser Speicher?
 *
 * @param {{persisted, installed, webkit}} env
 * @returns {{fluechtig:boolean, grund:string|null, frist:number|null}}
 */
function storageRisk(env = {}) {
  if (env.persisted) {
    return { fluechtig: false, grund: null, frist: null };
  }
  if (env.webkit && !env.installed) {
    return {
      fluechtig: true,
      frist: WEBKIT_EVICTION_DAYS,
      grund: `Auf diesem Browser werden die Daten einer nicht installierten Web-App nach ` +
             `${WEBKIT_EVICTION_DAYS} Tagen ohne Nutzung gelöscht. Zum Startbildschirm hinzufügen hilft dagegen.`
    };
  }
  return {
    fluechtig: true,
    frist: null,
    grund: "Der Browser darf diesen Speicher löschen, wenn er Platz braucht — " +
           "oder wenn jemand die Browserdaten aufräumt."
  };
}

/**
 * Der Gesundheitszustand der Sicherung.
 *
 * @param {object} s
 *   `receipts`        Bons insgesamt
 *   `lastBackupDate`  letzte Sicherung (JJJJ-MM-TT) oder null
 *   `receiptsAtBackup` Bonstand bei der letzten Sicherung
 *   `today`           Stichtag
 *   `auto`            true, wenn eine Datei automatisch mitgeschrieben wird
 *   `env`             siehe storageRisk
 * @returns {{level, title, message, urgent, daysSince, neueBons, risk}}
 */
function backupHealth(s = {}) {
  const today = s.today;
  const receipts = Math.max(0, Number(s.receipts) || 0);
  const receiptsAtBackup = Math.max(0, Number(s.receiptsAtBackup) || 0);
  const neueBons = Math.max(0, receipts - receiptsAtBackup);
  const daysSince = s.lastBackupDate ? daysBetweenDates(s.lastBackupDate, today) : null;
  const risk = storageRisk(s.env);

  const basis = { daysSince, neueBons, risk };

  if (receipts < MIN_RECEIPTS_TO_CARE) {
    return {
      ...basis, level: LEVEL.UNKRITISCH, urgent: false,
      title: "Noch nichts zu verlieren",
      message: "Sobald ein paar Einkäufe erfasst sind, kümmert sich die App um die Sicherung."
    };
  }

  /* Die automatische Datei ist der einzige Zustand, der wirklich
     entspannt ist — und auch nur, solange sie mitgeschrieben wird. */
  if (s.auto && neueBons === 0) {
    return {
      ...basis, level: LEVEL.GESICHERT, urgent: false,
      title: "Automatisch gesichert",
      message: "Jede Änderung wird in deine Sicherungsdatei geschrieben."
    };
  }
  if (s.auto) {
    return {
      ...basis, level: LEVEL.OK, urgent: false,
      title: "Automatisch gesichert",
      message: `${neueBons} ${neueBons === 1 ? "Bon" : "Bons"} seit der letzten Schreibung — wird beim nächsten Mal mitgenommen.`
    };
  }

  if (!s.lastBackupDate) {
    return {
      ...basis,
      level: LEVEL.GEFAEHRDET,
      urgent: true,
      title: "Noch nie gesichert",
      message: `${receipts} Bons und alles Gelernte liegen nur in diesem Browser. ` +
               (risk.grund || "")
    };
  }

  const kritisch = (daysSince !== null && daysSince >= CRITICAL_DAYS) || neueBons >= CRITICAL_RECEIPTS;
  const faellig = (daysSince !== null && daysSince >= REMIND_AFTER_DAYS) && neueBons >= REMIND_AFTER_RECEIPTS;

  if (kritisch) {
    return {
      ...basis, level: LEVEL.GEFAEHRDET, urgent: true,
      title: "Sicherung ist alt",
      message: `Zuletzt vor ${daysSince} Tagen gesichert, seitdem ${neueBons} ${neueBons === 1 ? "Bon" : "Bons"}. ` +
               "Bei einem Verlust wäre genau das weg."
    };
  }
  if (faellig) {
    return {
      ...basis, level: LEVEL.ERINNERUNG, urgent: false,
      title: "Zeit für eine Sicherung",
      message: `Zuletzt vor ${daysSince} Tagen, seitdem ${neueBons} ${neueBons === 1 ? "neuer Bon" : "neue Bons"}.`
    };
  }
  return {
    ...basis, level: LEVEL.OK, urgent: false,
    title: "Gesichert",
    message: daysSince === 0
      ? "Heute gesichert — der Stand liegt als Datei außerhalb des Browsers."
      : `Zuletzt vor ${daysSince} ${daysSince === 1 ? "Tag" : "Tagen"} gesichert` +
        `${neueBons ? `, seitdem ${neueBons} ${neueBons === 1 ? "neuer Bon" : "neue Bons"}` : " — seitdem nichts Neues"}.`
  };
}

/**
 * Darf die App von sich aus damit anfangen?
 *
 * Nur bei „gefährdet“, und höchstens alle paar Tage. Eine Erinnerung,
 * die bei jedem Start erscheint, wird nach dem dritten Mal weggetippt,
 * ohne gelesen zu werden — und dann fehlt sie an dem Tag, an dem sie
 * zählt.
 */
const NAG_SPACING_DAYS = 7;

function shouldRemind(health, lastNagDate, today) {
  if (!health || !health.urgent) return false;
  if (!lastNagDate) return true;
  const d = daysBetweenDates(lastNagDate, today);
  return d === null || d >= NAG_SPACING_DAYS;
}

/**
 * Ist dieser Stand überhaupt eine brauchbare Sicherung?
 *
 * Wird an zwei Stellen gebraucht: beim Zurückholen einer Datei und —
 * wichtiger — beim Start, wenn die Schattenkopie einspringen soll.
 * Eine kaputte Kopie über einen guten Stand zu legen wäre schlimmer
 * als jeder Fehler, den sie beheben soll.
 */
function validateSnapshot(parsed, opts = {}) {
  const fehler = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, fehler: ["kein Objekt"] };
  if (opts.schema !== undefined && parsed.schema !== opts.schema) {
    fehler.push(`Fassung ${parsed.schema} statt ${opts.schema}`);
  }
  if (!Array.isArray(parsed.purchases)) fehler.push("keine Kaufliste");
  if (!Array.isArray(parsed.receipts)) fehler.push("keine Bonliste");
  if (Array.isArray(parsed.purchases)) {
    const kaputt = parsed.purchases.filter((p) => !p || !p.productId || !isDayString(p.date)).length;
    // Ein paar unbrauchbare Zeilen sind normal (alte Fassungen, halb
    // gelöschte Einträge). Die Hälfte ist ein kaputtes Datei-Ende.
    if (parsed.purchases.length && kaputt > parsed.purchases.length / 2) {
      fehler.push(`${kaputt} von ${parsed.purchases.length} Käufen unbrauchbar`);
    }
  }
  return { ok: fehler.length === 0, fehler };
}

/**
 * Welcher von zwei Ständen ist der bessere?
 *
 * Beim Start, wenn beide Kopien lesbar sind. Entschieden wird nach
 * Inhalt, nicht nach Zeitstempel: ein Zeitstempel kann neuer und der
 * Inhalt trotzdem abgeschnitten sein — genau das passiert, wenn die
 * Quote mitten im Schreiben ausgeht.
 */
function pickBetter(a, b, opts = {}) {
  const va = validateSnapshot(a, opts);
  const vb = validateSnapshot(b, opts);
  if (va.ok && !vb.ok) return { chosen: a, why: "zweite Kopie unbrauchbar" };
  if (!va.ok && vb.ok) return { chosen: b, why: "erste Kopie unbrauchbar" };
  if (!va.ok && !vb.ok) return { chosen: null, why: "beide unbrauchbar" };

  const za = (a.purchases || []).length + (a.receipts || []).length;
  const zb = (b.purchases || []).length + (b.receipts || []).length;
  if (za === zb) return { chosen: a, why: "gleichwertig" };
  return za > zb
    ? { chosen: a, why: `mehr Inhalt (${za} zu ${zb})` }
    : { chosen: b, why: `mehr Inhalt (${zb} zu ${za})` };
}

/** Dateiname mit Datum — sortiert sich im Ordner von selbst. */
function backupFileName(today) {
  const d = isDayString(today) ? today : new Date().toISOString().slice(0, 10);
  return `einkaufsanker-${d}.json`;
}

module.exports = {
  backupHealth, storageRisk, shouldRemind, validateSnapshot, pickBetter,
  backupFileName, daysBetweenDates,
  LEVEL, REMIND_AFTER_DAYS, REMIND_AFTER_RECEIPTS, CRITICAL_DAYS, CRITICAL_RECEIPTS,
  MIN_RECEIPTS_TO_CARE, NAG_SPACING_DAYS, WEBKIT_EVICTION_DAYS
};
