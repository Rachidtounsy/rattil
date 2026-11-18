const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
// نكتشف بيئة serverless (Netlify/AWS Lambda) أو استعمال قاعدة بعيدة: لا كتابة على القرص
const SERVERLESS = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.TURSO_DATABASE_URL);
if (!SERVERLESS) fs.mkdirSync(DATA_DIR, { recursive: true });

// مفتاح التشفير: من المتغير DATA_KEY (64 حرف hex) أو يُولَّد مرة واحدة ويُحفظ في data/secret.key
function loadKey() {
  if (process.env.DATA_KEY) {
    let k = process.env.DATA_KEY.trim().replace(/^["']|["']$/g, '');
    // تسامح: إذا لُصق المفتاح مرتين عن طريق الخطأ (128 حرفًا) نستعمل نصفه الأول، وهو نفس المفتاح
    if (k.length === 128 && /^[0-9a-f]+$/i.test(k) && k.slice(0, 64) === k.slice(64)) k = k.slice(0, 64);
    if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error('DATA_KEY must be 64 hex chars (0-9, a-f); current length = ' + k.length + (k.length === 64 ? ', but it contains a non-hex character' : ''));
    return Buffer.from(k, 'hex');
  }
  if (SERVERLESS) throw new Error('DATA_KEY environment variable is required on Netlify');
  const f = path.join(DATA_DIR, 'secret.key');
  if (fs.existsSync(f)) return Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex');
  const k = crypto.randomBytes(32);
  fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 });
  return k;
}
const MASTER = loadKey();
const ENC_KEY = Buffer.from(crypto.hkdfSync('sha256', MASTER, Buffer.alloc(0), 'rattil-enc', 32));
const MAC_KEY = Buffer.from(crypto.hkdfSync('sha256', MASTER, Buffer.alloc(0), 'rattil-mac', 32));

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decrypt(b64) {
  try {
    const b = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { return '⚠︎'; }
}
const blindIndex = (v) => crypto.createHmac('sha256', MAC_KEY).update(String(v)).digest('hex');
const sign = (v) => crypto.createHmac('sha256', MAC_KEY).update('sig:' + v).digest('hex').slice(0, 32);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + h.toString('hex');
}
function verifyPassword(pw, stored) {
  const [v, s, h] = String(stored).split('$');
  if (v !== 's1') return false;
  const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  return crypto.timingSafeEqual(x, Buffer.from(h, 'hex'));
}
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const token = () => crypto.randomBytes(32).toString('hex');

// رقم الهاتف: نُبقي الأرقام فقط ونوحّد الصيغة الدولية المغربية 212 → 0
function normPhone(p) {
  let d = String(p || '').replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '');
  if (d.startsWith('00212')) d = '0' + d.slice(5); else if (d.startsWith('212')) d = '0' + d.slice(3);
  return d;
}
const validPhone = (d) => /^\d{8,15}$/.test(d);

module.exports = { DATA_DIR, encrypt, decrypt, blindIndex, sign, hashPassword, verifyPassword, sha, token, normPhone, validPhone };
