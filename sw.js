const CACHE_NAME = 'gestorfit-v3';
const STATIC_ASSETS = [
  '/gestorfit/',
  '/gestorfit/index.html',
  '/gestorfit/login.html',
  '/gestorfit/css/main.css',
  '/gestorfit/css/dashboard.css',
  '/gestorfit/css/components.css',
  '/gestorfit/js/config.js',
  '/gestorfit/js/utils.js',
  '/gestorfit/js/auth.js',
  '/gestorfit/js/relatorios.js',
  '/gestorfit/pages/alunos.html',
  '/gestorfit/pages/pagamentos.html',
  '/gestorfit/pages/frequencia.html',
  '/gestorfit/pages/relatorios.html',
  '/gestorfit/pages/configuracoes.html',
  '/gestorfit/pages/verificar.html',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
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
  if (e.request.url.includes('unpkg.com') || e.request.url.includes('jsdelivr.net') || e.request.url.includes('cdnjs.cloudflare.com')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
