/**
 * Mantilla — Service Worker (PWA offline)
 * Requiere http://localhost o https:// (no file://)
 *
 * HTML/JS/CSS: network-first (evita quedar atrapado en versiones viejas).
 * Resto: cache-first con actualización en segundo plano.
 */
const CACHE_NAME = 'mantilla-v1.3.127';

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
  './css/base/boot.css?v=3',
  './css/main.css?v=279',
  './css/base/view-transitions.css',
  './css/base/variables.css?v=2',
  './css/layout/shell.css?v=8',
  './css/components/topbar.css',
  './css/components/buttons.css',
  './css/components/kpi.css',
  './css/components/filters.css',
  './css/components/panels-tables.css',
  './css/pages/mantenimiento.css',
  './css/pages/viajes.css',
  './css/pages/camiones.css',
  './css/components/alerts.css',
  './css/components/bottom-nav.css?v=11',
  './css/components/modals-forms.css',
  './css/components/welcome.css',
  './css/components/misc.css?v=2',
  './css/responsive/tablet.css',
  './css/responsive/desktop.css',
  './js/config/api-config.js?v=3',
  './js/icon-boot.js?v=1',
  './js/core.js?v=4',
  './js/config/constants.js?v=12',
  './js/core/utils.js?v=13',
  './js/core/placas.js?v=5',
  './js/core/calculations.js?v=25',
  './js/services/sync.js?v=23',
  './js/services/drafts.js?v=4',
  './js/services/activity.js?v=2',
  './js/services/render.js?v=21',
  './js/components/pickers.js?v=17',
  './js/components/modals.js?v=23',
  './js/components/welcome.js?v=3',
  './js/components/alerts.js?v=10',
  './js/components/shell.js?v=10',
  './js/components/nav.js?v=25',
  './js/pages/camiones.js?v=25',
  './js/pages/mantenimiento.js?v=26',
  './js/pages/ingresos-extras.js?v=3',
  './js/pages/viajes.js?v=93',
  './js/offline.js?v=3',
  './js/app.js?v=37',
  './js/pwa.js?v=13'
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

async function cachePut(request, response) {
  if (!response || response.status !== 200) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
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
      .then(async (response) => {
        await cachePut(event.request, response);
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
        .then(async (response) => {
          await cachePut(event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App instalada: abrir desde caché al instante y actualizar en segundo plano.
  if (isNavigate || isFreshAsset(url)) {
    const network = fetch(event.request)
      .then(async (response) => {
        await cachePut(event.request, response);
        return response;
      });
    event.waitUntil(network.catch(() => null));
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        try {
          return await network;
        } catch (_) {
          if (isNavigate) {
            return (
              (await caches.match('./viajes.html'))
              || (await caches.match('./index.html'))
              || Response.error()
            );
          }
          return Response.error();
        }
      })
    );
    return;
  }

  // Imágenes y demás: cache primero
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then(async (response) => {
          await cachePut(event.request, response);
          return response;
        })
        .catch(() => null);

      return cached || network.then((response) => response || Response.error());
    })
  );
});
