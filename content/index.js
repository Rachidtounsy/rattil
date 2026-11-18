// يجمع كل محتوى التطبيق: تجويد (من محتوى «رتّل» برواية ورش) + علوم القرآن + فقه + حديث + معاملات + فهرس الحفظ
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadLegacy(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), ctx);
  return ctx.window;
}

const legacy = loadLegacy('legacy-tajweed.js');
const hifzLegacy = loadLegacy('legacy-hifz.js');

function fromLegacyCard(card, level) {
  const facts = [], tl = [];
  for (const q of card.qs) {
    if (q.t === 'm') facts.push({ q: q.q, a: q.c, w: q.w, ay: q.ay || null });
    else if (q.t === 't') tl.push([q.q, q.a]);
  }
  return {
    id: 'tj-' + card.id, name: card.title, stage: level.name, stageSub: level.sub, icon: level.emoji,
    desc: '', lesson: card.lesson, facts, tl
  };
}

function fromNew(t, prefix) {
  return {
    id: prefix + '-' + t.id, name: t.name, icon: t.icon, desc: t.desc || '', stage: null,
    lesson: t.lesson,
    facts: t.facts.map(([q, a, w1, w2, w3]) => ({ q, a, w: [w1, w2, w3], ay: null })),
    tl: t.T || []
  };
}

const sections = [
  {
    id: 'tajweed', name: 'قواعد التجويد', icon: '📖', color: 'emerald',
    desc: 'من المرحلة الأولى إلى الإتقان — برواية ورش عن نافع',
    topics: legacy.LEVELS.flatMap(l => l.cards.filter(c => !c.mix && c.qs.length).map(c => fromLegacyCard(c, l)))
  },
  { id: 'quran', name: 'علوم القرآن', icon: '🌙', color: 'indigo', desc: 'نزوله وجمعه وفضائله وتدبره',
    topics: require('./sections-quran.js').map(t => fromNew(t, 'q')) },
  { id: 'hifz', name: 'الحفظ', icon: '🕯️', color: 'gold', kind: 'hifz', desc: 'سور وآيات فاضلات — يتابعها المشرف معك', topics: [] },
  { id: 'fiqh', name: 'الفقه', icon: '⚖️', color: 'terracotta', desc: 'الطهارة والصلاة والصيام والزكاة والحج على المذهب المالكي',
    topics: require('./sections-fiqh.js').map(t => fromNew(t, 'f')) },
  { id: 'hadith', name: 'الحديث', icon: '📜', color: 'teal', desc: 'المصطلح وكتب السنة وأحاديث مختارة',
    topics: require('./sections-hadith.js').map(t => fromNew(t, 'h')) },
  { id: 'muamalat', name: 'المعاملات', icon: '🤝', color: 'sand', desc: 'البيع والربا والقرض والإجارة وأخلاق التجارة',
    topics: require('./sections-muamalat.js').map(t => fromNew(t, 'm')) }
];

const hifzItems = hifzLegacy.SURAHS.map((s, i) => ({ key: s.key, name: s.name, page: s.page, n: s.n, ord: i + 1 }));

const topicIndex = new Map();
for (const s of sections) for (const t of s.topics) { t.section = s.id; topicIndex.set(t.id, t); }

module.exports = { sections, hifzItems, topicIndex, LEVELS_PER_TOPIC: 10, QUESTIONS_PER_LEVEL: 10, PASS_SCORE: 8 };
