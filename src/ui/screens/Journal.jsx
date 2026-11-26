// Diario espiritual: peticiones de oración (con «respondida») y entradas de diario. Igual que en Android 1.5.
import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { getSettings } from '../../data/settings.js';
import { useAsync, useUser, nav, openRef, TopBar, Loading, Empty, Tabs, toast } from '../components.jsx';

const fmt = (t) => new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

export const EVENT_TYPES = [['⛪', 'Culto'], ['🙏', 'Oración'], ['🍞', 'Ayuno'], ['📖', 'Devocional'], ['🌙', 'Vigilia'], ['📣', 'Campaña'],
  ['🎓', 'Estudio bíblico'], ['👥', 'Reunión'], ['🎵', 'Alabanza'], ['🤝', 'Visita'], ['📌', 'Otro']];
const emoji = (t) => EVENT_TYPES.find((x) => x[1] === t)?.[0] || '📌';
export const REMINDERS = [[-1, 'Sin aviso'], [0, 'A la hora'], [15, '15 min antes'], [60, '1 hora antes'], [180, '3 horas antes'], [1440, '1 día antes']];
const dayLabel = (t) => { const s = new Date(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }); return s[0].toUpperCase() + s.slice(1); };
const hhmm = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function EventRow({ e, faded }) {
  return (
    <div class="item" onClick={() => nav('/journal-edit', { id: e.id })} style={faded ? 'opacity:.6' : ''}>
      <div style="width:52px;text-align:center"><div style="font-size:1.4rem">{emoji(e.eventType)}</div><div class="small" style="color:var(--primary);font-weight:600">{hhmm(e.eventAt)}</div></div>
      <div class="grow">
        <div class="over">{e.eventType || 'Actividad'}{faded ? ` · ${fmt(e.eventAt)}` : ''}</div>
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{e.title || e.eventType}</div>
        {(e.place || (e.reminderMinutes >= 0 && !faded)) && <div class="sup">{e.place && `📍 ${e.place}   `}{e.reminderMinutes >= 0 && !faded && `🔔 ${REMINDERS.find((r) => r[0] === e.reminderMinutes)?.[1] || ''}`}</div>}
      </div>
    </div>
  );
}

/** Diario: Agenda de la iglesia, peticiones de oración y entradas de diario. */
export function Journal({ tab: initial = 0 }) {
  const [tab, setTab] = useState(initial);
  const [showPast, setShowPast] = useState(false);
  const kind = ['event', 'prayer', 'journal'][tab];
  const d = useUser(async () => ({ list: kind === 'event' ? await U.events() : await U.journal(kind), answered: await U.answeredCount() }), [kind]);
  const st = startOfToday();
  const upcoming = (d?.list || []).filter((e) => tab === 0 && e.eventAt >= st);
  const past = (d?.list || []).filter((e) => tab === 0 && e.eventAt < st).reverse();
  let lastDay = '';
  return (
    <div>
      <TopBar back={false} title="Diario"><button class="btn text" onClick={() => nav('/journal-edit', { kind })}>＋ {['Actividad', 'Petición', 'Entrada'][tab]}</button></TopBar>
      <Tabs tabs={['📅 Agenda', '🙏 Oración', '✍️ Diario']} value={tab} onChange={setTab} />
      {!d ? <Loading /> : <div class="list">
        {tab === 0 && <>
          {!d.list.length && <Empty icon="📅" title="Agenda vacía" text="Programa cultos, ayunos, vigilias, devocionales, campañas y demás actividades con su día, hora y lugar." />}
          {upcoming.map((e) => {
            const day = dayLabel(e.eventAt); const head = day !== lastDay ? day : null; lastDay = day;
            return <>{head && <div class="section-h">{e.eventAt < st + 86400000 ? `Hoy · ${head}` : head}</div>}<EventRow key={e.id} e={e} /></>;
          })}
          {past.length > 0 && <button class="btn text" style="margin:8px" onClick={() => setShowPast(!showPast)}>{showPast ? 'Ocultar actividades pasadas' : `Ver actividades pasadas (${past.length})`}</button>}
          {showPast && past.map((e) => <EventRow key={e.id} e={e} faded />)}
        </>}
        {tab === 1 && d.answered > 0 && <p style="padding:12px 16px;margin:0"><b>🙌 {d.answered} oración{d.answered > 1 ? 'es' : ''} respondida{d.answered > 1 ? 's' : ''}</b></p>}
        {tab > 0 && !d.list.length && (tab === 1
          ? <Empty icon="🙏" title="Sin peticiones" text="Anota por qué oras y marca cuándo Dios responde. También puedes orar desde un versículo en el lector (botón «Orar»)." />
          : <Empty icon="✍️" title="Diario vacío" text="Escribe lo que Dios te habla en tu lectura, tus luchas y tus gratitudes." />)}
        {tab > 0 && d.list.map((e) => (
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
    (async () => {
      if (id) { setE(await U.journalEntry(id)); return; }
      const k = kind || 'prayer'; const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(19, 0, 0, 0);
      setE({ id: 0, kind: k, title: '', text: '', book: b || 0, chapter: c || 0, verse: v || 0, answered: 0, answeredAt: 0, answerNote: '', created: Date.now(),
        eventType: k === 'event' ? 'Culto' : '', eventAt: k === 'event' ? t.getTime() : 0, place: '', reminderMinutes: k === 'event' ? 60 : -1 });
    })();
  }, [id]);
  const verseText = useAsync(async () => (e && e.book > 0 && e.verse > 0 ? C.passageText(getSettings().version, { book: e.book, chapter: e.chapter, verse: e.verse, verseEnd: e.verse }) : ''), [e?.book, e?.chapter, e?.verse]);
  if (!e) return <div><TopBar title="Diario" /><Loading /></div>;
  const isPrayer = e.kind === 'prayer'; const isEvent = e.kind === 'event';
  const pad = (n) => String(n).padStart(2, '0');
  const local = (t) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const set = (k, val) => setE({ ...e, [k]: val });
  async function save() {
    if (!e.title.trim() && !e.text.trim() && !isEvent) { history.back(); return; }
    await U.saveJournal({ ...e, title: e.title.trim() || (isEvent ? e.eventType : ''), text: e.text.trim(), answerNote: (e.answerNote || '').trim(), place: (e.place || '').trim() });
    toast('Guardado'); history.back();
  }
  async function del() { if (confirm('¿Eliminar esta entrada?')) { await U.deleteJournal(e.id); history.back(); } }
  return (
    <div>
      <TopBar title={isEvent ? (e.id ? 'Actividad' : 'Nueva actividad') : isPrayer ? 'Petición de oración' : 'Entrada de diario'}>
        {e.id > 0 && <button class="icon-btn" aria-label="Eliminar" onClick={del}>🗑️</button>}
        <button class="btn text" onClick={save}>Guardar</button>
      </TopBar>
      <div class="page">
        {e.book > 0 && <>
          <button class="chip" onClick={() => openRef({ book: e.book, chapter: e.chapter, verse: e.verse })}>{C.label({ book: e.book, chapter: e.chapter, verse: e.verse })}</button>
          {verseText && <p class="serif muted">«{verseText}»</p>}
        </>}
        {isEvent && <>
          <div class="small" style="margin-top:4px"><b>Tipo de actividad</b></div>
          <div style="margin:4px -3px">{EVENT_TYPES.map(([em, n]) => <button class={`chip ${e.eventType === n ? 'on' : ''}`} onClick={() => set('eventType', n)}>{em} {n}</button>)}</div>
          <label class="field"><span>Nombre de la actividad</span><input class="input" value={e.title} placeholder="p. ej. Ayuno congregacional, Vigilia de jóvenes" onInput={(x) => set('title', x.target.value)} /></label>
          <label class="field"><span>Día y hora</span><input class="input" type="datetime-local" value={local(e.eventAt)} onInput={(x) => { const t = new Date(x.target.value).getTime(); if (!isNaN(t)) set('eventAt', t); }} /></label>
          <label class="field"><span>Lugar</span><input class="input" value={e.place || ''} placeholder="Templo, casa, dirección…" onInput={(x) => set('place', x.target.value)} /></label>
          <div class="small"><b>Aviso</b> <span class="muted">(lo da la app de Android; en el iPhone se guarda para sincronizar)</span></div>
          <div style="margin:4px -3px">{REMINDERS.map(([m, l]) => <button class={`chip ${e.reminderMinutes === m ? 'on' : ''}`} onClick={() => set('reminderMinutes', m)}>{l}</button>)}</div>
          <label class="field"><span>Notas (opcional)</span><textarea class="input" rows="4" value={e.text} placeholder="Qué llevar, responsables, motivo de oración…" onInput={(x) => set('text', x.target.value)} /></label>
        </>}
        {!isEvent && <><label class="field"><span>{isPrayer ? 'Por qué o por quién oras' : 'Título (opcional)'}</span>
          <input class="input" value={e.title} onInput={(x) => set('title', x.target.value)} /></label>
        <label class="field"><span>{isPrayer ? 'Tu oración' : 'Lo que Dios te habló hoy'}</span>
          <textarea class="input" rows="8" value={e.text} onInput={(x) => set('text', x.target.value)} /></label></>}
        {isPrayer && <>
          <label class="row" style="gap:8px;align-items:center;margin:12px 0"><input type="checkbox" checked={!!e.answered} onChange={(x) => set('answered', x.target.checked ? 1 : 0)} /> Oración respondida</label>
          {!!e.answered && <label class="field"><span>¿Cómo respondió Dios?</span>
            <textarea class="input" rows="4" value={e.answerNote || ''} onInput={(x) => set('answerNote', x.target.value)} /></label>}
        </>}
        {e.id > 0 && <p class="small muted">Creada el {fmt(e.created)}</p>}
      </div>
    </div>
  );
}
