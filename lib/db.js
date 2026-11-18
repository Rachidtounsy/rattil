const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const sec = require('./security');
const { hifzItems } = require('../content');

const db = new DatabaseSync(path.join(sec.DATA_DIR, 'rattil.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL,
  phone_hash TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, topic_id, level)
);
CREATE TABLE IF NOT EXISTS used_seeds(seed TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS hifz_status(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0 CHECK(status IN (0,1,2)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, item_key)
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const getSetting = (k, d = null) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r ? r.value : d; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
if (getSetting('leaderboard_public') === null) setSetting('leaderboard_public', '0');

// إنشاء حساب مشرف عند أول تشغيل
function bootstrapAdmin() {
  if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) return;
  const phone = sec.normPhone(process.env.ADMIN_PHONE || '0600000000');
  const generated = !process.env.ADMIN_PASSWORD;
  const pw = process.env.ADMIN_PASSWORD || sec.token().slice(0, 10);
  db.prepare("INSERT INTO users(name_enc,phone_enc,phone_hash,pass_hash,role,status) VALUES(?,?,?,?,'admin','active')")
    .run(sec.encrypt(process.env.ADMIN_NAME || 'المشرف'), sec.encrypt(phone), sec.blindIndex(phone), sec.hashPassword(pw));
  console.log('\n══════════ تم إنشاء حساب المشرف ══════════');
  console.log('  الهاتف   :', phone);
  if (generated) console.log('  كلمة السر :', pw, '  (غيّرها بعد الدخول، لن تظهر مرة أخرى)');
  console.log('══════════════════════════════════════════\n');
}
bootstrapAdmin();

module.exports = { db, getSetting, setSetting, hifzItems };
