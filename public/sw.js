// service worker بسيط: يخزّن واجهة التطبيق فقط. الـ API والحسابات دائمًا من الشبكة.
const CACHE = 'rattil-v1';
const SHELL = ['/', '/css/style.css', '/js/app.js', '/icons/icon.svg', '/offline.html'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r).then((m) => m || (r.mode === 'navigate' ? caches.match('/offline.html') : undefined))));
});
