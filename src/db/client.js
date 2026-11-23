// Cliente del worker de base de datos (RPC por mensajes).
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let seq = 0;
const pending = new Map();

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

export function call(op, args, onProgress) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, op, args });
  });
}

export const q = (sql, ...params) => call('query', { db: 'bible', sql, params });
export const uq = (sql, ...params) => call('query', { db: 'user', sql, params });
export const uexec = (sql, ...params) => call('exec', { db: 'user', sql, params });
export const uinsert = (sql, ...params) => call('insert', { db: 'user', sql, params });
export const umany = (statements) => call('execMany', { db: 'user', statements });
