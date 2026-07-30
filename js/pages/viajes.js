const KPI_INFO_CONTENT = {
  utilidad: {
    title: 'Utilidad total',
    detail: 'Muestra la ganancia real del período filtrado después de considerar todos los ingresos y gastos registrados.',
    formula: 'Viajes + ingresos extras − gastos de viajes − gastos de camión'
  },
  gastos: {
    title: 'Gastos totales',
    detail: 'Incluye combustible y viáticos de los viajes, además de llantas, reparaciones, servicios y demás gastos de los vehículos.',
    formula: 'Gastos de viajes + gastos de todos los vehículos'
  },
  ingresos: {
    title: 'Ingresos extras',
    detail: 'Suma los transportes adicionales registrados para camiones o excavadoras, por ejemplo ladrillos o un flete extra.',
    formula: 'Suma de todos los ingresos extras del período'
  },
  viajes: {
    title: 'Viajes registrados',
    detail: 'Cuenta cada viaje u operación guardada que coincide con los filtros seleccionados.',
    formula: 'Cantidad de viajes del período filtrado'
  }
};

function showKpiInfoModal(type) {
  const info = KPI_INFO_CONTENT[type];
  if (!info) return;
  if (typeof Swal === 'undefined') {
    showToast({ title: info.title, detail: info.detail, type: 'info', timer: 4000 });
    return;
  }

  closeMantillaAlert();
  Swal.fire({
    icon: false,
    title: ' ',
    html: `
      <div class="mantilla-swal__stack mantilla-swal__stack--confirm kpi-info-modal">
        <div class="mantilla-swal__status-icon mantilla-swal__status-icon--info" aria-hidden="true">
          ${lucideIcon('info', 'lucide-icon--alert')}
        </div>
        <h2 class="mantilla-swal__title mantilla-swal__title--inline">${escapeHtml(info.title)}</h2>
        <p class="mantilla-swal__detail mantilla-swal__detail--confirm">${escapeHtml(info.detail)}</p>
        <div class="kpi-info-modal__formula">
          <span>Así se calcula</span>
          <strong>${escapeHtml(info.formula)}</strong>
        </div>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: 'Entendido',
    allowOutsideClick: true,
    allowEscapeKey: true,
    heightAuto: true,
    buttonsStyling: false,
    customClass: {
      container: 'mantilla-swal-container',
      popup: 'mantilla-swal mantilla-swal--confirm',
      title: 'mantilla-swal__title mantilla-swal__title--hidden',
      htmlContainer: 'mantilla-swal__detail-wrap',
      confirmButton: 'mantilla-swal__btn mantilla-swal__btn--confirm',
      actions: 'mantilla-swal__actions'
    },
    didOpen: () => refreshLucideIcons()
  });
}

// ---- Viajes (persona o campamento / excavadora) ----

function getCampFormTipo() {
  const raw = $('#campTipo')?.value
    || document.querySelector('.viaje-tipo-btn--active')?.dataset?.tipo
    || VIAJE_TIPO_CAMION;
  return normalizeViajeTipo(raw);
}

function isCampFormExcavadora() {
  return isExcavadoraTipo(getCampFormTipo());
}

function calcCampamentoTotals(filas, tarifa, saldoAnterior = 0, tipo = VIAJE_TIPO_CAMION) {
  const excavadora = isExcavadoraTipo(tipo);
  const activas = (filas || []).filter((f) => isFilaCampamentoActiva(f, tipo));
  const toneladas = roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.toneladas), 0));
  const guiaTotal = excavadora
    ? 0
    : roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.guia), 0));
  const pesajeTotal = excavadora
    ? 0
    : roundMoney(activas.reduce((s, f) => s + parseMoneyNumber(f.pesaje), 0));
  const count = activas.length;
  const tarifaNum = parseMoneyNumber(tarifa);
  let producto;
  if (excavadora) {
    producto = roundMoney(activas.reduce((s, f) => {
      const ph = parseMoneyNumber(
        f.precioHora != null && f.precioHora !== '' ? f.precioHora : tarifaNum
      );
      return s + parseMoneyNumber(f.toneladas) * ph;
    }, 0));
  } else {
    producto = roundMoney(toneladas * tarifaNum);
  }
  const subtotal = excavadora
    ? producto
    : roundMoney(producto + guiaTotal + pesajeTotal);
  const saldo = parseMoneyNumber(saldoAnterior);
  const totalConSaldo = roundMoney(subtotal + saldo);
  const gastosTotal = roundMoney(activas.reduce(
    (s, f) => s + calcGastos(f.combustible, f.viaticos),
    0
  ));
  return {
    toneladas,
    guiaTotal,
    pesajeTotal,
    count,
    producto,
    subtotal,
    saldoAnterior: saldo,
    totalConSaldo,
    gastosTotal,
    tipo: excavadora ? VIAJE_TIPO_EXCAVADORA : VIAJE_TIPO_CAMION
  };
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

function updateSumLive(filas, tipo = getCampFormTipo()) {
  const excavadora = isExcavadoraTipo(tipo);
  const parts = filasCampamentoValidas(filas, tipo)
    .map((f) => Number(f.toneladas))
    .filter((n) => n > 0);
  const partsEl = $('#campSumParts');
  const totalEl = $('#campSumTotal');
  if (!partsEl || !totalEl) return;

  if (parts.length) {
    partsEl.textContent = parts.map((p) => p.toFixed(2)).join(' + ');
    totalEl.textContent = excavadora
      ? `${parts.reduce((a, b) => a + b, 0).toFixed(2)} h`
      : `${parts.reduce((a, b) => a + b, 0).toFixed(2)} TM`;
  } else {
    partsEl.textContent = excavadora ? 'Horas por fila' : 'Toneladas por camión';
    totalEl.textContent = excavadora ? '0.00 h' : '0.00 TM';
  }
  flashCalcEl(totalEl, 'sumTotal');
}

function campamentoCalcLine(text) {
  return `<p class="campamento-calc__line">${lucideIcon('arrow-right', 'lucide-icon--calc-line')}<span>${text}</span></p>`;
}

function campamentoCalcHtml(totals, tarifa, filas = null) {
  if (isExcavadoraTipo(totals.tipo)) {
    const activas = (filas || []).filter((f) => isFilaCampamentoActiva(f, VIAJE_TIPO_EXCAVADORA));
    let html = '';
    if (activas.length) {
      html = activas.map((f) => {
        const horas = parseMoneyNumber(f.toneladas);
        const ph = parseMoneyNumber(
          f.precioHora != null && f.precioHora !== '' ? f.precioHora : tarifa
        );
        const lineTotal = roundMoney(horas * ph);
        return campamentoCalcLine(`${horas.toFixed(2)} h × ${ph} = ${formatMoney(lineTotal)}`);
      }).join('');
    } else {
      html = campamentoCalcLine(`${totals.toneladas.toFixed(2)} h × tarifa = ${formatMoney(totals.producto)}`);
    }
    html += `<p class="campamento-calc__subtotal"><strong>Subtotal = ${formatMoney(totals.subtotal)}</strong></p>`;
    return html;
  }
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

function getDefaultExcavadoraValue() {
  if (typeof getExcavadorasPickerOptions !== 'function') return 'Excavadora 1';
  const options = getExcavadorasPickerOptions('');
  return options.length === 1 ? options[0].value : '';
}

function campExcavadoraPickerHtml(selected = '') {
  const val = selected || getDefaultExcavadoraValue();
  return `
    <input type="hidden" class="camp-input" data-field="placa" value="${escapeHtml(val)}">
    <div class="camp-placa-picker-mount camp-excavadora-picker-mount"></div>`;
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

  if (!isCampFormExcavadora() && typeof formatPlacaDisplay === 'function' && placa) {
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

function initCampExcavadoraPickers(root = $('#campViajesList')) {
  if (!root) return;
  root.querySelectorAll('.camp-viaje-row--excavadora').forEach((card) => {
    const input = campCardInput(card, 'placa');
    const mount = card.querySelector('.camp-excavadora-picker-mount');
    if (!input || !mount) return;
    card._placaPicker = new MantillaSelectPicker(input, mount, {
      placeholder: 'Elegir excavadora',
      title: 'Excavadora asignada',
      searchable: true,
      formatPlaca: false,
      searchPlaceholder: 'Buscar excavadora u operador…',
      noOptionsText: 'Registra una excavadora en Vehículos',
      getOptions: () => getExcavadorasPickerOptions(input.value)
    });
    if (!input.dataset.wiredPlaca) {
      input.dataset.wiredPlaca = '1';
      input.addEventListener('change', () => {
        updateChoferGastosButton(card);
        scheduleRecalcCampamentoForm();
      });
    }
  });
}

let campListPlacaPicker;

function initCampListPlacaPicker() {
  const input = $('#campListPlaca');
  const mount = $('#campListPlacaPicker');
  if (!input || !mount) return;
  // Tras SPA el mount es nuevo: recrear si el picker apunta a un DOM viejo.
  if (campListPlacaPicker && mount.querySelector('.ms')) return;
  campListPlacaPicker = new MantillaSelectPicker(input, mount, {
    placeholder: 'Todas las placas',
    title: 'Buscar por placa',
    allowEmpty: true,
    searchable: true,
    getOptions: () => getCamionPlacaPickerOptions(input.value)
  });
  if (!input.dataset.campListPlacaWired) {
    input.dataset.campListPlacaWired = '1';
    input.addEventListener('change', () => {
      // "Todas las placas" significa mostrar todo: elimina también
      // cualquier fecha/historial que pudiera seguir activo.
      if (!input.value.trim()) {
        campListDayFilter = 'all';
        clearCampHistorialResults();
      }
      campListPage = 1;
      renderCampamentoList();
    });
  }
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

function calcCampFilaFleteFromData(f, tarifa, tipo = getCampFormTipo()) {
  if (isExcavadoraTipo(tipo)) {
    const ph = parseMoneyNumber(
      f.precioHora != null && f.precioHora !== '' ? f.precioHora : tarifa
    );
    return calcFleteExcavadora(f.toneladas, ph);
  }
  return calcFlete(f.toneladas, tarifa, 0, f.guia, f.pesaje);
}

function calcCampFilaFlete(card) {
  const tarifa = parseFloat($('#campTarifa')?.value) || 0;
  const tipo = getCampFormTipo();
  const fallback = isExcavadoraTipo(tipo) ? 0 : 110;
  return calcCampFilaFleteFromData(getCampFilaFromCard(card), tarifa || fallback, tipo);
}

function getCampFilaFromCard(card) {
  const tipo = getCampFormTipo();
  const { placa } = getCampPlacaInfoFromCard(card);
  const precioRaw = campCardInput(card, 'precioHora')?.value;
  return {
    tipo,
    toneladas: campCardNum(card, 'toneladas'),
    guia: isExcavadoraTipo(tipo) ? 0 : campCardNum(card, 'guia'),
    pesaje: isExcavadoraTipo(tipo) ? 0 : campCardNum(card, 'pesaje'),
    placa,
    precioHora: precioRaw === '' || precioRaw == null ? '' : campCardNum(card, 'precioHora'),
    combustible: campCardNum(card, 'combustible'),
    viaticos: campCardNum(card, 'viaticos')
  };
}

function updateChoferGastosButton(card) {
  const btn = card?.querySelector('.camp-chofer-gastos-btn');
  if (!btn) return;
  const tipo = getCampFormTipo();
  const excavadora = isExcavadoraTipo(tipo);
  const { placa, combustible, viaticos, toneladas } = getCampFilaFromCard(card);
  const hasGastos = combustible > 0 || viaticos > 0;
  const flete = calcCampFilaFlete(card);
  const gastos = calcGastos(combustible, viaticos);
  const utilidad = calcUtilidad(flete, gastos);
  const ready = excavadora ? (toneladas > 0 || !!($('#campNombre')?.value || '').trim()) : !!placa;
  btn.classList.toggle('camp-chofer-gastos-btn--filled', hasGastos);
  btn.classList.toggle('camp-chofer-gastos-btn--ready', ready);
  if (excavadora) {
    const persona = ($('#campNombre')?.value || '').trim() || 'Excavadora';
    btn.title = `Gastos — ${persona}`;
    btn.setAttribute('aria-label', `Gastos de ${persona}`);
  } else if (placa) {
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
  const excavadora = isCampFormExcavadora();
  const title = $('#choferGastosTitle');
  const subtitle = $('#choferGastosSubtitle');
  if (excavadora) {
    const persona = ($('#campNombre')?.value || '').trim() || 'Excavadora';
    if (title) title.textContent = persona;
    if (subtitle) subtitle.textContent = 'Gastos (no suman al cobro)';
    return;
  }
  const { placa, chofer } = getCampPlacaInfoFromCard(_choferGastosCard);
  if (title) title.textContent = placa || 'Sin placa';
  if (subtitle) subtitle.textContent = chofer || 'Chofer no asignado';
}

function openChoferGastosModal(card) {
  if (!card) return;
  const excavadora = isCampFormExcavadora();
  if (!excavadora) {
    const { placa } = getCampPlacaInfoFromCard(card);
    if (!placa) {
      showToast({
        title: 'Elige una placa',
        type: 'warning',
        detail: 'Selecciona la placa del camión en esta fila antes de registrar gastos.'
      });
      card.querySelector('.ms__trigger')?.focus();
      return;
    }
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
  if (window.innerWidth >= 900) combEl?.focus();
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

function campViajeCardHtml(f, index, fechaDefault, tipo = getCampFormTipo()) {
  const num = index + 1;
  const excavadora = isExcavadoraTipo(tipo);
  const combVal = f.combustible === '' || f.combustible == null ? '' : f.combustible;
  const viatVal = f.viaticos === '' || f.viaticos == null ? '' : f.viaticos;
  const fechaVal = f.fecha || fechaDefault || todayISO();
  const precioVal = f.precioHora === '' || f.precioHora == null ? '' : f.precioHora;

  if (excavadora) {
    return `
    <article class="camp-viaje-card camp-viaje-row camp-viaje-row--excavadora camp-row-enter" data-row="${index}" data-tipo="excavadora" role="listitem">
      <div class="camp-viaje-row__top">
        <span class="camp-viaje-row__num" aria-hidden="true">${num}</span>
        <div class="camp-viaje-row__placa camp-viaje-row__placa--excavadora">
          <div class="camp-viaje-row__placa-wrap">
            <div class="camp-viaje-row__placa-picker">
              <label class="camp-viaje-field__lbl">Excavadora</label>
              ${campExcavadoraPickerHtml(f.placa || '')}
            </div>
            <div class="camp-viaje-row__fecha">
              <label class="camp-viaje-field__lbl">Fecha</label>
              ${campFechaPickerHtml(fechaVal)}
            </div>
            <button type="button" class="camp-chofer-gastos-btn" data-action="chofer-gastos" title="Gastos" aria-label="Gastos fila ${num}">
              ${lucideIcon('wallet', 'lucide-icon--sm')}
              <span class="camp-chofer-gastos-btn__text">Gastos</span>
              <span class="camp-chofer-gastos-btn__util" hidden></span>
            </button>
          </div>
        </div>
        <button type="button" class="camp-viaje-card__remove camp-remove-row" title="Quitar fila" aria-label="Quitar fila ${num}">${lucideIcon('x', 'lucide-icon--sm')}</button>
      </div>
      <div class="camp-viaje-row__bottom">
        <div class="camp-viaje-field camp-viaje-field--toneladas camp-viaje-field--horas">
          <label class="camp-viaje-field__lbl">Horas</label>
          ${campFieldInput('toneladas', f.toneladas || '', '0.01')}
        </div>
        <div class="camp-viaje-field camp-viaje-field--precio">
          <label class="camp-viaje-field__lbl">Precio/hora (S/)</label>
          ${campFieldInput('precioHora', precioVal, '0.01')}
        </div>
      </div>
      <input type="hidden" class="camp-input" data-field="combustible" value="${combVal}">
      <input type="hidden" class="camp-input" data-field="viaticos" value="${viatVal}">
      <input type="hidden" class="camp-input" data-field="opId" value="${f.opId || ''}">
    </article>`;
  }

  return `
    <article class="camp-viaje-card camp-viaje-row camp-row-enter" data-row="${index}" data-tipo="camion" role="listitem">
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

function campamentoFilasReadonlyHtml(filas, fechaCamp, tipo = VIAJE_TIPO_CAMION) {
  const excavadora = isExcavadoraTipo(tipo);
  const rows = (filas || []).filter((f) => isFilaCampamentoActiva(f, tipo));
  if (!rows.length) return '';
  if (excavadora) {
    return `
    <div class="campamento-detail-table-wrap">
      <table class="campamento-detail-table campamento-detail-table--excavadora">
        <thead>
          <tr>
            <th class="col-equipo" title="Excavadora">Exc.</th>
            <th class="col-fecha">Fecha</th>
            <th class="num col-tm">Horas</th>
            <th class="num col-precio">Precio/h</th>
            <th class="num col-gastos">Gastos</th>
            <th class="num col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((f) => {
            const ph = parseMoneyNumber(f.precioHora != null && f.precioHora !== '' ? f.precioHora : 0);
            const total = calcFleteExcavadora(f.toneladas, ph);
            const gastos = calcGastos(f.combustible, f.viaticos);
            return `
            <tr>
              <td class="col-equipo" data-label="Exc."><span class="camp-placa-tag">${escapeHtml(f.placa || '—')}</span></td>
              <td class="col-fecha" data-label="Fecha">${formatDateDM(f.fecha || fechaCamp)}</td>
              <td class="num col-tm" data-label="Horas">${Number(f.toneladas).toFixed(2)}</td>
              <td class="num col-precio" data-label="Precio/h">${ph.toFixed(2)}</td>
              <td class="num col-gastos" data-label="Gastos">${formatMoney(gastos)}</td>
              <td class="num col-total" data-label="Total">${formatMoney(total)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }
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
  if (isCampFormExcavadora()) {
    updateCampCamionesLock();
    return;
  }
  const preset = CLIENTE_PRESETS[n];
  if ($('#campProducto')) {
    if (preset?.producto) $('#campProducto').value = preset.producto;
    else if (isNombreCampamento(n)) $('#campProducto').value = 'carbon';
  }
  if (preset?.tarifa) $('#campTarifa').value = preset.tarifa;
  updateCampCamionesLock();
}

function loadCampFormDetailsFromCamp(camp) {
  const tipo = normalizeViajeTipo(camp.tipo);
  const fila = camp.filas?.find((f) => isFilaCampamentoActiva(f, tipo)) || camp.filas?.[0];
  setCampFormDetails({
    dniRuc: fila?.dniRuc || '',
    producto: fila?.producto || (!isExcavadoraTipo(tipo) && isNombreCampamento(camp.nombre) ? 'carbon' : '')
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
  const excavadora = isCampFormExcavadora();

  section?.classList.toggle('camp-viajes-section--locked', !unlocked);
  if (section) section.setAttribute('aria-disabled', unlocked ? 'false' : 'true');

  if (addBtn) {
    addBtn.disabled = !unlocked;
    addBtn.title = unlocked
      ? (excavadora ? 'Agregar fila' : 'Agregar camión')
      : 'Primero completa el cliente';
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

function applyCampFormTipoLabels(tipo = getCampFormTipo()) {
  const excavadora = isExcavadoraTipo(tipo);
  const form = $('#viajeFormSection');
  form?.classList.toggle('viaje-form-card--excavadora', excavadora);
  form?.classList.toggle('viaje-form-card--camion', !excavadora);

  const nombreLabel = $('#campNombreLabel');
  if (nombreLabel) nombreLabel.textContent = 'Cliente *';
  const nombreInput = $('#campNombre');
  if (nombreInput) {
    nombreInput.placeholder = 'Ej: Juan Pérez, Empresa ABC';
  }

  const productoGroup = $('#campProductoGroup');
  if (productoGroup) productoGroup.hidden = false;
  const productoLabel = $('#campProductoLabel');
  const productoInput = $('#campProducto');
  if (productoLabel) productoLabel.textContent = excavadora ? 'Detalles' : 'Producto';
  if (productoInput) {
    productoInput.placeholder = excavadora
      ? 'Ej: Trabajo realizado, zona o servicio'
      : 'Producto';
  }

  const toolbarLabel = $('#campRowToolbarLabel');
  if (toolbarLabel) toolbarLabel.textContent = excavadora ? 'Excavadora' : 'Camiones';

  const section = $('#viajeSectionCamiones');
  if (section) section.setAttribute('aria-label', excavadora ? 'Excavadora' : 'Camiones');

  const hintLong = $('#campViajesLockHintLong');
  const hintShort = $('#campViajesLockHintShort');
  if (hintLong) {
    hintLong.innerHTML = excavadora
      ? 'Completa el <strong>cliente</strong> arriba para agregar filas'
      : 'Completa el <strong>cliente</strong> arriba para agregar camiones';
  }
  if (hintShort) {
    hintShort.innerHTML = 'Completa el <strong>cliente</strong> para desbloquear';
  }

  const qtyLabel = $('#campTotalQtyLabel');
  if (qtyLabel) qtyLabel.textContent = excavadora ? 'Horas' : 'Toneladas';
  $('#campTotalGuiaItem')?.classList.toggle('is-hidden', excavadora);
  $('#campTotalPesajeItem')?.classList.toggle('is-hidden', excavadora);
  if ($('#campTotalGuiaItem')) $('#campTotalGuiaItem').hidden = excavadora;
  if ($('#campTotalPesajeItem')) $('#campTotalPesajeItem').hidden = excavadora;
  if ($('#campTarifaGroup')) $('#campTarifaGroup').hidden = excavadora;

  document.querySelectorAll('#viajeTipoToggle .viaje-tipo-btn').forEach((btn) => {
    const active = normalizeViajeTipo(btn.dataset.tipo) === normalizeViajeTipo(tipo);
    btn.classList.toggle('viaje-tipo-btn--active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if ($('#campTipo')) $('#campTipo').value = normalizeViajeTipo(tipo);
}

function filaHasTipoIncompatibleData(f, fromTipo, toTipo) {
  if (!f) return false;
  const qty = Number(f.toneladas) > 0;
  const gastos = Number(f.combustible) > 0 || Number(f.viaticos) > 0;
  if (isExcavadoraTipo(toTipo)) {
    // Guía/pesaje vienen con valores por defecto: sin placa ni toneladas no son datos ingresados.
    return !!(f.placa || qty || gastos);
  }
  // Pasar a camión: horas / precio / gastos excavadora
  return !!(qty || Number(f.precioHora) > 0 || gastos);
}

async function setCampFormTipo(nextTipo, { force = false, keepFilas = false } = {}) {
  const tipo = normalizeViajeTipo(nextTipo);
  const current = getCampFormTipo();
  if (tipo === current && !force) {
    applyCampFormTipoLabels(tipo);
    return true;
  }

  if (!force && !keepFilas) {
    const filas = typeof getCampamentoFilasFromDom === 'function' ? getCampamentoFilasFromDom() : [];
    const incompatible = filas.some((f) => filaHasTipoIncompatibleData(f, current, tipo));
    if (incompatible) {
      const ok = await showConfirm({
        title: '¿Cambiar tipo de viaje?',
        message: 'Las filas actuales no son compatibles. Se reiniciarán al cambiar a '
          + (isExcavadoraTipo(tipo) ? 'Excavadora' : 'Camión') + '.',
        confirmLabel: 'Cambiar',
        cancelLabel: 'Cancelar',
        danger: true
      });
      if (!ok) {
        applyCampFormTipoLabels(current);
        return false;
      }
    }
  }

  if ($('#campTipo')) $('#campTipo').value = tipo;
  applyCampFormTipoLabels(tipo);

  if (!keepFilas) {
    const nombre = $('#campNombre')?.value?.trim() || '';
    const fecha = $('#campFecha')?.value || todayISO();
    if (isExcavadoraTipo(tipo)) {
      if ($('#campTarifa')) $('#campTarifa').value = '0';
      renderCampamentoFormFilas(defaultCampamentoFilas(nombre, fecha, tipo));
    } else {
      if ($('#campTarifa') && !(parseFloat($('#campTarifa').value) > 0)) {
        $('#campTarifa').value = isNombreCampamento(nombre) ? '110' : '110';
      }
      renderCampamentoFormFilas(defaultCampamentoFilas(nombre, fecha, tipo));
    }
  } else {
    recalcCampamentoForm();
  }
  updateCampCamionesLock();
  Mantilla.drafts?.saveViajeNow?.();
  return true;
}

function wireCampTipoToggle() {
  const toggle = $('#viajeTipoToggle');
  if (!toggle || toggle.dataset.wired) return;
  toggle.dataset.wired = '1';
  toggle.addEventListener('click', async (e) => {
    const btn = e.target.closest('.viaje-tipo-btn');
    if (!btn) return;
    e.preventDefault();
    await setCampFormTipo(btn.dataset.tipo);
  });
}

function wireCampFormDetails() {
  const block = $('#campFormTop');
  if (!block || block.dataset.wired) return;
  block.dataset.wired = '1';

  const onNombreUpdate = () => {
    const n = $('#campNombre')?.value.trim() || '';
    const preset = CLIENTE_PRESETS[n];
    if (!isCampFormExcavadora() && preset?.producto && !$('#campProducto')?.value) {
      $('#campProducto').value = preset.producto;
    }
    updateCampCamionesLock();
  };

  $('#campNombre')?.addEventListener('input', onNombreUpdate);
  $('#campNombre')?.addEventListener('change', onNombreUpdate);
  wireCampTipoToggle();
  applyCampFormTipoLabels(getCampFormTipo());
  updateCampCamionesLock();
}

function getCampamentoFilasFromDom() {
  const { cliente, dniRuc, producto } = getCampFormDetails();
  const tipo = getCampFormTipo();
  return [...$('#campViajesList').querySelectorAll('.camp-viaje-card')].map((card) => {
    const { placa } = getCampPlacaInfoFromCard(card);
    const precioRaw = campCardInput(card, 'precioHora')?.value;
    return {
      tipo,
      cliente,
      dniRuc,
      producto: isExcavadoraTipo(tipo) ? (producto || '') : producto,
      fecha: getCampFechaFromCard(card),
      toneladas: campCardNum(card, 'toneladas'),
      guia: isExcavadoraTipo(tipo) ? 0 : campCardNum(card, 'guia'),
      placa,
      pesaje: isExcavadoraTipo(tipo) ? 0 : campCardNum(card, 'pesaje'),
      precioHora: precioRaw === '' || precioRaw == null ? '' : campCardNum(card, 'precioHora'),
      combustible: campCardNum(card, 'combustible'),
      viaticos: campCardNum(card, 'viaticos'),
      opId: campCardInput(card, 'opId')?.value?.trim() || ''
    };
  });
}

function filasCampamentoValidas(filas, tipo = getCampFormTipo()) {
  return filas.filter((f) => isFilaCampamentoActiva(f, tipo));
}

function filasCampamentoIncompletas(filas, tipo = getCampFormTipo()) {
  if (isExcavadoraTipo(tipo)) {
    // Excavadora: horas sin precio (o viceversa) se considera incompleta
    return filas
      .map((f, i) => ({ ...f, rowNum: i + 1 }))
      .filter((f) => {
        const horas = Number(f.toneladas) || 0;
        const ph = Number(f.precioHora) || 0;
        const excavadora = String(f.placa || '').trim();
        return !excavadora || (horas > 0 && !(ph > 0)) || (ph > 0 && !(horas > 0));
      });
  }
  return filas
    .map((f, i) => ({ ...f, rowNum: i + 1 }))
    .filter((f) => !f.placa && (Number(f.toneladas) || 0) > 0);
}

function getCampamentoFilasFromForm() {
  return filasCampamentoValidas(getCampamentoFilasFromDom());
}

function getUltimoSaldoCuenta(nombre, excludeId = '', tipo = getCampFormTipo()) {
  const key = (nombre || '').trim().toLowerCase();
  if (!key) return 0;
  const tipoKey = normalizeViajeTipo(tipo);
  const hojas = (state.campamentos || [])
    .filter((c) =>
      c.id !== excludeId
      && c.nombre.trim().toLowerCase() === key
      && normalizeViajeTipo(c.tipo) === tipoKey
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  if (!hojas.length) return 0;
  const last = hojas[0];
  const totals = calcCampamentoTotals(last.filas, last.tarifa, last.saldoAnterior || 0, last.tipo);
  return totals.totalConSaldo;
}

function recalcCampamentoForm() {
  const tipo = getCampFormTipo();
  const excavadora = isExcavadoraTipo(tipo);
  const filas = getCampamentoFilasFromDom();
  const filasValidas = filasCampamentoValidas(filas, tipo);
  const incompletas = filasCampamentoIncompletas(filas, tipo);
  const saldoAnterior = parseFloat($('#campSaldoAnterior').value) || 0;
  let tarifa = parseFloat($('#campTarifa').value) || 0;
  if (excavadora) {
    const firstPh = filasValidas.find((f) => Number(f.precioHora) > 0)?.precioHora;
    if (firstPh != null) {
      tarifa = parseMoneyNumber(firstPh);
      if ($('#campTarifa')) $('#campTarifa').value = String(tarifa);
    }
  } else if (!(tarifa > 0)) {
    tarifa = 110;
  }
  const totals = calcCampamentoTotals(filasValidas, tarifa, saldoAnterior, tipo);

  updateSumLive(filas, tipo);

  const tmFoot = $('#campTotalToneladas');
  const guiaFoot = $('#campTotalGuia');
  const pesajeFoot = $('#campTotalPesaje');
  if (tmFoot) tmFoot.textContent = totals.toneladas.toFixed(2);
  if (guiaFoot) guiaFoot.textContent = excavadora ? '—' : totals.guiaTotal.toFixed(0);
  if (pesajeFoot) pesajeFoot.textContent = excavadora ? '—' : totals.pesajeTotal.toFixed(1);
  flashCalcEl(tmFoot, 'footTm');
  flashCalcEl(guiaFoot, 'footGuia');
  flashCalcEl(pesajeFoot, 'footPesaje');

  const linesEl = $('#campCalcLines');
  if (linesEl) {
    if (incompletas.length) {
      linesEl.innerHTML = excavadora
        ? `<p class="campamento-calc__placeholder campamento-calc__placeholder--warn">Fila ${incompletas.map((f) => f.rowNum).join(', ')}: elige excavadora y completa horas y precio/hora</p>`
        : `<p class="campamento-calc__placeholder campamento-calc__placeholder--warn">Fila ${incompletas.map((f) => f.rowNum).join(', ')}: elige placa para incluirla en el total</p>`;
    } else {
      linesEl.innerHTML = filasValidas.length
        ? campamentoCalcHtml(totals, tarifa, filasValidas)
        : `<p class="campamento-calc__placeholder">${excavadora ? 'Horas por fila' : 'Toneladas por camión'}</p>`;
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
    const unit = excavadora ? 'fila' : 'camión';
    const unitPlural = excavadora ? 'filas' : 'camiones';
    const label = `${n} ${n !== 1 ? unitPlural : unit}${validas ? `, ${validas} listo${validas !== 1 ? 's' : ''}` : ''}`;
    rowBadge.setAttribute('aria-label', label);
    rowBadge.title = label;
  }

  $('#campViajesList')?.querySelectorAll('.camp-viaje-card').forEach((card, i) => {
    const f = filas[i];
    let incomplete = false;
    if (f) {
      if (excavadora) {
        const horas = Number(f.toneladas) || 0;
        const ph = Number(f.precioHora) || 0;
        incomplete = (horas > 0 && !(ph > 0)) || (ph > 0 && !(horas > 0));
      } else {
        incomplete = !f.placa && (Number(f.toneladas) || 0) > 0;
      }
    }
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

function defaultCampamentoFilas(nombre = '', fecha = '', tipo = getCampFormTipo()) {
  const fDefault = fecha || $('#campFecha')?.value || todayISO();
  if (isExcavadoraTipo(tipo)) {
    return [{ tipo: VIAJE_TIPO_EXCAVADORA, fecha: fDefault, toneladas: '', placa: getDefaultExcavadoraValue(), guia: 0, pesaje: 0, precioHora: '' }];
  }
  const { guia, pesaje } = defaultGuiaPesaje(nombre);
  return [{ tipo: VIAJE_TIPO_CAMION, fecha: fDefault, toneladas: '', guia, placa: '', pesaje }];
}

function applyNombreDefaults() {
  const nombre = $('#campNombre').value.trim();
  if ($('#campId').value) return;
  if (isCampFormExcavadora()) {
    applyCampFormDetailsFromNombre(nombre);
    const filas = getCampamentoFilasFromDom();
    if (!filas.length || filas.every((f) => !f.toneladas && !f.precioHora)) {
      renderCampamentoFormFilas(defaultCampamentoFilas(nombre));
    }
    return;
  }
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
  const saldo = getUltimoSaldoCuenta(nombre, excludeId, getCampFormTipo());
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
  const tipo = getCampFormTipo();
  const filasReady = filas.map((f) => ({
    ...f,
    tipo: normalizeViajeTipo(f.tipo || tipo),
    fecha: f.fecha || fechaDefault
  }));
  const list = $('#campViajesList');
  if (!list) return;

  list.innerHTML = filasReady.map((f, i) => campViajeCardHtml(f, i, fechaDefault, tipo)).join('');

  list.querySelectorAll('.camp-viaje-card').forEach((card) => {
    const tm = campCardInput(card, 'toneladas')?.value;
    const placa = campCardInput(card, 'placa')?.value;
    const ph = campCardInput(card, 'precioHora')?.value;
    card.classList.toggle('camp-viaje-row--filled', !!(tm || placa || ph));
  });

  updateCampBoardHeader();
  applyCampFormTipoLabels(tipo);
  recalcCampamentoForm();
  if (isExcavadoraTipo(tipo)) initCampExcavadoraPickers(list);
  else initCampPlacaPickers(list);
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
      const excavadora = isCampFormExcavadora();
      if (cards.length <= 1) {
        showToast({
          title: 'Acción no permitida',
          type: 'warning',
          detail: excavadora
            ? 'Debe quedar al menos una fila en el formulario'
            : 'Debe quedar al menos un camión en el formulario'
        });
        return;
      }
      const ok = await showConfirm({
        message: excavadora
          ? 'Se quitará esta fila del formulario.'
          : 'Se quitará este camión del formulario.'
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
    const ph = campCardInput(card, 'precioHora')?.value;
    card?.classList.toggle('camp-viaje-row--filled', !!(tm || placa || ph));
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

    const unidad = row.unidad_medida || 'TM';
    const tipo = normalizeViajeTipo(unidad === 'H' || unidad === 'h' ? VIAJE_TIPO_EXCAVADORA : VIAJE_TIPO_CAMION);
    const placa = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(row.placa) : (row.placa || '');
    if (!isExcavadoraTipo(tipo) && !placa) return;
    if (!(money(row.ticket_balanza) > 0)) return;

    const nombre = String(row.cliente || '').trim() || 'Sin cliente';
    const key = `${nombre.toLowerCase()}|${fechaKey}|${tipo}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: historialSlug(`${nombre}-${tipo}`, fechaKey),
        nombre,
        fecha: fechaKey,
        tipo,
        tarifa: money(row.flete_tonelada) || (isExcavadoraTipo(tipo) ? 0 : 110),
        saldoAnterior: 0,
        filas: [],
        fromServer: true
      });
    }

    const camp = groups.get(key);
    const tarifa = money(row.flete_tonelada);
    if (tarifa > 0) camp.tarifa = tarifa;

    camp.filas.push({
      tipo,
      fecha: rowFecha,
      cliente: nombre,
      producto: row.producto || '',
      dniRuc: row.dni || '',
      toneladas: money(row.ticket_balanza),
      guia: isExcavadoraTipo(tipo) ? 0 : money(row.guia),
      placa: isExcavadoraTipo(tipo) ? '' : placa,
      pesaje: isExcavadoraTipo(tipo) ? 0 : money(row.pesaje),
      precioHora: isExcavadoraTipo(tipo) ? tarifa : undefined,
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
    const tipo = normalizeViajeTipo(camp.tipo);
    const key = `${String(camp.nombre || '').trim().toLowerCase()}|${camp.fecha}|${tipo}`;
    byKey.set(key, { ...camp, tipo, filas: [...(camp.filas || [])] });
  });

  (localCamps || []).forEach((camp) => {
    const tipo = normalizeViajeTipo(camp.tipo);
    const key = `${String(camp.nombre || '').trim().toLowerCase()}|${camp.fecha}|${tipo}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...camp, tipo, filas: [...(camp.filas || [])], fromServer: false });
      return;
    }
    if (isExcavadoraTipo(tipo)) {
      const opIds = new Set((prev.filas || []).map((f) => f.opId).filter(Boolean));
      (camp.filas || []).forEach((f) => {
        if (f.opId && opIds.has(f.opId)) return;
        if (!f.opId && (prev.filas || []).some((pf) =>
          Number(pf.toneladas) === Number(f.toneladas)
          && Number(pf.precioHora || 0) === Number(f.precioHora || 0)
          && (pf.fecha || camp.fecha) === (f.fecha || camp.fecha)
        )) return;
        prev.filas.push(f);
      });
    } else {
      const placas = new Set((prev.filas || []).map((f) => f.placa));
      (camp.filas || []).forEach((f) => {
        if (f.placa && !placas.has(f.placa)) prev.filas.push(f);
      });
    }
    prev.id = camp.id;
    prev.tipo = tipo;
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
          const tipo = normalizeViajeTipo(camp.tipo);
          const excavadora = isExcavadoraTipo(tipo);
          const totals = calcCampamentoTotals(camp.filas || [], camp.tarifa, camp.saldoAnterior || 0, tipo);
          const n = (camp.filas || []).filter((f) => isFilaCampamentoActiva(f, tipo)).length;
          const meta = excavadora
            ? `${n} fila${n !== 1 ? 's' : ''} · ${totals.toneladas.toFixed(2)} h · Excavadora`
            : `${n} camión${n !== 1 ? 'es' : ''} · ${totals.toneladas.toFixed(2)} TM`;
          return `<div class="camp-historial-row" role="listitem">
            <button type="button" class="camp-historial-row__open" data-historial-camp="${camp.id}" title="Ver PDF" aria-label="Ver PDF de ${escapeHtml(camp.nombre)}">
              <span class="camp-historial-row__main">
                <strong class="camp-historial-row__name">${escapeHtml(camp.nombre)}</strong>
                <span class="camp-historial-row__meta">${meta}</span>
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
  const tipo = normalizeViajeTipo(camp.tipo);
  const excavadora = isExcavadoraTipo(tipo);
  const totals = calcCampamentoTotals(camp.filas, camp.tarifa, camp.saldoAnterior || 0, tipo);
  const filasValidas = camp.filas.filter((f) => isFilaCampamentoActiva(f, tipo));
  const saldoTxt = camp.saldoAnterior > 0
    ? `<div class="campamento-sheet__saldo">Saldo Anterior: <strong>${formatMoney(camp.saldoAnterior)}</strong></div>`
    : '';
  const meta = excavadora
    ? `${formatDate(camp.fecha)} · Excavadora · ${filasValidas.length} fila${filasValidas.length !== 1 ? 's' : ''}`
    : `${formatDate(camp.fecha)} · ${filasValidas.length} camión${filasValidas.length !== 1 ? 'es' : ''} · ${filasValidas.length} viaje${filasValidas.length !== 1 ? 's' : ''}`;
  return `
    <article class="campamento-sheet${excavadora ? ' campamento-sheet--excavadora' : ''}" data-id="${camp.id}" data-tipo="${tipo}">
      <div class="campamento-sheet__nombre">${escapeHtml(camp.nombre)}</div>
      <div class="campamento-sheet__meta">${meta}</div>
      ${saldoTxt}
      ${campamentoFilasReadonlyHtml(camp.filas, camp.fecha, tipo)}
      <div class="campamento-calc">
        <p class="campamento-calc__title">Cálculos</p>
        <div class="campamento-calc__lines">${campamentoCalcHtml(totals, camp.tarifa, camp.filas)}</div>
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
    const excavadora = isCampFormExcavadora();
    showToast({
      title: 'Cliente requerido',
      type: 'warning',
      detail: excavadora
        ? 'Completa el cliente antes de agregar filas'
        : 'Completa el cliente antes de agregar camiones'
    });
    $('#campNombre')?.focus();
    return;
  }

  const tipo = getCampFormTipo();
  const excavadora = isExcavadoraTipo(tipo);
  const nombre = $('#campNombre').value.trim();
  const fecha = $('#campFecha').value || todayISO();
  const filas = getCampamentoFilasFromDom();

  if (!excavadora) {
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
  }

  if (!filas.length) {
    renderCampamentoFormFilas(defaultCampamentoFilas(nombre, fecha, tipo));
    applyCampFormDetailsFromNombre(nombre);
    showToast({
      title: excavadora ? 'Fila lista' : 'Camión listo',
      type: 'success',
      detail: alertDetailHtml(excavadora
        ? [{ b: '1 fila' }, ' \u2014 completa horas y precio/hora']
        : [{ b: '1 camión' }, ' \u2014 completa placa y toneladas'])
    });
    return;
  }

  if (excavadora) {
    filas.push({
      tipo,
      fecha,
      toneladas: '',
      placa: getDefaultExcavadoraValue(),
      guia: 0,
      pesaje: 0,
      precioHora: '',
      combustible: '',
      viaticos: ''
    });
  } else {
    const { guia, pesaje } = defaultGuiaPesaje(nombre);
    filas.push({ fecha, toneladas: '', guia, placa: '', pesaje, combustible: '', viaticos: '', tipo });
  }
  renderCampamentoFormFilas(filas);
  updateCampCamionesLock();
  const cards = $('#campViajesList').querySelectorAll('.camp-viaje-card');
  const focusSel = excavadora
    ? '.camp-excavadora-picker-mount .ms__trigger, [data-field="toneladas"], [data-field="precioHora"]'
    : '.ms__trigger, [data-field="toneladas"]';
  cards[cards.length - 1]?.querySelector(focusSel)?.focus();
  showToast({
    title: excavadora ? 'Fila agregada' : 'Camión agregado',
    detail: alertDetailHtml([
      { b: String(filas.length) },
      excavadora
        ? ` fila${filas.length !== 1 ? 's' : ''} en el formulario`
        : ` camión${filas.length !== 1 ? 'es' : ''} en el formulario`
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
  const input = $('#campListFecha');
  const mount = $('#campListFechaPicker');
  if (!input || !mount) return;
  if (dpCampListFecha && mount.querySelector('.dp')) return;
  dpCampListFecha = new MantillaDatePicker('#campListFecha', '#campListFechaPicker', {
    placeholder: 'Fecha',
    allowEmpty: true,
    compact: true
  });
  if (!input.dataset.campListFechaWired) {
    input.dataset.campListFechaWired = '1';
    input.addEventListener('change', () => {
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
  const tipo = getCampFormTipo();
  const excavadora = isExcavadoraTipo(tipo);
  const { cliente, producto } = getCampFormDetails();

  if (!cliente) {
    showToast({
      title: 'Cliente requerido',
      type: 'warning',
      detail: 'Completa el cliente'
    });
    $('#campNombre')?.focus();
    return;
  }
  if (!excavadora && !producto) {
    showToast({
      title: 'Producto requerido',
      type: 'warning',
      detail: 'Indica qué producto se transporta'
    });
    $('#campProducto')?.focus();
    return;
  }

  const allFilas = getCampamentoFilasFromDom();
  const incompletas = filasCampamentoIncompletas(allFilas, tipo);

  if (incompletas.length) {
    showToast({
      title: 'Filas incompletas',
      type: 'warning',
      detail: excavadora
        ? alertDetailHtml([
          'Fila ',
          { b: incompletas.map((f) => f.rowNum).join(', ') },
          ': completa ',
          { b: 'excavadora, horas y precio/hora' }
        ])
        : alertDetailHtml([
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
      if (excavadora) {
        const missingExcavadora = !String(incompletas.find((f) => f.rowNum === Number(card?.dataset.row) + 1)?.placa || '').trim();
        if (missingExcavadora) card?.querySelector('.camp-excavadora-picker-mount .ms__trigger')?.focus();
        else card?.querySelector('[data-field="precioHora"], [data-field="toneladas"]')?.focus();
      }
      else card?.querySelector('.camp-placa-picker-mount .ms__trigger')?.focus();
    });
    return;
  }

  const filas = filasCampamentoValidas(allFilas, tipo);

  if (!excavadora) {
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
  }

  if (!filas.length) {
    showToast({
      title: 'Faltan datos',
      type: 'warning',
      detail: excavadora
        ? 'Escribe horas y precio/hora en al menos una fila'
        : 'Escribe toneladas y placa en al menos una fila'
    });
    return;
  }

  const nombre = $('#campNombre').value.trim();
  const saldoAnterior = parseFloat($('#campSaldoAnterior').value) || 0;
  let tarifa = parseFloat($('#campTarifa').value) || 0;
  if (excavadora) {
    tarifa = parseMoneyNumber(
      filas.find((f) => Number(f.precioHora) > 0)?.precioHora || tarifa || 0
    );
  } else if (!(tarifa > 0)) {
    tarifa = 110;
  }
  const totals = calcCampamentoTotals(filas, tarifa, saldoAnterior, tipo);

  // Evitar mezclar tipos en la misma ficha editada
  const existingId = $('#campId').value;
  const previousOpIds = new Set(
    existingId
      ? (state.operaciones || [])
        .filter((op) => op.campamentoId === existingId)
        .map((op) => String(op.id || '').trim())
        .filter(Boolean)
      : []
  );
  if (existingId) {
    const existing = state.campamentos.find((c) => c.id === existingId);
    if (existing && normalizeViajeTipo(existing.tipo) !== tipo) {
      showToast({
        title: 'Tipo distinto',
        type: 'warning',
        detail: 'No se puede cambiar el tipo al editar. Cancela y crea un registro nuevo.'
      });
      return;
    }
  }

  const camp = {
    id: existingId || uid('camp'),
    nombre,
    tipo,
    saldoAnterior,
    fecha: $('#campFecha').value,
    tarifa,
    filas: filas.map((f) => ({ ...f, tipo })),
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
  // Si al editar se quitó una fila, eliminar también su registro en Sheets.
  if (previousOpIds.size && window.Mantilla?.sync?.syncDelete) {
    const currentOpIds = new Set(
      (state.operaciones || [])
        .filter((op) => op.campamentoId === camp.id)
        .map((op) => String(op.id || '').trim())
        .filter(Boolean)
    );
    previousOpIds.forEach((opId) => {
      if (!currentOpIds.has(opId)) Mantilla.sync.syncDelete('viajes', opId);
    });
  }
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

  setTimeout(() => goToCampamentoGuardado(savedCampId, { nombre: savedNombre, fecha: savedFecha }), 120);
  setTimeout(() => goToCampamentoGuardado(savedCampId, { nombre: savedNombre, fecha: savedFecha }), 450);

  const activas = filas.length;
  Mantilla.drafts?.clearViaje?.();
  Mantilla.activity?.log?.({
    title: isEdit ? `Viaje actualizado · ${nombre || 'Sin nombre'}` : `Viaje guardado · ${nombre || 'Sin nombre'}`,
    path: excavadora
      ? `viajes/${savedFecha || '—'} · Excavadora · ${activas} fila${activas !== 1 ? 's' : ''}`
      : `viajes/${savedFecha || '—'} · ${activas} camión${activas !== 1 ? 'es' : ''}`,
    type: 'viaje'
  });
  showToast({
    title: isEdit ? 'Viajes actualizados' : 'Viajes guardados',
    detail: alertDetailHtml([
      { b: nombre || 'Sin nombre' },
      ' · ',
      { b: String(activas) },
      excavadora ? ` fila${activas !== 1 ? 's' : ''}` : ` camión${activas !== 1 ? 'es' : ''}`,
      excavadora ? ' · Excavadora · ' : ' · ',
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
  // Usar ambas fuentes: algunas fichas reconstruidas conservan los IDs
  // en sus filas aunque la operación local ya no esté disponible.
  const opIds = new Set([
    ...ops.map((op) => String(op.id || '').trim()),
    ...(camp?.filas || []).map((fila) => String(fila.opId || '').trim())
  ].filter(Boolean));
  const sheet = [...document.querySelectorAll('.campamento-sheet')]
    .find((item) => item.dataset.id === String(id));
  markElementDeleting(sheet);
  opIds.forEach((opId) => Mantilla.sync?.syncDelete?.('viajes', opId));
  await deletingTransition();
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
    detail: navigator.onLine
      ? 'Se quitó de la lista y se sincroniza con Google'
      : 'Se quitó de la lista; se sincronizará al recuperar conexión'
  });
}

window.deleteCampamento = (id) => deleteCampamentoById(id);

function buildCampamentoPrintHtml(camp) {
  const filas = camp.filas || [];
  const tipo = normalizeViajeTipo(camp.tipo);
  const excavadora = isExcavadoraTipo(tipo);
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0, tipo);
  const rows = filas.filter((f) => isFilaCampamentoActiva(f, tipo));
  const details = rows[0] || filas[0] || {};
  const dniRuc = details.dniRuc || '';
  const producto = details.producto || '';
  const tableRows = rows.map((f) => {
    if (excavadora) {
      const ph = parseMoneyNumber(f.precioHora != null && f.precioHora !== '' ? f.precioHora : camp.tarifa);
      return `
    <tr>
      <td>${escapeHtml(f.placa || '—')}</td>
      <td>${formatDateDM(f.fecha || camp.fecha)}</td>
      <td>${Number(f.toneladas).toFixed(2)}</td>
      <td>${formatMoney(ph)}</td>
      <td>${formatMoney(calcFleteExcavadora(f.toneladas, ph))}</td>
    </tr>`;
    }
    return `
    <tr>
      <td>${formatDateDM(f.fecha || camp.fecha)}</td>
      <td>${Number(f.toneladas).toFixed(2)}</td>
      <td>${formatMoney(camp.tarifa)}</td>
      <td>${Number(f.guia).toFixed(0)}</td>
      <td>${escapeHtml(f.placa)}</td>
      <td>${Number(f.pesaje).toFixed(1)}</td>
    </tr>`;
  }).join('');
  const calcLines = excavadora
    ? rows.map((f) => {
      const ph = parseMoneyNumber(f.precioHora != null && f.precioHora !== '' ? f.precioHora : camp.tarifa);
      return `<p>&gt; ${Number(f.toneladas).toFixed(2)} h x ${formatMoney(ph)} = ${formatMoney(calcFleteExcavadora(f.toneladas, ph))}</p>`;
    }).join('') + `
    <p class="campamento-calc__subtotal"><strong>Subtotal = ${formatMoney(totals.subtotal)}</strong></p>`
    : `
    <p>&gt; ${totals.toneladas.toFixed(2)} x ${camp.tarifa} = ${formatMoney(totals.producto)} +</p>
    <p>&gt; ${totals.count} Guia${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.guiaTotal)}</p>
    <p>&gt; ${totals.count} Pesaje${totals.count !== 1 ? 's' : ''} = ${formatMoney(totals.pesajeTotal)}</p>
    <p class="campamento-calc__subtotal"><strong>Subtotal = ${formatMoney(totals.subtotal)}</strong></p>`;

  const now = new Date();
  const genFecha = formatDate(todayISO());
  const genHora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="es" translate="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="google" content="notranslate">
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
    .saldo { margin: 0 0 1.15rem; color: #475569; }
    .details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.45rem 1.25rem;
      margin: 0.85rem 0 0.65rem;
      padding: 0.75rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
    }
    .details p { margin: 0; color: #334155; }
    .details strong { color: #0f172a; }
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
    tfoot td {
      background: #f1f5f9;
      font-weight: 800;
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
    @media (max-width: 480px) {
      body {
        width: 100%;
        padding: 0.85rem 0.65rem 1rem;
        overflow-x: hidden;
        font-size: 11px;
      }
      .brand {
        gap: 0.5rem;
        margin-bottom: 0.85rem;
      }
      .brand h1 { min-width: 0; font-size: 0.88rem; }
      .brand span { max-width: 46%; font-size: 0.65rem; }
      .details {
        width: 100%;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 0.35rem 0.55rem;
        padding: 0.6rem;
      }
      .details p { min-width: 0; overflow-wrap: anywhere; }
      table {
        width: 100%;
        table-layout: fixed;
        margin: 0.75rem auto 1rem;
        font-size: 9px;
      }
      th, td {
        min-width: 0;
        padding: 0.55rem 0.12rem;
        overflow-wrap: anywhere;
      }
      th { font-size: 0.55rem; letter-spacing: 0; }
      .calc { margin-top: 1rem; padding: 0.8rem; }
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
<body class="notranslate" translate="no">
  <div class="brand">
    <h1>${escapeHtml(camp.nombre)}</h1>
    <span>Mantilla - Gestion de Flota</span>
  </div>
  <div class="details">
    <p><strong>Tipo:</strong> ${excavadora ? 'Excavadora' : 'Camión'}</p>
    <p><strong>Saldo:</strong> ${formatMoney(camp.saldoAnterior || 0)}</p>
    <p><strong>Cliente:</strong> ${escapeHtml(camp.nombre || '—')}</p>
    <p><strong>DNI / RUC:</strong> ${escapeHtml(dniRuc || '—')}</p>
    <p><strong>${excavadora ? 'Detalles' : 'Producto'}:</strong> ${escapeHtml(producto || '—')}</p>
    <p><strong>Fecha del día:</strong> ${escapeHtml(formatDate(camp.fecha))}</p>
  </div>
  <table>
    <thead>
      <tr>
        ${excavadora
          ? '<th>Excavadora</th><th>Fecha</th><th>Horas</th><th>Precio/hora</th><th>Total</th>'
          : '<th>Fecha</th><th>TM</th><th>Precio/TM</th><th>Guia</th><th>Placa</th><th>Pesaje</th>'}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    ${rows.length ? `
    <tfoot>
      ${excavadora ? `
      <tr>
        <td>TOTAL</td>
        <td></td>
        <td>${totals.toneladas.toFixed(2)}</td>
        <td></td>
        <td>${formatMoney(totals.producto)}</td>
      </tr>` : `
      <tr>
        <td>TOTAL</td>
        <td>${totals.toneladas.toFixed(2)}</td>
        <td></td>
        <td>${totals.guiaTotal.toFixed(0)}</td>
        <td></td>
        <td>${totals.pesajeTotal.toFixed(1)}</td>
      </tr>`}
    </tfoot>` : ''}
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
  const tipo = normalizeViajeTipo(camp.tipo);
  const excavadora = isExcavadoraTipo(tipo);
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0, tipo);
  const rows = filas.filter((f) => isFilaCampamentoActiva(f, tipo));
  const details = rows[0] || filas[0] || {};
  const dniRuc = details.dniRuc || '';
  const producto = details.producto || '';
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

  doc.setFillColor(...fill);
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, y, contentW, 31, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...ink);
  const colW = contentW * 0.47;
  const rightX = marginX + contentW * 0.52;
  put(`Tipo: ${excavadora ? 'Excavadora' : 'Camion'}`, marginX + 4, y + 7, { maxWidth: colW });
  put(`Saldo: ${formatMoneyPdf(camp.saldoAnterior || 0)}`, rightX, y + 7, { maxWidth: colW });
  put(
    `Cliente: ${camp.nombre || '-'}`,
    marginX + 4,
    y + 15,
    { maxWidth: colW }
  );
  put(`DNI / RUC: ${dniRuc || '-'}`, rightX, y + 15, { maxWidth: colW });
  put(
    `${excavadora ? 'Detalles' : 'Producto'}: ${producto || '-'}`,
    marginX + 4,
    y + 23,
    { maxWidth: colW }
  );
  put(`Fecha del dia: ${formatDate(camp.fecha)}`, rightX, y + 23, { maxWidth: colW });
  y += 37;

  const cols = excavadora
    ? [
      { label: 'EXCAVADORA', w: contentW * 0.25 },
      { label: 'FECHA', w: contentW * 0.15 },
      { label: 'HORAS', w: contentW * 0.15 },
      { label: 'PRECIO/H', w: contentW * 0.22 },
      { label: 'TOTAL', w: contentW * 0.23 }
    ]
    : [
      { label: 'FECHA', w: contentW * 0.14 },
      { label: 'TM', w: contentW * 0.13 },
      { label: 'PRECIO/TM', w: contentW * 0.18 },
      { label: 'GUIA', w: contentW * 0.13 },
      { label: 'PLACA', w: contentW * 0.24 },
      { label: 'PESAJE', w: contentW * 0.18 }
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
      const ph = parseMoneyNumber(f.precioHora != null && f.precioHora !== '' ? f.precioHora : camp.tarifa);
      const vals = excavadora
        ? [
          String(f.placa || ''),
          formatDateDM(f.fecha || camp.fecha),
          Number(f.toneladas).toFixed(2),
          formatMoneyPdf(ph),
          formatMoneyPdf(calcFleteExcavadora(f.toneladas, ph))
        ]
        : [
          formatDateDM(f.fecha || camp.fecha),
          Number(f.toneladas).toFixed(2),
          formatMoneyPdf(camp.tarifa),
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

  if (rows.length) {
    ensureSpace(rowH + 2);
    doc.setFillColor(...headerFill);
    doc.setDrawColor(...line);
    doc.setLineWidth(0.25);
    doc.rect(marginX, y, contentW, rowH, 'FD');
    let gridX = marginX;
    for (let c = 0; c < cols.length - 1; c += 1) {
      gridX += cols[c].w;
      doc.line(gridX, y, gridX, y + rowH);
    }
    const totalVals = excavadora
      ? [
        'TOTAL',
        '',
        totals.toneladas.toFixed(2),
        '',
        formatMoneyPdf(totals.producto)
      ]
      : [
        'TOTAL',
        totals.toneladas.toFixed(2),
        '',
        totals.guiaTotal.toFixed(0),
        '',
        totals.pesajeTotal.toFixed(1)
      ];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    let totalX = marginX;
    cols.forEach((c, ci) => {
      put(totalVals[ci], totalX + c.w / 2, y + rowH / 2 + 1.3, { align: 'center' });
      totalX += c.w;
    });
    y += rowH;
  }

  const calcRows = excavadora
    ? [
      ...rows.map((f) => {
        const horas = parseMoneyNumber(f.toneladas);
        const precioHora = parseMoneyNumber(
          f.precioHora != null && f.precioHora !== '' ? f.precioHora : camp.tarifa
        );
        return `> ${horas.toFixed(2)} horas x ${formatMoneyPdf(precioHora)} = ${formatMoneyPdf(calcFleteExcavadora(horas, precioHora))}`;
      }),
      `Subtotal = ${formatMoneyPdf(totals.subtotal)}`
    ]
    : [
      `> ${totals.toneladas.toFixed(2)} x ${camp.tarifa} = ${formatMoneyPdf(totals.producto)} +`,
      `> ${totals.count} Guia${totals.count !== 1 ? 's' : ''} = ${formatMoneyPdf(totals.guiaTotal)}`,
      `> ${totals.count} Pesaje${totals.count !== 1 ? 's' : ''} = ${formatMoneyPdf(totals.pesajeTotal)}`,
      `Subtotal = ${formatMoneyPdf(totals.subtotal)}`
    ];

  y += 10;
  const boxH = Math.max(50, 30 + calcRows.length * 6);
  ensureSpace(boxH + 6);

  // Caja CALCULOS: mismo borde fino y radio suave que el modal
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
    script.src = 'assets/vendor/jspdf.umd.min.js';
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
  const tipo = normalizeViajeTipo(camp.tipo);
  const excavadora = isExcavadoraTipo(tipo);
  const totals = calcCampamentoTotals(filas, camp.tarifa, camp.saldoAnterior || 0, tipo);
  const rows = filas.filter((f) => isFilaCampamentoActiva(f, tipo));
  return [
    `*${camp.nombre}*`,
    `Fecha: ${formatDate(camp.fecha)}`,
    excavadora ? 'Tipo: Excavadora' : 'Tipo: Camión',
    excavadora ? `Horas: ${totals.toneladas.toFixed(2)}` : `Camiones: ${rows.length}`,
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
