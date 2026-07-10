// ---- Render: Viajes ----
function renderOperaciones() {
  const ops = filterOperaciones();
  updateKPIs(ops, filterMantenimiento());
  updateFiltersBadge();
  renderCampamentoList();
}

// ---- Render: Mantenimiento ----
function groupMantenimientoByPlaca(items) {
  const map = new Map();
  items.forEach((m) => {
    const placa = (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(m.placa) : m.placa) || m.placa;
    if (!map.has(placa)) map.set(placa, []);
    map.get(placa).push({ ...m, placa });
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([placa, gastos]) => {
      const sorted = [...gastos].sort(compareMaintRecords);
      return {
        placa,
        gastos: sorted,
        total: sorted.reduce((s, g) => s + g.monto, 0),
        count: sorted.length,
        chofer: typeof getChoferByPlaca === 'function' ? getChoferByPlaca(placa) : ''
      };
    });
}

/** Agrupa gastos del mismo día + misma placa (resumen, no 1 card por producto). */
function groupMantenimientoByFechaPlaca(items) {
  const map = new Map();
  (items || []).forEach((m) => {
    const placa = (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(m.placa) : m.placa) || m.placa || '';
    const fecha = (typeof normalizeDateISO === 'function' ? normalizeDateISO(m.fecha) : m.fecha) || '';
    const key = `${fecha}|${placa}`;
    if (!map.has(key)) {
      map.set(key, { fecha, placa, gastos: [] });
    }
    map.get(key).gastos.push(m);
  });

  return [...map.values()]
    .map((g) => {
      const gastos = [...g.gastos].sort(compareMaintRecords);
      const total = gastos.reduce((s, x) => s + (Number(x.monto) || 0), 0);
      const horas = [...new Set(gastos.map((x) =>
        (typeof displayGastoHora === 'function' ? displayGastoHora(x) : formatTime(x.hora))
      ).filter((h) => h && h !== '\u2014'))];
      return {
        fecha: g.fecha,
        placa: g.placa,
        gastos,
        total,
        count: gastos.length,
        horaLabel: horas.length === 1 ? horas[0] : (horas.length > 1 ? `${horas.length} horas` : '\u2014'),
        chofer: typeof getChoferByPlaca === 'function' ? getChoferByPlaca(g.placa) : ''
      };
    })
    .sort((a, b) =>
      b.fecha.localeCompare(a.fecha) ||
      a.placa.localeCompare(b.placa, 'es')
    );
}

function renderMaintActionButtons(id) {
  return `
    <div class="actions-group">
      <button type="button" class="btn btn--action btn--action-edit btn--sm btn--action-icon" title="Editar" aria-label="Editar" onclick="editMantenimiento('${id}')">${lucideIcon('square-pen', 'lucide-icon--btn')}</button>
      <button type="button" class="btn btn--action btn--action-delete btn--sm btn--action-icon" title="Eliminar" aria-label="Eliminar" onclick="deleteMantenimiento('${id}')">${lucideIcon('trash-2', 'lucide-icon--btn')}</button>
    </div>`;
}

function maintTableRowHtml(m, options = {}) {
  const placa = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(m.placa) : m.placa;
  const hideMeta = !!options.hideMeta;
  return `
    <tr data-maint-id="${m.id}" data-maint-placa="${escapeHtml(placa)}">
      <td class="maint-col-fecha">${hideMeta ? '' : formatDate(m.fecha)}</td>
      <td class="maint-col-hora"><time datetime="${m.fecha}T${m.hora || '00:00'}">${typeof displayGastoHora === 'function' ? displayGastoHora(m) : formatTime(m.hora)}</time></td>
      <td class="maint-col-placa">${hideMeta ? '' : escapeHtml(placa)}</td>
      <td class="num maint-col-un">${formatMaintUnidad(m.unidad)}</td>
      <td class="maint-col-desc">${escapeHtml(m.descripcion)}</td>
      <td class="num">${formatMoney(m.costoUnit != null ? m.costoUnit : m.monto)}</td>
      <td class="num"><strong>${formatMoney(m.monto)}</strong></td>
      <td class="actions-col">${renderMaintActionButtons(m.id)}</td>
    </tr>`;
}

function maintExpenseGroupCardHtml(group, i = 0) {
  const placa = group.placa || '';
  const productos = (group.gastos || []).map((m) => `
    <li class="maint-expense-group__item" data-maint-id="${m.id}">
      <div class="maint-expense-group__item-main">
        <span class="maint-expense-group__item-name">${escapeHtml(m.descripcion || 'Sin descripción')}</span>
        <span class="maint-expense-group__item-meta">Un. ${formatMaintUnidad(m.unidad)} · ${formatMoney(m.costoUnit != null ? m.costoUnit : m.monto)}</span>
      </div>
      <strong class="maint-expense-group__item-total">${formatMoney(m.monto)}</strong>
      <div class="maint-expense-group__item-actions">
        <button type="button" class="btn btn--action btn--action-edit btn--sm btn--action-icon" title="Editar" aria-label="Editar" onclick="editMantenimiento('${m.id}')">${lucideIcon('square-pen', 'lucide-icon--btn')}</button>
        <button type="button" class="btn btn--action btn--action-delete btn--sm btn--action-icon" title="Eliminar" aria-label="Eliminar" onclick="deleteMantenimiento('${m.id}')">${lucideIcon('trash-2', 'lucide-icon--btn')}</button>
      </div>
    </li>
  `).join('');

  return `
    <article class="maint-expense-card maint-expense-card--group" data-maint-fecha="${escapeHtml(group.fecha)}" data-maint-placa="${escapeHtml(placa)}" style="animation-delay:${i * 0.04}s">
      <div class="maint-expense-card__head">
        <time class="maint-expense-card__when" datetime="${group.fecha}">
          <span class="maint-expense-card__fecha">${formatDate(group.fecha)}</span>
          <span class="maint-expense-card__hora">${escapeHtml(group.horaLabel || '\u2014')}</span>
        </time>
        <span class="maint-expense-card__monto">${formatMoney(group.total)}</span>
      </div>
      <div class="maint-expense-card__meta maint-expense-card__meta--group">
        <span>Placa <strong>${escapeHtml(placa)}</strong></span>
        <span><strong>${group.count}</strong> producto${group.count !== 1 ? 's' : ''}</span>
      </div>
      <ul class="maint-expense-group__list" role="list">
        ${productos}
      </ul>
    </article>`;
}

function renderMaintMobilePage(slice) {
  const groups = Array.isArray(slice) && slice[0]?.gastos
    ? slice
    : groupMantenimientoByFechaPlaca(slice);
  return `<div class="maint-vehicle__cards">${groups.map((g, i) => maintExpenseGroupCardHtml(g, i)).join('')}</div>`;
}

function renderMaintDesktopPage(slice) {
  const groups = Array.isArray(slice) && slice[0]?.gastos
    ? slice
    : groupMantenimientoByFechaPlaca(slice);

  const body = groups.map((g) => {
    const rows = (g.gastos || []).map((m, idx) => maintTableRowHtml(m, { hideMeta: idx > 0 })).join('');
    return `
      <tr class="maint-group-head" data-maint-fecha="${escapeHtml(g.fecha)}" data-maint-placa="${escapeHtml(g.placa)}">
        <td colspan="8">
          <div class="maint-group-head__inner">
            <span><strong>${formatDate(g.fecha)}</strong> · ${escapeHtml(g.placa)} · ${g.count} producto${g.count !== 1 ? 's' : ''}</span>
            <strong>${formatMoney(g.total)}</strong>
          </div>
        </td>
      </tr>
      ${rows}`;
  }).join('');

  return `
    <section class="maint-vehicle maint-vehicle--paged">
      <div class="table-wrapper maint-vehicle__table-wrap">
        <table class="data-table maint-vehicle__table">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>HORA</th>
              <th>PLACA</th>
              <th class="num maint-col-un">UN.</th>
              <th>DESCRIPCIÓN</th>
              <th class="num">COSTO UNIT.</th>
              <th class="num">TOTAL</th>
              <th class="actions-col">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      </div>
    </section>`;
}

function focusMaintPlacaPage(placa) {
  const placaKey = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(placa) : placa;
  const input = $('#maintFilterPlaca');
  if (!input) return;

  // Misma placa otra vez = quitar filtro; otra placa = filtrar tabla
  const next = input.value === placaKey ? '' : placaKey;
  if (typeof setMaintFilterPlacaValue === 'function') {
    setMaintFilterPlacaValue(next);
  } else {
    input.value = next;
  }

  if (typeof updateMaintFilterHint === 'function') updateMaintFilterHint();
  maintPage = 1;
  renderMantenimiento();

  requestAnimationFrame(() => {
    const block = $('#maintHistoryBlock') || $('#maintHistory') || $('#maintCards');
    block?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderMantenimiento() {
  const items = filterMantenimiento();
  // Tarjetas: todas las placas del periodo (fecha); la tabla sí respeta placa
  const itemsForCards = filterMantenimiento({ ignorePlaca: true });
  const groups = groupMantenimientoByPlaca(itemsForCards);
  const history = $('#maintHistory');
  const cards = $('#maintCards');
  const summary = $('#maintSummary');
  const activePlaca = $('#maintFilterPlaca')?.value || '';

  const totalMonto = items.reduce((s, m) => s + m.monto, 0);
  const filteredEmpty = !items.length && (state.mantenimiento || []).length > 0
    && ($('#maintFilterDesde')?.value || $('#maintFilterHasta')?.value || $('#maintFilterPlaca')?.value);

  if (!itemsForCards.length) {
    summary.innerHTML = `<p class="maint-summary-empty">${filteredEmpty ? 'Sin gastos en este periodo' : 'Sin gastos registrados por vehículo'}</p>`;
  } else {
    summary.innerHTML = [...groups]
      .sort((a, b) => b.total - a.total)
      .map((g) => {
        const isActive = activePlaca && g.placa === activePlaca;
        return `
      <button type="button" class="maint-plate-card${isActive ? ' maint-plate-card--active' : ''}" data-scroll-placa="${escapeHtml(g.placa)}" aria-pressed="${isActive ? 'true' : 'false'}">
        <div class="maint-plate-card__placa">${escapeHtml(g.placa)}</div>
        <div class="maint-plate-card__total">${formatMoney(g.total)}</div>
        <div class="maint-plate-card__count">${g.count} gasto${g.count !== 1 ? 's' : ''}</div>
      </button>`;
      }).join('');

    summary.querySelectorAll('[data-scroll-placa]').forEach((btn) => {
      btn.addEventListener('click', () => focusMaintPlacaPage(btn.dataset.scrollPlaca));
    });
  }

  const pageSize = getListPageSize();
  const groupedItems = groupMantenimientoByFechaPlaca(items);
  const meta = paginateItems(groupedItems, maintPage, pageSize);
  maintPage = meta.page;

  if (items.length === 0) {
    const emptyMsg = filteredEmpty
      ? '<p>Sin gastos en este periodo</p><button type="button" class="btn btn--ghost btn--sm" id="maintEmptyClear">Limpiar filtros</button>'
      : '<p>Sin gastos registrados</p>';
    if (history) {
      history.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    }
    if (cards) {
      cards.innerHTML = `<div class="empty-state empty-state--compact">${emptyMsg}</div>`;
    }
    $('#maintEmptyClear')?.addEventListener('click', () => {
      if (typeof clearMaintFilters === 'function') clearMaintFilters();
    });
    renderPagination($('#maintPagination'), { total: 0, page: 1, totalPages: 1, start: 0, end: 0 }, () => {}, pageSize);
  } else {
    if (history) {
      history.innerHTML = renderMaintDesktopPage(meta.slice);
    }
    if (cards) {
      cards.innerHTML = renderMaintMobilePage(meta.slice);
    }
    renderPagination($('#maintPagination'), meta, (page) => {
      maintPage = page;
      renderMantenimiento();
      $('#maintPagination')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, pageSize);
  }

  $('#maintTotalMonto').textContent = formatMoney(totalMonto);
  const maintCount = $('#maintCount');
  if (maintCount) {
    const textEl = maintCount.querySelector('.panel__count__text') || maintCount;
    textEl.textContent = `${items.length} gasto${items.length !== 1 ? 's' : ''} · ${groupedItems.length} día${groupedItems.length !== 1 ? 's' : ''}`;
  }
  const maintWelcomeCount = $('#maintWelcomeCount');
  if (maintWelcomeCount) {
    const period = $('#maintFilterHint')?.textContent;
    const base = items.length
      ? `${items.length} gasto${items.length !== 1 ? 's' : ''} · ${groups.length} vehículo${groups.length !== 1 ? 's' : ''}`
      : 'Sin gastos';
    maintWelcomeCount.textContent = period && items.length ? `${base} · ${period.split(' · ')[0]}` : base;
  }
  refreshLucideIcons();
}

function updateKPIs(ops, maint) {
  const kpiFletes = $('#kpiFletes');
  const kpiGastos = $('#kpiGastos');
  const kpiViajes = $('#kpiViajes');
  if (!kpiFletes && !kpiGastos && !kpiViajes) return;

  const totalFlete = ops.reduce((s, o) => s + o.flete, 0);
  const totalGastosOp = ops.reduce((s, o) => s + o.gastos, 0);
  const totalMaint = maint.reduce((s, m) => s + m.monto, 0);
  const totalGastos = totalGastosOp + totalMaint;

  if (kpiFletes) {
    kpiFletes.textContent = formatMoney(totalFlete);
    animatePop(kpiFletes);
  }
  if (kpiGastos) {
    kpiGastos.textContent = formatMoney(totalGastos);
    animatePop(kpiGastos);
  }
  if (kpiViajes) {
    kpiViajes.textContent = ops.length;
    animatePop(kpiViajes);
  }
}

// ---- Catálogos en selects ----
function updateFiltersBadge() {
  const f = getFilters();
  let count = 0;
  if (f.placa) count++;
  if (f.nombre) count++;
  if (f.chofer) count++;
  if (f.cliente) count++;
  if (f.fecha) count++;
  const badge = $('#filtersBadge');
  if (!badge) return;
  badge.textContent = count;
  badge.hidden = count === 0;
}

function toggleFilters() {
  const section = $('#filtersBar');
  const toggle = $('#filtersToggle');
  const collapsed = section.classList.toggle('filters--collapsed');
  toggle.setAttribute('aria-expanded', String(!collapsed));
}

function populateSelects() {
  const placaOpts = CATALOGOS.placas.map((p) => `<option value="${p}">${p}</option>`).join('');
  const choferOpts = CATALOGOS.choferes.map((c) => `<option value="${c}">${c}</option>`).join('');
  const clienteOpts = CATALOGOS.clientes.map((c) => `<option value="${c}">${c}</option>`).join('');
  const productoOpts = CATALOGOS.productos.map((p) => `<option value="${p}">${p}</option>`).join('');

  const placaEl = $('#filterPlaca');
  if (placaEl) placaEl.innerHTML = '<option value="">Todas</option>' + placaOpts;
  const choferEl = $('#filterChofer');
  if (choferEl) choferEl.innerHTML = '<option value="">Todos</option>' + choferOpts;
  const clienteEl = $('#filterCliente');
  if (clienteEl) clienteEl.innerHTML = '<option value="">Todos</option>' + clienteOpts;

  const nombresViaje = [...new Set([
    ...(CATALOGOS.clientes || []),
    ...(state.campamentos || []).map((c) => c.nombre).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b, 'es'));
  const nombreOpts = nombresViaje.map((n) => `<option value="${n}">${n}</option>`).join('');
  if ($('#filterNombre')) $('#filterNombre').innerHTML = '<option value="">Todos</option>' + nombreOpts;

  $('#dlPlacas') && ($('#dlPlacas').innerHTML = CATALOGOS.placas.map((p) => `<option value="${p}">`).join(''));
  $('#dlChoferes') && ($('#dlChoferes').innerHTML = CATALOGOS.choferes.map((c) => `<option value="${c}">`).join(''));
  $('#dlClientes') && ($('#dlClientes').innerHTML = CATALOGOS.clientes.map((c) => `<option value="${c}">`).join(''));
  $('#dlProductos') && ($('#dlProductos').innerHTML = CATALOGOS.productos.map((p) => `<option value="${p}">`).join(''));
}

function isCampamentoCliente(cliente) {
  return (cliente || '').toLowerCase().includes('campamento igor');
}

function applyClientePreset(cliente, force = false) {
  const preset = CLIENTE_PRESETS[cliente];
  if (!preset) return;

  const setIfEmpty = (id, val) => {
    const el = $(id);
    if (force || !el.value) el.value = val;
  };

  setIfEmpty('#opTarifa', preset.tarifa);
  setIfEmpty('#opFleteBase', preset.fleteBase);
  setIfEmpty('#opGuia', preset.guia);
  setIfEmpty('#opPesaje', preset.pesaje);
  setIfEmpty('#opProducto', preset.producto);
  if (preset.viaticos != null) setIfEmpty('#opViaticos', preset.viaticos);
  if (preset.combustible != null) setIfEmpty('#opCombustible', preset.combustible);
}

function applyPlacaDefaults(placa) {
  const chofer = getChoferByPlaca(placa);
  if (chofer && !$('#opChofer').value) $('#opChofer').value = chofer;
}

function findLastChofer(placa) {
  const op = state.operaciones
    .filter((o) => o.placa === placa)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return op?.chofer || '';
}

function renderCampamentoSummary(ops) {
  const el = $('#campamentoSummary');
  const campamentoOps = ops.filter((op) => isCampamentoCliente(op.cliente));
  if (!campamentoOps.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  const byDate = {};
  campamentoOps.forEach((op) => {
    if (!byDate[op.fecha]) byDate[op.fecha] = [];
    byDate[op.fecha].push(op);
  });

  const cards = Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .map((fecha) => {
      const trips = byDate[fecha];
      const pesoTotal = trips.reduce((s, o) => s + o.peso, 0);
      const guiaTotal = trips.reduce((s, o) => s + o.guia, 0);
      const pesajeTotal = trips.reduce((s, o) => s + o.pesaje, 0);
      const totalPagar = trips.reduce((s, o) => s + o.flete, 0);
      const tarifa = trips[0]?.tarifa || 110;
      const placas = trips.map((o) => o.placa).join(', ');

      return `
        <article class="campamento-card">
          <div class="campamento-card__head">
            <div>
              <div class="campamento-card__title">Campamentos Igor</div>
              <div class="campamento-card__fecha">${formatDate(fecha)} · ${trips.length} camión${trips.length !== 1 ? 'es' : ''}</div>
            </div>
            <div class="campamento-card__total">${formatMoney(totalPagar)}</div>
          </div>
          <div class="campamento-card__grid">
            <div class="campamento-card__item">Tiket o Balanza<strong>${pesoTotal.toFixed(2)} TM</strong></div>
            <div class="campamento-card__item">Guía<strong>${formatMoney(guiaTotal)}</strong></div>
            <div class="campamento-card__item">Pesaje<strong>${formatMoney(pesajeTotal)}</strong></div>
            <div class="campamento-card__item">Placa<strong style="font-size:0.72rem;font-weight:600">${placas}</strong></div>
          </div>
          <div class="campamento-card__formula">
            ${pesoTotal.toFixed(2)} × ${tarifa} + Guía + Pesaje = ${formatMoney(totalPagar)}
          </div>
        </article>`;
    }).join('');

  el.innerHTML = cards;
  el.hidden = false;
}

