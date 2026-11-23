// Worker de base de datos: SQLite (WASM) sobre el almacenamiento privado del navegador (OPFS, pool SAH).
// No requiere cabeceras COOP/COEP, por lo que funciona en GitHub Pages y en Safari para iPhone (iOS 16.4+).
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let sqlite3, pool;
const dbs = {};
const BIBLE = '/biblioteca.db';
const USER = '/usuario.db';

async function init() {
  if (pool) return status();
  sqlite3 = await sqlite3InitModule();
  pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'codice-vivo', initialCapacity: 6 });
  return status();
}

function status() {
  const names = pool.getFileNames();
  return { hasLibrary: names.includes(BIBLE), files: names };
}

function open(name) {
  const path = name === 'bible' ? BIBLE : USER;
  if (!dbs[name]) {
    dbs[name] = new pool.OpfsSAHPoolDb(path);
    if (name === 'user') dbs[name].exec('PRAGMA journal_mode=DELETE;');
  }
  return dbs[name];
}

/** Importa la biblioteca desde un archivo (.db o .db.gz) descomprimiéndolo por partes. */
async function importLibrary(file, id) {
  if (dbs.bible) { dbs.bible.close(); delete dbs.bible; }
  const gz = /\.(gz|bin)$/i.test(file.name);
  let stream = file.stream();
  if (gz) stream = stream.pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const expected = gz ? 110_000_000 : file.size;
  let done = 0, last = 0;
  await pool.importDb(BIBLE, async () => {
    const r = await reader.read();
    if (r.done) return undefined;
    done += r.value.byteLength;
    if (done - last > 2_000_000) { last = done; postMessage({ id, progress: Math.min(0.99, done / expected) }); }
    return r.value;
  });
  const db = open('bible');
  const n = db.selectValue("SELECT COUNT(*) FROM versions");
  if (!n) throw new Error('El archivo no parece ser la biblioteca de Códice vivo.');
  return status();
}

const handlers = {
  init,
  importLibrary: ({ file }, id) => importLibrary(file, id),
  query: ({ db, sql, params }) => open(db).exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }),
  exec: ({ db, sql, params }) => { open(db).exec({ sql, bind: params }); return open(db).changes(); },
  execMany: ({ db, statements }) => {
    const d = open(db);
    d.transaction(() => { for (const s of statements) d.exec({ sql: s.sql, bind: s.params }); });
    return true;
  },
  insert: ({ db, sql, params }) => { const d = open(db); d.exec({ sql, bind: params }); return d.changes() ? Number(d.selectValue('SELECT last_insert_rowid()')) : -1; },
  deleteLibrary: async () => { if (dbs.bible) { dbs.bible.close(); delete dbs.bible; } pool.unlink(BIBLE); return status(); },
};

onmessage = async (e) => {
  const { id, op, args } = e.data;
  try {
    const result = await handlers[op](args || {}, id);
    postMessage({ id, result });
  } catch (err) {
    postMessage({ id, error: String(err && err.message || err) });
  }
};
