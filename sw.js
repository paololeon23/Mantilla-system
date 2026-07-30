/**
 * Mantilla — Service Worker (PWA offline)
 * Requiere http://localhost o https:// (no file://)
 *
 * HTML/JS/CSS: network-first (evita quedar atrapado en versiones viejas).
 * Resto: cache-first con actualización en segundo plano.
 */
const CACHE_NAME = 'mantilla-v1.3.85';

const PRECACHE_URLS = [
  './',
  './index.html',
  './viajes.html',
  './camiones.html',
  './mantenimiento.html',
  './ingresos-extras.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/apple-touch-icon.png',
  './assets/logo-truck.svg',
  './assets/vendor/lucide.min.js',
  './assets/vendor/sweetalert2.all.min.js',
  './assets/vendor/sweetalert2.min.css',
  './assets/vendor/jspdf.umd.min.js',
  './css/base/boot.css',
  './css/main.css',
  './js/config/api-config.js',
  './js/core.js',
  './js/config/constants.js',
  './js/core/utils.js',
  './js/core/placas.js',
  './js/core/calculations.js',
  './js/services/sync.js',
  './js/services/drafts.js',
  './js/services/activity.js',
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
  './js/pages/ingresos-extras.js',
  './js/pages/viajes.js',
  './js/offline.js',
  './js/app.js',
  './js/pwa.js'
];

const OFFLINE_NAV = ['./viajes.html', './camiones.html', './mantenimiento.html', './ingresos-extras.html', './index.html'];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

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

function isFreshAsset(url) {
  const path = url.pathname;
  return (
    path.endsWith('.html')
    || path.endsWith('.js')
    || path.endsWith('.css')
    || path.endsWith('/')
    || path.endsWith('/sw.js')
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const sameOrigin = url.origin === self.location.origin;
  const isNavigate = event.request.mode === 'navigate';
  const isSpaPage = sameOrigin && event.request.headers.get('X-Mantilla-SPA') === '1';

  // Navegación interna: responder desde caché al instante y actualizar en segundo plano.
  if (isSpaPage) {
    const network = fetch(event.request)
      .then((response) => {
        cachePut(event.request, response);
        return response;
      });
    event.waitUntil(network.catch(() => null));
    event.respondWith(
      caches.match(event.request).then((cached) => cached || network)
    );
    return;
  }

  if (!sameOrigin && !isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          cachePut(event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML / JS / CSS / navegación: red primero para no servir código viejo
  if (isNavigate || isFreshAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          cachePut(event.request, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (isNavigate) {
            return (
              (await caches.match('./viajes.html'))
              || (await caches.match('./index.html'))
              || Response.error()
            );
          }
          return Response.error();
        })
    );
    return;
  }

  // Imágenes y demás: cache primero
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          cachePut(event.request, response);
          return response;
        })
        .catch(() => null);

      return cached || network.then((response) => response || Response.error());
    })
  );
});
