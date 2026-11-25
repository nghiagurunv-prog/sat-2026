/**
 * SAT.Guru Service Worker (W2 #30 — PWA Offline Cache & KaTeX Asset Stability)
 * Chỉ cache tài nguyên tĩnh (icons, manifest, katex CSS/fonts) bằng Stale-While-Revalidate.
 * TUYỆT ĐỐI không cache API (/api/*) hay trang xác thực (/auth/*, /login).
 */
const CACHE_NAME = 'satguru-static-v1';
const PRECACHE_URLS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  const isCacheableStatic =
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.includes('katex') ||
    /\.(woff2|woff|ttf|png|svg|ico)$/i.test(url.pathname);

  if (!isCacheableStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            cache.put(req, res.clone()).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })
  );
});
