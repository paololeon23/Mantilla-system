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
  position: 'center',
  width: 'auto',
  padding: 0,
  showConfirmButton: false,
  showCloseButton: false,
  allowOutsideClick: true,
  allowEscapeKey: true,
  heightAuto: true,
  backdrop: 'rgba(15, 23, 42, 0.42)',
  timerProgressBar: true,
  customClass: {
    container: 'mantilla-swal-container',
    popup: 'mantilla-swal mantilla-swal--alert',
    title: 'mantilla-swal__title mantilla-swal__title--hidden',
    htmlContainer: 'mantilla-swal__detail-wrap',
    timerProgressBarContainer: 'mantilla-swal__timer-track',
    timerProgressBar: 'mantilla-swal__timer-bar'
  },
  buttonsStyling: false,
  showClass: { popup: 'mantilla-swal-show', backdrop: 'mantilla-swal-backdrop-show' },
  hideClass: { popup: 'mantilla-swal-hide', backdrop: 'mantilla-swal-backdrop-hide' },
  didOpen: (popup) => {
    if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
    popup.addEventListener('mouseenter', Swal.stopTimer);
    popup.addEventListener('mouseleave', Swal.resumeTimer);
  }
}) : null;

/**
 * Alerta centrada estilo 2026 — string o { title, detail, type, timer }
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

  closeMantillaAlert();

  const fireOpts = {
    icon: false,
    title: ' ',
    timer,
    html: mantillaAlertBodyHtml(title, detailHtml || (opts.text ? escapeHtml(opts.text) : ''), alertType)
  };

  return MantillaAlert.fire(fireOpts);
}
