/**
 * Navegación rápida entre secciones sin recargar toda la página.
 * Intercambia contenido y modales; mantiene fijos sidebar y barra inferior.
 */
(function () {
  const PAGE_FILES = {
    'viajes.html': 'viajes',
    'camiones.html': 'camiones',
    'mantenimiento.html': 'mantenimiento',
    'ingresos-extras.html': 'ingresos-extras'
  };

  const cache = new Map();
  const viewCache = new Map();
  const staleViews = new Set();
  let navigating = false;
  let navigationScheduled = false;
  let pressedLink = null;
  let queuedNavigationHref = null;

  /** Cede el hilo para que el navegador pinte el feedback y la vista nueva. */
  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function setPressedLink(link) {
    if (pressedLink && pressedLink !== link) {
      pressedLink.classList.remove('bottom-nav__tab--pressed');
    }
    pressedLink = link?.classList.contains('bottom-nav__tab') ? link : null;
    pressedLink?.classList.add('bottom-nav__tab--pressed');
  }

  function clearPressedLink() {
    pressedLink?.classList.remove('bottom-nav__tab--pressed');
    pressedLink = null;
  }

  function scrollCurrentViewToTop() {
    const main = document.getElementById('mainWrapper');
    if (window.innerWidth < 900 && main) main.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }

  function spaNavAvailable() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function pageFromHref(href) {
    const file = new URL(href, location.href).pathname.split('/').pop() || '';
    return PAGE_FILES[file] || null;
  }

  function isAppPage(href) {
    if (!spaNavAvailable()) return false;
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return false;
      const file = u.pathname.split('/').pop() || '';
      return Object.prototype.hasOwnProperty.call(PAGE_FILES, file);
    } catch (_) {
      return false;
    }
  }

  function syncNavActive(page) {
    document.querySelectorAll('.sidebar__nav .nav-btn[href]').forEach((link) => {
      const linkPage = pageFromHref(link.href);
      const active = linkPage === page;
      link.classList.toggle('nav-btn--active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.querySelectorAll('.bottom-nav__tab[href]').forEach((link) => {
      const linkPage = pageFromHref(link.href);
      const active = linkPage === page;
      link.classList.toggle('bottom-nav__tab--active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  async function fetchPageDoc(url) {
    const key = new URL(url, location.href).href;
    if (cache.has(key)) return cache.get(key);

    try {
      const res = await fetch(key, {
        credentials: 'same-origin',
        headers: { 'X-Mantilla-SPA': '1' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      cache.set(key, doc);
      return doc;
    } catch (err) {
      cache.delete(key);
      throw err;
    }
  }

  /** Nodos específicos de página que van después de bottom-nav. */
  function collectPageNodes(root) {
    const bottom = root.getElementById('bottomNav');
    const nodes = [];
    let el = bottom ? bottom.nextElementSibling : null;
    while (el) {
      if (el.tagName === 'SCRIPT') break;
      if (el.id !== 'dpBackdrop' && el.id !== 'msBackdrop') nodes.push(el);
      el = el.nextElementSibling;
    }
    return nodes;
  }

  function pageNodesAnchor(bottomNav) {
    let anchor = bottomNav?.nextElementSibling || null;
    while (anchor && anchor.tagName !== 'SCRIPT') {
      anchor = anchor.nextElementSibling;
    }
    return anchor;
  }

  function rememberCurrentView() {
    const page = document.body.dataset.page || pageFromHref(location.href);
    const main = document.getElementById('mainWrapper');
    if (!page || !main) return;
    viewCache.set(page, {
      main,
      fab: document.getElementById('fabAdd'),
      nodes: collectPageNodes(document),
      title: document.title
    });
  }

  function restoreView(page) {
    const view = viewCache.get(page);
    const oldMain = document.getElementById('mainWrapper');
    const bottomNav = document.getElementById('bottomNav');
    if (!view?.main || !oldMain || !bottomNav) return false;

    oldMain.replaceWith(view.main);

    const parent = bottomNav.parentNode || document.body;
    const oldFab = document.getElementById('fabAdd');
    if (view.fab) {
      if (oldFab) oldFab.replaceWith(view.fab);
      else parent.insertBefore(view.fab, bottomNav);
    } else {
      oldFab?.remove();
    }

    collectPageNodes(document).forEach((node) => node.remove());
    const anchor = pageNodesAnchor(bottomNav);
    view.nodes.forEach((node) => parent.insertBefore(node, anchor));

    document.body.dataset.page = page;
    document.title = view.title;
    syncNavActive(page);
    return true;
  }

  function replaceShell(doc) {
    const newMain = doc.getElementById('mainWrapper');
    const oldMain = document.getElementById('mainWrapper');
    if (!newMain || !oldMain) throw new Error('Shell no encontrado');

    oldMain.replaceWith(newMain.cloneNode(true));

    const bottomNav = document.getElementById('bottomNav');
    const parent = bottomNav?.parentNode || document.body;

    // Sincronizar FAB móvil (está entre main y bottom-nav; si no se reemplaza queda huérfano)
    const oldFab = document.getElementById('fabAdd');
    const newFab = doc.getElementById('fabAdd');
    if (newFab) {
      const fabClone = newFab.cloneNode(true);
      if (oldFab) oldFab.replaceWith(fabClone);
      else if (bottomNav) parent.insertBefore(fabClone, bottomNav);
      else parent.appendChild(fabClone);
    } else if (oldFab) {
      oldFab.remove();
    }

    // Quitar nodos de la página anterior (ya quedaron guardados en memoria).
    collectPageNodes(document).forEach((node) => node.remove());

    // Insertar antes del primer <script> (o al final del body)
    const anchor = pageNodesAnchor(bottomNav);

    collectPageNodes(doc).forEach((n) => {
      parent.insertBefore(n.cloneNode(true), anchor);
    });

    const page = doc.body?.dataset?.page || pageFromHref(location.href) || 'viajes';
    document.body.dataset.page = page;
    if (doc.title) document.title = doc.title;
    syncNavActive(page);
    return page;
  }

  async function navigate(href, push = true) {
    const target = new URL(href, location.href).href;
    const targetPage = pageFromHref(target);
    if (navigating || !isAppPage(target)) return false;
    if (targetPage === document.body.dataset.page) return true;

    navigating = true;

    try {
      if (typeof closeOverlayPickers === 'function') closeOverlayPickers();
      if (typeof closeTopbarProfileMenu === 'function') closeTopbarProfileMenu();
      if (window.innerWidth < 900 && typeof closeSidebar === 'function') closeSidebar();

      rememberCurrentView();
      if (targetPage && restoreView(targetPage)) {
        if (push) history.pushState({ mantilla: targetPage }, '', target);
        if (staleViews.delete(targetPage) && typeof Mantilla?.refreshCurrentPage === 'function') {
          Mantilla.refreshCurrentPage();
          if (typeof renderLucideIconsNow === 'function') renderLucideIconsNow();
        }
        if (typeof Mantilla?.updateOfflineBadge === 'function') Mantilla.updateOfflineBadge();
        scrollCurrentViewToTop();
        return true;
      }

      // Empezar la carga ya, pero permitir que primero se pinte la pestaña tocada.
      const pageDocPromise = fetchPageDoc(target);
      await nextPaint();
      const doc = await pageDocPromise;
      replaceShell(doc);
      if (push) {
        const page = doc.body?.dataset?.page || pageFromHref(target);
        history.pushState({ mantilla: page }, '', target);
      }

      // Completar el render antes del siguiente paint para evitar parpadeos
      // o una vista intermedia que parezca una recarga.
      if (typeof Mantilla?.initPageForCurrentRoute === 'function') {
        try {
          Mantilla.initPageForCurrentRoute({ reloadData: false });
        } catch (initErr) {
          console.error('[Mantilla] Inicialización de pestaña:', initErr);
          try { Mantilla.refreshCurrentPage?.(); } catch (_) { /* mantener la pestaña visible */ }
        }
      }
      if (document.querySelector('i[data-lucide]') && typeof renderLucideIconsNow === 'function') {
        renderLucideIconsNow();
      }
      if (typeof Mantilla?.updateOfflineBadge === 'function') {
        Mantilla.updateOfflineBadge();
      }
      scrollCurrentViewToTop();
      return true;
    } catch (err) {
      console.warn('[Mantilla] Navegación rápida no disponible:', err);
      return false;
    } finally {
      navigating = false;
    }
  }

  function prefetch(href) {
    if (!isAppPage(href)) return;
    const key = new URL(href, location.href).href;
    if (key === location.href || cache.has(key)) return;
    fetchPageDoc(key).catch(() => {});
  }

  function startLinkNavigation(link) {
    if (navigationScheduled || navigating) {
      queuedNavigationHref = link.href;
      const queuedPage = pageFromHref(link.href);
      if (queuedPage) syncNavActive(queuedPage);
      return;
    }
    navigationScheduled = true;
    const page = pageFromHref(link.href);
    if (page) syncNavActive(page);

    navigate(link.href, true).then((ok) => {
      if (!ok) {
        const currentPage = pageFromHref(location.href);
        if (currentPage) syncNavActive(currentPage);
      }
    }).finally(() => {
      clearPressedLink();
      navigationScheduled = false;
      const queuedHref = queuedNavigationHref;
      queuedNavigationHref = null;
      if (queuedHref && pageFromHref(queuedHref) !== document.body.dataset.page) {
        startLinkNavigation({ href: queuedHref });
      }
    });
  }

  function onLinkClick(e) {
    const link = e.target.closest('.nav-btn[href], .bottom-nav__tab[href]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isAppPage(link.href)) return;

    e.preventDefault();
    startLinkNavigation(link);
  }

  function onLinkPointerDown(e) {
    const link = e.target.closest('.nav-btn[href], .bottom-nav__tab[href]');
    if (!link || !isAppPage(link.href)) return;
    setPressedLink(link);
    const page = pageFromHref(link.href);
    if (page) syncNavActive(page);
  }

  function onLinkPointerUp(e) {
    const link = e.target.closest('.bottom-nav__tab[href]');
    clearPressedLink();
    if (!link || !isAppPage(link.href) || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    startLinkNavigation(link);
  }

  function initNav() {
    const page = pageFromHref(location.href);
    if (page) syncNavActive(page);

    if (!spaNavAvailable()) return;

    if (page && !history.state?.mantilla) {
      history.replaceState({ mantilla: page }, '', location.href);
    }

    document.addEventListener('pointerdown', onLinkPointerDown, { passive: true });
    document.addEventListener('pointerup', onLinkPointerUp);
    document.addEventListener('pointercancel', clearPressedLink, { passive: true });
    document.addEventListener('click', onLinkClick);
    document.addEventListener('mantilla:data-changed', () => {
      const currentPage = document.body.dataset.page;
      viewCache.forEach((_, cachedPage) => {
        if (cachedPage !== currentPage) staleViews.add(cachedPage);
      });
    });

    window.addEventListener('popstate', () => {
      if (!history.state?.mantilla) return;
      navigate(location.href, false).then((ok) => {
        if (!ok) location.reload();
      });
    });

    document.querySelectorAll('.nav-btn[href], .bottom-nav__tab[href]').forEach((link) => {
      link.addEventListener('mouseenter', () => prefetch(link.href), { passive: true });
      link.addEventListener('focus', () => prefetch(link.href), { passive: true });
    });

    // En móvil no existe hover: preparar todas las secciones cuando el
    // navegador esté libre para que el primer cambio también sea inmediato.
    const prefetchAppPages = () => {
      document.querySelectorAll('.bottom-nav__tab[href]').forEach((link) => prefetch(link.href));
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(prefetchAppPages, { timeout: 1500 });
    } else {
      setTimeout(prefetchAppPages, 250);
    }
  }

  window.Mantilla = window.Mantilla || {};
  Mantilla.prefetchPage = prefetch;
  Mantilla.navigateTo = navigate;

  Mantilla.onReady(initNav);
})();
