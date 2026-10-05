// Offline support: keeps the page, the map library and any map tiles you have looked at (or saved) on the phone.
const VERSION = '20261005-1456';
const SHELL = 'trip-shell-' + VERSION;
const TILES = 'trip-tiles-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'leaflet/leaflet.js', 'leaflet/leaflet.css', 'leaflet/images/layers.png', 'leaflet/images/layers-2x.png',
  'leaflet/images/marker-icon.png', 'leaflet/images/marker-icon-2x.png', 'leaflet/images/marker-shadow.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('trip-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tile.openstreetmap.org') { e.respondWith(tile(req)); return; }
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.txt')) return;           // always ask the network about new versions
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) { e.respondWith(page(req)); return; }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(r => r || fetch(req)));
});

// the page: use the network when it answers quickly (so updates arrive), otherwise the saved copy
function page(req) {
  return caches.match('index.html').then(cached => {
    const net = fetch(req).then(r => {
      if (r && r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put('index.html', cp)); return r; }
      if (!cached) return r;
      throw new Error('bad response');
    });
    if (!cached) return net;
    const timeout = new Promise(res => setTimeout(() => res(null), 3500));
    return Promise.race([net.catch(() => null), timeout]).then(r => r || cached);
  });
}
// map tiles: saved copy first, otherwise fetch and keep
function tile(req) {
  return caches.open(TILES).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); if (Math.random() < 0.02) trim(c); }
    return r;
  }).catch(() => hit || Response.error())));
}
function trim(c) {
  c.keys().then(ks => { if (ks.length > 2500) ks.slice(0, ks.length - 2200).forEach(k => c.delete(k)); });
}
