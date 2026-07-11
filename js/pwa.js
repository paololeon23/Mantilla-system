/**
 * PWA: manifest, service worker e instalación (http/https únicamente).
 * En file:// la app sigue funcionando; instalar requiere servidor web.
 */
(function () {
  const isSecureContext = location.protocol === 'https:'
    || location.protocol === 'http:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';

  if (!isSecureContext) return;

  function ensureManifest() {
    if (document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.json';
    document.head.appendChild(link);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => {
          // Forzar toma de control de la versión nueva del SW
          if (reg.waiting) reg.waiting.postMessage?.({ type: 'SKIP_WAITING' });
          reg.update?.();
        })
        .catch((err) => console.warn('[Mantilla] Service worker:', err));

      // Si hay un SW nuevo tomando control, recargar una vez para scripts frescos
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    });
  }

  let deferredInstall = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function ensureInstallButton() {
    const footer = document.querySelector('.sidebar__footer');
    if (!footer || document.getElementById('pwaInstallBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwaInstallBtn';
    btn.className = 'sidebar__install-btn';
    btn.setAttribute('data-tooltip', 'Instalar app');
    btn.hidden = true;
    btn.innerHTML = '<i data-lucide="download" class="lucide-icon lucide-icon--sm" aria-hidden="true"></i><span>Instalar app</span>';
    btn.addEventListener('click', onInstallClick);

    const version = footer.querySelector('.sidebar__version');
    if (version) footer.insertBefore(btn, version);
    else footer.appendChild(btn);

    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  async function onInstallClick() {
    if (deferredInstall) {
      deferredInstall.prompt();
      try {
        await deferredInstall.userChoice;
      } catch (_) { /* ignore */ }
      deferredInstall = null;
      hideInstallButton();
      return;
    }

    if (isIos() && !isStandalone()) {
      window.alert('En iPhone/iPad: toca Compartir y luego «Añadir a pantalla de inicio».');
      return;
    }

    window.alert('Para instalar: en Chrome o Edge usa el menú del navegador → «Instalar Mantilla» o el ícono de instalación en la barra de direcciones.');
  }

  function showInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn && !isStandalone()) btn.hidden = false;
  }

  function hideInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.hidden = true;
  }

  function wireInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
      showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      hideInstallButton();
    });

    if (isIos() && !isStandalone()) {
      document.addEventListener('DOMContentLoaded', showInstallButton);
    }
  }

  ensureManifest();
  registerServiceWorker();

  document.addEventListener('DOMContentLoaded', () => {
    ensureInstallButton();
    wireInstallPrompt();
    if (isStandalone()) hideInstallButton();
  });

  window.Mantilla = window.Mantilla || {};
  Mantilla.promptInstall = onInstallClick;
})();
