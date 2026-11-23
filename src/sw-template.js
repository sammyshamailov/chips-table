// Service worker template. The build (scripts/sw-plugin.mts) writes dist/sw.js from it, filling in CACHE (named after
// the build, so every deploy gets a fresh cache and drops the old one) and SHELL (the built files, with hashed names).
const CACHE = __CACHE__;
const SHELL = __SHELL__;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const own = url.origin === location.origin;
  const lib = url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!own && !lib) return; // Firestore traffic goes straight to the network
  e.respondWith(
    fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
