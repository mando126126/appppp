/**
 * householdSplit.js — NEU
 * Persona-Anforderung: Lena, 24, WG mit vier Personen
 * ("Ist das eine Sparapp oder eine Splitwise-Alternative? Weil das
 *   zweite würde ich sofort installieren.")
 * ================================================================
 * Zwei Dinge, die der Entwurf bisher nicht konnte:
 *
 * 1. ZUORDNUNG. Ein Bon enthält Gemeinsames und Privates in einer
 *    Liste. Ohne Trennung ist weder die Abrechnung fair noch die
 *    Verschwendungsstatistik brauchbar.
 *
 * 2. ABRECHNUNG. Wer hat wie viel ausgelegt, wer schuldet wem was.
 *    Der Ausgleich wird auf möglichst WENIGE Überweisungen
 *    reduziert — niemand will sechs Kleinbeträge hin- und
 *    herschieben.
 *
 * Zusätzlich: Verschwendung bekommt einen Namen. In einer WG
 * verdirbt Essen anonym, weil sich niemand zuständig fühlt.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

const SPLIT_MODE = { SHARED: "gemeinsam", PRIVATE: "privat" };

/**
 * Ordnet Bon-Positionen zu.
 * @param {Array} receiptItems
 * @param {object} assignment - { [productId]: {mode, person} }
 * @param {string} payer - wer bezahlt hat
 */
function assignItems(receiptItems, assignment, payer) {
  return receiptItems.map((item) => {
    const rule = assignment[item.productId] || { mode: SPLIT_MODE.SHARED };
    return {
      ...item,
      splitMode: rule.mode,
      owner: rule.mode === SPLIT_MODE.PRIVATE ? (rule.person || payer) : null,
      payer,
      total: (item.unitPrice || 0) * (item.quantity || 1)
    };
  });
}

/**
 * Berechnet, wer wem wie viel schuldet.
 *
 * Gerechnet wird durchgehend in CENT als Ganzzahl. Im Stresstest
 * summierten sich die Salden bei Fließkommarechnung um bis zu zwei
 * Cent nicht auf null — in einer WG-Abrechnung genau die Sorte
 * Fehler, über die gestritten wird.
 *
 * Bei nicht glatt teilbaren Beträgen (10 Cent durch 3 Personen)
 * werden die Restcent deterministisch auf die ersten Mitglieder
 * verteilt, statt sie wegzurunden. Dadurch stimmt die Summe exakt.
 *
 * @param {Array} assignedItems - Ergebnis von assignItems
 * @param {Array<string>} members - alle Mitbewohner
 */
function computeBalances(assignedItems, members) {
  if (!members || members.length === 0) return {};

  const cents = new Map(members.map((m) => [m, 0]));
  const add = (person, value) => {
    if (!cents.has(person)) return false; // Unbekannte Person ignorieren
    cents.set(person, cents.get(person) + value);
    return true;
  };

  for (const item of assignedItems) {
    const costCents = Math.round((item.total || 0) * 100);
    if (!Number.isFinite(costCents) || costCents === 0) continue;

    // Zahler muss Mitglied sein, sonst lässt sich nichts zuordnen
    if (!cents.has(item.payer)) continue;

    if (item.splitMode === SPLIT_MODE.SHARED) {
      const base = Math.floor(costCents / members.length);
      let remainder = costCents - base * members.length;
      members.forEach((m, idx) => {
        const share = base + (idx < remainder ? 1 : 0);
        add(m, -share);
      });
      add(item.payer, costCents);
    } else {
      // Privat: Besitzer trägt die Kosten. Unbekannter Besitzer
      // fällt auf den Zahler zurück, damit die Summe stimmt.
      const owner = cents.has(item.owner) ? item.owner : item.payer;
      if (owner !== item.payer) {
        add(item.payer, costCents);
        add(owner, -costCents);
      }
    }
  }

  const result = {};
  for (const [m, v] of cents.entries()) result[m] = v / 100;
  return result;
}

/**
 * Minimiert die Zahl der nötigen Überweisungen.
 * Greedy: größter Schuldner zahlt an größten Gläubiger, bis alles
 * ausgeglichen ist. Nicht immer das theoretische Optimum, aber
 * nachvollziehbar und in der Praxis nah dran.
 *
 * Gerechnet wird in CENT als Ganzzahl. Mit Euro-Fließkommazahlen
 * entstand sonst ein Rundungsrest: die Summe der Überweisungen
 * stimmte um einen Cent nicht mit dem Saldo überein -- in einer
 * WG-Abrechnung genau die Sorte Fehler, die Vertrauen kostet.
 */
function settleUp(balances) {
  const creditors = [];
  const debtors = [];
  for (const [person, amount] of Object.entries(balances)) {
    const cents = Math.round(amount * 100);
    if (cents > 0) creditors.push({ person, cents });
    else if (cents < 0) debtors.push({ person, cents: -cents });
  }
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const transfers = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cents = Math.min(creditors[ci].cents, debtors[di].cents);
    if (cents > 0) {
      transfers.push({
        from: debtors[di].person,
        to: creditors[ci].person,
        amount: cents / 100
      });
    }
    creditors[ci].cents -= cents;
    debtors[di].cents -= cents;
    if (creditors[ci].cents === 0) ci++;
    if (debtors[di].cents === 0) di++;
  }
  return transfers;
}

/**
 * Verschwendung mit Zuständigkeit: In einer WG verdirbt Essen
 * anonym. Diese Zuordnung macht sichtbar, wessen Vorrat es war --
 * bewusst neutral formuliert, ohne Schuldzuweisung.
 */
function attributeWaste(wasteEvents, assignedItems) {
  const ownerByProduct = new Map();
  for (const item of assignedItems) {
    if (item.splitMode === SPLIT_MODE.PRIVATE && item.owner) {
      ownerByProduct.set(item.productId, item.owner);
    }
  }

  return wasteEvents.map((e) => ({
    ...e,
    attributedTo: ownerByProduct.get(e.productId) || "gemeinsam",
    productName: byId(e.productId)?.name || e.productId
  }));
}

/** Was bald abläuft, mit Zuständigkeit -- der eigentliche WG-Nutzen. */
function expiringWithOwner(stock, assignedItems, withinDays = 3) {
  const ownerByProduct = new Map();
  for (const item of assignedItems) {
    if (item.splitMode === SPLIT_MODE.PRIVATE && item.owner) {
      ownerByProduct.set(item.productId, item.owner);
    }
  }

  return stock
    .filter((s) => s.daysLeft !== undefined && s.daysLeft <= withinDays)
    .map((s) => ({
      productId: s.productId,
      name: byId(s.productId)?.name || s.productId,
      daysLeft: s.daysLeft,
      owner: ownerByProduct.get(s.productId) || "gemeinsam",
      message: ownerByProduct.has(s.productId)
        ? `${byId(s.productId)?.name} von ${ownerByProduct.get(s.productId)} läuft in ${s.daysLeft} Tagen ab.`
        : `${byId(s.productId)?.name} (gemeinsam) läuft in ${s.daysLeft} Tagen ab.`
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

module.exports = {
  assignItems, computeBalances, settleUp, attributeWaste, expiringWithOwner, SPLIT_MODE
};
