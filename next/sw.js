// Guess Ball service worker: keeps a copy of the app on the phone so it opens with no signal,
// and swaps in new versions automatically. Bump VERSION on every release.
const VERSION = 'gb-next-1';
const SHELL = ['./', './index.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gb-next') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const mine = url.origin === location.origin && url.pathname.startsWith(new URL('./', self.registration.scope).pathname);
  const lib = (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))   // Firebase code
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';          // fonts
  if (!mine && !lib) return;                                                                     // live data goes straight to Firebase
  // Fresh copy when online, saved copy when not
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
