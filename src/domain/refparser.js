// Reconoce referencias bíblicas en español ("Gn. 1:1–3", "1 Co. 4.6", "Sal. 90:2; 148:5", "vv. 3, 4"). Port de RefParser.kt.
const SINGLE = new Set([31, 57, 63, 64, 65]);
const norm = (s) => s.toLowerCase().replace(/\./g, '').trim();
let abbr = new Map(), bookRe, bareRe, versesRe, contRe, verseContRe;

export function initRefParser(abbreviations) {
  abbr = new Map(abbreviations.map((a) => [norm(a.abbr), a.book]));
  const pat = [...new Set(abbreviations.map((a) => norm(a.abbr)))].sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[^\p{L}\d ]/gu, '').replace(/ /g, '\\s?')).join('|');
  bookRe = new RegExp(`(?<![\\p{L}\\d])(${pat})\\.?\\s?(\\d{1,3})(?:[:.](\\d{1,3}))?(?:\\s?[–-]\\s?(\\d{1,3})(?:[:.](\\d{1,3}))?)?`, 'giu');
  const cv = '(\\d{1,3})[:.](\\d{1,3})(?:\\s?[–-]\\s?(\\d{1,3})(?:[:.](\\d{1,3}))?)?';
  bareRe = new RegExp(`(?<![\\p{L}\\d:.])${cv}`, 'gu');
  versesRe = /\bvv?\.\s?(\d{1,3})(?:\s?[–-]\s?(\d{1,3}))?/g;
  contRe = new RegExp(`^\\s*[;,]\\s*${cv}`, 'u');
  verseContRe = /^\s*,\s?(\d{1,3})(?![\d:.])/;
}

function mk(book, c, v, a, b) {
  if (SINGLE.has(book) && v == null) { const e = a != null ? +a : c; return { book, chapter: 1, verse: c, chapterEnd: 1, verseEnd: e }; }
  const verse = v ?? 0;
  if (a != null && b != null) return { book, chapter: c, verse, chapterEnd: +a, verseEnd: +b };
  if (a != null && v != null) return { book, chapter: c, verse, chapterEnd: c, verseEnd: +a };
  if (a != null) return { book, chapter: c, verse: 0, chapterEnd: +a, verseEnd: 0 };
  return { book, chapter: c, verse, chapterEnd: c, verseEnd: verse };
}

/** Devuelve [{start, end, ref}] ordenados. */
export function parseRefs(text, ctxBook = 0, ctxChapter = 0) {
  if (!bookRe) return [];
  const out = []; const taken = new Uint8Array(text.length + 1);
  const add = (s, e, ref) => { for (let i = s; i < e; i++) if (taken[i]) return; for (let i = s; i < e; i++) taken[i] = 1; out.push({ start: s, end: e, ref }); };
  for (const m of text.matchAll(bookRe)) {
    const book = abbr.get(norm(m[1])); if (!book) continue;
    const v = m[3] != null ? +m[3] : null;
    const ref = mk(book, +m[2], v, m[4], m[5]);
    add(m.index, m.index + m[0].length, ref);
    let pos = m.index + m[0].length, curCh = ref.chapterEnd;
    while (pos < text.length) {
      const rest = text.slice(pos);
      const cm = rest.match(contRe);
      if (cm) { const r = mk(book, +cm[1], +cm[2], cm[3], cm[4]); add(pos + cm[0].indexOf(cm[1]), pos + cm[0].length, r); curCh = r.chapterEnd; pos += cm[0].length; continue; }
      const vm = rest.match(verseContRe);
      if (vm && v != null) { const vv = +vm[1]; add(pos + vm[0].indexOf(vm[1]), pos + vm[0].length, { book, chapter: curCh, verse: vv, chapterEnd: curCh, verseEnd: vv }); pos += vm[0].length; continue; }
      break;
    }
  }
  if (ctxBook > 0) {
    for (const m of text.matchAll(bareRe)) add(m.index, m.index + m[0].length, mk(ctxBook, +m[1], +m[2], m[3], m[4]));
    if (ctxChapter > 0) for (const m of text.matchAll(versesRe)) { const a = +m[1], b = m[2] ? +m[2] : a; add(m.index, m.index + m[0].length, { book: ctxBook, chapter: ctxChapter, verse: a, chapterEnd: ctxChapter, verseEnd: b }); }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Interpreta lo que se escribe en el buscador ("juan 3:16", "Ro 8"). */
export function parseQuery(s) {
  if (!bookRe) return null;
  bookRe.lastIndex = 0;
  const m = [...s.trim().matchAll(bookRe)][0];
  if (!m || m.index !== 0) return null;
  const book = abbr.get(norm(m[1])); if (!book) return null;
  return mk(book, +m[2], m[3] != null ? +m[3] : null, m[4], m[5]);
}
