// Acceso a la biblioteca (Biblias, MacArthur, contenido diario). Equivale a ContentRepository de Android.
import { q } from '../db/client.js';

export let books = [];
export let versions = [];

export async function loadMeta() {
  books = await q('SELECT id,usfm,name,abbr,testament,chapters FROM books ORDER BY id');
  versions = await q('SELECT id,name,copyright FROM versions ORDER BY ord');
}

export const book = (id) => books[id - 1];

/** ref = {book, chapter, verse, chapterEnd, verseEnd}; verse 0 = capítulo completo */
export function label(r) {
  const b = book(r.book); if (!b) return '?';
  let s = `${b.name} ${r.chapter}`;
  const ce = r.chapterEnd ?? r.chapter, ve = r.verseEnd ?? r.verse;
  if (r.verse > 0) s += `:${r.verse}`;
  if (ce !== r.chapter) { s += `–${ce}`; if (ve > 0) s += `:${ve}`; }
  else if (ve > r.verse && r.verse > 0) s += `–${ve}`;
  return s;
}
export const refContains = (r, ch, v) => {
  const start = r.chapter * 1000 + (r.verse || 0);
  const end = (r.chapterEnd ?? r.chapter) * 1000 + ((r.verseEnd ?? r.verse) || 999);
  const x = ch * 1000 + v; return x >= start && x <= end;
};

const vrow = (r) => ({ book: r.book, chapter: r.chapter, verse: r.verse, verseEnd: r.verse_end, para: !!r.para, text: r.text });
export const verseLabel = (v) => (v.verseEnd > v.verse ? `${v.verse}-${v.verseEnd}` : `${v.verse}`);

export async function chapter(version, b, ch) {
  return (await q('SELECT book,chapter,verse,verse_end,para,text FROM verses WHERE version=? AND book=? AND chapter=? ORDER BY verse', version, b, ch)).map(vrow);
}
export async function headings(version, b, ch) {
  return (await q('SELECT before_verse,kind,text FROM headings WHERE version=? AND book=? AND chapter=?', version, b, ch))
    .map((h) => ({ beforeVerse: h.before_verse, kind: h.kind, text: h.text }));
}
export async function passage(version, r) {
  const ce = r.chapterEnd ?? r.chapter; const ve = (r.verseEnd ?? r.verse) || 999;
  return (await q('SELECT book,chapter,verse,verse_end,para,text FROM verses WHERE version=? AND book=? AND (chapter>? OR (chapter=? AND verse>=?)) AND (chapter<? OR (chapter=? AND verse<=?)) ORDER BY chapter,verse',
    version, r.book, r.chapter, r.chapter, r.verse || 0, ce, ce, ve)).map(vrow);
}
export async function passageText(version, r) { return (await passage(version, r)).map((v) => v.text).join(' '); }
export async function verseCount(b, ch) {
  return (await q("SELECT MAX(verse_end) n FROM verses WHERE version='RVR1960' AND book=? AND chapter=?", b, ch))[0]?.n || 0;
}
export async function compare(b, ch, v) {
  const rows = await q('SELECT version,text FROM verses WHERE book=? AND chapter=? AND verse<=? AND verse_end>=?', b, ch, v, v);
  const order = versions.map((x) => x.id);
  return rows.map((r) => ({ version: r.version, name: versions.find((x) => x.id === r.version)?.name || r.version, text: r.text }))
    .sort((a, b2) => order.indexOf(a.version) - order.indexOf(b2.version));
}
export async function crossRefs(b, ch, v) { return (await q('SELECT refs FROM crossrefs WHERE book=? AND chapter=? AND verse=?', b, ch, v)).map((r) => r.refs); }
export async function versesWithNotes(b, ch) { return new Set((await q('SELECT verse FROM study_notes WHERE book=? AND chapter=?', b, ch)).map((r) => r.verse)); }

export async function search(query, version, testament, limit = 300, exact = false) {
  const words = query.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/["*():^\-]/g, '')).filter(Boolean);
  if (!words.length) return [];
  // Frase exacta: las palabras seguidas y en ese orden; si no, todas las palabras (con prefijo) en cualquier orden.
  const match = exact ? `"${words.join(' ')}"` : words.map((w) => `"${w}"*`).join(' ');
  let sql = 'SELECT v.version,v.book,v.chapter,v.verse,v.text FROM verses_fts f JOIN verses v ON v.id=f.rowid WHERE verses_fts MATCH ?';
  const args = [match];
  if (version) { sql += ' AND v.version=?'; args.push(version); }
  if (testament === 'AT') sql += ' AND v.book<=39';
  if (testament === 'NT') sql += ' AND v.book>=40';
  sql += ` ORDER BY v.book,v.chapter,v.verse LIMIT ${limit}`;
  return q(sql, ...args);
}

// ---- Estudio MacArthur ----
const note = (r) => ({ id: r.id, book: r.book, chapter: r.chapter, verse: r.verse, chapterEnd: r.chapter_end, verseEnd: r.verse_end, text: r.text });
export async function notesForChapter(b, ch) {
  return (await q('SELECT * FROM study_notes WHERE book=? AND (chapter=? OR (chapter<? AND chapter_end>=?)) ORDER BY chapter,verse,id', b, ch, ch, ch)).map(note);
}
export async function notesForVerse(b, ch, v) { return (await notesForChapter(b, ch)).filter((n) => refContains(n, ch, v)); }
export async function intro(b) { return q('SELECT section,content FROM study_intros WHERE book=? ORDER BY ord', b); }
export async function articles() { return q('SELECT id,category,title FROM articles ORDER BY id'); }
export async function article(id) { return (await q('SELECT * FROM articles WHERE id=?', id))[0]; }
export async function indexTopics(filter = '') { return q('SELECT id,name FROM topics WHERE name LIKE ? ORDER BY id', `%${filter}%`); }
export async function indexTopic(id) {
  const name = (await q('SELECT name FROM topics WHERE id=?', id))[0]?.name || '';
  return { name, entries: (await q('SELECT text FROM topic_entries WHERE topic=? ORDER BY ord', id)).map((r) => r.text) };
}
export async function abbreviations() { return q('SELECT abbr,book FROM book_abbr'); }

// ---- Diccionario ----
export const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export async function dictionarySearch(query, category) {
  const f = fold(query);
  let sql = 'SELECT id,term,category FROM dictionary WHERE 1=1'; const a = [];
  if (f) { sql += ' AND (norm LIKE ? OR norm_def LIKE ?)'; a.push(`${f}%`, `% ${f}%`); }
  if (category) { sql += ' AND category=?'; a.push(category); }
  sql += ' ORDER BY CASE WHEN norm LIKE ? THEN 0 ELSE 1 END, norm'; a.push(`${f}%`);
  return q(sql, ...a);
}
export async function dictionaryCategories() { return (await q('SELECT DISTINCT category FROM dictionary ORDER BY category')).map((r) => r.category); }
export async function dictionaryEntry(id) { return (await q('SELECT id,term,category,definition FROM dictionary WHERE id=?', id))[0]; }
export async function dictionaryFind(term) { const f = fold(term); return (await q('SELECT id,term FROM dictionary WHERE norm=? OR norm=? LIMIT 1', f, f.replace(/s$/, '')))[0]; }
export async function notesMentioning(term, limit = 12) { return (await q(`SELECT * FROM study_notes WHERE text LIKE ? ORDER BY book,chapter,verse LIMIT ${limit}`, `%${term}%`)).map(note); }
export async function countInBible(term, version) {
  const t = term.trim().replace(/["*():^\-]/g, ''); if (!t) return 0;
  return (await q('SELECT COUNT(*) n FROM verses_fts f JOIN verses v ON v.id=f.rowid WHERE verses_fts MATCH ? AND v.version=?', `"${t}"`, version))[0].n;
}
export async function indexTopicFor(term) {
  const t = term.toUpperCase();
  return (await q('SELECT id,name FROM topics WHERE name=? OR name LIKE ? OR name LIKE ? ORDER BY length(name) LIMIT 1', t, `${t},%`, `${t} %`))[0];
}

// ---- Contenido diario ----
const mod = (a, n) => ((a % n) + n) % n;
async function count(t) { return (await q(`SELECT COUNT(*) n FROM ${t}`))[0].n; }
const ref = (b, c, v, ce, ve) => ({ book: b, chapter: c, verse: v, chapterEnd: ce, verseEnd: ve });
export async function verseOfDay(day) {
  const r = (await q(`SELECT * FROM daily_verses ORDER BY id LIMIT 1 OFFSET ${mod(day, await count('daily_verses'))}`))[0];
  return ref(r.book, r.chapter, r.verse, r.chapter, r.verse_end);
}
export async function passageOfDay(day) {
  const r = (await q(`SELECT * FROM daily_passages ORDER BY id LIMIT 1 OFFSET ${mod(day, await count('daily_passages'))}`))[0];
  return { id: r.id, title: r.title, ref: ref(r.book, r.chapter, r.verse, r.chapter_end, r.verse_end) };
}
export async function prayerOfDay(day) {
  const r = (await q(`SELECT * FROM prayers ORDER BY id LIMIT 1 OFFSET ${mod(day, await count('prayers'))}`))[0];
  return { id: r.id, title: r.title, text: r.text, ref: ref(r.book, r.chapter, r.verse, r.chapter_end, r.verse_end) };
}
export async function lessonCount() { return count('lessons'); }
export async function lesson(id) {
  const r = (await q('SELECT * FROM lessons WHERE id=?', id))[0];
  return r && { ...r, questions: JSON.parse(r.questions) };
}
export async function lessonOfDay(day) { return lesson(mod(day, await count('lessons')) + 1); }
export async function lessonTitles() { return q('SELECT id,title FROM lessons ORDER BY id'); }

/** Generador pseudoaleatorio determinista (mismo resultado para la misma fecha). */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const quizRow = (r) => ({ ...r, options: JSON.parse(r.options) });
export async function dailyQuiz(day, size = 5) {
  const rand = rng(day * 7919 + 13);
  const byDiff = {};
  for (const d of [1, 2, 3]) byDiff[d] = (await q('SELECT id FROM quiz WHERE difficulty=?', d)).map((r) => r.id);
  const pattern = [1, 1, 2, 2, 3, 2, 1, 3, 2, 1]; const ids = new Set();
  for (let i = 0; ids.size < size && i < 50; i++) { const pool = byDiff[pattern[i % pattern.length]]; if (pool.length) ids.add(pool[Math.floor(rand() * pool.length)]); }
  const out = []; for (const id of ids) out.push(quizRow((await q('SELECT * FROM quiz WHERE id=?', id))[0]));
  return out;
}
export async function randomQuiz(size, category) {
  const rows = category ? await q(`SELECT * FROM quiz WHERE category=? ORDER BY RANDOM() LIMIT ${size}`, category) : await q(`SELECT * FROM quiz ORDER BY RANDOM() LIMIT ${size}`);
  return rows.map(quizRow);
}
export async function quizCategories() { return (await q('SELECT DISTINCT category FROM quiz ORDER BY category')).map((r) => r.category); }

// ---- Planes ----
export async function plans() { return q('SELECT * FROM plans ORDER BY id'); }
export async function planDays(plan) {
  return (await q('SELECT readings FROM plan_days WHERE plan=? ORDER BY day', plan)).map((r) => r.readings.split(';').filter(Boolean).map((x) => {
    const [b, rg] = x.split(':'); const [s, e] = rg.split('-'); return { book: +b, chapterStart: +s, chapterEnd: +e };
  }));
}
export const readingLabel = (r) => { const b = book(r.book); return r.chapterStart === r.chapterEnd ? `${b.name} ${r.chapterStart}` : `${b.name} ${r.chapterStart}–${r.chapterEnd}`; };
