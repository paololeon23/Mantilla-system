/**
 * Navegación rápida entre secciones sin recargar toda la página.
 * Intercambia contenido y modales; mantiene fijos sidebar y barra inferior.
 */
(function () {
  const PAGE_FILES = {
    'viajes.html': 'viajes',
    'camiones.html': 'camiones',
    'mantenimiento.html': 'mantenimiento'
  };

  const cache = new Map();
  let navigating = false;

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

  /** mainWrapper + modales; la bottom-nav queda fija para no parpadear */
  function collectShellNodes(root) {
    const start = root.getElementById('mainWrapper');
    if (!start) return [];
    const nodes = [];
    let el = start;
    while (el) {
      if (el.id === 'bottomNav' || el.tagName === 'SCRIPT') break;
      nodes.push(el);
      el = el.nextElementSibling;
    }
    return nodes;
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

    let html = '';
    try {
      const res = await fetch(key, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (_) {
      html = loadPageHtmlSync(key);
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    cache.set(key, doc);
    return doc;
  }

  function loadPageHtmlSync(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
      throw new Error(`XHR ${xhr.status}`);
    }
    if (!xhr.responseText) throw new Error('XHR vacío');
    return xhr.responseText;
  }

  function replaceShell(doc) {
    const newNodes = collectShellNodes(doc).map((n) => n.cloneNode(true));
    const oldNodes = collectShellNodes(document);
    if (!newNodes.length || !oldNodes.length) throw new Error('Shell no encontrado');

    const parent = oldNodes[0].parentNode;
    const anchor = oldNodes[oldNodes.length - 1].nextSibling;
    oldNodes.forEach((n) => n.remove());
    newNodes.forEach((n) => parent.insertBefore(n, anchor));

    const page = doc.body?.dataset?.page || pageFromHref(location.href) || 'viajes';
    document.body.dataset.page = page;
    if (doc.title) document.title = doc.title;
    syncNavActive(page);
    return page;
  }

  function hardNavigate(href) {
    location.href = href;
  }

  async function navigate(href, push = true) {
    const target = new URL(href, location.href).href;
    if (navigating || !isAppPage(target)) return false;
    if (target === location.href) return true;

    navigating = true;

    try {
      if (typeof closeOverlayPickers === 'function') closeOverlayPickers();
      if (typeof closeTopbarProfileMenu === 'function') closeTopbarProfileMenu();
      if (window.innerWidth < 900 && typeof closeSidebar === 'function') closeSidebar();

      const doc = await fetchPageDoc(target);
      replaceShell(doc);
      if (push) {
        const page = doc.body?.dataset?.page || pageFromHref(target);
        history.pushState({ mantilla: page }, '', target);
      }
      if (typeof Mantilla?.initPageForCurrentRoute === 'function') {
        Mantilla.initPageForCurrentRoute();
      }
      if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
      window.scrollTo(0, 0);
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

  function onLinkClick(e) {
    const link = e.target.closest('.nav-btn[href], .bottom-nav__tab[href]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isAppPage(link.href)) return;

    e.preventDefault();

    const page = pageFromHref(link.href);
    if (page) syncNavActive(page);

    navigate(link.href, true).then((ok) => {
      if (!ok) hardNavigate(link.href);
    });
  }

  function initNav() {
    const page = pageFromHref(location.href);
    if (page) syncNavActive(page);

    if (!spaNavAvailable()) return;

    if (page && !history.state?.mantilla) {
      history.replaceState({ mantilla: page }, '', location.href);
    }

    document.addEventListener('click', onLinkClick);

    window.addEventListener('popstate', () => {
      if (!history.state?.mantilla) return;
      navigate(location.href, false).then((ok) => {
        if (!ok) location.reload();
      });
    });

    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 800));
    idle(() => {
      Object.keys(PAGE_FILES).forEach((file) => {
        const url = new URL(file, location.href).href;
        if (url !== location.href) prefetch(url);
      });
    });

    document.querySelectorAll('.nav-btn[href], .bottom-nav__tab[href]').forEach((link) => {
      link.addEventListener('mouseenter', () => prefetch(link.href), { passive: true });
      link.addEventListener('focus', () => prefetch(link.href), { passive: true });
    });
  }

  window.Mantilla = window.Mantilla || {};
  Mantilla.prefetchPage = prefetch;
  Mantilla.navigateTo = navigate;

  Mantilla.onReady(initNav);
})();
