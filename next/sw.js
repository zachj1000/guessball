// Guess Ball service worker: keeps a copy of the app on the phone so it opens with no signal,
// and swaps in new versions automatically. Bump VERSION on every release.
const PREFIX = 'gb-qa';   // the real app and the QA copy (Guess Ball Next) keep separate saved copies
const VERSION = PREFIX + '-42';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const SHELL = ['./', './index.html'];
const LIBS = [FB + 'firebase-app.js', FB + 'firebase-auth.js', FB + 'firebase-database.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Big+Shoulders+Display:wght@700;800;900&family=Courier+Prime:wght@400;700&family=Norican&display=swap'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith(PREFIX + '-') && k !== VERSION) || (PREFIX === 'gb-live' && (k.startsWith('guessball-') || k.startsWith('gb-next-')))).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin && url.pathname.startsWith(new URL('./', self.registration.scope).pathname);
  const lib = (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))   // Firebase code
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';          // fonts
  if (!mine && !lib) return;                                                                     // live data goes straight to Firebase
  // Firebase code and fonts never change for a version: use the saved copy first
  if (lib) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  // The app itself: fresh copy when online, saved copy when not
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
