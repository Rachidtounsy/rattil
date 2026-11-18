const { sections } = require('../content');
const { makeQuiz, gradeOne, blueprints } = require('../lib/gen');
let bad = 0, topics = 0, total = 0;
for (const s of sections) for (const t of s.topics) {
  topics++;
  if (t.facts.length < 8) { console.log('! قليل الحقائق', t.id, t.facts.length); bad++; }
  for (const f of t.facts) {
    if (!f.q || !f.a || new Set([f.a, ...f.w]).size !== 4) { console.log('! خيارات مكررة/ناقصة', t.id, f.q); bad++; }
    if (f.w.some((w) => w === f.a)) { console.log('! جواب ضمن الأخطاء', t.id, f.q); bad++; }
  }
  const seenPrompts = new Map();
  for (let L = 1; L <= 10; L++) {
    const qz = makeQuiz(t.id, L, 'x');
    if (qz.questions.length !== 10) { console.log('! عدد الأسئلة', t.id, L); bad++; }
    for (const q of qz.questions) {
      total++;
      const types = q.type;
      // تحقق من أن الجواب الصحيح يُصحَّح صحيحًا
      const ans = ['mcq', 'tf', 'rev'].includes(q.type) ? q._a : q._a;
      if (!gradeOne(q, ans)) { console.log('! تصحيح', t.id, L, q.type); bad++; }
      if (q.options && new Set(q.options).size !== q.options.length) { console.log('! خيارات مكررة', t.id, L, q.prompt); bad++; }
    }
  }
  const kinds = {}; blueprints(t).flat().forEach((b) => kinds[b.kind] = (kinds[b.kind] || 0) + 1);
  const fu = {}; blueprints(t).flat().forEach((b) => { if (b.fi != null) fu[b.fi] = (fu[b.fi] || 0) + 1; });
  console.log(t.id.padEnd(22), 'حقائق', String(t.facts.length).padStart(2), 'جمل', t.lesson.length, 'كلمات', t.tl.length, JSON.stringify(kinds), 'أقصى تكرار حقيقة', Math.max(0, ...Object.values(fu)));
}
console.log('\nفروع:', topics, '| أسئلة:', total, '| مشاكل:', bad);
process.exit(bad ? 1 : 0);
