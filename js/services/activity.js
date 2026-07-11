/**
 * Actividad / movimientos (sidebar desktop, estilo barra inferior).
 * Colapsada = barra; abierta = timeline hacia arriba. Solo desktop.
 */
(function () {
  const ACTIVITY_KEY = 'mantilla-activity-v1';
  const ACTIVITY_MAX = 40;
  const COLLAPSE_KEY = 'mantilla-activity-collapsed';
  const PIN_KEY = 'mantilla-activity-pinned';

  function loadItems() {
    try {
      const raw = localStorage.getItem(ACTIVITY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveItems(items) {
    try {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items.slice(0, ACTIVITY_MAX)));
    } catch (_) { /* ignore */ }
  }

  function formatActivityTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (_) {
      return '';
    }
  }

  function escape(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, max) {
    const s = String(str || '').trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
  }

  function log(entry) {
    if (!entry || !entry.title) return;
    const items = loadItems();
    items.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: String(entry.title).trim(),
      path: String(entry.path || entry.detail || '').trim(),
      type: String(entry.type || 'info'),
      at: entry.at || Date.now()
    });
    saveItems(items);
    render();
  }

  function seedFromState() {
    if (loadItems().length) return;
    const seeded = [];
    const camps = [...(window.state?.campamentos || [])]
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .slice(0, 6);
    camps.forEach((c) => {
      const n = (window.state?.operaciones || []).filter((op) => op.campamentoId === c.id).length;
      seeded.push({
        id: `seed_camp_${c.id}`,
        title: truncate(c.nombre || 'Viaje', 28),
        path: `viajes/${c.fecha || '—'}`,
        type: 'viaje',
        at: Date.parse(c.fecha) || Date.now()
      });
      if (n) seeded[seeded.length - 1].path += ` · ${n} camión${n !== 1 ? 'es' : ''}`;
    });

    const gastos = [...(window.state?.mantenimiento || [])]
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .slice(0, 6);
    gastos.forEach((g) => {
      seeded.push({
        id: `seed_mt_${g.id}`,
        title: truncate(g.descripcion || 'Gasto', 28),
        path: `gastos/${g.placa || '—'}`,
        type: 'gasto',
        at: Date.parse(`${g.fecha || ''}T${g.hora || '12:00'}`) || Date.now()
      });
    });

    const cams = [...(window.state?.camiones || [])].slice(-4).reverse();
    cams.forEach((c) => {
      seeded.push({
        id: `seed_cam_${c.id}`,
        title: truncate(c.placa || 'Camión', 28),
        path: `camiones/${c.chofer || 'sin chofer'}`,
        type: 'camion',
        at: Date.parse(c.createdAt || c.fecha) || Date.now()
      });
    });

    seeded.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (seeded.length) saveItems(seeded.slice(0, ACTIVITY_MAX));
  }

  function isCollapsed() {
    try {
      if (localStorage.getItem(PIN_KEY) === '1') return false;
      const v = localStorage.getItem(COLLAPSE_KEY);
      return v == null ? true : v === '1';
    } catch (_) {
      return true;
    }
  }

  function isPinned() {
    try {
      return localStorage.getItem(PIN_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setCollapsed(v) {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch (_) { /* ignore */ }
  }

  function setPinned(v) {
    try {
      localStorage.setItem(PIN_KEY, v ? '1' : '0');
      if (v) localStorage.setItem(COLLAPSE_KEY, '0');
    } catch (_) { /* ignore */ }
  }

  function applyState(root) {
    if (!root) return;
    const collapsed = isCollapsed();
    const pinned = isPinned();
    root.classList.toggle('is-collapsed', collapsed);
    root.classList.toggle('is-open', !collapsed);
    root.classList.toggle('is-pinned', pinned);
    const btn = root.querySelector('#sidebarActivityToggle');
    const pinBtn = root.querySelector('#sidebarActivityPin');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (pinBtn) {
      pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pinBtn.title = pinned ? 'Desfijar actividad' : 'Fijar actividad abierta';
    }
  }

  function render() {
    const list = document.getElementById('sidebarActivityList');
    const badge = document.getElementById('sidebarActivityBadge');
    const root = document.getElementById('sidebarActivity');
    if (!list || !root) return;

    const items = loadItems();
    if (badge) {
      badge.textContent = String(items.length);
      badge.hidden = items.length === 0;
    }

    if (!items.length) {
      list.innerHTML = `
        <li class="sidebar-activity__empty">
          <span>Sin movimientos aún</span>
          <small>Al guardar viajes, gastos o camiones aparecerán aquí</small>
        </li>`;
      return;
    }

    list.innerHTML = items.map((item) => `
      <li class="sidebar-activity__item sidebar-activity__item--${escape(item.type || 'info')}">
        <span class="sidebar-activity__dot" aria-hidden="true"></span>
        <div class="sidebar-activity__content">
          <div class="sidebar-activity__row">
            <strong class="sidebar-activity__title" title="${escape(item.title)}">${escape(truncate(item.title, 24))}</strong>
            <time class="sidebar-activity__time" datetime="${escape(new Date(item.at).toISOString())}">${escape(formatActivityTime(item.at))}</time>
          </div>
          ${item.path ? `<span class="sidebar-activity__path">${escape(truncate(item.path, 32))}</span>` : ''}
        </div>
      </li>
    `).join('');
  }

  function toggleOpen() {
    const root = document.getElementById('sidebarActivity');
    if (!root) return;
    if (isPinned()) return;
    const next = !root.classList.contains('is-collapsed');
    setCollapsed(next);
    applyState(root);
  }

  function openPanel() {
    const root = document.getElementById('sidebarActivity');
    if (!root) return;
    setCollapsed(false);
    applyState(root);
  }

  function init() {
    const root = document.getElementById('sidebarActivity');
    if (!root) return;

    if (!init._wired) {
      init._wired = true;

      root.querySelector('#sidebarActivityToggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleOpen();
      });

      root.querySelector('#sidebarActivityIconBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openPanel();
        if (document.body.classList.contains('sidebar-desktop-collapsed')) {
          /* keep icon rail; panel floats */
        }
      });

      root.querySelector('#sidebarActivityPin')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !isPinned();
        setPinned(next);
        if (next) setCollapsed(false);
        applyState(root);
      });

      root.querySelector('#sidebarActivityRefresh')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        seedFromState();
        render();
        if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
      });
    }

    seedFromState();
    applyState(root);
    render();
    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  window.Mantilla = window.Mantilla || {};
  Mantilla.activity = {
    log,
    render,
    init,
    seedFromState,
    open: openPanel
  };
})();
