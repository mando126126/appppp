/**
 * impactMetrics.js — NEU
 * Persona-Anforderung: Impact-Investorin
 * ("Kilogramm vermiedener Abfall, nicht nur Euro. Und: wirkt die
 *   App, oder zieht sie nur Leute an, die schon sparsam sind?")
 * ================================================================
 * Was dieses Modul liefert:
 *   - Verschwendung in Kilogramm statt nur in Euro
 *   - Vergleich mit dem statistischen Referenzwert
 *   - Vorher/Nachher-Auswertung ab Nutzungsbeginn
 *
 * Was dieses Modul NICHT liefert und auch nicht vortäuscht:
 *   - CO2-Werte. Belastbare Emissionsfaktoren je Lebensmittel
 *     brauchen eine geprüfte Datenbasis; eine erfundene Zahl wäre
 *     hier schlimmer als keine.
 *   - Kausalität. Ein Vorher/Nachher-Vergleich in einem Haushalt
 *     ist kein Wirkungsnachweis. Für die Aussage "die App wirkt"
 *     braucht es die Vergleichsgruppe, die die Investorin
 *     ausdrücklich gefordert hat. Das steht unten als Feld
 *     `evidenceLevel` ehrlich drin.
 *
 * Referenzwerte (extern, mit Quelle):
 *   - Über 70 kg Lebensmittel pro Kopf und Jahr in privaten
 *     Haushalten weggeworfen; mehr als ein Drittel davon, weil es
 *     verdorben ist. Quelle: BZfE/BLE, Lebensmittel richtig lagern,
 *     Stand 20.02.2025.
 *   - Eine vierköpfige Familie kann laut einer forsa-Studie bis zu
 *     940 Euro pro Jahr sparen, wenn nichts in der Tonne landet.
 *     Quelle: ebenda (BZfE zitiert forsa).
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const REFERENCE = {
  kgPerPersonPerYear: 70,
  shareSpoiled: 0.33,
  forsaMaxSavingFamily4PerYear: 940,
  source: "BZfE/BLE, Lebensmittel richtig lagern, Stand 20.02.2025 (forsa-Studie zitiert)"
};

/**
 * Rechnet geschätzte Verschwendung von Euro in Kilogramm um.
 * Grundlage ist das typische Produktgewicht aus der Datenbank.
 */
function wasteInKilograms(wasteEvents) {
  let grams = 0;
  const byProduct = new Map();

  for (const e of wasteEvents) {
    const p = byId(e.productId);
    if (!p || !p.isFood) continue;

    // Anteil und Zyklen gegen unsinnige Werte absichern.
    // Im Stresstest erzeugten negative Anteile ein negatives
    // Verschwendungsgewicht -- eine Zahl, die es physisch nicht
    // geben kann und die jede Wirkungsaussage entwertet.
    const rawFraction = e.wastedFraction !== undefined ? e.wastedFraction : 1;
    const fraction = Number.isFinite(rawFraction) ? Math.min(1, Math.max(0, rawFraction)) : 0;
    const rawCycles = e.cycles === undefined ? 1 : e.cycles;
    const cycles = Number.isFinite(rawCycles) ? Math.max(0, rawCycles) : 0;

    const g = (p.typicalWeightG || 0) * fraction * cycles;
    if (!Number.isFinite(g) || g <= 0) continue;
    grams += g;

    byProduct.set(p.name, Math.round((byProduct.get(p.name) || 0) + g));
  }

  return {
    kg: Math.round((grams / 1000) * 100) / 100,
    grams: Math.round(grams),
    byProduct: [...byProduct.entries()]
      .map(([name, g]) => ({ name, kg: Math.round((g / 1000) * 100) / 100 }))
      .sort((a, b) => b.kg - a.kg),
    estimated: true
  };
}

/**
 * Ordnet den eigenen Wert in den statistischen Rahmen ein.
 * Bewusst ohne Wertung ("du bist schlechter als der Durchschnitt"),
 * weil das laut Persona-Bericht zum Deinstallieren führt.
 */
function compareToReference(kgPerYear, householdSize = 2) {
  const referenceSpoiled = REFERENCE.kgPerPersonPerYear * REFERENCE.shareSpoiled * householdSize;
  const ratio = referenceSpoiled > 0 ? kgPerYear / referenceSpoiled : 0;

  return {
    ownKgPerYear: Math.round(kgPerYear * 10) / 10,
    referenceKgPerYear: Math.round(referenceSpoiled * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    householdSize,
    note: `Referenz: ${REFERENCE.kgPerPersonPerYear} kg pro Kopf und Jahr, davon rund ` +
          `${Math.round(REFERENCE.shareSpoiled * 100)} % wegen Verderb. Quelle: ${REFERENCE.source}`,
    // Bewusst neutral formuliert, keine Bewertung der Person
    framing: ratio < 1
      ? "Dein geschätzter Wert liegt unter dem statistischen Rahmen."
      : "Dein geschätzter Wert liegt im oder über dem statistischen Rahmen."
  };
}

/**
 * Vorher/Nachher ab Nutzungsbeginn.
 * `evidenceLevel` sagt ehrlich, was die Zahl belegen kann -- und was nicht.
 */
function beforeAfter(wasteBefore, wasteAfter, weeksBefore, weeksAfter) {
  const perWeekBefore = weeksBefore > 0 ? wasteBefore / weeksBefore : 0;
  const perWeekAfter = weeksAfter > 0 ? wasteAfter / weeksAfter : 0;
  const change = perWeekBefore > 0 ? (perWeekAfter - perWeekBefore) / perWeekBefore : 0;

  let evidenceLevel;
  if (weeksBefore < 4 || weeksAfter < 4) evidenceLevel = "unzureichend";
  else if (weeksAfter < 12) evidenceLevel = "erster Hinweis";
  else evidenceLevel = "belastbarer Trend im Einzelhaushalt";

  return {
    perWeekBefore: Math.round(perWeekBefore * 100) / 100,
    perWeekAfter: Math.round(perWeekAfter * 100) / 100,
    changePercent: Math.round(change * 100),
    savedPerYear: Math.round((perWeekBefore - perWeekAfter) * 52 * 100) / 100,
    evidenceLevel,
    caveat: "Ein Vorher/Nachher-Vergleich in einem Haushalt zeigt keine Kausalität. " +
            "Für eine Wirkungsaussage braucht es eine Vergleichsgruppe ohne App."
  };
}

/** Positiv gerahmt: was gerettet wurde statt was verdorben ist. */
function rescuedFraming(savedEurosPerWeek, savedKgPerWeek) {
  return {
    perWeek: { euros: Math.round(savedEurosPerWeek * 100) / 100, kg: Math.round(savedKgPerWeek * 100) / 100 },
    perYear: { euros: Math.round(savedEurosPerWeek * 52), kg: Math.round(savedKgPerWeek * 52 * 10) / 10 },
    headline: `${Math.round(savedEurosPerWeek * 52)} € und ${Math.round(savedKgPerWeek * 52 * 10) / 10} kg im Jahr gerettet`,
    reference: `Zum Vergleich: bis zu ${REFERENCE.forsaMaxSavingFamily4PerYear} € pro Jahr bei einer vierköpfigen Familie, ` +
               `wenn nichts in der Tonne landet (forsa, zitiert nach BZfE).`
  };
}

module.exports = { wasteInKilograms, compareToReference, beforeAfter, rescuedFraming, REFERENCE };
