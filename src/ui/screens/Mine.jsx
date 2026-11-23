import { useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings } from '../../data/settings.js';
import { speak } from '../../domain/speaker.js';
import { useAsync, useUser, nav, openRef, share, TopBar, Loading, Empty, Tabs, Dialog, VerseItem, argb, HIGHLIGHTS, HIGHLIGHT_NAMES, TOPIC_COLORS } from '../components.jsx';

const TABS = ['Temas', 'Etiquetas', 'Resaltados', 'Notas', 'Marcadores'];

export function Mine() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState(null);
  const [edit, setEdit] = useState(null);
  const [newTag, setNewTag] = useState(null);
  const d = useUser(async () => ({ topics: await U.topicsAll(), tags: await U.tagsAll(), hl: await U.highlightsAll(), notes: await U.notesAll(), bm: await U.bookmarksAll(), mem: (await U.memoryAll()).length }));
  return (
    <div>
      <TopBar back={false} title="Mis temas"><button class="btn text" onClick={() => nav('/memory')}>🧠 Memorizar ({d?.mem ?? 0})</button></TopBar>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {!d ? <Loading /> : <div class="list">
        {tab === 0 && <>
          <div style="padding:10px 16px"><button class="btn tonal" onClick={() => setEdit({ id: 0, name: '', description: '', color: TOPIC_COLORS[d.topics.length % TOPIC_COLORS.length] })}>＋ Nuevo tema</button></div>
          {!d.topics.length && <Empty icon="🗂️" title="Agrupa versículos por tema" text="Crea temas como «Fe», «Oración» o «Promesas de Dios» y agrega versículos desde el lector." />}
          {d.topics.map((t) => <div class="item" onClick={() => nav('/topic', { id: t.id })}><span class="dot" style={{ width: 18, height: 18, background: argb(t.color) }} /><div class="grow"><div>{t.name}</div><div class="sup">{t.description || `${t.count} versículo(s)`}</div></div><b>{t.count}</b></div>)}
        </>}
        {tab === 1 && <>
          <div style="padding:10px 16px"><button class="btn tonal" onClick={() => setNewTag('')}>＋ Nueva etiqueta</button></div>
          {!d.tags.length && <Empty icon="🏷️" title="Sin etiquetas" text="Etiqueta versículos (#promesa, #mandato, #consuelo) para encontrarlos rápido." />}
          <div style="padding:8px 12px">{d.tags.map((t) => <button class="chip" onClick={() => nav('/tag', { id: t.id })}>#{t.name} ({t.count})</button>)}</div>
        </>}
        {tab === 2 && <>
          <div class="chips"><button class={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>Todos</button>{HIGHLIGHTS.map((c) => <button class={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}><span class="dot" style={{ width: 14, height: 14, margin: 0, background: argb(c) }} /></button>)}</div>
          {!d.hl.filter((h) => filter === null || h.color === filter).length && <Empty icon="🖍️" title="Sin resaltados" text="Toca un versículo en el lector y elige un color." />}
          {d.hl.filter((h) => filter === null || h.color === filter).map((h) => <VerseItem r={{ book: h.book, chapter: h.chapter, verse: h.verse }} color={h.color} extra={HIGHLIGHT_NAMES[HIGHLIGHTS.indexOf(h.color)]} />)}
        </>}
        {tab === 3 && <>
          {!d.notes.length && <Empty icon="📝" title="Sin notas" text="Selecciona un versículo y toca «Nota»." />}
          {d.notes.map((n) => <VerseItem r={{ book: n.book, chapter: n.chapter, verse: n.verse }} extra={n.text} />)}
        </>}
        {tab === 4 && <>
          {!d.bm.length && <Empty icon="🔖" title="Sin marcadores" text="Selecciona un versículo y toca «Marcador»." />}
          {d.bm.map((b) => <VerseItem r={{ book: b.book, chapter: b.chapter, verse: b.verse }} trailing={<button class="icon-btn" onClick={(e) => { e.stopPropagation(); U.deleteBookmark(b.book, b.chapter, b.verse); }}>🗑️</button>} />)}
        </>}
      </div>}
      {edit && <TopicEdit t={edit} onClose={() => setEdit(null)} />}
      {newTag !== null && <Dialog title="Nueva etiqueta" onClose={() => setNewTag(null)} actions={<><button class="btn text" onClick={() => setNewTag(null)}>Cancelar</button><button class="btn text" onClick={async () => { if (newTag.trim()) await U.createTag(newTag); setNewTag(null); }}>Crear</button></>}>
        <input class="input" value={newTag} onInput={(e) => setNewTag(e.target.value)} placeholder="p. ej. promesa" />
      </Dialog>}
    </div>
  );
}

export function TopicEdit({ t, onClose }) {
  const [x, setX] = useState(t);
  return (
    <Dialog title={t.id ? 'Editar tema' : 'Nuevo tema'} onClose={onClose} actions={<><button class="btn text" onClick={onClose}>Cancelar</button>
      <button class="btn text" onClick={async () => { if (x.name.trim()) { if (x.id) await U.updateTopic(x); else await U.createTopic(x.name, x.description, x.color); } onClose(); }}>Guardar</button></>}>
      <label class="field"><span>Nombre</span><input class="input" value={x.name} onInput={(e) => setX({ ...x, name: e.target.value })} /></label>
      <label class="field"><span>Descripción (opcional)</span><input class="input" value={x.description} onInput={(e) => setX({ ...x, description: e.target.value })} /></label>
      <div>{TOPIC_COLORS.map((c) => <button class="dot" style={{ background: argb(c), outline: c === x.color ? '3px solid var(--text)' : 'none' }} onClick={() => setX({ ...x, color: c })} />)}</div>
    </Dialog>
  );
}

export function TopicDetail({ id }) {
  const s = useSettings();
  const d = useUser(async () => ({ t: await U.topic(id), verses: await U.topicVerses(id) }), [id]);
  const [edit, setEdit] = useState(false); const [confirm, setConfirm] = useState(false);
  if (!d) return <Loading />;
  return (
    <div>
      <TopBar title={d.t?.name || 'Tema'}>
        <button class="icon-btn" aria-label="Compartir" onClick={async () => {
          let txt = `${d.t.name}\n${d.t.description ? d.t.description + '\n' : ''}\n`;
          for (const v of d.verses) { const r = { book: v.book, chapter: v.chapter, verse: v.verse, verseEnd: v.verseEnd }; txt += `${C.label(r)}: ${await C.passageText(s.version, r)}\n`; }
          share(txt);
        }}>📤</button>
        <button class="icon-btn" aria-label="Editar" onClick={() => setEdit(true)}>✏️</button>
        <button class="icon-btn" aria-label="Eliminar" onClick={() => setConfirm(true)}>🗑️</button>
      </TopBar>
      {d.t?.description && <p class="page small">{d.t.description}</p>}
      {!d.verses.length && <Empty icon="🗂️" title="Tema vacío" text="En el lector, selecciona versículos y toca «Tema»." />}
      <div class="list">{d.verses.map((v) => <VerseItem r={{ book: v.book, chapter: v.chapter, verse: v.verse, verseEnd: v.verseEnd }} trailing={<button class="icon-btn" onClick={(e) => { e.stopPropagation(); U.removeTopicVerse(id, v.book, v.chapter, v.verse); }}>➖</button>} />)}</div>
      {edit && d.t && <TopicEdit t={d.t} onClose={() => setEdit(false)} />}
      {confirm && <Dialog title="¿Eliminar el tema?" onClose={() => setConfirm(false)} actions={<><button class="btn text" onClick={() => setConfirm(false)}>Cancelar</button><button class="btn text" onClick={async () => { await U.deleteTopic(id); history.back(); }}>Eliminar</button></>}><p class="small">Los versículos no se borran de la Biblia, solo se quita la agrupación.</p></Dialog>}
    </div>
  );
}

export function TagDetail({ id }) {
  const d = useUser(async () => ({ t: await U.tag(id), verses: await U.tagVerses(id) }), [id]);
  if (!d) return <Loading />;
  return (
    <div>
      <TopBar title={`#${d.t?.name || ''}`}><button class="icon-btn" aria-label="Eliminar etiqueta" onClick={async () => { await U.deleteTag(id); history.back(); }}>🗑️</button></TopBar>
      <div class="list">{d.verses.map((v) => <VerseItem r={{ book: v.book, chapter: v.chapter, verse: v.verse }} trailing={<button class="icon-btn" onClick={(e) => { e.stopPropagation(); U.removeTagVerse(id, v.book, v.chapter, v.verse); }}>➖</button>} />)}</div>
    </div>
  );
}

const BOX = ['Nuevo', 'Aprendiendo', 'Aprendiendo', 'Repasando', 'Repasando', 'Afianzado', 'Memorizado'];
const hint = (t) => t.split(' ').map((w) => { const i = w.search(/\p{L}/u); return i < 0 ? w : w.slice(0, i + 1) + w.slice(i + 1).replace(/\p{L}/gu, '_'); }).join(' ');

export function Memory() {
  const s = useSettings();
  const all = useUser(() => U.memoryAll());
  const [session, setSession] = useState(null);
  const [i, setI] = useState(0); const [known, setKnown] = useState(0);
  const due = (all || []).filter((m) => m.nextReview <= U.today());
  const mref = (m) => ({ book: m.book, chapter: m.chapter, verse: m.verse, chapterEnd: m.chapter, verseEnd: m.verseEnd });
  if (session) {
    if (i >= session.length) return (
      <div><TopBar title="Memorizar versículos" /><div class="empty"><div class="e">🧠</div><h2>Repaso terminado</h2><p>Recordaste {known} de {session.length}. +{known * 5} puntos</p><button class="btn" onClick={() => setSession(null)}>Volver</button></div></div>
    );
    return <div><TopBar title="Memorizar versículos" /><Review key={session[i].id} m={session[i]} r={mref(session[i])} version={s.version} index={i} total={session.length}
      onAnswer={async (knew) => { await U.reviewMemory(session[i], knew); if (knew) setKnown(known + 1); setI(i + 1); }} /></div>;
  }
  return (
    <div>
      <TopBar title="Memorizar versículos" />
      {!all ? <Loading /> : <>
        <div class="card tint">
          <h3>{all.length} versículos · {all.filter((m) => m.box >= 6).length} memorizados</h3>
          <p class="small">Repaso espaciado: cada vez que recuerdas un versículo, se repasa con menos frecuencia (1, 2, 4, 7, 15, 30 y 60 días).</p>
          <button class="btn" disabled={!due.length} onClick={() => { setSession(due); setI(0); setKnown(0); }}>{due.length ? `Repasar ahora (${due.length})` : 'Nada pendiente hoy'}</button>
        </div>
        {!all.length && <Empty icon="🧠" title="Aún no hay versículos" text="En el lector, selecciona un versículo y toca «Memorizar»." />}
        <div class="list">{all.map((m) => <VerseItem r={mref(m)} extra={BOX[m.box] + (m.nextReview <= U.today() ? ' · para hoy' : '')} trailing={<button class="icon-btn" onClick={(e) => { e.stopPropagation(); U.deleteMemory(m.id); }}>🗑️</button>} />)}</div>
      </>}
    </div>
  );
}

function Review({ m, r, version, index, total, onAnswer }) {
  const text = useAsync(() => C.passageText(version, r), [m.id]);
  const [reveal, setReveal] = useState(false); const [showHint, setShowHint] = useState(false);
  return (
    <div class="page" style="text-align:center">
      <div class="progress"><div style={{ width: `${(index / total) * 100}%` }} /></div>
      <p class="small muted">{index + 1} de {total}</p>
      <h2 class="serif">{C.label(r)}</h2>
      <p class="muted">Recita el versículo de memoria</p>
      <div class="card serif" style="font-size:1.15rem;line-height:1.5">{reveal ? text : showHint ? hint(text || '') : '• • •'}</div>
      {!reveal ? <div class="row" style="justify-content:center"><button class="btn outline" disabled={showHint} onClick={() => setShowHint(true)}>Pista</button><button class="btn" onClick={() => setReveal(true)}>Mostrar</button></div>
        : <><button class="icon-btn" onClick={() => speak('mem', [text])}>🔊</button>
          <div class="row" style="justify-content:center"><button class="btn outline" onClick={() => onAnswer(false)}>No lo recordé</button><button class="btn" onClick={() => onAnswer(true)}>¡Lo sé!</button></div></>}
    </div>
  );
}
