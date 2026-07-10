// Placas — 7 caracteres en total, debe incluir guión (ej: CHM-786, GT5-765, AB-1234)

const PLACA_LEN = 7;

function normalizePlacaPeru(input) {
  if (!input) return '';
  let raw = String(input).trim().toUpperCase().replace(/\s+/g, '');
  raw = raw.replace(/[^A-Z0-9-]/g, '');
  const parts = raw.split('-');
  if (parts.length > 2) {
    raw = `${parts[0]}-${parts.slice(1).join('')}`;
  }
  return raw.slice(0, PLACA_LEN);
}

function isValidPlacaPeru(input) {
  const placa = normalizePlacaPeru(input);
  return placa.length === PLACA_LEN && placa.includes('-');
}

function placaPeruHint() {
  return 'La placa debe tener 7 caracteres e incluir guión (ej: CHM-786, GT5-765).';
}

function formatPlacaDisplay(placa) {
  const n = normalizePlacaPeru(placa);
  return n || String(placa || '').trim().toUpperCase();
}

function formatPlacaPeruLive(value) {
  return normalizePlacaPeru(value);
}

function wirePlacaPeruInput(input) {
  if (!input || input.dataset.placaWired) return;
  input.dataset.placaWired = '1';
  input.setAttribute('maxlength', String(PLACA_LEN));

  input.addEventListener('input', () => {
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, pos);
    const formatted = formatPlacaPeruLive(input.value);
    input.value = formatted;
    input.setCustomValidity('');

    const newPos = Math.min(before.length, formatted.length);
    input.setSelectionRange(newPos, newPos);
  });

  input.addEventListener('blur', () => {
    const n = normalizePlacaPeru(input.value);
    if (n) input.value = n;
    if (input.value && !isValidPlacaPeru(input.value)) {
      input.setCustomValidity(placaPeruHint());
    } else {
      input.setCustomValidity('');
    }
  });
}

function normalizeTelefono(input) {
  return String(input || '').replace(/\D/g, '').slice(0, 9);
}

function wireTelefonoInput(input) {
  if (!input || input.dataset.telefonoWired) return;
  input.dataset.telefonoWired = '1';
  input.setAttribute('maxlength', '9');
  input.setAttribute('inputmode', 'numeric');

  input.addEventListener('input', () => {
    input.value = normalizeTelefono(input.value);
  });

  input.addEventListener('blur', () => {
    input.value = normalizeTelefono(input.value);
  });
}
