const CACHE_NAME = 'qr-studio-v1';
const APP_URL = new URL('./', self.location.href).href;
const INDEX_URL = new URL('index.html', APP_URL).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(APP_URL, { cache: 'reload' }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('qr-studio-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      (url.href !== APP_URL && url.href !== INDEX_URL)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(request, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        // Cache only the pristine HTML response, never the user's live DOM or inputs.
        try {
          await cache.put(APP_URL, response.clone());
        } catch {
          // A storage failure must not prevent online use.
        }
        return response;
      }
      return await cache.match(APP_URL) || response;
    } catch (error) {
      const offline = await cache.match(APP_URL);
      if (offline) return offline;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })());
});
