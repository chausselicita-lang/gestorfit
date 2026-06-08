const CACHE_NAME = 'gestorfit-v11';

const STATIC_ASSETS = [
  '/gestorfit/css/main.css',
  '/gestorfit/css/dashboard.css',
  '/gestorfit/css/components.css',
  '/gestorfit/js/config.js',
  '/gestorfit/js/supabase.js',
  '/gestorfit/js/utils.js',
  '/gestorfit/js/auth.js',
  '/gestorfit/js/relatorios.js',
  '/gestorfit/js/dashboard.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
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
  const url = e.request.url;

  // CDN e Supabase: sempre da rede
  if (url.includes('supabase.co') || url.includes('unpkg.com') ||
      url.includes('jsdelivr.net') || url.includes('cdnjs.') ||
      url.includes('fonts.google') || url.includes('fonts.gstatic')) return;

  // HTML: network-first — sempre pega versão mais recente, cache como fallback
  if (e.request.headers.get('accept')?.includes('text/html') || url.endsWith('.html') || url.endsWith('/gestorfit/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS/JS/assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
