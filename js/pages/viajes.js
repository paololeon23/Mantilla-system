// ---- Viajes (persona o campamento) ----

function calcCampamentoTotals(filas, tarifa, saldoAnterior = 0) {
  const activas = filas.filter((f) => parseMoneyNumber(f.toneladas) > 0);
  const toneladas = roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.toneladas), 0));
  const guiaTotal = roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.guia), 0));
  const pesajeTotal = roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.pesaje), 0));
  const count = activas.length;
  const tarifaNum = parseMoneyNumber(tarifa);
  const producto = roundMoney(toneladas * tarifaNum);
  const subtotal = roundMoney(producto + guiaTotal + pesajeTotal);
  const saldo = parseMoneyNumber(saldoAnterior);
  const totalConSaldo = roundMoney(subtotal + saldo);
  return { toneladas, guiaTotal, pesajeTotal, count, producto, subtotal, saldoAnterior: saldo, totalConSaldo };
}

let _calcPrev = {};

function flashCalcEl(el, key) {
  if (!el) return;
  const val = el.textContent || el.value;
  if (_calcPrev[key] === val) return;
  _calcPrev[key] = val;
  el.classList.remove('calc-flash');
  void el.offsetWidth;
  el.classList.add('calc-flash');
}

function updateSumLive(filas) {
  const parts = filasCampamentoValidas(filas)
    .map((f) => Number(f.toneladas))
    .filter((n) => n > 0);
  const partsEl = $('#campSumParts');
  const totalEl = $('#campSumTotal');
  if (!partsEl || !totalEl) return;

  if (parts.length) {
    partsEl.textContent = parts.map((p) => p.toFixed(2)).join(' + ');
    totalEl.textContent = `${parts.reduce((a, b) => a + b, 0).toFixed(2)} TM`;
  } else {
    partsEl.textContent = 'Toneladas por camión';
    totalEl.textContent = '0.00 TM';
  }
  flashCalcEl(totalEl, 'sumTotal');
}

function campamentoCalcLine(text) {
  return `<p class="campamento-calc__line">${lucideIcon('arrow-right', 'lucide-icon--calc-line')}<span>${text}</span></p>`;
}

function campamentoCalcHtml(totals, tarifa) {
  let html = `
    ${campamentoCalcLine(`${totals.toneladas.toFixed(2)} × ${tarifa} = ${formatMoney(totals.producto)} +`)}
    ${campamentoCalcLine(`${totals.count} Guía${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.guiaTotal)}`)}
    ${campamentoCalcLine(`${totals.count} Pesaje${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.pesajeTotal)}`)}
    <p class="campamento-calc__subtotal"><strong>Subtotal = ${formatMoney(totals.subtotal)}</strong></p>`;
  return html;
}

function campFieldInput(field, value, step) {
  const val = value === '' || value == null ? '' : value;
  return `<input type="number" class="field-input camp-input camp-viaje-input" data-field="${field}" step="${step}" min="0" inputmode="decimal" value="${val}" placeholder="0">`;
}

function campCardInput(card, field) {
  return card?.querySelector(`[data-field="${field}"]`);
}

function campPlacaPickerHtml(selected = '') {
  const val = selected || '';
  return `
    <input type="hidden" class="camp-input" data-field="placa" value="${val}">
    <div class="camp-placa-picker-mount"></div>`;
}

function campFechaPickerHtml(fecha = '') {
  const val = fecha || '';
  return `
    <input type="hidden" class="camp-input" data-field="fecha" value="${val}">
    <div class="camp-fecha-picker-mount"></div>`;
}

function getCampFechaFromCard(card) {
  const input = card?._fechaPicker?.input || campCardInput(card, 'fecha');
  return input?.value || $('#campFecha')?.value || todayISO();
}

function initCampFechaPickers(root = $('#campViajesList')) {
  if (!root) return;
  root.querySelectorAll('.camp-viaje-card').forEach((card) => {
    const input = campCardInput(card, 'fecha');
    const mount = card.querySelector('.camp-fecha-picker-mount');
    if (!input || !mount) return;
    const picker = new MantillaDatePicker(input, mount, {
      placeholder: 'Fecha',
      allowEmpty: false,
      compact: true
    });
    card._fechaPicker = picker;
    if (!input.dataset.wiredFecha) {
      input.dataset.wiredFecha = '1';
      input.addEventListener('change', () => scheduleRecalcCampamentoForm());
    }
  });
}

function placaLabel(placa) {
  if (!placa) return '';
  return typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(placa) : placa;
}

function getCampPlacaInfoFromCard(card) {
  if (!card) return { placa: '', chofer: '' };

  const input = card._placaPicker?.input || campCardInput(card, 'placa');
  let placa = (input?.value || '').trim();

  const triggerPlaca = card.querySelector('.ms__trigger-placa');
  const triggerChofer = card.querySelector('.ms__trigger-chofer');

  if (!placa && triggerPlaca?.textContent) {
    placa = triggerPlaca.textContent.trim();
  }

  if (typeof formatPlacaDisplay === 'function' && placa) {
    placa = formatPlacaDisplay(placa);
    if (input) input.value = placa;
  }

  let chofer = triggerChofer?.textContent?.trim() || '';
  if (!chofer && placa && typeof getChoferByPlaca === 'function') {
    chofer = getChoferByPlaca(placa);
  }

  return { placa, chofer };
}

function getCampPlacasOcupadas(exceptCard = null) {
  const used = new Set();
  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach((card) => {
    if (exceptCard && card === exceptCard) return;
    const { placa } = getCampPlacaInfoFromCard(card);
    if (placa) {
      used.add(typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(placa) : placa);
    }
  });
  return used;
}

function refreshCampPlacaPickers() {
  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach((card) => {
    const picker = card._placaPicker;
    if (!picker) return;
    picker.renderList();
    picker.updateTrigger();
    updateChoferGastosButton(card);
  });
  if (campListPlacaPicker) {
    campListPlacaPicker.renderList();
    campListPlacaPicker.updateTrigger();
  }
}

function initCampPlacaPickers(root = $('#campViajesList')) {
  if (!root) return;
  root.querySelectorAll('.camp-viaje-card').forEach((card) => {
    const input = campCardInput(card, 'placa');
    const mount = card.querySelector('.camp-placa-picker-mount');
    if (!input || !mount) return;
    if (card._placaPicker) {
      if (typeof msOpenInstance !== 'undefined' && msOpenInstance === card._placaPicker) {
        card._placaPicker.close();
      }
      mount.innerHTML = '';
      card._placaPicker = null;
    }
    card._placaPicker = new MantillaSelectPicker(input, mount, {
      placeholder: 'Elegir placa',
      title: 'Placa del camión',
      searchable: true,
      noOptionsText: 'No hay placas libres — ya están en otro camión',
      getOptions: () => getCamionPlacaPickerOptions(
        input.value,
        [...getCampPlacasOcupadas(card)]
      )
    });
    if (!input.dataset.wiredPlaca) {
      input.dataset.wiredPlaca = '1';
      input.addEventListener('change', () => refreshCampPlacaPickers());
    }
  });
}

let campListPlacaPicker;

function initCampListPlacaPicker() {
  const input = $('#campListPlaca');
  const mount = $('#campListPlacaPicker');
  if (!input || !mount || campListPlacaPicker) return;
  campListPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Todas las placas',
    title: 'Buscar por placa',
    allowEmpty: true,
    searchable: true,
    getOptions: () => getCamionPlacaPickerOptions(input.value)
  });
  input.addEventListener('change', () => {
    campListPage = 1;
    renderCampamentoList();
  });
}

function setCampListPlacaFilter(placa) {
  const value = placa ? (typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(placa) : placa) : '';
  if (campListPlacaPicker) {
    campListPlacaPicker.setValue(value);
  } else if ($('#campListPlaca')) {
    $('#campListPlaca').value = value;
  }
}

function campCardNum(card, field) {
  return parseFloat(campCardInput(card, field)?.value) || 0;
}

function calcCampFilaFleteFromData(f, tarifa) {
  return calcFlete(f.toneladas, tarifa, 0, f.guia, f.pesaje);
}

function calcCampFilaFlete(card) {
  const tarifa = parseFloat($('#campTarifa')?.value) || 110;
  return calcCampFilaFleteFromData(getCampFilaFromCard(card), tarifa);
}

function getCampFilaFromCard(card) {
  const { placa } = getCampPlacaInfoFromCard(card);
  return {
    toneladas: campCardNum(card, 'toneladas'),
    guia: campCardNum(card, 'guia'),
    pesaje: campCardNum(card, 'pesaje'),
    placa,
    combustible: campCardNum(card, 'combustible'),
    viaticos: campCardNum(card, 'viaticos')
  };
}

function updateChoferGastosButton(card) {
  const btn = card?.querySelector('.camp-chofer-gastos-btn');
  if (!btn) return;
  const { placa, combustible, viaticos } = getCampFilaFromCard(card);
  const hasGastos = combustible > 0 || viaticos > 0;
  const flete = calcCampFilaFlete(card);
  const gastos = calcGastos(combustible, viaticos);
  const utilidad = calcUtilidad(flete, gastos);
  btn.classList.toggle('camp-chofer-gastos-btn--filled', hasGastos);
  btn.classList.toggle('camp-chofer-gastos-btn--ready', !!placa);
  if (placa) {
    btn.title = `Gastos de chofer — ${placa}`;
    btn.setAttribute('aria-label', `Gastos de chofer ${placa}`);
  }
  const utilEl = btn.querySelector('.camp-chofer-gastos-btn__util');
  if (utilEl) {
    const showUtil = hasGastos && flete > 0;
    utilEl.hidden = !showUtil;
    utilEl.textContent = showUtil ? formatMoney(utilidad) : '';
    utilEl.classList.toggle('camp-chofer-gastos-btn__util--neg', utilidad < 0);
  }
}

function updateAllChoferGastosButtons() {
  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach(updateChoferGastosButton);
}

let _choferGastosCard = null;

function updateChoferGastosModal() {
  if (!_choferGastosCard) return;
  const comb = parseFloat($('#choferGastosCombustible')?.value) || 0;
  const viat = parseFloat($('#choferGastosViaticos')?.value) || 0;
  const gastos = calcGastos(comb, viat);
  const flete = calcCampFilaFlete(_choferGastosCard);
  const utilidad = calcUtilidad(flete, gastos);
  const totalEl = $('#choferGastosTotal');
  const utilEl = $('#choferGastosUtilidad');
  if (totalEl) totalEl.value = formatMoney(gastos);
  if (utilEl) {
    utilEl.value = formatMoney(utilidad);
    utilEl.classList.toggle('chofer-gastos-util--neg', utilidad < 0);
    utilEl.classList.toggle('chofer-gastos-util--pos', utilidad > 0);
  }
}

function refreshChoferGastosModalHeader() {
  if (!_choferGastosCard) return;
  const { placa, chofer } = getCampPlacaInfoFromCard(_choferGastosCard);
  const title = $('#choferGastosTitle');
  const subtitle = $('#choferGastosSubtitle');
  if (title) title.textContent = placa || 'Sin placa';
  if (subtitle) subtitle.textContent = chofer || 'Chofer no asignado';
}

function openChoferGastosModal(card) {
  if (!card) return;
  const { placa, chofer } = getCampPlacaInfoFromCard(card);
  if (!placa) {
    showToast({
      title: 'Elige una placa',
      type: 'warning',
      detail: 'Selecciona la placa del camión en esta fila antes de registrar gastos.'
    });
    card.querySelector('.ms__trigger')?.focus();
    return;
  }
  _choferGastosCard = card;
  refreshChoferGastosModalHeader();
  const combEl = $('#choferGastosCombustible');
  const viatEl = $('#choferGastosViaticos');
  if (combEl) combEl.value = campCardInput(card, 'combustible')?.value || '';
  if (viatEl) viatEl.value = campCardInput(card, 'viaticos')?.value || '';
  updateChoferGastosModal();
  openModal('modalChoferGastos');
  refreshLucideIcons();
  combEl?.focus();
}

function saveChoferGastos() {
  if (!_choferGastosCard) return;
  const comb = parseFloat($('#choferGastosCombustible')?.value) || 0;
  const viat = parseFloat($('#choferGastosViaticos')?.value) || 0;
  const combInput = campCardInput(_choferGastosCard, 'combustible');
  const viatInput = campCardInput(_choferGastosCard, 'viaticos');
  if (combInput) combInput.value = comb > 0 ? String(comb) : '';
  if (viatInput) viatInput.value = viat > 0 ? String(viat) : '';
  updateChoferGastosButton(_choferGastosCard);
  closeModal('modalChoferGastos');
  _choferGastosCard = null;
  scheduleRecalcCampamentoForm();
}

function cancelChoferGastosModal() {
  _choferGastosCard = null;
}

function wireChoferGastosModal() {
  const modal = $('#modalChoferGastos');
  if (!modal || modal.dataset.wired) return;
  modal.dataset.wired = '1';
  $('#choferGastosCombustible')?.addEventListener('input', updateChoferGastosModal);
  $('#choferGastosViaticos')?.addEventListener('input', updateChoferGastosModal);
  $('#btnSaveChoferGastos')?.addEventListener('click', saveChoferGastos);
}

function campViajeCardHtml(f, index, fechaDefault) {
  const num = index + 1;
  const combVal = f.combustible === '' || f.combustible == null ? '' : f.combustible;
  const viatVal = f.viaticos === '' || f.viaticos == null ? '' : f.viaticos;
  const fechaVal = f.fecha || fechaDefault || todayISO();
  return `
    <article class="camp-viaje-card camp-viaje-row camp-row-enter" data-row="${index}" role="listitem">
      <div class="camp-viaje-row__top">
        <span class="camp-viaje-row__num" aria-hidden="true">${num}</span>
        <div class="camp-viaje-row__placa">
          <div class="camp-viaje-row__placa-wrap">
            <div class="camp-viaje-row__placa-picker">
              <label class="camp-viaje-field__lbl">Placa del camión</label>
              ${campPlacaPickerHtml(f.placa || '')}
            </div>
            <div class="camp-viaje-row__fecha">
              <label class="camp-viaje-field__lbl">Fecha</label>
              ${campFechaPickerHtml(fechaVal)}
            </div>
            <button type="button" class="camp-chofer-gastos-btn" data-action="chofer-gastos" title="Gastos de chofer" aria-label="Gastos de chofer ${placaLabel(f.placa)} viaje ${num}">
              ${lucideIcon('wallet', 'lucide-icon--sm')}
              <span class="camp-chofer-gastos-btn__text">Gastos</span>
              <span class="camp-chofer-gastos-btn__util" hidden></span>
            </button>
          </div>
        </div>
        <button type="button" class="camp-viaje-card__remove camp-remove-row" title="Quitar camión" aria-label="Quitar viaje ${num}">${lucideIcon('x', 'lucide-icon--sm')}</button>
      </div>
      <div class="camp-viaje-row__bottom">
        <div class="camp-viaje-field camp-viaje-field--toneladas">
          <label class="camp-viaje-field__lbl">Toneladas</label>
          ${campFieldInput('toneladas', f.toneladas || '', '0.01')}
        </div>
        <div class="camp-viaje-field">
          <label class="camp-viaje-field__lbl">Guía (S/)</label>
          ${campFieldInput('guia', f.guia ?? '', '1')}
        </div>
        <div class="camp-viaje-field">
          <label class="camp-viaje-field__lbl">Pesaje (S/)</label>
          ${campFieldInput('pesaje', f.pesaje ?? '', '0.5')}
        </div>
      </div>
      <input type="hidden" class="camp-input" data-field="combustible" value="${combVal}">
      <input type="hidden" class="camp-input" data-field="viaticos" value="${viatVal}">
      <input type="hidden" class="camp-input" data-field="opId" value="${f.opId || ''}">
    </article>`;
}

function campamentoFilasReadonlyHtml(filas, fechaCamp) {
  const rows = filas.filter((f) => f.placa && f.toneladas > 0);
  if (!rows.length) return '';
  return `
    <div class="campamento-detail-table-wrap">
      <table class="campamento-detail-table">
        <thead>
          <tr>
            <th class="col-fecha">Fecha</th>
            <th class="num col-tm">TM</th>
            <th class="num col-guia">Guía</th>
            <th class="col-placa">Placa</th>
            <th class="num col-pesaje">Pesaje</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((f) => `
            <tr>
              <td class="col-fecha">${formatDateDM(f.fecha || fechaCamp)}</td>
              <td class="num">${Number(f.toneladas).toFixed(2)}</td>
              <td class="num">${Number(f.guia).toFixed(0)}</td>
              <td class="col-placa"><span class="camp-placa-tag">${f.placa}</span></td>
              <td class="num col-pesaje">${Number(f.pesaje).toFixed(1)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function getCampFormDetails() {
  const nombre = $('#campNombre')?.value.trim() || '';
  return {
    cliente: nombre,
    dniRuc: $('#campDniRuc')?.value.trim() || '',
    producto: $('#campProducto')?.value.trim() || ''
  };
}

function setCampFormDetails({ dniRuc = '', producto = '' } = {}) {
  if ($('#campDniRuc')) $('#campDniRuc').value = dniRuc;
  if ($('#campProducto')) $('#campProducto').value = producto;
}

function clearCampFormDetails() {
  setCampFormDetails();
}

function applyCampFormDetailsFromNombre(nombre = '') {
  const n = (nombre || $('#campNombre')?.value.trim() || '').trim();
  if (!n) return;
  const preset = CLIENTE_PRESETS[n];
  if ($('#campProducto')) {
    if (preset?.producto) $('#campProducto').value = preset.producto;
    else if (isNombreCampamento(n)) $('#campProducto').value = 'carbon';
  }
  if (preset?.tarifa) $('#campTarifa').value = preset.tarifa;
  updateCampCamionesLock();
}

function loadCampFormDetailsFromCamp(camp) {
  const fila = camp.filas?.find((f) => f.placa && f.toneladas) || camp.filas?.[0];
  setCampFormDetails({
    dniRuc: fila?.dniRuc || '',
    producto: fila?.producto || (isNombreCampamento(camp.nombre) ? 'carbon' : '')
  });
  updateCampCamionesLock();
}

function isCampCamionesUnlocked() {
  return !!$('#campNombre')?.value.trim();
}

function updateCampCamionesLock() {
  const section = $('#campViajesSection');
  const board = $('#campViajesBoard');
  const addBtn = $('#btnAddCampFila');
  const hint = $('#campViajesLockHint');
  const unlocked = isCampCamionesUnlocked();

  section?.classList.toggle('camp-viajes-section--locked', !unlocked);
  if (section) section.setAttribute('aria-disabled', unlocked ? 'false' : 'true');

  if (addBtn) {
    addBtn.disabled = !unlocked;
    addBtn.title = unlocked ? 'Agregar camión' : 'Primero completa persona o campamento';
  }

  if (board) {
    if (unlocked) {
      board.inert = false;
      board.removeAttribute('inert');
      board.setAttribute('aria-hidden', 'false');
    } else {
      board.inert = true;
      board.setAttribute('aria-hidden', 'true');
    }
  }

  if (hint) hint.hidden = unlocked;
}

function wireCampFormDetails() {
  const block = $('#campFormTop');
  if (!block || block.dataset.wired) return;
  block.dataset.wired = '1';

  const onNombreUpdate = () => {
    const n = $('#campNombre')?.value.trim() || '';
    const preset = CLIENTE_PRESETS[n];
    if (preset?.producto && !$('#campProducto')?.value) {
      $('#campProducto').value = preset.producto;
    }
    updateCampCamionesLock();
  };

  $('#campNombre')?.addEventListener('input', onNombreUpdate);
  $('#campNombre')?.addEventListener('change', onNombreUpdate);
  updateCampCamionesLock();
}

function getCampamentoFilasFromDom() {
  const { cliente, dniRuc, producto } = getCampFormDetails();
  return [...$('#campViajesList').querySelectorAll('.camp-viaje-card')].map((card) => {
    const { placa } = getCampPlacaInfoFromCard(card);
    return {
      cliente,
      dniRuc,
      producto,
      fecha: getCampFechaFromCard(card),
      toneladas: campCardNum(card, 'toneladas'),
      guia: campCardNum(card, 'guia'),
      placa,
      pesaje: campCardNum(card, 'pesaje'),
      combustible: campCardNum(card, 'combustible'),
      viaticos: campCardNum(card, 'viaticos'),
      opId: campCardInput(card, 'opId')?.value?.trim() || ''
    };
  });
}

function filasCampamentoValidas(filas) {
  return filas.filter((f) => f.placa && (Number(f.toneladas) || 0) > 0);
}

function filasCampamentoIncompletas(filas) {
  return filas
    .map((f, i) => ({ ...f, rowNum: i + 1 }))
    .filter((f) => !f.placa && (Number(f.toneladas) || 0) > 0);
}

function getCampamentoFilasFromForm() {
  return filasCampamentoValidas(getCampamentoFilasFromDom());
}

function getUltimoSaldoCuenta(nombre, excludeId = '') {
  const key = (nombre || '').trim().toLowerCase();
  if (!key) return 0;
  const hojas = (state.campamentos || [])
    .filter((c) => c.id !== excludeId && c.nombre.trim().toLowerCase() === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  if (!hojas.length) return 0;
  const last = hojas[0];
  const totals = calcCampamentoTotals(last.filas, last.tarifa, last.saldoAnterior || 0);
  return totals.totalConSaldo;
}

function recalcCampamentoForm() {
  const filas = getCampamentoFilasFromDom();
  const filasValidas = filasCampamentoValidas(filas);
  const incompletas = filasCampamentoIncompletas(filas);
  const saldoAnterior = parseFloat($('#campSaldoAnterior').value) || 0;
  const tarifa = parseFloat($('#campTarifa').value) || 110;
  const totals = calcCampamentoTotals(filasValidas, tarifa, saldoAnterior);

  updateSumLive(filas);

  const tmFoot = $('#campTotalToneladas');
  const guiaFoot = $('#campTotalGuia');
  const pesajeFoot = $('#campTotalPesaje');
  if (tmFoot) tmFoot.textContent = totals.toneladas.toFixed(2);
  if (guiaFoot) guiaFoot.textContent = totals.guiaTotal.toFixed(0);
  if (pesajeFoot) pesajeFoot.textContent = totals.pesajeTotal.toFixed(1);
  flashCalcEl(tmFoot, 'footTm');
  flashCalcEl(guiaFoot, 'footGuia');
  flashCalcEl(pesajeFoot, 'footPesaje');

  const linesEl = $('#campCalcLines');
  if (linesEl) {
    if (incompletas.length) {
      linesEl.innerHTML = `<p class="campamento-calc__placeholder campamento-calc__placeholder--warn">Fila ${incompletas.map((f) => f.rowNum).join(', ')}: elige placa para incluirla en el total</p>`;
    } else {
      linesEl.innerHTML = filasValidas.length
        ? campamentoCalcHtml(totals, tarifa)
        : '<p class="campamento-calc__placeholder">Toneladas por camión</p>';
    }
  }

  const grandEl = $('#campGrandTotal');
  if (grandEl) {
    grandEl.textContent = formatMoney(totals.totalConSaldo);
    flashCalcEl(grandEl, 'grand');
  }

  const grandLabel = $('#campGrandTotalLabel');
  if (grandLabel) {
    grandLabel.textContent = saldoAnterior > 0 ? 'Total con saldo' : 'Total';
  }

  const saldoLine = $('#campCalcSaldoLine');
  if (saldoAnterior > 0) {
    saldoLine.hidden = false;
    $('#campCalcSaldoTxt').textContent = formatMoney(saldoAnterior);
  } else {
    saldoLine.hidden = true;
  }

  const rowBadge = $('#campRowCount');
  if (rowBadge) {
    const n = filas.length;
    const validas = filasValidas.length;
    rowBadge.textContent = String(n);
    const label = `${n} camión${n !== 1 ? 'es' : ''}${validas ? `, ${validas} listo${validas !== 1 ? 's' : ''}` : ''}`;
    rowBadge.setAttribute('aria-label', label);
    rowBadge.title = label;
  }

  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach((card, i) => {
    const f = filas[i];
    const incomplete = f && !f.placa && (Number(f.toneladas) || 0) > 0;
    card.classList.toggle('camp-viaje-row--incomplete', !!incomplete);
  });

  renumberCampViajeCards();
  updateAllChoferGastosButtons();
  if (linesEl?.querySelector('[data-lucide]')) refreshLucideIcons();
}

function renumberCampViajeCards() {
  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach((card, i) => {
    const num = card.querySelector('.camp-viaje-row__num');
    if (num) num.textContent = i + 1;
    card.dataset.row = i;
  });
}

function updateCampBoardHeader() {
  const title = $('#viajeFormTitle');
  if (!title) return;
  title.textContent = 'Agregar viajes del d\u00eda';
  title.classList.remove('viaje-form-title--cuenta');
}

let _recalcRaf;
function scheduleRecalcCampamentoForm() {
  cancelAnimationFrame(_recalcRaf);
  _recalcRaf = requestAnimationFrame(recalcCampamentoForm);
}

function defaultGuiaPesaje(nombre) {
  return isNombreCampamento(nombre)
    ? { guia: 100, pesaje: 27.5 }
    : { guia: 200, pesaje: 28 };
}

function defaultCampamentoFilas(nombre = '', fecha = '') {
  const fDefault = fecha || $('#campFecha')?.value || todayISO();
  const { guia, pesaje } = defaultGuiaPesaje(nombre);
  return [{ fecha: fDefault, toneladas: '', guia, placa: '', pesaje }];
}

function applyNombreDefaults() {
  const nombre = $('#campNombre').value.trim();
  if ($('#campId').value) return;
  const { guia, pesaje } = defaultGuiaPesaje(nombre);
  if (isNombreCampamento(nombre)) {
    $('#campTarifa').value = 110;
  }
  applyCampFormDetailsFromNombre(nombre);
  const filas = getCampamentoFilasFromDom();
  if (!filas.length || filas.every((f) => !f.toneladas && !f.placa)) {
    renderCampamentoFormFilas(defaultCampamentoFilas(nombre));
    return;
  }
  filas.forEach((f) => {
    if (!f.guia) f.guia = guia;
    if (!f.pesaje) f.pesaje = pesaje;
  });
  renderCampamentoFormFilas(filas);
}

function applySaldoAutomatico() {
  const nombre = $('#campNombre').value.trim();
  const excludeId = $('#campId').value;
  const saldo = getUltimoSaldoCuenta(nombre, excludeId);
  $('#campSaldoAnterior').value = saldo > 0 ? saldo.toFixed(2) : '0';
  recalcCampamentoForm();
  if (saldo > 0) {
    showToast({
      title: 'Saldo anterior cargado',
      detail: alertDetailHtml([
        { b: nombre || 'Cuenta' },
        ' · ',
        { b: formatMoney(saldo) }
      ])
    });
  }
}

function renderCampamentoFormFilas(filas) {
  if (typeof closeOverlayPickers === 'function') closeOverlayPickers();
  const fechaDefault = $('#campFecha').value || todayISO();
  const filasReady = filas.map((f) => ({ ...f, fecha: f.fecha || fechaDefault }));
  const list = $('#campViajesList');
  if (!list) return;

  list.innerHTML = filasReady.map((f, i) => campViajeCardHtml(f, i, fechaDefault)).join('');

  list.querySelectorAll('.camp-viaje-card').forEach((card) => {
    const tm = campCardInput(card, 'toneladas')?.value;
    const placa = campCardInput(card, 'placa')?.value;
    card.classList.toggle('camp-viaje-row--filled', !!(tm || placa));
  });

  updateCampBoardHeader();
  recalcCampamentoForm();
  initCampPlacaPickers(list);
  initCampFechaPickers(list);
  updateAllChoferGastosButtons();
  updateCampCamionesLock();
  refreshLucideIcons();
}

function wireCampViajesList() {
  const list = $('#campViajesList');
  if (!list || list.dataset.wired) return;
  list.dataset.wired = '1';

  list.addEventListener('click', async (e) => {
    const gastosBtn = e.target.closest('[data-action="chofer-gastos"]');
    if (gastosBtn) {
      e.preventDefault();
      const card = gastosBtn.closest('.camp-viaje-card');
      if (card) openChoferGastosModal(card);
      return;
    }

    const removeBtn = e.target.closest('.camp-remove-row');
    if (removeBtn) {
      e.preventDefault();
      const cards = list.querySelectorAll('.camp-viaje-card');
      if (cards.length <= 1) {
        showToast({
          title: 'Acción no permitida',
          type: 'warning',
          detail: 'Debe quedar al menos un camión en el formulario'
        });
        return;
      }
      const ok = await showConfirm({
        message: 'Se quitará este camión del formulario.'
      });
      if (!ok) return;
      removeBtn.closest('.camp-viaje-card')?.remove();
      refreshCampPlacaPickers();
      scheduleRecalcCampamentoForm();
    }
  });

  const onCampFieldUpdate = (e) => {
    if (!e.target.matches('.camp-input')) return;
    const card = e.target.closest('.camp-viaje-card');
    const tm = campCardInput(card, 'toneladas')?.value;
    const placa = getCampPlacaInfoFromCard(card).placa;
    card?.classList.toggle('camp-viaje-row--filled', !!(tm || placa));
    if (card) updateChoferGastosButton(card);
    if (card === _choferGastosCard) {
      refreshChoferGastosModalHeader();
      updateChoferGastosModal();
    }
    scheduleRecalcCampamentoForm();
  };

  list.addEventListener('input', onCampFieldUpdate);
  list.addEventListener('change', onCampFieldUpdate);
}

function getCampListFilters() {
  return {
    q: '',
    fecha: (campListFechaFilter || $('#campListFecha')?.value || '').trim(),
    placa: ($('#campListPlaca')?.value || '').trim()
  };
}

function filterCampamentosForList() {
  const f = getCampListFilters();
  let items = typeof getRecentCampamentos === 'function'
    ? getRecentCampamentos()
    : [...(state.campamentos || [])]
      .filter(isCampamentoWithinRetention)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  if (f.fecha) {
    const fechaKey = typeof normalizeDateISO === 'function' ? normalizeDateISO(f.fecha) : f.fecha;
    items = items.filter((c) =>
      c.fecha === fechaKey || c.filas?.some((fil) => (fil.fecha || c.fecha) === fechaKey)
    );
  }

  if (f.placa) {
    const placaKey = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(f.placa) : f.placa;
    items = items.filter((c) => c.filas?.some((fil) => {
      const fp = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(fil.placa) : fil.placa;
      return fp === placaKey;
    }));
  }

  if (f.q) {
    items = items.filter((c) => {
      const haystack = [
        c.nombre,
        c.fecha,
        formatDate(c.fecha),
        ...(c.filas || []).flatMap((fil) => [
          fil.cliente,
          fil.producto,
          fil.dniRuc,
          fil.placa,
          fil.fecha,
          fil.fecha ? formatDateDM(fil.fecha) : ''
        ])
      ].join(' ').toLowerCase();
      return haystack.includes(f.q);
    });
  }

  return items;
}

function renderCampHistoryMini() {
  const el = $('#campListHistory');
  if (!el) return;
  el.hidden = true;
  el.innerHTML = '';
}

function historialSlug(nombre, fecha) {
  const slug = String(nombre || 'viaje')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'viaje';
  return `hist-${slug}-${fecha}`;
}

function groupServerViajesToCamps(rows, fecha) {
  const fechaKey = typeof normalizeDateISO === 'function' ? normalizeDateISO(fecha) : fecha;
  const money = (v) => (typeof parseMoneyNumber === 'function' ? parseMoneyNumber(v) : Number(v) || 0);
  const groups = new Map();

  (rows || []).forEach((row) => {
    const rowFecha = typeof normalizeDateISO === 'function'
      ? normalizeDateISO(row.fecha)
      : String(row.fecha || '');
    if (rowFecha !== fechaKey) return;

    const nombre = String(row.cliente || '').trim() || 'Sin cliente';
    const key = `${nombre.toLowerCase()}|${fechaKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: historialSlug(nombre, fechaKey),
        nombre,
        fecha: fechaKey,
        tarifa: money(row.flete_tonelada) || 110,
        saldoAnterior: 0,
        filas: [],
        fromServer: true
      });
    }

    const camp = groups.get(key);
    const tarifa = money(row.flete_tonelada);
    if (tarifa > 0) camp.tarifa = tarifa;

    camp.filas.push({
      fecha: rowFecha,
      cliente: nombre,
      producto: row.producto || '',
      dniRuc: row.dni || '',
      toneladas: money(row.ticket_balanza),
      guia: money(row.guia),
      placa: typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(row.placa) : (row.placa || ''),
      pesaje: money(row.pesaje),
      combustible: money(row.combustible),
      viaticos: money(row.viaticos),
      opId: row.id || ''
    });
  });

  return [...groups.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function mergeHistorialCamps(localCamps, serverCamps) {
  const byKey = new Map();

  (serverCamps || []).forEach((camp) => {
    const key = `${String(camp.nombre || '').trim().toLowerCase()}|${camp.fecha}`;
    byKey.set(key, { ...camp, filas: [...(camp.filas || [])] });
  });

  (localCamps || []).forEach((camp) => {
    const key = `${String(camp.nombre || '').trim().toLowerCase()}|${camp.fecha}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...camp, filas: [...(camp.filas || [])], fromServer: false });
      return;
    }
    const placas = new Set((prev.filas || []).map((f) => f.placa));
    (camp.filas || []).forEach((f) => {
      if (f.placa && !placas.has(f.placa)) prev.filas.push(f);
    });
    prev.id = camp.id;
    prev.fromServer = false;
    prev.saldoAnterior = camp.saldoAnterior || 0;
    if (camp.tarifa) prev.tarifa = camp.tarifa;
  });

  return [...byKey.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function renderCampHistorialTable(camps, fecha, sourceLabel) {
  const el = $('#campHistorialResults');
  if (!el) return;

  historialCampById.clear();
  camps.forEach((c) => historialCampById.set(c.id, c));

  if (!fecha) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  el.hidden = false;

  if (!camps.length) {
    el.innerHTML = `
      <div class="camp-historial-empty">
        <p>Sin viajes el <strong>${formatDate(fecha)}</strong></p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="camp-historial-card">
      <p class="camp-historial-card__label">${formatDate(fecha)} · ${camps.length} resultado${camps.length !== 1 ? 's' : ''}${sourceLabel ? ` · ${escapeHtml(sourceLabel)}` : ''}</p>
      <div class="camp-historial-list" role="list">
        ${camps.map((camp) => {
          const totals = calcCampamentoTotals(camp.filas || [], camp.tarifa, camp.saldoAnterior || 0);
          const n = (camp.filas || []).filter((f) => f.placa && Number(f.toneladas) > 0).length;
          return `<div class="camp-historial-row" role="listitem">
            <button type="button" class="camp-historial-row__open" data-historial-camp="${camp.id}" title="Ver PDF" aria-label="Ver PDF de ${escapeHtml(camp.nombre)}">
              <span class="camp-historial-row__main">
                <strong class="camp-historial-row__name">${escapeHtml(camp.nombre)}</strong>
                <span class="camp-historial-row__meta">${n} camión${n !== 1 ? 'es' : ''} · ${totals.toneladas.toFixed(2)} TM</span>
              </span>
              <strong class="camp-historial-row__total">${formatMoney(totals.totalConSaldo)}</strong>
            </button>
            <button type="button" class="camp-historial-row__pdf btn btn--action btn--action-print btn--sm btn--icon-text" data-historial-camp="${camp.id}" title="Generar PDF" aria-label="Generar PDF de ${escapeHtml(camp.nombre)}">${ICON_PRINT}</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  refreshLucideIcons();
}

function clearCampHistorialResults() {
  campListFechaFilter = '';
  if ($('#campListFecha')) $('#campListFecha').value = '';
  if (dpCampListFecha) dpCampListFecha.setValue('');
  historialCampById.clear();
  const el = $('#campHistorialResults');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
}

async function buscarHistorialPorFecha(fecha, { silent = false } = {}) {
  const fechaKey = typeof normalizeDateISO === 'function' ? normalizeDateISO(fecha) : String(fecha || '').trim();
  if (!fechaKey) {
    clearCampHistorialResults();
    renderCampamentoList();
    return;
  }

  campListFechaFilter = fechaKey;
  campListDayFilter = 'all';

  const localMatches = [...(state.campamentos || [])].filter((c) =>
    c.fecha === fechaKey || c.filas?.some((fil) => (fil.fecha || c.fecha) === fechaKey)
  );

  let serverCamps = [];
  let sourceLabel = 'Local';

  if (window.Mantilla?.sync?.isEnabled?.() && navigator.onLine) {
    _historialSearching = true;
    const btn = $('#campListFechaBuscar');
    btn?.setAttribute('disabled', 'disabled');
    if (!silent) {
      showToast({
        title: 'Buscando historial…',
        detail: `Consultando viajes del ${formatDate(fechaKey)}`
      });
    }
    try {
      const rows = await Mantilla.sync.fetchDatos('viajes');
      serverCamps = groupServerViajesToCamps(rows, fechaKey);
      sourceLabel = serverCamps.length || localMatches.length
        ? (serverCamps.length ? 'Sheets + local' : 'Local')
        : 'Sin resultados';
    } catch (err) {
      sourceLabel = 'Local (sin conexión a Sheets)';
      if (!silent) {
        showToast({
          title: 'Sin respuesta del servidor',
          type: 'warning',
          detail: 'Se muestran solo los viajes locales de esa fecha'
        });
      }
    } finally {
      _historialSearching = false;
      btn?.removeAttribute('disabled');
    }
  } else if (!navigator.onLine) {
    sourceLabel = 'Local (sin internet)';
  }

  const merged = mergeHistorialCamps(localMatches, serverCamps);
  renderCampHistorialTable(merged, fechaKey, sourceLabel);
  renderCampamentoList();

  const results = $('#campHistorialResults');
  results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openHistorialCampPdf(campId) {
  const camp = historialCampById.get(campId) || getCampamentoById(campId);
  if (!camp) {
    showToast({
      title: 'No encontrado',
      type: 'warning',
      detail: 'Vuelve a buscar la fecha'
    });
    return;
  }
  openCampamentoPdfModal(camp);
}

function renderCampamentoSheet(camp) {
  const totals = calcCampamentoTotals(camp.filas, camp.tarifa, camp.saldoAnterior || 0);
  const filasValidas = camp.filas.filter((f) => f.placa && f.toneladas > 0);
  const saldoTxt = camp.saldoAnterior > 0
    ? `<div class="campamento-sheet__saldo">Saldo Anterior: <strong>${formatMoney(camp.saldoAnterior)}</strong></div>`
    : '';
  return `
    <article class="campamento-sheet" data-id="${camp.id}">
      <div class="campamento-sheet__nombre">${escapeHtml(camp.nombre)}</div>
      <div class="campamento-sheet__meta">${formatDate(camp.fecha)} · ${filasValidas.length} camión${filasValidas.length !== 1 ? 'es' : ''} · ${filasValidas.length} viaje${filasValidas.length !== 1 ? 's' : ''}</div>
      ${saldoTxt}
      ${campamentoFilasReadonlyHtml(camp.filas, camp.fecha)}
      <div class="campamento-calc">
        <p class="campamento-calc__title">Cálculos</p>
        <div class="campamento-calc__lines">${campamentoCalcHtml(totals, camp.tarifa)}</div>
        <div class="campamento-calc__grand">
          <span>${camp.saldoAnterior > 0 ? 'Total con saldo' : 'Total'}</span>
          <strong>${formatMoney(totals.totalConSaldo)}</strong>
        </div>
      </div>
      <div class="campamento-sheet__actions">
        <button type="button" class="btn btn--action btn--action-print btn--sm btn--icon-text" data-print-camp="${camp.id}" title="Ver PDF" aria-label="Ver viaje en PDF">${ICON_PRINT}</button>
        <button type="button" class="btn btn--action btn--action-edit btn--sm btn--icon-text" data-edit-camp="${camp.id}">${ICON_EDIT}</button>
        <button type="button" class="btn btn--action btn--action-delete btn--sm btn--icon-text" data-delete-camp="${camp.id}">${ICON_DELETE}</button>
      </div>
    </article>`;
}

function campListEmptyHtml(isFiltered) {
  if (isFiltered) {
    return `
      <div class="camp-list-empty empty-state empty-state--camp">
        <div class="camp-list-empty__icon" aria-hidden="true">
          <i data-lucide="search-x" class="lucide-icon"></i>
        </div>
        <h3 class="camp-list-empty__title">Sin resultados</h3>
        <p class="camp-list-empty__text">Prueba otro término o limpia los filtros de búsqueda.</p>
        <button type="button" class="btn btn--ghost btn--sm" id="campEmptyClear">Limpiar filtros</button>
      </div>`;
  }
  return `
    <div class="camp-list-empty empty-state empty-state--camp">
      <div class="camp-list-empty__icon" aria-hidden="true">
        <i data-lucide="clipboard-list" class="lucide-icon"></i>
      </div>
      <h3 class="camp-list-empty__title">Sin viajes guardados</h3>
      <p class="camp-list-empty__text">Completa el formulario de arriba y presiona <strong>Guardar viajes</strong>. Aquí verás los últimos registros guardados.</p>
      <button type="button" class="btn btn--primary btn--sm" id="campEmptyAdd">
        <i data-lucide="plus" class="lucide-icon lucide-icon--sm" aria-hidden="true"></i>
        Agregar viaje
      </button>
    </div>`;
}

function updateCampListCount(total) {
  const el = $('#campListCount');
  if (!el) return;
  el.textContent = String(total);
  el.setAttribute('aria-label', `${total} viaje${total !== 1 ? 's' : ''} guardado${total !== 1 ? 's' : ''}`);
}

function renderCampamentoList() {
  const list = $('#campamentoList');
  if (!list) return;

  const retained = filterCampamentosForList();
  const allRetained = typeof getRecentCampamentos === 'function'
    ? getRecentCampamentos()
    : [...(state.campamentos || [])]
      .filter(isCampamentoWithinRetention)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

  renderCampHistoryMini();
  updateCampListCount(allRetained.length);

  const clearBtn = $('#campListClear');
  const placaVal = $('#campListPlaca')?.value?.trim() || '';
  if (clearBtn) clearBtn.hidden = !placaVal && !campListFechaFilter;

  if (!retained.length) {
    const isFiltered = allRetained.length > 0 || !!campListFechaFilter || !!placaVal;
    list.innerHTML = campListFechaFilter ? '' : campListEmptyHtml(isFiltered);
    $('#campEmptyAdd')?.addEventListener('click', () => {
      resetViajeForm();
      focusViajeForm();
    });
    $('#campEmptyClear')?.addEventListener('click', () => {
      campListDayFilter = 'all';
      clearCampHistorialResults();
      setCampListPlacaFilter('');
      campListPage = 1;
      renderCampamentoList();
    });
    renderPagination($('#campListPagination'), { total: 0, page: 1, totalPages: 1, start: 0, end: 0 }, () => {}, getListPageSize());
    refreshLucideIcons();
    return;
  }

  const pageSize = getListPageSize();
  const meta = paginateItems(retained, campListPage, pageSize);
  campListPage = meta.page;

  // Con búsqueda por fecha: solo filas de resultado (sin fichas amontonadas)
  if (campListFechaFilter) {
    list.innerHTML = '';
    renderPagination($('#campListPagination'), { total: 0, page: 1, totalPages: 1, start: 0, end: 0 }, () => {}, pageSize);
    refreshLucideIcons();
    return;
  }

  list.innerHTML = meta.slice.map((camp) => renderCampamentoSheet(camp)).join('');
  renderPagination($('#campListPagination'), meta, (page) => {
    campListPage = page;
    renderCampamentoList();
    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, pageSize);
  refreshLucideIcons();
  if (typeof applyPendingCampHighlight === 'function') applyPendingCampHighlight();
}

function addCampamentoFila() {
  if (!isCampCamionesUnlocked()) {
    showToast({
      title: 'Cliente requerido',
      type: 'warning',
      detail: 'Completa persona o campamento antes de agregar camiones'
    });
    $('#campNombre')?.focus();
    return;
  }

  const nombre = $('#campNombre').value.trim();
  const { guia, pesaje } = defaultGuiaPesaje(nombre);
  const fecha = $('#campFecha').value || todayISO();
  const filas = getCampamentoFilasFromDom();

  const totalPlacas = getCamionPlacaPickerOptions('').length;
  const ocupadas = getCampPlacasOcupadas();
  if (totalPlacas > 0 && ocupadas.size >= totalPlacas) {
    showToast({
      title: 'Sin placas libres',
      type: 'warning',
      detail: 'Todas las placas ya están asignadas en este formulario'
    });
    return;
  }

  if (!filas.length) {
    renderCampamentoFormFilas(defaultCampamentoFilas(nombre, fecha));
    applyCampFormDetailsFromNombre(nombre);
    showToast({
      title: 'Camión listo',
      type: 'success',
      detail: alertDetailHtml([
        { b: '1 camión' },
        ' \u2014 completa placa y toneladas'
      ])
    });
    return;
  }

  filas.push({ fecha, toneladas: '', guia, placa: '', pesaje, combustible: '', viaticos: '' });
  renderCampamentoFormFilas(filas);
  updateCampCamionesLock();
  const cards = $('#campViajesList').querySelectorAll('.camp-viaje-card');
  cards[cards.length - 1]?.querySelector('.ms__trigger, [data-field="toneladas"]')?.focus();
  showToast({
    title: 'Camión agregado',
    detail: alertDetailHtml([
      { b: String(filas.length) },
      ` camión${filas.length !== 1 ? 'es' : ''} en el formulario`
    ])
  });
}


function goToCampamentoGuardado(campId, options = {}) {
  if (!campId && !options.nombre) return;

  if (typeof closeOverlayPickers === 'function') closeOverlayPickers();
  if (typeof closeModal === 'function') closeModal('modalViaje');

  // Limpiar filtros para que la ficha recién guardada sea visible
  campListDayFilter = 'all';
  clearCampHistorialResults();
  setCampListPlacaFilter('');
  campListPage = 1;

  const matchCamp = (c) => {
    if (campId && c.id === campId) return true;
    if (options.nombre && options.fecha) {
      const fecha = typeof normalizeDateISO === 'function' ? normalizeDateISO(options.fecha) : options.fecha;
      const cFecha = typeof normalizeDateISO === 'function' ? normalizeDateISO(c.fecha) : c.fecha;
      return String(c.nombre || '').trim().toLowerCase() === String(options.nombre || '').trim().toLowerCase()
        && cFecha === fecha;
    }
    return false;
  };

  let items = typeof getRecentCampamentos === 'function'
    ? getRecentCampamentos()
    : filterCampamentosForList();
  let camp = items.find(matchCamp) || (state.campamentos || []).find(matchCamp);
  if (camp) campId = camp.id;

  items = filterCampamentosForList();
  let idx = items.findIndex((c) => c.id === campId);
  if (idx < 0 && camp) {
    // Asegurar que aparezca en la lista reciente
    items = getRecentCampamentos ? getRecentCampamentos(Math.max(3, (state.campamentos || []).length)) : (state.campamentos || []);
    idx = items.findIndex((c) => c.id === campId);
  }
  campListPage = idx >= 0 ? Math.floor(idx / getListPageSize()) + 1 : 1;
  renderCampamentoList();

  window._pendingCampHighlight = {
    id: campId,
    nombre: options.nombre || camp?.nombre || '',
    fecha: options.fecha || camp?.fecha || '',
    until: Date.now() + 6000
  };

  const scrollToCard = () => {
    const panel = document.querySelector('.camp-list-panel');
    const card = document.querySelector(`.campamento-sheet[data-id="${campId}"]`);
    const target = card || panel;
    if (!target) return false;

    if (panel) {
      panel.classList.remove('camp-list-panel--focus');
      void panel.offsetWidth;
      panel.classList.add('camp-list-panel--focus');
    }
    if (card) {
      card.classList.remove('campamento-sheet--highlight');
      void card.offsetWidth;
      card.classList.add('campamento-sheet--highlight');
    }

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {
      const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    clearTimeout(goToCampamentoGuardado._focusTimer);
    goToCampamentoGuardado._focusTimer = setTimeout(() => {
      panel?.classList.remove('camp-list-panel--focus');
      card?.classList.remove('campamento-sheet--highlight');
      if (window._pendingCampHighlight?.id === campId) {
        window._pendingCampHighlight = null;
      }
    }, 3200);

    return !!card;
  };

  requestAnimationFrame(() => {
    setTimeout(scrollToCard, 60);
    setTimeout(scrollToCard, 220);
    setTimeout(scrollToCard, 500);
    setTimeout(scrollToCard, 900);
  });
}

/** Si hubo un guardado reciente, vuelve a señalar la ficha tras un re-render/sync. */
function applyPendingCampHighlight() {
  const pending = window._pendingCampHighlight;
  if (!pending || Date.now() > pending.until) {
    window._pendingCampHighlight = null;
    return;
  }
  const card = document.querySelector(`.campamento-sheet[data-id="${pending.id}"]`);
  if (!card) {
    goToCampamentoGuardado(pending.id, { nombre: pending.nombre, fecha: pending.fecha });
    return;
  }
  card.classList.add('campamento-sheet--highlight');
  document.querySelector('.camp-list-panel')?.classList.add('camp-list-panel--focus');
}


function wireCampListPanel() {
  const panel = document.querySelector('.camp-list-panel');
  if (!panel || panel.dataset.wired) return;
  panel.dataset.wired = '1';

  initCampListPlacaPicker();

  $('#campListClear')?.addEventListener('click', () => {
    campListDayFilter = 'all';
    clearCampHistorialResults();
    setCampListPlacaFilter('');
    campListPage = 1;
    renderCampamentoList();
  });

  initCampListFechaPicker();

  $('#campListFechaBuscar')?.addEventListener('click', () => {
    const fecha = $('#campListFecha')?.value || campListFechaFilter;
    if (!fecha) {
      showToast({
        title: 'Elige una fecha',
        type: 'warning',
        detail: 'Selecciona el día a buscar'
      });
      return;
    }
    if (_historialSearching) return;
    buscarHistorialPorFecha(fecha);
  });

  $('#campHistorialResults')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-historial-camp]');
    if (row) openHistorialCampPdf(row.dataset.historialCamp);
  });

  wireCampListResize();
}

function initCampListFechaPicker() {
  if (dpCampListFecha || !$('#campListFecha') || !$('#campListFechaPicker')) return;
  dpCampListFecha = new MantillaDatePicker('#campListFecha', '#campListFechaPicker', {
    placeholder: 'Fecha',
    allowEmpty: true,
    compact: true
  });
  $('#campListFecha')?.addEventListener('change', () => {
    const fecha = $('#campListFecha')?.value || '';
    if (!fecha) {
      clearCampHistorialResults();
      campListDayFilter = 'all';
      campListPage = 1;
      renderCampamentoList();
      return;
    }
    buscarHistorialPorFecha(fecha, { silent: true });
  });
}

function wireCampListResize() {
  if (wireCampListResize._wired) return;
  wireCampListResize._wired = true;
  let timer;
  let lastPageSize = typeof getListPageSize === 'function' ? getListPageSize() : 4;
  window.addEventListener('resize', () => {
    if (getPage() !== 'viajes') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Solo re-render si cambia desktop/móvil (no al mostrar/ocultar barra del browser)
      const next = typeof getListPageSize === 'function' ? getListPageSize() : 4;
      if (next === lastPageSize) return;
      lastPageSize = next;
      renderCampamentoList();
    }, 200);
  });
}

let _savingCampamento = false;

function saveCampamento(e) {
  e.preventDefault();
  if (_savingCampamento) return;
  const { cliente, producto } = getCampFormDetails();

  if (!cliente) {
    showToast({
      title: 'Cliente requerido',
      type: 'warning',
      detail: 'Completa persona o campamento'
    });
    $('#campNombre')?.focus();
    return;
  }
  if (!producto) {
    showToast({
      title: 'Producto requerido',
      type: 'warning',
      detail: 'Indica qué producto se transporta'
    });
    $('#campProducto')?.focus();
    return;
  }

  const allFilas = getCampamentoFilasFromDom();
  const incompletas = filasCampamentoIncompletas(allFilas);

  if (incompletas.length) {
    showToast({
      title: 'Filas incompletas',
      type: 'warning',
      detail: alertDetailHtml([
        'Fila ',
        { b: incompletas.map((f) => f.rowNum).join(', ') },
        ': elige ',
        { b: 'placa' },
        ' en cada camión con toneladas antes de guardar'
      ])
    });
    incompletas.forEach((f) => {
      const card = $('#campViajesList')?.querySelectorAll('.camp-viaje-card')[f.rowNum - 1];
      card?.classList.add('camp-viaje-row--incomplete');
      card?.querySelector('.camp-placa-picker-mount .ms__trigger')?.focus();
    });
    return;
  }

  const filas = filasCampamentoValidas(allFilas);

  const placasVistas = new Set();
  for (const f of filas) {
    const placaKey = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(f.placa) : f.placa;
    if (placasVistas.has(placaKey)) {
      showToast({
        title: 'Placa repetida',
        type: 'warning',
        detail: alertDetailHtml([
          { b: placaKey },
          ' ya está en otro camión. Un mismo camión no puede hacer dos viajes a la vez.'
        ])
      });
      return;
    }
    placasVistas.add(placaKey);
  }

  if (!filas.length) {
    showToast({
      title: 'Faltan datos',
      type: 'warning',
      detail: 'Escribe toneladas y placa en al menos una fila'
    });
    return;
  }

  const nombre = $('#campNombre').value.trim();
  const saldoAnterior = parseFloat($('#campSaldoAnterior').value) || 0;
  const tarifa = parseFloat($('#campTarifa').value) || 110;
  const totals = calcCampamentoTotals(filas, tarifa, saldoAnterior);

  const camp = {
    id: $('#campId').value || uid('camp'),
    nombre,
    saldoAnterior,
    fecha: $('#campFecha').value,
    tarifa,
    filas,
    subtotal: totals.subtotal,
    totalConSaldo: totals.totalConSaldo
  };

  const idx = state.campamentos.findIndex((c) => c.id === camp.id);
  const isEdit = idx >= 0;
  if (isEdit) state.campamentos[idx] = camp;
  else state.campamentos.unshift(camp);

  _savingCampamento = true;
  try {
  syncOperacionesFromCampamento(camp);
  registerCatalogValue('clientes', nombre);
  filas.forEach((f) => {
    if (f.cliente) registerCatalogValue('clientes', f.cliente);
    if (f.producto) registerCatalogValue('productos', f.producto);
  });
  populateSelects();
  purgeStaleCampamentos();
  saveData();

  if (window.Mantilla?.sync?.syncViajesFromCamp) {
    Mantilla.sync.syncViajesFromCamp(camp);
  }
  if (window.Mantilla?.sync?.syncCliente) {
    const details = getCampFormDetails();
    Mantilla.sync.syncCliente({
      nombre: details.cliente || nombre,
      dniRuc: details.dniRuc
    });
  }

  campListDayFilter = 'all';
  setCampListPlacaFilter('');
  campListPage = 1;

  const savedCampId = camp.id;
  const savedNombre = camp.nombre;
  const savedFecha = camp.fecha;
  resetViajeForm();
  renderOperaciones();
  renderCampamentoList();

  // Señalar la ficha en "Viajes guardados"
  setTimeout(() => goToCampamentoGuardado(savedCampId, { nombre: savedNombre, fecha: savedFecha }), 120);
  setTimeout(() => goToCampamentoGuardado(savedCampId, { nombre: savedNombre, fecha: savedFecha }), 450);

  const activas = filas.length;
  Mantilla.drafts?.clearViaje?.();
  Mantilla.activity?.log?.({
    title: isEdit ? `Viaje actualizado · ${nombre || 'Sin nombre'}` : `Viaje guardado · ${nombre || 'Sin nombre'}`,
    path: `viajes/${savedFecha || '—'} · ${activas} camión${activas !== 1 ? 'es' : ''}`,
    type: 'viaje'
  });
  showToast({
    title: isEdit ? 'Viajes actualizados' : 'Viajes guardados',
    detail: alertDetailHtml([
      { b: nombre || 'Sin nombre' },
      ' · ',
      { b: String(activas) },
      ` camión${activas !== 1 ? 'es' : ''}`,
      ' · ',
      { b: formatMoney(totals.totalConSaldo) }
    ])
  });
  } finally {
    _savingCampamento = false;
  }
}

window.editCampamento = (id) => openViajeForm(id);

async function deleteCampamentoById(id) {
  const ok = await showConfirm({
    message: 'Se eliminarán estos viajes guardados. Esta acción no se puede deshacer.'
  });
  if (!ok) return;
  const camp = (state.campamentos || []).find((c) => c.id === id);
  const campNombre = camp?.nombre || 'Viaje';
  const campFecha = camp?.fecha || '—';
  const ops = (state.operaciones || []).filter((op) => op.campamentoId === id);
  ops.forEach((op) => Mantilla.sync?.syncDelete?.('viajes', op.id));
  state.campamentos = state.campamentos.filter((c) => c.id !== id);
  state.operaciones = state.operaciones.filter((op) => op.campamentoId !== id);
  saveData();
  renderCampamentoList();
  renderOperaciones();
  Mantilla.activity?.log?.({
    title: `Viaje eliminado · ${campNombre}`,
    path: `viajes/${campFecha}`,
    type: 'viaje'
  });
  showToast({
    title: 'Registro eliminado',
    type: 'info',
    detail: 'Los viajes guardados fueron eliminados'
  });
}

window.deleteCampamento = (id) => deleteCampamentoById(id);

function buildCampamentoPrintHtml(camp) {
  const filas = camp.filas || [];
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0);
  const rows = filas.filter((f) => f.placa && Number(f.toneladas) > 0);
  const saldoRow = camp.saldoAnterior > 0
    ? `<p class="saldo">Saldo anterior: <strong>${formatMoney(camp.saldoAnterior)}</strong></p>`
    : '';
  const tableRows = rows.map((f) => `
    <tr>
      <td>${formatDateDM(f.fecha || camp.fecha)}</td>
      <td>${Number(f.toneladas).toFixed(2)}</td>
      <td>${Number(f.guia).toFixed(0)}</td>
      <td>${escapeHtml(f.placa)}</td>
      <td>${Number(f.pesaje).toFixed(1)}</td>
    </tr>`).join('');
  const calcLines = `
    <p>&gt; ${totals.toneladas.toFixed(2)} x ${camp.tarifa} = ${formatMoney(totals.producto)} +</p>
    <p>&gt; ${totals.count} Guia${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.guiaTotal)}</p>
    <p>&gt; ${totals.count} Pesaje${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.pesajeTotal)}</p>
    <p class="campamento-calc__subtotal"><strong>Subtotal = ${formatMoney(totals.subtotal)}</strong></p>`;

  const now = new Date();
  const genFecha = formatDate(todayISO());
  const genHora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(camp.nombre)} — ${formatDate(camp.fecha)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: auto; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 1.5rem 1.5rem 1.25rem;
      font-size: 13px;
      line-height: 1.55;
      background: #fff;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.85rem;
      border-bottom: 2px solid #0a1628;
    }
    .brand h1 {
      margin: 0;
      font-size: 1.12rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #0a1628;
    }
    .brand span {
      font-size: 0.8rem;
      color: #475569;
    }
    .meta { margin: 0 0 0.55rem; color: #475569; }
    .saldo { margin: 0 0 1.15rem; color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 1.5rem;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 0.78rem 0.5rem;
      text-align: center !important;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }
    th {
      background: #e2e8f0;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0a1628;
    }
    .calc {
      margin: 1.5rem 0 0;
      padding: 1.1rem 1.15rem 1.15rem;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      background: #f8fafc;
    }
    .calc h2 {
      margin: 0 0 0.75rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0a1628;
    }
    .calc p { margin: 0.4rem 0; color: #0f172a; }
    .campamento-calc__subtotal { margin-top: 0.65rem; font-weight: 700; }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      margin-top: 0.95rem;
      padding-top: 0.8rem;
      border-top: 1.5px solid #0a1628;
      font-size: 1.05rem;
      font-weight: 800;
      color: #0a1628;
    }
    .doc-legal {
      margin-top: 1.5rem;
      padding-top: 0.7rem;
      border-top: 1px solid #94a3b8;
      text-align: center;
    }
    .doc-legal__mark {
      margin: 0 0 0.25rem;
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0a1628;
    }
    .doc-legal__text {
      margin: 0 auto;
      max-width: 34rem;
      font-size: 0.58rem;
      line-height: 1.4;
      color: #475569;
    }
    /* En el modal va en flujo normal (evita solaparse con Total). En impresión va al pie. */
    .page-foot {
      position: static;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.35rem;
      padding-top: 0.55rem;
      border-top: 1px solid #cbd5e1;
      font-size: 0.68rem;
      color: #64748b;
    }
    @media print {
      body { padding: 0.4rem 0 16mm; }
      @page { margin: 12mm 12mm 16mm; }
      .page-foot {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 4mm;
        margin-top: 0;
        padding: 0.35rem 0 0;
      }
      .doc-legal { break-inside: avoid; page-break-inside: avoid; }
      .calc { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="brand">
    <h1>${escapeHtml(camp.nombre)}</h1>
    <span>Mantilla - Gestion de Flota</span>
  </div>
  <p class="meta">${formatDate(camp.fecha)} - ${rows.length} camion${rows.length !== 1 ? 'es' : ''}</p>
  ${saldoRow}
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>TM</th>
        <th>Guia</th>
        <th>Placa</th>
        <th>Pesaje</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="calc">
    <h2>Calculos</h2>
    ${calcLines}
    <div class="total">
      <span>${camp.saldoAnterior > 0 ? 'Total con saldo' : 'Total'}</span>
      <strong>${formatMoney(totals.totalConSaldo)}</strong>
    </div>
  </div>
  <footer class="doc-legal">
    <p class="doc-legal__text">Documento Oficial. Cualquier alteracion o manipulacion invalida su contenido.</p>
  </footer>
  <div class="page-foot">
    <span>Generado ${escapeHtml(genFecha)} ${escapeHtml(genHora)}</span>
    <span>Mantilla</span>
  </div>
</body>
</html>`;
}

function printCampamento(id) {
  openCampamentoPdfModal(id);
}

let pdfPreviewCampId = null;

function getCampamentoById(id) {
  return (state.campamentos || []).find((c) => c.id === id);
}

function getCampamentoPdfFilename(camp) {
  const slug = String(camp.nombre || 'viaje')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'viaje';
  return `Mantilla-${slug}-${camp.fecha || todayISO()}.pdf`;
}

function loadPdfPreviewFrame(camp) {
  const frame = $('#pdfPreviewFrame');
  if (!frame) return Promise.reject(new Error('Sin marco PDF'));

  const html = buildCampamentoPrintHtml(camp);
  if (frame._mantillaBlobUrl) {
    try { URL.revokeObjectURL(frame._mantillaBlobUrl); } catch (_) { /* ignore */ }
    frame._mantillaBlobUrl = null;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(frame);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error('Vista previa PDF falló'));
    };

    frame.onload = () => done();
    frame.onerror = () => fail();

    try {
      frame.removeAttribute('src');
      frame.srcdoc = html;
      setTimeout(() => {
        if (frame.contentDocument?.body?.childNodes?.length) done();
      }, 120);
    } catch (err) {
      try {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        frame._mantillaBlobUrl = url;
        frame.removeAttribute('srcdoc');
        frame.src = url;
      } catch (err2) {
        fail(err2);
      }
    }
  });
}

function openCampamentoPdfModal(idOrCamp) {
  const camp = typeof idOrCamp === 'object' && idOrCamp
    ? idOrCamp
    : (getCampamentoById(idOrCamp) || historialCampById.get(idOrCamp));
  if (!camp) {
    showToast?.({
      title: 'No se encontró el viaje',
      type: 'warning',
      detail: 'Recarga e intenta de nuevo'
    });
    return;
  }

  historialCampById.set(camp.id, camp);
  pdfPreviewCampId = camp.id;
  const title = $('#pdfPreviewTitle');
  if (title) title.textContent = `${camp.nombre} · ${formatDate(camp.fecha)}`;

  const modal = $('#modalPdfPreview');
  if (!modal) {
    showToast?.({
      title: 'PDF no disponible',
      type: 'warning',
      detail: 'Abre la app desde Netlify o localhost (no file://)'
    });
    return;
  }

  openModal('modalPdfPreview');
  refreshLucideIcons();

  loadPdfPreviewFrame(camp).catch((err) => {
    console.error('PDF preview error:', err);
    showToast?.({
      title: 'No se pudo mostrar el PDF',
      type: 'warning',
      detail: 'Usa localhost o la web publicada. Evita abrir el HTML directo (file://).'
    });
  });
}

function getPdfPreviewCamp() {
  if (!pdfPreviewCampId) return null;
  return getCampamentoById(pdfPreviewCampId) || historialCampById.get(pdfPreviewCampId) || null;
}

function getPdfPreviewDocumentBody() {
  const frame = $('#pdfPreviewFrame');
  return frame?.contentDocument?.body || null;
}

/** Texto seguro para jsPDF (Helvetica / WinAnsi). Evita flechas y símbolos que rompen el PDF. */
function pdfSafeText(value) {
  return String(value ?? '')
    .replace(/[→⟶➜➢]/g, '>')
    .replace(/[×✕✖]/g, 'x')
    .replace(/[·•∙]/g, '-')
    .replace(/[—–―]/g, '-')
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function formatMoneyPdf(n) {
  const num = Number(n);
  const safe = Number.isFinite(num) ? num : 0;
  const fixed = (typeof roundMoney === 'function' ? roundMoney(safe) : safe).toFixed(2);
  const [intPart, dec] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `S/ ${grouped}.${dec}`;
}

/** Dibuja el PDF del viaje con jsPDF (sin html2canvas → evita página en blanco). */
function buildCampamentoPdfDoc(camp) {
  const JsPDF = getJsPdfConstructor();
  if (!JsPDF) throw new Error('jsPDF no disponible');

  const filas = camp.filas || [];
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0);
  const rows = filas.filter((f) => f.placa && Number(f.toneladas) > 0);
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  const footerH = 28;
  const rowH = 10.5;
  const headerH = 10;
  let y = 18;

  // Paleta corporativa seria
  const navy = [10, 22, 40];
  const ink = [15, 23, 42];
  const muted = [71, 85, 105];
  const line = [148, 163, 184];
  const fill = [248, 250, 252];
  const headerFill = [226, 232, 240];

  const now = new Date();
  const genFecha = formatDate(todayISO());
  const genHora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const genLabel = pdfSafeText(`Generado ${genFecha} ${genHora}`);

  const put = (text, x, yy, opts) => {
    doc.text(pdfSafeText(text), x, yy, opts);
  };

  // Marca / titulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...navy);
  put(String(camp.nombre || 'Viaje').toUpperCase(), marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  put('Mantilla - Gestion de Flota', pageW - marginX, y, { align: 'right' });
  y += 5;

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageW - marginX, y);
  y += 9;

  doc.setFontSize(10);
  doc.setTextColor(...muted);
  put(
    `${formatDate(camp.fecha)} - ${rows.length} camion${rows.length !== 1 ? 'es' : ''}`,
    marginX,
    y
  );
  y += 7;

  if (Number(camp.saldoAnterior) > 0) {
    doc.setTextColor(...muted);
    put(`Saldo anterior: ${formatMoneyPdf(camp.saldoAnterior)}`, marginX, y);
    y += 7;
  }

  const cols = [
    { label: 'FECHA', w: contentW * 0.18 },
    { label: 'TM', w: contentW * 0.16 },
    { label: 'GUIA', w: contentW * 0.16 },
    { label: 'PLACA', w: contentW * 0.28 },
    { label: 'PESAJE', w: contentW * 0.22 }
  ];

  // Misma grilla que el HTML del modal: borde fino #94a3b8 en cada celda
  const drawTableGrid = (topY, rowCount) => {
    const totalH = headerH + rowCount * rowH;
    doc.setDrawColor(...line);
    doc.setLineWidth(0.25);
    doc.rect(marginX, topY, contentW, totalH, 'S');

    let x = marginX;
    for (let c = 0; c < cols.length - 1; c += 1) {
      x += cols[c].w;
      doc.line(x, topY, x, topY + totalH);
    }
    doc.line(marginX, topY + headerH, marginX + contentW, topY + headerH);
    for (let r = 1; r < rowCount; r += 1) {
      const hy = topY + headerH + r * rowH;
      doc.line(marginX, hy, marginX + contentW, hy);
    }
  };

  const drawHeaderCells = (tableTopY) => {
    doc.setFillColor(...headerFill);
    doc.rect(marginX, tableTopY, contentW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...navy);
    let x = marginX;
    cols.forEach((c) => {
      put(c.label, x + c.w / 2, tableTopY + headerH / 2 + 1.2, { align: 'center' });
      x += c.w;
    });
  };

  const ensureSpace = (need) => {
    if (y + need < pageH - footerH) return false;
    doc.addPage();
    y = 18;
    return true;
  };

  const drawRowsChunk = (chunk, startIdx) => {
    const tableTop = y;
    drawHeaderCells(tableTop);
    y = tableTop + headerH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...ink);

    chunk.forEach((f, localIdx) => {
      const idx = startIdx + localIdx;
      if (idx % 2 === 1) {
        doc.setFillColor(...fill);
        doc.rect(marginX, y, contentW, rowH, 'F');
      }
      const vals = [
        formatDateDM(f.fecha || camp.fecha),
        Number(f.toneladas).toFixed(2),
        Number(f.guia).toFixed(0),
        String(f.placa || ''),
        Number(f.pesaje).toFixed(1)
      ];
      let x = marginX;
      cols.forEach((c, ci) => {
        put(vals[ci], x + c.w / 2, y + rowH / 2 + 1.3, { align: 'center' });
        x += c.w;
      });
      y += rowH;
    });

    drawTableGrid(tableTop, chunk.length);
  };

  if (!rows.length) {
    ensureSpace(headerH + rowH + 2);
    const tableTop = y;
    drawHeaderCells(tableTop);
    y = tableTop + headerH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...muted);
    put('Sin filas de viaje', marginX + contentW / 2, y + rowH / 2 + 1.2, { align: 'center' });
    y += rowH;
    drawTableGrid(tableTop, 1);
  } else {
    let i = 0;
    while (i < rows.length) {
      const available = pageH - footerH - y;
      let fit = Math.floor((available - headerH) / rowH);
      if (fit < 1) {
        doc.addPage();
        y = 18;
        fit = Math.max(1, Math.floor((pageH - footerH - y - headerH) / rowH));
      }
      const chunk = rows.slice(i, i + fit);
      drawRowsChunk(chunk, i);
      i += chunk.length;
      if (i < rows.length) {
        doc.addPage();
        y = 18;
      }
    }
  }

  y += 10;
  ensureSpace(56);

  // Caja CALCULOS: mismo borde fino y radio suave que el modal
  const boxH = 50;
  doc.setFillColor(...fill);
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, y, contentW, boxH, 1.6, 1.6, 'FD');

  let cy = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  put('CALCULOS', marginX + 5, cy);
  cy += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);
  const calcRows = [
    `> ${totals.toneladas.toFixed(2)} x ${camp.tarifa} = ${formatMoneyPdf(totals.producto)} +`,
    `> ${totals.count} Guia${totals.count !== 1 ? 's' : ''} = ${formatMoneyPdf(totals.guiaTotal)}`,
    `> ${totals.count} Pesaje${totals.count !== 1 ? 's' : ''} = ${formatMoneyPdf(totals.pesajeTotal)}`,
    `Subtotal = ${formatMoneyPdf(totals.subtotal)}`
  ];
  calcRows.forEach((t) => {
    put(t, marginX + 5, cy);
    cy += 6;
  });

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(marginX + 5, cy, pageW - marginX - 5, cy);
  cy += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  const totalLabel = Number(camp.saldoAnterior) > 0 ? 'Total con saldo' : 'Total';
  put(totalLabel, marginX + 5, cy);
  put(formatMoneyPdf(totals.totalConSaldo), pageW - marginX - 5, cy, { align: 'right' });

  y = y + boxH + 12;

  // Aviso legal (cuerpo)
  ensureSpace(12);
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.line(marginX, y, pageW - marginX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  put(
    'Documento Oficial. Cualquier alteracion o manipulacion invalida su contenido.',
    pageW / 2,
    y,
    { align: 'center', maxWidth: contentW }
  );

  // Pie de pagina en todas las hojas: fecha/hora de generacion
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const footY = pageH - 10;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, footY - 4, pageW - marginX, footY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    put(genLabel, marginX, footY);
    put(`Pagina ${p} de ${pageCount}`, pageW - marginX, footY, { align: 'right' });
  }

  return doc;
}

function printCampamentoPreview() {
  const frame = $('#pdfPreviewFrame');
  if (frame?.contentWindow) {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    } catch (err) {
      console.warn('Print via iframe failed:', err);
    }
  }

  const camp = getPdfPreviewCamp();
  if (!camp) return;
  try {
    const html = buildCampamentoPrintHtml(camp);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      showToast({
        title: 'Popup bloqueado',
        type: 'warning',
        detail: 'Permite ventanas emergentes para imprimir'
      });
      URL.revokeObjectURL(url);
      return;
    }
    const revoke = () => {
      try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
    };
    win.addEventListener('load', () => {
      try {
        win.focus();
        win.print();
      } catch (_) { /* ignore */ }
      setTimeout(revoke, 2000);
    });
    setTimeout(revoke, 15000);
  } catch (err) {
    console.error('Print error:', err);
    showToast({
      title: 'No se pudo imprimir',
      type: 'warning',
      detail: 'Intenta de nuevo o usa Descargar PDF'
    });
  }
}

function getJsPdfConstructor() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  if (typeof window.jsPDF === 'function') return window.jsPDF;
  if (typeof window.jsPDF === 'object' && typeof window.jsPDF.jsPDF === 'function') {
    return window.jsPDF.jsPDF;
  }
  return null;
}

function ensureJsPdf() {
  const ready = getJsPdfConstructor();
  if (ready) return Promise.resolve(ready);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mantilla-jspdf]');
    if (existing) {
      const wait = () => {
        const ctor = getJsPdfConstructor();
        if (ctor) resolve(ctor);
        else reject(new Error('jsPDF no disponible'));
      };
      if (existing.dataset.loaded === '1') wait();
      else {
        existing.addEventListener('load', wait);
        existing.addEventListener('error', () => reject(new Error('jsPDF load failed')));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.dataset.mantillaJspdf = '1';
    script.onload = () => {
      script.dataset.loaded = '1';
      const ctor = getJsPdfConstructor();
      if (ctor) resolve(ctor);
      else reject(new Error('jsPDF no disponible tras cargar'));
    };
    script.onerror = () => reject(new Error('jsPDF load failed'));
    document.head.appendChild(script);
  });
}

async function generateCampamentoPdfBlob(camp) {
  await ensureJsPdf();
  const doc = buildCampamentoPdfDoc(camp);
  return doc.output('blob');
}

async function downloadCampamentoPdf() {
  const camp = getPdfPreviewCamp();
  if (!camp) return;
  const btn = $('#btnPdfDownload');
  btn?.setAttribute('disabled', 'disabled');
  try {
    await ensureJsPdf();
    const doc = buildCampamentoPdfDoc(camp);
    doc.save(getCampamentoPdfFilename(camp));
    showToast({ title: 'PDF descargado', detail: getCampamentoPdfFilename(camp) });
  } catch (err) {
    console.error('PDF download error:', err);
    showToast({
      title: 'No se pudo descargar',
      type: 'warning',
      detail: 'Revisa tu conexión (se carga jsPDF) o usa Imprimir → Guardar como PDF'
    });
  } finally {
    btn?.removeAttribute('disabled');
  }
}

function buildCampamentoShareText(camp) {
  const filas = camp.filas || [];
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0);
  const rows = filas.filter((f) => f.placa && Number(f.toneladas) > 0);
  return [
    `*${camp.nombre}*`,
    `Fecha: ${formatDate(camp.fecha)}`,
    `Camiones: ${rows.length}`,
    `Total: ${formatMoney(totals.totalConSaldo)}`,
    '— Mantilla · Gestión de Flota'
  ].join('\n');
}

async function shareCampamentoWhatsApp() {
  const camp = getPdfPreviewCamp();
  if (!camp) return;
  const text = buildCampamentoShareText(camp);
  const btn = $('#btnPdfWhatsApp');
  btn?.setAttribute('disabled', 'disabled');

  try {
    if (navigator.share) {
      try {
        const blob = await generateCampamentoPdfBlob(camp);
        const file = new File([blob], getCampamentoPdfFilename(camp), { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file], text })) {
          await navigator.share({
            title: `${camp.nombre} — Mantilla`,
            text,
            files: [file]
          });
          return;
        }
      } catch (shareErr) {
        if (shareErr?.name === 'AbortError') return;
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('WhatsApp share error:', err);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  } finally {
    btn?.removeAttribute('disabled');
  }
}

function wirePdfPreviewModal() {
  if (wirePdfPreviewModal._wired) return;
  wirePdfPreviewModal._wired = true;
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btnPdfPrint')) {
      e.preventDefault();
      printCampamentoPreview();
      return;
    }
    if (e.target.closest('#btnPdfDownload')) {
      e.preventDefault();
      downloadCampamentoPdf();
      return;
    }
    if (e.target.closest('#btnPdfWhatsApp')) {
      e.preventDefault();
      shareCampamentoWhatsApp();
    }
  });
}

function openViajeTutorial() {
  if (typeof closeOverlayPickers === 'function') closeOverlayPickers();
  openModal('modalViajeTutorial');
  refreshLucideIcons();
}

function wireViajeTutorial() {
  const btn = $('#btnViajeTutorial');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openViajeTutorial();
  });
}

window.openCampamentoPdfModal = openCampamentoPdfModal;
window.openViajeTutorial = openViajeTutorial;
window.printCampamento = printCampamento;
