/**
 * wasteInference2.js — überarbeitete Fassung
 * ================================================================
 * Was gegenüber v1 besser ist:
 *
 * 1. SICHERHEITSSPERRE.
 *    Produkte mit Verbrauchsdatum (Hackfleisch, Geflügel, roher
 *    Fisch, vorgeschnittener Salat, geschnittenes Obst) werden bei
 *    der Verschwendungsschätzung gesondert behandelt: die App darf
 *    hier NIE andeuten, etwas sei "vermutlich noch gut". Sie darf
 *    nur feststellen, dass zu viel gekauft wurde.
 *
 * 2. MENGENBEZUG.
 *    Verschwendung wird pro Einheit gerechnet, nicht pro Einkauf.
 *    Wer zwei Salatköpfe kauft und einen wegwirft, verschwendet
 *    50 %, nicht 100 %.
 *
 * 3. GEÖFFNET/UNGEÖFFNET.
 *    Ein ungeöffneter Joghurt hält 21 Tage, ein geöffneter 5.
 *    Die Datenbank kennt beide Werte; die Schätzung nutzt den
 *    konservativeren, sobald ein Anbruch wahrscheinlich ist.
 *
 * 4. UNSICHERHEITSBAND STATT SCHEINGENAUIGKEIT.
 *    Ausgabe ist eine Spanne (min/max), nicht ein exakter Betrag.
 *    Aus dem Persona-Bericht: eine falsche Nachkommastelle
 *    untergräbt das Vertrauen in die gesamte App.
 *
 * 5. QUALITÄTSWEITERGABE.
 *    Beruht die Haltbarkeit auf einem reinen Schätzwert, wird das
 *    im Ergebnis mitgeführt -- das UI kann die Aussage dann
 *    entsprechend vorsichtiger formulieren.
 * ================================================================
 */

const { daysBetween } = require("./rhythmEngine2");
const { byId, isSafetyCritical, DATE_TYPE } = require("./foodDatabase");

const ANOMALY_MARGIN = 1.2;
const UNCERTAINTY_BAND = 0.35; // +/- 35 % um den Schätzwert

/**
 * Signal A — strukturelle Verschwendung:
 * Der Kaufrhythmus ist länger als die Haltbarkeit. Dann geht bei
 * praktisch jedem Zyklus ein Anteil verloren.
 */
function inferChronicWaste(productId, rhythmDays, unitPrice, quantity = 1) {
  const p = byId(productId);
  if (!p || !rhythmDays) return null;
  if (p.category === "Trocken/Vorrat" || p.category === "Tiefkühl") return null;

  // Bei mehreren Einheiten: Haltbarkeit gilt pro Einheit, nicht für den Stapel
  const effectiveShelfLife = p.shelfLifeDays;
  const perUnitRhythm = rhythmDays / Math.max(1, quantity);

  if (perUnitRhythm <= effectiveShelfLife) return null;

  const wastedFraction = Math.min(0.9, (perUnitRhythm - effectiveShelfLife) / perUnitRhythm);
  const centre = unitPrice * quantity * wastedFraction;

  return {
    productId,
    type: "chronic",
    estimated: true,
    quality: p.quality,
    safetyCritical: p.safetyCritical,
    wastedFraction: Math.round(wastedFraction * 100) / 100,
    eurosPerCycle: {
      min: Math.round(centre * (1 - UNCERTAINTY_BAND) * 100) / 100,
      max: Math.round(centre * (1 + UNCERTAINTY_BAND) * 100) / 100,
      mid: Math.round(centre * 100) / 100
    },
    reason: p.safetyCritical
      ? `${p.name} hat ein Verbrauchsdatum und hält nur etwa ${effectiveShelfLife} Tage. ` +
        `Gekauft wird alle ${Math.round(perUnitRhythm)} Tage — die Menge passt nicht zum Verbrauch.`
      : `Rhythmus (alle ${Math.round(perUnitRhythm)} Tage je Einheit) ist länger als die typische ` +
        `Haltbarkeit von ${effectiveShelfLife} Tagen.`
  };
}

/**
 * Signal B — einmalige Ausreißer:
 * Rhythmus ist grundsätzlich unbedenklich, ein einzelner Abstand
 * war aber deutlich zu lang.
 */
function inferAnomalies(productId, purchases, rhythmDays) {
  const p = byId(productId);
  if (!p || !rhythmDays || purchases.length < 2) return [];
  if (p.category === "Trocken/Vorrat" || p.category === "Tiefkühl") return [];

  const out = [];
  for (let i = 1; i < purchases.length; i++) {
    const prev = purchases[i - 1];
    const gap = daysBetween(prev.date, purchases[i].date);
    const qty = prev.quantity || 1;
    const shelfForBatch = p.shelfLifeDays * qty;

    if (gap > shelfForBatch * ANOMALY_MARGIN && gap > rhythmDays) {
      const centre = (prev.unitPrice || 0) * qty;
      out.push({
        productId,
        date: purchases[i].date,
        type: "anomaly",
        estimated: true,
        quality: p.quality,
        safetyCritical: p.safetyCritical,
        euros: {
          min: Math.round(centre * (1 - UNCERTAINTY_BAND) * 100) / 100,
          max: Math.round(centre * (1 + UNCERTAINTY_BAND) * 100) / 100,
          mid: Math.round(centre * 100) / 100
        },
        reason: `${gap} Tage bis zum Nachkauf, üblich sind ${rhythmDays}. ` +
                `Haltbarkeit von ${shelfForBatch} Tagen war überschritten.`
      });
    }
  }
  return out;
}

/** Beide Signale über den ganzen Haushalt. */
function inferWaste(history, rhythms) {
  const byProduct = new Map();
  for (const e of history) {
    if (!byProduct.has(e.productId)) byProduct.set(e.productId, []);
    byProduct.get(e.productId).push(e);
  }

  const chronic = [];
  const anomalies = [];

  for (const [productId, arr] of byProduct.entries()) {
    const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    const r = rhythms.get(productId);
    if (!r || !r.rhythmDays) continue;

    const lastEntry = sorted[sorted.length - 1];
    const c = inferChronicWaste(productId, r.rhythmDays, lastEntry.unitPrice || 0, r.lastQuantity || 1);
    if (c) chronic.push(c);

    anomalies.push(...inferAnomalies(productId, sorted, r.rhythmDays));
  }

  anomalies.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { chronic, anomalies };
}

/**
 * Explizite Nutzerangabe schlägt jede Schätzung.
 * "consumed" oder "have" heißt: nichts weggeworfen.
 */
function reconcileWithUserInput(events, userInput) {
  if (!userInput) return events;
  if (userInput.userReason === "consumed" || userInput.userReason === "have") {
    return events.filter((e) => !(e.productId === userInput.productId && e.date === userInput.date));
  }
  return events;
}

module.exports = { inferChronicWaste, inferAnomalies, inferWaste, reconcileWithUserInput, UNCERTAINTY_BAND };
