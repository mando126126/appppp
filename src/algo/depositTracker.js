/**
 * depositTracker.js — NEU (Feature 5)
 * ================================================================
 * Leergut liegt wochenlang herum. Aus dem Bon ist das Pfand
 * ablesbar -- und die Rückgabe wird zur Erinnerung mit Betrag.
 *
 * PFANDSÄTZE (Deutschland, Stand 2026):
 *   Einwegpfand nach Verpackungsgesetz: 0,25 € einheitlich für
 *   Einweggetränkeverpackungen (Dosen, PET-Einweg). Dieser Satz
 *   ist gesetzlich einheitlich.
 *
 *   Mehrwegpfand ist NICHT gesetzlich festgelegt, sondern
 *   herstellerabhängig. Die Werte unten sind die im deutschen
 *   Handel üblichen Sätze und ausdrücklich als `typisch`
 *   gekennzeichnet -- sie können je nach Hersteller abweichen.
 *   Deshalb gilt hier dieselbe Regel wie bei den Haltbarkeits-
 *   werten: Schätzwerte werden als solche ausgewiesen, nicht als
 *   Fakten dargestellt.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const DEPOSIT_TYPES = {
  EINWEG: { value: 0.25, label: "Einweg (Dose/PET)", quality: "gesetzlich" },
  MEHRWEG_GLAS_BIER: { value: 0.08, label: "Bierflasche Glas", quality: "typisch" },
  MEHRWEG_GLAS_STANDARD: { value: 0.15, label: "Mehrweg Glas", quality: "typisch" },
  MEHRWEG_PET: { value: 0.25, label: "Mehrweg PET", quality: "typisch" },
  KASTEN: { value: 1.50, label: "Getränkekasten", quality: "typisch" },
  KEIN: { value: 0, label: "kein Pfand", quality: "gesetzlich" }
};

/** Ordnet einem Produkt den wahrscheinlichen Pfandtyp zu. */
function depositTypeFor(productId, hint = null) {
  if (hint && DEPOSIT_TYPES[hint]) return DEPOSIT_TYPES[hint];

  const p = byId(productId);
  if (!p) return DEPOSIT_TYPES.KEIN;
  if (p.category !== "Getränke") return DEPOSIT_TYPES.KEIN;

  if (p.id === "bier") return DEPOSIT_TYPES.MEHRWEG_GLAS_BIER;
  if (["wein", "sekt", "spirituose"].includes(p.id)) return DEPOSIT_TYPES.KEIN;
  if (["wasser", "limonade", "eistee"].includes(p.id)) return DEPOSIT_TYPES.EINWEG;
  if (["saft_orange", "saft_apfel", "saft_multi"].includes(p.id)) return DEPOSIT_TYPES.MEHRWEG_GLAS_STANDARD;

  return DEPOSIT_TYPES.KEIN;
}

/** Erfasst das Pfand eines Einkaufs. */
function trackFromReceipt(receiptItems, date) {
  const entries = [];
  let total = 0;

  for (const item of receiptItems) {
    const type = depositTypeFor(item.productId, item.depositHint);
    if (type.value === 0) continue;

    // Negative Mengen kommen auf echten Bons vor (Storno-Zeilen,
    // Rückgaben). Ohne Abfangen entsteht negatives Pfand -- ein
    // Betrag, der im Ergebnis wie ein Guthaben aussieht, aber
    // keines ist. Im Stresstest gefunden.
    const rawQty = item.quantity === undefined ? 1 : item.quantity;
    const qty = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : 0;
    if (qty === 0) continue;

    const amount = Math.round(type.value * qty * 100) / 100;
    total += amount;

    entries.push({
      productId: item.productId,
      name: byId(item.productId)?.name || item.productId,
      quantity: qty,
      depositPerUnit: type.value,
      amount,
      typeLabel: type.label,
      quality: type.quality,
      date,
      returned: false
    });
  }

  return {
    date,
    entries,
    total: Math.round(total * 100) / 100,
    note: entries.some((e) => e.quality === "typisch")
      ? "Mehrwegpfand ist herstellerabhängig — die Beträge sind übliche Sätze, keine gesetzlichen Werte."
      : null
  };
}

/**
 * Offenes Pfand über alle Einkäufe.
 * Ab welchem Betrag sich der Weg lohnt, entscheidet der Nutzer --
 * die App drängt nicht, sondern zeigt nur den Stand.
 */
function openDeposit(allEntries, today, opts = {}) {
  const reminderThreshold = opts.reminderThreshold ?? 5;
  const open = allEntries.filter((e) => !e.returned);
  const total = open.reduce((s, e) => s + e.amount, 0);

  const oldest = open.length
    ? open.reduce((a, b) => (a.date < b.date ? a : b)).date
    : null;

  const daysOpen = oldest && today
    ? Math.round((new Date(today) - new Date(oldest)) / 86400000)
    : 0;

  const byType = new Map();
  open.forEach((e) => {
    const cur = byType.get(e.typeLabel) || { count: 0, amount: 0 };
    byType.set(e.typeLabel, { count: cur.count + e.quantity, amount: cur.amount + e.amount });
  });

  return {
    total: Math.round(total * 100) / 100,
    positions: open.length,
    units: open.reduce((s, e) => s + e.quantity, 0),
    oldestDate: oldest,
    daysOpen,
    byType: [...byType.entries()].map(([label, v]) => ({
      label, count: v.count, amount: Math.round(v.amount * 100) / 100
    })).sort((a, b) => b.amount - a.amount),
    worthReturning: total >= reminderThreshold,
    message: total >= reminderThreshold
      ? `${total.toFixed(2).replace(".", ",")} € Pfand offen — das älteste liegt seit ${daysOpen} Tagen herum.`
      : `${total.toFixed(2).replace(".", ",")} € Pfand offen.`
  };
}

/** Markiert Leergut als zurückgegeben. */
function markReturned(allEntries, productIds, date) {
  return allEntries.map((e) =>
    productIds.includes(e.productId) && !e.returned
      ? { ...e, returned: true, returnedDate: date }
      : e
  );
}

/** Jahresbilanz: wie viel Pfand fällt überhaupt an. */
function yearlyDepositVolume(allEntries) {
  const total = allEntries.reduce((s, e) => s + e.amount, 0);
  const returned = allEntries.filter((e) => e.returned).reduce((s, e) => s + e.amount, 0);
  return {
    total: Math.round(total * 100) / 100,
    returned: Math.round(returned * 100) / 100,
    open: Math.round((total - returned) * 100) / 100,
    returnRate: total > 0 ? Math.round((returned / total) * 100) : 0
  };
}

module.exports = {
  trackFromReceipt, openDeposit, markReturned, yearlyDepositVolume,
  depositTypeFor, DEPOSIT_TYPES
};
