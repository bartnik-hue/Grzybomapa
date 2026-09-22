/**
 * sw.js — Service Worker
 * Network-first dla plików aplikacji (gwarancja zawsze aktualnego kodu)
 */

const CACHE = 'grzybomap-v4.2-network-first';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Zawsze pytaj najpierw sieć, cache tylko jako fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Zapisz kopię w cache jeśli to GET
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
