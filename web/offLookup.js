/* ================================================================
   offLookup.js — wenn der eigene Katalog nicht reicht, fragt die App
   genau EINEN fremden Dienst, und zwar so wenig wie möglich.
   ================================================================
   Der Bon-Abgleich (productMatcher2.js) arbeitet komplett lokal und
   bleibt das die ganze Zeit. Was hier dazukommt, ist ein zweiter
   Versuch NUR für Zeilen, die der lokale Abgleich nicht einordnen
   konnte — nicht, weil der Katalog zu klein wäre (846 Produkte
   decken die meisten Grundbegriffe längst ab), sondern weil
   Handelsketten ihre Bon-Namen bis zur Unkenntlichkeit abkürzen:
   „GL Proteinjogh.sort.200g" statt „Joghurt".

   Open Food Facts liefert dafür keine Haltbarkeit und keinen
   verlässlichen Treffer — es liefert einen AUSGESCHRIEBENEN Namen.
   Der wird anschließend genau wie jede getippte Bon-Zeile noch
   einmal durch den EIGENEN Katalog gejagt (matchProduct). Die
   Produktidentität — Haltbarkeit, Lagerort, Verbrauchsdatum-Status —
   kommt damit immer aus der eigenen, geprüften Liste. Open Food
   Facts ist nur die Übersetzung von Kassenjargon in normales
   Deutsch, nie die Quelle für Sicherheitsdaten.

   VIER GRENZEN, DIE HIER BEWUSST GEZOGEN SIND:

   1. NUR DER NAME GEHT RAUS.
      Kein Preis, kein Datum, kein Markt — `parseProductName(...).core`
      ist bereits ohne Mengenangabe und Sonderzeichen. Die Anfrage
      verrät ein Wort, nicht wann oder wo jemand eingekauft hat.

   2. JEDE SCHREIBWEISE WIRD HÖCHSTENS EINMAL GEFRAGT.
      Das Ergebnis — auch ein Fehlschlag — wird dauerhaft im Gerät
      zwischengespeichert. Dieselbe Bon-Zeile fragt beim nächsten
      Einkauf nicht noch einmal nach.

   3. OHNE NETZ WIRD ES STILL ÜBERSPRUNGEN.
      Kein Fehler, keine Wartezeit — die App bleibt offline benutzbar,
      diese Stufe ist ein Zusatz, keine Voraussetzung.

   4. EIN TIMEOUT, DAMIT NICHTS HÄNGT.
      Eine Oberfläche, die auf eine fremde Antwort wartet, fühlt sich
      kaputt an. Nach `TIMEOUT_MS` gilt die Anfrage als erfolglos —
      genau wie ein echter Fehlschlag, kein Absturz.

   Die App sagt das ihren Nutzern auch: der Text im Bon-Erfassen-
   Bildschirm nennt diesen Weg ausdrücklich (siehe views.js,
   ocrPicker). „Ohne Server" gilt für Bild und Bon-Text weiterhin
   uneingeschränkt — für einen einzelnen unbekannten Produktnamen
   nicht mehr, und das steht jetzt da, wo man es liest, bevor man
   scannt.
   ================================================================ */

const OffLookup = {
  ENDPOINT: "https://world.openfoodfacts.org/cgi/search.pl",
  CACHE_KEY: "einkaufsanker.offcache.v1",
  TIMEOUT_MS: 4000,
  /* Mehr als ein paar tausend Schreibweisen sammelt kein Haushalt in
     einem Leben an. Eine Obergrenze verhindert trotzdem, dass der
     Zwischenspeicher unbegrenzt wächst, falls doch — die ältesten
     Einträge fallen zuerst raus. */
  CACHE_LIMIT: 3000,

  /* Für Tests austauschbar: eine Funktion (url) => Promise<Response>.
     Genau das Muster aus OCR.engine — damit läuft kein Testlauf
     jemals gegen das echte Internet. */
  fetcher: null,

  _cache: null,

  /**
   * Open Food Facts liefert nicht immer einen sauberen Namen — an
   * echten Anfragen beobachtet: „Milsani Joghurt mild 3,5 % Fett
   * 4061458028820", die Barcode-Nummer direkt hinter dem Namen. Ein
   * Barcode als Wort im Rückabgleich verdünnt nur das Ergebnis, ohne
   * je zu einem Katalogtreffer beizutragen — keine acht Ziffern am
   * Stück stehen in einem echten Produktnamen.
   */
  _bereinigt(name) {
    const ohneBarcode = String(name).replace(/\b\d{8,}\b/g, "").replace(/\s+/g, " ").trim();
    return ohneBarcode.slice(0, 80) || null;
  },

  _loadCache() {
    if (OffLookup._cache) return OffLookup._cache;
    try {
      const raw = localStorage.getItem(OffLookup.CACHE_KEY);
      OffLookup._cache = raw ? JSON.parse(raw) : {};
    } catch (e) {
      OffLookup._cache = {};
    }
    return OffLookup._cache;
  },

  _saveCache(cache) {
    const keys = Object.keys(cache);
    if (keys.length > OffLookup.CACHE_LIMIT) {
      // Älteste zuerst raus — die Reihenfolge der Objektschlüssel
      // entspricht der Einfügereihenfolge, das reicht hier aus.
      keys.slice(0, keys.length - OffLookup.CACHE_LIMIT).forEach((k) => delete cache[k]);
    }
    try {
      localStorage.setItem(OffLookup.CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // Speicher voll oder gesperrt (privates Fenster): das Nachschlagen
      // funktioniert trotzdem, nur ohne dauerhaften Zwischenspeicher.
    }
  },

  /**
   * Schlägt einen unbekannten Bon-Namen nach.
   * @returns {Promise<string|null>} ein ausgeschriebener Produktname
   *   oder `null` — nie ein Absturz, nie eine hängende Anfrage.
   */
  async find(rawName) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

    /* `tokens`, nicht `core`: der lokale Abgleich entfernt Füllwörter
       (FILLER_WORDS) erst auf den Tokens, „core" trägt „gl", „sort"
       & Co. noch mit. Für die eigene Zuordnung ist das gewollt —
       diese Wörter tragen zur Ähnlichkeitsrechnung bei. Für die
       Anfrage an einen fremden Dienst nicht: weniger Rauschen im
       Suchbegriff bedeutet bessere Treffer UND weniger unnötige
       Zeichen in dem, was das Gerät verlässt. */
    const parsed = parseProductName(rawName);
    const query = parsed.tokens.join(" ").trim();
    if (query.length < 3) return null; // zu kurz für eine sinnvolle Anfrage

    const cache = OffLookup._loadCache();
    if (Object.prototype.hasOwnProperty.call(cache, query)) return cache[query];

    const url = `${OffLookup.ENDPOINT}?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=3&lc=de`;

    let name = null;
    try {
      const holen = OffLookup.fetcher || ((u, opts) => fetch(u, opts));
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller
        ? setTimeout(() => controller.abort(), OffLookup.TIMEOUT_MS)
        : null;
      const res = await holen(url, controller ? { signal: controller.signal } : {});
      if (timer) clearTimeout(timer);
      if (res && res.ok) {
        const data = await res.json();
        const treffer = (data.products || [])[0];
        name = (treffer && (treffer.product_name_de || treffer.product_name)) || null;
        if (name) name = OffLookup._bereinigt(name);
      }
    } catch (e) {
      // Netzwerkfehler, Timeout, kaputtes JSON — zählt wie kein Treffer.
      name = null;
    }

    cache[query] = name;
    OffLookup._saveCache(cache);
    return name;
  }
};
