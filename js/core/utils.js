// ---- Estado ----
let state = { operaciones: [], mantenimiento: [], ingresosExtras: [], campamentos: [], camiones: [], catalogos: null };

function getPage() {
  return window.Mantilla?.getPage?.() || document.body?.dataset?.page || 'viajes';
}

// ---- Utilidades ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function markElementDeleting(element) {
  if (!element) return;
  element.classList.add('is-deleting');
  element.setAttribute('aria-busy', 'true');
  element.querySelectorAll('button, input, select, textarea, a').forEach((control) => {
    if ('disabled' in control) control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    if (control.tagName === 'A') control.setAttribute('tabindex', '-1');
  });
}

function deletingTransition(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatMoney(n) {
  return `S/ ${roundMoney(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Redondeo seguro para dinero (2 decimales por defecto). */
function roundMoney(n, decimals = 2) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Convierte texto/número a valor numérico para servidor y cálculos.
 * Acepta 22456.00, 22.456,00, 22,456.00 y similares; devuelve número con punto decimal.
 */
function parseMoneyNumber(value, decimals = 2) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return roundMoney(value, decimals);

  let s = String(value).trim().replace(/\s/g, '');
  if (!s) return 0;
  s = s.replace(/^S\/\s*/i, '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return roundMoney(n, decimals);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Segmentos: string plano o { b: 'texto en negrita' } */
function alertDetailHtml(segments) {
  return segments.map((part) => {
    if (typeof part === 'string') return escapeHtml(part);
    if (part && part.b != null) return `<strong>${escapeHtml(part.b)}</strong>`;
    return '';
  }).join('');
}

/** Normaliza fechas a YYYY-MM-DD (localStorage, Sheets, filtros). */
function normalizeDateISO(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return s;
}

function formatDate(iso) {
  const normalized = normalizeDateISO(iso);
  if (!normalized) return '\u2014';
  const [y, m, d] = normalized.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function formatDateDM(iso) {
  const normalized = normalizeDateISO(iso);
  if (!normalized) return '\u2014';
  const [, m, d] = normalized.split('-');
  return `${d}/${m}`;
}

function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function yesterdayISO() {
  const t = new Date();
  t.setDate(t.getDate() - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function campRetentionCutoffISO() {
  return yesterdayISO();
}

function nowTime() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Hora de registro para Google Sheets: 5:15:00 p.m. */
function horaRegistroDisplay(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  let h = d.getHours();
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} ${ampm}`;
}

function formatTime(hora) {
  if (hora == null || hora === '') return '\u2014';

  // Sheets a veces manda fracción del día (0.5 = 12:00)
  if (typeof hora === 'number' && Number.isFinite(hora)) {
    const frac = ((hora % 1) + 1) % 1;
    const totalMins = Math.round(frac * 24 * 60) % (24 * 60);
    const h = Math.floor(totalMins / 60);
    const min = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  const s = String(hora).trim().replace(/\u00a0/g, ' ');
  if (!s) return '\u2014';

  // Artefacto Sheets (solo fecha, sin hora real)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return '\u2014';

  // HH:mm / HH:mm:ss
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;

  // 5:15:00 p.m. / a.m. y también "p. m." (locale ES)
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const isPm = /^p/i.test(m[3]);
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }

  // Buscar hora dentro de un texto más largo (hora_registro, ISO, etc.)
  m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (m) {
    let h = parseInt(m[1], 10);
    if (m[3]) {
      const isPm = /^p/i.test(m[3]);
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }

  return '\u2014';
}

/** Normaliza cualquier valor de hora a HH:mm (para guardar / sync). */
function normalizeTime(hora) {
  const formatted = formatTime(hora);
  return formatted === '\u2014' ? '' : formatted;
}

/** Hora para mostrar en gastos: usa hora o, si falta, horaRegistro. */
function displayGastoHora(m) {
  if (!m) return '\u2014';
  const primary = normalizeTime(m.hora);
  if (primary && primary !== '00:00') return primary;
  const fallback = normalizeTime(m.horaRegistro || m.hora_registro);
  if (fallback && fallback !== '00:00') return fallback;
  const fromId = horaFromMantillaId(m.id);
  if (fromId) return fromId;
  if (primary) return primary;
  if (fallback) return fallback;
  return '\u2014';
}

/** Recupera HH:mm desde ids tipo mt-{timestampMs}-xxx cuando Sheets perdió la hora. */
function horaFromMantillaId(id) {
  const m = String(id || '').match(/^mt-(\d{10,16})(?:-|$)/);
  if (!m) return '';
  const ms = Number(m[1]);
  if (!Number.isFinite(ms) || ms < 1e12) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMaintUnidad(unidad) {
  const n = Number(unidad);
  if (!unidad && unidad !== 0) return '1';
  if (Number.isNaN(n) || n <= 0) return '1';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function compareMaintRecords(a, b) {
  const dateCmp = normalizeDateISO(b.fecha).localeCompare(normalizeDateISO(a.fecha));
  if (dateCmp !== 0) return dateCmp;
  return (b.hora || '00:00').localeCompare(a.hora || '00:00');
}

function getListPageSize() {
  return window.innerWidth >= 900 ? LIST_PAGE_SIZE_DESKTOP : LIST_PAGE_SIZE_MOBILE;
}

