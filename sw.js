/**
 * Mantilla — Service Worker (PWA offline)
 * Requiere http://localhost o https:// (no file://)
 */
const CACHE_NAME = 'mantilla-v1.3.2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './viajes.html',
  './camiones.html',
  './mantenimiento.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/apple-touch-icon.png',
  './assets/logo-truck.svg',
  './css/base/boot.css',
  './css/main.css',
  './js/config/api-config.js',
  './js/core.js',
  './js/config/constants.js',
  './js/core/utils.js',
  './js/core/placas.js',
  './js/core/calculations.js',
  './js/services/sync.js',
  './js/services/render.js',
  './js/components/pickers.js',
  './js/components/modals.js',
  './js/components/welcome.js',
  './css/components/welcome.css',
  './js/components/alerts.js',
  './js/components/shell.js',
  './js/components/nav.js',
  './js/pages/camiones.js',
  './js/pages/mantenimiento.js',
  './js/pages/viajes.js',
  './js/offline.js',
  './js/app.js',
  './js/pwa.js'
];

const OFFLINE_NAV = ['./viajes.html', './camiones.html', './mantenimiento.html', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[Mantilla SW] Precache parcial:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  if (!response || response.status !== 200) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const sameOrigin = url.origin === self.location.origin;
  const isNavigate = event.request.mode === 'navigate';

  if (sameOrigin || isNavigate) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            cachePut(event.request, response);
            return response;
          })
          .catch(() => null);

        return cached || network.then((response) => {
          if (response) return response;
          if (isNavigate) {
            return caches.match('./viajes.html')
              || caches.match('./index.html')
              || Response.error();
          }
          return Response.error();
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        cachePut(event.request, response);
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
