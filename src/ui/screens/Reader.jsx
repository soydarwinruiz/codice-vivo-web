import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings, updateSettings } from '../../data/settings.js';
import { toggle, useSpeaker, stop } from '../../domain/speaker.js';
import { useAsync, useUser, nav, openRef, share, toast, Sheet, Dialog, Linked, argb, HIGHLIGHTS, TOPIC_COLORS, Loading } from '../components.jsx';

const key = (b, c, v) => b * 1000000 + c * 1000 + v;
export const splitWords = (t) => t.split(/\s+/).filter(Boolean);
const nextOf = (b, c) => (c < C.book(b).chapters ? [b, c + 1] : b < 66 ? [b + 1, 1] : null);
const prevOf = (b, c) => (c > 1 ? [b, c - 1] : b > 1 ? [b - 1, C.book(b - 1).chapters] : null);

async function loadBlock(s, b, c) {
  const [verses, heads, notes, par] = await Promise.all([
    C.chapter(s.version, b, c), s.showHeadings ? C.headings(s.version, b, c) : [], C.versesWithNotes(b, c),
    s.parallel ? C.chapter(s.parallelVersion, b, c) : [],
  ]);
  return { b, c, verses, heads, notes, par: Object.fromEntries(par.map((v) => [v.verse, v.text])) };
}

export function Reader({ args }) {
  const s = useSettings(); const sp = useSpeaker();
  const [start, setStart] = useState([+(args.b || 0) || s.lastBook, +(args.c || 0) || s.lastChapter]);
  const [target, setTarget] = useState(+(args.v || 0) ? { b: +args.b, c: +args.c, v: +args.v, ve: +(args.ve || args.v) } : null);
  useEffect(() => { if (+args.b) { setStart([+args.b, +args.c]); setTarget(+args.v ? { b: +args.b, c: +args.c, v: +args.v, ve: +(args.ve || args.v) } : null); } }, [args.t]);
  const [blocks, setBlocks] = useState(null);
  const [cur, setCur] = useState(start);
  const loading = useRef(false);

  useEffect(() => {
    let alive = true; setBlocks(null);
    (async () => {
      const first = await loadBlock(s, start[0], start[1]);
      const n = s.continuous ? nextOf(start[0], start[1]) : null;
      const bl = [first]; if (n) bl.push(await loadBlock(s, n[0], n[1]));
      if (alive) { setBlocks(bl); setCur(start); }
    })();
    return () => { alive = false; };
  }, [start[0], start[1], s.version, s.parallel, s.parallelVersion, s.showHeadings, s.continuous]);

  // Ir al versículo indicado o al inicio
  useEffect(() => {
    if (!blocks) return;
    requestAnimationFrame(() => {
      const el = target && document.getElementById(`v-${target.b}-${target.c}-${target.v}`);
      if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
    });
  }, [blocks && blocks[0].b, blocks && blocks[0].c, target]);

  useEffect(() => { updateSettings({ lastBook: cur[0], lastChapter: cur[1] }); }, [cur[0], cur[1]]);

  // Capítulo visible y carga del siguiente (lectura continua)
  useEffect(() => {
    if (!blocks) return;
    const onScroll = async () => {
      const titles = [...document.querySelectorAll('.ch-title')];
      let vis = titles[0];
      for (const t of titles) if (t.getBoundingClientRect().top < 120) vis = t;
      if (vis) { const b = +vis.dataset.b, c = +vis.dataset.c; if (b !== cur[0] || c !== cur[1]) setCur([b, c]); }
      if (s.continuous && !loading.current && innerHeight + scrollY > document.body.scrollHeight - 1500) {
        const last = blocks[blocks.length - 1]; const n = nextOf(last.b, last.c); if (!n) return;
        loading.current = true; const nb = await loadBlock(s, n[0], n[1]);
        setBlocks((bl) => [...bl, nb]); loading.current = false;
      }
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    return () => removeEventListener('scroll', onScroll);
  }, [blocks, s.continuous, cur[0], cur[1]]);

  const user = useUser(async () => ({
    hl: new Map((await U.highlightsAll()).map((h) => [key(h.book, h.chapter, h.verse), h.color])),
    notes: new Map((await U.notesAll()).map((n) => [key(n.book, n.chapter, n.verse), n])),
    bm: new Set((await U.bookmarksAll()).map((x) => key(x.book, x.chapter, x.verse))),
    tagged: await U.taggedKeys(),
    read: new Set((await U.chaptersRead()).map((r) => r.book * 1000 + r.chapter)),
    words: (await U.wordHighlights(s.version)).reduce((m, w) => { const k = key(w.book, w.chapter, w.verse); (m.get(k) || m.set(k, []).get(k)).push(w); return m; }, new Map()),
  }), [s.version]);

  const [sel, setSel] = useState([]); // [{b,c,v}]
  const [sheet, setSheet] = useState(null);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => () => { if (sp.key?.startsWith('cap:')) stop(); }, []);

  const go = (b, c, v = 0) => { setSel([]); setStart([b, c]); setTarget(v ? { b, c, v, ve: v } : null); };
  const [b, c] = cur; const bk = C.book(b);
  const curBlock = blocks?.find((x) => x.b === b && x.c === c);
  const speakKey = `cap:${b}:${c}:${s.version}`;
  const selVerses = sel.map((x) => x.v).sort((x, y) => x - y);
  const sb = sel[0]?.b, sc = sel[0]?.c;
  const selBlock = blocks?.find((x) => x.b === sb && x.c === sc);

  // Deslizar para cambiar de capítulo (modo por capítulos)
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; };
  const onTouchEnd = (e) => {
    if (s.continuous || !touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current[0], dy = e.changedTouches[0].clientY - touch.current[1];
    if (Math.abs(dx) > 90 && Math.abs(dy) < 60) { const t = dx < 0 ? nextOf(b, c) : prevOf(b, c); if (t) go(t[0], t[1]); }
  };

  function tapVerse(bb, cc, v) {
    const exists = sel.some((x) => x.b === bb && x.c === cc && x.v === v);
    if (exists) setSel(sel.filter((x) => !(x.b === bb && x.c === cc && x.v === v)));
    else if (sel.some((x) => x.b !== bb || x.c !== cc)) setSel([{ b: bb, c: cc, v }]);
    else setSel([...sel, { b: bb, c: cc, v }]);
  }
  async function action(a) {
    const r = { book: sb, chapter: sc, verse: selVerses[0], chapterEnd: sc, verseEnd: selVerses[selVerses.length - 1] };
    switch (a) {
      case 'compare': nav('/compare', { b: sb, c: sc, v: selVerses[0] }); break;
      case 'study': nav('/study-edit', { id: 0, b: sb, c: sc, v: r.verse, ce: sc, ve: r.verseEnd }); break;
      case 'journal': nav('/journal-edit', { kind: 'prayer', b: sb, c: sc, v: r.verse }); break;
      case 'memory': { const n = await U.addMemory(sb, sc, r.verse, r.verseEnd); toast(n === -1 ? 'Ya está en tu lista de memorización' : 'Añadido a Memorizar'); setSel([]); break; }
      case 'bookmark': await U.toggleBookmark(sb, sc, selVerses[0]); setSel([]); break;
      case 'copy': case 'share': {
        const txt = selBlock.verses.filter((v) => selVerses.includes(v.verse)).map((v) => `${v.verse} ${v.text}`).join(' ');
        const full = `«${txt}» — ${C.label(r)} (${s.version})`;
        if (a === 'copy') { await navigator.clipboard?.writeText(full); toast('Copiado'); } else share(full);
        setSel([]); break;
      }
      case 'clear': setSel([]); break;
      default: setSheet(a);
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header class="topbar">
        <button class="btn text" style="font:600 1.2rem var(--serif);color:var(--text)" onClick={() => setPicker(true)}>{bk?.name} {c} ▾</button>
        <span class="spacer" />
        <button class="chip" onClick={() => setMenu(true)}>{s.version}{s.parallel ? ` | ${s.parallelVersion}` : ''}</button>
        <button class="icon-btn" aria-label={sp.key === speakKey ? 'Detener lectura' : 'Escuchar capítulo'} onClick={() => toggle(speakKey, [`${bk.name}, capítulo ${c}.`, ...(curBlock?.verses || []).map((v) => v.text)], s.speechRate)}>{sp.key === speakKey ? '⏹' : '🔊'}</button>
        <button class="icon-btn" aria-label="Buscar" onClick={() => nav('/search')}>🔍</button>
        <button class="icon-btn" aria-label="Notas de estudio del capítulo" onClick={() => nav('/commentary', { b, c })}>📚</button>
      </header>
      {!blocks || !user ? <Loading /> : (
        <div class="reader" style={{ fontSize: `${s.fontSize}px`, lineHeight: s.lineHeight }}>
          {s.continuous && prevOf(blocks[0].b, blocks[0].c) && (() => { const p = prevOf(blocks[0].b, blocks[0].c); return <button class="btn text block" style="font-size:.9rem" onClick={() => go(p[0], p[1])}>↑ {C.book(p[0]).name} {p[1]}</button>; })()}
          {blocks.map((blk) => (
            <section key={`${blk.b}-${blk.c}`}>
              <div class="ch-title" data-b={blk.b} data-c={blk.c}>{C.book(blk.b).name} {blk.c}</div>
              {blk.c === 1 && <div style="text-align:center"><button class="btn text" style="font-size:.9rem" onClick={() => nav('/intro', { b: blk.b })}>ℹ️ Introducción a {C.book(blk.b).name} (MacArthur)</button></div>}
              {blk.verses.map((v, i) => {
                const k = key(blk.b, blk.c, v.verse);
                const hs = blk.heads.filter((h) => h.beforeVerse === v.verse);
                const isSel = sel.some((x) => x.b === blk.b && x.c === blk.c && x.v === v.verse);
                const isTarget = target && target.b === blk.b && target.c === blk.c && v.verse >= target.v && v.verse <= target.ve;
                const speaking = sp.key === `cap:${blk.b}:${blk.c}:${s.version}` && sp.index - 1 === i;
                const hl = user.hl.get(k); const words = user.words.get(k);
                const bg = hl != null ? argb(hl) + '73' : isTarget ? 'var(--primary-c)' : 'transparent';
                return (
                  <>
                    {hs.map((h) => <div class={h.kind === 'label' ? 'label' : 'heading'} style="font-size:.9em">{h.text}</div>)}
                    <div id={`v-${blk.b}-${blk.c}-${v.verse}`} class={`verse serif ${v.para ? 'para' : ''} ${isSel ? 'sel' : ''} ${speaking ? 'speak' : ''}`} style={{ background: bg }} onClick={() => tapVerse(blk.b, blk.c, v.verse)}>
                      {s.showVerseNumbers && <span class="n">{C.verseLabel(v)}</span>}
                      {words ? splitWords(v.text).map((w, wi) => {
                        const wh = words.find((x) => wi >= x.wordStart && wi <= x.wordEnd);
                        return <>{wi > 0 ? ' ' : ''}{wh ? <mark style={{ background: argb(wh.color) + 'C0', color: '#000', borderRadius: '3px' }}>{w}</mark> : w}</>;
                      }) : v.text}
                      {user.bm.has(k) && ' 🔖'}{user.notes.has(k) && ' ✎'}{user.tagged.has(k) && ' #'}
                      {blk.par[v.verse] && <span class="par">{blk.par[v.verse]}</span>}
                      {s.showNoteMarkers && blk.notes.has(v.verse) && <span class="mk" onClick={(e) => { e.stopPropagation(); setSel([{ b: blk.b, c: blk.c, v: v.verse }]); setSheet('notes'); }}>nota MacArthur ›</span>}
                    </div>
                  </>
                );
              })}
              <div style="margin:18px 0 8px">
                {user.read.has(blk.b * 1000 + blk.c)
                  ? <button class="btn outline block" onClick={() => U.markChapterRead(blk.b, blk.c, false)}>✓ {s.continuous ? `${C.book(blk.b).name} ${blk.c} leído` : 'Capítulo leído'}</button>
                  : <button class="btn block" onClick={async () => { await U.markChapterRead(blk.b, blk.c, true); toast('+10 puntos'); }}>{s.continuous ? `Marcar ${C.book(blk.b).name} ${blk.c} como leído` : 'Marcar como leído'}</button>}
                {!s.continuous && (
                  <div class="row" style="margin-top:12px">
                    <button class="btn outline" disabled={!prevOf(blk.b, blk.c)} onClick={() => { const p = prevOf(blk.b, blk.c); go(p[0], p[1]); }}>← Anterior</button>
                    <span class="spacer" />
                    <button class="btn outline" disabled={!nextOf(blk.b, blk.c)} onClick={() => { const n = nextOf(blk.b, blk.c); go(n[0], n[1]); }}>Siguiente →</button>
                  </div>
                )}
                {s.continuous && <hr style="border:0;border-top:1px solid var(--surface3);margin-top:16px" />}
              </div>
            </section>
          ))}
          {!s.continuous && <p class="small muted" style="font-family:var(--sans);font-size:.72rem">{C.versions.find((v) => v.id === s.version)?.copyright}</p>}
          <div style={{ height: sel.length ? '150px' : '20px' }} />
        </div>
      )}

      {sel.length > 0 && (
        <div class="selbar">
          <div class="row">
            <span class="small spacer" style="padding-left:8px">{sel.length} seleccionado{sel.length > 1 ? 's' : ''}</span>
            {HIGHLIGHTS.map((col) => <button class="dot" style={{ background: argb(col) }} aria-label="Resaltar" onClick={async () => { for (const x of sel) await U.setHighlight(x.b, x.c, x.v, col); setSel([]); }} />)}
            <button class="icon-btn" aria-label="Quitar resaltado" onClick={async () => { for (const x of sel) await U.setHighlight(x.b, x.c, x.v, null); setSel([]); }}>⌫</button>
          </div>
          <div class="acts">
            {[['notes', '📚', 'MacArthur'], ['note', '📝', 'Nota'], ['words', '🖍️', 'Palabras'], ['topic', '🗂️', 'Tema'], ['tag', '🏷️', 'Etiqueta'], ['compare', '⚖️', 'Comparar'],
              ['study', '🎓', 'Estudiar'], ['memory', '🧠', 'Memorizar'], ['journal', '🙏', 'Orar'], ['bookmark', '🔖', 'Marcador'], ['copy', '📋', 'Copiar'], ['share', '📤', 'Compartir'], ['clear', '✖️', 'Cerrar']]
              .map(([k, ic, l]) => <button key={k} onClick={() => action(k)}><span class="ic">{ic}</span>{l}</button>)}
          </div>
        </div>
      )}

      {picker && <Picker current={b} pickVerse onClose={() => setPicker(false)} onPick={(bb, cc, vv) => { setPicker(false); go(bb, cc, vv); }} />}
      {menu && (
        <Sheet onClose={() => setMenu(false)}>
          <div class="overline">Versión principal</div>
          <div class="list">{C.versions.map((v) => <div class="item" onClick={() => { updateSettings({ version: v.id }); setStart(cur); setMenu(false); }}><span>{v.id === s.version ? '✓' : ''}</span><div class="grow"><b>{v.id}</b> <span class="muted small">{v.name}</span></div></div>)}</div>
          <div class="row wrap" style="margin-top:12px">
            <button class={`chip ${s.continuous ? 'on' : ''}`} onClick={() => { updateSettings({ continuous: !s.continuous }); setStart(cur); setMenu(false); }}>📜 Lectura continua</button>
            <button class={`chip ${s.parallel ? 'on' : ''}`} onClick={() => { updateSettings({ parallel: !s.parallel }); setStart(cur); }}>⇆ Vista paralela</button>
          </div>
          {s.parallel && <><div class="overline" style="margin-top:12px">Versión paralela</div>
            <div class="chips" style="flex-wrap:wrap;padding:0">{C.versions.filter((v) => v.id !== s.version).map((v) => <button class={`chip ${v.id === s.parallelVersion ? 'on' : ''}`} onClick={() => { updateSettings({ parallelVersion: v.id }); setStart(cur); }}>{v.id}</button>)}</div></>}
        </Sheet>
      )}
      {sheet === 'notes' && <StudyNotesSheet b={sb} c={sc} v={selVerses[0]} onClose={() => setSheet(null)} />}
      {sheet === 'note' && <NoteDialog b={sb} c={sc} v={selVerses[0]} existing={user.notes.get(key(sb, sc, selVerses[0]))} onClose={() => { setSheet(null); setSel([]); }} />}
      {sheet === 'topic' && <TopicDialog b={sb} c={sc} verses={selVerses} onClose={() => { setSheet(null); setSel([]); }} />}
      {sheet === 'tag' && <TagDialog b={sb} c={sc} verses={selVerses} onClose={() => { setSheet(null); setSel([]); }} />}
      {sheet === 'words' && selBlock && <WordsDialog version={s.version} v={selBlock.verses.find((x) => x.verse === selVerses[0])} existing={user.words.get(key(sb, sc, selVerses[0])) || []} onClose={() => { setSheet(null); setSel([]); }} />}
    </div>
  );
}

/** Selector libro → capítulo → versículo. */
export function Picker({ current = 1, pickVerse = false, onClose, onPick }) {
  const [t, setT] = useState(current >= 40 ? 'NT' : 'AT');
  const [bk, setBk] = useState(null); const [ch, setCh] = useState(0);
  const vc = useAsync(() => (bk && ch ? C.verseCount(bk.id, ch) : 0), [bk, ch]);
  const title = !bk ? 'Elegir libro' : ch ? `${bk.name} ${ch} · versículo` : bk.name;
  return (
    <Dialog title={title} onClose={onClose} actions={<button class="btn text" onClick={() => { if (ch && bk.chapters > 1) setCh(0); else if (bk) { setBk(null); setCh(0); } else onClose(); }}>{ch && bk?.chapters > 1 ? 'Capítulos' : bk ? 'Libros' : 'Cerrar'}</button>}>
      {!bk ? <>
        <div class="row"><button class={`chip ${t === 'AT' ? 'on' : ''}`} onClick={() => setT('AT')}>Antiguo T.</button><button class={`chip ${t === 'NT' ? 'on' : ''}`} onClick={() => setT('NT')}>Nuevo T.</button></div>
        <div class="grid g3" style="margin-top:8px">{C.books.filter((x) => x.testament === t).map((x) => <button class={`cell ${x.id === current ? 'on' : ''}`} onClick={() => { setBk(x); if (x.chapters === 1) { if (pickVerse) setCh(1); else onPick(x.id, 1, 0); } }} style={x.name.length > 11 ? 'font-size:.78rem' : ''}>{x.name.length > 13 ? x.name.replace('Tesalonicenses', 'Tesal.') : x.name}</button>)}</div>
      </> : !ch ? (
        <div class="grid g6">{Array.from({ length: bk.chapters }, (_, i) => i + 1).map((n) => <button class="cell" onClick={() => (pickVerse ? setCh(n) : onPick(bk.id, n, 0))}>{n}</button>)}</div>
      ) : <>
        <button class="btn text" onClick={() => onPick(bk.id, ch, 0)}>Ir al capítulo completo</button>
        <div class="grid g6">{Array.from({ length: vc || 0 }, (_, i) => i + 1).map((n) => <button class="cell" onClick={() => onPick(bk.id, ch, n)}>{n}</button>)}</div>
      </>}
    </Dialog>
  );
}

function StudyNotesSheet({ b, c, v, onClose }) {
  const notes = useAsync(() => C.notesForVerse(b, c, v), [b, c, v]);
  const x = useAsync(() => C.crossRefs(b, c, v), [b, c, v]);
  return (
    <Sheet onClose={onClose}>
      <h2 class="serif" style="margin:0">{C.book(b).name} {c}:{v}</h2>
      <div class="overline">Notas de la Biblia de Estudio MacArthur</div>
      {!notes ? <Loading /> : !notes.length ? <p class="small">No hay nota de estudio para este versículo. Consulta las notas del capítulo.</p> : notes.map((n) => (
        <div style="margin-top:12px"><b class="small" style="color:var(--primary)">{C.label(n)}</b><p class="serif" style="margin:4px 0;line-height:1.55"><Linked text={n.text} book={b} chapter={c} /></p></div>
      ))}
      {x?.length > 0 && <><h4>Referencias cruzadas (RVR1960)</h4><Linked text={x.join('  ')} book={b} chapter={c} /></>}
      <div><button class="btn text" onClick={() => { onClose(); nav('/commentary', { b, c }); }}>Ver todas las notas del capítulo</button></div>
    </Sheet>
  );
}

function NoteDialog({ b, c, v, existing, onClose }) {
  const [text, setText] = useState(existing?.text || '');
  return (
    <Dialog title={`Nota · ${C.book(b).name} ${c}:${v}`} onClose={onClose} actions={<>
      {existing && <button class="btn text" onClick={async () => { await U.saveNote(existing, b, c, v, ''); onClose(); }}>Eliminar</button>}
      <button class="btn text" onClick={onClose}>Cancelar</button>
      <button class="btn text" onClick={async () => { await U.saveNote(existing, b, c, v, text); onClose(); }}>Guardar</button>
    </>}>
      <textarea class="input" style="min-height:160px" value={text} onInput={(e) => setText(e.target.value)} placeholder="Escribe tu reflexión, aplicación u observación…" />
    </Dialog>
  );
}

function TopicDialog({ b, c, verses, onClose }) {
  const topics = useUser(() => U.topicsAll());
  const current = useAsync(() => U.topicsOfVerse(b, c, verses[0]), []);
  const [chosen, setChosen] = useState(null);
  const [name, setName] = useState('');
  const ch = chosen ?? current ?? new Set();
  const flip = (id) => { const n = new Set(ch); n.has(id) ? n.delete(id) : n.add(id); setChosen(n); };
  return (
    <Dialog title="Agregar a temas" onClose={onClose} actions={<>
      <button class="btn text" onClick={onClose}>Cancelar</button>
      <button class="btn text" onClick={async () => {
        for (const id of ch) if (!current?.has(id)) await U.addTopicVerse(id, b, c, verses[0], verses[verses.length - 1]);
        for (const id of current || []) if (!ch.has(id)) await U.removeTopicVerse(id, b, c, verses[0]);
        onClose();
      }}>Guardar</button></>}>
      <div class="row"><input class="input" value={name} onInput={(e) => setName(e.target.value)} placeholder="Nuevo tema (p. ej. Fe)" />
        <button class="btn tonal" onClick={async () => { if (!name.trim()) return; const id = await U.createTopic(name, '', TOPIC_COLORS[(topics?.length || 0) % TOPIC_COLORS.length]); const n = new Set(ch); n.add(id); setChosen(n); setName(''); }}>＋</button></div>
      <div class="list" style="margin-top:8px">{(topics || []).map((t) => (
        <div class="item" onClick={() => flip(t.id)}><input type="checkbox" checked={ch.has(t.id)} /><span class="dot" style={{ width: 12, height: 12, background: argb(t.color) }} /><div class="grow">{t.name}</div><span class="muted">{t.count}</span></div>
      ))}</div>
      {topics?.length === 0 && <p class="small muted">Crea tu primer tema para agrupar versículos.</p>}
    </Dialog>
  );
}

function TagDialog({ b, c, verses, onClose }) {
  const tags = useUser(() => U.tagsAll());
  const current = useAsync(() => U.tagsOfVerse(b, c, verses[0]), []);
  const [chosen, setChosen] = useState(null); const [name, setName] = useState('');
  const ch = chosen ?? current ?? new Set();
  return (
    <Dialog title="Etiquetas" onClose={onClose} actions={<>
      <button class="btn text" onClick={onClose}>Cancelar</button>
      <button class="btn text" onClick={async () => {
        for (const id of ch) if (!current?.has(id)) for (const v of verses) await U.addTagVerse(id, b, c, v);
        for (const id of current || []) if (!ch.has(id)) for (const v of verses) await U.removeTagVerse(id, b, c, v);
        onClose();
      }}>Guardar</button></>}>
      <div class="row"><input class="input" value={name} onInput={(e) => setName(e.target.value)} placeholder="Nueva etiqueta (p. ej. promesa)" />
        <button class="btn tonal" onClick={async () => { if (!name.trim()) return; const id = await U.createTag(name); const n = new Set(ch); n.add(id); setChosen(n); setName(''); }}>＋</button></div>
      <div style="margin-top:8px">{(tags || []).map((t) => <button class={`chip ${ch.has(t.id) ? 'on' : ''}`} onClick={() => { const n = new Set(ch); n.has(t.id) ? n.delete(t.id) : n.add(t.id); setChosen(n); }}>#{t.name}</button>)}</div>
      {tags?.length === 0 && <p class="small muted">Sugerencias: promesa, mandato, oración, consuelo, profecía, Cristo, familia.</p>}
    </Dialog>
  );
}

function WordsDialog({ version, v, existing, onClose }) {
  const words = useMemo(() => splitWords(v.text), [v]);
  const [colors, setColors] = useState(() => { const m = {}; existing.forEach((e) => { for (let i = e.wordStart; i <= e.wordEnd; i++) m[i] = e.color; }); return m; });
  const [picked, setPicked] = useState([]);
  const contiguous = picked.length && Math.max(...picked) - Math.min(...picked) === picked.length - 1;
  const term = contiguous ? [...picked].sort((a, b) => a - b).map((i) => words[i]).join(' ').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '') : '';
  async function save() {
    const ranges = [];
    Object.keys(colors).map(Number).sort((a, b) => a - b).forEach((i) => {
      const l = ranges[ranges.length - 1];
      if (l && l[1] === i - 1 && l[2] === colors[i]) l[1] = i; else ranges.push([i, i, colors[i]]);
    });
    await U.setWordHighlights(version, v.book, v.chapter, v.verse, ranges); onClose();
  }
  return (
    <Dialog title={`Resaltar palabras · ${C.book(v.book).name} ${v.chapter}:${v.verse}`} onClose={onClose} actions={<><button class="btn text" onClick={onClose}>Cancelar</button><button class="btn text" onClick={save}>Guardar</button></>}>
      <p class="small muted" style="margin-top:0">Toca las palabras que quieres marcar y elige un color.</p>
      <div>{words.map((w, i) => (
        <button class={`chip serif ${picked.includes(i) ? 'on' : ''}`} style={colors[i] != null && !picked.includes(i) ? { background: argb(colors[i]), color: '#000', borderColor: 'transparent' } : {}}
          onClick={() => setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i])}>{w}</button>
      ))}</div>
      <div class="row" style="margin-top:10px">
        {HIGHLIGHTS.map((col) => <button class="dot" disabled={!picked.length} style={{ background: argb(col), opacity: picked.length ? 1 : 0.4 }} onClick={() => { const n = { ...colors }; picked.forEach((i) => { n[i] = col; }); setColors(n); setPicked([]); }} />)}
        <button class="icon-btn" disabled={!picked.length} onClick={() => { const n = { ...colors }; picked.forEach((i) => delete n[i]); setColors(n); setPicked([]); }}>⌫</button>
      </div>
      {term && <button class="btn text" onClick={() => { onClose(); nav('/dictionary', { q: term }); }}>📗 Buscar «{term}» en el diccionario</button>}
    </Dialog>
  );
}
