/**

 * Mantilla — sincronización Google Sheets

 * POST (subir) + GET (bajar) — el servidor es fuente de verdad tras sync

 */

(function () {

  const SYNC_QUEUE_KEY = 'mantilla-sync-queue-v5';

  const SYNCED_IDS_KEY = 'mantilla-synced-ids-v1';



  let syncing = false;

  let pulling = false;

  let lastPull = { ok: false, changed: false, at: null };



  function pullEnabled() {

    return window.APPS_SCRIPT_PULL_ON_LOAD !== false;

  }



  function horaRegistroAhora() {

    if (typeof horaRegistroDisplay === 'function') return horaRegistroDisplay();

    const d = new Date();

    let h = d.getHours();

    const ampm = h >= 12 ? 'p.m.' : 'a.m.';

    h = h % 12 || 12;

    return `${h}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${ampm}`;

  }



  function money(v) {

    return typeof parseMoneyNumber === 'function' ? parseMoneyNumber(v) : (Number(v) || 0);

  }



  function moneyOrBlank(v) {

    if (v == null || v === '') return '';

    return money(v);

  }



  function isSyncEnabled() {

    const url = window.APPS_SCRIPT_API_URL || '';

    return url.includes('script.google.com');

  }



  function loadQueue() {

    try {

      const raw = localStorage.getItem(SYNC_QUEUE_KEY);

      return raw ? JSON.parse(raw) : [];

    } catch (_) {

      return [];

    }

  }



  function saveQueue(queue) {

    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

  }



  function loadSyncedIds() {

    try {

      const raw = localStorage.getItem(SYNCED_IDS_KEY);

      const data = raw ? JSON.parse(raw) : {};

      return {

        viajes: new Set(data.viajes || []),

        gastos: new Set(data.gastos || []),

        camiones: new Set(data.camiones || []),

        clientes: new Set(data.clientes || [])

      };

    } catch (_) {

      return { viajes: new Set(), gastos: new Set(), camiones: new Set(), clientes: new Set() };

    }

  }



  function saveSyncedIds(sets) {

    localStorage.setItem(SYNCED_IDS_KEY, JSON.stringify({

      viajes: [...sets.viajes],

      gastos: [...sets.gastos],

      camiones: [...sets.camiones],

      clientes: [...sets.clientes]

    }));

  }



  function markSynced(mode, id) {

    if (!id) return;

    const sets = loadSyncedIds();

    if (!sets[mode]) sets[mode] = new Set();

    sets[mode].add(String(id));

    saveSyncedIds(sets);

  }



  function unmarkSynced(mode, id) {

    if (!id) return;

    const sets = loadSyncedIds();

    if (sets[mode]) sets[mode].delete(String(id));

    saveSyncedIds(sets);

  }



  function getPendingIdsForMode(mode) {

    const ids = new Set();

    loadQueue().forEach((item) => {

      if (item.mode !== mode) return;

      const row = item.rows?.[0];

      if (!row || row.accion === 'eliminar') return;

      const id = row.id || row.uid;

      if (id) ids.add(String(id));

    });

    return ids;

  }



  function enqueue(item) {

    if (!isSyncEnabled()) return;

    const queue = loadQueue();

    const exists = queue.findIndex((q) => q.id === item.id);

    if (exists >= 0) queue[exists] = { ...queue[exists], ...item, intentos: 0 };

    else queue.push({ ...item, intentos: 0, creado_en: horaRegistroAhora() });

    saveQueue(queue);

    scheduleSync();

  }



  let syncTimer = null;

  function scheduleSync() {

    clearTimeout(syncTimer);

    syncTimer = setTimeout(() => sincronizarPendientes(), 120);

  }



  async function postNoCors(payload) {

    const body = { ...payload };

    if (window.APPS_SCRIPT_TOKEN) body.token = window.APPS_SCRIPT_TOKEN;

    await fetch(window.APPS_SCRIPT_API_URL, {

      method: 'POST',

      mode: 'no-cors',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(body)

    });

  }



  function callbackJsonp(params, timeoutMs) {

    const timeout = timeoutMs || 8000;

    return new Promise((resolve, reject) => {

      const cbName = `__mantilla_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let script = null;

      const timer = setTimeout(() => {

        cleanup();

        reject(new Error('JSONP timeout'));

      }, timeout);



      function cleanup() {

        clearTimeout(timer);

        try { delete window[cbName]; } catch (_) { /* noop */ }

        if (script?.parentNode) script.parentNode.removeChild(script);

      }



      window[cbName] = (data) => {

        cleanup();

        resolve(data);

      };



      const qs = new URLSearchParams({

        ...params,

        callback: cbName,

        _ts: String(Date.now())

      });

      if (window.APPS_SCRIPT_TOKEN) qs.set('token', window.APPS_SCRIPT_TOKEN);



      script = document.createElement('script');

      script.src = `${window.APPS_SCRIPT_API_URL}?${qs.toString()}`;

      script.onerror = () => {

        cleanup();

        reject(new Error('JSONP error'));

      };

      document.head.appendChild(script);

    });

  }



  async function consultarExiste(id, modo) {

    const res = await callbackJsonp({

      existe_id: '1',

      id,

      mode: modo

    });

    return !!(res?.ok && res.existe);

  }



  async function confirmarExiste(id, modo) {

    const delays = [0, 450, 900, 1400];

    for (const delay of delays) {

      if (delay) await new Promise((r) => setTimeout(r, delay));

      try {

        if (await consultarExiste(id, modo)) return true;

      } catch (_) { /* reintento */ }

    }

    return false;

  }



  async function confirmarEliminado(id, modo) {

    const delays = [0, 450, 900, 1400];

    for (const delay of delays) {

      if (delay) await new Promise((r) => setTimeout(r, delay));

      try {

        const existe = await consultarExiste(id, modo);

        if (!existe) return true;

      } catch (_) { /* reintento */ }

    }

    return false;

  }



  function mapOperacionToRow(op) {

    return {

      id: op.id,

      fecha: op.fecha || '',

      placa: op.placa || '',

      chofer: op.chofer || '',

      cliente: op.cliente || '',

      dni: op.dniRuc || '',

      producto: op.producto || '',

      ticket_balanza: money(op.peso),

      unidad_medida: op.unidad || 'TM',

      flete_tonelada: money(op.tarifa),

      guia: money(op.guia),

      pesaje: money(op.pesaje),

      total_pagar: money(op.flete),

      combustible: money(op.combustible),

      viaticos: money(op.viaticos),

      total_gastos: money(op.gastos),

      utilidad: money(op.utilidad),

      hora_registro: horaRegistroAhora()

    };

  }



  function mapGastoToRow(record) {

    const hora = record.hora || (typeof nowTime === 'function' ? nowTime() : '');

    return {

      id: record.id,

      fecha: (typeof normalizeDateISO === 'function' ? normalizeDateISO(record.fecha) : record.fecha) || '',

      hora,

      placa: record.placa || '',

      descripcion: record.descripcion || '',

      unidad: money(record.unidad) || 1,

      costo_unit: money(record.costoUnit),

      monto: money(record.monto),

      hora_registro: horaRegistroAhora()

    };

  }



  function mapCamionToRow(record) {

    return {

      id: record.id,

      placa: record.placa || '',

      chofer: record.chofer || '',

      telefono: record.telefono || '',

      marca: record.marca || '',

      fecha_registro: record.fechaRegistro || (typeof todayISO === 'function' ? todayISO() : ''),

      hora_registro: horaRegistroAhora()

    };

  }



  function clienteId(nombre) {

    const slug = String(nombre || '')

      .trim()

      .toLowerCase()

      .replace(/\s+/g, '-')

      .replace(/[^a-z0-9\-áéíóúñ]/gi, '')

      .slice(0, 48);

    return `cli-${slug || 'sin-nombre'}`;

  }



  function mapClienteToRow(data) {
    return {
      id: data.id || clienteId(data.nombre),
      nombre: data.nombre || '',
      dni: data.dniRuc || data.dni || '',
      hora_registro: horaRegistroAhora()
    };
  }



  async function enviarItem(item) {

    const row = item.rows?.[0];

    const id = row?.id || row?.uid;

    const isDelete = row?.accion === 'eliminar';



    await postNoCors({ mode: item.mode, rows: item.rows });

    if (!id) return true;



    if (isDelete) {

      const ok = await confirmarEliminado(id, item.mode);

      if (ok) unmarkSynced(item.mode, id);

      return ok;

    }



    const ok = await confirmarExiste(id, item.mode);

    if (ok) markSynced(item.mode, id);

    return ok;

  }



  async function sincronizarPendientes() {

    if (!isSyncEnabled() || syncing || !navigator.onLine) return;

    const queue = loadQueue();

    if (!queue.length) return;



    syncing = true;

    const rest = [];



    for (const item of queue) {

      try {

        const ok = await enviarItem(item);

        if (ok) continue;

        item.intentos = (item.intentos || 0) + 1;

        if (item.intentos < 8) rest.push(item);

      } catch (_) {

        item.intentos = (item.intentos || 0) + 1;

        if (item.intentos < 8) rest.push(item);

      }

    }



    saveQueue(rest);

    syncing = false;



    if (!rest.length && pullEnabled()) {

      pullFromServer().catch(() => {});

    }

  }



  function syncViajesFromCamp(camp) {

    if (!camp || !isSyncEnabled()) return;

    const ops = (state.operaciones || []).filter((op) => op.campamentoId === camp.id);

    ops.forEach((op) => {

      enqueue({

        id: `viajes-${op.id}`,

        mode: 'viajes',

        rows: [mapOperacionToRow(op)]

      });

    });

  }



  function syncGastos(records) {

    if (!isSyncEnabled() || !records?.length) return;

    records.forEach((record) => {

      enqueue({

        id: `gastos-${record.id}`,

        mode: 'gastos',

        rows: [mapGastoToRow(record)]

      });

    });

  }



  function syncCamion(record) {

    if (!record || !isSyncEnabled()) return;

    enqueue({

      id: `camiones-${record.id}`,

      mode: 'camiones',

      rows: [mapCamionToRow(record)]

    });

  }



  function syncCliente(data) {

    if (!data?.nombre || !isSyncEnabled()) return;

    const row = mapClienteToRow(data);

    enqueue({

      id: `clientes-${row.id}`,

      mode: 'clientes',

      rows: [row]

    });

  }



  function syncDelete(modo, id) {

    if (!id || !isSyncEnabled()) return;

    enqueue({

      id: `del-${modo}-${id}`,

      mode: modo,

      rows: [{ id, accion: 'eliminar', hora_registro: horaRegistroAhora() }]

    });

  }



  async function fetchDatos(modo) {

    const res = await callbackJsonp({ fetch: '1', mode: modo }, 12000);

    if (!res?.ok) throw new Error(res?.error || 'No se pudo consultar el servidor');

    return res.rows || res.data?.[modo] || [];

  }



  function mapServerCamionToLocal(row) {

    return {

      id: String(row.id),

      placa: row.placa || '',

      chofer: row.chofer || '',

      telefono: row.telefono || '',

      marca: row.marca || '',

      fechaRegistro: typeof normalizeDateISO === 'function'
        ? normalizeDateISO(row.fecha_registro)
        : (row.fecha_registro || (typeof todayISO === 'function' ? todayISO() : ''))

    };

  }



  function resolveGastoHora(row, prev) {
    const norm = (v) => (typeof normalizeTime === 'function' ? normalizeTime(v) : String(v || '').trim());

    const candidates = [
      row?.hora,
      row?.hora_registro,
      prev?.hora,
      prev?.horaRegistro,
      prev?.hora_registro
    ];

    let midnight = '';
    for (const c of candidates) {
      const t = norm(c);
      if (!t) continue;
      if (t === '00:00') {
        if (!midnight) midnight = t;
        continue;
      }
      return t;
    }

    const fromId = typeof horaFromMantillaId === 'function'
      ? horaFromMantillaId(row?.id || prev?.id)
      : '';
    if (fromId) return fromId;

    return midnight;
  }

  function mapServerGastoToLocal(row, prev) {
    const hora = resolveGastoHora(row, prev);
    const horaRegistroRaw = row?.hora_registro || prev?.horaRegistro || prev?.hora_registro || '';
    const horaRegistro = (typeof normalizeTime === 'function'
      ? (normalizeTime(horaRegistroRaw) || String(horaRegistroRaw || '').trim())
      : String(horaRegistroRaw || '').trim()) || prev?.horaRegistro || '';
    return {
      id: String(row.id),
      fecha: typeof normalizeDateISO === 'function' ? normalizeDateISO(row.fecha) : (row.fecha || ''),
      // Nunca pisar una hora local buena con vacío del servidor
      hora: hora || prev?.hora || '',
      horaRegistro: horaRegistro || prev?.horaRegistro || '',
      placa: row.placa || '',
      descripcion: row.descripcion || '',
      unidad: money(row.unidad) || 1,
      costoUnit: money(row.costo_unit),
      monto: money(row.monto)
    };
  }



  function mapServerViajeToLocal(row, prev) {

    return {

      id: String(row.id),

      campamentoId: prev?.campamentoId || '',

      fecha: typeof normalizeDateISO === 'function' ? normalizeDateISO(row.fecha) : String(row.fecha || ''),

      placa: row.placa || '',

      chofer: row.chofer || '',

      cliente: row.cliente || '',

      dniRuc: row.dni || '',

      producto: row.producto || '',

      unidad: row.unidad_medida || 'TM',

      peso: money(row.ticket_balanza),

      tarifa: money(row.flete_tonelada),

      fleteBase: prev?.fleteBase || 0,

      guia: money(row.guia),

      pesaje: money(row.pesaje),

      flete: money(row.total_pagar),

      combustible: money(row.combustible),

      viaticos: money(row.viaticos),

      gastos: money(row.total_gastos),

      utilidad: money(row.utilidad)

    };

  }



  /**

   * Aplica datos del servidor: actualiza, agrega y elimina localmente

   * lo que ya no está en el servidor (si estaba sincronizado).

   */

  function applyServerPull(mode, serverRows, mapFn, stateKey, sortFn, options = {}) {

    if (!state[stateKey]) state[stateKey] = [];

    const fetchOk = options.fetchOk !== false;



    const serverIds = new Set(

      (serverRows || []).map((r) => String(r.id || '').trim()).filter(Boolean)

    );

    const synced = loadSyncedIds()[mode] || new Set();

    const pending = getPendingIdsForMode(mode);

    let changed = false;



    const prevById = new Map(state[stateKey].map((item) => [String(item.id), item]));



    const kept = [];

    prevById.forEach((item, id) => {

      if (pending.has(id)) {

        kept.push(item);

        return;

      }

      if (!synced.has(id)) {

        kept.push(item);

        return;

      }

      if (!fetchOk || serverIds.has(id)) {

        kept.push(item);

        return;

      }

      changed = true;

    });



    const byId = new Map(kept.map((item) => [String(item.id), item]));



    (serverRows || []).forEach((row) => {

      const id = String(row.id || '').trim();

      if (!id) return;

      const prev = byId.get(id) || prevById.get(id);

      const local = mapFn(row, prev);

      const merged = { ...prev, ...local };

      const same = prev && JSON.stringify(prev) === JSON.stringify(merged);

      if (!same) changed = true;

      byId.set(id, merged);

      markSynced(mode, id);

    });



    state[stateKey] = [...byId.values()];

    if (typeof sortFn === 'function') {

      state[stateKey].sort(sortFn);

    }



    return changed;

  }



  function reconcileCampamentosAfterViajesPull() {

    if (!state.campamentos) return false;

    const opIds = new Set((state.operaciones || []).map((o) => String(o.id)));

    let changed = false;



    state.campamentos = state.campamentos.map((camp) => {

      const filas = (camp.filas || []).filter((f) => {

        if (!f.opId) return true;

        if (opIds.has(String(f.opId))) return true;

        changed = true;

        return false;

      });

      return { ...camp, filas };

    }).filter((camp) => {

      const valid = (camp.filas || []).some((f) => f.placa && Number(f.toneladas) > 0);

      if (!valid) changed = true;

      return valid;

    });



    return changed;

  }



  async function fetchDatosSeguro(modo) {

    try {

      const rows = await fetchDatos(modo);

      return { ok: true, rows };

    } catch (_) {

      return { ok: false, rows: [] };

    }

  }



  async function pullFromServer() {

    if (!isSyncEnabled() || !navigator.onLine || pulling || !pullEnabled()) return lastPull;

    pulling = true;



    try {

      await sincronizarPendientes();



      const [camionesRes, gastosRes, viajesRes] = await Promise.all([

        fetchDatosSeguro('camiones'),

        fetchDatosSeguro('gastos'),

        fetchDatosSeguro('viajes')

      ]);



      const changedCamiones = applyServerPull(

        'camiones',

        camionesRes.rows,

        (row) => mapServerCamionToLocal(row),

        'camiones',

        (a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || '') || a.placa.localeCompare(b.placa),

        { fetchOk: camionesRes.ok }

      );



      const changedGastos = applyServerPull(

        'gastos',

        gastosRes.rows,

        (row, prev) => mapServerGastoToLocal(row, prev),

        'mantenimiento',

        typeof compareMaintRecords === 'function' ? compareMaintRecords : undefined,

        { fetchOk: gastosRes.ok }

      );

      // Recuperar horas vacías desde horaRegistro / hora_registro del servidor
      let repairedHoras = false;
      if (gastosRes.ok && Array.isArray(state.mantenimiento)) {
        const byServer = new Map((gastosRes.rows || []).map((r) => [String(r.id), r]));
        state.mantenimiento.forEach((m) => {
          const row = byServer.get(String(m.id));
          const fixed = resolveGastoHora(row || {}, m);
          if (fixed && fixed !== '00:00' && fixed !== m.hora) {
            m.hora = fixed;
            repairedHoras = true;
          }
          if ((!m.horaRegistro || m.horaRegistro === '00:00') && row?.hora_registro) {
            const reg = typeof normalizeTime === 'function'
              ? normalizeTime(row.hora_registro)
              : String(row.hora_registro).trim();
            if (reg) {
              m.horaRegistro = reg;
              repairedHoras = true;
            }
          }
          if ((!m.hora || m.hora === '00:00') && m.horaRegistro) {
            const fromReg = typeof normalizeTime === 'function'
              ? normalizeTime(m.horaRegistro)
              : '';
            if (fromReg && fromReg !== '00:00') {
              m.hora = fromReg;
              repairedHoras = true;
            }
          }
        });
      }



      const changedViajes = applyServerPull(

        'viajes',

        viajesRes.rows,

        (row, prev) => mapServerViajeToLocal(row, prev),

        'operaciones',

        (a, b) => b.fecha.localeCompare(a.fecha) || String(a.id).localeCompare(String(b.id)),

        { fetchOk: viajesRes.ok }

      );



      const changedCamps = changedViajes ? reconcileCampamentosAfterViajesPull() : false;



      if (changedCamiones && typeof syncCatalogosFromCamiones === 'function') {

        syncCatalogosFromCamiones();

      }



      const changed = changedCamiones || changedGastos || changedViajes || changedCamps || repairedHoras;



      if (changed && typeof saveData === 'function') saveData();



      lastPull = {

        ok: true,

        changed,

        at: Date.now(),

        counts: {

          camiones: camionesRes.rows.length,

          gastos: gastosRes.rows.length,

          viajes: viajesRes.rows.length

        }

      };



      if (changed) {

        document.dispatchEvent(new CustomEvent('mantilla:datos-servidor', { detail: lastPull }));

      }



      return lastPull;

    } catch (err) {

      lastPull = { ok: false, changed: false, at: Date.now(), error: String(err) };

      return lastPull;

    } finally {

      pulling = false;

    }

  }



  async function pingServidor() {

    if (!isSyncEnabled()) return { ok: false, offline: true };

    try {

      return await callbackJsonp({ ping: '1' }, 6000);

    } catch (err) {

      return { ok: false, error: String(err) };

    }

  }



  let pullInterval = null;



  function schedulePullInterval() {

    if (pullInterval || !pullEnabled()) return;

    pullInterval = setInterval(() => {

      if (document.visibilityState === 'visible' && navigator.onLine) {

        pullFromServer().catch(() => {});

      }

    }, 45000);

  }



  async function init() {

    if (!isSyncEnabled()) return lastPull;



    window.addEventListener('online', () => {

      sincronizarPendientes().then(() => pullFromServer());

    });



    document.addEventListener('visibilitychange', () => {

      if (document.visibilityState === 'hidden') {
        if (typeof flushPersistencia === 'function') flushPersistencia();
        return;
      }

      sincronizarPendientes().then(() => pullFromServer());

    });



    await sincronizarPendientes();

    schedulePullInterval();

    return pullFromServer();

  }



  window.Mantilla = window.Mantilla || {};

  Mantilla.sync = {

    init,

    isEnabled: isSyncEnabled,

    enqueue,

    sincronizarPendientes,

    syncViajesFromCamp,

    syncGastos,

    syncCamion,

    syncCliente,

    syncDelete,

    fetchDatos,

    pullFromServer,

    pingServidor,

    pendientes: () => loadQueue().length,

    get lastPull() { return lastPull; }

  };

})();

