// ---- Camiones registrados (placa + chofer) ----

function normalizeVehiculoTipo(tipo) {
  return String(tipo || '').toLowerCase() === 'excavadora' ? 'excavadora' : 'camion';
}

let camionTipoPicker;

function buildCamionesFromCatalogos() {
  const byPlaca = new Map();
  (CATALOGOS.placas || []).forEach((raw) => {
    const placa = formatPlacaDisplay(raw);
    if (!placa) return;
    byPlaca.set(placa, {
      id: uid('cam'),
      placa,
      chofer: PLACA_CHOFER[raw] || PLACA_CHOFER[placa] || '',
      telefono: '',
      brevete: '',
      fechaRegistro: todayISO(),
      tipo: 'camion',
      activo: true
    });
  });
  return [...byPlaca.values()].sort((a, b) => a.placa.localeCompare(b.placa, 'es'));
}

function ensureCamionesState() {
  if (!state.camiones) state.camiones = [];
}

function syncCatalogosFromCamiones() {
  ensureCamionesState();
  const placas = (state.camiones || [])
    .filter((c) => c.activo !== false && normalizeVehiculoTipo(c.tipo) === 'camion')
    .map((c) => formatPlacaDisplay(c.placa))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));
  const choferes = [...new Set(
    (state.camiones || []).map((c) => (c.chofer || '').trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'));

  CATALOGOS.placas = placas;
  CATALOGOS.choferes = choferes;
  populateSelects();
}

function getPlacasRegistradas() {
  ensureCamionesState();
  return (state.camiones || [])
    .filter((c) => c.activo !== false && normalizeVehiculoTipo(c.tipo) === 'camion')
    .map((c) => formatPlacaDisplay(c.placa))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function getCamionesPickerOptions() {
  ensureCamionesState();
  return (state.camiones || [])
    .filter((c) => c.activo !== false && normalizeVehiculoTipo(c.tipo) === 'camion')
    .map((c) => ({
      value: formatPlacaDisplay(c.placa),
      placa: formatPlacaDisplay(c.placa),
      chofer: (c.chofer || '').trim()
    }))
    .filter((c) => c.placa)
    .sort((a, b) => a.placa.localeCompare(b.placa, 'es'));
}

function getExcavadorasPickerOptions(currentValue = '') {
  ensureCamionesState();
  const current = String(currentValue || '').trim();
  const options = (state.camiones || [])
    .filter((c) => c.activo !== false && normalizeVehiculoTipo(c.tipo) === 'excavadora')
    .map((c) => ({
      value: String(c.placa || '').trim(),
      placa: String(c.placa || '').trim(),
      chofer: (c.chofer || '').trim()
    }))
    .filter((c) => c.value)
    .sort((a, b) => a.value.localeCompare(b.value, 'es'));
  if (current && !options.some((o) => o.value === current)) {
    options.unshift({ value: current, placa: current, chofer: '' });
  }
  if (!options.length) {
    options.push({ value: 'Excavadora 1', placa: 'Excavadora 1', chofer: '' });
  }
  return options;
}

function formatVehiculoDisplay(value) {
  const raw = String(value || '').trim();
  const vehiculo = (state.camiones || []).find(
    (c) => String(c.placa || '').trim().toLowerCase() === raw.toLowerCase()
  );
  return vehiculo && normalizeVehiculoTipo(vehiculo.tipo) === 'excavadora'
    ? String(vehiculo.placa || '').trim()
    : formatPlacaDisplay(raw);
}

function getVehiculosPickerOptions(currentValue = '') {
  ensureCamionesState();
  const current = String(currentValue || '').trim();
  const options = (state.camiones || [])
    .filter((c) => c.activo !== false)
    .map((c) => {
      const value = normalizeVehiculoTipo(c.tipo) === 'excavadora'
        ? String(c.placa || '').trim()
        : formatPlacaDisplay(c.placa);
      return {
        value,
        placa: value,
        chofer: (c.chofer || '').trim()
      };
    })
    .filter((option) => option.value)
    .sort((a, b) => a.value.localeCompare(b.value, 'es'));

  if (current && !options.some((option) => option.value.toLowerCase() === current.toLowerCase())) {
    options.unshift({
      value: current,
      placa: current,
      chofer: getChoferByPlaca(current) || ''
    });
  }
  return options;
}

function getCamionPlacaPickerOptions(currentValue, excludePlacas = []) {
  let options = getCamionesPickerOptions();
  if (!options.length) {
    options = (typeof getPlacasRegistradas === 'function' ? getPlacasRegistradas() : CATALOGOS.placas)
      .map((p) => ({
        value: formatPlacaDisplay(p),
        placa: formatPlacaDisplay(p),
        chofer: getChoferByPlaca(p)
      }));
  }
  const current = currentValue
    ? formatPlacaDisplay(currentValue)
    : '';
  const exclude = new Set(
    (excludePlacas || []).map((p) => formatPlacaDisplay(p)).filter(Boolean)
  );
  options = options.filter((o) => !exclude.has(o.value) || o.value === current);
  if (current) {
    const exists = options.some((o) => o.value === current);
    if (!exists) {
      options = [{
        value: current,
        placa: current,
        chofer: getChoferByPlaca(current) || ''
      }, ...options];
    }
  }
  return options;
}

function getChoferByPlaca(placa) {
  const raw = String(placa || '').trim();
  const exact = (state.camiones || []).find((c) => String(c.placa || '').trim() === raw);
  if (exact?.chofer) return exact.chofer;
  const key = formatPlacaDisplay(placa);
  const found = (state.camiones || []).find((c) => formatPlacaDisplay(c.placa) === key);
  if (found?.chofer) return found.chofer;
  return PLACA_CHOFER[placa] || PLACA_CHOFER[key] || '';
}

function applyCamionFormTipo(tipo) {
  const excavadora = normalizeVehiculoTipo(tipo) === 'excavadora';
  const tipoInput = $('#camionTipo');
  if (tipoInput) tipoInput.value = excavadora ? 'excavadora' : 'camion';
  camionTipoPicker?.setValue(excavadora ? 'excavadora' : 'camion');
  const placaLabel = document.querySelector('label[for="camionPlaca"]');
  const placaInput = $('#camionPlaca');
  const placaHint = $('#camionPlacaHint');
  const choferLabel = document.querySelector('label[for="camionChofer"]');
  if (placaLabel) placaLabel.textContent = excavadora ? 'Excavadora *' : 'Placa *';
  if (placaInput) {
    placaInput.placeholder = excavadora ? 'Ej: Excavadora 1' : 'Ej: CHM-786';
    placaInput.maxLength = excavadora ? 40 : 7;
    placaInput.setAttribute('autocapitalize', excavadora ? 'sentences' : 'characters');
  }
  if (placaHint) {
    placaHint.textContent = excavadora
      ? 'Nombre o código para distinguirla de otras excavadoras'
      : '7 caracteres con guión (ej: CHM-786, GT5-765)';
  }
  if (choferLabel) choferLabel.textContent = excavadora ? 'Operador *' : 'Chofer *';
}

function openCamionModal(editId) {
  if (typeof closeOverlayPickers === 'function') closeOverlayPickers();

  const form = $('#formCamion');
  if (!form) return;
  form.reset();
  $('#camionId').value = '';

  if (editId) {
    const cam = (state.camiones || []).find((c) => c.id === editId);
    if (!cam) {
      showToast?.({
        title: 'No se pudo editar',
        type: 'warning',
        detail: 'El camión ya no está en el registro'
      });
      return;
    }
    const excavadora = normalizeVehiculoTipo(cam.tipo) === 'excavadora';
    $('#modalCamionEyebrow').textContent = excavadora ? 'Editar excavadora' : 'Editar camión';
    $('#modalCamionTitle').textContent = excavadora ? (cam.placa || 'Excavadora') : formatPlacaDisplay(cam.placa);
    $('#camionId').value = cam.id;
    applyCamionFormTipo(cam.tipo);
    $('#camionPlaca').value = normalizeVehiculoTipo(cam.tipo) === 'excavadora'
      ? (cam.placa || '')
      : formatPlacaDisplay(cam.placa);
    $('#camionChofer').value = cam.chofer || '';
    $('#camionTelefono').value = cam.telefono || '';
    $('#camionBrevete').value = cam.brevete || cam.marca || '';
  } else {
    $('#modalCamionEyebrow').textContent = 'Nuevo vehículo';
    $('#modalCamionTitle').textContent = 'Registrar vehículo';
    applyCamionFormTipo('camion');
  }

  if (typeof markCamionFormClean === 'function') markCamionFormClean();
  openModal('modalCamion');
  refreshLucideIcons();
  updateInputWrapStates(form);
  requestAnimationFrame(() => {
    const focusEl = editId ? $('#camionChofer') : $('#camionPlaca');
    focusEl?.focus();
    focusEl?.select?.();
  });
}

function saveCamion(e) {
  e.preventDefault();
  const tipo = normalizeVehiculoTipo($('#camionTipo')?.value);
  const excavadora = tipo === 'excavadora';
  const placaRaw = $('#camionPlaca').value.trim();
  const placa = excavadora ? placaRaw : normalizePlacaPeru(placaRaw);

  if ((excavadora && !placa) || (!excavadora && !isValidPlacaPeru(placa))) {
    showToast({
      title: excavadora ? 'Falta la excavadora' : 'Placa inválida',
      type: 'warning',
      detail: excavadora ? 'Escribe el nombre o código de la excavadora' : placaPeruHint()
    });
    return;
  }

  const chofer = $('#camionChofer').value.trim();
  if (!chofer) {
    showToast({
      title: 'Falta el chofer',
      type: 'warning',
      detail: excavadora ? 'Escribe el nombre del operador asignado' : 'Escribe el nombre del chofer asignado'
    });
    return;
  }

  const editId = $('#camionId').value;
  const duplicate = (state.camiones || []).find(
    (c) => normalizeVehiculoTipo(c.tipo) === tipo
      && (excavadora ? String(c.placa || '').trim().toLowerCase() : formatPlacaDisplay(c.placa))
        === (excavadora ? placa.toLowerCase() : placa)
      && c.id !== editId
  );
  if (duplicate) {
    showToast({
      title: excavadora ? 'Excavadora ya registrada' : 'Placa ya registrada',
      type: 'warning',
      detail: alertDetailHtml([{ b: placa }, ' ya está en el historial'])
    });
    return;
  }

  const record = {
    id: editId || uid('cam'),
    placa,
    chofer,
    telefono: normalizeTelefono($('#camionTelefono').value),
    brevete: $('#camionBrevete').value.trim(),
    fechaRegistro: editId
      ? ((state.camiones || []).find((c) => c.id === editId)?.fechaRegistro || todayISO())
      : todayISO(),
    tipo,
    activo: true
  };

  const idx = (state.camiones || []).findIndex((c) => c.id === record.id);
  if (idx >= 0) state.camiones[idx] = record;
  else {
    if (!state.camiones) state.camiones = [];
    state.camiones.push(record);
  }

  if (!excavadora) registerCatalogValue('placas', placa);
  registerCatalogValue('choferes', chofer);
  syncCatalogosFromCamiones();
  saveData();
  Mantilla.sync?.syncCamion?.(record);
  closeModal('modalCamion');
  renderCamionesList();
  Mantilla.activity?.log?.({
    title: idx >= 0
      ? `${excavadora ? 'Excavadora' : 'Camión'} actualizado · ${placa}`
      : `${excavadora ? 'Excavadora' : 'Camión'} registrado · ${placa}`,
    path: `camiones/${chofer || 'sin chofer'}`,
    type: excavadora ? 'excavadora' : 'camion'
  });
  showToast({
    title: idx >= 0
      ? (excavadora ? 'Excavadora actualizada' : 'Camión actualizado')
      : (excavadora ? 'Excavadora registrada' : 'Camión registrado'),
    detail: alertDetailHtml([
      { b: placa },
      ' · ',
      { b: chofer }
    ])
  });
}

async function deleteCamionById(id) {
  const cam = (state.camiones || []).find((c) => c.id === id);
  if (!cam) return;
  const ok = await showConfirm({
    message: `Se eliminará el camión ${formatPlacaDisplay(cam.placa)} del registro.`
  });
  if (!ok) return;
  const card = [...document.querySelectorAll('.camion-card')]
    .find((item) => item.dataset.id === String(id));
  markElementDeleting(card);
  Mantilla.sync?.syncDelete?.('camiones', id);
  await deletingTransition();
  state.camiones = (state.camiones || []).filter((c) => c.id !== id);
  syncCatalogosFromCamiones();
  saveData();
  renderCamionesList();
  Mantilla.activity?.log?.({
    title: `Camión eliminado · ${cam.placa || '—'}`,
    path: `camiones/${cam.chofer || 'sin chofer'}`,
    type: 'camion'
  });
  showToast({
    title: 'Vehículo eliminado',
    type: 'info',
    detail: navigator.onLine
      ? 'Se quitó de la lista y se sincroniza con Google'
      : 'Se quitó de la lista; se sincronizará al recuperar conexión'
  });
}

function getCamionesPageSize() {
  return getListPageSize();
}

function renderCamionesList() {
  const list = $('#camionesList');
  const count = $('#camionesCount');
  if (!list) return;

  ensureCamionesState();
  const items = [...(state.camiones || [])]
    .filter((c) => c.activo !== false)
    .sort((a, b) => a.placa.localeCompare(b.placa, 'es'));

  if (count) {
    const textEl = count.querySelector('.panel__count__text') || count;
    textEl.textContent = items.length
      ? `${items.length} vehículo${items.length !== 1 ? 's' : ''}`
      : 'Sin vehículos';
  }

  if (!items.length) {
    list.innerHTML = `
      <div class="camiones-empty">
        <span class="camiones-empty__icon" aria-hidden="true">
          <i data-lucide="truck" class="lucide-icon" aria-hidden="true"></i>
        </span>
        <p class="camiones-empty__title">Sin vehículos registrados</p>
        <p class="camiones-empty__text">Registra un camión o excavadora para usarlo en Viajes y Gastos.</p>
        <button type="button" class="btn btn--primary btn--sm" id="camionesEmptyAdd">+ Registrar vehículo</button>
      </div>`;
    $('#camionesEmptyAdd')?.addEventListener('click', () => openCamionModal());
    renderPagination($('#camionesPagination'), { total: 0, page: 1, totalPages: 1, start: 0, end: 0 }, () => {}, getCamionesPageSize());
    refreshLucideIcons();
    return;
  }

  const pageSize = getCamionesPageSize();
  const meta = paginateItems(items, camionesPage, pageSize);
  camionesPage = meta.page;

  list.innerHTML = meta.slice.map((cam) => `
    <article class="camion-card" data-id="${cam.id}">
      <div class="camion-card__head">
        <span class="camion-card__placa">${escapeHtml(normalizeVehiculoTipo(cam.tipo) === 'excavadora' ? cam.placa : formatPlacaDisplay(cam.placa))}</span>
        <span class="camion-card__fecha">${formatDate(cam.fechaRegistro)}</span>
      </div>
      <div class="camion-card__body">
        <div class="camion-card__row">
          <span class="camion-card__label">${normalizeVehiculoTipo(cam.tipo) === 'excavadora' ? 'Operador' : 'Chofer'}</span>
          <strong class="camion-card__value">${escapeHtml(cam.chofer)}</strong>
        </div>
        ${(cam.brevete || cam.marca) ? `<div class="camion-card__row"><span class="camion-card__label">Brevete</span><span class="camion-card__value">${escapeHtml(cam.brevete || cam.marca)}</span></div>` : ''}
        ${cam.telefono ? `<div class="camion-card__row"><span class="camion-card__label">Teléfono</span><span class="camion-card__value">${escapeHtml(cam.telefono)}</span></div>` : ''}
      </div>
      <div class="camion-card__actions">
        <button type="button" class="btn btn--action btn--action-edit btn--sm btn--icon-text" data-edit-camion="${cam.id}">${ICON_EDIT}</button>
        <button type="button" class="btn btn--action btn--action-delete btn--sm btn--icon-text" data-delete-camion="${cam.id}">${ICON_DELETE}</button>
      </div>
    </article>`).join('');

  renderPagination($('#camionesPagination'), meta, (page) => {
    camionesPage = page;
    renderCamionesList();
    $('#camionesPagination')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, pageSize);
  refreshLucideIcons();
}

function wireCamionPlacaInput() {
  wirePlacaPeruInput($('#camionPlaca'));
  wireTelefonoInput($('#camionTelefono'));
}

function getChoferesCatalogOptions() {
  ensureCamionesState();
  return [...new Set(
    (state.camiones || []).map((c) => (c.chofer || '').trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'));
}

function wireCamionChoferCombo() {
  const input = $('#camionChofer');
  if (!input || input.dataset.comboWired) return;
  input.dataset.comboWired = '1';
  new MantillaCatalogCombo('#camionChofer', {
    title: 'Choferes registrados',
    searchPlaceholder: 'Buscar chofer…',
    getOptions: () => getChoferesCatalogOptions()
  });
}

function initCamionTipoPicker() {
  const input = $('#camionTipo');
  const mount = $('#camionTipoPicker');
  if (!input || !mount) return;
  if (camionTipoPicker && mount.querySelector('.ms')) return;
  camionTipoPicker = new MantillaSelectPicker(input, mount, {
    title: 'Tipo de vehículo',
    searchable: false,
    formatPlaca: false,
    preserveValue: true,
    getOptions: () => [
      { value: 'camion', label: 'Camión' },
      { value: 'excavadora', label: 'Excavadora' }
    ]
  });
}

function wireCamionForm() {
  wireCamionPlacaInput();
  wireCamionChoferCombo();
  initCamionTipoPicker();
  const tipo = $('#camionTipo');
  if (tipo && !tipo.dataset.wired) {
    tipo.dataset.wired = '1';
    tipo.addEventListener('change', () => applyCamionFormTipo(tipo.value));
  }
  const form = $('#formCamion');
  if (form && !form.dataset.wired) {
    form.dataset.wired = '1';
    form.addEventListener('submit', saveCamion);
  }
}

function wireCamionesResize() {
  if (wireCamionesResize._wired) return;
  wireCamionesResize._wired = true;
  let timer;
  let lastPageSize = typeof getListPageSize === 'function' ? getListPageSize() : 4;
  window.addEventListener('resize', () => {
    if (getPage() !== 'camiones') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = typeof getListPageSize === 'function' ? getListPageSize() : 4;
      if (next === lastPageSize) return;
      lastPageSize = next;
      renderCamionesList();
    }, 200);
  });
}

function initCamionesPage() {
  ensureCamionesState();
  renderCamionesList();
  wireCamionForm();
  wireCamionesResize();
  $('#btnAddMain')?.addEventListener('click', () => openCamionModal());
  $('#fabAdd')?.addEventListener('click', () => openCamionModal());
  $('#camionesList')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-camion]');
    if (editBtn) {
      openCamionModal(editBtn.dataset.editCamion);
      return;
    }
    const delBtn = e.target.closest('[data-delete-camion]');
    if (delBtn) deleteCamionById(delBtn.dataset.deleteCamion);
  });
  refreshLucideIcons();
}

window.openCamionModal = openCamionModal;
