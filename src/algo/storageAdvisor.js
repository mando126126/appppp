/**
 * storageAdvisor.js — NEU
 * ================================================================
 * Nutzt die Lagerdaten der Datenbank für zwei Hinweise, die keine
 * der untersuchten Konkurrenz-Apps gibt und die messbar Verluste
 * senken -- ohne dass der Nutzer irgendetwas eingeben muss:
 *
 * 1. ETHYLEN-TRENNUNG.
 *    Nachreifende Früchte (Bananen, Äpfel, Tomaten, Avocado) geben
 *    Ethylen ab und lassen nicht-nachreifende Ware (Trauben,
 *    Erdbeeren, Gurken, Zitrusfrüchte, Paprika) schneller verderben.
 *    Quelle: BZfE/BLE, "Lebensmittel richtig lagern", Stand 2025.
 *    Sind auf demselben Einkauf beide Gruppen, ist der Hinweis
 *    konkret und sofort umsetzbar.
 *
 * 2. FALSCHER LAGERORT.
 *    Häufigste Fehler laut BZfE: Brot in den Kühlschrank (trocknet
 *    aus), Tomaten und Kartoffeln in den Kühlschrank (gehören bei
 *    Zimmertemperatur), Basilikum in den Kühlschrank (einzige
 *    Kräuter-Ausnahme).
 *
 * Warum das wichtig ist: Der Nutzer bekommt einen Nutzen, BEVOR
 * die App irgendeinen Rhythmus gelernt hat. Das ist ein Baustein
 * gegen das Cold-Start-Problem aus dem Persona-Bericht.
 * ================================================================
 */

const { byId, ETHYLENE, STORAGE } = require("./foodDatabase");

/**
 * Prüft einen Einkauf auf Ethylen-Konflikte.
 * @param {Array<{productId:string}>} items
 */
function checkEthyleneConflicts(items) {
  const producers = [];
  const sensitives = [];

  for (const it of items) {
    const p = byId(it.productId);
    if (!p) continue;
    if (p.ethylene === ETHYLENE.PRODUCER) producers.push(p.name);
    if (p.ethylene === ETHYLENE.SENSITIVE) sensitives.push(p.name);
  }

  if (!producers.length || !sensitives.length) return null;

  return {
    type: "ethylen",
    severity: "info",
    producers: [...new Set(producers)],
    sensitives: [...new Set(sensitives)],
    message:
      `${[...new Set(producers)].join(", ")} getrennt von ` +
      `${[...new Set(sensitives)].join(", ")} lagern — sonst verdirbt die zweite Gruppe schneller.`,
    source: "BZfE/BLE, Lebensmittel richtig lagern, Stand 2025"
  };
}

/**
 * Liefert für jedes Produkt des Einkaufs den korrekten Lagerort,
 * sortiert nach Kühlzone -- als Einräumhilfe direkt nach dem Einkauf.
 */
function buildStorageGuide(items) {
  const zones = new Map();
  for (const it of items) {
    const p = byId(it.productId);
    if (!p) continue;
    if (!zones.has(p.storage)) zones.set(p.storage, []);
    zones.get(p.storage).push({ name: p.name, note: p.note || null });
  }

  // Reihenfolge wie beim Einräumen: zuerst das Kritische
  const order = [
    STORAGE.FRIDGE_BOTTOM, STORAGE.FRIDGE_MIDDLE, STORAGE.FRIDGE_VEG,
    STORAGE.FRIDGE_DOOR, STORAGE.FREEZER, STORAGE.ROOM, STORAGE.PANTRY
  ];

  return order
    .filter((z) => zones.has(z))
    .map((z) => ({ zone: z, items: zones.get(z) }));
}

/**
 * Warnt, wenn ein leicht verderbliches Produkt gekauft wurde, das
 * schnell weggeräumt werden muss. BZfE: liegen Fleisch/Fisch länger
 * in der Wärme, vermehren sich Keime auf der Oberfläche.
 */
function urgentStorageItems(items) {
  return items
    .map((it) => byId(it.productId))
    .filter((p) => p && p.storage === STORAGE.FRIDGE_BOTTOM)
    .map((p) => p.name);
}

module.exports = { checkEthyleneConflicts, buildStorageGuide, urgentStorageItems };
