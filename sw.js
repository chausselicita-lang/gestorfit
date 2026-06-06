const CACHE_NAME = 'gestorfit-v1';
const STATIC_ASSETS = [
  '/gestorfit/',
  '/gestorfit/index.html',
  '/gestorfit/css/main.css',
  '/gestorfit/css/dashboard.css',
  '/gestorfit/css/components.css',
  '/gestorfit/js/config.js',
  '/gestorfit/js/utils.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
