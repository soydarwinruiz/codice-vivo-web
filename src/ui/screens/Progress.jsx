import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { level, streak, bestStreak, achievements } from '../../domain/gamification.js';
import { parseQuery } from '../../domain/refparser.js';
import { useAsync, useUser, nav, openRef, TopBar, Loading, Progress, Dialog, preview } from '../components.jsx';

export function ProgressScreen() {
  const plans = useAsync(() => C.plans(), []);
  const [all, setAll] = useState(false);
  const d = useUser(async () => ({
    read: await U.chaptersRead(), activity: await U.activity(), quiz: await U.quizDays(), enr: await U.enrollments(), hl: (await U.highlightsAll()).length,
    notes: (await U.notesAll()).length, topics: (await U.topicsAll()).length, studies: (await U.studies()).length, dev: await U.devotionalCount(), done: await U.planDoneCounts(),
  }));
  if (!d || !plans) return <><TopBar back={false} title="Progreso" /><Loading /></>;
  const perBook = d.read.reduce((m, r) => { m[r.book] = (m[r.book] || 0) + 1; return m; }, {});
  const ot = d.read.filter((r) => r.book <= 39).length, nt = d.read.length - ot;
  const points = d.activity.reduce((a, x) => a + x.points, 0); const lv = level(points);
  const stats = {
    chaptersRead: d.read.length, otRead: ot, ntRead: nt, booksCompleted: C.books.filter((b) => (perBook[b.id] || 0) >= b.chapters).length,
    streak: streak(d.activity, U.today()), bestStreak: bestStreak(d.activity), points, quizDays: d.quiz.length, perfectQuizzes: d.quiz.filter((q) => q.correct === q.total).length,
    highlights: d.hl, topics: d.topics, notes: d.notes, studies: d.studies, devotionals: d.dev, plansCompleted: plans.filter((p) => (d.done[p.id] || 0) >= p.days).length,
  };
  const ach = achievements(stats);
  const Line = ({ l, v, t }) => <div style="margin-top:10px"><div class="row small"><span class="spacer">{l}</span><span>{v}/{t} · {(v * 100 / t).toFixed(1)} %</span></div><Progress value={v / t} /></div>;
  return (
    <div>
      <TopBar back={false} title="Progreso"><button class="icon-btn" aria-label="Preguntas" onClick={() => nav('/quiz')}>❓</button></TopBar>
      <div class="card tint">
        <h3 class="serif" style="font-size:1.3rem">Nivel {lv.number} · {lv.name}</h3>
        {lv.next ? <><Progress value={(points - lv.min) / (lv.next - lv.min)} /><div class="small" style="margin-top:4px">{points} / {lv.next} puntos para el siguiente nivel</div></> : <div>{points} puntos · ¡nivel máximo!</div>}
        <div class="stats" style="margin-top:10px"><div><b>🔥 {stats.streak}</b><span>racha</span></div><div><b>🏅 {stats.bestStreak}</b><span>mejor racha</span></div><div><b>❓ {stats.quizDays}</b><span>cuestionarios</span></div><div><b>🎯 {stats.perfectQuizzes}</b><span>perfectos</span></div></div>
      </div>
      <div class="card"><h3>Lectura de la Biblia</h3><Line l="Toda la Biblia" v={d.read.length} t={1189} /><Line l="Antiguo Testamento" v={ot} t={929} /><Line l="Nuevo Testamento" v={nt} t={260} /><p class="small">{stats.booksCompleted} libros completos</p></div>
      <div class="section-h">Planes de lectura</div>
      <div class="list">{plans.map((p) => {
        const e = d.enr.find((x) => x.planId === p.id); const done = d.done[p.id] || 0;
        return <div class="item" onClick={() => nav('/plan', { id: p.id })}><div class="grow"><div>{p.name}</div><div class="sup">{p.description}</div>
          {e && <><Progress value={done / p.days} /><div class="sup">{done} de {p.days} días · día {Math.min(p.days, U.today() - e.startDay + 1)} del calendario</div></>}</div>
          <span class="small" style={{ color: e ? 'var(--tertiary)' : 'var(--muted)' }}>{e ? 'Activo' : `${p.days} días`}</span></div>;
      })}</div>
      <div class="section-h">Logros ({ach.filter((a) => a.unlocked).length}/{ach.length})</div>
      <div class="ach">{ach.map((a) => <div class={a.unlocked ? '' : 'off'}><div class="ai">{a.icon}</div><b>{a.title}</b><div>{a.description}</div>{!a.unlocked && <Progress value={a.progress} />}</div>)}</div>
      <div class="row" style="padding:12px 16px"><b class="spacer" style="color:var(--primary)">Progreso por libro</b><button class="btn text" onClick={() => setAll(!all)}>{all ? 'Solo iniciados' : 'Ver todos'}</button></div>
      {C.books.filter((b) => all || perBook[b.id]).map((b) => <div style="padding:6px 16px" onClick={() => openRef({ book: b.id, chapter: 1, verse: 0 })}><div class="row small"><span class="spacer">{b.name}</span><span>{perBook[b.id] || 0}/{b.chapters}</span></div><Progress value={(perBook[b.id] || 0) / b.chapters} /></div>)}
    </div>
  );
}

export function PlanScreen({ id }) {
  const plan = useAsync(async () => (await C.plans()).find((p) => p.id === id), [id]);
  const days = useAsync(() => C.planDays(id), [id]);
  const d = useUser(async () => ({ enr: (await U.enrollments()).find((e) => e.planId === id), done: await U.planDaysDone(id) }), [id]);
  const [leave, setLeave] = useState(false);
  const curDay = d?.enr ? U.today() - d.enr.startDay + 1 : 0;
  useEffect(() => { if (curDay > 2 && days) setTimeout(() => document.getElementById(`d${curDay}`)?.scrollIntoView({ block: 'center' }), 100); }, [!!days, curDay]);
  if (!plan || !days || !d) return <><TopBar title="Plan" /><Loading /></>;
  return (
    <div>
      <TopBar title={plan.name} />
      <div class="page">
        <p>{plan.description}</p>
        {!d.enr ? <button class="btn" onClick={() => U.enroll(id)}>Comenzar hoy</button> : <>
          <Progress value={d.done.size / plan.days} /><p class="small">{d.done.size} de {plan.days} días completados</p>
          <button class="btn text" onClick={() => setLeave(true)}>Abandonar / reiniciar plan</button>
        </>}
      </div>
      <div class="list">{days.map((rs, i) => {
        const n = i + 1; const today = n === curDay;
        return (
          <div id={`d${n}`} class="item" style={today ? { background: 'var(--primary-c)' } : {}}>
            <input type="checkbox" style="width:22px;height:22px" checked={d.done.has(n)} onChange={async (e) => {
              if (!d.enr) await U.enroll(id);
              await U.markPlanDay(id, n, e.target.checked);
              if (e.target.checked) for (const r of rs) for (let c = r.chapterStart; c <= r.chapterEnd; c++) await U.markChapterRead(r.book, c, true);
            }} />
            <div class="grow"><div class="over">Día {n}{today ? ' · HOY' : ''}</div>{rs.map((r) => <div><span class="ref" onClick={() => openRef({ book: r.book, chapter: r.chapterStart, verse: 0 })}>{C.readingLabel(r)}</span></div>)}</div>
          </div>
        );
      })}</div>
      {leave && <Dialog title="¿Abandonar el plan?" onClose={() => setLeave(false)} actions={<><button class="btn text" onClick={() => setLeave(false)}>Cancelar</button><button class="btn text" onClick={async () => { await U.leavePlan(id); setLeave(false); }}>Abandonar</button></>}><p class="small">Se borrará el progreso de este plan (los capítulos leídos se conservan).</p></Dialog>}
    </div>
  );
}

export function Quiz({ practice: p0 }) {
  const day = U.today();
  const done = useUser(() => U.quizDay(day));
  const [practice, setPractice] = useState(p0);
  const [cat, setCat] = useState(null); const [round, setRound] = useState(0);
  const cats = useAsync(() => C.quizCategories(), []);
  const qs = useAsync(() => (practice ? C.randomQuiz(10, cat) : C.dailyQuiz(day)), [practice, cat, round]);
  const [i, setI] = useState(0); const [chosen, setChosen] = useState(null); const [correct, setCorrect] = useState(0); const [finished, setFinished] = useState(false);
  useEffect(() => { setI(0); setChosen(null); setCorrect(0); setFinished(false); }, [qs]);
  const already = !practice && done && !finished && i === 0 && chosen === null;
  return (
    <div>
      <TopBar title={practice ? 'Práctica libre' : 'Preguntas del día'} />
      <div class="page">
        {practice && <div class="chips" style="padding:0 0 8px"><button class={`chip ${cat === null ? 'on' : ''}`} onClick={() => setCat(null)}>Todas</button>{(cats || []).map((c) => <button class={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>}
        {already ? <div class="empty"><div class="e">🎉</div><h3>Ya completaste las preguntas de hoy: {done.correct}/{done.total}</h3><p>Vuelve mañana para un nuevo desafío, o sigue practicando.</p><button class="btn" onClick={() => setPractice(true)}>Práctica libre</button></div>
          : !qs ? <Loading /> : !qs.length ? <p>No hay preguntas en esta categoría.</p>
            : finished ? <div class="empty"><div class="e">{correct === qs.length ? '🏆' : correct * 2 >= qs.length ? '👏' : '📖'}</div><h2>{correct} de {qs.length} correctas</h2>
              <p style="color:var(--primary);font-weight:600">+{practice ? correct * 2 : correct * U.Points.QUIZ_CORRECT + (correct === qs.length ? U.Points.QUIZ_PERFECT_BONUS : 0)} puntos</p>
              <div class="row" style="justify-content:center"><button class="btn outline" onClick={() => history.back()}>Salir</button><button class="btn" onClick={() => { setPractice(true); setRound(round + 1); }}>Otra ronda</button></div></div>
              : (() => {
                const q = qs[i]; const r = parseQuery(q.ref);
                return <>
                  <Progress value={(i + (chosen !== null ? 1 : 0)) / qs.length} />
                  <div class="row small" style="margin:8px 0"><span class="spacer">Pregunta {i + 1} de {qs.length}</span><span class="muted">{q.category} · {'★'.repeat(q.difficulty)}</span></div>
                  <h2 class="serif" style="white-space:pre-line;line-height:1.35">{q.question}</h2>
                  {q.options.map((o, k) => <button class={`quiz-opt ${chosen === null ? '' : k === q.answer ? 'good' : k === chosen ? 'bad' : ''}`} onClick={() => { if (chosen === null) { setChosen(k); if (k === q.answer) setCorrect(correct + 1); } }}>{o}</button>)}
                  {chosen !== null && <>
                    <h3 style={{ color: chosen === q.answer ? 'var(--ok)' : 'var(--danger)' }}>{chosen === q.answer ? '¡Correcto!' : `Respuesta correcta: ${q.options[q.answer]}`}</h3>
                    {r ? <button class="btn text" onClick={() => preview(r)}>Ver {q.ref}</button> : <p class="small muted">{q.ref}</p>}
                    <button class="btn block" onClick={async () => {
                      if (i + 1 < qs.length) { setI(i + 1); setChosen(null); }
                      else { setFinished(true); if (practice) await U.practicePoints(correct); else await U.saveQuiz(correct, qs.length); }
                    }}>{i + 1 < qs.length ? 'Siguiente' : 'Ver resultado'}</button>
                  </>}
                </>;
              })()}
      </div>
    </div>
  );
}
