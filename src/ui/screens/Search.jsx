import { useEffect, useState } from 'preact/hooks';
import * as C from '../../data/content.js';
import { useSettings } from '../../data/settings.js';
import { parseQuery } from '../../domain/refparser.js';
import { useAsync, TopBar, openRef, share, Empty, Loading } from '../components.jsx';

export function Search({ initial }) {
  const s = useSettings();
  const [query, setQuery] = useState(initial);
  const [version, setVersion] = useState(s.version);
  const [testament, setTestament] = useState(null);
  const [res, setRes] = useState(null);
  const [refHit, setRefHit] = useState(null);
  async function run(qq = query, v = version, t = testament) {
    if (!qq.trim()) return;
    setRefHit(parseQuery(qq)); setRes(null); setRes(await C.search(qq, v, t));
  }
  useEffect(() => { if (initial) run(); }, []);
  const words = query.trim().split(/\s+/).filter((w) => w.length > 1).map(C.fold);
  const mark = (text) => text.split(/(\s+)/).map((w) => (words.some((x) => C.fold(w.replace(/[,.;:¿?¡!«»“”]/g, '')).startsWith(x)) ? <mark style="background:var(--primary-c);color:inherit">{w}</mark> : w));
  return (
    <div>
      <TopBar title="Buscar en la Biblia" />
      <form class="page" style="padding-bottom:0" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input class="input" type="search" enterkeyhint="search" value={query} onInput={(e) => setQuery(e.target.value)} placeholder="Palabras o referencia (p. ej. gracia, Juan 3:16)" />
      </form>
      <div class="chips">
        {[[null, 'Toda la Biblia'], ['AT', 'AT'], ['NT', 'NT']].map(([t, l]) => <button class={`chip ${testament === t ? 'on' : ''}`} onClick={() => { setTestament(t); run(query, version, t); }}>{l}</button>)}
        <button class={`chip ${version === null ? 'on' : ''}`} onClick={() => { setVersion(null); run(query, null, testament); }}>Todas las versiones</button>
        {C.versions.map((v) => <button class={`chip ${version === v.id ? 'on' : ''}`} onClick={() => { setVersion(v.id); run(query, v.id, testament); }}>{v.id}</button>)}
      </div>
      <div class="list">
        {refHit && <div class="item" onClick={() => openRef(refHit)}>🔎 <div class="grow">Ir a <b>{C.label(refHit)}</b></div></div>}
        {res === null && query && <Loading />}
        {res && <div class="small muted" style="padding:6px 16px">{res.length}{res.length >= 300 ? '+' : ''} resultados</div>}
        {res && !res.length && !refHit && <Empty icon="🔍" title="Sin resultados" text="Prueba con otras palabras. La búsqueda no distingue acentos." />}
        {(res || []).map((h) => (
          <div class="item" onClick={() => openRef({ book: h.book, chapter: h.chapter, verse: h.verse })}>
            <div class="grow"><div class="over">{C.book(h.book).name} {h.chapter}:{h.verse} · {h.version}</div><div class="serif">{mark(h.text)}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Compare({ b, c, v: v0 }) {
  const [v, setV] = useState(v0);
  const rows = useAsync(() => C.compare(b, c, v), [v]);
  const max = useAsync(() => C.verseCount(b, c), []);
  return (
    <div>
      <TopBar title={`Comparar · ${C.book(b).name} ${c}:${v}`} />
      <div class="row page"><button class="btn outline" disabled={v <= 1} onClick={() => setV(v - 1)}>‹ v. {v - 1}</button><span class="spacer" /><button class="btn outline" disabled={v >= (max || 0)} onClick={() => setV(v + 1)}>v. {v + 1} ›</button></div>
      {!rows ? <Loading /> : rows.map((r) => (
        <div class="card">
          <div class="row"><b style="color:var(--primary)">{r.version}</b><span class="small muted spacer">{r.name}</span><button class="icon-btn" aria-label="Compartir" onClick={() => share(`«${r.text}» — ${C.book(b).name} ${c}:${v} (${r.version})`)}>📤</button></div>
          <div class="serif" style="font-size:1.08rem;line-height:1.55">{r.text}</div>
        </div>
      ))}
    </div>
  );
}
