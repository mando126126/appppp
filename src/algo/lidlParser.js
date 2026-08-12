/**
 * lidlParser.js — kalibriert an einem ECHTEN Lidl-Bon (22.07.2026)
 * ================================================================
 * Der alte receiptParser.js war an keiner realen Datei geprüft. Was
 * der echte Bon anders macht, als ich angenommen hatte:
 *
 * 1. RABATTE SIND EIGENE ZEILEN.
 *    "Preisvorteil -0,08" und "Lidl Plus Rabatt -0,23" stehen
 *    eingerückt UNTER der Position und müssen von deren Preis
 *    abgezogen werden. Wer das ignoriert, rechnet mit falschen
 *    Preisen — und damit auch falsche Verschwendungsbeträge.
 *
 * 2. PFAND IST EINE EIGENE POSITION.
 *    "Pfand 0,25 7%EM  0,25 x 2  0,50" folgt dem Getränk. Es ist
 *    kein Lebensmittel und darf weder in die Verschwendungs- noch
 *    in die Kilogrammrechnung. Es gehört aber zum Getränk davor.
 *
 * 3. GEWICHTSWARE HAT EINE FOLGEZEILE.
 *    "0,199 kg x 22,99 EUR/kg" liefert das echte Gewicht — viel
 *    besser als der Schätzwert typicalWeightG aus der Datenbank.
 *
 * 4. MENGE STEHT INLINE.
 *    "High Protein Kaffee  1,15 x  2  2,30" — Einzelpreis, Anzahl,
 *    Gesamtpreis in einer Zeile.
 *
 * 5. STEUERKENNZEICHEN A/B AM ZEILENENDE.
 *    A = ermäßigt (7 %, meist Lebensmittel), B = voll (19 %, meist
 *    Non-Food). Ein brauchbarer, aber nicht perfekter Hinweis:
 *    Vitaminwasser steht hier auf B, ist aber trinkbar.
 *
 * 6. NAMEN SIND BRUTAL ABGEKÜRZT.
 *    "ChickenNug.Cornflak.", "Vit.-Was. Pfir.-Holu", "IronMa.100%
 *    Sahne P." — mit 20 Zeichen Feldbreite. Das ist die eigentliche
 *    Schwierigkeit, nicht das Zerlegen der Zeilen.
 * ================================================================
 */

const num = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));

// Zeile mit Menge:  Name   1,15 x   2    2,30 A
const RE_QTY   = /^(\S.*?)\s{2,}(\d+[.,]\d{2})\s*x\s*(\d+)\s+(-?\d+[.,]\d{2})\s*([A-Z])?\s*$/;
// Einfache Zeile:   Name                 4,58 A
const RE_SIMPLE = /^(\S.*?)\s{2,}(-?\d+[.,]\d{2})\s*([A-Z])?\s*$/;
// Gewichtszeile:      0,199 kg x 22,99  EUR/kg
const RE_WEIGHT = /^\s+(\d+[.,]\d+)\s*(kg|g)\s*x\s*(\d+[.,]\d{2})\s*EUR\/(kg|g)/i;
// Rabattzeile:        Preisvorteil        -0,08
const RE_DISCOUNT = /^\s+(Preisvorteil|Lidl Plus Rabatt|Rabatt|Coupon)\s+(-\d+[.,]\d{2})/i;
// Pfandzeile
const RE_DEPOSIT = /^Pfand\s/i;

/**
 * Zerlegt den Bon-Text in Positionen.
 * @returns {{items, deposits, discountTotal, sum, warnings}}
 */
function parseLidlReceipt(text, opts = {}) {
  const lines = String(text).split(/\r?\n/);
  const items = [];
  const deposits = [];
  const warnings = [];
  let last = null;          // zuletzt angelegte Warenposition
  let lastAny = null;       // zuletzt angelegte Zeile (auch Pfand)

  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^-{5,}/.test(raw.trim())) break;         // Trennlinie = Ende der Positionen
    if (/^\s*(SUMME|Summe|zu zahlen|Geg\.|Rückgeld)/i.test(raw)) break;

    // (a) Gewichtszeile — gehört zur Position darüber
    const w = raw.match(RE_WEIGHT);
    if (w && lastAny) {
      const value = num(w[1]);
      lastAny.weightG = w[2].toLowerCase() === "kg" ? value * 1000 : value;
      lastAny.pricePerKg = num(w[3]);
      lastAny.byWeight = true;
      continue;
    }

    // (b) Rabattzeile — vom Preis der Position darüber abziehen
    const d = raw.match(RE_DISCOUNT);
    if (d) {
      if (!lastAny) { warnings.push(`Rabatt ohne zugehörige Position: ${raw.trim()}`); continue; }
      const amount = num(d[2]); // negativ
      lastAny.discounts.push({ label: d[1], amount });
      lastAny.paid = Math.round((lastAny.paid + amount) * 100) / 100;
      continue;
    }

    // (c) Position mit Menge
    let m = raw.match(RE_QTY);
    let entry = null;
    if (m) {
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: parseInt(m[3], 10),
        listed: num(m[4]), taxClass: m[5] || null
      };
    } else {
      m = raw.match(RE_SIMPLE);
      if (!m) { warnings.push(`Zeile nicht erkannt: ${raw.trim()}`); continue; }
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: 1,
        listed: num(m[2]), taxClass: m[3] || null
      };
    }

    const record = {
      raw: entry.raw,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      listed: entry.listed,
      paid: entry.listed,
      taxClass: entry.taxClass,
      discounts: [],
      weightG: null,
      pricePerKg: null,
      byWeight: false
    };

    // (d) Pfand: eigene Position, gehört aber zum Getränk davor
    if (RE_DEPOSIT.test(entry.raw)) {
      record.isDeposit = true;
      record.belongsTo = last ? last.raw : null;
      deposits.push(record);
      lastAny = record;
      continue;
    }

    items.push(record);
    last = record;
    lastAny = record;
  }

  // Rechnerische Kontrolle: Einzelpreis × Menge muss dem Zeilenpreis entsprechen
  for (const it of items) {
    const expected = Math.round(it.unitPrice * it.quantity * 100) / 100;
    if (it.quantity > 1 && Math.abs(expected - it.listed) > 0.02) {
      warnings.push(`Rechenprobe: ${it.raw} — ${it.unitPrice} × ${it.quantity} = ${expected}, Bon nennt ${it.listed}`);
    }
    if (it.byWeight && it.pricePerKg) {
      const calc = Math.round((it.weightG / 1000) * it.pricePerKg * 100) / 100;
      if (Math.abs(calc - it.listed) > 0.02) {
        warnings.push(`Gewichtsprobe: ${it.raw} — errechnet ${calc}, Bon nennt ${it.listed}`);
      }
    }
  }

  const discountTotal = [...items, ...deposits]
    .reduce((s, i) => s + i.discounts.reduce((a, d) => a + d.amount, 0), 0);
  const sum = [...items, ...deposits].reduce((s, i) => s + i.paid, 0);

  return {
    items, deposits,
    discountTotal: Math.round(discountTotal * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    warnings
  };
}

module.exports = { parseLidlReceipt, RE_QTY, RE_SIMPLE, RE_WEIGHT, RE_DISCOUNT };
