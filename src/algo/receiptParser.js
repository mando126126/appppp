/**
 * receiptParser.js — eine Grammatik für vier echte Bons
 * ================================================================
 * Vorgänger war `lidlParser.js`, kalibriert an genau EINEM echten
 * Lidl-Bon. Er hat vier Dinge richtig gesehen, die auch hier
 * gelten: Rabatte sind eigene Zeilen, Pfand ist eine eigene
 * Position, Gewichtsware hat eine Folgezeile, Namen sind brutal
 * abgekürzt.
 *
 * Nur eine Annahme hat nicht getragen — und es war die, auf der
 * die ganze Zeilenerkennung stand:
 *
 *   „EINGERÜCKTE ZEILEN GEHÖREN ZUR POSITION DARÜBER."
 *
 * Das stimmt bei Lidl. Bei REWE steht die Mengenzeile eingerückt
 * UNTER der Position, bei Netto eingerückt DARÜBER, und bei EDEKA
 * ist der ganze Bon eingerückt. Einrückung trägt also keine
 * Bedeutung, sie sieht nur so aus.
 *
 * WAS STATTDESSEN TRÄGT: DIE RECHNUNG.
 *
 *   Netto:   16 x 0,89                    ← Menge oben
 *            Booster Juneberry    14,24
 *
 *   REWE:    HAEHNCHEN PAELLA      5,58   ← Menge unten
 *            2 Stk x 2,79
 *
 * Beide Male steht dieselbe nackte Mengenzeile da, einmal vor und
 * einmal hinter ihrer Position. Welche gemeint ist, verrät kein
 * Layout und keine Kette, sondern das Produkt: 16 × 0,89 = 14,24
 * und 2 × 2,79 = 5,58. Die Zeile, zu der es aufgeht, ist die
 * richtige. Geht es zu keiner auf, wird die Mengenzeile verworfen
 * — lieber eine Menge zu wenig als eine erfundene.
 *
 * DAS ZWEITE, WAS DAZUGEKOMMEN IST: DIE GEGENPROBE.
 *
 * Fast jeder Bon nennt seine Summe selbst. Vorher hat der Parser
 * an dieser Zeile abgebrochen, ohne sie zu lesen — und damit die
 * einzige Kontrolle weggeworfen, die es überhaupt gibt. Auf dem
 * EDEKA-Foto stand „BAUCHSPECK 1,19" zweimal; die Texterkennung
 * hat eine der beiden verloren. Sieben Positionen sahen genauso
 * richtig aus wie acht. Nur die aufgedruckte 14,84 gegen die
 * erkannten 13,65 zeigt, dass etwas fehlt.
 *
 * Die Gegenprobe BUCHT NICHTS UM. Sie erzeugt eine Warnung, mehr
 * nicht. Was fehlt, ergänzt ein Mensch — der Parser darf raten,
 * aber nichts stillschweigend geradebiegen.
 * ================================================================
 */

/**
 * Betrag lesen — das letzte Trennzeichen ist das Komma.
 *
 * „14.24" ist vierzehn Euro, nicht eintausendvierhundert: die
 * Texterkennung verwechselt Punkt und Komma nach Belieben, und wer
 * einfach alle Punkte streicht, macht aus jedem englisch
 * geschriebenen Betrag das Hundertfache. „1.234,56" muss trotzdem
 * gehen. Also: hinter dem LETZTEN Trennzeichen stehen die
 * Nachkommastellen, alles davor ist Tausenderpunkt.
 */
const num = (s) => {
  const t = String(s).trim();
  const i = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (i < 0) return parseFloat(t);
  return parseFloat(t.slice(0, i).replace(/[.,]/g, "") + "." + t.slice(i + 1));
};

const round2 = (x) => Math.round(x * 100) / 100;

/* Der Schwanz jeder Positionszeile: Betrag, dann in beliebiger
   Reihenfolge das Steuerkennzeichen (A/B/1/2) und der Stern für
   „nicht rabattfähig". REWE setzt „0,25 A *", Netto „4,00* A",
   Lidl gar nichts. */
const TAIL = String.raw`\s*\*?\s*([A-Z12])?\s*\*?\s*$`;

/* Ein Betrag — mit oder ohne Tausenderpunkt. Die zweite Hälfte der
   Alternative fängt den Normalfall „4,58"; die erste braucht es
   für „1.234,56", das auf Bons von Großmärkten vorkommt und ohne
   sie gar nicht als Betrag erkannt würde. */
const AMOUNT = String.raw`-?(?:\d{1,3}(?:[.,]\d{3})+|\d+)[.,]\d{2}`;

/* Zeile mit Menge inline (Lidl):  Name   1,15 x   2    2,30 A */
const RE_QTY = new RegExp(
  String.raw`^\s*(\S.*?)\s{2,}(${AMOUNT})\s*[xX*]\s*(\d+)\s+(${AMOUNT})` + TAIL);
/* Einfache Zeile:   Name                 4,58 A */
const RE_SIMPLE = new RegExp(String.raw`^\s*(\S.*?)\s{2,}(${AMOUNT})` + TAIL);
/* Gewichtszeile:      0,199 kg x 22,99  EUR/kg */
const RE_WEIGHT = /^\s*(\d+[.,]\d+)\s*(kg|g)\s*[xX*]\s*(\d+[.,]\d{2})\s*EUR\/(kg|g)/i;

/* Nackte Mengenzeile OHNE Namen — die ganze Zeile ist nur Anzahl
   und Einzelpreis. REWE schreibt „2 Stk x 2,79", Netto „16 x 0,89".
   Dass kein Name dabeisteht, ist das Erkennungsmerkmal: eine
   Position hat immer einen. */
const RE_QTY_LINE = /^\s*(\d{1,3})\s*(?:Stk|St|Stck|Stück)?\.?\s*[xX*]\s*(\d+[.,]\d{2})\s*$/i;

/* Rabattwörter — irgendwo in der Zeile, nicht nur am Anfang.
   Netto schreibt „Rabatt", „Rabatt 5%", „25% Rabatt" und
   „0.20€ Rabatt" auf EINEM Bon; nur die erste Schreibweise fängt
   mit dem Wort an. „GRATIS" nennt das Wort gar nicht mehr. */
const DISCOUNT_WORDS =
  /(Preisvorteil|Lidl\s*Plus\s*Rabatt|Sofortrabatt|Treuerabatt|Aktionsrabatt|Rabatt|Nachlass|Coupon|Gutschein|GRATIS|Gratis)/i;
/* Eine Rabattzeile ist: irgendein Text, dann ein NEGATIVER Betrag
   am Zeilenende. Das Vorzeichen ist der zweite Anker — ein Rabatt
   ohne Minus ist keiner. */
const RE_NEGATIVE_LINE = new RegExp(String.raw`^\s*(\S.*?)\s+(-\d+[.,]\d{2})` + TAIL);

/* Pfand und Leergut. „Pfand", „EW-Pfand", „Leergut",
   „Mehrwegleergut", „Einwegleergut" — fünf Namen für zwei Dinge:
   Pfand, das man zahlt, und Pfand, das man zurückbekommt. Beides
   ist kein Lebensmittel und gehört weder in die Verschwendungs-
   noch in die Kilogrammrechnung. */
const RE_DEPOSIT = /^\s*(?:einweg|mehrweg|ew|mw)?[-\s]?(?:pfand|leergut)/i;

/* Die aufgedruckte Endsumme. */
const RE_TOTAL = /^\s*(?:SUMME|Summe|GESAMT|Gesamtbetrag|Gesamtsumme|zu zahlen|Zu zahlen)\b/i;

/* Wo die Positionen aufhören.

   „Bar" braucht eine Zahl dahinter. Ohne sie würde die Zeile
   „Bar Snack 1,99" den Bon mittendrin abschneiden — und der Rest
   des Einkaufs wäre lautlos weg. Ein Zahlungsvermerk nennt immer
   einen Betrag, ein Produktname fast nie direkt nach dem ersten
   Wort. */
const RE_STOP = /^\s*(?:SUMME|Summe|GESAMT|Gesamtbetrag|Gesamtsumme|zu zahlen|Zu zahlen|Geg\.|Gegeben|Rückgeld|Rueckgeld|Kartenzahlung|EC-|Girocard|Bar\s+\d)/i;

/* Sieht die Zeile überhaupt aus wie eine Position?

   Nur solche Zeilen sind eine Warnung wert. Ein Bon besteht zur
   Hälfte aus Anschrift, Steuernummer und Werbespruch — wer die
   alle meldet, macht die Warnliste so lang, dass die eine Zeile,
   auf die es ankommt, darin untergeht. */
const RE_LOOKS_LIKE_ITEM = new RegExp(String.raw`(-?\d{1,4}[.,]\d{2})` + TAIL);

/**
 * Die aufgedruckte Summe suchen — über den GANZEN Text, bevor die
 * Positionsschleife läuft.
 *
 * Der Grund für den eigenen Durchgang: bei REWE steht die
 * Trennlinie VOR der Summenzeile, bei Netto steht die Summe
 * zweimal, bei EDEKA folgt darunter noch eine „SUMME MWST". Wer
 * die Summe erst beim Abbruch mitnimmt, bekommt je nach Kette die
 * richtige, gar keine oder die falsche. Der erste Treffer über
 * alles ist bei allen vier Bons der richtige.
 */
function findPrintedTotal(lines) {
  for (const raw of lines) {
    if (!RE_TOTAL.test(raw)) continue;
    // Eine Steuertabellen-Zeile („SUMME MWST 1,73 13,11") nennt
    // mehrere Beträge und ist nie die Endsumme.
    if (/\b(MwSt|MWST|USt|UST|Steuer)\b/.test(raw)) continue;
    const alle = [...String(raw).matchAll(/(-?\d{1,5}[.,]\d{2})(?!\d)/g)];
    if (!alle.length) continue;
    const wert = num(alle[alle.length - 1][1]);
    if (Number.isFinite(wert) && wert > 0) return round2(wert);
  }
  return null;
}

/**
 * Zerlegt den Bon-Text in Positionen.
 * @returns {{items, deposits, discountTotal, sum, printedTotal, warnings}}
 */
function parseReceipt(text, opts = {}) {
  const lines = String(text).split(/\r?\n/);
  const printedTotal = findPrintedTotal(lines);

  const items = [];
  const deposits = [];
  const warnings = [];
  let last = null;          // zuletzt angelegte WARENposition
  let lastAny = null;       // zuletzt angelegte Zeile (auch Pfand)
  let pending = null;       // Mengenzeile, die auf ihre Position wartet

  /* Eine wartende Mengenzeile gilt genau für die nächste Position
     — und nur, wenn die Rechnung aufgeht. Sonst war sie etwas
     anderes und wird verworfen. */
  const applyPending = (record) => {
    if (!pending) return;
    const erwartet = round2(pending.qty * pending.unit);
    if (Math.abs(erwartet - record.listed) <= 0.02) {
      record.quantity = pending.qty;
      record.unitPrice = pending.unit;
      record.qtyFromLine = true;
    } else {
      warnings.push(
        `Mengenzeile ohne Position: ${pending.qty} × ${pending.unit.toFixed(2)} ` +
        `= ${erwartet.toFixed(2)}, nächste Zeile nennt ${record.listed.toFixed(2)}`);
    }
    pending = null;
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^\s*[-=]{5,}/.test(raw)) break;           // Trennlinie = Ende der Positionen
    if (RE_STOP.test(raw)) break;

    // (a) Gewichtszeile — gehört zur Position darüber
    const w = raw.match(RE_WEIGHT);
    if (w && lastAny) {
      const value = num(w[1]);
      lastAny.weightG = w[2].toLowerCase() === "kg" ? value * 1000 : value;
      lastAny.pricePerKg = num(w[3]);
      lastAny.byWeight = true;
      continue;
    }

    /* (b) Nackte Mengenzeile — oben oder unten, das entscheidet die
       Rechnung, nicht die Stelle.

       Rückwärts wird nur geprüft, wenn die Position darüber noch
       keine Menge hat: sonst würde bei Netto die Mengenzeile der
       NÄCHSTEN Position der vorigen zugeschlagen, sobald deren
       Gesamtpreis zufällig passt. */
    const q = raw.match(RE_QTY_LINE);
    if (q) {
      const qty = parseInt(q[1], 10);
      const unit = num(q[2]);
      const erwartet = round2(qty * unit);
      const passtRueckwaerts = lastAny && !lastAny.qtyFromLine && lastAny.quantity === 1 &&
        Math.abs(erwartet - lastAny.listed) <= 0.02;
      if (passtRueckwaerts) {
        lastAny.quantity = qty;
        lastAny.unitPrice = unit;
        lastAny.qtyFromLine = true;
      } else {
        if (pending) {
          warnings.push(`Mengenzeile ohne Position: ${pending.qty} × ${pending.unit.toFixed(2)}`);
        }
        pending = { qty, unit };
      }
      continue;
    }

    /* (c) Rabattzeile — vom Preis der Position darüber abziehen.

       „Darüber" heißt: die letzte WARE. Pfand wird in Deutschland
       nie rabattiert, es ist ein gesetzlich fester Betrag. Auf dem
       Netto-Bon steht zwischen einem Getränk und seinem Rabatt die
       Pfandzeile — wer den Rabatt dort anhängt, macht aus 25 Cent
       Pfand minus sechs Euro. */
    const n = raw.match(RE_NEGATIVE_LINE);
    if (n && DISCOUNT_WORDS.test(n[1]) && !RE_DEPOSIT.test(raw)) {
      const ziel = last || lastAny;
      if (!ziel) { warnings.push(`Rabatt ohne zugehörige Position: ${raw.trim()}`); continue; }
      const amount = num(n[2]); // negativ
      ziel.discounts.push({ label: n[1].trim(), amount });
      ziel.paid = round2(ziel.paid + amount);
      continue;
    }

    // (d) Position mit Menge inline
    let m = raw.match(RE_QTY);
    let entry = null;
    if (m) {
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: parseInt(m[3], 10),
        listed: num(m[4]), taxClass: m[5] || null
      };
    } else {
      m = raw.match(RE_SIMPLE);
      if (!m) {
        if (RE_LOOKS_LIKE_ITEM.test(raw)) warnings.push(`Zeile nicht erkannt: ${raw.trim()}`);
        continue;
      }
      entry = {
        raw: m[1].trim(), unitPrice: num(m[2]), quantity: 1,
        listed: num(m[2]), taxClass: m[3] || null
      };
    }

    /* Ein Name ohne zwei zusammenhängende Buchstaben ist kein
       Produkt, sondern eine Nummer oder eine Tabellenzeile.

       Gefunden hat das der Zufallstest, nicht ich: wenn die
       Erkennung ausgerechnet die Summenzeile verliert, liest der
       Parser weiter in die Steuertabelle hinein und macht aus
       „7,00 %   0,45   6,40" eine Position namens „7,00 % 0,45".
       Die Ausrichtung filtert solche Zeilen längst — der Parser
       aber bekommt auch von Hand eingefügten Text, und dort gab es
       diesen Riegel bisher nicht. */
    if (!/[A-Za-zÄÖÜäöüß]{2}/.test(entry.raw)) {
      warnings.push(`Zeile ohne Produktnamen übersprungen: ${raw.trim()}`);
      continue;
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
      byWeight: false,
      qtyFromLine: false
    };

    applyPending(record);

    // (e) Pfand und Leergut: eigene Position, gehört zur Ware davor
    if (RE_DEPOSIT.test(entry.raw)) {
      record.isDeposit = true;
      record.belongsTo = last ? last.raw : null;
      deposits.push(record);
      lastAny = record;
      continue;
    }

    /* Ein negativer Betrag, der KEIN Rabatt und KEIN Leergut ist,
       ist eine Stornierung oder ein Lesefehler. Eine Position mit
       negativem Preis würde in der Historie einen Kaufpreis unter
       null erzeugen. */
    if (record.listed < 0) {
      warnings.push(`Negative Position übersprungen: ${raw.trim()}`);
      continue;
    }

    items.push(record);
    last = record;
    lastAny = record;
  }

  if (pending) {
    warnings.push(`Mengenzeile ohne Position: ${pending.qty} × ${pending.unit.toFixed(2)}`);
  }

  // Rechnerische Kontrolle: Einzelpreis × Menge muss dem Zeilenpreis entsprechen
  for (const it of [...items, ...deposits]) {
    const expected = round2(it.unitPrice * it.quantity);
    if (it.quantity > 1 && Math.abs(expected - it.listed) > 0.02) {
      warnings.push(`Rechenprobe: ${it.raw} — ${it.unitPrice} × ${it.quantity} = ${expected}, Bon nennt ${it.listed}`);
    }
    if (it.byWeight && it.pricePerKg) {
      const calc = round2((it.weightG / 1000) * it.pricePerKg);
      if (Math.abs(calc - it.listed) > 0.02) {
        warnings.push(`Gewichtsprobe: ${it.raw} — errechnet ${calc}, Bon nennt ${it.listed}`);
      }
    }
  }

  const discountTotal = round2([...items, ...deposits]
    .reduce((s, i) => s + i.discounts.reduce((a, d) => a + d.amount, 0), 0));
  const sum = round2([...items, ...deposits].reduce((s, i) => s + i.paid, 0));

  /* Die Gegenprobe. Sie korrigiert nichts — sie sagt nur, dass
     etwas nicht stimmt, und überlässt die Entscheidung dem
     Menschen, der den Bon vor sich liegen hat. */
  let totalDiff = null;
  if (printedTotal !== null) {
    totalDiff = round2(printedTotal - sum);
    if (Math.abs(totalDiff) > 0.02) {
      warnings.push(
        `Summenprobe: Der Bon nennt ${printedTotal.toFixed(2)}, erkannt wurden ${sum.toFixed(2)} — ` +
        (totalDiff > 0
          ? `${totalDiff.toFixed(2)} fehlen. Wahrscheinlich ist eine Zeile nicht gelesen worden.`
          : `${Math.abs(totalDiff).toFixed(2)} zu viel. Wahrscheinlich ist eine Zeile doppelt gelesen worden.`));
    }
  }

  return {
    items, deposits,
    discountTotal,
    sum,
    printedTotal,
    totalDiff,
    totalOk: printedTotal === null ? null : Math.abs(totalDiff) <= 0.02,
    warnings
  };
}

module.exports = {
  parseReceipt, findPrintedTotal,
  RE_QTY, RE_SIMPLE, RE_WEIGHT, RE_QTY_LINE, RE_DEPOSIT, DISCOUNT_WORDS
};
