import { useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings } from '../../data/settings.js';
import { level, streak } from '../../domain/gamification.js';
import { toggle, useSpeaker, stop } from '../../domain/speaker.js';
import { useAsync, useUser, nav, openRef, share, TopBar, Loading } from '../components.jsx';

function Daily({ title, done, onDone, children }) {
  return (
    <div class="card">
      <div class="row"><span class="overline spacer">{title}</span>
        {(onDone || done) && <button class="icon-btn" disabled={done || !onDone} onClick={onDone} aria-label="Marcar como completado">{done ? '✅' : '⚪️'}</button>}
      </div>
      {children}
    </div>
  );
}

export function Today() {
  const s = useSettings(); const sp = useSpeaker();
  const realToday = U.today();
  const [offset, setOffset] = useState(0);
  const day = realToday + offset; const isToday = offset === 0;
  const user = useUser(async () => ({
    activity: await U.activity(), done: await U.devotionalDone(realToday), quiz: await U.quizDay(realToday),
    enrollments: await U.enrollments(), due: (await U.memoryDue(realToday)).length,
  }));
  const d = useAsync(async () => {
    const vr = await C.verseOfDay(day); const p = await C.passageOfDay(day);
    return {
      vr, verseText: await C.passageText(s.version, vr), p,
      preview: await C.passageText(s.version, { ...p.ref, chapterEnd: p.ref.chapter, verseEnd: p.ref.verse + 2 }),
      lesson: await C.lessonOfDay(day), prayer: await C.prayerOfDay(day), plans: await C.plans(),
    };
  }, [day, s.version]);
  const planToday = useAsync(async () => {
    if (!user || !d) return [];
    const out = [];
    for (const e of user.enrollments) {
      const plan = d.plans.find((x) => x.id === e.planId); if (!plan) continue;
      const n = realToday - e.startDay + 1; if (n < 1 || n > plan.days) continue;
      out.push({ plan, n, readings: (await C.planDays(plan.id))[n - 1] });
    }
    return out;
  }, [user?.enrollments?.length, !!d]);

  const points = (user?.activity || []).reduce((a, x) => a + x.points, 0);
  const st = user ? streak(user.activity, realToday) : 0; const lv = level(points);
  const done = isToday && user ? user.done : new Set();
  const mark = (t) => isToday ? () => U.markDevotional(t) : null;
  const date = new Date(day * 86400000).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <div>
      <TopBar back={false} title={isToday ? 'Hoy' : 'Días anteriores'} sub={date.charAt(0).toUpperCase() + date.slice(1)}>
        <button class="icon-btn" aria-label="Día anterior" onClick={() => setOffset(offset - 1)}>‹</button>
        <button class="icon-btn" aria-label="Día siguiente" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
        <button class="icon-btn" aria-label="Buscar" onClick={() => nav('/search')}>🔍</button>
        <button class="icon-btn" aria-label="Ajustes" onClick={() => nav('/settings')}>⚙️</button>
      </TopBar>
      <div class="card tint" onClick={() => nav('/progress')}>
        <div class="stats">
          <div><b>🔥 {st}</b><span>{st === 1 ? 'día de racha' : 'días de racha'}</span></div>
          <div><b>⭐ {points}</b><span>puntos</span></div>
          <div><b>🏆 {lv.number}</b><span>{lv.name}</span></div>
          <div><b>✅ {done.size + (user?.quiz ? 1 : 0)}/5</b><span>hoy</span></div>
        </div>
      </div>
      {!isToday && <div class="chips"><button class="chip on" onClick={() => setOffset(0)}>Volver a hoy</button></div>}
      {isToday && (
        <div class="card row" onClick={() => openRef({ book: s.lastBook, chapter: s.lastChapter, verse: 0 })}>
          <span style="font-size:1.4rem">📖</span>
          <div class="spacer"><div class="overline">Continuar leyendo</div><b>{C.book(s.lastBook)?.name} {s.lastChapter}</b></div><span>›</span>
        </div>
      )}
      {isToday && user?.due > 0 && (
        <div class="card tert row" onClick={() => nav('/memory')}>
          <span style="font-size:1.4rem">🧠</span><div class="spacer">Tienes {user.due} versículo{user.due > 1 ? 's' : ''} para repasar de memoria</div><button class="btn text">Repasar</button>
        </div>
      )}
      {!d ? <Loading /> : <>
        <Daily title="Versículo del día" done={done.has('verse')} onDone={mark('verse')}>
          <p class="serif" style="font-size:1.2rem;font-style:italic;line-height:1.45;margin:6px 0">«{d.verseText}»</p>
          <div class="row">
            <b class="spacer small" style="color:var(--primary)">{C.label(d.vr)} · {s.version}</b>
            <button class="icon-btn" aria-label="Escuchar" onClick={() => toggle('vd', [d.verseText, C.label(d.vr)], s.speechRate)}>{sp.key === 'vd' ? '⏹' : '🔊'}</button>
            <button class="icon-btn" aria-label="Compartir" onClick={() => share(`«${d.verseText}» — ${C.label(d.vr)} (${s.version})`)}>📤</button>
            <button class="btn text" onClick={() => openRef(d.vr)}>Contexto</button>
          </div>
        </Daily>
        <Daily title="Pasaje del día" done={done.has('passage')} onDone={mark('passage')}>
          <h3>{d.p.title}</h3>
          <div class="small" style="color:var(--primary);font-weight:600">{C.label(d.p.ref)}</div>
          <p class="serif clamp3">{d.preview}</p>
          <div class="row"><span class="spacer" /><button class="btn tonal" onClick={() => { mark('passage')?.(); openRef(d.p.ref); }}>Leer pasaje</button></div>
        </Daily>
        <Daily title="Lección del día" done={done.has('lesson')} onDone={mark('lesson')}>
          <h3>{d.lesson.title}</h3>
          <p class="small clamp4">{d.lesson.content}</p>
          <div class="row"><span class="spacer" /><button class="btn tonal" onClick={() => nav('/lesson', { id: d.lesson.id })}>Estudiar lección</button></div>
        </Daily>
        <Daily title="Oración del día" done={done.has('prayer')} onDone={mark('prayer')}>
          <h3>{d.prayer.title}</h3>
          <div class="small" style="color:var(--primary);font-weight:600">Basada en {C.label(d.prayer.ref)}</div>
          <p class="serif clamp3">{d.prayer.text}</p>
          <div class="row"><span class="spacer" /><button class="btn tonal" onClick={() => nav('/prayer', { o: offset })}>Orar</button></div>
        </Daily>
        {isToday && (
          <Daily title="Preguntas del día" done={!!user?.quiz}>
            {!user?.quiz ? <>
              <p class="small">5 preguntas para poner a prueba tu conocimiento bíblico. ¡Gana hasta 70 puntos!</p>
              <div class="row"><span class="spacer" /><button class="btn" onClick={() => nav('/quiz')}>Comenzar</button></div>
            </> : <>
              <p class="small">Respondiste bien {user.quiz.correct} de {user.quiz.total}. ¡Vuelve mañana!</p>
              <div class="row"><span class="spacer" /><button class="btn outline" onClick={() => nav('/quiz', { p: 1 })}>Práctica libre</button></div>
            </>}
          </Daily>
        )}
        {isToday && (planToday?.length ? planToday.map(({ plan, n, readings }) => (
          <Daily key={plan.id} title={`${plan.name} · día ${n}`}>
            {readings.map((r) => <div><button class="btn text" onClick={() => openRef({ book: r.book, chapter: r.chapterStart, verse: 0 })}>{C.readingLabel(r)}</button></div>)}
            <div class="row"><span class="spacer" /><button class="btn text" onClick={() => nav('/plan', { id: plan.id })}>Abrir plan</button></div>
          </Daily>
        )) : (
          <Daily title="Plan de lectura">
            <p class="small">Aún no sigues ningún plan. Elige uno para leer la Biblia con constancia.</p>
            <div class="row"><span class="spacer" /><button class="btn text" onClick={() => nav('/progress')}>Ver planes</button></div>
          </Daily>
        ))}
      </>}
    </div>
  );
}

export function Prayer({ offset: start }) {
  const s = useSettings(); const sp = useSpeaker();
  const [offset, setOffset] = useState(start);
  const p = useAsync(async () => {
    const pr = await C.prayerOfDay(U.today() + offset);
    const verses = await C.passage(s.version, pr.ref);
    return { ...pr, scripture: verses.map((v) => `${C.verseLabel(v)} ${v.text}`).join(' '), plain: verses.map((v) => v.text).join(' ') };
  }, [offset, s.version]);
  return (
    <div>
      <TopBar title={offset === 0 ? 'Oración del día' : 'Oración'}>
        {p && <button class="icon-btn" aria-label="Escuchar" onClick={() => toggle('prayer', [p.title, p.plain, p.text], s.speechRate)}>{sp.key === 'prayer' ? '⏹' : '🔊'}</button>}
      </TopBar>
      {!p ? <Loading /> : (
        <div class="page">
          <h2 class="serif">{p.title}</h2>
          <div class="small" style="color:var(--primary);font-weight:600">Ora con la Escritura · {C.label(p.ref)}</div>
          <p class="serif muted" style="line-height:1.55">{p.scripture}</p>
          <hr style="border:0;border-top:1px solid var(--surface3)" />
          <p class="serif" style={{ fontSize: `${s.fontSize}px`, lineHeight: 1.55 }}>{p.text}</p>
          <h4>Guía A.C.T.S. para continuar orando</h4>
          <p class="small">• Adoración: alaba a Dios por quién es.<br />• Confesión: reconoce tus pecados.<br />• Gratitud: da gracias por lo que ha hecho.<br />• Súplica: presenta tus peticiones y las de otros.</p>
          <div class="row">
            {offset === 0 ? <button class="btn" onClick={async () => { await U.markDevotional('prayer'); stop(); history.back(); }}>Amén · Completar</button>
              : <button class="btn" onClick={() => history.back()}>Amén</button>}
            <span class="spacer" /><button class="btn text" onClick={() => setOffset(offset + 1)}>Otra oración</button>
          </div>
        </div>
      )}
    </div>
  );
}
