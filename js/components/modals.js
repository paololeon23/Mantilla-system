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
  $('#campId').value = '';
  $('#campNombre').value = '';
  $('#campSaldoAnterior').value = '0';
  $('#campTarifa').value = '110';
  $('#viajeFormTitle').textContent = 'Agregar viajes del d\u00eda';
  $('#btnCancelViaje')?.setAttribute('hidden', '');
  dpCampFecha?.setValue(todayISO());
  clearCampFormDetails();
  renderCampamentoFormFilas(defaultCampamentoFilas('', todayISO()));
  if (typeof updateCampCamionesLock === 'function') updateCampCamionesLock();
  updateCampBoardHeader();
  recalcCampamentoForm();
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
  focusViajeForm();
}

function openMantenimientoModal(editId) {
  const form = $('#formMantenimiento');
  form.reset();
  $('#maintId').value = '';

  if (editId) {
    const m = state.mantenimiento.find((x) => x.id === editId);
    if (!m) return;
    $('#modalMaintEyebrow').textContent = 'Gastos';
    $('#modalMaintTitle').textContent = m.placa;
    $('#maintId').value = m.id;
    setMaintPlacaValue(m.placa);
    dpMaintFecha?.setValue(m.fecha);
    tpMaintHora?.setValue(m.hora || nowTime());
    renderMaintItems([maintItemFromRecord(m)]);
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

