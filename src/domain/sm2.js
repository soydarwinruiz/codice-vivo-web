// Repaso espaciado SM-2 con cuatro respuestas. Mismo algoritmo que Sm2.kt de la app Android 1.5,
// para que un versículo avance igual en el teléfono Android y en el iPhone.
export const SM2 = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };
const MIN_EASE = 1.3;
const LEGACY = [0, 1, 2, 4, 7, 15, 30, 60];

export function sm2Review(m, grade, today) {
  // Versículos del sistema anterior (cajas Leitner): se deduce un intervalo aproximado.
  const prev = m.interval > 0 ? m.interval : (LEGACY[m.box] ?? 60);
  let ease = m.ease ?? 2.5;
  let interval;
  if (grade === SM2.AGAIN) { interval = 1; ease -= 0.2; }
  else if (grade === SM2.HARD) { interval = Math.max(1, Math.round(prev * 1.2)); ease -= 0.15; }
  else if (grade === SM2.GOOD) interval = prev === 0 ? 1 : prev === 1 ? 3 : Math.max(prev + 1, Math.round(prev * ease));
  else { interval = prev === 0 ? 3 : prev === 1 ? 5 : Math.max(prev + 2, Math.round(prev * ease * 1.3)); ease += 0.15; }
  ease = Math.min(3, Math.max(MIN_EASE, ease));
  const capped = Math.min(interval, 365);
  const box = capped >= 60 ? 6 : capped >= 30 ? 5 : capped >= 15 ? 4 : capped >= 7 ? 3 : capped >= 4 ? 2 : capped >= 2 ? 1 : 0;
  return { ...m, ease, interval: capped, nextReview: today + capped, reviews: (m.reviews || 0) + 1, lapses: (m.lapses || 0) + (grade === SM2.AGAIN ? 1 : 0), box };
}

export const sm2Preview = (m, today) => [0, 1, 2, 3].map((g) => sm2Review(m, g, today).interval);

const norm = (w) => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\d]/gu, '');

/** Compara lo escrito con el texto: [proporción de palabras acertadas, [[palabra, acertada]]]. */
export function compareTyped(expected, typed) {
  const exp = expected.split(/\s+/).filter(Boolean);
  const got = typed.split(/\s+/).map(norm).filter(Boolean);
  const a = exp.map(norm); const n = a.length, k = got.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--)
    dp[i][j] = a[i] && a[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < k) {
    if (a[i] && a[i] === got[j]) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const words = exp.map((w, idx) => [w, ok[idx] || !a[idx]]);
  return [n ? words.filter((x) => x[1]).length / n : 1, words];
}

export const gradeFor = (score) => (score >= 0.98 ? 3 : score >= 0.85 ? 2 : score >= 0.6 ? 1 : 0);
