// ---- Saludo de bienvenida (solo la primera vez) ----

const WELCOME_STORAGE_KEY = 'mantilla-welcome-v2-shown';

function ensureWelcomeModal() {
  if (document.getElementById('modalWelcome')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay modal-overlay--welcome" id="modalWelcome" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
      <div class="modal modal--welcome">
        <div class="welcome-modal__body">
          <h2 class="welcome-modal__title" id="welcomeTitle">¡Hola, Marco!</h2>
          <p class="welcome-modal__sub">Todo está listo para usar el sistema.</p>
          <div class="welcome-modal__tip">
            <strong>Recomendación</strong>
            <span>Registra tus viajes y gastos con normalidad. Si pierdes internet, la información quedará guardada y se sincronizará al volver la conexión.</span>
          </div>
        </div>
        <div class="welcome-modal__footer">
          <button type="button" class="btn btn--primary welcome-modal__ok" data-close="modalWelcome">Empezar</button>
        </div>
      </div>
    </div>
  `);
}

function showWelcomeIfNeeded() {
  try {
    if (localStorage.getItem(WELCOME_STORAGE_KEY)) return;
  } catch (_) {
    return;
  }

  ensureWelcomeModal();

  openModal('modalWelcome');

  try {
    localStorage.setItem(WELCOME_STORAGE_KEY, '1');
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    setTimeout(showWelcomeIfNeeded, 450);
  });
});
