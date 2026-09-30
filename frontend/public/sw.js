/* Offline shell for the school management PWA.
 *
 * Strategy:
 *  - App shell + hashed build assets: cache-first (they are immutable).
 *  - Navigations: network-first, falling back to the cached shell when offline.
 *  - API / auth / anything under /api: NEVER cached. Stale attendance, grades
 *    or fee data would be worse than an error, so we let those fail and let the
 *    UI show its offline state.
 */

const CACHE = 'smis-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/sanctum') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/dashboard')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  // Static build assets are content-hashed: serve from cache when present.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Navigations: try network, fall back to the cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});
