import { useEffect, useState, useMemo } from 'preact/hooks';
import { onUserChange } from '../data/user.js';
import { parseRefs } from '../domain/refparser.js';
import * as C from '../data/content.js';
import { getSettings } from '../data/settings.js';
import { nav, openRef } from './router.js';

/** Ejecuta una función asíncrona cuando cambian las dependencias. */
export function useAsync(fn, deps) {
  const [v, setV] = useState(undefined);
  useEffect(() => { let alive = true; setV(undefined); Promise.resolve(fn()).then((r) => alive && setV(r)).catch((e) => { console.error(e); alive && setV(null); }); return () => { alive = false; }; }, deps);
  return v;
}
/** Como useAsync, pero se vuelve a ejecutar cuando cambian los datos personales. */
export function useUser(fn, deps = []) {
  const [tick, setTick] = useState(0);
  useEffect(() => onUserChange(() => setTick((t) => t + 1)), []);
  const [v, setV] = useState(undefined);
  useEffect(() => { let alive = true; Promise.resolve(fn()).then((r) => alive && setV(r)).catch((e) => console.error(e)); return () => { alive = false; }; }, [...deps, tick]);
  return v;
}

export function TopBar({ title, sub, back = true, children }) {
  return (
    <header class="topbar">
      {back && <button class="icon-btn" aria-label="Atrás" onClick={() => history.back()}>←</button>}
      <h1>{title}{sub && <div class="sub">{sub}</div>}</h1>
      {children}
    </header>
  );
}
export const Loading = () => <div class="empty"><div class="e">⏳</div></div>;
export const Empty = ({ icon, title, text }) => <div class="empty"><div class="e">{icon}</div><h3>{title}</h3><div>{text}</div></div>;
export const Progress = ({ value }) => <div class="progress"><div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} /></div>;

let toastSet;
export function Toaster() { const [t, set] = useState(null); toastSet = set; return t ? <div class="toast">{t}</div> : null; }
export function toast(msg) { toastSet?.(msg); clearTimeout(toast.t); toast.t = setTimeout(() => toastSet?.(null), 2000); }

// ---- Vista previa de referencias (diálogo global) ----
let previewSet;
export function PreviewHost() {
  const [ref, set] = useState(null); previewSet = set;
  const text = useAsync(async () => {
    if (!ref) return null;
    const r = ref.verse ? ref : { ...ref, verse: 1, verseEnd: ref.chapterEnd === ref.chapter ? 999 : 0 };
    const vs = await C.passage(getSettings().version, r);
    return vs.length ? vs.slice(0, 40).map((v) => `${C.verseLabel(v)} ${v.text}`).join(' ') + (vs.length > 40 ? ' …' : '') : 'No se encontró el pasaje.';
  }, [ref]);
  if (!ref) return null;
  return (
    <div class="scrim center" onClick={() => set(null)}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{C.label(ref)}</h2>
        <div class="serif" style="line-height:1.55;max-height:50dvh;overflow:auto">{text ?? '…'}</div>
        <div class="actions"><button class="btn text" onClick={() => set(null)}>Cerrar</button><button class="btn text" onClick={() => { set(null); openRef(ref); }}>Abrir en la Biblia</button></div>
      </div>
    </div>
  );
}
export const preview = (ref) => previewSet?.(ref);

/** Texto con referencias bíblicas tocables. */
export function Linked({ text, book = 0, chapter = 0, class: cls }) {
  const parts = useMemo(() => {
    const spans = parseRefs(text, book, chapter); const out = []; let pos = 0;
    spans.forEach((s, i) => { if (s.start < pos) return; out.push(text.slice(pos, s.start)); out.push(<span key={i} class="ref" onClick={(e) => { e.stopPropagation(); preview(s.ref); }}>{text.slice(s.start, s.end)}</span>); pos = s.end; });
    out.push(text.slice(pos)); return out;
  }, [text, book, chapter]);
  return <span class={cls}>{parts}</span>;
}

/** Artículo con formato mínimo: párrafos, "## " subtítulos y "- " viñetas. */
export function Article({ text, book = 0 }) {
  const blocks = text.split(/\n\s*\n|\n(?=## |- |\d+\. )/).map((b) => b.trim()).filter(Boolean);
  return (
    <div class="article">
      {blocks.map((b, i) => b.startsWith('## ') ? <h4 key={i}>{b.slice(3)}</h4>
        : b.startsWith('- ') ? <li key={i}><Linked text={b.slice(2)} book={book} /></li>
          : <p key={i}><Linked text={b} book={book} /></p>)}
    </div>
  );
}

export function Sheet({ onClose, children }) {
  return <div class="scrim" onClick={onClose}><div class="sheet" onClick={(e) => e.stopPropagation()}><div class="grab" />{children}</div></div>;
}
export function Dialog({ title, onClose, actions, children }) {
  return (
    <div class="scrim center" onClick={onClose}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
        {actions && <div class="actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return <div class="tabs">{tabs.map((t, i) => <button key={t} class={value === i ? 'on' : ''} onClick={() => onChange(i)}>{t}</button>)}</div>;
}

export const argb = (c) => { const h = (c >>> 0).toString(16).padStart(8, '0'); return `#${h.slice(2)}`; };
export const HIGHLIGHTS = [0xFFFFF176 | 0, 0xFFA5D6A7 | 0, 0xFF90CAF9 | 0, 0xFFF8BBD0 | 0, 0xFFFFCC80 | 0, 0xFFCE93D8 | 0];
export const HIGHLIGHT_NAMES = ['Amarillo', 'Verde', 'Azul', 'Rosa', 'Naranja', 'Violeta'];
export const TOPIC_COLORS = [0xFF7A4A1E | 0, 0xFF2E7D32 | 0, 0xFF1565C0 | 0, 0xFFAD1457 | 0, 0xFFEF6C00 | 0, 0xFF6A1B9A | 0, 0xFF00838F | 0, 0xFF5D4037 | 0];

export function share(text) {
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copiado'));
}

/** Elemento de lista con una referencia y el texto del versículo. */
export function VerseItem({ r, extra, color, onClick, trailing }) {
  const text = useAsync(() => C.passageText(getSettings().version, r), [r.book, r.chapter, r.verse, r.verseEnd]);
  return (
    <div class="item" onClick={onClick || (() => openRef(r))}>
      {color != null && <span class="dot" style={{ width: 14, height: 14, background: argb(color) }} />}
      <div class="grow">
        <div class="over">{C.label(r)}</div>
        <div class="serif clamp4">{text ?? '…'}</div>
        {extra && <div class="small" style="color:var(--primary)">{extra}</div>}
      </div>
      {trailing}
    </div>
  );
}

export { nav, openRef };
