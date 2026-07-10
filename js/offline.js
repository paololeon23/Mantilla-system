/**
 * Mantilla — persistencia local y modo sin internet.
 * Los datos viven en localStorage; al cerrar o apagar el celular se conservan.
 */
(function () {
  const LAST_SAVE_KEY = 'mantilla_last_save';

  function flushPersistencia() {
    try {
      if (typeof saveData === 'function') saveData();
    } catch (err) {
      console.warn('[Mantilla] flushPersistencia:', err);
    }
  }

  function getPendingSyncCount() {
    try {
      return window.Mantilla?.sync?.pendientes?.() || 0;
    } catch (_) {
      return 0;
    }
  }

  function ensureOfflineBadge() {
    if (document.getElementById('mantillaOfflineBadge')) return;
    const host = document.querySelector('.topbar__actions')
      || document.querySelector('.topbar__inner')
      || document.querySelector('.topbar');
    if (!host) return;

    const badge = document.createElement('div');
    badge.id = 'mantillaOfflineBadge';
    badge.className = 'offline-badge';
    badge.hidden = true;
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.title = 'Sin internet — los datos se guardan en este dispositivo';
    badge.innerHTML = `
      <i data-lucide="wifi-off" class="lucide-icon lucide-icon--sm offline-badge__icon" aria-hidden="true"></i>
      <span class="offline-badge__text offline-badge__text--short">Sin internet</span>
      <span class="offline-badge__text offline-badge__text--long"> — datos en el celular</span>
      <span class="offline-badge__pending" id="mantillaOfflinePending" hidden></span>`;

    const actionsEnd = host.querySelector('.topbar__actions-end');
    if (actionsEnd) host.insertBefore(badge, actionsEnd);
    else host.prepend(badge);
  }

  function isBrowserOffline() {
    return typeof navigator.onLine === 'boolean' ? !navigator.onLine : false;
  }

  function updateOfflineBadge() {
    ensureOfflineBadge();
    const badge = document.getElementById('mantillaOfflineBadge');
    const pendingEl = document.getElementById('mantillaOfflinePending');
    if (!badge) return;

    const offline = isBrowserOffline();
    badge.hidden = !offline;
    badge.classList.toggle('offline-badge--pending', offline && getPendingSyncCount() > 0);

    if (pendingEl) {
      const n = getPendingSyncCount();
      if (offline && n > 0) {
        pendingEl.hidden = false;
        pendingEl.textContent = `${n} pend.`;
      } else {
        pendingEl.hidden = true;
        pendingEl.textContent = '';
      }
    }

    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  function wirePersistenceGuard() {
    if (wirePersistenceGuard._wired) return;
    wirePersistenceGuard._wired = true;

    const flush = () => flushPersistencia();

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  function wireOfflineStatus() {
    if (wireOfflineStatus._wired) return;
    wireOfflineStatus._wired = true;

    const refresh = () => updateOfflineBadge();

    window.addEventListener('online', () => {
      refresh();
      if (window.Mantilla?.sync?.sincronizarPendientes) {
        Mantilla.sync.sincronizarPendientes().then(() => {
          refresh();
          return Mantilla.sync.pullFromServer?.();
        }).then(() => {
          if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
          refresh();
        }).catch(() => refresh());
      }
    });

    window.addEventListener('offline', refresh);
    document.addEventListener('DOMContentLoaded', refresh);
    document.addEventListener('mantilla:datos-servidor', refresh);
    setInterval(refresh, 30000);
  }

  window.Mantilla = window.Mantilla || {};
  Mantilla.flushPersistencia = flushPersistencia;
  Mantilla.updateOfflineBadge = updateOfflineBadge;
  Mantilla.getLastSaveTime = () => {
    try {
      const t = localStorage.getItem(LAST_SAVE_KEY);
      return t ? Number(t) : null;
    } catch (_) {
      return null;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    wirePersistenceGuard();
    wireOfflineStatus();
  });
})();
