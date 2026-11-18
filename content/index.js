// يجمع كل محتوى التطبيق: تجويد (من محتوى «رتّل» برواية ورش) + علوم القرآن + فقه + حديث + معاملات + فهرس الحفظ
// الملفات القديمة تعرّف window.* — نحمّلها بـ require حتى يضمّها المجمّع (esbuild) داخل دالة Netlify
globalThis.window = globalThis.window || {};
require('./legacy-tajweed.js');
require('./legacy-hifz.js');
const legacy = globalThis.window;
const hifzLegacy = globalThis.window;

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

// المجموعة 1: وحدات كتاب «سور وآيات فاضلات» بترتيبه. المجموعة 2: القرآن كاملًا بترتيب المصحف.
const SURAHS114 = require('./quran-surahs.js');
const KEY_NUM = { fatiha: 1, baqara: 2, imran: 3, tawba: 9, kahf: 18, sajda: 32, yasin: 36, ghafir: 40, dukhan: 44, fath: 48, waqia: 56, hadid: 57, hashr: 59, saff: 61, jumua: 62, taghabun: 64, mulk: 67, ala: 87, duha: 93, sharh: 94, alaq: 96, qadr: 97, zalzala: 99, takathur: 102, asr: 103, quraysh: 106, maun: 107, kawthar: 108, kafirun: 109, nasr: 110, ikhlas: 112, falaq: 113, nas: 114 };
const PARTIAL = new Set(['baqara', 'imran', 'tawba', 'kahf', 'ghafir', 'fath']);
const wholeDone = new Set(hifzLegacy.SURAHS.filter((s) => !PARTIAL.has(s.key)).map((s) => KEY_NUM[s.key]));
const hifzItems = hifzLegacy.SURAHS.map((s) => ({ key: s.key, name: s.name, page: s.page, n: s.n, grp: 'book' }));
SURAHS114.forEach(([name, n], i) => {
  const num = i + 1; if (wholeDone.has(num)) return;
  hifzItems.push({ key: 's' + num, name: 'سورة ' + name + (PARTIAL.has(Object.keys(KEY_NUM).find((k) => KEY_NUM[k] === num)) ? ' (كاملة)' : ''), page: null, n, grp: 'full' });
});
hifzItems.forEach((it, i) => { it.ord = i + 1; });

const topicIndex = new Map();
for (const s of sections) for (const t of s.topics) { t.section = s.id; topicIndex.set(t.id, t); }

module.exports = { sections, hifzItems, topicIndex, LEVELS_PER_TOPIC: 10, QUESTIONS_PER_LEVEL: 10, PASS_SCORE: 8 };
