import { useEffect, useRef, useState } from 'preact/hooks';
import * as U from '../../data/user.js';
import * as C from '../../data/content.js';
import { useSettings } from '../../data/settings.js';
import { parseQuery } from '../../domain/refparser.js';
import { useAsync, TopBar, openRef, nav, share, Empty, Loading } from '../components.jsx';

const SCOPES = ['Biblia', 'Notas MacArthur', 'Mis notas y diario'];
const HKEY = 'recentSearches';
const recentGet = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; } };
function recentAdd(q) {
  const t = q.trim(); if (t.length < 2) return;
  localStorage.setItem(HKEY, JSON.stringify([t, ...recentGet().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 12)));
}

export function Search({ initial }) {
  const s = useSettings();
  const [query, setQuery] = useState(initial);
  const [version, setVersion] = useState(s.version);
  const [testament, setTestament] = useState(null);
  const [exact, setExact] = useState(false);
  const [where, setWhere] = useState(0);
  const [res, setRes] = useState(null);
  const [others, setOthers] = useState(null);
  const [refHit, setRefHit] = useState(null);
  const [recent, setRecent] = useState(recentGet());
  const seq = useRef(0);
  async function run(o = {}) {
    const qq = o.q ?? query, v = 'v' in o ? o.v : version, t = 't' in o ? o.t : testament, ex = o.ex ?? exact, w = o.w ?? where;
    if (!qq.trim()) return;
    const my = ++seq.current;   // una búsqueda nueva descarta el resultado de la anterior
    setRefHit(parseQuery(qq)); setRes(null); setOthers(null);
    if (w === 0) { const r = await C.search(qq, v, t, 300, ex); if (my === seq.current) setRes(r); }
    else if (w === 1) {
      const r = (await C.notesMentioning(qq.trim(), 100)).map((n) => ({ over: C.label(n), text: n.text, ref: n }));
      if (my === seq.current) setOthers(r);
    } else {
      const t2 = qq.trim();
      const notes = (await U.searchNotes(t2)).map((n) => ({ over: 'Nota · ' + C.label(n), text: n.text, ref: n }));
      const studies = (await U.searchStudies(t2)).map((x) => ({ over: 'Estudio · ' + C.label(x), text: x.title, go: () => nav('/study-edit', { id: x.id }) }));
      const jr = (await U.searchJournal(t2)).map((j) => ({ over: j.kind === 'prayer' ? 'Oración' : 'Diario', text: j.title || j.text, go: () => nav('/journal-edit', { id: j.id }) }));
      if (my === seq.current) setOthers([...notes, ...studies, ...jr]);
    }
    recentAdd(qq); setRecent(recentGet());
  }
  useEffect(() => { if (initial) run(); }, []);
  const words = query.trim().split(/\s+/).filter((w) => w.length > 1).map(C.fold);
  const mark = (text) => text.split(/(\s+)/).map((w) => (words.some((x) => C.fold(w.replace(/[,.;:¿?¡!«»“”()]/g, '')).startsWith(x)) ? <mark style="background:var(--primary-c);color:inherit">{w}</mark> : w));
  const snippet = (text) => {
    if (!text || text.length < 280 || !words.length) return text;
    const f = C.fold(text); const i = Math.min(...words.map((w) => f.indexOf(w)).filter((x) => x >= 0));
    if (!isFinite(i)) return text.slice(0, 280) + '…';
    const st = Math.max(0, i - 100); return (st ? '…' : '') + text.slice(st, st + 280) + (st + 280 < text.length ? '…' : '');
  };
  const plural = (n) => `${n} resultado${n === 1 ? '' : 's'}`;
  return (
    <div>
      <TopBar title="Buscar" />
      <form class="page" style="padding-bottom:0" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input class="input" type="search" enterkeyhint="search" value={query} onInput={(e) => setQuery(e.target.value)} placeholder="Palabras o referencia (p. ej. gracia, Juan 3:16)" />
      </form>
      <div class="chips">{SCOPES.map((l, i) => <button class={`chip ${where === i ? 'on' : ''}`} onClick={() => { setWhere(i); run({ w: i }); }}>{l}</button>)}</div>
      {where === 0 && <div class="chips">
        <button class={`chip ${exact ? 'on' : ''}`} onClick={() => { setExact(!exact); run({ ex: !exact }); }}>Frase exacta</button>
        {[[null, 'Toda la Biblia'], ['AT', 'AT'], ['NT', 'NT']].map(([t, l]) => <button class={`chip ${testament === t ? 'on' : ''}`} onClick={() => { setTestament(t); run({ t }); }}>{l}</button>)}
        <button class={`chip ${version === null ? 'on' : ''}`} onClick={() => { setVersion(null); run({ v: null }); }}>Todas las versiones</button>
        {C.versions.map((v) => <button class={`chip ${version === v.id ? 'on' : ''}`} onClick={() => { setVersion(v.id); run({ v: v.id }); }}>{v.id}</button>)}
      </div>}
      <div class="list">
        {!query.trim() && recent.length > 0 && <>
          <div class="row" style="padding:6px 16px"><b class="small spacer">Búsquedas recientes</b><button class="btn text" onClick={() => { localStorage.removeItem(HKEY); setRecent([]); }}>Borrar</button></div>
          {recent.map((r) => <div class="item" onClick={() => { setQuery(r); run({ q: r }); }}>🕘 <div class="grow">{r}</div></div>)}
        </>}
        {refHit && <div class="item" onClick={() => openRef(refHit)}>🔎 <div class="grow">Ir a <b>{C.label(refHit)}</b></div></div>}
        {res === null && others === null && query.trim() && seq.current > 0 && <Loading />}
        {res && <div class="small muted" style="padding:6px 16px">{plural(res.length)}{res.length >= 300 ? '+' : ''}</div>}
        {res && !res.length && !refHit && <Empty icon="🔍" title="Sin resultados" text="Prueba con otras palabras. La búsqueda no distingue acentos." />}
        {(res || []).map((h) => (
          <div class="item" onClick={() => openRef({ book: h.book, chapter: h.chapter, verse: h.verse })}>
            <div class="grow"><div class="over">{C.book(h.book).name} {h.chapter}:{h.verse} · {h.version}</div><div class="serif">{mark(h.text)}</div></div>
          </div>
        ))}
        {others && <div class="small muted" style="padding:6px 16px">{plural(others.length)}</div>}
        {others && !others.length && <Empty icon="🔍" title="Sin resultados" text={where === 1 ? 'Ninguna nota de estudio menciona ese texto.' : 'No hay notas, estudios ni entradas de diario con ese texto.'} />}
        {(others || []).map((h) => (
          <div class="item" onClick={() => (h.go ? h.go() : openRef({ book: h.ref.book, chapter: h.ref.chapter, verse: h.ref.verse }))}>
            <div class="grow"><div class="over">{h.over}</div><div>{mark(snippet(h.text) || '')}</div></div>
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
