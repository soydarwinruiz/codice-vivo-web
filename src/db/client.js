// Cliente de la base de datos (RPC). Dos motores con la misma interfaz:
//  · Web/iPhone: SQLite (WASM) en un Web Worker sobre OPFS.
//  · Escritorio (Windows, Electron): SQLite nativo en el proceso principal, a través de window.codiceDesktop.
export const desktop = typeof window !== 'undefined' ? window.codiceDesktop || null : null;

let seq = 0;
const pending = new Map();
let worker = null;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onerror = (e) => {
    const msg = `No se pudo iniciar la base de datos (${e.message || 'worker'}).`;
    window.__bootError?.(msg);
    pending.forEach((p) => p.reject(new Error(msg))); pending.clear();
  };
  worker.onmessage = (e) => {
    const { id, result, error, progress } = e.data;
    const p = pending.get(id);
    if (!p) return;
    if (progress !== undefined) { p.onProgress?.(progress); return; }
    pending.delete(id);
    error ? p.reject(new Error(error)) : p.resolve(result);
  };
  return worker;
}

// Electron antepone «Error invoking remote method…» a los errores: se deja solo el mensaje útil.
const clean = (e) => new Error(String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));

export function call(op, args, onProgress) {
  const id = ++seq;
  if (desktop) {
    if (op === 'importLibrary' && args?.file && !args.path) args = { path: desktop.pathForFile(args.file) };
    return desktop.db(id, op, args, onProgress).catch((e) => { throw clean(e); });
  }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, op, args });
  });
}

export const q = (sql, ...params) => call('query', { db: 'bible', sql, params });
export const uq = (sql, ...params) => call('query', { db: 'user', sql, params });
export const uexec = (sql, ...params) => call('exec', { db: 'user', sql, params });
export const uinsert = (sql, ...params) => call('insert', { db: 'user', sql, params });
export const umany = (statements) => call('execMany', { db: 'user', statements });
