const LEVELS = [[0, 'Buscador'], [100, 'Oyente'], [300, 'Discípulo'], [700, 'Lector fiel'], [1500, 'Estudiante de la Palabra'],
  [3000, 'Obrero aprobado'], [6000, 'Maestro'], [10000, 'Escriba del reino'], [16000, 'Atalaya'], [25000, 'Anciano sabio']];
export function level(points) {
  let i = 0; LEVELS.forEach(([min], k) => { if (points >= min) i = k; });
  return { number: i + 1, name: LEVELS[i][1], min: LEVELS[i][0], next: LEVELS[i + 1]?.[0] ?? null };
}
export function streak(activity, today) {
  const days = new Set(activity.filter((a) => a.points > 0).map((a) => a.epochDay));
  let d = days.has(today) ? today : today - 1, n = 0;
  while (days.has(d)) { n++; d--; }
  return n;
}
export function bestStreak(activity) {
  const days = activity.filter((a) => a.points > 0).map((a) => a.epochDay).sort((a, b) => a - b);
  let best = 0, cur = 0, prev = -1e9;
  for (const d of days) { cur = d === prev + 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}
export function achievements(s) {
  const a = (title, description, icon, value, goal) => ({ title, description, icon, unlocked: value >= goal, progress: Math.min(1, value / goal) });
  return [
    a('Primer paso', 'Lee tu primer capítulo', '📖', s.chaptersRead, 1),
    a('Lector constante', 'Lee 50 capítulos', '📚', s.chaptersRead, 50),
    a('Centurión', 'Lee 250 capítulos', '🛡️', s.chaptersRead, 250),
    a('Nuevo Testamento', 'Lee los 260 capítulos del NT', '✝️', s.ntRead, 260),
    a('Antiguo Testamento', 'Lee los 929 capítulos del AT', '📜', s.otRead, 929),
    a('Toda la Escritura', 'Lee los 1.189 capítulos', '👑', s.chaptersRead, 1189),
    a('Libro completo', 'Termina un libro', '✅', s.booksCompleted, 1),
    a('Diez libros', 'Termina 10 libros', '🏅', s.booksCompleted, 10),
    a('Una semana', 'Racha de 7 días', '🔥', s.bestStreak, 7),
    a('Un mes fiel', 'Racha de 30 días', '🌟', s.bestStreak, 30),
    a('Cien días', 'Racha de 100 días', '💎', s.bestStreak, 100),
    a('Curioso', 'Completa 7 cuestionarios', '❓', s.quizDays, 7),
    a('Perfecto', '10 cuestionarios perfectos', '🎯', s.perfectQuizzes, 10),
    a('Marcador', 'Resalta 25 versículos', '🖍️', s.highlights, 25),
    a('Organizador', 'Crea 5 temas', '🗂️', s.topics, 5),
    a('Escritor', 'Escribe 20 notas', '✍️', s.notes, 20),
    a('Exégeta', 'Guarda 5 estudios', '🔎', s.studies, 5),
    a('Devoto', '50 elementos devocionales', '🙏', s.devotionals, 50),
    a('Plan cumplido', 'Completa un plan', '🏁', s.plansCompleted, 1),
    a('Mil puntos', 'Alcanza 1.000 puntos', '⭐', s.points, 1000),
  ];
}
