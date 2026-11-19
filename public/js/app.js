'use strict';
(() => {
  const $app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { me: null, cfg: { leaderboard: false, passScore: 8 }, pub: null, cat: null };

  const STAR8 = '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#e8c874"><rect x="14" y="14" width="36" height="36"/><rect x="14" y="14" width="36" height="36" transform="rotate(45 32 32)"/></g><circle cx="32" cy="32" r="9" fill="#0b3b2e"/><circle cx="32" cy="32" r="4" fill="#e8c874"/></svg>';
  const TIPS = [
    ['اقرأ بالتدريج', 'عشر دقائق كل يوم خير من ساعة في الأسبوع. الاستمرار يصنع الإتقان.'],
    ['تعلّم الحكم بمثاله', 'اربط كل حكم تجويدي بآية تحفظها؛ المثال الحيّ يثبّت القاعدة.'],
    ['راجع قبل أن تنسى', 'راجع محفوظك بعد كل صلاة، فالمراجعة القصيرة المتكررة أنفع من المراجعة الطويلة النادرة.'],
    ['اقرأ بتدبّر', 'قبل الحفظ اقرأ تفسير الآيات المختصر؛ المعنى يعين الحافظ على الثبات.'],
    ['أخطأت؟ لا بأس', 'راجع الأجوبة الصحيحة بعد كل اختبار؛ الخطأ الذي تفهمه لا يتكرر.'],
    ['اختر وقتًا للقرآن', 'ما بعد الفجر وقت صفاء الذهن، فاجعل فيه وِردك.'],
    ['استمع لقارئ متقن', 'الأذن تتعلّم قبل اللسان؛ أنصت لقارئ بروايتك ثم قلّد.'],
    ['اسأل أهل العلم', 'ما أشكل عليك من أحكام فقهية أو تجويدية فاسأل شيخك، والمنصة عون لا بديل.']
  ];
  const STATUS = ['لم يبدأ', 'قيد الحفظ', 'محفوظ'];
  const TYPE_LABEL = { mcq: 'اختيار من متعدد', tf: 'صح أم خطأ', rev: 'اختر السؤال المناسب', fill: 'أكمل الفراغات', order: 'رتّب الكلمات', word: 'رتّب الحروف', match: 'صِل بين العبارات' };

  // ───────── أدوات ─────────
  async function api(path, opts = {}) {
    const r = await fetch('/api' + path, { method: opts.method || 'GET', headers: (opts.method && opts.method !== 'GET') || opts.body ? { 'content-type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : (opts.method && opts.method !== 'GET' ? '{}' : undefined), credentials: 'same-origin' });
    let data = {}; try { data = await r.json(); } catch { }
    if (!r.ok) { const e = new Error(data.message || data.error || 'error'); e.status = r.status; e.data = data; throw e; }
    return data;
  }
  let toastT; function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
  const stars = (n) => [1, 2, 3].map((i) => `<span class="${i <= n ? '' : 'off'}">★</span>`).join('');
  const starsOf = (b) => b >= 10 ? 3 : b >= 9 ? 2 : b >= S.cfg.passScore ? 1 : 0;
  const fmtDate = (d) => d ? new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const levelState = (lv, i) => lv[i] != null ? (lv[i] >= S.cfg.passScore ? (lv[i] >= 10 ? 'perfect' : 'done') : 'tried') : (i === 0 || (lv[i - 1] != null && lv[i - 1] >= S.cfg.passScore) ? 'open' : 'locked');
  const dots = (lv) => `<div class="dots" title="المراحل">${lv.map((_, i) => `<span class="dot ${levelState(lv, i)}"></span>`).join('')}</div>`;
  const passedCount = (lv) => lv.filter((b) => b != null && b >= S.cfg.passScore).length;
  const isActive = () => S.me && S.me.status === 'active';
  const isAdmin = () => isActive() && S.me.role === 'admin';

  // ───────── تثبيت التطبيق (PWA) ─────────
  let deferredInstall = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; document.querySelectorAll('[data-act=install]').forEach((b) => (b.hidden = false)); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; document.querySelectorAll('[data-act=install]').forEach((b) => (b.hidden = true)); toast('تم تثبيت التطبيق ✔'); });
  const installBtn = () => isStandalone() ? '' : `<p><button class="btn sm" data-act="install" ${deferredInstall || isIOS() ? '' : 'hidden'}>📲 تثبيت التطبيق على هاتفك</button></p>`;
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));

  // ───────── الهيكل ─────────
  function shell(body, active) {
    const m = S.me;
    const link = (h, t, k) => `<a href="${h}" class="${active === k ? 'on' : ''}">${t}</a>`;
    let nav = link('#/', 'الرئيسية', 'home');
    if (isActive()) { nav += link('#/hifz', 'الحفظ', 'hifz'); if (S.cfg.leaderboard || isAdmin()) nav += link('#/rank', '🏆 لوحة الشرف', 'rank'); if (isAdmin()) nav += link('#/admin', 'الإدارة', 'admin'); nav += link('#/me', m.name.split(' ')[0], 'me'); }
    else if (m) nav += `<button data-act="logout">خروج</button>`;
    else nav += link('#/login', 'دخول', 'login') + `<a class="cta" href="#/register">إنشاء حساب</a>`;
    $app.innerHTML = `
    <header class="hdr"><div class="wrap">
      <a class="brand" href="#/">${STAR8}<span>رتّل<small>القرآن وعلومه</small></span></a>
      <nav class="nav">${nav}</nav></div></header>
    <main>${body}</main>
    <footer class="ftr"><div class="wrap">
      <div><h4>رتّل</h4><p class="quran" style="margin:0">﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾</p><p class="small">منصة لتعلّم التجويد وعلوم القرآن والفقه والحديث والمعاملات، مع متابعة الحفظ بإشراف المسؤول.</p></div>
      <div><h4>الأقسام</h4>${(S.pub?.sections || []).map((s) => `<a href="${isActive() ? '#/sec/' + s.id : '#/register'}">${esc(s.icon)} ${esc(s.name)}</a>`).join('')}</div>
      <div><h4>روابط</h4><a href="#/">الرئيسية</a>${m ? '<a href="#/me">حسابي</a>' : '<a href="#/login">تسجيل الدخول</a><a href="#/register">إنشاء حساب</a>'}</div>
      <div class="copy">${installBtn()}صُنع بمحبّة للقرآن الكريم — اللهم اجعله ربيع قلوبنا</div></div></footer>`;
    window.scrollTo(0, 0);
  }
  const loading = () => { $app.innerHTML = '<div class="spin">… جارٍ التحميل</div>'; };
  const sectionCard = (s, prog) => {
    const locked = !isActive();
    const href = locked ? (S.me ? '#/pending' : '#/register') : '#/sec/' + s.id;
    let foot = '';
    if (prog) { const pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0; foot = `<div class="bar"><i style="width:${pct}%"></i></div><span>${prog.label}</span>`; }
    else foot = `<span>${s.kind === 'hifz' ? s.topics + ' وحدة للحفظ' : s.topics + ' فروع × 10 مراحل'}</span>`;
    return `<a class="card sec ${esc(s.color)} ${locked ? 'locked' : ''}" href="${href}">
      ${locked ? '<span class="lockbadge">🔒 بعد التفعيل</span>' : ''}<div class="medal">${esc(s.icon)}</div>
      <h3>${esc(s.name)}</h3><p class="desc">${esc(s.desc)}</p><div class="foot">${foot}</div></a>`;
  };

  // ───────── الرئيسية ─────────
  async function viewHome() {
    if (isActive()) { try { S.cat = await api('/catalog'); } catch { } }
    const tipDay = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
    const greet = isActive() ? `<p>مرحبًا بك يا <b>${esc(S.me.name.split(' ')[0])}</b>، واصل رحلتك من حيث توقفت.</p>` : '<p>ابدأ رحلتك مع كتاب الله: قواعد التجويد، علوم القرآن، الفقه، الحديث والمعاملات — اختبارات متدرجة، ومتابعة للحفظ، ولوحة شرف تحفّزك.</p>';
    let cta = '';
    if (!S.me) cta = '<a class="btn" href="#/register">أنشئ حسابك</a><a class="btn ghost" href="#/login">لدي حساب</a>';
    else if (!isActive()) cta = '<a class="btn" href="#/pending">حالة الحساب</a>';
    else cta = '<a class="btn" href="#/sec/tajweed">متابعة التجويد</a><a class="btn ghost" href="#/hifz">متابعة الحفظ</a>';
    const cards = (S.pub?.sections || []).map((s) => {
      let prog = null;
      if (S.cat) {
        const cs = S.cat.sections.find((x) => x.id === s.id);
        if (cs.kind === 'hifz') prog = { done: cs.hifz.done, total: cs.hifz.total, label: `${cs.hifz.done}/${cs.hifz.total} محفوظ` };
        else { const total = cs.topics.length * 10, done = cs.topics.reduce((a, t) => a + passedCount(t.levels), 0); prog = { done, total, label: `${done}/${total} مرحلة` }; }
      }
      return sectionCard(s, prog);
    }).join('');
    shell(`
    <section class="hero"><div class="wrap">
      <div><div class="ayah">﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾</div><h1>رتّل</h1>${greet}<div class="actions">${cta}</div></div>
      <div class="arch">${STAR8}<div class="cap">اقرأ</div></div></div></section>
    <div class="wrap">
      ${S.me && !isActive() ? `<div class="note warn" style="margin-top:-40px;position:relative">${S.me.status === 'blocked' ? 'تم إيقاف حسابك. تواصل مع المسؤول.' : 'حسابك في انتظار التفعيل من المسؤول.'}</div>` : ''}
      <div class="section-title"><svg class="ornament" viewBox="0 0 64 64"><g fill="#c8962e"><rect x="14" y="14" width="36" height="36"/><rect x="14" y="14" width="36" height="36" transform="rotate(45 32 32)"/></g></svg><h2>بطائق التعلّم</h2></div>
      <div class="cards">${cards}</div>
      <div class="section-title"><svg class="ornament" viewBox="0 0 64 64"><g fill="#c8962e"><rect x="14" y="14" width="36" height="36"/><rect x="14" y="14" width="36" height="36" transform="rotate(45 32 32)"/></g></svg><h2>كيف تعمل المنصة؟</h2></div>
      <div class="steps">
        <div class="step"><b>أنشئ حسابك</b><p class="small muted" style="margin:.3em 0 0">بالاسم ورقم الهاتف وكلمة سر فقط، ثم ينتظر المسؤول ليفعّل حسابك.</p></div>
        <div class="step"><b>افتح بطائقك</b><p class="small muted" style="margin:.3em 0 0">كل قسم فيه فروع، وكل فرع فيه عشر مراحل، وكل مرحلة عشرة أسئلة متنوعة.</p></div>
        <div class="step"><b>اجتز المرحلة</b><p class="small muted" style="margin:.3em 0 0">حقّق ${S.cfg.passScore} من 10 لتفتح المرحلة التالية، وتزداد الصعوبة تدريجيًا.</p></div>
        <div class="step"><b>تابع حفظك</b><p class="small muted" style="margin:.3em 0 0">يحدّد المسؤول حالة محفوظك: لم يبدأ، قيد الحفظ، أو محفوظ.</p></div>
      </div>
      <div class="section-title"><svg class="ornament" viewBox="0 0 64 64"><g fill="#c8962e"><rect x="14" y="14" width="36" height="36"/><rect x="14" y="14" width="36" height="36" transform="rotate(45 32 32)"/></g></svg><h2>نصائح</h2></div>
      <div class="tips"><div class="tip today"><b>نصيحة اليوم · ${esc(tipDay[0])}</b>${esc(tipDay[1])}</div>${TIPS.filter((t) => t !== tipDay).slice(0, 3).map((t) => `<div class="tip"><b>${esc(t[0])}</b>${esc(t[1])}</div>`).join('')}</div>
    </div>`, 'home');
  }

  // ───────── الدخول والتسجيل ─────────
  function viewAuth(mode) {
    const reg = mode === 'register';
    shell(`<div class="wrap"><div class="auth">
      <div class="top"><h2>${reg ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2><div class="small">${reg ? 'الاسم ورقم الهاتف فقط' : 'أهلًا بعودتك'}</div></div>
      <div class="tabs"><a href="#/login" class="${reg ? '' : 'on'}">دخول</a><a href="#/register" class="${reg ? 'on' : ''}">حساب جديد</a></div>
      <form class="f" id="authf" autocomplete="on">
        ${reg ? '<label class="l">الاسم الكامل<input class="i" name="name" required minlength="3" maxlength="60" autocomplete="name"></label>' : ''}
        <label class="l">رقم الهاتف<input class="i" name="phone" inputmode="tel" dir="ltr" required placeholder="06XXXXXXXX" autocomplete="tel"></label>
        <label class="l">كلمة السر<input class="i" type="password" name="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
        ${reg ? '<label class="l">تأكيد كلمة السر<input class="i" type="password" name="password2" required minlength="6" autocomplete="new-password"></label>' : ''}
        <div class="err" id="err" hidden></div>
        <button class="btn green block" type="submit">${reg ? 'إنشاء الحساب' : 'دخول'}</button>
        ${reg ? '' : '<p class="small muted center" style="margin:0">نسيت كلمة السر؟ تواصل مع المسؤول ليعطيك كلمة سر جديدة.</p>'}
      </form></div></div>`, reg ? 'register' : 'login');
    document.getElementById('authf').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const err = document.getElementById('err'); err.hidden = true;
      try {
        if (reg) { await api('/register', { method: 'POST', body: f }); try { await api('/login', { method: 'POST', body: { phone: f.phone, password: f.password } }); await loadMe(); } catch { } go('#/pending'); }
        else { await api('/login', { method: 'POST', body: f }); await loadMe(); go(isActive() ? '#/' : '#/pending'); }
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    };
  }
  function viewPending() {
    const blocked = S.me?.status === 'blocked';
    shell(`<div class="wrap"><div class="auth"><div class="top"><h2>${blocked ? 'الحساب موقوف' : 'تم إنشاء الحساب'}</h2></div><div class="pend">
      <div class="big">${blocked ? '⛔' : '⏳'}</div>
      <p class="quran" style="margin:.2em 0">${blocked ? 'تواصل مع المسؤول لمعرفة السبب.' : 'انتظر التأكيد أو تواصل مع المسؤول من أجل تفعيل حسابكم.'}</p>
      ${S.me ? '<button class="btn green" data-act="recheck">تحقّق من التفعيل</button> <button class="btn ghost" style="color:var(--g7)" data-act="logout">خروج</button>' : '<a class="btn green" href="#/login">تسجيل الدخول</a>'}
    </div></div></div>`, '');
  }

  // ───────── الأقسام والفروع ─────────
  async function viewSection(id) {
    if (!isActive()) return go('#/login');
    loading(); S.cat = await api('/catalog');
    const s = S.cat.sections.find((x) => x.id === id); if (!s) return go('#/');
    if (s.kind === 'hifz') return go('#/hifz');
    let body = '';
    const card = (t) => `<a class="card topic sec ${esc(s.color)}" style="padding:16px;padding-top:16px" href="#/topic/${esc(t.id)}"><div class="row"><div class="ic">${esc(t.icon || s.icon)}</div><div><h4>${esc(t.name)}</h4><span class="small muted">${passedCount(t.levels)}/10 مراحل</span></div></div>${dots(t.levels)}</a>`;
    if (s.topics.some((t) => t.stage)) {
      const groups = []; for (const t of s.topics) { let g = groups[groups.length - 1]; if (!g || g.stage !== t.stage) groups.push(g = { stage: t.stage, sub: t.stageSub, items: [] }); g.items.push(t); }
      body = groups.map((g, i) => `<div class="stage"><h3>المرحلة ${['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'][i]} · ${esc(g.stage)}</h3><span>${esc(g.sub || '')}</span></div><div class="topics">${g.items.map(card).join('')}</div>`).join('');
    } else body = `<div class="topics" style="margin-top:20px">${s.topics.map(card).join('')}</div>`;
    const total = s.topics.length * 10, done = s.topics.reduce((a, t) => a + passedCount(t.levels), 0);
    shell(`<div class="wrap page"><div class="crumbs"><a href="#/">الرئيسية</a> ‹ <span>${esc(s.name)}</span></div>
      <div class="sec ${esc(s.color)}" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">${esc(s.icon)} ${esc(s.name)}</h2><div class="bar" style="min-width:160px"><i style="width:${Math.round(done / total * 100)}%"></i></div><b>${done}/${total}</b></div>
      <p class="muted">${esc(s.desc)}</p>${body}</div>`, '');
  }

  async function viewTopic(id) {
    if (!isActive()) return go('#/login');
    loading(); const t = await api('/topic/' + encodeURIComponent(id));
    const sec = (S.cat || (S.cat = await api('/catalog'))).sections.find((x) => x.id === t.section);
    const lvTiles = t.levels.map((b, i) => {
      const st = isAdmin() ? (b != null ? levelState(t.levels, i) : 'open') : levelState(t.levels, i);
      const cls = st === 'locked' ? 'locked' : st === 'open' ? 'open' : 'done';
      const inner = `<div class="star8">${st === 'locked' ? '🔒' : i + 1}</div><b>${esc(t.levelTitles[i])}</b><div class="stars">${b != null ? stars(starsOf(b)) : '<span class="off">★★★</span>'}</div><div class="sc">${b != null ? b + ' / 10' : (st === 'locked' ? 'مقفلة' : 'جديدة')}</div>`;
      return st === 'locked' ? `<div class="lv locked">${inner}</div>` : `<a class="lv ${cls}" href="#/quiz/${esc(id)}/${i + 1}">${inner}</a>`;
    }).join('');
    shell(`<div class="wrap page"><div class="crumbs"><a href="#/">الرئيسية</a> ‹ <a href="#/sec/${esc(t.section)}">${esc(sec?.name || '')}</a> ‹ <span>${esc(t.name)}</span></div>
      <h2>${esc(t.icon || '')} ${esc(t.name)}</h2>
      <details class="lesson" open><summary>📚 الدرس — اقرأه قبل الاختبار</summary><ul>${t.lesson.map((l) => `<li class="quran" style="font-size:21px;line-height:1.9">${esc(l)}</li>`).join('')}</ul></details>
      <div class="section-title"><h2>المراحل العشر</h2></div>
      <p class="muted">تجتاز كل مرحلة بتحقيق ${t.passScore} من 10 فما فوق، فتُفتح المرحلة التالية وتزداد الصعوبة.</p>
      <div class="levels">${lvTiles}</div></div>`, '');
  }

  // ───────── الاختبار ─────────
  let Q = null;
  async function viewQuiz(topic, level) {
    if (!isActive()) return go('#/login');
    loading();
    try { const d = await api(`/quiz/${encodeURIComponent(topic)}/${level}`); Q = { ...d, topicId: topic, i: 0, ans: d.questions.map(() => null), tmp: null }; }
    catch (e) { toast(e.message); return go('#/topic/' + topic); }
    renderQ();
  }
  function ready(q, a) {
    if (a == null) return false;
    if (q.type === 'fill') return a.every((x) => x); if (q.type === 'order' || q.type === 'word') return a.length === q.words.length;
    if (q.type === 'match') return a.every((x) => x !== null && x !== '') && new Set(a).size === a.length;
    return true;
  }
  function renderQ() {
    const q = Q.questions[Q.i]; let a = Q.ans[Q.i];
    if (a == null) { if (q.type === 'fill') a = q.tokens.filter((t) => t.blank).map(() => null); else if (q.type === 'order' || q.type === 'word') a = []; else if (q.type === 'match') a = q.left.map(() => null); }
    Q.ans[Q.i] = a;
    const verse = q.ay ? `<div class="verse"><div class="quran">${esc(q.ay.v).replace(esc(q.ay.hl), `<mark>${esc(q.ay.hl)}</mark>`)}</div>${q.ay.ref ? `<small>سورة ${esc(q.ay.ref)}</small>` : ''}</div>` : '';
    const claim = q.claim ? `<div class="claim">${q.type === 'tf' ? 'الإجابة المقترحة: ' : ''}«${esc(q.claim)}»</div>` : '';
    let body = '';
    if (['mcq', 'rev', 'tf'].includes(q.type)) body = `<div class="opts ${q.type === 'tf' ? 'tf' : ''}">${q.options.map((o, k) => `<button class="opt ${a === k ? 'sel' : ''}" data-act="pick" data-k="${k}"><i>${q.type === 'tf' ? (k ? '✗' : '✓') : 'أبجد'[k] || k + 1}</i><span>${esc(o)}</span></button>`).join('')}</div>`;
    else if (q.type === 'fill') {
      let bi = 0;
      const sent = q.tokens.map((t) => t.blank ? `${esc(t.pre)}<span class="slot ${a[bi] ? 'filled' : ''}" data-act="unfill" data-b="${bi}">${a[bi++] ? esc(a[bi - 1]) : ''}</span>${esc(t.post)}` : esc(t.text)).join(' ');
      const usedCount = {}; a.forEach((w) => w && (usedCount[w] = (usedCount[w] || 0) + 1));
      const seen = {};
      body = `<div class="sentence">${sent}</div><div class="chips">${q.bank.map((w, k) => { seen[w] = (seen[w] || 0) + 1; const used = seen[w] <= (usedCount[w] || 0); return `<button class="chip ${used ? 'used' : ''}" data-act="bank" data-k="${k}">${esc(w)}</button>`; }).join('')}</div>`;
    } else if (q.type === 'order' || q.type === 'word') {
      const sep = q.join === '' ? '' : ' ';
      body = `${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}<div class="tray" style="${q.join === '' ? 'direction:rtl' : ''}">${a.map((k, p) => `<button class="chip" data-act="untray" data-p="${p}">${esc(q.words[k])}</button>`).join('') || '<span class="muted small" style="padding:8px">اضغط على الكلمات بالترتيب الصحيح</span>'}</div>
      <div class="chips">${q.words.map((w, k) => `<button class="chip ${a.includes(k) ? 'used' : ''}" data-act="totray" data-k="${k}">${esc(w)}</button>`).join('')}</div>`;
    } else if (q.type === 'match') {
      body = `<div class="match">${q.left.map((l, k) => `<div class="m"><div>${esc(l)}</div><select class="i" data-act="match" data-k="${k}"><option value="">— اختر —</option>${q.right.map((r, j) => `<option value="${j}" ${a[k] === j ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>`).join('')}</div>`;
    }
    const last = Q.i === Q.questions.length - 1;
    shell(`<div class="wrap"><div class="quiz">
      <div class="crumbs"><a href="#/topic/${esc(Q.topicId)}">‹ ${esc(Q.topic.name)}</a> · المرحلة ${Q.level} — ${esc(Q.title)}</div>
      <div class="qhead"><div class="prog">${Q.questions.map((_, k) => `<i class="${k === Q.i ? 'cur' : ready(Q.questions[k], Q.ans[k]) ? 'on' : ''}"></i>`).join('')}</div><b>${Q.i + 1}/${Q.questions.length}</b></div>
      <div class="qcard"><span class="qtype">${TYPE_LABEL[q.type]}</span><div class="qtext">${esc(q.prompt)}</div>${verse}${claim}${body}</div>
      <div class="qnav"><button class="btn ghost" style="color:var(--g7)" data-act="prev" ${Q.i === 0 ? 'disabled' : ''}>السابق</button>
      <button class="btn ${last ? 'green' : ''}" data-act="${last ? 'finish' : 'next'}" ${ready(q, a) ? '' : 'disabled'}>${last ? 'إنهاء وتسليم' : 'التالي'}</button></div>
    </div></div>`, '');
    window.scrollTo(0, 0);
  }
  async function finishQuiz() {
    const missing = Q.questions.findIndex((q, k) => !ready(q, Q.ans[k]));
    if (missing >= 0) { Q.i = missing; toast('أجب عن كل الأسئلة أولًا'); return renderQ(); }
    const answers = Q.questions.map((q, k) => { const a = Q.ans[k]; if (q.type === 'fill') return a; if (q.type === 'order' || q.type === 'word') return a.map((i) => q.words[i]); return a; });
    loading();
    try {
      const r = await api(`/quiz/${encodeURIComponent(Q.topicId)}/${Q.level}/submit`, { method: 'POST', body: { seed: Q.seed, sig: Q.sig, answers } });
      S.cat = null; renderResult(r);
    } catch (e) { toast(e.message); go('#/topic/' + Q.topicId); }
  }
  function renderResult(r) {
    const wrong = r.review.map((x, i) => ({ ...x, n: i + 1 })).filter((x) => !x.ok);
    shell(`<div class="wrap"><div class="result"><div class="qcard">
      <div class="bigstars">${stars(r.stars)}</div><div class="score">${r.score}<span style="font-size:28px;color:var(--muted)"> / ${r.total}</span></div>
      <h2 style="margin-top:8px">${r.passed ? (r.stars === 3 ? 'ما شاء الله! علامة كاملة' : 'أحسنت! اجتزت المرحلة') : 'لم تجتز المرحلة بعد'}</h2>
      <p class="muted">${r.passed ? (r.hasNext ? 'فُتحت لك المرحلة التالية.' : 'أتممت مراحل هذا الفرع كلها 🎉') : `تحتاج ${S.cfg.passScore} من 10 على الأقل. راجع الدرس وأعد المحاولة.`}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0">
        ${r.passed && r.hasNext ? `<a class="btn" href="#/quiz/${esc(Q.topicId)}/${Q.level + 1}">المرحلة التالية ←</a>` : ''}
        <a class="btn ${r.passed && r.hasNext ? 'green' : ''}" href="#/quiz/${esc(Q.topicId)}/${Q.level}">أعد المحاولة</a>
        <a class="btn ghost" style="color:var(--g7)" href="#/topic/${esc(Q.topicId)}">مراحل الفرع</a></div>
      ${wrong.length ? `<h3 style="text-align:start;margin-top:18px">مراجعة الأخطاء</h3><div class="rev">${wrong.map((w) => `<div class="it"><div>${w.n}. ${esc(w.prompt)}${w.claim ? ` <span class="muted">«${esc(w.claim)}»</span>` : ''}</div><div style="white-space:pre-line"><b>✔ ${esc(w.correct)}</b></div></div>`).join('')}</div>` : ''}
    </div></div></div>`, '');
    if (r.passed) confetti();
  }
  function confetti() {
    const d = document.createElement('div'); d.className = 'confetti'; const cols = ['#c8962e', '#e8c874', '#1f8f6d', '#b4532a', '#1d4e89'];
    d.innerHTML = Array.from({ length: 46 }, () => `<i style="left:${Math.random() * 100}%;background:${cols[Math.random() * 5 | 0]};animation-delay:${Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
    document.body.appendChild(d); setTimeout(() => d.remove(), 4500);
  }

  // ───────── الحفظ ─────────
  const GRP = { book: ['📖 وحدات كتاب «سور وآيات فاضلات»', 'بترتيب الكتاب'], full: ['🕌 القرآن الكريم كاملًا', 'باقي السور بترتيب المصحف'] };
  function hifzRows(items, right) {
    let last = '', out = '';
    for (const i of items) {
      if (i.grp !== last) { last = i.grp; out += `<div class="stage" style="margin:18px 0 4px"><h3>${GRP[i.grp][0]}</h3><span>${GRP[i.grp][1]}</span></div>`; }
      out += `<div class="hi s${i.status}"><div class="no">${i.ord}</div><div class="nm">${esc(i.name)}<small>${i.n ? i.n + ' آية' : 'مقاطع مختارة'}${i.page ? ' · ص ' + i.page : ''}</small></div>${right(i)}</div>`;
    }
    return out;
  }
  let hFilter = 'all';
  async function viewHifz() {
    if (!isActive()) return go('#/login');
    loading(); const d = await api('/hifz'); const items = d.items;
    const c = [0, 0, 0]; items.forEach((i) => c[i.status]++);
    const shown = items.filter((i) => hFilter === 'all' || String(i.status) === hFilter);
    shell(`<div class="wrap page"><div class="crumbs"><a href="#/">الرئيسية</a> ‹ <span>الحفظ</span></div>
      <h2>🕯️ سور وآيات فاضلات</h2><p class="muted">${isAdmin() ? 'بصفتك مشرفًا، تحدّد حالة حفظك بنفسك من القائمة.' : 'المسؤول هو من يحدّد حالة حفظك لكل وحدة. تابع تقدّمك هنا.'}</p>
      <div class="summary"><div class="stat"><b>${c[2]}</b><span>محفوظ</span></div><div class="stat"><b>${c[1]}</b><span>قيد الحفظ</span></div><div class="stat"><b>${c[0]}</b><span>لم يبدأ</span></div>
      <div class="stat"><b>${Math.round(c[2] / items.length * 100)}%</b><span>نسبة الإنجاز</span></div></div>
      <div class="bar" style="margin-bottom:18px;height:14px"><i style="width:${Math.round(c[2] / items.length * 100)}%"></i></div>
      <div class="filters">${[['all', 'الكل'], ['2', 'محفوظ'], ['1', 'قيد الحفظ'], ['0', 'لم يبدأ']].map(([k, t]) => `<button class="fl ${hFilter === k ? 'on' : ''}" data-act="hfilter" data-k="${k}">${t}</button>`).join('')}</div>
      <div class="hlist">${hifzRows(shown, (i) => isAdmin() ? `<select class="mini" data-act="hset" data-uid="${S.me.id}" data-key="${esc(i.key)}">${[0, 1, 2].map((v) => `<option value="${v}" ${i.status === v ? 'selected' : ''}>${STATUS[v]}</option>`).join('')}</select>` : `<span class="badge s${i.status}">${i.status === 2 ? '✓ ' : ''}${STATUS[i.status]}</span>`) || '<p class="muted center">لا توجد وحدات في هذا التصنيف.</p>'}</div></div>`, 'hifz');
  }

  // ───────── لوحة الشرف ─────────
  let rScope = { scope: 'all', id: '' };
  async function viewRank(adminMode) {
    if (!isActive()) return go('#/login');
    loading();
    let d;
    try { d = await api(`${adminMode ? '/admin' : ''}/leaderboard?scope=${rScope.scope}&id=${encodeURIComponent(rScope.id)}`); }
    catch (e) { return shell(`<div class="wrap page"><div class="note warn">${esc(e.message)}</div></div>`, 'rank'); }
    const opts = [['all|', 'الترتيب العام'], ['hifz|', '🕯️ الحفظ']];
    d.scopes.sections.filter((s) => s.kind !== 'hifz').forEach((s) => { opts.push(['section|' + s.id, '📂 ' + s.name]); s.topics.forEach((t) => opts.push(['topic|' + t.id, '   ‹ ' + t.name])); });
    const sel = `<select class="i" id="rsel" style="max-width:360px">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === rScope.scope + '|' + rScope.id ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const medal = ['🥇', '🥈', '🥉'];
    const top = d.rows.filter((r) => r.rank <= 3).slice(0, 3);
    const podium = top.length ? `<div class="podium">${top.map((r, i) => `<div class="pod p${r.rank} ${r.me ? 'me' : ''}"><div class="m">${medal[r.rank - 1]}</div><b>${esc(r.name)}</b><div class="muted small">${r.score} ${r.unit}</div></div>`).join('')}</div>` : '';
    shell(`<div class="wrap page">${adminMode ? '' : '<div class="crumbs"><a href="#/">الرئيسية</a> ‹ <span>لوحة الشرف</span></div>'}
      <h2>🏆 لوحة الشرف</h2><div class="toolbar">${sel}${d.me ? `<span class="badge s2">ترتيبك: ${d.me}</span>` : ''}</div>
      ${d.rows.length ? podium + `<table class="rtable">${d.rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td>${r.rank <= 3 ? medal[r.rank - 1] : r.rank}</td><td>${esc(r.name)} ${r.me ? '<span class="small muted">(أنت)</span>' : ''}<div class="small muted">${esc(r.sub || '')}</div></td><td>${r.score} <span class="small muted">${r.unit}</span></td></tr>`).join('')}</table>` : '<div class="note">لا توجد نتائج بعد.</div>'}</div>`, adminMode ? 'admin' : 'rank');
    document.getElementById('rsel').onchange = (e) => { const [sc, id] = e.target.value.split('|'); rScope = { scope: sc, id }; adminMode ? viewAdmin('rank') : viewRank(false); };
  }

  // ───────── حسابي ─────────
  async function viewMe() {
    if (!S.me) return go('#/login');
    if (!isActive()) return go('#/pending');
    loading(); S.cat = await api('/catalog');
    const tot = S.cat.sections.filter((s) => s.kind !== 'hifz').reduce((a, s) => a + s.topics.reduce((b, t) => b + passedCount(t.levels), 0), 0);
    const pts = S.cat.sections.reduce((a, s) => a + s.topics.reduce((b, t) => b + t.levels.reduce((x, v) => x + (v || 0), 0), 0), 0);
    const hz = S.cat.sections.find((s) => s.kind === 'hifz').hifz;
    shell(`<div class="wrap page"><h2>حسابي</h2><div class="summary"><div class="stat"><b>${pts}</b><span>نقطة</span></div><div class="stat"><b>${tot}</b><span>مرحلة مجتازة</span></div><div class="stat"><b>${hz.done}/${hz.total}</b><span>محفوظ</span></div></div>
      <div class="card" style="max-width:520px"><p><b>${esc(S.me.name)}</b><br><span dir="ltr" class="muted">${esc(S.me.phone)}</span></p>
      <h3>بياناتي</h3><form class="f" style="padding:0;margin-bottom:18px" id="prof">
        <label class="l">الاسم<input class="i" name="name" value="${esc(S.me.name)}" required minlength="3" maxlength="60"></label>
        <label class="l">رقم الهاتف<input class="i" name="phone" dir="ltr" inputmode="tel" value="${esc(S.me.phone)}" required></label>
        <label class="l">كلمة السر الحالية <span class="muted small">(مطلوبة فقط عند تغيير الهاتف)</span><input class="i" type="password" name="current" autocomplete="current-password"></label>
        <div class="err" id="perr" hidden></div><button class="btn green" type="submit">حفظ البيانات</button></form>
      <h3>تغيير كلمة السر</h3><form class="f" style="padding:0" id="pwf"><input class="i" type="password" name="current" placeholder="كلمة السر الحالية" required autocomplete="current-password"><input class="i" type="password" name="password" placeholder="كلمة السر الجديدة" minlength="6" required autocomplete="new-password"><input class="i" type="password" name="password2" placeholder="تأكيد كلمة السر الجديدة" required autocomplete="new-password"><div class="err" id="err" hidden></div><button class="btn green" type="submit">حفظ</button></form>
      <hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><button class="btn ghost" style="color:var(--g7)" data-act="logout">تسجيل الخروج</button>
      ${S.me.role === 'admin' ? '' : `<details style="margin-top:22px"><summary style="color:var(--bad);cursor:pointer;font-weight:700">حذف حسابي نهائيًا</summary><p class="muted small">سيُحذف حسابك وكل تقدّمك وحالة حفظك، ولا يمكن التراجع.</p><input class="i" type="password" id="delpw" placeholder="أدخل كلمة السر للتأكيد" autocomplete="current-password" style="margin-bottom:10px"><button class="btn danger" data-act="delme">حذف حسابي</button></details>`}</div></div>`, 'me');
    document.getElementById('prof').onsubmit = async (e) => {
      e.preventDefault(); const err = document.getElementById('perr'); err.hidden = true;
      try { const r = await api('/me/profile', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); S.me = r.user; toast('تم حفظ بياناتك ✔'); viewMe(); }
      catch (x) { err.textContent = x.message; err.hidden = false; }
    };
    document.getElementById('pwf').onsubmit = async (e) => { e.preventDefault(); const err = document.getElementById('err'); err.hidden = true; try { await api('/me/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('تم تغيير كلمة السر ✔'); } catch (x) { err.textContent = x.message; err.hidden = false; } };
  }

  // ───────── الإدارة ─────────
  let aUsers = [], aTotal = 1, aFilter = { q: '', st: 'all' };
  async function viewAdmin(tab = 'users') {
    if (!isAdmin()) return go('#/');
    const tabs = `<div class="atabs">${[['users', '👥 المستخدمون'], ['rank', '🏆 الترتيب'], ['settings', '⚙️ الإعدادات']].map(([k, t]) => `<a class="fl ${tab === k ? 'on' : ''}" href="#/admin/${k}">${t}</a>`).join('')}</div>`;
    if (tab === 'rank') { await viewRank(true); const w = document.querySelector('.page'); if (w) w.insertAdjacentHTML('afterbegin', tabs); return; }
    loading();
    if (tab === 'settings') {
      const st = await api('/admin/settings');
      shell(`<div class="wrap page"><h2>الإدارة</h2>${tabs}<div class="switch"><button class="tog ${st.leaderboard_public ? 'on' : ''}" data-act="togLb" aria-label="تبديل"></button><div><b>إظهار لوحة الشرف للمستخدمين</b><div class="muted small">عند التعطيل تبقى لوحة الشرف ظاهرة لك أنت فقط (تُعرض الأسماء بدون أرقام الهواتف).</div></div></div></div>`, 'admin');
      return;
    }
    const d = await api('/admin/users'); aUsers = d.users; aTotal = d.totalLevels;
    shell(`<div class="wrap page"><h2>الإدارة</h2>${tabs}<div id="ulist"></div></div>`, 'admin');
    paintUsers();
  }
  function paintUsers() {
    const pend = aUsers.filter((u) => u.status === 'pending').length;
    const list = aUsers.filter((u) => (aFilter.st === 'all' || u.status === aFilter.st) && (!aFilter.q || (u.name + ' ' + u.phone).toLowerCase().includes(aFilter.q.toLowerCase())));
    const stl = { active: 'مفعّل', pending: 'بانتظار التفعيل', blocked: 'موقوف' };
    document.getElementById('ulist').innerHTML = `
      ${pend ? `<div class="note warn" style="margin-bottom:12px">يوجد <b>${pend}</b> حساب بانتظار التفعيل.</div>` : ''}
      <div class="toolbar"><input class="i" id="uq" placeholder="بحث بالاسم أو الهاتف" value="${esc(aFilter.q)}"><select class="i" id="ust" style="max-width:180px">${[['all', 'كل الحالات'], ['pending', 'بانتظار التفعيل'], ['active', 'مفعّل'], ['blocked', 'موقوف']].map(([v, t]) => `<option value="${v}" ${aFilter.st === v ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="muted">${list.length} مستخدم</span></div>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>النقاط</th><th>المراحل</th><th>الحفظ</th><th>التسجيل</th><th>إجراءات</th></tr></thead><tbody>
      ${list.map((u) => `<tr><td><a href="#/admin/user/${u.id}"><b>${esc(u.name)}</b></a></td><td dir="ltr">${esc(u.phone)}</td><td><span class="st ${u.status}">${stl[u.status]}</span></td><td>${u.points}</td><td>${u.levels}/${aTotal}</td><td>${u.hifzDone}${u.hifzDoing ? ` <span class="muted small">(+${u.hifzDoing})</span>` : ''}</td><td class="small">${fmtDate(u.createdAt)}</td>
      <td><div class="acts">${u.status !== 'active' ? `<button class="btn green sm" data-act="ustatus" data-id="${u.id}" data-v="active">تفعيل</button>` : `<button class="btn sm" data-act="ustatus" data-id="${u.id}" data-v="blocked">إيقاف</button>`}<a class="btn sm" href="#/admin/user/${u.id}">التفاصيل</a><button class="btn sm" data-act="uedit" data-id="${u.id}">تعديل</button><button class="btn sm" data-act="upw" data-id="${u.id}">كلمة سر جديدة</button><button class="btn danger sm" data-act="udel" data-id="${u.id}">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="8" class="center muted">لا يوجد مستخدمون.</td></tr>'}
      </tbody></table></div>`;
    document.getElementById('uq').oninput = (e) => { aFilter.q = e.target.value; const pos = e.target.selectionStart; paintUsers(); const i = document.getElementById('uq'); i.focus(); i.setSelectionRange(pos, pos); };
    document.getElementById('ust').onchange = (e) => { aFilter.st = e.target.value; paintUsers(); };
  }
  async function viewAdminUser(id) {
    if (!isAdmin()) return go('#/');
    loading(); const d = await api('/admin/users/' + id); const u = d.user;
    const secs = d.sections.map((s) => `<div class="section-title"><h2 style="font-size:24px">${esc(s.icon)} ${esc(s.name)}</h2></div>
      <div class="tbl-wrap"><table class="t sectbl"><thead><tr><th>الفرع</th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<th>${n}</th>`).join('')}<th>الناجح</th></tr></thead><tbody>
      ${s.topics.map((t) => `<tr><td>${esc(t.name)}${t.stage ? ` <span class="muted small">(${esc(t.stage)})</span>` : ''}</td>${t.levels.map((b) => `<td class="d">${b == null ? '<span class="muted">·</span>' : `<span class="st ${b >= d.passScore ? 'active' : 'blocked'}">${b}</span>`}</td>`).join('')}<td><b>${passedCount(t.levels)}/10</b></td></tr>`).join('')}</tbody></table></div>`).join('');
    const opt = (cur) => [0, 1, 2].map((v) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${STATUS[v]}</option>`).join('');
    shell(`<div class="wrap page"><div class="crumbs"><a href="#/admin/users">الإدارة</a> ‹ <span>${esc(u.name)}</span></div>
      <h2>${esc(u.name)} <span class="st ${u.status}">${{ active: 'مفعّل', pending: 'بانتظار التفعيل', blocked: 'موقوف' }[u.status]}</span></h2>
      <p class="muted" dir="ltr" style="text-align:end">${esc(u.phone)}</p>
      <p><button class="btn sm" data-act="uedit2" data-id="${u.id}">✏️ تعديل الاسم / الهاتف</button> <button class="btn sm" data-act="upw" data-id="${u.id}">كلمة سر جديدة</button></p>
      <div class="summary"><div class="stat"><b>${u.points}</b><span>نقطة</span></div><div class="stat"><b>${u.levels}</b><span>مرحلة مجتازة</span></div><div class="stat"><b>${u.hifzDone}</b><span>محفوظ</span></div><div class="stat"><b>${u.hifzDoing}</b><span>قيد الحفظ</span></div><div class="stat"><b style="font-size:20px;line-height:2">${fmtDate(u.lastLogin)}</b><span>آخر دخول</span></div></div>
      ${secs}
      <div class="section-title"><h2 style="font-size:24px">🕯️ متابعة الحفظ</h2></div>
      <div class="toolbar"><span>تعيين الكل إلى:</span><select class="mini" id="hall">${opt(-1)}<option value="" selected>—</option></select></div>
      <div class="hlist">${hifzRows(d.hifz, (i) => `<select class="mini" data-act="hset" data-uid="${u.id}" data-key="${esc(i.key)}">${opt(i.status)}</select>`)}</div></div>`, 'admin');
    const all = document.getElementById('hall');
    all.onchange = async (e) => { if (e.target.value === '') return; await api(`/admin/users/${u.id}/hifz`, { method: 'POST', body: { keys: d.hifz.map((i) => i.key), status: Number(e.target.value) } }); toast('تم التحديث ✔'); viewAdminUser(id); };
  }

  // ───────── الأحداث ─────────
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return; const act = el.dataset.act;
    try {
      if (act === 'logout') { await api('/logout', { method: 'POST', body: {} }); S.me = null; S.cat = null; go('#/'); }
      else if (act === 'recheck') { await loadMe(); go(isActive() ? '#/' : '#/pending'); if (!isActive()) toast('لم يُفعَّل حسابك بعد'); }
      else if (act === 'pick') { Q.ans[Q.i] = Number(el.dataset.k); renderQ(); }
      else if (act === 'next') { Q.i++; renderQ(); } else if (act === 'prev') { Q.i--; renderQ(); } else if (act === 'finish') finishQuiz();
      else if (act === 'bank') { const q = Q.questions[Q.i], a = Q.ans[Q.i], p = a.indexOf(null); if (p >= 0) { a[p] = q.bank[Number(el.dataset.k)]; renderQ(); } }
      else if (act === 'unfill') { Q.ans[Q.i][Number(el.dataset.b)] = null; renderQ(); }
      else if (act === 'totray') { Q.ans[Q.i].push(Number(el.dataset.k)); renderQ(); }
      else if (act === 'untray') { Q.ans[Q.i].splice(Number(el.dataset.p), 1); renderQ(); }
      else if (act === 'hfilter') { hFilter = el.dataset.k; viewHifz(); }
      else if (act === 'togLb') { const on = !el.classList.contains('on'); await api('/admin/settings', { method: 'POST', body: { leaderboard_public: on } }); el.classList.toggle('on', on); S.cfg.leaderboard = on; toast(on ? 'لوحة الشرف ظاهرة للمستخدمين' : 'لوحة الشرف مخفية عن المستخدمين'); }
      else if (act === 'ustatus') { await api(`/admin/users/${el.dataset.id}/status`, { method: 'POST', body: { status: el.dataset.v } }); const u = aUsers.find((x) => x.id == el.dataset.id); u.status = el.dataset.v; paintUsers(); toast('تم ✔'); }
      else if (act === 'upw') { const r = await api(`/admin/users/${el.dataset.id}/password`, { method: 'POST', body: {} }); modal(`<h3>كلمة سر جديدة</h3><p class="muted">سلّمها للمستخدم، ولن تظهر مرة أخرى:</p><div class="pwbox">${esc(r.password)}</div><p class="center"><button class="btn green" data-act="close">تم</button></p>`); }
      else if (act === 'uedit') { const u = aUsers.find((x) => x.id == el.dataset.id); editModal(u, (f) => { u.name = f.name; u.phone = f.phone.replace(/\D/g, ''); paintUsers(); viewAdmin('users'); }); }
      else if (act === 'uedit2') { const d = await api('/admin/users/' + el.dataset.id); editModal(d.user, () => viewAdminUser(el.dataset.id)); }
      else if (act === 'delme') {
        const pw = document.getElementById('delpw').value; if (!pw) return toast('أدخل كلمة السر');
        if (!confirm('سيُحذف حسابك وكل تقدّمك نهائيًا ولا يمكن التراجع. متأكد؟')) return;
        await api('/me/delete', { method: 'POST', body: { password: pw } }); S.me = null; S.cat = null; toast('تم حذف حسابك'); go('#/');
      }
      else if (act === 'udel') { if (confirm('حذف هذا المستخدم وكل تقدّمه نهائيًا؟')) { await api('/admin/users/' + el.dataset.id, { method: 'DELETE' }); aUsers = aUsers.filter((x) => x.id != el.dataset.id); paintUsers(); toast('تم الحذف'); } }
      else if (act === 'install') {
        if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; }
        else if (isIOS()) modal('<h3>تثبيت رتّل على الآيفون</h3><p>1) افتح الموقع في <b>Safari</b>.<br>2) اضغط زر المشاركة <b>⬆︎</b> في الأسفل.<br>3) اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</p><p class="center"><button class="btn green" data-act="close">حسنًا</button></p>');
      }
      else if (act === 'close') document.querySelector('.modal')?.remove();
    } catch (x) { toast(x.message); if (x.status === 401) { S.me = null; go('#/login'); } }
  });
  document.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'match') { const a = Q.ans[Q.i]; a[Number(el.dataset.k)] = el.value === '' ? null : Number(el.value); renderQ(); }
    if (el.dataset.act === 'hset') { try { await api(`/admin/users/${el.dataset.uid}/hifz`, { method: 'POST', body: { key: el.dataset.key, status: Number(el.value) } }); el.closest('.hi').className = 'hi s' + el.value; toast('تم الحفظ ✔'); if (location.hash === '#/hifz') setTimeout(viewHifz, 400); } catch (x) { toast(x.message); } }
  });
  function editModal(u, done) {
    modal(`<h3>تعديل بيانات المستخدم</h3><form class="f" style="padding:0" id="editf">
      <label class="l">الاسم<input class="i" name="name" value="${esc(u.name)}" required minlength="3" maxlength="60"></label>
      <label class="l">رقم الهاتف<input class="i" name="phone" dir="ltr" inputmode="tel" value="${esc(u.phone)}" required></label>
      <div class="err" id="eerr" hidden></div>
      <div style="display:flex;gap:10px"><button class="btn green" type="submit">حفظ</button><button class="btn ghost" type="button" data-act="close" style="color:var(--g7)">إلغاء</button></div></form>`);
    document.getElementById('editf').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const err = document.getElementById('eerr'); err.hidden = true;
      try { await api(`/admin/users/${u.id}/edit`, { method: 'POST', body: f }); document.querySelector('.modal')?.remove(); toast('تم التعديل ✔'); done(f); }
      catch (x) { err.textContent = x.message; err.hidden = false; }
    };
  }
  function modal(html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div>${html}</div>`; m.onclick = (e) => { if (e.target === m) m.remove(); }; document.body.appendChild(m); }

  // ───────── التوجيه ─────────
  async function loadMe() { const d = await api('/me'); S.me = d.user; S.cfg.leaderboard = d.leaderboard; S.cfg.passScore = d.passScore; }
  async function route() {
    document.querySelector('.modal')?.remove();
    const h = (location.hash || '#/').slice(2); const p = h.split('/').map(decodeURIComponent);
    try {
      if (!S.pub) S.pub = await api('/public');
      const r = p[0] || '';
      if (r === '') return await viewHome();
      if (r === 'login' || r === 'register') return S.me ? go('#/') : viewAuth(r);
      if (r === 'pending') return viewPending();
      if (r === 'sec') return await viewSection(p[1]);
      if (r === 'topic') return await viewTopic(p[1]);
      if (r === 'quiz') return await viewQuiz(p[1], Number(p[2]));
      if (r === 'hifz') return await viewHifz();
      if (r === 'rank') return await viewRank(false);
      if (r === 'me') return await viewMe();
      if (r === 'admin') return p[1] === 'user' ? await viewAdminUser(p[2]) : await viewAdmin(p[1] || 'users');
      return go('#/');
    } catch (e) {
      if (e.status === 401) { S.me = null; return go('#/login'); }
      if (e.status === 403 && (e.data.error === 'pending' || e.data.error === 'blocked')) { await loadMe(); return go('#/pending'); }
      shell(`<div class="wrap page"><div class="note warn">حدث خطأ: ${esc(e.message)}</div></div>`, '');
    }
  }
  window.addEventListener('hashchange', route);
  (async () => { try { await loadMe(); } catch { } route(); })();
})();
