/* Service Worker: macht die App offline nutzbar.
   Strategie: beim Installieren alles in den Zwischenspeicher, danach
   zuerst von dort antworten. Für eine App ohne Serverdaten ist das
   die einfachste und zuverlässigste Variante.

   Der Cache-Name trägt die Bauversion (build.js ersetzt 1vqqekx).
   Dadurch verwirft ein neuer Stand die alten Dateien zuverlässig —
   sonst bekämen Nutzer nach einem Update wochenlang die alte App. */
const CACHE = "einkaufsanker-1vqqekx";
const FILES = [
  "./", "./index.html", "./app.css",
  "./bundle.js", "./backup.js", "./offLookup.js", "./data.js", "./ocr.js", "./views.js", "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png",
  /* Die Schrift gehört in den Vorrat, nicht in den Nachschlag. Ohne
     sie hier stünde die App beim ersten Start ohne Netz in der
     Systemschrift und beim zweiten in Manrope — derselbe Bildschirm,
     zweimal anders. 25 KB sind das nicht wert.
     latin-ext bleibt draußen: der Browser holt ihn nur, wenn ein
     Zeichen daraus vorkommt, und dann ist er auch online. */
  "./fonts/manrope-latin.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Ziel des Teilen-Menüs (share_target im Manifest): REWE, Lidl & Co.
   bieten „eBon teilen" an, und Einkaufs-Anker soll dabei als Ziel
   erscheinen. Das Betriebssystem schickt dafür eine POST-Anfrage an
   die App — auf statischem Hosting kommt dort nie eine Antwort her,
   ohne dass der Worker sie abfängt.

   Datei und Text landen in einem eigenen Zwischenspeicher (nicht im
   Bauvorrat CACHE, der bei jedem Update geleert wird), die Seite holt
   sie beim nächsten Start ab und löscht sie danach wieder.

   NUR Android/Chrome ruft das je auf: iOS/Safari kennt `share_target`
   im Manifest nicht und wird eine Web-App darüber nie ins Teilen-Menü
   aufnehmen. Der Code hier schadet dort nicht — er läuft nur nie. */
const SHARE_CACHE = "einkaufsanker-geteilt";

async function handleShare(request) {
  try {
    const form = await request.formData();
    const datei = form.get("datei");
    const brocken = [form.get("titel"), form.get("text"), form.get("adresse")]
      .filter((s) => s && String(s).trim()).join("\n");
    const cache = await caches.open(SHARE_CACHE);
    await cache.put("./geteilt-text", new Response(brocken));
    if (datei && datei.size) {
      await cache.put("./geteilt-datei",
        new Response(datei, { headers: { "content-type": datei.type || "application/octet-stream" } }));
    } else {
      await cache.delete("./geteilt-datei");
    }
  } catch (err) {
    // Nichts empfangen ist kein Grund, die App unerreichbar zu machen.
  }
  return Response.redirect("./index.html?teilen=1", 303);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.searchParams.has("teilen")) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
