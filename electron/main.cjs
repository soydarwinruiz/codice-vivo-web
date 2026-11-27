// Códice vivo — versión de escritorio (Windows). Proceso principal de Electron.
// La interfaz es la misma app web (Preact); los datos se guardan con el SQLite que trae Electron (node:sqlite),
// directamente en archivos de la carpeta de datos del usuario, sin WASM ni almacenamiento del navegador.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const DIST = path.join(__dirname, '..', 'dist-desktop');
const DATA = app.getPath('userData');
const BIBLE = path.join(DATA, 'biblioteca.db');
const USER = path.join(DATA, 'usuario.db');
const WINDOW_STATE = path.join(DATA, 'ventana.json');
const DEV_URL = process.env.CODICE_DEV_URL; // p. ej. http://localhost:5173/ con «npm run desktop:dev»

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

// ---------------------------------------------------------------- Base de datos
const dbs = {};
function open(name) {
  if (dbs[name]) return dbs[name];
  if (name === 'bible') {
    if (!fs.existsSync(BIBLE)) throw new Error('La biblioteca no está instalada.');
    dbs.bible = new DatabaseSync(BIBLE, { readOnly: true });
  } else {
    dbs.user = new DatabaseSync(USER);
    dbs.user.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
  }
  return dbs[name];
}
function closeBible() { if (dbs.bible) { dbs.bible.close(); delete dbs.bible; } }

// node:sqlite no acepta booleanos ni undefined: se convierten como lo hace sqlite-wasm.
const bind = (params) => (params || []).map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
const status = () => ({ hasLibrary: fs.existsSync(BIBLE), files: [BIBLE, USER].filter((f) => fs.existsSync(f)).map((f) => path.basename(f)) });

function run(d, sql, params) {
  const p = bind(params);
  if (!p.length) { d.exec(sql); return Number(d.prepare('SELECT changes() n').get().n); }
  return Number(d.prepare(sql).run(...p).changes);
}

/** Copia (y descomprime si es .gz) el archivo de la biblioteca a la carpeta de datos. */
async function importLibrary(file, onProgress) {
  if (!file || !fs.existsSync(file)) throw new Error('No se encontró el archivo.');
  const gz = /\.(gz|bin)$/i.test(file);
  const size = fs.statSync(file).size;
  const tmp = BIBLE + '.tmp';
  let done = 0, last = 0;
  const counter = new Transform({
    transform(chunk, _e, cb) {
      done += chunk.length;
      if (done - last > 1_000_000) { last = done; onProgress(Math.min(0.99, done / size)); }
      cb(null, chunk);
    },
  });
  const steps = [fs.createReadStream(file), counter];
  if (gz) steps.push(zlib.createGunzip());
  steps.push(fs.createWriteStream(tmp));
  try {
    await pipeline(...steps);
    const check = new DatabaseSync(tmp, { readOnly: true });
    let n = 0;
    try { n = check.prepare('SELECT COUNT(*) n FROM versions').get().n; } catch { n = 0; } finally { check.close(); }
    if (!n) throw new Error('El archivo no parece ser la biblioteca de Códice vivo.');
    closeBible();
    fs.rmSync(BIBLE, { force: true });
    fs.renameSync(tmp, BIBLE);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return status();
}

const handlers = {
  init: () => status(),
  importLibrary: ({ path: file }, progress) => importLibrary(file, progress),
  query: ({ db, sql, params }) => open(db).prepare(sql).all(...bind(params)),
  exec: ({ db, sql, params }) => run(open(db), sql, params),
  execMany: ({ db, statements }) => {
    const d = open(db);
    d.exec('BEGIN');
    try { for (const s of statements) run(d, s.sql, s.params); d.exec('COMMIT'); } catch (e) { d.exec('ROLLBACK'); throw e; }
    return true;
  },
  insert: ({ db, sql, params }) => {
    const r = open(db).prepare(sql).run(...bind(params));
    return r.changes ? Number(r.lastInsertRowid) : -1;
  },
  deleteLibrary: () => { closeBible(); fs.rmSync(BIBLE, { force: true }); return status(); },
};

ipcMain.handle('codice:db', async (e, id, op, args) => {
  const h = handlers[op];
  if (!h) throw new Error(`Operación desconocida: ${op}`);
  return h(args || {}, (p) => e.sender.send('codice:progress', id, p));
});

ipcMain.handle('codice:pickLibrary', async (e) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: 'Elegir la biblioteca de Códice vivo',
    filters: [{ name: 'Biblioteca de Códice vivo', extensions: ['gz', 'db', 'bin'] }, { name: 'Todos los archivos', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('codice:saveText', async (e, name, text) => {
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return r.filePath;
});

ipcMain.handle('codice:openText', async (e) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    filters: [{ name: 'Respaldo JSON', extensions: ['json'] }], properties: ['openFile'],
  });
  return r.canceled ? null : fs.readFileSync(r.filePaths[0], 'utf8');
});

ipcMain.handle('codice:info', () => ({ version: app.getVersion(), data: DATA, platform: process.platform }));

// ---------------------------------------------------------------- Ventana
function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(WINDOW_STATE, 'utf8')); } catch { return null; }
}
function saveWindowState(win) {
  try {
    const st = { bounds: win.getNormalBounds(), maximized: win.isMaximized() };
    fs.writeFileSync(WINDOW_STATE, JSON.stringify(st));
  } catch { /* sin importancia */ }
}

let win;
function createWindow() {
  const st = loadWindowState();
  const area = screen.getPrimaryDisplay().workAreaSize;
  let bounds = st?.bounds || { width: Math.min(1440, area.width), height: Math.min(900, area.height) };
  // Si la ventana guardada quedó fuera de todas las pantallas, se centra de nuevo.
  if (bounds.x !== undefined && !screen.getAllDisplays().some((d) => {
    const a = d.workArea; return bounds.x < a.x + a.width && bounds.x + bounds.width > a.x && bounds.y < a.y + a.height && bounds.y + bounds.height > a.y;
  })) bounds = { width: bounds.width, height: bounds.height };

  win = new BrowserWindow({
    ...bounds, minWidth: 900, minHeight: 600, show: false,
    title: 'Códice vivo', backgroundColor: '#FFFBF5',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (st?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveWindowState(win));

  // Enlaces externos: en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const ok = url.startsWith('app://') || (DEV_URL && url.startsWith(DEV_URL));
    if (!ok) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });

  win.loadURL(DEV_URL || 'app://codice/index.html');
}

const send = (cmd) => () => win?.webContents.send('codice:menu', cmd);
function buildMenu() {
  const template = [
    { label: '&Archivo', submenu: [
      { label: 'Exportar respaldo…', click: send('backup:export') },
      { label: 'Importar respaldo…', click: send('backup:import') },
      { type: 'separator' },
      { label: 'Reemplazar biblioteca…', click: send('library:replace') },
      { label: 'Abrir carpeta de datos', click: () => shell.openPath(DATA) },
      { type: 'separator' },
      { label: 'Ajustes', accelerator: 'CmdOrCtrl+,', click: send('nav:/settings') },
      { type: 'separator' },
      { role: 'quit', label: 'Salir' },
    ] },
    { label: '&Editar', submenu: [
      { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' },
      { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' },
    ] },
    { label: '&Ir', submenu: [
      { label: 'Ir a referencia…', accelerator: 'CmdOrCtrl+G', click: send('goto') },
      { label: 'Buscar en la Biblia…', accelerator: 'CmdOrCtrl+F', click: send('search') },
      { type: 'separator' },
      { label: 'Capítulo anterior', accelerator: 'CmdOrCtrl+PageUp', click: send('prev') },
      { label: 'Capítulo siguiente', accelerator: 'CmdOrCtrl+PageDown', click: send('next') },
      { type: 'separator' },
      { label: 'Atrás', accelerator: 'Alt+Left', click: send('back') },
      { label: 'Adelante', accelerator: 'Alt+Right', click: send('forward') },
    ] },
    { label: '&Módulos', submenu: [
      { label: 'Biblia', accelerator: 'CmdOrCtrl+1', click: send('nav:/reader') },
      { label: 'Hoy', accelerator: 'CmdOrCtrl+2', click: send('nav:/today') },
      { label: 'Estudio', accelerator: 'CmdOrCtrl+3', click: send('nav:/study') },
      { label: 'Diccionario bíblico', accelerator: 'CmdOrCtrl+4', click: send('nav:/dictionary') },
      { label: 'Índice temático', click: send('nav:/index') },
      { label: 'Mis estudios', click: send('nav:/studies') },
      { label: 'Mis temas y notas', accelerator: 'CmdOrCtrl+5', click: send('nav:/mine') },
      { label: 'Diario de oración', click: send('nav:/journal') },
      { label: 'Memorizar', click: send('nav:/memory') },
      { label: 'Progreso y planes', accelerator: 'CmdOrCtrl+6', click: send('nav:/progress') },
    ] },
    { label: '&Ver', submenu: [
      { label: 'Tema claro', click: send('theme:light') },
      { label: 'Tema oscuro', click: send('theme:dark') },
      { label: 'Tema sepia', click: send('theme:sepia') },
      { label: 'Tema del sistema', click: send('theme:system') },
      { type: 'separator' },
      { label: 'Letra más grande', accelerator: 'CmdOrCtrl+=', click: send('font:+') },
      { label: 'Letra más pequeña', accelerator: 'CmdOrCtrl+-', click: send('font:-') },
      { type: 'separator' },
      { label: 'Mostrar/ocultar lista de libros', accelerator: 'CmdOrCtrl+B', click: send('toggle:books') },
      { label: 'Mostrar/ocultar panel de estudio', accelerator: 'CmdOrCtrl+J', click: send('toggle:panel') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
      { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
    ] },
    { label: 'Ay&uda', submenu: [
      { label: 'Atajos de teclado', accelerator: 'F1', click: send('help') },
      { label: 'Acerca de Códice vivo', click: () => dialog.showMessageBox(win, {
        type: 'info', title: 'Códice vivo', message: `Códice vivo ${app.getVersion()}`,
        detail: 'Biblia de estudio 100% local para Windows.\nTus datos se guardan solo en este equipo:\n' + DATA,
      }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    let file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  for (const k of Object.keys(dbs)) { try { dbs[k].close(); } catch { /* ya cerrada */ } }
  app.quit();
});
