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
          <label class="camp-viaje-field__lbl">Placa del camión</label>
          <div class="camp-viaje-row__placa-wrap">
            <div class="camp-viaje-row__placa-picker">
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
          const totals = calcCampamentoTotals(camp.filas, camp.tarifa, camp.saldoAnterior || 0);
          const n = (camp.filas || []).filter((f) => f.placa && Number(f.toneladas) > 0).length;
          return `<button type="button" class="camp-historial-row" data-historial-camp="${camp.id}" role="listitem">
            <span class="camp-historial-row__main">
              <strong class="camp-historial-row__name">${escapeHtml(camp.nombre)}</strong>
              <span class="camp-historial-row__meta">${n} camión${n !== 1 ? 'es' : ''} · ${totals.toneladas.toFixed(2)} TM</span>
            </span>
            <strong class="camp-historial-row__total">${formatMoney(totals.totalConSaldo)}</strong>
            <span class="camp-historial-row__chev" aria-hidden="true">${lucideIcon('chevron-right', 'lucide-icon--sm')}</span>
          </button>`;
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
  window.addEventListener('resize', () => {
    if (getPage() !== 'viajes') return;
    clearTimeout(timer);
    timer = setTimeout(renderCampamentoList, 150);
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
  const ops = (state.operaciones || []).filter((op) => op.campamentoId === id);
  ops.forEach((op) => Mantilla.sync?.syncDelete?.('viajes', op.id));
  state.campamentos = state.campamentos.filter((c) => c.id !== id);
  state.operaciones = state.operaciones.filter((op) => op.campamentoId !== id);
  saveData();
  renderCampamentoList();
  renderOperaciones();
  showToast({
    title: 'Registro eliminado',
    type: 'info',
    detail: 'Los viajes guardados fueron eliminados'
  });
}

window.deleteCampamento = (id) => deleteCampamentoById(id);

function buildCampamentoPrintHtml(camp) {
  const totals = calcCampamentoTotals(camp.filas, camp.tarifa, camp.saldoAnterior || 0);
  const rows = camp.filas.filter((f) => f.placa && Number(f.toneladas) > 0);
  const saldoRow = camp.saldoAnterior > 0
    ? `<p class="saldo">Saldo anterior: <strong>${formatMoney(camp.saldoAnterior)}</strong></p>`
    : '';
  const tableRows = rows.map((f) => `
    <tr>
      <td>${formatDateDM(f.fecha || camp.fecha)}</td>
      <td class="num">${Number(f.toneladas).toFixed(2)}</td>
      <td class="num">${Number(f.guia).toFixed(0)}</td>
      <td>${escapeHtml(f.placa)}</td>
      <td class="num">${Number(f.pesaje).toFixed(1)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(camp.nombre)} — ${formatDate(camp.fecha)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #0c1f3d;
      margin: 0;
      padding: 1.25rem 1.5rem 2rem;
      font-size: 13px;
      line-height: 1.45;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #1e5a9e;
    }
    .brand h1 {
      margin: 0;
      font-size: 1.15rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .brand span {
      font-size: 0.82rem;
      color: #64748b;
    }
    .meta { margin: 0 0 0.35rem; color: #475569; }
    .saldo { margin: 0 0 1rem; color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0 1rem;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #c5d9ef;
      padding: 0.45rem 0.5rem;
      text-align: left;
    }
    th {
      background: #e8f1fb;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #1e5a9e;
    }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .calc {
      margin-top: 1rem;
      padding: 0.75rem 0.9rem;
      border: 1px solid #c5d9ef;
      border-radius: 8px;
      background: #f8fbff;
    }
    .calc h2 {
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e5a9e;
    }
    .calc p { margin: 0.2rem 0; }
    .campamento-calc__line,
    .campamento-calc__subtotal { margin: 0.2rem 0; }
    .campamento-calc__subtotal { margin-top: 0.35rem; font-weight: 700; }
    .total {
      display: flex;
      justify-content: space-between;
      margin-top: 0.65rem;
      padding-top: 0.55rem;
      border-top: 1px solid #c5d9ef;
      font-size: 1rem;
      font-weight: 800;
    }
    @media print {
      body { padding: 0.5rem 0; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="brand">
    <h1>${escapeHtml(camp.nombre)}</h1>
    <span>Mantilla · Gestión de Flota</span>
  </div>
  <p class="meta">${formatDate(camp.fecha)} · ${rows.length} camión${rows.length !== 1 ? 'es' : ''}</p>
  ${saldoRow}
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th class="num">TM</th>
        <th class="num">Guía</th>
        <th>Placa</th>
        <th class="num">Pesaje</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="calc">
    <h2>Cálculos</h2>
    ${campamentoCalcHtml(totals, camp.tarifa)}
    <div class="total">
      <span>${camp.saldoAnterior > 0 ? 'Total con saldo' : 'Total'}</span>
      <strong>${formatMoney(totals.totalConSaldo)}</strong>
    </div>
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
  if (!frame) return;
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(buildCampamentoPrintHtml(camp));
  doc.close();
}

function openCampamentoPdfModal(idOrCamp) {
  const camp = typeof idOrCamp === 'object' && idOrCamp
    ? idOrCamp
    : (getCampamentoById(idOrCamp) || historialCampById.get(idOrCamp));
  if (!camp) return;

  historialCampById.set(camp.id, camp);
  pdfPreviewCampId = camp.id;
  const title = $('#pdfPreviewTitle');
  if (title) title.textContent = `${camp.nombre} · ${formatDate(camp.fecha)}`;
  loadPdfPreviewFrame(camp);
  openModal('modalPdfPreview');
  refreshLucideIcons();
}

function getPdfPreviewCamp() {
  if (!pdfPreviewCampId) return null;
  return getCampamentoById(pdfPreviewCampId) || historialCampById.get(pdfPreviewCampId) || null;
}

function getPdfPreviewDocumentBody() {
  const frame = $('#pdfPreviewFrame');
  return frame?.contentDocument?.body || null;
}

function printCampamentoPreview() {
  const frame = $('#pdfPreviewFrame');
  if (!frame?.contentWindow) return;
  try {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  } catch (err) {
    console.error('Print error:', err);
    showToast({
      title: 'No se pudo imprimir',
      type: 'warning',
      detail: 'Intenta de nuevo o usa Descargar PDF'
    });
  }
}

function ensureHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mantilla-html2pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.dataset.mantillaHtml2pdf = '1';
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('html2pdf load failed'));
    document.head.appendChild(script);
  });
}

async function generateCampamentoPdfBlob(camp) {
  const body = getPdfPreviewDocumentBody();
  if (!body) throw new Error('Sin vista previa');
  const html2pdf = await ensureHtml2Pdf();
  const opt = {
    margin: [12, 10, 12, 10],
    filename: getCampamentoPdfFilename(camp),
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  return html2pdf().set(opt).from(body).outputPdf('blob');
}

async function downloadCampamentoPdf() {
  const camp = getPdfPreviewCamp();
  if (!camp) return;
  const btn = $('#btnPdfDownload');
  btn?.setAttribute('disabled', 'disabled');
  try {
    const blob = await generateCampamentoPdfBlob(camp);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getCampamentoPdfFilename(camp);
    link.click();
    URL.revokeObjectURL(url);
    showToast({ title: 'PDF descargado', detail: getCampamentoPdfFilename(camp) });
  } catch (err) {
    console.error('PDF download error:', err);
    showToast({
      title: 'No se pudo descargar',
      type: 'warning',
      detail: 'Usa Imprimir y guarda como PDF'
    });
  } finally {
    btn?.removeAttribute('disabled');
  }
}

function buildCampamentoShareText(camp) {
  const totals = calcCampamentoTotals(camp.filas, camp.tarifa, camp.saldoAnterior || 0);
  const rows = camp.filas.filter((f) => f.placa && Number(f.toneladas) > 0);
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
  const modal = $('#modalPdfPreview');
  if (!modal || modal.dataset.wired) return;
  modal.dataset.wired = '1';
  $('#btnPdfPrint')?.addEventListener('click', printCampamentoPreview);
  $('#btnPdfDownload')?.addEventListener('click', downloadCampamentoPdf);
  $('#btnPdfWhatsApp')?.addEventListener('click', shareCampamentoWhatsApp);
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
