/**
 * Erzeugt synthetische, aber realistisch verrauschte Haushalts-
 * historien für den Rückvergleich des Listen-Algorithmus.
 *
 * Absichtlich NICHT die Demo-Historie aus data.js: die ist auf
 * Vorführung getrimmt (alles bequem heute fällig, Streuung ±1 Tag)
 * und würde jeden Algorithmus gut aussehen lassen. Echte Haushalte
 * kaufen unregelmäßig, überspringen Wochen, kaufen auf Vorrat und
 * ändern ihre Gewohnheiten.
 */
const { FOOD_DATABASE } = require("../../src/algo/foodDatabase");
const { isNonFood } = require("../../src/algo/nonFoodCatalog");

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAG = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Ein Haushalt: 12-22 Lebensmittel mit je eigenem wahren Intervall,
 * Einkäufe an zwei bis drei festen Wochentagen, und vier Sorten
 * Rauschen, die es real gibt:
 *   - Streuung um das wahre Intervall (±25 %)
 *   - übersprungene Fälligkeiten (vergessen oder noch da)
 *   - gelegentlicher Vorratskauf (doppelte Menge, danach längere Pause)
 *   - eine Verhaltensänderung nach etwa zwei Dritteln der Zeit
 */
function haushalt(seed, tage = 400) {
  const rand = rng(seed);
  const lebensmittel = FOOD_DATABASE.filter((p) => p.isFood && !isNonFood(p.id) && p.shelfLifeDays < 400);
  const anzahl = 12 + Math.floor(rand() * 11);
  const gewaehlt = [];
  const genutzt = new Set();
  while (gewaehlt.length < anzahl) {
    const p = lebensmittel[Math.floor(rand() * lebensmittel.length)];
    if (genutzt.has(p.id)) continue;
    genutzt.add(p.id);
    // Wahres Intervall: kurz für Frisches, länger für Haltbares
    const basis = p.shelfLifeDays < 8 ? 4 + rand() * 6
      : p.shelfLifeDays < 30 ? 7 + rand() * 10
        : 14 + rand() * 25;
    gewaehlt.push({ p, intervall: Math.round(basis), wechsel: rand() < 0.3 ? 1.4 + rand() * 0.5 : 1 });
  }

  /* Einkaufstage: EIN bis drei feste Wochentage. Die Spanne ist
     wichtig -- ein Haushalt, der einmal die Woche gross einkauft,
     braucht einen ganz anderen Vorlauf als einer, der dreimal
     woechentlich frisch kauft. Ein fester Vorlauf kann nur einem von
     beiden passen. */
  const wochentage = [];
  const kandidaten = [1, 2, 3, 4, 5, 6];
  const wieViele = 1 + Math.floor(rand() * 3);
  while (wochentage.length < wieViele) {
    const w = kandidaten[Math.floor(rand() * kandidaten.length)];
    if (!wochentage.includes(w)) wochentage.push(w);
  }

  const ende = Date.parse("2026-08-01");
  const start = ende - tage * TAG;
  const H = [];
  gewaehlt.forEach(({ p, intervall, wechsel }) => {
    let t = start + Math.floor(rand() * intervall) * TAG;
    let vorrat = 0;
    while (t < ende) {
      const fortschritt = (t - start) / (ende - start);
      const iv = Math.max(2, Math.round(intervall * (fortschritt > 0.66 ? wechsel : 1)));
      // Streuung um das wahre Intervall
      const streu = Math.round(iv * (rand() * 0.5 - 0.25));
      t += (iv + streu) * TAG;
      if (t >= ende) break;
      if (vorrat > 0) { vorrat--; continue; }          // Vorrat reicht noch
      if (rand() < 0.12) continue;                      // Fälligkeit übersprungen
      // Auf den nächsten Einkaufstag schieben
      let d = new Date(t);
      let versuche = 0;
      while (!wochentage.includes(d.getUTCDay()) && versuche < 7) { d = new Date(+d + TAG); versuche++; }
      if (+d >= ende) break;
      const menge = rand() < 0.15 ? 2 : 1;              // Vorratskauf
      if (menge === 2) vorrat = 1;
      H.push({ productId: p.id, date: iso(+d), quantity: menge,
        unitPrice: p.typicalPrice, weightG: null, brand: null, brandLabel: null });
      t = +d;
    }
  });
  H.sort((a, b) => a.date.localeCompare(b.date));
  return H;
}

module.exports = { haushalt };
