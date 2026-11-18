// قاعدة البيانات عبر libSQL: ملف SQLite محلي افتراضيًا، أو Turso (SQLite سحابي) عند ضبط TURSO_DATABASE_URL
const path = require('node:path');
const sec = require('./security');
const { hifzItems } = require('../content');

let url = process.env.TURSO_DATABASE_URL || 'file:' + path.join(sec.DATA_DIR, 'rattil.db');
let client;
if (url.startsWith('file:')) client = require('@libsql/client').createClient({ url });
else { // Turso: نسخة الويب (HTTP) بلا مكتبات native، مناسبة لـ Netlify
  url = url.replace(/^libsql:\/\//, 'https://');
  client = require('@libsql/client/web').createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

const clean = (a) => a.map((x) => (x === undefined ? null : x));
const all = async (sql, ...args) => (await client.execute({ sql, args: clean(args) })).rows.map((r) => ({ ...r }));
const get = async (sql, ...args) => (await all(sql, ...args))[0];
const run = async (sql, ...args) => { await client.execute({ sql, args: clean(args) }); };
const batch = async (stmts) => { if (stmts.length) await client.batch(stmts.map(([sql, ...args]) => ({ sql, args: clean(args) })), 'write'); };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, name_enc TEXT NOT NULL, phone_enc TEXT NOT NULL, phone_hash TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','blocked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')), last_login TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS progress(user_id INTEGER NOT NULL, topic_id TEXT NOT NULL, level INTEGER NOT NULL, best INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(user_id, topic_id, level))`,
  `CREATE TABLE IF NOT EXISTS used_seeds(seed TEXT PRIMARY KEY, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hifz_status(user_id INTEGER NOT NULL, item_key TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0 CHECK(status IN (0,1,2)),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(user_id, item_key))`,
  `CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`
];

const getSetting = async (k, d = null) => { const r = await get('SELECT value FROM settings WHERE key=?', k); return r ? r.value : d; };
const setSetting = (k, v) => run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(v));

async function bootstrapAdmin() {
  if (await get("SELECT 1 FROM users WHERE role='admin'")) return;
  const phone = sec.normPhone(process.env.ADMIN_PHONE || '0600000000');
  const generated = !process.env.ADMIN_PASSWORD;
  const pw = process.env.ADMIN_PASSWORD || sec.token().slice(0, 10);
  try {
    await run("INSERT INTO users(name_enc,phone_enc,phone_hash,pass_hash,role,status) VALUES(?,?,?,?,'admin','active')",
      sec.encrypt(process.env.ADMIN_NAME || 'المشرف'), sec.encrypt(phone), sec.blindIndex(phone), sec.hashPassword(pw));
  } catch { return; }
  console.log('\n══════════ تم إنشاء حساب المشرف ══════════\n  الهاتف   :', phone);
  if (generated) console.log('  كلمة السر :', pw, '  (غيّرها بعد الدخول، لن تظهر مرة أخرى)');
  console.log('══════════════════════════════════════════\n');
}

// تهيئة كسولة: تُنفَّذ مرة واحدة عند أول طلب (مناسبة للـ serverless)
let readyP = null;
const ready = () => readyP || (readyP = (async () => {
  await batch(SCHEMA.map((s) => [s]));
  if ((await getSetting('leaderboard_public')) === null) await setSetting('leaderboard_public', '0');
  await bootstrapAdmin();
})().catch((e) => { readyP = null; throw e; }));

module.exports = { all, get, run, batch, getSetting, setSetting, ready, hifzItems };
