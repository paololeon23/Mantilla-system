function calcFlete(peso, tarifa, fleteBase, guia, pesaje) {
  const variable = parseMoneyNumber(peso) * parseMoneyNumber(tarifa);
  return roundMoney(
    parseMoneyNumber(fleteBase) + variable + parseMoneyNumber(guia) + parseMoneyNumber(pesaje)
  );
}

function calcGastos(combustible, viaticos) {
  return roundMoney(parseMoneyNumber(combustible) + parseMoneyNumber(viaticos));
}

function calcUtilidad(flete, gastos) {
  return roundMoney(parseMoneyNumber(flete) - parseMoneyNumber(gastos));
}

function animatePop(el, className = 'kpi-card__value--pop') {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), 400);
}

function updateInputWrapStates(root = document) {
  root.querySelectorAll('.input-wrap').forEach((wrap) => {
    const field = wrap.querySelector('input, select');
    if (!field) return;
    const hasValue = field.value !== '' && field.value != null;
    wrap.classList.toggle('input-wrap--has-value', hasValue);
  });
}

function retriggerFormAnimations(formEl) {
  formEl.querySelectorAll('.form-group--animated').forEach((el) => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });
}

function bindInputWrapListeners() {
  document.querySelectorAll('.input-wrap input, .input-wrap select').forEach((field) => {
    const event = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(event, () => updateInputWrapStates(field.closest('.modal, .filters')));
  });
}

// ---- Campamentos / operaciones (compartido entre páginas) ----
function isNombreCampamento(nombre) {
  return (nombre || '').toLowerCase().includes('campamento');
}

function buildCampamentosFromOperaciones() {
  return rebuildCampamentosFromOperaciones({ replace: true });
}

/**
 * Reconstruye fichas de viaje (campamentos) desde operaciones.
 * Así el pull de Sheets se refleja en "Viajes guardados".
 */
function rebuildCampamentosFromOperaciones(options = {}) {
  const replace = options.replace !== false;
  if (!state.operaciones) state.operaciones = [];
  if (!state.campamentos) state.campamentos = [];

  const money = (v) => (typeof parseMoneyNumber === 'function' ? parseMoneyNumber(v) : Number(v) || 0);
  const normFecha = (v) => (typeof normalizeDateISO === 'function' ? normalizeDateISO(v) : String(v || ''));
  const normPlaca = (v) => (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(v) : String(v || ''));

  const prevById = new Map((state.campamentos || []).map((c) => [String(c.id), c]));
  const prevByKey = new Map();
  (state.campamentos || []).forEach((c) => {
    const key = `${String(c.nombre || '').trim().toLowerCase()}|${normFecha(c.fecha)}`;
    prevByKey.set(key, c);
  });

  const groups = new Map();

  (state.operaciones || []).forEach((op) => {
    if (!op?.placa || !(money(op.peso) > 0)) return;
    const fecha = normFecha(op.fecha);
    if (!fecha) return;

    const nombre = String(op.cliente || '').trim() || 'Sin cliente';
    const key = `${nombre.toLowerCase()}|${fecha}`;

    let camp = groups.get(key);
    if (!camp) {
      const prev = (op.campamentoId && prevById.get(String(op.campamentoId))) || prevByKey.get(key);
      camp = {
        id: prev?.id || uid('camp'),
        nombre: prev?.nombre || nombre,
        fecha,
        tarifa: money(op.tarifa) || prev?.tarifa || 110,
        saldoAnterior: prev?.saldoAnterior || 0,
        filas: []
      };
      groups.set(key, camp);
    }

    const tarifa = money(op.tarifa);
    if (tarifa > 0) camp.tarifa = tarifa;

    camp.filas.push({
      opId: String(op.id || ''),
      fecha,
      cliente: nombre,
      producto: op.producto || '',
      dniRuc: op.dniRuc || '',
      toneladas: money(op.peso),
      guia: money(op.guia),
      placa: normPlaca(op.placa),
      pesaje: money(op.pesaje),
      combustible: money(op.combustible),
      viaticos: money(op.viaticos)
    });

    op.campamentoId = camp.id;
  });

  const next = [...groups.values()].sort((a, b) =>
    b.fecha.localeCompare(a.fecha) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
  );

  if (!replace && !next.length) return false;

  const prevSig = (state.campamentos || []).map((c) =>
    `${c.id}|${c.fecha}|${c.nombre}|${(c.filas || []).map((f) => f.opId || f.placa).join(',')}`
  ).join(';');
  const nextSig = next.map((c) =>
    `${c.id}|${c.fecha}|${c.nombre}|${(c.filas || []).map((f) => f.opId || f.placa).join(',')}`
  ).join(';');

  if (prevSig === nextSig) return false;
  state.campamentos = next;
  return true;
}

function syncOperacionesFromCampamento(camp) {
  if (!camp) return;
  if (!state.operaciones) state.operaciones = [];

  const prevOps = state.operaciones.filter((op) => op.campamentoId === camp.id);
  const usedPrevIds = new Set();
  const tarifa = camp.tarifa;

  state.operaciones = state.operaciones.filter((op) => op.campamentoId !== camp.id);

  (camp.filas || []).forEach((f, index) => {
    if (!f.placa || !f.toneladas) return;

    let opId = (f.opId || '').trim();
    if (opId && usedPrevIds.has(opId)) opId = '';

    if (!opId && prevOps[index] && !usedPrevIds.has(prevOps[index].id)) {
      opId = prevOps[index].id;
    }

    if (!opId) {
      const fechaFila = f.fecha || camp.fecha;
      const match = prevOps.find((op) =>
        !usedPrevIds.has(op.id) &&
        op.placa === f.placa &&
        op.fecha === fechaFila &&
        Number(op.peso) === Number(f.toneladas)
      );
      if (match) opId = match.id;
    }

    if (!opId) opId = uid('op');
    usedPrevIds.add(opId);
    f.opId = opId;

    const flete = calcFlete(f.toneladas, tarifa, 0, f.guia, f.pesaje);
    const combustible = parseMoneyNumber(f.combustible);
    const viaticos = parseMoneyNumber(f.viaticos);
    const gastos = calcGastos(combustible, viaticos);
    const clienteFila = f.cliente || camp.nombre;
    const productoFila = f.producto || (isNombreCampamento(clienteFila) ? 'carbon' : '');
    const chofer = (typeof getChoferByPlaca === 'function' ? getChoferByPlaca(f.placa) : '')
      || (typeof findLastChofer === 'function' ? findLastChofer(f.placa) : '')
      || camp.nombre;

    state.operaciones.push({
      id: opId,
      campamentoId: camp.id,
      fecha: f.fecha || camp.fecha,
      placa: f.placa,
      chofer,
      cliente: clienteFila,
      dniRuc: f.dniRuc || '',
      producto: productoFila,
      unidad: 'TM',
      peso: parseMoneyNumber(f.toneladas),
      tarifa: parseMoneyNumber(tarifa),
      fleteBase: 0,
      guia: parseMoneyNumber(f.guia),
      pesaje: parseMoneyNumber(f.pesaje),
      flete,
      combustible,
      viaticos,
      gastos,
      utilidad: calcUtilidad(flete, gastos)
    });
    registerCatalogValue('placas', f.placa);
    registerCatalogValue('clientes', clienteFila);
    if (productoFila) registerCatalogValue('productos', productoFila);
  });

  prevOps.forEach((op) => {
    if (!usedPrevIds.has(op.id)) {
      window.Mantilla?.sync?.syncDelete?.('viajes', op.id);
    }
  });

  registerCatalogValue('clientes', camp.nombre);
}

// ---- Persistencia ----
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (state.catalogos) {
        CATALOGOS = JSON.parse(JSON.stringify({ ...CATALOGOS_DEFAULT, ...state.catalogos }));
      }
      if (!state.operaciones) state.operaciones = [];
      state.operaciones.forEach((op) => {
        if (op.fleteBase == null) op.fleteBase = 0;
        if (op.dniRuc == null) op.dniRuc = '';
      });
      if (!state.campamentos) state.campamentos = [];
      state.campamentos.forEach((c) => {
        if (c.saldoAnterior == null) c.saldoAnterior = 0;
        c.filas?.forEach((f) => {
          if (f.cliente == null) f.cliente = '';
          if (f.dniRuc == null) f.dniRuc = '';
          if (f.producto == null) f.producto = '';
          if (!f.fecha) f.fecha = c.fecha;
        });
      });
      purgeStaleCampamentos();
      if ((state.operaciones || []).length) {
        rebuildCampamentosFromOperaciones();
      }
      if (!state.camiones) state.camiones = [];
      if (!state.mantenimiento) state.mantenimiento = [];
      (state.mantenimiento || []).forEach((m) => {
        if (m.hora == null) m.hora = '';
        else if (typeof normalizeTime === 'function') {
          const raw = String(m.hora).trim();
          // Solo limpiar fechas seriales de Sheets, no borrar HH:mm reales
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^1899-12-3/.test(raw)) {
            m.hora = '';
          } else {
            m.hora = normalizeTime(m.hora);
          }
        }
        if (m.horaRegistro && typeof normalizeTime === 'function') {
          m.horaRegistro = normalizeTime(m.horaRegistro) || m.horaRegistro;
        }
        // Si hora está vacía o es 00:00 falso, intentar recuperar de horaRegistro / id
        if ((!m.hora || m.hora === '00:00') && m.horaRegistro) {
          const recovered = typeof normalizeTime === 'function' ? normalizeTime(m.horaRegistro) : '';
          if (recovered && recovered !== '00:00') m.hora = recovered;
        }
        if ((!m.hora || m.hora === '00:00') && typeof horaFromMantillaId === 'function') {
          const fromId = horaFromMantillaId(m.id);
          if (fromId) m.hora = fromId;
        }
        if (m.unidad == null) m.unidad = 1;
        if (m.costoUnit == null) m.costoUnit = m.monto;
        if (m.fecha) m.fecha = normalizeDateISO(m.fecha);
        if (m.unidad != null) m.unidad = parseMoneyNumber(m.unidad) || 1;
        if (m.costoUnit != null) m.costoUnit = parseMoneyNumber(m.costoUnit);
        if (m.monto != null) m.monto = parseMoneyNumber(m.monto);
      });
      state.operaciones.forEach((op) => {
        op.flete = parseMoneyNumber(op.flete);
        op.gastos = parseMoneyNumber(op.gastos);
        op.utilidad = parseMoneyNumber(op.utilidad);
        op.peso = parseMoneyNumber(op.peso);
        op.tarifa = parseMoneyNumber(op.tarifa);
        op.guia = parseMoneyNumber(op.guia);
        op.pesaje = parseMoneyNumber(op.pesaje);
        op.combustible = parseMoneyNumber(op.combustible);
        op.viaticos = parseMoneyNumber(op.viaticos);
      });
      if (typeof syncCatalogosFromCamiones === 'function') syncCatalogosFromCamiones();
      return;
    }
  } catch (_) { /* ignore */ }
  state = {
    operaciones: [],
    mantenimiento: [],
    campamentos: [],
    camiones: [],
    catalogos: { ...CATALOGOS_DEFAULT }
  };
  CATALOGOS = JSON.parse(JSON.stringify(CATALOGOS_DEFAULT));
  saveData();
}

function saveData() {
  try {
    purgeStaleCampamentos();
    state.catalogos = CATALOGOS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem('mantilla_last_save', String(Date.now()));
  } catch (err) {
    console.error('[Mantilla] No se pudo guardar en el dispositivo:', err);
  }
}

function flushPersistencia() {
  saveData();
}

function campamentoEffectiveDate(camp) {
  const base = camp.fecha || '';
  const filaDates = (camp.filas || []).map((f) => f.fecha || base).filter(Boolean);
  if (!filaDates.length) return base;
  return filaDates.sort().reverse()[0] || base;
}

function isCampamentoWithinRetention(camp) {
  const cutoff = campRetentionCutoffISO();
  const effective = campamentoEffectiveDate(camp);
  return effective >= cutoff;
}

/** Últimos N viajes para la lista (aunque sean más viejos que hoy/ayer). */
const CAMP_LIST_RECENT_MIN = 3;

function getRecentCampamentos(minCount = CAMP_LIST_RECENT_MIN) {
  const all = [...(state.campamentos || [])]
    .filter((c) => (c.filas || []).some((f) => f.placa && Number(f.toneladas) > 0))
    .sort((a, b) => {
      const byDate = campamentoEffectiveDate(b).localeCompare(campamentoEffectiveDate(a));
      return byDate || String(b.id).localeCompare(String(a.id));
    });

  const retained = all.filter(isCampamentoWithinRetention);
  if (retained.length >= minCount) return retained;
  return all.slice(0, Math.max(minCount, retained.length));
}

function purgeStaleCampamentos() {
  if (!state.campamentos) state.campamentos = [];
  // No borrar operaciones: el pull las necesita para reconstruir fichas.
  // Solo limpia fichas muy viejas fuera de retención y fuera del top reciente.
  const keepIds = new Set(getRecentCampamentos(CAMP_LIST_RECENT_MIN).map((c) => String(c.id)));
  const before = state.campamentos.length;
  state.campamentos = state.campamentos.filter((c) => {
    if (keepIds.has(String(c.id))) return true;
    return isCampamentoWithinRetention(c);
  });
  return state.campamentos.length !== before;
}

function registerCatalogValue(key, value) {
  const v = (value || '').trim();
  if (!v) return;
  if (!CATALOGOS[key].includes(v)) {
    CATALOGOS[key].push(v);
    CATALOGOS[key].sort((a, b) => a.localeCompare(b, 'es'));
    populateSelects();
  }
}

// ---- Filtros ----
function getFilters() {
  return {
    placa: $('#filterPlaca')?.value || '',
    nombre: $('#filterNombre')?.value || '',
    chofer: $('#filterChofer')?.value || '',
    cliente: $('#filterCliente')?.value || '',
    fecha: $('#filterFecha')?.value || ''
  };
}

function filterOperaciones() {
  const f = getFilters();

  return state.operaciones.filter((op) => {
    if (f.placa && op.placa !== f.placa) return false;
    if (f.chofer && op.chofer !== f.chofer) return false;
    if (f.cliente && op.cliente !== f.cliente) return false;
    if (f.fecha && op.fecha !== f.fecha) return false;
    return true;
  });
}

function countViajesGuardados() {
  return (state.campamentos || []).reduce((s, c) => s + (c.filas?.filter((f) => f.placa && f.toneladas > 0).length || 0), 0);
}

function filterMantenimiento(options = {}) {
  const ignorePlaca = !!options.ignorePlaca;
  if ($('#maintFilterDesde') || $('#maintFilterHasta')) {
    const f = typeof getMaintFilters === 'function' ? getMaintFilters() : { placa: '', desde: '', hasta: '' };
    return state.mantenimiento.filter((m) => {
      const placaKey = f.placa
        ? (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(f.placa) : f.placa)
        : '';
      const mPlaca = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(m.placa) : m.placa;
      if (!ignorePlaca && placaKey && mPlaca !== placaKey) return false;
      const mFecha = normalizeDateISO(m.fecha);
      const desde = normalizeDateISO(f.desde);
      const hasta = normalizeDateISO(f.hasta);
      if (desde && mFecha && mFecha < desde) return false;
      if (hasta && mFecha && mFecha > hasta) return false;
      return true;
    });
  }

  const f = getFilters();
  return state.mantenimiento.filter((m) => {
    if (!ignorePlaca && f.placa && m.placa !== f.placa) return false;
    if (f.fecha && m.fecha !== f.fecha) return false;
    return true;
  });
}

// ---- Paginación ----

function paginateItems(items, page, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total,
    start: total === 0 ? 0 : start + 1,
    end: Math.min(safePage * pageSize, total),
    pageSize
  };
}

function getVisiblePages(current, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, current - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function renderPagination(el, meta, onPage, pageSize = PAGE_SIZE) {
  if (!el) return;

  // Solo se muestra cuando hay más de una página
  if (!meta.total || meta.totalPages <= 1) {
    el.innerHTML = '';
    el.hidden = true;
    el.classList.add('pagination--hidden');
    return;
  }

  el.hidden = false;
  el.classList.remove('pagination--hidden');
  const pages = getVisiblePages(meta.page, meta.totalPages);
  const size = meta.pageSize || pageSize;

  el.innerHTML = `
    <button type="button" class="pagination__arrow" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''} aria-label="P\u00e1gina anterior">\u2039</button>
    <div class="pagination__nums" role="group" aria-label="P\u00e1ginas">
      ${pages.map((p) => `<button type="button" class="pagination__num${p === meta.page ? ' pagination__num--active' : ''}" data-page="${p}" aria-label="P\u00e1gina ${p}"${p === meta.page ? ' aria-current="page"' : ''}>${p}</button>`).join('')}
    </div>
    <button type="button" class="pagination__arrow" data-page="${meta.page + 1}" ${meta.page >= meta.totalPages ? 'disabled' : ''} aria-label="P\u00e1gina siguiente">\u203A</button>
    <span class="pagination__info">${meta.start}\u2013${meta.end} de ${meta.total} \u00b7 ${size} por p\u00e1gina</span>`;

  el.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      const next = Number(btn.dataset.page);
      if (!Number.isFinite(next) || next < 1 || next > meta.totalPages || next === meta.page) return;
      onPage(next);
    });
  });
}

