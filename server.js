'use strict';
const express = require('express');
const path = require('node:path');
const sec = require('./lib/security');
const { all, get, run, batch, getSetting, setSetting, ready, hifzItems } = require('./lib/db');
const content = require('./content');
const { makeQuiz, publicQ, gradeOne, correctView, LEVEL_TITLES } = require('./lib/gen');

const { sections, PASS_SCORE } = content;
const SERVERLESS = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const PROD = process.env.NODE_ENV === 'production' || SERVERLESS;
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY || SERVERLESS) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'"
  });
  next();
});
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.json({ limit: '20kb' }));
// حماية CSRF: الطلبات المعدِّلة يجب أن تكون JSON (لا يمكن إرسالها من نموذج خارجي)
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'bad_content_type' });
  next();
});

// ───────── أدوات ─────────
const SESSION_DAYS = 365; // الجلسة سنة كاملة وتتجدد مع الاستعمال
const cookieOpts = (req, maxAge) => ({ httpOnly: true, sameSite: 'lax', secure: PROD || req.secure, path: '/', maxAge });
function parseCookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
let lastClean = 0;
async function cleanup() { const now = Date.now(); if (now - lastClean < 600e3) return; lastClean = now;
  for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k);
  await run('DELETE FROM sessions WHERE expires_at<?', now); await run('DELETE FROM used_seeds WHERE created_at<?', now - 6 * 3600e3); }

const publicUser = (u) => ({ id: u.id, name: sec.decrypt(u.name_enc), phone: sec.decrypt(u.phone_enc), role: u.role, status: u.status });

async function auth(req, res, next) {
  try {
  const t = parseCookies(req).sid;
  if (t) {
    const s = (await get('SELECT user_id, expires_at FROM sessions WHERE token_hash=?', sec.sha(t)));
    if (s && s.expires_at > Date.now()) {
      req.user = (await get('SELECT * FROM users WHERE id=?', s.user_id));
      // تجديد منزلق: إذا مرّ أكثر من أسبوع على آخر تجديد نمدّد الجلسة سنة جديدة
      if (req.user && s.expires_at - Date.now() < (SESSION_DAYS - 7) * 864e5) {
        await run('UPDATE sessions SET expires_at=? WHERE token_hash=?', Date.now() + SESSION_DAYS * 864e5, sec.sha(t));
        res.cookie('sid', t, cookieOpts(req, SESSION_DAYS * 864e5));
      }
    }
  }
  await cleanup().catch(() => {});
  } catch (e) { console.error(e); return res.status(500).json({ error: 'server_error' }); }
  next();
}
app.use('/api', async (req, res, next) => { try { await ready(); next(); } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); } });
app.use('/api', auth);
const needLogin = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'login_required' });
function needActive(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'login_required' });
  if (req.user.status === 'blocked') return res.status(403).json({ error: 'blocked' });
  if (req.user.status !== 'active') return res.status(403).json({ error: 'pending' });
  next();
}
const needAdmin = (req, res, next) => (req.user && req.user.role === 'admin' && req.user.status === 'active') ? next() : res.status(403).json({ error: 'admin_only' });
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'server_error' }); } };

async function startSession(req, res, userId) {
  const t = sec.token();
  (await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', sec.sha(t), userId, Date.now() + SESSION_DAYS * 864e5));
  res.cookie('sid', t, cookieOpts(req, SESSION_DAYS * 864e5));
  (await run("UPDATE users SET last_login=datetime('now') WHERE id=?", userId));
}

// ───────── التسجيل والدخول ─────────
app.post('/api/register', wrap(async (req, res) => {
  if (limited('reg:' + req.ip, 8, 3600e3)) return res.status(429).json({ error: 'too_many' });
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const phone = sec.normPhone(req.body.phone);
  const { password, password2 } = req.body;
  if (name.length < 3 || name.length > 60) return res.status(400).json({ error: 'name', message: 'يرجى إدخال الاسم (3 أحرف على الأقل).' });
  if (!sec.validPhone(phone)) return res.status(400).json({ error: 'phone', message: 'رقم الهاتف غير صالح.' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) return res.status(400).json({ error: 'password', message: 'كلمة السر 6 أحرف على الأقل.' });
  if (password !== password2) return res.status(400).json({ error: 'password2', message: 'تأكيد كلمة السر غير مطابق.' });
  const h = sec.blindIndex(phone);
  if ((await get('SELECT 1 FROM users WHERE phone_hash=?', h))) return res.status(409).json({ error: 'exists', message: 'هذا الرقم مسجَّل من قبل. جرّب تسجيل الدخول.' });
  (await run("INSERT INTO users(name_enc,phone_enc,phone_hash,pass_hash,role,status) VALUES(?,?,?,?,'user','pending')", sec.encrypt(name), sec.encrypt(phone), h, sec.hashPassword(password)));
  res.json({ ok: true, pending: true });
}));

app.post('/api/login', wrap(async (req, res) => {
  const phone = sec.normPhone(req.body.phone);
  if (limited('login:' + req.ip, 20, 600e3) || limited('loginp:' + phone, 10, 600e3)) return res.status(429).json({ error: 'too_many', message: 'محاولات كثيرة، أعد المحاولة بعد قليل.' });
  const u = (await get('SELECT * FROM users WHERE phone_hash=?', sec.blindIndex(phone)));
  if (!u || typeof req.body.password !== 'string' || !sec.verifyPassword(req.body.password, u.pass_hash)) return res.status(401).json({ error: 'bad_credentials', message: 'الرقم أو كلمة السر غير صحيحين.' });
  await startSession(req, res, u.id);
  res.json({ ok: true, user: publicUser(u) });
}));

app.post('/api/logout', wrap(async (req, res) => {
  const t = parseCookies(req).sid; if (t) (await run('DELETE FROM sessions WHERE token_hash=?', sec.sha(t)));
  res.clearCookie('sid', { path: '/' }); res.json({ ok: true });
}));

app.get('/api/me', wrap(async (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null, leaderboard: (await getSetting('leaderboard_public')) === '1', passScore: PASS_SCORE });
}));

app.get('/api/public', (req, res) => res.json({ sections: sections.map((s) => ({ id: s.id, name: s.name, icon: s.icon, color: s.color, desc: s.desc, kind: s.kind || 'quiz', topics: s.kind === 'hifz' ? hifzItems.length : s.topics.length })) }));

app.post('/api/me/password', needLogin, wrap(async (req, res) => {
  const { current, password, password2 } = req.body;
  if (!sec.verifyPassword(String(current || ''), req.user.pass_hash)) return res.status(400).json({ message: 'كلمة السر الحالية غير صحيحة.' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ message: 'كلمة السر الجديدة 6 أحرف على الأقل.' });
  if (password !== password2) return res.status(400).json({ message: 'تأكيد كلمة السر غير مطابق.' });
  (await run('UPDATE users SET pass_hash=? WHERE id=?', sec.hashPassword(password), req.user.id));
  res.json({ ok: true });
}));

// ───────── المحتوى والتقدّم ─────────
async function progressMap(uid) {
  const m = {};
  for (const r of (await all('SELECT topic_id,level,best FROM progress WHERE user_id=?', uid))) (m[r.topic_id] ||= Array(10).fill(null))[r.level - 1] = r.best;
  return m;
}
const hifzMap = async (uid) => { const m = {}; for (const r of (await all('SELECT item_key,status FROM hifz_status WHERE user_id=?', uid))) m[r.item_key] = r.status; return m; };

app.get('/api/catalog', needActive, wrap(async (req, res) => {
  const pm = await progressMap(req.user.id), hm = await hifzMap(req.user.id);
  res.json({
    passScore: PASS_SCORE, levelTitles: LEVEL_TITLES,
    sections: sections.map((s) => ({
      id: s.id, name: s.name, icon: s.icon, color: s.color, desc: s.desc, kind: s.kind || 'quiz',
      topics: s.topics.map((t) => ({ id: t.id, name: t.name, icon: t.icon, desc: t.desc, stage: t.stage, stageSub: t.stageSub, levels: pm[t.id] || Array(10).fill(null) })),
      hifz: s.kind === 'hifz' ? { done: hifzItems.filter((i) => hm[i.key] === 2).length, total: hifzItems.length } : undefined
    }))
  });
}));

app.get('/api/topic/:id', needActive, wrap(async (req, res) => {
  const t = content.topicIndex.get(req.params.id); if (!t) return res.status(404).json({ error: 'not_found' });
  const pm = (await progressMap(req.user.id))[t.id] || Array(10).fill(null);
  res.json({ id: t.id, name: t.name, icon: t.icon, stage: t.stage, section: t.section, lesson: t.lesson, levels: pm, levelTitles: LEVEL_TITLES, passScore: PASS_SCORE });
}));

const unlocked = async (user, topicId, level) => {
  if (level === 1 || user.role === 'admin') return true;
  const r = (await get('SELECT best FROM progress WHERE user_id=? AND topic_id=? AND level=?', user.id, topicId, level - 1));
  return !!r && r.best >= PASS_SCORE;
};
const lvlOf = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 0; };

app.get('/api/quiz/:topic/:level', needActive, wrap(async (req, res) => {
  const level = lvlOf(req.params.level); const topicId = req.params.topic;
  if (!level || !content.topicIndex.has(topicId)) return res.status(404).json({ error: 'not_found' });
  if (!await unlocked(req.user, topicId, level)) return res.status(403).json({ error: 'locked', message: 'أكمل المرحلة السابقة أولًا.' });
  const seed = sec.token().slice(0, 12);
  const sig = sec.sign([req.user.id, topicId, level, seed].join('|'));
  const quiz = makeQuiz(topicId, level, seed);
  res.json({ topic: { id: topicId, name: quiz.topic.name }, level, title: quiz.title, seed, sig, passScore: PASS_SCORE, questions: quiz.questions.map(publicQ) });
}));

app.post('/api/quiz/:topic/:level/submit', needActive, wrap(async (req, res) => {
  const level = lvlOf(req.params.level); const topicId = req.params.topic;
  const { seed, sig, answers } = req.body;
  if (!level || !content.topicIndex.has(topicId) || typeof seed !== 'string' || !Array.isArray(answers)) return res.status(400).json({ error: 'bad_request' });
  if (sig !== sec.sign([req.user.id, topicId, level, seed].join('|'))) return res.status(400).json({ error: 'bad_signature' });
  if (!await unlocked(req.user, topicId, level)) return res.status(403).json({ error: 'locked' });
  if ((await get('SELECT 1 FROM used_seeds WHERE seed=?', seed + ':' + req.user.id))) return res.status(409).json({ error: 'used', message: 'تم تسليم هذا الاختبار من قبل.' });
  (await run('INSERT INTO used_seeds(seed,created_at) VALUES(?,?)', seed + ':' + req.user.id, Date.now()));
  const quiz = makeQuiz(topicId, level, seed);
  let score = 0;
  const review = quiz.questions.map((q, i) => { const ok = gradeOne(q, answers[i]); if (ok) score++; return { ok, correct: correctView(q), prompt: q.prompt, claim: q.claim || null, type: q.type }; });
  (await run(`INSERT INTO progress(user_id,topic_id,level,best,attempts) VALUES(?,?,?,?,1)
    ON CONFLICT(user_id,topic_id,level) DO UPDATE SET best=MAX(best,excluded.best), attempts=attempts+1, updated_at=datetime('now')`, req.user.id, topicId, level, score));
  const best = (await get('SELECT best FROM progress WHERE user_id=? AND topic_id=? AND level=?', req.user.id, topicId, level)).best;
  res.json({ score, total: quiz.questions.length, passed: score >= PASS_SCORE, stars: score >= 10 ? 3 : score >= 9 ? 2 : score >= PASS_SCORE ? 1 : 0, best, review, hasNext: level < 10 });
}));

app.get('/api/hifz', needActive, wrap(async (req, res) => {
  const hm = await hifzMap(req.user.id);
  res.json({ items: hifzItems.map((i) => ({ ...i, status: hm[i.key] || 0 })) });
}));

// ───────── لوحة الشرف ─────────
async function computeBoard(scope, id) {
  const users = (await all("SELECT id,name_enc FROM users WHERE role='user' AND status='active'"));
  const name = new Map(users.map((u) => [u.id, sec.decrypt(u.name_enc)]));
  let rows = [];
  if (scope === 'hifz') {
    const m = new Map(users.map((u) => [u.id, { done: 0, doing: 0 }]));
    for (const r of (await all('SELECT user_id,status FROM hifz_status WHERE status>0'))) { const x = m.get(r.user_id); if (x) r.status === 2 ? x.done++ : x.doing++; }
    rows = [...m].map(([uid, x]) => ({ id: uid, score: x.done, sub: x.doing ? `+ ${x.doing} قيد الحفظ` : '', unit: 'محفوظ' }));
  } else {
    let ids = null;
    if (scope === 'section') ids = (sections.find((s) => s.id === id) || { topics: [] }).topics.map((t) => t.id);
    if (scope === 'topic') ids = content.topicIndex.has(id) ? [id] : [];
    const m = new Map(users.map((u) => [u.id, { pts: 0, lv: 0 }]));
    for (const r of (await all('SELECT user_id,topic_id,best FROM progress'))) {
      if (ids && !ids.includes(r.topic_id)) continue; const x = m.get(r.user_id); if (!x) continue;
      x.pts += r.best; if (r.best >= PASS_SCORE) x.lv++;
    }
    rows = [...m].map(([uid, x]) => ({ id: uid, score: x.pts, sub: `${x.lv} مرحلة مجتازة`, unit: 'نقطة' }));
  }
  rows = rows.filter((r) => r.score > 0 || scope === 'hifz' && r.sub).sort((a, b) => b.score - a.score || a.id - b.id);
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } r.rank = rank; r.name = name.get(r.id); });
  return rows;
}
function boardHandler(forceAll) {
  return wrap(async (req, res) => {
    if (!forceAll && (await getSetting('leaderboard_public')) !== '1' && req.user.role !== 'admin') return res.status(403).json({ error: 'hidden', message: 'لوحة الشرف غير مفعّلة حاليًا.' });
    const scope = ['all', 'section', 'topic', 'hifz'].includes(req.query.scope) ? req.query.scope : 'all';
    const rows = await computeBoard(scope, String(req.query.id || ''));
    const me = rows.find((r) => r.id === req.user.id);
    res.json({ rows: rows.slice(0, 50).map(({ id, ...r }) => ({ ...r, me: id === req.user.id })), me: me ? me.rank : null, total: rows.length,
      scopes: { sections: sections.map((s) => ({ id: s.id, name: s.name, kind: s.kind || 'quiz', topics: s.topics.map((t) => ({ id: t.id, name: t.name })) })) } });
  });
}
app.get('/api/leaderboard', needActive, boardHandler(false));

// ───────── الإدارة ─────────
const A = [needActive, needAdmin];
async function userStats(uid) {
  const r = (await get('SELECT COALESCE(SUM(best),0) pts, COALESCE(SUM(best>=?),0) lv FROM progress WHERE user_id=?', PASS_SCORE, uid));
  const h = (await get('SELECT SUM(status=2) d, SUM(status=1) g FROM hifz_status WHERE user_id=?', uid));
  return { points: r.pts, levels: r.lv, hifzDone: h.d || 0, hifzDoing: h.g || 0 };
}
app.get('/api/admin/users', ...A, wrap(async (req, res) => {
  const rows = (await all("SELECT * FROM users WHERE role='user' ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, id DESC"));
  res.json({ users: await Promise.all(rows.map(async (u) => ({ ...publicUser(u), createdAt: u.created_at, lastLogin: u.last_login, ...(await userStats(u.id)) }))), totalLevels: sections.reduce((a, s) => a + s.topics.length * 10, 0) });
}));
const target = async (req, res) => { const u = (await get("SELECT * FROM users WHERE id=? AND role='user'", Number(req.params.id))); if (!u) res.status(404).json({ error: 'not_found' }); return u; };
app.post('/api/admin/users/:id/status', ...A, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  const st = req.body.status; if (!['active', 'pending', 'blocked'].includes(st)) return res.status(400).json({ error: 'bad_status' });
  (await run('UPDATE users SET status=? WHERE id=?', st, u.id));
  if (st !== 'active') (await run('DELETE FROM sessions WHERE user_id=?', u.id));
  res.json({ ok: true });
}));
app.post('/api/admin/users/:id/password', ...A, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  let pw = req.body.password;
  if (pw !== undefined && pw !== '') { if (typeof pw !== 'string' || pw.length < 6) return res.status(400).json({ message: 'كلمة السر 6 أحرف على الأقل.' }); }
  else pw = sec.token().slice(0, 8);
  (await run('UPDATE users SET pass_hash=? WHERE id=?', sec.hashPassword(pw), u.id));
  (await run('DELETE FROM sessions WHERE user_id=?', u.id));
  res.json({ ok: true, password: pw });
}));
app.delete('/api/admin/users/:id', ...A, wrap(async (req, res) => { const u = await target(req, res); if (!u) return; await batch(['sessions', 'progress', 'hifz_status'].map((t) => ['DELETE FROM ' + t + ' WHERE user_id=?', u.id]).concat([['DELETE FROM users WHERE id=?', u.id]])); res.json({ ok: true }); }));

app.get('/api/admin/users/:id', ...A, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  const pm = await progressMap(u.id), hm = await hifzMap(u.id);
  const att = new Map((await all('SELECT topic_id, SUM(attempts) a FROM progress WHERE user_id=? GROUP BY topic_id', u.id)).map((r) => [r.topic_id, r.a]));
  res.json({
    user: { ...publicUser(u), createdAt: u.created_at, lastLogin: u.last_login, ...(await userStats(u.id)) }, passScore: PASS_SCORE,
    sections: sections.filter((s) => s.kind !== 'hifz').map((s) => ({
      id: s.id, name: s.name, icon: s.icon,
      topics: s.topics.map((t) => ({ id: t.id, name: t.name, stage: t.stage, levels: pm[t.id] || Array(10).fill(null), attempts: att.get(t.id) || 0 }))
    })),
    hifz: hifzItems.map((i) => ({ ...i, status: hm[i.key] || 0 }))
  });
}));
app.post('/api/admin/users/:id/hifz', ...A, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  const st = Number(req.body.status); if (![0, 1, 2].includes(st)) return res.status(400).json({ error: 'bad_status' });
  const keys = Array.isArray(req.body.keys) ? req.body.keys : [req.body.key];
  const valid = new Set(hifzItems.map((i) => i.key));
  const ins = "INSERT INTO hifz_status(user_id,item_key,status) VALUES(?,?,?) ON CONFLICT(user_id,item_key) DO UPDATE SET status=excluded.status, updated_at=datetime('now')";
  await batch(keys.filter((k) => valid.has(k)).map((k) => [ins, u.id, k, st]));
  res.json({ ok: true });
}));
app.get('/api/admin/leaderboard', ...A, boardHandler(true));
app.get('/api/admin/settings', ...A, wrap(async (req, res) => res.json({ leaderboard_public: (await getSetting('leaderboard_public')) === '1' })));
app.post('/api/admin/settings', ...A, wrap(async (req, res) => { await setSetting('leaderboard_public', req.body.leaderboard_public ? '1' : '0'); res.json({ ok: true }); }));

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '1h' : 0 }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = Number(process.env.PORT) || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`رتّل يعمل على: http://localhost:${PORT}`));
module.exports = app;
