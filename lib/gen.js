// مولّد الأسئلة: لكل فرع 10 مراحل × 10 أسئلة، تتدرج صعوبتها وتتنوع أشكالها.
// الأسئلة ثابتة لكل (فرع، مرحلة) أما ترتيب الخيارات فيتغير في كل محاولة (seed).
const crypto = require('node:crypto');
const { topicIndex } = require('../content');

function hash32(s) { return crypto.createHash('sha256').update(String(s)).digest().readUInt32LE(0); }
function rng(seed) {
  let a = hash32(seed) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const TASH = /[ً-ْٰـ]/g;
const plain = (s) => s.replace(TASH, '');
const STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'أو', 'ثم', 'هو', 'هي', 'هذا', 'هذه', 'التي', 'الذي', 'كل', 'قد', 'لا', 'أي', 'مع', 'عند', 'بعد', 'قبل', 'ذلك', 'وهو', 'وهي', 'كان', 'أنه', 'إلا', 'وأن', 'ولا', 'التي', 'الله']);

const PLAN = {
  1: ['T', 'M3', 'T', 'M3', 'M3', 'T', 'M3', 'M3', 'T', 'M3'],
  2: ['M3', 'T', 'M3', 'F1', 'M3', 'W', 'T', 'M3', 'F1', 'M3'],
  3: ['M3', 'M4', 'F1', 'T', 'O4', 'M4', 'F1', 'M3', 'W', 'M4'],
  4: ['M4', 'F1', 'O5', 'M4', 'T', 'F1', 'M4', 'W', 'O5', 'M4'],
  5: ['M4', 'F2', 'O6', 'M4', 'R', 'F1', 'M4', 'X', 'T', 'M4'],
  6: ['M4', 'F2', 'O6', 'M4', 'R', 'F2', 'M4', 'X', 'W', 'O7'],
  7: ['M4', 'F2', 'O7', 'R', 'M5', 'F2', 'M4', 'X', 'T', 'O8'],
  8: ['M5', 'F2', 'O8', 'R', 'M5', 'F3', 'M4', 'X', 'W', 'O8'],
  9: ['M5', 'F3', 'O9', 'R', 'M5', 'F3', 'M5', 'X', 'T', 'O9'],
  10: ['M5', 'F3', 'O10', 'R', 'M5', 'F3', 'M5', 'X', 'W', 'O10']
};
const LEVEL_TITLES = ['تمهيد', 'بداية', 'أساس', 'تثبيت', 'تقدّم', 'تمكّن', 'إحكام', 'إتقان', 'تميّز', 'تحدّي'];

const tokenize = (s) => s.trim().split(/\s+/).map((w) => { const m = w.match(/^([^؀-ۿ]*)(.*?)([^؀-ۿ]*)$/u); return { raw: w, pre: m[1], core: m[2], post: m[3] }; });
const factKey = (f) => f.q + '|' + (f.ay ? f.ay.v : '');

// ───────── المخططات (ثابتة لكل فرع) ─────────
const bpCache = new Map();
function blueprints(topic) {
  if (bpCache.has(topic.id)) return bpCache.get(topic.id);
  const rc = rng('bp:' + topic.id);
  const F = topic.facts.length, S = topic.lesson.length;
  const sents = topic.lesson.map(tokenize);
  let perm = [], pos = 0;
  const nextFact = () => { if (pos >= perm.length) { perm = shuffle([...Array(F).keys()], rc); pos = 0; } return perm[pos++]; };
  const nextSent = (() => { let p = [], i = 0; return () => { if (i >= p.length) { p = shuffle([...Array(S).keys()], rc); i = 0; } return p[i++]; }; })();
  const wordsPool = topic.tl; let wp = 0;
  const used = new Set();
  const levels = [];

  const tryBuild = (code, level) => {
    const kind = code[0], n = Number(code.slice(1)) || 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (kind === 'M') { const fi = nextFact(); const k = 'M' + fi + (n >= 4 ? '' : ''); if (used.has('M|' + fi + '|' + n)) continue; used.add('M|' + fi + '|' + n); return { kind: 'mcq', fi, n }; }
      if (kind === 'T') { const fi = nextFact(); const truth = rc() < 0.5; const k = 'T|' + fi + '|' + truth; if (used.has(k)) continue; used.add(k); return { kind: 'tf', fi, truth }; }
      if (kind === 'R') {
        const fi = nextFact(); const f = topic.facts[fi];
        if (f.ay || /\.\.\.|«/.test(f.q)) continue;
        if (used.has('R|' + fi)) continue; used.add('R|' + fi); return { kind: 'rev', fi, n: Math.min(4, level >= 8 ? 4 : 4) };
      }
      if (kind === 'F') {
        const si = nextSent(); const toks = sents[si];
        const elig = toks.map((t, i) => i).filter((i) => { const c = plain(toks[i].core); return c.length >= 4 && !STOP.has(c); });
        if (elig.length < 2) continue;
        const nb = Math.min(n, Math.max(1, Math.floor(elig.length / 2)));
        const blanks = shuffle(elig, rc).slice(0, nb).sort((a, b) => a - b);
        const k = 'F|' + si + '|' + blanks.join(','); if (used.has(k)) continue; used.add(k);
        return { kind: 'fill', si, blanks };
      }
      if (kind === 'O') {
        const si = nextSent(); const toks = sents[si];
        if (toks.length < 4) continue;
        const len = Math.min(n, toks.length, 12); if (len < 4) continue;
        const start = Math.floor(rc() * (toks.length - len + 1));
        const k = 'O|' + si + '|' + start + '|' + len; if (used.has(k)) continue; used.add(k);
        return { kind: 'order', si, start, len };
      }
      if (kind === 'W') {
        if (!wordsPool.length) return null;
        const wi = wp++ % wordsPool.length; const k = 'W|' + wi + '|' + level; if (used.has(k)) continue; used.add(k);
        return { kind: 'word', wi };
      }
      if (kind === 'X') {
        const cand = topic.facts.map((f, i) => i).filter((i) => { const f = topic.facts[i]; return !f.ay && f.a.length <= 38 && f.q.length <= 70 && !/\.\.\./.test(f.q); });
        if (cand.length < 4) return null;
        const sel = shuffle(cand, rc); const chosen = [];
        for (const i of sel) { if (chosen.every((j) => topic.facts[j].a !== topic.facts[i].a)) chosen.push(i); if (chosen.length === 4) break; }
        if (chosen.length < 4) return null;
        const k = 'X|' + chosen.slice().sort().join(','); if (used.has(k)) continue; used.add(k);
        return { kind: 'match', fis: chosen };
      }
    }
    return null;
  };

  for (let L = 1; L <= 10; L++) {
    const arr = [];
    for (const code of PLAN[L]) {
      let bp = tryBuild(code, L);
      if (!bp) bp = tryBuild('M4', L) || tryBuild('T', L);
      if (!bp) bp = { kind: 'mcq', fi: Math.floor(rc() * F), n: 4 };
      arr.push(bp);
    }
    levels.push(arr);
  }
  bpCache.set(topic.id, levels);
  return levels;
}

// ───────── إنشاء السؤال لمحاولة معيّنة ─────────
function instantiate(topic, bp, ro, idx) {
  const facts = topic.facts;
  const base = { id: idx, type: bp.kind };
  if (bp.kind === 'mcq') {
    const f = facts[bp.fi];
    let wrong = shuffle(f.w, ro).slice(0, Math.min(bp.n - 1, f.w.length));
    if (wrong.length < bp.n - 1) {
      const extra = shuffle(facts.map((x) => x.a).filter((a) => a !== f.a && !wrong.includes(a) && !f.w.includes(a)), ro);
      wrong = wrong.concat(extra.slice(0, bp.n - 1 - wrong.length));
    }
    const options = shuffle([f.a, ...wrong], ro);
    return { ...base, prompt: f.q, ay: f.ay, options, _a: options.indexOf(f.a), _e: f.a };
  }
  if (bp.kind === 'tf') {
    const f = facts[bp.fi]; const shown = bp.truth ? f.a : pick(f.w, ro);
    return { ...base, prompt: f.q, ay: f.ay, claim: shown, options: ['صحيح', 'خطأ'], _a: bp.truth ? 0 : 1, _e: 'الجواب الصحيح: ' + f.a };
  }
  if (bp.kind === 'rev') {
    const f = facts[bp.fi];
    const others = shuffle(facts.filter((x) => x.a !== f.a && !x.ay && !/\.\.\.|«/.test(x.q)), ro).slice(0, bp.n - 1);
    const options = shuffle([f.q, ...others.map((x) => x.q)], ro);
    return { ...base, prompt: 'أي عبارة من العبارات التالية جوابها:', claim: f.a, options, _a: options.indexOf(f.q), _e: f.q + ' ← ' + f.a };
  }
  if (bp.kind === 'fill') {
    const toks = tokenize(topic.lesson[bp.si]);
    const answers = bp.blanks.map((i) => toks[i].core);
    const others = [];
    topic.lesson.forEach((s, j) => { if (j !== bp.si) tokenize(s).forEach((t) => { const c = plain(t.core); if (c.length >= 4 && !STOP.has(c) && !answers.includes(t.core) && !others.includes(t.core)) others.push(t.core); }); });
    const bank = shuffle([...answers, ...shuffle(others, ro).slice(0, 2 + Math.floor(answers.length / 2))], ro);
    return { ...base, prompt: 'أكمل الفراغات بالكلمات المناسبة:',
      tokens: toks.map((t, i) => bp.blanks.includes(i) ? { pre: t.pre, post: t.post, blank: true } : { text: t.raw }),
      bank, _a: answers, _e: topic.lesson[bp.si] };
  }
  if (bp.kind === 'order') {
    const toks = tokenize(topic.lesson[bp.si]).slice(bp.start, bp.start + bp.len).map((t) => t.raw);
    let sh = shuffle(toks, ro), tries = 0;
    while (sh.join(' ') === toks.join(' ') && tries++ < 10) sh = shuffle(toks, ro);
    return { ...base, prompt: 'رتّب الكلمات لتكوين العبارة الصحيحة:', words: sh, join: ' ', _a: toks, _e: toks.join(' ') };
  }
  if (bp.kind === 'word') {
    const [q, a] = topic.tl[bp.wi];
    const letters = [...a]; let sh = shuffle(letters, ro), tries = 0;
    while (sh.join('') === a && tries++ < 10) sh = shuffle(letters, ro);
    return { ...base, prompt: q, hint: 'رتّب الحروف لتكوين الكلمة', words: sh, join: '', _a: letters, _e: a };
  }
  if (bp.kind === 'match') {
    const fs = bp.fis.map((i) => facts[i]);
    const right = shuffle(fs.map((f) => f.a), ro);
    return { ...base, prompt: 'صِل كل عبارة بما يناسبها:', left: fs.map((f) => f.q), right, _a: fs.map((f) => right.indexOf(f.a)), _e: fs.map((f) => f.q + ' ← ' + f.a).join('\n') };
  }
  throw new Error('bad kind ' + bp.kind);
}

function makeQuiz(topicId, level, seed) {
  const topic = topicIndex.get(topicId); if (!topic) return null;
  const bps = blueprints(topic)[level - 1]; if (!bps) return null;
  const ro = rng('ro:' + topicId + ':' + level + ':' + seed);
  return { topic, level, title: LEVEL_TITLES[level - 1], questions: bps.map((bp, i) => instantiate(topic, bp, ro, i)) };
}
const publicQ = (q) => { const o = { ...q }; delete o._a; delete o._e; return o; };

function gradeOne(q, ans) {
  if (ans == null) return false;
  if (q.type === 'mcq' || q.type === 'tf' || q.type === 'rev') return Number(ans) === q._a;
  if (q.type === 'fill' || q.type === 'order' || q.type === 'word') return Array.isArray(ans) && ans.length === q._a.length && ans.every((x, i) => x === q._a[i]);
  if (q.type === 'match') return Array.isArray(ans) && ans.length === q._a.length && ans.every((x, i) => Number(x) === q._a[i]);
  return false;
}
function correctView(q) {
  if (q.type === 'mcq' || q.type === 'tf' || q.type === 'rev') return q.options[q._a];
  if (q.type === 'match') return q._e;
  return q._e;
}

module.exports = { makeQuiz, publicQ, gradeOne, correctView, LEVEL_TITLES, blueprints };
