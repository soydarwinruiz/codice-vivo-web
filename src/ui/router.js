// Enrutador por hash: "#/ruta?param=valor". Funciona sin servidor (GitHub Pages).
import { useEffect, useState } from 'preact/hooks';

export function parse() {
  const h = location.hash.replace(/^#/, '') || '/today';
  const [path, qs] = h.split('?');
  return { path, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function useRoute() {
  const [r, set] = useState(parse());
  useEffect(() => { const f = () => { set(parse()); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export function nav(path, params, replace = false) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  const url = `#${path}${qs}`;
  if (replace) location.replace(url); else location.hash = url;
}
export function openRef(r) {
  nav('/reader', { b: r.book, c: r.chapter, v: r.verse || 0, ve: (r.chapterEnd ?? r.chapter) === r.chapter ? (r.verseEnd || r.verse || 0) : 999, t: Date.now() });
}
