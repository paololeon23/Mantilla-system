// ---- Modales ----
function openModal(id) {
  closeOverlayPickers();
  const backdrop = document.getElementById('dpBackdrop');
  if (backdrop) backdrop.hidden = true;
  $(`#${id}`)?.classList.add('modal-overlay--open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(`#${id}`)?.classList.remove('modal-overlay--open');
  if (id === 'modalViaje') {
    const form = $('#viajeFormSection');
    const slot = $('#viajeFormSlot');
    if (form && slot && !slot.contains(form)) slot.appendChild(form);
  }
  const openModals = $$('.modal-overlay--open');
  if (!openModals.length) document.body.style.overflow = '';
}

let confirmResolve = null;

function finishConfirm(result) {
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(result);
  }
  $(`#modalConfirm`).classList.remove('modal-overlay--open');
  const openModals = $$('.modal-overlay--open');
  if (!openModals.length) document.body.style.overflow = '';
}

function closeMantillaAlert() {
  if (typeof Swal !== 'undefined' && Swal.isVisible()) Swal.close();
}

function mantillaConfirmIconHtml() {
  return `<div class="mantilla-swal__status-icon mantilla-swal__status-icon--warning" aria-hidden="true">${lucideIcon('triangle-alert', 'lucide-icon--alert')}</div>`;
}

function showConfirm({
  title = '¿Seguro que deseas eliminar?',
  message = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true
}) {
  if (typeof Swal !== 'undefined') {
    closeMantillaAlert();
    return Swal.fire({
      icon: false,
      title: ' ',
      html: `
        <div class="mantilla-swal__stack mantilla-swal__stack--confirm">
          ${mantillaConfirmIconHtml()}
          <h2 class="mantilla-swal__title mantilla-swal__title--inline">${escapeHtml(title)}</h2>
          <p class="mantilla-swal__detail mantilla-swal__detail--confirm">${escapeHtml(message)}</p>
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: confirmLabel,
      cancelButtonText: cancelLabel,
      reverseButtons: true,
      focusCancel: true,
      allowOutsideClick: true,
      allowEscapeKey: true,
      heightAuto: true,
      customClass: {
        container: 'mantilla-swal-container',
        popup: 'mantilla-swal mantilla-swal--confirm',
        title: 'mantilla-swal__title mantilla-swal__title--hidden',
        htmlContainer: 'mantilla-swal__detail-wrap',
        confirmButton: danger ? 'mantilla-swal__btn mantilla-swal__btn--danger' : 'mantilla-swal__btn mantilla-swal__btn--confirm',
        cancelButton: 'mantilla-swal__btn mantilla-swal__btn--cancel'
      },
      buttonsStyling: false,
      showClass: { popup: 'mantilla-swal-show', backdrop: 'mantilla-swal-backdrop-show' },
      hideClass: { popup: 'mantilla-swal-hide', backdrop: 'mantilla-swal-backdrop-hide' },
      didOpen: () => {
        if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
      }
    }).then((result) => result.isConfirmed);
  }

  return new Promise((resolve) => {
    if (confirmResolve) finishConfirm(false);

    confirmResolve = resolve;
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmCancel').textContent = cancelLabel;
    const okBtn = $('#confirmOk');
    okBtn.textContent = confirmLabel;
    okBtn.className = danger ? 'btn btn--confirm-delete' : 'btn btn--secondary';

    closeOverlayPickers();
    openModal('modalConfirm');
  });
}

function resetViajeForm() {
  const campId = $('#campId');
  if (!campId) return;

  campId.value = '';
  const nombre = $('#campNombre');
  if (nombre) nombre.value = '';
  const saldo = $('#campSaldoAnterior');
  if (saldo) saldo.value = '0';
  const tarifa = $('#campTarifa');
  if (tarifa) tarifa.value = '110';
  const title = $('#viajeFormTitle');
  if (title) title.textContent = 'Agregar viajes del d\u00eda';
  $('#btnCancelViaje')?.setAttribute('hidden', '');
  dpCampFecha?.setValue(todayISO());
  if (typeof clearCampFormDetails === 'function') clearCampFormDetails();
  if (typeof renderCampamentoFormFilas === 'function') {
    renderCampamentoFormFilas(defaultCampamentoFilas('', todayISO()));
  }
  if (typeof updateCampCamionesLock === 'function') updateCampCamionesLock();
  if (typeof updateCampBoardHeader === 'function') updateCampBoardHeader();
  if (typeof recalcCampamentoForm === 'function') recalcCampamentoForm();
  restoreViajeFormInline();
}

function focusViajeForm() {
  const section = $('#viajeFormSection');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  section?.classList.add('viaje-form-card--focus');
  setTimeout(() => section?.classList.remove('viaje-form-card--focus'), 1200);
}

function mountViajeFormInModal() {
  const form = $('#viajeFormSection');
  const body = $('#modalViajeBody');
  if (!form || !body) return;
  body.appendChild(form);
  openModal('modalViaje');
  refreshLucideIcons();
  updateInputWrapStates(form);
  $('#campNombre')?.focus();
}

function restoreViajeFormInline() {
  const form = $('#viajeFormSection');
  const slot = $('#viajeFormSlot');
  if (form && slot && !slot.contains(form)) {
    slot.appendChild(form);
  }
  closeModal('modalViaje');
}

function openViajeForm(editId) {
  if (typeof closeOverlayPickers === 'function') closeOverlayPickers();

  if (!$('#viajeFormSection') || !$('#campId')) {
    showToast?.({
      title: 'Formulario no disponible',
      type: 'warning',
      detail: 'Abre la pestaña Viajes e intenta de nuevo'
    });
    return;
  }

  if (editId) {
    const camp = state.campamentos.find((c) => c.id === editId);
    if (!camp) {
      showToast?.({
        title: 'No se pudo editar',
        type: 'warning',
        detail: 'El viaje ya no está en este dispositivo'
      });
      return;
    }
    $('#viajeFormTitle').textContent = 'Agregar viajes del d\u00eda';
    $('#modalViajeTitle').textContent = camp.nombre || 'Editar viaje';
    $('#btnCancelViaje')?.removeAttribute('hidden');
    $('#campId').value = camp.id;
    $('#campNombre').value = camp.nombre || '';
    $('#campSaldoAnterior').value = camp.saldoAnterior || 0;
    dpCampFecha?.setValue(camp.fecha || todayISO());
    $('#campTarifa').value = camp.tarifa || 110;
    const filas = (camp.filas || []).map((f) => {
      const op = state.operaciones.find((o) =>
        o.campamentoId === camp.id
        && (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(o.placa) : o.placa) === (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(f.placa) : f.placa)
        && Number(o.peso) === Number(f.toneladas)
      );
      return {
        ...f,
        combustible: f.combustible ?? op?.combustible ?? 0,
        viaticos: f.viaticos ?? op?.viaticos ?? 0
      };
    });
    renderCampamentoFormFilas(filas.length ? filas : defaultCampamentoFilas(camp.nombre, camp.fecha));
    loadCampFormDetailsFromCamp(camp);
    updateCampBoardHeader();
    updateCampCamionesLock();
    recalcCampamentoForm();
    mountViajeFormInModal();
    updateCampCamionesLock();
    requestAnimationFrame(() => {
      updateCampCamionesLock();
      $('#campNombre')?.focus();
      $('#campNombre')?.select?.();
    });
    return;
  }

  resetViajeForm();
  const modalTitle = $('#modalViajeTitle');
  if (modalTitle) modalTitle.textContent = 'Nuevo viaje';
  // En móvil el FAB abre el formulario en modal (mismo patrón que Gastos/Camiones)
  if (window.innerWidth < 900) {
    mountViajeFormInModal();
  } else {
    focusViajeForm();
    $('#campNombre')?.focus();
  }
}

function openMantenimientoModal(editId) {
  const form = $('#formMantenimiento');
  if (!form) {
    console.warn('[Mantilla] formMantenimiento no está en el DOM');
    return;
  }

  // Asegurar pickers tras navegación SPA
  if (typeof initMaintPlacaPicker === 'function') {
    if (!maintPlacaPicker || !$('#maintPlacaPicker')?.querySelector('.ms')) {
      if (typeof maintPlacaPicker !== 'undefined') maintPlacaPicker = null;
      initMaintPlacaPicker();
    }
  }
  if (!dpMaintFecha && $('#maintFecha') && $('#maintFechaPicker')) {
    dpMaintFecha = new MantillaDatePicker('#maintFecha', '#maintFechaPicker', { placeholder: 'dd/mm/aaaa', allowEmpty: false });
  }
  if (!tpMaintHora && $('#maintHora') && $('#maintHoraPicker')) {
    tpMaintHora = new MantillaTimePicker('#maintHora', '#maintHoraPicker', {
      placeholder: 'Elegir hora',
      title: 'Elegir hora'
    });
  }
  if ($('#maintItemsList') && !$('#maintItemsList').dataset.wired && typeof wireMaintItemsForm === 'function') {
    wireMaintItemsForm();
  }

  form.reset();
  $('#maintId').value = '';
  form.dataset.editIds = '';

  if (editId) {
    const m = state.mantenimiento.find((x) => x.id === editId);
    if (!m) return;

    const group = typeof getMaintGroupByFechaPlaca === 'function'
      ? getMaintGroupByFechaPlaca(m.fecha, m.placa)
      : [m];
    const records = group.length ? group : [m];

    $('#modalMaintEyebrow').textContent = 'Editar gastos';
    $('#modalMaintTitle').textContent = records.length > 1
      ? `${m.placa} · ${records.length} productos`
      : (m.placa || 'Gasto');
    $('#maintId').value = m.id;
    form.dataset.editIds = records.map((r) => r.id).join(',');
    setMaintPlacaValue(m.placa);
    dpMaintFecha?.setValue(m.fecha);
    const horaShow = (typeof displayGastoHora === 'function' ? displayGastoHora(m) : m.hora) || nowTime();
    tpMaintHora?.setValue(horaShow === '\u2014' ? (m.hora || nowTime()) : horaShow);
    renderMaintItems(records.map((r) => maintItemFromRecord(r)));
    setMaintFormMode(true);
  } else {
    $('#modalMaintEyebrow').textContent = 'Gastos';
    $('#modalMaintTitle').textContent = 'Nuevo gasto';
    dpMaintFecha?.setValue(todayISO());
    tpMaintHora?.setValue(nowTime());
    setMaintPlacaValue('');
    renderMaintItems([defaultMaintItem()]);
    setMaintFormMode(false);
  }

  openModal('modalMantenimiento');
  refreshLucideIcons();
  updateInputWrapStates(form);
  $('#maintItemsList')?.querySelector('[data-field="descripcion"]')?.focus();
}

