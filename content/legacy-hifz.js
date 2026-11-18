// قائمة وحدات الحفظ — بترتيب فهرس كتاب «سور وآيات فاضلات» (رواية ورش عن نافع)
// key: معرّف ثابت (ما تبدّلوش بعد ما يبدا الإخوة يحفظو) | page: رقم الصفحة في الكتاب
// n: عدد الآيات (null = "ما تيسّر" أي مقاطع مختارة من السورة)
window.SURAHS = [
  { key: "fatiha",   name: "سورة الفاتحة",               page: 3,  n: 7 },
  { key: "baqara",   name: "ما تيسّر من سورة البقرة",    page: 3,  n: null },
  { key: "imran",    name: "ما تيسّر من سورة آل عمران",  page: 5,  n: null },
  { key: "tawba",    name: "ما تيسّر من سورة التوبة",    page: 9,  n: null },
  { key: "kahf",     name: "ما تيسّر من سورة الكهف",     page: 11, n: null },
  { key: "sajda",    name: "سورة السجدة",                page: 12, n: 30 },
  { key: "yasin",    name: "سورة يس",                    page: 15, n: 83 },
  { key: "ghafir",   name: "ما تيسّر من سورة غافر",      page: 22, n: null },
  { key: "dukhan",   name: "سورة الدخان",                page: 22, n: 59 },
  { key: "fath",     name: "ما تيسّر من سورة الفتح",     page: 25, n: null },
  { key: "waqia",    name: "سورة الواقعة",               page: 26, n: 96 },
  { key: "hadid",    name: "سورة الحديد",                page: 30, n: 29 },
  { key: "hashr",    name: "سورة الحشر",                 page: 35, n: 24 },
  { key: "saff",     name: "سورة الصف",                  page: 39, n: 14 },
  { key: "jumua",    name: "سورة الجمعة",                page: 41, n: 11 },
  { key: "taghabun", name: "سورة التغابن",               page: 43, n: 18 },
  { key: "mulk",     name: "سورة الملك",                 page: 46, n: 30 },
  { key: "ala",      name: "سورة الأعلى",                page: 49, n: 19 },
  { key: "duha",     name: "سورة الضحى",                 page: 50, n: 11 },
  { key: "sharh",    name: "سورة الشرح",                 page: 50, n: 8 },
  { key: "alaq",     name: "سورة العلق",                 page: 51, n: 19 },
  { key: "qadr",     name: "سورة القدر",                 page: 52, n: 5 },
  { key: "zalzala",  name: "سورة الزلزلة",              page: 52, n: 8 },
  { key: "takathur", name: "سورة التكاثر",               page: 54, n: 8 },
  { key: "asr",      name: "سورة العصر",                 page: 54, n: 3 },
  { key: "quraysh",  name: "سورة قريش",                  page: 55, n: 4 },
  { key: "maun",     name: "سورة الماعون",               page: 55, n: 7 },
  { key: "kawthar",  name: "سورة الكوثر",                page: 56, n: 3 },
  { key: "kafirun",  name: "سورة الكافرون",             page: 57, n: 6 },
  { key: "nasr",     name: "سورة النصر",                 page: 58, n: 3 },
  { key: "ikhlas",   name: "سورة الإخلاص",               page: 59, n: 4 },
  { key: "falaq",    name: "سورة الفلق",                 page: 60, n: 5 },
  { key: "nas",      name: "سورة الناس",                 page: 60, n: 6 }
];

// حالات الحفظ (كيحددها الأدمين)
window.MEMO_STATUS = [
  { v: 0, label: "لم يبدأ",   short: "لم يبدأ" },
  { v: 1, label: "قيد الحفظ", short: "قيد الحفظ" },
  { v: 2, label: "محفوظ",     short: "✓ محفوظ" }
];
