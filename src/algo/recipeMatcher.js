/**
 * recipeMatcher.js — NEU
 * Persona-Anforderung: Timo, 29, Single, kocht selten, bestellt oft
 * ("Du hast Hähnchen im Kühlschrank, das morgen abläuft. Koch das,
 *   statt zu bestellen.")
 * ================================================================
 * Der wertvollste Moment für dieses Produkt ist nicht die Planung,
 * sondern der Abend, an dem sonst bestellt würde. Deshalb sortiert
 * dieses Modul NICHT nach "was schmeckt gut", sondern nach
 * "was rettet den größten Betrag, der sonst verdirbt".
 *
 * Bewusst KEINE Nährwerte, keine Kalorien, keine Bewertung von
 * Lebensmitteln — siehe Persona-Bericht (Ernährungsberaterin und
 * Ronny unabhängig voneinander): beim Geld bleiben, nicht beim Körper.
 * ================================================================
 */

const { byId } = require("./foodDatabase");

/**
 * Rezepte als Zutatenlisten. `core` sind die tragenden Zutaten,
 * `optional` verbessert das Ergebnis, ist aber nicht nötig.
 * Bewusst einfache Alltagsgerichte, keine Kochkunst.
 */
const RECIPES = [
  { id:"nudeln_tomate", name:"Nudeln mit Tomatensauce", minutes:20,
    core:["nudeln","konserve_tomaten"], optional:["zwiebeln","knoblauch","parmesan","basilikum"] },
  { id:"pasta_pesto", name:"Pasta mit Pesto", minutes:15,
    core:["nudeln","pesto"], optional:["parmesan","tomaten"] },
  { id:"haehnchen_reis", name:"Hähnchen mit Reis und Gemüse", minutes:30,
    core:["haehnchen","reis"], optional:["paprika","zwiebeln","brokkoli","sojasauce"] },
  { id:"haehnchen_pfanne", name:"Hähnchen-Gemüse-Pfanne", minutes:25,
    core:["haehnchen","paprika"], optional:["zucchini","zwiebeln","sojasauce","reis"] },
  { id:"omelett", name:"Omelett mit Käse", minutes:10,
    core:["eier"], optional:["kaese_gouda","kraeuter","champignons","tomaten"] },
  { id:"ruehrei_brot", name:"Rührei auf Brot", minutes:10,
    core:["eier","brot_vollkorn"], optional:["butter","schnittlauch","kraeuter"] },
  { id:"salat_feta", name:"Salat mit Feta", minutes:15,
    core:["salat_kopf","feta"], optional:["tomaten","gurke","oliven","oel_oliven"] },
  { id:"gemuesesuppe", name:"Gemüsesuppe", minutes:35,
    core:["moehren","kartoffeln"], optional:["lauch","sellerie","bruehe","zwiebeln"] },
  { id:"kartoffelgratin", name:"Kartoffelgratin", minutes:60,
    core:["kartoffeln","sahne"], optional:["kaese_reibe","knoblauch"] },
  { id:"bratkartoffeln", name:"Bratkartoffeln mit Ei", minutes:30,
    core:["kartoffeln","eier"], optional:["zwiebeln","bacon","kraeuter"] },
  { id:"linsensuppe", name:"Linsensuppe", minutes:40,
    core:["linsen","moehren"], optional:["kartoffeln","zwiebeln","bruehe","wiener"] },
  { id:"chili", name:"Chili sin Carne", minutes:35,
    core:["konserve_bohnen","konserve_tomaten"], optional:["konserve_mais","paprika","zwiebeln","reis"] },
  { id:"bolognese", name:"Bolognese", minutes:40,
    core:["hackfleisch","konserve_tomaten"], optional:["nudeln","zwiebeln","moehren","parmesan"] },
  { id:"auflauf_gemuese", name:"Gemüseauflauf", minutes:45,
    core:["zucchini","kaese_reibe"], optional:["kartoffeln","sahne","tomaten","paprika"] },
  { id:"risotto", name:"Risotto", minutes:35,
    core:["risottoreis","bruehe"], optional:["champignons","parmesan","zwiebeln","wein"] },
  { id:"couscous_salat", name:"Couscous-Salat", minutes:20,
    core:["couscous","gurke"], optional:["tomaten","feta","zitronen","kraeuter"] },
  { id:"kaesebrot", name:"Überbackenes Käsebrot", minutes:12,
    core:["brot_mischbrot","kaese_gouda"], optional:["tomaten","butter","kraeuter"] },
  { id:"pfannkuchen", name:"Pfannkuchen", minutes:25,
    core:["mehl","eier","milch_vollmilch"], optional:["zucker","marmelade"] },
  { id:"milchreis", name:"Milchreis", minutes:35,
    core:["reis","milch_vollmilch"], optional:["zucker","zimt","tk_beeren"] },
  { id:"porridge", name:"Porridge", minutes:10,
    core:["haferflocken","milch_vollmilch"], optional:["bananen","honig","nuesse","heidelbeeren"] },
  { id:"quark_obst", name:"Quark mit Obst", minutes:5,
    core:["quark"], optional:["bananen","heidelbeeren","honig","haferflocken"] },
  { id:"tomatensuppe", name:"Tomatensuppe", minutes:25,
    core:["konserve_tomaten","bruehe"], optional:["sahne","zwiebeln","basilikum","brot_weiss"] },
  { id:"wraps_gemuese", name:"Gemüse-Wraps", minutes:20,
    core:["wraps","paprika"], optional:["frischkaese","salat_kopf","haehnchen","mais"] },
  { id:"fisch_ofen", name:"Ofenfisch mit Gemüse", minutes:35,
    core:["fisch_weiss","zitronen"], optional:["kartoffeln","zucchini","oel_oliven","kraeuter"] },
  { id:"kaiserschmarrn", name:"Kaiserschmarrn", minutes:25,
    core:["mehl","eier","milch_vollmilch"], optional:["zucker","rosinen","puderzucker"] },
  { id:"gemuesecurry", name:"Gemüsecurry", minutes:30,
    core:["kokosmilch","reis"], optional:["paprika","zucchini","zwiebeln","gewuerze","kichererbsen"] }
];

/**
 * Findet Rezepte, die zum Bestand passen.
 *
 * SICHERHEITSSPERRE (im Stresstest gefunden):
 * Eine frühere Fassung schlug vor, mit zwei Tage abgelaufenem
 * Hackfleisch Bolognese zu kochen — und rahmte das als "rettet
 * 4,99 €". Produkte mit Verbrauchsdatum (Hackfleisch, Geflügel,
 * roher Fisch, geschnittener Salat) gehören laut BZfE nach Ablauf
 * in den Müll, weil sie Keime enthalten können, die man weder
 * sieht noch riecht noch schmeckt. Solche Zutaten werden vor der
 * Rezeptsuche ausgeschlossen und gesondert gemeldet.
 *
 * @param {Array<{productId:string, daysLeft:number, price:number}>} stock
 * @param {object} opts
 * @returns {{recipes:Array, unsafe:Array}} oder bei opts.legacyArray=true nur recipes
 */
function suggestRecipes(stock, opts = {}) {
  const maxResults = opts.maxResults || 5;
  const urgentDays = opts.urgentDays ?? 3;
  const safeStock = [];
  const unsafe = [];

  for (const s of stock || []) {
    const p = byId(s.productId);
    if (!p) continue;
    if (p.safetyCritical && s.daysLeft !== undefined && s.daysLeft < 0) {
      unsafe.push({
        productId: s.productId,
        name: p.name,
        daysOverdue: Math.abs(s.daysLeft),
        message: `${p.name}: Verbrauchsdatum seit ${Math.abs(s.daysLeft)} Tag(en) überschritten. ` +
                 `Laut BZfE nicht mehr verwenden — auch nicht durchgegart.`
      });
      continue;
    }
    safeStock.push(s);
  }

  const stockMap = new Map();
  safeStock.forEach((s) => stockMap.set(s.productId, s));

  const results = [];

  for (const recipe of RECIPES) {
    const haveCore = recipe.core.filter((id) => stockMap.has(id));
    const missingCore = recipe.core.filter((id) => !stockMap.has(id));

    // Nur Rezepte, bei denen höchstens eine Kernzutat fehlt
    if (missingCore.length > 1) continue;

    const haveOptional = recipe.optional.filter((id) => stockMap.has(id));

    const used = [...haveCore, ...haveOptional];
    const urgent = used.filter((id) => {
      const s = stockMap.get(id);
      return s && s.daysLeft !== undefined && s.daysLeft <= urgentDays;
    });

    const rescuedValue = urgent.reduce((sum, id) => {
      const s = stockMap.get(id);
      const value = s.price !== undefined ? s.price : (byId(id)?.typicalPrice || 0);
      return sum + Math.max(0, value);
    }, 0);

    const minDaysLeft = used.reduce((min, id) => {
      const s = stockMap.get(id);
      return s && s.daysLeft !== undefined ? Math.min(min, s.daysLeft) : min;
    }, 99);

    results.push({
      recipeId: recipe.id,
      name: recipe.name,
      minutes: recipe.minutes,
      usesFromStock: used.map((id) => byId(id)?.name || id),
      urgentItems: urgent.map((id) => byId(id)?.name || id),
      missing: missingCore.map((id) => byId(id)?.name || id),
      complete: missingCore.length === 0,
      rescuedValue: Math.round(rescuedValue * 100) / 100,
      minDaysLeft,
      score: rescuedValue * 10 + haveOptional.length + (missingCore.length === 0 ? 5 : 0)
    });
  }

  const recipes = results.sort((a, b) => b.score - a.score).slice(0, maxResults);

  // Rückwärtskompatibel: ohne Zutaten-Warnung wird wie bisher ein
  // Array zurückgegeben, damit bestehender Code weiterläuft.
  if (unsafe.length === 0) return recipes;

  recipes.unsafeIngredients = unsafe;
  return recipes;
}

/**
 * Der Moment, auf den es ankommt: Vergleich mit Bestellen.
 * Zahlen bewusst als Annahme gekennzeichnet, nicht als Messung.
 */
function compareWithDelivery(recipe, assumedDeliveryCost = 24) {
  return {
    recipe: recipe.name,
    minutes: recipe.minutes,
    rescuedValue: recipe.rescuedValue,
    assumedDeliveryCost,
    note: `Kochen nutzt ${recipe.rescuedValue.toFixed(2).replace(".", ",")} € Ware, die sonst verdirbt. ` +
          `Der Lieferwert von ${assumedDeliveryCost} € ist eine Annahme, kein gemessener Wert.`
  };
}

module.exports = { suggestRecipes, compareWithDelivery, RECIPES };
