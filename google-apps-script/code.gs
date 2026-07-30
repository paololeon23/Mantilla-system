/**
 * =============================================================================
 * MANTILLA — Google Apps Script (Web App)
 * =============================================================================
 *
 * 5 hojas: Viajes | Gastos | Ingresos extras | Camiones | Clientes
 * Columna id (primera) — clave estable para crear / actualizar / eliminar
 * Columna hora_registro SIEMPRE al final (ej. 5:15:00 p.m.)
 *
 * Setup: guardarSpreadsheetId() → configurarHojas() → desplegar Web App
 * =============================================================================
 */

var SHEETS = {
  VIAJES: 'Viajes',
  GASTOS: 'Gastos',
  INGRESOS: 'Ingresos extras',
  CAMIONES: 'Camiones',
  CLIENTES: 'Clientes'
};

var HEADERS = {};
HEADERS[SHEETS.VIAJES] = [
  'ID', 'FECHA', 'PLACA', 'CHOFER', 'CLIENTE', 'DNI', 'PRODUCTO',
  'TICKET_BALANZA', 'UNIDAD_MEDIDA', 'FLETE_TONELADA', 'GUIA', 'PESAJE',
  'TOTAL_PAGAR', 'COMBUSTIBLE', 'VIATICOS', 'TOTAL_GASTOS', 'UTILIDAD', 'HORA_REGISTRO'
];
HEADERS[SHEETS.GASTOS] = [
  'ID', 'FECHA', 'HORA', 'PLACA', 'DESCRIPCION', 'UNIDAD', 'COSTO_UNIT', 'MONTO', 'HORA_REGISTRO'
];
HEADERS[SHEETS.INGRESOS] = [
  'ID', 'FECHA', 'HORA', 'PLACA', 'DESCRIPCION', 'UNIDAD', 'COSTO_UNIT', 'MONTO', 'HORA_REGISTRO'
];
HEADERS[SHEETS.CAMIONES] = [
  'ID', 'PLACA', 'CHOFER', 'TELEFONO', 'BREVETE', 'TIPO', 'FECHA_REGISTRO', 'HORA_REGISTRO'
];
HEADERS[SHEETS.CLIENTES] = [
  'ID', 'NOMBRE', 'DNI', 'HORA_REGISTRO'
];

/** Clave interna (minúsculas) — el JSON de la app sigue usando id, fecha, hora, etc. */
function headerKey_(h) {
  return String(h || '').trim().toLowerCase();
}

var MODE_TO_SHEET = {
  viajes: SHEETS.VIAJES,
  gastos: SHEETS.GASTOS,
  ingresos: SHEETS.INGRESOS,
  camiones: SHEETS.CAMIONES,
  clientes: SHEETS.CLIENTES
};

/** Columnas monetarias/cantidad — siempre número con punto decimal (ej. 22456.00). */
var COLUMNAS_NUMERICAS_ = {
  ticket_balanza: 2,
  flete_tonelada: 2,
  guia: 2,
  pesaje: 2,
  total_pagar: 2,
  combustible: 2,
  viaticos: 2,
  total_gastos: 2,
  utilidad: 2,
  unidad: 2,
  costo_unit: 2,
  monto: 2
};

// ---------------------------------------------------------------------------
// Menú + setup
// ---------------------------------------------------------------------------

function onOpen() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) return;
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
  configurarHojasSilencioso_();
}

function mostrarAlerta_(mensaje) {
  try {
    SpreadsheetApp.getUi().alert(mensaje);
  } catch (err) {
    Logger.log(mensaje);
  }
}

function guardarSpreadsheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  mostrarAlerta_('SPREADSHEET_ID guardado: ' + ss.getId());
}

function definirToken(token) {
  PropertiesService.getScriptProperties().setProperty('TOKEN_SECRETO', String(token || '').trim());
}

function configurarHojas() {
  var ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheetWithHeaders_(ss, name, HEADERS[name]);
  });
  mostrarAlerta_('Hojas listas: Viajes, Gastos, Ingresos extras, Camiones y Clientes');
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var callback = sanitizeCallback_(params.callback);

  if (!callback) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'callback requerido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!validarToken_(params)) {
    return jsonp_(callback, { ok: false, error: 'token inválido' });
  }

  var result = { ok: false };

  try {
    if (params.ping === '1') {
      result = { ok: true, service: 'mantilla', version: '1.10', time: formatHoraRegistro_() };
    } else if (params.existe_id === '1' || params.existe_uid === '1') {
      var modeCheck = String(params.mode || 'viajes').toLowerCase();
      var idCheck = String(params.id || params.uid || '').trim();
      var sheetCheck = MODE_TO_SHEET[modeCheck];
      var rowIdx = sheetCheck && idCheck ? buscarFilaPorIdEnHoja_(sheetCheck, idCheck) : -1;
      result = {
        ok: true,
        existe: rowIdx > 1,
        id: idCheck,
        mode: modeCheck
      };
    } else if (params.fetch === '1') {
      var modeFetch = String(params.mode || 'all').toLowerCase();
      if (modeFetch === 'all') {
        var dataAll = {};
        Object.keys(MODE_TO_SHEET).forEach(function (m) {
          dataAll[m] = leerHoja_(MODE_TO_SHEET[m]);
        });
        result = { ok: true, data: dataAll };
      } else {
        var sheetFetch = MODE_TO_SHEET[modeFetch];
        if (!sheetFetch) {
          result = { ok: false, error: 'mode inválido: ' + modeFetch };
        } else {
          result = { ok: true, mode: modeFetch, rows: leerHoja_(sheetFetch) };
        }
      }
    } else if (params.estado === '1') {
      result = { ok: true, hojas: contarFilasPorHoja_() };
    } else {
      result = { ok: false, error: 'parámetro GET no reconocido' };
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  return jsonp_(callback, result);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: 'body vacío' });
    }

    var data = JSON.parse(e.postData.contents);

    if (!validarToken_(data)) {
      return jsonOut_({ ok: false, error: 'token inválido' });
    }

    var mode = String(data.mode || 'viajes').toLowerCase();
    var sheetName = MODE_TO_SHEET[mode];
    if (!sheetName) {
      return jsonOut_({ ok: false, error: 'mode inválido: ' + mode });
    }

    var rows = data.rows;
    if (!rows || !rows.length) {
      return jsonOut_({ ok: false, error: 'rows[] vacío' });
    }

    configurarHojasSilencioso_();

    var processed = [];
    var idsEnLote = {};

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var id = String(row.id || row.uid || '').trim();
      if (!id) {
        processed.push({ status: 'error', detail: 'sin id' });
        continue;
      }

      row.id = id;

      if (row.accion === 'eliminar') {
        eliminarFilaInterna_(sheetName, mode, id);
        processed.push({ id: id, status: 'eliminado' });
        continue;
      }

      // Mismo id repetido en un solo POST → solo procesar una vez (el último gana)
      if (idsEnLote[id]) {
        processed.push({ id: id, status: 'omitido_dup_lote' });
        continue;
      }
      idsEnLote[id] = true;

      processed.push(guardarOActualizarFila_(sheetName, mode, row));
    }

    return jsonOut_({ ok: true, mode: mode, processed: processed });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Lectura / escritura
// ---------------------------------------------------------------------------

function leerHoja_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var headers = HEADERS[sheetName];
  var numRows = sheet.getLastRow() - 1;
  var range = sheet.getRange(2, 1, numRows, headers.length);
  var data = range.getValues();
  var displays = range.getDisplayValues();

  return data.map(function (row, rIdx) {
    var obj = {};
    headers.forEach(function (h, idx) {
      var key = headerKey_(h);
      obj[key] = serializarCeldaJson_(key, row[idx], displays[rIdx][idx]);
    });
    return obj;
  }).filter(function (obj) {
    return String(obj.id || '').trim() !== '';
  });
}

function tz_() {
  try {
    return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  } catch (e) {
    return Session.getScriptTimeZone();
  }
}

/** Sheets a veces devuelve la hora como fracción del día (0–1). */
function fractionToHora_(value) {
  var frac = Number(value) % 1;
  if (frac < 0) frac += 1;
  var totalMins = Math.round(frac * 24 * 60) % (24 * 60);
  if (totalMins < 0) totalMins += 24 * 60;
  var h = Math.floor(totalMins / 60);
  var m = totalMins % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

function serializarCeldaJson_(header, value, displayValue) {
  if (header === 'hora' || header === 'hora_registro') {
    // Preferir lo que se ve en Sheets (suele traer la hora real)
    var fromDisp = normalizarHora_(displayValue || '');
    if (fromDisp && fromDisp !== '00:00') {
      return header === 'hora_registro' && displayValue
        ? String(displayValue).trim()
        : fromDisp;
    }

    if (typeof value === 'number' && isFinite(value)) {
      return fractionToHora_(value);
    }
    if (value instanceof Date) {
      if (header === 'hora_registro') return formatHoraRegistroFromDate_(value);
      return Utilities.formatDate(value, tz_(), 'HH:mm');
    }
    var fromVal = normalizarHora_(value);
    if (fromVal && fromVal !== '00:00') return fromVal;
    // Nunca devolver yyyy-MM-dd en columnas de hora
    if (fromDisp === '00:00' || fromVal === '00:00') return '00:00';
    return '';
  }
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz_(), 'yyyy-MM-dd');
  }
  if (header === 'fecha' || header === 'fecha_registro') {
    var asDate = new Date(value);
    if (!isNaN(asDate.getTime())) {
      return Utilities.formatDate(asDate, tz_(), 'yyyy-MM-dd');
    }
  }
  if (COLUMNAS_NUMERICAS_.hasOwnProperty(header)) {
    return normalizarNumero_(value, COLUMNAS_NUMERICAS_[header]);
  }
  return value;
}

/** Extrae solo HH:mm de textos o fechas serializadas por Sheets. */
function normalizarHora_(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && isFinite(value)) {
    return fractionToHora_(value);
  }
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz_(), 'HH:mm');
  }
  var s = String(value).trim().replace(/\u00a0/g, ' ');
  if (!s) return '';

  var m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];

  // Acepta "5:15:00 p.m." y "5:15:00 p. m." (locale ES)
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)$/i);
  if (m) {
    var h = parseInt(m[1], 10);
    var isPm = /^p/i.test(m[3]);
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return ('0' + h).slice(-2) + ':' + m[2];
  }

  m = s.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];

  // Buscar hora dentro de texto más largo
  m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (m) {
    var h2 = parseInt(m[1], 10);
    if (m[3]) {
      var isPm2 = /^p/i.test(m[3]);
      if (isPm2 && h2 < 12) h2 += 12;
      if (!isPm2 && h2 === 12) h2 = 0;
    }
    return ('0' + h2).slice(-2) + ':' + m[2];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return '';
}

function formatHoraRegistroFromDate_(d) {
  var h = d.getHours();
  var ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12;
  if (h === 0) h = 12;
  var m = ('0' + d.getMinutes()).slice(-2);
  var s = ('0' + d.getSeconds()).slice(-2);
  return h + ':' + m + ':' + s + ' ' + ampm;
}

function redondearNumero_(n, decimales) {
  var f = Math.pow(10, decimales);
  return Math.round((Number(n) + 1e-10) * f) / f;
}

/**
 * Normaliza montos para Sheets: acepta 22456.00, 22.456,00, 22,456.00 → número con punto decimal.
 */
function normalizarNumero_(value, decimales) {
  decimales = decimales == null ? 2 : decimales;
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && !isNaN(value)) {
    return redondearNumero_(value, decimales);
  }

  var s = String(value).trim().replace(/\s/g, '');
  if (!s) return '';
  s = s.replace(/^S\/\s*/i, '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return '';

  var hasComma = s.indexOf(',') >= 0;
  var hasDot = s.indexOf('.') >= 0;

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    var parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0].replace(/\./g, '') + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasDot) {
    var dotParts = s.split('.');
    if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3 && dotParts[0].length <= 3)) {
      s = s.replace(/\./g, '');
    }
  }

  var n = parseFloat(s);
  if (isNaN(n)) return '';
  return redondearNumero_(n, decimales);
}

function guardarOActualizarFila_(sheetName, mode, row) {
  var id = String(row.id || '').trim();
  if (!id) return { id: '', status: 'error', detail: 'sin id' };

  if (!row.hora_registro) {
    row.hora_registro = formatHoraRegistro_();
  }

  // La hoja es la fuente de verdad — nunca insertar si el id ya existe
  var rowIndex = buscarFilaPorIdEnHoja_(sheetName, id);

  if (rowIndex > 1) {
    actualizarFilaPorIndice_(sheetName, mode, id, row, rowIndex);
    var removed = limpiarDuplicadosId_(sheetName, mode, id);
    return {
      id: id,
      status: removed > 0 ? 'actualizado_dup_limpio' : 'actualizado',
      duplicados_eliminados: removed
    };
  }

  var newRow = escribirFilaSegura_(sheetName, mode, row);
  var removedAfter = limpiarDuplicadosId_(sheetName, mode, id);
  return {
    id: id,
    status: removedAfter > 0 ? 'ok_dup_limpio' : 'ok',
    duplicados_eliminados: removedAfter,
    fila: newRow
  };
}

function escribirFilaSegura_(sheetName, mode, row) {
  var id = String(row.id || '').trim();
  var existente = buscarFilaPorIdEnHoja_(sheetName, id);
  if (existente > 1) {
    actualizarFilaPorIndice_(sheetName, mode, id, row, existente);
    return existente;
  }
  var newRow = escribirFila_(sheetName, row);
  marcarIdProcesado_(mode, id, newRow);
  return newRow;
}

function escribirFila_(sheetName, row) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Hoja no encontrada: ' + sheetName);

  var id = String(row.id || '').trim();
  if (id && buscarFilaPorIdEnHoja_(sheetName, id) > 1) {
    throw new Error('Bloqueado insert duplicado id=' + id);
  }

  var headers = HEADERS[sheetName];
  sheet.appendRow(valoresParaHoja_(headers, row));
  var last = sheet.getLastRow();
  forzarCeldaHoraTexto_(sheet, last, headers, row.hora);
  return last;
}

function actualizarFilaPorIndice_(sheetName, mode, id, row, rowIndex) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return;

  var headers = HEADERS[sheetName];
  var values = valoresParaHoja_(headers, row);
  var idx = rowIndex > 1 ? rowIndex : buscarFilaPorIdEnHoja_(sheetName, id);

  if (idx > 1 && filaSigueValida_(sheet, idx, id)) {
    sheet.getRange(idx, 1, 1, headers.length).setValues([values]);
    forzarCeldaHoraTexto_(sheet, idx, headers, row.hora);
    marcarIdProcesado_(mode, id, idx);
    return;
  }

  // Fila movida o corrupta: reubicar por búsqueda en hoja (sin crear duplicado)
  var found = buscarFilaPorIdEnHoja_(sheetName, id);
  if (found > 1) {
    sheet.getRange(found, 1, 1, headers.length).setValues([values]);
    forzarCeldaHoraTexto_(sheet, found, headers, row.hora);
    marcarIdProcesado_(mode, id, found);
    return;
  }

  escribirFilaSegura_(sheetName, mode, row);
}

/**
 * Si el mismo id aparece más de una vez en columna A, conserva la primera fila
 * y elimina el resto (de abajo hacia arriba).
 */
function limpiarDuplicadosId_(sheetName, mode, id) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var needle = String(id).trim();
  if (!needle) return 0;

  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var toDelete = [];
  var keptRow = -1;

  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() !== needle) continue;
    var rowNum = i + 2;
    if (keptRow < 0) {
      keptRow = rowNum;
      marcarIdProcesado_(mode, id, keptRow);
      continue;
    }
    toDelete.push(rowNum);
  }

  toDelete.sort(function (a, b) { return b - a; });
  toDelete.forEach(function (r) {
    sheet.deleteRow(r);
    ajustarFilasTrasBorrado_(mode, r);
  });

  return toDelete.length;
}

function eliminarFilaInterna_(sheetName, mode, id) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return;

  var rowIndex = buscarFilaPorIdEnHoja_(sheetName, id);
  if (rowIndex <= 1) {
    borrarPropsId_(mode, id);
    return;
  }

  sheet.deleteRow(rowIndex);
  ajustarFilasTrasBorrado_(mode, rowIndex);
  borrarPropsId_(mode, id);
}

function buscarFilaPorIdEnHoja_(sheetName, id) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return -1;

  var needle = String(id).trim();
  if (!needle) return -1;

  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === needle) return i + 2;
  }
  return -1;
}

function obtenerFilaPorId_(mode, id, sheetName) {
  return buscarFilaPorIdEnHoja_(sheetName, id);
}

function filaSigueValida_(sheet, rowIndex, id) {
  if (rowIndex > sheet.getLastRow()) return false;
  return String(sheet.getRange(rowIndex, 1).getValue()).trim() === String(id).trim();
}

function ajustarFilasTrasBorrado_(mode, deletedRow) {
  var props = PropertiesService.getScriptProperties().getProperties();
  var prefix = 'mantilla_row_' + mode + '_';
  Object.keys(props).forEach(function (key) {
    if (key.indexOf(prefix) !== 0) return;
    var n = parseInt(props[key], 10);
    if (n > deletedRow) {
      PropertiesService.getScriptProperties().setProperty(key, String(n - 1));
    }
  });
}

function valoresParaHoja_(headers, row) {
  return headers.map(function (h) {
    var key = headerKey_(h);
    var v = row[key];
    if (v === undefined || v === null) return '';
    if (key === 'hora') {
      var hhmm = normalizarHora_(v);
      // Texto plano para que Sheets no lo convierta en fecha 1899
      return hhmm || String(v || '').trim();
    }
    if (key === 'tipo') {
      return String(v || '').trim().toLowerCase() === 'excavadora'
        ? 'excavadora'
        : 'camion';
    }
    if (COLUMNAS_NUMERICAS_.hasOwnProperty(key)) {
      return normalizarNumero_(v, COLUMNAS_NUMERICAS_[key]);
    }
    return v;
  });
}

/** Evita que Sheets convierta la columna hora en fecha serial. */
function forzarCeldaHoraTexto_(sheet, rowIndex, headers, horaValue) {
  var col = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headerKey_(headers[i]) === 'hora') {
      col = i + 1;
      break;
    }
  }
  if (col < 1 || rowIndex < 2) return;
  var cell = sheet.getRange(rowIndex, col);
  var hhmm = normalizarHora_(horaValue);
  cell.setNumberFormat('@');
  if (hhmm) cell.setValue(hhmm);
}

function marcarIdProcesado_(mode, id, rowNum) {
  PropertiesService.getScriptProperties().setProperty(propId_(mode, id), '1');
  if (rowNum > 0) {
    PropertiesService.getScriptProperties().setProperty(propRow_(mode, id), String(rowNum));
  }
}

function borrarPropsId_(mode, id) {
  PropertiesService.getScriptProperties().deleteProperty(propId_(mode, id));
  PropertiesService.getScriptProperties().deleteProperty(propRow_(mode, id));
  // Compatibilidad con versión anterior (uid)
  PropertiesService.getScriptProperties().deleteProperty('mantilla_uid_' + mode + '_' + id);
}

function propId_(mode, id) {
  return 'mantilla_id_' + mode + '_' + id;
}

function propRow_(mode, id) {
  return 'mantilla_row_' + mode + '_' + id;
}

function formatHoraRegistro_() {
  var d = new Date();
  var h = d.getHours();
  var ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12;
  if (h === 0) h = 12;
  var m = ('0' + d.getMinutes()).slice(-2);
  var s = ('0' + d.getSeconds()).slice(-2);
  return h + ':' + m + ':' + s + ' ' + ampm;
}

function contarFilasPorHoja_() {
  var ss = getSpreadsheet_();
  var out = {};
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    out[name] = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function configurarHojasSilencioso_() {
  var ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheetWithHeaders_(ss, name, HEADERS[name]);
  });
}

function ensureSheetWithHeaders_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var firstCell = String(sheet.getRange(1, 1).getValue() || '').trim();
  var secondExpected = headers.length > 1 ? headers[1] : '';
  var secondCell = headers.length > 1 ? String(sheet.getRange(1, 2).getValue() || '').trim() : '';
  var firstKey = headerKey_(firstCell);
  var secondKey = headerKey_(secondCell);
  var secondExpectedKey = headerKey_(secondExpected);

  // Ya tiene columna ID (minúscula o MAYÚSCULA)
  if (firstKey === 'id' && secondKey === secondExpectedKey) {
    var lastCol = sheet.getLastColumn();
    var currentHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      : [];
    if (
      name === SHEETS.CAMIONES
      && headerKey_(currentHeaders[5]) === 'fecha_registro'
      && headerKey_(currentHeaders[6]) === 'hora_registro'
      && headerKey_(currentHeaders[7]) === 'tipo'
    ) {
      migrarTipoCamionesJuntoMarca_(sheet, headers);
      styleHeaderRow_(sheet, headers.length);
      return;
    }
    var headersChanged = currentHeaders.length !== headers.length
      || headers.some(function (h, i) {
        return String(currentHeaders[i] || '').trim() !== h;
      });
    if (headersChanged) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (lastCol > headers.length) {
        sheet.deleteColumns(headers.length + 1, lastCol - headers.length);
      }
    }
    styleHeaderRow_(sheet, headers.length);
    return;
  }

  // Hoja antigua sin columna id (primera col = fecha/placa/nombre)
  if (secondExpectedKey && firstKey === secondExpectedKey) {
    migrarAgregarColumnaId_(sheet, name);
    styleHeaderRow_(sheet, headers.length);
    return;
  }

  if (firstCell === '' || firstCell == null) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  styleHeaderRow_(sheet, headers.length);
  sheet.setColumnWidth(1, 180);
}

/**
 * Migra Camiones de:
 * BREVETE | FECHA_REGISTRO | HORA_REGISTRO | TIPO
 * a:
 * BREVETE | TIPO | FECHA_REGISTRO | HORA_REGISTRO
 * conservando todos los valores existentes.
 */
function migrarTipoCamionesJuntoMarca_(sheet, headers) {
  var maxRows = sheet.getMaxRows();
  sheet.insertColumnAfter(5);
  sheet.getRange(1, 9, maxRows, 1).copyTo(
    sheet.getRange(1, 6, maxRows, 1),
    SpreadsheetApp.CopyPasteType.PASTE_NORMAL,
    false
  );
  sheet.deleteColumn(9);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function migrarAgregarColumnaId_(sheet, sheetName) {
  sheet.insertColumnBefore(1);
  sheet.getRange(1, 1).setValue('ID');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var prefix = sheetName.toLowerCase().slice(0, 3);
  for (var r = 2; r <= lastRow; r++) {
    var generated = prefix + '-leg-' + r + '-' + Utilities.getUuid().slice(0, 8);
    sheet.getRange(r, 1).setValue(generated);
  }
}

function styleHeaderRow_(sheet, colCount) {
  sheet.getRange(1, 1, 1, colCount)
    .setFontWeight('bold')
    .setBackground('#0c1f3d')
    .setFontColor('#ffffff')
    .setFontSize(10);
  if (!sheet.getFrozenRows()) sheet.setFrozenRows(1);
}

function validarToken_(params) {
  var esperado = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRETO');
  if (!esperado) return true;
  var recibido = String((params && params.token) || '').trim();
  return recibido === esperado;
}

function sanitizeCallback_(name) {
  if (!name) return '';
  var s = String(name).trim();
  if (!/^[A-Za-z_$][\w.$]*$/.test(s)) return '';
  return s;
}

function jsonp_(callback, obj) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
