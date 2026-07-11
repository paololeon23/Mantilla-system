// ---- CRUD ----

function defaultMaintItem() {
  return { id: '', unidad: 1, descripcion: '', costoUnit: '', total: 0 };
}

function maintItemFromRecord(m) {
  const unidad = Number(m.unidad) > 0 ? Number(m.unidad) : 1;
  const costoUnit = m.costoUnit != null ? m.costoUnit : (unidad > 0 ? (Number(m.monto) || 0) / unidad : m.monto);
  return {
    id: m.id || '',
    unidad,
    descripcion: m.descripcion || '',
    costoUnit: costoUnit === '' ? '' : costoUnit,
    total: Number(m.monto) || 0,
    horaRegistro: m.horaRegistro || ''
  };
}

function getMaintGroupByFechaPlaca(fecha, placa) {
  const fechaKey = typeof normalizeDateISO === 'function' ? normalizeDateISO(fecha) : String(fecha || '');
  const placaKey = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(placa) : String(placa || '');
  return (state.mantenimiento || [])
    .filter((m) => {
      const mf = typeof normalizeDateISO === 'function' ? normalizeDateISO(m.fecha) : m.fecha;
      const mp = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(m.placa) : m.placa;
      return mf === fechaKey && mp === placaKey;
    })
    .sort(typeof compareMaintRecords === 'function' ? compareMaintRecords : ((a, b) => 0));
}

function calcMaintItemTotal(unidad, costoUnit) {
  const u = parseMoneyNumber(unidad);
  const c = parseMoneyNumber(costoUnit);
  if (u <= 0 || c <= 0) return 0;
  return roundMoney(u * c);
}

function getMaintItemsFromDom() {
  return [...($('#maintItemsList')?.querySelectorAll('.maint-item-row') || [])].map((row) => {
    const unidad = parseMoneyNumber(maintItemInput(row, 'unidad')?.value) || 0;
    const descripcion = maintItemInput(row, 'descripcion')?.value.trim() || '';
    const costoUnit = parseMoneyNumber(maintItemInput(row, 'costoUnit')?.value);
    const total = calcMaintItemTotal(unidad, costoUnit);
    return {
      id: row.dataset.maintId || '',
      unidad,
      descripcion,
      costoUnit,
      total
    };
  });
}

function maintItemRowHtml(item, index) {
  const num = index + 1;
  const total = calcMaintItemTotal(item.unidad, item.costoUnit);
  const totalVal = total > 0 ? total.toFixed(2) : '';
  const idAttr = item.id ? ` data-maint-id="${escapeHtml(item.id)}"` : '';
  return `
    <article class="maint-item-row" data-row="${index}"${idAttr} role="listitem">
      <span class="maint-item-row__num" aria-hidden="true">${num}</span>
      <div class="maint-item-field maint-item-field--un">
        <label class="maint-item-field__lbl">Unidad</label>
        <input type="number" class="field-input maint-item-input" data-field="unidad" min="0" step="0.01" inputmode="decimal" value="${item.unidad ?? 1}" placeholder="1">
      </div>
      <div class="maint-item-field maint-item-field--cost">
        <label class="maint-item-field__lbl">Costo</label>
        <input type="number" class="field-input maint-item-input" data-field="costoUnit" min="0" step="0.01" inputmode="decimal" value="${item.costoUnit === '' || item.costoUnit == null ? '' : item.costoUnit}" placeholder="0.00">
      </div>
      <div class="maint-item-field maint-item-field--total">
        <label class="maint-item-field__lbl">Total</label>
        <input type="text" class="field-input field-input--calc field-input--readonly maint-item-total" data-field="total" readonly tabindex="-1" aria-readonly="true" value="${totalVal ? formatMoney(total) : 'S/ 0.00'}">
      </div>
      <button type="button" class="maint-item-row__remove" title="Quitar producto" aria-label="Quitar producto ${num}">${lucideIcon('x', 'lucide-icon--sm')}</button>
      <div class="maint-item-field maint-item-field--desc">
        <label class="maint-item-field__lbl">Descripción</label>
        <input type="text" class="field-input maint-item-input" data-field="descripcion" value="${String(item.descripcion || '').replace(/"/g, '&quot;')}" placeholder="Ej: Llantas posterior" autocomplete="off">
      </div>
    </article>`;
}

function maintItemInput(row, field) {
  return row?.querySelector(`[data-field="${field}"]`);
}

function getMaintItemsFromForm() {
  return getMaintItemsFromDom().filter((item) => item.descripcion && item.total > 0);
}

function recalcMaintItemRow(row) {
  const unidad = parseMoneyNumber(maintItemInput(row, 'unidad')?.value);
  const costoUnit = parseMoneyNumber(maintItemInput(row, 'costoUnit')?.value);
  const total = calcMaintItemTotal(unidad, costoUnit);
  const totalEl = maintItemInput(row, 'total');
  if (totalEl) totalEl.value = formatMoney(total);
  row.classList.toggle('maint-item-row--filled', !!(unidad && costoUnit && total));
}

function recalcMaintItemsForm() {
  const rows = $('#maintItemsList')?.querySelectorAll('.maint-item-row') || [];
  let grand = 0;
  rows.forEach((row, i) => {
    recalcMaintItemRow(row);
    const total = calcMaintItemTotal(
      maintItemInput(row, 'unidad')?.value,
      maintItemInput(row, 'costoUnit')?.value
    );
    grand += total;
    const num = row.querySelector('.maint-item-row__num');
    if (num) num.textContent = i + 1;
    row.dataset.row = i;
  });

  const countEl = $('#maintItemCount');
  if (countEl) countEl.textContent = String(rows.length);

  const grandEl = $('#maintGrandTotal');
  if (grandEl) {
    grandEl.textContent = formatMoney(grand);
    grandEl.classList.toggle('maint-items-grand__val--active', grand > 0);
  }
}

function renderMaintItems(items) {
  const list = $('#maintItemsList');
  if (!list) return;
  const rows = items?.length ? items : [defaultMaintItem()];
  list.innerHTML = rows.map((item, i) => maintItemRowHtml(item, i)).join('');
  recalcMaintItemsForm();
  refreshLucideIcons();
}

function addMaintItemRow() {
  const list = $('#maintItemsList');
  if (!list) return;
  const items = getMaintItemsFromDom();
  items.push(defaultMaintItem());
  renderMaintItems(items);
  const rows = list.querySelectorAll('.maint-item-row');
  const lastRow = rows[rows.length - 1];
  lastRow?.querySelector('[data-field="descripcion"]')?.focus();
  lastRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function wireMaintItemsForm() {
  const list = $('#maintItemsList');
  if (!list || list.dataset.wired) return;
  list.dataset.wired = '1';

  list.addEventListener('input', (e) => {
    if (!e.target.matches('.maint-item-input')) return;
    const row = e.target.closest('.maint-item-row');
    if (row) recalcMaintItemRow(row);
    recalcMaintItemsForm();
  });

  list.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.maint-item-row__remove');
    if (!removeBtn) return;
    e.preventDefault();
    const rows = list.querySelectorAll('.maint-item-row');
    if (rows.length <= 1) {
      showToast({
        title: 'Acción no permitida',
        type: 'warning',
        detail: 'Debe quedar al menos un producto en el formulario'
      });
      return;
    }
    const ok = await showConfirm({ message: 'Se quitará este producto del formulario.' });
    if (!ok) return;
    removeBtn.closest('.maint-item-row')?.remove();
    recalcMaintItemsForm();
  });

  $('#btnAddMaintItem')?.addEventListener('click', () => {
    addMaintItemRow();
  });
}

function setMaintFormMode(editMode) {
  const addBtn = $('#btnAddMaintItem');
  const saveBtn = $('#btnSaveMantenimiento');
  if (addBtn) addBtn.hidden = false;
  if (saveBtn) saveBtn.textContent = editMode ? 'Guardar cambios' : 'Guardar gastos';
}

function saveMantenimiento(e) {
  e.preventDefault();

  const placa = formatPlacaDisplay($('#maintPlaca').value.trim());
  if (!placa) {
    showToast({
      title: 'Falta la placa',
      type: 'warning',
      detail: 'Elige un camión registrado'
    });
    return;
  }

  const items = getMaintItemsFromForm();
  if (!items.length) {
    showToast({
      title: 'Faltan productos',
      type: 'warning',
      detail: 'Agrega al menos un producto con descripción y costo'
    });
    return;
  }

  const fecha = normalizeDateISO($('#maintFecha').value) || todayISO();
  const hora = normalizeTime($('#maintHora').value) || nowTime();
  const form = $('#formMantenimiento');
  const editIds = String(form?.dataset?.editIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isEdit = editIds.length > 0 || !!$('#maintId')?.value;
  const synced = [];
  const deleted = [];

  if (isEdit) {
    const prevById = new Map((state.mantenimiento || []).map((m) => [String(m.id), m]));
    const keptIds = new Set();

    items.forEach((item) => {
      const existingId = item.id && editIds.includes(item.id) ? item.id : '';
      const prev = existingId ? prevById.get(String(existingId)) : null;
      const record = {
        id: existingId || uid('mt'),
        placa,
        fecha,
        hora,
        descripcion: item.descripcion,
        unidad: item.unidad,
        costoUnit: item.costoUnit,
        monto: item.total,
        horaRegistro: prev?.horaRegistro || ''
      };
      if (existingId) {
        const idx = state.mantenimiento.findIndex((m) => m.id === existingId);
        if (idx >= 0) state.mantenimiento[idx] = record;
        else state.mantenimiento.push(record);
        keptIds.add(String(existingId));
      } else {
        state.mantenimiento.push(record);
      }
      synced.push(record);
    });

    editIds.forEach((id) => {
      if (keptIds.has(String(id))) return;
      deleted.push(id);
      state.mantenimiento = state.mantenimiento.filter((m) => m.id !== id);
    });

    const grand = synced.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    Mantilla.activity?.log?.({
      title: `Gastos actualizados · ${placa}`,
      path: `gastos/${fecha} · ${synced.length} producto${synced.length !== 1 ? 's' : ''}`,
      type: 'gasto'
    });
    showToast({
      title: 'Gastos actualizados',
      detail: alertDetailHtml([
        { b: placa },
        ' · ',
        { b: String(synced.length) },
        ` producto${synced.length !== 1 ? 's' : ''} · `,
        { b: formatMoney(grand) }
      ])
    });
  } else {
    const grand = items.reduce((s, item) => s + item.total, 0);
    items.forEach((item) => {
      const record = {
        id: uid('mt'),
        placa,
        fecha,
        hora,
        descripcion: item.descripcion,
        unidad: item.unidad,
        costoUnit: item.costoUnit,
        monto: item.total
      };
      state.mantenimiento.push(record);
      synced.push(record);
    });
    Mantilla.activity?.log?.({
      title: `Gastos guardados · ${placa}`,
      path: `gastos/${fecha} · ${items.length} producto${items.length !== 1 ? 's' : ''}`,
      type: 'gasto'
    });
    showToast({
      title: 'Gastos guardados',
      detail: alertDetailHtml([
        { b: placa },
        ' · ',
        { b: String(items.length) },
        ` producto${items.length !== 1 ? 's' : ''} · `,
        { b: formatMoney(grand) }
      ])
    });
  }

  if (form) {
    form.dataset.editIds = '';
    $('#maintId').value = '';
  }

  registerCatalogValue('placas', placa);
  populateMaintFilterPlacas();

  saveData();
  Mantilla.sync?.syncGastos?.(synced);
  deleted.forEach((id) => Mantilla.sync?.syncDelete?.('gastos', id));
  Mantilla.drafts?.clearGasto?.();
  closeModal('modalMantenimiento');
  renderMantenimiento();
  updateKPIs(filterOperaciones(), filterMantenimiento());
}

window.editOperacion = (id) => {
  const op = state.operaciones.find((o) => o.id === id);
  if (op?.campamentoId) {
    openViajeForm(op.campamentoId);
    return;
  }
};
window.deleteOperacion = async (id) => {
  const ok = await showConfirm({
    message: 'Se eliminará este registro de operaciones. Esta acción no se puede deshacer.'
  });
  if (!ok) return;

  const op = state.operaciones.find((o) => o.id === id);
  if (op?.campamentoId) {
    const camp = state.campamentos.find((c) => c.id === op.campamentoId);
    if (camp) {
      camp.filas = camp.filas.filter((f) => !(f.placa === op.placa && f.toneladas === op.peso));
      if (!camp.filas.length) {
        state.campamentos = state.campamentos.filter((c) => c.id !== camp.id);
        state.operaciones = state.operaciones.filter((o) => o.campamentoId !== camp.id);
      } else {
        syncOperacionesFromCampamento(camp);
      }
    }
  } else {
    state.operaciones = state.operaciones.filter((o) => o.id !== id);
  }

  saveData();
  renderOperaciones();
  renderCampamentoList();
  showToast({
    title: 'Registro eliminado',
    type: 'info',
    detail: 'El registro fue quitado de la lista'
  });
};

window.editMantenimiento = (id) => openMantenimientoModal(id);
window.deleteMantenimiento = async (id) => {
  const ok = await showConfirm({
    message: 'Se eliminará este gasto. Esta acción no se puede deshacer.'
  });
  if (!ok) return;
  const gasto = state.mantenimiento.find((m) => m.id === id);
  Mantilla.sync?.syncDelete?.('gastos', id);
  state.mantenimiento = state.mantenimiento.filter((m) => m.id !== id);
  saveData();
  renderMantenimiento();
  updateKPIs(filterOperaciones(), filterMantenimiento());
  Mantilla.activity?.log?.({
    title: `Gasto eliminado · ${gasto?.placa || '—'}`,
    path: `gastos/${gasto?.descripcion || gasto?.fecha || '—'}`,
    type: 'gasto'
  });
  showToast({
    title: 'Gasto eliminado',
    type: 'info',
    detail: 'El gasto fue quitado del historial'
  });
};

// ---- Filtros por fecha ----
let dpMaintFilterDesde;
let dpMaintFilterHasta;
let maintPlacaPicker;
let maintFilterPlacaPicker;

function initMaintPlacaPicker() {
  const input = $('#maintPlaca');
  const mount = $('#maintPlacaPicker');
  if (!input || !mount) return;
  // Tras navegación SPA el mount es nuevo: recrear el picker
  if (maintPlacaPicker && mount.querySelector('.ms')) return;
  maintPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Elegir placa',
    title: 'Placa del camión',
    getOptions: () => getCamionPlacaPickerOptions(input.value)
  });
}

function setMaintPlacaValue(placa) {
  const value = placa ? formatPlacaDisplay(placa) : '';
  if (maintPlacaPicker) {
    maintPlacaPicker.setValue(value);
  } else if ($('#maintPlaca')) {
    $('#maintPlaca').value = value;
  }
}

function initMaintFilterPlacaPicker() {
  const input = $('#maintFilterPlaca');
  const mount = $('#maintFilterPlacaPicker');
  if (!input || !mount) return;
  if (maintFilterPlacaPicker && mount.querySelector('.ms')) return;
  maintFilterPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Todas las placas',
    title: 'Filtrar por placa',
    allowEmpty: true,
    searchable: true,
    getOptions: () => getCamionPlacaPickerOptions(input.value)
  });
  input.addEventListener('change', onMaintFilterChange);
}

function setMaintFilterPlacaValue(placa) {
  const value = placa ? formatPlacaDisplay(placa) : '';
  if (maintFilterPlacaPicker) {
    maintFilterPlacaPicker.setValue(value);
  } else if ($('#maintFilterPlaca')) {
    $('#maintFilterPlaca').value = value;
  }
}

function getMaintFilters() {
  return {
    placa: $('#maintFilterPlaca')?.value || '',
    desde: $('#maintFilterDesde')?.value || '',
    hasta: $('#maintFilterHasta')?.value || ''
  };
}

function updateMaintFilterHint() {
  const hint = $('#maintFilterHint');
  if (!hint) return;
  const { desde, hasta, placa } = getMaintFilters();
  const parts = [];
  if (desde && hasta) parts.push(`Del ${formatDate(desde)} al ${formatDate(hasta)}`);
  else if (desde) parts.push(`Desde ${formatDate(desde)}`);
  else if (hasta) parts.push(`Hasta ${formatDate(hasta)}`);
  else parts.push('Elige un rango de fechas');
  if (placa) parts.push(`Placa ${placa}`);
  hint.textContent = parts.join(' · ');
}

function onMaintFilterChange() {
  updateMaintFilterHint();
  maintPage = 1;
  renderMantenimiento();
}

function clearMaintFilters() {
  setMaintFilterPlacaValue('');
  dpMaintFilterDesde?.setValue('');
  dpMaintFilterHasta?.setValue('');
  updateMaintFilterHint();
  maintPage = 1;
  renderMantenimiento();
}

function populateMaintFilterPlacas() {
  // El select personalizado carga opciones al abrir; no hace falta rellenar <option>.
  if (maintFilterPlacaPicker && typeof maintFilterPlacaPicker.updateTrigger === 'function') {
    maintFilterPlacaPicker.updateTrigger();
  }
}

function initMaintFilters() {
  if (!$('#maintFiltersBar')) return;

  if ($('#maintFilterDesde') && $('#maintFilterDesdePicker')) {
    dpMaintFilterDesde = new MantillaDatePicker('#maintFilterDesde', '#maintFilterDesdePicker', {
      placeholder: 'Fecha inicio',
      allowEmpty: true
    });
    $('#maintFilterDesde').addEventListener('change', onMaintFilterChange);
  }
  if ($('#maintFilterHasta') && $('#maintFilterHastaPicker')) {
    dpMaintFilterHasta = new MantillaDatePicker('#maintFilterHasta', '#maintFilterHastaPicker', {
      placeholder: 'Fecha fin',
      allowEmpty: true
    });
    $('#maintFilterHasta').addEventListener('change', onMaintFilterChange);
  }

  initMaintFilterPlacaPicker();

  $('#maintBtnClearFilters')?.addEventListener('click', clearMaintFilters);

  updateMaintFilterHint();
  wireMaintListResize();
  renderMantenimiento();
}

function wireMaintListResize() {
  if (wireMaintListResize._wired) return;
  wireMaintListResize._wired = true;
  let timer;
  let lastPageSize = typeof getListPageSize === 'function' ? getListPageSize() : 4;
  window.addEventListener('resize', () => {
    if (getPage() !== 'mantenimiento') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = typeof getListPageSize === 'function' ? getListPageSize() : 4;
      if (next === lastPageSize) return;
      lastPageSize = next;
      renderMantenimiento();
    }, 200);
  });
}
