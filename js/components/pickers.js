// ---- Selector de fecha personalizado (sin nativo del celular) ----

const DP_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const DP_MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DP_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

let dpOpenInstance = null;
let msOpenInstance = null;
let catalogOpenInstance = null;
let tpOpenInstance = null;

function closeOverlayPickers() {
  try { dpOpenInstance?.close(); } catch (_) { /* noop */ }
  try { msOpenInstance?.close(); } catch (_) { /* noop */ }
  try { catalogOpenInstance?.close(); } catch (_) { /* noop */ }
  try { tpOpenInstance?.close(); } catch (_) { /* noop */ }
  dpOpenInstance = null;
  msOpenInstance = null;
  catalogOpenInstance = null;
  tpOpenInstance = null;
  const backdrop = document.getElementById('dpBackdrop');
  if (backdrop) backdrop.hidden = true;
}

class MantillaDatePicker {
  constructor(inputRef, mountRef, options = {}) {
    this.input = typeof inputRef === 'string' ? $(inputRef) : inputRef;
    this.mount = typeof mountRef === 'string' ? $(mountRef) : mountRef;
    if (!this.input || !this.mount) {
      this.disabled = true;
      return;
    }
    this.placeholder = options.placeholder || 'Seleccionar fecha';
    this.allowEmpty = options.allowEmpty !== false;
    this.compact = !!options.compact;
    this.viewYear = new Date().getFullYear();
    this.viewMonth = new Date().getMonth();
    this.build();
  }

  build() {
    const compactCls = this.compact ? ' dp--compact' : '';
    const triggerIcon = this.compact
      ? '<i data-lucide="calendar" class="lucide-icon lucide-icon--sm dp__icon" aria-hidden="true"></i>'
      : '';
    this.mount.innerHTML = `
      <div class="dp${compactCls}">
        <button type="button" class="dp__trigger field-input${this.compact ? ' dp__trigger--compact' : ''}">
          ${triggerIcon}
          <span class="dp__text">${this.placeholder}</span>
        </button>
        <div class="dp__popup" hidden>
          <div class="dp__head">
            <button type="button" class="dp__nav" data-dir="-1" aria-label="Anterior">${typeof lucideIcon === 'function' ? lucideIcon('chevron-left', 'lucide-icon--picker-nav') : '\u2039'}</button>
            <span class="dp__title"></span>
            <button type="button" class="dp__nav" data-dir="1" aria-label="Siguiente">${typeof lucideIcon === 'function' ? lucideIcon('chevron-right', 'lucide-icon--picker-nav') : '\u203A'}</button>
          </div>
          <div class="dp__weekdays"></div>
          <div class="dp__days"></div>
          <div class="dp__foot">
            ${this.allowEmpty ? '<button type="button" class="dp__foot-btn" data-action="clear">Borrar</button>' : '<span></span>'}
            <button type="button" class="dp__foot-btn dp__foot-btn--primary" data-action="today">Hoy</button>
          </div>
        </div>
      </div>`;

    this.root = this.mount.querySelector('.dp');
    this.trigger = this.root.querySelector('.dp__trigger');
    this.popup = this.root.querySelector('.dp__popup');
    this.titleEl = this.root.querySelector('.dp__title');
    this.weekdaysEl = this.root.querySelector('.dp__weekdays');
    this.daysEl = this.root.querySelector('.dp__days');

    this.weekdaysEl.innerHTML = DP_DIAS.map((d) => `<span>${d}</span>`).join('');

    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    this.root.querySelectorAll('.dp__nav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.shiftMonth(Number(btn.dataset.dir));
      });
    });

    this.root.querySelector('[data-action="clear"]')?.addEventListener('click', () => this.clear());
    this.root.querySelector('[data-action="today"]').addEventListener('click', () => {
      const t = new Date();
      this.pick(t.getFullYear(), t.getMonth(), t.getDate());
    });

    if (this.input.value) {
      const [y, m, d] = this.input.value.split('-').map(Number);
      this.viewYear = y;
      this.viewMonth = m - 1;
      this.updateTrigger();
    }

    this.renderDays();
    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  formatDisplay(iso) {
    if (!iso) return this.placeholder;
    const [y, m, d] = iso.split('-');
    if (this.compact) return `${d}/${m}/${String(y).slice(-2)}`;
    return `${d}/${m}/${y}`;
  }

  updateTrigger() {
    const val = this.input.value;
    const text = this.root.querySelector('.dp__text');
    text.textContent = val ? this.formatDisplay(val) : this.placeholder;
    this.trigger.classList.toggle('dp__trigger--empty', !val);
    if (this.compact) {
      const label = val ? `Fecha: ${this.formatDisplay(val)}` : 'Elegir fecha';
      this.trigger.setAttribute('aria-label', label);
      this.trigger.title = label;
    }
  }

  shiftMonth(dir) {
    this.viewMonth += dir;
    if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
    if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
    this.renderDays();
  }

  renderDays() {
    this.titleEl.textContent = `${DP_MESES_FULL[this.viewMonth]} ${this.viewYear}`;

    const first = new Date(this.viewYear, this.viewMonth, 1);
    let start = first.getDay() - 1;
    if (start < 0) start = 6;

    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const prevDays = new Date(this.viewYear, this.viewMonth, 0).getDate();

    const selected = this.input.value;
    const today = todayISO();
    let html = '';

    for (let i = 0; i < start; i++) {
      const day = prevDays - start + i + 1;
      html += `<button type="button" class="dp__day dp__day--muted" disabled>${day}</button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let cls = 'dp__day';
      if (iso === selected) cls += ' dp__day--selected';
      if (iso === today) cls += ' dp__day--today';
      html += `<button type="button" class="${cls}" data-day="${d}">${d}</button>`;
    }

    const total = start + daysInMonth;
    const rest = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= rest; i++) {
      html += `<button type="button" class="dp__day dp__day--muted" disabled>${i}</button>`;
    }

    this.daysEl.innerHTML = html;
    this.daysEl.querySelectorAll('.dp__day:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => this.pick(this.viewYear, this.viewMonth, Number(btn.dataset.day)));
    });
  }

  pick(year, month, day) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.input.value = iso;
    this.updateTrigger();
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  setValue(iso) {
    if (iso) {
      const [y, m] = iso.split('-').map(Number);
      this.viewYear = y;
      this.viewMonth = m - 1;
    }
    this.input.value = iso || '';
    this.updateTrigger();
    this.renderDays();
  }

  clear() {
    this.input.value = '';
    this.updateTrigger();
    this.renderDays();
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  toggle() {
    dpOpenInstance === this ? this.close() : this.open();
  }

  positionPopup() {
    const popup = this.popup;
    popup.classList.remove('dp__popup--sheet', 'dp__popup--anchored', 'dp__popup--center');
    popup.removeAttribute('style');
    popup.classList.add('dp__popup--center');
  }

  open() {
    msOpenInstance?.close();
    tpOpenInstance?.close();
    catalogOpenInstance?.close();
    if (dpOpenInstance) dpOpenInstance.close();
    dpOpenInstance = this;

    if (this.input.value) {
      const [y, m] = this.input.value.split('-').map(Number);
      this.viewYear = y;
      this.viewMonth = m - 1;
      this.renderDays();
    }

    const portal = $('#dpPortal');
    portal.appendChild(this.popup);
    this.popup.hidden = false;
    this.positionPopup();
    this.trigger.classList.add('dp__trigger--open');
    $('#dpBackdrop').hidden = false;
  }

  close() {
    this.popup.hidden = true;
    this.popup.classList.remove('dp__popup--sheet', 'dp__popup--anchored', 'dp__popup--center');
    this.popup.removeAttribute('style');
    this.root.appendChild(this.popup);
    this.trigger.classList.remove('dp__trigger--open');
    if (dpOpenInstance === this) {
      dpOpenInstance = null;
      if (!msOpenInstance && !tpOpenInstance && !catalogOpenInstance) $('#dpBackdrop').hidden = true;
    }
  }
}

class MantillaSelectPicker {
  constructor(input, mount, options = {}) {
    this.input = typeof input === 'string' ? $(input) : input;
    this.mount = typeof mount === 'string' ? $(mount) : mount;
    if (!this.input || !this.mount) {
      this.disabled = true;
      return;
    }
    this.placeholder = options.placeholder || 'Seleccionar';
    this.title = options.title || 'Seleccionar';
    this.getOptions = options.getOptions || (() => options.options || []);
    this.searchable = options.searchable !== false;
    this.allowEmpty = options.allowEmpty === true;
    this.noOptionsText = options.noOptionsText || 'Sin coincidencias';
    this.searchQuery = '';
    this.build();
  }

  normalizeOption(opt) {
    if (typeof opt === 'string') {
      const placa = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(opt) : opt;
      const chofer = typeof getChoferByPlaca === 'function' ? getChoferByPlaca(placa) : '';
      return { value: placa, placa, chofer: (chofer || '').trim() };
    }
    const placa = typeof formatPlacaDisplay === 'function'
      ? formatPlacaDisplay(opt.placa || opt.value || '')
      : (opt.placa || opt.value || '');
    return {
      value: placa,
      placa,
      chofer: (opt.chofer || '').trim()
    };
  }

  getNormalizedOptions() {
    return this.getOptions().map((opt) => this.normalizeOption(opt));
  }

  findOption(value) {
    const key = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(value) : value;
    return this.getNormalizedOptions().find((opt) => opt.value === key) || {
      value: key,
      placa: key,
      chofer: typeof getChoferByPlaca === 'function' ? getChoferByPlaca(key) : ''
    };
  }

  renderOptionLabel(opt) {
    const choferHtml = opt.chofer
      ? `<span class="ms__option-chofer">${escapeHtml(opt.chofer)}</span>`
      : '';
    return `<span class="ms__option-placa">${escapeHtml(opt.placa)}</span>${choferHtml}`;
  }

  renderTriggerLabel(opt) {
    const choferHtml = opt.chofer
      ? `<span class="ms__trigger-chofer">${escapeHtml(opt.chofer)}</span>`
      : '';
    return `<span class="ms__trigger-placa">${escapeHtml(opt.placa)}</span>${choferHtml}`;
  }

  build() {
    const searchHtml = this.searchable
      ? `<div class="ms__search-wrap">
          <input type="search" class="ms__search field-input" placeholder="Buscar placa o chofer…" autocomplete="off" enterkeyhint="search" aria-label="Buscar">
        </div>`
      : '';
    const footHtml = this.allowEmpty
      ? `<div class="ms__foot">
          <button type="button" class="ms__foot-btn" data-action="clear">${escapeHtml(this.placeholder)}</button>
        </div>`
      : '';

    this.mount.innerHTML = `
      <div class="ms">
        <button type="button" class="ms__trigger field-input camp-viaje-card__placa">
          <span class="ms__text">${this.placeholder}</span>
        </button>
        <div class="ms__popup" hidden>
          <div class="ms__head">
            <span class="ms__title">${this.title}</span>
            <button type="button" class="ms__close" aria-label="Cerrar">${typeof lucideIcon === 'function' ? lucideIcon('x', 'lucide-icon--picker-close') : '×'}</button>
          </div>
          ${searchHtml}
          <div class="ms__list" role="listbox"></div>
          ${footHtml}
        </div>
      </div>`;

    this.root = this.mount.querySelector('.ms');
    this.trigger = this.root.querySelector('.ms__trigger');
    this.popup = this.root.querySelector('.ms__popup');
    this.listEl = this.root.querySelector('.ms__list');
    this.searchInput = this.root.querySelector('.ms__search');

    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    this.root.querySelector('.ms__close').addEventListener('click', () => this.close());
    this.root.querySelector('[data-action="clear"]')?.addEventListener('click', () => this.clear());

    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderList();
    });
    this.searchInput?.addEventListener('click', (e) => e.stopPropagation());
    this.searchInput?.addEventListener('keydown', (e) => e.stopPropagation());

    this.updateTrigger();
    this.renderList();
    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  clear() {
    this.input.value = '';
    this.searchQuery = '';
    if (this.searchInput) this.searchInput.value = '';
    this.updateTrigger();
    this.renderList();
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  updateTrigger() {
    const val = this.input.value;
    const text = this.root.querySelector('.ms__text');
    if (!val) {
      text.textContent = this.placeholder;
    } else {
      text.innerHTML = this.renderTriggerLabel(this.findOption(val));
    }
    this.trigger.classList.toggle('ms__trigger--empty', !val);
    this.trigger.classList.toggle('ms__trigger--has-chofer', !!val && !!this.findOption(val).chofer);
  }

  renderList() {
    const selected = typeof formatPlacaDisplay === 'function'
      ? formatPlacaDisplay(this.input.value)
      : this.input.value;
    const q = (this.searchQuery || '').trim().toLowerCase();
    let options = this.getNormalizedOptions();
    if (q) {
      options = options.filter((opt) =>
        opt.placa.toLowerCase().includes(q)
        || opt.chofer.toLowerCase().includes(q)
        || opt.value.toLowerCase().includes(q)
      );
    }

    if (!options.length) {
      this.listEl.innerHTML = `<p class="ms__empty">${escapeHtml(this.noOptionsText)}</p>`;
      return;
    }

    this.listEl.innerHTML = options.map((opt) => {
      const cls = opt.value === selected ? 'ms__option ms__option--selected' : 'ms__option';
      return `<button type="button" class="${cls}" data-value="${escapeHtml(opt.value)}" role="option"${opt.value === selected ? ' aria-selected="true"' : ''}>${this.renderOptionLabel(opt)}</button>`;
    }).join('');

    this.listEl.querySelectorAll('.ms__option').forEach((btn) => {
      btn.addEventListener('click', () => this.pick(btn.dataset.value));
    });
  }

  pick(value) {
    this.input.value = typeof formatPlacaDisplay === 'function' ? formatPlacaDisplay(value) : value;
    this.updateTrigger();
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  setValue(value) {
    this.input.value = value || '';
    this.updateTrigger();
    this.renderList();
  }

  toggle() {
    msOpenInstance === this ? this.close() : this.open();
  }

  positionPopup() {
    this.popup.classList.remove('ms__popup--sheet', 'ms__popup--anchored', 'ms__popup--center');
    this.popup.removeAttribute('style');
    this.popup.classList.add('ms__popup--center');
  }

  open() {
    dpOpenInstance?.close();
    tpOpenInstance?.close();
    catalogOpenInstance?.close();
    if (msOpenInstance) msOpenInstance.close();
    msOpenInstance = this;

    this.searchQuery = '';
    if (this.searchInput) this.searchInput.value = '';
    this.renderList();
    const portal = $('#dpPortal');
    portal.appendChild(this.popup);
    this.popup.hidden = false;
    this.positionPopup();
    this.trigger.classList.add('ms__trigger--open');
    $('#dpBackdrop').hidden = false;
    if (this.searchable) {
      requestAnimationFrame(() => this.searchInput?.focus());
    }
  }

  close() {
    this.popup.hidden = true;
    this.popup.classList.remove('ms__popup--sheet', 'ms__popup--anchored', 'ms__popup--center');
    this.popup.removeAttribute('style');
    this.root.appendChild(this.popup);
    this.trigger.classList.remove('ms__trigger--open');
    if (msOpenInstance === this) {
      msOpenInstance = null;
      if (!dpOpenInstance && !tpOpenInstance && !catalogOpenInstance) $('#dpBackdrop').hidden = true;
    }
  }
}

/** Combo de catálogo: escribe libre o abre lista con búsqueda (sin datalist nativo). */
class MantillaCatalogCombo {
  constructor(inputRef, options = {}) {
    this.input = typeof inputRef === 'string' ? $(inputRef) : inputRef;
    if (!this.input) {
      this.disabled = true;
      return;
    }
    this.title = options.title || 'Elegir';
    this.searchPlaceholder = options.searchPlaceholder || 'Buscar…';
    this.getOptions = options.getOptions || (() => []);
    this.searchQuery = '';
    this.build();
  }

  normalizeOptions() {
    return this.getOptions().map((opt) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const label = (opt.label || opt.value || '').trim();
      return { value: label, label };
    }).filter((opt) => opt.value);
  }

  build() {
    this.input.removeAttribute('list');
    this.input.setAttribute('autocomplete', 'off');

    const parent = this.input.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'catalog-combo';
    parent.insertBefore(wrap, this.input);
    wrap.appendChild(this.input);

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.className = 'catalog-combo__toggle';
    this.toggleBtn.setAttribute('aria-label', this.title);
    this.toggleBtn.innerHTML = '<i data-lucide="chevron-down" class="lucide-icon" aria-hidden="true"></i>';
    wrap.appendChild(this.toggleBtn);

    this.popup = document.createElement('div');
    this.popup.className = 'ms__popup catalog-combo__popup';
    this.popup.hidden = true;
    this.popup.innerHTML = `
      <div class="ms__head">
        <span class="ms__title">${escapeHtml(this.title)}</span>
        <button type="button" class="ms__close" aria-label="Cerrar">${typeof lucideIcon === 'function' ? lucideIcon('x', 'lucide-icon--picker-close') : '×'}</button>
      </div>
      <div class="ms__search-wrap">
        <input type="search" class="ms__search field-input" placeholder="${escapeHtml(this.searchPlaceholder)}" autocomplete="off" enterkeyhint="search" aria-label="Buscar">
      </div>
      <div class="ms__list" role="listbox"></div>`;

    this.listEl = this.popup.querySelector('.ms__list');
    this.searchInput = this.popup.querySelector('.ms__search');
    this.holder = document.createElement('div');
    this.holder.className = 'catalog-combo__popup-holder';
    this.holder.hidden = true;
    this.holder.appendChild(this.popup);
    wrap.appendChild(this.holder);

    this.toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });
    this.popup.querySelector('.ms__close').addEventListener('click', () => this.close());
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderList();
    });
    this.searchInput.addEventListener('click', (e) => e.stopPropagation());
    this.searchInput.addEventListener('keydown', (e) => e.stopPropagation());

    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
  }

  renderList() {
    const selected = this.input.value.trim();
    const q = (this.searchQuery || '').trim().toLowerCase();
    let options = this.normalizeOptions();
    if (q) {
      options = options.filter((opt) => opt.label.toLowerCase().includes(q));
    }
    if (!options.length) {
      this.listEl.innerHTML = '<p class="ms__empty">Sin coincidencias</p>';
      return;
    }
    this.listEl.innerHTML = options.map((opt) => {
      const cls = opt.value === selected ? 'ms__option ms__option--selected ms__option--text' : 'ms__option ms__option--text';
      return `<button type="button" class="${cls}" data-value="${escapeHtml(opt.value)}" role="option">${escapeHtml(opt.label)}</button>`;
    }).join('');
    this.listEl.querySelectorAll('.ms__option').forEach((btn) => {
      btn.addEventListener('click', () => this.pick(btn.dataset.value));
    });
  }

  pick(value) {
    this.input.value = value;
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  positionPopup() {
    this.popup.classList.remove('ms__popup--sheet', 'ms__popup--anchored', 'ms__popup--center');
    this.popup.removeAttribute('style');
    this.popup.classList.add('ms__popup--center');
  }

  open() {
    dpOpenInstance?.close();
    msOpenInstance?.close();
    tpOpenInstance?.close();
    if (catalogOpenInstance) catalogOpenInstance.close();
    catalogOpenInstance = this;

    this.searchQuery = '';
    this.searchInput.value = '';
    this.renderList();
    const portal = $('#dpPortal');
    portal.appendChild(this.popup);
    this.popup.hidden = false;
    this.positionPopup();
    this.toggleBtn.classList.add('catalog-combo__toggle--open');
    $('#dpBackdrop').hidden = false;
    requestAnimationFrame(() => this.searchInput.focus());
  }

  close() {
    this.popup.hidden = true;
    this.popup.classList.remove('ms__popup--sheet', 'ms__popup--anchored', 'ms__popup--center');
    this.popup.removeAttribute('style');
    this.holder.appendChild(this.popup);
    this.toggleBtn.classList.remove('catalog-combo__toggle--open');
    if (catalogOpenInstance === this) {
      catalogOpenInstance = null;
      if (!dpOpenInstance && !msOpenInstance && !tpOpenInstance) $('#dpBackdrop').hidden = true;
    }
  }

  toggle() {
    catalogOpenInstance === this ? this.close() : this.open();
  }
}

class MantillaTimePicker {
  constructor(inputId, mountId, options = {}) {
    this.input = $(inputId);
    this.mount = $(mountId);
    if (!this.input || !this.mount) {
      this.disabled = true;
      return;
    }
    this.placeholder = options.placeholder || 'Elegir hora';
    this.title = options.title || 'Elegir hora';
    this.draftHour = 0;
    this.draftMinute = 0;
    this.build();
  }

  parseValue(value) {
    if (!value) return null;
    const [h, m] = String(value).split(':');
    const hour = Number(h);
    const minute = Number(m);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  }

  pad(n) {
    return String(n).padStart(2, '0');
  }

  formatValue(hour, minute) {
    return `${this.pad(hour)}:${this.pad(minute)}`;
  }

  syncDraftFromInput() {
    const parsed = this.parseValue(this.input.value);
    if (parsed) {
      this.draftHour = parsed.hour;
      this.draftMinute = parsed.minute;
      return;
    }
    const now = nowTime().split(':').map(Number);
    this.draftHour = now[0];
    this.draftMinute = now[1];
  }

  build() {
    this.mount.innerHTML = `
      <div class="tp">
        <button type="button" class="tp__trigger field-input">
          <span class="tp__text">${this.placeholder}</span>
          <i data-lucide="clock" class="lucide-icon tp__icon" aria-hidden="true"></i>
        </button>
        <div class="tp__popup" hidden>
          <div class="tp__head">
            <span class="tp__title">${this.title}</span>
            <button type="button" class="tp__close" aria-label="Cerrar">${typeof lucideIcon === 'function' ? lucideIcon('x', 'lucide-icon--picker-close') : '×'}</button>
          </div>
          <div class="tp__preview" aria-live="polite">--:--</div>
          <div class="tp__columns">
            <div class="tp__col">
              <span class="tp__col-label">Hora</span>
              <div class="tp__scroll" data-part="hour" role="listbox" aria-label="Hora"></div>
            </div>
            <div class="tp__col">
              <span class="tp__col-label">Min</span>
              <div class="tp__scroll" data-part="minute" role="listbox" aria-label="Minutos"></div>
            </div>
          </div>
          <div class="tp__foot">
            <button type="button" class="tp__foot-btn" data-action="now">Ahora</button>
            <button type="button" class="tp__foot-btn tp__foot-btn--primary" data-action="ok">Listo</button>
          </div>
        </div>
      </div>`;

    this.root = this.mount.querySelector('.tp');
    this.trigger = this.root.querySelector('.tp__trigger');
    this.popup = this.root.querySelector('.tp__popup');
    this.previewEl = this.root.querySelector('.tp__preview');
    this.hourCol = this.root.querySelector('[data-part="hour"]');
    this.minuteCol = this.root.querySelector('[data-part="minute"]');

    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    this.root.querySelector('.tp__close').addEventListener('click', () => this.close());
    this.root.querySelector('[data-action="now"]').addEventListener('click', () => {
      const [h, m] = nowTime().split(':').map(Number);
      this.draftHour = h;
      this.draftMinute = m;
      this.commit();
      this.close();
    });
    this.root.querySelector('[data-action="ok"]').addEventListener('click', () => {
      this.commit();
      this.close();
    });

    if (this.input.value) this.syncDraftFromInput();
    this.renderColumns();
    this.updateTrigger();
    refreshLucideIcons();
  }

  updateTrigger() {
    const val = this.input.value;
    const text = this.root.querySelector('.tp__text');
    text.textContent = val ? formatTime(val) : this.placeholder;
    this.trigger.classList.toggle('tp__trigger--empty', !val);
  }

  updatePreview() {
    if (this.previewEl) {
      this.previewEl.textContent = this.formatValue(this.draftHour, this.draftMinute);
    }
  }

  renderColumns() {
    this.hourCol.innerHTML = Array.from({ length: 24 }, (_, h) => {
      const cls = h === this.draftHour ? 'tp__option tp__option--selected' : 'tp__option';
      return `<button type="button" class="${cls}" data-hour="${h}" role="option"${h === this.draftHour ? ' aria-selected="true"' : ''}>${this.pad(h)}</button>`;
    }).join('');

    this.minuteCol.innerHTML = Array.from({ length: 60 }, (_, m) => {
      const cls = m === this.draftMinute ? 'tp__option tp__option--selected' : 'tp__option';
      return `<button type="button" class="${cls}" data-minute="${m}" role="option"${m === this.draftMinute ? ' aria-selected="true"' : ''}>${this.pad(m)}</button>`;
    }).join('');

    this.hourCol.querySelectorAll('[data-hour]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.draftHour = Number(btn.dataset.hour);
        this.renderColumns();
        this.updatePreview();
        this.scrollToSelected(this.hourCol);
      });
    });

    this.minuteCol.querySelectorAll('[data-minute]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.draftMinute = Number(btn.dataset.minute);
        this.renderColumns();
        this.updatePreview();
        this.commit();
        this.close();
      });
    });

    this.updatePreview();
    this.scrollToSelected(this.hourCol);
    this.scrollToSelected(this.minuteCol);
  }

  scrollToSelected(col) {
    const sel = col.querySelector('.tp__option--selected');
    if (sel) sel.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  commit() {
    this.input.value = this.formatValue(this.draftHour, this.draftMinute);
    this.updateTrigger();
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  setValue(value) {
    const parsed = this.parseValue(value);
    if (parsed) {
      this.draftHour = parsed.hour;
      this.draftMinute = parsed.minute;
      this.input.value = this.formatValue(parsed.hour, parsed.minute);
    } else {
      this.input.value = value || '';
      if (!value) this.syncDraftFromInput();
    }
    this.renderColumns();
    this.updateTrigger();
  }

  toggle() {
    tpOpenInstance === this ? this.close() : this.open();
  }

  positionPopup() {
    this.popup.classList.remove('tp__popup--center');
    this.popup.removeAttribute('style');
    this.popup.classList.add('tp__popup--center');
  }

  open() {
    dpOpenInstance?.close();
    msOpenInstance?.close();
    catalogOpenInstance?.close();
    if (tpOpenInstance) tpOpenInstance.close();
    tpOpenInstance = this;

    this.syncDraftFromInput();
    this.renderColumns();

    const portal = $('#dpPortal');
    portal.appendChild(this.popup);
    this.popup.hidden = false;
    this.positionPopup();
    this.trigger.classList.add('tp__trigger--open');
    $('#dpBackdrop').hidden = false;
    refreshLucideIcons();
  }

  close() {
    this.popup.hidden = true;
    this.popup.classList.remove('tp__popup--center');
    this.popup.removeAttribute('style');
    this.root.appendChild(this.popup);
    this.trigger.classList.remove('tp__trigger--open');
    if (tpOpenInstance === this) {
      tpOpenInstance = null;
      if (!dpOpenInstance && !msOpenInstance && !catalogOpenInstance) $('#dpBackdrop').hidden = true;
    }
  }
}

let dpMaintFecha, dpFilterFecha, dpCampFecha;
let tpMaintHora;

