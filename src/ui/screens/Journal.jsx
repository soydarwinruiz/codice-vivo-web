// Diario espiritual: peticiones de oración (con «respondida») y entradas de diario. Igual que en Android 1.5.
import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { getSettings } from '../../data/settings.js';
import { useAsync, useUser, nav, openRef, TopBar, Loading, Empty, Tabs, toast } from '../components.jsx';

const fmt = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export function Journal({ tab: initial = 0 }) {
  const [tab, setTab] = useState(initial);
  const kind = tab === 0 ? 'prayer' : 'journal';
  const d = useUser(async () => ({ list: await U.journal(kind), answered: await U.answeredCount() }), [kind]);
  return (
    <div>
      <TopBar title="Diario"><button class="btn text" onClick={() => nav('/journal-edit', { kind })}>＋ {tab === 0 ? 'Petición' : 'Entrada'}</button></TopBar>
      <Tabs tabs={['🙏 Oración', '✍️ Diario']} value={tab} onChange={setTab} />
      {!d ? <Loading /> : <div class="list">
        {tab === 0 && d.answered > 0 && <p style="padding:12px 16px;margin:0"><b>🙌 {d.answered} oración{d.answered > 1 ? 'es' : ''} respondida{d.answered > 1 ? 's' : ''}</b></p>}
        {!d.list.length && (tab === 0
          ? <Empty icon="🙏" title="Sin peticiones" text="Anota por qué oras y marca cuándo Dios responde. También puedes orar desde un versículo en el lector (botón «Orar»)." />
          : <Empty icon="✍️" title="Diario vacío" text="Escribe lo que Dios te habla en tu lectura, tus luchas y tus gratitudes." />)}
        {d.list.map((e) => (
          <div class="item" key={e.id} onClick={() => nav('/journal-edit', { id: e.id })}>
            {e.kind === 'prayer' && <span style="font-size:1.3rem">{e.answered ? '✅' : '🙏'}</span>}
            <div class="grow">
              <div class="over">{fmt(e.created)}{e.book > 0 && ` · ${C.label({ book: e.book, chapter: e.chapter, verse: e.verse })}`}{e.answered ? ` · respondida el ${fmt(e.answeredAt)}` : ''}</div>
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{e.title || (e.text || '').split('\n')[0]}</div>
              {e.title && e.text && <div class="sup" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{e.text}</div>}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

export function JournalEdit({ id, kind, b, c, v }) {
  const [e, setE] = useState(null);
  useEffect(() => {
    (async () => setE(id ? await U.journalEntry(id) : { id: 0, kind: kind || 'prayer', title: '', text: '', book: b || 0, chapter: c || 0, verse: v || 0, answered: 0, answeredAt: 0, answerNote: '', created: Date.now() }))();
  }, [id]);
  const verseText = useAsync(async () => (e && e.book > 0 && e.verse > 0 ? C.passageText(getSettings().version, { book: e.book, chapter: e.chapter, verse: e.verse, verseEnd: e.verse }) : ''), [e?.book, e?.chapter, e?.verse]);
  if (!e) return <div><TopBar title="Diario" /><Loading /></div>;
  const isPrayer = e.kind === 'prayer';
  const set = (k, val) => setE({ ...e, [k]: val });
  async function save() {
    if (!e.title.trim() && !e.text.trim()) { history.back(); return; }
    await U.saveJournal({ ...e, title: e.title.trim(), text: e.text.trim(), answerNote: (e.answerNote || '').trim() });
    toast('Guardado'); history.back();
  }
  async function del() { if (confirm('¿Eliminar esta entrada?')) { await U.deleteJournal(e.id); history.back(); } }
  return (
    <div>
      <TopBar title={isPrayer ? 'Petición de oración' : 'Entrada de diario'}>
        {e.id > 0 && <button class="icon-btn" aria-label="Eliminar" onClick={del}>🗑️</button>}
        <button class="btn text" onClick={save}>Guardar</button>
      </TopBar>
      <div class="page">
        {e.book > 0 && <>
          <button class="chip" onClick={() => openRef({ book: e.book, chapter: e.chapter, verse: e.verse })}>{C.label({ book: e.book, chapter: e.chapter, verse: e.verse })}</button>
          {verseText && <p class="serif muted">«{verseText}»</p>}
        </>}
        <label class="field"><span>{isPrayer ? 'Por qué o por quién oras' : 'Título (opcional)'}</span>
          <input class="input" value={e.title} onInput={(x) => set('title', x.target.value)} /></label>
        <label class="field"><span>{isPrayer ? 'Tu oración' : 'Lo que Dios te habló hoy'}</span>
          <textarea class="input" rows="8" value={e.text} onInput={(x) => set('text', x.target.value)} /></label>
        {isPrayer && <>
          <label class="row" style="gap:8px;align-items:center;margin:12px 0"><input type="checkbox" checked={!!e.answered} onChange={(x) => set('answered', x.target.checked ? 1 : 0)} /> Oración respondida</label>
          {!!e.answered && <label class="field"><span>¿Cómo respondió Dios?</span>
            <textarea class="input" rows="4" value={e.answerNote || ''} onInput={(x) => set('answerNote', x.target.value)} /></label>}
        </>}
        <p class="small muted">Creada el {fmt(e.created)}</p>
      </div>
    </div>
  );
}
