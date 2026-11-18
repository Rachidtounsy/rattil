# نشر رتّل على الإنترنت

التطبيق فيه خادم Node وقاعدة SQLite، فيحتاج استضافة تشغّل Node وفيها **قرص دائم** (Volume) لمجلد `/data`.
الاستضافات الثابتة (Netlify / GitHub Pages) لا تصلح.

## المتغيرات المطلوبة (في أي استضافة)

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
