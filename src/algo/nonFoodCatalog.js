/**
 * nonFoodCatalog.js — Verbrauchsmodell für Haushaltsprodukte
 * ================================================================
 * Haushaltsprodukte sind ein anderes Problem als Lebensmittel:
 *
 *   Lebensmittel    Feind ist Verderb — zu viel gekauft.
 *   Haushalt        Feind ist Leerstand — zu spät gekauft.
 *
 * Daraus folgt alles Weitere. Bei Lebensmitteln verzerrt Verschwendung
 * das Signal, deshalb der Median über Kaufabstände. Bei Non-Food gibt
 * es keinen Verderb: die gekaufte Menge wird tatsächlich verbraucht,
 * das Signal ist sauber, und man kann über eine Rate rechnen.
 *
 * Bevorratung ist hier rational statt schädlich — begrenzt nur durch
 * Lagerplatz und Kapitalbindung.
 *
 * Dieser Katalog trägt AUSSCHLIESSLICH das Verbrauchsmodell. Name,
 * Schreibweisen, Preis und Gewicht stehen weiter in foodDatabase.js;
 * verknüpft wird über die Produktkennung. Ein zweiter Produktkatalog
 * wäre genau die Doppelpflege, gegen die der Bündel-Build gebaut ist.
 *
 * ALLE Raten und Intervalle sind Startwerte. Die Quelle steht an
 * jedem Eintrag und wird in der Oberfläche angezeigt — dasselbe
 * Prinzip wie bei den Haltbarkeitsdaten: lieber eine ehrlich als
 * Schätzung gekennzeichnete Zahl als eine, die Genauigkeit vortäuscht.
 * ================================================================ */

const { byId } = require("./foodDatabase");

/* ---------- Verbrauchsklassen ---------- */
const CLASS = {
  // Menge nimmt näherungsweise linear ab — Prognose über eine Rate.
  RATE: "RATE",
  // Austausch nach Zeit, unabhängig von der Menge. Meist hygienisch
  // begründet. Braucht kein Verbrauchsmodell und keine Historie:
  // Kaufdatum plus Intervall genügt.
  INTERVAL: "INTERVAL",
  // Kein Muster ableitbar. Die App zeigt Historie, aber KEINE
  // Prognose. Diese Klasse existiert, damit nicht geraten wird.
  SPORADIC: "SPORADIC",
  // Echtes Verfalls- oder Öffnungsdatum.
  DATED: "DATED"
};

const SOURCE = {
  SCHAETZUNG: "Schätzung",
  HERSTELLER: "Herstellerangabe",
  FACH: "Fachempfehlung",
  HYGIENE: "Hygieneempfehlung"
};

/* ---------- Haushaltsskalierung (§5.2) ---------------------------
 * Nicht alles skaliert linear mit der Haushaltsgröße. Zahnpasta schon
 * — jede Person putzt. Waschmittel nicht: bei vier Personen läuft die
 * Maschine voller, nicht viermal so oft.
 *
 *   f(n) = n ^ alpha
 * ---------------------------------------------------------------- */
const ALPHA = {
  PER_PERSON: 1.0,     // Zahnpasta, Duschgel, Shampoo, Deo
  SLIGHT: 0.75,        // Klopapier, Taschentücher, Handseife
  DEGRESSIVE: 0.65,    // Waschmittel, Spülmittel, Müllbeutel
  PER_HOUSEHOLD: 0.0   // Entkalker, Allzweckreiniger — einmal je Haushalt
};

/* ---------- Normeinheiten für den Grundpreis (§8.1) ---------- */
const NORM = {
  ML100: { unit: "ml", per: 100, label: "100 ml" },
  G100: { unit: "g", per: 100, label: "100 g" },
  WL: { unit: "WL", per: 1, label: "Waschladung" },
  ROLLE: { unit: "Rolle", per: 1, label: "Rolle" },
  BLATT100: { unit: "Blatt", per: 100, label: "100 Blatt" },
  TAB: { unit: "Tab", per: 1, label: "Tab" },
  STUECK: { unit: "Stück", per: 1, label: "Stück" },
  METER: { unit: "m", per: 1, label: "Meter" },
  TUCH: { unit: "Tuch", per: 100, label: "100 Tücher" }
};

/* ---------- Geräte, die ein Produkt voraussetzt ----------
 * Ohne Kaffeemaschine keine Entkalker-Vorschläge. Ein Vorschlag für
 * ein Gerät, das der Haushalt nicht hat, kostet mehr Vertrauen als
 * er Nutzen bringt.                                                  */
const DEVICE = {
  DISHWASHER: "hasDishwasher",
  WASHER: "hasWashingMachine",
  COFFEE: "hasCoffeeMachine",
  WATERFILTER: "hasWaterFilter"
};

/* ================================================================
   Der Katalog
   ================================================================ */
const NONFOOD = {};

function rate(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.RATE,
    baseRatePerPersonPerDay: opts.rate,
    scalingExponent: opts.alpha,
    rateSource: opts.source || SOURCE.SCHAETZUNG,
    package: { value: opts.pack, unit: opts.norm.unit, norm: opts.norm },
    storageLimitDefault: opts.storage ?? 2,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: opts.pausesOnVacation !== false,
    requiresDevice: opts.device || null,
    hardnessSensitive: opts.hardness === true
  };
}

function interval(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.INTERVAL,
    replacementIntervalDays: opts.days,
    intervalSource: opts.source || SOURCE.SCHAETZUNG,
    package: { value: opts.pack ?? 1, unit: "Stück", norm: NORM.STUECK },
    storageLimitDefault: opts.storage ?? 2,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    // Eine Zahnbürste altert auch im Urlaub — sie wird mitgenommen.
    // Ein Küchenschwamm liegt derweil trocken. Deshalb je Produkt.
    pausesOnVacation: opts.pausesOnVacation === true,
    requiresDevice: opts.device || null,
    hardnessSensitive: opts.hardness === true
  };
}

function sporadic(id, opts = {}) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.SPORADIC,
    package: { value: opts.pack ?? 1, unit: opts.unit || "Stück", norm: opts.norm || NORM.STUECK },
    storageLimitDefault: opts.storage ?? 1,
    promoCycleDaysDefault: opts.promo ?? 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: true,
    requiresDevice: null,
    hardnessSensitive: false
  };
}

function dated(id, opts) {
  NONFOOD[id] = {
    id,
    consumptionClass: CLASS.DATED,
    // PAO = Period After Opening. Gilt ab dem Öffnen, und das Datum
    // kennt die App nicht. Das Kaufdatum ist ein Behelf und wird als
    // solcher gekennzeichnet — keine stille Schätzung.
    paoMonths: opts.pao ?? null,
    hasHardExpiry: opts.hardExpiry === true,
    package: { value: opts.pack ?? 1, unit: opts.norm ? opts.norm.unit : "Stück", norm: opts.norm || NORM.STUECK },
    storageLimitDefault: 1,
    promoCycleDaysDefault: 56,
    sharedByDefault: opts.shared !== false,
    pausesOnVacation: false,   // eine Frist läuft im Urlaub weiter
    requiresDevice: null,
    hardnessSensitive: false,
    datedSource: opts.source || SOURCE.HERSTELLER
  };
}

/* ---------- RATE: kontinuierlicher Verbrauch (§7.1) ---------- */
// Körperpflege ist persönlich — in einer WG teilt das niemand.
rate("zahnpasta", { rate: 1.5, alpha: ALPHA.PER_PERSON, pack: 75, norm: NORM.ML100, shared: false });
rate("duschgel", { rate: 10, alpha: ALPHA.PER_PERSON, pack: 300, norm: NORM.ML100, shared: false });
rate("shampoo", { rate: 3.5, alpha: ALPHA.PER_PERSON, pack: 300, norm: NORM.ML100, shared: false });
rate("deo", { rate: 0.7, alpha: ALPHA.PER_PERSON, pack: 50, norm: NORM.ML100, shared: false });
rate("handseife", { rate: 8, alpha: ALPHA.SLIGHT, pack: 250, norm: NORM.ML100 });

rate("klopapier", { rate: 0.14, alpha: ALPHA.SLIGHT, pack: 10, norm: NORM.ROLLE, storage: 3 });
rate("kuechenrolle", { rate: 0.07, alpha: ALPHA.DEGRESSIVE, pack: 4, norm: NORM.ROLLE, storage: 3 });
rate("taschentuecher", { rate: 0.3, alpha: ALPHA.SLIGHT, pack: 60, norm: NORM.TUCH });

rate("waschmittel", { rate: 1.0, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.WL, device: DEVICE.WASHER, hardness: true });
rate("weichspueler", { rate: 0.6, alpha: ALPHA.DEGRESSIVE, pack: 30, norm: NORM.WL, device: DEVICE.WASHER });
rate("spuelmittel", { rate: 6, alpha: ALPHA.DEGRESSIVE, pack: 500, norm: NORM.ML100 });
rate("spuelmaschinentabs", { rate: 0.5, alpha: ALPHA.DEGRESSIVE, pack: 40, norm: NORM.TAB, device: DEVICE.DISHWASHER });
rate("muellbeutel", { rate: 0.25, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.STUECK });
rate("allzweckreiniger", { rate: 5, alpha: ALPHA.PER_HOUSEHOLD, pack: 750, norm: NORM.ML100 });

rate("alufolie", { rate: 0.15, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.METER });
rate("frischhaltefolie", { rate: 0.2, alpha: ALPHA.DEGRESSIVE, pack: 30, norm: NORM.METER });
rate("backpapier", { rate: 0.1, alpha: ALPHA.DEGRESSIVE, pack: 20, norm: NORM.METER });
rate("gefrierbeutel", { rate: 0.4, alpha: ALPHA.DEGRESSIVE, pack: 50, norm: NORM.STUECK });

/* ---------- INTERVAL: zeitbasierter Austausch (§7.2) ----------
 * Die schnellste Wirkung im ganzen Modell: kein Kaltstart, keine
 * Historie, kein Lernen. Niemand denkt nach drei Monaten von selbst
 * an die Zahnbürste.                                                */
interval("zahnbuerste", { days: 90, source: SOURCE.FACH, shared: false, pausesOnVacation: false });
interval("aufsteckbuersten", { days: 90, source: SOURCE.FACH, pack: 4, shared: false, pausesOnVacation: false });
interval("kuechenschwamm", { days: 10, source: SOURCE.HYGIENE, pack: 5, pausesOnVacation: true });
interval("spuelbuerste", { days: 60, source: SOURCE.HYGIENE, pausesOnVacation: true });
interval("wischbezug", { days: 120, pausesOnVacation: true });
interval("wasserfilter", { days: 28, source: SOURCE.HERSTELLER, device: DEVICE.WATERFILTER, hardness: true, pausesOnVacation: false });
interval("rasierklingen", { days: 21, pack: 4, shared: false, pausesOnVacation: false });
interval("duschschwamm", { days: 45, source: SOURCE.HYGIENE, shared: false, pausesOnVacation: true });
interval("staubsaugerbeutel", { days: 45, pack: 4, pausesOnVacation: true });
interval("waschmaschinenreiniger", { days: 60, source: SOURCE.HERSTELLER, device: DEVICE.WASHER, hardness: true, pausesOnVacation: true });
interval("entkalker", { days: 90, source: SOURCE.HERSTELLER, device: DEVICE.COFFEE, hardness: true, pausesOnVacation: true });

/* ---------- SPORADIC: kein Muster (§3.3) ---------- */
sporadic("batterien", { pack: 4 });
sporadic("gluehbirne");
sporadic("kerzen", { pack: 6 });
sporadic("klebeband");
sporadic("schuhcreme", { pack: 75, unit: "ml", norm: NORM.ML100, shared: false });
sporadic("tragetasche");
sporadic("putztuecher", { pack: 30, unit: "Tuch", norm: NORM.TUCH });

/* ---------- DATED: echtes Verfalls- oder Öffnungsdatum (§7.4) ---------- */
dated("sonnencreme", { pao: 12, pack: 200, norm: NORM.ML100, shared: false });
dated("kontaktlinsenloesung", { pao: 3, pack: 360, norm: NORM.ML100, shared: false });
dated("desinfektionsmittel", { pao: 12, pack: 250, norm: NORM.ML100 });
dated("mascara", { pao: 6, pack: 10, norm: NORM.ML100, shared: false });

/* ---------- Wasserhärte (§7.3) ----------------------------------
 * In Deutschland gesetzlich in drei Härtebereiche eingeteilt. Härteres
 * Wasser heißt häufiger entkalken und mehr Waschmittel je Ladung.
 * Der Wert kommt vom örtlichen Versorger; die App fragt ihn ab, statt
 * ihn aus der Postleitzahl zu raten.                                 */
const HARDNESS_FACTOR = { weich: 1.6, mittel: 1.0, hart: 0.6 };
const HARDNESS_LABEL = {
  weich: "weich (unter 8,4 °dH)",
  mittel: "mittel (8,4–14 °dH)",
  hart: "hart (über 14 °dH)"
};

/* ---------- Zugriff ---------- */

/** Verbrauchsmodell eines Produkts, sonst null. */
const nonFoodFor = (productId) => NONFOOD[productId] || null;

/** Ist das ein Haushaltsprodukt mit Verbrauchsmodell? */
const isNonFood = (productId) => !!NONFOOD[productId];

/** Alle Produkte einer Verbrauchsklasse. */
function byClass(consumptionClass) {
  return Object.values(NONFOOD).filter((x) => x.consumptionClass === consumptionClass);
}

/**
 * Gilt das Produkt für diesen Haushalt? Fehlt das nötige Gerät, wird
 * es hart ausgefiltert statt schwach gewichtet.
 */
function appliesTo(productId, profile = {}) {
  const e = NONFOOD[productId];
  if (!e) return false;
  if (!e.requiresDevice) return true;
  return profile[e.requiresDevice] === true;
}

/** Katalogeintrag und Verbrauchsmodell in einem Objekt. */
function fullProduct(productId) {
  const p = byId(productId);
  const n = NONFOOD[productId];
  if (!p || !n) return null;
  return { ...p, ...n, domain: "NONFOOD" };
}

/** Bericht über die Belastbarkeit der Non-Food-Daten. */
function nonFoodQualityReport() {
  const all = Object.values(NONFOOD);
  const bySource = {};
  all.forEach((x) => {
    const src = x.rateSource || x.intervalSource || x.datedSource || "—";
    bySource[src] = (bySource[src] || 0) + 1;
  });
  const inCatalog = all.filter((x) => byId(x.id)).length;
  return {
    total: all.length,
    inCatalog,
    missing: all.filter((x) => !byId(x.id)).map((x) => x.id),
    rate: byClass(CLASS.RATE).length,
    interval: byClass(CLASS.INTERVAL).length,
    sporadic: byClass(CLASS.SPORADIC).length,
    datedCount: byClass(CLASS.DATED).length,
    bySource,
    anteilGeschaetzt: Math.round(((bySource[SOURCE.SCHAETZUNG] || 0) / all.length) * 100)
  };
}

module.exports = {
  NONFOOD, CLASS, SOURCE, ALPHA, NORM, DEVICE,
  HARDNESS_FACTOR, HARDNESS_LABEL,
  nonFoodFor, isNonFood, byClass, appliesTo, fullProduct, nonFoodQualityReport
};
