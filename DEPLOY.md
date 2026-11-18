# نشر رتّل على الإنترنت

## الخيار الموصى به مجانًا: Netlify + Turso

Netlify يستضيف الواجهة ودالة الـ API، وقاعدة البيانات على **Turso** (SQLite سحابي بخطة مجانية). لا حاجة لدفع شيء للبدء.

### 1) قاعدة البيانات (Turso)
1. أنشئ حسابًا في https://turso.tech ثم **Create database** (سمّها `rattil`).
2. من صفحة القاعدة انسخ **URL** (يبدأ بـ `libsql://`) وأنشئ **Token** وانسخه.

### 2) المفتاح السري
ولّد مفتاح التشفير واحفظه في مكان آمن (**إذا ضاع لن تُفك أسماء المستخدمين وهواتفهم**):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3) الموقع (Netlify)
1. https://app.netlify.com ← **Add new site ← Import an existing project ← GitHub** ← اختر `rattil`.
2. اترك Build command فارغًا (الإعدادات في `netlify.toml`).
3. قبل أول نشر (Site configuration ← Environment variables) أضف:

| المتغير | القيمة |
|---|---|
| `TURSO_DATABASE_URL` | رابط Turso (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | توكن Turso |
| `DATA_KEY` | المفتاح الذي ولّدته (64 حرفًا) |
| `ADMIN_PHONE` | هاتف المشرف |
| `ADMIN_PASSWORD` | كلمة سر قوية للمشرف |
| `ADMIN_NAME` | اسم المشرف (اختياري) |

4. **Deploy**. افتح رابط `https://xxxx.netlify.app` وادخل بحساب المشرف. الجداول تُنشأ تلقائيًا عند أول طلب، ويُنشأ المشرف إن لم يوجد.
5. يمكنك تغيير اسم الرابط من Domain settings أو ربط دومين خاص.

### ملاحظات
- متغيرا `ADMIN_*` يُستعملان **مرة واحدة** عند إنشاء المشرف. لتغيير كلمة سره لاحقًا استعمل صفحة «حسابي».
- تحديد محاولات الدخول يعمل داخل كل نسخة من الدالة فقط (حماية جزئية في الـ serverless).
- حدود الخطتين المجانيتين (عدد طلبات الدوال، حجم قاعدة Turso) تتغير؛ راجعها قبل الإطلاق للعدد الكبير من المستخدمين.
- لم تُجرَّب هذه الخطوات على حساب Netlify/Turso حقيقي من طرفي؛ اختُبرت الدالة محليًا بمحاكاة Lambda وقاعدة ملف محلية.

---

## بدائل: خادم Node دائم (Docker / VPS / Railway…)

التطبيق يعمل أيضًا كخادم عادي مع ملف SQLite على قرص دائم `/data`.

### المتغيرات (للخادم الدائم)

| المتغير | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `DATA_DIR` | `/data` (مسار القرص الدائم) |
| `DATA_KEY` | 64 حرفًا hex، ولّدها بالأمر أدناه. **احتفظ بنسخة منها، فبدونها تضيع بيانات المستخدمين** |
| `ADMIN_PHONE` | رقم المشرف |
| `ADMIN_PASSWORD` | كلمة سر قوية للمشرف |
| `ADMIN_NAME` | اسم المشرف (اختياري) |

توليد `DATA_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## الخيار 1: Railway أو Render أو Fly.io (الأسهل، من الواجهة)

1. ارفع المشروع إلى GitHub (موجود) ثم أنشئ مشروعًا جديدًا من المستودع. سيكتشف `Dockerfile` تلقائيًا.
2. أضف المتغيرات أعلاه.
3. أضف **Volume** (قرصًا دائمًا) وركّبه على المسار `/data`.
4. افتح الرابط الذي تعطيه المنصة وجرّب الدخول بحساب المشرف.

> الخطط المجانية تتغير وكثير منها بلا قرص دائم أو يوقف الخدمة عند الخمول؛ تأكد من شروط المنصة وقت النشر. بدون قرص دائم تُمحى البيانات عند كل إعادة تشغيل.

## الخيار 2: VPS (الأضمن، حوالي 4–5 دولارات شهريًا)

على Ubuntu، بعد تثبيت Docker:

```bash
git clone https://github.com/Rachidtounsy/rattil.git && cd rattil
docker build -t rattil .
docker run -d --name rattil --restart unless-stopped -p 3000:3000 -v rattil-data:/data \
  -e DATA_KEY=<المفتاح> -e ADMIN_PHONE=<الهاتف> -e ADMIN_PASSWORD='<كلمة السر>' rattil
```

ثم ضع Caddy أمامه للحصول على HTTPS تلقائيًا (ملف `Caddyfile`):

```
rattil.example.com {
    reverse_proxy localhost:3000
}
```

## الخيار 3: تجربة سريعة مع أشخاص من حاسوبك (مجاني)

شغّل التطبيق محليًا ثم:

```bash
cloudflared tunnel --url http://localhost:3000
```

يعطيك رابطًا مؤقتًا https تشاركه. يعمل ما دام حاسوبك مفتوحًا. مناسب للتجريب فقط.

## بعد النشر

- النسخ الاحتياطي: انسخ مجلد `/data` (القاعدة + المفتاح) بانتظام.
- التحديث: `git pull` ثم أعد بناء الحاوية (أو يتم تلقائيًا في Railway/Render).
- راجع المحتوى العلمي مع شيخ قبل فتح الموقع للناس.
