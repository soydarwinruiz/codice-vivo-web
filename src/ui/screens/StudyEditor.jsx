import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import * as U from '../../data/user.js';
import { useSettings } from '../../data/settings.js';
import { useAsync, nav, openRef, share, toast, TopBar, Loading, Linked, Tabs, Dialog } from '../components.jsx';

const TABS = ['Pasaje', 'Contexto', 'Exégesis', 'Hermenéutica', 'Homilética'];
const Guide = ({ children }) => <div class="card sec" style="margin:0 0 10px">{children}</div>;
function Field({ label, value, hint, rows = 3, onChange }) {
  return <label class="field"><span>{label}</span><textarea class="input" rows={rows} value={value || ''} placeholder={hint} onInput={(e) => onChange(e.target.value)} /></label>;
}

export function exportStudy(s, ref) {
  let out = `${s.title}\n${ref}\n\n`;
  const sec = (t, f) => { const x = f.filter(([, v]) => v && v.trim()); if (!x.length) return; out += `== ${t} ==\n`; x.forEach(([k, v]) => { out += `${k}:\n${v}\n\n`; }); };
  sec('CONTEXTO', [['Histórico y cultural', s.contextHistorical], ['Literario', s.contextLiterary]]);
  sec('EXÉGESIS', [['Observaciones', s.observation], ['Palabras clave', s.keyWords], ['Estructura', s.structure], ['Idea exegética', s.exegeticalIdea]]);
  sec('HERMENÉUTICA', [['Significado original', s.originalMeaning], ['Principio', s.principle], ['Referencias cruzadas', s.crossReferences], ['Aplicación', s.application]]);
  sec('HOMILÉTICA', [['Proposición', s.proposition], ['Propósito', s.purpose], ['Bosquejo', s.outline], ['Ilustraciones', s.illustrations], ['Aplicaciones', s.sermonApplication], ['Conclusión', s.conclusion]]);
  return out;
}

export function StudyEditor({ id, init }) {
  const st = useSettings();
  const [s, setS] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { (async () => {
    if (id) setS(await U.study(id));
    else setS({ id: 0, title: `Estudio de ${C.label(init)}`, ...init });
  })(); }, [id]);
  const upd = (patch) => { setS({ ...s, ...patch }); setDirty(true); };
  async function save(back) {
    const newId = await U.saveStudy(s); setS({ ...s, id: newId }); setDirty(false); toast('Estudio guardado');
    if (!s.id) nav('/study-edit', { id: newId }, true);
    if (back) history.back();
  }
  if (!s) return <Loading />;
  const ref = { book: s.book, chapter: s.chapter, verse: s.verse, chapterEnd: s.chapterEnd, verseEnd: s.verseEnd };
  return (
    <div>
      <TopBar title={s.title}>
        <button class="icon-btn" aria-label="Compartir" onClick={() => share(exportStudy(s, C.label(ref)))}>📤</button>
        {s.id > 0 && <button class="icon-btn" aria-label="Eliminar" onClick={() => setConfirm(true)}>🗑️</button>}
        <button class="icon-btn" aria-label="Guardar" onClick={() => save(false)}>💾</button>
      </TopBar>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div class="page">
        {tab === 0 && <PassageTab s={s} upd={upd} ref_={ref} version={st.version} />}
        {tab === 1 && <>
          <Guide>Ubica el pasaje en su contexto: ¿quién escribe, a quién, cuándo y por qué? ¿Qué ocurre antes y después? ¿Dónde encaja en el bosquejo del libro?</Guide>
          <IntroHelper book={s.book} />
          <Field label="Contexto histórico y cultural" value={s.contextHistorical} hint="Autor, destinatarios, fecha, situación, costumbres…" onChange={(v) => upd({ contextHistorical: v })} />
          <Field label="Contexto literario" value={s.contextLiterary} hint="Género, lugar en el libro, párrafos anteriores y posteriores…" onChange={(v) => upd({ contextLiterary: v })} />
        </>}
        {tab === 2 && <>
          <Guide>Exégesis: extrae del texto lo que el autor quiso decir. Observa repeticiones, conectores (porque, por tanto, para que), verbos principales, mandatos y promesas. Compara versiones.</Guide>
          <button class="btn outline" onClick={() => nav('/compare', { b: s.book, c: s.chapter, v: Math.max(1, s.verse) })}>Comparar versiones</button>
          <Field label="Observaciones" value={s.observation} hint="¿Quién? ¿Qué? ¿Cuándo? ¿Dónde? ¿Por qué? ¿Cómo?" onChange={(v) => upd({ observation: v })} />
          <Field label="Palabras clave" value={s.keyWords} hint="Términos importantes y su significado (usa las notas de estudio y el diccionario)" onChange={(v) => upd({ keyWords: v })} />
          <Field label="Estructura del pasaje" value={s.structure} hint="Bosquejo o diagrama del argumento" onChange={(v) => upd({ structure: v })} />
          <Field label="Idea exegética" value={s.exegeticalIdea} hint="En una frase: lo que el texto dijo a sus primeros lectores" onChange={(v) => upd({ exegeticalIdea: v })} />
        </>}
        {tab === 3 && <>
          <Guide>Hermenéutica: interpreta según el sentido literal, gramatical e histórico. La Escritura interpreta a la Escritura. Un significado, muchas aplicaciones.</Guide>
          <Field label="Significado original" value={s.originalMeaning} hint="¿Qué significó para los destinatarios originales?" onChange={(v) => upd({ originalMeaning: v })} />
          <Field label="Principio teológico universal" value={s.principle} hint="Verdad atemporal que enseña el pasaje" onChange={(v) => upd({ principle: v })} />
          <Field label="Referencias cruzadas" value={s.crossReferences} hint="Otros textos (p. ej. Ro. 5:1; Ef. 2:8)" onChange={(v) => upd({ crossReferences: v })} />
          {s.crossReferences && <div class="small"><Linked text={s.crossReferences} book={s.book} chapter={s.chapter} /></div>}
          <Field label="Aplicación personal" value={s.application} hint="¿Qué creeré, cambiaré u obedeceré? Sé concreto." onChange={(v) => upd({ application: v })} />
        </>}
        {tab === 4 && <>
          <Guide>Homilética: convierte el estudio en un mensaje fiel al texto. Proposición clara, bosquejo que salga del pasaje, explicación, ilustración, aplicación y una conclusión que apunte a Cristo.</Guide>
          <Field label="Proposición (idea homilética)" value={s.proposition} hint="Una oración en presente, aplicable a los oyentes" onChange={(v) => upd({ proposition: v })} />
          <Field label="Propósito" value={s.purpose} hint="Qué quieres que los oyentes crean, sientan o hagan" onChange={(v) => upd({ purpose: v })} />
          <Field label="Bosquejo" rows={7} value={s.outline} hint={'I. …\n   A. …\nII. …\nIII. …'} onChange={(v) => upd({ outline: v })} />
          <Field label="Ilustraciones" value={s.illustrations} hint="Historias, ejemplos o imágenes" onChange={(v) => upd({ illustrations: v })} />
          <Field label="Aplicaciones" value={s.sermonApplication} hint="Aplicaciones concretas para la congregación" onChange={(v) => upd({ sermonApplication: v })} />
          <Field label="Conclusión e invitación" value={s.conclusion} hint="Resumen, llamado y dirección a Cristo" onChange={(v) => upd({ conclusion: v })} />
          <p class="small muted">Lista de revisión: ¿Fiel al texto? ¿Idea central clara? ¿Exalta a Cristo? ¿Aplica concretamente?</p>
        </>}
        <div class="row" style="margin-top:12px">
          {tab > 0 && <button class="btn outline" onClick={() => setTab(tab - 1)}>‹ {TABS[tab - 1]}</button>}
          <span class="spacer" />
          {tab < TABS.length - 1 ? <button class="btn" onClick={() => setTab(tab + 1)}>{TABS[tab + 1]} ›</button> : <button class="btn" onClick={() => save(false)}>Guardar estudio</button>}
        </div>
        {dirty && <p class="small muted">Tienes cambios sin guardar.</p>}
      </div>
      {confirm && <Dialog title="¿Eliminar este estudio?" onClose={() => setConfirm(false)} actions={<><button class="btn text" onClick={() => setConfirm(false)}>Cancelar</button><button class="btn text" onClick={async () => { await U.deleteStudy(s.id); history.back(); }}>Eliminar</button></>} />}
    </div>
  );
}

function PassageTab({ s, upd, ref_, version }) {
  const verses = useAsync(() => C.passage(version, ref_), [s.book, s.chapter, s.verse, s.verseEnd, version]);
  const notes = useAsync(async () => (await C.notesForChapter(s.book, s.chapter)).filter((n) => !s.verse || C.refContains(ref_, n.chapter, n.verse) || C.refContains(n, s.chapter, s.verse)), [s.book, s.chapter, s.verse, s.verseEnd]);
  return <>
    <label class="field"><span>Título del estudio</span><input class="input" value={s.title} onInput={(e) => upd({ title: e.target.value })} /></label>
    <div class="row">
      <label class="field" style="flex:1"><span>Desde v.</span><input class="input" inputmode="numeric" value={s.verse} onInput={(e) => upd({ verse: +e.target.value.replace(/\D/g, '') || 0 })} /></label>
      <label class="field" style="flex:1"><span>Hasta v.</span><input class="input" inputmode="numeric" value={s.verseEnd} onInput={(e) => upd({ verseEnd: +e.target.value.replace(/\D/g, '') || 0, chapterEnd: s.chapter })} /></label>
    </div>
    <div class="small muted">{C.book(s.book).name} {s.chapter} · 0 = capítulo completo</div>
    <div class="card" style="margin:10px 0"><b class="small" style="color:var(--primary)">{C.label(ref_)} · {version}</b>
      <div class="serif" style="line-height:1.55">{(verses || []).map((v) => `${C.verseLabel(v)} ${v.text}`).join(' ')}</div></div>
    <div class="row"><button class="btn text" onClick={() => openRef(ref_)}>Abrir en la Biblia</button><button class="btn text" onClick={() => nav('/intro', { b: s.book })}>Introducción del libro</button></div>
    <h4>Notas de estudio MacArthur ({notes?.length ?? '…'})</h4>
    {(notes || []).map((n) => <div style="margin:10px 0"><b class="small" style="color:var(--primary)">{C.label(n)}</b><div class="serif small" style="line-height:1.55"><Linked text={n.text} book={s.book} chapter={n.chapter} /></div></div>)}
  </>;
}

function IntroHelper({ book }) {
  const intro = useAsync(() => C.intro(book), [book]);
  const [open, setOpen] = useState(null);
  const sec = intro?.find((x) => x.section === open);
  return <>
    <b class="small">Ayudas de la introducción (MacArthur)</b>
    <div>{['Autor y fecha', 'Contexto histórico', 'Bosquejo'].filter((x) => intro?.some((i) => i.section === x)).map((x) => <button class={`chip ${open === x ? 'on' : ''}`} onClick={() => setOpen(open === x ? null : x)}>{x}</button>)}</div>
    {sec && <div class="card small" style="margin:6px 0;max-height:320px;overflow:auto;white-space:pre-line"><Linked text={sec.content} book={book} /></div>}
  </>;
}
