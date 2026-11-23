// Ajustes guardados en el navegador (localStorage), con suscripción para refrescar la interfaz.
import { useEffect, useState } from 'preact/hooks';

const KEY = 'codice-vivo-ajustes';
const DEFAULTS = {
  version: 'RVR1960', parallelVersion: 'NBLA', parallel: false, continuous: false,
  fontSize: 19, lineHeight: 1.55, theme: 'system', showHeadings: true, showVerseNumbers: true, showNoteMarkers: true,
  lastBook: 43, lastChapter: 1, speechRate: 1,
};
let current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
const subs = new Set();

export const getSettings = () => current;
export function updateSettings(patch) {
  current = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  localStorage.setItem(KEY, JSON.stringify(current));
  subs.forEach((f) => f(current));
}
export function useSettings() {
  const [s, set] = useState(current);
  useEffect(() => { subs.add(set); return () => subs.delete(set); }, []);
  return s;
}
