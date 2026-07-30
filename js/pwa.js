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
      navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
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
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="download" class="lucide-icon lucide-icon--sm" aria-hidden="true"></i><span>Instalar app</span>';
    btn.addEventListener('click', onInstallClick);

    const version = footer.querySelector('.sidebar__version');
    if (version) footer.insertBefore(btn, version);
    else footer.appendChild(btn);

    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  function ensureUpdateButton() {
    const footer = document.querySelector('.sidebar__footer');
    if (!footer || document.getElementById('pwaUpdateBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwaUpdateBtn';
    btn.className = 'sidebar__install-btn sidebar__update-btn';
    btn.setAttribute('data-tooltip', 'Actualizar app');
    btn.hidden = true;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="lucide-icon lucide-icon--sm" aria-hidden="true"></i><span>Actualizar app</span>';
    btn.addEventListener('click', onUpdateClick);

    const version = footer.querySelector('.sidebar__version');
    if (version) footer.insertBefore(btn, version);
    else footer.appendChild(btn);

    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  function setUpdateButtonState(text, disabled = false) {
    const btn = document.getElementById('pwaUpdateBtn');
    if (!btn) return;
    const label = btn.querySelector('span');
    if (label) label.textContent = text;
    btn.disabled = disabled;
  }

  function resetUpdateButtonSoon() {
    setTimeout(() => setUpdateButtonState('Actualizar app', false), 1800);
  }

  async function onUpdateClick() {
    if (!('serviceWorker' in navigator)) return;
    setUpdateButtonState('Buscando actualización…', true);

    try {
      const reg = await navigator.serviceWorker.getRegistration('./')
        || await navigator.serviceWorker.ready;
      let foundUpdate = false;
      reg.addEventListener('updatefound', () => {
        foundUpdate = true;
        setUpdateButtonState('Actualizando…', true);
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (worker.state === 'redundant') {
            setUpdateButtonState('No se pudo actualizar', true);
            resetUpdateButtonSoon();
          }
        });
      }, { once: true });

      await reg.update();

      if (reg.waiting) {
        setUpdateButtonState('Actualizando…', true);
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      if (reg.installing || foundUpdate) {
        setUpdateButtonState('Actualizando…', true);
        return;
      }

      setUpdateButtonState('La app está actualizada', true);
      resetUpdateButtonSoon();
    } catch (_) {
      setUpdateButtonState(navigator.onLine ? 'No se pudo actualizar' : 'Sin conexión', true);
      resetUpdateButtonSoon();
    }
  }

  async function onInstallClick() {
    if (deferredInstall) {
      deferredInstall.prompt();
      let accepted = false;
      try {
        const choice = await deferredInstall.userChoice;
        accepted = choice?.outcome === 'accepted';
      } catch (_) { /* ignore */ }
      deferredInstall = null;
      if (accepted) hideInstallButton();
      else showInstallButton();
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
    if (!btn || isStandalone()) return;
    const label = btn.querySelector('span');
    btn.hidden = false;
    btn.disabled = false;
    if (label) label.textContent = 'Instalar app';
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
  wireInstallPrompt();

  document.addEventListener('DOMContentLoaded', () => {
    ensureInstallButton();
    ensureUpdateButton();
    if (isStandalone()) hideInstallButton();
    else showInstallButton();

    const updateBtn = document.getElementById('pwaUpdateBtn');
    if (updateBtn) updateBtn.hidden = !isStandalone();
  });

  window.Mantilla = window.Mantilla || {};
  Mantilla.promptInstall = onInstallClick;
  Mantilla.updateApp = onUpdateClick;
})();
