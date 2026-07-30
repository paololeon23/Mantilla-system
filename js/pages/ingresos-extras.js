// ---- CRUD ----

function defaultIngresoItem() {
  return { id: '', unidad: 1, descripcion: '', costoUnit: '', total: 0 };
}

function ingresoItemFromRecord(m) {
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

function getIngresoGroupByFechaPlaca(fecha, placa) {
  const fechaKey = typeof normalizeDateISO === 'function' ? normalizeDateISO(fecha) : String(fecha || '');
  const placaKey = typeof formatVehiculoDisplay === 'function' ? formatVehiculoDisplay(placa) : String(placa || '');
  return (state.ingresosExtras || [])
    .filter((m) => {
      const mf = typeof normalizeDateISO === 'function' ? normalizeDateISO(m.fecha) : m.fecha;
      const mp = typeof formatVehiculoDisplay === 'function' ? formatVehiculoDisplay(m.placa) : m.placa;
      return mf === fechaKey && mp === placaKey;
    })
    .sort(typeof compareMaintRecords === 'function' ? compareMaintRecords : ((a, b) => 0));
}

function calcIngresoItemTotal(unidad, costoUnit) {
  const u = parseMoneyNumber(unidad);
  const c = parseMoneyNumber(costoUnit);
  if (u <= 0 || c <= 0) return 0;
  return roundMoney(u * c);
}

function getIngresoItemsFromDom() {
  return [...($('#ingresoItemsList')?.querySelectorAll('.maint-item-row') || [])].map((row) => {
    const unidad = parseMoneyNumber(ingresoItemInput(row, 'unidad')?.value) || 0;
    const descripcion = ingresoItemInput(row, 'descripcion')?.value.trim() || '';
    const costoUnit = parseMoneyNumber(ingresoItemInput(row, 'costoUnit')?.value);
    const total = calcIngresoItemTotal(unidad, costoUnit);
    return {
      id: row.dataset.ingresoId || '',
      unidad,
      descripcion,
      costoUnit,
      total
    };
  });
}

function ingresoItemRowHtml(item, index) {
  const num = index + 1;
  const total = calcIngresoItemTotal(item.unidad, item.costoUnit);
  const totalVal = total > 0 ? total.toFixed(2) : '';
  const idAttr = item.id ? ` data-ingreso-id="${escapeHtml(item.id)}"` : '';
  return `
    <article class="maint-item-row" data-row="${index}"${idAttr} role="listitem">
      <span class="maint-item-row__num" aria-hidden="true">${num}</span>
      <div class="maint-item-field maint-item-field--un">
        <label class="maint-item-field__lbl">Unidad</label>
        <input type="number" class="field-input maint-item-input" data-field="unidad" min="0" step="0.01" inputmode="decimal" value="${item.unidad ?? 1}" placeholder="1">
      </div>
      <div class="maint-item-field maint-item-field--cost">
        <label class="maint-item-field__lbl">Importe</label>
        <input type="number" class="field-input maint-item-input" data-field="costoUnit" min="0" step="0.01" inputmode="decimal" value="${item.costoUnit === '' || item.costoUnit == null ? '' : item.costoUnit}" placeholder="0.00">
      </div>
      <div class="maint-item-field maint-item-field--total">
        <label class="maint-item-field__lbl">Total</label>
        <input type="text" class="field-input field-input--calc field-input--readonly maint-item-total" data-field="total" readonly tabindex="-1" aria-readonly="true" value="${totalVal ? formatMoney(total) : 'S/ 0.00'}">
      </div>
      <button type="button" class="maint-item-row__remove" title="Quitar concepto" aria-label="Quitar concepto ${num}">${lucideIcon('x', 'lucide-icon--sm')}</button>
      <div class="maint-item-field maint-item-field--desc">
        <label class="maint-item-field__lbl">Descripción</label>
        <input type="text" class="field-input maint-item-input" data-field="descripcion" value="${String(item.descripcion || '').replace(/"/g, '&quot;')}" placeholder="Ej: Ladrillos / flete extra" autocomplete="off">
      </div>
    </article>`;
}

function ingresoItemInput(row, field) {
  return row?.querySelector(`[data-field="${field}"]`);
}

function getIngresoItemsFromForm() {
  return getIngresoItemsFromDom().filter((item) => item.descripcion && item.total > 0);
}

function recalcIngresoItemRow(row) {
  const unidad = parseMoneyNumber(ingresoItemInput(row, 'unidad')?.value);
  const costoUnit = parseMoneyNumber(ingresoItemInput(row, 'costoUnit')?.value);
  const total = calcIngresoItemTotal(unidad, costoUnit);
  const totalEl = ingresoItemInput(row, 'total');
  if (totalEl) totalEl.value = formatMoney(total);
  row.classList.toggle('maint-item-row--filled', !!(unidad && costoUnit && total));
}

function recalcIngresoItemsForm() {
  const rows = $('#ingresoItemsList')?.querySelectorAll('.maint-item-row') || [];
  let grand = 0;
  rows.forEach((row, i) => {
    recalcIngresoItemRow(row);
    const total = calcIngresoItemTotal(
      ingresoItemInput(row, 'unidad')?.value,
      ingresoItemInput(row, 'costoUnit')?.value
    );
    grand += total;
    const num = row.querySelector('.maint-item-row__num');
    if (num) num.textContent = i + 1;
    row.dataset.row = i;
  });

  const countEl = $('#ingresoItemCount');
  if (countEl) countEl.textContent = String(rows.length);

  const grandEl = $('#ingresoGrandTotal');
  if (grandEl) {
    grandEl.textContent = formatMoney(grand);
    grandEl.classList.toggle('maint-items-grand__val--active', grand > 0);
  }
}

function renderIngresoItems(items) {
  const list = $('#ingresoItemsList');
  if (!list) return;
  const rows = items?.length ? items : [defaultIngresoItem()];
  list.innerHTML = rows.map((item, i) => ingresoItemRowHtml(item, i)).join('');
  recalcIngresoItemsForm();
  refreshLucideIcons();
}

function addIngresoItemRow() {
  const list = $('#ingresoItemsList');
  if (!list) return;
  const items = getIngresoItemsFromDom();
  items.push(defaultIngresoItem());
  renderIngresoItems(items);
  const rows = list.querySelectorAll('.maint-item-row');
  const lastRow = rows[rows.length - 1];
  lastRow?.querySelector('[data-field="descripcion"]')?.focus();
  lastRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function wireIngresoItemsForm() {
  const list = $('#ingresoItemsList');
  if (!list || list.dataset.wired) return;
  list.dataset.wired = '1';

  list.addEventListener('input', (e) => {
    if (!e.target.matches('.maint-item-input')) return;
    const row = e.target.closest('.maint-item-row');
    if (row) recalcIngresoItemRow(row);
    recalcIngresoItemsForm();
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
        detail: 'Debe quedar al menos un concepto en el formulario'
      });
      return;
    }
    const ok = await showConfirm({ message: 'Se quitará este concepto del formulario.' });
    if (!ok) return;
    removeBtn.closest('.maint-item-row')?.remove();
    recalcIngresoItemsForm();
  });

  $('#btnAddIngresoItem')?.addEventListener('click', () => {
    addIngresoItemRow();
  });
}

function setIngresoFormMode(editMode) {
  const addBtn = $('#btnAddIngresoItem');
  const saveBtn = $('#btnSaveIngreso');
  if (addBtn) addBtn.hidden = false;
  if (saveBtn) saveBtn.textContent = editMode ? 'Guardar cambios' : 'Guardar ingresos';
}

function saveIngreso(e) {
  e.preventDefault();

  const placa = formatVehiculoDisplay($('#ingresoPlaca').value.trim());
  if (!placa) {
    showToast({
      title: 'Falta la placa',
      type: 'warning',
      detail: 'Elige un camión registrado'
    });
    return;
  }

  const items = getIngresoItemsFromForm();
  if (!items.length) {
    showToast({
      title: 'Faltan conceptos',
      type: 'warning',
      detail: 'Agrega al menos un concepto con descripción y costo'
    });
    return;
  }

  const fecha = normalizeDateISO($('#ingresoFecha').value) || todayISO();
  const hora = normalizeTime($('#ingresoHora').value) || nowTime();
  const form = $('#formIngresos');
  const editIds = String(form?.dataset?.editIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isEdit = editIds.length > 0 || !!$('#ingresoId')?.value;
  const synced = [];
  const deleted = [];

  if (isEdit) {
    const prevById = new Map((state.ingresosExtras || []).map((m) => [String(m.id), m]));
    const keptIds = new Set();

    items.forEach((item) => {
      const existingId = item.id && editIds.includes(item.id) ? item.id : '';
      const prev = existingId ? prevById.get(String(existingId)) : null;
      const record = {
        id: existingId || uid('ie'),
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
        const idx = state.ingresosExtras.findIndex((m) => m.id === existingId);
        if (idx >= 0) state.ingresosExtras[idx] = record;
        else state.ingresosExtras.push(record);
        keptIds.add(String(existingId));
      } else {
        state.ingresosExtras.push(record);
      }
      synced.push(record);
    });

    editIds.forEach((id) => {
      if (keptIds.has(String(id))) return;
      deleted.push(id);
      state.ingresosExtras = state.ingresosExtras.filter((m) => m.id !== id);
    });

    const grand = synced.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    Mantilla.activity?.log?.({
      title: `Ingresos actualizados · ${placa}`,
      path: `ingresos/${fecha} · ${synced.length} concepto${synced.length !== 1 ? 's' : ''}`,
      type: 'ingreso'
    });
    showToast({
      title: 'Ingresos actualizados',
      detail: alertDetailHtml([
        { b: placa },
        ' · ',
        { b: String(synced.length) },
        ` concepto${synced.length !== 1 ? 's' : ''} · `,
        { b: formatMoney(grand) }
      ])
    });
  } else {
    const grand = items.reduce((s, item) => s + item.total, 0);
    items.forEach((item) => {
      const record = {
        id: uid('ie'),
        placa,
        fecha,
        hora,
        descripcion: item.descripcion,
        unidad: item.unidad,
        costoUnit: item.costoUnit,
        monto: item.total
      };
      state.ingresosExtras.push(record);
      synced.push(record);
    });
    Mantilla.activity?.log?.({
      title: `Ingresos guardados · ${placa}`,
      path: `ingresos/${fecha} · ${items.length} concepto${items.length !== 1 ? 's' : ''}`,
      type: 'ingreso'
    });
    showToast({
      title: 'Ingresos guardados',
      detail: alertDetailHtml([
        { b: placa },
        ' · ',
        { b: String(items.length) },
        ` concepto${items.length !== 1 ? 's' : ''} · `,
        { b: formatMoney(grand) }
      ])
    });
  }

  if (form) {
    form.dataset.editIds = '';
    $('#ingresoId').value = '';
  }

  registerCatalogValue('placas', placa);
  populateIngresoFilterPlacas();

  saveData();
  Mantilla.sync?.syncIngresos?.(synced);
  deleted.forEach((id) => Mantilla.sync?.syncDelete?.('ingresos', id));
  resetIngresoFormState();
  Mantilla.drafts?.clearIngreso?.();
  closeModal('modalIngresos');
  renderIngresosExtras();
  updateKPIs(filterOperaciones(), filterMantenimiento());
}

window.editIngreso = (id) => openIngresoModal(id);
window.deleteIngreso = async (id) => {
  const ok = await showConfirm({
    message: 'Se eliminará este ingreso. Esta acción no se puede deshacer.'
  });
  if (!ok) return;
  const gasto = state.ingresosExtras.find((m) => m.id === id);
  document.querySelectorAll('[data-ingreso-id]').forEach((element) => {
    if (element.dataset.ingresoId === String(id)) markElementDeleting(element);
  });
  Mantilla.sync?.syncDelete?.('ingresos', id);
  await deletingTransition();
  state.ingresosExtras = state.ingresosExtras.filter((m) => m.id !== id);
  resetIngresoFormState();
  Mantilla.drafts?.clearIngreso?.();
  saveData();
  renderIngresosExtras();
  updateKPIs(filterOperaciones(), filterMantenimiento());
  Mantilla.activity?.log?.({
    title: `Ingreso eliminado · ${gasto?.placa || '—'}`,
    path: `ingresos/${gasto?.descripcion || gasto?.fecha || '—'}`,
    type: 'ingreso'
  });
  showToast({
    title: 'Ingreso eliminado',
    type: 'info',
    detail: navigator.onLine
      ? 'Se quitó del historial y se sincroniza con Google'
      : 'Se quitó del historial; se sincronizará al recuperar conexión'
  });
};

// ---- Filtros por fecha ----
let dpIngresoFilterDesde;
let dpIngresoFilterHasta;
let ingresoPlacaPicker;
let ingresoFilterPlacaPicker;

function initIngresoPlacaPicker() {
  const input = $('#ingresoPlaca');
  const mount = $('#ingresoPlacaPicker');
  if (!input || !mount) return;
  // Tras navegación SPA el mount es nuevo: recrear el picker
  if (ingresoPlacaPicker && mount.querySelector('.ms')) return;
  ingresoPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Elegir camión o excavadora',
    title: 'Elegir vehículo',
    searchable: true,
    formatPlaca: false,
    preserveValue: true,
    getOptions: () => getVehiculosPickerOptions(input.value)
  });
}

function setIngresoPlacaValue(placa) {
  const value = placa ? formatVehiculoDisplay(placa) : '';
  if (ingresoPlacaPicker) {
    ingresoPlacaPicker.setValue(value);
  } else if ($('#ingresoPlaca')) {
    $('#ingresoPlaca').value = value;
  }
}

function initIngresoFilterPlacaPicker() {
  const input = $('#ingresoFilterPlaca');
  const mount = $('#ingresoFilterPlacaPicker');
  if (!input || !mount) return;
  if (ingresoFilterPlacaPicker && mount.querySelector('.ms')) return;
  ingresoFilterPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Vehículos',
    title: 'Filtrar por vehículo',
    allowEmpty: true,
    searchable: true,
    formatPlaca: false,
    preserveValue: true,
    getOptions: () => getVehiculosPickerOptions(input.value)
  });
  input.addEventListener('change', onIngresoFilterChange);
}

function setIngresoFilterPlacaValue(placa) {
  const value = placa ? formatVehiculoDisplay(placa) : '';
  if (ingresoFilterPlacaPicker) {
    ingresoFilterPlacaPicker.setValue(value);
  } else if ($('#ingresoFilterPlaca')) {
    $('#ingresoFilterPlaca').value = value;
  }
}

function getIngresoFilters() {
  return {
    placa: $('#ingresoFilterPlaca')?.value || '',
    desde: $('#ingresoFilterDesde')?.value || '',
    hasta: $('#ingresoFilterHasta')?.value || ''
  };
}

function updateIngresoFilterHint() {
  const hint = $('#ingresoFilterHint');
  if (!hint) return;
  const { desde, hasta, placa } = getIngresoFilters();
  const parts = [];
  if (desde && hasta) parts.push(`Del ${formatDate(desde)} al ${formatDate(hasta)}`);
  else if (desde) parts.push(`Desde ${formatDate(desde)}`);
  else if (hasta) parts.push(`Hasta ${formatDate(hasta)}`);
  else parts.push('Elige un rango de fechas');
  if (placa) parts.push(`Placa ${placa}`);
  hint.textContent = parts.join(' · ');
}

function onIngresoFilterChange() {
  updateIngresoFilterHint();
  ingresoPage = 1;
  renderIngresosExtras();
}

function clearIngresoFilters() {
  setIngresoFilterPlacaValue('');
  dpIngresoFilterDesde?.setValue('');
  dpIngresoFilterHasta?.setValue('');
  updateIngresoFilterHint();
  ingresoPage = 1;
  renderIngresosExtras();
}

function populateIngresoFilterPlacas() {
  // El select personalizado carga opciones al abrir; no hace falta rellenar <option>.
  if (ingresoFilterPlacaPicker && typeof ingresoFilterPlacaPicker.updateTrigger === 'function') {
    ingresoFilterPlacaPicker.updateTrigger();
  }
}

function initIngresoFilters() {
  if (!$('#ingresoFiltersBar')) return;

  if ($('#ingresoFilterDesde') && $('#ingresoFilterDesdePicker')) {
    dpIngresoFilterDesde = new MantillaDatePicker('#ingresoFilterDesde', '#ingresoFilterDesdePicker', {
      placeholder: 'Fecha inicio',
      allowEmpty: true
    });
    $('#ingresoFilterDesde').addEventListener('change', onIngresoFilterChange);
  }
  if ($('#ingresoFilterHasta') && $('#ingresoFilterHastaPicker')) {
    dpIngresoFilterHasta = new MantillaDatePicker('#ingresoFilterHasta', '#ingresoFilterHastaPicker', {
      placeholder: 'Fecha fin',
      allowEmpty: true
    });
    $('#ingresoFilterHasta').addEventListener('change', onIngresoFilterChange);
  }

  initIngresoFilterPlacaPicker();

  $('#ingresoBtnClearFilters')?.addEventListener('click', clearIngresoFilters);

  updateIngresoFilterHint();
  wireIngresoListResize();
  renderIngresosExtras();
}

function wireIngresoListResize() {
  if (wireIngresoListResize._wired) return;
  wireIngresoListResize._wired = true;
  let timer;
  let lastPageSize = typeof getListPageSize === 'function' ? getListPageSize() : 4;
  window.addEventListener('resize', () => {
    if (getPage() !== 'ingresos-extras') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = typeof getListPageSize === 'function' ? getListPageSize() : 4;
      if (next === lastPageSize) return;
      lastPageSize = next;
      renderIngresosExtras();
    }, 200);
  });
}
