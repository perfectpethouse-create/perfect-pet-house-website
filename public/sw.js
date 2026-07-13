/* Perfect Pet House — service worker
   กันหน้าจอขาว "ไม่พบข้อมูลเว็บ" ตอนเซิร์ฟเวอร์ตอบช้า/ล่มชั่วคราว
   กลยุทธ์: หน้า HTML = network-first (ออนไลน์ได้ของใหม่เสมอ, ถ้าเน็ต/เซิร์ฟเวอร์ล่มค่อยดึง cache)
           ไฟล์ static = cache-first (เร็ว) */
var CACHE = 'pph-v1';
var CORE = ['/', '/app.html', '/index.html', '/exercise-zone.html',
  '/manifest.webmanifest', '/images/img01.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // same-origin only

  var isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') > -1;

  if (isHTML) {
    // network-first: ของใหม่เสมอเมื่อออนไลน์, ล่มเมื่อไรค่อย fallback cache
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) {
          return m || caches.match('/app.html') || caches.match('/index.html') || caches.match('/');
        });
      })
    );
    return;
  }

  // static: cache-first
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return m; });
    })
  );
});
