// Diseño de escritorio (Windows y navegadores de pantalla ancha), al estilo de e-Sword / Logos:
// barra de herramientas · lista de libros · Biblia en columnas paralelas · panel de estudio sincronizado.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings, updateSettings } from '../../data/settings.js';
import { parseQuery, parseRefs } from '../../domain/refparser.js';
import { toggle as speakToggle, useSpeaker } from '../../domain/speaker.js';
import { call, desktop } from '../../db/client.js';
import { useAsync, useUser, nav, toast, Dialog, Linked, Article, Loading, argb, HIGHLIGHTS, HIGHLIGHT_NAMES } from '../components.jsx';
import { NoteDialog, TopicDialog, TagDialog, WordsDialog, splitWords } from '../screens/Reader.jsx';
import './desktop.css';

// ---------------------------------------------------------------- Preferencias del diseño
const LKEY = 'codice-vivo-escritorio';
const LDEFAULTS = { books: 230, panel: 420, showBooks: true, showPanel: true, tab: 'comm', versions: null };
let layout = { ...LDEFAULTS, ...JSON.parse(localStorage.getItem(LKEY) || '{}') };
const lsubs = new Set();
function setLayout(p) { layout = { ...layout, ...p }; localStorage.setItem(LKEY, JSON.stringify(layout)); lsubs.forEach((f) => f(layout)); }
function useLayout() { const [l, set] = useState(layout); useEffect(() => { lsubs.add(set); return () => lsubs.delete(set); }, []); return l; }

/** ¿Usar el diseño de escritorio? Siempre en Windows (Electron); en el navegador, si la pantalla es ancha y hay ratón. */
export function wantsDesktop(s) {
  if (desktop) return true;
  if (s.layout === 'desktop') return true;
  if (s.layout === 'mobile') return false;
  return matchMedia('(min-width: 1100px) and (pointer: fine)').matches;
}

const MAX_COLS = 4;
const key = (b, c, v) => b * 1000000 + c * 1000 + v;
const nextOf = (b, c) => (c < C.book(b).chapters ? [b, c + 1] : b < 66 ? [b + 1, 1] : null);
const prevOf = (b, c) => (c > 1 ? [b, c - 1] : b > 1 ? [b - 1, C.book(b - 1).chapters] : null);
const inInput = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
const goTo = (b, c, v = 0, ve = 0) => nav('/reader', { b, c, v: v || undefined, ve: ve || undefined, t: Date.now() });

// La última posición de la Biblia sigue sincronizando el panel aunque se esté viendo otro módulo.
let lastLoc = null;

const MODULES = [
  ['/reader', '📖', 'Biblia'], ['/today', '☀️', 'Hoy'], ['/study', '🎓', 'Estudio'], ['/dictionary', '📗', 'Diccionario'],
  ['/mine', '🔖', 'Mis temas'], ['/journal', '🙏', 'Diario'], ['/progress', '📊', 'Progreso'], ['/settings', '⚙️', 'Ajustes'],
];
const TABS = [['comm', 'Comentario'], ['xref', 'Referencias'], ['cmp', 'Comparar'], ['dict', 'Diccionario'], ['mine', 'Mis notas'], ['intro', 'Libro']];

export function DesktopShell({ route, children }) {
  const s = useSettings();
  const L = useLayout();
  const a = route.params;
  const isBible = route.path === '/reader';
  const b = isBible ? +a.b || s.lastBook : lastLoc?.b || s.lastBook;
  const c = isBible ? +a.c || s.lastChapter : lastLoc?.c || s.lastChapter;
  const versions = (L.versions || [s.version]).filter((v) => C.versions.some((x) => x.id === v)).slice(0, MAX_COLS);
  if (!versions.length) versions.push(C.versions[0]?.id);

  const [sel, setSel] = useState(+a.v ? { b, c, v: +a.v, ve: +(a.ve || a.v) } : null);
  const [dictQ, setDictQ] = useState('');
  const [dialog, setDialog] = useState(null);
  const refBox = useRef(null), searchBox = useRef(null);

  // Primera vez en escritorio: abrir la Biblia en lugar de «Hoy».
  useEffect(() => { if (!location.hash) nav('/reader', null, true); }, []);
  useEffect(() => { document.documentElement.classList.add('desktop-layout'); return () => document.documentElement.classList.remove('desktop-layout'); }, []);
  // Al llegar a un pasaje (enlace, búsqueda, «Ir a…») se selecciona el versículo indicado.
  useEffect(() => { if (isBible) setSel(+a.v ? { b, c, v: +a.v, ve: Math.max(+a.v, +(a.ve || a.v)) } : null); }, [isBible, a.t, b, c]);
  useEffect(() => { if (isBible) { lastLoc = { b, c }; updateSettings({ lastBook: b, lastChapter: c }); } }, [isBible, b, c]);
  useEffect(() => { if (s.version !== versions[0]) setLayout({ versions: [s.version, ...versions.slice(1).filter((v) => v !== s.version)] }); }, [s.version]);

  const setVersions = (vs) => { setLayout({ versions: vs }); if (vs[0] !== s.version) updateSettings({ version: vs[0] }); };
  const chapterStep = (d) => { const t = d < 0 ? prevOf(b, c) : nextOf(b, c); if (t) goTo(t[0], t[1]); };
  const lookUp = (word) => { setDictQ(word); setLayout({ tab: 'dict', showPanel: true }); };

  function command(cmd) {
    if (cmd.startsWith('nav:')) nav(cmd.slice(4));
    else if (cmd === 'goto') { refBox.current?.focus(); refBox.current?.select(); }
    else if (cmd === 'search') { searchBox.current?.focus(); searchBox.current?.select(); }
    else if (cmd === 'prev') chapterStep(-1);
    else if (cmd === 'next') chapterStep(1);
    else if (cmd === 'back') history.back();
    else if (cmd === 'forward') history.forward();
    else if (cmd.startsWith('theme:')) updateSettings({ theme: cmd.slice(6) });
    else if (cmd === 'font:+') updateSettings((x) => ({ fontSize: Math.min(34, x.fontSize + 1) }));
    else if (cmd === 'font:-') updateSettings((x) => ({ fontSize: Math.max(12, x.fontSize - 1) }));
    else if (cmd === 'toggle:books') setLayout({ showBooks: !layout.showBooks });
    else if (cmd === 'toggle:panel') setLayout({ showPanel: !layout.showPanel });
    else if (cmd === 'help') setDialog('help');
    else if (cmd === 'library:replace') setDialog('library');
    else if (cmd === 'backup:export') exportBackup();
    else if (cmd === 'backup:import') importBackup();
  }
  const cmdRef = useRef(command); cmdRef.current = command;

  // Menú de la ventana (Windows) y atajos de teclado.
  useEffect(() => desktop?.onMenu((cmd) => cmdRef.current(cmd)), []);
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      // Ctrl+G / Ctrl+F también desde el teclado (son idempotentes, aunque el menú de Windows los reciba igual).
      if (mod && !e.shiftKey && (k === 'g' || k === 'f' || (!desktop && (k === 'b' || k === 'j')))) {
        e.preventDefault(); cmdRef.current({ g: 'goto', f: 'search', b: 'toggle:books', j: 'toggle:panel' }[k]); return;
      }
      if (!desktop && e.key === 'F1') { e.preventDefault(); cmdRef.current('help'); return; }
      if (inInput(document.activeElement) || mod || e.altKey || document.querySelector('.scrim')) return;
      if (location.hash.startsWith('#/reader') || !location.hash) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); cmdRef.current('prev'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); cmdRef.current('next'); }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  async function exportBackup() {
    const json = await U.exportJson();
    const name = `codice-vivo-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    if (desktop) { const p = await desktop.saveText(name, json); if (p) toast('Respaldo guardado'); return; }
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); el.download = name; el.click();
  }
  async function importBackup() {
    if (!desktop) { nav('/settings'); return; }
    const text = await desktop.openText(); if (text) setDialog({ restore: text });
  }

  const onRef = (e) => {
    e.preventDefault();
    const v = refBox.current.value.trim(); if (!v) return;
    const r = parseQuery(v);
    if (r) { goTo(r.book, r.chapter, r.verse, r.chapterEnd === r.chapter ? r.verseEnd : 0); refBox.current.value = ''; refBox.current.blur(); }
    else { nav('/search', { q: v, t: Date.now() }); refBox.current.value = ''; refBox.current.blur(); }
  };
  const onSearch = (e) => { e.preventDefault(); const v = searchBox.current.value.trim(); if (v) nav('/search', { q: v, t: Date.now() }); };

  const bk = C.book(b);
  const moduleKey = `${route.path}?${a.q || ''}${a.id || ''}${a.t || ''}`;
  return (
    <div class="dk">
      <header class="dk-tool">
        <div class="grp">
          <button class="tb" title="Atrás (Alt+←)" onClick={() => history.back()}>◀</button>
          <button class="tb" title="Adelante (Alt+→)" onClick={() => history.forward()}>▶</button>
          <button class={`tb ${L.showBooks ? 'on' : ''}`} title="Lista de libros (Ctrl+B)" onClick={() => setLayout({ showBooks: !L.showBooks })}>☰</button>
        </div>
        <form class="grp" onSubmit={onRef}>
          <button type="button" class="tb" title="Capítulo anterior" onClick={() => chapterStep(-1)}>‹</button>
          <input ref={refBox} class="dk-in ref" placeholder={`${bk?.name || ''} ${c}`} title="Ir a una referencia (Ctrl+G). Ej.: Jn 3:16, Ro 8, Sal 23:1-4" />
          <button type="button" class="tb" title="Capítulo siguiente" onClick={() => chapterStep(1)}>›</button>
        </form>
        <form class="grp grow" onSubmit={onSearch}>
          <input ref={searchBox} class="dk-in" type="search" placeholder="Buscar en la Biblia (Ctrl+F)" />
        </form>
        <nav class="grp mods">
          {MODULES.map(([p, ic, l]) => <button key={p} class={`tb mod ${route.path === p ? 'on' : ''}`} title={l} onClick={() => nav(p)}><span>{ic}</span><span class="lbl">{l}</span></button>)}
        </nav>
        <div class="grp">
          <button class="tb" title="Letra más pequeña (Ctrl+-)" onClick={() => command('font:-')}>A−</button>
          <button class="tb" title="Letra más grande (Ctrl+=)" onClick={() => command('font:+')}>A+</button>
          <button class={`tb ${L.showPanel ? 'on' : ''}`} title="Panel de estudio (Ctrl+J)" onClick={() => setLayout({ showPanel: !L.showPanel })}>▥</button>
        </div>
      </header>

      <div class="dk-body">
        {L.showBooks && <><BookTree b={b} c={c} /><Splitter prop="books" min={160} max={420} /></>}
        <main class="dk-center">
          {isBible
            ? <BiblePane b={b} c={c} versions={versions} setVersions={setVersions} sel={sel} setSel={setSel} target={+a.v ? a.t : null} lookUp={lookUp} setDialog={setDialog} />
            : <div class="dk-module" key={moduleKey}><div class="dk-module-in">{children}</div></div>}
        </main>
        {L.showPanel && <><Splitter prop="panel" min={300} max={760} invert /><StudyPanel tab={L.tab} b={b} c={c} sel={sel} version={versions[0]} dictQ={dictQ} setDictQ={setDictQ} /></>}
      </div>

      <footer class="dk-status">
        <span><b>{bk?.name} {c}{sel && sel.b === b && sel.c === c ? `:${sel.v}${sel.ve > sel.v ? `–${sel.ve}` : ''}` : ''}</b> · {versions.join(' | ')}</span>
        <span class="spacer" />
        <span class="muted">Ctrl+G ir a · Ctrl+F buscar · ←/→ capítulo · ↑/↓ versículo · doble clic: diccionario · F1 ayuda</span>
      </footer>

      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'library' && <Dialog title="¿Reemplazar la biblioteca?" onClose={() => setDialog(null)} actions={<><button class="btn text" onClick={() => setDialog(null)}>Cancelar</button>
        <button class="btn text" onClick={async () => { await call('deleteLibrary'); nav('/setup', null, true); location.reload(); }}>Continuar</button></>}>
        <p class="small">Se borrará la biblioteca actual y podrás elegir un archivo nuevo. Tus datos personales no se tocan.</p></Dialog>}
      {dialog?.restore && <Dialog title="¿Restaurar respaldo?" onClose={() => setDialog(null)} actions={<><button class="btn text" onClick={() => setDialog(null)}>Cancelar</button>
        <button class="btn text" onClick={async () => { const t = dialog.restore; setDialog(null); try { await U.importJson(t); toast('Respaldo restaurado'); } catch { toast('Archivo no válido'); } }}>Restaurar</button></>}>
        <p class="small">Se reemplazarán todos tus datos personales actuales por los del archivo (compatible con Android y la versión web).</p></Dialog>}
      {dialog?.verse && <VerseDialogs d={dialog} version={versions[0]} onClose={() => setDialog(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Divisor redimensionable
function Splitter({ prop, min, max, invert }) {
  const down = (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = layout[prop];
    const move = (ev) => { const d = ev.clientX - x0; setLayout({ [prop]: Math.max(min, Math.min(max, w0 + (invert ? -d : d))) }); };
    const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); document.body.classList.remove('dk-resizing'); };
    addEventListener('mousemove', move); addEventListener('mouseup', up); document.body.classList.add('dk-resizing');
  };
  return <div class="dk-split" onMouseDown={down} onDblClick={() => setLayout({ [prop]: LDEFAULTS[prop] })} title="Arrastra para cambiar el ancho (doble clic: restablecer)" />;
}

// ---------------------------------------------------------------- Lista de libros
function BookTree({ b, c }) {
  const L = useLayout();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(b);
  useEffect(() => setOpen(b), [b]);
  const read = useUser(async () => new Set((await U.chaptersRead()).map((r) => r.book * 1000 + r.chapter)));
  const f = C.fold(filter);
  const list = C.books.filter((x) => !f || C.fold(x.name).includes(f) || C.fold(x.abbr || '').startsWith(f));
  const curRef = useRef(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'nearest' }); }, [b]);
  const group = (t, title) => {
    const items = list.filter((x) => x.testament === t); if (!items.length) return null;
    return <>
      <div class="dk-tree-h">{title}</div>
      {items.map((x) => {
        const done = read ? Array.from({ length: x.chapters }, (_, i) => read.has(x.id * 1000 + i + 1)).filter(Boolean).length : 0;
        return <div key={x.id} ref={x.id === b ? curRef : null}>
          <div class={`dk-book ${x.id === b ? 'on' : ''}`} onClick={() => setOpen(open === x.id ? 0 : x.id)}>
            <span class="tw">{open === x.id ? '▾' : '▸'}</span><span class="grow">{x.name}</span>
            {done > 0 && <span class="cnt" title={`${done} de ${x.chapters} capítulos leídos`}>{done === x.chapters ? '✓' : `${done}/${x.chapters}`}</span>}
          </div>
          {open === x.id && <div class="dk-chaps">{Array.from({ length: x.chapters }, (_, i) => i + 1).map((n) => (
            <button key={n} class={`${x.id === b && n === c ? 'on' : ''} ${read?.has(x.id * 1000 + n) ? 'read' : ''}`} onClick={() => goTo(x.id, n)}>{n}</button>
          ))}</div>}
        </div>;
      })}
    </>;
  };
  return (
    <aside class="dk-books" style={{ width: `${L.books}px` }}>
      <div class="dk-books-f"><input class="dk-in" type="search" value={filter} onInput={(e) => setFilter(e.target.value)} placeholder="Filtrar libros…" /></div>
      <div class="dk-tree">{group('AT', 'Antiguo Testamento')}{group('NT', 'Nuevo Testamento')}</div>
    </aside>
  );
}

// ---------------------------------------------------------------- Biblia (columnas paralelas)
function BiblePane({ b, c, versions, setVersions, sel, setSel, target, lookUp, setDialog }) {
  const s = useSettings(); const sp = useSpeaker();
  const scroller = useRef(null);
  const [menu, setMenu] = useState(null);
  const data = useAsync(async () => {
    const [cols, heads, notes] = await Promise.all([
      Promise.all(versions.map((v) => C.chapter(v, b, c))), s.showHeadings ? C.headings(versions[0], b, c) : [], C.versesWithNotes(b, c),
    ]);
    return { cols: cols.map((vs) => Object.fromEntries(vs.map((v) => [v.verse, v]))), main: cols[0], heads, notes };
  }, [b, c, versions.join(','), s.showHeadings]);
  const user = useUser(async () => ({
    hl: new Map((await U.highlightsAll()).filter((h) => h.book === b && h.chapter === c).map((h) => [h.verse, h.color])),
    notes: new Map((await U.notesAll()).filter((n) => n.book === b && n.chapter === c).map((n) => [n.verse, n])),
    bm: new Set((await U.bookmarksAll()).filter((x) => x.book === b && x.chapter === c).map((x) => x.verse)),
    tagged: await U.taggedKeys(),
    read: (await U.chaptersRead()).some((r) => r.book === b && r.chapter === c),
    words: (await U.wordHighlights(versions[0])).filter((w) => w.book === b && w.chapter === c).reduce((m, w) => { (m.get(w.verse) || m.set(w.verse, []).get(w.verse)).push(w); return m; }, new Map()),
  }), [b, c, versions[0]]);

  // Al cambiar de capítulo: al principio, o al versículo pedido.
  useEffect(() => {
    if (!data) return;
    requestAnimationFrame(() => {
      const el = sel && sel.b === b && sel.c === c && scroller.current?.querySelector(`[data-v="${sel.v}"]`);
      if (el && target) el.scrollIntoView({ block: 'center' }); else if (!target) scroller.current?.scrollTo(0, 0);
    });
  }, [data, target]);

  const selHere = sel && sel.b === b && sel.c === c ? sel : null;
  const isSel = (v) => selHere && v >= selHere.v && v <= selHere.ve;

  // ↑/↓ mueven el versículo seleccionado; Ctrl+C copia los versículos seleccionados.
  useEffect(() => {
    const onKey = (e) => {
      if (inInput(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.scrim') || !data) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const nums = data.main.map((v) => v.verse);
      const i = selHere ? nums.indexOf(e.key === 'ArrowDown' ? selHere.ve : selHere.v) : -1;
      const n = nums[Math.max(0, Math.min(nums.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] ?? nums[0];
      setSel({ b, c, v: n, ve: n });
      scroller.current?.querySelector(`[data-v="${n}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    const onCopy = (e) => {
      if (inInput(document.activeElement) || !selHere || !data || String(getSelection() || '').trim()) return;
      e.preventDefault(); e.clipboardData.setData('text/plain', copyText());
      toast('Versículos copiados');
    };
    addEventListener('keydown', onKey); document.addEventListener('copy', onCopy);
    return () => { removeEventListener('keydown', onKey); document.removeEventListener('copy', onCopy); };
  }, [data, selHere?.v, selHere?.ve, b, c]);

  function copyText(version = versions[0]) {
    const col = data.cols[versions.indexOf(version)] || data.cols[0];
    const txt = Object.values(col).filter((v) => isSel(v.verse)).map((v) => `${v.verse} ${v.text}`).join(' ');
    return `«${txt}» — ${C.label({ book: b, chapter: c, verse: selHere.v, verseEnd: selHere.ve })} (${version})`;
  }
  function click(e, v) {
    if (e.shiftKey && selHere) setSel({ b, c, v: Math.min(selHere.v, v), ve: Math.max(selHere.ve, v) });
    else setSel({ b, c, v, ve: v });
  }
  function dbl() {
    const w = String(getSelection() || '').trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (w && w.length > 1 && !/\s/.test(w)) lookUp(w);
  }
  function context(e, v) {
    e.preventDefault();
    if (!isSel(v)) setSel({ b, c, v, ve: v });
    setMenu({ x: e.clientX, y: e.clientY, v: isSel(v) ? selHere.v : v, ve: isSel(v) ? selHere.ve : v });
  }

  const bk = C.book(b);
  const speakKey = `cap:${b}:${c}:${versions[0]}`;
  const multi = versions.length > 1;
  const avail = C.versions.filter((v) => !versions.includes(v.id));
  return (
    <div class="dk-bible" ref={scroller} onClick={() => setMenu(null)}>
      <div class={`dk-colhead ${multi ? 'multi' : ''}`} style={{ gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr)) auto` }}>
        {versions.map((v, i) => (
          <div class="dk-colv" key={i}>
            <select class="dk-sel" value={v} title={C.versions.find((x) => x.id === v)?.name} onChange={(e) => { const n = [...versions]; const j = n.indexOf(e.target.value); if (j >= 0) n[j] = v; n[i] = e.target.value; setVersions(n); }}>
              {C.versions.map((x) => <option value={x.id}>{x.id} — {x.name}</option>)}
            </select>
            {multi && <button class="tb sm" title="Quitar esta columna" onClick={() => setVersions(versions.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <div class="dk-colv">
          {versions.length < MAX_COLS && avail.length > 0 && <button class="tb sm" title="Añadir una versión en paralelo" onClick={() => setVersions([...versions, avail[0].id])}>＋ Versión</button>}
          <button class="tb sm" title={sp.key === speakKey ? 'Detener lectura' : 'Escuchar el capítulo'} onClick={() => speakToggle(speakKey, [`${bk.name}, capítulo ${c}.`, ...(data?.main || []).map((v) => v.text)], s.speechRate)}>{sp.key === speakKey ? '⏹' : '🔊'}</button>
        </div>
      </div>

      {!data || !user ? <Loading /> : (
        <div class={`dk-text ${multi ? 'multi' : ''}`} style={{ fontSize: `${s.fontSize}px`, lineHeight: s.lineHeight }}>
          <div class="dk-chtitle serif">{bk.name} {c}</div>
          {c === 1 && <div style="text-align:center"><button class="btn text small" onClick={() => setLayout({ tab: 'intro', showPanel: true })}>ℹ️ Introducción a {bk.name} (MacArthur)</button></div>}
          {data.main.map((v, i) => {
            const hs = data.heads.filter((h) => h.beforeVerse === v.verse);
            const hl = user.hl.get(v.verse); const words = user.words.get(v.verse);
            const speaking = sp.key === speakKey && sp.index - 1 === i;
            const bg = hl != null ? argb(hl) + '73' : undefined;
            const marks = <>{user.bm.has(v.verse) && <span title="Marcador"> 🔖</span>}{user.notes.has(v.verse) && <span title={user.notes.get(v.verse).text}> ✎</span>}{user.tagged.has(key(b, c, v.verse)) && <span title="En un tema o etiqueta"> #</span>}
              {s.showNoteMarkers && data.notes.has(v.verse) && <span class="dk-mk" title="Nota de estudio MacArthur" onClick={(e) => { e.stopPropagation(); setSel({ b, c, v: v.verse, ve: v.verse }); setLayout({ tab: 'comm', showPanel: true }); }}>●</span>}</>;
            return (
              <>
                {hs.map((h) => <div class={h.kind === 'label' ? 'dk-label serif' : 'dk-heading'}>{h.text}</div>)}
                <div data-v={v.verse} class={`dk-row ${isSel(v.verse) ? 'sel' : ''} ${speaking ? 'speak' : ''} ${v.para && !multi ? 'para' : ''}`} style={{ gridTemplateColumns: `repeat(${versions.length}, minmax(0, 1fr))` }}
                  onClick={(e) => click(e, v.verse)} onDblClick={dbl} onContextMenu={(e) => context(e, v.verse)}>
                  {data.cols.map((col, ci) => {
                    const x = col[v.verse];
                    return (
                      <div class="dk-cell serif" style={ci === 0 && bg ? { background: bg } : undefined}>
                        {s.showVerseNumbers && <span class="n">{x ? C.verseLabel(x) : v.verse}</span>}
                        {!x ? <span class="muted">—</span> : ci === 0 && words ? splitWords(x.text).map((w, wi) => {
                          const wh = words.find((y) => wi >= y.wordStart && wi <= y.wordEnd);
                          return <>{wi > 0 ? ' ' : ''}{wh ? <mark style={{ background: argb(wh.color) + 'C0', color: '#000', borderRadius: '3px' }}>{w}</mark> : w}</>;
                        }) : x.text}
                        {ci === 0 && marks}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })}
          <div class="dk-chfoot">
            <button class="btn outline" disabled={!prevOf(b, c)} onClick={() => { const p = prevOf(b, c); goTo(p[0], p[1]); }}>← Anterior</button>
            {user.read
              ? <button class="btn tonal" onClick={() => U.markChapterRead(b, c, false)}>✓ Capítulo leído</button>
              : <button class="btn" onClick={async () => { await U.markChapterRead(b, c, true); toast('+10 puntos'); }}>Marcar como leído</button>}
            <button class="btn outline" disabled={!nextOf(b, c)} onClick={() => { const n = nextOf(b, c); goTo(n[0], n[1]); }}>Siguiente →</button>
          </div>
          <p class="dk-copy">{versions.map((v) => C.versions.find((x) => x.id === v)?.copyright).filter(Boolean).join(' · ')}</p>
        </div>
      )}

      {menu && <VerseMenu m={menu} b={b} c={c} close={() => setMenu(null)} copy={(v) => { navigator.clipboard.writeText(copyText(v)); toast('Copiado'); }}
        versions={versions} open={(kind) => setDialog({ verse: kind, b, c, v: menu.v, ve: menu.ve, existing: user.notes.get(menu.v), words: user.words.get(menu.v) || [], vrow: data.main.find((x) => x.verse === menu.v) })} />}
    </div>
  );
}

function VerseMenu({ m, b, c, close, copy, versions, open }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: `${m.x}px`, top: `${m.y}px` });
  useEffect(() => {
    const r = ref.current.getBoundingClientRect();
    setPos({ left: `${Math.max(4, Math.min(m.x, innerWidth - r.width - 8))}px`, top: `${Math.max(4, Math.min(m.y, innerHeight - r.height - 8))}px` });
    const esc = (e) => e.key === 'Escape' && close();
    const out = (e) => { if (!ref.current?.contains(e.target)) close(); };
    addEventListener('keydown', esc); setTimeout(() => addEventListener('mousedown', out));
    return () => { removeEventListener('keydown', esc); removeEventListener('mousedown', out); };
  }, [m.x, m.y]);
  const verses = Array.from({ length: m.ve - m.v + 1 }, (_, i) => m.v + i);
  const label = C.label({ book: b, chapter: c, verse: m.v, verseEnd: m.ve });
  const act = (fn) => async () => { close(); await fn(); };
  const Item = ({ ic, l, k, on }) => <button class="dk-mi" onClick={on}><span class="ic">{ic}</span><span class="grow">{l}</span>{k && <span class="k">{k}</span>}</button>;
  return (
    <div class="dk-menu" ref={ref} style={pos} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div class="dk-mh">{label}</div>
      <div class="dk-mcolors">
        {HIGHLIGHTS.map((col, i) => <button class="dot" title={`Resaltar en ${HIGHLIGHT_NAMES[i].toLowerCase()}`} style={{ background: argb(col) }} onClick={act(async () => { for (const v of verses) await U.setHighlight(b, c, v, col); })} />)}
        <button class="tb sm" title="Quitar resaltado" onClick={act(async () => { for (const v of verses) await U.setHighlight(b, c, v, null); })}>⌫</button>
      </div>
      <Item ic="📋" l="Copiar" k="Ctrl+C" on={act(() => copy(versions[0]))} />
      {versions.length > 1 && versions.slice(1).map((v) => <Item ic="📋" l={`Copiar en ${v}`} on={act(() => copy(v))} />)}
      <div class="dk-msep" />
      <Item ic="📝" l="Mi nota…" on={act(() => open('note'))} />
      <Item ic="🖍️" l="Resaltar palabras…" on={act(() => open('words'))} />
      <Item ic="🗂️" l="Agregar a un tema…" on={act(() => open('topic'))} />
      <Item ic="🏷️" l="Etiquetas…" on={act(() => open('tag'))} />
      <Item ic="🔖" l="Marcador" on={act(async () => { await U.toggleBookmark(b, c, m.v); })} />
      <div class="dk-msep" />
      <Item ic="📚" l="Notas MacArthur" on={act(() => setLayout({ tab: 'comm', showPanel: true }))} />
      <Item ic="🔗" l="Referencias cruzadas" on={act(() => setLayout({ tab: 'xref', showPanel: true }))} />
      <Item ic="⚖️" l="Comparar versiones" on={act(() => setLayout({ tab: 'cmp', showPanel: true }))} />
      <div class="dk-msep" />
      <Item ic="🎓" l="Nuevo estudio del pasaje" on={act(() => nav('/study-edit', { id: 0, b, c, v: m.v, ce: c, ve: m.ve }))} />
      <Item ic="🧠" l="Memorizar" on={act(async () => { const n = await U.addMemory(b, c, m.v, m.ve); toast(n === -1 ? 'Ya está en tu lista de memorización' : 'Añadido a Memorizar'); })} />
      <Item ic="🙏" l="Orar con este versículo" on={act(() => nav('/journal-edit', { kind: 'prayer', b, c, v: m.v }))} />
    </div>
  );
}

function VerseDialogs({ d, version, onClose }) {
  const verses = Array.from({ length: d.ve - d.v + 1 }, (_, i) => d.v + i);
  if (d.verse === 'note') return <NoteDialog b={d.b} c={d.c} v={d.v} existing={d.existing} onClose={onClose} />;
  if (d.verse === 'topic') return <TopicDialog b={d.b} c={d.c} verses={verses} onClose={onClose} />;
  if (d.verse === 'tag') return <TagDialog b={d.b} c={d.c} verses={verses} onClose={onClose} />;
  if (d.verse === 'words' && d.vrow) return <WordsDialog version={version} v={d.vrow} existing={d.words} onClose={onClose} />;
  return null;
}

// ---------------------------------------------------------------- Panel de estudio
function StudyPanel({ tab, b, c, sel, version, dictQ, setDictQ }) {
  const L = useLayout();
  const here = sel && sel.b === b && sel.c === c ? sel : null;
  const v = here?.v || 0;
  return (
    <aside class="dk-panel" style={{ width: `${L.panel}px` }}>
      <div class="dk-tabs">{TABS.map(([k, l]) => <button key={k} class={tab === k ? 'on' : ''} onClick={() => setLayout({ tab: k })}>{l}</button>)}</div>
      <div class="dk-panel-in">
        {tab === 'comm' && <CommentaryTab b={b} c={c} v={v} />}
        {tab === 'xref' && <XrefTab b={b} c={c} v={v} version={version} />}
        {tab === 'cmp' && <CompareTab b={b} c={c} v={v} />}
        {tab === 'dict' && <DictTab q={dictQ} setQ={setDictQ} />}
        {tab === 'mine' && <MineTab b={b} c={c} v={v} version={version} />}
        {tab === 'intro' && <IntroTab b={b} />}
      </div>
    </aside>
  );
}

const PickVerse = () => <p class="muted small">Haz clic en un versículo de la Biblia para verlo aquí.</p>;

function CommentaryTab({ b, c, v }) {
  const notes = useAsync(() => C.notesForChapter(b, c), [b, c]);
  const box = useRef(null);
  useEffect(() => { box.current?.querySelector('.hit')?.scrollIntoView({ block: 'start' }); }, [notes, v]);
  return (
    <div ref={box}>
      <div class="dk-ph"><b>Notas MacArthur</b> · {C.book(b).name} {c}</div>
      {!notes ? <Loading /> : !notes.length ? <p class="muted small">No hay notas de estudio para este capítulo.</p> : notes.map((n) => (
        <div class={`dk-note ${v && C.refContains(n, c, v) ? 'hit' : ''}`} key={n.id}>
          <b class="dk-link" onClick={() => goTo(n.book, n.chapter, n.verse, n.chapterEnd === n.chapter ? n.verseEnd : 0)}>{C.label(n)}</b>
          <div class="serif"><Linked text={n.text} book={b} chapter={c} /></div>
        </div>
      ))}
    </div>
  );
}

function XrefTab({ b, c, v, version }) {
  const refs = useAsync(async () => {
    if (!v) return null;
    const text = (await C.crossRefs(b, c, v)).join('; ');
    const list = parseRefs(text, b, c).map((x) => x.ref).slice(0, 80);
    const texts = await Promise.all(list.map((r) => C.passage(version, r.verse ? r : { ...r, verse: 1 }).then((vs) => vs.map((x) => `${C.verseLabel(x)} ${x.text}`).join(' '))));
    return list.map((r, i) => ({ r, text: texts[i].length > 360 ? texts[i].slice(0, 360) + '…' : texts[i] }));
  }, [b, c, v, version]);
  if (!v) return <><div class="dk-ph"><b>Referencias cruzadas</b></div><PickVerse /></>;
  return (
    <div>
      <div class="dk-ph"><b>Referencias cruzadas</b> · {C.book(b).name} {c}:{v}</div>
      {!refs ? <Loading /> : !refs.length ? <p class="muted small">No hay referencias cruzadas para este versículo.</p> : refs.map(({ r, text }) => (
        <div class="dk-xref" onClick={() => goTo(r.book, r.chapter, r.verse, r.chapterEnd === r.chapter ? r.verseEnd : 0)}>
          <b>{C.label(r)}</b> <span class="serif">{text}</span>
        </div>
      ))}
    </div>
  );
}

function CompareTab({ b, c, v }) {
  const rows = useAsync(() => (v ? C.compare(b, c, v) : null), [b, c, v]);
  if (!v) return <><div class="dk-ph"><b>Comparar versiones</b></div><PickVerse /></>;
  return (
    <div>
      <div class="dk-ph"><b>Comparar versiones</b> · {C.book(b).name} {c}:{v}</div>
      {!rows ? <Loading /> : rows.map((r) => (
        <div class="dk-cmp"><div class="row"><b>{r.version}</b><span class="muted small spacer">{r.name}</span>
          <button class="tb sm" title="Copiar" onClick={() => { navigator.clipboard.writeText(`«${r.text}» — ${C.book(b).name} ${c}:${v} (${r.version})`); toast('Copiado'); }}>📋</button></div>
          <div class="serif">{r.text}</div></div>
      ))}
    </div>
  );
}

function DictTab({ q, setQ }) {
  const [id, setId] = useState(null);
  const list = useAsync(() => C.dictionarySearch(q, null), [q]);
  useEffect(() => { setId(null); if (q) C.dictionaryFind(q).then((e) => e && setId(e.id)); }, [q]);
  const e = useAsync(() => (id ? C.dictionaryEntry(id) : null), [id]);
  return (
    <div>
      <input class="dk-in block" type="search" value={q} onInput={(ev) => setQ(ev.target.value)} placeholder="Buscar en el diccionario: Abraham, gracia…" />
      {id ? (!e ? <Loading /> : <div>
        <button class="btn text small" onClick={() => setId(null)}>← Resultados</button>
        <h3 class="serif" style="margin:4px 0">{e.term}</h3><span class="chip">{e.category}</span>
        <Article text={e.definition} />
        <button class="btn text small" onClick={() => nav('/dict', { id: e.id })}>Abrir la entrada completa</button>
      </div>) : !list ? <Loading /> : <>
        <div class="muted small" style="margin:6px 0">{list.length} entradas{list.length > 300 ? ' (se muestran 300)' : ''}</div>
        {list.slice(0, 300).map((x) => <div class="dk-dict" onClick={() => setId(x.id)}><span>{x.term}</span><span class="muted small">{x.category}</span></div>)}
        <p class="muted small">Consejo: haz doble clic en una palabra del texto bíblico para buscarla aquí.</p>
      </>}
    </div>
  );
}

function MineTab({ b, c, v, version }) {
  const notes = useUser(async () => (await U.notesAll()).filter((n) => n.book === b && n.chapter === c).sort((x, y) => x.verse - y.verse), [b, c]);
  const topics = useUser(async () => (v ? { t: await U.topicsOfVerse(b, c, v), all: await U.topicsAll(), tg: await U.tagsOfVerse(b, c, v), tags: await U.tagsAll() } : null), [b, c, v]);
  const existing = notes?.find((n) => n.verse === v);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  useLayoutEffect(() => { setText(existing?.text || ''); setDirty(false); }, [b, c, v, existing?.id, existing?.updated]);
  const save = async () => { await U.saveNote(existing, b, c, v, text); setDirty(false); toast(text.trim() ? 'Nota guardada' : 'Nota eliminada'); };
  return (
    <div>
      <div class="dk-ph"><b>Mis notas</b> · {C.book(b).name} {c}{v ? `:${v}` : ''}</div>
      {!v ? <PickVerse /> : <>
        <textarea class="input" style="min-height:140px" value={text} onInput={(e) => { setText(e.target.value); setDirty(true); }} placeholder="Escribe tu reflexión, aplicación u observación…" />
        <div class="row" style="margin:6px 0 12px"><button class="btn" disabled={!dirty} onClick={save}>Guardar nota</button>{dirty && <span class="muted small">Sin guardar</span>}</div>
        {topics && (topics.t.size > 0 || topics.tg.size > 0) && <div class="small" style="margin-bottom:12px">
          {topics.all.filter((t) => topics.t.has(t.id)).map((t) => <button class="chip" onClick={() => nav('/topic', { id: t.id })}><span class="dot" style={{ width: '10px', height: '10px', background: argb(t.color) }} />{t.name}</button>)}
          {topics.tags.filter((t) => topics.tg.has(t.id)).map((t) => <button class="chip" onClick={() => nav('/tag', { id: t.id })}>#{t.name}</button>)}
        </div>}
      </>}
      {notes?.length > 0 && <><div class="overline" style="margin:8px 0">Notas en este capítulo</div>
        {notes.map((n) => <div class={`dk-note ${n.verse === v ? 'hit' : ''}`} onClick={() => goTo(b, c, n.verse)} style="cursor:pointer"><b class="dk-link">{c}:{n.verse}</b><div class="serif">{n.text}</div></div>)}</>}
    </div>
  );
}

function IntroTab({ b }) {
  const secs = useAsync(() => C.intro(b), [b]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [b]);
  const sec = secs?.[i];
  return (
    <div>
      <div class="dk-ph"><b>Introducción a {C.book(b).name}</b> · MacArthur</div>
      {!secs ? <Loading /> : !secs.length ? <p class="muted small">No hay introducción para este libro.</p> : <>
        <select class="dk-sel block" value={i} onChange={(e) => setI(+e.target.value)}>{secs.map((x, j) => <option value={j}>{x.section}</option>)}</select>
        {sec && (sec.section.startsWith('Bosquejo')
          ? sec.content.split('\n').map((l) => <div class="serif" style={{ paddingLeft: /^[IVXLC]+\./.test(l) ? '0' : /^[A-Z]\./.test(l) ? '14px' : '28px', margin: '4px 0' }}><Linked text={l} book={b} /></div>)
          : <Article text={sec.content} book={b} />)}
      </>}
    </div>
  );
}

// ---------------------------------------------------------------- Ayuda
function HelpDialog({ onClose }) {
  const rows = [
    ['Ctrl+G', 'Ir a una referencia (Jn 3:16, Ro 8, Sal 23:1-4)'], ['Ctrl+F', 'Buscar en la Biblia'],
    ['← / →', 'Capítulo anterior / siguiente'], ['Ctrl+RePág / AvPág', 'Capítulo anterior / siguiente'], ['↑ / ↓', 'Versículo anterior / siguiente'],
    ['Mayús+clic', 'Seleccionar varios versículos'], ['Clic derecho', 'Resaltar, notas, temas, copiar…'], ['Doble clic en una palabra', 'Buscarla en el diccionario'],
    ['Ctrl+C', 'Copiar los versículos seleccionados'], ['Alt+← / Alt+→', 'Atrás / adelante'], ['Ctrl+B / Ctrl+J', 'Mostrar u ocultar libros / panel de estudio'],
    ['Ctrl+= / Ctrl+-', 'Letra más grande / más pequeña'], ['Ctrl+1 … Ctrl+6', 'Biblia, Hoy, Estudio, Diccionario, Mis temas, Progreso'],
  ];
  return (
    <Dialog title="Atajos de teclado" onClose={onClose} actions={<button class="btn text" onClick={onClose}>Cerrar</button>}>
      <table class="dk-keys">{rows.map(([k, d]) => <tr><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</table>
    </Dialog>
  );
}

