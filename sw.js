// Service Worker: App-Shell offline verfügbar halten.
// Strategie "network first, cache fallback" – Updates kommen an, und ohne Netz
// startet die App trotzdem aus dem Cache.

const CACHE = 'wir-zwei-v1';
const SHELL = [
  '.',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/ui.js',
  'js/store.js',
  'js/sync.js',
  'js/model.js',
  'js/session.js',
  'js/views/home.js',
  'js/views/calendar.js',
  'js/views/lists.js',
  'js/views/money.js',
  'js/views/us.js',
  'js/views/settings.js',
  'js/vendor/supabase.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase-Aufrufe niemals cachen – die brauchen frische Daten.
  if (url.hostname.endsWith('.supabase.co')) return;

  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html'))),
  );
});
