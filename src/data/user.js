// Datos personales (SQLite local). Mismos campos que la app Android para que el respaldo JSON sea compatible.
import { uq, uexec, uinsert, umany } from '../db/client.js';
import { SM2, sm2Review } from '../domain/sm2.js';

export function today() { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
const now = () => Date.now();

const TABLES = [
  { t: 'highlights', k: 'highlights', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, book INT, chapter INT, verse INT, color INT, created INT', uniq: 'book,chapter,verse' },
  { t: 'verse_notes', k: 'notes', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, book INT, chapter INT, verse INT, text TEXT, created INT, updated INT' },
  { t: 'bookmarks', k: 'bookmarks', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, book INT, chapter INT, verse INT, created INT', uniq: 'book,chapter,verse' },
  { t: 'user_topics', k: 'topics', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, color INT, created INT' },
  { t: 'topic_verses', k: 'topicVerses', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, topicId INT, book INT, chapter INT, verse INT, verseEnd INT, note TEXT, created INT', uniq: 'topicId,book,chapter,verse' },
  { t: 'tags', k: 'tags', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT', uniq: 'name' },
  { t: 'tag_verses', k: 'tagVerses', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, tagId INT, book INT, chapter INT, verse INT, created INT', uniq: 'tagId,book,chapter,verse' },
  { t: 'chapters_read', k: 'chaptersRead', cols: 'book INT, chapter INT, readAt INT, PRIMARY KEY(book,chapter)' },
  { t: 'plan_enrollments', k: 'enrollments', cols: 'planId INTEGER PRIMARY KEY, startDay INT, active INT', bools: ['active'] },
  { t: 'plan_days_done', k: 'planDays', cols: 'planId INT, day INT, doneAt INT, PRIMARY KEY(planId,day)' },
  { t: 'activity_days', k: 'activity', cols: 'epochDay INTEGER PRIMARY KEY, points INT' },
  { t: 'quiz_days', k: 'quizDays', cols: 'epochDay INTEGER PRIMARY KEY, correct INT, total INT' },
  { t: 'devotional_done', k: 'devotional', cols: 'epochDay INT, type TEXT, PRIMARY KEY(epochDay,type)' },
  { t: 'studies', k: 'studies', cols: `id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, book INT, chapter INT, verse INT, chapterEnd INT, verseEnd INT,
     contextHistorical TEXT, contextLiterary TEXT, observation TEXT, keyWords TEXT, structure TEXT, exegeticalIdea TEXT,
     originalMeaning TEXT, principle TEXT, crossReferences TEXT, application TEXT, proposition TEXT, purpose TEXT, outline TEXT,
     illustrations TEXT, sermonApplication TEXT, conclusion TEXT, created INT, updated INT` },
  { t: 'lesson_reflections', k: 'reflections', cols: 'lessonId INTEGER PRIMARY KEY, text TEXT, updated INT' },
  { t: 'memory_verses', k: 'memory', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, book INT, chapter INT, verse INT, verseEnd INT, box INT, nextReview INT, reviews INT, created INT, ease REAL DEFAULT 2.5, interval INT DEFAULT 0, lapses INT DEFAULT 0', uniq: 'book,chapter,verse',
    // Columnas añadidas en Android 1.5 (repaso SM-2): se agregan a bases creadas antes.
    added: { ease: 'REAL DEFAULT 2.5', interval: 'INT DEFAULT 0', lapses: 'INT DEFAULT 0' } },
  { t: 'word_highlights', k: 'wordHighlights', cols: 'id INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT, book INT, chapter INT, verse INT, wordStart INT, wordEnd INT, color INT, created INT' },
  // Diario (Android 1.5): peticiones de oración (kind='prayer') y entradas de diario (kind='journal').
  { t: 'journal', k: 'journal', cols: "id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT DEFAULT 'prayer', title TEXT DEFAULT '', text TEXT DEFAULT '', book INT DEFAULT 0, chapter INT DEFAULT 0, verse INT DEFAULT 0, answered INT DEFAULT 0, answeredAt INT DEFAULT 0, answerNote TEXT DEFAULT '', created INT, updated INT", bools: ['answered'] },
];
/** Columnas de cada tabla (para importar respaldos con campos que esta versión no conoce). */
const columnsOf = {};

// ---- Notificación de cambios para refrescar pantallas ----
const listeners = new Set();
let version = 0;
export const onUserChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const userVersion = () => version;
function changed() { version++; listeners.forEach((f) => f(version)); }
async function w(sql, ...p) { const r = await uexec(sql, ...p); changed(); return r; }
async function ins(sql, ...p) { const r = await uinsert(sql, ...p); changed(); return r; }

export async function initUser() {
  await umany(TABLES.flatMap((x) => [
    { sql: `CREATE TABLE IF NOT EXISTS ${x.t}(${x.cols})` },
    ...(x.uniq ? [{ sql: `CREATE UNIQUE INDEX IF NOT EXISTS u_${x.t} ON ${x.t}(${x.uniq})` }] : []),
  ]));
  for (const x of TABLES) {
    let cols = (await uq(`PRAGMA table_info(${x.t})`)).map((c) => c.name);
    const missing = Object.entries(x.added || {}).filter(([c]) => !cols.includes(c));
    if (missing.length) {
      await umany(missing.map(([c, def]) => ({ sql: `ALTER TABLE ${x.t} ADD COLUMN ${c} ${def}` })));
      cols = cols.concat(missing.map(([c]) => c));
    }
    columnsOf[x.t] = new Set(cols);
  }
}

export const Points = { CHAPTER: 10, DEVOTIONAL: 5, QUIZ_CORRECT: 10, QUIZ_PERFECT_BONUS: 20, PLAN_DAY: 20, STUDY: 15, MEMORY: 5 };

export async function addPoints(points, day = today()) {
  await uexec('INSERT INTO activity_days(epochDay,points) VALUES(?,?) ON CONFLICT(epochDay) DO UPDATE SET points=points+excluded.points', day, points); changed();
}

// ---- Lecturas ----
export const all = (t, order = '') => uq(`SELECT * FROM ${t} ${order}`);
export const highlightsAll = () => all('highlights', 'ORDER BY created DESC');
export const notesAll = () => all('verse_notes', 'ORDER BY updated DESC');
export const bookmarksAll = () => all('bookmarks', 'ORDER BY created DESC');
export const topicsAll = () => uq('SELECT t.*, (SELECT COUNT(*) FROM topic_verses v WHERE v.topicId=t.id) count FROM user_topics t ORDER BY name COLLATE NOCASE');
export const tagsAll = () => uq('SELECT t.*, (SELECT COUNT(*) FROM tag_verses v WHERE v.tagId=t.id) count FROM tags t ORDER BY name COLLATE NOCASE');
export const taggedKeys = async () => new Set((await uq('SELECT book*1000000+chapter*1000+verse k FROM tag_verses UNION SELECT book*1000000+chapter*1000+verse FROM topic_verses')).map((r) => r.k));
export const chaptersRead = () => all('chapters_read');
export const activity = () => all('activity_days', 'ORDER BY epochDay DESC');
export const quizDays = () => all('quiz_days', 'ORDER BY epochDay DESC');
export const quizDay = async (d) => (await uq('SELECT * FROM quiz_days WHERE epochDay=?', d))[0];
export const devotionalDone = async (d) => new Set((await uq('SELECT type FROM devotional_done WHERE epochDay=?', d)).map((r) => r.type));
export const devotionalCount = async () => (await uq('SELECT COUNT(*) n FROM devotional_done'))[0].n;
export const enrollments = () => uq('SELECT * FROM plan_enrollments WHERE active=1');
export const planDaysDone = async (p) => new Set((await uq('SELECT day FROM plan_days_done WHERE planId=?', p)).map((r) => r.day));
export const planDoneCounts = async () => Object.fromEntries((await uq('SELECT planId, COUNT(*) n FROM plan_days_done GROUP BY planId')).map((r) => [r.planId, r.n]));
export const studies = () => all('studies', 'ORDER BY updated DESC');
export const study = async (id) => (await uq('SELECT * FROM studies WHERE id=?', id))[0];
export const reflection = async (id) => (await uq('SELECT * FROM lesson_reflections WHERE lessonId=?', id))[0];
export const memoryAll = () => all('memory_verses', 'ORDER BY box, created');
export const memoryDue = (d) => uq('SELECT * FROM memory_verses WHERE nextReview<=? ORDER BY box, nextReview', d);
export const wordHighlights = (v) => uq('SELECT * FROM word_highlights WHERE version=?', v);
export const topic = async (id) => (await uq('SELECT * FROM user_topics WHERE id=?', id))[0];
export const topicVerses = (id) => uq('SELECT * FROM topic_verses WHERE topicId=? ORDER BY book,chapter,verse', id);
export const tag = async (id) => (await uq('SELECT * FROM tags WHERE id=?', id))[0];
export const tagVerses = (id) => uq('SELECT * FROM tag_verses WHERE tagId=? ORDER BY book,chapter,verse', id);
export const topicsOfVerse = async (b, c, v) => new Set((await uq('SELECT topicId FROM topic_verses WHERE book=? AND chapter=? AND verse=?', b, c, v)).map((r) => r.topicId));
export const tagsOfVerse = async (b, c, v) => new Set((await uq('SELECT tagId FROM tag_verses WHERE book=? AND chapter=? AND verse=?', b, c, v)).map((r) => r.tagId));

// ---- Escrituras ----
export async function setHighlight(b, c, v, color) {
  if (color == null) return w('DELETE FROM highlights WHERE book=? AND chapter=? AND verse=?', b, c, v);
  return w('INSERT INTO highlights(book,chapter,verse,color,created) VALUES(?,?,?,?,?) ON CONFLICT(book,chapter,verse) DO UPDATE SET color=excluded.color', b, c, v, color, now());
}
export async function saveNote(existing, b, c, v, text) {
  if (!text.trim()) { if (existing) await w('DELETE FROM verse_notes WHERE id=?', existing.id); return; }
  if (existing) return w('UPDATE verse_notes SET text=?, updated=? WHERE id=?', text.trim(), now(), existing.id);
  return ins('INSERT INTO verse_notes(book,chapter,verse,text,created,updated) VALUES(?,?,?,?,?,?)', b, c, v, text.trim(), now(), now());
}
export async function toggleBookmark(b, c, v) {
  const ex = (await uq('SELECT id FROM bookmarks WHERE book=? AND chapter=? AND verse=?', b, c, v))[0];
  if (ex) return w('DELETE FROM bookmarks WHERE id=?', ex.id);
  return ins('INSERT INTO bookmarks(book,chapter,verse,created) VALUES(?,?,?,?)', b, c, v, now());
}
export const deleteBookmark = (b, c, v) => w('DELETE FROM bookmarks WHERE book=? AND chapter=? AND verse=?', b, c, v);
export const createTopic = (name, description, color) => ins('INSERT INTO user_topics(name,description,color,created) VALUES(?,?,?,?)', name.trim(), (description || '').trim(), color, now());
export const updateTopic = (t) => w('UPDATE user_topics SET name=?, description=?, color=? WHERE id=?', t.name, t.description, t.color, t.id);
export async function deleteTopic(id) { await uexec('DELETE FROM topic_verses WHERE topicId=?', id); return w('DELETE FROM user_topics WHERE id=?', id); }
export const addTopicVerse = (tid, b, c, v, ve) => ins('INSERT OR IGNORE INTO topic_verses(topicId,book,chapter,verse,verseEnd,note,created) VALUES(?,?,?,?,?,?,?)', tid, b, c, v, ve, '', now());
export const removeTopicVerse = (tid, b, c, v) => w('DELETE FROM topic_verses WHERE topicId=? AND book=? AND chapter=? AND verse=?', tid, b, c, v);
export async function createTag(name) {
  const n = name.trim().replace(/^#/, '');
  const ex = (await uq('SELECT id FROM tags WHERE name=?', n))[0]; if (ex) return ex.id;
  return ins('INSERT INTO tags(name) VALUES(?)', n);
}
export async function deleteTag(id) { await uexec('DELETE FROM tag_verses WHERE tagId=?', id); return w('DELETE FROM tags WHERE id=?', id); }
export const addTagVerse = (tid, b, c, v) => ins('INSERT OR IGNORE INTO tag_verses(tagId,book,chapter,verse,created) VALUES(?,?,?,?,?)', tid, b, c, v, now());
export const removeTagVerse = (tid, b, c, v) => w('DELETE FROM tag_verses WHERE tagId=? AND book=? AND chapter=? AND verse=?', tid, b, c, v);

export async function markChapterRead(b, c, read) {
  if (!read) return w('DELETE FROM chapters_read WHERE book=? AND chapter=?', b, c);
  const n = await uexec('INSERT OR IGNORE INTO chapters_read(book,chapter,readAt) VALUES(?,?,?)', b, c, now());
  if (n) await addPoints(Points.CHAPTER); else changed();
  return n;
}
export async function markDevotional(type) {
  const n = await uexec('INSERT OR IGNORE INTO devotional_done(epochDay,type) VALUES(?,?)', today(), type);
  if (n) await addPoints(Points.DEVOTIONAL); else changed();
}
export async function saveQuiz(correct, total) {
  const n = await uexec('INSERT OR IGNORE INTO quiz_days(epochDay,correct,total) VALUES(?,?,?)', today(), correct, total);
  if (n) await addPoints(correct * Points.QUIZ_CORRECT + (correct === total ? Points.QUIZ_PERFECT_BONUS : 0));
  return !!n;
}
export const practicePoints = (correct) => addPoints(correct * 2);
export async function markPlanDay(planId, day, done) {
  if (!done) return w('DELETE FROM plan_days_done WHERE planId=? AND day=?', planId, day);
  const n = await uexec('INSERT OR IGNORE INTO plan_days_done(planId,day,doneAt) VALUES(?,?,?)', planId, day, now());
  if (n) await addPoints(Points.PLAN_DAY); else changed();
}
export const enroll = (planId) => w('INSERT OR REPLACE INTO plan_enrollments(planId,startDay,active) VALUES(?,?,1)', planId, today());
export async function leavePlan(planId) { await uexec('DELETE FROM plan_days_done WHERE planId=?', planId); return w('DELETE FROM plan_enrollments WHERE planId=?', planId); }

const STUDY_FIELDS = ['title', 'book', 'chapter', 'verse', 'chapterEnd', 'verseEnd', 'contextHistorical', 'contextLiterary', 'observation', 'keyWords', 'structure', 'exegeticalIdea',
  'originalMeaning', 'principle', 'crossReferences', 'application', 'proposition', 'purpose', 'outline', 'illustrations', 'sermonApplication', 'conclusion'];
export async function saveStudy(s) {
  const vals = STUDY_FIELDS.map((f) => s[f] ?? '');
  if (!s.id) {
    await addPoints(Points.STUDY);
    return ins(`INSERT INTO studies(${STUDY_FIELDS.join(',')},created,updated) VALUES(${STUDY_FIELDS.map(() => '?').join(',')},?,?)`, ...vals, now(), now());
  }
  await w(`UPDATE studies SET ${STUDY_FIELDS.map((f) => `${f}=?`).join(',')}, updated=? WHERE id=?`, ...vals, now(), s.id);
  return s.id;
}
export const deleteStudy = (id) => w('DELETE FROM studies WHERE id=?', id);
export async function saveReflection(id, text) {
  if (!text.trim()) return w('DELETE FROM lesson_reflections WHERE lessonId=?', id);
  return w('INSERT OR REPLACE INTO lesson_reflections(lessonId,text,updated) VALUES(?,?,?)', id, text.trim(), now());
}
export const addMemory = (b, c, v, ve) => ins('INSERT OR IGNORE INTO memory_verses(book,chapter,verse,verseEnd,box,nextReview,reviews,created,ease,interval,lapses) VALUES(?,?,?,?,0,?,0,?,2.5,0,0)', b, c, v, ve, today(), now());
/** Repaso SM-2 (mismo algoritmo que Android 1.5). grade: 0 otra vez, 1 difícil, 2 bien, 3 fácil. */
export async function reviewMemory(m, grade) {
  const n = sm2Review(m, grade, today());
  await w('UPDATE memory_verses SET box=?, nextReview=?, reviews=?, ease=?, interval=?, lapses=? WHERE id=?', n.box, n.nextReview, n.reviews, n.ease, n.interval, n.lapses, m.id);
  if (grade >= SM2.HARD) await addPoints(Points.MEMORY);
}
// ---- Diario ----
export const journal = (kind) => uq('SELECT * FROM journal WHERE kind=? ORDER BY answered, updated DESC', kind);
export const journalEntry = async (id) => (await uq('SELECT * FROM journal WHERE id=?', id))[0];
export const answeredCount = async () => (await uq("SELECT COUNT(*) n FROM journal WHERE kind='prayer' AND answered=1"))[0].n;
export async function saveJournal(e) {
  const t = now();
  const answeredAt = e.answered ? (e.answeredAt || t) : 0;
  if (e.id) return w('UPDATE journal SET title=?, text=?, answered=?, answeredAt=?, answerNote=?, updated=? WHERE id=?', e.title, e.text, e.answered ? 1 : 0, answeredAt, e.answerNote || '', t, e.id);
  return ins('INSERT INTO journal(kind,title,text,book,chapter,verse,answered,answeredAt,answerNote,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    e.kind, e.title, e.text, e.book || 0, e.chapter || 0, e.verse || 0, e.answered ? 1 : 0, answeredAt, e.answerNote || '', t, t);
}
export const deleteJournal = (id) => w('DELETE FROM journal WHERE id=?', id);

// ---- Búsqueda en datos personales ----
const like = (q) => `%${q}%`;
export const searchNotes = (q) => uq('SELECT * FROM verse_notes WHERE text LIKE ? ORDER BY updated DESC LIMIT 100', like(q));
export const searchStudies = (q) => uq('SELECT * FROM studies WHERE title LIKE ?1 OR observation LIKE ?1 OR principle LIKE ?1 OR application LIKE ?1 OR proposition LIKE ?1 OR outline LIKE ?1 OR exegeticalIdea LIKE ?1 OR keyWords LIKE ?1 ORDER BY updated DESC LIMIT 50', like(q));
export const searchJournal = (q) => uq('SELECT * FROM journal WHERE title LIKE ?1 OR text LIKE ?1 OR answerNote LIKE ?1 ORDER BY updated DESC LIMIT 50', like(q));

export const deleteMemory = (id) => w('DELETE FROM memory_verses WHERE id=?', id);
export async function setWordHighlights(version, b, c, v, ranges) {
  await umany([{ sql: 'DELETE FROM word_highlights WHERE version=? AND book=? AND chapter=? AND verse=?', params: [version, b, c, v] },
    ...ranges.map(([s, e, col]) => ({ sql: 'INSERT INTO word_highlights(version,book,chapter,verse,wordStart,wordEnd,color,created) VALUES(?,?,?,?,?,?,?,?)', params: [version, b, c, v, s, e, col, now()] }))]);
  changed();
}

// ---- Respaldo (compatible con la app Android) ----
export async function exportJson() {
  const out = { app: 'BibliaEstudio', version: 2, created: now() };
  for (const x of TABLES) {
    const rows = await uq(`SELECT * FROM ${x.t}`);
    out[x.k] = rows.map((r) => { const o = { ...r }; delete o.count; (x.bools || []).forEach((b) => { o[b] = !!o[b]; }); return o; });
  }
  return JSON.stringify(out);
}
export async function importJson(text) {
  const data = JSON.parse(text);
  const stmts = TABLES.map((x) => ({ sql: `DELETE FROM ${x.t}` }));
  let n = 0;
  for (const x of TABLES) {
    const known = columnsOf[x.t];
    for (const row of data[x.k] || []) {
      // Solo columnas que existen aquí: un respaldo de una versión más nueva no hace fallar la importación.
      const keys = Object.keys(row).filter((k) => !known || known.has(k)); n++;
      stmts.push({ sql: `INSERT OR REPLACE INTO ${x.t}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, params: keys.map((k) => (typeof row[k] === 'boolean' ? (row[k] ? 1 : 0) : row[k])) });
    }
  }
  await umany(stmts); changed();
  return n;
}
