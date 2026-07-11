
// ---- Sidebar mobile ----
function closeSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  const backdrop = $('#sidebarBackdrop');
  sidebar.classList.remove('sidebar--open');
  if (backdrop) backdrop.classList.remove('sidebar-backdrop--open');
  document.body.classList.remove('sidebar-open');
}

function toggleSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  const backdrop = $('#sidebarBackdrop');
  const open = !sidebar.classList.contains('sidebar--open');
  sidebar.classList.toggle('sidebar--open', open);
  if (backdrop) backdrop.classList.toggle('sidebar-backdrop--open', open);
  document.body.classList.toggle('sidebar-open', open);
}

const SIDEBAR_COLLAPSE_KEY = 'mantilla-sidebar-collapsed';

function isDesktopLayout() {
  return window.innerWidth >= 900;
}

function applySidebarCollapse(collapsed) {
  if (!isDesktopLayout()) {
    document.body.classList.remove('sidebar-desktop-collapsed');
    return;
  }
  document.body.classList.toggle('sidebar-desktop-collapsed', collapsed);
  const btn = $('#sidebarCollapseBtn');
  if (btn) {
    const label = collapsed ? 'Expandir menú' : 'Contraer menú';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-tooltip', label);
    btn.removeAttribute('title');
  }
}

function toggleSidebarCollapse() {
  if (!isDesktopLayout()) return;
  const collapsed = !document.body.classList.contains('sidebar-desktop-collapsed');
  applySidebarCollapse(collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch (_) { /* ignore */ }
}

function closeTopbarProfileMenu() {
  const root = $('#topbarProfile');
  const btn = $('#topbarProfileBtn');
  const menu = $('#topbarProfileMenu');
  if (!root || !btn || !menu) return;
  root.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
}

function openTopbarProfileMenu() {
  const root = $('#topbarProfile');
  const btn = $('#topbarProfileBtn');
  const menu = $('#topbarProfileMenu');
  if (!root || !btn || !menu) return;
  root.classList.add('is-open');
  btn.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
  if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
}

function initTopbarProfile() {
  // Delegación en document: el SPA reemplaza #mainWrapper (y el perfil) al navegar
  if (initTopbarProfile._wired) return;
  initTopbarProfile._wired = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#topbarProfileBtn');
    const root = $('#topbarProfile');
    const menu = $('#topbarProfileMenu');

    if (btn && root && menu) {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) openTopbarProfileMenu();
      else closeTopbarProfileMenu();
      return;
    }

    if (root && !root.contains(e.target)) closeTopbarProfileMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopbarProfileMenu();
  });
}

function initSidebarDesktop() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
  } catch (_) { /* ignore */ }
  applySidebarCollapse(collapsed);

  $('#sidebarCollapseBtn')?.addEventListener('click', toggleSidebarCollapse);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isDesktopLayout()) {
        document.body.classList.remove('sidebar-desktop-collapsed');
        return;
      }
      let stored = false;
      try {
        stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
      } catch (_) { /* ignore */ }
      applySidebarCollapse(stored);
    }, 120);
  });
}
