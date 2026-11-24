// MEC-APP service worker: الصفحة نفسها دايما من النت لو متاح (عشان التحديث يوصل)، والباقي من الكاش
const CACHE = 'mec-app-v0.13.0';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './logo-512.png', './badge-96.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'mec-share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const OFFLINE = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1D2E4F"><title>MEC</title></head><body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Tahoma,sans-serif;background:#fff;color:#1B2333;text-align:center;padding:24px"><img src="icon-192.png" alt="MEC" style="width:96px;height:96px;border-radius:50%"><b style="margin-top:16px;font-size:18px">MEC-APP</b><p style="color:#5B6270">📴 مفيش نت. افتح التطبيق مرة بالنت عشان يتخزن على الموبايل.</p><button onclick="location.reload()" style="border:0;background:#E8AA2E;border-radius:12px;padding:12px 22px;font-size:16px">جرّب تاني</button></body></html>';
const offline = () => caches.match('./index.html').then(r => r || new Response(OFFLINE, {headers: {'Content-Type': 'text/html; charset=utf-8'}}));
self.addEventListener('fetch', e => {
  const req = e.request;
  // 0.12.1: صورة متشاركة لـ MEC-APP (Share Target) ← تتحفظ والتطبيق يفتحها
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share')) {
    e.respondWith((async () => { try { const fd = await req.formData(), c = await caches.open('mec-share'); let i = 0;
      for (const f of fd.getAll('f')) if (f && f.size) await c.put('./shared-' + Date.now() + '-' + (i++), new Response(f, {headers: {'Content-Type': f.type}})); } catch (x) {}
      return Response.redirect('./?shared=1', 303); })());
    return;
  }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  if (req.mode === 'navigate') {
    // النت الضعيف في الموقع: لو الصفحة ما جاتش في 4 ثواني تفتح من الموبايل، والجديدة بتتحفظ للمرة الجاية
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); } return r; });
    e.respondWith(Promise.race([net, new Promise(res => setTimeout(() => caches.match('./index.html').then(h => h && res(h)), 4000))])
      .catch(() => offline()).then(r => r || offline()));
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
  try { if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge(); } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || 'MEC-APP', {body: d.body || '', icon: './icon-192.png', badge: './badge-96.png', tag: d.tag || 'mec', renotify: true,
    dir: 'rtl', lang: 'ar', data: {ref: d.ref || '', url: './' + (d.ref === 'night' ? '#night' : '')}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const data = e.notification.data || {};
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(L => { const c = L.find(x => x.url.indexOf(self.registration.scope) === 0);
    if (c) { c.postMessage({push: data}); return c.focus(); } return clients.openWindow(data.url || './'); }));
});
