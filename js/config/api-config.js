/**
 * URL de la Web App de Google Apps Script (deploy → /exec).
 */
window.APPS_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycby86Q8it4XJoGqDNGDwco4HdVQ0saa5rPODN_SXIOPjp-gqYsA85mascUq-OIikUq6W/exec';

/** Token opcional — solo si ejecutaste definirToken() en code.gs. Si no, déjalo vacío. */
window.APPS_SCRIPT_TOKEN = '';

/** true = consulta servidor (GET) al abrir y cada ~45s; refleja borrados y ediciones del Sheet */
window.APPS_SCRIPT_PULL_ON_LOAD = true;
