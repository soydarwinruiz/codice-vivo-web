import { useEffect, useState } from 'preact/hooks';
import { call } from '../db/client.js';
import { loadMeta, abbreviations } from '../data/content.js';
import { initUser } from '../data/user.js';
import { useSettings } from '../data/settings.js';
import { initRefParser } from '../domain/refparser.js';
import { useRoute, nav } from './router.js';
import { PreviewHost, Toaster } from './components.jsx';
import { Setup } from './screens/Setup.jsx';
import { Today, Prayer } from './screens/Today.jsx';
import { Reader } from './screens/Reader.jsx';
import { Search, Compare } from './screens/Search.jsx';
import { StudyHub, Intro, Commentary, ArticleScreen, LessonScreen, Lessons, IndexScreen, IndexTopic, Studies } from './screens/Study.jsx';
import { StudyEditor } from './screens/StudyEditor.jsx';
import { Dictionary, DictEntry } from './screens/Dictionary.jsx';
import { Mine, TopicDetail, TagDetail, Memory } from './screens/Mine.jsx';
import { ProgressScreen, PlanScreen, Quiz } from './screens/Progress.jsx';
import { SettingsScreen } from './screens/Settings.jsx';

const TABS = [['/today', '☀️', 'Hoy'], ['/reader', '📖', 'Biblia'], ['/study', '🎓', 'Estudio'], ['/mine', '🔖', 'Mis temas'], ['/progress', '📊', 'Progreso']];

export function App() {
  const s = useSettings();
  const [state, setState] = useState({ phase: 'loading' });
  const route = useRoute();

  async function boot() {
    try {
      const missing = [];
      if (!navigator.storage?.getDirectory) missing.push('almacenamiento privado (OPFS)');
      if (typeof DecompressionStream === 'undefined') missing.push('descompresión');
      if (missing.length) throw new Error(`Este navegador no tiene: ${missing.join(', ')}. Actualiza el iPhone a iOS 16.4 o superior.`);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('La base de datos no respondió a tiempo.')), 20000));
      const st = await Promise.race([call('init'), timeout]);
      await initUser();
      if (!st.hasLibrary) { setState({ phase: 'setup' }); return; }
      await loadMeta();
      initRefParser(await abbreviations());
      setState({ phase: 'ready' });
    } catch (e) { setState({ phase: 'error', error: String(e.message || e) }); }
  }
  useEffect(() => { boot(); }, []);

  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { document.documentElement.className = s.theme === 'sepia' ? 'theme-sepia' : dark ? 'theme-dark' : ''; }, [s.theme, dark]);

  if (state.phase === 'loading') return <div class="setup"><h1 class="serif">Códice vivo</h1><p class="muted">Abriendo…</p></div>;
  if (state.phase === 'error') return <div class="setup"><h1 class="serif">Códice vivo</h1><p>No se pudo abrir el almacenamiento local: {state.error}</p><p class="muted small">Requiere iOS 16.4 o superior (Safari). Si usas el modo privado de Safari, ábrela en modo normal.</p><p class="muted small" style="word-break:break-all">{navigator.userAgent}</p><button class="btn" onClick={() => location.reload()}>Reintentar</button></div>;
  if (state.phase === 'setup' || route.path === '/setup') return <Setup onDone={() => { nav('/today', null, true); boot(); }} />;

  const p = route.path, a = route.params;
  const tab = TABS.find((t) => p === t[0]);
  let screen;
  switch (p) {
    case '/today': screen = <Today />; break;
    case '/prayer': screen = <Prayer offset={+(a.o || 0)} />; break;
    case '/reader': screen = <Reader args={a} />; break;
    case '/search': screen = <Search initial={a.q || ''} />; break;
    case '/compare': screen = <Compare b={+a.b} c={+a.c} v={+a.v} />; break;
    case '/study': screen = <StudyHub />; break;
    case '/intro': screen = <Intro b={+a.b} />; break;
    case '/commentary': screen = <Commentary b={+a.b} c={+a.c} />; break;
    case '/article': screen = <ArticleScreen id={+a.id} />; break;
    case '/lesson': screen = <LessonScreen id={+a.id} />; break;
    case '/lessons': screen = <Lessons />; break;
    case '/index': screen = <IndexScreen />; break;
    case '/index-topic': screen = <IndexTopic id={+a.id} />; break;
    case '/studies': screen = <Studies />; break;
    case '/study-edit': screen = <StudyEditor id={+(a.id || 0)} init={{ book: +(a.b || 1), chapter: +(a.c || 1), verse: +(a.v || 0), chapterEnd: +(a.ce || a.c || 1), verseEnd: +(a.ve || 0) }} />; break;
    case '/dictionary': screen = <Dictionary initial={a.q || ''} />; break;
    case '/dict': screen = <DictEntry id={+a.id} />; break;
    case '/mine': screen = <Mine />; break;
    case '/topic': screen = <TopicDetail id={+a.id} />; break;
    case '/tag': screen = <TagDetail id={+a.id} />; break;
    case '/memory': screen = <Memory />; break;
    case '/progress': screen = <ProgressScreen />; break;
    case '/plan': screen = <PlanScreen id={+a.id} />; break;
    case '/quiz': screen = <Quiz practice={a.p === '1'} />; break;
    case '/settings': screen = <SettingsScreen />; break;
    default: screen = <Today />;
  }
  return (
    <div class="app" key={p}>
      <div class={`content ${tab || p === '/reader' ? '' : 'nobar'}`}>{screen}</div>
      {(tab || p === '/reader') && (
        <nav class="bottomnav">
          {TABS.map(([path, ic, lbl]) => (
            <button key={path} class={p === path ? 'on' : ''} onClick={() => nav(path)}><span class="ic">{ic}</span>{lbl}</button>
          ))}
        </nav>
      )}
      <PreviewHost /><Toaster />
    </div>
  );
}
