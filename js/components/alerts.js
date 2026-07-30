const ALERT_TIMERS = { success: 1500, warning: 2200, error: 2600, info: 1500 };

const ALERT_LUCIDE_ICONS = {
  success: 'circle-check',
  warning: 'triangle-alert',
  error: 'circle-x',
  info: 'info'
};

function mantillaAlertIconHtml(type) {
  const icon = ALERT_LUCIDE_ICONS[type] || ALERT_LUCIDE_ICONS.info;
  return `<div class="mantilla-swal__status-icon mantilla-swal__status-icon--${type}" aria-hidden="true">${lucideIcon(icon, 'lucide-icon--alert')}</div>`;
}

function mantillaAlertBodyHtml(title, detailHtml, alertType) {
  const detailBlock = detailHtml
    ? `<p class="mantilla-swal__detail">${detailHtml}</p>`
    : '';
  return `
    <div class="mantilla-swal__stack">
      ${mantillaAlertIconHtml(alertType)}
      <h2 class="mantilla-swal__title mantilla-swal__title--inline">${escapeHtml(title)}</h2>
      ${detailBlock}
    </div>`;
}

const MantillaAlert = typeof Swal !== 'undefined' ? Swal.mixin({
  toast: true,
  position: 'top-end',
  width: 'auto',
  padding: 0,
  showConfirmButton: false,
  showCloseButton: true,
  allowEscapeKey: true,
  timerProgressBar: true,
  customClass: {
    container: 'mantilla-swal-container mantilla-swal-container--toast',
    popup: 'mantilla-swal mantilla-swal--alert mantilla-swal--toast',
    title: 'mantilla-swal__title mantilla-swal__title--hidden',
    htmlContainer: 'mantilla-swal__detail-wrap',
    timerProgressBarContainer: 'mantilla-swal__timer-track',
    timerProgressBar: 'mantilla-swal__timer-bar'
  },
  buttonsStyling: false,
  showClass: { popup: 'mantilla-swal-toast-show' },
  hideClass: { popup: 'mantilla-swal-toast-hide' },
  didOpen: (popup) => {
    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
    popup.addEventListener('mouseenter', Swal.stopTimer);
    popup.addEventListener('mouseleave', Swal.resumeTimer);
  }
}) : null;

/**
 * Toast no bloqueante arriba-derecha — string o { title, detail, type, timer }
 */
function showToast(input, type = 'success', detail = '') {
  if (!MantillaAlert) {
    const msg = typeof input === 'object' && input ? input.title : input;
    console.info('[Mantilla]', msg);
    return Promise.resolve();
  }

  const opts = typeof input === 'object' && input !== null
    ? input
    : { title: input, type, detail };

  const title = opts.title || '';
  const alertType = opts.type || 'success';
  const detailHtml = opts.detail || '';
  const timer = opts.timer ?? ALERT_TIMERS[alertType] ?? ALERT_TIMERS.success;

  // Nunca reemplazar un diálogo de confirmación que el usuario está resolviendo.
  if (document.querySelector('.swal2-popup.mantilla-swal--confirm')) {
    return Promise.resolve();
  }

  const fireOpts = {
    icon: false,
    title: ' ',
    timer,
    html: mantillaAlertBodyHtml(title, detailHtml || (opts.text ? escapeHtml(opts.text) : ''), alertType)
  };

  return MantillaAlert.fire(fireOpts);
}

let syncDeleteToastTimer;
document.addEventListener('mantilla:sync-item', (event) => {
  const detail = event.detail || {};
  if (!detail.ok || detail.action !== 'delete') return;
  clearTimeout(syncDeleteToastTimer);
  syncDeleteToastTimer = setTimeout(() => {
    showToast({
      title: 'Eliminación sincronizada',
      type: 'success',
      detail: 'Google confirmó el cambio',
      timer: 1800
    });
  }, 250);
});
