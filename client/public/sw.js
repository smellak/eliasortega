const CACHE_NAME = 'centrohogar-v3';
const STATIC_ASSETS = [
  '/favicon.png',
  '/logo-sanchez.png',
  '/manifest.json',
];

// Install — cache only truly static assets (NOT HTML pages)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - Navigation (HTML): NETWORK-FIRST (always get latest deploy)
//   - API calls: NETWORK-FIRST
//   - Static assets (.js, .css, images): CACHE-FIRST (they have content hashes)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Navigation requests (HTML pages): NETWORK-FIRST
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest HTML for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexi\u00f3n</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#64748b}</style></head><body><div><h1>Sin conexi\u00f3n</h1><p>Vuelve a intentarlo cuando tengas internet.</p></div></body></html>',
              { headers: { 'Content-Type': 'text/html' }, status: 503 }
            );
          })
        )
    );
    return;
  }

  // API calls: NETWORK-FIRST
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexi\u00f3n' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Static assets (JS/CSS with hashes, images, fonts): CACHE-FIRST
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|woff2?|mp4)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
