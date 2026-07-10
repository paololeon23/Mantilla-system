/**
 * Borradores locales: si se cierra la app a mitad de un formulario,
 * al volver se restaura y se avisa con un modal.
 */
(function () {
  const DRAFT_VIAJE_KEY = 'mantilla_draft_viaje_v1';
  const DRAFT_GASTO_KEY = 'mantilla_draft_gasto_v1';
  const DRAFT_INTERRUPTED_KEY = 'mantilla_draft_interrupted';

  let saveTimer = null;
  let restoring = false;

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('[Mantilla] No se pudo guardar borrador:', err);
    }
  }

  function clearKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function hasViajeContent(data) {
    if (!data) return false;
    if ((data.campId || '').trim()) return true;
    if ((data.nombre || '').trim()) return true;
    if (Number(data.saldoAnterior) > 0) return true;
    return (data.filas || []).some((f) =>
      (f.placa && String(f.placa).trim()) || Number(f.toneladas) > 0
    );
  }

  function hasGastoContent(data) {
    if (!data) return false;
    if ((data.maintId || '').trim() || (data.editIds || '').trim()) return true;
    if ((data.placa || '').trim()) return true;
    return (data.items || []).some((i) =>
      (i.descripcion && String(i.descripcion).trim()) || Number(i.costoUnit) > 0
    );
  }

  function collectViajeDraft() {
    if (!$('#formCampamento') && !$('#viajeFormSection')) return null;
    const details = typeof getCampFormDetails === 'function' ? getCampFormDetails() : {};
    const filas = typeof getCampamentoFilasFromDom === 'function' ? getCampamentoFilasFromDom() : [];
    return {
      savedAt: Date.now(),
      campId: $('#campId')?.value || '',
      nombre: $('#campNombre')?.value?.trim() || '',
      saldoAnterior: $('#campSaldoAnterior')?.value || '0',
      fecha: $('#campFecha')?.value || '',
      tarifa: $('#campTarifa')?.value || '110',
      dniRuc: details.dniRuc || '',
      producto: details.producto || '',
      filas
    };
  }

  function collectGastoDraft() {
    if (!$('#formMantenimiento')) return null;
    const items = typeof getMaintItemsFromDom === 'function' ? getMaintItemsFromDom() : [];
    return {
      savedAt: Date.now(),
      maintId: $('#maintId')?.value || '',
      editIds: $('#formMantenimiento')?.dataset?.editIds || '',
      placa: $('#maintPlaca')?.value || '',
      fecha: $('#maintFecha')?.value || '',
      hora: $('#maintHora')?.value || '',
      items
    };
  }

  function saveViajeDraftNow() {
    if (restoring) return;
    const data = collectViajeDraft();
    if (!hasViajeContent(data)) {
      clearKey(DRAFT_VIAJE_KEY);
      return;
    }
    writeJson(DRAFT_VIAJE_KEY, data);
  }

  function saveGastoDraftNow() {
    if (restoring) return;
    const data = collectGastoDraft();
    if (!hasGastoContent(data)) {
      clearKey(DRAFT_GASTO_KEY);
      return;
    }
    writeJson(DRAFT_GASTO_KEY, data);
  }

  function scheduleDraftSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const page = typeof getPage === 'function' ? getPage() : '';
      if (page === 'viajes' || $('#viajeFormSection')) saveViajeDraftNow();
      if (page === 'mantenimiento' || $('#formMantenimiento')) saveGastoDraftNow();
    }, 280);
  }

  function clearViajeDraft() {
    clearKey(DRAFT_VIAJE_KEY);
  }

  function clearGastoDraft() {
    clearKey(DRAFT_GASTO_KEY);
  }

  function showRestoredModal() {
    const title = 'Se cerró la app';
    const message = 'Restauramos lo que estabas trabajando para que no pierdas los datos.';

    if (typeof Swal !== 'undefined') {
      return Swal.fire({
        icon: false,
        title: ' ',
        html: `
          <div class="mantilla-swal__stack mantilla-swal__stack--confirm">
            ${typeof mantillaAlertIconHtml === 'function' ? mantillaAlertIconHtml('info') : ''}
            <h2 class="mantilla-swal__title mantilla-swal__title--inline">${title}</h2>
            <p class="mantilla-swal__detail mantilla-swal__detail--confirm">${message}</p>
          </div>
        `,
        showCancelButton: false,
        showConfirmButton: true,
        confirmButtonText: 'Entendido',
        allowOutsideClick: true,
        customClass: {
          container: 'mantilla-swal-container',
          popup: 'mantilla-swal mantilla-swal--alert',
          title: 'mantilla-swal__title mantilla-swal__title--hidden',
          htmlContainer: 'mantilla-swal__detail-wrap',
          confirmButton: 'btn btn--primary'
        },
        buttonsStyling: false,
        didOpen: () => {
          if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
        }
      });
    }

    if (typeof showConfirm === 'function') {
      return showConfirm({
        title,
        message,
        confirmLabel: 'Entendido',
        cancelLabel: 'OK',
        danger: false
      });
    }

    if (typeof showToast === 'function') {
      showToast({ title, detail: message, type: 'info', timer: 3200 });
    }
    return Promise.resolve();
  }

  function applyViajeDraft(data) {
    if (!data || !hasViajeContent(data)) return false;
    restoring = true;
    try {
      if ($('#campId')) $('#campId').value = data.campId || '';
      if ($('#campNombre')) $('#campNombre').value = data.nombre || '';
      if ($('#campSaldoAnterior')) $('#campSaldoAnterior').value = data.saldoAnterior || '0';
      if ($('#campTarifa')) $('#campTarifa').value = data.tarifa || '110';
      if (data.campId) {
        $('#viajeFormTitle').textContent = 'Editar viaje';
        $('#btnCancelViaje')?.removeAttribute('hidden');
      }
      if (data.fecha && typeof dpCampFecha !== 'undefined' && dpCampFecha?.setValue) {
        dpCampFecha.setValue(data.fecha);
      } else if ($('#campFecha')) {
        $('#campFecha').value = data.fecha || '';
      }
      if (typeof setCampFormDetails === 'function') {
        setCampFormDetails({ dniRuc: data.dniRuc || '', producto: data.producto || '' });
      }
      const filas = (data.filas && data.filas.length)
        ? data.filas
        : (typeof defaultCampamentoFilas === 'function' ? defaultCampamentoFilas(data.nombre || '', data.fecha) : []);
      if (typeof renderCampamentoFormFilas === 'function') renderCampamentoFormFilas(filas);
      if (typeof updateCampBoardHeader === 'function') updateCampBoardHeader();
      if (typeof updateCampCamionesLock === 'function') updateCampCamionesLock();
      if (typeof recalcCampamentoForm === 'function') recalcCampamentoForm();
      if (typeof focusViajeForm === 'function') focusViajeForm();
      return true;
    } finally {
      restoring = false;
    }
  }

  function applyGastoDraft(data) {
    if (!data || !hasGastoContent(data)) return false;
    restoring = true;
    try {
      if (typeof openMantenimientoModal === 'function') {
        // Abrir limpio y luego rellenar
        openMantenimientoModal();
      }
      const form = $('#formMantenimiento');
      if (!form) return false;

      if ($('#maintId')) $('#maintId').value = data.maintId || '';
      form.dataset.editIds = data.editIds || '';
      if (typeof setMaintPlacaValue === 'function') setMaintPlacaValue(data.placa || '');
      else if ($('#maintPlaca')) $('#maintPlaca').value = data.placa || '';

      if (data.fecha && typeof dpMaintFecha !== 'undefined' && dpMaintFecha?.setValue) {
        dpMaintFecha.setValue(data.fecha);
      } else if ($('#maintFecha')) {
        $('#maintFecha').value = data.fecha || '';
      }
      if (data.hora && typeof tpMaintHora !== 'undefined' && tpMaintHora?.setValue) {
        tpMaintHora.setValue(data.hora);
      } else if ($('#maintHora')) {
        $('#maintHora').value = data.hora || '';
      }

      const items = (data.items && data.items.length) ? data.items : [{ unidad: 1, descripcion: '', costoUnit: '', total: 0 }];
      if (typeof renderMaintItems === 'function') renderMaintItems(items);
      if (typeof setMaintFormMode === 'function') {
        setMaintFormMode(!!(data.maintId || data.editIds));
      }
      if (data.editIds || data.maintId) {
        $('#modalMaintEyebrow').textContent = 'Editar gastos';
        $('#modalMaintTitle').textContent = data.placa || 'Gasto';
      }
      return true;
    } finally {
      restoring = false;
    }
  }

  function tryRestoreDrafts() {
    const page = typeof getPage === 'function' ? getPage() : '';
    let restored = false;

    if (page === 'viajes' || (!page && $('#viajeFormSection'))) {
      const draft = readJson(DRAFT_VIAJE_KEY);
      if (hasViajeContent(draft)) {
        restored = applyViajeDraft(draft);
      }
    }

    if (!restored && (page === 'mantenimiento' || $('#formMantenimiento'))) {
      const draft = readJson(DRAFT_GASTO_KEY);
      if (hasGastoContent(draft)) {
        restored = applyGastoDraft(draft);
      }
    }

    if (restored) {
      let showNotice = false;
      try {
        showNotice = sessionStorage.getItem(DRAFT_INTERRUPTED_KEY) === '1';
        sessionStorage.removeItem(DRAFT_INTERRUPTED_KEY);
      } catch (_) {
        showNotice = true;
      }
      if (showNotice) {
        setTimeout(() => { showRestoredModal(); }, 350);
      }
    }
  }

  function flushDrafts() {
    clearTimeout(saveTimer);
    const page = typeof getPage === 'function' ? getPage() : '';
    if (page === 'viajes' || $('#viajeFormSection')) saveViajeDraftNow();
    if (page === 'mantenimiento' || $('#formMantenimiento')) saveGastoDraftNow();
    try {
      if (readJson(DRAFT_VIAJE_KEY) || readJson(DRAFT_GASTO_KEY)) {
        sessionStorage.setItem(DRAFT_INTERRUPTED_KEY, '1');
      }
    } catch (_) {}
  }

  function wireDraftAutosave() {
    if (wireDraftAutosave._wired) return;
    wireDraftAutosave._wired = true;

    document.addEventListener('input', (e) => {
      if (e.target.closest('#formCampamento, #viajeFormSection, #formMantenimiento, #campViajesList, #maintItemsList')) {
        scheduleDraftSave();
      }
    }, true);

    document.addEventListener('change', (e) => {
      if (e.target.closest('#formCampamento, #viajeFormSection, #formMantenimiento, #campViajesList, #maintItemsList')) {
        scheduleDraftSave();
      }
    }, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushDrafts();
    });

    window.addEventListener('pagehide', flushDrafts);
    window.addEventListener('beforeunload', flushDrafts);
  }

  window.Mantilla = window.Mantilla || {};
  Mantilla.drafts = {
    wire: wireDraftAutosave,
    restore: tryRestoreDrafts,
    flush: flushDrafts,
    clearViaje: clearViajeDraft,
    clearGasto: clearGastoDraft,
    saveViajeNow: saveViajeDraftNow,
    saveGastoNow: saveGastoDraftNow
  };
})();
