import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import { useSettings } from '../../data/settings.js';
import { useAsync, nav, TopBar, Loading, Empty, Article } from '../components.jsx';

export function Dictionary({ initial }) {
  const [query, setQuery] = useState(initial);
  const [cat, setCat] = useState(null);
  const cats = useAsync(() => C.dictionaryCategories(), []);
  const list = useAsync(() => C.dictionarySearch(query, cat), [query, cat]);
  useEffect(() => { if (initial) C.dictionaryFind(initial).then((e) => e && nav('/dict', { id: e.id }, true)); }, []);
  return (
    <div>
      <TopBar title="Diccionario bíblico" />
      <div class="page" style="padding-bottom:0"><input class="input" type="search" value={query} onInput={(e) => setQuery(e.target.value)} placeholder="Buscar: Abraham, gracia, Jerusalén…" /></div>
      <div class="chips"><button class={`chip ${cat === null ? 'on' : ''}`} onClick={() => setCat(null)}>Todo</button>{(cats || []).map((c) => <button class={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      {!list ? <Loading /> : <>
        <div class="small muted" style="padding:4px 16px">{list.length} entradas</div>
        {!list.length && <><Empty icon="📗" title="Sin resultados" text="Prueba otra palabra o búscala en el texto bíblico." /><button class="btn text" onClick={() => nav('/search', { q: query })}>Buscar «{query}» en la Biblia</button></>}
        <div class="list">{list.map((e) => <div class="item" onClick={() => nav('/dict', { id: e.id })}><div class="grow"><div>{e.term}</div><div class="sup">{e.category}</div></div></div>)}</div>
      </>}
    </div>
  );
}

export function DictEntry({ id }) {
  const s = useSettings();
  const e = useAsync(() => C.dictionaryEntry(id), [id]);
  const term = e ? e.term.split(' (')[0].split(',')[0] : '';
  const count = useAsync(() => (term ? C.countInBible(term, s.version) : 0), [term, s.version]);
  const topic = useAsync(() => (term ? C.indexTopicFor(term) : null), [term]);
  const notes = useAsync(() => (term ? C.notesMentioning(term) : []), [term]);
  if (!e) return <><TopBar title="Diccionario" /><Loading /></>;
  return (
    <div>
      <TopBar title="Diccionario" />
      <div class="page">
        <h2 class="serif" style="margin-bottom:4px">{e.term}</h2>
        <span class="chip">{e.category}</span>
        <Article text={e.definition} />
        <div class="card sec" style="margin:14px 0">
          <h3>En la Biblia</h3>
          <div class="small">{count == null ? 'Contando…' : `«${term}» aparece en ${count} versículo${count === 1 ? '' : 's'} (${s.version}).`}</div>
          <button class="btn text" onClick={() => nav('/search', { q: term })}>Ver todos los versículos</button>
          {topic && <button class="btn text" onClick={() => nav('/index-topic', { id: topic.id })}>Índice temático MacArthur: {topic.name.toLowerCase()}</button>}
        </div>
        {notes?.length > 0 && <><h4>Notas de MacArthur que lo mencionan</h4>
          <div class="list">{notes.map((n) => <div class="item" style="padding-left:0" onClick={() => nav('/commentary', { b: n.book, c: n.chapter })}><div class="grow"><div class="over">{C.label(n)}</div><div class="small serif clamp3">{n.text}</div></div></div>)}</div></>}
        <p class="small muted">Diccionario redactado para esta app. Contrasta siempre con el texto bíblico.</p>
      </div>
    </div>
  );
}
