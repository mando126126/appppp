/**
 * vacationMode.js — NEU (Feature 4)
 * ================================================================
 * Jeder Urlaub produziert denselben Verlust: Der Kühlschrank ist
 * voll, die Abreise kommt, drei Tage später ist alles hin.
 *
 * Zwei Funktionen, beide aus vorhandenen Daten:
 *
 * 1. VOR DER ABREISE: Frischware, die die Abwesenheit nicht
 *    übersteht, wird nicht mehr vorgeschlagen. Stattdessen eine
 *    "aufbrauchen"-Liste aus dem geschätzten Bestand -- inklusive
 *    Hinweis, was sich einfrieren lässt (freezable in der Datenbank).
 *
 * 2. NACH DER RÜCKKEHR: Die Rhythmen wissen bereits, dass eine
 *    Unterbrechung war (Pausenerkennung in rhythmEngine2). Der
 *    Urlaubsmodus meldet das explizit an, damit die Pause nicht
 *    erst nachträglich aus den Daten geschlossen werden muss.
 *
 * Nebeneffekt: Das ist der einzige Moment, in dem ein Nutzer der
 * App freiwillig etwas erzählt (Reisedaten). Diese Angabe macht
 * gleichzeitig die Rhythmuserkennung sauberer.
 * ================================================================
 */

const { byId } = require("./foodDatabase");
const { daysBetween } = require("./rhythmEngine2");

/**
 * Filtert die Vorschlagsliste vor einer Abwesenheit.
 *
 * @param {Array} suggestions - normale Vorschlagsliste
 * @param {string} shoppingDate - wann eingekauft wird
 * @param {string} departureDate
 * @param {string} returnDate
 */
function filterForVacation(suggestions, shoppingDate, departureDate, returnDate) {
  const daysUntilDeparture = daysBetween(shoppingDate, departureDate);
  const absenceDays = daysBetween(departureDate, returnDate);

  if (!Number.isFinite(daysUntilDeparture) || !Number.isFinite(absenceDays)) {
    return { keep: suggestions, skip: [], reduce: [], daysUntilDeparture: null, absenceDays: null, savedEuros: 0 };
  }

  const keep = [], skip = [], reduce = [];

  for (const item of suggestions) {
    const p = byId(item.productId);
    if (!p) { keep.push(item); continue; }

    // Trockenware, Tiefkühl und Non-Food überstehen jede Abwesenheit
    if (!p.isFood || p.shelfLifeDays > daysUntilDeparture + absenceDays) {
      keep.push(item);
      continue;
    }

    // Ab hier: verderbliche Ware, die die Reise NICHT übersteht.
    // Entscheidend ist nicht, ob sie bis zur Abreise hält, sondern
    // ob sie bis dahin auch verbraucht werden kann. Ein Wochenvorrat
    // Milch zwei Tage vor der Abreise ist kein guter Kauf, auch wenn
    // die Milch selbst noch acht Tage hält.
    //
    // Faustregel: sinnvoll ist höchstens der Anteil, der in den
    // verbleibenden Tagen üblicherweise verbraucht wird.
    const rhythmDays = item.rhythmDays || null;
    const consumableShare = rhythmDays && rhythmDays > 0
      ? Math.min(1, daysUntilDeparture / rhythmDays)
      : Math.min(1, daysUntilDeparture / Math.max(1, p.shelfLifeDays));

    if (daysUntilDeparture <= 0) {
      skip.push({ ...item, reason: "Abreise steht unmittelbar bevor" });
    } else if (consumableShare < 0.35) {
      skip.push({
        ...item,
        reason: `nur noch ${daysUntilDeparture} Tag(e) bis zur Abreise — davon würde das meiste verderben`
      });
    } else if (consumableShare < 0.8) {
      reduce.push({
        ...item,
        suggestedShare: Math.round(consumableShare * 100) / 100,
        vacationNote: `kleinere Menge — nur etwa ${Math.round(consumableShare * 100)} % werden bis zur Abreise verbraucht`
      });
    } else {
      keep.push({ ...item, vacationNote: "bis zur Abreise verbrauchen" });
    }
  }

  return {
    keep, skip, reduce,
    daysUntilDeparture, absenceDays,
    savedEuros: Math.round(
      (skip.reduce((s, i) => s + (i.price || 0), 0) +
       reduce.reduce((s, i) => s + (i.price || 0) * (1 - i.suggestedShare), 0)) * 100
    ) / 100
  };
}

/**
 * Aufbrauchliste aus dem geschätzten Bestand.
 * Trennt in "muss weg", "einfrieren möglich" und "übersteht die Reise".
 */
function useUpPlan(inventory, departureDate, returnDate, today) {
  const daysUntilDeparture = daysBetween(today, departureDate);
  const absenceDays = daysBetween(departureDate, returnDate);

  const mustUse = [], freeze = [], survives = [];

  for (const item of inventory) {
    const p = byId(item.productId);
    if (!p || !p.isFood) continue;

    const survivesTrip = item.daysLeft > daysUntilDeparture + absenceDays;
    if (survivesTrip) { survives.push(item); continue; }

    if (p.freezable) {
      freeze.push({
        ...item,
        action: "einfrieren",
        hint: `${p.name} vor der Abreise einfrieren — hält sonst nur noch ${item.daysLeft} Tage.`
      });
    } else {
      mustUse.push({
        ...item,
        action: "aufbrauchen",
        hint: `${p.name} vor der Abreise verbrauchen (nicht einfrierbar, noch ${item.daysLeft} Tage).`
      });
    }
  }

  const valueAtRisk = [...mustUse, ...freeze].reduce((s, i) => s + (i.value || 0), 0);

  return {
    daysUntilDeparture, absenceDays,
    mustUse: mustUse.sort((a, b) => a.daysLeft - b.daysLeft),
    freeze: freeze.sort((a, b) => b.value - a.value),
    survives,
    valueAtRisk: Math.round(valueAtRisk * 100) / 100,
    summary: `${mustUse.length + freeze.length} Positionen im Wert von rund ` +
             `${(Math.round(valueAtRisk * 100) / 100).toFixed(2).replace(".", ",")} € ` +
             `überstehen die Reise nicht.`,
    estimated: true
  };
}

/**
 * Meldet die Abwesenheit an die Rhythmuslogik, damit die Lücke
 * nicht als Verhaltensänderung fehlgedeutet wird.
 */
function registerAbsence(departureDate, returnDate) {
  return {
    type: "abwesenheit",
    from: departureDate,
    to: returnDate,
    days: daysBetween(departureDate, returnDate),
    note: "Kaufabstände über diesen Zeitraum werden aus der Rhythmusberechnung ausgeschlossen."
  };
}

/** Prüft, ob ein Kaufabstand in eine gemeldete Abwesenheit fällt. */
function isDuringAbsence(fromDate, toDate, absences = []) {
  return absences.some((a) => fromDate <= a.to && toDate >= a.from);
}

module.exports = { filterForVacation, useUpPlan, registerAbsence, isDuringAbsence };
