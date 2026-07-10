/**
 * URL de la Web App de Google Apps Script (deploy → /exec).
 */
window.APPS_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycbzZzk6HfFGmYY8aPTuCN0icXOpBXuuWCSChna4v4HlMCLKuvca4LbY8oqyml6NEnGpRmA/exec';

/** Token opcional — solo si ejecutaste definirToken() en code.gs. Si no, déjalo vacío. */
window.APPS_SCRIPT_TOKEN = '';

/** true = consulta servidor (GET) al abrir y cada ~45s; refleja borrados y ediciones del Sheet */
window.APPS_SCRIPT_PULL_ON_LOAD = true;
