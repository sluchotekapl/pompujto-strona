// pompujto.pl – service worker: aplikacja działa bez internetu (na siłowni bez zasięgu).
// Strona i skrypty: najpierw sieć, potem kopia. Obrazki ćwiczeń: najpierw kopia. Supabase i AI: zawsze sieć.
const V = 'pj-v3';
const SHELL = ['./', 'index.html', 'assets/app.js', 'assets/index.css', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'config.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).catch(() => { })).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/.netlify/')) return;
  if (u.pathname.includes('/img/')) {
    e.respondWith(caches.open(V + '-img').then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok) caches.open(V).then(c => c.put(r, res.clone())); return res; })
    .catch(() => caches.match(r).then(hit => hit || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
