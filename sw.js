// MEC-APP service worker: الصفحة نفسها دايما من النت لو متاح (عشان التحديث يوصل)، والباقي من الكاش
const CACHE = 'mec-app-v0.12';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './logo-512.png', './badge-96.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  if (req.mode === 'navigate') {
    // النت الضعيف في الموقع: لو الصفحة ما جاتش في 4 ثواني تفتح من الموبايل، والجديدة بتتحفظ للمرة الجاية
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); } return r; });
    e.respondWith(Promise.race([net, new Promise(res => setTimeout(() => caches.match('./index.html').then(h => h && res(h)), 4000))])
      .catch(() => caches.match('./index.html')).then(r => r || caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  })));
});

// 0.11.1: الإشعارات (Firebase بيبعت data بس، والـ service worker بيعرضها)
self.addEventListener('push', e => {
  let d = {}; try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j; } catch (x) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'MEC-APP', {body: d.body || '', icon: './icon-192.png', badge: './badge-96.png', tag: d.tag || 'mec', renotify: true,
    dir: 'rtl', lang: 'ar', data: {ref: d.ref || '', url: './' + (d.ref === 'night' ? '#night' : '')}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const data = e.notification.data || {};
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(L => { const c = L.find(x => x.url.indexOf(self.registration.scope) === 0);
    if (c) { c.postMessage({push: data}); return c.focus(); } return clients.openWindow(data.url || './'); }));
});
