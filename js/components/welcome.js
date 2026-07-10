// ---- Modal de bienvenida (una vez por sesión) ----

const WELCOME_SESSION_KEY = 'mantilla-welcome-shown';

function getWelcomeOwnerName() {
  const fromDom = document.querySelector('.topbar-profile__name')?.textContent?.trim();
  if (fromDom) return fromDom;
  if (typeof MANTILLA_OWNER !== 'undefined' && MANTILLA_OWNER.name) {
    return MANTILLA_OWNER.name;
  }
  return 'Marco Ruben';
}

function welcomeTruckSvg() {
  return `<svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="4" y="14" width="34" height="18" rx="3" fill="#f8fafc"/>
    <rect x="38" y="18" width="18" height="14" rx="2" fill="#e2e8f0"/>
    <rect x="40" y="20" width="10" height="7" rx="1.5" fill="#94a3b8"/>
    <rect x="8" y="17" width="22" height="6" rx="1.5" fill="#cbd5e1"/>
    <circle class="welcome-scene__wheel" cx="16" cy="34" r="5" fill="#1e293b"/>
    <circle class="welcome-scene__wheel" cx="16" cy="34" r="2" fill="#64748b"/>
    <circle class="welcome-scene__wheel" cx="46" cy="34" r="5" fill="#1e293b"/>
    <circle class="welcome-scene__wheel" cx="46" cy="34" r="2" fill="#64748b"/>
    <rect x="2" y="24" width="6" height="4" rx="1" fill="#ffd166"/>
    <path d="M38 22h4v-4h-4v4z" fill="#1e5a9e"/>
  </svg>`;
}

function ensureWelcomeModal() {
  if (document.getElementById('modalWelcome')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay modal-overlay--welcome" id="modalWelcome" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" aria-describedby="welcomeSub">
      <div class="modal modal--welcome">
        <div class="welcome-modal__hero">
          <div class="welcome-scene" aria-hidden="true">
            <div class="welcome-scene__sky"></div>
            <div class="welcome-scene__hills"></div>
            <div class="welcome-scene__road">
              <div class="welcome-scene__dash"></div>
            </div>
            <div class="welcome-scene__truck">
              ${welcomeTruckSvg()}
              <span class="welcome-scene__dust"></span>
            </div>
            <div class="welcome-scene__dest">
              ${lucideIcon('map-pin')}
              <span class="welcome-scene__dest-label">Destino</span>
            </div>
          </div>
        </div>
        <div class="welcome-modal__body">
          <p class="welcome-modal__brand">MANTILLA</p>
          <h2 class="welcome-modal__title" id="welcomeTitle">
            ¡Bienvenido, <span class="welcome-modal__name" id="welcomeUserName">Marco Ruben</span>!
          </h2>
          <p class="welcome-modal__sub" id="welcomeSub">Tu flota en marcha hacia el destino. Gestión de flota al alcance de tu mano.</p>
        </div>
        <div class="welcome-modal__footer">
          <button type="button" class="btn btn--primary welcome-modal__ok" data-close="modalWelcome">OK</button>
        </div>
      </div>
    </div>
  `);
}

function showWelcomeIfNeeded() {
  try {
    if (sessionStorage.getItem(WELCOME_SESSION_KEY)) return;
  } catch (_) {
    return;
  }

  ensureWelcomeModal();

  const nameEl = document.getElementById('welcomeUserName');
  if (nameEl) nameEl.textContent = getWelcomeOwnerName();

  openModal('modalWelcome');
  refreshLucideIcons();

  try {
    sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
    setTimeout(showWelcomeIfNeeded, 450);
  });
});
