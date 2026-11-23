// Lectura en voz alta con la voz del dispositivo (Web Speech API, disponible en Safari para iPhone).
import { useEffect, useState } from 'preact/hooks';
let state = { key: null, index: -1 };
const subs = new Set();
const emit = () => subs.forEach((f) => f({ ...state }));
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function voice() {
  const vs = synth?.getVoices() || [];
  return vs.find((v) => v.lang === 'es-MX') || vs.find((v) => v.lang?.startsWith('es')) || null;
}

export function speak(key, parts, rate = 1) {
  if (!synth) return;
  synth.cancel();
  state = { key, index: -1 }; emit();
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = 'es-ES'; const v = voice(); if (v) u.voice = v; u.rate = rate;
    u.onstart = () => { state = { key, index: i }; emit(); };
    if (i === parts.length - 1) u.onend = () => { if (state.key === key) { state = { key: null, index: -1 }; emit(); } };
    synth.speak(u);
  });
}
export function stop() { synth?.cancel(); state = { key: null, index: -1 }; emit(); }
export function toggle(key, parts, rate) { if (state.key === key) stop(); else speak(key, parts, rate); }
export function useSpeaker() {
  const [s, set] = useState(state);
  useEffect(() => { subs.add(set); return () => subs.delete(set); }, []);
  return s;
}
