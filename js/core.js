/**
 * Mantilla — núcleo compartido (bootstrap + errores globales)
 */
window.Mantilla = window.Mantilla || {};

Mantilla.VERSION = '1.2.0';

Mantilla.getPage = function getPage() {
  const page = document.body?.dataset?.page;
  if (page === 'viajes' || page === 'mantenimiento' || page === 'camiones' || page === 'ingresos-extras') return page;
  return 'viajes';
};

Mantilla.onReady = function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
};

Mantilla.showFatalError = function showFatalError(message) {
  const box = document.createElement('div');
  box.className = 'app-fatal-error';
  box.setAttribute('role', 'alert');
  box.innerHTML = `
    <strong>No se pudo cargar Mantilla</strong>
    <p>${message}</p>
    <button type="button" class="btn btn--primary btn--sm" onclick="location.reload()">Reintentar</button>
  `;
  document.body.appendChild(box);
};

window.addEventListener('error', (event) => {
  console.error('[Mantilla]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Mantilla] Promise rechazada:', event.reason);
});
