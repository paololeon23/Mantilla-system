/* ============================================
   MANTILLA — Gestión de Flota
   Lógica (cuaderno imagen 2):
   Total a Pagar = Base viaje + (Peso × Tarifa) + Guía + Pesaje
   Utilidad = Total a Pagar − Gastos
   ============================================ */

function lucideIcon(name, extraClass = '') {
  const cls = ['lucide-icon', extraClass].filter(Boolean).join(' ');
  return `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
}

function panelCountIcon(name = 'circle') {
  return lucideIcon(name, 'lucide-icon--count');
}

let lucideRefreshQueued = false;

function renderLucideIconsNow() {
  lucideRefreshQueued = false;
  if (typeof lucide === 'undefined') return;
  try {
    lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
    // Lucide conserva data-lucide en los SVG generados. Quitarlo evita que
    // llamadas posteriores vuelvan a reemplazar iconos que ya están listos.
    document.querySelectorAll('svg[data-lucide]').forEach((icon) => {
      icon.removeAttribute('data-lucide');
    });
  } catch (err) {
    console.warn('[Mantilla] No se pudieron renderizar los iconos:', err);
  }
}

function refreshLucideIcons() {
  if (typeof lucide === 'undefined' || lucideRefreshQueued) return;
  lucideRefreshQueued = true;

  // Varias partes de una página solicitan iconos durante el mismo render.
  // Agruparlas evita recorrer todo el DOM repetidamente en teléfonos.
  const renderIcons = () => {
    if (!lucideRefreshQueued) return;
    renderLucideIconsNow();
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(renderIcons);
  } else {
    Promise.resolve().then(renderIcons);
  }
}

function mantillaPdfIcon(extraClass = '') {
  const cls = ['mantilla-pdf-icon', extraClass].filter(Boolean).join(' ');
  return `<span class="${cls}" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="mantilla-pdf-icon__svg">
      <path class="mantilla-pdf-icon__shadow" d="M7.5 4.5h6.8l3.7 3.7v11.3a2 2 0 0 1-2 2H7.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>
      <path class="mantilla-pdf-icon__page" d="M6.5 3.5h7.3l4.2 4.2V19a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z"/>
      <path class="mantilla-pdf-icon__fold" d="M13.8 3.5v4.2h4.2"/>
      <path class="mantilla-pdf-icon__lines" d="M8.2 11h7.6M8.2 13.2h5.4"/>
      <rect class="mantilla-pdf-icon__badge" x="6" y="14.6" width="12" height="5.2" rx="1.2"/>
      <text class="mantilla-pdf-icon__label" x="12" y="18.1" text-anchor="middle">PDF</text>
    </svg>
  </span>`;
}

const ICON_EDIT = `${lucideIcon('square-pen', 'lucide-icon--btn')} Editar`;
const ICON_DELETE = `${lucideIcon('trash-2', 'lucide-icon--btn')} Eliminar`;
const ICON_PRINT = `${mantillaPdfIcon('mantilla-pdf-icon--btn')} <span class="btn-print-label">PDF</span>`;

const STORAGE_KEY = 'mantilla_flota_v6';
// ---- Catálogos (vacíos — se llenan al registrar camiones, clientes, etc.) ----
const CATALOGOS_DEFAULT = {
  placas: [],
  choferes: [],
  clientes: [],
  productos: ['materiales mineral', 'cemento mineral', 'agregados mineral', 'mineral', 'carbon']
};

let CATALOGOS = JSON.parse(JSON.stringify(CATALOGOS_DEFAULT));

const CLIENTE_PRESETS = {
  'Campamento Igor': {
    tarifa: 110,
    guia: 100,
    pesaje: 27.5,
    fleteBase: 0,
    producto: 'carbon',
    combustible: 0,
    viaticos: 0
  },
  Chino: {
    tarifa: 120,
    fleteBase: 1200,
    guia: 0,
    pesaje: 0,
    producto: 'materiales mineral',
    viaticos: 600
  },
  'Empresa A': {
    tarifa: 120,
    fleteBase: 1650,
    guia: 0,
    pesaje: 0,
    producto: 'cemento mineral',
    viaticos: 600
  },
  'Rojas T': {
    tarifa: 120,
    fleteBase: 1650,
    guia: 200,
    pesaje: 0,
    producto: 'agregados mineral',
    viaticos: 600
  }
};

const PLACA_CHOFER = {};

const MANTILLA_OWNER = {
  name: 'Marco Ruben',
  initials: 'MR',
  role: 'Dueño de la empresa'
};

const DATOS_INICIALES = {
  operaciones: [],
  mantenimiento: [],
  ingresosExtras: [],
  campamentos: [],
  camiones: []
};

const LIST_PAGE_SIZE_DESKTOP = 8;
const LIST_PAGE_SIZE_MOBILE = 4;
/** @deprecated Usar getListPageSize() */
const PAGE_SIZE = LIST_PAGE_SIZE_MOBILE;
/** @deprecated Usar getListPageSize() */
const CAMP_LIST_PAGE_SIZE = LIST_PAGE_SIZE_MOBILE;
/** @deprecated Usar getListPageSize() */
const CAMIONES_PAGE_SIZE_DESKTOP = LIST_PAGE_SIZE_DESKTOP;
/** @deprecated Usar getListPageSize() */
const CAMIONES_PAGE_SIZE_MOBILE = LIST_PAGE_SIZE_MOBILE;
const CAMP_RETENTION_DAYS = 2;

let opsPage = 1;
let maintPage = 1;
let ingresoPage = 1;
let campListPage = 1;
let camionesPage = 1;
let campListDayFilter = 'all';
let campListFechaFilter = '';
let historialCampById = new Map();
let dpCampListFecha = null;
let _historialSearching = false;
