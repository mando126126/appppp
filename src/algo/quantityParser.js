/**
 * quantityParser.js — Menge und Domäne aus der Bonzeile
 * ================================================================
 * Non-Food-Positionen tragen die Menge fast immer im Artikelnamen:
 * „WASCHMITTEL 20WL", „ZAHNPASTA 75ML", „TOILETTENPAPIER 10ER".
 * Ohne diese Zahl ist kein Grundpreis und keine Reichweite zu rechnen,
 * und der Katalogwert wäre bei jeder abweichenden Packungsgröße falsch.
 *
 * Zweitens die Steuersatz-Heuristik: deutsche Kassenbons weisen den
 * Satz je Position aus. 7 % ist überwiegend Lebensmittel, 19 %
 * überwiegend Non-Food — ein starkes und kostenloses Signal.
 *
 * Es ist aber ein VORFILTER, kein Ersatz für den Produktabgleich. Die
 * Ausnahmen sind zu zahlreich: Getränke, Spirituosen, Tabak und
 * Tiernahrung stehen auf 19 %, Schnittblumen und Zeitschriften auf
 * 7 %. Deshalb greift die Heuristik erst, wenn der Abgleich nichts
 * gefunden hat, und dann nur als Vorschlag zur Bestätigung.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { nonFoodFor, NORM } = require("./nonFoodCatalog");

// Einheiten, wie sie auf deutschen Bons vorkommen.
const UNIT_ALIASES = {
  ML: "ml", L: "l", CL: "cl",
  G: "g", GR: "g", KG: "kg",
  WL: "WL", WG: "WL",
  ER: "Stück", ST: "Stück", STK: "Stück", STCK: "Stück", STUECK: "Stück",
  BL: "Blatt", BLATT: "Blatt",
  M: "m", METER: "m",
  TAB: "Tab", TABS: "Tab",
  ROLLE: "Rolle", ROLLEN: "Rolle", RL: "Rolle",
  TUCH: "Tuch", TUECHER: "Tuch"
};

const RE_QUANTITY = /(\d+(?:[.,]\d+)?)\s*(ML|CL|L|KG|GR|G|WL|WG|ER|STK|STCK|STUECK|ST|BLATT|BL|METER|M|TABS|TAB|ROLLEN|ROLLE|RL|TUECHER|TUCH)\b/i;

/** Normalisiert Umlaute und Sonderzeichen wie im Produktabgleich. */
const norm = (t) => String(t).toUpperCase()
  .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS");

/**
 * Menge aus einem Artikelnamen ziehen.
 * @returns {null|{value, unit, raw}}
 */
function parseQuantity(text) {
  const m = norm(text).match(RE_QUANTITY);
  if (!m) return null;

  const value = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;

  let unit = UNIT_ALIASES[m[2].toUpperCase()] || m[2].toLowerCase();
  let out = value;

  // Auf die Basiseinheit bringen, in der der Katalog rechnet.
  if (unit === "l") { out = value * 1000; unit = "ml"; }
  else if (unit === "cl") { out = value * 10; unit = "ml"; }
  else if (unit === "kg") { out = value * 1000; unit = "g"; }

  return { value: Math.round(out * 100) / 100, unit, raw: m[0] };
}

/**
 * Packungsmenge für eine Bonposition: erst aus dem Text, sonst aus dem
 * Katalog. Woher der Wert stammt, wird mitgeliefert — ein Katalogwert
 * darf nicht als gemessen durchgehen.
 */
function packageValueFor(productId, rawText) {
  const e = nonFoodFor(productId);
  if (!e) return null;

  const parsed = parseQuantity(rawText || "");
  if (parsed && compatibleUnit(parsed.unit, e.package.unit)) {
    return { value: parsed.value, unit: parsed.unit, source: "bon", confidence: "GEMESSEN" };
  }
  return { value: e.package.value, unit: e.package.unit, source: "katalog", confidence: "REFERENZ" };
}

/** Passt die gefundene Einheit zu der, in der das Produkt rechnet? */
function compatibleUnit(found, expected) {
  if (!found || !expected) return false;
  if (found === expected) return true;
  // „10ER" bei Klopapier meint zehn Rollen, „50ER" bei Gefrierbeuteln
  // fünfzig Stück — Stück und Rolle sind hier dasselbe Zählmaß.
  const countUnits = new Set(["Stück", "Rolle", "Tab", "Blatt", "Tuch"]);
  return countUnits.has(found) && countUnits.has(expected);
}

/* ---------- Steuersatz-Heuristik (§9.1) ---------- */

const VAT = { REDUCED: 7, FULL: 19 };

// 19 %, aber trotzdem kein Haushaltsprodukt.
const FULL_RATE_BUT_FOOD = [
  "WASSER", "COLA", "LIMO", "SAFT", "BIER", "WEIN", "SEKT", "SPIRITUOSE",
  "SCHNAPS", "VODKA", "WHISKY", "GIN", "RUM", "LIKOER", "ENERGY", "EISTEE",
  "TABAK", "ZIGARETTEN", "HUNDEFUTTER", "KATZENFUTTER", "TIERFUTTER", "PFAND"
];

// 7 %, aber trotzdem kein Lebensmittel.
const REDUCED_RATE_BUT_NONFOOD = ["BLUMEN", "ZEITSCHRIFT", "ZEITUNG", "BUCH", "PFLANZE"];

/**
 * Einschätzung der Domäne einer Bonzeile.
 * @returns {{domain, confidence, reason}}  domain: FOOD | NONFOOD | UNKLAR
 */
function guessDomain(rawText, taxClass, vatPercent) {
  const text = norm(rawText || "");

  // Steuerkennzeichen A/B, wie auf Lidl-Bons: A ermäßigt, B voll.
  let vat = vatPercent;
  if (!vat && taxClass) vat = String(taxClass).toUpperCase() === "A" ? VAT.REDUCED : VAT.FULL;

  if (REDUCED_RATE_BUT_NONFOOD.some((w) => text.includes(w))) {
    return { domain: "NONFOOD", confidence: 0.7, reason: "Ausnahme: Non-Food zum ermäßigten Satz" };
  }
  if (FULL_RATE_BUT_FOOD.some((w) => text.includes(w))) {
    return { domain: "FOOD", confidence: 0.7, reason: "Ausnahme: Lebensmittel zum vollen Satz" };
  }
  if (vat === VAT.REDUCED) return { domain: "FOOD", confidence: 0.75, reason: "ermäßigter Steuersatz" };
  if (vat === VAT.FULL) return { domain: "NONFOOD", confidence: 0.6, reason: "voller Steuersatz" };
  return { domain: "UNKLAR", confidence: 0, reason: "kein Steuersatz auf der Zeile" };
}

/**
 * Anreicherung einer bereits zugeordneten Bonposition. Ist ein Produkt
 * erkannt, gilt der Katalog — die Heuristik ist nur für das, was übrig
 * bleibt.
 */
function enrichLine(line) {
  const productId = line.productId;
  const known = productId ? byId(productId) : null;

  if (known) {
    const e = nonFoodFor(productId);
    return {
      ...line,
      domain: known.isFood ? "FOOD" : "NONFOOD",
      domainConfidence: 1,
      domainReason: "im Katalog",
      consumptionClass: e ? e.consumptionClass : null,
      packaging: e ? packageValueFor(productId, line.raw) : null
    };
  }

  const guess = guessDomain(line.raw, line.taxClass, line.vatPercent);
  return {
    ...line,
    domain: guess.domain,
    domainConfidence: guess.confidence,
    domainReason: guess.reason,
    consumptionClass: null,
    packaging: null,
    // Eine Vermutung wird vorgeschlagen, nicht gebucht.
    needsConfirmation: true
  };
}

module.exports = {
  parseQuantity, packageValueFor, compatibleUnit, guessDomain, enrichLine,
  RE_QUANTITY, UNIT_ALIASES, VAT, FULL_RATE_BUT_FOOD, REDUCED_RATE_BUT_NONFOOD
};
