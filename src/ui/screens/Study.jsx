import { useEffect, useRef, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings } from '../../data/settings.js';
import { toggle, useSpeaker } from '../../domain/speaker.js';
import { parseQuery } from '../../domain/refparser.js';
import { useAsync, useUser, nav, openRef, TopBar, Loading, Empty, Article, Linked, Tabs, toast } from '../components.jsx';
import { Picker } from './Reader.jsx';

const Item = ({ ic, title, sub, onClick }) => <div class="item" onClick={onClick}><span style="font-size:1.3rem">{ic}</span><div class="grow"><div>{title}</div>{sub && <div class="sup">{sub}</div>}</div><span class="muted">›</span></div>;

export function StudyHub() {
  const arts = useAsync(() => C.articles(), []);
  const studies = useUser(() => U.studies());
  const [picker, setPicker] = useState(null);
  const method = (arts || []).filter((a) => a.category === 'Método de estudio');
  const others = (arts || []).filter((a) => a.category !== 'Método de estudio').reduce((m, a) => { (m[a.category] ||= []).push(a); return m; }, {});
  return (
    <div>
      <TopBar back={false} title="Estudio bíblico"><button class="icon-btn" aria-label="Buscar" onClick={() => nav('/search')}>🔍</button></TopBar>
      <div class="card">
        <h3>Estudio de un pasaje</h3>
        <p class="small">Recorre paso a paso el contexto, la exégesis, la hermenéutica y la homilética de un pasaje, con las notas de MacArthur a mano.</p>
        <div class="row"><button class="btn" onClick={() => setPicker('study')}>＋ Nuevo estudio</button><button class="btn outline" onClick={() => nav('/studies')}>Mis estudios ({studies?.length ?? 0})</button></div>
      </div>
      <div class="section-h">Biblia de Estudio MacArthur</div>
      <div class="list">
        <Item ic="ℹ️" title="Introducciones a los libros" sub="Título, autor y fecha, contexto, temas, retos de interpretación y bosquejo" onClick={() => setPicker('intro')} />
        <Item ic="📚" title="Notas versículo a versículo" sub="Más de 17.000 notas de estudio por capítulo" onClick={() => setPicker('commentary')} />
        <Item ic="📗" title="Diccionario bíblico" sub="Personas, lugares, términos, objetos y fiestas" onClick={() => nav('/dictionary')} />
        <Item ic="🗂️" title="Índice temático" sub="Más de 600 temas con sus referencias" onClick={() => nav('/index')} />
        <Item ic="🏫" title="Lecciones" sub="Curso diario: panorama de la Biblia y doctrina" onClick={() => nav('/lessons')} />
      </div>
      {method.length > 0 && <><div class="section-h">Método: contexto, exégesis, hermenéutica y homilética</div><div class="list">{method.map((a) => <Item ic="💡" title={a.title} onClick={() => nav('/article', { id: a.id })} />)}</div></>}
      {Object.entries(others).map(([cat, list]) => <><div class="section-h">{cat}</div><div class="list">{list.map((a) => <Item ic="📖" title={a.title} onClick={() => nav('/article', { id: a.id })} />)}</div></>)}
      {picker && <Picker pickVerse={false} onClose={() => setPicker(null)} onPick={(b, c) => {
        const p = picker; setPicker(null);
        if (p === 'intro') nav('/intro', { b }); else if (p === 'commentary') nav('/commentary', { b, c }); else nav('/study-edit', { id: 0, b, c, v: 0, ce: c, ve: 0 });
      }} />}
    </div>
  );
}

export function Intro({ b }) {
  const secs = useAsync(() => C.intro(b), [b]);
  const [tab, setTab] = useState(0);
  const bk = C.book(b);
  const sec = secs?.[tab];
  return (
    <div>
      <TopBar title={`Introducción a ${bk.name}`} />
      {!secs ? <Loading /> : <>
        {secs.length > 1 && <Tabs tabs={secs.map((x) => x.section)} value={tab} onChange={setTab} />}
        <div class="page">
          <h2 class="serif">{sec?.section}</h2>
          {sec && (sec.section.startsWith('Bosquejo')
            ? sec.content.split('\n').map((l) => <div class="serif" style={{ paddingLeft: /^[IVXLC]+\./.test(l) ? 0 : /^[A-Z]\./.test(l) ? 16 : 32, margin: '4px 0' }}><Linked text={l} book={b} /></div>)
            : <Article text={sec.content} book={b} />)}
          <div class="row wrap"><button class="btn outline" onClick={() => openRef({ book: b, chapter: 1, verse: 0 })}>Leer {bk.name} 1</button><button class="btn outline" onClick={() => nav('/commentary', { b, c: 1 })}>Notas del cap. 1</button></div>
          <p class="small muted">Fuente: Biblia de Estudio MacArthur (uso personal).</p>
        </div>
      </>}
    </div>
  );
}

export function Commentary({ b, c: c0 }) {
  const [c, setC] = useState(c0);
  const notes = useAsync(() => C.notesForChapter(b, c), [c]);
  const bk = C.book(b);
  return (
    <div>
      <TopBar title={`Notas · ${bk.name} ${c}`}><button class="icon-btn" aria-label="Leer capítulo" onClick={() => openRef({ book: b, chapter: c, verse: 0 })}>📖</button></TopBar>
      <div class="page">
        <div class="row">{c > 1 && <button class="btn outline" onClick={() => { setC(c - 1); scrollTo(0, 0); }}>‹ Cap. {c - 1}</button>}<span class="spacer" />{c < bk.chapters && <button class="btn outline" onClick={() => { setC(c + 1); scrollTo(0, 0); }}>Cap. {c + 1} ›</button>}</div>
        {!notes ? <Loading /> : !notes.length ? <p>No hay notas para este capítulo.</p> : notes.map((n) => (
          <div style="margin-top:16px">
            <b style="color:var(--primary);cursor:pointer" onClick={() => openRef(n)}>{C.label(n)}</b>
            <p class="serif" style="margin:4px 0;line-height:1.6;font-size:1.03rem"><Linked text={n.text} book={b} chapter={c} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArticleScreen({ id }) {
  const a = useAsync(() => C.article(id), [id]);
  return <div><TopBar title={a?.category || ''} />{!a ? <Loading /> : <div class="page"><h2 class="serif">{a.title}</h2><Article text={a.content} /></div>}</div>;
}

export function LessonScreen({ id: id0 }) {
  const s = useSettings(); const sp = useSpeaker();
  const [id, setId] = useState(id0);
  const l = useAsync(() => C.lesson(id), [id]);
  const total = useAsync(() => C.lessonCount(), []);
  const todayId = useAsync(async () => (await C.lessonOfDay(U.today())).id, []);
  const refl = useUser(() => U.reflection(id), [id]);
  const done = useUser(async () => (await U.devotionalDone(U.today())).has('lesson'), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const saved = refl?.text || '';
  const text = draft ?? saved;
  const dirty = draft !== null && draft.trim() !== saved;
  const r = l?.ref ? parseQuery(l.ref) : null;

  // Guardar: también al salir del cuadro, al cambiar de lección y al cerrar la pantalla, para no perder lo escrito.
  async function save(quiet = false) {
    if (!dirty || saving) return;
    setSaving(true);
    try { await U.saveReflection(id, draft); if (!quiet) toast(draft.trim() ? 'Reflexión guardada' : 'Reflexión borrada'); }
    catch (e) { toast('No se pudo guardar la reflexión'); console.error(e); }
    finally { setSaving(false); }
  }
  const pending = useRef(null);
  pending.current = dirty ? { id, text: draft } : null;
  useEffect(() => () => { const p = pending.current; if (p) U.saveReflection(p.id, p.text).catch(console.error); }, []);
  async function go(n) { await save(true); setDraft(null); setId(n); scrollTo(0, 0); document.querySelector('.dk-module')?.scrollTo(0, 0); }
  async function complete() { await save(true); await U.markDevotional('lesson'); toast('¡Lección completada! +5 puntos'); }
  const when = refl?.updated ? new Date(refl.updated).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div>
      <TopBar title={`Lección ${id} de ${total || '…'}`}>
        {l && <button class="icon-btn" aria-label="Escuchar lección" onClick={() => toggle(`lesson${id}`, [l.title, ...l.content.split(/\n\s*\n/)], s.speechRate)}>{sp.key === `lesson${id}` ? '⏹' : '🔊'}</button>}
      </TopBar>
      {!l ? <Loading /> : (
        <div class="page">
          {id === todayId && <span class="chip on">Lección de hoy</span>}
          <h2 class="serif">{l.title}</h2>
          {r && <button class="btn text" onClick={() => openRef(r)}>Pasaje clave: {l.ref}</button>}
          <Article text={l.content} book={l.book} />
          {l.book > 0 && <button class="btn text" style="padding-left:0" onClick={() => nav('/intro', { b: l.book })}>Ver introducción completa del libro ›</button>}

          <div class="card sec" style="margin:16px 0">
            <h3>Para reflexionar</h3>
            {l.questions.map((q, i) => <p class="small">{i + 1}. {q}</p>)}
            <textarea class="input" value={text} onInput={(e) => setDraft(e.target.value)} onBlur={() => save()} placeholder="Escribe tus respuestas y lo que Dios te enseña…" />
            <div class="row" style="margin-top:8px">
              <span class="small spacer" style={{ color: dirty ? 'var(--danger)' : 'var(--ok)' }}>
                {saving ? 'Guardando…' : dirty ? 'Cambios sin guardar' : saved ? `✓ Guardada${when ? ` · ${when}` : ''}` : ''}
              </span>
              <button class="btn" disabled={!dirty || saving} onClick={() => save()}>Guardar reflexión</button>
            </div>
          </div>

          {id === todayId && (
            <div class={`card ${done ? 'tert' : 'tint'}`} style="margin:16px 0">
              {done ? <h3>✓ Completaste la lección de hoy</h3> : <>
                <h3>¿Terminaste la lección de hoy?</h3>
                <p class="small" style="margin:4px 0 10px">Márcala como completada para sumar puntos y mantener tu racha. Tu reflexión se guarda a la vez.</p>
                <button class="btn" onClick={complete}>Completar lección</button>
              </>}
            </div>
          )}

          <div class="row">
            <button class="btn outline" disabled={id <= 1} onClick={() => go(id - 1)}>‹ Anterior</button>
            <span class="spacer" />
            <button class="btn outline" disabled={id >= total} onClick={() => go(id + 1)}>Siguiente ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Lessons() {
  const list = useAsync(() => C.lessonTitles(), []);
  const todayId = useAsync(async () => (await C.lessonOfDay(U.today())).id, []);
  return <div><TopBar title="Lecciones" />{!list ? <Loading /> : <div class="list">{list.map((x) => <div class="item" onClick={() => nav('/lesson', { id: x.id })}><b style="color:var(--primary);width:32px">{x.id}</b><div class="grow">{x.title}</div>{x.id === todayId && <span class="chip on">Hoy</span>}</div>)}</div>}</div>;
}

const cap = (t) => t.toLowerCase().replace(/^./, (x) => x.toUpperCase());
export function IndexScreen() {
  const [f, setF] = useState('');
  const topics = useAsync(() => C.indexTopics(f), [f]);
  return (
    <div><TopBar title="Índice temático" />
      <div class="page" style="padding-bottom:0"><input class="input" type="search" value={f} onInput={(e) => setF(e.target.value)} placeholder="Buscar tema: fe, oración, perdón…" /></div>
      <div class="list">{(topics || []).map((t) => <div class="item" onClick={() => nav('/index-topic', { id: t.id })}><div class="grow">{cap(t.name)}</div></div>)}</div>
    </div>
  );
}
export function IndexTopic({ id }) {
  const d = useAsync(() => C.indexTopic(id), [id]);
  return (
    <div><TopBar title={d ? cap(d.name) : ''} />
      {!d ? <Loading /> : <div class="page">{d.entries.map((e) => (/\d/.test(e) ? <div style="margin:5px 0"><Linked text={e} /></div> : <h4 style="color:var(--primary);margin:14px 0 4px">{e}</h4>))}</div>}
    </div>
  );
}

export function Studies() {
  const list = useUser(() => U.studies());
  const [picker, setPicker] = useState(false);
  return (
    <div>
      <TopBar title="Mis estudios"><button class="btn text" onClick={() => setPicker(true)}>＋ Nuevo</button></TopBar>
      {list && !list.length && <Empty icon="🎓" title="Sin estudios todavía" text="Selecciona versículos en la Biblia y toca «Estudiar», o crea uno nuevo." />}
      <div class="list">{(list || []).map((s) => (
        <div class="item" onClick={() => nav('/study-edit', { id: s.id })}>
          <div class="grow">{s.proposition && <div class="over clamp3">{s.proposition}</div>}<div>{s.title}</div>
            <div class="sup">{C.label({ book: s.book, chapter: s.chapter, verse: s.verse, chapterEnd: s.chapterEnd, verseEnd: s.verseEnd })} · {new Date(s.updated).toLocaleDateString('es')}</div></div>
        </div>
      ))}</div>
      {picker && <Picker onClose={() => setPicker(false)} onPick={(b, c) => { setPicker(false); nav('/study-edit', { id: 0, b, c, v: 0, ce: c, ve: 0 }); }} />}
    </div>
  );
}
