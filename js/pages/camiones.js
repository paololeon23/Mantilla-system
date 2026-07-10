// ---- Camiones registrados (placa + chofer) ----

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
      marca: '',
      fechaRegistro: todayISO(),
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
    .filter((c) => c.activo !== false)
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
    .filter((c) => c.activo !== false)
    .map((c) => formatPlacaDisplay(c.placa))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function getCamionesPickerOptions() {
  ensureCamionesState();
  return (state.camiones || [])
    .filter((c) => c.activo !== false)
    .map((c) => ({
      value: formatPlacaDisplay(c.placa),
      placa: formatPlacaDisplay(c.placa),
      chofer: (c.chofer || '').trim()
    }))
    .filter((c) => c.placa)
    .sort((a, b) => a.placa.localeCompare(b.placa, 'es'));
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
  const key = formatPlacaDisplay(placa);
  const found = (state.camiones || []).find((c) => formatPlacaDisplay(c.placa) === key);
  if (found?.chofer) return found.chofer;
  return PLACA_CHOFER[placa] || PLACA_CHOFER[key] || '';
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
    $('#modalCamionEyebrow').textContent = 'Editar camión';
    $('#modalCamionTitle').textContent = formatPlacaDisplay(cam.placa);
    $('#camionId').value = cam.id;
    $('#camionPlaca').value = formatPlacaDisplay(cam.placa);
    $('#camionChofer').value = cam.chofer || '';
    $('#camionTelefono').value = cam.telefono || '';
    $('#camionMarca').value = cam.marca || '';
  } else {
    $('#modalCamionEyebrow').textContent = 'Nuevo camión';
    $('#modalCamionTitle').textContent = 'Registrar vehículo';
  }

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
  const placaRaw = $('#camionPlaca').value;
  const placa = normalizePlacaPeru(placaRaw);

  if (!isValidPlacaPeru(placa)) {
    showToast({
      title: 'Placa inválida',
      type: 'warning',
      detail: placaPeruHint()
    });
    return;
  }

  const chofer = $('#camionChofer').value.trim();
  if (!chofer) {
    showToast({
      title: 'Falta el chofer',
      type: 'warning',
      detail: 'Escribe el nombre del chofer asignado'
    });
    return;
  }

  const editId = $('#camionId').value;
  const duplicate = (state.camiones || []).find(
    (c) => formatPlacaDisplay(c.placa) === placa && c.id !== editId
  );
  if (duplicate) {
    showToast({
      title: 'Placa ya registrada',
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
    marca: $('#camionMarca').value.trim(),
    fechaRegistro: editId
      ? ((state.camiones || []).find((c) => c.id === editId)?.fechaRegistro || todayISO())
      : todayISO(),
    activo: true
  };

  const idx = (state.camiones || []).findIndex((c) => c.id === record.id);
  if (idx >= 0) state.camiones[idx] = record;
  else {
    if (!state.camiones) state.camiones = [];
    state.camiones.push(record);
  }

  registerCatalogValue('placas', placa);
  registerCatalogValue('choferes', chofer);
  syncCatalogosFromCamiones();
  saveData();
  Mantilla.sync?.syncCamion?.(record);
  closeModal('modalCamion');
  renderCamionesList();
  showToast({
    title: idx >= 0 ? 'Camión actualizado' : 'Camión registrado',
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
  Mantilla.sync?.syncDelete?.('camiones', id);
  state.camiones = (state.camiones || []).filter((c) => c.id !== id);
  syncCatalogosFromCamiones();
  saveData();
  renderCamionesList();
  showToast({ title: 'Camión eliminado', type: 'info', detail: 'Quitado del historial' });
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
      ? `${items.length} camión${items.length !== 1 ? 'es' : ''}`
      : 'Sin camiones';
  }

  if (!items.length) {
    list.innerHTML = `
      <div class="camiones-empty">
        <span class="camiones-empty__icon" aria-hidden="true">
          <i data-lucide="truck" class="lucide-icon" aria-hidden="true"></i>
        </span>
        <p class="camiones-empty__title">Sin camiones registrados</p>
        <p class="camiones-empty__text">Registra placa y chofer para usarlos en Viajes y Gastos.</p>
        <button type="button" class="btn btn--primary btn--sm" id="camionesEmptyAdd">+ Registrar camión</button>
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
        <span class="camion-card__placa">${formatPlacaDisplay(cam.placa)}</span>
        <span class="camion-card__fecha">${formatDate(cam.fechaRegistro)}</span>
      </div>
      <div class="camion-card__body">
        <div class="camion-card__row">
          <span class="camion-card__label">Chofer</span>
          <strong class="camion-card__value">${escapeHtml(cam.chofer)}</strong>
        </div>
        ${cam.marca ? `<div class="camion-card__row"><span class="camion-card__label">Marca</span><span class="camion-card__value">${escapeHtml(cam.marca)}</span></div>` : ''}
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

function wireCamionForm() {
  wireCamionPlacaInput();
  wireCamionChoferCombo();
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
  window.addEventListener('resize', () => {
    if (getPage() !== 'camiones') return;
    clearTimeout(timer);
    timer = setTimeout(renderCamionesList, 150);
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
