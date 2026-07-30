// ---- Init ----
function viajeFormSnapshot() {
  let filas = [];
  try {
    filas = typeof getCampamentoFilasFromDom === 'function' ? getCampamentoFilasFromDom() : [];
  } catch (_) { /* formulario aún no inicializado */ }
  return JSON.stringify({
    id: $('#campId')?.value || '',
    tipo: $('#campTipo')?.value || 'camion',
    nombre: $('#campNombre')?.value || '',
    dniRuc: $('#campDniRuc')?.value || '',
    producto: $('#campProducto')?.value || '',
    fecha: $('#campFecha')?.value || '',
    saldo: $('#campSaldoAnterior')?.value || '',
    tarifa: $('#campTarifa')?.value || '',
    filas
  });
}

function maintFormSnapshot() {
  let items = [];
  try {
    items = typeof getMaintItemsFromDom === 'function' ? getMaintItemsFromDom() : [];
  } catch (_) { /* formulario aún no inicializado */ }
  return JSON.stringify({
    id: $('#maintId')?.value || '',
    editIds: $('#formMantenimiento')?.dataset.editIds || '',
    placa: $('#maintPlaca')?.value || '',
    fecha: $('#maintFecha')?.value || '',
    hora: $('#maintHora')?.value || '',
    items
  });
}

function camionFormSnapshot() {
  return JSON.stringify({
    id: $('#camionId')?.value || '',
    tipo: $('#camionTipo')?.value || 'camion',
    placa: $('#camionPlaca')?.value || '',
    chofer: $('#camionChofer')?.value || '',
    telefono: $('#camionTelefono')?.value || '',
    brevete: $('#camionBrevete')?.value || ''
  });
}

function markViajeFormClean() {
  const form = $('#formCampamento');
  if (form) form.dataset.initialSnapshot = viajeFormSnapshot();
}

function markMaintFormClean() {
  const form = $('#formMantenimiento');
  if (form) form.dataset.initialSnapshot = maintFormSnapshot();
}

function ingresoFormSnapshot() {
  let items = [];
  try {
    items = typeof getIngresoItemsFromDom === 'function' ? getIngresoItemsFromDom() : [];
  } catch (_) { /* formulario aún no inicializado */ }
  return JSON.stringify({
    id: $('#ingresoId')?.value || '',
    editIds: $('#formIngresos')?.dataset.editIds || '',
    placa: $('#ingresoPlaca')?.value || '',
    fecha: $('#ingresoFecha')?.value || '',
    hora: $('#ingresoHora')?.value || '',
    items
  });
}

function markIngresoFormClean() {
  const form = $('#formIngresos');
  if (form) form.dataset.initialSnapshot = ingresoFormSnapshot();
}

function markCamionFormClean() {
  const form = $('#formCamion');
  if (form) form.dataset.initialSnapshot = camionFormSnapshot();
}

function isViajeFormDirty() {
  const initial = $('#formCampamento')?.dataset.initialSnapshot;
  if (initial != null) return initial !== viajeFormSnapshot();
  if ($('#campId')?.value) return true;
  if (($('#campNombre')?.value || '').trim()) return true;
  if (($('#campDniRuc')?.value || '').trim()) return true;
  if (($('#campProducto')?.value || '').trim()) return true;
  if (Number($('#campSaldoAnterior')?.value) > 0) return true;
  try {
    const filas = typeof getCampamentoFilasFromDom === 'function' ? getCampamentoFilasFromDom() : [];
    return filas.some((f) =>
      (f.placa && String(f.placa).trim())
      || Number(f.toneladas) > 0
      || Number(f.precioHora) > 0
      || Number(f.combustible) > 0
      || Number(f.viaticos) > 0
    );
  } catch (_) {
    return false;
  }
}

function isMaintFormDirty() {
  const form = $('#formMantenimiento');
  if (!form) return false;
  if (form.dataset.initialSnapshot != null) {
    return form.dataset.initialSnapshot !== maintFormSnapshot();
  }
  if ($('#maintId')?.value || form.dataset.editIds) return true;
  if (($('#maintPlaca')?.value || '').trim()) return true;
  try {
    const items = typeof getMaintItemsFromDom === 'function' ? getMaintItemsFromDom() : [];
    return items.some((i) => (i.descripcion && String(i.descripcion).trim()) || Number(i.costoUnit) > 0);
  } catch (_) {
    return false;
  }
}

function isIngresoFormDirty() {
  const form = $('#formIngresos');
  if (!form) return false;
  if (form.dataset.initialSnapshot != null) {
    return form.dataset.initialSnapshot !== ingresoFormSnapshot();
  }
  if ($('#ingresoId')?.value || form.dataset.editIds) return true;
  if (($('#ingresoPlaca')?.value || '').trim()) return true;
  try {
    const items = typeof getIngresoItemsFromDom === 'function' ? getIngresoItemsFromDom() : [];
    return items.some((i) => (i.descripcion && String(i.descripcion).trim()) || Number(i.costoUnit) > 0);
  } catch (_) {
    return false;
  }
}

function isCamionFormDirty() {
  const initial = $('#formCamion')?.dataset.initialSnapshot;
  if (initial != null) return initial !== camionFormSnapshot();
  if ($('#camionId')?.value) return true;
  if (($('#camionPlaca')?.value || '').trim()) return true;
  if (($('#camionChofer')?.value || '').trim()) return true;
  if (($('#camionTelefono')?.value || '').trim()) return true;
  if (($('#camionBrevete')?.value || '').trim()) return true;
  return false;
}

async function confirmDiscardModalData() {
  if (typeof showConfirm !== 'function') return true;
  return showConfirm({
    title: '¿Cerrar sin guardar?',
    message: 'Se perderán los datos que aún no guardaste.',
    confirmLabel: 'Cerrar',
    cancelLabel: 'Seguir',
    danger: true
  });
}

async function handleModalClose(id) {
  if (id === 'modalViaje') {
    if (isViajeFormDirty()) {
      const ok = await confirmDiscardModalData();
      if (!ok) return;
    }
    resetViajeForm();
    Mantilla.drafts?.clearViaje?.();
    return;
  }
  if (id === 'modalMantenimiento') {
    if (isMaintFormDirty()) {
      const ok = await confirmDiscardModalData();
      if (!ok) return;
    }
    const form = $('#formMantenimiento');
    if (form) {
      form.reset();
      form.dataset.editIds = '';
      $('#maintId').value = '';
    }
    Mantilla.drafts?.clearGasto?.();
    closeModal(id);
    return;
  }
  if (id === 'modalIngresos') {
    if (isIngresoFormDirty()) {
      const ok = await confirmDiscardModalData();
      if (!ok) return;
    }
    const form = $('#formIngresos');
    if (form) {
      form.reset();
      form.dataset.editIds = '';
      $('#ingresoId').value = '';
    }
    Mantilla.drafts?.clearIngreso?.();
    closeModal(id);
    return;
  }
  if (id === 'modalCamion') {
    if (isCamionFormDirty()) {
      const ok = await confirmDiscardModalData();
      if (!ok) return;
    }
    closeModal(id);
    return;
  }
  if (id === 'modalChoferGastos' && typeof cancelChoferGastosModal === 'function') {
    cancelChoferGastosModal();
    return;
  }
  closeModal(id);
}

function wireModalDelegation() {
  if (wireModalDelegation._wired) return;
  wireModalDelegation._wired = true;

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      e.preventDefault();
      handleModalClose(closeBtn.dataset.close);
      return;
    }

    // Tocar fuera del modal (backdrop) también cierra
    const overlay = e.target.closest('.modal-overlay');
    if (!overlay || !overlay.classList.contains('modal-overlay--open')) return;
    if (e.target !== overlay) return;

    if (overlay.id === 'modalConfirm') {
      finishConfirm(false);
      return;
    }
    if (overlay.id === 'modalWelcome') {
      closeModal(overlay.id);
      return;
    }
    handleModalClose(overlay.id);
  });
}

function wireNavDelegation() {
  if (wireNavDelegation._wired) return;
  wireNavDelegation._wired = true;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-btn[href], .bottom-nav__tab[href]');
    if (link && window.innerWidth < 900) closeSidebar();
  });
}

function goToLiveViaje() {
  if (getPage() === 'viajes' && typeof resetViajeForm === 'function') {
    resetViajeForm();
    if (typeof focusViajeForm === 'function') focusViajeForm();
    $('#campNombre')?.focus();
    return;
  }

  const href = 'viajes.html?live=1';
  if (typeof Mantilla?.navigateTo === 'function') {
    Mantilla.navigateTo(href).then((ok) => {
      if (!ok) location.href = href;
    });
    return;
  }
  location.href = href;
}

function consumeLiveViajeParam() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('live') !== '1' && url.hash !== '#live') return false;
    url.searchParams.delete('live');
    if (url.hash === '#live') url.hash = '';
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

function initShared() {
  $('#dpBackdrop')?.addEventListener('click', () => closeOverlayPickers());

  // Menú, cierre de sidebar y confirm: delegación (SPA reemplaza esos nodos).
  document.addEventListener('click', (e) => {
    const menuButton = e.target.closest('#menuToggle');
    if (menuButton) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if (e.target.closest('#sidebarClose') || e.target.closest('#sidebarBackdrop')) {
      e.preventDefault();
      closeSidebar();
      return;
    }

    if (e.target.closest('#confirmCancel')) {
      e.preventDefault();
      finishConfirm(false);
      return;
    }
    if (e.target.closest('#confirmOk')) {
      e.preventDefault();
      finishConfirm(true);
    }
  });

  document.addEventListener('click', (e) => {
    const liveBtn = e.target.closest('#btnLiveViaje');
    if (!liveBtn) return;
    e.preventDefault();
    if (window.innerWidth < 900 && typeof Mantilla?.openMobileAppTools === 'function') {
      Mantilla.openMobileAppTools();
      return;
    }
    goToLiveViaje();
  });

  wireModalDelegation();
  wireNavDelegation();
  initSidebarDesktop();
  initTopbarProfile();
}

function initViajesPage() {
  if (typeof wireCamionForm === 'function') wireCamionForm();
  // Tras SPA el DOM es nuevo: recrear pickers (evita lag / filtros muertos).
  dpCampFecha = null;
  dpFilterFecha = null;
  campListPlacaPicker = null;
  dpCampListFecha = null;
  const kpiGrid = $('#kpiGrid');
  if (kpiGrid && !kpiGrid.dataset.infoWired) {
    kpiGrid.dataset.infoWired = '1';
    kpiGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-kpi-info]');
      if (!button) return;
      event.preventDefault();
      showKpiInfoModal(button.dataset.kpiInfo);
    });
  }
  if ($('#campFecha') && $('#campFechaPicker')) {
    dpCampFecha = new MantillaDatePicker('#campFecha', '#campFechaPicker', { placeholder: 'dd/mm/aaaa', allowEmpty: false });
    $('#campFecha').addEventListener('change', () => {
      const filas = getCampamentoFilasFromDom();
      renderCampamentoFormFilas(filas.length ? filas : defaultCampamentoFilas($('#campNombre').value, $('#campFecha').value));
    });
  }

  if ($('#filterFecha') && $('#filterFechaPicker')) {
    dpFilterFecha = new MantillaDatePicker('#filterFecha', '#filterFechaPicker', { placeholder: 'Todas las fechas', allowEmpty: true });
  }

  resetViajeForm();
  renderOperaciones();

  if (consumeLiveViajeParam()) {
    focusViajeForm();
    setTimeout(() => $('#campNombre')?.focus(), 80);
  }

  $('#campamentoList')?.addEventListener('click', (e) => {
    const printBtn = e.target.closest('[data-print-camp]');
    if (printBtn) {
      printCampamento(printBtn.dataset.printCamp);
      return;
    }
    const editBtn = e.target.closest('[data-edit-camp]');
    if (editBtn) {
      openViajeForm(editBtn.dataset.editCamp);
      return;
    }
    const delBtn = e.target.closest('[data-delete-camp]');
    if (delBtn) deleteCampamentoById(delBtn.dataset.deleteCamp);
  });

  $('#btnCancelViaje')?.addEventListener('click', () => resetViajeForm());
  const openNewViaje = (e) => {
    e?.preventDefault?.();
    if (getPage() !== 'viajes') return;
    if (typeof openViajeForm === 'function') openViajeForm();
    else if (typeof resetViajeForm === 'function') {
      resetViajeForm();
      focusViajeForm?.();
    }
  };
  $('#btnAddMain')?.addEventListener('click', openNewViaje);
  $('#fabAdd')?.addEventListener('click', openNewViaje);
  $('#btnAddCampFila')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addCampamentoFila();
  });
  $('#campSaldoAnterior')?.addEventListener('input', scheduleRecalcCampamentoForm);
  $('#campTarifa')?.addEventListener('input', scheduleRecalcCampamentoForm);
  wireCampViajesList();
  wireChoferGastosModal();
  wireCampFormDetails();
  wireCampListPanel();

  if (typeof wirePdfPreviewModal === 'function') wirePdfPreviewModal();
  if (typeof wireViajeTutorial === 'function') wireViajeTutorial();

  $('#campNombre')?.addEventListener('input', updateCampBoardHeader);
  $('#campNombre')?.addEventListener('change', () => {
    applyNombreDefaults();
    if (!$('#campId')?.value) applySaldoAutomatico();
  });
  $('#campNombre')?.addEventListener('blur', () => {
    applyNombreDefaults();
    if (!$('#campId')?.value) applySaldoAutomatico();
  });
  $('#formCampamento')?.addEventListener('submit', saveCampamento);

  const formSection = $('#viajeFormSection');
  if (formSection) updateInputWrapStates(formSection);
  updateFiltersBadge();
  refreshLucideIcons();
}

function initMantenimientoPage() {
  // Pickers apuntan al DOM actual (importante tras SPA)
  dpMaintFecha = null;
  tpMaintHora = null;
  maintPlacaPicker = null;

  if (typeof initMaintPlacaPicker === 'function') initMaintPlacaPicker();
  if (typeof wireMaintItemsForm === 'function') wireMaintItemsForm();
  if ($('#maintFecha') && $('#maintFechaPicker')) {
    dpMaintFecha = new MantillaDatePicker('#maintFecha', '#maintFechaPicker', { placeholder: 'dd/mm/aaaa', allowEmpty: false });
  }
  if ($('#maintHora') && $('#maintHoraPicker')) {
    tpMaintHora = new MantillaTimePicker('#maintHora', '#maintHoraPicker', {
      placeholder: 'Elegir hora',
      title: 'Elegir hora'
    });
  }

  if (typeof initMaintFilters === 'function') {
    initMaintFilters();
  } else {
    renderMantenimiento();
  }

  const page = document.body;
  if (!page.dataset.maintActionsWired) {
    page.dataset.maintActionsWired = '1';
    document.addEventListener('click', (e) => {
      if (getPage() !== 'mantenimiento') return;
      const addTrigger = e.target.closest('#btnAddMantenimiento, #btnAddMain, #fabAdd');
      if (addTrigger) {
        e.preventDefault();
        openMantenimientoModal(undefined, { autoFocus: addTrigger.id !== 'fabAdd' });
      }
    });
    document.addEventListener('submit', (e) => {
      if (e.target?.id === 'formMantenimiento') {
        saveMantenimiento(e);
      }
    });
  }
  refreshLucideIcons();
}

function initIngresosExtrasPage() {
  dpIngresoFecha = null;
  tpIngresoHora = null;
  ingresoPlacaPicker = null;

  if (typeof initIngresoPlacaPicker === 'function') initIngresoPlacaPicker();
  if (typeof wireIngresoItemsForm === 'function') wireIngresoItemsForm();
  if ($('#ingresoFecha') && $('#ingresoFechaPicker')) {
    dpIngresoFecha = new MantillaDatePicker('#ingresoFecha', '#ingresoFechaPicker', { placeholder: 'dd/mm/aaaa', allowEmpty: false });
  }
  if ($('#ingresoHora') && $('#ingresoHoraPicker')) {
    tpIngresoHora = new MantillaTimePicker('#ingresoHora', '#ingresoHoraPicker', {
      placeholder: 'Elegir hora',
      title: 'Elegir hora'
    });
  }

  if (typeof initIngresoFilters === 'function') {
    initIngresoFilters();
  } else if (typeof renderIngresosExtras === 'function') {
    renderIngresosExtras();
  }

  const page = document.body;
  if (!page.dataset.ingresoActionsWired) {
    page.dataset.ingresoActionsWired = '1';
    document.addEventListener('click', (e) => {
      if (getPage() !== 'ingresos-extras') return;
      const addTrigger = e.target.closest('#btnAddIngreso, #btnAddMain, #fabAdd');
      if (addTrigger) {
        e.preventDefault();
        openIngresoModal(undefined, { autoFocus: addTrigger.id !== 'fabAdd' });
      }
    });
    document.addEventListener('submit', (e) => {
      if (e.target?.id === 'formIngresos') {
        saveIngreso(e);
      }
    });
  }
  refreshLucideIcons();
}

function initPageForCurrentRoute(options = {}) {
  if (options.reloadData !== false) loadData();
  populateSelects();

  if (getPage() === 'mantenimiento') {
    initMantenimientoPage();
  } else if (getPage() === 'ingresos-extras') {
    initIngresosExtrasPage();
  } else if (getPage() === 'camiones') {
    initCamionesPage();
  } else {
    initViajesPage();
  }

  // La vista no se pinta hasta que todos sus iconos locales sean SVG.
  if (typeof renderLucideIconsNow === 'function') renderLucideIconsNow();
}

function refreshCurrentPage() {
  populateSelects();
  if (getPage() === 'mantenimiento') {
    if (typeof renderMantenimiento === 'function') renderMantenimiento();
  } else if (getPage() === 'ingresos-extras') {
    if (typeof renderIngresosExtras === 'function') renderIngresosExtras();
  } else if (getPage() === 'camiones') {
    if (typeof renderCamionesList === 'function') renderCamionesList();
  } else {
    if (typeof renderOperaciones === 'function') renderOperaciones();
    if (typeof renderCampamentoList === 'function') renderCampamentoList();
  }
  refreshLucideIcons();
}

function init() {
  initShared();
  initPageForCurrentRoute();
  if (window.Mantilla?.activity?.init) Mantilla.activity.init();
  if (window.Mantilla?.drafts?.wire) Mantilla.drafts.wire();
  if (window.Mantilla?.drafts?.restore) {
    setTimeout(() => Mantilla.drafts.restore(), 200);
  }
  if (window.Mantilla?.sync?.init) {
    Mantilla.sync.init().then((result) => {
      if (result?.changed) refreshCurrentPage();
      if (typeof Mantilla.updateOfflineBadge === 'function') {
        Mantilla.updateOfflineBadge();
      }
      if (window.Mantilla?.activity?.init) Mantilla.activity.init();
    }).catch(() => {});
  }
}

window.Mantilla = window.Mantilla || {};
Mantilla.initPageForCurrentRoute = initPageForCurrentRoute;
Mantilla.refreshCurrentPage = refreshCurrentPage;

document.addEventListener('mantilla:datos-servidor', () => refreshCurrentPage());

document.addEventListener('DOMContentLoaded', () => {
  try {
    init();
  } catch (err) {
    console.error('Mantilla init error:', err);
    if (window.Mantilla?.showFatalError) {
      Mantilla.showFatalError('Recarga la página con Ctrl+F5. Si persiste, revisa la consola.');
    } else {
      alert('Error al cargar Mantilla. Recarga la página con Ctrl+F5.');
    }
  }
});
