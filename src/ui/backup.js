/* ================================================================
   backup.js — die Sicherung, so weit ein Browser sie zulässt
   ================================================================
   Das Urteil, WANN etwas zu tun ist, steht in algo/backupGuard.js und
   wird dort geprüft. Hier steht nur, was ohne Browser nicht geht —
   und das sind drei Dinge, in aufsteigender Wirksamkeit:

   1. DAUERHAFTEN SPEICHER ERBITTEN.
      `navigator.storage.persist()` nimmt den Speicher von der
      automatischen Aufräumaktion aus. Es kostet nichts und hilft am
      meisten. Gefragt wird NACH dem ersten erfassten Einkauf, nicht
      beim ersten Start: Browser entscheiden nach Nutzungssignalen,
      und ein zu früh gestelltes Gesuch wird abgelehnt — dauerhaft.

   2. EINE SCHATTENKOPIE HALTEN.
      Sie hilft nicht gegen Löschen; gegen Löschen hilft nichts, was
      im selben Speicher liegt. Sie hilft gegen den ABGEBROCHENEN
      SCHREIBVORGANG: volle Quote, Absturz, halbe Datei. Beim Start
      wird die bessere der beiden Kopien genommen — nach Inhalt, nicht
      nach Zeitstempel.

   3. EINE DATEI AUSSERHALB DES BROWSERS.
      Nur sie überlebt „Browserdaten löschen“. Wo die File System
      Access API vorhanden ist (Chrome, Edge, Android), wählt man das
      Ziel einmal aus, und die App schreibt danach bei jeder Änderung
      selbst hinein — das ist die eigentliche automatische Sicherung.
      Wo sie fehlt (Safari, Firefox), bleibt der Download, und die App
      erinnert daran, statt so zu tun, als wäre alles geregelt.

   DER DATEIGRIFF LIEGT IN INDEXEDDB, nicht im localStorage: er ist
   kein Text, sondern ein Objekt, das der Browser für uns aufbewahrt.
   Nur so ist die Datei nach einem Neustart ohne erneutes Auswählen
   wieder beschreibbar.
   ================================================================ */

const Backup = {
  DB: "einkaufsanker-backup",
  STORE: "handles",
  KEY: "ziel",

  /* Nicht bei jedem Tastendruck schreiben: eine Sicherung ist ein
     Dateizugriff, und der Zustand ändert sich beim Abhaken einer
     Liste im Sekundentakt. */
  DEBOUNCE_MS: 4000,

  handle: null,
  _timer: null,
  _pending: false,

  /** Für Tests austauschbar. Ohne Ersatz redet alles mit dem Browser. */
  adapter: null,

  /* ---------- Dauerhafter Speicher ---------- */

  /** Ist der Speicher schon vor dem Aufräumen geschützt? */
  isPersisted() {
    if (Backup.adapter) return Promise.resolve(!!Backup.adapter.persisted);
    if (!navigator.storage || !navigator.storage.persisted) return Promise.resolve(false);
    return navigator.storage.persisted().catch(() => false);
  },

  /**
   * Dauerhaften Speicher erbitten. Gibt zurück, ob er gewährt wurde.
   * Ein „nein“ ist kein Fehler — es heißt nur, dass die Datei umso
   * wichtiger ist.
   */
  requestPersist() {
    if (Backup.adapter) {
      Backup.adapter.persisted = Backup.adapter.grantPersist !== false;
      Backup._persisted = Backup.adapter.persisted;
      return Promise.resolve(Backup.adapter.persisted);
    }
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persist()
      .then((ok) => { Backup._persisted = !!ok; return !!ok; })
      .catch(() => false);
  },

  /** Läuft die App in einer nativen App-Huelle (Capacitor: iOS/Android)? */
  isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  },

  /** Läuft die App als installierte Web-App (oder als native App)? */
  isInstalled() {
    if (Backup.adapter) return !!Backup.adapter.installed;
    if (Backup.isNative()) return true;
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
             window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  },

  /**
   * WebKit? Der Unterschied ist nicht Neugier: nur dort gilt die
   * Sieben-Tage-Frist für nicht installierte Web-Apps, und nur dann
   * darf die App sie in der Meldung nennen.
   */
  isWebkit() {
    if (Backup.adapter) return !!Backup.adapter.webkit;
    if (Backup.isNative()) return false;
    const ua = navigator.userAgent || "";
    return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua) || /iPad|iPhone|iPod/.test(ua);
  },

  /* Ob der Speicher dauerhaft ist, beantwortet der Browser nur
     asynchron — `compute()` ist aber synchron und wird bei jeder
     Neuzeichnung aufgerufen. Also einmal fragen, Antwort merken. Bis
     die Antwort da ist, gilt „nicht dauerhaft“: die vorsichtigere
     Annahme, und sie führt höchstens dazu, dass für einen Wimpernschlag
     eine Warnung zu viel dasteht statt einer zu wenig. */
  _persisted: false,

  /** Einmal beim Start fragen und merken. */
  refresh() {
    return Backup.isPersisted().then((p) => { Backup._persisted = !!p; return Backup.envSync(); });
  },

  /** Der Zustand, den backupHealth braucht — ohne Warten. */
  envSync() {
    return {
      persisted: Backup._persisted,
      installed: Backup.isInstalled(),
      webkit: Backup.isWebkit()
    };
  },

  /** Dasselbe, aber frisch erfragt. */
  env() {
    return Backup.refresh();
  },

  /* ---------- Der Dateigriff ---------- */

  supportsAutoFile() {
    if (Backup.adapter) return !!Backup.adapter.supportsAutoFile;
    return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
  },

  openDb() {
    if (Backup.adapter) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("kein IndexedDB")); return; }
      const req = indexedDB.open(Backup.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(Backup.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB nicht verfügbar"));
    });
  },

  idb(mode, fn) {
    return Backup.openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(Backup.STORE, mode);
      const req = fn(tx.objectStore(Backup.STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  },

  /** Gespeicherten Dateigriff holen (nach einem Neustart). */
  loadHandle() {
    if (Backup.adapter) {
      Backup.handle = Backup.adapter.handle || null;
      return Promise.resolve(Backup.handle);
    }
    if (!Backup.supportsAutoFile()) return Promise.resolve(null);
    return Backup.idb("readonly", (store) => store.get(Backup.KEY))
      .then((h) => { Backup.handle = h || null; return Backup.handle; })
      .catch(() => null);
  },

  /**
   * Ziel auswählen. Muss aus einer echten Nutzergeste heraus
   * aufgerufen werden — der Browser lässt den Dialog sonst nicht zu.
   */
  chooseTarget(suggestedName) {
    if (Backup.adapter) {
      if (Backup.adapter.chooseFails) return Promise.reject(new Error("abgebrochen"));
      Backup.handle = Backup.adapter.handle = { name: suggestedName, writes: [] };
      return Promise.resolve(Backup.handle);
    }
    if (!Backup.supportsAutoFile()) return Promise.reject(new Error("nicht unterstützt"));
    return window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "Einkaufs-Anker Sicherung", accept: { "application/json": [".json"] } }]
    }).then((handle) => {
      Backup.handle = handle;
      return Backup.idb("readwrite", (store) => store.put(handle, Backup.KEY))
        .then(() => handle)
        .catch(() => handle);   // Schreiben geht auch ohne gemerkten Griff
    });
  },

  /** Ziel vergessen — die Datei selbst bleibt liegen. */
  forgetTarget() {
    Backup.handle = null;
    if (Backup.adapter) { Backup.adapter.handle = null; return Promise.resolve(); }
    return Backup.idb("readwrite", (store) => store.delete(Backup.KEY)).catch(() => {});
  },

  /** Erlaubt der Griff noch das Schreiben? Rechte können ablaufen. */
  ensurePermission() {
    if (Backup.adapter) return Promise.resolve(!!Backup.handle);
    if (!Backup.handle) return Promise.resolve(false);
    if (!Backup.handle.queryPermission) return Promise.resolve(true);
    return Backup.handle.queryPermission({ mode: "readwrite" })
      .then((p) => (p === "granted" ? true
        : Backup.handle.requestPermission({ mode: "readwrite" }).then((q) => q === "granted")))
      .catch(() => false);
  },

  /* ---------- Schreiben ---------- */

  /**
   * Sofort in die Datei schreiben.
   * @param {string} text
   * @returns {Promise<boolean>} geschrieben ja/nein
   */
  writeNow(text) {
    if (!Backup.handle) return Promise.resolve(false);
    if (Backup.adapter) {
      Backup.handle.writes.push(text);
      Backup.adapter.lastWrite = text;
      return Promise.resolve(true);
    }
    return Backup.ensurePermission().then((ok) => {
      if (!ok) return false;
      return Backup.handle.createWritable()
        .then((w) => w.write(text).then(() => w.close()))
        .then(() => true)
        .catch(() => false);
    });
  },

  /**
   * Schreiben anmelden. Mehrere Änderungen kurz hintereinander
   * ergeben einen Schreibvorgang — sonst schreibt das Abhaken einer
   * Liste zwanzigmal dieselbe Datei.
   */
  schedule(getText, onDone) {
    if (!Backup.handle) return;
    Backup._pending = true;
    clearTimeout(Backup._timer);
    Backup._timer = setTimeout(() => {
      Backup._pending = false;
      Backup.writeNow(getText()).then((ok) => { if (onDone) onDone(ok); });
    }, Backup.DEBOUNCE_MS);
  },

  /** Alles Anstehende sofort schreiben — beim Schließen der Seite. */
  flush(getText) {
    if (!Backup._pending) return Promise.resolve(false);
    clearTimeout(Backup._timer);
    Backup._pending = false;
    return Backup.writeNow(getText());
  },

  /** Herunterladen — der Weg, der überall funktioniert. */
  download(text, filename) {
    if (Backup.adapter) { Backup.adapter.lastDownload = { text, filename }; return true; }
    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      return false;
    }
  }
};
