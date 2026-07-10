// ---- Init ----
function handleModalClose(id) {
  if (id === 'modalViaje') {
    resetViajeForm();
    return;
  }
  if (id === 'modalChoferGastos' && typeof cancelChoferGastosModal === 'function') {
    cancelChoferGastosModal();
  }
  closeModal(id);
}

function wireModalDelegation() {
  if (wireModalDelegation._wired) return;
  wireModalDelegation._wired = true;

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      handleModalClose(closeBtn.dataset.close);
      return;
    }

    const overlay = e.target.closest('.modal-overlay');
    if (!overlay || e.target !== overlay) return;

    if (overlay.id === 'modalConfirm') {
      finishConfirm(false);
      return;
    }
    if (overlay.id === 'modalViaje') {
      resetViajeForm();
      return;
    }
    if (overlay.id === 'modalChoferGastos' && typeof cancelChoferGastosModal === 'function') {
      cancelChoferGastosModal();
      return;
    }
    closeModal(overlay.id);
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

  $('#confirmCancel')?.addEventListener('click', () => finishConfirm(false));
  $('#confirmOk')?.addEventListener('click', () => finishConfirm(true));

  $('#menuToggle')?.addEventListener('click', toggleSidebar);
  $('#sidebarClose')?.addEventListener('click', closeSidebar);
  $('#sidebarBackdrop')?.addEventListener('click', closeSidebar);

  document.addEventListener('click', (e) => {
    const liveBtn = e.target.closest('#btnLiveViaje');
    if (!liveBtn) return;
    e.preventDefault();
    goToLiveViaje();
  });

  wireModalDelegation();
  wireNavDelegation();
  initSidebarDesktop();
  initTopbarProfile();
}

function initViajesPage() {
  if (typeof wireCamionForm === 'function') wireCamionForm();
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
  $('#btnAddMain')?.addEventListener('click', () => openCamionModal());
  $('#btnAddCampFila')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    addCampamentoFila();
  });
  $('#campSaldoAnterior')?.addEventListener('input', scheduleRecalcCampamentoForm);
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

  $('#btnAddMantenimiento')?.addEventListener('click', () => openMantenimientoModal());
  $('#btnAddMain')?.addEventListener('click', () => openMantenimientoModal());
  $('#fabAdd')?.addEventListener('click', () => openMantenimientoModal());
  $('#formMantenimiento')?.addEventListener('submit', saveMantenimiento);
  refreshLucideIcons();
}

function initPageForCurrentRoute() {
  loadData();
  populateSelects();

  if (getPage() === 'mantenimiento') {
    initMantenimientoPage();
  } else if (getPage() === 'camiones') {
    initCamionesPage();
  } else {
    initViajesPage();
  }
}

function refreshCurrentPage() {
  populateSelects();
  if (getPage() === 'mantenimiento') {
    if (typeof renderMantenimiento === 'function') renderMantenimiento();
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
  if (window.Mantilla?.sync?.init) {
    Mantilla.sync.init().then((result) => {
      if (result?.changed) refreshCurrentPage();
      if (typeof Mantilla.updateOfflineBadge === 'function') {
        Mantilla.updateOfflineBadge();
      }
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
