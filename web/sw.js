/* Service Worker: macht die App offline nutzbar.
   Strategie: beim Installieren alles in den Zwischenspeicher, danach
   zuerst von dort antworten. Für eine App ohne Serverdaten ist das
   die einfachste und zuverlässigste Variante.

   Der Cache-Name trägt die Bauversion (build.js ersetzt 1no93vh).
   Dadurch verwirft ein neuer Stand die alten Dateien zuverlässig —
   sonst bekämen Nutzer nach einem Update wochenlang die alte App. */
const CACHE = "einkaufsanker-1no93vh";
const FILES = [
  "./", "./index.html", "./app.css",
  "./bundle.js", "./data.js", "./views.js", "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"
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

self.addEventListener("fetch", (e) => {
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
